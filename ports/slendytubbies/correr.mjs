// Prueba con el navegador: abre dist/, elige idioma, toca empezar y sigue unos pasos.
//   PASOS='[[seg,"eval","código"],[seg,"foto","nombre"],[seg,"tecla","KeyF",ms],[seg,"clic",x,y]]' SEG=10 node correr.mjs
// x,y del clic en fracciones de la pantalla. Las fotos van a pruebas/salida/.
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
const W = +(process.env.W || 640), H = +(process.env.H || 360);
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + (e.stack || e.message).slice(0, 500)));
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|404/.test(t)) errores.push(t.slice(0, 300)); });
await p.addInitScript((idioma) => { localStorage.setItem('slendy.v1', JSON.stringify({ idioma, ajustes: { calidad: 'baja' } })); }, process.env.IDIOMA || 'es');
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/slendytubbies.html') : `http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForFunction(() => window.__slendy?.listo, null, { timeout: 120000 });
await p.click('[data-b="empezar"]');
if (process.env.RAPIDO) await p.evaluate(() => { window.__slendy.congelar = 'dibujo'; });
await p.waitForFunction(() => window.__slendy.J?.S && !window.__slendy.J.cargando, null, { timeout: 120000 });
const pasos = JSON.parse(process.env.PASOS || '[]');
const SEG = +(process.env.SEG || 4);
const t0 = Date.now();
for (let s = 0; s <= SEG * 10; s++) {
  for (const [t, tipo, x, y, z] of pasos) {
    if (Math.round(t * 10) !== s) continue;
    if (tipo === 'eval') console.log('eval', t, String(JSON.stringify(await p.evaluate(x).catch((e) => 'ERR ' + e.message))).slice(0, 700));
    if (tipo === 'foto') await p.evaluate(() => window.__slendy.dibujar());
    if (tipo === 'foto') await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `${x}.jpg`), type: 'jpeg', quality: 60 });
    if (tipo === 'tecla') { await p.keyboard.down(x); await p.waitForTimeout(y || 120); await p.keyboard.up(x); }
    if (tipo === 'clic') await p.mouse.click(x * W, y * H);
    if (tipo === 'mantener') await p.keyboard.down(x);
    if (tipo === 'soltar') await p.keyboard.up(x);
  }
  await p.waitForTimeout(100);
}
const info = await p.evaluate(() => { const J = window.__slendy.J; return { nivel: J.nombre, t: +J.t.toFixed(1), cam: J.camara.position.toArray().map((x) => +x.toFixed(1)), jug: J.jugadorPos()?.toArray().map((x) => +x.toFixed(1)), inst: J.instancias.length, gui: J.gui.length, cuadros: window.__slendy.cuadros }; });
console.log(JSON.stringify(info));
console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
console.log('tiempo real', ((Date.now() - t0) / 1000).toFixed(1), 's');
await b.close(); srv.kill();
