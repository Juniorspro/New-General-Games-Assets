package ar.aeroplaza;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/* (vuelta 41, "se me cierra la app al entrar al ARCore") POR QUÉ SE CERRÓ LA VEZ PASADA, en una línea para el
   aviso del juego (sin logcat: se le saca captura). Java puro: se prueba en la compu (pruebas/choque/PruebaChoque.java).
   - una excepción de Java (MainActivity la anota antes de morir): el hilo, la clase, el mensaje y las primeras
     líneas, las nuestras sobre todo;
   - un choque nativo (ARCore, la placa de video, MediaPipe, la WebView): Android 12+ guarda el "tombstone" en
     protobuf (ApplicationExitInfo): la señal, la causa y las primeras funciones del hilo que cayó;
   - un ANR (la interfaz trabada 5 s): de qué, y las primeras líneas del hilo "main".
   Los nombres de lo que pasó van como los da Android (CRASH_NATIVE, ANR…): son iguales en los tres idiomas */
final class Choque {
  private Choque() { }

  /* ApplicationExitInfo.REASON_*: solo las que son un cierre de verdad (no el usuario, no la app misma) */
  static String razon(int r) {
    switch (r) {
      case 2: return "SIGNALED";
      case 3: return "LOW_MEMORY";
      case 4: return "CRASH";
      case 5: return "CRASH_NATIVE";
      case 6: return "ANR";
      case 7: return "INIT_FAILURE";
      case 9: return "EXCESSIVE_RESOURCE";
      case 12: return "DEPENDENCY_DIED";
      default: return null;
    }
  }
  /* (matar por memoria o por señal a una app de fondo es lo normal: cuenta solo si estaba a la vista) */
  static boolean cuenta(int r, int importancia) { return r == 4 || r == 5 || r == 6 || r == 7 || importancia <= 200; }

  static String hace(long ms) {
    long s = Math.max(0, ms / 1000);
    return s < 90 ? s + " s" : s < 5400 ? (s / 60) + " min" : (s / 3600) + " h";
  }
  static String corto(String s, int n) {
    if (s == null) return "";
    s = s.replace('\n', ' ').replace('\r', ' ').replace('\'', '’').replace('"', '”').replace('\\', '/').trim();
    return s.length() <= n ? s : s.substring(0, n - 1) + "…";
  }
  static String base(String ruta) {
    if (ruta == null) return "";
    int i = ruta.lastIndexOf('/'); String b = i >= 0 ? ruta.substring(i + 1) : ruta;
    int j = b.indexOf("!"); return j > 0 ? b.substring(0, j) : b;
  }
  static String clase(String c) { int i = c.lastIndexOf('.'); return i >= 0 ? c.substring(i + 1) : c; }

  static byte[] leer(InputStream in, int tope) throws java.io.IOException {
    ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n;
    while ((n = in.read(b)) > 0 && o.size() < tope) o.write(b, 0, n);
    return o.toByteArray();
  }

  /* ------------------------------------------ Java */
  static String java(String hilo, Throwable e) {
    StringBuilder s = new StringBuilder();
    /* (la causa de abajo de todo: ahí está la línea que falló; el mensaje de afuera, si no es el de ella repetido) */
    Throwable c = e; for (int k = 0; k < 6 && c.getCause() != null && c.getCause() != c; k++) c = c.getCause();
    s.append(corto(hilo, 24)).append(": ").append(e.getClass().getSimpleName());
    if (e.getMessage() != null && (c == e || !e.getMessage().startsWith(c.getClass().getName()))) s.append(' ').append(corto(e.getMessage(), c == e ? 140 : 60));
    if (c != e) { s.append(" ← ").append(c.getClass().getSimpleName()); if (c.getMessage() != null) s.append(' ').append(corto(c.getMessage(), 140)); }
    /* las dos primeras líneas y, de ahí en más, las nuestras (hasta dos) */
    int n = 0, nuestras = 0;
    for (StackTraceElement f : c.getStackTrace()) {
      boolean nuestra = f.getClassName().startsWith("ar.aeroplaza.");
      if (n >= 2 && !nuestra) continue;
      s.append(" · ").append(clase(f.getClassName())).append('.').append(f.getMethodName()).append(':').append(f.getLineNumber());
      if (++n >= 6 || (nuestra && ++nuestras >= 2)) break;
    }
    return s.toString();
  }

  /* ------------------------------------------ ANR (texto) */
  static String anr(String t) {
    StringBuilder s = new StringBuilder();
    String[] L = t.split("\n");
    for (String l : L) if (l.startsWith("Subject:")) { s.append(corto(l.substring(8), 90)); break; }
    boolean main = false; int n = 0;
    for (String l : L) {
      if (l.startsWith("\"main\"")) { main = true; continue; }
      if (!main) continue;
      String x = l.trim();
      if (x.isEmpty()) break;
      if (x.startsWith("at ")) { s.append(s.length() > 0 ? " · " : "").append(corto(x.substring(3), 70)); if (++n >= 4) break; }
    }
    return s.toString();
  }

  /* ------------------------------------------ nativo (el tombstone en protobuf, system/core/debuggerd/proto/tombstone.proto):
     Tombstone { tid = 6; signal_info = 10 { name = 2; code_name = 4 }; abort_message = 14; causes = 15 { human_readable = 1 };
       threads = 16 (map: key = 1, value = 2 Thread { name = 2; current_backtrace = 4 BacktraceFrame { function_name = 4; file_name = 6 } }) } */
  static final class Pb {
    final byte[] b; int i; final int fin;
    int campo, tipo, ini, largo; long valor;
    Pb(byte[] b, int desde, int hasta) { this.b = b; i = desde; fin = hasta; }
    boolean hay() { return i < fin; }
    long varint() {
      long r = 0;
      for (int s = 0; s < 64 && i < fin; s += 7) { int x = b[i++] & 0xff; r |= (long) (x & 0x7f) << s; if (x < 0x80) return r; }
      throw new IllegalStateException("varint");
    }
    void siguiente() {
      long k = varint(); campo = (int) (k >>> 3); tipo = (int) (k & 7);
      if (tipo == 0) valor = varint();
      else if (tipo == 1) i += 8;
      else if (tipo == 2) { long l = varint(); if (l < 0 || i + l > fin) throw new IllegalStateException("largo"); ini = i; largo = (int) l; i += largo; }
      else if (tipo == 5) i += 4;
      else throw new IllegalStateException("tipo " + tipo);
      if (i > fin) throw new IllegalStateException("fin");
    }
    String texto() { return new String(b, ini, largo, StandardCharsets.UTF_8); }
    Pb adentro() { return new Pb(b, ini, ini + largo); }
  }

  static String tombstone(byte[] b) {
    try { String s = leerTombstone(b); if (!s.isEmpty()) return s; } catch (Throwable t) { /* no era protobuf: lo de abajo */ }
    return bibliotecas(b);
  }
  static String leerTombstone(byte[] b) {
    long tid = -1; String sig = "", cod = "", abort = "", causa = "";
    List<int[]> hilos = new ArrayList<>();
    Pb p = new Pb(b, 0, b.length);
    while (p.hay()) {
      p.siguiente();
      if (p.campo == 6 && p.tipo == 0) tid = p.valor;
      else if (p.campo == 10 && p.tipo == 2) { Pb q = p.adentro(); while (q.hay()) { q.siguiente(); if (q.tipo == 2 && q.campo == 2) sig = q.texto(); else if (q.tipo == 2 && q.campo == 4) cod = q.texto(); } }
      else if (p.campo == 14 && p.tipo == 2) abort = p.texto();
      else if (p.campo == 15 && p.tipo == 2 && causa.isEmpty()) { Pb q = p.adentro(); while (q.hay()) { q.siguiente(); if (q.tipo == 2 && q.campo == 1) causa = q.texto(); } }
      else if (p.campo == 16 && p.tipo == 2) hilos.add(new int[] { p.ini, p.largo });
    }
    /* el hilo que cayó (el de tid): su nombre y las primeras funciones, juntando las seguidas de la misma biblioteca */
    String nombre = ""; List<String> marcos = new ArrayList<>(); String ultima = null;
    for (int[] h : hilos) {
      Pb e = new Pb(b, h[0], h[0] + h[1]); long clave = -1; int ti = -1, tl = 0;
      while (e.hay()) { e.siguiente(); if (e.campo == 1 && e.tipo == 0) clave = e.valor; else if (e.campo == 2 && e.tipo == 2) { ti = e.ini; tl = e.largo; } }
      if (ti < 0 || (tid >= 0 && clave != tid)) continue;
      Pb t = new Pb(b, ti, ti + tl);
      while (t.hay()) {
        t.siguiente();
        if (t.campo == 2 && t.tipo == 2) nombre = t.texto();
        else if (t.campo == 4 && t.tipo == 2 && marcos.size() < 5) {
          Pb f = t.adentro(); String fn = "", ar = "";
          while (f.hay()) { f.siguiente(); if (f.tipo == 2 && f.campo == 4) fn = f.texto(); else if (f.tipo == 2 && f.campo == 6) ar = f.texto(); }
          String lib = base(ar);
          if (lib.equals(ultima)) continue;
          ultima = lib; marcos.add(lib + (fn.isEmpty() ? "" : " " + corto(fn, 44)));
        }
      }
      break;
    }
    StringBuilder s = new StringBuilder();
    if (!sig.isEmpty()) s.append(sig).append(cod.isEmpty() ? "" : " " + cod);
    if (!nombre.isEmpty()) s.append(s.length() > 0 ? " · " : "").append('[').append(corto(nombre, 24)).append(']');
    if (!causa.isEmpty()) s.append(" · ").append(corto(causa, 70));
    if (!abort.isEmpty()) s.append(" · abort: ").append(corto(abort, 90));
    for (String m : marcos) s.append(" · ").append(m);
    return s.toString().trim();
  }
  /* (si no se pudo leer: las bibliotecas que nombra, en orden) */
  static String bibliotecas(byte[] b) {
    Set<String> l = new LinkedHashSet<>(); int ini = -1;
    for (int i = 0; i <= b.length && l.size() < 5; i++) {
      boolean imp = i < b.length && b[i] >= 0x20 && b[i] < 0x7f;
      if (imp && ini < 0) ini = i;
      if (!imp && ini >= 0) {
        String x = new String(b, ini, i - ini, StandardCharsets.US_ASCII); ini = -1;
        int k = x.indexOf(".so"); if (k > 0) l.add(base(x.substring(0, k + 3)));
      }
    }
    return String.join(" · ", l);
  }
}
