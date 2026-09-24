/* ============================================================================
   aeroplaza/js/modelos.js — los modelos 3D de Rezona (Tripo): casa, estación,
   tienda, hotel, tren, árbol, palmera, fuente, banco, farol y muebles.
   Cada uno se normaliza al cargar: se hornean las transformaciones en la
   geometría, se gira para que el frente mire a +z, se centra y se apoya en
   y = 0. Si un modelo no está (o no cargó) se devuelve null y cada lugar usa
   lo que ya dibujaba a mano: el juego anda igual.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* giro fijo de fábrica, para que el frente quede a +z (Tripo no respeta la
   orientación: se mide con pruebas/modelos.mjs, ver memoria/rezona.md) */
const GIRO = { casa: Math.PI * 1.5, estacion: Math.PI, tienda: Math.PI * 1.5, banco: Math.PI, 'm-sillon': Math.PI * 1.5, 'm-cama': Math.PI * 1.5, 'm-tele': Math.PI * 1.5 };
/* al hotel Tripo le puso un palito que cuelga abajo de la base: se corta lo que
   queda debajo del primer corte ancho del modelo */
const RECORTE = { hotel: true };
const NOMBRES = ['casa', 'estacion', 'tienda', 'hotel', 'tren', 'arbol', 'palmera', 'fuente', 'banco', 'farol', 'm-sofa', 'm-sillon', 'm-cama', 'm-tele', 'm-lampara'];
const MOD = {};   // nombre → { partes: [{ geo, mat }], tam }

async function uno(n) {
  const url = window.ARCHIVOS && window.ARCHIVOS[n + '.glb'];
  if (!url) return;
  const b = Uint8Array.from(atob(url.slice(url.indexOf('base64,') + 7)), (c) => c.charCodeAt(0)).buffer;
  const g = await new GLTFLoader().parseAsync(b, '');
  g.scene.updateMatrixWorld(true);
  const partes = [];
  g.scene.traverse((q) => {
    if (!q.isMesh) return;
    const geo = enFloat(q.geometry).applyMatrix4(q.matrixWorld);
    if (GIRO[n]) geo.rotateY(GIRO[n]);
    const mat = q.material;
    /* el brillo de juguete: poco áspero, mucho reflejo del cielo */
    mat.roughness = Math.min(mat.roughness ?? 0.3, 0.32); mat.metalness = 0; mat.envMapIntensity = 1.3;
    if (mat.map) mat.map.anisotropy = 4;
    partes.push({ geo, mat });
  });
  if (RECORTE[n]) recortar(partes);
  const caja = new THREE.Box3();
  for (const p of partes) { p.geo.computeBoundingBox(); caja.union(p.geo.boundingBox); }
  const c = caja.getCenter(new THREE.Vector3());
  for (const p of partes) { p.geo.translate(-c.x, -caja.min.y, -c.z); p.geo.computeBoundingSphere(); }
  MOD[n] = { partes, tam: caja.getSize(new THREE.Vector3()) };
}
/* quantize() guarda las posiciones en enteros normalizados: si se les aplica la
   escala del nodo así, se saturan. Primero todo a Float32 */
function enFloat(g0) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g0.attributes)) {
    const w = a.itemSize, arr = new Float32Array(a.count * w);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < w; c++) arr[i * w + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(arr, w));
  }
  if (g0.index) g.setIndex(g0.index.clone());
  return g;
}
function recortar(partes) {
  const caja = new THREE.Box3();
  for (const p of partes) { p.geo.computeBoundingBox(); caja.union(p.geo.boundingBox); }
  const B = 64, alto = caja.max.y - caja.min.y, ancho = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z);
  const mn = new Float32Array(B).fill(1e9), mx = new Float32Array(B).fill(-1e9);
  for (const { geo } of partes) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const b = Math.min(B - 1, Math.floor((P.getY(i) - caja.min.y) / alto * B)); mn[b] = Math.min(mn[b], P.getX(i)); mx[b] = Math.max(mx[b], P.getX(i)); } }
  let b0 = 0; while (b0 < B - 1 && !(mx[b0] - mn[b0] > ancho * 0.3)) b0++;
  const piso = caja.min.y + b0 / B * alto - alto * 0.005;
  for (const p of partes) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo, P = g.attributes.position, quedan = [];
    for (let t = 0; t < P.count; t += 3) if ((P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3 >= piso) quedan.push(t);
    const nueva = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) {
      const w = a.itemSize, arr = new Float32Array(quedan.length * 3 * w);
      quedan.forEach((t, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < w; c++) arr[(j * 3 + v) * w + c] = a.array[(t + v) * w + c]; });
      nueva.setAttribute(k, new THREE.BufferAttribute(arr, w));
    }
    p.geo = nueva;
  }
}
export async function cargarModelos() {
  await Promise.all(NOMBRES.map((n) => uno(n).catch((e) => console.warn('modelo', n, 'no cargó', e))));
  return Object.keys(MOD);
}
export const hay = (n) => !!MOD[n];
export const tamDe = (n) => MOD[n]?.tam.clone();

/* una copia (comparte geometría y material) medida por alto, por ancho (lo más
   ancho en x o z) o por una escala directa */
export function modelo(n, { alto, ancho, escala } = {}) {
  const M = MOD[n]; if (!M) return null;
  const k = escala ?? (alto ? alto / M.tam.y : ancho ? ancho / Math.max(M.tam.x, M.tam.z) : 1);
  const g = new THREE.Group(), o = new THREE.Group(); o.scale.setScalar(k); g.add(o);
  for (const p of M.partes) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; o.add(m); }
  g.userData.tam = M.tam.clone().multiplyScalar(k); g.userData.k = k;
  return g;
}

/* muchas copias en una sola llamada de dibujo: lugares [[x, y, z, escala, giro]],
   alto: la altura con escala 1. tintes: colores que multiplican la textura */
export function instancias(n, lugares, { alto = 1, tintes = null } = {}) {
  const M = MOD[n]; if (!M || !lugares.length) return null;
  const k = alto / M.tam.y, g = new THREE.Group();
  const T = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), P = new THREE.Vector3(), col = new THREE.Color();
  for (const p of M.partes) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, lugares.length);
    lugares.forEach(([x, y, z, esc = 1, rot = 0], i) => {
      im.setMatrixAt(i, T.compose(P.set(x, y, z), q.setFromEuler(e.set(0, rot, 0)), s.setScalar(esc * k)));
      if (tintes) im.setColorAt(i, col.set(tintes[i % tintes.length]));
    });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }
  return g;
}

/* medir el modelo (en sus unidades, sin escalar): un rayo para abajo desde
   (fx, fy, fz) —fracciones del medio ancho, del alto y del medio fondo— da la
   altura de lo que pisa (el andén, el asiento del banco, el borde de la fuente) */
const rc = new THREE.Raycaster(), abajo = new THREE.Vector3(0, -1, 0);
export function rayo(n, fx, fy, fz) {
  const M = MOD[n]; if (!M) return 0;
  if (!M.mallas) { const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); M.mallas = M.partes.map((p) => new THREE.Mesh(p.geo, m)); }
  rc.set(new THREE.Vector3(fx * M.tam.x / 2, fy * M.tam.y, fz * M.tam.z / 2), abajo);
  const h = rc.intersectObjects(M.mallas, false)[0];
  return h ? h.point.y : 0;
}
/* el centro de lo más alto (la bocha del farol, la lámpara) */
export function cima(n, parte = 0.06) {
  const M = MOD[n]; if (!M) return null;
  const c = new THREE.Vector3(); let k = 0; const y0 = M.tam.y * (1 - parte);
  for (const { geo } of M.partes) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > y0) { c.x += P.getX(i); c.y += P.getY(i); c.z += P.getZ(i); k++; } }
  return k ? c.divideScalar(k) : new THREE.Vector3(0, M.tam.y, 0);
}
