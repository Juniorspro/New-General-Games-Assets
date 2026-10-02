// Las portadas de los tres dúos: saca con ffmpeg los cuadros que pide remotion/src/portadasDuo.js
// (a salida/publico/fotos/) y dibuja los Still PortadaGloboVibora, PortadaMorfiCripta y
// PortadaIslaGrumo a salida/<Still>.png (+ .jpg para mandar).
//     node videos/portadas-duo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PD, foto } from './remotion/src/portadasDuo.js';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const req = createRequire(path.join(AQUI, 'remotion/package.json'));
const { bundle } = req('@remotion/bundler');
const { selectComposition, renderStill, openBrowser } = req('@remotion/renderer');
const PUBLICO = path.join(AQUI, 'salida/publico'), FOTOS = path.join(PUBLICO, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
for (const D of Object.values(PD)) {
  for (const [toma, seg] of [...D.cartas, ...D.fondo]) {
    const dest = path.join(FOTOS, foto(toma, seg));
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seg), '-i', path.join(AQUI, 'medios/tomas', toma + '.mp4'), '-frames:v', '1', '-q:v', '2', dest]);
    if (r.status !== 0 || !fs.existsSync(dest)) throw new Error(`no salió el cuadro ${toma} a ${seg} s: ${r.stderr}`);
  }
}
const serveUrl = await bundle({ entryPoint: path.join(AQUI, 'remotion/src/index.jsx'), publicDir: PUBLICO });
const browser = await openBrowser('chrome', { browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', chromiumOptions: { gl: 'swangle' } });
const NOMBRES = { 'globo-vibora': 'PortadaGloboVibora', 'morfi-cripta': 'PortadaMorfiCripta', 'isla-grumo': 'PortadaIslaGrumo' };
for (const [id, comp] of Object.entries(NOMBRES)) {
  const inputProps = { id };
  const composition = await selectComposition({ serveUrl, id: comp, inputProps, puppeteerInstance: browser });
  const png = path.join(AQUI, 'salida', comp + '.png');
  await renderStill({ composition, serveUrl, output: png, frame: 0, inputProps, imageFormat: 'png', puppeteerInstance: browser });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '2', png.replace(/\.png$/, '.jpg')]);
  console.log(comp, '→', path.relative(path.join(AQUI, '..'), png));
}
await browser.close({ silent: true });
