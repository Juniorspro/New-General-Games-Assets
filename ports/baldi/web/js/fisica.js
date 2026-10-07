/* Física a la medida de Baldi: colliders (caja, cápsula, esfera, malla), CharacterController que se
   desliza contra todo, Rigidbody (los cinemáticos siguen al nodo; los otros avanzan con su velocidad),
   rayos (Physics.Raycast: las mallas de una sola cara, como en Unity) y disparadores con
   OnTriggerEnter/Stay/Exit en el paso fijo. Una grilla en XZ reparte los colliders.
   Todo en el espacio de Unity. */
import * as THREE from 'three';
import { Componente, v3, Time } from './motor.js';
import { FABRICAS } from './mundo.js';

const CELDA = 8;
export const DEFAULT_RAYCAST = ~(1 << 2);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
let ID = 1;

/* ---------- geometría */
function puntoSegmento(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l = abx * abx + aby * aby + abz * abz;
  let t = l > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
}
function segSeg(p1, q1, p2, q2, c1, c2) {
  const d1 = _a.subVectors(q1, p1).clone(), d2 = _b.subVectors(q2, p2).clone(), r = _c.subVectors(p1, p2).clone();
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-9) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  c1.copy(p1).addScaledVector(d1, s); c2.copy(p2).addScaledVector(d2, t);
  return c1.distanceTo(c2);
}
// punto del triángulo más cercano a p (Ericson)
function puntoTriangulo(p, a, b, c, out) {
  const ab = _a.subVectors(b, a).clone(), ac = _b.subVectors(c, a).clone(), ap = _c.subVectors(p, a).clone();
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return out.copy(a);
  const bp = new THREE.Vector3().subVectors(p, b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return out.copy(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3));
  const cp = new THREE.Vector3().subVectors(p, c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return out.copy(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return out.copy(b).addScaledVector(new THREE.Vector3().subVectors(c, b), (d4 - d3) / (d4 - d3 + d5 - d6));
  const den = 1 / (va + vb + vc);
  return out.copy(a).addScaledVector(ab, vb * den).addScaledVector(ac, vc * den);
}
function puntoCaja(p, k, out) {
  const d = _a.subVectors(p, k.c);
  out.copy(k.c);
  for (let i = 0; i < 3; i++) { let x = d.dot(k.ejes[i]); x = Math.max(-k.h[i], Math.min(k.h[i], x)); out.addScaledVector(k.ejes[i], x); }
  return out;
}
// segmento contra forma convexa: puntos más cercanos por iteración (alcanza para cajas y triángulos)
function segForma(a, b, cerca, pa, pb) {
  puntoSegmento(cerca(a.clone().add(b).multiplyScalar(0.5), pb), a, b, pa);
  for (let i = 0; i < 4; i++) { cerca(pa, pb); puntoSegmento(pb, a, b, pa); }
  cerca(pa, pb);
  return pa.distanceTo(pb);
}

/* ---------- colliders */
export class Collider extends Componente {
  static get tipos() { return ['Collider']; }
  constructor(nodo, d) {
    super(nodo, d);
    this.id = ID++; this.isTrigger = !!d.trig; this.d = d; this._ver = -1; this.celdas = [];
    this.centro = d.c_ ? v3(d.c_[0], d.c_[1], -d.c_[2]) : v3();
  }
  get attachedRigidbody() { return this.cuerpo?.GetComponent('Rigidbody') || null; }
  get cuerpo() { // el nodo con Rigidbody o CharacterController que lo lleva
    if (this._cuerpo === undefined) { let n = this.nodo; this._cuerpo = null; while (n) { if (n.comps.some((c) => c.esDe('Rigidbody') || c.esDe('CharacterController'))) { this._cuerpo = n; break; } n = n.parent; } }
    return this._cuerpo;
  }
  get vivo() { return this._en && this.nodo._activoH && !this.nodo.destruido; }
  get forma() { if (this._ver !== this.nodo.ver) { this._ver = this.nodo.ver; this._f = this.calcular(this.nodo.matrizMundo); } return this._f; }
  get bounds() { const f = this.forma; return { min: v3(f.caja[0], f.caja[1], f.caja[2]), max: v3(f.caja[3], f.caja[4], f.caja[5]), center: v3((f.caja[0] + f.caja[3]) / 2, (f.caja[1] + f.caja[4]) / 2, (f.caja[2] + f.caja[5]) / 2) }; }
  _prender() { this.nodo.mundo.fisica?.alta(this); }
  _apagar() { this.nodo.mundo.fisica?.baja(this); }
}
function cajaDe(pts) { const k = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const p of pts) { k[0] = Math.min(k[0], p.x); k[1] = Math.min(k[1], p.y); k[2] = Math.min(k[2], p.z); k[3] = Math.max(k[3], p.x); k[4] = Math.max(k[4], p.y); k[5] = Math.max(k[5], p.z); } return k; }
function obb(M, centro, tam) {
  M.decompose(_c, _q, _s);
  const c = centro.clone().applyMatrix4(M);
  const ejes = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((e) => e.applyQuaternion(_q));
  const h = [Math.abs(tam.x * _s.x) / 2, Math.abs(tam.y * _s.y) / 2, Math.abs(tam.z * _s.z) / 2];
  const ext = [0, 1, 2].map((j) => Math.abs(ejes[0].getComponent(j)) * h[0] + Math.abs(ejes[1].getComponent(j)) * h[1] + Math.abs(ejes[2].getComponent(j)) * h[2]);
  return { tipo: 'caja', c, ejes, h, caja: [c.x - ext[0], c.y - ext[1], c.z - ext[2], c.x + ext[0], c.y + ext[1], c.z + ext[2]] };
}
function capsula(M, centro, radio, alto, dir) {
  M.decompose(_c, _q, _s);
  const s = [Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z)];
  const r = radio * Math.max(...s.filter((_, i) => i !== dir));
  const h = Math.max(0, alto * s[dir] / 2 - r);
  const c = centro.clone().applyMatrix4(M);
  const eje = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)][dir].applyQuaternion(_q);
  const a = c.clone().addScaledVector(eje, -h), b = c.clone().addScaledVector(eje, h);
  return { tipo: 'capsula', a, b, r, caja: [Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z) + r] };
}
export class BoxCollider extends Collider {
  static get tipos() { return ['BoxCollider', 'Collider']; }
  constructor(n, d) { super(n, d); this.size = d.tam ? v3(Math.abs(d.tam[0]), Math.abs(d.tam[1]), Math.abs(d.tam[2])) : v3(1, 1, 1); }
  calcular(M) { return obb(M, this.centro, this.size); }
}
export class SphereCollider extends Collider {
  static get tipos() { return ['SphereCollider', 'Collider']; }
  constructor(n, d) { super(n, d); this.radius = d.radio ?? 0.5; }
  calcular(M) { return capsula(M, this.centro, this.radius, 0, 1); }
}
export class CapsuleCollider extends Collider {
  static get tipos() { return ['CapsuleCollider', 'Collider']; }
  constructor(n, d) { super(n, d); this.radius = d.radio ?? 0.5; this.height = d.alto ?? 2; this.direction = d.dir ?? 1; }
  calcular(M) { return capsula(M, this.centro, this.radius, this.height, this.direction); }
}
export class MeshCollider extends Collider {
  static get tipos() { return ['MeshCollider', 'Collider']; }
  constructor(n, d, mundo) { super(n, d); this.convex = !!d.convexo; this.malla = mundo.recursos.mallaCol(d.malla); }
  calcular(M) {
    const m = this.malla;
    if (!m) return { tipo: 'nada', caja: [0, 0, 0, 0, 0, 0] };
    if (this.convex) { // convexa (los disparadores de las puertas): la caja de la malla, con algo de grosor
      const k = m.caja, tam = v3(Math.max(k[3] - k[0], 0.2), Math.max(k[4] - k[1], 0.2), Math.max(k[5] - k[2], 0.2));
      const f = obb(M, v3((k[0] + k[3]) / 2, (k[1] + k[4]) / 2, (k[2] + k[5]) / 2), tam);
      f.tris = this._tris(M); return f;
    }
    return { tipo: 'malla', tris: this._tris(M), caja: null, ...this._cajaTris() };
  }
  _tris(M) {
    const m = this.malla, P = m.pos, I = m.tri, n = I.length / 3, T = new Float32Array(n * 9);
    const espejo = M.determinant() < 0; // con escala negativa la cara de adelante se da vuelta (como en PhysX)
    const v = new THREE.Vector3();
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
      const i = I[t * 3 + (espejo && k ? 3 - k : k)];
      v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(M);
      T[t * 9 + k * 3] = v.x; T[t * 9 + k * 3 + 1] = v.y; T[t * 9 + k * 3 + 2] = v.z;
    }
    this._T = T;
    return T;
  }
  _cajaTris() { const T = this._T, k = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < T.length; i += 3) { k[0] = Math.min(k[0], T[i]); k[1] = Math.min(k[1], T[i + 1]); k[2] = Math.min(k[2], T[i + 2]); k[3] = Math.max(k[3], T[i]); k[4] = Math.max(k[4], T[i + 1]); k[5] = Math.max(k[5], T[i + 2]); } return { caja: k }; }
}
export class CharacterController extends Collider {
  static get tipos() { return ['CharacterController', 'Collider']; }
  constructor(n, d) {
    super(n, { on: 1 }); this.radius = d.radio; this.height = d.alto; this.centro = v3(d.centro[0], d.centro[1], -d.centro[2]);
    this.skinWidth = d.piel ?? 0.08; this.velocity = v3(); this.isGrounded = false;
  }
  calcular(M) { return capsula(M, this.centro, this.radius, this.height, 1); }
  Move(mov) {
    const F = this.nodo.mundo.fisica, n = this.nodo, antes = n.position;
    const largo = mov.length(), pasos = Math.max(1, Math.ceil(largo / Math.max(0.1, this.radius * 0.5)));
    let p = antes.clone();
    for (let i = 0; i < pasos; i++) { p.addScaledVector(mov, 1 / pasos); p = F.separar(this, p); }
    n.position = p;
    this.velocity = V3div(p.clone().sub(antes), Time.deltaTime);
    return 0;
  }
}
const V3div = (v, s) => (s > 0 ? v.multiplyScalar(1 / s) : v.set(0, 0, 0));

export class Rigidbody extends Componente {
  static get tipos() { return ['Rigidbody']; }
  constructor(n, d) { super(n, { on: 1 }); this.isKinematic = !!d.cinem; this.useGravity = !!d.grav; this.mass = d.masa ?? 1; this._vel = v3(); this._ult = null; }
  get velocity() { return this._vel.clone(); }
  set velocity(v) { this._vel.copy(v); }
}

/* ---------- el sistema */
export class Fisica {
  constructor(C) {
    this.matriz = C.fisica?.matriz || [];
    this.gatillosEnRayos = C.fisica?.gatillos !== false;
    this.grilla = new Map(); this.todos = new Set(); this.pares = new Map(); this.sello = 0;
  }
  choca(a, b) { const m = this.matriz[a]; return m === undefined ? true : ((m >>> b) & 1) === 1; }
  nuevoComp(c) { if (c instanceof Rigidbody) this.cuerpos = null; }
  antesDeEscena() { this.grilla.clear(); this.todos.clear(); this.pares.clear(); this.cuerpos = null; }
  alta(c) { this.todos.add(c); c._enGrilla = -1; this.cuerpos = null; }
  baja(c) { this.todos.delete(c); this._sacar(c); this.cuerpos = null; for (const [k, p] of this.pares) if (p.a === c || p.b === c) this.pares.delete(k); }
  _sacar(c) { for (const k of c.celdas) { const s = this.grilla.get(k); if (s) s.delete(c); } c.celdas = []; }
  _ubicar(c) {
    if (c._enGrilla === c.nodo.ver) return;
    c._enGrilla = c.nodo.ver;
    this._sacar(c);
    const k = c.forma.caja;
    const x0 = Math.floor(k[0] / CELDA), x1 = Math.floor(k[3] / CELDA), z0 = Math.floor(k[2] / CELDA), z1 = Math.floor(k[5] / CELDA);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) return;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = x * 100003 + z; let s = this.grilla.get(key); if (!s) this.grilla.set(key, (s = new Set())); s.add(c); c.celdas.push(key); }
  }
  actualizar() { for (const c of this.todos) this._ubicar(c); }
  cerca(caja, f) {
    this.sello++;
    const x0 = Math.floor(caja[0] / CELDA), x1 = Math.floor(caja[3] / CELDA), z0 = Math.floor(caja[2] / CELDA), z1 = Math.floor(caja[5] / CELDA);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const s = this.grilla.get(x * 100003 + z);
      if (s) for (const c of s) if (c._sello !== this.sello) { c._sello = this.sello; const k = c.forma.caja; if (k[0] <= caja[3] && k[3] >= caja[0] && k[1] <= caja[4] && k[4] >= caja[1] && k[2] <= caja[5] && k[5] >= caja[2]) f(c); }
    }
  }

  /* --- rayos */
  Raycast(origen, dir, max = Infinity, mascara = DEFAULT_RAYCAST, gatillos = null) {
    this.actualizar();
    const d = dir.clone(); if (d.lengthSq() < 1e-12) return null; d.normalize();
    const conGatillos = gatillos === null ? this.gatillosEnRayos : gatillos;
    let mejor = null, mejorT = max;
    const probar = (c) => {
      if (!c.vivo || (c.isTrigger && !conGatillos) || !((mascara >>> c.nodo.layer) & 1)) return;
      const r = this.rayoForma(c.forma, origen, d, mejorT);
      if (r && r.t < mejorT) { mejorT = r.t; mejor = { c, n: r.n }; }
    };
    // recorrido por la grilla (DDA en XZ), hasta un largo prudente
    const lim = Math.min(max, 2000);
    let x = Math.floor(origen.x / CELDA), z = Math.floor(origen.z / CELDA);
    const px = d.x > 0 ? 1 : -1, pz = d.z > 0 ? 1 : -1;
    const tdx = d.x !== 0 ? Math.abs(CELDA / d.x) : Infinity, tdz = d.z !== 0 ? Math.abs(CELDA / d.z) : Infinity;
    let tx = d.x !== 0 ? ((d.x > 0 ? (x + 1) * CELDA - origen.x : origen.x - x * CELDA) / Math.abs(d.x)) : Infinity;
    let tz = d.z !== 0 ? ((d.z > 0 ? (z + 1) * CELDA - origen.z : origen.z - z * CELDA) / Math.abs(d.z)) : Infinity;
    this.sello++;
    let t = 0;
    for (let i = 0; i < 2000 && t <= Math.min(lim, mejorT); i++) {
      const s = this.grilla.get(x * 100003 + z);
      if (s) for (const c of s) if (c._sello !== this.sello) { c._sello = this.sello; probar(c); }
      if (tx < tz) { t = tx; tx += tdx; x += px; } else { t = tz; tz += tdz; z += pz; }
    }
    if (!mejor) return null;
    const punto = origen.clone().addScaledVector(d, mejorT);
    const c = mejor.c;
    return { point: punto, distance: mejorT, normal: mejor.n, collider: c, transform: c.cuerpo && c.attachedRigidbody ? c.cuerpo : c.nodo };
  }
  rayoForma(f, o, d, max) {
    if (f.tipo === 'malla' || (f.tipo === 'caja' && f.tris && false)) return this.rayoTris(f.tris, o, d, max);
    if (f.tipo === 'caja') { // en el marco de la caja; desde adentro no pega
      const p = _a.subVectors(o, f.c);
      let t0 = -Infinity, t1 = Infinity, nEje = 0, nSigno = 1;
      for (let i = 0; i < 3; i++) {
        const e = f.ejes[i], po = p.dot(e), dd = d.dot(e), h = Math.max(f.h[i], 1e-4);
        if (Math.abs(dd) < 1e-9) { if (Math.abs(po) > h) return null; continue; }
        let a = (-h - po) / dd, b = (h - po) / dd, s = -1;
        if (a > b) { [a, b] = [b, a]; s = 1; }
        if (a > t0) { t0 = a; nEje = i; nSigno = s; }
        t1 = Math.min(t1, b);
        if (t0 > t1) return null;
      }
      if (t0 < 0 || t0 > max) return null;
      return { t: t0, n: f.ejes[nEje].clone().multiplyScalar(nSigno) };
    }
    if (f.tipo === 'capsula') {
      // distancia mínima rayo-segmento por bisección en la cápsula como unión de esferas
      if (_b.copy(o) && puntoSegmento(o, f.a, f.b, _c).distanceTo(o) <= f.r) return null;
      const ab = _a.subVectors(f.b, f.a), largo = ab.length();
      const pasos = Math.max(1, Math.ceil(largo / (f.r * 0.5)));
      let mejor = null;
      for (let i = 0; i <= pasos; i++) {
        const cc = f.a.clone().addScaledVector(ab, largo > 0 ? i / pasos : 0);
        const oc = o.clone().sub(cc), b = oc.dot(d), c = oc.lengthSq() - f.r * f.r, disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t >= 0 && t <= max && (!mejor || t < mejor.t)) mejor = { t, n: o.clone().addScaledVector(d, t).sub(cc).normalize() };
      }
      return mejor;
    }
    return null;
  }
  rayoTris(T, o, d, max) {
    let mejor = null;
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < T.length; i += 9) {
      e1.set(T[i + 3] - T[i], T[i + 4] - T[i + 1], T[i + 5] - T[i + 2]);
      e2.set(T[i + 6] - T[i], T[i + 7] - T[i + 1], T[i + 8] - T[i + 2]);
      n.crossVectors(e1, e2);
      if (n.dot(d) >= 0) continue; // de espaldas: Unity no la ve
      pv.crossVectors(d, e2);
      const det = e1.dot(pv);
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      tv.set(o.x - T[i], o.y - T[i + 1], o.z - T[i + 2]);
      const u = tv.dot(pv) * inv; if (u < 0 || u > 1) continue;
      qv.crossVectors(tv, e1);
      const v = d.dot(qv) * inv; if (v < 0 || u + v > 1) continue;
      const t = e2.dot(qv) * inv;
      if (t > 1e-5 && t <= max && (!mejor || t < mejor.t)) mejor = { t, n: n.clone().normalize() };
    }
    return mejor;
  }

  /* --- CharacterController: empuja la cápsula fuera de lo sólido (paredes de las dos caras) */
  separar(cc, p) {
    this.actualizar();
    const off = p.clone().sub(cc.nodo.position);
    const f0 = cc.forma, a = f0.a.clone().add(off), b = f0.b.clone().add(off), r = f0.r;
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let iter = 0; iter < 3; iter++) {
      let empuje = null;
      const caja = [Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z) + r];
      this.cerca(caja, (c) => {
        if (c === cc || !c.vivo || c.isTrigger || !this.choca(cc.nodo.layer, c.nodo.layer)) return;
        if (c.cuerpo && c.cuerpo === cc.nodo) return;
        const f = c.forma;
        const empujar = (dist, desde, hacia, normal) => {
          if (dist >= r) return;
          let dir = desde.clone().sub(hacia);
          if (dir.lengthSq() < 1e-10) dir = normal ? normal.clone() : v3(0, 1, 0);
          dir.normalize().multiplyScalar(r - dist + 1e-4);
          if (!empuje || dir.lengthSq() > empuje.lengthSq()) empuje = dir;
        };
        if (f.tipo === 'malla' || (f.tipo === 'caja' && f.tris && c.convex)) {
          const T = f.tris;
          for (let i = 0; i < T.length; i += 9) {
            A.set(T[i], T[i + 1], T[i + 2]); B.set(T[i + 3], T[i + 4], T[i + 5]); C.set(T[i + 6], T[i + 7], T[i + 8]);
            // descarte rápido por altura
            if (Math.max(A.y, B.y, C.y) < caja[1] || Math.min(A.y, B.y, C.y) > caja[4]) continue;
            const d = segForma(a, b, (q, out) => puntoTriangulo(q, A, B, C, out), pa, pb);
            if (d < r) { const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize(); empujar(d, pa, pb, nrm); }
          }
        } else if (f.tipo === 'caja') {
          const d = segForma(a, b, (q, out) => puntoCaja(q, f, out), pa, pb);
          empujar(d, pa, pb);
        } else if (f.tipo === 'capsula') {
          const d = segSeg(a, b, f.a, f.b, pa, pb);
          empujar(d - f.r + r, pa, pb);
        }
      });
      if (!empuje) break;
      p.add(empuje); a.add(empuje); b.add(empuje);
    }
    return p;
  }

  /* --- solapamiento entre formas (disparadores) */
  tocan(f, g) {
    if (f.tipo === 'nada' || g.tipo === 'nada') return false;
    if (f.tipo !== 'capsula' && g.tipo === 'capsula') return this.tocan(g, f);
    const pa = new THREE.Vector3(), pb = new THREE.Vector3();
    if (f.tipo === 'capsula') {
      if (g.tipo === 'capsula') return segSeg(f.a, f.b, g.a, g.b, pa, pb) <= f.r + g.r;
      if (g.tipo === 'caja') return segForma(f.a, f.b, (q, out) => puntoCaja(q, g, out), pa, pb) <= f.r;
      if (g.tipo === 'malla') {
        const T = g.tris, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
        for (let i = 0; i < T.length; i += 9) { A.set(T[i], T[i + 1], T[i + 2]); B.set(T[i + 3], T[i + 4], T[i + 5]); C.set(T[i + 6], T[i + 7], T[i + 8]); if (segForma(f.a, f.b, (q, out) => puntoTriangulo(q, A, B, C, out), pa, pb) <= f.r) return true; }
        return false;
      }
    }
    if (f.tipo === 'caja' && g.tipo === 'caja') { // separación por ejes (15)
      const ejes = [...f.ejes, ...g.ejes];
      for (const x of f.ejes) for (const y of g.ejes) { const c = new THREE.Vector3().crossVectors(x, y); if (c.lengthSq() > 1e-8) ejes.push(c.normalize()); }
      const t = new THREE.Vector3().subVectors(g.c, f.c);
      for (const e of ejes) {
        const ra = f.h[0] * Math.abs(f.ejes[0].dot(e)) + f.h[1] * Math.abs(f.ejes[1].dot(e)) + f.h[2] * Math.abs(f.ejes[2].dot(e));
        const rb = g.h[0] * Math.abs(g.ejes[0].dot(e)) + g.h[1] * Math.abs(g.ejes[1].dot(e)) + g.h[2] * Math.abs(g.ejes[2].dot(e));
        if (Math.abs(t.dot(e)) > ra + rb) return false;
      }
      return true;
    }
    return false;
  }

  /* --- paso fijo: los Rigidbody con velocidad avanzan, después los disparadores */
  pasoFijo(dt) {
    const mundo = this.mundo;
    for (const c of mundo.comps) {
      if (!(c instanceof Rigidbody) || !c.nodo._activoH) continue;
      if (!c.isKinematic) { if (c._vel.lengthSq() > 0) c.nodo.position = c.nodo.position.addScaledVector(c._vel, dt); }
      else { const p = c.nodo.position; if (c._ult) c._vel.copy(p).sub(c._ult).multiplyScalar(1 / dt); c._ult = p; }
    }
    this.actualizar();
    // cuerpos: colliders con Rigidbody o CharacterController
    const vistos = new Set(), ahora = new Map();
    for (const a of this.todos) {
      if (!a.cuerpo || !a.vivo) continue;
      this.cerca(a.forma.caja, (b) => {
        if (b === a || !b.vivo || (!a.isTrigger && !b.isTrigger)) return;
        if (b.cuerpo === a.cuerpo) return;
        if (!this.choca(a.nodo.layer, b.nodo.layer)) return;
        const clave = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
        if (vistos.has(clave)) return;
        vistos.add(clave);
        if (b.forma.tipo === 'malla' && !b.isTrigger && !a.isTrigger) return;
        if (this.tocan(a.forma, b.forma)) ahora.set(clave, a.id < b.id ? { a, b } : { a: b, b: a });
      });
    }
    const avisar = (metodo, p) => {
      const enviar = (x, otro) => { mundo.mensaje(x.nodo, metodo, otro); if (x.cuerpo && x.cuerpo !== x.nodo) mundo.mensaje(x.cuerpo, metodo, otro); };
      enviar(p.a, p.b); enviar(p.b, p.a);
    };
    for (const [k, p] of ahora) { if (!this.pares.has(k)) avisar('OnTriggerEnter', p); else avisar('OnTriggerStay', p); }
    for (const [k, p] of this.pares) if (!ahora.has(k) && p.a.vivo && p.b.vivo) avisar('OnTriggerExit', p);
    this.pares = ahora;
  }
}

/* ---------- fábricas */
FABRICAS.col = (n, lista, mundo) => lista.map((d) => {
  if (d.tipo === 'box') return new BoxCollider(n, d);
  if (d.tipo === 'sphere') return new SphereCollider(n, d);
  if (d.tipo === 'capsule') return new CapsuleCollider(n, d);
  if (d.tipo === 'mesh') return new MeshCollider(n, d, mundo);
  return null;
}).filter(Boolean);
FABRICAS.rb = (n, d) => [new Rigidbody(n, d)];
FABRICAS.cc = (n, d) => [new CharacterController(n, d)];
