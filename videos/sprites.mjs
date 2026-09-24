// Saca los personajes de cada juego en PNG (a 1 píxel por píxel), para las miniaturas y los
// carteles: se agrandan después con `image-rendering: pixelated`, así el pixel art queda nítido.
//     node videos/sprites.mjs        → videos/medios/sprites/<juego>-<nombre>.png
// KUNTUR se dibuja en Node (sus lienzos son listas de colores); LUZ MALA necesita un <canvas>,
// así que se abre el juego en Chromium y se leen sus sprites ya horneados (SPR).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { register, createRequire } from 'node:module';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const SAL = path.join(AQUI, 'medios/sprites'); fs.mkdirSync(SAL, { recursive: true });

/* KUNTUR importa three (para los cubos), que acá no hace falta: se lo apunta a una copia del repo */
const TRES = path.join(RAIZ, 'telarana/juego/vendor/three.module.js');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(e, c, n) { return e === 'three' ? { url: ${JSON.stringify('file://' + TRES)}, shortCircuit: true } : n(e, c); }`));

/* un PNG RGBA mínimo */
function png(w, h, rgba) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const trozo = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const cab = Buffer.alloc(13); cab.writeUInt32BE(w, 0); cab.writeUInt32BE(h, 4); cab[8] = 8; cab[9] = 6;
  const filas = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(filas, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', zlib.deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]);
}
const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 255]; } const r = /rgba?\(([^)]+)\)/.exec(c); if (r) { const [a, b, d, e = 1] = r[1].split(',').map(Number); return [a, b, d, Math.round(e * 255)]; } return [255, 0, 255, 255]; };
/* un lienzo de KUNTUR: p[y*w+x] es un color o nada, con y para arriba */
const deLienzo = (L) => { const b = Buffer.alloc(L.w * L.h * 4); for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const c = L.p[y * L.w + x]; if (c) Buffer.from(hex(c)).copy(b, ((L.h - 1 - y) * L.w + x) * 4); } return png(L.w, L.h, b); };

const { cuadrosKilla } = await import(path.join(RAIZ, 'kuntur/js/sprites.js'));
const { APU, ANIMALES, DECOR } = await import(path.join(RAIZ, 'kuntur/js/elenco.js'));
const K = cuadrosKilla();
const kuntur = {
  'killa-quieta': K.quieta[0], 'killa-corre': K.corre[2], 'killa-planea': (K.planea || K.corre)[0], 'killa-salta': (K.sube || K.corre)[0],
  'apu-pichon': APU.pichon(0), 'apu-cuerpo': APU.cuerpo(1), 'apu-ala': APU.ala(1), llama: ANIMALES.llama(0), iglesia: DECOR.iglesia(), cardon: DECOR.cardon(0),
};
for (const [n, L] of Object.entries(kuntur)) { if (!L) continue; fs.writeFileSync(path.join(SAL, `kuntur-${n}.png`), deLienzo(L)); console.log(`kuntur-${n}: ${L.w}×${L.h}`); }

/* LUZ MALA: en el navegador */
/* el juego está armado adentro de una función: en la copia que se sirve se dejan a mano SPR y prepararArte */
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  if (f.endsWith('luz-mala.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(f, 'utf8').replace('const SPR = {};', 'const SPR = {}; window.SPR = SPR; window.prepararArte = () => prepararArte();')); return; }
  res.writeHead(200); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pag = await nav.newPage();
await pag.goto(`http://127.0.0.1:${srv.address().port}/luz-mala/luz-mala.html`);
/* el juego hornea los sprites al arrancar la partida: si todavía no, se hornean acá */
await pag.waitForFunction(() => typeof prepararArte === 'function' && typeof SPR !== 'undefined', null, { timeout: 60000 });
await pag.evaluate(() => { if (!SPR.chispa) prepararArte(); });
const lm = await pag.evaluate(() => {
  const d = (s) => (s && s.der ? s.der : s).toDataURL();
  return { 'chispa-quieta': d(SPR.chispa.quieta[1]), 'chispa-alas': d(SPR.chispa.alas[0]), 'torito-enojado': d(SPR.torito.enojado), torito: d(SPR.torito.a), viuda: d(SPR.viuda[0]), reina: d(SPR.reina), 'retrato-chispa': d(SPR.retrato.chispa) };
});
for (const [n, u] of Object.entries(lm)) { const b = Buffer.from(u.split(',')[1], 'base64'); fs.writeFileSync(path.join(SAL, `luz-mala-${n}.png`), b); console.log(`luz-mala-${n}: ${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`); }
await nav.close(); srv.close();
