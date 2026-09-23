/* ============================================================================
   kuntur/js/papelitos.js — todo lo chiquito que vuela, hecho de papel:
   papel picado (confeti), bolitas de papel arrugado (el granizo), copos
   recortados, tiritas que se lleva el viento, plumas, chispitas, polvo y los
   copos de vapor de la locomotora. Cada tipo es una sola malla instanciada.
   Y el clima de cada capítulo, que los va soltando alrededor de la cámara.
   ========================================================================== */
import * as THREE from 'three';
import { granoPapel } from './papel.js';
import { pisoBajo } from './figuras.js';
import { rafagaEn } from './fisica.js';

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texDibujada(w, h, fn) {
  const [c, g] = lienzo(w, h); fn(g, w, h);
  const copia = lienzo(w, h)[0]; copia.getContext('2d').drawImage(c, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, w, h);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(copia, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX = {
  copo: () => texDibujada(64, 64, (g) => {
    g.translate(32, 32); g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillRect(-3, 0, 6, 28); g.fillRect(-9, 14, 18, 4); }
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
  }),
  pluma: () => texDibujada(32, 96, (g) => {
    g.fillStyle = '#2a2628'; g.beginPath(); g.moveTo(16, 2); g.quadraticCurveTo(30, 40, 18, 92); g.lineTo(14, 92); g.quadraticCurveTo(2, 40, 16, 2); g.fill();
    g.strokeStyle = '#8a8288'; g.lineWidth = 2; g.beginPath(); g.moveTo(16, 6); g.lineTo(16, 94); g.stroke();
  }),
  nube: () => texDibujada(128, 96, (g) => {
    g.fillStyle = '#ffffff';
    for (const [x, y, r] of [[40, 56, 28], [66, 44, 34], [92, 58, 26], [60, 66, 26]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  }),
};

/* cómo se mueve cada tipo */
const TIPOS = {
  confeti: { max: 700, geo: () => new THREE.PlaneGeometry(0.1, 0.14), grav: 7, aire: 1.6, flota: 2.2, gira: 9, vida: 3.2, rebota: 0.2, piso: true },
  bola: { max: 700, geo: () => new THREE.IcosahedronGeometry(0.045, 0), grav: 30, aire: 0.1, flota: 0, gira: 6, vida: 2.2, rebota: 0.45, piso: true, plano: false },
  copo: { max: 900, geo: () => new THREE.PlaneGeometry(0.16, 0.16), tex: 'copo', grav: 1.2, aire: 1.4, flota: 1.2, gira: 2, vida: 7, rebota: 0, piso: true },
  tira: { max: 260, geo: () => new THREE.PlaneGeometry(0.9, 0.05), grav: 0, aire: 0.4, flota: 0.9, gira: 4, vida: 1.8, rebota: 0, piso: false },
  pluma: { max: 60, geo: () => new THREE.PlaneGeometry(0.1, 0.3), tex: 'pluma', grav: 1.4, aire: 2.2, flota: 2.4, gira: 1.5, vida: 4.5, rebota: 0, piso: true },
  chispa: { max: 400, geo: () => new THREE.PlaneGeometry(0.07, 0.07), grav: -0.4, aire: 1.8, flota: 0.5, gira: 5, vida: 1.2, rebota: 0, piso: false, brilla: true },
  polvo: { max: 500, geo: () => new THREE.PlaneGeometry(0.09, 0.09), grav: -0.15, aire: 2.5, flota: 0.4, gira: 1, vida: 1.1, rebota: 0, piso: false, crece: 2.2 },
  vapor: { max: 90, geo: () => new THREE.PlaneGeometry(1.3, 1.0), tex: 'nube', grav: -1.2, aire: 0.6, flota: 0.3, gira: 0.3, vida: 2.6, rebota: 0, piso: false, crece: 2.4 },
};

export class Papelitos {
  constructor(padre, m) {
    this.m = m; this.g = new THREE.Group(); padre.add(this.g);
    this.T = {};
    for (const [n, d] of Object.entries(TIPOS)) {
      const mat = d.brilla
        ? new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.95, flatShading: d.plano === false, map: d.tex ? TEX[d.tex]() : null, alphaTest: d.tex ? 0.4 : 0 });
      const im = new THREE.InstancedMesh(d.geo(), mat, d.max);
      im.count = 0; im.frustumCulled = false; im.castShadow = n === 'bola' || n === 'confeti';
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.setColorAt(0, new THREE.Color(1, 1, 1));
      this.g.add(im);
      this.T[n] = { d, im, p: [] };
    }
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.E = new THREE.Euler(); this.S = new THREE.Vector3(); this.P = new THREE.Vector3(); this.C = new THREE.Color();
    this.viento = 0;
  }
  /* o: x, y, z, vx, vy, vz, abre (dispersión de velocidad), zona (dispersión de lugar), col (uno o lista), tam, vida */
  soltar(tipo, n, o) {
    const T = this.T[tipo]; if (!T) return;
    const cols = Array.isArray(o.col) ? o.col : [o.col || '#ffffff'];
    for (let i = 0; i < n; i++) {
      if (T.p.length >= T.d.max) T.p.shift();
      const a = o.abre == null ? 2 : o.abre, z = o.zona || 0;
      T.p.push({
        x: o.x + (Math.random() - 0.5) * z * 2, y: o.y + (Math.random() - 0.5) * (o.zonaY != null ? o.zonaY : z) * 2, z: (o.z || 0) + (Math.random() - 0.5) * (o.zonaZ != null ? o.zonaZ : z) * 2,
        vx: (o.vx || 0) + (Math.random() - 0.5) * a * 2, vy: (o.vy || 0) + (Math.random() - 0.5) * a * 2 + (o.sube || 0) * Math.random(), vz: (o.vz || 0) + (Math.random() - 0.5) * a,
        rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wr: (Math.random() - 0.5) * T.d.gira * 2,
        t: 0, vida: (o.vida || T.d.vida) * (0.7 + Math.random() * 0.6), tam: (o.tam || 1) * (0.7 + Math.random() * 0.6),
        col: new THREE.Color(cols[(Math.random() * cols.length) | 0]), fase: Math.random() * 6, quieto: 0,
      });
    }
  }
  pasar(dt, t) {
    const m = this.m;
    for (const n in this.T) {
      const { d, im, p } = this.T[n];
      let j = 0;
      for (let i = 0; i < p.length; i++) {
        const q = p[i];
        q.t += dt;
        if (q.t > q.vida) continue;
        if (q.quieto) { q.quieto += dt; }
        else {
          q.vy -= d.grav * dt;
          const fr = Math.exp(-d.aire * dt);
          q.vx = (q.vx - this.viento) * fr + this.viento; q.vy *= d.grav > 5 ? 1 : fr; q.vz *= fr;
          if (d.flota) { q.vx += Math.sin(t * 3 + q.fase) * d.flota * dt; q.vy += Math.cos(t * 2.3 + q.fase) * d.flota * 0.3 * dt; }
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          q.rx += q.wr * dt; q.ry += q.wr * 0.7 * dt; q.rz += q.wr * 0.4 * dt;
          if (d.piso && q.vy < 0 && m) {
            const piso = pisoBajo(m, q.x, q.y + 0.5);
            if (q.y < piso + 0.02 && q.y > piso - 0.6) {
              q.y = piso + 0.02;
              if (d.rebota && Math.abs(q.vy) > 1.5) { q.vy = -q.vy * d.rebota; q.vx *= 0.6; }
              else { q.vy = 0; q.vx *= 0.3; q.quieto = 0.001; q.rx = -Math.PI / 2; q.wr = 0; }
            }
          }
        }
        /* se achica al final (o crece, el polvo y el vapor) */
        const fin = Math.min(1, (q.vida - q.t) / 0.4);
        const k = d.crece ? q.tam * (1 + (q.t / q.vida) * d.crece) * Math.min(1, (q.vida - q.t) / (q.vida * 0.5)) : q.tam * fin;
        this.P.set(q.x, q.y, q.z); this.E.set(q.rx, q.ry, q.rz); this.S.setScalar(Math.max(0.0001, k));
        if (n === 'tira') this.E.set(Math.sin(t * 9 + q.fase) * 0.8, 0, Math.atan2(q.vy, q.vx) + Math.sin(t * 7 + q.fase) * 0.3);
        if (n === 'vapor' || n === 'polvo') this.E.set(0, 0, q.rz * 0.2);
        this.M.compose(this.P, this.Q.setFromEuler(this.E), this.S);
        im.setMatrixAt(j, this.M);
        im.setColorAt(j, q.col);
        p[j++] = q;
      }
      p.length = j;
      im.count = j;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
  limpiar() { for (const n in this.T) this.T[n].p.length = 0; }
}

/* colores de aguayo para el papel picado */
export const AGUAYO = ['#c0282e', '#f2b632', '#1f8f6c', '#e8702a', '#6a2f9a', '#f7f3ea', '#2a5aa8', '#e84a7a'];

/* ============================================================================
   EL CLIMA: lo suelta alrededor de lo que ve la cámara
   ========================================================================== */
export class Clima {
  constructor(pap, bio, m) {
    this.pap = pap; this.bio = bio; this.m = m; this.tipo = bio.clima; this.acum = 0; this.fuerza = 1;
  }
  pasar(dt, t, cam, ancho, alto) {
    const P = this.pap, m = this.m, x0 = cam.x - ancho * 0.7, x1 = cam.x + ancho * 0.7, arriba = cam.y + alto * 0.6;
    const soltar = (ritmo, fn) => { this.acum += ritmo * dt * this.fuerza; while (this.acum >= 1) { this.acum -= 1; fn(x0 + Math.random() * (x1 - x0)); } };
    P.viento = 0;
    switch (this.tipo) {
      case 'granizo':
        P.viento = -1.5;
        soltar(70, (x) => P.soltar('bola', 1, { x, y: arriba + Math.random() * 3, z: -2.5 + Math.random() * 4.5, vx: -1.5, vy: -16, abre: 0.6, col: ['#f4f6fb', '#e4e9f2', '#ffffff'] }));
        break;
      case 'polvo':
        soltar(5, (x) => P.soltar('polvo', 1, { x, y: cam.y + (Math.random() - 0.5) * alto, z: -1 + Math.random() * 2.5, vx: 0.4, vy: 0.05, abre: 0.2, col: ['#f2e2c4', '#e8cda4'], vida: 3.5, tam: 0.5 }));
        break;
      case 'viento': {
        let dir = 0;
        for (const v of m.vientos || []) if (cam.x > v.x0 - 12 && cam.x < v.x1 + 12 && rafagaEn(m, v)) dir = v.dir;
        P.viento = dir * 9;
        if (dir) {
          soltar(60, (x) => P.soltar('tira', 1, { x: dir > 0 ? x0 : x1, y: cam.y - alto * 0.4 + Math.random() * alto * 0.8, z: -2 + Math.random() * 4.5, vx: dir * (14 + Math.random() * 8), vy: 0.3, abre: 0.4, col: ['#ffffff', '#f2f4f8', '#e8ecf4'], vida: 2.2 }));
          soltar(50, (x) => P.soltar('polvo', 1, { x, y: m.p.y + Math.random() * 2, z: -1 + Math.random() * 2, vx: dir * 10, abre: 1, col: '#ffffff', vida: 1.2, tam: 0.35 }));
        } else soltar(4, (x) => P.soltar('polvo', 1, { x, y: cam.y + (Math.random() - 0.5) * alto, z: -1 + Math.random() * 2.5, vx: 0.2, abre: 0.2, col: '#ffffff', vida: 3, tam: 0.4 }));
        break;
      }
      case 'escarcha':
        soltar(9, (x) => P.soltar('chispa', 1, { x, y: cam.y + (Math.random() - 0.3) * alto, z: -2 + Math.random() * 4, vx: 0.1, vy: -0.2, abre: 0.1, col: ['#bcd4ff', '#ffffff', '#fff2c0'], vida: 3, tam: 0.6 }));
        break;
      case 'nieve': {
        const q = m.perseguidor, tormenta = q && q.tipo === 'tormenta' && q.activo;
        P.viento = tormenta ? 11 : 1.2;
        soltar(tormenta ? 220 : 35, (x) => P.soltar('copo', 1, { x: tormenta ? x - ancho * 0.4 : x, y: arriba - Math.random() * (tormenta ? alto : 2), z: -2.5 + Math.random() * 5.5, vx: P.viento, vy: -1.5, abre: 0.5, col: ['#ffffff', '#eef4ff'], tam: tormenta ? 1.1 : 0.8 }));
        if (tormenta) soltar(40, () => P.soltar('tira', 1, { x: x0, y: cam.y - alto * 0.4 + Math.random() * alto * 0.8, z: -2 + Math.random() * 4.5, vx: 20, vy: -1, abre: 0.5, col: ['#ffffff', '#e8f0fc'], vida: 1.8 }));
        break;
      }
    }
  }
}
