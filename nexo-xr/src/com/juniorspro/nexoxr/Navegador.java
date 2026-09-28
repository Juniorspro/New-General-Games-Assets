package com.juniorspro.nexoxr;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Environment;
import android.os.Message;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * EL NAVEGADOR: la web de verdad (el WebView de Android) en una ventana.
 *
 *  - PESTAÑAS (hasta 6): la tira de arriba, "+" para una nueva, ✕ para
 *    cerrarla; las páginas que abren otra ventana abren una pestaña;
 *  - atrás, adelante, recargar, la dirección (con el teclado del sistema, en
 *    el espacio), el MODO ESCRITORIO (la versión de computadora), AGREGAR A
 *    APPS (la página queda como una app en la biblioteca), inicio;
 *  - el inicio: buscar y las apps web (el catálogo y las tuyas);
 *  - el video a pantalla completa adentro de la ventana (con ⤢, modo cine);
 *  - las descargas van a Descargas; las sesiones (cookies) se guardan.
 *
 * MODO APP: una app web en su propia ventana (WhatsApp, YouTube, Gmail…):
 * sin pestañas ni dirección, con su nombre arriba.
 */
final class Navegador {
    static final String INICIO = "about:nexo";
    static final int MAX_PESTANAS = 6;

    /** Una pestaña: su página y lo que se muestra de ella. */
    final class Pestana {
        WebView web;
        String titulo = "Nueva pestaña", url = "";
        Bitmap icono;
        boolean escritorio;
        View completa;
        LinearLayout chip;
        TextView chipTexto;
        ImageView chipIcono;
    }

    private final ArrayList<Pestana> pestanas = new ArrayList<>();
    private Pestana actual;
    /** La web de la pestaña de adelante (para quien la pida de afuera). */
    WebView web;
    private Context c;
    private Sistema s;
    private FrameLayout raiz, paginas;
    private LinearLayout tira;
    private EditText direccion;
    private TextView titulo;
    private ProgressBar carga;
    private Iconos icEscritorio;
    private AppsWeb.App app;

    // ── las apps web tuyas (guardadas) ──

    static List<AppsWeb.App> tuyas(Context c) {
        return AppsWeb.leer(c.getSharedPreferences("apps-web", Context.MODE_PRIVATE).getString("lista", ""));
    }

    static void guardar(Context c, List<AppsWeb.App> l) {
        SharedPreferences.Editor e = c.getSharedPreferences("apps-web", Context.MODE_PRIVATE).edit();
        e.putString("lista", AppsWeb.serializar(l)).apply();
    }

    // ───────────────────────── armar ─────────────────────────

    /** El navegador (con pestañas). */
    View crear(Context ctx, Sistema sis, String url) {
        c = ctx;
        s = sis;
        armar(false);
        nueva(url == null ? INICIO : url, false);
        return raiz;
    }

    /** Una app web en su ventana. */
    View crearApp(Context ctx, Sistema sis, AppsWeb.App a) {
        c = ctx;
        s = sis;
        app = a;
        armar(true);
        nueva(a.url, a.escritorio);
        return raiz;
    }

    private void armar(boolean modoApp) {
        raiz = new FrameLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        if (!modoApp) {
            // la tira de pestañas
            LinearLayout fila = new LinearLayout(c);
            fila.setGravity(Gravity.CENTER_VERTICAL);
            fila.setBackgroundColor(0xFF121318);
            fila.setPadding(Estilo.dp(c, 6), Estilo.dp(c, 5), Estilo.dp(c, 6), 0);
            HorizontalScrollView hs = new HorizontalScrollView(c);
            hs.setHorizontalScrollBarEnabled(false);
            tira = new LinearLayout(c);
            tira.setGravity(Gravity.CENTER_VERTICAL);
            hs.addView(tira);
            fila.addView(hs, new LinearLayout.LayoutParams(0, -2, 1));
            fila.addView(Estilo.botonIcono(c, Iconos.MAS, 34, v -> { s.sonido(Sonido.CLIC); nueva(INICIO, false); }));
            col.addView(fila);
        }
        // la barra
        LinearLayout barra = new LinearLayout(c);
        barra.setGravity(Gravity.CENTER_VERTICAL);
        barra.setBackgroundColor(Estilo.PANEL);
        int p = Estilo.dp(c, 6);
        barra.setPadding(p, p, p, p);
        barra.addView(Estilo.botonIcono(c, Iconos.ATRAS, 42, v -> { if (actual != null && actual.web.canGoBack()) actual.web.goBack(); }));
        if (!modoApp) barra.addView(Estilo.botonIcono(c, Iconos.ADELANTE, 42, v -> { if (actual != null && actual.web.canGoForward()) actual.web.goForward(); }));
        barra.addView(Estilo.botonIcono(c, Iconos.RECARGAR, 42, v -> { if (actual != null) actual.web.reload(); }));
        if (modoApp) {
            LinearLayout t = new LinearLayout(c);
            t.setGravity(Gravity.CENTER_VERTICAL);
            TextView ini = Estilo.texto(c, app.inicial(), 15, 0xFFFFFFFF, true);
            ini.setGravity(Gravity.CENTER);
            ini.setBackground(Estilo.forma(app.color, Estilo.dp(c, 8)));
            t.addView(ini, new LinearLayout.LayoutParams(Estilo.dp(c, 28), Estilo.dp(c, 28)));
            titulo = Estilo.texto(c, app.nombre, 16, Estilo.TEXTO, true);
            titulo.setPadding(Estilo.dp(c, 10), 0, 0, 0);
            titulo.setSingleLine(true);
            titulo.setEllipsize(TextUtils.TruncateAt.END);
            t.addView(titulo, new LinearLayout.LayoutParams(0, -2, 1));
            LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(0, -2, 1);
            lt.leftMargin = Estilo.dp(c, 8);
            barra.addView(t, lt);
        } else {
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
                if (k == KeyEvent.KEYCODE_ENTER && e.getAction() == KeyEvent.ACTION_UP) { irDesdeDireccion(); return true; }
                return k == KeyEvent.KEYCODE_ENTER;
            });
            direccion.setOnEditorActionListener((v, a, e) -> { irDesdeDireccion(); return true; });
            LinearLayout.LayoutParams ld = new LinearLayout.LayoutParams(0, Estilo.dp(c, 40), 1);
            ld.leftMargin = Estilo.dp(c, 6); ld.rightMargin = Estilo.dp(c, 6);
            barra.addView(direccion, ld);
        }
        // modo escritorio
        android.widget.FrameLayout be = Estilo.botonIcono(c, Iconos.ESCRITORIO, 42, v -> {
            if (actual == null) return;
            s.sonido(Sonido.CLIC);
            ponerEscritorio(actual, !actual.escritorio);
            actual.web.reload();
            s.avisar(actual.escritorio ? "Modo escritorio: la versión de computadora" : "La versión de celular");
        });
        icEscritorio = (Iconos) ((ImageView) be.getChildAt(0)).getDrawable();
        barra.addView(be);
        if (!modoApp) barra.addView(Estilo.botonIcono(c, Iconos.ESTRELLA, 42, v -> { s.sonido(Sonido.CLIC); agregarAApps(); }));
        barra.addView(Estilo.botonIcono(c, Iconos.TECLADO, 42, v -> s.mostrarTeclado(true)));
        if (!modoApp) barra.addView(Estilo.botonIcono(c, Iconos.CASA, 42, v -> ir(INICIO)));
        col.addView(barra);
        carga = new ProgressBar(c, null, android.R.attr.progressBarStyleHorizontal);
        carga.setMax(100);
        carga.setProgressTintList(android.content.res.ColorStateList.valueOf(Estilo.AZUL));
        col.addView(carga, new LinearLayout.LayoutParams(-1, Estilo.dp(c, 3)));
        paginas = new FrameLayout(c);
        col.addView(paginas, new LinearLayout.LayoutParams(-1, 0, 1));
        raiz.addView(col, new FrameLayout.LayoutParams(-1, -1));
        raiz.addOnAttachStateChangeListener(new AlCerrar(this));
        CookieManager.getInstance().setAcceptCookie(true);
    }

    /** Al cerrarse la ventana: se guardan las sesiones y se sueltan las páginas (pesan). */
    private static final class AlCerrar implements View.OnAttachStateChangeListener {
        private final Navegador n;
        AlCerrar(Navegador n) { this.n = n; }
        @Override public void onViewAttachedToWindow(View v) { }
        @Override public void onViewDetachedFromWindow(View v) {
            try { CookieManager.getInstance().flush(); } catch (Throwable ignorada) { }
            for (Pestana p : n.pestanas) try { p.web.destroy(); } catch (Throwable ignorada) { }
            n.pestanas.clear();
        }
    }

    private void irDesdeDireccion() {
        ir(direccion.getText().toString());
        s.mostrarTeclado(false);
        if (actual != null) actual.web.requestFocus();
    }

    // ───────────────────────── las pestañas ─────────────────────────

    /** Una pestaña nueva (adelante). Devuelve su página. */
    @SuppressLint("SetJavaScriptEnabled")
    private Pestana nueva(String url, boolean escritorio) {
        if (pestanas.size() >= MAX_PESTANAS) cerrar(pestanas.get(0));
        Pestana p = new Pestana();
        p.escritorio = escritorio;
        WebView w = new WebView(c);
        p.web = w;
        WebSettings st = w.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setDatabaseEnabled(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setSupportZoom(true);
        st.setBuiltInZoomControls(true);
        st.setDisplayZoomControls(false);
        st.setSupportMultipleWindows(true);
        st.setJavaScriptCanOpenWindowsAutomatically(true);
        ponerEscritorio(p, escritorio);
        try { CookieManager.getInstance().setAcceptThirdPartyCookies(w, true); } catch (Throwable ignorada) { }
        w.setWebViewClient(new Cliente(p));
        w.setWebChromeClient(new Cromo(p));
        w.setDownloadListener(new Bajar(w));
        paginas.addView(w, new FrameLayout.LayoutParams(-1, -1));
        pestanas.add(p);
        if (tira != null) chip(p);
        mostrar(p);
        if (url != null) cargar(p, url);
        return p;
    }

    private void chip(Pestana p) {
        LinearLayout ch = new LinearLayout(c);
        ch.setGravity(Gravity.CENTER_VERTICAL);
        ch.setPadding(Estilo.dp(c, 10), Estilo.dp(c, 4), Estilo.dp(c, 4), Estilo.dp(c, 4));
        p.chipIcono = new ImageView(c);
        p.chipIcono.setImageDrawable(new Iconos(Iconos.WEB, Estilo.TEXTO2));
        ch.addView(p.chipIcono, new LinearLayout.LayoutParams(Estilo.dp(c, 16), Estilo.dp(c, 16)));
        p.chipTexto = Estilo.texto(c, p.titulo, 12, Estilo.TEXTO, false);
        p.chipTexto.setSingleLine(true);
        p.chipTexto.setEllipsize(TextUtils.TruncateAt.END);
        p.chipTexto.setPadding(Estilo.dp(c, 6), 0, Estilo.dp(c, 2), 0);
        ch.addView(p.chipTexto, new LinearLayout.LayoutParams(Estilo.dp(c, 104), -2));
        ch.addView(Estilo.botonIcono(c, Iconos.CERRAR, 26, v -> { s.sonido(Sonido.CLIC); cerrar(p); }));
        ch.setClickable(true);
        ch.setOnClickListener(v -> { s.sonido(Sonido.CLIC); mostrar(p); });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, Estilo.dp(c, 34));
        lp.rightMargin = Estilo.dp(c, 4);
        tira.addView(ch, lp);
        p.chip = ch;
    }

    private void mostrar(Pestana p) {
        actual = p;
        web = p.web;
        for (Pestana q : pestanas) {
            q.web.setVisibility(q == p ? View.VISIBLE : View.GONE);
            if (q.completa != null) q.completa.setVisibility(q == p ? View.VISIBLE : View.GONE);
            if (q.chip != null) q.chip.setBackground(Estilo.forma(q == p ? Estilo.TARJETA_ALTA : Estilo.TARJETA, Estilo.dp(c, 10)));
        }
        if (direccion != null && !direccion.hasFocus()) direccion.setText(bonita(p.url));
        if (icEscritorio != null) icEscritorio.color(p.escritorio ? Estilo.AZUL_CLARO : Estilo.TEXTO);
        carga.setVisibility(View.INVISIBLE);
    }

    private void cerrar(Pestana p) {
        int i = pestanas.indexOf(p);
        if (i < 0) return;
        pestanas.remove(i);
        paginas.removeView(p.web);
        if (p.completa != null) raiz.removeView(p.completa);
        if (p.chip != null) tira.removeView(p.chip);
        try { p.web.destroy(); } catch (Throwable ignorada) { }
        if (pestanas.isEmpty()) { nueva(INICIO, false); return; }
        if (actual == p) mostrar(pestanas.get(Math.max(0, i - 1)));
    }

    private void ponerEscritorio(Pestana p, boolean si) {
        p.escritorio = si;
        WebSettings st = p.web.getSettings();
        st.setUserAgentString(si ? AppsWeb.UA_ESCRITORIO : null);
        if (p == actual && icEscritorio != null) icEscritorio.color(si ? Estilo.AZUL_CLARO : Estilo.TEXTO);
    }

    // ───────────────────────── ir ─────────────────────────

    static String bonita(String u) {
        if (u == null || u.startsWith("data:") || u.startsWith("about:") || u.startsWith("https://nexo.local")) return "";
        return u.replaceFirst("^https?://(www\\.)?", "");
    }

    /** A una dirección o una búsqueda, en la pestaña de adelante. */
    void ir(String t) {
        if (actual == null) return;
        cargar(actual, t);
    }

    private void cargar(Pestana p, String t) {
        t = t == null ? "" : t.trim();
        if (t.isEmpty() || t.equals(INICIO)) {
            p.url = "";
            p.titulo = "Nexo";
            p.web.loadDataWithBaseURL("https://nexo.local/", inicio(tuyas(c)), "text/html", "utf-8", null);
            return;
        }
        String u;
        if (t.matches("^[a-zA-Z]+://.*")) u = t;
        else if (!t.contains(" ") && t.contains(".")) u = "https://" + t;
        else u = "https://www.google.com/search?q=" + Uri.encode(t);
        p.web.loadUrl(u);
    }

    /** "Agregar a Apps": la página de adelante queda como una app en la biblioteca. */
    private void agregarAApps() {
        Pestana p = actual;
        if (p == null || p.url.isEmpty() || !p.url.startsWith("http")) { s.avisar("Abrí una página para agregarla a Apps"); return; }
        String nombre = p.titulo == null ? "" : p.titulo.split(" [-|·—:] ")[0].trim();
        if (nombre.isEmpty() || nombre.length() > 18) nombre = AppsWeb.nombreDe(p.url);
        int color = p.icono != null ? colorDe(p.icono) : AppsWeb.colorDe(p.url);
        List<AppsWeb.App> l = AppsWeb.agregar(tuyas(c), new AppsWeb.App(nombre, p.url, color, p.escritorio));
        guardar(c, l);
        s.avisar("\"" + nombre + "\" quedó en Apps: se abre en su propia ventana");
    }

    /** El color de un ícono (el promedio de lo que no es blanco, gris ni transparente). */
    private static int colorDe(Bitmap b) {
        try {
            Bitmap m = Bitmap.createScaledBitmap(b, 12, 12, true);
            long r = 0, g = 0, bl = 0, n = 0;
            for (int y = 0; y < 12; y++) for (int x = 0; x < 12; x++) {
                int px = m.getPixel(x, y);
                int a = px >>> 24, pr = (px >> 16) & 255, pg = (px >> 8) & 255, pb = px & 255;
                int mx = Math.max(pr, Math.max(pg, pb)), mn = Math.min(pr, Math.min(pg, pb));
                if (a < 128 || mx - mn < 40) continue;
                r += pr; g += pg; bl += pb; n++;
            }
            if (n == 0) return AppsWeb.colorDe("x");
            return 0xFF000000 | (int) (r / n * 0.85) << 16 | (int) (g / n * 0.85) << 8 | (int) (bl / n * 0.85);
        } catch (Throwable e) { return AppsWeb.colorDe("x"); }
    }

    // ───────────────────────── lo que pasa en cada página ─────────────────────────

    private final class Cliente extends WebViewClient {
        private final Pestana p;
        Cliente(Pestana p) { this.p = p; }

        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            String u = r.getUrl().toString();
            // otras apps (intent://, market://, whatsapp://): no
            return !(u.startsWith("http") || u.startsWith("about") || u.startsWith("data") || u.startsWith("blob") || u.startsWith("javascript"));
        }

        @Override public void onPageStarted(WebView v, String u, Bitmap f) {
            p.url = u == null || u.startsWith("https://nexo.local") ? "" : u;
            if (p == actual) {
                if (direccion != null && !direccion.hasFocus()) direccion.setText(bonita(p.url));
                carga.setVisibility(View.VISIBLE);
            }
        }

        @Override public void onPageFinished(WebView v, String u) {
            if (p == actual) {
                if (direccion != null && !direccion.hasFocus()) direccion.setText(bonita(p.url));
                carga.setVisibility(View.INVISIBLE);
            }
        }
    }

    private final class Cromo extends WebChromeClient {
        private final Pestana p;
        Cromo(Pestana p) { this.p = p; }

        @Override public void onProgressChanged(WebView v, int n) { if (p == actual) carga.setProgress(n); }

        @Override public void onReceivedTitle(WebView v, String t) {
            p.titulo = t == null || t.isEmpty() || t.startsWith("https://nexo.local") ? "Nexo" : t;
            if (p.chipTexto != null) p.chipTexto.setText(p.titulo);
            if (titulo != null && app != null) titulo.setText(app.nombre + (t == null || t.isEmpty() ? "" : "  ·  " + t));
        }

        @Override public void onReceivedIcon(WebView v, Bitmap icono) {
            p.icono = icono;
            if (p.chipIcono != null) p.chipIcono.setImageBitmap(icono);
        }

        @Override public void onShowCustomView(View v, CustomViewCallback cb) {
            p.completa = v;
            raiz.addView(v, new FrameLayout.LayoutParams(-1, -1));
        }

        @Override public void onHideCustomView() {
            if (p.completa != null) raiz.removeView(p.completa);
            p.completa = null;
        }

        /** Una página que abre otra ventana (un enlace con target=_blank): una pestaña nueva. */
        @Override public boolean onCreateWindow(WebView v, boolean dialogo, boolean gesto, Message resultado) {
            if (tira == null) {
                // en una app web no hay pestañas: el enlace se abre en el navegador (su ventana)
                WebView atrapa = new WebView(c);
                atrapa.setWebViewClient(new Atrapar(s));
                WebView.WebViewTransport tr = (WebView.WebViewTransport) resultado.obj;
                tr.setWebView(atrapa);
                resultado.sendToTarget();
                return true;
            }
            Pestana n = nueva(null, p.escritorio);
            WebView.WebViewTransport tr = (WebView.WebViewTransport) resultado.obj;
            tr.setWebView(n.web);
            resultado.sendToTarget();
            return true;
        }

        @Override public void onCloseWindow(WebView v) { if (tira != null) cerrar(p); }

        /** El contenido protegido (videos con DRM) sí; la cámara y el micrófono no (la cámara la usa el seguimiento). */
        @Override public void onPermissionRequest(PermissionRequest r) {
            ArrayList<String> ok = new ArrayList<>();
            for (String q : r.getResources()) if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(q)) ok.add(q);
            if (ok.isEmpty()) r.deny();
            else r.grant(ok.toArray(new String[0]));
        }
    }

    /** La "ventana nueva" de una app web: su primera dirección va al navegador, y se suelta. */
    private static final class Atrapar extends WebViewClient {
        private final Sistema s;
        Atrapar(Sistema s) { this.s = s; }
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            String u = r.getUrl().toString();
            if (u.startsWith("http")) s.abrirUrl(u);
            v.post(v::destroy);
            return true;
        }
    }

    /** Las descargas: a Descargas, con el aviso del teléfono. */
    private final class Bajar implements DownloadListener {
        private final WebView w;
        Bajar(WebView w) { this.w = w; }

        @Override public void onDownloadStart(String url, String agente, String disposicion, String tipo, long largo) {
            try {
                String nombre = URLUtil.guessFileName(url, disposicion, tipo);
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                r.setMimeType(tipo);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) r.addRequestHeader("Cookie", cookies);
                r.addRequestHeader("User-Agent", agente);
                r.setTitle(nombre);
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nombre);
                DownloadManager dm = (DownloadManager) c.getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(r);
                s.avisar("Bajando \"" + nombre + "\" a Descargas");
            } catch (Throwable e) {
                s.avisar("No se pudo bajar: " + e.getMessage());
            }
        }
    }

    // ───────────────────────── el inicio ─────────────────────────

    /** La página de inicio: buscar, las apps web (el catálogo) y las tuyas. */
    static String inicio(List<AppsWeb.App> tuyas) {
        StringBuilder b = new StringBuilder();
        b.append("<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'><style>")
                .append("body{margin:0;background:radial-gradient(circle at 50% -20%,#2b3a66,#15161b 60%);color:#edeef3;font-family:sans-serif;min-height:100vh}")
                .append(".c{max-width:760px;margin:0 auto;padding:44px 24px;text-align:center}h1{font-weight:600;font-size:38px;margin:0 0 24px;letter-spacing:.5px}")
                .append("form{display:flex;background:#2a2b34;border-radius:28px;padding:6px 8px 6px 22px}input{flex:1;background:none;border:0;color:#edeef3;font-size:19px;outline:0}")
                .append("button{background:#3d7bff;border:0;color:#fff;border-radius:22px;font-size:17px;padding:10px 20px}")
                .append("h2{font-size:15px;font-weight:600;color:#a2a5b4;text-align:left;margin:34px 4px 12px;letter-spacing:.4px;text-transform:uppercase}")
                .append(".g{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}a{color:#edeef3;text-decoration:none;font-size:13px}")
                .append(".i{width:62px;height:62px;border-radius:18px;margin:0 auto 7px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.35)}")
                .append("</style></head><body><div class=c><h1>Nexo</h1>")
                .append("<form action='https://www.google.com/search'><input name=q placeholder='Buscar en la web' autocomplete=off><button>Buscar</button></form>");
        if (tuyas != null && !tuyas.isEmpty()) {
            b.append("<h2>Tus apps</h2><div class=g>");
            for (AppsWeb.App a : tuyas) baldosa(b, a);
            b.append("</div>");
        }
        b.append("<h2>Apps web</h2><div class=g>");
        for (AppsWeb.App a : AppsWeb.CATALOGO) baldosa(b, a);
        b.append("</div></div></body></html>");
        return b.toString();
    }

    private static void baldosa(StringBuilder b, AppsWeb.App a) {
        String col = String.format("#%06X", a.color & 0xFFFFFF);
        b.append("<a href='").append(html(a.url)).append("'><div class=i style='background:").append(col).append("'>")
                .append(html(a.inicial())).append("</div>").append(html(a.nombre)).append("</a>");
    }

    private static String html(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;").replace("\"", "&quot;");
    }
}
