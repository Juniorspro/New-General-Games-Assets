// Prueba el port: abre salida/justshoot.html (ARCHIVO=1) o dist/ por http, elige idioma y sigue los PASOS.
//   PASOS='[[seg,"eval","código"],[seg,"foto","nombre"],[seg,"tecla","KeyW",ms],[seg,"raton",dx,dy],[seg,"toque",x,y]]'
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
const W = +(process.env.W || 800), H = +(process.env.H || 450);
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: !!process.env.TACTIL, isMobile: !!process.env.TACTIL });
const p = await ctx.newPage();
const log = [];
p.on('pageerror', (e) => log.push('PAGEERROR ' + e.message.slice(0, 300)));
p.on('console', (m) => { const t = m.text(); if (process.env.TODO || m.type() === 'error' || /fail|error|unable|could not/i.test(t)) log.push(m.type() + ' ' + t.slice(0, 200)); });
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/justshoot.html') : `http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForSelector('#pantalla button', { timeout: 60000 });
await p.click(`#pantalla button[data-a="${process.env.IDIOMA || 'es'}"]`);
const t0 = Date.now();
await p.waitForFunction(() => window.__justshoot && window.__justshoot.listo(), null, { timeout: +(process.env.ESPERA || 180000) }).catch(() => log.push('no llegó a listo'));
console.log('listo en', ((Date.now() - t0) / 1000).toFixed(1), 's');
const pasos = JSON.parse(process.env.PASOS || '[]');
const SEG = +(process.env.SEG || 4);
for (let s = 0; s <= SEG * 10; s++) {
  for (const [t, tipo, x, y] of pasos) {
    if (Math.round(t * 10) !== s) continue;
    if (tipo === 'eval') console.log('eval', t, String(JSON.stringify(await p.evaluate(x).catch((e) => 'ERR ' + e.message))).slice(0, 600));
    if (tipo === 'foto') await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `${x}.jpg`), type: 'jpeg', quality: 55 });
    if (tipo === 'tecla') { await p.keyboard.down(x); await p.waitForTimeout(y || 150); await p.keyboard.up(x); }
    if (tipo === 'clic') await p.mouse.click(x * W, y * H);
    if (tipo === 'arrastre') { const [a, bb, ms] = [x, y, pasos.find((q) => q[0] === t)[4] || 600]; await p.mouse.move(a[0] * W, a[1] * H); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move((a[0] + (bb[0] - a[0]) * i / 12) * W, (a[1] + (bb[1] - a[1]) * i / 12) * H); await p.waitForTimeout(ms / 12); } await p.mouse.up(); }
    if (tipo === 'toque') await p.touchscreen.tap(x * W, y * H);
  }
  await p.waitForTimeout(100);
}
console.log(log.slice(process.env.TODO ? -45 : 0, process.env.TODO ? undefined : 20).join('\n') || 'sin errores');
await b.close(); srv.kill();
