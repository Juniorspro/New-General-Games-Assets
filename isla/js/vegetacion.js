// Palmeras, arbustos y helechos. Todo instanciado: 150 palmeras son dos
// llamadas de dibujo (troncos y hojas), no trescientas. Talar una palmera es
// poner sus instancias en escala cero y soltar los ítems.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mulberry, rango } from './azar.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0);
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

function geoSegmento() {
  const g = new THREE.CylinderGeometry(0.2, 0.24, 0.62, 7, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.4, uv.getY(i) * 0.31);
  return g;
}

// Hoja de palmera a lo largo de +x (largo 1): sube, cae y se dobla en V.
export function geoHoja(caida = 0.75) {
  const L = 7, A = 3;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < L; i++) {
    const u = i / (L - 1);
    for (let j = 0; j < A; j++) {
      const w = (j / (A - 1) - 0.5);
      const y = 0.28 * u - caida * u * u - Math.abs(w) * 0.1;
      pos.push(u, y, w * 0.32);
      uv.push(u, j / (A - 1));
    }
  }
  for (let i = 0; i < L - 1; i++) for (let j = 0; j < A - 1; j++) {
    const a = i * A + j, b = a + 1, c = a + A, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normales hacia arriba: con las del plano cada hoja se prende o se apaga
  // según cómo quedó y la copa parece un montón de papelitos
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  return g;
}

function geoCruz(ancho, alto, planos = 3) {
  const partes = [];
  for (let i = 0; i < planos; i++) {
    const p = new THREE.PlaneGeometry(ancho, alto);
    p.translate(0, alto / 2, 0);
    p.rotateY((i / planos) * Math.PI);
    partes.push(p);
  }
  const pos = [], uv = [], nor = [], idx = [];
  let base = 0;
  for (const p of partes) {
    const P = p.attributes.position, U = p.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); uv.push(U.getX(i), U.getY(i)); nor.push(0, 1, 0);
    }
    const I = p.index.array;
    for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function profundidad(mapa) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mapa, alphaTest: 0.5, side: THREE.DoubleSide });
}

export class Vegetacion {
  constructor(tex, palmeras, arbustos, helechos) {
    this.grupo = new THREE.Group();
    this.palmeras = [];
    this.arbustos = [];
    const r = mulberry(5150);

    // ── palmeras ──
    let nSeg = 0, nHoja = 0, nCoco = 0;
    const planes = palmeras.map((p, id) => {
      const segs = 8 + Math.floor(r() * 5);
      const hojas = 8 + Math.floor(r() * 3);
      const cocos = r() < 0.6 ? 2 + Math.floor(r() * 3) : 0;
      const plan = { ...p, id, segs, hojas, cocos, s0: nSeg, h0: nHoja, c0: nCoco, ang: r() * Math.PI * 2, incl: 0.08 + r() * 0.22, curva: 0.012 + r() * 0.02, largo: rango(r, 2.5, 3.3) };
      nSeg += segs; nHoja += hojas; nCoco += cocos;
      return plan;
    });
    this.troncos = new THREE.InstancedMesh(geoSegmento(), matPixel('uv', { mapa: tex.corteza, tam: [16, 32], clave: 'corteza' }), nSeg);
    const matHoja = matPixel('uv', { mapa: tex.hojaPalmera, tam: [64, 20], alfa: 0.5, lados: THREE.DoubleSide, viento: 0.18, vientoUv: true, clave: 'hojaPalmera' });
    this.hojas = new THREE.InstancedMesh(geoHoja(), matHoja, nHoja);
    this.hojas.customDepthMaterial = profundidad(tex.hojaPalmera);
    this.cocos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 4), matPixel('liso', { color: 0x6b4423, clave: 'coco' }), Math.max(1, nCoco));
    for (const m of [this.troncos, this.hojas, this.cocos]) { m.castShadow = true; m.receiveShadow = true; this.grupo.add(m); }
    for (const p of planes) this.armarPalmera(p, r);
    this.palmeras = planes.map((p) => ({ ...p, vida: 5, viva: true, sacudida: 0 }));
    this.troncos.instanceMatrix.needsUpdate = this.hojas.instanceMatrix.needsUpdate = this.cocos.instanceMatrix.needsUpdate = true;
    for (const m of [this.troncos, this.hojas, this.cocos]) { m.computeBoundingSphere(); }

    // ── arbustos y helechos ──
    const matArb = matPixel('uv', { mapa: tex.hojasArbusto, tam: [32, 32], alfa: 0.5, lados: THREE.DoubleSide, viento: 0.07, altoViento: 1.1, clave: 'arbusto' });
    this.matasArb = new THREE.InstancedMesh(geoCruz(1.5, 1.15), matArb, Math.max(1, arbustos.length));
    this.matasArb.customDepthMaterial = profundidad(tex.hojasArbusto);
    const col = new THREE.Color();
    arbustos.forEach((a, i) => {
      const esc = rango(r, 0.7, 1.35);
      _m.compose(_p.set(a.x, a.y - 0.05, a.z), _q.setFromAxisAngle(ARRIBA, r() * 6.28), _s.set(esc, esc * rango(r, 0.8, 1.2), esc));
      this.matasArb.setMatrixAt(i, _m);
      this.matasArb.setColorAt(i, col.setRGB(0.92 + r() * 0.16, 0.95 + r() * 0.12, 0.88 + r() * 0.16));
      this.arbustos.push({ ...a, i, viva: true, esc });
    });
    this.matasArb.castShadow = true; this.matasArb.receiveShadow = true;
    this.grupo.add(this.matasArb);

    const matHel = matPixel('uv', { mapa: tex.hojaPalmera, tam: [64, 20], alfa: 0.5, lados: THREE.DoubleSide, viento: 0.12, vientoUv: true, clave: 'helecho' });
    const porHelecho = 6;
    this.helechos = new THREE.InstancedMesh(geoHoja(0.95), matHel, Math.max(1, helechos.length * porHelecho));
    this.helechos.customDepthMaterial = profundidad(tex.hojaPalmera);
    helechos.forEach((h, i) => {
      const L = rango(r, 0.9, 1.5);
      const giro0 = r() * 6.28;
      for (let k = 0; k < porHelecho; k++) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro0 + (k / porHelecho) * 6.28, 0.55 + r() * 0.35, 'YXZ'));
        _m.compose(_p.set(h.x, h.y, h.z), q, _s.set(L, L, L));
        this.helechos.setMatrixAt(i * porHelecho + k, _m);
        this.helechos.setColorAt(i * porHelecho + k, col.setRGB(0.85, 1.05, 0.8));
      }
    });
    this.helechos.castShadow = true; this.helechos.receiveShadow = true;
    this.grupo.add(this.helechos);
  }

  armarPalmera(p, r) {
    const dir = new THREE.Vector3(Math.cos(p.ang), 0, Math.sin(p.ang));
    let pos = new THREE.Vector3(p.x, p.y - 0.25, p.z);
    let tang = new THREE.Vector3(0, 1, 0).addScaledVector(dir, p.incl).normalize();
    for (let i = 0; i < p.segs; i++) {
      const u = i / p.segs;
      const esc = 1.12 - 0.4 * u;
      const centro = pos.clone().addScaledVector(tang, 0.31);
      _q.setFromUnitVectors(ARRIBA, tang);
      _m.compose(centro, _q, _s.set(esc, 1, esc));
      this.troncos.setMatrixAt(p.s0 + i, _m);
      pos.addScaledVector(tang, 0.6);
      tang.addScaledVector(dir, p.curva * (1 + u)).normalize();
    }
    p.copa = pos.clone();
    for (let k = 0; k < p.hojas; k++) {
      const a = (k / p.hojas) * Math.PI * 2 + r() * 0.3;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, rango(r, -0.25, 0.12), 'YXZ'));
      const L = p.largo * rango(r, 0.85, 1.1);
      _m.compose(pos, q, _s.set(L, L, L));
      this.hojas.setMatrixAt(p.h0 + k, _m);
    }
    for (let k = 0; k < p.cocos; k++) {
      const a = (k / Math.max(1, p.cocos)) * 6.28 + r();
      _m.compose(_p.set(pos.x + Math.cos(a) * 0.22, pos.y - 0.25, pos.z + Math.sin(a) * 0.22), _q.identity(), _s.set(1, 1, 1));
      this.cocos.setMatrixAt(p.c0 + k, _m);
    }
  }

  quitarPalmera(p) {
    p.viva = false;
    for (let i = 0; i < p.segs; i++) this.troncos.setMatrixAt(p.s0 + i, CERO);
    for (let i = 0; i < p.hojas; i++) this.hojas.setMatrixAt(p.h0 + i, CERO);
    for (let i = 0; i < p.cocos; i++) this.cocos.setMatrixAt(p.c0 + i, CERO);
    this.troncos.instanceMatrix.needsUpdate = this.hojas.instanceMatrix.needsUpdate = this.cocos.instanceMatrix.needsUpdate = true;
  }

  quitarArbusto(a) {
    a.viva = false;
    this.matasArb.setMatrixAt(a.i, CERO);
    this.matasArb.instanceMatrix.needsUpdate = true;
  }

  // La palmera más cercana a un rayo (para el hacha).
  palmeraEn(origen, dir, alcance = 3.2) {
    let mejor = null, dmin = alcance;
    for (const p of this.palmeras) {
      if (!p.viva) continue;
      const dx = p.x - origen.x, dz = p.z - origen.z;
      const t = dx * dir.x + dz * dir.z;
      if (t < 0 || t > alcance + 0.5) continue;
      const lat = Math.hypot(dx - dir.x * t, dz - dir.z * t);
      const y = origen.y + dir.y * t;
      if (lat < 0.55 && y > p.y - 0.3 && y < p.copa.y && t < dmin) { mejor = p; dmin = t; }
    }
    return mejor;
  }

  arbustoEn(punto, radio = 1.4) {
    let mejor = null, dmin = radio;
    for (const a of this.arbustos) {
      if (!a.viva) continue;
      const d = Math.hypot(a.x - punto.x, a.z - punto.z);
      if (d < dmin) { dmin = d; mejor = a; }
    }
    return mejor;
  }

  // Para el choque del jugador: troncos como cilindros.
  obstaculos(x, z, radio) {
    const res = [];
    for (const p of this.palmeras) {
      if (!p.viva) continue;
      if (Math.abs(p.x - x) < radio + 1 && Math.abs(p.z - z) < radio + 1) res.push({ x: p.x, z: p.z, r: 0.3, y0: p.y - 1, y1: p.y + 4 });
    }
    return res;
  }
}
