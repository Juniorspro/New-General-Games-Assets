// Corre un nivel con el motor completo: N=SM_Bedroom SEG=5 FOTOS=2 PASOS='[[t,"tecla","SpaceBar"],[t,"eval","código"]]' node correr.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const PUERTO = 18000 + Math.floor(Math.random() * 2000);
fs.mkdirSync(path.join(AQUI, 'pruebas/salida'), { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + (e.stack || e.message).slice(0, 500)));
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|404/.test(t)) errores.push(t.slice(0, 300)); });
const N = process.env.N || 'SM_Bedroom';
await p.goto(`http://127.0.0.1:${PUERTO}/prueba.html?n=${N}&i=${process.env.I || ""}`);
await p.waitForFunction(() => window.__tjoc?.listo, null, { timeout: 240000 });
const SEG = +(process.env.SEG || 4), FOTOS = +(process.env.FOTOS || 1);
const pasos = JSON.parse(process.env.PASOS || '[]');
const t0 = Date.now();
let foto = 0;
for (let s = 0; s <= SEG * 10; s++) {
  const t = s / 10;
  for (const [tp, tipo, x] of pasos) if (Math.abs(tp - t) < 0.05) {
    if (tipo === 'tecla') { await p.evaluate((k) => { __tjoc.J.M.tecla(k, true); }, x); await p.waitForTimeout(80); await p.evaluate((k) => { __tjoc.J.M.tecla(k, false); }, x); }
    if (tipo === 'eval') console.log('eval', t, String(JSON.stringify(await p.evaluate(x))).slice(0, 400));
    if (tipo === 'click') { await p.evaluate((n) => { const el = document.querySelector('[data-w="' + n + '"]'); if (!el) return; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }, x); }
    if (tipo === 'foto') { await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `${N}-${x}.jpg`), type: 'jpeg', quality: 55 }); }
  }
  await p.waitForTimeout(100);
  if (FOTOS > 0 && s > 0 && s % Math.round((SEG * 10) / FOTOS) === 0) await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `${N}-${foto++}.jpg`), type: 'jpeg', quality: 55 });
}
const info = await p.evaluate(() => { const M = __tjoc.J.M; return { faltan: [...M.vm.faltan.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => v + ' ' + k), logs: __tjoc.logs.slice(0, 25), t: +M.tiempo.toFixed(2), cam: M.camara.position.toArray().map((x) => +x.toFixed(2)), widgets: [...M.ui.umg.activos].map((w) => w.clase?.n), latentes: M.vm.latentes.size, timers: M.timers.lista.size, calls: __tjoc.J.renderer.info.render.calls, tris: __tjoc.J.renderer.info.render.triangles }; });
console.log(JSON.stringify(info, null, 1));
console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].slice(0, 8).join('\n') : 'sin errores');
console.log('tiempo real', ((Date.now() - t0) / 1000).toFixed(1), 's');
await b.close(); srv.kill();
