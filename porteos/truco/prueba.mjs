// Truco — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/truco/prueba.mjs http://127.0.0.1:8871/truco/ [entrega-truco/truco.apk] [file:///…/truco.html]
//
// Primer argumento: la carpeta web servida por http (el service worker lo necesita). Opcionales: el
// APK y el .html de un solo archivo. Los toques son dedos de verdad (CDP Input.dispatchTouchEvent) y
// cada control se mide en el estado del juego: la mano del motor de reglas (truco.js) que la página
// deja en TrucoApp.test, con sus cartas, sus eventos y los puntos.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const WEB = process.argv[2] || 'http://127.0.0.1:8871/truco/';
const APK = process.argv.slice(3).find((a) => /\.apk$/i.test(a));
const ARCHIVO = process.argv.slice(3).find((a) => /^file:|\.html$/i.test(a));
const CAPTURAS = process.env.CAPTURAS || '/tmp/truco-prueba';
mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null;      // p. ej. SOLO=G,H para correr sólo esas
const corre = (x) => !SOLO || SOLO.includes(x);
const RAPIDO = JSON.stringify({ rapido: true, puntos: 15, flor: false, mostrar: true });

async function abrir(url, { w = 412, h = 915, movil = true, ajustes = RAPIDO, intro = false, navegador = nav, contexto = {} } = {}) {
  const c = await navegador.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, deviceScaleFactor: movil ? 2 : 1, locale: 'es-AR', ...contexto });
  const pg = await c.newPage();
  const errores = [], afuera = [];
  const origen = url.startsWith('file:') ? 'file:' : new URL(url).origin;
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 160)); });
  pg.on('response', (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${r.url()}`); });
  pg.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure() && r.failure().errorText)) errores.push(`falló ${r.url()} ${r.failure() && r.failure().errorText}`); });
  pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(origen) && !/^(data|blob):/.test(u)) afuera.push(u); });
  await pg.addInitScript(([aj, intro]) => {
    try {
      if (!intro) sessionStorage.setItem('truco-sin-intro', '1');
      if (aj && !sessionStorage.getItem('prueba-ajustes')) { localStorage.setItem('truco.ajustes', aj); sessionStorage.setItem('prueba-ajustes', '1'); }
    } catch (_) {}
  }, [ajustes, intro]);
  const t0 = Date.now();
  await pg.goto(url);
  return { c, pg, errores, afuera, t0, movil };
}
const listo = (t, ms = 40000) => t.pg.waitForFunction(() => window.TrucoApp && TrucoApp.listo, null, { timeout: ms });
const est = (t) => t.pg.evaluate(() => {
  const x = TrucoApp.test, m = x.mano;
  return { esperando: x.esperando, acciones: x.acciones || [], pantalla: x.pantalla, puntos: x.puntos, ventana: x.ventana,
    mias: m ? m.cartas[0].length : null, eventos: m ? m.eventos.length : 0, terminada: m ? m.terminada : null };
});
async function esperar(t, cond, ms = 30000, paso = 120) {
  const fin = Date.now() + ms;
  for (;;) {
    const e = await est(t);
    if (cond(e)) return e;
    if (Date.now() > fin) return null;
    await t.pg.waitForTimeout(paso);
  }
}
// un dedo en el medio del elemento (si está en una lista que se desliza, primero se la desliza)
async function tocar(t, sel) {
  await t.pg.evaluate((s) => { const e = document.querySelector(s); if (e && e.closest('.lista')) e.scrollIntoView({ block: 'center' }); }, sel);
  const box = await t.pg.locator(sel).first().boundingBox({ timeout: 10000 });
  if (!box) throw new Error('no está: ' + sel);
  if (t.movil) await t.pg.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await t.pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await t.pg.waitForTimeout(250);
}
const P = (n) => `[data-prueba="${n}"]`;
// un punto de una carta de la mano que se vea (las cartas se tapan entre sí en abanico)
// (con el teléfono acostado, web.js gira la página: getBoundingClientRect da coordenadas del juego y
// elementFromPoint y el dedo, de la pantalla; se pasa de unas a otras)
const puntoDeCarta = (t, id) => t.pg.evaluate((id) => {
  const g = window.Porteo && Porteo.girar && Porteo.girar();
  const fis = (x, y) => { if (!g || !g.activo()) return [x, y]; const [W, H] = g.fisico(); return g.sentido() > 0 ? [W - y, x] : [y, H - x]; };
  const cs = [...document.querySelectorAll('.mano-yo .carta.elegible')].filter((c) => !id || c.dataset.carta === id);
  for (const c of cs) {
    const r = c.getBoundingClientRect();
    for (let fy = 0.12; fy < 0.9; fy += 0.08) for (let fx = 0.08; fx < 0.95; fx += 0.08) {
      const [x, y] = fis(r.left + r.width * fx, r.top + r.height * fy);
      const e = document.elementFromPoint(x, y);
      if (e && (e === c || c.contains(e))) return { x, y, id: c.dataset.carta };
    }
  }
  return null;
}, id);
async function tocarCarta(t) {
  const p = await puntoDeCarta(t);
  if (!p) return null;
  if (t.movil) await t.pg.touchscreen.tap(p.x, p.y); else await t.pg.mouse.click(p.x, p.y);
  return p.id;
}
// juega tocando hasta que se cumpla cond (o termine el partido): tira cartas, quiere la mitad de las veces
async function jugarHasta(t, cond, ms = 180000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const e = await est(t);
    if (cond(e)) return e;
    if (e.esperando === 'fin-partida') return e;
    if (e.esperando === 'charla') { await tocar(t, P('quiero')); continue; }
    if (e.esperando !== 'jugador') { await t.pg.waitForTimeout(120); continue; }
    const resp = await t.pg.locator('.respuesta:not(.fuera)').count();
    if (resp && e.acciones.includes('responder:quiero') && Math.random() < 0.5) await tocar(t, P('quiero'));
    else if (e.acciones.some((a) => a.startsWith('jugar:'))) { if (!await tocarCarta(t)) await t.pg.waitForTimeout(150); }
    else if (resp) await tocar(t, P('noquiero'));
    else await t.pg.waitForTimeout(150);
    await t.pg.waitForTimeout(200);
  }
  return null;
}
const enPantalla = (t, sel) => t.pg.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
}, sel);
async function aPartidaRapida(t, modo = 'modo-2') {
  await tocar(t, P('Jugar'));
  await tocar(t, P('Partida Rápida'));
  await tocar(t, P(modo));
  return esperar(t, (e) => e.esperando === 'jugador' || e.esperando === 'bot' || e.esperando === 'mostrando', 20000);
}

// ── A. carga ───────────────────────────────────────────────────────────────────────────
console.log('A. Carga');
if (corre('A')) {
  const t = await abrir(WEB, { intro: true });
  const vioIntro = await t.pg.waitForSelector('#porteo-intro', { timeout: 15000 }).then(() => true).catch(() => false);
  ch('A: la intro de la marca, primero', vioIntro);
  await t.pg.waitForTimeout(700);
  await t.pg.touchscreen.tap(206, 450);
  const salto = await t.pg.waitForSelector('#porteo-intro', { state: 'detached', timeout: 4000 }).then(() => true).catch(() => false);
  ch('A: un toque saltea la intro', salto);
  await listo(t);
  const seg = (Date.now() - t.t0) / 1000;
  await t.pg.waitForTimeout(600);
  const m = await t.pg.evaluate(() => ({ caps: document.querySelectorAll('.capsula').length, tabs: document.querySelectorAll('.pie .tab').length,
    fuente: document.fonts.check('80px Tit4') && document.fonts.check('60px Yanone') && document.fonts.check('70px VistaAlt'),
    logo: getComputedStyle(document.querySelector('.logo')).backgroundImage.startsWith('url("blob:') }));
  ch('A: el menú con sus cápsulas, las pestañas, el logo y las letras del juego', m.caps === 4 && m.tabs === 3 && m.fuente && m.logo, JSON.stringify(m));
  ch('A: tiempo hasta el menú (con intro)', seg < 15, `${seg.toFixed(1)} s`);
  await t.pg.screenshot({ path: `${CAPTURAS}/a-menu.png` });
  ch('A: sin errores en la consola ni pedidos fallidos', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  ch('A: ningún pedido afuera del sitio', t.afuera.length === 0, t.afuera.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── B y C. jugar sólo tocando; cada control, medido en el motor ────────────────────────────
console.log('\nB. Del menú a la mesa, tocando  ·  C. Los controles');
if (corre('B')) {
  const t = await abrir(WEB);
  await listo(t);
  const e0 = await aPartidaRapida(t);
  ch('B: Jugar → Partida Rápida → Solo: arranca la partida', !!e0, e0 && e0.esperando);
  const e1 = await esperar(t, (e) => e.mias === 3 && e.esperando, 15000);
  const dom = await t.pg.evaluate(() => ({ mano: document.querySelectorAll('.mano-yo .carta').length,
    chicas: [...document.querySelectorAll('.avatar .chicas i')].filter((i) => i.style.visibility === 'visible').length,
    nombre: (document.querySelector('.avatar .nombre') || {}).textContent }));
  ch('B: repartió: 3 cartas en la mano y 3 dadas vuelta al lado del rival', e1 && dom.mano === 3 && dom.chicas >= 2, JSON.stringify(dom));
  await t.pg.screenshot({ path: `${CAPTURAS}/b-mesa.png` });

  // C1: tocar una carta la tira
  let e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.some((a) => a.startsWith('jugar:')), 60000);
  let antes = await est(t);
  const id = await tocarCarta(t);
  e = await esperar(t, (x) => x.mias === antes.mias - 1, 8000);
  const enMesa = await t.pg.evaluate((id) => !!document.querySelector(`[data-prueba="mesa-${id}"]`), id);
  ch('C: tocar una carta la tira a la mesa', !!e && enMesa, `${id}: ${antes.mias} → ${e && e.mias}`);

  // C2: arrastrarla para arriba también
  e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.some((a) => a.startsWith('jugar:')) && x.mias >= 2, 60000);
  antes = await est(t);
  const pp = await puntoDeCarta(t);
  if (pp) {
    const cdp = await t.c.newCDPSession(t.pg);
    const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await toque('touchStart', pp.x, pp.y);
    for (let k = 1; k <= 8; k++) { await toque('touchMove', pp.x, pp.y - k * 30); await t.pg.waitForTimeout(16); }
    await toque('touchEnd');
  }
  e = await esperar(t, (x) => x.mias === antes.mias - 1, 8000);
  ch('C: arrastrar una carta para arriba la tira', !!pp && !!e, `${antes.mias} → ${e && e.mias}`);

  // C3: Truco → el motor registra el canto del jugador y el rival contesta
  e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.includes('cantar:truco'), 120000);
  if (e && e.acciones.includes('cantar:truco')) {
    await tocar(t, P('truco'));
    const r = await t.pg.waitForFunction(() => { const m = TrucoApp.test.mano; return m && m.eventos.some((x) => x.tipo === 'canto' && x.s === 0 && x.que === 'truco') &&
      m.eventos.some((x) => (x.tipo === 'respuesta' || x.tipo === 'canto' || x.tipo === 'mazo') && x.s === 1 && m.eventos.indexOf(x) > m.eventos.findIndex((y) => y.tipo === 'canto' && y.que === 'truco')); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    const globo = await t.pg.evaluate(() => (TrucoApp.test.globos || []).some((g) => g.s === 0 && /TRUCO/.test(g.texto)));
    ch('C: Truco: lo canta el jugador (globo y motor) y el rival contesta', r && globo);
  } else ch('C: Truco', false, 'no apareció una mano para cantarlo');

  // C4: Envido → abre la barra del envido y el canto queda en el motor
  e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.includes('cantar:envido') && x.acciones.some((a) => a.startsWith('jugar:')), 150000);
  if (e && e.acciones.includes('cantar:envido')) {
    await tocar(t, P('envido'));
    const barra = await t.pg.evaluate(() => { const b = document.querySelector('[data-prueba="b-envido"]').closest('.barra'); return !b.classList.contains('fuera'); });
    await tocar(t, P('b-envido'));
    const r = await t.pg.waitForFunction(() => { const m = TrucoApp.test.mano; return m && m.eventos.some((x) => x.tipo === 'canto' && x.s === 0 && x.que === 'envido'); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
    ch('C: Envido abre su barra y el canto llega al motor', barra && r);
    const v = await t.pg.waitForFunction(() => /Envido/.test(TrucoApp.test.ventana || '') || (TrucoApp.test.aviso || '').startsWith('Envido'), null, { timeout: 15000 }).then(() => true).catch(() => false);
    ch('C: el resultado del envido se muestra (ventana o aviso)', v);
  } else ch('C: Envido', false, 'no apareció una mano para cantarlo');

  // C5: responder Quiero / No quiero a un canto del rival
  e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.includes('responder:quiero'), 240000);
  if (e && e.acciones.includes('responder:quiero')) {
    const n0 = (await est(t)).eventos;
    await tocar(t, P('quiero'));
    const r = await t.pg.waitForFunction((n0) => { const m = TrucoApp.test.mano; return m && m.eventos.slice(n0).some((x) => x.tipo === 'respuesta' && x.s === 0 && x.que === 'quiero'); }, n0, { timeout: 8000 }).then(() => true).catch(() => false);
    ch('C: Quiero contesta el canto del rival', r);
  } else ch('C: Quiero', false, 'el rival no cantó nada en este rato');

  // C6: Mazo termina la mano
  e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.includes('mazo:'), 120000);
  if (e && e.acciones.includes('mazo:')) {
    await t.pg.evaluate(() => { TrucoApp.test.log = []; });
    await tocar(t, P('mazo'));
    // (lo que va mostrando la mesa queda en TrucoApp.test.log: la mano del motor ya puede ser otra)
    const r = await t.pg.waitForFunction(() => { const l = TrucoApp.test.log || []; return l.some((x) => x.tipo === 'mazo' && x.s === 0) && l.some((x) => x.tipo === 'fin-mano'); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
    ch('C: Mazo: el jugador se va y la mano termina', r);
  } else ch('C: Mazo', false);
  // C7: los palitos dicen lo mismo que el motor
  await t.pg.waitForTimeout(1500);
  const tanto = await t.pg.evaluate(() => {
    const p = TrucoApp.test.partida.puntos;
    const lado = [...document.querySelectorAll('.tanteador .lado')].map((l) => [...l.querySelectorAll('.palitos i')].map((i) => +(/pts_(\d+)/.exec(i.style.backgroundImage) || [0, 0])[1]));
    const cuenta = lado.map((cs) => cs.reduce((a, n) => a + (n > 5 ? n - 5 : n), 0));
    return { p, cuenta };
  });
  ch('C: los palitos del tanteador dicen los puntos del motor', tanto.p[0] % 15 === tanto.cuenta[0] % 15 && tanto.p[1] % 15 === tanto.cuenta[1] % 15, JSON.stringify(tanto));
  await t.pg.screenshot({ path: `${CAPTURAS}/c-mesa.png` });
  ch('B/C: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── D. un partido entero, hasta el final ──────────────────────────────────────────────────
console.log('\nD. Un partido entero');
if (corre('D')) {
  const t = await abrir(WEB);
  await listo(t);
  await aPartidaRapida(t);
  const e = await jugarHasta(t, (x) => x.esperando === 'fin-partida', 420000);
  const fin = await t.pg.waitForFunction(() => /FIN DE PARTIDA/.test(document.querySelector('.velo.ver h2') ? document.querySelector('.velo.ver h2').textContent : ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
  const p = await t.pg.evaluate(() => TrucoApp.test.partida.puntos);
  ch('D: se juega hasta el final tocando (a 15) y sale «FIN DE PARTIDA»', !!e && fin && Math.max(...p) === 15, JSON.stringify(p));
  await t.pg.screenshot({ path: `${CAPTURAS}/d-fin.png` });
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.velo.ver .boton')].find((x) => /REVANCHA/.test(x.textContent)); if (b) b.dataset.prueba = 'revancha'; });
  await tocar(t, P('revancha'));
  const nueva = await esperar(t, (x) => x.mias === 3 && x.puntos && x.puntos[0] + x.puntos[1] === 0, 15000);
  ch('D: Revancha empieza otro partido de cero', !!nueva);
  ch('D: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── E. atrás y pausa ───────────────────────────────────────────────────────────────────────
console.log('\nE. Atrás y pausa');
if (corre('E')) {
  const t = await abrir(WEB, { ajustes: JSON.stringify({ rapido: true, musica: true }) });
  await listo(t);
  await tocar(t, P('Jugar'));
  await t.pg.keyboard.press('Escape');
  await t.pg.waitForTimeout(400);
  ch('E: atrás (Escape) en Jugar vuelve a Inicio', (await est(t)).pantalla === 'menu-inicio');
  await aPartidaRapida(t);
  await t.pg.keyboard.press('Escape');
  const pregunta = await t.pg.waitForFunction(() => /Abandono/.test(TrucoApp.test.ventana || '') && document.querySelector('.velo.ver'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  await t.pg.keyboard.press('Escape');
  await t.pg.waitForTimeout(500);
  const sigue = await t.pg.evaluate(() => !document.querySelector('.velo.ver') && TrucoApp.test.pantalla === 'mesa');
  ch('E: atrás en la mesa pregunta si abandonar; otro atrás cierra la pregunta y se sigue jugando', pregunta && sigue);
  // ocultar la página: la música y el sonido se cortan
  const pausa = await t.pg.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 300));
    const S = TrucoApp.Sonido;
    return { musica: !S.musica || S.musica.paused, ctx: !S.ctx || S.ctx.state !== 'running' };
  });
  ch('E: con la página oculta, la música se pausa y el audio se suspende', pausa.musica && pausa.ctx, JSON.stringify(pausa));
  await t.pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await tocar(t, P('salir'));
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.velo.ver .boton')].find((x) => /ABANDONAR/.test(x.textContent)); if (b) b.dataset.prueba = 'abandonar'; });
  await tocar(t, P('abandonar'));
  await t.pg.waitForTimeout(600);
  ch('E: Abandonar vuelve al menú', /^menu/.test((await est(t)).pantalla), (await est(t)).pantalla);
  ch('E: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── F. lo que se guarda sobrevive a una recarga ─────────────────────────────────────────────
console.log('\nF. Guardado');
if (corre('F')) {
  const t = await abrir(WEB);
  await listo(t);
  // ajustes: a 30 desde el panel del costado
  await t.pg.evaluate(() => TrucoApp.abrirCostado());
  await t.pg.waitForTimeout(500);
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.costado .interruptor i')].find((i) => i.textContent === 'a 30'); b.dataset.prueba = 'a30'; });
  await tocar(t, P('a30'));
  // el anotador
  await t.pg.keyboard.press('Escape');
  await tocar(t, P('Anotador'));
  for (let i = 0; i < 4; i++) await tocar(t, P('mas-nos'));
  await tocar(t, P('mas-ellos'));
  await t.pg.reload();
  await listo(t);
  const g = await t.pg.evaluate(() => ({ puntos: TrucoApp.AJ.puntos, anot: JSON.parse(localStorage.getItem('truco.anotador')) }));
  ch('F: los ajustes y el anotador siguen después de recargar', g.puntos === 30 && g.anot.nos === 4 && g.anot.ellos === 1, JSON.stringify(g));
  // un partido a medias se puede reanudar
  await t.pg.evaluate(() => { TrucoApp.AJ.puntos = 15; localStorage.setItem('truco.ajustes', JSON.stringify(TrucoApp.AJ)); });
  await aPartidaRapida(t);
  const e = await jugarHasta(t, (x) => x.puntos && x.puntos[0] + x.puntos[1] > 0 && x.esperando === 'jugador', 120000);
  const antes = await t.pg.evaluate(() => TrucoApp.test.partida.puntos.slice());
  await t.pg.reload();
  await listo(t);
  const ofrece = await t.pg.waitForFunction(() => /Reanudar/.test(TrucoApp.test.ventana || ''), null, { timeout: 8000 }).then(() => true).catch(() => false);
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.velo.ver .boton')].find((x) => /Reanudar/i.test(x.textContent)); if (b) b.dataset.prueba = 'reanudar'; });
  if (ofrece) await tocar(t, P('reanudar'));
  const r = await esperar(t, (x) => x.pantalla === 'mesa' && x.mias === 3, 15000);
  const despues = r && await t.pg.evaluate(() => TrucoApp.test.partida.puntos.slice());
  ch('F: un partido a medias se reanuda después de recargar, con los puntos de antes', !!e && ofrece && !!r && despues && despues[0] >= Math.min(antes[0], despues[0]) && despues[0] + despues[1] > 0,
    `${JSON.stringify(antes)} → ${JSON.stringify(despues)}`);
  await tocar(t, P('salir'));
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.velo.ver .boton')].find((x) => /ABANDONAR/.test(x.textContent)); if (b) b.dataset.prueba = 'abandonar'; });
  await tocar(t, P('abandonar'));
  await esperar(t, (x) => /^menu/.test(x.pantalla), 8000);
  // la Gira: un partido entero suma puntos que quedan guardados
  if ((await est(t)).pantalla !== 'menu-jugar') await tocar(t, P('Jugar'));
  await tocar(t, P('Gira Nacional'));
  await tocar(t, P('buenos-aires'));
  const rival = await t.pg.evaluate(() => [...document.querySelectorAll('.fila:not(.yo):not(.trabada)')].pop().dataset.prueba);
  await tocar(t, P(rival));
  await t.pg.evaluate(() => { const b = document.querySelector('.velo.ver .boton'); b.dataset.prueba = 'desafiar'; });
  await tocar(t, P('desafiar'));
  await jugarHasta(t, (x) => x.esperando === 'fin-partida', 420000);
  await t.pg.waitForTimeout(1200);
  await t.pg.evaluate(() => { const b = [...document.querySelectorAll('.velo.ver .boton')].find((x) => /CONTINUAR/.test(x.textContent)); if (b) b.dataset.prueba = 'continuar'; });
  await tocar(t, P('continuar'));
  await t.pg.waitForTimeout(800);
  const gira1 = await t.pg.evaluate(() => TrucoApp.test.gira());
  await t.pg.reload();
  await listo(t);
  const gira2 = await t.pg.evaluate(() => TrucoApp.test.gira());
  ch('F: la Gira suma puntos al terminar un partido y quedan guardados', gira1.total > 0 && gira2.total === gira1.total && gira2.jugados === 1, `total ${gira1.total}, región ${JSON.stringify(gira2.region)}`);
  ch('F: sin errores en la consola', t.errores.length === 0, t.errores.slice(0, 3).join(' | '));
  await t.c.close();
}

// ── G. pantallas: parado, chico, acostado y en una compu ──────────────────────────────────────
console.log('\nG. Pantallas');
if (corre('G')) for (const [nombre, w, h, movil] of [['parado 412×915', 412, 915, true], ['chico 360×640', 360, 640, true], ['acostado 915×412', 915, 412, true], ['compu 1280×720', 1280, 720, false]]) {
  const t = await abrir(WEB, { w, h, movil });
  await listo(t);
  const menuBien = await enPantalla(t, '.pie .tab:last-child') && await enPantalla(t, '.capsula.abajo');
  await aPartidaRapida(t);
  await esperar(t, (x) => x.mias === 3, 15000);
  await t.pg.waitForTimeout(600);
  const cosas = {};
  for (const [k, s] of [['atrás', '.cabecera .atras'], ['ajustes', '.cabecera .charla'], ['truco', P('truco')], ['mazo', P('mazo')], ['rival', '.avatar:nth-child(2) .foto'], ['yo', '.avatar:first-child .foto']]) cosas[k] = await enPantalla(t, s);
  const e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.some((a) => a.startsWith('jugar:')), 60000);
  const antes = (await est(t)).mias;
  const id = e && await tocarCarta(t);
  const tiro = id && await esperar(t, (x) => x.mias === antes - 1, 8000);
  const girada = await t.pg.evaluate(() => !!(window.Porteo && Porteo.girar && Porteo.girar().activo && Porteo.girar().activo()));
  await t.pg.screenshot({ path: `${CAPTURAS}/g-${w}x${h}.png` });
  const todo = Object.values(cosas).every(Boolean);
  ch(`G: ${nombre}: menú y mesa enteros, se juega tocando${nombre.startsWith('acostado') ? ' (girado 90°)' : ''}`, menuBien && todo && !!tiro && (nombre.startsWith('acostado') ? girada : true),
    `${JSON.stringify(cosas)}${girada ? ' girado' : ''}`);
  if (t.errores.length) ch(`G: ${nombre}: sin errores`, false, t.errores.slice(0, 2).join(' | '));
  await t.c.close();
}

// ── H. sin red ─────────────────────────────────────────────────────────────────────────────
console.log('\nH. Sin red');
if (corre('H')) {
  const t = await abrir(WEB);
  await listo(t);
  // (waitForFunction no espera las promesas: con una función async daría verdadero enseguida)
  const guardo = await t.pg.evaluate(async () => {
    for (let i = 0; i < 240; i++) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r && r.active && r.active.state === 'activated' && navigator.serviceWorker.controller) {
        const n = (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0);
        if (n > 1200) return true;
      }
      await new Promise((ok) => setTimeout(ok, 500));
    }
    return false;
  });
  ch('H: el service worker guarda todo el juego al instalarse', guardo);
  await t.c.setOffline(true);
  await t.pg.reload();
  const anda = await listo(t, 30000).then(() => true).catch(() => false);
  let juega = false;
  if (anda) {
    await aPartidaRapida(t, 'modo-4');
    juega = !!(await esperar(t, (x) => x.mias === 3, 15000));
    await t.pg.waitForTimeout(800);
    juega = juega && await t.pg.evaluate(() => [...document.querySelectorAll('.mano-yo .carta img.cara')].every((i) => i.complete && i.naturalWidth > 0));
  }
  ch('H: sin internet abre, reparte y se ven las cartas (2 contra 2)', anda && juega);
  await t.c.close();
}

// ── I. 2 contra 2 y 3 contra 3 ───────────────────────────────────────────────────────────────
console.log('\nI. En parejas y de a tres');
if (corre('I')) for (const [modo, n] of [['modo-4', 4], ['modo-6', 6]]) {
  const t = await abrir(WEB, { ajustes: JSON.stringify({ rapido: false, puntos: 15 }) });
  await listo(t);
  await aPartidaRapida(t, modo);
  await esperar(t, (x) => x.mias === 3, 20000);
  const caras = await t.pg.evaluate(() => document.querySelectorAll('.mesa .avatar').length);
  const manos0 = await t.pg.evaluate(() => TrucoApp.test.partida.manos);
  let charla = false;
  const fin = Date.now() + 150000;
  while (Date.now() < fin) {
    const x = await est(t);
    if (x.esperando === 'charla') charla = true;
    const manos = await t.pg.evaluate(() => TrucoApp.test.partida.manos);
    if (manos >= manos0 + 2 || x.esperando === 'fin-partida') break;
    await jugarHasta(t, (y) => y.esperando === 'charla' || y.terminada, 20000);
    if ((await est(t)).esperando === 'charla') { charla = true; await tocar(t, P('quiero')); }
  }
  const manos = await t.pg.evaluate(() => TrucoApp.test.partida.manos);
  await t.pg.screenshot({ path: `${CAPTURAS}/i-${n}.png` });
  ch(`I: ${n / 2} contra ${n / 2}: ${n} caras en la mesa y se juegan manos enteras tocando`, caras === n && manos >= manos0 + 2, `${manos - manos0} manos${charla ? ', el compañero preguntó «¿Canto?»' : ''}`);
  ch(`I: ${n / 2} contra ${n / 2}: sin errores`, t.errores.length === 0, t.errores.slice(0, 2).join(' | '));
  await t.c.close();
}

// ── J. el .html de un solo archivo ────────────────────────────────────────────────────────────
if (ARCHIVO && corre('J')) {
  console.log('\nJ. Un solo archivo');
  const url = ARCHIVO.startsWith('file:') ? ARCHIVO : 'file://' + ARCHIVO;
  const t = await abrir(url);
  const anda = await listo(t, 90000).then(() => true).catch(() => false);
  let juega = false;
  if (anda) {
    await aPartidaRapida(t);
    const e = await jugarHasta(t, (x) => x.esperando === 'jugador' && x.acciones.some((a) => a.startsWith('jugar:')), 60000);
    const antes = (await est(t)).mias;
    if (e && await tocarCarta(t)) juega = !!(await esperar(t, (x) => x.mias === antes - 1, 8000));
    await t.pg.waitForTimeout(500);
    juega = juega && await t.pg.evaluate(() => [...document.querySelectorAll('.carta img.cara')].every((i) => i.complete && i.naturalWidth > 0));
  }
  await t.pg.screenshot({ path: `${CAPTURAS}/j-un-archivo.png` });
  ch('J: abierto desde el disco: carga, reparte y se juega', anda && juega);
  ch('J: sin errores y sin pedidos afuera', t.errores.length === 0 && t.afuera.length === 0, t.errores.concat(t.afuera).slice(0, 3).join(' | '));
  await t.c.close();
}

// ── K. el APK ────────────────────────────────────────────────────────────────────────────────
if (APK && corre('K')) {
  console.log('\nK. El APK');
  const sdk = process.env.ANDROID_HOME || '/opt/android-sdk';
  const bt = existsSync(`${sdk}/build-tools`) ? execFileSync('ls', [`${sdk}/build-tools`]).toString().trim().split('\n').pop() : '';
  const herr = (n) => `${sdk}/build-tools/${bt}/${n}`;
  let firma = '';
  try { firma = execFileSync(herr('apksigner'), ['verify', '--verbose', APK]).toString(); } catch (e) { firma = String(e.stdout || e.message); }
  ch('K: apksigner verify', /Verifies/.test(firma) && !/DOES NOT VERIFY/.test(firma), (firma.match(/Verified using v\d scheme.*: true/g) || []).join(', '));
  const badging = execFileSync(herr('aapt2'), ['dump', 'badging', APK]).toString();
  const paquete = (badging.match(/package: name='([^']+)'/) || [])[1];
  const nombre = (badging.match(/application-label:'([^']+)'/) || [])[1];
  const sdkMin = (badging.match(/(?:minSdkVersion|sdkVersion):'(\d+)'/) || [])[1];
  const icono = /application-icon-\d+:'[^']+'/.test(badging);
  ch('K: nombre, paquete, ícono y SDK', paquete === 'ar.juniors.truco' && nombre === 'Truco' && icono && +sdkMin >= 21, `${paquete}, «${nombre}», SDK ${sdkMin}`);
  const manifiesto = execFileSync(herr('aapt2'), ['dump', 'xmltree', APK, '--file', 'AndroidManifest.xml']).toString();
  ch('K: orientación parada', /screenOrientation\(0x0101001e\)=7\b|sensorPortrait/.test(manifiesto));
  const lista = execFileSync('unzip', ['-Z1', APK], { maxBuffer: 64 << 20 }).toString().split('\n');
  const indice = await fetch(new URL('datos/indice.json', WEB)).then((r) => r.json());
  const esperados = ['index.html', 'juego.js', 'mesa.js', 'truco.js', 'truco-ia.js', 'estilos.css', 'datos/indice.json', 'datos/textos.json', 'datos/jugadores.json',
    ...Object.keys(indice.ui).map((n) => `datos/ui/${n}.webp`), ...Object.keys(indice.avatares).map((n) => `datos/avatares/${n}.webp`),
    ...Object.entries(indice.voces).flatMap(([v, cs]) => Object.entries(cs).flatMap(([c, k]) => Array.from({ length: k }, (_, i) => `datos/voces/${v}/${c}-${i + 1}.mp3`))),
    ...indice.musica.map((m) => `datos/musica/${m}.mp3`), ...Object.keys(indice.mazos).map((m) => `datos/cartas/${m}/espada-1.webp`)]
    .map((f) => 'assets/juego/' + f);
  const faltan = esperados.filter((f) => !lista.includes(f));
  ch('K: adentro está todo el juego (mazos, caras, voces, música, interfaz)', faltan.length === 0, faltan.length ? 'faltan ' + faltan.slice(0, 4).join(', ') : `${esperados.length} archivos revisados`);
}

console.log(`\n${ok} bien, ${mal} mal  (capturas en ${CAPTURAS})`);
await nav.close();
process.exit(mal ? 1 : 0);
