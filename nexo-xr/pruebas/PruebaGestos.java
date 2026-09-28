import com.juniorspro.nexoxr.DoblePellizco;
import com.juniorspro.nexoxr.Gestos;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Random;

/**
 * Los gestos con manos REALES (los puntos que dio MediaPipe con fotos de
 * prueba: puños, palmas abiertas, apuntando, la V, un pulgar arriba, manos
 * agarrando cosas): ninguna es un pellizco. Y un pellizco hecho con esas
 * mismas manos (el pulgar y el índice juntándose), con temblor: aprieta una
 * vez, no rebota, suelta. Y EL DOBLE PELLIZCO (el clic): uno solo no aprieta,
 * dos rápidos sí (una vez), lentos no, sostenido el primero no.
 */
public class PruebaGestos {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    /** Cuántas veces empieza a apretar el doble pellizco con 'veces' pellizcos seguidos de la mano w0 (con temblor). */
    static int pellizcos(float[][] w0, int veces, Random r) {
        Gestos g = new Gestos();
        DoblePellizco d = new DoblePellizco();
        float[] medio = new float[3];
        for (int k = 0; k < 3; k++) medio[k] = (w0[4][k] + w0[8][k]) / 2;
        // cerrar en 4 imágenes, quedarse 2, abrir en 4; 3 sueltas entre uno y otro; después 1 s quieta
        java.util.ArrayList<Float> s = new java.util.ArrayList<>();
        for (int i = 0; i < 5; i++) s.add(0f);
        for (int v = 0; v < veces; v++) {
            for (int i = 1; i <= 4; i++) s.add(i / 4f);
            s.add(1f); s.add(1f);
            for (int i = 3; i >= 0; i--) s.add(i / 4f);
            for (int i = 0; i < 3; i++) s.add(0f);
        }
        for (int i = 0; i < 30; i++) s.add(0f);
        long ms = 1000;
        int aprietes = 0;
        boolean antes = false;
        for (float x : s) {
            float[][] w = new float[21][];
            for (int j = 0; j < 21; j++) w[j] = w0[j].clone();
            for (int k = 0; k < 3; k++) {
                w[4][k] = w0[4][k] + (medio[k] - w0[4][k]) * x * 0.97f + (float) r.nextGaussian() * 0.003f;
                w[8][k] = w0[8][k] + (medio[k] - w0[8][k]) * x * 0.97f + (float) r.nextGaussian() * 0.003f;
            }
            ms += 33;
            boolean ap = d.paso(g.paso(w), ms);
            if (ap && !antes) aprietes++;
            antes = ap;
        }
        return aprietes;
    }

    /** Una secuencia de pellizcos crudos (1 = pellizcando), una imagen cada 'cada' ms: cuántas veces aprieta y cuántas imágenes. */
    static int[] correr(DoblePellizco d, String sec, long cada) {
        long ms = 5000;
        int veces = 0, imagenes = 0;
        boolean antes = false;
        for (char c : sec.toCharArray()) {
            ms += cada;
            boolean ap = d.paso(c == '1', ms);
            if (ap && !antes) veces++;
            if (ap) imagenes++;
            antes = ap;
        }
        return new int[]{veces, imagenes};
    }

    static void doble() {
        // (una imagen cada 33 ms: 30 por segundo)
        int[] x = correr(new DoblePellizco(), "0000011111000000000000000000000000000000", 33);
        ver(x[0] == 0, "un pellizco solo: no aprieta (queda armado y se desarma)");
        x = correr(new DoblePellizco(), "00000111110000011111000000000000", 33);
        ver(x[0] == 1 && x[1] == 5, "dos rápidos: aprieta una vez, mientras dura el segundo (" + x[0] + " vez, " + x[1] + " imágenes)");
        x = correr(new DoblePellizco(), "0000011111" + "0".repeat(20) + "11111000000", 33);
        ver(x[0] == 0, "dos lentos (0.66 s entre uno y otro): no aprieta");
        x = correr(new DoblePellizco(), "00000" + "1".repeat(20) + "000" + "11111" + "0".repeat(30), 33);
        ver(x[0] == 0, "el primero sostenido (0.66 s: agarrar algo) no arma; el que sigue es un primero de nuevo");
        x = correr(new DoblePellizco(), "0000011111000" + "1".repeat(30) + "000", 33);
        ver(x[0] == 1 && x[1] == 30, "doble pellizco y sostener 1 s: aprieta todo ese rato (arrastrar, scroll)");
        x = correr(new DoblePellizco(), "00000111110001111100011111000000000000", 33);
        ver(x[0] == 1, "tres seguidos: un solo clic (el tercero empieza de nuevo)");
        DoblePellizco uno = new DoblePellizco();
        uno.doble = false;
        x = correr(uno, "0000011111000000", 33);
        ver(x[0] == 1, "con el doble pellizco apagado: un pellizco ya aprieta, como antes");
        DoblePellizco d = new DoblePellizco();
        d.paso(true, 100); d.paso(true, 133); d.paso(false, 166);
        float a0 = d.armado(166), a1 = d.armado(166 + 275), a2 = d.armado(166 + DoblePellizco.ESPERA + 1);
        ver(a0 == 1 && Math.abs(a1 - 0.5f) < 0.01f && a2 == 0, String.format(java.util.Locale.ROOT, "la cuenta del cursor: %.2f → %.2f → %.2f", a0, a1, a2));
        d = new DoblePellizco();
        d.paso(false, 100);
        d.paso(true, 133);
        ver(d.empezando(133) && !d.empezando(166), "avisa el cuadro en que empieza el primer pellizco (para guardar dónde apuntabas)");
    }

    public static void main(String[] a) throws Exception {
        ArrayList<String> nombres = new ArrayList<>();
        ArrayList<float[][]> manos = new ArrayList<>();
        for (String archivo : new String[]{"pruebas/manos.txt", "pruebas/manos-commons.txt"}) {
            for (String l : Files.readAllLines(Paths.get(archivo))) {
                if (l.startsWith("#") || l.trim().isEmpty()) continue;
                String[] t = l.trim().split("\\s+");
                float[][] w = new float[21][3];
                for (int i = 0; i < 21; i++) for (int k = 0; k < 3; k++) w[i][k] = Float.parseFloat(t[66 + i * 3 + k]);
                nombres.add(t[0]);
                manos.add(w);
            }
        }
        int falsos = 0;
        for (int m = 0; m < manos.size(); m++) {
            Gestos g = new Gestos();
            boolean p = false;
            for (int i = 0; i < 5; i++) p |= g.paso(manos.get(m));   // (varias imágenes iguales: la histéresis no la salva)
            if (p) { falsos++; System.out.println("  pellizco falso: " + nombres.get(m)); }
        }
        ver(falsos == 0, "ninguna de las " + manos.size() + " manos reales (puños, palmas, apuntando, agarrando) es un pellizco");
        int estirados = 0;
        for (float[][] w : manos) if (Gestos.indiceEstirado(w)) estirados++;
        System.out.println("  (con el índice estirado para tocar: " + estirados + " de " + manos.size() + ")");

        // pellizcar con cada mano abierta o apuntando: el pulgar y el índice se juntan y se separan
        Random r = new Random(3);
        int bien = 0, total = 0, rebotes = 0;
        for (int m = 0; m < manos.size(); m++) {
            float[][] w0 = manos.get(m);
            // (el puño no pellizca así; y las que ya tienen el pulgar pegado al índice no están "sueltas")
            if (Gestos.indice(w0) < 1.3f || Gestos.apertura(w0) < 0.45f) continue;
            total++;
            Gestos g = new Gestos();
            int cambios = 0;
            boolean antes = false, llego = false;
            float[] medio = new float[3];
            for (int k = 0; k < 3; k++) medio[k] = (w0[4][k] + w0[8][k]) / 2;
            for (int i = 0; i <= 60; i++) {
                // 0 → 1 → 0: el pellizco, en 2 s, con 3 mm de temblor
                float s = i <= 30 ? i / 30f : (60 - i) / 30f;
                float[][] w = new float[21][];
                for (int j = 0; j < 21; j++) w[j] = w0[j].clone();
                for (int k = 0; k < 3; k++) {
                    w[4][k] = w0[4][k] + (medio[k] - w0[4][k]) * s * 0.97f + (float) r.nextGaussian() * 0.003f;
                    w[8][k] = w0[8][k] + (medio[k] - w0[8][k]) * s * 0.97f + (float) r.nextGaussian() * 0.003f;
                }
                boolean p = g.paso(w);
                if (p != antes) cambios++;
                antes = p;
                if (p) llego = true;
            }
            if (!(llego && cambios == 2 && !antes)) System.out.printf("  %s: cambios %d, llegó %b (apertura %.2f, índice %.2f)%n", nombres.get(m), cambios, llego, Gestos.apertura(w0), Gestos.indice(w0));
            if (llego && cambios == 2 && !antes) bien++;
            else if (cambios > 2) rebotes++;
        }
        ver(bien == total, "pellizcar con " + total + " manos reales: aprieta una vez y suelta (" + bien + " bien, " + rebotes + " rebotes)");

        doble();

        // el doble pellizco con las manos reales: dos pellizcos a 30 imágenes por segundo (como se hacen, ~0.3 s cada uno)
        int dobleBien = 0, soloBien = 0;
        for (int m = 0; m < manos.size(); m++) {
            float[][] w0 = manos.get(m);
            if (Gestos.indice(w0) < 1.3f || Gestos.apertura(w0) < 0.45f) continue;
            if (pellizcos(w0, 2, r) == 1) dobleBien++;
            else System.out.println("  doble pellizco con " + nombres.get(m) + ": no hizo un clic");
            if (pellizcos(w0, 1, r) == 0) soloBien++;
            else System.out.println("  un pellizco con " + nombres.get(m) + ": hizo clic");
        }
        ver(dobleBien == total, "doble pellizco con " + total + " manos reales: un clic (" + dobleBien + " bien)");
        ver(soloBien == total, "un pellizco solo con las mismas manos: ningún clic (" + soloBien + " bien)");

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
