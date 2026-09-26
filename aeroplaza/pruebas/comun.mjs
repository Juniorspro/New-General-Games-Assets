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
export async function navegador() {
  const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
    /* el chat de voz: un micrófono falso (un tono con pitidos) que se da sin preguntar */
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
}
/* abre el juego; red: 'no' (sin internet) o 'local' (mqtt.js de la carpeta) */
export async function abrir(nav, params = '', { ancho = 960, alto = 540, red = 'no', archivo = 'aeroplaza.html', movil = false, manos = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, hasTouch: movil, isMobile: movil, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
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
export async function avanzar(pag, n = 30, dt = 1 / 30) {
  /* solo se dibuja el último cuadro, y se espera a que la placa (por software) termine */
  await pag.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__A.paso(dt, i === n - 1); const gl = window.__A.motor.r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }, [n, dt]);
}
