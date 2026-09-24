// Graba tomas de LUZ MALA para los videos de TikTok: el juego de verdad en Chromium, con un
// reloj propio (requestAnimationFrame, performance.now y setTimeout), así cada cuadro sale
// exacto. El juego ya es para el teléfono parado: en una ventana de 360×640 el mundo mide
// 180×320 píxeles de juego y se agranda ×6 sin suavizar → 1080×1920.
//     node videos/grabar-luz-mala.mjs [toma,toma]      → videos/medios/tomas/luz-mala/<toma>.mp4
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(AQUI, 'medios/tomas/luz-mala');
fs.mkdirSync(SALIDA, { recursive: true });
const solo = process.argv[2] ? process.argv[2].split(',') : null;
const FPS = 30;

/* el mismo reloj que el tráiler de BRILLO (brillo/trailer/grabar.mjs) */
const RELOJ = `<script>(function(){
  var cola = [], t = 0, relojes = [], sigId = 1;
  window.requestAnimationFrame = function (f) { cola.push(f); return cola.length; };
  window.cancelAnimationFrame = function () {};
  performance.now = function () { return t; };
  window.setTimeout = function (f, ms) { var a = [].slice.call(arguments, 2), id = sigId++; if (typeof f === 'function') relojes.push({ id: id, t: t + Math.max(0, +ms || 0), f: f, a: a }); return id; };
  window.clearTimeout = function (id) { relojes = relojes.filter(function (r) { return r.id !== id; }); };
  window.setInterval = function (f, ms) { var id = sigId++, d = Math.max(1, +ms || 1); var otra = function () { relojes.push({ id: id, t: t + d, f: vuelta, a: [] }); }; var vuelta = function () { otra(); f(); }; otra(); return id; };
  window.clearInterval = window.clearTimeout;
  function vencidos() { for (var n = 0; n < 2000; n++) { var k = -1; for (var i = 0; i < relojes.length; i++) if (relojes[i].t <= t && (k < 0 || relojes[i].t < relojes[k].t)) k = i; if (k < 0) return; var r = relojes.splice(k, 1)[0]; try { r.f.apply(null, r.a); } catch (e) { console.error(e); } } }
  window.__reloj = { cuadro: function (ms) { t += ms; vencidos(); var q = cola.splice(0, cola.length); for (var i = 0; i < q.length; i++) q[i](t); }, get t() { return t; } };
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  var m = {}; try { Object.defineProperty(window, 'localStorage', { value: { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } } }); } catch (e) {}
})();</script>`;

const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(RAIZ, decodeURIComponent(u.pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  if (u.pathname.endsWith('luz-mala.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(f, 'utf8').replace('<head>', '<head>' + RELOJ)); return; }
  res.writeHead(200); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/luz-mala/luz-mala.html?fijo`;

const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const log = (s) => console.log(s);

/* ------------------------------------------------------------ en la página */
const AYUDA = () => {
  const L = window.__L, lienzo = document.getElementById('lienzo');
  const cuadro = () => window.__reloj.cuadro(1000 / 30);
  window.__h = {
    L,
    cuadro,
    /* n cuadros de video, con una función que decide la entrada en cada uno */
    grabar(n, alCuadro) {
      const out = [];
      for (let i = 0; i < n; i++) { if (alCuadro) alCuadro(i); cuadro(); out.push(lienzo.toDataURL('image/png').slice(22)); }
      return out;
    },
    apretar(a, v) { L.entrada(a, v); },
    /* pasar cuadros sin grabar */
    pasar(n) { for (let i = 0; i < n; i++) cuadro(); },
  };
};

async function tomar(id, preparar, grabarFn, n) {
  const pag = await (await nav.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: false })).newPage();
  pag.on('pageerror', (e) => log('  ERROR ' + e.message));
  await pag.goto(BASE);
  for (let i = 0; i < 400; i++) { if (await pag.evaluate(() => !!(window.__L && window.__L.listo))) break; await pag.evaluate(() => window.__reloj.cuadro(16)); }
  await pag.evaluate(AYUDA);
  if (id !== 'titulo' && id !== 'intro') await pag.evaluate(() => window.__L.ponerIdioma('es'));
  await pag.evaluate(preparar);
  const dir = path.join(SALIDA, id + '.cuadros');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let k = 0;
  const lote = 30;
  for (let i = 0; i < n; i += lote) {
    const fr = await pag.evaluate(([f, i0, m]) => { const fn = new Function('return ' + f)(); return window.__h.grabar(m, (j) => fn(i0 + j, window.__h)); }, [grabarFn.toString(), i, Math.min(lote, n - i)]);
    for (const b of fr) fs.writeFileSync(path.join(dir, String(k++).padStart(5, '0') + '.png'), Buffer.from(b, 'base64'));
  }
  await pag.context().close();
  /* a video: ×3 sin suavizar (el lienzo de la página ya va a ×2 del mundo) */
  const dest = path.join(SALIDA, id + '.mp4');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.png'),
    '-vf', 'scale=1080:1920:flags=neighbor,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-g', '30', dest]);
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`toma ${id}: ${k} cuadros (${(k / FPS).toFixed(1)} s)`);
}

/* ------------------------------------------------------------ las tomas */
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'luz-mala/pruebas/recorridos.json'), 'utf8'));
/* un recorrido del resolvedor, como entrada cuadro por cuadro (a 60 Hz: dos pasos por cuadro de video) */
const recorrido = (nombre) => {
  const r = R.find((x) => x.nombre === nombre);
  const cuadros = [];
  for (const a of r.acciones) for (let f = 0; f < r.k; f++) cuadros.push({ x: a.x, y: a.y, salto: !!a.salto, saltoE: !!(a.nuevo && f === 0), golpeE: false, dashE: !!(a.dash && f === 0), curar: false });
  return { r, cuadros };
};

const TOMAS = {
  /* los faroles del idioma y el título */
  titulo: [() => { window.__h.pasar(20); }, (i, h) => {
    if (i === 40) h.apretar('izq', true); if (i === 42) h.apretar('izq', false);
    if (i === 80) h.apretar('salto', true); if (i === 82) h.apretar('salto', false); }, 270],
  /* la intro: la historia en carteles (salto elige el farol, salto otra vez NUEVA PARTIDA) */
  intro: [() => { const h = window.__h; h.pasar(20); h.apretar('izq', true); h.pasar(2); h.apretar('izq', false); h.pasar(4);
    for (let k = 0; k < 3 && h.L.estado() !== 'intro'; k++) { h.apretar('salto', true); h.pasar(2); h.apretar('salto', false); h.pasar(45); }
    window.__estadoIntro = h.L.estado(); }, (i, h) => { if (i % 60 === 55) h.apretar('salto', true); if (i % 60 === 57) h.apretar('salto', false); }, 180],
  /* Chispa en el pueblo, caminando al mamboretá */
  pueblo: [() => { const h = window.__h; h.L.empezar('P1', { sinCharlas: true, en: [2 * 8, 22 * 8 - 12] }); h.pasar(8); }, (i, h) => {
    const der = i < 60 || (i > 80 && i < 150) || (i > 175 && i < 215);
    h.apretar('der', der); h.apretar('izq', i > 150 && i < 172);
    if (i === 40 || i === 110 || i === 195) h.apretar('salto', true); if (i === 48 || i === 118 || i === 203) h.apretar('salto', false);
  }, 225],
  /* la charla con el mamboretá */
  charla: [() => { const h = window.__h; h.L.empezar('P1', { en: [7 * 8, 22 * 8 - 12] }); h.pasar(6); h.apretar('arr', true); h.pasar(2); h.apretar('arr', false); h.pasar(2); }, (i, h) => {
    if (i % 45 === 40) h.apretar('salto', true); if (i % 45 === 42) h.apretar('salto', false);
  }, 140],
  /* la tienda de Don Canasto */
  tienda: [() => { const h = window.__h; h.L.empezar('P1', { en: [26 * 8, 22 * 8 - 12] }); h.L.J.mundo.p.ambar = 60; h.pasar(6); h.apretar('arr', true); h.pasar(2); h.apretar('arr', false);
    for (let k = 0; k < 10 && h.L.estado() === 'dialogo'; k++) { h.apretar('salto', true); h.pasar(2); h.apretar('salto', false); h.pasar(6); } }, null, 150],
  /* bajar por las raíces (el resolvedor) */
  raices: ['recorrido', '2 R1→R2', 150],
  hongal: ['recorrido', '4 R2→A1', 125],
  hilos: ['recorrido', '8 T1→A2', 70],
  pique: ['recorrido', '11 H1→H2', 130],
  rio: ['recorrido', '14 H2→A3', 80],
  subida: ['recorrido', '1 R1→P1', 200],
  /* apagarse con ámbar: la luz queda en una sombra */
  muerte: [() => { const h = window.__h; h.L.empezar('R1', { sinCharlas: true }); const p = h.L.J.mundo.p; p.ambar = 33; p.vida = 1; p.invulnT = 0; h.L.poner(10 * 8, 37 * 8 - 12); }, null, 120],
  /* el Torito: se presenta y pelea (Chispa invencible, esquivando y pegando) */
  torito: [() => { const h = window.__h; h.L.Opc.invencible = true; h.L.empezar('A1', { sinCharlas: true }); h.L.poner(8 * 8, 15 * 8 - 4); }, (i, h) => {
    const t = i % 90;
    h.apretar('der', t < 30); h.apretar('izq', t >= 45 && t < 70);
    h.apretar('salto', t === 20 || t === 21 || t === 60 || t === 61);
    h.apretar('golpe', i > 60 && i % 12 < 2);
    if (i === 250) h.L.danarJefe(40);
  }, 330],
  /* la Viuda y la Reina se presentan */
  viuda: [() => { const h = window.__h; h.L.Opc.invencible = true; h.L.empezar('A2', { sinCharlas: true, habil: { aleteo: true }, jefes: { torito: 1 } }); }, (i, h) => {
    h.apretar('der', i < 25); h.apretar('golpe', i > 70 && i % 14 < 2); h.apretar('salto', i > 70 && i % 40 < 2);
  }, 120],
  reina: [() => { const h = window.__h; h.L.Opc.invencible = true; h.L.empezar('A3', { sinCharlas: true, habil: { aleteo: true, resina: true }, jefes: { torito: 1, viuda: 1 } }); }, (i, h) => {
    h.apretar('der', i < 25); h.apretar('golpe', i > 70 && i % 14 < 2); h.apretar('salto', i > 70 && i % 40 < 2);
  }, 120],
  /* el mapa */
  mapa: [() => { const h = window.__h; h.L.empezar('R2', { sinCharlas: true }); h.pasar(10); h.apretar('mapa', true); h.pasar(2); h.apretar('mapa', false); }, null, 120],
};

for (const [id, T] of Object.entries(TOMAS)) {
  if (solo && !solo.includes(id)) continue;
  if (T[0] === 'recorrido') {
    const { r, cuadros } = recorrido(T[1]);
    const prep = new Function(`const h = window.__h, r = ${JSON.stringify(r)}, c = ${JSON.stringify(cuadros)};
      const jefes = {}; for (const k of ['torito', 'viuda', 'reina']) if (r.estado[k]) jefes[k] = 1;
      h.L.empezar(r.sala, { sinCharlas: true, habil: r.habil, estado: r.estado, jefes, en: [r.x, r.y] });
      h.L.J.mundo.bichos.length = 0; h.L.repetir(c);`);
    await tomar(id, prep, (i, h) => { h.L.J.mundo.bichos.length = 0; h.L.J.mundo.balas.length = 0; }, T[2]);
  } else await tomar(id, T[0], T[1] || (() => {}), T[2]);
}
await nav.close();
servidor.close();
