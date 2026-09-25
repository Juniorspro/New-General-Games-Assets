// Dos jugadores en dos navegadores, contra el broker local (pruebas/broker.mjs).
// Comprueba lo que pide el multijugador: se ven, se interpolan, chatean, se
// tiran burbujas (hit_player con daño a quien le toca), la apariencia viaja,
// el que se va desaparece a los 5 s, y sin red el juego anda solo.
//     node pruebas/multijugador.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
import { broker } from './broker.mjs';

const B = await broker(0);
const nav = await navegador();
const ok = [], mal = [];
const prueba = (nombre, cond, dato = '') => { (cond ? ok : mal).push(nombre + (dato ? ` (${dato})` : '')); console.log((cond ? '✓ ' : '✗ ') + nombre + (dato ? ` · ${dato}` : '')); };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/* los dos avanzan a la vez, de a poco, dejando que lleguen los mensajes */
async function juntos(pags, segundos, cada = 0.1) {
  for (let t = 0; t < segundos; t += cada) { await Promise.all(pags.map((p) => avanzar(p, Math.round(cada * 30), 1 / 30))); await esperar(20); }
}
const q = (n) => `directo&pausa&calidad=baja&nombre=${n}&broker=${encodeURIComponent(B.url)}`;
const A = await abrir(nav, q('Ana'), { red: 'local', ancho: 640, alto: 360 });
const Bb = await abrir(nav, q('Beto'), { red: 'local', ancho: 640, alto: 360 });
for (const x of [A, Bb]) await x.pag.waitForFunction(() => window.__A && window.__A.yo && window.__A.red.estado === 'en_linea', null, { timeout: 60000, polling: 200 });
prueba('los dos conectan al broker', B.clientes === 2, `${B.clientes} clientes`);
const salas = await Promise.all([A, Bb].map((x) => x.pag.evaluate(() => window.__A.red.sala)));
prueba('entran a la misma sala pública, sin código', salas[0] === salas[1], salas.join(' / '));
const ids = await Promise.all([A, Bb].map((x) => x.pag.evaluate(() => window.__A.J.id)));
prueba('cada uno tiene su id fijo y distinto', ids[0] !== ids[1] && ids.every((i) => /^[0-9a-f]{12}$/.test(i)), ids.join(' / '));

/* Ana se para en un lugar y Beto la tiene que ver ahí */
await A.pag.evaluate(() => { const { yo } = window.__A; yo.p.set(-10, window.__A.reino.mundo.altura(-10, 2), 2); });
await Bb.pag.evaluate(() => { const { yo } = window.__A; yo.p.set(-10, window.__A.reino.mundo.altura(-10, 5), 5); yo.rumbo = Math.PI; });
await juntos([A.pag, Bb.pag], 2.5);
const vista = await Bb.pag.evaluate((id) => { const r = window.__A.remotos.get(id); return r ? { x: r.x, z: r.z, tx: r.targetX, tz: r.targetZ, n: r.name } : null; }, ids[0]);
prueba('Beto ve a Ana (RemotePlayer en el Map)', !!vista, vista ? vista.n : 'no está');
prueba('y donde está (interpolado hacia targetX/targetZ)', vista && Math.abs(vista.x + 10) < 0.3 && Math.abs(vista.z - 2) < 0.3, vista ? `${vista.x.toFixed(2)}, ${vista.z.toFixed(2)}` : '');
/* la interpolación: Ana salta 4 m y Beto la ve acercarse de a poco, no de golpe */
await A.pag.evaluate(() => { window.__A.yo.p.x = -6; });
await avanzar(A.pag, 4); await esperar(250);
const pasos = [];
for (let i = 0; i < 6; i++) { await avanzar(Bb.pag, 1); pasos.push(await Bb.pag.evaluate((id) => window.__A.remotos.get(id).x, ids[0])); }
prueba('se mueve suave (lerp), en varios cuadros', pasos[0] > -10 && pasos[0] < -6.3 && pasos[5] > pasos[0], pasos.map((x) => x.toFixed(2)).join(' → '));
/* la apariencia viaja */
await A.pag.evaluate(() => { const { G, J } = window.__A; G.A.color = '#ff4f6e'; G.A.sombrero = 'conico'; J.aplicarApariencia(); });
await juntos([A.pag, Bb.pag], 1.5);
const ap = await Bb.pag.evaluate((id) => { const r = window.__A.remotos.get(id); return r && r.m.A; }, ids[0]);
prueba('la apariencia llega (color y sombrero)', ap && ap.color === '#ff4f6e' && ap.sombrero === 'conico', ap ? ap.color + ' ' + ap.sombrero : '');
/* el chat */
await A.pag.evaluate(() => window.__A.J.decir('¡hola Beto! <b>no es html</b>'));
await juntos([A.pag, Bb.pag], 0.8);
const chat = await Bb.pag.evaluate(() => [...document.querySelectorAll('.chat .linea')].map((l) => l.textContent).join(' | '));
prueba('el chat llega y se muestra como texto', chat.includes('Ana: ¡hola Beto! <b>no es html</b>'), chat.slice(0, 80));
const globo = await Bb.pag.evaluate((id) => !!window.__A.remotos.get(id).m.globo, ids[0]);
prueba('y aparece el globito arriba de Ana', globo);
/* la burbuja: Ana mira a Beto y le tira */
await A.pag.evaluate(() => { const { yo } = window.__A; yo.p.set(-10, window.__A.reino.mundo.altura(-10, 1), 1); yo.rumbo = 0; yo.sync(); });
await Bb.pag.evaluate(() => { const { yo } = window.__A; yo.p.set(-10, window.__A.reino.mundo.altura(-10, 4), 4); yo.hp = 100; });
await juntos([A.pag, Bb.pag], 1.5);
await A.pag.evaluate(() => { const E = window.__A.J; window.__A.yo.rumbo = 0; });
await A.pag.keyboard.down('KeyF'); await avanzar(A.pag, 1); await A.pag.keyboard.up('KeyF');
await juntos([A.pag, Bb.pag], 1.5);
const hp = await Bb.pag.evaluate(() => window.__A.yo.hp);
prueba('hit_player: a Beto le baja la espuma', hp < 100, `hp ${Math.round(hp)}`);
const hpA = await A.pag.evaluate(() => window.__A.yo.hp);
prueba('y a Ana no (se ignora lo propio)', hpA === 100, `hp ${hpA}`);
const vioDisparo = await Bb.pag.evaluate(() => (window.__A.UI.historial || []).join(' | '));
prueba('Beto ve el aviso de quién le tiró', vioDisparo.includes('Ana'), vioDisparo.slice(0, 60));
await Bb.pag.screenshot({ path: path.join(SAL, 'multi-beto.png') });
await A.pag.screenshot({ path: path.join(SAL, 'multi-ana.png') });
/* el estado solo se manda si algo cambió: quieta, Ana manda poco (latido cada 1,5 s) */
B.porTema.clear(); const m0 = B.mensajes; const r0 = Date.now(); await juntos([A.pag], 3); const m1 = B.mensajes; console.log('   por tema:', JSON.stringify(Object.fromEntries(B.porTema)), `en ${((Date.now() - r0) / 1000).toFixed(1)} s reales`);
/* el latido va por reloj real: con la placa por software 3 s de juego tardan más, así que se cuenta contra el tiempo real */
const reales = (Date.now() - r0) / 1000, estados = B.porTema.get('state') || 0;
prueba('quieta manda poco (no a ciegas cada cuadro)', estados <= Math.ceil(reales / 1.5) + 2 && m1 - m0 < 90 * 0.2, `${estados} estados en ${reales.toFixed(1)} s reales (a ciegas serían ~90)`);
/* Beto se va: a los 5 s Ana lo borra */
await Bb.ctx.close();
const t0 = Date.now();
while (Date.now() - t0 < 7000) { await avanzar(A.pag, 3); await esperar(200); }
const sigue = await A.pag.evaluate((id) => !!window.__A.remotos.get(id), ids[1]);
prueba('el que no manda nada en 5 s desaparece', !sigue);
/* sin red: el juego anda igual */
const C = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Solo', { red: 'no', ancho: 640, alto: 360 });
await C.pag.waitForFunction(() => window.__A && window.__A.yo, null, { timeout: 60000, polling: 200 });
await esperar(11000);
const est = await C.pag.evaluate(() => window.__A.red.estado);
await C.pag.keyboard.down('KeyW'); await avanzar(C.pag, 30); await C.pag.keyboard.up('KeyW');
const mov = await C.pag.evaluate(() => window.__A.yo.estado);
prueba('sin internet: queda "sin conexión" y se juega igual', est === 'sin_red', `${est} · ${mov}`);
const errores = [...A.errores, ...C.errores].filter((e) => !e.includes('ERR_FAILED'));
prueba('sin errores en la consola', !errores.length, errores.slice(0, 3).join(' | '));
await nav.close(); B.cerrar();
console.log(`\n${ok.length} bien, ${mal.length} mal`);
process.exit(mal.length ? 1 : 0);
