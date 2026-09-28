package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * LA BARRA DE ABAJO (el dock): las apps a la izquierda (con un punto debajo
 * de las que están abiertas), y a la derecha la hora, el wifi, la batería y el
 * botón de los ajustes rápidos.
 */
final class Dock {
    static final String[] APPS = {"biblioteca", "navegador", "galeria", "ajustes"};
    static final int[] ICONOS = {Iconos.APPS, Iconos.WEB, Iconos.GALERIA, Iconos.AJUSTES};
    static final String[] NOMBRES = {"Apps", "Navegador", "Galería", "Ajustes"};

    private final View[] puntos = new View[APPS.length];
    private TextView hora, bateriaTxt;
    private Iconos bateria, wifi;
    private final Handler h = new Handler(Looper.getMainLooper());

    View crear(Context c, Sistema s) {
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.HORIZONTAL);
        raiz.setGravity(Gravity.CENTER_VERTICAL);
        raiz.setBackgroundColor(Estilo.FONDO);
        int m = Estilo.dp(c, 14);
        raiz.setPadding(m * 2, 0, m * 2, 0);
        for (int i = 0; i < APPS.length; i++) {
            final String app = APPS[i];
            LinearLayout col = new LinearLayout(c);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setGravity(Gravity.CENTER);
            FrameLayout b = Estilo.botonIcono(c, ICONOS[i], 58, v -> { s.sonido(Sonido.CLIC); s.abrir(app); });
            b.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 29)));
            col.addView(b);
            View p = new View(c);
            p.setBackground(Estilo.forma(Estilo.TEXTO, Estilo.dp(c, 3)));
            p.setVisibility(View.INVISIBLE);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(Estilo.dp(c, 6), Estilo.dp(c, 6));
            lp.topMargin = Estilo.dp(c, 5);
            col.addView(p, lp);
            puntos[i] = p;
            LinearLayout.LayoutParams lc = new LinearLayout.LayoutParams(-2, -2);
            lc.rightMargin = Estilo.dp(c, 16);
            lc.topMargin = Estilo.dp(c, 11);
            raiz.addView(col, lc);
        }
        View esp = new View(c);
        raiz.addView(esp, new LinearLayout.LayoutParams(0, 1, 1));
        // la hora, el wifi, la batería
        hora = Estilo.texto(c, "", 26, Estilo.TEXTO, true);
        raiz.addView(hora);
        ImageView iw = new ImageView(c);
        wifi = new Iconos(Iconos.WIFI, Estilo.TEXTO);
        iw.setImageDrawable(wifi);
        LinearLayout.LayoutParams lw = new LinearLayout.LayoutParams(Estilo.dp(c, 26), Estilo.dp(c, 26));
        lw.leftMargin = Estilo.dp(c, 22);
        raiz.addView(iw, lw);
        ImageView ib = new ImageView(c);
        bateria = new Iconos(Iconos.BATERIA, Estilo.TEXTO);
        ib.setImageDrawable(bateria);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(Estilo.dp(c, 30), Estilo.dp(c, 30));
        lb.leftMargin = Estilo.dp(c, 14);
        raiz.addView(ib, lb);
        bateriaTxt = Estilo.texto(c, "", 15, Estilo.TEXTO2, false);
        LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(-2, -2);
        lt.leftMargin = Estilo.dp(c, 4);
        raiz.addView(bateriaTxt, lt);
        // los ajustes rápidos
        FrameLayout r = Estilo.botonIcono(c, Iconos.RAPIDOS, 58, v -> { s.sonido(Sonido.CLIC); s.mostrarRapidos(true); });
        r.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 29)));
        LinearLayout.LayoutParams lr = new LinearLayout.LayoutParams(Estilo.dp(c, 58), Estilo.dp(c, 58));
        lr.leftMargin = Estilo.dp(c, 22);
        raiz.addView(r, lr);
        actualizar(c);
        return raiz;
    }

    /** Las que están abiertas (un punto debajo). */
    void abiertas(java.util.Set<String> apps) {
        h.post(() -> { for (int i = 0; i < APPS.length; i++) if (puntos[i] != null) puntos[i].setVisibility(apps.contains(APPS[i]) ? View.VISIBLE : View.INVISIBLE); });
    }

    private void actualizar(Context c) {
        if (hora == null) return;
        hora.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()));
        Intent b = c.getApplicationContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b != null) {
            int nivel = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), esc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            boolean carga = b.getIntExtra(BatteryManager.EXTRA_STATUS, 0) == BatteryManager.BATTERY_STATUS_CHARGING;
            if (nivel >= 0) {
                float f = nivel / (float) esc;
                bateria.nivel = f;
                bateria.color(f < 0.15f && !carga ? Estilo.ROJO : carga ? Estilo.VERDE : Estilo.TEXTO);
                bateriaTxt.setText(Math.round(f * 100) + "%");
            }
        }
        wifi.color(conectado(c) ? Estilo.TEXTO : 0xFF5A5C68);
        h.postDelayed(() -> actualizar(c), 15000);
    }

    static boolean conectado(Context c) {
        try {
            ConnectivityManager cm = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Throwable e) { return false; }
    }
}
