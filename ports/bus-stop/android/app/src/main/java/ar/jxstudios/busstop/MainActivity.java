package ar.jxstudios.busstop;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Display;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/* Bus Stop Simulator (port) en Android: el juego (index.html, juego.js y datos/, en los assets de la APK)
   en una WebView a pantalla completa. La WebView es el Chrome del teléfono: el 3D va por WebGL a la placa.
   Alrededor: la pantalla a 60 Hz, el proceso que dibuja con prioridad alta (y otra WebView si el sistema
   lo mata), el texto al 100 %, atrás = Escape (la pausa; dos veces seguidas, sale) y la vibración. */
public class MainActivity extends Activity {
  /* (los assets por https: la web los ve como un sitio seguro y fetch anda) */
  static final String BASE = "https://appassets.androidplatform.net/assets/";

  WebView web;
  FrameLayout raiz;
  WebViewAssetLoader cargador;
  long ultimoAtras;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    a60Hz();
    raiz = new FrameLayout(this);
    raiz.setBackgroundColor(Color.BLACK);
    cargador = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
    setContentView(raiz);
    armarWeb();
    pantallaCompleta();
  }

  void armarWeb() {
    web = new WebView(this);
    web.setBackgroundColor(Color.BLACK);
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.setVerticalScrollBarEnabled(false); web.setHorizontalScrollBarEnabled(false);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);          /* (las partidas y los ajustes se guardan en localStorage) */
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setTextZoom(100);
    s.setSupportZoom(false);
    if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(false);
    if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
    web.setWebViewClient(new WebViewClientCompat() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        return cargador.shouldInterceptRequest(r.getUrl());
      }
      /* (los links de afuera, en el navegador) */
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("appassets.androidplatform.net".equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nada */ }
        return true;
      }
      /* el proceso que dibuja se murió (el sistema lo mató por memoria, o se colgó la placa): otra WebView y de nuevo */
      @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
        raiz.removeView(web); web.destroy(); armarWeb(); return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient());
    web.addJavascriptInterface(new Puente(), "BusStopNativo");
    raiz.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    web.loadUrl(BASE + "index.html");
  }

  /* el modo de la pantalla más cercano a 60 Hz con la misma resolución */
  void a60Hz() {
    Display d = getWindowManager().getDefaultDisplay();
    if (d == null) return;
    WindowManager.LayoutParams p = getWindow().getAttributes();
    if (Build.VERSION.SDK_INT >= 23) {
      Display.Mode ahora = d.getMode(), mejor = null;
      for (Display.Mode m : d.getSupportedModes()) {
        if (m.getPhysicalWidth() != ahora.getPhysicalWidth() || m.getPhysicalHeight() != ahora.getPhysicalHeight()) continue;
        if (mejor == null || Math.abs(m.getRefreshRate() - 60) < Math.abs(mejor.getRefreshRate() - 60)) mejor = m;
      }
      if (mejor != null) p.preferredDisplayModeId = mejor.getModeId();
    }
    p.preferredRefreshRate = 60;
    getWindow().setAttributes(p);
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
  @Override public void onWindowFocusChanged(boolean foco) { super.onWindowFocusChanged(foco); if (foco) { pantallaCompleta(); a60Hz(); } }

  @Override protected void onResume() { super.onResume(); web.onResume(); web.resumeTimers(); }
  /* (minimizada: la página queda oculta, el juego se calla y los relojes de JS paran) */
  @Override protected void onPause() { web.onPause(); web.pauseTimers(); super.onPause(); }
  @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

  @Override public void onBackPressed() {
    long ahora = System.currentTimeMillis();
    if (ahora - ultimoAtras < 1200) { super.onBackPressed(); return; }
    ultimoAtras = ahora;
    web.evaluateJavascript("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))", null);
  }

  /* window.BusStopNativo: lo que la web del teléfono no hace (la vibración no existe en la WebView) */
  class Puente {
    @JavascriptInterface public String version() { return "1"; }
    @JavascriptInterface public void vibrar(int ms) {
      Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
      if (v == null) return;
      if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 400)), VibrationEffect.DEFAULT_AMPLITUDE));
      else v.vibrate(Math.max(1, Math.min(ms, 400)));
    }
  }
}
