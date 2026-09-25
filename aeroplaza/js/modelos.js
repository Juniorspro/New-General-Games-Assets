/* ============================================================================
   aeroplaza/js/modelos.js — las construcciones por nombre: casa, estación,
   tienda, hotel, tren, árbol, palmera, fuente, banco, farol y muebles.
   Se arman en código (construcciones.js, copiando las referencias de Rezona):
   cada una se hace una sola vez y las copias comparten geometría y material.
   El frente mira a +z y la base está en y = 0.
   ========================================================================== */
import * as THREE from 'three';
import { CONSTRUIR } from './construcciones.js';

const MOD = {};   // nombre → el original (un Group con las piezas fundidas)
const base = (n) => MOD[n] || (MOD[n] = CONSTRUIR[n]());
/* nada que bajar: todo se arma acá */
export async function cargarModelos() { return Object.keys(CONSTRUIR); }
export const hay = (n) => !!CONSTRUIR[n];
export const tamDe = (n) => base(n).userData.tam.clone();

/* una copia medida por alto, por ancho (lo más ancho en x o z) o por escala.
   Las medidas propias (el andén, el asiento, la bocha del farol…) vienen ya
   escaladas en userData; la pantalla de la tele, en userData.pantalla */
export function modelo(n, { alto, ancho, escala } = {}) {
  if (!CONSTRUIR[n]) return null;
  const B = base(n), T = B.userData.tam;
  const k = escala ?? (alto ? alto / T.y : ancho ? ancho / Math.max(T.x, T.z) : 1);
  const g = new THREE.Group(), o = B.clone(true); o.scale.setScalar(k); g.add(o);
  g.userData.tam = T.clone().multiplyScalar(k); g.userData.k = k;
  const esc = (v) => typeof v === 'number' ? v * k : v?.isVector3 ? v.clone().multiplyScalar(k)
    : Array.isArray(v) ? (v.every((q) => typeof q === 'number') ? v.map((q, i) => (i < 3 ? q * k : q)) : v.map(esc)) : v;   // [x, z, y, giro]: el giro no se escala
  for (const [c, v] of Object.entries(B.userData.medidas || {})) g.userData[c] = esc(v);
  /* las piezas con nombre (se animan): la pantalla de la tele, el rotor del molino, el haz del faro, las agujas del reloj */
  o.traverse((q) => { if (q.name) g.userData[q.name] = q; });
  return g;
}

/* muchas copias en una sola llamada de dibujo por material: lugares
   [[x, y, z, escala, giro]], alto: la altura con escala 1. tintes: colores que
   multiplican el color de cada copia */
export function instancias(n, lugares, { alto = 1, tintes = null } = {}) {
  if (!CONSTRUIR[n] || !lugares.length) return null;
  const B = base(n), k = alto / B.userData.tam.y, g = new THREE.Group();
  const T = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), P = new THREE.Vector3(), col = new THREE.Color();
  for (const p of B.children) {
    if (!p.isMesh) continue;
    const im = new THREE.InstancedMesh(p.geometry, p.material, lugares.length);
    lugares.forEach(([x, y, z, esc = 1, rot = 0], i) => {
      im.setMatrixAt(i, T.compose(P.set(x, y, z), q.setFromEuler(e.set(0, rot, 0)), s.setScalar(esc * k)));
      if (tintes) im.setColorAt(i, col.set(tintes[i % tintes.length]));
    });
    im.castShadow = p.castShadow; im.receiveShadow = true; im.renderOrder = p.renderOrder;
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}
