package ar.aeroplaza;

import java.util.Locale;
import java.util.Random;

/* LA CABEZA EN 6 EJES (vuelta 39), en la compu: una cabeza de mentira que gira despacio y a veces rápido (70° en
   0,35 s) y se corre de a poco; el giroscopio a 200 por segundo, con ruido y con el rumbo que se corre 0,5°/s;
   ARCore a 30 fotos por segundo, con ruido y 45 ms tarde. Cada 1/60 s se pide la cabeza para 25 ms después y se
   compara con la de verdad. Contra "lo de antes" (js/nativo.js › poseEn: la última pose de ARCore adelantada con
   el giro de las dos últimas y la velocidad suavizada de los ojos). Imprime ✓/✗ como PruebaMalla.
     javac -d <dir> android/app/src/main/java/ar/aeroplaza/Fusion.java pruebas/cabeza/PruebaFusion.java
     java -cp <dir> ar.aeroplaza.PruebaFusion */
public class PruebaFusion {
  static int bien = 0, mal = 0;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }

  /* ------------------------------------------ la cabeza de verdad (en el mundo de ARCore, la cámara orientada a la pantalla) */
  static double giroRapido(double t) {
    double a = 0; double[] T = { 5, 9, 13, 16.5 }; int s = 1;
    for (double t0 : T) { double u = Math.max(0, Math.min(1, (t - t0) / 0.35)); a += s * Math.toRadians(70) * u * u * (3 - 2 * u); s = -s; }
    return a;
  }
  static float[] qVerdad(double t) {
    double yaw = 1.0 * Math.sin(2 * Math.PI * 0.35 * t) + giroRapido(t), pitch = 0.3 * Math.sin(2 * Math.PI * 0.5 * t + 1), roll = 0.08 * Math.sin(2 * Math.PI * 0.8 * t);
    float[] qy = eje(0, 1, 0, yaw), qx = eje(1, 0, 0, pitch), qz = eje(0, 0, 1, roll), o = new float[4], o2 = new float[4];
    Fusion.mul(qy, qx, o); Fusion.mul(o, qz, o2); return o2;
  }
  static float[] ojosVerdad(double t) { return new float[] { (float) (0.10 * Math.sin(2 * Math.PI * 0.4 * t)), (float) (1.5 + 0.03 * Math.sin(2 * Math.PI * 0.9 * t)), (float) (0.08 * Math.sin(2 * Math.PI * 0.3 * t)) }; }
  static float[] eje(double x, double y, double z, double a) { double s = Math.sin(a / 2); return new float[] { (float) (x * s), (float) (y * s), (float) (z * s), (float) Math.cos(a / 2) }; }
  static double ang(float[] p, float[] q) { float[] a = new float[4], b = new float[4]; Fusion.conj(p, a); Fusion.mul(a, q, b); return Math.toDegrees(Fusion.angulo(b)); }
  /* (q por un giro chico al azar: eje al azar, ángulo normal de desvío "grados") */
  static float[] ruido(float[] q, Random r, double grados) {
    double x = r.nextGaussian(), y = r.nextGaussian(), z = r.nextGaussian(), l = Math.sqrt(x * x + y * y + z * z) + 1e-12;
    float[] e = eje(x / l, y / l, z / l, Math.toRadians(grados) * r.nextGaussian()), o = new float[4]; Fusion.mul(q, e, o); normal(o); return o;
  }
  static void normal(float[] q) { Fusion.normalizar(q, 0); }

  /* una corrida: devuelve {error del giro medio, p95, máx en los giros rápidos, error del lugar medio (mm), temblor del giro (°), temblor del lugar (mm), ejes} y lo mismo para lo de antes */
  static double[][] correr(long semilla, int cEjes, boolean relojDistinto, double deriva, int fotosPorSeg) {
    Random r = new Random(semilla); prevV1 = prevV2 = lvA1 = lvA2 = null;
    Fusion f = new Fusion();
    float[] C = f.C[cEjes];
    float[] Wbase = new float[4]; Fusion.mul(eje(0, 1, 0, 0.65), eje(1, 0, 0, -Math.PI / 2), Wbase);
    final double DT = 0.001, FIN = 20;
    /* (lo de antes: las dos últimas poses que llegaron, y la velocidad de los ojos) */
    float[][] qAnt = new float[2][]; double[] tAnt = { -1, -1 }; float[][] eAnt = new float[2][]; double[] vel = new double[3];
    java.util.ArrayList<double[]> cola = new java.util.ArrayList<>();   // fotos por llegar: {t, llega, ...}
    java.util.ArrayList<Double> eG = new java.util.ArrayList<>(), eGv = new java.util.ArrayList<>(), eL = new java.util.ArrayList<>(), eLv = new java.util.ArrayList<>();
    double maxRapido = 0, maxRapidoV = 0; double[] temb = new double[4]; int nt = 0;
    float[] out = new float[7], prev1 = null, prev2 = null, pv1 = null, pv2 = null; float[] l1 = null, l2 = null, lv1 = null, lv2 = null;
    long reloj = relojDistinto ? 1_000_000_000L : 0;   // (la cámara con otro reloj)
    for (int k = 0; k * DT < FIN; k++) {
      double t = k * DT; long tn = (long) (t * 1e9);
      /* el giroscopio: 200 por segundo, llega 5 ms después */
      if (k % 5 == 0 && t >= 0.005) {
        double ts = t - 0.005; float[] qA = qVerdad(ts), W = new float[4], Wi = new float[4], Ci = new float[4], a = new float[4], qi = new float[4];
        Fusion.mul(eje(0, 1, 0, Math.toRadians(deriva) * ts), Wbase, W);
        Fusion.conj(W, Wi); Fusion.conj(C, Ci); Fusion.mul(Wi, qA, a); Fusion.mul(a, Ci, qi);
        qi = ruido(qi, r, RI);
        f.rotacion((long) (ts * 1e9), qi[0], qi[1], qi[2], qi[3]);
        /* ω en los ejes del celu, de la verdad (±1 ms) con ruido */
        float[] qa2 = qVerdad(ts + 0.001), W2 = new float[4], W2i = new float[4], b = new float[4], qj = new float[4], d = new float[4];
        Fusion.mul(eje(0, 1, 0, Math.toRadians(deriva) * (ts + 0.001)), Wbase, W2); Fusion.conj(W2, W2i); Fusion.mul(W2i, qa2, b); Fusion.mul(b, Ci, qj);
        float[] qiL = new float[4]; Fusion.mul(Wi, qA, a); Fusion.mul(a, Ci, qiL);
        Fusion.conj(qiL, a); Fusion.mul(a, qj, d); if (d[3] < 0) for (int i = 0; i < 4; i++) d[i] = -d[i];
        double s = Math.sqrt(Math.max(0, 1 - d[3] * d[3])), an = 2 * Math.acos(Math.min(1, d[3])), m = s > 1e-9 ? an / s / 0.001 : 0;
        f.giro((long) (ts * 1e9), (float) (d[0] * m + r.nextGaussian() * 0.01), (float) (d[1] * m + r.nextGaussian() * 0.01), (float) (d[2] * m + r.nextGaussian() * 0.01));
      }
      /* ARCore: fotos a 30 por segundo, llegan 45 ms después */
      if (k % (1000 / fotosPorSeg) == 0) {
        float[] q = ruido(qVerdad(t), r, RA), e = ojosVerdad(t), o = new float[3];
        Fusion.rotar(q, 0, 0, Fusion.OJOS, o);
        float px = (float) (e[0] - o[0] + r.nextGaussian() * 0.0015), py = (float) (e[1] - o[1] + r.nextGaussian() * 0.0015), pz = (float) (e[2] - o[2] + r.nextGaussian() * 0.0015);
        cola.add(new double[] { t, t + 0.045, px, py, pz, q[0], q[1], q[2], q[3] });
      }
      for (int i = 0; i < cola.size(); ) {
        double[] F = cola.get(i);
        if (F[1] > t) { i++; continue; }
        cola.remove(i);
        f.foto((long) (F[0] * 1e9) + reloj, (float) F[2], (float) F[3], (float) F[4], (float) F[5], (float) F[6], (float) F[7], (float) F[8], tn);
        /* lo de antes */
        float[] q = { (float) F[5], (float) F[6], (float) F[7], (float) F[8] }, o = new float[3]; Fusion.rotar(q, 0, 0, Fusion.OJOS, o);
        float[] e = { (float) F[2] + o[0], (float) F[3] + o[1], (float) F[4] + o[2] };
        if (qAnt[0] != null) { double dt = F[0] - tAnt[0]; if (dt > 0.004 && dt < 0.12) for (int j = 0; j < 3; j++) vel[j] += 0.3 * ((e[j] - eAnt[0][j]) / dt - vel[j]); }
        qAnt[1] = qAnt[0]; tAnt[1] = tAnt[0]; eAnt[1] = eAnt[0]; qAnt[0] = q; tAnt[0] = F[0]; eAnt[0] = e;
      }
      /* el dibujo: 60 por segundo, para 25 ms después */
      if (k % 16 == 0 && t > 1.5) {
        double tv = t + 0.025; float[] qv = qVerdad(tv), ev = ojosVerdad(tv);
        if (!f.leer(tn, 25_000_000L, out)) continue;
        float[] qf = { out[0], out[1], out[2], out[3] };
        double e1 = ang(qf, qv), l = Math.sqrt(Math.pow(out[4] - ev[0], 2) + Math.pow(out[5] - ev[1], 2) + Math.pow(out[6] - ev[2], 2)) * 1000;
        /* lo de antes (poseEn) */
        float[] qa = qAnt[0].clone(); double dt = Math.min(0.08, Math.max(0, tv - tAnt[0])), dtp = tAnt[0] - tAnt[1];
        if (qAnt[1] != null && dtp > 0.004 && dtp < 0.12) {
          float[] a = new float[4], d = new float[4]; Fusion.conj(qAnt[1], a); Fusion.mul(a, qAnt[0], d); if (d[3] < 0) for (int i = 0; i < 4; i++) d[i] = -d[i];
          double s = Math.sqrt(Math.max(0, 1 - d[3] * d[3])), an = 2 * Math.acos(Math.min(1, d[3]));
          if (s > 1e-6 && an > 1e-5) { float[] ax = eje(d[0] / s, d[1] / s, d[2] / s, Math.min(20, an / dtp) * dt), o2 = new float[4]; Fusion.mul(qa, ax, o2); qa = o2; }
        }
        float[] lv = eAnt[0].clone(); double dl = 0.8 * Math.min(dt, 0.05); if (Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]) * dl < 0.05) for (int j = 0; j < 3; j++) lv[j] += vel[j] * dl;
        double e2 = ang(qa, qv), l2v = Math.sqrt(Math.pow(lv[0] - ev[0], 2) + Math.pow(lv[1] - ev[1], 2) + Math.pow(lv[2] - ev[2], 2)) * 1000;
        eG.add(e1); eGv.add(e2); eL.add(l); eLv.add(l2v);
        boolean rapido = false; for (double t0 : new double[] { 5, 9, 13, 16.5 }) if (tv > t0 - 0.05 && tv < t0 + 0.5) rapido = true;
        if (rapido) { maxRapido = Math.max(maxRapido, e1); maxRapidoV = Math.max(maxRapidoV, e2); }
        /* (el temblor: la segunda diferencia de lo dibujado, contra la de la verdad) */
        if (prev2 != null) {
          temb[0] += Math.pow(segunda(prev2, prev1, qf) - segunda(pv2, pv1, qv), 2); temb[1] += Math.pow(segunda(qAnt2(prevV2), qAnt2(prevV1), qa) - segunda(pv2, pv1, qv), 2);
          temb[2] += Math.pow(seg3(l2, l1, new float[] { out[4], out[5], out[6] }) - seg3(lv2 == null ? l2 : lv2, lv1 == null ? l1 : lv1, ev), 2);
          temb[3] += Math.pow(seg3(lvA2, lvA1, lv) - seg3(lv2 == null ? l2 : lv2, lv1 == null ? l1 : lv1, ev), 2); nt++;
        }
        prev2 = prev1; prev1 = qf; pv2 = pv1; pv1 = qv; prevV2 = prevV1; prevV1 = qa;
        l2 = l1; l1 = new float[] { out[4], out[5], out[6] }; lv2 = lv1; lv1 = ev; lvA2 = lvA1; lvA1 = lv;
      }
    }
    return new double[][] { { media(eG), pct(eG, 0.95), maxRapido, media(eL), Math.sqrt(temb[0] / Math.max(1, nt)), Math.sqrt(temb[2] / Math.max(1, nt)) * 1000, f.c },
      { media(eGv), pct(eGv, 0.95), maxRapidoV, media(eLv), Math.sqrt(temb[1] / Math.max(1, nt)), Math.sqrt(temb[3] / Math.max(1, nt)) * 1000, -1 } };
  }
  static float[] prevV1, prevV2, lvA1, lvA2;
  /* {error medio del giro sin ARCore (°), p95, cuánto se movió el lugar (m), error de la pose de la foto (°), lista} */
  static double[] ancha(long semilla) {
    Random r = new Random(semilla); Fusion f = new Fusion(); float[] C = f.C[1];
    float[] Wbase = new float[4]; Fusion.mul(eje(0, 1, 0, 0.65), eje(1, 0, 0, -Math.PI / 2), Wbase);
    float[] Wi = new float[4], Ci = new float[4]; Fusion.conj(Wbase, Wi); Fusion.conj(C, Ci);
    java.util.ArrayList<Double> e = new java.util.ArrayList<>(); float[] out = new float[7], p0 = null; double mov = 0, eFoto = 0; boolean lista = false;
    final double DT = 0.001, CORTE = 6, FIN = 12;
    for (int k = 0; k * DT < FIN; k++) {
      double t = k * DT; long tn = (long) (t * 1e9);
      if (k % 5 == 0) {
        float[] qA = qVerdad(t), a = new float[4], qi = new float[4]; Fusion.mul(Wi, qA, a); Fusion.mul(a, Ci, qi); qi = ruido(qi, r, RI);
        f.rotacion(tn, qi[0], qi[1], qi[2], qi[3]);
      }
      if (t < CORTE && k % 33 == 0) {
        float[] q = ruido(qVerdad(t), r, RA), ev = ojosVerdad(t), o = new float[3]; Fusion.rotar(q, 0, 0, Fusion.OJOS, o);
        f.foto(tn, ev[0] - o[0], ev[1] - o[1], ev[2] - o[2], q[0], q[1], q[2], q[3], tn);
      }
      if (Math.abs(t - CORTE) < DT / 2) f.congelar();
      if (t > CORTE + 0.1 && k % 16 == 0 && f.leer(tn, 0, out)) {
        e.add(ang(new float[] { out[0], out[1], out[2], out[3] }, qVerdad(t)));
        if (p0 == null) p0 = new float[] { out[4], out[5], out[6] };
        mov = Math.max(mov, Math.sqrt(Math.pow(out[4] - p0[0], 2) + Math.pow(out[5] - p0[1], 2) + Math.pow(out[6] - p0[2], 2)));
        /* la foto de hace 30 ms */
        float[] cam = new float[7]; lista = f.camaraEn(tn - 30_000_000L, cam);
        if (lista) eFoto = Math.max(eFoto, ang(new float[] { cam[3], cam[4], cam[5], cam[6] }, qVerdad(t - 0.03)));
      }
    }
    return new double[] { media(e), pct(e, 0.95), mov, eFoto, lista ? 1 : 0 };
  }
  static float[] qAnt2(float[] q) { return q; }
  /* (lo que cambia el cambio de giro de un cuadro al otro, en grados) */
  static double segunda(float[] a, float[] b, float[] c) { if (a == null || b == null) return 0; return ang(b, c) - ang(a, b); }
  static double seg3(float[] a, float[] b, float[] c) { if (a == null || b == null) return 0; double s = 0; for (int i = 0; i < 3; i++) { double d = c[i] - 2 * b[i] + a[i]; s += d * d; } return Math.sqrt(s); }
  static double media(java.util.List<Double> l) { double s = 0; for (double x : l) s += x; return s / Math.max(1, l.size()); }
  static double pct(java.util.List<Double> l, double p) { java.util.List<Double> c = new java.util.ArrayList<>(l); java.util.Collections.sort(c); return c.isEmpty() ? 0 : c.get(Math.min(c.size() - 1, (int) (p * c.size()))); }

  static double RI = 0.03, RA = 0.15;
  public static void main(String[] args) {
    Locale.setDefault(Locale.US);
    if (args.length >= 4) { String[] kv = args[3].split(","); for (String x : kv) { String[] u = x.split("="); double v = Double.parseDouble(u[1]); switch (u[0]) { case "GANA": Fusion.GANA = v; break; case "GANA_W": Fusion.GANA_W = v; break; case "TAU": Fusion.TAU_LUGAR = v; break; case "AL": Fusion.ADEL_LUGAR = v; break; case "TL": Fusion.TOPE_LUGAR = v; break; } } }
    if (args.length >= 3) { RI = Double.parseDouble(args[0]); RA = Double.parseDouble(args[1]); double[][] X = correr(1, 1, false, Double.parseDouble(args[2]), 30);
      System.out.println(String.format("medio %.2f p95 %.2f rapido %.1f lugar %.1f temb %.3f tembL %.2f / antes %.2f %.2f %.1f %.1f %.3f %.2f", X[0][0], X[0][1], X[0][2], X[0][3], X[0][4], X[0][5], X[1][0], X[1][1], X[1][2], X[1][3], X[1][4], X[1][5])); return; }
    double[][] R = correr(1, 1, false, 0.5, 30);
    double[] F = R[0], V = R[1];
    System.out.println(String.format("  (giro, grados: medio %.2f contra %.2f antes · p95 %.2f contra %.2f · en los giros rápidos, lo peor %.1f contra %.1f)", F[0], V[0], F[1], V[1], F[2], V[2]));
    System.out.println(String.format("  (lugar de los ojos, mm: medio %.1f contra %.1f · temblor del giro %.3f° contra %.3f° · del lugar %.2f contra %.2f mm)", F[3], V[3], F[4], V[4], F[5], V[5]));
    prueba("elige solos los ejes del celu contra la cámara (90°: la pantalla acostada)", F[6] == 1, "eligió " + (int) F[6]);
    prueba("el giro va pegado a la cabeza de verdad (a 25 ms), mucho más que con ARCore solo", F[1] < 1.5 && F[0] < V[0] / 3, String.format("p95 %.2f°, medio %.2f° contra %.2f°", F[1], F[0], V[0]));
    prueba("en los giros rápidos (70° en 0,35 s) no se pasa ni se queda", F[2] < 3 && F[2] < V[2] / 4, String.format("lo peor %.1f° contra %.1f°", F[2], V[2]));
    double[][] R0 = correr(1, 1, false, 0, 30);
    prueba("el giroscopio que se corre 0,5°/s (10° en la corrida, mucho más que uno de verdad) casi no se nota: ARCore lo corrige", F[0] - R0[0][0] < 0.3, String.format("medio %.2f° contra %.2f° sin correrse", F[0], R0[0][0]));
    prueba("tiembla mucho menos que antes (el giro, y el lugar)", F[4] < V[4] / 3 && F[5] < V[5], String.format("giro %.3f° contra %.3f° · lugar %.2f contra %.2f mm", F[4], V[4], F[5], V[5]));
    prueba("el lugar de los ojos va más pegado que antes (adelantado todo lo que tarda la foto)", F[3] < V[3], String.format("%.1f contra %.1f mm", F[3], V[3]));
    /* con las otras tres pantallas */
    StringBuilder sb = new StringBuilder(); boolean ok = true;
    for (int c = 0; c < 4; c++) { double[][] Rc = correr(10 + c, c, false, 0.5, 30); sb.append(String.format("%d→%d %.2f° ", c, (int) Rc[0][6], Rc[0][1])); ok &= Rc[0][6] == c && Rc[0][1] < 1.5; }
    prueba("con la pantalla de cualquier lado (0, 90, 180, 270°) elige bien y va pegado", ok, sb.toString().trim());
    /* ARCore a 60 */
    double[][] R60 = correr(3, 1, false, 0.5, 60);
    prueba("con ARCore a 60 fotos por segundo, igual", R60[0][1] < 1.5 && R60[0][0] < R60[1][0] / 2.5, String.format("p95 %.2f°, medio %.2f° contra %.2f°", R60[0][1], R60[0][0], R60[1][0]));
    /* la cámara con otro reloj: se usa ahora − 30 ms */
    double[][] Rr = correr(4, 1, true, 0.5, 30);
    prueba("con la hora de la cámara en otro reloj, sigue andando (peor, pero mejor que antes)", Rr[0][6] == 1 && Rr[0][1] < 2.5 && Rr[0][0] < Rr[1][0], String.format("p95 %.2f°, medio %.2f° contra %.2f°", Rr[0][1], Rr[0][0], Rr[1][0]));
    /* (vuelta 42) la ultra ancha: 6 s con ARCore, y después ARCore en pausa (congelar): el giro sigue con el
       giroscopio, el lugar queda quieto, y la pose de la cámara para la foto sale en su hora */
    double[] A = ancha(7);
    prueba("sin ARCore (la 0,5x) el giro sigue pegado a la cabeza con el giroscopio solo", A[0] < 1.5 && A[1] < 3, String.format("medio %.2f°, p95 %.2f° (6 s sin ARCore)", A[0], A[1]));
    prueba("y el lugar se queda donde estaba (no sigue corriendo con la última velocidad)", A[2] < 0.002, String.format("se movió %.2f mm", A[2] * 1000));
    prueba("la pose de la cámara para la foto de la 0,5x, en la hora de la foto", A[3] < 1.5 && A[4] == 1, String.format("%.2f° · lista %s", A[3], A[4] == 1));
    /* lo que tarda leer */
    Fusion f = new Fusion(); for (int i = 0; i < 300; i++) f.rotacion(i * 5_000_000L, 0, 0, 0, 1);
    f.c = 1; f.alineado = true; f.hayF = true; f.tF = 1_000_000_000L; float[] o = new float[7];
    long t0 = System.nanoTime(); for (int i = 0; i < 100000; i++) f.leer(1_500_000_000L + i, 25_000_000L, o); double us = (System.nanoTime() - t0) / 1e3 / 100000;
    prueba("leer la cabeza es instantáneo", us < 5, String.format("%.2f µs", us));
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal > 0 ? 1 : 0);
  }
}
