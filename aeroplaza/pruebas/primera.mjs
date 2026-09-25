// LA PRIMERA PERSONA CON CUERPO (primera.js) y los minijuegos en primera persona:
// - adentro de un edificio: los brazos en la cámara, sin la cabeza propia, y
//   mirando abajo se ven la panza y las piernas;
// - el parkour con el botón 👁: en primera persona, los brazos que corren y la
//   vista que baja al deslizarse;
// - TIRO DE BURBUJAS: la cuenta, se apunta con la mira, la burbuja sale de la
//   mano derecha y revienta un blanco (puntos y racha), una que se pierde corta
//   la racha, y al terminar el tiempo sale el resultado con estrellas y récord.
//     node pruebas/primera.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=media&hora=0.3');
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.yo && window.__A.UI.hud, null, { timeout: 120000, polling: 250 });
await pag.addStyleTag({ content: '.tuto{display:none!important}' });
const foto = async (n) => { await avanzar(pag, 2); await pag.screenshot({ path: path.join(SAL, `primera-${n}.png`) }); };

/* 1. adentro del hotel */
await pag.evaluate(() => { window.__A.entrarReino('interior', { tipo: 'hotel', i: 0 }); for (let i = 0; i < 20; i++) window.__A.paso(1 / 30, false); });
let r = await pag.evaluate(() => { const A = window.__A, m = A.yo.m; const sombra = (q) => q.material.colorWrite === false && q.castShadow; return { fp: A.cam.fp, brazosCam: A.cuerpoFP.g.visible, cabeza: sombra(m.cabezaM), brazos: m.brazos.every((b) => sombra(b.userData.m)), cuerpo: sombra(m.cuerpo), piernas: m.piernas.every((p) => p.visible && p.userData.m.material.colorWrite !== false), ojos: m.ojos.visible }; });
prueba('en primera persona: brazos en la cámara; cabeza, cuerpo y brazos propios solo dan sombra; las piernas se ven', r.fp && r.brazosCam && r.cabeza && r.brazos && r.cuerpo && r.piernas && !r.ojos, JSON.stringify(r));
await pag.evaluate(() => { window.__A.cam.yaw = 0; window.__A.cam.pitch = 0.3; });
await foto('1-brazos');
/* mirando abajo, caminando: las piernas se mueven */
await pag.keyboard.down('KeyW');
r = await pag.evaluate(() => { const A = window.__A, xs = []; for (let i = 0; i < 20; i++) { A.cam.yaw = 0; A.cam.pitch = 1.5; A.paso(1 / 30, false); xs.push(A.yo.m.piernas[0].rotation.x); } return { rango: Math.max(...xs) - Math.min(...xs), brazo: A.cuerpoFP.brazos[0].p.position.z }; });
await foto('2-piernas');
await pag.keyboard.up('KeyW');
prueba('caminando, mirando abajo se ven las piernas moverse', r.rango > 0.4, `las piernas van ${r.rango.toFixed(2)} rad`);
/* 2. el parkour en primera persona */
await pag.evaluate(() => { const A = window.__A; A.G.parkour.fp = true; A.entrarReino('parkour', { nivel: 5, fp: true }); for (let i = 0; i < 110; i++) A.paso(1 / 30, false); });
r = await pag.evaluate(() => ({ fp: window.__A.cam.fp, mira: !!document.querySelector('.mira'), fase: window.__A.reino.parkour.fase }));
prueba('el parkour con 👁 va en primera persona (sin el punto de apuntar)', r.fp && !r.mira && r.fase === 'corre', JSON.stringify(r));
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
await pag.evaluate(() => { const A = window.__A; for (let i = 0; i < 18; i++) { A.cam.yaw = 0; A.cam.pitch = 0.3; A.paso(1 / 30, false); } });
await foto('3-parkour-corre');
await pag.keyboard.down('KeyC'); await pag.evaluate(() => window.__A.paso(1 / 30, false)); await pag.keyboard.up('KeyC');
r = await pag.evaluate(() => { const A = window.__A; for (let i = 0; i < 8; i++) { A.cam.yaw = 0; A.paso(1 / 30, false); } return { e: A.yo.estado, baja: A.cam.bajaFP }; });
await foto('4-parkour-desliza');
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');
prueba('deslizándose en primera persona la vista baja', r.e === 'desliza' && r.baja < -0.4, JSON.stringify(r));
/* 3. el tiro de burbujas */
await pag.evaluate(() => { const A = window.__A; A.entrarReino('tiro'); });
r = await pag.evaluate(() => { const A = window.__A, E = A.reino.tiro, S = { fase0: E.fase }; for (let i = 0; i < 120; i++) A.paso(1 / 30, false); S.fase = E.fase; S.fp = A.cam.fp; S.mira = !!document.querySelector('.mira'); S.hud = !!document.querySelector('.pk-hud.tiro'); S.vivos = A.reino.blancos.filter((b) => b.vivo).length; return S; });
prueba('el tiro: cuenta, después se juega en primera persona con la mira y blancos', r.fase0 === 'cuenta' && r.fase === 'juega' && r.fp && r.mira && r.hud && r.vivos >= 1, JSON.stringify(r));
/* apuntar a un blanco y tirar (con la tecla F, varias veces hasta pegar) */
const apuntar = () => pag.evaluate(() => {
  const A = window.__A, B = A.reino.blancos.filter((b) => b.vivo && b.esc > 0.9).sort((a, b) => a.G0.position.distanceTo(A.cam.pos) - b.G0.position.distanceTo(A.cam.pos))[0];
  if (!B) return false;
  const o = A.motor.camara.position, p = B.G0.position, dx = p.x - o.x, dz = p.z - o.z, dy = p.y - o.y;
  A.cam.yaw = Math.atan2(-dx, -dz); A.cam.pitch = 0.3 - Math.atan2(dy, Math.hypot(dx, dz)) - 0.02; A.paso(1 / 30, false); return true;
});
let aciertos = 0;
for (let k = 0; k < 12 && aciertos < 3; k++) {
  await apuntar();
  await pag.keyboard.down('KeyF'); await pag.evaluate(() => window.__A.paso(1 / 30, false)); await pag.keyboard.up('KeyF');
  for (let j = 0; j < 4; j++) { await apuntar(); }
  await pag.evaluate(() => { for (let i = 0; i < 20; i++) window.__A.paso(1 / 30, false); });
  aciertos = await pag.evaluate(() => window.__A.reino.tiro.aciertos);
}
await pag.evaluate(() => { window.__A.cuerpoFP.tirar(); for (let i = 0; i < 4; i++) window.__A.paso(1 / 30, false); });
await foto('5-tiro');
r = await pag.evaluate(() => { const E = window.__A.reino.tiro; return { aciertos: E.aciertos, tiros: E.tiros, puntos: E.puntos, racha: E.racha }; });
prueba('apuntando con la mira, las burbujas revientan blancos y suman puntos', r.aciertos >= 2 && r.puntos >= r.aciertos && r.tiros >= r.aciertos, JSON.stringify(r));
/* una que se pierde (tirar al cielo) corta la racha */
r = await pag.evaluate(async () => { const A = window.__A, E = A.reino.tiro; E.racha = 5; E.mult = 2; A.cam.pitch = -0.9; return E.racha; });
await pag.keyboard.down('KeyF'); await pag.evaluate(() => window.__A.paso(1 / 30, false)); await pag.keyboard.up('KeyF');
r = await pag.evaluate(() => { const A = window.__A, E = A.reino.tiro; for (let i = 0; i < 90; i++) { A.cam.pitch = -0.9; A.paso(1 / 30, false); } return { racha: E.racha, mult: E.mult }; });
prueba('una burbuja que no pega en nada corta la racha', r.racha === 0 && r.mult === 1, JSON.stringify(r));
/* el final: el tiempo se acaba */
await pag.evaluate(() => { const A = window.__A; A.reino.tiro.tiempo = 0.05; for (let i = 0; i < 4; i++) A.paso(1 / 30, false); });
await esperar(1200);
r = await pag.evaluate(() => ({ fin: window.__A.reino.tiro.fase, ventana: !!document.querySelector('.pk-resultado'), mejor: window.__A.G.tiro.mejor, est: document.querySelectorAll('.pk-est i').length }));
prueba('al terminar el tiempo sale el resultado y queda el récord', r.fin === 'fin' && r.ventana && r.mejor > 0 && r.est === 3, JSON.stringify(r));
await foto('6-tiro-fin');
/* 4. el menú de la Zona de Juegos: los 6 mapas, el tiro y el botón 👁 */
await pag.evaluate(() => { window.__A.UI.cerrarVentana(); window.__A.entrarReino('plaza'); window.__A.G.parkour.fp = false; window.__A.UI.menuParkour(window.__A.G.parkour, () => {}, () => {}, () => {}); });
await esperar(400);
r = await pag.evaluate(() => { const b = document.querySelector('.pk-fp'); const antes = b.textContent; b.click(); return { cartas: document.querySelectorAll('.pk-carta').length, tiro: !!document.querySelector('.pk-carta.tiro'), antes, despues: b.textContent, fp: window.__A.G.parkour.fp }; });
prueba('el menú tiene los 6 mapas, el tiro de burbujas y el botón de primera persona', r.cartas === 7 && r.tiro && r.fp === true && r.antes !== r.despues, JSON.stringify(r));
await foto('7-menu');
const e = errores.filter((x) => !x.includes('ERR_FAILED'));
if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
await ctx.close(); await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
