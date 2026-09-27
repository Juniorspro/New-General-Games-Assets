import com.juniorspro.asaltomr.Mallador;
import com.juniorspro.asaltomr.Tsdf;

import java.util.List;
import java.util.Random;

/**
 * Prueba del escaneo sin teléfono: una escena conocida (piso, una pared, una
 * caja y un tronco de árbol), una cámara de profundidad simulada que da la
 * vuelta mirándola —con ruido como el de ARCore— y se mide cuánto se aleja la
 * malla de la superficie verdadera.
 *
 *   ./pruebas/correr.sh
 */
public class PruebaEscaneo {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    // ── la escena: distancia firmada exacta (+ afuera) ──
    static float caja(float x, float y, float z, float x0, float y0, float z0, float x1, float y1, float z1) {
        float cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
        float qx = Math.abs(x - cx) - (x1 - x0) / 2, qy = Math.abs(y - cy) - (y1 - y0) / 2, qz = Math.abs(z - cz) - (z1 - z0) / 2;
        float ax = Math.max(qx, 0), ay = Math.max(qy, 0), az = Math.max(qz, 0);
        return (float) Math.sqrt(ax * ax + ay * ay + az * az) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
    }

    static float escena(float x, float y, float z) {
        float piso = y;                                               // el suelo en y = 0
        float pared = z + 4f;                                         // una pared en z = −4 (mirando a +z)
        float mesa = caja(x, y, z, 0.5f, 0f, -2.5f, 1.5f, 0.8f, -1.5f);
        float tronco = (float) Math.hypot(x + 1.5f, z + 2f) - 0.25f;  // un árbol de 25 cm de radio
        return Math.min(Math.min(piso, pared), Math.min(mesa, tronco));
    }

    /** Lanza un rayo contra la escena (sphere tracing). */
    static float trazar(float ox, float oy, float oz, float dx, float dy, float dz) {
        float t = 0.05f;
        for (int i = 0; i < 200 && t < 12f; i++) {
            float d = escena(ox + dx * t, oy + dy * t, oz + dz * t);
            if (d < 0.0005f) return t;
            t += d;
        }
        return -1;
    }

    /** Pose cámara→mundo por columnas: en (px,py,pz), girada yaw (Y) y cabeceo (X). Mira a −Z. */
    static float[] pose(float px, float py, float pz, float yaw, float pitch) {
        float cy = (float) Math.cos(yaw), sy = (float) Math.sin(yaw), cp = (float) Math.cos(pitch), sp = (float) Math.sin(pitch);
        // R = Ry(yaw) · Rx(pitch)
        float[] m = new float[16];
        m[0] = cy;  m[1] = 0;   m[2] = -sy;
        m[4] = sy * sp; m[5] = cp; m[6] = cy * sp;
        m[8] = sy * cp; m[9] = -sp; m[10] = cy * cp;
        m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
        return m;
    }

    /** Un charco en el piso (para la IA: ahí no se camina). */
    static boolean charco(float x, float z) { return x > -1.0f && x < 0.0f && z > -1.3f && z < -0.5f; }

    /**
     * Lo que diría la red de Scene Semantics de ARCore de cada punto de la
     * escena (con un 10 % de errores, como una red de verdad).
     */
    static int etiquetaDe(float x, float y, float z, Random azar) {
        if (azar.nextFloat() < 0.1f) return 1 + azar.nextInt(11);
        float piso = Math.abs(y), pared = Math.abs(z + 4f), mesa = Math.abs(caja(x, y, z, 0.5f, 0f, -2.5f, 1.5f, 0.8f, -1.5f)),
                tronco = Math.abs((float) Math.hypot(x + 1.5f, z + 2f) - 0.25f);
        float m = Math.min(Math.min(piso, pared), Math.min(mesa, tronco));
        if (m == piso) return charco(x, z) ? Tsdf.AGUA : Tsdf.PASTO;
        if (m == pared) return Tsdf.EDIFICIO;
        if (m == mesa) return Tsdf.OBJETO;
        return Tsdf.ARBOL;
    }

    /**
     * Escanea parado en (px, py, pz), paneando alrededor de un rumbo (yaw)
     * ±25° con el cabeceo dado: como alguien que sigue la flecha de la guía.
     */
    static void escanearDesde(Tsdf tsdf, float px, float py, float pz, float yaw, float pitch, int cuadros) {
        final int W = 160, H = 120;
        final float FX = 130, FY = 130, CX = 80, CY = 60;
        Random azar = new Random(17);
        short[] mm = new short[W * H];
        for (int f = 0; f < cuadros; f++) {
            float y = yaw + (float) Math.sin(f * 0.7f) * 0.45f, p = pitch + (float) Math.cos(f * 0.5f) * 0.15f;
            float[] P = pose(px, py, pz, y, p);
            for (int v = 0; v < H; v++) for (int u = 0; u < W; u++) {
                float xc = (u + 0.5f - CX) / FX, yc = -(v + 0.5f - CY) / FY, zc = -1;
                float dx = P[0] * xc + P[4] * yc + P[8] * zc, dy = P[1] * xc + P[5] * yc + P[9] * zc, dz = P[2] * xc + P[6] * yc + P[10] * zc;
                float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                float t = trazar(P[12], P[13], P[14], dx / l, dy / l, dz / l);
                int i = v * W + u;
                if (t < 0 || azar.nextFloat() < 0.15f) { mm[i] = 0; continue; }
                float prof = t / l;
                prof *= 1 + (float) azar.nextGaussian() * 0.006f * prof;
                mm[i] = (short) Math.min(65535, Math.round(prof * 1000));
            }
            tsdf.integrar(mm, null, W, H, FX, FY, CX, CY, P, 5.5f, 100, 1, null);
        }
    }

    static int escanear(Tsdf tsdf, int cuadros) { return escanear(tsdf, cuadros, false, 1f); }

    static int escanear(Tsdf tsdf, int cuadros, boolean conEtiquetas) { return escanear(tsdf, cuadros, conEtiquetas, 1f); }

    /**
     * Filma la escena con la cámara de profundidad simulada y la mete al
     * volumen. conEtiquetas: también la "red semántica". fraccion: cuánto del
     * recorrido se hace (1 = el arco entero).
     */
    static int escanear(Tsdf tsdf, int cuadros, boolean conEtiquetas, float fraccion) {
        final int W = 160, H = 120;
        final float FX = 130, FY = 130, CX = 80, CY = 60;
        Random azar = new Random(7);
        short[] mm = new short[W * H];
        byte[] conf = new byte[W * H];
        byte[] etq = conEtiquetas ? new byte[W * H] : null;
        Random azarEtq = new Random(3);
        int rayosTot = 0;
        // la cámara camina un arco de 3 m a 1.5 m de altura, mirando a la escena y un poco abajo
        for (int f = 0; f < cuadros; f++) {
            float s = fraccion * f / (cuadros - 1f);
            float px = -1.5f + 3f * s, pz = 1.0f - 0.5f * (float) Math.sin(s * Math.PI);
            float yaw = (float) Math.atan2(-(0f - px), -(-2.2f - pz)) * 0.85f;   // más o menos hacia el centro
            float pitch = -0.35f - 0.15f * (float) Math.sin(s * 6);
            float[] P = pose(px, 1.5f, pz, yaw, pitch);
            for (int v = 0; v < H; v++) for (int u = 0; u < W; u++) {
                float xc = (u + 0.5f - CX) / FX, yc = -(v + 0.5f - CY) / FY, zc = -1;
                float dx = P[0] * xc + P[4] * yc + P[8] * zc, dy = P[1] * xc + P[5] * yc + P[9] * zc, dz = P[2] * xc + P[6] * yc + P[10] * zc;
                float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                float t = trazar(P[12], P[13], P[14], dx / l, dy / l, dz / l);
                int i = v * W + u;
                if (t < 0 || azar.nextFloat() < 0.15f) { mm[i] = 0; conf[i] = 0; continue; }   // huecos, como el raw de ARCore
                float prof = t / l;                                               // z de la cámara, no la distancia
                prof *= 1 + (float) azar.nextGaussian() * 0.006f * prof;          // ruido: σ = 0.6 % · prof² (2.4 cm a 2 m, 15 cm a 5 m)
                mm[i] = (short) Math.min(65535, Math.round(prof * 1000));
                conf[i] = (byte) (azar.nextFloat() < 0.1f ? 60 : 230);
                if (etq != null) etq[i] = (byte) etiquetaDe(P[12] + dx / l * t, P[13] + dy / l * t, P[14] + dz / l * t, azarEtq);
            }
            rayosTot += tsdf.integrar(mm, conf, W, H, FX, FY, CX, CY, P, 5.5f, 100, 1, etq);
        }
        return rayosTot;
    }

    public static void main(String[] a) {
        Tsdf tsdf = new Tsdf(0.07f);
        long t0 = System.nanoTime();
        int cuadros = 60;
        int rayosTot = escanear(tsdf, cuadros);
        double msInt = (System.nanoTime() - t0) / 1e6 / cuadros;
        System.out.printf("integración: %d cuadros, %.1f ms/cuadro, %d rayos/cuadro, %d bloques%n", cuadros, msInt, rayosTot / cuadros, tsdf.cantidadBloques());
        ver(msInt < 60, "integrar una imagen de 160×120 tarda menos de 60 ms en la PC (" + String.format("%.1f", msInt) + ")");

        // mallar todo
        tsdf.propagarBordes();
        List<Tsdf.Bloque> sucios = tsdf.tomarSucios();
        Mallador mal = new Mallador();
        long t1 = System.nanoTime();
        int nv = 0, ntri = 0, mallas = 0;
        double sumaErr = 0, maxErr = 0;
        int lejos = 0, cerca = 0, cercaMal = 0;
        int[] porTipo = new int[4];   // piso, pared, mesa, tronco
        for (Tsdf.Bloque b : sucios) {
            Mallador.Malla m = mal.mallar(tsdf, b);
            if (m == null) continue;
            mallas++;
            nv += m.nVert;
            ntri += m.nTri / 3;
            for (int i = 0; i < m.nVert; i++) {
                float x = m.vert[i * Mallador.PASO], y = m.vert[i * Mallador.PASO + 1], z = m.vert[i * Mallador.PASO + 2];
                double e = Math.abs(escena(x, y, z));
                // a menos de 4 m del camino de la cámara (donde se juega)
                if (Math.hypot(x, z - 0.7) < 4.0) { cerca++; if (e > 0.07) cercaMal++; }
                sumaErr += e;
                maxErr = Math.max(maxErr, e);
                if (e > 0.07) lejos++;
                float dp = Math.abs(y), dw = Math.abs(z + 4f), dm = Math.abs(caja(x, y, z, 0.5f, 0f, -2.5f, 1.5f, 0.8f, -1.5f)),
                        dt = Math.abs((float) Math.hypot(x + 1.5f, z + 2f) - 0.25f);
                float mn = Math.min(Math.min(dp, dw), Math.min(dm, dt));
                porTipo[mn == dp ? 0 : mn == dw ? 1 : mn == dm ? 2 : 3]++;
            }
            // índices dentro de rango
            boolean bien = true;
            for (int i = 0; i < m.nTri; i++) if ((m.tri[i] & 0xFFFF) >= m.nVert) bien = false;
            for (int i = 0; i < m.nLin; i++) if ((m.lin[i] & 0xFFFF) >= m.nVert) bien = false;
            if (!bien) { ver(false, "índices fuera de rango en un bloque"); break; }
        }
        double msMalla = (System.nanoTime() - t1) / 1e6;
        double medio = sumaErr / Math.max(1, nv);
        System.out.printf("malla: %d bloques, %d vértices, %d triángulos en %.1f ms (%.2f ms/bloque)%n", mallas, nv, ntri, msMalla, msMalla / Math.max(1, mallas));
        System.out.printf("error: medio %.1f mm, máx %.1f mm, %.2f %% a más de un voxel%n", medio * 1000, maxErr * 1000, 100.0 * lejos / Math.max(1, nv));
        System.out.printf("vértices por superficie: piso %d · pared %d · mesa %d · tronco %d%n", porTipo[0], porTipo[1], porTipo[2], porTipo[3]);
        ver(nv > 2000, "la malla tiene superficie (" + nv + " vértices)");
        ver(medio < 0.02, "la malla queda a menos de 2 cm de la superficie real en promedio");
        System.out.printf("a menos de 4 m: %d vértices, %.2f %% a más de un voxel%n", cerca, 100.0 * cercaMal / Math.max(1, cerca));
        ver(cercaMal < cerca * 0.01, "a menos de 4 m, menos del 1 % de los vértices a más de un voxel (7 cm)");
        ver(lejos < nv * 0.05, "en todo (hasta 5.5 m, con ruido de 18 cm), menos del 5 % a más de un voxel");
        ver(porTipo[0] > 500 && porTipo[1] > 200 && porTipo[2] > 100 && porTipo[3] > 20, "salen el piso, la pared, la mesa y el tronco");

        // consultas que usa el juego
        float s1 = tsdf.suelo(-0.5f, -1.2f, 1.4f, -1f);
        ver(Math.abs(s1) < 0.03f, String.format("suelo bajo (−0.5, −1.2) = %.3f m (real 0)", s1));
        float s2 = tsdf.suelo(1.0f, -2.0f, 1.4f, -1f);
        ver(Math.abs(s2 - 0.8f) < 0.04f, String.format("suelo sobre la mesa = %.3f m (real 0.8)", s2));
        // rayo desde la cámara a la mesa
        float[] o = {0f, 1.5f, 0.5f};
        float[] d = {1.0f, 0.4f - 1.5f, -2.0f - 0.5f};
        float ld = (float) Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
        for (int i = 0; i < 3; i++) d[i] /= ld;
        float tr = tsdf.rayo(o[0], o[1], o[2], d[0], d[1], d[2], 10f);
        float real = trazar(o[0], o[1], o[2], d[0], d[1], d[2]);
        ver(tr > 0 && Math.abs(tr - real) < 0.04f, String.format("rayo a la mesa: %.3f m (real %.3f)", tr, real));
        float tr2 = tsdf.rayo(-1.5f, 1.0f, 0.5f, 0, 0, -1, 10f);
        ver(tr2 > 0 && Math.abs(tr2 - 2.25f) < 0.05f, String.format("rayo al tronco: %.3f m (real 2.250)", tr2));
        ver(tsdf.ocupado(1.0f, 0.75f, -2.0f), "5 cm adentro de la mesa cuenta como ocupado");
        ver(!tsdf.ocupado(0f, 1.0f, -1.0f), "el aire cuenta como libre");

        // re-mallar después de otra imagen: sólo cambia lo que tocó
        List<Tsdf.Bloque> otra = tsdf.tomarSucios();
        ver(otra.isEmpty(), "sin imágenes nuevas no hay nada que re-mallar");

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
