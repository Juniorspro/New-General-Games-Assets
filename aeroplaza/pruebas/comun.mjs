// Lo que comparten las pruebas: el navegador con WebGL por software (SwiftShader)
// y el cliente MQTT servido desde un archivo local (el contenedor no llega a
// unpkg desde Chromium; con curl sí se bajó una copia a pruebas/mqtt.min.js).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

export const AQUI = path.dirname(new URL(import.meta.url).pathname);
export const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
/* el cliente MQTT no se guarda en el repo: se baja con curl la primera vez (curl sí sale por el proxy) */
export function clienteMQTT() {
  const f = path.join(AQUI, 'mqtt.min.js');
  if (!fs.existsSync(f)) execFileSync('curl', ['-sSL', '-o', f, 'https://unpkg.com/mqtt@5/dist/mqtt.min.js']);
  return f;
}
/* MediaPipe (las manos del VR) tampoco sale desde Chromium: se baja con curl a pruebas/mediapipe/ la
   primera vez (~20 MB; no se guarda en el repo) y se sirve de ahí */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1', MP_MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MP_ARCHIVOS = ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm'];
export function mediapipe() {
  const d = path.join(AQUI, 'mediapipe');
  for (const f of MP_ARCHIVOS) { const x = path.join(d, f); if (!fs.existsSync(x)) { fs.mkdirSync(path.dirname(x), { recursive: true }); execFileSync('curl', ['-sSL', '-o', x, MP + '/' + f]); } }
  const m = path.join(d, 'hand_landmarker.task'); if (!fs.existsSync(m)) execFileSync('curl', ['-sSL', '-o', m, MP_MODELO]);
  return d;
}
/* IWER (Meta, MIT): un Quest 3 de mentira para probar el modo del visor (WebXR) sin visor. Se baja
   con curl a pruebas/iwer.min.js la primera vez; no se guarda en el repo */
export function iwer() {
  const f = path.join(AQUI, 'iwer.min.js');
  if (!fs.existsSync(f)) execFileSync('curl', ['-sSL', '-o', f, 'https://cdn.jsdelivr.net/npm/iwer@2.5.0/build/iwer.min.js']);
  return fs.readFileSync(f, 'utf8');
}
export async function navegador({ video = null } = {}) {
  const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
    /* el chat de voz: un micrófono falso (un tono con pitidos) que se da sin preguntar */
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    /* (y la cámara falsa puede ser un video: el de las manos, videoManos()) */
    ...(video ? ['--use-file-for-fake-video-capture=' + video] : [])] });
}
/* una cámara de mentira con manos de verdad (las fotos de pruebas/manos, moviéndose): 0-4 s una mano,
   4-8 s las dos, 8-11 s el pellizco, 11-13 s ninguna; 640 × 480 a 30. Se arma con ffmpeg la primera vez
   (en pruebas/salida, no se guarda en el repo); sin ffmpeg, null */
export function videoManos() {
  const f = path.join(SAL, 'manos.mjpeg'), M = path.join(AQUI, 'manos');
  if (fs.existsSync(f)) return f;
  const mov = "x='50*sin(2*PI*0.5*t)':y='20*sin(2*PI*0.3*t)'";
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-i', path.join(M, 'mano-palma.jpg'), '-loop', '1', '-i', path.join(M, 'manos-abiertas.jpg'), '-loop', '1', '-i', path.join(M, 'mano-pellizco.jpg'),
      '-f', 'lavfi', '-i', 'color=c=0x303030:s=640x480:r=30', '-filter_complex', `[3][0]overlay=${mov}:enable='lt(t,4)'[a];[a][1]overlay=${mov}:enable='between(t,4,8)'[b];[b][2]overlay=${mov}:enable='between(t,8,11)'`,
      '-t', '13', '-r', '30', '-q:v', '4', '-f', 'mjpeg', f]);
    return f;
  } catch { return null; }
}
/* abre el juego; red: 'no' (sin internet) o 'local' (mqtt.js de la carpeta) */
export async function abrir(nav, params = '', { ancho = 960, alto = 540, red = 'no', archivo = 'aeroplaza.html', movil = false, manos = false, xr = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, hasTouch: movil, isMobile: movil, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
  /* el visor de mentira, antes que el juego (así navigator.xr ya está) */
  /* (IWER 2.5 copia el XRRigidTransform del espacio desplazado como si fuera una matriz y el
     desplazamiento se pierde; en un visor de verdad anda: acá se le pasa la matriz) */
  if (xr) await pag.addInitScript({ content: iwer() + `;window.__xrdev = new IWER.XRDevice(IWER.metaQuest3); window.__xrdev.installRuntime({ forceInstall: true });
    { const P = XRReferenceSpace.prototype, o = P.getOffsetReferenceSpace; P.getOffsetReferenceSpace = function (t) { return o.call(this, t && t.matrix ? t.matrix : t); }; }` });
  const errores = [];
  pag.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); if (process.env.VERBOSO) console.log('[consola]', m.text()); });
  if (manos) {
    const d = mediapipe(), tipo = (f) => f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.task') ? 'application/octet-stream' : 'text/javascript';
    await ctx.route((u) => u.href.startsWith(MP + '/') || u.href === MP_MODELO, (r) => {
      const u = r.request().url(), f = u === MP_MODELO ? 'hand_landmarker.task' : u.slice(MP.length + 1);
      const x = path.join(d, f);
      if (fs.existsSync(x)) r.fulfill({ body: fs.readFileSync(x), contentType: tipo(f), headers: { 'access-control-allow-origin': '*' } }); else r.abort();
    });
  }
  await pag.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => {
    if (manos && r.request().url().startsWith(MP + '/')) return r.fallback();   // (lo sirve la ruta de MediaPipe, más arriba)
    const local = red === 'local' ? clienteMQTT() : '';
    if (red === 'local' && fs.existsSync(local)) r.fulfill({ body: fs.readFileSync(local), contentType: 'text/javascript' });
    else r.abort();
  });
  await pag.goto('file://' + path.join(AQUI, '..', archivo) + (params ? '?' + params : ''));
  return { pag, ctx, errores };
}
/* avanza el juego a mano (sin requestAnimationFrame): cuadros de 1/30 s */
/* (PERFIL=1: al terminar, cuánto tiempo se fue en avanzar, dibujando y sin dibujar) */
const PERFIL = process.env.PERFIL ? { dib: 0, sin: 0, nd: 0, ns: 0, t0: Date.now() } : null;
if (PERFIL) process.on('exit', () => console.log(`⏱ avanzar: ${PERFIL.nd} dibujando ${(PERFIL.dib / 1000).toFixed(1)} s · ${PERFIL.ns} sin dibujar ${(PERFIL.sin / 1000).toFixed(1)} s · en total ${((Date.now() - PERFIL.t0) / 1000).toFixed(1)} s`));
export async function avanzar(pag, n = 30, dt = 1 / 30, dibujar = true) {
  if (PERFIL) { const t = Date.now(); await avanzar1(pag, n, dt, dibujar); if (dibujar) { PERFIL.dib += Date.now() - t; PERFIL.nd++; } else { PERFIL.sin += Date.now() - t; PERFIL.ns++; } return; }
  return avanzar1(pag, n, dt, dibujar);
}
async function avanzar1(pag, n, dt, dibujar) {
  /* solo se dibuja el último cuadro, y se espera a que la placa (por software) termine. dibujar =
     false: ninguno (las pruebas que no miran la imagen: el dibujo por software es casi todo el tiempo) */
  await pag.evaluate(([n, dt, dibujar]) => { for (let i = 0; i < n; i++) window.__A.paso(dt, dibujar && i === n - 1); if (!dibujar) return; const gl = window.__A.motor.r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }, [n, dt, dibujar]);
}
/* (lo usan manos.mjs y vr-juego.mjs) en la página: una mano de 21 puntos (metros). Derecha, de dorso a la cara, dedos para arriba:
   x a la derecha, y arriba, z hacia la cara. La izquierda es el espejo */
export const MANO = () => {
  const A = window.__A, THREE = A.THREE;
  const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
    [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
    [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];
  const PELLIZCO = ABIERTA.map((p) => p.slice());
  Object.assign(PELLIZCO, { 3: [-0.058, 0.09, -0.04], 4: [-0.05, 0.118, -0.058], 6: [-0.03, 0.12, -0.02], 7: [-0.04, 0.135, -0.045], 8: [-0.05, 0.12, -0.06] });
  const cab = () => ({ p: A.motor.camara.position.clone(), q: A.motor.camara.quaternion.clone() });
  /* el hombro, como en manos.js */
  const hombro = (der) => { const { p, q } = cab(), d = new THREE.Vector3(0, 0, -1).applyQuaternion(q), yaw = Math.atan2(-d.x, -d.z); return new THREE.Vector3(p.x + Math.cos(yaw) * (der ? 0.17 : -0.17), p.y - 0.2, p.z - Math.sin(yaw) * (der ? 0.17 : -0.17)); };
  /* la mano armada: pose, lado, dónde (el punto entre pulgar e índice) y hacia dónde apuntan los dedos;
     palma: la palma mira a la cara */
  window.__mano = (der, pose = 'abierta', { mira = null, dir = null, palma = false, mover = [0, 0, 0], ruido = 0 } = {}) => {
    const B = (pose === 'pellizco' ? PELLIZCO : ABIERTA).map(([x, y, z]) => new THREE.Vector3(der ? x : -x, y, z));
    if (palma) for (const v of B) { v.x = -v.x; v.z = -v.z; }   // (media vuelta en y: la palma a la cara)
    const { q } = cab();
    /* los dedos para donde apunta dir (en el mundo); el dorso para la cara */
    const d = (dir || new THREE.Vector3(0, 0, -1).applyQuaternion(q)).clone().normalize();
    const arr = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, arr);   // (-z local = d; con el giro de abajo, los dedos van por d y el dorso para arriba)
    const rot = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    for (const v of B) v.applyQuaternion(rot);
    /* que el punto entre pulgar e índice caiga en 'mira' */
    const medio = B[2].clone().add(B[5]).multiplyScalar(0.5);
    const off = mira.clone().sub(medio).add(new THREE.Vector3(...mover));
    const W = new Float32Array(63);
    B.forEach((v, i) => { v.add(off); W[i * 3] = v.x + (Math.random() - 0.5) * ruido; W[i * 3 + 1] = v.y + (Math.random() - 0.5) * ruido; W[i * 3 + 2] = v.z + (Math.random() - 0.5) * ruido; });
    return W;
  };
  /* el punto que apunta a 'objetivo' desde el hombro, a 45 cm */
  window.__apuntar = (der, objetivo, largo = 0.45) => { const h = hombro(der), d = objetivo.clone().sub(h).normalize(); return { mira: h.clone().addScaledVector(d, largo), dir: d }; };
  window.__cab = cab;
  /* un cuadro del juego con las manos que se le pasen (lista de [der, W]) llegando justo antes */
  window.__cuadro = (lista, dibujar = false, dt = 1 / 60) => {
    /* (a 30 por segundo de verdad, como la cámara: sin dibujar, un cuadro por software tarda 3 ms y
       el filtro vería la mano moverse diez veces más rápido de lo que se movió) */
    if (lista.length) { const hasta = (window.__ultCuadro || 0) + 30; while (performance.now() < hasta) { /* espera */ } window.__ultCuadro = performance.now(); }
    /* (con la hora del cuadro que viene: vr.orientar la adelanta ~25 ms; un cuadro dibujado por
       software tarda un segundo y la mano se daría por perdida) */
    const t = (performance.now() + 25) / 1000;
    for (const [der, W] of lista) A.manos.recibirMundo(der, W, t);
    A.paso(dt, dibujar);
  };
};
