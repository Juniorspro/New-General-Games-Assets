package com.juniorspro.nexoxr;

import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;

import java.util.ArrayList;
import java.util.Random;

/**
 * EL REPRODUCTOR de música: uno solo para todo Nexo, así sigue sonando con la
 * ventana cerrada. Tus canciones (las del teléfono), en orden o mezcladas.
 */
final class Reproductor implements MediaPlayer.OnCompletionListener, MediaPlayer.OnPreparedListener, MediaPlayer.OnErrorListener {
    static final Reproductor UNO = new Reproductor();

    static final class Tema {
        long id, dur, album;
        Uri uri;
        String titulo, artista;
    }

    interface Mira { void cambio(); }

    final ArrayList<Tema> temas = new ArrayList<>();
    volatile int actual = -1;
    boolean mezclar;
    private MediaPlayer mp;
    private Context app;
    private boolean preparado;
    private final ArrayList<Mira> miran = new ArrayList<>();
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Random azar = new Random();
    private AudioFocusRequest foco;

    private Reproductor() {}

    void mirar(Mira m) { if (!miran.contains(m)) miran.add(m); }
    void dejar(Mira m) { miran.remove(m); }
    private void avisar() { ui.post(() -> { for (Mira m : new ArrayList<>(miran)) m.cambio(); }); }

    /** Las canciones del teléfono (MediaStore), ordenadas por título. */
    void cargar(Context c) {
        app = c.getApplicationContext();
        ArrayList<Tema> l = new ArrayList<>();
        String[] col = {MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.ALBUM_ID};
        try (Cursor k = app.getContentResolver().query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, col,
                MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " > 20000", null,
                MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC")) {
            while (k != null && k.moveToNext()) {
                Tema t = new Tema();
                t.id = k.getLong(0);
                t.titulo = k.getString(1);
                t.artista = k.getString(2);
                if (t.artista == null || t.artista.startsWith("<")) t.artista = "Artista desconocido";
                t.dur = k.getLong(3);
                t.album = k.getLong(4);
                t.uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, t.id);
                l.add(t);
            }
        } catch (Exception ignorada) { }
        // la lista se cambia en el hilo de la app (la está mostrando una lista)
        ui.post(() -> {
            // si ya estaba sonando una, que siga siendo la misma
            Tema sonando = tema();
            temas.clear();
            temas.addAll(l);
            actual = -1;
            if (sonando != null) for (int i = 0; i < temas.size(); i++) if (temas.get(i).id == sonando.id) actual = i;
            for (Mira m : new ArrayList<>(miran)) m.cambio();
        });
    }

    void tocar(int i) {
        if (i < 0 || i >= temas.size() || app == null) return;
        actual = i;
        try {
            if (mp == null) {
                mp = new MediaPlayer();
                mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
                mp.setOnCompletionListener(this);
                mp.setOnPreparedListener(this);
                mp.setOnErrorListener(this);
            } else mp.reset();
            preparado = false;
            mp.setDataSource(app, temas.get(i).uri);
            mp.prepareAsync();
        } catch (Exception e) {
            preparado = false;
        }
        avisar();
    }

    @Override public void onPrepared(MediaPlayer m) {
        preparado = true;
        pedirFoco();
        m.start();
        avisar();
    }

    @Override public void onCompletion(MediaPlayer m) { siguiente(); }

    @Override public boolean onError(MediaPlayer m, int a, int b) { preparado = false; avisar(); return true; }

    boolean sonando() { return mp != null && preparado && mp.isPlaying(); }

    void playPausa() {
        if (mp == null || !preparado) { if (!temas.isEmpty()) tocar(Math.max(0, actual)); return; }
        if (mp.isPlaying()) mp.pause(); else { pedirFoco(); mp.start(); }
        avisar();
    }

    void siguiente() {
        if (temas.isEmpty()) return;
        tocar(mezclar ? azar.nextInt(temas.size()) : (actual + 1) % temas.size());
    }

    void anterior() {
        if (temas.isEmpty()) return;
        // pasados 3 s, vuelve al principio de la misma
        if (mp != null && preparado && mp.getCurrentPosition() > 3000) { mp.seekTo(0); avisar(); return; }
        tocar((actual - 1 + temas.size()) % temas.size());
    }

    void ir(int ms) { if (mp != null && preparado) mp.seekTo(ms); }
    int posicion() { return mp != null && preparado ? mp.getCurrentPosition() : 0; }
    int duracion() { return mp != null && preparado ? mp.getDuration() : 0; }
    Tema tema() { int i = actual; return i >= 0 && i < temas.size() ? temas.get(i) : null; }

    private void pedirFoco() {
        try {
            AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) {
                if (foco == null) foco = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        .setOnAudioFocusChangeListener(new Foco(this)).build();
                am.requestAudioFocus(foco);
            }
        } catch (Throwable ignorada) { }
    }

    /** Si otra app pide el sonido (una llamada, un video), se pausa. */
    private static final class Foco implements AudioManager.OnAudioFocusChangeListener {
        private final Reproductor r;
        Foco(Reproductor r) { this.r = r; }
        @Override public void onAudioFocusChange(int f) {
            if (f == AudioManager.AUDIOFOCUS_LOSS || f == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                if (r.sonando()) { r.mp.pause(); r.avisar(); }
            }
        }
    }

    /** Al cerrar Nexo. */
    void soltar() {
        if (mp != null) { try { mp.release(); } catch (Throwable ignorada) { } }
        mp = null;
        preparado = false;
    }
}
