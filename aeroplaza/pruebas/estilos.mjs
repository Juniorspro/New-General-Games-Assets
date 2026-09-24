// Una foto de la plaza con cada estilo retro (y cuánto cuesta dibujarlo).
//     node pruebas/estilos.mjs [--movil]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const movil = process.argv.includes('--movil');
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=alta&hora=0.4&x=-14&z=10&yaw=2.2&pitch=0.25&dist=6', movil ? { ancho: 390, alto: 844, movil: true } : { ancho: 960, alto: 540 });
await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
await pag.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
for (const n of ['normal', 'pixel', 'ps1', 'tubo', 'gameboy', 'ochobits', 'vhs']) {
  await pag.evaluate((n) => window.__A.J.ponerEstilo(n), n);
  await avanzar(pag, 6);
  const px = await pag.evaluate(() => { const r = window.__A.motor.r; return `${r.domElement.width}x${r.domElement.height}`; });
  await pag.screenshot({ path: path.join(SAL, `estilo-${n}${movil ? '-movil' : ''}.png`), timeout: 120000 });
  console.log(`${n}: dibuja a ${px}`);
}
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
