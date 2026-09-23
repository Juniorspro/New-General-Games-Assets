// En un teléfono simulado (parado, así se gira): se aprieta el pedal del gas con un dedo
// y el del freno con otro, a la vez, y se comprueba que el auto avanza y después frena.
//     node ruta40/pruebas/dedos.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pag = await ctx.newPage();
const errores = [];
pag.on('pageerror', (e) => errores.push(String(e))); pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await pag.goto('file://' + path.join(AQUI, 'ruta40.html') + '?prueba');
await pag.waitForSelector('#idioma', { timeout: 60000 });
await pag.evaluate(() => { const P = window.__r40.P; P.vista.intro = true; P.vista.tuto = true; });
await pag.evaluate(() => window.__r40.empezar({ tramo: 'puna', modo: 'viaje' }));
await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
const cdp = await ctx.newCDPSession(pag);
const centro = async (sel) => pag.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const gas = await centro('.pedal-gas'), freno = await centro('.pedal-freno');
/* ¿el toque cae de verdad sobre el pedal? (con #app girado) */
const encima = await pag.evaluate(([g, f]) => [document.elementFromPoint(g.x, g.y)?.closest('.pedal')?.className, document.elementFromPoint(f.x, f.y)?.closest('.pedal')?.className], [gas, freno]);
console.log('debajo del dedo:', encima);
const x0 = await pag.evaluate(() => window.__r40.viaje.yo.x);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x, y: gas.y, id: 1 }] });
await pag.waitForTimeout(4000);
const x1 = await pag.evaluate(() => window.__r40.viaje.yo.x);
const apretado = await pag.evaluate(() => document.querySelector('.pedal-gas').classList.contains('apretado'));
/* el segundo dedo en el freno, con el primero todavía en el gas */
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x, y: gas.y, id: 1 }, { x: freno.x, y: freno.y, id: 2 }] });
await pag.waitForTimeout(600);
const dos = await pag.evaluate(() => [document.querySelector('.pedal-gas').classList.contains('apretado'), document.querySelector('.pedal-freno').classList.contains('apretado')]);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await pag.waitForTimeout(400);
const suelto = await pag.evaluate(() => [document.querySelector('.pedal-gas').classList.contains('apretado'), document.querySelector('.pedal-freno').classList.contains('apretado')]);
console.log(`avanzó ${(x1 - x0).toFixed(1)} m con el gas · gas apretado: ${apretado} · los dos a la vez: ${dos} · al soltar: ${suelto}`);
console.log('errores:', errores.length ? errores : 'ninguno');
await nav.close();
const bien = x1 - x0 > 2 && apretado && dos[0] && dos[1] && !suelto[0] && !suelto[1] && !errores.length && encima[0]?.includes('gas') && encima[1]?.includes('freno');
console.log(bien ? 'BIEN' : 'MAL'); process.exit(bien ? 0 : 1);
