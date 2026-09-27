package ar.aeroplaza;

/* LA CABEZA EN 6 EJES, SUAVE (vuelta 39, "6dof súper suave, es muy impreciso"). Java puro (sin Android: se
   prueba en la compu, pruebas/cabeza/PruebaFusion.java).
   Antes el giro de la vista era el de ARCore: una pose por foto de la cámara (30-60 por segundo), que llega
   30-60 ms tarde y pasa por el puente de la WebView, adelantada con la velocidad de sus dos últimas poses
   (ruidosa). Ahora, como un visor:
   - EL GIRO, del giroscopio del sistema (el vector de rotación "de juego": giróscopo + acelerómetro, sin la
     brújula), a cientos de muestras por segundo, adelantado con la velocidad del giróscopo hasta cuando se ve;
   - ARCORE, para dos cosas: dónde está la cabeza (el lugar) y corregir de a poco para dónde mira el giroscopio
     (que se corre despacio en el rumbo). La corrección compara la pose de cada foto con el giroscopio EN EL
     MISMO INSTANTE (la hora de la foto), así el atraso de ARCore no entra;
   - los ejes: el celu y la cámara "orientada a la pantalla" difieren en un giro de 0, 90, 180 o 270° alrededor
     de z (según cómo está la pantalla). Se elige solo, comparando cuánto giró ARCore entre dos fotos con cuánto
     giró el giroscopio, con cada uno de los cuatro;
   - el lugar: el de los ojos (OJOS detrás del celu) en la última foto, adelantado con su velocidad suavizada, y
     con un resorte corto (TAU_LUGAR) para que el salto de cada foto nueva no se vea como un escalón.
   Los cuaterniones van como x, y, z, w. Los tiempos, en ns del mismo reloj (elapsedRealtimeNanos) */
final class Fusion {
  static final int N = 512;                 // las muestras del giroscopio que se guardan (~1-2 s)
  static final float OJOS = 0.06f;          // los ojos, detrás del celu (m; como vr.js › OJOS)
  /* (no final: pruebas/cabeza/PruebaFusion.java las barre) */
  static double GANA = 0.12;                // cuánto se corrige el rumbo hacia ARCore en cada foto (quieto)
  static double GANA_W = 3.0;               // y menos girando: GANA / (1 + ω / GANA_W) (rad/s)
  static double ADEL_MAX = 0.08;            // lo más que se adelanta el giro (s)
  static double TAU_LUGAR = 0.015;          // el resorte del lugar (s)
  static double ADEL_LUGAR = 1.0, TOPE_LUGAR = 0.08;   // cuánto de la velocidad de los ojos se adelanta, y hasta cuánto (s)
  final long[] tI = new long[N]; final float[] qI = new float[N * 4]; int nI = 0, ult = -1;
  final float[] w = new float[3]; long tW = Long.MIN_VALUE / 4;   // (/4: restar sin desbordar)
  /* (la elección de los ejes: el error de cada uno de los cuatro, relativo a lo que giró, suavizado) */
  final double[] err = new double[4]; int nCal = 0, c = -1;
  final float[][] C = new float[4][];
  final float[] qW = { 0, 0, 0, 1 }; boolean alineado;
  final float[] qArAnt = new float[4], qIAnt = new float[4]; long tAnt = Long.MIN_VALUE;
  final float[] eF = new float[3], vE = new float[3]; long tF = Long.MIN_VALUE; boolean hayF;
  final float[] pOut = new float[3]; long tOut = Long.MIN_VALUE;
  int fotos, sinGiro;
  private final float[] a = new float[4], b = new float[4], d = new float[4], e4 = new float[4];

  Fusion() { for (int k = 0; k < 4; k++) { double h = k * Math.PI / 4; C[k] = new float[] { 0, 0, (float) Math.sin(h), (float) Math.cos(h) }; } }

  /* ------------------------------------------ lo que llega */
  synchronized void rotacion(long t, float x, float y, float z, float ww) {
    ult = (ult + 1) % N; tI[ult] = t; int i = ult * 4; qI[i] = x; qI[i + 1] = y; qI[i + 2] = z; qI[i + 3] = ww; normalizar(qI, i);
    if (nI < N) nI++;
    /* (el mismo hemisferio que la anterior: la interpolación no da la vuelta larga) */
    if (nI > 1) { int j = ((ult - 1 + N) % N) * 4; if (qI[i] * qI[j] + qI[i + 1] * qI[j + 1] + qI[i + 2] * qI[j + 2] + qI[i + 3] * qI[j + 3] < 0) for (int k = 0; k < 4; k++) qI[i + k] = -qI[i + k]; }
  }
  synchronized void giro(long t, float x, float y, float z) { w[0] = x; w[1] = y; w[2] = z; tW = t; }

  /* una foto de ARCore: su hora, el lugar y el giro de la cámara orientada a la pantalla; ahora, para cuando la
     hora de la cámara no es la del giroscopio */
  synchronized void foto(long t, float px, float py, float pz, float qx, float qy, float qz, float qw, long ahora) {
    fotos++;
    final float[] qA = { qx, qy, qz, qw }; normalizar(qA, 0);
    /* (los ojos y su velocidad, suavizada: con la de las dos últimas fotos el ruido de ARCore se agrandaba) */
    float ex = px, ey = py, ez = pz; { rotar(qA, 0, 0, OJOS, e4); ex += e4[0]; ey += e4[1]; ez += e4[2]; }
    if (hayF) { double dt = (t - tF) / 1e9; if (dt > 0.004 && dt < 0.12) { vE[0] += 0.3f * ((ex - eF[0]) / dt - vE[0]); vE[1] += 0.3f * ((ey - eF[1]) / dt - vE[1]); vE[2] += 0.3f * ((ez - eF[2]) / dt - vE[2]); } else { vE[0] = vE[1] = vE[2] = 0; } }
    eF[0] = ex; eF[1] = ey; eF[2] = ez; tF = t; hayF = true;
    if (nI < 2) return;
    /* (si la hora de la cámara no cae en lo guardado del giroscopio, no es su reloj: 30 ms antes de ahora) */
    long tu = tI[ult], t0 = tI[(ult - nI + 1 + N) % N];
    long tt = t >= t0 && t <= tu + 20_000_000L ? t : ahora - 30_000_000L;
    final float[] qi = new float[4]; if (!imuEn(tt, qi)) { sinGiro++; return; }
    /* los ejes: lo que giró ARCore desde la foto anterior contra lo que giró el giroscopio, con cada uno */
    if (tAnt != Long.MIN_VALUE && t - tAnt > 0 && t - tAnt < 200_000_000L) {
      conj(qArAnt, a); mul(a, qA, d);                 // dAR = qArAnt⁻¹ · qA
      double ang = angulo(d);
      if (ang > 0.012) {
        conj(qIAnt, a); mul(a, qi, b);                // dI = qIAnt⁻¹ · qi
        for (int k = 0; k < 4; k++) {
          conj(C[k], a); mul(a, b, e4); mul(e4, C[k], a);   // C⁻¹ · dI · C
          conj(d, e4); mul(a, e4, e4);
          double r = Math.min(2, angulo(e4) / ang);
          err[k] = nCal == 0 ? r : err[k] * 0.85 + r * 0.15;
        }
        nCal++;
        int m = 0; for (int k = 1; k < 4; k++) if (err[k] < err[m]) m = k;
        double s = 9; for (int k = 0; k < 4; k++) if (k != m) s = Math.min(s, err[k]);
        if (nCal >= 8 && err[m] < 0.35 && err[m] < 0.5 * s && m != c) { c = m; alineado = false; }
      }
    }
    System.arraycopy(qA, 0, qArAnt, 0, 4); System.arraycopy(qi, 0, qIAnt, 0, 4); tAnt = t;
    if (c < 0) return;
    /* el mundo del giroscopio al de ARCore: qA = W · qi · C, o sea W = qA · C⁻¹ · qi⁻¹; de a poco (menos girando) */
    conj(C[c], a); mul(qA, a, b); conj(qi, a); mul(b, a, d); normalizar(d, 0);
    if (!alineado) { System.arraycopy(d, 0, qW, 0, 4); alineado = true; return; }
    double wm = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    slerp(qW, d, GANA / (1 + wm / GANA_W), qW);
  }

  /* ------------------------------------------ lo que ve el juego: el giro y los ojos a ahora + adelanto (ns).
     out: qx, qy, qz, qw, x, y, z. false si todavía no se puede (sin fotos, sin giroscopio o sin los ejes) */
  synchronized boolean leer(long ahora, long adelanto, float[] out) {
    if (!hayF || c < 0 || !alineado || nI == 0) return false;
    long tObj = ahora + Math.max(0, Math.min(adelanto, 60_000_000L));
    int i = ult * 4; a[0] = qI[i]; a[1] = qI[i + 1]; a[2] = qI[i + 2]; a[3] = qI[i + 3];
    /* (adelantado con la velocidad del giróscopo, en los ejes del celu: q · exp(ω·dt)) */
    double dt = Math.max(0, Math.min(ADEL_MAX, (tObj - tI[ult]) / 1e9));
    if (Math.abs(tW - tI[ult]) < 50_000_000L && dt > 0) { expQ(w[0] * dt, w[1] * dt, w[2] * dt, b); mul(a, b, d); System.arraycopy(d, 0, a, 0, 4); }
    mul(qW, a, b); mul(b, C[c], d); normalizar(d, 0);
    out[0] = d[0]; out[1] = d[1]; out[2] = d[2]; out[3] = d[3];
    /* el lugar: los ojos de la última foto, adelantados todo lo que tarda (la foto llega ~45 ms tarde y se ve
       ~25 después; hasta 80 ms), y el resorte corto, que se come el ruido que eso agranda */
    double dl = ADEL_LUGAR * Math.min(TOPE_LUGAR, Math.max(0, (tObj - tF) / 1e9));
    float tx = eF[0], ty = eF[1], tz = eF[2];
    double vx = vE[0] * dl, vy = vE[1] * dl, vz = vE[2] * dl;
    if (vx * vx + vy * vy + vz * vz < 0.05 * 0.05) { tx += vx; ty += vy; tz += vz; }
    double dd = Math.sqrt((tx - pOut[0]) * (tx - pOut[0]) + (ty - pOut[1]) * (ty - pOut[1]) + (tz - pOut[2]) * (tz - pOut[2]));
    if (tOut == Long.MIN_VALUE || ahora - tOut > 200_000_000L || dd > 0.3) { pOut[0] = tx; pOut[1] = ty; pOut[2] = tz; }
    else { double k = 1 - Math.exp(-Math.max(0, ahora - tOut) / 1e9 / TAU_LUGAR); pOut[0] += (tx - pOut[0]) * k; pOut[1] += (ty - pOut[1]) * k; pOut[2] += (tz - pOut[2]) * k; }
    tOut = ahora;
    out[4] = pOut[0]; out[5] = pOut[1]; out[6] = pOut[2];
    return true;
  }

  /* el giroscopio en el instante t (entre dos muestras; después de la última, adelantado con ω) */
  boolean imuEn(long t, float[] q) {
    if (nI == 0) return false;
    int j = ult;
    for (int n = 0; n < nI; n++) {
      int k = (ult - n + N) % N;
      if (tI[k] <= t) { j = k; break; }
      if (n == nI - 1) return false;
    }
    int i = j * 4;
    if (j == ult) {
      q[0] = qI[i]; q[1] = qI[i + 1]; q[2] = qI[i + 2]; q[3] = qI[i + 3];
      double dt = (t - tI[j]) / 1e9;
      if (dt > 0 && Math.abs(tW - tI[j]) < 50_000_000L) { expQ(w[0] * dt, w[1] * dt, w[2] * dt, e4); mul(q, e4, a); System.arraycopy(a, 0, q, 0, 4); }
      return true;
    }
    int k = (j + 1) % N; double f = (double) (t - tI[j]) / Math.max(1, tI[k] - tI[j]);
    final float[] A = { qI[i], qI[i + 1], qI[i + 2], qI[i + 3] }, B = { qI[k * 4], qI[k * 4 + 1], qI[k * 4 + 2], qI[k * 4 + 3] };
    slerp(A, B, f, q);
    return true;
  }

  /* ------------------------------------------ cuaterniones (x, y, z, w) */
  static void mul(float[] p, float[] q, float[] o) {
    float x = p[3] * q[0] + p[0] * q[3] + p[1] * q[2] - p[2] * q[1];
    float y = p[3] * q[1] - p[0] * q[2] + p[1] * q[3] + p[2] * q[0];
    float z = p[3] * q[2] + p[0] * q[1] - p[1] * q[0] + p[2] * q[3];
    float ww = p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2];
    o[0] = x; o[1] = y; o[2] = z; o[3] = ww;
  }
  static void conj(float[] q, float[] o) { o[0] = -q[0]; o[1] = -q[1]; o[2] = -q[2]; o[3] = q[3]; }
  static void normalizar(float[] q, int i) { double l = Math.sqrt(q[i] * q[i] + q[i + 1] * q[i + 1] + q[i + 2] * q[i + 2] + q[i + 3] * q[i + 3]); if (l < 1e-9) { q[i] = q[i + 1] = q[i + 2] = 0; q[i + 3] = 1; return; } for (int k = 0; k < 4; k++) q[i + k] /= l; }
  static double angulo(float[] q) { return 2 * Math.acos(Math.min(1, Math.abs(q[3]))); }
  static void expQ(double x, double y, double z, float[] o) {
    double t = Math.sqrt(x * x + y * y + z * z);
    if (t < 1e-9) { o[0] = (float) (x / 2); o[1] = (float) (y / 2); o[2] = (float) (z / 2); o[3] = 1; normalizar(o, 0); return; }
    double s = Math.sin(t / 2) / t; o[0] = (float) (x * s); o[1] = (float) (y * s); o[2] = (float) (z * s); o[3] = (float) Math.cos(t / 2);
  }
  static void slerp(float[] p, float[] q, double f, float[] o) {
    double dot = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3], sg = 1;
    if (dot < 0) { dot = -dot; sg = -1; }
    double a0, a1;
    if (dot > 0.9995) { a0 = 1 - f; a1 = f * sg; }
    else { double th = Math.acos(dot), s = Math.sin(th); a0 = Math.sin((1 - f) * th) / s; a1 = Math.sin(f * th) / s * sg; }
    float x = (float) (a0 * p[0] + a1 * q[0]), y = (float) (a0 * p[1] + a1 * q[1]), z = (float) (a0 * p[2] + a1 * q[2]), ww = (float) (a0 * p[3] + a1 * q[3]);
    o[0] = x; o[1] = y; o[2] = z; o[3] = ww; normalizar(o, 0);
  }
  /* v' = q · v · q⁻¹ */
  static void rotar(float[] q, float vx, float vy, float vz, float[] o) {
    float x = q[0], y = q[1], z = q[2], ww = q[3];
    float ix = ww * vx + y * vz - z * vy, iy = ww * vy + z * vx - x * vz, iz = ww * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
    o[0] = ix * ww + iw * -x + iy * -z - iz * -y; o[1] = iy * ww + iw * -y + iz * -x - ix * -z; o[2] = iz * ww + iw * -z + ix * -y - iy * -x;
  }
}
