package com.juniorspro.asaltomr;

import java.util.ArrayList;

/**
 * A qué mano de antes corresponde cada mano que ve la red (como Aeroplaza,
 * recibirCamara): por dónde tendría que estar cada una AHORA (el centro
 * predicho en 3D, no la muñeca en la foto), con una zona que crece con el
 * tiempo sin verla (20 cm recién, hasta 60 cm).
 *
 *  - Dos detecciones a menos de 4 cm son la misma mano: queda la más segura.
 *  - Una mano NUEVA con otra ya a la vista tiene que aparecer en dos imágenes
 *    seguidas en el mismo lugar (si no, era un fantasma de la red); y si cae
 *    sobre el rayo de una mano que ya se sigue (la misma mano a otra
 *    distancia), no cuenta.
 *  - Las nuevas van a su lado (derecha / izquierda, por cómo se doblan los
 *    dedos respecto de la palma) si está libre.
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaFiltroMano.java).
 */
public final class AsociadorManos {
    static final float DUPLICADA = 0.04f, CANDIDATO = 0.25f, MISMO_RAYO = 0.05f;

    private static final class Candidato {
        float x, y, z, t;
        int n;
    }

    private final ArrayList<Candidato> candidatos = new ArrayList<>();

    private static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    /** Qué tan lejos pasa el rayo (desde cam) hacia b del punto a, a la distancia de a (m). */
    private static float lejosDelRayo(float[] a, float[] b, float[] cam) {
        float bx = b[0] - cam[0], by = b[1] - cam[1], bz = b[2] - cam[2], bl = (float) Math.sqrt(bx * bx + by * by + bz * bz);
        if (bl < 1e-6f) return 1e9f;
        bx /= bl; by /= bl; bz /= bl;
        float ax = a[0] - cam[0], ay = a[1] - cam[1], az = a[2] - cam[2];
        float t = ax * bx + ay * by + az * bz;
        float px = ax - t * bx, py = ay - t * by, pz = az - t * bz;
        return (float) Math.sqrt(px * px + py * py + pz * pz);
    }

    /**
     * @param c    los centros de las manos que vio la red (mundo)
     * @param conf qué tan segura está la red de cada una
     * @param lado 1 derecha, 0 izquierda, −1 no se sabe
     * @param f    los filtros de las dos manos (su estado: visibles, predicción)
     * @param t    la hora de la imagen (s)
     * @param cam  dónde está la cámara
     * @return para cada detección, a qué mano va (0, 1) o −1 (todavía no / no se usa)
     */
    public int[] asignar(float[][] c, float[] conf, int[] lado, FiltroMano[] f, float t, float[] cam) {
        int n = c.length;
        int[] slot = new int[n];
        java.util.Arrays.fill(slot, -1);
        boolean[] fuera = new boolean[n];
        // duplicadas
        for (int a = 0; a < n; a++) for (int b = a + 1; b < n; b++)
            if (!fuera[a] && !fuera[b] && dist(c[a], c[b]) < DUPLICADA) fuera[conf[a] >= conf[b] ? b : a] = true;
        // pares mano ↔ detección, por el centro predicho
        ArrayList<float[]> pares = new ArrayList<>();
        float[] S = new float[3], C = new float[3];
        for (int j = 0; j < f.length; j++) {
            FiltroMano m = f[j];
            if (!(m.visible || m.alfa > 0.05f) || m.t < 0) continue;
            m.predecirCentro(t, S);
            m.predecirCentro(m.t, C);
            float k = 0.2f + 0.8f * Math.min(0.5f, Math.max(0, t - m.t));
            boolean reciente = t - m.t < 0.12f;
            for (int a = 0; a < n; a++) {
                if (fuera[a]) continue;
                float I = dist(S, c[a]), x = dist(C, c[a]);
                if (Math.min(I, x) < k) pares.add(new float[]{reciente ? I : Math.min(I, x), j, a});
            }
        }
        pares.sort((p, q) -> Float.compare(p[0], q[0]));
        boolean[] tomada = new boolean[f.length];
        for (float[] p : pares) {
            int j = (int) p[1], a = (int) p[2];
            if (tomada[j] || slot[a] >= 0) continue;
            slot[a] = j;
            tomada[j] = true;
        }
        boolean hayOtra = false;
        for (int j = 0; j < f.length; j++) if (tomada[j] || (f[j].visible && f[j].alfa > 0.3f)) hayOtra = true;
        // las nuevas (de la más segura a la menos)
        Integer[] orden = new Integer[n];
        for (int a = 0; a < n; a++) orden[a] = a;
        java.util.Arrays.sort(orden, (p, q) -> Float.compare(conf[q], conf[p]));
        for (int a : orden) {
            if (fuera[a] || slot[a] >= 0) continue;
            // sobre el rayo de una mano que ya se sigue: es la misma, a otra distancia
            boolean sobreRayo = false;
            for (int b = 0; b < n; b++) if (b != a && slot[b] >= 0 && lejosDelRayo(c[b], c[a], cam) < MISMO_RAYO) sobreRayo = true;
            if (sobreRayo) continue;
            if (hayOtra) {
                // con otra mano a la vista: dos imágenes seguidas en el mismo lugar
                Candidato mejor = null;
                float md = CANDIDATO;
                for (Candidato k : candidatos) {
                    float d = (float) Math.sqrt((k.x - c[a][0]) * (k.x - c[a][0]) + (k.y - c[a][1]) * (k.y - c[a][1]) + (k.z - c[a][2]) * (k.z - c[a][2]));
                    if (d < md && t > k.t) { md = d; mejor = k; }
                }
                if (mejor == null) {
                    mejor = new Candidato();
                    candidatos.add(mejor);
                } else mejor.n++;
                mejor.x = c[a][0]; mejor.y = c[a][1]; mejor.z = c[a][2]; mejor.t = t;
                if (mejor.n < 1) continue;
                candidatos.remove(mejor);
            }
            int quiere = lado[a] == 1 ? 1 : lado[a] == 0 ? 0 : (tomada[0] ? 1 : 0);
            if (tomada[quiere]) quiere = 1 - quiere;
            if (tomada[quiere]) continue;
            slot[a] = quiere;
            tomada[quiere] = true;
        }
        candidatos.removeIf(k -> t - k.t > 0.25f);
        return slot;
    }

    /**
     * De qué lado es la mano, por cómo se doblan los dedos respecto de la
     * palma (Aeroplaza: l1): 1 derecha, 0 izquierda, −1 si no se nota (mano abierta).
     * p: 21 puntos (x, y, z) en ejes de mano derecha (el mundo de ARCore).
     */
    public static int lado(float[] p) {
        float ex = p[15] - p[0], ey = p[16] - p[1], ez = p[17] - p[2], ix = p[51] - p[0], iy = p[52] - p[1], iz = p[53] - p[2];
        float r = ey * iz - ez * iy, d = ez * ix - ex * iz, l = ex * iy - ey * ix;
        float cl = (float) Math.sqrt(r * r + d * d + l * l);
        if (cl < 1e-9f) return -1;
        r /= cl; d /= cl; l /= cl;
        float u = 0;
        for (int h : new int[]{4, 8, 12, 16, 20}) u += (p[h * 3] - p[0]) * r + (p[h * 3 + 1] - p[1]) * d + (p[h * 3 + 2] - p[2]) * l;
        return Math.abs(u) > 0.1f ? (u > 0 ? 1 : 0) : -1;
    }
}
