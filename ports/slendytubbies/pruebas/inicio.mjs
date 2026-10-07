// El archivo único arranca directo en JUGAR (sin idioma guardado), al tocarlo pide idioma y después va al menú.
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 }, locale: 'pt-BR' });
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.goto('file://' + path.join(AQUI, 'salida/slendytubbies.html'));
await p.waitForFunction(() => window.__slendy?.listo, null, { timeout: 120000 });
const txt = () => p.evaluate(() => [...document.querySelectorAll('button[data-b], button[data-i]')].filter((x) => x.offsetParent).map((x) => x.textContent).join(' | '));
console.log('primera pantalla:', await txt());
await p.click('[data-b="empezar"]');
console.log('al tocar JUGAR:', await txt());
await p.click('[data-i="es"]');
await p.waitForFunction(() => window.__slendy.J?.S && !window.__slendy.J.cargando, null, { timeout: 120000 });
console.log('menú:', await p.evaluate(() => [window.__slendy.J.nivel, window.__slendy.modo, JSON.parse(localStorage.getItem('slendy.v1')).idioma]));
console.log(err.length ? 'ERRORES ' + err.join(' / ') : 'sin errores');
await b.close();
