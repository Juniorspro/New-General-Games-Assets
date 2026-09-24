// Una foto de cada reino (entrando como un jugador) y los errores de consola.
//     node pruebas/reinos.mjs [plaza,aqua,…] [--movil]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const movil = process.argv.includes('--movil');
const lista = (process.argv.slice(2).find((a) => !a.startsWith('--')) || 'plaza,aqua,aurora,jardin,tienda,casa').split(',');
const nav = await navegador();
for (const r of lista) {
  const t0 = Date.now();
  const { pag, ctx, errores } = await abrir(nav, `directo&pausa&reino=${r}&calidad=alta&hora=0.45`, movil ? { ancho: 390, alto: 844, movil: true } : {});
  await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 40);
  const f = path.join(SAL, `reino-${r}${movil ? '-movil' : ''}.png`);
  await pag.screenshot({ path: f, timeout: 120000 });
  const info = await pag.evaluate(() => ({ y: window.__A.yo.p.y.toFixed(2), modo: window.__A.yo.modo, llamadas: window.__A.motor.r.info.render.calls, tris: window.__A.motor.r.info.render.triangles }));
  console.log(`${r}: ${((Date.now() - t0) / 1000).toFixed(1)} s · y ${info.y} ${info.modo} · ${info.llamadas} llamadas · ${(info.tris / 1000).toFixed(0)} mil triángulos ${errores.filter((e) => !e.includes('ERR_FAILED')).length ? 'ERRORES: ' + [...new Set(errores)].join(' | ') : ''}`);
  await ctx.close();
}
await nav.close();
