// Fotos sueltas de una composición, para revisar arreglos sin renderizar el video entero:
// un solo navegador, una foto por segundo pedido, y una hoja de contactos con todas.
//     node videos/fotos.mjs <Composición> <id> 3,7.5,13 [--publico=../salida/publico]
//   → videos/salida/pruebas/<id>-fotos.jpg (y cada foto suelta en salida/pruebas/fotos-<id>/)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const req = createRequire(path.join(AQUI, 'remotion/package.json'));
const { bundle } = req('@remotion/bundler');
const { selectComposition, renderStill, openBrowser } = req('@remotion/renderer');
const [comp, id, lista] = process.argv.slice(2);
const publico = path.resolve(AQUI, 'remotion', (process.argv.find((a) => a.startsWith('--publico=')) || '').split('=')[1] || '../salida/publico');
const SAL = path.join(AQUI, 'salida/pruebas', `fotos-${id}`);
fs.rmSync(SAL, { recursive: true, force: true }); fs.mkdirSync(SAL, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(AQUI, 'remotion/src/index.jsx'), publicDir: publico });
const browser = await openBrowser('chrome', { browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', chromiumOptions: { gl: 'swangle' } });
const inputProps = { id };
const composition = await selectComposition({ serveUrl, id: comp, inputProps, puppeteerInstance: browser });
const fotos = [];
for (const s of lista.split(',').map(Number)) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
  const output = path.join(SAL, `${String(frame).padStart(5, '0')}.jpg`);
  await renderStill({ composition, serveUrl, output, frame, inputProps, imageFormat: 'jpeg', jpegQuality: 85, puppeteerInstance: browser });
  fotos.push(output);
  console.log(`${s} s → cuadro ${frame}`);
}
await browser.close({ silent: true });
const hoja = path.join(AQUI, 'salida/pruebas', `${id}-fotos.jpg`);
/* celdas chicas: una hoja grande cuesta muchos tokens al mirarla (memoria/ahorro.md) */
spawnSync('montage', [...fotos, '-tile', `${Math.min(6, fotos.length)}x`, '-geometry', '240x427+2+2', hoja]);
console.log('→', path.relative(path.join(AQUI, '..'), hoja));
