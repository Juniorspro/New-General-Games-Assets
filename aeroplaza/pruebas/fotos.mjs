// Fotos de la isla desde varios lugares y horas, para mirar cómo se ve.
//     node pruebas/fotos.mjs [--movil] [--calidad=alta]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const movil = process.argv.includes('--movil');
const cal = (process.argv.find((a) => a.startsWith('--calidad=')) || '--calidad=alta').split('=')[1];
const tomas = (process.argv.find((a) => a.startsWith('--tomas=')) || '').split('=')[1];
const TOMAS = {
  inicio: 'directo&hora=0.45',
  lago: 'directo&hora=0.5&x=4&z=0&yaw=-1.1&pitch=0.25&dist=9',
  plaza: 'directo&hora=0.42&x=-6&z=-6&yaw=0.8&pitch=0.35&dist=11',
  tarde: 'directo&hora=0.745&x=10&z=6&yaw=-2.4&pitch=0.15&dist=7',
  noche: 'directo&hora=0.95&x=-2&z=10&yaw=0.3&pitch=0.3&dist=8',
  cerca: 'directo&hora=0.5&x=-20&z=12&yaw=1.3&pitch=0.12&dist=3.2',
  terminal: 'directo&hora=0.45&x=-38&z=16&yaw=1.45&pitch=0.18&dist=12',
  barrio: 'directo&hora=0.45&x=2&z=29&yaw=3.14&pitch=0.2&dist=9',
  ciudad: 'directo&hora=0.45&x=96&z=-24&yaw=-1.5&pitch=0.12&dist=10',
  bahia: 'directo&hora=0.72&x=112&z=112&yaw=-2.36&pitch=0.12&dist=9',
  tienda: 'directo&hora=0.45&x=20&z=15&yaw=-2.36&pitch=0.2&dist=9',
  fuente: 'directo&hora=0.45&x=0&z=-3&yaw=3.14&pitch=0.3&dist=7',
  medusas: 'directo&hora=0.45&x=4&z=-4&yaw=-2.0&pitch=-0.05&dist=6',
  jardin: 'directo&reino=jardin&hora=0.45&yaw=2.4&pitch=0.35&dist=14',
};
const nav = await navegador();
for (const [n, q] of Object.entries(TOMAS)) {
  if (tomas && !tomas.split(',').includes(n)) continue;
  const t0 = Date.now();
  const { pag, ctx, errores } = await abrir(nav, q + '&pausa&calidad=' + cal, movil ? { ancho: 390, alto: 844, movil: true } : {});
  await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 20);
  const f = path.join(SAL, `isla-${n}${movil ? '-movil' : ''}.png`);
  await pag.screenshot({ path: f, timeout: 120000 });
  console.log(`${n}: ${((Date.now() - t0) / 1000).toFixed(1)} s ${errores.length ? 'ERRORES: ' + [...new Set(errores)].join(' | ') : ''}`);
  await ctx.close();
}
await nav.close();
