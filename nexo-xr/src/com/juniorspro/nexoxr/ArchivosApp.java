package com.juniorspro.nexoxr;

import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfRenderer;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.VideoView;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

/**
 * LOS ARCHIVOS: una carpeta del teléfono (la elegís una vez: Android lo
 * pregunta en la pantalla del teléfono) y todo lo de adentro, con sus
 * carpetas. Se abren acá: las fotos, los videos, la música, los textos y los
 * PDF (página por página).
 */
final class ArchivosApp {
    static final String PREFS = "archivos", ARBOL = "arbol";

    private static final class Item { String id, nombre, tipo; long tam, fecha; boolean carpeta() { return DocumentsContract.Document.MIME_TYPE_DIR.equals(tipo); } }

    private Context c;
    private Sistema s;
    private Uri arbol;
    private final ArrayList<String[]> camino = new ArrayList<>();   // (id, nombre)
    private FrameLayout raiz;
    private LinearLayout lista, migas;
    private final Handler ui = new Handler(Looper.getMainLooper());
    // el visor
    private FrameLayout visor;
    private PdfRenderer pdf;
    private ParcelFileDescriptor pdfFd;
    private int pagina;
    private MediaPlayer audio;

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        raiz = new FrameLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        String a = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(ARBOL, null);
        arbol = a == null ? null : Uri.parse(a);
        if (arbol == null || !puedeLeer(arbol)) { pedir(); return raiz; }
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 18);
        col.setPadding(m, m, m, 0);
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(Estilo.botonIcono(c, Iconos.ATRAS, 42, v -> { s.sonido(Sonido.CLIC); subir(); }));
        migas = new LinearLayout(c);
        migas.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(migas, new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.boton(c, Iconos.CARPETA, "Otra carpeta", false, v -> { s.sonido(Sonido.CLIC); s.elegirCarpeta(); }));
        col.addView(cab);
        ScrollView sv = new ScrollView(c);
        lista = new LinearLayout(c);
        lista.setOrientation(LinearLayout.VERTICAL);
        sv.addView(lista);
        LinearLayout.LayoutParams ls = new LinearLayout.LayoutParams(-1, 0, 1);
        ls.topMargin = Estilo.dp(c, 10);
        col.addView(sv, ls);
        raiz.addView(col, new FrameLayout.LayoutParams(-1, -1));
        raiz.addOnAttachStateChangeListener(new Soltar(this));
        camino.add(new String[]{DocumentsContract.getTreeDocumentId(arbol), nombreRaiz()});
        listar();
        return raiz;
    }

    private static final class Soltar implements View.OnAttachStateChangeListener {
        private final ArchivosApp a;
        Soltar(ArchivosApp a) { this.a = a; }
        @Override public void onViewAttachedToWindow(View v) { }
        @Override public void onViewDetachedFromWindow(View v) { a.cerrarVisor(); }
    }

    private boolean puedeLeer(Uri u) {
        for (android.content.UriPermission p : c.getContentResolver().getPersistedUriPermissions()) if (p.getUri().equals(u) && p.isReadPermission()) return true;
        return false;
    }

    private String nombreRaiz() {
        String id = DocumentsContract.getTreeDocumentId(arbol);
        int i = id.lastIndexOf(':');
        String n = i >= 0 ? id.substring(i + 1) : id;
        return n.isEmpty() ? "Teléfono" : n.substring(n.lastIndexOf('/') + 1);
    }

    private void pedir() {
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        col.addView(Estilo.icono(c, Iconos.ARCHIVOS, Estilo.TEXTO2, 64));
        TextView t = Estilo.texto(c, "Elegí una carpeta del teléfono (Descargas, Documentos…) para ver lo que tiene.\n"
                + "Se elige en la pantalla del teléfono, una sola vez.", 16, Estilo.TEXTO2, false);
        t.setGravity(Gravity.CENTER);
        t.setPadding(Estilo.dp(c, 30), Estilo.dp(c, 12), Estilo.dp(c, 30), Estilo.dp(c, 16));
        col.addView(t);
        col.addView(Estilo.boton(c, Iconos.CARPETA, "Elegir una carpeta", true, v -> { s.sonido(Sonido.CLIC); s.elegirCarpeta(); }));
        raiz.addView(col, new FrameLayout.LayoutParams(-1, -1));
    }

    // ── la lista ──

    private void listar() {
        String[] aca = camino.get(camino.size() - 1);
        migas.removeAllViews();
        for (int i = 0; i < camino.size(); i++) {
            final int k = i;
            TextView t = Estilo.texto(c, (i > 0 ? " › " : "") + camino.get(i)[1], 16, i == camino.size() - 1 ? Estilo.TEXTO : Estilo.TEXTO2, i == camino.size() - 1);
            t.setClickable(true);
            t.setOnClickListener(v -> { while (camino.size() > k + 1) camino.remove(camino.size() - 1); listar(); });
            migas.addView(t);
        }
        lista.removeAllViews();
        TextView carga = Estilo.texto(c, "…", 16, Estilo.TEXTO2, false);
        lista.addView(carga);
        new Thread(() -> {
            ArrayList<Item> items = leer(aca[0]);
            ui.post(() -> mostrar(items));
        }, "archivos").start();
    }

    private ArrayList<Item> leer(String id) {
        ArrayList<Item> l = new ArrayList<>();
        Uri hijos = DocumentsContract.buildChildDocumentsUriUsingTree(arbol, id);
        String[] col = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED};
        try (Cursor k = c.getContentResolver().query(hijos, col, null, null, null)) {
            while (k != null && k.moveToNext()) {
                Item it = new Item();
                it.id = k.getString(0); it.nombre = k.getString(1); it.tipo = k.getString(2);
                it.tam = k.isNull(3) ? 0 : k.getLong(3); it.fecha = k.isNull(4) ? 0 : k.getLong(4);
                if (it.nombre == null || it.nombre.startsWith(".")) continue;
                l.add(it);
            }
        } catch (Exception ignorada) { }
        l.sort((a, b) -> a.carpeta() != b.carpeta() ? (a.carpeta() ? -1 : 1) : a.nombre.compareToIgnoreCase(b.nombre));
        return l;
    }

    private void mostrar(ArrayList<Item> items) {
        lista.removeAllViews();
        if (items.isEmpty()) lista.addView(Estilo.texto(c, "(vacía)", 15, Estilo.TEXTO2, false));
        for (Item it : items) {
            String det = it.carpeta() ? "Carpeta" : tamano(it.tam) + (it.fecha > 0 ? " · " + new SimpleDateFormat("d MMM yyyy", new Locale("es")).format(new Date(it.fecha)) : "");
            LinearLayout r = Estilo.renglon(c, icono(it), it.nombre, det, null);
            r.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 14)));
            r.setClickable(true);
            r.setOnClickListener(v -> { s.sonido(Sonido.CLIC); abrir(it); });
            lista.addView(r);
        }
    }

    private static int icono(Item it) {
        if (it.carpeta()) return Iconos.CARPETA;
        String t = it.tipo == null ? "" : it.tipo;
        if (t.startsWith("image/")) return Iconos.GALERIA;
        if (t.startsWith("video/")) return Iconos.VIDEO;
        if (t.startsWith("audio/")) return Iconos.MUSICA;
        return Iconos.DOCUMENTO;
    }

    static String tamano(long b) {
        if (b < 1024) return b + " B";
        if (b < 1024 * 1024) return String.format(Locale.ROOT, "%.0f KB", b / 1024f);
        if (b < 1024L * 1024 * 1024) return String.format(Locale.ROOT, "%.1f MB", b / 1048576f).replace('.', ',');
        return String.format(Locale.ROOT, "%.2f GB", b / 1073741824f).replace('.', ',');
    }

    private void subir() {
        if (visor != null) { cerrarVisor(); return; }
        if (camino.size() > 1) { camino.remove(camino.size() - 1); listar(); }
    }

    // ── abrir ──

    private void abrir(Item it) {
        if (it.carpeta()) { camino.add(new String[]{it.id, it.nombre}); listar(); return; }
        Uri u = DocumentsContract.buildDocumentUriUsingTree(arbol, it.id);
        String t = it.tipo == null ? "" : it.tipo;
        String n = it.nombre.toLowerCase(Locale.ROOT);
        if (t.startsWith("image/")) verImagen(u);
        else if (t.startsWith("video/")) verVideo(u);
        else if (t.startsWith("audio/")) oirAudio(u, it.nombre);
        else if (t.equals("application/pdf") || n.endsWith(".pdf")) verPdf(u);
        else if (t.startsWith("text/") || n.endsWith(".txt") || n.endsWith(".md") || n.endsWith(".json") || n.endsWith(".csv") || n.endsWith(".srt")) verTexto(u);
        else s.avisar("\"" + it.nombre + "\": este tipo de archivo no se abre en Nexo");
    }

    private FrameLayout nuevoVisor(String titulo) {
        cerrarVisor();
        visor = new FrameLayout(c);
        visor.setBackgroundColor(0xF20D0E12);
        visor.setClickable(true);
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.setBackground(Estilo.forma(0xCC1F2027, Estilo.dp(c, 22)));
        cab.setPadding(Estilo.dp(c, 16), Estilo.dp(c, 4), Estilo.dp(c, 4), Estilo.dp(c, 4));
        TextView t = Estilo.texto(c, titulo, 15, Estilo.TEXTO, true);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.MIDDLE);
        cab.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.botonIcono(c, Iconos.CERRAR, 40, v -> { s.sonido(Sonido.CLIC); cerrarVisor(); }));
        FrameLayout.LayoutParams lc = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        lc.setMargins(Estilo.dp(c, 16), Estilo.dp(c, 12), Estilo.dp(c, 16), 0);
        raiz.addView(visor, new FrameLayout.LayoutParams(-1, -1));
        visor.addView(cab, lc);
        return visor;
    }

    private void cerrarVisor() {
        if (pdf != null) { try { pdf.close(); } catch (Throwable ignorada) { } pdf = null; }
        if (pdfFd != null) { try { pdfFd.close(); } catch (Throwable ignorada) { } pdfFd = null; }
        if (audio != null) { try { audio.release(); } catch (Throwable ignorada) { } audio = null; }
        if (visor != null) { raiz.removeView(visor); visor = null; }
    }

    private FrameLayout.LayoutParams debajo() {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, -1);
        lp.setMargins(Estilo.dp(c, 16), Estilo.dp(c, 70), Estilo.dp(c, 16), Estilo.dp(c, 16));
        return lp;
    }

    private void verImagen(Uri u) {
        FrameLayout v = nuevoVisor(nombre(u));
        ImageView im = new ImageView(c);
        im.setScaleType(ImageView.ScaleType.FIT_CENTER);
        v.addView(im, debajo());
        new Thread(() -> {
            Bitmap b = decodificar(u, 1800);
            ui.post(() -> im.setImageBitmap(b));
        }, "archivos-imagen").start();
    }

    private void verVideo(Uri u) {
        FrameLayout v = nuevoVisor(nombre(u));
        VideoView vv = new VideoView(c);
        v.addView(vv, debajo());
        vv.setVideoURI(u);
        vv.setOnPreparedListener(mp -> vv.start());
        vv.setOnClickListener(x -> { if (vv.isPlaying()) vv.pause(); else vv.start(); });
    }

    private void oirAudio(Uri u, String n) {
        FrameLayout v = nuevoVisor(n);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        col.addView(Estilo.icono(c, Iconos.MUSICA, Estilo.AZUL_CLARO, 80));
        LinearLayout b = Estilo.boton(c, Iconos.PAUSA, "Pausa", true, null);
        b.setOnClickListener(x -> {
            if (audio == null) return;
            if (audio.isPlaying()) { audio.pause(); ((TextView) b.getChildAt(1)).setText("Seguir"); }
            else { audio.start(); ((TextView) b.getChildAt(1)).setText("Pausa"); }
        });
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-2, -2);
        lb.topMargin = Estilo.dp(c, 16);
        col.addView(b, lb);
        v.addView(col, debajo());
        try {
            audio = new MediaPlayer();
            audio.setDataSource(c, u);
            audio.setOnPreparedListener(MediaPlayer::start);
            audio.prepareAsync();
        } catch (Exception e) { s.avisar("No se pudo reproducir: " + e.getMessage()); }
    }

    private void verTexto(Uri u) {
        FrameLayout v = nuevoVisor(nombre(u));
        ScrollView sv = new ScrollView(c);
        TextView t = Estilo.texto(c, "…", 15, Estilo.TEXTO, false);
        t.setTypeface(android.graphics.Typeface.MONOSPACE);
        t.setTextIsSelectable(false);
        sv.addView(t);
        v.addView(sv, debajo());
        new Thread(() -> {
            String x;
            try (InputStream in = c.getContentResolver().openInputStream(u)) {
                byte[] b = new byte[256 * 1024];
                int n = 0;
                for (int r; n < b.length && (r = in.read(b, n, b.length - n)) > 0; ) n += r;
                x = new String(b, 0, n, StandardCharsets.UTF_8) + (n == b.length ? "\n…(sigue)" : "");
            } catch (Exception e) { x = "No se pudo leer: " + e.getMessage(); }
            String fx = x;
            ui.post(() -> t.setText(fx));
        }, "archivos-texto").start();
    }

    private void verPdf(Uri u) {
        FrameLayout v = nuevoVisor(nombre(u));
        ImageView im = new ImageView(c);
        im.setScaleType(ImageView.ScaleType.FIT_CENTER);
        im.setBackgroundColor(0xFF2A2B34);
        FrameLayout.LayoutParams li = debajo();
        li.bottomMargin = Estilo.dp(c, 80);
        v.addView(im, li);
        LinearLayout abajo = new LinearLayout(c);
        abajo.setGravity(Gravity.CENTER_VERTICAL);
        abajo.setBackground(Estilo.forma(0xCC1F2027, Estilo.dp(c, 26)));
        abajo.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 6), Estilo.dp(c, 12), Estilo.dp(c, 6));
        TextView num = Estilo.texto(c, "", 15, Estilo.TEXTO, true);
        abajo.addView(Estilo.botonIcono(c, Iconos.ATRAS, 46, x -> { s.sonido(Sonido.CLIC); paginaPdf(im, num, pagina - 1); }));
        num.setPadding(Estilo.dp(c, 12), 0, Estilo.dp(c, 12), 0);
        abajo.addView(num);
        abajo.addView(Estilo.botonIcono(c, Iconos.ADELANTE, 46, x -> { s.sonido(Sonido.CLIC); paginaPdf(im, num, pagina + 1); }));
        FrameLayout.LayoutParams la = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        la.bottomMargin = Estilo.dp(c, 16);
        v.addView(abajo, la);
        try {
            pdfFd = c.getContentResolver().openFileDescriptor(u, "r");
            pdf = new PdfRenderer(pdfFd);
            paginaPdf(im, num, 0);
        } catch (Exception e) {
            s.avisar("No se pudo abrir el PDF: " + e.getMessage());
            cerrarVisor();
        }
    }

    private void paginaPdf(ImageView im, TextView num, int p) {
        if (pdf == null) return;
        int n = pdf.getPageCount();
        if (p < 0 || p >= n) return;
        pagina = p;
        try (PdfRenderer.Page pg = pdf.openPage(p)) {
            int w = 1400, h = Math.round(w * pg.getHeight() / (float) pg.getWidth());
            if (h > 2000) { h = 2000; w = Math.round(h * pg.getWidth() / (float) pg.getHeight()); }
            Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            b.eraseColor(0xFFFFFFFF);
            pg.render(b, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            im.setImageBitmap(b);
        } catch (Exception e) { s.avisar("No se pudo mostrar la página: " + e.getMessage()); }
        num.setText((p + 1) + " de " + n);
    }

    private Bitmap decodificar(Uri u, int lado) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream in = c.getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
            int k = 1;
            while (o.outWidth / (k * 2) >= lado || o.outHeight / (k * 2) >= lado) k *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = k;
            try (InputStream in = c.getContentResolver().openInputStream(u)) { return BitmapFactory.decodeStream(in, null, o2); }
        } catch (Exception e) { return null; }
    }

    private String nombre(Uri u) {
        try (Cursor k = c.getContentResolver().query(u, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (k != null && k.moveToFirst()) return k.getString(0);
        } catch (Exception ignorada) { }
        return "";
    }
}
