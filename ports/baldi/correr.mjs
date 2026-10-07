// Prueba con el navegador: abre dist/, pasa la intro, elige idioma y sigue unos pasos.
//   PASOS='[[seg,"eval","código"],[seg,"foto","nombre"],[seg,"tecla","KeyW",ms],[seg,"clic",x,y],[seg,"escena","School"]]' SEG=10 node correr.mjs
// x,y del clic en fracciones de la pantalla. Las fotos van a pruebas/salida/ (jpeg chicos).
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(path.join(AQUI, 'pruebas/salida'), { recursive: true });
const PUERTO = 8800 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const W = +(process.env.W || 640), H = +(process.env.H || 400);
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: !!process.env.TACTIL, isMobile: !!process.env.TACTIL });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + (e.stack || e.message).slice(0, 500)));
p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/favicon|404|GPU stall|WebGL/.test(t)) errores.push(m.type() + ' ' + t.slice(0, 300)); });
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/baldi.html') : `http://127.0.0.1:${PUERTO}/index.html`);
try { await p.waitForFunction(() => window.__baldi, null, { timeout: 60000 }); } catch (e) { console.log(errores.join('\n') || 'sin errores'); await b.close(); srv.kill(); process.exit(1); }
await p.waitForSelector('#pantallas button[data-l]', { timeout: 30000 });
if (process.env.FOTO_IDIOMA) await p.screenshot({ path: path.join(AQUI, 'pruebas/salida/idioma.jpg'), type: 'jpeg', quality: 55 });
await p.click(`#pantallas button[data-l="${process.env.IDIOMA || 'es'}"]`);
await p.waitForFunction(() => window.__baldi.listo, null, { timeout: 120000 });
const pasos = JSON.parse(process.env.PASOS || '[]');
const SEG = +(process.env.SEG || 4);
const t0 = Date.now();
for (let s = 0; s <= SEG * 10; s++) {
  for (const [t, tipo, x, y] of pasos) {
    if (Math.round(t * 10) !== s) continue;
    if (tipo === 'eval') console.log('eval', t, String(JSON.stringify(await p.evaluate(x).catch((e) => 'ERR ' + e.message))).slice(0, 900));
    if (tipo === 'foto') await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `${x}.jpg`), type: 'jpeg', quality: 55 });
    if (tipo === 'tecla') { await p.keyboard.down(x); await p.waitForTimeout(y || 120); await p.keyboard.up(x); }
    if (tipo === 'mantener') await p.keyboard.down(x);
    if (tipo === 'soltar') await p.keyboard.up(x);
    if (tipo === 'clic') await p.mouse.click(x * W, y * H);
    if (tipo === 'toque') await p.touchscreen.tap(x * W, y * H);
    if (tipo === 'deslizar' || tipo === 'mantenerToque') { // [t, tipo, [x0,y0], [x1,y1]] con CDP (dedo que se arrastra)
      const cdp = await ctx.newCDPSession(p), [a, bb] = [x, y];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0] * W, y: a[1] * H, id: 1 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (a[0] + (bb[0] - a[0]) * i / 10) * W, y: (a[1] + (bb[1] - a[1]) * i / 10) * H, id: 1 }] }); await p.waitForTimeout(tipo === 'mantenerToque' ? 150 : 30); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    if (tipo === 'raton') { const [a, bb] = [x, y]; await p.mouse.move(a[0] * W, a[1] * H); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move((a[0] + (bb[0] - a[0]) * i / 10) * W, (a[1] + (bb[1] - a[1]) * i / 10) * H); await p.waitForTimeout(150); } await p.mouse.up(); }
    if (tipo === 'escena') await p.evaluate((n) => window.__baldi.mundo.LoadScene(n), x);
  }
  await p.waitForTimeout(100);
}
const info = await p.evaluate(() => { const m = window.__baldi.mundo; return { escena: m.escena?.nombre, nodos: m.nodos.length, t: +window.__baldi.U.mundo && 0 }; });
console.log(JSON.stringify(info));
console.log(errores.length ? errores.slice(0, 15).join('\n') : 'sin errores');
console.log('tiempo real', ((Date.now() - t0) / 1000).toFixed(1), 's');
await b.close(); srv.kill();
