// La computadora (truco-ia.js) contra sí misma y contra un jugador al azar:   node porteos/truco/prueba-ia.js
'use strict';
const T = require('./truco.js');
const IA = require('./truco-ia.js');
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
function azar(semilla) { let x = semilla >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const PERFILES = {
  neutral: { lier_envido: 45, lier_truco: 45, fishing_envido: 40, fishing_truco: 40, style: 'NEUTRAL' },
  agresivo: { lier_envido: 80, lier_truco: 85, fishing_envido: 20, fishing_truco: 20, style: 'EXTREMELY_AGGRESSIVE' },
  pasivo: { lier_envido: 10, lier_truco: 10, fishing_envido: 60, fishing_truco: 60, style: 'EXTREMELY_PASIVE' },
};

// juega una partida; jugadorDe(s) devuelve 'ia:perfil' o 'azar'
function partida(cfg, jugadorDe, sem, stats) {
  const r = azar(sem);
  const p = T.partida(Object.assign({ azar: r, mano: sem % cfg.jugadores }, cfg));
  const memorias = [{}, {}];
  let manos = 0;
  while (p.ganador === null) {
    if (++manos > 300) throw new Error('partida sin fin');
    const m = p.nuevaMano();
    let pasos = 0;
    while (!m.terminada) {
      if (++pasos > 300) throw new Error('mano trabada');
      const s = m.quien();
      const quien = jugadorDe(s);
      let acc;
      const t0 = process.hrtime.bigint();
      if (quien === 'azar') {
        const a = m.acciones(s); acc = a[Math.floor(r() * a.length)];
      } else {
        acc = IA.decidir(m, s, PERFILES[quien.split(':')[1]], memorias[s % 2], r);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        stats.tiempos.push(ms);
      }
      const legales = m.acciones(s);
      if (!legales.some((a) => a.tipo === acc.tipo && a.que === acc.que && (!a.carta || a.carta.id === (acc.carta && acc.carta.id)))) {
        throw new Error(`la IA eligió algo no válido: ${JSON.stringify(acc)}`);
      }
      if (acc.tipo === 'cantar') stats.cantos[acc.que] = (stats.cantos[acc.que] || 0) + 1;
      if (acc.tipo === 'responder') stats.respuestas[acc.que] = (stats.respuestas[acc.que] || 0) + 1;
      m.hacer(s, acc);
    }
    for (const e of [0, 1]) IA.aprender(m, e, memorias[e]);
  }
  return p.ganador;
}

const stats = { tiempos: [], cantos: {}, respuestas: {} };
const res = {};
function serie(nombre, cfg, jugadorDe, partidas) {
  let gana0 = 0, errores = [];
  for (let k = 1; k <= partidas; k++) {
    try { if (partida(cfg, jugadorDe, k * 2654435761 % 4294967291, stats) === 0) gana0++; }
    catch (e) { errores.push(e.message); }
  }
  res[nombre] = { gana0, partidas, errores };
  return res[nombre];
}

console.log('la IA contra un jugador al azar');
let r1 = serie('ia-vs-azar 1v1', { jugadores: 2, puntos: 15 }, (s) => (s === 0 ? 'ia:neutral' : 'azar'), 60);
ch('1 contra 1: la IA nunca elige algo no válido', r1.errores.length === 0, r1.errores.slice(0, 2).join(' | '));
ch('1 contra 1: le gana casi siempre al azar', r1.gana0 / r1.partidas > 0.9, `${r1.gana0}/${r1.partidas}`);
let r2 = serie('ia-vs-azar 2v2 flor', { jugadores: 4, puntos: 15, flor: true }, (s) => (s % 2 === 0 ? 'ia:neutral' : 'azar'), 30);
ch('2 contra 2 con flor: sin errores y gana casi siempre', r2.errores.length === 0 && r2.gana0 / r2.partidas > 0.85, `${r2.gana0}/${r2.partidas} ${r2.errores.slice(0, 1)}`);
let r3 = serie('ia-vs-azar 3v3', { jugadores: 6, puntos: 15 }, (s) => (s % 2 === 0 ? 'ia:neutral' : 'azar'), 20);
ch('3 contra 3: sin errores y gana casi siempre', r3.errores.length === 0 && r3.gana0 / r3.partidas > 0.85, `${r3.gana0}/${r3.partidas} ${r3.errores.slice(0, 1)}`);

console.log('la IA contra sí misma');
let r4 = serie('neutral-vs-neutral', { jugadores: 2, puntos: 30 }, () => 'ia:neutral', 60);
ch('neutral contra neutral: parejo', r4.errores.length === 0 && r4.gana0 / r4.partidas > 0.3 && r4.gana0 / r4.partidas < 0.7, `${r4.gana0}/${r4.partidas}`);
let r5 = serie('agresivo-vs-pasivo', { jugadores: 2, puntos: 30, flor: true }, (s) => (s === 0 ? 'ia:agresivo' : 'ia:pasivo'), 60);
ch('agresivo contra pasivo: sin errores', r5.errores.length === 0, `agresivo ganó ${r5.gana0}/${r5.partidas}`);

const t = stats.tiempos.sort((a, b) => a - b);
const p95 = t[Math.floor(t.length * 0.95)];
ch('cada decisión tarda poco (p95 < 40 ms)', p95 < 40, `mediana ${t[Math.floor(t.length / 2)].toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, máx ${t[t.length - 1].toFixed(1)} ms`);
ch('canta de todo', ['truco', 'retruco', 'valecuatro', 'envido', 'realenvido', 'faltaenvido'].every((q) => stats.cantos[q] > 0), JSON.stringify(stats.cantos));
ch('quiere y no quiere', stats.respuestas.quiero > 0 && stats.respuestas.noquiero > 0, JSON.stringify(stats.respuestas));
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
