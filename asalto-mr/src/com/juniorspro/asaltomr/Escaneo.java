package com.juniorspro.asaltomr;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * El escaneo, en DOS hilos (como Aeroplaza, que malla en su propio hilo):
 *
 *  - "escaneo": el hilo de dibujo le deja una imagen de profundidad (con su
 *    pose y sus intrínsecos) cuando está libre; éste SÓLO la mete al volumen
 *    y enseguida queda libre para la próxima. Así se integran muchas más
 *    imágenes (antes esperaba a que terminara de mallar).
 *  - "malla": vuelve a mallar los bloques que cambiaron (de a tandas, cada
 *    30 ms) y deja las mallas en una cola para que el hilo de dibujo las suba
 *    a la GPU; y cada segundo arma el mapa de zonas (Mapa: la IA del entorno
 *    y el completado) y busca los HUECOS para sellar (Sellador).
 *
 * La cámara nunca espera al escaneo: si está ocupado, esa imagen se saltea.
 */
final class Escaneo implements Runnable {
    /** Una malla lista (o null en malla = borrar ese bloque). */
    static final class Resultado {
        long clave;
        int generacion;
        Mallador.Malla malla;
    }

    volatile Tsdf tsdf;
    final Mapa mapa = new Mapa();
    /** Dónde está el jugador y hacia dónde mira (lo pone el hilo de dibujo). */
    volatile float jx, jy, jz, jfx, jfz = -1;
    volatile boolean hayJugador;
    private long ultimoMapa;
    /** Sube con cada reinicio: las mallas de un escaneo viejo se descartan. */
    volatile int generacion;
    final ConcurrentLinkedQueue<Resultado> listos = new ConcurrentLinkedQueue<>();
    private final Mallador mallador = new Mallador();
    private Thread hilo, hiloMalla;
    private volatile boolean seguir;
    /** Los huecos (lo que ve la vista de sellado) y si se sellan solos. */
    final Sellador sellador = new Sellador();
    volatile boolean sellar = true;
    /** Buscar huecos (si no, ni se buscan) y sellar una vez los que haya (lo pide el menú). */
    volatile boolean buscarHuecos = true, sellarYa;
    volatile float msMalla;

    // el lugar donde se deja la imagen
    private short[] mm = new short[0];
    private byte[] conf = new byte[0], etq = new byte[0];
    private boolean hayEtq;
    private int w, h, paso;
    private float fx, fy, cx, cy, maxM;
    private final float[] pose = new float[16];
    private boolean hayConf, lleno;
    volatile float msUltima;
    volatile int imagenes;
    volatile boolean pausado;

    Escaneo(float voxel) { tsdf = new Tsdf(voxel); }

    void arrancar() {
        if (hilo != null) return;
        seguir = true;
        hilo = new Thread(this, "escaneo");
        hilo.setPriority(Thread.NORM_PRIORITY - 1);
        hilo.start();
        hiloMalla = new Thread(this::mallar, "malla");
        hiloMalla.setPriority(Thread.NORM_PRIORITY - 1);
        hiloMalla.start();
    }

    void parar() {
        seguir = false;
        synchronized (this) { notifyAll(); }
        if (hilo != null) { try { hilo.join(500); } catch (InterruptedException ignorada) { } }
        if (hiloMalla != null) { try { hiloMalla.join(500); } catch (InterruptedException ignorada) { } }
        hilo = hiloMalla = null;
    }

    /** Empezar de cero (otro tamaño de voxel, o "reiniciar escaneo"). */
    synchronized void reiniciar(float voxel) {
        tsdf = new Tsdf(voxel);
        mapa.olvidar();
        sellador.olvidar();
        generacion++;
        listos.clear();
        lleno = false;
        imagenes = 0;
    }

    synchronized boolean libre() { return !lleno && !pausado; }

    /**
     * Deja una imagen para integrar (la copia). Si todavía está con la
     * anterior, devuelve false y no hace nada.
     */
    synchronized boolean dejar(java.nio.ShortBuffer prof, int filaProf, java.nio.ByteBuffer c, int filaConf, int ancho, int alto,
                               float fx, float fy, float cx, float cy, float[] pose, float maxM, int paso,
                               java.nio.ByteBuffer sem, int filaSem, int semW, int semH, float[] manos) {
        if (lleno || pausado) return false;
        int n = ancho * alto;
        if (mm.length != n) { mm = new short[n]; conf = new byte[n]; etq = new byte[n]; }
        // la etiqueta semántica de cada píxel de profundidad: la imagen de la red cubre el
        // mismo campo que la de profundidad, a otra resolución (el más cercano)
        hayEtq = sem != null;
        if (hayEtq) {
            for (int v = 0; v < alto; v++) {
                int vs = Math.min(semH - 1, (int) ((v + 0.5f) * semH / alto));
                for (int u = 0; u < ancho; u++) {
                    int us = Math.min(semW - 1, (int) ((u + 0.5f) * semW / ancho));
                    etq[v * ancho + u] = sem.get(vs * filaSem + us);
                }
            }
        }
        // las filas pueden venir con relleno (rowStride > ancho)
        for (int v = 0; v < alto; v++) {
            prof.position(v * filaProf);
            prof.get(mm, v * ancho, ancho);
        }
        // las manos no se escanean: donde está una mano (cajas normalizadas de la imagen de profundidad), sin profundidad
        if (manos != null) {
            for (int k = 0; k + 3 < manos.length; k += 4) {
                int u0 = Math.max(0, (int) (manos[k] * ancho)), v0 = Math.max(0, (int) (manos[k + 1] * alto));
                int u1 = Math.min(ancho, (int) Math.ceil(manos[k + 2] * ancho)), v1 = Math.min(alto, (int) Math.ceil(manos[k + 3] * alto));
                for (int v = v0; v < v1; v++) for (int u = u0; u < u1; u++) mm[v * ancho + u] = 0;
            }
        }
        hayConf = c != null;
        if (hayConf) {
            for (int v = 0; v < alto; v++) {
                c.position(v * filaConf);
                c.get(conf, v * ancho, ancho);
            }
        }
        w = ancho; h = alto;
        this.fx = fx; this.fy = fy; this.cx = cx; this.cy = cy; this.maxM = maxM; this.paso = paso;
        System.arraycopy(pose, 0, this.pose, 0, 16);
        lleno = true;
        notifyAll();
        return true;
    }

    @Override
    public void run() {
        try {
            correr();
        } catch (Throwable e) {
            // que un error del escaneo no cierre la app: se guarda y el escaneo para
            Fallo.guardar("hilo del escaneo", e);
            error = e;
        }
    }

    volatile Throwable error;

    private void correr() {
        while (seguir) {
            synchronized (this) {
                while (seguir && !lleno) { try { wait(400); } catch (InterruptedException e) { return; } }
                if (!seguir) return;
            }
            long t0 = System.nanoTime();
            Tsdf t = tsdf;
            // la imagen se lee sin candado: el hilo de dibujo no la toca mientras lleno == true
            t.integrar(mm, hayConf ? conf : null, w, h, fx, fy, cx, cy, pose, maxM, 90, paso, hayEtq ? etq : null);
            msUltima = (System.nanoTime() - t0) / 1e6f;
            imagenes++;
            synchronized (this) { lleno = false; }
        }
    }

    /** El hilo de la malla (y del mapa y los huecos). */
    private void mallar() {
        try {
            long ultimoSello = 0;
            while (seguir) {
                try { Thread.sleep(30); } catch (InterruptedException e) { return; }
                long t0 = System.nanoTime();
                Tsdf t = tsdf;
                int gen = generacion;
                long ahora = System.currentTimeMillis();
                if (hayJugador && ahora - ultimoMapa > 1000) {
                    ultimoMapa = ahora;
                    mapa.actualizar(t, jx, jy, jz, jfx, jfz);
                }
                if (hayJugador && buscarHuecos && (ahora - ultimoSello > 1000 || sellarYa)) {
                    ultimoSello = ahora;
                    boolean ya = sellarYa;
                    sellarYa = false;
                    sellador.buscar(t, jx, jy, jz, sellar || ya);
                } else if (!buscarHuecos && !sellador.huecos.isEmpty()) sellador.olvidar();
                t.propagarBordes();
                List<Tsdf.Bloque> sucios = t.tomarSucios();
                for (Tsdf.Bloque b : sucios) {
                    if (!seguir || t != tsdf) break;
                    Resultado r = new Resultado();
                    r.clave = Tsdf.clave(b.bx, b.by, b.bz);
                    r.generacion = gen;
                    r.malla = mallador.mallar(t, b);
                    listos.add(r);
                }
                if (!sucios.isEmpty()) msMalla = (System.nanoTime() - t0) / 1e6f;
            }
        } catch (Throwable e) {
            Fallo.guardar("hilo de la malla", e);
            error = e;
        }
    }
}
