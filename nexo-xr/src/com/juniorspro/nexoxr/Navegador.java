package com.juniorspro.nexoxr;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

/**
 * EL NAVEGADOR: un navegador de verdad (el WebView de Android) en una ventana:
 * atrás, adelante, recargar, la dirección (con el teclado del sistema), el
 * inicio con accesos directos, y el video a pantalla completa adentro de la
 * ventana (con AMPLIAR, modo cine).
 */
final class Navegador {
    WebView web;
    private EditText direccion;
    private ProgressBar carga;
    private FrameLayout raiz;
    private View completa;

    static final String INICIO = "about:nexo";

    @SuppressLint("SetJavaScriptEnabled")
    View crear(Context c, Sistema s, String url) {
        raiz = new FrameLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        // la barra de arriba
        LinearLayout barra = new LinearLayout(c);
        barra.setGravity(Gravity.CENTER_VERTICAL);
        barra.setBackgroundColor(Estilo.PANEL);
        int p = Estilo.dp(c, 8);
        barra.setPadding(p, p, p, p);
        barra.addView(Estilo.botonIcono(c, Iconos.ATRAS, 44, v -> { if (web.canGoBack()) web.goBack(); }));
        barra.addView(Estilo.botonIcono(c, Iconos.ADELANTE, 44, v -> { if (web.canGoForward()) web.goForward(); }));
        barra.addView(Estilo.botonIcono(c, Iconos.RECARGAR, 44, v -> web.reload()));
        direccion = new EditText(c);
        direccion.setSingleLine(true);
        direccion.setTextSize(15);
        direccion.setTextColor(Estilo.TEXTO);
        direccion.setHintTextColor(Estilo.TEXTO2);
        direccion.setHint("Buscá o escribí una dirección");
        direccion.setBackground(Estilo.forma(Estilo.TARJETA, Estilo.dp(c, 20)));
        direccion.setPadding(Estilo.dp(c, 16), Estilo.dp(c, 8), Estilo.dp(c, 16), Estilo.dp(c, 8));
        direccion.setShowSoftInputOnFocus(false);   // el teclado es el del sistema, en el espacio
        direccion.setImeOptions(EditorInfo.IME_ACTION_GO);
        direccion.setSelectAllOnFocus(true);
        direccion.setOnFocusChangeListener((v, f) -> { if (f) s.mostrarTeclado(true); });
        direccion.setOnKeyListener((v, k, e) -> {
            if (k == KeyEvent.KEYCODE_ENTER && e.getAction() == KeyEvent.ACTION_UP) { ir(direccion.getText().toString()); s.mostrarTeclado(false); web.requestFocus(); return true; }
            return k == KeyEvent.KEYCODE_ENTER;
        });
        direccion.setOnEditorActionListener((v, a, e) -> { ir(direccion.getText().toString()); s.mostrarTeclado(false); web.requestFocus(); return true; });
        LinearLayout.LayoutParams ld = new LinearLayout.LayoutParams(0, Estilo.dp(c, 42), 1);
        ld.leftMargin = Estilo.dp(c, 8); ld.rightMargin = Estilo.dp(c, 8);
        barra.addView(direccion, ld);
        barra.addView(Estilo.botonIcono(c, Iconos.TECLADO, 44, v -> s.mostrarTeclado(true)));
        barra.addView(Estilo.botonIcono(c, Iconos.CASA, 44, v -> ir(INICIO)));
        col.addView(barra);
        carga = new ProgressBar(c, null, android.R.attr.progressBarStyleHorizontal);
        carga.setMax(100);
        carga.setProgressTintList(android.content.res.ColorStateList.valueOf(Estilo.AZUL));
        col.addView(carga, new LinearLayout.LayoutParams(-1, Estilo.dp(c, 3)));
        // la página
        web = new WebView(c);
        WebSettings w = web.getSettings();
        w.setJavaScriptEnabled(true);
        w.setDomStorageEnabled(true);
        w.setMediaPlaybackRequiresUserGesture(false);
        w.setUseWideViewPort(true);
        w.setLoadWithOverviewMode(true);
        w.setSupportZoom(true);
        w.setBuiltInZoomControls(true);
        w.setDisplayZoomControls(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                return !(u.startsWith("http") || u.startsWith("about") || u.startsWith("data"));   // otras apps (intent://, market://): no
            }
            @Override public void onPageStarted(WebView v, String u, Bitmap f) { if (!direccion.hasFocus()) direccion.setText(bonita(u)); carga.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView v, String u) { if (!direccion.hasFocus()) direccion.setText(bonita(u)); carga.setVisibility(View.INVISIBLE); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int n) { carga.setProgress(n); }
            @Override public void onShowCustomView(View v, CustomViewCallback cb) {
                completa = v;
                raiz.addView(v, new FrameLayout.LayoutParams(-1, -1));
            }
            @Override public void onHideCustomView() {
                if (completa != null) raiz.removeView(completa);
                completa = null;
            }
        });
        col.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        raiz.addView(col, new FrameLayout.LayoutParams(-1, -1));
        ir(url == null ? INICIO : url);
        return raiz;
    }

    static String bonita(String u) {
        if (u == null || u.startsWith("data:") || u.startsWith("about:")) return "";
        return u.replaceFirst("^https?://(www\\.)?", "");
    }

    void ir(String t) {
        t = t == null ? "" : t.trim();
        if (t.isEmpty() || t.equals(INICIO)) { web.loadDataWithBaseURL("https://nexo.local/", inicio(), "text/html", "utf-8", null); return; }
        String u;
        if (t.matches("^[a-zA-Z]+://.*")) u = t;
        else if (!t.contains(" ") && t.contains(".")) u = "https://" + t;
        else u = "https://www.google.com/search?q=" + android.net.Uri.encode(t);
        web.loadUrl(u);
    }

    /** La página de inicio: buscar y accesos directos. */
    static String inicio() {
        String[][] accesos = {{"YouTube", "https://m.youtube.com", "#ff3d3d", "▶"}, {"Google", "https://www.google.com", "#4285f4", "G"},
                {"Wikipedia", "https://es.wikipedia.org", "#8a8f9e", "W"}, {"Mapas", "https://www.google.com/maps", "#2ea55a", "◉"},
                {"Twitch", "https://m.twitch.tv", "#9146ff", "◆"}, {"Noticias", "https://news.google.com", "#f1a33b", "N"},
                {"Música", "https://music.youtube.com", "#ff5b8a", "♪"}, {"Clima", "https://www.google.com/search?q=clima", "#35b6e8", "☀"}};
        StringBuilder b = new StringBuilder();
        b.append("<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'><style>")
                .append("body{margin:0;background:radial-gradient(circle at 50% -20%,#2b3a66,#15161b 60%);color:#edeef3;font-family:sans-serif;min-height:100vh}")
                .append(".c{max-width:640px;margin:0 auto;padding:56px 24px;text-align:center}h1{font-weight:500;font-size:40px;margin:0 0 28px;letter-spacing:.5px}")
                .append("form{display:flex;background:#2a2b34;border-radius:28px;padding:6px 8px 6px 22px}input{flex:1;background:none;border:0;color:#edeef3;font-size:19px;outline:0}")
                .append("button{background:#3d7bff;border:0;color:#fff;border-radius:22px;font-size:17px;padding:10px 20px}")
                .append(".g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:40px}a{color:#edeef3;text-decoration:none;font-size:14px}")
                .append(".i{width:66px;height:66px;border-radius:20px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff}")
                .append("</style></head><body><div class=c><h1>Nexo</h1><form action='https://www.google.com/search'><input name=q placeholder='Buscar en la web' autocomplete=off><button>Buscar</button></form><div class=g>");
        for (String[] a : accesos)
            b.append("<a href='").append(a[1]).append("'><div class=i style='background:").append(a[2]).append("'>").append(a[3]).append("</div>").append(a[0]).append("</a>");
        b.append("</div></div></body></html>");
        return b.toString();
    }
}
