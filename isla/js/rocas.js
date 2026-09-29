// Rocas facetadas: gris oscuro con las aristas claras, como en los videos.
// Las minables son un montón de pedazos: cada golpe de pico saca UNO ("que se
// vaya de a pedazos, no toda de una", le pidieron al autor, y así quedó).
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mulberry, rango, ruido2 } from './azar.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Un bloque facetado: icosaedro deformado, sin índices (caras planas) y con
// coordenadas baricéntricas para dibujar las aristas en el shader.
export function geoRoca(semilla, aplastar = 0.8, detalle = 1) {
  const base = new THREE.IcosahedronGeometry(1, detalle);
  const g = base.index ? base.toNonIndexed() : base;
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    // la deformación depende SOLO de la posición original: los vértices
    // repetidos de caras vecinas se mueven igual y la roca no se abre
    const k = 0.72 + 0.55 * ruido2(x * 1.9 + semilla * 3.1, z * 1.9 + y * 1.3, semilla | 0);
    let ny = y * k * aplastar;
    if (ny < -0.35) ny = -0.35 + (ny + 0.35) * 0.3;
    P.setXYZ(i, x * k, ny, z * k);
  }
  const bari = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) bari[i * 3 + (i % 3)] = 1;
  g.setAttribute('aBari', new THREE.BufferAttribute(bari, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Cristal: prismas hexagonales con punta, en racimo (para vetas y gemas).
export function geoCristales(semilla, n = 5) {
  const r = mulberry(semilla);
  const partes = [];
  for (let i = 0; i < n; i++) {
    const alto = rango(r, 0.35, 0.8), rad = rango(r, 0.07, 0.13);
    const c = new THREE.CylinderGeometry(rad * 0.75, rad, alto, 6, 1);
    const punta = new THREE.ConeGeometry(rad * 0.75, rad * 1.6, 6);
    punta.translate(0, alto / 2 + rad * 0.8, 0);
    const g = mergeSimple([c, punta]);
    g.translate(0, alto / 2, 0);
    g.rotateZ(rango(r, -0.6, 0.6));
    g.rotateX(rango(r, -0.5, 0.5));
    g.translate(rango(r, -0.12, 0.12), 0, rango(r, -0.12, 0.12));
    partes.push(g);
  }
  const g = mergeSimple(partes).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export function mergeSimple(geos) {
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (let g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i));
      uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx.push(I[i] + base); }
    else for (let i = 0; i < P.count; i++) idx.push(i + base);
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class Rocas {
  constructor(tex, decorativas, minables) {
    this.grupo = new THREE.Group();
    const r = mulberry(909);
    // casi negras con las aristas claras, como las del original
    const mat = matPixel('mundo', { mapa: tex.roca, tam: [32, 32], color: 0x6f737b, bari: true, borde: 2.3, clave: 'roca' });
    this.matRoca = mat;

    // decorativas: 4 formas instanciadas
    const formas = [0, 1, 2, 3].map((k) => geoRoca(k * 7 + 3, 0.75 + k * 0.05));
    const porForma = [[], [], [], []];
    decorativas.forEach((d) => porForma[Math.floor(r() * 4)].push(d));
    this.decor = [];
    formas.forEach((geo, k) => {
      const lista = porForma[k];
      if (!lista.length) return;
      const im = new THREE.InstancedMesh(geo, mat, lista.length);
      lista.forEach((d, i) => {
        _e.set(rango(r, -0.2, 0.2), r() * 6.28, rango(r, -0.2, 0.2));
        _m.compose(_p.set(d.x, d.y + d.r * 0.25, d.z), _q.setFromEuler(_e), _s.set(d.r, d.r * rango(r, 0.7, 1.1), d.r));
        im.setMatrixAt(i, _m);
        const t = rango(r, 0.85, 1.1);
        im.setColorAt(i, new THREE.Color(t, t, t * 1.03));
        this.decor.push({ x: d.x, z: d.z, y: d.y, r: d.r * 0.85 });
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      this.grupo.add(im);
    });

    // minables: pedazos instanciados (3 formas) + cristales de las vetas
    this.pedazosGeo = [0, 1, 2].map((k) => geoRoca(100 + k * 13, 0.85));
    const cuenta = [0, 0, 0];
    const planes = [];
    for (const m of minables) {
      const R = m.r;
      const trozos = [];
      const anillo = 4 + Math.floor(r() * 2);
      for (let i = 0; i < anillo; i++) {
        const a = (i / anillo) * 6.28 + r() * 0.5;
        trozos.push({ x: Math.cos(a) * R * 0.5, y: R * 0.32, z: Math.sin(a) * R * 0.5, s: R * rango(r, 0.52, 0.66) });
      }
      for (let i = 0; i < 2; i++) {
        const a = r() * 6.28;
        trozos.push({ x: Math.cos(a) * R * 0.25, y: R * 0.78, z: Math.sin(a) * R * 0.25, s: R * rango(r, 0.5, 0.6) });
      }
      trozos.push({ x: 0, y: R * 1.08, z: 0, s: R * 0.45 });
      for (const t of trozos) { t.forma = Math.floor(r() * 3); t.i = cuenta[t.forma]++; t.vivo = true; t.rot = [r() * 6.28, r() * 6.28, r() * 6.28]; }
      planes.push({ ...m, trozos });
    }
    this.pedazos = this.pedazosGeo.map((geo, k) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, cuenta[k]));
      im.castShadow = true; im.receiveShadow = true;
      this.grupo.add(im);
      return im;
    });
    let nCrist = 0;
    for (const p of planes) if (p.veta) nCrist += 3;
    this.cristales = new THREE.InstancedMesh(geoCristales(55, 4), matPixel('liso', { color: 0xffffff, brillo: 1.4, emisivo: 0x111111, clave: 'cristalVeta' }), Math.max(1, nCrist));
    this.cristales.castShadow = true;
    this.grupo.add(this.cristales);
    let ic = 0;
    this.minables = planes.map((p, id) => {
      const colorT = rango(r, 0.85, 1.08);
      for (const t of p.trozos) {
        _e.set(...t.rot);
        _m.compose(_p.set(p.x + t.x, p.y + t.y, p.z + t.z), _q.setFromEuler(_e), _s.set(t.s, t.s, t.s));
        this.pedazos[t.forma].setMatrixAt(t.i, _m);
        const oscuro = p.veta ? 0.72 : 1;
        this.pedazos[t.forma].setColorAt(t.i, new THREE.Color(colorT * oscuro, colorT * oscuro, colorT * oscuro * 1.04));
      }
      const cr = [];
      if (p.veta) {
        for (let k = 0; k < 3; k++) {
          const t = p.trozos[k];
          const a = Math.atan2(t.z, t.x);
          _e.set(Math.sin(a) * 0.7, r() * 6, -Math.cos(a) * 0.7);
          const e = p.r * 0.9;
          _m.compose(_p.set(p.x + t.x * 1.45, p.y + t.y + 0.1, p.z + t.z * 1.45), _q.setFromEuler(_e), _s.set(e, e, e));
          this.cristales.setMatrixAt(ic, _m);
          this.cristales.setColorAt(ic, new THREE.Color(p.colorVeta || 0xb46cff));
          cr.push(ic++);
        }
      }
      return { ...p, id, cristalesI: cr, vivo: true, sacudida: 0 };
    });
    for (const im of [...this.pedazos, this.cristales]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }

  // ── minar ────────────────────────────────────────────────────────────────
  rocaEn(origen, dir, alcance = 3.4) {
    let mejor = null, tmin = alcance;
    const c = new THREE.Vector3();
    for (const m of this.minables) {
      if (!m.vivo) continue;
      c.set(m.x, m.y + m.r * 0.6, m.z);
      const oc = c.clone().sub(origen);
      const t = oc.dot(dir);
      if (t < 0 || t > alcance + m.r) continue;
      const d2 = oc.lengthSq() - t * t;
      const R = m.r * 1.05;
      if (d2 > R * R) continue;
      const tt = t - Math.sqrt(R * R - d2);
      if (tt < tmin) { tmin = Math.max(0, tt); mejor = m; }
    }
    return mejor ? { roca: mejor, t: tmin } : null;
  }

  // Saca el pedazo más cercano al punto golpeado. Devuelve su posición (o null
  // si la roca ya no tiene pedazos) y si con eso se terminó la roca.
  sacarPedazo(m, punto) {
    let mejor = null, dmin = Infinity;
    for (const t of m.trozos) {
      if (!t.vivo) continue;
      // los de arriba primero si golpeás de arriba; si no, el más cercano
      const d = Math.hypot(m.x + t.x - punto.x, m.y + t.y - punto.y, m.z + t.z - punto.z) - t.y * 0.15;
      if (d < dmin) { dmin = d; mejor = t; }
    }
    if (!mejor) return null;
    mejor.vivo = false;
    this.pedazos[mejor.forma].setMatrixAt(mejor.i, CERO);
    this.pedazos[mejor.forma].instanceMatrix.needsUpdate = true;
    const restantes = m.trozos.filter((t) => t.vivo).length;
    if (m.veta && restantes <= m.trozos.length - 3 && m.cristalesI.length) {
      const ic = m.cristalesI.pop();
      this.cristales.setMatrixAt(ic, CERO);
      this.cristales.instanceMatrix.needsUpdate = true;
    }
    if (restantes === 0) {
      m.vivo = false;
      for (const ic of m.cristalesI) this.cristales.setMatrixAt(ic, CERO);
      this.cristales.instanceMatrix.needsUpdate = true;
    }
    return { pos: new THREE.Vector3(m.x + mejor.x, m.y + mejor.y, m.z + mejor.z), escala: mejor.s, forma: mejor.forma, fin: restantes === 0 };
  }

  // Restaura el estado guardado: cuántos pedazos le quedan a cada roca.
  aplicarEstado(estado) {
    if (!estado) return;
    for (const [id, quedan] of Object.entries(estado)) {
      const m = this.minables[+id];
      if (!m) continue;
      let sacar = m.trozos.length - quedan;
      while (sacar-- > 0) this.sacarPedazo(m, new THREE.Vector3(m.x, m.y + 99, m.z));
    }
  }

  estado() {
    const e = {};
    for (const m of this.minables) {
      const quedan = m.trozos.filter((t) => t.vivo).length;
      if (quedan !== m.trozos.length) e[m.id] = quedan;
    }
    return e;
  }

  obstaculos(x, z, radio) {
    const res = [];
    for (const d of this.decor) if (Math.abs(d.x - x) < radio + d.r + 1 && Math.abs(d.z - z) < radio + d.r + 1) res.push({ x: d.x, z: d.z, r: d.r, y0: d.y - 2, y1: d.y + d.r * 1.3 });
    for (const m of this.minables) {
      if (!m.vivo) continue;
      if (Math.abs(m.x - x) < radio + m.r + 1 && Math.abs(m.z - z) < radio + m.r + 1) {
        const quedan = m.trozos.filter((t) => t.vivo).length / m.trozos.length;
        res.push({ x: m.x, z: m.z, r: m.r * (0.45 + 0.4 * quedan), y0: m.y - 1, y1: m.y + m.r * 1.2 * quedan });
      }
    }
    return res;
  }
}
