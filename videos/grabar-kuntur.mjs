// Graba tomas de KUNTUR para los videos de TikTok: el juego de verdad en Chromium (WebGL por
// SwiftShader), con un reloj propio (requestAnimationFrame, performance.now y setTimeout) para
// que la lógica y las esperas del director vayan cuadro a cuadro. Se saca una captura por cuadro
// (así salen también el telón y los globitos, que son HTML). El juego es acostado: 1280×720.
//     node videos/grabar-kuntur.mjs [toma,toma]      → videos/medios/tomas/kuntur/<toma>.mp4 (+ .fondo.mp4)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(AQUI, 'medios/tomas/kuntur');
fs.mkdirSync(SALIDA, { recursive: true });
const solo = process.argv[2] ? process.argv[2].split(',') : null;
const FPS = 30;

const RELOJ = `<script>(function(){
  var cola = [], t = 0, relojes = [], sigId = 1; window.__esperaReal = window.setTimeout.bind(window);
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
  var m = { 'kuntur:idioma': 'es' }; try { Object.defineProperty(window, 'localStorage', { value: { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } } }); } catch (e) {}
})();</script>`;

const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(RAIZ, decodeURIComponent(u.pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  if (u.pathname.endsWith('kuntur.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(f, 'utf8').replace('<head>', '<head>' + RELOJ)); return; }
  res.writeHead(200); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/kuntur/kuntur.html?cal=media`;
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const log = (s) => console.log(s);

/* las acciones del resolvedor (las mismas que usa kuntur/pruebas/partida.mjs) */
const RES = fs.readFileSync(path.join(RAIZ, 'kuntur/pruebas/resolver.mjs'), 'utf8');
const ACC = RES.slice(RES.indexOf('export const ACCIONES = ['), RES.indexOf('];', RES.indexOf('export const ACCIONES = [')) + 2).replace('export const ', 'window.');
const SOL = (id) => JSON.parse(fs.readFileSync(path.join(RAIZ, `kuntur/pruebas/recorridos/${id}.json`), 'utf8'));

/* en la página: avanzar el reloj; en las charlas y narraciones, pasar solo cada tanto */
const AYUDA = () => {
  const d = window.__K;
  let enCharla = 0;
  window.__h = {
    d,
    cuadro(ms = 1000 / 30) {
      if (d.ui && d.ui.narrando) { enCharla += ms; if (enCharla > 3200) { d.ui.narrando(); enCharla = 0; } }
      else if (d.charlaActual) { enCharla += ms; if (enCharla > 2300) { d.Entrada.EDGE.aceptar = true; enCharla = 0; } }
      else enCharla = 0;
      window.__reloj.cuadro(ms);
    },
    pasar(n, ms) { for (let i = 0; i < n; i++) window.__h.cuadro(ms); },
    /* llegar a un capítulo, listo para jugar */
    async capitulo(id) {
      if (!d.partida) d.partida = { cap: id, en: null, coplas: [], llegados: [id] };
      d.jugar(id, null);
      for (let i = 0; i < 3000; i++) { if (d.cap && d.cap.id === id && d.estado === 'juego' && !d.cap.quieta && !d.ui.narrando && !d.charlaActual) return true; window.__h.cuadro(50); if (i % 20 === 0) await new Promise((r) => window.__esperaReal(r, 5)); }
      return false;
    },
    /* repetir un tramo del resolvedor desde su apacheta */
    tramo(s) {
      const c = d.cap, m = c.m, p = m.p;
      Object.assign(p, { x: s.desde.x, y: s.desde.y, vx: 0, vy: 0, estado: 'normal', colgado: null, trepa: null, caja: null, agachada: false, h: 1.3, enSuelo: true, saltoUsado: false, planeando: false, planeoArmado: false, muerta: false });
      m.tiempo = s.fase || 0;
      const A = window.ACCIONES, acc = s.acciones;
      let i = 0, f = 0, prev = null;
      c.guion = () => {
        if (i >= acc.length) return { x: 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false };
        const a = A[acc[i]];
        const sigueSalto = prev && prev.salto && a.salto, sigueMano = prev && prev.accion && a.accion;
        const e = { x: a.x || 0, y: a.y || 0, salto: !!(a.salto || (a.corto && f === 0)), saltoE: !!((a.corto || (a.salto && !sigueSalto)) && f === 0), accion: !!(a.accion || (a.toca && f === 0)), accionE: !!((a.toca || (a.accion && !sigueMano)) && f === 0) };
        f++; if (f >= 6) { f = 0; prev = a; i++; }
        return e;
      };
      c.pasarCamara && c.pasarCamara(1, true);
    },
  };
};

async function tomar(id, preparar, n, alCuadro) {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  pag.on('pageerror', (e) => log('  ERROR ' + e.message));
  await pag.goto(BASE);
  for (let i = 0; i < 600; i++) { if (await pag.evaluate(() => !!(window.__K && window.__K.ui))) break; await pag.evaluate(() => window.__reloj.cuadro(16)); await pag.waitForTimeout(20); }
  await pag.evaluate(ACC);
  await pag.evaluate(AYUDA);
  const r = await pag.evaluate(preparar);
  if (r === false) log(`  ${id}: no se pudo preparar`);
  const dir = path.join(SALIDA, id + '.cuadros');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    if (alCuadro) await pag.evaluate(alCuadro, k);
    await pag.evaluate(() => window.__h.cuadro());
    await pag.screenshot({ path: path.join(dir, String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92, timeout: 180000 });
    if (k % 60 === 59) log(`  ${id}: ${k + 1}/${n} (${((Date.now() - t0) / (k + 1)).toFixed(0)} ms por cuadro)`);
  }
  await pag.context().close();
  const dest = path.join(SALIDA, id + '.mp4');
  const ff = (args) => { const x = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]); if (x.status !== 0) throw new Error('ffmpeg: ' + x.stderr); };
  ff(['-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-g', '30', dest]);
  /* el fondo desenfocado para el formato vertical (la franja del juego va encima) */
  ff(['-i', dest, '-an', '-vf', 'crop=405:720,scale=270:480,gblur=sigma=8,eq=saturation=1.25:brightness=-0.05', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', dest.replace('.mp4', '.fondo.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`toma ${id}: ${n} cuadros (${(n / FPS).toFixed(1)} s)`);
}

/* un tramo del resolvedor en un capítulo (el número de tramo, en el orden del archivo) */
const deTramo = (cap, k) => {
  const s = SOL(cap)[k];
  return new Function(`return (async () => { const h = window.__h; if (!(await h.capitulo(${JSON.stringify(cap)}))) return false; h.tramo(${JSON.stringify(s)}); h.pasar(3); return true; })();`);
};

const TOMAS = {
  /* los cartelitos del idioma, el telón y el teatro */
  titulo: [() => { window.__h.pasar(30); return true; }, 240, (k) => { if (k === 45) { window.__K.Entrada.EDGE.aceptar = true; } }],
  /* el prólogo: la granizada, con sus charlas */
  prologo: [() => { const h = window.__h, d = h.d; d.partida = { cap: 'prologo', en: null, coplas: [], llegados: ['prologo'] }; d.jugar('prologo', null); return true; }, 330],
  colores: [deTramo('colores', 0), 180],
  colores2: [deTramo('colores', 2), 150],
  salinas: [deTramo('salinas', 1), 180],
  tren: [deTramo('tren', 0), 180],
  puna: [deTramo('puna', 1), 180],
  nevado: [deTramo('nevado', 0), 180],
};

for (const [id, [prep, n, alCuadro]] of Object.entries(TOMAS)) {
  if (solo && !solo.includes(id)) continue;
  await tomar(id, prep, n, alCuadro);
}
await nav.close();
servidor.close();
