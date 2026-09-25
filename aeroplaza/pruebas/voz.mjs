// EL CHAT DE VOZ POR CERCANÍA (voz.js): dos jugadores en dos navegadores, con
// el broker local y el micrófono falso de Chromium (un tono con pitidos).
// Se prende con el botón 🎤 (pide el micrófono), se avisa en el estado, cerca
// se abre la conexión WebRTC (la señal viaja por la sala MQTT) y se escucha el
// audio del otro; lejos se corta; al volver se reconecta; sin permiso para el
// micrófono igual se escucha; apagar corta todo.
//     node pruebas/voz.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
import { broker } from './broker.mjs';
const B = await broker(0);
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function juntos(pags, segundos) { for (let t = 0; t < segundos; t += 0.1) { await Promise.all(pags.map((p) => avanzar(p, 3, 1 / 30))); await esperar(40); } }
const q = (n) => `directo&pausa&calidad=baja&nombre=${n}&broker=${encodeURIComponent(B.url)}`;
const A = await abrir(nav, q('Ana'), { red: 'local', ancho: 640, alto: 360 });
const Bb = await abrir(nav, q('Beto'), { red: 'local', ancho: 640, alto: 360 });
for (const x of [A, Bb]) await x.pag.waitForFunction(() => window.__A && window.__A.yo && window.__A.red.estado === 'en_linea', null, { timeout: 60000, polling: 200 });
const pags = [A.pag, Bb.pag];
const ids = await Promise.all(pags.map((p) => p.evaluate(() => window.__A.J.id)));
const poner = (p, x, z) => p.evaluate(([x, z]) => { const A = window.__A; A.yo.ponerEn(new A.THREE.Vector3(x, A.reino.mundo.altura(x, z) + 0.05, z), 0); }, [x, z]);
await poner(A.pag, -10, 2); await poner(Bb.pag, -10, 6);
await juntos(pags, 2);

/* los dos tocan 🎤 */
for (const p of pags) await p.evaluate(() => { document.querySelector('[data-a=voz]').click(); });
await esperar(1200);
let r = await Promise.all(pags.map((p) => p.evaluate(() => ({ estado: window.__A.voz.estado, boton: document.querySelector('[data-a=voz]').dataset.voz, mic: !!window.__A.voz.mic, marca: window.__A.voz.marca }))));
prueba('al tocar 🎤 se pide el micrófono y queda prendido', r.every((x) => x.estado === 'activa' && x.boton === 'activa' && x.mic && x.marca === 1), JSON.stringify(r));
/* se conectan solos (cerca: 4 m) */
let t0 = Date.now(), con = [0, 0];
while (Date.now() - t0 < 20000) { await juntos(pags, 0.5); con = await Promise.all(pags.map((p) => p.evaluate(() => window.__A.voz.conectados))); if (con[0] && con[1]) break; }
prueba('cerca, la conexión WebRTC se abre sola (la señal por MQTT)', con[0] === 1 && con[1] === 1, `${((Date.now() - t0) / 1000).toFixed(1)} s · ${con.join('/')}`);
const marcaRemota = await Bb.pag.evaluate((id) => window.__A.remotos.get(id)?.voz, ids[0]);
prueba('el otro sabe que está en la voz (voz: 1 en el estado)', marcaRemota === 1, String(marcaRemota));
/* se escucha: el nivel del audio que llega del otro. Beto se calla mientras
   (los dos micrófonos falsos dan el mismo tono y el cancelador de eco lo borra) */
await Bb.pag.evaluate(() => { for (const tr of window.__A.voz.mic.getAudioTracks()) tr.enabled = false; });
let nivel = 0;
for (let i = 0; i < 20; i++) { await juntos(pags, 0.2); nivel = Math.max(nivel, await Bb.pag.evaluate((id) => window.__A.voz.pares.get(id)?.nivel || 0, ids[0])); }
prueba('Beto escucha el micrófono de Ana', nivel > 0.01, nivel.toFixed(3));
await Bb.pag.evaluate(() => { for (const tr of window.__A.voz.mic.getAudioTracks()) tr.enabled = true; });
r = await Bb.pag.evaluate((id) => { const P = window.__A.voz.pares.get(id), L = window.__A.Sonido.ctx.listener; return { icono: !!P.icono, x: +P.pan.positionX.value.toFixed(1), z: +P.pan.positionZ.value.toFixed(1), oido: [+L.positionX.value.toFixed(1), +L.positionZ.value.toFixed(1)], modelo: P.pan.panningModel, max: P.pan.maxDistance }; }, ids[0]);
prueba('su voz sale de donde está su muñeco (HRTF, hasta 14 m) y tiene el 🔊', Math.abs(r.x + 10) < 0.5 && Math.abs(r.z - 2) < 0.5 && r.modelo === 'HRTF' && r.max === 14 && r.icono, JSON.stringify(r));
/* lejos (30 m): se corta */
await poner(Bb.pag, -10, 36);
await juntos(pags, 3);
con = await Promise.all(pags.map((p) => p.evaluate(() => window.__A.voz.pares.size)));
prueba('lejos (30 m) se corta la conexión', con[0] === 0 && con[1] === 0, con.join('/'));
/* vuelve: se reconecta */
await poner(Bb.pag, -10, 5);
t0 = Date.now();
while (Date.now() - t0 < 25000) { await juntos(pags, 0.5); con = await Promise.all(pags.map((p) => p.evaluate(() => window.__A.voz.conectados))); if (con[0] && con[1]) break; }
prueba('al volver cerca se reconecta', con[0] === 1 && con[1] === 1, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
/* Beto sin permiso para el micrófono: igual escucha */
await Bb.pag.evaluate(() => { window.__A.voz.apagar(); navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); document.querySelector('[data-a=voz]').click(); });
await esperar(800);
r = await Bb.pag.evaluate(() => ({ estado: window.__A.voz.estado, marca: window.__A.voz.marca, aviso: window.__A.UI.historial.slice(-1)[0] }));
prueba('sin permiso para el micrófono queda "escuchando" y lo avisa', r.estado === 'escucha' && r.marca === 2 && /permiso/.test(r.aviso), JSON.stringify(r));
t0 = Date.now();
while (Date.now() - t0 < 25000) { await juntos(pags, 0.5); con = await Promise.all(pags.map((p) => p.evaluate(() => window.__A.voz.conectados))); if (con[0] && con[1]) break; }
nivel = 0;
for (let i = 0; i < 15; i++) { await juntos(pags, 0.2); nivel = Math.max(nivel, await Bb.pag.evaluate((id) => window.__A.voz.pares.get(id)?.nivel || 0, ids[0])); }
prueba('y escucha a Ana igual', con[0] === 1 && con[1] === 1 && nivel > 0.01, `${con.join('/')} · ${nivel.toFixed(3)}`);
/* Ana apaga: se corta todo */
await A.pag.evaluate(() => document.querySelector('[data-a=voz]').click());
await juntos(pags, 3);
r = await Promise.all(pags.map((p) => p.evaluate(() => ({ pares: window.__A.voz.pares.size, estado: window.__A.voz.estado }))));
const pistas = await A.pag.evaluate(() => window.__A.voz.mic === null);
prueba('al apagar se corta todo y el micrófono se suelta', r[0].pares === 0 && r[1].pares === 0 && r[0].estado === 'apagada' && pistas, JSON.stringify(r));
for (const x of [A, Bb]) { const e = x.errores.filter((m) => !m.includes('ERR_FAILED') && !/stun/i.test(m)); if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); } }
await nav.close(); B.cerrar && B.cerrar();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
