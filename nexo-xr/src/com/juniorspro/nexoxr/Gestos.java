package com.juniorspro.nexoxr;

/**
 * Los gestos de la mano para el sistema (con los 21 puntos en metros).
 *
 *  - PELLIZCO (pulgar con índice): el clic. Medido en "palmas" (la distancia
 *    de la muñeca al nudillo del medio), con histéresis: aprieta por debajo de
 *    0.20 y suelta por arriba de 0.32. Con las fotos reales, un PUÑO pone el
 *    pulgar a 0.27–0.42 del índice: por eso además el índice no tiene que estar
 *    metido en la palma (la punta a más de 1.05 palmas de la muñeca). Cambia
 *    con dos imágenes seguidas del otro lado del umbral (el temblor no rebota).
 *  - EL PUNTO DEL RAYO: entre los nudillos del índice y del medio, que no se
 *    mueven al pellizcar (la punta de los dedos sí: el cursor saltaría).
 *  - TOCAR CON EL DEDO: el índice estirado (más de 1.45 palmas); la punta es la
 *    que toca.
 *
 * Sin Android: se prueba en la PC con manos reales (pruebas/PruebaGestos.java).
 */
public final class Gestos {
    public static final float PELLIZCA = 0.20f, SUELTA = 0.32f, INDICE_FUERA = 1.05f, INDICE_ESTIRADO = 1.45f;
    public boolean pellizcando;
    private int seguidas;
    /** Cuánto falta para pellizcar (1 = suelto, 0 = pellizcando): para dibujar el cursor que se achica. */
    public float fuerza;

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    public static float palma(float[][] w) { return Math.max(1e-4f, dist(w[0], w[9])); }

    /** Pulgar–índice, en palmas. */
    public static float apertura(float[][] w) { return dist(w[4], w[8]) / palma(w); }

    /** La punta del índice a la muñeca, en palmas. */
    public static float indice(float[][] w) { return dist(w[8], w[0]) / palma(w); }

    /** Un cuadro nuevo: ¿está pellizcando? */
    public boolean paso(float[][] w) {
        float a = apertura(w), i = indice(w);
        // (dos imágenes seguidas del otro lado del umbral: el temblor no lo hace rebotar)
        boolean cruza = pellizcando ? a > SUELTA : a < PELLIZCA && i > INDICE_FUERA;
        seguidas = cruza ? seguidas + 1 : 0;
        if (seguidas >= 2) { pellizcando = !pellizcando; seguidas = 0; }
        fuerza = Math.max(0, Math.min(1, (a - PELLIZCA) / (SUELTA * 1.6f - PELLIZCA)));
        return pellizcando;
    }

    public void soltar() { pellizcando = false; fuerza = 1; seguidas = 0; }

    public static void puntoRayo(float[][] w, float[] o) {
        for (int k = 0; k < 3; k++) o[k] = (w[5][k] + w[9][k]) / 2;
    }

    public static boolean indiceEstirado(float[][] w) { return indice(w) > INDICE_ESTIRADO; }
}
