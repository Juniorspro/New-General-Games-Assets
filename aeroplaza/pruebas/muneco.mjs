// El muñeco en el estudio del probador, con varias apariencias de los videos:
// azul con agua, rosa→celeste liso, y "la Tierra" (cabeza de Tierra y nubes).
//     node pruebas/muneco.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=alta', { ancho: 1100, alto: 620 });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await pag.evaluate(() => window.__A.J.abrirProbador());
const A = [
  ['agua', { color: '#2f7bff', color2: '#bfeaff', motivo: 'agua', cubre: 0.45, degrade: 0.5 }],
  ['rosa', { color: '#e0359a', color2: '#39d6ff', motivo: 'ninguno', degrade: 1 }],
  ['tierra', { color: '#3f8fff', color2: '#dff4ff', motivo: 'nubes', cubre: 1.2, motivoCabeza: 'tierra', degrade: 0.3 }],
  ['verde', { color: '#56e05a', color2: '#ffe14a', motivo: 'ninguno', degrade: 0.9, ojos: 'felices' }],
];
for (const [n, a] of A) {
  await pag.evaluate((a) => { const J = window.__A.J; Object.assign(window.__A.G.A, a); J.aplicarApariencia(); }, a);
  await avanzar(pag, 12);
  await pag.screenshot({ path: path.join(SAL, `muneco-${n}.png`), timeout: 120000 });
}
/* de costado, para ver el perfil */
await pag.evaluate(() => { document.querySelector('.flecha-giro[data-g="1"]').click(); document.querySelector('.flecha-giro[data-g="1"]').click(); });
await avanzar(pag, 6);
await pag.screenshot({ path: path.join(SAL, 'muneco-costado.png'), timeout: 120000 });
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
