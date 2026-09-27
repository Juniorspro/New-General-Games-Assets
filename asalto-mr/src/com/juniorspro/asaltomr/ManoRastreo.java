package com.juniorspro.asaltomr;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.Image;

import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.components.containers.Landmark;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.core.Delegate;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * El hand tracking: la imagen de la cámara (la misma que usa ARCore) pasa por
 * el modelo de manos de MediaPipe (hand_landmarker.task, en el APK) en su
 * propio hilo. Como lo hace Aeroplaza (que se ve "súper fijo"):
 *
 *  - la imagen ENTERA (640×480, la que da ARCore), no achicada: la mano
 *    tiene el doble de píxeles y los puntos tiemblan la mitad;
 *  - la GPU (si no anda, la CPU);
 *  - una red para UNA mano (más rápida) mientras se ve una sola, y cada
 *    1.2 s una pasada con la de DOS por si apareció la otra;
 *  - GANANCIA: se mide el brillo de la mano (en su caja) y se aclara la
 *    imagen hasta ×6 (a contraluz o en la sombra la mano se pierde);
 *  - el hilo de dibujo sólo copia los planos YUV (rápido); la conversión a
 *    color se hace acá;
 *  - de cada imagen salen los puntos sobre sus rayos y FiltroMano (palma
 *    rígida, forma aprendida, anclas); la profundidad de ARCore sólo
 *    calibra, despacio, el tamaño de la mano.
 *
 * Hasta dos manos: un arma en cada una.
 */
final class ManoRastreo implements Runnable {
    /** Opciones de la red (las de Aeroplaza). */
    static final float DETECCION = 0.5f, PRESENCIA = 0.4f, SEGUIMIENTO = 0.4f;
    static final long BUSCA_CADA = 1200, CON_DOS = 500, RECIEN = 400;

    final Mano[] manos = {new Mano(), new Mano()};
    /** Tiros pendientes de cada mano (los consume el hilo de dibujo). */
    final AtomicInteger[] tiros = {new AtomicInteger(), new AtomicInteger()};
    volatile String estado = "cargando el modelo de manos…";
    volatile boolean anda;
    volatile float msUltimo;
    /** "GPU" o "CPU", y la ganancia actual (para el HUD). */
    volatile String delegado = "";
    volatile float ganancia = 1;
    private final long[] vista = {-1000, -1000};

    private final Context ctx;
    private HandLandmarker red2, red1;
    private Thread hilo;
    private volatile boolean seguir;

    // la imagen que se deja (planos YUV copiados) y lo que va con ella
    private byte[] py = new byte[0], pu = new byte[0], pv = new byte[0];
    private int iw, ih, yFila, yPaso, uvFila, uvPaso;
    private Bitmap bitmap;
    private int[] pixeles = new int[0];
    private final float[] pose = new float[16];
    private float fx, fy, cx, cy;
    private boolean girada, lleno;
    private long tiempo;
    // la profundidad de ARCore (para calibrar el tamaño de la mano) y cómo se pasa de la imagen a ella
    private short[] prof = new short[0];
    private int profW, profH;
    private final float[] aProf = new float[6];   // prof = (a0 + a1·x + a2·y, a3 + a4·x + a5·y), x/y normalizados de la imagen
    private boolean hayProf;
    // cuántas manos se ven y desde cuándo (para elegir la red)
    private int vistas;
    private long vioDos = -100000, desdeUna = -100000, buscoDos = -100000;
    private float[] caja;

    ManoRastreo(Context c) { ctx = c.getApplicationContext(); }

    void arrancar() {
        if (hilo != null) return;
        seguir = true;
        hilo = new Thread(this, "manos");
        hilo.start();
    }

    void parar() {
        seguir = false;
        synchronized (this) { notifyAll(); }
        if (hilo != null) { try { hilo.join(800); } catch (InterruptedException ignorada) { } }
        hilo = null;
    }

    synchronized boolean libre() { return anda && !lleno; }

    /**
     * Deja una imagen de la cámara (YUV_420_888) para buscar manos: sólo copia
     * los planos (la conversión se hace en el hilo de las manos).
     * @param fx0..cy0 intrínsecos de ESA imagen (a su resolución)
     * @param girada   la pantalla está al revés (horizontal invertida): se gira la imagen 180°
     */
    synchronized boolean dejar(Image img, float fx0, float fy0, float cx0, float cy0, float[] poseCamara, boolean girada, long ms,
                               short[] profundidad, int pw, int ph, float[] imagenAProf) {
        if (!anda || lleno) return false;
        Image.Plane[] p = img.getPlanes();
        py = copiar(p[0].getBuffer(), py);
        pu = copiar(p[1].getBuffer(), pu);
        pv = copiar(p[2].getBuffer(), pv);
        yFila = p[0].getRowStride(); yPaso = p[0].getPixelStride();
        uvFila = p[1].getRowStride(); uvPaso = p[1].getPixelStride();
        iw = img.getWidth(); ih = img.getHeight();
        fx = fx0; fy = fy0; cx = cx0; cy = cy0;
        System.arraycopy(poseCamara, 0, pose, 0, 16);
        this.girada = girada;
        tiempo = ms;
        hayProf = profundidad != null;
        if (hayProf) {
            if (prof.length != profundidad.length) prof = new short[profundidad.length];
            System.arraycopy(profundidad, 0, prof, 0, profundidad.length);
            profW = pw; profH = ph;
            System.arraycopy(imagenAProf, 0, aProf, 0, 6);
        }
        lleno = true;
        notifyAll();
        return true;
    }

    private static byte[] copiar(ByteBuffer b, byte[] a) {
        b.rewind();
        int n = b.remaining();
        if (a.length < n) a = new byte[n];
        b.get(a, 0, n);
        return a;
    }

    private HandLandmarker crear(Delegate d, int n) {
        BaseOptions base = BaseOptions.builder().setModelAssetPath("hand_landmarker.task").setDelegate(d).build();
        HandLandmarker.HandLandmarkerOptions op = HandLandmarker.HandLandmarkerOptions.builder()
                .setBaseOptions(base).setRunningMode(RunningMode.VIDEO).setNumHands(n)
                .setMinHandDetectionConfidence(DETECCION).setMinHandPresenceConfidence(PRESENCIA).setMinTrackingConfidence(SEGUIMIENTO).build();
        return HandLandmarker.createFromOptions(ctx, op);
    }

    /** Las dos redes, en la GPU si se puede. */
    private void crearRedes(boolean gpu) {
        cerrarRedes();
        Delegate d = gpu ? Delegate.GPU : Delegate.CPU;
        red2 = crear(d, 2);
        try { red1 = crear(d, 1); } catch (Throwable e) { red1 = null; }   // sin la de una mano, se usa siempre la de dos
        delegado = gpu ? "GPU" : "CPU";
    }

    private void cerrarRedes() {
        try { if (red2 != null) red2.close(); } catch (Throwable ignorada) { }
        try { if (red1 != null) red1.close(); } catch (Throwable ignorada) { }
        red2 = red1 = null;
    }

    /** ¿La de una mano alcanza? (se ve una sola, hace rato que no hay dos, y no toca buscar la segunda) */
    private int cupo(long ahora) {
        if (red1 != null && vistas == 1 && ahora - vioDos >= CON_DOS && ahora - desdeUna >= RECIEN && ahora - buscoDos <= BUSCA_CADA) return 1;
        return 2;
    }

    @Override
    public void run() {
        boolean gpu = true;
        try {
            try { crearRedes(true); } catch (Throwable e) { gpu = false; crearRedes(false); }
            anda = true;
            estado = "manos: listo (" + delegado + ")";
        } catch (Throwable e) {
            Fallo.guardar("cargar el modelo de manos", e);
            estado = "manos: no disponible (" + e.getClass().getSimpleName() + ")";
            return;
        }
        float[][] img = new float[21][3], mundo = new float[21][3];
        float[] prof3 = new float[3];
        long ultimoTs = -1;
        float g = 1;
        try {
            while (seguir) {
                synchronized (this) {
                    while (seguir && !lleno) { try { wait(); } catch (InterruptedException e) { return; } }
                    if (!seguir) break;
                }
                long t0 = System.nanoTime();
                // YUV → color, a resolución completa, con la ganancia (y el brillo de la mano para la próxima)
                if (bitmap == null || bitmap.getWidth() != iw || bitmap.getHeight() != ih) {
                    bitmap = Bitmap.createBitmap(iw, ih, Bitmap.Config.ARGB_8888);
                    pixeles = new int[iw * ih];
                }
                float media = Mano.yuvARgbConGanancia(py, yFila, yPaso, pu, pv, uvFila, uvPaso, iw, ih, girada, Math.round(g * 256), caja, pixeles);
                g = Mano.siguienteGanancia(g, media);
                ganancia = g;
                bitmap.setPixels(pixeles, 0, iw, 0, 0, iw, ih);
                long ts = Math.max(ultimoTs + 1, tiempo);   // VIDEO: las marcas de tiempo tienen que crecer
                ultimoTs = ts;
                int n = cupo(ts);
                if (n == 2) buscoDos = ts;
                MPImage mp = new BitmapImageBuilder(bitmap).build();
                HandLandmarkerResult r;
                try {
                    r = (n == 1 ? red1 : red2).detectForVideo(mp, ts);
                } catch (Throwable e) {
                    if (!gpu) throw e;
                    // la GPU no anduvo en este teléfono: a la CPU
                    gpu = false;
                    crearRedes(false);
                    estado = "manos: listo (CPU)";
                    synchronized (this) { lleno = false; }
                    continue;
                }
                List<List<NormalizedLandmark>> lms = r.landmarks();
                List<List<Landmark>> wls = r.worldLandmarks();
                int vistasAhora = Math.min(2, lms.size());
                if (vistasAhora >= 2) vioDos = ts;
                if (vistasAhora >= 1 && vistas == 0) desdeUna = ts;
                vistas = vistasAhora;
                boolean[] usada = new boolean[2];
                float[] nuevaCaja = null;
                for (int h = 0; h < lms.size() && h < 2; h++) {
                    List<NormalizedLandmark> l = lms.get(h);
                    List<Landmark> wl = wls.get(h);
                    for (int i = 0; i < 21; i++) {
                        img[i][0] = l.get(i).x(); img[i][1] = l.get(i).y(); img[i][2] = l.get(i).z();
                        mundo[i][0] = wl.get(i).x(); mundo[i][1] = wl.get(i).y(); mundo[i][2] = wl.get(i).z();
                    }
                    if (girada) Mano.desgirar(img, mundo);   // volver a la orientación de la cámara
                    float[] cj = Mano.cajaDe(img);
                    nuevaCaja = nuevaCaja == null ? cj : new float[]{Math.min(cj[0], nuevaCaja[0]), Math.min(cj[1], nuevaCaja[1]),
                            Math.max(cj[2], nuevaCaja[2]), Math.max(cj[3], nuevaCaja[3])};
                    // a qué mano de antes corresponde (la más cercana en la imagen)
                    int slot = elegirSlot(img, usada);
                    usada[slot] = true;
                    Mano m = manos[slot];
                    prof3[0] = profundidadEn(img[0][0], img[0][1]);
                    prof3[1] = profundidadEn(img[5][0], img[5][1]);
                    prof3[2] = profundidadEn(img[17][0], img[17][1]);
                    synchronized (m) {
                        if (m.aMundo2(img, mundo, iw, ih, fx, fy, cx, cy, prof3, pose, ts)) {
                            if (m.gesto2(ts)) tiros[slot].incrementAndGet();
                        }
                        vista[slot] = ts;
                        m.u = img[0][0]; m.v = img[0][1];
                    }
                }
                caja = nuevaCaja;
                // si el modelo la pierde un instante (movida, contraluz), el arma se queda 250 ms donde estaba
                for (int s = 0; s < 2; s++) if (!usada[s] && ts - vista[s] > 250) synchronized (manos[s]) { manos[s].perdida(); }
                msUltimo = (System.nanoTime() - t0) / 1e6f;
                synchronized (this) { lleno = false; }
            }
        } catch (Throwable e) {
            Fallo.guardar("hilo de las manos", e);
            estado = "manos: error (" + e.getClass().getSimpleName() + ")";
            anda = false;
        } finally {
            cerrarRedes();
        }
    }

    private int elegirSlot(float[][] img, boolean[] usada) {
        int mejor = usada[0] ? 1 : 0;
        float mejorD = Float.MAX_VALUE;
        for (int s = 0; s < 2; s++) {
            if (usada[s]) continue;
            Mano m = manos[s];
            float d = m.hay ? (float) Math.hypot(m.u - img[0][0], m.v - img[0][1]) : 10f + s;
            if (d < mejorD) { mejorD = d; mejor = s; }
        }
        return mejor;
    }

    /**
     * La profundidad de ARCore (m) en un punto de la imagen (normalizado), o
     * NaN. El cuartil de lo más cercano en 5×5: en el borde de la mano la
     * profundidad se mezcla con el fondo (que siempre está más lejos).
     */
    private float profundidadEn(float x, float y) {
        if (!hayProf || profW == 0) return Float.NaN;
        float u = aProf[0] + aProf[1] * x + aProf[2] * y, v = aProf[3] + aProf[4] * x + aProf[5] * y;
        int pu = (int) (u * profW), pv = (int) (v * profH);
        if (pu < 0 || pv < 0 || pu >= profW || pv >= profH) return Float.NaN;
        float[] vs = new float[25];
        int n = 0;
        for (int dv = -2; dv <= 2; dv++) for (int du = -2; du <= 2; du++) {
            int qu = pu + du, qv = pv + dv;
            if (qu < 0 || qv < 0 || qu >= profW || qv >= profH) continue;
            int mm = prof[qv * profW + qu] & 0xFFFF;
            if (mm > 0) vs[n++] = mm * 0.001f;
        }
        if (n < 5) return Float.NaN;
        java.util.Arrays.sort(vs, 0, n);
        return vs[n / 4];
    }
}
