// Materiales de gemas, metales y objetos raros. La misma luz pixelada que el
// resto de la isla, más lo propio de cada uno: facetas que destellan, el ópalo
// que cambia de color según cómo lo mirás, el bismuto con su arcoíris de
// película fina, la pirita que es metal, el fragmento de cielo que muestra el
// cielo de atrás "donde sea que estés", y la antimateria, que es mirar el
// universo por un agujero.
import * as THREE from '../vendor/three.module.min.js';
import { LUZ, LUZ_GLSL, VERT } from './material.js';

const FRAG = /* glsl */ `
#include <packing>
uniform float uT;
uniform float uTexeles;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uEmision;
uniform vec3 uCenit;
uniform vec3 uHorizonte;
varying vec3 vMundo;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
${LUZ_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 p = vMundo;
  vec2 t = planoMundo(p, n) * uTexeles;
  vec2 s = hastaCentro(t);
  vec3 pc = p + dFdx(p) * s.x + dFdy(p) * s.y;
  vec3 V = normalize(cameraPosition - pc);
  float nv = clamp(dot(n, V), 0.0, 1.0);
  vec3 base = uColor * vColor;
  float sombra;
  vec3 luz = luzEn(pc, n, sombra);
  vec3 col;
#if defined(CIELO)
  // el fragmento de cielo: el color del cielo en la dirección en que mirás
  vec3 d = normalize(pc - cameraPosition);
  col = mix(uHorizonte, uCenit, pow(max(d.y, 0.0), 0.5));
  vec2 q = floor(vec2(atan(d.z, d.x) * 40.0, d.y * 60.0));
  float nube = step(0.72, fract(sin(dot(floor(q / 3.0), vec2(12.99, 78.23))) * 43758.5));
  col = mix(col, vec3(1.0), nube * 0.85 * smoothstep(0.0, 0.3, d.y + 0.2));
  col += vec3(0.4, 0.6, 1.0) * pow(1.0 - nv, 3.0) * 0.6;
#elif defined(ANTIMATERIA)
  // un agujero al universo: estrellas fijas en la dirección de la vista
  vec3 d = normalize(pc - cameraPosition);
  vec3 q = floor(d * 90.0);
  float h = fract(sin(dot(q, vec3(12.99, 78.23, 37.71))) * 43758.5);
  col = vec3(0.01, 0.0, 0.03) + vec3(0.9, 0.85, 1.0) * step(0.985, h) * (0.6 + 0.4 * sin(uT * 4.0 + h * 90.0));
  col += vec3(0.5, 0.2, 0.9) * pow(1.0 - nv, 4.0) * 0.8;
#elif defined(METAL)
  vec3 R = reflect(-V, n);
  vec3 cielo = mix(uHorizonte * 0.6, uCenit * 0.9, clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  col = base * (luz * 0.45 + cielo * 0.55);
  col += uSolColor * pow(max(dot(R, uSolDir), 0.0), 24.0) * 1.2 * sombra;
  col += base * pow(1.0 - nv, 2.0) * 0.35;
#else
  // cristal: facetas planas, mucho brillo y un poco de luz propia
  vec3 tono = base;
  #ifdef OPALO
    tono = mix(vec3(0.95), 0.6 + 0.4 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + nv * 1.6 + dot(n, vec3(0.3, 0.5, 0.2)))), 0.45);
  #endif
  #ifdef BISMUTO
    tono = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + pc.y * 3.0 + nv * 2.2 + floor((pc.x + pc.z) * 8.0) * 0.07));
  #endif
  col = tono * (luz * 0.75 + 0.25);
  vec3 R = reflect(-V, n);
  col += uSolColor * pow(max(dot(R, uSolDir), 0.0), 40.0) * 1.4 * sombra;
  col += tono * pow(1.0 - nv, 2.5) * 0.6;
  col += mix(tono, uColor2, 0.5) * uEmision;
  // destellos por faceta
  float h = fract(sin(dot(floor(n * 7.0), vec3(12.9, 78.2, 37.7)) + floor(uT * 2.0) * 0.37) * 43758.5);
  col += vec3(1.0) * step(0.93, h) * 0.5;
#endif
  gl_FragColor = vec4(terminar(col, pc), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const cache = new Map();
let uniCielo = null;
export function enlazarCielo(cielo) { uniCielo = cielo.uni; }

/** tipo: 'cristal' | 'opalo' | 'bismuto' | 'metal' | 'cielo' | 'antimateria' */
export function matGema(color, tipo = 'cristal', op = {}) {
  const clave = `${tipo}|${color}|${op.emision || 0}|${op.color2 || ''}`;
  if (cache.has(clave)) return cache.get(clave);
  const defines = {};
  if (tipo === 'opalo') defines.OPALO = '';
  if (tipo === 'bismuto') defines.BISMUTO = '';
  if (tipo === 'metal') defines.METAL = '';
  if (tipo === 'cielo') defines.CIELO = '';
  if (tipo === 'antimateria') defines.ANTIMATERIA = '';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...LUZ,
      uTexeles: { value: op.texeles || 32 },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(op.color2 ?? color) },
      uEmision: { value: op.emision ?? 0.12 },
      uCenit: uniCielo ? uniCielo.uCenit : { value: new THREE.Color(0x2a78ec) },
      uHorizonte: uniCielo ? uniCielo.uHorizonte : { value: new THREE.Color(0xc9e8ff) },
      uViento: { value: 0 }, uAltoViento: { value: 1 },
    },
    vertexShader: VERT, fragmentShader: FRAG, defines,
    vertexColors: !!op.colores,
  });
  cache.set(clave, m);
  return m;
}
