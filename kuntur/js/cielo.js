/* kuntur/js/cielo.js — el cielo, las montañas del fondo y las nubes.
   El cielo es una esfera que sigue a la cámara, pintada por un shader: el
   degradé del horizonte al cenit, el sol o la luna con su halo, las estrellas
   que titilan, la Vía Láctea de la Puna, las nubes que pasan y los relámpagos
   de la granizada. Las montañas son tres cordones de verdad, en 3D, que la
   niebla va aclarando con la distancia. */
import * as THREE from 'three';
import { fbm, hash } from './azar.js';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const FRAG = /* glsl */`
uniform vec3 uZenit, uMedio, uHorizonte, uNubeCol;
uniform vec3 uSol, uLuna;
uniform float uHaySol, uHayLuna, uEstrellas, uVia, uNubes, uTiempo, uRayo, uExp;
varying vec3 vDir;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += n3(p) * a; p *= 2.02; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  /* el degradé: debajo del horizonte, un poco más oscuro */
  vec3 col = y > 0.0 ? mix(uHorizonte, uMedio, smoothstep(0.0, 0.25, y)) : uHorizonte * 0.92;
  col = mix(col, uZenit, smoothstep(0.2, 0.85, y));
  /* el sol: disco, halo ancho y un resplandor en el horizonte */
  if (uHaySol > 0.5) {
    float s = max(dot(d, uSol), 0.0);
    float sobre = smoothstep(-0.05, 0.02, uSol.y);
    col += vec3(1.0, 0.78, 0.5) * pow(s, 8.0) * 0.55 * (0.5 + 0.5 * sobre);
    col += vec3(1.0, 0.85, 0.65) * pow(s, 64.0) * 0.8 * sobre;
    col = mix(col, vec3(1.0, 0.97, 0.9) * 3.0, smoothstep(0.9994, 0.9998, s) * sobre * step(-0.01, y));
    col += vec3(1.0, 0.6, 0.35) * pow(max(0.0, 1.0 - abs(y) * 6.0), 3.0) * pow(s, 3.0) * 0.4;
  }
  if (uHayLuna > 0.5) {
    float s = max(dot(d, uLuna), 0.0);
    col += vec3(0.6, 0.7, 1.0) * pow(s, 30.0) * 0.25;
    float disco = smoothstep(0.99955, 0.9997, s);
    /* la sombra que hace el cuarto creciente */
    vec3 off = normalize(uLuna + vec3(0.012, 0.006, 0.0));
    float tapa = smoothstep(0.99955, 0.9997, max(dot(d, off), 0.0));
    col = mix(col, vec3(1.0, 0.98, 0.9) * 2.2, disco * (1.0 - tapa * 0.92));
  }
  /* estrellas y la Vía Láctea */
  if (uEstrellas > 0.0 && y > -0.02) {
    vec3 q = d * 280.0;
    vec3 c = floor(q);
    float r = h3(c);
    if (r > 0.992) {
      vec3 cen = c + 0.5 + (vec3(h3(c + 1.3), h3(c + 2.1), h3(c + 3.7)) - 0.5) * 0.6;
      float dd = length(q - cen);
      float tit = 0.65 + 0.35 * sin(uTiempo * (1.5 + r * 30.0) + r * 60.0);
      col += vec3(0.9, 0.93, 1.0) * smoothstep(0.35, 0.0, dd) * tit * uEstrellas * (r - 0.992) * 160.0 * smoothstep(-0.02, 0.15, y);
    }
    if (uVia > 0.0) {
      vec3 eje = normalize(vec3(0.35, 0.25, 0.9));
      float banda = 1.0 - abs(dot(d, eje));
      float nube = fbm3(d * 6.0 + 3.0);
      float v = smoothstep(0.82, 1.0, banda) * (0.4 + nube * 1.2);
      col += vec3(0.55, 0.62, 0.9) * v * 0.28 * uVia;
      col -= vec3(0.05, 0.05, 0.06) * smoothstep(0.93, 1.0, banda) * smoothstep(0.55, 0.75, nube) * uVia;
      /* estrellitas finas dentro de la franja */
      float fin = step(0.985, h3(floor(d * 900.0)));
      col += vec3(0.8, 0.85, 1.0) * fin * smoothstep(0.85, 1.0, banda) * 0.6 * uVia;
    }
  }
  /* nubes: dos capas de ruido que pasan despacio */
  if (uNubes > 0.0 && y > -0.05) {
    vec2 p = d.xz / (y + 0.12) * 0.9;
    float n = fbm3(vec3(p * 1.3 + vec2(uTiempo * 0.012, 0.0), uTiempo * 0.01));
    float cob = smoothstep(1.0 - uNubes * 0.75, 1.0 - uNubes * 0.2, n);
    float borde = smoothstep(0.0, 0.25, y + 0.05);
    vec3 nc = uNubeCol;
    if (uHaySol > 0.5) nc += vec3(1.0, 0.85, 0.6) * pow(max(dot(d, uSol), 0.0), 6.0) * 0.6;
    col = mix(col, nc * (0.85 + n * 0.3), cob * borde * 0.9);
  }
  col += vec3(0.7, 0.75, 1.0) * uRayo;
  gl_FragColor = vec4(col * uExp, 1.0);
}`;

const dirDe = (v) => (v ? new THREE.Vector3(v[0], v[1], -1).normalize() : new THREE.Vector3(0, -1, 0));

export class Cielo {
  constructor(escena) {
    this.u = {
      uZenit: { value: new THREE.Color() }, uMedio: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uNubeCol: { value: new THREE.Color() },
      uSol: { value: new THREE.Vector3() }, uLuna: { value: new THREE.Vector3() }, uHaySol: { value: 0 }, uHayLuna: { value: 0 },
      uEstrellas: { value: 0 }, uVia: { value: 0 }, uNubes: { value: 0 }, uTiempo: { value: 0 }, uRayo: { value: 0 }, uExp: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
    this.esfera = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), mat);
    this.esfera.renderOrder = -10;
    this.esfera.frustumCulled = false;
    escena.add(this.esfera);
    this.escena = escena;
    this.montes = null;
  }
  poner(bio) {
    const c = bio.cielo, u = this.u;
    u.uZenit.value.set(c.zenit); u.uMedio.value.set(c.medio); u.uHorizonte.value.set(c.horizonte); u.uNubeCol.value.set(c.nubeCol);
    u.uHaySol.value = c.sol ? 1 : 0; if (c.sol) u.uSol.value.copy(dirDe(c.sol));
    u.uHayLuna.value = c.luna ? 1 : 0; if (c.luna) u.uLuna.value.copy(dirDe(c.luna));
    u.uEstrellas.value = c.estrellas; u.uVia.value = c.via; u.uNubes.value = c.nubes;
  }
  pasar(t, camara) {
    this.u.uTiempo.value = t;
    this.esfera.position.copy(camara.position);
  }
}

/* los cordones del fondo: tres filas de puntos por cordón, para que tengan
   ladera y cumbre y la luz los modele */
export function armarMontes(bio, x0, x1) {
  const g = new THREE.Group();
  bio.montes.forEach((c, i) => {
    const pos = [], col = [];
    const paso = Math.max(2, Math.round(Math.abs(c.z) / 16));
    const base = new THREE.Color(c.col), cc = new THREE.Color(), blanco = new THREE.Color('#f4f8ff');
    /* un cordón: una grilla que sube desde adelante hasta la cresta y baja atrás */
    const nz = 7, prof = 18 + Math.abs(c.z) * 0.25;
    const zDe = (k) => c.z + prof * 0.4 - (k / (nz - 1)) * prof;
    const alto = (x, k) => {
      const forma = Math.pow(Math.sin(Math.PI * Math.min(1, (k / (nz - 1)) * 1.15)), 0.8);
      const n = fbm(x * 0.011 / (1 + i * 0.4), i * 7.3 + k * 0.15, 61 + i) * 1.3 - 0.15;
      const pico = Math.pow(Math.max(0, fbm(x * 0.028, i * 3.1 + k * 0.1, 71 + i) - 0.35) * 1.7, 1.5) * c.rug;
      return Math.max(0, n * 0.75 + pico) * c.alto * forma - (k === 0 || k === nz - 1 ? 8 : 0);
    };
    const colorEn = (x, y, k) => {
      cc.copy(base);
      if (c.rayas) {
        const R = bio.roca, bnd = Math.floor((y + Math.sin(x * 0.025) * 3 + fbm(x * 0.02, k, 5) * 4) / (1.6 + i * 1.3));
        cc.set(R[((bnd % R.length) + R.length) % R.length]).lerp(base, 0.3 + i * 0.25);
      }
      if (c.nieve && y > c.alto * 0.42) cc.lerp(blanco, Math.min(1, (y - c.alto * 0.42) / (c.alto * 0.18)));
      cc.multiplyScalar(0.92 + hash(Math.floor(x), k, i) * 0.1);
      return cc.clone();
    };
    for (let x = x0 - 260; x < x1 + 260; x += paso) {
      for (let k = 0; k < nz - 1; k++) {
        const a = [x, alto(x, k), zDe(k)], b = [x + paso, alto(x + paso, k), zDe(k)], d = [x + paso, alto(x + paso, k + 1), zDe(k + 1)], e = [x, alto(x, k + 1), zDe(k + 1)];
        const ca = colorEn(x, a[1], k), cb = colorEn(x + paso, b[1], k), cd = colorEn(x + paso, d[1], k + 1), ce = colorEn(x, e[1], k + 1);
        pos.push(...a, ...b, ...d, ...a, ...d, ...e);
        for (const [p, q, r] of [[ca, cb, cd], [ca, cd, ce]]) { const cr = (p.r + q.r + r.r) / 3, cg = (p.g + q.g + r.g) / 3, cbb = (p.b + q.b + r.b) / 3; col.push(cr, cg, cbb, cr, cg, cbb, cr, cg, cbb); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    m.position.y = -3 - i * 5;
    g.add(m);
  });
  g.name = 'montes';
  return g;
}

/* una textura de nube: manchas suaves, en un lienzo */
export function texturaNube(semilla) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 40 + hash(i, 1, semilla) * 176, y = 50 + hash(i, 2, semilla) * 40 - Math.abs(x - 128) * 0.12, r = 18 + hash(i, 3, semilla) * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function armarNubes(bio, x0, x1) {
  const g = new THREE.Group();
  const n = Math.round(bio.cielo.nubes * 18);
  const tex = [texturaNube(1), texturaNube(2), texturaNube(3)];
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex[i % 3], color: new THREE.Color(bio.cielo.nubeCol), transparent: true, depthWrite: false, fog: true, opacity: 0.85 });
    const s = new THREE.Sprite(mat);
    const z = -120 - hash(i, 5, 9) * 200;
    s.position.set(x0 - 100 + hash(i, 6, 9) * (x1 - x0 + 200), 30 + hash(i, 7, 9) * 50 + (-z) * 0.08, z);
    const e = 60 + hash(i, 8, 9) * 80;
    s.scale.set(e, e * 0.45, 1);
    s.userData.v = 0.5 + hash(i, 9, 9);
    g.add(s);
  }
  g.name = 'nubes';
  return g;
}

/* el mar de nubes debajo del viaducto */
export function armarMarDeNubes(x0, x1, y) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const q = c.getContext('2d');
  q.fillStyle = 'rgba(255,255,255,0)'; q.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) {
    const x = hash(i, 1, 77) * 512, yy = hash(i, 2, 77) * 512, r = 20 + hash(i, 3, 77) * 60;
    const grd = q.createRadialGradient(x, yy, 0, x, yy, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = grd;
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) q.fillRect(x - r + dx, yy - r + dy, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 3); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(k === 0 ? '#ffffff' : '#ffe8d8'), opacity: 0.9 - k * 0.2, fog: true });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 800, 500), mat);
    p.rotation.x = -Math.PI / 2;
    p.position.set((x0 + x1) / 2, y - k * 1.6, -150);
    p.userData.k = k;
    g.add(p);
  }
  g.name = 'marNubes';
  return g;
}
