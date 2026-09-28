package com.juniorspro.nexoxr;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.LruCache;
import android.util.Size;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.VideoView;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * LA GALERÍA: tus fotos y videos del teléfono en una grilla; al tocar uno se
 * ve grande (las fotos con anterior / siguiente, los videos con play, pausa y
 * la barra para adelantar).
 *
 * EL CINE es la misma, sólo con los videos, en baldosas grandes con su
 * duración (para verlos en grande: ⤢, el modo cine).
 */
final class Galeria {
    static final class Medio { Uri uri; boolean video; long dur; }

    private final ArrayList<Medio> medios = new ArrayList<>();
    private final LruCache<Uri, Bitmap> miniaturas = new LruCache<>(160);
    private final ExecutorService hilos = Executors.newFixedThreadPool(2);
    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout raiz, visor;
    private ImageView foto;
    private VideoView video;
    private SeekBar barra;
    private int actual = -1;
    private BaseAdapter adaptador;
    private Context ctx;
    /** Sólo los videos (la app Cine). */
    private boolean cine;

    View crearCine(Context c, Sistema s) {
        cine = true;
        return crear(c, s);
    }

    static boolean tienePermiso(Context c) {
        if (Build.VERSION.SDK_INT >= 33)
            return c.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        return c.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean tienePermisoVideos(Context c) {
        if (Build.VERSION.SDK_INT >= 33)
            return c.checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
        return tienePermiso(c);
    }

    View crear(Context c, Sistema s) {
        ctx = c;
        raiz = new FrameLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 20);
        col.setPadding(m, m, m, 0);
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(Estilo.texto(c, cine ? "Cine" : "Galería", 26, Estilo.TEXTO, true), new LinearLayout.LayoutParams(0, -2, 1));
        TextView cuantos = Estilo.texto(c, "", 14, Estilo.TEXTO2, false);
        cab.addView(cuantos);
        col.addView(cab);
        if (!(cine ? tienePermisoVideos(c) : tienePermiso(c))) {
            LinearLayout pide = new LinearLayout(c);
            pide.setOrientation(LinearLayout.VERTICAL);
            pide.setGravity(Gravity.CENTER);
            pide.addView(Estilo.icono(c, Iconos.GALERIA, Estilo.TEXTO2, 64));
            TextView t = Estilo.texto(c, "Para ver tus fotos y videos, Nexo necesita permiso.\nSe pregunta en la pantalla del teléfono.", 16, Estilo.TEXTO2, false);
            t.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(-2, -2);
            lt.topMargin = Estilo.dp(c, 16); lt.bottomMargin = Estilo.dp(c, 20);
            pide.addView(t, lt);
            pide.addView(Estilo.boton(c, -1, "Dar permiso", true, v -> s.permisoFotos()));
            col.addView(pide, new LinearLayout.LayoutParams(-1, 0, 1));
            raiz.addView(col);
            return raiz;
        }
        GridView g = new GridView(c);
        g.setNumColumns(cine ? 3 : 5);
        g.setHorizontalSpacing(Estilo.dp(c, 8));
        g.setVerticalSpacing(Estilo.dp(c, 8));
        g.setSelector(new android.graphics.drawable.ColorDrawable(0));
        adaptador = new BaseAdapter() {
            public int getCount() { return medios.size(); }
            public Object getItem(int i) { return medios.get(i); }
            public long getItemId(int i) { return i; }
            public View getView(int i, View v, ViewGroup p) {
                FrameLayout f = (FrameLayout) v;
                ImageView im;
                if (f == null) {
                    f = new FrameLayout(c);
                    im = new ImageView(c);
                    im.setScaleType(ImageView.ScaleType.CENTER_CROP);
                    im.setBackground(Estilo.forma(Estilo.TARJETA, Estilo.dp(c, 10)));
                    im.setClipToOutline(true);
                    f.addView(im, new FrameLayout.LayoutParams(-1, -1));
                    ImageView ic = new ImageView(c);
                    ic.setImageDrawable(new Iconos(Iconos.PLAY, 0xFFFFFFFF));
                    FrameLayout.LayoutParams li = new FrameLayout.LayoutParams(Estilo.dp(c, 30), Estilo.dp(c, 30), Gravity.CENTER);
                    f.addView(ic, li);
                    TextView dur = Estilo.texto(c, "", 12, 0xFFFFFFFF, true);
                    dur.setBackground(Estilo.forma(0xAA000000, Estilo.dp(c, 6)));
                    dur.setPadding(Estilo.dp(c, 6), Estilo.dp(c, 2), Estilo.dp(c, 6), Estilo.dp(c, 2));
                    FrameLayout.LayoutParams ld = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.END);
                    ld.setMargins(0, 0, Estilo.dp(c, 6), Estilo.dp(c, 6));
                    f.addView(dur, ld);
                    f.setLayoutParams(new GridView.LayoutParams(-1, Estilo.dp(c, cine ? 150 : 100)));
                } else im = (ImageView) f.getChildAt(0);
                Medio md = medios.get(i);
                f.getChildAt(1).setVisibility(md.video ? View.VISIBLE : View.GONE);
                TextView dur = (TextView) f.getChildAt(2);
                dur.setVisibility(md.video && md.dur > 0 ? View.VISIBLE : View.GONE);
                dur.setText(MusicaApp.hora(md.dur));
                im.setTag(md.uri);
                Bitmap b = miniaturas.get(md.uri);
                im.setImageBitmap(b);
                if (b == null) cargarMiniatura(md, im);
                return f;
            }
        };
        g.setAdapter(adaptador);
        g.setOnItemClickListener((a, v, i, id) -> { s.sonido(Sonido.CLIC); abrir(i); });
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(-1, 0, 1);
        lg.topMargin = Estilo.dp(c, 14);
        col.addView(g, lg);
        raiz.addView(col);
        hilos.execute(() -> {
            ArrayList<Medio> l = buscar(c, cine);
            ui.post(() -> { medios.clear(); medios.addAll(l); adaptador.notifyDataSetChanged(); cuantos.setText(l.size() + (l.size() == 1 ? " elemento" : " elementos")); });
        });
        return raiz;
    }

    private static ArrayList<Medio> buscar(Context c, boolean soloVideos) {
        ArrayList<Medio> l = new ArrayList<>();
        Uri base = MediaStore.Files.getContentUri("external");
        String[] cols = {MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.MEDIA_TYPE, MediaStore.Video.VideoColumns.DURATION};
        String donde = soloVideos ? MediaStore.Files.FileColumns.MEDIA_TYPE + "=" + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                : MediaStore.Files.FileColumns.MEDIA_TYPE + "=" + MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE + " OR "
                + MediaStore.Files.FileColumns.MEDIA_TYPE + "=" + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
        try (Cursor k = c.getContentResolver().query(base, cols, donde, null, MediaStore.Files.FileColumns.DATE_ADDED + " DESC")) {
            if (k == null) return l;
            while (k.moveToNext() && l.size() < 600) {
                Medio m = new Medio();
                long id = k.getLong(0);
                m.video = k.getInt(1) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
                m.uri = ContentUris.withAppendedId(m.video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                m.dur = k.isNull(2) ? 0 : k.getLong(2);
                l.add(m);
            }
        } catch (Throwable e) { /* sin permiso o sin MediaStore: vacía */ }
        return l;
    }

    private void cargarMiniatura(Medio m, ImageView im) {
        hilos.execute(() -> {
            Bitmap b = null;
            try {
                if (Build.VERSION.SDK_INT >= 29) b = ctx.getContentResolver().loadThumbnail(m.uri, new Size(256, 256), null);
                else if (m.video) b = MediaStore.Video.Thumbnails.getThumbnail(ctx.getContentResolver(), ContentUris.parseId(m.uri), MediaStore.Video.Thumbnails.MINI_KIND, null);
                else b = MediaStore.Images.Thumbnails.getThumbnail(ctx.getContentResolver(), ContentUris.parseId(m.uri), MediaStore.Images.Thumbnails.MINI_KIND, null);
            } catch (Throwable e) { /* sin miniatura */ }
            if (b == null) return;
            miniaturas.put(m.uri, b);
            Bitmap fb = b;
            ui.post(() -> { if (m.uri.equals(im.getTag())) im.setImageBitmap(fb); });
        });
    }

    /** Ver uno grande. */
    private void abrir(int i) {
        if (i < 0 || i >= medios.size()) return;
        actual = i;
        Context c = ctx;
        if (visor == null) {
            visor = new FrameLayout(c);
            visor.setBackgroundColor(0xF2000000);
            visor.setClickable(true);
            foto = new ImageView(c);
            foto.setScaleType(ImageView.ScaleType.FIT_CENTER);
            visor.addView(foto, new FrameLayout.LayoutParams(-1, -1));
            video = new VideoView(c);
            visor.addView(video, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
            // la barra de abajo: anterior, play/pausa, la barra, siguiente, cerrar
            LinearLayout abajo = new LinearLayout(c);
            abajo.setGravity(Gravity.CENTER_VERTICAL);
            abajo.setBackground(Estilo.forma(0xCC1F2027, Estilo.dp(c, 26)));
            int p = Estilo.dp(c, 8);
            abajo.setPadding(p * 2, p, p * 2, p);
            abajo.addView(Estilo.botonIcono(c, Iconos.ATRAS, 46, v -> abrir(actual - 1)));
            FrameLayout play = Estilo.botonIcono(c, Iconos.PAUSA, 46, null);
            play.setOnClickListener(v -> {
                if (video.isPlaying()) { video.pause(); ((ImageView) play.getChildAt(0)).setImageDrawable(new Iconos(Iconos.PLAY, Estilo.TEXTO)); }
                else { video.start(); ((ImageView) play.getChildAt(0)).setImageDrawable(new Iconos(Iconos.PAUSA, Estilo.TEXTO)); }
            });
            play.setTag("play");
            abajo.addView(play);
            barra = Estilo.deslizador(c, 1000, 0, new Adelantar());
            barra.setTag("barra");
            abajo.addView(barra, new LinearLayout.LayoutParams(Estilo.dp(c, 300), Estilo.dp(c, 40)));
            abajo.addView(Estilo.botonIcono(c, Iconos.ADELANTE, 46, v -> abrir(actual + 1)));
            abajo.addView(Estilo.botonIcono(c, Iconos.CERRAR, 46, v -> cerrarVisor()));
            FrameLayout.LayoutParams la = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
            la.bottomMargin = Estilo.dp(c, 18);
            visor.addView(abajo, la);
            raiz.addView(visor, new FrameLayout.LayoutParams(-1, -1));
            ui.post(this::avance);
        }
        visor.setVisibility(View.VISIBLE);
        Medio m = medios.get(i);
        View play = visor.findViewWithTag("play");
        if (m.video) {
            foto.setVisibility(View.GONE);
            video.setVisibility(View.VISIBLE);
            play.setVisibility(View.VISIBLE);
            barra.setVisibility(View.VISIBLE);
            video.setVideoURI(m.uri);
            video.setOnPreparedListener(mp -> video.start());
        } else {
            video.stopPlayback();
            video.setVisibility(View.GONE);
            play.setVisibility(View.GONE);
            barra.setVisibility(View.GONE);
            foto.setVisibility(View.VISIBLE);
            foto.setImageBitmap(miniaturas.get(m.uri));
            hilos.execute(() -> {
                Bitmap b = cargarGrande(m.uri, 1600);
                ui.post(() -> { if (actual == i && b != null) foto.setImageBitmap(b); });
            });
        }
    }

    /** La barra del video: adelantar o atrasar. */
    private final class Adelantar implements SeekBar.OnSeekBarChangeListener {
        @Override public void onProgressChanged(SeekBar b, int v, boolean u) { if (u && video.getDuration() > 0) video.seekTo((int) ((long) video.getDuration() * v / 1000)); }
        @Override public void onStartTrackingTouch(SeekBar b) { }
        @Override public void onStopTrackingTouch(SeekBar b) { }
    }

    /** La barra del video sigue lo que se está viendo. */
    private void avance() {
        if (video != null && video.getVisibility() == View.VISIBLE && video.getDuration() > 0)
            barra.setProgress((int) (1000L * video.getCurrentPosition() / video.getDuration()));
        if (visor != null) ui.postDelayed(this::avance, 300);
    }

    private void cerrarVisor() {
        if (video != null) video.stopPlayback();
        if (visor != null) visor.setVisibility(View.GONE);
        actual = -1;
    }

    private Bitmap cargarGrande(Uri u, int lado) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream in = ctx.getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
            int s = 1;
            while (o.outWidth / (s * 2) >= lado || o.outHeight / (s * 2) >= lado) s *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = s;
            try (InputStream in = ctx.getContentResolver().openInputStream(u)) { return BitmapFactory.decodeStream(in, null, o2); }
        } catch (Throwable e) { return null; }
    }
}
