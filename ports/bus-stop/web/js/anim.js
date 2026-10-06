/* Las animaciones "legacy" de Unity 4: curvas Hermite por componente (posición y rotación del
   objeto). Cada llave: [tiempo, valor…, pendiente de entrada…, pendiente de salida…]; una pendiente
   infinita (1e30) quiere decir escalón. wrap 2 = en bucle; 0 y 1 = una vez (queda en la última pose). */
function muestrear(k, dim, t, out) {
  const n = k.length;
  if (t <= k[0][0]) { for (let c = 0; c < dim; c++) out[c] = k[0][1 + c]; return out; }
  if (t >= k[n - 1][0]) { for (let c = 0; c < dim; c++) out[c] = k[n - 1][1 + c]; return out; }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m][0] <= t) lo = m; else hi = m; }
  const a = k[lo], b = k[hi], dt = b[0] - a[0], s = (t - a[0]) / dt, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let c = 0; c < dim; c++) {
    const sa = a[1 + 2 * dim + c], sb = b[1 + dim + c];
    if (Math.abs(sa) > 1e29 || Math.abs(sb) > 1e29) { out[c] = a[1 + c]; continue; }
    out[c] = h00 * a[1 + c] + h10 * sa * dt + h01 * b[1 + c] + h11 * sb * dt;
  }
  return out;
}

export class Animador {
  constructor(obj, clips) { this.obj = obj; this.clips = clips; this.actual = null; this.t = 0; this.tmp = [0, 0, 0, 0]; }
  play(nombre) { this.actual = this.clips[nombre] || null; this.t = 0; this.nombre = nombre; if (this.actual) this.aplicar(); }
  stop() { this.actual = null; }
  get andando() { return !!this.actual; }
  update(dt) {
    const c = this.actual;
    if (!c) return;
    this.t += dt;
    if (this.t >= c.largo) {
      if (c.wrap === 2) this.t %= c.largo || 1;
      else { this.t = c.largo; this.aplicar(); this.actual = null; return; }
    }
    this.aplicar();
  }
  aplicar() {
    for (const cv of this.actual.curvas) {
      if (cv.ruta) continue;
      if (cv.tipo === 'pos') { const v = muestrear(cv.k, 3, this.t, this.tmp); this.obj.position.set(v[0], v[1], v[2]); }
      else if (cv.tipo === 'rot') { const v = muestrear(cv.k, 4, this.t, this.tmp); this.obj.quaternion.set(v[0], v[1], v[2], v[3]).normalize(); }
    }
  }
}
