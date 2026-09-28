package com.juniorspro.nexoxr;

import java.util.List;

/**
 * TU MESA: la superficie que se escanea al empezar y que manda cuándo Nexo se
 * puede mover.
 *
 * La idea: en vez de que el seguimiento "adivine" dónde estás todo el tiempo
 * (y se deslice mirando una pared lisa o el techo), la posición sólo sigue a
 * ARCore cuando la cámara está VIENDO la mesa que marcaste: sus puntos (los que
 * ARCore sigue en esta foto) caen sobre ella. Si no la ve, la cabeza gira
 * alrededor de un cuello quieto ({@link Seguimiento#puedeMoverse}).
 *
 * Todo en números (sin ARCore ni Android): los planos llegan como una pose
 * (por columnas; su +Y es la normal) y un polígono convexo en su marco (x, z),
 * igual que los da ARCore. Se prueba en la PC (pruebas/PruebaMesa.java).
 */
public final class Mesa {
    /** Entre cuánto por debajo de los ojos puede estar una mesa (sentado: ~0.45 m; parado: ~0.85 m; el piso: > 1.1 m). */
    static final float BAJO_MIN = 0.15f, BAJO_MAX = 1.05f;
    /** Lo mínimo para ofrecerla (30 × 25 cm) y para confirmarla sola. */
    static final float AREA_MIN = 0.07f, AREA_BUENA = 0.16f;
    /** Un punto está SOBRE la mesa si está a menos de esto del plano (y dentro del polígono, con este margen). */
    static final float TOLERANCIA = 0.03f, MARGEN = 0.03f;
    /** Cuántos puntos sobre la mesa hacen falta para decir "la veo". */
    static final int PUNTOS_VE = 6;
    /** Histéresis: se prende a los 2 cuadros seguidos; se apaga a los 450 ms sin verla. */
    static final int PRENDE_CUADROS = 2;
    static final long APAGA_MS = 450;

    /** Un plano de ARCore, en números. */
    public static final class Plano {
        public final float[] pose = new float[16];
        /** x0, z0, x1, z1… en el marco del plano (convexo, como el de ARCore). */
        public float[] poligono = new float[0];
        public boolean horizontal, vertical;
        /** Para reconocerlo entre cuadros (el hash del Plane de ARCore). */
        public int id;

        public int lados() { return poligono.length / 2; }

        /** El área (m²), por la fórmula del cordón. */
        public float area() {
            int n = lados();
            float a = 0;
            for (int i = 0; i < n; i++) {
                int j = (i + 1) % n;
                a += poligono[i * 2] * poligono[j * 2 + 1] - poligono[j * 2] * poligono[i * 2 + 1];
            }
            return Math.abs(a) / 2;
        }

        /** El ancho y el largo (m) de la caja del polígono, para mostrar. */
        public float[] medidas() {
            float x0 = Float.MAX_VALUE, x1 = -Float.MAX_VALUE, z0 = Float.MAX_VALUE, z1 = -Float.MAX_VALUE;
            for (int i = 0; i < lados(); i++) {
                x0 = Math.min(x0, poligono[i * 2]); x1 = Math.max(x1, poligono[i * 2]);
                z0 = Math.min(z0, poligono[i * 2 + 1]); z1 = Math.max(z1, poligono[i * 2 + 1]);
            }
            return lados() == 0 ? new float[]{0, 0} : new float[]{Math.max(x1 - x0, z1 - z0), Math.min(x1 - x0, z1 - z0)};
        }

        /** El centro del polígono (en su marco). */
        public void centroLocal(float[] o) {
            int n = lados();
            o[0] = o[1] = 0;
            for (int i = 0; i < n; i++) { o[0] += poligono[i * 2] / n; o[1] += poligono[i * 2 + 1] / n; }
        }

        /** Un punto del marco del plano (x, z) al mundo. */
        public void aMundo(float x, float z, float[] o) {
            o[0] = pose[0] * x + pose[8] * z + pose[12];
            o[1] = pose[1] * x + pose[9] * z + pose[13];
            o[2] = pose[2] * x + pose[10] * z + pose[14];
        }

        /** Un punto del mundo al marco del plano: (x, altura sobre el plano, z). */
        public void aLocal(float px, float py, float pz, float[] o) {
            float dx = px - pose[12], dy = py - pose[13], dz = pz - pose[14];
            o[0] = pose[0] * dx + pose[1] * dy + pose[2] * dz;
            o[1] = pose[4] * dx + pose[5] * dy + pose[6] * dz;
            o[2] = pose[8] * dx + pose[9] * dy + pose[10] * dz;
        }

        /** La normal (el +Y de su pose). */
        public void normal(float[] o) { o[0] = pose[4]; o[1] = pose[5]; o[2] = pose[6]; }

        /** ¿(x, z) del marco del plano cae adentro del polígono (con margen, + agranda)? Convexo: del mismo lado de todos los bordes. */
        public boolean adentro(float x, float z, float margen) {
            int n = lados();
            if (n < 3) return false;
            float signo = orientacion();
            for (int i = 0; i < n; i++) {
                int j = (i + 1) % n;
                float ax = poligono[i * 2], az = poligono[i * 2 + 1], bx = poligono[j * 2], bz = poligono[j * 2 + 1];
                float ex = bx - ax, ez = bz - az, l = (float) Math.sqrt(ex * ex + ez * ez);
                if (l < 1e-6f) continue;
                float c = (ex * (z - az) - ez * (x - ax)) / l;   // distancia con signo al borde (+ = del lado de adentro)
                if (c * signo < -margen) return false;
            }
            return true;
        }

        /** +1 si el polígono da la vuelta antihoraria (en x, z), −1 si horaria. */
        private float orientacion() {
            int n = lados();
            float a = 0;
            for (int i = 0; i < n; i++) {
                int j = (i + 1) % n;
                a += poligono[i * 2] * poligono[j * 2 + 1] - poligono[j * 2] * poligono[i * 2 + 1];
            }
            return a >= 0 ? 1 : -1;
        }

        /**
         * El punto del polígono más cercano a (x, z) que queda al menos a
         * "margen" de todos los bordes (si ya lo está, el mismo).
         */
        public void alPoligono(float x, float z, float margen, float[] o) {
            if (adentro(x, z, -margen)) { o[0] = x; o[1] = z; return; }
            int n = lados();
            float px = x, pz = z;
            if (!adentro(x, z, 0)) {
                // al borde más cercano
                float mejor = Float.MAX_VALUE;
                for (int i = 0; i < n; i++) {
                    int j = (i + 1) % n;
                    float ax = poligono[i * 2], az = poligono[i * 2 + 1], bx = poligono[j * 2], bz = poligono[j * 2 + 1];
                    float ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
                    float t = l2 < 1e-9f ? 0 : Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
                    float qx = ax + ex * t, qz = az + ez * t, d = (qx - x) * (qx - x) + (qz - z) * (qz - z);
                    if (d < mejor) { mejor = d; px = qx; pz = qz; }
                }
            }
            // y hacia adentro hasta quedar a "margen" de cada borde (en un convexo converge en pocas vueltas)
            float signo = orientacion();
            for (int vuelta = 0; vuelta < 4; vuelta++) {
                for (int i = 0; i < n; i++) {
                    int j = (i + 1) % n;
                    float ax = poligono[i * 2], az = poligono[i * 2 + 1], bx = poligono[j * 2], bz = poligono[j * 2 + 1];
                    float ex = bx - ax, ez = bz - az, l = (float) Math.sqrt(ex * ex + ez * ez);
                    if (l < 1e-6f) continue;
                    float nx = -ez / l * signo, nz = ex / l * signo;   // la normal hacia adentro
                    float d = (px - ax) * nx + (pz - az) * nz;
                    if (d < margen) { px += nx * (margen - d); pz += nz * (margen - d); }
                }
            }
            o[0] = px; o[1] = pz;
        }
    }

    // ───────────────────────── elegir la mesa ─────────────────────────

    /**
     * La mejor mesa entre los planos: horizontal, entre 15 cm y 1.05 m debajo de
     * los ojos (el piso queda afuera), de al menos 30 × 25 cm, cerca y adelante.
     * Devuelve su índice o −1. puntos[0] = su puntaje (para mostrar).
     */
    public static int elegir(List<Plano> planos, float[] cabeza, float[] adelante, float[] puntos) {
        int mejor = -1;
        float mp = 0;
        float fl = (float) Math.hypot(adelante[0], adelante[2]);
        float fx = fl > 1e-4f ? adelante[0] / fl : 0, fz = fl > 1e-4f ? adelante[2] / fl : -1;
        float[] c = new float[2], w = new float[3];
        for (int i = 0; i < planos.size(); i++) {
            Plano p = planos.get(i);
            if (!p.horizontal || p.lados() < 3) continue;
            float bajo = cabeza[1] - p.pose[13];
            if (bajo < BAJO_MIN || bajo > BAJO_MAX) continue;
            float area = p.area();
            if (area < AREA_MIN) continue;
            // el punto de la mesa más cercano a la cabeza (en horizontal) y cuán adelante está el centro
            float[] l = new float[3];
            p.aLocal(cabeza[0], cabeza[1], cabeza[2], l);
            float[] q = new float[2];
            p.alPoligono(l[0], l[2], 0, q);
            p.aMundo(q[0], q[1], w);
            float dh = (float) Math.hypot(w[0] - cabeza[0], w[2] - cabeza[2]);
            if (dh > 1.6f) continue;
            p.centroLocal(c);
            p.aMundo(c[0], c[1], w);
            float dx = w[0] - cabeza[0], dz = w[2] - cabeza[2], dl = (float) Math.hypot(dx, dz);
            float frente = dl > 1e-3f ? (dx * fx + dz * fz) / dl : 1;
            // más grande, más cerca, más adelante, y a altura de mesa (sentado o parado)
            float pts = Math.min(1, area / 0.5f) * 1.2f + (1 - dh / 1.6f) + Math.max(0, frente) * 0.8f
                    + (bajo > 0.3f && bajo < 0.95f ? 0.3f : 0);
            if (pts > mp) { mp = pts; mejor = i; }
        }
        if (puntos != null) puntos[0] = mp;
        return mejor;
    }

    // ───────────────────────── ¿la estoy viendo? ─────────────────────────

    /**
     * Cuántos puntos de la nube de ARCore (x, y, z, confianza; los que sigue EN
     * ESTA FOTO) caen sobre la mesa: a menos de 3 cm del plano y dentro del
     * polígono. Es la señal de verdad: ARCore la está mirando.
     */
    public static int puntosSobre(Plano p, float[] nube, int n, float confMin) {
        int cuenta = 0;
        float[] l = new float[3];
        for (int i = 0; i < n; i++) {
            if (nube[i * 4 + 3] < confMin) continue;
            p.aLocal(nube[i * 4], nube[i * 4 + 1], nube[i * 4 + 2], l);
            if (Math.abs(l[1]) > TOLERANCIA) continue;
            if (p.adentro(l[0], l[2], MARGEN)) cuenta++;
        }
        return cuenta;
    }

    /**
     * Qué parte de la mesa entra en la vista: de 9 puntos (el centro, los
     * vértices y el medio de los bordes, hasta 8), cuántos caen adentro de la
     * imagen (vp: proyección · vista de la cámara), delante y a menos de 3 m.
     */
    public static float fraccionVisible(Plano p, float[] vp, float[] ojo) {
        int n = p.lados();
        if (n < 3) return 0;
        int total = 0, adentro = 0;
        float[] w = new float[3], c = new float[2];
        p.centroLocal(c);
        int paso = Math.max(1, n / 8);
        for (int k = -1; k < n; k += (k < 0 ? 1 : paso)) {
            float x, z;
            if (k < 0) { x = c[0]; z = c[1]; }
            else { x = (p.poligono[k * 2] * 0.85f + c[0] * 0.15f); z = (p.poligono[k * 2 + 1] * 0.85f + c[1] * 0.15f); }
            p.aMundo(x, z, w);
            total++;
            float cw = vp[3] * w[0] + vp[7] * w[1] + vp[11] * w[2] + vp[15];
            if (cw <= 0.05f) continue;
            float cx = (vp[0] * w[0] + vp[4] * w[1] + vp[8] * w[2] + vp[12]) / cw;
            float cy = (vp[1] * w[0] + vp[5] * w[1] + vp[9] * w[2] + vp[13]) / cw;
            if (Math.abs(cx) > 1 || Math.abs(cy) > 1) continue;
            if (ojo != null && Seguimiento.dist(w, ojo) > 3f) continue;
            adentro++;
        }
        return total == 0 ? 0 : adentro / (float) total;
    }

    // ── la histéresis: "la veo" sin parpadear ──

    /** Si ahora se considera que la mesa se ve (lo que manda si Nexo se mueve). */
    public boolean vista;
    private int seguidos;
    private long ultimaVez = Long.MIN_VALUE;
    /** Los puntos sobre la mesa en el último cuadro (para mostrar). */
    public int puntos;

    /** Cada cuadro: si en esta foto se la detectó. */
    public void paso(boolean detectada, long ms) {
        if (detectada) {
            seguidos++;
            ultimaVez = ms;
            if (seguidos >= PRENDE_CUADROS) vista = true;
        } else {
            seguidos = 0;
            if (vista && ms - ultimaVez > APAGA_MS) vista = false;
        }
    }

    /** La regla: la veo si hay puntos sobre ella, o si está bien a la vista y hay algunos. */
    public static boolean detectada(boolean rastrea, int puntos, float visible) {
        return rastrea && (puntos >= PUNTOS_VE || (visible >= 0.3f && puntos >= 2));
    }

    // ───────────────────────── dónde van las cosas en la mesa ─────────────────────────

    /**
     * Un punto de la mesa delante tuyo: la cabeza bajada a la mesa y avanzada
     * "adelanteM" en la dirección en que mirás (horizontal), llevado adentro del
     * polígono (con 6 cm de margen). En o: (x, y, z) del mundo.
     */
    public static void puntoAdelante(Plano p, float[] cabeza, float[] adelante, float adelanteM, float[] o) {
        float fl = (float) Math.hypot(adelante[0], adelante[2]);
        float fx = fl > 1e-4f ? adelante[0] / fl : 0, fz = fl > 1e-4f ? adelante[2] / fl : -1;
        float[] l = new float[3], q = new float[2];
        p.aLocal(cabeza[0] + fx * adelanteM, cabeza[1], cabeza[2] + fz * adelanteM, l);
        p.alPoligono(l[0], l[2], 0.06f, q);
        p.aMundo(q[0], q[1], o);
    }

    /**
     * Las manos de guía sobre la mesa (21 puntos cada una, como MediaPipe),
     * apoyadas, con los dedos hacia adelante: la izquierda y la derecha a 13 cm
     * del punto c. f: hacia adelante (horizontal), arriba: la normal de la mesa.
     */
    public static void manosGuia(float[] c, float[] f, float[] arriba, float[][][] o) {
        float fl = (float) Math.sqrt(f[0] * f[0] + f[2] * f[2]);
        float fx = fl > 1e-4f ? f[0] / fl : 0, fz = fl > 1e-4f ? f[2] / fl : -1;
        // derecha = adelante × arriba (con adelante horizontal: (fx, 0, fz))
        float rx = -fz * arriba[1], ry = fz * arriba[0] - fx * arriba[2], rz = fx * arriba[1];
        float rl = (float) Math.sqrt(rx * rx + ry * ry + rz * rz);
        rx /= rl; ry /= rl; rz /= rl;
        for (int m = 0; m < 2; m++) {
            float lado = m == 0 ? -1 : 1;   // 0 = izquierda, 1 = derecha
            float bx = c[0] + rx * 0.13f * lado - fx * 0.09f, by = c[1], bz = c[2] + rz * 0.13f * lado - fz * 0.09f;
            for (int i = 0; i < 21; i++) {
                float x = MANO_PLANA[i * 3] * lado, y = MANO_PLANA[i * 3 + 1], z = MANO_PLANA[i * 3 + 2];
                o[m][i][0] = bx + rx * x + arriba[0] * y + fx * z;
                o[m][i][1] = by + ry * x + arriba[1] * y;
                o[m][i][2] = bz + rz * x + arriba[2] * y + fz * z;
            }
        }
    }

    /**
     * Una mano DERECHA apoyada, palma abajo: x a la derecha, y arriba, z hacia
     * los dedos (m). La izquierda es el espejo (x por −1).
     */
    static final float[] MANO_PLANA = {
            0, 0.018f, 0,                                                                 // 0 muñeca
            -0.026f, 0.016f, 0.022f, -0.044f, 0.014f, 0.042f, -0.058f, 0.012f, 0.062f, -0.068f, 0.011f, 0.080f,   // pulgar
            -0.022f, 0.022f, 0.085f, -0.025f, 0.018f, 0.124f, -0.026f, 0.014f, 0.148f, -0.027f, 0.011f, 0.168f,   // índice
            0, 0.022f, 0.090f, 0, 0.018f, 0.134f, 0, 0.014f, 0.161f, 0, 0.011f, 0.184f,                           // medio
            0.020f, 0.021f, 0.085f, 0.022f, 0.017f, 0.124f, 0.023f, 0.013f, 0.149f, 0.024f, 0.011f, 0.169f,       // anular
            0.038f, 0.019f, 0.075f, 0.043f, 0.015f, 0.104f, 0.046f, 0.012f, 0.122f, 0.048f, 0.010f, 0.139f};      // meñique

    /** ¿La mano (21 puntos) está sobre su guía? La muñeca y el nudillo del medio a menos de "tol". */
    public static boolean sobreGuia(float[][] mano, float[][] guia, float tol) {
        return Seguimiento.dist(mano[0], guia[0]) < tol && Seguimiento.dist(mano[9], guia[9]) < tol;
    }
}
