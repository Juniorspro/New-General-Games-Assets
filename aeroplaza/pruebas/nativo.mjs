// LA APK (android/), sin celu: el puente con Android de mentira (window.AeroplazaNativo, como
// MainActivity.java › Puente) y lo que mandaría Java (window.__nativo.pose / .manos / .estado):
// - al entrar al VR se prende ARCore, y al salir se apaga;
// - la cabeza de ARCore mueve la vista: 30 cm de costado corren la cámara 30 cm (en la dirección de
//   la derecha de la vista), girar 30° gira la vista 30°, y girar en el lugar no la corre (los ojos
//   van detrás del celu);
// - si ARCore deja de mandar, sigue el giroscopio sin saltar de rumbo;
// - con las manos, son las de Android (no se abre la cámara de la web): una mano a 35 cm de la cámara
//   aparece donde tiene que estar en el mundo;
// - el flash va a ARCore.
//     node pruebas/nativo.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
/* (el puente, antes de que cargue el juego: lo que se llama queda anotado) */
await pag.addInitScript(() => {
  window.__llamadas = [];
  const anota = (n) => (...a) => { window.__llamadas.push([n, ...a]); };
  window.AeroplazaNativo = {
    version: () => '1', arEstado: () => 'si',
    arIniciar: (m) => { window.__llamadas.push(['arIniciar', m]); setTimeout(() => window.__nativo?.estado('corre'), 30); },
    arParar: anota('arParar'), arManos: anota('arManos'), flash: anota('flash'), vibrar: anota('vibrar')
  };
});
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);
prueba('en la APK el juego ve el puente', await pag.evaluate(() => window.__A.Nativo.hay && window.__A.Nativo.puedeAR));

await pag.evaluate(() => window.__A.J.entrarVR(true, false));
await avanzar(pag, 3, 1 / 30, false);
const llamo = await pag.evaluate(() => window.__llamadas.map((x) => x[0]));
prueba('al entrar al VR se prende ARCore', llamo.includes('arIniciar'), llamo.join(','));

/* la cabeza de ARCore: quieta 0,3 s, 30 cm a la derecha (de la cámara de ARCore) en 1 s, girar 30° en
   el lugar. Cada pose con 20 ms de foto, a 60 por segundo, y un paso del juego */
const mover = (tramo) => pag.evaluate(async (tramo) => {
  const A = window.__A, q = new A.THREE.Quaternion(), e = new A.THREE.Euler(), sal = [];
  const N = Math.round(tramo.seg * 60);
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = tramo.x0 + (tramo.x1 - tramo.x0) * u, yaw = (tramo.g0 + (tramo.g1 - tramo.g0) * u) * Math.PI / 180;
    q.setFromEuler(e.set(0, yaw, 0, 'YXZ'));
    /* (el celu gira alrededor de los ojos: la cámara va 6 cm adelante de ellos) */
    const ox = x, oz = 0, cx = ox - Math.sin(yaw) * 0.06, cz = oz - Math.cos(yaw) * 0.06;
    window.__nativo.pose(20, cx, 1.5, cz, q.x, q.y, q.z, q.w, 1, '60');
    A.paso(1 / 60, false);
    await new Promise((r) => setTimeout(r, 16));
  }
  const c = A.motor.camara, v = new A.THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
  return { p: c.position.toArray(), yaw: Math.atan2(-v.x, -v.z) * 180 / Math.PI, conAR: A.vr.conAR, d: A.vr.desplazo.toArray(), yo: [A.yo.p.x, A.yo.p.y, A.yo.p.z] };
}, tramo);
const r0 = await mover({ seg: 0.3, x0: 0, x1: 0, g0: 0, g1: 0 });
const r1 = await mover({ seg: 1, x0: 0, x1: 0.3, g0: 0, g1: 0 });
/* (lo que se corrió la vista, contra lo que se corrió el muñeco, que puede caminar solo) */
const corrio = (a, b) => Math.hypot(b.d[0] - a.d[0], b.d[1] - a.d[1], b.d[2] - a.d[2]);
prueba('la vista sigue a ARCore: 30 cm de costado corren la cabeza 30 cm', r1.conAR && Math.abs(corrio(r0, r1) - 0.3) < 0.03, `${(corrio(r0, r1) * 100).toFixed(1)} cm · con ARCore ${r1.conAR}`);
/* (quieto un rato: la última foto del paso todavía venía adelantada) */
const r1b = await mover({ seg: 0.3, x0: 0.3, x1: 0.3, g0: 0, g1: 0 });
const r2 = await mover({ seg: 0.8, x0: 0.3, x1: 0.3, g0: 0, g1: 30 });
const r2b = await mover({ seg: 0.3, x0: 0.3, x1: 0.3, g0: 30, g1: 30 });
const dy = ((r2b.yaw - r1b.yaw + 540) % 360) - 180;
prueba('girar 30° gira la vista 30° y no corre la cabeza (los ojos van detrás del celu)', Math.abs(Math.abs(dy) - 30) < 2 && corrio(r1b, r2) < 0.01 && corrio(r1b, r2b) < 0.005, `giró ${dy.toFixed(1)}° · se corrió ${(corrio(r1b, r2) * 100).toFixed(1)} cm girando, ${(corrio(r1b, r2b) * 100).toFixed(1)} al final`);

/* ARCore deja de mandar: el giroscopio (de mentira, el celu acostado mirando derecho) sigue sin saltar */
const r3 = await pag.evaluate(async () => {
  const A = window.__A, v = new A.THREE.Vector3(), yaw = () => { v.set(0, 0, -1).applyQuaternion(A.motor.camara.quaternion); return Math.atan2(-v.x, -v.z) * 180 / Math.PI; };
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 0, gamma: -90 }));
  A.paso(1 / 60, false); const antes = yaw();
  await new Promise((r) => setTimeout(r, 400));
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 0, gamma: -90 }));
  A.paso(1 / 60, false);
  return { antes, despues: yaw(), conAR: A.vr.conAR };
});
const salto = Math.abs(((r3.despues - r3.antes + 540) % 360) - 180);
prueba('si ARCore se calla, sigue el giroscopio sin saltar de rumbo', !r3.conAR && salto < 3, `saltó ${salto.toFixed(1)}°`);

/* las manos: las de Android. Una mano abierta a 35 cm, frente a la cámara, algo abajo y a la derecha */
await pag.evaluate(() => window.__A.prenderManos());
await pag.waitForTimeout(100);
const rm = await pag.evaluate(async () => {
  const A = window.__A, q = new A.THREE.Quaternion();
  const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025], [-0.022, 0.085, 0], [-0.025, 0.12, 0], [-0.026, 0.143, 0], [-0.027, 0.162, 0], [0, 0.088, 0], [0, 0.128, 0], [0, 0.153, 0], [0, 0.173, 0], [0.02, 0.083, 0], [0.022, 0.118, 0], [0.023, 0.14, 0], [0.024, 0.158, 0], [0.037, 0.073, 0], [0.042, 0.1, 0], [0.045, 0.117, 0], [0.047, 0.132, 0]];
  const TX = 0.6, TY = 0.35, M = [0.05, -0.1, -0.35];   // (el campo de la cámara, y la muñeca en la cámara)
  const cen = [0, 5, 9, 13, 17].reduce((a, i) => a.map((v, k) => v + ABIERTA[i][k] / 5), [0, 0, 0]);
  const mano = () => {
    const I = [], W = [];
    for (const p of ABIERTA) { const x = M[0] - p[0], y = M[1] + p[1], z = M[2] - p[2]; I.push(0.5 + x / -z / (2 * TX), 0.5 - y / -z / (2 * TY), 0); W.push(-(p[0] - cen[0]), -(p[1] - cen[1]), p[2] - cen[2]); }
    return { e: 25, tx: TX, ty: TY, ms: 12, w: 640, h: 480, g: 1, luz: 0.4, d: 'GPU', m: [{ d: 1, c: 0.95, i: I, w: W }] };
  };
  for (let i = 0; i < 40; i++) {
    window.__nativo.pose(20, 0.3, 1.5, -0.06, q.x, q.y, q.z, q.w, 1, '60');
    if (i % 2 === 0) window.__nativo.manos(mano());
    A.paso(1 / 60, false);
    await new Promise((r) => setTimeout(r, 16));
  }
  const c = A.motor.camara, H = A.manos.manos.find((x) => x.visible);
  /* dónde tiene que estar la muñeca: la cámara del celu (6 cm delante de los ojos) más el punto */
  const esperado = new A.THREE.Vector3(M[0], M[1], M[2] - 0.06).applyQuaternion(c.quaternion).add(c.position);
  const dib = H ? new A.THREE.Vector3(H.p[0], H.p[1], H.p[2]) : null;
  return { nativa: A.camManos?.nativa ? 'ManosNativas' : A.camManos?.constructor?.name, visible: !!H, err: dib ? dib.distanceTo(esperado) : null, llamadas: window.__llamadas.map((x) => x[0]), datos: A.camManos?.datos?.() };
});
prueba('con ARCore, las manos son las de Android (la web no abre la cámara)', rm.nativa === 'ManosNativas' && rm.llamadas.includes('arManos'), `${rm.nativa} · ${rm.datos}`);
prueba('la mano de Android aparece donde está (a menos de 3 cm)', rm.visible && rm.err < 0.03, rm.err == null ? 'no se ve' : `${(rm.err * 100).toFixed(1)} cm`);

await pag.evaluate(() => window.__A.vr.alFlash(true));
prueba('el flash va a ARCore', await pag.evaluate(() => window.__llamadas.some((x) => x[0] === 'flash' && x[1] === true)));
await pag.evaluate(() => window.__A.J.salirVR());
prueba('al salir del VR se apaga ARCore', await pag.evaluate(() => window.__llamadas.some((x) => x[0] === 'arParar') && !window.__A.vr.activo));
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
