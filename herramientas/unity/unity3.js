// Materiales de Unity en three.js: los shaders del juego (GLES3 de HLSLcc, traducidos por
// herramientas/unity/shaders.py) en RawShaderMaterial, con las propiedades de cada material
// (extras de gltf.py con materiales_unity=True) y el estado de render de la pasada.
//
//   import { Unity } from './unity3.js';
//   const u = new Unity(THREE, shadersJson, 'datos/casa/tex/');
//   u.prepararEscena(gltf.scene);       // reemplaza materiales, oculta lo inactivo
//   u.actualizar(segundos, renderer);   // cada cuadro: _Time y compañía
//
// Las UV de esos glb van como en Unity (v hacia arriba): las texturas se cargan con flipY.

const BLEND = ['ZeroFactor', 'OneFactor', 'DstColorFactor', 'SrcColorFactor', 'OneMinusDstColorFactor',
  'SrcAlphaFactor', 'OneMinusSrcColorFactor', 'DstAlphaFactor', 'OneMinusDstAlphaFactor',
  'SrcAlphaSaturateFactor', 'OneMinusSrcAlphaFactor'];
const OPS = ['AddEquation', 'SubtractEquation', 'ReverseSubtractEquation', 'MinEquation', 'MaxEquation'];
const ZTEST = [null, 'NeverDepth', 'LessDepth', 'EqualDepth', 'LessEqualDepth', 'GreaterDepth',
  'NotEqualDepth', 'GreaterEqualDepth', 'AlwaysDepth'];
const COLAS = { background: 1000, geometry: 2000, alphatest: 2450, transparent: 3000, overlay: 4000 };

export function cola(texto) {
  if (texto == null) return 2000;
  if (typeof texto === 'number') return texto;
  const m = /^([a-z]+)\s*([+-]\s*\d+)?$/i.exec(String(texto).trim());
  if (!m) return parseInt(texto, 10) || 2000;
  return (COLAS[m[1].toLowerCase()] ?? 2000) + (m[2] ? parseInt(m[2].replace(/\s/g, ''), 10) : 0);
}

export class Unity {
  constructor(THREE, shaders, baseTex) {
    this.T = THREE;
    this.shaders = shaders;
    this.baseTex = baseTex;
    this.texturas = new Map();
    this.cargador = new THREE.TextureLoader();
    const V4 = THREE.Vector4;
    // lo que Unity pone en todos los shaders
    this.motor = {
      _Time: { value: new V4() }, _SinTime: { value: new V4() }, _CosTime: { value: new V4() },
      unity_DeltaTime: { value: new V4() }, _ScreenParams: { value: new V4(1, 1, 1, 1) },
      _ProjectionParams: { value: new V4(1, 0.3, 1000, 1 / 1000) }, unity_OrthoParams: { value: new V4() },
      _ZBufferParams: { value: new V4() }, unity_FogParams: { value: new V4() }, unity_FogColor: { value: new V4() },
      _NightColor: { value: new V4(1, 1, 1, 1) },
    };
    this.def = {
      white: this.color1x1(255, 255, 255, 255), black: this.color1x1(0, 0, 0, 0),
      grey: this.color1x1(128, 128, 128, 128), gray: this.color1x1(128, 128, 128, 128),
      bump: this.color1x1(128, 128, 255, 128), red: this.color1x1(255, 0, 0, 0),
    };
    this.cache = new Map();   // materiales ya armados (mismo material del juego → mismo objeto)
    this._texel = new Map();  // textura → su uniform _TexelSize (se llena cuando carga)
  }

  color1x1(r, g, b, a) {
    const t = new this.T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.needsUpdate = true;
    return t;
  }

  textura(nombre) {
    let t = this.texturas.get(nombre);
    if (!t) {
      const T = this.T;
      t = this.cargador.load(this.baseTex + nombre, (tx) => {
        const u = this._texel.get(nombre);
        if (u) u.value.set(1 / tx.image.width, 1 / tx.image.height, tx.image.width, tx.image.height);
      });
      t.flipY = true;
      t.colorSpace = T.NoColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.magFilter = T.LinearFilter;
      t.minFilter = T.LinearMipmapLinearFilter;
      this.texturas.set(nombre, t);
    }
    return t;
  }

  // RawShaderMaterial para un material del juego (extras de gltf.py). Devuelve null si el shader
  // no está (el objeto se deja sin dibujar).
  material(ex) {
    const clave = JSON.stringify(ex);
    if (this.cache.has(clave)) return this.cache.get(clave);
    const T = this.T;
    const sh = ex && this.shaders[ex.shader];
    if (!sh) { this.cache.set(clave, null); return null; }
    const kw = (ex.kw || []).slice().sort().join(' ');
    const pasadas = sh.variantes[kw] || Object.values(sh.variantes)[0];
    if (!pasadas || !pasadas.length) { this.cache.set(clave, null); return null; }
    const p = pasadas[0];
    const uniforms = { ...this.motor };
    // propiedades del shader con sus valores por defecto, encima las del material
    for (const [n, info] of Object.entries(sh.props)) {
      if (info.tipo === 4 || info.tipo === 5) {          // textura (2D / 3D o cubo)
        const archivo = ex.tex && ex.tex[n];
        uniforms[n] = { value: archivo ? this.textura(archivo) : (this.def[info.tex] || this.def.white) };
        const st = (ex.st && ex.st[n]) || [1, 1, 0, 0];
        uniforms[n + '_ST'] = { value: new T.Vector4(st[0], st[1], st[2], st[3]) };
        const texel = { value: new T.Vector4(1, 1, 1, 1) };
        if (archivo) this._texel.set(archivo, texel);
        uniforms[n + '_TexelSize'] = texel;
      } else if (info.tipo === 0 || info.tipo === 1) {   // color / vector
        const v = (ex.col && ex.col[n]) || info.defecto;
        uniforms[n] = { value: new T.Vector4(v[0], v[1], v[2], v[3]) };
      } else {                                              // float / rango / int
        const v = ex.flt && n in ex.flt ? ex.flt[n] : info.defecto[0];
        uniforms[n] = { value: v };
      }
    }
    for (const [n, v] of Object.entries(ex.col || {})) if (!uniforms[n]) uniforms[n] = { value: new T.Vector4(...v) };
    for (const [n, v] of Object.entries(ex.flt || {})) if (!uniforms[n]) uniforms[n] = { value: v };
    const m = new T.RawShaderMaterial({ glslVersion: T.GLSL3, vertexShader: p.vs, fragmentShader: p.fs, uniforms });
    this.estado(m, p.estado, ex.cola ?? cola(p.tags.QUEUE || p.tags.Queue || sh.cola));
    m.name = ex.shader;
    this.cache.set(clave, m);
    return m;
  }

  estado(m, e, laCola) {
    const T = this.T;
    const [src, dst, srcA, dstA] = e.blend;
    if (src === 1 && dst === 0) {
      m.blending = T.NoBlending;
    } else {
      m.blending = T.CustomBlending;
      m.blendSrc = T[BLEND[src]]; m.blendDst = T[BLEND[dst]];
      m.blendSrcAlpha = T[BLEND[srcA ?? src]]; m.blendDstAlpha = T[BLEND[dstA ?? dst]];
      m.blendEquation = T[OPS[e.op || 0]] || T.AddEquation;
    }
    m.depthWrite = e.zwrite !== 0;
    const zt = ZTEST[e.ztest ?? 4];
    m.depthTest = zt !== 'AlwaysDepth' && e.ztest !== 0;
    if (zt) m.depthFunc = T[zt];
    m.side = e.cull === 0 ? T.DoubleSide : e.cull === 1 ? T.BackSide : T.FrontSide;
    if (e.colmask === 0) m.colorWrite = false;
    if (e.ofs && (e.ofs[0] || e.ofs[1])) {
      m.polygonOffset = true; m.polygonOffsetFactor = e.ofs[0]; m.polygonOffsetUnits = e.ofs[1];
    }
    m.transparent = laCola >= 2500;
    m.userData.cola = laCola;
  }

  // Atributos con los nombres de HLSLcc.
  prepararGeometria(g) {
    if (g.userData.unity) return;
    const a = g.attributes;
    const alias = { position: 'in_POSITION0', normal: 'in_NORMAL0', uv: 'in_TEXCOORD0', uv1: 'in_TEXCOORD1',
      uv2: 'in_TEXCOORD2', uv3: 'in_TEXCOORD3', color: 'in_COLOR0', tangent: 'in_TANGENT0' };
    for (const [k, v] of Object.entries(alias)) if (a[k] && !a[v]) g.setAttribute(v, a[k]);
    g.userData.unity = true;
  }

  // Materiales del juego en todo lo que haya debajo de raiz; lo inactivo, oculto.
  prepararEscena(raiz) {
    raiz.traverse((o) => {
      if (o.userData && o.userData.activo === false) o.visible = false;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nuevos = mats.map((m) => (m && m.userData && m.userData.shader !== undefined ? this.material(m.userData) : null));
      if (nuevos.every((m) => !m)) { o.visible = false; return; }
      this.prepararGeometria(o.geometry);
      o.material = Array.isArray(o.material) ? nuevos.map((m) => m || new this.T.MeshBasicMaterial({ visible: false })) : nuevos[0];
      const c = (Array.isArray(o.material) ? o.material[0] : o.material).userData.cola;
      if (c !== undefined) o.renderOrder = c;
      o.frustumCulled = false;
    });
  }

  actualizar(t, dt, ancho, alto, cam) {
    const m = this.motor;
    m._Time.value.set(t / 20, t, t * 2, t * 3);
    m._SinTime.value.set(Math.sin(t / 8), Math.sin(t / 4), Math.sin(t / 2), Math.sin(t));
    m._CosTime.value.set(Math.cos(t / 8), Math.cos(t / 4), Math.cos(t / 2), Math.cos(t));
    m.unity_DeltaTime.value.set(dt, 1 / (dt || 1), dt, 1 / (dt || 1));
    m._ScreenParams.value.set(ancho, alto, 1 + 1 / ancho, 1 + 1 / alto);
    if (cam) {
      m._ProjectionParams.value.set(1, cam.near, cam.far, 1 / cam.far);
      const x = 1 - cam.far / cam.near;
      m._ZBufferParams.value.set(x, cam.far / cam.near, x / cam.far, 1 / cam.near);
    }
  }
}
