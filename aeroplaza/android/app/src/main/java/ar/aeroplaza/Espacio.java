package ar.aeroplaza;

import android.graphics.Bitmap;
import android.media.Image;
import android.os.SystemClock;

import com.google.ar.core.Camera;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.PointCloud;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/* TU ESPACIO (como el "Space Setup" de un Quest): lo que ARCore ve del cuarto, para que el juego lo
   dibuje encima de la cámara y deje ventanas en su lugar.
   - LOS PLANOS: piso, mesas, techo (horizontales) y paredes (verticales), cada 400 ms, con su pose y
     su contorno (js/espacio.js los pinta y los clasifica).
   - LO DEMÁS (muebles, objetos): la profundidad de ARCore (Depth API, la "cruda" con su confianza),
     cada ~150 ms, pasada al mundo y juntada en cubitos de VOX (5 cm). Un cubito cuenta cuando lo vieron
     FIRME veces (el ruido de una sola foto no arma nada). Si el celu no tiene profundidad, los puntos
     sueltos que sigue ARCore (la nube de puntos), que son menos.
   - LA CÁMARA para ver a través (passthrough): la foto de la CPU a la mitad (320 × 240), derecha para la
     pantalla y en JPEG; el juego la pide por https (MainActivity › /camara/) con la pose de ESA foto, y
     la pone en el mundo donde se sacó: al girar la cabeza entre foto y foto, la imagen queda en su lugar. */
class Espacio {
  final MainActivity act;
  volatile boolean escanea, pasante, olvidarPedido;
  boolean conProfundidad;
  static final float VOX = 0.05f;
  static final int FIRME = 3, TOPE = 90000, POR_MENSAJE = 4000;
  /* (cada cubito: cuántas veces se vio; los nuevos firmes esperan a salir en el próximo mensaje) */
  final HashMap<Long, Integer> vistos = new HashMap<>();
  int[] nuevos = new int[3 * 1024]; int nNuevos = 0, firmes = 0;
  long tPlanos, tProf, tVox;

  /* la foto para ver a través */
  final ExecutorService hilo = Executors.newSingleThreadExecutor();
  volatile boolean ocupadoFoto;
  volatile byte[] jpeg;
  volatile int nFoto;
  long tFoto;
  byte[] y, u, v;
  int[] px;
  Bitmap bm;
  final ByteArrayOutputStream salida = new ByteArrayOutputStream(64 * 1024);
  static final long FOTO_CADA = 33;   // ms (hasta 30 por segundo)

  Espacio(MainActivity a) { act = a; }

  /* el pedido del juego (en el hilo de GL, antes de sesion.update: configurar la sesión desde otro hilo
     mientras corre no es seguro) */
  void configurar(Session s, boolean si) {
    try {
      com.google.ar.core.Config c = s.getConfig();
      c.setPlaneFindingMode(si ? com.google.ar.core.Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL : com.google.ar.core.Config.PlaneFindingMode.DISABLED);
      conProfundidad = si && s.isDepthModeSupported(com.google.ar.core.Config.DepthMode.AUTOMATIC);
      c.setDepthMode(conProfundidad ? com.google.ar.core.Config.DepthMode.AUTOMATIC : com.google.ar.core.Config.DepthMode.DISABLED);
      s.configure(c);
      escanea = si;
      act.enviar("__nativo&&__nativo.estado('espacio " + (si ? (conProfundidad ? "profundidad" : "puntos") : "apagado") + "')");
    } catch (Throwable t) {
      escanea = false;
      act.enviar("__nativo&&__nativo.estado('espacio error: " + t.getClass().getSimpleName() + "')");
    }
  }

  /* se empieza de cero (escanear de nuevo): lo pide el juego desde otro hilo; se hace en el de GL */
  void olvidar() { olvidarPedido = true; }

  /* cada cuadro de ARCore (hilo de GL) */
  void cuadro(Session s, Frame fr, Camera cam) {
    if (olvidarPedido) { olvidarPedido = false; vistos.clear(); nNuevos = 0; firmes = 0; act.enviar("__nativo&&__nativo.olvidado()"); }
    if (!escanea || cam.getTrackingState() != TrackingState.TRACKING) return;
    long ahora = SystemClock.elapsedRealtime();
    if (ahora - tPlanos > 400) { tPlanos = ahora; planos(s); }
    if (ahora - tProf > 150) { tProf = ahora; if (conProfundidad) profundidad(fr, cam); else nube(fr); }
    if (nNuevos > 0 && ahora - tVox > 250) { tVox = ahora; mandarVoxeles(); }
  }

  void planos(Session s) {
    StringBuilder b = new StringBuilder(4096); b.append('[');
    boolean primero = true;
    for (Plane p : s.getAllTrackables(Plane.class)) {
      if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
      Pose c = p.getCenterPose(); FloatBuffer pol = p.getPolygon();
      int tipo = p.getType() == Plane.Type.HORIZONTAL_UPWARD_FACING ? 0 : p.getType() == Plane.Type.HORIZONTAL_DOWNWARD_FACING ? 1 : 2;
      if (!primero) b.append(','); primero = false;
      b.append(String.format(Locale.US, "{\"i\":%d,\"t\":%d,\"p\":[%.4f,%.4f,%.4f,%.5f,%.5f,%.5f,%.5f],\"x\":%.3f,\"z\":%.3f,\"v\":[",
          p.hashCode(), tipo, c.tx(), c.ty(), c.tz(), c.qx(), c.qy(), c.qz(), c.qw(), p.getExtentX(), p.getExtentZ()));
      pol.rewind(); int n = pol.remaining();
      /* (el contorno, a lo sumo 48 vértices: más no se nota y el mensaje crece) */
      int paso = Math.max(1, (n / 2 + 47) / 48);
      for (int i = 0, k = 0; i + 1 < n; i += 2 * paso, k++) { if (k > 0) b.append(','); b.append(String.format(Locale.US, "%.3f,%.3f", pol.get(i), pol.get(i + 1))); }
      b.append("]}");
    }
    b.append(']');
    act.enviar("__nativo&&__nativo.planos(" + b + ")");
  }

  /* un punto del mundo a su cubito */
  void sumar(float x, float y, float z) {
    if (firmes >= TOPE) return;
    int ix = (int) Math.floor(x / VOX), iy = (int) Math.floor(y / VOX), iz = (int) Math.floor(z / VOX);
    long k = ((long) (ix & 0x1FFFFF) << 42) | ((long) (iy & 0x1FFFFF) << 21) | (long) (iz & 0x1FFFFF);
    Integer c = vistos.get(k); int n = c == null ? 1 : c + 1;
    if (n > FIRME + 1) return;   // (ya salió: no hace falta seguir contando)
    vistos.put(k, n);
    if (n == FIRME) {
      if (nNuevos + 3 > nuevos.length) { int[] m = new int[nuevos.length * 2]; System.arraycopy(nuevos, 0, m, 0, nNuevos); nuevos = m; }
      nuevos[nNuevos++] = ix; nuevos[nNuevos++] = iy; nuevos[nNuevos++] = iz; firmes++;
    }
  }

  /* la profundidad cruda (en mm, 16 bits) con su confianza (0-255), de los píxeles de la foto al mundo:
     como la guía de ARCore (el codelab de la profundidad cruda): con los datos de la TEXTURA (la foto
     que cubre la profundidad), x = z·(u − cx)/fx, y = z·(cy − v)/fy, −z adelante, y la pose del sensor */
  void profundidad(Frame fr, Camera cam) {
    Image d = null, c = null;
    try {
      d = fr.acquireRawDepthImage16Bits(); c = fr.acquireRawDepthConfidenceImage();
      int W = d.getWidth(), H = d.getHeight();
      Image.Plane pd = d.getPlanes()[0], pc = c.getPlanes()[0];
      ByteBuffer bd = pd.getBuffer().order(ByteOrder.LITTLE_ENDIAN), bc = pc.getBuffer();
      int rd = pd.getRowStride(), sd = pd.getPixelStride(), rc = pc.getRowStride(), sc = pc.getPixelStride();
      CameraIntrinsics ci = cam.getTextureIntrinsics();
      float[] f = ci.getFocalLength(), pp = ci.getPrincipalPoint(); int[] dim = ci.getImageDimensions();
      float fx = f[0] * W / dim[0], fy = f[1] * H / dim[1], cx = pp[0] * W / dim[0], cy = pp[1] * H / dim[1];
      float[] m = new float[16]; cam.getPose().toMatrix(m, 0);
      /* (uno de cada 3 × 3: con 160 × 120 son ~2.100 puntos por foto) */
      for (int v = 1; v < H; v += 3) for (int u = 1; u < W; u += 3) {
        int mm = bd.getShort(v * rd + u * sd) & 0xFFFF;
        if (mm < 150 || mm > 4500) continue;
        if ((bc.get(v * rc + u * sc) & 0xFF) < 150) continue;
        float z = mm / 1000f, x = z * (u - cx) / fx, yy = z * (cy - v) / fy, zc = -z;
        sumar(m[0] * x + m[4] * yy + m[8] * zc + m[12], m[1] * x + m[5] * yy + m[9] * zc + m[13], m[2] * x + m[6] * yy + m[10] * zc + m[14]);
      }
    } catch (Throwable t) { /* todavía no hay (las primeras fotos) */ }
    finally { if (d != null) d.close(); if (c != null) c.close(); }
  }

  /* sin profundidad: los puntos que ARCore sigue (ya en el mundo), con su confianza */
  void nube(Frame fr) {
    try (PointCloud pc = fr.acquirePointCloud()) {
      FloatBuffer p = pc.getPoints(); p.rewind();
      while (p.remaining() >= 4) { float x = p.get(), y = p.get(), z = p.get(), k = p.get(); if (k > 0.35f) { sumar(x, y, z); sumar(x, y, z); } }
    } catch (Throwable t) { /* nada */ }
  }

  void mandarVoxeles() {
    int n = Math.min(nNuevos, POR_MENSAJE * 3);
    StringBuilder b = new StringBuilder(n * 5 + 32); b.append("__nativo&&__nativo.voxeles([");
    for (int i = 0; i < n; i++) { if (i > 0) b.append(','); b.append(nuevos[i]); }
    b.append("],").append(String.format(Locale.US, "%.3f", VOX)).append(')');
    System.arraycopy(nuevos, n, nuevos, 0, nNuevos - n); nNuevos -= n;
    act.enviar(b.toString());
  }

  /* ------------------------------------------ la foto para ver a través */
  boolean quiereFoto() { return pasante && !ocupadoFoto && SystemClock.elapsedRealtime() - tFoto >= FOTO_CADA; }

  static byte[] copiar(ByteBuffer b, byte[] a) {
    b.rewind(); int n = b.remaining();
    if (a == null || a.length < n) a = new byte[n];
    b.get(a, 0, n); return a;
  }

  /* en el hilo de ARCore: copiar y soltar; pasar a RGB a la mitad, girar y comprimir, en el otro.
     pose: la de la cámara orientada a la pantalla en ESA foto; edad: hace cuánto se sacó (ms) */
  void foto(Image im, Pose pose, double edad, float[] focal, int giro) {
    tFoto = SystemClock.elapsedRealtime();
    Image.Plane[] P = im.getPlanes();
    final int W = im.getWidth(), H = im.getHeight();
    final int rsY = P[0].getRowStride(), rsU = P[1].getRowStride(), psU = P[1].getPixelStride(), rsV = P[2].getRowStride(), psV = P[2].getPixelStride();
    y = copiar(P[0].getBuffer(), y); u = copiar(P[1].getBuffer(), u); v = copiar(P[2].getBuffer(), v);
    ocupadoFoto = true;
    final long t0 = tFoto;
    final float[] q = { pose.tx(), pose.ty(), pose.tz(), pose.qx(), pose.qy(), pose.qz(), pose.qw() };
    hilo.execute(() -> {
      try {
        boolean gira = giro == 90 || giro == 270;
        int w2 = W / 2, h2 = H / 2, Wo = gira ? h2 : w2, Ho = gira ? w2 : h2;
        if (px == null || px.length != Wo * Ho) { px = new int[Wo * Ho]; bm = Bitmap.createBitmap(Wo, Ho, Bitmap.Config.ARGB_8888); }
        for (int oy = 0; oy < Ho; oy++) for (int ox = 0; ox < Wo; ox++) {
          int sx, sy;
          if (giro == 90) { sx = oy; sy = h2 - 1 - ox; } else if (giro == 180) { sx = w2 - 1 - ox; sy = h2 - 1 - oy; } else if (giro == 270) { sx = w2 - 1 - oy; sy = ox; } else { sx = ox; sy = oy; }
          sx <<= 1; sy <<= 1;
          int Y = y[sy * rsY + sx] & 0xff, iu = (sy >> 1) * rsU + (sx >> 1) * psU, iv = (sy >> 1) * rsV + (sx >> 1) * psV;
          int U = (u[iu] & 0xff) - 128, V = (v[iv] & 0xff) - 128;
          int R = Y + ((359 * V) >> 8), G = Y - ((88 * U + 183 * V) >> 8), B = Y + ((454 * U) >> 8);
          R = R < 0 ? 0 : R > 255 ? 255 : R; G = G < 0 ? 0 : G > 255 ? 255 : G; B = B < 0 ? 0 : B > 255 ? 255 : B;
          px[oy * Wo + ox] = 0xff000000 | (R << 16) | (G << 8) | B;
        }
        bm.setPixels(px, 0, Wo, 0, 0, Wo, Ho);
        salida.reset(); bm.compress(Bitmap.CompressFormat.JPEG, 62, salida);
        jpeg = salida.toByteArray(); int n = ++nFoto;
        float fx = (gira ? focal[1] : focal[0]) / 2f, fy = (gira ? focal[0] : focal[1]) / 2f;
        double tanX = (Wo / 2.0) / fx, tanY = (Ho / 2.0) / fy, e = edad + (SystemClock.elapsedRealtime() - t0);
        act.enviar(String.format(Locale.US, "__nativo&&__nativo.foto({\"n\":%d,\"url\":\"%scamara/%d.jpg\",\"e\":%.1f,\"tx\":%.5f,\"ty\":%.5f,\"w\":%d,\"h\":%d,\"p\":[%.4f,%.4f,%.4f,%.6f,%.6f,%.6f,%.6f]})",
            n, MainActivity.RAIZ_WEB, n, e, tanX, tanY, Wo, Ho, q[0], q[1], q[2], q[3], q[4], q[5], q[6]));
      } catch (Throwable t) {
        act.enviar("__nativo&&__nativo.estado('camara: " + t.getClass().getSimpleName() + "')");
      } finally { ocupadoFoto = false; }
    });
  }

  void cerrar() { hilo.shutdown(); }
}
