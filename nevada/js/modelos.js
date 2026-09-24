/* ============================================================================
   nevada/js/modelos.js — el auto y los tres tigres, sacados de Rezona (Tripo)
   y ajustados acá: medidas de verdad, para dónde miran, materiales y rig.
   Medido en pruebas/ver_modelos.mjs:
   - auto: el largo en X con el frente hacia +X; se gira −90° para que mire a +Z;
   - tigre parado: el largo en Z, la cabeza hacia +Z;
   - tigre echado: el largo en Z con la cabeza en −Z, la cara girada hacia +X;
   - tigre que ruge: cabeza y hombros, la cara hacia +X.
   ========================================================================== */
import * as THREE from 'three';
import { modelo } from './cargador.js';
import { mallaPrincipal, rigTigre, rigEchado } from './rig.js';
import { GLSL_RUIDO } from './ruido.js';

export const LARGO_AUTO = 4.6;      // metros (un superdeportivo de motor central)
export const ALTO_TIGRE = 1.12;     // de las patas a las orejas

/* LOS GLB VIENEN CUANTIZADOS (KHR_mesh_quantization): las posiciones son
   enteros de 16 bits y la escala para volver a metros está en la matriz del
   nodo. Girar o escalar esos enteros los recorta contra ±1 y el auto queda
   hecho una caja. Así que primero todo pasa a Float32 con la matriz del nodo
   horneada, y recién después se mide. */
function aFloat(malla) {
  malla.updateWorldMatrix(true, false);
  const g0 = malla.geometry, g = new THREE.BufferGeometry();
  for (const [nombre, a] of Object.entries(g0.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(nombre, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (g0.index) g.setIndex(Array.from(g0.index.array));
  g.applyMatrix4(malla.matrixWorld);
  // la malla queda colgada de la escena del GLB, sin transformaciones propias
  malla.geometry = g;
  let p = malla.parent;
  while (p) { p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); p.scale.set(1, 1, 1); p.updateMatrix(); p = p.parent; }
}

/* lleva la malla a metros: la gira, la escala y la apoya en y = 0 con el centro en x = z = 0 */
function normalizar(malla, giroY, escala) {
  aFloat(malla);
  const g = malla.geometry;
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(giroY));
  g.scale(escala, escala, escala);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox(); g.computeBoundingSphere();
  malla.position.set(0, 0, 0); malla.rotation.set(0, 0, 0); malla.scale.set(1, 1, 1);
  return g.boundingBox.getSize(new THREE.Vector3());
}

/* ============================================================================ el auto */
export async function cargarAuto() {
  const gltf = await modelo('auto.glb');
  if (!gltf) return null;
  const orig = mallaPrincipal(gltf.scene);
  const s0 = new THREE.Box3().setFromObject(orig).getSize(new THREE.Vector3());
  const tam = normalizar(orig, -Math.PI / 2, LARGO_AUTO / Math.max(s0.x, s0.z));
  const grupo = new THREE.Group();
  const carroceria = new THREE.Group();    // lo que se hamaca con la suspensión
  grupo.add(carroceria);
  carroceria.add(orig);

  const m0 = orig.material;
  const mat = new THREE.MeshPhysicalMaterial({
    map: m0.map, normalMap: m0.normalMap, metalnessMap: m0.metalnessMap, roughnessMap: m0.roughnessMap,
    metalness: 1, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.0,
    normalScale: new THREE.Vector2(1, 1),
  });
  const U = { uFaros: { value: 1 }, uTraseras: { value: 0.35 }, uNieve: { value: 1 }, uLargo: { value: tam.z }, uAlto: { value: tam.y } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vNMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvNMundo = normalize(mat3(modelMatrix) * normal);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vNMundo;\nuniform float uFaros, uTraseras, uNieve, uLargo, uAlto;\n' + GLSL_RUIDO)
      /* qué es cada cosa, por el color de la textura: el vidrio es gris
         azulado, la pintura es malva, las gomas y el carbono son oscuros */
      .replace('#include <map_fragment>', /* glsl */`
        #include <map_fragment>
        vec3 cT = diffuseColor.rgb;
        float lumT = dot(cT, vec3(0.299, 0.587, 0.114));
        float satT = max(cT.r, max(cT.g, cT.b)) - min(cT.r, min(cT.g, cT.b));
        float vidrio = smoothstep(0.004, 0.02, cT.b - cT.r) * step(lumT, 0.5) * step(0.45, vObj.y / uAlto);
        float oscuro = 1.0 - smoothstep(0.02, 0.06, lumT);
        float bajo = 1.0 - smoothstep(0.22, 0.34, vObj.y / uAlto);
        float frente = smoothstep(0.34, 0.43, vObj.z / uLargo);
        float atras = smoothstep(-0.36, -0.46, vObj.z / uLargo);
        float luzBlanca = smoothstep(0.42, 0.62, lumT) * (1.0 - smoothstep(0.08, 0.16, satT)) * frente * (1.0 - bajo);
        float luzRoja = smoothstep(0.1, 0.2, cT.r - max(cT.g, cT.b)) * atras;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.7), vidrio);
        /* la nieve que se juntó arriba: capó, techo, alerón, con manchones */
        float nv = smoothstep(0.8, 0.95, vNMundo.y) * smoothstep(0.55, 0.85, vfbm(vObj.xz * 4.0) + vruido(vObj.xz * 23.0) * 0.3) * uNieve * 0.85;
        nv *= 1.0 - vidrio * 0.65;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.97), nv);
      `)
      /* la pintura: metalizada pero con su color (Tripo la dejó espejo puro,
         que en la nieve se ve blanca y se pierde) */
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor * 0.55, 0.0, max(vidrio, max(nv, bajo * oscuro)));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(max(roughnessFactor, 0.3), 0.04, vidrio);\nroughnessFactor = mix(roughnessFactor, 0.85, max(nv, bajo * oscuro));')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= (1.0 - nv) * (1.0 - bajo * oscuro);\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.98, 0.95) * luzBlanca * uFaros * 9.0 + vec3(1.0, 0.04, 0.02) * luzRoja * uTraseras * 7.0;');
  };
  orig.material = mat;
  orig.castShadow = true; orig.receiveShadow = true;

  /* las ruedas se separan de la carrocería para que puedan girar */
  const ruedas = separarRuedas(orig, tam, mat);
  ruedas.forEach((r) => grupo.add(r));

  /* una sombra de contacto: lo que la sombra del sol no alcanza a oscurecer abajo del auto */
  grupo.add(sombraContacto(tam.x * 1.05, tam.z * 1.02, 0.62));

  /* el brillo rojo en la nieve cuando se prenden las luces de atrás */
  const reflejo = new THREE.PointLight('#ff2a1a', 0, 5, 2);
  reflejo.position.set(0, 0.6, -tam.z / 2 - 0.4);
  grupo.add(reflejo);
  /* los faros sobre la nieve de adelante: bajos y apuntados al piso, que si
     no le queman la cara al tigre cuando camina por delante del auto */
  const faro = new THREE.SpotLight('#eef3ff', 0, 22, 0.42, 0.65, 1.5);
  faro.position.set(0, 0.6, tam.z / 2 - 0.2); faro.target.position.set(0, 0, tam.z / 2 + 6);
  grupo.add(faro, faro.target);

  const mats = [mat];
  return {
    grupo, carroceria, malla: orig, ruedas, tam, uniformes: U, reflejo, faro, mats,
    rodar(dist) { ruedas.forEach((r) => { r.rotation.x = dist / r.userData.radio; }); },
    luces(faros, traseras) { U.uFaros.value = faros; U.uTraseras.value = traseras; reflejo.intensity = traseras * 2.2; faro.intensity = faros * 2.4; },
  };
}

/* El modelo es de una sola pieza, así que las ruedas se recortan a mano.
   1. Dónde anda cada una: lo que toca el piso en cada esquina (a grandes
      rasgos: el paragolpes también baja hasta ahí).
   2. El centro exacto: una rueda es un montón de anillos con el mismo centro
      (la maza, la llanta, la goma). Se prueba cada centro posible y gana el que
      junta las distancias en anillos más finos. Como la goma apoya en el
      piso, el radio es la altura del centro.
   3. Sus triángulos: los que tienen los tres vértices adentro de la goma, del
      lado de afuera del auto.
   Las posiciones de la carrocería no se tocan: la rueda se arma con una copia
   de sus vértices, corrida para que gire sobre su centro. */
function separarRuedas(malla, tam, mat) {
  const g = malla.geometry, pos = g.attributes.position, idx = g.index;
  const W = tam.x, v = new THREE.Vector3();
  const esquinas = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => ({ sx, sz, zs: [] }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > 0.06 || Math.abs(v.x) < W / 2 - 0.42) continue;
    esquinas.find((q) => Math.sign(v.x) === q.sx && Math.sign(v.z) === q.sz).zs.push(v.z);
  }
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const res = [];
  const quitar = new Uint8Array(idx.count / 3);
  for (const e of esquinas) {
    if (e.zs.length < 5) continue;
    const z0 = med(e.zs);
    const zs = [], ys = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (Math.sign(v.x) === e.sx && Math.abs(v.x) > W / 2 - 0.36 && Math.abs(v.z - z0) < 0.6 && v.y < 0.9) { zs.push(v.z); ys.push(v.y); }
    }
    const { zc, yc } = centroDeAnillos(zs, ys, z0);
    const radio = yc, corte = yc + 0.005;
    const dentro = (k) => { v.fromBufferAttribute(pos, k); return Math.sign(v.x) === e.sx && Math.abs(v.x) > W / 2 - 0.5 && Math.hypot(v.z - zc, v.y - yc) < corte; };
    const tri = [];
    for (let t = 0; t < idx.count / 3; t++) {
      const a = idx.getX(t * 3), b = idx.getX(t * 3 + 1), c = idx.getX(t * 3 + 2);
      if (dentro(a) && dentro(b) && dentro(c)) { tri.push(a, b, c); quitar[t] = 1; }
    }
    if (tri.length < 300) continue;
    let xc = 0; for (const k of tri) xc += pos.getX(k); xc /= tri.length;
    const centro = [xc, yc, zc];
    // copia compacta: solo los vértices que usa la rueda, con el centro en el origen
    const mapa = new Map(), ind = [], datos = {};
    for (const nombre of Object.keys(g.attributes)) datos[nombre] = [];
    for (const k of tri) {
      if (!mapa.has(k)) {
        mapa.set(k, mapa.size);
        for (const [nombre, a] of Object.entries(g.attributes)) {
          for (let c = 0; c < a.itemSize; c++) datos[nombre].push(a.getComponent(k, c) - (nombre === 'position' ? centro[c] : 0));
        }
      }
      ind.push(mapa.get(k));
    }
    const nueva = new THREE.BufferGeometry();
    for (const [nombre, a] of Object.entries(g.attributes)) nueva.setAttribute(nombre, new THREE.Float32BufferAttribute(datos[nombre], a.itemSize));
    nueva.setIndex(ind);
    const r = new THREE.Mesh(nueva, mat);
    r.position.set(xc, yc, zc);
    r.castShadow = true;
    r.userData.radio = radio;
    res.push(r);
  }
  /* la carrocería sin las ruedas */
  if (res.length) {
    const quedan = [];
    for (let t = 0; t < idx.count / 3; t++) if (!quitar[t]) quedan.push(idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2));
    g.setIndex(quedan);
  }
  return res;
}

/* el centro (z, y) donde las distancias de los puntos se amontonan en anillos:
   se puntúa con la suma de los cuadrados del histograma, primero grueso y
   después fino alrededor del mejor */
function centroDeAnillos(zs, ys, z0) {
  const n = zs.length, h = new Uint32Array(128);
  const puntaje = (zc, yc, paso) => {
    h.fill(0);
    for (let i = 0; i < n; i++) { const d = Math.hypot(zs[i] - zc, ys[i] - yc) / paso; if (d < 128) h[d | 0]++; }
    let s = 0; for (let k = 0; k < 128; k++) s += h[k] * h[k];
    return s;
  };
  let mejor = { s: -1, zc: z0, yc: 0.35 };
  for (let zc = z0 - 0.3; zc <= z0 + 0.3; zc += 0.01) for (let yc = 0.22; yc <= 0.5; yc += 0.01) {
    const s = puntaje(zc, yc, 0.006); if (s > mejor.s) mejor = { s, zc, yc };
  }
  const { zc: z1, yc: y1 } = mejor; mejor = { s: -1, zc: z1, yc: y1 };
  for (let zc = z1 - 0.012; zc <= z1 + 0.0121; zc += 0.002) for (let yc = y1 - 0.012; yc <= y1 + 0.0121; yc += 0.002) {
    const s = puntaje(zc, yc, 0.004); if (s > mejor.s) mejor = { s, zc, yc };
  }
  return mejor;
}

function sombraContacto(ancho, largo, fuerza) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, `rgba(20,24,30,${fuerza})`); gr.addColorStop(0.55, `rgba(20,24,30,${fuerza * 0.55})`); gr.addColorStop(1, 'rgba(20,24,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho * 1.25, largo * 1.18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1;
  return m;
}

/* ============================================================================ los tigres */
/* el pelaje: el mismo color de Tripo con un brillo suave de pelo en los bordes
   (sheen), que es lo que le saca el aspecto de plástico */
function pelaje(m0) {
  const m = new THREE.MeshPhysicalMaterial({ map: m0.map, normalMap: m0.normalMap, roughness: 0.9, metalness: 0, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#dfe6f0'), envMapIntensity: 0.7 });
  m.normalScale.set(0.8, 0.8);
  return m;
}

export async function cargarTigres() {
  const [gParado, gEchado, gRuge] = await Promise.all([modelo('tigre-parado.glb'), modelo('tigre-echado.glb'), modelo('tigre-ruge.glb')]);
  const res = {};

  if (gParado) {
    const malla = mallaPrincipal(gParado.scene);
    const s0 = new THREE.Box3().setFromObject(malla).getSize(new THREE.Vector3());
    const esc = ALTO_TIGRE / s0.y;
    const tam = normalizar(malla, 0, esc);
    malla.material = pelaje(malla.material);
    const grupo = new THREE.Group(); grupo.add(malla);
    const rig = rigTigre(malla);
    grupo.add(sombraContacto(tam.x * 1.6, tam.z * 0.95, 0.5));
    res.parado = { grupo, rig, tam, mats: [rig.piel.material] };
  }
  if (gEchado) {
    const malla = mallaPrincipal(gEchado.scene);
    const s0 = new THREE.Box3().setFromObject(malla).getSize(new THREE.Vector3());
    const tam = normalizar(malla, 0, (ALTO_TIGRE * 0.8) / s0.y);
    malla.material = pelaje(malla.material);
    const grupo = new THREE.Group(); grupo.add(malla);
    /* la cabeza: lo más alto de la punta de −z (medido en la hoja de pruebas) */
    const g = malla.geometry, p = g.attributes.position, v = new THREE.Vector3();
    const c = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.z < -tam.z * 0.22 && v.y > tam.y * 0.55) { c.add(v); n++; } }
    if (n) c.divideScalar(n);
    const rig = rigEchado(malla, { centroCabeza: c, radioCabeza: tam.y * 0.5, cuello: new THREE.Vector3(c.x, c.y - tam.y * 0.2, c.z + tam.z * 0.12) });
    grupo.add(sombraContacto(tam.x * 1.3, tam.z * 1.05, 0.55));
    res.echado = { grupo, rig, tam, cabeza: c, mats: [rig.piel.material] };
  }
  if (gRuge) {
    const malla = mallaPrincipal(gRuge.scene);
    const s0 = new THREE.Box3().setFromObject(malla).getSize(new THREE.Vector3());
    const tam = normalizar(malla, -Math.PI / 2, 1.5 / Math.max(s0.x, s0.z));   // la cara pasa de +x a +z
    malla.material = pelaje(malla.material);
    malla.castShadow = true;
    const grupo = new THREE.Group(); grupo.add(malla);
    res.ruge = { grupo, malla, tam, mats: [malla.material] };
  }
  return res;
}

/* ============================================================================ el modo arcilla */
/* El desglose de Blender: cada pieza de un color pastel distinto sobre fondo
   verde oliva. Las mallas de Tripo son de una sola pieza, así que las "piezas"
   son celdas de Voronoi en el espacio del objeto: cada punto toma el color de
   la semilla más cercana. Se ven manchones grandes, como en el desglose. */
const PASTELES = ['#d9a3bd', '#a9c77a', '#b8a8dc', '#86bcb4', '#d8c894', '#9fb9dd', '#e0b39a', '#c3d98f'];
export function materialArcilla(semilla, tamano) {
  const semillas = [];
  let s = semilla;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 28; i++) semillas.push(new THREE.Vector3((r() - 0.5) * tamano.x, r() * tamano.y, (r() - 0.5) * tamano.z));
  const colores = semillas.map((_, i) => new THREE.Color(PASTELES[(i * 5 + semilla) % PASTELES.length]));
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSem = { value: semillas }; sh.uniforms.uCol = { value: colores };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; uniform vec3 uSem[28]; uniform vec3 uCol[28];')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat mejor = 1e9; vec3 cc = vec3(1.0);\nfor (int i = 0; i < 28; i++) { float d = distance(vObj, uSem[i]); if (d < mejor) { mejor = d; cc = uCol[i]; } }\ndiffuseColor.rgb *= cc;');
  };
  return m;
}
