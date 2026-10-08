// pwa.py + web.js: el service worker, con un juego de mentira (sin datos de nadie).
//
//   node herramientas/porteo/prueba-pwa.mjs
//
// Arma versiones de un "juego" con un archivo que se guarda al instalar (motor.bin) y otro que se
// guarda al usarlo (mapa.bin, --perezosos), las sirve como Cloudflare Pages (ETag por contenido,
// max-age=0, /index.html → / con 308) cambiando de versión en caliente, y mira lo que pasa en el
// teléfono de alguien que ya lo abrió: que al publicar una versión nueva se use esa, bajando sólo
// lo que cambió; que nunca cambie a mitad de una partida (--espera); que ande sin internet; y que
// un archivo que no coincide con su huella no se guarde.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const AQUI = new URL('.', import.meta.url).pathname;
const T = mkdtempSync(join(tmpdir(), 'porteo-pwa-'));

let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

// ── las versiones ──
const ICONO = join(T, 'icono.png');
writeFileSync(ICONO, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const bytes = (n, semilla) => { const b = Buffer.alloc(n); let x = semilla * 2654435761 >>> 0; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; } return b; };
function version(n, { mapa = 1, motor = 1 } = {}) {
  const d = join(T, 'v' + n);
  mkdirSync(join(d, 'datos'), { recursive: true });
  writeFileSync(join(d, 'index.html'), `<!doctype html>
<html><head><meta charset="utf-8"><title>Prueba</title></head><body>
<script src="porteo-web.js"></script>
<script>
  window.VERSION = ${n};
  Porteo.web({ completa: false });
  Porteo.actualizar({ alAvanzar: (h, t) => { window.avance = (window.avance || []).concat([[h, t]]); } }).then(async (recargar) => {
    if (recargar) { location.reload(); return; }
    const motor = new Uint8Array(await (await fetch('datos/motor.bin')).arrayBuffer());
    const mapa = new Uint8Array(await (await fetch('datos/mapa.bin')).arrayBuffer());
    window.listo = { v: ${n}, motor: motor[0], mapa: mapa[0] };
  });
</script></body></html>
`);
  const m = bytes(1 << 20, motor); m[0] = motor;
  writeFileSync(join(d, 'datos', 'motor.bin'), m);
  const p = bytes(2 << 20, 100 + mapa); p[0] = mapa;
  writeFileSync(join(d, 'datos', 'mapa.bin'), p);
  execFileSync('python3', [join(AQUI, 'pwa.py'), d, '--nombre', 'Prueba', '--icono', ICONO, '--perezosos', 'datos/mapa*', '--espera']);
  return d;
}

// ── el hosting: como Cloudflare Pages ──
let sitio = null;
const pedidos = [];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const servidor = createServer((q, r) => {
  const ruta = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  pedidos.push(ruta);
  if (ruta === '/index.html') { r.writeHead(308, { Location: '/' }); r.end(); return; }
  const f = join(sitio, ruta === '/' ? 'index.html' : ruta);
  if (!f.startsWith(sitio) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const datos = readFileSync(f);
  const etag = '"' + createHash('sha1').update(datos).digest('hex') + '"';
  const h = { 'Content-Type': TIPOS[extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag };
  if (q.headers['if-none-match'] === etag) { r.writeHead(304, h); r.end(); return; }
  r.writeHead(200, h);
  r.end(datos);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const URL0 = `http://127.0.0.1:${servidor.address().port}/`;
const publicar = (d) => { sitio = d; pedidos.length = 0; };

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const c = await nav.newContext();
async function abrir(ruta = '') {
  const pg = await c.newPage();
  pg.errores = [];
  pg.on('pageerror', (e) => pg.errores.push(e.message));
  await pg.goto(URL0 + ruta);
  return pg;
}
async function hasta(pg, fn, ms = 20000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const v = await pg.evaluate(fn).catch(() => null);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
const listo = (pg) => hasta(pg, () => window.listo);
const guardado = (pg) => pg.evaluate(async () => {
  const r = [];
  for (const k of await caches.keys()) for (const q of await (await caches.open(k)).keys()) r.push(q.url.replace(location.origin, ''));
  return r;
});

try {
  const v1 = version(1), v2 = version(2), v3 = version(3, { mapa: 3 }), v4 = version(4, { mapa: 3 }), v5 = version(5, { mapa: 3, motor: 5 });
  // v5 publicada "a medias": el motor nuevo del servidor no es el que dice su sw.js (otra publicación en el medio)
  writeFileSync(join(v5, 'datos', 'motor.bin'), bytes(1 << 20, 99));

  // 1. primera visita y segunda (lo perezoso se guarda cuando ya pasa por el service worker)
  publicar(v1);
  let pg = await abrir();
  let l = await listo(pg);
  ch('primera visita', l && l.v === 1, JSON.stringify(l));
  await hasta(pg, () => !!navigator.serviceWorker.controller);
  await pg.close();
  pg = await abrir();
  l = await listo(pg);
  await pg.waitForTimeout(500);
  let g = await guardado(pg);
  ch('segunda visita: de lo guardado, con lo perezoso', l && l.v === 1 && g.some((u) => /mapa\.bin/.test(u)) && g.some((u) => /motor\.bin/.test(u)), g.join(' '));
  ch('index.html se guarda como ./', g.some((u) => /^\/\?porteo=/.test(u)) && !g.some((u) => /index\.html/.test(u)));
  await pg.close();

  // 2. se publica una versión que sólo cambia la página
  publicar(v2);
  pg = await abrir();
  l = await listo(pg);
  ch('al abrir, se usa la versión nueva', l && l.v === 2, JSON.stringify(l));
  const red = pedidos.filter((p) => p !== '/sw.js');
  ch('baja sólo lo que cambió', red.length === 1 && red[0] === '/', pedidos.join(' '));
  g = await guardado(pg);
  ch('lo perezoso de la versión anterior sigue guardado', g.some((u) => /mapa\.bin/.test(u)));
  ch('sin errores', pg.errores.length === 0, pg.errores.join(' | '));
  await pg.close();

  // 3. cambia un archivo perezoso: no se usa el guardado de antes
  publicar(v3);
  pg = await abrir();
  l = await listo(pg);
  ch('lo perezoso que cambió se baja de nuevo', l && l.v === 3 && l.mapa === 3, JSON.stringify(l));
  await pg.waitForTimeout(500);
  g = await guardado(pg);
  ch('y queda una sola copia guardada', g.filter((u) => /mapa\.bin/.test(u)).length === 1, g.filter((u) => /mapa/.test(u)).join(' '));
  await pg.close();

  // 4. sin internet
  await c.setOffline(true);
  pg = await abrir();
  l = await listo(pg);
  ch('sin internet: abre con lo guardado', l && l.v === 3, JSON.stringify(l));
  await pg.close();
  await c.setOffline(false);

  // 5. el ícono instalado abre ./index.html (que el hosting redirige a ./)
  pg = await abrir('index.html');
  l = await listo(pg);
  ch('/index.html abre (de lo guardado)', l && l.v === 3, JSON.stringify(l));

  // 6. una versión publicada con el juego abierto espera; al abrir de nuevo, pasa
  publicar(v4);
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  const espera = await hasta(pg, () => navigator.serviceWorker.getRegistration().then((r) => !!r.waiting));
  await pg.waitForTimeout(1000);
  ch('con el juego abierto, la nueva espera', espera && await pg.evaluate(() => window.VERSION === 3 && !!navigator.serviceWorker.controller));
  const otra = await abrir();
  l = await listo(otra);
  ch('al abrirlo de nuevo, pasa', l && l.v === 4, JSON.stringify(l) + (l ? '' : ' ' + JSON.stringify(await otra.evaluate(async () => {
    const sw = navigator.serviceWorker, r = await sw.getRegistration(), e = (w) => w && w.state;
    return { V: window.VERSION, control: e(sw.controller), activa: e(r.active), esperando: e(r.waiting), instalando: e(r.installing), avance: window.avance };
  }).catch((x) => String(x)))));
  ch('la pestaña que jugaba no se recargó', await pg.evaluate(() => window.VERSION === 3 && window.listo.v === 3));
  await otra.close();
  await pg.close();

  // 7. un archivo que no coincide con su huella: esa versión no se instala y se sigue con la anterior
  publicar(v5);
  pg = await abrir();
  l = await listo(pg);
  ch('archivo que no coincide: no se instala, se juega la anterior', l && l.v === 4 && l.motor === 1, JSON.stringify(l));
  g = await guardado(pg);
  ch('y no quedó guardado', g.filter((u) => /motor\.bin/.test(u)).length === 1, g.filter((u) => /motor/.test(u)).join(' '));
  await pg.close();
} finally {
  await nav.close();
  servidor.close();
  rmSync(T, { recursive: true, force: true });
}
console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
