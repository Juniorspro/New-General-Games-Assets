package ai.peakcode;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;

// La interfaz es una pagina local dentro del APK. Por que asi y no nativo: este
// repo ya sabe hacer interfaces web (frutiger-aero es un escritorio entero en
// una pagina), asi que se reusa en vez de aprender Compose.
//
// El puente le da al JavaScript las dos cosas que una pagina no puede hacer
// sola: leer un archivo que el usuario elija, y guardar un archivo en Descargas.
public class MainActivity extends Activity {

    private WebView web;
    private static final int PEDIR_ARCHIVO = 7001;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);        // guarda la clave, el modelo y el historial
        web.addJavascriptInterface(new Puente(), "Peak");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    /** Devuelve al JavaScript llamando a una funcion global. */
    private void avisar(String funcion, String json) {
        runOnUiThread(() -> web.evaluateJavascript(funcion + "(" + json + ")", null));
    }

    private static String aJson(String s) {
        StringBuilder o = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"':  o.append("\\\""); break;
                case '\\': o.append("\\\\"); break;
                case '\n': o.append("\\n");  break;
                case '\r': o.append("\\r");  break;
                case '\t': o.append("\\t");  break;
                default:
                    if (c < 0x20) o.append(String.format("\\u%04x", (int) c));
                    else o.append(c);
            }
        }
        return o.append('"').toString();
    }

    public class Puente {
        /** Guarda texto en Descargas. Devuelve el nombre o un error. */
        @JavascriptInterface
        public String guardar(String nombre, String contenido) {
            try {
                if (nombre == null || nombre.trim().isEmpty()) nombre = "peakcode.txt";
                // MediaStore es la via que no necesita permisos en Android 10+.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/PeakCode");
                    Uri u = getContentResolver().insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) return "ERROR: no pude crear el archivo";
                    OutputStream o = getContentResolver().openOutputStream(u);
                    o.write(contenido.getBytes("UTF-8"));
                    o.close();
                    return "Download/PeakCode/" + nombre;
                }
                // En Android 9 y anteriores no hay MediaStore de Descargas:
                // se guarda dentro de la app, que no necesita permiso.
                java.io.File f = new java.io.File(getExternalFilesDir(null), nombre);
                java.io.FileOutputStream o = new java.io.FileOutputStream(f);
                o.write(contenido.getBytes("UTF-8"));
                o.close();
                return f.getAbsolutePath();
            } catch (Exception e) {
                return "ERROR: " + e.getMessage();
            }
        }

        /** Abre el selector. La respuesta vuelve por window.peakArchivoLeido. */
        @JavascriptInterface
        public void abrir() {
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.setType("*/*");
            i.addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(Intent.createChooser(i, "Elegí un archivo"),
                                   PEDIR_ARCHIVO);
        }

        /** Copia al portapapeles: el plan B cuando Termux no acepta comandos. */
        @JavascriptInterface
        public void copiar(String texto) {
            android.content.ClipboardManager cm =
                (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            cm.setPrimaryClip(android.content.ClipData.newPlainText("PeakCode", texto));
            runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Comando copiado", Toast.LENGTH_SHORT).show());
        }

        /** ¿Esta Termux instalado? Necesita el <queries> del manifest. */
        @JavascriptInterface
        public boolean hayTermux() {
            try {
                getPackageManager().getPackageInfo("com.termux", 0);
                return true;
            } catch (Exception e) { return false; }
        }

        /**
         * Manda el comando a Termux. Solo funciona si Termux tiene
         * allow-external-apps=true en su termux.properties; si no, tira y se
         * devuelve false para que la pagina ofrezca copiar y pegar a mano.
         */
        @JavascriptInterface
        public boolean correrEnTermux(String comando) {
            try {
                Intent i = new Intent();
                i.setClassName("com.termux", "com.termux.app.RunCommandService");
                i.setAction("com.termux.RUN_COMMAND");
                i.putExtra("com.termux.RUN_COMMAND_PATH",
                           "/data/data/com.termux/files/usr/bin/bash");
                i.putExtra("com.termux.RUN_COMMAND_ARGUMENTS",
                           new String[]{"-c", comando});
                i.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
                startService(i);
                return true;
            } catch (Exception e) { return false; }
        }

        /** Abre Termux a secas, o su ficha en F-Droid si no esta. */
        @JavascriptInterface
        public void abrirTermux() {
            try {
                Intent i = getPackageManager().getLaunchIntentForPackage("com.termux");
                if (i != null) { startActivity(i); return; }
            } catch (Exception e) { }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://f-droid.org/packages/com.termux/")));
            } catch (Exception e) { }
        }

        @JavascriptInterface
        public void aviso(String t) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, t,
                                               Toast.LENGTH_SHORT).show());
        }
    }

    @Override protected void onActivityResult(int codigo, int resultado, Intent datos) {
        super.onActivityResult(codigo, resultado, datos);
        if (codigo != PEDIR_ARCHIVO || resultado != RESULT_OK || datos == null
            || datos.getData() == null) return;
        new Thread(() -> {
            try {
                Uri u = datos.getData();
                String nombre = u.getLastPathSegment();
                if (nombre != null && nombre.contains("/"))
                    nombre = nombre.substring(nombre.lastIndexOf('/') + 1);
                StringBuilder sb = new StringBuilder();
                BufferedReader r = new BufferedReader(new InputStreamReader(
                        getContentResolver().openInputStream(u), "UTF-8"));
                String l; int leidos = 0;
                // Techo de 200 mil caracteres: mas que eso no entra en el
                // contexto de los modelos libres y cuelga la pagina.
                while ((l = r.readLine()) != null && leidos < 200000) {
                    sb.append(l).append('\n'); leidos += l.length();
                }
                r.close();
                avisar("window.peakArchivoLeido",
                       "{\"nombre\":" + aJson(nombre == null ? "archivo" : nombre)
                       + ",\"texto\":" + aJson(sb.toString()) + "}");
            } catch (Exception e) {
                avisar("window.peakArchivoLeido",
                       "{\"error\":" + aJson(String.valueOf(e.getMessage())) + "}");
            }
        }).start();
    }
}
