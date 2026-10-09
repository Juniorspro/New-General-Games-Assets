// Animator de Unity (Mecanim) para las pantallas de ui.js: la máquina de estados de cada controlador
// (parámetros, transiciones con condiciones, tiempo de salida y fundido) y los clips (curvas por ruta y
// atributo, de animui.py) aplicados a los nodos.
//
//   const an = new Animadores(ui, controladores, clips);   // una vez
//   ui.animadores = an;                                    // ui.armar() crea los de cada pantalla
//   an.cuadro(dt);                                         // cada cuadro
//   n.animador.disparar('Pressed'); n.animador.bool('Open', true); n.animador.play('Idle');

const MODO = { SI: 1, NO: 2, MAYOR: 3, MENOR: 4, SALIDA: 5, IGUAL: 6, DISTINTO: 7 };

// Valor de una curva (segmentos [t, c0, c1, c2, c3]) en el tiempo t.
function evaluar(s, t) {
  if (!s.length) return 0;
  let i = s.length - 1;
  if (t < s[i][0]) {
    let lo = 0, hi = i;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m][0] <= t) lo = m; else hi = m - 1; }
    i = lo;
  }
  const k = s[i], d = Math.max(0, t - Math.max(k[0], -1e8));
  return ((k[1] * d + k[2]) * d + k[3]) * d + k[4];
}

function sprite(sp, t) {
  let v = sp.length ? sp[0][1] : null;
  for (const [ti, n] of sp) { if (ti <= t) v = n; else break; }
  return v;
}

function constante(cur) {
  if (cur.sp) return cur.sp.length <= 1;
  return cur.s.length <= 1 && (!cur.s.length || (cur.s[0][1] === 0 && cur.s[0][2] === 0 && cur.s[0][3] === 0));
}

export class Animadores {
  constructor(ui, controladores, clips) {
    this.ui = ui;
    this.ctl = controladores;
    this.clips = clips;
    this.lista = new Set();
    for (const c of Object.values(clips)) c.quieto = c.curvas.every(constante);
  }

  crear(n, nombre) {
    const ctl = this.ctl[nombre];
    if (!ctl) return null;
    const a = new AnimadorUI(this, n, ctl, nombre);
    this.lista.add(a);
    return a;
  }

  quitar(a) { this.lista.delete(a); }

  cuadro(dt) {
    for (const a of this.lista) if (a.activo()) a.cuadro(dt);
  }
}

export class AnimadorUI {
  constructor(sis, n, ctl, nombre) {
    this.sis = sis; this.ui = sis.ui; this.n = n; this.ctl = ctl; this.nombre = nombre;
    this.p = {};
    for (const x of ctl.params) this.p[x.n] = x.tipo === 'bool' || x.tipo === 'trigger' ? !!x.def : x.def;
    this.tipos = Object.fromEntries(ctl.params.map((x) => [x.n, x.tipo]));
    this.capas = ctl.capas.map((c) => ({ c, estado: this.entrada(c), t: 0, prev: 0, sig: null, quieto: false }));
    this.defectos = new Map();       // clave → valor que tenía el nodo antes de animarlo
    this.objetivos = new Map();      // ruta → nodo
    this.velocidad = 1;
    this.enabled = true;
    this.cambio = true;
  }

  entrada(c) {
    // la máquina arranca en el estado por defecto (los selectores de entrada sin condiciones van ahí)
    return c.defecto;
  }

  activo() {
    if (!this.enabled || this.n.animadorApagado) return false;
    for (let p = this.n; p; p = p.padre) if (p.off) return false;
    return true;
  }

  // ------------------------------------------------------------ parámetros (como Animator.SetX)
  disparar(nombre) { if (nombre in this.p) { this.p[nombre] = true; this.despertar(); } }
  reiniciar(nombre) { if (nombre in this.p) this.p[nombre] = false; }
  bool(nombre, v) { if (nombre in this.p && this.p[nombre] !== !!v) { this.p[nombre] = !!v; this.despertar(); } }
  float(nombre, v) { if (nombre in this.p && this.p[nombre] !== v) { this.p[nombre] = v; this.despertar(); } }
  entero(nombre, v) { this.float(nombre, v | 0); }
  despertar() { for (const l of this.capas) l.quieto = false; this.cambio = true; }

  // Animator.Play(estado, capa, tiempoNormalizado)
  play(nombre, capa = 0, tn = 0) {
    const l = this.capas[capa]; if (!l) return;
    const i = l.c.estados.findIndex((e) => e.n === nombre);
    if (i < 0) return;
    l.estado = i; l.t = tn; l.prev = tn; l.sig = null; l.quieto = false;
    this.cambio = true;
  }

  estadoActual(capa = 0) { const l = this.capas[capa]; return l && l.c.estados[l.estado].n; }
  enTransicion(capa = 0) { const l = this.capas[capa]; return !!(l && l.sig); }
  tiempoNormalizado(capa = 0) { const l = this.capas[capa]; return l ? l.t : 0; }

  // ------------------------------------------------------------ máquina de estados
  durEstado(e) {
    const m = e.motivo;
    if (!m) return 1;
    if (m.clip !== undefined) { const c = this.clip(m.clip); return c && c.dur > 0 ? c.dur : 1; }
    return 1;
  }

  clip(i) { const n = this.ctl.clips[i]; return n ? this.sis.clips[n] : null; }

  velEstado(e) { return e.vel * (e.velParam ? this.p[e.velParam] ?? 1 : 1) * this.velocidad; }

  condiciones(conds) {
    for (const [modo, par, umbral] of conds) {
      const v = this.p[par];
      switch (modo) {
        case MODO.SI: if (!v) return false; break;
        case MODO.NO: if (v) return false; break;
        case MODO.MAYOR: if (!(v > umbral)) return false; break;
        case MODO.MENOR: if (!(v < umbral)) return false; break;
        case MODO.IGUAL: if (v !== umbral) return false; break;
        case MODO.DISTINTO: if (v === umbral) return false; break;
        default: break;
      }
    }
    return true;
  }

  consumir(conds) {
    for (const [, par] of conds) if (this.tipos[par] === 'trigger') this.p[par] = false;
  }

  // ¿se cumple el tiempo de salida en este paso (de prev a t, normalizados)?
  salida(tr, prev, t, bucle) {
    if (!tr.conSalida) return true;
    const s = tr.salida;
    if (s < 1 && bucle) {
      // se repite en cada vuelta
      const a = prev - Math.floor(prev), b = t - Math.floor(prev);
      return (a < s && b >= s) || b >= 1 + s;
    }
    return prev < s && t >= s || (t >= s && prev === 0 && t === 0 && s === 0);
  }

  probar(l, lista, desdeCualquiera) {
    const e = l.c.estados[l.estado];
    const bucle = this.esBucle(e);
    for (const tr of lista) {
      if (desdeCualquiera && !tr.aSiMismo && tr.a === l.estado && !l.sig) continue;
      if (desdeCualquiera && l.sig && tr.a === l.sig.estado) continue;
      if (!tr.conds.length && !tr.conSalida) continue;
      if (!this.condiciones(tr.conds)) continue;
      if (!desdeCualquiera && !this.salida(tr, l.prev, l.t, bucle)) continue;
      return tr;
    }
    return null;
  }

  esBucle(e) {
    const m = e.motivo;
    if (m && m.clip !== undefined) { const c = this.clip(m.clip); return c ? c.bucle : e.bucle; }
    return e.bucle;
  }

  iniciar(l, tr) {
    this.consumir(tr.conds);
    const ori = l.c.estados[l.estado];
    const dur = tr.fija ? tr.dur : tr.dur * this.durEstado(ori);
    const destino = tr.a;
    if (destino < 0 || destino >= l.c.estados.length) return;
    if (dur <= 0) {
      l.estado = destino; l.t = tr.ofs; l.prev = tr.ofs; l.sig = null;
    } else {
      l.sig = { estado: destino, t: tr.ofs, prev: tr.ofs, pasado: 0, dur };
    }
    l.quieto = false;
    this.cambio = true;
  }

  cuadro(dt) {
    let algo = this.cambio;
    for (const l of this.capas) {
      if (l.quieto && !this.cambio) continue;
      const e = l.c.estados[l.estado];
      const d = this.durEstado(e);
      l.prev = l.t;
      l.t += (dt * this.velEstado(e)) / d;
      if (l.sig) {
        const s = l.sig, es = l.c.estados[s.estado];
        s.prev = s.t;
        s.t += (dt * this.velEstado(es)) / this.durEstado(es);
        s.pasado += dt;
        if (s.pasado >= s.dur) {
          l.estado = s.estado; l.t = s.t; l.prev = s.prev; l.sig = null;
        }
      }
      // transiciones: primero las de "cualquier estado", después las del estado actual
      let tr = this.probar(l, l.c.cualquiera, true);
      if (!tr && !l.sig) tr = this.probar(l, e.trans, false);
      if (tr) this.iniciar(l, tr);
      algo = true;
    }
    if (!algo) return;
    this.cambio = false;
    this.aplicar();
  }

  // ------------------------------------------------------------ valores
  muestrear(e, tn, valores, peso) {
    const m = e.motivo;
    if (!m) return;
    let clips;
    if (m.clip !== undefined) clips = [[m.clip, 1]];
    else if (m.arbol) clips = this.pesosArbol(m.arbol);
    else return;
    for (const [ci, w] of clips) {
      const c = this.clip(ci);
      if (!c || w <= 0) continue;
      let t = tn * (c.dur || 0);
      if (c.dur > 0) t = c.bucle ? (tn - Math.floor(tn)) * c.dur : Math.min(Math.max(tn, 0), 1) * c.dur;
      t += c.ini || 0;
      for (const cur of c.curvas) {
        const k = cur.r + '|' + cur.t + '|' + cur.a;
        const v = cur.sp ? sprite(cur.sp, t) : evaluar(cur.s, t);
        const x = valores.get(k);
        if (cur.sp) { if (!x || w * peso >= x.w) valores.set(k, { cur, v, w: w * peso }); continue; }
        if (x) { x.v += v * w * peso; x.w += w * peso; } else valores.set(k, { cur, v: v * w * peso, w: w * peso });
      }
    }
  }

  pesosArbol(a) {
    const x = this.p[a.param] ?? 0, u = a.umbrales, h = a.hijos;
    if (!h.length) return [];
    if (x <= u[0]) return [[h[0], 1]];
    if (x >= u[u.length - 1]) return [[h[h.length - 1], 1]];
    for (let i = 0; i < u.length - 1; i++) {
      if (x >= u[i] && x <= u[i + 1]) {
        const f = (x - u[i]) / ((u[i + 1] - u[i]) || 1);
        return [[h[i], 1 - f], [h[i + 1], f]];
      }
    }
    return [[h[0], 1]];
  }

  aplicar() {
    const total = new Map();
    for (const l of this.capas) {
      const e = l.c.estados[l.estado];
      const val = new Map();
      if (l.sig) {
        const w = Math.min(1, l.sig.pasado / l.sig.dur);
        this.muestrear(e, l.t, val, 1 - w);
        this.muestrear(l.c.estados[l.sig.estado], l.sig.t, val, w);
      } else {
        this.muestrear(e, l.t, val, 1);
        // un estado que no cambia más (sin curvas que se muevan ni salidas por tiempo) no hace falta muestrearlo
        const m = e.motivo, c = m && m.clip !== undefined ? this.clip(m.clip) : null;
        if ((!m || (c && (c.quieto || (!c.bucle && l.t >= 1)))) && !e.trans.some((t) => t.conSalida)) l.quieto = true;
      }
      const escribe = (l.sig ? l.c.estados[l.sig.estado] : e).escribeDef;
      for (const [k, x] of val) {
        const v = x.cur.sp ? x.v : x.w > 0 && x.w < 0.999 ? this.mezclarDefecto(x, k) : x.v;
        total.set(k, { cur: x.cur, v });
      }
      if (escribe) for (const [k, d] of this.defectos) if (!total.has(k)) total.set(k, { cur: d.cur, v: d.v });
    }
    for (const [k, x] of total) this.poner(k, x.cur, x.v);
    this.ui.despuesDeAnimar(this);
  }

  // durante un fundido, una curva que tiene uno solo de los dos estados se mezcla con su valor por defecto
  mezclarDefecto(x, k) {
    const d = this.defectos.get(k) || { v: this.leer(x.cur) };
    return x.v + d.v * (1 - x.w);
  }

  objetivo(ruta) {
    if (this.objetivos.has(ruta)) return this.objetivos.get(ruta);
    let n = this.n;
    if (ruta) {
      for (const parte of ruta.split('/')) {
        n = n && (n.h || []).find((h) => h.n === parte);
        if (!n) break;
      }
    }
    this.objetivos.set(ruta, n || null);
    return n || null;
  }

  leer(cur) {
    const n = this.objetivo(cur.r);
    return n ? this.ui.leerPropiedad(n, cur.t, cur.a) : 0;
  }

  poner(k, cur, v) {
    const n = this.objetivo(cur.r);
    if (!n) return;
    if (!this.defectos.has(k)) this.defectos.set(k, { cur, v: this.ui.leerPropiedad(n, cur.t, cur.a) });
    this.ui.ponerPropiedad(n, cur.t, cur.a, v);
  }
}
