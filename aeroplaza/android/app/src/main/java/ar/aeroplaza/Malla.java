package ar.aeroplaza;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

/* LA MALLA DEL CUARTO (vuelta 35, como el escaneo de Asalto MR pero más fino): la profundidad de ARCore se
   funde foto a foto en un campo de distancias con signo truncado (TSDF) de cubitos de VOX (3 cm), en bloques de
   N × N × N que se crean donde hay algo. De ahí sale una malla (surface nets: un vértice por celda que cruza la
   superficie, en el promedio de los cruces; un cuadrado por arista que la cruza).
   - Cada píxel de profundidad suma su distancia a los cubitos de alrededor de la superficie (± la banda, que
     crece con la distancia al cuadrado, como el ruido de la profundidad), con más peso cerca y con confianza.
   - TALLAR: por el rayo, antes de la superficie, el espacio está vacío. Borra lo que se movió (una persona, las
     manos) y el ruido que quedó flotando. Solo hasta donde el rayo pasa a más de la banda de la superficie que
     toca (con su normal, de los píxeles vecinos): con los rayos rasantes (el piso de lejos) tallaba justo encima
     del piso y lo hundía 1,2 cm.
   - LOS HUECOS: en la malla, un cubito sin ver entre dos vistos firmes (ANCLA, hasta HUECO de cada lado, por un
     eje) toma su valor interpolado: se cierran los agujeros chicos. Lo que el tallado vació queda VACIO (visto
     vacío): no se rellena ni deja pasar el relleno (si no, volvía a armar lo que se había ido). Y los planos de ARCore (piso, paredes, mesas, techo)
     llenan lo que la profundidad no alcanzó (lejos, oscuro, de costado), con RELLENO: lo que se vea de verdad lo
     reemplaza.
   - HECHO: un bloque que ya se vio firme (casi toda su superficie con PESO_HECHO) y quieto (ESTABLE mallas seguidas
     sin cambiar) no se vuelve a escanear: queda fijo (no tiembla, no se gasta) y se ve de otro color. Lo de quieto:
     si no, alguien que pasaba quedaba congelado antes de que el tallado lo borrara.
   Todo sin Android (se prueba con un cuarto de mentira: pruebas/malla/). Lo usa Espacio.java en su hilo. */
final class Malla {
  static final int N = 16, N3 = N * N * N, NS = N + 2, NC = N + 1;
  static final float VOX = 0.03f;
  static final int PESO_MAX = 40, PESO_MALLA = 2, PESO_HECHO = 16, RELLENO = 120, VACIO = 121, HUECO = 3, ANCLA = 6, VISTAS_HECHO = 8, ESTABLE = 4;
  static final float TRUNC = 0.06f, TRUNC_K = 0.012f, PROF_MIN = 0.2f, PROF_MAX = 5.0f;
  static final int CONF_MIN = 90, MAX_BLOQUES = 2600;
  static final float ESC = 32767f;

  static final class Bloque {
    final int bx, by, bz;
    final short[] d = new short[N3];
    final byte[] w = new byte[N3];
    boolean sucio, hecho;
    int version, vistas, estable, grandes;
    long tMalla;
    Bloque(int x, int y, int z) { bx = x; by = y; bz = z; Arrays.fill(d, Short.MAX_VALUE); }
  }

  final HashMap<Long, Bloque> bloques = new HashMap<>();
  private Bloque ultimo;
  int integradas, muestras;

  static long clave(int x, int y, int z) { return ((long) (x & 0x1FFFFF) << 42) | ((long) (y & 0x1FFFFF) << 21) | (long) (z & 0x1FFFFF); }
  static int idx(int x, int y, int z) { return (z * N + y) * N + x; }
  static int piso(float v) { int i = (int) v; return v < i ? i - 1 : i; }

  Bloque bloque(int bx, int by, int bz, boolean crear) {
    Bloque u = ultimo;
    if (u != null && u.bx == bx && u.by == by && u.bz == bz) return u;
    long k = clave(bx, by, bz);
    Bloque b = bloques.get(k);
    if (b == null && crear && bloques.size() < MAX_BLOQUES) { b = new Bloque(bx, by, bz); bloques.put(k, b); }
    if (b != null) ultimo = b;
    return b;
  }

  void vaciar() { bloques.clear(); ultimo = null; integradas = 0; }

  /* una foto de profundidad: mm (W × H, en mm), conf (0-255, o null), los intrínsecos llevados a esa imagen y
     la pose del sensor (4 × 4 por columnas: la cámara mira a -z, y arriba). paso: uno de cada paso × paso píxeles.
     Devuelve cuántos píxeles se usaron */
  int integrar(short[] mm, byte[] conf, int W, int H, float fx, float fy, float cx, float cy, float[] m, int paso) {
    final float ox = m[12], oy = m[13], oz = m[14];
    int n = 0;
    for (int v = paso / 2; v < H; v += paso) for (int u = paso / 2; u < W; u += paso) {
      int i = v * W + u, dm = mm[i] & 0xFFFF;
      float z = dm * 0.001f;
      if (z < PROF_MIN || z > PROF_MAX) continue;
      int c = conf == null ? 255 : conf[i] & 0xFF;
      if (c < CONF_MIN) continue;
      float xc = z * (u + 0.5f - cx) / fx, yc = z * (cy - (v + 0.5f)) / fy, zc = -z;
      /* (qué tan de frente se ve: la normal con los vecinos de la derecha y de abajo; sin vecinos, no se talla) */
      float frente = -1;
      if (u + paso < W && v + paso < H) {
        float za = (mm[i + paso] & 0xFFFF) * 0.001f, zb = (mm[i + paso * W] & 0xFFFF) * 0.001f;
        if (za > PROF_MIN && zb > PROF_MIN && Math.abs(za - z) < 0.1f * z && Math.abs(zb - z) < 0.1f * z) {
          float ax = za * (u + paso + 0.5f - cx) / fx - xc, ay = za * (cy - (v + 0.5f)) / fy - yc, az = -za - zc;
          float bx = zb * (u + 0.5f - cx) / fx - xc, by = zb * (cy - (v + paso + 0.5f)) / fy - yc, bz = -zb - zc;
          float nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz), pl = (float) Math.sqrt(xc * xc + yc * yc + zc * zc);
          if (nl > 1e-12f) frente = Math.abs(nx * xc + ny * yc + nz * zc) / (nl * pl);
        }
      }
      float px = m[0] * xc + m[4] * yc + m[8] * zc + ox, py = m[1] * xc + m[5] * yc + m[9] * zc + oy, pz = m[2] * xc + m[6] * yc + m[10] * zc + oz;
      float dx = px - ox, dy = py - oy, dz = pz - oz, dist = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-4f) continue;
      dx /= dist; dy /= dist; dz /= dist;
      float banda = TRUNC + TRUNC_K * z * z;
      /* (el peso: con buena confianza y cerca, el doble; lejos, la mitad de las veces) */
      int peso = c > 200 && z < 3f ? 2 : 1;
      if (z > 3.5f && ((u + v) & 1) == 1) continue;
      superficie(ox, oy, oz, dx, dy, dz, dist, banda, peso);
      if (frente > 0 && ((u / paso) + (v / paso)) % 3 == 0) tallar(ox, oy, oz, dx, dy, dz, dist - banda * 1.3f / Math.max(frente, 0.15f));
      n++;
    }
    integradas++; muestras += n;
    return n;
  }

  /* los cubitos alrededor de la superficie, por el rayo: su distancia con signo (positiva del lado de la
     cámara), en la banda, promediada con lo que ya tenían */
  private void superficie(float ox, float oy, float oz, float dx, float dy, float dz, float dist, float banda, int peso) {
    int ant = Integer.MIN_VALUE;
    Bloque ab = null;
    for (float t = dist - banda; t <= dist + banda; t += VOX * 0.5f) {
      int ix = piso((ox + dx * t) / VOX), iy = piso((oy + dy * t) / VOX), iz = piso((oz + dz * t) / VOX);
      int h = ix * 73856093 ^ iy * 19349663 ^ iz * 83492791;
      if (h == ant) continue;
      ant = h;
      float cxv = (ix + 0.5f) * VOX - ox, cyv = (iy + 0.5f) * VOX - oy, czv = (iz + 0.5f) * VOX - oz;
      float tc = cxv * dx + cyv * dy + czv * dz, sdf = (dist - tc) / banda;
      if (sdf < -1f) break;
      if (sdf > 1f) sdf = 1f;
      int bx = ix >> 4, by = iy >> 4, bz = iz >> 4;
      Bloque b = ab != null && ab.bx == bx && ab.by == by && ab.bz == bz ? ab : bloque(bx, by, bz, true);
      if (b == null) continue;
      ab = b;
      if (b.hecho) continue;
      int k = idx(ix & 15, iy & 15, iz & 15), wv = b.w[k];
      if (wv == RELLENO || wv == VACIO) wv = 0;
      float dv = wv == 0 ? 0 : b.d[k] / ESC, nd = (dv * wv + sdf * peso) / (wv + peso);
      if (wv >= PESO_MALLA && Math.abs(nd - dv) > 0.04f) b.grandes++;
      b.d[k] = (short) (nd * ESC);
      b.w[k] = (byte) Math.min(PESO_MAX, wv + peso);
      b.sucio = true;
    }
  }

  /* el espacio vacío antes de la superficie: lo que había ahí (visto antes) va hacia "vacío" y pierde peso (con
     peso 0 no hay malla: lo que se fue desaparece en unas pasadas) */
  private void tallar(float ox, float oy, float oz, float dx, float dy, float dz, float hasta) {
    for (float t = 0.3f; t < hasta; t += VOX * 1.5f) {
      int ix = piso((ox + dx * t) / VOX), iy = piso((oy + dy * t) / VOX), iz = piso((oz + dz * t) / VOX);
      Bloque b = bloque(ix >> 4, iy >> 4, iz >> 4, false);
      if (b == null || b.hecho) continue;
      int k = idx(ix & 15, iy & 15, iz & 15), wv = b.w[k];
      if (wv == 0 || wv == RELLENO || wv == VACIO) continue;
      float dv = b.d[k] / ESC;
      if (dv >= 0.99f) continue;
      if (dv < 0.5f) b.grandes++;
      /* (lo que estaba "adentro" de algo y ahora se ve a través: el doble) */
      int baja = dv < 0 ? 2 : 1;
      if (wv <= baja) { b.d[k] = Short.MAX_VALUE; b.w[k] = (byte) VACIO; }
      else { b.d[k] = (short) ((dv * wv + 1f) / (wv + 1) * ESC); b.w[k] = (byte) (wv - baja); }
      b.sucio = true;
    }
  }

  /* LOS PLANOS: lo que el plano de ARCore cubre y la profundidad no vio, lleno. m: la pose del centro del plano
     (4 × 4 por columnas; su y es la normal, hacia el lado vacío); pol: el contorno (convexo) en x, z del plano */
  int rellenarPlano(float[] m, float[] pol) {
    int nv = pol.length / 2; if (nv < 3) return 0;
    float x0 = Float.MAX_VALUE, x1 = -Float.MAX_VALUE, z0 = Float.MAX_VALUE, z1 = -Float.MAX_VALUE;
    for (int i = 0; i < nv; i++) { x0 = Math.min(x0, pol[i * 2]); x1 = Math.max(x1, pol[i * 2]); z0 = Math.min(z0, pol[i * 2 + 1]); z1 = Math.max(z1, pol[i * 2 + 1]); }
    float nx = m[4], ny = m[5], nz = m[6];
    int n = 0;
    for (float x = x0; x <= x1; x += VOX) for (float z = z0; z <= z1; z += VOX) {
      if (!adentro(pol, nv, x, z)) continue;
      float px = m[0] * x + m[8] * z + m[12], py = m[1] * x + m[9] * z + m[13], pz = m[2] * x + m[10] * z + m[14];
      for (int s = -2; s <= 2; s++) {
        float qx = px + nx * s * VOX, qy = py + ny * s * VOX, qz = pz + nz * s * VOX;
        int ix = piso(qx / VOX), iy = piso(qy / VOX), iz = piso(qz / VOX);
        Bloque b = bloque(ix >> 4, iy >> 4, iz >> 4, true);
        if (b == null || b.hecho) continue;
        int k = idx(ix & 15, iy & 15, iz & 15);
        if (b.w[k] != 0) continue;
        float sd = ((ix + 0.5f) * VOX - px) * nx + ((iy + 0.5f) * VOX - py) * ny + ((iz + 0.5f) * VOX - pz) * nz;
        b.d[k] = (short) (Math.max(-1f, Math.min(1f, sd / TRUNC)) * ESC);
        b.w[k] = (byte) RELLENO;
        b.sucio = true; n++;
      }
    }
    return n;
  }

  static boolean adentro(float[] p, int n, float x, float z) {
    boolean dentro = false;
    for (int i = 0, j = n - 1; i < n; j = i++) {
      float xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
      if ((zi > z) != (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) dentro = !dentro;
    }
    return dentro;
  }

  /* los bloques cambiados (a lo sumo max, los que no se mallaron hace menos de cada ms) */
  List<Bloque> sucios(long ahora, long cada, int max) {
    ArrayList<Bloque> l = new ArrayList<>();
    for (Bloque b : bloques.values()) if (b.sucio && ahora - b.tMalla >= cada) { l.add(b); if (l.size() >= max) break; }
    return l;
  }

  /* ------------------------------------------ la malla de un bloque */
  private final float[] val = new float[NS * NS * NS];
  private final byte[] est = new byte[NS * NS * NS];   // 0 sin ver · 1 visto · 2 relleno (plano) · 3 hueco tapado · 4 visto vacío
  private final byte[] pes = new byte[NS * NS * NS];
  private final int[] vid = new int[NC * NC * NC];
  private float[] vp = new float[3 * 2048];
  private float[] vn = new float[3 * 2048];
  private byte[] vr = new byte[2048];
  private final Bloque[] vec = new Bloque[27];
  int ultimosCuadros;

  static int is(int x, int y, int z) { return (z * NS + y) * NS + x; }
  static int ic(int x, int y, int z) { return (z * NC + y) * NC + x; }

  /* la malla del bloque b (null si no tiene): 6 vértices por cuadrado, de 16 bytes: x, y, z (float, en el mundo),
     la normal (3 bytes, ±127) y las banderas (1 byte: 1 relleno, 2 hecho, y la esquina del cuadrado × 4) */
  byte[] mallar(Bloque b) {
    b.sucio = false;
    /* (los 27 vecinos, para los bordes: de -1 a N en cada eje) */
    for (int dz = -1; dz <= 1; dz++) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++)
      vec[(dz + 1) * 9 + (dy + 1) * 3 + (dx + 1)] = bloques.get(clave(b.bx + dx, b.by + dy, b.bz + dz));
    int sup = 0, firme = 0;
    for (int z = 0; z < NS; z++) for (int y = 0; y < NS; y++) for (int x = 0; x < NS; x++) {
      int lx = x - 1, ly = y - 1, lz = z - 1;
      int ox = lx < 0 ? -1 : lx >= N ? 1 : 0, oy = ly < 0 ? -1 : ly >= N ? 1 : 0, oz = lz < 0 ? -1 : lz >= N ? 1 : 0;
      Bloque q = vec[(oz + 1) * 9 + (oy + 1) * 3 + (ox + 1)];
      int s = is(x, y, z);
      if (q == null) { est[s] = 0; val[s] = 1f; pes[s] = 0; continue; }
      int k = idx(lx - ox * N, ly - oy * N, lz - oz * N), wv = q.w[k];
      val[s] = q.d[k] / ESC; pes[s] = (byte) (wv == RELLENO || wv == VACIO ? 0 : wv);
      est[s] = (byte) (wv == VACIO ? 4 : wv == RELLENO ? 2 : wv >= PESO_MALLA ? 1 : 0);
      if (q == b && est[s] == 1 && Math.abs(val[s]) < 0.35f) { sup++; if (wv >= PESO_HECHO) firme++; }
    }
    /* HECHO: casi toda la superficie firme, después de varias vistas: ya no se escanea */
    b.vistas++;
    /* (quieto: casi sin cambios grandes desde la malla anterior, ni tallados de superficie) */
    if (b.grandes <= Math.max(4, sup / 30)) b.estable++; else b.estable = 0;
    b.grandes = 0;
    if (!b.hecho && b.vistas >= VISTAS_HECHO && b.estable >= ESTABLE && sup >= 24 && firme >= sup * 0.85f) b.hecho = true;
    /* LOS HUECOS: sin ver entre dos vistos (por un eje, hasta HUECO de cada lado): interpolado */
    for (int z = 0; z < NS; z++) for (int y = 0; y < NS; y++) for (int x = 0; x < NS; x++) {
      int s = is(x, y, z); if (est[s] != 0) continue;
      float mejor = 0; int largo = 99;
      for (int e = 0; e < 3; e++) {
        int a = -1, bb = -1, da = 0, db = 0;
        for (int k = 1; k <= HUECO; k++) { int t = vecino(x, y, z, e, -k); if (t < 0 || est[t] == 4) break; if (est[t] == 1) { if (pes[t] >= ANCLA) { a = t; da = k; } break; } }
        if (a < 0) continue;
        for (int k = 1; k <= HUECO; k++) { int t = vecino(x, y, z, e, k); if (t < 0 || est[t] == 4) break; if (est[t] == 1) { if (pes[t] >= ANCLA) { bb = t; db = k; } break; } }
        if (bb < 0 || da + db >= largo) continue;
        largo = da + db; mejor = val[a] + (val[bb] - val[a]) * da / (float) (da + db);
      }
      if (largo < 99) { val[s] = mejor; est[s] = 3; }
    }
    /* los vértices: uno por celda que cruza (de -1 a N-1 en cada eje) */
    int nv = 0;
    final float x0 = b.bx * N * VOX, y0 = b.by * N * VOX, z0 = b.bz * N * VOX;
    for (int z = 0; z < NC; z++) for (int y = 0; y < NC; y++) for (int x = 0; x < NC; x++) {
      int c = ic(x, y, z); vid[c] = -1;
      int msk = 0; boolean relleno = false, falta = false;
      for (int j = 0; j < 8; j++) {
        int s = is(x + (j & 1), y + ((j >> 1) & 1), z + ((j >> 2) & 1));
        if (est[s] == 0 || est[s] == 4) { falta = true; break; }
        if (est[s] >= 2) relleno = true;
        if (val[s] < 0) msk |= 1 << j;
      }
      if (falta || msk == 0 || msk == 255) continue;
      float sx = 0, sy = 0, sz = 0; int cr = 0;
      for (int e = 0; e < 12; e++) {
        int a = ARISTA[e * 2], bq = ARISTA[e * 2 + 1];
        if (((msk >> a) & 1) == ((msk >> bq) & 1)) continue;
        float va = val[is(x + (a & 1), y + ((a >> 1) & 1), z + ((a >> 2) & 1))], vb = val[is(x + (bq & 1), y + ((bq >> 1) & 1), z + ((bq >> 2) & 1))];
        float t = va / (va - vb);
        sx += (a & 1) + ((bq & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((bq >> 1) & 1) - ((a >> 1) & 1)) * t; sz += ((a >> 2) & 1) + (((bq >> 2) & 1) - ((a >> 2) & 1)) * t;
        cr++;
      }
      if (nv >= vr.length) { vp = Arrays.copyOf(vp, vp.length * 2); vn = Arrays.copyOf(vn, vn.length * 2); vr = Arrays.copyOf(vr, vr.length * 2); }
      /* (la muestra s está en el centro del cubito s - 1 del bloque) */
      vp[nv * 3] = x0 + (x - 0.5f + sx / cr) * VOX; vp[nv * 3 + 1] = y0 + (y - 0.5f + sy / cr) * VOX; vp[nv * 3 + 2] = z0 + (z - 0.5f + sz / cr) * VOX;
      /* la normal: hacia donde crece la distancia (el lado vacío) */
      float gx = 0, gy = 0, gz = 0;
      for (int j = 0; j < 8; j++) { float v = val[is(x + (j & 1), y + ((j >> 1) & 1), z + ((j >> 2) & 1))]; gx += (j & 1) == 1 ? v : -v; gy += ((j >> 1) & 1) == 1 ? v : -v; gz += ((j >> 2) & 1) == 1 ? v : -v; }
      float gl = (float) Math.sqrt(gx * gx + gy * gy + gz * gz); if (gl < 1e-6f) gl = 1;
      vn[nv * 3] = gx / gl; vn[nv * 3 + 1] = gy / gl; vn[nv * 3 + 2] = gz / gl;
      vr[nv] = (byte) (relleno ? 1 : 0);
      vid[c] = nv++;
    }
    /* los cuadrados: una arista del bloque (de 0 a N-1) que cruza, con las cuatro celdas de alrededor */
    ByteBuffer o = ByteBuffer.allocate(Math.max(96, nv * 6 * 16 * 3)).order(ByteOrder.LITTLE_ENDIAN);
    int nq = 0;
    for (int z = 1; z <= N; z++) for (int y = 1; y <= N; y++) for (int x = 1; x <= N; x++) {
      int s0 = is(x, y, z); if (est[s0] == 0 || est[s0] == 4) continue;
      boolean neg = val[s0] < 0;
      for (int e = 0; e < 3; e++) {
        int s1 = e == 0 ? is(x + 1, y, z) : e == 1 ? is(x, y + 1, z) : is(x, y, z + 1);
        if (est[s1] == 0 || est[s1] == 4 || (val[s1] < 0) == neg) continue;
        /* (las celdas: su esquina de abajo es la muestra, corrida -1 en los otros dos ejes) */
        int c0, c1, c2, c3;
        if (e == 0) { c0 = ic(x, y - 1, z - 1); c1 = ic(x, y, z - 1); c2 = ic(x, y, z); c3 = ic(x, y - 1, z); }
        else if (e == 1) { c0 = ic(x - 1, y, z - 1); c1 = ic(x - 1, y, z); c2 = ic(x, y, z); c3 = ic(x, y, z - 1); }
        else { c0 = ic(x - 1, y - 1, z); c1 = ic(x, y - 1, z); c2 = ic(x, y, z); c3 = ic(x - 1, y, z); }
        int a = vid[c0], bq = vid[c1], c = vid[c2], d = vid[c3];
        if (a < 0 || bq < 0 || c < 0 || d < 0) continue;
        if (!neg) { int t = bq; bq = d; d = t; }
        int fl = (vr[a] | vr[bq] | vr[c] | vr[d]) | (b.hecho ? 2 : 0);
        if (o.remaining() < 96) { ByteBuffer m2 = ByteBuffer.allocate(o.capacity() * 2).order(ByteOrder.LITTLE_ENDIAN); o.flip(); m2.put(o); o = m2; }
        poner(o, a, fl, 0); poner(o, bq, fl, 1); poner(o, c, fl, 2);
        poner(o, a, fl, 0); poner(o, c, fl, 2); poner(o, d, fl, 3);
        nq++;
      }
    }
    ultimosCuadros = nq;
    b.version++;
    if (nq == 0) return null;
    return Arrays.copyOf(o.array(), o.position());
  }

  private void poner(ByteBuffer o, int v, int fl, int esquina) {
    o.putFloat(vp[v * 3]).putFloat(vp[v * 3 + 1]).putFloat(vp[v * 3 + 2]);
    o.put((byte) Math.round(vn[v * 3] * 127)).put((byte) Math.round(vn[v * 3 + 1] * 127)).put((byte) Math.round(vn[v * 3 + 2] * 127)).put((byte) (fl | esquina << 2));
  }

  private static int vecino(int x, int y, int z, int e, int k) {
    if (e == 0) x += k; else if (e == 1) y += k; else z += k;
    if (x < 0 || y < 0 || z < 0 || x >= NS || y >= NS || z >= NS) return -1;
    return is(x, y, z);
  }

  /* las 12 aristas del cubo, por sus esquinas (bit 0 = x, 1 = y, 2 = z) */
  static final int[] ARISTA = { 0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7 };

  /* cuántos bloques hay y cuántos están hechos */
  int[] cuenta() { int h = 0; for (Bloque b : bloques.values()) if (b.hecho) h++; return new int[] { bloques.size(), h }; }
}
