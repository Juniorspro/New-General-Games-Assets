// El archivo único: que abra desde el disco (file://), sin red y sin errores;
// que la intro llegue al menú y que se pueda jugar un rato.
//   python3 vibora/empaquetar.py && node vibora/pruebas/un-archivo.mjs
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath, pathToFileURL } from 'node:url';
import { statSync } from 'node:fs';
const ruta = fileURLToPath(new URL('../vibora-en-un-archivo.html', import.meta.url));
const kb = Math.round(statSync(ruta).size / 1024);
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const pedidos = [];
await ctx.route(/^https?:/, (r) => { pedidos.push(r.request().url()); r.abort(); });
const pg = await ctx.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e.stack || e).slice(0, 400)));
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
await pg.goto(pathToFileURL(ruta).href + '?pausa&limpio&intro');
await pg.waitForFunction(() => window.listo, null, { timeout: 20000 });
await pg.click('#bEntrar');
const r = await pg.evaluate(() => {
  const V = window.__V, intro = V.estado;
  V.pasos(200, true);
  const menu = V.estado;
  V.jugar();
  let masa = 0;
  for (let k = 0; k < 600; k++) { V.pasos(1); if (k % 10 === 0) V.dibujar(); if (V.mia.viva) masa = Math.max(masa, V.mia.masa); }
  return { intro, menu, juego: V.estado, masa: Math.round(masa), bots: V.mundo.viboras.length, sonido: V.sonido.errores };
});
await nav.close();
const bien = r.intro === 'intro' && r.menu === 'menu' && ['juego', 'muerte'].includes(r.juego) && r.bots > 10 && !r.sonido.length && !errores.length && !pedidos.length;
console.log(`${bien ? 'ok' : 'FALLA'}: ${kb} KB, desde file:// sin red, ${JSON.stringify(r)}${pedidos.length ? ', pidió a la red: ' + pedidos.join(' ') : ''}${errores.length ? ', errores: ' + errores.join(' | ') : ''}`);
process.exit(bien ? 0 : 1);
