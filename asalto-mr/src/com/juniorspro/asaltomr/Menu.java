package com.juniorspro.asaltomr;

import java.util.ArrayList;

/**
 * Un menú flotando en el mundo (un panel vertical a 1.35 m, de frente a vos),
 * como en los juegos de realidad mixta: se ve igual en los dos ojos del SBS y
 * se elige
 *   - con el LÁSER de la pistola en la mano: apuntar y apretar el gatillo,
 *   - con la MIRADA: mirar un botón 1.3 s (en el visor, sin tocar nada),
 *   - TOCANDO el botón en la pantalla (sin visor), o tocando / volumen con la mira encima.
 *
 * Si te das vuelta, el panel te sigue (a los 0.8 s de no tenerlo adelante).
 *
 * Sin Android ni OpenGL: la geometría y la elección se prueban en la PC
 * (pruebas/PruebaMenu.java); MenuGl lo dibuja.
 */
public final class Menu {
    // medidas en metros
    public static final float ANCHO = 0.8f, MARGEN = 0.03f, CABECERA = 0.15f, LINEA = 0.055f, ALTO = 0.105f, SEP = 0.022f;
    public static final float DISTANCIA = 1.35f, BAJO_OJOS = 0.12f;
    /** Cuánto hay que mirar un botón para elegirlo (s). */
    public static final float PERMANENCIA = 1.3f;
    /** Cuánto fuera de la vista antes de seguirte (s) y a partir de qué ángulo. */
    public static final float SEGUIR_TRAS = 0.8f, SEGUIR_ANGULO = 0.95f;   // ≈ 55°

    public static final class Opcion {
        public final String id;
        public String texto, detalle;

        Opcion(String id, String texto, String detalle) { this.id = id; this.texto = texto; this.detalle = detalle; }
    }

    public String titulo = "";
    public final ArrayList<String> lineas = new ArrayList<>();
    public final ArrayList<Opcion> opciones = new ArrayList<>();
    /** Cambia cada vez que cambia lo que hay que pintar (texto o botón apuntado). */
    public int version;
    public boolean abierto;
    /** Qué menú es (lo decide quien lo usa). */
    public String cual = "";

    // dónde está: el centro, la derecha (horizontal) y la normal (hacia el jugador, horizontal)
    public float cx, cy, cz, rx = 1, rz = 0, nx = 0, nz = 1;
    public int apuntada = -1;
    /** Cuánto hace que se mira el botón apuntado (s); negativo = recién elegido, en pausa. */
    public float mirando;
    /** Dónde pega el rayo (en el mundo), si pega en el panel. */
    public final float[] punto = new float[3];
    public boolean tocaPanel;
    private float fueraDeVista;

    public void limpiar(String cual, String titulo) {
        this.cual = cual;
        this.titulo = titulo;
        lineas.clear();
        opciones.clear();
        apuntada = -1;
        mirando = 0;
        version++;
    }

    public void linea(String s) { lineas.add(s); version++; }

    public void opcion(String id, String texto, String detalle) { opciones.add(new Opcion(id, texto, detalle)); version++; }

    public void opcion(String id, String texto) { opcion(id, texto, null); }

    /** Cambia el texto de una opción (p. ej. "Arma: Fusil"). */
    public void texto(String id, String texto, String detalle) {
        for (Opcion o : opciones) if (o.id.equals(id)) { o.texto = texto; o.detalle = detalle; version++; }
    }

    /** Lo abre adelante tuyo. */
    public void abrir(float px, float py, float pz, float fx, float fz) {
        abierto = true;
        colocar(px, py, pz, fx, fz);
        version++;
    }

    public void cerrar() { abierto = false; apuntada = -1; tocaPanel = false; }

    public void colocar(float px, float py, float pz, float fx, float fz) {
        float l = (float) Math.sqrt(fx * fx + fz * fz);
        if (l < 1e-4f) { fx = 0; fz = -1; l = 1; }
        fx /= l; fz /= l;
        cx = px + fx * DISTANCIA; cz = pz + fz * DISTANCIA;
        cy = py - BAJO_OJOS;
        nx = -fx; nz = -fz;
        rx = -fz; rz = fx;
        fueraDeVista = 0;
    }

    public float alto() {
        int n = opciones.size();
        return 2 * MARGEN + CABECERA + lineas.size() * LINEA + n * (ALTO + SEP) - (n > 0 ? SEP : 0);
    }

    /** Arriba y abajo (v local, 0 = centro del panel) de la opción i. */
    public float arribaOpcion(int i) { return alto() / 2 - MARGEN - CABECERA - lineas.size() * LINEA - i * (ALTO + SEP); }

    /** El centro de la opción i en el mundo. */
    public void centroOpcion(int i, float[] out) {
        float v = arribaOpcion(i) - ALTO / 2;
        out[0] = cx; out[1] = cy + v; out[2] = cz;
    }

    /**
     * Qué opción toca el rayo (o, d unitario), o −1. Deja en punto[] dónde pega
     * (y tocaPanel) aunque no sea sobre un botón.
     */
    public int opcionEn(float ox, float oy, float oz, float dx, float dy, float dz) {
        tocaPanel = false;
        float den = dx * nx + dz * nz;
        if (den > -1e-4f) return -1;   // de costado o de atrás
        float t = ((cx - ox) * nx + (cz - oz) * nz) / den;
        if (t <= 0 || t > 20) return -1;
        float x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        float u = (x - cx) * rx + (z - cz) * rz, v = y - cy;
        float h = alto();
        if (Math.abs(u) > ANCHO / 2 || Math.abs(v) > h / 2) return -1;
        tocaPanel = true;
        punto[0] = x; punto[1] = y; punto[2] = z;
        if (Math.abs(u) > ANCHO / 2 - MARGEN) return -1;
        for (int i = 0; i < opciones.size(); i++) {
            float a = arribaOpcion(i);
            if (v <= a && v >= a - ALTO) return i;
        }
        return -1;
    }

    /**
     * Cada cuadro, con el rayo que apunta (la mano o la mirada).
     * @param conPermanencia si mirar un rato elige (con la mirada sí; con la mano, el gatillo)
     * @param clic           si se apretó (gatillo, toque, volumen) este cuadro
     * @return la opción elegida, o null
     */
    public String actualizar(float dt, float ox, float oy, float oz, float dx, float dy, float dz, boolean conPermanencia, boolean clic) {
        if (!abierto) return null;
        int a = opcionEn(ox, oy, oz, dx, dy, dz);
        if (a != apuntada) {
            apuntada = a;
            if (mirando > 0) mirando = 0;
            version++;
        }
        if (mirando < 0) mirando = Math.min(0, mirando + dt);
        if (a < 0) return null;
        if (clic) return elegir(a);
        if (conPermanencia && mirando >= 0) {
            mirando += dt;
            if (mirando >= PERMANENCIA) return elegir(a);
        } else if (!conPermanencia && mirando > 0) mirando = 0;
        return null;
    }

    private String elegir(int a) {
        mirando = -0.6f;   // un respiro: que no se elija otra vez enseguida
        version++;
        return opciones.get(a).id;
    }

    /** Si te diste vuelta (o te alejaste), el panel vuelve a ponerse adelante. */
    public void seguir(float dt, float px, float py, float pz, float fx, float fz) {
        if (!abierto) return;
        float vx = cx - px, vz = cz - pz;
        float d = (float) Math.sqrt(vx * vx + vz * vz), fl = (float) Math.sqrt(fx * fx + fz * fz);
        if (d < 1e-3f || fl < 1e-3f) return;
        float cos = (vx * fx + vz * fz) / (d * fl);
        boolean fuera = cos < (float) Math.cos(SEGUIR_ANGULO) || d > 3f || d < 0.5f || Math.abs(py - BAJO_OJOS - cy) > 0.6f;
        fueraDeVista = fuera ? fueraDeVista + dt : 0;
        if (fueraDeVista > SEGUIR_TRAS) { colocar(px, py, pz, fx, fz); version++; }
    }

    /** De (u, v) local al mundo (para dibujar). */
    public void aMundo(float u, float v, float[] out, int o) {
        out[o] = cx + rx * u; out[o + 1] = cy + v; out[o + 2] = cz + rz * u;
    }
}
