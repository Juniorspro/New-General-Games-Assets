// Lo que comparten las pruebas de CONTRAGOLPE: Chromium con WebGL por software (SwiftShader: acá no
// hay placa) y el juego armado (contragolpe.html) abierto por file://. El bucle del juego queda en
// manos de la prueba: requestAnimationFrame se guarda y corre solo con pasos() (tiempo de juego, no
// de reloj; con SwiftShader un cuadro tarda cientos de ms).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

export const AQUI = path.dirname(new URL(import.meta.url).pathname);
export const RAIZ = path.join(AQUI, '..');
export const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });

export async function navegador() {
  const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
}

/* la versión de la APK (herramientas/armar.mjs --apk) servida por http como la sirve la WebView (con fetch; por file://
   Chromium no deja): el HTML y los assets con sus rutas. Devuelve la dirección y cómo cerrarlo */
export async function servirApk({ webp = false } = {}) {
  const { armar } = await import('../herramientas/armar.mjs');
  const { html, archivos } = armar({ apk: { webp } }), mapa = new Map(archivos.map(([r, f]) => ['/' + r, f]));
  const tipo = { webp: 'image/webp', mp3: 'audio/mpeg', etc2: 'application/octet-stream' };
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/' || u === '/index.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(html); }
    if (u === '/favicon.ico') { r.writeHead(204); return r.end(); }
    const f = mapa.get(u); if (!f) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': tipo[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}/index.html`, cerrar: () => srv.close(), archivos };
}

/* abre el juego; movil: con toque (como un teléfono). archivo: otro HTML armado (para comparar); url: una dirección */
export async function abrir(nav, params = '', { ancho = 800, alto = 360, movil = true, archivo = path.join(RAIZ, 'contragolpe.html'), url = null, dpr = 1 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, hasTouch: movil, isMobile: movil, deviceScaleFactor: dpr });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e)));
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pag.addInitScript(() => {
    /* el bucle a mano: los cuadros los da la prueba */
    const cola = []; let ts = 0;
    window.requestAnimationFrame = (f) => { cola.push(f); return cola.length; };
    window.cancelAnimationFrame = () => {};
    window.__cuadros = (n, ms = 1000 / 60) => { for (let i = 0; i < n; i++) { ts += ms; const fs = cola.splice(0); for (const f of fs) f(ts); } };
  });
  await pag.goto((url || 'file://' + archivo) + (params ? '?' + params : ''));
  await pag.waitForFunction(() => window.__C && window.__C.listo, null, { timeout: 180000, polling: 250 });
  return { ctx, pag, errores };
}
