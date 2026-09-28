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
 * vez, no rebota, suelta.
 */
public class PruebaGestos {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
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

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
