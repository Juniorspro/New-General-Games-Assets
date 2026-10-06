/* Máquina virtual de Kismet (Blueprints de Unreal 4.16) sobre el bytecode exportado por herr/clases.py.
   Todo valor de juego queda en unidades de Unreal (cm, Z arriba); el mundo convierte al dibujar.
   No depende de three: corre igual en Node para probar la lógica. */

const DEF_STRUCT = {
  Vector: () => ({ X: 0, Y: 0, Z: 0 }), Rotator: () => ({ Pitch: 0, Yaw: 0, Roll: 0 }), Vector2D: () => ({ X: 0, Y: 0 }),
  Vector4: () => ({ X: 0, Y: 0, Z: 0, W: 0 }), LinearColor: () => ({ R: 0, G: 0, B: 0, A: 0 }), Color: () => ({ R: 0, G: 0, B: 0, A: 0 }),
  Quat: () => ({ X: 0, Y: 0, Z: 0, W: 1 }),
  Transform: () => ({ Rotation: { X: 0, Y: 0, Z: 0, W: 1 }, Translation: { X: 0, Y: 0, Z: 0 }, Scale3D: { X: 1, Y: 1, Z: 1 } }),
};
export function valorDefecto(t) {
  if (!t) return undefined;
  if (t === 'bool') return false;
  if (t === 'int' || t === 'float' || t === 'byte') return 0;
  if (t === 'str' || t === 'name' || t === 'text') return '';
  if (t === 'obj' || t === 'class' || t === 'delegate') return null;
  if (t === 'mdelegate') return [];
  if (t.startsWith('arr:') || t === 'set') return [];
  if (t === 'map') return new Map();
  if (t.startsWith('struct:')) { const f = DEF_STRUCT[t.slice(7)]; return f ? f() : {}; }
  return undefined;
}
/* Copia de valores tipo struct/array (en UE son por valor). Objetos del mundo (UObj, assets, clases) pasan por referencia. */
export function copiar(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v.__ref) return v;
  if (Array.isArray(v)) return v.map(copiar);
  if (v instanceof Map) return new Map(v);
  const o = {}; for (const k in v) o[k] = copiar(v[k]); return o;
}

let _uid = 1;
export class UObj {
  constructor(clase, nativa) {
    this.__ref = true; this.id = _uid++;
    this.clase = clase || null;            // Clase BP (o null si es puramente nativa)
    this.nat = nativa || clase?.nativa || 'Object';
    this.v = {}; this.uf = {}; this.vivo = true; this.nombre = '';
  }
  toString() { return this.nombre || (this.clase?.n || this.nat) + '#' + this.id; }
}

export class Clase {
  constructor(j, vm) {
    this.__ref = true; this.j = j; this.n = j.n; this.vm = vm; this.funcs = j.funcs || {};
    this.superNombre = j.super; this.superClase = null; this.nativa = j.super_nativo ? j.super : null;
    for (const f of Object.values(this.funcs)) if (f.code) { f.mapa = new Map(f.ofs.map((o, i) => [o, i])); }
  }
  toString() { return 'Clase:' + this.n; }
  buscar(n) { for (let c = this; c; c = c.superClase) if (c.funcs[n]?.code || c.funcs[n]?.params && c.funcs[n].code) return [c, c.funcs[n]]; return null; }
  cadena() { const r = []; for (let c = this; c; c = c.superClase) r.push(c.n); return r; }
  vars() { const r = []; for (let c = this; c; c = c.superClase) r.push(...(c.j.vars || [])); return r; }
}

export class VM {
  constructor({ cargar, nativos, mundo, log }) {
    this.cargar = cargar; this.nativos = nativos; this.mundo = mundo; this.log = log || ((...a) => console.warn('[vm]', ...a));
    this.clases = new Map(); this.latentes = new Map(); this.faltan = new Map(); this.pasos = 0;
  }
  /* ---------- clases ---------- */
  async clase(n) {
    if (!n) return null;
    if (this.clases.has(n)) return this.clases.get(n);
    const j = await this.cargar(n);
    if (!j) { this.clases.set(n, null); return null; }
    const c = new Clase(j, this); this.clases.set(n, c);
    if (!j.super_nativo && j.super) { c.superClase = await this.clase(j.super); c.nativa = c.superClase?.nativa || j.super; }
    return c;
  }
  /* Precarga todas las clases que el código puede necesitar (spawn, widgets, casts). */
  async precargar(nombres) {
    const pend = [...nombres], vistos = new Set();
    while (pend.length) {
      const n = pend.pop(); if (!n || vistos.has(n)) continue; vistos.add(n);
      const c = await this.clase(n); if (!c) continue;
      const buscar = (x) => {
        if (!x || typeof x !== 'object' || x.__ref) return;
        if (Array.isArray(x)) { if (x[0] === 'cast' && typeof x[1] === 'string' && x[1].endsWith('_C')) pend.push(x[1]); x.forEach(buscar); return; }
        if (x.clase && typeof x.clase === 'string') pend.push(x.clase);
        if (typeof x.tipo === 'string' && x.tipo.endsWith('_C') && typeof x.asset === 'string') pend.push(x.tipo);
        for (const k in x) buscar(x[k]);
      };
      buscar(c.j.funcs); buscar(c.j.cdo); buscar(c.j.plantillas); buscar(c.j.widgets); buscar(c.j.scs);
      if (c.j.super && !c.j.super_nativo) pend.push(c.j.super);
    }
  }
  claseSync(n) { return this.clases.get(n) || null; }
  esA(obj, n) {
    if (!obj || !n) return false;
    if (obj instanceof Clase) { for (let c = obj; c; c = c.superClase) if (c.n === n) return true; return this.mundo.naturalHereda(obj.nativa, n); }
    if (!(obj instanceof UObj)) return false;
    for (let c = obj.clase; c; c = c.superClase) if (c.n === n) return true;
    return this.mundo.naturalHereda(obj.nat, n);
  }
  /* Valores iniciales de las variables de una instancia */
  iniciarVars(obj, clase, resolver) {
    const cadena = []; for (let c = clase; c; c = c.superClase) cadena.unshift(c);
    for (const c of cadena) {
      for (const v of c.j.vars || []) if (!(v.n in obj.v)) obj.v[v.n] = valorDefecto(v.t);
      for (const [k, v] of Object.entries(c.j.cdo || {})) obj.v[k] = resolver ? resolver(v) : this.resolver(v);
    }
  }
  resolver(v) { return this.mundo.resolverValor(v); }
  /* ---------- ejecución ---------- */
  buscarFuncion(obj, n) {
    if (obj instanceof UObj && obj.clase) return obj.clase.buscar(n);
    if (obj instanceof Clase) return obj.buscar(n);
    return null;
  }
  /* Objeto por defecto (CDO) de una clase: lo usan las bibliotecas de funciones de Blueprint */
  cdo(c) {
    if (!c.cdoObj) { c.cdoObj = new UObj(c, c.nativa); c.cdoObj.nombre = 'Default__' + c.n; this.iniciarVars(c.cdoObj, c); }
    return c.cdoObj;
  }
  tiene(obj, n) { return !!this.buscarFuncion(obj, n); }
  /* Llama a una función (BP o nativa) por nombre con valores ya evaluados. */
  llamar(obj, n, args = [], refs = []) {
    if (!obj || obj.vivo === false) return undefined;
    const bf = this.buscarFuncion(obj, n);
    if (bf) return this.ejecutar(obj, bf[0], bf[1], n, args, refs);
    const m = this.mundo.metodo(obj, n);
    if (m) return m(obj, args, refs);
    this.falta('metodo ' + (obj.nat || '?') + '.' + n);
    return undefined;
  }
  ejecutar(obj, clase, fn, n, args, refs) {
    if (obj instanceof Clase) obj = this.cdo(obj);
    if (this.traza) this.traza.push(clase.n + '.' + n + (n.startsWith('ExecuteUbergraph') ? '@' + args[0] : ''));
    let L;
    if (n.startsWith('ExecuteUbergraph')) { L = obj.uf[n] || (obj.uf[n] = this.locales(fn)); }
    else L = this.locales(fn);
    const ps = fn.params || [];
    ps.forEach((p, i) => { if (!p.ret && i < args.length && args[i] !== undefined) L[p.n] = copiar(args[i]); });
    const F = { self: obj, L, fn, clase };
    let r;
    try { r = this.correr(F, 0); }
    catch (e) { if (e && e.__vmAbort) throw e; this.log('error en', clase.n + '.' + n, e?.stack || e); }
    ps.forEach((p, i) => { if (p.out && refs[i]) refs[i].set(copiar(L[p.n])); });
    const rp = ps.find((p) => p.ret);
    return rp ? L[rp.n] : r;
  }
  locales(fn) {
    const L = {};
    for (const p of fn.params || []) L[p.n] = valorDefecto(p.t);
    for (const p of fn.locales || []) L[p.n] = valorDefecto(p.t);
    return L;
  }
  correr(F, pc) {
    const code = F.fn.code; const pila = []; let n = 0;
    for (;;) {
      if (++n > 200000) { this.log('bucle infinito en', F.clase.n, F.fn); return; }
      const s = code[pc];
      if (!s) return;
      switch (s[0]) {
        case '=': { const r = this.ref(s[1], F); if (r) r.set(copiar(this.ev(s[2], F))); pc++; break; }
        case '=pf': { const uf = F.self.uf[F.clase.j.uber] || (F.self.uf[F.clase.j.uber] = this.locales(F.clase.funcs[F.clase.j.uber] || {})); uf[s[1]] = copiar(this.ev(s[2], F)); pc++; break; }
        case 'j': pc = s[1]; break;
        case 'jn': pc = this.ev(s[2], F) ? pc + 1 : s[1]; break;
        case 'jc': { const o = this.ev(s[1], F); const i = F.fn.mapa.get(o); if (i === undefined) { this.log('salto a', o, 'no existe'); return; } pc = i; break; }
        case 'push': pila.push(s[1]); pc++; break;
        case 'pop': if (!pila.length) return; pc = pila.pop(); break;
        case 'popn': if (!this.ev(s[1], F)) { if (!pila.length) return; pc = pila.pop(); } else pc++; break;
        case 'ret': return this.ev(s[1], F);
        case 'end': return;
        case 'seta': { const r = this.ref(s[1], F); r?.set(s[2].map((e) => copiar(this.ev(e, F)))); pc++; break; }
        case 'bind': { const r = this.ref(s[1], F); r?.set({ __ref: true, obj: this.ev(s[3], F), fn: s[2] }); pc++; break; }
        case 'madd': { const r = this.ref(s[1], F); if (r) { const a = r.get() || []; const d = this.ev(s[2], F); if (d && !a.some((x) => x.obj === d.obj && x.fn === d.fn)) a.push(d); r.set(a); } pc++; break; }
        case 'mrem': { const r = this.ref(s[1], F); if (r) { const d = this.ev(s[2], F); r.set((r.get() || []).filter((x) => !(d && x.obj === d.obj && x.fn === d.fn))); } pc++; break; }
        case 'mclr': { const r = this.ref(s[1], F); r?.set([]); pc++; break; }
        case 'mcall': { const lista = (this.ev(s[1], F) || []).slice(); const a = s[2].map((e) => this.ev(e, F)); for (const d of lista) this.llamar(d.obj, d.fn, a); pc++; break; }
        case 'x': this.ev(s[1], F); pc++; break;
        default: this.log('instrucción', s[0]); pc++;
      }
    }
  }
  /* Evalúa una expresión. T = objeto de contexto (EX_Context) para variables de instancia y llamadas. */
  ev(x, F, T) {
    switch (x[0]) {
      case 'l': return F.L[x[1]];
      case 'i': return this.mundo.leer(T === undefined ? F.self : T, x[1]);
      case 'd': return this.mundo.leer(T === undefined ? F.self : T, x[1]);
      case 'k': { const v = x[1]; return v !== null && typeof v === 'object' ? copiar(v) : v; }
      case 't': return this.mundo.texto(x[1], x[2], x[3]);
      case 's': return F.self;
      case 'o': { if (x.length > 2) return x[2]; const v = this.mundo.resolverValor(x[1]); if (v && !v.esActor && !v.esComp) x[2] = v; return v; }
      case 'st': { const o = {}; const nombres = x[2]; x[3].forEach((e, i) => { o[nombres ? nombres[i] : i] = this.ev(e, F); }); return o; }
      case 'v': return this.llamarExpr(T === undefined ? F.self : T, x[1], x[2], F, null);
      case 'f': return this.llamarNativo(T === undefined ? F.self : T, x[1], x[2], F);
      case 'fb': {
        const [cn, fnn] = x[1].split(':'); const obj = T === undefined ? F.self : T;
        const c = this.clases.get(cn);
        if (c && c.funcs[fnn]?.code) return this.llamarConArgs(obj, x[2], F, (vals, refs) => this.ejecutar(obj, c, c.funcs[fnn], fnn, vals, refs), c.funcs[fnn]);
        return this.llamarExpr(obj, fnn, x[2], F, null);
      }
      case 'c': {
        const o = this.ev(x[1], F, T);
        if (o === null || o === undefined) { if (x[2][0] !== 'i') this.falta('contexto nulo → ' + JSON.stringify(x[2]).slice(0, 80)); return undefined; }
        return this.ev(x[2], F, o);
      }
      case 'm': { const s = this.ev(x[1], F, T); return s == null ? undefined : s[x[2]]; }
      case 'ag': { const a = this.ev(x[1], F, T); const i = this.ev(x[2], F); return a ? a[i] : undefined; }
      case 'cast': { const v = this.ev(x[2], F); if (x[3] === 'EX_MetaCast') return v instanceof Clase && this.esA(v, x[1]) ? v : (v && v.nat && this.mundo.naturalHereda(v.nat, x[1]) ? v : null); return this.esA(v, x[1]) ? v : null; }
      case 'cv': { const v = this.ev(x[2], F); return /ToBool/.test(x[1] || '') ? !!v : v; }
      case 'sw': { const i = this.ev(x[1], F); for (const [k, v] of x[2]) if (this.ev(k, F) === i) return this.ev(v, F); return this.ev(x[3], F); }
      case 'dl': return { __ref: true, obj: F.self, fn: x[1] };
      case 'arr': return x[1].map((e) => this.ev(e, F));
    }
    this.log('expresión', x[0]); return undefined;
  }
  /* lvalue: {get, set} */
  ref(x, F, T) {
    const vm = this;
    switch (x[0]) {
      case 'l': return { get: () => F.L[x[1]], set: (v) => { F.L[x[1]] = v; } };
      case 'i': case 'd': { const o = T === undefined ? F.self : T; return { get: () => vm.mundo.leer(o, x[1]), set: (v) => vm.mundo.escribir(o, x[1], v) }; }
      case 'c': { const o = this.ev(x[1], F, T); if (o == null) return null; return this.ref(x[2], F, o); }
      case 'm': {
        const b = this.ref(x[1], F, T); if (!b) return null;
        return { get: () => b.get()?.[x[2]], set: (v) => { let s = b.get(); if (s == null) { s = {}; b.set(s); } s[x[2]] = v; if (s.__ref && s.nat) vm.mundo.escribir(s, x[2], v); else b.set(s); } };
      }
      case 'ag': { const a = this.ev(x[1], F, T); const i = this.ev(x[2], F); return { get: () => a?.[i], set: (v) => { if (a) a[i] = v; } }; }
    }
    return null;
  }
  refsArgs(argExprs, F) { return argExprs.map((e) => (e[0] === 'l' || e[0] === 'i' || e[0] === 'c' || e[0] === 'm' || e[0] === 'ag' ? this.ref(e, F) : null)); }
  llamarConArgs(obj, argExprs, F, fn, fdef) {
    const vals = argExprs.map((e) => this.ev(e, F));
    const refs = this.refsArgs(argExprs, F);
    return fn(vals, refs);
  }
  llamarExpr(obj, n, argExprs, F) {
    if (!obj) { this.falta('llamada sobre nulo: ' + n); return undefined; }
    const bf = this.buscarFuncion(obj, n);
    if (bf) return this.llamarConArgs(obj, argExprs, F, (vals, refs) => this.ejecutar(obj, bf[0], bf[1], n, vals, refs), bf[1]);
    const m = this.mundo.metodo(obj, n);
    if (m) return this.llamarConArgs(obj, argExprs, F, (vals, refs) => m(obj, vals, refs, F));
    this.falta('metodo ' + (obj.nat || obj.constructor?.name) + '.' + n);
    return undefined;
  }
  llamarNativo(T, clave, argExprs, F) {
    if (this.traza && !/Math|String|Array|IsValid|Select|Not_|Equal|Conv_|MakeLiteral|BreakHit/.test(clave)) this.traza.push('  ' + clave);
    const f = this.nativos[clave];
    if (f) return this.llamarConArgs(T, argExprs, F, (vals, refs) => f(T, vals, refs, F, this));
    const n = clave.split(':')[1];
    if (T) { const m = this.mundo.metodo(T, n); if (m) return this.llamarConArgs(T, argExprs, F, (vals, refs) => m(T, vals, refs, F)); }
    this.falta('nativa ' + clave);
    return undefined;
  }
  falta(q) { const k = this.faltan.get(q) || 0; if (!k) this.log('falta', q); this.faltan.set(q, k + 1); }
  /* ---------- acciones latentes (Delay, MoveComponentTo...) ---------- */
  latente(info, dur, modo = 'delay', extra = null) {
    if (!info || !info.CallbackTarget) return;
    const k = info.CallbackTarget.id + ':' + info.UUID;
    const ya = this.latentes.get(k);
    if (ya && modo === 'delay') return ya;
    const a = { obj: info.CallbackTarget, fn: info.ExecutionFunction, linkage: info.Linkage, t: dur, modo, extra };
    this.latentes.set(k, a);
    return a;
  }
  tickLatentes(dt) {
    for (const [k, a] of [...this.latentes]) {
      if (!a.obj.vivo) { this.latentes.delete(k); continue; }
      if (this.mundo.pausado && !a.obj.tickEnPausa) continue;
      if (a.cada) { if (a.cada(dt) === false) continue; }
      else { a.t -= dt; if (a.t > 0) continue; }
      if (this.latentes.get(k) !== a) continue;
      this.latentes.delete(k);
      this.llamar(a.obj, a.fn, [a.linkage]);
    }
  }
  cancelarLatentes(obj) { for (const [k, a] of [...this.latentes]) if (a.obj === obj) this.latentes.delete(k); }
}
