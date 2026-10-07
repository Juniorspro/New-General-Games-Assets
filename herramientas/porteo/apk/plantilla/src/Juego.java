package __PAQUETE__;

// Una sola Activity con un WebView. Sin androidx ni Gradle a propósito: así el
// APK se arma con aapt2 + javac + d8 en segundos y pesa lo que pesa el juego,
// no 3 MB de bibliotecas que no usa.

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class Juego extends Activity {
    // Dominio "de mentira" que el WebView nunca sale a buscar: lo atendemos acá.
    // Se sirve por https y no por file:// porque con file:// los módulos ES,
    // fetch() y los .wasm se caen por CORS, y Unity/Godot dependen de eso.
    static final String ORIGEN = "https://appassets.androidplatform.net";
    static final String CARPETA = "juego";
    static final String INICIO = "__INICIO__";
    static final boolean AISLADO = __AISLADO__;
    static final boolean RED = __RED__;
    static final float HZ = __HZ__f;

    WebView web;
    long ultimoAtras = 0;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            // Ocupar también la zona del recorte de la cámara; el juego se cuida
            // con env(safe-area-inset-*), que tactil.js ya respeta.
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        if (HZ > 0) {
            // En un teléfono de 120 Hz, requestAnimationFrame corre a 120: el
            // juego que avanza un paso por cuadro va al doble de velocidad, y
            // el que usa delta gasta el doble de batería y se calienta.
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.preferredRefreshRate = HZ;
            if (Build.VERSION.SDK_INT >= 23) {
                Display d = getWindowManager().getDefaultDisplay();
                Display.Mode actual = d.getMode();
                for (Display.Mode m : d.getSupportedModes()) {
                    if (m.getPhysicalWidth() == actual.getPhysicalWidth()
                            && m.getPhysicalHeight() == actual.getPhysicalHeight()
                            && Math.abs(m.getRefreshRate() - HZ) < 1f) {
                        lp.preferredDisplayModeId = m.getModeId();
                        break;
                    }
                }
            }
            w.setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // Mantener apretado no abre "copiar/seleccionar" encima del juego.
        web.setLongClickable(false);
        web.setOnLongClickListener(new View.OnLongClickListener() {
            public boolean onLongClick(View v) { return true; }
        });
        web.setHapticFeedbackEnabled(false);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        if (Build.VERSION.SDK_INT >= 26) {
            // Que Android no mate el proceso del juego primero cuando falta memoria.
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // localStorage = las partidas guardadas
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);             // la letra grande del sistema no rompe la UI
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE); // todo es local: el caché sólo duplica

        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("juego", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        setContentView(web);
        pantallaCompleta();
        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(ORIGEN + "/" + INICIO);
    }

    void pantallaCompleta() {
        View d = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = d.getWindowInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        // Al volver de una notificación o del teclado, las barras reaparecen.
        if (foco) pantallaCompleta();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Sin esto la música sigue sonando con el teléfono bloqueado.
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    // Atrás: primero le pregunta al juego (window.porteoAtras: true = lo manejó,
    // 'salir' = cerrar ya), si no lo maneja
    // le manda Escape —casi todos los juegos de PC pausan con Escape— y recién
    // un segundo atrás seguido cierra la app.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){try{if(window.porteoAtras){var r=window.porteoAtras();return r==='salir'?r:!!r;}}catch(e){}" +
            "var o={key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true};" +
            "var t=document.activeElement||document.body||document;" +
            "['keydown','keyup'].forEach(function(n){var e=new KeyboardEvent(n,o);" +
            "try{Object.defineProperty(e,'keyCode',{get:function(){return 27}});" +
            "Object.defineProperty(e,'which',{get:function(){return 27}});}catch(_){}" +
            "t.dispatchEvent(e);});return false;})()",
            new ValueCallback<String>() {
                public void onReceiveValue(String r) {
                    // web.js ya lleva su propia cuenta de "dos atrás seguidos".
                    if ("\"salir\"".equals(r)) { finish(); return; }
                    if ("true".equals(r)) return;
                    long ahora = System.currentTimeMillis();
                    if (ahora - ultimoAtras < 2000) { finish(); return; }
                    ultimoAtras = ahora;
                    Toast.makeText(Juego.this, "Tocá atrás otra vez para salir", Toast.LENGTH_SHORT).show();
                }
            });
    }

    class Cliente extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!"appassets.androidplatform.net".equals(u.getHost())) {
                if (RED) return null;
                // Sin permiso de red: cortar acá en vez de esperar un timeout.
                return new WebResourceResponse("text/plain", "utf-8", 404, "Sin red", cabeceras(), null);
            }
            String ruta = u.getPath();
            if (ruta == null || ruta.isEmpty() || ruta.endsWith("/")) ruta = (ruta == null ? "/" : ruta) + "index.html";
            ruta = ruta.substring(1);
            AssetManager am = getAssets();
            try {
                InputStream in = am.open(CARPETA + "/" + ruta, AssetManager.ACCESS_STREAMING);
                String t = tipo(ruta);
                // Sin charset, Chromium supone windows-1252 y las tildes salen rotas.
                boolean texto = t.startsWith("text/") || t.endsWith("json") || t.endsWith("xml") || t.endsWith("svg+xml");
                return new WebResourceResponse(t, texto ? "utf-8" : null, 200, "OK", cabeceras(), in);
            } catch (IOException e) {
                Log.w("juego", "falta " + ruta);
                return new WebResourceResponse("text/plain", "utf-8", 404, "No existe", cabeceras(), null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if ("appassets.androidplatform.net".equals(u.getHost())) return false;
            // Los enlaces de afuera (créditos, itch.io) se abren en el navegador.
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
            // Si el motor del WebView se muere (falta de memoria), se rearma la
            // pantalla en vez de cerrar la app con "dejó de funcionar".
            recreate();
            return true;
        }
    }

    static Map<String, String> cabeceras() {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        if (AISLADO) {
            // SharedArrayBuffer (Godot 4 con hilos, Unity con hilos) lo exige.
            h.put("Cross-Origin-Opener-Policy", "same-origin");
            h.put("Cross-Origin-Embedder-Policy", "require-corp");
            h.put("Cross-Origin-Resource-Policy", "cross-origin");
        }
        return h;
    }

    static final Map<String, String> TIPOS = new HashMap<String, String>();
    static {
        String[] t = {
            "html", "text/html", "htm", "text/html", "js", "text/javascript", "mjs", "text/javascript",
            "css", "text/css", "json", "application/json", "wasm", "application/wasm",
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "gif", "image/gif",
            "webp", "image/webp", "avif", "image/avif", "svg", "image/svg+xml", "ico", "image/x-icon",
            "bmp", "image/bmp", "ktx2", "image/ktx2",
            "mp3", "audio/mpeg", "ogg", "audio/ogg", "oga", "audio/ogg", "opus", "audio/ogg",
            "wav", "audio/wav", "m4a", "audio/mp4", "aac", "audio/aac", "flac", "audio/flac",
            "mid", "audio/midi", "midi", "audio/midi",
            "mp4", "video/mp4", "webm", "video/webm", "ogv", "video/ogg",
            "woff", "font/woff", "woff2", "font/woff2", "ttf", "font/ttf", "otf", "font/otf",
            "xml", "application/xml", "txt", "text/plain", "csv", "text/csv",
            "glb", "model/gltf-binary", "gltf", "model/gltf+json",
            "swf", "application/x-shockwave-flash",
        };
        for (int i = 0; i < t.length; i += 2) TIPOS.put(t[i], t[i + 1]);
    }

    static String tipo(String ruta) {
        String r = ruta.toLowerCase();
        // .gz/.br ya vienen descomprimidos por armar.py: se sirve el tipo de adentro,
        // igual que un servidor bien configurado con Content-Encoding.
        if (r.endsWith(".gz")) r = r.substring(0, r.length() - 3);
        else if (r.endsWith(".br")) r = r.substring(0, r.length() - 3);
        int p = r.lastIndexOf('.');
        String t = p < 0 ? null : TIPOS.get(r.substring(p + 1));
        return t != null ? t : "application/octet-stream";
    }
}
