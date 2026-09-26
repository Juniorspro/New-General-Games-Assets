// Estima el desfase de tiempo entre la cámara y la IMU.
//
// En un navegador la hora de cada cuadro y la de cada muestra de IMU vienen
// de caminos distintos, y entre las dos hay un corrimiento fijo desconocido
// (30-100 ms según el teléfono). XRSLAM lo toma como dato: con 30 ms de error
// su error se quintuplica. Esto lo mide solo.
//
// Cómo: el giro del teléfono se ve dos veces. El giróscopo lo mide directo
// (en su hora) y la imagen se corre con él (en la hora de la cámara): girar
// con velocidad w (marco de la cámara: x derecha, y abajo, z adelante) corre
// el centro de la imagen a f·(−w_y, w_x) píxeles por segundo. Se mide ese
// corrimiento cuadro a cuadro (Flujo, a 1/8 de resolución) y se busca el
// corrimiento de tiempo donde mejor coincide con el del giróscopo.
//
// OJO: no sirve comparar contra el giro que devuelve XRSLAM. Ese giro ya
// está fundido con el giróscopo y alineado a SUS horas (se probó: da ~0 ms
// con cualquier desfase real).

/** Corrimiento global de la imagen entre cuadros consecutivos, a baja resolución. */
export class Flujo {
  constructor(ancho, alto, { reduccion = 8, radio = 6 } = {}) {
    this.r = reduccion; this.rad = radio;
    this.w = Math.floor(ancho / reduccion); this.h = Math.floor(alto / reduccion);
    this.ancho = ancho;
    this.prev = null; this.tPrev = 0;
  }
  _chica(gris) {
    const { w, h, r, ancho } = this, o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0;
      for (let yy = 0; yy < r; yy++) { const f = (y * r + yy) * ancho + x * r; for (let xx = 0; xx < r; xx++) s += gris[f + xx]; }
      o[y * w + x] = s / (r * r);
    }
    return o;
  }
  /** Devuelve {t, v: [vx, vy]} en píxeles de la imagen COMPLETA por segundo, o null. */
  agregar(t, gris) {
    const img = this._chica(gris);
    let res = null;
    if (this.prev && t > this.tPrev) {
      const { w, h, rad } = this, a = this.prev, b = img;
      const sad = (dx, dy) => {
        let s = 0, n = 0;
        for (let y = rad; y < h - rad; y++) for (let x = rad; x < w - rad; x++) { s += Math.abs(b[(y + dy) * w + x + dx] - a[y * w + x]); n++; }
        return s / n;
      };
      let best = [0, 0], bv = Infinity;
      const tabla = new Map();
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const v = sad(dx, dy); tabla.set(dx + "," + dy, v);
        if (v < bv) { bv = v; best = [dx, dy]; }
      }
      // Subpíxel: parábola en cada eje alrededor del mínimo.
      const sub = (m, c, p) => { const d = m - 2 * c + p; return d > 0 ? 0.5 * (m - p) / d : 0; };
      const g = (dx, dy) => tabla.get(dx + "," + dy);
      let fx = best[0], fy = best[1];
      if (Math.abs(fx) < rad) fx += sub(g(fx - 1, best[1]), bv, g(fx + 1, best[1]));
      if (Math.abs(fy) < rad) fy += sub(g(best[0], fy - 1), bv, g(best[0], fy + 1));
      const dt = t - this.tPrev;
      // En el borde de la búsqueda el corrimiento real es mayor: no sirve.
      if (Math.abs(best[0]) < rad && Math.abs(best[1]) < rad)
        res = { t: (t + this.tPrev) / 2, v: [fx * this.r / dt, fy * this.r / dt] };
    }
    this.prev = img; this.tPrev = t;
    return res;
  }
}

/** El giróscopo (marco de la IMU) llevado a "cómo se correría la imagen":
 *  w_c = R_ci · w, y la imagen va a (−w_y, w_x) del marco de la cámara. */
export function giroComoFlujo(imus, qCamIMU) {
  // qCamIMU: rotación de la cámara en el marco de la IMU/cuerpo (q_bc de XRSLAM), [x, y, z, w].
  const qic = [-qCamIMU[0], -qCamIMU[1], -qCamIMU[2], qCamIMU[3]];
  return imus.map((m) => {
    const wc = rotar(qic, m.w);
    return { t: m.t, v: [-wc[1], wc[0]] };
  });
}

// Correlación normalizada de dos series de vectores, corriendo una contra la
// otra. vis: [{t, v}] (en la hora de la cámara); imu: [{t, v}] (en la de la
// IMU). Devuelve { desfase, calidad, escala }: desfase en s, lo que hay que
// SUMAR a la hora de cada cuadro para llevarla a la de la IMU; escala es la
// pendiente vis ≈ escala·imu en ese desfase (con giroComoFlujo, la focal en px).
export function estimarDesfase(vis, imus, { maxDesfase = 0.2, paso = 0.001 } = {}) {
  if (vis.length < 30 || imus.length < 30) return { desfase: 0, calidad: 0 };
  const it = imus.map((m) => m.t);
  // El giróscopo en una hora cualquiera (interpolado).
  const giro = (t) => {
    let lo = 0, hi = it.length - 1;
    if (t <= it[0] || t >= it[hi]) return null;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (it[m] <= t) lo = m; else hi = m; }
    const l = (t - it[lo]) / (it[hi] - it[lo]);
    return vis[0].v.map((_, k) => imus[lo].v[k] + l * (imus[hi].v[k] - imus[lo].v[k]));
  };
  // Correlación normalizada de los vectores, para cada corrimiento.
  let mejor = { desfase: 0, calidad: -Infinity };
  const curva = [];
  for (let d = -maxDesfase; d <= maxDesfase + 1e-9; d += paso) {
    let sxy = 0, sxx = 0, syy = 0, n = 0;
    for (const v of vis) {
      const g = giro(v.t + d);
      if (!g) continue;
      for (let k = 0; k < g.length; k++) { sxy += v.v[k] * g[k]; sxx += v.v[k] * v.v[k]; syy += g[k] * g[k]; }
      n++;
    }
    if (n < 20) continue;
    const c = sxy / Math.sqrt(sxx * syy);
    curva.push([d, c]);
    if (c > mejor.calidad) mejor = { desfase: d, calidad: c, escala: sxy / syy };
  }
  // Afinado subpaso: parábola por el máximo y sus vecinos.
  const i = curva.findIndex(([d]) => d === mejor.desfase);
  if (i > 0 && i < curva.length - 1) {
    const [y0, y1, y2] = [curva[i - 1][1], curva[i][1], curva[i + 1][1]];
    const den = y0 - 2 * y1 + y2;
    if (den < 0) mejor.desfase += paso * 0.5 * (y0 - y2) / den;
  }
  return mejor;
}

// ───────────────────── calibración completa ─────────────────────
// Lo mismo, pero sin suponer cómo está montada la cámara: para cada
// corrimiento de tiempo se busca la matriz B (2×3) que mejor lleva el giro
// del cuerpo (giróscopo, 3D) al corrimiento de la imagen (2D): v ≈ B·w.
// Como v = f·(−w_cy, w_cx) y w_c = R_cb·w, las filas de B son −f·(eje y de
// la cámara) y f·(eje x de la cámara), en el marco del cuerpo. De B salen la
// focal (el largo de las filas) y la rotación cámara-cuerpo entera.
//
// Así no importa si el navegador entrega la imagen girada, espejada o si la
// pantalla está para otro lado: se mide.
//
//   vis:  [{t, v: [vx, vy]}]   Flujo.agregar (hora de la cámara)
//   imus: [{t, w: [x, y, z]}]  giróscopo en rad/s (hora de la IMU)
//   devuelve { desfase, focal, qbc, r2, exX, exY, n, enderezada }
//     desfase:  s a SUMAR a la hora de cada cuadro
//     qbc:      rotación de la cámara en el cuerpo [x, y, z, w] (la de XRSLAM)
//     r2:       fracción del corrimiento que explica el giro (0-1)
//     exX, exY: cuánto se giró alrededor de cada eje de la cámara (rad/s, RMS)
//     enderezada: si qbc se ajustó al montaje "a escuadra" más cercano
//   qPrevio: el montaje supuesto (por el giro de la pantalla). Si sólo se giró
//     bien en un sentido, el eje que sí se midió tiene que coincidir con él.
export function calibrarCamaraIMU(vis, imus, { maxDesfase = 0.3, qPrevio = null, minGiro = 0.25 } = {}) {
  const nada = { desfase: 0, focal: 0, qbc: null, r2: 0, exX: 0, exY: 0, n: 0, enderezada: false };
  if (vis.length < 30 || imus.length < 30) return nada;
  const it = imus.map((m) => m.t);
  const giro = (t) => {
    let lo = 0, hi = it.length - 1;
    if (t <= it[0] || t >= it[hi]) return null;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (it[m] <= t) lo = m; else hi = m; }
    const l = (t - it[lo]) / (it[hi] - it[lo]), a = imus[lo].w, b = imus[hi].w;
    return [a[0] + l * (b[0] - a[0]), a[1] + l * (b[1] - a[1]), a[2] + l * (b[2] - a[2])];
  };
  const ajustar = (d) => {
    const Svg = [[0, 0, 0], [0, 0, 0]], Sgg = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let Svv = 0, n = 0;
    for (const x of vis) {
      const g = giro(x.t + d);
      if (!g) continue;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) Svg[i][j] += x.v[i] * g[j];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Sgg[i][j] += g[i] * g[j];
      Svv += x.v[0] * x.v[0] + x.v[1] * x.v[1]; n++;
    }
    if (n < 20) return null;
    const inv = inv3(Sgg);
    if (!inv) return null;
    const B = Svg.map((fila) => [0, 1, 2].map((j) => fila[0] * inv[0][j] + fila[1] * inv[1][j] + fila[2] * inv[2][j]));
    let expl = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) expl += B[i][j] * Svg[i][j];
    return { B, r2: expl / Svv, n, Sgg };
  };
  // Grueso cada 2 ms, fino cada 0,25 ms alrededor del mejor.
  let mejor = null, dMejor = 0;
  for (let d = -maxDesfase; d <= maxDesfase + 1e-9; d += 0.002) { const r = ajustar(d); if (r && (!mejor || r.r2 > mejor.r2)) { mejor = r; dMejor = d; } }
  if (!mejor) return nada;
  for (let d = dMejor - 0.003; d <= dMejor + 0.003 + 1e-9; d += 0.00025) { const r = ajustar(d); if (r && r.r2 > mejor.r2) { mejor = r; dMejor = d; } }
  const { B, r2, n, Sgg } = mejor;
  const fx = norma(B[1]), fy = norma(B[0]), focal = (fx + fy) / 2;
  // Ejes de la cámara en el cuerpo: x = B[1]/f, y = −B[0]/f; z = x × y.
  let ex = escalar(B[1], 1 / fx), ey = escalar(B[0], -1 / fy);
  let ez = normal(cruz(ex, ey)); ey = normal(cruz(ez, ex)); ex = normal(cruz(ey, ez));
  // Cuánto se giró alrededor de cada eje de la cámara (sin eso, esa fila de B es ruido).
  const exc = (e) => Math.sqrt(Math.max(0, e.reduce((s, _, i) => s + e[i] * (Sgg[i][0] * e[0] + Sgg[i][1] * e[1] + Sgg[i][2] * e[2]), 0) / n));
  // Las cámaras de los teléfonos van a escuadra con el cuerpo: si lo medido
  // queda a menos de 20° de un montaje a escuadra, se usa ése (exacto).
  let R = [[ex[0], ey[0], ez[0]], [ex[1], ey[1], ez[1]], [ex[2], ey[2], ez[2]]];   // columnas = ejes de la cámara
  let enderezada = false;
  const e = escuadraCercana(R);
  if (e.angulo < 20 * Math.PI / 180) { R = e.R; enderezada = true; }
  const exX = exc(ex), exY = exc(ey);
  const res = { desfase: dMejor, focal, qbc: null, r2, exX, exY, n, enderezada, anguloEscuadra: e.angulo, montaje: null, correlacion: 0, falta: null };
  // ¿Qué montaje se usa?
  //  - Girado bien en los dos sentidos y a escuadra: el MEDIDO (aunque no sea
  //    el supuesto: así se arregla un navegador que entrega la imagen girada).
  //  - Girado bien en un solo sentido: el supuesto, si el eje que sí se midió
  //    coincide con él (a menos de 25°).
  const ambos = exX >= minGiro && exY >= minGiro, alguno = Math.max(exX, exY) >= minGiro;
  if (ambos && enderezada) { res.qbc = quatDeMatriz(R); res.montaje = "medido"; }
  else if (alguno && qPrevio) {
    const Rp = matrizDeQuat(qPrevio);
    const col = (M, j) => [M[0][j], M[1][j], M[2][j]];
    // El eje medido con confianza: alrededor del que más se giró.
    const [medido, previo] = exY >= exX ? [ey, col(Rp, 1)] : [ex, col(Rp, 0)];
    const ang = Math.acos(Math.max(-1, Math.min(1, medido[0] * previo[0] + medido[1] * previo[1] + medido[2] * previo[2])));
    if (ang < 25 * Math.PI / 180) { res.qbc = qPrevio; res.montaje = "supuesto"; }
    else res.falta = "montaje";
  } else res.falta = alguno ? "montaje" : "giro";
  if (!res.qbc) return res;
  // Con el montaje fijo, la focal y el desfase se vuelven a medir con el
  // modelo de una sola incógnita (v = f·(−w_cy, w_cx)). El ajuste libre de 6
  // incógnitas da una focal ruidosa si se giró poco alrededor de un eje: en
  // EuRoC salía −8 %; así, +3 %.
  const d = estimarDesfase(vis, giroComoFlujo(imus, res.qbc), { maxDesfase });
  res.desfase = d.desfase; res.focal = d.escala; res.correlacion = d.calidad;
  return res;
}

function matrizDeQuat([x, y, z, w]) {
  return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
}

function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, Bc = -(d * i - f * g), C = d * h - e * g, det = a * A + b * Bc + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
          [Bc / det, (a * i - c * g) / det, -(a * f - c * d) / det],
          [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const norma = (v) => Math.hypot(v[0], v[1], v[2]);
const escalar = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const normal = (v) => escalar(v, 1 / norma(v));
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function escuadraCercana(R) {
  // Las 24 rotaciones "a escuadra": permutaciones de ejes con signos y det = +1.
  let mejor = null;
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) for (let sg = 0; sg < 8; sg++) {
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let c = 0; c < 3; c++) S[p[c]][c] = (sg >> c) & 1 ? -1 : 1;
    const det = S[0][0] * (S[1][1] * S[2][2] - S[1][2] * S[2][1]) - S[0][1] * (S[1][0] * S[2][2] - S[1][2] * S[2][0]) + S[0][2] * (S[1][0] * S[2][1] - S[1][1] * S[2][0]);
    if (det < 0) continue;
    let tr = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tr += S[i][j] * R[i][j];
    const ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
    if (!mejor || ang < mejor.angulo) mejor = { R: S, angulo: ang };
  }
  return mejor;
}
function quatDeMatriz(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
  return [x, y, z, w];
}

function mul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function rotar(q, v) {
  const r = mul(mul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [r[0], r[1], r[2]];
}
