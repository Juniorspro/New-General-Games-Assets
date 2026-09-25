// Recorre la isla grande: abre una vez, lleva al muñeco a cada región y saca una
// foto (pruebas/salida/mundo-<lugar>.png). Además mide cuánto tarda en armarse
// y cuánto se dibuja, y prueba el monorriel (subir, viajar, bajar).
//     node pruebas/mundo.mjs [lugar,lugar…] [--calidad=alta]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const cal = (process.argv.find((a) => a.startsWith('--calidad=')) || '--calidad=alta').split('=')[1];
const pedidos = (process.argv.slice(2).find((a) => !a.startsWith('--')) || '').split(',').filter(Boolean);
/* [x, z, yaw, pitch, dist] */
/* también '@punto' (reino.puntos) y un desvío: ['@faro', dx, dz, yaw, pitch, dist] */
const LUGARES = {
  spawn: [-43.5, 14, -1.75 + Math.PI, 0.18, 7],
  cartel: [-43.5, 14, -0.71, 0.1, 5],
  terminal: [-55, 14, -1.5, 0.25, 10],
  andenes: [-58.5, 2, 3.14, 0.2, 6],
  plaza: [-6, -6, 0.8, 0.35, 11],
  ciudad: [100, -20, -1.3, 0.2, 14],
  bahia: [105, 105, -2.35, 0.25, 12],
  faro: ['@finMuelle', 0, 0, -2.36, 0.15, 8],
  pradera: [-100, 100, 0.75, 0.25, 12],
  bosque: [-110, -95, 0.9, 0.25, 10],
  casaArbol: ['@casaArbol', 9, 9, 0.8, 0.3, 14],
  monte: [22, -110, 0.1, 0.3, 12],
  cumbre: ['@monte', 0, 9, 0, 0.25, 9],
  cascada: ['@pozo', 0, 14, 0, 0.2, 10],
  aire: [0, 0, 0.6, 1.2, 14],
};
const nav = await navegador();
const t0 = Date.now();
const { pag, errores } = await abrir(nav, 'directo&pausa&hora=0.42&calidad=' + cal);
await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 240000, polling: 250 });
console.log(`armado: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await avanzar(pag, 5);
for (const [n, L] of Object.entries(LUGARES)) {
  if (pedidos.length && !pedidos.includes(n)) continue;
  let [x, z, yaw, pitch, dist] = L;
  if (typeof L[0] === 'string') { const P = await pag.evaluate((k) => window.__A.reino.puntos[k], L[0].slice(1)); [x, z, yaw, pitch, dist] = [P[0] + L[1], P[1] + L[2], L[3], L[4], L[5]]; }
  await pag.evaluate(([x, z, yaw, pitch, dist, n]) => {
    const A = window.__A, M = A.reino.mundo;
    A.yo.ponerEn(new A.THREE.Vector3(x, M.suelo(x, z, 999).y + 0.05, z), yaw + Math.PI);
    A.cam.yaw = yaw; A.cam.pitch = pitch; A.cam.dist = A.cam.distObj = dist; A.cam.inicial = true;
    if (n === 'aire') { A.cam.distObj = A.cam.dist = 14; }
  }, [x, z, yaw, pitch, dist, n]);
  await avanzar(pag, 12);
  if (n === 'aire') await pag.evaluate(() => { const A = window.__A; A.motor.camara.position.set(0, 420, 330); A.motor.camara.lookAt(0, 0, -10); A.motor.camara.far = 3000; A.motor.camara.updateProjectionMatrix(); A.motor.dibujar(0); });
  const info = await pag.evaluate(() => { const A = window.__A, I = A.motor.r.info; I.autoReset = false; I.reset(); A.motor.dibujar(0); const r = I.render, o = { calls: r.calls, tris: r.triangles }; I.autoReset = true; return o; });
  await pag.screenshot({ path: path.join(SAL, `mundo-${n}.png`), timeout: 120000 });
  console.log(`${n}: ${info.calls} llamadas · ${(info.tris / 1e6).toFixed(2)} M triángulos`);
}
/* el monorriel: subirse en la terminal, esperar que salga y que pare en la próxima */
if (!pedidos.length || pedidos.includes('tren')) {
  const r = await pag.evaluate(() => {
    const A = window.__A, M = A.reino.monorriel, S = [];
    const tr = M.trenes[0]; let reloj = 0; M.reloj = () => reloj;
    /* la hora en que el tren 0 está en la terminal */
    let ini = 0; while (M.estado(tr, ini).parada !== 0 && ini < M.periodo) ini += 0.5;
    reloj = ini + 1; M.actualizar();
    A.yo.montar(tr.montura);
    S.push({ periodo: +M.periodo.toFixed(1), largo: Math.round(M.L), paradas: M.paradas.map((q) => q.id).join(',') });
    for (let i = 0; i < 90; i++) { reloj += 1; A.paso(1 / 30, false); }
    S.push({ andando: tr.parada < 0 || tr.parada > 0, v: +tr.v.toFixed(1), y: +A.yo.p.y.toFixed(1), modo: A.yo.modo });
    /* hasta que pare en la siguiente */
    let n = 0; while (tr.parada !== 1 && n < 400) { reloj += 0.5; A.paso(1 / 30, false); n++; }
    S.push({ paradaSiguiente: M.paradas[tr.parada]?.id, espera: n * 0.5 });
    return S;
  });
  console.log('monorriel:', JSON.stringify(r));
  await pag.evaluate(() => { const A = window.__A; A.cam.dist = A.cam.distObj = 9; });
  await avanzar(pag, 8);
  await pag.screenshot({ path: path.join(SAL, 'mundo-tren.png'), timeout: 120000 });
  const b = await pag.evaluate(() => {
    const A = window.__A;
    const E = { x: 0, z: 0, accion: true }; A.yo.actualizar(1 / 30, E, A.reino.mundo);
    return { modo: A.yo.modo, p: A.yo.p.toArray().map((v) => +v.toFixed(1)), eventos: A.yo.eventos.join(',') };
  });
  console.log('bajar:', JSON.stringify(b));
  await avanzar(pag, 8);
  await pag.screenshot({ path: path.join(SAL, 'mundo-bajada.png'), timeout: 120000 });
}
console.log([...new Set(errores.filter((e) => !e.includes('ERR_FAILED')))].join('\n') || 'sin errores');
await nav.close();
