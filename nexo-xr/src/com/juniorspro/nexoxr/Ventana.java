package com.juniorspro.nexoxr;

/**
 * Una pantalla que flota en el espacio: un rectángulo con su centro, hacia
 * dónde mira (yaw, pitch: la normal apunta a quien la usa), su tamaño en
 * metros y el tamaño en píxeles de lo que muestra.
 *
 * Debajo tiene su BARRA (la píldora para agarrarla y moverla) y, al lado de la
 * barra, CERRAR y AMPLIAR (modo cine), como en los visores.
 *
 * Sin Android: la usa el escritorio y se prueba en la PC.
 */
public final class Ventana {
    public static final int APP = 0, DOCK = 1, RAPIDOS = 2, TECLADO = 3, AVISO = 4;
    // a qué le pega un rayo
    public static final int NADA = 0, CONTENIDO = 1, BARRA = 2, CERRAR = 3, AMPLIAR = 4;

    public final int id, tipo;
    public final String app;
    /** El centro (m), hacia dónde mira (rad) y el tamaño (m). */
    public float cx, cy, cz, yaw, pitch, ancho, alto;
    /** El tamaño en píxeles del contenido. */
    public int px, py;
    /** En un lugar del arco (se acomoda sola) o puesta donde la dejaste. */
    public int lugar = -1;
    public boolean visible = true, enfocada, cine;
    /** Para animar: 0 cuando se abre, sube a 1. */
    public float aparece;
    public long abiertaEn;
    /** Lo que había antes del modo cine. */
    float[] antesDeCine;

    // los ejes (se recalculan con ejes())
    public final float[] n = new float[3], r = new float[3], u = new float[3];

    public Ventana(int id, int tipo, String app, float ancho, int px, int py) {
        this.id = id; this.tipo = tipo; this.app = app;
        this.ancho = ancho; this.px = px; this.py = py;
        this.alto = ancho * py / px;
        ejes();
    }

    public boolean tieneBarra() { return tipo == APP; }

    /** Recalcula la normal (hacia el usuario), la derecha y el arriba. */
    public void ejes() {
        float cp = (float) Math.cos(pitch), sp = (float) Math.sin(pitch), cyw = (float) Math.cos(yaw), syw = (float) Math.sin(yaw);
        n[0] = syw * cp; n[1] = sp; n[2] = cyw * cp;
        r[0] = cyw; r[1] = 0; r[2] = -syw;
        // u = n × r
        u[0] = n[1] * r[2] - n[2] * r[1];
        u[1] = n[2] * r[0] - n[0] * r[2];
        u[2] = n[0] * r[1] - n[1] * r[0];
    }

    /** Que mire hacia el punto (x, y, z) (la cabeza): de frente y un poco inclinada si está arriba o abajo. */
    public void mirarA(float x, float y, float z) {
        float dx = x - cx, dy = y - cy, dz = z - cz;
        yaw = (float) Math.atan2(dx, dz);
        pitch = (float) Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
        ejes();
    }

    // ── la barra y sus botones (debajo de la ventana) ──

    static final float BARRA_BAJO = 0.035f, BARRA_ALTO = 0.022f, BOTON_R = 0.019f;

    public float barraAncho() { return Math.min(0.26f, Math.max(0.12f, ancho * 0.28f)); }

    /** El centro de la barra en coordenadas de la ventana (x a la derecha, y arriba, desde el centro). */
    public float barraY() { return -alto / 2 - BARRA_BAJO; }

    public float cerrarX() { return barraAncho() / 2 + 0.045f; }

    public float ampliarX() { return -(barraAncho() / 2 + 0.045f); }

    /** Un punto de la ventana (x, y en metros desde el centro, en su plano) al mundo. */
    public void aMundo(float x, float y, float[] o) {
        o[0] = cx + r[0] * x + u[0] * y;
        o[1] = cy + r[1] * x + u[1] * y;
        o[2] = cz + r[2] * x + u[2] * y;
    }

    /**
     * Dónde le pega el rayo (o, d unitario): devuelve la distancia (o −1) y en
     * salida {tipo de impacto, u, v, x, y}: u, v ∈ 0..1 del contenido (v para
     * abajo); x, y en metros en el plano. Sólo de frente.
     */
    public float impacto(float ox, float oy, float oz, float dx, float dy, float dz, float[] salida) {
        if (!visible) return -1;
        float den = dx * n[0] + dy * n[1] + dz * n[2];
        if (den > -1e-4f) return -1;   // de atrás o de costado
        float t = ((cx - ox) * n[0] + (cy - oy) * n[1] + (cz - oz) * n[2]) / den;
        if (t < 0) return -1;
        float hx = ox + dx * t - cx, hy = oy + dy * t - cy, hz = oz + dz * t - cz;
        float x = hx * r[0] + hy * r[1] + hz * r[2], y = hx * u[0] + hy * u[1] + hz * u[2];
        int que = NADA;
        if (Math.abs(x) <= ancho / 2 && Math.abs(y) <= alto / 2) que = CONTENIDO;
        else if (tieneBarra()) {
            float by = barraY();
            if (Math.abs(y - by) < 0.03f && Math.abs(x) < barraAncho() / 2 + 0.01f) que = BARRA;
            else if (dist2(x, y, cerrarX(), by) < 0.03f * 0.03f) que = CERRAR;
            else if (dist2(x, y, ampliarX(), by) < 0.03f * 0.03f) que = AMPLIAR;
        }
        if (que == NADA) return -1;
        salida[0] = que;
        salida[1] = x / ancho + 0.5f;
        salida[2] = 0.5f - y / alto;
        salida[3] = x;
        salida[4] = y;
        return t;
    }

    /** Distancia firmada de un punto al plano (+ adelante, del lado del usuario) y dónde cae (u, v). */
    public float distancia(float px_, float py_, float pz_, float[] uv) {
        float hx = px_ - cx, hy = py_ - cy, hz = pz_ - cz;
        float x = hx * r[0] + hy * r[1] + hz * r[2], y = hx * u[0] + hy * u[1] + hz * u[2];
        uv[0] = x / ancho + 0.5f;
        uv[1] = 0.5f - y / alto;
        return hx * n[0] + hy * n[1] + hz * n[2];
    }

    private static float dist2(float a, float b, float c, float d) { return (a - c) * (a - c) + (b - d) * (b - d); }
}
