// Geometry Dash — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/gd/prueba.mjs [CARPETA_WEB] [ARCHIVO.html]
//
// CARPETA_WEB: la carpeta que arma portear.sh (default entrega-gd/gd); se sirve por http acá
// mismo (el service worker lo necesita). ARCHIVO: el .html único (default entrega-gd/gd.html).
// Los toques son dedos de verdad (CDP Input.dispatchTouchEvent) y todo se mide en el estado del
// juego (window.__gd): en qué pantalla está, dónde está el jugador, qué música suena.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.resolve(AQUI, '..', '..');
const WEB = path.resolve(process.argv[2] || path.join(RAIZ, 'entrega-gd', 'gd'));
const ARCHIVO = path.resolve(process.argv[3] || path.join(RAIZ, 'entrega-gd', 'gd.html'));
const CAPTURAS = process.env.CAPTURAS || '/tmp';
process.env.GD_DATOS = path.join(WEB, 'datos');

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp',
                '.txt': 'text/plain', '.ogg': 'audio/ogg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const servir = (raiz, puerto) => http.createServer((q, r) => {
  const f = path.join(raiz, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
    r.end(d);
  });
}).listen(puerto, '127.0.0.1');
const srv = servir(WEB, 8861);
const URL_WEB = 'http://127.0.0.1:8861/';
// para los embebidos: una página que trae el .html único y lo mete en un iframe de tres formas
const srvUnico = http.createServer((q, r) => {
  if (q.url.startsWith('/gd.html')) { r.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(ARCHIVO).pipe(r); return; }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end('<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe id="f" style="border:0;width:100vw;height:100vh" allow="autoplay; fullscreen"></iframe>');
}).listen(8862, '127.0.0.1');

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

async function abrir(url, { w = 844, h = 390, ctx = null } = {}) {
  const c = ctx || await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errores.push(m.text().slice(0, 160)); });
  pg.on('requestfailed', (q) => { if (!/favicon/.test(q.url())) errores.push('pedido fallido: ' + q.url().slice(0, 100)); });
  pg.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errores.push(`${r.status()} ${r.url().slice(0, 100)}`); });
  const t0 = Date.now();
  await pg.goto(url);
  const cdp = await c.newCDPSession(pg);
  return { c, pg, cdp, errores, t0 };
}

// lo que importa del estado del juego
const estado = (pg) => pg.evaluate(() => {
  const a = window.__gd;
  if (!a) return { cargado: false, intro: !!document.getElementById('porteo-intro') };
  const p = a.partida;
  const pant = a.pantalla === a.menu ? 'menu' : a.pantalla === a.selector ? 'selector' : p && a.pantalla === p ? 'partida' : '?';
  return {
    cargado: true, intro: !!document.getElementById('porteo-intro'), pantalla: pant, pagina: a.selector.pagina,
    estado: p && p.estado, x: p && p.juego.jugador.x, y: p && p.juego.jugador.y, intento: p && p.juego.intento,
    practica: p && p.practica, controles: p && p.controles.length, saltos: p && p.saltos,
    musica: a.audio.actual && a.audio.actual.nombre, audio: a.audio.ctx && a.audio.ctx.state, VW: a.render.VW,
  };
});
async function esperar(pg, cond, ms = 20000, paso = 100) {
  const fin = Date.now() + ms;
  for (;;) {
    const e = await estado(pg);
    if (cond(e)) return e;
    if (Date.now() > fin) return null;
    await pg.waitForTimeout(paso);
  }
}

// Unidades del juego (320 de alto, (0,0) abajo a la izquierda) → píxeles físicos. Con el teléfono
// parado la página va girada (web.js): se calcula el punto lógico y se deshace el giro.
const fisico = (pg, gx, gy) => pg.evaluate(([gx, gy]) => {
  const r = window.__gd.render;
  const b = document.getElementById('c').getBoundingClientRect();     // lógico (web.js lo traduce)
  const lx = b.left + gx / r.VW * b.width, ly = b.top + (1 - gy / r.VH) * b.height;
  const g = window.Porteo && Porteo.girar && Porteo.girar('landscape');
  if (!g || !g.activo()) return [lx, ly];
  const [W, H] = g.fisico();
  return g.sentido() > 0 ? [W - ly, lx] : [ly, H - lx];
}, [gx, gy]);
async function apoyar(t, x, y, id = 1) {
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] });
}
async function levantar(t) {
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tocar(t, gx, gy, ms = 70) {
  const [x, y] = await fisico(t.pg, gx, gy);
  await apoyar(t, x, y);
  await t.pg.waitForTimeout(ms);
  await levantar(t);
}
async function saltearIntro(t) {
  await esperar(t.pg, (e) => e.intro, 8000);
  const [w, h] = await t.pg.evaluate(() => [innerWidth, innerHeight]);
  await apoyar(t, w / 2, h / 2);
  await levantar(t);
  return esperar(t.pg, (e) => e.cargado && !e.intro && e.pantalla === 'menu', 60000);
}

// El camino del bot para Stereo Madness (en Node, con el mismo motor): para terminar un nivel
// en la página y probar el final, lo guardado y las estrellas.
const { resolver } = require(path.join(AQUI, 'pruebas', 'bot.js'));
const camino1 = (await resolver(1)).camino;

console.log('\nA. Teléfono acostado (844×390), la carpeta web por http');
{
  const t = await abrir(URL_WEB);
  const intro = await esperar(t.pg, (e) => e.intro, 8000);
  ch('A: aparece la intro de JXStudios', !!intro);
  const menu = await saltearIntro(t);
  ch('A: un toque saltea la intro y queda el menú', !!menu, `${((Date.now() - t.t0) / 1000).toFixed(1)} s`);
  await t.pg.waitForTimeout(400);
  await t.pg.screenshot({ path: `${CAPTURAS}/gd-a-menu.png` });
  await tocar(t, menu.VW / 2, 160);
  ch('A: el botón de jugar lleva al selector de niveles', !!await esperar(t.pg, (e) => e.pantalla === 'selector', 3000));
  // deslizar con el dedo a la página siguiente
  const [x0, y0] = await fisico(t.pg, menu.VW * 0.75, 196), [x1] = await fisico(t.pg, menu.VW * 0.25, 196);
  await apoyar(t, x0, y0);
  for (let i = 1; i <= 8; i++) {
    await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0, id: 1 }] });
    await t.pg.waitForTimeout(16);
  }
  await levantar(t);
  ch('A: deslizar el dedo pasa al nivel siguiente', !!await esperar(t.pg, (e) => e.pagina === 1, 3000));
  await tocar(t, 26, 196);
  ch('A: la flecha vuelve al nivel anterior', !!await esperar(t.pg, (e) => e.pagina === 0, 3000));
  await t.pg.waitForTimeout(600);
  await tocar(t, menu.VW / 2, 196);
  const juega = await esperar(t.pg, (e) => e.pantalla === 'partida' && e.estado === 'jugando', 15000);
  ch('A: tocar el nivel lo arranca', !!juega);
  const suena = await esperar(t.pg, (e) => e.musica === 'StereoMadness' && e.audio === 'running', 5000);
  ch('A: suena la canción del nivel', !!suena, suena ? suena.audio : '');
  // un toque: el cubo salta (la altura sube)
  await t.pg.waitForTimeout(300);
  const antes = await estado(t.pg);
  await tocar(t, menu.VW / 2, 200, 50);
  const salto = await esperar(t.pg, (e) => e.y > antes.y + 20, 1500, 30);
  ch('A: un toque hace saltar al cubo', !!salto, salto ? `y ${antes.y.toFixed(0)} → ${salto.y.toFixed(0)}` : '');
  // sin tocar más, choca con el pincho y vuelve a empezar
  const muere = await esperar(t.pg, (e) => e.estado === 'muerto', 8000, 50);
  ch('A: chocar con un pincho mata', !!muere);
  const otra = await esperar(t.pg, (e) => e.estado === 'jugando' && e.intento === (muere ? muere.intento + 1 : 2), 3000, 50);
  ch('A: al morir vuelve a empezar solo (Attempt 2)', !!otra);
  // pausa con el botón y con atrás (Escape)
  await tocar(t, menu.VW - 22, 320 - 22);
  const pausa = await esperar(t.pg, (e) => e.estado === 'pausa', 2000, 50);
  ch('A: el botón de pausa pausa (y la música se corta)', !!pausa && pausa.musica === null);
  await t.pg.screenshot({ path: `${CAPTURAS}/gd-a-pausa.png` });
  await t.pg.keyboard.press('Escape');
  ch('A: Escape (atrás) sigue la partida', !!await esperar(t.pg, (e) => e.estado === 'jugando' || e.estado === 'muerto', 2000, 50));
  await t.pg.keyboard.press('Escape');
  ch('A: Escape (atrás) pausa', !!await esperar(t.pg, (e) => e.estado === 'pausa', 2000, 50));
  // práctica: desde la pausa, con su música y sus puntos de control
  await tocar(t, menu.VW / 2 - 120, 80);
  const prac = await esperar(t.pg, (e) => e.practica && e.musica === 'StayInsideMe', 4000, 50);
  ch('A: el botón de práctica pasa a modo práctica con su música', !!prac);
  await esperar(t.pg, (e) => e.estado === 'jugando', 3000, 50);
  const ctl0 = (await estado(t.pg)).controles;
  await tocar(t, menu.VW / 2 - 42, 30);
  ch('A: el botón verde pone un punto de control', !!await esperar(t.pg, (e) => e.controles > ctl0, 1500, 30));
  // segundo plano
  const susp = await t.pg.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 400));
    const a = [window.__gd.audio.ctx.state, window.__gd.partida.estado];
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 400));
    return [...a, window.__gd.audio.ctx.state];
  });
  ch('A: al ir a segundo plano pausa y silencia; al volver el sonido vuelve', susp[0] === 'suspended' && susp[1] === 'pausa' && susp[2] === 'running', susp.join(' → '));
  // de vuelta al menú, y el nivel entero con los toques del bot (mismo motor: mismo resultado)
  await tocar(t, menu.VW / 2 + 125, 80);
  ch('A: el botón de menú vuelve al selector', !!await esperar(t.pg, (e) => e.pantalla === 'selector', 3000));
  await t.pg.waitForTimeout(600);
  await tocar(t, menu.VW / 2, 196);
  await esperar(t.pg, (e) => e.pantalla === 'partida', 15000);
  const fin = await t.pg.evaluate((camino) => {
    const p = window.__gd.partida, j = p.juego;
    p.empezar();
    let k = 1, sost = false;
    while (!j.completo && !j.muerto && j.pasos < 60 * 240 * 3) {
      while (k < camino.length && camino[k][0] - 4 <= j.pasos) {
        const s = camino[k][1];
        if (s !== sost) { if (s) j.jugador.presionar(); else j.jugador.soltar(); sost = s; }
        k++;
      }
      j.paso();
    }
    return { completo: j.completo, muerto: j.muerto, x: Math.round(j.jugador.x), estado: p.estado };
  }, camino1);
  ch('A: Stereo Madness se termina entero (los toques del bot, en la página)', fin.completo && fin.estado === 'completo', JSON.stringify(fin));
  await t.pg.waitForTimeout(2600);
  await t.pg.screenshot({ path: `${CAPTURAS}/gd-a-final.png` });
  const g = await t.pg.evaluate(() => ({ n: window.__gd.guardado.nivel(1), estrellas: window.__gd.guardado.estrellas() }));
  ch('A: queda guardado: 100 %, completo y 1 estrella', g.n.completo && g.n.normal === 100 && g.estrellas === 1, JSON.stringify(g));
  await tocar(t, menu.VW / 2 + 50, 320 / 2 - 6 - 62);
  ch('A: el botón de menú del final vuelve al selector', !!await esperar(t.pg, (e) => e.pantalla === 'selector', 3000));
  ch('A: sin errores en la consola ni pedidos fallidos', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  // lo guardado sobrevive a una recarga
  await t.pg.reload();
  await saltearIntro(t);
  const vuelta = await t.pg.evaluate(() => window.__gd.guardado.nivel(1));
  ch('A: al volver a abrir, el récord sigue ahí', vuelta.completo && vuelta.normal === 100);
  await t.c.close();
}

console.log('\nB. Teléfono parado (390×844): el juego se gira solo');
{
  const t = await abrir(URL_WEB, { w: 390, h: 844 });
  const menu = await saltearIntro(t);
  ch('B: la página va girada', await t.pg.evaluate(() => document.documentElement.classList.contains('porteo-girado')));
  const lienzo = await t.pg.evaluate(() => { const c = document.getElementById('c'); return [c.clientWidth, c.clientHeight]; });
  ch('B: el lienzo es horizontal y ocupa todo (844×390 lógicos)', lienzo[0] === 844 && lienzo[1] === 390, lienzo.join('×'));
  await tocar(t, menu.VW / 2, 160);
  ch('B: girado, el toque cae donde se ve (jugar → selector)', !!await esperar(t.pg, (e) => e.pantalla === 'selector', 3000));
  await t.pg.screenshot({ path: `${CAPTURAS}/gd-b-girado.png` });
  ch('B: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

console.log('\nC. Pantalla chica (640×360)');
{
  const t = await abrir(URL_WEB, { w: 640, h: 360 });
  const menu = await saltearIntro(t);
  await t.pg.waitForFunction(() => window.__gd.menu.botones.vivos.size >= 3, null, { timeout: 5000 }).catch(() => {});
  const r = await t.pg.evaluate(() => {
    const a = window.__gd, R = a.render;
    const dentro = (b) => { const [w, h] = R.tamCuadro(b.cuadro); return b.x - w * b.escala / 2 >= 0 && b.x + w * b.escala / 2 <= R.VW && b.y - h * b.escala / 2 >= 0 && b.y + h * b.escala / 2 <= R.VH; };
    return [...a.menu.botones.vivos].map((id) => [id, dentro(a.menu.botones.botones.get(id))]);
  });
  ch('C: los botones del menú entran enteros', r.length >= 3 && r.every(([, d]) => d), JSON.stringify(r));
  await tocar(t, menu.VW / 2, 160);
  await esperar(t.pg, (e) => e.pantalla === 'selector', 3000);
  await t.pg.screenshot({ path: `${CAPTURAS}/gd-c-chica.png` });
  ch('C: el selector abre', (await estado(t.pg)).pantalla === 'selector');
  await t.c.close();
}

console.log('\nD. Sin internet (service worker de la carpeta web)');
{
  const t = await abrir(URL_WEB);
  await saltearIntro(t);
  const guardado = await t.pg.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 240; i++) {
      for (const k of await caches.keys()) { const c = await caches.open(k); if (await c.match('datos/musica/Fingerdash.ogg')) return true; }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  ch('D: la primera visita deja todo guardado para jugar sin red', guardado);
  await t.c.setOffline(true);
  await t.pg.reload();
  ch('D: sin red, el juego abre hasta el menú', !!await saltearIntro(t));
  await t.c.close();
}

console.log('\nE. Un solo archivo (.html abierto del disco)');
{
  const t = await abrir('file://' + ARCHIVO);
  const menu = await saltearIntro(t);
  ch('E: abre desde el disco hasta el menú', !!menu, `${((Date.now() - t.t0) / 1000).toFixed(1)} s`);
  const musica = await t.pg.evaluate(async () => {
    const t0 = performance.now();
    const r = await fetch('datos/musica/Fingerdash.ogg');
    return { ok: r.ok, bytes: (await r.arrayBuffer()).byteLength, ms: Math.round(performance.now() - t0) };
  });
  ch('E: la música llega entera (la del último nivel también)', musica.ok && musica.bytes > 100000, JSON.stringify(musica));
  await tocar(t, menu.VW / 2, 160);
  await esperar(t.pg, (e) => e.pantalla === 'selector', 3000);
  await t.pg.waitForTimeout(500);
  await tocar(t, menu.VW / 2, 196);
  ch('E: se juega y suena', !!await esperar(t.pg, (e) => e.pantalla === 'partida' && e.musica === 'StereoMadness', 15000));
  ch('E: sin errores ni pedidos afuera', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

console.log('\nF. El .html único dentro de otra página (como lo puede mostrar una plataforma)');
for (const modo of ['srcdoc', 'blob', 'write']) {
  const c = await nav.newContext({ viewport: { width: 844, height: 390 } });
  const pg = await c.newPage();
  await pg.goto('http://127.0.0.1:8862/');
  await pg.evaluate(async (modo) => {
    const html = await (await fetch('/gd.html')).text();
    const f = document.getElementById('f');
    if (modo === 'srcdoc') { f.setAttribute('sandbox', 'allow-scripts allow-same-origin'); f.srcdoc = html; }
    else if (modo === 'blob') f.src = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    else { const d = f.contentDocument; d.open(); d.write(html); d.close(); }
  }, modo);
  let listo = false;
  for (let i = 0; i < 150 && !listo; i++) {
    await pg.waitForTimeout(200);
    listo = await pg.evaluate(() => { try { const w = document.getElementById('f').contentWindow; return !!(w.__gd && w.__gd.pantalla === w.__gd.menu); } catch (_) { return false; } });
  }
  ch(`F: ${modo}: llega al menú`, listo);
  await c.close();
}

console.log(`\n${ok} bien, ${mal} mal`);
await nav.close();
srv.close();
srvUnico.close();
process.exit(mal ? 1 : 0);
