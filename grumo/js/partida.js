// Un nivel jugándose: Grumo, la plastilina del set y lo que el animador le
// hace (las trampas). Sin DOM: la usan el juego, el resolvedor y las pruebas
// en Node.
//
// Grumo se mueve a 120 pasos por segundo (el control tiene que responder
// al toque); el mundo — bloques que caen o se corren, pinches que salen, la
// mano del animador, la puerta, las bolas — se mueve de a cuadros, 12 por
// segundo, como en el stop motion. Lo que se ve es exactamente lo que choca:
// no hay un bloque "dibujado acá" que en realidad ya está más abajo.
//
// Unidades: baldosas. El escenario es de 10 × 15, con y para abajo; Grumo
// se ubica por los pies (x al medio, y abajo). Los costados y el techo del
// escenario son paredes; abajo, el que se cae se muere.
import { clamp, lerp, suave, salida, entrada } from './util.js';

export const COLS = 10;
export const FILAS = 15;
export const PASO = 1 / 120;
// pasos de física por cuadro del mundo: 12 cuadros por segundo
export const CUADRO = 10;
// la caja de choque de Grumo: un poco más chica que el dibujo (perdona los roces)
export const ANCHO = 0.6;
export const ALTO = 0.7;
// correr y saltar, en baldosas y segundos: sube 2,6 baldosas y corriendo
// cruza casi 4 (se mide en pruebas/logica.mjs)
export const FIS = {
  vmax: 5.6, acelSuelo: 70, frenoSuelo: 85, acelAire: 45, frenoAire: 22,
  g: 42, gCaida: 47, salto: 14.8, corte: 0.45, caidaMax: 17,
  coyote: 0.09, buffer: 0.12, resorte: 20.5,
};
// cuánto tarda cada parte de la mano del animador (aviso = solo la sombra)
export const MANO = { aviso: 0.35, entra: 0.33, agarra: 0.12, lleva: 0.5, suelta: 0.12, sale: 0.33 };
const TOL = 0.04;                   // lo que se tolera de encimado antes de contar un aplastado
// al mover en un eje, la caja se achica esto en el otro: pegado a una pared
// (x = 1,9999999 por redondeo) no tiene que chocar con la pared al subir
const EPS = 1e-4;
const CAIDA_BLOQUE = 30, CAIDA_BLOQUE_MAX = 14;

const CURVAS = { suave, lineal: (t) => t, rapida: salida, golpe: entrada };
const DIRS = { '^': 'arriba', v: 'abajo', '<': 'izq', '>': 'der' };

// El mapa: 15 filas de 10 letras.
//   #  bloque fijo          -  tabla (se atraviesa desde abajo)
//   ^ v < >  pinches fijos (para dónde apuntan)
//   R  resorte              P  donde arranca Grumo     D  la puerta
//   a…z  celdas de un grupo (qué es cada grupo lo dice def.grupos)
export function leerMapa(def) {
  const filas = def.mapa;
  if (!Array.isArray(filas) || filas.length !== FILAS) throw new Error(`${def.id}: el mapa tiene ${filas?.length} filas y van ${FILAS}`);
  const fijo = new Uint8Array(COLS * FILAS), pinches = [], resortes = [], celdas = {};
  let inicio = null, puerta = null;
  filas.forEach((fila, f) => {
    if (fila.length !== COLS) throw new Error(`${def.id}: la fila ${f} tiene ${fila.length} letras`);
    [...fila].forEach((ch, c) => {
      if (ch === '#') fijo[f * COLS + c] = 1;
      else if (ch === '-') fijo[f * COLS + c] = 2;
      else if (DIRS[ch]) pinches.push({ c, f, dir: DIRS[ch] });
      else if (ch === 'R') resortes.push({ c, f });
      else if (ch === 'P') inicio = [c + 0.5, f + 1];
      else if (ch === 'D') puerta = [c + 0.5, f + 1];
      else if (ch >= 'a' && ch <= 'z') (celdas[ch] ||= []).push([c, f]);
      else if (ch !== '.') throw new Error(`${def.id}: no sé qué es '${ch}' en (${c}, ${f})`);
    });
  });
  if (!inicio) throw new Error(`${def.id}: falta la P`);
  if (!puerta) throw new Error(`${def.id}: falta la D`);
  for (const id of Object.keys(def.grupos || {})) if (!celdas[id]) throw new Error(`${def.id}: el grupo ${id} no tiene celdas en el mapa`);
  return { fijo, pinches, resortes, celdas, inicio, puerta };
}

// el rectángulo de una celda según lo que es (en `o`, para no crear arreglos)
function rectDe(tipo, dir, c, f, o) {
  if (tipo === 'tabla') { o[0] = c; o[1] = f; o[2] = c + 1; o[3] = f + 0.24; }
  else if (tipo === 'resorte') { o[0] = c + 0.12; o[1] = f + 0.58; o[2] = c + 0.88; o[3] = f + 1; }
  else if (tipo === 'pinches') {
    // la caja que mata es más chica que el dibujo: la punta no mata de lejos
    if (dir === 'abajo') { o[0] = c + 0.18; o[1] = f; o[2] = c + 0.82; o[3] = f + 0.38; }
    else if (dir === 'izq') { o[0] = c + 0.62; o[1] = f + 0.18; o[2] = c + 1; o[3] = f + 0.82; }
    else if (dir === 'der') { o[0] = c; o[1] = f + 0.18; o[2] = c + 0.38; o[3] = f + 0.82; }
    else { o[0] = c + 0.18; o[1] = f + 0.62; o[2] = c + 0.82; o[3] = f + 1; }
  } else { o[0] = c; o[1] = f; o[2] = c + 1; o[3] = f + 1; }
  return o;
}
const R = [0, 0, 0, 0];
export function rectCelda(tipo, dir, c, f) { return rectDe(tipo, dir, c, f, [0, 0, 0, 0]); }

function armarGrupos(def, m) {
  return Object.entries(m.celdas).map(([id, celdas]) => {
    const d = (def.grupos || {})[id] || {};
    let c0 = Infinity, f0 = Infinity, c1 = -Infinity, f1 = -Infinity;
    for (const [c, f] of celdas) { c0 = Math.min(c0, c); f0 = Math.min(f0, f); c1 = Math.max(c1, c + 1); f1 = Math.max(f1, f + 1); }
    return {
      id, tipo: d.tipo || 'bloque', dir: d.dir || 'arriba', celdas, c0, f0, c1, f1,
      ox: 0, oy: 0, visible: !d.oculto, k: d.oculto ? 0 : 1,
      falso: !!d.falso, golpe: !!d.golpe, fragil: d.fragil || 0, blanda: d.blanda || 0, vaiven: d.vaiven || null,
      mov: null, cae: null, tiembla: -1, pisado: -1, hundido: 0, muestra: 0,
    };
  });
}

export class Partida {
  constructor(def, { toma = 1 } = {}) {
    this.def = def;
    this.m = leerMapa(def);
    this.toma = toma;
    this.t = 0; this.pasos = 0; this.tick = 0;
    this.estado = 'juego';               // juego → muerto | gano
    this.tFin = 0; this.causa = null;
    this.eventos = [];
    this.control = { dir: 0, salto: false };
    this.saltoAntes = false; this.saltoEste = false;
    const [x, y] = this.m.inicio;
    this.j = { x, y, px: x, py: y, vx: 0, vy: 0, suelo: false, sobre: null, coyote: 0, buffer: 0, saltando: false, mira: def.mira || 1, agarrado: false };
    this.grupos = armarGrupos(def, this.m);
    this.g = Object.fromEntries(this.grupos.map((g) => [g.id, g]));
    this.trampas = (def.trampas || []).map((tr, i) => ({ i, id: tr.id ?? i, si: tr.si || {}, hace: tr.hace || [], una: tr.una !== false, hecha: false, t: -1 }));
    this.agenda = [];
    const [px, py] = this.m.puerta;
    this.puerta = { x: px, y: py, mov: null, ocupada: 0, oculta: !!def.puertaOculta, patas: false, salto: -9 };
    this.falsas = (def.falsas || []).map(([c, f]) => ({ x: c + 0.5, y: f + 1, golpe: -9 }));
    this.manos = []; this.bolas = []; this.notas = [];
    this.oscuro = -1;                    // hasta cuándo está apagada la luz
    this.corte = -99;                    // el cuadro del último "corte" (el negro de la cámara)
    this.temblor = -1;
    this.acumulado = 0;
    // si el tiempo cambia el mundo (algo que va y viene, o una trampa por
    // reloj), el resolvedor tiene que distinguir el mismo lugar en otro momento
    this.conReloj = this.grupos.some((g) => g.vaiven) || this.trampas.some((t) => t.si.tiempo !== undefined);
  }

  // ── lo de afuera ─────────────────────────────────────────────────────────
  // avanza lo que tardó el cuadro de la pantalla; devuelve cuánto le falta al
  // próximo paso (0 a 1) para dibujar a Grumo entre paso y paso
  avanzar(dtReal) {
    this.acumulado += Math.min(dtReal, 0.1);
    while (this.acumulado >= PASO) { this.paso(); this.acumulado -= PASO; }
    return this.acumulado / PASO;
  }
  sacarEventos() { const e = this.eventos; this.eventos = []; return e; }
  evento(tipo, datos = {}) { this.eventos.push({ tipo, t: this.t, ...datos }); }
  get T() { return this.pasos * PASO; }

  // ── el paso ──────────────────────────────────────────────────────────────
  paso() {
    const j = this.j;
    this.t += PASO; this.pasos++;
    j.px = j.x; j.py = j.y;
    this.saltoEste = false;
    if (this.estado === 'juego') {
      const c = this.control, flanco = !!c.salto && !this.saltoAntes;
      this.saltoAntes = !!c.salto;
      if (!j.agarrado) this.moverJugador(c.dir | 0, !!c.salto, flanco);
      this.revisarTrampas();
    } else this.tFin += PASO;
    if (this.pasos % CUADRO === 0) this.cuadroMundo();
    if (this.estado === 'juego') { this.peligros(); this.llegar(); }
  }

  moverJugador(dir, salto, flanco) {
    const j = this.j, F = FIS, dt = PASO;
    if (flanco) j.buffer = F.buffer;
    j.coyote = j.suelo ? F.coyote : Math.max(0, j.coyote - dt);
    j.buffer = Math.max(0, j.buffer - dt);
    if (dir) j.mira = dir;
    // en el piso frena más de lo que acelera: se para en seco, como en el género
    const acel = j.suelo ? (dir ? (j.vx * dir < 0 ? F.frenoSuelo : F.acelSuelo) : F.frenoSuelo) : (dir ? F.acelAire : F.frenoAire);
    const obj = dir * F.vmax;
    j.vx = j.vx < obj ? Math.min(obj, j.vx + acel * dt) : Math.max(obj, j.vx - acel * dt);
    if (j.buffer > 0 && j.coyote > 0) {
      j.vy = -F.salto; j.buffer = 0; j.coyote = 0; j.saltando = true; j.suelo = false; j.sobre = null;
      this.saltoEste = true;
      this.evento('salto', { x: j.x, y: j.y });
    }
    // salto variable: soltar el botón subiendo corta el salto
    if (j.saltando && !salto && j.vy < 0) { j.vy *= F.corte; j.saltando = false; }
    if (j.vy >= 0) j.saltando = false;
    j.vy = Math.min(F.caidaMax, j.vy + (j.vy > 0 ? F.gCaida : F.g) * dt);
    const enSuelo = j.suelo, vy = j.vy;
    this.moverX(j.vx * dt);
    this.moverY(j.vy * dt);
    if (j.suelo && !enSuelo) this.evento('aterriza', { x: j.x, y: j.y, v: vy });
  }

  // cada rectángulo sólido que toca la caja: fn(x0, y0, x1, y1, tipo, grupo)
  // (tipo: bloque, tabla, resorte o golpe = el bloque escondido que se
  // descubre de un cabezazo)
  choques(x0, y0, x1, y1, fn, excepto = null) {
    const m = this.m;
    const c0 = Math.max(0, Math.floor(x0)), c1 = Math.min(COLS - 1, Math.floor(x1 - 1e-9));
    const f0 = Math.max(0, Math.floor(y0)), f1 = Math.min(FILAS - 1, Math.floor(y1 - 1e-9));
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) {
      const v = m.fijo[f * COLS + c];
      if (v === 1) fn(c, f, c + 1, f + 1, 'bloque', null);
      else if (v === 2 && y0 < f + 0.24) fn(c, f, c + 1, f + 0.24, 'tabla', null);
    }
    for (const r of m.resortes) {
      rectDe('resorte', null, r.c, r.f, R);
      if (R[2] > x0 && R[0] < x1 && R[3] > y0 && R[1] < y1) fn(R[0], R[1], R[2], R[3], 'resorte', null);
    }
    for (const g of this.grupos) {
      if (g === excepto) continue;
      const tipo = g.visible ? (g.falso || g.tipo === 'pinches' ? null : g.tipo) : g.golpe ? 'golpe' : null;
      if (!tipo) continue;
      if (x1 <= g.c0 + g.ox || x0 >= g.c1 + g.ox || y1 <= g.f0 + g.oy || y0 >= g.f1 + g.oy) continue;
      for (const [c, f] of g.celdas) {
        rectDe(g.tipo, g.dir, c + g.ox, f + g.oy, R);
        if (R[2] > x0 && R[0] < x1 && R[3] > y0 && R[1] < y1) fn(R[0], R[1], R[2], R[3], tipo, g);
      }
    }
  }

  moverX(dx) {
    const j = this.j, med = ANCHO / 2, x0j = j.x;
    if (dx === 0) return;
    j.x += dx;
    if (j.x - med < 0) { j.x = med; j.vx = 0; } else if (j.x + med > COLS) { j.x = COLS - med; j.vx = 0; }
    let tope = null;
    this.choques(j.x - med, j.y - ALTO + EPS, j.x + med, j.y - EPS, (x0, y0, x1, y1, tipo) => {
      if (tipo === 'tabla' || tipo === 'golpe') return;
      // cuenta solo lo que tenía adelante: si ya estaba encimado (lo empujó
      // algo), no lo tira del otro lado del bloque
      if (dx > 0 ? x0 < x0j + med - 1e-6 : x1 > x0j - med + 1e-6) return;
      const t = dx > 0 ? x0 - med : x1 + med;
      if (tope === null || (dx > 0 ? t < tope : t > tope)) tope = t;
    });
    if (tope !== null) { j.x = tope; j.vx = 0; }
  }

  moverY(dy) {
    const j = this.j, med = ANCHO / 2, pie0 = j.y;
    j.suelo = false; j.sobre = null;
    if (dy === 0) return;
    j.y += dy;
    if (j.y - ALTO < 0) { j.y = ALTO; if (j.vy < 0) j.vy = 0; }
    let piso = null, techo = null;
    this.choques(j.x - med + EPS, j.y - ALTO, j.x + med - EPS, j.y, (x0, y0, x1, y1, tipo, g) => {
      if (dy > 0) {
        // se apoya solo en lo que estaba debajo de los pies (si no, un bloque
        // encimado de costado lo subiría de un tirón)
        if (tipo === 'golpe' || pie0 > y0 + 1e-6) return;
        if (!piso || y0 < piso.y) piso = { y: y0, tipo, g };
      } else if (tipo !== 'tabla' && pie0 - ALTO >= y1 - 1e-6) {
        if (!techo || y1 > techo.y) techo = { y: y1, tipo, g };
      }
    });
    if (piso) {
      j.y = piso.y;
      if (piso.tipo === 'resorte') {
        j.vy = -FIS.resorte; j.saltando = false; j.coyote = 0;
        this.evento('resorte', { x: j.x, y: j.y, g: piso.g ? piso.g.id : null });
      } else { j.vy = 0; j.suelo = true; j.sobre = piso.g ? piso.g.id : 'fijo'; }
    }
    if (techo) {
      j.y = techo.y + ALTO; if (j.vy < 0) j.vy = 0; j.saltando = false;
      this.evento('cabeza', { x: j.x, y: j.y - ALTO });
      if (techo.tipo === 'golpe') { techo.g.visible = true; techo.g.k = 1; this.evento('aparece', { g: techo.g.id, golpe: true }); }
    }
  }

  // correr a Grumo porque algo lo empuja (o lo lleva): devuelve false si no
  // entra (queda aplastado)
  empujarY(d, excepto) {
    const j = this.j, med = ANCHO / 2, pie0 = j.y;
    j.y += d;
    let lim = null;
    this.choques(j.x - med + EPS, j.y - ALTO, j.x + med - EPS, j.y, (x0, y0, x1, y1, tipo) => {
      if (tipo === 'golpe') return;
      if (d > 0) { if (pie0 <= y0 + 1e-6 && (lim === null || y0 < lim)) lim = y0; }
      else if (tipo !== 'tabla' && pie0 - ALTO >= y1 - 1e-6 && (lim === null || y1 + ALTO > lim)) lim = y1 + ALTO;
    }, excepto);
    if (j.y - ALTO < 0 && (lim === null || ALTO > lim)) lim = ALTO;
    if (lim === null) return true;
    const falta = Math.abs(j.y - lim);
    j.y = lim;
    return falta <= TOL;
  }
  empujarX(d, excepto, aplasta) {
    const j = this.j, med = ANCHO / 2, x0j = j.x;
    j.x += d;
    let lim = null;
    if (j.x - med < 0) lim = med; else if (j.x + med > COLS) lim = COLS - med;
    this.choques(j.x - med, j.y - ALTO + EPS, j.x + med, j.y - EPS, (x0, y0, x1, y1, tipo) => {
      if (tipo === 'tabla' || tipo === 'golpe') return;
      if (d > 0 ? x0 < x0j + med - 1e-6 : x1 > x0j - med + 1e-6) return;
      const t = d > 0 ? x0 - med : x1 + med;
      if (lim === null || (d > 0 ? t < lim : t > lim)) lim = t;
    }, excepto);
    if (lim === null) return true;
    const falta = Math.abs(j.x - lim);
    j.x = lim;
    return !aplasta || falta <= TOL;
  }

  // un grupo se corre (dx, dy) en un cuadro del mundo: lleva a Grumo si está
  // parado encima y lo empuja si se le viene encima
  moverGrupo(g, dx, dy) {
    if (dx === 0 && dy === 0) return;
    const j = this.j, vivo = this.estado === 'juego' && !j.agarrado;
    const encima = vivo && j.suelo && j.sobre === g.id;
    g.ox += dx; g.oy += dy;
    if (!vivo || !g.visible || g.falso || g.tipo === 'pinches') return;
    const med = ANCHO / 2;
    if (encima) {
      if (dy !== 0 && !this.empujarY(dy, g)) return this.morir('aplastado');
      if (dx !== 0) this.empujarX(dx, g, false);
      if (dy > 0 || this.sobreGrupo(g)) { j.suelo = true; j.sobre = g.id; }
      return;
    }
    let px = 0, py = 0;
    for (const [c, f] of g.celdas) {
      rectDe(g.tipo, g.dir, c + g.ox, f + g.oy, R);
      if (!(R[2] > j.x - med && R[0] < j.x + med && R[3] > j.y - ALTO && R[1] < j.y)) continue;
      if (g.tipo === 'tabla') {
        // la tabla que sube le pasa por los pies: si ya los tenía arriba, lo levanta
        if (dy < 0 && j.y <= R[1] - dy + 1e-6 && j.vy >= 0) py = Math.min(py, R[1] - j.y);
        continue;
      }
      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dy > 0) py = Math.max(py, R[3] - (j.y - ALTO)); else py = Math.min(py, R[1] - j.y);
      } else if (dx > 0) px = Math.max(px, R[2] - (j.x - med));
      else px = Math.min(px, R[0] - (j.x + med));
    }
    if (py !== 0 && !this.empujarY(py, g)) return this.morir('aplastado');
    if (px !== 0 && !this.empujarX(px, g, true)) return this.morir('aplastado');
    if (py < 0) { j.suelo = true; j.sobre = g.id; if (j.vy > 0) j.vy = 0; }
  }
  sobreGrupo(g) {
    const j = this.j, med = ANCHO / 2;
    for (const [c, f] of g.celdas) {
      rectDe(g.tipo, g.dir, c + g.ox, f + g.oy, R);
      if (R[2] > j.x - med && R[0] < j.x + med && Math.abs(R[1] - j.y) < 1e-4) return true;
    }
    return false;
  }

  // ── las trampas ──────────────────────────────────────────────────────────
  cumple(si) {
    const j = this.j, cx = j.x, cy = j.y - ALTO / 2;
    if (si.zona) { const [x0, y0, x1, y1] = si.zona; if (!(cx >= x0 && cx < x1 && cy >= y0 && cy < y1)) return false; }
    if (si.salta && !this.saltoEste) return false;
    if (si.suelo !== undefined && j.suelo !== si.suelo) return false;
    if (si.pisa && !(j.suelo && j.sobre === si.pisa)) return false;
    if (si.tiempo !== undefined && this.t < si.tiempo) return false;
    if (si.tras !== undefined) { const o = this.trampas.find((t) => t.id === si.tras); if (!o || !o.hecha || this.t - o.t < (si.espera || 0)) return false; }
    if (si.cerca) { const [x, y] = this.centroDe(si.cerca); if (Math.hypot(x - cx, y - cy) >= (si.r ?? 1.5)) return false; }
    if (si.toma !== undefined && this.toma < si.toma) return false;
    if (si.mira !== undefined && j.mira !== si.mira) return false;
    return true;
  }
  revisarTrampas() {
    for (const tr of this.trampas) {
      if (tr.hecha && tr.una) continue;
      const si = this.cumple(tr.si);
      // la que se repite salta cuando se entra, no mientras se está adentro
      if (!tr.una) { const antes = tr.dentro; tr.dentro = si; if (!si || antes) continue; }
      else if (!si) continue;
      tr.hecha = true; tr.t = this.t;
      for (const a of tr.hace) {
        this.agenda.push({ t: this.t + (a.en || 0), a });
        // si algo se va a llevar la puerta, desde ya no se puede entrar
        if (a.que === 'puerta' || (a.que === 'mano' && a.agarra === 'puerta')) this.puerta.ocupada++;
      }
      this.evento('trampa', { i: tr.i });
    }
  }
  centroDe(que) {
    if (que === 'puerta') return [this.puerta.x, this.puerta.y - 0.7];
    if (que === 'grumo') return [this.j.x, this.j.y - ALTO / 2];
    if (Array.isArray(que)) return que;
    const g = this.g[que];
    return [(g.c0 + g.c1) / 2 + g.ox, (g.f0 + g.f1) / 2 + g.oy];
  }

  ejecutar(a, T) {
    const g = a.g ? this.g[a.g] : null;
    if (a.g && !g) throw new Error(`${this.def.id}: no hay grupo ${a.g}`);
    // con aviso, primero tiembla y la acción va después
    if (a.aviso && g && !a._avisado) {
      g.tiembla = T + a.aviso;
      this.agenda.push({ t: T + a.aviso, a: { ...a, _avisado: true } });
      this.evento('tiembla', { g: g.id });
      return;
    }
    switch (a.que) {
      case 'mover': {
        const hasta = a.hasta ? [...a.hasta] : [g.ox + (a.a?.[0] || 0), g.oy + (a.a?.[1] || 0)];
        g.mov = { desde: [g.ox, g.oy], hasta, t0: T, dur: a.t ?? 0.3, curva: a.curva || 'suave' };
        g.cae = null;
        this.evento('mueve', { g: g.id, rapido: (a.t ?? 0.3) < 0.2 });
        break;
      }
      case 'caer': g.cae = { v: a.v || 0 }; g.mov = null; this.evento('cae', { g: g.id }); break;
      case 'mostrar':
        if (g.visible) break;
        g.visible = true; g.k = g.tipo === 'pinches' ? 0.34 : 1; g.muestra = T;
        this.evento('aparece', { g: g.id });
        if (g.tipo !== 'pinches' && !g.falso) this.aparecerSobre(g);
        break;
      case 'ocultar': if (g.visible) { g.visible = false; g.k = 0; this.evento('desaparece', { g: g.id }); } break;
      case 'puerta': {
        const p = this.puerta;
        if (a.mostrar) { p.oculta = false; this.evento('puerta', { aparece: true }); }
        if (a.celda) {
          const hasta = [a.celda[0] + 0.5, a.celda[1] + 1];
          if (a.salta) { p.x = hasta[0]; p.y = hasta[1]; p.salto = T; this.evento('puerta', { salta: true }); }
          else { p.mov = { desde: [p.x, p.y], hasta, t0: T, dur: a.t ?? 0.4, patas: !!a.patas }; p.patas = !!a.patas; this.evento('puerta', { patas: !!a.patas }); return; }
        }
        p.ocupada = Math.max(0, p.ocupada - 1);
        break;
      }
      case 'mano': this.manos.push(this.nuevaMano(a, T)); break;
      case 'bola': this.bolas.push({ x: a.en[0], y: a.en[1], vx: a.vx ?? 3, vy: 0, r: 0.38, giro: 0, nace: T }); this.evento('bola'); break;
      case 'luz': this.oscuro = T + (a.t ?? 2); this.evento('luz'); break;
      case 'nota': this.notas.push({ texto: a.texto, desde: T, hasta: T + (a.t ?? 2.5), en: a.en || null }); this.evento('nota'); break;
      case 'corte': this.corte = this.tick; this.evento('corte'); break;
      case 'temblor': this.temblor = T + (a.t ?? 0.4); this.evento('temblor'); break;
      default: throw new Error(`${this.def.id}: no sé hacer '${a.que}'`);
    }
  }
  // un bloque que aparece donde está Grumo lo sube (o lo aplasta si no entra)
  aparecerSobre(g) {
    const j = this.j, med = ANCHO / 2;
    if (this.estado !== 'juego') return;
    let arriba = null;
    for (const [c, f] of g.celdas) {
      rectDe(g.tipo, g.dir, c + g.ox, f + g.oy, R);
      if (R[2] > j.x - med && R[0] < j.x + med && R[3] > j.y - ALTO && R[1] < j.y) arriba = arriba === null ? R[1] : Math.min(arriba, R[1]);
    }
    if (arriba === null) return;
    if (!this.empujarY(arriba - j.y, g)) this.morir('aplastado');
    else { j.suelo = true; j.sobre = g.id; j.vy = 0; }
  }

  // ── la mano del animador ─────────────────────────────────────────────────
  nuevaMano(a, T) {
    const [x, y] = this.centroDe(a.agarra || a.hacia || 'grumo');
    return { a, fase: 'aviso', t0: T, punto: [x, y], x, y, lado: a.lado || 'arriba', llevado: 0, dx: 0, dy: 0, pose: 'abierta' };
  }
  afuera(m) {
    const [x, y] = m.punto;
    if (m.lado === 'izq') return [-3.5, y - 0.6];
    if (m.lado === 'der') return [COLS + 3.5, y - 0.6];
    return [x + 1.2, -4];
  }
  cuadroMano(m, T) {
    const a = m.a, j = this.j, dur = { ...MANO, aviso: a.aviso ?? MANO.aviso, lleva: a.t ?? MANO.lleva };
    const orden = ['aviso', 'entra', 'agarra', 'lleva', 'suelta', 'sale'];
    let k = T - m.t0;
    // la fase que toca ahora (sin empujón, la mano no "agarra": entra, toca y se va)
    while (k >= dur[m.fase]) {
      // lo que lleva termina de llegar justo adonde tenía que ir
      if (m.fase === 'lleva') this.llevar(m, 1);
      k -= dur[m.fase]; m.t0 += dur[m.fase];
      const antes = m.fase;
      m.fase = orden[orden.indexOf(m.fase) + 1];
      if (!a.agarra && m.fase === 'agarra') m.fase = 'sale';
      this.cambioMano(m, antes);
      if (!m.fase) return false;
    }
    const u = clamp(k / dur[m.fase], 0, 1), [ax, ay] = this.afuera(m);
    if (m.fase === 'aviso') { m.x = ax; m.y = ay; }
    else if (m.fase === 'entra') {
      // va a buscar a Grumo adonde esté
      if (a.agarra === 'grumo' || (!a.agarra && a.empuja)) m.punto = this.centroDe('grumo');
      const e = salida(u); m.x = lerp(ax, m.punto[0], e); m.y = lerp(ay, m.punto[1], e);
    } else if (m.fase === 'lleva') this.llevar(m, u);
    else if (m.fase === 'sale') {
      const e = entrada(u), px = m.punto[0] + m.dx, py = m.punto[1] + m.dy;
      m.x = lerp(px, ax + m.dx, e); m.y = lerp(py, ay + m.dy, e);
    }
    return true;
  }
  // la mano lleva lo que agarró hasta `u` (0 a 1) del camino
  llevar(m, u) {
    const a = m.a, j = this.j;
    const hasta = a.hasta ? [a.hasta[0] - m.punto[0], a.hasta[1] - m.punto[1]] : a.a || [0, 0];
    const e = suave(u), nx = hasta[0] * e, ny = hasta[1] * e, ddx = nx - m.dx, ddy = ny - m.dy;
    m.dx = nx; m.dy = ny; m.x = m.punto[0] + nx; m.y = m.punto[1] + ny;
    if (a.agarra === 'grumo') { if (j.agarrado) { j.x += ddx; j.y += ddy; j.px = j.x; j.py = j.y; } }
    else if (a.agarra === 'puerta') { this.puerta.x += ddx; this.puerta.y += ddy; }
    else if (a.agarra) this.moverGrupo(this.g[a.agarra], ddx, ddy);
  }
  cambioMano(m, antes) {
    const a = m.a, j = this.j;
    if (m.fase === 'entra') this.evento('mano', { fase: 'entra' });
    if (antes === 'entra' && a.empuja && !a.agarra) {
      const [cx, cy] = this.centroDe('grumo');
      if (this.estado === 'juego' && Math.hypot(cx - m.punto[0], cy - m.punto[1]) < 1.2) {
        j.vx = a.empuja[0]; j.vy = a.empuja[1]; j.suelo = false; j.sobre = null; j.saltando = false;
        this.evento('empujon', { x: cx, y: cy });
      }
    }
    if (m.fase === 'agarra') {
      m.pose = 'pinza';
      if (a.agarra === 'grumo' && this.estado === 'juego') { j.agarrado = true; j.vx = 0; j.vy = 0; j.suelo = false; j.sobre = null; }
      this.evento('mano', { fase: 'agarra', que: a.agarra });
    }
    if (m.fase === 'suelta') {
      m.pose = 'abierta';
      if (a.agarra === 'grumo' && j.agarrado) { j.agarrado = false; j.vx = 0; j.vy = 0; }
      if (a.agarra === 'puerta') this.puerta.ocupada = Math.max(0, this.puerta.ocupada - 1);
      this.evento('mano', { fase: 'suelta' });
    }
  }

  // ── el cuadro del mundo (12 por segundo) ─────────────────────────────────
  cuadroMundo() {
    const T = this.T;
    this.tick++;
    if (this.agenda.length) {
      const ya = this.agenda.filter((x) => x.t <= T + 1e-9);
      if (ya.length) {
        this.agenda = this.agenda.filter((x) => x.t > T + 1e-9);
        for (const x of ya) this.ejecutar(x.a, T);
      }
    }
    const j = this.j;
    for (const g of this.grupos) {
      if (g.tipo === 'pinches' && g.visible && g.k < 1) g.k = Math.min(1, g.k + 0.33);
      if (g.vaiven) {
        const v = g.vaiven, k = (1 - Math.cos(2 * Math.PI * (T / v.t + (v.fase || 0)))) / 2;
        this.moverGrupo(g, v.a[0] * k - g.ox, v.a[1] * k - g.oy);
      }
      if (g.mov) {
        const u = clamp((T - g.mov.t0) / g.mov.dur, 0, 1), e = CURVAS[g.mov.curva](u);
        const nx = lerp(g.mov.desde[0], g.mov.hasta[0], e), ny = lerp(g.mov.desde[1], g.mov.hasta[1], e);
        if (u >= 1) g.mov = null;
        this.moverGrupo(g, nx - g.ox, ny - g.oy);
      }
      if (g.cae) {
        g.cae.v = Math.min(CAIDA_BLOQUE_MAX, g.cae.v + CAIDA_BLOQUE / 12);
        this.moverGrupo(g, 0, g.cae.v / 12);
        if (g.f0 + g.oy > FILAS + 1) { g.cae = null; g.visible = false; }
      }
      const pisa = this.estado === 'juego' && j.suelo && j.sobre === g.id;
      if (g.fragil && g.visible) {
        if (pisa && g.pisado < 0) { g.pisado = T; this.evento('cruje', { g: g.id }); }
        if (g.pisado >= 0 && T - g.pisado >= g.fragil) { g.visible = false; this.evento('desarma', { g: g.id }); }
      }
      if (g.blanda && g.visible) {
        // la plastilina blanda se hunde mientras la pisan y vuelve despacio
        if (pisa && g.hundido < g.blanda) { const d = Math.min(0.07, g.blanda - g.hundido); g.hundido += d; this.moverGrupo(g, 0, d); }
        else if (!pisa && g.hundido > 0) { const d = Math.min(0.035, g.hundido); g.hundido -= d; this.moverGrupo(g, 0, -d); }
      }
    }
    const p = this.puerta;
    if (p.mov) {
      const u = clamp((T - p.mov.t0) / p.mov.dur, 0, 1), e = p.mov.patas ? u : suave(u);
      p.x = lerp(p.mov.desde[0], p.mov.hasta[0], e); p.y = lerp(p.mov.desde[1], p.mov.hasta[1], e);
      if (u >= 1) { p.mov = null; p.patas = false; p.ocupada = Math.max(0, p.ocupada - 1); }
    }
    this.manos = this.manos.filter((m) => this.cuadroMano(m, T));
    if (this.bolas.length) this.cuadroBolas();
    if (this.notas.length) this.notas = this.notas.filter((n) => n.hasta > T);
  }

  cuadroBolas() {
    const n = 6, dt = 1 / 12 / n;
    for (const b of this.bolas) {
      for (let k = 0; k < n; k++) {
        b.vy = Math.min(12, b.vy + 30 * dt);
        b.x += b.vx * dt;
        if (b.x - b.r < 0 || b.x + b.r > COLS || this.bolaChoca(b, false) !== null) { b.x -= b.vx * dt; b.vx = -b.vx; }
        const y0 = b.y;
        b.y += b.vy * dt;
        const piso = this.bolaChoca(b, b.vy > 0, y0);
        if (piso !== null) { if (b.vy > 0) b.y = piso - b.r; else b.y = y0; b.vy = 0; }
        b.giro += (b.vx * dt) / b.r;
      }
    }
    this.bolas = this.bolas.filter((b) => b.y - b.r < FILAS + 1);
  }
  // null si no choca; si cae, la altura del piso donde se apoya
  bolaChoca(b, cayendo, y0 = b.y) {
    let piso = null, choca = false;
    this.choques(b.x - b.r * 0.9, b.y - b.r * 0.9, b.x + b.r * 0.9, b.y + b.r, (x0, yy0, x1, yy1, tipo) => {
      if (tipo === 'golpe') return;
      if (tipo === 'tabla' && !(cayendo && y0 + b.r <= yy0 + 1e-6)) return;
      choca = true;
      if (cayendo && (piso === null || yy0 < piso)) piso = yy0;
    });
    return choca ? (piso ?? b.y + b.r) : null;
  }

  // ── morir y llegar ───────────────────────────────────────────────────────
  peligros() {
    const j = this.j, med = ANCHO / 2, x0 = j.x - med, x1 = j.x + med, y0 = j.y - ALTO, y1 = j.y;
    const toca = () => R[2] > x0 && R[0] < x1 && R[3] > y0 && R[1] < y1;
    for (const p of this.m.pinches) { rectDe('pinches', p.dir, p.c, p.f, R); if (toca()) return this.morir('pinches'); }
    for (const g of this.grupos) {
      if (g.tipo !== 'pinches' || !g.visible || g.falso || g.k < 0.6) continue;
      if (x1 <= g.c0 + g.ox || x0 >= g.c1 + g.ox || y1 <= g.f0 + g.oy || y0 >= g.f1 + g.oy) continue;
      for (const [c, f] of g.celdas) { rectDe('pinches', g.dir, c + g.ox, f + g.oy, R); if (toca()) return this.morir('pinches'); }
    }
    for (const b of this.bolas) {
      const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1);
      if (Math.hypot(b.x - cx, b.y - cy) < b.r * 0.85) return this.morir('bola');
    }
    if (y0 > FILAS + 0.2) return this.morir('caida');
  }
  llegar() {
    const j = this.j, p = this.puerta;
    for (const f of this.falsas) {
      // la puerta pintada en el fondo: se la lleva por delante y rebota
      if (Math.abs(j.x - f.x) < 0.45 && j.y > f.y - 1.3 && j.y - ALTO < f.y && this.t - f.golpe > 0.6) {
        f.golpe = this.t; j.vx = -j.mira * 4.5; j.vy = -5; j.suelo = false; j.sobre = null; j.saltando = false;
        this.evento('bonk', { x: f.x, y: f.y });
      }
    }
    if (p.oculta || p.ocupada > 0 || p.mov) return;
    if (Math.abs(j.x - p.x) < 0.28 + ANCHO / 2 && j.y > p.y - 1.1 && j.y - ALTO < p.y) {
      this.estado = 'gano'; this.tFin = 0;
      this.evento('gana', { x: p.x, y: p.y });
    }
  }
  morir(causa) {
    if (this.estado !== 'juego') return;
    const j = this.j;
    this.estado = 'muerto'; this.causa = causa; this.tFin = 0;
    j.agarrado = false;
    this.evento('muere', { causa, x: j.x, y: j.y });
  }

  // ── para el resolvedor ───────────────────────────────────────────────────
  // una copia que avanza sola (lo que no cambia se comparte)
  clonar() {
    const c = Object.create(Partida.prototype);
    Object.assign(c, this);
    c.j = { ...this.j };
    c.control = { ...this.control };
    c.grupos = this.grupos.map((g) => ({ ...g, mov: g.mov && { ...g.mov, desde: [...g.mov.desde], hasta: [...g.mov.hasta] }, cae: g.cae && { ...g.cae } }));
    c.g = Object.fromEntries(c.grupos.map((g) => [g.id, g]));
    c.trampas = this.trampas.map((t) => ({ ...t }));
    c.agenda = this.agenda.map((x) => ({ ...x }));
    c.puerta = { ...this.puerta, mov: this.puerta.mov && { ...this.puerta.mov } };
    c.falsas = this.falsas.map((f) => ({ ...f }));
    c.manos = this.manos.map((m) => ({ ...m, punto: [...m.punto] }));
    c.bolas = this.bolas.map((b) => ({ ...b }));
    c.notas = [];
    c.eventos = [];
    return c;
  }
  // lo que distingue un momento del mundo de otro (sin Grumo): lo que ya
  // saltó, lo que está en movimiento y dónde, y la hora si el mundo depende de ella
  firma() {
    let s = '';
    for (const tr of this.trampas) s += tr.hecha ? (tr.dentro ? '2' : '1') : '0';
    const q = (v) => Math.round(v * 12), T = this.T;
    for (const g of this.grupos) {
      s += `|${q(g.ox)},${q(g.oy)}${g.visible ? '' : 'x'}${g.k < 1 ? 'k' + q(g.k) : ''}`;
      if (g.mov) s += 'm' + q(T - g.mov.t0);
      if (g.cae) s += 'c' + q(g.cae.v);
      if (g.pisado >= 0 && g.visible) s += 'p' + q(T - g.pisado);
      if (g.tiembla > T) s += 't' + q(g.tiembla - T);
      if (g.vaiven) s += 'v' + Math.floor((((T / g.vaiven.t + (g.vaiven.fase || 0)) % 1) + 1) % 1 * 24);
    }
    const p = this.puerta;
    if (p.mov || p.ocupada || p.oculta) s += `|p${q(p.x)},${q(p.y)},${p.ocupada}${p.oculta ? 'o' : ''}`;
    for (const m of this.manos) s += `|m${m.fase}${q(T - m.t0)}`;
    for (const b of this.bolas) s += `|b${Math.round(b.x * 4)},${Math.round(b.y * 4)},${Math.sign(b.vx)}`;
    if (this.agenda.length) s += '|a' + this.agenda.map((x) => q(x.t - T)).join(',');
    // una trampa por reloj que todavía no saltó: la hora importa
    if (this.trampas.some((t) => !t.hecha && t.si.tiempo !== undefined)) s += '|t' + Math.floor(T * 12);
    return s;
  }
}

// Jugar un plan sin dibujar: [[segundos, dir, salto], ...] (cada cambio del
// control). Devuelve la partida terminada (o cortada en `tope` segundos).
export function jugarPlan(def, plan, { tope = 30, toma = 1, alPaso = null } = {}) {
  const p = new Partida(def, { toma });
  // por número de paso y no por segundos: sumar 1/120 muchas veces se corre
  const pasoDe = plan.map((c) => Math.round(c[0] / PASO));
  let k = 0;
  while (p.estado === 'juego' && p.pasos * PASO < tope) {
    while (k < plan.length && pasoDe[k] <= p.pasos) { p.control.dir = plan[k][1]; p.control.salto = !!plan[k][2]; k++; }
    p.paso();
    alPaso?.(p);
  }
  return p;
}
