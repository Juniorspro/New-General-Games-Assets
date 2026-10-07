// El celu: pantalla táctil horizontal, el HTML único. Toques en el menú 3D, botones en la partida, joystick.
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const err = []; p.on('pageerror', (e) => err.push(e.message));
await p.goto('file://' + path.join(AQUI, 'salida/slendytubbies.html'));
await p.waitForFunction(() => window.__slendy?.listo, null, { timeout: 120000 });
await p.tap('[data-b="empezar"]'); await p.tap('[data-i="es"]');
await p.waitForFunction(() => window.__slendy.J?.S && !window.__slendy.J.cargando, null, { timeout: 120000 });
await p.evaluate(() => { window.__slendy.congelar = 'dibujo'; });
await p.waitForTimeout(800);
await p.touchscreen.tap(0.29 * 760, 0.52 * 360); // Un jugador
await p.waitForTimeout(800);
const cam = await p.evaluate(() => window.__slendy.J.camaraActiva());
await p.touchscreen.tap(0.31 * 760, 0.83 * 360); // Día
await p.waitForFunction(() => window.__slendy.J.jug, null, { timeout: 120000 });
await p.waitForTimeout(1000);
const vis = await p.evaluate(() => [...document.querySelectorAll('#tactil .ctl')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.id));
// E (empezar) con el botón, después joystick hacia adelante 2 s
const box = async (id) => p.evaluate((i) => { const r = document.querySelector(`.c-${i}`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
const [ux, uy] = await box('usar');
await p.touchscreen.tap(ux, uy);
await p.waitForTimeout(600);
const quedanEmpezar = await p.evaluate(() => window.__slendy.J.instancias.filter((x) => x.nombre === 'Begin game').length);
const p0 = await p.evaluate(() => window.__slendy.J.jugadorPos().toArray());
const [jx, jy] = await box('joy');
const cdp = await ctx.newCDPSession(p);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - 60, id: 1 }] });
await p.waitForTimeout(2000);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const p1 = await p.evaluate(() => window.__slendy.J.jugadorPos().toArray());
const anduvo = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
// linterna con el botón
const l0 = await p.evaluate(() => window.__slendy.J.S.luces.find((l) => l.i === window.__slendy.J.iLinterna)?.on);
const [lx, ly] = await box('linterna'); await p.touchscreen.tap(lx, ly); await p.waitForTimeout(400);
const l1 = await p.evaluate(() => window.__slendy.J.S.luces.find((l) => l.i === window.__slendy.J.iLinterna)?.on);
await p.evaluate(() => window.__slendy.dibujar());
await p.screenshot({ path: path.join(AQUI, 'pruebas/salida/celu.jpg'), type: 'jpeg', quality: 60 });
console.log(JSON.stringify({ cam, vis, quedanEmpezar, anduvo: +anduvo.toFixed(1), linterna: [l0, l1], err }));
await b.close();
