// La música de uno de los seis juegos de un archivo, hecha con su propio sintetizador: el
// AudioContext del juego se cambia por un OfflineAudioContext cuyo currentTime lleva el reloj
// propio (sueltos/reloj.mjs), así el programador de notas del juego (con sus setInterval y su
// "mirar adelante") va escribiendo el tema entero sin que suene nada. Al final se dibuja el
// audio de una vez y sale un WAV de 48 kHz.
//     node videos/sueltos/musica.mjs <juego> <tema> <segundos> → videos/medios/musica/<juego>-<tema>.wav
import path from 'node:path';
import { createRequire } from 'node:module';
import { servir } from './servidor.mjs';

const [juego, tema, seg = '34'] = process.argv.slice(2);
const ARCHIVO = `${juego}/${juego}.html`;
/* cómo se despierta el sonido de cada uno y cómo se le pide un tema */
const DESPERTAR = {
  globo: "window.__G.sonido.despertar(); window.__G.sonido.musica(T);",
  vibora: "window.__V.sonido.despertar(); window.__V.sonido.musica(T);",
  grumo: "window.__G.sonido.despertar(); window.__G.sonido.musica(T);",
  morfi: "window.__G.sonido.despertar(); window.__G.sonido.musica(T);",
  cripta: "window.__C.app.sonido.despertar(); window.__C.app.sonido.musica(T);",
  /* la isla dibuja 3D en cada cuadro: se corta el bucle (la música va con setInterval) y se callan
     el ambiente y los efectos, que si no entran olas y pájaros */
  isla: "var J = window.__isla.J; window.requestAnimationFrame = function () { return 0; }; J.son.vol.ambiente = 0; J.son.vol.efectos = 0; J.son.iniciar(); J.son.musica(T);",
};
const AUDIO = (s) => `<script>(function(){
  var fr = 48000, off = new OfflineAudioContext(2, Math.ceil(fr * ${s}), fr), ahora = 0;
  Object.defineProperty(off, 'currentTime', { get: function () { return ahora; } });
  Object.defineProperty(off, 'state', { get: function () { return 'running'; } });
  off.resume = function () { return Promise.resolve(); };
  off.suspend = function () { return Promise.resolve(); };
  off.close = function () { return Promise.resolve(); };
  var AC = function () { return off; };
  Object.defineProperty(window, 'AudioContext', { get: function () { return AC; }, set: function () {} });
  Object.defineProperty(window, 'webkitAudioContext', { get: function () { return AC; }, set: function () {} });
  window.__audio = { off: off, poner: function (t) { ahora = t; } };
})();</script>`;

const S = await servir();
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const pag = await (await nav.newContext({ viewport: { width: 432, height: 768 }, isMobile: true, hasTouch: true })).newPage();
pag.on('pageerror', (e) => console.log('ERROR', e.message));
/* el reloj propio va primero (el servidor lo mete); el audio fuera de línea, justo después */
await pag.route('**/*.html*', async (ruta) => {
  const r = await ruta.fetch();
  const h = (await r.text()).replace('</script>', '</script>' + AUDIO(+seg));
  await ruta.fulfill({ response: r, body: h, headers: { ...r.headers(), 'content-type': 'text/html; charset=utf-8' } });
});
await pag.goto(`${S.base}/${ARCHIVO}?idioma=es&sinintro`);
for (let i = 0; i < 600; i++) {
  await pag.evaluate(() => window.__reloj.cuadro(1000 / 30));
  if (await pag.evaluate(() => !!((window.listo && (window.__G || window.__V || window.__C)) || (window.__isla && window.__isla.listo)))) break;
}
const r = await pag.evaluate(async ({ js, T, seg, nombre }) => {
  new Function('T', js)(T);
  const A = window.__audio;
  /* de a 10 ms: el reloj del audio y el de los setInterval van juntos */
  for (let t = 0; t < seg; t += 0.01) { A.poner(t); window.__reloj.cuadro(10); }
  A.poner(0);
  const buf = await A.off.startRendering();
  const n = buf.length, wav = new DataView(new ArrayBuffer(44 + n * 4));
  const txt = (p, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(p + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); txt(8, 'WAVE'); txt(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, 48000, true); wav.setUint32(28, 48000 * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); txt(36, 'data'); wav.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let pico = 0;
  for (let i = 0; i < n; i++) { pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i])); wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  await fetch(`/guardar?a=${encodeURIComponent('musica/' + nombre)}`, { method: 'POST', body: wav.buffer });
  return { seg, pico: +pico.toFixed(3) };
}, { js: DESPERTAR[juego], T: tema, seg: +seg, nombre: `${juego}-${tema}.wav` });
console.log(juego, tema, JSON.stringify(r), '→', path.join('videos/medios/musica', `${juego}-${tema}.wav`));
await nav.close();
S.cerrar();
