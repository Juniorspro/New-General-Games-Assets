package com.juniorspro.nexoxr;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Size;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.Locale;

/**
 * LA MÚSICA: tus canciones (las del teléfono) a la izquierda; a la derecha la
 * que suena, con su tapa, la barra para adelantar y los botones. Sigue sonando
 * aunque cierres la ventana (el Reproductor es del sistema).
 */
final class MusicaApp implements Reproductor.Mira {
    private Context c;
    private Sistema s;
    private final Reproductor r = Reproductor.UNO;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private TextView titulo, artista, tiempo, total;
    private ImageView tapa;
    private SeekBar barra;
    private ImageView play, mezclar;
    private Adaptador adaptador;
    private long tapaDe = -1;
    private boolean arrastrando;
    private final Runnable latido = new Runnable() {
        @Override public void run() { avance(); ui.postDelayed(this, 400); }
    };

    static boolean tienePermiso(Context c) {
        if (Build.VERSION.SDK_INT >= 33) return c.checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
        return c.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        if (!tienePermiso(c)) {
            LinearLayout pide = new LinearLayout(c);
            pide.setOrientation(LinearLayout.VERTICAL);
            pide.setGravity(Gravity.CENTER);
            pide.addView(Estilo.icono(c, Iconos.MUSICA, Estilo.TEXTO2, 64));
            TextView t = Estilo.texto(c, "Para escuchar tu música, Nexo necesita permiso.\nSe pregunta en la pantalla del teléfono.", 16, Estilo.TEXTO2, false);
            t.setGravity(Gravity.CENTER);
            t.setPadding(0, Estilo.dp(c, 12), 0, Estilo.dp(c, 16));
            pide.addView(t);
            pide.addView(Estilo.boton(c, -1, "Dar permiso", true, v -> { s.sonido(Sonido.CLIC); s.permisoMusica(); }));
            raiz.setGravity(Gravity.CENTER);
            raiz.addView(pide, new LinearLayout.LayoutParams(-1, -2));
            return raiz;
        }
        // la lista
        LinearLayout izq = new LinearLayout(c);
        izq.setOrientation(LinearLayout.VERTICAL);
        izq.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 14);
        izq.setPadding(m, m, m, 0);
        izq.addView(Estilo.texto(c, "Música", 24, Estilo.TEXTO, true));
        ListView lv = new ListView(c);
        lv.setDivider(null);
        lv.setSelector(new android.graphics.drawable.ColorDrawable(0));
        adaptador = new Adaptador();
        lv.setAdapter(adaptador);
        lv.setOnItemClickListener((p, v, pos, id) -> { s.sonido(Sonido.CLIC); r.tocar(pos); });
        LinearLayout.LayoutParams ll = new LinearLayout.LayoutParams(-1, 0, 1);
        ll.topMargin = Estilo.dp(c, 8);
        izq.addView(lv, ll);
        raiz.addView(izq, new LinearLayout.LayoutParams(0, -1, 1));
        // la que suena
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setGravity(Gravity.CENTER_HORIZONTAL);
        der.setPadding(Estilo.dp(c, 20), Estilo.dp(c, 18), Estilo.dp(c, 20), Estilo.dp(c, 14));
        FrameLayout marco = new FrameLayout(c);
        GradientDrawable fondoTapa = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF7A4DFF, 0xFF3D7BFF});
        fondoTapa.setCornerRadius(Estilo.dp(c, 20));
        marco.setBackground(fondoTapa);
        marco.setClipToOutline(true);
        ImageView nota = Estilo.icono(c, Iconos.MUSICA, 0x88FFFFFF, 70);
        marco.addView(nota, new FrameLayout.LayoutParams(Estilo.dp(c, 70), Estilo.dp(c, 70), Gravity.CENTER));
        tapa = new ImageView(c);
        tapa.setScaleType(ImageView.ScaleType.CENTER_CROP);
        marco.addView(tapa, new FrameLayout.LayoutParams(-1, -1));
        der.addView(marco, new LinearLayout.LayoutParams(Estilo.dp(c, 180), Estilo.dp(c, 180)));
        titulo = Estilo.texto(c, "Elegí una canción", 20, Estilo.TEXTO, true);
        titulo.setGravity(Gravity.CENTER);
        titulo.setSingleLine(true);
        titulo.setEllipsize(TextUtils.TruncateAt.END);
        titulo.setPadding(0, Estilo.dp(c, 12), 0, 0);
        der.addView(titulo, new LinearLayout.LayoutParams(-1, -2));
        artista = Estilo.texto(c, "", 14, Estilo.TEXTO2, false);
        artista.setGravity(Gravity.CENTER);
        der.addView(artista, new LinearLayout.LayoutParams(-1, -2));
        barra = Estilo.deslizador(c, 1000, 0, new Arrastre(this));
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-1, Estilo.dp(c, 36));
        lb.topMargin = Estilo.dp(c, 8);
        der.addView(barra, lb);
        LinearLayout tiempos = new LinearLayout(c);
        tiempo = Estilo.texto(c, "0:00", 12, Estilo.TEXTO2, false);
        total = Estilo.texto(c, "0:00", 12, Estilo.TEXTO2, false);
        total.setGravity(Gravity.END);
        tiempos.addView(tiempo, new LinearLayout.LayoutParams(0, -2, 1));
        tiempos.addView(total, new LinearLayout.LayoutParams(0, -2, 1));
        der.addView(tiempos, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout botones = new LinearLayout(c);
        botones.setGravity(Gravity.CENTER);
        android.widget.FrameLayout bm = Estilo.botonIcono(c, Iconos.MEZCLAR, 46, v -> { s.sonido(Sonido.CLIC); r.mezclar = !r.mezclar; cambio(); });
        mezclar = (ImageView) bm.getChildAt(0);
        botones.addView(bm);
        botones.addView(Estilo.botonIcono(c, Iconos.ANTERIOR, 54, v -> { s.sonido(Sonido.CLIC); r.anterior(); }));
        FrameLayout bp = Estilo.botonIcono(c, Iconos.PLAY, 68, v -> { s.sonido(Sonido.CLIC); r.playPausa(); });
        bp.setBackground(Estilo.apretable(Estilo.AZUL, Estilo.AZUL_CLARO, Estilo.dp(c, 34)));
        play = (ImageView) bp.getChildAt(0);
        LinearLayout.LayoutParams lpb = new LinearLayout.LayoutParams(Estilo.dp(c, 68), Estilo.dp(c, 68));
        lpb.leftMargin = lpb.rightMargin = Estilo.dp(c, 12);
        botones.addView(bp, lpb);
        botones.addView(Estilo.botonIcono(c, Iconos.SIGUIENTE, 54, v -> { s.sonido(Sonido.CLIC); r.siguiente(); }));
        botones.addView(new View(c), new LinearLayout.LayoutParams(Estilo.dp(c, 46), 1));
        LinearLayout.LayoutParams lbo = new LinearLayout.LayoutParams(-1, -2);
        lbo.topMargin = Estilo.dp(c, 8);
        der.addView(botones, lbo);
        raiz.addView(der, new LinearLayout.LayoutParams(0, -1, 1));
        raiz.addOnAttachStateChangeListener(new Dejar(this));
        r.mirar(this);
        new Thread(() -> r.cargar(c), "musica-lista").start();
        ui.post(latido);
        cambio();
        return raiz;
    }

    private static final class Dejar implements View.OnAttachStateChangeListener {
        private final MusicaApp m;
        Dejar(MusicaApp m) { this.m = m; }
        @Override public void onViewAttachedToWindow(View v) { }
        @Override public void onViewDetachedFromWindow(View v) { m.r.dejar(m); m.ui.removeCallbacks(m.latido); }
    }

    private static final class Arrastre implements SeekBar.OnSeekBarChangeListener {
        private final MusicaApp m;
        Arrastre(MusicaApp m) { this.m = m; }
        @Override public void onProgressChanged(SeekBar b, int v, boolean u) { if (u) m.tiempo.setText(hora(v / 1000f * m.r.duracion())); }
        @Override public void onStartTrackingTouch(SeekBar b) { m.arrastrando = true; }
        @Override public void onStopTrackingTouch(SeekBar b) { m.arrastrando = false; m.r.ir((int) (b.getProgress() / 1000f * m.r.duracion())); }
    }

    @Override public void cambio() {
        if (adaptador != null) adaptador.notifyDataSetChanged();
        Reproductor.Tema t = r.tema();
        if (titulo == null) return;
        titulo.setText(t == null ? (r.temas.isEmpty() ? "No hay música en el teléfono" : "Elegí una canción") : t.titulo);
        artista.setText(t == null ? "" : t.artista);
        ((Iconos) mezclar.getDrawable()).color(r.mezclar ? Estilo.AZUL_CLARO : Estilo.TEXTO2);
        if (t != null && t.id != tapaDe) cargarTapa(t);
        avance();
    }

    /** Lo que muestra el botón grande: 1 = pausa (está sonando), 0 = play. */
    private int botonPlay = -1;

    private void avance() {
        if (barra == null) return;
        int suena = r.sonando() ? 1 : 0;
        if (suena != botonPlay) { botonPlay = suena; play.setImageDrawable(new Iconos(suena == 1 ? Iconos.PAUSA : Iconos.PLAY, 0xFFFFFFFF)); }
        if (arrastrando) return;
        int d = r.duracion(), p = r.posicion();
        barra.setProgress(d > 0 ? (int) (p * 1000L / d) : 0);
        tiempo.setText(hora(p));
        total.setText(hora(d));
    }

    /** La tapa del disco (Android 10+: la miniatura de la canción), en otro hilo. */
    private void cargarTapa(Reproductor.Tema t) {
        tapaDe = t.id;
        tapa.setImageDrawable(null);
        new Thread(() -> {
            Bitmap b = null;
            try {
                if (Build.VERSION.SDK_INT >= 29) b = c.getContentResolver().loadThumbnail(t.uri, new Size(360, 360), null);
            } catch (Throwable ignorada) { }
            Bitmap fb = b;
            ui.post(() -> { if (tapaDe == t.id) tapa.setImageBitmap(fb); });
        }, "musica-tapa").start();
    }

    static String hora(float ms) {
        int s = Math.round(ms / 1000);
        return String.format(Locale.ROOT, "%d:%02d", s / 60, s % 60);
    }

    /** La lista de canciones: título, artista, duración; la que suena, en azul. */
    private final class Adaptador extends BaseAdapter {
        @Override public int getCount() { return r.temas.size(); }
        @Override public Object getItem(int i) { return r.temas.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override public View getView(int i, View v, ViewGroup p) {
            LinearLayout fila;
            TextView a, b, d;
            if (v == null) {
                fila = new LinearLayout(c);
                fila.setGravity(Gravity.CENTER_VERTICAL);
                fila.setPadding(Estilo.dp(c, 10), Estilo.dp(c, 8), Estilo.dp(c, 10), Estilo.dp(c, 8));
                LinearLayout t = new LinearLayout(c);
                t.setOrientation(LinearLayout.VERTICAL);
                a = Estilo.texto(c, "", 15, Estilo.TEXTO, true);
                a.setSingleLine(true);
                a.setEllipsize(TextUtils.TruncateAt.END);
                b = Estilo.texto(c, "", 12, Estilo.TEXTO2, false);
                b.setSingleLine(true);
                b.setEllipsize(TextUtils.TruncateAt.END);
                t.addView(a);
                t.addView(b);
                fila.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
                d = Estilo.texto(c, "", 12, Estilo.TEXTO2, false);
                fila.addView(d);
                fila.setTag(new TextView[]{a, b, d});
            } else {
                fila = (LinearLayout) v;
                TextView[] ts = (TextView[]) fila.getTag();
                a = ts[0]; b = ts[1]; d = ts[2];
            }
            Reproductor.Tema t = r.temas.get(i);
            boolean es = i == r.actual;
            a.setText(t.titulo);
            a.setTextColor(es ? Estilo.AZUL_CLARO : Estilo.TEXTO);
            b.setText(t.artista);
            d.setText(hora(t.dur));
            fila.setBackground(Estilo.forma(es ? 0x223D7BFF : 0x00000000, Estilo.dp(c, 10)));
            return fila;
        }
    }
}
