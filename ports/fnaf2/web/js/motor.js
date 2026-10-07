/* Motor de Clickteam Fusion 2.5 para el port de FNaF 2: corre los eventos del juego tal como vienen en el .exe
   (herr/exportar.py los pasa a datos/juego.json). Frames con capas y desplazamiento, objetos activos con
   animaciones y trayectorias, contadores, textos, INI (en localStorage), sonido por canales, fundidos y el efecto
   panorama (Perspective) que curva la oficina. Un «loop» es un cuadro lógico a 60 por segundo, como el original. */

const CMP = [(a, b) => a == b, (a, b) => a != b, (a, b) => a <= b, (a, b) => a < b, (a, b) => a >= b, (a, b) => a > b];
const PREC = { 2: 1, 4: 1, 6: 2, 8: 2, 10: 2, 12: 3 };
const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

function operar(op, a, b) {
  if (op === 2) return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b;
  a = num(a); b = num(b);
  switch (op) {
    case 4: return a - b;
    case 6: return a * b;
    case 8: if (!b) return 0; return Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b;
    case 10: return b ? a % b : 0;
    case 12: return a ** b;
    case 14: return a & b;
    case 16: return a | b;
    case 18: return a ^ b;
  }
  return 0;
}

/* Expresión → función (ctx) => valor. Fichas [tipo, num, ...datos]: números, textos, operadores (tipo 0),
   paréntesis (-1,-1 / -1,-2), funciones con argumentos hasta el «)» y valores de objetos. */
function compilarExp(fichas) {
  let i = 0;
  const ver = () => fichas[i];
  const cierre = (f) => f && f[0] === -1 && f[1] === -2;
  function args() {
    const r = [];
    if (cierre(ver())) { i++; return r; }
    for (;;) {
      r.push(expr(1));
      const f = fichas[i++];
      if (!f || cierre(f)) break;
    }
    return r;
  }
  function primario() {
    const f = fichas[i++];
    if (!f) return () => 0;
    const [a, n] = f;
    if (a === -1) {
      if (n === 0 || n === 23 || n === 3) { const v = f[2]; return () => v; }
      if (n === -1) { const e = expr(1); if (cierre(ver())) i++; return e; }
      if (n === 1) { const g = args(); return (c) => Math.floor(Math.random() * Math.max(0, num(g[0]?.(c)))); }
      if (n === 4) { const g = args(); return (c) => String(g[0]?.(c) ?? ''); }
      if (n === 5) { const g = args(); return (c) => num(g[0]?.(c)); }
      return () => 0;
    }
    if (a === -2 && n === 2) { const g = args(); return (c) => c.m.sonido.volumenCanal(num(g[0]?.(c))); }
    if (a === -2) { return () => 0; }
    if (a >= 2 || a === -7) {
      const oi = f[2];
      switch (n) {
        case 80: return (c) => c.m.instDe(oi, c)?.valor ?? 0;
        case 16: { const k = f[4] ?? 0; return (c) => c.m.instDe(oi, c)?.alt[k] ?? 0; }
        case 1: return (c) => c.m.instDe(oi, c)?.y ?? 0;
        case 11: return (c) => c.m.instDe(oi, c)?.x ?? 0;
        case 82: { const g = args(); return (c) => c.m.ini.valor(String(g[0]?.(c) ?? '')); }
        case 81: { const g = args(); return (c) => c.m.ini.texto(String(g[0]?.(c) ?? '')); }
        case 85: return () => new Date().getDate();
        case 86: return () => new Date().getMonth() + 1;
        case 87: return () => new Date().getFullYear();
      }
      return () => 0;
    }
    return () => 0;
  }
  function expr(min) {
    let izq = primario();
    for (;;) {
      const f = ver();
      if (!f || f[0] !== 0) return izq;
      const p = PREC[f[1]] ?? 1;
      if (p < min) return izq;
      i++;
      const der = expr(p + 1), op = f[1], a = izq;
      izq = (c) => operar(op, a(c), der(c));
    }
  }
  return expr(1);
}
const EXP = new WeakMap();
const exp = (p) => { let f = EXP.get(p); if (!f) { f = compilarExp(p[1]); EXP.set(p, f); } return f; };
const valor = (p, c) => exp(p)(c);

/* ---------------------------------------------------------------- instancias */
let _uid = 1;
class Inst {
  constructor(m, oi, x, y, capa) {
    const o = m.O[oi];
    this.id = _uid++; this.oi = oi; this.o = o; this.x = x; this.y = y; this.capa = capa;
    this.visible = o.t === 1 || o.t === 0 ? true : o.visible !== false;
    this.alt = new Array(26).fill(0); this.altS = new Array(10).fill('');
    this.anim = 0; this.forzada = -1; this.dir = 0; this.cuadro = 0; this.cont = 0; this.vueltas = 0; this.animFin = false;
    this.alpha = 0; this.vel = 0; this.flash = 0; this.destruido = false;
    this.valor = o.ini ?? 0; this.min = o.min ?? -1e9; this.max = o.max ?? 1e9; this.color = null;
    this.texto = o.parrafos ? o.parrafos[0].texto : '';
    this.movIdx = 0; this.mov = null;
    if (o.movs?.length) this.ponerMov(0, true);
    if (o.anims) { const ks = Object.keys(o.anims).map(Number); if (!o.anims[0] && ks.length) this.anim = ks[0]; }
  }
  ponerMov(k, alNacer) {
    const d = this.o.movs?.[k]; this.movIdx = k;
    if (!d) { this.mov = null; return; }
    this.mov = { d, activo: alNacer ? !!d.mueve : true, paso: 0, hecho: 0, sentido: 1, pausa: 0, x0: this.x, y0: this.y, fin: false };
    const bits = d.dir >>> 0; const ds = []; for (let b = 0; b < 32; b++) if (bits & (1 << b)) ds.push(b);
    if (ds.length) this.dir = ds[Math.floor(Math.random() * ds.length)];
    if (d.t === 4 && d.v) { this.vel = d.v[0] ?? 0; this.mov.dec = d.v[1] ?? 0; }
    if (d.t === 3 && d.v) { this.velMax = d.v[2] ?? 50; }
  }
}

/* ---------------------------------------------------------------- el motor */
export class Motor {
  constructor(J, { imagen, sonido, ini, textos, alSalir, alFrame }) {
    this.J = J; this.O = J.objetos; this.W = J.app.w; this.H = J.app.h; this.fps = J.app.fps || 60;
    this.imagen = imagen; this.sonido = sonido; this.ini = ini; this.textos = textos || ((s) => s);
    this.alSalir = alSalir || (() => {}); this.alFrame = alFrame || (() => {});
    this.globales = new Map();
    this.teclas = new Set(); this.teclasNuevas = new Set();
    this.mouse = { x: -9999, y: -9999, abajo: new Set(), clics: new Set() };
    this.F = null; this.pend = null; this.fundido = null; this.cargando = false;
  }

  /* ------------------------------ frames */
  indiceDeHandle(h) { const k = this.J.handles[h]; return k ?? h; }
  async ir(idx) {
    if (idx < 0 || idx >= this.J.frames.length) { this.alSalir(); idx = 1; }
    this.cargando = true;
    const viejo = this.F;
    if (viejo) for (const i of viejo.inst) if (this.O[i.oi].fl & 4) this.globales.set(i.oi, { valor: i.valor, alt: [...i.alt], altS: [...i.altS] });
    const f = this.J.frames[idx];
    await this.alFrame(idx, f);
    const F = { idx, f, w: f.w, h: f.h, capas: f.capas.map((c) => ({ ...c, inst: [] })), inst: [], loop: 0, tiempo: 0, camX: 0, camY: 0, estado: new Map(), primero: true };
    this.F = F;
    for (const d of f.inst) {
      const o = this.O[d.oi]; if (!o) continue;
      if (d.padre && d.padre[0] !== 0) continue;
      const i = this.crear(d.oi, d.x, d.y, Math.max(0, Math.min(F.capas.length - 1, d.capa)));
      const g = this.globales.get(d.oi);
      if (g && (o.fl & 4)) { i.valor = g.valor; i.alt = [...g.alt]; i.altS = [...g.altS]; }
    }
    this.eventos = (f.eventos || []).map((g) => ({ c: g.c.map((e) => this.prepCond(e)), a: g.a }));
    this.cargando = false;
    this.fundido = f.fadeIn ? { t: 0, ms: f.fadeIn.ms, color: f.fadeIn.color, entra: true } : null;
    if (this.fundido) this.paso();
  }
  crear(oi, x, y, capa) {
    const F = this.F, i = new Inst(this, oi, x, y, capa);
    F.inst.push(i); (F.capas[capa] || F.capas[0]).inst.push(i);
    return i;
  }
  vivos(oi) { return this.F.inst.filter((i) => i.oi === oi && !i.destruido); }
  instDe(oi, c) {
    if (c?.actual && c.actual.oi === oi) return c.actual;
    const s = c?.sel?.get(oi); if (s && s.length) return s[0];
    return this.F.inst.find((i) => i.oi === oi && !i.destruido) || null;
  }
  saltar(idx) { if (this.pend == null) this.pend = idx; }

  /* ------------------------------ entrada (coordenadas lógicas del juego, 0..W × 0..H) */
  tecla(vk, abajo) { if (abajo) { if (!this.teclas.has(vk)) this.teclasNuevas.add(vk); this.teclas.add(vk); } else this.teclas.delete(vk); }
  puntero(x, y) { this.mouse.x = x; this.mouse.y = y; }
  boton(b, abajo) { if (abajo) { this.mouse.abajo.add(b); this.mouse.clics.add(b); } else this.mouse.abajo.delete(b); }

  /* ------------------------------ geometría */
  imgDe(i) {
    const o = i.o;
    if (o.t === 1) return o.img;
    if (o.anims) {
      const ds = o.anims[i.anim] || o.anims[0]; if (!ds) return null;
      const d = this.dirDe(ds, i.dir); if (!d) return null;
      return d.cuadros[Math.min(i.cuadro, d.cuadros.length - 1)];
    }
    return null;
  }
  dirDe(ds, dir) {
    if (ds[dir]) return ds[dir];
    let mejor = null, dm = 99;
    for (const k in ds) { const d = Math.min(Math.abs(k - dir), 32 - Math.abs(k - dir)); if (d < dm) { dm = d; mejor = ds[k]; } }
    return mejor;
  }
  caja(i) {
    const o = i.o;
    if (o.t === 1) return [i.x, i.y, o.w, o.h];
    if (o.t === 3) return [i.x, i.y, o.w, o.h];
    if (o.t === 7) { const w = o.w || 32, h = o.h || 32; return [i.x - w, i.y - h, w, h]; }
    if (o.t >= 32) return [i.x, i.y, 32, 32];
    const h = this.imgDe(i); const m = h != null && this.J.imgs[h];
    if (!m) return [i.x, i.y, 1, 1];
    return [i.x - m[2], i.y - m[3], m[0], m[1]];
  }
  tocan(a, b) { const p = this.caja(a), q = this.caja(b); return p[0] < q[0] + q[2] && q[0] < p[0] + p[2] && p[1] < q[1] + q[3] && q[1] < p[1] + p[3]; }
  mouseEn(i) {
    const xc = this.F.capas[i.capa]?.xc ?? 1, yc = this.F.capas[i.capa]?.yc ?? 1;
    const x = this.mouse.x + this.F.camX * xc, y = this.mouse.y + this.F.camY * yc;
    const c = this.caja(i);
    return x >= c[0] && x < c[0] + c[2] && y >= c[1] && y < c[1] + c[3];
  }

  /* ------------------------------ condiciones */
  prepCond(e) { return { e, tipo: e[0], num: e[1], oi: e[2], neg: !!(e[5] & 1), p: e.slice(6).map((x) => x[1]), st: {} }; }
  filtrar(c, ctx, pred) {
    const lista = ctx.sel.get(c.oi) ?? this.vivos(c.oi);
    const r = lista.filter((i) => !!pred(i) !== c.neg);
    ctx.sel.set(c.oi, r);
    return r.length > 0;
  }
  cond(c, ctx) {
    const F = this.F, t = c.tipo, n = c.num, p = c.p;
    if (t === -1) {
      switch (n) {
        case -1: return true;
        case -2: return false;
        case -3: { const r = CMP[p[1][0]]?.(valor(p[0], ctx), valor(p[1], ctx)) ?? false; return r !== c.neg; }
        case -6: if (c.st.hecho) return false; c.st.hecho = true; return true;
        case -7: { const r = c.st.ult !== F.loop - 1; c.st.ult = F.loop; return r; }
      }
      return false;
    }
    if (t === -3) { if (n === -1) return F.loop === 1; return false; }
    if (t === -4) {
      if (n === -8) { const ms = p[0].ms; c.st.r = (c.st.r ?? ms) - 1000 / this.fps; if (c.st.r <= 0) { c.st.r += ms; if (c.st.r <= 0) c.st.r = ms; return true; } return false; }
      if (n === -7) return F.tiempo >= p[0].ms;
      return false;
    }
    if (t === -6) {
      switch (n) {
        case -1: return this.teclasNuevas.has(p[0][0]) !== c.neg;
        case -2: return this.teclas.has(p[0][0]) !== c.neg;
        case -4: { const oi = p[0].oi; const l = (ctx.sel.get(oi) ?? this.vivos(oi)).filter((i) => this.mouseEn(i) !== c.neg); ctx.sel.set(oi, l); return l.length > 0; }
        case -5: return this.mouse.clics.has(p[0][0] || 0);
        case -7: { if (!this.mouse.clics.has(p[0][0] || 0)) return false; const oi = p[1].oi; const l = (ctx.sel.get(oi) ?? this.vivos(oi)).filter((i) => this.mouseEn(i)); ctx.sel.set(oi, l); return l.length > 0; }
        case -8: return this.mouse.abajo.size > 0;
      }
      return false;
    }
    // objetos
    switch (n) {
      case -81: { const op = CMP[p[0][0]], v = valor(p[0], ctx); return this.filtrar(c, ctx, (i) => op(i.valor, v)); }
      case -42: case -27: { const k = p[0][0], op = CMP[p[1][0]], v = valor(p[1], ctx); return this.filtrar(c, ctx, (i) => op(i.alt[k], v)); }
      case -4: {
        const otro = p[0].oi; const otros = ctx.sel.get(otro) ?? this.vivos(otro); const toc = new Set();
        const ok = this.filtrar(c, ctx, (i) => { let s = false; for (const j of otros) if (j !== i && this.tocan(i, j)) { s = true; toc.add(j); } return s; });
        if (!c.neg) ctx.sel.set(otro, otros.filter((j) => toc.has(j)));
        return ok;
      }
      case -23: { const fondos = this.F.inst.filter((j) => j.o.t === 1 && j.o.obst); return this.filtrar(c, ctx, (i) => fondos.some((j) => this.tocan(i, j))); }
      case -2: { const a = p[0][0]; return this.filtrar(c, ctx, (i) => i.anim === a && i.animFin); }
      case -29: return this.filtrar(c, ctx, (i) => i.visible);
      case -17: { const op = CMP[p[0][0]], v = valor(p[0], ctx); return this.filtrar(c, ctx, (i) => op(i.x, v)); }
      case -16: { const op = CMP[p[0][0]], v = valor(p[0], ctx); return this.filtrar(c, ctx, (i) => op(i.y, v)); }
      case -22: { const v = valor(p[0], ctx); return this.filtrar(c, ctx, (i) => i.vel === v); }
      case -7: return this.filtrar(c, ctx, (i) => i.mov?.fin);
      case -32: { const op = CMP[p[0][0]], v = valor(p[0], ctx); return op(this.vivos(c.oi).length, v) !== c.neg; }
      case -34: { const l = ctx.sel.get(c.oi) ?? this.vivos(c.oi); if (!l.length) return false; ctx.sel.set(c.oi, [l[Math.floor(Math.random() * l.length)]]); return true; }
    }
    return false;
  }

  /* ------------------------------ acciones */
  posicion(p, ctx) {
    let x = p.x, y = p.y, capa = p.capa;
    if (p.oiPadre !== 65535) {
      const q = this.instDe(p.oiPadre, ctx);
      if (q) { x += q.x; y += q.y; if (capa < 0) capa = q.capa; }
    }
    return [x, y, capa < 0 ? 0 : capa];
  }
  objetivos(oi, ctx) { return ctx.sel.get(oi) ?? this.vivos(oi); }
  accion(a, ctx) {
    const [t, n, oi] = a, p = a.slice(6).map((x) => x[1]);
    if (t === -2) {
      const S = this.sonido;
      switch (n) {
        case 0: S.tocar(p[0].h, 0, 1); break;
        case 1: S.pararTodo(); break;
        case 11: S.tocar(p[0].h, num(valor(p[1], ctx)), 1); break;
        case 12: S.tocar(p[0].h, num(valor(p[1], ctx)), num(valor(p[2], ctx))); break;
        case 15: S.pararCanal(num(valor(p[0], ctx))); break;
        case 17: S.volumen(num(valor(p[0], ctx)), num(valor(p[1], ctx))); break;
        case 20: S.principal(num(valor(p[0], ctx))); break;
      }
      return;
    }
    if (t === -3) {
      switch (n) {
        case 0: this.saltar(this.F.idx + 1); break;
        case 1: this.saltar(this.F.idx - 1); break;
        case 2: this.saltar(this.indiceDeHandle(p[0][0])); break;
        case 4: this.alSalir(); this.saltar(1); break;
        case 6: this.saltar(this.F.idx); break;
        case 7: { const [x, y] = this.posicion(p[0], ctx); this.centrar(x, y); break; }
        case 8: this.centrar(num(valor(p[0], ctx)), null); break;
        case 9: this.centrar(null, num(valor(p[0], ctx))); break;
      }
      return;
    }
    if (t === -5 && n === 0) {
      const d = p[0]; const [x, y, capa] = this.posicion(d, ctx);
      if (!this.O[d.oi]) return;
      const i = this.crear(d.oi, x, y, Math.min(capa, this.F.capas.length - 1));
      ctx.sel.set(d.oi, [i]);
      return;
    }
    if (t < 2 && t !== -7) return;
    for (const i of this.objetivos(oi, ctx)) {
      ctx.actual = i;
      this.accionObj(i, n, p, ctx);
    }
    ctx.actual = null;
  }
  accionObj(i, n, p, ctx) {
    const o = i.o;
    if (o.t === 33) return this.accionIni(n, p, ctx);
    if (o.t === 7 || o.t === 5 || o.t === 6) {
      switch (n) {
        case 80: i.valor = this.limitar(i, num(valor(p[0], ctx))); return;
        case 81: i.valor = this.limitar(i, i.valor + num(valor(p[0], ctx))); return;
        case 82: i.valor = this.limitar(i, i.valor - num(valor(p[0], ctx))); return;
        case 83: i.min = num(valor(p[0], ctx)); i.valor = this.limitar(i, i.valor); return;
        case 84: i.max = num(valor(p[0], ctx)); i.valor = this.limitar(i, i.valor); return;
        case 85: i.color = p[0]; return;
        case 86: i.color2 = p[0]; return;
      }
    }
    if (o.t === 3 && n === 88) { i.texto = String(valor(p[0], ctx)); return; }
    switch (n) {
      case 1: { const [x, y] = this.posicion(p[0], ctx); i.x = x; i.y = y; if (i.mov) { i.mov.x0 = x; i.mov.y0 = y; } return; }
      case 2: i.x = num(valor(p[0], ctx)); return;
      case 3: i.y = num(valor(p[0], ctx)); return;
      case 4: if (i.mov) i.mov.activo = false; return;
      case 5: if (i.mov) { i.mov.activo = true; i.mov.fin = false; } return;
      case 6: i.vel = p[0][0]; return;
      case 13: i.ponerMov(p[0][0], false); return;
      case 15: i.parada = true; return;
      case 16: i.parada = false; return;
      case 17: { const k = p[0][0]; if (o.anims?.[k] && (i.forzada !== k || i.anim !== k)) { i.forzada = k; i.anim = k; i.cuadro = 0; i.cont = 0; i.vueltas = 0; i.animFin = false; } return; }
      case 20: i.forzada = -1; return;
      case 23: { const m = parseInt(p[0][1].slice(0, 8).match(/../g).reverse().join(''), 16) >>> 0; const ds = []; for (let b = 0; b < 32; b++) if (m & (1 << b)) ds.push(b); if (ds.length) i.dir = ds[Math.floor(Math.random() * ds.length)]; return; }
      case 24: i.destruido = true; return;
      case 26: i.visible = false; i.flash = 0; return;
      case 27: i.visible = true; i.flash = 0; return;
      case 28: i.flash = p[0].ms || 100; i.flashT = 0; return;
      case 31: i.alt[p[0][0]] = valor(p[1], ctx); return;
      case 32: i.alt[p[0][0]] = num(i.alt[p[0][0]]) + num(valor(p[1], ctx)); return;
      case 33: i.alt[p[0][0]] = num(i.alt[p[0][0]]) - num(valor(p[1], ctx)); return;
      case 58: { const c = this.F.capas[i.capa]; const k = c.inst.indexOf(i); if (k >= 0) { c.inst.splice(k, 1); c.inst.push(i); } return; }
      case 57: { const c = this.F.capas[i.capa]; const k = c.inst.indexOf(i); if (k >= 0) { c.inst.splice(k, 1); c.inst.unshift(i); } return; }
      case 65: i.alpha = Math.max(0, Math.min(255, num(valor(p[0], ctx)))); return;
    }
  }
  limitar(i, v) { return Math.max(i.min, Math.min(i.max, v)); }
  accionIni(n, p, ctx) {
    const s = (k) => String(valor(p[k], ctx));
    switch (n) {
      case 80: this.ini.grupo = s(0); break;
      case 81: this.ini.item = s(0); break;
      case 82: this.ini.poner(this.ini.item, num(valor(p[0], ctx))); break;
      case 85: this.ini.poner(this.ini.item, s(0)); break;
      case 86: this.ini.archivo = s(0); break;
      case 87: this.ini.poner(s(0), num(valor(p[1], ctx))); break;
      case 89: this.ini.poner(s(0), s(1)); break;
    }
  }
  /* Centrar la pantalla. Los objetos que «no siguen el escenario» (bandera 0x800) se corren con la pantalla para
     quedar fijos donde se ven, como hace el runtime de Clickteam. */
  centrar(x, y) {
    const F = this.F;
    const nx = x != null ? Math.max(0, Math.min(F.w - this.W, Math.round(x - this.W / 2))) : F.camX;
    const ny = y != null ? Math.max(0, Math.min(F.h - this.H, Math.round(y - this.H / 2))) : F.camY;
    const dx = nx - F.camX, dy = ny - F.camY;
    F.camX = nx; F.camY = ny;
    if (dx || dy) for (const i of F.inst) if (i.o.cfl & 0x800) { const c = F.capas[i.capa]; i.x += dx * (c?.xc ?? 1); i.y += dy * (c?.yc ?? 1); }
  }

  /* ------------------------------ un loop */
  paso() {
    const F = this.F;
    if (!F || this.cargando) return;
    if (this.fundido) {
      this.fundido.t += 1000 / this.fps;
      if (this.fundido.t >= this.fundido.ms) {
        const f = this.fundido; this.fundido = null;
        if (!f.entra) { this.ir(f.destino); return; }
      } else if (F.loop > 0) return;
    }
    F.loop++;
    F.tiempo += 1000 / this.fps;
    for (const i of F.inst) if (!i.destruido) this.mover(i);
    for (const g of this.eventos) {
      const ctx = { m: this, sel: new Map(), actual: null };
      let ok = true;
      for (const c of g.c) if (!this.cond(c, ctx)) { ok = false; break; }
      if (ok) for (const a of g.a) { this.accion(a, ctx); if (this.F !== F) return; }
    }
    if (F.inst.some((i) => i.destruido)) {
      F.inst = F.inst.filter((i) => !i.destruido);
      for (const c of F.capas) c.inst = c.inst.filter((i) => !i.destruido);
    }
    this.teclasNuevas.clear(); this.mouse.clics.clear();
    if (this.pend != null) {
      const destino = this.pend; this.pend = null;
      const fo = F.f.fadeOut;
      if (fo) this.fundido = { t: 0, ms: fo.ms, color: fo.color, entra: false, destino };
      else this.ir(destino);
    }
  }
  mover(i) {
    const o = i.o;
    if (o.anims) this.animar(i);
    if (i.flash) { i.flashT = (i.flashT || 0) + 1000 / this.fps; }
    const m = i.mov; if (!m || !m.activo) return;
    const d = m.d;
    if (d.t === 5) {
      if (m.pausa > 0) { m.pausa -= 1000 / this.fps; return; }
      const pasos = d.pasos; if (!pasos.length) return;
      let paso = pasos[m.paso]; let resto = paso.v / 8;
      while (resto > 0 && !m.fin) {
        const l = paso.l || 1, falta = l - m.hecho, av = Math.min(resto, falta), s = m.sentido;
        i.x += (paso.dx / l) * av * s; i.y += (paso.dy / l) * av * s; m.hecho += av; resto -= av;
        i.dir = s > 0 ? paso.dir : (paso.dir + 16) % 32;
        if (m.hecho >= l - 1e-6) {
          m.hecho = 0;
          if (paso.pausa) m.pausa = paso.pausa * 10;
          const sig = m.paso + s;
          if (sig >= 0 && sig < pasos.length) { m.paso = sig; paso = pasos[sig]; if (m.pausa > 0) break; continue; }
          if (d.rev && s > 0) { m.sentido = -1; m.paso = pasos.length - 1; paso = pasos[m.paso]; if (!d.bucle) { /* va y vuelve una vez */ } continue; }
          if (d.rev && s < 0) { if (d.bucle) { m.sentido = 1; m.paso = 0; paso = pasos[0]; continue; } m.fin = true; break; }
          if (d.bucle) { if (d.repos) { i.x = m.x0; i.y = m.y0; } m.paso = 0; paso = pasos[0]; continue; }
          m.fin = true; m.activo = false; break;
        }
      }
      return;
    }
    if (d.t === 4) {
      if (!i.vel) return;
      const a = (i.dir / 32) * Math.PI * 2, v = i.vel / 8;
      i.x += Math.cos(a) * v; i.y -= Math.sin(a) * v;
      if (m.dec) { m.acum = (m.acum || 0) + m.dec / 100; while (m.acum >= 1 && i.vel > 0) { i.vel--; m.acum -= 1; } }
      return;
    }
    if (d.t === 3) {
      const izq = this.teclas.has(37), der = this.teclas.has(39), arr = this.teclas.has(38), aba = this.teclas.has(40);
      const dx = (der ? 1 : 0) - (izq ? 1 : 0), dy = (aba ? 1 : 0) - (arr ? 1 : 0);
      if (!dx && !dy) { i.vel = 0; return; }
      const v = (i.velMax || 50) / 8, l = Math.hypot(dx, dy);
      i.x += (dx / l) * v; i.y += (dy / l) * v; i.vel = i.velMax || 50;
      i.dir = Math.round(((Math.atan2(-dy, dx) / (Math.PI * 2)) * 32 + 32) % 32);
    }
  }
  animar(i) {
    const o = i.o;
    if (i.forzada < 0) {
      const mov = i.mov && i.mov.activo && !i.mov.fin && (i.mov.d.t !== 3 || i.vel);
      const k = mov && o.anims[1] ? 1 : (o.anims[0] ? 0 : i.anim);
      if (k !== i.anim) { i.anim = k; i.cuadro = 0; i.cont = 0; i.vueltas = 0; i.animFin = false; }
    }
    if (i.parada || i.animFin) return;
    const ds = o.anims[i.anim]; if (!ds) return;
    const d = this.dirDe(ds, i.dir); if (!d || d.cuadros.length < 1) return;
    const vel = i.vel ? d.vmin + ((d.vmax - d.vmin) * Math.min(100, i.vel)) / 100 : d.vmin || d.vmax;
    i.cont += vel;
    while (i.cont >= 100) {
      i.cont -= 100;
      if (i.cuadro + 1 < d.cuadros.length) { i.cuadro++; continue; }
      if (d.rep === 0) { i.cuadro = Math.min(d.vuelve || 0, d.cuadros.length - 1); continue; }
      if (++i.vueltas >= d.rep) { i.animFin = true; break; }
      i.cuadro = Math.min(d.vuelve || 0, d.cuadros.length - 1);
    }
  }

  /* ------------------------------ dibujo (ctx de 2D en coordenadas lógicas W×H) */
  dibujar(g, copia) {
    const F = this.F;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const fondo = F?.f.fondo || [0, 0, 0];
    g.fillStyle = `rgb(${fondo[0]},${fondo[1]},${fondo[2]})`; g.fillRect(0, 0, this.W, this.H);
    if (!F) return;
    for (const capa of F.capas) {
      if (!(capa.fl & 0x10)) continue;
      const ox = -Math.round(F.camX * capa.xc), oy = -Math.round(F.camY * capa.yc);
      for (const i of capa.inst) {
        if (i.destruido) continue;
        if (i.o.t === 32) { this.panorama(g, copia, i, ox, oy); continue; }
        if (!i.visible) continue;
        if (i.flash && Math.floor(i.flashT / i.flash) % 2) continue;
        this.dibujarInst(g, i, ox, oy);
      }
    }
    if (this.fundido) {
      const f = this.fundido, k = Math.min(1, f.t / f.ms), a = f.entra ? 1 - k : k;
      g.globalAlpha = a; g.fillStyle = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`; g.fillRect(0, 0, this.W, this.H); g.globalAlpha = 1;
    }
  }
  dibujarInst(g, i, ox, oy) {
    const o = i.o;
    const tinta = o.tinta & 0xffff, coef = (o.tinta & 0x10000000) ? ((o.tp >>> 24) & 255) / 255 : 1;
    let alfa = (1 - i.alpha / 255) * coef;
    if (tinta === 1) alfa *= 1 - Math.min(128, o.tp & 0xffff) / 128;
    if (alfa <= 0.002) return;
    g.globalAlpha = Math.min(1, alfa);
    g.globalCompositeOperation = tinta === 9 ? 'lighter' : 'source-over';
    if (o.t === 7) this.dibujarContador(g, i, ox, oy);
    else if (o.t === 3) this.dibujarTexto(g, i, ox, oy);
    else {
      const h = this.imgDe(i); const m = h != null && this.J.imgs[h]; const im = m && this.imagen(h);
      if (im) {
        const x = o.t === 1 ? i.x : i.x - m[2], y = o.t === 1 ? i.y : i.y - m[3];
        g.drawImage(im, x + ox, y + oy, m[0], m[1]);
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  dibujarContador(g, i, ox, oy) {
    const o = i.o;
    if (o.mostrar === 1 && o.imgs) {
      const s = String(Math.round(i.valor));
      const hs = [...s].map((ch) => (ch === '-' ? o.imgs[10] : o.imgs[ch.charCodeAt(0) - 48]));
      let w = 0, h = 0; for (const k of hs) { const m = this.J.imgs[k]; if (m) { w += m[0]; h = Math.max(h, m[1]); } }
      let x = i.x - w + ox;
      for (const k of hs) { const m = this.J.imgs[k], im = this.imagen(k); if (m && im) g.drawImage(im, x, i.y - h + oy, m[0], m[1]); x += m ? m[0] : 0; }
    } else if (o.mostrar === 4 && o.imgs?.length) {
      const n = o.imgs.length, r = (i.max - i.min) || 1;
      const k = o.imgs[Math.max(0, Math.min(n - 1, Math.floor(((i.valor - i.min) * n) / (r + 1))))];
      const m = this.J.imgs[k], im = this.imagen(k);
      if (m && im) g.drawImage(im, i.x - m[2] + ox, i.y - m[3] + oy, m[0], m[1]);
    } else if (o.mostrar === 2 || o.mostrar === 3) {
      const c = i.color || o.color || [255, 255, 255]; const r = (i.max - i.min) || 1, k = Math.max(0, Math.min(1, (i.valor - i.min) / r));
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      if (o.mostrar === 3) g.fillRect(i.x - o.w + ox, i.y - o.h + oy, o.w * k, o.h);
      else g.fillRect(i.x - o.w + ox, i.y - o.h * k + oy, o.w, o.h * k);
    }
  }
  dibujarTexto(g, i, ox, oy) {
    const o = i.o, par = o.parrafos?.[0]; if (!par) return;
    const f = this.J.fuentes?.[par.fuente] || [-16, 400, 0, 'Arial'];
    const tam = Math.abs(f[0]), cara = this.fuenteWeb(f[3]);
    g.font = `${f[2] ? 'italic ' : ''}${f[1] >= 600 ? 'bold ' : ''}${tam}px ${cara}`;
    g.fillStyle = `rgb(${par.color[0]},${par.color[1]},${par.color[2]})`;
    g.textBaseline = 'top';
    const centrado = par.fl & 1, derecha = par.fl & 2;
    g.textAlign = centrado ? 'center' : derecha ? 'right' : 'left';
    const x = centrado ? i.x + o.w / 2 : derecha ? i.x + o.w : i.x;
    const lineas = [];
    for (const parrafo of this.textos(String(i.texto)).split(/\r?\n/)) {
      let l = '';
      for (const p of parrafo.split(' ')) {
        const prueba = l ? l + ' ' + p : p;
        if (l && o.w && g.measureText(prueba).width > o.w) { lineas.push(l); l = p; } else l = prueba;
      }
      lineas.push(l);
    }
    const alto = tam * 1.15;
    lineas.forEach((l, k) => g.fillText(l, x + ox, i.y + k * alto + oy));
    g.textAlign = 'left';
  }
  fuenteWeb(n) {
    if (/OCR/i.test(n)) return "'OCR A', 'OCR A Extended', Consolas, monospace";
    if (/LCD/i.test(n)) return "'LCD', 'Courier New', monospace";
    if (/Consolas|Lucida Console/i.test(n)) return "Consolas, 'Courier New', monospace";
    return `'${n}', Arial, sans-serif`;
  }
  /* Perspective, efecto panorama: las columnas de los costados se estiran en vertical (como mirar desde adentro
     de un cilindro); lo que está debajo del objeto se copia y se vuelve a dibujar deformado. */
  panorama(g, copia, i, ox, oy) {
    if (!copia) return;
    const ext = i.o.ext || '';
    const w = Math.min(this.W, (parseInt(ext.slice(48, 52).match(/../g).reverse().join(''), 16) || this.W));
    const h = Math.min(this.H, (parseInt(ext.slice(52, 56).match(/../g).reverse().join(''), 16) || this.H));
    const zoom = parseInt(ext.slice(64, 72).match(/../g).reverse().join(''), 16) || 200;
    const cx = copia.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, copia.width, copia.height);
    cx.drawImage(g.canvas, 0, 0);
    const sx = copia.width / this.W, sy = copia.height / this.H;
    const x0 = Math.max(0, i.x + ox), y0 = Math.max(0, i.y + oy);
    const tiras = 128, ancho = w / tiras, maxD = (h * zoom) / 2000;
    for (let k = 0; k < tiras; k++) {
      const x = x0 + k * ancho, c = (k + 0.5) / tiras;
      const d = maxD * (1 - Math.sin(c * Math.PI));
      g.drawImage(copia, x * sx, (y0 + d) * sy, ancho * sx + 1, (h - 2 * d) * sy, x, y0, ancho + 0.5, h);
    }
  }
}
