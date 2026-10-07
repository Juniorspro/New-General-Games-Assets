/* motor.js — corre los eventos originales de un juego de Clickteam Fusion.
 *
 * Lee el juego.json que escribe ccn.py (el mismo formato del port de FNaF 2 de
 * otra sesión: este motor corre los dos) y ejecuta, cuadro por cuadro, lo que
 * hace el runtime de Clickteam: eventos con selección de objetos, expresiones,
 * animaciones, movimientos, capas con scroll, contadores, textos, sonido por
 * canales e INI.
 *
 * Todo lo que el motor sabe hacer está en tablas (COND, ACC, EXPR) con clave
 * "tipo/número". cobertura.mjs las cruza con lo que usa un juego y dice qué
 * falta antes de jugarlo: "implementado" se mide, no se supone.
 *
 * Lo que se corrigió respecto del motor de FNaF 2, con el porqué:
 * - Pasos por segundo = fps del juego. Allá el bucle daba 60 pasos y cada
 *   uno contaba 1000/27 ms: el reloj de la noche iba 2,2× rápido.
 * - "Sólo una vez mientras el evento se repite" y "correr una vez" se deciden
 *   por GRUPO (como Clickteam), no según si se llegó a evaluar la condición.
 * - El NO se respeta en TODAS las condiciones (allá "NO mouse apretado"
 *   daba lo mismo que "mouse apretado": en FNaF 4 eso apaga la linterna
 *   mientras se la sostiene).
 * - Colisiones por máscara de píxeles salvo que el objeto pida "por caja".
 * - Extensiones por NOMBRE: el número de tipo cambia de juego en juego
 *   (en FNaF 2 el 32 es la perspectiva; en FNaF 4, el INI).
 * - Valores alterables iniciales, velocidad como expresión, rebote bien leído.
 */
(function (global) {
  'use strict';

  // ───────────────────────────── básicos ─────────────────────────────
  const COMPARA = [
    (a, b) => a == b, (a, b) => a != b, (a, b) => a <= b,
    (a, b) => a < b, (a, b) => a >= b, (a, b) => a > b,
  ];
  const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
  const avisados = new Set();
  function avisar(msg) {
    if (avisados.has(msg)) return;
    avisados.add(msg);
    console.warn('[clickteam] ' + msg);
  }

  // Tipo de objeto → "clase" que decide qué tabla de acciones usa.
  const IDENT_EXT = { '0INI': 'kcini', tksp: 'perspective', '0KLC': 'kcclock' };
  function claseDe(o) {
    if (!o) return '?';
    if (o.t === 0 || o.t === 1) return 'fondo';
    if (o.t === 2) return 'activo';
    if (o.t === 3 || o.t === 4) return 'texto';
    if (o.t === 5 || o.t === 6 || o.t === 7) return 'contador';
    if (o.t >= 32) return 'ext:' + (o.ext_nombre || IDENT_EXT[o.ident] || o.ident || o.t);
    return '?';
  }

  // ───────────────────────────── expresiones ─────────────────────────────
  // Una expresión llega como lista de tokens [tipo, num, ...datos] sin el FIN.
  // Se compila una vez a una función (ctx) => valor.
  const PRIORIDAD = { 2: 1, 4: 1, 6: 2, 8: 2, 10: 2, 12: 3, 14: 1, 16: 1, 18: 1 };
  function opera(op, a, b) {
    if (op === 2) return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b;
    a = num(a); b = num(b);
    switch (op) {
      case 4: return a - b;
      case 6: return a * b;
      case 8: return b ? (Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b) : 0;
      case 10: return b ? a % b : 0;
      case 12: return Math.pow(a, b);
      case 14: return a & b;
      case 16: return a | b;
      case 18: return a ^ b;
    }
    return 0;
  }
  const esCierre = (t) => t && t[0] === -1 && t[1] === -2;

  // EXPR["tipo/num"] (sistema y demás negativos) o EXPR["clase/num"] (objetos):
  // (args, motor, ctx, token) => valor. args: funciones ya compiladas.
  const EXPR = {
    '-1/1': (a, m, c) => Math.floor(Math.random() * Math.max(0, num(a[0](c)))), // Random(n)
    '-1/4': (a, m, c) => { const v = a[0](c); return typeof v === 'number' && !Number.isInteger(v) ? String(+v.toFixed(6)) : String(v); }, // Str$
    '-1/5': (a, m, c) => num(a[0](c)), // Val
    '-2/2': (a, m, c) => m.sonido.volumenCanal(num(a[0](c))), // volumen de un canal
    'obj/1': (a, m, c, k) => m.instExpr(k, c)?.y ?? 0,
    'obj/11': (a, m, c, k) => m.instExpr(k, c)?.x ?? 0,
    'obj/2': (a, m, c, k) => m.instExpr(k, c)?.cuadro ?? 0,
    'obj/14': (a, m, c, k) => m.instExpr(k, c)?.anim ?? 0,
    'obj/6': (a, m, c, k) => m.instExpr(k, c)?.dir ?? 0,
    'obj/3': (a, m, c, k) => m.instExpr(k, c)?.vel ?? 0,
    'obj/15': (a, m, c, k) => m.vivos(k[2]).length,
    'obj/16': (a, m, c, k) => m.instExpr(k, c)?.alt[k[4] ?? 0] ?? 0,
    'obj/19': (a, m, c, k) => m.instExpr(k, c)?.altS[k[4] ?? 0] ?? '',
    'contador/80': (a, m, c, k) => m.instExpr(k, c)?.valor ?? 0,
    'contador/81': (a, m, c, k) => m.instExpr(k, c)?.min ?? 0,
    'contador/82': (a, m, c, k) => m.instExpr(k, c)?.max ?? 0,
    'texto/80': (a, m, c, k) => m.instExpr(k, c)?.texto ?? '',
    'ext:kcini/80': (a, m) => m.ini.valor(m.ini.item),
    'ext:kcini/81': (a, m) => m.ini.texto(m.ini.item),
    'ext:kcini/82': (a, m, c) => m.ini.valor(String(a[0](c))),
    'ext:kcini/83': (a, m, c) => m.ini.valor(String(a[1](c)), String(a[0](c))),
    'ext:kcini/84': (a, m, c) => m.ini.texto(String(a[0](c))),
    'ext:kcini/85': (a, m, c) => m.ini.texto(String(a[1](c)), String(a[0](c))),
    'ext:kcclock/85': () => new Date().getDate(),
    'ext:kcclock/86': () => new Date().getMonth() + 1,
    'ext:kcclock/87': () => new Date().getFullYear(),
  };
  // Cuántos argumentos (entre paréntesis) lleva cada función. Sin entrada = 0.
  const ARGS = { '-1/1': 1, '-1/4': 1, '-1/5': 1, '-2/2': 1, 'ext:kcini/82': 1, 'ext:kcini/83': 2, 'ext:kcini/84': 1, 'ext:kcini/85': 2 };

  function compilar(toks, motor) {
    let i = 0;
    const ver = () => toks[i];
    function argumentos(n) {
      const a = [];
      if (!n) return a;
      if (esCierre(ver())) { i++; return a; }
      for (;;) {
        a.push(binaria(1));
        const t = toks[i++];
        if (!t || esCierre(t)) break; // si no es ")", es la coma
      }
      return a;
    }
    function primaria() {
      const t = toks[i++];
      if (!t) return () => 0;
      const [tipo, n] = t;
      if (tipo === -1) {
        if (n === 0 || n === 3 || n === 23) { const v = t[2]; return () => v; }
        if (n === -1) { const v = binaria(1); if (esCierre(ver())) i++; return v; } // ( ... )
      }
      let clave;
      if (tipo >= 0 || tipo === -7) {
        const o = motor.O[t[2]];
        const cl = claseDe(o);
        clave = EXPR[cl + '/' + n] ? cl + '/' + n : 'obj/' + n;
        if (ARGS[cl + '/' + n]) clave = cl + '/' + n;
      } else clave = tipo + '/' + n;
      const f = EXPR[clave];
      const a = argumentos(ARGS[clave] || 0);
      if (!f) { avisar('expresión sin implementar ' + clave); return () => 0; }
      return (c) => f(a, motor, c, t);
    }
    function binaria(minPrio) {
      let izq = primaria();
      for (;;) {
        const t = ver();
        if (!t || t[0] !== 0) return izq;
        const p = PRIORIDAD[t[1]] ?? 1;
        if (p < minPrio) return izq;
        i++;
        const der = binaria(p + 1), op = t[1], l = izq;
        izq = (c) => opera(op, l(c), der(c));
      }
    }
    return binaria(1);
  }
  const compiladas = new WeakMap();
  function evaluar(param, motor, ctx) {
    // param = [comparación, tokens]. Si los "tokens" no son una lista, el
    // extractor lo guardó en crudo ([número, hex]): vale el número.
    if (!Array.isArray(param) || !Array.isArray(param[1])) return Array.isArray(param) ? num(param[0]) : num(param);
    let f = compiladas.get(param);
    if (!f) { f = compilar(param[1] || [], motor); compiladas.set(param, f); }
    return f(ctx);
  }

  // ───────────────────────────── instancias ─────────────────────────────
  let siguienteId = 1;
  class Inst {
    constructor(m, oi, x, y, capa) {
      const o = m.O[oi];
      this.id = siguienteId++;
      this.oi = oi; this.o = o; this.clase = claseDe(o);
      this.x = x; this.y = y; this.capa = capa;
      this.visible = o.t === 0 || o.t === 1 ? true : o.visible !== false;
      this.alt = new Array(26).fill(0);
      (o.vals || []).forEach((v, k) => { this.alt[k] = v; });
      this.altS = new Array(10).fill('');
      (o.strs || []).forEach((v, k) => { this.altS[k] = v; });
      this.anim = 0; this.forzada = -1; this.dir = 0; this.cuadro = 0; this.cont = 0;
      this.vueltas = 0; this.animFin = false; this.parada = false;
      this.cuadroForzado = -1; this.velAnimForzada = -1;
      this.alfa = 0; this.vel = 0; this.flash = 0; this.flashT = 0; this.destruido = false;
      this.valor = o.ini ?? 0; this.min = o.min ?? -1e9; this.max = o.max ?? 1e9;
      this.color = null; this.color2 = null;
      this.texto = o.parrafos ? o.parrafos[0].texto : '';
      this.colorTexto = null;
      this.mov = null; this.movIdx = 0;
      if (o.movs && o.movs.length) this.ponerMov(0, true);
      if (o.anims && !o.anims[0]) { const k = Object.keys(o.anims); if (k.length) this.anim = +k[0]; }
    }
    ponerMov(k, alEmpezar) {
      const d = this.o.movs?.[k];
      this.movIdx = k;
      if (!d) { this.mov = null; return; }
      this.mov = { d, activo: alEmpezar ? !!d.mueve : true, paso: 0, hecho: 0, sentido: 1, pausa: 0, x0: this.x, y0: this.y, fin: false };
      const dirs = [];
      for (let b = 0; b < 32; b++) if ((d.dir >>> 0) & (1 << b)) dirs.push(b);
      if (dirs.length) this.dir = dirs[Math.floor(Math.random() * dirs.length)];
      if (d.t === 4 && d.v) { this.vel = d.v[0] ?? 0; this.mov.desacel = d.v[4] ?? 0; }
      if (d.t === 3 && d.v) this.velMax = d.v[1] ?? 50;
    }
  }

  // ───────────────────────────── condiciones ─────────────────────────────
  // (motor, cond, ctx) => bool. Las de objeto filtran ctx.sel y devuelven si
  // quedó alguno; el NO ya viene aplicado por filtrar(). Las demás devuelven
  // el resultado crudo y evaluarCond() aplica el NO.
  const COND = {
    '-1/-1': () => true,                                   // siempre
    '-1/-2': () => false,                                  // nunca
    '-1/-3': (m, c, x) => {                                // comparar dos valores generales
      const cmp = COMPARA[c.p[1][0]];
      return cmp ? cmp(evaluar(c.p[0], m, x), evaluar(c.p[1], m, x)) : false;
    },
    '-1/-6': () => true,                                   // correr este evento una vez (se decide por grupo)
    '-1/-7': () => true,                                   // sólo una vez mientras se repite (por grupo)
    '-3/-1': (m) => m.F.loop === 1,                        // al empezar la pantalla
    '-3/-2': () => false,                                  // al terminar la pantalla (lo corre salirDe)
    '-4/-7': (m, c) => {                                   // el reloj llegó a X (una vez)
      if (c.st.hecho || m.F.tiempo < c.p[0].ms) return false;
      c.st.hecho = true;
      return true;
    },
    '-4/-8': (m, c) => {                                   // cada X ms
      const ms = c.p[0].ms;
      c.st.r = (c.st.r ?? ms) - m.dt;
      if (c.st.r > 0) return false;
      c.st.r += ms;
      if (c.st.r <= 0) c.st.r = ms;
      return true;
    },
    '-6/-1': (m, c) => m.teclasNuevas.has(c.p[0][0]),     // al apretar una tecla
    '-6/-2': (m, c) => m.teclas.has(c.p[0][0]),           // mientras está apretada
    '-6/-4': (m, c, x) => m.filtrar(c.p[0].oi, c, x, (i) => m.mouseSobre(i)), // mouse sobre objeto
    '-6/-5': (m, c) => m.huboClic(c.p[0]),                // clic (o doble clic)
    '-6/-7': (m, c, x) => m.huboClic(c.p[0]) && m.filtrar(c.p[1].oi, { neg: false }, x, (i) => m.mouseSobre(i)), // clic sobre objeto
    '-6/-8': (m, c) => m.mouse.abajo.has(botonVK(c.p[0])),  // mientras el botón está apretado
    // de objetos
    'obj/-81': (m, c, x) => { const cmp = COMPARA[c.p[0][0]], v = evaluar(c.p[0], m, x); return m.filtrar(c.oi, c, x, (i) => cmp(i.valor, v)); },
    'obj/-42': (m, c, x) => { const k = c.p[0][0], cmp = COMPARA[c.p[1][0]], v = evaluar(c.p[1], m, x); return m.filtrar(c.oi, c, x, (i) => cmp(i.alt[k], v)); },
    'obj/-27': (m, c, x) => COND['obj/-42'](m, c, x),
    'obj/-4': (m, c, x) => {                               // se superpone con otro objeto
      const otro = c.p[0].oi, otros = x.sel.get(otro) ?? m.vivos(otro), tocados = new Set();
      const r = m.filtrar(c.oi, c, x, (i) => {
        let toca = false;
        for (const j of otros) if (j !== i && m.tocan(i, j)) { toca = true; tocados.add(j); }
        return toca;
      });
      if (!c.neg) x.sel.set(otro, otros.filter((j) => tocados.has(j)));
      return r;
    },
    'obj/-23': (m, c, x) => {                              // se superpone con un fondo obstáculo
      const fondos = m.F.inst.filter((i) => (i.o.t === 0 || i.o.t === 1) && i.o.obst);
      return m.filtrar(c.oi, c, x, (i) => fondos.some((f) => m.tocan(i, f)));
    },
    'obj/-2': (m, c, x) => { const a = c.p[0][0]; return m.filtrar(c.oi, c, x, (i) => i.anim === a && i.animFin); },     // terminó la animación
    'obj/-3': (m, c, x) => { const a = c.p[0][0]; return m.filtrar(c.oi, c, x, (i) => i.anim === a); },    // es la animación actual
    'obj/-29': (m, c, x) => m.filtrar(c.oi, c, x, (i) => i.visible),
    'obj/-17': (m, c, x) => { const cmp = COMPARA[c.p[0][0]], v = evaluar(c.p[0], m, x); return m.filtrar(c.oi, c, x, (i) => cmp(i.x, v)); },
    'obj/-16': (m, c, x) => { const cmp = COMPARA[c.p[0][0]], v = evaluar(c.p[0], m, x); return m.filtrar(c.oi, c, x, (i) => cmp(i.y, v)); },
    'obj/-22': (m, c, x) => { const cmp = COMPARA[c.p[0][0]] || COMPARA[0], v = evaluar(c.p[0], m, x); return m.filtrar(c.oi, c, x, (i) => cmp(i.vel, v)); },
    'obj/-7': (m, c, x) => m.filtrar(c.oi, c, x, (i) => i.mov?.fin),
    'obj/-32': (m, c, x) => { const cmp = COMPARA[c.p[0][0]], v = evaluar(c.p[0], m, x); return cmp(m.vivos(c.oi).length, v); },
    'obj/-34': (m, c, x) => {                              // elegir uno al azar
      const l = x.sel.get(c.oi) ?? m.vivos(c.oi);
      if (!l.length) return false;
      x.sel.set(c.oi, [l[Math.floor(Math.random() * l.length)]]);
      return true;
    },
  };
  // Las que filtran una selección aplican el NO adentro (sobre cada instancia);
  // a todas las demás se lo aplica evaluarCond.
  const FILTRAN = new Set(['-6/-4']);
  for (const k in COND) if (k.startsWith('obj/') && k !== 'obj/-32' && k !== 'obj/-34') FILTRAN.add(k);
  // Botones: 'i' izquierdo, 'd' derecho, 'm' medio. El parámetro de clic
  // (32) numera 0/1/2; el de "mientras está apretado" (44) usa los códigos de
  // Windows: 1 izquierdo, 2 derecho, 4 medio.
  // En el de clic, el byte alto marca "doble clic" (FNaF 4: "Double-Tap here
  // to run to the door!" es el valor 256 = izquierdo + doble).
  function botonClic(p) { const b = (Array.isArray(p) ? p[0] : 0) & 0xff; return b === 1 ? 'm' : b === 2 ? 'd' : 'i'; }
  function esDoble(p) { return !!(((Array.isArray(p) ? p[0] : 0) >> 8) & 1); }
  function botonVK(p) { const b = Array.isArray(p) ? p[0] : (parseInt(String(p).slice(0, 2), 16) || 1); return b === 2 ? 'd' : b === 4 ? 'm' : 'i'; }

  // ───────────────────────────── acciones ─────────────────────────────
  // ACC["tipo/num"] (motor, acción, ctx) y para objetos ACC["clase/num"] u
  // ACC["obj/num"]: (motor, instancia, params, ctx).
  const ACC = {
    '-2/0': (m, a, x) => m.sonido.tocar(a.p[0].h, 0, 1, a.p[0].fl),
    '-2/1': (m) => m.sonido.pararTodo(),
    '-2/11': (m, a, x) => m.sonido.tocar(a.p[0].h, num(evaluar(a.p[1], m, x)), 1, a.p[0].fl),
    '-2/12': (m, a, x) => m.sonido.tocar(a.p[0].h, num(evaluar(a.p[1], m, x)), num(evaluar(a.p[2], m, x)), a.p[0].fl),
    '-2/15': (m, a, x) => m.sonido.pararCanal(num(evaluar(a.p[0], m, x))),
    '-2/17': (m, a, x) => m.sonido.volumen(num(evaluar(a.p[0], m, x)), num(evaluar(a.p[1], m, x))),
    '-2/20': (m, a, x) => m.sonido.principal(num(evaluar(a.p[0], m, x))),
    '-3/0': (m) => m.saltar(m.F.idx + 1),
    '-3/1': (m) => m.saltar(m.F.idx - 1),
    '-3/2': (m, a) => m.saltar(m.frameDeHandle(a.p[0][0])),
    '-3/4': (m) => m.terminar(),
    '-3/6': (m) => m.saltar(m.F.idx),
    '-3/7': (m, a, x) => { const [px, py] = m.posicion(a.p[0], x); m.centrar(px, py); },
    '-3/8': (m, a, x) => m.centrar(num(evaluar(a.p[0], m, x)), null),
    '-3/9': (m, a, x) => m.centrar(null, num(evaluar(a.p[0], m, x))),
    '-5/0': (m, a, x) => {                                 // crear objeto
      const p = a.p[0];
      if (!m.O[p.oi]) return;
      const [px, py, capa] = m.posicion(p, x);
      const i = m.crear(p.oi, px, py, Math.min(capa, m.F.capas.length - 1));
      x.sel.set(p.oi, [i]);
    },
    // comunes a todos los objetos
    'obj/1': (m, i, p, x) => { const [px, py] = m.posicion(p[0], x); i.x = px; i.y = py; if (i.mov) { i.mov.x0 = px; i.mov.y0 = py; } },
    'obj/2': (m, i, p, x) => { i.x = num(evaluar(p[0], m, x)); },
    'obj/3': (m, i, p, x) => { i.y = num(evaluar(p[0], m, x)); },
    'obj/4': (m, i) => { if (i.mov) i.mov.activo = false; },
    'obj/5': (m, i) => { if (i.mov) { i.mov.activo = true; i.mov.fin = false; } },
    'obj/6': (m, i, p, x) => { i.vel = Math.max(0, Math.min(100, num(evaluar(p[0], m, x)))); },
    'obj/13': (m, i, p) => i.ponerMov(p[0][0], false),
    'obj/15': (m, i) => { i.parada = true; },
    'obj/16': (m, i) => { i.parada = false; },
    'obj/17': (m, i, p) => {                               // cambiar la animación (forzar)
      const n = p[0][0];
      if (!i.o.anims?.[n]) return;
      if (i.forzada !== n || i.anim !== n) { i.forzada = n; i.anim = n; i.cuadro = 0; i.cont = 0; i.vueltas = 0; i.animFin = false; }
    },
    'obj/19': (m, i, p, x) => { i.velAnimForzada = Math.max(0, Math.min(100, num(evaluar(p[0], m, x)))); },
    'obj/20': (m, i) => { i.forzada = -1; },
    'obj/22': (m, i) => { i.velAnimForzada = -1; },
    'obj/23': (m, i, p) => {                               // dirección (máscara de 32 bits)
      const mask = parseInt((p[0][1] || '').slice(0, 8).match(/../g)?.reverse().join('') || '0', 16) >>> 0;
      const dirs = [];
      for (let b = 0; b < 32; b++) if (mask & (1 << b)) dirs.push(b);
      if (dirs.length) i.dir = dirs[Math.floor(Math.random() * dirs.length)];
    },
    'obj/24': (m, i) => { i.destruido = true; },
    'obj/26': (m, i) => { i.visible = false; i.flash = 0; },
    'obj/27': (m, i) => { i.visible = true; i.flash = 0; },
    'obj/28': (m, i, p) => { i.flash = p[0].ms || 100; i.flashT = 0; },
    'obj/31': (m, i, p, x) => { i.alt[p[0][0]] = evaluar(p[1], m, x); },
    'obj/32': (m, i, p, x) => { i.alt[p[0][0]] = num(i.alt[p[0][0]]) + num(evaluar(p[1], m, x)); },
    'obj/33': (m, i, p, x) => { i.alt[p[0][0]] = num(i.alt[p[0][0]]) - num(evaluar(p[1], m, x)); },
    'obj/40': (m, i, p, x) => { i.cuadroForzado = Math.max(0, Math.floor(num(evaluar(p[0], m, x)))); },  // forzar cuadro
    'obj/41': (m, i) => { i.cuadroForzado = -1; },
    'obj/57': (m, i) => m.alFondo(i),
    'obj/58': (m, i) => m.alFrente(i),
    // "Fijar coeficiente de transparencia" REEMPLAZA la transparencia del
    // editor, no se le suma: el menú de FNaF 4 viene al 125/128 (casi
    // invisible) y los eventos lo hacen aparecer con esta acción. Multiplicadas,
    // "New Game" no pasaba nunca del 2 % de opacidad.
    'obj/65': (m, i, p, x) => { i.alfa = Math.max(0, Math.min(255, num(evaluar(p[0], m, x)))); i.alfaPropio = true; },
    // contadores
    'contador/80': (m, i, p, x) => { i.valor = m.limitar(i, num(evaluar(p[0], m, x))); },
    'contador/81': (m, i, p, x) => { i.valor = m.limitar(i, i.valor + num(evaluar(p[0], m, x))); },
    'contador/82': (m, i, p, x) => { i.valor = m.limitar(i, i.valor - num(evaluar(p[0], m, x))); },
    'contador/83': (m, i, p, x) => { i.min = num(evaluar(p[0], m, x)); i.valor = m.limitar(i, i.valor); },
    'contador/84': (m, i, p, x) => { i.max = num(evaluar(p[0], m, x)); i.valor = m.limitar(i, i.valor); },
    'contador/85': (m, i, p) => { i.color = p[0]; },
    'contador/86': (m, i, p) => { i.color2 = p[0]; },
    // textos
    'texto/83': (m, i, p) => { i.colorTexto = p[0]; },
    'texto/88': (m, i, p, x) => { i.texto = String(evaluar(p[0], m, x)); },
    // INI (kcini)
    'ext:kcini/80': (m, i, p, x) => { m.ini.grupo = String(evaluar(p[0], m, x)); },
    'ext:kcini/81': (m, i, p, x) => { m.ini.item = String(evaluar(p[0], m, x)); },
    'ext:kcini/82': (m, i, p, x) => m.ini.poner(m.ini.item, num(evaluar(p[0], m, x))),
    'ext:kcini/85': (m, i, p, x) => m.ini.poner(m.ini.item, String(evaluar(p[0], m, x))),
    'ext:kcini/86': (m, i, p, x) => { m.ini.archivo = String(evaluar(p[0], m, x)); },
    'ext:kcini/87': (m, i, p, x) => m.ini.poner(String(evaluar(p[0], m, x)), num(evaluar(p[1], m, x))),
    'ext:kcini/88': (m, i, p, x) => m.ini.poner(String(evaluar(p[1], m, x)), num(evaluar(p[2], m, x)), String(evaluar(p[0], m, x))),
    'ext:kcini/89': (m, i, p, x) => m.ini.poner(String(evaluar(p[0], m, x)), String(evaluar(p[1], m, x))),
    'ext:kcini/90': (m, i, p, x) => m.ini.poner(String(evaluar(p[1], m, x)), String(evaluar(p[2], m, x)), String(evaluar(p[0], m, x))),
  };

  // ───────────────────────────── el motor ─────────────────────────────
  class Motor {
    /** J: juego.json · imagen(h) → HTMLImageElement|null · sonido: ver Sonido · ini: ver Ini */
    constructor(J, { imagen, sonido, ini, alSalir, alFrame, textos } = {}) {
      this.J = J; this.O = J.objetos;
      this.W = J.app.w; this.H = J.app.h;
      this.fps = J.app.fps || 60;
      this.dt = 1000 / this.fps;
      this.imagen = imagen; this.sonido = sonido; this.ini = ini;
      this.alSalir = alSalir || (() => {}); this.alFrame = alFrame || (() => {});
      this.textos = textos || ((s) => s);
      this.globales = new Map();
      this.teclas = new Set(); this.teclasNuevas = new Set();
      this.mouse = { x: -9999, y: -9999, abajo: new Set(), clics: new Set(), dobles: new Set(), ultimo: null };
      this.F = null; this.pend = null; this.fundido = null; this.cargando = false;
      this.mascaras = new Map();
    }

    frameDeHandle(h) { return this.J.handles?.[h] ?? h; }

    async ir(idx) {
      if (idx < 0 || idx >= this.J.frames.length) { this.alSalir(); idx = 0; }
      this.cargando = true;
      const viejo = this.F;
      if (viejo) {
        // "Global": el objeto conserva sus valores al cambiar de pantalla.
        for (const i of viejo.inst) if (i.o.fl & 4 && !i.destruido) this.globales.set(i.oi, { valor: i.valor, alt: [...i.alt], altS: [...i.altS] });
      }
      const f = this.J.frames[idx];
      await this.alFrame(idx, f);
      const F = {
        idx, f, w: f.w, h: f.h, capas: f.capas.map((c) => ({ ...c, inst: [] })), inst: [],
        loop: 0, tiempo: 0, camX: 0, camY: 0,
      };
      this.F = F;
      for (const d of f.inst) {
        const o = this.O[d.oi];
        if (!o || (d.padre && d.padre[0] !== 0)) continue;
        const i = this.crear(d.oi, d.x, d.y, Math.max(0, Math.min(F.capas.length - 1, d.capa)));
        const g = this.globales.get(d.oi);
        if (g && o.fl & 4) { i.valor = g.valor; i.alt = [...g.alt]; i.altS = [...g.altS]; }
      }
      this.eventos = (f.eventos || []).map((ev) => this.prepararGrupo(ev));
      this.cargando = false;
      this.fundido = f.fadeIn ? { t: 0, ms: f.fadeIn.ms, color: f.fadeIn.color, entra: true } : null;
      if (this.fundido) this.paso();
    }

    prepararGrupo(ev) {
      const g = { c: ev.c.map((c) => this.prepararCond(c)), a: ev.a.map((a) => ({ e: a, t: a[0], n: a[1], oi: a[2], p: a.slice(6).map((q) => q[1]) })) };
      g.unaVez = g.c.some((c) => c.t === -1 && c.n === -6);
      g.noSeguido = g.c.some((c) => c.t === -1 && c.n === -7);
      g.alTerminar = g.c.some((c) => c.t === -3 && c.n === -2);
      g.ult = -10; g.hecho = false;
      return g;
    }

    prepararCond(c) {
      const t = c[0], n = c[1];
      const esObj = t >= 0 || t === -7;
      const clave = esObj ? 'obj/' + n : t + '/' + n;
      return { e: c, t, n, oi: c[2], neg: !!(c[5] & 1), p: c.slice(6).map((q) => q[1]), st: {}, clave, f: COND[clave], esObj };
    }

    crear(oi, x, y, capa) {
      const F = this.F, i = new Inst(this, oi, x, y, capa);
      F.inst.push(i);
      (F.capas[capa] || F.capas[0]).inst.push(i);
      return i;
    }

    vivos(oi) { return this.F.inst.filter((i) => i.oi === oi && !i.destruido); }

    /** Filtra la selección del objeto oi; respeta el NO de la condición. */
    filtrar(oi, c, x, prueba) {
      const quedan = (x.sel.get(oi) ?? this.vivos(oi)).filter((i) => !!prueba(i) !== !!c.neg);
      x.sel.set(oi, quedan);
      return quedan.length > 0;
    }

    /** La instancia que mira una expresión: la de la acción en curso o la primera elegida. */
    instExpr(tok, x) {
      const oi = tok[2];
      if (x?.actual && x.actual.oi === oi) return x.actual;
      const s = x?.sel?.get(oi);
      if (s && s.length) return s[0];
      return this.F.inst.find((i) => i.oi === oi && !i.destruido) || null;
    }

    saltar(idx) { if (this.pend == null) this.pend = idx; }
    terminar() { this.alSalir(); this.saltar(0); }
    tecla(cod, abajo) { if (abajo) { if (!this.teclas.has(cod)) this.teclasNuevas.add(cod); this.teclas.add(cod); } else this.teclas.delete(cod); }
    puntero(x, y) { this.mouse.x = x; this.mouse.y = y; }
    boton(b, abajo) {
      const m = this.mouse;
      if (!abajo) { m.abajo.delete(b); return; }
      m.abajo.add(b); m.clics.add(b);
      // Doble clic: el segundo toque llega en menos de 450 ms y cerca del primero.
      const ahora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const u = m.ultimo;
      if (u && u.b === b && ahora - u.t < 450 && Math.hypot(m.x - u.x, m.y - u.y) < 40) { m.dobles.add(b); m.ultimo = null; }
      else m.ultimo = { b, t: ahora, x: m.x, y: m.y };
    }
    huboClic(p) { const b = botonClic(p); return esDoble(p) ? this.mouse.dobles.has(b) : this.mouse.clics.has(b); }

    // ── imágenes y cajas ──
    imgDe(i) {
      const o = i.o;
      if (o.t === 1) return o.img;
      if (!o.anims) return null;
      const a = o.anims[i.anim] || o.anims[0];
      if (!a) return null;
      const d = this.dirDe(a, i.dir);
      if (!d || !d.cuadros.length) return null;
      const k = i.cuadroForzado >= 0 ? i.cuadroForzado : i.cuadro;
      return d.cuadros[Math.min(k, d.cuadros.length - 1)];
    }
    dirDe(a, dir) {
      if (a[dir]) return a[dir];
      let mejor = null, dist = 99;
      for (const k in a) { const d = Math.min(Math.abs(k - dir), 32 - Math.abs(k - dir)); if (d < dist) { dist = d; mejor = a[k]; } }
      return mejor;
    }
    caja(i) {
      const o = i.o;
      if (o.t === 0 || o.t === 1 || o.t === 3 || o.t === 4) return [i.x, i.y, o.w || 1, o.h || 1];
      if (o.t === 5 || o.t === 6 || o.t === 7) { const w = o.w || 32, h = o.h || 32; return [i.x - w, i.y - h, w, h]; }
      if (o.t >= 32) return [i.x, i.y, 32, 32];
      const h = this.imgDe(i), d = h != null && this.J.imgs[h];
      return d ? [i.x - d[2], i.y - d[3], d[0], d[1]] : [i.x, i.y, 1, 1];
    }
    /** Alfa de una imagen, para colisión por píxel. null mientras no cargó. */
    mascara(h) {
      let m = this.mascaras.get(h);
      if (m !== undefined) return m;
      const img = this.imagen(h);
      if (!img) return null;
      const [w, hh] = this.J.imgs[h];
      try {
        const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, hh) : Object.assign(document.createElement('canvas'), { width: w, height: hh });
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        const px = cx.getImageData(0, 0, w, hh).data, a = new Uint8Array(w * hh);
        for (let k = 0; k < a.length; k++) a[k] = px[k * 4 + 3];
        m = { w, h: hh, a };
      } catch (e) { m = false; }
      this.mascaras.set(h, m);
      return m;
    }
    porCaja(i) { return i.o.t !== 2 || (i.o.nfl & 4) !== 0; }
    tocan(a, b) {
      const A = this.caja(a), B = this.caja(b);
      const x0 = Math.max(A[0], B[0]), y0 = Math.max(A[1], B[1]);
      const x1 = Math.min(A[0] + A[2], B[0] + B[2]), y1 = Math.min(A[1] + A[3], B[1] + B[3]);
      if (x0 >= x1 || y0 >= y1) return false;
      if (this.porCaja(a) && this.porCaja(b)) return true;
      // Por máscara: hay un píxel no transparente de los dos en el cruce.
      const ma = this.porCaja(a) ? null : this.mascara(this.imgDe(a));
      const mb = this.porCaja(b) ? null : this.mascara(this.imgDe(b));
      if (ma === null && !this.porCaja(a)) return true; // sin cargar todavía: como caja
      if (mb === null && !this.porCaja(b)) return true;
      const paso = (x1 - x0) * (y1 - y0) > 40000 ? 2 : 1;
      for (let y = Math.floor(y0); y < y1; y += paso) {
        for (let x = Math.floor(x0); x < x1; x += paso) {
          if (ma && !ma.a[(y - A[1] | 0) * ma.w + (x - A[0] | 0)]) continue;
          if (mb && !mb.a[(y - B[1] | 0) * mb.w + (x - B[0] | 0)]) continue;
          return true;
        }
      }
      return false;
    }
    mouseSobre(i) {
      const capa = this.F.capas[i.capa];
      const mx = this.mouse.x + this.F.camX * (capa?.xc ?? 1), my = this.mouse.y + this.F.camY * (capa?.yc ?? 1);
      const c = this.caja(i);
      if (mx < c[0] || mx >= c[0] + c[2] || my < c[1] || my >= c[1] + c[3]) return false;
      if (this.porCaja(i)) return true;
      const m = this.mascara(this.imgDe(i));
      if (!m) return true;
      return m.a[(my - c[1] | 0) * m.w + (mx - c[0] | 0)] > 0;
    }

    posicion(p, x) {
      let px = p.x, py = p.y, capa = p.capa;
      if (p.oiPadre !== 65535 && p.oiPadre != null) {
        const padre = this.instExpr([0, 0, p.oiPadre], x);
        if (padre) { px += padre.x; py += padre.y; if (capa < 0) capa = padre.capa; }
      }
      return [px, py, capa < 0 ? 0 : capa];
    }

    centrar(x, y) {
      const F = this.F;
      const nx = x != null ? Math.max(0, Math.min(F.w - this.W, Math.round(x - this.W / 2))) : F.camX;
      const ny = y != null ? Math.max(0, Math.min(F.h - this.H, Math.round(y - this.H / 2))) : F.camY;
      const dx = nx - F.camX, dy = ny - F.camY;
      F.camX = nx; F.camY = ny;
      if (dx || dy) {
        // Los objetos que NO siguen al escenario se quedan quietos en pantalla.
        for (const i of F.inst) if (i.o.cfl & 2048) { const c = F.capas[i.capa]; i.x += dx * (c?.xc ?? 1); i.y += dy * (c?.yc ?? 1); }
      }
    }

    limitar(i, v) { return Math.max(i.min, Math.min(i.max, v)); }
    alFrente(i) { const l = this.F.capas[i.capa].inst, k = l.indexOf(i); if (k >= 0) { l.splice(k, 1); l.push(i); } }
    alFondo(i) { const l = this.F.capas[i.capa].inst, k = l.indexOf(i); if (k >= 0) { l.splice(k, 1); l.unshift(i); } }

    // ── un paso (= un cuadro del juego original) ──
    paso() {
      const F = this.F;
      if (!F || this.cargando) return;
      if (this.fundido) {
        this.fundido.t += this.dt;
        if (this.fundido.t >= this.fundido.ms) {
          const fu = this.fundido;
          this.fundido = null;
          if (!fu.entra) { this.ir(fu.destino); return; }
        } else if (F.loop > 0) return;
      }
      F.loop++;
      F.tiempo += this.dt;
      for (const i of F.inst) if (!i.destruido) this.mover(i);
      for (const g of this.eventos) {
        if (g.alTerminar) continue;
        if (this.correrGrupo(g) === 'salto') return;
      }
      this.limpiar();
      this.teclasNuevas.clear();
      this.mouse.clics.clear();
      this.mouse.dobles.clear();
      if (this.pend != null) this.salirDe(F);
    }

    correrGrupo(g) {
      const F = this.F;
      const x = { sel: new Map(), actual: null };
      for (const c of g.c) if (!this.evaluarCond(c, x)) return false;
      // Como Clickteam: "sólo una vez mientras se repite" mira si el GRUPO
      // fue verdadero el cuadro anterior; "una vez" si alguna vez lo fue.
      if (g.noSeguido) { const antes = g.ult === F.loop - 1; g.ult = F.loop; if (antes) return false; }
      if (g.unaVez) { if (g.hecho) return false; g.hecho = true; }
      for (const a of g.a) {
        this.accion(a, x);
        if (this.F !== F) return 'salto';
      }
      return true;
    }

    evaluarCond(c, x) {
      if (!c.f) { avisar('condición sin implementar ' + c.clave); return false; }
      const r = c.f(this, c, x);
      return FILTRAN.has(c.clave) ? r : c.neg ? !r : r;
    }

    accion(a, x) {
      if (a.t < 0 && a.t !== -7) {
        const f = ACC[a.t + '/' + a.n];
        if (f) f(this, a, x); else avisar('acción sin implementar ' + a.t + '/' + a.n);
        return;
      }
      const o = this.O[a.oi];
      const cl = claseDe(o);
      const f = ACC[cl + '/' + a.n] || ACC['obj/' + a.n];
      if (!f) { avisar('acción sin implementar ' + cl + '/' + a.n); return; }
      for (const i of (x.sel.get(a.oi) ?? this.vivos(a.oi))) {
        x.actual = i;
        f(this, i, a.p, x);
      }
      x.actual = null;
    }

    limpiar() {
      const F = this.F;
      if (!F.inst.some((i) => i.destruido)) return;
      F.inst = F.inst.filter((i) => !i.destruido);
      for (const c of F.capas) c.inst = c.inst.filter((i) => !i.destruido);
    }

    salirDe(F) {
      const destino = this.pend;
      this.pend = null;
      // "Al terminar la pantalla": corren justo antes de irse.
      for (const g of this.eventos) if (g.alTerminar) {
        const x = { sel: new Map(), actual: null };
        let ok = true;
        for (const c of g.c) if (!(c.t === -3 && c.n === -2) && !this.evaluarCond(c, x)) { ok = false; break; }
        if (ok) for (const a of g.a) this.accion(a, x);
      }
      const fo = F.f.fadeOut;
      if (fo) this.fundido = { t: 0, ms: fo.ms, color: fo.color, entra: false, destino };
      else this.ir(destino);
    }

    // ── movimientos y animaciones ──
    mover(i) {
      if (i.o.anims) this.animar(i);
      if (i.flash) i.flashT += this.dt;
      const m = i.mov;
      if (!m || !m.activo) return;
      const d = m.d;
      if (d.t === 5) {                                   // trayectoria
        if (m.pausa > 0) { m.pausa -= this.dt; return; }
        const pasos = d.pasos;
        if (!pasos.length) return;
        let p = pasos[m.paso], resto = p.v / 8;
        while (resto > 0 && !m.fin) {
          const largo = p.l || 1, falta = largo - m.hecho, av = Math.min(resto, falta), s = m.sentido;
          i.x += (p.dx / largo) * av * s;
          i.y += (p.dy / largo) * av * s;
          m.hecho += av; resto -= av;
          i.dir = s > 0 ? p.dir : (p.dir + 16) % 32;
          if (m.hecho < largo - 1e-6) continue;
          m.hecho = 0;
          if (p.pausa) m.pausa = p.pausa * 10;
          const sig = m.paso + s;
          if (sig >= 0 && sig < pasos.length) { m.paso = sig; p = pasos[sig]; if (m.pausa > 0) break; continue; }
          if (d.rev && s > 0) { m.sentido = -1; m.paso = pasos.length - 1; p = pasos[m.paso]; continue; }
          if (d.rev && s < 0) { if (d.bucle) { m.sentido = 1; m.paso = 0; p = pasos[0]; continue; } m.fin = true; break; }
          if (d.bucle) { if (d.repos) { i.x = m.x0; i.y = m.y0; } m.paso = 0; p = pasos[0]; continue; }
          m.fin = true; m.activo = false; break;
        }
      } else if (d.t === 4) {                            // rebote
        if (!i.vel) return;
        const ang = (i.dir / 32) * Math.PI * 2, v = i.vel / 8;
        i.x += Math.cos(ang) * v; i.y -= Math.sin(ang) * v;
        if (m.desacel) { m.acum = (m.acum || 0) + m.desacel / 100; while (m.acum >= 1 && i.vel > 0) { i.vel--; m.acum -= 1; } }
      } else if (d.t === 3) {                            // ocho direcciones (teclado)
        const izq = this.teclas.has(37), der = this.teclas.has(39), arr = this.teclas.has(38), aba = this.teclas.has(40);
        const dx = (der ? 1 : 0) - (izq ? 1 : 0), dy = (aba ? 1 : 0) - (arr ? 1 : 0);
        if (!dx && !dy) { i.vel = 0; return; }
        const v = (i.velMax || 50) / 8, n = Math.hypot(dx, dy);
        i.x += (dx / n) * v; i.y += (dy / n) * v;
        i.vel = i.velMax || 50;
        i.dir = Math.round(((Math.atan2(-dy, dx) / (Math.PI * 2)) * 32 + 32) % 32);
      }
    }

    animar(i) {
      const o = i.o;
      if (i.forzada < 0) {
        const quiere = i.mov && i.mov.activo && !i.mov.fin && (i.mov.d.t !== 3 || i.vel) && o.anims[1] ? 1 : o.anims[0] ? 0 : i.anim;
        if (quiere !== i.anim) { i.anim = quiere; i.cuadro = 0; i.cont = 0; i.vueltas = 0; i.animFin = false; }
      }
      if (i.parada || i.animFin || i.cuadroForzado >= 0) return;
      const a = o.anims[i.anim];
      if (!a) return;
      const d = this.dirDe(a, i.dir);
      if (!d || !d.cuadros.length) return;
      // Como CAnim de Clickteam: si min ≠ max, la velocidad depende de la del
      // objeto; si son iguales, es esa.
      let v = d.vmax;
      if (d.vmin !== d.vmax) v = d.vmin + ((d.vmax - d.vmin) * Math.min(100, i.vel)) / 100;
      if (i.velAnimForzada >= 0) v = i.velAnimForzada;
      i.cont += v;
      while (i.cont >= 100) {
        i.cont -= 100;
        if (i.cuadro + 1 < d.cuadros.length) { i.cuadro++; continue; }
        if (d.rep === 0) { i.cuadro = Math.min(d.vuelve || 0, d.cuadros.length - 1); continue; }
        if (++i.vueltas >= d.rep) { i.animFin = true; break; }
        i.cuadro = Math.min(d.vuelve || 0, d.cuadros.length - 1);
      }
    }

    // ── dibujo ──
    dibujar(cx) {
      const F = this.F;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      const fondo = F?.f.fondo || [0, 0, 0];
      cx.fillStyle = `rgb(${fondo[0]},${fondo[1]},${fondo[2]})`;
      cx.fillRect(0, 0, this.W, this.H);
      if (!F) return;
      for (const capa of F.capas) {
        if (!(capa.fl & 16)) continue;
        const ox = -Math.round(F.camX * capa.xc), oy = -Math.round(F.camY * capa.yc);
        // En Clickteam los fondos de una capa van detrás de los demás objetos.
        for (const pase of [true, false]) {
          for (const i of capa.inst) {
            if (i.destruido || !i.visible) continue;
            if ((i.o.t === 0 || i.o.t === 1) !== pase) continue;
            if (i.flash && Math.floor(i.flashT / i.flash) % 2) continue;
            this.dibujarInst(cx, i, ox, oy);
          }
        }
      }
      if (this.fundido) {
        const fu = this.fundido, k = Math.min(1, fu.t / fu.ms);
        cx.globalAlpha = fu.entra ? 1 - k : k;
        cx.fillStyle = `rgb(${fu.color[0]},${fu.color[1]},${fu.color[2]})`;
        cx.fillRect(0, 0, this.W, this.H);
        cx.globalAlpha = 1;
      }
    }

    dibujarInst(cx, i, ox, oy) {
      const o = i.o, efecto = o.tinta & 0xffff;
      let alfa;
      if (i.alfaPropio) alfa = 1 - i.alfa / 255;
      else {
        // Bit 28: el byte alto de tp es el alfa RGBA. Efecto 1 (semitransparente):
        // tp es un coeficiente 0–128 (0 = opaco), no un alfa.
        alfa = (o.tinta & 0x10000000) && efecto !== 1 ? ((o.tp >>> 24) & 255) / 255 : 1;
        if (efecto === 1) alfa *= 1 - Math.min(128, o.tp & 0xffff) / 128;
      }
      if (alfa <= 0.002) return;
      cx.globalAlpha = Math.min(1, alfa);
      cx.globalCompositeOperation = efecto === 9 ? 'lighter' : 'source-over';
      if (o.t === 5 || o.t === 6 || o.t === 7) this.dibujarContador(cx, i, ox, oy);
      else if (o.t === 3 || o.t === 4) this.dibujarTexto(cx, i, ox, oy);
      else if (o.t === 0) this.dibujarForma(cx, i, ox, oy);
      else {
        const h = this.imgDe(i), d = h != null && this.J.imgs[h], img = d && this.imagen(h);
        if (img) {
          const x = o.t === 1 ? i.x : i.x - d[2], y = o.t === 1 ? i.y : i.y - d[3];
          cx.drawImage(img, x + ox, y + oy, d[0], d[1]);
        }
      }
      cx.globalAlpha = 1;
      cx.globalCompositeOperation = 'source-over';
    }

    dibujarForma(cx, i, ox, oy) {
      const f = i.o.forma;
      if (!f) return;
      const c = f.color || f.colorBorde || [0, 0, 0];
      cx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      cx.fillRect(i.x + ox, i.y + oy, i.o.w, i.o.h);
    }

    dibujarContador(cx, i, ox, oy) {
      const o = i.o;
      if (o.mostrar === 1 && o.imgs) {
        const digitos = [...String(Math.round(i.valor))].map((ch) => (ch === '-' ? o.imgs[10] : o.imgs[ch.charCodeAt(0) - 48]));
        let ancho = 0, alto = 0;
        for (const h of digitos) { const d = this.J.imgs[h]; if (d) { ancho += d[0]; alto = Math.max(alto, d[1]); } }
        let x = i.x - ancho + ox;
        for (const h of digitos) {
          const d = this.J.imgs[h], img = this.imagen(h);
          if (d && img) cx.drawImage(img, x, i.y - alto + oy, d[0], d[1]);
          x += d ? d[0] : 0;
        }
      } else if (o.mostrar === 4 && o.imgs?.length) {
        const n = o.imgs.length, rango = i.max - i.min || 1;
        const h = o.imgs[Math.max(0, Math.min(n - 1, Math.floor(((i.valor - i.min) * n) / (rango + 1))))];
        const d = this.J.imgs[h], img = this.imagen(h);
        if (d && img) cx.drawImage(img, i.x - d[2] + ox, i.y - d[3] + oy, d[0], d[1]);
      } else if (o.mostrar === 2 || o.mostrar === 3) {
        const c = i.color || o.color || [255, 255, 255], rango = i.max - i.min || 1;
        const k = Math.max(0, Math.min(1, (i.valor - i.min) / rango));
        cx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        if (o.mostrar === 3) cx.fillRect(i.x - o.w + ox, i.y - o.h + oy, o.w * k, o.h);
        else cx.fillRect(i.x - o.w + ox, i.y - o.h * k + oy, o.w, o.h * k);
      } else if (o.mostrar === 5) {
        const fu = this.J.fuentes?.[o.fuente] || [-16, 400, 0, 'Arial'];
        const c = i.color || o.color || [255, 255, 255];
        cx.font = `${fu[1] >= 600 ? 'bold ' : ''}${Math.abs(fu[0])}px ${this.fuenteWeb(fu[3])}`;
        cx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        cx.textAlign = 'right'; cx.textBaseline = 'bottom';
        cx.fillText(String(Math.round(i.valor)), i.x + ox, i.y + oy);
        cx.textAlign = 'left';
      }
    }

    dibujarTexto(cx, i, ox, oy) {
      const o = i.o, p = o.parrafos?.[0];
      if (!p) return;
      const fu = this.J.fuentes?.[p.fuente] || [-16, 400, 0, 'Arial'];
      const alto = Math.abs(fu[0]);
      cx.font = `${fu[2] ? 'italic ' : ''}${fu[1] >= 600 ? 'bold ' : ''}${alto}px ${this.fuenteWeb(fu[3])}`;
      const c = i.colorTexto || p.color;
      cx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      cx.textBaseline = 'top';
      const centro = p.fl & 1, derecha = p.fl & 2;
      cx.textAlign = centro ? 'center' : derecha ? 'right' : 'left';
      const x = centro ? i.x + o.w / 2 : derecha ? i.x + o.w : i.x;
      const lineas = [];
      for (const linea of this.textos(String(i.texto)).split(/\r?\n/)) {
        let act = '';
        for (const pal of linea.split(' ')) {
          const prueba = act ? act + ' ' + pal : pal;
          if (act && o.w && cx.measureText(prueba).width > o.w) { lineas.push(act); act = pal; } else act = prueba;
        }
        lineas.push(act);
      }
      const paso = alto * 1.15;
      let y = i.y;
      if (p.fl & 4) y += Math.max(0, (o.h - lineas.length * paso) / 2); // centrado vertical
      lineas.forEach((l, k) => cx.fillText(l, x + ox, y + k * paso + oy));
      cx.textAlign = 'left';
    }

    // Las fuentes de Windows no están en el teléfono: la familia más parecida.
    fuenteWeb(n) {
      const s = String(n || '');
      if (/OCR/i.test(s)) return "'OCR A', 'OCR A Extended', Consolas, monospace";
      if (/LCD|Consolas|Lucida Console|Courier/i.test(s)) return "Consolas, 'Courier New', monospace";
      if (/Script|Edwardian|Brush|Hand/i.test(s)) return `'${s}', 'Segoe Script', cursive`;
      if (/Antiqua|Times|Castellar|Garamond|Georgia|Palatino|Serif/i.test(s)) return `'${s}', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif`;
      return `'${s}', Tahoma, Arial, sans-serif`;
    }
  }

  // ───────────────────────────── sonido ─────────────────────────────
  class Sonido {
    constructor(url) {
      this.url = url; this.ctx = null; this.buf = new Map(); this.prom = new Map();
      this.canales = new Map(); this.vol = new Map(); this.princ = 100; this.usuario = 1; this.libre = 1000;
    }
    iniciar() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.maestro = this.ctx.createGain();
      this.aplicar();
      this.maestro.connect(this.ctx.destination);
      for (const k of this.prom.keys()) if (!this.buf.has(k)) this.prom.delete(k);
    }
    cargar(h) {
      if (!this.ctx) return Promise.resolve(null);
      let p = this.prom.get(h);
      if (!p) {
        p = fetch(this.url(h)).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b))
          .then((b) => { this.buf.set(h, b); return b; }).catch(() => null);
        this.prom.set(h, p);
      }
      return p;
    }
    /** vueltas: 1 = una vez; 0 = para siempre; n = n veces. */
    tocar(h, canal, vueltas, fl) {
      if (!this.ctx) return;
      if (!canal) canal = this.libre++;
      this.pararCanal(canal);
      const reg = { h };
      this.canales.set(canal, reg);
      const empezar = (b) => {
        if (!b || this.canales.get(canal) !== reg) return;
        const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
        s.buffer = b;
        g.gain.value = (this.vol.get(canal) ?? 100) / 100;
        if (vueltas !== 1) { s.loop = true; if (vueltas > 1) s.stop(this.ctx.currentTime + b.duration * vueltas); }
        s.connect(g).connect(this.maestro);
        s.start();
        reg.s = s; reg.g = g;
        s.onended = () => { if (this.canales.get(canal) === reg) this.canales.delete(canal); };
      };
      const b = this.buf.get(h);
      if (b) empezar(b); else this.cargar(h).then(empezar);
    }
    pararCanal(c) { const r = this.canales.get(c); if (r) { try { r.s?.stop(); } catch (e) {} this.canales.delete(c); } }
    pararTodo() { for (const c of [...this.canales.keys()]) this.pararCanal(c); }
    volumen(c, v) { v = Math.max(0, Math.min(100, v)); this.vol.set(c, v); const r = this.canales.get(c); if (r?.g) r.g.gain.value = v / 100; }
    volumenCanal(c) { return this.vol.get(c) ?? 100; }
    principal(v) { this.princ = Math.max(0, Math.min(100, v)); this.aplicar(); }
    ponerUsuario(v) { this.usuario = v; this.aplicar(); }
    aplicar() { if (this.maestro) this.maestro.gain.value = (this.princ / 100) * this.usuario; }
    pausar(si) { if (this.ctx) si ? this.ctx.suspend() : this.ctx.resume(); }
  }

  // ───────────────────────────── INI ─────────────────────────────
  // El objeto INI de Clickteam escribe un archivo; acá vive en localStorage,
  // con la misma clave archivo|grupo|item, así que las partidas se guardan.
  class Ini {
    constructor(clave) {
      this.clave = clave; this.archivo = ''; this.grupo = ''; this.item = '';
      try { this.datos = JSON.parse(localStorage.getItem(clave) || '{}'); } catch (e) { this.datos = {}; }
    }
    k(item, grupo) { return this.archivo + '|' + (grupo ?? this.grupo) + '|' + item; }
    valor(item, grupo) { const v = this.datos[this.k(item, grupo)]; return v == null ? 0 : Number(v) || 0; }
    texto(item, grupo) { const v = this.datos[this.k(item, grupo)]; return v == null ? '' : String(v); }
    poner(item, v, grupo) {
      this.datos[this.k(item, grupo)] = v;
      try { localStorage.setItem(this.clave, JSON.stringify(this.datos)); } catch (e) {}
    }
  }

  global.Clickteam = { Motor, Sonido, Ini, COND, ACC, EXPR, ARGS, claseDe, compilar };
})(typeof window !== 'undefined' ? window : globalThis);
