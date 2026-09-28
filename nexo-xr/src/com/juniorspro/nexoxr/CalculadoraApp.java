package com.juniorspro.nexoxr;

import android.content.Context;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;

/**
 * LA CALCULADORA: teclas grandes (se aprietan bien con el pellizco o el
 * dedo), la cuenta arriba y el resultado mientras escribís, y a la derecha lo
 * que ya calculaste (tocá uno para seguir desde ahí). Las cuentas: Calculo.
 */
final class CalculadoraApp {
    private final StringBuilder cuenta = new StringBuilder();
    private TextView verCuenta, verResultado;
    private LinearLayout historial;
    private final ArrayList<String[]> hechas = new ArrayList<>();
    private boolean recienIgual;
    private Sistema s;
    private Context c;

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        int m = Estilo.dp(c, 16);
        raiz.setPadding(m, m, m, m);
        // la calculadora
        LinearLayout izq = new LinearLayout(c);
        izq.setOrientation(LinearLayout.VERTICAL);
        LinearLayout pantalla = new LinearLayout(c);
        pantalla.setOrientation(LinearLayout.VERTICAL);
        pantalla.setGravity(Gravity.END | Gravity.BOTTOM);
        pantalla.setBackground(Estilo.forma(Estilo.PANEL, Estilo.dp(c, 18)));
        pantalla.setPadding(Estilo.dp(c, 18), Estilo.dp(c, 10), Estilo.dp(c, 18), Estilo.dp(c, 10));
        verCuenta = Estilo.texto(c, "", 22, Estilo.TEXTO2, false);
        verCuenta.setGravity(Gravity.END);
        verCuenta.setSingleLine(true);
        verCuenta.setEllipsize(TextUtils.TruncateAt.START);
        verResultado = Estilo.texto(c, "0", 40, Estilo.TEXTO, true);
        verResultado.setGravity(Gravity.END);
        verResultado.setSingleLine(true);
        verResultado.setEllipsize(TextUtils.TruncateAt.START);
        pantalla.addView(verCuenta, new LinearLayout.LayoutParams(-1, -2));
        pantalla.addView(verResultado, new LinearLayout.LayoutParams(-1, -2));
        izq.addView(pantalla, new LinearLayout.LayoutParams(-1, Estilo.dp(c, 92)));
        GridLayout g = new GridLayout(c);
        g.setColumnCount(5);
        String[] teclas = {"C", "(", ")", "%", "÷",
                "√", "7", "8", "9", "×",
                "^", "4", "5", "6", "−",
                "π", "1", "2", "3", "+",
                "±", "0", ",", "⌫", "="};
        for (int i = 0; i < teclas.length; i++) {
            String t = teclas[i];
            boolean num = t.matches("[0-9,]"), op = "÷×−+".contains(t), igual = t.equals("=");
            TextView b = Estilo.texto(c, t, igual || op ? 26 : 22, igual ? 0xFFFFFFFF : op ? Estilo.AZUL_CLARO : num ? Estilo.TEXTO : Estilo.TEXTO2, true);
            b.setGravity(Gravity.CENTER);
            int fondo = igual ? Estilo.AZUL : num ? Estilo.TARJETA_ALTA : Estilo.TARJETA;
            b.setBackground(Estilo.apretable(fondo, igual ? Estilo.AZUL_CLARO : 0xFF4A4C58, Estilo.dp(c, 16)));
            b.setClickable(true);
            b.setOnClickListener(v -> { s.sonido(Sonido.TECLA); tecla(t); });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / 5, 1f), GridLayout.spec(i % 5, 1f));
            lp.width = 0; lp.height = 0;
            lp.setMargins(Estilo.dp(c, 4), Estilo.dp(c, 4), Estilo.dp(c, 4), Estilo.dp(c, 4));
            g.addView(b, lp);
        }
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(-1, 0, 1);
        lg.topMargin = Estilo.dp(c, 8);
        izq.addView(g, lg);
        raiz.addView(izq, new LinearLayout.LayoutParams(0, -1, 1.7f));
        // lo que ya calculaste
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 14), 0, 0, 0);
        der.addView(Estilo.texto(c, "Historial", 16, Estilo.TEXTO, true));
        ScrollView sv = new ScrollView(c);
        historial = new LinearLayout(c);
        historial.setOrientation(LinearLayout.VERTICAL);
        sv.addView(historial);
        der.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));
        raiz.addView(der, new LinearLayout.LayoutParams(0, -1, 1f));
        mostrar();
        return raiz;
    }

    private void tecla(String t) {
        switch (t) {
            case "C": cuenta.setLength(0); recienIgual = false; break;
            case "⌫": if (cuenta.length() > 0) cuenta.setLength(cuenta.length() - 1); recienIgual = false; break;
            case "=": {
                double v = Calculo.resolver(cuenta.toString());
                if (Double.isNaN(v)) { verResultado.setText("Error"); verResultado.setTextColor(Estilo.ROJO); return; }
                String r = Calculo.mostrar(v);
                hechas.add(0, new String[]{cuenta.toString(), r});
                if (hechas.size() > 20) hechas.remove(hechas.size() - 1);
                cuenta.setLength(0);
                cuenta.append(r.replace(".", ""));   // se sigue desde el resultado
                recienIgual = true;
                armarHistorial();
                break;
            }
            case "±": {
                // cambia el signo del último número
                int i = cuenta.length();
                while (i > 0 && (Character.isDigit(cuenta.charAt(i - 1)) || cuenta.charAt(i - 1) == ',')) i--;
                if (i > 0 && cuenta.charAt(i - 1) == '−' && (i == 1 || "(÷×−+^".indexOf(cuenta.charAt(i - 2)) >= 0)) cuenta.deleteCharAt(i - 1);
                else cuenta.insert(i, '−');
                recienIgual = false;
                break;
            }
            default:
                // un número después de "=" empieza de nuevo; un operador sigue desde el resultado
                if (recienIgual && (t.matches("[0-9,π√(]"))) cuenta.setLength(0);
                recienIgual = false;
                if (t.equals("√")) cuenta.append("√(");
                else cuenta.append(t);
        }
        mostrar();
    }

    private void mostrar() {
        verCuenta.setText(cuenta.length() == 0 ? "" : cuenta.toString());
        double v = Calculo.resolver(cuenta.toString());
        verResultado.setTextColor(Estilo.TEXTO);
        verResultado.setText(cuenta.length() == 0 ? "0" : Double.isNaN(v) ? "…" : Calculo.mostrar(v));
    }

    private void armarHistorial() {
        historial.removeAllViews();
        for (String[] h : hechas) {
            LinearLayout r = new LinearLayout(c);
            r.setOrientation(LinearLayout.VERTICAL);
            r.setGravity(Gravity.END);
            r.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 8), Estilo.dp(c, 12), Estilo.dp(c, 8));
            r.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 12)));
            TextView a = Estilo.texto(c, h[0], 13, Estilo.TEXTO2, false);
            a.setGravity(Gravity.END);
            TextView b = Estilo.texto(c, "= " + h[1], 18, Estilo.TEXTO, true);
            b.setGravity(Gravity.END);
            r.addView(a, new LinearLayout.LayoutParams(-1, -2));
            r.addView(b, new LinearLayout.LayoutParams(-1, -2));
            r.setClickable(true);
            r.setOnClickListener(v -> { s.sonido(Sonido.CLIC); cuenta.setLength(0); cuenta.append(h[1].replace(".", "")); recienIgual = true; mostrar(); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.topMargin = Estilo.dp(c, 6);
            historial.addView(r, lp);
        }
    }
}
