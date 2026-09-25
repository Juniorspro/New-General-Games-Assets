package com.juniorspro.mundoarweb;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * Mundo AR Web: la misma página que se hostea (web/index.html), metida en un
 * WebView. Sirve para probar el 6DoF "de página" dentro de una app.
 *
 * LO QUE EL WEBVIEW NO TRAE. WebXR: una página adentro de una app no le puede
 * pedir poses a ARCore. Por eso la página, al verse en un WebView, elige sola
 * el SLAM por cámara (AlvaAR, en WebAssembly).
 *
 * LO QUE HAY QUE DARLE A MANO:
 *  - la cámara: el WebView no muestra el cartel de permiso, le pregunta a la
 *    app (onPermissionRequest), y la app a Android;
 *  - un origen https: getUserMedia sólo anda en un "contexto seguro". La
 *    página se pide a https://appassets.androidplatform.net/ (el dominio que
 *    Android reserva para esto, el de WebViewAssetLoader) y la app contesta
 *    con los assets: nunca sale a la red, y recargar anda;
 *  - reproducir el video de la cámara sin un toque previo;
 *  - la pantalla acostada y completa (el WebView no deja a la página
 *    bloquear la orientación: lo fija el manifiesto).
 */
public class Principal extends Activity {
    private static final int PERMISO_CAMARA = 7;
    /** El origen de la página: lo contesta la app desde sus assets. */
    private static final String HOST = "appassets.androidplatform.net";

    private WebView web;
    private PermissionRequest pendiente;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Para mirar la consola desde chrome://inspect con el teléfono enchufado.
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7, 3, 15));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // localStorage: el campo de la cámara elegido
        s.setMediaPlaybackRequiresUserGesture(false); // el <video> de la cámara arranca solo
        s.setCacheMode(WebSettings.LOAD_DEFAULT);     // three y AlvaAR quedan en caché: después abre sin red
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.setWebViewClient(new Paginas(this));
        web.setWebChromeClient(new Permisos(this));
        setContentView(web);

        // El permiso se pide de entrada: así, cuando la página abre la cámara, ya está.
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.CAMERA }, PERMISO_CAMARA);
        }
        web.loadUrl("https://" + HOST + "/index.html");
    }

    /** La página pide cámara: si Android ya la dio, se da; si no, se pregunta y se contesta después. */
    void atender(PermissionRequest pedido) {
        boolean camara = false;
        for (String r : pedido.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) camara = true;
        }
        if (!camara) { pedido.deny(); return; }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            pedido.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        } else {
            if (pendiente != null) pendiente.deny();
            pendiente = pedido;
            requestPermissions(new String[] { Manifest.permission.CAMERA }, PERMISO_CAMARA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        if (codigo != PERMISO_CAMARA || pendiente == null) return;
        boolean si = resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED;
        if (si) pendiente.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        else pendiente.deny();
        pendiente = null;
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) {
            // Pantalla completa "pegajosa": las barras vuelven sólo si se desliza desde el borde.
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // "Atrás" en el juego vuelve al menú de modos (la página se recarga); en el menú, sale.
        web.evaluateJavascript("document.getElementById('inicio').hidden", (v) -> {
            if ("true".equals(v)) web.reload();
            else finish();
        });
    }

    // Clases estáticas y no anónimas a propósito: javac 21 les pone a las
    // anónimas un atributo MethodParameters que el d8 de build-tools 34 no lee.

    /** Contesta los pedidos a appassets.androidplatform.net con los assets de la app. */
    static final class Paginas extends WebViewClient {
        private final Activity act;
        Paginas(Activity a) { act = a; }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest pedido) {
            Uri u = pedido.getUrl();
            if (!HOST.equals(u.getHost())) return null;   // three y AlvaAR: a la red, como siempre
            String ruta = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
            try {
                InputStream in = act.getAssets().open(ruta);
                String tipo = ruta.endsWith(".html") ? "text/html" : ruta.endsWith(".js") ? "text/javascript" : "application/octet-stream";
                return new WebResourceResponse(tipo, "utf-8", in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "No está", null, null);
            }
        }
    }

    /** Los permisos que pide la página (la cámara) y su consola, al logcat. */
    static final class Permisos extends WebChromeClient {
        private final Principal act;
        Permisos(Principal a) { act = a; }

        @Override
        public void onPermissionRequest(final PermissionRequest pedido) {
            act.runOnUiThread(() -> act.atender(pedido));
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest pedido) {
            if (act.pendiente == pedido) act.pendiente = null;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.i("MundoARWeb", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }
    }
}
