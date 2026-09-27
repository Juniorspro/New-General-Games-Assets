package com.juniorspro.asaltomr;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * El hilo del escaneo. El hilo de dibujo le deja una imagen de profundidad
 * (con su pose y sus intrínsecos) cuando está libre; éste la mete al volumen,
 * vuelve a mallar los bloques que cambiaron y deja las mallas en una cola para
 * que el hilo de dibujo las suba a la GPU. Así la cámara nunca espera al
 * escaneo: si está ocupado, esa imagen se saltea.
 */
final class Escaneo implements Runnable {
    /** Una malla lista (o null en malla = borrar ese bloque). */
    static final class Resultado {
        long clave;
        int generacion;
        Mallador.Malla malla;
    }

    volatile Tsdf tsdf;
    /** Sube con cada reinicio: las mallas de un escaneo viejo se descartan. */
    volatile int generacion;
    final ConcurrentLinkedQueue<Resultado> listos = new ConcurrentLinkedQueue<>();
    private final Mallador mallador = new Mallador();
    private Thread hilo;
    private volatile boolean seguir;

    // el lugar donde se deja la imagen
    private short[] mm = new short[0];
    private byte[] conf = new byte[0];
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
    }

    void parar() {
        seguir = false;
        synchronized (this) { notifyAll(); }
        if (hilo != null) { try { hilo.join(500); } catch (InterruptedException ignorada) { } }
        hilo = null;
    }

    /** Empezar de cero (otro tamaño de voxel, o "reiniciar escaneo"). */
    synchronized void reiniciar(float voxel) {
        tsdf = new Tsdf(voxel);
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
                               float fx, float fy, float cx, float cy, float[] pose, float maxM, int paso) {
        if (lleno || pausado) return false;
        int n = ancho * alto;
        if (mm.length != n) { mm = new short[n]; conf = new byte[n]; }
        // las filas pueden venir con relleno (rowStride > ancho)
        for (int v = 0; v < alto; v++) {
            prof.position(v * filaProf);
            prof.get(mm, v * ancho, ancho);
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
        while (seguir) {
            synchronized (this) {
                while (seguir && !lleno) { try { wait(); } catch (InterruptedException e) { return; } }
                if (!seguir) return;
            }
            long t0 = System.nanoTime();
            Tsdf t = tsdf;
            int gen = generacion;
            // la imagen se lee sin candado: el hilo de dibujo no la toca mientras lleno == true
            t.integrar(mm, hayConf ? conf : null, w, h, fx, fy, cx, cy, pose, maxM, 90, paso);
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
            msUltima = (System.nanoTime() - t0) / 1e6f;
            imagenes++;
            synchronized (this) { lleno = false; }
        }
    }
}
