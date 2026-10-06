/* El componente Animation (legacy) de Unity 3.5: curvas Hermite por hueso (posición, rotación,
   escala) y curvas de un valor (el alfa de un material, prender o apagar un renderer o un collider).
   Play corta; CrossFade mezcla durante "fundido" segundos. wrap 2 = en bucle; 0/1 = una vez (queda
   la última pose). Una pendiente de 1e30 es un escalón. */
import * as THREE from 'three';

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

const tmp = [0, 0, 0, 0], q1 = new THREE.Quaternion(), v1 = new THREE.Vector3();
export class Animador {
  /* raiz: el Object3D con el Animation; clips: nombre → clip; ganchos.flotante(obj, attr, clase, valor) */
  constructor(raiz, clips, ganchos = {}) { Object.assign(this, { raiz, clips, ganchos }); this.estados = []; this.rutas = new Map(); }
  buscar(ruta) {
    if (!ruta) return this.raiz;
    if (this.rutas.has(ruta)) return this.rutas.get(ruta);
    let o = this.raiz;
    for (const parte of ruta.split('/')) { o = o?.children.find((h) => h.name === parte); if (!o) break; }
    this.rutas.set(ruta, o || null);
    return o || null;
  }
  tiene(nombre) { return !!this.clips[nombre]; }
  play(nombre) { const c = this.clips[nombre]; if (!c) return false; this.estados = [{ c, nombre, t: 0, peso: 1 }]; this.aplicar(); return true; }
  crossFade(nombre, fundido = 0.3) {
    const c = this.clips[nombre];
    if (!c) return;
    const act = this.estados[this.estados.length - 1];
    if (act && act.nombre === nombre) return;
    for (const e of this.estados) e.sale = fundido;
    this.estados.push({ c, nombre, t: 0, peso: this.estados.length ? 0 : 1, entra: fundido });
  }
  stop(nombre) { this.estados = nombre ? this.estados.filter((e) => e.nombre !== nombre) : []; }
  get andando() { return this.estados.some((e) => !e.fin); }
  isPlaying(nombre) { return this.estados.some((e) => e.nombre === nombre && !e.fin); }
  update(dt) {
    if (!this.estados.length) return;
    for (const e of this.estados) {
      if (e.fin) continue;
      e.t += dt;
      if (e.t >= e.c.largo) { if (e.c.wrap === 2) e.t = e.c.largo ? e.t % e.c.largo : 0; else { e.t = e.c.largo; e.fin = true; } }
      if (e.entra) { e.peso = Math.min(1, e.peso + dt / e.entra); if (e.peso >= 1) e.entra = 0; }
      if (e.sale) { e.peso = Math.max(0, e.peso - dt / e.sale); }
    }
    this.estados = this.estados.filter((e) => !(e.sale && e.peso <= 0));
    this.aplicar();
    if (this.estados.length === 1 && this.estados[0].fin) this.estados[0].quieto = true;
  }
  aplicar() {
    let acum = 0;
    for (const e of this.estados) {
      const w = this.estados.length === 1 ? 1 : e.peso;
      if (w <= 0) continue;
      const f = acum <= 0 ? 1 : w / (acum + w); // mezcla en cadena
      acum += w;
      for (const cv of e.c.curvas) {
        if (!cv.k.length) continue;
        const o = this.buscar(cv.ruta);
        if (!o) continue;
        if (cv.tipo === 'pos') { const v = muestrear(cv.k, 3, e.t, tmp); if (f >= 1) o.position.set(v[0], v[1], v[2]); else o.position.lerp(v1.set(v[0], v[1], v[2]), f); }
        else if (cv.tipo === 'rot') { const v = muestrear(cv.k, 4, e.t, tmp); q1.set(v[0], v[1], v[2], v[3]).normalize(); if (f >= 1) o.quaternion.copy(q1); else o.quaternion.slerp(q1, f); }
        else if (cv.tipo === 'esc') { const v = muestrear(cv.k, 3, e.t, tmp); o.scale.set(v[0], v[1], v[2]); }
        else if (cv.tipo === 'float' && this.ganchos.flotante && !cv.attr.startsWith('m_LocalEulerAnglesHint')) {
          this.ganchos.flotante(o, cv.attr, cv.clase, muestrear(cv.k, 1, e.t, tmp)[0]);
        }
      }
    }
  }
}
