package com.juniorspro.mando360;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.hardware.ConsumerIrManager;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Mando 360 IR: control remoto de la Xbox 360 por infrarrojo, hecho a mano.
 *
 * Manda los códigos RC6 del control remoto multimedia (ver Rc6.java) por el
 * emisor infrarrojo del teléfono (ConsumerIrManager). Sirve para MENÚS y
 * MULTIMEDIA: moverse por el tablero, A/B/X/Y del menú, el botón de Xbox,
 * play/pausa/stop. NO controla el juego (mover, apuntar): eso viaja por la
 * radio de los joysticks, que es otra cosa.
 */
public class Principal extends Activity implements View.OnClickListener {
    private ConsumerIrManager ir;
    private Vibrator vibrador;
    private boolean toggle = false;   // el bit de rastreo se invierte en cada envío
    private TextView aviso;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ir = (ConsumerIrManager) getSystemService(CONSUMER_IR_SERVICE);
        vibrador = (Vibrator) getSystemService(VIBRATOR_SERVICE);

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(0xFF07030F);
        int pad = dp(14);
        raiz.setPadding(pad, pad, pad, pad);
        raiz.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView titulo = new TextView(this);
        titulo.setText("Mando 360 · IR");
        titulo.setTextColor(0xFFF2EEFF);
        titulo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        titulo.setPadding(0, 0, 0, dp(4));
        raiz.addView(titulo);

        aviso = new TextView(this);
        aviso.setTextColor(0xFFB3A8D6);
        aviso.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        aviso.setGravity(Gravity.CENTER);
        aviso.setPadding(0, 0, 0, dp(10));
        raiz.addView(aviso);

        boolean hayIr = ir != null && ir.hasIrEmitter();
        aviso.setText(hayIr ? "Apuntá el teléfono a la consola" : "Este teléfono no tiene emisor infrarrojo: la app no puede mandar nada.");

        // Fila de arriba: encender · Xbox (guía) · info.
        LinearLayout arriba = fila();
        arriba.addView(boton("⏻", 0xFF5A2FD9, Rc6.ENCENDER, 1));
        arriba.addView(boton("Xbox", 0xFF107C10, Rc6.GUIA, 2));
        arriba.addView(boton("Info", 0xFF5A2FD9, Rc6.INFO, 1));
        raiz.addView(arriba);

        raiz.addView(espacio());

        // Cruceta: 3×3 con arriba / izq-OK-der / abajo.
        raiz.addView(filaCentrada(hueco(), boton("▲", 0xFF3A2A6E, Rc6.ARRIBA, 1), hueco()));
        raiz.addView(filaCentrada(boton("◄", 0xFF3A2A6E, Rc6.IZQUIERDA, 1), boton("OK", 0xFF6A3BD6, Rc6.OK, 1), boton("►", 0xFF3A2A6E, Rc6.DERECHA, 1)));
        raiz.addView(filaCentrada(hueco(), boton("▼", 0xFF3A2A6E, Rc6.ABAJO, 1), hueco()));

        raiz.addView(espacio());

        // A B X Y con los colores clásicos.
        LinearLayout abxy = fila();
        abxy.addView(boton("A", 0xFF107C10, Rc6.A, 1));
        abxy.addView(boton("B", 0xFFC01010, Rc6.B, 1));
        abxy.addView(boton("X", 0xFF1466B8, Rc6.X, 1));
        abxy.addView(boton("Y", 0xFFC8A020, Rc6.Y, 1));
        raiz.addView(abxy);

        raiz.addView(espacio());

        // Atrás y una fila de multimedia.
        raiz.addView(filaCentrada(boton("Atrás", 0xFF5A2FD9, Rc6.ATRAS, 2)));
        LinearLayout media = fila();
        media.addView(boton("⏮", 0xFF3A2A6E, Rc6.RETROCEDER, 1));
        media.addView(boton("▶", 0xFF3A2A6E, Rc6.REPRODUCIR, 1));
        media.addView(boton("⏸", 0xFF3A2A6E, Rc6.PAUSA, 1));
        media.addView(boton("⏹", 0xFF3A2A6E, Rc6.DETENER, 1));
        media.addView(boton("⏭", 0xFF3A2A6E, Rc6.ADELANTAR, 1));
        raiz.addView(media);

        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.addView(raiz);
        setContentView(scroll);
    }

    private void enviar(long valor) {
        if (ir == null || !ir.hasIrEmitter()) {
            Toast.makeText(this, "Sin emisor infrarrojo", Toast.LENGTH_SHORT).show();
            return;
        }
        long v = toggle ? (valor ^ Rc6.TOGGLE) : valor;
        toggle = !toggle;
        try {
            ir.transmit(Rc6.PORTADORA, Rc6.patron(v));
            if (vibrador != null) {
                if (android.os.Build.VERSION.SDK_INT >= 26) vibrador.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                else vibrador.vibrate(18);
            }
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo mandar: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    // ── ayudas para armar la interfaz a mano ──
    private Button boton(String texto, int color, final long valor, int peso) {
        Button b = new Button(this);
        b.setText(texto);
        b.setTextColor(Color.WHITE);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        GradientDrawable fondo = new GradientDrawable();
        fondo.setColor(color);
        fondo.setCornerRadius(dp(14));
        b.setBackground(fondo);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(58), peso);
        lp.setMargins(dp(4), dp(4), dp(4), dp(4));
        b.setLayoutParams(lp);
        b.setTag(Long.valueOf(valor));   // el código va en el tag: sin clases anónimas (d8 no las traga)
        b.setOnClickListener(this);
        return b;
    }

    @Override
    public void onClick(View v) {
        Object t = v.getTag();
        if (t instanceof Long) enviar((Long) t);
    }

    private View hueco() {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(0, dp(58), 1));
        return v;
    }

    private LinearLayout fila() {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.width = dp(320);
        f.setLayoutParams(lp);
        return f;
    }

    private LinearLayout filaCentrada(View... hijos) {
        LinearLayout f = fila();
        for (View h : hijos) f.addView(h);
        return f;
    }

    private View espacio() {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(10)));
        return v;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
