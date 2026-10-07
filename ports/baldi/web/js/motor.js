/* Un Unity chiquito para correr Baldi's Basics tal como fue escrito: GameObject y Transform (en un solo
   objeto, Nodo), componentes con su ciclo (Awake, OnEnable, Start, Update, FixedUpdate, LateUpdate,
   OnDisable), corrutinas con generadores, Instantiate/Destroy, escenas y PlayerPrefs.
   Toda la lógica corre en el espacio de Unity (mano izquierda, grados); la cuenta es la misma de three
   (cuaterniones, productos cruz, Euler YXZ), solo cambia el dibujo: matriz de three = S·M·S con S = z→-z. */
import * as THREE from 'three';

export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const Time = { deltaTime: 0, unscaledDeltaTime: 0, timeScale: 1, time: 0, unscaledTime: 0, frameCount: 0, fixedDeltaTime: 0.02 };

// redondeo de C# (Math.Round): las mitades van al par
const redondear = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
export const Mathf = {
  RoundToInt: redondear, CeilToInt: Math.ceil, FloorToInt: Math.floor, Abs: Math.abs, Sign: (x) => (x >= 0 ? 1 : -1),
  Clamp: (x, a, b) => Math.min(b, Math.max(a, x)), Clamp01: (x) => Math.min(1, Math.max(0, x)), Lerp: (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t)),
  Sin: Math.sin, Cos: Math.cos, Atan2: Math.atan2, Sqrt: Math.sqrt, Min: Math.min, Max: Math.max, PI: Math.PI,
  Repeat: (t, l) => t - Math.floor(t / l) * l,
  DeltaAngle(a, b) { let d = Mathf.Repeat(b - a, 360); if (d > 180) d -= 360; return d; },
};
// Random.Range(float, float) incluye el máximo; el de enteros no (RangeI)
export const Random = { Range: (a, b) => a + Math.random() * (b - a), RangeI: (a, b) => (b <= a ? a : a + Math.floor(Math.random() * (b - a))), get value() { return Math.random(); } };

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const V = {
  up: () => v3(0, 1, 0), forward: () => v3(0, 0, 1), right: () => v3(1, 0, 0), zero: () => v3(),
  add: (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z), sub: (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z), mul: (a, s) => v3(a.x * s, a.y * s, a.z * s),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), mag: (a) => Math.hypot(a.x, a.y, a.z), norm: (a) => { const l = Math.hypot(a.x, a.y, a.z); return l > 1e-5 ? v3(a.x / l, a.y / l, a.z / l) : v3(); },
  eq: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 < 1e-10,
};
export const Quat = {
  Euler(x, y, z) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * D2R, y * D2R, z * D2R, 'YXZ')); },
  identity: () => new THREE.Quaternion(),
  mul: (a, b) => new THREE.Quaternion().multiplyQuaternions(a, b),
  rot: (q, v) => v.clone().applyQuaternion(q),
  LookRotation(f, up = v3(0, 1, 0)) {
    const z = f.clone(); if (z.lengthSq() < 1e-12) return new THREE.Quaternion(); z.normalize();
    let x = new THREE.Vector3().crossVectors(up, z); if (x.lengthSq() < 1e-12) x = new THREE.Vector3().crossVectors(v3(1, 0, 0), z); x.normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  },
  euler(q) { const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); const n = (a) => { a *= R2D; a %= 360; if (a < 0) a += 360; return Math.abs(a) < 1e-4 || Math.abs(a - 360) < 1e-4 ? 0 : a; }; return v3(n(e.x), n(e.y), n(e.z)); },
};
export const Color = { red: [1, 0, 0, 1], white: [1, 1, 1, 1], black: [0, 0, 0, 1], clear: [0, 0, 0, 0] };

/* ---------- PlayerPrefs en localStorage (con try: puede no haber) */
const PP = 'baldi.';
export const PlayerPrefs = {
  _m: {},
  _leer(k) { if (k in this._m) return this._m[k]; try { const v = localStorage.getItem(PP + k); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } },
  _poner(k, v) { this._m[k] = v; try { localStorage.setItem(PP + k, JSON.stringify(v)); } catch { /* sin guardado */ } },
  GetInt(k, d = 0) { const v = this._leer(k); return typeof v === 'number' ? Math.trunc(v) : d; },
  GetFloat(k, d = 0) { const v = this._leer(k); return typeof v === 'number' ? v : d; },
  GetString(k, d = '') { const v = this._leer(k); return typeof v === 'string' ? v : d; },
  SetInt(k, v) { this._poner(k, Math.trunc(v)); }, SetFloat(k, v) { this._poner(k, v); }, SetString(k, v) { this._poner(k, String(v)); },
  HasKey(k) { return this._leer(k) !== undefined; },
};

/* ---------- Nodo = GameObject + Transform */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
let VERSION = 1;
export class Nodo {
  constructor(mundo, nombre = 'GameObject') {
    this.mundo = mundo; this.name = nombre; this.tag = 'Untagged'; this.layer = 0;
    this.activeSelf = true; this._activoH = false; this.parent = null; this.children = []; this.comps = [];
    this.lp = v3(); this.lr = new THREE.Quaternion(); this.ls = v3(1, 1, 1);
    this._mw = new THREE.Matrix4(); this._sucio = true; this.ver = VERSION++; this.destruido = false;
    this.ui = null; // RectTransform (anclas, tamaño, pivote) si es de interfaz
  }
  get transform() { return this; }
  get gameObject() { return this; }
  get activeInHierarchy() { return this._activoH; }
  toString() { return this.name; }
  /* --- jerarquía y matrices */
  _ensuciar() { this._sucio = true; this.ver = VERSION++; for (const h of this.children) h._ensuciar(); }
  get matrizMundo() {
    if (this._sucio) {
      this._mw.compose(this.lp, this.lr, this.ls);
      if (this.parent) this._mw.premultiply(this.parent.matrizMundo);
      this._sucio = false;
    }
    return this._mw;
  }
  get position() { return v3().setFromMatrixPosition(this.matrizMundo); }
  set position(p) {
    if (this.parent) { _m.copy(this.parent.matrizMundo).invert(); this.lp.copy(p).applyMatrix4(_m); } else this.lp.copy(p);
    this._uiDesdeLocal(); this._ensuciar();
  }
  get rotation() { return this.parent ? Quat.mul(this.parent.rotation, this.lr) : this.lr.clone(); }
  set rotation(q) { if (this.parent) this.lr.copy(this.parent.rotation.invert().multiply(q)); else this.lr.copy(q); this.lr.normalize(); this._ensuciar(); }
  get localPosition() { return this.lp.clone(); }
  set localPosition(p) { this.lp.copy(p); this._uiDesdeLocal(); this._ensuciar(); }
  // en la interfaz la posición sale de las anclas: mover el nodo cambia anchoredPosition
  _uiDesdeLocal() { if (this.ui?._ref) this.ui.pos = [this.lp.x - this.ui._ref[0], this.lp.y - this.ui._ref[1]]; }
  get anchoredPosition() { return v3(this.ui?.pos[0] || 0, this.ui?.pos[1] || 0, 0); }
  set anchoredPosition(p) { if (this.ui) this.ui.pos = [p.x, p.y]; }
  get sizeDelta() { return v3(this.ui?.tam[0] || 0, this.ui?.tam[1] || 0, 0); }
  set sizeDelta(p) { if (this.ui) this.ui.tam = [p.x, p.y]; }
  get rect() { const r = this.ui?._rect || { x: 0, y: 0, w: 0, h: 0 }; return { x: r.x, y: r.y, width: r.w, height: r.h }; }
  get localRotation() { return this.lr.clone(); }
  set localRotation(q) { this.lr.copy(q); this._ensuciar(); }
  get localScale() { return this.ls.clone(); }
  set localScale(s) { this.ls.copy(s); this._ensuciar(); }
  get lossyScale() { this.matrizMundo.decompose(_v, _q, _s); return _s.clone(); }
  get eulerAngles() { return Quat.euler(this.rotation); }
  set eulerAngles(e) { this.rotation = Quat.Euler(e.x, e.y, e.z); }
  get localEulerAngles() { return Quat.euler(this.lr); }
  set localEulerAngles(e) { this.localRotation = Quat.Euler(e.x, e.y, e.z); }
  get forward() { return v3(0, 0, 1).applyQuaternion(this.rotation); }
  get right() { return v3(1, 0, 0).applyQuaternion(this.rotation); }
  get up() { return v3(0, 1, 0).applyQuaternion(this.rotation); }
  LookAt(t, up = v3(0, 1, 0)) { const p = t instanceof Nodo ? t.position : t; this.rotation = Quat.LookRotation(V.sub(p, this.position), up); }
  Rotate(e, mundo = false) { const q = Quat.Euler(e.x, e.y, e.z); if (mundo) this.rotation = Quat.mul(q, this.rotation); else { this.lr.multiply(q).normalize(); this._ensuciar(); } }
  Translate(d) { this.position = V.add(this.position, d.clone().applyQuaternion(this.rotation)); }
  TransformPoint(p) { return p.clone().applyMatrix4(this.matrizMundo); }
  InverseTransformPoint(p) { return p.clone().applyMatrix4(_m.copy(this.matrizMundo).invert()); }
  SetParent(p, mantener = true) {
    const pos = this.position, rot = this.rotation;
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = p || null; if (p) p.children.push(this);
    if (mantener) { this.position = pos; this.rotation = rot; } else this._ensuciar();
    this.mundo._refrescarActivo(this);
  }
  Find(ruta) { let n = this; for (const parte of ruta.split('/')) { n = n.children.find((h) => h.name === parte); if (!n) return null; } return n; }
  GetChild(i) { return this.children[i]; }
  get childCount() { return this.children.length; }
  /* --- GameObject */
  SetActive(b) { b = !!b; if (this.activeSelf === b) return; this.activeSelf = b; this.mundo._refrescarActivo(this); }
  CompareTag(t) { return this.tag === t; }
  GetComponent(tipo) { return this.comps.find((c) => c.esDe(tipo)) || null; }
  GetComponents(tipo) { return this.comps.filter((c) => c.esDe(tipo)); }
  GetComponentInChildren(tipo) { const c = this.GetComponent(tipo); if (c) return c; for (const h of this.children) { const r = h.GetComponentInChildren(tipo); if (r) return r; } return null; }
  GetComponentsInChildren(tipo, lista = []) { lista.push(...this.GetComponents(tipo)); for (const h of this.children) h.GetComponentsInChildren(tipo, lista); return lista; }
  GetComponentInParent(tipo) { let n = this; while (n) { const c = n.GetComponent(tipo); if (c) return c; n = n.parent; } return null; }
  AddComponent(Clase, datos = {}) { const c = new Clase(this, datos); this.comps.push(c); this.mundo._nuevoComp(c); return c; }
}

/* ---------- componentes */
export class Componente {
  constructor(nodo, datos = {}) { this.nodo = nodo; this._en = datos.on === undefined ? true : !!datos.on; this.pid = datos.pid; }
  static get tipos() { return [this.name]; }
  esDe(tipo) { return typeof tipo === 'string' ? this.constructor.tipos.includes(tipo) : this instanceof tipo; }
  get gameObject() { return this.nodo; }
  get transform() { return this.nodo; }
  get name() { return this.nodo.name; }
  get tag() { return this.nodo.tag; }
  CompareTag(t) { return this.nodo.tag === t; }
  get enabled() { return this._en; }
  set enabled(b) { b = !!b; if (b === this._en) return; this._en = b; this.nodo.mundo._cambioHabilitado(this); }
  get isActiveAndEnabled() { return this._en && this.nodo._activoH; }
  GetComponent(t) { return this.nodo.GetComponent(t); }
  GetComponentInChildren(t) { return this.nodo.GetComponentInChildren(t); }
  // ganchos del motor: el componente se prende o se apaga (nodo activo y habilitado)
  _prender() {} _apagar() {}
}

export class MonoBehaviour extends Componente {
  constructor(nodo, datos) { super(nodo, datos); this._corr = []; this._desperto = false; this._empezo = false; }
  StartCoroutine(g) { if (typeof g === 'string') g = this[g](); const c = { g, espera: null }; this._corr.push(c); this.nodo.mundo._pasoCorrutina(this, c, null); return c; }
  StopCoroutine(c) { const i = this._corr.indexOf(c); if (i >= 0) this._corr.splice(i, 1); }
  StopAllCoroutines() { this._corr.length = 0; }
  Invoke(nombre, t) { this.nodo.mundo.invocar(this, nombre, t); }
}
// lo que devuelve una corrutina con yield
export const WaitForSeconds = (s) => ({ seg: s });
export const WaitForEndOfFrame = () => ({ fin: true });

/* ---------- referencias de los datos: {nodo, comp, pid} y recursos */
export function resolver(mundo, v, mapaNodos, mapaPid) {
  if (Array.isArray(v)) return v.map((x) => resolver(mundo, x, mapaNodos, mapaPid));
  if (!v || typeof v !== 'object') return v;
  if (v.nodo !== undefined) {
    const n = mapaNodos[v.nodo];
    if (!n) return null;
    n.referido = true; // un guion lo nombra: puede moverse o apagarse
    if (!v.comp || v.comp === 'Transform' || v.comp === 'RectTransform' || v.comp === 'GameObject') return n;
    return mapaPid.get(v.pid) || n.comps.find((c) => c.esDe(v.comp)) || null;
  }
  if (v.audio !== undefined) return mundo.recursos.clip(v.audio);
  if (v.tex !== undefined) return mundo.recursos.tex(v.tex);
  if (v.sprite !== undefined) return mundo.recursos.sprite(v.sprite);
  if (v.mat !== undefined) return mundo.recursos.mat(v.mat);
  if (v.prefab !== undefined) return { prefab: v.prefab };
  if (v.tmpf !== undefined) return { tmpf: v.tmpf };
  if (v.fuente !== undefined) return { fuente: v.fuente };
  if (v.otro !== undefined || v.falta !== undefined || v.malo !== undefined) return null;
  if (v.m_PersistentCalls) { // eventos de Unity: las llamadas guardadas con su destino
    return { calls: (v.m_PersistentCalls.m_Calls || []).map((c) => ({ target: resolver(mundo, c.m_Target, mapaNodos, mapaPid), metodo: c.m_MethodName, modo: c.m_Mode,
      args: { ...(c.m_Arguments || {}), m_ObjectArgument: resolver(mundo, c.m_Arguments?.m_ObjectArgument, mapaNodos, mapaPid) }, estado: c.m_CallState })) };
  }
  const o = {};
  for (const k in v) o[k] = resolver(mundo, v[k], mapaNodos, mapaPid);
  return o;
}
