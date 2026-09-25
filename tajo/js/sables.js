// Los dos sables y sus estelas.
//
// En el juego con casco el sable es la mano. Acá la mano es el dedo: la hoja
// sale de abajo de la pantalla (donde estaría la mano) y pasa JUSTO por donde
// está el dedo, un poco más allá. Así lo que se ve cortar es lo que el dedo
// dibujó.
//
// LA ESTELA ES LA SUPERFICIE QUE BARRE LA HOJA, no una línea detrás de la
// punta. Por eso sale ancha y curva como en el video: es el abanico que
// dibuja la hoja entera al girar. Se arma con las poses de los últimos
// ~110 ms, una por cada evento del dedo (no por cuadro): los eventos llegan a
// 120 o 240 por segundo y la curva sale lisa aunque el dibujo vaya a 30.

import * as THREE from "../vendor/three.module.min.js";
import { CAM } from "./camara.js";

const DURACION_ESTELA = 0.11;
const MAX_MUESTRAS = 96;

export const COLORES_SABLE = [
  { nucleo: new THREE.Color(3.2, 2.9, 2.2), halo: new THREE.Color(0.9, 0.7, 0.3), estela: new THREE.Color(1.3, 1.15, 0.85) },
  { nucleo: new THREE.Color(2.9, 1.6, 3.4), halo: new THREE.Color(0.8, 0.2, 1.05), estela: new THREE.Color(1.25, 0.45, 1.35) },
];

function matHalo(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uColor: { value: color.clone() }, uAncho: { value: 0.1 } },
    vertexShader: /* glsl */`
      uniform vec3 uA; uniform vec3 uB; uniform float uAncho;
      varying vec2 vUv;
      void main() {
        vec3 P = mix(uA, uB, position.y);
        vec3 dir = normalize(uB - uA);
        vec3 lado = normalize(cross(dir, normalize(cameraPosition - P)));
        P += lado * position.x * uAncho;
        vUv = position.xy;
        gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float u = vUv.x;
        float a = exp(-u * u * 7.0) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

function matEstela(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uFuerza: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec2 aT;
      varying vec2 vT;
      void main() { vT = aT; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uFuerza;
      varying vec2 vT;
      void main() {
        float largo = vT.x;          // 0 cerca de la mano, 1 en la punta
        float nuevo = vT.y;          // 1 recién pasada, 0 vieja
        float a = pow(nuevo, 2.2) * smoothstep(0.05, 0.45, largo) * (0.25 + 0.75 * largo) * 0.7;
        vec3 c = mix(uColor, vec3(2.2), pow(largo, 3.0) * nuevo * 0.5);
        gl_FragColor = vec4(c * a * uFuerza, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

class Sable {
  constructor(escena, lado) {
    this.lado = lado;
    const col = COLORES_SABLE[lado];
    this.grupo = new THREE.Group();
    // La empuñadura: mango, guarda y pomo.
    const metal = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.075, 0.09) });
    const brillo = new THREE.MeshBasicMaterial({ color: col.halo.clone().multiplyScalar(0.9) });
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.24, 10), metal);
    mango.position.y = -0.12;
    const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.028, 0.05), metal);
    guarda.position.y = 0.005;
    const joya = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), brillo);
    joya.position.set(0, 0.005, 0.03);
    const pomo = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), metal);
    pomo.position.y = -0.25;
    const hoja = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 1, 8), new THREE.MeshBasicMaterial({ color: col.nucleo }));
    hoja.position.y = 0.5;
    this.hoja = hoja;
    this.grupo.add(mango, guarda, joya, pomo, hoja);
    escena.add(this.grupo);

    const q = new THREE.PlaneGeometry(1, 1); q.translate(0, 0.5, 0);
    this.halo = new THREE.Mesh(q, matHalo(col.halo));
    this.halo.frustumCulled = false; this.halo.renderOrder = 6;
    escena.add(this.halo);

    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_MUESTRAS * 2 * 3);
    this.t = new Float32Array(MAX_MUESTRAS * 2 * 2);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aT", new THREE.BufferAttribute(this.t, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < MAX_MUESTRAS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.estela = new THREE.Mesh(g, matEstela(col.estela));
    this.estela.frustumCulled = false; this.estela.renderOrder = 7;
    escena.add(this.estela);

    this.muestras = [];          // {t, base, punta, fuerza}
    this.mano = new THREE.Vector3();
    this.punta = new THREE.Vector3();
    this.activo = false;
    this.vuelta = 1;             // 0..1 camino de vuelta al reposo
  }
}

export class Sables {
  constructor(escena, camara) {
    this.camara = camara;
    this.sables = [new Sable(escena, 0), new Sable(escena, 1)];
    this._r = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this.w = 1; this.h = 1;
    this.visibles = true;
  }

  medir(w, h) { this.w = w; this.h = h; }

  /** Punto del mundo que se ve en (sx, sy) a `dist` metros de la cámara. */
  punto(sx, sy, dist, fuera) {
    const c = this.camara;
    this._r.set((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, 0.5).unproject(c).sub(c.position).normalize();
    c.getWorldDirection(this._f);
    const k = dist / Math.max(0.2, this._r.dot(this._f));
    return fuera.copy(c.position).addScaledVector(this._r, k);
  }

  distanciaCorte() { return CAM.pos.z - CAM.zCorte; }

  /** La pose del sable cuando el dedo está en (sx, sy). */
  poseDedo(lado, sx, sy, mano, punta) {
    const reposoX = lado === 0 ? this.w * 0.2 : this.w * 0.8;
    const hx = reposoX + (sx - reposoX) * 0.24, hy = this.h * 1.02 + (sy - this.h * 1.02) * 0.16;
    this.punto(hx, hy, 1.5, mano);
    this.punto(sx, sy, this.distanciaCorte(), this._a);
    const d = this._a.sub(mano);
    const L = d.length() * 1.2;
    punta.copy(mano).addScaledVector(d.normalize(), L);
  }

  poseReposo(lado, mano, punta, t = 0) {
    const s = lado === 0 ? -1 : 1;
    const mece = Math.sin(t * 1.3 + lado * 2) * 0.012;
    this.punto(this.w * (0.5 + s * 0.34), this.h * 1.04, 1.5, mano);
    this.punto(this.w * (0.5 + s * (0.3 + mece)), this.h * (0.7 + mece), 2.6, punta);
  }

  /** Un evento del dedo: agrega una muestra a la estela. */
  mover(lado, sx, sy, t) {
    const s = this.sables[lado];
    if (!s.activo) { s.activo = true; s.muestras.length = 0; }   // la entrada no dibuja estela
    this.poseDedo(lado, sx, sy, s.mano, s.punta);
    this._muestra(s, t, 1);
    s.vuelta = 0;
  }

  soltar(lado) { const s = this.sables[lado]; s.activo = false; s.vuelta = 0; }

  _muestra(s, t, fuerza) {
    const base = s.mano.clone().lerp(s.punta, 0.18);
    s.muestras.push({ t, base, punta: s.punta.clone(), fuerza });
    if (s.muestras.length > MAX_MUESTRAS) s.muestras.shift();
  }

  actualizar(t, dt) {
    for (const s of this.sables) {
      if (!s.activo) {
        // De vuelta al reposo, suave; la estela de la vuelta casi no se ve.
        this.poseReposo(s.lado, this._a, this._b, t);
        if (s.vuelta < 1) {
          s.vuelta = Math.min(1, s.vuelta + dt * 5);
          const k = 1 - Math.pow(1 - s.vuelta, 3);
          s.mano.lerp(this._a, k); s.punta.lerp(this._b, k);
          this._muestra(s, t, 0.2);
        } else { s.mano.copy(this._a); s.punta.copy(this._b); }
      }
      // Pose de la malla: el eje Y del grupo apunta de la mano a la punta.
      const dir = this._f.subVectors(s.punta, s.mano);
      const L = dir.length();
      dir.normalize();
      s.grupo.position.copy(s.mano);
      s.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      s.hoja.scale.set(1, L, 1);
      s.hoja.position.y = L / 2;
      s.halo.material.uniforms.uA.value.copy(s.mano).addScaledVector(dir, 0.04);
      s.halo.material.uniforms.uB.value.copy(s.punta);
      s.halo.material.uniforms.uAncho.value = 0.03;
      s.grupo.visible = s.halo.visible = this.visibles;
      this._armarEstela(s, t);
    }
  }

  _armarEstela(s, t) {
    const m = s.muestras;
    while (m.length && t - m[0].t > DURACION_ESTELA) m.shift();
    const n = Math.min(m.length, MAX_MUESTRAS);
    if (n < 2 || !this.visibles) { s.estela.geometry.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      const q = m[m.length - n + i];
      const nuevo = Math.max(0, 1 - (t - q.t) / DURACION_ESTELA) * q.fuerza;
      const a = i * 2;
      s.pos[a * 3] = q.base.x; s.pos[a * 3 + 1] = q.base.y; s.pos[a * 3 + 2] = q.base.z;
      s.pos[a * 3 + 3] = q.punta.x; s.pos[a * 3 + 4] = q.punta.y; s.pos[a * 3 + 5] = q.punta.z;
      s.t[a * 2] = 0; s.t[a * 2 + 1] = nuevo;
      s.t[a * 2 + 2] = 1; s.t[a * 2 + 3] = nuevo;
    }
    const g = s.estela.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aT.needsUpdate = true;
    g.setDrawRange(0, (n - 1) * 6);
  }

  /** Para la portada: un sable que corta solo, sin dedo. */
  guiar(lado, sx, sy, t) { this.mover(lado, sx, sy, t); }
}
