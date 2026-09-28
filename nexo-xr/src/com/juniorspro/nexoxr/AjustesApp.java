package com.juniorspro.nexoxr;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

/**
 * LOS AJUSTES: a la izquierda las secciones, a la derecha lo de cada una.
 *   Entorno · Visor · Manos y control · Sonido · Acerca de (y las actualizaciones)
 */
final class AjustesApp {
    private static final String[] SECCIONES = {"Entorno", "Espacio", "Visor", "Manos y control", "Sonido", "Acerca de"};
    private static final int[] ICONOS = {Iconos.MONTANA, Iconos.MESA, Iconos.VISOR, Iconos.MANO, Iconos.SONIDO, Iconos.INFO};
    private final LinearLayout[] botones = new LinearLayout[SECCIONES.length];
    private LinearLayout contenido;
    private Sistema s;
    private Context c;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private TextView estado;

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        LinearLayout raiz = new LinearLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        // las secciones
        LinearLayout nav = new LinearLayout(c);
        nav.setOrientation(LinearLayout.VERTICAL);
        nav.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 12);
        nav.setPadding(m, m * 2, m, m);
        TextView t = Estilo.texto(c, "Ajustes", 24, Estilo.TEXTO, true);
        t.setPadding(Estilo.dp(c, 10), 0, 0, Estilo.dp(c, 14));
        nav.addView(t);
        for (int i = 0; i < SECCIONES.length; i++) {
            final int k = i;
            LinearLayout b = new LinearLayout(c);
            b.setGravity(Gravity.CENTER_VERTICAL);
            b.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 11), Estilo.dp(c, 12), Estilo.dp(c, 11));
            b.addView(Estilo.icono(c, ICONOS[i], Estilo.TEXTO, 22));
            TextView tt = Estilo.texto(c, SECCIONES[i], 15, Estilo.TEXTO, true);
            tt.setPadding(Estilo.dp(c, 12), 0, 0, 0);
            b.addView(tt);
            b.setClickable(true);
            b.setOnClickListener(v -> { s.sonido(Sonido.CLIC); mostrar(k); });
            LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-1, -2);
            lb.bottomMargin = Estilo.dp(c, 4);
            nav.addView(b, lb);
            botones[i] = b;
        }
        raiz.addView(nav, new LinearLayout.LayoutParams(Estilo.dp(c, 200), -1));
        ScrollView sv = new ScrollView(c);
        contenido = new LinearLayout(c);
        contenido.setOrientation(LinearLayout.VERTICAL);
        contenido.setPadding(Estilo.dp(c, 24), Estilo.dp(c, 24), Estilo.dp(c, 24), Estilo.dp(c, 24));
        sv.addView(contenido);
        raiz.addView(sv, new LinearLayout.LayoutParams(0, -1, 1));
        mostrar(0);
        return raiz;
    }

    private void mostrar(int k) {
        for (int i = 0; i < botones.length; i++)
            botones[i].setBackground(Estilo.apretable(i == k ? Estilo.AZUL : 0x00000000, i == k ? Estilo.AZUL_CLARO : Estilo.TARJETA, Estilo.dp(c, 14)));
        contenido.removeAllViews();
        estado = null;
        contenido.addView(titulo(SECCIONES[k]));
        Ajustes a = s.ajustes();
        switch (k) {
            case 0: entornos(); break;
            case 1: espacio(a); break;
            case 2:
                contenido.addView(interruptor(Iconos.VISOR, "Modo visor (SBS)", "Las dos imágenes, una para cada ojo, para el visor", s.visor(), si -> s.visor(si)));
                contenido.addView(deslizador(Iconos.OJO, "Distancia entre ojos", "ipdMm", 50, 75, a.ipdMm, "%d mm"));
                contenido.addView(interruptor(Iconos.VISOR, "Corregir los lentes", "Deforma al revés para que el lente la enderece", a.corregirLentes == 1, si -> s.cambio("corregirLentes", si ? 1 : 0)));
                contenido.addView(deslizador(Iconos.VISOR, "Distorsión k1", "k1", 0, 80, a.k1, "0.%02d"));
                contenido.addView(deslizador(Iconos.VISOR, "Distorsión k2", "k2", 0, 80, a.k2, "0.%02d"));
                contenido.addView(deslizador(Iconos.CINE, "Tamaño de la imagen", "tamano", 50, 100, a.tamano, "%d %%"));
                contenido.addView(deslizador(Iconos.OJO, "Campo visual del visor", "fov", 60, 120, a.fov, "%d°"));
                contenido.addView(ayuda("Para que el mundo no \"nade\": girá la cabeza de lado a lado mirando una ventana. Si la ventana se va CON vos, bajalo; si se va para el otro lado, subilo."));
                contenido.addView(titulo2("Nexo Track (que el mundo no se mueva solo)"));
                contenido.addView(deslizador(Iconos.RECENTRAR, "Predicción del giro", "anticipo", 0, 60, a.anticipo, "%d ms adelante"));
                contenido.addView(ayuda("Lo que tarda la imagen en llegar a los ojos. Si al girar rápido el mundo se atrasa, subila; si se adelanta y rebota al frenar, bajala."));
                contenido.addView(interruptor(Iconos.OJO, "Los ojos: medirlos solos", "En el visor, girá la cabeza unos segundos (sin caminar) y Nexo encuentra dónde están tus ojos desde la cámara",
                        a.ojoAuto == 1, si -> { s.cambio("ojoAuto", si ? 1 : 0); ui.postDelayed(() -> mostrar(2), 150); }));
                if (a.ojoAuto == 1)
                    contenido.addView(ayuda(String.format(java.util.Locale.ROOT, "Ahora: %.1f cm al costado, %.1f cm arriba, %.1f cm detrás de la cámara.", a.ojoX / 10f, a.ojoY / 10f, a.ojoZ / 10f)));
                else {
                    contenido.addView(deslizador(Iconos.OJO, "Ojos: al costado de la cámara", "ojoX", -90, 90, a.ojoX, "%d mm (+ derecha)"));
                    contenido.addView(deslizador(Iconos.OJO, "Ojos: arriba de la cámara", "ojoY", -50, 50, a.ojoY, "%d mm"));
                    contenido.addView(deslizador(Iconos.OJO, "Ojos: detrás de la cámara", "ojoZ", 0, 140, a.ojoZ, "%d mm"));
                }
                contenido.addView(Estilo.renglon(c, Iconos.RECENTRAR, "Recentrar", "Todo delante de donde mirás (o doble pellizco en la nada, sostenido 1 s)",
                        Estilo.boton(c, -1, "Recentrar", true, v -> s.recentrar())));
                break;
            case 3:
                contenido.addView(interruptor(Iconos.MANO, "Hand tracking", "Tus manos con la cámara: doble pellizco = clic", a.manos == 1, si -> s.cambio("manos", si ? 1 : 0)));
                contenido.addView(interruptor(Iconos.MANO, "Clic con doble pellizco", "Dos pellizcos rápidos para hacer clic: la mano que se cierra sin querer no aprieta nada", a.doblePellizco == 1, si -> s.cambio("doblePellizco", si ? 1 : 0)));
                contenido.addView(interruptor(Iconos.MANO, "Ver mis manos", "Las manos transparentes, con el borde que brilla", a.verManos == 1, si -> s.cambio("verManos", si ? 1 : 0)));
                contenido.addView(interruptor(Iconos.MANO, "Tocar con el dedo", "Las pantallas cercanas se tocan como un celular", a.dedo == 1, si -> s.cambio("dedo", si ? 1 : 0)));
                contenido.addView(interruptor(Iconos.OJO, "Clic mirando", "Sin manos: mirá fijo un botón 1 segundo", a.mirada == 1, si -> s.cambio("mirada", si ? 1 : 0)));
                contenido.addView(deslizador(Iconos.RECENTRAR, "Punto de mira de las manos", "apuntarAbajo", 0, 25, a.apuntarAbajo, "%d cm debajo de la vista"));
                contenido.addView(Estilo.renglon(c, Iconos.CONTROL, "Control Bluetooth", "El del VR Box, un gamepad o un teclado: aprender sus botones",
                        Estilo.boton(c, -1, "Configurar", false, v -> s.aprenderControl())));
                break;
            case 4: {
                contenido.addView(interruptor(Iconos.SONIDO, "Sonidos del sistema", "Clics, abrir y cerrar ventanas", a.sonido == 1, si -> s.cambio("sonido", si ? 1 : 0)));
                AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
                SeekBar vol = Estilo.deslizador(c, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), am.getStreamVolume(AudioManager.STREAM_MUSIC), new SeekBar.OnSeekBarChangeListener() {
                    public void onProgressChanged(SeekBar b, int v, boolean u) { if (u) am.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0); }
                    public void onStartTrackingTouch(SeekBar b) { }
                    public void onStopTrackingTouch(SeekBar b) { }
                });
                vol.setLayoutParams(new LinearLayout.LayoutParams(Estilo.dp(c, 220), Estilo.dp(c, 40)));
                contenido.addView(Estilo.renglon(c, Iconos.SONIDO, "Volumen", null, vol));
                break;
            }
            default:
                Actualizador act = Actualizador.de(c);
                contenido.addView(Estilo.texto(c, "Nexo XR " + act.instaladaNombre, 18, Estilo.TEXTO, true));
                contenido.addView(Estilo.texto(c, "Un sistema de realidad mixta para el teléfono y un visor: pantallas en el espacio, entornos 3D, passthrough y tus manos.", 14, Estilo.TEXTO2, false));
                LinearLayout.LayoutParams lu = new LinearLayout.LayoutParams(-1, -2);
                lu.topMargin = Estilo.dp(c, 16);
                boolean hay = act.nuevaCodigo > act.instalada;
                contenido.addView(Estilo.renglon(c, Iconos.ACTUALIZAR, hay ? "Hay una nueva: la " + act.nuevaNombre : "Actualizaciones",
                        hay ? "Se baja e instala desde Nexo" : "Nexo se fija solo al abrir; también podés buscar ahora",
                        Estilo.boton(c, -1, hay ? "Actualizar" : "Buscar", hay, v -> { s.sonido(Sonido.CLIC); s.abrir("actualizar"); })), lu);
                estado = Estilo.texto(c, "", 13, Estilo.TEXTO2, false);
                LinearLayout.LayoutParams le = new LinearLayout.LayoutParams(-1, -2);
                le.topMargin = Estilo.dp(c, 16);
                contenido.addView(estado, le);
                LinearLayout.LayoutParams ld = new LinearLayout.LayoutParams(-1, -2);
                ld.topMargin = Estilo.dp(c, 16);
                contenido.addView(Estilo.renglon(c, Iconos.CAPTURA, "Grabar un diagnóstico",
                        "20 s de cómo anda el seguimiento y las manos, a Descargas/Nexo: mandame el archivo y lo arreglo con datos de tu teléfono",
                        Estilo.boton(c, -1, "Grabar", false, v -> { s.sonido(Sonido.CLIC); s.grabarDiagnostico(); })), ld);
                refrescarEstado();
        }
    }

    /** ESPACIO: tu mesa (o el cuarto), cuándo se mueve Nexo, prepararlo de nuevo. */
    private void espacio(Ajustes a) {
        String[] modos = {"", "Mesa", "Cuarto", "Sólo girar"};
        int m = a.modoEspacio >= 1 && a.modoEspacio <= 3 ? a.modoEspacio : 1;
        contenido.addView(Estilo.renglon(c, Iconos.MESA, "Preparar el espacio ahora",
                "Escanear tu mesa (o el cuarto), apoyar las manos y fijar la cabeza. Último modo: " + modos[m],
                Estilo.boton(c, Iconos.RECENTRAR, "Preparar", true, v -> { s.sonido(Sonido.CLIC); s.prepararEspacio(); })));
        contenido.addView(interruptor(Iconos.MESA, "Preparar el espacio al empezar", "Cada vez que abrís Nexo, antes de las apps",
                a.prepararEspacio == 1, si -> s.cambio("prepararEspacio", si ? 1 : 0)));
        contenido.addView(interruptor(Iconos.RECENTRAR, "Sólo moverse cuando veo tu mesa",
                "Si la cámara no la ve (mirás el techo o una pared lisa), la posición queda fija y sólo girás: nada se desliza",
                a.soloConMesa == 1, si -> s.cambio("soloConMesa", si ? 1 : 0)));
        contenido.addView(interruptor(Iconos.MESA, "Ver la mesa marcada", "El borde que brilla y la etiqueta \"Tu mesa\" (también en los entornos)",
                a.verMesa == 1, si -> s.cambio("verMesa", si ? 1 : 0)));
        contenido.addView(interruptor(Iconos.APPS, "La barra de abajo sobre la mesa", "Apoyada delante tuyo: la tocás con el dedo y la mesa te frena",
                a.barraEnMesa == 1, si -> { s.cambio("barraEnMesa", si ? 1 : 0); s.recentrar(); }));
        contenido.addView(ayuda(String.format(java.util.Locale.ROOT, "El tamaño de tus manos (medido en la mesa): ×%.2f", a.escalaMano / 1000f)));
        estado = Estilo.texto(c, "", 13, Estilo.TEXTO2, false);
        LinearLayout.LayoutParams le = new LinearLayout.LayoutParams(-1, -2);
        le.topMargin = Estilo.dp(c, 8);
        contenido.addView(estado, le);
        refrescarEstado();
    }

    private void refrescarEstado() {
        if (estado == null) return;
        estado.setText(s.estado());
        ui.postDelayed(this::refrescarEstado, 1500);
    }

    private TextView ayuda(String t) {
        TextView v = Estilo.texto(c, t, 13, Estilo.TEXTO2, false);
        v.setPadding(Estilo.dp(c, 14), Estilo.dp(c, 2), Estilo.dp(c, 14), Estilo.dp(c, 10));
        return v;
    }

    private TextView titulo2(String t) {
        TextView v = Estilo.texto(c, t, 17, Estilo.TEXTO, true);
        v.setPadding(0, Estilo.dp(c, 18), 0, Estilo.dp(c, 8));
        return v;
    }

    private TextView titulo(String t) {
        TextView v = Estilo.texto(c, t, 24, Estilo.TEXTO, true);
        v.setPadding(0, 0, 0, Estilo.dp(c, 16));
        return v;
    }

    private void entornos() {
        GridLayout g = new GridLayout(c);
        g.setColumnCount(2);
        int[][] colores = {{0xFF3A3F4B, 0xFF1E2129}, {0xFF2B1B55, 0xFF050818}, {0xFFF0925A, 0xFF2D3E7A}, {0xFF8A5A36, 0xFF2E1D12}};
        int actual = s.entorno();
        for (int i = 0; i < Entornos.CANTIDAD; i++) {
            final int k = i;
            FrameLayout f = new FrameLayout(c);
            GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, colores[i]);
            d.setCornerRadius(Estilo.dp(c, 18));
            if (i == actual) d.setStroke(Estilo.dp(c, 3), Estilo.AZUL_CLARO);
            f.setBackground(d);
            TextView t = Estilo.texto(c, Entornos.NOMBRES[i], 17, 0xFFFFFFFF, true);
            FrameLayout.LayoutParams lt = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.START);
            lt.setMargins(Estilo.dp(c, 16), 0, 0, Estilo.dp(c, 14));
            f.addView(t, lt);
            f.addView(Estilo.icono(c, i == 0 ? Iconos.OJO : Iconos.MONTANA, 0xCCFFFFFF, 34), new FrameLayout.LayoutParams(Estilo.dp(c, 34), Estilo.dp(c, 34), Gravity.TOP | Gravity.END));
            f.setClickable(true);
            f.setForeground(Estilo.apretable(0x00000000, 0x33FFFFFF, Estilo.dp(c, 18)));
            f.setOnClickListener(v -> { s.sonido(Sonido.CLIC); s.entorno(k); ui.postDelayed(() -> mostrar(0), 100); });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / 2), GridLayout.spec(i % 2, 1f));
            lp.width = 0;
            lp.height = Estilo.dp(c, 120);
            lp.setMargins(Estilo.dp(c, 6), Estilo.dp(c, 6), Estilo.dp(c, 6), Estilo.dp(c, 6));
            g.addView(f, lp);
        }
        contenido.addView(g);
    }

    private View interruptor(int icono, String t, String d, boolean valor, Estilo.Interruptor.Cambio cb) {
        return Estilo.renglon(c, icono, t, d, new Estilo.Interruptor(c, valor, si -> { s.sonido(Sonido.CLIC); cb.cambio(si); }));
    }

    private View deslizador(int icono, String t, String clave, int min, int max, int valor, String formato) {
        LinearLayout r = Estilo.renglon(c, icono, t, String.format(formato, valor), null);
        TextView det = r.findViewWithTag("detalle");
        SeekBar b = Estilo.deslizador(c, max - min, valor - min, new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar x, int v, boolean u) { if (u) { s.cambio(clave, v + min); det.setText(String.format(formato, v + min)); } }
            public void onStartTrackingTouch(SeekBar x) { }
            public void onStopTrackingTouch(SeekBar x) { }
        });
        r.addView(b, new LinearLayout.LayoutParams(Estilo.dp(c, 220), Estilo.dp(c, 40)));
        return r;
    }
}
