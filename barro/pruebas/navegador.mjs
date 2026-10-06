// Prueba de BARRO en el navegador, con barro.html (el archivo único):
// - celu parado: idioma → menú → campeonato → pista 1 → carrera manejada por el piloto (?bot)
//   hasta los resultados; que pague el premio y guarde la medalla;
// - los tres idiomas en el menú; acostado (844x390) que se vea entero;
// - el editor de controles: mover un botón y que se guarde.
// Fotos chicas en barro/pruebas/salida/.     node barro/pruebas/navegador.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const DIR = 'file://' + path.join(AQUI, '..', 'barro.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
let mal = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  MAL ') + m); if (!c) mal++; };

async function pagina(w, h, q = '') {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < h, hasTouch: true });
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(e.message));
  await p.goto(DIR + q);
  await p.waitForFunction(() => window.__barro?.listo, null, { timeout: 30000 });
  return p;
}

// 1. una carrera entera, parado
{
  const p = await pagina(390, 844, '?bot');
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForFunction(() => window.__barro?.listo);
  ok(await p.isVisible('[data-i="es"]'), 'la primera vez pide idioma');
  await p.click('[data-i="es"]');
  await p.click('[data-ir="campeonato"]');
  await p.click('[data-n="0"]');
  await p.click('.ir');
  await p.waitForTimeout(9000);
  await p.screenshot({ path: path.join(SAL, 'carrera.jpg'), type: 'jpeg', quality: 60 });
  const fin = await p.waitForSelector('.p-resultado', { timeout: 150000 }).then(() => true).catch(() => false);
  ok(fin, 'llega a los resultados');
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(SAL, 'resultado.jpg'), type: 'jpeg', quality: 60 });
  const D = await p.evaluate(() => JSON.parse(localStorage.getItem('barro.v1')));
  ok(D.plata > 300, `cobró el premio ($${D.plata})`);
  ok(D.tiempos.b1 > 20, `guardó el tiempo (${D.tiempos.b1?.toFixed(1)} s)`);
  ok(D.fantasmas.b1?.g?.length > 100, 'guardó el fantasma');
  ok(p.errores.length === 0, 'sin errores' + (p.errores.length ? ': ' + p.errores[0] : ''));
  await p.close();
}
// 2. idiomas
for (const [id, texto] of [['es', 'CAMPEONATO'], ['en', 'CHAMPIONSHIP'], ['pt', 'CAMPEONATO']]) {
  const p = await pagina(390, 844);
  await p.evaluate((i) => localStorage.setItem('barro.v1', JSON.stringify({ idioma: i })), id);
  await p.reload(); await p.waitForFunction(() => window.__barro?.listo);
  const t = await p.textContent('[data-ir="campeonato"]');
  ok(t.includes(texto), `menú en ${id}: ${t.trim()}`);
  await p.close();
}
// 3. acostado
{
  const p = await pagina(844, 390);
  await p.evaluate(() => localStorage.setItem('barro.v1', JSON.stringify({ idioma: 'es' })));
  await p.reload(); await p.waitForFunction(() => window.__barro?.listo);
  await p.click('[data-ir="campeonato"]'); await p.click('[data-n="0"]'); await p.click('.ir');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(SAL, 'acostado.jpg'), type: 'jpeg', quality: 60 });
  const gas = await p.$eval('.b-gas', (e) => { const r = e.getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.top > 0; });
  ok(gas, 'acostado: el gas entra en la pantalla');
  ok(p.errores.length === 0, 'acostado sin errores');
  await p.close();
}
// 4. editor de controles
{
  const p = await pagina(390, 844);
  await p.evaluate(() => localStorage.setItem('barro.v1', JSON.stringify({ idioma: 'es' })));
  await p.reload(); await p.waitForFunction(() => window.__barro?.listo);
  await p.click('[data-ir="ajustes"]'); await p.click('#ed');
  const r = await p.$eval('.b-gas', (e) => e.getBoundingClientRect().toJSON());
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + r.width / 2 - 60, r.y + r.height / 2 - 120, { steps: 6 }); await p.mouse.up();
  await p.click('#el');
  const D = await p.evaluate(() => JSON.parse(localStorage.getItem('barro.v1')));
  ok(D.ajustes.controles && D.ajustes.controles.b.gas.y < 0.8, `el gas quedó más arriba (y=${D.ajustes.controles?.b.gas.y.toFixed(2)})`);
  await p.close();
}
await b.close();
console.log(mal ? `${mal} cosas para arreglar` : 'Todo bien');
