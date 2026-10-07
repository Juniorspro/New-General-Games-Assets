// Arma el port: js/ con three empaquetado (esbuild) en dist/juego.js, más index.html, baldi.css y datos/
// (enlazado). Con UNICO=1 además arma salida/baldi.html: un solo archivo que abre con doble clic, con todo
// adentro (los datos en base64; los JSON y los .bin comprimidos con gzip).
//     node armar.mjs            → dist/
//     UNICO=1 node armar.mjs    → dist/ y salida/baldi.html
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = '/home/user/New-General-Games-Assets';
const esbuild = createRequire(path.join(REPO, 'videos/remotion/package.json'))('esbuild');
const WEB = path.join(AQUI, 'web'), DIST = path.join(AQUI, 'dist');
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(WEB, 'js/main.js')], bundle: true, format: 'iife', minify: !process.env.SIN_MIN, target: 'es2020', keepNames: true,
  outfile: path.join(DIST, 'juego.js'), nodePaths: [path.join(REPO, 'bosque/node_modules')], logLevel: 'error', legalComments: 'none',
});
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'baldi.css'), 'utf8');
fs.writeFileSync(path.join(DIST, 'index.html'), html.replace('<script type="module" src="js/main.js"></script>', '<script src="juego.js"></script>'));
fs.writeFileSync(path.join(DIST, 'baldi.css'), css);
fs.symlinkSync(path.join(WEB, 'datos'), path.join(DIST, 'datos'));
fs.cpSync(path.join(WEB, 'img'), path.join(DIST, 'img'), { recursive: true });
console.log(`dist: juego.js ${(fs.statSync(path.join(DIST, 'juego.js')).size / 1024).toFixed(0)} KB`);

if (process.env.UNICO) {
  // solo lo que el juego pide: comun.json nombra texturas, audios y fuentes; cada escena, su navmesh
  const D = path.join(WEB, 'datos');
  const C = JSON.parse(fs.readFileSync(path.join(D, 'comun.json'), 'utf8'));
  const usados = new Set(['comun.json', 'mallas.bin']);
  for (const t of Object.values(C.texs)) if (t.arch) usados.add(t.arch);
  for (const [id, a] of Object.entries(C.audios)) if (a.ok) usados.add(id + '.ogg');
  for (const f of Object.values(C.fuentes)) if (f.arch) usados.add(f.arch);
  for (const f of fs.readdirSync(D)) if (/^(escena-\d+\.json|nav-\d+\.bin)$/.test(f)) usados.add(f);
  const TIPO = { webp: 'image/webp', ogg: 'audio/ogg', json: 'application/json', bin: 'application/octet-stream', ttf: 'font/ttf' };
  const emb = {};
  let crudo = 0;
  for (const f of [...usados].sort()) {
    const p = path.join(D, f);
    if (!fs.existsSync(p)) { console.warn('falta', f); continue; }
    const b = fs.readFileSync(p); crudo += b.length;
    const ext = f.split('.').pop(), z = ext === 'json' || ext === 'bin' || ext === 'ttf';
    emb['datos/' + f] = { b: (z ? zlib.gzipSync(b, { level: 9 }) : b).toString('base64'), z: z ? 1 : 0, t: TIPO[ext] };
  }
  const juego = fs.readFileSync(path.join(DIST, 'juego.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  // (reemplazos con función: los $ del código minificado no son patrones)
  const pagina = html.replace(/src="img\/([\w.-]+)"/g, (_, f) => `src="data:image/webp;base64,${fs.readFileSync(path.join(WEB, 'img', f)).toString('base64')}"`)
    .replace('<link rel="stylesheet" href="baldi.css">', () => `<style>${css}</style>`)
    .replace('<script type="module" src="js/main.js"></script>', () => `<script>window.__EMBEBIDOS=${JSON.stringify(emb)};</script>\n<script>${juego}</script>`);
  fs.mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
  const dest = path.join(AQUI, 'salida/baldi.html');
  fs.writeFileSync(dest, pagina);
  console.log(`${dest}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB (${Object.keys(emb).length} archivos, ${(crudo / 1048576).toFixed(1)} MB sin comprimir)`);
}
