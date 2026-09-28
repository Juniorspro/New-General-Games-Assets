package com.juniorspro.nexoxr;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * GRABAR UN DIAGNÓSTICO: 20 segundos de lo que pasa en cada cuadro (el
 * seguimiento de ARCore tal cual, lo que dibuja Nexo Track, la demora, las
 * pérdidas y por qué, las manos) a un archivo en Descargas/Nexo, para
 * mandarlo y ver con datos de TU teléfono qué falla
 * (herramientas/diagnostico.py lo analiza).
 */
final class Diagnostico {
    static final long DURA_MS = 20_000;
    private StringBuilder sb;
    private long inicio;
    volatile boolean grabando;

    void empezar(long ahora, String cabecera) {
        sb = new StringBuilder(1 << 20);
        sb.append(cabecera).append('\n');
        inicio = ahora;
        grabando = true;
    }

    /** Cuánto falta (s). */
    int falta(long ahora) { return (int) Math.max(0, (DURA_MS - (ahora - inicio)) / 1000); }

    boolean termino(long ahora) { return grabando && ahora - inicio >= DURA_MS; }

    /** Un cuadro (una línea JSON). */
    void cuadro(long ahora, int modo, boolean rastrea, String falla, float demoraMs, float[] arcore, float[] salida,
                float corrCm, float corrGrados, float giroGrados, boolean fotoNueva, Mano[] manos, boolean[] pellizca) {
        if (!grabando) return;
        StringBuilder b = sb;
        b.append("{\"t\":").append(ahora - inicio).append(",\"m\":").append(modo).append(",\"r\":").append(rastrea ? 1 : 0);
        if (falla != null) b.append(",\"f\":\"").append(falla).append('"');
        b.append(",\"d\":").append(r1(demoraMs)).append(",\"n\":").append(fotoNueva ? 1 : 0);
        b.append(",\"w\":").append(r1(giroGrados)).append(",\"c\":[").append(r2(corrCm)).append(',').append(r2(corrGrados)).append(']');
        if (arcore != null) { b.append(",\"a\":"); pose(b, arcore); }
        if (salida != null) { b.append(",\"o\":"); pose(b, salida); }
        if (manos != null) {
            b.append(",\"h\":[");
            for (int s = 0; s < manos.length; s++) {
                if (s > 0) b.append(',');
                Mano m = manos[s];
                synchronized (m) {
                    if (!(m.hay && m.filtro.visible)) { b.append("null"); continue; }
                    b.append("{\"p\":").append(pellizca[s] ? 1 : 0).append(",\"x\":[");
                    for (int i = 0; i < 21; i++) {
                        if (i > 0) b.append(',');
                        b.append(r3(m.mundo[i][0])).append(',').append(r3(m.mundo[i][1])).append(',').append(r3(m.mundo[i][2]));
                    }
                    b.append("]}");
                }
            }
            b.append(']');
        }
        b.append("}\n");
    }

    private static void pose(StringBuilder b, float[] m) {
        float[] q = new float[4];
        Seguimiento.aCuat(m, q);
        b.append('[').append(r4(m[12])).append(',').append(r4(m[13])).append(',').append(r4(m[14])).append(',')
                .append(r4(q[0])).append(',').append(r4(q[1])).append(',').append(r4(q[2])).append(',').append(r4(q[3])).append(']');
    }

    private static String r1(float v) { return String.format(Locale.ROOT, "%.1f", v); }
    private static String r2(float v) { return String.format(Locale.ROOT, "%.2f", v); }
    private static String r3(float v) { return String.format(Locale.ROOT, "%.3f", v); }
    private static String r4(float v) { return String.format(Locale.ROOT, "%.4f", v); }

    /** Lo guarda y dice dónde (o por qué no). */
    String terminar(Context c) {
        grabando = false;
        String nombre = "nexo-diagnostico-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date()) + ".jsonl";
        byte[] datos = sb.toString().getBytes(StandardCharsets.UTF_8);
        sb = null;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Nexo");
                Uri u = c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (u == null) throw new Exception("no se pudo crear el archivo");
                try (OutputStream o = c.getContentResolver().openOutputStream(u)) { o.write(datos); }
                return "Descargas/Nexo/" + nombre;
            }
            File d = c.getExternalFilesDir(null);
            File f = new File(d, nombre);
            try (OutputStream o = new FileOutputStream(f)) { o.write(datos); }
            return f.getPath();
        } catch (Exception e) {
            return null;
        }
    }
}
