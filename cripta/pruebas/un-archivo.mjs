// El archivo único: que abra desde el disco (file://), sin red y sin errores,
// y que se pueda jugar el primer nivel.
//   python3 cripta/empaquetar.py && node cripta/pruebas/un-archivo.mjs
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath, pathToFileURL } from 'node:url';
import { statSync } from 'node:fs';
const ruta = fileURLToPath(new URL('../cripta-en-un-archivo.html', import.meta.url));
const kb = Math.round(statSync(ruta).size / 1024);
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const pedidos = [];
await ctx.route(/^https?:/, (r) => { pedidos.push(r.request().url()); r.abort(); });
const pg = await ctx.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e.stack || e).slice(0, 400)));
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
await pg.goto(pathToFileURL(ruta).href + '?pausa&limpio&directo=nivel:0');
await pg.waitForFunction(() => window.listo, null, { timeout: 20000 });
const r = await pg.evaluate(() => {
  const C = window.__C, D = [[0, -1], [1, 0], [0, 1], [-1, 0]], camino = C.camino(0);
  let k = 0;
  for (let n = 0; n < 3000 && !C.app.escena.capa; n++) {
    const p = C.partida;
    if (p.estado === 'jugando' && !p.lu.mueve && !p.buffer && k < camino.length) { C.deslizar(...D[camino[k]]); k++; }
    C.pasos(1);
  }
  C.pasos(60, true);
  return { capa: C.app.escena.capa?.constructor.name, estrellas: C.datos.estrellas['1-1'] };
});
await nav.close();
const bien = r.capa === 'Resultado' && r.estrellas === 3 && !errores.length && !pedidos.length;
console.log(`${bien ? 'ok' : 'FALLA'}: ${kb} KB, desde file:// sin red, ${JSON.stringify(r)}${pedidos.length ? ', pidió a la red: ' + pedidos.join(' ') : ''}${errores.length ? ', errores: ' + errores.join(' | ') : ''}`);
process.exit(bien ? 0 : 1);
