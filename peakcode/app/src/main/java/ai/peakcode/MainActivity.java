package ai.peakcode;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;

// La interfaz es una pagina local dentro del APK. Por que asi y no nativo:
// el repo ya sabe hacer interfaces web (frutiger-aero es un escritorio entero
// en una pagina), asi que se reusa todo eso en vez de aprender Compose.
public class MainActivity extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // para guardar la clave y el historial
        w.loadUrl("file:///android_asset/index.html");
        setContentView(w);
    }
}
