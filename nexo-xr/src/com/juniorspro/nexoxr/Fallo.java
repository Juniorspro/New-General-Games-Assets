package com.juniorspro.nexoxr;

import android.content.Context;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Si la app se cae, que diga por qué. Guarda el error (con el modelo del
 * teléfono y la versión de Android) en un archivo; al volver a abrirla,
 * Principal lo muestra con un botón para copiarlo y otro para abrir en modo
 * seguro. Sin esto, "no abre" no dice nada.
 */
final class Fallo {
    private static final String ARCHIVO = "fallo.txt";
    private static File dir;

    private Fallo() {}

    /** Engancha el manejador de errores no atrapados (en cualquier hilo). */
    static void instalar(Context c) {
        dir = c.getFilesDir();
        final Thread.UncaughtExceptionHandler anterior = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Manejador(anterior));
    }

    private static final class Manejador implements Thread.UncaughtExceptionHandler {
        final Thread.UncaughtExceptionHandler anterior;

        Manejador(Thread.UncaughtExceptionHandler a) { anterior = a; }

        @Override
        public void uncaughtException(Thread t, Throwable e) {
            guardar("hilo " + t.getName(), e);
            if (anterior != null) anterior.uncaughtException(t, e);
        }
    }

    /** Guarda un error (también los atrapados que igual dejan la app sin andar). */
    static void guardar(String donde, Throwable e) {
        if (dir == null) return;
        StringWriter s = new StringWriter();
        PrintWriter p = new PrintWriter(s);
        p.println("Nexo XR · " + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
        p.println("dónde: " + donde);
        e.printStackTrace(p);
        p.flush();
        try (FileOutputStream o = new FileOutputStream(new File(dir, ARCHIVO))) {
            o.write(s.toString().getBytes("UTF-8"));
        } catch (Exception ignorada) {
            // si ni esto se puede, no hay nada más que hacer
        }
    }

    /** El último error guardado, o null. */
    static String leer(Context c) {
        File f = new File(c.getFilesDir(), ARCHIVO);
        if (!f.exists()) return null;
        try (FileInputStream i = new FileInputStream(f)) {
            byte[] b = new byte[(int) Math.min(f.length(), 64 * 1024)];
            int n = i.read(b);
            return n <= 0 ? null : new String(b, 0, n, "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }

    static void borrar(Context c) {
        File f = new File(c.getFilesDir(), ARCHIVO);
        if (f.exists()) f.delete();
    }

    /** El texto de un error, para mostrarlo en pantalla. */
    static String texto(Throwable e) {
        StringWriter s = new StringWriter();
        e.printStackTrace(new PrintWriter(s));
        String t = s.toString();
        return t.length() > 1500 ? t.substring(0, 1500) + "…" : t;
    }
}
