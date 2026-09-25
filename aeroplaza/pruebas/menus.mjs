// Que los menús entren sin desplazar: abre cada ventana en un celu acostado
// (844×390) y en una compu, mide si el contenido se pasa del alto y saca foto.
//     node pruebas/menus.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let malos = 0;
for (const [nombre, tam] of [['celu', { ancho: 844, alto: 390, movil: true }], ['compu', { ancho: 1280, alto: 720 }]]) {
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&hora=0.45&calidad=baja', tam);
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.UI.hud, null, { timeout: 240000, polling: 250 });
  await avanzar(pag, 3);
  const VENTANAS = {
    pausa: 'U.pausa()', opciones: 'U.opciones()', 'opciones-imagen': "U.opciones(null, 'imagen')", 'opciones-juego': "U.opciones(null, 'juego')", 'opciones-datos': "U.opciones(null, 'datos')",
    controles: 'U.controles()', estilo: 'U.estilo()', 'estilo-ajuste': "U.estilo(null, 'ajuste')", discos: 'U.discos()', gestos: 'U.gestos()', viaje: "U.viaje('plaza', () => {})", mapa: 'U.mapa((c) => window.__A.J && null)',
    probador: 'window.__A.J.abrirProbador()',
  };
  for (const [v, cod] of Object.entries(VENTANAS)) {
    const r = await pag.evaluate(async (cod) => {
      const U = window.__A.UI; U.cerrarVentana(); document.querySelector('.probador')?.querySelector('[data-a=listo]')?.click();
      eval(cod);
      await new Promise((ok) => setTimeout(ok, 400));
      const q = document.querySelector('.ventana .cuerpo') || document.querySelector('.opciones-prob');
      const vent = document.querySelector('.ventana') || document.querySelector('.probador');
      return { sobra: q ? q.scrollHeight - q.clientHeight : 0, alto: vent ? Math.round(vent.getBoundingClientRect().height) : 0, pag: document.querySelector('.paginas span')?.textContent || '' };
    }, cod);
    await pag.screenshot({ path: path.join(SAL, `menu-${nombre}-${v}.png`) });
    const ok = r.sobra <= 2;
    if (!ok) malos++;
    console.log(`${nombre} ${v}: ${ok ? '✓' : '✗ se pasa ' + r.sobra + ' px'} (alto ${r.alto}${r.pag ? ', páginas ' + r.pag : ''})`);
  }
  const e = errores.filter((x) => !x.includes('ERR_FAILED'));
  if (e.length) console.log('errores:', [...new Set(e)].join(' | '));
  await ctx.close();
}
console.log(malos ? `${malos} ventanas se pasan` : 'todas entran');
await nav.close();
