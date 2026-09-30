// Los materiales: plástico de juguete con color por vértice, y un borde de luz
// (fresnel) en todo lo que se ilumina. Ese borde es lo que separa a un modelo
// del fondo cuando todo es de colores vivos: sin él, un cangrejo naranja sobre
// arena clara se pierde (receta de aeroplaza, guias/GUIA-AEROPLAZA.md § 3.1).
import * as THREE from '../vendor/three.module.min.js';

export const TIEMPO = { value: 0 };
export const BORDE = { color: { value: new THREE.Color(0xdff2ff) }, fuerza: { value: 0.28 } };

// Parchar un material una sola vez, con clave propia: los parches se
// encadenan (borde + brillo + arcoíris) sin pisarse.
function parchar(mat, clave, fn) {
  const antes = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { if (antes) antes(sh, r); fn(sh); };
  mat.userData.claves = (mat.userData.claves || '') + '|' + clave;
  const k = mat.userData.claves;
  mat.customProgramCacheKey = () => k;
  return mat;
}

export function conBorde(mat, fuerza = 1) {
  return parchar(mat, 'borde' + fuerza, (sh) => {
    sh.uniforms.uBordeColor = BORDE.color;
    sh.uniforms.uBordeFuerza = BORDE.fuerza;
    sh.uniforms.uBordeK = { value: fuerza };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBordeColor; uniform float uBordeFuerza; uniform float uBordeK;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float bordeF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uBordeColor * pow(bordeF, 3.0) * uBordeFuerza * uBordeK;`);
  });
}

// Luz propia tomada del color de cada vértice (ventanas, pantallas, llamas).
export function conBrillo(mat, k = 1.6) {
  return parchar(mat, 'brillo' + k, (sh) => {
    sh.uniforms.uBrillo = { value: k };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBrillo;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
        totalEmissiveRadiance += vColor.rgb * uBrillo;
        #endif`);
  });
}

// Arcoíris que corre por el cuerpo (mascotas arcoíris, la bomba cósmica).
export function conArcoiris(mat, fuerza = 1) {
  return parchar(mat, 'arcoiris' + fuerza, (sh) => {
    sh.uniforms.uT = TIEMPO;
    sh.uniforms.uArcoK = { value: fuerza };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosArco;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosArco = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uT; uniform float uArcoK; varying vec3 vPosArco;
        vec3 arco(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float lumArco = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 tono = arco(fract(vPosArco.y * 0.9 + vPosArco.x * 0.4 - uT * 0.35));
        diffuseColor.rgb = mix(diffuseColor.rgb, tono * (0.35 + lumArco * 1.4), uArcoK * step(0.08, lumArco));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.22 * uArcoK;`);
  });
}

const cache = new Map();
// Los materiales de clase para los modelos con color por vértice.
export function materialesDe(clave = 'base', { borde = 1 } = {}) {
  if (cache.has(clave)) return cache.get(clave);
  const std = (op) => conBorde(new THREE.MeshStandardMaterial({ vertexColors: true, ...op }), borde);
  const M = {
    plastico: std({ roughness: 0.48, metalness: 0 }),
    mate: std({ roughness: 0.88, metalness: 0 }),
    metal: std({ roughness: 0.3, metalness: 0.75 }),
    brillo: conBrillo(std({ roughness: 0.4, metalness: 0 }), 1.4),
    luz: conBrillo(std({ roughness: 0.4, metalness: 0 }), 5),
    vidrio: std({ roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }),
    dorado: std({ roughness: 0.22, metalness: 1 }),
    arcoiris: conArcoiris(std({ roughness: 0.35, metalness: 0.1 })),
  };
  cache.set(clave, M);
  return M;
}

// Un material liso de un color (con borde): para las partes del avatar y lo
// que no va fusionado.
const cacheLiso = new Map();
export function liso(color, op = {}) {
  const k = color + JSON.stringify(op);
  if (cacheLiso.has(k)) return cacheLiso.get(k);
  const { brillo, borde, ...resto } = op;
  const m = conBorde(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...resto }), borde ?? 1);
  if (brillo) { m.emissive.set(color); m.emissiveIntensity = brillo; }
  cacheLiso.set(k, m);
  return m;
}
