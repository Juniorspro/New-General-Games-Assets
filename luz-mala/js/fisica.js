/* ============================================================================
   luz-mala/js/fisica.js — cómo se mueve y pelea Chispa, la luciérnaga.
   Código puro (sin DOM ni audio): lo usan el juego, el resolvedor de salas y
   la prueba de los jefes en Node. Todo el azar sale de m.rnd (con semilla), así
   una partida con las mismas entradas es siempre la misma.
   Tacto a lo Hollow Knight: acelera y frena casi al instante, el salto se corta
   al soltar, y el golpe para abajo en el aire rebota (pogo).
   ========================================================================== */

const LF = {
  CORRE: 104, ACEL: 1900, FRENO: 2600, AIRE: 0.92,
  GRAV_SUBE: 1150, GRAV_CORTA: 2700, GRAV_CAE: 1500, CAIDA: 340,
  SALTO: -318, COYOTE: 0.09, BUFFER: 0.1,
  DASH: 290, DASH_T: 0.15, DASH_ESPERA: 0.42,
  PARED_DESLIZ: 72, PARED_X: 160, PARED_Y: -300, PARED_FUERZA: 0.13,
  POGO: -290, RETRO: 80, RETRO_T: 0.07,
  GOLPE_T: 0.28, GOLPE_ACTIVO: 0.1,
  EMPUJE_X: 150, EMPUJE_Y: -170, INVULN: 1.25,
  CURAR_T: 0.9, CURAR_COSTO: 33, LUZ_GOLPE: 11, LUZ_MAX: 99,
  ANCHO: 8, ALTO: 12,
};
const LT = { VACIO: 0, SOLIDO: 1, PLAT: 2 };

/* ---------------------------------------------------------------------------
   Leyenda de las salas:
   #  raíz / tierra    =  plataforma que se sube de abajo (sombrero de hongo, tela)
   ^ v < >  espinas de vinal   ~  resina hirviendo (daña y devuelve al último piso)
   B  pared que se rompe a golpes     H  hongo (banco: guarda y cura)
   F  farol (se prende al vencer al jefe de la zona)    $  terrón de ámbar
   K  chispa extra (+1 de vida)       G  compuerta (se abre con una habilidad o un jefe)
   N  alguien para hablar (sala.npcs en orden)          J  el jefe de la arena
   bichos: c cascarudo · m mosquito · g grillo · x chinche · o hormiga soldado
           p polilla · a arañita (cuelga del techo)
   adornos (sin choque): h hongo que brilla · r raíz colgante · t tela · s semilla
   --------------------------------------------------------------------------- */
function crearMundoLM(sala, o) {
  o = o || {};
  const w = sala.mapa[0].length, h = sala.mapa.length;
  const m = {
    sala, w, h, t: new Uint8Array(w * h), rompibles: [], pinchos: [], cosas: [], bichos: [], balas: [], adornos: [],
    eventos: [], tiempo: 0, congelar: 0, rnd: mulberry(semilla32(sala.id + ':' + (o.vuelta || 0))),
    jefe: null, estado: o.estado || {}, habil: o.habil || {},
  };
  const visto = new Uint8Array(w * h);
  const ch = (x, y) => (y >= 0 && y < h && x >= 0 && x < w) ? sala.mapa[y][x] : '#';
  const bloque = (x0, y0, letra) => {
    let x1 = x0; while (ch(x1 + 1, y0) === letra && !visto[y0 * w + x1 + 1]) x1++;
    let y1 = y0;
    for (;;) { let ok = true; for (let x = x0; x <= x1; x++) if (ch(x, y1 + 1) !== letra || visto[(y1 + 1) * w + x]) { ok = false; break; } if (!ok) break; y1++; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) visto[y * w + x] = 1;
    return { x: x0 * 8, y: y0 * 8, w: (x1 - x0 + 1) * 8, h: (y1 - y0 + 1) * 8 };
  };
  let nNpc = 0, nG = 0, nB = 0, nK = 0, nAmbar = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y), i = y * w + x, px = x * 8, py = y * 8;
    if (visto[i]) continue;
    switch (c) {
      case '#': m.t[i] = LT.SOLIDO; break;
      case '=': m.t[i] = LT.PLAT; break;
      case '^': m.pinchos.push({ x: px, y: py + 4, w: 8, h: 4 }); break;
      case 'v': m.pinchos.push({ x: px, y: py, w: 8, h: 4 }); break;
      case '<': m.pinchos.push({ x: px + 4, y: py, w: 4, h: 8 }); break;
      case '>': m.pinchos.push({ x: px, y: py, w: 4, h: 8 }); break;
      case '~': { const r = bloque(x, y, '~'); m.pinchos.push(Object.assign(r, { liquido: true, y: r.y + 3, h: r.h - 3 })); break; }
      case 'B': {
        const r = bloque(x, y, 'B'), id = sala.id + ':B' + (nB++);
        if (!m.estado[id]) m.rompibles.push(Object.assign(r, { id, vida: 3, t: 0 }));
        break;
      }
      case 'G': {
        const r = bloque(x, y, 'G'), def = (sala.compuertas || [])[nG++] || {};
        const abierta = def.abre && (m.habil[def.abre] || m.estado[def.abre]);
        if (!abierta) m.rompibles.push(Object.assign(r, { id: 'G' + nG, compuerta: true, vida: 1e9, def }));
        break;
      }
      case 'H': m.cosas.push({ tipo: 'banco', x: px - 4, y: py, w: 16, h: 8 }); break;
      case 'F': m.cosas.push({ tipo: 'farol', x: px, y: py - 8, w: 8, h: 16, zona: sala.zona }); break;
      case '$': { const id = sala.id + ':$' + (nAmbar++); if (!m.estado[id]) m.cosas.push({ tipo: 'terron', id, x: px, y: py, w: 8, h: 8, vida: 4, dar: 5 }); break; }
      case 'K': { const id = sala.id + ':K' + (nK++); if (!m.estado[id]) m.cosas.push({ tipo: 'chispaExtra', id, x: px, y: py, w: 8, h: 8 }); break; }
      case 'N': { const n = (sala.npcs || [])[nNpc++]; if (n) m.cosas.push({ tipo: 'npc', quien: n, x: px - 4, y: py - 8, w: 16, h: 16 }); break; }
      case 'J': m.jefeEn = { x: px, y: py }; break;
      case 'P': m.spawn = { x: px, y: py + 8 - LF.ALTO }; break;
      case 'c': case 'm': case 'g': case 'x': case 'o': case 'p': case 'a':
        m.bichos.push(crearBicho(c, px, py, m)); break;
      default:
        if (c >= 'a' && c <= 'z') m.adornos.push({ c, x: px, y: py });
    }
  }
  if (!m.spawn) m.spawn = { x: 16, y: 16 };
  m.ext = anilloVecino(sala, w, h);
  m.p = o.jugadora || nuevaChispa(m);
  return m;
}
/* las baldosas de las salas vecinas, en un anillo de 3 alrededor: mientras
   Chispa cruza un borde choca con lo que hay del otro lado, igual que el
   resolvedor, que junta las salas en un solo mapa. Donde no hay sala, es roca */
function anilloVecino(sala, w, h) {
  if (!sala.pos || typeof SALAS_LM === 'undefined') return null;
  const M = 3, W2 = w + 2 * M, H2 = h + 2 * M, d = new Uint8Array(W2 * H2);
  for (let y = -M; y < h + M; y++) for (let x = -M; x < w + M; x++) {
    if (x >= 0 && y >= 0 && x < w && y < h) continue;
    const wx = sala.pos[0] + x, wy = sala.pos[1] + y;
    const v = SALAS_LM.find((q) => q !== sala && wx >= q.pos[0] && wx < q.pos[0] + q.tam[0] && wy >= q.pos[1] && wy < q.pos[1] + q.tam[1]);
    let t = LT.SOLIDO;
    if (v) { const c = v.mapa[wy - v.pos[1]][wx - v.pos[0]]; t = c === '#' || c === 'B' ? LT.SOLIDO : c === '=' ? LT.PLAT : LT.VACIO; }
    d[(y + M) * W2 + (x + M)] = t;
  }
  return { M, W2, H2, d };
}
function tileAfuera(m, tx, ty) {
  const e = m.ext;
  if (!e) return LT.VACIO;
  const x = tx + e.M, y = ty + e.M;
  return x < 0 || y < 0 || x >= e.W2 || y >= e.H2 ? LT.VACIO : e.d[y * e.W2 + x];
}

function nuevaChispa(m) {
  return {
    x: m.spawn.x, y: m.spawn.y, rx: 0, ry: 0, w: LF.ANCHO, h: LF.ALTO, vx: 0, vy: 0, dir: 1,
    enSuelo: false, coyote: 0, buffer: 0, cortado: false, bajaT: 0,
    dashT: 0, dashEspera: 0, dashUsado: false, pared: 0, forzT: 0, forzDir: 0,
    golpeT: 0, golpe: null, retroT: 0, retroDir: 0, invulnT: 0, curarT: 0, curando: false,
    vida: 5, vidaMax: 5, luz: 0, ambar: 0, danio: 1, curaRapida: false,
    ultimoSuelo: { x: m.spawn.x, y: m.spawn.y }, muerta: false, tMuerta: 0, tAire: 0, estado: 'normal',
  };
}

/* ---------------- choques ---------------- */
function solidoLM(m, tx, ty) {
  if (tx < 0 || tx >= m.w || ty < 0 || ty >= m.h) return tileAfuera(m, tx, ty) === LT.SOLIDO;   // afuera: lo de la sala vecina
  return m.t[ty * m.w + tx] === LT.SOLIDO;
}
function chocaLM(m, x, y, w, h) {
  const x0 = Math.floor(x / 8), x1 = Math.floor((x + w - 1) / 8), y0 = Math.floor(y / 8), y1 = Math.floor((y + h - 1) / 8);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidoLM(m, tx, ty)) return true;
  for (const r of m.rompibles) if (cruza(x, y, w, h, r.x, r.y, r.w, r.h)) return r;
  return false;
}
function sobrePlatLM(m, x, y, w, h) {
  const b = y + h;
  if (b % 8 !== 0) return false;
  const ty = b / 8;
  for (let tx = Math.floor(x / 8); tx <= Math.floor((x + w - 1) / 8); tx++) {
    const t = tx >= 0 && tx < m.w && ty >= 0 && ty < m.h ? m.t[ty * m.w + tx] : tileAfuera(m, tx, ty);
    if (t === LT.PLAT) return true;
  }
  return false;
}
function moverXLM(m, e, dx, alChocar) {
  e.rx += dx;
  let n = Math.round(e.rx);
  if (!n) return false;
  e.rx -= n;
  const s = sig(n);
  while (n) {
    const c = chocaLM(m, e.x + s, e.y, e.w, e.h);
    if (c) { e.rx = 0; if (alChocar) alChocar(c, s); return c; }
    e.x += s; n -= s;
  }
  return false;
}
function moverYLM(m, e, dy, alChocar, sinPlat) {
  e.ry += dy;
  let n = Math.round(e.ry);
  if (!n) return false;
  e.ry -= n;
  const s = sig(n);
  while (n) {
    let c = chocaLM(m, e.x, e.y + s, e.w, e.h);
    if (!c && s > 0 && !sinPlat && sobrePlatLM(m, e.x, e.y, e.w, e.h)) c = true;
    if (c) { e.ry = 0; if (alChocar) alChocar(c, s); return c; }
    e.y += s; n -= s;
  }
  return false;
}
function pisaLM(m, e) { return !!(chocaLM(m, e.x, e.y + 1, e.w, e.h) || sobrePlatLM(m, e.x, e.y, e.w, e.h)); }
function paredLM(m, e, d) {
  const x = d > 0 ? e.x + e.w : e.x - 1;
  return !!chocaLM(m, x, e.y + 2, 1, e.h - 4);
}
function eventoLM(m, t, o) { m.eventos.push(Object.assign({ t, x: m.p.x + 4, y: m.p.y + 6 }, o)); }

/* ---------------- entrada ----------------
   inp = { x, y, salto, saltoE, saltoS, golpeE, dashE, curar } */
function entradaLM(E) {
  return {
    x: (E.IN.der ? 1 : 0) - (E.IN.izq ? 1 : 0), y: (E.IN.aba ? 1 : 0) - (E.IN.arr ? 1 : 0),
    salto: !!E.IN.salto, saltoE: !!E.EDGE.salto, golpeE: !!E.EDGE.golpe, dashE: !!E.EDGE.dash, curar: !!E.IN.curar,
  };
}

function pasarChispa(m, inp) {
  const p = m.p;
  m.tiempo += DT;
  if (p.muerta) { p.tMuerta += DT; return; }
  if (p.invulnT > 0) p.invulnT -= DT;
  if (p.golpeT > 0) p.golpeT -= DT;
  if (p.dashEspera > 0) p.dashEspera -= DT;
  if (p.forzT > 0) p.forzT -= DT;
  if (p.retroT > 0) p.retroT -= DT;
  if (p.bajaT > 0) p.bajaT -= DT;
  if (inp.saltoE) p.buffer = LF.BUFFER; else p.buffer -= DT;

  const antes = p.enSuelo;
  p.enSuelo = pisaLM(m, p);
  if (p.enSuelo) {
    p.coyote = LF.COYOTE; p.dashUsado = false; p.pared = 0; p.tAire = 0;
    if (!antes) eventoLM(m, 'aterriza', { fuerza: p.vyAntes || 0 });
    /* el último piso firme: las espinas devuelven acá */
    if (!chocaPeligro(m, p.x - 6, p.y, p.w + 12, p.h + 2)) p.ultimoSuelo = { x: p.x, y: p.y };
  } else { p.coyote -= DT; p.tAire += DT; }
  p.vyAntes = p.vy;

  /* curarse: quieta en el piso, apretando, con luz suficiente */
  if (inp.curar && p.enSuelo && p.luz >= LF.CURAR_COSTO && p.vida < p.vidaMax && !p.golpe && p.dashT <= 0) {
    if (!p.curando) { p.curando = true; p.curarT = 0; eventoLM(m, 'curaEmpieza'); }
    p.curarT += DT; p.vx = 0;
    if (p.curarT >= (p.curaRapida ? LF.CURAR_T * 0.6 : LF.CURAR_T)) {
      p.luz -= LF.CURAR_COSTO; p.vida++; p.curarT = 0; eventoLM(m, 'cura');
      if (p.vida >= p.vidaMax || p.luz < LF.CURAR_COSTO) p.curando = false;
    }
    moverYLM(m, p, p.vy * DT);
    return;
  }
  if (p.curando) { p.curando = false; eventoLM(m, 'curaCorta'); }

  /* dash (aleteo) */
  if (p.dashT > 0) {
    p.dashT -= DT; p.vy = 0;
    moverXLM(m, p, p.vx * DT, () => { p.dashT = 0; });
    if (p.dashT <= 0) p.vx = p.dir * LF.CORRE;
    golpearCosas(m, p);
    tocarCosasLM(m, p, inp);
    return;
  }
  if (inp.dashE && m.habil.aleteo && p.dashEspera <= 0 && !p.dashUsado) {
    p.dashT = LF.DASH_T; p.dashEspera = LF.DASH_ESPERA; if (!p.enSuelo) p.dashUsado = true;
    if (inp.x) p.dir = inp.x;
    p.vx = p.dir * LF.DASH; p.vy = 0; p.pared = 0; p.golpe = null;
    eventoLM(m, 'dash', { d: p.dir });
    return;
  }

  /* horizontal: casi instantáneo, salvo el retroceso de un golpe y el
     empujón de un salto de pared */
  let mx = inp.x;
  if (p.forzT > 0) mx = p.forzDir;
  if (p.retroT > 0) p.vx = p.retroDir * LF.RETRO;
  else {
    const meta = mx * LF.CORRE, k = p.enSuelo ? 1 : LF.AIRE;
    p.vx = acercar(p.vx, meta, (mx ? LF.ACEL : LF.FRENO) * k * DT);
  }
  if (inp.x && !p.golpe && p.forzT <= 0) p.dir = inp.x;

  /* resina: pegada a la pared, cayendo, se desliza despacio */
  p.pared = 0;
  if (m.habil.resina && !p.enSuelo && p.vy > 0 && inp.x && paredLM(m, p, inp.x)) { p.pared = inp.x; p.dir = -inp.x; }

  /* vertical */
  if (!p.enSuelo) {
    let g = p.vy < 0 ? (p.cortado ? LF.GRAV_CORTA : LF.GRAV_SUBE) : LF.GRAV_CAE;
    p.vy = Math.min(p.pared ? LF.PARED_DESLIZ : LF.CAIDA, p.vy + g * DT);
    if (p.vy < 0 && !inp.salto) p.cortado = true;
  }
  /* abajo + salto sobre un tablón: se baja en vez de saltar */
  if (p.buffer > 0 && inp.y > 0 && p.enSuelo && sobrePlatLM(m, p.x, p.y, p.w, p.h) && !chocaLM(m, p.x, p.y + 1, p.w, p.h)) {
    p.buffer = 0; p.coyote = 0; p.bajaT = 0.2; p.enSuelo = false; p.vy = 30;
  }
  /* saltar */
  if (p.buffer > 0) {
    if (p.coyote > 0) { p.buffer = 0; p.coyote = 0; p.vy = LF.SALTO; p.cortado = false; eventoLM(m, 'salto'); }
    else if (p.pared || (m.habil.resina && (paredLM(m, p, 1) || paredLM(m, p, -1)))) {
      const d = p.pared ? -p.pared : (paredLM(m, p, 1) ? -1 : 1);
      p.buffer = 0; p.vy = LF.PARED_Y; p.vx = d * LF.PARED_X; p.forzT = LF.PARED_FUERZA; p.forzDir = d; p.dir = d; p.cortado = false; p.pared = 0; p.dashUsado = false;
      eventoLM(m, 'saltoPared', { d });
    }
  }
  /* golpe con la espina */
  if (inp.golpeE && p.golpeT <= 0) {
    const tipo = inp.y < 0 ? 'arr' : (inp.y > 0 && !p.enSuelo) ? 'aba' : 'lado';
    p.golpe = { tipo, t: 0, pego: new Set(), dir: p.pared ? -p.pared : p.dir };
    p.golpeT = LF.GOLPE_T;
    eventoLM(m, 'golpe', { tipo });
  }
  if (p.golpe) {
    p.golpe.t += DT;
    if (p.golpe.t <= LF.GOLPE_ACTIVO) golpearCosas(m, p);
    if (p.golpe.t > LF.GOLPE_T * 0.7) p.golpe = null;
  }
  moverXLM(m, p, p.vx * DT, () => { p.vx = 0; });
  moverYLM(m, p, p.vy * DT, (c, s) => { if (s < 0) p.cortado = true; p.vy = 0; }, p.bajaT > 0);
  tocarCosasLM(m, p, inp);
}

/* ---------------- el golpe ---------------- */
function cajaGolpe(p) {
  const g = p.golpe;
  if (g.tipo === 'arr') return { x: p.x - 5, y: p.y - 18, w: p.w + 10, h: 20 };
  if (g.tipo === 'aba') return { x: p.x - 5, y: p.y + p.h - 2, w: p.w + 10, h: 20 };
  return g.dir > 0 ? { x: p.x + p.w - 2, y: p.y - 3, w: 22, h: p.h + 6 } : { x: p.x - 20, y: p.y - 3, w: 22, h: p.h + 6 };
}
function golpearCosas(m, p) {
  if (!p.golpe) return;
  const c = cajaGolpe(p), g = p.golpe;
  let pogo = false, retro = false;
  for (const b of m.bichos) {
    if (b.muerto || g.pego.has(b) || !cruza(c.x, c.y, c.w, c.h, b.x, b.y, b.w, b.h)) continue;
    g.pego.add(b);
    if (b.escudo && g.tipo === 'lado' && sig(b.x + b.w / 2 - (p.x + 4)) === -b.dir) { eventoLM(m, 'bloqueo', { x: b.x + b.w / 2, y: b.y + b.h / 2 }); retro = true; continue; }
    danarBicho(m, b, p.danio, g.tipo === 'lado' ? g.dir : 0, g.tipo === 'arr' ? -1 : g.tipo === 'aba' ? 1 : 0);
    p.luz = Math.min(LF.LUZ_MAX, p.luz + LF.LUZ_GOLPE);
    if (g.tipo === 'aba') pogo = true; else retro = true;
  }
  if (m.jefe && !m.jefe.muerto && !g.pego.has(m.jefe) && cruza(c.x, c.y, c.w, c.h, m.jefe.x, m.jefe.y, m.jefe.w, m.jefe.h)) {
    g.pego.add(m.jefe);
    danarJefe(m, m.jefe, p.danio);
    p.luz = Math.min(LF.LUZ_MAX, p.luz + LF.LUZ_GOLPE);
    if (g.tipo === 'aba') pogo = true; else retro = true;
  }
  for (const r of m.rompibles) {
    if (r.compuerta || g.pego.has(r) || !cruza(c.x, c.y, c.w, c.h, r.x, r.y, r.w, r.h)) continue;
    g.pego.add(r);
    r.vida--; r.t = 0.12;
    eventoLM(m, r.vida <= 0 ? 'rompe' : 'pega', { x: r.x + r.w / 2, y: r.y + r.h / 2, bw: r.w, bh: r.h });
    if (r.vida <= 0) { m.estado[r.id] = true; m.rompibles.splice(m.rompibles.indexOf(r), 1); }
    retro = true;
  }
  for (const q of m.cosas) {
    if (q.tipo !== 'terron' || g.pego.has(q) || !cruza(c.x, c.y, c.w, c.h, q.x, q.y, q.w, q.h)) continue;
    g.pego.add(q);
    q.vida--; p.ambar += 1; eventoLM(m, 'terron', { x: q.x + 4, y: q.y + 4, fin: q.vida <= 0 });
    if (q.vida <= 0) { m.estado[q.id] = true; p.ambar += q.dar; m.cosas.splice(m.cosas.indexOf(q), 1); }
    retro = true;
  }
  for (const b of m.balas) {
    if (b.rompible && cruza(c.x, c.y, c.w, c.h, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)) { b.vida = 0; eventoLM(m, 'bala', { x: b.x, y: b.y }); }
  }
  /* pogo también en las espinas: es la gracia de golpear para abajo */
  if (g.tipo === 'aba' && !pogo) for (const q of m.pinchos) if (!q.liquido && cruza(c.x, c.y, c.w, c.h, q.x, q.y, q.w, q.h)) { pogo = true; eventoLM(m, 'pogoEspina'); break; }
  if (pogo && !g.pogoHecho) { g.pogoHecho = true; p.vy = LF.POGO; p.cortado = false; p.dashUsado = false; eventoLM(m, 'pogo'); m.congelar = Math.max(m.congelar, 2); }
  if (retro && !g.retroHecho && g.tipo === 'lado') { g.retroHecho = true; p.retroT = LF.RETRO_T; p.retroDir = -g.dir; m.congelar = Math.max(m.congelar, 3); }
}

/* ---------------- daño y peligros ---------------- */
function chocaPeligro(m, x, y, w, h) {
  for (const q of m.pinchos) if (cruza(x, y, w, h, q.x, q.y, q.w, q.h)) return q;
  return null;
}
function lastimar(m, desdeX, cuanto, peligro) {
  const p = m.p;
  if (p.invulnT > 0 || p.muerta || m.asist && m.asist.invencible) {
    if (peligro && m.asist && m.asist.invencible && !p.muerta) { volverAlSuelo(m); }
    return false;
  }
  p.vida -= cuanto || 1;
  p.invulnT = LF.INVULN; p.curando = false; p.golpe = null; p.dashT = 0;
  const d = sig(p.x + 4 - desdeX) || -p.dir;
  p.vx = d * LF.EMPUJE_X; p.vy = LF.EMPUJE_Y; p.retroT = 0.12; p.retroDir = d;
  m.congelar = 8;
  eventoLM(m, 'dano', { vida: p.vida });
  if (p.vida <= 0) { p.muerta = true; p.tMuerta = 0; p.vx = p.vy = 0; eventoLM(m, 'muere'); }
  else if (peligro) m.volverAlSuelo = 0.25;
  return true;
}
function volverAlSuelo(m) {
  const p = m.p;
  p.x = p.ultimoSuelo.x; p.y = p.ultimoSuelo.y; p.vx = p.vy = 0; p.rx = p.ry = 0;
  eventoLM(m, 'vuelve');
}

function tocarCosasLM(m, p, inp) {
  if (m.volverAlSuelo != null) { m.volverAlSuelo -= DT; if (m.volverAlSuelo <= 0) { m.volverAlSuelo = null; if (!p.muerta) volverAlSuelo(m); } }
  const q = chocaPeligro(m, p.x, p.y, p.w, p.h);
  if (q && !p.muerta) lastimar(m, p.x + 4 - p.dir, 1, true);
  for (const c of m.cosas) {
    if (!cruza(p.x, p.y, p.w, p.h, c.x, c.y, c.w, c.h)) { if (c.tipo === 'npc') c.cerca = false; continue; }
    if (c.tipo === 'banco') { c.cerca = true; if (inp.y < 0 && p.enSuelo && !c.sentada) eventoLM(m, 'banco', { x: c.x + 8, y: c.y }); }
    else if (c.tipo === 'npc') { c.cerca = true; if (inp.y < 0 && !c.hablo) eventoLM(m, 'habla', { quien: c.quien }); }
    else if (c.tipo === 'chispaExtra') { m.estado[c.id] = true; p.vidaMax++; p.vida = p.vidaMax; m.cosas.splice(m.cosas.indexOf(c), 1); eventoLM(m, 'chispaExtra', { x: c.x + 4, y: c.y + 4 }); break; }
    else if (c.tipo === 'ambar') { p.ambar += c.valor; m.cosas.splice(m.cosas.indexOf(c), 1); eventoLM(m, 'ambar', { x: c.x, y: c.y }); break; }
  }
  /* los bichos lastiman al tocarlos */
  for (const b of m.bichos) if (!b.muerto && b.lastima !== false && cruza(p.x + 1, p.y + 1, p.w - 2, p.h - 2, b.x, b.y, b.w, b.h)) { lastimar(m, b.x + b.w / 2, 1); break; }
  if (m.jefe && !m.jefe.muerto && m.jefe.toca !== false && cruza(p.x + 1, p.y + 1, p.w - 2, p.h - 2, m.jefe.x + 2, m.jefe.y + 2, m.jefe.w - 4, m.jefe.h - 4)) lastimar(m, m.jefe.x + m.jefe.w / 2, 1);
  /* el ámbar suelto vuela hacia Chispa */
  for (const c of m.cosas) if (c.tipo === 'ambar') {
    const dx = p.x + 4 - c.x, dy = p.y + 6 - c.y, d = Math.hypot(dx, dy);
    if (d < (p.iman ? 150 : 70) && c.t > 0.3) { c.vx += dx / d * 900 * DT; c.vy += dy / d * 900 * DT; }
  }
}

/* el ámbar que sueltan los bichos: rebota y después se junta solo */
function soltarAmbar(m, x, y, n) {
  for (let i = 0; i < n; i++) m.cosas.push({ tipo: 'ambar', valor: 1, x, y, w: 3, h: 3, vx: (m.rnd() - 0.5) * 120, vy: -60 - m.rnd() * 90, t: 0 });
}
function pasarAmbar(m) {
  for (const c of m.cosas) if (c.tipo === 'ambar') {
    c.t += DT;
    c.vy = Math.min(260, c.vy + 700 * DT); c.vx *= 0.985;
    const nx = c.x + c.vx * DT, ny = c.y + c.vy * DT;
    if (chocaLM(m, nx, c.y, 3, 3)) c.vx *= -0.5; else c.x = nx;
    if (chocaLM(m, c.x, ny, 3, 3) || sobrePlatLM(m, c.x, c.y, 3, 3) && c.vy > 0) c.vy *= -0.4; else c.y = ny;
  }
}

/* la sala de al lado: salir por un borde lleva a la que esté pegada ahí */
function salidaDe(m) {
  const p = m.p;
  if (p.x + p.w < 0) return 'izq';
  if (p.x > m.w * 8) return 'der';
  if (p.y + p.h < 0) return 'arr';
  if (p.y > m.h * 8) return 'aba';
  return null;
}
