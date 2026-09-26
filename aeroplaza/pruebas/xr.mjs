// EL VISOR DE VERDAD (vr-xr.js, WebXR) con un Meta Quest 3 de mentira (IWER, el emulador de Meta):
// - en el menú del VR aparece "Visor VR" solo si hay visor;
// - entra a la sesión inmersiva a 120 Hz (lo más alto del Quest 3 hasta 120), en primera persona,
//   y el bucle es el del visor;
// - la cabeza queda en el muñeco (el origen del visor va a sus pies) y lo sigue al moverse;
// - la palanca izquierda camina para donde se mira, la derecha gira de a 45°, A salta;
// - con las manos del visor: se ven las dos (sus 25 articulaciones a los 21 puntos) y el pellizco
//   del visor es el pellizco;
// - salir termina la sesión y vuelve todo.
//     node pruebas/xr.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=minima', { ancho: 700, alto: 400, xr: true });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5);
/* esperar n cuadros del visor (los maneja el emulador, a su ritmo) */
const cuadros = (n) => pag.evaluate(async (n) => { const V = window.__A.visor, c0 = V.cuadros || 0, t0 = performance.now(); while ((V.cuadros || 0) < c0 + n && performance.now() - t0 < 60000) await new Promise((ok) => setTimeout(ok, 20)); return (V.cuadros || 0) - c0; }, n);

/* 1) la opción en el menú */
await pag.evaluate(() => window.__A.J.pausar(true)); await pag.waitForTimeout(200);
await pag.evaluate(() => document.querySelector('[data-a=vr]').click());
await pag.waitForFunction(() => document.querySelector('.vr-op[data-xr]'), null, { timeout: 5000 }).catch(() => {});
const hay = await pag.evaluate(() => !!document.querySelector('.vr-op[data-xr]'));
prueba('con visor, el menú del VR ofrece "Visor VR"', hay);
/* 2) entrar */
await pag.evaluate(() => document.querySelector('.vr-op[data-xr]')?.click());
await pag.waitForFunction(() => window.__A.visor.activo, null, { timeout: 30000 }).catch(() => {});
const n1 = await cuadros(4);
const r2 = await pag.evaluate(() => { const A = window.__A, s = A.visor.sesion; return { sesion: !!s, hz: s?.frameRate, presenta: A.motor.r.xr.isPresenting, vr: A.vr.activo, fp: A.cam.fp, hud: A.UI.hud.style.display, manos: A.manos.activa && A.manos.fuente }; });
prueba('entra a la sesión inmersiva a 120 Hz, en primera persona y sin interfaz', r2.sesion && r2.hz === 120 && r2.presenta && r2.vr && r2.fp && r2.hud === 'none' && n1 >= 4, JSON.stringify({ ...r2, cuadros: n1 }));
/* 3) la cabeza en el muñeco */
await cuadros(3);
const r3 = await pag.evaluate(() => { const A = window.__A, c = A.motor.camara.position, p = A.yo.p; return { dx: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2), alto: +(c.y - p.y).toFixed(2) }; });
prueba('la cabeza del visor queda en el muñeco (a la altura de la cabeza)', r3.dx < 0.3 && r3.alto > 1.2 && r3.alto < 2, JSON.stringify(r3));
/* 4) la palanca izquierda camina para donde se mira; la derecha gira 45°; A salta */
const r4 = await pag.evaluate(async () => {
  const A = window.__A, D = window.__xrdev, V = A.visor, espera = async (n) => { const c0 = V.cuadros; while (V.cuadros < c0 + n) await new Promise((ok) => setTimeout(ok, 20)); };
  const p0 = A.yo.p.clone(), yaw = A.cam.yaw;
  D.controllers.left.updateAxes('thumbstick', 0, -1); await espera(8); D.controllers.left.updateAxes('thumbstick', 0, 0); await espera(2);
  const d = A.yo.p.clone().sub(p0); d.y = 0;
  const hacia = (d.x * -Math.sin(yaw) + d.z * -Math.cos(yaw)) / (d.length() || 1);
  const b0 = A.vr.base; D.controllers.right.updateAxes('thumbstick', 1, 0); await espera(3); D.controllers.right.updateAxes('thumbstick', 0, 0); await espera(2);
  const giro = (A.vr.base - b0) * 180 / Math.PI;
  const y0 = A.yo.p.y; D.controllers.right.updateButtonValue('a-button', 1); let sube = 0; for (let i = 0; i < 6; i++) { await espera(1); sube = Math.max(sube, A.yo.p.y - y0); } D.controllers.right.updateButtonValue('a-button', 0); await espera(10);
  return { camino: +d.length().toFixed(2), hacia: +hacia.toFixed(2), giro: +giro.toFixed(1), sube: +sube.toFixed(2) };
});
prueba('la palanca izquierda camina para donde se mira', r4.camino > 0.5 && r4.hacia > 0.8, JSON.stringify(r4));
prueba('la derecha gira de a 45° y A salta', Math.abs(Math.abs(r4.giro) - 45) < 0.5 && r4.sube > 0.3, JSON.stringify(r4));
/* 5) las manos del visor */
const r5 = await pag.evaluate(async () => {
  const A = window.__A, D = window.__xrdev, V = A.visor, espera = async (n) => { const c0 = V.cuadros; while (V.cuadros < c0 + n) await new Promise((ok) => setTimeout(ok, 20)); };
  D.primaryInputMode = 'hand'; await espera(6);
  const [I, De] = A.manos.manos, cab = A.motor.camara.position;
  const dist = (M) => M.visible ? +M.punto(0).distanceTo(cab).toFixed(2) : null;
  const vis = [I.visible, De.visible], d = [dist(I), dist(De)], pell0 = De.pellizca;
  D.hands.right.updatePinchValue(1); await espera(6); const pell1 = De.pellizca;
  D.hands.right.updatePinchValue(0); await espera(6); const pell2 = De.pellizca;
  return { vis, d, pell: [pell0, pell1, pell2], capsulas: A.manos.geo.instanceCount, enEscena: !!A.manos.escena.parent };
});
await pag.screenshot({ path: path.join(SAL, 'xr-manos.png') });
prueba('con las manos del visor se ven las dos, cerca de la cabeza', r5.vis[0] && r5.vis[1] && r5.d.every((x) => x > 0.15 && x < 0.9) && r5.capsulas === 48 && r5.enEscena, JSON.stringify(r5));
prueba('el pellizco del visor es el pellizco', JSON.stringify(r5.pell) === '[false,true,false]', JSON.stringify(r5.pell));
/* 6) salir */
await pag.evaluate(() => window.__A.vr.salir());
await pag.waitForFunction(() => !window.__A.visor.activo, null, { timeout: 20000 }).catch(() => {});
const r6 = await pag.evaluate(() => { const A = window.__A; return { visor: A.visor.activo, vr: A.vr.activo, xr: A.motor.r.xr.enabled, hud: A.UI.hud.style.display, manos: A.manos.activa, fp: A.cam.fp }; });
prueba('salir termina la sesión y vuelve la interfaz', !r6.visor && !r6.vr && !r6.xr && r6.hud === '' && !r6.manos, JSON.stringify(r6));
await avanzar(pag, 3);
prueba('sin errores', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
await ctx.close();
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
