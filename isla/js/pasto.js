// El pasto alto y denso de los videos: matas instanciadas por chunk de 32 m,
// que solo se dibujan cerca del jugador. Donde el mapa de materiales dice
// "pasto", hay matas; donde la guadaña o la pala lo sacaron, no.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { hash2 } from './azar.js';
import { MITAD, TAM } from './terreno.js';

const CH = 32, NCH = TAM / CH, PASO = 0.62;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0);

function geoMata() {
  const pos = [], uv = [], nor = [], idx = [];
  const planos = 3, ancho = 1.05, alto = 0.8;
  for (let k = 0; k < planos; k++) {
    const a = (k / planos) * Math.PI + 0.3;
    const cx = Math.cos(a) * ancho / 2, cz = Math.sin(a) * ancho / 2;
    const b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, alto, cz, -cx, alto, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export class Pasto {
  constructor(terreno, tex, densidad = 1) {
    this.terreno = terreno;
    this.densidad = densidad;
    this.geo = geoMata();
    this.mat = matPixel('uv', { mapa: tex.matasPasto, tam: [32, 32], alfa: 0.5, lados: THREE.DoubleSide, viento: 0.13, altoViento: 0.8, clave: 'pasto' });
    this.grupo = new THREE.Group();
    this.chunks = new Array(NCH * NCH).fill(null);
    this.sucios = new Set();
    this.radio = 52;
    this.bloqueos = null;   // función (x, z) → true si ahí no va pasto (bloques, casa)
  }

  construir(cx, cz) {
    const k = cz * NCH + cx;
    const viejo = this.chunks[k];
    if (viejo) { this.grupo.remove(viejo); viejo.dispose(); }
    const T = this.terreno;
    const pos = [];
    const x0 = cx * CH - MITAD, z0 = cz * CH - MITAD;
    const paso = PASO / Math.sqrt(this.densidad);
    for (let z = z0; z < z0 + CH; z += paso) for (let x = x0; x < x0 + CH; x += paso) {
      const hx = Math.floor(x * 10), hz = Math.floor(z * 10);
      const jx = x + (hash2(hx, hz, 1) - 0.5) * paso, jz = z + (hash2(hx, hz, 2) - 0.5) * paso;
      const pw = T.pasto(jx, jz), tw = T.tierra(jx, jz);
      if (pw < 0.55 + (hash2(hx, hz, 3) - 0.5) * 0.3 || tw > 0.4) continue;
      const y = T.altura(jx, jz);
      if (y < 0.35) continue;
      if (this.bloqueos && this.bloqueos(jx, jz)) continue;
      pos.push(jx, y, jz, hash2(hx, hz, 4), hash2(hx, hz, 5));
    }
    const n = pos.length / 5;
    if (!n) { this.chunks[k] = null; return; }
    const im = new THREE.InstancedMesh(this.geo, this.mat, n);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const h1 = pos[i * 5 + 3], h2 = pos[i * 5 + 4];
      const e = 0.75 + h1 * 0.6;
      _m.compose(_p.set(pos[i * 5], pos[i * 5 + 1] - 0.04, pos[i * 5 + 2]), _q.setFromAxisAngle(ARRIBA, h2 * 6.28), _s.set(e, e * (0.8 + h2 * 0.5), e));
      im.setMatrixAt(i, _m);
      col.setRGB(0.9 + h2 * 0.18, 0.95 + h1 * 0.1, 0.85 + h2 * 0.15);
      im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.receiveShadow = true;
    im.userData.chunk = k;
    this.chunks[k] = im;
    this.grupo.add(im);
  }

  // Marca los chunks que tocó un cambio (guadaña, pala, bloques).
  tocar(x, z, radio = 2) {
    for (let cz = Math.floor((z - radio + MITAD) / CH); cz <= Math.floor((z + radio + MITAD) / CH); cz++)
      for (let cx = Math.floor((x - radio + MITAD) / CH); cx <= Math.floor((x + radio + MITAD) / CH); cx++)
        if (cx >= 0 && cz >= 0 && cx < NCH && cz < NCH) this.sucios.add(cz * NCH + cx);
  }

  todo() {
    for (let cz = 0; cz < NCH; cz++) for (let cx = 0; cx < NCH; cx++) this.construir(cx, cz);
  }

  actualizar(centro) {
    // de a un chunk sucio por cuadro: cortar pasto no traba el juego
    if (this.sucios.size) {
      const k = this.sucios.values().next().value;
      this.sucios.delete(k);
      this.construir(k % NCH, Math.floor(k / NCH));
    }
    for (const im of this.chunks) {
      if (!im) continue;
      const k = im.userData.chunk;
      const cx = (k % NCH) * CH - MITAD + CH / 2, cz = Math.floor(k / NCH) * CH - MITAD + CH / 2;
      im.visible = Math.hypot(cx - centro.x, cz - centro.z) < this.radio + CH * 0.72;
    }
  }
}
