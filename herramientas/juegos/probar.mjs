// Abre un juego en Chromium sin internet: los pedidos a jsdelivr se sirven
// desde /opt/gamekit/node_modules. Juega unos segundos y saca captura + errores.
//   node probar.mjs juego.html captura.png
import { chromium } from '/opt/gamekit/node_modules/playwright-core/index.mjs';
import { readFileSync, existsSync } from 'fs';
const [html, png = 'captura.png'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errores = []; pg.on('pageerror', e => errores.push(e.message)); pg.on('console', m => m.type() === 'error' && errores.push(m.text()));
await pg.route('https://cdn.jsdelivr.net/npm/**', r => {
  const m = new URL(r.request().url()).pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)(?:@[^/]+)?\/(.*)$/);
  const f = m && `/opt/gamekit/node_modules/${m[1]}/${m[2]}`;
  return f && existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: 'application/javascript' }) : r.abort();
});
await pg.goto('file://' + html);
await pg.waitForTimeout(1500);
for (const [tecla, ms] of [['KeyD', 900], ['Space', 200], ['KeyD', 700], ['KeyW', 600]]) { await pg.keyboard.down(tecla); await pg.waitForTimeout(ms); await pg.keyboard.up(tecla); }
const fps = await pg.evaluate(() => new Promise(ok => { let n = 0; const t0 = performance.now(); (function f() { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(f) : ok(n); })(); }));
console.log(JSON.stringify({ estado: await pg.evaluate(() => window.__estado?.()), fps, errores }));
await pg.screenshot({ path: png }); await b.close();
