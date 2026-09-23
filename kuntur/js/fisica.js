/* ============================================================================
   kuntur/js/fisica.js — el movimiento de Killa y todo lo que la toca.
   Es puro: nada de three, del DOM ni de Math.random. Node usa este mismo
   archivo para comprobar que cada tramo se puede pasar.
   El mundo es una grilla de baldosas de 1 m, con la y para arriba: la fila de
   arriba del mapa es la de y más alta. Killa es una caja de 0,6 x 1,3 m con
   (x, y) en el medio de los pies.
   ========================================================================== */

export const DT = 1 / 60;
export const K = {
  ANCHO: 0.6, ALTO: 1.3, ALTO_AGACHADA: 0.8,
  CORRE: 5.2, AGACHADA: 2.0, EMPUJA: 2.1,
  ACEL: 48, FRENO: 62, ACEL_AIRE: 30, FRENO_AIRE: 12,
  HIELO_ACEL: 9, HIELO_FRENO: 2.5,
  GRAV: 32, GRAV_CIMA: 0.55, CAIDA_MAX: 18,
  SALTO: 12.2, SALTO2: 10.2, CORTE: 0.45,
  COYOTE: 0.1, BUFFER: 0.13,
  PLANEO_CAIDA: 1.6, PLANEO_VEL: 6.2,
  TERMICA: 6.5, TERMICA_ACEL: 36,
  ESCALERA: 3.4,
  TREPA_T: 0.42,
  MUERTE_T: 1.4,
  ROMPE_T: 0.5, VUELVE_T: 3.5,
};
/* las baldosas */
export const B = { VACIO: 0, SOLIDO: 1, PLAT: 2, ESCALERA: 3, PINCHO: 4, PINCHO_TECHO: 5, ROMPE: 6, PUERTA: 7, HIELO: 8, AGUA: 9 };
const CHAR_B = { '#': B.SOLIDO, '=': B.PLAT, 'H': B.ESCALERA, '^': B.PINCHO, 'v': B.PINCHO_TECHO, '%': B.ROMPE, 'D': B.PUERTA, '_': B.HIELO, '~': B.AGUA };

export const NADA = Object.freeze({ x: 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false });

/* ---------------- armar el mundo de un capítulo ---------------- */
export function crearMundo(nivel, o) {
  o = o || {};
  const filas = nivel.mapa, h = filas.length, w = Math.max(...filas.map((f) => f.length));
  const m = {
    nivel, w, h, t: new Uint8Array(w * h), tiempo: 0, eventos: [],
    habil: Object.assign({}, nivel.habil || {}, o.habil || {}),
    cajas: [], puertas: [], palancas: [], nidos: [], apachetas: [], coplas: [], npcs: [], disparos: [], salida: null,
    rompe: new Map(), pendientes: [], termicas: [], vientos: [], perseguidor: null, vigas: [],
    tomadas: new Set(o.coplas || []), hechos: new Set(),
  };
  const puertaDe = new Map();
  for (let r = 0; r < h; r++) {
    const f = filas[r];
    for (let c = 0; c < w; c++) {
      const ch = f[c] || '.', x = c, y = h - 1 - r, i = y * w + x;
      if (CHAR_B[ch] != null) m.t[i] = CHAR_B[ch];
      switch (ch) {
        case 'S': m.inicio = { x: x + 0.5, y }; break;
        case 'F': m.salida = { x, y }; break;
        case 'B': m.cajas.push({ x, y, w: 1, h: 1, vy: 0, x0: x, y0: y, enSuelo: false }); break;
        case 'A': m.apachetas.push({ x: x + 0.5, y, id: m.apachetas.length, puesta: false }); break;
        case 'K': m.coplas.push({ x: x + 0.5, y: y + 0.5, id: nivel.id + ':' + m.coplas.length, tomada: false }); break;
        case 'N': m.npcs.push({ x: x + 0.5, y, id: null }); break;
        case 't': m.disparos.push({ x: x + 0.5, y, id: null }); break;
        case 'L': m.palancas.push({ x: x + 0.5, y, tirada: false, tipo: 'palanca' }); break;
        case 'O': m.palancas.push({ x: x + 0.5, y: y + 0.5, tirada: false, tipo: 'nido' }); break;
        case 'T': m.termicas.push({ x0: x - 0.2, x1: x + 1.2, y0: y, y1: y }); break;
        default: break;
      }
    }
  }
  /* los que hablan y los disparos se nombran de izquierda a derecha, con las listas del nivel */
  m.npcs.sort((a, b) => a.x - b.x).forEach((n, i) => (n.id = (nivel.npcs || [])[i] || 'npc' + i));
  m.disparos.sort((a, b) => a.x - b.x);
  m.disparos = m.disparos.map((q, i) => { const d = (nivel.disparos || [])[i]; return d ? { x: q.x, y: q.y, id: d.id || d, d: typeof d === 'object' ? d : { id: d } } : null; }).filter(Boolean);
  m.coplas.sort((a, b) => a.x - b.x).forEach((c, i) => (c.id = nivel.id + ':' + i));
  for (const c of m.coplas) if (m.tomadas.has(c.id)) c.tomada = true;
  /* palancas y nidos en orden de izquierda a derecha: el i-ésimo abre la i-ésima puerta */
  m.palancas.sort((a, b) => a.x - b.x);
  m.apachetas.sort((a, b) => a.x - b.x); m.apachetas.forEach((a, i) => (a.id = i));
  /* las puertas: baldosas D juntas son una sola, numeradas de izquierda a derecha */
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) {
    if (m.t[y * w + x] !== B.PUERTA || puertaDe.has(y * w + x)) continue;
    const p = { baldosas: [], abierta: false, x, id: m.puertas.length }, cola = [[x, y]];
    puertaDe.set(y * w + x, p);
    while (cola.length) {
      const [a, b] = cola.pop(); p.baldosas.push([a, b]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = a + dx, ny = b + dy, j = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && m.t[j] === B.PUERTA && !puertaDe.has(j)) { puertaDe.set(j, p); cola.push([nx, ny]); }
      }
    }
    m.puertas.push(p);
  }
  m.puertaDe = puertaDe;
  /* las térmicas suben hasta el primer techo */
  for (const q of m.termicas) { let y = q.y0 + 1; while (y < h && !solidaEn(m, Math.floor(q.x0 + 0.7), y)) y++; q.y1 = y; }
  for (const v of nivel.vientos || []) m.vientos.push(Object.assign({ fase: 0, periodo: 4, activa: 0.5, fuerza: 26 }, v));
  if (!m.inicio) m.inicio = { x: 2.5, y: 2 };
  m.p = nuevaKilla(o.en || m.inicio);
  m.p.checkpoint = { x: m.p.x, y: m.p.y, id: -1 };
  m.fotoCajas = m.cajas.map((c) => [c.x, c.y]);
  return m;
}
function nuevaKilla(en) {
  return {
    x: en.x, y: en.y, vx: 0, vy: 0, w: K.ANCHO, h: K.ALTO, dir: 1,
    enSuelo: true, coyote: 0, buffer: 0, cortado: false, saltoUsado: false, planeoArmado: false, planeando: false,
    agachada: false, estado: 'normal', t: 0, colgado: null, trepa: null, caja: null, empujando: false,
    muerta: false, tMuerta: 0, causa: null, tAire: 0, vyAntes: 0, sinPlat: 0, enTermica: false, rafaga: 0,
  };
}

/* ---------------- preguntas a la grilla ---------------- */
export function baldosa(m, x, y) {
  if (x < 0 || x >= m.w) return B.SOLIDO;
  if (y < 0 || y >= m.h) return B.VACIO;
  return m.t[y * m.w + x];
}
function solidaEn(m, x, y) {
  const b = baldosa(m, x, y);
  if (b === B.SOLIDO || b === B.HIELO) return true;
  if (b === B.PUERTA) { const p = m.puertaDe.get(y * m.w + x); return !(p && p.abierta); }
  if (b === B.ROMPE) { const r = m.rompe.get(y * m.w + x); return !(r && r.cayo); }
  return false;
}
export { solidaEn };
/* ¿choca la caja [x0,x1]x[y0,y1] con algo sólido? (las plataformas no cuentan acá) */
function chocaGrilla(m, x0, y0, x1, y1) {
  for (let ty = Math.floor(y0); ty <= Math.floor(y1 - 1e-6); ty++)
    for (let tx = Math.floor(x0); tx <= Math.floor(x1 - 1e-6); tx++) if (solidaEn(m, tx, ty)) return true;
  return false;
}
function cajaEn(m, x0, y0, x1, y1, salvo) {
  for (const c of m.cajas) if (c !== salvo && x0 < c.x + c.w - 1e-6 && x1 > c.x + 1e-6 && y0 < c.y + c.h - 1e-6 && y1 > c.y + 1e-6) return c;
  return null;
}
export function chocaKilla(m, p, x, y, h) {
  const x0 = x - p.w / 2, x1 = x + p.w / 2, y1 = y + (h || p.h);
  return chocaGrilla(m, x0, y, x1, y1) || !!cajaEn(m, x0, y, x1, y1, null);
}
function tocaTipo(m, x0, y0, x1, y1, tipo) {
  for (let ty = Math.floor(y0); ty <= Math.floor(y1 - 1e-6); ty++)
    for (let tx = Math.floor(x0); tx <= Math.floor(x1 - 1e-6); tx++) if (baldosa(m, tx, ty) === tipo) return true;
  return false;
}
/* lo que hay bajo los pies: 'hielo', 'plat', 'caja', 'solido' o null */
export function sueloDe(m, p) {
  const y = p.y - 0.02, x0 = p.x - p.w / 2 + 0.02, x1 = p.x + p.w / 2 - 0.02;
  let hay = null;
  for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) {
    const ty = Math.floor(y), b = baldosa(m, tx, ty);
    if (solidaEn(m, tx, ty)) { hay = b === B.HIELO && hay !== 'solido' ? 'hielo' : 'solido'; if (hay === 'solido') break; }
    else if (pisable(m, tx, ty) && p.sinPlat <= 0 && Math.abs(p.y - (ty + 1)) < 0.03) hay = hay || 'plat';
  }
  if (!hay && cajaEn(m, x0, y - 0.02, x1, y, null)) hay = 'caja';
  return hay;
}

function evento(m, t, o) { m.eventos.push(Object.assign({ t }, o || {})); }

/* ---------------- un paso de Killa ---------------- */
export function pasarKilla(m, inp) {
  const p = m.p;
  m.tiempo += DT;
  pasarRompe(m);
  pasarPendientes(m);
  if (p.muerta) { p.tMuerta += DT; pasarCajas(m); return; }
  p.t += DT;
  if (inp.saltoE) p.buffer = K.BUFFER; else p.buffer = Math.max(0, p.buffer - DT);
  if (p.sinPlat > 0) p.sinPlat -= DT;

  switch (p.estado) {
    case 'trepando': pasarTrepa(m, p); break;
    case 'colgado': pasarColgado(m, p, inp); break;
    case 'escalera': pasarEscalera(m, p, inp); break;
    case 'agarrado': pasarAgarrado(m, p, inp); break;
    default: pasarNormal(m, p, inp); break;
  }
  pasarCajas(m);
  revisarAlrededor(m, p, inp);
}

/* ¿hay una pared del lado de donde viene el viento? detrás de un bloque no sopla */
function reparado(m, p, dir) {
  const y = Math.floor(p.y + 0.4);
  for (let d = 1; d <= 2; d++) if (solidaEn(m, Math.floor(p.x - dir * (p.w / 2 + d - 0.6)), y)) return true;
  return !!cajaEn(m, p.x - dir * 1.9 - 0.3, p.y + 0.1, p.x - dir * 0.3, p.y + 0.9, null) && dir !== 0;
}
export function rafagaEn(m, v) { return (((m.tiempo + v.fase) % v.periodo) / v.periodo) < v.activa; }
function aplicarViento(m, p) {
  let f = 0;
  for (const v of m.vientos) {
    if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
    const on = rafagaEn(m, v) && !reparado(m, p, v.dir);
    if (on && p.rafaga <= 0) evento(m, 'rafaga', { dir: v.dir });
    p.rafaga = on ? 1 : 0;
    if (on) f += v.dir * v.fuerza;
  }
  if (!f) p.rafaga = 0;
  return f;
}

function pasarNormal(m, p, inp) {
  const suelo = p.enSuelo;
  /* agacharse: en el piso, con abajo. Para pararse tiene que haber lugar */
  const quiereAgachar = suelo && inp.y < 0 && !enEscaleraAbajo(m, p);
  if (quiereAgachar && !p.agachada) { p.agachada = true; p.h = K.ALTO_AGACHADA; }
  else if (!quiereAgachar && p.agachada && !chocaKilla(m, p, p.x, p.y, K.ALTO)) { p.agachada = false; p.h = K.ALTO; }

  /* subirse a una escalera o soga */
  if (inp.y !== 0 && !p.agachada) {
    const tx = Math.floor(p.x);
    const y0 = inp.y > 0 ? p.y + 0.3 : p.y - 0.2;
    if (baldosa(m, tx, Math.floor(y0)) === B.ESCALERA || (inp.y > 0 && baldosa(m, tx, Math.floor(p.y + 1)) === B.ESCALERA)) {
      p.estado = 'escalera'; p.x = tx + 0.5; p.vx = 0; p.vy = 0; p.planeando = false; evento(m, 'escalera');
      if (inp.y < 0 && suelo) p.y -= 0.05;
      return;
    }
  }
  /* agarrar una caja: en el piso, con acción, mirando a la caja */
  if (inp.accion && suelo && !p.agachada) {
    const c = cajaAl(m, p, p.dir);
    if (c) { p.estado = 'agarrado'; p.caja = c; p.vx = 0; evento(m, 'agarra'); return; }
  }

  /* horizontal */
  const fViento = aplicarViento(m, p);
  const piso = sueloDe(m, p);
  const hielo = piso === 'hielo';
  let max = p.agachada ? K.AGACHADA : p.planeando ? K.PLANEO_VEL : K.CORRE;
  if (p.empujando) max = Math.min(max, K.EMPUJA);
  const meta = inp.x * max;
  let acel;
  if (suelo) acel = hielo ? (inp.x ? K.HIELO_ACEL : K.HIELO_FRENO) : (inp.x && Math.sign(inp.x) === Math.sign(p.vx || inp.x) ? K.ACEL : K.FRENO);
  else acel = inp.x ? K.ACEL_AIRE : K.FRENO_AIRE;
  p.vx = acercar(p.vx, meta, acel * DT);
  if (fViento) {
    const k = p.agachada ? 0.2 : suelo ? 0.8 : 1;
    p.vx += fViento * k * DT;
    const lim = 9;
    p.vx = Math.max(-lim, Math.min(lim, p.vx));
  }
  if (inp.x) p.dir = inp.x;

  /* saltos */
  if (suelo) { p.coyote = K.COYOTE; p.saltoUsado = false; p.planeoArmado = false; p.tAire = 0; }
  else { p.coyote -= DT; p.tAire += DT; }
  const bajando = inp.y < 0 && p.buffer > 0 && suelo && piso === 'plat';
  if (bajando) { p.sinPlat = 0.25; p.buffer = 0; p.y -= 0.05; p.enSuelo = false; }
  else if (p.buffer > 0 && (suelo || p.coyote > 0) && !p.agachada) {
    p.vy = K.SALTO; p.buffer = 0; p.coyote = 0; p.cortado = false; p.enSuelo = false;
    evento(m, 'salto');
  } else if (p.buffer > 0 && !suelo && p.coyote <= 0) {
    if (m.habil.aleteo && !p.saltoUsado) {
      p.vy = K.SALTO2; p.saltoUsado = true; p.cortado = false; p.buffer = 0;
      evento(m, 'aleteo');
    }
    if (m.habil.planeo) p.planeoArmado = true;
    p.buffer = 0;
  } else if (p.buffer > 0 && p.agachada && suelo) {
    /* agachada no salta, pero se para si puede */
  }
  if (!inp.salto && p.vy > 0 && !p.cortado) { p.vy *= K.CORTE; p.cortado = true; }

  /* gravedad, planeo y térmicas */
  const cima = inp.salto && Math.abs(p.vy) < 2.2;
  let g = K.GRAV * (cima ? K.GRAV_CIMA : 1);
  const termica = enTermica(m, p);
  const planea = m.habil.planeo && p.planeoArmado && inp.salto && !suelo && p.vy <= 0.5;
  if (planea && !p.planeando) evento(m, 'planeo');
  p.planeando = planea;
  if (termica && !p.enTermica) evento(m, 'termica');
  p.enTermica = !!termica;
  if (planea) {
    if (termica) p.vy = Math.min(K.TERMICA, p.vy + K.TERMICA_ACEL * DT);
    else { p.vy -= g * 0.25 * DT; if (p.vy < -K.PLANEO_CAIDA) p.vy = acercar(p.vy, -K.PLANEO_CAIDA, 40 * DT); }
  } else {
    p.vy -= g * DT;
    if (termica) p.vy += 12 * DT;
  }
  if (p.vy < -K.CAIDA_MAX) p.vy = -K.CAIDA_MAX;

  moverKilla(m, p);
  if (!p.enSuelo && !p.agachada) intentarColgarse(m, p, inp);
}
function enEscaleraAbajo(m, p) { return baldosa(m, Math.floor(p.x), Math.floor(p.y - 0.2)) === B.ESCALERA; }
function enTermica(m, p) {
  for (const q of m.termicas) if (p.x > q.x0 && p.x < q.x1 && p.y >= q.y0 - 0.5 && p.y < q.y1) return q;
  return null;
}
function acercar(v, meta, d) { return v < meta ? Math.min(meta, v + d) : Math.max(meta, v - d); }

/* mover con choques: primero x, después y */
function moverKilla(m, p) {
  const dx = p.vx * DT, dy = p.vy * DT;
  p.empujando = false;
  /* x */
  if (dx !== 0) {
    let nx = p.x + dx;
    if (chocaKilla(m, p, nx, p.y)) {
      /* ¿una caja? empujarla si está en el piso y Killa también */
      const s = Math.sign(dx), x0 = nx - p.w / 2, x1 = nx + p.w / 2;
      const c = cajaEn(m, x0, p.y + 0.05, x1, p.y + p.h, null);
      if (c && p.enSuelo && !chocaGrilla(m, x0, p.y, x1, p.y + p.h)) {
        const quiere = s * Math.min(Math.abs(dx), K.EMPUJA * DT);
        const movio = moverCaja(m, c, quiere);
        if (Math.abs(movio) > 1e-4) { p.empujando = true; if (p.t % 0.3 < DT) evento(m, 'empuja'); }
        nx = p.x + movio;
        if (chocaKilla(m, p, nx, p.y)) nx = p.x;
        else p.x = nx;
        if (!Math.abs(movio)) p.vx = 0;
      } else {
        /* pegarse a la pared */
        if (s > 0) nx = Math.floor(p.x + p.w / 2 + dx) - p.w / 2 - 1e-4;
        else nx = Math.floor(p.x - p.w / 2 + dx) + 1 + p.w / 2 + 1e-4;
        if (!chocaKilla(m, p, nx, p.y) && Math.abs(nx - p.x) <= Math.abs(dx) + 1e-3) p.x = nx;
        p.vx = 0;
      }
    } else p.x = nx;
  }
  /* y */
  const antes = p.enSuelo;
  p.vyAntes = p.vy;
  const ny = p.y + dy;
  if (dy <= 0) {
    const piso = pisoEntre(m, p, p.y, ny);
    if (piso != null) { p.y = piso; p.vy = 0; p.enSuelo = true; }
    else if (!chocaKilla(m, p, p.x, ny)) { p.y = ny; p.enSuelo = false; }
    else { p.vy = 0; p.enSuelo = !!sueloDe(m, p); }
  } else {
    const techo = techoEntre(m, p, p.y + p.h, ny + p.h);
    if (techo != null) { p.y = techo - p.h - 1e-4; p.vy = 0; evento(m, 'cabezazo'); }
    else if (!chocaKilla(m, p, p.x, ny)) p.y = ny;
    else p.vy = 0;
    p.enSuelo = false;
  }
  if (p.enSuelo && !antes) { evento(m, 'aterriza', { fuerza: -p.vyAntes }); p.planeando = false; }
}
/* bajando de y0 a y1: ¿dónde apoya? (baldosas, plataformas si venía de arriba, cajas) */
function pisoEntre(m, p, y0, y1) {
  const x0 = p.x - p.w / 2 + 1e-4, x1 = p.x + p.w / 2 - 1e-4;
  let mejor = null;
  for (let ty = Math.floor(y0 - 1e-6); ty >= Math.floor(y1) - 1; ty--) {
    const tope = ty + 1;
    if (tope > y0 + 1e-6 || tope < y1 - 1e-9) continue;
    for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) {
      if (solidaEn(m, tx, ty) || (pisable(m, tx, ty) && p.sinPlat <= 0 && y0 >= tope - 1e-3)) { mejor = tope; break; }
    }
    if (mejor != null) break;
  }
  for (const c of m.cajas) {
    const tope = c.y + c.h;
    if (x0 < c.x + c.w && x1 > c.x && tope <= y0 + 1e-6 && tope >= y1 - 1e-9) mejor = mejor == null ? tope : Math.max(mejor, tope);
  }
  return mejor;
}
/* plataformas de un lado: los tablones y la punta de arriba de cada escalera */
function pisable(m, x, y) {
  const b = baldosa(m, x, y);
  return b === B.PLAT || (b === B.ESCALERA && baldosa(m, x, y + 1) !== B.ESCALERA && !solidaEn(m, x, y + 1));
}
/* subiendo: ¿dónde choca la cabeza? */
function techoEntre(m, p, y0, y1) {
  const x0 = p.x - p.w / 2 + 1e-4, x1 = p.x + p.w / 2 - 1e-4;
  let mejor = null;
  for (let ty = Math.floor(y0 + 1e-6); ty <= Math.floor(y1); ty++) {
    if (ty < y0 - 1e-6 || ty > y1 + 1e-9) continue;
    for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) if (solidaEn(m, tx, ty)) { mejor = ty; break; }
    if (mejor != null) break;
  }
  for (const c of m.cajas) if (x0 < c.x + c.w && x1 > c.x && c.y >= y0 - 1e-6 && c.y <= y1 + 1e-9) mejor = mejor == null ? c.y : Math.min(mejor, c.y);
  return mejor;
}

/* colgarse de un borde: las manos llegan a la esquina de arriba de una pared */
function intentarColgarse(m, p, inp) {
  if (p.vy > 3 || !inp.x || inp.y < 0) return;
  const d = inp.x;
  const cx = d > 0 ? Math.floor(p.x + p.w / 2 + 0.08) : Math.floor(p.x - p.w / 2 - 0.08);
  const manos = p.y + p.h + 0.15;
  const ty = Math.floor(manos + 0.3);
  for (const yy of [ty, ty - 1]) {
    const tope = yy + 1;
    if (manos < tope - 0.45 || manos > tope + 0.4) continue;
    if (!solidaEn(m, cx, yy) || solidaEn(m, cx, yy + 1) || solidaEn(m, cx, yy + 2)) continue;
    /* del lado de Killa, a la altura del borde, tiene que haber aire */
    const lado = cx - d;
    if (solidaEn(m, lado, yy + 1) || solidaEn(m, lado, yy)) continue;
    if (cajaEn(m, cx, yy + 1, cx + 1, yy + 3, null)) continue;
    const x = d > 0 ? cx - p.w / 2 - 0.01 : cx + 1 + p.w / 2 + 0.01, y = tope - p.h - 0.15;
    if (chocaKilla(m, p, x, y)) continue;
    p.estado = 'colgado'; p.colgado = { cx, tope, dir: d }; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.t = 0;
    p.planeando = false; p.dir = d;
    evento(m, 'cuelga');
    return;
  }
}
function pasarColgado(m, p, inp) {
  const c = p.colgado;
  if (!solidaEn(m, c.cx, c.tope - 1)) { soltar(p); return; }
  if (p.t < 0.12) return;
  if (inp.y < 0) { soltar(p); p.y -= 0.1; return; }
  if (inp.y > 0 || inp.x === c.dir || p.buffer > 0) {
    if (inp.x === -c.dir && p.buffer > 0) {
      /* salto hacia atrás, soltándose */
      soltar(p); p.vy = K.SALTO * 0.85; p.vx = -c.dir * K.CORRE; p.dir = -c.dir; p.buffer = 0; evento(m, 'salto'); return;
    }
    const x1 = c.dir > 0 ? c.cx + p.w / 2 + 0.05 : c.cx + 1 - p.w / 2 - 0.05;
    if (chocaKilla(m, p, x1, c.tope, K.ALTO) && chocaKilla(m, p, x1, c.tope, K.ALTO_AGACHADA)) return;
    p.estado = 'trepando'; p.trepa = { x0: p.x, y0: p.y, x1, y1: c.tope, t: 0 }; p.buffer = 0;
    evento(m, 'trepa');
  }
}
function soltar(p) { p.estado = 'normal'; p.colgado = null; p.enSuelo = false; p.t = 0; }
function pasarTrepa(m, p) {
  const tr = p.trepa;
  tr.t += DT;
  const k = Math.min(1, tr.t / K.TREPA_T);
  /* primero sube, después pasa el cuerpo por arriba del borde */
  const ky = Math.min(1, k / 0.6), kx = Math.max(0, (k - 0.35) / 0.65);
  p.y = tr.y0 + (tr.y1 - tr.y0) * (1 - (1 - ky) * (1 - ky));
  p.x = tr.x0 + (tr.x1 - tr.x0) * kx * kx * (3 - 2 * kx);
  if (k >= 1) {
    p.estado = 'normal'; p.trepa = null; p.colgado = null; p.x = tr.x1; p.y = tr.y1; p.vy = 0; p.vx = 0; p.enSuelo = true; p.t = 0;
    if (chocaKilla(m, p, p.x, p.y, K.ALTO)) { p.agachada = true; p.h = K.ALTO_AGACHADA; }
  }
}
function pasarEscalera(m, p, inp) {
  const tx = Math.floor(p.x);
  if (p.buffer > 0) {
    p.estado = 'normal'; p.buffer = 0; p.vy = K.SALTO * 0.8; p.vx = inp.x * K.CORRE; p.cortado = false;
    if (inp.x) p.dir = inp.x;
    evento(m, 'salto'); return;
  }
  p.vx = 0; p.vy = inp.y * K.ESCALERA;
  let ny = p.y + p.vy * DT;
  /* arriba de todo: se sube al borde */
  /* arriba de todo: se para en la punta de la escalera */
  let top = Math.floor(p.y + 0.3);
  while (baldosa(m, tx, top + 1) === B.ESCALERA) top++;
  if (inp.y > 0 && ny >= top + 1 - 0.05 && baldosa(m, tx, top) === B.ESCALERA) {
    if (!chocaKilla(m, p, p.x, top + 1)) { p.y = top + 1; p.estado = 'normal'; p.vy = 0; p.enSuelo = true; p.sinPlat = 0; evento(m, 'aterriza', { fuerza: 0 }); }
    return;
  }
  if (chocaKilla(m, p, p.x, ny)) {
    if (inp.y < 0) { p.estado = 'normal'; p.enSuelo = true; p.y = Math.ceil(ny - 1e-3); if (chocaKilla(m, p, p.x, p.y)) p.y = Math.floor(p.y) + 1; }
    return;
  }
  const abajo = baldosa(m, tx, Math.floor(ny + 0.1)) === B.ESCALERA || baldosa(m, tx, Math.floor(ny + 0.9)) === B.ESCALERA;
  if (!abajo) { p.estado = 'normal'; p.enSuelo = false; return; }
  p.y = ny;
  if (inp.x && !inp.y) {
    /* de costado se suelta */
    const nx = p.x + inp.x * 0.3;
    if (!chocaKilla(m, p, nx, p.y)) { p.estado = 'normal'; p.dir = inp.x; p.vx = inp.x * 2; p.enSuelo = !!sueloDe(m, p); }
  }
  if (p.t % 0.28 < DT && inp.y) evento(m, 'peldano');
}
function cajaAl(m, p, d) {
  const x = d > 0 ? p.x + p.w / 2 + 0.12 : p.x - p.w / 2 - 0.12;
  const c = cajaEn(m, Math.min(x, p.x), p.y + 0.1, Math.max(x, p.x), p.y + 0.9, null);
  return c && c.enSuelo ? c : null;
}
function pasarAgarrado(m, p, inp) {
  const c = p.caja;
  if (!inp.accion || !p.enSuelo || !c || Math.abs((c.x + c.w / 2) - p.x) > c.w / 2 + p.w / 2 + 0.25 || !c.enSuelo) {
    p.estado = 'normal'; p.caja = null; evento(m, 'suelta'); return;
  }
  const d = c.x + c.w / 2 > p.x ? 1 : -1;
  p.dir = d;
  const quiere = inp.x * K.EMPUJA * DT;
  p.vx = inp.x * K.EMPUJA;
  if (!quiere) { p.empujando = false; return; }
  if (Math.sign(quiere) === d) {
    /* empujar */
    const movio = moverCaja(m, c, quiere);
    const nx = p.x + movio;
    if (!chocaKilla(m, p, nx, p.y)) p.x = nx;
    p.empujando = Math.abs(movio) > 1e-4;
  } else {
    /* tirar: primero se mueve Killa, la caja la sigue */
    const nx = p.x + quiere;
    if (chocaKilla(m, p, nx, p.y) || !sueloBajoEn(m, p, nx)) { p.empujando = false; return; }
    p.x = nx;
    moverCaja(m, c, quiere);
    p.empujando = true;
  }
  if (p.empujando && m.tiempo % 0.35 < DT) evento(m, 'empuja');
}
function sueloBajoEn(m, p, x) { const q = Object.assign({}, p, { x }); return !!sueloDe(m, q); }

/* ---------------- las cajas (piedras, fardos) ---------------- */
function moverCaja(m, c, dx) {
  const nx = c.x + dx;
  const choca = chocaGrilla(m, nx, c.y, nx + c.w, c.y + c.h) || cajaEn(m, nx, c.y, nx + c.w, c.y + c.h, c) ||
    killaEn(m, nx, c.y, nx + c.w, c.y + c.h);
  if (choca) return 0;
  c.x = nx;
  return dx;
}
function killaEn(m, x0, y0, x1, y1) {
  const p = m.p;
  return x0 < p.x + p.w / 2 && x1 > p.x - p.w / 2 && y0 < p.y + p.h && y1 > p.y;
}
function pasarCajas(m) {
  for (const c of m.cajas) {
    c.vy = Math.max(-K.CAIDA_MAX, c.vy - K.GRAV * DT);
    const ny = c.y + c.vy * DT;
    const bajo = chocaGrilla(m, c.x + 0.02, ny, c.x + c.w - 0.02, c.y + c.h) || cajaEn(m, c.x + 0.02, ny, c.x + c.w - 0.02, c.y, c);
    if (bajo && c.vy < 0) {
      const antes = c.enSuelo;
      let y = Math.floor(ny) + 1;
      const debajo = cajaEn(m, c.x + 0.02, ny, c.x + c.w - 0.02, c.y, c);
      if (debajo) y = debajo.y + debajo.h;
      c.y = Math.max(y, Math.min(c.y, y)); c.vy = 0; c.enSuelo = true;
      if (!antes) evento(m, 'cajaCae', { x: c.x + 0.5, y: c.y });
    } else { c.y = ny; c.enSuelo = false; }
    /* se cayó del mapa: vuelve a donde estaba */
    if (c.y < -4) { c.x = c.x0; c.y = c.y0; c.vy = 0; }
  }
}

/* ---------------- lo que se rompe, lo que tarda ---------------- */
function pasarRompe(m) {
  for (const [k, r] of m.rompe) {
    r.t -= DT;
    if (!r.cayo && r.t <= 0) { r.cayo = true; r.t = K.VUELVE_T; evento(m, 'rompe', { x: k % m.w, y: Math.floor(k / m.w) }); }
    else if (r.cayo && r.t <= 0) {
      const x = k % m.w, y = Math.floor(k / m.w);
      if (killaEn(m, x, y, x + 1, y + 1)) { r.t = 0.3; continue; }
      m.rompe.delete(k); evento(m, 'vuelve', { x, y });
    }
  }
}
function pasarPendientes(m) {
  for (let i = m.pendientes.length - 1; i >= 0; i--) {
    const q = m.pendientes[i];
    q.t -= DT;
    if (q.t <= 0) { m.pendientes.splice(i, 1); abrirPuerta(m, q.puerta); }
  }
}
function abrirPuerta(m, i) {
  const pu = m.puertas[i];
  if (!pu || pu.abierta) return;
  pu.abierta = true;
  evento(m, 'puerta', { id: i, x: pu.x });
}

/* ---------------- lo que Killa toca después de moverse ---------------- */
function revisarAlrededor(m, p, inp) {
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2;
  /* pinchos: la mitad de abajo de la baldosa, o la de arriba si cuelgan del techo */
  for (let ty = Math.floor(p.y); ty <= Math.floor(p.y + p.h - 1e-6); ty++)
    for (let tx = Math.floor(x0 + 0.08); tx <= Math.floor(x1 - 0.08); tx++) {
      const b = baldosa(m, tx, ty);
      if (b === B.PINCHO && p.y < ty + 0.45) return morir(m, 'pinchos');
      if (b === B.PINCHO_TECHO && p.y + p.h > ty + 0.55) return morir(m, 'pinchos');
    }
  if (p.y < -2.5) return morir(m, 'caida');
  for (let tx = Math.floor(x0 + 0.1); tx <= Math.floor(x1 - 0.1); tx++) { const ty = Math.floor(p.y + 0.2); if (baldosa(m, tx, ty) === B.AGUA && p.y < ty + 0.55) return morir(m, 'agua'); }
  /* lo que se rompe al pisarlo */
  if (p.enSuelo) for (let tx = Math.floor(x0 + 0.02); tx <= Math.floor(x1 - 0.02); tx++) {
    const ty = Math.floor(p.y - 0.05);
    if (baldosa(m, tx, ty) === B.ROMPE) { const k = ty * m.w + tx; if (!m.rompe.has(k)) { m.rompe.set(k, { t: K.ROMPE_T, cayo: false }); evento(m, 'cruje', { x: tx, y: ty }); } }
  }
  /* apachetas: dejar una piedra guarda el lugar */
  for (const a of m.apachetas) if (!a.puesta && Math.abs(p.x - a.x) < 0.8 && Math.abs(p.y - a.y) < 1.5) {
    a.puesta = true;
    p.checkpoint = { x: a.x, y: a.y, id: a.id };
    m.fotoCajas = m.cajas.map((c) => [c.x, c.y]);
    evento(m, 'apacheta', { id: a.id, x: a.x, y: a.y });
  }
  for (const c of m.coplas) if (!c.tomada && Math.abs(p.x - c.x) < 0.7 && p.y < c.y + 0.6 && p.y + p.h > c.y - 0.6) {
    c.tomada = true; m.tomadas.add(c.id); evento(m, 'copla', { id: c.id, x: c.x, y: c.y });
  }
  /* charlar */
  const pide = inp.accionE || (inp.y > 0 && p.estado === 'normal' && p.enSuelo && !haEscalera(m, p));
  for (const n of m.npcs) if (Math.abs(p.x - n.x) < 1.6 && Math.abs(p.y - n.y) < 1.2) { n.cerca = true; if (pide) evento(m, 'habla', { id: n.id }); } else n.cerca = false;
  /* palancas y nidos (a los nidos va Apu) */
  for (let i = 0; i < m.palancas.length; i++) {
    const l = m.palancas[i];
    if (l.tirada) continue;
    if (l.tipo === 'palanca') {
      l.cerca = Math.abs(p.x - l.x) < 1 && Math.abs(p.y - l.y) < 1;
      if (l.cerca && inp.accionE) { l.tirada = true; evento(m, 'palanca', { id: i }); abrirPuerta(m, i); }
    } else {
      l.cerca = !!m.habil.llamar && Math.abs(p.x - l.x) < 7 && l.y - p.y < 9 && l.y - p.y > -2;
      if (l.cerca && inp.accionE) { l.tirada = true; evento(m, 'apuVa', { id: i, x: l.x, y: l.y }); m.pendientes.push({ t: 1.1, puerta: i }); }
    }
  }
  /* disparos: se cruzan una vez por vida */
  for (const d of m.disparos) if (!m.hechos.has(d.id) && p.x >= d.x && Math.abs(p.y - d.y) < (d.d.alto || 30)) {
    m.hechos.add(d.id);
    const da = (m.nivel.da || {})[d.id];
    if (da) Object.assign(m.habil, da);
    evento(m, 'zona', { id: d.id, x: d.x });
    arrancarPersecucion(m, d);
  }
  pasarPerseguidor(m, p);
  pasarVigas(m, p);
  if (p.muerta) return;
  if (m.salida && p.x >= m.salida.x && Math.abs(p.y - m.salida.y) < 6 && !m.hechos.has('fin')) { m.hechos.add('fin'); evento(m, 'fin'); }
}
function haEscalera(m, p) { return baldosa(m, Math.floor(p.x), Math.floor(p.y + 0.3)) === B.ESCALERA || baldosa(m, Math.floor(p.x), Math.floor(p.y + 1)) === B.ESCALERA; }

/* ---------------- persecuciones: el puma, el viento blanco ---------------- */
function arrancarPersecucion(m, d) {
  const q = (m.nivel.persecuciones || []).find((c) => c.desde === d.id);
  if (!q) return;
  m.perseguidor = { tipo: q.tipo, x: m.p.x - q.ventaja, vel: q.vel, hasta: q.hasta, t: 0, def: q, activo: true };
  evento(m, 'persigue', { tipo: q.tipo });
}
function pasarPerseguidor(m, p) {
  const q = m.perseguidor;
  if (!q || !q.activo) return;
  q.t += DT;
  const v = q.vel * Math.min(1, 0.4 + q.t * 0.5);
  q.x += v * DT;
  if (p.x >= q.hasta) { q.activo = false; evento(m, 'escapa', { tipo: q.tipo }); return; }
  if (q.x >= p.x - (q.tipo === 'puma' ? 0.35 : 0)) morir(m, q.tipo);
}
/* el tren: las vigas y las señales pasan a la velocidad del tren, siempre igual */
function pasarVigas(m, p) {
  const T = m.nivel.tren;
  if (!T || p.muerta) return;
  const L = T.largo, off = (m.tiempo * T.vel) % L;
  for (const v of T.vigas) {
    let x = v.x - off;
    while (x < T.desde) x += L;
    while (x > T.desde + L) x -= L;
    if (Math.abs(x - p.x) > 0.5 + p.w / 2) continue;
    if (v.tipo === 'baja' && p.y + p.h > v.y) return morir(m, 'viga');
    if (v.tipo === 'suelo' && p.y < v.y) return morir(m, 'viga');
  }
}
export function vigasEn(m) {
  const T = m.nivel.tren;
  if (!T) return [];
  const L = T.largo, off = (m.tiempo * T.vel) % L;
  return T.vigas.map((v) => { let x = v.x - off; while (x < T.desde) x += L; while (x > T.desde + L) x -= L; return Object.assign({}, v, { xa: x }); });
}

/* ---------------- morir y volver ---------------- */
function morir(m, causa) {
  const p = m.p;
  if (p.muerta) return;
  p.muerta = true; p.tMuerta = 0; p.causa = causa; p.estado = 'normal'; p.caja = null; p.planeando = false;
  evento(m, 'muere', { causa });
}
export function revivir(m) {
  const p = m.p, c = p.checkpoint;
  Object.assign(p, nuevaKilla(c), { checkpoint: c });
  m.cajas.forEach((b, i) => { const f = m.fotoCajas[i]; b.x = f[0]; b.y = f[1]; b.vy = 0; });
  m.rompe.clear();
  for (const d of m.disparos) if (d.x > c.x + 0.01) m.hechos.delete(d.id);
  m.hechos.delete('fin');
  if (m.perseguidor) {
    const q = m.perseguidor.def;
    /* si el lugar guardado queda en medio de la persecución, arranca de nuevo */
    const disp = m.disparos.find((d) => d.id === q.desde);
    if (disp && c.x >= disp.x && c.x < q.hasta) m.perseguidor = { tipo: q.tipo, x: c.x - q.ventaja - 2, vel: q.vel, hasta: q.hasta, t: -0.6, def: q, activo: true };
    else m.perseguidor = null;
  }
  evento(m, 'revive');
}

/* ---------------- el estado entero, para el resolvedor ---------------- */
export function clave(m, grano) {
  const p = m.p, g0 = grano || 8;
  const gv = g0 >= 8 ? 1 : 0.5;
  /* agachada va despacio: con la grilla gruesa no saldría nunca de su casillero */
  const g = p.agachada || p.estado === 'agarrado' ? g0 * 2 : g0;
  let s = `${Math.round(p.x * g)},${Math.round(p.y * g)},${Math.round(p.vx * gv)},${Math.round(p.vy * gv * 0.7)},${p.estado},${p.saltoUsado ? 1 : 0},${p.planeoArmado ? 1 : 0},${p.agachada ? 1 : 0}`;
  /* colgada, hay que esperar un ratito antes de trepar: el tiempo también cuenta */
  if (p.estado === 'colgado') s += `t${Math.min(3, Math.round(p.t * 10))}`;
  for (const c of m.cajas) s += `|${Math.round(c.x * 4)},${Math.round(c.y * 4)}`;
  for (const pu of m.puertas) s += pu.abierta ? 'a' : 'c';
  for (const l of m.palancas) s += l.tirada ? 'T' : '';
  for (const q of m.pendientes) s += `p${Math.round(q.t * 4)}`;
  if (m.rompe.size) for (const [k, r] of m.rompe) s += `r${k}:${r.cayo ? 1 : 0}${Math.round(r.t * 4)}`;
  if (m.perseguidor && m.perseguidor.activo) s += `q${Math.round((p.x - m.perseguidor.x) * 2)}`;
  /* el viento sopla a ratos: la fase importa si Killa está adentro */
  for (const v of m.vientos) if (p.x > v.x0 - 3 && p.x < v.x1 + 3) s += `w${Math.floor((((m.tiempo + v.fase) % v.periodo) / v.periodo) * 12)}`;
  if (m.nivel.tren) s += `v${Math.round(((m.tiempo * m.nivel.tren.vel) % m.nivel.tren.largo) * 2)}`;
  return s;
}
export function copiar(m) {
  const n = Object.assign({}, m);
  n.p = Object.assign({}, m.p, { colgado: m.p.colgado && Object.assign({}, m.p.colgado), trepa: m.p.trepa && Object.assign({}, m.p.trepa), checkpoint: Object.assign({}, m.p.checkpoint) });
  n.cajas = m.cajas.map((c) => Object.assign({}, c));
  if (m.p.caja) n.p.caja = n.cajas[m.cajas.indexOf(m.p.caja)];
  n.puertas = m.puertas.map((q) => Object.assign({}, q));
  const pd = new Map();
  for (const [k, q] of m.puertaDe) pd.set(k, n.puertas[m.puertas.indexOf(q)]);
  n.puertaDe = pd;
  n.palancas = m.palancas.map((q) => Object.assign({}, q));
  n.apachetas = m.apachetas.map((q) => Object.assign({}, q));
  n.coplas = m.coplas.map((q) => Object.assign({}, q));
  n.npcs = m.npcs.map((q) => Object.assign({}, q));
  n.rompe = new Map([...m.rompe].map(([k, r]) => [k, Object.assign({}, r)]));
  n.pendientes = m.pendientes.map((q) => Object.assign({}, q));
  n.perseguidor = m.perseguidor && Object.assign({}, m.perseguidor);
  n.hechos = new Set(m.hechos);
  n.tomadas = new Set(m.tomadas);
  n.eventos = [];
  return n;
}
/* arrancar en un lugar del medio (una apacheta), como después de revivir ahí:
   lo que quedó atrás ya pasó, y si está en medio de una persecución, empieza */
export function empezarEn(m, en, id) {
  const p = m.p;
  p.x = en.x; p.y = en.y; p.checkpoint = { x: en.x, y: en.y, id: id == null ? -1 : id };
  for (const a of m.apachetas) if (a.x <= en.x + 0.01) a.puesta = true;
  for (const d of m.disparos) if (d.x < en.x - 0.01) { m.hechos.add(d.id); const da = (m.nivel.da || {})[d.id]; if (da) Object.assign(m.habil, da); }
  for (const q of m.nivel.persecuciones || []) {
    const disp = m.disparos.find((d) => d.id === q.desde);
    if (disp && en.x >= disp.x && en.x < q.hasta) m.perseguidor = { tipo: q.tipo, x: en.x - q.ventaja - 2, vel: q.vel, hasta: q.hasta, t: -0.6, def: q, activo: true };
  }
}
