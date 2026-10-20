package ar.papuchon.miniaturas;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Miniaturas Papuchón como app: un WebView con la página adentro, más lo que la
 * página sola no puede hacer:
 *  - Rezona: su API solo acepta pedidos de páginas de rezona.ai (CORS), así que
 *    los hace Java. La llave vive acá (preferencias privadas de la app, o la que
 *    viene puesta al armar el APK) y nunca pasa por la página. Tope por día.
 *  - Conectar Rezona con el login por dispositivo: se aprueba un link y listo.
 *  - Guardar en Imágenes/Papuchon y compartir con el menú de Android.
 * La página se sirve con un origen https propio (appassets.androidplatform.net):
 * así tiene IndexedDB y el canvas se puede exportar.
 */
public class Principal extends Activity {
    static final String ORIGEN = "https://appassets.androidplatform.net/";
    static final String RZ_API = "https://lab.rezona.ai/game/pgcserver";
    static final String RZ_BIZ = "https://lab.rezona.ai/tln/biz/cli/authorizations";
    static final int ELEGIR = 1;

    WebView web;
    ValueCallback<Uri[]> alElegir;
    SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        prefs = getSharedPreferences("miniaturas", MODE_PRIVATE);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0f0f13"));
        w.setNavigationBarColor(Color.parseColor("#131318"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0f0f13"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return null;
                String ruta = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
                // Las imágenes de Rezona: se traen de su dirección pública y se sirven desde
                // nuestro origen, así el canvas no queda "contaminado" y se puede exportar.
                if (ruta.startsWith("rz-pv/")) return traerRezona(ruta.substring(6));
                try {
                    InputStream in = getAssets().open(ruta);
                    Map<String, String> cab = new HashMap<>();
                    cab.put("Cache-Control", "no-cache");
                    String t = tipo(ruta);
                    return new WebResourceResponse(t, t.startsWith("text/") ? "utf-8" : null, 200, "OK", cab, in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "No existe", new HashMap<>(), null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                abrir(u.toString());
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
                i.setType("image/*");
                try { startActivityForResult(Intent.createChooser(i, "Elegí una foto"), ELEGIR); }
                catch (Exception e) { alElegir = null; return false; }
                return true;
            }
        });

        web.addJavascriptInterface(new Puente(), "AndroidPapuchon");
        setContentView(web);
        if (guardado != null) web.restoreState(guardado); else web.loadUrl(ORIGEN + "index.html");
    }

    static String tipo(String ruta) {
        String r = ruta.toLowerCase(Locale.ROOT);
        if (r.endsWith(".html")) return "text/html";
        if (r.endsWith(".js") || r.endsWith(".mjs")) return "text/javascript";
        if (r.endsWith(".css")) return "text/css";
        if (r.endsWith(".json")) return "application/json";
        if (r.endsWith(".woff2")) return "font/woff2";
        if (r.endsWith(".png")) return "image/png";
        if (r.endsWith(".jpg") || r.endsWith(".jpeg")) return "image/jpeg";
        if (r.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    void abrir(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* sin navegador */ }
    }

    WebResourceResponse traerRezona(String resto) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(RZ_API + "/pv/" + resto).openConnection();
            c.setConnectTimeout(30000); c.setReadTimeout(120000);
            int codigo = c.getResponseCode();
            if (codigo != 200) return new WebResourceResponse("text/plain", "utf-8", codigo, "Rezona", new HashMap<>(), null);
            String t = c.getContentType() == null ? "image/png" : c.getContentType();
            return new WebResourceResponse(t, null, 200, "OK", new HashMap<>(), c.getInputStream());
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 502, "Rezona", new HashMap<>(), null);
        }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        if (pedido != ELEGIR || alElegir == null) { super.onActivityResult(pedido, resultado, datos); return; }
        Uri[] r = null;
        if (resultado == RESULT_OK && datos != null && datos.getData() != null) r = new Uri[]{datos.getData()};
        alElegir.onReceiveValue(r); alElegir = null;
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.epAtras && window.epAtras()) ? 'si' : 'no'", (r) -> {
            if (r == null || !r.contains("si")) Principal.super.onBackPressed();
        });
    }

    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    // ── Rezona ──
    String llaveRezona() {
        String t = prefs.getString("rz_token", "");
        return t.isEmpty() ? LlaveRezona.token() : t;
    }
    String hoy() { return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date()); }
    int usadosHoy() { return hoy().equals(prefs.getString("rz_dia", "")) ? prefs.getInt("rz_usados", 0) : 0; }
    void contarUno() { prefs.edit().putString("rz_dia", hoy()).putInt("rz_usados", usadosHoy() + 1).apply(); }

    /** {codigo, cuerpo} de un pedido HTTP. */
    static String[] http(String metodo, String url, String cuerpo, String llave) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod(metodo); c.setConnectTimeout(30000); c.setReadTimeout(90000);
            c.setRequestProperty("Accept", "application/json");
            if (llave != null && !llave.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + llave);
            if (cuerpo != null && !cuerpo.isEmpty()) {
                c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json");
                try (OutputStream o = c.getOutputStream()) { o.write(cuerpo.getBytes("UTF-8")); }
            }
            int codigo = c.getResponseCode();
            InputStream in = codigo >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            return new String[]{String.valueOf(codigo), b.toString("UTF-8")};
        } catch (Exception e) {
            return new String[]{"0", "{\"success\":false,\"code\":\"RED\",\"message\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}"};
        } finally { if (c != null) c.disconnect(); }
    }

    void aJS(String codigo) { runOnUiThread(() -> web.evaluateJavascript(codigo, null)); }

    /** Lo que la página le pide a Android. */
    class Puente {
        final Map<String, Object[]> abiertos = new HashMap<>();
        int siguiente = 0;

        @JavascriptInterface public boolean rezonaDisponible() { return !llaveRezona().isEmpty(); }

        @JavascriptInterface public String rezonaTope() {
            return "{\"usados\":" + usadosHoy() + ",\"tope\":" + LlaveRezona.TOPE + "}";
        }

        @JavascriptInterface
        public void rezonaPedir(String id, String metodo, String ruta, String cuerpo) {
            new Thread(() -> {
                String[] r;
                boolean genera = "POST".equals(metodo) && ruta.endsWith("/generations");
                if (genera && LlaveRezona.TOPE > 0 && usadosHoy() >= LlaveRezona.TOPE) {
                    r = new String[]{"429", "{\"success\":false,\"code\":\"TOPE_DIARIO\",\"message\":\"Tope del día\"}"};
                } else {
                    r = http(metodo, RZ_API + ruta, cuerpo, llaveRezona());
                    if (genera && r[1].contains("\"success\":true")) contarUno();
                }
                aJS("window.__rz&&window.__rz(" + JSONObject.quote(id) + "," + r[0] + "," + JSONObject.quote(r[1]) + ")");
            }).start();
        }

        /** Login por dispositivo: pide un código, avisa el link y espera la aprobación. */
        @JavascriptInterface
        public void rezonaConectar() {
            new Thread(() -> {
                try {
                    JSONObject pedido = new JSONObject().put("client_name", "rezona-cli").put("device_name", "miniaturas-papuchon-" + Build.MODEL);
                    String[] r = http("POST", RZ_BIZ, pedido.toString(), null);
                    JSONObject d = new JSONObject(r[1]).optJSONObject("data");
                    if (d == null || d.optString("code").isEmpty()) { avisarConexion("error", "Rezona no respondió (" + r[0] + ")", null); return; }
                    String url = d.optString("verification_url"), code = d.optString("code"), secreto = d.optString("authorization_secret");
                    long intervalo = (long) (d.optDouble("poll_interval", 3) * 1000), fin = System.currentTimeMillis() + 9 * 60 * 1000;
                    avisarConexion("esperando", null, url);
                    while (System.currentTimeMillis() < fin) {
                        Thread.sleep(intervalo);
                        String[] p = http("POST", RZ_BIZ + "/poll", new JSONObject().put("code", code).put("authorization_secret", secreto).toString(), null);
                        JSONObject pd = null; try { pd = new JSONObject(p[1]).optJSONObject("data"); } catch (Exception e) { /* sigue */ }
                        String token = pd == null ? "" : pd.optString("token");
                        if ("200".equals(p[0]) && !token.isEmpty()) { prefs.edit().putString("rz_token", token).apply(); avisarConexion("listo", null, null); return; }
                        String est = pd == null ? "" : pd.optString("status");
                        if ("403".equals(p[0]) || "410".equals(p[0]) || est.matches("denied|rejected|revoked|expired|consumed")) { avisarConexion("error", "No se aprobó (" + (est.isEmpty() ? p[0] : est) + "). Probá de nuevo.", null); return; }
                    }
                    avisarConexion("error", "Pasaron 9 minutos sin aprobar. Tocá Conectar otra vez.", null);
                } catch (Exception e) { avisarConexion("error", String.valueOf(e.getMessage()), null); }
            }).start();
        }
        void avisarConexion(String estado, String texto, String url) {
            try {
                JSONObject o = new JSONObject().put("estado", estado);
                if (texto != null) o.put("texto", texto);
                if (url != null) o.put("url", url);
                aJS("window.__rzConexion&&window.__rzConexion(" + o + ")");
            } catch (Exception e) { /* no pasa */ }
        }
        @JavascriptInterface public void rezonaDesconectar() { prefs.edit().remove("rz_token").apply(); }

        @JavascriptInterface public void abrirLink(String url) { runOnUiThread(() -> Principal.this.abrir(url)); }
        @JavascriptInterface
        public void compartirTexto(String texto) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, texto);
                startActivity(Intent.createChooser(i, "Mandar el link"));
            });
        }

        // ── Guardar y compartir (el archivo llega en pedazos base64) ──
        @JavascriptInterface
        public String abrir(String nombre, String mime) {
            try {
                String id = "a" + (++siguiente);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Papuchon");
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
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
                Uri u = null;
                if (a[1] instanceof Uri) {
                    u = (Uri) a[1];
                    ContentValues cv = new ContentValues(); cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(u, cv, null, null);
                }
                final Uri fu = u; final String nombre = (String) a[2], mime = (String) a[3];
                runOnUiThread(() -> {
                    if (compartir && fu != null) {
                        Intent i = new Intent(Intent.ACTION_SEND); i.setType(mime);
                        i.putExtra(Intent.EXTRA_STREAM, fu); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, "Compartir " + nombre));
                    } else Toast.makeText(Principal.this, "Guardada en Imágenes/Papuchon", Toast.LENGTH_LONG).show();
                });
                return fu != null ? fu.toString() : ((File) a[1]).getPath();
            } catch (IOException e) { return "error:" + e.getMessage(); }
        }

        @JavascriptInterface public boolean puedeCompartir() { return Build.VERSION.SDK_INT >= 29; }
    }
}
