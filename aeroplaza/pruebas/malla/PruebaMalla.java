package ar.aeroplaza;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Random;

/* LA MALLA DEL CUARTO, sin celu (android/…/Malla.java): un cuarto de mentira (4 × 2,6 × 5 m, con una mesa) que
   ARCore "ve" con la profundidad como la de un celu: 160 × 120, ruido que crece con la distancia al cuadrado,
   píxeles que faltan, y dos zonas que nunca ve (un parche del piso, 12 cm, y lo alto de la pared derecha).
   Alguien pasa al principio y se va. El celu da vueltas por el cuarto y al final mira otra vez donde estaba.
   - precisa: los vértices vistos, a menos de 1 cm de la superficie de verdad (promedio), el 95 % a menos de 2;
   - llena: el piso cubierto casi entero (con el parche que no se vio), y lo alto de la pared, con el plano;
   - lo que se fue (la persona) no queda;
   - lo hecho no se vuelve a escanear (su versión no cambia) y la mayoría del cuarto queda hecho;
   - cuánto tarda cada foto y cada malla.
     javac -d /tmp/m android/app/src/main/java/ar/aeroplaza/Malla.java pruebas/malla/PruebaMalla.java && java -cp /tmp/m ar.aeroplaza.PruebaMalla
   (o node pruebas/malla.mjs) */
public class PruebaMalla {
  static final int W = 160, H = 120;
  static final float F = (float) (W / 2 / Math.tan(Math.toRadians(33)));
  static final Random azar = new Random(7);
  static int bien = 0, mal = 0;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }

  /* el cuarto: por dentro de la caja; la mesa y la persona, cajas por fuera */
  static final float[] CUARTO = { -2f, 0f, -3f, 2f, 2.6f, 2f }, MESA = { -0.5f, 0f, -1.5f, 0.5f, 0.75f, -0.9f }, PERSONA = { 0.8f, 0f, -1.9f, 1.2f, 1.75f, -1.6f };
  /* (un palo de 5 × 5 cm y 1,2 m, como la pata de una lámpara: lo fino es lo que más cuesta) */
  static final float[] PALO = { -1.225f, 0f, 0.775f, -1.175f, 1.2f, 0.825f };
  static boolean conPersona = true;

  /* distancia por el rayo hasta lo primero que toca (o -1) */
  static float rayo(float ox, float oy, float oz, float dx, float dy, float dz) {
    float t = salida(CUARTO, ox, oy, oz, dx, dy, dz);
    float m = entrada(MESA, ox, oy, oz, dx, dy, dz); if (m > 0 && m < t) t = m;
    float pl = entrada(PALO, ox, oy, oz, dx, dy, dz); if (pl > 0 && pl < t) t = pl;
    if (conPersona) { float p = entrada(PERSONA, ox, oy, oz, dx, dy, dz); if (p > 0 && p < t) t = p; }
    return t;
  }
  static float salida(float[] b, float ox, float oy, float oz, float dx, float dy, float dz) {
    float t = Float.MAX_VALUE; float[] o = { ox, oy, oz }, d = { dx, dy, dz };
    for (int e = 0; e < 3; e++) { if (Math.abs(d[e]) < 1e-9) continue; float s = ((d[e] > 0 ? b[e + 3] : b[e]) - o[e]) / d[e]; if (s > 0 && s < t) t = s; }
    return t;
  }
  static float entrada(float[] b, float ox, float oy, float oz, float dx, float dy, float dz) {
    float t0 = -Float.MAX_VALUE, t1 = Float.MAX_VALUE; float[] o = { ox, oy, oz }, d = { dx, dy, dz };
    for (int e = 0; e < 3; e++) {
      if (Math.abs(d[e]) < 1e-9) { if (o[e] < b[e] || o[e] > b[e + 3]) return -1; continue; }
      float a = (b[e] - o[e]) / d[e], c = (b[e + 3] - o[e]) / d[e]; if (a > c) { float x = a; a = c; c = x; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    return t0 <= t1 && t0 > 0 ? t0 : -1;
  }
  /* la distancia de un punto a la superficie más cercana (de verdad) */
  static float dcaja(float[] b, float x, float y, float z, boolean dentro) {
    if (dentro) return Math.min(Math.min(Math.min(x - b[0], b[3] - x), Math.min(y - b[1], b[4] - y)), Math.min(z - b[2], b[5] - z));
    float qx = Math.max(Math.max(b[0] - x, 0), x - b[3]), qy = Math.max(Math.max(b[1] - y, 0), y - b[4]), qz = Math.max(Math.max(b[2] - z, 0), z - b[5]);
    float fuera = (float) Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (fuera > 0) return fuera;
    return Math.min(Math.min(Math.min(x - b[0], b[3] - x), Math.min(y - b[1], b[4] - y)), Math.min(z - b[2], b[5] - z));
  }
  static float dverdad(float x, float y, float z) { return Math.min(Math.min(Math.abs(dcaja(CUARTO, x, y, z, true)), Math.abs(dcaja(MESA, x, y, z, false))), Math.abs(dcaja(PALO, x, y, z, false))); }
  /* lo que ARCore no ve: el parche del piso y lo alto de la pared derecha */
  static boolean ciego(float x, float y, float z) { return (y < 0.01f && x > 0.3f && x < 0.42f && z > -1.1f && z < -0.98f) || (x > 1.99f && y > 1.7f); }

  public static void main(String[] a) {
    Malla M = new Malla();
    short[] mm = new short[W * H]; byte[] conf = new byte[W * H];
    float[] m = new float[16];
    int fotos = 0; long tInt = 0, tMal = 0; int nMal = 0;
    /* (lo de cada bloque cuando quedó hecho: al final tiene que ser igual) */
    HashMap<Long, short[]> alHacerse = new HashMap<>();
    /* el recorrido: en círculo por el medio del cuarto, mirando para afuera y un poco abajo, dos vueltas */
    int PASOS = 160, FINAL = 24;
    for (int i = 0; i < PASOS + FINAL; i++) {
      float u = i / (float) PASOS, ang = u * 4 * (float) Math.PI;
      float cx = (float) Math.cos(ang * 0.5) * 0.6f, cz = -0.5f + (float) Math.sin(ang * 0.5) * 0.6f, cy = 1.45f;
      float rumbo = ang, cab = -0.35f + 0.25f * (float) Math.sin(ang * 1.7);
      /* (al final, desde un costado de la mesa, mirar otra vez donde estaba la persona: más abajo y de un lado al otro) */
      if (i >= PASOS) { float f = (i - PASOS) / (float) FINAL; cx = 0.55f; cz = -0.6f; rumbo = -0.35f + 0.3f * (float) Math.sin(f * 6.3f); cab = -0.55f - 0.15f * (float) Math.cos(f * 6.3f); }
      conPersona = i < 6;
      /* la pose (columnas: derecha, arriba, atrás, lugar) */
      float cr = (float) Math.cos(rumbo), sr = (float) Math.sin(rumbo), cc = (float) Math.cos(cab), sc = (float) Math.sin(cab);
      float[] fw = { -sr * cc, sc, -cr * cc }, der = { cr, 0, -sr }, arr = { der[1] * fw[2] - der[2] * fw[1], der[2] * fw[0] - der[0] * fw[2], der[0] * fw[1] - der[1] * fw[0] };
      m[0] = der[0]; m[1] = der[1]; m[2] = der[2]; m[4] = arr[0]; m[5] = arr[1]; m[6] = arr[2]; m[8] = -fw[0]; m[9] = -fw[1]; m[10] = -fw[2]; m[12] = cx; m[13] = cy; m[14] = cz; m[15] = 1;
      for (int v = 0; v < H; v++) for (int x = 0; x < W; x++) {
        float xc = (x + 0.5f - W / 2f) / F, yc = (H / 2f - (v + 0.5f)) / F;
        float dx = m[0] * xc + m[4] * yc - m[8], dy = m[1] * xc + m[5] * yc - m[9], dz = m[2] * xc + m[6] * yc - m[10];
        float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
        float t = rayo(cx, cy, cz, dx, dy, dz), z = t / l;   // (la profundidad es por el eje, no por el rayo)
        float px = cx + dx * t, py = cy + dy * t, pz = cz + dz * t;
        int k = v * W + x;
        if (ciego(px, py, pz) || azar.nextFloat() < 0.08f || z > 6f) { mm[k] = 0; conf[k] = 0; continue; }
        float ruido = (float) azar.nextGaussian() * (0.002f + 0.004f * z * z);
        mm[k] = (short) Math.round((z + ruido) * 1000); conf[k] = (byte) (z < 3 ? 230 : 160);
      }
      long t0 = System.nanoTime();
      M.integrar(mm, conf, W, H, F, F, W / 2f, H / 2f, m, 1);
      /* los planos: el piso y la pared derecha (como los daría ARCore), cada tanto */
      if (i % 10 == 0) {
        float[] piso = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -0.5f, 1 };
        M.rellenarPlano(piso, new float[] { -2f, -2.5f, 2f, -2.5f, 2f, 2.5f, -2f, 2.5f });
        /* (la pared derecha: la normal (su y) hacia adentro, -x; su x por z y su z por y del mundo) */
        float[] pared = { 0, 0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2f, 1.3f, -0.5f, 1 };
        M.rellenarPlano(pared, new float[] { -2.5f, -1.3f, 2.5f, -1.3f, 2.5f, 1.3f, -2.5f, 1.3f });
      }
      long t1 = System.nanoTime(); tInt += t1 - t0; fotos++;
      for (Malla.Bloque b : M.sucios(Long.MAX_VALUE, 0, 100000)) {
        long t2 = System.nanoTime(); M.mallar(b); tMal += System.nanoTime() - t2; nMal++;
        if (b.hecho) alHacerse.putIfAbsent(Malla.clave(b.bx, b.by, b.bz), b.d.clone());
      }
    }
    /* la malla entera */
    ArrayList<float[]> verts = new ArrayList<>(); int relleno = 0, cuadros = 0;
    for (Malla.Bloque b : M.bloques.values()) {
      byte[] d = mallaDe(M, b); if (d == null) continue;
      ByteBuffer o = ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN);
      for (int p = 0; p + 16 <= d.length; p += 16) { float x = o.getFloat(p), y = o.getFloat(p + 4), z = o.getFloat(p + 8); int fl = o.get(p + 15) & 0xFF; verts.add(new float[] { x, y, z, fl & 1 }); if ((fl & 1) != 0) relleno++; }
      cuadros += d.length / 96;
    }
    /* 1) precisa */
    float[] err = new float[verts.size()]; int ne = 0;
    for (float[] v : verts) if (v[3] == 0) err[ne++] = dverdad(v[0], v[1], v[2]);
    float[] e = Arrays.copyOf(err, ne); Arrays.sort(e);
    double prom = 0; for (float x : e) prom += x; prom /= Math.max(1, ne);
    float p95 = ne > 0 ? e[(int) (ne * 0.95)] : 1;
    /* (hacia dónde se corre cada superficie: + es hacia adentro del cuarto, el lado vacío) */
    double[] sp = new double[4]; int[] np = new int[4];
    for (float[] v : verts) { if (v[3] != 0) continue;
      if (Math.abs(v[1]) < 0.04f && Math.abs(v[0]) < 1.5f && v[2] > -2.5f && v[2] < 1.5f && !(v[0] > -0.6f && v[0] < 0.6f && v[2] > -1.6f && v[2] < -0.8f)) { sp[0] += v[1]; np[0]++; }
      else if (Math.abs(v[0] + 2f) < 0.04f && v[1] > 0.2f && v[1] < 2.4f) { sp[1] += v[0] + 2f; np[1]++; }
      else if (Math.abs(v[2] + 3f) < 0.04f && v[1] > 0.2f && v[1] < 2.4f) { sp[2] += v[2] + 3f; np[2]++; }
      else if (Math.abs(v[1] - 2.6f) < 0.04f) { sp[3] += 2.6f - v[1]; np[3]++; } }
    System.out.println(String.format("  (percentiles del error: 50 %% %.1f · 75 %% %.1f · 90 %% %.1f · 99 %% %.1f mm · lo peor %.0f mm)", e[ne / 2] * 1000, e[ne * 3 / 4] * 1000, e[ne * 9 / 10] * 1000, e[(int) (ne * 0.99)] * 1000, e[ne - 1] * 1000));
    System.out.println(String.format("  (corrimiento: piso %+.1f mm · pared izquierda %+.1f · pared del fondo %+.1f · techo %+.1f)", sp[0] / Math.max(1, np[0]) * 1000, sp[1] / Math.max(1, np[1]) * 1000, sp[2] / Math.max(1, np[2]) * 1000, sp[3] / Math.max(1, np[3]) * 1000));
    prueba("precisa: los vértices vistos, a menos de 1 cm de la superficie (promedio) y el 95 % a menos de 2 cm", prom < 0.01 && p95 < 0.02, String.format("%.1f mm de promedio · 95 %%: %.1f mm · %d vértices", prom * 1000, p95 * 1000, ne));
    /* 2) llena: el piso a la vista (hasta 3 m del medio) y el parche; lo alto de la pared, con el plano */
    int enPiso = 0, piso = 0, enParche = 0, parche = 0, enAlto = 0, alto = 0;
    HashMap<Long, ArrayList<float[]>> rej = new HashMap<>();
    for (float[] v : verts) rej.computeIfAbsent(celda(v[0], v[1], v[2]), q -> new ArrayList<>()).add(v);
    for (float x = -1.9f; x <= 1.9f; x += 0.1f) for (float z = -2.9f; z <= 1.9f; z += 0.1f) {
      if (x > -0.55f && x < 0.55f && z > -1.55f && z < -0.85f) continue;   // (debajo de la mesa)
      boolean ok = cerca(rej, x, 0, z, 0.03f); piso++; if (ok) enPiso++;
    }
    for (float x = 0.31f; x < 0.42f; x += 0.02f) for (float z = -1.09f; z < -0.98f; z += 0.02f) { parche++; if (cerca(rej, x, 0, z, 0.03f)) enParche++; }
    for (float y = 1.75f; y < 2.55f; y += 0.1f) for (float z = -2.9f; z < 1.9f; z += 0.1f) { alto++; if (cerca(rej, 2f, y, z, 0.03f)) enAlto++; }
    prueba("llena: el piso cubierto (lo de debajo de la mesa no cuenta), y el parche de 12 cm que no se vio", enPiso > piso * 0.95 && enParche > parche * 0.9, String.format("piso %d/%d · parche %d/%d", enPiso, piso, enParche, parche));
    prueba("lo alto de la pared, que la profundidad no vio, lo llena el plano", enAlto > alto * 0.9, String.format("%d/%d · %d vértices de relleno", enAlto, alto, relleno));
    /* el palo: a cada altura (de a 10 cm), algo de la malla sobre sus caras */
    int alturas = 0, conPalo = 0;
    for (float y = 0.15f; y < 1.1f; y += 0.1f) { alturas++; boolean hay = false; for (float[] v : verts) if (v[3] == 0 && Math.abs(v[1] - y) < 0.05f && Math.abs(dcaja(PALO, v[0], v[1], v[2], false)) < 0.015f) { hay = true; break; } if (hay) conPalo++; }
    prueba("lo fino: el palo de 5 cm aparece de arriba abajo (vértices a menos de 1,5 cm de sus caras)", conPalo >= alturas - 1, conPalo + " de " + alturas + " alturas");
    /* 3) lo que se fue no queda */
    int dePersona = 0; for (float[] v : verts) if (v[1] > 0.1f && v[0] > 0.75f && v[0] < 1.25f && v[2] > -1.95f && v[2] < -1.55f) dePersona++;
    { int enHecho = 0; float[] pc = { 1.0f, 1.0f, -1.75f };
      for (Malla.Bloque bq : M.bloques.values()) { float x0 = bq.bx * 0.48f, y0 = bq.by * 0.48f, z0 = bq.bz * 0.48f; if (x0 > 1.25f || x0 + 0.48f < 0.75f || z0 > -1.55f || z0 + 0.48f < -1.95f || y0 > 1.8f) continue;
        int wmax = 0, neg = 0; for (int k = 0; k < Malla.N3; k++) { int w = bq.w[k]; if (w == Malla.RELLENO) continue; if (w > wmax) wmax = w; if (w >= 2 && bq.d[k] < 0) neg++; }
        System.out.println(String.format("  (bloque de la persona %d,%d,%d: hecho %b · vistas %d · estable %d · peso máx %d · negativos %d)", bq.bx, bq.by, bq.bz, bq.hecho, bq.vistas, bq.estable, wmax, neg)); } }
    { int[] hy = new int[10], hs = new int[6]; for (float[] v : verts) if (v[1] > 0.1f && v[0] > 0.75f && v[0] < 1.25f && v[2] > -1.95f && v[2] < -1.55f) { hy[Math.min(9, (int) (v[1] / 0.2f))]++;
        float dx0 = Math.abs(v[0] - 0.8f), dx1 = Math.abs(v[0] - 1.2f), dz0 = Math.abs(v[2] + 1.9f), dz1 = Math.abs(v[2] + 1.6f), dy = Math.abs(v[1] - 1.75f); float mn = Math.min(Math.min(Math.min(dx0, dx1), Math.min(dz0, dz1)), dy);
        hs[mn == dx0 ? 0 : mn == dx1 ? 1 : mn == dz0 ? 2 : mn == dz1 ? 3 : 4]++; }
      int rr = 0; for (float[] v : verts) if (v[3] != 0 && v[1] > 0.1f && v[0] > 0.75f && v[0] < 1.25f && v[2] > -1.95f && v[2] < -1.55f) rr++;
      System.out.println("  (restos de relleno: " + rr + " · por altura, de a 20 cm: " + Arrays.toString(hy) + " · por cara x0.8 x1.2 z-1.9 z-1.6 arriba: " + Arrays.toString(hs) + ")"); }
    prueba("la persona que pasó al principio no queda en la malla", dePersona < 10, dePersona + " vértices donde estaba");
    /* 4) lo hecho no se reescanea */
    int[] c = M.cuenta(); int cambiaronHechos = 0;
    for (Malla.Bloque b : M.bloques.values()) { short[] d0 = alHacerse.get(Malla.clave(b.bx, b.by, b.bz)); if (d0 != null && !Arrays.equals(d0, b.d)) cambiaronHechos++; }
    prueba("lo hecho no se vuelve a escanear (no cambia nada), y la mayor parte del cuarto queda hecha", cambiaronHechos == 0 && c[1] > c[0] * 0.5f, String.format("%d de %d bloques hechos · %d hechos que cambiaron", c[1], c[0], cambiaronHechos));
    /* 5) cuánto tarda */
    double msF = tInt / 1e6 / fotos, msM = tMal / 1e6 / Math.max(1, nMal);
    prueba("rápida: cada foto de 160 × 120 y cada malla de bloque (en la compu, con margen para la tanda en paralelo; en un celu ~4 veces más)", msF < 25 && msM < 3, String.format("%.1f ms por foto · %.2f ms por bloque · %d cuadrados", msF, msM, cuadros));
    /* (con una carpeta: cada bloque como lo manda Espacio.java y su índice, para la prueba del juego) */
    if (a.length > 0) try {
      java.io.File dir = new java.io.File(a[0]); dir.mkdirs(); StringBuilder ix = new StringBuilder("{\"bloques\":[");
      boolean pri = true;
      for (Malla.Bloque b : M.bloques.values()) {
        byte[] d = mallaDe(M, b); if (d == null) continue;
        String k = b.bx + "_" + b.by + "_" + b.bz;
        java.nio.file.Files.write(new java.io.File(dir, k + ".bin").toPath(), d);
        if (!pri) ix.append(','); pri = false;
        ix.append("[\"").append(k).append("\",").append(b.bx).append(',').append(b.by).append(',').append(b.bz).append(',').append(b.version).append(',').append(d.length).append(',').append(b.hecho ? 1 : 0).append(']');
      }
      ix.append("],\"total\":").append(c[0]).append(",\"hechos\":").append(c[1]).append(",\"cuadros\":").append(cuadros).append('}');
      java.nio.file.Files.write(new java.io.File(dir, "indice.json").toPath(), ix.toString().getBytes("UTF-8"));
    } catch (Exception x) { System.out.println("✗ no se pudo guardar la malla: " + x); mal++; }
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal > 0 ? 1 : 0);
  }
  static byte[] mallaDe(Malla M, Malla.Bloque b) { boolean h = b.hecho; int vs = b.vistas, ve = b.version, es = b.estable, gr = b.grandes; byte[] d = M.mallar(b); b.vistas = vs; b.version = ve; b.hecho = h; b.estable = es; b.grandes = gr; return d; }
  static long celda(float x, float y, float z) { return Malla.clave(Malla.piso(x / 0.05f), Malla.piso(y / 0.05f), Malla.piso(z / 0.05f)); }
  static boolean cerca(HashMap<Long, ArrayList<float[]>> rej, float x, float y, float z, float r) {
    int ix = Malla.piso(x / 0.05f), iy = Malla.piso(y / 0.05f), iz = Malla.piso(z / 0.05f);
    for (int dz = -1; dz <= 1; dz++) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      ArrayList<float[]> l = rej.get(Malla.clave(ix + dx, iy + dy, iz + dz)); if (l == null) continue;
      for (float[] v : l) { float a = v[0] - x, b = v[1] - y, c = v[2] - z; if (a * a + b * b + c * c < r * r) return true; }
    }
    return false;
  }
}
