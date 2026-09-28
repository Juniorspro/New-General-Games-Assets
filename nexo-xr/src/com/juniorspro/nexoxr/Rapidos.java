package com.juniorspro.nexoxr;

import android.content.Context;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * LOS AJUSTES RÁPIDOS (arriba del dock): la hora y la fecha, y botones grandes
 * para lo de todos los días: passthrough, el entorno, recentrar, captura,
 * la linterna, el visor, las manos, el teclado, los ajustes y preparar tu
 * espacio (la mesa); y el volumen.
 */
final class Rapidos {
    private TextView hora, fecha, estado;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LinearLayout[] baldosas;
    private TextView entornoTxt;
    private Sistema sis;

    View crear(Context c, Sistema s) {
        sis = s;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 22);
        raiz.setPadding(m, m, m, m);
        // la cabecera: hora, fecha, cerrar
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout hf = new LinearLayout(c);
        hf.setOrientation(LinearLayout.VERTICAL);
        hora = Estilo.texto(c, "", 34, Estilo.TEXTO, true);
        fecha = Estilo.texto(c, "", 14, Estilo.TEXTO2, false);
        hf.addView(hora);
        hf.addView(fecha);
        cab.addView(hf, new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.botonIcono(c, Iconos.CERRAR, 44, v -> { s.sonido(Sonido.CLIC); s.mostrarRapidos(false); }));
        raiz.addView(cab);
        // las baldosas
        GridLayout g = new GridLayout(c);
        g.setColumnCount(5);
        String[] t = {"Passthrough", "Entorno", "Recentrar", "Captura", "Linterna", "Visor", "Manos", "3DoF", "Ajustes", "Tu espacio"};
        int[] ic = {Iconos.OJO, Iconos.MONTANA, Iconos.RECENTRAR, Iconos.CAPTURA, Iconos.LINTERNA, Iconos.VISOR, Iconos.MANO, Iconos.GIRAR, Iconos.AJUSTES, Iconos.MESA};
        baldosas = new LinearLayout[t.length];
        for (int i = 0; i < t.length; i++) {
            final int k = i;
            LinearLayout b = new LinearLayout(c);
            b.setOrientation(LinearLayout.VERTICAL);
            b.setGravity(Gravity.CENTER);
            int p = Estilo.dp(c, 10);
            b.setPadding(p, p + 4, p, p);
            b.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 18)));
            ImageView ii = Estilo.icono(c, ic[i], Estilo.TEXTO, 30);
            b.addView(ii);
            TextView tt = Estilo.texto(c, t[i], 13, Estilo.TEXTO, true);
            tt.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(-2, -2);
            lt.topMargin = Estilo.dp(c, 6);
            b.addView(tt, lt);
            if (i == 1) entornoTxt = tt;
            b.setClickable(true);
            b.setOnClickListener(v -> { s.sonido(Sonido.CLIC); tocar(k); });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / 5, 1f), GridLayout.spec(i % 5, 1f));
            lp.width = 0;
            lp.height = Estilo.dp(c, 86);
            lp.setMargins(Estilo.dp(c, 5), Estilo.dp(c, 5), Estilo.dp(c, 5), Estilo.dp(c, 5));
            g.addView(b, lp);
            baldosas[i] = b;
        }
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(-1, -2);
        lg.topMargin = Estilo.dp(c, 14);
        raiz.addView(g, lg);
        // el volumen
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        SeekBar vol = Estilo.deslizador(c, max, am.getStreamVolume(AudioManager.STREAM_MUSIC), new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar b, int v, boolean u) { if (u) am.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0); }
            public void onStartTrackingTouch(SeekBar b) { }
            public void onStopTrackingTouch(SeekBar b) { }
        });
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        fila.setPadding(Estilo.dp(c, 8), 0, Estilo.dp(c, 8), 0);
        fila.addView(Estilo.icono(c, Iconos.SONIDO, Estilo.TEXTO2, 26));
        fila.addView(vol, new LinearLayout.LayoutParams(0, Estilo.dp(c, 40), 1));
        LinearLayout.LayoutParams lf = new LinearLayout.LayoutParams(-1, -2);
        lf.topMargin = Estilo.dp(c, 12);
        raiz.addView(fila, lf);
        estado = Estilo.texto(c, "", 12, Estilo.TEXTO2, false);
        LinearLayout.LayoutParams le = new LinearLayout.LayoutParams(-1, -2);
        le.topMargin = Estilo.dp(c, 6);
        raiz.addView(estado, le);
        actualizar();
        return raiz;
    }

    private void tocar(int k) {
        Sistema s = sis;
        switch (k) {
            case 0: s.alternarPassthrough(); break;
            case 1: { int e = s.entorno() + 1; if (e >= Entornos.CANTIDAD) e = Entornos.ESPACIO; if (e == Entornos.PASSTHROUGH) e = Entornos.ESPACIO; s.entorno(e); break; }
            case 2: s.recentrar(); break;
            case 3: s.captura(); break;
            case 4: s.linterna(!s.linterna()); break;
            case 5: s.visor(!s.visor()); break;
            case 6: s.cambio("manos", s.ajustes().manos == 1 ? 0 : 1); break;
            case 7: s.cambio("tresDof", s.ajustes().tresDof == 1 ? 0 : 1); break;
            case 9: s.mostrarRapidos(false); s.prepararEspacio(); break;
            default: s.mostrarRapidos(false); s.abrir("ajustes");
        }
        h.postDelayed(this::refrescar, 150);
    }

    private void refrescar() {
        Sistema s = sis;
        if (baldosas == null || s == null) return;
        boolean[] on = {s.entorno() == Entornos.PASSTHROUGH, false, false, false, s.linterna(), s.visor(), s.ajustes().manos == 1, s.ajustes().tresDof == 1, false, false};
        // las que se prenden y apagan: azules cuando están prendidas
        for (int i : new int[]{0, 4, 5, 6, 7})
            baldosas[i].setBackground(Estilo.apretable(on[i] ? Estilo.AZUL : Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(baldosas[0].getContext(), 18)));
        int e = s.entorno();
        entornoTxt.setText(e == Entornos.PASSTHROUGH ? "Entorno" : Entornos.NOMBRES[e]);
    }

    private void actualizar() {
        if (hora == null) return;
        Date d = new Date();
        hora.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(d));
        fecha.setText(new SimpleDateFormat("EEEE d 'de' MMMM", new Locale("es")).format(d));
        if (sis != null) estado.setText(sis.estado());
        refrescar();
        h.postDelayed(this::actualizar, 5000);
    }
}
