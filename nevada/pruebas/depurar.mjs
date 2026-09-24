// Fotos de depuración: cada cosa sola desde una cámara puesta a mano.
//     node pruebas/depurar.mjs [--post]   → pruebas/salida/d-<nombre>.png y depurar.png
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { servir, navegador } from './servidor.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const conPost = process.argv.includes('--post');
const P = 1.06;   // caminoX(0): donde está el auto
const VISTAS = [
  ['auto-34', [P - 5.5, 1.6, 6.5], [P, 0.6, 0], ['auto']],
  ['auto-frente', [P + 0.4, 0.8, 7.5], [P, 0.6, 0], ['auto']],
  ['auto-atras', [P - 3.5, 1.0, -6.5], [P, 0.6, 0], ['auto']],
  ['parado', [P - 4.5, 1.0, 4.5], [P - 0.35, 0.6, 4.5], ['parado']],
  ['echado', [P - 1.2, 1.2, 8.5], [P - 1.75, 0.4, 4.1], ['echado']],
  ['ruge', [P - 1.2, 0.9, 7.2], [P - 1.9, 0.7, 4.1], ['ruge']],
  ['todo', [P - 9, 4.5, 13], [P, 0.5, 1], ['auto', 'echado']],
  ['bosque', [P, 1.6, 12], [P, 2.5, -30], ['auto']],
  ['arcilla-auto', [P - 5.5, 1.6, 6.5], [P, 0.6, 0], ['auto'], true],
  ['arcilla-parado', [P - 3, 1.0, 1], [P - 0.35, 0.6, 0], ['parado'], true],
];
const s = await servir(path.join(AQUI, '..', 'dist'));
const nav = await navegador();
const pag = await nav.newPage({ viewport: { width: 360, height: 640 } });
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
await pag.goto(`${s.url}/index.html?t=6&ancho=360${conPost ? '' : '&sinpost'}`);
await pag.waitForFunction(() => window.__N && window.__N.listo, null, { timeout: 300000 });
const fotos = [];
for (const [nombre, pos, mira, solo, arc] of VISTAS) {
  await pag.evaluate(([a]) => window.__N.arcilla(!!a), [arc]);
  await pag.evaluate(([so]) => window.__N.solo(so), [solo]);
  await pag.evaluate(([p, m]) => window.__N.mirar(p, m, 40), [pos, mira]);
  const f = path.join(SAL, `d-${nombre}.png`);
  await pag.locator('canvas').screenshot({ path: f });
  fotos.push(f);
}
if (errores.length) console.log('ERRORES:', [...new Set(errores)].join('\n'));
await nav.close(); s.cerrar();
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
fotos.forEach((f) => args.push('-i', f));
args.push('-filter_complex', fotos.map((_, i) => `[${i}]scale=240:427[s${i}]`).join(';') + ';' + fotos.map((_, i) => `[s${i}]`).join('') + `hstack=${fotos.length}`, path.join(SAL, 'depurar.png'));
spawnSync('ffmpeg', args);
console.log('listo: pruebas/salida/depurar.png');
