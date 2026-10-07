// Arma el port: js/ empaquetado (esbuild) en dist/juego.js, más index.html, fnaf2.css, img/ (la moneda de JXStudios)
// y datos/ (enlazado).
// Con UNICO=1 además arma salida/fnaf2.html: un solo archivo que abre con doble clic (datos en base64;
// el JSON comprimido con gzip; las imágenes .webp y los sonidos .ogg tal cual).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = '/home/user/New-General-Games-Assets';
const esbuild = createRequire(path.join(REPO, 'videos/remotion/package.json'))('esbuild');
const WEB = path.join(AQUI, 'web'), DIST = path.join(AQUI, 'dist');
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
await esbuild.build({ entryPoints: [path.join(WEB, 'js/main.js')], bundle: true, format: 'iife', minify: !process.env.SIN_MIN, target: 'es2020', outfile: path.join(DIST, 'juego.js'), logLevel: 'error', legalComments: 'none' });
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(WEB, 'fnaf2.css'), 'utf8');
fs.writeFileSync(path.join(DIST, 'index.html'), html.replace('<script type="module" src="js/main.js"></script>', '<script src="juego.js"></script>'));
fs.writeFileSync(path.join(DIST, 'fnaf2.css'), css);
fs.symlinkSync(path.join(WEB, 'datos'), path.join(DIST, 'datos'));
fs.cpSync(path.join(WEB, 'img'), path.join(DIST, 'img'), { recursive: true });
console.log('dist listo, juego.js', (fs.statSync(path.join(DIST, 'juego.js')).size / 1024).toFixed(0), 'KB');
if (process.env.UNICO) {
  const D = path.join(WEB, 'datos'), emb = {}; let crudo = 0;
  const TIPO = { webp: 'image/webp', ogg: 'audio/ogg', json: 'application/json', png: 'image/png' };
  const agregar = (rel) => { const b = fs.readFileSync(path.join(D, rel)); crudo += b.length; const ext = rel.split('.').pop(), z = ext === 'json'; emb['datos/' + rel] = { b: (z ? zlib.gzipSync(b, { level: 9 }) : b).toString('base64'), z: z ? 1 : 0, t: TIPO[ext] }; };
  for (const f of ['juego.json', 'textos.json']) if (fs.existsSync(path.join(D, f))) agregar(f);
  for (const dir of ['img', 'snd', 'tr']) if (fs.existsSync(path.join(D, dir))) for (const f of fs.readdirSync(path.join(D, dir)).sort()) agregar(dir + '/' + f);
  const juego = fs.readFileSync(path.join(DIST, 'juego.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const conImgs = html.replace(/src="img\/([\w.-]+)"/g, (_, f) => `src="data:image/webp;base64,${fs.readFileSync(path.join(WEB, 'img', f)).toString('base64')}"`);
  const pagina = conImgs.replace('<link rel="stylesheet" href="fnaf2.css">', () => `<style>${css}</style>`)
    .replace('<script type="module" src="js/main.js"></script>', () => `<script>window.__EMBEBIDOS=${JSON.stringify(emb)};</script>\n<script>${juego}</script>`);
  fs.mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
  const dest = path.join(AQUI, 'salida/fnaf2.html'); fs.writeFileSync(dest, pagina);
  console.log(`${dest}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB (${Object.keys(emb).length} archivos, ${(crudo / 1048576).toFixed(1)} MB sin base64)`);
}
