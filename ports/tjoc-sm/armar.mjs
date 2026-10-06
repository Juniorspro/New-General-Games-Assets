// Arma dist/: js empaquetado con esbuild (three del repo), html, css y datos.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = '/home/user/New-General-Games-Assets';
const esbuild = createRequire(path.join(REPO, 'videos/remotion/package.json'))('esbuild');
const WEB = path.join(AQUI, 'web'), DIST = path.join(AQUI, process.env.DIST || 'dist');
fs.mkdirSync(DIST, { recursive: true });
for (const [ent, sal] of [['js/main.js', 'juego.js'], ['js/ver.js', 'ver.js'], ['js/prueba.js', 'prueba.js']]) {
  if (!fs.existsSync(path.join(WEB, ent))) continue;
  await esbuild.build({ entryPoints: [path.join(WEB, ent)], bundle: true, format: 'esm', minify: !process.env.SIN_MIN, target: 'es2022',
    outfile: path.join(DIST, sal), nodePaths: [path.join(REPO, 'bosque/node_modules')], logLevel: 'error', legalComments: 'none' });
}
for (const f of fs.readdirSync(WEB)) {
  if (f.endsWith('.html')) fs.writeFileSync(path.join(DIST, f), fs.readFileSync(path.join(WEB, f), 'utf8').replace(/src="js\/main\.js"/, 'src="juego.js"').replace(/src="js\/ver\.js"/, 'src="ver.js"').replace(/src="js\/prueba\.js"/, 'src="prueba.js"'));
  else if (f.endsWith('.css')) fs.copyFileSync(path.join(WEB, f), path.join(DIST, f));
}
const dd = path.join(DIST, 'datos');
if (!fs.existsSync(dd)) fs.symlinkSync(path.join(WEB, 'datos'), dd);
console.log('armado', DIST);
