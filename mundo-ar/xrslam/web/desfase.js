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
