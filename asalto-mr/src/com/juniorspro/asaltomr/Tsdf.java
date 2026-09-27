package com.juniorspro.asaltomr;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/**
 * El escaneo del entorno: un volumen de voxeles con la "distancia firmada
 * truncada" (TSDF) a la superficie real más cercana, como el que usan
 * KinectFusion o la malla de escena del Quest.
 *
 * Cada imagen de profundidad de ARCore es un montón de rayos desde la cámara:
 * a lo largo de cada rayo, el voxel que queda ANTES del punto medido está libre
 * (distancia +) y el que queda DETRÁS está adentro de algo (distancia −). Se
 * promedian muchas imágenes y el cero de ese campo es la superficie: de ahí
 * sale la malla de polígonos (ver Mallador).
 *
 * Sin nada de Android: se prueba en la PC con escenas sintéticas
 * (pruebas/PruebaEscaneo.java). Los métodos públicos toman el candado del
 * objeto, así la integración (hilo del escaneo) y las consultas del juego
 * (hilo de dibujo) no se pisan; la integración lo suelta cada tantas filas.
 */
public final class Tsdf {
    public static final int N = 16;                 // un bloque = 16³ voxeles
    static final int N3 = N * N * N;
    static final int PESO_MAX = 60;

    public final float voxel;                       // lado de un voxel, en metros
    public final float trunc;                       // la banda alrededor de la superficie

    /** Un bloque de 16³ voxeles. d ∈ [−1, 1] (distancia/trunc), w = cuántas veces se vio. */
    public static final class Bloque {
        public final int bx, by, bz;
        final float[] d = new float[N3];
        final byte[] w = new byte[N3];
        public int version;                         // sube cada vez que cambia algo adentro
        boolean sucio;

        Bloque(int bx, int by, int bz) { this.bx = bx; this.by = by; this.bz = bz; }
    }

    private final HashMap<Long, Bloque> bloques = new HashMap<>();
    private final ArrayList<Bloque> sucios = new ArrayList<>();
    private Bloque ultimo;                          // caché de la última búsqueda (la mayoría cae en el mismo bloque)
    /** Tope de memoria: cada bloque pesa ~20 KB. Lleno, se sigue afinando lo que ya hay. */
    public int maxBloques = 2500;

    public Tsdf(float voxel) {
        this.voxel = voxel;
        this.trunc = voxel * 3f;
    }

    static long clave(int bx, int by, int bz) {
        return ((long) (bx & 0x1FFFFF) << 42) | ((long) (by & 0x1FFFFF) << 21) | (long) (bz & 0x1FFFFF);
    }

    private Bloque bloque(int bx, int by, int bz, boolean crear) {
        Bloque u = ultimo;
        if (u != null && u.bx == bx && u.by == by && u.bz == bz) return u;
        Long k = clave(bx, by, bz);
        Bloque b = bloques.get(k);
        if (b == null && crear && bloques.size() < maxBloques) { b = new Bloque(bx, by, bz); bloques.put(k, b); }
        if (b != null) ultimo = b;
        return b;
    }

    public synchronized int cantidadBloques() { return bloques.size(); }

    public synchronized void vaciar() {
        bloques.clear();
        sucios.clear();
        ultimo = null;
    }

    /** Los bloques que cambiaron desde la última llamada (para volver a mallar). */
    public synchronized List<Bloque> tomarSucios() {
        ArrayList<Bloque> r = new ArrayList<>(sucios);
        for (Bloque b : sucios) b.sucio = false;
        sucios.clear();
        return r;
    }

    public synchronized Bloque bloqueEn(int bx, int by, int bz) { return bloque(bx, by, bz, false); }

    private static int piso(float v) { int i = (int) v; return v < i ? i - 1 : i; }

    private static int idx(int lx, int ly, int lz) { return (lz * N + ly) * N + lx; }

    // ── integración ──

    /**
     * Mete una imagen de profundidad.
     *
     * @param mm       profundidad en milímetros (DEPTH16 de ARCore, sin los 3 bits de confianza)
     * @param conf     confianza 0..255 por píxel, o null
     * @param ancho,alto tamaño de la imagen de profundidad
     * @param fx,fy,cx,cy intrínsecos a la resolución de la imagen de profundidad
     * @param pose     cámara → mundo, 4×4 por columnas (como android.opengl.Matrix);
     *                 cámara estilo OpenGL: +X derecha, +Y arriba, −Z hacia adelante
     * @param maxM     más lejos que esto no se cree (el ruido crece con la distancia²)
     * @param confMin  confianza mínima (0..255)
     * @param paso     cada cuántos píxeles (1 = todos)
     * @return cuántos rayos se usaron
     */
    public int integrar(short[] mm, byte[] conf, int ancho, int alto, float fx, float fy, float cx, float cy,
                        float[] pose, float maxM, int confMin, int paso) {
        final float ox = pose[12], oy = pose[13], oz = pose[14];
        final float vs = voxel, inv = 1f / voxel;
        int usados = 0;
        for (int v0 = 0; v0 < alto; v0 += paso * 8) {
            synchronized (this) {                   // se suelta cada 8 filas: el juego no espera
                int vFin = Math.min(alto, v0 + paso * 8);
                for (int v = v0; v < vFin; v += paso) {
                    for (int u = 0; u < ancho; u += paso) {
                        int i = v * ancho + u;
                        int raw = mm[i] & 0xFFFF;   // acquire*Depth16Bits: 16 bits de mm (hasta 65 m)
                        if (raw == 0) continue;
                        float prof = raw * 0.001f;
                        if (prof < 0.2f || prof > maxM) continue;
                        int c = conf == null ? 255 : (conf[i] & 0xFF);
                        if (c < confMin) continue;
                        // punto en la cámara (OpenGL) y al mundo
                        float xc = (u + 0.5f - cx) / fx * prof, yc = -(v + 0.5f - cy) / fy * prof, zc = -prof;
                        float px = pose[0] * xc + pose[4] * yc + pose[8] * zc + ox;
                        float py = pose[1] * xc + pose[5] * yc + pose[9] * zc + oy;
                        float pz = pose[2] * xc + pose[6] * yc + pose[10] * zc + oz;
                        float rx = px - ox, ry = py - oy, rz = pz - oz;
                        float L = (float) Math.sqrt(rx * rx + ry * ry + rz * rz);
                        rx /= L; ry /= L; rz /= L;
                        // lo cercano y seguro pesa más
                        int inc = (prof < 3f && c > 200) ? 2 : 1;
                        float tr = trunc + prof * prof * 0.02f;   // el ruido crece con la distancia²: la banda también
                        recorrer(ox, oy, oz, rx, ry, rz, L, tr, inc, vs, inv);
                        if ((u / paso + v / paso) % 5 == 0) tallar(ox, oy, oz, rx, ry, rz, L, tr, vs, inv);
                        usados++;
                    }
                }
            }
        }
        return usados;
    }

    /**
     * Actualiza los voxeles de la banda [L−tr, L+detrás] a lo largo del rayo.
     * Detrás del punto medido la banda es más corta: lo que queda detrás de un
     * borde (la sombra de una mesa, de un tronco) nunca se ve libre, y una
     * banda larga ahí inventa superficies en el aire.
     */
    private void recorrer(float ox, float oy, float oz, float rx, float ry, float rz, float L, float tr,
                          int inc, float vs, float inv) {
        float paso = vs * 0.7f;
        int ax = Integer.MIN_VALUE, ay = 0, az = 0;
        float fin = L + Math.max(vs * 1.5f, tr * 0.4f);
        for (float t = L - tr; t <= fin; t += paso) {
            int gx = piso((ox + rx * t) * inv), gy = piso((oy + ry * t) * inv), gz = piso((oz + rz * t) * inv);
            if (gx == ax && gy == ay && gz == az) continue;
            ax = gx; ay = gy; az = gz;
            // la distancia se mide al centro del voxel, a lo largo del rayo
            float cxv = (gx + 0.5f) * vs - ox, cyv = (gy + 0.5f) * vs - oy, czv = (gz + 0.5f) * vs - oz;
            float s = (L - (cxv * rx + cyv * ry + czv * rz)) / tr;
            if (s < -1f) continue;                  // bien detrás: no se sabe qué hay
            if (s > 1f) s = 1f;
            actualizar(gx, gy, gz, s, inc);
        }
    }

    /**
     * Borra "fantasmas" (algo que se movió): lo que el rayo cruza bien antes
     * del punto medido está libre. Sólo toca voxeles jóvenes que dicen
     * "ocupado", y con margen, para no comerse el piso visto de costado.
     */
    private void tallar(float ox, float oy, float oz, float rx, float ry, float rz, float L, float tr, float vs, float inv) {
        float fin = L - 2f * tr - 0.1f * L;
        int ax = Integer.MIN_VALUE, ay = 0, az = 0;
        for (float t = 0.3f; t < fin; t += vs * 1.5f) {
            int gx = piso((ox + rx * t) * inv), gy = piso((oy + ry * t) * inv), gz = piso((oz + rz * t) * inv);
            if (gx == ax && gy == ay && gz == az) continue;
            ax = gx; ay = gy; az = gz;
            Bloque b = bloque(gx >> 4, gy >> 4, gz >> 4, false);
            if (b == null) continue;
            int i = idx(gx & 15, gy & 15, gz & 15);
            int w = b.w[i];
            if (w == 0 || w >= 8 || b.d[i] > 0f) continue;
            b.d[i] = (b.d[i] * w + 1f) / (w + 1);
            b.w[i] = (byte) (w - 1 > 0 ? w - 1 : 1);
            marcar(b);
        }
    }

    private void actualizar(int gx, int gy, int gz, float s, int inc) {
        Bloque b = bloque(gx >> 4, gy >> 4, gz >> 4, true);
        if (b == null) return;
        int i = idx(gx & 15, gy & 15, gz & 15);
        int w = b.w[i];
        float d = b.d[i];
        float nd = (d * w + s * inc) / (w + inc);
        int nw = Math.min(PESO_MAX, w + inc);
        // Sólo cuenta como cambio si cruza el cero o se mueve bastante: así no se
        // re-malla todo en cada cuadro.
        boolean cambio = w == 0 || (d < 0) != (nd < 0) || Math.abs(nd - d) > 0.08f;
        b.d[i] = nd;
        b.w[i] = (byte) nw;
        if (cambio) marcar(b);
    }

    private void marcar(Bloque b) {
        b.version++;
        if (!b.sucio) { b.sucio = true; sucios.add(b); }
    }

    /**
     * Marca los vecinos de los bloques sucios: la malla de un bloque lee una
     * capa de voxeles de cada vecino, así que si cambia éste, el borde de ellos
     * también puede cambiar.
     */
    public synchronized void propagarBordes() {
        int n = sucios.size();
        for (int k = 0; k < n; k++) {
            Bloque b = sucios.get(k);
            for (int dz = -1; dz <= 1; dz++) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0 && dz == 0) continue;
                Bloque v = bloque(b.bx + dx, b.by + dy, b.bz + dz, false);
                if (v != null && !v.sucio) { v.sucio = true; v.version++; sucios.add(v); }
            }
        }
    }

    // ── consultas ──

    /** Valor del voxel (índices globales), o NaN si nunca se vio. Sin candado: lo usa quien ya lo tiene. */
    float valorSinCandado(int gx, int gy, int gz) {
        Bloque b = bloque(gx >> 4, gy >> 4, gz >> 4, false);
        if (b == null) return Float.NaN;
        int i = idx(gx & 15, gy & 15, gz & 15);
        return b.w[i] == 0 ? Float.NaN : b.d[i];
    }

    public synchronized float valor(int gx, int gy, int gz) { return valorSinCandado(gx, gy, gz); }

    /** Distancia firmada normalizada interpolada en un punto del mundo, NaN si falta algo. */
    private float muestra(float x, float y, float z) {
        float fx = x / voxel - 0.5f, fy = y / voxel - 0.5f, fz = z / voxel - 0.5f;
        int ix = piso(fx), iy = piso(fy), iz = piso(fz);
        float ax = fx - ix, ay = fy - iy, az = fz - iz;
        float s = 0;
        for (int k = 0; k < 8; k++) {
            int dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
            float v = valorSinCandado(ix + dx, iy + dy, iz + dz);
            if (v != v) return Float.NaN;
            s += v * (dx == 1 ? ax : 1 - ax) * (dy == 1 ? ay : 1 - ay) * (dz == 1 ? az : 1 - az);
        }
        return s;
    }

    /**
     * Rayo contra la superficie escaneada. Devuelve la distancia al primer cruce
     * de libre a ocupado, o −1 si no pega hasta maxD. (dx,dy,dz) unitario.
     */
    public synchronized float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float maxD) {
        float paso = voxel * 0.5f;
        float antes = Float.NaN, tAntes = 0;
        for (float t = 0.05f; t <= maxD; t += paso) {
            float v = muestra(ox + dx * t, oy + dy * t, oz + dz * t);
            if (v != v) { antes = Float.NaN; continue; }
            if (antes == antes && antes > 0 && v <= 0) {
                return tAntes + paso * antes / (antes - v);   // interpolar el cero
            }
            antes = v; tAntes = t;
        }
        return -1f;
    }

    /**
     * La altura del suelo bajo (x, z): bajando desde yArriba, el primer paso de
     * libre a ocupado. NaN si no hay nada escaneado ahí.
     */
    public synchronized float suelo(float x, float z, float yArriba, float yAbajo) {
        float paso = voxel * 0.5f;
        float antes = Float.NaN, yAntes = 0;
        for (float y = yArriba; y >= yAbajo; y -= paso) {
            float v = muestra(x, y, z);
            if (v != v) { antes = Float.NaN; continue; }
            if (antes == antes && antes > 0 && v <= 0) return yAntes - paso * antes / (antes - v);
            antes = v; yAntes = y;
        }
        return Float.NaN;
    }

    /** ¿Hay algo sólido en ese punto (con lo escaneado)? Lo desconocido cuenta como libre. */
    public synchronized boolean ocupado(float x, float y, float z) {
        float v = muestra(x, y, z);
        return v == v && v < 0f;
    }

    /**
     * Copia los valores de un cubo de voxeles [g0, g0+n) al arreglo, para el
     * mallador. Lo visto menos de pesoMin veces cuenta como no visto (NaN): una
     * sola medición ruidosa de lejos no alcanza para poner un polígono.
     */
    public synchronized void copiar(int g0x, int g0y, int g0z, int n, int pesoMin, float[] destino) {
        int k = 0;
        for (int z = 0; z < n; z++) for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) {
            int gx = g0x + x, gy = g0y + y, gz = g0z + z;
            Bloque b = bloque(gx >> 4, gy >> 4, gz >> 4, false);
            int i = idx(gx & 15, gy & 15, gz & 15);
            destino[k++] = b == null || b.w[i] < pesoMin ? Float.NaN : b.d[i];
        }
    }
}
