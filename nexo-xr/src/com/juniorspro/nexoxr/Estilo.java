package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

/**
 * El aspecto de todas las pantallas: oscuro, con vidrio, esquinas
 * redondeadas, un azul para lo elegido. (Todo en código: sin XML.)
 */
final class Estilo {
    static final int FONDO = 0xFF15161B, PANEL = 0xFF1F2027, TARJETA = 0xFF2A2B34, TARJETA_ALTA = 0xFF363846,
            TEXTO = 0xFFEDEEF3, TEXTO2 = 0xFFA2A5B4, AZUL = 0xFF3D7BFF, AZUL_CLARO = 0xFF7AA6FF, VERDE = 0xFF35C28B, ROJO = 0xFFFF5B5B;

    private Estilo() {}

    static int dp(Context c, float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics())); }

    static GradientDrawable forma(int color, float radioPx) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(radioPx);
        return g;
    }

    /** Un fondo que se aclara al apretarlo. */
    static Drawable apretable(int color, int apretado, float radioPx) {
        StateListDrawable s = new StateListDrawable();
        s.addState(new int[]{android.R.attr.state_pressed}, forma(apretado, radioPx));
        s.addState(new int[]{android.R.attr.state_selected}, forma(apretado, radioPx));
        s.addState(new int[]{}, forma(color, radioPx));
        return s;
    }

    static TextView texto(Context c, String t, float sp, int color, boolean negrita) {
        TextView v = new TextView(c);
        v.setText(t);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        v.setTextColor(color);
        if (negrita) v.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return v;
    }

    static ImageView icono(Context c, int tipo, int color, int tamDp) {
        ImageView i = new ImageView(c);
        i.setImageDrawable(new Iconos(tipo, color));
        i.setLayoutParams(new LinearLayout.LayoutParams(dp(c, tamDp), dp(c, tamDp)));
        return i;
    }

    /** Un botón redondo con un ícono (el de las barras). */
    static FrameLayout botonIcono(Context c, int tipo, int tamDp, View.OnClickListener l) {
        FrameLayout f = new FrameLayout(c);
        f.setBackground(apretable(0x00000000, 0x33FFFFFF, dp(c, tamDp / 2f)));
        ImageView i = new ImageView(c);
        i.setImageDrawable(new Iconos(tipo, TEXTO));
        int m = dp(c, tamDp * 0.22f);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, -1);
        lp.setMargins(m, m, m, m);
        f.addView(i, lp);
        f.setClickable(true);
        f.setOnClickListener(l);
        f.setLayoutParams(new LinearLayout.LayoutParams(dp(c, tamDp), dp(c, tamDp)));
        return f;
    }

    /** Un botón con texto (y opcionalmente ícono), en píldora. */
    static LinearLayout boton(Context c, int icono, String t, boolean principal, View.OnClickListener l) {
        LinearLayout b = new LinearLayout(c);
        b.setOrientation(LinearLayout.HORIZONTAL);
        b.setGravity(Gravity.CENTER);
        int h = dp(c, 18), v = dp(c, 10);
        b.setPadding(h, v, h, v);
        b.setBackground(apretable(principal ? AZUL : TARJETA, principal ? AZUL_CLARO : TARJETA_ALTA, dp(c, 24)));
        if (icono >= 0) {
            ImageView i = icono(c, icono, TEXTO, 20);
            ((LinearLayout.LayoutParams) i.getLayoutParams()).rightMargin = dp(c, 8);
            b.addView(i);
        }
        b.addView(texto(c, t, 15, TEXTO, true));
        b.setClickable(true);
        b.setOnClickListener(l);
        return b;
    }

    /** Un interruptor (encendido / apagado), dibujado. */
    static final class Interruptor extends View {
        boolean prendido;
        interface Cambio { void cambio(boolean prendido); }
        Cambio cambio;
        private final android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);

        Interruptor(Context c, boolean inicial, Cambio cb) {
            super(c);
            prendido = inicial;
            cambio = cb;
            setClickable(true);
            setOnClickListener(v -> { prendido = !prendido; invalidate(); if (cambio != null) cambio.cambio(prendido); });
            setLayoutParams(new LinearLayout.LayoutParams(dp(c, 52), dp(c, 30)));
        }

        void poner(boolean si) { prendido = si; invalidate(); }

        @Override
        protected void onDraw(android.graphics.Canvas k) {
            float w = getWidth(), h = getHeight(), r = h / 2;
            p.setColor(prendido ? AZUL : 0xFF4A4C58);
            k.drawRoundRect(0, 0, w, h, r, r, p);
            p.setColor(Color.WHITE);
            k.drawCircle(prendido ? w - r : r, r, r - dp(getContext(), 3), p);
        }
    }

    static SeekBar deslizador(Context c, int max, int valor, SeekBar.OnSeekBarChangeListener l) {
        SeekBar s = new SeekBar(c);
        s.setMax(max);
        s.setProgress(valor);
        s.setProgressTintList(ColorStateList.valueOf(AZUL));
        s.setThumbTintList(ColorStateList.valueOf(Color.WHITE));
        s.setProgressBackgroundTintList(ColorStateList.valueOf(0xFF4A4C58));
        s.setOnSeekBarChangeListener(l);
        return s;
    }

    /** Un renglón: título (y detalle) a la izquierda, algo a la derecha. */
    static LinearLayout renglon(Context c, int icono, String titulo, String detalle, View derecha) {
        LinearLayout r = new LinearLayout(c);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        int p = dp(c, 14);
        r.setPadding(p, dp(c, 12), p, dp(c, 12));
        r.setBackground(forma(TARJETA, dp(c, 14)));
        if (icono >= 0) {
            ImageView i = icono(c, icono, TEXTO2, 24);
            ((LinearLayout.LayoutParams) i.getLayoutParams()).rightMargin = dp(c, 14);
            r.addView(i);
        }
        LinearLayout t = new LinearLayout(c);
        t.setOrientation(LinearLayout.VERTICAL);
        t.addView(texto(c, titulo, 16, TEXTO, true));
        if (detalle != null) {
            TextView d = texto(c, detalle, 13, TEXTO2, false);
            d.setTag("detalle");
            t.addView(d);
        }
        r.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        if (derecha != null) r.addView(derecha);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.bottomMargin = dp(c, 8);
        r.setLayoutParams(lp);
        return r;
    }
}
