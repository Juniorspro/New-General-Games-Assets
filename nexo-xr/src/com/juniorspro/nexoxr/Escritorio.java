package com.juniorspro.nexoxr;

import java.util.ArrayList;
import java.util.List;

/**
 * El ESCRITORIO en el espacio: dónde va cada pantalla.
 *
 *  - Las apps se abren en un ARCO delante tuyo, a 1.1 m: el lugar del centro
 *    primero, después a la izquierda y a la derecha (hasta 3 a la vez, como
 *    en los visores; la cuarta reemplaza a la más vieja que no esté enfocada).
 *  - La BARRA DE ABAJO (el dock) queda abajo y adelante, inclinada hacia vos;
 *    los AJUSTES RÁPIDOS, justo arriba del dock; el TECLADO, debajo de la
 *    ventana enfocada.
 *  - Una ventana que arrastrás de su barra sigue al rayo a la misma distancia
 *    y siempre de frente a vos; queda donde la soltás.
 *  - RECENTRAR pone todo otra vez delante de donde estás mirando.
 *
 * Todo relativo al ANCLA: tu posición y hacia dónde mirabas al recentrar.
 * Sin Android: se prueba en la PC (pruebas/PruebaEscritorio.java).
 */
public final class Escritorio {
    public static final float RADIO = 1.1f, SEPARACION = (float) Math.toRadians(54), ANCHO_APP = 1.0f;
    public static final int MAX_APPS = 3;
    /** Los lugares del arco, en orden de preferencia: centro, izquierda, derecha (en ángulos desde el frente). */
    static final float[] LUGARES = {0, SEPARACION, -SEPARACION};

    public final List<Ventana> ventanas = new ArrayList<>();
    /** El ancla: dónde estabas y hacia dónde mirabas (yaw: 0 = mirando a −Z). */
    public float ax, ay, az, ayaw;
    private int proximoId = 1;
    public Ventana dock, rapidos, teclado;
    /** La que tiene el foco (la última que tocaste). */
    public Ventana enfocada;
    /** Tu mesa (Nexo Inicio): el punto delante tuyo donde se apoya la barra de abajo, o null. */
    public float[] mesa;

    /** Pone el ancla (la primera vez, y al recentrar). ojo: la cabeza; yaw de la mirada (0 = −Z). */
    public void recentrar(float x, float y, float z, float yaw) {
        float dyaw = yaw - ayaw, ox = ax, oy = ay, oz = az;
        boolean habia = !ventanas.isEmpty();
        ax = x; ay = y; az = z; ayaw = yaw;
        for (Ventana v : ventanas) {
            if (v.lugar >= 0 || v.tipo != Ventana.APP) { acomodar(v); continue; }
            if (!habia) continue;
            // las que pusiste a mano: giran con vos alrededor del ancla vieja y se mueven a la nueva
            float rx = v.cx - ox, rz = v.cz - oz;
            float c = (float) Math.cos(dyaw), s = (float) Math.sin(dyaw);
            // girar yaw: el yaw de la mirada crece hacia la izquierda (hacia −X desde −Z)
            float nx = rx * c + rz * s, nz = -rx * s + rz * c;
            v.cx = ax + nx; v.cy = ay + (v.cy - oy); v.cz = az + nz;
            v.mirarA(ax, ay, az);
        }
    }

    /** Hacia adelante desde el ancla con un giro extra (rad, + a la izquierda): la dirección horizontal. */
    private void frente(float giro, float[] o) {
        float a = ayaw + giro;
        o[0] = -(float) Math.sin(a);
        o[1] = 0;
        o[2] = -(float) Math.cos(a);
    }

    private final float[] tmp = new float[3];

    /** Pone una ventana en su lugar (según su tipo, o su lugar del arco). */
    public void acomodar(Ventana v) {
        switch (v.tipo) {
            case Ventana.DOCK:
                if (mesa != null) {
                    // apoyada en tu mesa, delante tuyo: de frente a la cabeza, el borde de abajo a 1.5 cm de la mesa
                    v.cx = mesa[0]; v.cy = mesa[1] + 0.05f; v.cz = mesa[2];
                    v.mirarA(ax, ay, az);
                    v.cy = mesa[1] + 0.015f + Math.abs(v.u[1]) * v.alto / 2;
                    v.mirarA(ax, ay, az);
                    return;
                }
                frente(0, tmp);
                v.cx = ax + tmp[0] * 0.72f; v.cy = ay - 0.40f; v.cz = az + tmp[2] * 0.72f;
                break;
            case Ventana.RAPIDOS:
                frente(0, tmp);
                v.cx = ax + tmp[0] * 0.78f; v.cy = ay - 0.08f; v.cz = az + tmp[2] * 0.78f;
                break;
            case Ventana.TECLADO: {
                Ventana e = enfocada != null && enfocada.visible && enfocada.tipo == Ventana.APP ? enfocada : null;
                if (e != null) {
                    // debajo de la ventana, más cerca y más abajo
                    float dx = e.cx - ax, dz = e.cz - az, l = (float) Math.sqrt(dx * dx + dz * dz);
                    float k = l > 0.01f ? Math.min(0.62f, l * 0.6f) / l : 0;
                    v.cx = ax + dx * k; v.cy = ay - 0.30f; v.cz = az + dz * k;
                } else {
                    frente(0, tmp);
                    v.cx = ax + tmp[0] * 0.62f; v.cy = ay - 0.30f; v.cz = az + tmp[2] * 0.62f;
                }
                break;
            }
            case Ventana.AVISO:
                frente(0, tmp);
                v.cx = ax + tmp[0] * 1.0f; v.cy = ay + 0.02f; v.cz = az + tmp[2] * 1.0f;
                break;
            default:
                if (v.cine) {
                    frente(0, tmp);
                    v.cx = ax + tmp[0] * 3.2f; v.cy = ay + 0.25f; v.cz = az + tmp[2] * 3.2f;
                } else if (v.lugar >= 0) {
                    frente(LUGARES[v.lugar], tmp);
                    v.cx = ax + tmp[0] * RADIO; v.cy = ay - 0.02f; v.cz = az + tmp[2] * RADIO;
                } else return;
        }
        v.mirarA(ax, ay, az);
    }

    private Ventana nueva(int tipo, String app, float ancho, int px, int py, long ahora) {
        Ventana v = new Ventana(proximoId++, tipo, app, ancho, px, py);
        v.abiertaEn = ahora;
        ventanas.add(v);
        return v;
    }

    /** Abre una app (o la trae al frente si ya estaba abierta). */
    public Ventana abrir(String app, int px, int py, long ahora) {
        for (Ventana v : ventanas) if (v.tipo == Ventana.APP && v.app.equals(app)) { v.visible = true; enfocar(v); return v; }
        boolean[] ocupado = new boolean[LUGARES.length];
        int apps = 0;
        for (Ventana v : ventanas) if (v.tipo == Ventana.APP) { apps++; if (v.lugar >= 0) ocupado[v.lugar] = true; }
        if (apps >= MAX_APPS) {
            // se va la más vieja que no está enfocada
            Ventana vieja = null;
            for (Ventana v : ventanas) if (v.tipo == Ventana.APP && v != enfocada && (vieja == null || v.abiertaEn < vieja.abiertaEn)) vieja = v;
            if (vieja == null) for (Ventana v : ventanas) if (v.tipo == Ventana.APP) { vieja = v; break; }
            cerrar(vieja);
            if (vieja.lugar >= 0) ocupado[vieja.lugar] = false;
        }
        int lugar = -1;
        for (int k = 0; k < LUGARES.length; k++) if (!ocupado[k]) { lugar = k; break; }
        Ventana v = nueva(Ventana.APP, app, ANCHO_APP, px, py, ahora);
        v.lugar = lugar < 0 ? 0 : lugar;
        acomodar(v);
        enfocar(v);
        return v;
    }

    public Ventana ponerDock(int px, int py, float ancho, long ahora) {
        dock = nueva(Ventana.DOCK, "dock", ancho, px, py, ahora);
        acomodar(dock);
        return dock;
    }

    public Ventana ponerRapidos(int px, int py, float ancho, long ahora) {
        rapidos = nueva(Ventana.RAPIDOS, "rapidos", ancho, px, py, ahora);
        rapidos.visible = false;
        acomodar(rapidos);
        return rapidos;
    }

    public Ventana ponerTeclado(int px, int py, float ancho, long ahora) {
        teclado = nueva(Ventana.TECLADO, "teclado", ancho, px, py, ahora);
        teclado.visible = false;
        acomodar(teclado);
        return teclado;
    }

    public void mostrarTeclado(boolean si) {
        if (teclado == null) return;
        if (si) acomodar(teclado);
        teclado.visible = si;
    }

    public void cerrar(Ventana v) {
        if (v == null) return;
        ventanas.remove(v);
        if (enfocada == v) {
            enfocada = null;
            for (Ventana w : ventanas) if (w.tipo == Ventana.APP && (enfocada == null || w.abiertaEn > enfocada.abiertaEn)) enfocada = w;
            if (enfocada != null) enfocada.enfocada = true;
        }
    }

    public void enfocar(Ventana v) {
        if (v.tipo != Ventana.APP) return;
        for (Ventana w : ventanas) w.enfocada = false;
        v.enfocada = true;
        enfocada = v;
    }

    /** Modo cine: la ventana enorme y lejos (o vuelve a donde estaba). */
    public void cine(Ventana v, boolean si) {
        if (v.tipo != Ventana.APP || v.cine == si) return;
        if (si) {
            for (Ventana w : ventanas) if (w != v && w.cine) cine(w, false);
            v.antesDeCine = new float[]{v.cx, v.cy, v.cz, v.ancho, v.lugar};
            v.cine = true;
            v.ancho = 3.4f;
            v.alto = v.ancho * v.py / v.px;
            acomodar(v);
        } else {
            v.cine = false;
            float[] a = v.antesDeCine;
            v.ancho = a[3];
            v.alto = v.ancho * v.py / v.px;
            v.lugar = (int) a[4];
            if (v.lugar >= 0) acomodar(v);
            else { v.cx = a[0]; v.cy = a[1]; v.cz = a[2]; v.mirarA(ax, ay, az); }
        }
    }

    public Ventana enCine() {
        for (Ventana v : ventanas) if (v.cine && v.visible) return v;
        return null;
    }

    // ── arrastrar de la barra ──

    private Ventana arrastrada;
    private float distArrastre, agarreX, agarreY;

    /** Empieza a arrastrar: el rayo sale de la cabeza (ox..) y agarró la barra en (x, y) del plano. */
    public void empezarArrastre(Ventana v, float ox, float oy, float oz, float x, float y) {
        arrastrada = v;
        float dx = v.cx - ox, dy = v.cy - oy, dz = v.cz - oz;
        distArrastre = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        agarreX = x; agarreY = y;
        if (v.cine) cine(v, false);
        v.lugar = -1;
    }

    /** Mientras se arrastra: la ventana sigue al rayo a la misma distancia, de frente a vos (cabeza en hx..). */
    public void arrastrar(float ox, float oy, float oz, float dx, float dy, float dz, float hx, float hy, float hz) {
        Ventana v = arrastrada;
        if (v == null) return;
        float d = Math.max(0.4f, Math.min(4f, distArrastre));
        // el punto agarrado va al rayo; el centro queda corrido lo mismo que al agarrar
        float px = ox + dx * d, py = oy + dy * d, pz = oz + dz * d;
        v.cx = px; v.cy = py; v.cz = pz;
        v.mirarA(hx, hy, hz);
        v.cx = px - v.r[0] * agarreX - v.u[0] * agarreY;
        v.cy = py - v.r[1] * agarreX - v.u[1] * agarreY;
        v.cz = pz - v.r[2] * agarreX - v.u[2] * agarreY;
        v.mirarA(hx, hy, hz);
    }

    public void soltarArrastre() { arrastrada = null; }

    public boolean arrastrando() { return arrastrada != null; }

    /** Acercar o alejar la que se arrastra (el joystick del control, o pellizcar con las dos manos). */
    public void cambiarDistancia(float factor) { distArrastre = Math.max(0.4f, Math.min(4f, distArrastre * factor)); }

    // ── el rayo ──

    /** A qué le pega el rayo: la ventana más cercana (o null) y en salida {tipo, u, v, x, y, distancia}. */
    public Ventana impacto(float ox, float oy, float oz, float dx, float dy, float dz, float[] salida) {
        Ventana mejor = null;
        float md = Float.MAX_VALUE;
        float[] s = new float[5];
        for (Ventana v : ventanas) {
            float t = v.impacto(ox, oy, oz, dx, dy, dz, s);
            if (t < 0) continue;
            // el teclado y los ajustes rápidos van adelante de todo (se pegan aunque haya una ventana detrás)
            float prioridad = v.tipo == Ventana.TECLADO || v.tipo == Ventana.RAPIDOS ? -0.5f : 0;
            if (t + prioridad < md) { md = t + prioridad; mejor = v; System.arraycopy(s, 0, salida, 0, 5); salida[5] = t; }
        }
        return mejor;
    }
}
