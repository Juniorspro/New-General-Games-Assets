/* ============================================================================
   aeroplaza/js/objetos.js — las cosas vivas de los reinos: orbes para juntar,
   mariposas, cardúmenes que nadan en el aire, burbujas que suben (y las
   grandes, que se pueden manejar), frutas, discos de música, peceras y el
   globo de vidrio con la cascada.
   Cada clase tiene actualizar(dt, jugador) y avisa lo que el jugador tocó;
   main.js lo cuenta para las misiones y lo manda a la sala.
   ========================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar } from './mundo.js';
import { TEX, UNI, materialBurbuja, materialVidrio, brilloso } from './naturaleza.js';

const V = new THREE.Vector3(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3();

/* --------------------------------------------------------------------- orbes */
/* esferas de luz que flotan y giran; se juntan pasando cerca. Vuelven a los 90 s */
export class Orbes {
  constructor(grupo, lugares, { color = '#7ff6ff', valor = 1 } = {}) {
    this.lugares = lugares.map(([x, y, z]) => ({ p: new THREE.Vector3(x, y, z), fuera: 0 }));
    this.valor = valor;
    const g = new THREE.IcosahedronGeometry(0.26, 2);
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 1.6, roughness: 0.1, transparent: true, opacity: 0.92 });
    this.im = new THREE.InstancedMesh(g, m, this.lugares.length);
    const gh = new THREE.TorusGeometry(0.4, 0.025, 4, 24);
    this.aro = new THREE.InstancedMesh(gh, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }), this.lugares.length);
    this.im.frustumCulled = this.aro.frustumCulled = false;
    grupo.add(this.im, this.aro);
    this.t = Math.random() * 10;
    this.chispas = new Chispas(grupo, color);
  }
  ocultar(i, segundos = 90) { const L = this.lugares[i]; if (L) L.fuera = segundos; }
  /* devuelve la lista de orbes que tocó el jugador en este cuadro */
  actualizar(dt, jp) {
    this.t += dt; const tocados = [];
    this.lugares.forEach((L, i) => {
      if (L.fuera > 0) { L.fuera -= dt; M.makeScale(0, 0, 0); this.im.setMatrixAt(i, M); this.aro.setMatrixAt(i, M); return; }
      const y = L.p.y + Math.sin(this.t * 2 + i) * 0.15;
      const s = 1 + Math.sin(this.t * 5 + i * 2) * 0.06;
      M.compose(V.set(L.p.x, y, L.p.z), Q.setFromEuler(E.set(0, this.t + i, 0)), S.set(s, s, s)); this.im.setMatrixAt(i, M);
      M.compose(V, Q.setFromEuler(E.set(Math.PI / 2 + Math.sin(this.t + i) * 0.5, this.t * 1.5, 0)), S.set(1, 1, 1)); this.aro.setMatrixAt(i, M);
      if (jp && Math.abs(jp.x - L.p.x) < 1.1 && Math.abs(jp.z - L.p.z) < 1.1 && Math.abs(jp.y + 0.7 - y) < 1.4) { L.fuera = 90; tocados.push(i); this.chispas.soltar(V.set(L.p.x, y, L.p.z), 14); }
    });
    this.im.instanceMatrix.needsUpdate = true; this.aro.instanceMatrix.needsUpdate = true;
    this.chispas.actualizar(dt);
    return tocados;
  }
}

/* chispas: puntitos que saltan y se apagan (al juntar algo, al reventar) */
export class Chispas {
  constructor(grupo, color = '#ffffff', n = 120) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.vida = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: puntoSuave() }));
    this.pts.frustumCulled = false;
    grupo.add(this.pts);
  }
  soltar(pos, k = 10, vel = 3) {
    for (let j = 0; j < k; j++) {
      const i = this.i = (this.i + 1) % this.n;
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
      const a = Math.random() * 6.28, b = Math.random() * 2 - 0.3;
      this.v[i * 3] = Math.cos(a) * vel * Math.random(); this.v[i * 3 + 1] = (b + 1) * vel * 0.7; this.v[i * 3 + 2] = Math.sin(a) * vel * Math.random();
      this.vida[i] = 0.6 + Math.random() * 0.5;
    }
  }
  actualizar(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) { this.p[i * 3 + 1] = -999; continue; }
      this.vida[i] -= dt;
      this.v[i * 3 + 1] -= 6 * dt;
      for (let k = 0; k < 3; k++) this.p[i * 3 + k] += this.v[i * 3 + k] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
let _suave;
export function puntoSuave() {
  if (_suave) return _suave;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_suave = new THREE.CanvasTexture(c));
}

/* ----------------------------------------------------------------- mariposas */
function texMariposa() {
  if (TEX.mariposa) return TEX.mariposa;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (const s of [-1, 1]) {
    g.save(); g.translate(64, 64); g.scale(s, 1);
    const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, '#2a6cff'); gr.addColorStop(1, '#6ff2ff');
    g.fillStyle = gr; g.beginPath(); g.moveTo(2, -4); g.bezierCurveTo(30, -60, 70, -40, 56, -6); g.bezierCurveTo(50, 8, 20, 4, 2, 2); g.fill();
    g.beginPath(); g.moveTo(2, 4); g.bezierCurveTo(30, 10, 52, 30, 36, 46); g.bezierCurveTo(20, 50, 6, 30, 2, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(40, -24, 5, 0, 7); g.fill();
    g.restore();
  }
  g.fillStyle = '#1b2a44'; g.fillRect(61, 34, 6, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Mariposas {
  /* centros: [[x, y, z, radio]] donde revolotean */
  constructor(grupo, centros, n = 24, colores = ['#ffffff', '#ffd6f5', '#d7ffe8', '#fff6c2', '#d9e8ff']) {
    const g = new THREE.PlaneGeometry(0.46, 0.46, 2, 1).rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ map: texMariposa(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    m.onBeforeCompile = (s) => {
      s.uniforms.uT = UNI.uT;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { float fase = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
            float a = sin(uT * 16.0 + fase) * 1.0 + 0.2;
            float lado = sign(transformed.x); float d = abs(transformed.x);
            transformed.x = lado * d * cos(a); transformed.y = d * sin(a); }`);
    };
    this.im = new THREE.InstancedMesh(g, m, n);
    this.im.frustumCulled = false;
    const r = azar(17), c = new THREE.Color();
    this.b = [];
    for (let i = 0; i < n; i++) {
      const C = centros[i % centros.length];
      this.b.push({ c: C, a: r() * 6.28, v: 0.5 + r() * 0.6, h: r() * 6.28, fuera: 0, p: new THREE.Vector3() });
      this.im.setColorAt(i, c.set(colores[i % colores.length]));
    }
    grupo.add(this.im);
    this.t = 0;
  }
  actualizar(dt, jp) {
    this.t += dt; let atrapada = -1;
    this.b.forEach((b, i) => {
      if (b.fuera > 0) { b.fuera -= dt; M.makeScale(0, 0, 0); this.im.setMatrixAt(i, M); return; }
      b.a += dt * b.v * 0.6;
      const [cx, cy, cz, cr] = b.c;
      const x = cx + Math.cos(b.a) * cr * (0.6 + 0.4 * Math.sin(b.a * 2.3 + b.h)), z = cz + Math.sin(b.a * 1.3) * cr;
      const y = cy + 0.8 + Math.sin(this.t * 2.1 + b.h) * 0.5 + Math.sin(this.t * 7 + b.h) * 0.08;
      const dx = x - b.p.x, dz = z - b.p.z;
      b.p.set(x, y, z);
      /* la cabeza del dibujo queda hacia -z: se da vuelta para que vuele de frente */
      M.compose(b.p, Q.setFromEuler(E.set(0, Math.atan2(dx, dz) + Math.PI, 0)), S.set(1, 1, 1));
      this.im.setMatrixAt(i, M);
      if (jp && atrapada < 0 && b.p.distanceTo(V.set(jp.x, jp.y + 0.9, jp.z)) < 0.85) { atrapada = i; b.fuera = 40; }
    });
    this.im.instanceMatrix.needsUpdate = true;
    return atrapada;
  }
}

/* ------------------------------------------------------------ peces del aire */
export function pezGeo(largo = 0.5) {
  const cuerpo = new THREE.SphereGeometry(0.5, 14, 10); cuerpo.scale(largo, largo * 0.45, largo * 0.22);
  const cola = new THREE.ConeGeometry(largo * 0.28, largo * 0.4, 4, 1); cola.rotateZ(Math.PI / 2); cola.scale(1, 1, 0.25); cola.translate(-largo * 0.62, 0, 0);
  const aleta = new THREE.ConeGeometry(largo * 0.12, largo * 0.3, 4, 1); aleta.scale(1, 1, 0.2); aleta.translate(-largo * 0.05, largo * 0.25, 0);
  const g = mergeGeometries([cuerpo, cola, aleta].map((q) => { q.deleteAttribute('uv'); return q.index ? q.toNonIndexed() : q; }));
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / largo, y = p.getY(i) / largo;
    const franja = Math.abs(Math.sin(x * 9)) > 0.8 ? 1 : 0;
    const k = y < -0.05 ? 1 : 0.85;
    col[i * 3] = franja ? 1 : k; col[i * 3 + 1] = franja ? 1 : k; col[i * 3 + 2] = franja ? 1 : k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.rotateY(-Math.PI / 2);   // mirando a +z
  return g;
}
function materialPez() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uT = UNI.uT;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float fase = instanceMatrix[3].x * 2.0 + instanceMatrix[3].y * 3.0;
          float k = clamp(-transformed.z * 2.2, 0.0, 1.0);
          transformed.x += sin(uT * 9.0 + fase) * k * k * 0.12; }`);
  };
  return m;
}
export class Cardumen {
  /* un cardumen que nada en el aire alrededor de centro, siguiendo una ronda */
  constructor(grupo, centro, { n = 26, radio = 10, alto = 3, colores = ['#ff8a3d', '#ffd23f', '#3fd0ff', '#ff6fb0'], largo = 0.55, vel = 0.25 } = {}) {
    this.im = new THREE.InstancedMesh(pezGeo(largo), materialPez(), n);
    this.im.castShadow = true; this.im.frustumCulled = false;
    const r = azar(9), c = new THREE.Color();
    this.p = [];
    for (let i = 0; i < n; i++) { this.p.push({ o: new THREE.Vector3((r() - 0.5) * 3, (r() - 0.5) * 1.6, (r() - 0.5) * 3), f: r() * 6.28 }); this.im.setColorAt(i, c.set(colores[i % colores.length])); }
    this.c = centro; this.radio = radio; this.alto = alto; this.vel = vel; this.a = r() * 6.28; this.t = 0;
    grupo.add(this.im);
  }
  actualizar(dt) {
    this.t += dt; this.a += dt * this.vel;
    const cx = this.c.x + Math.cos(this.a) * this.radio, cz = this.c.z + Math.sin(this.a * 1.0) * this.radio, cy = this.c.y + Math.sin(this.a * 2) * this.alto * 0.3;
    const dirx = -Math.sin(this.a), dirz = Math.cos(this.a);
    const rumbo = Math.atan2(dirx, dirz);
    this.p.forEach((q, i) => {
      const w = Math.sin(this.t * 1.3 + q.f) * 0.4;
      M.compose(V.set(cx + q.o.x + w, cy + q.o.y + Math.sin(this.t * 2 + q.f) * 0.2, cz + q.o.z), Q.setFromEuler(E.set(0, rumbo + Math.sin(this.t + q.f) * 0.15, 0)), S.set(1, 1, 1));
      this.im.setMatrixAt(i, M);
    });
    this.im.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ burbujas */
/* las que suben desde fuentes (decoración y para reventar en la misión) */
export class Burbujas {
  constructor(grupo, fuentes, { n = 60, alto = 14, tam = [0.2, 0.7] } = {}) {
    this.fuentes = fuentes; this.alto = alto;
    this.im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), materialBurbuja(), n);
    this.im.frustumCulled = false; this.im.renderOrder = 3;
    const r = this.r = azar(33);
    this.b = [];
    for (let i = 0; i < n; i++) this.b.push(this.nueva(r, r() * alto, tam));
    this.tam = tam;
    grupo.add(this.im);
    this.chispas = new Chispas(grupo, '#e8fbff', 80);
  }
  nueva(r, y0 = 0, tam = this.tam) {
    const F = this.fuentes[Math.floor(r() * this.fuentes.length)];
    return { x: F[0] + (r() - 0.5) * F[3], y: F[1] + y0, z: F[2] + (r() - 0.5) * F[3], s: tam[0] + r() * (tam[1] - tam[0]), v: 0.6 + r() * 0.8, f: r() * 6.28, y0: F[1] };
  }
  actualizar(dt, jp) {
    let reventada = null;
    this.b.forEach((b, i) => {
      b.y += b.v * dt;
      if (b.y - b.y0 > this.alto) Object.assign(b, this.nueva(this.r));
      const x = b.x + Math.sin(b.y * 0.9 + b.f) * 0.4, z = b.z + Math.cos(b.y * 0.7 + b.f) * 0.4;
      const s = b.s * Math.min(1, (b.y - b.y0) * 2 + 0.1);
      if (jp && !reventada && b.s > 0.35 && Math.hypot(jp.x - x, jp.z - z) < b.s + 0.35 && jp.y + 0.2 < b.y + b.s && jp.y + 1.3 > b.y - b.s) {
        reventada = new THREE.Vector3(x, b.y, z); this.chispas.soltar(reventada, 12, 2.5); Object.assign(b, this.nueva(this.r));
      }
      M.compose(V.set(x, b.y, z), Q.identity(), S.set(s, s * (1 + Math.sin(b.y * 5) * 0.04), s)); this.im.setMatrixAt(i, M);
    });
    this.im.instanceMatrix.needsUpdate = true;
    this.chispas.actualizar(dt);
    return reventada;
  }
}

/* ------------------------------------------------------------------ medusas */
/* medusas de gelatina que flotan (están en casi todos los videos de Frutiger
   Aero): una campana con borde que brilla y rayitas, y tentáculos que ondean.
   Laten (la campana se achica y se agranda) y derivan despacio.
   lugares: [[x, y, z, escala, radio de la deriva]] */
function matMedusa(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: UNI.uT, uCol: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      uniform float uT; varying vec3 vN, vV; varying vec2 vUv; varying float vY;
      void main() {
        vec3 p = position; vUv = uv; vY = p.y;
        float f = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.23;
        /* los tentáculos (y < 0) ondean más cuanto más abajo */
        float k = max(0.0, -p.y);
        p.x += sin(uT * 2.1 + p.y * 3.0 + f) * 0.09 * k; p.z += cos(uT * 1.7 + p.y * 2.6 + f) * 0.09 * k;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying vec3 vN, vV; varying vec2 vUv; varying float vY;
      void main() {
        float borde = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float rayas = smoothstep(0.82, 1.0, sin(vUv.x * 6.2832 * 8.0)) * 0.35 * step(0.0, vY);
        vec3 c = mix(uCol * 0.9, vec3(1.0), borde * 0.7 + rayas);
        float a = vY < 0.0 ? 0.5 * (1.0 + vY * 0.3) : 0.3 + borde * 0.6 + rayas;
        gl_FragColor = vec4(c * (1.15 + borde * 1.2), clamp(a, 0.0, 0.92));
      }`,
  });
}
function geoMedusa() {
  const campana = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  campana.scale(1, 0.75, 1);
  const partes = [campana];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, r = i % 2 ? 0.3 : 0.15, largo = 1.0 + (i % 3) * 0.35;
    const t = new THREE.PlaneGeometry(0.06, largo, 1, 10); t.translate(Math.cos(a) * r, -largo / 2 + 0.05, Math.sin(a) * r); t.rotateY(-a);
    partes.push(t);
  }
  return mergeGeometries(partes.map((q) => (q.index ? q : q)));
}
export class Medusas {
  constructor(grupo, lugares, { colores = ['#9ff0ff', '#d6b8ff', '#ffc2ea', '#b8ffdc'] } = {}) {
    const G = geoMedusa();
    this.m = lugares.map(([x, y, z, esc = 1, deriva = 2], i) => {
      const o = new THREE.Mesh(G, matMedusa(colores[i % colores.length]));
      o.renderOrder = 4; o.scale.setScalar(esc); o.position.set(x, y, z); grupo.add(o);
      return { o, x, y, z, esc, deriva, f: i * 1.9 };
    });
    this.t = 0;
  }
  actualizar(dt) {
    this.t += dt;
    for (const q of this.m) {
      const t = this.t * 0.25 + q.f, late = Math.sin(this.t * 2.4 + q.f);
      q.o.position.set(q.x + Math.cos(t) * q.deriva, q.y + Math.sin(this.t * 0.6 + q.f) * 0.6 + Math.max(0, late) * 0.15, q.z + Math.sin(t * 1.3) * q.deriva);
      q.o.scale.set(q.esc * (1 - late * 0.08), q.esc * (1 + late * 0.1), q.esc * (1 - late * 0.08));
      q.o.rotation.z = Math.sin(t) * 0.15;
    }
  }
}

/* ------------------------------------------------------------------- frutas */
/* las frutas cuelgan de los árboles; comerlas cambia el muñeco un rato */
export const FRUTAS = {
  frutilla: { color: '#ff3d6e', efecto: 'grande' },
  arandano: { color: '#3d7bff', efecto: 'azul' },
  lima: { color: '#9bff3d', efecto: 'chico' },
  dorada: { color: '#ffd23f', efecto: 'brillo' },
  uva: { color: '#b35cff', efecto: 'liviano' },
};
export class Frutas {
  constructor(grupo, lugares) {
    /* lugares: [[x, y, z, tipo]] */
    this.f = lugares.map(([x, y, z, tipo]) => ({ p: new THREE.Vector3(x, y, z), tipo, fuera: 0 }));
    this.mallas = this.f.map((f) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), brilloso(FRUTAS[f.tipo].color, { roughness: 0.15, borde: 0.5 }));
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), brilloso('#4fd13a')); h.scale.set(1.4, 0.4, 0.8); h.position.set(0.06, 0.2, 0); m.add(h);
      m.position.copy(f.p); m.castShadow = true; grupo.add(m); return m;
    });
    this.t = 0;
  }
  cerca(jp) { let mejor = -1, md = 1.8; this.f.forEach((f, i) => { if (f.fuera > 0) return; const d = Math.hypot(f.p.x - jp.x, f.p.z - jp.z); if (d < md && Math.abs(f.p.y - jp.y) < 3.5) { md = d; mejor = i; } }); return mejor; }
  sacar(i) { this.f[i].fuera = 60; }
  actualizar(dt) {
    this.t += dt;
    this.f.forEach((f, i) => { if (f.fuera > 0) f.fuera -= dt; const m = this.mallas[i]; m.visible = f.fuera <= 0; m.rotation.z = Math.sin(this.t * 1.5 + i) * 0.15; m.position.y = f.p.y + Math.sin(this.t * 1.2 + i) * 0.03; });
  }
}

/* -------------------------------------------------------------------- discos */
/* un CD tornasolado que gira: cada uno desbloquea una canción */
export function discoMalla() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: '#f4f8ff', metalness: 1, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [100, 800], clearcoat: 1 });
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 48), m); d.rotation.x = Math.PI / 2; g.add(d);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.3, transparent: true, opacity: 0.6 })); c.rotation.x = Math.PI / 2; g.add(c);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puntoSuave(), color: '#bff0ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(1.6, 1.6, 1); g.add(halo);
  return g;
}

/* ------------------------------------------------------------------ peceras */
export function pecera(x, y, z, r = 1.1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.5, 24), brilloso('#ffffff')); pie.position.y = 0.25; pie.castShadow = true; g.add(pie);
  const agua = new THREE.Mesh(new THREE.SphereGeometry(r * 0.96, 32, 20, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), new THREE.MeshPhysicalMaterial({ color: '#39d6ff', roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1, depthWrite: false }));
  agua.position.y = 0.5 + r; g.add(agua);
  const tapa = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96 * Math.sin(Math.PI * 0.32), 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#8ff0ff', roughness: 0.02, transparent: true, opacity: 0.5, depthWrite: false }));
  tapa.position.y = 0.5 + r + r * 0.96 * Math.cos(Math.PI * 0.32); g.add(tapa);
  const vidrio = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), materialVidrio('#eafcff', 0.18)); vidrio.position.y = 0.5 + r; vidrio.renderOrder = 4; g.add(vidrio);
  const piedras = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 16, 8, 0, Math.PI * 2, Math.PI * 0.75, Math.PI * 0.25), brilloso('#ffe3a8')); piedras.position.y = 0.5 + r; g.add(piedras);
  const peces = [];
  for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(pezGeo(0.34), new THREE.MeshStandardMaterial({ vertexColors: true, color: i ? '#ff8a3d' : '#ffd23f', roughness: 0.2 })); g.add(p); peces.push(p); }
  g.userData.actualizar = (t) => peces.forEach((p, i) => { const a = t * (0.6 + i * 0.3) + i * 3; p.position.set(Math.cos(a) * r * 0.45, 0.5 + r * (0.9 + Math.sin(t * 0.8 + i) * 0.2), Math.sin(a) * r * 0.45); p.rotation.y = -a + (i ? Math.PI : 0); });
  return g;
}

/* ----------------------------------------------------- el globo con cascada */
/* una esfera de vidrio enorme que flota, medio llena de agua, y derrama una
   cascada al lago de abajo. Es la postal del juego */
export function globoCascada(x, y, z, r, alturaAgua = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const vidrio = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), materialVidrio('#e8fdff', 0.16)); vidrio.renderOrder = 4; g.add(vidrio);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.12, 12, 80), brilloso('#ffffff', { metalness: 0.4, roughness: 0.1 })); aro.rotation.x = Math.PI / 2; aro.rotation.y = 0.3; g.add(aro);
  const lleno = new THREE.Mesh(new THREE.SphereGeometry(r * 0.97, 40, 24, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), new THREE.MeshPhysicalMaterial({ color: '#27c6ff', roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1, emissive: '#0a6f9a', emissiveIntensity: 0.25, depthWrite: false }));
  g.add(lleno);
  const sup = new THREE.Mesh(new THREE.CircleGeometry(r * 0.97 * Math.sin(Math.PI * 0.45), 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#8ff4ff', roughness: 0.02, transparent: true, opacity: 0.55, depthWrite: false, emissive: '#1a9fd0', emissiveIntensity: 0.2 }));
  sup.position.y = r * 0.97 * Math.cos(Math.PI * 0.45); g.add(sup);
  /* los peces de adentro */
  const peces = [];
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(pezGeo(0.7), new THREE.MeshStandardMaterial({ vertexColors: true, color: ['#ff8a3d', '#ffd23f', '#ff6fb0', '#ffffff', '#3fffd0'][i], roughness: 0.2 })); g.add(p); peces.push(p); }
  /* la cascada: un chorro que se afina, con rayas que bajan */
  const caida = y - r * 0.9 - alturaAgua;
  const chorroG = new THREE.CylinderGeometry(0.9, 1.5, caida, 24, 12, true); chorroG.translate(0, -r * 0.9 - caida / 2, 0);
  const chorroM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: UNI.uT },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - mp.xyz); gl_Position = projectionMatrix * viewMatrix * mp; }',
    fragmentShader: /* glsl */`
      uniform float uT; varying vec2 vUv; varying vec3 vN, vV;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float col = floor(vUv.x * 48.0);
        float v = fract(vUv.y * (3.0 + h(col) * 2.0) + uT * (1.3 + h(col + 7.0) * 0.8) + h(col + 3.0));
        float raya = smoothstep(0.0, 0.25, v) * smoothstep(1.0, 0.55, v);
        float borde = abs(dot(normalize(vN), vV));
        vec3 c = mix(vec3(0.45, 0.9, 1.0), vec3(1.0), raya * 0.8);
        float a = (0.35 + raya * 0.55) * (0.4 + 0.6 * (1.0 - borde * 0.5)) * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(c * 1.25, a);
      }`,
  });
  const chorro = new THREE.Mesh(chorroG, chorroM); chorro.renderOrder = 3; g.add(chorro);
  /* la espuma abajo: un anillo que late y rocío */
  const esp = new THREE.Mesh(new THREE.RingGeometry(0.6, 3.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  esp.position.y = -y + alturaAgua + 0.05; g.add(esp);
  const nRocio = 90, rg = new THREE.BufferGeometry(), rp = new Float32Array(nRocio * 3), rv = [];
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  for (let i = 0; i < nRocio; i++) rv.push({ t: Math.random(), a: Math.random() * 6.28, v: 1 + Math.random() * 2 });
  const rocio = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, map: puntoSuave(), transparent: true, depthWrite: false, opacity: 0.8 }));
  rocio.frustumCulled = false; g.add(rocio);
  g.userData.actualizar = (t, dt) => {
    g.position.y = y + Math.sin(t * 0.4) * 0.3;
    aro.rotation.z = t * 0.1;
    peces.forEach((p, i) => { const a = t * 0.35 * (i % 2 ? -1 : 1) + i * 1.3, rr = r * (0.35 + (i % 3) * 0.15); p.position.set(Math.cos(a) * rr, -r * 0.35 + Math.sin(t * 0.7 + i) * r * 0.2, Math.sin(a) * rr); p.rotation.y = -a + (i % 2 ? 0 : Math.PI); });
    esp.scale.setScalar(1 + Math.sin(t * 3) * 0.08); esp.position.y = -g.position.y + alturaAgua + 0.05;
    const baseY = -g.position.y + alturaAgua;
    rv.forEach((q, i) => { q.t += dt * 0.9; if (q.t > 1) { q.t = 0; q.a = Math.random() * 6.28; q.v = 1 + Math.random() * 2; } const d = 1.2 + q.t * q.v * 1.2; rp[i * 3] = Math.cos(q.a) * d; rp[i * 3 + 1] = baseY + Math.sin(q.t * Math.PI) * q.v * 0.9; rp[i * 3 + 2] = Math.sin(q.a) * d; });
    rg.attributes.position.needsUpdate = true;
  };
  return g;
}
