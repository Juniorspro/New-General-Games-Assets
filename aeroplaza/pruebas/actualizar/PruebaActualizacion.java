package ar.aeroplaza;

import java.nio.charset.StandardCharsets;

/* (vuelta 45) Actualizacion.java sin Android: de dónde se puede bajar, cuándo conviene, si lo bajado está bien y el aviso.
     javac -d <dir> android/app/src/main/java/ar/aeroplaza/Actualizacion.java pruebas/actualizar/PruebaActualizacion.java
     java -cp <dir> ar.aeroplaza.PruebaActualizacion */
public class PruebaActualizacion {
  static int bien = 0, mal = 0;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }
  public static void main(String[] a) {
    String R = "https://raw.githubusercontent.com/Juniorspro/New-General-Games-Assets/";
    prueba("se baja del repo (fijado a un commit o de la rama) y del sitio de JXStudios",
      Actualizacion.urlPermitida(R + "0123abc/aeroplaza/aeroplaza.html") && Actualizacion.urlPermitida(R + "refs/heads/claude/fijate-iszyer/aeroplaza/actualizacion.json")
      && Actualizacion.urlPermitida("https://jxstudios.pages.dev/aeroplaza/actualizacion.json"), "");
    String[] no = { "http://raw.githubusercontent.com/Juniorspro/New-General-Games-Assets/x", "https://raw.githubusercontent.com/otro/repo/x", "https://evil.com/Juniorspro/New-General-Games-Assets/x",
      "https://raw.githubusercontent.com.evil.com/Juniorspro/New-General-Games-Assets/x", "https://jxstudios.pages.dev.evil.com/x", R + "../../otro/x", "https://user@jxstudios.pages.dev/x", null, "" };
    boolean ok = true; StringBuilder s = new StringBuilder(); for (String u : no) if (Actualizacion.urlPermitida(u)) { ok = false; s.append(u).append(' '); }
    prueba("y de ningún otro lado (http, otro repo, hosts parecidos, .., usuario@)", ok, s.toString());
    String sha = Actualizacion.sha256("hola".getBytes(StandardCharsets.UTF_8)), otro = Actualizacion.sha256("chau".getBytes(StandardCharsets.UTF_8));
    prueba("el sha256 es el de siempre", "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79".equals(sha), sha);
    prueba("conviene: más nuevo, distinto y para esta APK",
      Actualizacion.conviene(3, 2, sha, otro, 1, 45) && !Actualizacion.conviene(2, 2, sha, otro, 1, 45) && !Actualizacion.conviene(1, 2, sha, otro, 1, 45)
      && !Actualizacion.conviene(3, 2, sha, sha, 1, 45) && !Actualizacion.conviene(3, 2, sha, otro, 46, 45) && !Actualizacion.conviene(3, 2, "no-es-un-sha", otro, 1, 45)
      && Actualizacion.conviene(3, 0, sha, null, 1, 45), "");
    byte[] j = new byte[5000]; for (int i = 0; i < j.length; i++) j[i] = (byte) (i * 7);
    String sj = Actualizacion.sha256(j); byte[] roto = j.clone(); roto[100] ^= 1;
    prueba("lo bajado se usa solo si está entero y sin cambios",
      Actualizacion.bajadoBien(j, 5000, sj) && !Actualizacion.bajadoBien(j, 4999, sj) && !Actualizacion.bajadoBien(roto, 5000, sj) && !Actualizacion.bajadoBien(null, 0, sj)
      && !Actualizacion.bajadoBien(new byte[10], 10, Actualizacion.sha256(new byte[10])), "");
    String h = new String(Actualizacion.conAviso("<!doctype html><html><head><title>x</title>".getBytes(StandardCharsets.UTF_8), "<script>window.AEROPLAZA_APK=true</script>"), StandardCharsets.UTF_8);
    prueba("al bajado se le pone el aviso de la APK justo después de <head>", h.equals("<!doctype html><html><head>\n<script>window.AEROPLAZA_APK=true</script><title>x</title>"), h);
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal == 0 ? 0 : 1);
  }
}
