package com.juniorspro.nexoxr;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

/** LA BIENVENIDA: cómo se usa (los gestos, los botones), la primera vez y desde Apps. */
final class Bienvenida {
    View crear(Context c, Sistema s, Runnable cerrar) {
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 26);
        raiz.setPadding(m, m, m, m);
        raiz.addView(Estilo.texto(c, "Bienvenido a Nexo", 28, Estilo.TEXTO, true));
        TextView sub = Estilo.texto(c, "Tus pantallas en el espacio. Así se usa:", 15, Estilo.TEXTO2, false);
        sub.setPadding(0, Estilo.dp(c, 4), 0, Estilo.dp(c, 16));
        raiz.addView(sub);
        String[][] pasos = {
                {"Doble pellizco para hacer clic", "Apuntá a algo y juntá el pulgar con el índice dos veces rápido (el cursor se pone celeste después del primero). En el segundo, sostené y mové para hacer scroll o arrastrar."},
                {"Tocá con el dedo", "Las pantallas cercanas se tocan como un celular, con la punta del índice."},
                {"Mové las ventanas", "Agarrá la barra de abajo de cada ventana. ✕ la cierra; ⤢ la agranda (modo cine)."},
                {"La barra y recentrar", "Un doble pellizco en la nada muestra o esconde la barra de abajo. Sostenido 1 s: todo vuelve adelante tuyo."},
                {"Sin manos", "Mirá fijo un botón 1 segundo, tocá la pantalla del teléfono, o usá el control Bluetooth (el gatillo es clic)."}};
        int[] ic = {Iconos.MANO, Iconos.MANO, Iconos.CINE, Iconos.RECENTRAR, Iconos.CONTROL};
        for (int i = 0; i < pasos.length; i++) {
            LinearLayout r = new LinearLayout(c);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.addView(Estilo.icono(c, ic[i], Estilo.AZUL_CLARO, 30));
            LinearLayout t = new LinearLayout(c);
            t.setOrientation(LinearLayout.VERTICAL);
            t.setPadding(Estilo.dp(c, 16), 0, 0, 0);
            t.addView(Estilo.texto(c, pasos[i][0], 16, Estilo.TEXTO, true));
            t.addView(Estilo.texto(c, pasos[i][1], 13, Estilo.TEXTO2, false));
            r.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
            LinearLayout.LayoutParams lr = new LinearLayout.LayoutParams(-1, -2);
            lr.bottomMargin = Estilo.dp(c, 12);
            raiz.addView(r, lr);
        }
        View esp = new View(c);
        raiz.addView(esp, new LinearLayout.LayoutParams(1, 0, 1));
        LinearLayout abajo = new LinearLayout(c);
        abajo.setGravity(Gravity.END);
        abajo.addView(Estilo.boton(c, -1, "Empezar", true, v -> { s.sonido(Sonido.CLIC); cerrar.run(); }));
        raiz.addView(abajo, new LinearLayout.LayoutParams(-1, -2));
        return raiz;
    }
}
