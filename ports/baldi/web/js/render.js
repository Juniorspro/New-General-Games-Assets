/* El dibujo con three.js: MeshRenderer (los del lote estático se juntan por material y se rearman cuando
   uno se apaga o cambia de material), SpriteRenderer, Camera, el cielo de 6 caras y RenderSettings
   (luz ambiente: el Standard de Unity sin luces es albedo × ambiente; niebla exponencial).
   Las matrices de Unity pasan a three con S·M·S (z dado vuelta). */
import * as THREE from 'three';
import { Componente, MonoBehaviour, v3 } from './motor.js';
import { FABRICAS } from './mundo.js';
import { url } from './archivos.js';

THREE.ColorManagement.enabled = false;
// niebla exponencial de Unity (no la cuadrática de three)
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth )', '1.0 - exp( - fogDensity * vFogDepth )');
const S = new THREE.Matrix4().makeScale(1, 1, -1);
export const aThree = (M, out = new THREE.Matrix4()) => out.copy(S).multiply(M).multiply(S);
export const uAmbiente = { value: new THREE.Color(1, 1, 1) };

/* ---------- recursos de dibujo: texturas, geometrías, materiales, sprites */
export function recursosDibujo(base, C, BIN, renderer) {
  const cargador = new THREE.TextureLoader();
  const T = {}, G = {}, M = {}, SP = {}, GC = {};
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function tex(id) {
    if (T[id] !== undefined) return T[id];
    const t = C.texs[id];
    if (!t || !t.arch) return (T[id] = null);
    const tx = cargador.load(url(base + 'datos/' + t.arch));
    tx.wrapS = tx.wrapT = t.repite ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (t.punto) { tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestMipmapLinearFilter; } else tx.anisotropy = aniso;
    tx.userData = { id, alfa: t.alfa, w: t.ow || t.w, h: t.oh || t.h, nombre: t.nombre };
    return (T[id] = tx);
  }
  function geometria(id) {
    if (G[id] !== undefined) return G[id];
    const m = C.mallas[id];
    if (!m || m.falta || !m.nv) return (G[id] = null);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BIN, m.pos, m.nv * 3), 3));
    if (m.nor8 !== undefined) g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(BIN, m.nor8, m.nv * 4), 4), 3, 0, true));
    if (m.uv16 !== undefined) g.setAttribute('uv', new THREE.Float16BufferAttribute(new Uint16Array(BIN, m.uv16, m.nv * 2), 2));
    if (m.col !== undefined) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(BIN, m.col, m.nv * 4), 4, true));
    // las grillas planas (el Plane de Unity: 10×10 cuadros) se dibujan igual con dos triángulos
    const P = new Float32Array(BIN, m.pos, m.nv * 3), UV = m.uv16 !== undefined ? g.attributes.uv : null;
    const partes = m.subs.map(([off, n]) => { const J = m.i32 ? new Uint32Array(BIN, off, n) : new Uint16Array(BIN, off, n); return (n === 600 && UV && simplificarGrilla(J, P, UV)) || J; });
    const total = partes.reduce((a, J) => a + J.length, 0);
    const I = m.i32 ? new Uint32Array(total) : new Uint16Array(total);
    let o = 0;
    g.userData.subs = [];
    partes.forEach((J, k) => { I.set(J, o); g.addGroup(o, J.length, k); g.userData.subs.push([o, J.length]); o += J.length; });
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    g.userData.id = id;
    return (G[id] = g);
  }
  // malla de colisión en el espacio de Unity (z de vuelta) y con el giro original de los triángulos
  function mallaCol(id) {
    if (GC[id] !== undefined) return GC[id];
    const m = C.mallas[id];
    if (!m || m.falta || !m.nv) return (GC[id] = null);
    const P = new Float32Array(BIN, m.pos, m.nv * 3).slice();
    for (let i = 2; i < P.length; i += 3) P[i] = -P[i];
    const tri = [];
    if (m.nombre === 'Plane' && m.nv === 121) { // el Plane de Unity (10×10, mirando a +y): dos triángulos alcanzan
      let a = 0, b = 0, c = 0, d = 0;
      for (let i = 0; i < m.nv; i++) { const x = P[i * 3], z = P[i * 3 + 2]; if (x < -4.9 && z < -4.9) a = i; if (x < -4.9 && z > 4.9) b = i; if (x > 4.9 && z > 4.9) c = i; if (x > 4.9 && z < -4.9) d = i; }
      tri.push(a, b, c, a, c, d);
    } else for (const [off, n] of m.subs) { const I = m.i32 ? new Uint32Array(BIN, off, n) : new Uint16Array(BIN, off, n); for (let i = 0; i < n; i += 3) tri.push(I[i], I[i + 2], I[i + 1]); }
    const k = m.caja ? [m.caja[0], m.caja[1], -m.caja[5], m.caja[3], m.caja[4], -m.caja[2]] : [0, 0, 0, 0, 0, 0];
    return (GC[id] = { pos: P, tri: Uint32Array.from(tri), caja: k });
  }
  function conAmbiente(mat) {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uAmbiente = uAmbiente;
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uAmbiente;')
        .replace('#include <opaque_fragment>', 'outgoingLight *= uAmbiente;\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'ambiente';
    return mat;
  }
  // Material de Unity: lo que los guiones asignan (renderer.material = ...)
  function mat(id) {
    if (M[id]) return M[id];
    const m = C.mats[id];
    let three;
    if (!m) three = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    else {
      const c = m.c._Color || [1, 1, 1, 1], tx = m.tex._MainTex;
      let map = tx ? tex(tx.t) : null;
      if (map && (tx.esc[0] !== 1 || tx.esc[1] !== 1 || tx.off[0] || tx.off[1])) { map = map.clone(); map.repeat.set(tx.esc[0], tx.esc[1]); map.offset.set(tx.off[0], tx.off[1]); map.wrapS = map.wrapT = THREE.RepeatWrapping; }
      const color = new THREE.Color(c[0], c[1], c[2]), sh = m.shader, modo = m.f._Mode || 0;
      if (sh.startsWith('Unlit/Color')) three = new THREE.MeshBasicMaterial({ color });
      else if (sh.startsWith('Unlit')) three = new THREE.MeshBasicMaterial({ map, color: 0xffffff });
      else if (sh === 'Sprites/Default') three = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      else {
        three = conAmbiente(new THREE.MeshBasicMaterial({ color, map }));
        if (modo === 1) three.alphaTest = m.f._Cutoff ?? 0.5;
        else if (modo >= 2) { three.transparent = true; three.opacity = c[3]; three.depthWrite = false; }
      }
      three.name = m.nombre;
    }
    return (M[id] = { id, name: m?.nombre || id, three, shader: m?.shader, datos: m });
  }
  function sprite(id) {
    if (SP[id] !== undefined) return SP[id];
    const s = C.sprites[id];
    if (!s) return (SP[id] = null);
    return (SP[id] = { id, name: s.nombre, texture: tex(s.tex), rect: s.rect, pivot: s.pivote, ppu: s.ppu, border: s.borde, tam: s.tam, tex: s.tex });
  }
  return { tex, geometria, mallaCol, mat, sprite, conAmbiente };
}

/* una submalla que es una grilla plana de 10×10 cuadros (200 triángulos, 121 vértices en un plano):
   dos triángulos con las cuatro esquinas (según las uv) y el mismo giro */
function simplificarGrilla(J, P, UV) {
  const vs = [...new Set(J)];
  if (vs.length !== 121) return null;
  const p = (i) => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const a0 = p(J[0]), n = new THREE.Vector3().subVectors(p(J[1]), a0).cross(new THREE.Vector3().subVectors(p(J[2]), a0));
  if (n.lengthSq() < 1e-12) return null;
  n.normalize();
  for (const i of vs) if (Math.abs(n.dot(p(i).sub(a0))) > 1e-3) return null;
  let e00 = vs[0], e11 = vs[0], e10 = vs[0], e01 = vs[0];
  const u = (i) => UV.getX(i), v = (i) => UV.getY(i);
  for (const i of vs) { if (u(i) + v(i) < u(e00) + v(e00)) e00 = i; if (u(i) + v(i) > u(e11) + v(e11)) e11 = i; if (u(i) - v(i) > u(e10) - v(e10)) e10 = i; if (u(i) - v(i) < u(e01) - v(e01)) e01 = i; }
  if (new Set([e00, e11, e10, e01]).size < 4) return null;
  const t = [e00, e10, e11, e00, e11, e01];
  const m = new THREE.Vector3().subVectors(p(t[1]), p(t[0])).cross(new THREE.Vector3().subVectors(p(t[2]), p(t[0])));
  if (m.dot(n) < 0) { [t[1], t[2]] = [t[2], t[1]]; [t[4], t[5]] = [t[5], t[4]]; }
  return J instanceof Uint32Array ? Uint32Array.from(t) : Uint16Array.from(t);
}

/* ---------- MeshRenderer */
export class MeshRenderer extends Componente {
  static get tipos() { return ['MeshRenderer', 'Renderer']; }
  constructor(n, d, mundo, nd) {
    super(n, { on: !nd.rend_off });
    this.R = mundo.recursos;
    this.mallaId = nd.malla; this.lote = nd.lote || null;
    this._mats = (nd.mats || []).map((id) => (id ? this.R.mat(id) : null));
    this.sucio = true;
  }
  get material() { return this._mats[0] || null; }
  set material(m) { this._mats[0] = m; this.sucio = true; }
  get sharedMaterial() { return this.material; } set sharedMaterial(m) { this.material = m; }
  get materials() { return [...this._mats]; } set materials(l) { this._mats = [...l]; this.sucio = true; }
  get isVisible() { return this.nodo.mundo.render?.visible(this) ?? false; }
  get bounds() { return this.nodo.mundo.render?.limites(this); }
}

/* ---------- SpriteRenderer */
export class SpriteRenderer extends Componente {
  static get tipos() { return ['SpriteRenderer', 'Renderer']; }
  constructor(n, d, mundo) {
    super(n, d);
    this.R = mundo.recursos;
    this._sprite = d.s ? this.R.sprite(d.s) : null;
    this._color = d.color ? [...d.color] : [1, 1, 1, 1];
    this.flipX = !!d.fx; this.flipY = !!d.fy; this.orden = d.orden || 0;
    this.sucio = true;
  }
  get sprite() { return this._sprite; }
  set sprite(s) { if (s !== this._sprite) { this._sprite = s; this.sucio = true; } }
  get color() { return this._color; }
  set color(c) { this._color = [...c]; this.sucio = true; }
  get isVisible() { return this.nodo.mundo.render?.visible(this) ?? false; }
}

/* ---------- Camera */
export class Camera extends Componente {
  static get tipos() { return ['Camera']; }
  constructor(n, d) {
    super(n, d);
    this.fieldOfView = d.fov; this.nearClipPlane = d.cerca; this.farClipPlane = d.lejos; this.backgroundColor = d.fondo;
    this.clearFlags = d.limpiar; this.cullingMask = d.mascara >>> 0; this.depth = d.prof;
    this.three = new THREE.PerspectiveCamera(d.fov, 1, d.cerca, d.lejos);
    this.three.matrixAutoUpdate = false;
  }
  // rayo desde un punto de la pantalla (píxeles de Unity: y para arriba)
  ScreenPointToRay(p) {
    const r = this.nodo.mundo.render; const w = r.ancho, h = r.alto;
    const x = (p.x / w) * 2 - 1, y = (p.y / h) * 2 - 1;
    const t = Math.tan(this.fieldOfView * Math.PI / 360);
    const dir = v3(x * t * (w / h), y * t, 1).applyQuaternion(this.nodo.rotation).normalize();
    return { origin: this.nodo.position, direction: dir };
  }
}

/* ---------- el sistema de dibujo */
export class Render {
  constructor(renderer, R) {
    this.r = renderer; this.R = R; this.escena = new THREE.Scene(); this.cam = null; this.ancho = 640; this.alto = 480;
    this.mallas = []; this.sprites = []; this.camaras = []; this.lotes = new Map(); this.fondo = new THREE.Color(0, 0, 0);
    this._fr = new THREE.Frustum(); this._pm = new THREE.Matrix4();
  }
  nuevoComp(c) {
    if (c instanceof MeshRenderer) this.mallas.push(c);
    else if (c instanceof SpriteRenderer) this.sprites.push(c);
    else if (c instanceof Camera) this.camaras.push(c);
  }
  antesDeEscena() {
    for (const o of [...this.escena.children]) this.escena.remove(o);
    for (const [, l] of this.lotes) l.malla.geometry.dispose();
    this.mallas = []; this.sprites = []; this.camaras = []; this.lotes.clear();
    uAmbiente.value.setRGB(1, 1, 1); this.escena.fog = null;
  }
  alCargar(esc) { this.aplicarAjustes(esc.render); this.instanciar(); }
  // las mallas sueltas que se repiten (casilleros, pupitres, sillas, pasto, cerco, paredes) van en
  // InstancedMesh: un dibujo por malla y material; cada cuadro se actualiza la matriz del que se movió y
  // el que se apaga queda con escala 0. El que cambia de material sale del grupo y se dibuja solo.
  instanciar() {
    const grupos = new Map();
    for (const c of this.mallas) {
      if (c.lote) continue;
      const k = c.mallaId + '|' + c._mats.map((m) => m?.id).join(',');
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    }
    this.instancias = [];
    for (const [k, lista] of grupos) {
      if (lista.length < 3) continue;
      const c0 = lista[0], g = this.R.geometria(c0.mallaId); if (!g) continue;
      const mats = g.groups.map((gr) => c0._mats[Math.min(gr.materialIndex, c0._mats.length - 1)]?.three || null);
      if (mats.some((m) => !m)) continue;
      const im = new THREE.InstancedMesh(g, mats.length > 1 ? mats : mats[0], lista.length);
      im.frustumCulled = false; im.matrixAutoUpdate = false;
      const gr = { im, lista, firma: k.split('|')[1] };
      lista.forEach((c, i) => { c.grupo = gr; c.indice = i; c._ver = -1; c._vis = null; });
      this.escena.add(im);
      this.instancias.push(gr);
    }
  }
  _instancias() {
    const M = new THREE.Matrix4(), cero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const gr of this.instancias) {
      let cambio = false;
      for (const c of gr.lista) {
        if (!c.grupo) continue;
        const vis = c.isActiveAndEnabled && !c.nodo.destruido;
        if (c._mats.map((m) => m?.id).join(',') !== gr.firma) { gr.im.setMatrixAt(c.indice, cero); c.grupo = null; c._obj = null; cambio = true; continue; }
        if (vis !== c._vis || (vis && c._ver !== c.nodo.ver)) {
          c._vis = vis; c._ver = c.nodo.ver;
          gr.im.setMatrixAt(c.indice, vis ? aThree(c.nodo.matrizMundo, M) : cero);
          cambio = true;
        }
      }
      if (cambio) gr.im.instanceMatrix.needsUpdate = true;
    }
  }
  alDestruir() { /* los objetos se sacan al recorrer (nodo.destruido) */ }
  aplicarAjustes(rs) {
    this.rs = rs;
    const a = rs.ambiente || [1, 1, 1, 1], k = rs.ambiente_modo === 3 ? 1 : (rs.ambiente_int ?? 1);
    uAmbiente.value.setRGB(a[0] * k, a[1] * k, a[2] * k);
    if (rs.niebla) { const c = rs.niebla_color; this.escena.fog = new THREE.FogExp2(new THREE.Color(c[0], c[1], c[2]), rs.niebla_dens); } else this.escena.fog = null;
    this.cielo(rs.cielo);
  }
  cielo(id) {
    this.cieloId = id;
    const m = id ? this.mundo.C.mats[id] : null;
    if (!m || m.shader !== 'Skybox/6 Sided' || (m.c._Tint && m.c._Tint[0] === 0 && m.c._Tint[1] === 0)) { this.escena.background = null; return; }
    // caras de Unity (+x Left, -x Right, +y Up, -y Down, +z Front, -z Back); con z dado vuelta se cambian adelante y atrás
    const caras = ['_LeftTex', '_RightTex', '_UpTex', '_DownTex', '_BackTex', '_FrontTex'].map((k) => this.mundo.C.texs[m.tex[k]?.t]);
    if (caras.some((t) => !t)) { this.escena.background = null; return; }
    const ct = new THREE.CubeTextureLoader().load(caras.map((t) => url(this.mundo.base + 'datos/' + t.arch)));
    this.escena.background = ct;
    this.escena.backgroundRotation = new THREE.Euler(0, -(m.f._Rotation || 0) * Math.PI / 180, 0);
    const t = m.c._Tint || [0.5, 0.5, 0.5]; this.escena.backgroundIntensity = (t[0] + t[1] + t[2]) * 2 / 3 * (m.f._Exposure ?? 1);
  }
  // la cámara que dibuja: la de tag MainCamera o la de más profundidad
  get principal() {
    let mejor = null;
    for (const c of this.camaras) if (c.isActiveAndEnabled && !c.nodo.destruido && (!mejor || (c.nodo.tag === 'MainCamera' && mejor.nodo.tag !== 'MainCamera') || c.depth > mejor.depth)) mejor = c;
    return mejor;
  }
  _objMalla(c) {
    const g = this.R.geometria(c.mallaId);
    if (!g) return null;
    const mats = g.groups.map((gr) => c._mats[Math.min(gr.materialIndex, c._mats.length - 1)]?.three || null);
    const m = new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]);
    m.matrixAutoUpdate = false;
    return m;
  }
  _lote(c) { // el lote estático: la malla combinada en coordenadas de mundo, juntada por material
    const g = this.R.geometria(c.mallaId);
    if (!g) return;
    const visible = c.isActiveAndEnabled && !c.nodo.destruido;
    const claveVieja = c._claves || [];
    const nuevas = [];
    const p = c.nodo.position, celda = Math.floor(p.x / 150) + ',' + Math.floor(p.z / 150);
    if (visible) for (let k = 0; k < c.lote[1]; k++) { const mat = c._mats[Math.min(k, c._mats.length - 1)]; if (mat) nuevas.push(c.mallaId + '|' + mat.id + '|' + celda); }
    for (const k of new Set([...claveVieja, ...nuevas])) {
      let l = this.lotes.get(k);
      if (!l) {
        const [mid, matId] = k.split('|');
        const geo = new THREE.BufferGeometry();
        for (const [n, a] of Object.entries(g.attributes)) geo.setAttribute(n, a);
        const malla = new THREE.Mesh(geo, this.R.mat(matId).three);
        malla.matrixAutoUpdate = false;
        this.escena.add(malla);
        l = { malla, base: g, rends: new Set(), sucio: true, mid };
        this.lotes.set(k, l);
      }
      l.rends.add(c); l.sucio = true;
    }
    c._claves = nuevas;
  }
  _rearmarLote(l) {
    const I = l.base.index.array, partes = [];
    let total = 0;
    for (const c of l.rends) {
      if (!c._claves) continue;
      for (let k = 0; k < c.lote[1]; k++) {
        const mat = c._mats[Math.min(k, c._mats.length - 1)];
        if (!mat || l.malla.material !== mat.three) continue;
        const sub = l.base.userData.subs[c.lote[0] + k];
        if (sub && c._claves.some((k) => k.startsWith(c.mallaId + '|' + mat.id + '|') && this.lotes.get(k) === l)) { partes.push(sub); total += sub[1]; }
      }
    }
    const J = I instanceof Uint32Array ? new Uint32Array(total) : new Uint16Array(total);
    let o = 0;
    for (const [s0, n] of partes) { J.set(I.subarray(s0, s0 + n), o); o += n; }
    l.malla.geometry.setIndex(new THREE.BufferAttribute(J, 1));
    // límites de lo que quedó (para descartarlo fuera de la cámara)
    const P = l.base.attributes.position, caja = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < J.length; i++) caja.expandByPoint(v.fromBufferAttribute(P, J[i]));
    l.malla.geometry.boundingSphere = caja.isEmpty() ? new THREE.Sphere() : caja.getBoundingSphere(new THREE.Sphere());
    l.malla.visible = total > 0;
    l.sucio = false;
  }
  _objSprite(c) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(8), 2));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaTest: 0.02, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = 5;
    return m;
  }
  _armarSprite(c) {
    const m = c._obj, s = c.sprite;
    if (!s || !s.texture) { m.visible = false; return; }
    const tw = s.texture.userData.w, th = s.texture.userData.h, [rx, ry, rw, rh] = s.rect;
    const w = rw / s.ppu, h = rh / s.ppu, px = s.pivot[0] * w, py = s.pivot[1] * h;
    let x0 = -px, x1 = w - px; const y0 = -py, y1 = h - py;
    if (c.flipX) [x0, x1] = [x1, x0];
    // en three la z va al revés: el sprite mira hacia -z de Unity = +z de three
    const P = m.geometry.attributes.position.array;
    P.set([x0, y1, 0, x1, y1, 0, x0, y0, 0, x1, y0, 0]);
    const u0 = rx / tw, u1 = (rx + rw) / tw, v1 = (ry + rh) / th, v0 = ry / th;
    m.geometry.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
    m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.uv.needsUpdate = true;
    m.geometry.computeBoundingSphere();
    m.material.map = s.texture; m.material.color.setRGB(c.color[0], c.color[1], c.color[2]); m.material.opacity = c.color[3];
    m.material.needsUpdate = true;
    c.sucio = false;
  }
  visible(c) {
    const cam = this.principal; if (!cam || !c.isActiveAndEnabled) return false;
    const o = c._obj; if (!o || !o.visible) return false;
    this._pm.multiplyMatrices(cam.three.projectionMatrix, cam.three.matrixWorldInverse);
    this._fr.setFromProjectionMatrix(this._pm);
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const sp = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
    return this._fr.intersectsSphere(sp);
  }
  limites(c) {
    const n = c.nodo, g = this.R.geometria(c.mallaId);
    if (!g) return { center: n.position, size: v3() };
    const b = g.boundingBox.clone(); b.min.z *= -1; b.max.z *= -1;
    const box = new THREE.Box3().setFromPoints([b.min, b.max]).applyMatrix4(n.matrizMundo);
    return { center: box.getCenter(v3()), size: box.getSize(v3()), min: box.min, max: box.max };
  }
  dibujar() {
    // mallas
    for (const c of this.mallas) {
      if (c.nodo.destruido) { if (c._obj) this.escena.remove(c._obj); if (c.lote && c._claves?.length) { c._en = false; this._lote(c); } continue; }
      if (c.grupo) continue;
      if (c.lote) {
        const vis = c.isActiveAndEnabled, firma = vis + ':' + c._mats.map((m) => m?.id).join(',');
        if (firma !== c._firma) { c._firma = firma; this._lote(c); }
        continue;
      }
      const vis = c.isActiveAndEnabled;
      if (!c._obj) { if (!vis) continue; c._obj = this._objMalla(c); if (!c._obj) continue; this.escena.add(c._obj); c._ver = -1; }
      c._obj.visible = vis;
      if (!vis) continue;
      if (c.sucio) { const g = c._obj.geometry; const mats = g.groups.map((gr) => c._mats[Math.min(gr.materialIndex, c._mats.length - 1)]?.three || null); c._obj.material = mats.length > 1 ? mats : mats[0]; c.sucio = false; }
      if (c._ver !== c.nodo.ver) { c._ver = c.nodo.ver; aThree(c.nodo.matrizMundo, c._obj.matrix); c._obj.matrixWorld.copy(c._obj.matrix); }
    }
    this._instancias();
    for (const [, l] of this.lotes) {
      for (const c of l.rends) if (!c._claves?.length || !c._claves.some((k) => k.startsWith(l.mid + '|') && this.lotes.get(k) === l)) l.rends.delete(c);
      if (l.sucio) this._rearmarLote(l);
    }
    for (const c of this.sprites) {
      if (c.nodo.destruido) { if (c._obj) this.escena.remove(c._obj); continue; }
      const vis = c.isActiveAndEnabled;
      if (!c._obj) { if (!vis) continue; c._obj = this._objSprite(c); this.escena.add(c._obj); c._ver = -1; }
      c._obj.visible = vis;
      if (!vis) continue;
      if (c.sucio) this._armarSprite(c);
      if (c._ver !== c.nodo.ver) { c._ver = c.nodo.ver; aThree(c.nodo.matrizMundo, c._obj.matrix); c._obj.matrixWorld.copy(c._obj.matrix); }
    }
    this.mallas = this.mallas.filter((c) => !c.nodo.destruido);
    this.sprites = this.sprites.filter((c) => !c.nodo.destruido);
    this.camaras = this.camaras.filter((c) => !c.nodo.destruido);
    const cam = this.principal;
    if (!cam) { this.r.setClearColor(0x000000, 1); this.r.clear(); return; }
    const t = cam.three;
    if (t.fov !== cam.fieldOfView || t.near !== cam.nearClipPlane || t.far !== Math.max(cam.nearClipPlane + 0.01, cam.farClipPlane) || t.aspect !== this.ancho / this.alto) {
      t.fov = cam.fieldOfView; t.near = cam.nearClipPlane; t.far = Math.max(cam.nearClipPlane + 0.01, cam.farClipPlane); t.aspect = this.ancho / this.alto; t.updateProjectionMatrix();
    }
    const n = cam.nodo, M = new THREE.Matrix4().compose(n.position, n.rotation, v3(1, 1, 1));
    aThree(M, t.matrix); t.matrixWorld.copy(t.matrix); t.matrixWorldInverse.copy(t.matrix).invert();
    const bg = cam.backgroundColor || [0, 0, 0, 1];
    this.r.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
    const usarCielo = cam.clearFlags === 1 && this.escena.background;
    const fondo = this.escena.background;
    if (!usarCielo) this.escena.background = null;
    if (cam.cullingMask === 0) { // nada que ver: solo el fondo
      const vis = this.escena.children.map((o) => o.visible); this.escena.children.forEach((o) => { o.visible = false; });
      this.r.render(this.escena, t); this.escena.children.forEach((o, i) => { o.visible = vis[i]; });
    } else this.r.render(this.escena, t);
    this.escena.background = fondo;
  }
}

FABRICAS.malla = (n, d, mundo, nd) => (nd.mats ? [new MeshRenderer(n, d, mundo, nd)] : []);
FABRICAS.sprite = (n, d, mundo) => [new SpriteRenderer(n, d, mundo)];
FABRICAS.cam = (n, d) => [new Camera(n, d)];
