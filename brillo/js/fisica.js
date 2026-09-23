/* ============================================================================
   brillo/js/fisica.js — la física de Nick. Pura: sin azar, sin reloj, sin
   dibujo. La usa el juego y la usa la máquina que comprueba los niveles (en
   Node), así que tiene que dar lo mismo en los dos lados.
   Unidades: píxeles del juego, y para abajo, 60 pasos por segundo.
   El mapa es de baldosas de 16: vacío, piso, tablón de vidrio (se pasa desde
   abajo), bloque plano (gris, se rompe con el zumbido), agua, estática (te
   desconecta) y hongo (rebota). Además hay cosas que se mueven con el reloj
   del mundo (plataformas, burbujas grandes, los planitos), y eso hace que
   todo se pueda repetir igual.
   ========================================================================== */
export const T = 16, DT = 1 / 60;
export const B = { VACIO: 0, PISO: 1, TABLON: 2, PLANO: 3, AGUA: 4, ESTATICA: 5, HONGO: 6, AURORA: 7 };
export const NADA = { x: 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false };

/* cómo se mueve Nick (por paso) */
export const K = {
  ANCHO: 12, ALTO: 26,
  CORRE: 2.45, ACEL: 0.34, FRENO: 0.46, ACEL_AIRE: 0.24, FRENO_AIRE: 0.1,
  GRAV: 0.3, CAIDA: 5.6, SALTO: -5.95, CORTE: -2.1, CIMA: 0.55,
  COYOTE: 6, GUARDA: 6,
  BURBUJA: -3.9, FLOTA: 70, FLOTA_CAIDA: 0.75,
  AGUA_GRAV: 0.07, AGUA_CAIDA: 1.3, AGUA_CORRE: 1.75, BRAZADA: -2.9, SALE_AGUA: -5.4,
  HONGO: -8.7, CORRIENTE: 0.5, CORRIENTE_MAX: -3.3,
  ZUMBIDO_R: 46, ZUMBIDO_CD: 34, MUERTO: 55,
};

const LETRA = { '#': B.PISO, '=': B.TABLON, '%': B.PLANO, '~': B.AGUA, '^': B.ESTATICA, 'b': B.HONGO, 'a': B.AURORA };

/* la Aurora: una ola de luz que camina por las baldosas 'a'. Mientras le pasa
   por encima, la baldosa es un tablón de vidrio; después, aire. */
export const AURORA = { periodo: 192, on: 120, paso: 8 };
export function auroraBrilla(m, tx, t) {
  const A = m.nivel.aurora || AURORA, k = ((t - tx * A.paso) % A.periodo + A.periodo) % A.periodo;
  return k < A.on;
}
/* cuánto le falta para prenderse (0 si ya está prendida) */
export function auroraFalta(m, tx, t) {
  const A = m.nivel.aurora || AURORA, k = ((t - tx * A.paso) % A.periodo + A.periodo) % A.periodo;
  return k < A.on ? 0 : A.periodo - k;
}

/* ---------------- armar el mundo ---------------- */
export function crearMundo(nivel, o = {}) {
  const filas = nivel.filas, H = filas.length, W = Math.max(...filas.map((f) => f.length));
  const m = {
    nivel, W, H, t: 0, eventos: [],
    tiles: new Uint8Array(W * H), rotos: new Set(),
    gotas: [], guinos: [], sesiones: [], zonas: [], corrientes: [], salida: null, inicio: null,
    plataformas: (nivel.plataformas || []).map((q, i) => ({ id: i, ...q })),
    burbujeros: (nivel.burbujeros || []).map((q, i) => ({ id: i, ...q })),
    planitos: (nivel.planitos || []).map((q, i) => ({ id: i, ...q })),
    restaurados: new Set(),
    habil: Object.assign({}, nivel.habil || {}, o.habil || {}),
    juntadas: new Set(o.juntadas || []),
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = filas[y][x] || ' ';
    if (LETRA[c] != null) m.tiles[y * W + x] = LETRA[c];
    const px = x * T + T / 2, py = y * T + T;
    if (c === 'o') m.gotas.push({ id: `${nivel.id}:g${x},${y}`, x: px, y: py - 8 });
    else if (c === 'G') m.guinos.push({ id: `${nivel.id}:G${x},${y}`, x: px, y: py - 8 });
    else if (c === 'S') m.sesiones.push({ id: `S${x}`, x: px, y: py });
    else if (c === 'N') m.inicio = { x: px, y: py };
    else if (c === 'F') m.salida = { x: px, y: py };
    else if (c === 'w') m.corrientes.push({ x, y });
  }
  /* de izquierda a derecha (se leyeron por filas) */
  m.sesiones.sort((a, b) => a.x - b.x);
  for (const z of nivel.zonas || []) m.zonas.push({ ...z });
  /* las corrientes: se juntan por columna en rectángulos */
  m.corriente = new Uint8Array(W * H);
  for (const q of m.corrientes) m.corriente[q.y * W + q.x] = 1;
  const en = o.en || m.inicio || { x: 32, y: 32 };
  m.p = nuevoNick(en);
  m.p.checkpoint = { x: en.x, y: en.y, id: o.en && o.en.id };
  /* lo que ya se juntó en otra vida no vuelve */
  m.gotas = m.gotas.filter((g) => !m.juntadas.has(g.id));
  m.guinos = m.guinos.filter((g) => !m.juntadas.has(g.id));
  for (const id of o.rotos || []) m.rotos.add(id);
  /* retomado desde una sesión: las zonas de atrás ya pasaron (y dieron lo suyo) */
  for (const z of m.zonas) if (o.en && en.x > z.x0) { z.hecha = true; const da = (nivel.da || {})[z.id]; if (da) Object.assign(m.habil, da); }
  return m;
}

export function nuevoNick(en) {
  return {
    x: en.x, y: en.y, vx: 0, vy: 0, w: K.ANCHO, h: K.ALTO, dir: 1,
    enSuelo: false, coyote: 0, guarda: 0, cortado: true, tAire: 0,
    burbujaUsada: false, flota: 0, flotando: false,
    enAgua: false, brazada: 0, enBurbuja: null, zumbidoCd: 0, zumbido: 0,
    muerto: false, tMuerto: 0, sobre: null, saltoRecien: false,
  };
}

/* ---------------- las baldosas ---------------- */
export function baldosa(m, tx, ty) {
  if (tx < 0 || tx >= m.W) return B.PISO;
  if (ty < 0) return B.VACIO;
  if (ty >= m.H) return B.VACIO;
  const b = m.tiles[ty * m.W + tx];
  if (b === B.PLANO && m.rotos.has(ty * m.W + tx)) return B.VACIO;
  if (b === B.AURORA) return auroraBrilla(m, tx, m.t) ? B.TABLON : B.VACIO;
  return b;
}
const solida = (b) => b === B.PISO || b === B.PLANO || b === B.HONGO;
function chocaCaja(m, x0, y0, x1, y1) {
  for (let ty = Math.floor(y0 / T); ty <= Math.floor((y1 - 0.001) / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor((x1 - 0.001) / T); tx++) if (solida(baldosa(m, tx, ty))) return true;
  return false;
}
const cajaDe = (p, x, y) => [x - p.w / 2, y - p.h, x + p.w / 2, y];
function toca(m, p, tipo, achica = 2) {
  const [x0, y0, x1, y1] = cajaDe(p, p.x, p.y);
  for (let ty = Math.floor((y0 + achica) / T); ty <= Math.floor((y1 - achica - 0.001) / T); ty++) for (let tx = Math.floor((x0 + achica) / T); tx <= Math.floor((x1 - achica - 0.001) / T); tx++) if (baldosa(m, tx, ty) === tipo) return true;
  return false;
}

/* ---------------- lo que se mueve con el reloj ---------------- */
/* una plataforma: va y viene entre dos puntos con arranque y frenada suaves */
export function plataformaEn(q, t) {
  const u = (1 - Math.cos(((t + (q.fase || 0)) / q.periodo) * Math.PI * 2)) / 2;
  return { x: q.x0 + (q.x1 - q.x0) * u, y: q.y0 + (q.y1 - q.y0) * u, w: q.w, h: 6 };
}
/* las burbujas grandes de un burbujero: nace una cada `cada` pasos y sube `sube` píxeles */
export function burbujasDe(q, t) {
  const r = [], vida = Math.floor(q.sube / q.vel);
  for (let k = Math.floor((t - vida) / q.cada); k <= Math.floor(t / q.cada); k++) {
    const nace = k * q.cada + (q.fase || 0);
    if (nace > t || t - nace > vida) continue;
    r.push({ id: `${q.id}:${k}`, x: q.x + Math.sin((t - nace) * 0.05 + k) * 3, y: q.y - (t - nace) * q.vel, r: q.r || 14 });
  }
  return r;
}
/* un planito: camina de x0 a x1 y vuelve */
export function planitoEn(q, t) {
  const L = Math.abs(q.x1 - q.x0), per = (L / (q.vel || 0.6)) * 2;
  const k = ((t + (q.fase || 0)) % per) / per;
  const u = k < 0.5 ? k * 2 : 2 - k * 2;
  return { x: q.x0 + (q.x1 - q.x0) * u, y: q.y, dir: k < 0.5 ? Math.sign(q.x1 - q.x0) : -Math.sign(q.x1 - q.x0), w: 14, h: 14 };
}

function evento(m, t, o) { m.eventos.push(Object.assign({ t }, o || {})); }

/* ---------------- un paso ---------------- */
export function paso(m, inp) {
  const p = m.p;
  m.t++;
  if (p.muerto) { p.tMuerto++; return; }
  if (inp.saltoE) p.guarda = K.GUARDA; else if (p.guarda > 0) p.guarda--;
  if (p.zumbidoCd > 0) p.zumbidoCd--;
  if (p.zumbido > 0) p.zumbido--;
  /* el zumbido */
  if (inp.accionE && m.habil.zumbido && p.zumbidoCd === 0) zumbar(m, p);
  if (p.enBurbuja) pasarEnBurbuja(m, p, inp);
  else pasarNormal(m, p, inp);
  revisar(m, p);
}

function zumbar(m, p) {
  p.zumbido = 14; p.zumbidoCd = K.ZUMBIDO_CD;
  const cx = p.x, cy = p.y - p.h / 2, R = K.ZUMBIDO_R;
  const rotos = [];
  for (let ty = Math.floor((cy - R) / T); ty <= Math.floor((cy + R) / T); ty++) for (let tx = Math.floor((cx - R) / T); tx <= Math.floor((cx + R) / T); tx++) {
    if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H) continue;
    const i = ty * m.W + tx;
    if (m.tiles[i] !== B.PLANO || m.rotos.has(i)) continue;
    const dx = Math.max(tx * T - cx, 0, cx - (tx + 1) * T), dy = Math.max(ty * T - cy, 0, cy - (ty + 1) * T);
    if (dx * dx + dy * dy <= R * R) { m.rotos.add(i); rotos.push([tx, ty]); }
  }
  for (const q of m.planitos) {
    if (m.restaurados.has(q.id)) continue;
    const e = planitoEn(q, m.t);
    if (Math.hypot(e.x - cx, e.y - e.h / 2 - cy) < R + 8) { m.restaurados.add(q.id); evento(m, 'restaura', { x: e.x, y: e.y - 7, id: q.id }); }
  }
  evento(m, 'zumbido', { x: cx, y: cy, rotos });
}

function pasarNormal(m, p, inp) {
  const enAgua = toca(m, p, B.AGUA, 6);
  if (enAgua !== p.enAgua) { evento(m, enAgua ? 'agua' : 'saleAgua', { x: p.x, y: p.y }); p.enAgua = enAgua; if (enAgua) { p.burbujaUsada = false; p.flota = 0; p.vy *= 0.35; } }
  const suelo = p.enSuelo;
  /* correr */
  const max = p.enAgua ? K.AGUA_CORRE : K.CORRE;
  const meta = inp.x * max;
  if (inp.x) p.dir = inp.x;
  const acel = suelo ? (inp.x ? K.ACEL : K.FRENO) : (inp.x ? K.ACEL_AIRE : K.FRENO_AIRE);
  if (p.vx < meta) p.vx = Math.min(meta, p.vx + acel); else if (p.vx > meta) p.vx = Math.max(meta, p.vx - acel);
  /* saltar */
  if (suelo) { p.coyote = K.COYOTE; p.burbujaUsada = false; p.tAire = 0; } else { if (p.coyote > 0) p.coyote--; p.tAire++; }
  p.saltoRecien = false;
  if (p.enAgua) {
    if (p.brazada > 0) p.brazada--;
    /* con la cabeza afuera, el salto sale del agua */
    const cabezaAfuera = baldosa(m, Math.floor(p.x / T), Math.floor((p.y - p.h + 4) / T)) !== B.AGUA;
    if (p.guarda > 0 && (cabezaAfuera || p.brazada === 0)) {
      p.vy = cabezaAfuera ? K.SALE_AGUA : K.BRAZADA; p.brazada = 9; p.guarda = 0; p.cortado = !cabezaAfuera;
      evento(m, cabezaAfuera ? 'salto' : 'brazada', { x: p.x, y: p.y });
    }
    p.vy = Math.min(K.AGUA_CAIDA, p.vy + K.AGUA_GRAV);
    if (p.vy < -3 && !cabezaAfuera) p.vy += 0.12;
  } else {
    if (p.guarda > 0 && (suelo || p.coyote > 0)) {
      p.vy = K.SALTO; p.guarda = 0; p.coyote = 0; p.cortado = false; p.enSuelo = false; p.saltoRecien = true;
      evento(m, 'salto', { x: p.x, y: p.y });
    } else if (p.guarda > 0 && !suelo && m.habil.burbuja && !p.burbujaUsada) {
      /* la burbuja: un segundo salto y después flota mientras se mantiene apretado */
      p.vy = K.BURBUJA; p.burbujaUsada = true; p.flota = K.FLOTA; p.guarda = 0; p.cortado = false;
      evento(m, 'burbuja', { x: p.x, y: p.y - p.h / 2 });
    }
    /* soltar el salto corta la subida */
    if (!inp.salto && p.vy < K.CORTE && !p.cortado) { p.vy = K.CORTE; p.cortado = true; }
    if (!inp.salto) p.cortado = true;
    /* la gravedad, más liviana en la cima si se mantiene el salto */
    let g = K.GRAV;
    if (inp.salto && Math.abs(p.vy) < 1.2) g *= K.CIMA;
    p.flotando = false;
    if (p.flota > 0) { p.flota--; if (inp.salto && p.vy > 0) { p.flotando = true; g = 0.05; } }
    p.vy = Math.min(p.flotando ? K.FLOTA_CAIDA : K.CAIDA, p.vy + g);
    /* las corrientes de aire */
    const cx = Math.floor(p.x / T), cy = Math.floor((p.y - p.h / 2) / T);
    if (cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && m.corriente[cy * m.W + cx] && !suelo) p.vy = Math.max(K.CORRIENTE_MAX, p.vy - K.CORRIENTE - (p.flotando ? 0.1 : 0));
    /* bajar de un tablón: abajo + salto */
    if (suelo && inp.y < 0 && inp.saltoE && p.sobre === 'tablon') { p.bajando = 10; p.y += 2; p.enSuelo = false; }
  }
  if (p.bajando > 0) p.bajando--;
  mover(m, p);
}

/* adentro de una burbuja grande: sube con ella; el salto sale saltando */
function pasarEnBurbuja(m, p, inp) {
  const q = m.burbujeros[p.enBurbuja.q];
  const b = burbujasDe(q, m.t).find((x) => x.id === p.enBurbuja.id);
  if (!b || inp.saltoE) {
    p.enBurbuja = null; p.salioDe = b ? b.id : p.salioDe;
    p.vy = inp.saltoE ? K.SALTO * 0.9 : -1; p.vx = inp.x * K.CORRE; p.burbujaUsada = false; p.cortado = false;
    evento(m, 'sale', { x: p.x, y: p.y - p.h / 2, salto: !!inp.saltoE });
    return;
  }
  if (inp.x) p.dir = inp.x;
  p.vx = 0; p.vy = 0;
  p.x = b.x; p.y = b.y + p.h / 2 - 1;
}

/* mover con choques: primero de costado, después de arriba a abajo */
function mover(m, p) {
  const lleva = llevado(m, p);
  if (lleva) { p.x += lleva.dx; p.y += lleva.dy; }
  /* costado */
  let nx = p.x + p.vx;
  const [, y0, , y1] = cajaDe(p, nx, p.y);
  if (chocaCaja(m, nx - p.w / 2, y0, nx + p.w / 2, y1)) {
    /* se acerca hasta la pared */
    const paso = Math.sign(p.vx) * 0.25;
    let k = 0;
    while (k < 40 && !chocaCaja(m, p.x + paso - p.w / 2, y0, p.x + paso + p.w / 2, y1)) { p.x += paso; k++; }
    nx = p.x; p.vx = 0;
  }
  p.x = nx;
  /* vertical */
  const antes = p.y;
  let ny = p.y + p.vy;
  p.enSuelo = false; p.sobre = null;
  if (p.vy < 0) {
    if (chocaCaja(m, p.x - p.w / 2, ny - p.h, p.x + p.w / 2, ny)) {
      /* esquinita: si choca con el filo de una baldosa, lo corre hasta 4 píxeles */
      let corrido = false;
      for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) if (!chocaCaja(m, p.x + d - p.w / 2, ny - p.h, p.x + d + p.w / 2, ny)) { p.x += d; corrido = true; break; }
      if (!corrido) { ny = Math.ceil((ny - p.h) / T) * T + p.h; p.vy = 0; evento(m, 'cabeza', { x: p.x, y: ny - p.h }); }
    }
  } else {
    /* el piso: baldosas sólidas, tablones (si venía de arriba), plataformas */
    const piso = pisoEntre(m, p, antes, ny);
    if (piso) {
      const fuerte = p.vy;
      ny = piso.y; p.vy = 0; p.enSuelo = true; p.sobre = piso.que;
      if (piso.que === 'hongo') { p.vy = K.HONGO; p.enSuelo = false; p.burbujaUsada = false; p.cortado = true; evento(m, 'hongo', { x: p.x, y: ny }); }
      else if (fuerte > 2.4) evento(m, 'aterriza', { x: p.x, y: ny, fuerza: fuerte });
    }
  }
  p.y = ny;
  /* dejó de flotar al pisar */
  if (p.enSuelo) { p.flota = 0; p.flotando = false; }
}

/* ¿apoya algo entre y0 y y1 (los pies)? */
function pisoEntre(m, p, y0, y1) {
  let mejor = null;
  const x0 = p.x - p.w / 2 + 0.5, x1 = p.x + p.w / 2 - 0.5;
  for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) {
    const yt = ty * T;
    if (yt < y0 - 0.001 || yt > y1 + 0.001) continue;
    for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
      const b = baldosa(m, tx, ty);
      const vale = solida(b) || (b === B.TABLON && !(p.bajando > 0));
      if (vale && (!mejor || yt < mejor.y)) mejor = { y: yt, que: b === B.HONGO ? 'hongo' : b === B.TABLON ? 'tablon' : 'piso' };
    }
  }
  /* las plataformas que se mueven: se apoya si venía de arriba */
  for (const q of m.plataformas) {
    const a = plataformaEn(q, m.t - 1), b = plataformaEn(q, m.t);
    if (x1 < b.x || x0 > b.x + b.w * T) continue;
    if (y0 <= a.y + 0.5 && y1 >= b.y - 0.5 && (!mejor || b.y < mejor.y)) mejor = { y: b.y, que: 'plataforma', q: q.id };
  }
  return mejor;
}
/* parado arriba de una plataforma: se mueve con ella */
function llevado(m, p) {
  if (p.sobre !== 'plataforma') return null;
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2;
  for (const q of m.plataformas) {
    const a = plataformaEn(q, m.t - 1), b = plataformaEn(q, m.t);
    if (x1 < a.x - 2 || x0 > a.x + a.w * T + 2) continue;
    if (Math.abs(p.y - a.y) < 1.5) return { dx: b.x - a.x, dy: b.y - a.y };
  }
  return null;
}

/* lo que se toca: gotas, guiños, sesiones, la salida, la estática, los planitos, las burbujas */
function revisar(m, p) {
  const cx = p.x, cy = p.y - p.h / 2;
  for (const g of m.gotas) if (!g.tomada && Math.abs(g.x - cx) < 11 && Math.abs(g.y - cy) < 17) { g.tomada = true; m.juntadas.add(g.id); evento(m, 'gota', { x: g.x, y: g.y, id: g.id }); }
  for (const g of m.guinos) if (!g.tomado && Math.abs(g.x - cx) < 12 && Math.abs(g.y - cy) < 18) { g.tomado = true; m.juntadas.add(g.id); evento(m, 'guino', { x: g.x, y: g.y, id: g.id }); }
  for (const s of m.sesiones) if (p.checkpoint.id !== s.id && Math.abs(s.x - cx) < 12 && Math.abs(s.y - p.y) < 20) { p.checkpoint = { x: s.x, y: s.y, id: s.id }; evento(m, 'sesion', { x: s.x, y: s.y, id: s.id }); }
  if (m.salida && !m.fin && Math.abs(m.salida.x - cx) < 14 && Math.abs(m.salida.y - p.y) < 30) { m.fin = true; evento(m, 'fin'); }
  for (const z of m.zonas) if (!z.hecha && cx >= z.x0 && cx <= z.x1 && (z.y0 == null || (p.y >= z.y0 && p.y <= z.y1))) {
    z.hecha = true;
    const da = (m.nivel.da || {})[z.id]; if (da) Object.assign(m.habil, da);
    evento(m, 'zona', { id: z.id });
  }
  /* la estática te desconecta */
  if (toca(m, p, B.ESTATICA, 3)) return morir(m, 'estatica');
  if (p.y - p.h > m.H * T + 40) return morir(m, 'caida');
  /* los planitos: de arriba se los restaura (y rebota); de costado, desconectan */
  for (const q of m.planitos) {
    if (m.restaurados.has(q.id)) continue;
    const e = planitoEn(q, m.t);
    const ox = Math.abs(e.x - cx) < (p.w + e.w) / 2 - 1, oy = p.y > e.y - e.h && p.y - p.h < e.y;
    if (!ox || !oy) continue;
    if (p.vy > 0.5 && p.y - e.y + e.h < 9) { m.restaurados.add(q.id); p.vy = K.SALTO * 0.75; p.cortado = false; p.burbujaUsada = false; evento(m, 'restaura', { x: e.x, y: e.y - 7, id: q.id, pisado: true }); }
    else return morir(m, 'planito');
  }
  /* las burbujas grandes: tocarlas es meterse (salvo la que recién se dejó) */
  if (!p.enBurbuja) for (const q of m.burbujeros) for (const b of burbujasDe(q, m.t)) {
    if (b.id === p.salioDe) continue;
    if (Math.hypot(b.x - cx, b.y - cy) < b.r + 4) { p.enBurbuja = { q: q.id, id: b.id }; p.vx = 0; p.vy = 0; evento(m, 'entra', { x: b.x, y: b.y }); return; }
  }
}

export function morir(m, causa) {
  const p = m.p;
  if (p.muerto) return;
  p.muerto = true; p.tMuerto = 0; p.causa = causa; p.enBurbuja = null;
  evento(m, 'muere', { causa, x: p.x, y: p.y - p.h / 2 });
}
export function revivir(m) {
  const c = m.p.checkpoint;
  m.p = Object.assign(nuevoNick(c), { checkpoint: c });
  m.fin = false;
  evento(m, 'revive', { x: c.x, y: c.y });
}

/* ---------------- para la máquina que comprueba ---------------- */
/* la máquina que comprueba: no junta gotitas (no cambian nada) y solo mira el guiño que busca */
export function modoResolvedor(m, guino) {
  m.resolvedor = true; m.gotas = [];
  m.guinos = guino ? m.guinos.filter((g) => g.id === guino) : [];
  m.juntadas = new Set();
  return m;
}
export function copiar(m) {
  const n = Object.assign({}, m);
  n.p = Object.assign({}, m.p, { checkpoint: Object.assign({}, m.p.checkpoint), enBurbuja: m.p.enBurbuja && Object.assign({}, m.p.enBurbuja) });
  /* los conjuntos se copian solo si cambiaron (se comparten mientras tanto) */
  n.rotos = m.rotos.size ? new Set(m.rotos) : m.rotos; n.restaurados = m.restaurados.size ? new Set(m.restaurados) : m.restaurados;
  n.juntadas = m.resolvedor && !m.guinos.length ? m.juntadas : new Set(m.juntadas);
  n.habil = Object.assign({}, m.habil);
  if (!m.resolvedor) n.gotas = m.gotas.map((g) => Object.assign({}, g));
  n.guinos = m.guinos.map((g) => Object.assign({}, g));
  n.zonas = m.zonas.map((z) => Object.assign({}, z));
  n.eventos = [];
  return n;
}
/* lo que define el futuro, redondeado: dos estados con la misma clave se tratan igual */
export function clave(m, reloj) {
  const p = m.p;
  let s = `${Math.round(p.x / 2)},${Math.round(p.y / 2)},${Math.round(p.vx * 2)},${Math.round(p.vy)},${p.enSuelo ? 1 : 0}${p.coyote > 0 ? 1 : 0}${p.burbujaUsada ? 1 : 0}${p.flota > 0 ? Math.ceil(p.flota / 20) : 0}${p.cortado ? 1 : 0}${p.enAgua ? 1 : 0}${p.brazada > 0 ? 1 : 0}${p.zumbidoCd > 0 ? 1 : 0}`;
  for (const z of m.zonas) if (z.hecha) s += 'z';
  if (p.enBurbuja) s += `b${p.enBurbuja.id}`;
  if (m.rotos.size) s += `r${[...m.rotos].sort((a, b) => a - b).join('.')}`;
  if (m.restaurados.size) s += `p${[...m.restaurados].sort((a, b) => a - b).join('.')}`;
  if (reloj) s += `t${reloj(m.t)}`;
  return s;
}
