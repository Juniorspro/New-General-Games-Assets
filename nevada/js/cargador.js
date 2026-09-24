/* ============================================================================
   nevada/js/cargador.js — de dónde salen las texturas y los modelos.
   En el HTML único vienen como data: URI en window.ARCHIVOS (sin fetch, así
   abre con doble clic); servido, se piden a datos/.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ARCH = (typeof window !== 'undefined' && window.ARCHIVOS) || {};
const url = (nombre) => ARCH[nombre] || `datos/${nombre}`;

const texLoader = new THREE.TextureLoader();
export function textura(nombre, { repetir = false, color = true } = {}) {
  return new Promise((ok) => {
    texLoader.load(url(nombre), (t) => {
      if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      ok(t);
    }, undefined, () => { console.warn('no cargó', nombre); ok(null); });
  });
}

const gltfLoader = new GLTFLoader();
/* un GLB: si viene como data: URI se decodifica acá (atob sobre lo que sigue a
   "base64,": con la cabecera adentro, atob revienta) y se le pasa el buffer a
   parse; si no, se pide el archivo */
export function modelo(nombre) {
  return new Promise((ok) => {
    const u = url(nombre);
    const listo = (g) => ok(g);
    const falla = (e) => { console.warn('no cargó', nombre, e); ok(null); };
    if (u.startsWith('data:')) {
      const b = atob(u.slice(u.indexOf('base64,') + 7));
      const buf = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) buf[i] = b.charCodeAt(i);
      gltfLoader.parse(buf.buffer, '', listo, falla);
    } else gltfLoader.load(u, listo, undefined, falla);
  });
}
