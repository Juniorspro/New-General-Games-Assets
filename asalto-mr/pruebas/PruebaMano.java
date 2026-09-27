import com.juniorspro.asaltomr.Mano;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

/**
 * La mano con la pistola, con manos REALES: los puntos que dio el modelo de
 * MediaPipe (hand_landmarker.task, el mismo que va en el APK) sobre fotos de
 * prueba públicas (pruebas/manos.txt, sale de pruebas/manos-extraer.py).
 *
 * Se prueba: qué pose es cada foto, que apretar el gatillo dispara una vez (y
 * el temblor no), que agarrar de golpe no dispara, la reconstrucción en 3D
 * (dónde está la mano) y que la pistola no se mueve al apretar el gatillo.
 */
public class PruebaMano {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static final class Foto {
        String nombre; int w, h; float[][] img = new float[21][3], mundo = new float[21][3];
    }

    static HashMap<String, Foto> fotos = new HashMap<>();
    static HashMap<String, Integer> cuenta = new HashMap<>();

    static void cargar() throws Exception {
        cargar("pruebas/manos.txt");
        cargar("pruebas/manos-commons.txt");
    }

    static void cargar(String archivo) throws Exception {
        List<String> ls = Files.readAllLines(Paths.get(archivo));
        for (String l : ls) {
            if (l.startsWith("#") || l.trim().isEmpty()) continue;
            String[] t = l.trim().split(" ");
            Foto f = new Foto();
            f.nombre = t[0]; f.w = Integer.parseInt(t[1]); f.h = Integer.parseInt(t[2]);
            for (int i = 0; i < 21; i++) for (int k = 0; k < 3; k++) {
                f.img[i][k] = Float.parseFloat(t[3 + i * 3 + k]);
                f.mundo[i][k] = Float.parseFloat(t[3 + 63 + i * 3 + k]);
            }
            int n = cuenta.merge(f.nombre, 1, Integer::sum);
            fotos.put(f.nombre + (n > 1 ? "#" + n : ""), f);
        }
    }

    static float[][] copia(float[][] a) {
        float[][] b = new float[a.length][];
        for (int i = 0; i < a.length; i++) b[i] = a[i].clone();
        return b;
    }

    static float[][] ruido(float[][] a, Random r, float sigma) {
        float[][] b = copia(a);
        for (float[] p : b) for (int k = 0; k < 3; k++) p[k] += (float) r.nextGaussian() * sigma;
        return b;
    }

    /** Rota p alrededor del eje (unitario) e que pasa por o, en ang radianes (Rodrigues). */
    static void rotar(float[] p, float[] o, float[] e, float ang) {
        float x = p[0] - o[0], y = p[1] - o[1], z = p[2] - o[2];
        float c = (float) Math.cos(ang), s = (float) Math.sin(ang), d = x * e[0] + y * e[1] + z * e[2];
        float cx = e[1] * z - e[2] * y, cy = e[2] * x - e[0] * z, cz = e[0] * y - e[1] * x;
        p[0] = o[0] + x * c + cx * s + e[0] * d * (1 - c);
        p[1] = o[1] + y * c + cy * s + e[1] * d * (1 - c);
        p[2] = o[2] + z * c + cz * s + e[2] * d * (1 - c);
    }

    /**
     * El índice de una mano real, doblado "total" radianes (repartido en sus 3
     * articulaciones), hacia la palma: como apretar el gatillo.
     */
    static float[][] doblarIndice(float[][] base, float total) {
        float[][] best = null;
        float bestD = Float.MAX_VALUE;
        for (int signo = -1; signo <= 1; signo += 2) {
            float[][] w = copia(base);
            float[] k = {w[5][0] - w[17][0], w[5][1] - w[17][1], w[5][2] - w[17][2]};
            float kl = (float) Math.sqrt(k[0] * k[0] + k[1] * k[1] + k[2] * k[2]);
            for (int q = 0; q < 3; q++) k[q] /= kl;
            float[] reparto = {0.4f, 0.35f, 0.25f};
            for (int j = 0; j < 3; j++) {
                float[] o = w[5 + j].clone();
                for (int m = 6 + j; m <= 8; m++) rotar(w[m], o, k, signo * total * reparto[j]);
            }
            // hacia la palma = la punta termina más cerca de la muñeca
            float d = dist(w[8], w[0]);
            if (d < bestD) { bestD = d; best = w; }
        }
        return best;
    }

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    public static void main(String[] a) throws Exception {
        cargar();
        System.out.println(fotos.size() + " manos reales cargadas");

        // 1) la pose de cada foto
        String[][] esperado = {{"fist", "aprieta"}, {"thumb_up", "aprieta"}, {"pointing_up", "empuña"}, {"pointing_up_rotated", "empuña"},
                {"victory", "otra"}, {"right_hands", "abierta"}, {"right_hands#2", "abierta"}, {"woman_hands", "abierta"}, {"woman_hands#2", "abierta"}};
        for (String[] e : esperado) {
            Mano m = new Mano();
            int p = m.clasificar(fotos.get(e[0]).mundo);
            ver(Mano.NOMBRES[p].equals(e[1]), String.format("%-20s → %-8s (índice %3.0f°, medio %3.0f°, anular %3.0f°, meñique %3.0f°)",
                    e[0], Mano.NOMBRES[p], m.curlIndice, m.curlMedio, m.curlAnular, m.curlMenique));
        }

        // 1b) fotos libres de Wikimedia Commons: agarres reales, de costado, apuntando a la cámara
        String[][] commons = {{"424TH_Air_Base_Squadron_on_ran", "empuña|aprieta", "una soldado apuntando una pistola real (mano chica, de costado)"},
                {"Closed_fist", "aprieta", "puño cerrado"}, {"Open_fist", "aprieta", "puño"},
                {"Hand_in_closed_fist_black_back", "empuña|aprieta", "puño visto de costado"},
                {"Pedja_Pavlovic_Badza_pointing_", "empuña", "el índice apuntando A LA CÁMARA (escorzo)"},
                {"Fresh_and_ripe_strawberry_rest", "abierta|otra", "la mano sosteniendo una frutilla (no es empuñar)"},
                {"Open_Palm_of_the_Left_Hand_Fin", "abierta", "palma abierta"}, {"Right_Hand_Palm", "abierta", "palma abierta"}};
        for (String[] c : commons) {
            Foto f = fotos.get(c[0]);
            if (f == null) { ver(false, "falta la foto " + c[0]); continue; }
            Mano m = new Mano();
            String p = Mano.NOMBRES[m.clasificar(f.mundo)];
            ver(("|" + c[1] + "|").contains("|" + p + "|"), String.format("%-45s → %s", c[2], p));
        }
        // girar la mano a cualquier lado no cambia nada (sólo se usan distancias)
        {
            Random r = new Random(9);
            int mal = 0, total = 0;
            for (Foto f : fotos.values()) {
                int clase = new Mano().clasificar(f.mundo);
                for (int k = 0; k < 200; k++) {
                    float[] e = {(float) r.nextGaussian(), (float) r.nextGaussian(), (float) r.nextGaussian()};
                    float el = (float) Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
                    for (int q = 0; q < 3; q++) e[q] /= el;
                    float[][] g = copia(f.mundo);
                    float ang = r.nextFloat() * 6.2832f;
                    for (float[] pt : g) rotar(pt, new float[]{0, 0, 0}, e, ang);
                    total++;
                    if (new Mano().clasificar(g) != clase) mal++;
                }
            }
            ver(mal == 0, "girando cada mano real 200 veces al azar, la pose es siempre la misma (" + mal + " de " + total + " distintas)");
        }

        // 2) el gatillo con fotos reales: apuntar (índice estirado) → puño (índice cerrado) = un tiro
        {
            Mano m = new Mano();
            String[] seq = {"pointing_up", "pointing_up", "pointing_up", "fist", "fist", "fist", "pointing_up", "pointing_up", "fist", "fist",
                    "pointing_up_rotated", "pointing_up_rotated", "thumb_up", "thumb_up"};
            int tiros = 0;
            long ms = 0;
            for (String s : seq) { if (m.gesto(fotos.get(s).mundo, ms)) tiros++; ms += 33; }
            ver(tiros == 3, "empuñando, cada vez que se cierra el índice sale un tiro (3 de 3: " + tiros + ")");
            Mano g = new Mano();
            int t2 = 0;
            ms = 0;
            for (String s : new String[]{"right_hands", "right_hands", "fist", "fist", "fist"}) { if (g.gesto(fotos.get(s).mundo, ms)) t2++; ms += 33; }
            ver(t2 == 0, "cerrar la mano abierta de golpe (agarrar) no dispara");
            Mano v = new Mano();
            int t3 = 0;
            for (int i = 0; i < 20; i++) if (v.gesto(fotos.get("victory").mundo, i * 33)) t3++;
            ver(t3 == 0, "con la V no dispara");
            // de costado: el puño visto de lado da 1.36 palmas (el umbral fijo 1.25 no dispararía); adaptado, sí
            Mano c = new Mano();
            int t4 = 0;
            ms = 0;
            for (String s : new String[]{"pointing_up", "pointing_up", "pointing_up", "Hand_in_closed_fist_black_back", "Hand_in_closed_fist_black_back", "Hand_in_closed_fist_black_back"}) { if (c.gesto(fotos.get(s).mundo, ms)) t4++; ms += 33; }
            ver(t4 == 1, "apretar el gatillo con la mano vista de costado también dispara (" + t4 + ")");
            // apuntando a la cámara (escorzo) → puño
            Mano pc = new Mano();
            int t5 = 0;
            ms = 0;
            for (String s : new String[]{"Pedja_Pavlovic_Badza_pointing_", "Pedja_Pavlovic_Badza_pointing_", "Pedja_Pavlovic_Badza_pointing_", "Closed_fist", "Closed_fist"}) { if (pc.gesto(fotos.get(s).mundo, ms)) t5++; ms += 33; }
            ver(t5 == 1, "con el índice apuntando a la cámara, apretar dispara (" + t5 + ")");
        }

        // 3) gatillo sintético sobre una mano real: el índice se dobla de a poco, con temblor de 3 mm
        {
            Random r = new Random(5);
            float[][] base = fotos.get("pointing_up").mundo;
            Mano m = new Mano();
            int tiros = 0;
            long ms = 0;
            float[] alc = new float[5];
            for (int j = 0; j < 5; j++) { Mano q = new Mano(); q.clasificar(doblarIndice(base, j * 1.1f)); alc[j] = q.alcance; }
            System.out.printf("índice doblado 0 / 1.1 / 2.2 / 3.3 / 4.4 rad → punta a %.2f %.2f %.2f %.2f %.2f palmas de la muñeca%n", alc[0], alc[1], alc[2], alc[3], alc[4]);
            for (int ciclo = 0; ciclo < 10; ciclo++) {
                for (int f = 0; f <= 30; f++) {
                    float t = (float) Math.sin(Math.PI * f / 30.0);   // 0 → 1 → 0
                    if (m.gesto(ruido(doblarIndice(base, t * 4.4f), r, 0.003f), ms)) tiros++;
                    ms += 33;
                }
            }
            ver(tiros == 10, "10 veces apretar y soltar, con temblor: 10 tiros (" + tiros + ")");
            // quedarse con el dedo a mitad de camino, temblando, no dispara de más
            Mano q = new Mano();
            int extra = 0;
            for (int f = 0; f < 150; f++) { if (q.gesto(ruido(doblarIndice(base, 2.4f), r, 0.004f), f * 33L)) extra++; }
            ver(extra <= 1, "el dedo quieto a mitad del gatillo, temblando 4 mm, no ametralla (" + extra + " tiros en 5 s)");
            // la pistola no se mueve al apretar
            Mano p0 = new Mano(), p1 = new Mano();
            float[] ident = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
            Foto fo = fotos.get("pointing_up");
            p0.aMundo(fo.img, base, fo.w, fo.h, 500, 500, fo.w / 2f, fo.h / 2f, Float.NaN, ident);
            p0.pistola(1f);
            // (misma imagen de la palma; sólo cambia el índice: la pistola usa muñeca y nudillos)
            for (int i = 0; i < 21; i++) System.arraycopy(p0.mundo[i], 0, p1.mundo[i], 0, 3);
            float[][] doblado = doblarIndice(p0.mundo, 1.8f);
            for (int i = 0; i < 21; i++) System.arraycopy(doblado[i], 0, p1.mundo[i], 0, 3);
            p1.pistola(1f);
            float ang = (float) Math.toDegrees(Math.acos(Math.min(1, p0.adelante[0] * p1.adelante[0] + p0.adelante[1] * p1.adelante[1] + p0.adelante[2] * p1.adelante[2])));
            ver(ang < 1f, String.format("al apretar el gatillo la pistola no se mueve (%.2f°)", ang));
            // y apunta para donde apunta el índice estirado
            float ix = p0.mundo[8][0] - p0.mundo[5][0], iy = p0.mundo[8][1] - p0.mundo[5][1], iz = p0.mundo[8][2] - p0.mundo[5][2];
            float il = (float) Math.sqrt(ix * ix + iy * iy + iz * iz);
            float ai = (float) Math.toDegrees(Math.acos((ix * p0.adelante[0] + iy * p0.adelante[1] + iz * p0.adelante[2]) / il));
            ver(ai < 30f, String.format("el caño apunta como el índice estirado (a %.0f°)", ai));
        }

        // 3b) el filtro One Euro: quieta no tiembla, moviéndose no se atrasa
        {
            Foto fo = fotos.get("pointing_up");
            float[] ident = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
            Random r = new Random(4);
            Mano m = new Mano();
            double sumaCruda = 0, sumaFiltro = 0;
            int n = 0;
            float[] ref = null;
            for (int f = 0; f < 90; f++) {
                m.aMundo(fo.img, fo.mundo, fo.w, fo.h, 500, 500, fo.w / 2f, fo.h / 2f, Float.NaN, ident);
                if (ref == null) { float[] p = new float[3]; m.medirPistola(p, new float[3], new float[3]); ref = p; }
                for (float[] pt : m.mundo) for (int k = 0; k < 3; k++) pt[k] += (float) r.nextGaussian() * 0.005f;   // 5 mm de temblor
                float[] cruda = new float[3];
                m.medirPistola(cruda, new float[3], new float[3]);
                m.pistolaFiltrada(f * 33L);
                if (f > 20) {
                    sumaCruda += dist(cruda, ref); sumaFiltro += dist(m.pos, ref); n++;
                }
            }
            System.out.printf("One Euro quieta: temblor %.1f mm crudo → %.1f mm filtrado%n", sumaCruda / n * 1000, sumaFiltro / n * 1000);
            ver(sumaFiltro < sumaCruda * 0.6, "quieta, el filtro saca más de 40 % del temblor");
            // moviéndose a 1 m/s: el retraso
            Mano mv = new Mano();
            float atraso = 0;
            for (int f = 0; f < 60; f++) {
                mv.aMundo(fo.img, fo.mundo, fo.w, fo.h, 500, 500, fo.w / 2f, fo.h / 2f, Float.NaN, ident);
                float dx = f * 0.033f;   // 1 m/s de costado
                for (float[] pt : mv.mundo) pt[0] += dx;
                float[] cruda = new float[3];
                mv.medirPistola(cruda, new float[3], new float[3]);
                mv.pistolaFiltrada(f * 33L);
                if (f > 30) atraso = Math.max(atraso, Math.abs(cruda[0] - mv.pos[0]));
            }
            System.out.printf("One Euro a 1 m/s: atraso %.1f cm%n", atraso * 100);
            ver(atraso < 0.03f, "moviéndola rápido, la pistola se atrasa menos de 3 cm");
        }

        // 4) de la foto al mundo: una mano real puesta en un lugar conocido delante de la cámara
        {
            Foto fo = fotos.get("pointing_up");
            final int W = 640, H = 480;
            final float F = 500, CX = 320, CY = 240;
            double sumaErr = 0, maxErr = 0, sumaErrProf = 0;
            int casos = 0;
            Random r = new Random(2);
            for (int caso = 0; caso < 30; caso++) {
                // la mano en metros de MediaPipe (x der, y abajo, z adentro) → OpenGL (x der, y arriba, z afuera)
                float yaw = (r.nextFloat() - 0.5f) * 1.2f, pitch = (r.nextFloat() - 0.5f) * 0.8f;
                float tx = (r.nextFloat() - 0.5f) * 0.3f, ty = (r.nextFloat() - 0.5f) * 0.2f, tz = -(0.3f + r.nextFloat() * 0.4f);
                float[][] real = new float[21][3], img = new float[21][3], mp = new float[21][3];
                float escala = 1f + (float) r.nextGaussian() * 0.1f;
                for (int i = 0; i < 21; i++) {
                    float x = fo.mundo[i][0], y = -fo.mundo[i][1], z = -fo.mundo[i][2];
                    // girar (yaw sobre Y, pitch sobre X) y poner delante de la cámara
                    float x1 = x * (float) Math.cos(yaw) + z * (float) Math.sin(yaw), z1 = -x * (float) Math.sin(yaw) + z * (float) Math.cos(yaw);
                    float y2 = y * (float) Math.cos(pitch) - z1 * (float) Math.sin(pitch), z2 = y * (float) Math.sin(pitch) + z1 * (float) Math.cos(pitch);
                    // lo que diría MediaPipe en metros: la mano girada, con los ejes de la cámara
                    // (con errores como los de verdad: el tamaño ±10 %, y 3 mm de ruido)
                    mp[i][0] = x1 * escala + (float) r.nextGaussian() * 0.003f;
                    mp[i][1] = -y2 * escala + (float) r.nextGaussian() * 0.003f;
                    mp[i][2] = -z2 * escala + (float) r.nextGaussian() * 0.003f;
                    real[i][0] = x1 + tx; real[i][1] = y2 + ty; real[i][2] = z2 + tz;
                    // la foto
                    float zi = -real[i][2];
                    img[i][0] = (CX + F * real[i][0] / zi + (float) r.nextGaussian() * 2f) / W;   // ±2 px
                    img[i][1] = (CY - F * real[i][1] / zi + (float) r.nextGaussian() * 2f) / H;
                }
                // la cámara en algún lugar del mundo
                float cyaw = r.nextFloat() * 6.28f;
                float[] pose = {(float) Math.cos(cyaw), 0, -(float) Math.sin(cyaw), 0, 0, 1, 0, 0, (float) Math.sin(cyaw), 0, (float) Math.cos(cyaw), 0, 1.3f, 1.5f, -2f, 1};
                Mano m = new Mano();
                m.aMundo(img, mp, W, H, F, F, CX, CY, Float.NaN, pose);
                Mano md = new Mano();
                md.aMundo(img, mp, W, H, F, F, CX, CY, -real[9][2] * (1 + (float) r.nextGaussian() * 0.04f), pose);
                for (int i = 0; i < 21; i++) {
                    float[] rc = real[i];
                    float wx = pose[0] * rc[0] + pose[4] * rc[1] + pose[8] * rc[2] + pose[12];
                    float wy = pose[1] * rc[0] + pose[5] * rc[1] + pose[9] * rc[2] + pose[13];
                    float wz = pose[2] * rc[0] + pose[6] * rc[1] + pose[10] * rc[2] + pose[14];
                    float[] v = {wx, wy, wz};
                    double e = dist(m.mundo[i], v), ed = dist(md.mundo[i], v);
                    sumaErr += e; sumaErrProf += ed; maxErr = Math.max(maxErr, e);
                    casos++;
                }
            }
            System.out.printf("3D (tamaño de MediaPipe ±10 %%, 2 px, 3 mm): error medio %.1f mm (máx %.1f) sólo con la imagen · %.1f mm con la profundidad de ARCore (±4 %%)%n",
                    sumaErr / casos * 1000, maxErr * 1000, sumaErrProf / casos * 1000);
            ver(sumaErr / casos < 0.06, "sólo con la imagen, la mano queda a menos de 6 cm (el error es el del tamaño que estima el modelo)");
            ver(sumaErrProf / casos < 0.03, "con la profundidad de ARCore, a menos de 3 cm");
            ver(sumaErrProf < sumaErr, "la profundidad de ARCore mejora la posición");
        }

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
