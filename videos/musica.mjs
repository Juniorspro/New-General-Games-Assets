// Hace la música de un juego del motor 2D con su propio sintetizador → videos/medios/musica/<nombre>.wav
//     node videos/musica.mjs <nombre> <segundos> '<marcas JSON>' <scripts separados por coma> [modulo]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const [nombre, seg, marcas, scripts, modulo] = process.argv.slice(2);
const SAL = path.join(AQUI, 'medios/musica'); fs.mkdirSync(SAL, { recursive: true });
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/guardar') { const p = []; req.on('data', (c) => p.push(c)); req.on('end', () => { fs.writeFileSync(path.join(SAL, path.basename(u.searchParams.get('nombre'))), Buffer.concat(p)); res.end('ok'); }); return; }
  const f = path.join(RAIZ, decodeURIComponent(u.pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pag = await nav.newPage();
pag.on('console', (m) => console.log(m.text()));
pag.on('pageerror', (e) => console.log('ERROR', e.message));
await pag.goto(`http://127.0.0.1:${srv.address().port}/videos/musica.html?` + new URLSearchParams({ nombre, seg, marcas, scripts, ...(modulo ? { modulo: 1 } : {}) }));
await pag.waitForFunction(() => window.__terminado, null, { timeout: 300000, polling: 1000 });
console.log(JSON.stringify(await pag.evaluate(() => window.__terminado)));
await nav.close(); srv.close();
