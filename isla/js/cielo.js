// El cielo, el sol, la luna, las estrellas, las nubes y la hora del día.
// Todo lo que ilumina la isla sale de acá: una sola fuente de verdad para el
// color del cielo, de la niebla, del ambiente y del sol, así el horizonte
// nunca se ve como la línea donde termina el mundo.
import * as THREE from '../vendor/three.module.min.js';
import { LUZ } from './material.js';
import { suavizado, lim } from './azar.js';
import { Nubes } from './nubes.js';

const C = (h) => new THREE.Color(h);
const PALETA = {
  // el azul profundo del original arriba y celeste claro abajo (medido en sus cuadros)
  cenitDia: C(0x1c46d4), horizonteDia: C(0xa6d0ff),
  cenitTarde: C(0x33489e), horizonteTarde: C(0xffab74),
  cenitNoche: C(0x040817), horizonteNoche: C(0x16204d),
  solDia: new THREE.Color(1.28, 1.2, 1.06), solTarde: new THREE.Color(1.25, 0.72, 0.42), luna: new THREE.Color(0.1, 0.14, 0.32),
  cieloDia: new THREE.Color(0.5, 0.64, 0.92), sueloDia: new THREE.Color(0.66, 0.58, 0.42),
  cieloNoche: new THREE.Color(0.045, 0.065, 0.15), sueloNoche: new THREE.Color(0.02, 0.025, 0.05),
};

const VERT_CIELO = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG_CIELO = /* glsl */ `
uniform vec3 uCenit;
uniform vec3 uHorizonte;
uniform vec3 uSol;
uniform vec3 uSolColor;
uniform float uNoche;
uniform float uT;
varying vec3 vDir;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 d = normalize(vDir);
  float y = max(d.y, 0.0);
  vec3 col = mix(uHorizonte, uCenit, pow(y, 0.62));
  if (d.y < 0.0) col = uHorizonte;
  // el sol: disco duro + halo (el bloom no existe acá: el halo lo pinta el cielo)
  float s = max(dot(d, uSol), 0.0);
  col += uSolColor * (smoothstep(0.9975, 0.9985, s) * 1.6 + pow(s, 90.0) * 0.45 + pow(s, 8.0) * 0.12) * (1.0 - uNoche * 0.8);
  // la luna, del lado opuesto
  float l = max(dot(d, -uSol), 0.0);
  float disco = smoothstep(0.99905, 0.99935, l);
  float manchas = h13(floor(d * 1400.0)) * 0.18 + h13(floor(d * 520.0)) * 0.22;
  col = mix(col, vec3(0.93, 0.95, 1.0) * (0.9 - manchas), disco * uNoche);
  col += vec3(0.4, 0.5, 0.95) * (pow(l, 70.0) * 0.55 + pow(l, 9.0) * 0.16) * uNoche;
  // estrellas: una grilla en la esfera, en píxeles
  if (uNoche > 0.01 && d.y > 0.0) {
    vec3 q = floor(d * 190.0);
    float h = h13(q);
    if (h > 0.9965) {
      float tit = 0.65 + 0.35 * sin(uT * 3.0 + h * 80.0);
      col += vec3(0.9, 0.95, 1.0) * uNoche * tit * smoothstep(0.0, 0.25, d.y);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Cielo {
  constructor(escena) {
    this.escena = escena;
    this.hora = 0.34;          // 0 medianoche · 0.25 amanecer · 0.5 mediodía
    this.duracionDia = 20 * 60; // segundos por día
    this.uni = {
      uCenit: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() },
      uSol: { value: new THREE.Vector3() }, uSolColor: { value: new THREE.Color() },
      uNoche: { value: 0 }, uT: LUZ.uT,
    };
    this.domo = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: VERT_CIELO, fragmentShader: FRAG_CIELO, side: THREE.BackSide, depthWrite: false }));
    this.domo.renderOrder = -10;
    this.domo.frustumCulled = false;
    escena.add(this.domo);

    // Nubes en 3D, como las del original (antes eran carteles chatos)
    this.nubes3d = new Nubes(escena);
    this.domo.layers.enable(1);   // el cielo también se refleja en el agua

    // La luz direccional existe SOLO para dibujar el mapa de sombras: los
    // materiales de la isla hacen su propia cuenta con LUZ.
    this.sol = new THREE.DirectionalLight(0xffffff, 0);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.cajaSombra = 42;
    const cam = this.sol.shadow.camera;
    cam.left = -this.cajaSombra; cam.right = this.cajaSombra; cam.top = this.cajaSombra; cam.bottom = -this.cajaSombra;
    cam.near = 1; cam.far = 260;
    escena.add(this.sol, this.sol.target);
    this.bajoTierra = 0;
  }

  ponerCalidadSombra(tam, caja) {
    this.sol.shadow.mapSize.set(tam, tam);
    this.cajaSombra = caja;
    const cam = this.sol.shadow.camera;
    cam.left = -caja; cam.right = caja; cam.top = caja; cam.bottom = -caja;
    cam.updateProjectionMatrix();
    if (this.sol.shadow.map) { this.sol.shadow.map.dispose(); this.sol.shadow.map = null; }
  }

  actualizar(dt, camara, centro) {
    this.hora = (this.hora + dt / this.duracionDia) % 1;
    const ang = (this.hora - 0.25) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.38).normalize();
    const dia = suavizado(-0.1, 0.22, dir.y);
    const tarde = Math.max(0, 1 - Math.abs(dir.y - 0.06) / 0.2) * (dir.y > -0.12 ? 1 : 0);
    const noche = 1 - dia;
    const P = PALETA;
    const cenit = P.cenitNoche.clone().lerp(P.cenitDia, dia).lerp(P.cenitTarde, tarde * 0.5);
    const horiz = P.horizonteNoche.clone().lerp(P.horizonteDia, dia).lerp(P.horizonteTarde, tarde * 0.75);
    this.uni.uCenit.value.copy(cenit);
    this.uni.uHorizonte.value.copy(horiz);
    this.uni.uSol.value.copy(dir);
    this.uni.uNoche.value = noche;
    const solCol = P.solDia.clone().lerp(P.solTarde, tarde);
    this.uni.uSolColor.value.copy(solCol);

    // La luz que ve la isla: sol de día, luna de noche (la misma dirección
    // invertida), y nunca más ambiente que sol.
    const bajo = this.bajoTierra;
    const luzDir = dir.y > -0.02 ? dir.clone() : dir.clone().negate();
    LUZ.uSolDir.value.copy(luzDir);
    const intensSol = dir.y > -0.02 ? suavizado(-0.02, 0.12, dir.y) : suavizado(0.02, 0.2, -dir.y);
    const colLuz = dir.y > -0.02 ? solCol : P.luna;
    LUZ.uSolColor.value.copy(colLuz).multiplyScalar(intensSol * (1 - bajo));
    LUZ.uCielo.value.copy(P.cieloNoche).lerp(P.cieloDia, dia).multiplyScalar(1 - bajo * 0.93);
    LUZ.uSuelo.value.copy(P.sueloNoche).lerp(P.sueloDia, dia).multiplyScalar(1 - bajo * 0.95);
    if (bajo > 0.5) {
      LUZ.uNieblaColor.value.setRGB(0.02, 0.018, 0.015);
      LUZ.uNieblaDens.value = 0.075;
    } else {
      LUZ.uNieblaColor.value.copy(horiz);
      LUZ.uNieblaDens.value = 0.0021;
    }
    LUZ.uSombraActiva.value = bajo < 0.5 && intensSol > 0.02 ? 1 : 0;

    // el domo y las nubes siguen a la cámara
    this.domo.position.copy(camara.position);
    this.domo.visible = bajo < 0.5;
    this.nubes3d.actualizar(dt, camara, luzDir, dia, tarde, noche, horiz);
    this.nubes3d.malla.visible = bajo < 0.5;

    // sombra: la caja sigue al jugador de a un texel (si no, los bordes titilan)
    const s = this.sol;
    const texel = (2 * this.cajaSombra) / s.shadow.mapSize.x;
    const eje = luzDir.clone();
    const der = new THREE.Vector3(0, 1, 0).cross(eje).normalize();
    const arr = eje.clone().cross(der).normalize();
    const px = Math.round(centro.dot(der) / texel) * texel;
    const py = Math.round(centro.dot(arr) / texel) * texel;
    const pz = centro.dot(eje);
    const c = der.multiplyScalar(px).add(arr.multiplyScalar(py)).add(eje.clone().multiplyScalar(pz));
    s.target.position.copy(c);
    s.position.copy(c).addScaledVector(eje, 130);
    s.target.updateMatrixWorld();
    s.updateMatrixWorld();
    return { dia, noche, tarde, dir };
  }

  // Después de que three dibujó el mapa de sombras (se crea en el primer cuadro).
  // La matriz va POR REFERENCIA: three la recalcula en la pasada de sombras,
  // que corre dentro del mismo render() y antes de dibujar la isla.
  enlazarSombra() {
    const sh = this.sol.shadow;
    LUZ.uSombraMatriz.value = sh.matrix;
    LUZ.uSombraMapa.value = sh.map ? sh.map.texture : null;
    if (!sh.map) LUZ.uSombraActiva.value = 0;
  }

  esDeNoche() { return this.uni.uNoche.value > 0.6; }
  horaTexto() {
    const m = Math.floor(this.hora * 24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
}

export { lim };
