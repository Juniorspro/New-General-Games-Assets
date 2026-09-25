// PARKOUR AERO: arma los 5 mapas, saca una foto de cada uno de lejos y otra al
// arrancar, y comprueba que la carrera anda: la cuenta, el reloj, los controles,
// una caída (vuelve al último control), una plataforma que se mueve y te lleva,
// y la llegada con estrellas y récord.
//     node pruebas/parkour.mjs [nivel,…]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const pedidos = (process.argv[2] || '0,1,2,3,4,5').split(',').map(Number);
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
for (const n of pedidos) {
  const { pag, ctx, errores } = await abrir(nav, `directo&pausa&reino=parkour&nivel=${n}&calidad=alta`);
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.parkour, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 20);
  await pag.screenshot({ path: path.join(SAL, `parkour-${n}-inicio.png`) });
  const r = await pag.evaluate(async () => {
    const A = window.__A, R = A.reino, E = R.parkour, yo = A.yo, S = {};
    S.nombre = E.nombre; S.cuenta = E.fase;
    for (let i = 0; i < 110; i++) A.paso(1 / 30, false);
    S.corre = E.fase; S.reloj = +E.tiempo.toFixed(2);
    /* los controles: se va de uno en uno (teletransportado) */
    const C = R.grupo; let controles = 0;
    const pasar = (p) => { yo.ponerEn(new A.THREE.Vector3(p.x, p.y + 0.3, p.z), 0); for (let i = 0; i < 6; i++) A.paso(1 / 30, false); };
    const puntos = []; R.grupo.traverse((o) => { if (o.geometry?.type === 'TorusGeometry' && o.geometry.parameters.radius === 1.25) puntos.push(o.position.clone().setY(o.position.y - 1.45)); });
    for (const p of puntos) { pasar(p); controles++; }
    S.controles = controles; S.control = E.control.toArray().map((v) => +v.toFixed(1));
    /* una caída: vuelve al último control */
    yo.p.y -= 60; A.paso(1 / 30, false); A.paso(1 / 30, false);
    S.caidas = E.caidas; S.volvio = yo.p.distanceTo(E.control) < 1;
    /* la llegada */
    const meta = []; R.grupo.traverse((o) => { if (o.geometry?.type === 'TorusGeometry' && o.geometry.parameters.radius === 2.2) meta.push(o.parent.position.clone()); });
    yo.ponerEn(meta[0].clone().setY(meta[0].y + 0.7), 0); for (let i = 0; i < 40; i++) A.paso(1 / 30, false);
    S.fin = E.fase; S.tiempo = +E.tiempo.toFixed(1);
    await new Promise((ok) => setTimeout(ok, 1500));
    S.ventana = !!document.querySelector('.pk-resultado'); S.estrellas = document.querySelectorAll('.pk-est i.si').length; S.mejor = A.G.parkour.mejor[R.nivel];
    return S;
  });
  prueba(`mapa ${n + 1} (${r.nombre}): la cuenta y después el reloj`, r.cuenta === 'cuenta' && r.corre === 'corre' && r.reloj > 0, `reloj ${r.reloj} s`);
  prueba(`mapa ${n + 1}: ${r.controles} controles, se guarda el último`, r.controles >= 2, JSON.stringify(r.control));
  prueba(`mapa ${n + 1}: al caer vuelve al control`, r.caidas === 1 && r.volvio);
  prueba(`mapa ${n + 1}: la llegada con estrellas y récord`, r.fin === 'fin' && r.ventana && r.estrellas >= 1 && r.mejor > 0, `${r.tiempo} s, ${r.estrellas} ★`);
  /* una foto de lejos del mapa entero */
  await pag.evaluate(() => { const A = window.__A; A.UI.cerrarVentana(); document.getElementById('ui').style.display = 'none'; const c = A.motor.camara; c.position.set(70, A.reino.inicio.y + 45, 30); c.lookAt(0, A.reino.inicio.y + 5, -70); c.far = 3000; c.updateProjectionMatrix(); A.motor.dibujar(0); });
  await pag.screenshot({ path: path.join(SAL, `parkour-${n}-mapa.png`) });
  const e = errores.filter((x) => !x.includes('ERR_FAILED'));
  if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
  await ctx.close();
}
/* la plataforma que se mueve te lleva (mapa 1, la nube que va y viene) */
{
  const { pag, ctx } = await abrir(nav, 'directo&pausa&reino=parkour&nivel=0&calidad=baja');
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.parkour, null, { timeout: 120000, polling: 250 });
  const r = await pag.evaluate(() => {
    const A = window.__A, R = A.reino, yo = A.yo;
    for (let i = 0; i < 110; i++) A.paso(1 / 30, false);
    const movil = R.mundo.solidos.find((s) => s.t === 'b' && Math.abs(s.z + 51) < 0.1);
    yo.ponerEn(new A.THREE.Vector3(movil.x, movil.y1 + 0.02, movil.z), 0); A.paso(1 / 30, false);
    const x0 = yo.p.x, m0 = movil.x;
    for (let i = 0; i < 20; i++) A.paso(1 / 30, false);
    return { dMovil: movil.x - m0, dYo: yo.p.x - x0, arriba: Math.abs(yo.p.y - movil.y1) < 0.1 };
  });
  prueba('la nube que se mueve te lleva', Math.abs(r.dMovil) > 0.3 && Math.abs(r.dYo - r.dMovil) < 0.15 && r.arriba, JSON.stringify(r));
  await ctx.close();
}
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
