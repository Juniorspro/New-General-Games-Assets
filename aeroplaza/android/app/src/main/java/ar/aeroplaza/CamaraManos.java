package ar.aeroplaza;

import android.content.Context;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Range;
import android.util.Size;
import android.util.SizeF;
import android.view.Surface;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/* LAS MANOS SIN ARCORE (vuelta 32): la APK abre la cámara ella misma (Camera2) y le pasa las fotos a las
   mismas manos nativas que con ARCore (ManosNativas: MediaPipe de Android, en la GPU). Con ARCore las manos
   andaban mejor que con la cámara de la web por eso, no por ARCore: la foto va directo de la cámara a la red
   (sin la WebView, sin el worker ni WASM), con el campo de la calibración y la hora del sensor. Acá igual:
   - la foto lo más cerca de 640 × 480 (4:3, como la de ARCore), en YUV;
   - lo más rápido que deje la cámara (hasta 60 por segundo; con poca luz puede bajar a la mitad);
   - sin estabilizar (corre la imagen y achica el campo) y con el foco continuo;
   - el campo de la calibración de la lente (o de la focal y el sensor), llevado al tamaño de la foto;
   - la hora de la foto, la del sensor (en casi todos los celus, el reloj de elapsedRealtime).
   Avisa al juego `manos-camara corre <fps>` · `parada` · `sin-permiso` · `error: …` */
class CamaraManos {
  final MainActivity act;
  ManosNativas manos;
  HandlerThread hilo;
  Handler h;
  CameraDevice cam;
  CameraCaptureSession ses;
  ImageReader lector;
  CaptureRequest.Builder pedido;
  volatile boolean prendida, pausada;
  boolean linterna, tiempoReal, abriendo;
  final float[] focal = new float[2];
  final int[] dims = new int[2];
  int orientacion = 90, fpsMax = 30;
  /* (vuelta 42) la ultra ancha para tu espacio: ancha elige la lente como AngleCam (Ancha: su número o el zoom
     menor que 1); pasante manda también la foto para ver a través, con la pose de la cabeza (Fusion) */
  volatile boolean ancha, pasante;
  float zoom = 1; boolean conCorreccion; String via = "";
  /* (la luz, vuelta 33: la exposición y la sensibilidad de la última foto, y cuándo se mandó) */
  volatile long exposicion = 0; volatile int iso = 0; long tLuz = 0;

  CamaraManos(MainActivity a) { act = a; }

  void avisar(String e) { act.enviar("__nativo&&__nativo.estado('manos-camara " + e.replace("'", "") + "')"); }

  void prender() {
    if (manos == null) manos = new ManosNativas(act);
    if (hilo == null) { hilo = new HandlerThread("camara-manos"); hilo.start(); h = new Handler(hilo.getLooper()); }
    prendida = true;
    h.post(() -> { if (cam == null) { if (!abriendo) abrir(); } else avisar("corre " + fpsMax); });
  }

  /* apagar y esperar a que la cámara quede libre (ARCore la abre enseguida) */
  void apagar() {
    prendida = false;
    if (h == null) return;
    final CountDownLatch listo = new CountDownLatch(1);
    h.post(() -> { cerrarCamara(); avisar("parada"); listo.countDown(); });
    try { listo.await(600, TimeUnit.MILLISECONDS); } catch (InterruptedException e) { /* sigue */ }
  }

  void pausar() { pausada = true; if (h != null) h.post(this::cerrarCamara); }
  void reanudar() { pausada = false; if (prendida && h != null) h.post(() -> { if (cam == null && !abriendo) abrir(); }); }
  void cerrar() {
    prendida = false;
    if (h != null) h.post(() -> { cerrarCamara(); hilo.quitSafely(); });
    if (manos != null) { manos.cerrar(); manos = null; }
  }

  void flash(boolean si) {
    linterna = si;
    if (h != null) h.post(() -> { if (pedido != null) { pedido.set(CaptureRequest.FLASH_MODE, si ? CaptureRequest.FLASH_MODE_TORCH : CaptureRequest.FLASH_MODE_OFF); repetir(); } });
  }

  /* (en su hilo) */
  void abrir() {
    if (!prendida || pausada) return;
    try {
      CameraManager cm = (CameraManager) act.getSystemService(Context.CAMERA_SERVICE);
      String id = null;
      for (String x : cm.getCameraIdList()) {
        Integer lado = cm.getCameraCharacteristics(x).get(CameraCharacteristics.LENS_FACING);
        if (lado != null && lado == CameraCharacteristics.LENS_FACING_BACK) { id = x; break; }
      }
      if (id == null) { prendida = false; avisar("error: sin camara"); return; }
      zoom = 1; via = "";
      if (ancha) {
        Ancha.Eleccion e = Ancha.elegir(describir(cm), id);
        if ("id".equals(e.via)) { id = e.id; via = e.toString(); }
        else if ("zoom".equals(e.via) && Build.VERSION.SDK_INT >= 30) { id = e.id; zoom = e.zoom; via = e.toString(); }
        act.enviar("__nativo&&__nativo.estado('ancha lente " + e + "')");
      }
      CameraCharacteristics c = cm.getCameraCharacteristics(id);
      /* (la ultra ancha dobla las líneas en el borde: que la enderece la cámara, si sabe) */
      conCorreccion = false;
      if (Build.VERSION.SDK_INT >= 28) { int[] dm = c.get(CameraCharacteristics.DISTORTION_CORRECTION_AVAILABLE_MODES); if (dm != null) for (int x : dm) if (x == CameraMetadata.DISTORTION_CORRECTION_MODE_FAST) conCorreccion = true; }
      StreamConfigurationMap mapa = c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
      Size t = tamano(mapa == null ? null : mapa.getOutputSizes(ImageFormat.YUV_420_888));
      Integer o = c.get(CameraCharacteristics.SENSOR_ORIENTATION);
      orientacion = o == null ? 90 : o;
      Integer fuente = c.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE);
      tiempoReal = fuente != null && fuente == CameraMetadata.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME;
      intrinsecos(c, t);
      /* (con el zoom menor que 1 la foto abre 1/zoom más: la focal en píxeles, zoom veces) */
      if (zoom < 0.999f) { focal[0] *= zoom; focal[1] *= zoom; }
      final Range<Integer> fps = elegirFps(c.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES));
      fpsMax = fps == null ? 30 : fps.getUpper();
      lector = ImageReader.newInstance(t.getWidth(), t.getHeight(), ImageFormat.YUV_420_888, 3);
      lector.setOnImageAvailableListener(this::llego, h);
      abriendo = true;
      cm.openCamera(id, new CameraDevice.StateCallback() {
        @Override public void onOpened(CameraDevice d) {
          abriendo = false;
          if (!prendida || pausada) { d.close(); return; }
          cam = d; sesion(fps);
        }
        @Override public void onDisconnected(CameraDevice d) { d.close(); if (cam == d) { cam = null; cerrarCamara(); if (prendida && !pausada) avisar("parada"); } }
        @Override public void onError(CameraDevice d, int e) { abriendo = false; d.close(); if (cam == d) cam = null; cerrarCamara(); prendida = false; avisar("error: camara " + e); }
      }, h);
    } catch (SecurityException x) { abriendo = false; prendida = false; avisar("sin-permiso"); }
    catch (Throwable x) { abriendo = false; prendida = false; cerrarCamara(); avisar("error: " + x.getClass().getSimpleName()); }
  }

  @SuppressWarnings("deprecation")
  void sesion(Range<Integer> fps) {
    try {
      Surface s = lector.getSurface();
      pedido = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
      pedido.addTarget(s);
      pedido.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO);
      pedido.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
      if (fps != null) pedido.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fps);
      pedido.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF);
      pedido.set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE, CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF);
      pedido.set(CaptureRequest.FLASH_MODE, linterna ? CaptureRequest.FLASH_MODE_TORCH : CaptureRequest.FLASH_MODE_OFF);
      if (zoom < 0.999f && Build.VERSION.SDK_INT >= 30) pedido.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoom);
      if (conCorreccion && Build.VERSION.SDK_INT >= 28) pedido.set(CaptureRequest.DISTORTION_CORRECTION_MODE, CaptureRequest.DISTORTION_CORRECTION_MODE_FAST);
      cam.createCaptureSession(Arrays.asList(s), new CameraCaptureSession.StateCallback() {
        @Override public void onConfigured(CameraCaptureSession x) {
          if (cam == null || !prendida) { x.close(); return; }
          ses = x; repetir(); avisar("corre " + fpsMax);
        }
        @Override public void onConfigureFailed(CameraCaptureSession x) { prendida = false; cerrarCamara(); avisar("error: sesion"); }
      }, h);
    } catch (Throwable x) { prendida = false; cerrarCamara(); avisar("error: " + x.getClass().getSimpleName()); }
  }

  void repetir() {
    try { if (ses != null && pedido != null) ses.setRepeatingRequest(pedido.build(), alSacar, h); }
    catch (Throwable x) { avisar("error: " + x.getClass().getSimpleName()); }
  }

  final CameraCaptureSession.CaptureCallback alSacar = new CameraCaptureSession.CaptureCallback() {
    @Override public void onCaptureCompleted(CameraCaptureSession x, CaptureRequest q, TotalCaptureResult r) {
      Long e = r.get(CaptureResult.SENSOR_EXPOSURE_TIME); Integer s = r.get(CaptureResult.SENSOR_SENSITIVITY);
      exposicion = e == null ? 0 : e; iso = s == null ? 0 : s;
    }
  };

  /* la luz media de una foto YUV (0-1): el brillo en una grilla de 24 × 18 */
  static double luzMedia(Image im) {
    Image.Plane p = im.getPlanes()[0]; ByteBuffer b = p.getBuffer(); int rs = p.getRowStride(), W = im.getWidth(), H = im.getHeight(), lim = b.limit();
    long suma = 0; int n = 0;
    for (int j = 0; j < 18; j++) for (int i = 0; i < 24; i++) {
      int k = ((j * 2 + 1) * H / 36) * rs + (i * 2 + 1) * W / 48;
      if (k < lim) { suma += b.get(k) & 0xff; n++; }
    }
    return n == 0 ? -1 : suma / (double) n / 255.0;
  }

  void cerrarCamara() {
    try { if (ses != null) ses.close(); } catch (Throwable t) { /* ya estaba */ }
    ses = null; pedido = null;
    try { if (cam != null) cam.close(); } catch (Throwable t) { /* ya estaba */ }
    cam = null;
    if (lector != null) { lector.close(); lector = null; }
  }

  /* cada foto: si las manos están libres, a ellas (copian la foto y la sueltan enseguida) */
  void llego(ImageReader r) {
    Image im = null;
    try {
      im = r.acquireLatestImage();
      if (im == null) return;
      long ahoraMs = SystemClock.elapsedRealtime();
      if (ahoraMs - tLuz > 400) {
        tLuz = ahoraMs;
        act.enviar(String.format(Locale.US, "__nativo&&__nativo.luz&&__nativo.luz(%.3f,%.2f,%d)", luzMedia(im), exposicion / 1e6, iso));
      }
      long ahora = SystemClock.elapsedRealtimeNanos(), ts = im.getTimestamp();
      double edad = tiempoReal ? (ahora - ts) / 1e6 : 25;
      if (!(edad >= 0 && edad < 500)) edad = 25;
      int giro = (orientacion - rotacionPantalla() + 360) % 360;
      /* (vuelta 42) la foto para ver a través, con la pose de la cámara en su hora (el giroscopio, alineado con ARCore) */
      Ar a = act.ar;
      if (pasante && a != null && a.espacio.quiereFoto()) {
        float[] q = new float[7];
        if (a.cabeza.f.camaraEn(tiempoReal ? ts : ahora - (long) (edad * 1e6), q)) a.espacio.foto(im, q, edad, focal, giro);
      }
      ManosNativas m = manos;
      if (m == null || !m.libre()) return;
      m.procesar(im, tiempoReal ? ts : ahora, edad, focal, dims, giro);
    } catch (Throwable t) { /* la próxima */ }
    finally { if (im != null) im.close(); }
  }

  int rotacionPantalla() {
    int r = act.getWindowManager().getDefaultDisplay().getRotation();
    return r == Surface.ROTATION_90 ? 90 : r == Surface.ROTATION_180 ? 180 : r == Surface.ROTATION_270 ? 270 : 0;
  }

  /* (vuelta 42) todas las cámaras, para Ancha: las de getCameraIdList y las lentes físicas de las lógicas (esas no
     se abren solas). Como AngleCam: la focal y el tamaño del sensor de cada una, y el zoom más chico (Android 11+) */
  static List<Ancha.Cam> describir(CameraManager cm) {
    List<Ancha.Cam> l = new ArrayList<>(); Set<String> vistas = new HashSet<>();
    try {
      for (String id : cm.getCameraIdList()) { Ancha.Cam c = describir(cm, id, true); if (c != null) { l.add(c); vistas.add(id); } }
      for (Ancha.Cam c : new ArrayList<>(l)) if (c.logica) for (String f : c.fisicas) if (vistas.add(f)) { Ancha.Cam x = describir(cm, f, false); if (x != null) l.add(x); }
    } catch (Throwable t) { /* las que se pudieron */ }
    return l;
  }
  static Ancha.Cam describir(CameraManager cm, String id, boolean abrible) {
    try {
      CameraCharacteristics k = cm.getCameraCharacteristics(id);
      Integer lado = k.get(CameraCharacteristics.LENS_FACING);
      float[] f = k.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS); SizeF s = k.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
      /* (la primera focal: la de siempre; una lógica trae las de todas sus lentes, y la más corta es la ancha, que va por el zoom) */
      Ancha.Cam c = new Ancha.Cam(id, lado != null && lado == CameraCharacteristics.LENS_FACING_BACK, f != null && f.length > 0 ? f[0] : 0, s == null ? 0 : s.getWidth(), s == null ? 0 : s.getHeight());
      c.abrible = abrible;
      if (Build.VERSION.SDK_INT >= 30) { Range<Float> z = k.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE); if (z != null) c.zoomMin = z.getLower(); }
      if (Build.VERSION.SDK_INT >= 28) {
        int[] cap = k.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
        if (cap != null) for (int x : cap) if (x == CameraMetadata.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA) c.logica = true;
        if (c.logica) c.fisicas.addAll(k.getPhysicalCameraIds());
      }
      return c;
    } catch (Throwable t) { return null; }
  }

  /* el tamaño de la foto: lo más cerca de 640 × 480 y de 4:3, sin bajar de 360 del lado corto */
  static Size tamano(Size[] l) {
    Size mejor = null; double menor = Double.MAX_VALUE;
    if (l != null) for (Size s : l) {
      double a = s.getWidth() / (double) s.getHeight();
      double costo = Math.abs(s.getWidth() * (double) s.getHeight() - 640 * 480) / 1000.0 + Math.abs(a - 4 / 3.0) * 1000 + (Math.min(s.getWidth(), s.getHeight()) < 360 ? 1e6 : 0);
      if (costo < menor) { menor = costo; mejor = s; }
    }
    return mejor != null ? mejor : new Size(640, 480);
  }

  /* los cuadros por segundo: el más alto hasta 60; entre los que llegan igual, el que con poca luz puede
     bajar a la mitad (y no más: con 7 por segundo la mano sale corrida) */
  static Range<Integer> elegirFps(Range<Integer>[] l) {
    if (l == null || l.length == 0) return null;
    int alto = 0;
    for (Range<Integer> r : l) if (r.getUpper() <= 60) alto = Math.max(alto, r.getUpper());
    Range<Integer> m = null;
    int techo = Math.max(15, alto / 2);
    for (Range<Integer> r : l) {
      if (r.getUpper() != alto) continue;
      boolean bien = r.getLower() <= techo, mBien = m != null && m.getLower() <= techo;
      if (m == null || (bien && !mBien) || (bien == mBien && (bien ? r.getLower() > m.getLower() : r.getLower() < m.getLower()))) m = r;
    }
    return m;
  }

  /* la focal en píxeles de la foto: la calibración de la lente (en el sensor antes de corregir) o la
     focal y el tamaño del sensor; la foto sale de lo más grande de su forma que entra en el sensor,
     centrado y achicado */
  void intrinsecos(CameraCharacteristics c, Size t) {
    float fx = 0, fy = 0; int aw = 0, ah = 0;
    float[] f = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
    SizeF fis = c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
    Size px = c.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE);
    Rect activo = c.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
    if (f != null && f.length > 0 && fis != null && px != null && activo != null) {
      fx = f[0] / fis.getWidth() * px.getWidth(); fy = f[0] / fis.getHeight() * px.getHeight();
      aw = activo.width(); ah = activo.height();
    }
    float[] cal = Build.VERSION.SDK_INT >= 28 ? c.get(CameraCharacteristics.LENS_INTRINSIC_CALIBRATION) : null;
    Rect pre = c.get(CameraCharacteristics.SENSOR_INFO_PRE_CORRECTION_ACTIVE_ARRAY_SIZE);
    /* (la calibración, si está y no dice cualquier cosa: a menos de un 30 % de la de la lente) */
    if (cal != null && cal.length >= 2 && cal[0] > 1 && cal[1] > 1 && pre != null && (fx <= 0 || Math.abs(cal[0] / fx - 1) < 0.3)) {
      fx = cal[0]; fy = cal[1]; aw = pre.width(); ah = pre.height();
    }
    if (fx <= 0 || aw <= 0) {
      /* (sin datos: unos 66° de lado largo, lo común en la cámara principal) */
      focal[0] = focal[1] = (float) (t.getWidth() / 2.0 / Math.tan(Math.toRadians(33)));
    } else {
      double k = Math.min(aw / (double) t.getWidth(), ah / (double) t.getHeight());
      focal[0] = (float) (fx / k); focal[1] = (float) (fy / k);
    }
    dims[0] = t.getWidth(); dims[1] = t.getHeight();
  }
}
