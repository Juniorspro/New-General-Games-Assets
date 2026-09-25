// Hace el tráiler de AEROPLAZA (9:16), en tres pasos:
//
//     node aeroplaza/trailer/grabar.mjs tomas [--solo=id,id] [--vista] [--rehacer]
//     node aeroplaza/trailer/grabar.mjs audio
//     node aeroplaza/trailer/grabar.mjs video [--cuadros=0-90]
//     node aeroplaza/trailer/grabar.mjs todo
//
// tomas: el juego de verdad (aeroplaza.html?directo&pausa) en Chromium con SwiftShader y un
//   reloj propio, cuadro por cuadro (1/30 s), en 1080×1920 y calidad alta sin MSAA (3,2 s por
//   cuadro); cada toma → remotion/public/tomas/<id>.mp4. Con --vista se graban chiquitas y se
//   arma una hoja de contactos en salida/vistas/ (para encuadrar sin esperar horas).
// audio: las canciones del juego (musica-ajena/, no están en el repo) cortadas en sus golpes
//   según guion.js, con los golpes de efectos de sonidos.py, a -14 LUFS → remotion/public/audio/.
// video: Remotion arma todo → salida/aeroplaza-tiktok.mp4 (H.264 + AAC) y la portada.
//
// Antes: node aeroplaza/herramientas/armar.mjs. Remotion es el de BRILLO (remotion/node_modules
// es un enlace a brillo/trailer/remotion/node_modules).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { navegador } from '../pruebas/comun.mjs';
import { botRunner } from '../pruebas/bot-runner.mjs';
import { TOMAS } from './tomas.js';
import { FPS, ANCHO, ALTO, PARTES, CANCIONES, DURACION, largoDeTomas, eventosSonido } from './guion.js';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '../..');
const REMOTION = path.join(AQUI, 'remotion'), PUBLICO = path.join(REMOTION, 'public'), SALIDA = path.join(AQUI, 'salida'), CUADROS = path.join(AQUI, 'cuadros');
const CASCARA = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';   // el que usa Remotion
const [paso = 'todo', ...resto] = process.argv.slice(2);
const op = Object.fromEntries(resto.map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const reloj0 = Date.now();
const log = (s) => console.log(`${((Date.now() - reloj0) / 1000).toFixed(0).padStart(6)}s ${s}`);
for (const d of [SALIDA, CUADROS, path.join(PUBLICO, 'tomas'), path.join(PUBLICO, 'audio')]) fs.mkdirSync(d, { recursive: true });

function ffmpeg(args, o = {}) {
  const r = spawnSync('/usr/bin/ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 27 });
  if (r.status !== 0 && !o.tolerar) throw new Error('ffmpeg falló: ' + (r.stderr || '').split('\n').slice(-8).join('\n'));
  return (r.stderr || '') + (r.stdout || '');
}

/* ------------------------------------------------------------ el reloj propio
   performance.now, setTimeout, setInterval y requestAnimationFrame los mueve grabar.mjs (1/30 s por
   cuadro): lo que el juego espera con timers (entrar al lugar, los gestos, los globos de chat, lo
   que se olvida de la gente) pasa igual aunque cada cuadro tarde segundos en dibujarse.
   Sin sonido (la música va aparte) */
const RELOJ = `(function(){
  var cola = [], t = 0, relojes = [], sigId = 1, real = performance.now.bind(performance);
  window.requestAnimationFrame = function (f) { cola.push(f); return cola.length; };
  window.cancelAnimationFrame = function () {};
  performance.now = function () { return t; };
  window.setTimeout = function (f, ms) { var a = [].slice.call(arguments, 2), id = sigId++; if (typeof f === 'function') relojes.push({ id: id, t: t + Math.max(0, +ms || 0), f: f, a: a }); return id; };
  window.clearTimeout = function (id) { relojes = relojes.filter(function (r) { return r.id !== id; }); };
  window.setInterval = function (f, ms) { var id = sigId++, d = Math.max(1, +ms || 1); var otra = function () { relojes.push({ id: id, t: t + d, f: vuelta, a: [] }); }; var vuelta = function () { otra(); f(); }; otra(); return id; };
  window.clearInterval = window.clearTimeout;
  function vencidos() { for (var n = 0; n < 4000; n++) { var k = -1; for (var i = 0; i < relojes.length; i++) if (relojes[i].t <= t && (k < 0 || relojes[i].t < relojes[k].t)) k = i; if (k < 0) return; var r = relojes.splice(k, 1)[0]; try { r.f.apply(null, r.a); } catch (e) { console.error(e); } } }
  window.__reloj = { avanzar: function (ms) { t += ms; vencidos(); var q = cola.splice(0, cola.length); for (var i = 0; i < q.length; i++) { try { q[i](t); } catch (e) { console.error(e); } } }, get t() { return t; } };
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
})();`;

/* ------------------------------------------------------------ las ayudas de las tomas (en la página) */
const AYUDAS = () => {
  const A = window.__A, THREE = A.THREE, V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const T = window.__T = {
    E: {}, cam: null, falsos: new Map(), k: -1,
    camara(p, m, fov = 55) { T.cam = { p, m, fov }; },
    suave: (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); },
    mezcla: (a, b, u) => a.map((v, i) => v + (b[i] - v) * u),
    /* Catmull-Rom por los puntos, u de 0 a 1 */
    ruta(P, u) {
      const n = P.length - 1, x = Math.max(0, Math.min(0.99999, u)) * n, i = Math.floor(x), s = x - i;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(n, i + 1)], p3 = P[Math.min(n, i + 2)];
      return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s * s * s));
    },
    /* caminar hacia (x, z): la palanca para adelante y la cámara del juego mirando para allá */
    ir(x, z, correr) { const p = A.yo.p; A.cam.yaw = Math.atan2(-(x - p.x), -(z - p.z)); T.E.z = -1; T.E.corre = !!correr; },
    ponerEn(x, z, rumbo = 0) { const y = A.reino.mundo.altura(x, z) + 0.05; A.yo.ponerEn(new THREE.Vector3(x, y, z), rumbo); A.cam.yaw = rumbo + Math.PI; A.cam.detras(rumbo); A.cam.inicial = true; },
    apariencia(o) { const ap = { ...A.G.A, ...o }; A.yo.m.ponerApariencia(ap); },
    /* un jugador de mentira: llega como si fuera de la red (hay que mandarlo en cada cuadro) */
    falso(nombre, d, ap) {
      const id = 'falso-' + nombre, r = A.remotos.recibir({ id, name: nombre, ...d });
      if (!T.falsos.has(id)) { T.falsos.set(id, true); if (ap) r.ponerApariencia(ap, 1); }
      return r;
    },
    /* avanzar sin dibujar */
    saltear(n) { for (let i = 0; i < n; i++) { window.__reloj.avanzar(1000 / 30); A.paso(1 / 30, false); } },
    /* el runner con el bot, en el segundo t de la canción: donde iría a esa altura, ya corriendo */
    bot(A, t, zForzada) {
      const R = A.reino, E = R.runner; R.reiniciar(A.yo);
      window.__botRunner(); window.__B.activo = true;
      E.fase = 'corre'; E.cuenta = 0; E.tiempo = t; E.eventos.length = 0;
      const z = zForzada ?? R.tramos[0].z0 + 7 + t * 17.1, Tr = R.tramos.find((q) => z >= q.z0 && z <= q.z1 - 6) || R.tramos.find((q) => q.z0 > z) || R.tramos[R.tramos.length - 3];
      const p = new THREE.Vector3(Tr.x, Tr.y + 0.05, zForzada != null ? z : Math.max(Tr.z0 + 2, Math.min(z, Tr.z1 - 8)));
      A.yo.ponerEn(p, 0); A.yo.v.set(0, 0, 17); E.control.copy(p);
      A.cam.detras(0); A.cam.inicial = true;
      T.saltear(2);
    },
  };
  /* los dedos: lo que diga la toma en este cuadro */
  A.J.ent.leer = () => ({ x: 0, z: 0, corre: false, salta: false, sostiene: false, accion: false, baja: false, dispara: false, camX: 0, camY: 0, zoom: 1, hot: 0, chat: false, pausa: false, foto: false, ...T.E });
  /* sin tutorial, sin avisos ni misiones encima (la interfaz no se graba, pero el tutorial frena) */
  A.G.visto.tuto = true;
  /* un cuadro: la toma decide, el reloj avanza, el juego da un paso y se dibuja (con la cámara de cine si hay) */
  T.cuadro = (f, fn) => {
    T.E = {}; T.cam = null;
    fn(A, T, f);
    window.__reloj.avanzar(1000 / 30);
    const R = A.reino;
    if (T.cam && !A.estelario.abierto) {
      A.paso(1 / 30, false);
      const c = A.motor.camara; c.position.copy(V(T.cam.p)); c.lookAt(V(T.cam.m)); c.fov = T.cam.fov; c.updateProjectionMatrix();
      A.motor.dibujar(1 / 30);
    } else A.paso(1 / 30, true);
    /* el cuadro: el lienzo del juego (y encima lo del runner o las letras del Estelario) */
    const gl = A.motor.r.domElement, W = gl.width, H = gl.height;
    const lienzo = T.lienzo || (T.lienzo = document.createElement('canvas')); if (lienzo.width !== W) { lienzo.width = W; lienzo.height = H; }
    const g = lienzo.getContext('2d');
    if (R.congela > 0 && T.ultimo) return T.ultimo;   // (el runner congela: queda el cuadro anterior)
    g.drawImage(gl, 0, 0, W, H);
    if (A.delirio.activo) g.drawImage(A.delirio.cv, 0, 0, W, H);
    if (A.estelario.abierto) for (const c of document.querySelectorAll('.estelario canvas')) if (c !== gl) g.drawImage(c, 0, 0, W, H);
    return (T.ultimo = lienzo.toDataURL('image/jpeg', 0.94));
  };
};

/* ------------------------------------------------------------ grabar una toma */
async function grabarToma(nav, id, { vista = false } = {}) {
  const toma = TOMAS[id], largo = largoDeTomas()[id];
  if (!toma || !largo) { log(`${id}: no se usa en el guion`); return; }
  const destino = path.join(PUBLICO, 'tomas', id + '.mp4');
  if (!vista && fs.existsSync(destino) && !op.rehacer) { log(`${id}: ya está`); return; }
  const [w, h] = vista ? [270, 480] : [ANCHO, ALTO];
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(RELOJ);
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(e.message));
  pag.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errores.push(m.text()); });
  await pag.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => r.abort());
  const q = `directo&pausa&calidad=alta&nombre=Vos&hora=${toma.hora ?? 0.45}&reino=${toma.reino}${toma.params || ''}`;
  await pag.goto('file://' + path.join(RAIZ, 'aeroplaza/aeroplaza.html') + '?' + q);
  /* hasta que el lugar esté armado (el arranque espera con timers: los del reloj propio) */
  for (let i = 0; i < 600; i++) { if (await pag.evaluate(() => { window.__reloj.avanzar(50); return !!(window.__A && window.__A.reino && window.__A.yo && window.__A.J.ent); })) break; await new Promise((r) => setTimeout(r, 30)); }
  await pag.evaluate(`window.__botRunner = ${botRunner.toString()};`);
  await pag.evaluate(`(${AYUDAS.toString()})()`);
  /* alta sin MSAA (en SwiftShader cuesta 1,3 s por cuadro de 1080×1920) */
  await pag.evaluate(() => { const M = window.__A.motor; M.Q.msaa = 0; M.cadena.dispose(); M.armarCadena(); M.pBloom.enabled = M.Q.bloom; M.medir(); window.__T.saltear(20); });
  await pag.evaluate(`(${toma.preparar.toString()})(window.__A, window.__T)`);
  const carpeta = path.join(CUADROS, id + (vista ? '-vista' : '')); fs.rmSync(carpeta, { recursive: true, force: true }); fs.mkdirSync(carpeta, { recursive: true });
  const fn = toma.cuadro.toString(), cada = vista ? 6 : 1, t0 = Date.now();
  let n = 0;
  for (let f = 0; f < largo; f++) {
    const dibuja = f % cada === 0;
    const u = await pag.evaluate(([f, fn, dibuja]) => {
      const T = window.__T, cuadro = T._fn || (T._fn = (0, eval)('(' + fn + ')'));
      if (!dibuja) { T.E = {}; T.cam = null; cuadro(window.__A, T, f); window.__reloj.avanzar(1000 / 30); window.__A.paso(1 / 30, false); return null; }
      return T.cuadro(f, cuadro);
    }, [f, fn, dibuja]);
    if (u) fs.writeFileSync(path.join(carpeta, String(n++).padStart(5, '0') + '.jpg'), Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
    if (op.depurar && dibuja) log(`${id} ${f}: ` + await pag.evaluate(() => { const A = window.__A, c = A.motor.camara.position, p = A.yo.p; return JSON.stringify({ yo: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), cam: [c.x, c.y, c.z].map((v) => +v.toFixed(1)), vis: A.yo.m.raiz.visible, fase: A.reino.runner?.fase }); }));
    if (!vista && f % 30 === 29) log(`${id}: ${f + 1}/${largo} (${((Date.now() - t0) / (f + 1) / 1000).toFixed(1)} s por cuadro)`);
  }
  await ctx.close();
  if (errores.length) log(`${id}: errores en la página: ${[...new Set(errores)].slice(0, 4).join(' | ')}`);
  if (vista) {
    fs.mkdirSync(path.join(SALIDA, 'vistas'), { recursive: true });
    const col = Math.min(8, n), fil = Math.ceil(n / col);
    ffmpeg(['-loglevel', 'error', '-framerate', '1', '-i', path.join(carpeta, '%05d.jpg'), '-vf', `scale=135:240,tile=${col}x${fil}:padding=4:color=white`, '-frames:v', '1', path.join(SALIDA, 'vistas', id + '.jpg')]);
    log(`${id}: vista con ${n} cuadros → salida/vistas/${id}.jpg`);
    return;
  }
  ffmpeg(['-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(carpeta, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', destino]);
  fs.rmSync(carpeta, { recursive: true, force: true });
  log(`${id}: ${largo} cuadros → ${path.relative(RAIZ, destino)} (${(fs.statSync(destino).size / 1048576).toFixed(1)} MB)`);
}

async function tomas() {
  const ids = op.solo ? op.solo.split(',') : Object.keys(largoDeTomas());
  const nav = await navegador();
  try { for (const id of ids) await grabarToma(nav, id, { vista: !!op.vista }); } finally { await nav.close(); }
}

/* ------------------------------------------------------------ el audio */
function audio() {
  const dest = path.join(PUBLICO, 'audio', 'musica.wav'), crudo = path.join(CUADROS, 'musica-cruda.wav');
  /* los sonidos (whoosh, pops, el grito, el golpe del final) salen de sonidos.py en los tiempos del guion */
  const efectos = path.join(CUADROS, 'efectos.wav');
  const r = spawnSync('python3', [path.join(AQUI, 'sonidos.py'), efectos, String(DURACION)], { encoding: 'utf8', input: JSON.stringify(eventosSonido()) });
  if (r.status !== 0) throw new Error('sonidos.py: ' + r.stderr);
  const ent = [], fil = [];
  /* cada parte a su volumen (medido con loudnorm): el breakcore un poco más fuerte */
  const META = [-16, -16, -13.5, -16.5];
  PARTES.forEach((P, i) => {
    const C = CANCIONES[P.cancion], dura = P.fin - P.t + (i === 3 ? 1.2 : 0.02);
    ent.push('-i', path.join(RAIZ, C.archivo));
    const med = JSON.parse(ffmpeg(['-ss', P.desde.toFixed(3), '-t', dura.toFixed(3), '-i', path.join(RAIZ, C.archivo), '-af', 'loudnorm=print_format=json', '-f', 'null', '-']).match(/\{[\s\S]*\}/)[0]);
    P.ganancia = Math.max(-12, Math.min(12, META[i] - parseFloat(med.input_i)));
    /* cada canción: su pedazo, con una entrada y salida cortitas (las C y D empiezan secas, en el golpe) */
    const fin = i === 2 ? 0.02 : i === 3 ? 1.4 : 0.06, ini = i === 1 ? 0.03 : 0.005;
    fil.push(`[${i}:a]atrim=start=${P.desde.toFixed(4)}:duration=${dura.toFixed(4)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=${ini},afade=t=out:st=${(dura - fin).toFixed(4)}:d=${fin},volume=${P.ganancia.toFixed(2)}dB,adelay=${Math.round(P.t * 1000)}|${Math.round(P.t * 1000)}[m${i}]`);
  });
  ent.push('-i', efectos);
  fil.push(`[m0][m1][m2][m3]amix=inputs=4:normalize=0[mus]`, `[4:a]aformat=sample_rates=48000:channel_layouts=stereo[fx]`, `[mus][fx]amix=inputs=2:normalize=0,atrim=duration=${DURACION.toFixed(3)}[sal]`);
  ffmpeg(['-loglevel', 'error', ...ent, '-filter_complex', fil.join(';'), '-map', '[sal]', '-c:a', 'pcm_s16le', crudo]);
  /* -14 LUFS con pico -1 dBTP, en dos pasadas (lo de BRILLO) */
  const m = JSON.parse(ffmpeg(['-i', crudo, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']).match(/\{[\s\S]*\}/)[0]);
  ffmpeg(['-loglevel', 'error', '-i', crudo, '-af', `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', dest]);
  log(`audio: ${DURACION.toFixed(2)} s → ${path.relative(RAIZ, dest)} (entraba a ${m.input_i} LUFS; ganancias ${PARTES.map((P) => P.ganancia.toFixed(1)).join(' ')} dB)`);
}

/* ------------------------------------------------------------ el video */
function remotion(args) {
  const r = spawnSync('npx', ['remotion', ...args, `--browser-executable=${CASCARA}`, '--gl=swangle'], { cwd: REMOTION, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`remotion ${args[0]} terminó con ${r.status}`);
}
function video() {
  const crudo = path.join(CUADROS, 'trailer-crudo.mp4'), dest = path.join(SALIDA, 'aeroplaza-tiktok.mp4');
  const extra = op.cuadros ? [`--frames=${op.cuadros}`] : [];
  remotion(['render', 'src/index.jsx', 'Trailer', crudo, '--codec=h264', '--crf=16', '--concurrency=2', ...extra]);
  /* la pasada final: BT.709 de rango limitado (Remotion lo deja en rango completo) y +faststart */
  ffmpeg(['-loglevel', 'error', '-i', crudo, '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'film',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', dest]);
  log(`video → ${path.relative(RAIZ, dest)} (${(fs.statSync(dest).size / 1048576).toFixed(1)} MB)`);
  liviano(dest);
  portada();
}
/* las portadas: 9:16 y la 3:4 de la grilla del perfil de TikTok (lo importante va en la caja 3:4 de las dos) */
function portada() {
  remotion(['still', 'src/index.jsx', 'Portada', path.join(SALIDA, 'aeroplaza-tiktok-portada.png')]);
  remotion(['still', 'src/index.jsx', 'Portada34', path.join(SALIDA, 'aeroplaza-tiktok-portada-3x4.png')]);
}
/* la copia para mandar por el chat (tope ~30 MiB): la tasa sale del largo, en dos pasadas (lo de BRILLO) */
function liviano(dest = path.join(SALIDA, 'aeroplaza-tiktok.mp4')) {
  const sal = path.join(SALIDA, 'aeroplaza-tiktok-liviano.mp4'), log0 = path.join(CUADROS, 'x264-liviano');
  const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest], { encoding: 'utf8' }).stdout) || DURACION;
  const kbps = Math.floor((28.5 * 8 * 1024) / dur - 160);
  const comun = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.6) + 'k', '-bufsize', kbps * 2 + 'k', '-passlogfile', log0];
  ffmpeg(['-loglevel', 'error', '-i', dest, ...comun, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  ffmpeg(['-loglevel', 'error', '-i', dest, ...comun, '-pass', '2', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', sal]);
  log(`copia liviana → ${path.relative(RAIZ, sal)} (${(fs.statSync(sal).size / 1048576).toFixed(1)} MB, ${kbps} kbps)`);
}

if (paso === 'tomas') await tomas();
else if (paso === 'audio') audio();
else if (paso === 'video') video();
else if (paso === 'liviano') liviano();
else if (paso === 'portada') portada();
else if (paso === 'todo') { await tomas(); audio(); video(); }
else console.log('pasos: tomas, audio, video, liviano, portada, todo');
