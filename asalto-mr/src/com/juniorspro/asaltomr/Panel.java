package com.juniorspro.asaltomr;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Locale;

/**
 * El panel de configuración, armado a mano (sin XML): filas de opciones y
 * deslizadores. Cada cambio se guarda al toque y se avisa al Oyente.
 *
 * (Sin clases anónimas: el d8 de estas build-tools no las traga; los oyentes
 * son clases con nombre.)
 */
final class Panel {
    interface Oyente {
        void cambio(String clave);

        void accion(String cual);
    }

    final ScrollView vista;
    private final LinearLayout lista;
    private final Context ctx;
    private final Ajustes ajustes;
    private final Oyente oyente;
    private final ArrayList<Runnable> refrescos = new ArrayList<>();
    TextView info;

    Panel(Context ctx, Ajustes ajustes, Oyente oyente) {
        this.ctx = ctx;
        this.ajustes = ajustes;
        this.oyente = oyente;
        vista = new ScrollView(ctx);
        GradientDrawable f = new GradientDrawable();
        f.setColor(0xF007030F);
        f.setCornerRadius(dp(18));
        f.setStroke(dp(1), 0xFF5A2FD9);
        vista.setBackground(f);
        lista = new LinearLayout(ctx);
        lista.setOrientation(LinearLayout.VERTICAL);
        lista.setPadding(dp(18), dp(14), dp(18), dp(18));
        vista.addView(lista);

        titulo("Configuración");
        info = texto("", 12, 0xFFB3A8D6);
        lista.addView(info);

        seccion("Visor");
        opciones("sbs", "Modo", new String[]{"Pantalla", "SBS (visor)"});
        opciones("estereo", "Entorno en SBS", new String[]{"Plano", "3D (reproyectado)"});
        deslizador("ipdMm", "Distancia entre ojos (IPD)", 50, 75, "%d mm");
        deslizador("lentesMm", "Centro de los lentes del visor", 50, 75, "%d mm");
        deslizador("tamano", "Tamaño de la imagen", 50, 100, "%d %%");
        opciones("corregirLentes", "Corregir lentes", new String[]{"No", "Sí"});
        deslizador("k1", "Distorsión k1", 0, 80, "0.%02d");
        deslizador("k2", "Distorsión k2", 0, 80, "0.%02d");
        opciones("intercambiar", "Ojos", new String[]{"Normal", "Cambiados"});

        seccion("Escaneo del entorno");
        opciones("malla", "Malla", new String[]{"Oculta", "Escaneo", "Sólida"});
        opciones("detalle", "Detalle (voxel)", new String[]{"Fino 5 cm", "7 cm", "Grueso 10 cm"});
        opciones("rellenar", "Completar lo que no se ve (IA)", new String[]{"No", "Sí"});
        info("Supone el piso debajo y detrás de las cosas, la parte de atrás de los objetos y que todo "
                + "llega hasta el suelo. Lo supuesto sale en ámbar punteado; si después lo ves, lo real lo reemplaza.");
        opciones("sellar", "Sellar los huecos", new String[]{"No", "Solos", "Yo desde el menú"});
        info("Busca los huecos de las paredes, el piso y las mesas (detrás del sillón, debajo de la mochila) y los "
                + "cierra con su plano. Al escanear se ven: magenta = por sellar · celeste = sellado · naranja = "
                + "falta escanear (muy grande: miralo) · gris = abertura (una ventana: no se sella).");
        opciones("zonas", "Ver las zonas de la IA", new String[]{"No", "Al escanear", "Siempre"});
        info("Verde: por donde pueden ir · amarillo: cubierta · azul: agua · rojo: obstáculo · "
                + "magenta: falta escanear. \"Siempre\" también muestra las rutas de los soldados.");
        boton("Escaneo completo (empezar de nuevo)", "reescanear");

        seccion("Cámara");
        opciones("camara", "Cámara", new String[]{"ARCore", "Más ancha", "Ultra angular"});
        info("\"Más ancha\" elige la configuración de ARCore con más campo visual (4:3 en vez de 16:9). "
                + "\"Ultra angular\" le pide a la cámara zoom < 1× (experimental: ARCore está calibrado para la "
                + "principal, el seguimiento puede fallar). Se aplica al volver a abrir la cámara.");

        seccion("La pistola en la mano");
        opciones("mano", "Hand tracking", new String[]{"No", "Sí (mano fantasma)", "Sí + esqueleto"});
        info("Empuñá como si tuvieras la pistola, con el índice estirado. Cerrar el índice (apretar el gatillo) "
                + "dispara; la mano abierta recarga. Sin la mano a la vista, la pistola vuelve a la pantalla y se "
                + "dispara tocando o con el volumen. Se aplica al volver a abrir la app.");
        opciones("apuntar", "Apuntar con", new String[]{"El rayo ojo → mano (firme)", "La muñeca"});
        info("\"El rayo\": el caño va de tu vista por la mano, como apunta la gente; la distancia de la mano "
                + "(lo que peor mide una cámara) no lo mueve. \"La muñeca\": con la forma de la mano; apuntando al fondo "
                + "se puede ir de costado.");
        boton("Calibrar la puntería (3 blancos)", "punteria");
        opciones("seguro", "Modo seguro", new String[]{"No", "Sí"});

        seccion("Control Bluetooth (el del VR Box)");
        info("Conectalo en los ajustes de Bluetooth del teléfono. Anda en cualquier modo: música (@+A), "
                + "gamepad (@+B), mouse (@+C) o teclas (@+D). De fábrica: el gatillo dispara (mantenelo con el fusil), "
                + "B/X o joystick abajo recarga, joystick a los costados cambia de arma, start / Atrás del control = menú. "
                + "Con la mano en el arma, el gatillo del control dispara desde la mano (apuntás con la mano, tirás con el dedo del control).");
        boton("Aprender los botones de mi control", "controlAprender");
        boton("Volver a los botones de fábrica", "controlDefecto");

        seccion("Juego");
        opciones("dificultad", "Dificultad", new String[]{"Fácil", "Normal", "Difícil"});
        opciones("sonido", "Sonido", new String[]{"No", "Sí"});
        opciones("vibrar", "Vibrar", new String[]{"No", "Sí"});
        boton("Empezar de nuevo", "reiniciar");
        boton("Listo", "cerrar");
    }

    void refrescar() { for (Runnable r : refrescos) r.run(); }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.getResources().getDisplayMetrics()));
    }

    private TextView texto(String s, float sp, int color) {
        TextView t = new TextView(ctx);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        return t;
    }

    private void titulo(String s) {
        TextView t = texto(s, 22, Color.WHITE);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        lista.addView(t);
    }

    private void seccion(String s) {
        TextView t = texto(s.toUpperCase(Locale.ROOT), 13, 0xFFC9B0FF);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(16), 0, dp(4));
        lista.addView(t);
    }

    private void info(String s) {
        TextView t = texto(s, 12, 0xFF9A90BF);
        t.setPadding(0, dp(2), 0, dp(4));
        lista.addView(t);
    }

    private Button botonChico(String s) {
        Button b = new Button(ctx);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        b.setMinHeight(dp(40));
        b.setMinimumHeight(dp(40));
        b.setPadding(dp(10), 0, dp(10), 0);
        return b;
    }

    private static void pintar(Button b, boolean elegido, float r) {
        GradientDrawable f = new GradientDrawable();
        f.setColor(elegido ? 0xFF6A3BD6 : 0xFF221A3A);
        f.setStroke(2, elegido ? 0xFFC9B0FF : 0xFF3A2A6E);
        f.setCornerRadius(r);
        b.setBackground(f);
    }

    /** Oyente de un botón de opción: pone el valor y repinta la fila. */
    private static final class AlElegir implements View.OnClickListener {
        final Panel panel; final String clave; final int valor;

        AlElegir(Panel p, String c, int v) { panel = p; clave = c; valor = v; }

        @Override
        public void onClick(View v) {
            panel.ajustes.poner(clave, valor);
            panel.ajustes.guardar(panel.ctx);
            panel.refrescar();
            panel.oyente.cambio(clave);
        }
    }

    private static final class Repintar implements Runnable {
        final Panel panel; final String clave; final Button[] bs;

        Repintar(Panel p, String c, Button[] b) { panel = p; clave = c; bs = b; }

        @Override
        public void run() {
            int v = panel.ajustes.valor(clave);
            for (int i = 0; i < bs.length; i++) pintar(bs[i], i == v, panel.dp(12));
        }
    }

    private void opciones(String clave, String nombre, String[] valores) {
        lista.addView(texto(nombre, 14, 0xFFF2EEFF));
        LinearLayout fila = new LinearLayout(ctx);
        fila.setOrientation(LinearLayout.HORIZONTAL);
        Button[] bs = new Button[valores.length];
        for (int i = 0; i < valores.length; i++) {
            Button b = botonChico(valores[i]);
            b.setOnClickListener(new AlElegir(this, clave, i));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(40), 1);
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            fila.addView(b, lp);
            bs[i] = b;
        }
        lista.addView(fila);
        Repintar r = new Repintar(this, clave, bs);
        refrescos.add(r);
        r.run();
    }

    private static final class AlDeslizar implements SeekBar.OnSeekBarChangeListener {
        final Panel panel; final String clave, formato; final int min; final TextView etiqueta; final String nombre;

        AlDeslizar(Panel p, String c, int min, TextView t, String nombre, String formato) {
            panel = p; clave = c; this.min = min; etiqueta = t; this.nombre = nombre; this.formato = formato;
        }

        void mostrar(int v) { etiqueta.setText(nombre + ": " + String.format(Locale.ROOT, formato, v)); }

        @Override
        public void onProgressChanged(SeekBar s, int progreso, boolean delUsuario) {
            int v = progreso + min;
            mostrar(v);
            if (!delUsuario) return;
            panel.ajustes.poner(clave, v);
            panel.oyente.cambio(clave);
        }

        @Override
        public void onStartTrackingTouch(SeekBar s) { }

        @Override
        public void onStopTrackingTouch(SeekBar s) { panel.ajustes.guardar(panel.ctx); }
    }

    private static final class Releer implements Runnable {
        final Panel panel; final String clave; final SeekBar barra; final int min;

        Releer(Panel p, String c, SeekBar b, int min) { panel = p; clave = c; barra = b; this.min = min; }

        @Override
        public void run() { barra.setProgress(panel.ajustes.valor(clave) - min); }
    }

    private void deslizador(String clave, String nombre, int min, int max, String formato) {
        TextView t = texto("", 14, 0xFFF2EEFF);
        lista.addView(t);
        SeekBar b = new SeekBar(ctx);
        b.setMax(max - min);
        AlDeslizar o = new AlDeslizar(this, clave, min, t, nombre, formato);
        b.setOnSeekBarChangeListener(o);
        b.setProgress(ajustes.valor(clave) - min);
        o.mostrar(ajustes.valor(clave));
        lista.addView(b, new LinearLayout.LayoutParams(-1, dp(36)));
        refrescos.add(new Releer(this, clave, b, min));
    }

    private static final class AlAccion implements View.OnClickListener {
        final Panel panel; final String cual;

        AlAccion(Panel p, String c) { panel = p; cual = c; }

        @Override
        public void onClick(View v) { panel.oyente.accion(cual); }
    }

    private void boton(String s, String accion) {
        Button b = botonChico(s);
        pintar(b, accion.equals("cerrar"), dp(12));
        b.setOnClickListener(new AlAccion(this, accion));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(44));
        lp.topMargin = dp(8);
        lista.addView(b, lp);
    }
}
