// Anger of Stick 5 — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/aos5/prueba.mjs http://127.0.0.1:8876/aos5/ [entrega-aos5/aos5.apk] [file:///…/aos5.html]
//
// Primer argumento: la carpeta web servida por http (el service worker lo necesita). Opcionales: el
// APK y el .html de un solo archivo. Los toques son dedos de verdad (CDP Input.dispatchTouchEvent) y
// cada control se mide en el estado del juego, leído de su memoria (el objeto bzStateGame):
//   +0x1ae8   la pantalla: 0 título, 51 premio diario, 2 menú, 15 modos, 9 tutorial, 5 niveles,
//             12 armas antes de la etapa, 21 objetivo de la etapa, 11 jugando, 13 pausa
//   +0x32ba20 la x del jugador en la etapa; +0x8dacc su y (más chico = más alto);
//   +0x8dae0  lo que hace: 0 quieto, 30 salta, 40 ataca…
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const WEB = process.argv[2] || 'http://127.0.0.1:8876/aos5/';
const APK = process.argv.slice(3).find((a) => /\.apk$/i.test(a));
const ARCHIVO = process.argv.slice(3).find((a) => /^file:|\.html$/i.test(a));
const CAPTURAS = process.env.CAPTURAS || '/tmp/aos5-prueba';
mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null;      // p. ej. SOLO=C,D para correr sólo esas
const corre = (x) => !SOLO || SOLO.includes(x);
const PANTALLA = { titulo: 0, premio: 51, menu: 2, modos: 15, tutorial: 9, niveles: 5, armas: 12, objetivo: 21, jugando: 11, pausa: 13 };

async function abrir(url, { w = 844, h = 390, movil = true, intro = false, navegador = nav, contexto = null } = {}) {
  const c = contexto || await navegador.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, deviceScaleFactor: movil ? 2 : 1, locale: 'es-AR' });
  const pg = await c.newPage();
  const errores = [], afuera = [];
  const origen = url.startsWith('file:') ? 'file:' : new URL(url).origin;
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)); });
  pg.on('response', (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${r.url()}`); });
  pg.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure() && r.failure().errorText)) errores.push(`falló ${r.url()} ${r.failure() && r.failure().errorText}`); });
  pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(origen) && !/^(data|blob):/.test(u)) afuera.push(u); });
  if (!intro) await pg.addInitScript(() => { try { sessionStorage.setItem('aos5-sin-intro', '1'); } catch (_) {} });
  const cdp = await c.newCDPSession(pg);
  const t0 = Date.now();
  await pg.goto(url);
  return { c, pg, cdp, errores, afuera, t0, movil };
}
// el juego arrancó y dibujó su primer cuadro completo (la pantalla de carga ya se fue)
const listo = (t, ms = 60000) => t.pg.waitForFunction(() => window.AOS && AOS.info && AOS.info.dibujos > 0 && !document.getElementById('carga'), null, { timeout: ms });
const est = (t) => t.pg.evaluate(() => {
  const M = AOS.M;
  const e = M && M._aos_escena_dir ? M._aos_escena_dir() : 0;
  if (!e) return null;
  const r = (o) => M.HEAPU32[(e + o) >> 2] | 0;
  return { pantalla: r(0x1ae8), x: r(0x32ba20), y: r(0x8dacc), accion: r(0x8dae0), vueltas: AOS.info.vueltas,
    error: AOS.error || null, paginas: AOS.info.paginas };
});
async function esperar(t, cond, ms = 20000, paso = 60) {
  const fin = Date.now() + ms;
  for (;;) {
    const e = await est(t);
    if (e && cond(e)) return e;
    if (Date.now() > fin) return null;
    await t.pg.waitForTimeout(paso);
  }
}
// de coordenadas del juego (960×640, y para abajo) a la pantalla física (si web.js giró la página,
// el dedo va donde se ve)
const punto = (t, x, y) => t.pg.evaluate(([x, y]) => {
  const v = AOS.vista();
  const lx = v.x + x / 960 * v.w, ly = v.y + y / 640 * v.h;
  const g = window.Porteo && Porteo.girar && Porteo.girar();
  if (!g || !g.activo()) return [lx, ly];
  const [W, H] = g.fisico();
  return g.sentido() > 0 ? [W - ly, lx] : [ly, H - lx];
}, [x, y]);
async function dedos(t, tipo, lista) {
  const pts = [];
  for (const [x, y, id] of lista) { const [px, py] = await punto(t, x, y); pts.push({ x: px, y: py, id }); }
  if (t.movil) await t.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pts });
  else if (tipo !== 'touchMove') {
    const p = pts[0] || {};
    if (tipo === 'touchStart') { await t.pg.mouse.move(p.x, p.y); await t.pg.mouse.down(); } else await t.pg.mouse.up();
  }
}
async function tocar(t, x, y, ms = 90) {
  await dedos(t, 'touchStart', [[x, y, 1]]);
  await t.pg.waitForTimeout(ms);
  await dedos(t, 'touchEnd', []);
}
// toca hasta que el juego cambie de pantalla (el juego ignora toques mientras anima o carga)
async function tocarHasta(t, x, y, pantalla, ms = 15000, cond = (e) => e.pantalla === pantalla) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    await tocar(t, x, y);
    const e = await esperar(t, cond, 1500);
    if (e) return e;
  }
  return null;
}
// mientras pasa algo, junta muestras del estado
async function muestras(t, ms, accion) {
  const out = [];
  let seguir = true;
  const junta = (async () => { while (seguir) { const e = await est(t); if (e) out.push(e); await t.pg.waitForTimeout(25); } })();
  await accion();
  await t.pg.waitForTimeout(ms);
  seguir = false;
  await junta;
  return out;
}
// del título a la partida, la primera vez (premio diario y tutorial incluidos)
async function aJugar(t, { primera = true } = {}) {
  const pasos = [];
  const paso = async (n, x, y, p) => { const e = await tocarHasta(t, x, y, p); pasos.push(`${n}:${e ? 'ok' : 'NO'}`); return e; };
  await esperar(t, (e) => e.pantalla === PANTALLA.titulo, 30000);
  if (primera) {
    if (!await paso('START', 830, 600, PANTALLA.premio)) return { pasos };
    if (!await paso('premio', 480, 440, PANTALLA.menu)) return { pasos };
    await tocar(t, 930, 160);   // cierra la ventana del premio
  } else if (!await paso('START', 830, 600, PANTALLA.menu)) return { pasos };
  await t.pg.waitForTimeout(500);
  if (!await paso('PLAY MODE', 280, 580, PANTALLA.modos)) return { pasos };
  if (primera) {
    if (!await paso('MAIN', 115, 535, PANTALLA.tutorial)) return { pasos };
    await tocar(t, 930, 605);   // la primera página del tutorial sólo tiene la flecha
    await t.pg.waitForTimeout(600);
    if (!await paso('cerrar tutorial', 937, 14, PANTALLA.niveles)) return { pasos };
  } else if (!await paso('MAIN', 115, 535, PANTALLA.niveles)) return { pasos };
  if (!await paso('nivel 1', 256, 290, PANTALLA.armas)) return { pasos };
  // el cartel con el objetivo de la etapa sale sólo la primera vez
  let e = await tocarHasta(t, 876, 606, null, 15000, (e) => e.pantalla === PANTALLA.objetivo || e.pantalla === PANTALLA.jugando);
  pasos.push(`START:${e ? 'ok' : 'NO'}`);
  if (e && e.pantalla === PANTALLA.objetivo) e = await paso('objetivo', 692, 158, PANTALLA.jugando);
  return { pasos, e };
}

// ── A. carga ────────────────────────────────────────────────────────────────────────────────
console.log('A. Carga');
if (corre('A')) {
  const t = await abrir(WEB, { intro: true });
  const intro = await t.pg.waitForFunction(() => !!document.querySelector('.porteo-intro, #porteo-intro'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (intro) await tocar(t, 480, 320);
  const arranco = await listo(t).then(() => true).catch(() => false);
  const tCarga = Date.now() - t.t0;
  const e = await esperar(t, (e) => e.pantalla === PANTALLA.titulo, 30000);
  await t.pg.waitForTimeout(1500);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-titulo.png` });
  ch('A: carga y muestra el título', arranco && !!e, `${(tCarga / 1000).toFixed(1)} s hasta el primer cuadro`);
  ch('A: sin errores ni pedidos fallidos', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  ch('A: nada sale afuera del sitio', t.afuera.length === 0, t.afuera.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── B. del título a la partida, sólo tocando ────────────────────────────────────────────────
console.log('\nB. Del título a jugar');
if (corre('B')) {
  const t = await abrir(WEB);
  await listo(t);
  const { pasos, e } = await aJugar(t);
  await t.pg.waitForTimeout(800);
  await t.pg.screenshot({ path: `${CAPTURAS}/b-jugando.png` });
  ch('B: título → premio diario → menú → modos → tutorial → nivel 1 → armas → partida, tocando', !!e, pasos.join(' '));
  ch('B: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── C. los controles, medidos en el juego ───────────────────────────────────────────────────
console.log('\nC. Controles');
if (corre('C')) {
  const t = await abrir(WEB);
  await listo(t);
  const { e } = await aJugar(t);
  if (!e) ch('C: llegar a la partida', false);
  else {
    await t.pg.waitForTimeout(600);
    const x0 = (await est(t)).x;
    const der = await muestras(t, 300, async () => { await dedos(t, 'touchStart', [[260, 555, 1]]); await t.pg.waitForTimeout(1500); await dedos(t, 'touchEnd', []); });
    const x1 = der[der.length - 1].x;
    ch('C: flecha derecha: el jugador avanza', x1 > x0 + 100, `x ${x0} → ${x1}`);
    const izq = await muestras(t, 300, async () => { await dedos(t, 'touchStart', [[90, 555, 1]]); await t.pg.waitForTimeout(1000); await dedos(t, 'touchEnd', []); });
    const x2 = izq[izq.length - 1].x;
    ch('C: flecha izquierda: vuelve', x2 < x1 - 50, `x ${x1} → ${x2}`);
    await t.pg.waitForTimeout(400);
    const y0 = (await est(t)).y;
    const salto = await muestras(t, 1200, () => tocar(t, 890, 440));
    const yMin = Math.min(...salto.map((s) => s.y)), yFin = salto[salto.length - 1].y;
    ch('C: botón verde: salta y vuelve al piso', yMin < y0 - 30 && Math.abs(yFin - y0) < 3 && salto.some((s) => s.accion === 30), `y ${y0} → ${yMin} → ${yFin}`);
    const golpe = await muestras(t, 900, () => tocar(t, 710, 555));
    ch('C: botón rojo: ataca', golpe.some((s) => s.accion === 40), [...new Set(golpe.map((s) => s.accion))].join(','));
    // dos dedos: caminar y atacar a la vez
    const xa = (await est(t)).x;
    const dos = await muestras(t, 200, async () => {
      await dedos(t, 'touchStart', [[260, 555, 1]]);
      await t.pg.waitForTimeout(350);
      await dedos(t, 'touchStart', [[260, 555, 1], [710, 555, 2]]);
      await t.pg.waitForTimeout(120);
      await dedos(t, 'touchEnd', [[260, 555, 1]]);
      await t.pg.waitForTimeout(700);
      await dedos(t, 'touchEnd', []);
    });
    ch('C: multitáctil: camina y ataca al mismo tiempo', dos.some((s) => s.accion === 40) && dos[dos.length - 1].x > xa + 40, `x ${xa} → ${dos[dos.length - 1].x}`);
    // 60 cuadros: caminando, entre vuelta y vuelta se dibujan cuadros intermedios, y en el de la mitad
    // cada pieza está a mitad de camino entre la vuelta anterior y la actual
    const c0 = await t.pg.evaluate(() => ({ ...AOS.info }));
    await dedos(t, 'touchStart', [[260, 555, 1]]);
    await t.pg.waitForTimeout(1500);
    const medio = await t.pg.evaluate(() => {
      const M = AOS.M;
      const centros = (a) => {
        const n = M._aos_interpolar(a), F = M.HEAPF32, b0 = M._aos_verts_ptr() >> 2, c = [];
        for (let i = 0; i < n; i++) { const b = b0 + i * 20; c.push((F[b] + F[b + 15]) / 2, (F[b + 1] + F[b + 16]) / 2); }
        return c;
      };
      const p = centros(0), m = centros(0.5), a = centros(1);
      let mueven = 0, fuera = 0;
      for (let i = 0; i < a.length; i += 2) {
        if (Math.hypot(a[i] - p[i], a[i + 1] - p[i + 1]) > 0.5) mueven++;
        if (Math.hypot(m[i] - (p[i] + a[i]) / 2, m[i + 1] - (p[i + 1] + a[i + 1]) / 2) > 0.01) fuera++;
      }
      return { mueven, fuera, piezas: a.length / 2 };
    });
    await dedos(t, 'touchEnd', []);
    const c1 = await t.pg.evaluate(() => ({ ...AOS.info }));
    const inter = c1.intermedios - c0.intermedios, vueltas = c1.vueltas - c0.vueltas;
    ch('C: 60 cuadros: entre vuelta y vuelta dibuja los puntos intermedios', inter > 0 && medio.mueven > 0 && medio.fuera === 0,
      `${inter} cuadros intermedios en ${vueltas} vueltas; ${medio.mueven} de ${medio.piezas} piezas en movimiento, ${medio.fuera} fuera de lugar en la mitad`);
    ch('C: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  }
  await t.c.close();
}

// ── D. pausa: el botón y atrás ──────────────────────────────────────────────────────────────
console.log('\nD. Pausa');
if (corre('D')) {
  const t = await abrir(WEB);
  await listo(t);
  const { e } = await aJugar(t);
  if (!e) ch('D: llegar a la partida', false);
  else {
    await t.pg.waitForTimeout(600);
    const p1 = await tocarHasta(t, 937, 18, PANTALLA.pausa, 6000);
    await t.pg.screenshot({ path: `${CAPTURAS}/d-pausa.png` });
    const xp = (await est(t)).x;
    await dedos(t, 'touchStart', [[260, 555, 1]]);
    await t.pg.waitForTimeout(800);
    await dedos(t, 'touchEnd', []);
    const quieto = (await est(t)).x === xp;
    await t.pg.keyboard.press('Escape');
    const sigue = await esperar(t, (e) => e.pantalla === PANTALLA.jugando, 4000);
    ch('D: el botón de pausa pausa (el jugador no se mueve) y atrás sigue', !!p1 && quieto && !!sigue);
    await t.pg.keyboard.press('Escape');
    const p2 = await esperar(t, (e) => e.pantalla === PANTALLA.pausa, 4000);
    await t.pg.keyboard.press('Escape');
    const s2 = await esperar(t, (e) => e.pantalla === PANTALLA.jugando, 4000);
    ch('D: atrás (Escape) pausa y otra vez sigue', !!p2 && !!s2);
    // en el menú, atrás muestra la ventana de salir del juego
    ch('D: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  }
  await t.c.close();
}

// ── E. la página oculta: el juego se entera (guarda y pausa) y suelta los dedos ──────────────
console.log('\nE. Página oculta');
if (corre('E')) {
  const t = await abrir(WEB);
  await listo(t);
  const { e } = await aJugar(t);
  if (!e) ch('E: llegar a la partida', false);
  else {
    await t.pg.waitForTimeout(600);
    await dedos(t, 'touchStart', [[260, 555, 1]]);      // camina...
    await t.pg.waitForTimeout(500);
    const ocultar = (si) => t.pg.evaluate((si) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => si });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (si ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, si);
    await ocultar(true);                                  // ...y se va a otra app con el dedo apoyado
    const a = await est(t);
    await t.pg.waitForTimeout(700);
    const b = await est(t);
    const audio = await t.pg.evaluate(() => { const c = AOS.sonido && AOS.sonido.ctx && AOS.sonido.ctx(); return c ? c.state : 'sin contexto'; });
    ch('E: oculta, el juego no avanza', a.vueltas === b.vueltas && a.x === b.x, `vueltas ${a.vueltas} → ${b.vueltas}`);
    ch('E: oculta, el sonido se suspende', audio !== 'running', audio);
    await ocultar(false);
    await t.pg.waitForTimeout(800);
    const c = await est(t);
    await t.pg.waitForTimeout(500);
    const d = await est(t);
    ch('E: al volver sigue, y el dedo que quedó apoyado se soltó (no camina solo)', d.vueltas > c.vueltas && d.x === c.x, `x ${c.x} → ${d.x}`);
    await dedos(t, 'touchEnd', []);
    const guardo = await t.pg.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('aos5.archivo.')).length);
    ch('E: al ocultarse guardó (archivos de la partida en el navegador)', guardo >= 5, `${guardo} archivos`);
    ch('E: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  }
  await t.c.close();
}

// ── F. el guardado sobrevive a una recarga ──────────────────────────────────────────────────
console.log('\nF. Guardado');
if (corre('F')) {
  const t = await abrir(WEB);
  await listo(t);
  const { e } = await aJugar(t);
  await t.pg.reload();
  await listo(t);
  // ya cobró el premio de hoy y vio el tutorial: START va directo al menú y MAIN a los niveles
  const r = await aJugar(t, { primera: false });
  ch('F: después de recargar no vuelve el premio de hoy ni el tutorial, y el nivel 1 sigue abierto', !!e && !!r.e, r.pasos.join(' '));
  ch('F: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── G. pantallas: acostado, parado (se gira), chico y en una compu ─────────────────────────
console.log('\nG. Pantallas');
if (corre('G')) for (const [nombre, w, h, movil] of [['acostado 844×390', 844, 390, true], ['parado 412×915 (se gira)', 412, 915, true], ['chico 360×640 (se gira)', 360, 640, true], ['compu 1280×720', 1280, 720, false]]) {
  const t = await abrir(WEB, { w, h, movil });
  await listo(t);
  const llena = await t.pg.evaluate(() => {
    const r = document.getElementById('juego').getBoundingClientRect();
    return Math.round(r.width) >= innerWidth - 1 && Math.round(r.height) >= innerHeight - 1;
  });
  await esperar(t, (e) => e.pantalla === PANTALLA.titulo, 30000);
  const e = await tocarHasta(t, 830, 600, PANTALLA.premio);   // START, abajo a la derecha
  const e2 = e && await tocarHasta(t, 480, 440, PANTALLA.menu);
  await t.pg.screenshot({ path: `${CAPTURAS}/g-${w}x${h}.png` });
  ch(`G: ${nombre}: el juego ocupa la pantalla y los toques caen donde se ve`, llena && !!e && !!e2);
  if (t.errores.length) ch(`G: ${nombre}: sin errores`, false, t.errores.slice(0, 2).join(' | '));
  await t.c.close();
}

// ── H. sin red ──────────────────────────────────────────────────────────────────────────────
console.log('\nH. Sin red');
if (corre('H') && WEB.startsWith('http')) {
  const t = await abrir(WEB);
  await listo(t);
  const guardo = await t.pg.evaluate(async () => {
    for (let i = 0; i < 240; i++) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r && r.active && r.active.state === 'activated' && navigator.serviceWorker.controller) {
        const n = (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0);
        if (n > 80) return n;
      }
      await new Promise((ok) => setTimeout(ok, 500));
    }
    return 0;
  });
  ch('H: el service worker guarda el juego al instalarse', guardo > 80, `${guardo} archivos`);
  await t.c.setOffline(true);
  await t.pg.reload();
  const anda = await listo(t, 30000).then(() => true).catch(() => false);
  const juega = anda && !!(await aJugar(t)).e;   // la primera partida de este navegador, ya sin red
  ch('H: sin internet abre y se juega', anda && juega);
  await t.c.close();
}

// ── I. el .html de un solo archivo ──────────────────────────────────────────────────────────
if (ARCHIVO && corre('I')) {
  console.log('\nI. Un solo archivo');
  const url = ARCHIVO.startsWith('file:') ? ARCHIVO : 'file://' + ARCHIVO;
  const t = await abrir(url);
  const anda = await listo(t, 90000).then(() => true).catch(() => false);
  const juega = anda && !!(await aJugar(t)).e;
  ch('I: abierto desde el disco carga y se juega', anda && juega);
  ch('I: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── J. el APK ───────────────────────────────────────────────────────────────────────────────
if (APK && corre('J')) {
  console.log('\nJ. APK');
  const BT = (process.env.ANDROID_HOME || '/opt/android-sdk') + '/build-tools/35.0.0';
  if (!existsSync(BT)) ch('J: build-tools para revisar el APK', false, BT);
  else {
    let v = '';
    try { v = execFileSync(BT + '/apksigner', ['verify', '--verbose', APK], { encoding: 'utf8' }); } catch (e) { v = String(e.stdout || e); }
    ch('J: apksigner verify', /Verifies/.test(v) && !/DOES NOT VERIFY/.test(v));
    const b = execFileSync(BT + '/aapt2', ['dump', 'badging', APK], { encoding: 'utf8' });
    const paquete = /package: name='ar\.juniors\.aos5'/.test(b), nombre = /application-label:'Anger of Stick 5'/.test(b);
    const icono = /application-icon-\d+:'[^']+'/.test(b), sdk = /minSdkVersion:'(\d+)'/.exec(b);
    // screenOrientation 6 = sensorLandscape
    const acostado = /screenOrientation\(0x0101001e\)=6\b/.test(execFileSync(BT + '/aapt2', ['dump', 'xmltree', APK, '--file', 'AndroidManifest.xml'], { encoding: 'utf8' }));
    ch('J: nombre, paquete, ícono, acostado y SDK', paquete && nombre && icono && acostado && !!sdk, `sdk ${sdk && sdk[1]}`);
    const lista = execFileSync('unzip', ['-l', APK], { encoding: 'utf8' });
    const faltan = ['aos5-wasm.wasm', 'aos5-wasm.js', 'aos5.js', 'index.html', 'datos/imagenes.bin', 'datos/imagen.bin', 'datos/datos.bin', 'datos/arial.ttf', 'datos/sonido/1.ogg']
      .filter((f) => !lista.includes(f));
    ch('J: todo el juego adentro', faltan.length === 0, faltan.join(', '));
  }
}

await nav.close();
console.log(`\n${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
