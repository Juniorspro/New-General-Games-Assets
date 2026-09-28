package ar.aeroplaza;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/* (vuelta 45) LAS ACTUALIZACIONES SIN APK NUEVA: busca el aviso (aeroplaza/actualizacion.json), baja el juego nuevo,
   lo verifica (Actualizacion.java decide) y lo guarda. Se usa la próxima vez que se abre la app: en medio de una partida
   no se cambia el juego. Se sirve en la misma dirección que el de la APK (…/assets/aeroplaza.html), así lo guardado
   (el localStorage) sigue siendo el mismo.
   - Los archivos: files/juego/aeroplaza.html (el que se usa) y files/juego/nuevo.html (el bajado, que espera a la
     próxima vez). En las preferencias, su número y su sha256.
   - Si se instala una APK más nueva que lo bajado (assets/version.txt), gana la APK y lo bajado se borra.
   - Lo que es Java (el puente, la cámara, ARCore) sí necesita una APK nueva: el aviso lo dice (apk.codigo) y el juego
     avisa. */
final class Actualizador {
  /* dónde se busca el aviso (el que traiga el número más alto gana). El aviso puede traer otras (fuentes): se guardan
     para la próxima vez, así el canal se puede mudar sin APK nueva */
  static final String[] FUENTES = {
    "https://raw.githubusercontent.com/Juniorspro/New-General-Games-Assets/refs/heads/claude/fijate-iszyer/aeroplaza/actualizacion.json",
    "https://jxstudios.pages.dev/aeroplaza/actualizacion.json",
  };
  interface Aviso { void lista(int n, String notas); void apkNueva(int codigo, String url, String notas); }

  final Context ctx; final SharedPreferences prefs; final int apkCodigo; final int nApk; final Aviso aviso;
  final File dir, usado, nuevo;
  volatile String estado = "nada";   // nada · buscando · al-dia · bajando · lista · error …
  int nEnUso; String shaEnUso; boolean deBajada; byte[] servir;

  Actualizador(Context c, SharedPreferences p, int apkCodigo, Aviso a) {
    ctx = c; prefs = p; this.apkCodigo = apkCodigo; aviso = a;
    dir = new File(c.getFilesDir(), "juego"); usado = new File(dir, "aeroplaza.html"); nuevo = new File(dir, "nuevo.html");
    int n = 0; try { n = Integer.parseInt(new String(leerAsset("version.txt"), StandardCharsets.UTF_8).trim()); } catch (Throwable t) { /* APK sin número: 0 */ }
    nApk = n;
  }

  /* al abrir (antes de cargar el juego): lo bajado la vez pasada pasa a ser el que se usa; después, cuál se sirve */
  void alAbrir(String avisoApk) {
    try {
      if (nuevo.exists()) {
        byte[] b = leer(nuevo); int n = prefs.getInt("otaNuevoN", 0); String sha = prefs.getString("otaNuevoSha", "");
        if (n > nApk && Actualizacion.bajadoBien(b, b.length, sha)) {
          if (usado.exists()) usado.delete();
          if (nuevo.renameTo(usado)) prefs.edit().putInt("otaN", n).putString("otaSha", sha).apply();
        }
        if (nuevo.exists()) nuevo.delete();
        prefs.edit().remove("otaNuevoN").remove("otaNuevoSha").apply();
      }
      int n = prefs.getInt("otaN", 0);
      if (usado.exists() && n > nApk) {
        byte[] b = leer(usado); String sha = prefs.getString("otaSha", "");
        if (Actualizacion.bajadoBien(b, b.length, sha)) { servir = Actualizacion.conAviso(b, avisoApk); nEnUso = n; shaEnUso = sha; deBajada = true; return; }
      }
      /* (lo bajado es más viejo que esta APK, o se rompió: se usa el de la APK) */
      if (usado.exists()) usado.delete();
      prefs.edit().remove("otaN").remove("otaSha").apply();
    } catch (Throwable t) { /* ante la duda, el de la APK */ }
    servir = null; deBajada = false; nEnUso = nApk; shaEnUso = null;
  }

  /* busca en otro hilo (unos segundos después de abrir: primero que cargue el juego) */
  void buscar() {
    new Thread(() -> {
      try { Thread.sleep(4000); } catch (InterruptedException e) { return; }
      try { buscarYa(); } catch (Throwable t) { estado = "error " + t.getClass().getSimpleName(); }
    }, "actualizar").start();
  }
  void buscarYa() throws Exception {
    estado = "buscando";
    /* (el sha del juego de la APK, sin lo que se le agrega al armarla: assets/sha.txt. Para no bajar el mismo) */
    if (!deBajada && shaEnUso == null) {
      byte[] a = leerAsset("sha.txt");
      if (a != null) shaEnUso = new String(a, StandardCharsets.UTF_8).trim();
    }
    JSONObject mejor = null; int nMejor = -1;
    for (String f : fuentes()) {
      try {
        JSONObject o = new JSONObject(new String(bajar(f, 64 * 1024), StandardCharsets.UTF_8));
        int n = o.optInt("n", -1); if (n > nMejor) { mejor = o; nMejor = n; }
      } catch (Throwable t) { /* esa fuente no anda: la otra */ }
    }
    if (mejor == null) { estado = "sin-red"; return; }
    /* (el canal nuevo, si el aviso trae uno) */
    JSONArray fs = mejor.optJSONArray("fuentes");
    if (fs != null) {
      JSONArray ok = new JSONArray();
      for (int i = 0; i < fs.length() && i < 4; i++) { String u = fs.optString(i, ""); if (Actualizacion.urlPermitida(u)) ok.put(u); }
      if (ok.length() > 0) prefs.edit().putString("otaFuentes", ok.toString()).apply();
    }
    String notas = mejor.optString("notas", "");
    JSONObject apk = mejor.optJSONObject("apk");
    if (apk != null && apk.optInt("codigo", 0) > apkCodigo) {
      String url = apk.optString("url", ""); aviso.apkNueva(apk.optInt("codigo", 0), Actualizacion.urlPermitida(url) ? url : "", apk.optString("notas", notas));
    }
    JSONObject h = mejor.optJSONObject("html");
    if (h == null) { estado = "al-dia"; return; }
    String url = h.optString("url", ""), sha = h.optString("sha256", ""); int bytes = h.optInt("bytes", 0);
    if (!Actualizacion.urlPermitida(url) || !Actualizacion.conviene(nMejor, nEnUso, sha, shaEnUso, mejor.optInt("apkMin", 1), apkCodigo)) { estado = "al-dia"; return; }
    if (nMejor <= prefs.getInt("otaNuevoN", 0) && nuevo.exists()) { estado = "lista"; return; }
    estado = "bajando";
    byte[] b = bajar(url, 25 * 1024 * 1024);
    if (!Actualizacion.bajadoBien(b, bytes, sha)) { estado = "error: no coincide"; return; }
    if (!dir.exists() && !dir.mkdirs()) { estado = "error: carpeta"; return; }
    File tmp = new File(dir, "bajando.html");
    try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(b); o.getFD().sync(); }
    if (nuevo.exists()) nuevo.delete();
    if (!tmp.renameTo(nuevo)) { estado = "error: guardar"; return; }
    prefs.edit().putInt("otaNuevoN", nMejor).putString("otaNuevoSha", sha).apply();
    estado = "lista";
    aviso.lista(nMejor, notas);
  }

  String[] fuentes() {
    try {
      String g = prefs.getString("otaFuentes", null);
      if (g != null) {
        JSONArray a = new JSONArray(g); java.util.ArrayList<String> l = new java.util.ArrayList<>(java.util.Arrays.asList(FUENTES));
        for (int i = 0; i < a.length(); i++) { String u = a.optString(i, ""); if (Actualizacion.urlPermitida(u) && !l.contains(u)) l.add(0, u); }
        return l.toArray(new String[0]);
      }
    } catch (Throwable t) { /* las de siempre */ }
    return FUENTES;
  }

  /* https, con tiempo y tamaño máximos */
  static byte[] bajar(String u, int max) throws Exception {
    if (!Actualizacion.urlPermitida(u)) throw new SecurityException("no permitida");
    HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
    c.setConnectTimeout(8000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(false); c.setUseCaches(false);
    c.setRequestProperty("User-Agent", "AeroplazaApp"); c.setRequestProperty("Cache-Control", "no-cache");
    try {
      if (c.getResponseCode() != 200) throw new java.io.IOException("HTTP " + c.getResponseCode());
      try (InputStream in = c.getInputStream()) {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n, total = 0;
        while ((n = in.read(buf)) > 0) { total += n; if (total > max) throw new java.io.IOException("muy grande"); o.write(buf, 0, n); }
        return o.toByteArray();
      }
    } finally { c.disconnect(); }
  }
  byte[] leerAsset(String nombre) {
    try (InputStream in = ctx.getAssets().open(nombre)) {
      ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
      while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
      return o.toByteArray();
    } catch (Throwable t) { return null; }
  }
  static byte[] leer(File f) throws Exception {
    try (FileInputStream in = new FileInputStream(f)) {
      ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
      while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
      return o.toByteArray();
    }
  }
}
