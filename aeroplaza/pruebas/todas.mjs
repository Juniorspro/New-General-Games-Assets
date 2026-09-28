// LA TANDA: todas las pruebas del juego, varias a la vez (antes, una atrás de la otra: ~21 min).
// (Tres a la vez ganan poco: el dibujo por software ya usa todos los núcleos. Lo que más ahorró fue
// no dibujar en las pruebas que no miran la imagen: voz, multijugador, dedos, juegos; comun.mjs ›
// avanzar(…, false))
//     node aeroplaza/pruebas/todas.mjs [--manos] [--a-la-vez=3] [nombre …]
//   --manos     también las de las manos y el VR (manos, manos-celu, nativo, espacio, lentes, camara, malla, cabeza, choque, ancha, vr, vr-juego, vrbox, actualizar, xr, vr120, manos-directo)
//   --a-la-vez  cuántas corren juntas (de entrada, los núcleos menos uno, entre 2 y 4)
//   nombre …    solo esas (por ejemplo: node pruebas/todas.mjs voz menus)
// - Van primero las más largas, así las cortas llenan los huecos del final.
// - Las que miden tiempos de verdad (manos-directo: lo que tarda MediaPipe) corren solas, al final.
// - La que falla con otras corriendo se vuelve a correr sola, y se dice: si sola da bien, fue la carga
//   de la máquina (el dibujo es por software), no el juego.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
/* (de la más larga a la más corta, medido en el contenedor de 4 núcleos, en segundos) */
const TANDA = [['mundo', 113], ['interiores', 83], ['reinos', 72], ['parkour', 70], ['avisos', 68], ['menus', 66], ['multijugador', 64], ['flujo', 60], ['primera', 54],
  ['canciones', 50], ['voz', 47], ['teclado', 36], ['dedos', 35], ['estilos', 32], ['runner', 31], ['resiste', 22], ['muneco', 19], ['juegos', 14], ['delfin', 12], ['movimientos', 9], ['construcciones', 9], ['caminos', 5]];
const MANOS = [['vr120', 74], ['xr', 57], ['vr', 47], ['manos', 43], ['espacio', 40], ['lentes', 30], ['nativo', 30], ['camara', 30], ['malla', 45], ['cabeza', 30], ['mando', 5], ['choque', 20], ['ancha', 25], ['vr-juego', 55], ['vrbox', 30], ['actualizar', 30], ['manos-celu', 15]];
const SOLAS = ['manos-directo'];

const args = process.argv.slice(2), conManos = args.includes('--manos');
const n = +(args.find((a) => a.startsWith('--a-la-vez='))?.split('=')[1] || Math.min(4, Math.max(2, os.cpus().length - 1)));
const pedidas = args.filter((a) => !a.startsWith('--'));
let lista = [...TANDA, ...(conManos ? MANOS : [])].sort((a, b) => b[1] - a[1]).map(([x]) => x), solas = conManos ? SOLAS : [];
if (pedidas.length) { lista = pedidas.filter((x) => !SOLAS.includes(x)); solas = pedidas.filter((x) => SOLAS.includes(x)); }

const correr = (nombre) => new Promise((ok) => {
  const t0 = Date.now(), hijo = spawn(process.execPath, [path.join(AQUI, nombre + '.mjs')], { cwd: path.dirname(AQUI) });
  let salida = '';
  hijo.stdout.on('data', (d) => { salida += d; }); hijo.stderr.on('data', (d) => { salida += d; });
  const reloj = setTimeout(() => hijo.kill('SIGKILL'), 900000);
  hijo.on('close', (codigo) => {
    clearTimeout(reloj);
    const lineas = salida.split('\n'), mal = lineas.filter((l) => /✗|Error|error:/.test(l) && !/sin errores/.test(l)).slice(0, 6), cuenta = lineas.filter((l) => /\d+ bien, \d+ mal/.test(l)).pop() || '';
    ok({ nombre, codigo, s: Math.round((Date.now() - t0) / 1000), mal, cuenta: cuenta.trim() });
  });
});
const mostrar = (r, nota = '') => { console.log(`${r.codigo === 0 ? '✓' : '✗'} ${r.nombre} (${r.s} s)${r.cuenta ? ' · ' + r.cuenta : ''}${nota}`); if (r.codigo !== 0) for (const l of r.mal) console.log('    ' + l.trim().slice(0, 300)); };

const t0 = Date.now(), res = [], cola = lista.slice();
console.log(`${lista.length + solas.length} pruebas, ${n} a la vez${solas.length ? ` (y ${solas.join(', ')} sola al final)` : ''}`);
await Promise.all(Array.from({ length: n }, async () => { while (cola.length) { const r = await correr(cola.shift()); mostrar(r); res.push(r); } }));
for (const x of solas) { const r = await correr(x); mostrar(r); res.push(r); }
/* las que fallaron acompañadas: otra vez, solas */
const falladas = res.filter((r) => r.codigo !== 0), otra = [];
for (const r of falladas) { const r2 = await correr(r.nombre); otra.push(r2); mostrar(r2, r2.codigo === 0 ? ' · sola, bien: fue la carga de la máquina' : ' · sola, también mal'); }
const malDeVerdad = otra.filter((r) => r.codigo !== 0);
console.log(`\n${res.length - falladas.length} de ${res.length} bien a la primera${falladas.length ? `; ${falladas.length - malDeVerdad.length} más bien solas` : ''}${malDeVerdad.length ? `; MAL: ${malDeVerdad.map((r) => r.nombre).join(', ')}` : ''} · ${Math.round((Date.now() - t0) / 60000 * 10) / 10} min`);
console.log('FIN');
process.exit(malDeVerdad.length ? 1 : 0);
