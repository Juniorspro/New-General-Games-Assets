package com.juniorspro.nexoxr;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Locale;

/**
 * LAS ACTUALIZACIONES: Nexo se fija solo si hay una versión nueva publicada,
 * la baja, revisa que sea la que dice ser y la instala (el teléfono pide que
 * confirmes; desde Android 12, después de la primera, ni eso).
 *
 * Lo publicado es una carpeta con dos archivos (lo arma publicar.sh):
 *   version.json      {versionCode, versionName, apk, bytes, sha256, firma, notas, fecha, feed?}
 *   nexo-xr-N.apk     cada versión con su nombre (así nunca llega una vieja de una caché)
 *
 * Todo pasa por acá (un solo estado para toda la app); las pantallas se
 * anotan con {@link #mirar} y se enteran de cada cambio en el hilo de la UI.
 */
final class Actualizador {
    /** Dónde se publica (el repo es público). "feed" en el json puede mudarlo para las próximas. */
    static final String[] FEEDS = {
            "https://raw.githubusercontent.com/Juniorspro/New-General-Games-Assets/claude/hola-80z86i/nexo-xr/actualizacion/version.json",
            "https://raw.githack.com/Juniorspro/New-General-Games-Assets/claude/hola-80z86i/nexo-xr/actualizacion/version.json"};
    static final long CADA = 6 * 3600_000L;   // se fija solo cada 6 h (y al abrir)

    static final int NADA = 0, BUSCANDO = 1, AL_DIA = 2, HAY = 3, BAJANDO = 4, INSTALANDO = 5, ERROR = 6, PERMISO = 7;

    interface Mira { void cambio(Actualizador a); }

    private static Actualizador uno;
    static synchronized Actualizador de(Context c) {
        if (uno == null) uno = new Actualizador(c.getApplicationContext());
        return uno;
    }

    private final Context app;
    private final SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ArrayList<Mira> miran = new ArrayList<>();

    // lo que se ve (lo leen las pantallas)
    volatile int estado = NADA;
    volatile String mensaje = "";
    volatile float progreso;
    /** La versión publicada (cuando hay). */
    volatile int nuevaCodigo;
    volatile String nuevaNombre = "", notas = "";
    final int instalada;
    final String instaladaNombre;
    /** Cuando aparece una nueva: el sistema abre la ventana para avisar. */
    Runnable alHaber;

    private String apkUrl, sha256, firma, baseUrl;
    private long bytes;
    private volatile boolean ocupado;

    private Actualizador(Context c) {
        app = c;
        prefs = c.getSharedPreferences("actualizacion", Context.MODE_PRIVATE);
        int v = 0;
        String n = "?";
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            v = pi.versionCode;
            n = pi.versionName;
        } catch (Exception ignorada) { }
        instalada = v;
        instaladaNombre = n;
    }

    // ── las pantallas ──

    void mirar(Mira m) { synchronized (miran) { if (!miran.contains(m)) miran.add(m); } avisar(); }
    void dejar(Mira m) { synchronized (miran) { miran.remove(m); } }

    private void avisar() {
        ui.post(() -> {
            ArrayList<Mira> l;
            synchronized (miran) { l = new ArrayList<>(miran); }
            for (Mira m : l) try { m.cambio(this); } catch (Throwable ignorada) { }
        });
    }

    private void poner(int e, String msj) { estado = e; mensaje = msj == null ? "" : msj; avisar(); }

    /** Se tocó "Después": no vuelve a abrir la ventana sola por esta versión (en Ajustes sigue). */
    void despues() { prefs.edit().putInt("salteada", nuevaCodigo).apply(); }

    /** Al abrir Nexo: si recién se actualizó, qué trajo (una vez). */
    String novedades() {
        int antes = prefs.getInt("vista", 0);
        if (antes == instalada) return null;
        prefs.edit().putInt("vista", instalada).apply();
        if (antes == 0) return null;   // la primera vez que se abre esta instalación
        String n = prefs.getString("notas_" + instalada, "");
        return "Nexo se actualizó a la " + instaladaNombre + (n.isEmpty() ? "." : ": " + n);
    }

    // ── buscar ──

    /** Si toca (al abrir y cada 6 h), se fija solo. */
    void quizas() {
        if (System.currentTimeMillis() - prefs.getLong("ultima", 0) > CADA || estado == NADA) buscar(false);
    }

    void buscar(boolean aMano) {
        if (ocupado) return;
        ocupado = true;
        poner(BUSCANDO, "Buscando…");
        new Thread(() -> {
            try {
                String error = null;
                JSONObject j = null;
                ArrayList<String> feeds = new ArrayList<>();
                String propio = prefs.getString("feed", null);
                if (propio != null) feeds.add(propio);
                for (String f : FEEDS) if (!feeds.contains(f)) feeds.add(f);
                for (String f : feeds) {
                    try {
                        j = new JSONObject(new String(bajarChico(f + "?t=" + System.currentTimeMillis()), "UTF-8"));
                        baseUrl = f.substring(0, f.lastIndexOf('/') + 1);
                        break;
                    } catch (Exception e) { error = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : ""); }
                }
                if (j == null) { poner(ERROR, "No se pudo ver si hay una nueva (" + error + ")."); return; }
                prefs.edit().putLong("ultima", System.currentTimeMillis()).apply();
                String feed = j.optString("feed", "");
                if (feed.startsWith("https://")) prefs.edit().putString("feed", feed).apply();
                nuevaCodigo = j.getInt("versionCode");
                nuevaNombre = j.optString("versionName", String.valueOf(nuevaCodigo));
                notas = j.optString("notas", "");
                String apk = j.getString("apk");
                apkUrl = apk.startsWith("https://") ? apk : baseUrl + apk;
                sha256 = j.optString("sha256", "").toLowerCase(Locale.ROOT);
                firma = j.optString("firma", "").toLowerCase(Locale.ROOT);
                bytes = j.optLong("bytes", -1);
                if (nuevaCodigo <= instalada) { poner(AL_DIA, "Tenés la última (" + instaladaNombre + ")."); return; }
                prefs.edit().putString("notas_" + nuevaCodigo, notas).apply();
                poner(HAY, "Hay una nueva: la " + nuevaNombre + ".");
                if (!aMano && prefs.getInt("salteada", 0) != nuevaCodigo && alHaber != null) alHaber.run();
            } catch (Exception e) {
                poner(ERROR, "La publicación vino rara: " + e.getMessage());
            } finally { ocupado = false; }
        }, "nexo-buscar").start();
    }

    private static byte[] bajarChico(String url) throws Exception {
        HttpURLConnection h = abrir(url);
        try (InputStream in = h.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) { b.write(buf, 0, n); if (b.size() > 256 * 1024) throw new Exception("demasiado grande"); }
            return b.toByteArray();
        } finally { h.disconnect(); }
    }

    private static HttpURLConnection abrir(String url) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(12000);
        h.setReadTimeout(20000);
        h.setUseCaches(false);
        h.setRequestProperty("Cache-Control", "no-cache");
        h.setInstanceFollowRedirects(true);
        int cod = h.getResponseCode();
        if (cod != 200) { h.disconnect(); throw new Exception("HTTP " + cod); }
        return h;
    }

    // ── bajar e instalar ──

    private File archivo() { return new File(app.getCacheDir(), "nexo-" + nuevaCodigo + ".apk"); }

    /** "Actualizar": baja (si hace falta), revisa e instala. */
    void actualizar() {
        if (ocupado || apkUrl == null) return;
        // Android 8+: primero el permiso de instalar apps (una vez, en los ajustes del teléfono)
        if (Build.VERSION.SDK_INT >= 26 && !app.getPackageManager().canRequestPackageInstalls()) {
            poner(PERMISO, "Falta un permiso: activá \"Permitir de esta fuente\" para Nexo y volvé.");
            try {
                app.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + app.getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e) { poner(ERROR, "No se pudo abrir el permiso: " + e.getMessage()); }
            return;
        }
        // si la publicada viene con otra llave, ni bajarla: avisar ya
        try {
            String mia = huella(app.getPackageManager().getPackageInfo(app.getPackageName(), PackageManager.GET_SIGNATURES).signatures[0]);
            if (!firma.isEmpty() && !firma.equals(mia)) {
                poner(ERROR, "La " + nuevaNombre + " viene firmada con otra llave: el teléfono no la deja instalar encima. "
                        + "Desinstalá Nexo e instalá el APK a mano una vez (después sigue actualizándose solo).");
                return;
            }
        } catch (Exception ignorada) { }
        ocupado = true;
        progreso = 0;
        poner(BAJANDO, "Bajando la " + nuevaNombre + "…");
        new Thread(() -> {
            try {
                File f = archivo();
                if (!(f.exists() && (bytes < 0 || f.length() == bytes) && hash(f).equals(sha256))) bajar(f);
                String problema = revisar(f);
                if (problema != null) { f.delete(); poner(ERROR, problema); return; }
                poner(INSTALANDO, "Instalando… Confirmá en el teléfono (si estás en el visor, sacalo un momento).");
                instalar(f);
            } catch (Exception e) {
                poner(ERROR, "No se pudo bajar: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            } finally { ocupado = false; }
        }, "nexo-bajar").start();
    }

    private void bajar(File f) throws Exception {
        for (File viejo : app.getCacheDir().listFiles()) if (viejo.getName().startsWith("nexo-") && viejo.getName().endsWith(".apk")) viejo.delete();
        File parte = new File(f.getPath() + ".parte");
        HttpURLConnection h = abrir(apkUrl);
        long total = h.getContentLengthLong() > 0 ? h.getContentLengthLong() : bytes;
        try (InputStream in = h.getInputStream(); OutputStream out = new FileOutputStream(parte)) {
            byte[] buf = new byte[64 * 1024];
            long hecho = 0, ultimo = 0;
            for (int n; (n = in.read(buf)) > 0; ) {
                out.write(buf, 0, n);
                hecho += n;
                if (total > 0 && hecho - ultimo > 256 * 1024) { ultimo = hecho; progreso = hecho / (float) total; avisar(); }
            }
        } finally { h.disconnect(); }
        progreso = 1;
        if (!parte.renameTo(f)) throw new Exception("no se pudo guardar");
    }

    /** null si está bien; si no, qué pasa (para mostrar). */
    private String revisar(File f) throws Exception {
        if (bytes > 0 && f.length() != bytes) return "Se bajó incompleta: probá de nuevo.";
        if (!sha256.isEmpty() && !hash(f).equals(sha256))
            return "La que se bajó no es la publicada (quizás se está publicando justo ahora): probá en unos minutos.";
        PackageManager pm = app.getPackageManager();
        PackageInfo nueva = pm.getPackageArchiveInfo(f.getPath(), PackageManager.GET_SIGNATURES);
        if (nueva == null || !app.getPackageName().equals(nueva.packageName)) return "Lo que se bajó no es Nexo.";
        if (nueva.versionCode <= instalada) return "La publicada no es más nueva que la tuya.";
        // la firma: si no es la misma llave, Android no la deja instalar encima
        PackageInfo mia = pm.getPackageInfo(app.getPackageName(), PackageManager.GET_SIGNATURES);
        if (nueva.signatures != null && nueva.signatures.length > 0 && mia.signatures != null && mia.signatures.length > 0
                && !huella(nueva.signatures[0]).equals(huella(mia.signatures[0])))
            return "La " + nuevaNombre + " viene firmada con otra llave: el teléfono no la deja instalar encima. "
                    + "Desinstalá Nexo e instalá el APK a mano una vez (después sigue actualizándose solo).";
        return null;
    }

    private void instalar(File f) throws Exception {
        PackageInstaller pi = app.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(app.getPackageName());
        sp.setSize(f.length());
        // Android 12+: si Nexo ya fue quien se instaló, se actualiza sin preguntar
        if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(sp);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(f); OutputStream out = s.openWrite("nexo.apk", 0, f.length())) {
                byte[] buf = new byte[64 * 1024];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                s.fsync(out);
            }
            Intent i = new Intent(app, Instalacion.class).setAction(Instalacion.ACCION);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(app, id, i, flags).getIntentSender());
        }
    }

    /** Lo que contesta el instalador del teléfono (desde {@link Instalacion}). */
    void resultado(int status, String msj) {
        switch (status) {
            case PackageInstaller.STATUS_SUCCESS: poner(AL_DIA, "Listo: abrí Nexo de nuevo."); break;
            case PackageInstaller.STATUS_FAILURE_ABORTED: poner(HAY, "Cancelaste la instalación. Cuando quieras, tocá Actualizar."); break;
            case PackageInstaller.STATUS_FAILURE_CONFLICT:
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE:
                poner(ERROR, "El teléfono no la deja instalar encima (" + msj + "). Desinstalá Nexo e instalá el APK a mano una vez.");
                break;
            case PackageInstaller.STATUS_FAILURE_STORAGE: poner(ERROR, "No hay lugar en el teléfono para instalarla."); break;
            default: poner(ERROR, "No se instaló" + (msj != null ? ": " + msj : "."));
        }
    }

    // ── cuentas ──

    static String hash(File f) throws Exception {
        MessageDigest d = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            for (int n; (n = in.read(buf)) > 0; ) d.update(buf, 0, n);
        }
        return hex(d.digest());
    }

    static String huella(Signature s) throws Exception { return hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())); }

    static String hex(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format(Locale.ROOT, "%02x", x & 0xff));
        return s.toString();
    }

    /** Para mostrar: 18.4 MB. */
    String tamano() { return bytes > 0 ? String.format(Locale.ROOT, "%.1f MB", bytes / 1048576f) : ""; }
}
