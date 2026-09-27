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
 * propio hilo. De cada mano salen 21 puntos; Mano los lleva al mundo (con la
 * pose de la cámara de ESA imagen y la profundidad de ARCore) y decide la
 * pose y el gesto de disparo.
 *
 * El hilo de dibujo deja una imagen cuando éste está libre (convertida de
 * YUV a RGB a la mitad de resolución: 320×240 alcanza para una mano a medio
 * metro) y lee lo último que hay. Hasta dos manos: una pistola en cada una.
 */
final class ManoRastreo implements Runnable {
    static final int W = 320, H = 240;

    final Mano[] manos = {new Mano(), new Mano()};
    /** Tiros pendientes de cada mano (los consume el hilo de dibujo). */
    final AtomicInteger[] tiros = {new AtomicInteger(), new AtomicInteger()};
    volatile String estado = "cargando el modelo de manos…";
    volatile boolean anda;
    volatile float msUltimo;
    private final long[] vista = {-1000, -1000};

    private final Context ctx;
    private HandLandmarker detector;
    private Thread hilo;
    private volatile boolean seguir;

    // la imagen que se deja (dos juegos para no pisarse)
    private final Bitmap bitmap = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
    private final int[] pixeles = new int[W * H];
    private final float[] pose = new float[16];
    private float fx, fy, cx, cy;
    private boolean girada, lleno;
    private long tiempo;
    // la profundidad de ARCore (para la distancia de la mano) y cómo se pasa de la imagen a ella
    private short[] prof = new short[0];
    private int profW, profH;
    private final float[] aProf = new float[6];   // prof = (a0 + a1·x + a2·y, a3 + a4·x + a5·y), x/y normalizados de la imagen
    private boolean hayProf;

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
     * Deja una imagen de la cámara (YUV_420_888) para buscar manos.
     * @param fx0..cy0 intrínsecos de ESA imagen (a su resolución)
     * @param girada   la pantalla está al revés (horizontal invertida): se gira la imagen 180°
     */
    synchronized boolean dejar(Image img, float fx0, float fy0, float cx0, float cy0, float[] poseCamara, boolean girada, long ms,
                               short[] profundidad, int pw, int ph, float[] imagenAProf) {
        if (!anda || lleno) return false;
        int iw = img.getWidth(), ih = img.getHeight();
        yuvARgb(img, iw, ih, girada);
        bitmap.setPixels(pixeles, 0, W, 0, 0, W, H);
        float sx = W / (float) iw, sy = H / (float) ih;
        fx = fx0 * sx; fy = fy0 * sy; cx = cx0 * sx; cy = cy0 * sy;
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

    private byte[] py = new byte[0], pu = new byte[0], pv = new byte[0];

    /** YUV_420_888 → ARGB a W×H (la cámara da 640×480: se toma un píxel de cada 2×2). Ver Mano.yuvARgb. */
    private void yuvARgb(Image img, int iw, int ih, boolean girada) {
        Image.Plane[] p = img.getPlanes();
        py = copiar(p[0].getBuffer(), py);
        pu = copiar(p[1].getBuffer(), pu);
        pv = copiar(p[2].getBuffer(), pv);
        Mano.yuvARgb(py, p[0].getRowStride(), p[0].getPixelStride(), pu, pv, p[1].getRowStride(), p[1].getPixelStride(),
                iw, ih, W, H, girada, pixeles);
    }

    private static byte[] copiar(ByteBuffer b, byte[] a) {
        b.rewind();
        int n = b.remaining();
        if (a.length < n) a = new byte[n];
        b.get(a, 0, n);
        return a;
    }

    @Override
    public void run() {
        try {
            BaseOptions base = BaseOptions.builder().setModelAssetPath("hand_landmarker.task").setDelegate(Delegate.CPU).build();
            HandLandmarker.HandLandmarkerOptions op = HandLandmarker.HandLandmarkerOptions.builder()
                    .setBaseOptions(base).setRunningMode(RunningMode.VIDEO).setNumHands(2)
                    .setMinHandDetectionConfidence(0.5f).setMinHandPresenceConfidence(0.5f).setMinTrackingConfidence(0.5f).build();
            detector = HandLandmarker.createFromOptions(ctx, op);
            anda = true;
            estado = "manos: listo";
        } catch (Throwable e) {
            Fallo.guardar("cargar el modelo de manos", e);
            estado = "manos: no disponible (" + e.getClass().getSimpleName() + ")";
            return;
        }
        float[][] img = new float[21][3], mundo = new float[21][3];
        long ultimoTs = -1;
        try {
            while (seguir) {
                synchronized (this) {
                    while (seguir && !lleno) { try { wait(); } catch (InterruptedException e) { return; } }
                    if (!seguir) break;
                }
                long t0 = System.nanoTime();
                long ts = Math.max(ultimoTs + 1, tiempo);   // VIDEO: las marcas de tiempo tienen que crecer
                ultimoTs = ts;
                MPImage mp = new BitmapImageBuilder(bitmap).build();
                HandLandmarkerResult r = detector.detectForVideo(mp, ts);
                List<List<NormalizedLandmark>> lms = r.landmarks();
                List<List<Landmark>> wls = r.worldLandmarks();
                boolean[] usada = new boolean[2];
                for (int h = 0; h < lms.size() && h < 2; h++) {
                    List<NormalizedLandmark> l = lms.get(h);
                    List<Landmark> wl = wls.get(h);
                    for (int i = 0; i < 21; i++) {
                        img[i][0] = l.get(i).x(); img[i][1] = l.get(i).y(); img[i][2] = l.get(i).z();
                        mundo[i][0] = wl.get(i).x(); mundo[i][1] = wl.get(i).y(); mundo[i][2] = wl.get(i).z();
                    }
                    if (girada) Mano.desgirar(img, mundo);   // volver a la orientación de la cámara
                    // a qué mano de antes corresponde (la más cercana en la imagen)
                    int slot = elegirSlot(img, usada);
                    usada[slot] = true;
                    Mano m = manos[slot];
                    float d = profundidadEn(img[9][0], img[9][1]);
                    synchronized (m) {
                        m.aMundo(img, mundo, W, H, fx, fy, cx, cy, d, pose);
                        if (m.gesto(mundo, ts)) tiros[slot].incrementAndGet();
                        m.pistolaFiltrada(ts);
                        vista[slot] = ts;
                        m.u = img[0][0]; m.v = img[0][1];
                    }
                }
                // si el modelo la pierde un instante (movida, contraluz), la pistola se queda 250 ms donde estaba
                for (int s = 0; s < 2; s++) if (!usada[s] && ts - vista[s] > 250) synchronized (manos[s]) { manos[s].perdida(); }
                msUltimo = (System.nanoTime() - t0) / 1e6f;
                synchronized (this) { lleno = false; }
            }
        } catch (Throwable e) {
            Fallo.guardar("hilo de las manos", e);
            estado = "manos: error (" + e.getClass().getSimpleName() + ")";
            anda = false;
        } finally {
            try { if (detector != null) detector.close(); } catch (Throwable ignorada) { }
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

    /** La profundidad de ARCore (m) en un punto de la imagen (normalizado), o NaN. */
    private float profundidadEn(float x, float y) {
        if (!hayProf || profW == 0) return Float.NaN;
        float u = aProf[0] + aProf[1] * x + aProf[2] * y, v = aProf[3] + aProf[4] * x + aProf[5] * y;
        int pu = (int) (u * profW), pv = (int) (v * profH);
        if (pu < 0 || pv < 0 || pu >= profW || pv >= profH) return Float.NaN;
        // la mediana de un 3×3 (la profundidad en los bordes de un dedo salta)
        float[] vs = new float[9];
        int n = 0;
        for (int dv = -1; dv <= 1; dv++) for (int du = -1; du <= 1; du++) {
            int qu = pu + du, qv = pv + dv;
            if (qu < 0 || qv < 0 || qu >= profW || qv >= profH) continue;
            int mm = prof[qv * profW + qu] & 0xFFFF;
            if (mm > 0) vs[n++] = mm * 0.001f;
        }
        if (n < 3) return Float.NaN;
        java.util.Arrays.sort(vs, 0, n);
        return vs[n / 2];
    }
}
