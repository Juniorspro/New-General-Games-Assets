package ar.aeroplaza;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/* (vuelta 41) Choque.java en la compu: un tombstone de mentira (el protobuf que guarda Android de un choque
   nativo), un ANR y una excepción de Java, y lo que sale para el aviso del juego.
     javac -d /tmp/c android/app/src/main/java/ar/aeroplaza/Choque.java pruebas/choque/PruebaChoque.java
     java -cp /tmp/c ar.aeroplaza.PruebaChoque */
public class PruebaChoque {
  static int bien, mal;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }

  /* un escritor de protobuf mínimo */
  static final class W {
    final ByteArrayOutputStream o = new ByteArrayOutputStream();
    W varint(long v) { while ((v & ~0x7fL) != 0) { o.write((int) ((v & 0x7f) | 0x80)); v >>>= 7; } o.write((int) v); return this; }
    W num(int campo, long v) { varint(campo << 3); return varint(v); }
    W bytes(int campo, byte[] b) { varint((campo << 3) | 2); varint(b.length); o.write(b, 0, b.length); return this; }
    W str(int campo, String s) { return bytes(campo, s.getBytes(StandardCharsets.UTF_8)); }
    W msg(int campo, W m) { return bytes(campo, m.o.toByteArray()); }
    W fijo64(int campo, long v) { varint((campo << 3) | 1); for (int k = 0; k < 8; k++) o.write((int) (v >>> (8 * k)) & 0xff); return this; }
    byte[] b() { return o.toByteArray(); }
  }
  static W marco(String fn, String lib) { return new W().num(1, 0x1234).num(2, 0x7f001234L).str(4, fn).num(5, 16).str(6, lib); }
  static W hilo(int id, String nombre, W... marcos) { W t = new W().num(1, id).str(2, nombre); for (W m : marcos) t.msg(4, m); return t; }

  public static void main(String[] a) {
    /* 1) el choque nativo: el hilo que cayó (tid 4321, GLThread) entre otros dos */
    W ts = new W().num(1, 1).str(2, "google/panther/13:user/release-keys").num(5, 4000).num(6, 4321).num(7, 10123)
        .msg(10, new W().num(1, 11).str(2, "SIGSEGV").num(3, 1).str(4, "SEGV_MAPERR").num(8, 1).fijo64(9, 0))
        .str(14, "")
        .msg(15, new W().str(1, "null pointer dereference"))
        .msg(16, new W().num(1, 4000).msg(2, hilo(4000, "ar.aeroplaza", marco("__epoll_pwait", "/apex/com.android.runtime/lib64/bionic/libc.so"))))
        .msg(16, new W().num(1, 4321).msg(2, hilo(4321, "GLThread 812",
            marco("ArSession_update", "/data/app/~~x/com.google.ar.core-1/lib/arm64/libarcore_c.so"),
            marco("arcore::Tracker::Step()", "/data/app/~~x/com.google.ar.core-1/lib/arm64/libarcore_c.so"),
            marco("Java_com_google_ar_core_Session_nativeUpdate", "/data/app/~~y/ar.aeroplaza-2/lib/arm64/libarcore_sdk_jni.so"),
            marco("art_quick_generic_jni_trampoline", "/apex/com.android.art/lib64/libart.so"))))
        .msg(16, new W().num(1, 4400).msg(2, hilo(4400, "cabeza", marco("syscall", "/apex/com.android.runtime/lib64/bionic/libc.so"))))
        .msg(18, new W().str(1, "main").str(2, "log de mentira .so libfalsa.so"));
    String s = Choque.tombstone(ts.b());
    System.out.println("  (" + s + ")");
    prueba("nativo: la señal, el hilo que cayó y la causa", s.startsWith("SIGSEGV SEGV_MAPERR") && s.contains("[GLThread 812]") && s.contains("null pointer dereference"), "");
    prueba("nativo: sus funciones, juntando las seguidas de la misma biblioteca", s.contains("libarcore_c.so ArSession_update") && !s.contains("Tracker") && s.contains("libarcore_sdk_jni.so") && s.contains("libart.so"), "");
    prueba("nativo: no mezcla los otros hilos", !s.contains("epoll") && !s.contains("cabeza") && !s.contains("libfalsa"), "");
    W ts2 = new W().num(6, 77).msg(10, new W().str(2, "SIGABRT")).str(14, "Check failed: plane != nullptr")
        .msg(16, new W().num(1, 77).msg(2, hilo(77, "hiloMalla", marco("abort", "/apex/com.android.runtime/lib64/bionic/libc.so"), marco("raise", "/apex/com.android.runtime/lib64/bionic/libc.so"), marco("Fundir", "/data/app/x/lib/arm64/libmediapipe_tasks_vision_jni.so"))));
    String s2 = Choque.tombstone(ts2.b());
    prueba("nativo con abort: el mensaje, y abort/raise de libc juntos", s2.contains("SIGABRT") && s2.contains("abort: Check failed: plane != nullptr") && s2.contains("libc.so abort · libmediapipe_tasks_vision_jni.so Fundir"), s2);
    byte[] roto = ("xx\u0001\u0002/data/app/lib/arm64/libGLES_mali.so\u0000zz/system/lib64/libc.so\u0000ÿÿÿ").getBytes(StandardCharsets.ISO_8859_1);
    String s3 = Choque.tombstone(roto);
    prueba("si no es protobuf: las bibliotecas que nombra", s3.equals("libGLES_mali.so · libc.so"), s3);
    prueba("vacío: nada, sin romper", Choque.tombstone(new byte[0]).isEmpty(), "");

    /* 2) el ANR */
    String anr = "----- pid 4000 at 2026-09-27 -----\nSubject: Input dispatching timed out (ar.aeroplaza/.MainActivity is not responding)\n\n"
        + "\"Signal Catcher\" daemon prio=10\n  at x.y(Native method)\n\n"
        + "\"main\" prio=5 tid=1 Blocked\n  | group=\"main\"\n  at android.opengl.GLSurfaceView$GLThreadManager.wait(GLSurfaceView.java:1)\n  at android.opengl.GLSurfaceView.onPause(GLSurfaceView.java:2)\n  at ar.aeroplaza.Ar.iniciar(Ar.java:97)\n  at ar.aeroplaza.MainActivity.iniciarAr(MainActivity.java:167)\n  at android.os.Handler.dispatch(Handler.java:9)\n\n\"GLThread 812\" prio=5\n  at z.w(Native method)\n";
    String sa = Choque.anr(anr);
    System.out.println("  (" + sa + ")");
    prueba("ANR: de qué, y el hilo main hasta lo nuestro", sa.startsWith("Input dispatching timed out") && sa.contains("GLSurfaceView.onPause") && sa.contains("ar.aeroplaza.Ar.iniciar(Ar.java:97)") && !sa.contains("Handler.dispatch") && !sa.contains("x.y"), "");

    /* 3) Java: la causa de abajo y nuestras líneas */
    Throwable e;
    try { rompe(); e = null; } catch (Throwable t) { e = new RuntimeException("envuelta", t); }
    String sj = Choque.java("GLThread 812", e);
    System.out.println("  (" + sj + ")");
    prueba("Java: el hilo, la excepción, la causa y la línea nuestra", sj.startsWith("GLThread 812: RuntimeException envuelta ← SecurityException") && sj.contains("HIGH_SAMPLING_RATE_SENSORS") && sj.contains("PruebaChoque.rompe:"), "");
    prueba("Java: sin comillas ni saltos que rompan el aviso", !sj.contains("\n") && !sj.contains("'") && !sj.contains("\""), "");

    /* 4) cuáles cuentan como cierre */
    prueba("cuentan: choque, nativo, ANR; por memoria solo si se veía; el usuario no", Choque.cuenta(4, 400) && Choque.cuenta(5, 400) && Choque.cuenta(6, 400) && Choque.cuenta(3, 100) && !Choque.cuenta(3, 400)
        && Choque.razon(10) == null && Choque.razon(1) == null && "CRASH_NATIVE".equals(Choque.razon(5)), "");
    prueba("hace cuánto", Choque.hace(30_000).equals("30 s") && Choque.hace(600_000).equals("10 min") && Choque.hace(3 * 3600_000L).equals("3 h"), "");
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal > 0 ? 1 : 0);
  }
  static void rompe() { throw new SecurityException("To use the sampling rate of 0 microseconds, app needs to declare the normal permission \"HIGH_SAMPLING_RATE_SENSORS\".\n'x'"); }
}
