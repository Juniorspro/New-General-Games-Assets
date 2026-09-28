package com.juniorspro.nexoxr;

import android.content.Context;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * EL TECLADO DEL SISTEMA, en el espacio (debajo de la ventana enfocada):
 * letras (con ñ), números y símbolos, mayúsculas, borrar, enter, ".com" y
 * ocultar. Escribe en la ventana que tiene el foco.
 */
final class Teclado {
    interface Destino {
        void escribir(String s);
        void tecla(int codigo);
        void ocultar();
        void sonido();
    }

    private static final String[][] LETRAS = {{"q", "w", "e", "r", "t", "y", "u", "i", "o", "p"}, {"a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"},
            {"z", "x", "c", "v", "b", "n", "m", ",", "."}};
    private static final String[][] SIMBOLOS = {{"1", "2", "3", "4", "5", "6", "7", "8", "9", "0"}, {"@", "#", "$", "_", "&", "-", "+", "(", ")", "/"},
            {"*", "\"", "'", ":", ";", "!", "?", "=", "%"}};
    private boolean mayus, simbolos;
    private final TextView[][] teclas = new TextView[3][10];
    private Destino destino;

    View crear(Context c, Destino d) {
        destino = d;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 10);
        raiz.setPadding(m, m, m, m);
        for (int f = 0; f < 3; f++) {
            LinearLayout fila = new LinearLayout(c);
            fila.setGravity(Gravity.CENTER);
            if (f == 2) fila.addView(especial(c, Iconos.MAYUS, 1.4f, v -> { mayus = !mayus; poner(); }));
            for (int k = 0; k < LETRAS[f].length; k++) {
                final int ff = f, kk = k;
                TextView t = tecla(c, "", 1f, v -> { d.sonido(); String s = (simbolos ? SIMBOLOS : LETRAS)[ff][kk]; d.escribir(mayus ? s.toUpperCase() : s); if (mayus && !simbolos) { mayus = false; poner(); } });
                teclas[f][k] = t;
                fila.addView(t);
            }
            if (f == 2) fila.addView(especial(c, Iconos.BORRAR, 1.4f, v -> { d.sonido(); d.tecla(KeyEvent.KEYCODE_DEL); }));
            raiz.addView(fila, new LinearLayout.LayoutParams(-1, 0, 1));
        }
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER);
        TextView cambio = tecla(c, "?123", 1.5f, null);
        cambio.setOnClickListener(v -> { simbolos = !simbolos; cambio.setText(simbolos ? "abc" : "?123"); poner(); });
        fila.addView(cambio);
        fila.addView(tecla(c, ".com", 1.3f, v -> { d.sonido(); d.escribir(".com"); }));
        fila.addView(tecla(c, "espacio", 4.5f, v -> { d.sonido(); d.escribir(" "); }));
        fila.addView(especial(c, Iconos.ENTER, 1.6f, v -> { d.sonido(); d.tecla(KeyEvent.KEYCODE_ENTER); }));
        fila.addView(especial(c, Iconos.TECLADO, 1.4f, v -> d.ocultar()));
        raiz.addView(fila, new LinearLayout.LayoutParams(-1, 0, 1));
        poner();
        return raiz;
    }

    private void poner() {
        for (int f = 0; f < 3; f++) for (int k = 0; k < LETRAS[f].length; k++) {
            String s = (simbolos ? SIMBOLOS : LETRAS)[f][k];
            teclas[f][k].setText(mayus ? s.toUpperCase() : s);
        }
    }

    private static TextView tecla(Context c, String t, float peso, View.OnClickListener l) {
        TextView v = Estilo.texto(c, t, 20, Estilo.TEXTO, false);
        v.setGravity(Gravity.CENTER);
        v.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.AZUL, Estilo.dp(c, 12)));
        v.setClickable(true);
        v.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -1, peso);
        int m = Estilo.dp(c, 3);
        lp.setMargins(m, m, m, m);
        v.setLayoutParams(lp);
        return v;
    }

    private static View especial(Context c, int icono, float peso, View.OnClickListener l) {
        FrameLayout f = new FrameLayout(c);
        f.setBackground(Estilo.apretable(Estilo.TARJETA_ALTA, Estilo.AZUL, Estilo.dp(c, 12)));
        ImageView i = new ImageView(c);
        i.setImageDrawable(new Iconos(icono, Estilo.TEXTO));
        f.addView(i, new FrameLayout.LayoutParams(Estilo.dp(c, 26), Estilo.dp(c, 26), Gravity.CENTER));
        f.setClickable(true);
        f.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -1, peso);
        int m = Estilo.dp(c, 3);
        lp.setMargins(m, m, m, m);
        f.setLayoutParams(lp);
        return f;
    }
}
