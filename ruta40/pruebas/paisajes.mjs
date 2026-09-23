// Una captura de cada tramo en el medio del viaje (para mirar el dibujo).
//     node ruta40/pruebas/paisajes.mjs [carpeta] [metro]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.argv[2] || '/tmp/r40paisajes', X = +(process.argv[3] || 1500);
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pag = await (await nav.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errores = [];
pag.on('pageerror', (e) => errores.push(String(e))); pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await pag.goto('file://' + path.join(AQUI, 'ruta40.html') + '?prueba');
await pag.waitForSelector('#idioma', { timeout: 60000 });
await pag.evaluate(() => { const P = window.__r40.P; P.idioma = 'es'; P.vista.intro = true; P.vista.tuto = true; for (const t of ['puna','quebrada','salinas','valles','cuyo','patagonia','glaciar']) P.abiertos[t] = true; });
for (const tr of ['puna', 'quebrada', 'salinas', 'valles', 'cuyo', 'patagonia', 'glaciar']) {
  await pag.evaluate((tr) => window.__r40.empezar({ tramo: tr, modo: 'viaje' }), tr);
  await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
  await pag.waitForTimeout(700);
  await pag.evaluate((x) => window.__r40.viaje.mover(x), X);
  await pag.keyboard.down('ArrowRight'); await pag.waitForTimeout(2500); await pag.keyboard.up('ArrowRight');
  await pag.screenshot({ path: path.join(OUT, tr + '.png') }); console.log('captura', tr);
}
console.log('errores:', errores.length ? errores : 'ninguno');
await nav.close();
