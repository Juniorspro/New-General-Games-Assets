// BARRO en un solo archivo: js/ empaquetado con esbuild (IIFE), el arte (arte/*.webp) y la
// letra metidos como data:, y el CSS adentro. Sale barro/barro.html, que abre con doble clic.
//     node barro/herramientas/armar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.join(AQUI, '..');
const req = createRequire(path.join(RAIZ, '../videos/remotion/package.json'));
const esbuild = req('esbuild');

const dataURI = (f, tipo) => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`;
const arte = {};
for (const f of fs.readdirSync(path.join(RAIZ, 'arte'))) if (f.endsWith('.webp')) arte[f.replace('.webp', '')] = dataURI(path.join(RAIZ, 'arte', f), 'image/webp');

const embebido = {
  name: 'arte-embebido',
  setup(b) {
    b.onResolve({ filter: /arte-urls\.js$/ }, () => ({ path: 'arte-urls', namespace: 'arte' }));
    b.onLoad({ filter: /.*/, namespace: 'arte' }, () => ({ contents: `export default ${JSON.stringify(arte)};`, loader: 'js' }));
  },
};
const r = await esbuild.build({ entryPoints: [path.join(RAIZ, 'js/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', plugins: [embebido], logLevel: 'error' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(RAIZ, 'barro.css'), 'utf8').replace("url('arte/barlow.woff2')", `url('${dataURI(path.join(RAIZ, 'arte/barlow.woff2'), 'font/woff2')}')`);
let html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="barro.css">', () => `<style>${css}</style>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>${js}</script>`);
const dest = path.join(RAIZ, 'barro.html');
fs.writeFileSync(dest, html);
console.log(`barro.html: ${(fs.statSync(dest).size / 1048576).toFixed(2)} MB (${Object.keys(arte).length} imágenes)`);
