// LA CABEZA EN 6 EJES, SUAVE (vuelta 39), de punta a punta:
// 1) Java (android/…/Fusion.java) con una cabeza de mentira (pruebas/cabeza/PruebaFusion.java): el giroscopio del
//    sistema corregido con ARCore, contra ARCore solo (lo de antes).
// 2) El juego, con la cabeza nativa (AeroplazaNativo.cabeza, como Cabeza.java):
//    - el VR la usa: gira y se corre con ella, aunque ARCore mande otra cosa; se le pide adelantada a cuando se ve;
//    - tu espacio también (la cabeza es la de ARCore, con el giro del giroscopio);
//    - si no hay (una APK vieja, o todavía sin los ejes: ""), sigue con la pose de ARCore como antes.
//     node pruebas/cabeza.mjs   (sin javac, la parte 1 no corre)
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  const CL = path.join(SAL, 'cabeza-clases'); fs.rmSync(CL, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CL, path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza/Fusion.java'), path.join(AQUI, 'cabeza/PruebaFusion.java')], { stdio: 'inherit' });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CL, 'ar.aeroplaza.PruebaFusion'], { encoding: 'utf8' }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) { if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } else if (/^\s+\(/.test(l)) console.log(l); }
} else console.log('(sin javac: la parte de Java no corre)');

/* 2) el juego */
const nav = await navegador();
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.addInitScript(() => {
  window.__llamadas = []; window.__cab = null; window.__adelantos = [];
  const anota = (n) => (...a) => { window.__llamadas.push([n, ...a]); };
  window.AeroplazaNativo = {
    version: () => '1', arEstado: () => 'si',
    arIniciar: (m) => { window.__llamadas.push(['arIniciar', m]); setTimeout(() => window.__nativo?.estado('corre'), 30); },
    arParar: anota('arParar'), arManos: anota('arManos'), manosDos: anota('manosDos'), flash: anota('flash'), vibrar: anota('vibrar'),
    arEscanear: anota('arEscanear'), arPasante: anota('arPasante'), arOlvidar: anota('arOlvidar'), arProfundidad: anota('arProfundidad'),
    /* (la cabeza nativa: la que ponga la prueba en __cab, o "" si todavía no) */
    cabeza: (ad) => { window.__adelantos.push(ad); const c = window.__cab; return c ? c.join(',') : ''; },
  };
});
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);
await pag.evaluate(() => window.__A.J.entrarVR(true, false));
await avanzar(pag, 3, 1 / 30, false);

/* ARCore manda siempre lo mismo (quieto, mirando adelante); la cabeza nativa gira y se corre */
const tramo = (T) => pag.evaluate(async (T) => {
  const A = window.__A, q = new A.THREE.Quaternion(), e = new A.THREE.Euler();
  const N = Math.round(T.seg * 60);
  for (let i = 0; i <= N; i++) {
    const u = i / N, yaw = (T.g0 + (T.g1 - T.g0) * u) * Math.PI / 180, x = T.x0 + (T.x1 - T.x0) * u;
    window.__nativo.pose(20, 0, 1.5, -0.06, 0, 0, 0, 1, 1, '60');
    q.setFromEuler(e.set(0, yaw, 0, 'YXZ'));
    window.__cab = T.sin ? null : [q.x, q.y, q.z, q.w, x, 1.5, 0];
    A.paso(1 / 60, false);
    await new Promise((r) => setTimeout(r, 16));
  }
  const c = A.motor.camara, v = new A.THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
  return { yaw: Math.atan2(-v.x, -v.z) * 180 / Math.PI, d: A.vr.desplazo.toArray(), con: A.Nativo.conCabeza, conAR: A.vr.conAR };
}, T);
const a = await tramo({ seg: 0.4, g0: 0, g1: 0, x0: 0, x1: 0 });
const b = await tramo({ seg: 0.8, g0: 0, g1: 30, x0: 0, x1: 0 });
const b2 = await tramo({ seg: 0.2, g0: 30, g1: 30, x0: 0, x1: 0 });
const dy = ((b2.yaw - a.yaw + 540) % 360) - 180;
prueba('el VR gira con la cabeza nativa (el giroscopio), aunque ARCore no se mueva', b2.con && b2.conAR && Math.abs(Math.abs(dy) - 30) < 1.5, `giró ${dy.toFixed(1)}° · con la cabeza ${b2.con}`);
const c = await tramo({ seg: 0.8, g0: 30, g1: 30, x0: 0, x1: 0.2 });
const c2 = await tramo({ seg: 0.2, g0: 30, g1: 30, x0: 0.2, x1: 0.2 });
const corrio = Math.hypot(c2.d[0] - b2.d[0], c2.d[2] - b2.d[2]);
prueba('y se corre con los ojos que da (20 cm de costado → 20 cm)', Math.abs(corrio - 0.2) < 0.02, `${(corrio * 100).toFixed(1)} cm`);
const ad = await pag.evaluate(() => window.__adelantos.slice(-60));
const adM = ad.reduce((s, x) => s + x, 0) / Math.max(1, ad.length);
prueba('la pide adelantada a cuando se va a ver (de 0 a 40 ms)', ad.length > 0 && ad.every((x) => x >= 0 && x <= 40) && adM > 5, `${adM.toFixed(1)} ms en promedio`);
/* sin la cabeza nativa (""): con ARCore, como antes */
const d = await tramo({ seg: 0.4, g0: 30, g1: 30, x0: 0.2, x1: 0.2, sin: true });
prueba('sin la cabeza nativa todavía, sigue con la pose de ARCore', !d.con && d.conAR, JSON.stringify({ con: d.con, conAR: d.conAR }));
await pag.evaluate(() => window.__A.J.salirVR());

/* tu espacio: la cabeza de la escena es la nativa */
const r = await pag.evaluate(async () => {
  const A = window.__A, { UI, THREE } = A;
  UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.menu-vr [data-sbs="0"]').click(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.vr-ar [data-ar="espacio"]').click(); await new Promise((r) => setTimeout(r, 200));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.7, 0, 'YXZ'));
  for (let i = 0; i < 20; i++) { window.__nativo.pose(20, 0, 1.5, -0.06, 0, 0, 0, 1, 1, '60'); window.__cab = [q.x, q.y, q.z, q.w, 0.4, 1.4, -0.3]; A.paso(1 / 60, false); await new Promise((r) => setTimeout(r, 16)); }
  const E = A.espacio;
  return { dq: 2 * Math.acos(Math.min(1, Math.abs(E.cabezaQ.dot(q)))) * 180 / Math.PI, p: E.cabezaP.toArray() };
});
prueba('tu espacio usa la cabeza nativa (su giro y sus ojos, en el mundo de ARCore)', r.dq < 0.5 && Math.hypot(r.p[0] - 0.4, r.p[1] - 1.4, r.p[2] + 0.3) < 0.01, `${r.dq.toFixed(2)}° · ${r.p.map((x) => x.toFixed(3)).join(', ')}`);
await pag.evaluate(() => window.__A.J.salirVR());
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
