// Half-Life — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/half-life/prueba.mjs http://127.0.0.1:8861/half-life/ [entrega-half-life/half-life.apk] [file:///…/half-life.html]
//
// Primer argumento: la carpeta web servida por http (IndexedDB y el service worker lo necesitan).
// Opcionales: el APK y el .html de un solo archivo. Los toques son dedos de verdad (CDP
// Input.dispatchTouchEvent, dos a la vez para caminar y mirar) y cada control se mide en el estado
// del juego que da el motor (Porteo_Estado, parche nuestro): posición, ángulos, arma en la mano,
// animación del arma, pausa y a dónde van las teclas (0 consola, 1 juego, 2 menú, 3 chat).
//
// Las coordenadas del menú son las de mainui (1024×768 escalado al alto de la pantalla) en un
// teléfono acostado de 844×390; parado, la página va girada (web.js) y se deshace el giro.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const WEB = process.argv[2] || 'http://127.0.0.1:8861/half-life/';
const APK = process.argv.slice(3).find((a) => /\.apk$/i.test(a));
const ARCHIVO = process.argv.slice(3).find((a) => /^file:|\.html$/i.test(a));
const CAPTURAS = process.env.CAPTURAS || '/tmp/half-life-prueba';
mkdirSync(CAPTURAS, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [...ARGS, '--autoplay-policy=no-user-gesture-required'] });
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const r1 = (n) => Math.round(n * 10) / 10;
const conConsola = (u) => u + (u.includes('?') ? '&' : '?') + 'consola';

async function abrir(url, { w = 844, h = 390, idioma = 'es-AR', navegador = nav, contexto = {} } = {}) {
  const c = await navegador.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: idioma, ...contexto });
  const pg = await c.newPage();
  const errores = [], afuera = [];
  const origen = new URL(url).origin;
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('dialog', async (d) => { errores.push('cartel: ' + d.message().replace(/\s+/g, ' ')); await d.dismiss().catch(() => {}); });
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errores.push(m.text().slice(0, 160)); });
  pg.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errores.push(`${r.status()} ${r.url()}`); });
  pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(origen) && !/^(data|blob):/.test(u)) afuera.push(u); });
  const t0 = Date.now();
  await pg.goto(url);
  const cdp = await c.newCDPSession(pg);
  return { c, pg, cdp, errores, afuera, t0 };
}
const estado = (pg) => pg.evaluate(() => (window.HL && window.HL.estado()) || {});
async function esperar(pg, cond, ms = 20000, paso = 150) {
  const fin = Date.now() + ms;
  for (;;) {
    const e = await estado(pg);
    if (cond(e)) return e;
    if (Date.now() > fin) return null;
    await pg.waitForTimeout(paso);
  }
}
async function hastaElMenu(t) {
  await t.pg.waitForFunction(() => window.__hl && window.__hl.fase === 'jugando', null, { timeout: 180000 });
  const listo = (Date.now() - t.t0) / 1000;
  await t.pg.waitForFunction(() => !document.getElementById('porteo-intro'), null, { timeout: 30000 });
  await esperar(t.pg, (e) => e.destino === 2, 30000);
  await t.pg.waitForTimeout(1500);
  return listo;
}

// lógico (lo que ve el juego) → físico (donde apoya el dedo): con el teléfono parado web.js gira la página
const fis = (t, lx, ly) => t.pg.evaluate(([lx, ly]) => {
  const g = window.Porteo && Porteo.girar && Porteo.girar('landscape');
  if (!g || !g.activo()) return [lx, ly];
  const [W, H] = g.fisico();
  return g.sentido() > 0 ? [W - ly, lx] : [ly, H - lx];
}, [lx, ly]);
const dedos = (t, tipo, puntos) => t.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y, id]) => ({ x, y, id })) });
async function tocar(t, lx, ly, ms = 80) {
  const [x, y] = await fis(t, lx, ly);
  await dedos(t, 'touchStart', [[x, y, 1]]);
  await t.pg.waitForTimeout(ms);
  await dedos(t, 'touchEnd', []);
}
// el centro (lógico) de un botón de los controles, por su nombre
const centro = (t, nombre, n = 0) => t.pg.evaluate(([nombre, n]) => {
  const b = document.querySelectorAll(`#hl-tactil [aria-label="${nombre}"]`)[n];
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, [nombre, n]);
async function boton(t, nombre, ms = 120, n = 0) {
  // al cerrarse un menú del juego los controles vuelven en el siguiente sondeo (≤150 ms)
  await t.pg.waitForFunction(() => !document.getElementById('hl-tactil').classList.contains('oculto'), null, { timeout: 5000 }).catch(() => {});
  const c = await centro(t, nombre, n);
  if (!c) throw new Error('no está el botón ' + nombre);
  await tocar(t, c[0], c[1], ms);
}
// mainui: x del texto de los botones del menú principal y alto de cada uno (vy en 1024×768)
const H = 390, ESC = H / 768;
const menuX = 200 * ESC, menuY = (vy) => (vy + 18) * ESC;
const MENU = { reanudar: 497.6, nueva: 547.2, entrenamiento: 596.8, opciones: 646.4, cargar: 696 };
// la dificultad (NewGame.cpp): Fácil, Normal y Difícil, de a 50 desde 230
const DIFICULTAD = { facil: 230, normal: 280, dificil: 330 };

// Del menú a jugar sólo tocando: Nueva partida → Normal → el viaje en tren (c0a0)
async function aJugar(t, etiqueta) {
  await tocar(t, menuX, menuY(MENU.nueva));
  await t.pg.waitForTimeout(1500);
  await t.pg.screenshot({ path: `${CAPTURAS}/${etiqueta}-dificultad.png` });
  const t0 = Date.now();
  await tocar(t, 150 * ESC, menuY(DIFICULTAD.normal));
  const enMapa = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'c0a0' && e.destino === 1, 120000, 300);
  const seg = (Date.now() - t0) / 1000;
  await t.pg.waitForTimeout(2500);
  return { enMapa, seg };
}
const visibles = (pg) => pg.evaluate(() => !document.getElementById('hl-tactil').classList.contains('oculto'));
// mirar: arrastrar un dedo a la derecha (lógico); devuelve cuánto giró
async function mirar(t, px = 120) {
  const a = await estado(t.pg);
  const [x0, y0] = await fis(t, 600, 200);
  await dedos(t, 'touchStart', [[x0, y0, 2]]);
  for (let i = 1; i <= 12; i++) {
    const [x, y] = await fis(t, 600 + (px * i) / 12, 200);
    await dedos(t, 'touchMove', [[x, y, 2]]);
    await t.pg.waitForTimeout(50);
  }
  await dedos(t, 'touchEnd', []);
  await t.pg.waitForTimeout(500);
  const b = await estado(t.pg);
  return r1(((b.ang[1] - a.ang[1] + 540) % 360) - 180);
}
// el joystick: apoyar a la izquierda y empujar hacia arriba; con mirarTambien, otro dedo mira a la vez
async function caminar(t, ms = 2000, mirarTambien = false) {
  const a = await estado(t.pg);
  const [jx, jy] = await fis(t, 150, 300);
  await dedos(t, 'touchStart', [[jx, jy, 1]]);
  for (let i = 1; i <= 10; i++) {
    const [x, y] = await fis(t, 150, 300 - i * 6);
    await dedos(t, 'touchMove', [[x, y, 1]]);
    await t.pg.waitForTimeout(30);
  }
  const [j2x, j2y] = await fis(t, 150, 240);
  if (mirarTambien) {
    const [mx, my] = await fis(t, 600, 200);
    await dedos(t, 'touchStart', [[j2x, j2y, 1], [mx, my, 2]]);
    for (let i = 1; i <= 12; i++) {
      const [x, y] = await fis(t, 600 + i * 10, 200);
      await dedos(t, 'touchMove', [[j2x, j2y, 1], [x, y, 2]]);
      await t.pg.waitForTimeout(60);
    }
    await t.pg.waitForTimeout(Math.max(0, ms - 720));
  } else {
    await t.pg.waitForTimeout(ms);
  }
  const b = await estado(t.pg);
  await dedos(t, 'touchEnd', []);
  await t.pg.waitForTimeout(400);
  const d = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]);
  return { d: r1(d), giro: r1(((b.ang[1] - a.ang[1] + 540) % 360) - 180) };
}
// la altura máxima, medida cuadro a cuadro adentro de la página (un salto dura medio segundo)
const medirAltura = (t, ms) => t.pg.evaluate((ms) => {
  window.__zmax = -1e9;
  const fin = performance.now() + ms;
  (function cuadro() {
    const e = window.HL.estado();
    if (e && e.pos) window.__zmax = Math.max(window.__zmax, e.pos[2]);
    if (performance.now() < fin) requestAnimationFrame(cuadro);
  })();
}, ms);
async function alturaMaxima(t, ms) {
  await t.pg.waitForTimeout(ms);
  return t.pg.evaluate(() => window.__zmax);
}
const ocultar = (pg, si) => pg.evaluate((si) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => si });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (si ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, si);
const comando = (pg, c) => pg.evaluate((c) => window.HL.comando(c), c);
const partidas = (pg) => pg.evaluate(() => { try { return window.M.FS.readdir('/rwdir/valve/save').filter((n) => /\.sav$/.test(n)); } catch (_) { return []; } });

console.log('A. Teléfono acostado (844×390), en español: del menú a jugar, cada control medido');
{
  const t = await abrir(conConsola(WEB));
  // lo que avisa el motor: una entidad que no se pudo guardar entera, o un sonido que se apagó para todo el nivel
  const perdidos = () => t.pg.evaluate(() => window.__hl.log.filter((l) => /Invalid function|Could not load sound/.test(l)));
  const listo = await hastaElMenu(t);
  ch('A: carga hasta el menú', listo > 0, `motor andando a los ${r1(listo)} s`);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-menu.png` });
  const es = await t.pg.evaluate(() => !!window.__hl.montado['idioma-es'] && window.M.FS.analyzePath('/rwdir/valve_spanish/porteo-idioma-es.pk3').exists);
  ch('A: el español latino (textos y menú) está montado donde Xash busca el idioma', es);
  ch('A: el botón del idioma se ve en el menú principal', await t.pg.evaluate(() => document.getElementById('hl-idioma').className === 'si'));
  const { enMapa, seg } = await aJugar(t, 'a');
  ch('A: Nueva partida → Normal, sólo tocando: entra al viaje en tren', !!enMapa, `${r1(seg)} s`);
  ch('A: los controles se ven al jugar (y no en los menús)', await visibles(t.pg));
  ch('A: el botón del idioma no se ve jugando', await t.pg.evaluate(() => document.getElementById('hl-idioma').className !== 'si'));
  await t.pg.screenshot({ path: `${CAPTURAS}/a-tren.png` });
  const voz = await t.pg.evaluate(() => !!window.__hl.montado['voces-es/c0a0']);
  ch('A: con el nivel van sus frases en español (el anuncio del tren)', voz);
  const giroTren = await mirar(t, 120);
  ch('A: en el tren, arrastrar a la derecha mira a la derecha', giroTren < -15 && giroTren > -40, `${giroTren}°`);

  // guardado rápido en el tren (el archivo queda en el disco del juego, en IndexedDB)
  await boton(t, 'Guardado rápido');
  await t.pg.waitForTimeout(2500);
  ch('A: Guardado rápido guarda la partida', (await partidas(t.pg)).includes('quick.sav'), (await partidas(t.pg)).join(', '));
  const perdidos0 = await perdidos();
  ch('A: el nivel y lo guardado, sin nada perdido (funciones de las entidades, sonidos)', perdidos0.length === 0, perdidos0.slice(0, 3).join(' | '));

  await boton(t, 'Pausa');
  const pausa = await esperar(t.pg, (e) => e.destino === 2, 4000);
  await t.pg.waitForTimeout(1000);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-pausa.png` });
  ch('A: Pausa abre el menú del juego (y esconde los controles)', !!pausa && !(await visibles(t.pg)));
  await tocar(t, menuX, menuY(MENU.reanudar));
  const sigue = await esperar(t.pg, (e) => e.destino === 1, 4000);
  ch('A: "Reanudar partida" vuelve al juego', !!sigue);
  const at1 = await t.pg.evaluate(() => window.porteoAtras());
  const atras = await esperar(t.pg, (e) => e.destino === 2, 4000);
  const at2 = await t.pg.evaluate(() => window.porteoAtras());
  ch('A: atrás abre el menú del juego; dos seguidos salen', at1 === true && !!atras && at2 === 'salir');
  await t.pg.waitForTimeout(1000);
  await t.pg.keyboard.press('Escape');
  ch('A: Escape en el menú vuelve al juego', !!(await esperar(t.pg, (e) => e.destino === 1, 4000)));

  // Los controles se miden en el entrenamiento, con todas las armas (en el tren no se puede caminar)
  await comando(t.pg, 'sv_cheats 1');
  await comando(t.pg, 'hazardcourse');
  const curso = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 't0a0' && e.destino === 1, 120000, 300);
  ch('A: el entrenamiento se baja y carga', !!curso);
  await t.pg.waitForTimeout(3000);
  await comando(t.pg, 'impulse 101');
  await t.pg.waitForTimeout(1500);

  let e0 = await esperar(t.pg, (e) => e.suelo === 1, 3000);
  const z0 = (e0 || await estado(t.pg)).pos[2];
  await medirAltura(t, 2500);
  await boton(t, 'Saltar', 120);
  const zMax = await alturaMaxima(t, 2000);
  ch('A: Saltar: sube', zMax - z0 > 20, `+${r1(zMax - z0)} unidades`);
  await t.pg.waitForTimeout(800);
  e0 = await esperar(t.pg, (e) => e.suelo === 1, 3000);
  const zPie = (e0 || await estado(t.pg)).pos[2];
  await boton(t, 'Agacharse', 100);
  await t.pg.waitForTimeout(900);
  const zAg = (await estado(t.pg)).pos[2];
  await boton(t, 'Agacharse', 100);
  await t.pg.waitForTimeout(900);
  const zDe = (await estado(t.pg)).pos[2];
  ch('A: Agacharse queda agachado y el segundo toque lo para', zPie - zAg > 10 && Math.abs(zDe - zPie) < 3, `${r1(zPie)} → ${r1(zAg)} → ${r1(zDe)}`);

  const cam = await caminar(t, 2000);
  ch('A: joystick hacia arriba: camina', cam.d > 40, `${cam.d} unidades en 2 s`);
  const giro = await mirar(t, 120);
  ch('A: arrastrar 120 px a la derecha: gira a la derecha', giro < -15 && giro > -40, `${giro}°`);
  const juntos = await caminar(t, 2000, true);
  ch('A: multitáctil: camina y mira a la vez', juntos.d > 30 && Math.abs(juntos.giro) > 10, `${juntos.d} unidades y ${juntos.giro}°`);

  const armas = {};
  for (const n of ['1', '2', '3', '4', '5']) {
    await boton(t, 'Armas ' + n);
    const e = await esperar(t.pg, (e) => !!e.arma && e.arma !== armas.ultima, 3000);
    armas[n] = armas.ultima = (e || await estado(t.pg)).arma;
    await t.pg.waitForTimeout(900);
  }
  ch('A: los casilleros 1 a 5 cambian de arma', /crowbar/.test(armas[1]) && /9mmhandgun/.test(armas[2]) && /9mmAR|shotgun|crossbow/i.test(armas[3]) && /rpg|gauss|egon|hgun/.test(armas[4]) && /grenade|satchel|tripmine|squeak/.test(armas[5]),
    Object.entries(armas).filter(([k]) => k !== 'ultima').map(([k, v]) => `${k} ${v}`).join(', '));
  await boton(t, 'Arma anterior');
  const anterior = await esperar(t.pg, (e) => e.arma === armas[4], 3000);
  ch('A: Arma anterior vuelve a la de antes', !!anterior, (anterior || await estado(t.pg)).arma);
  await t.pg.waitForTimeout(900);
  await boton(t, 'Armas 2');
  const pistola = await esperar(t.pg, (e) => /9mmhandgun/.test(e.arma), 3000);
  await t.pg.waitForTimeout(900);
  await boton(t, 'Armas 2');
  const magnum = await esperar(t.pg, (e) => /v_357/.test(e.arma), 3000);
  ch('A: tocar otra vez el casillero pone en la mano la siguiente arma (2: pistola → Magnum)', !!pistola && !!magnum, (magnum || await estado(t.pg)).arma);
  await t.pg.waitForTimeout(900);
  await boton(t, 'Armas 2');
  await esperar(t.pg, (e) => /9mmhandgun/.test(e.arma), 3000);
  await t.pg.waitForTimeout(1500);
  let a = await estado(t.pg);
  await boton(t, 'Disparar', 150);
  const tiro = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Disparar (el botón grande)', !!tiro, tiro ? `animación ${a.anim} → ${tiro.anim}` : '');
  await t.pg.waitForTimeout(600);
  a = await estado(t.pg);
  await boton(t, 'Disparar', 150, 1);
  const tiro2 = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Disparar (el de la izquierda)', !!tiro2);
  await t.pg.waitForTimeout(600);
  a = await estado(t.pg);
  await boton(t, 'Disparo secundario', 150);
  const sec = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Disparo secundario (la pistola: ráfaga)', !!sec, sec ? `animación ${a.anim} → ${sec.anim}` : '');
  await t.pg.waitForTimeout(1200);
  a = await estado(t.pg);
  await boton(t, 'Recargar', 150);
  const recarga = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Recargar', !!recarga, recarga ? `animación ${a.anim} → ${recarga.anim}` : '');
  await t.pg.waitForTimeout(2500);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-entrenamiento.png` });

  await boton(t, 'Ajustes');
  await t.pg.waitForTimeout(300);
  await t.pg.evaluate(() => { const s = document.getElementById('hl-sens'); s.value = '2'; s.dispatchEvent(new Event('input')); document.querySelector('#hl-panel [data-cerrar]').click(); });
  await t.pg.waitForTimeout(300);
  const giro2 = await mirar(t, 120);
  ch('A: Ajustes: con sensibilidad 2 gira el doble', giro2 / giro > 1.6 && giro2 / giro < 2.4, `${giro}° → ${giro2}°`);
  await t.pg.evaluate(() => JSON.parse(localStorage.getItem('hl-tactil') || '{}').sens).then((v) => ch('A: el ajuste queda guardado en el teléfono', v === 2, `sens ${v}`));
  await boton(t, 'Ajustes');
  await t.pg.waitForTimeout(300);
  await t.pg.evaluate(() => { const s = document.getElementById('hl-sens'); s.value = '1'; s.dispatchEvent(new Event('input')); document.querySelector('#hl-panel [data-cerrar]').click(); });

  // segundo plano con un dedo en el joystick: se suelta todo y el sonido se calla
  await t.pg.waitForTimeout(500);
  const [jx, jy] = await fis(t, 150, 300);
  await dedos(t, 'touchStart', [[jx, jy, 1]]);
  for (let i = 1; i <= 10; i++) { const [x, y] = await fis(t, 150, 300 - i * 6); await dedos(t, 'touchMove', [[x, y, 1]]); await t.pg.waitForTimeout(30); }
  await t.pg.waitForTimeout(800);
  await ocultar(t.pg, true);
  await t.pg.waitForTimeout(400);
  const p1 = (await estado(t.pg)).pos;
  const audioOculto = await t.pg.evaluate(() => window.M && M.SDL2 && M.SDL2.audioContext ? M.SDL2.audioContext.state : 'sin audio');
  await t.pg.waitForTimeout(1500);
  const p2 = (await estado(t.pg)).pos;
  await ocultar(t.pg, false);
  await t.pg.waitForTimeout(500);
  const audioVuelve = await t.pg.evaluate(() => window.M && M.SDL2 && M.SDL2.audioContext ? M.SDL2.audioContext.state : 'sin audio');
  const [mx, my] = await fis(t, 150, 230);
  await dedos(t, 'touchMove', [[mx, my, 1]]);
  await t.pg.waitForTimeout(800);
  const p3 = (await estado(t.pg)).pos;
  await dedos(t, 'touchEnd', []);
  const quieto = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  ch('A: al ocultar la página se suelta el joystick (no camina solo)', quieto < 8, `${r1(quieto)} unidades después`);
  ch('A: al ocultar la página el sonido se suspende y vuelve', audioOculto === 'suspended' && audioVuelve === 'running', `${audioOculto} → ${audioVuelve}`);

  // carga rápida: vuelve al tren, donde se guardó
  await boton(t, 'Carga rápida');
  const vuelta = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'c0a0' && e.destino === 1, 60000, 300);
  ch('A: Carga rápida vuelve a la partida guardada (en el tren)', !!vuelta, (vuelta || await estado(t.pg)).mapa);
  const perdidos1 = await perdidos();
  ch('A: al cargar la partida, ningún sonido apagado', perdidos1.length === 0, perdidos1.slice(0, 3).join(' | '));
  ch('A: sin errores en la consola ni pedidos fallidos', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  ch('A: ningún pedido afuera (todo sale de la carpeta del juego)', t.afuera.length === 0, t.afuera.slice(0, 3).join(' | '));
  await ocultar(t.pg, true);                      // así se guarda IndexedDB al ir a segundo plano
  await t.pg.waitForTimeout(2500);
  await ocultar(t.pg, false);

  // al volver a abrir: la partida sigue en el teléfono; el idioma se cambia desde el menú
  t.errores.length = 0;
  await t.pg.reload();
  await hastaElMenu(t);
  ch('A: al volver a abrir, la partida guardada sigue en el teléfono', (await partidas(t.pg)).includes('quick.sav'));
  await comando(t.pg, 'load quick');
  const cargada = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'c0a0', 60000, 300);
  ch('A: y se carga', !!cargada);
  // las funciones de cada entidad se guardan por nombre (parche del motor): si se perdieran, el tren no andaría
  await t.pg.waitForTimeout(1000);
  const pc1 = (await estado(t.pg)).pos;
  await t.pg.waitForTimeout(3000);
  const pc2 = (await estado(t.pg)).pos;
  const anduvo = Math.hypot(pc2[0] - pc1[0], pc2[1] - pc1[1], pc2[2] - pc1[2]);
  ch('A: la partida cargada sigue andando (el tren avanza)', anduvo > 100, `${Math.round(anduvo)} unidades en 3 s`);
  const perdidos2 = await perdidos();
  ch('A: al cargarla, ningún sonido apagado', perdidos2.length === 0, perdidos2.slice(0, 3).join(' | '));
  await t.pg.keyboard.press('Escape');
  await esperar(t.pg, (e) => e.destino === 2, 4000);
  await comando(t.pg, 'disconnect');
  await esperar(t.pg, (e) => e.estado !== 4 && e.destino === 2, 8000);
  await t.pg.waitForTimeout(1500);
  const bi = await t.pg.evaluate(() => { const r = document.getElementById('hl-idioma').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await tocar(t, bi[0], bi[1]);
  await t.pg.waitForFunction(() => window.__hl && window.__hl.fase === 'jugando' && window.__hl.idioma === 'en', null, { timeout: 120000 }).catch(() => {});
  await esperar(t.pg, (e) => e.destino === 2, 30000);
  await t.pg.waitForTimeout(2000);
  const ingles = await t.pg.evaluate(() => ({ idioma: window.__hl.idioma, intro: !!document.getElementById('porteo-intro'), lang: document.documentElement.lang,
    paquetes: Object.keys(window.__hl.montado).filter((n) => /idioma/.test(n)) }));
  await t.pg.screenshot({ path: `${CAPTURAS}/a-menu-ingles.png` });
  ch('A: el botón del idioma pasa el juego a inglés (sin repetir la intro)', ingles.idioma === 'en' && !ingles.intro && ingles.paquetes.includes('idioma-en') && !ingles.paquetes.includes('idioma-es'), JSON.stringify(ingles));
  ch('A: en inglés, sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.pg.evaluate(() => localStorage.removeItem('hl-idioma'));
  await t.c.close();
}

console.log('\nH. El paso al nivel siguiente, jugando, con el nivel siguiente sin bajar');
{
  // sin service worker: page.route no ve lo que baja el service worker, y acá hay que retener un paquete
  const t = await abrir(WEB, { contexto: { serviceWorkers: 'block' } });
  let soltar, retenido = false;
  const suelto = new Promise((r) => { soltar = r; });
  await t.pg.route('**/datos/mapas/c1a0d.pk3.gz', async (r) => { retenido = true; await suelto; await r.continue(); });
  await hastaElMenu(t);
  await comando(t.pg, 'sv_cheats 1');
  await comando(t.pg, 'map c1a0');
  const enC1a0 = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'c1a0', 120000, 300);
  ch('H: c1a0 se baja y carga', !!enC1a0);
  await t.pg.waitForTimeout(3000);
  ch('H: mientras se juega, el nivel siguiente se empieza a bajar de fondo', retenido);
  // el cambio de nivel a c1a0d está justo enfrente del comienzo: se camina en línea recta (atravesando paredes)
  await comando(t.pg, 'noclip');
  await t.pg.waitForTimeout(500);
  await t.pg.evaluate(() => window.M._Porteo_Mover(1, 0));
  await esperar(t.pg, (e) => e.pos[0] < -1480 || e.pausa, 12000, 100);
  await t.pg.evaluate(() => window.M._Porteo_Mover(0, 0));
  await t.pg.waitForTimeout(1500);
  const e1 = await estado(t.pg);
  const cartel = await t.pg.evaluate(() => document.getElementById('hl-carga').className === 'si');
  const tA = (await estado(t.pg)).tiempo;
  await t.pg.waitForTimeout(1500);
  const tB = (await estado(t.pg)).tiempo;
  await t.pg.screenshot({ path: `${CAPTURAS}/h-esperando.png` });
  ch('H: al tocar el cambio de nivel sin el siguiente, el juego queda en pausa con el cartel', e1.pausa === 1 && cartel && tA === tB, `pausa ${e1.pausa}, tiempo ${tA} → ${tB}`);
  soltar();
  const llego = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'c1a0d', 60000, 300);
  ch('H: al llegar el paquete pasa al nivel siguiente, en su lugar y sin pausa', !!llego && llego.pausa === 0 && Math.abs(llego.pos[1] - 318) < 40, llego ? `pos ${llego.pos.map(r1).join(' ')}` : '');
  await t.pg.waitForTimeout(2000);
  await t.pg.screenshot({ path: `${CAPTURAS}/h-llego.png` });
  ch('H: sin errores', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

console.log('\nB. Teléfono parado (390×844): la página se gira sola y los toques caen donde se ve');
{
  const t = await abrir(WEB, { w: 390, h: 844 });
  await hastaElMenu(t);
  ch('B: la página va girada', await t.pg.evaluate(() => document.documentElement.classList.contains('porteo-girado')));
  const lienzo = await t.pg.evaluate(() => { const c = document.getElementById('canvas'); return [c.clientWidth, c.clientHeight, c.width, c.height]; });
  ch('B: el juego ve una pantalla acostada de 844×390', lienzo[0] === 844 && lienzo[1] === 390, lienzo.join('×'));
  await t.pg.screenshot({ path: `${CAPTURAS}/b-menu.png` });
  const { enMapa } = await aJugar(t, 'b');
  ch('B: girado, del menú a jugar sólo tocando', !!enMapa);
  const fuera = await t.pg.evaluate(() => [...document.querySelectorAll('#hl-tactil .bt, #hl-tactil .arma')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || r.width < 40;
  }).map((b) => b.getAttribute('aria-label')));
  ch('B: todos los botones adentro de la pantalla y de 40 px o más', fuera.length === 0, fuera.join(', '));
  await t.pg.screenshot({ path: `${CAPTURAS}/b-jugando.png` });
  const giro = await mirar(t, 120);
  ch('B: girado, arrastrar a la derecha gira a la derecha', giro < -15 && giro > -40, `${giro}°`);
  ch('B: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

console.log('\nC. Pantalla chica (640×360): nada cortado ni inalcanzable');
{
  const t = await abrir(WEB, { w: 640, h: 360 });
  await hastaElMenu(t);
  await t.pg.screenshot({ path: `${CAPTURAS}/c-menu.png` });
  // los controles como si se estuviera jugando (sin cargar un mapa): sólo se mide dónde quedan
  await t.pg.evaluate(() => { window.HL.estado = () => ({ estado: 4, destino: 1 }); });
  await t.pg.waitForTimeout(400);
  const medidas = await t.pg.evaluate(() => [...document.querySelectorAll('#hl-tactil .bt, #hl-tactil .arma')].map((b) => {
    const r = b.getBoundingClientRect();
    return { n: b.getAttribute('aria-label'), l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
  }));
  await t.pg.screenshot({ path: `${CAPTURAS}/c-controles.png` });
  const fuera = medidas.filter((m) => m.l < 0 || m.t < 0 || m.r > 640 || m.b > 360).map((m) => m.n);
  ch('C: todos los botones adentro de la pantalla', fuera.length === 0, fuera.join(', '));
  const chicos = medidas.filter((m) => m.w < 38).map((m) => `${m.n} ${Math.round(m.w)} px`);
  ch('C: ningún botón de menos de 38 px', chicos.length === 0, chicos.join(', '));
  const grandes = medidas.filter((m) => /Disparar|Saltar/.test(m.n) && m.w < 54).map((m) => m.n);
  ch('C: disparar y saltar, grandes', grandes.length === 0, grandes.join(', '));
  const pisan = [];
  for (let i = 0; i < medidas.length; i++) for (let j = i + 1; j < medidas.length; j++) {
    const p = medidas[i], q = medidas[j];
    if (p.l < q.r - 2 && q.l < p.r - 2 && p.t < q.b - 2 && q.t < p.b - 2) pisan.push(`${p.n}/${q.n}`);
  }
  ch('C: ningún botón tapa a otro', pisan.length === 0, pisan.join(', '));
  ch('C: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

console.log('\nG. Como en un teléfono: 4G, sin permiso de sonar hasta tocar, y la pantalla cambia de tamaño mientras baja');
{
  // otro navegador, sin el permiso de reproducir solo que tienen las demás secciones
  const nav2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ARGS });
  const c = await nav2.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'es-AR' });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('dialog', async (d) => { errores.push('cartel: ' + d.message().replace(/\s+/g, ' ')); await d.dismiss().catch(() => {}); });
  const cdp = await c.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 10e6 / 8, uploadThroughput: 2e6 / 8 });
  const t = { c, pg, cdp, errores, t0: Date.now() };
  await pg.goto(WEB);
  await pg.waitForTimeout(1200);
  await tocar(t, 420, 200);                                  // saltea la intro (y pide pantalla completa)
  await pg.setViewportSize({ width: 800, height: 360 });     // la pantalla completa cambia el tamaño
  const listo = await hastaElMenu(t);
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(1500);
  ch('G: cambiar el tamaño mientras se baja no rompe nada', errores.length === 0, errores.slice(0, 2).join(' | '));
  ch('G: en 4G (10 Mbit/s), el menú se puede tocar enseguida', listo < 30, `motor andando a los ${r1(listo)} s`);
  // el sonido: el medidor envuelve el procesador de audio de SDL y anota el pico
  await pg.evaluate(() => {
    const a = window.M && M.SDL2 && M.SDL2.audio;
    if (!a || !a.scriptProcessorNode) return;
    window.__pico = 0;
    const orig = a.scriptProcessorNode.onaudioprocess;
    a.scriptProcessorNode.onaudioprocess = function (e) {
      orig.call(this, e);
      const d = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > window.__pico) window.__pico = v; }
    };
  });
  const t1 = Date.now();
  const { enMapa } = await aJugar(t, 'g');
  ch('G: en 4G, de entrar a la página a jugar el primer nivel', !!enMapa, `${r1((Date.now() - t.t0) / 1000)} s (desde Nueva partida: ${r1((Date.now() - t1) / 1000)} s)`);
  await pg.waitForTimeout(6000);
  const sonido = await pg.evaluate(() => ({ estado: window.M && M.SDL2 && M.SDL2.audioContext && M.SDL2.audioContext.state, pico: window.__pico || 0 }));
  ch('G: con los toques, el sonido suena (se mide lo que sale: el anuncio del tren)', sonido.estado === 'running' && sonido.pico > 0.01, `${sonido.estado}, pico ${r1(sonido.pico * 100) / 100}`);
  ch('G: sin errores ni carteles', errores.length === 0, errores.slice(0, 2).join(' | '));
  await nav2.close();
}

const conSW = await fetch(new URL('sw.js', WEB)).then((r) => r.ok).catch(() => false);
if (conSW) {
  console.log('\nD. Sin internet (service worker)');
  const t = await abrir(WEB);
  await hastaElMenu(t);
  const guardado = await t.pg.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 240; i++) {
      const ks = await caches.keys();
      // (sw.js guarda cada archivo con su huella en la dirección: motor/xash.wasm?porteo=…)
      const o = { ignoreSearch: true };
      for (const k of ks) { const c = await caches.open(k); if (await c.match('motor/xash.wasm', o) && await c.match('datos/indice.json', o)) return true; }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  ch('D: la primera visita guarda el motor y el menú', guardado);
  // un nivel jugado con red queda guardado (los paquetes se guardan la primera vez que se bajan)
  const { enMapa: conRed } = await aJugar(t, 'd');
  ch('D: con red, el primer nivel se baja y carga', !!conRed);
  await t.pg.waitForTimeout(3000);
  await t.c.setOffline(true);
  await t.pg.reload();
  await hastaElMenu(t);
  ch('D: sin red, abre igual hasta el menú', (await estado(t.pg)).destino === 2);
  const { enMapa: sinRed } = await aJugar(t, 'd2');
  ch('D: sin red, el nivel ya jugado carga', !!sinRed);
  ch('D: sin errores en la consola (sin contar los pedidos sin red)', t.errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(e)).length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
} else {
  console.log('\nD. Sin internet: esta carpeta no tiene sw.js (no pasó por pwa.py): no se prueba');
}

if (ARCHIVO) {
  console.log('\nF. Un solo archivo (.html abierto del disco)');
  const t = await abrir(ARCHIVO);
  const listo = await hastaElMenu(t);
  ch('F: abre desde el disco hasta el menú', listo > 0, `motor andando a los ${r1(listo)} s`);
  await t.pg.screenshot({ path: `${CAPTURAS}/f-menu.png` });
  const { enMapa } = await aJugar(t, 'f');
  ch('F: Nueva partida carga el primer nivel (va adentro del archivo)', !!enMapa);
  await t.pg.waitForTimeout(2000);
  await t.pg.screenshot({ path: `${CAPTURAS}/f-mapa.png` });
  ch('F: ningún pedido afuera', t.afuera.filter((u) => !u.startsWith('file:')).length === 0, t.afuera.slice(0, 3).join(' | '));
  ch('F: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

if (APK) {
  console.log('\nE. El APK');
  const sdk = process.env.ANDROID_HOME || '/opt/android-sdk';
  const bt = existsSync(`${sdk}/build-tools`) ? execFileSync('ls', [`${sdk}/build-tools`]).toString().trim().split('\n').pop() : '';
  const herr = (n) => `${sdk}/build-tools/${bt}/${n}`;
  let firma = '';
  try { firma = execFileSync(herr('apksigner'), ['verify', '--verbose', APK]).toString(); } catch (e) { firma = String(e.stdout || e.message); }
  ch('E: apksigner verify', /Verifies/.test(firma) && !/DOES NOT VERIFY/.test(firma), (firma.match(/Verified using v\d scheme.*: true/g) || []).join(', '));
  const badging = execFileSync(herr('aapt2'), ['dump', 'badging', APK]).toString();
  const paquete = (badging.match(/package: name='([^']+)'/) || [])[1];
  const nombre = (badging.match(/application-label:'([^']+)'/) || [])[1];
  const sdkMin = (badging.match(/(?:minSdkVersion|sdkVersion):'(\d+)'/) || [])[1];
  const icono = /application-icon-\d+:'[^']+'/.test(badging);
  ch('E: nombre, paquete, ícono y SDK', paquete === 'ar.juniors.halflife' && nombre === 'Half-Life' && icono && +sdkMin >= 21, `${paquete}, «${nombre}», SDK ${sdkMin}`);
  const manifiesto = execFileSync(herr('aapt2'), ['dump', 'xmltree', APK, '--file', 'AndroidManifest.xml']).toString();
  ch('E: orientación acostada', /screenOrientation.*=6\b|sensorLandscape/.test(manifiesto) || /screenOrientation\(0x0101001e\)=6/.test(manifiesto));
  const lista = execFileSync('unzip', ['-Z1', APK], { maxBuffer: 64 << 20 }).toString().split('\n');
  const indice = await fetch(new URL('datos/indice.json', WEB)).then((r) => r.json());
  const esperados = ['index.html', 'motor/xash.wasm', 'motor/xash.js', 'motor/client.wasm', 'motor/menu.wasm', 'motor/server.wasm', 'motor/extras-es.pk3', 'motor/extras-en.pk3',
    'datos/indice.json', ...Object.values(indice.paquetes).map((p) => 'datos/' + p.archivo), ...(indice.wads || []).map((w) => 'datos/' + w.archivo)]
    .map((f) => 'assets/juego/' + f);       // armar.py pone el juego en assets/juego/
  const faltan = esperados.filter((f) => !lista.includes(f));
  ch(`E: adentro está todo el juego (motor, menú, los dos idiomas y los ${Object.keys(indice.mapas).length} niveles)`, faltan.length === 0, faltan.length ? 'faltan ' + faltan.slice(0, 4).join(', ') : `${esperados.length} archivos`);
}

console.log(`\n${ok} bien, ${mal} mal  (capturas en ${CAPTURAS})`);
await nav.close();
process.exit(mal ? 1 : 0);
