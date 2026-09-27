package ar.aeroplaza;

import android.graphics.Bitmap;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.media.Image;
import android.os.SystemClock;

import com.google.ar.core.Camera;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.PointCloud;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.NotYetAvailableException;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/* TU ESPACIO (como el "Space Setup" de un Quest): lo que ARCore ve del cuarto, para que el juego lo
   dibuje encima de la cámara y deje ventanas en su lugar.
   - LOS PLANOS: piso, mesas, techo (horizontales) y paredes (verticales), cada 400 ms, con su pose y
     su contorno (js/espacio.js los pinta y los clasifica).
   - LO DEMÁS (muebles, objetos): LA MALLA DEL CUARTO (vuelta 35, Malla.java): la profundidad de ARCore (la
     "cruda" con su confianza), cada ~150 ms, fundida en cubitos de 3 cm y hecha malla, en su hilo. Los planos
     llenan lo que no llega. Cada bloque cambiado sale por https (MainActivity › /malla/) y se avisa con
     __nativo.malla. Si el celu no tiene profundidad, los puntos sueltos que sigue ARCore (la nube de puntos),
     en cubitos de VOX (5 cm) que cuentan cuando los vieron FIRME veces.
   - LA CÁMARA para ver a través (passthrough): la foto de la CPU entera (640 × 480; a la mitad si pasarla
     tarda más de MITAD_SI ms, en los celus lentos), derecha para la pantalla y en JPEG; el juego la pide por https (MainActivity › /camara/) con la pose de ESA foto, y
     la pone en el mundo donde se sacó: al girar la cabeza entre foto y foto, la imagen queda en su lugar. */
class Espacio {
  final MainActivity act;
  volatile boolean escanea, pasante, olvidarPedido;
  /* (reconfigurar: la sesión perdió los planos o la profundidad; Ar.aplicarConfig la configura de nuevo) */
  volatile boolean reconfigurar;
  boolean conProfundidad;
  /* (vuelta 38, para saber por qué no escanea: cada segundo va al juego, __nativo.diagEspacio) cuántas fotos de
     profundidad salieron, cuántas "todavía no", el último error; si la cruda no sale, la suavizada */
  int okProf, esperaProf, reconfigs; String errProf = ""; boolean profSuave; long tDiag, tVigila;
  static final float VOX = 0.05f;
  static final int FIRME = 3, TOPE = 90000, POR_MENSAJE = 4000;
  /* (cada cubito: cuántas veces se vio; los nuevos firmes esperan a salir en el próximo mensaje) */
  final HashMap<Long, Integer> vistos = new HashMap<>();
  int[] nuevos = new int[3 * 1024]; int nNuevos = 0, firmes = 0;
  long tPlanos, tProf, tVox;

  /* la malla, en su hilo: la foto de profundidad que espera, los planos para llenar y lo que ya se malló
     (clave "bx_by_bz" → los bytes; lo lee MainActivity) */
  final Malla malla = new Malla();
  final ExecutorService hiloMalla = Executors.newSingleThreadExecutor();
  volatile boolean ocupadoMalla, olvidarMalla;
  volatile List<float[][]> planosMalla = new ArrayList<>();
  final ConcurrentHashMap<String, byte[]> mallas = new ConcurrentHashMap<>();
  long tRelleno, tSoloPlanos;
  short[] mmCopia; byte[] confCopia;
  /* (para el juego: cuántas fotos de profundidad entraron, cuánto tardó la última, y si algo falló) */
  volatile int fotosProf; volatile long msMalla; volatile String errorMalla = "";

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
  static final long MITAD_SI = 28;    // ms que puede tardar la foto entera (si no, a la mitad)
  volatile long msFoto = 0; volatile int wFoto, hFoto;
  volatile boolean aMitad;   // (con la entera que tarda de más, a la mitad; vuelve a la entera si sobra, con espera: si no, iba y venía)
  long tMitad;
  byte[] nv;   // (la foto en NV21, para el JPEG del sistema)

  Espacio(MainActivity a) { act = a; }

  /* el pedido del juego, en la config que arma Ar.aplicarConfig (en el hilo de GL, antes de sesion.update:
     configurar la sesión desde otro hilo mientras corre no es seguro) */
  void preparar(Session s, Config c, boolean si) {
    c.setPlaneFindingMode(si ? Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL : Config.PlaneFindingMode.DISABLED);
    c.setDepthMode(si && s.isDepthModeSupported(Config.DepthMode.AUTOMATIC) ? Config.DepthMode.AUTOMATIC : Config.DepthMode.DISABLED);
  }
  /* ya configurada: lo que quedó de verdad (se lee de vuelta, no lo que se pidió), y se le avisa al juego */
  void configurado(Session s, boolean si) {
    Config r = s.getConfig();
    conProfundidad = si && r.getDepthMode() == Config.DepthMode.AUTOMATIC;
    escanea = si; tVigila = SystemClock.elapsedRealtime();
    act.enviar("__nativo&&__nativo.estado('espacio " + (si ? (conProfundidad ? "profundidad" : "puntos") : "apagado") + "')");
  }
  void fallo(Throwable t) {
    escanea = false;
    act.enviar("__nativo&&__nativo.estado('espacio error: " + t.getClass().getSimpleName() + "')");
  }

  /* se empieza de cero (escanear de nuevo): lo pide el juego desde otro hilo; se hace en el de GL */
  void olvidar() { olvidarPedido = true; }

  /* cada cuadro de ARCore (hilo de GL) */
  void cuadro(Session s, Frame fr, Camera cam) {
    if (olvidarPedido) { olvidarPedido = false; vistos.clear(); nNuevos = 0; firmes = 0; olvidarMalla = true; mallas.clear(); act.enviar("__nativo&&__nativo.olvidado()"); }
    if (!escanea) return;
    long ahora = SystemClock.elapsedRealtime();
    if (ahora - tDiag > 1000) { tDiag = ahora; diag(s, cam); }
    /* (cada 2 s, que la sesión siga con los planos y la profundidad: si algo se los apagó, de nuevo) */
    if (ahora - tVigila > 2000) {
      tVigila = ahora; Config r = s.getConfig();
      if (r.getPlaneFindingMode() == Config.PlaneFindingMode.DISABLED || (conProfundidad && r.getDepthMode() != Config.DepthMode.AUTOMATIC)) { reconfigurar = true; reconfigs++; }
    }
    if (cam.getTrackingState() != TrackingState.TRACKING) return;
    if (ahora - tPlanos > 400) { tPlanos = ahora; planos(s); }
    /* (mientras la profundidad no llega, también los puntos: algo se ve) */
    if (ahora - tProf > 150) { tProf = ahora; if (conProfundidad) { profundidad(fr, cam); if (fotosProf == 0) nube(fr); } else nube(fr); }
    /* (sin profundidad, la malla igual: con los planos, cada 2 s) */
    if (!conProfundidad && !ocupadoMalla && ahora - tSoloPlanos > 2000) {
      tSoloPlanos = ahora; ocupadoMalla = true;
      hiloMalla.execute(() -> { try { fundir(null, null, 0, 0, 0, 0, 0, 0, null); } catch (Throwable t) { errorMalla = t.getClass().getSimpleName(); } finally { ocupadoMalla = false; } });
    }
    if (nNuevos > 0 && ahora - tVox > 250) { tVox = ahora; mandarVoxeles(); }
  }

  /* (vuelta 38) cómo va, para la tarjeta: los planos (siguiendo / todos), la profundidad (salieron, "todavía no",
     el último error, si es la suavizada), lo que tiene la sesión de verdad, la cámara y por qué no sigue */
  void diag(Session s, Camera cam) {
    try {
      int pl = 0, plT = 0;
      for (Plane p : s.getAllTrackables(Plane.class)) { plT++; if (p.getTrackingState() == TrackingState.TRACKING && p.getSubsumedBy() == null) pl++; }
      Config r = s.getConfig(); CameraConfig cc = s.getCameraConfig();
      act.enviar(String.format(Locale.US, "__nativo&&__nativo.diagEspacio&&__nativo.diagEspacio({\"pl\":%d,\"plT\":%d,\"ok\":%d,\"espera\":%d,\"err\":\"%s\",\"suave\":%b,\"cfgPl\":%b,\"cfgProf\":%b,\"cam\":\"%s %dx%d@%d\",\"sigue\":\"%s\",\"fotos\":%d,\"reconf\":%d,\"foto\":\"%dx%d %dms\",\"mitad\":%b})",
          pl, plT, okProf, esperaProf, errProf, profSuave, r.getPlaneFindingMode() != Config.PlaneFindingMode.DISABLED, r.getDepthMode() != Config.DepthMode.DISABLED,
          cc.getCameraId(), cc.getImageSize().getWidth(), cc.getImageSize().getHeight(), cc.getFpsRange().getUpper(),
          cam.getTrackingState() == TrackingState.TRACKING ? "ok" : cam.getTrackingFailureReason().name(), fotosProf, reconfigs, wFoto, hFoto, msFoto, aMitad));
    } catch (Throwable t) { /* (el diagnóstico no rompe nada) */ }
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
    /* (para la malla: la pose y el contorno de cada plano) */
    List<float[][]> l = new ArrayList<>();
    for (Plane p : s.getAllTrackables(Plane.class)) {
      if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
      float[] m = new float[16]; p.getCenterPose().toMatrix(m, 0);
      FloatBuffer pol = p.getPolygon(); pol.rewind(); float[] v = new float[pol.remaining()]; pol.get(v);
      l.add(new float[][] { m, v });
    }
    planosMalla = l;
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
      /* (la cruda, con su confianza; si en este celu no sale, la suavizada con confianza pareja) */
      if (profSuave) d = fr.acquireDepthImage16Bits();
      else { d = fr.acquireRawDepthImage16Bits(); c = fr.acquireRawDepthConfidenceImage(); }
      okProf++;
      int W = d.getWidth(), H = d.getHeight();
      Image.Plane pd = d.getPlanes()[0], pc = c == null ? null : c.getPlanes()[0];
      ByteBuffer bd = pd.getBuffer().order(ByteOrder.LITTLE_ENDIAN), bc = pc == null ? null : pc.getBuffer();
      int rd = pd.getRowStride(), sd = pd.getPixelStride(), rc = pc == null ? 0 : pc.getRowStride(), sc = pc == null ? 0 : pc.getPixelStride();
      CameraIntrinsics ci = cam.getTextureIntrinsics();
      float[] f = ci.getFocalLength(), pp = ci.getPrincipalPoint(); int[] dim = ci.getImageDimensions();
      float fx = f[0] * W / dim[0], fy = f[1] * H / dim[1], cx = pp[0] * W / dim[0], cy = pp[1] * H / dim[1];
      final float[] m = new float[16]; cam.getPose().toMatrix(m, 0);
      /* (la malla está ocupada con la anterior: esta foto no) */
      if (ocupadoMalla) return;
      if (mmCopia == null || mmCopia.length != W * H) { mmCopia = new short[W * H]; confCopia = new byte[W * H]; }
      for (int v = 0; v < H; v++) for (int u = 0; u < W; u++) { mmCopia[v * W + u] = bd.getShort(v * rd + u * sd); confCopia[v * W + u] = bc == null ? (byte) 200 : bc.get(v * rc + u * sc); }
      final short[] mm = mmCopia; final byte[] cf = confCopia; final int w = W, h = H; final float ffx = fx, ffy = fy, ccx = cx, ccy = cy;
      ocupadoMalla = true;
      try { hiloMalla.execute(() -> { try { fundir(mm, cf, w, h, ffx, ffy, ccx, ccy, m); } catch (Throwable t) { errorMalla = t.getClass().getSimpleName(); } finally { ocupadoMalla = false; } }); }
      catch (Throwable t) { ocupadoMalla = false; throw t; }
    } catch (NotYetAvailableException t) {
      /* todavía no hay (las primeras fotos); si la cruda nunca sale (~9 s), la suavizada */
      if (++esperaProf > 60 && okProf == 0 && !profSuave) profSuave = true;
    }
    /* (otra cosa: que la tarjeta lo diga; y si es la cruda, la suavizada) */
    catch (Throwable t) { errProf = t.getClass().getSimpleName(); if (okProf == 0 && !profSuave) profSuave = true; }
    finally { if (d != null) d.close(); if (c != null) c.close(); }
  }

  /* en el hilo de la malla: fundir la foto, llenar con los planos (cada 2 s), mallar lo cambiado (cada bloque a lo
     sumo cada 350 ms, 60 por vez) y avisar al juego qué bloques cambiaron */
  void fundir(short[] mm, byte[] cf, int W, int H, float fx, float fy, float cx, float cy, float[] m) {
    if (olvidarMalla) { olvidarMalla = false; malla.vaciar(); fotosProf = 0; }
    long t0 = SystemClock.elapsedRealtime();
    if (mm != null) { malla.integrar(mm, cf, W, H, fx, fy, cx, cy, m, W * H > 20000 ? 2 : 1); fotosProf++; }
    long ahora = SystemClock.elapsedRealtime();
    if (mm == null || ahora - tRelleno > 2000) { tRelleno = ahora; for (float[][] p : planosMalla) malla.rellenarPlano(p[0], p[1]); }
    List<Malla.Bloque> l = malla.sucios(ahora, mm == null ? 0 : 350, 60);
    msMalla = SystemClock.elapsedRealtime() - t0;
    if (l.isEmpty()) { avisarMalla(""); return; }
    StringBuilder b = new StringBuilder(64 * l.size() + 64); b.append("__nativo&&__nativo.malla&&__nativo.malla([");
    boolean primero = true;
    for (Malla.Bloque bq : l) {
      byte[] d = malla.mallar(bq); bq.tMalla = ahora;
      String k = bq.bx + "_" + bq.by + "_" + bq.bz;
      if (d == null) mallas.remove(k); else mallas.put(k, d);
      if (!primero) b.append(','); primero = false;
      b.append("[\"").append(k).append("\",").append(bq.bx).append(',').append(bq.by).append(',').append(bq.bz).append(',').append(bq.version).append(',').append(d == null ? 0 : d.length).append(',').append(bq.hecho ? 1 : 0).append(']');
    }
    int[] c = malla.cuenta();
    b.append("],").append(c[0]).append(',').append(c[1]).append(',').append(fotosProf).append(',').append(SystemClock.elapsedRealtime() - t0).append(",'").append(errorMalla).append("')");
    act.enviar(b.toString());
  }
  /* (sin bloques nuevos: igual, cada tanto, cómo va) */
  long tAviso;
  void avisarMalla(String x) {
    long ahora = SystemClock.elapsedRealtime(); if (ahora - tAviso < 1000) return; tAviso = ahora;
    int[] c = malla.cuenta();
    act.enviar("__nativo&&__nativo.malla&&__nativo.malla([]," + c[0] + "," + c[1] + "," + fotosProf + "," + msMalla + ",'" + errorMalla + "')");
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
    foto(im, new float[] { pose.tx(), pose.ty(), pose.tz(), pose.qx(), pose.qy(), pose.qz(), pose.qw() }, edad, focal, giro);
  }
  /* (vuelta 42) con la pose en números (x, y, z, qx, qy, qz, qw): la de la ultra ancha la da la cabeza (Fusion), no ARCore */
  void foto(Image im, final float[] q, double edad, float[] focal, int giro) {
    tFoto = SystemClock.elapsedRealtime();
    Image.Plane[] P = im.getPlanes();
    final int W = im.getWidth(), H = im.getHeight();
    final int rsY = P[0].getRowStride(), rsU = P[1].getRowStride(), psU = P[1].getPixelStride(), rsV = P[2].getRowStride(), psV = P[2].getPixelStride();
    y = copiar(P[0].getBuffer(), y); u = copiar(P[1].getBuffer(), u); v = copiar(P[2].getBuffer(), v);
    ocupadoFoto = true;
    final long t0 = tFoto;
    hilo.execute(() -> {
      try {
        /* (vuelta 38) CON EL CELU ACOSTADO (en el visor, giro 0 o 180): la foto entera, derecha y en JPEG con el
           del sistema (YuvImage, en C): tarda unos pocos ms. La de Java (cada píxel a RGB y girado) tardaba tanto
           con el escaneo andando (la malla y la profundidad en otros hilos) que pasaba a la mitad para siempre:
           320 × 240 estirada a 67°, "horrible, como zoomeada" */
        if (giro == 0 || giro == 180) {
          boolean da = giro == 180; int n2 = W * H + 2 * (W / 2) * (H / 2);
          if (nv == null || nv.length != n2) nv = new byte[n2];
          for (int r = 0; r < H; r++) {
            if (!da) System.arraycopy(y, r * rsY, nv, r * W, W);
            else { int d = (H - 1 - r) * W + W - 1, o = r * rsY; for (int c = 0; c < W; c++) nv[d - c] = y[o + c]; }
          }
          for (int r = 0, base = W * H, w2 = W / 2, h2 = H / 2; r < h2; r++) for (int c = 0; c < w2; c++) {
            int o = da ? base + (h2 - 1 - r) * W + (w2 - 1 - c) * 2 : base + r * W + c * 2;
            nv[o] = v[r * rsV + c * psV]; nv[o + 1] = u[r * rsU + c * psU];
          }
          salida.reset(); new YuvImage(nv, ImageFormat.NV21, W, H, null).compressToJpeg(new Rect(0, 0, W, H), 80, salida);
          jpeg = salida.toByteArray(); int n = ++nFoto;
          long ms = SystemClock.elapsedRealtime() - t0; msFoto = msFoto == 0 ? ms : (msFoto * 3 + ms) / 4; wFoto = W; hFoto = H;
          double tanX = (W / 2.0) / focal[0], tanY = (H / 2.0) / focal[1], e = edad + (SystemClock.elapsedRealtime() - t0);
          act.enviar(String.format(Locale.US, "__nativo&&__nativo.foto({\"n\":%d,\"url\":\"%scamara/%d.jpg\",\"e\":%.1f,\"tx\":%.5f,\"ty\":%.5f,\"w\":%d,\"h\":%d,\"p\":[%.4f,%.4f,%.4f,%.6f,%.6f,%.6f,%.6f]})",
              n, MainActivity.RAIZ_WEB, n, e, tanX, tanY, W, H, q[0], q[1], q[2], q[3], q[4], q[5], q[6]));
          return;
        }
        boolean gira = giro == 90 || giro == 270, mitad = aMitad;
        final int k = mitad ? 1 : 0;
        int w2 = W >> k, h2 = H >> k, Wo = gira ? h2 : w2, Ho = gira ? w2 : h2;
        if (px == null || px.length != Wo * Ho) { px = new int[Wo * Ho]; bm = Bitmap.createBitmap(Wo, Ho, Bitmap.Config.ARGB_8888); }
        for (int oy = 0; oy < Ho; oy++) for (int ox = 0; ox < Wo; ox++) {
          int sx, sy;
          if (giro == 90) { sx = oy; sy = h2 - 1 - ox; } else if (giro == 180) { sx = w2 - 1 - ox; sy = h2 - 1 - oy; } else if (giro == 270) { sx = w2 - 1 - oy; sy = ox; } else { sx = ox; sy = oy; }
          sx <<= k; sy <<= k;
          int Y = y[sy * rsY + sx] & 0xff, iu = (sy >> 1) * rsU + (sx >> 1) * psU, iv = (sy >> 1) * rsV + (sx >> 1) * psV;
          int U = (u[iu] & 0xff) - 128, V = (v[iv] & 0xff) - 128;
          int R = Y + ((359 * V) >> 8), G = Y - ((88 * U + 183 * V) >> 8), B = Y + ((454 * U) >> 8);
          R = R < 0 ? 0 : R > 255 ? 255 : R; G = G < 0 ? 0 : G > 255 ? 255 : G; B = B < 0 ? 0 : B > 255 ? 255 : B;
          px[oy * Wo + ox] = 0xff000000 | (R << 16) | (G << 8) | B;
        }
        bm.setPixels(px, 0, Wo, 0, 0, Wo, Ho);
        salida.reset(); bm.compress(Bitmap.CompressFormat.JPEG, 70, salida);
        jpeg = salida.toByteArray(); int n = ++nFoto;
        long ms = SystemClock.elapsedRealtime() - t0; msFoto = msFoto == 0 ? ms : (msFoto * 3 + ms) / 4; wFoto = Wo; hFoto = Ho;
        /* (a la mitad si la entera tarda de más; y de vuelta a la entera si a la mitad sobra mucho, cada 5 s a lo sumo) */
        long ahora = SystemClock.elapsedRealtime();
        if (!mitad && nFoto > 10 && msFoto > MITAD_SI) { aMitad = true; tMitad = ahora; }
        else if (mitad && msFoto * 4 < MITAD_SI * 0.6 && ahora - tMitad > 5000) { aMitad = false; tMitad = ahora; msFoto = 0; }
        float fx = (gira ? focal[1] : focal[0]) / (1 << k), fy = (gira ? focal[0] : focal[1]) / (1 << k);
        double tanX = (Wo / 2.0) / fx, tanY = (Ho / 2.0) / fy, e = edad + (SystemClock.elapsedRealtime() - t0);
        act.enviar(String.format(Locale.US, "__nativo&&__nativo.foto({\"n\":%d,\"url\":\"%scamara/%d.jpg\",\"e\":%.1f,\"tx\":%.5f,\"ty\":%.5f,\"w\":%d,\"h\":%d,\"p\":[%.4f,%.4f,%.4f,%.6f,%.6f,%.6f,%.6f]})",
            n, MainActivity.RAIZ_WEB, n, e, tanX, tanY, Wo, Ho, q[0], q[1], q[2], q[3], q[4], q[5], q[6]));
      } catch (Throwable t) {
        act.enviar("__nativo&&__nativo.estado('camara: " + t.getClass().getSimpleName() + "')");
      } finally { ocupadoFoto = false; }
    });
  }

  void cerrar() { hilo.shutdown(); hiloMalla.shutdown(); }
}
