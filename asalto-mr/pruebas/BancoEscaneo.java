import com.juniorspro.asaltomr.Mallador;
import com.juniorspro.asaltomr.Tsdf;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Cuánto tarda el escaneo, sin contar lo que tarda armar las imágenes de
 * prueba: primero se "filman" 60 imágenes de profundidad de la escena, y
 * después se mide sólo integrarlas y mallar lo que cambió.
 *   java BancoEscaneo   (no es una prueba: no tiene ✓/✗; lo usa PruebaEscaneo)
 */
public class BancoEscaneo {
    static final int W = 160, H = 120;
    static final float FX = 130, FY = 130, CX = 80, CY = 60;

    static final class Imagen { short[] mm = new short[W * H]; byte[] conf = new byte[W * H]; float[] pose; }

    /** Las 60 imágenes del arco de PruebaEscaneo. */
    static List<Imagen> filmar(int cuadros) {
        Random azar = new Random(7);
        ArrayList<Imagen> r = new ArrayList<>();
        for (int f = 0; f < cuadros; f++) {
            float s = f / (cuadros - 1f);
            float px = -1.5f + 3f * s, pz = 1.0f - 0.5f * (float) Math.sin(s * Math.PI);
            float yaw = (float) Math.atan2(-(0f - px), -(-2.2f - pz)) * 0.85f;
            float pitch = -0.35f - 0.15f * (float) Math.sin(s * 6);
            Imagen im = new Imagen();
            float[] P = PruebaEscaneo.pose(px, 1.5f, pz, yaw, pitch);
            im.pose = P;
            for (int v = 0; v < H; v++) for (int u = 0; u < W; u++) {
                float xc = (u + 0.5f - CX) / FX, yc = -(v + 0.5f - CY) / FY, zc = -1;
                float dx = P[0] * xc + P[4] * yc + P[8] * zc, dy = P[1] * xc + P[5] * yc + P[9] * zc, dz = P[2] * xc + P[6] * yc + P[10] * zc;
                float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                float t = PruebaEscaneo.trazar(P[12], P[13], P[14], dx / l, dy / l, dz / l);
                int i = v * W + u;
                if (t < 0 || azar.nextFloat() < 0.15f) continue;
                float prof = t / l;
                prof *= 1 + (float) azar.nextGaussian() * 0.006f * prof;
                im.mm[i] = (short) Math.min(65535, Math.round(prof * 1000));
                im.conf[i] = (byte) (azar.nextFloat() < 0.1f ? 60 : 230);
            }
            r.add(im);
        }
        return r;
    }

    /** {ms por imagen integrando, ms mallando todo al final, bloques, vértices} (mejor de 3 corridas). */
    static double[] medir(List<Imagen> ims) {
        double mejor = 1e9, mejorM = 1e9;
        int bloques = 0, vert = 0;
        for (int rep = 0; rep < 3; rep++) {
            Tsdf t = new Tsdf(0.07f);
            long t0 = System.nanoTime();
            for (Imagen im : ims) t.integrar(im.mm, im.conf, W, H, FX, FY, CX, CY, im.pose, 5.5f, 100, 1, null);
            double ms = (System.nanoTime() - t0) / 1e6 / ims.size();
            t.propagarBordes();
            List<Tsdf.Bloque> s = t.tomarSucios();
            Mallador m = new Mallador();
            long t1 = System.nanoTime();
            int nv = 0;
            for (Tsdf.Bloque b : s) { Mallador.Malla ma = m.mallar(t, b); if (ma != null) nv += ma.nVert; }
            double msM = (System.nanoTime() - t1) / 1e6;
            if (ms < mejor) mejor = ms;
            if (msM < mejorM) mejorM = msM;
            bloques = s.size(); vert = nv;
        }
        return new double[]{mejor, mejorM, bloques, vert};
    }

    public static void main(String[] a) {
        List<Imagen> ims = filmar(60);
        double[] r = medir(ims);
        System.out.printf("integrar: %.2f ms/imagen · mallar %d bloques: %.1f ms (%.2f ms/bloque) · %d vértices%n", r[0], (int) r[2], r[1], r[1] / r[2], (int) r[3]);
    }
}
