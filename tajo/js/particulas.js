// Chispas, el tajo de luz del corte y la explosión de las bombas.
//
// Una sola malla instanciada para todo: cada chispa es un cuadradito que el
// shader estira en la dirección en que viaja (visto desde la cámara). Una
// chispa redonda se ve como una pelotita; estirada se ve como una chispa.
//
// Usan Math.random a propósito: son sólo para ver (ver azar.js).

import * as THREE from "../vendor/three.module.min.js";

const MAX = 600;

export class Particulas {
  constructor(escena) {
    const g = new THREE.PlaneGeometry(1, 1);
    this.aPos = new Float32Array(MAX * 3);
    this.aVel = new Float32Array(MAX * 3);
    this.aCol = new Float32Array(MAX * 3);
    this.aVida = new Float32Array(MAX * 2);
    this.aTam = new Float32Array(MAX * 2);
    const ins = (arr, k) => new THREE.InstancedBufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aPos", ins(this.aPos, 3));
    g.setAttribute("aVel", ins(this.aVel, 3));
    g.setAttribute("aCol", ins(this.aCol, 3));
    g.setAttribute("aVida", ins(this.aVida, 2));
    g.setAttribute("aTam", ins(this.aTam, 2));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec3 aVel; attribute vec3 aCol; attribute vec2 aVida; attribute vec2 aTam;
        varying vec3 vCol; varying vec2 vUv; varying float vA;
        void main() {
          float k = clamp(aVida.x / max(aVida.y, 1e-3), 0.0, 1.0);
          vec4 pv = viewMatrix * vec4(aPos, 1.0);
          vec3 vv = mat3(viewMatrix) * aVel;
          vec2 eje = vv.xy; float l = length(eje);
          eje = l > 1e-4 ? eje / l : vec2(0.0, 1.0);
          vec2 perp = vec2(-eje.y, eje.x);
          float largo = aTam.x + l * aTam.y;
          pv.xy += eje * position.y * largo + perp * position.x * aTam.x;
          vCol = aCol; vUv = position.xy * 2.0;
          vA = (1.0 - k) * (1.0 - k);
          gl_Position = projectionMatrix * pv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol; varying vec2 vUv; varying float vA;
        void main() {
          float d = length(vUv * vec2(1.0, 0.85));
          float a = 1.0 - smoothstep(0.0, 1.0, d);
          gl_FragColor = vec4(vCol * a * a * vA, 1.0);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.malla = new THREE.InstancedMesh(g, mat, MAX);
    this.malla.count = 0;
    this.malla.frustumCulled = false;
    this.malla.renderOrder = 8;
    escena.add(this.malla);
    this.vivas = [];
    this._tmp = new THREE.Vector3();
  }

  _nueva(p, v, col, vida, ancho, estira, { quieta = false, gravedad = 1, frena = 0 } = {}) {
    if (this.vivas.length >= MAX) this.vivas.shift();
    this.vivas.push({ p: p.clone(), v: v.clone(), col, edad: 0, vida, ancho, estira, quieta, gravedad, frena });
  }

  /** Chispas al cortar: salen en la dirección del corte y se abren. */
  chispas(pos, dirCorte, color, cantidad = 26) {
    const blanco = new THREE.Color(3.2, 3.0, 2.8);
    for (let i = 0; i < cantidad; i++) {
      const v = dirCorte.clone().multiplyScalar(1.5 + Math.random() * 5);
      v.x += (Math.random() - 0.5) * 4.5; v.y += (Math.random() - 0.3) * 4.5; v.z += (Math.random() - 0.2) * 3;
      const c = Math.random() < 0.45 ? blanco : color.clone().multiplyScalar(2.6 + Math.random() * 2);
      this._nueva(pos, v, c, 0.25 + Math.random() * 0.4, 0.028 + Math.random() * 0.02, 0.035, { frena: 1.2 });
    }
  }

  /** El tajo: una raya de luz que cruza el bloque y se apaga enseguida. */
  tajo(pos, dirCorte, color) {
    const c = color.clone().multiplyScalar(2.2).add(new THREE.Color(2.4, 2.4, 2.4));
    this._nueva(pos, dirCorte.clone().normalize().multiplyScalar(20), c, 0.14, 0.07, 0.07, { quieta: true });
  }

  explosion(pos) {
    for (let i = 0; i < 90; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize()
        .multiplyScalar(2 + Math.random() * 8);
      const c = Math.random() < 0.4 ? new THREE.Color(4, 3.4, 2.4) : new THREE.Color(3.4, 1.1 + Math.random(), 0.25);
      this._nueva(pos, v, c, 0.3 + Math.random() * 0.6, 0.03 + Math.random() * 0.03, 0.03, { frena: 1.5 });
    }
  }

  actualizar(dt) {
    const l = this.vivas;
    let n = 0;
    for (let i = 0; i < l.length; i++) {
      const s = l[i];
      s.edad += dt;
      if (s.edad >= s.vida) continue;
      if (!s.quieta) {
        s.v.y -= 9.8 * s.gravedad * dt;
        if (s.frena) s.v.multiplyScalar(Math.max(0, 1 - s.frena * dt));
        s.p.addScaledVector(s.v, dt);
      }
      l[n++] = s;
    }
    l.length = n;
    for (let i = 0; i < n; i++) {
      const s = l[i];
      this.aPos[i * 3] = s.p.x; this.aPos[i * 3 + 1] = s.p.y; this.aPos[i * 3 + 2] = s.p.z;
      this.aVel[i * 3] = s.v.x; this.aVel[i * 3 + 1] = s.v.y; this.aVel[i * 3 + 2] = s.v.z;
      this.aCol[i * 3] = s.col.r; this.aCol[i * 3 + 1] = s.col.g; this.aCol[i * 3 + 2] = s.col.b;
      this.aVida[i * 2] = s.edad; this.aVida[i * 2 + 1] = s.vida;
      this.aTam[i * 2] = s.ancho; this.aTam[i * 2 + 1] = s.estira;
    }
    this.malla.count = n;
    const at = this.malla.geometry.attributes;
    at.aPos.needsUpdate = at.aVel.needsUpdate = at.aCol.needsUpdate = at.aVida.needsUpdate = at.aTam.needsUpdate = true;
  }

  vaciar() { this.vivas.length = 0; this.malla.count = 0; }
}
