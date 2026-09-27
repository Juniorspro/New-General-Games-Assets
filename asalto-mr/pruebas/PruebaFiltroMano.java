import com.juniorspro.asaltomr.AsociadorManos;
import com.juniorspro.asaltomr.FiltroMano;
import com.juniorspro.asaltomr.Mano;

import java.util.Locale;
import java.util.Random;

/**
 * La pistola en la mano, ANTES y AHORA, en las mismas condiciones.
 *
 * Una mano de verdad (los puntos que dio MediaPipe con la foto "pointing_up":
 * índice estirado, los otros cerrados) se mueve delante de la cámara y se
 * "mide" como lo haría MediaPipe en el teléfono:
 *   - la foto: cada punto con ~0.8 px de temblor (en la imagen de entrada:
 *     640×480 ahora, 320×240 antes, así que antes tiembla el doble en la foto);
 *   - los metros del modelo: el tamaño cambia ±4 % de un cuadro a otro, 2.5 mm por punto;
 *   - 3 % de los cuadros la mano sale "en espejo" en profundidad, 2 % con el tamaño 25 % mal;
 *   - la mano real es 8 % más grande que la que supone el modelo;
 *   - la profundidad de ARCore en la mano: 65 % de las veces bien (±8 mm), 35 %
 *     mezclada con el fondo (5 a 60 cm más lejos);
 *   - la imagen tarda 60 ms en llegar; se dibuja a 60 cuadros por segundo.
 *
 * Antes: Mano.aMundo (con la profundidad de ARCore mezclada en cada cuadro) +
 * One Euro sobre la pistola. Ahora: Mano.aMundo2 + FiltroMano + la salida adelantada.
 */
public class PruebaFiltroMano {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static boolean DEPURAR = System.getenv("DEPURAR") != null;
    static float P_ESPEJO = 0.03f, P_MAL = 0.02f, RUIDO_Z = 0.0025f;
    static final float F = 500, W = 640, H = 480, LAT = 0.06f, K_REAL = 1.08f;
    static float[][] forma;   // la mano en metros del modelo (x derecha, y abajo, z adentro)

    // ── la mano verdadera en cada momento ──

    /** Rota p (3) alrededor del eje e (unitario) que pasa por o. */
    static void rotar(float[] p, float[] o, float[] e, float a) {
        float x = p[0] - o[0], y = p[1] - o[1], z = p[2] - o[2];
        float c = (float) Math.cos(a), s = (float) Math.sin(a), d = x * e[0] + y * e[1] + z * e[2];
        float cx = e[1] * z - e[2] * y, cy = e[2] * x - e[0] * z, cz = e[0] * y - e[1] * x;
        p[0] = o[0] + x * c + cx * s + e[0] * d * (1 - c);
        p[1] = o[1] + y * c + cy * s + e[1] * d * (1 - c);
        p[2] = o[2] + z * c + cz * s + e[2] * d * (1 - c);
    }

    /** La forma con el índice doblado (gatillo: 0 = estirado, 1 = apretado), en metros del modelo. */
    static float[][] conGatillo(float g) {
        float[][] s = new float[21][];
        for (int i = 0; i < 21; i++) s[i] = forma[i].clone();
        if (g <= 0) return s;
        float[] e = {s[5][0] - s[17][0], s[5][1] - s[17][1], s[5][2] - s[17][2]};
        float l = (float) Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
        e[0] /= l; e[1] /= l; e[2] /= l;
        // el sentido que acerca la punta a la muñeca
        float[] prueba = s[8].clone();
        rotar(prueba, s[5], e, 0.5f);
        float sg = dist(prueba, s[0]) < dist(s[8], s[0]) ? 1 : -1;
        float[] ang = {1.1f, 1.3f, 0.9f};
        for (int j = 0; j < 3; j++) for (int k = 6 + j; k <= 8; k++) rotar(s[k], s[5 + j], e, sg * ang[j] * g);
        return s;
    }

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    /** La rotación (3×3 por filas) de la mano en la cámara OpenGL: yaw (Y), luego pitch (X). */
    static float[] rot(float yaw, float pitch) {
        float cy = (float) Math.cos(yaw), sy = (float) Math.sin(yaw), cp = (float) Math.cos(pitch), sp = (float) Math.sin(pitch);
        // Ry · Rx
        return new float[]{cy, sy * sp, sy * cp, 0, cp, -sp, -sy, cy * sp, cy * cp};
    }

    static final class Momento {
        float[][] gl = new float[21][3];   // la mano verdadera en la cámara OpenGL (m)
        float[][] mpRot = new float[21][3]; // la forma (tamaño del modelo) girada, en ejes del modelo
    }

    /** La mano verdadera: forma con gatillo g, girada (yaw, pitch) y en T (cámara OpenGL). */
    static Momento momento(float g, float yaw, float pitch, float tx, float ty, float tz) {
        float[][] s = conGatillo(g);
        float[] R = rot(yaw, pitch);
        Momento m = new Momento();
        for (int i = 0; i < 21; i++) {
            float x = s[i][0], y = -s[i][1], z = -s[i][2];   // modelo → OpenGL
            float rx = R[0] * x + R[1] * y + R[2] * z, ry = R[3] * x + R[4] * y + R[5] * z, rz = R[6] * x + R[7] * y + R[8] * z;
            m.gl[i][0] = rx * K_REAL + tx; m.gl[i][1] = ry * K_REAL + ty; m.gl[i][2] = rz * K_REAL + tz;
            m.mpRot[i][0] = rx; m.mpRot[i][1] = -ry; m.mpRot[i][2] = -rz;   // OpenGL → modelo
        }
        return m;
    }

    interface Movimiento { Momento en(float t); }

    // ── lo que "mide" MediaPipe ──

    static final class Medida {
        float[][] img640 = new float[21][3], img320 = new float[21][3], mp = new float[21][3];
        float[] prof3 = new float[3];
        float prof9;
    }

    static Medida medir(Momento m, Random r) {
        Medida d = new Medida();
        float sx = (float) r.nextGaussian() * 0.4f, sy = (float) r.nextGaussian() * 0.4f;   // corrimiento común (px)
        for (int i = 0; i < 21; i++) {
            float X = m.gl[i][0], Y = m.gl[i][1], Z = -m.gl[i][2];
            float u = 320 + F * X / Z, v = 240 - F * Y / Z;
            // 0.8 px de temblor en la imagen de entrada: en 640 son 0.8 px, en 320 son 0.8 px de 320 (1.6 de 640)
            d.img640[i][0] = (u + sx + (float) r.nextGaussian() * 0.8f) / W;
            d.img640[i][1] = (v + sy + (float) r.nextGaussian() * 0.8f) / H;
            d.img320[i][0] = (u / 2 + sx + (float) r.nextGaussian() * 0.8f) / 320;
            d.img320[i][1] = (v / 2 + sy + (float) r.nextGaussian() * 0.8f) / 240;
        }
        float esc = (float) Math.exp(r.nextGaussian() * 0.04);
        boolean espejo = r.nextFloat() < P_ESPEJO, mal = r.nextFloat() < P_MAL;
        if (mal) esc *= 1.25f;
        float zc = 0;
        for (int i = 0; i < 21; i++) zc += m.mpRot[i][2] / 21;
        for (int i = 0; i < 21; i++) {
            for (int k = 0; k < 3; k++) d.mp[i][k] = m.mpRot[i][k] * esc + (float) r.nextGaussian() * RUIDO_Z;
            if (espejo) d.mp[i][2] = 2 * zc * esc - d.mp[i][2];
        }
        int[] pp = {0, 5, 17};
        for (int k = 0; k < 3; k++) d.prof3[k] = arcore(-m.gl[pp[k]][2], r);
        d.prof9 = arcore(-m.gl[9][2], r);
        return d;
    }

    static float arcore(float z, Random r) {
        if (r.nextFloat() < 0.65f) return z + (float) r.nextGaussian() * 0.008f;
        return z + 0.05f + r.nextFloat() * 0.55f;
    }

    // ── correr las dos rutas ──

    static final class Resultado {
        double sumP, sumD, n, maxD, maxP;
        final java.util.ArrayList<float[]> pos = new java.util.ArrayList<>(), dir = new java.util.ArrayList<>();
        final java.util.ArrayList<float[]> vp = new java.util.ArrayList<>(), vd = new java.util.ArrayList<>();
        int tiros;
        float escala;
        int calibradas, espejos, descartados;
    }

    static final float[] IDENT = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};

    static float angulo(float[] a, float[] b) {
        float d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        return (float) Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, d))));
    }

    /** La pistola verdadera (la misma cuenta de Mano, sobre la mano verdadera). */
    static void verdad(Momento m, float[] p, float[] f, float[] u) {
        Mano v = new Mano();
        for (int i = 0; i < 21; i++) System.arraycopy(m.gl[i], 0, v.mundo[i], 0, 3);
        v.medirPistola(p, f, u);
    }

    /**
     * Corre un movimiento de 'dur' s; mide desde 'desde' s.
     * nueva: la ruta nueva (si no, la vieja). semilla: el mismo ruido para las dos.
     */
    static Resultado correr(Movimiento mov, float dur, float desde, boolean nueva, long semilla) {
        Random r = new Random(semilla);
        Mano m = new Mano();
        Resultado res = new Resultado();
        float proxImagen = 0, dtImg = 1 / 30f;
        java.util.ArrayDeque<Object[]> enCamino = new java.util.ArrayDeque<>();
        float[] vp = new float[3], vf = new float[3], vu = new float[3];
        long base = 1_000_000L;
        float tAnt = 0;
        for (float t = 0; t < dur; t += 1 / 60f) {
            // las imágenes que se sacan (llegan LAT después)
            while (proxImagen <= t) {
                Medida d = medir(mov.en(proxImagen), r);
                enCamino.add(new Object[]{proxImagen, d});
                proxImagen += dtImg;
            }
            while (!enCamino.isEmpty() && (float) enCamino.peek()[0] + LAT <= t) {
                Object[] o = enCamino.poll();
                float tc = (float) o[0];
                Medida d = (Medida) o[1];
                long ms = base + Math.round(tc * 1000);
                long llega = base + Math.round((tc + LAT) * 1000);   // sale de la red LAT después de la foto
                if (nueva) { if (m.aMundo2(d.img640, d.mp, 640, 480, F, F, 320, 240, d.prof3, IDENT, ms, llega, false) && m.gesto2(ms)) res.tiros++; }
                else {
                    m.aMundo(d.img320, d.mp, 320, 240, F / 2, F / 2, 160, 120, d.prof9, IDENT); m.pistolaFiltrada(ms);
                    if (m.gesto(d.mp, ms)) res.tiros++;
                }
            }
            if (nueva) m.salida(base + Math.round(t * 1000), t - tAnt);
            tAnt = t;
            if (t < desde) continue;
            verdad(mov.en(t), vp, vf, vu);
            float ep = dist(m.pos, vp) * 1000, ed = angulo(m.adelante, vf);
            res.sumP += ep * ep; res.sumD += ed * ed; res.n++;
            res.maxP = Math.max(res.maxP, ep); res.maxD = Math.max(res.maxD, ed);
            res.pos.add(m.pos.clone()); res.dir.add(m.adelante.clone());
            res.vp.add(vp.clone()); res.vd.add(vf.clone());
        }
        res.escala = m.escalaReal; res.calibradas = m.calibradas; res.espejos = m.filtro.espejos; res.descartados = m.filtro.descartados;
        return res;
    }

    /** Temblor: desvío estándar alrededor del promedio (mm y grados), y el del punto del láser a 5 m (p95, cm). */
    /** El temblor sin el corrimiento lento: desvío respecto del promedio de ±0.25 s (mm, grados, láser a 5 m en cm, p95). */
    static float[] temblorRapido(Resultado r) {
        int n = r.pos.size(), v = 15;
        double sp = 0, sd = 0;
        int k = 0;
        float[] laser = new float[n];
        for (int i = v; i < n - v; i++) {
            float[] mp = new float[3], md = new float[3], ml = new float[3];
            for (int j = i - v; j <= i + v; j++) for (int c = 0; c < 3; c++) {
                mp[c] += r.pos.get(j)[c]; md[c] += r.dir.get(j)[c]; ml[c] += r.pos.get(j)[c] + r.dir.get(j)[c] * 5;
            }
            float l = (float) Math.sqrt(md[0] * md[0] + md[1] * md[1] + md[2] * md[2]);
            for (int c = 0; c < 3; c++) { mp[c] /= 2 * v + 1; md[c] /= l; ml[c] /= 2 * v + 1; }
            float[] p = r.pos.get(i), d = r.dir.get(i);
            float dp = dist(p, mp) * 1000, dd = angulo(d, md);
            sp += dp * dp; sd += dd * dd;
            laser[k++] = dist(new float[]{p[0] + d[0] * 5, p[1] + d[1] * 5, p[2] + d[2] * 5}, ml) * 100;
        }
        float[] ls = java.util.Arrays.copyOf(laser, k);
        java.util.Arrays.sort(ls);
        return new float[]{(float) Math.sqrt(sp / k), (float) Math.sqrt(sd / k), ls[(int) (k * 0.95f)]};
    }

    static float[] temblor(Resultado r) {
        int n = r.pos.size();
        float[] mp = new float[3], md = new float[3];
        for (int i = 0; i < n; i++) for (int k = 0; k < 3; k++) { mp[k] += r.pos.get(i)[k] / n; md[k] += r.dir.get(i)[k] / n; }
        float l = (float) Math.sqrt(md[0] * md[0] + md[1] * md[1] + md[2] * md[2]);
        for (int k = 0; k < 3; k++) md[k] /= l;
        double sp = 0, sd = 0;
        float[] laser = new float[n];
        float[] ml = new float[3];
        for (int i = 0; i < n; i++) {
            float[] p = r.pos.get(i), d = r.dir.get(i);
            for (int k = 0; k < 3; k++) ml[k] += (p[k] + d[k] * 5) / n;
        }
        for (int i = 0; i < n; i++) {
            float[] p = r.pos.get(i), d = r.dir.get(i);
            float dp = dist(p, mp) * 1000, dd = angulo(d, md);
            sp += dp * dp; sd += dd * dd;
            float[] q = {p[0] + d[0] * 5, p[1] + d[1] * 5, p[2] + d[2] * 5};
            laser[i] = dist(q, ml) * 100;
        }
        java.util.Arrays.sort(laser);
        // sesgo: el promedio contra la verdad
        float[] vm = new float[3];
        for (int i = 0; i < n; i++) for (int k = 0; k < 3; k++) vm[k] += r.vp.get(i)[k] / n;
        return new float[]{(float) Math.sqrt(sp / n), (float) Math.sqrt(sd / n), laser[(int) (n * 0.95f)], dist(mp, vm) * 1000};
    }

    static float rms(double s, double n) { return (float) Math.sqrt(s / n); }

    /** Los tirones: la segunda diferencia de la posición, cuadro a cuadro (mm/cuadro²), del arma y de la mano verdadera. */
    static float[] tirones(Resultado m) {
        double j = 0, jv = 0;
        int n = 0;
        for (int i = 1; i < m.pos.size() - 1; i++) {
            for (int c = 0; c < 3; c++) {
                double d2 = (m.pos.get(i + 1)[c] - 2 * m.pos.get(i)[c] + m.pos.get(i - 1)[c]) * 1000;
                double v2 = (m.vp.get(i + 1)[c] - 2 * m.vp.get(i)[c] + m.vp.get(i - 1)[c]) * 1000;
                j += d2 * d2; jv += v2 * v2;
            }
            n++;
        }
        return new float[]{(float) Math.sqrt(j / n), (float) Math.sqrt(jv / n)};
    }

    public static void main(String[] a) throws Exception {
        PruebaMano.cargar();
        forma = PruebaMano.fotos.get("pointing_up").mundo;
        final float TX = 0.05f, TY = -0.10f, TZ = -0.42f, YAW = 0.25f, PITCH = -1.45f;

        // 1) quieta (con saltos y espejos de vez en cuando)
        Movimiento quieta = t -> momento(0, YAW, PITCH, TX, TY, TZ);
        Resultado qa = correr(quieta, 7, 2f, false, 1), qn = correr(quieta, 7, 2f, true, 1);
        float[] ta = temblorRapido(qa), tn = temblorRapido(qn), ca = temblor(qa), cn = temblor(qn);
        // con otros dos ruidos: se queda con lo peor
        for (long sem : new long[]{7, 13}) {
            float[] o = temblorRapido(correr(quieta, 7, 2f, true, sem)), oa = temblorRapido(correr(quieta, 7, 2f, false, sem));
            for (int k = 0; k < 3; k++) { tn[k] = Math.max(tn[k], o[k]); ta[k] = Math.max(ta[k], oa[k]); }
        }
        System.out.printf(Locale.ROOT, "quieta (temblor, lo peor de 3 ruidos) — antes: %.1f mm, %.2f°, láser a 5 m %.1f cm · ahora: %.1f mm, %.2f°, láser %.1f cm%n",
                ta[0], ta[1], ta[2], tn[0], tn[1], tn[2]);
        System.out.printf(Locale.ROOT, "quieta (en 5 s, con lo que se corre) — antes: %.1f mm, %.2f°, corrida %.0f mm · ahora: %.1f mm, %.2f°, corrida %.0f mm%n",
                ca[0], ca[1], ca[3], cn[0], cn[1], cn[3]);
        System.out.printf(Locale.ROOT, "  (tamaño real calibrado %.3f con %d medidas de ARCore, real %.2f · espejos corregidos %d · cuadros descartados %d)%n",
                qn.escala, qn.calibradas, K_REAL, qn.espejos, qn.descartados);
        ver(tn[0] < 2.5f && tn[0] < ta[0] / 2, String.format(Locale.ROOT, "quieta, la pistola tiembla menos de 2.5 mm y menos de la mitad que antes (%.1f contra %.1f mm)", tn[0], ta[0]));
        ver(tn[1] < 0.35f && tn[1] < ta[1], String.format(Locale.ROOT, "quieta, el caño tiembla menos de 0.35° (%.2f° contra %.2f°)", tn[1], ta[1]));
        ver(tn[2] < 4f && tn[2] < ta[2], String.format(Locale.ROOT, "el punto del láser a 5 m se queda en menos de 4 cm (%.1f contra %.1f cm)", tn[2], ta[2]));
        ver(cn[3] < 15f, String.format(Locale.ROOT, "la distancia real sale bien (corrida %.0f mm; antes %.0f): ARCore calibra el tamaño de la mano", cn[3], ca[3]));

        // 2) moviéndose (hasta 0.5 m/s de costado y 5 cm de adelante para atrás)
        Movimiento mueve = t -> momento(0, YAW, PITCH, TX + 0.1f * (float) Math.sin(2 * Math.PI * 0.8 * t),
                TY + 0.03f * (float) Math.sin(2 * Math.PI * 0.6 * t), TZ + 0.05f * (float) Math.sin(2 * Math.PI * 0.5 * t));
        Resultado ma = correr(mueve, 6, 2f, false, 2), mn = correr(mueve, 6, 2f, true, 2);
        float ea = rms(ma.sumP, ma.n), en = rms(mn.sumP, mn.n);
        float[] ja = tirones(ma), jn = tirones(mn);
        System.out.printf(Locale.ROOT, "moviéndose — antes: %.0f mm (máx %.0f), tirones %.2f mm/cuadro² · ahora: %.0f mm (máx %.0f), tirones %.2f (la mano real: %.2f)%n",
                ea, ma.maxP, ja[0], en, mn.maxP, jn[0], jn[1]);
        ver(en < 30 && en < ea, String.format(Locale.ROOT, "moviéndose, la pistola sigue a la mano a menos de 30 mm (%.0f contra %.0f mm)", en, ea));
        ver(jn[0] < 4 && jn[0] < ja[0] / 2, String.format(Locale.ROOT, "y se mueve pareja: el resorte saca los tirones de cada foto nueva (%.2f contra %.2f mm/cuadro²)", jn[0], ja[0]));

        // 3) girando la muñeca (±35° a 0.6 Hz)
        Movimiento gira = t -> momento(0, YAW + 0.61f * (float) Math.sin(2 * Math.PI * 0.6 * t), PITCH, TX, TY, TZ);
        Resultado ga = correr(gira, 6, 2f, false, 3), gn = correr(gira, 6, 2f, true, 3);
        float da = rms(ga.sumD, ga.n), dn = rms(gn.sumD, gn.n);
        System.out.printf(Locale.ROOT, "girando — antes: %.1f° (máx %.1f) · ahora: %.1f° (máx %.1f)%n", da, ga.maxD, dn, gn.maxD);
        ver(dn < 7 && dn < da, String.format(Locale.ROOT, "girando, el caño sigue a la mano a menos de 7° (%.1f° contra %.1f°)", dn, da));

        // 3b) apuntar despacio: ir y volver 12° a 6°/s (no se tiene que "pegar")
        Movimiento despacio = t -> {
            float c = (t % 4f), ang = c < 2 ? c * 0.105f : (4 - c) * 0.105f;
            return momento(0, YAW + ang, PITCH, TX, TY, TZ);
        };
        Resultado sa = correr(despacio, 9, 3f, false, 5), sn = correr(despacio, 9, 3f, true, 5);
        float xa2 = rms(sa.sumD, sa.n), xn2 = rms(sn.sumD, sn.n);
        System.out.printf(Locale.ROOT, "apuntando despacio — antes: %.1f° (máx %.1f) · ahora: %.1f° (máx %.1f)%n", xa2, sa.maxD, xn2, sn.maxD);
        ver(xn2 < 2f && xn2 < xa2, String.format(Locale.ROOT, "apuntando despacio, el caño sigue (%.1f° contra %.1f°): el ancla no lo pega", xn2, xa2));

        // 4) apretar el gatillo 5 veces, con la mano quieta: el caño no se mueve, y los 5 tiros salen
        Movimiento gatillo = t -> {
            float c = t - 1.5f;
            float g = 0;
            if (c > 0 && c < 5 * 1.05f) {
                float f = c % 1.05f;
                g = f < 0.2f ? f / 0.2f : f < 0.35f ? 1 : f < 0.6f ? 1 - (f - 0.35f) / 0.25f : 0;
            }
            return momento(g, YAW, PITCH, TX, TY, TZ);
        };
        Resultado xa = correr(gatillo, 8, 1.2f, false, 4), xn = correr(gatillo, 8, 1.2f, true, 4);
        float[] txa = temblorRapido(xa), txn = temblorRapido(xn);
        System.out.printf(Locale.ROOT, "gatillo — antes: caño se mueve hasta %.1f° (temblor %.2f°), %d tiros · ahora: hasta %.1f° (%.2f°), %d tiros%n",
                xa.maxD, txa[1], xa.tiros, xn.maxD, txn[1], xn.tiros);
        ver(xn.tiros == 5, "los 5 tiros salen (" + xn.tiros + ")");
        ver(txn[1] < 0.5f && txn[1] <= txa[1], String.format(Locale.ROOT, "apretando el gatillo, el caño casi no se mueve (%.2f° contra %.2f°)", txn[1], txa[1]));

        // 6) dos manos: cada una sigue siendo la misma (aunque la red las dé en cualquier orden), sin fantasmas ni duplicadas
        {
            Random r = new Random(11);
            Mano[] ms = {new Mano(), new Mano()};
            AsociadorManos as = new AsociadorManos();
            FiltroMano[] fs = {ms[0].filtro, ms[1].filtro};
            float[] cam = {0, 0, 0};
            int cambios = 0, fantasmas = 0, perdidas = 0;
            int[] primera = {-1, -1};
            long base = 5_000_000L;
            for (int i = 0; i < 150; i++) {
                float t = i / 30f;
                long ms0 = base + Math.round(t * 1000);
                // izquierda y derecha, acercándose y alejándose
                float dx0 = 0.06f * (float) Math.sin(t * 1.5);   // se acercan hasta 14 cm (no se cruzan en el mismo lugar)
                Momento[] mo = {momento(0, YAW, PITCH, -0.13f + dx0, TY, TZ - 0.03f), momento(0, YAW, PITCH, 0.13f - dx0, TY, TZ + 0.03f)};
                java.util.ArrayList<Integer> quien = new java.util.ArrayList<>();
                quien.add(0); quien.add(1);
                if (r.nextBoolean()) java.util.Collections.reverse(quien);
                // un fantasma de un cuadro (cada tanto), y una duplicada
                boolean fantasma = i % 37 == 20, duplicada = i % 29 == 10;
                int nd = 2 + (fantasma ? 1 : 0) + (duplicada ? 1 : 0);
                float[][] cs = new float[nd][3];
                float[] conf = new float[nd];
                int[] lado = new int[nd];
                Medida[] med = new Medida[nd];
                int[] verdad = new int[nd];
                float[] pts = new float[63];
                for (int h = 0; h < nd; h++) {
                    Momento m;
                    if (h < 2) { verdad[h] = quien.get(h); m = mo[verdad[h]]; }
                    else if (fantasma && h == 2) { verdad[h] = -1; m = momento(0, YAW, PITCH, 0, TY + 0.25f, TZ - 0.2f); }
                    else { verdad[h] = -2; m = mo[0]; }   // la duplicada (de la izquierda, 1 cm corrida)
                    med[h] = medir(m, r);
                    if (verdad[h] == -2) for (float[] q : med[h].img640) q[0] += 0.01f / 0.5f * 500 / 640;
                    Mano.centroEnMundo(med[h].img640, med[h].mp, 640, 480, F, F, 320, 240, 1, IDENT, cs[h], pts);
                    conf[h] = verdad[h] == -2 ? 0.6f : 0.9f;
                    lado[h] = -1;
                }
                int[] sl = as.asignar(cs, conf, lado, fs, Mano.segundosPrueba(ms0), cam);
                for (int h = 0; h < nd; h++) {
                    if (verdad[h] < 0) { if (sl[h] >= 0 && verdad[h] == -1) fantasmas++; continue; }
                    if (sl[h] < 0) { perdidas++; if (DEPURAR) System.out.println("  sin asignar: cuadro " + i + " mano " + verdad[h]); continue; }
                    if (primera[verdad[h]] < 0) primera[verdad[h]] = sl[h];
                    else if (primera[verdad[h]] != sl[h]) { cambios++; if (DEPURAR) System.out.println("  cambio: cuadro " + i + " mano " + verdad[h] + " → " + sl[h] + " dx0 " + dx0); }
                    ms[sl[h]].aMundo2(med[h].img640, med[h].mp, 640, 480, F, F, 320, 240, null, IDENT, ms0, ms0 + 60, false);
                }
                for (Mano m : ms) m.salida(ms0 + 60, 1 / 30f);
            }
            ver(cambios == 0 && primera[0] != primera[1], "dos manos, 5 s, dadas en cualquier orden: cada una sigue en su lugar (" + cambios + " cambios)");
            ver(fantasmas == 0, "un fantasma de un solo cuadro (con otra mano a la vista) no se toma (" + fantasmas + ")");
            ver(perdidas <= 2, "las dos manos de verdad casi siempre se asignan (" + perdidas + " de 300 sin asignar, al empezar)");
        }
        {
            // la misma mano, en el mismo rayo pero 15 cm más lejos (la red la vio dos veces): no es otra mano
            // (sin cuadros en espejo ni de tamaño malo: acá se prueba la asociación, no el descarte)
            float pe = P_ESPEJO, pm = P_MAL;
            P_ESPEJO = 0; P_MAL = 0;
            AsociadorManos as = new AsociadorManos();
            Mano ma1 = new Mano(), b = new Mano();
            FiltroMano[] fs = {ma1.filtro, b.filtro};
            Random r = new Random(3);
            float[] cam = {0, 0, 0}, pts = new float[63];
            int otra = 0;
            for (int i = 0; i < 60; i++) {
                long ms0 = 9_000_000L + i * 33;
                Medida d = medir(momento(0, YAW, PITCH, TX, TY, TZ), r);
                float[][] cs = new float[2][3];
                Mano.centroEnMundo(d.img640, d.mp, 640, 480, F, F, 320, 240, 1, IDENT, cs[0], pts);
                for (int k = 0; k < 3; k++) cs[1][k] = cs[0][k] * 1.35f;
                int[] sl = as.asignar(cs, new float[]{0.9f, 0.8f}, new int[]{-1, -1}, fs, Mano.segundosPrueba(ms0), cam);
                if (sl[0] >= 0) (sl[0] == 0 ? ma1 : b).aMundo2(d.img640, d.mp, 640, 480, F, F, 320, 240, null, IDENT, ms0, ms0 + 60, false);
                if (i > 3 && sl[1] >= 0) { otra++; if (DEPURAR) System.out.println("  rayo: cuadro " + i + " sl " + sl[0] + "," + sl[1] + " vis " + ma1.filtro.visible + "/" + b.filtro.visible); }
                ma1.salida(ms0 + 60, 1 / 30f); b.salida(ms0 + 60, 1 / 30f);
            }
            ver(otra == 0, "la misma mano dos veces en el mismo rayo no se toma como otra (" + otra + ")");
            P_ESPEJO = pe; P_MAL = pm;
            // se deja de ver: se desvanece en 0.2 s; vuelve donde estaba (en menos de medio segundo): la misma mano, sin saltar
            Mano m = ma1.filtro.visible ? ma1 : b;
            long t0 = 9_000_000L + 60 * 33;
            float alfaAntes = m.filtro.alfa;
            for (int i = 1; i <= 12; i++) { m.filtro.faltas++; m.salida(t0 + i * 33, 1 / 30f); }
            float alfaDespues = m.filtro.alfa;
            ver(alfaAntes > 0.99f && !m.filtro.visible && alfaDespues < 0.05f, String.format(Locale.ROOT, "sin verla (4 imágenes): se da por perdida y se va en 0.2 s (alfa %.2f → %.2f)", alfaAntes, alfaDespues));
            float[] antes = m.pos.clone();
            float[] cs = new float[3];
            Medida d = medir(momento(0, YAW, PITCH, TX, TY, TZ), new Random(5));
            Mano.centroEnMundo(d.img640, d.mp, 640, 480, F, F, 320, 240, 1, IDENT, cs, new float[63]);
            int[] sl = as.asignar(new float[][]{cs}, new float[]{0.9f}, new int[]{-1}, fs, Mano.segundosPrueba(t0 + 250), cam);
            ver(sl[0] >= 0 && fs[sl[0]] == m.filtro, "vuelve a los 250 ms en el mismo lugar: es la misma mano");
            m.aMundo2(d.img640, d.mp, 640, 480, F, F, 320, 240, null, IDENT, t0 + 250, t0 + 310, false);
            float ap = 0;
            for (int i = 0; i < 6; i++) { m.salida(t0 + 310 + i * 16, 1 / 60f); ap = m.filtro.alfa; }
            ver(ap > 0.99f && dist(m.pos, antes) < 0.03f, String.format(Locale.ROOT, "y aparece en 80 ms, donde estaba (alfa %.2f, %.0f mm)", ap, dist(m.pos, antes) * 1000));
        }

        // 5) la imagen: a resolución completa con ganancia (una mano oscura en un fondo claro)
        {
            int iw = 64, ih = 48;
            byte[] y = new byte[iw * ih], u = new byte[(iw / 2) * (ih / 2)], v = new byte[(iw / 2) * (ih / 2)];
            Random r = new Random(9);
            for (int j = 0; j < ih; j++) for (int i = 0; i < iw; i++) {
                boolean mano = i >= 20 && i < 44 && j >= 12 && j < 36;
                y[j * iw + i] = (byte) (mano ? 40 + r.nextInt(8) : 200 + r.nextInt(20));
            }
            for (int k = 0; k < u.length; k++) { u[k] = (byte) (118 + r.nextInt(8)); v[k] = (byte) (140 + r.nextInt(8)); }
            int[] a1 = new int[iw * ih], a2 = new int[iw * ih], a3 = new int[iw * ih];
            Mano.yuvARgb(y, iw, 1, u, v, iw / 2, 1, iw, ih, iw, ih, false, a1);
            float media = Mano.yuvARgbConGanancia(y, iw, 1, u, v, iw / 2, 1, iw, ih, false, 256, new float[]{20f / iw, 12f / ih, 44f / iw, 36f / ih}, a2);
            ver(java.util.Arrays.equals(a1, a2), "con ganancia 1, la conversión a resolución completa da lo mismo que la probada");
            ver(Math.abs(media - 43.5f / 255) < 0.02f, String.format(Locale.ROOT, "mide el brillo de la mano en su caja (%.3f; la mano es %.3f, el fondo %.3f)", media, 43.5f / 255, 210f / 255));
            float g = 1;
            for (int k = 0; k < 15; k++) g = Mano.siguienteGanancia(g, media);
            ver(Math.abs(g - 0.42f / media) < 0.1f, String.format(Locale.ROOT, "la ganancia lleva la mano a 0.42 de brillo (×%.2f)", g));
            Mano.yuvARgbConGanancia(y, iw, 1, u, v, iw / 2, 1, iw, ih, false, Math.round(g * 256), null, a3);
            int c = a3[24 * iw + 32], rr = (c >> 16) & 255, gg = (c >> 8) & 255, bb = c & 255;
            float brillo = (0.299f * rr + 0.587f * gg + 0.114f * bb) / 255;
            ver(brillo > 0.35f && brillo < 0.5f, String.format(Locale.ROOT, "y la mano sale aclarada (%.2f)", brillo));
            ver(Mano.siguienteGanancia(1, 0.6f) == 1f, "con buena luz no toca nada (×1)");
        }

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
