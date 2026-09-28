package ar.aeroplaza;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/* (vuelta 45) LAS ACTUALIZACIONES SIN APK NUEVA: lo que decide, sin nada de Android (se prueba con javac:
   pruebas/actualizar/PruebaActualizacion.java). El resto (bajar, guardar, servir) está en Actualizador.java.
   - El aviso (aeroplaza/actualizacion.json, lo escribe herramientas/publicar.mjs) dice el número de versión, de dónde
     se baja el juego (fijado a un commit: no cambia aunque la rama siga), su sha256 y sus bytes, y la APK mínima.
   - Solo se baja de lugares conocidos, por https: el repo público de GitHub o el sitio de JXStudios. */
final class Actualizacion {
  static final String REPO = "/Juniorspro/New-General-Games-Assets/";
  /* ¿se puede bajar de acá? (el aviso y el juego: el juego corre con el puente a la cámara y los sensores) */
  static boolean urlPermitida(String u) {
    if (u == null || !u.startsWith("https://") || u.contains("..") || u.contains("@")) return false;
    String resto = u.substring(8); int barra = resto.indexOf('/'); if (barra <= 0) return false;
    String host = resto.substring(0, barra).toLowerCase(java.util.Locale.ROOT), camino = resto.substring(barra);
    if (host.equals("raw.githubusercontent.com")) return camino.startsWith(REPO);
    return host.equals("jxstudios.pages.dev");
  }
  /* ¿conviene bajarlo? más nuevo que el que se usa, distinto (el mismo sha no se baja) y para esta APK */
  static boolean conviene(int nRemota, int nLocal, String shaRemota, String shaLocal, int apkMin, int apkCodigo) {
    if (nRemota <= nLocal || apkMin > apkCodigo) return false;
    return shaRemota != null && shaRemota.matches("[0-9a-f]{64}") && !shaRemota.equals(shaLocal);
  }
  /* ¿lo bajado es lo que dice el aviso? (entero y sin cambios: si no, se tira) */
  static boolean bajadoBien(byte[] b, int bytes, String sha) {
    if (b == null || b.length != bytes || b.length < 1000) return false;
    String s = sha256(b); return s != null && s.equals(sha);
  }
  static String sha256(byte[] b) {
    try {
      byte[] h = MessageDigest.getInstance("SHA-256").digest(b); StringBuilder s = new StringBuilder(64);
      for (byte x : h) s.append(String.format("%02x", x & 0xff));
      return s.toString();
    } catch (Exception e) { return null; }
  }
  /* el juego bajado, con lo mismo que la APK le pone al suyo al armarla (herramientas/apk.mjs: que corre en la APK y
     de dónde sale el modelo de las manos), justo después de <head> */
  static byte[] conAviso(byte[] html, String aviso) {
    if (aviso == null || aviso.isEmpty()) return html;
    String s = new String(html, StandardCharsets.UTF_8); int i = s.indexOf("<head>");
    if (i < 0) return html;
    return (s.substring(0, i + 6) + "\n" + aviso + s.substring(i + 6)).getBytes(StandardCharsets.UTF_8);
  }
}
