// Tom: el modelo (tom-s/m/l.glb), sus materiales con los shaders del juego (Outfit7/DirtyTom y
// Outfit7/TomsEyes, pasados de su GLSL de GLES3) y sus pieles (pieles.json).
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// ---------------------------------------------------------------- DirtyTom
// Sin luces: el pelaje, la ropa encima con su alfa, la suciedad (uv1), el color o el reflejo
// "custom" (uv1) y el modo noche (gris y teñido). El pelaje y la ropa salen de la primera UV salvo
// con FUR_UV_SET_2 / UV_SET_2 (sin keywords, Unity usa las primeras de cada multi_compile:
// UV_SET_1 y FUR_UV_SET_1, como muestran los íconos del ropero). Unity en espacio gamma: los
// colores van tal cual, sin conversiones.
const VERT_TOM = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
attribute vec2 uvTela;
varying vec2 vUv0;
varying vec2 vUv1;
varying vec3 vVista;
varying vec3 vNormal;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 mundo = modelMatrix * vec4(transformed, 1.0);
  vVista = mundo.xyz - cameraPosition;
  vNormal = normalize(mat3(modelMatrix) * objectNormal);
  vUv0 = uv;
  vUv1 = uvTela;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}`;

const FRAG_TOM = /* glsl */ `
uniform sampler2D _MainTex;
uniform sampler2D _MainTexCloth;      // rgb: ropa, a: su alfa (_MainTexClothAlpha)
uniform sampler2D _DirtMask;
uniform sampler2D _CustomTex;
uniform samplerCube _CustomCubeMap;
uniform vec4 _DirtColor;
uniform float _LightAmount;
uniform float _CustomModeType;
uniform vec4 _CustomColor;
uniform vec4 _NightColor;
varying vec2 vUv0;
varying vec2 vUv1;
varying vec3 vVista;
varying vec3 vNormal;
void main() {
#ifdef FUR_UV_SET_2
  vec3 c0 = texture2D(_MainTex, vUv1).xyz;
#else
  vec3 c0 = texture2D(_MainTex, vUv0).xyz;
#endif
  float d = texture2D(_DirtMask, vUv1).w;
  vec3 c2 = (_NightColor.x < 1.0) ? (c0 - vec3(d)) + d * _DirtColor.xyz : c0;
#ifdef UV_SET_2
  vec4 tela = texture2D(_MainTexCloth, vUv1);
#else
  vec4 tela = texture2D(_MainTexCloth, vUv0);
#endif
  c2 = tela.w * (tela.xyz - c2) + c2;
  float cust = texture2D(_CustomTex, vUv1).w;
  vec4 c1 = vec4(c2 * _LightAmount, 1.0);
  c1 = d * (_DirtColor - c1) + c1;
  float g = dot(c2, vec3(0.33));
  vec4 cn = vec4((vec3(g) - c2) * 0.58 + c2, 1.0) * _NightColor;
  c1 = (_NightColor.x == 1.0) ? c1 : cn;
  if (_CustomModeType == 1.0) {
    vec3 n = normalize(vNormal);
    vec3 r = vVista - 2.0 * dot(vVista, n) * n;
    vec3 cubo = textureCube(_CustomCubeMap, vec3(-r.x, r.y, r.z)).xyz;
    gl_FragColor = vec4(cubo * _CustomColor.xyz * cust + c1.xyz, c1.w);
    return;
  }
  gl_FragColor = cust * (_CustomColor - c1) + c1;
}`;

// ---------------------------------------------------------------- TomsEyes
const VERT_OJOS = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec2 vUv0;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vUv0 = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);
}`;
const FRAG_OJOS = /* glsl */ `
uniform sampler2D _MainTex;
uniform vec4 _NightColor;
varying vec2 vUv0;
void main() { gl_FragColor = texture2D(_MainTex, vUv0) * _NightColor; }`;

// ---------------------------------------------------------------- texturas
const cargador = new THREE.TextureLoader();
const cacheTex = new Map();

function texturaVacia(r, g, b, a) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
  t.needsUpdate = true;
  return t;
}
const SIN_TELA = texturaVacia(0, 0, 0, 0);
const SIN_SUCIEDAD = texturaVacia(0, 0, 0, 0);
const SIN_CUSTOM = texturaVacia(0, 0, 0, 0);
const CUBO_NEGRO = new THREE.CubeTexture([0, 1, 2, 3, 4, 5].map(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1; return c;
}));
CUBO_NEGRO.needsUpdate = true;

export function textura(url) {
  let t = cacheTex.get(url);
  if (!t) {
    t = cargador.load(url);
    t.flipY = false;                   // las UV vienen de glTF (v hacia abajo)
    t.colorSpace = THREE.NoColorSpace; // Unity en gamma: la textura tal cual
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 1;
    cacheTex.set(url, t);
  }
  return t;
}

// Una tira de 6 caras (+x −x +y −y +z −z) como CubeTexture.
export function cubo(url) {
  let t = cacheTex.get('cubo:' + url);
  if (t) return t;
  t = new THREE.CubeTexture();
  t.colorSpace = THREE.NoColorSpace;
  const img = new Image();
  img.onload = () => {
    const n = img.height;
    t.images = [0, 1, 2, 3, 4, 5].map((i) => {
      const c = document.createElement('canvas'); c.width = c.height = n;
      c.getContext('2d').drawImage(img, i * n, 0, n, n, 0, 0, n, n);
      return c;
    });
    t.needsUpdate = true;
  };
  img.src = url;
  cacheTex.set('cubo:' + url, t);
  return t;
}

function color(v, def) { return new THREE.Vector4(...(v || def)); }

// El material del cuerpo para una piel (pieles.json → partes.body).
export function materialTom(base, mat) {
  const tx = mat.texturas || {}, col = mat.colores || {}, fl = mat.floats || {};
  const u = {
    _MainTex: { value: tx._MainTex ? textura(base + tx._MainTex.archivo) : SIN_TELA },
    _MainTexCloth: { value: tx._MainTexCloth ? textura(base + tx._MainTexCloth.archivo) : SIN_TELA },
    _DirtMask: { value: SIN_SUCIEDAD },
    _CustomTex: { value: tx._CustomTex ? textura(base + tx._CustomTex.archivo) : SIN_CUSTOM },
    _CustomCubeMap: { value: tx._CustomCubeMap ? cubo(base + tx._CustomCubeMap.cubo) : CUBO_NEGRO },
    _DirtColor: { value: color(col._DirtColor, [0.19, 0.11, 0.06, 1]) },
    _LightAmount: { value: fl._LightAmount ?? 1 },
    _CustomModeType: { value: fl._CustomModeType ?? 0 },
    _CustomColor: { value: color(col._CustomColor, [0.99, 0.86, 0.09, 1]) },
    _NightColor: { value: new THREE.Vector4(1, 1, 1, 1) },
  };
  const defines = {};
  for (const k of mat.keywords || []) defines[k] = '';
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_TOM, fragmentShader: FRAG_TOM, defines });
}

export function materialOjos(url) {
  return new THREE.ShaderMaterial({
    uniforms: { _MainTex: { value: textura(url) }, _NightColor: { value: new THREE.Vector4(1, 1, 1, 1) } },
    vertexShader: VERT_OJOS, fragmentShader: FRAG_OJOS,
  });
}

// ---------------------------------------------------------------- el modelo
const gltf = new GLTFLoader();

export async function cargarTom(base, tam /* 's' | 'm' | 'l' */) {
  const g = await gltf.loadAsync(`${base}tom-${tam}.glb`);
  const raiz = g.scene;
  const mallas = {};
  raiz.traverse((o) => {
    if (o.isSkinnedMesh) {
      // la segunda UV como atributo propio (el shader la declara)
      if (o.geometry.attributes.uv1) o.geometry.setAttribute('uvTela', o.geometry.attributes.uv1);
      o.frustumCulled = false;
      const n = /^(body|eyes|teeth)/.test(o.name) ? o.name : (o.parent && o.parent.name) || o.name;
      mallas[/^body/.test(n) ? 'body' : /^eyes/.test(n) ? 'eyes' : /^teeth/.test(n) ? 'teeth' : n] = o;
    }
  });
  return { raiz, mallas };
}

// Viste a Tom como TomsPrefabTexturedSlotItem.UpdateSlot: el material del cuerpo es el del pelaje
// (tom-fur-*); si hay ropa (tom-cloth-*), le pone encima la tela y su alfa, y la tela sale de la
// segunda UV si el shader de la ropa es *_UV2 (UV_SET_2) o de la primera si no (UV_SET_1); sin ropa
// apaga las dos keywords (queda UV_SET_1). El pelaje sale de la segunda UV si el nombre de su
// material tiene "_UV2" (FUR_UV_SET_2). El pijama copia además su _CustomTex y el emperador su
// reflejo dorado (_CustomCubeMap, _CustomColor, _CustomTex, modo 1).
export function vestir(tom, base, pieles, ropero, { fur = 'tom-fur-default', cloth = null, eyes = 'tom-eyes-green' } = {}) {
  const pf = pieles[(ropero[fur] || {}).piel];
  if (!pf || pf.tipo !== 'piel') throw new Error('no hay pelaje ' + fur);
  const m = JSON.parse(JSON.stringify(pf.partes.body));
  m.keywords = [];
  if (/_UV2/.test(m.nombre)) m.keywords.push('FUR_UV_SET_2');
  const pc = cloth && pieles[(ropero[cloth] || {}).piel];
  if (pc && pc.partes.body) {
    const c = pc.partes.body;
    if (c.texturas._MainTexCloth) m.texturas._MainTexCloth = c.texturas._MainTexCloth;
    else delete m.texturas._MainTexCloth;
    m.keywords.push(/_UV2/.test(c.shader || '') ? 'UV_SET_2' : 'UV_SET_1');
    if (cloth === 'tom-fur-pajamas' || (ropero[cloth] || {}).piel === 'tom_body_pijama') {
      if (c.texturas._CustomTex) m.texturas._CustomTex = c.texturas._CustomTex;
    }
    if ((ropero[cloth] || {}).piel === 'tom_body_emperor') {
      for (const k of ['_CustomCubeMap', '_CustomTex']) if (c.texturas[k]) m.texturas[k] = c.texturas[k];
      if (c.colores._CustomColor) m.colores._CustomColor = c.colores._CustomColor;
      m.floats._CustomModeType = 1;
      m.keywords = m.keywords.filter((k) => k !== 'UV_SET_1');
    }
  }
  const mat = materialTom(base, m);
  if (tom.mallas.body) tom.mallas.body.material = mat;
  const dientes = pf.partes.teethTongue ? materialTom(base, pf.partes.teethTongue) : mat;
  if (tom.mallas.teeth) tom.mallas.teeth.material = dientes;
  const o = pieles[(ropero[eyes] || {}).ojos || 'tom_eyes_default'];
  if (tom.mallas.eyes && o) tom.mallas.eyes.material = materialOjos(base + o.tex);
  return mat;
}

// Pone una piel de tom/skins tal cual (para el visor).
export function ponerPiel(tom, base, pieles, nombrePiel, ojos = 'tom_eyes_default', keywords = null) {
  const p = pieles[nombrePiel];
  if (!p || p.tipo !== 'piel') throw new Error('no hay piel ' + nombrePiel);
  const mat = materialTom(base, keywords ? { ...p.partes.body, keywords } : p.partes.body);
  if (tom.mallas.body) tom.mallas.body.material = mat;
  if (tom.mallas.teeth) tom.mallas.teeth.material = p.partes.teethTongue ? materialTom(base, p.partes.teethTongue) : mat;
  const o = pieles[ojos];
  if (tom.mallas.eyes && o) tom.mallas.eyes.material = materialOjos(base + o.tex);
  return mat;
}

// ---------------------------------------------------------------- el adolescente
// tomTeenLow_CRIG usa las animaciones del adulto: después de aplicarlas, PoseRetarget escala y
// corre las posiciones de sus huesos (y gira uno), y TomCharacterAnimationOffset baja o corre la
// cadera en algunas animaciones (por tiempo normalizado, con fundido), como sus LateUpdate.
const uPos = (v) => new THREE.Vector3(-v.x, v.y, v.z);
const uRot = (q) => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);

export class Retarget {
  constructor(raiz, datos) {
    this.juntas = [];
    for (const j of (datos && datos.PoseRetarget && datos.PoseRetarget.JointDatas) || []) {
      const o = raiz.getObjectByName(j.JointTransform);
      if (!o) continue;
      this.juntas.push({
        o, f: j.JointDataFlags, esc: j.PositionScale, ofs: uPos(j.PositionOffset),
        pre: uRot(j.PreRotationOffset), post: uRot(j.PostRotationOffset),
        sc: new THREE.Vector3(j.ScaleOffset.x, j.ScaleOffset.y, j.ScaleOffset.z),
      });
    }
    const ao = datos && datos.TomCharacterAnimationOffset;
    this.porClip = {};
    if (ao) {
      this.nodo = raiz.getObjectByName(ao.AnimationOffsetTransform);
      this.fundido = ao.BlendTime || 0.5;
      for (const a of ao.Animations) {
        const n = a.AnimationName || ((a.Animation && a.Animation.PrefabPath) || '').split('/').pop();
        if (n) this.porClip[n] = a.Keyframes;
      }
      this.activo = uPos(ao.ActiveOffset || { x: 0, y: 0, z: 0 });
    }
    this.obj = new THREE.Vector3();
  }

  // clip: nombre del clip que suena; tn: su tiempo normalizado; dt: segundos del cuadro
  aplicar(clip, tn, dt) {
    for (const j of this.juntas) {
      if (j.f & 1) j.o.position.multiplyScalar(j.esc).add(j.ofs);
      if (j.f & 2) j.o.quaternion.premultiply(j.pre).multiply(j.post);
      if (j.f & 4) j.o.scale.add(j.sc);
    }
    const kfs = this.nodo && this.porClip[clip];
    if (!kfs) return;
    let k = null;
    for (let i = kfs.length - 1; i >= 0; i--) if (tn >= kfs[i].Time) { k = kfs[i]; break; }
    if (!k) return;
    const o = k.Offset;
    this.obj.set(-o.x, o.y, o.z);
    if (tn < 1e-5) this.activo.copy(this.obj);
    const bt = k.BlendTime > 0 ? k.BlendTime : this.fundido;
    const w = Math.min(1, Math.max(0, dt / bt));
    this.activo.lerp(this.obj, w);
    this.nodo.position.add(this.activo);
  }
}

// Las zonas que se tocan (los Collider del prefab, pegados a los huesos: retarget.json → zonas). Como
// Physics.Raycast: el colisionador más cercano que corta el rayo.
const EJES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
export class Zonas {
  constructor(raiz, zonas) {
    this.lista = [];
    for (const z of zonas || []) {
      let hueso = null;
      raiz.traverse((o) => { if (!hueso && o.name === z.hueso) hueso = o; });
      if (!hueso) continue;
      // Unity → glTF: x espejado
      const c = z.center ? new THREE.Vector3(-z.center[0], z.center[1], z.center[2]) : new THREE.Vector3();
      this.lista.push({ ...z, nodo: hueso, c });
    }
    this.p = new THREE.Vector3(); this.a = new THREE.Vector3(); this.b = new THREE.Vector3();
    this.s = new THREE.Vector3(); this.q = new THREE.Quaternion();
  }

  // La zona tocada por un THREE.Ray (en coordenadas del mundo), o null.
  tocar(rayo) {
    let mejor = null, dmin = Infinity;
    for (const z of this.lista) {
      z.nodo.updateWorldMatrix(true, false);
      const m = z.nodo.matrixWorld;
      m.decompose(this.a, this.q, this.s);
      const esc = Math.max(Math.abs(this.s.x), Math.abs(this.s.y), Math.abs(this.s.z));
      let d = null;
      if (z.tipo === 'SphereCollider') {
        this.p.copy(z.c).applyMatrix4(m);
        d = this.esfera(rayo, this.p, z.radius * esc);
      } else if (z.tipo === 'CapsuleCollider') {
        const r = z.radius * esc;
        const medio = Math.max(0, z.height / 2 - z.radius);
        const eje = EJES[z.direction ?? 1];
        this.a.copy(eje).multiplyScalar(medio).add(z.c).applyMatrix4(m);
        this.b.copy(eje).multiplyScalar(-medio).add(z.c).applyMatrix4(m);
        d = this.capsula(rayo, this.a, this.b, r);
      }
      if (d !== null && d < dmin) { dmin = d; mejor = z; }
    }
    if (!mejor) return null;
    return { zona: mejor.hueso, distancia: dmin, punto: rayo.at(dmin, new THREE.Vector3()) };
  }

  esfera(rayo, c, r) {
    const oc = rayo.origin.clone().sub(c);
    const b = oc.dot(rayo.direction), cc = oc.lengthSq() - r * r, h = b * b - cc;
    if (h < 0) return null;
    const t = -b - Math.sqrt(h);
    return t >= 0 ? t : (-b + Math.sqrt(h) >= 0 ? 0 : null);
  }

  capsula(rayo, a, b, r) {
    // distancia entre el rayo y el segmento ab; si es menor que r, el corte más cercano
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    const dist2 = rayo.distanceSqToSegment(a, b, p, s);
    if (dist2 > r * r) return null;
    const t1 = this.esfera(rayo, s, r);
    return t1 !== null ? t1 : rayo.origin.distanceTo(p);
  }
}
