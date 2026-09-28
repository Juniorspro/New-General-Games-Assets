package com.juniorspro.nexoxr;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Locale;

/**
 * LA VENTANA DEL INICIO ("Prepará tu espacio"): elegir cómo usar Nexo (mesa,
 * cuarto, sólo girar) y los pasos (escanear, las manos, la cabeza, listo),
 * con un anillo que se llena, lo que está pasando y los botones. Mira el
 * {@link Inicio} (lo mueve el hilo de dibujo) 12 veces por segundo.
 */
final class InicioApp {
    private Inicio in;
    private Sistema s;
    private Context c;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout cuerpo;
    private LinearLayout puntos;
    private int pasoMostrado = -1, modoMostrado = -1;
    private Anillo anillo;
    private TextView estado;
    private LinearLayout botonConfirmar;
    private final Runnable mirar = new Runnable() {
        @Override public void run() { refrescar(); ui.postDelayed(this, 80); }
    };

    View crear(Context ctx, Sistema sis, Inicio inicio) {
        c = ctx;
        s = sis;
        in = inicio;
        FrameLayout raiz = new FrameLayout(c);
        GradientDrawable fondo = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF1A2140, 0xFF141722, 0xFF10121A});
        raiz.setBackground(fondo);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 22);
        col.setPadding(m, Estilo.dp(c, 16), m, Estilo.dp(c, 14));
        // la cabecera: la marca, "Nexo" y los pasos
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        Anillo marca = new Anillo(c);
        marca.marca = true;
        cab.addView(marca, new LinearLayout.LayoutParams(Estilo.dp(c, 26), Estilo.dp(c, 26)));
        TextView nexo = Estilo.texto(c, "Nexo", 17, Estilo.TEXTO, true);
        nexo.setPadding(Estilo.dp(c, 10), 0, 0, 0);
        cab.addView(nexo, new LinearLayout.LayoutParams(0, -2, 1));
        puntos = new LinearLayout(c);
        puntos.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(puntos);
        col.addView(cab);
        cuerpo = new FrameLayout(c);
        LinearLayout.LayoutParams lc = new LinearLayout.LayoutParams(-1, 0, 1);
        lc.topMargin = Estilo.dp(c, 10);
        col.addView(cuerpo, lc);
        TextView pie = Estilo.texto(c, "Podés volver a prepararlo en Ajustes → Espacio", 11, 0xFF6F7486, false);
        pie.setGravity(Gravity.CENTER);
        col.addView(pie, new LinearLayout.LayoutParams(-1, -2));
        raiz.addView(col, new FrameLayout.LayoutParams(-1, -1));
        raiz.addOnAttachStateChangeListener(new Dejar(this));
        ui.post(mirar);
        return raiz;
    }

    /** Al cerrarse la ventana deja de mirar (una clase con nombre: las anónimas rompían el d8). */
    private static final class Dejar implements View.OnAttachStateChangeListener {
        private final InicioApp a;
        Dejar(InicioApp a) { this.a = a; }
        @Override public void onViewAttachedToWindow(View v) { }
        @Override public void onViewDetachedFromWindow(View v) { a.ui.removeCallbacks(a.mirar); }
    }

    private void refrescar() {
        int paso = in.paso, modo = in.modo;
        if (paso != pasoMostrado || modo != modoMostrado) {
            pasoMostrado = paso;
            modoMostrado = modo;
            armar(paso, modo);
        }
        if (anillo != null) {
            anillo.progreso += (in.progreso - anillo.progreso) * 0.35f;
            anillo.buscando = paso == Inicio.ESCANEAR && in.progreso < 0.02f;
            anillo.invalidate();
        }
        if (estado != null) estado.setText(in.estado);
        if (botonConfirmar != null) {
            boolean ok = modo == Inicio.CUARTO ? in.hayPiso : in.candidata != 0;
            botonConfirmar.setAlpha(ok ? 1 : 0.35f);
            botonConfirmar.setEnabled(ok);
        }
        // los puntitos de los pasos
        int n = in.pasos(), k = in.numero();
        if (puntos.getChildCount() != n) {
            puntos.removeAllViews();
            for (int i = 0; i < n; i++) {
                View d = new View(c);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(Estilo.dp(c, 8), Estilo.dp(c, 8));
                lp.leftMargin = Estilo.dp(c, 6);
                puntos.addView(d, lp);
            }
        }
        for (int i = 0; i < n; i++) {
            View d = puntos.getChildAt(i);
            boolean hecho = i < k - 1 || paso >= Inicio.LISTO, ahora = i == k - 1 && paso < Inicio.LISTO;
            d.setBackground(Estilo.forma(hecho ? Estilo.VERDE : ahora ? Estilo.AZUL_CLARO : 0xFF3A3E4C, Estilo.dp(c, 4)));
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) d.getLayoutParams();
            int w = Estilo.dp(c, ahora ? 22 : 8);
            if (lp.width != w) { lp.width = w; d.setLayoutParams(lp); }
        }
    }

    private void armar(int paso, int modo) {
        cuerpo.removeAllViews();
        anillo = null;
        estado = null;
        botonConfirmar = null;
        switch (paso) {
            case Inicio.ELEGIR: elegir(); break;
            case Inicio.ESCANEAR:
                if (modo == Inicio.CUARTO) paso(Iconos.CUARTO, "Escaneá el cuarto",
                        "Mirá el piso y las paredes a tu alrededor, girando despacio. Nexo marca cada superficie que encuentra.",
                        "Listo", () -> in.pidioConfirmar = true, true);
                else paso(Iconos.MESA, "Escaneá tu mesa",
                        "Mirá tu mesa y mové la cabeza despacio de lado a lado. Cuando la vea entera, la marco sola.",
                        "Esta es mi mesa", () -> in.pidioConfirmar = true, true);
                break;
            case Inicio.MANOS:
                paso(Iconos.MANO, "Apoyá las manos",
                        "Apoyá las dos manos en la mesa sobre las guías, los dedos para adelante, y quedate quieto. Así Nexo aprende a qué distancia están tus manos.",
                        "Otra mesa", () -> in.rehacer(SystemClock.elapsedRealtime()), false);
                break;
            case Inicio.CABEZA:
                paso(Iconos.GIRAR, "Fijá la cabeza",
                        modo == Inicio.GIRAR ? "Mirá al frente, a donde querés tus pantallas, y quedate quieto un segundo. Desde ahí sólo vas a girar."
                                : "Mirá al frente, a donde querés tus pantallas, y quedate quieto un segundo.",
                        null, null, false);
                break;
            default: listo(); break;
        }
    }

    // ── ELEGIR ──

    private void elegir() {
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        col.addView(Estilo.texto(c, "Prepará tu espacio", 25, Estilo.TEXTO, true));
        TextView sub = Estilo.texto(c, "¿Cómo vas a usar Nexo?", 14, Estilo.TEXTO2, false);
        sub.setPadding(0, Estilo.dp(c, 2), 0, Estilo.dp(c, 12));
        col.addView(sub);
        LinearLayout fila = new LinearLayout(c);
        fila.addView(tarjeta(Iconos.MESA, "Mesa", "Sentado. Escaneás tu mesa y Nexo sólo se mueve cuando la ve: nada se desliza.",
                true, 0xFF3D7BFF, 0xFF7A4DFF, Inicio.MESA), pesoTarjeta(true));
        fila.addView(tarjeta(Iconos.CUARTO, "Cuarto", "Parado o caminando. Escaneás el piso y las paredes.",
                false, 0xFF1FA37A, 0xFF1D6FA8, Inicio.CUARTO), pesoTarjeta(false));
        fila.addView(tarjeta(Iconos.GIRAR, "3DoF: sólo girar", "Sin escanear: sólo girás, con las manos. Nunca se mueve solo.",
                false, 0xFF5C6275, 0xFF3A3F4F, Inicio.GIRAR), pesoTarjeta(false));
        col.addView(fila, new LinearLayout.LayoutParams(-1, 0, 1));
        cuerpo.addView(col, new FrameLayout.LayoutParams(-1, -1));
    }

    private LinearLayout.LayoutParams pesoTarjeta(boolean primera) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -1, 1);
        if (!primera) lp.leftMargin = Estilo.dp(c, 12);
        return lp;
    }

    private View tarjeta(int icono, String titulo, String texto, boolean recomendada, int c1, int c2, int modo) {
        FrameLayout f = new FrameLayout(c);
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{c1, c2});
        g.setCornerRadius(Estilo.dp(c, 20));
        if (in.modo == modo && recomendada) g.setStroke(Estilo.dp(c, 2), 0x88FFFFFF);
        f.setBackground(g);
        f.setForeground(Estilo.apretable(0x00000000, 0x33FFFFFF, Estilo.dp(c, 20)));
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int p = Estilo.dp(c, 14);
        col.setPadding(p, p, p, p);
        col.addView(Estilo.icono(c, icono, 0xFFFFFFFF, 40));
        View esp = new View(c);
        col.addView(esp, new LinearLayout.LayoutParams(1, 0, 1));
        col.addView(Estilo.texto(c, titulo, 19, 0xFFFFFFFF, true));
        TextView t = Estilo.texto(c, texto, 12, 0xE6FFFFFF, false);
        t.setPadding(0, Estilo.dp(c, 3), 0, 0);
        col.addView(t);
        f.addView(col, new FrameLayout.LayoutParams(-1, -1));
        if (recomendada) {
            TextView b = Estilo.texto(c, "Recomendado", 10, 0xFFFFFFFF, true);
            b.setBackground(Estilo.forma(0x40FFFFFF, Estilo.dp(c, 10)));
            b.setPadding(Estilo.dp(c, 8), Estilo.dp(c, 3), Estilo.dp(c, 8), Estilo.dp(c, 3));
            FrameLayout.LayoutParams lb = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.END);
            lb.setMargins(0, Estilo.dp(c, 12), Estilo.dp(c, 12), 0);
            f.addView(b, lb);
        }
        f.setClickable(true);
        f.setOnClickListener(v -> { s.sonido(Sonido.ABRIR); s.cambio("modoEspacio", modo); in.elegir(modo, SystemClock.elapsedRealtime()); });
        return f;
    }

    // ── un paso: el anillo a la izquierda, el texto y los botones a la derecha ──

    private void paso(int icono, String titulo, String texto, String accion, Runnable hacer, boolean confirmar) {
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        anillo = new Anillo(c);
        anillo.icono = new Iconos(icono, 0xFFFFFFFF);
        anillo.progreso = in.progreso;
        fila.addView(anillo, new LinearLayout.LayoutParams(Estilo.dp(c, 170), Estilo.dp(c, 170)));
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 22), 0, 0, 0);
        der.addView(Estilo.texto(c, titulo, 23, Estilo.TEXTO, true));
        TextView t = Estilo.texto(c, texto, 14, Estilo.TEXTO2, false);
        t.setPadding(0, Estilo.dp(c, 6), 0, Estilo.dp(c, 10));
        t.setLineSpacing(0, 1.12f);
        der.addView(t);
        estado = Estilo.texto(c, in.estado, 14, Estilo.AZUL_CLARO, true);
        der.addView(estado);
        LinearLayout botones = new LinearLayout(c);
        botones.setGravity(Gravity.CENTER_VERTICAL);
        if (accion != null) {
            LinearLayout b = Estilo.boton(c, confirmar ? Iconos.LISTO : Iconos.RECARGAR, accion, confirmar, v -> { s.sonido(Sonido.CLIC); hacer.run(); });
            botones.addView(b);
            if (confirmar) botonConfirmar = b;
        }
        LinearLayout saltar = Estilo.boton(c, -1, "Saltar", false, v -> { s.sonido(Sonido.CLIC); in.saltar(SystemClock.elapsedRealtime()); });
        LinearLayout.LayoutParams ls = new LinearLayout.LayoutParams(-2, -2);
        ls.leftMargin = Estilo.dp(c, accion != null ? 10 : 0);
        botones.addView(saltar, ls);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-2, -2);
        lb.topMargin = Estilo.dp(c, 16);
        der.addView(botones, lb);
        fila.addView(der, new LinearLayout.LayoutParams(0, -2, 1));
        cuerpo.addView(fila, new FrameLayout.LayoutParams(-1, -1));
    }

    // ── LISTO ──

    private void listo() {
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        anillo = new Anillo(c);
        anillo.icono = new Iconos(Iconos.LISTO, 0xFFFFFFFF);
        anillo.progreso = 1;
        anillo.listo = true;
        fila.addView(anillo, new LinearLayout.LayoutParams(Estilo.dp(c, 150), Estilo.dp(c, 150)));
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 22), 0, 0, 0);
        der.addView(Estilo.texto(c, "¡Listo!", 26, Estilo.TEXTO, true));
        StringBuilder r = new StringBuilder();
        if (in.modo == Inicio.MESA && in.mesa != 0) {
            float[] md = in.medidas;
            r.append(String.format(Locale.ROOT, "✓ Tu mesa: %.0f × %.0f cm, marcada.\n", md[0] * 100, md[1] * 100));
            r.append("✓ Nexo sólo se mueve cuando la ve: si mirás para otro lado, nada se desliza.\n");
            r.append(in.escala == in.escala ? String.format(Locale.ROOT, "✓ Tus manos, medidas (×%.2f).\n", in.escala) : "· Las manos: sin medir (se miden solas con el tiempo).\n");
            r.append("✓ La barra de abajo, apoyada en la mesa: tocala con el dedo.");
        } else if (in.modo == Inicio.CUARTO) {
            r.append(String.format(Locale.ROOT, "✓ El cuarto: %d superficies, %.1f m².\n", in.planosCuarto, in.areaCuarto));
            r.append("✓ Nexo se mueve cuando reconoce lo que escaneaste.");
        } else {
            r.append("✓ La cabeza queda fija: sólo girás (nada se desliza nunca).");
        }
        TextView t = Estilo.texto(c, r.toString(), 14, Estilo.TEXTO2, false);
        t.setPadding(0, Estilo.dp(c, 6), 0, Estilo.dp(c, 14));
        t.setLineSpacing(0, 1.2f);
        der.addView(t);
        LinearLayout botones = new LinearLayout(c);
        botones.addView(Estilo.boton(c, Iconos.PLAY, "Empezar", true, v -> { s.sonido(Sonido.ARRANQUE); in.empezar(); }));
        LinearLayout.LayoutParams lo = new LinearLayout.LayoutParams(-2, -2);
        lo.leftMargin = Estilo.dp(c, 10);
        botones.addView(Estilo.boton(c, -1, "Rehacer", false, v -> { s.sonido(Sonido.CLIC); in.rehacer(SystemClock.elapsedRealtime()); }), lo);
        der.addView(botones);
        fila.addView(der, new LinearLayout.LayoutParams(0, -2, 1));
        cuerpo.addView(fila, new FrameLayout.LayoutParams(-1, -1));
    }

    /**
     * El ANILLO: la pista, el progreso con un degradé que gira (celeste →
     * violeta → dorado), un halo, y el ícono en el medio. Buscando: un arco que
     * da vueltas. La "marca" de Nexo: el mismo anillo, chiquito.
     */
    static final class Anillo extends View {
        float progreso;
        boolean buscando, listo, marca;
        Iconos icono;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private final long t0 = SystemClock.elapsedRealtime();

        Anillo(Context c) { super(c); }

        @Override
        protected void onDraw(Canvas k) {
            float w = getWidth(), h = getHeight(), d = Math.min(w, h), cx = w / 2, cy = h / 2;
            float t = (SystemClock.elapsedRealtime() - t0) / 1000f;
            float grosor = d * (marca ? 0.16f : 0.07f);
            float rad = d / 2 - grosor * (marca ? 0.6f : 1.4f);
            r.set(cx - rad, cy - rad, cx + rad, cy + rad);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setShader(null);
            if (marca) {
                p.setStrokeWidth(grosor);
                p.setShader(new SweepGradient(cx, cy, new int[]{0xFF7AA6FF, 0xFFB38CFF, 0xFFFFD27A, 0xFF7AA6FF}, null));
                k.drawArc(r, 0, 360, false, p);
                p.setShader(null);
                p.setStyle(Paint.Style.FILL);
                p.setColor(0xFFFFFFFF);
                k.drawCircle(cx, cy, grosor * 0.55f, p);
                return;
            }
            // la pista
            p.setStrokeWidth(grosor);
            p.setColor(0x26FFFFFF);
            k.drawArc(r, 0, 360, false, p);
            // el halo del progreso (más ancho, transparente)
            SweepGradient sg = new SweepGradient(cx, cy, new int[]{0xFF6FB6FF, 0xFFA78BFF, 0xFFFFD27A, 0xFF6FB6FF}, null);
            android.graphics.Matrix giro = new android.graphics.Matrix();
            giro.setRotate(-90 + t * 30, cx, cy);
            sg.setLocalMatrix(giro);
            if (buscando) {
                float a = (t * 240) % 360;
                p.setShader(sg);
                p.setAlpha(255);
                k.drawArc(r, a, 70, false, p);
                p.setStrokeWidth(grosor * 2.4f);
                p.setAlpha(50);
                k.drawArc(r, a, 70, false, p);
                p.setAlpha(255);
            } else if (progreso > 0.002f) {
                float barrido = 360 * Math.min(1, progreso);
                p.setShader(sg);
                p.setStrokeWidth(grosor * 2.6f);
                p.setAlpha(listo ? 60 : 45);
                k.drawArc(r, -90, barrido, false, p);
                p.setAlpha(255);
                p.setStrokeWidth(grosor);
                k.drawArc(r, -90, barrido, false, p);
                // la punta que brilla
                if (progreso < 0.999f) {
                    double ang = Math.toRadians(-90 + barrido);
                    p.setShader(null);
                    p.setStyle(Paint.Style.FILL);
                    p.setColor(0xFFFFFFFF);
                    k.drawCircle(cx + (float) Math.cos(ang) * rad, cy + (float) Math.sin(ang) * rad, grosor * 0.62f, p);
                }
            }
            p.setShader(null);
            // el medio: un disco suave, el ícono y el porcentaje
            p.setStyle(Paint.Style.FILL);
            p.setShader(new LinearGradient(0, cy - rad, 0, cy + rad, listo ? 0x5535C28B : 0x333D7BFF, 0x10000000, Shader.TileMode.CLAMP));
            k.drawCircle(cx, cy, rad - grosor * 1.2f, p);
            p.setShader(null);
            if (icono != null) {
                int ti = (int) (d * (listo ? 0.34f : 0.26f));
                int iy = (int) (listo ? cy - ti / 2f : cy - ti * 0.85f);
                icono.setBounds((int) (cx - ti / 2f), iy, (int) (cx + ti / 2f), iy + ti);
                icono.draw(k);
            }
            if (!listo) {
                p.setColor(0xFFEDEEF3);
                p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                p.setTextSize(d * 0.13f);
                p.setTextAlign(Paint.Align.CENTER);
                k.drawText(buscando ? "…" : Math.round(Math.min(1, progreso) * 100) + "%", cx, cy + d * 0.2f, p);
            }
            postInvalidateOnAnimation();
        }
    }
}
