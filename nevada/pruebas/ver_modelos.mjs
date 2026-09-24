// Hoja de cada modelo desde seis ángulos → pruebas/salida/<modelo>.png
//     node pruebas/ver_modelos.mjs [auto.glb tigre-parado.glb …]
import fs from 'node:fs';
import path from 'node:path';
import { servir, navegador } from './servidor.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const lista = process.argv.slice(2).length ? process.argv.slice(2) : ['auto.glb', 'tigre-parado.glb', 'tigre-echado.glb', 'tigre-ruge.glb'];
const s = await servir();
const nav = await navegador();
const pag = await nav.newPage({ viewport: { width: 1800, height: 600 } });
pag.on('pageerror', (e) => console.log('ERROR', e.message));
for (const m of lista) {
  await pag.goto(`${s.url}/pruebas/ver.html?m=${m}`);
  await pag.waitForFunction(() => window.__listo, null, { timeout: 120000 });
  const info = await pag.evaluate(() => window.__listo);
  await pag.screenshot({ path: path.join(SAL, m.replace('.glb', '.png')) });
  console.log(m, 'tamaño', info.tam.map((x) => x.toFixed(3)).join(' × '));
}
await nav.close(); s.cerrar();
