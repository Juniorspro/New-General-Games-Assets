package com.juniorspro.nexoxr;

/**
 * DE DÓNDE SALE EL RAYO del arma en la mano.
 *
 * La gente apunta alineando el ojo, la mano y el blanco (el modelo "ojo–dedo",
 * el que menos erra en los estudios de apuntar en el aire). En el visor el ojo
 * está 5 cm detrás de la cámara; con el teléfono en la mano, lo que ves es la
 * cámara: el "ojo" es la cámara. Pero cada uno sostiene el arma a su manera
 * (un poco más abajo que la vista, corrida para el lado del ojo que usa): el
 * punto de mira se corre ABAJO y al COSTADO de la cámara, y eso se CALIBRA solo:
 * cada vez que elegís un botón del menú con el arma, se sabe a qué apuntabas
 * (al centro del botón) y se corrige el punto para que el rayo pase por ahí.
 *
 * Que el punto esté cerca de la cámara es lo que hace firme la puntería: lo
 * que la red erra en la distancia de la mano mueve la mano a lo largo del
 * rayo de la cámara, casi el mismo rayo del arma.
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaApuntar.java).
 */
public final class Punteria {
    /** Cuánto más abajo que la cámara y cuánto a la derecha está el punto de mira (m). Se calibran. */
    public float abajo = 0.08f, lado = 0f;
    /** Detrás de la cámara (m): el ojo, en el visor. */
    public float atras = 0.05f;
    static final float ABAJO_MIN = -0.05f, ABAJO_MAX = 0.30f, LADO_MAX = 0.20f;
    public int calibraciones;

    /** El punto de mira, con la cámara en c mirando hacia f (del mundo; Y para arriba). */
    public void origen(float cx, float cy, float cz, float fx, float fy, float fz, float[] o) {
        float l = (float) Math.sqrt(fx * fx + fz * fz);
        if (l < 1e-3f) { fx = 0; fz = -1; l = 1; }
        fx /= l; fz /= l;
        // la derecha (horizontal) = adelante × arriba
        float rx = -fz, rz = fx;
        o[0] = cx - fx * atras + rx * lado;
        o[1] = cy - abajo;
        o[2] = cz - fz * atras + rz * lado;
    }

    /**
     * Se eligió algo con el arma: la mano (p) apuntaba al punto t. Se mueve el
     * punto de mira (sólo abajo y al costado) para que el rayo pase por t.
     * Devuelve false si no se pudo (la mano no está entre la cámara y t).
     */
    public boolean calibrar(float cx, float cy, float cz, float fx, float fy, float fz, float[] p, float[] t) {
        float l = (float) Math.sqrt(fx * fx + fz * fz);
        if (l < 1e-3f) return false;
        fx /= l; fz /= l;
        float rx = -fz, rz = fx;
        // la recta de t por p, hacia atrás, hasta el plano del punto de mira (perpendicular a lo horizontal de adelante)
        float bx = cx - fx * atras, bz = cz - fz * atras;
        float dx = p[0] - t[0], dy = p[1] - t[1], dz = p[2] - t[2];
        float den = dx * fx + dz * fz;
        if (den > -0.05f) return false;   // t no está adelante de la mano
        float s = ((bx - p[0]) * fx + (bz - p[2]) * fz) / den;
        if (s < 0) return false;          // la mano está detrás del plano del ojo
        float ox = p[0] + dx * s, oy = p[1] + dy * s, oz = p[2] + dz * s;
        float a = Math.max(ABAJO_MIN, Math.min(ABAJO_MAX, cy - oy));
        float c = Math.max(-LADO_MAX, Math.min(LADO_MAX, (ox - bx) * rx + (oz - bz) * rz));
        float g = calibraciones == 0 ? 0.7f : 0.4f;
        abajo += (a - abajo) * g;
        lado += (c - lado) * g;
        calibraciones++;
        return true;
    }

    public String guardar() { return String.format(java.util.Locale.ROOT, "%.4f,%.4f,%d", abajo, lado, calibraciones); }

    public void cargar(String s) {
        if (s == null) return;
        String[] p = s.split(",");
        if (p.length != 3) return;
        try {
            float a = Float.parseFloat(p[0]), c = Float.parseFloat(p[1]);
            if (a >= ABAJO_MIN && a <= ABAJO_MAX && Math.abs(c) <= LADO_MAX) { abajo = a; lado = c; calibraciones = Integer.parseInt(p[2]); }
        } catch (NumberFormatException e) { /* se ignora */ }
    }
}
