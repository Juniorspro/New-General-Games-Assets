// Prueba rápida en Chromium: carga, menú, jugar y fotos chicas.   node prueba.mjs [escena]
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
const [w, h] = (process.env.TAM || '844x390').split('x').map(Number);
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!process.env.TACTIL, isMobile: !!process.env.TACTIL });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
try { await p.waitForFunction(() => window.__bus?.listo, null, { timeout: +(process.env.ESPERA || 120000) }); }
catch { console.log('NO CARGÓ', await p.evaluate(() => document.title + ' / ' + document.body?.innerText.slice(0, 300))); console.log([...new Set(errores)].slice(0, 10).join('\n')); await b.close(); srv.kill(); process.exit(1); }
console.log('carga', ((Date.now() - t0) / 1000).toFixed(1), 's');
const foto = (n) => p.screenshot({ path: path.join(AQUI, 'salida', n + '.jpg'), type: 'jpeg', quality: 55 });
if (await p.isVisible('[data-i="es"]')) await p.click('[data-i="es"]');
await p.waitForTimeout(1500); await foto('menu');
const pasos = process.argv[2] || '';
if (process.env.TACTIL) await p.tap('[data-b="jugar"]'); else await p.click('[data-b="jugar"]');
await p.waitForTimeout(2500);
const info = await p.evaluate(() => { const j = __bus.juego, r = __bus.renderer.info.render; return { pos: j.pos.toArray().map((x) => +x.toFixed(2)), suelo: j.est.suelo, llamadas: r.calls, tris: r.triangles, veg: __bus.veg() }; });
console.log(JSON.stringify(info));
await foto('juego');
if (process.env.DBG) console.log(JSON.stringify(await p.evaluate(process.env.DBG)));
if (pasos) await p.evaluate(pasos);
if (pasos) { await p.waitForTimeout(1500); await foto('extra'); }
console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].slice(0, 8).join('\n') : 'sin errores');
await b.close(); srv.kill();
