package com.juniorspro.asaltomr;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

/**
 * Los HUECOS del escaneo y el sellado automático.
 *
 * Una pieza escaneada tiene agujeros: la pared detrás del sillón, el piso
 * debajo de la mesa, un pedazo de pared que la cámara nunca miró de frente.
 * Así se buscan y se cierran:
 *
 *  1. SUPERFICIES PLANAS: de los voxeles de superficie medidos (no los
 *     supuestos) se arman regiones planas creciendo por vecinos con la misma
 *     normal (±20°) y a menos de 1.5 voxeles del plano: paredes, piso, mesas.
 *  2. UNA GRILLA sobre cada plano (celdas del tamaño de un voxel): cada celda
 *     es VISTA (tiene superficie), CERRADA (justo delante del plano hay algo
 *     sólido medido: la esquina con el piso, la pata de la mesa, otra pared),
 *     AIRE (en el plano se midió aire: ahí no hay pared, se ve a través) o no
 *     se sabe.
 *  3. HUECO = lo que no se sabe y queda ENCERRADO: no se llega desde el borde
 *     de la grilla sin cruzar celdas vistas o cerradas. Lo que toca el borde
 *     no es un hueco: es donde termina lo escaneado (eso es "falta escanear"
 *     para la guía del escaneo).
 *  4. Cada hueco se clasifica:
 *     - ABERTURA si buena parte es aire medido (una ventana, una puerta
 *       abierta): no se sella;
 *     - POR SELLAR si es de hasta 1.5 m²: se cierra con el plano (voxeles
 *       SUPUESTOS a la distancia firmada del plano, con la etiqueta de la
 *       superficie), que se mallan de otro color; en cuanto la cámara lo mira,
 *       lo medido reemplaza lo supuesto;
 *     - FALTA ESCANEAR si es más grande (supone demasiado: mejor mirarlo).
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaSellado.java). Lo corre el
 * hilo de la malla (Escaneo) cada segundo.
 */
public final class Sellador {
    public static final int POR_SELLAR = 0, SELLADO = 1, FALTA = 2, ABERTURA = 3;
    public static final String[] NOMBRES = {"por sellar", "sellado", "falta escanear", "abertura"};
    static final int PESO_MIN = 4;
    static final float ANGULO = (float) Math.cos(Math.toRadians(20)), AREA_MAX = 1.5f, RADIO = 7f, FRACCION_AIRE = 0.3f;
    static final int MIN_REGION = 40;
    static final boolean DEPURAR = Boolean.getBoolean("depurar");

    /** Un hueco: el plano (origen o, ejes u y v, normal n), las celdas (i, j) y en qué estado está. */
    public static final class Hueco {
        public float ox, oy, oz, ux, uy, uz, vx, vy, vz, nx, ny, nz, celda;
        public int[] celdas;        // pares (i, j): el centro de la celda es o + u·(i+0.5)·celda + v·(j+0.5)·celda
        /** Las primeras son las que no se saben; después, las tapadas (por algo apoyado) que se sellan con ellas. */
        public int abiertas;
        public int estado;
        public float area, cx, cy, cz;
        /** Se selló en esta pasada (para el destello en la vista). */
        public boolean recien;
    }

    /** Lo último que se encontró (lo lee el dibujo). */
    public volatile List<Hueco> huecos = Collections.emptyList();
    public volatile int porSellar, sellados, faltan, aberturas;
    public volatile int regiones;
    /** Agujeritos de 1 o 2 celdas: se sellan sin listarlos. */
    public volatile int poros;
    /** La altura del piso (la región horizontal más grande), o NaN. */
    public volatile float piso = Float.NaN;
    public volatile float msUltimo;

    public void olvidar() { huecos = Collections.emptyList(); porSellar = sellados = faltan = aberturas = 0; }

    // ── 1) muestras de superficie ──

    private static final class Muestras {
        int n;
        float[] p = new float[3 * 4096], nrm = new float[3 * 4096];
        int[] g = new int[3 * 4096], etq = new int[4096];

        void agregar(float x, float y, float z, float a, float b, float c, int gx, int gy, int gz, int e) {
            if (n * 3 + 3 > p.length) {
                p = java.util.Arrays.copyOf(p, p.length * 2); nrm = java.util.Arrays.copyOf(nrm, nrm.length * 2);
                g = java.util.Arrays.copyOf(g, g.length * 2); etq = java.util.Arrays.copyOf(etq, etq.length * 2);
            }
            int k = n * 3;
            p[k] = x; p[k + 1] = y; p[k + 2] = z; nrm[k] = a; nrm[k + 1] = b; nrm[k + 2] = c;
            g[k] = gx; g[k + 1] = gy; g[k + 2] = gz; etq[n] = e;
            n++;
        }
    }

    /** d medido (no supuesto, visto PESO_MIN veces, no "sólo aire"), o NaN. */
    private static float medido(Tsdf t, int gx, int gy, int gz) {
        Tsdf.Bloque b = t.bloqueSinCandado(gx >> 4, gy >> 4, gz >> 4);
        if (b == null) return Float.NaN;
        int i = ((gz & 15) * 16 + (gy & 15)) * 16 + (gx & 15);
        if (b.w[i] < PESO_MIN || (b.info[i] & (Tsdf.INFERIDO | Tsdf.AIRE)) != 0) return Float.NaN;
        return b.d[i];
    }

    /** La diferencia (central, o de un lado si falta el otro) entre los vecinos a (+1) y b (−1) de un voxel d; NaN sin ninguno. */
    private static float dif(float a, float b, float d) {
        return a == a && b == b ? a - b : a == a ? 2 * (a - d) : b == b ? 2 * (d - b) : Float.NaN;
    }

    private Muestras muestras(Tsdf t, float px, float py, float pz) {
        Muestras m = new Muestras();
        float vs = t.voxel, tr = t.trunc;
        for (Tsdf.Bloque b : t.bloques()) {
            float bx = (b.bx * 16 + 8) * vs, by = (b.by * 16 + 8) * vs, bz = (b.bz * 16 + 8) * vs;
            if (Math.abs(bx - px) > RADIO || Math.abs(bz - pz) > RADIO || Math.abs(by - py) > 4) continue;
            synchronized (t) {
                for (int lz = 0; lz < 16; lz++) for (int ly = 0; ly < 16; ly++) for (int lx = 0; lx < 16; lx++) {
                    int i = (lz * 16 + ly) * 16 + lx;
                    if (b.w[i] < PESO_MIN || (b.info[i] & (Tsdf.INFERIDO | Tsdf.AIRE)) != 0) continue;
                    float d = b.d[i];
                    if (Math.abs(d) >= 0.5f) continue;   // sólo el centro de la banda: ~una muestra por columna de superficie
                    int gx = b.bx * 16 + lx, gy = b.by * 16 + ly, gz = b.bz * 16 + lz;
                    float ax = medido(t, gx + 1, gy, gz), bx0 = medido(t, gx - 1, gy, gz);
                    float ay = medido(t, gx, gy + 1, gz), by0 = medido(t, gx, gy - 1, gz);
                    float az = medido(t, gx, gy, gz + 1), bz0 = medido(t, gx, gy, gz - 1);
                    float nx = dif(ax, bx0, d), ny = dif(ay, by0, d), nz = dif(az, bz0, d);
                    if (nx != nx || ny != ny || nz != nz) continue;
                    // una superficie de verdad: algún vecino medido del otro lado del cero (el final de la
                    // banda detrás de una pared tiene d ≈ −0.5 pero no cruza: no es superficie)
                    boolean cruza = ax == ax && (ax > 0) != (d > 0) || bx0 == bx0 && (bx0 > 0) != (d > 0) || ay == ay && (ay > 0) != (d > 0)
                            || by0 == by0 && (by0 > 0) != (d > 0) || az == az && (az > 0) != (d > 0) || bz0 == bz0 && (bz0 > 0) != (d > 0);
                    if (!cruza) continue;
                    float l = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
                    if (l < 1e-4f) continue;
                    nx /= l; ny /= l; nz /= l;
                    float cx = (gx + 0.5f) * vs - nx * d * tr, cy = (gy + 0.5f) * vs - ny * d * tr, cz = (gz + 0.5f) * vs - nz * d * tr;
                    m.agregar(cx, cy, cz, nx, ny, nz, gx, gy, gz, b.info[i] & 15);
                }
            }
        }
        return m;
    }

    // ── 2) regiones planas ──

    private static long clave(int x, int y, int z) { return Tsdf.clave(x, y, z); }

    private List<int[]> regionesPlanas(Muestras m, float vs) {
        HashMap<Long, Integer> donde = new HashMap<>(m.n * 2);
        for (int k = 0; k < m.n; k++) donde.put(clave(m.g[k * 3], m.g[k * 3 + 1], m.g[k * 3 + 2]), k);
        int[] region = new int[m.n];
        java.util.Arrays.fill(region, -1);
        ArrayList<int[]> res = new ArrayList<>();
        int[] cola = new int[m.n];
        int nr = 0;
        for (int s = 0; s < m.n; s++) {
            if (region[s] >= 0) continue;
            // la región crece desde s mientras la normal y la distancia al plano se parezcan
            double snx = m.nrm[s * 3], sny = m.nrm[s * 3 + 1], snz = m.nrm[s * 3 + 2];
            double spx = m.p[s * 3], spy = m.p[s * 3 + 1], spz = m.p[s * 3 + 2];
            int cuenta = 1, ini = 0, fin = 0;
            cola[fin++] = s;
            region[s] = nr;
            while (ini < fin) {
                int a = cola[ini++];
                int gx = m.g[a * 3], gy = m.g[a * 3 + 1], gz = m.g[a * 3 + 2];
                double nl = Math.sqrt(snx * snx + sny * sny + snz * snz);
                double rnx = snx / nl, rny = sny / nl, rnz = snz / nl;
                double cx = spx / cuenta, cy = spy / cuenta, cz = spz / cuenta;
                for (int dz = -1; dz <= 1; dz++) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0 && dz == 0) continue;
                    Integer bb = donde.get(clave(gx + dx, gy + dy, gz + dz));
                    if (bb == null || region[bb] >= 0) continue;
                    int b = bb;
                    double dot = m.nrm[b * 3] * rnx + m.nrm[b * 3 + 1] * rny + m.nrm[b * 3 + 2] * rnz;
                    if (dot < ANGULO) continue;
                    double dist = (m.p[b * 3] - cx) * rnx + (m.p[b * 3 + 1] - cy) * rny + (m.p[b * 3 + 2] - cz) * rnz;
                    if (Math.abs(dist) > 1.5 * vs) continue;
                    region[b] = nr;
                    cola[fin++] = b;
                    snx += m.nrm[b * 3]; sny += m.nrm[b * 3 + 1]; snz += m.nrm[b * 3 + 2];
                    spx += m.p[b * 3]; spy += m.p[b * 3 + 1]; spz += m.p[b * 3 + 2];
                    cuenta++;
                }
            }
            if (cuenta >= MIN_REGION) res.add(java.util.Arrays.copyOf(cola, fin));
            nr++;
        }
        return res;
    }

    // ── 3) y 4) la grilla de cada plano y sus huecos ──

    static final int VISTA = 1, CERRADA = 2, AIRE = 3, NOSE = 0, DEBAJO = 4, TAPADA = 5, BAJO_PARED = 6;
    /** Lo tapado (debajo de la mesa, detrás del sillón) se sella aunque sea grande: nunca se va a ver. */
    static final float AREA_TAPADA = 6f;
    /** Hasta qué distancia delante del plano se busca lo que lo tapa. */
    static final float ALCANCE_TAPA = 2f;
    /** Hasta cuántas celdas cerradas (tapadas por algo apoyado) se extiende el sellado alrededor del hueco. */
    static final int TAPADAS = 3;

    /** Busca los huecos (y, si sellar, sella los que se pueden). */
    public void buscar(Tsdf t, float px, float py, float pz, boolean sellar) {
        long t0 = System.nanoTime();
        float vs = t.voxel;
        Muestras m = muestras(t, px, py, pz);
        List<int[]> rs = regionesPlanas(m, vs);
        // el piso: la región horizontal (normal para arriba) con más muestras. Lo que queda debajo del
        // piso es sólido: cierra los huecos de las paredes que llegan hasta el suelo (detrás del sillón)
        float pisoY = Float.NaN;
        int mejorN = 0;
        for (int[] r : rs) {
            double ny = 0, y = 0;
            for (int k : r) { ny += m.nrm[k * 3 + 1]; y += m.p[k * 3 + 1]; }
            if (ny / r.length > 0.95 && r.length > mejorN && (pisoY != pisoY || y / r.length < pisoY + 0.3f)) { mejorN = r.length; pisoY = (float) (y / r.length); }
        }
        piso = pisoY;
        ArrayList<Hueco> todos = new ArrayList<>();
        int ps = 0, se = 0, fa = 0, ab = 0, po = 0;
        for (int[] r : rs) {
            List<Hueco> hs = huecosDe(t, m, r, sellar, pisoY);
            for (Hueco h : hs) {
                if (h.abiertas <= 2 && h.estado != ABERTURA) { po++; continue; }   // 1 o 2 celdas: un poro (sellado, sin listar)
                todos.add(h);
                if (h.estado == POR_SELLAR) ps++;
                else if (h.estado == SELLADO) se++;
                else if (h.estado == FALTA) fa++;
                else ab++;
            }
        }
        huecos = todos;
        porSellar = ps; sellados = se; faltan = fa; aberturas = ab; poros = po;
        regiones = rs.size();
        msUltimo = (System.nanoTime() - t0) / 1e6f;
    }

    private List<Hueco> huecosDe(Tsdf t, Muestras m, int[] r, boolean sellar, float pisoY) {
        float vs = t.voxel;
        // el plano: normal promedio, centro promedio
        double nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
        for (int k : r) { nx += m.nrm[k * 3]; ny += m.nrm[k * 3 + 1]; nz += m.nrm[k * 3 + 2]; cx += m.p[k * 3]; cy += m.p[k * 3 + 1]; cz += m.p[k * 3 + 2]; }
        double nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (DEPURAR) System.out.printf(java.util.Locale.ROOT, "región %d muestras, n (%.2f %.2f %.2f) parejo %.3f, centro (%.2f %.2f %.2f)%n", r.length,
                nx / nl, ny / nl, nz / nl, nl / r.length, cx / r.length, cy / r.length, cz / r.length);
        // ¿es un plano de verdad? las normales parejas (una esquina mezcla dos) y poco desvío del plano
        if (nl / r.length < 0.97) return Collections.emptyList();
        nx /= nl; ny /= nl; nz /= nl; cx /= r.length; cy /= r.length; cz /= r.length;
        double desvio = 0;
        for (int k : r) {
            double dd = (m.p[k * 3] - cx) * nx + (m.p[k * 3 + 1] - cy) * ny + (m.p[k * 3 + 2] - cz) * nz;
            desvio += dd * dd;
        }
        if (DEPURAR) System.out.printf(java.util.Locale.ROOT, "   desvío %.3f voxeles%n", Math.sqrt(desvio / r.length) / vs);
        if (Math.sqrt(desvio / r.length) > 0.6 * vs) return Collections.emptyList();
        // ejes del plano: u horizontal (si se puede), v = n × u
        double ux, uy, uz;
        if (Math.abs(ny) < 0.9) { ux = nz; uy = 0; uz = -nx; } else { ux = 1; uy = 0; uz = 0; ux -= nx * nx; uy -= nx * ny; uz -= nx * nz; }
        double ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
        ux /= ul; uy /= ul; uz /= ul;
        double vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
        // las celdas vistas
        int i0 = Integer.MAX_VALUE, j0 = Integer.MAX_VALUE, i1 = Integer.MIN_VALUE, j1 = Integer.MIN_VALUE;
        int[] ci = new int[r.length], cj = new int[r.length];
        HashMap<Integer, Integer> etiquetas = new HashMap<>();
        for (int q = 0; q < r.length; q++) {
            int k = r[q];
            double ax = m.p[k * 3] - cx, ay = m.p[k * 3 + 1] - cy, az = m.p[k * 3 + 2] - cz;
            ci[q] = (int) Math.floor((ax * ux + ay * uy + az * uz) / vs);
            cj[q] = (int) Math.floor((ax * vx + ay * vy + az * vz) / vs);
            i0 = Math.min(i0, ci[q]); i1 = Math.max(i1, ci[q]); j0 = Math.min(j0, cj[q]); j1 = Math.max(j1, cj[q]);
            etiquetas.merge(m.etq[k], 1, Integer::sum);
        }
        int etq = 0, mejor = -1;
        for (java.util.Map.Entry<Integer, Integer> e : etiquetas.entrySet()) if (e.getValue() > mejor) { mejor = e.getValue(); etq = e.getKey(); }
        // una tira (la esquina entre el piso y una pared, el canto de una mesa) no es un plano para sellar
        if (i1 - i0 < 4 || j1 - j0 < 4) return Collections.emptyList();
        // el margen: que el borde de la grilla llegue hasta lo que la cierra (la pared al final del
        // piso: la esquina misma casi nunca da muestras)
        i0 -= 4; j0 -= 4; i1 += 4; j1 += 4;
        int W = i1 - i0 + 1, H = j1 - j0 + 1;
        if ((long) W * H > 400_000) return Collections.emptyList();   // un plano enorme (no debería): se saltea
        byte[] c = new byte[W * H];
        for (int q = 0; q < r.length; q++) c[(cj[q] - j0) * W + (ci[q] - i0)] = VISTA;
        // lo que no se vio: ¿cerrado (algo sólido justo delante del plano), aire (se vio a través) o no se sabe?
        synchronized (t) {
            for (int j = 0; j < H; j++) for (int i = 0; i < W; i++) {
                int k = j * W + i;
                if (c[k] != NOSE) continue;
                double pu = (i + i0 + 0.5) * vs, pv = (j + j0 + 0.5) * vs;
                double qx = cx + ux * pu + vx * pv, qy = cy + uy * pu + vy * pv, qz = cz + uz * pu + vz * pv;
                // en una pared, lo que está a ras del piso o debajo está cerrado por el piso (la esquina
                // pared-piso casi nunca da muestras planas: mezcla las dos normales)
                c[k] = qy < pisoY + vs && Math.abs(ny) < 0.9 ? DEBAJO : (byte) celda(t, qx, qy, qz, nx, ny, nz, vs);
            }
        }
        if (DEPURAR && r.length > 1500) {
            StringBuilder sb = new StringBuilder();
            for (int j = H - 1; j >= 0; j--) { for (int i = 0; i < W; i++) sb.append(".#xa_tp".charAt(c[j * W + i])); sb.append('\n'); }
            System.out.print(sb);
        }
        // desde el borde, por lo que no está visto ni cerrado: eso es "afuera"
        boolean[] afuera = new boolean[W * H];
        int[] cola = new int[W * H];
        int ini = 0, fin = 0;
        for (int j = 0; j < H; j++) for (int i = 0; i < W; i++) {
            if (i != 0 && j != 0 && i != W - 1 && j != H - 1) continue;
            int k = j * W + i;
            if (c[k] != NOSE && c[k] != AIRE || afuera[k]) continue;
            afuera[k] = true; cola[fin++] = k;
        }
        while (ini < fin) {
            int k = cola[ini++], i = k % W, j = k / W;
            int[] vec = {k - 1, k + 1, k - W, k + W};
            for (int e = 0; e < 4; e++) {
                int q = vec[e];
                if (e == 0 && i == 0 || e == 1 && i == W - 1 || e == 2 && j == 0 || e == 3 && j == H - 1) continue;
                if (afuera[q] || c[q] != NOSE && c[q] != AIRE) continue;
                afuera[q] = true; cola[fin++] = q;
            }
        }
        // los huecos: lo encerrado que no se sabe (o es aire), en grupos; y aparte, lo tapado
        ArrayList<Hueco> res = new ArrayList<>();
        boolean[] usado = new boolean[W * H];
        for (int k0 = 0; k0 < W * H; k0++) {
            int c0 = c[k0];
            if (usado[k0] || afuera[k0] || c0 != NOSE && c0 != AIRE && c0 != TAPADA) continue;
            boolean tapada = c0 == TAPADA, borde = false;
            ini = 0; fin = 0;
            cola[fin++] = k0; usado[k0] = true;
            int nAire = 0;
            while (ini < fin) {
                int k = cola[ini++], i = k % W, j = k / W;
                if (c[k] == AIRE) nAire++;
                if (i == 0 || j == 0 || i == W - 1 || j == H - 1) borde = true;
                int[] vec = {k - 1, k + 1, k - W, k + W};
                for (int e = 0; e < 4; e++) {
                    int q = vec[e];
                    if (e == 0 && i == 0 || e == 1 && i == W - 1 || e == 2 && j == 0 || e == 3 && j == H - 1) continue;
                    if (usado[q] || afuera[q]) continue;
                    if (tapada ? c[q] != TAPADA : c[q] != NOSE && c[q] != AIRE) continue;
                    usado[q] = true; cola[fin++] = q;
                }
            }
            if (borde) continue;   // lo tapado que sigue más allá de lo escaneado: no se sabe hasta dónde
            int nose = fin;
            // lo tapado alrededor (el piso debajo de la mochila, la pared detrás del sillón, donde
            // el objeto la toca): celdas cerradas pegadas al hueco, hasta TAPADAS celdas
            if (nAire <= FRACCION_AIRE * nose) {
                int desde = 0;
                for (int paso = 0; paso < TAPADAS; paso++) {
                    int hasta = fin;
                    for (int x = desde; x < hasta; x++) {
                        int k = cola[x], i = k % W, j = k / W;
                        int[] vec = {k - 1, k + 1, k - W, k + W};
                        for (int e = 0; e < 4; e++) {
                            int q = vec[e];
                            if (e == 0 && i == 0 || e == 1 && i == W - 1 || e == 2 && j == 0 || e == 3 && j == H - 1) continue;
                            if (usado[q] || c[q] != CERRADA) continue;
                            usado[q] = true; cola[fin++] = q;
                        }
                    }
                    desde = hasta;
                }
            }
            Hueco h = new Hueco();
            h.celda = vs;
            h.ox = (float) (cx + ux * i0 * vs + vx * j0 * vs); h.oy = (float) (cy + uy * i0 * vs + vy * j0 * vs); h.oz = (float) (cz + uz * i0 * vs + vz * j0 * vs);
            h.ux = (float) ux; h.uy = (float) uy; h.uz = (float) uz; h.vx = (float) vx; h.vy = (float) vy; h.vz = (float) vz;
            h.nx = (float) nx; h.ny = (float) ny; h.nz = (float) nz;
            h.celdas = new int[fin * 2];
            float sx = 0, sy = 0, sz = 0;
            for (int q = 0; q < fin; q++) {
                int k = cola[q];
                h.celdas[q * 2] = k % W; h.celdas[q * 2 + 1] = k / W;
                sx += h.ox + (h.ux * (k % W + 0.5f) + h.vx * (k / W + 0.5f)) * vs;
                sy += h.oy + (h.uy * (k % W + 0.5f) + h.vy * (k / W + 0.5f)) * vs;
                sz += h.oz + (h.uz * (k % W + 0.5f) + h.vz * (k / W + 0.5f)) * vs;
            }
            h.cx = sx / fin; h.cy = sy / fin; h.cz = sz / fin;
            h.area = nose * vs * vs;   // lo que no se sabe (lo tapado no cuenta)
            h.abiertas = nose;
            if (nAire > FRACCION_AIRE * nose) h.estado = ABERTURA;
            else if (h.area > (tapada ? AREA_TAPADA : AREA_MAX)) h.estado = FALTA;
            else {
                // −1: ya estaba sellado de antes; si se sella ahora (o ya estaba), queda SELLADO
                int escritos = sellarHueco(t, h, etq, sellar);
                h.estado = escritos < 0 || sellar ? SELLADO : POR_SELLAR;
                h.recien = sellar && escritos > 0;
            }
            res.add(h);
        }
        return res;
    }

    /** Cómo está una celda que no tiene superficie: CERRADA, TAPADA, AIRE o NOSE. (Con el candado del volumen.) */
    private static int celda(Tsdf t, double x, double y, double z, double nx, double ny, double nz, float vs) {
        // aire medido EN el plano: se vio a través
        int gx = Tsdf.pisoDe((float) (x / vs)), gy = Tsdf.pisoDe((float) (y / vs)), gz = Tsdf.pisoDe((float) (z / vs));
        Tsdf.Bloque b = t.bloqueSinCandado(gx >> 4, gy >> 4, gz >> 4);
        if (b != null) {
            int i = ((gz & 15) * 16 + (gy & 15)) * 16 + (gx & 15);
            if ((b.info[i] & Tsdf.INFERIDO) == 0 && b.w[i] >= 2 && (b.info[i] & Tsdf.AIRE) != 0) return AIRE;
        }
        // algo sólido medido justo delante (o en el plano): otra superficie lo cierra
        for (float k : new float[]{0f, 1.5f, 2.5f}) {
            float d = medido(t, Tsdf.pisoDe((float) ((x + nx * k * vs) / vs)), Tsdf.pisoDe((float) ((y + ny * k * vs) / vs)),
                    Tsdf.pisoDe((float) ((z + nz * k * vs) / vs)));
            if (d == d && d < -0.2f) return CERRADA;
        }
        // más adelante: si antes de ver aire se encuentra algo sólido, el plano está TAPADO por
        // un objeto (la tapa de la mesa sobre el piso, el sillón delante de la pared)
        int pasos = (int) (ALCANCE_TAPA / vs);
        for (int k = 3; k <= pasos; k++) {
            int ax = Tsdf.pisoDe((float) ((x + nx * k * vs) / vs)), ay = Tsdf.pisoDe((float) ((y + ny * k * vs) / vs)), az = Tsdf.pisoDe((float) ((z + nz * k * vs) / vs));
            Tsdf.Bloque bl = t.bloqueSinCandado(ax >> 4, ay >> 4, az >> 4);
            if (bl == null) continue;
            int i = ((az & 15) * 16 + (ay & 15)) * 16 + (ax & 15);
            if (bl.w[i] < PESO_MIN || (bl.info[i] & Tsdf.INFERIDO) != 0) continue;
            if ((bl.info[i] & Tsdf.AIRE) != 0 || bl.d[i] > 0.5f) return NOSE;   // se vio aire: no hay nada delante
            if (bl.d[i] < -0.05f) {
                // tapa de verdad si esa superficie mira para el plano (la tapa de la mesa, el frente
                // del sillón); si mira para el costado y está pegada, la celda está debajo de una pared
                float d0 = bl.d[i];
                float ex = dif(medido(t, ax + 1, ay, az), medido(t, ax - 1, ay, az), d0);
                float ey = dif(medido(t, ax, ay + 1, az), medido(t, ax, ay - 1, az), d0);
                float ez = dif(medido(t, ax, ay, az + 1), medido(t, ax, ay, az - 1), d0);
                float el = (float) Math.sqrt(ex * ex + ey * ey + ez * ez);
                // (pegado al plano, casi siempre es eso: la celda está adentro de la pared; más lejos,
                // es un objeto encima, aunque la normal medida sea ruidosa)
                float cos = el != el || el < 1e-4f ? 0 : (float) ((ex * nx + ey * ny + ez * nz) / el);
                if (k <= 5) return cos > 0.7f ? TAPADA : BAJO_PARED;
                return cos > -0.3f ? TAPADA : NOSE;
            }
        }
        return NOSE;
    }

    /**
     * Sella un hueco con su plano: voxeles supuestos a la distancia firmada
     * del plano, en la banda. Devuelve cuántos escribió, o −1 si ya estaba
     * sellado (casi todo lo que haría falta ya es supuesto). Con escribir =
     * false sólo cuenta.
     */
    private static int sellarHueco(Tsdf t, Hueco h, int etq, boolean escribir) {
        float vs = t.voxel, tr = t.trunc;
        HashSet<Long> vistos = new HashSet<>();
        int total = 0, yaSupuestos = 0, escritos = 0;
        synchronized (t) {
            for (int q = 0; q < h.celdas.length; q += 2) {
                for (int a = 0; a < 2; a++) for (int b = 0; b < 2; b++) {
                    float pu = (h.celdas[q] + 0.25f + 0.5f * a) * vs, pv = (h.celdas[q + 1] + 0.25f + 0.5f * b) * vs;
                    float px = h.ox + h.ux * pu + h.vx * pv, py = h.oy + h.uy * pu + h.vy * pv, pz = h.oz + h.uz * pu + h.vz * pv;
                    for (float s = -tr; s <= tr; s += vs * 0.5f) {
                        int gx = Tsdf.pisoDe((px + h.nx * s) / vs), gy = Tsdf.pisoDe((py + h.ny * s) / vs), gz = Tsdf.pisoDe((pz + h.nz * s) / vs);
                        if (!vistos.add(Tsdf.clave(gx, gy, gz))) continue;
                        // la distancia firmada del centro del voxel al plano
                        float dist = ((gx + 0.5f) * vs - h.ox) * h.nx + ((gy + 0.5f) * vs - h.oy) * h.ny + ((gz + 0.5f) * vs - h.oz) * h.nz;
                        // del lado sólido toda la banda; del lado libre, dos voxeles (lo justo para el
                        // cruce por cero y para interpolarlo: no se supone aire de más)
                        if (dist < -tr || dist > 2 * vs) continue;
                        Tsdf.Bloque bl = t.bloqueSinCandado(gx >> 4, gy >> 4, gz >> 4);
                        int i = ((gz & 15) * 16 + (gy & 15)) * 16 + (gx & 15);
                        boolean inf = bl != null && (bl.info[i] & Tsdf.INFERIDO) != 0;
                        // libre: nunca visto, supuesto o visto tan poco que no cuenta (no es aire)
                        boolean libre = bl == null || bl.w[i] == 0 || inf || bl.w[i] < PESO_MIN && (bl.info[i] & Tsdf.AIRE) == 0;
                        if (!libre) continue;   // lo medido no se toca
                        total++;
                        if (inf) yaSupuestos++;
                        if (escribir && t.inferirSinCandado(gx, gy, gz, Math.max(-1f, Math.min(1f, dist / tr)), etq, PESO_MIN)) escritos++;
                    }
                }
            }
        }
        if (total > 0 && yaSupuestos >= 0.8f * total) return -1;
        return escritos;
    }
}
