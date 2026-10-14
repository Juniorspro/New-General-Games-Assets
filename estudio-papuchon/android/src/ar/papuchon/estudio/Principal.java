package ar.papuchon.estudio;

import android.Manifest;
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

        web.addJavascriptInterface(new Puente(), "AndroidPapuchon");
        setContentView(web);
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

    /** Lo que el editor le pide a Android. El archivo llega en pedazos en base64 (un video pesa decenas de MB). */
    class Puente {
        final Map<String, Object[]> abiertos = new HashMap<>();   // id → {OutputStream, Uri o File, nombre, mime}
        int siguiente = 0;

        @JavascriptInterface
        public String abrir(String nombre, String mime) {
            try {
                String id = "a" + (++siguiente);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    boolean video = mime.startsWith("video/"), imagen = mime.startsWith("image/");
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, (video ? Environment.DIRECTORY_MOVIES : imagen ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/Papuchon");
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri col = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : imagen ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    Uri u = getContentResolver().insert(col, cv);
                    abiertos.put(id, new Object[]{getContentResolver().openOutputStream(u), u, nombre, mime});
                } else {
                    File dir = new File(getExternalFilesDir(null), "Papuchon"); dir.mkdirs();
                    File f = new File(dir, nombre);
                    abiertos.put(id, new Object[]{new FileOutputStream(f), f, nombre, mime});
                }
                return id;
            } catch (Exception e) { return "error:" + e.getMessage(); }
        }

        @JavascriptInterface
        public boolean escribir(String id, String b64) {
            Object[] a = abiertos.get(id); if (a == null) return false;
            try { ((OutputStream) a[0]).write(Base64.decode(b64, Base64.DEFAULT)); return true; } catch (IOException e) { return false; }
        }

        @JavascriptInterface
        public String cerrar(String id, boolean compartir) {
            Object[] a = abiertos.remove(id); if (a == null) return "error";
            try {
                ((OutputStream) a[0]).close();
                Uri u;
                if (a[1] instanceof Uri) {
                    u = (Uri) a[1];
                    ContentValues cv = new ContentValues(); cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(u, cv, null, null);
                } else u = null;
                final Uri fu = u; final String nombre = (String) a[2], mime = (String) a[3];
                runOnUiThread(() -> {
                    if (compartir && fu != null) {
                        Intent i = new Intent(Intent.ACTION_SEND); i.setType(mime);
                        i.putExtra(Intent.EXTRA_STREAM, fu); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, "Compartir " + nombre));
                    } else Toast.makeText(Principal.this, "Guardado en " + (fu != null ? (mime.startsWith("video/") ? "Películas" : mime.startsWith("image/") ? "Imágenes" : "Descargas") + "/Papuchon" : ((File) a[1]).getPath()), Toast.LENGTH_LONG).show();
                });
                return fu != null ? fu.toString() : ((File) a[1]).getPath();
            } catch (IOException e) { return "error:" + e.getMessage(); }
        }

        @JavascriptInterface
        public boolean puedeCompartir() { return Build.VERSION.SDK_INT >= 29; }
    }
}
