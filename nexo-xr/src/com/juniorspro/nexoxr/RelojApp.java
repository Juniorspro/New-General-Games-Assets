package com.juniorspro.nexoxr;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * EL RELOJ: la hora (con una esfera que se mueve suave y la de otras
 * ciudades), un TEMPORIZADOR (con su anillo; suena aunque cierres la ventana:
 * lo mira el sistema) y un CRONÓMETRO con vueltas.
 */
final class RelojApp {
    /** Viven en el sistema: siguen andando con la ventana cerrada. */
    static final Tiempos.Temporizador TEMPO = new Tiempos.Temporizador();
    static final Tiempos.Cronometro CRONO = new Tiempos.Cronometro();

    static final String[][] CIUDADES = {{"Buenos Aires", "America/Argentina/Buenos_Aires"}, {"Ciudad de México", "America/Mexico_City"},
            {"Nueva York", "America/New_York"}, {"Madrid", "Europe/Madrid"}, {"Londres", "Europe/London"}, {"Tokio", "Asia/Tokyo"}};

    private Context c;
    private Sistema s;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout cuerpo;
    private final LinearLayout[] pestanas = new LinearLayout[3];
    private int pestana = -1;
    // lo que se actualiza
    private TextView grande, fechaTxt, tempoTxt, cronoTxt;
    private TextView[] ciudadesTxt;
    private Esfera esfera;
    private AnilloTiempo anillo;
    private LinearLayout vueltas, botonesTempo, botonesCrono;
    private int vueltasMostradas = -1;
    private final Runnable latido = new Runnable() {
        @Override public void run() { refrescar(); ui.postDelayed(this, 100); }
    };

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Estilo.FONDO);
        LinearLayout tabs = new LinearLayout(c);
        tabs.setGravity(Gravity.CENTER);
        tabs.setPadding(0, Estilo.dp(c, 12), 0, Estilo.dp(c, 4));
        String[] nombres = {"Reloj", "Temporizador", "Cronómetro"};
        int[] ic = {Iconos.RELOJ, Iconos.RECARGAR, Iconos.CRONOMETRO};
        for (int i = 0; i < 3; i++) {
            final int k = i;
            LinearLayout b = Estilo.boton(c, ic[i], nombres[i], false, v -> { s.sonido(Sonido.CLIC); mostrar(k); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
            lp.leftMargin = lp.rightMargin = Estilo.dp(c, 5);
            tabs.addView(b, lp);
            pestanas[i] = b;
        }
        raiz.addView(tabs);
        cuerpo = new FrameLayout(c);
        raiz.addView(cuerpo, new LinearLayout.LayoutParams(-1, 0, 1));
        raiz.addOnAttachStateChangeListener(new Parar(this));
        mostrar(TEMPO.andando() ? 1 : CRONO.andando() ? 2 : 0);
        ui.post(latido);
        return raiz;
    }

    private static final class Parar implements View.OnAttachStateChangeListener {
        private final RelojApp r;
        Parar(RelojApp r) { this.r = r; }
        @Override public void onViewAttachedToWindow(View v) { }
        @Override public void onViewDetachedFromWindow(View v) { r.ui.removeCallbacks(r.latido); }
    }

    private void mostrar(int k) {
        pestana = k;
        for (int i = 0; i < 3; i++)
            pestanas[i].setBackground(Estilo.apretable(i == k ? Estilo.AZUL : Estilo.TARJETA, i == k ? Estilo.AZUL_CLARO : Estilo.TARJETA_ALTA, Estilo.dp(c, 24)));
        cuerpo.removeAllViews();
        grande = fechaTxt = tempoTxt = cronoTxt = null;
        ciudadesTxt = null;
        esfera = null;
        anillo = null;
        vueltas = botonesTempo = botonesCrono = null;
        vueltasMostradas = -1;
        if (k == 0) reloj(); else if (k == 1) temporizador(); else cronometro();
        refrescar();
    }

    // ── la hora ──

    private void reloj() {
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        fila.setPadding(Estilo.dp(c, 24), 0, Estilo.dp(c, 24), 0);
        esfera = new Esfera(c);
        fila.addView(esfera, new LinearLayout.LayoutParams(Estilo.dp(c, 230), Estilo.dp(c, 230)));
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 26), 0, 0, 0);
        grande = Estilo.texto(c, "", 56, Estilo.TEXTO, true);
        fechaTxt = Estilo.texto(c, "", 17, Estilo.TEXTO2, false);
        der.addView(grande);
        der.addView(fechaTxt);
        ciudadesTxt = new TextView[CIUDADES.length];
        LinearLayout grilla = new LinearLayout(c);
        grilla.setOrientation(LinearLayout.VERTICAL);
        for (int i = 0; i < CIUDADES.length; i += 2) {
            LinearLayout f = new LinearLayout(c);
            for (int j = i; j < Math.min(i + 2, CIUDADES.length); j++) {
                LinearLayout t = new LinearLayout(c);
                t.setOrientation(LinearLayout.VERTICAL);
                t.setBackground(Estilo.forma(Estilo.TARJETA, Estilo.dp(c, 12)));
                t.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 6), Estilo.dp(c, 12), Estilo.dp(c, 6));
                t.addView(Estilo.texto(c, CIUDADES[j][0], 12, Estilo.TEXTO2, false));
                ciudadesTxt[j] = Estilo.texto(c, "", 18, Estilo.TEXTO, true);
                t.addView(ciudadesTxt[j]);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
                lp.setMargins(0, Estilo.dp(c, 6), Estilo.dp(c, 6), 0);
                f.addView(t, lp);
            }
            grilla.addView(f);
        }
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(-1, -2);
        lg.topMargin = Estilo.dp(c, 12);
        der.addView(grilla, lg);
        fila.addView(der, new LinearLayout.LayoutParams(0, -2, 1));
        cuerpo.addView(fila, new FrameLayout.LayoutParams(-1, -1));
    }

    // ── el temporizador ──

    private void temporizador() {
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        fila.setPadding(Estilo.dp(c, 24), 0, Estilo.dp(c, 24), 0);
        FrameLayout f = new FrameLayout(c);
        anillo = new AnilloTiempo(c);
        f.addView(anillo, new FrameLayout.LayoutParams(-1, -1));
        tempoTxt = Estilo.texto(c, "", 44, Estilo.TEXTO, true);
        tempoTxt.setGravity(Gravity.CENTER);
        f.addView(tempoTxt, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        fila.addView(f, new LinearLayout.LayoutParams(Estilo.dp(c, 250), Estilo.dp(c, 250)));
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.setPadding(Estilo.dp(c, 26), 0, 0, 0);
        der.addView(Estilo.texto(c, "Tocá un tiempo, o sumale", 14, Estilo.TEXTO2, false));
        int[] minutos = {1, 3, 5, 10, 15, 25, 30, 60};
        LinearLayout presets = null;
        for (int i = 0; i < minutos.length; i++) {
            if (i % 4 == 0) { presets = new LinearLayout(c); der.addView(presets); }
            final int mm = minutos[i];
            LinearLayout b = Estilo.boton(c, -1, mm < 60 ? mm + " min" : "1 h", false, v -> {
                s.sonido(Sonido.CLIC); TEMPO.poner(mm * 60000L); TEMPO.empezar(SystemClock.elapsedRealtime()); refrescar(); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            lp.setMargins(0, Estilo.dp(c, 8), Estilo.dp(c, 8), 0);
            presets.addView(b, lp);
        }
        LinearLayout mas = new LinearLayout(c);
        String[] sumas = {"−1 min", "+30 s", "+1 min", "+5 min"};
        long[] ms = {-60000, 30000, 60000, 300000};
        for (int i = 0; i < 4; i++) {
            final long d = ms[i];
            LinearLayout b = Estilo.boton(c, -1, sumas[i], false, v -> { s.sonido(Sonido.TIC); TEMPO.sumar(d, SystemClock.elapsedRealtime()); refrescar(); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            lp.setMargins(0, Estilo.dp(c, 8), Estilo.dp(c, 8), 0);
            mas.addView(b, lp);
        }
        der.addView(mas);
        botonesTempo = new LinearLayout(c);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-1, -2);
        lb.topMargin = Estilo.dp(c, 16);
        der.addView(botonesTempo, lb);
        fila.addView(der, new LinearLayout.LayoutParams(0, -2, 1));
        cuerpo.addView(fila, new FrameLayout.LayoutParams(-1, -1));
        armarBotonesTempo();
    }

    private void armarBotonesTempo() {
        if (botonesTempo == null) return;
        botonesTempo.removeAllViews();
        boolean anda = TEMPO.andando();
        botonesTempo.addView(Estilo.boton(c, anda ? Iconos.PAUSA : Iconos.PLAY, anda ? "Pausar" : "Empezar", true, v -> {
            s.sonido(Sonido.CLIC);
            long t = SystemClock.elapsedRealtime();
            if (TEMPO.andando()) TEMPO.pausar(t);
            else { if (TEMPO.resta(t) <= 0) TEMPO.poner(5 * 60000L); TEMPO.empezar(t); }
            armarBotonesTempo();
        }));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.leftMargin = Estilo.dp(c, 10);
        botonesTempo.addView(Estilo.boton(c, Iconos.RECARGAR, "Reiniciar", false, v -> { s.sonido(Sonido.CLIC); TEMPO.poner(TEMPO.total()); armarBotonesTempo(); }), lp);
    }

    // ── el cronómetro ──

    private void cronometro() {
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        fila.setPadding(Estilo.dp(c, 24), 0, Estilo.dp(c, 24), 0);
        LinearLayout izq = new LinearLayout(c);
        izq.setOrientation(LinearLayout.VERTICAL);
        izq.setGravity(Gravity.CENTER);
        cronoTxt = Estilo.texto(c, "", 60, Estilo.TEXTO, true);
        izq.addView(cronoTxt);
        botonesCrono = new LinearLayout(c);
        botonesCrono.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-2, -2);
        lb.topMargin = Estilo.dp(c, 16);
        izq.addView(botonesCrono, lb);
        fila.addView(izq, new LinearLayout.LayoutParams(0, -2, 1.3f));
        LinearLayout der = new LinearLayout(c);
        der.setOrientation(LinearLayout.VERTICAL);
        der.addView(Estilo.texto(c, "Vueltas", 16, Estilo.TEXTO, true));
        ScrollView sv = new ScrollView(c);
        vueltas = new LinearLayout(c);
        vueltas.setOrientation(LinearLayout.VERTICAL);
        sv.addView(vueltas);
        der.addView(sv, new LinearLayout.LayoutParams(-1, Estilo.dp(c, 240)));
        fila.addView(der, new LinearLayout.LayoutParams(0, -2, 1));
        cuerpo.addView(fila, new FrameLayout.LayoutParams(-1, -1));
        armarBotonesCrono();
    }

    private void armarBotonesCrono() {
        if (botonesCrono == null) return;
        botonesCrono.removeAllViews();
        boolean anda = CRONO.andando();
        botonesCrono.addView(Estilo.boton(c, anda ? Iconos.PAUSA : Iconos.PLAY, anda ? "Parar" : "Empezar", true, v -> {
            s.sonido(Sonido.CLIC);
            long t = SystemClock.elapsedRealtime();
            if (CRONO.andando()) CRONO.parar(t); else CRONO.empezar(t);
            armarBotonesCrono();
        }));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.leftMargin = Estilo.dp(c, 10);
        botonesCrono.addView(Estilo.boton(c, anda ? Iconos.CRONOMETRO : Iconos.RECARGAR, anda ? "Vuelta" : "Reiniciar", false, v -> {
            s.sonido(Sonido.CLIC);
            if (CRONO.andando()) CRONO.vuelta(SystemClock.elapsedRealtime()); else CRONO.reiniciar();
            armarBotonesCrono();
        }), lp);
    }

    // ── cada 100 ms ──

    private void refrescar() {
        long t = SystemClock.elapsedRealtime();
        Date ahora = new Date();
        if (grande != null) {
            grande.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(ahora));
            fechaTxt.setText(new SimpleDateFormat("EEEE d 'de' MMMM", new Locale("es")).format(ahora));
            for (int i = 0; i < CIUDADES.length; i++) {
                SimpleDateFormat f = new SimpleDateFormat("HH:mm", Locale.getDefault());
                f.setTimeZone(TimeZone.getTimeZone(CIUDADES[i][1]));
                ciudadesTxt[i].setText(f.format(ahora));
            }
            esfera.invalidate();
        }
        if (tempoTxt != null) {
            tempoTxt.setText(Tiempos.restante(TEMPO.resta(t)));
            anillo.progreso = TEMPO.total() > 0 ? 1 - TEMPO.progreso(t) : 0;
            anillo.anda = TEMPO.andando();
            anillo.invalidate();
            boolean tieneBoton = botonesTempo != null && botonesTempo.getChildCount() > 0;
            if (tieneBoton && ((TextView) ((LinearLayout) botonesTempo.getChildAt(0)).getChildAt(1)).getText().toString().equals("Pausar") != TEMPO.andando()) armarBotonesTempo();
        }
        if (cronoTxt != null) {
            cronoTxt.setText(Tiempos.formato(CRONO.ms(t), true));
            if (vueltasMostradas != CRONO.vueltas.size()) {
                vueltasMostradas = CRONO.vueltas.size();
                vueltas.removeAllViews();
                for (int i = CRONO.vueltas.size() - 1; i >= 0; i--) {
                    LinearLayout r = Estilo.renglon(c, -1, "Vuelta " + (i + 1), null, Estilo.texto(c, Tiempos.formato(CRONO.vueltas.get(i), true), 16, Estilo.TEXTO, true));
                    vueltas.addView(r);
                }
            }
        }
    }

    /** La esfera: los minutos, las horas, y las agujas (la del segundero, suave). */
    static final class Esfera extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Esfera(Context c) { super(c); }

        @Override protected void onDraw(Canvas k) {
            float w = getWidth(), h = getHeight(), r = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2;
            p.setStyle(Paint.Style.FILL);
            p.setShader(new SweepGradient(cx, cy, new int[]{0xFF222637, 0xFF2C3148, 0xFF222637}, null));
            k.drawCircle(cx, cy, r, p);
            p.setShader(null);
            p.setStrokeCap(Paint.Cap.ROUND);
            for (int i = 0; i < 60; i++) {
                double a = i * Math.PI / 30;
                boolean hora = i % 5 == 0;
                p.setStrokeWidth(hora ? r * 0.025f : r * 0.01f);
                p.setColor(hora ? 0xFFEDEEF3 : 0x66A2A5B4);
                float r0 = r * (hora ? 0.84f : 0.9f), r1 = r * 0.95f;
                k.drawLine(cx + (float) Math.sin(a) * r0, cy - (float) Math.cos(a) * r0, cx + (float) Math.sin(a) * r1, cy - (float) Math.cos(a) * r1, p);
            }
            Calendar cal = Calendar.getInstance();
            float seg = cal.get(Calendar.SECOND) + cal.get(Calendar.MILLISECOND) / 1000f;
            float min = cal.get(Calendar.MINUTE) + seg / 60, hr = cal.get(Calendar.HOUR) + min / 60;
            aguja(k, cx, cy, hr / 12, r * 0.5f, r * 0.05f, 0xFFEDEEF3);
            aguja(k, cx, cy, min / 60, r * 0.74f, r * 0.035f, 0xFFEDEEF3);
            aguja(k, cx, cy, seg / 60, r * 0.8f, r * 0.014f, 0xFFFFD27A);
            p.setColor(0xFFFFD27A);
            k.drawCircle(cx, cy, r * 0.04f, p);
            postInvalidateOnAnimation();
        }

        private void aguja(Canvas k, float cx, float cy, float f, float largo, float grosor, int color) {
            double a = f * Math.PI * 2;
            p.setColor(color);
            p.setStrokeWidth(grosor);
            k.drawLine(cx - (float) Math.sin(a) * largo * 0.12f, cy + (float) Math.cos(a) * largo * 0.12f, cx + (float) Math.sin(a) * largo, cy - (float) Math.cos(a) * largo, p);
        }
    }

    /** El anillo del temporizador: lo que queda, con un degradé. */
    static final class AnilloTiempo extends View {
        float progreso;
        boolean anda;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        AnilloTiempo(Context c) { super(c); }

        @Override protected void onDraw(Canvas k) {
            float w = getWidth(), h = getHeight(), d = Math.min(w, h), g = d * 0.06f, rad = d / 2 - g;
            r.set(w / 2 - rad, h / 2 - rad, w / 2 + rad, h / 2 + rad);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeWidth(g);
            p.setShader(null);
            p.setColor(0x26FFFFFF);
            k.drawArc(r, 0, 360, false, p);
            if (progreso > 0.001f) {
                p.setShader(new SweepGradient(w / 2, h / 2, new int[]{0xFF6FB6FF, 0xFFA78BFF, 0xFFFFD27A, 0xFF6FB6FF}, null));
                p.setAlpha(anda ? 255 : 150);
                k.drawArc(r, -90, 360 * progreso, false, p);
            }
        }
    }
}
