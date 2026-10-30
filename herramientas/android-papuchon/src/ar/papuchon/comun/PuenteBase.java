package ar.papuchon.comun;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Lo que las dos apps (Estudio y Miniaturas) le piden a Android desde la página:
 * descargar archivos a Descargas/Papuchon (con su aviso de "descarga completa",
 * como cualquier descarga), compartir, trabajar en segundo plano y abrir links.
 * El archivo llega en pedazos base64 (un video pesa decenas de MB).
 */
public class PuenteBase {
    protected final Activity act;
    private final Map<String, Object[]> abiertos = new HashMap<>();   // id → {OutputStream, Uri o File, nombre, mime}
    private int siguiente = 0;

    public PuenteBase(Activity act) { this.act = act; }

    /** Antes de Android 10 hace falta permiso para escribir en Descargas: se pide al abrir la app. */
    public static void pedirPermisos(Activity a) {
        if (Build.VERSION.SDK_INT <= 28 && a.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
            a.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 41);
    }
    void pedirNotificaciones() {
        if (Build.VERSION.SDK_INT >= 33 && act.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
            act.runOnUiThread(() -> act.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 42));
    }

    @JavascriptInterface
    public String abrir(String nombre, String mime) {
        try {
            String id = "a" + (++siguiente);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Papuchon");
                cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri u = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (u == null) return "error:Android no dejó crear el archivo";
                abiertos.put(id, new Object[]{act.getContentResolver().openOutputStream(u), u, nombre, mime});
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Papuchon");
                if (act.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) dir = new File(act.getExternalFilesDir(null), "Papuchon");
                if (!dir.exists() && !dir.mkdirs()) return "error:no se pudo crear la carpeta";
                File f = new File(dir, nombre);
                for (int n = 1; f.exists(); n++) { int p = nombre.lastIndexOf('.'); f = new File(dir, (p > 0 ? nombre.substring(0, p) : nombre) + " (" + n + ")" + (p > 0 ? nombre.substring(p) : "")); }
                abiertos.put(id, new Object[]{new FileOutputStream(f), f, nombre, mime});
            }
            return id;
        } catch (Exception e) { return "error:" + e.getMessage(); }
    }

    @JavascriptInterface
    public boolean escribir(String id, String b64) {
        Object[] a = abiertos.get(id); if (a == null) return false;
        try { ((OutputStream) a[0]).write(Base64.decode(b64, Base64.DEFAULT)); return true; } catch (IOException e) { return false; }
    }

    @JavascriptInterface
    public String cerrar(String id, boolean compartir) {
        Object[] a = abiertos.remove(id); if (a == null) return "error:no estaba abierto";
        try {
            ((OutputStream) a[0]).close();
            final String nombre = (String) a[2], mime = (String) a[3];
            if (a[1] instanceof Uri) {
                Uri u = (Uri) a[1];
                ContentValues cv = new ContentValues(); cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                act.getContentResolver().update(u, cv, null, null);
                listo(u, nombre, mime, compartir);
                return u.toString();
            }
            File f = (File) a[1];
            MediaScannerConnection.scanFile(act, new String[]{f.getAbsolutePath()}, new String[]{mime}, (ruta, u) -> listo(u, nombre, mime, compartir));
            return f.getAbsolutePath();
        } catch (IOException e) { return "error:" + e.getMessage(); }
    }

    /** Descarga terminada: aviso como el de Chrome (tocándolo se abre) y, si se pidió, compartir. */
    void listo(Uri u, String nombre, String mime, boolean compartir) {
        act.runOnUiThread(() -> {
            if (compartir && u != null) {
                Intent i = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.startActivity(Intent.createChooser(i, "Compartir " + nombre));
                return;
            }
            Toast.makeText(act, "Descargado en Descargas/Papuchon", Toast.LENGTH_SHORT).show();
            Trabajo.canales(act);
            android.app.Notification.Builder b = Trabajo.base(act, Trabajo.CANAL_LISTO).setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Descarga completa").setContentText(nombre + " · Descargas/Papuchon").setAutoCancel(true);
            if (u != null) {
                Intent ver = new Intent(Intent.ACTION_VIEW).setDataAndType(u, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                b.setContentIntent(PendingIntent.getActivity(act, Trabajo.nListo, ver, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            }
            ((NotificationManager) act.getSystemService(Context.NOTIFICATION_SERVICE)).notify(Trabajo.nListo++, b.build());
        });
    }

    @JavascriptInterface public boolean puedeCompartir() { return true; }

    /** Trabajo largo (exportar, crear): la app sigue aunque se salga o se apague la pantalla. */
    @JavascriptInterface
    public void trabajo(String estado, String titulo, String texto, int avance) {
        if ("inicio".equals(estado)) pedirNotificaciones();
        Trabajo.actualizar(act, estado, titulo, texto, avance);
    }

    @JavascriptInterface
    public void abrirLink(String url) {
        act.runOnUiThread(() -> { try { act.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* sin navegador */ } });
    }

    @JavascriptInterface
    public void compartirTexto(String texto) {
        act.runOnUiThread(() -> act.startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto), "Mandar")));
    }
}
