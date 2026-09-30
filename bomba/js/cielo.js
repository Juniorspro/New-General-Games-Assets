// El cielo, la niebla y la luz de cada mundo. Un domo con degradé, sol y
// (según el mundo) estrellas y nebulosa; nubes esponjosas de bolas pegadas;
// hemisférica + sol con sombra que sigue al jugador de a un texel.
import * as THREE from '../vendor/three.module.min.js';
import { fusionar, pintar, esfera } from './geo.js';
import { azar, entre } from './util.js';
import { TIEMPO, BORDE } from './material.js';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDir = w.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * w;
  gl_Position.z = gl_Position.w * 0.99999;   // siempre al fondo
}`;
const FRAG = /* glsl */ `
uniform vec3 uArriba; uniform vec3 uHorizonte; uniform vec3 uAbajo;
uniform vec3 uSolDir; uniform vec3 uSolColor; uniform float uSolTam;
uniform float uEstrellas; uniform float uNebulosa; uniform vec3 uNeb1; uniform vec3 uNeb2; uniform float uT;
varying vec3 vDir;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruido(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * ruido(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = y > 0.0 ? mix(uHorizonte, uArriba, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(uHorizonte, uAbajo, pow(clamp(-y, 0.0, 1.0), 0.4));
  // el sol: disco y halo
  float s = max(dot(d, normalize(uSolDir)), 0.0);
  c += uSolColor * (pow(s, 900.0 / uSolTam) * 6.0 + pow(s, 12.0) * 0.28 + pow(s, 3.0) * 0.08);
  if (uNebulosa > 0.0) {
    float n = fbm(d * 2.2 + vec3(0.0, uT * 0.004, 0.0));
    float m = fbm(d * 4.1 + 7.0);
    vec3 neb = mix(uNeb1, uNeb2, smoothstep(0.3, 0.8, m)) * smoothstep(0.42, 0.85, n) * 0.9;
    c += neb * uNebulosa;
  }
  if (uEstrellas > 0.0) {
    vec3 g = floor(d * 180.0);
    float h = h3(g);
    float brillo = step(0.992, h) * (0.6 + 0.4 * sin(uT * (2.0 + h * 5.0) + h * 40.0));
    vec3 f = fract(d * 180.0) - 0.5;
    c += vec3(0.9, 0.95, 1.0) * brillo * smoothstep(0.35, 0.0, length(f)) * 2.2 * uEstrellas * smoothstep(-0.1, 0.2, y + 0.3);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

// Cada mundo: colores del cielo, niebla, luces y si hay nubes.
export const CIELOS = {
  patio: { arriba: 0x2f7ff5, horizonte: 0xbfe6ff, abajo: 0x8fd06a, sol: [0.45, 0.72, 0.52], solColor: 0xfff2d6, solTam: 1, niebla: 0xcfeaff, cerca: 70, lejos: 260, hemiCielo: 0xd6ecff, hemiSuelo: 0x5e9a3a, hemi: 1.25, solI: 3.1, nubes: 1, borde: 0xe6f6ff },
  granja: { arriba: 0x3d7de0, horizonte: 0xffdcae, abajo: 0xd8b060, sol: [-0.55, 0.38, 0.62], solColor: 0xffd29a, solTam: 1.6, niebla: 0xf6dcb4, cerca: 70, lejos: 260, hemiCielo: 0xffe7c4, hemiSuelo: 0x9a7a3a, hemi: 1.15, solI: 3.2, nubes: 1, borde: 0xfff0d8 },
  neon: { arriba: 0x080420, horizonte: 0x4a1d74, abajo: 0x140a26, sol: [0.3, 0.55, -0.6], solColor: 0x9fb4ff, solTam: 2.2, niebla: 0x2a1446, cerca: 45, lejos: 200, hemiCielo: 0x7a5cff, hemiSuelo: 0x1a1030, hemi: 0.75, solI: 0.9, nubes: 0, estrellas: 1, borde: 0xc07bff },
  lab: { arriba: 0x0b1616, horizonte: 0x123a36, abajo: 0x071010, sol: [0.2, 0.9, 0.3], solColor: 0x9ffff0, solTam: 0.01, niebla: 0x0f2c2a, cerca: 30, lejos: 150, hemiCielo: 0x7ff5e0, hemiSuelo: 0x1a2a28, hemi: 0.95, solI: 1.4, nubes: 0, borde: 0x7ffff0 },
  cosmico: { arriba: 0x03040e, horizonte: 0x1b1650, abajo: 0x05030f, sol: [-0.4, 0.5, -0.7], solColor: 0xffffff, solTam: 1.2, niebla: 0x0b0a2a, cerca: 80, lejos: 320, hemiCielo: 0x9fb6ff, hemiSuelo: 0x2a1850, hemi: 0.9, solI: 2.4, nubes: 0, estrellas: 1, nebulosa: 1, neb1: 0x5a2cff, neb2: 0x18d6ff, borde: 0xb08cff },
};

export class Cielo {
  constructor(escena) {
    this.escena = escena;
    this.u = {
      uArriba: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uAbajo: { value: new THREE.Color() },
      uSolDir: { value: new THREE.Vector3(0.4, 0.7, 0.5) }, uSolColor: { value: new THREE.Color() }, uSolTam: { value: 1 },
      uEstrellas: { value: 0 }, uNebulosa: { value: 0 }, uNeb1: { value: new THREE.Color() }, uNeb2: { value: new THREE.Color() }, uT: TIEMPO,
    };
    this.domo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.domo.frustumCulled = false;
    this.domo.renderOrder = -10;
    escena.add(this.domo);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    escena.add(this.hemi);
    this.sol = new THREE.DirectionalLight(0xffffff, 3);
    this.sol.castShadow = true;
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    escena.add(this.sol, this.sol.target);
    this.caja = 26;
    this.ponerSombra(2048);
    escena.fog = new THREE.Fog(0xcfeaff, 70, 260);
    this.nubes = this.crearNubes();
    escena.add(this.nubes);
    this.solDir = new THREE.Vector3();
  }

  ponerSombra(tam) {
    const s = this.sol.shadow;
    s.mapSize.set(tam, tam);
    if (s.map) { s.map.dispose(); s.map = null; }
    const c = s.camera;
    c.left = c.bottom = -this.caja; c.right = c.top = this.caja; c.near = 1; c.far = 160;
    c.updateProjectionMatrix();
  }

  // Nubes de 5 a 9 bolas pegadas, chatas abajo, en un anillo lejano.
  crearNubes() {
    const r = azar(4242), geos = [];
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + entre(r, -0.1, 0.1), d = entre(r, 230, 420), alto = entre(r, 55, 120);
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, esc = entre(r, 9, 17);
      const n = 5 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const g = esfera(1, 12, 8);
        const s = esc * entre(r, 0.55, 1.05);
        g.scale(s, s * 0.8, s);
        g.translate(cx + entre(r, -1.6, 1.6) * esc, alto + Math.abs(entre(r, 0, 0.5)) * esc, cz + entre(r, -0.8, 0.8) * esc);
        // la base chata: lo que queda abajo del piso de la nube se aplasta
        const P = g.attributes.position;
        for (let j = 0; j < P.count; j++) if (P.getY(j) < alto - esc * 0.25) P.setY(j, alto - esc * 0.25 + (P.getY(j) - alto + esc * 0.25) * 0.15);
        g.computeVertexNormals();
        geos.push(pintar(g, 0xffffff));
      }
    }
    const m = new THREE.Mesh(fusionar(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0x9fb6d8, emissiveIntensity: 0.55, fog: false }));
    m.frustumCulled = false;
    return m;
  }

  poner(nombre) {
    const C = CIELOS[nombre] || CIELOS.patio;
    this.nombre = nombre;
    const u = this.u;
    u.uArriba.value.set(C.arriba); u.uHorizonte.value.set(C.horizonte); u.uAbajo.value.set(C.abajo);
    u.uSolColor.value.set(C.solColor); u.uSolTam.value = C.solTam;
    u.uEstrellas.value = C.estrellas || 0; u.uNebulosa.value = C.nebulosa || 0;
    if (C.neb1) { u.uNeb1.value.set(C.neb1); u.uNeb2.value.set(C.neb2); }
    this.solDir.set(...C.sol).normalize();
    u.uSolDir.value.copy(this.solDir);
    this.escena.fog.color.set(C.niebla); this.escena.fog.near = C.cerca; this.escena.fog.far = C.lejos;
    this.hemi.color.set(C.hemiCielo); this.hemi.groundColor.set(C.hemiSuelo); this.hemi.intensity = C.hemi;
    this.sol.color.set(C.solColor); this.sol.intensity = C.solI;
    this.nubes.visible = !!C.nubes;
    BORDE.color.value.set(C.borde);
  }

  // La sombra sigue al punto (el jugador), pegada a la grilla de sus texeles.
  seguir(p) {
    const tex = (this.caja * 2) / this.sol.shadow.mapSize.x;
    const x = Math.round(p.x / tex) * tex, z = Math.round(p.z / tex) * tex;
    this.sol.target.position.set(x, 0, z);
    this.sol.position.set(x + this.solDir.x * 70, this.solDir.y * 70, z + this.solDir.z * 70);
    this.domo.position.set(p.x, 0, p.z);
    this.nubes.position.set(p.x * 0.9, 0, p.z * 0.9);
    this.nubes.rotation.y += 0.00004;
  }
}
