package ar.aeroplaza;

import android.content.Context;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.Image;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.Size;
import android.util.SizeF;
import android.view.Surface;
import android.widget.FrameLayout;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.ImageMetadata;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.NotYetAvailableException;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/* ARCORE: dónde está el celu (posición y giro, 6 ejes) en cada foto de la cámara. Es lo que hace que
   el mundo quede quieto como en un Quest: con el giroscopio solo, el celu sabe para dónde mira pero no
   dónde está (al asomarse, agacharse o caminar, el mundo se venía con uno).
   - La sesión necesita un contexto de GL para la foto de la cámara: un GLSurfaceView de 1 × 1 atrás
     de la WebView, que no dibuja nada.
   - Cada cuadro nuevo: la pose (orientada a la pantalla: x a la derecha, y arriba, mira a -z, como la
     cámara de three) y hace cuánto se sacó la foto, a window.__nativo.pose.
   - Con las manos prendidas, la foto de la CPU va a MediaPipe de Android (ManosNativas).
   - Con TU ESPACIO (Espacio.java): los planos, la profundidad en cubitos y la foto para ver a través.
     La foto de la CPU se pide una vez por cuadro y la usan los dos.
   - A 60 fotos por segundo si la cámara puede (CameraConfigFilter). */
class Ar implements GLSurfaceView.Renderer {
  final MainActivity act;
  Session sesion;
  GLSurfaceView gl;
  ManosNativas manos;
  final Espacio espacio;
  volatile Boolean pedidoEspacio;
  /* (tu espacio: la cámara tiene que dar profundidad; se elige antes de arrancar, con la sesión pausada) */
  volatile boolean quiereProfundidad; boolean camaraDeProfundidad;   // (la segunda: ya se eligió la cámara para escanear)
  volatile boolean corriendo, conManos, flashPedido;
  long tLuz = 0;
  boolean pedirInstalar = true, geometria;
  int textura = -1, orientacionSensor = 90;
  long ultimaFoto;
  String fps = "?";

  Ar(MainActivity a) { act = a; espacio = new Espacio(a); }

  static String estado(Context c) {
    try {
      ArCoreApk.Availability a = ArCoreApk.getInstance().checkAvailability(c);
      if (a.isTransient()) return "espera";
      if (a == ArCoreApk.Availability.SUPPORTED_INSTALLED) return "si";
      if (a == ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD || a == ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED) return "instalar";
      return "no";
    } catch (Throwable t) { return "no"; }
  }

  /* devuelve cómo quedó: 'corre' · 'instalando' · 'no' · 'error: …' */
  String iniciar(boolean conManos) {
    this.conManos = conManos;
    try {
      if (sesion == null) {
        ArCoreApk.InstallStatus st = ArCoreApk.getInstance().requestInstall(act, pedirInstalar);
        if (st == ArCoreApk.InstallStatus.INSTALL_REQUESTED) { pedirInstalar = false; return "instalando"; }
        sesion = new Session(act);
        Config cfg = new Config(sesion);
        cfg.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
        cfg.setFocusMode(Config.FocusMode.AUTO);
        cfg.setPlaneFindingMode(Config.PlaneFindingMode.DISABLED);
        cfg.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
        cfg.setDepthMode(Config.DepthMode.DISABLED);
        sesion.configure(cfg);
        elegirCamara();
      }
      /* (la cámara según para qué: con profundidad para escanear, la de 60 para jugar; la sesión está pausada) */
      /* (si ya corría, primero se pausa: la cámara solo se cambia con la sesión quieta) */
      if (quiereProfundidad != camaraDeProfundidad && corriendo) { if (gl != null) gl.onPause(); sesion.pause(); corriendo = false; }
      /* (se prueba una vez por pedido: si el celu no tiene ninguna con profundidad, no se pausa a cada rato) */
      if (quiereProfundidad && !camaraDeProfundidad) { elegirParaProfundidad(); camaraDeProfundidad = true; }
      else if (!quiereProfundidad && camaraDeProfundidad) { elegirCamara(); camaraDeProfundidad = false; geometria = false; }
      if (conManos && manos == null) manos = new ManosNativas(act);
      if (gl == null) {
        gl = new GLSurfaceView(act);
        gl.setPreserveEGLContextOnPause(true);
        gl.setEGLContextClientVersion(2);
        gl.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        gl.setRenderer(this);
        gl.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        act.raiz.addView(gl, 0, new FrameLayout.LayoutParams(1, 1));
      }
      sesion.resume(); gl.onResume(); corriendo = true;
      return "corre";
    } catch (Throwable t) {
      corriendo = false;
      return "error: " + t.getClass().getSimpleName();
    }
  }

  /* el campo del lado largo de una cámara (grados), de su sensor y su lente; mas: con la focal más corta
     que tenga (una cámara lógica trae las de todas sus lentes: ahí está el 0.5x) */
  static double campo(CameraManager cm, String id, boolean mas) {
    try {
      CameraCharacteristics c = cm.getCameraCharacteristics(id);
      SizeF s = c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE); float[] f = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
      if (s == null || f == null || f.length == 0) return 0;
      float fm = f[0]; if (mas) for (float x : f) fm = Math.min(fm, x);
      return Math.toDegrees(2 * Math.atan(Math.max(s.getWidth(), s.getHeight()) / (2 * fm)));
    } catch (Throwable t) { return 0; }
  }

  /* LA CÁMARA (vuelta 31): la más abierta de las que ARCore acepta (en los celus que lo dejan, el 0.5x: se
     ve más del cuarto a través). Con esa, la de 60 fotos por segundo si hay, y la foto de la CPU más cerca de
     640 × 480. Casi todos los celus solo dejan la principal: ARCore sigue dónde estás con la cámara que
     tiene calibrada. Se le avisa al juego el campo que quedó y el más abierto que tiene el celu */
  void elegirCamara() {
    try {
      CameraManager cm = (CameraManager) act.getSystemService(Context.CAMERA_SERVICE);
      CameraConfigFilter f = new CameraConfigFilter(sesion);
      f.setFacingDirection(CameraConfig.FacingDirection.BACK);
      List<CameraConfig> todas = sesion.getSupportedCameraConfigs(f);
      double ancho = 0; String idAncho = null;
      for (CameraConfig c : todas) { double a = campo(cm, c.getCameraId(), false); if (a > ancho + 3) { ancho = a; idAncho = c.getCameraId(); } }
      CameraConfig mejor = null; long dm = Long.MAX_VALUE; int fpsMejor = 0;
      for (CameraConfig c : todas) {
        if (idAncho != null && !idAncho.equals(c.getCameraId())) continue;
        int cf = c.getFpsRange().getUpper(); Size s = c.getImageSize(); long d = Math.abs((long) s.getWidth() * s.getHeight() - 640L * 480L);
        if (cf > fpsMejor || (cf == fpsMejor && d < dm)) { fpsMejor = cf; dm = d; mejor = c; }
      }
      if (mejor != null) { sesion.setCameraConfig(mejor); fps = mejor.getFpsRange().getUpper() + ""; }
      String id = sesion.getCameraConfig().getCameraId();
      Integer o = cm.getCameraCharacteristics(id).get(CameraCharacteristics.SENSOR_ORIENTATION);
      if (o != null) orientacionSensor = o;
      double celu = 0; for (String x : cm.getCameraIdList()) { Integer lado = cm.getCameraCharacteristics(x).get(CameraCharacteristics.LENS_FACING); if (lado != null && lado == CameraCharacteristics.LENS_FACING_BACK) celu = Math.max(celu, campo(cm, x, true)); }
      act.enviar(String.format(Locale.US, "__nativo&&__nativo.estado('camara %.0f %.0f')", campo(cm, id, false), Math.max(celu, campo(cm, id, false))));
    } catch (Throwable t) { /* la de siempre */ }
  }

  /* (vuelta 36-37) PARA ESCANEAR HACE FALTA LA PROFUNDIDAD: la cámara de 60 fotos por segundo (elegirCamara) no
     la da en ARCore, y sin profundidad no hay malla. Con la sesión PAUSADA (antes de resume: cambiarla en el hilo
     de GL la podía dejar trabada), se prueban las de 30 (primero la misma cámara, con la foto de la CPU más cerca
     de 640 × 480) hasta una con profundidad. Devuelve si quedó una con profundidad */
  boolean elegirParaProfundidad() {
    try {
      if (sesion.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) { avisarCamara("espacio camara ok"); return true; }
      CameraConfigFilter f = new CameraConfigFilter(sesion);
      f.setFacingDirection(CameraConfig.FacingDirection.BACK);
      f.setTargetFps(EnumSet.of(CameraConfig.TargetFps.TARGET_FPS_30));
      final String actual = sesion.getCameraConfig().getCameraId();
      List<CameraConfig> l = new java.util.ArrayList<>(sesion.getSupportedCameraConfigs(f));
      l.sort((a, b) -> Long.compare(orden(a, actual), orden(b, actual)));
      CameraConfig antes = sesion.getCameraConfig();
      for (CameraConfig c : l) {
        sesion.setCameraConfig(c);
        if (sesion.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) { fps = c.getFpsRange().getUpper() + ""; geometria = false; avisarCamara("espacio camara 30"); return true; }
      }
      sesion.setCameraConfig(antes);
      avisarCamara("espacio camara sin-profundidad");
    } catch (Throwable t) { avisarCamara("espacio camara error: " + t.getClass().getSimpleName()); }
    return false;
  }
  static long orden(CameraConfig c, String actual) { Size s = c.getImageSize(); return Math.abs((long) s.getWidth() * s.getHeight() - 640L * 480L) + (actual.equals(c.getCameraId()) ? 0 : 100000000L); }
  void avisarCamara(String e) { act.enviar("__nativo&&__nativo.estado('" + e + "')"); }

  String reanudar() {
    if (sesion == null || !corriendo) return corriendo ? "corre" : "parada";
    try { sesion.resume(); if (gl != null) gl.onResume(); return "corre"; } catch (Throwable t) { return "error: " + t.getClass().getSimpleName(); }
  }
  void pausar() { if (gl != null) gl.onPause(); if (sesion != null) sesion.pause(); }
  void parar() { corriendo = false; pausar(); act.enviar("__nativo&&__nativo.estado('parada')"); }
  void manos(boolean si) { conManos = si; if (si && manos == null) manos = new ManosNativas(act); }
  /* tu espacio: escanear (planos y profundidad) y la foto para ver a través */
  void escanear(boolean si) { pedidoEspacio = si; }
  void pasante(boolean si) { espacio.pasante = si; }
  void cerrar() {
    corriendo = false;
    if (manos != null) { manos.cerrar(); manos = null; }
    espacio.cerrar();
    if (sesion != null) { sesion.close(); sesion = null; }
  }

  /* el flash (la linterna) con ARCore prendido: la cámara es de ARCore */
  void flash(boolean si) {
    flashPedido = si;
    if (sesion == null) return;
    try { Config c = sesion.getConfig(); c.setFlashMode(si ? Config.FlashMode.TORCH : Config.FlashMode.OFF); sesion.configure(c); }
    catch (Throwable t) { act.enviar("__nativo&&__nativo.estado('sin-flash')"); }
  }

  /* LA LUZ (vuelta 33, cada 0,4 s): la luz media de la foto (una grilla de 24 × 18 del brillo) y lo que tuvo
     que abrir la cámara para eso (la exposición y la sensibilidad de esa foto, si ARCore las da): con eso el
     juego sabe si está oscuro y prende la linterna (main.js › mirarLuz) */
  void luz(Image im, Frame fr) {
    double y = CamaraManos.luzMedia(im), ms = 0; int iso = 0;
    try { ImageMetadata md = fr.getImageMetadata(); ms = md.getLong(ImageMetadata.SENSOR_EXPOSURE_TIME) / 1e6; iso = md.getInt(ImageMetadata.SENSOR_SENSITIVITY); } catch (Throwable t) { /* sin datos */ }
    act.enviar(String.format(Locale.US, "__nativo&&__nativo.luz&&__nativo.luz(%.3f,%.2f,%d)", y, ms, iso));
  }

  int rotacionPantalla() {
    int r = act.getWindowManager().getDefaultDisplay().getRotation();
    return r == Surface.ROTATION_90 ? 90 : r == Surface.ROTATION_180 ? 180 : r == Surface.ROTATION_270 ? 270 : 0;
  }

  @Override public void onSurfaceCreated(GL10 g, EGLConfig c) {
    int[] t = new int[1];
    GLES20.glGenTextures(1, t, 0); textura = t[0];
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textura);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
    if (sesion != null) sesion.setCameraTextureName(textura);
    geometria = false;
  }
  @Override public void onSurfaceChanged(GL10 g, int w, int h) { geometria = false; }

  @Override public void onDrawFrame(GL10 g) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
    if (!corriendo || sesion == null) return;
    try {
      /* (la pose orientada a la pantalla: con el tamaño y el giro de la pantalla entera, no del GL de 1 × 1) */
      if (!geometria) {
        DisplayMetrics m = new DisplayMetrics(); act.getWindowManager().getDefaultDisplay().getRealMetrics(m);
        sesion.setCameraTextureName(textura);
        sesion.setDisplayGeometry(act.getWindowManager().getDefaultDisplay().getRotation(), m.widthPixels, m.heightPixels);
        geometria = true;
      }
      /* (lo que pidió el juego para tu espacio: la sesión se configura acá, en su hilo) */
      Boolean pe = pedidoEspacio; if (pe != null) { pedidoEspacio = null; espacio.configurar(sesion, pe); }
      Frame fr = sesion.update();
      long ts = fr.getTimestamp();
      if (ts == ultimaFoto) return;
      ultimaFoto = ts;
      Camera cam = fr.getCamera();
      TrackingState e = cam.getTrackingState();
      /* (la hora de la foto: ARCore la da en el reloj de la cámara, que en casi todos los celus es el
         de elapsedRealtime; si no cuadra, se supone 30 ms) */
      double edad = (SystemClock.elapsedRealtimeNanos() - ts) / 1e6;
      if (!(edad >= 0 && edad < 500)) edad = 30;
      Pose p = cam.getDisplayOrientedPose();
      act.enviar(String.format(Locale.US, "__nativo&&__nativo.pose(%.2f,%.5f,%.5f,%.5f,%.6f,%.6f,%.6f,%.6f,%d,'%s')", edad,
          p.tx(), p.ty(), p.tz(), p.qx(), p.qy(), p.qz(), p.qw(), e == TrackingState.TRACKING ? 1 : e == TrackingState.PAUSED ? 0 : -1, fps));
      espacio.cuadro(sesion, fr, cam);
      boolean paraManos = conManos && manos != null && manos.libre(), paraVer = espacio.quiereFoto() && e == TrackingState.TRACKING;
      long ahoraMs = SystemClock.elapsedRealtime();
      boolean paraLuz = ahoraMs - tLuz > 400;
      if (paraManos || paraVer || paraLuz) {
        Image im = null;
        try {
          im = fr.acquireCameraImage();
          if (paraLuz) { tLuz = ahoraMs; luz(im, fr); }
          CameraIntrinsics ci = cam.getImageIntrinsics();
          /* (lo que hay que girar la foto para que quede derecha en la pantalla) */
          int giro = (orientacionSensor - rotacionPantalla() + 360) % 360;
          if (paraManos) manos.procesar(im, ts, edad, ci.getFocalLength(), ci.getImageDimensions(), giro);
          if (paraVer) espacio.foto(im, p, edad, ci.getFocalLength(), giro);
        } catch (NotYetAvailableException x) { /* todavía no */ }
        finally { if (im != null) im.close(); }
      }
    } catch (Throwable t) {
      act.enviar("__nativo&&__nativo.estado('error: " + t.getClass().getSimpleName() + "')");
    }
  }
}
