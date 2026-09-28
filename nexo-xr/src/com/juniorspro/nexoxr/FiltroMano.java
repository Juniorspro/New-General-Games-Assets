package com.juniorspro.nexoxr;

/**
 * El filtro de la mano (el mismo diseño del hand tracking de Aeroplaza, que
 * se ve "súper fijo"): la mano NO se suaviza punto por punto, se trata como
 * lo que es.
 *
 *  1. LA PALMA ES RÍGIDA: la muñeca y los cuatro nudillos (0, 5, 9, 13, 17)
 *     no se deforman. Se filtra su CENTRO y su GIRO (un cuaternión), cada uno
 *     con su One Euro. El centro, además, separado por ejes: lo lateral
 *     (que la imagen mide bien) filtra poco, y la PROFUNDIDAD (a lo largo del
 *     rayo de la cámara, que es lo que tiembla con una sola cámara) filtra
 *     mucho más.
 *  2. LOS DEDOS se filtran aparte, en el marco de la palma: cerrar el índice
 *     (el gatillo) no mueve la palma, y la pistola va pegada a la palma.
 *  3. LA FORMA SE APRENDE: el tamaño de la mano (la suma de 6 distancias de
 *     la palma) se promedia y cada cuadro se reescala a ese tamaño desde la
 *     cámara (reescalar desde la cámara no cambia dónde cae en la foto: sólo
 *     la distancia, que es lo que el modelo estima mal). También se aprenden
 *     la forma de la palma y el largo de cada hueso: los dedos no se estiran.
 *  4. SALTOS: si la profundidad salta más de 8 cm respecto de lo esperado y
 *     de la mediana de los últimos cuadros, ese cuadro se descarta; un salto
 *     de más de 25 cm sólo vale si tres imágenes seguidas lo confirman. Y si los
 *     dedos salen "en espejo" (el modelo confunde adelante y atrás), se elige
 *     la versión que sigue el giro que venía.
 *  5. QUIETA ES QUIETA: si el centro no sale de una zona de 5 mm (10 mm en
 *     profundidad) por un cuarto de segundo, se ancla; se suelta en cuanto
 *     se empuja fuera de la zona.
 *  6. PREDICCIÓN: la imagen llega tarde (la red tarda); se adelanta con la
 *     velocidad filtrada hasta el cuadro que se dibuja (a lo sumo 6.5 cm), con
 *     una GANANCIA APRENDIDA (se compara lo que se predijo con lo que pasó) y
 *     menos si se mueven los dedos y no la mano.
 *  7. EL RESORTE: cuando llega una imagen, la salida no salta: la diferencia
 *     se apaga como un resorte (32 ms). Con fotos a 30 y dibujo a 60, la mano
 *     se mueve pareja (4 veces menos tirones; medido).
 *  8. ENDEREZAR: lo que se dibuja vuelve a tener la palma y los huesos aprendidos.
 *
 * Coordenadas del mundo (metros); la cámara es de donde salen los rayos.
 * Sin Android: se prueba en la PC (pruebas/PruebaFiltroMano.java).
 */
public final class FiltroMano {
    // ── parámetros (los de Aeroplaza) ──
    static final float LADO_CORTE = 2.7586f, LADO_BETA = 33.0921f, LADO_CORTE_D = 2.9938f;
    static final float HONDO_CORTE = 2f, HONDO_BETA = 20f, HONDO_CORTE_D = 1.1853f, HONDO_CRUCE = 0.3034f;
    // el giro: el One Euro de Aeroplaza; la predicción del giro desde 0.5 rad/s (Aeroplaza: desde 1), medido en la prueba
    static final float GIRO_CORTE = 2.885f, GIRO_BETA = 4.62f, GIRO_CORTE_D = 2.893f, GIRO_W0 = 0.5f, GIRO_W1 = 1.5f;
    static final float DEDOS_CORTE = 0.707f, DEDOS_BETA = 2.534f, DEDOS_CORTE_D = 5.656f;
    /** Salto de profundidad que se descarta (m), y salto total a partir del cual se reinicia (m). */
    static final float SALTO_HONDO = 0.08f, SALTO = 0.25f;
    // las anclas (zona lateral / en profundidad; tiempo quieta para anclar; tiempo empujando para soltar; suavizado; velocidad que suelta)
    static final float ZONA_L = 0.0048f, ZONA_H = 0.0106f, TQ_L = 0.2645f, TQ_H = 0.1799f, TE_L = 0.0426f, TE_H = 0.0172f,
            TS_L = 0.038f, TS_H = 0.0491f, VS_L = 0.0568f, DERIVA_H = 0.93f;
    /**
     * El ancla del GIRO (no está en Aeroplaza, que apunta con pellizcos: para
     * un arma, medio grado a 5 m son 4 cm): si el caño no sale de 1.5° por un
     * cuarto de segundo, se fija; se suelta cuando sale de la zona.
     */
    static final float GZONA = (float) Math.toRadians(1.5), GTQ = 0.25f, GTS = 0.06f, GLENTO = 0.4f, GTE = 0.08f, GTE_G = 0.04f;

    static final int[] CENTRO = {0, 5, 9, 13, 17};
    static final int[] PALMA = {0, 1, 5, 9, 13, 17};
    static final boolean[] ES_PALMA = new boolean[21];
    static final int[][] CADENAS = {{1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12}, {13, 14, 15, 16}, {17, 18, 19, 20}};
    static final int[][] HUESOS = new int[15][];
    /** Para las falanges de afuera: el nudillo de su dedo (no se doblan de costado). */
    static final int[] NUDILLO = new int[21];
    static final int[][] TAMANO = {{0, 5}, {0, 17}, {5, 17}, {0, 9}, {9, 13}, {13, 17}};

    static {
        for (int i : PALMA) ES_PALMA[i] = true;
        int k = 0;
        for (int[] c : CADENAS) for (int j = 1; j < 4; j++) HUESOS[k++] = new int[]{c[j - 1], c[j]};
        java.util.Arrays.fill(NUDILLO, -1);
        NUDILLO[7] = 5; NUDILLO[8] = 5; NUDILLO[11] = 9; NUDILLO[12] = 9;
        NUDILLO[15] = 13; NUDILLO[16] = 13; NUDILLO[19] = 17; NUDILLO[20] = 17;
    }

    // ── la salida del filtro (21 puntos en el mundo) y su velocidad ──
    public final float[] x = new float[63], dx = new float[63];
    public boolean visible;
    /** Hora (s) de la última imagen aceptada. */
    public float t = -1;
    /** Cuadros descartados por salto de profundidad (para la prueba). */
    public int descartados, espejos, reinicios;

    // el centro (filtro por ejes)
    private final float[] c = new float[3], cf = new float[3], dcf = new float[3];
    private float tCentro = -1;
    // el giro
    private final float[] q = {0, 0, 0, 1}, qm = {0, 0, 0, 1}, qAnt = {0, 0, 0, 1}, w = new float[3], wg = new float[3];
    private float tGiro = -1, tFiltro = -1;
    // los dedos en el marco de la palma
    private final float[] Lm = new float[63], L = new float[63], dL = new float[63], sL = new float[21], Lc = new float[63];
    private float tDedos = -1;
    // la forma aprendida
    int formaN;
    final float[] largo = new float[15], palma = new float[18];
    // el tamaño aprendido
    int tamN;
    float tamV;
    // de dónde a dónde mira la cámara
    private final float[] rayo = {0, 0, -1};
    private final float[] hist = new float[4];
    private int histN;
    // espejo (temporales)
    private final float[] vE = new float[63], LE = new float[63], qE = new float[4], cE = new float[3], e9 = new float[9], rm = new float[9];

    // ── utilidades ──

    /** El centro de la palma: el promedio de la muñeca y los cuatro nudillos. */
    public static void centro(float[] p, float[] o) {
        o[0] = o[1] = o[2] = 0;
        for (int i : CENTRO) { o[0] += p[i * 3] / 5; o[1] += p[i * 3 + 1] / 5; o[2] += p[i * 3 + 2] / 5; }
    }

    /** Los ejes de la palma (columnas de la rotación): X del meñique al índice, Z la normal, Y = Z × X. */
    static void ejes(float[] n, float[] e) {
        float ax = n[15] - n[51], ay = n[16] - n[52], az = n[17] - n[53];
        float l = (float) Math.sqrt(ax * ax + ay * ay + az * az);
        if (l < 1e-9f) l = 1;
        ax /= l; ay /= l; az /= l;
        float sx = n[27] - n[0], sy = n[28] - n[1], sz = n[29] - n[2];
        float zx = ay * sz - az * sy, zy = az * sx - ax * sz, zz = ax * sy - ay * sx;
        float h = (float) Math.sqrt(zx * zx + zy * zy + zz * zz);
        if (h < 1e-9f) h = 1;
        zx /= h; zy /= h; zz /= h;
        e[0] = ax; e[1] = ay; e[2] = az;
        e[3] = zy * az - zz * ay; e[4] = zz * ax - zx * az; e[5] = zx * ay - zy * ax;
        e[6] = zx; e[7] = zy; e[8] = zz;
    }

    static float alfa(float corte, float dt) { return 1f / (1f + 1f / (2f * (float) Math.PI * corte) / dt); }

    // cuaterniones (x, y, z, w)
    static void deMatriz(float[] e, float[] q) {
        // e: columnas X (0..2), Y (3..5), Z (6..8); m_rc = fila r, columna c
        float m00 = e[0], m10 = e[1], m20 = e[2], m01 = e[3], m11 = e[4], m21 = e[5], m02 = e[6], m12 = e[7], m22 = e[8];
        float tr = m00 + m11 + m22;
        if (tr > 0) {
            float s = 0.5f / (float) Math.sqrt(tr + 1);
            q[3] = 0.25f / s; q[0] = (m21 - m12) * s; q[1] = (m02 - m20) * s; q[2] = (m10 - m01) * s;
        } else if (m00 > m11 && m00 > m22) {
            float s = 2 * (float) Math.sqrt(1 + m00 - m11 - m22);
            q[3] = (m21 - m12) / s; q[0] = 0.25f * s; q[1] = (m01 + m10) / s; q[2] = (m02 + m20) / s;
        } else if (m11 > m22) {
            float s = 2 * (float) Math.sqrt(1 + m11 - m00 - m22);
            q[3] = (m02 - m20) / s; q[0] = (m01 + m10) / s; q[1] = 0.25f * s; q[2] = (m12 + m21) / s;
        } else {
            float s = 2 * (float) Math.sqrt(1 + m22 - m00 - m11);
            q[3] = (m10 - m01) / s; q[0] = (m02 + m20) / s; q[1] = (m12 + m21) / s; q[2] = 0.25f * s;
        }
        normalizar(q);
    }

    /** La rotación del cuaternión, en columnas (como ejes()). */
    static void aMatriz(float[] q, float[] e) {
        float x = q[0], y = q[1], z = q[2], w = q[3];
        e[0] = 1 - 2 * (y * y + z * z); e[1] = 2 * (x * y + z * w); e[2] = 2 * (x * z - y * w);
        e[3] = 2 * (x * y - z * w); e[4] = 1 - 2 * (x * x + z * z); e[5] = 2 * (y * z + x * w);
        e[6] = 2 * (x * z + y * w); e[7] = 2 * (y * z - x * w); e[8] = 1 - 2 * (x * x + y * y);
    }

    /** o = a · b */
    static void mul(float[] a, float[] b, float[] o) {
        float x = a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1];
        float y = a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0];
        float z = a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3];
        float w = a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2];
        o[0] = x; o[1] = y; o[2] = z; o[3] = w;
    }

    static void conj(float[] a, float[] o) { o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; o[3] = a[3]; }

    static void normalizar(float[] q) {
        float l = (float) Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
        if (l < 1e-12f) { q[0] = q[1] = q[2] = 0; q[3] = 1; return; }
        for (int i = 0; i < 4; i++) q[i] /= l;
    }

    /** El vector de giro (eje · ángulo) del cuaternión. */
    static void log(float[] q, float[] v) {
        float x = q[0], y = q[1], z = q[2], w = q[3];
        if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
        float s = (float) Math.sqrt(x * x + y * y + z * z);
        float r = s > 1e-9f ? 2 * (float) Math.atan2(s, w) / s : 2;
        v[0] = x * r; v[1] = y * r; v[2] = z * r;
    }

    /** El cuaternión de un vector de giro. */
    static void exp(float[] v, float[] q) {
        float t = (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (t < 1e-9f) { q[0] = v[0] / 2; q[1] = v[1] / 2; q[2] = v[2] / 2; q[3] = 1; normalizar(q); return; }
        float a = (float) Math.sin(t / 2) / t;
        q[0] = v[0] * a; q[1] = v[1] * a; q[2] = v[2] * a; q[3] = (float) Math.cos(t / 2);
    }

    private final float[] tq1 = new float[4], tq2 = new float[4], tv = new float[3];

    /** Afina el giro para que la palma aprendida calce en la medida (6 pasos de Horn). */
    private void ajustarGiro(float[] p, float[] cc, float[] q) {
        float[] m = rm;
        for (int it = 0; it < 6; it++) {
            aMatriz(q, m);
            float vx = 0, vy = 0, vz = 0, s = 1e-12f;
            for (int k = 0; k < 5; k++) {
                int idx = CENTRO[k], pk = k == 0 ? 0 : k + 1;   // índice en PALMA (0,1,5,9,13,17)
                float lx = palma[pk * 3], ly = palma[pk * 3 + 1], lz = palma[pk * 3 + 2];
                float rx = m[0] * lx + m[3] * ly + m[6] * lz, ry = m[1] * lx + m[4] * ly + m[7] * lz, rz = m[2] * lx + m[5] * ly + m[8] * lz;
                float gx = p[idx * 3] - cc[0], gy = p[idx * 3 + 1] - cc[1], gz = p[idx * 3 + 2] - cc[2];
                vx += ry * gz - rz * gy; vy += rz * gx - rx * gz; vz += rx * gy - ry * gx;
                s += rx * gx + ry * gy + rz * gz;
            }
            s = Math.abs(s);
            tv[0] = vx / s; tv[1] = vy / s; tv[2] = vz / s;
            if (tv[0] * tv[0] + tv[1] * tv[1] + tv[2] * tv[2] < 1e-14f) break;
            exp(tv, tq1);
            mul(tq1, q, q);
            normalizar(q);
        }
    }

    /** El centro, el giro y los 21 puntos en el marco de la palma. */
    private void medir(float[] e, float[] qo, float[] Lo, float[] co) {
        centro(e, co);
        ejes(e, e9);
        deMatriz(e9, qo);
        if (formaN >= 20) {
            ajustarGiro(e, co, qo);
            aMatriz(qo, e9);
        }
        for (int s = 0; s < 21; s++) {
            float r = e[s * 3] - co[0], d = e[s * 3 + 1] - co[1], l = e[s * 3 + 2] - co[2];
            for (int k = 0; k < 3; k++) Lo[s * 3 + k] = r * e9[k * 3] + d * e9[k * 3 + 1] + l * e9[k * 3 + 2];
        }
    }

    private static float angulo(float[] a, float[] b) {
        float d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
        return 2 * (float) Math.acos(Math.min(1f, d));
    }

    /**
     * El modelo a veces da la mano "en espejo" en profundidad (con una sola
     * cámara, lo de adelante y lo de atrás se confunden). Se prueba la versión
     * reflejada (a lo largo del rayo, alrededor del centro: cae en el mismo
     * lugar de la foto) y se queda con la que sigue el giro y la forma de los dedos.
     */
    private void espejo(float[] e, float[] cam, float dt, boolean conGiro) {
        float[] r = rayo;
        float l = (c[0] - cam[0]) * r[0] + (c[1] - cam[1]) * r[1] + (c[2] - cam[2]) * r[2];
        for (int k = 0; k < 63; k += 3) {
            float px = e[k] - cam[0], py = e[k + 1] - cam[1], pz = e[k + 2] - cam[2];
            float T = px * r[0] + py * r[1] + pz * r[2];
            float v = T > 0.001f ? Math.max(0.2f, (2 * l - T) / T) : 1;
            vE[k] = cam[0] + px * v; vE[k + 1] = cam[1] + py * v; vE[k + 2] = cam[2] + pz * v;
        }
        medir(vE, qE, LE, cE);
        // el giro que se esperaba: el anterior, girando a la velocidad que venía
        tv[0] = w[0] * dt; tv[1] = w[1] * dt; tv[2] = w[2] * dt;
        exp(tv, tq1);
        mul(tq1, qAnt, tq2);
        float h = 0, f = 0;
        for (int s = 0; s < 21; s++) {
            if (ES_PALMA[s]) continue;
            for (int k = s * 3; k < s * 3 + 3; k++) {
                float a = Lm[k] - L[k], b = LE[k] - L[k];
                h += a * a; f += b * b;
            }
        }
        float am = conGiro ? angulo(qm, tq2) : 0, ae = conGiro ? angulo(qE, tq2) : 0;
        float costo = am * am + 400 * h / 15, costoE = ae * ae + 400 * f / 15;
        if (costoE < costo * 0.8f) {
            System.arraycopy(qE, 0, qm, 0, 4);
            System.arraycopy(LE, 0, Lm, 0, 63);
            espejos++;
        }
    }

    private void reiniciarPalma(float[] e, float tt, float[] cam) {
        medir(e, qm, Lm, c);
        if (formaN > 0 && tDedos >= 0) espejo(e, cam, 0, false);
        System.arraycopy(c, 0, cf, 0, 3);
        dcf[0] = dcf[1] = dcf[2] = 0;
        tCentro = tt;
        System.arraycopy(qm, 0, q, 0, 4);
        System.arraycopy(qm, 0, qAnt, 0, 4);
        w[0] = w[1] = w[2] = 0;
        System.arraycopy(Lm, 0, L, 0, 63);
        java.util.Arrays.fill(dL, 0);
        tDedos = tt;
        tFiltro = tGiro = tt;
        componer();
        reinicios++;
    }

    /** El centro: lo lateral y la profundidad (a lo largo del rayo) con su propio One Euro. */
    private void filtrarCentro(float tt) {
        float dt = Math.max(0.001f, tt - tCentro);
        tCentro = tt;
        float r0 = rayo[0], r1 = rayo[1], r2 = rayo[2];
        float m = c[0] - cf[0], g = c[1] - cf[1], M = c[2] - cf[2];
        float p = m * r0 + g * r1 + M * r2;
        float b = m - p * r0, E = g - p * r1, T = M - p * r2;
        float v = dcf[0] * r0 + dcf[1] * r1 + dcf[2] * r2;
        float D = dcf[0] - v * r0, U = dcf[1] - v * r1, y = dcf[2] - v * r2;
        float C = alfa(LADO_CORTE_D, dt), k = alfa(HONDO_CORTE_D, dt);
        v += k * (p / dt - v);
        D += C * (b / dt - D); U += C * (E / dt - U); y += C * (T / dt - y);
        float F = (float) Math.sqrt(D * D + U * U + y * y), A = Math.abs(v);
        float I = alfa(LADO_CORTE + LADO_BETA * F, dt), X = alfa(HONDO_CORTE + HONDO_BETA * Math.max(A, F * HONDO_CRUCE), dt);
        cf[0] += I * b + X * p * r0; cf[1] += I * E + X * p * r1; cf[2] += I * T + X * p * r2;
        dcf[0] = D + v * r0; dcf[1] = U + v * r1; dcf[2] = y + v * r2;
    }

    /** Los dedos (en el marco de la palma): One Euro, con la velocidad de todo el dedo. */
    private void filtrarDedos(float tt) {
        float dt = Math.max(0.001f, tt - tDedos);
        tDedos = tt;
        float a = alfa(DEDOS_CORTE_D, dt);
        for (int d = 0; d < 63; d++) dL[d] += a * ((Lm[d] - L[d]) / dt - dL[d]);
        for (int d = 0; d < 21; d++) sL[d] = (float) Math.sqrt(dL[d * 3] * dL[d * 3] + dL[d * 3 + 1] * dL[d * 3 + 1] + dL[d * 3 + 2] * dL[d * 3 + 2]);
        for (int[] ch : CADENAS) {
            float l = 0, cc = 0, u = 0;
            for (int f = 1; f < 4; f++) { int m = ch[f] * 3; l += dL[m]; cc += dL[m + 1]; u += dL[m + 2]; }
            float h = (float) Math.sqrt(l * l + cc * cc + u * u) / 3;
            for (int f = 1; f < 4; f++) sL[ch[f]] = h;
        }
        for (int d = 0; d < 21; d++) {
            float al = alfa(DEDOS_CORTE + DEDOS_BETA * sL[d], dt);
            for (int k = d * 3; k < d * 3 + 3; k++) L[k] += al * (Lm[k] - L[k]);
        }
    }

    /** Los dedos con la palma aprendida y el largo de cada hueso. */
    private void restringir() {
        System.arraycopy(L, 0, Lc, 0, 63);
        if (formaN < 5) return;
        for (int k = 0; k < PALMA.length; k++) {
            int i = PALMA[k];
            Lc[i * 3] = palma[k * 3]; Lc[i * 3 + 1] = palma[k * 3 + 1]; Lc[i * 3 + 2] = palma[k * 3 + 2];
        }
        for (int s = 0; s < HUESOS.length; s++) {
            int i = HUESOS[s][0], o = HUESOS[s][1];
            float r = L[o * 3] - L[i * 3], d = L[o * 3 + 1] - L[i * 3 + 1], l = L[o * 3 + 2] - L[i * 3 + 2];
            int nb = NUDILLO[o];
            if (nb >= 0) {   // las falanges de afuera, en el plano del dedo (sin doblarse de costado)
                float h = L[(nb + 1) * 3] - L[nb * 3], f = L[(nb + 1) * 3 + 1] - L[nb * 3 + 1];
                float mm = (float) Math.sqrt(h * h + f * f);
                if (mm < 1e-9f) mm = 1;
                float g = f / mm, M = -h / mm, pp = r * g + d * M;
                r -= g * pp; d -= M * pp;
            }
            float n = (float) Math.sqrt(r * r + d * d + l * l);
            float u = largo[s] / (n < 1e-9f ? 1 : n);
            Lc[o * 3] = Lc[i * 3] + r * u; Lc[o * 3 + 1] = Lc[i * 3 + 1] + d * u; Lc[o * 3 + 2] = Lc[i * 3 + 2] + l * u;
        }
    }

    /** Arma los 21 puntos del mundo: centro + giro · (dedos en la palma). */
    private void componer() {
        aMatriz(q, rm);
        restringir();
        float wl = (float) Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
        float l = Math.min(1, Math.max(0, (wl - GIRO_W0) / (GIRO_W1 - GIRO_W0)));
        float sm = l * l * (3 - 2 * l);
        wg[0] = w[0] * sm; wg[1] = w[1] * sm; wg[2] = w[2] * sm;
        for (int m = 0; m < 63; m += 3) {
            float g = Lc[m], M = Lc[m + 1], p = Lc[m + 2];
            float b = rm[0] * g + rm[3] * M + rm[6] * p, E = rm[1] * g + rm[4] * M + rm[7] * p, T = rm[2] * g + rm[5] * M + rm[8] * p;
            x[m] = cf[0] + b; x[m + 1] = cf[1] + E; x[m + 2] = cf[2] + T;
            dx[m] = dcf[0] + wg[1] * T - wg[2] * E;
            dx[m + 1] = dcf[1] + wg[2] * b - wg[0] * T;
            dx[m + 2] = dcf[2] + wg[0] * E - wg[1] * b;
        }
    }

    private void filtrarPalma(float[] e, float tt, float[] cam) {
        if (tFiltro < 0 || tt - tFiltro > 0.5f) { reiniciarPalma(e, tt, cam); return; }
        float s = Math.max(0.001f, tt - tFiltro);
        tFiltro = tt;
        medir(e, qm, Lm, c);
        espejo(e, cam, Math.max(0.001f, tt - tGiro), true);
        filtrarCentro(tt);
        // el giro: One Euro sobre el cuaternión (la velocidad angular sale del giro medido)
        if (qm[0] * qAnt[0] + qm[1] * qAnt[1] + qm[2] * qAnt[2] + qm[3] * qAnt[3] < 0) for (int i = 0; i < 4; i++) qm[i] = -qm[i];
        float l = Math.max(0.001f, tt - tGiro);
        conj(qAnt, tq1);
        mul(qm, tq1, tq2);
        log(tq2, tv);
        tv[0] /= l; tv[1] /= l; tv[2] /= l;
        float vl = (float) Math.sqrt(tv[0] * tv[0] + tv[1] * tv[1] + tv[2] * tv[2]);
        if (vl > 20) { tv[0] *= 20 / vl; tv[1] *= 20 / vl; tv[2] *= 20 / vl; }
        float aw = alfa(GIRO_CORTE_D, s);
        for (int i = 0; i < 3; i++) w[i] += (tv[i] - w[i]) * aw;
        conj(q, tq1);
        mul(qm, tq1, tq2);
        log(tq2, tv);
        float wn = (float) Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
        float ag = alfa(GIRO_CORTE + GIRO_BETA * wn, s);
        tv[0] *= ag; tv[1] *= ag; tv[2] *= ag;
        exp(tv, tq1);
        mul(tq1, q, q);
        normalizar(q);
        System.arraycopy(qm, 0, qAnt, 0, 4);
        tGiro = tt;
        filtrarDedos(tt);
        componer();
    }

    /** El tamaño de la mano, aprendido: cada cuadro se reescala a ese tamaño desde la cámara. */
    private void escalar(float[] e, float[] cam) {
        float a = 0;
        for (int[] p : TAMANO) a += dist(e, p[0], p[1]);
        if (!(a > 1e-4f)) return;
        if (tamN < 30 || Math.abs(Math.log(a / tamV)) < 0.5) {
            tamV = tamN < 30 ? (tamV * tamN + a) / (tamN + 1) : tamV + (a - tamV) * 0.02f;
            tamN++;
        }
        if (tamN < 10) return;
        float o = Math.max(0.5f, Math.min(2f, tamV / a));
        for (int s = 0; s < 63; s += 3) {
            e[s] = cam[0] + (e[s] - cam[0]) * o; e[s + 1] = cam[1] + (e[s + 1] - cam[1]) * o; e[s + 2] = cam[2] + (e[s + 2] - cam[2]) * o;
        }
    }

    /** Si un hueso sale más largo o más corto (más de 10 %), su punta se corre por su rayo hasta que mida lo aprendido. */
    private void alRayo(float[] e, float[] cam) {
        if (formaN < 20) return;
        for (int s = 0; s < HUESOS.length; s++) {
            int i = HUESOS[s][0], o = HUESOS[s][1];
            float r = largo[s];
            float d = e[o * 3] - cam[0], l = e[o * 3 + 1] - cam[1], cc = e[o * 3 + 2] - cam[2];
            float u = (float) Math.sqrt(d * d + l * l + cc * cc);
            if (!(u > 1e-4f) || !(r > 0)) continue;
            float h = d / u, f = l / u, m = cc / u;
            float g = e[i * 3] - cam[0], M = e[i * 3 + 1] - cam[1], p = e[i * 3 + 2] - cam[2];
            float bl = dist(e, i, o);
            if (Math.abs(bl / r - 1) < 0.1f) continue;
            float v = h * g + f * M + m * p, D = g * g + M * M + p * p - r * r, U = v * v - D;
            if (U < 0) continue;
            float y = (float) Math.sqrt(U), a1 = v - y, a2 = v + y;
            float C = Math.abs(a1 - u) < Math.abs(a2 - u) ? a1 : a2;
            float k = u + Math.max(-0.5f * r, Math.min(0.5f * r, C - u));
            if (k > 0.02f) { e[o * 3] = cam[0] + h * k; e[o * 3 + 1] = cam[1] + f * k; e[o * 3 + 2] = cam[2] + m * k; }
        }
    }

    /** Aprende la palma y el largo de los huesos (de los dedos ya filtrados, en el marco de la palma). */
    private void aprenderForma() {
        float a = formaN < 60 ? 1f / (formaN + 1) : 0.01f;
        float[] ls = new float[HUESOS.length];
        for (int s = 0; s < HUESOS.length; s++) ls[s] = dist(L, HUESOS[s][0], HUESOS[s][1]);
        if (formaN >= 20) for (int s = 0; s < ls.length; s++) if (ls[s] > largo[s] * 1.35f || ls[s] < largo[s] * 0.7f) return;
        for (int s = 0; s < ls.length; s++) largo[s] += (ls[s] - largo[s]) * a;
        for (int k = 0; k < PALMA.length; k++) for (int r = 0; r < 3; r++) palma[k * 3 + r] += (L[PALMA[k] * 3 + r] - palma[k * 3 + r]) * a;
        formaN++;
    }

    private static float dist(float[] e, int a, int b) {
        float x = e[a * 3] - e[b * 3], y = e[a * 3 + 1] - e[b * 3 + 1], z = e[a * 3 + 2] - e[b * 3 + 2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    private final float[] cm = new float[3], cp = new float[3], cand = new float[3];
    private int nCand;

    /** Dónde tendría que estar el centro a la hora tt (con la velocidad filtrada). */
    public void predecirCentro(float tt, float[] o) {
        float i = Math.min(0.2f, Math.max(0, tt - t));
        o[0] = o[1] = o[2] = 0;
        for (int k : CENTRO) for (int s = 0; s < 3; s++) o[s] += (x[k * 3 + s] + dx[k * 3 + s] * i) / 5;
    }

    /**
     * Una imagen nueva: los 21 puntos en el mundo (se modifican: tamaño y
     * huesos), su hora (s) y dónde estaba la cámara. false si se descartó.
     */
    public boolean recibir(float[] e, float tt, float[] cam) { return recibir(e, tt, tt, cam, false); }

    /**
     * Una imagen nueva, como en Aeroplaza: tt = cuándo se sacó la foto, tLlega
     * = cuándo salió de la red (la diferencia es la demora que hay que
     * adelantar), enBorde = la mano se está yendo por el borde de la foto.
     */
    public boolean recibir(float[] e, float tt, float tLlega, float[] cam, boolean enBorde) {
        faltas = 0;
        escalar(e, cam);
        alRayo(e, cam);
        centro(e, cm);
        predecirCentro(tt, cp);
        float f = (float) Math.sqrt((cm[0] - cp[0]) * (cm[0] - cp[0]) + (cm[1] - cp[1]) * (cm[1] - cp[1]) + (cm[2] - cp[2]) * (cm[2] - cp[2]));
        // ¿saltó la profundidad? (respecto de lo esperado Y de la mediana de los últimos 4)
        if (visible) {
            float mx = cp[0] - cam[0], my = cp[1] - cam[1], mz = cp[2] - cam[2];
            float p = (float) Math.sqrt(mx * mx + my * my + mz * mz);
            if (p < 1e-6f) p = 1;
            float b = ((cm[0] - cam[0]) * mx + (cm[1] - cam[1]) * my + (cm[2] - cam[2]) * mz) / p;
            boolean T = Math.abs(b - p) > SALTO_HONDO;
            boolean D = false;
            if (histN >= 2) {
                float[] o = java.util.Arrays.copyOf(hist, histN);
                java.util.Arrays.sort(o);
                D = Math.abs(b - o[histN >> 1]) > SALTO_HONDO;
            }
            if (histN < 4) hist[histN++] = b;
            else { System.arraycopy(hist, 1, hist, 0, 3); hist[3] = b; }
            if (f < SALTO && T && D) { descartados++; return false; }
        }
        // un salto grande (más de 25 cm) sólo es de verdad si tres imágenes seguidas coinciden en el lugar nuevo
        // (si no, era una imagen mala: la mano "a 11 cm" de la cámara por un cuadro)
        if (visible && f > SALTO && tt - t < 0.3f) {
            float dc = (float) Math.sqrt((cm[0] - cand[0]) * (cm[0] - cand[0]) + (cm[1] - cand[1]) * (cm[1] - cand[1]) + (cm[2] - cand[2]) * (cm[2] - cand[2]));
            if (nCand > 0 && dc < SALTO_HONDO) nCand++;
            else { nCand = 1; System.arraycopy(cm, 0, cand, 0, 3); }
            if (nCand < 3) { descartados++; return false; }
        }
        nCand = 0;
        float rx = cm[0] - cam[0], ry = cm[1] - cam[1], rz = cm[2] - cam[2], rl = (float) Math.sqrt(rx * rx + ry * ry + rz * rz);
        if (rl > 1e-6f) { rayo[0] = rx / rl; rayo[1] = ry / rl; rayo[2] = rz / rl; }
        if (!visible || f > SALTO || tt - t > 0.5f) {
            reiniciarPalma(e, tt, cam);
            // si vuelve cerca de donde se fue (y se veía), el resorte la lleva sin saltar; si no, de cero
            seguida = seguida && alfa > 0.3f && f < SIGUE;
            if (!seguida) alfa = 0;
            histAd.clear();
        } else filtrarPalma(e, tt, cam);
        aprenderForma();
        // la demora (de la foto a que sale de la red) y cada cuánto llegan las fotos
        float c = Math.max(0, Math.min(0.4f, tLlega - tt));
        lat = lat > 0 ? lat + (c - lat) * 0.1f : c;
        hueco = t > 0 ? Math.max(0, tt - t) : 0;
        if (hueco > 0 && hueco < 0.15f) dtFoto = dtFoto > 0 ? dtFoto + (hueco - dtFoto) * 0.1f : hueco;
        t = tt;
        tLlego = tLlega;
        this.enBorde = enBorde;
        nueva = true;
        visible = true;
        medirAdelanto(tt);
        medirDedos();
        return true;
    }

    /** Los 21 puntos medidos en el marco de la palma (con el espejo ya corregido): para el gesto. */
    public void medidaLocal(float[][] o) {
        for (int i = 0; i < 21; i++) { o[i][0] = Lm[i * 3]; o[i][1] = Lm[i * 3 + 1]; o[i][2] = Lm[i * 3 + 2]; }
    }

    public void perder() {
        gQuieta = false; gLentoListo = false;
        visible = false;
        seguida = false;
        alfa = 0;
        histN = 0;
        for (Ancla a : anclas) a.quieta = false;
    }

    // ── la salida para dibujar: con predicción y anclas ──

    private static final class Ancla {
        final boolean hondo;
        final float zona, tq, te, ts, vs;
        boolean quieta;
        final float[] ref = new float[3], A = new float[3], o = new float[3];
        float tQ, empuje;

        Ancla(boolean hondo, float zona, float tq, float te, float ts, float vs) {
            this.hondo = hondo; this.zona = zona; this.tq = tq; this.te = te; this.ts = ts; this.vs = vs;
        }
    }

    private final Ancla[] anclas = {new Ancla(false, ZONA_L, TQ_L, TE_L, TS_L, VS_L), new Ancla(true, ZONA_H, TQ_H, TE_H, TS_H, 0)};
    private float pesoAd = 1;
    private boolean anclasListas;
    /** ¿Anclada (quieta en las dos zonas)? */
    public boolean quieta;

    /** La parte lateral (hondo=false) o en profundidad (hondo=true) de a − b. */
    private void parte(float[] a, float[] b, boolean hondo, float[] o) {
        float dx0 = a[0] - b[0], dy0 = a[1] - b[1], dz0 = a[2] - b[2];
        float T = dx0 * rayo[0] + dy0 * rayo[1] + dz0 * rayo[2];
        if (hondo) { o[0] = T * rayo[0]; o[1] = T * rayo[1]; o[2] = T * rayo[2]; }
        else { o[0] = dx0 - T * rayo[0]; o[1] = dy0 - T * rayo[1]; o[2] = dz0 - T * rayo[2]; }
    }

    private static float largo(float[] v) { return (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

    private final float[] sc = new float[3], ic = new float[3], tmp = new float[3];

    // ── la salida (como Aeroplaza: adelantar → resorte → anclas → enderezar) ──

    // las constantes de Aeroplaza
    static final float CR = 0.05f, TH = 0.08f, LMAX = 0.35f, YV = 0.8012f, GV = 0.35f, CH = 0.24f, HH = 0.08f, XH = 0.065f,
            ZV = 0.0321f, LH = 0.02f, QV0 = 0.05f, QV1 = 0.3f, OV = 0.0333f, T1 = 0.95f, ZVG = 0.2f, I1 = 4e-4f,
            LE0 = 0.25f, LE1 = 0.55f, N0 = 0.3f, N1 = 0.6f, N2 = 1f, N3 = 0.15f, BH = 3, CE = 0.25f, KH = 1, SIGUE = 0.4f;
    static final int[] PUNTAS = {4, 8, 12, 16, 20};

    /** Faltas: imágenes seguidas en las que no se la vio (la pone quien asocia). */
    public int faltas;
    /** 0..1: cuánto se ve (aparece en 80 ms, se va en 200 ms). */
    public float alfa;
    /** Se está yendo por el borde de la foto. */
    public boolean enBorde;
    /** Cuándo llegó la última imagen (s), la demora media (s), y cada cuánto llegan. */
    public float tLlego = -1, lat, dtFoto;
    private float hueco;
    private boolean nueva, seguida, viaja;
    /** ¿Está "viajando" (el resorte la está llevando lejos)? Mientras, no se usa para tocar. */
    public boolean viajando() { return viaja; }
    // la ganancia aprendida del adelanto (lateral y en profundidad)
    private float gNum, gDen, gG = 1, gNumH, gDenH, gGH = 1;
    private final java.util.ArrayDeque<float[]> histAd = new java.util.ArrayDeque<>();
    private float af = -1, vp = -1, pesoDedos = 1;
    private final float[] pO = new float[63], vb = new float[63], off = new float[63], offV = new float[63], pAnt = new float[63],
            vAnt = new float[63], er = new float[63], ee = new float[9], ec = new float[3], hq = new float[4], hv = new float[3];

    static float saturar(float i) { return i < CR ? i : CR + TH * (1 - (float) Math.exp(-(i - CR) / TH)); }

    static float suave(float x, float a, float b) {
        if (x <= a) return 0;
        if (x >= b) return 1;
        float t = (x - a) / (b - a);
        return t * t * (3 - 2 * t);
    }

    /** La velocidad del centro (m/s). */
    public float velCentro() {
        float a = 0, b = 0, c = 0;
        for (int k : CENTRO) { a += dx[k * 3] / 5; b += dx[k * 3 + 1] / 5; c += dx[k * 3 + 2] / 5; }
        return (float) Math.sqrt(a * a + b * b + c * c);
    }

    /**
     * Cuánto adelantar de verdad: guarda por dónde iba el centro y, con la
     * demora medida, compara lo que se predijo con lo que pasó. La ganancia
     * (0.2..1) baja si la velocidad era ruido. Lateral y profundidad aparte.
     */
    private void medirAdelanto(float e) {
        histAd.addLast(new float[]{e, cf[0], cf[1], cf[2], dcf[0], dcf[1], dcf[2]});
        while (!histAd.isEmpty() && e - histAd.peekFirst()[0] > 0.6f) histAd.pollFirst();
        float sL = Math.min(GV, lat > 0 ? lat : 0.12f);
        float[] l = null;
        float d = 1e9f;
        int k = 0, n = histAd.size();
        for (float[] h : histAd) {
            if (k++ >= n - 1) break;
            float dd = Math.abs(e - h[0] - sL);
            if (dd < d) { d = dd; l = h; }
        }
        if (l == null || d > 0.035f) return;
        float c = e - l[0];
        float u = l[4] * c, h = l[5] * c, f = l[6] * c;
        float g = cf[0] - l[1], M = cf[1] - l[2], p = cf[2] - l[3];
        float[] b = rayo;
        float E = u * b[0] + h * b[1] + f * b[2], T = g * b[0] + M * b[1] + p * b[2];
        float v = u - E * b[0], D = h - E * b[1], U = f - E * b[2];
        float y = v * v + D * D + U * U;
        gNum = gNum * T1 + ((g - T * b[0]) * v + (M - T * b[1]) * D + (p - T * b[2]) * U);
        gDen = gDen * T1 + y;
        gG = Math.max(ZVG, Math.min(1, (gNum + I1) / (gDen + I1)));
        gNumH = gNumH * T1 + T * E;
        gDenH = gDenH * T1 + E * E;
        gGH = Math.max(ZVG, Math.min(1, (gNumH + I1) / (gDenH + I1)));
    }

    /** Si se mueven los dedos mucho más que la mano, se adelanta menos (mover un dedo no es mover la mano). */
    private void medirDedos() {
        float i = 0;
        for (int r : PUNTAS) i += (float) Math.sqrt(dL[r * 3] * dL[r * 3] + dL[r * 3 + 1] * dL[r * 3 + 1] + dL[r * 3 + 2] * dL[r * 3 + 2]) / 5;
        float o = (float) Math.sqrt(dcf[0] * dcf[0] + dcf[1] * dcf[1] + dcf[2] * dcf[2]);
        af = af < 0 ? i : af + (i - af) * 0.3f;
        vp = vp < 0 ? o : vp + (o - vp) * 0.3f;
        float sd = vp / (vp + N2 * Math.max(0, af - N3) + 1e-4f);
        pesoDedos = suave(sd, N0, N1);
    }

    /** El adelanto (Aeroplaza: adelantar). Devuelve el horizonte del giro (s). */
    private float adelantar(float ahora) {
        float i = Math.max(0, ahora - tLlego);
        float o = saturar(i);
        float s = pesoAd * pesoDedos;
        float r = Math.min(GV, lat);
        float d = YV + CH * Math.max(0, Math.min(1, (r - HH) / 0.13f));
        float l = gG, c = gGH;
        float h = Math.max(0, Math.min(1, (l - LE0) / (LE1 - LE0))), f = Math.max(0, Math.min(1, (c - LE0) / (LE1 - LE0)));
        float m = (dtFoto > 0 ? dtFoto : 0.034f) * BH;
        boolean g = enBorde && i > m;
        float base = g ? saturar(m) : o;
        float pp = (base * h + Math.min(LMAX, r) * l) * d;
        float b = g ? CE * (1 - (float) Math.exp(-(i - m) / CE)) * d : 0;
        float E = g ? d * (float) Math.exp(-(i - m) / CE) : YV * s * h * (i < CR ? 1 : (float) Math.exp(-(i - CR) / TH));
        float v = (base * f + Math.min(LMAX, r) * c) * d;
        float[] T = rayo;
        float D = 0, U = 0, y = 0;
        for (int k : CENTRO) { D += dx[k * 3] / 5; U += dx[k * 3 + 1] / 5; y += dx[k * 3 + 2] / 5; }
        // tope: el centro no se adelanta más de 6.5 cm
        {
            float C = D * s, k = U * s, F = y * s, A = C * T[0] + k * T[1] + F * T[2];
            float ix = (C - A * T[0]) * pp + A * T[0] * v, iy = (k - A * T[1]) * pp + A * T[1] * v, iz = (F - A * T[2]) * pp + A * T[2] * v;
            float I = (float) Math.sqrt(ix * ix + iy * iy + iz * iz);
            if (I > XH) { pp *= XH / I; v *= XH / I; }
        }
        float k = D * s, F = U * s, A = y * s, I = k * T[0] + F * T[1] + A * T[2];
        float X = (k - I * T[0]) * pp + I * T[0] * v + D * b, Lx = (F - I * T[1]) * pp + I * T[1] * v + U * b,
                V = (A - I * T[2]) * pp + I * T[2] * v + y * b;
        // el giro, adelantado (comprimido: atan)
        float hor = pp * pesoDedos;
        hv[0] = wg[0] * hor; hv[1] = wg[1] * hor; hv[2] = wg[2] * hor;
        float G = (float) Math.sqrt(hv[0] * hv[0] + hv[1] * hv[1] + hv[2] * hv[2]);
        if (G > 1e-6f) { float z = (float) Math.atan(G) * KH / G; hv[0] *= z; hv[1] *= z; hv[2] *= z; }
        exp(hv, hq);
        aMatriz(hq, ee);
        for (int q0 = 0; q0 < 63; q0 += 3) {
            float te = x[q0] - cf[0], Xr = x[q0 + 1] - cf[1], er0 = x[q0 + 2] - cf[2];
            float fe = dx[q0] - D - (wg[1] * er0 - wg[2] * Xr), ue = dx[q0 + 1] - U - (wg[2] * te - wg[0] * er0),
                    de = dx[q0 + 2] - y - (wg[0] * Xr - wg[1] * te);
            float rx = ee[0] * te + ee[3] * Xr + ee[6] * er0, ry = ee[1] * te + ee[4] * Xr + ee[7] * er0, rz = ee[2] * te + ee[5] * Xr + ee[8] * er0;
            pO[q0] = cf[0] + X + rx + fe * pp;
            pO[q0 + 1] = cf[1] + Lx + ry + ue * pp;
            pO[q0 + 2] = cf[2] + V + rz + de * pp;
            vb[q0] = dx[q0] * E; vb[q0 + 1] = dx[q0 + 1] * E; vb[q0 + 2] = dx[q0 + 2] * E;
        }
        return hor;
    }

    /**
     * El resorte (Aeroplaza: suavizar): cuando llega una imagen, la salida no
     * salta a lo nuevo: la diferencia se guarda y se va apagando como un
     * resorte crítico (32 ms quieta, 20 ms moviéndose). A 60 cuadros por
     * segundo con fotos a 30, la mano se mueve pareja.
     */
    private void suavizar(float e) {
        float d = Math.min(e, 1 / 30f);
        if (!seguida) { java.util.Arrays.fill(off, 0); java.util.Arrays.fill(offV, 0); }
        else if (nueva) {
            for (int g = 0; g < 63; g++) {
                off[g] -= pO[g] - (pAnt[g] + vAnt[g] * d);
                offV[g] -= (vb[g] - vAnt[g]);
            }
            centro(off, ec);
            if (largo(ec) > SIGUE + 2 * Math.min(0.3f, hueco)) { java.util.Arrays.fill(off, 0); java.util.Arrays.fill(offV, 0); }
        }
        centro(off, ec);
        float cl = largo(ec);
        viaja = nueva && cl > 0.08f || viaja && cl > 0.015f;
        nueva = false;
        float h = 1f / ((ZV + (LH - ZV) * suave(velCentro(), QV0, QV1)) * Math.min(1, (dtFoto > 0 ? dtFoto : OV) / OV));
        float f = (float) Math.exp(-h * d);
        for (int m = 0; m < 63; m++) {
            float g = off[m], M = offV[m], pp = M + h * g;
            off[m] = (g + pp * d) * f;
            offV[m] = (M - h * pp * d) * f;
            pAnt[m] = pO[m];
            vAnt[m] = vb[m];
            pO[m] += off[m];
        }
        seguida = true;
    }

    /** Endereza la salida (Aeroplaza: enderezar): la palma con su forma aprendida y cada hueso con su largo. */
    private void enderezar(float[] t) {
        if (formaN < 5) return;
        System.arraycopy(t, 0, er, 0, 63);
        ejes(t, ee);
        centro(t, ec);
        for (int r = 0; r < PALMA.length; r++) {
            int sP = PALMA[r];
            for (int d = 0; d < 3; d++)
                t[sP * 3 + d] = ec[d] + palma[r * 3] * ee[d] + palma[r * 3 + 1] * ee[3 + d] + palma[r * 3 + 2] * ee[6 + d];
        }
        for (int k = 0; k < HUESOS.length; k++) {
            int sI = HUESOS[k][0], r = HUESOS[k][1];
            float l = er[r * 3] - er[sI * 3], c = er[r * 3 + 1] - er[sI * 3 + 1], u = er[r * 3 + 2] - er[sI * 3 + 2];
            float h = (float) Math.sqrt(l * l + c * c + u * u);
            float f = largo[k] / (h < 1e-9f ? 1 : h);
            t[r * 3] = t[sI * 3] + l * f; t[r * 3 + 1] = t[sI * 3 + 1] + c * f; t[r * 3 + 2] = t[sI * 3 + 2] + u * f;
        }
    }

    /** ¿Se la sigue viendo? (las reglas de Aeroplaza con la cámara: faltas y tiempo sin imágenes) y el fundido. */
    public void actualizarVista(float ahora, float dt) {
        float T = ahora - tLlego;
        if (visible && (faltas >= 4 || (faltas >= 2 && T > 0.25f) || T > 0.6f)) {
            visible = false;
            histN = 0;
        }
        alfa = visible ? Math.min(1, alfa + dt / 0.08f) : Math.max(0, alfa - dt / 0.2f);
        if (!visible && alfa <= 0) seguida = false;
    }

    /**
     * Los 21 puntos para dibujar a la hora tAhora (s), como Aeroplaza:
     * adelantados lo que tardó la imagen (con la ganancia aprendida), con el
     * resorte entre imágenes, anclados si está quieta (posición y, para
     * apuntar, giro) y enderezados. dt: desde el cuadro anterior.
     */
    public void salida(float tAhora, float dt, float[] p) {
        dt = Math.max(0.001f, dt);
        float hor = adelantar(tAhora);
        suavizar(dt);
        anclarGiro(dt, hor, pO);
        estabilizar(dt, pO);
        enderezar(pO);
        System.arraycopy(pO, 0, p, 0, 63);
    }

    // el ancla del giro
    private final float[] gRef = {0, 0, 0, 1}, gA = {0, 0, 0, 1}, gOff = {0, 0, 0, 1}, gLento = {0, 0, 0, 1}, qo = new float[4],
            ga1 = new float[4], ga2 = new float[4], gv = new float[3], gm = new float[9], gc = new float[3];
    private boolean gQuieta, gLentoListo;
    private float gTQ, gEmp, gEmpG;
    /** ¿El caño está anclado? */
    public boolean giroQuieto;

    private void anclarGiro(float dt, float ad, float[] p) {
        // un giro más lento, para decidir (el temblor no tiene que soltar el ancla)
        if (!gLentoListo) { System.arraycopy(q, 0, gLento, 0, 4); System.arraycopy(q, 0, gRef, 0, 4); gLentoListo = true; gTQ = 0; }
        else {
            if (gLento[0] * q[0] + gLento[1] * q[1] + gLento[2] * q[2] + gLento[3] * q[3] < 0) for (int i = 0; i < 4; i++) gLento[i] = -gLento[i];
            float a = 1 - (float) Math.exp(-dt / GLENTO);
            for (int i = 0; i < 4; i++) gLento[i] += (q[i] - gLento[i]) * a;
            normalizar(gLento);
        }
        // el giro de lo que se dibuja (medido en la salida: con la predicción y el resorte)
        ejes(p, gm);
        deMatriz(gm, qo);
        if (qo[0] * q[0] + qo[1] * q[1] + qo[2] * q[2] + qo[3] * q[3] < 0) for (int i = 0; i < 4; i++) qo[i] = -qo[i];
        if (angulo(gLento, gRef) > GZONA) { System.arraycopy(gLento, 0, gRef, 0, 4); gTQ = 0; }
        else gTQ += dt;
        if (gQuieta) {
            // para soltarse, el desvío tiene que durar (un cuadro ruidoso no suelta el ancla)
            gEmp = angulo(gA, gLento) > GZONA ? gEmp + dt : Math.max(0, gEmp - dt);
            gEmpG = angulo(gA, qo) > 3 * GZONA ? gEmpG + dt : 0;
            if (gEmp > GTE || gEmpG > GTE_G) {
                gQuieta = false;   // se soltó: la corrección se va apagando
                System.arraycopy(gLento, 0, gRef, 0, 4);
                gTQ = 0;
            } else {
                conj(qo, ga1);
                mul(gA, ga1, gOff);   // fijo en el ancla
            }
        }
        if (!gQuieta) {
            log(gOff, gv);
            float d = (float) Math.exp(-dt / GTS);
            gv[0] *= d; gv[1] *= d; gv[2] *= d;
            exp(gv, gOff);
            if (gTQ > GTQ) { gQuieta = true; gEmp = gEmpG = 0; mul(gOff, qo, gA); }
        }
        giroQuieto = gQuieta;
        // girar la salida alrededor de su centro
        aMatriz(gOff, gm);
        centro(p, gc);
        for (int k = 0; k < 63; k += 3) {
            float x0 = p[k] - gc[0], y0 = p[k + 1] - gc[1], z0 = p[k + 2] - gc[2];
            p[k] = gc[0] + gm[0] * x0 + gm[3] * y0 + gm[6] * z0;
            p[k + 1] = gc[1] + gm[1] * x0 + gm[4] * y0 + gm[7] * z0;
            p[k + 2] = gc[2] + gm[2] * x0 + gm[5] * y0 + gm[8] * z0;
        }
    }

    private void estabilizar(float dt, float[] p) {
        centro(p, ic);
        centro(x, sc);
        if (!anclasListas) {
            for (Ancla a : anclas) {
                a.quieta = false;
                System.arraycopy(sc, 0, a.ref, 0, 3);
                System.arraycopy(ic, 0, a.A, 0, 3);
                a.tQ = 0; a.empuje = 0; a.o[0] = a.o[1] = a.o[2] = 0;
            }
            anclasListas = true;
            pesoAd = 1;
        }
        float u = 0, h = 0, f = 0;
        for (int k : CENTRO) { u += dx[k * 3] / 5; h += dx[k * 3 + 1] / 5; f += dx[k * 3 + 2] / 5; }
        float m = u * rayo[0] + h * rayo[1] + f * rayo[2];
        float velL = (float) Math.sqrt((u - m * rayo[0]) * (u - m * rayo[0]) + (h - m * rayo[1]) * (h - m * rayo[1]) + (f - m * rayo[2]) * (f - m * rayo[2]));
        int n = 0;
        for (Ancla E : anclas) {
            parte(sc, E.ref, E.hondo, tmp);
            if (largo(tmp) > E.zona) { System.arraycopy(sc, 0, E.ref, 0, 3); E.tQ = 0; }
            else E.tQ += dt;
            float[] D = E.o;
            if (E.quieta) {
                if (E.hondo) {   // en profundidad, el ancla sigue despacio (la distancia se corrige sola)
                    float a = 1 - (float) Math.exp(-dt / DERIVA_H);
                    parte(sc, E.A, true, tmp);
                    for (int k = 0; k < 3; k++) E.A[k] += tmp[k] * a;
                }
                parte(E.A, ic, E.hondo, tmp);
                float y = largo(tmp);
                if (y > E.zona) {
                    float r = E.zona / y;
                    for (int k = 0; k < 3; k++) { D[k] = tmp[k] * r; E.A[k] += tmp[k] * (r - 1); }
                    E.empuje += dt;
                    if (E.empuje > E.te || (E.vs > 0 && !E.hondo && velL > E.vs)) {
                        E.quieta = false; System.arraycopy(sc, 0, E.ref, 0, 3); E.tQ = 0;
                    }
                } else {
                    System.arraycopy(tmp, 0, D, 0, 3);
                    E.empuje = Math.max(0, E.empuje - dt);
                }
            } else {
                float U = (float) Math.exp(-dt / E.ts);
                D[0] *= U; D[1] *= U; D[2] *= U;
                if (E.tQ > E.tq) {
                    E.quieta = true; E.empuje = 0;
                    for (int k = 0; k < 3; k++) E.A[k] = ic[k] + D[k];
                }
            }
            if (E.quieta) n++;
        }
        float obj = n == 2 ? 0 : 1;
        pesoAd += (obj - pesoAd) * (1 - (float) Math.exp(-dt / (n == 2 ? 0.1f : 0.03f)));
        quieta = n == 2;
        Ancla M = anclas[0], P = anclas[1];
        for (int b = 0; b < 63; b += 3) {
            p[b] += M.o[0] + P.o[0]; p[b + 1] += M.o[1] + P.o[1]; p[b + 2] += M.o[2] + P.o[2];
        }
    }

    // ── de la foto a 3D (como Aeroplaza: cada punto sobre su rayo) ──

    /**
     * Los 21 puntos en la cámara (OpenGL: x derecha, y arriba, −z adelante):
     * cada punto va SOBRE SU RAYO de la foto (lo lateral lo mide bien la
     * imagen) a la profundidad de la forma en metros del modelo, corrida lo
     * que haga falta (mínimos cuadrados lineales). false si no se puede.
     *
     * @param img 21×(x, y) normalizados de la imagen · @param mp 21×(x, y, z) en metros del modelo
     */
    public static boolean aCamara(float[][] img, float[][] mp, int ancho, int alto, float fx, float fy, float cx, float cy, float[] o) {
        double s = 0, r = 0, d = 0, l = 0, cc = 0, u = 0, h = 0;
        float[] E = new float[21], T = new float[21];
        for (int b = 0; b < 21; b++) {
            E[b] = (img[b][0] * ancho - cx) / fx;
            T[b] = (img[b][1] * alto - cy) / fy;
            float v = mp[b][0], D = mp[b][1], U = mp[b][2];
            double y = E[b] * U - v, yy = T[b] * U - D;
            s++; r += E[b]; d += T[b]; l += E[b] * E[b] + T[b] * T[b];
            cc += y; u += yy; h -= E[b] * y + T[b] * yy;
        }
        // [s 0 −r; 0 s −d; −r −d l] · (sx, sy, sz) = (cc, u, h)
        double[] sol = Mano.resolver3(s, 0, -r, s, -d, l, cc, u, h);
        if (sol == null) return false;
        float sz = (float) sol[2];
        for (int b = 0; b < 21; b++) {
            float z = Math.max(0.05f, mp[b][2] + sz);
            o[b * 3] = E[b] * z; o[b * 3 + 1] = -T[b] * z; o[b * 3 + 2] = -z;
        }
        return true;
    }
}
