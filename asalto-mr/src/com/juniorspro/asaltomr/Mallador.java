package com.juniorspro.asaltomr;

/**
 * De los voxeles a polígonos: "surface nets".
 *
 * Cada celda (8 voxeles vecinos) donde el signo cambia —de un lado libre, del
 * otro ocupado— tiene la superficie adentro: ahí va un vértice, en el promedio
 * de los puntos donde cada arista cruza el cero. Cada arista de voxeles que
 * cruza el cero la comparten 4 celdas: sus 4 vértices forman un cuadrilátero
 * (dos triángulos). Sale una malla cerrada, sin tablas, con polígonos parejos
 * como la malla de escena del Quest.
 *
 * Se malla por bloque (16³): el bloque lee una capa de voxeles de cada vecino
 * para que las mallas empalmen sin agujeros.
 */
public final class Mallador {
    private static final int N = Tsdf.N;
    private static final int C = N + 1;       // celdas de −1 a N−1
    private static final int V = N + 2;       // voxeles de −1 a N

    /** Floats por vértice: posición, normal y cuánto es inferido (0 = medido, 1 = supuesto). */
    public static final int PASO = 7;

    /** Una malla lista para subir: vértices (x,y,z,nx,ny,nz,inf), triángulos y líneas (índices). */
    public static final class Malla {
        public int bx, by, bz, version;
        public float[] vert;
        public short[] tri, lin;
        public int nVert, nTri, nLin;        // nTri/nLin en índices, no en triángulos
    }

    /** Voxeles vistos menos veces que esto no ponen polígonos. */
    public int pesoMin = 4;

    private final float[] vals = new float[V * V * V];
    private final byte[] infs = new byte[V * V * V];
    private final int[] indice = new int[C * C * C];
    private float[] vert = new float[4096 * PASO];
    private short[] tri = new short[8192 * 3];
    private short[] lin = new short[8192 * 4];

    private static int iv(int x, int y, int z) { return ((z + 1) * V + (y + 1)) * V + (x + 1); }

    private static int ic(int x, int y, int z) { return ((z + 1) * C + (y + 1)) * C + (x + 1); }

    // las 12 aristas de una celda: pares de esquinas (esquina k = bits x,y,z)
    private static final int[][] ARISTAS = {
            {0, 1}, {2, 3}, {4, 5}, {6, 7},
            {0, 2}, {1, 3}, {4, 6}, {5, 7},
            {0, 4}, {1, 5}, {2, 6}, {3, 7}};

    /** Malla un bloque. Devuelve null si no hay superficie adentro. */
    public Malla mallar(Tsdf tsdf, Tsdf.Bloque b) {
        final int g0x = b.bx * N - 1, g0y = b.by * N - 1, g0z = b.bz * N - 1;
        final int version = b.version;
        tsdf.copiar(g0x, g0y, g0z, V, pesoMin, vals, infs);   // lo único que toma el candado
        final float vs = tsdf.voxel;
        int nv = 0;
        float[] esq = new float[8];

        // 1) un vértice por celda con cambio de signo
        for (int z = -1; z < N; z++) for (int y = -1; y < N; y++) for (int x = -1; x < N; x++) {
            int mascara = 0;
            boolean falta = false;
            int inferidas = 0;
            for (int k = 0; k < 8; k++) {
                int q = iv(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1));
                float v = vals[q];
                if (v != v) { falta = true; break; }
                inferidas += infs[q];
                esq[k] = v;
                if (v < 0) mascara |= 1 << k;
            }
            int ci = ic(x, y, z);
            if (falta || mascara == 0 || mascara == 255) { indice[ci] = -1; continue; }
            float sx = 0, sy = 0, sz = 0;
            int cruces = 0;
            for (int[] a : ARISTAS) {
                float va = esq[a[0]], vb = esq[a[1]];
                if ((va < 0) == (vb < 0)) continue;
                float t = va / (va - vb);
                int ka = a[0], kb = a[1];
                sx += (ka & 1) + t * ((kb & 1) - (ka & 1));
                sy += ((ka >> 1) & 1) + t * (((kb >> 1) & 1) - ((ka >> 1) & 1));
                sz += ((ka >> 2) & 1) + t * (((kb >> 2) & 1) - ((ka >> 2) & 1));
                cruces++;
            }
            if (nv * PASO + PASO > vert.length) vert = java.util.Arrays.copyOf(vert, vert.length * 2);
            if (nv >= 65535) { indice[ci] = -1; continue; }
            // el centro del voxel (i) está en (i + 0.5)·vs
            vert[nv * PASO] = (g0x + 1 + x + 0.5f + sx / cruces) * vs;
            vert[nv * PASO + 1] = (g0y + 1 + y + 0.5f + sy / cruces) * vs;
            vert[nv * PASO + 2] = (g0z + 1 + z + 0.5f + sz / cruces) * vs;
            // normal: el gradiente apunta a lo libre (+), o sea hacia afuera
            float nx = (esq[1] + esq[3] + esq[5] + esq[7]) - (esq[0] + esq[2] + esq[4] + esq[6]);
            float ny = (esq[2] + esq[3] + esq[6] + esq[7]) - (esq[0] + esq[1] + esq[4] + esq[5]);
            float nz = (esq[4] + esq[5] + esq[6] + esq[7]) - (esq[0] + esq[1] + esq[2] + esq[3]);
            float l = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (l < 1e-6f) { nx = 0; ny = 1; nz = 0; l = 1; }
            vert[nv * PASO + 3] = nx / l;
            vert[nv * PASO + 4] = ny / l;
            vert[nv * PASO + 5] = nz / l;
            vert[nv * PASO + 6] = inferidas / 8f;
            indice[ci] = nv++;
        }
        if (nv == 0) return null;

        // 2) un cuadrilátero por arista de voxeles (que empieza en este bloque) con cambio de signo
        int nt = 0, nl = 0;
        for (int z = 0; z < N; z++) for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
            float v0 = vals[iv(x, y, z)];
            if (v0 != v0) continue;
            for (int eje = 0; eje < 3; eje++) {
                float v1 = eje == 0 ? vals[iv(x + 1, y, z)] : eje == 1 ? vals[iv(x, y + 1, z)] : vals[iv(x, y, z + 1)];
                if (v1 != v1 || (v0 < 0) == (v1 < 0)) continue;
                int a, bq, c, d;
                // las 4 celdas alrededor de la arista, en orden
                if (eje == 0) {
                    a = indice[ic(x, y - 1, z - 1)]; bq = indice[ic(x, y, z - 1)]; c = indice[ic(x, y, z)]; d = indice[ic(x, y - 1, z)];
                } else if (eje == 1) {
                    a = indice[ic(x - 1, y, z - 1)]; bq = indice[ic(x - 1, y, z)]; c = indice[ic(x, y, z)]; d = indice[ic(x, y, z - 1)];
                } else {
                    a = indice[ic(x - 1, y - 1, z)]; bq = indice[ic(x, y - 1, z)]; c = indice[ic(x, y, z)]; d = indice[ic(x - 1, y, z)];
                }
                if (a < 0 || bq < 0 || c < 0 || d < 0) continue;
                if (v0 >= 0) { int t = bq; bq = d; d = t; }   // que la cara mire hacia lo libre
                if (nt + 6 > tri.length) tri = java.util.Arrays.copyOf(tri, tri.length * 2);
                if (nl + 10 > lin.length) lin = java.util.Arrays.copyOf(lin, lin.length * 2);
                // partir por la diagonal más corta: triángulos más parejos
                float dac = dist2(a, c), dbd = dist2(bq, d);
                if (dac <= dbd) {
                    tri[nt++] = (short) a; tri[nt++] = (short) bq; tri[nt++] = (short) c;
                    tri[nt++] = (short) a; tri[nt++] = (short) c; tri[nt++] = (short) d;
                    lin[nl++] = (short) a; lin[nl++] = (short) c;
                } else {
                    tri[nt++] = (short) a; tri[nt++] = (short) bq; tri[nt++] = (short) d;
                    tri[nt++] = (short) bq; tri[nt++] = (short) c; tri[nt++] = (short) d;
                    lin[nl++] = (short) bq; lin[nl++] = (short) d;
                }
                // bordes del cuadrilátero: cada uno lo comparten dos, se pone la mitad
                lin[nl++] = (short) a; lin[nl++] = (short) bq;
                lin[nl++] = (short) bq; lin[nl++] = (short) c;
            }
        }
        if (nt == 0) return null;
        Malla m = new Malla();
        m.bx = b.bx; m.by = b.by; m.bz = b.bz; m.version = version;
        m.nVert = nv; m.nTri = nt; m.nLin = nl;
        m.vert = java.util.Arrays.copyOf(vert, nv * PASO);
        m.tri = java.util.Arrays.copyOf(tri, nt);
        m.lin = java.util.Arrays.copyOf(lin, nl);
        return m;
    }

    private float dist2(int i, int j) {
        float dx = vert[i * PASO] - vert[j * PASO], dy = vert[i * PASO + 1] - vert[j * PASO + 1], dz = vert[i * PASO + 2] - vert[j * PASO + 2];
        return dx * dx + dy * dy + dz * dz;
    }
}
