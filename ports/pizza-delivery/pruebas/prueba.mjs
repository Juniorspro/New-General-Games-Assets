// Prueba rápida: menú, entrar a la casa, fotos chicas.   DBG='expr' node prueba.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
(await import('node:fs')).mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
const PUERTO = 18000 + Math.floor(Math.random() * 2000);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, '../dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('requestfailed', (r) => errores.push('FALLÓ ' + r.url().split('/').pop() + ' ' + r.failure()?.errorText));
p.on('response', (r) => { if (r.status() >= 400) errores.push('HTTP ' + r.status() + ' ' + r.url().split('/').pop()); });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text().slice(0, 300)); });
const t0 = Date.now();
await p.addInitScript(() => { if (!localStorage.getItem('pizza.v1')) localStorage.setItem('pizza.v1', JSON.stringify({ idioma: 'es' })); });
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
try { await p.waitForFunction(() => window.__pizza?.listo, null, { timeout: 180000 }); }
catch { console.log('NO CARGÓ', await p.evaluate(() => document.body.innerText.slice(0, 300))); console.log([...new Set(errores)].slice(0, 10).join('\n')); await b.close(); srv.kill(); process.exit(1); }
console.log('carga', ((Date.now() - t0) / 1000).toFixed(1), 's');
const foto = (n) => p.screenshot({ path: path.join(AQUI, 'salida', n + '.jpg'), type: 'jpeg', quality: 55 });
await p.waitForTimeout(1500); await foto('menu');
if (process.env.NIVEL !== 'menu') {
  const t1 = Date.now();
  await p.click('[data-b="jugar"]');
  try { await p.waitForFunction(() => __pizza.modo === 'jugando' && !__pizza.J.cargando, null, { timeout: +(process.env.ESPERA || 120000) }); }
  catch { console.log('NO ENTRÓ', JSON.stringify(await p.evaluate(() => ({ modo: __pizza.modo, nivel: __pizza.J.nivel, cargando: __pizza.J.cargando })))); console.log([...new Set(errores)].slice(0, 10).join('\n')); await b.close(); srv.kill(); process.exit(1); }
  console.log('casa', ((Date.now() - t1) / 1000).toFixed(1), 's');
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => { const J = __pizza.J, r = __pizza.renderer.info.render; return { nivel: J.nivel, pos: J.jug?.o.position.toArray().map((x) => +x.toFixed(2)), suelo: J.jug?.est.suelo, llamadas: r.calls, tris: r.triangles, fis: J.fisica.triangulos, moviles: J.fisica.moviles, inst: J.instancias.length }; });
  console.log(JSON.stringify(info));
  await foto('juego');
  if (process.env.DBG) { console.log(JSON.stringify(await p.evaluate(process.env.DBG))); await p.waitForTimeout(1500); await foto('extra'); }
}
console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].slice(0, 10).join('\n') : 'sin errores');
await b.close(); srv.kill();
