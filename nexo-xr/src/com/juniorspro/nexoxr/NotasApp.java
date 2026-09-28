package com.juniorspro.nexoxr;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * LAS NOTAS: a la izquierda tus notas (la primera línea es el título), a la
 * derecha la que estás escribiendo (con el teclado de Nexo, en el espacio).
 * Se guardan solas mientras escribís, una por archivo (en la app).
 */
final class NotasApp {
    private Context c;
    private Sistema s;
    private LinearLayout lista;
    private EditText editor;
    private TextView fecha;
    private File actual;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable guardar = this::guardar;

    private File carpeta() {
        File d = new File(c.getFilesDir(), "notas");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        // la lista
        LinearLayout izq = new LinearLayout(c);
        izq.setOrientation(LinearLayout.VERTICAL);
        izq.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 14);
        izq.setPadding(m, m, m, m);
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(Estilo.texto(c, "Notas", 24, Estilo.TEXTO, true), new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.botonIcono(c, Iconos.MAS, 40, v -> { s.sonido(Sonido.ABRIR); nueva(); }));
        izq.addView(cab);
        ScrollView sv = new ScrollView(c);
        lista = new LinearLayout(c);
        lista.setOrientation(LinearLayout.VERTICAL);
        sv.addView(lista);
        LinearLayout.LayoutParams ls = new LinearLayout.LayoutParams(-1, 0, 1);
        ls.topMargin = Estilo.dp(c, 8);
        izq.addView(sv, ls);
        raiz.addView(izq, new LinearLayout.LayoutParams(Estilo.dp(c, 220), -1));
        // el editor
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 20), Estilo.dp(c, 16), Estilo.dp(c, 20), Estilo.dp(c, 16));
        LinearLayout barra = new LinearLayout(c);
        barra.setGravity(Gravity.CENTER_VERTICAL);
        fecha = Estilo.texto(c, "", 13, Estilo.TEXTO2, false);
        barra.addView(fecha, new LinearLayout.LayoutParams(0, -2, 1));
        barra.addView(Estilo.botonIcono(c, Iconos.TECLADO, 40, v -> { editor.requestFocus(); s.mostrarTeclado(true); }));
        barra.addView(Estilo.botonIcono(c, Iconos.BORRAR, 40, v -> { s.sonido(Sonido.CERRAR); borrar(); }));
        der.addView(barra);
        editor = new EditText(c);
        editor.setTextSize(18);
        editor.setTextColor(Estilo.TEXTO);
        editor.setHintTextColor(Estilo.TEXTO2);
        editor.setHint("Escribí acá… (la primera línea es el título)");
        editor.setGravity(Gravity.TOP | Gravity.START);
        editor.setBackground(Estilo.forma(Estilo.PANEL, Estilo.dp(c, 16)));
        editor.setPadding(Estilo.dp(c, 18), Estilo.dp(c, 14), Estilo.dp(c, 18), Estilo.dp(c, 14));
        editor.setShowSoftInputOnFocus(false);   // el teclado es el de Nexo
        editor.setOnFocusChangeListener((v, f) -> { if (f) s.mostrarTeclado(true); });
        editor.addTextChangedListener(new AlEscribir(this));
        LinearLayout.LayoutParams le = new LinearLayout.LayoutParams(-1, 0, 1);
        le.topMargin = Estilo.dp(c, 8);
        der.addView(editor, le);
        raiz.addView(der, new LinearLayout.LayoutParams(0, -1, 1));
        File[] fs = notas();
        if (fs.length > 0) abrir(fs[0]); else nueva();
        return raiz;
    }

    /** Mientras escribís: se guarda 0.6 s después de la última letra. */
    private static final class AlEscribir implements TextWatcher {
        private final NotasApp n;
        AlEscribir(NotasApp n) { this.n = n; }
        @Override public void beforeTextChanged(CharSequence x, int a, int b, int d) { }
        @Override public void onTextChanged(CharSequence x, int a, int b, int d) { }
        @Override public void afterTextChanged(Editable e) {
            n.ui.removeCallbacks(n.guardar);
            n.ui.postDelayed(n.guardar, 600);
        }
    }

    private File[] notas() {
        File[] fs = carpeta().listFiles((d, n) -> n.endsWith(".txt"));
        if (fs == null) return new File[0];
        Arrays.sort(fs, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        return fs;
    }

    private void armarLista() {
        lista.removeAllViews();
        for (File f : notas()) {
            String t = leer(f).trim();
            String titulo = t.isEmpty() ? "Nota vacía" : t.split("\n", 2)[0];
            String resto = t.contains("\n") ? t.split("\n", 2)[1].trim().replace('\n', ' ') : "";
            LinearLayout r = new LinearLayout(c);
            r.setOrientation(LinearLayout.VERTICAL);
            r.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 9), Estilo.dp(c, 12), Estilo.dp(c, 9));
            boolean es = f.equals(actual);
            r.setBackground(Estilo.apretable(es ? Estilo.AZUL : Estilo.TARJETA, es ? Estilo.AZUL_CLARO : Estilo.TARJETA_ALTA, Estilo.dp(c, 12)));
            TextView a = Estilo.texto(c, titulo, 15, Estilo.TEXTO, true);
            a.setSingleLine(true);
            a.setEllipsize(TextUtils.TruncateAt.END);
            TextView b = Estilo.texto(c, resto.isEmpty() ? cuando(f) : resto, 12, es ? 0xDDFFFFFF : Estilo.TEXTO2, false);
            b.setSingleLine(true);
            b.setEllipsize(TextUtils.TruncateAt.END);
            r.addView(a);
            r.addView(b);
            r.setClickable(true);
            r.setOnClickListener(v -> { s.sonido(Sonido.CLIC); guardar(); abrir(f); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.bottomMargin = Estilo.dp(c, 6);
            lista.addView(r, lp);
        }
    }

    private void abrir(File f) {
        actual = f;
        editor.setText(leer(f));
        editor.setSelection(editor.getText().length());
        fecha.setText(cuando(f));
        armarLista();
    }

    private void nueva() {
        guardar();
        File f = new File(carpeta(), "nota-" + System.currentTimeMillis() + ".txt");
        escribir(f, "");
        abrir(f);
        editor.requestFocus();
        s.mostrarTeclado(true);
    }

    private void borrar() {
        if (actual != null) actual.delete();
        actual = null;
        File[] fs = notas();
        if (fs.length > 0) abrir(fs[0]); else nueva();
    }

    private void guardar() {
        if (actual == null || editor == null) return;
        String t = editor.getText().toString();
        if (t.equals(leer(actual))) return;
        escribir(actual, t);
        fecha.setText(cuando(actual));
        armarLista();
    }

    private static String cuando(File f) {
        return new SimpleDateFormat("EEEE d 'de' MMMM, HH:mm", new Locale("es")).format(new Date(f.lastModified()));
    }

    private static String leer(File f) {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) Math.min(f.length(), 1 << 20)];
            int n = 0;
            for (int r; n < b.length && (r = in.read(b, n, b.length - n)) > 0; ) n += r;
            return new String(b, 0, n, StandardCharsets.UTF_8);
        } catch (Exception e) { return ""; }
    }

    private static void escribir(File f, String t) {
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(t.getBytes(StandardCharsets.UTF_8)); } catch (Exception ignorada) { }
    }
}
