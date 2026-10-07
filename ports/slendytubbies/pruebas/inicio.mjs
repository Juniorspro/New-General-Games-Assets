// Arranque: intro de JXStudios, el menú se carga detrás y aparece difuminado con el idioma encima (lo único que
// se elige); al tocar un idioma, el menú queda libre. Sin pantalla de carga.
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 }, locale: 'pt-BR' });
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('slendy.v1', JSON.stringify({ ajustes: { calidad: 'baja' } })));
await p.goto('file://' + path.join(AQUI, 'salida/slendytubbies.html'));
await p.waitForSelector('#intro:not([hidden])', { timeout: 60000 }); await p.waitForTimeout(2200);
await p.screenshot({ path: path.join(AQUI, 'pruebas/salida/inicio-intro.jpg'), type: 'jpeg', quality: 55 });
const huboCarga = await p.evaluate(() => new Promise((ok) => { let v = false; const t = setInterval(() => { if (document.querySelector('#pantallas.p-cargando')) v = true; if (document.querySelector('#pantallas.p-idioma')) { clearInterval(t); ok(v); } }, 50); }));
await p.waitForTimeout(1200);
console.log('pantalla de carga:', huboCarga, '| detrás del idioma:', await p.evaluate(() => [window.__slendy.J?.nivel, !!window.__slendy.J?.S, window.__slendy.modo]));
await p.screenshot({ path: path.join(AQUI, 'pruebas/salida/inicio-idioma.jpg'), type: 'jpeg', quality: 55 });
await p.click('[data-i="es"]'); await p.waitForTimeout(600);
console.log('después:', await p.evaluate(() => [document.querySelector('#pantallas').className || '(nada)', window.__slendy.modo, JSON.parse(localStorage.getItem('slendy.v1')).idioma]));
console.log(err.length ? 'ERRORES ' + err.join(' / ') : 'sin errores');
await b.close();
