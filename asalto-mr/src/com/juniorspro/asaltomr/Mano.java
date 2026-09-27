package com.juniorspro.asaltomr;

/**
 * La mano con la pistola: de los 21 puntos que da MediaPipe (en la imagen y en
 * metros) a una pistola en el mundo, y el gesto de disparo.
 *
 * LA POSE (sin depender de cómo esté girada la mano): cuánto está doblado
 * cada dedo = la suma de los ángulos en sus tres articulaciones, con los
 * puntos en metros ("mundo" de MediaPipe).
 *
 *   EMPUÑA     medio, anular y meñique cerrados, índice estirado (listo)
 *   APRIETA    medio, anular y meñique cerrados, índice cerrado (gatillo)
 *   ABIERTA    los cuatro estirados (recargar)
 *   VE         índice y medio estirados, anular y meñique cerrados (cambiar de arma)
 *   OTRA       lo demás
 *
 * EL DISPARO: empuñando, cerrar el índice (apretar el gatillo) dispara. Se
 * mide con qué tan lejos queda la punta del índice de la muñeca (en palmas:
 * estirado ≈ 1.8, cerrado ≈ 0.9 en fotos reales): es mucho más estable que
 * sumar ángulos de falanges de 2 cm. Suavizado en el tiempo, con histéresis
 * (se aprieta por debajo de 1.25, se suelta por encima de 1.55) y un tiempo
 * mínimo entre tiros: el temblor no dispara solo. También vale la
 * "pistolita": índice estirado y bajar el pulgar.
 *
 * LA PISTOLA: el caño apunta hacia donde van los nudillos (de la muñeca a
 * los nudillos, sacándole la dirección de la línea de nudillos, que es la
 * del mango). Así no se mueve cuando el índice aprieta el gatillo.
 *
 * EN 3D: la imagen dice dónde está cada punto en la foto; los metros de
 * MediaPipe dicen el tamaño de la mano; de ahí sale a qué distancia está
 * (una mano de 9 cm que se ve de 90 píxeles está a f·0.09/90). Si ARCore
 * tiene profundidad en ese píxel y coincide, se usa esa.
 *
 * Sin Android: se prueba en la PC con fotos reales de manos pasadas por el
 * mismo modelo (pruebas/PruebaMano.java).
 */
public final class Mano {
    public static final int NADA = 0, EMPUNA = 1, APRIETA = 2, ABIERTA = 3, OTRA = 4, VE = 5;
    public static final String[] NOMBRES = {"—", "empuña", "aprieta", "abierta", "otra", "V"};

    // umbrales (grados de flexión sumados en las 3 articulaciones de un dedo)
    // (medido con fotos reales: índice estirado empuñando 43–47°, apretando 209–219°, dedos del puño 220–260°)
    static final float ESTIRADO = 75f, CERRADO = 150f, ABIERTO = 100f;
    // la pose "aprieta" (para mostrar): índice cerrado
    static final float GATILLO_ON = 150f;
    // el gatillo: punta del índice a la muñeca, en palmas (estirado 1.82, puño 0.90–0.93)
    static final float APRIETA_BAJO = 1.25f, SUELTA_ALTO = 1.55f;
    // la pistolita: pulgar arriba / abajo (distancia punta del pulgar – nudillo del índice, sobre el tamaño de la palma)
    // (pulgar arriba ≈ 0.65, pulgar metido 0.41–0.46)
    static final float PULGAR_ARRIBA = 0.6f, PULGAR_ABAJO = 0.42f;
    static final long ENTRE_TIROS_MS = 130;

    // ── lo que se sabe de la mano (se actualiza en cada imagen) ──
    public int pose = NADA;
    public float curlIndice, curlMedio, curlAnular, curlMenique, pulgar, alcance;
    private float alcanceSuave = Float.NaN, pulgarSuave = Float.NaN, referencia = 1.6f;

    /** ¿El gatillo está apretado ahora? (el fusil tira mientras esté apretado) */
    public boolean apretado() { return apretado; }
    public boolean hay;
    /** Los 21 puntos en el mundo (metros). */
    public final float[][] mundo = new float[21][3];
    /** La pistola: el centro del mango (m), adelante y arriba (unitarios), suavizados. */
    public final float[] pos = new float[3], adelante = new float[3], arriba = new float[3];
    public long ultimaVez;
    /** Dónde estaba la muñeca en la imagen (para seguir a la misma mano entre imágenes). */
    public float u = -1, v = -1;
    private boolean apretado, pulgarBajo, tieneSuave;
    private long ultimoTiro = Long.MIN_VALUE / 2;
    private int cuadrosEmpunando, cuadrosListo;

    /** Cuánto está doblado un dedo (grados): ángulos entre huesos seguidos, desde la muñeca. */
    static float curl(float[][] w, int mcp) {
        int[] p = {0, mcp, mcp + 1, mcp + 2, mcp + 3};
        float s = 0;
        for (int i = 0; i < 3; i++) s += angulo(w[p[i]], w[p[i + 1]], w[p[i + 1]], w[p[i + 2]]);
        return s;
    }

    /** Ángulo (grados) entre el vector a→b y el vector c→d. */
    static float angulo(float[] a, float[] b, float[] c, float[] d) {
        float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
        float lu = (float) Math.sqrt(ux * ux + uy * uy + uz * uz), lv = (float) Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (lu < 1e-6f || lv < 1e-6f) return 0;
        float c0 = (ux * vx + uy * vy + uz * vz) / (lu * lv);
        return (float) Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, c0))));
    }

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    /** Clasifica la pose con los puntos en metros (cualquier sistema de ejes). */
    /** Qué tan cerrado está un dedo (0 = estirado, 1 = puño) por la distancia de su punta a la muñeca, en palmas. */
    static float cierre(float alcance) { return Math.max(0f, Math.min(1f, (1.75f - alcance) / 0.8f)); }

    public float cierreMedio, cierreAnular, cierreMenique, cierreIndice;

    /**
     * Clasifica la pose con los puntos en metros (cualquier sistema de ejes: sólo usa distancias).
     *
     * Por distancias punta–muñeca y no por ángulos: con fotos reales, un índice
     * que apunta a la cámara (escorzo) da ángulos de "puño" (230°) aunque esté
     * estirado, y la distancia lo dice bien (1.55 palmas). Y un mango de
     * verdad (grueso) no deja cerrar del todo los dedos (≈ 1.3 palmas contra
     * 0.85 de un puño): se cuenta como empuñar igual.
     */
    public int clasificar(float[][] w) {
        curlIndice = curl(w, 5);
        curlMedio = curl(w, 9);
        curlAnular = curl(w, 13);
        curlMenique = curl(w, 17);
        float palma = Math.max(1e-4f, dist(w[0], w[9]));
        pulgar = dist(w[4], w[5]) / palma;
        alcance = dist(w[8], w[0]) / palma;
        cierreIndice = cierre(alcance);
        cierreMedio = cierre(dist(w[12], w[0]) / palma);
        cierreAnular = cierre(dist(w[16], w[0]) / palma);
        cierreMenique = cierre(dist(w[20], w[0]) / palma);
        float otros = (cierreMedio + cierreAnular + cierreMenique) / 3f;
        if (cierreIndice < 0.4f && otros < 0.35f && cierreMedio < 0.3f) return ABIERTA;
        // empuñando: medio, anular y meñique cerrados en promedio, y el medio no estirado (la V no cuenta)
        if (otros > 0.45f && cierreMedio > 0.35f) return alcance < APRIETA_BAJO ? APRIETA : EMPUNA;
        // la V: índice y medio estirados, anular y meñique cerrados
        if (cierreIndice < 0.35f && cierreMedio < 0.35f && (cierreAnular + cierreMenique) / 2f > 0.5f) return VE;
        return OTRA;
    }

    /**
     * Una imagen nueva. Devuelve true si en esta imagen se disparó.
     * @param w los puntos en metros de MediaPipe (para la pose)
     */
    public boolean gesto(float[][] w, long ms) {
        pose = clasificar(w);
        hay = true;
        ultimaVez = ms;
        boolean empuna = pose == EMPUNA || pose == APRIETA;
        cuadrosEmpunando = empuna ? cuadrosEmpunando + 1 : 0;
        boolean tiro = false;
        // suavizado (lo que tiembla una imagen no cuenta)
        alcanceSuave = alcanceSuave != alcanceSuave ? alcance : alcanceSuave + (alcance - alcanceSuave) * 0.5f;
        pulgarSuave = pulgarSuave != pulgarSuave ? pulgar : pulgarSuave + (pulgar - pulgarSuave) * 0.5f;
        // armado: empuñando con el índice estirado al menos 2 imágenes (agarrar de golpe no dispara)
        cuadrosListo = empuna && !apretado && alcanceSuave > Math.max(SUELTA_ALTO - 0.1f, 0.85f * referencia) ? cuadrosListo + 1 : (empuna ? cuadrosListo : 0);
        boolean armado = cuadrosListo >= 2;
        // el gatillo (índice), con histéresis y adaptado a cada mano: se aprende cuánto estira el índice
        // (visto de costado, un puño cerrado da 1.36 palmas y estirado ≈ 1.8: el umbral fijo 1.25 no alcanza)
        if (alcanceSuave > referencia) referencia = Math.min(2.1f, alcanceSuave);
        else referencia = Math.max(1.5f, referencia - (referencia - 1.6f) * 0.01f);
        float umbralAprieta = Math.max(APRIETA_BAJO, 0.76f * referencia), umbralSuelta = Math.max(SUELTA_ALTO, 0.88f * referencia);
        if (!apretado && alcanceSuave < umbralAprieta) {
            apretado = true;
            if (armado && empuna) tiro = true;
        } else if (apretado && alcanceSuave > umbralSuelta) apretado = false;
        // la pistolita (pulgar), sólo con el índice estirado
        if (!pulgarBajo && pulgarSuave < PULGAR_ABAJO) {
            pulgarBajo = true;
            if (empuna && !apretado && armado) tiro = true;
        } else if (pulgarBajo && pulgarSuave > PULGAR_ARRIBA) pulgarBajo = false;
        if (tiro && ms - ultimoTiro < ENTRE_TIROS_MS) tiro = false;
        if (tiro) ultimoTiro = ms;
        return tiro;
    }

    public void perdida() {
        hay = false;
        alcanceSuave = Float.NaN;
        pulgarSuave = Float.NaN;
        apretado = false;
        pose = NADA;
        cuadrosEmpunando = 0;
        cuadrosListo = 0;
        tieneSuave = false;
    }

    /**
     * De la imagen al mundo. Deja los 21 puntos en mundo[][] (metros).
     *
     * @param img  los 21 puntos normalizados de la imagen (x, y ∈ 0..1; z relativo)
     * @param w    los 21 puntos en metros (MediaPipe: x derecha, y abajo, z hacia adentro)
     * @param ancho,alto tamaño en píxeles de la imagen de la que salieron
     * @param fx,fy,cx,cy intrínsecos de esa imagen (píxeles)
     * @param profundidad la distancia (m, a lo largo del eje de la cámara) medida por ARCore en el nudillo del medio, o NaN
     * @param pose cámara → mundo (4×4 por columnas; cámara OpenGL alineada con la imagen)
     * @return la distancia usada (m)
     */
    public float aMundo(float[][] img, float[][] w, int ancho, int alto, float fx, float fy, float cx, float cy,
                        float profundidad, float[] pose) {
        // 1) la distancia por el tamaño: pares de puntos de la palma (rígidos)
        int[][] pares = {{0, 5}, {0, 9}, {0, 17}, {5, 17}, {5, 9}, {9, 13}, {13, 17}, {0, 13}};
        float[] zs = new float[pares.length];
        int n = 0;
        for (int[] p : pares) {
            float du = (img[p[0]][0] - img[p[1]][0]) * ancho, dv = (img[p[0]][1] - img[p[1]][1]) * alto;
            float pix = (float) Math.sqrt(du * du + dv * dv);
            // el largo "de frente" (sin la componente de profundidad) del mismo par en metros
            float mx = w[p[0]][0] - w[p[1]][0], my = w[p[0]][1] - w[p[1]][1];
            float met = (float) Math.sqrt(mx * mx + my * my);
            if (pix < 3f || met < 0.01f) continue;
            float fm = 0.5f * (fx + fy);
            zs[n++] = fm * met / pix;
        }
        java.util.Arrays.sort(zs, 0, n);
        float z = n == 0 ? 0.45f : zs[n / 2];
        // 2) afinar: la mano (con la forma en metros que dio el modelo) corrida T, que proyectada caiga
        //    justo sobre los 21 puntos de la foto (Gauss-Newton en T; la rotación ya la dio el modelo)
        float[][] m = new float[21][3];
        for (int i = 0; i < 21; i++) { m[i][0] = w[i][0] - w[9][0]; m[i][1] = -(w[i][1] - w[9][1]); m[i][2] = -(w[i][2] - w[9][2]); }
        float u9 = img[9][0] * ancho, v9 = img[9][1] * alto;
        float tx = (u9 - cx) / fx * z, ty = -(v9 - cy) / fy * z, tz = -z;
        for (int it = 0; it < 8; it++) {
            double h00 = 0, h01 = 0, h02 = 0, h11 = 0, h12 = 0, h22 = 0, g0 = 0, g1 = 0, g2 = 0;
            for (int i = 0; i < 21; i++) {
                float X = m[i][0] + tx, Y = m[i][1] + ty, Z = m[i][2] + tz;
                if (Z > -0.03f) continue;
                float iz = -1f / Z;                         // 1 / profundidad
                float pu = cx + fx * X * iz, pv = cy - fy * Y * iz;
                float ru = pu - img[i][0] * ancho, rv = pv - img[i][1] * alto;
                // derivadas de (pu, pv) respecto de (tx, ty, tz)
                float du0 = fx * iz, du2 = fx * X * iz * iz;   // ∂pu/∂tx, ∂pu/∂tz
                float dv1 = -fy * iz, dv2 = -fy * Y * iz * iz;  // ∂pv/∂ty, ∂pv/∂tz
                h00 += du0 * du0; h02 += du0 * du2; h11 += dv1 * dv1; h12 += dv1 * dv2; h22 += du2 * du2 + dv2 * dv2;
                g0 += du0 * ru; g1 += dv1 * rv; g2 += du2 * ru + dv2 * rv;
            }
            double[] d = resolver3(h00, h01, h02, h11, h12, h22, g0, g1, g2);
            if (d == null) break;
            double d0 = d[0], d1 = d[1], d2 = d[2];
            tx -= (float) d0; ty -= (float) d1; tz -= (float) d2;
            if (tz > -0.08f) tz = -0.08f;
            if (Math.abs(d0) + Math.abs(d1) + Math.abs(d2) < 1e-5) break;
        }
        z = -tz;
        // 3) si ARCore midió y está cerca, la distancia sale mayormente de esa
        if (profundidad == profundidad && profundidad > 0.12f && Math.abs(profundidad - z) < 0.35f * z) {
            float k = (0.3f * z + 0.7f * profundidad) / z;   // la profundidad medida pesa más que el tamaño que estima el modelo
            tx *= k; ty *= k; tz *= k;
            z = -tz;
        }
        for (int i = 0; i < 21; i++) {
            float xc = m[i][0] + tx, yc = m[i][1] + ty, zc = m[i][2] + tz;
            mundo[i][0] = pose[0] * xc + pose[4] * yc + pose[8] * zc + pose[12];
            mundo[i][1] = pose[1] * xc + pose[5] * yc + pose[9] * zc + pose[13];
            mundo[i][2] = pose[2] * xc + pose[6] * yc + pose[10] * zc + pose[14];
        }
        return z;
    }

    /**
     * Filtro "One Euro" (Casiez 2012): suaviza mucho cuando la mano está
     * quieta (sin temblor) y poco cuando se mueve rápido (sin retraso).
     */
    static final class UnEuro {
        final float minCorte, beta, dCorte = 1f;
        float x = Float.NaN, dx;

        UnEuro(float minCorte, float beta) { this.minCorte = minCorte; this.beta = beta; }

        static float alfa(float corte, float dt) { float tau = 1f / (2f * (float) Math.PI * corte); return 1f / (1f + tau / dt); }

        float filtrar(float v, float dt) {
            if (x != x || dt <= 0) { x = v; dx = 0; return v; }
            float d = (v - x) / dt;
            dx += (d - dx) * alfa(dCorte, dt);
            float corte = minCorte + beta * Math.abs(dx);
            x += (v - x) * alfa(corte, dt);
            return x;
        }

        void olvidar() { x = Float.NaN; }
    }

    private final UnEuro[] filtros = new UnEuro[9];
    private long ultimoFiltro = -1;

    {
        for (int i = 0; i < 3; i++) filtros[i] = new UnEuro(1.2f, 4f);        // posición (m)
        for (int i = 3; i < 9; i++) filtros[i] = new UnEuro(1.5f, 0.8f);      // direcciones (unitarias)
    }

    /** La pistola con el filtro One Euro (ms = hora de la imagen). */
    public void pistolaFiltrada(long ms) {
        float[] p = new float[3], f = new float[3], u = new float[3];
        if (!medirPistola(p, f, u)) return;
        float dt = ultimoFiltro < 0 ? 0 : Math.max(0.001f, (ms - ultimoFiltro) / 1000f);
        if (!tieneSuave || dt > 0.5f) { for (UnEuro e : filtros) e.olvidar(); dt = 0; }
        ultimoFiltro = ms;
        for (int i = 0; i < 3; i++) {
            pos[i] = filtros[i].filtrar(p[i], dt);
            adelante[i] = filtros[3 + i].filtrar(f[i], dt);
            arriba[i] = filtros[6 + i].filtrar(u[i], dt);
        }
        ortonormalizar();
        tieneSuave = true;
    }

    /** La pistola sin filtrar desde los puntos en el mundo: centro del mango, adelante, arriba. */
    public boolean medirPistola(float[] p, float[] f, float[] u) {
        float[] m0 = mundo[0], i5 = mundo[5], m9 = mundo[9], a13 = mundo[13], p17 = mundo[17];
        float ux = (i5[0] + m9[0]) / 2 - m0[0], uy = (i5[1] + m9[1]) / 2 - m0[1], uz = (i5[2] + m9[2]) / 2 - m0[2];
        float kx = i5[0] - p17[0], ky = i5[1] - p17[1], kz = i5[2] - p17[2];
        float kl = (float) Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (kl < 1e-5f) return false;
        kx /= kl; ky /= kl; kz /= kl;
        float d = ux * kx + uy * ky + uz * kz;
        float fx = ux - d * kx, fy = uy - d * ky, fz = uz - d * kz;
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (fl < 1e-5f) return false;
        f[0] = fx / fl; f[1] = fy / fl; f[2] = fz / fl;
        u[0] = kx; u[1] = ky; u[2] = kz;
        p[0] = (m0[0] + i5[0] + m9[0] + a13[0] + p17[0]) / 5;
        p[1] = (m0[1] + i5[1] + m9[1] + a13[1] + p17[1]) / 5;
        p[2] = (m0[2] + i5[2] + m9[2] + a13[2] + p17[2]) / 5;
        return true;
    }

    private void ortonormalizar() {
        normalizar(adelante);
        float q = arriba[0] * adelante[0] + arriba[1] * adelante[1] + arriba[2] * adelante[2];
        arriba[0] -= q * adelante[0]; arriba[1] -= q * adelante[1]; arriba[2] -= q * adelante[2];
        normalizar(arriba);
    }

    /**
     * La pistola desde los puntos en el mundo, suavizada. suave ∈ (0, 1]:
     * cuánto de lo nuevo se toma (1 = sin suavizar).
     */
    public void pistola(float suave) {
        float[] m0 = mundo[0], i5 = mundo[5], m9 = mundo[9], a13 = mundo[13], p17 = mundo[17];
        // a lo largo de la mano: de la muñeca a los nudillos (índice y medio)
        float ux = (i5[0] + m9[0]) / 2 - m0[0], uy = (i5[1] + m9[1]) / 2 - m0[1], uz = (i5[2] + m9[2]) / 2 - m0[2];
        // la línea de nudillos (del meñique al índice): el mango de la pistola, hacia arriba
        float kx = i5[0] - p17[0], ky = i5[1] - p17[1], kz = i5[2] - p17[2];
        float kl = (float) Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (kl < 1e-5f) return;
        kx /= kl; ky /= kl; kz /= kl;
        float d = ux * kx + uy * ky + uz * kz;
        float fx = ux - d * kx, fy = uy - d * ky, fz = uz - d * kz;
        float fl = (float) Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (fl < 1e-5f) return;
        fx /= fl; fy /= fl; fz /= fl;
        // el centro de la palma: ahí va el centro del mango (la mano lo envuelve)
        float px = (m0[0] + i5[0] + m9[0] + a13[0] + p17[0]) / 5, py = (m0[1] + i5[1] + m9[1] + a13[1] + p17[1]) / 5, pz = (m0[2] + i5[2] + m9[2] + a13[2] + p17[2]) / 5;
        float s = tieneSuave ? suave : 1f;
        pos[0] += (px - pos[0]) * s; pos[1] += (py - pos[1]) * s; pos[2] += (pz - pos[2]) * s;
        adelante[0] += (fx - adelante[0]) * s; adelante[1] += (fy - adelante[1]) * s; adelante[2] += (fz - adelante[2]) * s;
        arriba[0] += (kx - arriba[0]) * s; arriba[1] += (ky - arriba[1]) * s; arriba[2] += (kz - arriba[2]) * s;
        normalizar(adelante);
        // arriba perpendicular a adelante
        float q = arriba[0] * adelante[0] + arriba[1] * adelante[1] + arriba[2] * adelante[2];
        arriba[0] -= q * adelante[0]; arriba[1] -= q * adelante[1]; arriba[2] -= q * adelante[2];
        normalizar(arriba);
        tieneSuave = true;
    }

    /** Resuelve el sistema simétrico 3×3 [a b c; b d e; c e f]·x = g (Cramer). null si es singular. */
    static double[] resolver3(double a, double b, double c, double d, double e, double f, double g0, double g1, double g2) {
        double det = a * (d * f - e * e) - b * (b * f - e * c) + c * (b * e - d * c);
        if (Math.abs(det) < 1e-12) return null;
        double x0 = (g0 * (d * f - e * e) - b * (g1 * f - e * g2) + c * (g1 * e - d * g2)) / det;
        double x1 = (a * (g1 * f - e * g2) - g0 * (b * f - e * c) + c * (b * g2 - g1 * c)) / det;
        double x2 = (a * (d * g2 - g1 * e) - b * (b * g2 - g1 * c) + g0 * (b * e - d * c)) / det;
        return new double[]{x0, x1, x2};
    }

    /**
     * YUV_420_888 (lo que da la cámara) → ARGB a ancho×alto (se toma un píxel
     * de cada tanto). girada: la imagen se da vuelta 180° (pantalla al revés).
     */
    public static void yuvARgb(byte[] y, int yFila, int yPaso, byte[] u, byte[] v, int uvFila, int uvPaso,
                               int iw, int ih, int ancho, int alto, boolean girada, int[] salida) {
        float ex = iw / (float) ancho, ey = ih / (float) alto;
        for (int j = 0; j < alto; j++) {
            int sy = Math.min(ih - 1, (int) (j * ey));
            for (int i = 0; i < ancho; i++) {
                int sx = Math.min(iw - 1, (int) (i * ex));
                int Y = y[sy * yFila + sx * yPaso] & 0xFF;
                int ci = (sy / 2) * uvFila + (sx / 2) * uvPaso;
                int U = (u[ci] & 0xFF) - 128, V = (v[ci] & 0xFF) - 128;
                int r = Y + ((91881 * V) >> 16), g = Y - ((22554 * U + 46802 * V) >> 16), b = Y + ((116130 * U) >> 16);
                r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
                int dst = girada ? (alto - 1 - j) * ancho + (ancho - 1 - i) : j * ancho + i;
                salida[dst] = 0xFF000000 | (r << 16) | (g << 8) | b;
            }
        }
    }

    /** Si la imagen se giró 180° antes de MediaPipe, los puntos vuelven a la orientación de la cámara. */
    public static void desgirar(float[][] img, float[][] mundo) {
        for (int i = 0; i < 21; i++) {
            img[i][0] = 1 - img[i][0]; img[i][1] = 1 - img[i][1];
            mundo[i][0] = -mundo[i][0]; mundo[i][1] = -mundo[i][1];
        }
    }

    static void normalizar(float[] v) {
        float l = (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (l > 1e-6f) { v[0] /= l; v[1] /= l; v[2] /= l; }
    }

    /**
     * Medidas de la pistola respecto del centro del mango (las de Figuras):
     * la base de la corredera está 6 cm arriba y 5.5 cm adelante; la boca del
     * caño, 8.8 cm arriba y 19.5 cm adelante.
     */
    public static final float BASE_ARRIBA = 0.06f, BASE_ADELANTE = 0.055f, BOCA_ARRIBA = 0.088f, BOCA_ADELANTE = 0.195f;

    /** La boca del caño en el mundo. */
    public void boca(float[] salida) { boca(pos, adelante, arriba, salida); }

    public static void boca(float[] pos, float[] adelante, float[] arriba, float[] salida) {
        for (int i = 0; i < 3; i++) salida[i] = pos[i] + adelante[i] * BOCA_ADELANTE + arriba[i] * BOCA_ARRIBA;
    }
}
