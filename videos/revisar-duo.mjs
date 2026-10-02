// La línea de tiempo de un dúo (duos.js + lineas.json), sin abrir Remotion: cuándo empieza
// cada línea, qué pedazo de cada toma muestra cada plano y cuándo salta cada extra. Avisa si un
// plano le pide a su toma más de lo que se grabó.
//     node videos/revisar-duo.mjs <id>        (globo-vibora, morfi-cripta, isla-grumo)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const req = createRequire(path.join(AQUI, 'remotion/package.json'));
const esbuild = req('esbuild');
const id = process.argv[2];
/* armarDuo vive en Duo.jsx: se empaqueta solo, con React y Remotion adentro, y se importa */
const sal = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'duo-')), 'duo.mjs');
await esbuild.build({ entryPoints: [path.join(AQUI, 'remotion/src/Duo.jsx')], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile: sal, logLevel: 'error', loader: { '.js': 'jsx' } });
const { armarDuo } = await import(sal);
const { lineas } = JSON.parse(fs.readFileSync(path.join(AQUI, 'medios/voz', id, 'lineas.json'), 'utf8'));
const A = armarDuo(id, lineas);
const largo = (toma) => { try { return JSON.parse(fs.readFileSync(path.join(AQUI, 'medios/tomas', toma + '.datos.json'), 'utf8')).length / 30; } catch { return null; } };
const s = (x) => x.toFixed(2).padStart(6);
let malos = 0;
const mirar = (toma, desde, dur, que) => {
  const L = largo(toma), hasta = desde + dur;
  const mal = L !== null && hasta > L + 0.02;
  if (mal) malos++;
  console.log(`    ${que.padEnd(9)} ${toma.padEnd(18)} toma ${s(desde)} → ${s(hasta)}${L === null ? '  (sin datos)' : `  de ${L.toFixed(1)}`}${mal ? '   ← SE PASA' : ''}`);
};
for (const l of A.L) {
  console.log(`${String(l.i + 1).padStart(2)} ${s(l.ini)} → ${s(l.fin)}  [${l.juego}${l.forma ? ' ' + l.forma : ''}] ${l.texto}`);
  for (const P of l.planos) mirar(P.toma, P.desde, P.t1 - P.t0, s(P.t0).trim() + ' s');
  if (l.forma === 'partida') {
    const dur = l.fin - l.ini + (l.i === A.L.length - 1 ? A.cierre.fin - A.cierre.ini : 0);
    /* cada mitad: una toma, o una tira de tomas con su duración (la última se lleva lo que falta) */
    for (const [k, p] of [['arriba', l.arriba], ['abajo', l.abajo]]) {
      if (!p) continue;
      const tira = Array.isArray(p[0]) ? p : [p];
      let falta = dur;
      tira.forEach((m, i) => { const d = i < tira.length - 1 ? m[3] : falta; mirar(m[0], m[1], d, k); falta -= d; });
    }
  }
  for (const e of l.extras) console.log(`    ${('· ' + s(e.t0).trim() + ' s').padEnd(9)} ${e.tipo} ${e.texto || e.campo || ''}`);
}
console.log(`cierre ${s(A.cierre.ini)} → ${s(A.cierre.fin)}   total ${(A.total / 30).toFixed(2)} s${A.corte !== null ? `   cortina en ${A.corte.toFixed(2)} s` : ''}`);
if (malos) { console.log(`${malos} plano(s) se pasan de su toma`); process.exitCode = 1; }
