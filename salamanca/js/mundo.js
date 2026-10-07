/* ============================================================================
   La partida: la chica del farol, los bichos, los jefes, las balas, lo que se
   junta y las partículas. Todo en coordenadas de la sala (180 × 276); el
   dibujo le suma SY. Corre a 60 pasos fijos por segundo.
   ========================================================================== */

let J = null;

/* costo = cuánto "pesa" en el presupuesto de la sala */
const TIPOS = {
  murcielago: { vida: 16, r: 4, vel: 44, vuela: true, contacto: 10, costo: 1, pie: 5, col: ['#9a6cc8', '#3a2450'] },
  sapo: { vida: 28, r: 5, vel: 0, contacto: 8, costo: 2, pie: 6, col: ['#86c25a', '#2e5a2a'] },
  anima: { vida: 26, r: 5, vel: 16, vuela: true, contacto: 8, costo: 2, pie: 8, col: ['#ece4d0', '#5aa0c8'] },
  hongo: { vida: 42, r: 5, vel: 0, fijo: true, contacto: 6, costo: 3, pie: 6, col: ['#d8403a', '#f4ecd8'] },
  vibora: { vida: 24, r: 4, vel: 28, contacto: 12, costo: 2, pie: 6, col: ['#9ad060', '#5aa040'] },
  lobito: { vida: 44, r: 5, vel: 36, contacto: 12, costo: 3, pie: 5, col: ['#4a3c5a', '#ff3040'] },
  kakuy: { vida: 32, r: 5, vel: 26, vuela: true, contacto: 8, costo: 3, pie: 6, col: ['#a07a50', '#f4d040'] },
  diablillo: { vida: 38, r: 5, vel: 0, contacto: 10, costo: 4, pie: 6, col: ['#d03a3a', '#ffe040'] },
  brasa: { vida: 30, r: 5, vel: 26, contacto: 10, costo: 2, pie: 5, col: ['#ffb040', '#f05a28'] },
  brasita: { vida: 9, r: 3, vel: 46, contacto: 6, costo: 1, pie: 3, col: ['#ffb040', '#f05a28'] },
  sapoRey: { vida: 640, r: 11, vel: 0, jefe: true, contacto: 18, costo: 0, pie: 9, col: ['#86c25a', '#ffcf4a'] },
  viuda: { vida: 900, r: 9, vel: 0, jefe: true, vuela: true, contacto: 16, costo: 0, pie: 13, col: ['#e8eef4', '#80f0ff'] },
  lobizon: { vida: 1150, r: 11, vel: 0, jefe: true, contacto: 20, costo: 0, pie: 11, col: ['#8a7a8a', '#ffd030'] },
  mandinga: { vida: 2100, r: 12, vel: 0, jefe: true, vuela: true, contacto: 22, costo: 0, pie: 14, col: ['#c0303a', '#ffcf4a'] },
};
const POOLS = [
  ['murcielago', 'murcielago', 'sapo', 'vibora', 'hongo'],
  ['murcielago', 'sapo', 'anima', 'anima', 'hongo', 'kakuy'],
  ['brasa', 'brasa', 'vibora', 'lobito', 'diablillo', 'anima'],
  ['diablillo', 'lobito', 'kakuy', 'anima', 'brasa', 'hongo'],
];
const JEFES = ['sapoRey', 'viuda', 'lobizon', 'mandinga'];
const xpSig = (n) => 14 + n * 10;
const bioma = () => (J.piso - 1) % 4;
const ciclo = () => Math.floor((J.piso - 1) / 4);
const nivelPiso = () => bioma() + 1;
const danioE = () => 12 * (1 + 0.22 * (nivelPiso() - 1)) * Math.pow(1.3, ciclo());

/* ------------------------------------------------------------- la partida */
function nuevaPartida(diaria) {
  const semilla = diaria ? hoy() : (Math.random() * 1e9) | 0;
  J = {
    diaria, semilla, rnd: rngSemilla(semilla), piso: 1, sala: 0,
    jug: { x: 90, y: 246, r: 4, vida: 1, vidaMax: 1, factorVida: 1, nivel: 1, xp: 0, cartas: {}, tiroT: 0, invul: 0, cara: 1, anim: 0, mov: false, copla: 0, flash: 0, apunta: -Math.PI / 2, rafagas: [], compas: [], tiroAnim: 0 },
    enem: [], balas: [], balasE: [], items: [], part: [], numeros: [], rayos: [], zonas: [], ondas: [],
    mapa: null, fondo: null, dist: null, distCelda: -1, limpia: false, tSala: 0, t: 0,
    sacudir: 0, lenta: 0, destello: 0, pendientes: 0, kills: 0, almas: 0, jefe: null, cartel: null, cartelChico: null,
    revivir: DATOS.meta.revivir ? 1 : 0, salir: false, comboAlma: 0, comboT: 0, sfxT: 0, tipo: 'normal', muerto: false, fogonListo: false,
  };
  recalcular();
  J.jug.vida = J.jug.vidaMax;
  siguienteSala();
}

function recalcular() {
  const j = J.jug, c = j.cartas, m = DATOS.meta, antes = j.vidaMax;
  j.vidaMax = Math.round(120 * (1 + 0.1 * m.vida) * (1 + 0.25 * (c.vida || 0)) * j.factorVida);
  j.danio = 12 * (1 + 0.25 * (c.danio || 0)) * (1 + 0.08 * m.danio);
  j.retardo = 0.6 / ((1 + 0.18 * (c.cadencia || 0)) * (1 + 0.06 * m.cadencia));
  j.critP = 0.05 + 0.12 * (c.critico || 0); j.critM = 2 + 0.4 * (c.critico || 0);
  j.vel = 64 * (1 + 0.12 * (c.velocidad || 0));
  j.iman = c.iman ? 80 : 22;
  j.esquive = 0.1 * (c.esquive || 0);
  while (j.compas.length < (c.compa || 0)) j.compas.push({ x: j.x, y: j.y, t: 0.5 });
  return j.vidaMax - antes;
}
function tomarCarta(id) {
  const j = J.jug;
  j.cartas[id] = (j.cartas[id] || 0) + 1;
  const dif = recalcular();
  if (dif > 0) j.vida += dif;
  if (id === 'curar') curar(j.vidaMax * 0.5);
  j.vida = Math.min(j.vida, j.vidaMax);
}
function curar(n) {
  const j = J.jug, antes = j.vida;
  j.vida = Math.min(j.vidaMax, j.vida + n);
  const d = Math.round(j.vida - antes);
  if (d > 0) J.numeros.push({ x: j.x, y: j.y - 12, txt: '+' + d, col: '#7ef09a', t: 0.9 });
  for (let i = 0; i < 8; i++) chispa(j.x + azar(-6, 6), j.y + azar(-4, 6), 0, -azar(10, 30), '#7ef09a', 0.6);
}

/* sala que sigue: 1-3 y 5-7 normales, 4 el fogón, 8 el jefe */
function siguienteSala() {
  J.sala++;
  if (J.sala > 8) { J.sala = 1; J.piso++; }
  J.tipo = J.sala === 8 ? 'jefe' : J.sala === 4 ? 'fogon' : 'normal';
  const b = bioma();
  J.mapa = generarSala(J.rnd, J.tipo, b);
  J.fondo = pintarSala(J.mapa, b, rngSemilla(J.semilla + J.piso * 100 + J.sala));
  J.enem = []; J.balas = []; J.balasE = []; J.items = []; J.zonas = []; J.rayos = []; J.ondas = [];
  J.limpia = false; J.tSala = 0; J.salir = false; J.jefe = null; J.fogonListo = false;
  const j = J.jug;
  j.x = 90; j.y = 246; j.invul = 0.8; j.rafagas = [];
  for (const c of j.compas) { c.x = j.x; c.y = j.y; }
  J.distCelda = -1;
  if (J.sala === 1) J.cartel = { txt: tr('piso', J.piso), sub: tr('pisos')[b], t: 2.6 };
  if (J.tipo === 'normal') poblarSala();
  else if (J.tipo === 'jefe') {
    const e = crearEnemigo(JEFES[b], 90, 70);
    e.aparece = 1.4; J.jefe = e;
    J.cartel = { txt: tr('jefes')[b], sub: tr('piso', J.piso), t: 2.4, jefe: true };
    Sonido.sfx('rugido');
  } else {
    J.fogon = { x: 90, y: 130 };
  }
  Sonido.musica(J.tipo === 'jefe' ? TEMAS.jefe : J.tipo === 'fogon' ? TEMAS.fogon : TEMAS['p' + b]);
}
function poblarSala() {
  const b = bioma(), pool = POOLS[b];
  const k = J.sala > 4 ? J.sala - 1 : J.sala;            // 1..6 entre las normales
  let presupuesto = 5 + k * 1.7 + (J.piso - 1) * 2.4;
  const libres = [];
  for (let f = 3; f <= 15; f++) for (let c = 1; c <= 13; c++) if (J.mapa[idx(c, f)] === PISO) libres.push([c, f]);
  let n = 0;
  while (presupuesto > 0.5 && n < 12 && libres.length) {
    let tipo = elegir(pool, J.rnd);
    if (tipo === 'hongo' && J.sala < 3 && J.piso === 1) tipo = 'murcielago';
    const i = Math.floor(J.rnd() * libres.length), [c, f] = libres.splice(i, 1)[0];
    const e = crearEnemigo(tipo, c * T + T / 2, f * T + T / 2);
    e.aparece = 0.5 + n * 0.08;
    presupuesto -= TIPOS[tipo].costo; n++;
  }
}
function crearEnemigo(tipo, x, y) {
  const d = TIPOS[tipo];
  const escala = (1 + 0.5 * (nivelPiso() - 1)) * Math.pow(1.9, ciclo()) * (d.jefe ? 1 : 1 + 0.04 * J.sala);
  const e = {
    tipo, d, x, y, r: d.r, vida: d.vida * escala, vidaMax: d.vida * escala, t: 0.6 + Math.random() * 0.8, est: 'inicio', anim: Math.random() * 4,
    flash: 0, quema: 0, veneno: 0, venenoT: 0, congelado: 0, lento: 0, kx: 0, ky: 0, aparece: 0, alfa: 1, alto: 0, aire: false,
    cara: 1, semilla: Math.random() * 10, orbT: 0, muerto: false, ang: 0, n: 0, cuenta: 0,
  };
  J.enem.push(e);
  return e;
}

/* ------------------------------------------------------------ movimiento */
function choca(x, y, r, frena) {
  return frena(celdaPx(J.mapa, x - r, y - r)) || frena(celdaPx(J.mapa, x + r, y - r)) || frena(celdaPx(J.mapa, x - r, y + r)) || frena(celdaPx(J.mapa, x + r, y + r));
}
/* devuelve true si algo lo frenó */
function moverCuerpo(e, dx, dy, frena) {
  const pasos = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  let frenado = false;
  for (let i = 0; i < pasos; i++) {
    const sx = dx / pasos, sy = dy / pasos;
    if (!choca(e.x + sx, e.y, e.r, frena)) e.x += sx; else frenado = true;
    if (!choca(e.x, e.y + sy, e.r, frena)) e.y += sy; else frenado = true;
  }
  return frenado;
}
function lineaLibre(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 4);
  for (let i = 1; i < n; i++) if (frenaBala(celdaPx(J.mapa, a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n))) return false;
  return true;
}
/* para caminar hacia la chica rodeando lo que haya */
function rumbo(e) {
  const j = J.jug, cj = Math.floor(j.x / T), fj = Math.floor(j.y / T), k = idx(cj, fj);
  if (k !== J.distCelda) { J.dist = flujo(J.mapa, cj, fj); J.distCelda = k; }
  const c = Math.floor(e.x / T), f = Math.floor(e.y / T), d0 = J.dist[idx(c, f)];
  if (d0 <= 1) return angulo(e, j);
  let mejor = null, md = d0 < 0 ? 999 : d0;
  for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const v = J.dist[idx(c + dc, f + df)];
    if (v >= 0 && v < md) { md = v; mejor = [c + dc, f + df]; }
  }
  if (!mejor) return angulo(e, j);
  return Math.atan2(mejor[1] * T + T / 2 - e.y, mejor[0] * T + T / 2 - e.x);
}

/* ---------------------------------------------------------------- jugador */
function objetivo() {
  const j = J.jug;
  let mejor = null, md = 1e9, mejorLibre = null, mdl = 1e9;
  for (const e of J.enem) {
    if (e.muerto || e.aparece > 0 || e.alfa < 0.5 || e.aire) continue;
    const d = (e.x - j.x) ** 2 + (e.y - j.y) ** 2;
    if (d < md) { md = d; mejor = e; }
    if (d < mdl && lineaLibre(j, e)) { mdl = d; mejorLibre = e; }
  }
  return mejorLibre || mejor;
}
function actualizarJugador(dt) {
  const j = J.jug, c = j.cartas, v = Entrada.vector();
  j.mov = v.mag > 0.05;
  if (j.mov) {
    const sp = j.vel * v.mag;
    moverCuerpo(j, v.x * sp * dt, v.y * sp * dt, J.limpia ? (x) => x === PARED || x === ROCA || x === POZO : frenaAndar);
    j.anim += dt * 9 * v.mag;
    if (Math.abs(v.x) > 0.15) j.cara = v.x < 0 ? -1 : 1;
    if (Math.random() < dt * 8) chispa(j.x + azar(-2, 2), j.y + 5, azar(-5, 5), -azar(2, 8), 'rgba(160,140,120,0.6)', 0.35);
  } else j.anim = 0;
  j.tiroT -= dt; j.tiroAnim -= dt;
  if (!j.mov) {
    const ob = objetivo();
    if (ob) {
      j.apunta = Math.atan2(ob.y - j.y, ob.x - j.x);
      j.cara = Math.cos(j.apunta) < 0 ? -1 : 1;
      if (j.tiroT <= 0) { disparar(j.apunta); j.tiroT = j.retardo; }
    }
  }
  for (let i = j.rafagas.length - 1; i >= 0; i--) { const r = j.rafagas[i]; r.t -= dt; if (r.t <= 0) { volea(r.a, 0.9); j.rafagas.splice(i, 1); } }
  j.invul -= dt; j.flash -= dt;
  // las luces malas que giran
  const no = 2 * (c.escudo || 0);
  j.orbes = [];
  for (let i = 0; i < no; i++) {
    const a = J.t * 3.2 + i * Math.PI * 2 / no;
    const o = { x: j.x + Math.cos(a) * 20, y: j.y - 2 + Math.sin(a) * 20 };
    j.orbes.push(o);
    for (const e of J.enem) if (!e.muerto && e.aparece <= 0 && !e.aire && e.orbT <= 0 && (e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (e.r + 4) ** 2) { herir(e, j.danio * 0.4, false); e.orbT = 0.3; }
  }
  // las ánimas compañeras
  j.compas.forEach((cp, i) => {
    const ox = j.x + (i ? 12 : -12), oy = j.y - 12 + Math.sin(J.t * 3 + i) * 2;
    cp.x = lerp(cp.x, ox, Math.min(1, dt * 6)); cp.y = lerp(cp.y, oy, Math.min(1, dt * 6));
    cp.t -= dt;
    if (cp.t <= 0) {
      const ob = objetivo();
      if (ob) { const a = angulo(cp, ob); crearBala(cp.x, cp.y, a, j.danio * 0.5, 'compa'); cp.t = 0.85; } else cp.t = 0.2;
    }
  });
  // salir por la puerta
  if (J.limpia && j.y < 2 * T + 3 && Math.abs(j.x - 90) < 16) J.salir = true;
}
function disparar(a) {
  const j = J.jug;
  volea(a, 1);
  for (let i = 0; i < (j.cartas.seguido || 0); i++) j.rafagas.push({ t: 0.1 * (i + 1), a });
  Sonido.sfx('tiro');
  j.tiroAnim = 0.12;
}
function volea(a, m) {
  const j = J.jug, c = j.cartas, d = j.danio * m, ox = j.x + Math.cos(a) * 3, oy = j.y - 2 + Math.sin(a) * 3;
  const n = 1 + (c.frontal || 0);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 5;
    crearBala(ox + Math.cos(a + Math.PI / 2) * off, oy + Math.sin(a + Math.PI / 2) * off, a, d, 'luz');
  }
  [0.6, 0.32, 0.9].slice(0, c.diagonal || 0).forEach((da) => { crearBala(ox, oy, a + da, d, 'luz'); crearBala(ox, oy, a - da, d, 'luz'); });
  if (c.lateral) { crearBala(j.x, j.y - 2, a + Math.PI / 2, d, 'luz'); crearBala(j.x, j.y - 2, a - Math.PI / 2, d, 'luz'); }
  if (c.trasero === 1) crearBala(j.x, j.y - 2, a + Math.PI, d, 'luz');
  if (c.trasero >= 2) { crearBala(j.x, j.y - 2, a + Math.PI + 0.2, d, 'luz'); crearBala(j.x, j.y - 2, a + Math.PI - 0.2, d, 'luz'); }
  for (let i = 0; i < 4; i++) chispa(ox, oy, Math.cos(a) * azar(20, 50) + azar(-15, 15), Math.sin(a) * azar(20, 50) + azar(-15, 15), '#fff6b0', 0.15);
}
function crearBala(x, y, a, d, tipo) {
  const c = J.jug.cartas, vel = tipo === 'compa' ? 170 : 210;
  J.balas.push({ x, y, vx: Math.cos(a) * vel, vy: Math.sin(a) * vel, r: 2, d, tipo, vida: 1.8, golpe: [], atraviesa: c.atraviesa ? 3 : 0, rebotes: c.rebote ? 2 : 0, saltos: c.salto ? 2 : 0 });
}
function usarCopla() {
  const j = J.jug;
  if (j.copla < 100 || J.muerto) return false;
  j.copla = 0;
  for (const e of J.enem) if (!e.muerto && e.aparece <= 0) herir(e, j.danio * 3 + 30, true);
  for (const b of J.balasE) chispa(b.x, b.y, 0, -10, '#ffe080', 0.4);
  J.balasE = [];
  J.ondas.push({ x: j.x, y: j.y, r: 0, t: 0, col: '#ffe080' });
  J.lenta = 0.45; J.sacudir = 5; J.destello = 0.25;
  Sonido.sfx('copla'); vibrar(80);
  return true;
}

/* ---------------------------------------------------------------- daño */
function golpear(e, d, b) {
  const j = J.jug, c = j.cartas;
  const crit = Math.random() < j.critP;
  const dmg = d * (crit ? j.critM : 1) * azar(0.92, 1.08);
  herir(e, dmg, crit);
  if (e.muerto) return;
  if (c.fuego) e.quema = 2.2;
  if (c.veneno) { e.veneno = Math.min(e.veneno + j.danio * 0.1, j.danio * 0.8); e.venenoT = 4; }
  if (c.hielo) { e.lento = 1.6; if (!e.d.jefe && Math.random() < 0.16) e.congelado = 1.1; }
  if (c.rayo && b && b.tipo === 'luz') {
    const cerca = J.enem.filter((o) => o !== e && !o.muerto && o.aparece <= 0 && dist(o, e) < 60).sort((p, q) => dist(p, e) - dist(q, e)).slice(0, 2);
    let desde = e;
    for (const o of cerca) { J.rayos.push({ a: { x: desde.x, y: desde.y }, b: { x: o.x, y: o.y }, t: 0.14 }); herir(o, j.danio * 0.45, false); desde = o; }
    if (cerca.length && J.sfxT <= 0) Sonido.sfx('rayo');
  }
  j.copla = Math.min(100, j.copla + 0.7 * (1 + 0.4 * (c.copla || 0)));
}
function herir(e, dmg, crit) {
  if (e.muerto) return;
  e.vida -= dmg; e.flash = 0.09;
  if (!e.d.jefe && !e.d.fijo) { const a = angulo(J.jug, e); e.kx += Math.cos(a) * 26; e.ky += Math.sin(a) * 26; }
  J.numeros.push({ x: e.x + azar(-3, 3), y: e.y - e.r - 5, txt: Math.max(1, Math.round(dmg)) + (crit ? '!' : ''), col: crit ? '#ffb040' : '#ffffff', t: 0.6 });
  if (J.sfxT <= 0) { Sonido.sfx(crit ? 'critico' : 'golpe'); J.sfxT = 0.05; }
  if (e.vida <= 0) morir(e);
}
function morir(e) {
  const j = J.jug, c = j.cartas;
  e.muerto = true; J.kills++;
  const col = e.d.col;
  for (let i = 0; i < (e.d.jefe ? 60 : 14); i++) {
    const a = Math.random() * Math.PI * 2, v = azar(20, e.d.jefe ? 110 : 70);
    chispa(e.x, e.y - 2, Math.cos(a) * v, Math.sin(a) * v - 20, col[i % 2], azar(0.3, 0.8), 120);
  }
  humo(e.x, e.y, e.d.jefe ? 10 : 4);
  Sonido.sfx(e.d.jefe ? 'explota' : 'muere');
  const xp = e.d.jefe ? 70 : e.d.costo * 3 + 1;
  for (let i = 0; i < Math.ceil(xp / 4); i++) soltar('xp', e.x, e.y, 4);
  const almas = e.d.jefe ? 40 : Math.round(e.d.costo * azar(0.5, 1.6));
  for (let i = 0; i < almas; i++) soltar('alma', e.x, e.y, 1);
  if (!e.d.jefe && Math.random() < 0.04) soltar('corazon', e.x, e.y, 0);
  if (c.robo) curar(j.vidaMax * 0.02 * c.robo);
  j.copla = Math.min(100, j.copla + 7 * (1 + 0.4 * (c.copla || 0)));
  if (c.explosion) {
    J.ondas.push({ x: e.x, y: e.y, r: 0, t: 0, col: '#ff8a30', max: 26 });
    for (const o of J.enem) if (o !== e && !o.muerto && o.aparece <= 0 && dist(o, e) < 28) herir(o, j.danio * 0.6, false);
  }
  if (e.tipo === 'brasa') for (let i = 0; i < 2; i++) { const b = crearEnemigo('brasita', e.x + (i ? 5 : -5), e.y); b.aparece = 0.15; }
  if (e.d.jefe) {
    J.lenta = 1.4; J.sacudir = 8; J.destello = 0.5;
    J.pendientes++;
    DATOS.jefes = (DATOS.jefes || 0) + 1;
    for (const o of J.enem) if (!o.muerto && o !== e) morir(o);
    J.balasE = [];
  } else J.sacudir = Math.max(J.sacudir, 1.5);
}
function danarJugador(d) {
  const j = J.jug;
  if (j.invul > 0 || J.muerto) return;
  if (Math.random() < j.esquive) {
    j.invul = 0.35; Sonido.sfx('esquive');
    for (let i = 0; i < 6; i++) chispa(j.x, j.y - 3, azar(-30, 30), azar(-30, 0), '#9a8ab0', 0.4);
    return;
  }
  d = Math.round(d * azar(0.9, 1.1));
  j.vida -= d; j.invul = 0.75; j.flash = 0.75; J.sacudir = 4; J.destello = 0.12;
  J.numeros.push({ x: j.x, y: j.y - 12, txt: String(d), col: '#ff5a5a', t: 0.8 });
  vibrar(45); Sonido.sfx('herido');
  if (j.vida <= 0) {
    if (J.revivir > 0) {
      J.revivir--; j.vida = Math.round(j.vidaMax * 0.5); j.invul = 2.5;
      J.balasE = []; J.ondas.push({ x: j.x, y: j.y, r: 0, t: 0, col: '#7ef09a' });
      for (const e of J.enem) if (!e.muerto && e.aparece <= 0) herir(e, j.danio * 2, false);
      J.cartelChico = { txt: tr('revivir'), t: 1.6, col: GRAD.verde }; Sonido.sfx('nivel');
    } else { j.vida = 0; J.muerto = true; J.lenta = 1.5; Sonido.sfx('muerte'); vibrar([60, 40, 120]); }
  }
}

/* --------------------------------------------------------------- bichos */
function balaE(x, y, a, vel, o) {
  o = o || {};
  const B = BIOMAS[bioma()];
  J.balasE.push({ x, y, vx: Math.cos(a) * vel, vy: Math.sin(a) * vel, r: o.r || 2, d: danioE() * (o.mult || 1), col: o.col || B.bala, borde: o.borde || B.balaO, vida: 7, acel: o.acel || 0 });
}
function abanico(e, a, n, abre, vel, o) { for (let i = 0; i < n; i++) balaE(e.x, e.y - 2, a + (n > 1 ? (i / (n - 1) - 0.5) * abre : 0), vel, o); Sonido.sfx('balaE'); }
function anillo(e, n, vel, desf, o) { for (let i = 0; i < n; i++) balaE(e.x, e.y - 2, (i / n) * Math.PI * 2 + (desf || 0), vel, o); Sonido.sfx('balaE'); }
const velB = (v) => v * (1 + 0.06 * (nivelPiso() - 1)) * (1 + 0.1 * ciclo());

function actualizarEnemigos(dt) {
  const j = J.jug;
  for (const e of J.enem) {
    if (e.muerto) continue;
    e.anim += dt; e.flash -= dt; e.orbT -= dt;
    if (e.aparece > 0) { e.aparece -= dt; continue; }
    // estados
    if (e.quema > 0) { e.quema -= dt; e.qT = (e.qT || 0) - dt; if (e.qT <= 0) { e.qT = 0.4; herir(e, j.danio * 0.18, false); chispa(e.x, e.y - 4, azar(-8, 8), -20, '#ff8a30', 0.4); if (e.muerto) continue; } }
    if (e.venenoT > 0) { e.venenoT -= dt; e.vT = (e.vT || 0) - dt; if (e.vT <= 0) { e.vT = 0.5; herir(e, e.veneno, false); chispa(e.x, e.y - 4, azar(-6, 6), -15, '#9cff6a', 0.4); if (e.muerto) continue; } }
    if (e.congelado > 0) { e.congelado -= dt; continue; }
    const vdt = e.lento > 0 ? dt * 0.55 : dt;
    e.lento -= dt;
    // empujón
    if (e.kx || e.ky) {
      moverCuerpo(e, e.kx * dt, e.ky * dt, e.d.vuela ? frenaVuelo : frenaAndar);
      e.kx *= Math.pow(0.0005, dt); e.ky *= Math.pow(0.0005, dt);
      if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
    }
    IA[e.tipo](e, vdt, j);
    // contacto
    if (!e.aire && e.alfa > 0.5 && (e.x - j.x) ** 2 + (e.y - j.y) ** 2 < (e.r + 3) ** 2) {
      danarJugador(e.d.contacto * (1 + 0.22 * (nivelPiso() - 1)) * Math.pow(1.3, ciclo()));
      // rebota: los bichos no se quedan pegados encima
      if (!e.d.jefe && !e.d.fijo) { const a = angulo(j, e) + azar(-0.3, 0.3); e.kx = Math.cos(a) * 90; e.ky = Math.sin(a) * 90; if (e.est === 'corre' || e.est === 'salta' || e.est === 'pica') { e.est = 'anda'; e.t = azar(0.8, 1.4); } }
    }
  }
  J.enem = J.enem.filter((e) => !e.muerto);
}

const IA = {
  murcielago(e, dt, j) {
    const a = angulo(e, j) + Math.sin(e.anim * 3 + e.semilla) * 1.0;
    const v = e.d.vel * (e.est === 'pica' ? 2.2 : 1);
    moverCuerpo(e, Math.cos(a) * v * dt, Math.sin(a) * v * dt, frenaVuelo);
    e.t -= dt;
    if (e.t <= 0) { e.est = e.est === 'pica' ? 'vuela' : 'pica'; e.t = e.est === 'pica' ? 0.5 : azar(1.4, 2.4); }
    e.cara = j.x < e.x ? -1 : 1;
  },
  sapo(e, dt, j) {
    e.t -= dt;
    if (e.est === 'salta') {
      const p = 1 - e.t / 0.45;
      e.alto = Math.sin(p * Math.PI) * 10;
      moverCuerpo(e, e.vx * dt, e.vy * dt, frenaAndar);
      if (e.t <= 0) { e.alto = 0; e.est = 'quieto'; e.t = 0.25; }
    } else if (e.est === 'quieto') {
      if (e.t <= 0) { abanico(e, angulo(e, j), nivelPiso() > 1 ? 5 : 3, 0.7, velB(62)); e.est = 'espera'; e.t = azar(1.1, 1.7); }
    } else if (e.t <= 0) {
      const a = Math.random() < 0.6 ? angulo(e, j) + azar(-1, 1) : Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 55; e.vy = Math.sin(a) * 55; e.est = 'salta'; e.t = 0.45;
      e.cara = e.vx < 0 ? -1 : 1;
    }
  },
  anima(e, dt, j) {
    const d = dist(e, j), a = angulo(e, j) + (d < 45 ? Math.PI : 0) + Math.sin(e.anim + e.semilla) * 0.8;
    moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaVuelo);
    e.t -= dt;
    if (e.est === 'carga') { if (e.t <= 0) { const n = nivelPiso() > 1 ? 2 : 1; for (let i = 0; i < n; i++) balaE(e.x, e.y - 2, angulo(e, j) + (i - (n - 1) / 2) * 0.18, velB(74), { r: 2 }); Sonido.sfx('balaE'); e.est = 'flota'; e.t = azar(1.6, 2.4); } }
    else if (e.t <= 0) { e.est = 'carga'; e.t = 0.45; }
    e.cara = j.x < e.x ? -1 : 1;
  },
  hongo(e, dt) {
    e.t -= dt;
    if (e.est === 'infla') { if (e.t <= 0) { e.n = (e.n || 0) + 1; anillo(e, 8, velB(44), e.n % 2 ? Math.PI / 8 : 0); e.est = 'espera'; e.t = 2.4; } }
    else if (e.t <= 0) { e.est = 'infla'; e.t = 0.4; }
  },
  vibora(e, dt, j) {
    e.t -= dt;
    if (e.est === 'mira') { if (e.t <= 0) { e.est = 'corre'; e.t = 0.42; } }
    else if (e.est === 'corre') {
      if (moverCuerpo(e, Math.cos(e.ang) * 150 * dt, Math.sin(e.ang) * 150 * dt, frenaAndar) || e.t <= 0) { e.est = 'anda'; e.t = azar(0.9, 1.5); }
      if (Math.random() < 0.5) chispa(e.x, e.y + 3, 0, 0, 'rgba(154,208,96,0.5)', 0.3);
    } else {
      const a = rumbo(e) + Math.sin(e.anim * 4) * 0.6;
      moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaAndar);
      if (e.t <= 0 && dist(e, j) < 120 && lineaLibre(e, j)) { e.est = 'mira'; e.t = 0.5; e.ang = angulo(e, j); }
    }
    e.cara = j.x < e.x ? -1 : 1;
  },
  lobito(e, dt, j) {
    e.t -= dt;
    if (e.est === 'mira') { if (e.t <= 0) { e.est = 'salta'; e.t = 0.3; } }
    else if (e.est === 'salta') { moverCuerpo(e, Math.cos(e.ang) * 120 * dt, Math.sin(e.ang) * 120 * dt, frenaAndar); if (e.t <= 0) { e.est = 'corre'; e.t = azar(1.8, 2.8); } }
    else {
      const a = rumbo(e);
      moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaAndar);
      if (e.t <= 0 && dist(e, j) < 70) { e.est = 'mira'; e.t = 0.35; e.ang = angulo(e, j); }
    }
    e.cara = j.x < e.x ? -1 : 1;
  },
  kakuy(e, dt, j) {
    e.ang += dt * 0.7;
    const ox = j.x + Math.cos(e.ang + e.semilla) * 55, oy = j.y - 30 + Math.sin(e.ang + e.semilla) * 40;
    const a = Math.atan2(oy - e.y, ox - e.x);
    moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaVuelo);
    e.t -= dt;
    if (e.est === 'tira') { e.t2 = (e.t2 || 0) - dt; if (e.t2 <= 0) { e.t2 = 0.12; balaE(e.x, e.y - 2, e.n * 0.7, velB(52)); e.n++; } if (e.t <= 0) { e.est = 'vuela'; e.t = azar(2.2, 3); } }
    else if (e.t <= 0) { e.est = 'tira'; e.t = 0.6; e.n = Math.random() * 10; Sonido.sfx('balaE'); }
    e.cara = j.x < e.x ? -1 : 1;
  },
  diablillo(e, dt, j) {
    e.t -= dt;
    if (e.est === 'se va') { e.alfa = Math.max(0, e.t / 0.35); if (e.t <= 0) { teletransportar(e, 45, 95); e.est = 'vuelve'; e.t = 0.35; } }
    else if (e.est === 'vuelve') { e.alfa = 1 - e.t / 0.35; if (e.t <= 0) { e.alfa = 1; e.est = 'apunta'; e.t = 0.45; } }
    else if (e.est === 'apunta') { if (e.t <= 0) { abanico(e, angulo(e, j), 5, 0.9, velB(66)); e.est = 'espera'; e.t = 1.3; } }
    else if (e.t <= 0) { e.est = 'se va'; e.t = 0.35; Sonido.sfx('tele'); }
    e.cara = j.x < e.x ? -1 : 1;
  },
  brasa(e, dt, j) {
    const a = rumbo(e);
    moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaAndar);
    e.t -= dt;
    if (e.t <= 0) { anillo(e, 4, velB(50), Math.PI / 4); e.t = azar(2.4, 3.2); }
    if (Math.random() < dt * 6) chispa(e.x + azar(-3, 3), e.y - 6, azar(-4, 4), -azar(10, 25), '#ffb040', 0.5);
    e.cara = j.x < e.x ? -1 : 1;
  },
  brasita(e, dt, j) {
    const a = rumbo(e);
    moverCuerpo(e, Math.cos(a) * e.d.vel * dt, Math.sin(a) * e.d.vel * dt, frenaAndar);
    e.cara = j.x < e.x ? -1 : 1;
  },

  /* ------------------------------------------------------------- jefes */
  sapoRey(e, dt, j) {
    const mitad = e.vida < e.vidaMax * 0.5;
    e.t -= dt;
    if (e.est === 'inicio' || e.est === 'espera') {
      e.aire = false;
      if (e.t <= 0) {
        e.cuenta++;
        if (e.cuenta % 3 === 0) { e.est = 'escupe'; e.n = mitad ? 4 : 3; e.t = 0.2; }
        else { e.est = 'sube'; e.t = 0.45; e.dest = { x: clamp(j.x, 24, 156), y: clamp(j.y, 44, 230) }; Sonido.sfx('salto'); }
      }
    } else if (e.est === 'sube') {
      e.alto = (1 - e.t / 0.45) * 70; e.aire = e.alto > 12;
      if (e.t <= 0) { e.est = 'cae'; e.t = 0.6; e.x = e.dest.x; e.y = e.dest.y; }
    } else if (e.est === 'cae') {
      e.alto = (e.t / 0.6) * 70; e.aire = e.alto > 8;
      if (e.t <= 0) {
        e.alto = 0; e.aire = false;
        anillo(e, mitad ? 20 : 14, velB(56), Math.random(), { r: 3 });
        J.sacudir = 6; Sonido.sfx('aterriza'); vibrar(30);
        humo(e.x, e.y + 6, 8);
        e.est = 'espera'; e.t = mitad ? 0.7 : 1.0;
      }
    } else if (e.est === 'escupe') {
      if (e.t <= 0) { abanico(e, angulo(e, j), 7, 1.1, velB(72)); e.n--; e.t = 0.35; if (e.n <= 0) { e.est = 'espera'; e.t = 0.9; } }
    }
    if (mitad && !e.invoco) { e.invoco = true; for (let i = 0; i < 2; i++) { const s = crearEnemigo('sapo', 40 + i * 100, 60); s.aparece = 0.8; } }
    e.cara = j.x < e.x ? -1 : 1;
  },
  viuda(e, dt, j) {
    const mitad = e.vida < e.vidaMax * 0.5;
    e.t -= dt;
    if (e.est === 'inicio') { if (e.t <= 0) { e.est = 'espiral'; e.t = 3.2; } return; }
    if (e.est === 'espiral') {
      e.x = lerp(e.x, 90 + Math.sin(J.t * 0.8) * 45, dt * 2);
      e.t2 = (e.t2 || 0) - dt;
      if (e.t2 <= 0) {
        e.t2 = 0.09; const brazos = mitad ? 3 : 2;
        for (let k = 0; k < brazos; k++) balaE(e.x, e.y, e.ang + k * Math.PI * 2 / brazos, velB(54), { r: 2 });
        e.ang += 0.24;
      }
      if (e.t <= 0) { e.est = 'se va'; e.t = 0.45; Sonido.sfx('tele'); }
    } else if (e.est === 'se va') {
      e.alfa = e.t / 0.45; e.aire = true;
      if (e.t <= 0) { e.x = azar(30, 150); e.y = azar(50, 120); e.est = 'vuelve'; e.t = 0.4; }
    } else if (e.est === 'vuelve') {
      e.alfa = 1 - e.t / 0.4;
      if (e.t <= 0) { e.alfa = 1; e.aire = false; e.est = 'rafagas'; e.n = 3; e.t = 0.2; }
    } else if (e.est === 'rafagas') {
      if (e.t <= 0) { abanico(e, angulo(e, j), 5, 0.6, velB(78)); e.n--; e.t = 0.32; if (e.n <= 0) { e.est = 'lluvia'; e.t = 3; } }
    } else if (e.est === 'lluvia') {
      e.t2 = (e.t2 || 0) - dt;
      if (e.t2 <= 0) { e.t2 = mitad ? 0.09 : 0.13; J.balasE.push({ x: azar(16, 164), y: 30, vx: azar(-8, 8), vy: velB(50), r: 2, d: danioE(), col: '#9ad8ff', borde: '#204060', vida: 7, acel: 30 }); }
      if (e.t <= 0) { e.est = 'espiral'; e.t = 3.2; }
    }
  },
  lobizon(e, dt, j) {
    const mitad = e.vida < e.vidaMax * 0.5;
    e.t -= dt;
    if (e.est === 'inicio' || e.est === 'descansa') {
      if (e.t <= 0) {
        e.cuenta++;
        if (e.cuenta % 3 === 0) { e.est = 'aulla'; e.t = 0.9; Sonido.sfx('rugido'); J.sacudir = 3; }
        else { e.est = 'mira'; e.t = mitad ? 0.5 : 0.7; e.ang = angulo(e, j); e.rebotes = mitad ? 3 : 2; Sonido.sfx('aviso'); }
      }
    } else if (e.est === 'mira') {
      e.ang = lerp(e.ang, angulo(e, j), dt * 2);
      if (e.t <= 0) e.est = 'carga';
    } else if (e.est === 'carga') {
      const v = mitad ? 190 : 165;
      const vx = Math.cos(e.ang) * v * dt, vy = Math.sin(e.ang) * v * dt;
      const x0 = e.x, y0 = e.y;
      if (moverCuerpo(e, vx, vy, frenaVuelo)) {
        anillo(e, 8, velB(50), Math.random()); J.sacudir = 4; Sonido.sfx('aterriza'); humo(e.x, e.y, 4);
        if (e.rebotes-- > 0) { const a = angulo(e, j); e.ang = a + azar(-0.3, 0.3); }
        else { e.est = 'descansa'; e.t = 0.9; }
        if (Math.abs(e.x - x0) < 0.1 && Math.abs(e.y - y0) < 0.1) e.ang = angulo(e, j);
      }
      if (Math.random() < 0.6) humo(e.x, e.y + 8, 1);
    } else if (e.est === 'aulla') {
      if (e.t <= 0) {
        anillo(e, 16, velB(46), 0, { r: 3 });
        const vivos = J.enem.filter((o) => !o.muerto && o.tipo === 'murcielago').length;
        for (let i = 0; i < Math.min(3, 6 - vivos); i++) { const m = crearEnemigo('murcielago', azar(30, 150), azar(40, 90)); m.aparece = 0.5; }
        e.est = 'descansa'; e.t = 0.8;
      }
    }
    e.cara = Math.cos(e.ang || 0) < 0 ? -1 : 1;
  },
  mandinga(e, dt, j) {
    const fase = e.vida > e.vidaMax * 0.66 ? 1 : e.vida > e.vidaMax * 0.33 ? 2 : 3;
    e.t -= dt;
    if (e.est === 'inicio' || e.est === 'piensa') {
      if (e.t <= 0) {
        const op = fase === 1 ? ['abanico', 'anillos'] : fase === 2 ? ['abanico', 'anillos', 'pilares', 'invoca'] : ['espiral', 'pilares', 'anillos', 'invoca', 'espiral'];
        e.cuenta++;
        e.prox = op[e.cuenta % op.length];
        e.est = 'se va'; e.t = 0.3; Sonido.sfx('tele');
      }
    } else if (e.est === 'se va') {
      e.alfa = e.t / 0.3; e.aire = true;
      if (e.t <= 0) { e.x = azar(40, 140); e.y = azar(50, 100); e.est = 'vuelve'; e.t = 0.3; }
    } else if (e.est === 'vuelve') {
      e.alfa = 1 - e.t / 0.3;
      if (e.t <= 0) { e.alfa = 1; e.aire = false; e.est = e.prox; e.n = 0; e.t = 0.25; }
    } else if (e.est === 'abanico') {
      if (e.t <= 0) { abanico(e, angulo(e, j), 9, 1.5, velB(70)); e.n++; e.t = 0.42; if (e.n >= 3) { e.est = 'piensa'; e.t = 0.7; } }
    } else if (e.est === 'anillos') {
      if (e.t <= 0) { anillo(e, 18, velB(50), e.n * 0.17, { r: 3 }); e.n++; e.t = 0.42; if (e.n >= (fase === 3 ? 5 : 4)) { e.est = 'piensa'; e.t = 0.6; } }
    } else if (e.est === 'pilares') {
      if (e.n === 0) {
        Sonido.sfx('aviso');
        for (let i = 0; i < 6; i++) {
          const x = i < 2 ? j.x + azar(-10, 10) : azar(20, 160), y = i < 2 ? j.y + azar(-10, 10) : azar(40, 250);
          if (!frenaAndar(celdaPx(J.mapa, x, y))) J.zonas.push({ x, y, r: 10, t: 0, aviso: 1 + i * 0.08, dura: 0.55, pego: false });
        }
        e.n = 1; e.t = 1.6;
      }
      if (e.t <= 0) { e.est = 'piensa'; e.t = 0.3; }
    } else if (e.est === 'espiral') {
      e.t2 = (e.t2 || 0) - dt;
      if (e.t2 <= 0) { e.t2 = 0.08; balaE(e.x, e.y, e.ang, velB(56)); balaE(e.x, e.y, -e.ang + Math.PI, velB(56), { col: '#ffcf4a', borde: '#704010' }); e.ang += 0.21; }
      if (e.n === 0) { e.n = 1; e.t = 3.6; }
      if (e.t <= 0) { e.est = 'piensa'; e.t = 0.5; }
    } else if (e.est === 'invoca') {
      const vivos = J.enem.filter((o) => !o.muerto && !o.d.jefe).length;
      for (let i = 0; i < Math.min(2, 4 - vivos); i++) { const m = crearEnemigo('diablillo', 30 + i * 120, azar(80, 150)); m.aparece = 0.6; }
      anillo(e, 12, velB(46));
      e.est = 'piensa'; e.t = 0.8;
    }
    e.cara = j.x < e.x ? -1 : 1;
  },
};
function teletransportar(e, dmin, dmax) {
  const j = J.jug;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = azar(dmin, dmax), x = j.x + Math.cos(a) * d, y = j.y + Math.sin(a) * d;
    if (x < 18 || x > 162 || y < 36 || y > 256 || choca(x, y, e.r, frenaAndar)) continue;
    e.x = x; e.y = y; return;
  }
}

/* --------------------------------------------------------------- balas */
function actualizarBalas(dt) {
  for (let i = J.balas.length - 1; i >= 0; i--) {
    const b = J.balas[i];
    b.vida -= dt;
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (frenaBala(celdaPx(J.mapa, nx, ny))) {
      if (b.rebotes > 0) {
        if (frenaBala(celdaPx(J.mapa, nx, b.y))) b.vx = -b.vx;
        if (frenaBala(celdaPx(J.mapa, b.x, ny))) b.vy = -b.vy;
        if (!frenaBala(celdaPx(J.mapa, nx, b.y)) && !frenaBala(celdaPx(J.mapa, b.x, ny))) { b.vx = -b.vx; b.vy = -b.vy; }
        b.rebotes--;
      } else { for (let k = 0; k < 3; k++) chispa(b.x, b.y, azar(-30, 30), azar(-30, 30), '#fff0a0', 0.2); b.vida = 0; }
    } else { b.x = nx; b.y = ny; }
    if (b.vida > 0) for (const e of J.enem) {
      if (e.muerto || e.aparece > 0 || e.aire || e.alfa < 0.5 || b.golpe.includes(e)) continue;
      const rr = e.r + b.r + 1;
      if ((e.x - b.x) ** 2 + (e.y - 2 - b.y) ** 2 > rr * rr) continue;
      golpear(e, b.d, b); b.golpe.push(e);
      if (b.saltos > 0) {
        const otro = J.enem.filter((o) => !o.muerto && o.aparece <= 0 && !b.golpe.includes(o) && dist(o, b) < 80).sort((p, q) => dist(p, b) - dist(q, b))[0];
        if (otro) { const a = angulo(b, otro), v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.saltos--; b.vida = Math.max(b.vida, 0.6); continue; }
      }
      if (b.atraviesa > 0) { b.atraviesa--; b.d *= 0.75; continue; }
      b.vida = 0; break;
    }
    if (b.vida <= 0) J.balas.splice(i, 1);
  }
  const j = J.jug;
  for (let i = J.balasE.length - 1; i >= 0; i--) {
    const b = J.balasE[i];
    b.vida -= dt;
    if (b.acel) { const v = Math.hypot(b.vx, b.vy) || 1; b.vx += b.vx / v * b.acel * dt; b.vy += b.vy / v * b.acel * dt; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let fuera = b.vida <= 0 || frenaBala(celdaPx(J.mapa, b.x, b.y));
    if (!fuera && j.orbes) for (const o of j.orbes) if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < 25) { fuera = true; chispa(b.x, b.y, 0, 0, '#ffe080', 0.25); break; }
    if (!fuera && (b.x - j.x) ** 2 + (b.y - (j.y - 2)) ** 2 < (b.r + 2.5) ** 2) { danarJugador(b.d); fuera = true; }
    if (fuera) { if (b.vida > 0) chispa(b.x, b.y, azar(-20, 20), azar(-20, 20), b.col, 0.2); J.balasE.splice(i, 1); }
  }
  // los pilares de fuego del Mandinga
  for (let i = J.zonas.length - 1; i >= 0; i--) {
    const z = J.zonas[i];
    z.t += dt;
    if (z.t > z.aviso && z.t < z.aviso + z.dura) {
      if (!z.pego && (z.x - j.x) ** 2 + (z.y - j.y) ** 2 < z.r * z.r) { z.pego = true; danarJugador(danioE() * 1.3); }
      if (Math.random() < 0.8) chispa(z.x + azar(-z.r, z.r) * 0.7, z.y, azar(-6, 6), -azar(40, 90), Math.random() < 0.5 ? '#ffb040' : '#ff5a28', 0.5);
      if (!z.sono) { z.sono = true; Sonido.sfx('explota'); J.sacudir = Math.max(J.sacudir, 2); }
    }
    if (z.t > z.aviso + z.dura) J.zonas.splice(i, 1);
  }
}

/* ------------------------------------------------ lo que se junta del piso */
function soltar(tipo, x, y, valor) {
  const a = Math.random() * Math.PI * 2, v = azar(20, 70);
  J.items.push({ tipo, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, valor, alto: 0, vz: azar(40, 70) });
}
function actualizarItems(dt) {
  const j = J.jug;
  J.comboT -= dt; if (J.comboT <= 0) J.comboAlma = 0;
  for (let i = J.items.length - 1; i >= 0; i--) {
    const it = J.items[i];
    it.t += dt;
    it.vz -= 260 * dt; it.alto = Math.max(0, it.alto + it.vz * dt); if (it.alto === 0) it.vz = 0;
    const d = Math.hypot(j.x - it.x, j.y - it.y);
    if (it.t > 0.45 && (J.limpia || d < j.iman || it.atraido)) {
      // atraído: va derecho hacia ella, cada vez más rápido (sin inercia, así no queda dando vueltas)
      it.atraido = true;
      it.vel = (it.vel || 60) + 400 * dt;
      const paso = Math.min(d, it.vel * dt);
      it.x += (j.x - it.x) / (d || 1) * paso; it.y += (j.y - it.y) / (d || 1) * paso;
    } else {
      it.vx *= Math.pow(0.02, dt); it.vy *= Math.pow(0.02, dt);
      const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
      if (frenaBala(celdaPx(J.mapa, nx, ny))) { it.vx = -it.vx * 0.5; it.vy = -it.vy * 0.5; } else { it.x = nx; it.y = ny; }
    }
    if (Math.hypot(j.x - it.x, j.y - it.y) < 7 && it.t > 0.3) {
      J.items.splice(i, 1);
      if (it.tipo === 'xp') {
        j.xp += it.valor; Sonido.sfx('xp', 1 + Math.min(1, J.comboAlma * 0.03));
        while (j.xp >= xpSig(j.nivel)) {
          j.xp -= xpSig(j.nivel); j.nivel++; J.pendientes++;
          J.ondas.push({ x: j.x, y: j.y, r: 0, t: 0, col: '#ffcf4a' });
          J.cartelChico = { txt: tr('nv') + ' ' + j.nivel, t: 1.2, col: GRAD.oro };
          Sonido.sfx('nivel'); vibrar(25);
        }
      } else if (it.tipo === 'alma') {
        J.almas++; J.comboAlma++; J.comboT = 0.4;
        Sonido.sfx('alma', Math.pow(2, Math.min(12, J.comboAlma) / 12));
      } else if (it.tipo === 'corazon') curar(j.vidaMax * 0.12);
    }
  }
}

/* --------------------------------------------------------- partículas */
function chispa(x, y, vx, vy, col, vida, grav) { if (J.part.length < 500) J.part.push({ x, y, vx, vy, col, t: vida, vida, grav: grav || 0, tam: 1 }); }
function humo(x, y, n) { for (let i = 0; i < n; i++) J.part.push({ x: x + azar(-5, 5), y: y + azar(-3, 3), vx: azar(-15, 15), vy: -azar(5, 20), col: 'rgba(120,100,130,0.5)', t: azar(0.4, 0.8), vida: 0.8, grav: 0, tam: 2 + Math.floor(Math.random() * 2) }); }
function actualizarParticulas(dt) {
  for (let i = J.part.length - 1; i >= 0; i--) {
    const p = J.part[i];
    p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= Math.pow(0.15, dt);
    if (p.t <= 0) J.part.splice(i, 1);
  }
  for (let i = J.numeros.length - 1; i >= 0; i--) { const n = J.numeros[i]; n.t -= dt; n.y -= 22 * dt; if (n.t <= 0) J.numeros.splice(i, 1); }
  for (let i = J.rayos.length - 1; i >= 0; i--) { J.rayos[i].t -= dt; if (J.rayos[i].t <= 0) J.rayos.splice(i, 1); }
  for (let i = J.ondas.length - 1; i >= 0; i--) { const o = J.ondas[i]; o.t += dt; o.r = (o.max || 90) * Math.min(1, o.t / 0.45); if (o.t > 0.5) J.ondas.splice(i, 1); }
}

/* --------------------------------------------------------------- el paso */
function pasoMundo(dt) {
  J.t += dt; J.tSala += dt; J.sfxT -= dt;
  if (!J.muerto) actualizarJugador(dt);
  actualizarEnemigos(dt);
  actualizarBalas(dt);
  actualizarItems(dt);
  actualizarParticulas(dt);
  if (!J.limpia && J.tipo !== 'fogon' && J.tSala > 0.6 && J.enem.length === 0) {
    J.limpia = true;
    for (const c of PUERTA_C) { J.mapa[idx(c, 0)] = ABIERTA; J.mapa[idx(c, 1)] = ABIERTA; }
    Sonido.sfx('puerta');
    J.cartelChico = J.cartelChico && J.cartelChico.t > 0.5 ? J.cartelChico : { txt: tr('limpio'), t: 1.1, col: GRAD.celeste };
    for (let i = 0; i < 20; i++) chispa(90 + azar(-16, 16), 2 * T, azar(-10, 10), azar(10, 40), BIOMAS[bioma()].antorcha, 0.8);
  }
}
function abrirPuertaFogon() {
  J.limpia = true;
  for (const c of PUERTA_C) { J.mapa[idx(c, 0)] = ABIERTA; J.mapa[idx(c, 1)] = ABIERTA; }
  Sonido.sfx('puerta');
}
