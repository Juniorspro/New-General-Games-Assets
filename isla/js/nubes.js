// Nubes de verdad, como las del juego original: cúmulos en 3D armados con
// esferas, con luz de dibujo animado en tres tonos (blanco al sol, celeste,
// gris azulado a la sombra) y el borde entre tonos comido por ruido en
// bloques, que al pixelarse queda escalonado como en los videos. De noche las
// alumbra la luna y se ponen azules.
//
// Todas las nubes son UNA malla: una sola llamada de dibujo. Siguen a la
// cámara de costado (están "en el infinito", como el cielo) y giran despacio.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry, rango } from './azar.js';

const VERT = /* glsl */ `
attribute float aTono;
varying vec3 vN;
varying vec3 vP;
varying float vTono;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 m = modelMatrix * vec4(position, 1.0);
  vP = m.xyz;
  vTono = aTono;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const FRAG = /* glsl */ `
uniform vec3 uLuz;
uniform vec3 uColLuz;
uniform vec3 uColMedio;
uniform vec3 uColSombra;
uniform vec3 uHorizonte;
uniform float uBrillo;
varying vec3 vN;
varying vec3 vP;
varying float vTono;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 n = normalize(vN);
  float k = dot(n, uLuz) * 0.5 + 0.5;
  k = k * 0.85 + 0.08;
  // el borde de cada tono se come en bloques de 3 m: escalones, no una línea
  k += (h13(floor(vP / 3.0)) - 0.5) * 0.16 + vTono;
  // la panza de la nube siempre más oscura
  k -= smoothstep(0.2, -0.9, n.y) * 0.18;
  vec3 col = k > 0.64 ? uColLuz : (k > 0.47 ? uColMedio : uColSombra);
  // perspectiva aérea: lo lejano se funde con el horizonte
  float d = length(vP - cameraPosition);
  col = mix(col, uHorizonte, smoothstep(350.0, 1250.0, d) * 0.55);
  gl_FragColor = vec4(col * uBrillo, 1.0);
  #include <colorspace_fragment>
}`;

// Una nube: esferas que se apilan sobre una base plana.
function geoNube(r, torre) {
  const partes = [];
  const n = torre ? 8 + Math.floor(r() * 6) : 10 + Math.floor(r() * 9);
  const largo = torre ? rango(r, 60, 110) : rango(r, 130, 260);
  const ancho = torre ? rango(r, 40, 70) : rango(r, 50, 100);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const perfil = Math.sin(Math.PI * (0.1 + 0.8 * u));
    const rad = (torre ? rango(r, 24, 42) : rango(r, 18, 36)) * (0.6 + 0.5 * perfil);
    const x = (u - 0.5) * largo + rango(r, -8, 8);
    const z = rango(r, -0.5, 0.5) * ancho;
    const y = rad * 0.35 + perfil * (torre ? rango(r, 16, 44) : rango(r, 2, 16));
    partes.push({ x, y, z, rad });
    // las torres crecen para arriba: bolas más chicas encima
    if (torre && perfil > 0.6) {
      let yy = y + rad * 0.9, rr = rad * 0.8;
      for (let k = 0; k < 4 && r() < 0.85; k++) {
        partes.push({ x: x + rango(r, -6, 6), y: yy, z: z + rango(r, -6, 6), rad: rr });
        yy += rr * 0.85; rr *= 0.72;
      }
    }
  }
  const pos = [], nor = [], tono = [];
  for (const p of partes) {
    const g = new THREE.IcosahedronGeometry(p.rad, 1);   // ya viene sin índice
    const P = g.attributes.position;
    const t = (r() - 0.5) * 0.08;
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      let nx = x / p.rad, ny = y / p.rad, nz = z / p.rad;
      // base plana: lo que cae debajo del piso de la nube se aplasta
      if (p.y + y < 0) { y = -p.y; ny = -1; nx *= 0.2; nz *= 0.2; }
      pos.push(p.x + x, p.y + y, p.z + z);
      nor.push(nx, ny, nz);
      tono.push(t);
    }
  }
  return { pos, nor, tono };
}

export class Nubes {
  constructor(escena) {
    const r = mulberry(4242);
    const pos = [], nor = [], tono = [];
    this.lista = [];
    // Las torres salen del horizonte y los bancos van más arriba, como en
    // los cuadros del original: el cielo casi nunca está vacío.
    const N = 34;
    for (let i = 0; i < N; i++) {
      const torre = r() < 0.5;
      const ang = (i / N) * Math.PI * 2 + rango(r, -0.08, 0.08);
      const dist = torre ? rango(r, 330, 680) : rango(r, 280, 720);
      const alto = torre ? rango(r, 8, 45) : rango(r, 95, 210);
      const g = geoNube(r, torre);
      // girar la nube sobre sí misma y ponerla en su lugar
      const giro = r() * Math.PI * 2, c = Math.cos(giro), s = Math.sin(giro);
      const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
      for (let k = 0; k < g.pos.length; k += 3) {
        const x = g.pos[k], y = g.pos[k + 1], z = g.pos[k + 2];
        pos.push(cx + x * c - z * s, alto + y, cz + x * s + z * c);
        const nx = g.nor[k], ny = g.nor[k + 1], nz = g.nor[k + 2];
        nor.push(nx * c - nz * s, ny, nx * s + nz * c);
      }
      tono.push(...g.tono);
      this.lista.push({ ang, dist, alto, torre });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aTono', new THREE.Float32BufferAttribute(tono, 1));
    this.uni = {
      uLuz: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uColLuz: { value: new THREE.Color(0xffffff) },
      uColMedio: { value: new THREE.Color(0xdde8f8) },
      uColSombra: { value: new THREE.Color(0x86a3d4) },
      uHorizonte: { value: new THREE.Color(0xc9e8ff) },
      uBrillo: { value: 1 },
    };
    this.malla = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: VERT, fragmentShader: FRAG, fog: false }));
    this.malla.frustumCulled = false;
    this.malla.renderOrder = -5;
    this.malla.layers.enable(1);   // también en el reflejo del agua
    this.triangulos = pos.length / 9;
    escena.add(this.malla);
    this.giro = 0;
  }

  // luz: la dirección del sol (o de la luna); colores según la hora
  actualizar(dt, camara, luz, dia, tarde, noche, horizonte) {
    this.giro += dt * 0.0012;
    this.malla.position.set(camara.position.x, 0, camara.position.z);
    this.malla.rotation.y = this.giro;
    this.uni.uLuz.value.copy(luz);
    // los tonos, medidos en los cuadros del original (en sRGB: Color los pasa a lineal)
    const U = this.uni, T = TONOS;
    U.uColLuz.value.copy(T.luz[0]).lerp(T.luz[1], tarde * 0.8).lerp(T.luz[2], noche);
    U.uColMedio.value.copy(T.medio[0]).lerp(T.medio[1], tarde * 0.8).lerp(T.medio[2], noche);
    U.uColSombra.value.copy(T.sombra[0]).lerp(T.sombra[1], tarde * 0.8).lerp(T.sombra[2], noche);
    U.uHorizonte.value.copy(horizonte);
    U.uBrillo.value = 1;
  }
}
const _c = new THREE.Color();
const K = (h) => new THREE.Color(h);
// día · atardecer · noche
const TONOS = {
  luz: [K(0xffffff), K(0xffd9b8), K(0xb7c6ff)],
  medio: [K(0xd9e5f5), K(0xf2a98c), K(0x6d82d6)],
  sombra: [K(0x7a9ccf), K(0x8a72a8), K(0x2e3d85)],
};
