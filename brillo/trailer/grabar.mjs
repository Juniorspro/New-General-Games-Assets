// Hace el tráiler de BRILLO, en tres pasos:
//
//     node brillo/trailer/grabar.mjs tomas  [--idioma=es] [--solo=id,id] [--muestra=t1,t2] [--rehacer]
//     node brillo/trailer/grabar.mjs audio  [--idioma=es]
//     node brillo/trailer/grabar.mjs video  [--idioma=es] [--formato=horizontal|vertical|ambos] [--cuadros=0-90]
//     node brillo/trailer/grabar.mjs todo   [--idioma=es|en|pt|todos]
//
// tomas: el juego de verdad en Chromium (brillo/brillo.html con un reloj propio metido al
//   principio, así cada cuadro es exacto aunque la máquina dibuje lento), una toma por escena
//   de guion.js → remotion/public/tomas/ (las del juego son las mismas en los tres idiomas;
//   la Actualización y su chat van por idioma).
// audio: la música de BRILLO con su propio sintetizador, en los tiempos del guion → remotion/public/audio/<idioma>.wav
// video: Remotion arma todo (carteles, transiciones, música) → salida/brillo-trailer-<idioma>-<formato>.mp4 (H.264 + AAC)
//
// Antes hay que armar el juego (node brillo/herramientas/armar.mjs) y, una vez,
// instalar Remotion: cd brillo/trailer/remotion && npm install
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '../..');
const REMOTION = path.join(AQUI, 'remotion');
const PUBLICO = path.join(REMOTION, 'public');
const SALIDA = path.join(AQUI, 'salida');
const [paso = 'todo', ...resto] = process.argv.slice(2);
const op = Object.fromEntries(resto.map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const IDIOMAS = op.idioma === 'todos' ? ['es', 'en', 'pt'] : [op.idioma || 'es'];
const NAVEGADOR = '/opt/pw-browsers/chromium';
const CASCARA = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';   // el que usa Remotion
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.css': 'text/css', '.webm': 'video/webm', '.wav': 'audio/wav' };
const reloj0 = Date.now();
const log = (s) => console.log(`${((Date.now() - reloj0) / 1000).toFixed(0).padStart(5)}s ${s}`);

/* el reloj que se mete en el juego: requestAnimationFrame y performance.now los maneja la página
   que graba, el juego no suena (la música se hace aparte) y no guarda nada */
const RELOJ = `<script>(function(){
  var cola = [], t = 0;
  window.requestAnimationFrame = function (f) { cola.push(f); return cola.length; };
  window.cancelAnimationFrame = function () {};
  performance.now = function () { return t; };
  window.__reloj = { cuadro: function (ms) { t += ms; var q = cola.splice(0, cola.length); for (var i = 0; i < q.length; i++) q[i](t); }, get t() { return t; } };
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  var m = {}, q = new URLSearchParams(location.search); if (q.get('idioma')) m['brillo:idioma'] = q.get('idioma');
  try { Object.defineProperty(window, 'localStorage', { value: { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } } }); } catch (e) {}
})();</script>`;

/* ------------------------------------------------------------ el servidor local */
/* WebCodecs pide un origen seguro: por eso todo pasa por 127.0.0.1 y no por file:// */
function servir() {
  const servidor = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/guardar') {
      const carpeta = (u.searchParams.get('carpeta') || '').replace(/[^a-z0-9/_-]/gi, '').replace(/\.\.+/g, '');
      const dir = carpeta ? path.join(PUBLICO, carpeta) : SALIDA;
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, path.basename(u.searchParams.get('nombre') || 'sin-nombre')), partes = [];
      req.on('data', (c) => partes.push(c));
      req.on('end', () => { fs.writeFileSync(dest, Buffer.concat(partes)); log(`guardado ${path.relative(RAIZ, dest)} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`); res.end('ok'); });
      return;
    }
    if (u.pathname === '/brillo-reloj.html') {
      const html = fs.readFileSync(path.join(RAIZ, 'brillo/brillo.html'), 'utf8').replace('<head>', '<head>' + RELOJ);
      res.writeHead(200, { 'content-type': TIPOS['.html'] }); res.end(html); return;
    }
    const f = path.join(RAIZ, decodeURIComponent(u.pathname));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'content-length': fs.statSync(f).size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(servidor)));
}

/* ------------------------------------------------------------ una página que trabaja hasta __terminado */
async function pagina(archivo, params) {
  const servidor = await servir();
  const require = createRequire('/opt/node22/lib/node_modules/playwright/');
  const { chromium } = require('playwright');
  const nav = await chromium.launch({ executablePath: NAVEGADOR, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const pag = await (await nav.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  pag.on('console', (m) => { const s = m.text(); if (m.type() === 'error' || s.startsWith('[tráiler]')) log(s); });
  pag.on('pageerror', (e) => log('ERROR ' + e.message));
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== false).map(([k, v]) => [k, v === true ? '1' : String(v)]));
  await pag.goto(`http://127.0.0.1:${servidor.address().port}/brillo/trailer/${archivo}?${q}`);
  await pag.waitForFunction(() => window.__terminado, null, { timeout: 0, polling: 2000 });
  const r = await pag.evaluate(() => window.__terminado);
  await nav.close();
  servidor.close();
  if (r.error) throw new Error(`${archivo}: ${r.error}`);
  return r;
}

async function tomas(idioma) {
  const r = await pagina('tomas.html', { idioma, solo: op.solo, muestra: op.muestra, rehacer: !!op.rehacer });
  log(`tomas (${idioma}) listas: ${JSON.stringify(r.medidas)}`);
}
async function audio(idioma) {
  const r = await pagina('audio.html', { idioma });
  log(`música (${idioma}) lista: ${r.segundos.toFixed(1)} s`);
}
/* los fondos del vertical: cada toma chiquita y desenfocada, hecha una vez con el ffmpeg de Remotion
   (un filtro blur() de CSS en SwiftShader cuesta 0,7 s por cuadro). Ese ffmpeg no trae gblur:
   se desenfoca achicando mucho y volviendo a agrandar */
function fondos(idioma) {
  const BIN = path.join(REMOTION, 'node_modules/@remotion/compositor-linux-x64-gnu');
  for (const carpeta of ['comun', idioma]) {
    const dir = path.join(PUBLICO, 'tomas', carpeta);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.webm'))) {
      const src = path.join(dir, f), dest = path.join(dir, f.replace('.webm', '.fondo.mp4'));
      if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs > fs.statSync(src).mtimeMs) continue;
      const r = spawnSync(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an',
        '-vf', 'crop=608:1080,scale=36:64:flags=area,scale=144:256:flags=bicubic', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', dest],
      { env: { ...process.env, LD_LIBRARY_PATH: BIN }, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('ffmpeg no pudo hacer ' + dest);
    }
  }
}
function video(idioma) {
  fs.mkdirSync(SALIDA, { recursive: true });
  fondos(idioma);
  const formatos = op.formato === 'ambos' || !op.formato ? ['horizontal', 'vertical'] : [op.formato];
  for (const formato of formatos) {
    const comp = formato === 'vertical' ? 'TrailerVertical' : 'Trailer';
    const dest = path.join(SALIDA, `brillo-trailer-${idioma}-${formato}.mp4`);
    const args = ['remotion', 'render', 'src/index.jsx', comp, dest, `--props=${JSON.stringify({ idioma })}`,
      `--browser-executable=${CASCARA}`, '--gl=swangle', '--codec=h264', '--crf=17', '--pixel-format=yuv420p',
      '--audio-codec=aac', '--audio-bitrate=256k', `--concurrency=${op.concurrencia || 3}`, '--log=info'];
    if (op.cuadros) args.push(`--frames=${op.cuadros}`);
    log(`video ${idioma} ${formato}…`);
    const r = spawnSync('npx', args, { cwd: REMOTION, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`remotion render terminó con ${r.status}`);
    log(`listo ${path.relative(RAIZ, dest)} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
  }
}

const PASOS = { tomas, audio, video: async (i) => video(i) };
if (!PASOS[paso] && paso !== 'todo') { console.log('pasos: tomas, audio, video, todo'); process.exit(1); }
for (const idioma of IDIOMAS) {
  if (paso === 'todo') { await tomas(idioma); await audio(idioma); video(idioma); }
  else await PASOS[paso](idioma);
}
log(`terminado (${((Date.now() - reloj0) / 60000).toFixed(1)} min)`);
