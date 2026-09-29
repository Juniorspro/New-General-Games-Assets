// Partículas: cubitos (astillas, pedazos de piedra, chispas, salpicaduras) y
// destellos de cuatro puntas para las gemas. Depósitos fijos: nada se crea ni
// se tira mientras se juega.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';

const N_CUBOS = 700, N_DEST = 240;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

const VERT_D = /* glsl */ `
attribute float aTam;
attribute float aAlfa;
attribute vec3 aColor;
varying float vAlfa;
varying vec3 vColor;
uniform float uEscala;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aTam * uEscala / max(0.1, -mv.z);
  vAlfa = aAlfa; vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_D = /* glsl */ `
varying float vAlfa;
varying vec3 vColor;
void main() {
  // estrella de cuatro puntas en una grilla de 7×7: pixelada como todo
  vec2 q = floor(gl_PointCoord * 7.0) - 3.0;
  float cruz = (abs(q.x) < 0.5 && abs(q.y) < 3.5) || (abs(q.y) < 0.5 && abs(q.x) < 3.5) ? 1.0 : 0.0;
  float centro = (abs(q.x) < 1.5 && abs(q.y) < 1.5) ? 1.0 : 0.0;
  float a = max(cruz, centro * 0.9);
  if (a * vAlfa < 0.05) discard;
  gl_FragColor = vec4(vColor, a * vAlfa);
  #include <colorspace_fragment>
}`;

export class Particulas {
  constructor(escena) {
    this.cubos = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matPixel('liso', { color: 0xffffff, texeles: 64, clave: 'particula' }), N_CUBOS);
    this.cubos.frustumCulled = false;
    this.cubos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lista = [];
    for (let i = 0; i < N_CUBOS; i++) { this.cubos.setMatrixAt(i, CERO); this.cubos.setColorAt(i, new THREE.Color(1, 1, 1)); this.lista.push({ vida: 0 }); }
    this.proximo = 0;
    escena.add(this.cubos);

    const g = new THREE.BufferGeometry();
    this.dPos = new Float32Array(N_DEST * 3); this.dTam = new Float32Array(N_DEST); this.dAlfa = new Float32Array(N_DEST); this.dCol = new Float32Array(N_DEST * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.dPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.dTam, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlfa', new THREE.BufferAttribute(this.dAlfa, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.dCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.uEscala = { value: 400 };
    this.destellos = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uEscala: this.uEscala }, vertexShader: VERT_D, fragmentShader: FRAG_D, transparent: true, depthWrite: false }));
    this.destellos.frustumCulled = false;
    this.destellos.renderOrder = 5;
    this.dLista = [];
    for (let i = 0; i < N_DEST; i++) this.dLista.push({ vida: 0 });
    this.dProx = 0;
    escena.add(this.destellos);
  }

  // Una ráfaga de cubitos. color: número o arreglo de números (se elige al azar).
  rafaga(pos, n, color, op = {}) {
    const col = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const i = this.proximo; this.proximo = (this.proximo + 1) % N_CUBOS;
      const a = Math.random() * Math.PI * 2, v = (op.vel ?? 3) * (0.4 + Math.random() * 0.8);
      const p = this.lista[i];
      p.pos = (p.pos || new THREE.Vector3()).copy(pos).add(_p.set((Math.random() - 0.5) * (op.esparcir ?? 0.3), (Math.random() - 0.5) * (op.esparcir ?? 0.3), (Math.random() - 0.5) * (op.esparcir ?? 0.3)));
      p.vel = (p.vel || new THREE.Vector3()).set(Math.cos(a) * v, (op.arriba ?? 3) * (0.5 + Math.random()), Math.sin(a) * v);
      if (op.dir) p.vel.addScaledVector(op.dir, op.fuerzaDir ?? 2);
      p.vida = p.max = (op.vida ?? 0.9) * (0.6 + Math.random() * 0.8);
      p.tam = (op.tam ?? 0.07) * (0.6 + Math.random() * 0.8);
      p.g = op.g ?? 16;
      p.rot = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
      p.giro = (Math.random() - 0.5) * 12;
      const c = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
      this.cubos.setColorAt(i, col.set(c));
    }
    this.cubos.instanceColor.needsUpdate = true;
  }

  destello(pos, op = {}) {
    const i = this.dProx; this.dProx = (this.dProx + 1) % N_DEST;
    const d = this.dLista[i];
    d.vida = d.max = op.vida ?? 0.7;
    d.pos = (d.pos || new THREE.Vector3()).copy(pos);
    d.vel = (d.vel || new THREE.Vector3()).set(0, op.sube ?? 0.25, 0);
    d.tam = op.tam ?? 0.12;
    const c = new THREE.Color(op.color ?? 0xffffff);
    this.dCol[i * 3] = c.r; this.dCol[i * 3 + 1] = c.g; this.dCol[i * 3 + 2] = c.b;
  }

  actualizar(dt, suelo, altoPx, fov) {
    for (let i = 0; i < N_CUBOS; i++) {
      const p = this.lista[i];
      if (p.vida <= 0) continue;
      p.vida -= dt;
      if (p.vida <= 0) { this.cubos.setMatrixAt(i, CERO); continue; }
      p.vel.y -= p.g * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 1.2));
      p.pos.addScaledVector(p.vel, dt);
      const s = suelo(p.pos.x, p.pos.z);
      if (p.pos.y < s + p.tam / 2) { p.pos.y = s + p.tam / 2; p.vel.y *= -0.3; p.vel.x *= 0.6; p.vel.z *= 0.6; p.giro *= 0.5; }
      p.rot[0] += p.giro * dt; p.rot[1] += p.giro * dt * 0.7;
      const e = p.tam * Math.min(1, (p.vida / p.max) * 3);
      _m.compose(p.pos, _q.setFromEuler(_e.set(p.rot[0], p.rot[1], p.rot[2])), _s.set(e, e, e));
      this.cubos.setMatrixAt(i, _m);
    }
    this.cubos.instanceMatrix.needsUpdate = true;
    this.uEscala.value = altoPx * 0.5 / Math.tan((fov * Math.PI / 180) / 2);
    for (let i = 0; i < N_DEST; i++) {
      const d = this.dLista[i];
      if (d.vida <= 0) { this.dAlfa[i] = 0; continue; }
      d.vida -= dt;
      d.pos.addScaledVector(d.vel, dt);
      this.dPos[i * 3] = d.pos.x; this.dPos[i * 3 + 1] = d.pos.y; this.dPos[i * 3 + 2] = d.pos.z;
      const u = 1 - d.vida / d.max;
      this.dAlfa[i] = Math.sin(Math.PI * u);
      this.dTam[i] = d.tam * (0.6 + Math.sin(Math.PI * u) * 0.6);
    }
    const g = this.destellos.geometry;
    g.attributes.position.needsUpdate = g.attributes.aTam.needsUpdate = g.attributes.aAlfa.needsUpdate = g.attributes.aColor.needsUpdate = true;
  }
}
