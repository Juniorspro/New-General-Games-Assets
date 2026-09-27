import com.juniorspro.asaltomr.Mano;

import java.util.Locale;
import java.util.Random;

/**
 * El arma en la mano, girando TODO: la muñeca 360° alrededor del caño,
 * apuntando al techo y al piso, de un costado al otro, y vos dando una vuelta
 * entera (la cámara gira 360° con la mano adelante). Con el mismo "MediaPipe"
 * de PruebaFiltroMano (temblor, espejos, tamaños mal) y además lo que pasa de
 * verdad cuando la mano se ve de canto o de punta: la red da dedos cualquiera
 * (hasta 35 % de las imágenes).
 *
 * Tiene que: no dar vuelta el arma (ningún cuadro con el caño a más de 45° o
 * la corredera a más de 60° de la verdad, fuera del atraso normal), y no
 * soltarla (la pistola no se va de la mano mientras la mano sigue empuñando).
 */
public class PruebaGiro360 {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static final float F = 500, LAT = 0.06f, K_REAL = 1.08f;
    static final float TX = 0.05f, TY = -0.10f, TZ = -0.42f, YAW = 0.25f, PITCH = -1.45f;

    /** Matriz 3×3 (por filas) de girar a radianes alrededor del eje e (unitario). */
    static float[] ejeAngulo(float[] e, float a) {
        float c = (float) Math.cos(a), s = (float) Math.sin(a), t = 1 - c, x = e[0], y = e[1], z = e[2];
        return new float[]{t * x * x + c, t * x * y - s * z, t * x * z + s * y,
                t * x * y + s * z, t * y * y + c, t * y * z - s * x,
                t * x * z - s * y, t * y * z + s * x, t * z * z + c};
    }

    static float[] mulM(float[] a, float[] b) {
        float[] o = new float[9];
        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) for (int k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
        return o;
    }

    /** Una pose de la cámara (4×4 por columnas): girada yaw alrededor de Y, en el origen. */
    static float[] camara(float yaw) {
        float c = (float) Math.cos(yaw), s = (float) Math.sin(yaw);
        return new float[]{c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1};
    }

    /** Un momento: la mano en la cámara (R extra sobre la pose de empuñar, alrededor del centro de la palma) y la cámara. */
    static final class Escena {
        PruebaFiltroMano.Momento m;
        float[] cam;
    }

    interface Mov { Escena en(float t); }

    static float[] centroPalma0;

    static PruebaFiltroMano.Momento momento(float[] Rx) {
        PruebaFiltroMano.Momento m0 = PruebaFiltroMano.momento(0, YAW, PITCH, TX, TY, TZ);
        PruebaFiltroMano.Momento m = new PruebaFiltroMano.Momento();
        float[] c = centroPalma0;
        for (int i = 0; i < 21; i++) {
            float x = m0.gl[i][0] - c[0], y = m0.gl[i][1] - c[1], z = m0.gl[i][2] - c[2];
            m.gl[i][0] = c[0] + Rx[0] * x + Rx[1] * y + Rx[2] * z;
            m.gl[i][1] = c[1] + Rx[3] * x + Rx[4] * y + Rx[5] * z;
            m.gl[i][2] = c[2] + Rx[6] * x + Rx[7] * y + Rx[8] * z;
            // lo que "ve" el modelo: la forma girada (OpenGL → modelo), sin el tamaño real
            float gx = (m.gl[i][0] - c[0]) / K_REAL, gy = (m.gl[i][1] - c[1]) / K_REAL, gz = (m.gl[i][2] - c[2]) / K_REAL;
            m.mpRot[i][0] = gx; m.mpRot[i][1] = -gy; m.mpRot[i][2] = -gz;
        }
        return m;
    }

    /** La pistola verdadera en el mundo. */
    static void verdad(Escena e, float[] p, float[] f, float[] u) {
        Mano v = new Mano();
        for (int i = 0; i < 21; i++) {
            float[] g = e.m.gl[i], P = e.cam;
            v.mundo[i][0] = P[0] * g[0] + P[4] * g[1] + P[8] * g[2] + P[12];
            v.mundo[i][1] = P[1] * g[0] + P[5] * g[1] + P[9] * g[2] + P[13];
            v.mundo[i][2] = P[2] * g[0] + P[6] * g[1] + P[10] * g[2] + P[14];
        }
        v.medirPistola(p, f, u);
    }

    /** Cuánto se ve la mano de canto o de punta (0 = de frente, 1 = de canto): la red se equivoca más. */
    static float deCanto(PruebaFiltroMano.Momento m) {
        float[] a = m.gl[5], b = m.gl[17], w = m.gl[0], k = m.gl[9];
        float ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = k[0] - w[0], vy = k[1] - w[1], vz = k[2] - w[2];
        float nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        float nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
        float cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, cz = (a[2] + b[2]) / 2, cl = (float) Math.sqrt(cx * cx + cy * cy + cz * cz);
        float d = Math.abs(nx * cx + ny * cy + nz * cz) / (nl * cl);   // |normal · rayo|: 1 = de frente
        return 1 - d;
    }

    static int malas;

    /** La mano "abierta" que da la red por error: cada dedo estirado, derecho desde su nudillo. */
    static void abrir(float[][] w) {
        for (int n : new int[]{5, 9, 13, 17}) {
            float dx = w[n][0] - w[0][0], dy = w[n][1] - w[0][1], dz = w[n][2] - w[0][2];
            float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            float largo = 0;
            for (int j = 1; j <= 3; j++) {
                largo += PruebaFiltroMano.dist(PruebaFiltroMano.forma[n + j - 1], PruebaFiltroMano.forma[n + j]);
                for (int k = 0; k < 3; k++) w[n + j][k] = w[n][k] + (k == 0 ? dx : k == 1 ? dy : dz) / l * largo;
            }
        }
    }

    static final class Res {
        int n, vueltas, sinArma, sinArmaAntes, empezo;
        float maxF, maxU;
        double sumF;
    }

    static Res correr(Mov mov, float dur, long semilla) {
        Random r = new Random(semilla);
        Mano m = new Mano();
        Res res = new Res();
        float proxImagen = 0;
        java.util.ArrayDeque<Object[]> enCamino = new java.util.ArrayDeque<>();
        float[] vp = new float[3], vf = new float[3], vu = new float[3];
        float[] vf0 = new float[3], vu0 = new float[3], p0 = new float[3];
        long base = 3_000_000L + semilla * 100_000L;
        float tAnt = 0;
        boolean empuno = false;
        for (float t = 0; t < dur; t += 1 / 60f) {
            while (proxImagen <= t) {
                Escena e = mov.en(proxImagen);
                PruebaFiltroMano.Medida d = PruebaFiltroMano.medir(e.m, r);
                // de canto o de punta, la red da los dedos cualquiera (los de la palma los sigue viendo)
                // (siempre un 10 %; de canto, hasta 45 %): la mitad de las veces dedos con ruido, la otra
                // mitad la mano "abierta" (los dedos estirados), que es lo peor: parece recargar
                float pc = 0.10f + 0.35f * Math.max(0, (deCanto(e.m) - 0.5f) / 0.5f);
                if (r.nextFloat() < pc) {
                    if (r.nextBoolean()) for (int i = 6; i < 21; i++) {
                        if (i == 9 || i == 13 || i == 17) continue;
                        for (int k = 0; k < 3; k++) d.mp[i][k] += (float) r.nextGaussian() * 0.03f;
                    } else abrir(d.mp);
                    malas++;
                }
                enCamino.add(new Object[]{proxImagen, d, e.cam});
                proxImagen += 1 / 30f;
            }
            while (!enCamino.isEmpty() && (float) enCamino.peek()[0] + LAT <= t) {
                Object[] o = enCamino.poll();
                float tc = (float) o[0];
                PruebaFiltroMano.Medida d = (PruebaFiltroMano.Medida) o[1];
                long ms = base + Math.round(tc * 1000), llega = base + Math.round((tc + LAT) * 1000);
                if (m.aMundo2(d.img640, d.mp, 640, 480, F, F, 320, 240, d.prof3, (float[]) o[2], ms, llega, false)) m.gesto2(ms);
            }
            m.salida(base + Math.round(t * 1000), t - tAnt);
            tAnt = t;
            if (t < 1.2f) continue;
            boolean conArma = m.hay && m.filtro.visible && m.agarrada;
            boolean conArmaAntes = m.hay && m.filtro.visible && (m.pose == Mano.EMPUNA || m.pose == Mano.APRIETA);
            if (!empuno && conArma) empuno = true;
            if (!empuno) continue;
            res.n++;
            if (!conArma) res.sinArma++;
            if (!conArmaAntes) res.sinArmaAntes++;
            // contra la verdad de hace un rato (la foto tarda; el adelanto no es perfecto): la más parecida de los últimos 150 ms
            float mejorF = 999, mejorU = 999;
            for (float dt = 0; dt <= 0.15f; dt += 0.025f) {
                verdad(mov.en(Math.max(0, t - dt)), vp, vf, vu);
                float ef = PruebaFiltroMano.angulo(m.adelante, vf), eu = PruebaFiltroMano.angulo(m.arriba, vu);
                if (ef + eu < mejorF + mejorU) { mejorF = ef; mejorU = eu; }
            }
            res.sumF += mejorF * mejorF;
            res.maxF = Math.max(res.maxF, mejorF); res.maxU = Math.max(res.maxU, mejorU);
            if (mejorF > 45 || mejorU > 60) res.vueltas++;
        }
        return res;
    }

    static void informe(String nombre, Mov mov, float dur) {
        Res peor = null;
        int vueltas = 0, sin = 0, sinAntes = 0, n = 0;
        malas = 0;
        for (long s = 1; s <= 3; s++) {
            Res r = correr(mov, dur, s);
            vueltas += r.vueltas; sin += r.sinArma; sinAntes += r.sinArmaAntes; n += r.n;
            if (peor == null || r.maxF > peor.maxF) peor = r;
        }
        System.out.printf(Locale.ROOT, "%-34s (%d imágenes malas) caño a %.1f° (peor %.0f°, corredera peor %.0f°) · se dio vuelta %d de %d cuadros · sin arma %.1f %% (antes %.1f %%)%n",
                nombre, malas, Math.sqrt(peor.sumF / Math.max(1, peor.n)), peor.maxF, peor.maxU, vueltas, n, 100f * sin / n, 100f * sinAntes / n);
        ver(vueltas == 0, nombre + ": el arma nunca se da vuelta (" + vueltas + " cuadros)");
        ver(sin <= n * 0.01f, String.format(Locale.ROOT, "%s: el arma no se suelta (%.1f %% de los cuadros sin arma; antes %.1f %%)", nombre, 100f * sin / n, 100f * sinAntes / n));
    }

    public static void main(String[] a) throws Exception {
        PruebaMano.cargar();
        PruebaFiltroMano.forma = PruebaMano.fotos.get("pointing_up").mundo;
        PruebaFiltroMano.Momento m0 = PruebaFiltroMano.momento(0, YAW, PITCH, TX, TY, TZ);
        centroPalma0 = new float[3];
        for (int i : new int[]{0, 5, 9, 13, 17}) for (int k = 0; k < 3; k++) centroPalma0[k] += m0.gl[i][k] / 5;
        // los ejes del arma al empuñar (en la cámara)
        Escena e0 = new Escena();
        e0.m = m0; e0.cam = camara(0);
        float[] p = new float[3], f = new float[3], u = new float[3];
        verdad(e0, p, f, u);
        final float[] cano = f.clone();
        final float[] lado = {f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]};
        final float[] vertical = {0, 1, 0};
        System.out.printf(Locale.ROOT, "el caño al empuñar: (%.2f %.2f %.2f)%n", f[0], f[1], f[2]);

        // 1) la muñeca da una vuelta entera alrededor del caño (90°/s), y vuelve
        informe("muñeca 360° alrededor del caño", t -> {
            Escena e = new Escena();
            float ang = (float) (2 * Math.PI * Math.min(t, 4) / 4) - (t > 4 ? (float) (2 * Math.PI * Math.min(t - 4, 4) / 4) : 0);
            e.m = momento(ejeAngulo(cano, ang)); e.cam = camara(0);
            return e;
        }, 8.5f);
        // 2) apuntar al techo y al piso (de −85° a +85°, ida y vuelta)
        informe("del piso al techo", t -> {
            Escena e = new Escena();
            e.m = momento(ejeAngulo(lado, 1.48f * (float) Math.sin(2 * Math.PI * t / 5))); e.cam = camara(0);
            return e;
        }, 10.5f);
        // 3) de un costado al otro (±100°: la mano se ve de canto y de punta)
        informe("de costado a costado (±100°)", t -> {
            Escena e = new Escena();
            e.m = momento(ejeAngulo(vertical, 1.75f * (float) Math.sin(2 * Math.PI * t / 5))); e.cam = camara(0);
            return e;
        }, 10.5f);
        // 4) vos das una vuelta entera (180°/s) con el arma adelante
        informe("vos das una vuelta entera", t -> {
            Escena e = new Escena();
            e.m = momento(ejeAngulo(vertical, 0)); e.cam = camara((float) (Math.PI * Math.max(0, t - 1.5f)));
            return e;
        }, 7.5f);
        // 5) todo junto: girando la muñeca y apuntando a todos lados mientras das vueltas
        informe("todo junto", t -> {
            Escena e = new Escena();
            float[] R = mulM(ejeAngulo(vertical, 0.9f * (float) Math.sin(t * 1.3)), mulM(ejeAngulo(lado, 0.8f * (float) Math.sin(t * 0.9)),
                    ejeAngulo(cano, 1.4f * (float) Math.sin(t * 1.7))));
            e.m = momento(R); e.cam = camara((float) (1.2 * t));
            return e;
        }, 12f);

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
