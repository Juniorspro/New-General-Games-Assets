/* El mundo: arma las escenas exportadas (nodos y componentes), corre el ciclo de Unity cuadro a cuadro
   (FixedUpdate a 50 por segundo con la física, Update, corrutinas, LateUpdate) y cambia de escena.
   Los sistemas (dibujo, física, navegación, sonido, interfaz, entrada) se enganchan con sus fábricas de
   componentes y sus pasos. */
import { Nodo, MonoBehaviour, Time, resolver } from './motor.js';
import { traer } from './archivos.js';

export const CLASES = {};       // guiones por nombre (los portados y los de UnityEngine.UI)
export const FABRICAS = {};     // clave del nodo exportado → (nodo, datos, mundo) => componentes
export function registrar(...clases) { for (const C of clases) for (const t of C.tipos) CLASES[t] = C; }

export class Mundo {
  constructor(base, C, recursos) {
    this.base = base; this.C = C; this.recursos = recursos;
    this.nodos = []; this.comps = []; this.guiones = []; this.sistemas = [];
    this.escena = null; this.pendiente = null; this.acumFijo = 0; this.invocaciones = [];
    this.alCambiarEscena = [];
    this.porNombre = Object.fromEntries(C.escenas.map((e) => [e.nombre, e.num]));
  }
  sistema(s) { this.sistemas.push(s); s.mundo = this; return s; }

  /* --- armar nodos desde los datos (escena o prefab) */
  armar(datos, padre = null, raices = null) {
    const ns = datos.map((d) => {
      const n = new Nodo(this, d.n);
      if (d.tag) n.tag = d.tag;
      if (d.capa) n.layer = d.capa;
      n.activeSelf = !d.inactivo;
      n.lp.set(d.t[0], d.t[1], -d.t[2]); n.lr.set(-d.r[0], -d.r[1], d.r[2], d.r[3]); n.ls.set(d.s[0], d.s[1], d.s[2]);
      if (d.ui) n.ui = { amin: [...d.ui.amin], amax: [...d.ui.amax], pos: [...d.ui.pos], tam: [...d.ui.tam], piv: [...d.ui.piv] };
      n.datos = d;
      return n;
    });
    ns.forEach((n, i) => {
      const p = datos[i].p >= 0 ? ns[datos[i].p] : padre;
      if (p) { n.parent = p; p.children.push(n); } else if (raices) raices.push(n);
      this.nodos.push(n);
    });
    // componentes: primero todos, después las referencias (un guion puede nombrar a otro que viene después)
    const mapaPid = new Map(), nuevos = [];
    ns.forEach((n, i) => {
      const d = datos[i];
      for (const clave in FABRICAS) if (d[clave] !== undefined) for (const c of FABRICAS[clave](n, d[clave], this, d) || []) { n.comps.push(c); nuevos.push(c); if (c.pid !== undefined) mapaPid.set(c.pid, c); }
      for (const g of d.guiones || []) {
        const C = CLASES[g.n];
        if (!C) continue;
        const c = new C(n, g); c._datos = g;
        n.comps.push(c); nuevos.push(c); if (g.pid !== undefined) mapaPid.set(g.pid, c);
      }
    });
    for (const c of nuevos) {
      if (c._datos) {
        for (const k in c._datos) if (k !== 'n' && k !== 'on' && k !== 'pid') c[k] = resolver(this, c._datos[k], ns, mapaPid);
        delete c._datos;
      }
      c.alArmar?.(ns, mapaPid);
      this._nuevoComp(c, true);
    }
    return ns;
  }
  _nuevoComp(c, armando = false) {
    this.comps.push(c);
    if (c instanceof MonoBehaviour) this.guiones.push(c);
    for (const s of this.sistemas) s.nuevoComp?.(c);
    if (!armando) this._refrescarComp(c);
  }

  /* --- activo en la jerarquía: Awake, OnEnable y OnDisable como en Unity */
  _refrescarActivo(n) {
    const antes = [];
    const visitar = (x, padreActivo) => {
      const act = padreActivo && x.activeSelf && !x.destruido;
      if (act !== x._activoH) { x._activoH = act; antes.push(x); }
      for (const h of x.children) visitar(h, act);
    };
    visitar(n, n.parent ? n.parent._activoH : true);
    for (const x of antes) for (const c of x.comps) this._refrescarComp(c);
  }
  _cambioHabilitado(c) { this._refrescarComp(c); }
  _refrescarComp(c) {
    const vivo = c._en && c.nodo._activoH;
    if (c instanceof MonoBehaviour && c.nodo._activoH && !c._desperto) { c._desperto = true; this.llamar(c, 'Awake'); }
    if (vivo === !!c._vivo) return;
    c._vivo = vivo;
    if (vivo) { c._prender(); if (c instanceof MonoBehaviour) this.llamar(c, 'OnEnable'); }
    else { c._apagar(); if (c instanceof MonoBehaviour) { c._corr.length = 0; this.llamar(c, 'OnDisable'); } }
  }
  llamar(c, metodo, ...args) {
    const f = c[metodo];
    if (typeof f !== 'function') return;
    try { f.apply(c, args); } catch (e) { console.error(c.constructor.name + '.' + metodo, e); }
  }

  /* --- escenas */
  async cargarEscena(cual) {
    const num = typeof cual === 'number' ? cual : this.porNombre[cual];
    const E = await traer(this.base + 'datos/escena-' + num + '.json');
    // lo que no se destruye al cargar (DontDestroyOnLoad) se queda
    for (const n of this.nodos) if (!n.parent && !n.noDestruir) this._destruirYa(n);
    this.nodos = this.nodos.filter((n) => !n.destruido); this.comps = this.comps.filter((c) => !c.nodo.destruido);
    this.guiones = this.guiones.filter((c) => !c.nodo.destruido); this.invocaciones = [];
    this.escena = { num, nombre: E.nombre, datos: E, render: { ...E.render } };
    for (const s of this.sistemas) await s.antesDeEscena?.(this.escena);
    const raices = [];
    this.armar(E.nodos, null, raices);
    for (const s of this.sistemas) await s.alCargar?.(this.escena);
    for (const r of raices) this._refrescarActivo(r);
    for (const f of this.alCambiarEscena) f(this.escena);
  }
  LoadScene(nombre) { this.pendiente = nombre; }

  /* --- Instantiate / Destroy */
  Instantiate(original, pos, rot) {
    let raiz;
    if (original && original.prefab) {
      const P = this.C.prefabs[original.prefab];
      const ns = this.armar(P.nodos, null, []);
      raiz = ns[0];
      if (pos) raiz.lp.copy(pos);
      if (rot) raiz.lr.copy(rot);
      raiz._ensuciar();
      for (const s of this.sistemas) s.alInstanciar?.(ns);
      this._refrescarActivo(raiz);
    } else throw new Error('Instantiate: solo prefabs');
    return raiz;
  }
  Destroy(x, t = 0) {
    const n = x?.nodo && !(x instanceof Nodo) ? null : x;
    if (!n) { if (x) { x.enabled = false; x._destruido = true; } return; }
    if (t > 0) { this.invocaciones.push({ t: Time.time + t, f: () => this._destruirYa(n) }); return; }
    this._destruirYa(n);
  }
  _destruirYa(n) {
    if (n.destruido) return;
    const marcar = (x) => { x.destruido = true; x.children.forEach(marcar); };
    marcar(n);
    this._refrescarActivo(n);
    for (const s of this.sistemas) s.alDestruir?.(n);
    if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); }
  }
  invocar(c, nombre, t) { this.invocaciones.push({ t: Time.time + t, f: () => { if (c.isActiveAndEnabled) this.llamar(c, nombre); } }); }

  /* --- corrutinas: yield null → próximo cuadro; {seg} → espera escalada; {fin} → al final del cuadro */
  _pasoCorrutina(c, corr, fase) {
    if (corr.espera) {
      if (corr.espera.seg !== undefined) { if (Time.time < corr.espera.hasta) return; }
      else if (corr.espera.fin && fase !== 'fin') return;
      else if (!corr.espera.fin && fase === 'fin') return;
    } else if (fase === 'fin') return;
    let r;
    try { r = corr.g.next(); } catch (e) { console.error('corrutina', c.constructor.name, e); r = { done: true }; }
    if (r.done) { const i = c._corr.indexOf(corr); if (i >= 0) c._corr.splice(i, 1); return; }
    const y = r.value;
    corr.espera = y && y.seg !== undefined ? { seg: y.seg, hasta: Time.time + y.seg } : y && y.fin ? { fin: true } : { cuadro: true };
  }
  _corrutinas(fase) {
    for (const c of this.guiones) {
      if (!c._corr.length || !c.nodo._activoH || c.nodo.destruido) continue;
      for (const corr of [...c._corr]) this._pasoCorrutina(c, corr, fase);
    }
  }

  /* --- un cuadro */
  async paso(dt) {
    if (this.pendiente !== null) { const p = this.pendiente; this.pendiente = null; Time.timeScale = 1; await this.cargarEscena(p); return; }
    dt = Math.min(dt, 0.1);
    Time.unscaledDeltaTime = dt; Time.unscaledTime += dt;
    Time.deltaTime = dt * Time.timeScale; Time.time += Time.deltaTime; Time.frameCount++;
    for (const s of this.sistemas) s.antesDelCuadro?.(dt);
    // FixedUpdate y física a paso fijo (con timeScale 0 no corre)
    this.acumFijo += Time.deltaTime;
    let pasos = 0;
    const dtReal = Time.deltaTime;
    while (this.acumFijo >= Time.fixedDeltaTime && pasos < 5) {
      this.acumFijo -= Time.fixedDeltaTime; pasos++;
      Time.deltaTime = Time.fixedDeltaTime;
      this._fase('FixedUpdate');
      for (const s of this.sistemas) s.pasoFijo?.(Time.fixedDeltaTime);
    }
    if (pasos >= 5) this.acumFijo = 0;
    Time.deltaTime = dtReal;
    this._empezar();
    this._fase('Update');
    for (const inv of this.invocaciones.filter((x) => Time.time >= x.t)) { this.invocaciones.splice(this.invocaciones.indexOf(inv), 1); inv.f(); }
    this._corrutinas('cuadro');
    for (const s of this.sistemas) s.trasUpdate?.(Time.deltaTime);
    this._fase('LateUpdate');
    for (const s of this.sistemas) s.trasLateUpdate?.(Time.deltaTime);
    this._corrutinas('fin');
    for (const s of this.sistemas) s.finDelCuadro?.(dt);
    this.nodos = this.nodos.filter((n) => !n.destruido);
    if (this.comps.some((c) => c.nodo.destruido)) { this.comps = this.comps.filter((c) => !c.nodo.destruido); this.guiones = this.guiones.filter((c) => !c.nodo.destruido); }
  }
  _empezar() {
    for (const c of this.guiones) if (!c._empezo && c._vivo) { c._empezo = true; this.llamar(c, 'Start'); }
  }
  _fase(m) {
    for (const c of this.guiones) if (c._vivo && c._empezo && typeof c[m] === 'function' && !c.nodo.destruido) this.llamar(c, m);
  }
  // mensajes de física (OnTriggerEnter…) a los guiones de un nodo
  mensaje(n, metodo, arg) { for (const c of n.comps) if (c instanceof MonoBehaviour && c._vivo && typeof c[metodo] === 'function') this.llamar(c, metodo, arg); }
  buscar(nombre) { return this.nodos.find((n) => n.name === nombre && !n.destruido) || null; }
}
