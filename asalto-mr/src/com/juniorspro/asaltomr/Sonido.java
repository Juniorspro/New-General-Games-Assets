package com.juniorspro.asaltomr;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Random;

/**
 * Los sonidos, sintetizados al arrancar (sin archivos de audio en el APK):
 * ruido con envolvente y un golpe grave para el disparo, chasquidos para la
 * recarga, un zumbido para la bala que pasa cerca. Se escriben como WAV en la
 * caché y se cargan en un SoundPool (poca latencia).
 */
final class Sonido {
    static final int DISPARO = 0, IMPACTO = 1, CARNE = 2, ENEMIGO = 3, DANO = 4, RECARGA = 5, OLEADA = 6, VACIO = 7, ZUMBIDO = 8, FIN = 9;
    private static final int TASA = 22050;

    private SoundPool pool;
    private final int[] id = new int[10];
    boolean activo = true;

    void cargar(Context c) {
        pool = new SoundPool.Builder().setMaxStreams(10)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
        Random r = new Random(11);
        id[DISPARO] = guardar(c, "disparo", disparo(r, 0.32f, 1f, 90));
        id[ENEMIGO] = guardar(c, "enemigo", disparo(r, 0.45f, 0.55f, 70));
        id[IMPACTO] = guardar(c, "impacto", ruido(r, 0.09f, 0.6f, 0.35f));
        id[CARNE] = guardar(c, "carne", golpe(0.16f, 110, 0.9f));
        id[DANO] = guardar(c, "dano", golpe(0.28f, 60, 1f));
        id[RECARGA] = guardar(c, "recarga", recarga(r));
        id[OLEADA] = guardar(c, "oleada", tonos(new float[]{440, 554, 659}, 0.12f));
        id[VACIO] = guardar(c, "vacio", ruido(r, 0.02f, 0.5f, 0.9f));
        id[ZUMBIDO] = guardar(c, "zumbido", zumbido());
        id[FIN] = guardar(c, "fin", tonos(new float[]{392, 330, 262}, 0.22f));
    }

    void tocar(int cual, float volumen, float pan) {
        if (!activo || pool == null || id[cual] == 0) return;
        float l = volumen * Math.min(1, 1 - pan), rr = volumen * Math.min(1, 1 + pan);
        pool.play(id[cual], l, rr, 1, 0, 0.94f + (float) Math.random() * 0.12f);
    }

    void liberar() {
        if (pool != null) pool.release();
        pool = null;
    }

    // ── síntesis ──

    private static short[] disparo(Random r, float dur, float vol, float grave) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        float lp = 0;
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            float env = (float) Math.exp(-t * 22) + 0.25f * (float) Math.exp(-t * 6);
            float ruido = r.nextFloat() * 2 - 1;
            lp += (ruido - lp) * (0.35f + 0.6f * (float) Math.exp(-t * 30));   // se oscurece al apagarse
            float golpe = (float) Math.sin(2 * Math.PI * grave * t * (1 - t * 2)) * (float) Math.exp(-t * 18);
            s[i] = (short) (Math.max(-1, Math.min(1, (lp * env * 1.3f + golpe * 0.9f) * vol)) * 32000);
        }
        return s;
    }

    private static short[] ruido(Random r, float dur, float vol, float brillo) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        float lp = 0;
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            lp += (r.nextFloat() * 2 - 1 - lp) * brillo;
            s[i] = (short) (lp * (float) Math.exp(-t * 40) * vol * 32000);
        }
        return s;
    }

    private static short[] golpe(float dur, float f, float vol) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            s[i] = (short) (Math.sin(2 * Math.PI * f * t * (1 - t)) * Math.exp(-t * 14) * vol * 30000);
        }
        return s;
    }

    private static short[] recarga(Random r) {
        int n = (int) (0.5f * TASA);
        short[] s = new short[n];
        float[] clics = {0.02f, 0.3f, 0.38f};
        for (float c : clics) {
            int i0 = (int) (c * TASA);
            for (int i = 0; i < 600 && i0 + i < n; i++) {
                float t = i / (float) TASA;
                s[i0 + i] += (short) ((r.nextFloat() * 2 - 1) * Math.exp(-t * 250) * 22000
                        + Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 300) * 8000);
            }
        }
        return s;
    }

    private static short[] tonos(float[] fs, float cada) {
        int n = (int) (cada * fs.length * TASA + 0.15f * TASA);
        short[] s = new short[n];
        for (int k = 0; k < fs.length; k++) {
            int i0 = (int) (k * cada * TASA);
            for (int i = 0; i0 + i < n && i < (int) (cada * 1.6f * TASA); i++) {
                float t = i / (float) TASA;
                s[i0 + i] += (short) (Math.sin(2 * Math.PI * fs[k] * t) * Math.exp(-t * 7) * 9000);
            }
        }
        return s;
    }

    private static short[] zumbido() {
        int n = (int) (0.22f * TASA);
        short[] s = new short[n];
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            float env = (float) Math.sin(Math.PI * t / 0.22f);
            float f = 900 - 500 * t / 0.22f;   // baja: se aleja
            s[i] = (short) (Math.sin(2 * Math.PI * f * t) * env * env * 9000);
        }
        return s;
    }

    private int guardar(Context c, String nombre, short[] pcm) {
        File f = new File(c.getCacheDir(), nombre + ".wav");
        try (FileOutputStream o = new FileOutputStream(f)) {
            int bytes = pcm.length * 2;
            byte[] cab = new byte[44];
            escribir(cab, 0, "RIFF"); entero(cab, 4, 36 + bytes); escribir(cab, 8, "WAVE");
            escribir(cab, 12, "fmt "); entero(cab, 16, 16); corto(cab, 20, 1); corto(cab, 22, 1);
            entero(cab, 24, TASA); entero(cab, 28, TASA * 2); corto(cab, 32, 2); corto(cab, 34, 16);
            escribir(cab, 36, "data"); entero(cab, 40, bytes);
            o.write(cab);
            byte[] datos = new byte[bytes];
            for (int i = 0; i < pcm.length; i++) { datos[i * 2] = (byte) pcm[i]; datos[i * 2 + 1] = (byte) (pcm[i] >> 8); }
            o.write(datos);
        } catch (IOException e) {
            return 0;
        }
        return pool.load(f.getAbsolutePath(), 1);
    }

    private static void escribir(byte[] b, int o, String s) { for (int i = 0; i < 4; i++) b[o + i] = (byte) s.charAt(i); }

    private static void entero(byte[] b, int o, int v) { for (int i = 0; i < 4; i++) b[o + i] = (byte) (v >> (8 * i)); }

    private static void corto(byte[] b, int o, int v) { b[o] = (byte) v; b[o + 1] = (byte) (v >> 8); }
}
