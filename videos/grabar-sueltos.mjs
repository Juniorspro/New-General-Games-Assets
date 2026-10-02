// Graba tomas de los seis juegos de un archivo (GLOBO, VÍBORA, GRUMO, MORFI, LA ISLA, CRIPTA)
// para los videos relatados: el juego de verdad en Chromium, con el reloj propio (sueltos/reloj.mjs)
// y un "bot" por toma que juega a través de los ganchos de prueba de cada juego (__G, __V, __C,
// __isla). Una captura por cuadro a 1080×1920 (432×768 de CSS a ×2,5: los juegos dibujan con
// dpr 2,5 en calidad alta, así no se agranda nada) → medios/tomas/<juego>/<toma>.mp4, más
// <toma>.datos.json con lo que el bot devuelve en cada cuadro (dónde está el personaje, toques…)
// para que el montaje enganche flechas y círculos a lo que se mueve.
//     node videos/grabar-sueltos.mjs <juego> [toma,toma] [--cada=15]
//   --cada=N  prueba rápida: guarda un cuadro de cada N en una hoja de contactos, sin video
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { servir, RAIZ } from './sueltos/servidor.mjs';

const [juego, lista] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const cada = +(process.argv.find((a) => a.startsWith('--cada=')) || '').slice(7) || 0;
const DEF = (await import(`./sueltos/${juego}.mjs`)).default;
const solo = lista ? lista.split(',') : null;
const FPS = 30;
const SALIDA = path.join(RAIZ, 'videos/medios/tomas', juego);
const PRUEBA = path.join(RAIZ, 'videos/salida/pruebas');
fs.mkdirSync(SALIDA, { recursive: true });
const log = (s) => console.log(s);

const S = await servir();
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ff = (args) => { const x = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]); if (x.status !== 0) throw new Error('ffmpeg: ' + x.stderr); };

async function tomar(id, T) {
  const ctx = await nav.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', (e) => { errores.push(e.message); log(`  ${id}: ERROR ${e.message}`); });
  pag.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log(`  ${id}: consola ${m.text().slice(0, 200)}`); });
  await pag.goto(`${S.base}/${DEF.archivo}${T.q || ''}`);
  /* hasta que el juego avisa que está listo (a reloj propio: los cuadros los da esto) */
  let listo = false;
  for (let i = 0; i < 900 && !listo; i++) {
    await pag.evaluate(() => window.__reloj.cuadro(1000 / 30));
    listo = await pag.evaluate(DEF.listo);
    if (i % 30 === 29) await pag.waitForTimeout(5);
  }
  if (!listo) { log(`  ${id}: el juego no avisó que estaba listo`); await ctx.close(); return false; }
  if (DEF.comun) await pag.evaluate(DEF.comun);
  if (DEF.bot) await pag.evaluate(DEF.bot);
  if (T.preparar) {
    const r = await pag.evaluate(T.preparar);
    if (r === false) { log(`  ${id}: no se pudo preparar`); await ctx.close(); return false; }
  }
  /* los cuadros sueltos van afuera de medios/ (Remotion copia medios/ entero al empaquetar) */
  const dir = path.join(RAIZ, 'videos/salida/cuadros', juego, id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const datos = [];
  const t0 = Date.now();
  let guardados = 0;
  for (let k = 0; k < T.n; k++) {
    const info = T.cuadro ? await pag.evaluate(T.cuadro, k) : null;
    await pag.evaluate(() => window.__reloj.cuadro(1000 / 30));
    if (T.despues) datos.push(await pag.evaluate(T.despues, k)); else datos.push(info);
    if (!cada || k % cada === 0) {
      await pag.screenshot({ path: path.join(dir, String(cada ? guardados : k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: cada ? 70 : 93, timeout: 180000 });
      guardados++;
    }
    if (k % 90 === 89) log(`  ${id}: ${k + 1}/${T.n} (${((Date.now() - t0) / (k + 1)).toFixed(0)} ms por cuadro)`);
  }
  await ctx.close();
  fs.writeFileSync(path.join(SALIDA, id + '.datos.json'), JSON.stringify(datos));
  if (cada) {
    fs.mkdirSync(PRUEBA, { recursive: true });
    const hoja = path.join(PRUEBA, `${juego}-${id}.jpg`);
    spawnSync('montage', [path.join(dir, '*.jpg'), '-tile', '8x', '-geometry', '216x384+2+2', hoja]);
    fs.rmSync(dir, { recursive: true, force: true });
    log(`prueba ${id}: ${guardados} cuadros → ${path.relative(RAIZ, hoja)}${errores.length ? ` (${errores.length} errores)` : ''}`);
    return true;
  }
  const dest = path.join(SALIDA, id + '.mp4');
  ff(['-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-g', '30', dest]);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`toma ${id}: ${T.n} cuadros (${(T.n / FPS).toFixed(1)} s)${errores.length ? ` (${errores.length} errores)` : ''}`);
  return true;
}

for (const [id, T] of Object.entries(DEF.tomas)) {
  if (solo && !solo.includes(id)) continue;
  await tomar(id, T);
}
await nav.close();
S.cerrar();
