package ar.aeroplaza;

import android.graphics.Bitmap;
import android.media.Image;
import android.os.SystemClock;

import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.components.containers.Category;
import com.google.mediapipe.tasks.components.containers.Landmark;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.core.Delegate;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/* LAS MANOS NATIVAS: MediaPipe de Android (el mismo modelo que la web, en la GPU del celu si se puede)
   sobre las fotos de ARCore. Con ARCore la cámara es suya: la web no la puede abrir.
   - La foto (YUV) se copia enseguida (ARCore la necesita de vuelta) y se pasa a RGB en otro hilo,
     girada para que quede derecha en la pantalla y con LA LUZ de la web (js/manos-camara.js › LUZ_JS):
     si la mano está oscura, se aclara hasta 0,42, hasta ×6. Se mide con lo de la foto anterior.
   - Lo que sale va a window.__nativo.manos como en la web: los 21 puntos en la imagen (0-1) y en
     metros, qué mano es, y el campo de la cámara (de su calibración, no supuesto) */
class ManosNativas {
  final MainActivity act;
  final ExecutorService hilo = Executors.newSingleThreadExecutor();
  HandLandmarker red;
  String delegado = "?";
  volatile boolean ocupado;
  byte[] y, u, v;
  int[] px;
  Bitmap bm;
  float g = 1, media = -1;
  float[] caja;            // el recuadro de la última mano (0-1, en la foto derecha)
  long ultimoTs = -1;

  ManosNativas(MainActivity a) {
    act = a;
    hilo.execute(() -> {
      for (Delegate d : new Delegate[] { Delegate.GPU, Delegate.CPU }) {
        try {
          HandLandmarker.HandLandmarkerOptions o = HandLandmarker.HandLandmarkerOptions.builder()
              .setBaseOptions(BaseOptions.builder().setModelAssetPath("mediapipe/hand_landmarker.task").setDelegate(d).build())
              .setRunningMode(RunningMode.VIDEO).setNumHands(2)
              .setMinHandDetectionConfidence(0.5f).setMinHandPresenceConfidence(0.4f).setMinTrackingConfidence(0.4f).build();
          red = HandLandmarker.createFromOptions(act, o);
          delegado = d == Delegate.GPU ? "GPU" : "CPU";
          act.enviar("__nativo&&__nativo.estado('manos " + delegado + "')");
          return;
        } catch (Throwable t) { /* la otra */ }
      }
      act.enviar("__nativo&&__nativo.estado('manos error')");
    });
  }

  boolean libre() { return red != null && !ocupado; }

  static byte[] copiar(ByteBuffer b, byte[] a) {
    b.rewind(); int n = b.remaining();
    if (a == null || a.length < n) a = new byte[n];
    b.get(a, 0, n); return a;
  }

  /* en el hilo de ARCore: copiar y soltar la foto; lo demás, en el de las manos */
  void procesar(Image im, long ts, double edad, float[] focal, int[] dims, int giro) {
    Image.Plane[] P = im.getPlanes();
    final int W = im.getWidth(), H = im.getHeight();
    final int rsY = P[0].getRowStride(), rsU = P[1].getRowStride(), psU = P[1].getPixelStride(), rsV = P[2].getRowStride(), psV = P[2].getPixelStride();
    y = copiar(P[0].getBuffer(), y); u = copiar(P[1].getBuffer(), u); v = copiar(P[2].getBuffer(), v);
    ocupado = true;
    final long t0 = SystemClock.elapsedRealtime();
    hilo.execute(() -> {
      try {
        boolean gira = giro == 90 || giro == 270;
        int Wo = gira ? H : W, Ho = gira ? W : H;
        if (px == null || px.length != Wo * Ho) { px = new int[Wo * Ho]; bm = Bitmap.createBitmap(Wo, Ho, Bitmap.Config.ARGB_8888); }
        convertir(W, H, Wo, Ho, rsY, rsU, psU, rsV, psV, giro);
        bm.setPixels(px, 0, Wo, 0, 0, Wo, Ho);
        MPImage mp = new BitmapImageBuilder(bm).build();
        long tms = ts / 1000000L; if (tms <= ultimoTs) tms = ultimoTs + 1; ultimoTs = tms;
        HandLandmarkerResult r = red.detectForVideo(mp, tms);
        float fx = gira ? focal[1] : focal[0], fy = gira ? focal[0] : focal[1];
        double tanX = (Wo / 2.0) / fx, tanY = (Ho / 2.0) / fy;
        long ms = SystemClock.elapsedRealtime() - t0;
        act.enviar("__nativo&&__nativo.manos(" + json(r, edad + ms, tanX, tanY, ms, Wo, Ho) + ")");
      } catch (Throwable t) {
        act.enviar("__nativo&&__nativo.estado('manos: " + t.getClass().getSimpleName() + "')");
      } finally { ocupado = false; }
    });
  }

  /* YUV → RGB, girada, con la ganancia; y de paso, la luz del recuadro de la mano (para la próxima) */
  void convertir(int W, int H, int Wo, int Ho, int rsY, int rsU, int psU, int rsV, int psV, int giro) {
    final int k = Math.round(g * 256);
    float[] c = caja;
    int bx0 = c == null ? 0 : (int) (c[0] * Wo), by0 = c == null ? 0 : (int) (c[1] * Ho), bx1 = c == null ? Wo : (int) Math.ceil(c[2] * Wo), by1 = c == null ? Ho : (int) Math.ceil(c[3] * Ho);
    long suma = 0; int n = 0;
    for (int oy = 0; oy < Ho; oy++) {
      boolean filaCaja = oy >= by0 && oy < by1 && (oy & 3) == 0;
      for (int ox = 0; ox < Wo; ox++) {
        int sx, sy;
        if (giro == 90) { sx = oy; sy = H - 1 - ox; } else if (giro == 180) { sx = W - 1 - ox; sy = H - 1 - oy; } else if (giro == 270) { sx = W - 1 - oy; sy = ox; } else { sx = ox; sy = oy; }
        int Y = y[sy * rsY + sx] & 0xff, iu = (sy >> 1) * rsU + (sx >> 1) * psU, iv = (sy >> 1) * rsV + (sx >> 1) * psV;
        int U = (u[iu] & 0xff) - 128, V = (v[iv] & 0xff) - 128;
        if (filaCaja && (ox & 3) == 0 && ox >= bx0 && ox < bx1) { suma += Y; n++; }
        int yy = (Y * k) >> 8, uu = (U * k) >> 8, vv = (V * k) >> 8;
        int R = yy + ((359 * vv) >> 8), G = yy - ((88 * uu + 183 * vv) >> 8), B = yy + ((454 * uu) >> 8);
        R = R < 0 ? 0 : R > 255 ? 255 : R; G = G < 0 ? 0 : G > 255 ? 255 : G; B = B < 0 ? 0 : B > 255 ? 255 : B;
        px[oy * Wo + ox] = 0xff000000 | (R << 16) | (G << 8) | B;
      }
    }
    if (n > 0) {
      media = suma / (float) n / 255f;
      float o = Math.max(1f, Math.min(6f, 0.42f / Math.max(0.01f, media)));
      g += (o - g) * 0.3f; if (Math.abs(g - 1) < 0.08f) g = 1;
    }
  }

  String json(HandLandmarkerResult r, double edad, double tanX, double tanY, long ms, int W, int H) {
    StringBuilder s = new StringBuilder(4096);
    s.append(String.format(Locale.US, "{\"e\":%.1f,\"tx\":%.5f,\"ty\":%.5f,\"ms\":%d,\"w\":%d,\"h\":%d,\"g\":%.2f,\"luz\":%.3f,\"d\":\"%s\",\"m\":[", edad, tanX, tanY, ms, W, H, g, media, delegado));
    List<List<NormalizedLandmark>> L = r.landmarks();
    float x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (int h = 0; h < L.size(); h++) {
      if (h > 0) s.append(',');
      List<Category> cat = r.handedness().get(h);
      Category c = cat.isEmpty() ? null : cat.get(0);
      s.append("{\"d\":").append(c == null ? -1 : "Right".equals(c.categoryName()) ? 1 : 0).append(",\"c\":").append(String.format(Locale.US, "%.3f", c == null ? 0 : c.score())).append(",\"i\":[");
      List<NormalizedLandmark> I = L.get(h);
      for (int i = 0; i < I.size(); i++) {
        NormalizedLandmark p = I.get(i);
        if (i > 0) s.append(',');
        s.append(String.format(Locale.US, "%.5f,%.5f,%.5f", p.x(), p.y(), p.z()));
        if (h == 0) { x0 = Math.min(x0, p.x()); y0 = Math.min(y0, p.y()); x1 = Math.max(x1, p.x()); y1 = Math.max(y1, p.y()); }
      }
      s.append("],\"w\":[");
      List<Landmark> M = r.worldLandmarks().get(h);
      for (int i = 0; i < M.size(); i++) {
        Landmark p = M.get(i);
        if (i > 0) s.append(',');
        s.append(String.format(Locale.US, "%.5f,%.5f,%.5f", p.x(), p.y(), p.z()));
      }
      s.append("]}");
    }
    s.append("]}");
    /* (el recuadro de la primera mano, un 10 % más grande, para medir su luz en la próxima foto) */
    if (!L.isEmpty()) { float px_ = (x1 - x0) * 0.1f, py_ = (y1 - y0) * 0.1f; caja = new float[] { Math.max(0, x0 - px_), Math.max(0, y0 - py_), Math.min(1, x1 + px_), Math.min(1, y1 + py_) }; }
    else caja = null;
    return s.toString();
  }

  void cerrar() { hilo.execute(() -> { if (red != null) red.close(); red = null; }); hilo.shutdown(); }
}
