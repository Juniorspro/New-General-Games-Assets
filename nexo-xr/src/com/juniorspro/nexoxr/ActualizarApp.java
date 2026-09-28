package com.juniorspro.nexoxr;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * LA VENTANA DE LA ACTUALIZACIÓN: la versión que tenés, la nueva y qué trae,
 * y un solo botón: Actualizar. Se abre sola cuando hay una nueva (y desde
 * Ajustes → Acerca de).
 */
final class ActualizarApp implements Actualizador.Mira {
    private TextView titulo, detalle, notas, estado;
    private LinearLayout barra, principal, despues;
    private View lleno, vacio;
    private Sistema s;

    View crear(Context c, Sistema sis, Runnable cerrar) {
        s = sis;
        Actualizador a = Actualizador.de(c);
        LinearLayout raiz = new LinearLayout(c);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Estilo.PANEL);
        int m = Estilo.dp(c, 28);
        raiz.setPadding(m, m, m, m);
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(Estilo.icono(c, Iconos.ACTUALIZAR, Estilo.AZUL_CLARO, 40));
        LinearLayout tt = new LinearLayout(c);
        tt.setOrientation(LinearLayout.VERTICAL);
        tt.setPadding(Estilo.dp(c, 16), 0, 0, 0);
        titulo = Estilo.texto(c, "", 26, Estilo.TEXTO, true);
        detalle = Estilo.texto(c, "", 14, Estilo.TEXTO2, false);
        tt.addView(titulo);
        tt.addView(detalle);
        cab.addView(tt, new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.botonIcono(c, Iconos.CERRAR, 44, v -> { s.sonido(Sonido.CLIC); cerrar.run(); }));
        raiz.addView(cab);
        // qué trae
        notas = Estilo.texto(c, "", 16, Estilo.TEXTO, false);
        notas.setBackground(Estilo.forma(Estilo.TARJETA, Estilo.dp(c, 16)));
        int p = Estilo.dp(c, 18);
        notas.setPadding(p, p, p, p);
        LinearLayout.LayoutParams ln = new LinearLayout.LayoutParams(-1, 0, 1);
        ln.topMargin = Estilo.dp(c, 20);
        raiz.addView(notas, ln);
        // la barra de lo bajado
        barra = new LinearLayout(c);
        barra.setBackground(Estilo.forma(0xFF4A4C58, Estilo.dp(c, 4)));
        lleno = new View(c);
        lleno.setBackground(Estilo.forma(Estilo.AZUL, Estilo.dp(c, 4)));
        vacio = new View(c);
        barra.addView(lleno, new LinearLayout.LayoutParams(0, -1, 0));
        barra.addView(vacio, new LinearLayout.LayoutParams(0, -1, 1));
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-1, Estilo.dp(c, 8));
        lb.topMargin = Estilo.dp(c, 18);
        raiz.addView(barra, lb);
        estado = Estilo.texto(c, "", 14, Estilo.TEXTO2, false);
        LinearLayout.LayoutParams le = new LinearLayout.LayoutParams(-1, -2);
        le.topMargin = Estilo.dp(c, 10);
        raiz.addView(estado, le);
        // los botones
        LinearLayout abajo = new LinearLayout(c);
        abajo.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        despues = Estilo.boton(c, -1, "Después", false, v -> { s.sonido(Sonido.CLIC); a.despues(); cerrar.run(); });
        abajo.addView(despues);
        principal = Estilo.boton(c, Iconos.ACTUALIZAR, "Actualizar", true, v -> {
            s.sonido(Sonido.CLIC);
            if (a.estado == Actualizador.HAY || a.estado == Actualizador.PERMISO || (a.estado == Actualizador.ERROR && a.nuevaCodigo > a.instalada)) a.actualizar();
            else a.buscar(true);
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.leftMargin = Estilo.dp(c, 12);
        abajo.addView(principal, lp);
        LinearLayout.LayoutParams la = new LinearLayout.LayoutParams(-1, -2);
        la.topMargin = Estilo.dp(c, 16);
        raiz.addView(abajo, la);
        raiz.addOnAttachStateChangeListener(new Quitar(a, this));
        a.mirar(this);
        if (a.estado == Actualizador.NADA || a.estado == Actualizador.AL_DIA || a.estado == Actualizador.ERROR) a.buscar(true);
        return raiz;
    }

    /** Al cerrar la ventana deja de escuchar (una clase con nombre: las anónimas rompen el d8). */
    private static final class Quitar implements View.OnAttachStateChangeListener {
        private final Actualizador a;
        private final ActualizarApp v;
        Quitar(Actualizador a, ActualizarApp v) { this.a = a; this.v = v; }
        @Override public void onViewAttachedToWindow(View x) { a.mirar(v); }
        @Override public void onViewDetachedFromWindow(View x) { a.dejar(v); }
    }

    @Override
    public void cambio(Actualizador a) {
        boolean hay = a.nuevaCodigo > a.instalada;
        titulo.setText(hay ? "Nexo " + a.nuevaNombre + " está lista" : "Nexo " + a.instaladaNombre);
        detalle.setText(hay ? "Tenés la " + a.instaladaNombre + (a.tamano().isEmpty() ? "" : " · se bajan " + a.tamano())
                : "Es la versión que tenés instalada");
        String n = a.notas == null ? "" : a.notas.trim();
        notas.setText(hay ? (n.isEmpty() ? "Arreglos y mejoras." : n)
                : a.estado == Actualizador.BUSCANDO ? "Buscando si hay una nueva…" : "Cuando haya una nueva, Nexo te avisa solo.");
        boolean bajando = a.estado == Actualizador.BAJANDO;
        barra.setVisibility(bajando || a.estado == Actualizador.INSTALANDO ? View.VISIBLE : View.INVISIBLE);
        float f = a.estado == Actualizador.INSTALANDO ? 1 : Math.max(0, Math.min(1, a.progreso));
        ((LinearLayout.LayoutParams) lleno.getLayoutParams()).weight = f;
        ((LinearLayout.LayoutParams) vacio.getLayoutParams()).weight = 1 - f;
        barra.requestLayout();
        estado.setText(bajando ? a.mensaje + " " + Math.round(f * 100) + "%" : a.mensaje);
        estado.setTextColor(a.estado == Actualizador.ERROR ? Estilo.ROJO : Estilo.TEXTO2);
        boolean ocupado = bajando || a.estado == Actualizador.INSTALANDO || a.estado == Actualizador.BUSCANDO;
        principal.setAlpha(ocupado ? 0.4f : 1);
        principal.setEnabled(!ocupado);
        ((TextView) principal.getChildAt(principal.getChildCount() - 1)).setText(
                hay ? (a.estado == Actualizador.ERROR ? "Reintentar" : "Actualizar") : "Buscar de nuevo");
        despues.setVisibility(hay && !ocupado ? View.VISIBLE : View.GONE);
    }
}
