package com.juniorspro.asaltomr;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Random;

/**
 * El mapa de zonas: lo que entiende la IA del entorno escaneado.
 *
 * Una grilla de celdas de 25 cm alrededor del jugador (20 × 20 m). Para cada
 * celda mira las columnas de voxeles MEDIDOS y decide qué es:
 *
 *   SUELO      hay piso cerca de la altura del piso del lugar y nada encima
 *   OBSTÁCULO  algo sólido entre 30 cm y 1.9 m sobre el piso (árbol, pared, mesa)
 *   AGUA       piso que la red semántica de ARCore dice que es agua
 *   ?          no se vio
 *
 * y con la etiqueta semántica votada en los voxeles (pasto, vereda, calle,
 * árbol, edificio…).
 *
 * Después:
 *  1. COMPLETA lo que no se ve (si rellenar): el piso se extiende desde lo
 *     visto hacia lo no visto (debajo y detrás de las cosas, hasta 2 m), los
 *     obstáculos se completan por detrás (hasta 50 cm) y todo obstáculo es
 *     sólido hasta el piso. Lo supuesto se escribe en el volumen como
 *     INFERIDO: sale en la malla (dibujado distinto) y el juego lo usa, pero
 *     cualquier medición de verdad lo reemplaza.
 *  2. Las ZONAS para la IA de los soldados: por dónde se puede ir (con la
 *     altura de cada paso), qué es alcanzable desde el jugador, dónde hay
 *     CUBIERTA (algo alto entre la celda y el jugador que tapa la línea de
 *     tiro), y RUTAS con A*.
 *  3. La COBERTURA del escaneo: las "fronteras" (lo no visto al lado de piso
 *     visto) dicen cuánto falta y hacia dónde mirar.
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaMapa.java). Corre en el hilo
 * del escaneo; el juego lee la última Grilla (inmutable) sin candados.
 */
public final class Mapa {
    public static final int DESCONOCIDO = 0, SUELO = 1, OBSTACULO = 2, AGUA = 3;
    public static final float CELDA = 0.25f;
    public static final int N = 80;                   // 80 × 0.25 = 20 m de lado

    /** Una foto del mapa. No cambia: el juego la usa mientras el escaneo arma la siguiente. */
    public static final class Grilla {
        public final int n = N, i0, k0;                // celda (i, k) global = (i0 + i, k0 + k)
        public final byte[] clase = new byte[N * N];
        public final boolean[] inferida = new boolean[N * N];
        public final boolean[] cubierta = new boolean[N * N];
        public final boolean[] frontera = new boolean[N * N];
        public final boolean[] alcanzable = new boolean[N * N];
        public final byte[] etiqueta = new byte[N * N];
        public final float[] piso = new float[N * N], alto = new float[N * N];
        /** La altura más baja (sobre el piso y sobre lo ocupado) donde se MIDIÓ aire: ahí no puede haber nada. */
        public final float[] libre = new float[N * N];
        public float pisoRef = Float.NaN;
        public int version;
        /** Cobertura del escaneo (0..1) y hacia dónde falta (vector en XZ, largo = cuánto). */
        public float cobertura, faltaX, faltaZ;
        /** Qué parte de lo que falta está a menos de 2 m (el piso a tus pies: "mirá abajo"). */
        public float faltaCerca;
        public int vistas, fronteras, cubiertas, inferidas;
        final float jx, jz;

        Grilla(int i0, int k0, float jx, float jz) { this.i0 = i0; this.k0 = k0; this.jx = jx; this.jz = jz; }

        public float x(int i) { return (i0 + i + 0.5f) * CELDA; }

        public float z(int k) { return (k0 + k + 0.5f) * CELDA; }

        /** Índice de la celda de un punto, o −1 si cae afuera. */
        public int indice(float x, float z) {
            int i = Tsdf.pisoDe(x / CELDA) - i0, k = Tsdf.pisoDe(z / CELDA) - k0;
            return i < 0 || k < 0 || i >= N || k >= N ? -1 : k * N + i;
        }

        public boolean caminable(int c) { return c >= 0 && clase[c] == SUELO; }

        /**
         * Ruta A* por celdas caminables, de (x0,z0) a (x1,z1). Devuelve los
         * puntos (x, y, z) por donde pasar (sin el de partida), o null.
         * Paso máximo entre celdas: 35 cm de altura. Lo inferido cuesta un
         * poco más (se prefiere lo que se vio) y pegarse a obstáculos también.
         */
        public float[] camino(float x0, float z0, float x1, float z1) {
            int a = indice(x0, z0), b = indice(x1, z1);
            if (a < 0 || b < 0 || !caminable(b)) return null;
            if (!caminable(a)) a = vecinoCaminable(a);
            if (a < 0) return null;
            float[] g = new float[N * N];
            Arrays.fill(g, Float.MAX_VALUE);
            int[] de = new int[N * N];
            Arrays.fill(de, -1);
            boolean[] cerrado = new boolean[N * N];
            Monticulo abierto = new Monticulo(N * N);
            g[a] = 0;
            abierto.poner(a, h(a, b));
            int bi = b % N, bk = b / N;
            while (!abierto.vacio()) {
                int c = abierto.sacar();
                if (c == b) break;
                if (cerrado[c]) continue;
                cerrado[c] = true;
                int ci = c % N, ck = c / N;
                for (int dk = -1; dk <= 1; dk++) for (int di = -1; di <= 1; di++) {
                    if (di == 0 && dk == 0) continue;
                    int ni = ci + di, nk = ck + dk;
                    if (ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                    int v = nk * N + ni;
                    if (cerrado[v] || !caminable(v)) continue;
                    if (Math.abs(piso[v] - piso[c]) > 0.35f) continue;
                    // en diagonal no se cortan esquinas de obstáculos
                    if (di != 0 && dk != 0 && (!caminable(ck * N + ni) || !caminable(nk * N + ci))) continue;
                    float costo = (di != 0 && dk != 0) ? 1.414f : 1f;
                    if (inferida[v]) costo *= 1.3f;
                    if (pegadoAObstaculo(ni, nk)) costo += 0.6f;
                    float ng = g[c] + costo;
                    if (ng < g[v]) { g[v] = ng; de[v] = c; abierto.poner(v, ng + h(v, b)); }
                }
            }
            if (de[b] < 0 && a != b) return null;
            ArrayList<Integer> cel = new ArrayList<>();
            for (int c = b; c != a && c >= 0; c = de[c]) cel.add(c);
            float[] r = new float[cel.size() * 3];
            for (int j = 0; j < cel.size(); j++) {
                int c = cel.get(cel.size() - 1 - j);
                r[j * 3] = x(c % N); r[j * 3 + 1] = piso[c]; r[j * 3 + 2] = z(c / N);
            }
            return suavizar(r, bi, bk);
        }

        /** Saca puntos intermedios en línea recta (la ruta queda con menos zigzag). */
        private float[] suavizar(float[] r, int bi, int bk) {
            int n = r.length / 3;
            if (n <= 2) return r;
            ArrayList<float[]> q = new ArrayList<>();
            int ancla = 0;
            q.add(new float[]{r[0], r[1], r[2]});
            for (int j = 2; j < n; j++) {
                if (!rectaLibre(r[ancla * 3], r[ancla * 3 + 2], r[j * 3], r[j * 3 + 2])) {
                    q.add(new float[]{r[(j - 1) * 3], r[(j - 1) * 3 + 1], r[(j - 1) * 3 + 2]});
                    ancla = j - 1;
                }
            }
            q.add(new float[]{r[(n - 1) * 3], r[(n - 1) * 3 + 1], r[(n - 1) * 3 + 2]});
            float[] s = new float[q.size() * 3];
            for (int j = 0; j < q.size(); j++) System.arraycopy(q.get(j), 0, s, j * 3, 3);
            return s;
        }

        /** ¿La recta entre dos puntos pasa sólo por celdas caminables (y sin escalones)? */
        public boolean rectaLibre(float x0, float z0, float x1, float z1) {
            float d = (float) Math.hypot(x1 - x0, z1 - z0);
            int pasos = Math.max(1, (int) (d / (CELDA * 0.4f)));
            float ant = Float.NaN;
            for (int j = 0; j <= pasos; j++) {
                float t = j / (float) pasos;
                int c = indice(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
                if (!caminable(c) || pegadoAObstaculo(c % N, c / N)) return false;
                if (ant == ant && Math.abs(piso[c] - ant) > 0.35f) return false;
                ant = piso[c];
            }
            return true;
        }

        boolean pegadoAObstaculo(int i, int k) {
            for (int dk = -1; dk <= 1; dk++) for (int di = -1; di <= 1; di++) {
                int ni = i + di, nk = k + dk;
                if (ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                if (clase[nk * N + ni] == OBSTACULO) return true;
            }
            return false;
        }

        private int vecinoCaminable(int c) {
            int ci = c % N, ck = c / N;
            for (int r = 1; r <= 3; r++)
                for (int dk = -r; dk <= r; dk++) for (int di = -r; di <= r; di++) {
                    int ni = ci + di, nk = ck + dk;
                    if (ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                    if (caminable(nk * N + ni)) return nk * N + ni;
                }
            return -1;
        }

        private float h(int a, int b) { return (float) Math.hypot(a % N - b % N, a / N - b / N); }

        /**
         * Un lugar para que aparezca un soldado: caminable, alcanzable desde el
         * jugador, entre dMin y dMax, dentro de ±80° de adonde mira. {x,y,z} o null.
         */
        public float[] lugarParaAparecer(Random azar, float px, float pz, float fx, float fz, float dMin, float dMax) {
            float fl = (float) Math.hypot(fx, fz);
            if (fl < 1e-3f) { fx = 0; fz = -1; fl = 1; }
            fx /= fl; fz /= fl;
            int[] cand = new int[N * N];
            int n = 0;
            // primero donde se vio de verdad; si no hay, también en lo supuesto
            for (int pasada = 0; pasada < 2 && n == 0; pasada++)
            for (int c = 0; c < N * N; c++) {
                if (!alcanzable[c] || (pasada == 0 && inferida[c])) continue;
                float dx = x(c % N) - px, dz = z(c / N) - pz;
                float d = (float) Math.hypot(dx, dz);
                if (d < dMin || d > dMax) continue;
                if ((dx * fx + dz * fz) / d < 0.17f) continue;   // ±80°
                if (pegadoAObstaculo(c % N, c / N)) continue;
                cand[n++] = c;
            }
            if (n == 0) return null;
            int c = cand[azar.nextInt(n)];
            return new float[]{x(c % N), piso[c], z(c / N)};
        }

        /** La cubierta libre más conveniente para un soldado en (sx, sz): cerca de él, a 3–8 m del jugador. */
        public int mejorCubierta(float sx, float sz, float px, float pz, boolean[] tomadas) {
            int mejor = -1;
            float mejorPuntos = Float.MAX_VALUE;
            for (int c = 0; c < N * N; c++) {
                if (!cubierta[c] || !alcanzable[c] || (tomadas != null && tomadas[c])) continue;
                float x = x(c % N), z = z(c / N);
                float dj = (float) Math.hypot(x - px, z - pz);
                if (dj < 3f || dj > 8f) continue;
                float ds = (float) Math.hypot(x - sx, z - sz);
                float puntos = ds + Math.abs(dj - 5f) * 0.5f;
                if (puntos < mejorPuntos) { mejorPuntos = puntos; mejor = c; }
            }
            return mejor;
        }
    }

    /** Montículo de mínimos para A*. */
    private static final class Monticulo {
        final int[] item; final float[] pri; int n;

        Monticulo(int cap) { item = new int[cap * 8]; pri = new float[cap * 8]; }

        boolean vacio() { return n == 0; }

        void poner(int x, float p) {
            if (n >= item.length) return;
            int i = n++;
            item[i] = x; pri[i] = p;
            while (i > 0) {
                int pa = (i - 1) / 2;
                if (pri[pa] <= pri[i]) break;
                cambiar(i, pa);
                i = pa;
            }
        }

        int sacar() {
            int r = item[0];
            n--;
            item[0] = item[n]; pri[0] = pri[n];
            int i = 0;
            while (true) {
                int a = 2 * i + 1, b = a + 1, m = i;
                if (a < n && pri[a] < pri[m]) m = a;
                if (b < n && pri[b] < pri[m]) m = b;
                if (m == i) break;
                cambiar(i, m);
                i = m;
            }
            return r;
        }

        private void cambiar(int a, int b) {
            int t = item[a]; item[a] = item[b]; item[b] = t;
            float p = pri[a]; pri[a] = pri[b]; pri[b] = p;
        }
    }

    // ───────────────────────── armar el mapa ─────────────────────────

    public volatile Grilla actual;
    public volatile boolean rellenar = true;
    /** Lo último que se escribió como inferido en cada celda (clave global) → {clase, piso, alto}. */
    private final HashMap<Long, float[]> escritas = new HashMap<>();
    private int version;
    public volatile float msUltimo;

    private static long claveCelda(int gi, int gk) { return ((long) gi << 32) ^ (gk & 0xFFFFFFFFL); }

    /** Vuelve a empezar (otro escaneo). */
    public synchronized void olvidar() {
        escritas.clear();
        actual = null;
    }

    /**
     * Arma un mapa nuevo alrededor del jugador (px, py, pz) mirando (fx, fz).
     * Si rellenar, escribe lo supuesto en el volumen (y lo marca para re-mallar).
     */
    public synchronized Grilla actualizar(Tsdf t, float px, float py, float pz, float fx, float fz) {
        long t0 = System.nanoTime();
        int i0 = Tsdf.pisoDe(px / CELDA) - N / 2, k0 = Tsdf.pisoDe(pz / CELDA) - N / 2;
        Grilla g = new Grilla(i0, k0, px, pz);
        g.version = ++version;
        final float vs = t.voxel;
        final int gyArriba = Tsdf.pisoDe((py + 0.3f) / vs), gyAbajo = Tsdf.pisoDe((py - 3.2f) / vs);
        final int alturaCol = gyArriba - gyAbajo + 1;
        float[] col = new float[alturaCol];
        // 5 columnas por celda: el centro y cuatro alrededor (un tronco finito no se escapa)
        final float[][] offs = {{0, 0}, {-0.3f, -0.3f}, {0.3f, -0.3f}, {-0.3f, 0.3f}, {0.3f, 0.3f}};

        {
            // (el candado del volumen se toma de a una columna: el juego nunca espera más que eso)
            // 1) el piso del lugar: la moda de la superficie hacia arriba más baja de cada columna
            int[] histo = new int[80];            // de py−3.2 a py−0.8 en pasos de 3 cm
            float[] bajo = new float[N * N];
            Arrays.fill(bajo, Float.NaN);
            for (int c = 0; c < N * N; c++) {
                float x = g.x(c % N), z = g.z(c / N);
                leerColumna(t, x, z, gyAbajo, alturaCol, col);
                float y = superficieMasBaja(col, gyAbajo, vs, py - 0.8f);
                bajo[c] = y;
                if (y == y) { int b = (int) ((y - (py - 3.2f)) / 0.03f); if (b >= 0 && b < histo.length) histo[b]++; }
            }
            int mb = -1, mv = 0;
            for (int b = 0; b < histo.length; b++) {
                int v = histo[b] + (b > 0 ? histo[b - 1] : 0) + (b + 1 < histo.length ? histo[b + 1] : 0);
                if (v > mv) { mv = v; mb = b; }
            }
            if (mv >= 12) g.pisoRef = py - 3.2f + (mb + 0.5f) * 0.03f;

            // 2) clasificar cada celda con lo medido
            float[] ocupadoHasta = new float[N * N];
            boolean[] sinTapaC = new boolean[N * N];
            if (g.pisoRef == g.pisoRef) {
                float ref = g.pisoRef;
                for (int c = 0; c < N * N; c++) {
                    float x = g.x(c % N), z = g.z(c / N);
                    float sumaPiso = 0; int nPiso = 0; float altoTapa = -1, altoOcupado = -1, libre = Float.NaN;
                    int[] votos = new int[16];
                    for (float[] o : offs) {
                        float colOcupado = ref + 0.2f, colLibre = Float.NaN;
                        float cx = x + o[0] * CELDA, cz = z + o[1] * CELDA;
                        leerColumna(t, cx, cz, gyAbajo, alturaCol, col);
                        int gx = Tsdf.pisoDe(cx / vs), gz = Tsdf.pisoDe(cz / vs);
                        // superficies hacia arriba y voxeles ocupados
                        for (int j = alturaCol - 1; j >= 1; j--) {
                            float arriba = col[j], abajo = col[j - 1];
                            float yj = (gyAbajo + j + 0.5f) * vs;
                            if (arriba == arriba && abajo == abajo && arriba > 0 && abajo <= 0) {
                                float y = yj - vs * arriba / (arriba - abajo);
                                if (Math.abs(y - ref) < 0.3f) {
                                    sumaPiso += y; nPiso++;
                                    votos[t.etiquetaVoxel(gx, gyAbajo + j - 1, gz)]++;
                                } else if (y > ref + 0.3f && y < ref + 2.5f) {
                                    altoTapa = Math.max(altoTapa, y);   // una tapa: se vio aire encima
                                }
                            }
                            if (abajo == abajo && abajo < -0.2f) {
                                float yb = (gyAbajo + j - 1 + 0.5f) * vs;
                                if (yb > ref + 0.3f && yb < ref + 1.9f) {
                                    altoOcupado = Math.max(altoOcupado, yb + vs * 0.5f);
                                    votos[t.etiquetaVoxel(gx, gyAbajo + j - 1, gz)]++;
                                }
                                if (yb > colOcupado) colOcupado = yb;
                            }
                        }
                        // el aire medido más bajo por encima de lo ocupado de esta columna
                        for (int j = 0; j < alturaCol; j++) {
                            float v = col[j], yj = (gyAbajo + j + 0.5f) * vs;
                            if (yj > colOcupado && v == v && v > 0.5f) { colLibre = yj; break; }
                        }
                        if (colLibre == colLibre && !(libre < colLibre)) libre = colLibre;
                    }
                    g.libre[c] = libre;
                    int e = 0;
                    for (int q = 1; q < 16; q++) if (votos[q] > votos[e]) e = q;
                    g.etiqueta[c] = (byte) e;
                    if (altoTapa > 0 || altoOcupado > 0) {
                        g.clase[c] = OBSTACULO;
                        // si no se vio aire encima de lo ocupado (la tapa), no se sabe dónde termina:
                        // se supone alto (pared, árbol, edificio). Si no, lo supuesto le inventaría un techo.
                        boolean sinTapa = altoOcupado > altoTapa + vs * 1.5f;
                        g.alto[c] = sinTapa || altoTapa >= ref + 1.8f ? ref + 2.6f : Math.max(altoTapa, altoOcupado);
                        if (sinTapa && libre == libre && libre > altoOcupado) g.alto[c] = Math.min(g.alto[c], libre);
                        ocupadoHasta[c] = altoOcupado;
                        sinTapaC[c] = sinTapa;
                        g.piso[c] = nPiso > 0 ? sumaPiso / nPiso : ref;
                    } else if (nPiso > 0) {
                        g.piso[c] = sumaPiso / nPiso;
                        g.clase[c] = (byte) (e == Tsdf.AGUA ? AGUA : SUELO);
                    } else {
                        g.clase[c] = DESCONOCIDO;
                        g.piso[c] = ref;
                    }
                    if (g.clase[c] != DESCONOCIDO) g.vistas++;
                }
                // Una columna sin tapa pegada a un objeto CON tapa, y que no pasa de su
                // altura, es el borde de sombra de ese objeto (la banda de atrás de la
                // superficie que se cuela pasando el borde), no una pared: toma su altura.
                for (int pasada = 0; pasada < 2; pasada++)
                for (int c = 0; c < N * N; c++) {
                    if (!sinTapaC[c]) continue;
                    int ci = c % N, ck = c / N;
                    float mejor = -1;
                    for (int dk = -1; dk <= 1; dk++) for (int di = -1; di <= 1; di++) {
                        int ni = ci + di, nk = ck + dk;
                        if ((di == 0 && dk == 0) || ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                        int v = nk * N + ni;
                        if (g.clase[v] == OBSTACULO && !sinTapaC[v] && ocupadoHasta[c] <= g.alto[v] + 2 * vs) mejor = Math.max(mejor, g.alto[v]);
                    }
                    if (mejor > 0) { g.alto[c] = mejor; sinTapaC[c] = false; }
                }
            }
        }

        if (g.pisoRef == g.pisoRef) {
            fronteras(g);
            if (rellenar) completar(g);
            escribirInferido(t, g);
            zonasDeLaIA(t, g, px, py, pz);
        }
        actual = g;
        msUltimo = (System.nanoTime() - t0) / 1e6f;
        return g;
    }

    /** Los valores MEDIDOS de una columna de voxeles (NaN = no se vio; lo inferido no cuenta). */
    private static void leerColumna(Tsdf t, float x, float z, int gyAbajo, int alto, float[] col) {
        int gx = Tsdf.pisoDe(x / t.voxel), gz = Tsdf.pisoDe(z / t.voxel);
        synchronized (t) {
            for (int j = 0; j < alto; j++) col[j] = t.estadoSinCandado(gx, gyAbajo + j, gz, true);
        }
    }

    private static float superficieMasBaja(float[] col, int gyAbajo, float vs, float techo) {
        for (int j = 1; j < col.length; j++) {
            float abajo = col[j - 1], arriba = col[j];
            if (abajo == abajo && arriba == arriba && abajo <= 0 && arriba > 0) {
                float y = (gyAbajo + j + 0.5f) * vs - vs * arriba / (arriba - abajo);
                return y < techo ? y : Float.NaN;
            }
        }
        return Float.NaN;
    }

    /**
     * Fronteras: celdas no vistas pegadas a suelo visto. Lo que falta escanear
     * es lo no visto a menos de 6 m que se llega desde una frontera sin cruzar
     * nada visto (incluido donde estás parado y lo de atrás tuyo): la
     * cobertura es visto / (visto + eso), y la dirección para mirar es hacia
     * donde está eso, desde el jugador.
     */
    private static void fronteras(Grilla g) {
        int[] cola = new int[N * N];
        int[] prof = new int[N * N];
        Arrays.fill(prof, -1);
        int a = 0, b = 0, vistasCerca = 0;
        for (int k = 0; k < N; k++) for (int i = 0; i < N; i++) {
            int c = k * N + i;
            g.frontera[c] = false;
            boolean cerca = Math.hypot(g.x(i) - g.jx, g.z(k) - g.jz) < 6f;
            if (g.clase[c] != DESCONOCIDO) { if (cerca) vistasCerca++; continue; }
            for (int dk = -1; dk <= 1 && !g.frontera[c]; dk++) for (int di = -1; di <= 1; di++) {
                int ni = i + di, nk = k + dk;
                if (ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                if (g.clase[nk * N + ni] == SUELO) { g.frontera[c] = true; break; }
            }
            if (g.frontera[c]) { prof[c] = 0; cola[b++] = c; g.fronteras++; }
        }
        // de las fronteras hacia lo no visto, sin salir de los 6 m
        int falta = 0, cerca = 0;
        float fx = 0, fz = 0;
        while (a < b) {
            int c = cola[a++], ci = c % N, ck = c / N;
            float dx = g.x(ci) - g.jx, dz = g.z(ck) - g.jz, d = (float) Math.hypot(dx, dz);
            if (d >= 6f) continue;
            falta++;
            if (d < 2f) cerca++;
            if (d > 0.5f) { fx += dx / d; fz += dz / d; }
            for (int q = 0; q < 4; q++) {
                int ni = ci + (q == 0 ? 1 : q == 1 ? -1 : 0), nk = ck + (q == 2 ? 1 : q == 3 ? -1 : 0);
                if (ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                int v = nk * N + ni;
                if (prof[v] >= 0 || g.clase[v] != DESCONOCIDO) continue;
                prof[v] = prof[c] + 1;
                cola[b++] = v;
            }
        }
        g.cobertura = vistasCerca == 0 ? 0 : vistasCerca / (float) (vistasCerca + falta);
        g.faltaCerca = falta == 0 ? 0 : cerca / (float) falta;
        float l = (float) Math.hypot(fx, fz);
        if (l > 0) {
            float cuanto = Math.min(1f, falta / 60f);
            g.faltaX = fx / l * cuanto;
            g.faltaZ = fz / l * cuanto;
        }
    }

    /**
     * La IA de completado: cada celda no vista toma lo que dicen sus vecinas
     * (vistas o ya completadas), por pasadas: el piso avanza hasta 2 m (8
     * pasadas), los obstáculos sólo 50 cm (2 pasadas: completan su parte de
     * atrás, no inventan paredes). Reglas:
     *  - nunca contra aire medido (si un rayo pasó por ahí, ahí no hay nada);
     *  - en la sombra de algo alto (pared, árbol) el piso entra 75 cm: detrás
     *    de un tronco se completa, detrás de una pared no se inventa un patio;
     *  - hasta 7 m del jugador (más lejos la profundidad es puro ruido).
     */
    private static void completar(Grilla g) {
        // la sombra de lo alto (pared, árbol) vista desde el jugador: ahí el piso entra poco
        boolean[] sombraAlta = new boolean[N * N];
        int pi = Tsdf.pisoDe(g.jx / CELDA) - g.i0, pk = Tsdf.pisoDe(g.jz / CELDA) - g.k0;
        for (int c = 0; c < N * N; c++) {
            if (g.clase[c] != DESCONOCIDO) continue;
            int ci = c % N, ck = c / N;
            int pasos = Math.max(Math.abs(ci - pi), Math.abs(ck - pk));
            for (int q = 1; q < pasos; q++) {
                int qi = pi + Math.round((ci - pi) * q / (float) pasos), qk = pk + Math.round((ck - pk) * q / (float) pasos);
                if (qi < 0 || qk < 0 || qi >= N || qk >= N) continue;
                int v = qk * N + qi;
                if (g.clase[v] == OBSTACULO && g.alto[v] - g.piso[v] > 1.7f) { sombraAlta[c] = true; break; }
            }
        }
        int[] distObs = new int[N * N];
        Arrays.fill(distObs, 99);
        for (int c = 0; c < N * N; c++) if (g.clase[c] == OBSTACULO) distObs[c] = 0;
        byte[] clase = g.clase.clone();
        float[] piso = g.piso.clone(), alto = g.alto.clone();
        for (int pasada = 1; pasada <= 8; pasada++) {
            byte[] nClase = clase.clone();
            float[] nPiso = piso.clone(), nAlto = alto.clone();
            int[] nDist = distObs.clone();
            boolean hubo = false;
            for (int k = 0; k < N; k++) for (int i = 0; i < N; i++) {
                int c = k * N + i;
                if (clase[c] != DESCONOCIDO) continue;
                if (Math.hypot(g.x(i) - g.jx, g.z(k) - g.jz) > 7f) continue;   // más lejos, los datos no dan para suponer
                float wSuelo = 0, wObs = 0, sp = 0, spw = 0, sa = 0, saw = 0;
                int dMin = 99, e = 0;
                float we = 0;
                for (int dk = -1; dk <= 1; dk++) for (int di = -1; di <= 1; di++) {
                    int ni = i + di, nk = k + dk;
                    if ((di == 0 && dk == 0) || ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                    int v = nk * N + ni;
                    if (clase[v] == DESCONOCIDO) continue;
                    float w = (di != 0 && dk != 0 ? 0.7f : 1f) * (g.inferida[v] ? 0.6f : 1f);
                    if (clase[v] == OBSTACULO && distObs[v] < 2) {
                        wObs += w; sa += alto[v] * w; saw += w; dMin = Math.min(dMin, distObs[v]);
                    } else if (clase[v] == SUELO || clase[v] == AGUA) {
                        wSuelo += w;
                        if (w > we) { we = w; e = g.etiqueta[v]; }
                    }
                    sp += piso[v] * w; spw += w;
                }
                if (spw == 0) continue;
                // un obstáculo sigue sólo si lo rodea más obstáculo que piso, y nunca contra
                // aire medido: si un rayo pasó a cierta altura, el obstáculo no llega hasta ahí
                float altoSup = saw > 0 ? sa / saw : 0;
                float lib = g.libre[c];
                if (lib == lib) altoSup = Math.min(altoSup, lib - 0.5f * CELDA);
                float pisoSup = sp / spw;
                if (wObs > 0 && wObs >= wSuelo * 0.9f && altoSup > pisoSup + 0.3f) {
                    nClase[c] = OBSTACULO; nAlto[c] = altoSup; nDist[c] = dMin + 1;
                } else if (wSuelo > 0 && !(sombraAlta[c] && pasada > 3)) {
                    nClase[c] = (byte) (e == Tsdf.AGUA ? AGUA : SUELO);
                    g.etiqueta[c] = (byte) e;
                } else continue;
                nPiso[c] = sp / spw;
                g.inferida[c] = true;
                hubo = true;
            }
            clase = nClase; piso = nPiso; alto = nAlto; distObs = nDist;
            if (!hubo) break;
        }
        for (int c = 0; c < N * N; c++) {
            if (!g.inferida[c]) continue;
            g.clase[c] = clase[c]; g.piso[c] = piso[c]; g.alto[c] = alto[c];
            g.inferidas++;
        }
    }

    /**
     * Escribe lo supuesto en el volumen. Sólo toca voxeles que nadie midió:
     *  - suelo (visto o supuesto): la banda del piso donde falta;
     *  - obstáculo (visto o supuesto): sólido desde el piso hasta su altura.
     * Las celdas cuyo resultado no cambió desde la última vez no se re-escriben.
     */
    private void escribirInferido(Tsdf t, Grilla g) {
        final float vs = t.voxel, tr = t.trunc;
        HashMap<Long, float[]> nuevas = new HashMap<>();
        for (int c = 0; c < N * N; c++) {
            int cl = g.clase[c];
            if (!rellenar || (cl != SUELO && cl != OBSTACULO && cl != AGUA)) continue;
            nuevas.put(claveCelda(g.i0 + c % N, g.k0 + c / N), new float[]{cl, g.piso[c], g.alto[c], g.etiqueta[c]});
        }
        // (de a una celda con el candado tomado)
        for (java.util.Map.Entry<Long, float[]> e : escritas.entrySet()) {   // borrar lo que ya no va (o cambió)
            float[] nv = nuevas.get(e.getKey());
            float[] v = e.getValue();
            if (nv != null && nv[0] == v[0] && Math.abs(nv[1] - v[1]) < 0.03f && Math.abs(nv[2] - v[2]) < 0.05f) continue;
            synchronized (t) { recorrerCelda(t, e.getKey(), v, vs, tr, false); }
        }
        for (java.util.Map.Entry<Long, float[]> e : nuevas.entrySet()) {
            float[] v = escritas.get(e.getKey()), nv = e.getValue();
            if (v != null && nv[0] == v[0] && Math.abs(nv[1] - v[1]) < 0.03f && Math.abs(nv[2] - v[2]) < 0.05f) continue;
            synchronized (t) { recorrerCelda(t, e.getKey(), nv, vs, tr, true); }
        }
        escritas.clear();
        escritas.putAll(nuevas);
    }

    /** Recorre los voxeles de una celda: los escribe (inferir) o los borra. */
    private static void recorrerCelda(Tsdf t, long clave, float[] v, float vs, float tr, boolean escribir) {
        int gi = (int) (clave >> 32), gk = (int) clave;
        float x0 = gi * CELDA, z0 = gk * CELDA;
        int ax = Tsdf.pisoDe(x0 / vs), bx = Tsdf.pisoDe((x0 + CELDA) / vs), az = Tsdf.pisoDe(z0 / vs), bz = Tsdf.pisoDe((z0 + CELDA) / vs);
        boolean obs = v[0] == OBSTACULO;   // suelo y agua: sólo la banda del piso
        float piso = v[1], alto = obs ? v[2] : piso;
        int etq = (int) v[3];
        int y0 = Tsdf.pisoDe((piso - tr) / vs), y1 = Tsdf.pisoDe((alto + tr) / vs);
        for (int gx = ax; gx <= bx; gx++) {
            float cxv = (gx + 0.5f) * vs;
            if (cxv < x0 || cxv >= x0 + CELDA) continue;
            for (int gz = az; gz <= bz; gz++) {
                float czv = (gz + 0.5f) * vs;
                if (czv < z0 || czv >= z0 + CELDA) continue;
                for (int gy = y0; gy <= y1; gy++) {
                    if (!escribir) { t.olvidarSinCandado(gx, gy, gz); continue; }
                    float yc = (gy + 0.5f) * vs;
                    // distancia firmada vertical: + arriba de la superficie, − adentro. Un obstáculo
                    // es sólido desde el suelo hasta su altura; los costados salen solos contra el
                    // piso libre de las celdas vecinas.
                    float s = Math.max(-1f, Math.min(1f, (yc - alto) / tr));
                    t.inferirSinCandado(gx, gy, gz, s, etq);
                }
            }
        }
    }

    /** Lo que usa la IA de los soldados: qué se alcanza desde el jugador y dónde hay cubierta. */
    private static void zonasDeLaIA(Tsdf t, Grilla g, float px, float py, float pz) {
        // alcanzable: inundar desde la celda del jugador (o la caminable más cercana)
        int inicio = g.indice(px, pz);
        if (inicio >= 0 && !g.caminable(inicio)) inicio = g.vecinoCaminable(inicio);
        if (inicio >= 0) {
            int[] cola = new int[N * N];
            int a = 0, b = 0;
            cola[b++] = inicio;
            g.alcanzable[inicio] = true;
            while (a < b) {
                int c = cola[a++], ci = c % N, ck = c / N;
                for (int dk = -1; dk <= 1; dk++) for (int di = -1; di <= 1; di++) {
                    int ni = ci + di, nk = ck + dk;
                    if ((di == 0 && dk == 0) || ni < 0 || nk < 0 || ni >= N || nk >= N) continue;
                    int v = nk * N + ni;
                    if (g.alcanzable[v] || !g.caminable(v) || Math.abs(g.piso[v] - g.piso[c]) > 0.35f) continue;
                    g.alcanzable[v] = true;
                    cola[b++] = v;
                }
            }
        }
        // cubierta: caminable, con un obstáculo alto (≥ 0.9 m) al lado y del lado del jugador,
        // y la línea de tiro del jugador al pecho de alguien parado ahí, tapada
        for (int k = 1; k < N - 1; k++) for (int i = 1; i < N - 1; i++) {
            int c = k * N + i;
            if (!g.alcanzable[c]) continue;
            float x = g.x(i), z = g.z(k);
            float dx = px - x, dz = pz - z, d = (float) Math.hypot(dx, dz);
            if (d < 2.5f || d > 9f) continue;
            boolean hay = false;
            for (int dk = -1; dk <= 1 && !hay; dk++) for (int di = -1; di <= 1; di++) {
                int v = (k + dk) * N + i + di;
                if (g.clase[v] != OBSTACULO || g.alto[v] - g.piso[v] < 0.9f) continue;
                float ox = di * CELDA, oz = dk * CELDA;
                if ((ox * dx + oz * dz) / (Math.hypot(ox, oz) * d) > 0.35f) { hay = true; break; }
            }
            if (!hay) continue;
            float cy = g.piso[c] + 0.8f;   // agachado
            float rx = x - px, ry = cy - py, rz = z - pz;
            float l = (float) Math.sqrt(rx * rx + ry * ry + rz * rz);
            float golpe = t.rayo(px, py, pz, rx / l, ry / l, rz / l, l);
            if (golpe > 0 && golpe < l - 0.2f) { g.cubierta[c] = true; g.cubiertas++; }
        }
    }
}
