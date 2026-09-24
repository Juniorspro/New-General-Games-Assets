// Una foto de la cinemática en cada instante pedido, sobre dist/ (lo armado).
//     node pruebas/fotos.mjs [t1 t2 …]        → pruebas/salida/f-<t>.png y hoja.png
// Sin tiempos, saca uno por plano.
import fs from 'node:fs';
import path from 'node:path';
import { servir, navegador } from './servidor.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const tiempos = process.argv.slice(2).filter((x) => !x.startsWith('--')).map(Number);
const lista = tiempos.length ? tiempos : [0.5, 1.5, 2.6, 3.5, 4.2, 4.9, 6.0, 7.2, 8.2, 9.3, 9.6, 10.7, 12.0, 13.5, 15.5, 17.4];
const ancho = +(process.argv.find((x) => x.startsWith('--ancho=')) || '--ancho=360').split('=')[1];
const s = await servir(path.join(AQUI, '..', 'dist'));
const nav = await navegador();
const pag = await nav.newPage({ viewport: { width: ancho, height: Math.round(ancho * 16 / 9) } });
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text()); });
pag.on('response', (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${r.url()}`); });
const t0 = Date.now();
await pag.goto(`${s.url}/index.html?t=${lista[0]}&ancho=${ancho}`);
await pag.waitForFunction(() => window.__N && window.__N.listo, null, { timeout: 300000 });
console.log(`cargó en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const fotos = [];
for (const t of lista) {
  const a = Date.now();
  const plano = await pag.evaluate((tt) => window.__N.irA(tt), t);
  const f = path.join(SAL, `f-${t}.png`);
  await pag.locator('canvas').screenshot({ path: f });
  fotos.push(f);
  console.log(`t=${t} plano ${plano} (${Date.now() - a} ms)`);
}
if (errores.length) console.log('ERRORES:\n' + [...new Set(errores)].slice(0, 12).join('\n'));
await nav.close(); s.cerrar();
// la hoja: todas juntas
const { spawnSync } = await import('node:child_process');
const cols = Math.min(8, fotos.length), filas = Math.ceil(fotos.length / cols);
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
fotos.forEach((f) => args.push('-i', f));
let fc = fotos.map((_, i) => `[${i}]scale=180:320[s${i}]`).join(';') + ';';
for (let r = 0; r < filas; r++) {
  const fila = fotos.slice(r * cols, r * cols + cols).map((_, k) => `[s${r * cols + k}]`).join('');
  const n = Math.min(cols, fotos.length - r * cols);
  fc += n > 1 ? `${fila}${n < cols ? `pad=${180 * n}:320` : ''}hstack=${n}[f${r}];` : `${fila}copy[f${r}];`;
}
// completar la última fila si quedó corta
fc = fc.replace(/pad=\d+:320hstack=(\d+)\[f(\d+)\];$/, (m, n, r) => `hstack=${n},pad=${180 * cols}:320[f${r}];`);
fc += filas > 1 ? `${Array.from({ length: filas }, (_, r) => `[f${r}]`).join('')}vstack=${filas}` : '[f0]copy';
args.push('-filter_complex', fc, path.join(SAL, 'hoja.png'));
const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
if (r.status) console.log(r.stderr);
else console.log('hoja: pruebas/salida/hoja.png');
