package ar.aeroplaza;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/* AEROPLAZA en Android: el juego de siempre (aeroplaza.html, en los assets) en una WebView a pantalla
   completa. Lo nativo es lo que la web no puede: ARCore (dónde está el celu, en 6 ejes: Ar.java) y
   MediaPipe de Android para las manos (ManosNativas.java, con las fotos de ARCore o, sin ARCore, de la
   cámara que abre la APK: CamaraManos.java). Se habla con el juego por
   window.AeroplazaNativo (JS → Java) y window.__nativo (Java → JS, js/nativo.js) */
public class MainActivity extends Activity {
  /* (los assets por https: la web los ve como un sitio seguro, con cámara, workers y módulos) */
  static final String RAIZ_WEB = "https://appassets.androidplatform.net/", BASE = RAIZ_WEB + "assets/";
  static final int PERMISOS_WEB = 1, PERMISOS_AR = 2, PERMISOS_CAMARA = 3;

  volatile WebView web;
  FrameLayout raiz;
  Ar ar;
  CamaraManos camara;
  PermissionRequest pendiente;
  boolean arPendiente, arConManos, camaraPendiente;
  /* (lo que pidió el juego para tu espacio, por si llega antes de que exista ARCore: se aplica al crearlo) */
  volatile Boolean quiereEscanear, quierePasante; volatile boolean quiereProfundidad;
  long ultimoAtras;
  /* (vuelta 41) por qué se cerró la vez pasada (Choque.java): el juego lo lee una vez y lo muestra en un aviso */
  SharedPreferences prefs;
  volatile String choque = "";
  /* (vuelta 44) el mando VR Box: teclasVR, el juego está en el VR (el volumen y los temas del modo música van al juego) */
  volatile boolean teclasVR;
  final MandoBox mando = new MandoBox();
  boolean arVivoYa;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    vigilarChoques();
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    raiz = new FrameLayout(this);
    raiz.setBackgroundColor(Color.BLACK);
    setContentView(raiz);
    pantallaCompleta();
    crearWeb();
  }

  /* la WebView con el juego (también de nuevo si su proceso se cae: onRenderProcessGone) */
  void crearWeb() {
    final WebView web = new WebView(this);
    this.web = web;
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
    web.setWebViewClient(new WebViewClientCompat() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        /* (la última foto de la cámara para ver a través, Espacio.java: se pide por número, sin guardarla) */
        Uri u = r.getUrl();
        if ("appassets.androidplatform.net".equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/camara/")) {
          Ar a = ar; byte[] j = a == null ? null : a.espacio.jpeg;
          if (j == null) return new WebResourceResponse("image/jpeg", null, 404, "No", null, null);
          java.util.Map<String, String> h = new java.util.HashMap<>(); h.put("Cache-Control", "no-store");
          return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new java.io.ByteArrayInputStream(j));
        }
        /* (la malla del cuarto, un bloque por pedido: Espacio.java › fundir) */
        if ("appassets.androidplatform.net".equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/malla/")) {
          Ar a = ar; String k = u.getPath().substring(7).replace(".bin", "");
          byte[] d = a == null ? null : a.espacio.mallas.get(k);
          if (d == null) return new WebResourceResponse("application/octet-stream", null, 404, "No", null, null);
          java.util.Map<String, String> h = new java.util.HashMap<>(); h.put("Cache-Control", "no-store");
          return new WebResourceResponse("application/octet-stream", null, 200, "OK", h, new java.io.ByteArrayInputStream(d));
        }
        return cargador.shouldInterceptRequest(u);
      }
      /* (los links de afuera, en el navegador) */
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("appassets.androidplatform.net".equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nada */ }
        return true;
      }
      /* (vuelta 41) SI SE CAE EL PROCESO DE LA WEBVIEW (sin memoria, o un error de Chrome o de la placa), Android
         cierra la app entera si esto no lo atiende. Se anota, se sueltan ARCore y la cámara y se arma otra con el
         juego (que muestra el aviso) */
      @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
        String c = d.didCrash() ? "WEBVIEW_CRASH" : "WEBVIEW_KILLED";
        if (prefs != null) try { prefs.edit().putString("choque", c).putLong("tChoque", System.currentTimeMillis()).commit(); } catch (Throwable t) { /* nada */ }
        raiz.post(() -> {
          boolean conAR = arVivoYa, era = MainActivity.this.web == v;
          if (era) MainActivity.this.web = null;
          try { if (ar != null && ar.corriendo) ar.parar(); } catch (Throwable t) { /* nada */ }
          try { if (camara != null) camara.apagar(); } catch (Throwable t) { /* nada */ }
          try { raiz.removeView(v); v.destroy(); } catch (Throwable t) { /* nada */ }
          if (era) { choque = (conAR ? "[ARCore] " : "") + c; crearWeb(); }
        });
        return true;
      }
    });
    /* la cámara y el micrófono de la web (las manos sin ARCore, el chat de voz): con el permiso de Android */
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(final PermissionRequest r) {
        runOnUiThread(() -> {
          List<String> faltan = faltantes(r.getResources());
          if (faltan.isEmpty()) r.grant(r.getResources());
          else { pendiente = r; requestPermissions(faltan.toArray(new String[0]), PERMISOS_WEB); }
        });
      }
    });
    web.addJavascriptInterface(new Puente(), "AeroplazaNativo");
    raiz.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    web.loadUrl(BASE + "aeroplaza.html");
  }

  /* (vuelta 41, "se me cierra la app al entrar al ARCore") sin logcat, la app dice sola por qué se cerró la vez
     pasada: una excepción de Java se anota antes de morir; un choque nativo o un ANR, Android los guarda
     (ApplicationExitInfo, Android 11+); y si ARCore estaba prendido (arVivo sin apagar), se dice */
  void vigilarChoques() {
    prefs = getSharedPreferences("aeroplaza", MODE_PRIVATE);
    final Thread.UncaughtExceptionHandler antes = Thread.getDefaultUncaughtExceptionHandler();
    Thread.setDefaultUncaughtExceptionHandler((th, e) -> {
      try { prefs.edit().putString("choque", Choque.java(th.getName(), e)).putLong("tChoque", System.currentTimeMillis()).commit(); } catch (Throwable t) { /* nada */ }
      if (antes != null) antes.uncaughtException(th, e); else System.exit(10);
    });
    try { choque = choqueAnterior(); } catch (Throwable t) { choque = ""; }
  }
  String choqueAnterior() {
    long ahora = System.currentTimeMillis(), DOCE = 12 * 3600_000L;
    String deJava = prefs.getString("choque", null); long tJava = prefs.getLong("tChoque", 0);
    boolean conAR = prefs.getBoolean("arVivo", false);
    SharedPreferences.Editor ed = prefs.edit().remove("choque").remove("tChoque").putBoolean("arVivo", false);
    StringBuilder s = new StringBuilder();
    if (Build.VERSION.SDK_INT >= 30) {
      try {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        long visto = prefs.getLong("salidaVista", 0);
        List<ApplicationExitInfo> l = am.getHistoricalProcessExitReasons(null, 0, 6);
        /* (de la más nueva a la más vieja: la primera que sea un cierre de verdad, de hace menos de 12 h) */
        for (ApplicationExitInfo e : l) {
          if (e.getTimestamp() <= visto || ahora - e.getTimestamp() > DOCE) break;
          String r = Choque.razon(e.getReason());
          if (r == null || !Choque.cuenta(e.getReason(), e.getImportance())) continue;
          s.append(r).append(" · ").append(Choque.hace(ahora - e.getTimestamp()));
          if (e.getDescription() != null && !e.getDescription().isEmpty()) s.append(" · ").append(Choque.corto(e.getDescription(), 80));
          if (e.getPss() > 0) s.append(" · ").append(e.getPss() / 1024).append(" MB");
          try (InputStream in = e.getTraceInputStream()) {
            if (in != null) {
              byte[] b = Choque.leer(in, 4 << 20);
              String x = e.getReason() == ApplicationExitInfo.REASON_CRASH_NATIVE ? Choque.tombstone(b)
                  : e.getReason() == ApplicationExitInfo.REASON_ANR ? Choque.anr(new String(b, java.nio.charset.StandardCharsets.UTF_8)) : "";
              if (!x.isEmpty()) s.append(" · ").append(x);
            }
          } catch (Throwable t) { /* sin la traza */ }
          break;
        }
        if (!l.isEmpty()) ed.putLong("salidaVista", l.get(0).getTimestamp());
      } catch (Throwable t) { /* nada */ }
    }
    if (deJava != null && ahora - tJava < DOCE) s.append(s.length() > 0 ? " · " : "").append(deJava);
    if (conAR) s.insert(0, s.length() > 0 ? "[ARCore] " : "[ARCore]");
    ed.apply();
    return s.toString();
  }
  /* (ARCore prendido: si la app muere así, sin pasar por onPause, la próxima vez se sabe) */
  void arVivo(boolean si) {
    if (si == arVivoYa || prefs == null) return;
    arVivoYa = si;
    try { prefs.edit().putBoolean("arVivo", si).commit(); } catch (Throwable t) { /* nada */ }
  }

  /* los permisos de Android que le faltan a lo que pide la web */
  List<String> faltantes(String[] recursos) {
    List<String> l = new ArrayList<>();
    for (String x : recursos) {
      String p = PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x) ? Manifest.permission.CAMERA
          : PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x) ? Manifest.permission.RECORD_AUDIO : null;
      if (p != null && checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED && !l.contains(p)) l.add(p);
    }
    return l;
  }

  @Override public void onRequestPermissionsResult(int pedido, String[] permisos, int[] res) {
    boolean ok = res.length > 0;
    for (int r : res) ok &= r == PackageManager.PERMISSION_GRANTED;
    if (pedido == PERMISOS_WEB && pendiente != null) {
      if (ok) pendiente.grant(pendiente.getResources()); else pendiente.deny();
      pendiente = null;
    } else if (pedido == PERMISOS_AR) {
      if (ok && arPendiente) iniciarAr(arConManos);
      else enviar("__nativo&&__nativo.estado('sin-permiso')");
      arPendiente = false;
    } else if (pedido == PERMISOS_CAMARA) {
      if (ok && camaraPendiente) manosCamara(true);
      else enviar("__nativo&&__nativo.estado('manos-camara sin-permiso')");
      camaraPendiente = false;
    }
  }

  void pantallaCompleta() {
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController c = getWindow().getInsetsController();
      if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
    } else {
      getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
  }
  @Override public void onWindowFocusChanged(boolean foco) { super.onWindowFocusChanged(foco); if (foco) pantallaCompleta(); }

  /* ARCore: pide la cámara si hace falta y arranca (en el hilo de la interfaz) */
  void iniciarAr(boolean conManos) {
    arConManos = conManos;
    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      arPendiente = true; requestPermissions(new String[] { Manifest.permission.CAMERA }, PERMISOS_AR); return;
    }
    /* (la cámara es de uno solo: si la tenían las manos sin ARCore, se suelta antes) */
    if (camara != null && camara.prendida) camara.apagar();
    if (camara != null) { camara.ancha = false; camara.pasante = false; }
    if (ar == null) {
      ar = new Ar(this);
      if (quiereEscanear != null) ar.escanear(quiereEscanear);
      if (quierePasante != null) ar.pasante(quierePasante);
    }
    ar.quiereProfundidad = quiereProfundidad;
    String e = ar.iniciar(conManos);
    enviar("__nativo&&__nativo.estado('" + e + "')");
  }

  /* las manos sin ARCore: la APK abre la cámara (CamaraManos) y las fotos van a MediaPipe de Android */
  void manosCamara(boolean si) {
    if (!si) { camaraPendiente = false; if (camara != null) camara.apagar(); return; }
    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      camaraPendiente = true; requestPermissions(new String[] { Manifest.permission.CAMERA }, PERMISOS_CAMARA); return;
    }
    if (ar != null && ar.corriendo) ar.parar();
    if (camara == null) camara = new CamaraManos(this);
    camara.prender();
  }

  /* (vuelta 42, "sobre todo la cámara debe usarse en 0.5x") LA ULTRA ANCHA EN TU ESPACIO. ARCore sigue dónde
     estás con la cámara principal (la que tiene calibrada) y no presta la cámara: para ver por la 0.5x, ARCore
     queda en pausa con su mundo, CamaraManos abre la ultra ancha (como AngleCam: su número o el zoom < 1) y
     manda la foto con la pose del giroscopio, alineado con ARCore desde antes (Fusion). Girar la cabeza anda;
     caminar no (sin ARCore no se sabe cuánto): para eso se vuelve a 1x. Avisa 'ancha corre' · 'espera' (la
     cabeza todavía no está alineada) · 'no-ar' · 'apagada' · 'lente <via id zoom campo principal>' */
  void espacioAncho(boolean si) {
    if (si) {
      if (ar == null || !ar.corriendo) { enviar("__nativo&&__nativo.estado('ancha no-ar')"); return; }
      if (!ar.ancho) {
        if (!ar.pasarAAncho()) { enviar("__nativo&&__nativo.estado('ancha espera')"); return; }
        if (camara == null) camara = new CamaraManos(this);
        camara.ancha = true; camara.pasante = true;
        camara.prender();
      }
      enviar("__nativo&&__nativo.estado('ancha corre')");
    } else {
      apagarAncha();
      if (ar != null) { String e = ar.volverDeAncho(); enviar("__nativo&&__nativo.estado('" + e + "')"); }
      enviar("__nativo&&__nativo.estado('ancha apagada')");
    }
  }
  void apagarAncha() { if (camara != null && camara.ancha) { camara.apagar(); camara.ancha = false; camara.pasante = false; } }

  /* lo que va al juego (desde cualquier hilo) */
  void enviar(final String js) { final WebView w = web; if (w != null) w.post(() -> { try { w.evaluateJavascript(js, null); } catch (Throwable t) { /* ya no está */ } }); }

  @Override protected void onResume() {
    super.onResume(); if (web != null) web.onResume();
    if (ar != null) { String e = ar.reanudar(); enviar("__nativo&&__nativo.estado('" + e + "')"); }
    if (camara != null) camara.reanudar();
  }
  @Override protected void onPause() { if (ar != null) ar.pausar(); if (camara != null) camara.pausar(); if (web != null) web.onPause(); super.onPause(); }
  @Override protected void onDestroy() { if (ar != null) ar.cerrar(); if (camara != null) camara.cerrar(); if (web != null) web.destroy(); super.onDestroy(); }

  /* (vuelta 44) los mandos: sus botones y su palanca van al juego (MandoBox), antes que a la WebView, que no se los
     pasaría a la página. Un mando raro no puede cerrar la app: si algo falla, sigue como siempre */
  static boolean deMando(int fuente, int tecla) {
    return (fuente & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (fuente & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK || KeyEvent.isGamepadButton(tecla);
  }
  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    try {
      int a = e.getAction(), k = e.getKeyCode();
      if (a == KeyEvent.ACTION_DOWN || a == KeyEvent.ACTION_UP) {
        boolean m = deMando(e.getSource(), k);
        if (MandoBox.boton(k, m, teclasVR) >= 0) {
          String js = MandoBox.tecla(k, a == KeyEvent.ACTION_DOWN, e.getRepeatCount(), m, teclasVR);
          if (js != null) enviar(js);
          return true;
        }
      }
    } catch (Throwable t) { /* sigue como siempre */ }
    return super.dispatchKeyEvent(e);
  }
  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) {
    try {
      if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK && e.getAction() == MotionEvent.ACTION_MOVE) {
        String js = mando.eje(e.getAxisValue(MotionEvent.AXIS_X), e.getAxisValue(MotionEvent.AXIS_Y), e.getAxisValue(MotionEvent.AXIS_HAT_X), e.getAxisValue(MotionEvent.AXIS_HAT_Y));
        if (js != null) enviar(js);
        return true;
      }
    } catch (Throwable t) { /* sigue como siempre */ }
    return super.dispatchGenericMotionEvent(e);
  }

  /* atrás: al juego (como Escape: pausa o cierra lo que esté abierto); dos veces seguidas, sale */
  @Override public void onBackPressed() {
    long ahora = System.currentTimeMillis();
    if (ahora - ultimoAtras < 1200) { super.onBackPressed(); return; }
    ultimoAtras = ahora;
    enviar("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))");
  }

  /* window.AeroplazaNativo */
  class Puente {
    @JavascriptInterface public String version() { return "1"; }
    /* (vuelta 44) el mando: en el VR se toman también el volumen y los temas (el modo música del VR Box) */
    @JavascriptInterface public void mandoVR(boolean si) { teclasVR = si; }
    /* los mandos conectados, por nombre ("VR BOX|…"; "" si no hay): los que dicen ser mando, y los que se llaman como
       uno (el VR Box en modo música se presenta como teclado) */
    @JavascriptInterface public String mandos() {
      StringBuilder s = new StringBuilder();
      try {
        for (int id : InputDevice.getDeviceIds()) {
          InputDevice d = InputDevice.getDevice(id); if (d == null || d.isVirtual()) continue;
          int f = d.getSources(); String n = String.valueOf(d.getName());
          boolean es = (f & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (f & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK || n.matches("(?i).*(vr|box|park|shinecon|remote|gamepad|controller).*");
          if (!es) continue; if (s.length() > 0) s.append('|'); s.append(n.replace('|', ' '));
        }
      } catch (Throwable t) { /* nada */ }
      return s.toString();
    }
    /* (vuelta 41) por qué se cerró la vez pasada, una sola vez ("" si no se cerró mal) */
    @JavascriptInterface public String choque() {
      String c = choque; choque = "";
      if (c != null && !c.isEmpty()) try { prefs.edit().remove("choque").remove("tChoque").apply(); } catch (Throwable t) { /* nada */ }
      return c == null ? "" : c;
    }
    /* 'si' · 'instalar' (el celu puede, falta la app de ARCore) · 'espera' · 'no' */
    @JavascriptInterface public String arEstado() { return Ar.estado(MainActivity.this); }
    @JavascriptInterface public void arIniciar(final boolean conManos) { runOnUiThread(() -> iniciarAr(conManos)); }
    @JavascriptInterface public void arParar() { runOnUiThread(() -> { if (ar != null) ar.parar(); }); }
    @JavascriptInterface public void arManos(final boolean si) { runOnUiThread(() -> { if (ar != null) ar.manos(si); }); }
    /* (el juego tiene una mano a prueba: buscar dos en cada foto, para verlas juntas) */
    /* tu espacio: escanear el cuarto (planos y profundidad), la cámara para ver a través, y empezar de cero */
    @JavascriptInterface public void arEscanear(final boolean si) { quiereEscanear = si; Ar a = ar; if (a != null) a.escanear(si); }
    @JavascriptInterface public void arPasante(final boolean si) { quierePasante = si; Ar a = ar; if (a != null) a.pasante(si); }
    /* (antes de arIniciar: si la cámara tiene que dar profundidad, para tu espacio) */
    @JavascriptInterface public void arProfundidad(final boolean si) { quiereProfundidad = si; }
    /* (vuelta 39) la cabeza en este instante, adelantada a cuando se ve (ms): "qx,qy,qz,qw,x,y,z" o "" */
    @JavascriptInterface public String cabeza(double adelanto) { Ar a = ar; return a == null || !a.corriendo ? "" : a.cabeza.leer(adelanto); }
    /* (vuelta 42) si el celu tiene ultra ancha y cómo se llega: "via id zoom campo principal" (Ancha) o "no ..." */
    @JavascriptInterface public String camaraAncha() {
      try {
        String p = null; Ar a = ar;
        try { if (a != null && a.sesion != null) p = a.sesion.getCameraConfig().getCameraId(); } catch (Throwable t) { /* la de atrás */ }
        CameraManager cm = (CameraManager) getSystemService(CAMERA_SERVICE);
        java.util.List<Ancha.Cam> l = CamaraManos.describir(cm);
        if (p == null) for (Ancha.Cam c : l) if (c.atras && c.abrible) { p = c.id; break; }
        return Ancha.elegir(l, p == null ? "0" : p).toString();
      } catch (Throwable t) { return "no"; }
    }
    @JavascriptInterface public void espacioAncho(final boolean si) { runOnUiThread(() -> espacioAncho(si)); }
    /* (vuelta 43) el giro de la cabeza de hace msAtras ms, para ubicar las manos con la cabeza de la hora de su foto */
    @JavascriptInterface public String cabezaAntes(double msAtras) { Ar a = ar; return a == null || !a.corriendo ? "" : a.cabeza.giroAntes(msAtras); }
    @JavascriptInterface public String cabezaEstado() { Ar a = ar; return a == null ? "" : a.cabeza.estado(); }
    @JavascriptInterface public void arOlvidar() { Ar a = ar; if (a != null) a.espacio.olvidar(); }
    @JavascriptInterface public void manosDos(final boolean si) {
      Ar a = ar; if (a != null && a.manos != null) a.manos.quiereDos = si;
      CamaraManos c = camara; if (c != null && c.manos != null) c.manos.quiereDos = si;
    }
    /* las manos sin ARCore, con la cámara que abre la APK */
    @JavascriptInterface public void manosCamara(final boolean si) { runOnUiThread(() -> manosCamara(si)); }
    /* (la linterna, de quien tenga la cámara) */
    @JavascriptInterface public void flash(final boolean si) { runOnUiThread(() -> { if (camara != null && camara.prendida) camara.flash(si); else if (ar != null) ar.flash(si); }); }
    @JavascriptInterface public void vibrar(int ms) {
      Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
      if (v != null) v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 400)), VibrationEffect.DEFAULT_AMPLITUDE));
    }
  }
}
