package android.util;

/** Sólo para la PC: el Log de Android a la consola. */
public final class Log {
    public static int e(String t, String m) { System.err.println(t + ": " + m); return 0; }
}
