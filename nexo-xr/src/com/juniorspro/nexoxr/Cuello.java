package com.juniorspro.nexoxr;

/**
 * DÓNDE ESTÁN LOS OJOS (en el visor), sola, mirando cómo girás la cabeza.
 *
 * Al girar la cabeza sin caminar, la cámara del teléfono da vueltas alrededor
 * de un punto quieto: el cuello. Ese punto se despeja de las últimas poses con
 * cuadrados mínimos: el punto c (fijo en el teléfono) que queda siempre en el
 * mismo lugar del mundo p:
 *
 *     R_i · c + t_i = p      para cada pose i  →  (R_i − R̄) c = −(t_i − t̄)
 *
 * (con un tirón suave hacia lo normal, para lo que un solo giro no deja ver).
 * Los ojos están delante y arriba del cuello (el modelo de cuello de los
 * visores: 8 cm adelante, 7.5 cm arriba). Lo que importa sobre todo es el
 * costado: la cámara está en una punta del teléfono, y los ojos en el medio.
 * Sin Android (se prueba en la PC). Todo en el marco de la pantalla: x a la
 * derecha, y arriba, z atrás (hacia los ojos).
 */
final class Cuello {
    /** Del cuello a los ojos. */
    static final float OJO_Y = 0.075f, OJO_Z = -0.08f;
    /** Lo normal (sin saber nada): los ojos centrados con la cámara, 7 cm atrás. */
    static final float[] OJOS_NORMAL = {0, 0, 0.07f};

    private static final int N = 50;               // 50 poses de 0.08 s = 4 s
    private final float[][] r = new float[N][9];   // rotación (por filas)
    private final float[][] t = new float[N][3];
    private int n, i;
    private long ultima;

    /** Los ojos estimados (x, y, z en el marco de la pantalla) y cuántas veces se midió bien. */
    final float[] ojos = OJOS_NORMAL.clone();
    int medidas;
    /** La última medida: el error (cm) y el giro que hubo (grados); para mostrar. */
    float errorCm, giroGrados;

    /** Una pose de la pantalla (matriz por columnas). Guarda una cada 80 ms. */
    void pose(long tMs, float[] m) {
        if (tMs - ultima < 80) return;
        ultima = tMs;
        float[] a = r[i];
        // por filas: a[f*3+c] = m[c*4+f]
        for (int f = 0; f < 3; f++) for (int c = 0; c < 3; c++) a[f * 3 + c] = m[c * 4 + f];
        t[i][0] = m[12]; t[i][1] = m[13]; t[i][2] = m[14];
        i = (i + 1) % N;
        if (n < N) n++;
    }

    void olvidar() { n = 0; i = 0; }

    /**
     * Intenta medir con las últimas poses. Si el giro alcanza y las poses son
     * de girar en el lugar (el error es chico), acerca {@link #ojos} a lo medido.
     */
    boolean medir() {
        if (n < 25) return false;
        float[] rm = new float[9], tm = new float[3];
        for (int k = 0; k < n; k++) { for (int j = 0; j < 9; j++) rm[j] += r[k][j] / n; for (int j = 0; j < 3; j++) tm[j] += t[k][j] / n; }
        // cuánto giró: el ángulo más grande contra la primera
        float giro = 0;
        int primera = (i - n + N) % N;
        for (int k = 0; k < n; k++) giro = Math.max(giro, angulo(r[primera], r[k]));
        giroGrados = (float) Math.toDegrees(giro);
        if (giroGrados < 20) return false;
        // (Σ MᵀM + λI) c = −Σ Mᵀb + λ c0
        float[] a = new float[9], b = new float[3];
        float[] c0 = {OJOS_NORMAL[0], OJOS_NORMAL[1] - OJO_Y, OJOS_NORMAL[2] - OJO_Z};
        for (int k = 0; k < n; k++) {
            float[] mk = new float[9], bk = new float[3];
            for (int j = 0; j < 9; j++) mk[j] = r[k][j] - rm[j];
            for (int j = 0; j < 3; j++) bk[j] = t[k][j] - tm[j];
            for (int f = 0; f < 3; f++) for (int c = 0; c < 3; c++) {
                float s = 0;
                for (int j = 0; j < 3; j++) s += mk[j * 3 + f] * mk[j * 3 + c];
                a[f * 3 + c] += s;
            }
            for (int f = 0; f < 3; f++) { float s = 0; for (int j = 0; j < 3; j++) s += mk[j * 3 + f] * bk[j]; b[f] -= s; }
        }
        float lambda = 0.02f * n;
        for (int f = 0; f < 3; f++) { a[f * 3 + f] += lambda; b[f] += lambda * c0[f]; }
        float[] c = resolver(a, b);
        if (c == null) return false;
        // el error: cuánto se mueve ese punto (si caminaste o giraste con el cuerpo, mucho)
        float[] p = new float[3];
        for (int k = 0; k < n; k++) { float[] w = aplicar(r[k], c, t[k]); for (int j = 0; j < 3; j++) p[j] += w[j] / n; }
        float e = 0;
        for (int k = 0; k < n; k++) { float[] w = aplicar(r[k], c, t[k]); for (int j = 0; j < 3; j++) e += (w[j] - p[j]) * (w[j] - p[j]); }
        errorCm = (float) Math.sqrt(e / n) * 100;
        if (errorCm > 1.5f) return false;
        float ox = limitar(c[0], -0.09f, 0.09f), oy = limitar(c[1] + OJO_Y, -0.05f, 0.05f), oz = limitar(c[2] + OJO_Z, 0.0f, 0.14f);
        float k = medidas == 0 ? 1 : medidas < 4 ? 0.5f : 0.2f;
        ojos[0] += (ox - ojos[0]) * k;
        ojos[1] += (oy - ojos[1]) * k;
        ojos[2] += (oz - ojos[2]) * k;
        medidas++;
        return true;
    }

    private static float[] aplicar(float[] r, float[] c, float[] t) {
        return new float[]{r[0] * c[0] + r[1] * c[1] + r[2] * c[2] + t[0], r[3] * c[0] + r[4] * c[1] + r[5] * c[2] + t[1], r[6] * c[0] + r[7] * c[1] + r[8] * c[2] + t[2]};
    }

    private static float angulo(float[] a, float[] b) {
        // traza de aᵀb
        float tr = 0;
        for (int f = 0; f < 3; f++) for (int j = 0; j < 3; j++) tr += a[j * 3 + f] * b[j * 3 + f];
        return (float) Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
    }

    private static float limitar(float v, float a, float b) { return Math.max(a, Math.min(b, v)); }

    /** 3×3 por Cramer (null si no tiene solución). */
    private static float[] resolver(float[] a, float[] b) {
        double d = det(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
        if (Math.abs(d) < 1e-12) return null;
        return new float[]{
                (float) (det(b[0], a[1], a[2], b[1], a[4], a[5], b[2], a[7], a[8]) / d),
                (float) (det(a[0], b[0], a[2], a[3], b[1], a[5], a[6], b[2], a[8]) / d),
                (float) (det(a[0], a[1], b[0], a[3], a[4], b[1], a[6], a[7], b[2]) / d)};
    }

    private static double det(double a, double b, double c, double d, double e, double f, double g, double h, double k) {
        return a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
    }
}
