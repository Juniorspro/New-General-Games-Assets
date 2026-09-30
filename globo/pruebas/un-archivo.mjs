// El archivo único: que abra desde el disco (file://), sin red y sin errores;
// que la intro arranque sola, pida el idioma, llegue al menú y se pueda jugar.
//   python3 globo/empaquetar.py && node globo/pruebas/un-archivo.mjs
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath, pathToFileURL } from 'node:url';
import { statSync } from 'node:fs';
const ruta = fileURLToPath(new URL('../globo-en-un-archivo.html', import.meta.url));
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
// la intro arranca sola (sin permiso de sonar, muda)
await pg.waitForFunction(() => window.__G.estado === 'intro', null, { timeout: 5000 });
const r = await pg.evaluate(() => {
  const G = window.__G, intro = G.estado;
  G.pasos(200, true);
  // sin idioma elegido, después del logo se elige
  const idiomas = G.estado;
  document.getElementById('bIdioma_es').click();
  const menu = idiomas === 'idiomas' ? G.estado : 'no pidió idioma: ' + idiomas;
  document.getElementById('bJugar').click();
  let alto = 0;
  for (let k = 0; k < 600 && G.partida.estado === 'juego'; k++) { G.mover(Math.sin(k / 20) * 4, 0); G.pasos(1); if (k % 10 === 0) G.dibujar(); alto = G.partida.altura(); }
  return { intro, menu, juego: G.estado, partida: G.partida.estado, alto: Math.round(alto), sonido: G.sonido.errores };
});
await nav.close();
const bien = r.intro === 'intro' && r.menu === 'menu' && r.juego === 'juego' && r.alto > 150 && !r.sonido.length && !errores.length && !pedidos.length;
console.log(`${bien ? 'ok' : 'FALLA'}: ${kb} KB, desde file:// sin red, ${JSON.stringify(r)}${pedidos.length ? ', pidió a la red: ' + pedidos.join(' ') : ''}${errores.length ? ', errores: ' + errores.join(' | ') : ''}`);
process.exit(bien ? 0 : 1);
