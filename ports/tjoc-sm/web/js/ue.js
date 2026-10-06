/* Carga un nivel exportado de Unreal 4.16 (TJOC:SM) a three.js.
   Coordenadas ya convertidas: x=X, y=Z, z=Y, en metros; UV con origen arriba (flipY = false).
   Lo estático y quieto se junta por material + lightmap; lo demás queda como objetos sueltos. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();

export class Recursos {
  constructor(base, renderer) {
    this.base = base; this.renderer = renderer;
    this.texs = new Map(); this.bins = new Map(); this.geos = new Map();
    this.cargador = new THREE.TextureLoader();
  }
  textura(f, srgb = true) {
    if (!f) return null;
    const k = f + (srgb ? '' : '|l');
    if (this.texs.has(k)) return this.texs.get(k);
    const t = this.cargador.load(this.base + f);
    t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 2;
    this.texs.set(k, t);
    return t;
  }
  async cargarIndices() {
    const [m, t] = await Promise.all([fetch(this.base + 'mallas.json').then((r) => r.json()), fetch(this.base + 'mats.json').then((r) => r.json())]);
    this.mallas = m; this.mats = t;
  }
  texturaDe(ruta) { return this.texRutas?.[ruta] || null; }
  /* SkinnedMesh con huesos de la pose de referencia (modo separado, matriz de bind identidad) */
  esqueletica(g, mats, meta) {
    const malla = new THREE.SkinnedMesh(g, mats);
    const huesos = meta.huesos.map((h) => { const b = new THREE.Bone(); b.name = h.n; b.position.fromArray(h.t); b.quaternion.fromArray(h.r); b.scale.fromArray(h.s); return b; });
    meta.huesos.forEach((h, j) => { if (h.p >= 0) huesos[h.p].add(huesos[j]); else malla.add(huesos[j]); });
    malla.updateMatrixWorld(true);
    const inv = huesos.map((b) => { _m.copy(malla.matrixWorld).invert().multiply(b.matrixWorld); return _m.clone().invert(); });
    malla.bind(new THREE.Skeleton(huesos, inv), new THREE.Matrix4());
    malla.bindMode = THREE.DetachedBindMode;
    malla.frustumCulled = false;
    malla.userData.sockets = meta.sockets;
    return malla;
  }
  async bin(f) {
    if (!this.bins.has(f)) this.bins.set(f, fetch(this.base + f).then((r) => { if (!r.ok) throw new Error('falta ' + f); return r.arrayBuffer(); }));
    return this.bins.get(f);
  }
  /* Geometría de una malla exportada (compartida). */
  async geometria(meta) {
    if (this.geos.has(meta.archivo)) return this.geos.get(meta.archivo);
    const p = (async () => {
      const buf = await this.bin(meta.archivo), o = meta.off, nv = meta.nv;
      const g = new THREE.BufferGeometry();
      if (o.posq !== undefined) {
        const q = new Int16Array(buf, o.posq, nv * 4), P = new Float32Array(nv * 3), k = meta.q;
        for (let i = 0; i < nv; i++) { P[i * 3] = q[i * 4] * k[0] + k[3]; P[i * 3 + 1] = q[i * 4 + 1] * k[1] + k[4]; P[i * 3 + 2] = q[i * 4 + 2] * k[2] + k[5]; }
        g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      } else g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, o.pos, nv * 3), 3));
      g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(buf, o.nor, nv * 4), 4), 3, 0, true));
      g.setAttribute('uv', new THREE.Float16BufferAttribute(new Uint16Array(buf, o.uv, nv * 2), 2));
      if (o.uv2 !== undefined) g.setAttribute('uv1', new THREE.BufferAttribute(new Uint16Array(buf, o.uv2, nv * 2), 2, true));
      if (o.hi !== undefined) {
        g.setAttribute('skinIndex', new THREE.BufferAttribute(meta.hi16 ? new Uint16Array(buf, o.hi, nv * 4) : new Uint8Array(buf, o.hi, nv * 4), 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(buf, o.pw, nv * 4), 4, true));
      }
      g.setIndex(new THREE.BufferAttribute(meta.i32 ? new Uint32Array(buf, o.idx, meta.ni) : new Uint16Array(buf, o.idx, meta.ni), 1));
      for (const [i, [ini, cant, mat]] of meta.secs.entries()) g.addGroup(ini, cant, i);
      const c = meta.caja;
      if (c) { g.boundingBox = new THREE.Box3(new THREE.Vector3(c[0], c[1], c[2]), new THREE.Vector3(c[3], c[4], c[5])); g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere()); }
      return g;
    })();
    this.geos.set(meta.archivo, p);
    return p;
  }
}

/* Material de UE → MeshLambertMaterial (lightmap decodificado: rgb = sqrt(c/rango)). */
export function crearMaterial(R, m, atlas, opciones) {
  const o = { color: 0xffffff };
  if (!m || m.falta) o.color = 0x777777;
  if (m?.base) o.map = R.textura(m.base);
  if (m?.color && !m.base) o.color = new THREE.Color().setRGB(...m.color, THREE.LinearSRGBColorSpace);
  else if (m?.color && m.base) o.color = new THREE.Color().setRGB(...m.color.map((x) => Math.min(1.5, Math.max(0.2, x))), THREE.LinearSRGBColorSpace);
  if (m?.doble) o.side = THREE.DoubleSide;
  const blend = m?.blend || 'Opaque';
  if (blend === 'Masked') o.alphaTest = m.corte ?? 0.33;
  if (blend === 'Translucent') { o.transparent = true; o.opacity = m.opacidad ?? 0.5; o.depthWrite = false; }
  if (blend === 'Additive') { o.transparent = true; o.blending = THREE.AdditiveBlending; o.depthWrite = false; }
  if (blend === 'Modulate') { o.transparent = true; o.blending = THREE.MultiplyBlending; o.depthWrite = false; o.premultipliedAlpha = true; }
  if (m?.unlit) {
    const mm = new THREE.MeshBasicMaterial(o);
    if (m.emisivo && !m.base) mm.map = R.textura(m.emisivo);
    return mm;
  }
  if (atlas) { o.lightMap = atlas; o.lightMapIntensity = opciones.lm; }
  if (m?.emisivo) { o.emissiveMap = R.textura(m.emisivo); o.emissive = new THREE.Color(1, 1, 1).multiplyScalar(Math.min(4, m.k_em ?? 1)); if (m.color_em) o.emissive.setRGB(...m.color_em, THREE.LinearSRGBColorSpace); }
  const mat = new THREE.MeshLambertMaterial(o);
  if (atlas) mat.lightMap.channel = 1;
  return mat;
}

/* Construye el nivel. Devuelve { raiz, nodos (Object3D por índice), actores, luces (virtuales), N } */
export async function armarNivel(R, N, opciones = {}) {
  opciones = { lm: 4 * Math.PI, tocados: new Set(), ...opciones };
  const raiz = new THREE.Group(); raiz.name = N.nombre;
  const atlas = N.atlas.map((f) => { const t = R.textura(f, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; });
  const mats = new Map();
  const material = (ruta, ai) => {
    const k = ruta + '|' + ai;
    if (!mats.has(k)) mats.set(k, crearMaterial(R, R.mats[ruta], ai >= 0 ? atlas[ai] : null, opciones));
    return mats.get(k);
  };
  // 1) Object3D por nodo, jerarquía
  const objs = N.nodos.map((n) => { const o = new THREE.Object3D(); o.name = n.n; o.position.fromArray(n.t); o.quaternion.fromArray(n.r); o.scale.fromArray(n.s); o.userData.nodo = n; return o; });
  N.nodos.forEach((n, i) => { const p = n.p >= 0 ? objs[n.p] : raiz; p.add(objs[i]); });
  // visibilidad heredada (bVisible se propaga a hijos sólo si se pide; en el arranque cada uno manda)
  N.nodos.forEach((n, i) => { if (n.vis === false || n.oculto) objs[i].userData.oculto = true; });
  raiz.updateMatrixWorld(true);
  // 2) geometrías
  const metas = R.mallas;
  await Promise.all([...new Set(N.nodos.map((n) => n.malla).filter((m) => m && metas[m]))].map((m) => R.geometria(metas[m])));
  for (const b of N.bsp) await R.geometria(b.malla);
  // 3) Estático: se junta por material + atlas
  const grupos = new Map();
  const agregarPieza = (geo, matriz, secs, matsDe, lm, espejo) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, uv1 = geo.attributes.uv1, idx = geo.index;
    _n.getNormalMatrix(matriz);
    for (const [si, [ini, cant, mi]] of secs.entries()) {
      const ruta = matsDe(mi); if (!ruta) continue;
      const ai = lm && uv1 ? lm[0] : -1;
      const k = ruta + '|' + ai;
      if (!grupos.has(k)) grupos.set(k, { ruta, ai, piezas: [] });
      // re-indexar sólo los vértices usados por la sección
      const mapa = new Map(), P = [], Nn = [], U = [], U1 = [], I = [];
      for (let j = ini; j < ini + cant; j++) {
        const v = idx.getX(j);
        let w = mapa.get(v);
        if (w === undefined) {
          w = mapa.size; mapa.set(v, w);
          _v.fromBufferAttribute(pos, v).applyMatrix4(matriz); P.push(_v.x, _v.y, _v.z);
          _v.fromBufferAttribute(nor, v).applyMatrix3(_n).normalize(); Nn.push(_v.x, _v.y, _v.z);
          U.push(uv.getX(v), uv.getY(v));
          if (ai >= 0) U1.push(uv1.getX(v) * lm[1] + lm[3], uv1.getY(v) * lm[2] + lm[4]);
        }
        I.push(w);
      }
      if (espejo) for (let j = 0; j < I.length; j += 3) { const t = I[j + 1]; I[j + 1] = I[j + 2]; I[j + 2] = t; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      if (ai >= 0) g.setAttribute('uv1', new THREE.Float32BufferAttribute(U1, 2));
      g.setIndex(I.length > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
      grupos.get(k).piezas.push(g);
    }
  };
  const sueltos = [];
  for (const [i, n] of N.nodos.entries()) {
    if (!n.malla || !metas[n.malla]) continue;
    const meta = metas[n.malla], o = objs[i];
    const oculto = (() => { for (let x = o; x && x !== raiz; x = x.parent) if (x.userData.oculto) return true; return false; })();
    const actor = N.actores[n.a];
    const quieto = meta.tipo === 'static' && n.mov === 'S' && !opciones.tocados.has(n.a) && !oculto && !n.instancias;
    if (quieto) {
      const lm = n.lmid ? N.lm[n.lmid] : null;
      agregarPieza(await R.geometria(meta), o.matrixWorld, meta.secs, (mi) => (n.mats && n.mats[mi]) || meta.mats[mi], lm, o.matrixWorld.determinant() < 0);
    } else sueltos.push(i);
  }
  for (const b of N.bsp) {
    const lm = N.lm[b.lmid];
    agregarPieza(await R.geometria(b.malla), new THREE.Matrix4(), b.malla.secs, (mi) => b.malla.mats[mi] || 'Engine/Content/EngineMaterials/WorldGridMaterial.WorldGridMaterial', lm, false);
  }
  const estaticos = new THREE.Group(); estaticos.name = 'estaticos'; raiz.add(estaticos);
  for (const { ruta, ai, piezas } of grupos.values()) {
    const g = mergeGeometries(piezas, false);
    if (!g) continue;
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material(ruta, ai)); m.name = ruta.split('.').pop();
    m.matrixAutoUpdate = false;
    estaticos.add(m);
  }
  // 4) Sueltos: mallas estáticas movibles/tocadas y esqueléticas
  for (const i of sueltos) {
    const n = N.nodos[i], meta = metas[n.malla], o = objs[i];
    const geo = await R.geometria(meta);
    const lm = n.lmid && meta.tipo === 'static' && geo.attributes.uv1 ? N.lm[n.lmid] : null;
    let g = geo;
    if (lm) { // uv1 propio de esta instancia
      g = geo.clone(); const a = geo.attributes.uv1, U = new Float32Array(a.count * 2);
      for (let j = 0; j < a.count; j++) { U[j * 2] = a.getX(j) * lm[1] + lm[3]; U[j * 2 + 1] = a.getY(j) * lm[2] + lm[4]; }
      g.setAttribute('uv1', new THREE.BufferAttribute(U, 2));
    }
    const ms = meta.secs.map(([, , mi]) => material((n.mats && n.mats[mi]) || meta.mats[mi] || '?', lm ? lm[0] : -1));
    let malla;
    if (meta.tipo === 'skel') malla = R.esqueletica(g, ms, meta);
    else malla = new THREE.Mesh(g, ms);
    malla.userData.mats = meta.mats;
    malla.name = n.n + ':malla';
    o.add(malla);
    o.userData.malla = malla;
  }
  // 5) Sockets: nodos pegados a huesos de una malla esquelética
  for (const [i, n] of N.nodos.entries()) {
    if (!n.sk || n.p < 0) continue;
    const padre = objs[n.p], m = padre.userData.malla;
    if (!m || !m.isSkinnedMesh) continue;
    const so = (m.userData.sockets || []).find((s) => s.n === n.sk);
    let hueso = m.skeleton.bones.find((b) => b.name === (so ? so.h : n.sk));
    if (!hueso) continue;
    let destino = hueso;
    if (so) { const s = new THREE.Object3D(); s.name = 'socket:' + so.n; s.position.fromArray(so.t); s.quaternion.fromArray(so.r); s.scale.fromArray(so.s); hueso.add(s); destino = s; }
    destino.add(objs[i]);
  }
  // 6) Visibilidad
  objs.forEach((o) => { if (o.userData.oculto) o.visible = false; });
  // 7) Luces (virtuales: el motor elige cuáles prender)
  const luces = [];
  N.nodos.forEach((n, i) => { if (n.luz && n.mov !== 'S' && !n.luz.apagada && (n.luz.tipo === 'Point' || n.luz.tipo === 'Spot')) luces.push({ i, obj: objs[i], ...n.luz }); });
  raiz.updateMatrixWorld(true);
  return { raiz, nodos: objs, luces, N, estaticos };
}
