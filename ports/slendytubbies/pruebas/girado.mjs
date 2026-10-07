// Celu parado (360×740, táctil): el juego se ve acostado (girado 90°), JUGAR e idioma con toques, y un toque
// sobre el botón 3D «Singleplayer» del menú (girado) cambia de cámara.
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('slendy.v1', JSON.stringify({ ajustes: { calidad: 'baja' } })));
await p.goto('file://' + path.join(AQUI, 'salida/slendytubbies.html'));
await p.waitForFunction(() => window.__slendy?.listo, null, { timeout: 120000 });
console.log('girado:', await p.evaluate(() => document.body.classList.contains('girado')), 'lienzo:', await p.evaluate(() => { const c = document.getElementById('lienzo'); return c.width + '×' + c.height; }));
await p.tap('[data-b="empezar"]'); await p.tap('[data-i="es"]');
await p.waitForFunction(() => window.__slendy.J?.S && !window.__slendy.J.cargando, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(AQUI, 'pruebas/salida/girado-menu.jpg'), type: 'jpeg', quality: 50 });
const antes = await p.evaluate(() => [...window.__slendy.J.camOn].filter(([, v]) => v).map(([k]) => k).join());
const pt = await p.evaluate(() => {
  const J = window.__slendy.J, THREE = J.camara.position.constructor;
  const i = J.instancias.find((x) => /^Singleplayerbutton/i.test(x.nombre || '') && J.vivo(x.i))?.i;
  const v = J.S.O[i].getWorldPosition(new THREE()); v.project(J.camara);
  const W = innerHeight, H = innerWidth, x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
  return { i, x: innerWidth - y, y: x };
});
await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(800);
const despues = await p.evaluate(() => [...window.__slendy.J.camOn].filter(([, v]) => v).map(([k]) => k).join());
console.log('toque en Singleplayer', pt, 'cámaras:', antes, '→', despues);
console.log(err.length ? 'ERRORES ' + err.join(' / ') : 'sin errores');
await b.close();
