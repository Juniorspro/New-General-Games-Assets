// Arma las portadas: la ilustración (ilustraciones/<juego>.png, bajada de
// Rezona con generar.py) + el título y el logo JXS dibujados con el código
// de cada juego (componer.js). Deja salida/portada-<juego>.png (1024 × 1536).
//   (desde la raíz del repo) python3 -m http.server 8123 --bind 127.0.0.1 &
//   node herramientas/portadas/componer.mjs [morfi cripta ...]
// Las letras (Lilita One y Luckiest Guy, de Google Fonts) se bajan con curl:
// el Chromium de acá no confía en el certificado del proxy para esas fuentes
// (ERR_CERT_AUTHORITY_INVALID) y la verificación no se apaga nunca.
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
const DIR = new URL('.', import.meta.url).pathname;
const juegos = process.argv.slice(2).length ? process.argv.slice(2) : ['morfi', 'cripta', 'vibora', 'globo', 'isla', 'bomba'];
mkdirSync(DIR + 'fuentes', { recursive: true }); mkdirSync(DIR + 'salida', { recursive: true });
if (!existsSync(DIR + 'fuentes/lilita.woff2') || !existsSync(DIR + 'fuentes/luckiest.woff2')) {
  const css = execSync(`curl -s -A "Mozilla/5.0 Chrome/124.0" "https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Lilita+One&display=swap"`).toString();
  // de cada familia, el último archivo es el de las letras latinas básicas
  const url = (fam) => [...css.matchAll(new RegExp(`font-family: '${fam}'[\\s\\S]*?url\\((https://[^)]+)\\)`, 'g'))].map((m) => m[1]).at(-1);
  execSync(`curl -s -o "${DIR}fuentes/lilita.woff2" "${url('Lilita One')}"`);
  execSync(`curl -s -o "${DIR}fuentes/luckiest.woff2" "${url('Luckiest Guy')}"`);
}
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 1024, height: 1536 }, deviceScaleFactor: 1 });
// lo de la portada se sirve desde el mismo origen que los juegos (los módulos se importan de ahí)
await ctx.route('http://127.0.0.1:8123/__portadas/**', (r) => {
  const rel = new URL(r.request().url()).pathname.replace('/__portadas/', '');
  const f = rel.startsWith('img/') ? `${DIR}ilustraciones/${rel.slice(4)}` : DIR + rel;
  if (!existsSync(f)) return r.fulfill({ status: 404, body: 'no está ' + rel });
  const tipo = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'image/png';
  r.fulfill({ status: 200, contentType: tipo, body: readFileSync(f) });
});
for (const j of juegos) {
  const pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pg.goto(`http://127.0.0.1:8123/__portadas/componer.html?juego=${j}`);
  const r = await pg.waitForFunction(() => window.listo, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch((e) => 'ERROR ' + e);
  if (String(r).startsWith('data:image/png')) {
    writeFileSync(`${DIR}salida/portada-${j}.png`, Buffer.from(r.split(',')[1], 'base64'));
    console.log('ok', j, errores.length ? 'errores: ' + errores.join(' | ') : '');
  } else console.log('FALLA', j, String(r).slice(0, 400), errores.join(' | '));
  await pg.close();
}
await nav.close();
