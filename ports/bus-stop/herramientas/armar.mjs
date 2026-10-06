// Arma el port: js/ con three empaquetado (esbuild) en dist/juego.js, más index.html, bus.css y datos/.
//     node herramientas/armar.mjs      → dist/ (hace falta web/datos: herramientas/exportar.py)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.join(AQUI, '../../..');
const esbuild = createRequire(path.join(REPO, 'videos/remotion/package.json'))('esbuild');
const WEB = path.join(AQUI, '../web'), DIST = path.join(AQUI, '../dist');
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(WEB, 'js/main.js')], bundle: true, format: 'iife', minify: true, target: 'es2020',
  outfile: path.join(DIST, 'juego.js'), nodePaths: [path.join(REPO, 'bosque/node_modules')], logLevel: 'error', legalComments: 'none',
});
fs.writeFileSync(path.join(DIST, 'index.html'), fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace('<script type="module" src="js/main.js"></script>', '<script src="juego.js"></script>'));
fs.copyFileSync(path.join(WEB, 'bus.css'), path.join(DIST, 'bus.css'));
fs.cpSync(path.join(WEB, 'datos'), path.join(DIST, 'datos'), { recursive: true });
let tot = 0; const pesar = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) pesar(p); else tot += fs.statSync(p).size; } }; pesar(DIST);
console.log(`dist: ${(tot / 1048576).toFixed(1)} MB, juego.js ${(fs.statSync(path.join(DIST, 'juego.js')).size / 1024).toFixed(0)} KB`);
