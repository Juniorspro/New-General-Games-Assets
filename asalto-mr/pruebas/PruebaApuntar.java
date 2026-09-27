import com.juniorspro.asaltomr.Mano;
import com.juniorspro.asaltomr.Punteria;

import java.util.Locale;
import java.util.Random;

/**
 * APUNTAR ADELANTE (lo que se veía mal en el teléfono: la mano apuntando al
 * fondo de la pieza y el arma de costado).
 *
 * La cámara está detrás de la mano: apuntar adelante es apuntar a lo largo del
 * rayo de la cámara, justo el eje que MediaPipe mide peor (la profundidad de
 * cada punto sale de la forma del modelo, y el modelo la achata: acá, a la
 * mitad, más su ruido). Con la mano achatada, "de la muñeca a los nudillos"
 * queda de costado.
 *
 * Se apunta a 9 direcciones (adelante, a los costados, arriba, abajo) como
 * apunta la gente: el ojo, la mano y el blanco en línea (cada persona con el
 * arma un poco más abajo y al costado de la vista, a su manera), con la mano a
 * 40 cm y a la vista de la cámara, y se mide cuánto le erra el caño:
 *  - con la muñeca (la forma de la mano, como antes);
 *  - con el rayo del punto de mira por la mano (Punteria), sin calibrar y
 *    calibrado con 3 botones del menú.
 */
public class PruebaApuntar {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static boolean DEPURAR = System.getenv("DEPURAR") != null;
    static final float F = 500, LAT = 0.06f, K_REAL = 1.08f, ACHATA = 0.5f;

    static float[] norm(float[] v) {
        float l = (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return new float[]{v[0] / l, v[1] / l, v[2] / l};
    }

    static float[] cruz(float[] a, float[] b) { return new float[]{a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }

    /** La mano verdadera: empuñando, con el caño hacia dir y la corredera para arriba, la palma en c (cámara OpenGL). */
    static PruebaFiltroMano.Momento mano(float[] dir, float[] c) {
        PruebaFiltroMano.Momento m0 = PruebaFiltroMano.momento(0, PruebaGiro360.YAW, PruebaGiro360.PITCH, 0, 0, 0);
        // los ejes del arma de esa mano, y los que se quieren
        Mano v = new Mano();
        for (int i = 0; i < 21; i++) System.arraycopy(m0.gl[i], 0, v.mundo[i], 0, 3);
        float[] p = new float[3], f = new float[3], u = new float[3];
        v.medirPistola(p, f, u);
        float[] r = cruz(f, u);
        float[] F2 = norm(dir), R2 = norm(cruz(F2, new float[]{0, 1, 0})), U2 = cruz(R2, F2);
        // R = [F2 U2 R2] · [f u r]ᵀ
        float[] Rm = new float[9];
        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) Rm[i * 3 + j] = F2[i] * f[j] + U2[i] * u[j] + R2[i] * r[j];
        float[] c0 = new float[3];
        for (int i : new int[]{0, 5, 9, 13, 17}) for (int k = 0; k < 3; k++) c0[k] += m0.gl[i][k] / 5;
        PruebaFiltroMano.Momento m = new PruebaFiltroMano.Momento();
        for (int i = 0; i < 21; i++) {
            float x = m0.gl[i][0] - c0[0], y = m0.gl[i][1] - c0[1], z = m0.gl[i][2] - c0[2];
            float gx = Rm[0] * x + Rm[1] * y + Rm[2] * z, gy = Rm[3] * x + Rm[4] * y + Rm[5] * z, gz = Rm[6] * x + Rm[7] * y + Rm[8] * z;
            m.gl[i][0] = c[0] + gx; m.gl[i][1] = c[1] + gy; m.gl[i][2] = c[2] + gz;
            m.mpRot[i][0] = gx / K_REAL; m.mpRot[i][1] = -gy / K_REAL; m.mpRot[i][2] = -gz / K_REAL;
        }
        return m;
    }

    static final float[] IDENT = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};

    /** Una persona: dónde tiene el arma respecto de la vista (el punto de mira de verdad). */
    static final class Persona {
        final String nombre;
        final float abajo, lado;
        Persona(String n, float a, float l) { nombre = n; abajo = a; lado = l; }
    }

    /** ¿La mano se ve? (el centro de la palma adentro de la foto, con margen) */
    static boolean seVe(float[] c) {
        if (c[2] > -0.1f) return false;
        float u = 320 + F * c[0] / -c[2], v = 240 - F * c[1] / -c[2];
        return u > 60 && u < 580 && v > 50 && v < 430;
    }

    /** Dónde va la mano para apuntar a dir: 40 cm desde el punto de mira de esa persona. */
    static float[] manoPara(Persona pe, float[] d) {
        Punteria verdad = new Punteria();
        verdad.abajo = pe.abajo; verdad.lado = pe.lado;
        float[] o = new float[3];
        verdad.origen(0, 0, 0, 0, 0, -1, o);
        return new float[]{o[0] + d[0] * 0.4f, o[1] + d[1] * 0.4f, o[2] + d[2] * 0.4f};
    }

    /**
     * Apunta 3 s a dir (con un poco de temblor); modo 0 = muñeca, 1 = rayo con pu.
     * Devuelve el error medio del caño (grados) en el último segundo y medio.
     * calibrarA: si no es null, al final se calibra pu como si se hubiera elegido un botón en calibrarA.
     */
    static float apuntar(Persona pe, float[] dir, int modo, Punteria pu, boolean achatar, long semilla, float[] calibrarA) {
        Random r = new Random(semilla);
        float[] d = norm(dir), c0 = manoPara(pe, d), o = new float[3];
        Mano m = new Mano();
        long base = 7_000_000L + semilla * 1000;
        double suma = 0;
        int n = 0;
        java.util.ArrayDeque<Object[]> enCamino = new java.util.ArrayDeque<>();
        float prox = 0;
        for (float t = 0; t < 3f; t += 1 / 60f) {
            while (prox <= t) {
                float w = 0.004f * (float) Math.sin(prox * 2.1), w2 = 0.003f * (float) Math.cos(prox * 1.7);
                float[] c = {c0[0] + w, c0[1] + w2, c0[2]};
                PruebaFiltroMano.Medida me = PruebaFiltroMano.medir(mano(d, c), r);
                if (achatar) {
                    float zc = 0;
                    for (int i = 0; i < 21; i++) zc += me.mp[i][2] / 21;
                    for (int i = 0; i < 21; i++) me.mp[i][2] = zc + (me.mp[i][2] - zc) * ACHATA + (float) r.nextGaussian() * 0.004f;
                }
                enCamino.add(new Object[]{prox, me});
                prox += 1 / 30f;
            }
            while (!enCamino.isEmpty() && (float) enCamino.peek()[0] + LAT <= t) {
                Object[] ob = enCamino.poll();
                float tc = (float) ob[0];
                PruebaFiltroMano.Medida me = (PruebaFiltroMano.Medida) ob[1];
                long ms = base + Math.round(tc * 1000);
                if (m.aMundo2(me.img640, me.mp, 640, 480, F, F, 320, 240, me.prof3, IDENT, ms, ms + Math.round(LAT * 1000), false)) m.gesto2(ms);
            }
            m.salida(base + Math.round(t * 1000), 1 / 60f);
            if (modo == 1) { pu.origen(0, 0, 0, 0, 0, -1, o); m.apuntarDesde(o); }
            if (t < 1.5f) continue;
            suma += PruebaFiltroMano.angulo(m.adelante, d);
            n++;
        }
        if (calibrarA != null) pu.calibrar(0, 0, 0, 0, 0, -1, m.pos, calibrarA);
        return (float) (suma / n);
    }

    public static void main(String[] a) throws Exception {
        PruebaMano.cargar();
        PruebaFiltroMano.forma = PruebaMano.fotos.get("pointing_up").mundo;
        float[][] dirs = {{0, 0, -1}, {-0.25f, 0, -1}, {0.25f, 0, -1}, {0, 0.18f, -1}, {0, -0.18f, -1}, {-0.2f, 0.15f, -1}, {0.2f, 0.15f, -1},
                {-0.2f, -0.15f, -1}, {0.2f, -0.15f, -1}};
        String[] nombres = {"adelante", "izquierda", "derecha", "arriba", "abajo", "arriba-izq", "arriba-der", "abajo-izq", "abajo-der"};
        // el que apunta con la mira (el arma justo debajo de la vista) y el de la captura (la mano abajo y a la derecha)
        Persona[] personas = {new Persona("con la mira", 0.06f, 0.02f), new Persona("la mano baja (como en la captura)", 0.17f, 0.06f)};
        float peorCal = 0, sumM = 0, sumCal = 0;
        int nd = 0;
        for (Persona pe : personas) {
            System.out.println(pe.nombre + String.format(Locale.ROOT, " (%.0f cm abajo de la vista, %.0f cm al costado):", pe.abajo * 100, pe.lado * 100));
            // calibrar: tres botones del menú (a 1.35 m, como el menú)
            Punteria cal = new Punteria();
            float[][] botones = {{0, -0.1f, -1}, {0.12f, -0.02f, -1}, {-0.1f, -0.18f, -1}};
            Punteria verdad = new Punteria();
            verdad.abajo = pe.abajo; verdad.lado = pe.lado;
            float[] ov = new float[3];
            verdad.origen(0, 0, 0, 0, 0, -1, ov);
            for (int b = 0; b < botones.length; b++) {
                float[] db = norm(botones[b]);
                float[] t = {ov[0] + db[0] * 1.35f, ov[1] + db[1] * 1.35f, ov[2] + db[2] * 1.35f};
                apuntar(pe, db, 1, cal, true, 50 + b, t);
            }
            System.out.printf(Locale.ROOT, "  calibrado con 3 botones: %.1f cm abajo, %.1f cm al costado (de verdad %.0f y %.0f)%n", cal.abajo * 100, cal.lado * 100, pe.abajo * 100, pe.lado * 100);
            ver(Math.abs(cal.abajo - pe.abajo) < 0.02f && Math.abs(cal.lado - pe.lado) < 0.02f, "  la calibración encuentra dónde tiene el arma (a menos de 2 cm)");
            for (int k = 0; k < dirs.length; k++) {
                float[] d = norm(dirs[k]);
                if (!seVe(manoPara(pe, d))) { System.out.printf(Locale.ROOT, "    %-11s (la mano no se ve: no se puede)%n", nombres[k]); continue; }
                float muneca = 0, sinCal = 0, conCal = 0;
                for (long s = 1; s <= 3; s++) {
                    muneca += apuntar(pe, dirs[k], 0, null, true, s, null) / 3;
                    sinCal += apuntar(pe, dirs[k], 1, new Punteria(), true, s, null) / 3;
                    conCal += apuntar(pe, dirs[k], 1, cal, true, s, null) / 3;
                }
                System.out.printf(Locale.ROOT, "    %-11s con la muñeca %5.1f° · rayo sin calibrar %4.1f° · calibrado %4.1f°%n", nombres[k], muneca, sinCal, conCal);
                peorCal = Math.max(peorCal, conCal);
                sumM += muneca; sumCal += conCal; nd++;
                if (k == 0) ver(conCal < 2f, String.format(Locale.ROOT, "  ADELANTE: el caño va adelante (%.1f°; con la muñeca %.1f°)", conCal, muneca));
            }
        }
        sumM /= nd; sumCal /= nd;
        System.out.printf(Locale.ROOT, "apuntando (la red achata la mano a la mitad): con la muñeca %.1f° → calibrado %.1f° (peor %.1f°)%n", sumM, sumCal, peorCal);
        ver(peorCal < 3f, String.format(Locale.ROOT, "a cualquier lado que se vea, a menos de 3° (peor %.1f°)", peorCal));
        ver(sumCal < sumM / 5, String.format(Locale.ROOT, "erra menos de la quinta parte que con la muñeca (%.1f° contra %.1f°)", sumCal, sumM));
        // guardar y cargar la calibración
        Punteria g = new Punteria(), h = new Punteria();
        g.abajo = 0.15f; g.lado = -0.03f;
        h.cargar(g.guardar());
        ver(Math.abs(h.abajo - 0.15f) < 1e-3f && Math.abs(h.lado + 0.03f) < 1e-3f, "la calibración se guarda (" + g.guardar() + ")");
        h.cargar("9,9,9");
        ver(Math.abs(h.abajo - 0.15f) < 1e-3f, "una guardada rota no se usa");

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
