package com.juniorspro.nexoxr;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Los sonidos del sistema, sintetizados al arrancar (sin archivos): un clic
 * suave, un tic al pasar por encima, abrir y cerrar (un soplido que sube o
 * baja), la cámara de la captura y el arranque.
 */
final class Sonido {
    static final int CLIC = 0, TIC = 1, ABRIR = 2, CERRAR = 3, CAPTURA = 4, ARRANQUE = 5, TECLA = 6;
    private static final int TASA = 22050;
    private SoundPool pool;
    private final int[] id = new int[7];
    boolean activo = true;

    void cargar(Context c) {
        pool = new SoundPool.Builder().setMaxStreams(8)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
        id[CLIC] = guardar(c, "clic", tono(1150, 0.05f, 60, 0.5f));
        id[TIC] = guardar(c, "tic", tono(2600, 0.018f, 160, 0.18f));
        id[ABRIR] = guardar(c, "abrir", barrido(320, 780, 0.22f, 0.45f));
        id[CERRAR] = guardar(c, "cerrar", barrido(700, 300, 0.2f, 0.4f));
        id[CAPTURA] = guardar(c, "captura", obturador());
        id[ARRANQUE] = guardar(c, "arranque", acorde(new float[]{261.6f, 392f, 523.3f, 784f}, 1.6f));
        id[TECLA] = guardar(c, "tecla", tono(1800, 0.025f, 120, 0.3f));
    }

    void tocar(int cual) {
        if (!activo || pool == null || id[cual] == 0) return;
        pool.play(id[cual], 1, 1, 1, 0, 1);
    }

    void liberar() { if (pool != null) pool.release(); pool = null; }

    private static short[] tono(float f, float dur, float caida, float vol) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            double v = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t);
            s[i] = (short) (v * Math.exp(-t * caida) * Math.min(1, t * 2000) * vol * 20000);
        }
        return s;
    }

    private static short[] barrido(float f0, float f1, float dur, float vol) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        double fase = 0;
        java.util.Random r = new java.util.Random(3);
        float lp = 0;
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA, x = t / dur;
            double f = f0 + (f1 - f0) * x * x * (3 - 2 * x);
            fase += 2 * Math.PI * f / TASA;
            lp += ((r.nextFloat() * 2 - 1) - lp) * 0.08f;
            float env = (float) Math.sin(Math.PI * x);
            s[i] = (short) ((Math.sin(fase) * 0.6 + lp * 0.8) * env * env * vol * 20000);
        }
        return s;
    }

    private static short[] obturador() {
        int n = (int) (0.16f * TASA);
        short[] s = new short[n];
        java.util.Random r = new java.util.Random(5);
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            float a = (float) (Math.exp(-t * 90) + 0.8 * Math.exp(-Math.abs(t - 0.08) * 120));
            s[i] = (short) ((r.nextFloat() * 2 - 1) * a * 14000);
        }
        return s;
    }

    private static short[] acorde(float[] fs, float dur) {
        int n = (int) (dur * TASA);
        short[] s = new short[n];
        for (int i = 0; i < n; i++) {
            float t = i / (float) TASA;
            double v = 0;
            for (int k = 0; k < fs.length; k++) {
                float entra = k * 0.12f;
                if (t < entra) continue;
                float tt = t - entra;
                v += Math.sin(2 * Math.PI * fs[k] * tt) * Math.exp(-tt * 2.2) * Math.min(1, tt * 40) / fs.length;
            }
            s[i] = (short) (v * 26000);
        }
        return s;
    }

    private int guardar(Context c, String nombre, short[] pcm) {
        File f = new File(c.getCacheDir(), "nexo-" + nombre + ".wav");
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
