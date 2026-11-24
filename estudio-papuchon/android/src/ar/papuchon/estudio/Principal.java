package ar.papuchon.estudio;

import android.Manifest;
import ar.papuchon.comun.PuenteBase;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Estudio Papuchón como app: un WebView con el editor adentro.
 *
 * El editor se sirve desde los assets con un origen https falso
 * (appassets.androidplatform.net, el dominio que Android reserva para esto):
 * con file:// no hay contexto seguro garantizado ni IndexedDB confiable, y sin
 * contexto seguro no hay WebCodecs (no se podría exportar el MP4).
 * Lo que el WebView no sabe hacer solo (guardar un archivo, compartirlo, elegir
 * archivos, pedir cámara y micrófono) lo hace esta clase.
 */
public class Principal extends Activity {
    static final String ORIGEN = "https://appassets.androidplatform.net/";
    static final int ELEGIR = 1, PERMISOS = 2;

    WebView web;
    ValueCallback<Uri[]> alElegir;
    PermissionRequest pedidoPendiente;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0d0d10"));
        w.setNavigationBarColor(Color.parseColor("#16161b"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0d0d10"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);   // si el celular tiene letra grande, la interfaz no se desarma

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return null;   // lo de internet sigue normal
                String ruta = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
                try {
                    InputStream in = getAssets().open(ruta);
                    Map<String, String> cab = new HashMap<>();
                    cab.put("Cache-Control", "no-cache");
                    return new WebResourceResponse(tipo(ruta), tipo(ruta).startsWith("text/") ? "utf-8" : null, 200, "OK", cab, in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "No existe", new HashMap<>(), null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sin navegador */ }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (alElegir != null) alElegir.onReceiveValue(null);
                alElegir = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] tipos = p.getAcceptTypes();
                java.util.ArrayList<String> mimes = new java.util.ArrayList<>();
                for (String t : tipos) for (String x : t.split(",")) {
                    x = x.trim();
                    if (x.endsWith("/*") || x.contains("/")) mimes.add(x);
                    else if (x.equals(".srt")) mimes.add("application/x-subrip");
                }
                if (mimes.isEmpty()) i.setType("*/*");
                else if (mimes.size() == 1) i.setType(mimes.get(0));
                else { i.setType("*/*"); i.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0])); }
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(Intent.createChooser(i, "Elegí los archivos"), ELEGIR); }
                catch (Exception e) { alElegir = null; return false; }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest pedido) {
                runOnUiThread(() -> {
                    java.util.ArrayList<String> faltan = new java.util.ArrayList<>();
                    for (String r : pedido.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) faltan.add(Manifest.permission.CAMERA);
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) faltan.add(Manifest.permission.RECORD_AUDIO);
                    }
                    if (faltan.isEmpty()) { pedido.grant(pedido.getResources()); return; }
                    pedidoPendiente = pedido;
                    requestPermissions(faltan.toArray(new String[0]), PERMISOS);
                });
            }
        });

        // Que Android no apague la página cuando la app queda atrás (exportando con la pantalla apagada).
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        web.addJavascriptInterface(new Puente(), "AndroidPapuchon");
        setContentView(web);
        PuenteBase.pedirPermisos(this);
        if (guardado != null) web.restoreState(guardado); else web.loadUrl(ORIGEN + "index.html");
    }

    static String tipo(String ruta) {
        String r = ruta.toLowerCase();
        if (r.endsWith(".html")) return "text/html";
        if (r.endsWith(".js") || r.endsWith(".mjs")) return "text/javascript";
        if (r.endsWith(".css")) return "text/css";
        if (r.endsWith(".json")) return "application/json";
        if (r.endsWith(".woff2")) return "font/woff2";
        if (r.endsWith(".wasm")) return "application/wasm";
        if (r.endsWith(".png")) return "image/png";
        if (r.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        if (pedido != ELEGIR || alElegir == null) { super.onActivityResult(pedido, resultado, datos); return; }
        Uri[] r = null;
        if (resultado == RESULT_OK && datos != null) {
            if (datos.getClipData() != null) {
                int n = datos.getClipData().getItemCount(); r = new Uri[n];
                for (int i = 0; i < n; i++) r[i] = datos.getClipData().getItemAt(i).getUri();
            } else if (datos.getData() != null) r = new Uri[]{datos.getData()};
        }
        alElegir.onReceiveValue(r); alElegir = null;
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permisos, int[] res) {
        if (pedido != PERMISOS || pedidoPendiente == null) return;
        boolean ok = true; for (int x : res) ok &= x == PackageManager.PERMISSION_GRANTED;
        if (ok) pedidoPendiente.grant(pedidoPendiente.getResources()); else pedidoPendiente.deny();
        pedidoPendiente = null;
    }

    // El botón de atrás del celular cierra paneles y vuelve al inicio antes de salir.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.epAtras && window.epAtras()) ? 'si' : 'no'", (r) -> {
            if (r == null || !r.contains("si")) Principal.super.onBackPressed();
        });
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    @Override protected void onPause() { super.onPause(); web.evaluateJavascript("window.Motor && Motor.parar()", null); }

    /** Lo que el editor le pide a Android: descargar a Descargas/Papuchon, compartir y
     *  seguir exportando en segundo plano (todo eso vive en ar.papuchon.comun.PuenteBase). */
    class Puente extends PuenteBase { Puente() { super(Principal.this); } }
}
