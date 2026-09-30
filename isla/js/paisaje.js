// Lo que se mueve alrededor para que la isla esté viva: gaviotas que planean
// en círculos sobre la playa, luciérnagas en el pasto de noche y peces que
// saltan en el mar de vez en cuando.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { modeloItem } from './items.js';

const _v = new THREE.Vector3();

const VERT_LUZ = /* glsl */ `
attribute float aFase;
uniform float uT;
uniform float uEscala;
varying float vBrillo;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vBrillo = pow(max(0.0, sin(uT * 2.3 + aFase)), 3.0);
  gl_PointSize = (0.10 + vBrillo * 0.09) * uEscala / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_LUZ = /* glsl */ `
uniform float uNoche;
varying float vBrillo;
void main() {
  vec2 q = floor(gl_PointCoord * 4.0) - 1.5;
  if (dot(q, q) > 4.5) discard;
  gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * (0.4 + vBrillo), (0.25 + vBrillo) * uNoche);
  #include <colorspace_fragment>
}`;

export class Paisaje {
  constructor(J) {
    this.J = J;
    // gaviotas: un cuerpito y dos alas que aletean
    const blanco = matPixel('liso', { color: 0xf4f6fa, texeles: 16, clave: 'gaviota' });
    const gris = matPixel('liso', { color: 0x9aa0ab, texeles: 16, clave: 'gaviotaAla' });
    this.gaviotas = [];
    const C = J.mundo.choza.grupo.position;
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.5), blanco));
      const alas = [];
      for (const s of [-1, 1]) {
        const a = new THREE.Group();
        a.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.22).translate(s * 0.35, 0, 0), gris));
        g.add(a); alas.push({ a, s });
      }
      J.escena.add(g);
      this.gaviotas.push({ g, alas, centro: C.clone().add(new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60)), r: 8 + Math.random() * 14, alto: 12 + Math.random() * 12, fase: Math.random() * 6.28, vel: 0.25 + Math.random() * 0.2 });
    }
    // luciérnagas: puntos que se prenden y se apagan
    const N = 60;
    this.posLuc = new Float32Array(N * 3);
    const fases = new Float32Array(N);
    for (let i = 0; i < N; i++) fases[i] = Math.random() * 30;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posLuc, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFase', new THREE.BufferAttribute(fases, 1));
    this.uniLuc = { uT: J.LUZ.uT, uEscala: { value: 400 }, uNoche: { value: 0 } };
    this.luciernagas = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.uniLuc, vertexShader: VERT_LUZ, fragmentShader: FRAG_LUZ, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.luciernagas.frustumCulled = false;
    J.escena.add(this.luciernagas);
    this.luc = Array.from({ length: N }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), t: 0 }));
    // peces que saltan
    this.salto = null;
    this.tSalto = 6;
  }

  // centro: el jugador, o la cámara en el menú (las gaviotas vuelan igual)
  actualizar(dt, altoPx, fov, centro = this.J.jugador.p) {
    const J = this.J, t = J.tiempo, pj = centro;
    const arriba = !J.bajo;
    for (const q of this.gaviotas) {
      q.g.visible = arriba && J.noche < 0.6;
      if (!q.g.visible) continue;
      q.fase += dt * q.vel;
      const x = q.centro.x + Math.cos(q.fase) * q.r, z = q.centro.z + Math.sin(q.fase) * q.r;
      q.g.position.set(x, q.alto + Math.sin(q.fase * 3) * 0.8, z);
      q.g.rotation.set(0, -q.fase, Math.sin(q.fase * 2) * 0.25);
      const aleteo = Math.sin(t * 7 + q.fase * 10);
      for (const { a, s } of q.alas) a.rotation.z = s * (aleteo > 0.3 ? aleteo * 0.6 : 0.1);
    }
    // luciérnagas: cerca del jugador, sobre el pasto, de noche
    this.uniLuc.uNoche.value = arriba ? Math.max(0, (J.noche - 0.5) * 2) : 0;
    this.uniLuc.uEscala.value = (altoPx * 0.5) / Math.tan(((fov * Math.PI) / 180) / 2);
    if (this.uniLuc.uNoche.value > 0) {
      const T = J.mundo.terreno;
      this.luc.forEach((l, i) => {
        l.t -= dt;
        if (l.t <= 0 || l.p.distanceTo(pj) > 26) {
          l.t = 4 + Math.random() * 6;
          const a = Math.random() * 6.28, d = 3 + Math.random() * 20;
          const x = pj.x + Math.cos(a) * d, z = pj.z + Math.sin(a) * d;
          const h = T.altura(x, z);
          l.p.set(x, h > 0.4 && T.pasto(x, z) > 0.4 ? h + 0.4 + Math.random() * 1.4 : -99, z);
          l.v.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.4);
        }
        l.p.addScaledVector(l.v, dt);
        l.v.x += Math.sin(t + i) * dt * 0.2; l.v.z += Math.cos(t * 0.8 + i) * dt * 0.2;
        this.posLuc[i * 3] = l.p.x; this.posLuc[i * 3 + 1] = l.p.y; this.posLuc[i * 3 + 2] = l.p.z;
      });
      this.luciernagas.geometry.attributes.position.needsUpdate = true;
    }
    // un pez salta en el mar, cerca pero no encima
    this.tSalto -= dt;
    if (!this.salto && this.tSalto <= 0 && arriba) {
      this.tSalto = 6 + Math.random() * 10;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * 6.28, d = 12 + Math.random() * 25;
        const x = pj.x + Math.cos(a) * d, z = pj.z + Math.sin(a) * d;
        if (J.mundo.terreno.altura(x, z) > -1.5) continue;
        const m = modeloItem(['atun', 'payaso', 'calamar'][Math.floor(Math.random() * 3)]);
        m.scale.setScalar(1.6);
        J.escena.add(m);
        const dir = Math.random() * 6.28;
        this.salto = { m, x, z, dir, t: 0 };
        J.part.rafaga(_v.set(x, 0.05, z), 10, [0xffffff, 0x9ff5ea], { vel: 1.5, arriba: 3, tam: 0.05 });
        break;
      }
    }
    if (this.salto) {
      const s = this.salto;
      s.t += dt;
      const u = s.t / 0.9;
      const px = s.x + Math.cos(s.dir) * u * 2.2, pz = s.z + Math.sin(s.dir) * u * 2.2;
      s.m.position.set(px, Math.sin(Math.PI * u) * 1.4 - 0.1, pz);
      s.m.rotation.set(0, -s.dir, (0.5 - u) * 2.2);
      if (u >= 1) {
        J.part.rafaga(_v.set(px, 0.05, pz), 12, [0xffffff, 0x9ff5ea, 0x6fe3dc], { vel: 1.8, arriba: 3, tam: 0.05 });
        if (s.m.position.distanceTo(pj) < 30) J.son.sfx('plop');
        J.escena.remove(s.m);
        this.salto = null;
      }
    }
  }
}
