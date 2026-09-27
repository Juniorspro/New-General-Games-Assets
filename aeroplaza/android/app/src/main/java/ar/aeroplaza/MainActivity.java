package ar.aeroplaza;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

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

  WebView web;
  FrameLayout raiz;
  Ar ar;
  CamaraManos camara;
  PermissionRequest pendiente;
  boolean arPendiente, arConManos, camaraPendiente;
  /* (lo que pidió el juego para tu espacio, por si llega antes de que exista ARCore: se aplica al crearlo) */
  volatile Boolean quiereEscanear, quierePasante; volatile boolean quiereProfundidad;
  long ultimoAtras;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    raiz = new FrameLayout(this);
    raiz.setBackgroundColor(Color.BLACK);
    web = new WebView(this);
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
    setContentView(raiz);
    pantallaCompleta();
    web.loadUrl(BASE + "aeroplaza.html");
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

  /* lo que va al juego (desde cualquier hilo) */
  void enviar(final String js) { web.post(() -> web.evaluateJavascript(js, null)); }

  @Override protected void onResume() {
    super.onResume(); web.onResume();
    if (ar != null) { String e = ar.reanudar(); enviar("__nativo&&__nativo.estado('" + e + "')"); }
    if (camara != null) camara.reanudar();
  }
  @Override protected void onPause() { if (ar != null) ar.pausar(); if (camara != null) camara.pausar(); web.onPause(); super.onPause(); }
  @Override protected void onDestroy() { if (ar != null) ar.cerrar(); if (camara != null) camara.cerrar(); web.destroy(); super.onDestroy(); }

  /* atrás: al juego (como Escape: pausa o cierra lo que esté abierto); dos veces seguidas, sale */
  @Override public void onBackPressed() {
    long ahora = System.currentTimeMillis();
    if (ahora - ultimoAtras < 1200) { super.onBackPressed(); return; }
    ultimoAtras = ahora;
    web.evaluateJavascript("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))", null);
  }

  /* window.AeroplazaNativo */
  class Puente {
    @JavascriptInterface public String version() { return "1"; }
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
