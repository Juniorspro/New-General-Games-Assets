/* El pasto del terreno de Unity (los "detail" pintados: dos pastos y un helecho): carteles que miran a la
   cámara y se mecen, con el color entre "sano" y "seco" de cada capa, solo alrededor del jugador
   (Unity los dibuja hasta 80 m; con esta niebla alcanza menos). Se rehace cuando el jugador se mueve. */
import * as THREE from 'three';
import { traer } from './archivos.js';

export async function crearPasto(R, S, escena, cfg) {
  const T = S.terreno, N = S.N.find((n) => n.terreno)?.terreno;
  if (!T || !N?.pasto?.capas?.length) return null;
  let den;
  try { den = new Uint8Array(await traer(R.base + `datos/pasto-${N.id}.bin`, 'arrayBuffer')); } catch { return null; }
  const res = N.pasto.res, celdaX = T.ancho / res, celdaZ = T.largo / res;
  const grupo = new THREE.Group(); grupo.name = 'pasto'; escena.add(grupo);
  const uT = { uTiempo: { value: 0 } };
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const capas = N.pasto.capas.map((c) => {
    const map = c.tex ? R.textura(c.tex) : null;
    if (map) { map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; }
    const mat = R.conBrillo(new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide }));
    const brillo = mat.onBeforeCompile;
    mat.onBeforeCompile = (s) => {
      brillo(s);
      s.uniforms.uTiempo = uT.uTiempo;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTiempo;')
        .replace('#include <project_vertex>', `
          vec3 cen = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          float an = length( instanceMatrix[0].xyz ), al = length( instanceMatrix[1].xyz );
          vec3 der = normalize( vec3( viewMatrix[0][0], 0.0, viewMatrix[2][0] ) );
          float ola = sin( uTiempo * 1.6 + cen.x * 0.35 + cen.z * 0.27 ) * 0.5 + sin( uTiempo * 2.7 + cen.z * 0.6 ) * 0.25;
          vec3 wp = cen + der * position.x * an + vec3( 0.0, position.y * al, 0.0 ) + vec3( 0.15, 0.0, 0.1 ) * ola * position.y * al;
          vec4 mvPosition = viewMatrix * vec4( wp, 1.0 );
          gl_Position = projectionMatrix * mvPosition;`);
    };
    mat.customProgramCacheKey = () => 'pasto';
    const MAX = 6000;
    const im = new THREE.InstancedMesh(geo, mat, MAX);
    im.count = 0; im.frustumCulled = false; im.name = 'pasto';
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    grupo.add(im);
    return { c, im, MAX, sano: new THREE.Color(...c.sano.slice(0, 3)), seco: new THREE.Color(...c.seco.slice(0, 3)) };
  });
  const hash = (x, z, s) => { let h = (x * 374761393 + z * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), esc = new THREE.Vector3(), col = new THREE.Color();
  const ultimo = new THREE.Vector3(1e9, 0, 1e9);
  function actualizar(p, forzar) {
    if (!forzar && Math.hypot(p.x - ultimo.x, p.z - ultimo.z) < 3) return;
    ultimo.copy(p);
    const radio = cfg().radio, tope = cfg().max;
    const i0 = Math.max(0, Math.floor((p.x - radio - T.T0.x) / celdaX)), i1 = Math.min(res - 1, Math.floor((p.x + radio - T.T0.x) / celdaX));
    const j0 = Math.max(0, Math.floor((T.T0.z - p.z - radio) / celdaZ)), j1 = Math.min(res - 1, Math.floor((T.T0.z - p.z + radio) / celdaZ));
    capas.forEach((K, l) => {
      let n = 0;
      const lim = Math.min(K.MAX, tope);
      if (radio > 0) fuera: for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = den[l * res * res + j * res + i];
        if (!d) continue;
        for (let k = 0; k < Math.min(d, 3); k++) {
          const x = T.T0.x + (i + hash(i, j, k + l * 31)) * celdaX, z = T.T0.z - (j + hash(j, i, k + 7 + l * 31)) * celdaZ;
          const dd = Math.hypot(x - p.x, z - p.z);
          if (dd > radio) continue;
          const borde = Math.min(1, (radio - dd) / 5);
          const c = K.c, s = hash(i, j, k + 13);
          const w = (c.ancho[0] + (c.ancho[1] - c.ancho[0]) * s) * borde, h = (c.alto[0] + (c.alto[1] - c.alto[0]) * hash(i, j, k + 29)) * borde;
          pos.set(x, T.alturaEn(x, z) - 0.03, z); esc.set(w, h, 1);
          m4.compose(pos, q.identity(), esc);
          K.im.setMatrixAt(n, m4);
          col.copy(K.sano).lerp(K.seco, Math.max(0, Math.sin(x * c.ruido * 0.7) * Math.cos(z * c.ruido * 0.9)));
          K.im.setColorAt(n, col);
          if (++n >= lim) break fuera;
        }
      }
      K.im.count = n; K.im.instanceMatrix.needsUpdate = true; if (K.im.instanceColor) K.im.instanceColor.needsUpdate = true;
    });
  }
  return { actualizar, tick: (t) => { uT.uTiempo.value = t; }, liberar: () => { escena.remove(grupo); for (const K of capas) { K.im.dispose(); K.im.material.dispose(); } geo.dispose(); } };
}
