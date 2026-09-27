import com.juniorspro.asaltomr.Sellador;
import com.juniorspro.asaltomr.Tsdf;

import java.util.Locale;
import java.util.Random;

/**
 * El sellado de huecos, con una pieza de prueba escaneada con la cámara de
 * profundidad simulada (el mismo ruido que PruebaEscaneo):
 *  - el piso y una pared a 3 m con una VENTANA (80×60 cm; detrás, otra pared a 6 m);
 *  - un SILLÓN contra la pared (tapa la pared de abajo, detrás);
 *  - una MOCHILA en el piso (tapa el piso debajo).
 *
 * Tiene que: sellar la pared detrás del sillón y el piso debajo de la mochila
 * (y donde está la pared de verdad), NO sellar la ventana (se ve a través:
 * aire medido), y no inventar superficie en el aire ni donde termina lo escaneado.
 */
public class PruebaSellado {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static float caja(float x, float y, float z, float x0, float y0, float z0, float x1, float y1, float z1) {
        float cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
        float qx = Math.abs(x - cx) - (x1 - x0) / 2, qy = Math.abs(y - cy) - (y1 - y0) / 2, qz = Math.abs(z - cz) - (z1 - z0) / 2;
        float ax = Math.max(qx, 0), ay = Math.max(qy, 0), az = Math.max(qz, 0);
        return (float) Math.sqrt(ax * ax + ay * ay + az * az) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
    }

    // la ventana, el sillón y la mochila
    static final float VX0 = -0.4f, VX1 = 0.4f, VY0 = 1.0f, VY1 = 1.6f;
    static final float SX0 = 0.8f, SX1 = 2.2f, SY1 = 0.7f, SZ0 = -3.0f, SZ1 = -2.3f;
    static final float MX0 = -1.2f, MX1 = -0.8f, MY1 = 0.35f, MZ0 = -1.5f, MZ1 = -1.1f;

    /** La pieza (distancia firmada). */
    static float escena(float x, float y, float z) {
        float piso = y;
        // la pared: una losa de 15 cm en z ∈ [−3.15, −3.0], con la ventana recortada
        float pared = caja(x, y, z, -10, -1, -3.15f, 10, 3, -3.0f);
        float ventana = caja(x, y, z, VX0, VY0, -3.3f, VX1, VY1, -2.9f);
        pared = Math.max(pared, -ventana);
        float lejos = z + 6f;   // la pared de atrás (se ve por la ventana)
        float sillon = caja(x, y, z, SX0, 0, SZ0, SX1, SY1, SZ1);
        float mochila = caja(x, y, z, MX0, 0, MZ0, MX1, MY1, MZ1);
        return Math.min(Math.min(piso, pared), Math.min(lejos, Math.min(sillon, mochila)));
    }

    static float trazar(float ox, float oy, float oz, float dx, float dy, float dz) {
        float t = 0.05f;
        for (int i = 0; i < 300 && t < 12f; i++) {
            float d = escena(ox + dx * t, oy + dy * t, oz + dz * t);
            if (d < 0.0005f) return t;
            t += Math.max(d, 0.002f);
        }
        return -1;
    }

    /** Filma la pieza caminando un arco a 1.5 m de altura (como PruebaEscaneo). */
    static void escanear(Tsdf tsdf, int cuadros) {
        final int W = 160, H = 120;
        final float FX = 130, FY = 130, CX = 80, CY = 60;
        Random azar = new Random(7);
        short[] mm = new short[W * H];
        byte[] conf = new byte[W * H];
        for (int f = 0; f < cuadros; f++) {
            float s = f / (cuadros - 1f);
            float px = -1.8f + 3.6f * s, pz = 0.6f - 0.4f * (float) Math.sin(s * Math.PI);
            float yaw = (float) Math.atan2(-(0.2f - px), -(-2.5f - pz)) * 0.9f + 0.25f * (float) Math.sin(s * 9);
            float pitch = -0.3f - 0.25f * (float) Math.sin(s * 7);
            float[] P = PruebaEscaneo.pose(px, 1.5f, pz, yaw, pitch);
            for (int v = 0; v < H; v++) for (int u = 0; u < W; u++) {
                float xc = (u + 0.5f - CX) / FX, yc = -(v + 0.5f - CY) / FY, zc = -1;
                float dx = P[0] * xc + P[4] * yc + P[8] * zc, dy = P[1] * xc + P[5] * yc + P[9] * zc, dz = P[2] * xc + P[6] * yc + P[10] * zc;
                float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                float t = trazar(P[12], P[13], P[14], dx / l, dy / l, dz / l);
                int i = v * W + u;
                if (t < 0 || azar.nextFloat() < 0.15f) { mm[i] = 0; conf[i] = 0; continue; }
                float prof = t / l;
                prof *= 1 + (float) azar.nextGaussian() * 0.006f * prof;
                mm[i] = (short) Math.min(65535, Math.round(prof * 1000));
                conf[i] = (byte) (azar.nextFloat() < 0.1f ? 60 : 230);
            }
            tsdf.integrar(mm, conf, W, H, FX, FY, CX, CY, P, 7f, 100, 1, null);
        }
    }

    public static void main(String[] a) {
        Tsdf t = new Tsdf(0.07f);
        long t0 = System.nanoTime();
        escanear(t, 90);
        System.out.printf(Locale.ROOT, "escaneo: 90 imágenes (%.0f ms con la escena), %d bloques%n", (System.nanoTime() - t0) / 1e6, t.cantidadBloques());
        final float vs = t.voxel;
        // antes: debajo de la mochila no hay piso; detrás del sillón no hay pared
        float pisoAntes = t.suelo(-1.0f, -1.3f, 0.3f, -0.3f);
        float paredAntes = t.rayo(1.5f, 0.35f, -2.93f, 0, 0, -1, 0.3f);
        ver(pisoAntes != pisoAntes, "antes: debajo de la mochila no se ve el piso");
        ver(paredAntes < 0, "antes: detrás del sillón no se ve la pared");

        Sellador s = new Sellador();
        s.buscar(t, 0, 1.5f, 0.4f, false);   // primero sólo mirar
        System.out.printf(Locale.ROOT, "huecos: %d por sellar · %d aberturas · %d falta escanear · %d poros (en %d planos, piso a %.3f m, %.0f ms)%n",
                s.porSellar, s.aberturas, s.faltan, s.poros, s.regiones, s.piso, s.msUltimo);
        Sellador.Hueco detrasSillon = null, bajoMochila = null, ventana = null;
        for (Sellador.Hueco h : s.huecos) {
            if (h.area >= 0.05f) System.out.printf(Locale.ROOT, "  %-14s %.2f m² en (%.2f, %.2f, %.2f), normal (%.2f, %.2f, %.2f)%n", Sellador.NOMBRES[h.estado], h.area,
                    h.cx, h.cy, h.cz, h.nx, h.ny, h.nz);
            // (el más grande de cada lugar)
            if (h.cx > SX0 && h.cx < SX1 && h.cy < SY1 && Math.abs(h.cz + 3) < 0.1f && (detrasSillon == null || h.area > detrasSillon.area)) detrasSillon = h;
            if (h.cx > MX0 - 0.05f && h.cx < MX1 + 0.05f && h.cz > MZ0 - 0.05f && h.cz < MZ1 + 0.05f && Math.abs(h.cy) < 0.1f
                    && (bajoMochila == null || h.area > bajoMochila.area)) bajoMochila = h;
            if (h.cx > VX0 && h.cx < VX1 && h.cy > VY0 && h.cy < VY1 && Math.abs(h.cz + 3.05f) < 0.2f && (ventana == null || h.estado == Sellador.ABERTURA)) ventana = h;
        }
        ver(detrasSillon != null && detrasSillon.estado == Sellador.POR_SELLAR, "encuentra el hueco de la pared detrás del sillón, para sellar"
                + (detrasSillon == null ? "" : String.format(Locale.ROOT, " (%.2f m²)", detrasSillon.area)));
        ver(bajoMochila != null && bajoMochila.estado == Sellador.POR_SELLAR, "encuentra el piso debajo de la mochila, para sellar"
                + (bajoMochila == null ? "" : String.format(Locale.ROOT, " (%.2f m²)", bajoMochila.area)));
        ver(ventana != null && ventana.estado == Sellador.ABERTURA, "la ventana es una abertura (se ve a través): no se sella");

        // sellar
        long t1 = System.nanoTime();
        s.buscar(t, 0, 1.5f, 0.4f, true);
        System.out.printf(Locale.ROOT, "sellado en %.0f ms: %d sellados%n", (System.nanoTime() - t1) / 1e6, s.sellados);
        float pisoDespues = t.suelo(-1.0f, -1.3f, 0.3f, -0.3f);
        float paredDespues = t.rayo(1.5f, 0.35f, -2.93f, 0, 0, -1, 0.3f);
        ver(pisoDespues == pisoDespues && Math.abs(pisoDespues) < vs, String.format(Locale.ROOT, "después: el piso debajo de la mochila está donde está (%.3f m, real 0)", pisoDespues));
        ver(paredDespues > 0 && Math.abs(paredDespues - 0.07f) < vs, String.format(Locale.ROOT, "después: la pared detrás del sillón está donde está (a %.3f m, real 0.070)", paredDespues));
        // la ventana: ningún supuesto en su hueco
        int enVentana = 0;
        for (float x = VX0 + 0.1f; x < VX1 - 0.1f; x += vs * 0.5f) for (float y = VY0 + 0.1f; y < VY1 - 0.1f; y += vs * 0.5f)
            for (float z = -3.2f; z < -2.9f; z += vs * 0.5f)
                if (t.inferido(Tsdf.pisoDe(x / vs), Tsdf.pisoDe(y / vs), Tsdf.pisoDe(z / vs))) enVentana++;
        ver(enVentana == 0, "la ventana sigue abierta (" + enVentana + " voxeles supuestos adentro)");
        // nada inventado en el aire: todo lo supuesto que dice "superficie" (|d| < 0.5) está cerca de una superficie de verdad
        int total = 0, bien = 0;
        for (Tsdf.Bloque b : t.bloques()) {
            for (int lz = 0; lz < 16; lz++) for (int ly = 0; ly < 16; ly++) for (int lx = 0; lx < 16; lx++) {
                int gx = b.bx * 16 + lx, gy = b.by * 16 + ly, gz = b.bz * 16 + lz;
                if (!t.inferido(gx, gy, gz)) continue;
                float d = t.valor(gx, gy, gz);
                if (Math.abs(d) > 0.5f) continue;
                total++;
                // bien: cerca de una superficie de verdad, o adentro de algo sólido (el piso debajo del
                // sillón no se ve nunca); mal: en el aire
                float e = escena((gx + 0.5f) * vs, (gy + 0.5f) * vs, (gz + 0.5f) * vs);
                if (e < vs * 1.5f) bien++;
            }
        }
        System.out.printf(Locale.ROOT, "supuesto (la superficie): %d voxeles, %d cerca de una superficie de verdad o adentro de algo sólido%n", total, bien);
        ver(total > 50 && bien >= total * 0.95f, String.format(Locale.ROOT, "lo sellado está sobre superficies de verdad (o adentro de algo), no en el aire (%.1f %%)", 100f * bien / Math.max(1, total)));
        // otra vez: ya está sellado, no escribe de nuevo
        s.buscar(t, 0, 1.5f, 0.4f, true);
        int recien = 0;
        for (Sellador.Hueco h : s.huecos) if (h.recien) recien++;
        ver(recien == 0, "buscar otra vez no vuelve a escribir lo ya sellado (" + recien + ")");
        ver(s.msUltimo < 250, String.format(Locale.ROOT, "buscar huecos tarda menos de 250 ms en la PC (%.0f)", s.msUltimo));

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
