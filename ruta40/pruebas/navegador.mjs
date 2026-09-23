// Abre ruta40.html en Chromium (por file://), recorre las pantallas, maneja un rato
// y saca capturas. Falla si hay errores en la consola.
//     node ruta40/pruebas/navegador.mjs [carpeta de capturas] [--telefono]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2), tel = args.includes('--telefono');
const OUT = args.find((a) => !a.startsWith('--')) || '/tmp/r40capturas';
fs.mkdirSync(OUT, { recursive: true });
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await navegador.newContext(tel ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const pag = await ctx.newPage();
const errores = [];
pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', (e) => errores.push(String(e)));
await pag.goto('file://' + path.join(AQUI, 'ruta40.html') + '?prueba');
const foto = async (n) => { await pag.screenshot({ path: path.join(OUT, n + '.png') }); console.log('captura', n); };
const esperar = (ms) => pag.waitForTimeout(ms);
const tocar = async (sel) => { const l = pag.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 20000 }); if (tel) await l.tap(); else await l.click(); };

await pag.waitForSelector('#idioma', { timeout: 60000 });
await esperar(900); await foto('01-idioma');
await tocar('#idioma .carteles button:nth-child(1)');
await pag.waitForSelector('#historia', { timeout: 20000 });
await esperar(1500); await foto('02-historia');
await tocar('#historia .saltar');
await pag.waitForSelector('#menu', { timeout: 20000 });
await esperar(2500); await foto('03-menu');
await tocar('#menu .botones button:nth-child(1)');
await pag.waitForSelector('#mapa', { timeout: 20000 });
await esperar(900); await foto('04-mapa');
/* le damos plata para ver la gomería con mejoras y probar comprar */
await pag.evaluate(() => { window.__r40.P.monedas = 50000; });
await tocar('#mapa .postal .acciones button:nth-child(1)');
await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 20000 });
await esperar(600); await foto('05-largada');
/* a fondo 6 segundos de juego */
await pag.keyboard.down('ArrowRight');
for (let i = 0; i < 5; i++) { await esperar(1400); await foto('06-manejando-' + i); }
await pag.keyboard.up('ArrowRight');
const dato = await pag.evaluate(() => { const v = window.__r40.viaje; return v && { m: v.metros, monedas: v.monedas, fin: v.fin, fps: 0 }; });
console.log('viaje', JSON.stringify(dato));
await pag.keyboard.press('KeyP'); await esperar(500); await foto('07-pausa');
await tocar('#pausa .barraBotones button:nth-child(1)');
/* forzar el final para ver el resultado */
await pag.evaluate(() => window.__r40.terminar('nafta'));
await pag.waitForSelector('#resultado', { timeout: 30000 });
await esperar(2500); await foto('08-resultado');
await tocar('#resultado .botonesRes > div button:nth-child(1)');
await pag.waitForSelector('#gomeria', { timeout: 20000 });
await esperar(1200); await foto('09-gomeria');
await tocar('#gomeria .mejora button');
await esperar(400); await foto('10-gomeria-mejora');
await tocar('#gomeria .flechas button:nth-child(2)');
await esperar(900); await foto('11-gomeria-fitito');
await tocar('#gomeria .izq button');
await pag.waitForSelector('#menu', { timeout: 20000 });
await tocar('#menu .botones button:nth-child(4)');
await pag.waitForSelector('#ajustes', { timeout: 20000 });
await esperar(700); await foto('12-ajustes');
await tocar('#ajustes .fila:nth-child(10) button');
await pag.waitForSelector('#controles', { timeout: 20000 });
await esperar(700); await foto('13-controles');
await tocar('#controles .barraBotones button:nth-child(3)');
await tocar('#ajustes .barraBotones button');
await pag.waitForSelector('#menu', { timeout: 20000 });
await tocar('#menu .botones button:nth-child(2)');
await pag.waitForSelector('#mapa', { timeout: 20000 });
await tocar('#mapa .postal .acciones button:nth-child(2)');
await pag.waitForSelector('#picadas', { timeout: 20000 });
await esperar(600); await foto('14-picadas');
await tocar('#picadas .carrera button');
await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 20000 });
await esperar(2000); await foto('15-semaforo');
await pag.keyboard.down('ArrowRight');
await esperar(4000); await foto('16-picada');
await pag.keyboard.up('ArrowRight');
console.log('errores:', errores.length ? errores : 'ninguno');
await navegador.close();
if (errores.length) process.exit(1);
