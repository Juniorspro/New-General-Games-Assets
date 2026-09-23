// Maneja cada vehículo por cada tramo con el piloto y cuenta hasta dónde llega y por qué para.
//     node ruta40/pruebas/manejar.mjs [vehiculo] [tramo] [--mej=0..10] [--seg=600]
import { crearAuto, pasoAuto, PASO, volcado } from '../js/fisica.js';
import { VEHICULOS, ORDEN_VEHICULOS, aFisica, MEJORAS } from '../js/vehiculos.js';
import { TRAMOS, generarTramo } from '../js/ruta.js';
import { crearPiloto } from '../js/piloto.js';

const esteArchivo = import.meta.url === `file://${process.argv[1]}`;
const arg = esteArchivo ? process.argv.slice(2) : [], sueltos = arg.filter((a) => !a.startsWith('--'));
const op = Object.fromEntries(arg.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const vehs = sueltos[0] && sueltos[0] !== 'todos' ? [sueltos[0]] : ORDEN_VEHICULOS;
const tramos = sueltos[1] ? [sueltos[1]] : TRAMOS.map((t) => t.id);
const nivel = +(op.mej ?? 0), seg = +(op.seg ?? 600);

export function correr(vid, tid, niv, segundos, conNafta = true) {
  const R = generarTramo(tid), def = VEHICULOS[vid];
  const mej = aFisica(Object.fromEntries(MEJORAS.map((m) => [m, niv])));
  const A = crearAuto(def, 0, R.alto(0) + 1.4, mej);
  const piloto = crearPiloto(undefined, 7);
  const tomados = new Set();
  let volc = 0, parado = 0, t = 0, avance = 0, tAvance = 0, fin = 'tiempo', maxX = 0, cargas = 0, minNafta = Infinity;
  for (; t < segundos; t += PASO) {
    const inp = piloto(A, R.S, PASO);
    pasoAuto(A, R.S, inp, PASO);
    if (!Number.isFinite(A.x + A.y + A.a)) { fin = 'EXPLOTÓ'; break; }
    for (const [i, q] of R.nafta.entries()) if (!tomados.has(i) && Math.abs(q.x - A.x) < 1.5) { tomados.add(i); A.nafta = A.tanque; cargas++; }
    if (!conNafta) A.nafta = A.tanque;
    minNafta = Math.min(minNafta, A.nafta);
    maxX = Math.max(maxX, A.x);
    if (A.choco) { fin = 'cabeza'; break; }
    volc = volcado(A) ? volc + PASO : 0; if (volc > 2) { fin = 'volcó'; break; }
    parado = Math.hypot(A.vx, A.vy) < 0.3 ? parado + PASO : 0;
    /* sin nafta: se terminó cuando deja de avanzar (puede quedar hamacándose en un pozo) */
    if (A.x > avance + 0.5) { avance = A.x; tAvance = t; }
    if (A.nafta <= 0 && (parado > 1.5 || t - tAvance > 3)) { fin = 'nafta'; break; }
    if (parado > 12) { fin = 'trabado'; break; }
    if (A.x >= R.largo) { fin = 'LLEGÓ'; break; }
  }
  return { vid, tid, niv, x: Math.round(maxX), fin, t: Math.round(t), cargas, v: +(maxX / t).toFixed(1) };
}

if (esteArchivo) {
  for (const v of vehs) {
    const filas = [];
    for (const tr of tramos) filas.push(correr(v, tr, nivel, seg, op.nafta !== 'no'));
    console.log(`${v.padEnd(10)} mej ${nivel}: ` + filas.map((f) => `${f.tid} ${f.x}m ${f.fin} (${f.v}m/s)`).join(' · '));
  }
}
