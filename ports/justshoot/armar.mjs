// Arma el port de Just Shoot: dist/ (para servir por http) y, con UNICO=1, salida/justshoot.html: un solo archivo
// con el motor (BananaBread compilado por Error Panic) y los paquetes de datos adentro (base64, con gzip).
//     node armar.mjs   ·   UNICO=1 node armar.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const WEB = path.join(AQUI, 'web'), DIST = path.join(AQUI, 'dist');
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(WEB, DIST, { recursive: true, filter: (f) => !f.includes('/datos') && !f.includes('/motor') });
// el motor y los paquetes, al lado de la página (así los pide Emscripten)
const ARCH = {};
for (const f of fs.readdirSync(path.join(WEB, 'motor'))) ARCH[f] = path.join(WEB, 'motor', f);
for (const f of fs.readdirSync(path.join(WEB, 'datos'))) if (f.endsWith('.data')) ARCH[f] = path.join(WEB, 'datos', f);
for (const f of fs.readdirSync(path.join(WEB, 'datos', 'game'))) ARCH[f] = path.join(WEB, 'datos', 'game', f);
for (const [n, f] of Object.entries(ARCH)) fs.copyFileSync(f, path.join(DIST, n));
console.log('dist:', Object.keys(ARCH).join(' '));

if (process.env.UNICO) {
  const TIPO = { js: 'text/javascript', data: 'application/octet-stream', mem: 'application/octet-stream' };
  const emb = {}; let crudo = 0;
  for (const [n, f] of Object.entries(ARCH)) {
    const b = fs.readFileSync(f); crudo += b.length;
    const z = zlib.gzipSync(b, { level: 9 });
    emb[n] = { b: z.toString('base64'), z: 1, t: TIPO[n.split('.').pop()] || 'application/octet-stream' };
  }
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(WEB, 'justshoot.css'), 'utf8');
  const js = (n) => fs.readFileSync(path.join(WEB, 'js', n), 'utf8').replace(/<\/script/gi, '<\\/script');
  const pagina = html
    .replace(/src="img\/([\w.-]+)"/g, (_, f) => `src="data:image/webp;base64,${fs.readFileSync(path.join(WEB, 'img', f)).toString('base64')}"`)
    .replace('<link rel="stylesheet" href="justshoot.css">', () => `<style>${css}</style>`)
    .replace('<script src="js/shell.js"></script>', () => `<script>window.__EMBEBIDOS=${JSON.stringify(emb)};</script>\n<script>${js('shell.js')}</script>`)
    .replace('<script src="js/tactil.js"></script>', () => `<script>${js('tactil.js')}</script>`)
    .replace('<script src="js/inicio.js"></script>', () => `<script>${js('inicio.js')}</script>`);
  fs.mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
  const dest = path.join(AQUI, 'salida/justshoot.html');
  fs.writeFileSync(dest, pagina);
  console.log(`${dest}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB (${(crudo / 1048576).toFixed(1)} MB sin comprimir)`);
}
