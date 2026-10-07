/* Arma en three.js una escena de Unity 3.5-4.0 exportada por exportar.py:
   nodos con sus mallas (las fijas se juntan por material y celda), personajes con huesos, textos 3D,
   luces (un grupo chico de luces de three que toman las más cercanas), fuentes de sonido, colliders,
   disparadores, partículas, terreno con árboles y pasto, agua.
   Unity 4: el padre apagado apaga a los hijos (en 3.5 cada objeto se prendía solo).
   El cielo (Skybox de 6 caras) va como fondo cúbico. */
import * as THREE from 'three';
import { Animador } from './anim.js';
import { url, traer as traerArch } from './archivos.js';
import { D } from './guardado.js';

THREE.ColorManagement.enabled = false;
{ // Lambert sin 1/π y la caída de luz de Unity: 1/(1+25·(d/r)²), que se apaga al llegar al rango
  const C = THREE.ShaderChunk;
  C.common = C.common.replace('return RECIPROCAL_PI * diffuseColor;', 'return diffuseColor;');
  C.lights_pars_begin = C.lights_pars_begin
    .replace('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );',
      'float rr = cutoffDistance > 0.0 ? lightDistance / cutoffDistance : 0.0; rr *= rr; float distanceFalloff = 1.0 / ( 1.0 + 25.0 * rr );')
    .replace('distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );', 'distanceFalloff *= saturate( ( 1.0 - rr ) * 5.0 );');
}

/* ---------- lo común a todas las escenas: mallas, texturas, materiales */
export async function cargarComun(base, renderer, progreso = () => {}) {
  const traer = (f, tipo) => traerArch(base + f, tipo);
  const [C, BIN] = await Promise.all([traer('datos/comun.json', 'json'), traer('datos/mallas.bin', 'arrayBuffer')]);
  const subs = {}, textos = [];
  progreso(0.5);
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const cargador = new THREE.TextureLoader();
  const T = {}, G = {}, MATS = {};
  function textura(id) {
    if (T[id] !== undefined) return T[id];
    const t = C.texs[id];
    if (!t || !t.arch) return (T[id] = null);
    // (los carteles con texto tienen su versión traducida en t.l)
    const tx = cargador.load(url(base + 'datos/' + (t.l?.[D.idioma] || t.arch)));
    tx.userData.id = id;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = aniso;
    tx.userData.alfa = t.alfa;
    return (T[id] = tx);
  }
  function geometria(id) {
    if (G[id]) return G[id];
    const m = C.mallas[id];
    if (m?.falta && /^(Plane|Cube)$/.test(m.nombre || '')) return (G[id] = primitiva(m.nombre));
    if (!m || m.falta || !m.nv) return (G[id] = null);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BIN, m.pos, m.nv * 3), 3));
    if (m.nor !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(BIN, m.nor, m.nv * 3), 3));
    if (m.nor8 !== undefined) g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(BIN, m.nor8, m.nv * 4), 4), 3, 0, true));
    if (m.uv !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(BIN, m.uv, m.nv * 2), 2));
    if (m.uv16 !== undefined) g.setAttribute('uv', new THREE.Float16BufferAttribute(new Uint16Array(BIN, m.uv16, m.nv * 2), 2));
    if (m.col !== undefined) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(BIN, m.col, m.nv * 4), 4, true));
    if (m.pesos !== undefined) g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(BIN, m.pesos, m.nv * 4), 4));
    if (m.pesos8 !== undefined) g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(BIN, m.pesos8, m.nv * 4), 4, true));
    if (m.huesos !== undefined) g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(BIN, m.huesos, m.nv * 4), 4));
    if (m.huesos8 !== undefined) g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(BIN, m.huesos8, m.nv * 4), 4));
    const total = m.subs.reduce((a, s) => a + s[1], 0);
    const I = m.i32 ? new Uint32Array(total) : new Uint16Array(total);
    let o = 0;
    m.subs.forEach(([off, n], k) => { I.set(m.i32 ? new Uint32Array(BIN, off, n) : new Uint16Array(BIN, off, n), o); g.addGroup(o, n, k); o += n; });
    g.setIndex(new THREE.BufferAttribute(I, 1));
    if (m.nor === undefined && m.nor8 === undefined && !id.endsWith('c')) g.computeVertexNormals();
    g.computeBoundingSphere();
    g.userData.id = id;
    return (G[id] = g);
  }
  const uMundo = { uBrillo: { value: 1 } };
  function conBrillo(mat) {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uBrillo = uMundo.uBrillo;
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBrillo;')
        .replace('#include <opaque_fragment>', 'outgoingLight *= uBrillo;\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'brillo';
    return mat;
  }
  function material(id, opciones = {}) {
    const clave = id + (opciones.piel ? '|piel' : '');
    if (MATS[clave]) return MATS[clave];
    const m = C.mats[id];
    if (!m || m.falta) return (MATS[clave] = conBrillo(new THREE.MeshLambertMaterial({ color: 0x808080 })));
    const c = m.c._Color || m.c._TintColor || [1, 1, 1, 1];
    const tx = m.tex._MainTex;
    let map = tx ? textura(tx.t) : null;
    if (map && (tx.esc[0] !== 1 || tx.esc[1] !== 1 || tx.off[0] || tx.off[1])) { map = map.clone(); map.repeat.set(tx.esc[0], tx.esc[1]); map.offset.set(tx.off[0], tx.off[1]); }
    const color = new THREE.Color(c[0], c[1], c[2]), sh = m.shader;
    let mat;
    if (sh === 'Particle Add') mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: c[3] * 2 });
    else if (sh === 'Particle Alpha Blend') mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), map, transparent: true, depthWrite: false, opacity: Math.min(1, c[3] * 2) });
    else if (sh.startsWith('Unlit')) mat = new THREE.MeshBasicMaterial({ color, map, transparent: sh === 'Unlit-Alpha', alphaTest: sh === 'Unlit-Alpha' ? 0.05 : 0 });
    else if (sh.startsWith('Illumin')) mat = conBrillo(new THREE.MeshLambertMaterial({ color, map, emissive: color, emissiveMap: map }));
    else if (sh === 'Alpha-Diffuse') mat = conBrillo(new THREE.MeshLambertMaterial({ color, map, transparent: true, opacity: c[3], depthWrite: c[3] > 0.9 }));
    else if (sh === 'TreeSoftOcclusionLeaves' || sh === 'TreeCreatorLeaves') mat = conBrillo(new THREE.MeshLambertMaterial({ color, map, alphaTest: 0.45, side: THREE.DoubleSide }));
    else if (sh.startsWith('FX-Water')) mat = new THREE.MeshPhongMaterial({ color: 0x0a1424, specular: 0x334466, shininess: 60, transparent: true, opacity: 0.92 });
    else if (sh === 'Font' || sh === '3dText') mat = new THREE.MeshBasicMaterial({ visible: false });
    else mat = conBrillo(new THREE.MeshLambertMaterial({ color, map, alphaTest: map?.userData.alfa && /Cutout|Leaves/.test(sh) ? 0.5 : 0 }));
    mat.name = m.nombre; mat.userData.shader = sh; mat.userData.color0 = c;
    return (MATS[clave] = mat);
  }
  progreso(1);
  // al cambiar de idioma, las texturas con texto se vuelven a cargar
  const idiomaCambio = () => { for (const [id, tx] of Object.entries(T)) { const t = C.texs[id]; if (!tx || !t?.l) continue; cargador.load(url(base + 'datos/' + (t.l[D.idioma] || t.arch)), (n) => { tx.image = n.image; tx.needsUpdate = true; }); } };
  return { C, BIN, subs, textos, textura, geometria, material, uMundo, conBrillo, base, idiomaCambio };
}

/* las mallas de Unity que no se leen: el Plane (10×10, mirando a +y, uv con el 0,0 en la esquina +x +z
   como en Unity: visto desde arriba con +z hacia arriba, la imagen queda dada vuelta) y el Cube */
function primitiva(nombre) {
  let g;
  if (nombre === 'Plane') {
    g = new THREE.PlaneGeometry(10, 10, 10, 10);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, U = g.attributes.uv;
    for (let k = 0; k < P.count; k++) U.setXY(k, (5 - P.getX(k)) / 10, (5 + P.getZ(k)) / 10);
  } else g = new THREE.BoxGeometry(1, 1, 1);
  g.clearGroups(); g.addGroup(0, g.index.count, 0);
  g.computeBoundingSphere();
  g.userData.id = nombre;
  return g;
}

/* ---------- una escena */
const CELDA = 30;
const TAGS_USADOS = new Set(['Player', 'MainCamera', 'Paper', 'Settings', 'Creditsandhelp']);
export async function armarEscena(R, num, opciones = {}) {
  const E = await traerArch(R.base + `datos/escena-${num}.json`);
  const raiz = new THREE.Group(); raiz.name = 'escena-' + E.nombre;
  const S = {
    E, N: [], O: [], raiz, hijos: [], activo: [], tocado: [], destruido: [], mallasNodo: [], pieles: [], textos: [], luces: [], fuentes: new Map(),
    animadores: new Map(), colisiones: [], disparadores: [], particulas: [], terreno: null, render: E.render || {}, nombre: E.nombre, num, opciones,
    estaticas: new THREE.Group(), lejanos: [],
  };
  S.estaticas.name = 'estaticas'; raiz.add(S.estaticas);
  S.buscar = (nombre) => S.N.findIndex((n, i) => n.n === nombre && !S.destruido[i]);
  S.conTag = (tag) => S.N.map((n, i) => (n.tag === tag && !S.destruido[i] ? i : -1)).filter((i) => i >= 0);
  S.agregar = (pid, pos, quat) => agregarPrefab(S, R, pid, pos, quat);
  agregarNodos(S, R, E.nodos, null);
  construir(S, R, 0, true);
  const iT = S.N.findIndex((n) => n.terreno);
  if (iT >= 0) { S.terreno = await armarTerreno(R, S.N[iT].terreno, S.O[iT], raiz); S.lejanos.push(...S.terreno.lejanos); }
  return S;
}

/* nodos nuevos (de la escena o de un prefab): Object3D, jerarquía y banderas */
function agregarNodos(S, R, nodos, padreRaiz) {
  const base = S.N.length;
  for (const n0 of nodos) {
    const n = base ? JSON.parse(JSON.stringify(n0)) : n0;
    const i = S.N.length;
    if (base) { // referencias dentro del prefab: corridas
      if (n.p >= 0) n.p += base;
      const correr = (v) => { if (Array.isArray(v)) return v.map(correr); if (v && typeof v === 'object' && v.nodo !== undefined) return { ...v, nodo: v.nodo + base, pid: v.pid !== undefined ? `${base}:${v.pid}` : undefined }; return v; };
      for (const g of n.guiones || []) for (const k of Object.keys(g)) g[k] = correr(g[k]);
      for (const a of n.audios || []) a.pid = `${base}:${a.pid}`;
      if (n.piel) n.piel.huesos = n.piel.huesos.map((h) => (h >= 0 ? h + base : h));
    }
    const o = new THREE.Object3D(); o.name = n.n; o.position.fromArray(n.t); o.quaternion.fromArray(n.r); o.scale.fromArray(n.s); o.userData.i = i;
    S.N.push(n); S.O.push(o); S.hijos.push([]); S.activo.push(!n.inactivo); S.tocado.push(!!base); S.destruido.push(false); S.mallasNodo.push([]);
  }
  for (let i = base; i < S.N.length; i++) {
    const p = S.N[i].p;
    if (p >= 0) { S.O[p].add(S.O[i]); S.hijos[p].push(i); if (!S.activo[p]) S.activo[i] = false; } else (padreRaiz || S.raiz).add(S.O[i]);
  }
  return base;
}

function agregarPrefab(S, R, pid, pos, quat) {
  const pf = R.C.prefabs[pid];
  if (!pf) return -1;
  const cont = new THREE.Group(); cont.position.copy(pos); if (quat) cont.quaternion.copy(quat);
  S.raiz.add(cont);
  const base = agregarNodos(S, R, pf.nodos, cont);
  // (Instantiate pone la raíz del prefab en la posición y la rotación pedidas)
  for (let i = base; i < S.N.length; i++) if (S.N[i].p < 0 || S.N[i].p < base) { S.O[i].position.set(0, 0, 0); S.O[i].quaternion.identity(); }
  cont.updateMatrixWorld(true);
  construir(S, R, base, false);
  return base;
}

/* las partes de cada nodo desde "desde": mallas, piel, textos, luces, sonidos, animaciones, colliders */
function construir(S, R, desde, fijo) {
  const { N, O, C = R.C } = { N: S.N, O: S.O, C: R.C };
  S.raiz.updateMatrixWorld(true);
  const tocado = S.tocado;
  if (fijo) { // lo que tocan los scripts (o se anima, o tiene tag): no se junta con lo fijo
    const marcarSub = (i) => { if (tocado[i]) return; tocado[i] = true; S.hijos[i].forEach(marcarSub); };
    const refs = (v) => { if (!v) return; if (Array.isArray(v)) v.forEach(refs); else if (typeof v === 'object' && v.nodo !== undefined) marcarSub(v.nodo); };
    const buscados = new Set(S.opciones.buscados || []);
    N.forEach((n, i) => {
      if (i < desde) return;
      for (const g of n.guiones || []) { Object.values(g).forEach(refs); if (g.n !== 'MainScript') marcarSub(i); }
      const conClips = n.anim && (n.anim.clips.length || n.anim.def);
      if (conClips || TAGS_USADOS.has(n.tag) || n.piel || n.emisor || (n.rb && !n.rb.cinem) || buscados.has(n.n) || n.texto) marcarSub(i);
    });
  }
  const baldes = new Map(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  const subconjunto = (g, subs) => {
    const partes = subs.map((k) => g.groups[k]).filter(Boolean);
    const total = partes.reduce((a, p) => a + p.count, 0);
    const I = g.index.array, J = new (I.constructor)(total);
    let o = 0; const grupos = [];
    partes.forEach((p, k) => { J.set(I.subarray(p.start, p.start + p.count), o); grupos.push([o, p.count, k]); o += p.count; });
    const h = new THREE.BufferGeometry();
    for (const [nmA, a] of Object.entries(g.attributes)) h.setAttribute(nmA, a);
    h.setIndex(new THREE.BufferAttribute(J, 1));
    grupos.forEach(([s0, c, k]) => h.addGroup(s0, c, k));
    h.computeBoundingSphere();
    return h;
  };
  const fades = (i) => { const a = N[i].anim; return a && a.clips.some((c) => C.clips[c]?.curvas.some((cv) => cv.tipo === 'float' && cv.attr.startsWith('_Color'))); };
  for (let i = desde; i < N.length; i++) {
    const n = N[i];
    if (!n.malla || !n.mats || !n.mats.length || n.texto) continue;
    let g = R.geometria(n.malla);
    if (!g) continue;
    const enMundo = !!n.subset;
    if (n.subset) g = subconjunto(g, n.subset);
    let mats = n.mats.map((id) => (id ? R.material(id, { piel: !!n.piel }) : null));
    if (fades(i)) mats = mats.map((m) => { const c = m.clone(); c.transparent = true; c.depthTest = false; c.depthWrite = false; c.opacity = m.userData.color0?.[3] ?? 1; c.userData = { ...m.userData, propio: true }; return c; });
    const lista = g.groups.length > 1 ? g.groups.map((gr) => mats[Math.min(gr.materialIndex, mats.length - 1)] || mats[0]) : mats[0];
    if (n.piel) {
      const m = C.mallas[n.malla];
      if (!m.bind) continue;
      const huesos = n.piel.huesos.map((h) => (h >= 0 ? O[h] : new THREE.Object3D()));
      const sk = new THREE.Skeleton(huesos, m.bind.map((a) => new THREE.Matrix4().fromArray(a)));
      const sm = new THREE.SkinnedMesh(g, lista);
      sm.bindMode = THREE.DetachedBindMode; sm.bind(sk, new THREE.Matrix4());
      sm.frustumCulled = false; sm.name = n.n + '·piel';
      sm.visible = S.activo[i] && !n.rend_off;
      S.raiz.add(sm); S.mallasNodo[i].push(sm); S.pieles.push({ i, sm });
      continue;
    }
    if (tocado[i] || n.rend_off || !fijo) {
      const m = new THREE.Mesh(g, lista);
      m.name = n.n + '·malla';
      if (enMundo) { S.raiz.add(m); m.userData.enMundo = true; } else O[i].add(m);
      m.visible = S.activo[i] && !n.rend_off;
      if (mats.some((x) => x?.transparent)) m.renderOrder = fades(i) ? 9 : 2;
      S.mallasNodo[i].push(m);
      continue;
    }
    if (!S.activo[i]) continue;
    const mw = enMundo ? new THREE.Matrix4() : O[i].matrixWorld;
    nm.getNormalMatrix(mw);
    const al = mw.determinant() < 0;
    const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, I = g.index.array;
    const cen = g.boundingSphere.center.clone().applyMatrix4(mw);
    const cx = Math.floor(cen.x / CELDA), cz = Math.floor(cen.z / CELDA);
    for (const gr of g.groups) {
      const mid = n.mats[Math.min(gr.materialIndex, n.mats.length - 1)];
      if (!mid) continue;
      const mat = R.material(mid);
      if (mat.visible === false) continue;
      const clave = `${mid}|${cx}|${cz}`;
      let b = baldes.get(clave);
      if (!b) baldes.set(clave, (b = { mid, p: [], n: [], u: [], i: [] }));
      const mapa = new Map();
      for (let k = gr.start; k < gr.start + gr.count; k += 3) {
        const tri = al ? [I[k], I[k + 2], I[k + 1]] : [I[k], I[k + 1], I[k + 2]];
        for (const vi of tri) {
          let ni = mapa.get(vi);
          if (ni === undefined) {
            ni = b.p.length / 3; mapa.set(vi, ni);
            v.fromBufferAttribute(P, vi).applyMatrix4(mw); b.p.push(v.x, v.y, v.z);
            if (Nn) { v.fromBufferAttribute(Nn, vi).applyMatrix3(nm).normalize(); b.n.push(v.x, v.y, v.z); } else b.n.push(0, 1, 0);
            if (U) b.u.push(U.getX(vi), U.getY(vi)); else b.u.push(0, 0);
          }
          b.i.push(ni);
        }
      }
    }
  }
  for (const b of baldes.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setIndex(b.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
    g.computeBoundingSphere();
    const mat = R.material(b.mid), m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    if (mat.transparent) m.renderOrder = 2;
    S.estaticas.add(m);
    S.lejanos.push({ m, c: g.boundingSphere.center, r: g.boundingSphere.radius });
  }
  for (let i = desde; i < N.length; i++) {
    const n = N[i];
    if (n.texto) {
      const mat = n.mats?.[0] ? C.mats[n.mats[0]] : null;
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
      plano.name = 'texto'; plano.renderOrder = 10;
      O[i].add(plano);
      plano.visible = S.activo[i] && !n.rend_off;
      S.textos.push({ i, plano, def: n.texto, color: mat?.c?._Color || [1, 1, 1, 1], original: n.texto.t });
      S.mallasNodo[i].push(plano);
    }
    if (n.luz) S.luces.push({ i, def: n.luz, on: !!n.luz.on });
    for (const a of n.audios || []) S.fuentes.set(String(a.pid), { i, def: a, f: null });
    if (n.anim) {
      const clips = {};
      for (const c of n.anim.clips) if (C.clips[c]) clips[c] = C.clips[c];
      if (n.anim.def && C.clips[n.anim.def]) clips[n.anim.def] = C.clips[n.anim.def];
      const a = new Animador(O[i], clips, { flotante: S.opciones.flotante });
      a.def = n.anim.def; a.auto = n.anim.auto;
      S.animadores.set(i, a);
    }
    for (const c of n.col || []) (c.trig ? S.disparadores : S.colisiones).push({ i, c, on: c.on !== false, dinamico: !fijo });
    if (n.emisor && n.rendpart) S.particulas.push({ i, emisor: n.emisor, anim: n.animpart || {}, rend: n.rendpart });
  }
}

/* ---------- terreno de Unity: alturas, capas de textura mezcladas por el mapa de alfas, árboles */
async function armarTerreno(R, T, nodo, raiz) {
  const res = T.res, esc = T.esc;
  const H = new Uint16Array(await traerArch(R.base + `datos/alturas-${T.id}.bin`, 'arrayBuffer'));
  const T0 = nodo.getWorldPosition(new THREE.Vector3());
  const ancho = (res - 1) * esc[0], largo = (res - 1) * esc[2];
  const hAt = (ix, iz) => H[Math.min(res - 1, Math.max(0, ix)) * res + Math.min(res - 1, Math.max(0, iz))] / 32766 * esc[1];
  // (en Unity el terreno crece hacia +z; acá z se dio vuelta: va de T0.z hacia T0.z - largo)
  const alturaEn = (x, z) => {
    const fx = (x - T0.x) / esc[0], fz = (T0.z - z) / esc[2];
    if (fx < 0 || fz < 0 || fx > res - 1 || fz > res - 1) return -Infinity;
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz;
    return T0.y + (hAt(ix, iz) * (1 - ax) + hAt(ix + 1, iz) * ax) * (1 - az) + (hAt(ix, iz + 1) * (1 - ax) + hAt(ix + 1, iz + 1) * ax) * az;
  };
  const capas = T.capas.slice(0, 4);
  const alfa = T.alfas[0] ? R.textura(T.alfas[0]) : null;
  if (alfa) { alfa.wrapS = alfa.wrapT = THREE.ClampToEdgeWrapping; alfa.anisotropy = 1; }
  const mapas = capas.map((c) => (c.tex ? R.textura(c.tex) : null));
  const mat = new THREE.MeshLambertMaterial({ map: mapas[0] });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uAlfa = { value: alfa };
    mapas.forEach((m, k) => { s.uniforms['uCapa' + k] = { value: m || mapas[0] }; s.uniforms['uTile' + k] = { value: new THREE.Vector2(ancho / capas[k].tile[0], largo / capas[k].tile[1]) }; });
    s.uniforms.uBrillo = R.uMundo.uBrillo;
    const n = mapas.length;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBrillo; uniform sampler2D uAlfa;' + mapas.map((_, k) => `uniform sampler2D uCapa${k}; uniform vec2 uTile${k};`).join(''))
      .replace('#include <map_fragment>', `
        vec4 aw = texture2D( uAlfa, vMapUv );
        vec3 mezcla = ${mapas.map((_, k) => `texture2D( uCapa${k}, vMapUv * uTile${k} ).rgb * aw.${'rgba'[k]}`).join(' + ')};
        float suma = ${mapas.map((_, k) => `aw.${'rgba'[k]}`).join(' + ')};
        // (si el mapa de mezcla viene vacío, la primera capa sola)
        diffuseColor.rgb *= suma > 0.01 ? mezcla / suma : texture2D( uCapa0, vMapUv * uTile0 ).rgb;`)
      .replace('#include <opaque_fragment>', 'outgoingLight *= uBrillo;\n#include <opaque_fragment>');
    void n;
  };
  mat.customProgramCacheKey = () => 'terreno' + mapas.length;
  const grupo = new THREE.Group(); grupo.name = 'terreno';
  const TROZO = 32, trozos = [];
  // cada trozo en dos detalles: entero cerca y de a 4 vértices lejos (detrás de la niebla solo se ve la silueta)
  for (let cz = 0; cz < (res - 1) / TROZO; cz++) for (let cx = 0; cx < (res - 1) / TROZO; cx++) for (const salto of [1, 4]) {
    const L = TROZO / salto;
    const n1 = L + 1, pos = new Float32Array(n1 * n1 * 3), nor = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2);
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const ix = cx * TROZO + i * salto, iz = cz * TROZO + j * salto, k = j * n1 + i;
      pos[k * 3] = T0.x + ix * esc[0]; pos[k * 3 + 1] = T0.y + hAt(ix, iz); pos[k * 3 + 2] = T0.z - iz * esc[2];
      const nx = (hAt(ix - 1, iz) - hAt(ix + 1, iz)) / esc[0], nz = (hAt(ix, iz - 1) - hAt(ix, iz + 1)) / esc[2], l = Math.hypot(nx, 2, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = 2 / l; nor[k * 3 + 2] = -nz / l;
      uv[k * 2] = ix / (res - 1); uv[k * 2 + 1] = iz / (res - 1);
    }
    const idx = [];
    for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) { const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false;
    grupo.add(m);
    trozos.push({ m, cerca: salto === 1, c: g.boundingSphere.center, r: g.boundingSphere.radius });
  }
  raiz.add(grupo);
  // árboles: cada prototipo es un prefab; instancias por malla
  const AR = new Float32Array(await traerArch(R.base + `datos/arboles-${T.id}.bin`, 'arrayBuffer'));
  const u32 = new Uint32Array(AR.buffer);
  const porProto = new Map();
  for (let k = 0; k < AR.length; k += 6) {
    const x = T0.x + AR[k] * ancho, z = T0.z - AR[k + 2] * largo;
    const p = u32[k + 5];
    if (!porProto.has(p)) porProto.set(p, []);
    porProto.get(p).push([x, alturaEn(x, z), z, AR[k + 3], AR[k + 4]]);
  }
  // por celdas de 50 m: así la cámara descarta las que quedan atrás o detrás de la niebla
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), ee = new THREE.Vector3();
  const CEL = 50, lejanos = [];
  for (const [p, lista0] of porProto) {
    const pf = T.protos[p] && R.C.prefabs[T.protos[p]];
    if (!pf) continue;
    const celdas = new Map();
    for (const a of lista0) { const k = Math.floor(a[0] / CEL) + ',' + Math.floor(a[2] / CEL); if (!celdas.has(k)) celdas.set(k, []); celdas.get(k).push(a); }
    for (const pn of pf.nodos) {
      if (!pn.malla || !pn.mats) continue;
      const g = R.geometria(pn.malla);
      if (!g) continue;
      const mats = pn.mats.map((id) => R.material(id));
      for (const lista of celdas.values()) {
        const im = new THREE.InstancedMesh(g, g.groups.length > 1 ? g.groups.map((gr) => mats[Math.min(gr.materialIndex, mats.length - 1)]) : mats[0], lista.length);
        lista.forEach((a, k) => { m4.compose(pp.set(a[0], a[1], a[2]), q.identity(), ee.set(a[3] * pn.s[0], a[4] * pn.s[1], a[3] * pn.s[2])); im.setMatrixAt(k, m4); });
        im.computeBoundingSphere();
        im.name = 'arboles';
        raiz.add(im);
        lejanos.push({ m: im, c: im.boundingSphere.center, r: im.boundingSphere.radius });
      }
    }
  }
  return { alturaEn, grupo, T0, ancho, largo, trozos, lejanos };
}
