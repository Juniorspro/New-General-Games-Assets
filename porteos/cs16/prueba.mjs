// Counter-Strike 1.6 — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/cs16/prueba.mjs http://127.0.0.1:8851/cs16/ [entrega-cs16/cs16.apk] [file:///…/cs16.html]
//
// Primer argumento: la carpeta web servida por http (IndexedDB y el service worker lo necesitan).
// Opcionales: el APK y el .html de un solo archivo. Los toques son dedos de verdad (CDP Input.dispatchTouchEvent, dos a
// la vez para caminar y mirar) y cada control se mide en el estado del juego que da el motor
// (Porteo_Estado, parche nuestro): posición, ángulos, arma en la mano, animación del arma, campo
// visual, jugadores conectados y a dónde van las teclas (0 consola, 1 juego, 2 menú, 3 chat).
//
// Las coordenadas del menú son las de mainui (1024×768 escalado al alto de la pantalla) en un
// teléfono acostado de 844×390; parado, la página va girada (web.js) y se deshace el giro.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const WEB = process.argv[2] || 'http://127.0.0.1:8851/cs16/';
const APK = process.argv.slice(3).find((a) => /\.apk$/i.test(a));
const ARCHIVO = process.argv.slice(3).find((a) => /^file:|\.html$/i.test(a));
const CAPTURAS = process.env.CAPTURAS || '/tmp/cs16-prueba';
mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const r1 = (n) => Math.round(n * 10) / 10;

async function abrir(url, { w = 844, h = 390 } = {}) {
  const c = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
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
const estado = (pg) => pg.evaluate(() => (window.CS && window.CS.estado()) || {});
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
  await t.pg.waitForFunction(() => window.__cs && window.__cs.fase === 'jugando', null, { timeout: 180000 });
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
  const b = document.querySelectorAll(`#cs-tactil [aria-label="${nombre}"]`)[n];
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, [nombre, n]);
async function boton(t, nombre, ms = 120, n = 0) {
  // al cerrarse un menú del juego los controles vuelven en el siguiente sondeo (≤150 ms)
  await t.pg.waitForFunction(() => !document.getElementById('cs-tactil').classList.contains('oculto'), null, { timeout: 5000 }).catch(() => {});
  const c = await centro(t, nombre, n);
  if (!c) throw new Error('no está el botón ' + nombre);
  await tocar(t, c[0], c[1], ms);
}
// mainui: x del texto de los botones del menú principal y alto de cada uno (vy en 1024×768)
const H = 390, ESC = H / 768;
const menuX = 172 * ESC, menuY = (vy) => (vy + 18) * ESC;
const MENU = { continuar: 497.6, desconectar: 547.2, nueva: 596.8, personalizar: 646.4, opciones: 696 };

// Del menú a jugar sólo tocando: Nueva Partida → de_dust2 → Aceptar → terroristas → automático
async function aJugar(t, etiqueta) {
  await tocar(t, menuX, menuY(MENU.nueva));
  await t.pg.waitForTimeout(2000);
  await t.pg.screenshot({ path: `${CAPTURAS}/${etiqueta}-crear.png` });
  await tocar(t, 330, 338);                       // de_dust2 en la lista
  await t.pg.waitForTimeout(600);
  const t0 = Date.now();
  await tocar(t, 63, 152);                        // Aceptar
  await t.pg.waitForTimeout(1200);
  await t.pg.screenshot({ path: `${CAPTURAS}/${etiqueta}-bajando.png` });
  const enMapa = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'de_dust2', 120000, 300);
  const seg = (Date.now() - t0) / 1000;
  const equipo = await esperar(t.pg, (e) => e.destino === 2, 15000);
  await t.pg.waitForTimeout(1500);
  await t.pg.screenshot({ path: `${CAPTURAS}/${etiqueta}-equipo.png` });
  await tocar(t, 300, 125);                       // 1 terroristas
  await t.pg.waitForTimeout(1800);
  await tocar(t, 300, 250);                       // 5 automático
  const vivo = await esperar(t.pg, (e) => e.estado === 4 && e.destino === 1 && e.vida > 0, 20000);
  await t.pg.waitForTimeout(1500);
  return { enMapa, seg, equipo, vivo };
}
const visibles = (pg) => pg.evaluate(() => !document.getElementById('cs-tactil').classList.contains('oculto'));
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
// la altura máxima, medida cuadro a cuadro adentro de la página (un salto dura medio segundo: desde
// afuera, con la máquina cargada, la primera muestra podía caer ya en el piso)
const medirAltura = (t, ms) => t.pg.evaluate((ms) => {
  window.__zmax = -1e9;
  const fin = performance.now() + ms;
  (function cuadro() {
    const e = window.CS.estado();
    if (e && e.pos) window.__zmax = Math.max(window.__zmax, e.pos[2]);
    if (performance.now() < fin) requestAnimationFrame(cuadro);
  })();
}, ms);
async function alturaMaxima(t, ms) {
  await t.pg.waitForTimeout(ms);
  return t.pg.evaluate(() => window.__zmax);
}
// el nombre en Personalizar, con el teclado del teléfono (CDP escribe en el campo enfocado)
async function cambiarNombre(t, nombre) {
  await tocar(t, menuX, menuY(MENU.personalizar));
  await t.pg.waitForTimeout(2000);
  await tocar(t, 326, 146);                       // el campo, al final del texto
  await t.pg.waitForTimeout(700);
  const enfocado = await t.pg.evaluate(() => document.activeElement && document.activeElement.id);
  for (let i = 0; i < 16; i++) {
    await t.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await t.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await t.pg.waitForTimeout(40);
  }
  await t.cdp.send('Input.insertText', { text: nombre });
  await t.pg.waitForTimeout(300);
  await t.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await t.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await t.pg.waitForTimeout(400);
  const cerrado = await t.pg.evaluate(() => document.activeElement && document.activeElement.id !== 'cs-teclado');
  await tocar(t, 55, 127);                        // Listo (guarda config.cfg)
  await t.pg.waitForTimeout(1200);
  return { enfocado, cerrado };
}
const ocultar = (pg, si) => pg.evaluate((si) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => si });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (si ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, si);

console.log('A. Teléfono acostado (844×390): del menú a jugar, cada control medido');
{
  const t = await abrir(WEB);
  const listo = await hastaElMenu(t);
  ch('A: carga hasta el menú', listo > 0, `motor andando a los ${r1(listo)} s`);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-menu.png` });
  const log = await t.pg.evaluate(() => window.__cs.log.join('\n'));
  ch('A: el menú tiene su castellano (mainui_english.txt del paquete)', !/mainui_english\.txt\): couldn't open/.test(log));
  const { enMapa, seg, equipo, vivo } = await aJugar(t, 'a');
  ch('A: Nueva Partida → de_dust2 → Aceptar, sólo tocando: se baja y carga el mapa', !!enMapa, `${r1(seg)} s`);
  ch('A: aparece el menú de equipo', !!equipo);
  ch('A: terroristas → automático: vivo y jugando', !!vivo, vivo ? `vida ${vivo.vida}` : JSON.stringify(await estado(t.pg)));
  ch('A: los controles se ven al jugar (y no en los menús)', await visibles(t.pg));
  await t.pg.screenshot({ path: `${CAPTURAS}/a-jugando.png` });

  // los bots no atacan (bot_zombie) y las rondas no empiezan congeladas: se mide cada control, no la
  // puntería de los bots. Entran igual; cuando hay de los dos equipos el juego reinicia la ronda
  // ("comienza la partida") y vuelve a poner a todos en su lugar: se espera a que pase.
  await t.pg.evaluate(() => { window.CS.comando('bot_zombie 1'); window.CS.comando('mp_freezetime 0'); });
  const bots = await esperar(t.pg, (e) => e.jugadores >= 5, 30000, 500);
  ch('A: entran los bots', !!bots, `${(bots || await estado(t.pg)).jugadores} jugadores`);
  await t.pg.waitForTimeout(6000);
  await esperar(t.pg, (e) => e.vida > 0 && e.destino === 1, 10000);

  // comprar primero: la zona de compra dura poco
  await boton(t, 'Comprar');
  const compra = await esperar(t.pg, (e) => e.destino === 2, 4000);
  await t.pg.waitForTimeout(800);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-comprar.png` });
  ch('A: Comprar abre el menú de compra', !!compra && !(await visibles(t.pg)));
  await t.pg.keyboard.press('Escape');
  ch('A: y se cierra (Escape) de vuelta al juego', !!(await esperar(t.pg, (e) => e.destino === 1, 4000)));

  // saltar y agacharse primero, en la base (después de caminar se puede terminar bajo un techo bajo)
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

  await boton(t, 'Arma 3');
  const cuchillo = await esperar(t.pg, (e) => e.arma === 'v_knife.mdl', 3000);
  ch('A: 3: cuchillo en la mano', !!cuchillo, (cuchillo || await estado(t.pg)).arma);
  await t.pg.waitForTimeout(1200);
  let a = await estado(t.pg);
  await boton(t, 'Mira', 150);
  const mira = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Mira/secundario (con el cuchillo: puñalada)', !!mira, mira ? `animación ${a.anim} → ${mira.anim}` : '');
  await boton(t, 'Arma 2');
  const pistola = await esperar(t.pg, (e) => /^v_(glock18|usp)\.mdl$/.test(e.arma), 3000);
  ch('A: 2: pistola en la mano', !!pistola, (pistola || await estado(t.pg)).arma);
  await t.pg.waitForTimeout(1500);
  a = await estado(t.pg);
  await boton(t, 'Disparar', 150);
  const tiro = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Disparar (el botón grande)', !!tiro, tiro ? `animación ${a.anim} → ${tiro.anim}` : '');
  await t.pg.waitForTimeout(600);
  a = await estado(t.pg);
  await boton(t, 'Disparar', 150, 1);
  const tiro2 = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Disparar (el de la izquierda)', !!tiro2);
  await t.pg.waitForTimeout(800);
  a = await estado(t.pg);
  await boton(t, 'Recargar', 150);
  const recarga = await esperar(t.pg, (e) => e.animT !== a.animT, 2500);
  ch('A: Recargar', !!recarga, recarga ? `animación ${a.anim} → ${recarga.anim}` : '');
  await t.pg.waitForTimeout(2500);

  await boton(t, 'Elegir equipo');
  const eq = await esperar(t.pg, (e) => e.destino === 2, 4000);
  ch('A: Elegir equipo abre el menú de equipos', !!eq);
  await t.pg.keyboard.press('Escape');
  await esperar(t.pg, (e) => e.destino === 1, 4000);

  await boton(t, 'Radio');
  await t.pg.waitForTimeout(400);
  const panel = await t.pg.evaluate(() => document.getElementById('cs-panel').classList.contains('si'));
  await t.pg.screenshot({ path: `${CAPTURAS}/a-radio.png` });
  const b1 = await t.pg.evaluate(() => { const r = document.querySelector('#cs-panel button[data-radio]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const voces = (await estado(t.pg)).radio;
  await tocar(t, b1[0], b1[1]);
  const oida = await esperar(t.pg, (e) => e.radio > voces, 3000);
  const cerro = await t.pg.evaluate(() => !document.getElementById('cs-panel').classList.contains('si'));
  await t.pg.screenshot({ path: `${CAPTURAS}/a-radio-dicha.png` });
  ch('A: Radio: una orden del panel llega como voz de radio y el panel se cierra', panel && cerro && !!oida, oida ? `voces ${voces} → ${oida.radio}` : '');

  await boton(t, 'Ajustes');
  await t.pg.waitForTimeout(300);
  await t.pg.evaluate(() => { const s = document.getElementById('cs-sens'); s.value = '2'; s.dispatchEvent(new Event('input')); document.querySelector('#cs-panel [data-cerrar]').click(); });
  await t.pg.waitForTimeout(300);
  const giro2 = await mirar(t, 120);
  ch('A: Ajustes: con sensibilidad 2 gira el doble', giro2 / giro > 1.6 && giro2 / giro < 2.4, `${giro}° → ${giro2}°`);
  await t.pg.evaluate(() => { const v = JSON.parse(localStorage.getItem('cs16-tactil') || '{}'); return v.sens; }).then((v) => ch('A: el ajuste queda guardado en el teléfono', v === 2, `sens ${v}`));
  await boton(t, 'Ajustes');
  await t.pg.waitForTimeout(300);
  await t.pg.evaluate(() => { const s = document.getElementById('cs-sens'); s.value = '1'; s.dispatchEvent(new Event('input')); document.querySelector('#cs-panel [data-cerrar]').click(); });

  await boton(t, 'Pausa');
  const pausa = await esperar(t.pg, (e) => e.destino === 2, 4000);
  await t.pg.waitForTimeout(1000);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-pausa.png` });
  ch('A: Pausa abre el menú del juego (y esconde los controles)', !!pausa && !(await visibles(t.pg)));
  await tocar(t, menuX, menuY(MENU.continuar));
  const sigue = await esperar(t.pg, (e) => e.destino === 1, 4000);
  if (!sigue) await t.pg.screenshot({ path: `${CAPTURAS}/a-continuar-fallo.png` });
  ch('A: "Continuar Partida" vuelve al juego', !!sigue, sigue ? '' : `foco en ${await t.pg.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName))}`);
  const at1 = await t.pg.evaluate(() => window.porteoAtras());
  const atras = await esperar(t.pg, (e) => e.destino === 2, 4000);
  const at2 = await t.pg.evaluate(() => window.porteoAtras());
  ch('A: atrás abre el menú del juego; dos seguidos salen', at1 === true && !!atras && at2 === 'salir');
  // (con el menú recién abierto, como en "Pausa": apretado en el mismo instante, a veces no llegaba)
  await t.pg.waitForTimeout(1000);
  await t.pg.keyboard.press('Escape');
  ch('A: Escape en el menú vuelve al juego', !!(await esperar(t.pg, (e) => e.destino === 1, 4000)));

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

  // guardado: el nombre (config.cfg en IndexedDB) sobrevive a recargar
  await boton(t, 'Pausa');
  await esperar(t.pg, (e) => e.destino === 2, 4000);
  await t.pg.waitForTimeout(800);
  const nombre = await cambiarNombre(t, 'Prueba');
  ch('A: tocar el nombre abre el teclado del teléfono; Enter lo cierra', nombre.enfocado === 'cs-teclado' && nombre.cerrado);
  ch('A: lo escrito llega al juego', (await estado(t.pg)).nombre === 'Prueba', (await estado(t.pg)).nombre);
  await ocultar(t.pg, true);                      // así se guarda IndexedDB al ir a segundo plano
  await t.pg.waitForTimeout(2500);
  await ocultar(t.pg, false);
  ch('A: sin errores en la consola ni pedidos fallidos', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  ch('A: ningún pedido afuera (todo sale de la carpeta del juego)', t.afuera.length === 0, t.afuera.slice(0, 3).join(' | '));
  t.errores.length = 0;
  await t.pg.reload();
  await hastaElMenu(t);
  const vuelto = await estado(t.pg);
  ch('A: al volver a abrir, el nombre sigue (guardado en el teléfono)', vuelto.nombre === 'Prueba', vuelto.nombre);
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
  const { enMapa, vivo } = await aJugar(t, 'b');
  ch('B: girado, del menú a jugar sólo tocando', !!enMapa && !!vivo);
  const fuera = await t.pg.evaluate(() => [...document.querySelectorAll('#cs-tactil .bt, #cs-tactil .arma')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || r.width < 40;
  }).map((b) => b.getAttribute('aria-label')));
  ch('B: todos los botones adentro de la pantalla y de 40 px o más', fuera.length === 0, fuera.join(', '));
  await t.pg.screenshot({ path: `${CAPTURAS}/b-jugando.png` });
  const cam = await caminar(t, 2000);
  ch('B: girado, el joystick camina', cam.d > 40, `${cam.d} unidades`);
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
  await t.pg.evaluate(() => { window.CS.estado = () => ({ estado: 4, destino: 1 }); });
  await t.pg.waitForTimeout(400);
  const medidas = await t.pg.evaluate(() => [...document.querySelectorAll('#cs-tactil .bt, #cs-tactil .arma')].map((b) => {
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
  const nav2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await nav2.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
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
  ch('G: cambiar el tamaño mientras se baja lo de las partidas no rompe nada', errores.length === 0, errores.slice(0, 2).join(' | '));
  ch('G: en 4G, el menú se puede tocar enseguida', listo < 30, `motor andando a los ${r1(listo)} s`);
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
  await tocar(t, 600, 100);
  await pg.waitForTimeout(3000);
  const sonido = await pg.evaluate(() => ({ estado: window.M && M.SDL2 && M.SDL2.audioContext && M.SDL2.audioContext.state, pico: window.__pico || 0 }));
  ch('G: con un toque, el sonido suena (se mide lo que sale, no sólo el estado)', sonido.estado === 'running' && sonido.pico > 0.01, `${sonido.estado}, pico ${r1(sonido.pico * 100) / 100}`);
  const t1 = Date.now();
  const { enMapa } = await aJugar(t, 'g');
  ch('G: en 4G, de entrar a la página a jugar de_dust2 (lo común y el mapa se bajan)', !!enMapa, `${r1((Date.now() - t.t0) / 1000)} s (desde Nueva Partida: ${r1((Date.now() - t1) / 1000)} s)`);
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
  // un mapa jugado con red queda guardado (los paquetes se guardan la primera vez que se bajan)
  await t.pg.evaluate(() => { window.CS.comando('maxplayers 4'); window.CS.comando('map de_dust2'); });
  const conRed = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'de_dust2', 120000, 300);
  ch('D: con red, de_dust2 se baja y carga', !!conRed);
  await t.pg.waitForTimeout(3000);
  await t.c.setOffline(true);
  await t.pg.reload();
  await hastaElMenu(t);
  ch('D: sin red, abre igual hasta el menú', (await estado(t.pg)).destino === 2);
  await t.pg.evaluate(() => { window.CS.comando('maxplayers 4'); window.CS.comando('map de_dust2'); });
  const sinRed = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'de_dust2', 120000, 300);
  ch('D: sin red, el mapa ya jugado carga', !!sinRed);
  ch('D: sin errores en la consola (sin contar los pedidos sin red)', t.errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e)).length === 0, t.errores.slice(0, 3).join(' | '));
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
  await t.pg.evaluate(() => { window.CS.comando('maxplayers 4'); window.CS.comando('map de_dust2'); });
  const mapa = await esperar(t.pg, (e) => e.estado === 4 && e.mapa === 'de_dust2', 180000, 300);
  ch('F: carga de_dust2 (va adentro del archivo)', !!mapa);
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
  ch('E: nombre, paquete, ícono y SDK', paquete === 'ar.juniors.cs16' && nombre === 'Counter-Strike 1.6' && icono && +sdkMin >= 21, `${paquete}, «${nombre}», SDK ${sdkMin}`);
  const manifiesto = execFileSync(herr('aapt2'), ['dump', 'xmltree', APK, '--file', 'AndroidManifest.xml']).toString();
  ch('E: orientación acostada', /screenOrientation.*=6\b|sensorLandscape/.test(manifiesto) || /screenOrientation\(0x0101001e\)=6/.test(manifiesto));
  const lista = execFileSync('unzip', ['-Z1', APK]).toString().split('\n');
  const indice = await fetch(new URL('datos/indice.json', WEB)).then((r) => r.json());
  const esperados = ['index.html', 'motor/xash.wasm', 'motor/xash.js', 'motor/client.wasm', 'motor/menu.wasm', 'motor/server.wasm',
    'datos/indice.json', ...Object.values(indice.paquetes).map((p) => 'datos/' + p.archivo), ...(indice.wads || []).map((w) => 'datos/' + w.archivo)]
    .map((f) => 'assets/juego/' + f);       // armar.py pone el juego en assets/juego/
  const faltan = esperados.filter((f) => !lista.includes(f));
  ch('E: adentro está todo el juego (motor, menú, base y los 31 mapas)', faltan.length === 0, faltan.length ? 'faltan ' + faltan.slice(0, 4).join(', ') : `${esperados.length} archivos`);
}

console.log(`\n${ok} bien, ${mal} mal  (capturas en ${CAPTURAS})`);
await nav.close();
process.exit(mal ? 1 : 0);
