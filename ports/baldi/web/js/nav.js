/* NavMesh de Unity (los polígonos de Detour que exportó exportar.py), caminos con A* sobre los polígonos y
   el embudo para sacar las esquinas, y NavMeshAgent: velocidad, aceleración, giro, frenado, Warp,
   isStopped y la velocidad pisada desde un guion (la BSODA). Los NavMeshObstacle prendidos cortan los
   pasos que cruzan su caja (las puertas vaivén trabadas). Espacio de Unity. */
import * as THREE from 'three';
import { Componente, v3, Time, Quat, R2D } from './motor.js';
import { FABRICAS } from './mundo.js';
import { traer } from './archivos.js';

const CEL = 10;
export class NavMesh {
  constructor(buf) {
    const dv = new DataView(buf); let o = 0;
    this.polis = [];
    while (o < buf.byteLength) {
      const n = dv.getUint8(o); o += 1;
      const vs = [];
      for (let i = 0; i < n; i++) { vs.push(v3(dv.getFloat32(o, true), dv.getFloat32(o + 4, true), -dv.getFloat32(o + 8, true))); o += 12; }
      // en Unity el orden es al revés del de three (z dado vuelta): da igual para lo que sigue
      const c = vs.reduce((a, v) => a.add(v), v3()).multiplyScalar(1 / n);
      this.polis.push({ vs, c, vec: [], i: this.polis.length, caja: [Math.min(...vs.map((v) => v.x)), Math.min(...vs.map((v) => v.z)), Math.max(...vs.map((v) => v.x)), Math.max(...vs.map((v) => v.z))] });
    }
    // vecinos: aristas con los mismos dos vértices (redondeados)
    const k = (v) => `${Math.round(v.x * 20)},${Math.round(v.y * 4)},${Math.round(v.z * 20)}`;
    const aristas = new Map();
    for (const p of this.polis) p.vs.forEach((a, j) => {
      const b = p.vs[(j + 1) % p.vs.length], ka = k(a), kb = k(b), clave = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const otro = aristas.get(clave);
      if (otro) { p.vec.push({ p: otro.p, a, b }); otro.p.vec.push({ p, a: otro.a, b: otro.b }); } else aristas.set(clave, { p, a, b });
    });
    // aristas que no se juntan exacto (entre baldosas): se toleran solapes en la misma recta
    this.grilla = new Map();
    for (const p of this.polis) {
      for (let x = Math.floor(p.caja[0] / CEL); x <= Math.floor(p.caja[2] / CEL); x++) for (let z = Math.floor(p.caja[1] / CEL); z <= Math.floor(p.caja[3] / CEL); z++) {
        const key = x * 100003 + z; if (!this.grilla.has(key)) this.grilla.set(key, []); this.grilla.get(key).push(p);
      }
    }
    this.coserBordes();
  }
  coserBordes() {
    // aristas sueltas colineales y solapadas de polígonos distintos = portal (Detour parte las baldosas así)
    const sueltas = [];
    for (const p of this.polis) p.vs.forEach((a, j) => {
      const b = p.vs[(j + 1) % p.vs.length];
      if (!p.vec.some((e) => (e.a.equals(a) && e.b.equals(b)) || (e.a.equals(b) && e.b.equals(a)))) sueltas.push({ p, a, b });
    });
    const porCelda = new Map();
    for (const s of sueltas) { const key = Math.floor((s.a.x + s.b.x) / 2 / CEL) * 100003 + Math.floor((s.a.z + s.b.z) / 2 / CEL); if (!porCelda.has(key)) porCelda.set(key, []); porCelda.get(key).push(s); }
    for (const s of sueltas) {
      const cx = Math.floor((s.a.x + s.b.x) / 2 / CEL), cz = Math.floor((s.a.z + s.b.z) / 2 / CEL);
      for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (const t of porCelda.get(x * 100003 + z) || []) {
        if (t.p === s.p || s.p.vec.some((e) => e.p === t.p)) continue;
        const d = v3(s.b.x - s.a.x, 0, s.b.z - s.a.z), L = d.length(); if (L < 1e-3) continue; d.multiplyScalar(1 / L);
        const nrm = v3(-d.z, 0, d.x);
        if (Math.abs(nrm.dot(v3(t.a.x - s.a.x, 0, t.a.z - s.a.z))) > 0.05 || Math.abs(nrm.dot(v3(t.b.x - s.a.x, 0, t.b.z - s.a.z))) > 0.05) continue;
        if (Math.abs(t.a.y - s.a.y) > 1 || Math.abs(t.b.y - s.b.y) > 1.5) continue;
        const ta = d.dot(v3(t.a.x - s.a.x, 0, t.a.z - s.a.z)), tb = d.dot(v3(t.b.x - s.a.x, 0, t.b.z - s.a.z));
        const i0 = Math.max(0, Math.min(ta, tb)), i1 = Math.min(L, Math.max(ta, tb));
        if (i1 - i0 < 0.1) continue;
        const a = s.a.clone().lerp(s.b, i0 / L), b = s.a.clone().lerp(s.b, i1 / L);
        s.p.vec.push({ p: t.p, a, b });
      }
    }
  }
  dentro(p, x, z) {
    const vs = p.vs; let signo = 0;
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i], b = vs[(i + 1) % vs.length];
      const c = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
      if (Math.abs(c) < 1e-6) continue;
      const s = c > 0 ? 1 : -1;
      if (!signo) signo = s; else if (s !== signo) return false;
    }
    return true;
  }
  alturaEn(p, x, z) { // plano por los primeros tres vértices
    const [a, b, c] = p.vs;
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (Math.abs(n.y) < 1e-6) return p.c.y;
    return a.y - (n.x * (x - a.x) + n.z * (z - a.z)) / n.y;
  }
  polyEn(pos, alto = 3) {
    const lista = this.grilla.get(Math.floor(pos.x / CEL) * 100003 + Math.floor(pos.z / CEL)) || [];
    let mejor = null, mejorD = Infinity;
    for (const p of lista) if (pos.x >= p.caja[0] - 1e-3 && pos.x <= p.caja[2] + 1e-3 && pos.z >= p.caja[1] - 1e-3 && pos.z <= p.caja[3] + 1e-3 && this.dentro(p, pos.x, pos.z)) {
      const d = Math.abs(this.alturaEn(p, pos.x, pos.z) - pos.y);
      if (d < mejorD && d < alto) { mejor = p; mejorD = d; }
    }
    return mejor;
  }
  // el punto del navmesh más cercano (SamplePosition)
  cercano(pos, radio = 40) {
    const p0 = this.polyEn(pos, 6);
    if (p0) return { p: p0, pos: v3(pos.x, this.alturaEn(p0, pos.x, pos.z), pos.z) };
    let mejor = null, mejorD = Infinity;
    const r = Math.ceil(radio / CEL);
    const cx = Math.floor(pos.x / CEL), cz = Math.floor(pos.z / CEL), vistos = new Set();
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) for (const p of this.grilla.get(x * 100003 + z) || []) {
      if (vistos.has(p)) continue; vistos.add(p);
      p.vs.forEach((a, j) => {
        const b = p.vs[(j + 1) % p.vs.length];
        const ab = v3(b.x - a.x, b.y - a.y, b.z - a.z), l = ab.x * ab.x + ab.z * ab.z;
        let t = l > 0 ? ((pos.x - a.x) * ab.x + (pos.z - a.z) * ab.z) / l : 0; t = Math.max(0, Math.min(1, t));
        const q = a.clone().addScaledVector(ab, t);
        const d = (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2 + ((q.y - pos.y) * 0.5) ** 2;
        if (d < mejorD) { mejorD = d; mejor = { p, pos: q.lerp(p.c, 0.001) }; }
      });
    }
    return mejor;
  }
  bloqueado(a, b, obst) {
    for (const o of obst) if (o.cortaSegmento(a, b)) return true;
    return false;
  }
  camino(desde, hasta, obst = []) {
    const A = this.cercano(desde), B = this.cercano(hasta);
    if (!A || !B) return null;
    if (A.p === B.p) return { esquinas: [B.pos], fin: B.pos, parcial: false };
    // A* con el costo entre centros de portales
    const g = new Map([[A.p, 0]]), de = new Map(), abiertos = [[A.p, 0, A.pos]];
    const h = (p) => Math.hypot(p.c.x - B.pos.x, p.c.z - B.pos.z);
    let llegado = null, mejorParcial = A.p, mejorH = h(A.p);
    const cerrados = new Set();
    while (abiertos.length) {
      let mi = 0; for (let i = 1; i < abiertos.length; i++) if (abiertos[i][1] < abiertos[mi][1]) mi = i;
      const [p, , pp] = abiertos.splice(mi, 1)[0];
      if (cerrados.has(p)) continue; cerrados.add(p);
      if (p === B.p) { llegado = p; break; }
      if (h(p) < mejorH) { mejorH = h(p); mejorParcial = p; }
      for (const e of p.vec) {
        if (cerrados.has(e.p)) continue;
        if (obst.length && this.bloqueado(e.a, e.b, obst)) continue;
        const m = e.a.clone().add(e.b).multiplyScalar(0.5);
        const ng = g.get(p) + pp.distanceTo(m);
        if (ng < (g.get(e.p) ?? Infinity)) { g.set(e.p, ng); de.set(e.p, { p, e }); abiertos.push([e.p, ng + h(e.p), m]); }
      }
    }
    const fin = llegado || mejorParcial;
    const portales = [];
    for (let p = fin; p !== A.p;) { const x = de.get(p); portales.unshift(x.e); p = x.p; }
    const meta = llegado ? B.pos : fin.c.clone();
    return { esquinas: this.embudo(A.pos, meta, portales), fin: meta, parcial: !llegado };
  }
  // embudo simple (string pulling) en XZ
  embudo(ini, fin, portales) {
    const izq = [], der = [];
    let ant = ini;
    for (const e of portales) {
      // de qué lado queda cada punta mirando hacia adelante
      const m = e.a.clone().add(e.b).multiplyScalar(0.5), f = v3(m.x - ant.x, 0, m.z - ant.z);
      const cr = f.x * (e.a.z - ant.z) - f.z * (e.a.x - ant.x);
      // encoger un poco el portal para no rozar las paredes
      const a = e.a.clone(), b = e.b.clone(), d = b.clone().sub(a), L = d.length(), enc = Math.min(0.6, L * 0.3);
      if (L > 0) { a.addScaledVector(d, enc / L); b.addScaledVector(d, -enc / L); }
      if (cr > 0) { izq.push(a); der.push(b); } else { izq.push(b); der.push(a); }
      ant = m;
    }
    izq.push(fin.clone()); der.push(fin.clone());
    const tri2 = (a, b, c) => (c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x);
    izq.unshift(ini.clone()); der.unshift(ini.clone());
    const pts = [];
    let apex = ini.clone(), il = 0, ir = 0, pl = apex, pr = apex;
    for (let i = 1; i < izq.length; i++) {
      const L = izq[i], R = der[i];
      if (tri2(apex, pr, R) <= 0) {
        if (apex.equals(pr) || tri2(apex, pl, R) > 0) { pr = R; ir = i; }
        else { pts.push(pl.clone()); apex = pl.clone(); ir = il; pl = apex; pr = apex; i = il; continue; }
      }
      if (tri2(apex, pl, L) >= 0) {
        if (apex.equals(pl) || tri2(apex, pr, L) < 0) { pl = L; il = i; }
        else { pts.push(pr.clone()); apex = pr.clone(); il = ir; pl = apex; pr = apex; i = ir; continue; }
      }
    }
    pts.push(fin.clone());
    return pts;
  }
}

export class NavMeshObstacle extends Componente {
  static get tipos() { return ['NavMeshObstacle']; }
  constructor(n, d) { super(n, d); this.tam = v3(Math.abs(d.tam[0]), Math.abs(d.tam[1]), Math.abs(d.tam[2])); this.c = v3(d.c_[0], d.c_[1], -d.c_[2]); this.tallar = d.tallar; }
  _prender() { this.nodo.mundo.nav?.cambioObstaculos(); }
  _apagar() { this.nodo.mundo.nav?.cambioObstaculos(); }
  cortaSegmento(a, b) {
    const M = this.nodo.matrizMundo, inv = new THREE.Matrix4().copy(M).invert();
    const la = a.clone().applyMatrix4(inv).sub(this.c), lb = b.clone().applyMatrix4(inv).sub(this.c);
    const h = this.tam.clone().multiplyScalar(0.5);
    // segmento contra rectángulo en el plano XZ local
    let t0 = 0, t1 = 1;
    for (const k of ['x', 'z']) {
      const d = lb[k] - la[k];
      if (Math.abs(d) < 1e-9) { if (Math.abs(la[k]) > h[k]) return false; continue; }
      let u = (-h[k] - la[k]) / d, w = (h[k] - la[k]) / d; if (u > w) [u, w] = [w, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, w); if (t0 > t1) return false;
    }
    return true;
  }
}

export class NavMeshAgent extends Componente {
  static get tipos() { return ['NavMeshAgent']; }
  constructor(n, d) {
    super(n, d);
    this.speed = d.vel; this.acceleration = d.acel; this.angularSpeed = d.giro; this.radius = d.radio; this.height = d.alto;
    this.stoppingDistance = d.parar; this.baseOffset = d.base; this.autoBraking = d.frenar !== false;
    this.updateRotation = true; this.updatePosition = true; this.isStopped = false;
    this._vel = v3(); this._pisada = null; this.esquinas = []; this._dest = null; this.pos = null; this.parcial = false;
  }
  get velocity() { return this._vel.clone(); }
  set velocity(v) { this._pisada = v.clone(); this._vel.copy(v); }
  get destination() { return this._dest ? this._dest.clone() : this.nodo.position; }
  set destination(p) { this.SetDestination(p); }
  get steeringTarget() { return this.esquinas.length ? this.esquinas[0].clone() : this.nodo.position; }
  get hasPath() { return this.esquinas.length > 0; }
  get pathPending() { return false; }
  get remainingDistance() {
    if (!this.pos || !this.esquinas.length) return 0;
    let d = 0, a = this.pos; for (const c of this.esquinas) { d += Math.hypot(c.x - a.x, c.z - a.z); a = c; } return d;
  }
  get isOnNavMesh() { return !!this.pos; }
  _alto() { return this.baseOffset * Math.abs(this.nodo.lossyScale.y); }
  _sincronizar() { // del nodo al agente (por si un guion lo movió)
    const N = this.nodo.mundo.nav?.malla; if (!N) return;
    const p = this.nodo.position; p.y -= this._alto();
    if (!this.pos || this._ver !== this.nodo.ver) { const c = N.cercano(p); this.pos = c ? c.pos : p; }
  }
  _prender() { this._ver = -1; this._sincronizar(); this._ubicarNodo(); }
  SetDestination(p) {
    const N = this.nodo.mundo.nav?.malla; if (!N || !this.isActiveAndEnabled) return false;
    this._sincronizar();
    this._dest = p.clone();
    const r = N.camino(this.pos, p, this.nodo.mundo.nav.obstaculos());
    if (!r) { this.esquinas = []; return false; }
    this.esquinas = r.esquinas; this.parcial = r.parcial; this._dest = r.fin.clone();
    return true;
  }
  ResetPath() { this.esquinas = []; }
  Warp(p) {
    const N = this.nodo.mundo.nav?.malla; if (!N) return false;
    const c = N.cercano(p); this.pos = c ? c.pos : p.clone();
    this.esquinas = []; this._vel.set(0, 0, 0); this._ubicarNodo();
    return true;
  }
  _ubicarNodo() {
    if (!this.pos) return;
    const p = this.pos.clone(); p.y += this._alto();
    this.nodo.position = p; this._ver = this.nodo.ver;
  }
  mover(dt) {
    if (!this.isActiveAndEnabled || dt <= 0) return;
    this._sincronizar();
    const N = this.nodo.mundo.nav.malla;
    let deseada = v3();
    // saca las esquinas ya alcanzadas
    while (this.esquinas.length > 1 && Math.hypot(this.esquinas[0].x - this.pos.x, this.esquinas[0].z - this.pos.z) < 0.05) this.esquinas.shift();
    if (this.esquinas.length && !this.isStopped) {
      const obj = this.esquinas[0], d = v3(obj.x - this.pos.x, 0, obj.z - this.pos.z), dist = d.length();
      const resto = this.remainingDistance;
      if (this.esquinas.length === 1 && dist <= Math.max(this.stoppingDistance, 0.01)) { this.esquinas = []; }
      else if (dist > 1e-4) {
        let vel = this.speed;
        // frenado al final: v² = 2·a·d
        if (this.autoBraking && resto < 1e6) vel = Math.min(vel, Math.sqrt(2 * this.acceleration * Math.max(0, resto - this.stoppingDistance)));
        deseada = d.multiplyScalar(vel / dist);
      }
    }
    if (this._pisada) { this._vel.copy(this._pisada); this._pisada = null; }
    else {
      const dv = deseada.clone().sub(this._vel), max = this.acceleration * dt;
      if (dv.length() > max) dv.setLength(max);
      this._vel.add(dv);
      if (this.isStopped) this._vel.set(0, 0, 0);
    }
    if (this._vel.lengthSq() > 1e-10) {
      const paso = this._vel.clone().multiplyScalar(dt);
      let nueva = this.pos.clone().add(paso);
      // al llegar a una esquina se para en ella y sigue hacia la próxima
      if (this.esquinas.length && deseada.lengthSq() > 0) {
        const obj = this.esquinas[0], d = Math.hypot(obj.x - this.pos.x, obj.z - this.pos.z);
        if (paso.length() >= d) { nueva = obj.clone(); this.esquinas.shift(); }
      }
      const c = N.polyEn(nueva, 4) ? { pos: v3(nueva.x, N.alturaEn(N.polyEn(nueva, 4), nueva.x, nueva.z), nueva.z) } : N.cercano(nueva, 15);
      if (c) this.pos = c.pos;
      if (this.updateRotation && this.angularSpeed > 0) {
        const dir = deseada.lengthSq() > 0 ? deseada : this._vel;
        const meta = Math.atan2(dir.x, dir.z) * R2D, actual = this.nodo.eulerAngles.y;
        let dif = ((meta - actual) % 360 + 540) % 360 - 180;
        const max = this.angularSpeed * dt; if (Math.abs(dif) > max) dif = Math.sign(dif) * max;
        const e = this.nodo.eulerAngles; this.nodo.rotation = Quat.Euler(e.x, actual + dif, e.z);
      }
      this._ubicarNodo();
    }
  }
}

export class Nav {
  constructor(base) { this.base = base; this.malla = null; this.agentes = []; this._obst = null; }
  async alCargar(esc) {
    this.malla = esc.datos.nav ? new NavMesh(await traer(this.base + 'datos/' + esc.datos.nav, 'arrayBuffer')) : null;
    this._obst = null;
  }
  cambioObstaculos() {
    this._obst = null;
    // los agentes vuelven a buscar camino si el suyo ya no sirve
    for (const c of this.mundo.comps) if (c instanceof NavMeshAgent && c.isActiveAndEnabled && c._dest && c.esquinas.length) c.SetDestination(c._dest);
  }
  obstaculos() {
    if (!this._obst) this._obst = this.mundo.comps.filter((c) => c instanceof NavMeshObstacle && c.isActiveAndEnabled && c.tallar && c.tam.x * c.tam.z > 4);
    return this._obst;
  }
  trasUpdate(dt) { for (const c of this.mundo.comps) if (c instanceof NavMeshAgent) c.mover(dt); }
}

FABRICAS.agente = (n, d) => [new NavMeshAgent(n, d)];
FABRICAS.obstaculo = (n, d) => [new NavMeshObstacle(n, d)];
