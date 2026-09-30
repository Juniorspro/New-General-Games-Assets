// Volver a buscar los tiempos de las soluciones (si se toca la física, las
// guardadas pueden dejar de andar): para cada nivel, con sus mismas cosas,
// sus mismas estrellas y sus mismas acciones en el mismo orden, prueba
// tiempos al azar y se queda con los que hacen comer a Morfi con las tres
// estrellas usando todo el tablero, con el MAYOR margen (que cortar un poco
// antes o después también sirva). Imprime el `sol` nuevo para pegar en
// js/niveles.js y cuánto perdona.
//   node morfi/pruebas/tiempos.mjs [1-4 2-7 ...] [--muestras 800]
// (Cómo se diseñó cada nivel desde cero: memoria/morfi.md › Diseñar niveles.)
import { jugarSolucion } from '../js/partida.js';
import { NIVELES } from '../js/niveles.js';
import { azar } from '../js/util.js';

const args = process.argv.slice(2), iM = args.indexOf('--muestras');
const N = iM >= 0 ? +args[iM + 1] : 800;
const ids = args.filter((a, i) => /^\d-\d+$/.test(a) && i !== iM + 1);
const OBJETOS = [['clips', 'clip'], ['globos', 'globo'], ['sobres', 'sobre'], ['elasticos', 'boing'], ['abanicos', 'soplo']];
const usaTodo = (n, p) => OBJETOS.every(([k, e]) => !(n[k] || []).length || p.eventos.some((x) => x.tipo === e));
const sirve = (n, sol) => { const x = jugarSolucion(n, sol, 9); return x.estado === 'comido' && x.estrellas === 3 && usaTodo(n, x.p); };
const redondear = (sol) => sol.map((a) => [Math.round(a[0] * 100) / 100, ...a.slice(1)]);
// las vecinas: una acción ±0,04 y ±0,08 s (quien juega mira el caramelo: si
// se adelantó en una, adelanta también las que siguen; vale cualquiera de las dos)
function margen(n, sol) {
  let b = 0, t = 0;
  for (let i = 0; i < sol.length; i++) for (const d of [-0.08, -0.04, 0.04, 0.08]) {
    t++;
    const sola = sol.map((a, j) => (j === i ? [a[0] + d, ...a.slice(1)] : a)), todas = sol.map((a, j) => (j >= i ? [a[0] + d, ...a.slice(1)] : a));
    if (sirve(n, sola) || (sol.length > 1 && sirve(n, todas))) b++;
  }
  return b / t;
}

for (const n of NIVELES) {
  if (ids.length && !ids.includes(n.id)) continue;
  const r = azar(77), t0 = performance.now(), tpl = [...n.sol].sort((a, b) => a[0] - b[0]);
  const candidatos = sirve(n, tpl) ? [tpl] : [];
  // la primera acción entre 0,5 y 3,5 s; entre una y otra, de 0,2 a 3 s
  for (let k = 0; k < N; k++) {
    const ts = []; for (let i = 0; i < tpl.length; i++) ts.push(i ? ts[i - 1] + 0.2 + r() * 2.8 : 0.5 + r() * 3);
    const sol = redondear(tpl.map((a, i) => [ts[i], ...a.slice(1)]));
    if (sirve(n, sol)) candidatos.push(sol);
  }
  if (!candidatos.length) { console.log(`${n.id}: ✗ no hay tiempos que den las tres estrellas (hay que tocar el nivel)`); continue; }
  let mejor = null;
  for (const sol of candidatos) { const m = margen(n, sol); if (!mejor || m > mejor.m) mejor = { sol, m }; }
  // afinar alrededor
  for (const paso of [0.06, 0.03]) for (let i = 0; i < tpl.length; i++) for (const d of [-paso, paso]) {
    const sol = redondear(mejor.sol.map((a, j) => (j === i ? [a[0] + d, ...a.slice(1)] : a)));
    if (!sirve(n, sol)) continue;
    const m = margen(n, sol); if (m > mejor.m) mejor = { sol, m };
  }
  const igual = JSON.stringify(mejor.sol) === JSON.stringify(n.sol);
  console.log(`${n.id}: ${igual ? 'igual que la guardada' : 'sol: ' + JSON.stringify(mejor.sol).replace(/"/g, "'")} · margen ${Math.round(mejor.m * 100)} % (${candidatos.length} de ${N} servían, ${Math.round(performance.now() - t0)} ms)`);
}
