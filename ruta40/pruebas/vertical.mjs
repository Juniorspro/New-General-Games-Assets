// RUTA 40 con el teléfono parado: que se juegue vertical de verdad (sin girar nada) y que acostado y en
// el monitor quede todo como estaba. Maneja con los pedales tocando de verdad (Input.dispatchTouchEvent),
// mira que el HUD no pise los pedales ni el auto, recorre todas las pantallas en tres tamaños buscando
// cosas cortadas y compara acostado con las medidas de antes del cambio. Falla si algo no se cumple.
//     node ruta40/pruebas/vertical.mjs [carpeta de capturas]     (por defecto ruta40/pruebas/salida/)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(AQUI, 'pruebas/salida');
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const fallas = [], errores = [];
const cumple = (bien, que, dato = '') => { console.log(`${bien ? 'ok ' : 'MAL'}  ${que}${dato !== '' ? ' · ' + dato : ''}`); if (!bien) fallas.push(que); return bien; };
const cruza = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const r1 = (v) => Math.round(v * 10) / 10;

/* un teléfono (o un monitor) nuevo, sin partida guardada; en inglés como el Chromium de las medidas de antes */
async function abrir(w, h, tel = true) {
  const ctx = await nav.newContext(tel ? { viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' } : { viewport: { width: w, height: h }, locale: 'en-US' });
  const pag = await ctx.newPage();
  const n = `${w}x${h}`;
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(`${n}: ${m.text()}`); });
  pag.on('pageerror', (e) => errores.push(`${n}: ${e}`));
  await pag.goto('file://' + path.join(AQUI, 'ruta40.html') + '?prueba');
  await pag.waitForSelector('#idioma', { timeout: 60000 });
  const foto = (nombre) => pag.screenshot({ path: path.join(OUT, nombre + '.png') });
  const caja = (sel) => pag.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null; }, sel);
  /* largo: con varias páginas a la vez en SwiftShader, el final del viaje (que corre en cámara lenta) tarda */
  const esperar = (sel) => pag.waitForSelector(sel, { timeout: 120000 });
  return { ctx, pag, foto, caja, esperar };
}

/* dónde está el auto en la pantalla (en px de CSS): la caja aproximada del dibujo, y cuánta ruta se ve adelante */
const AUTO = () => {
  const r = window.__r40, d = r.dib, v = r.viaje || r.demo, A = v.yo, p = A.dib || A, k = d.dprCss || 1, e = d.cam.esc;
  const cx = d.sx(p.x) / k, cy = d.sy(p.y) / k, L = A.def.largo * e / k;
  return { left: cx - L / 2, right: cx + L / 2, top: cy - L * 0.36, bottom: cy + L * 0.2, fx: cx / innerWidth, fy: cy / innerHeight, largo: L, adelante: (d.W / k - cx) / (e / k), vx: A.vx, x: A.x };
};

/* ¿algo cortado o corrido de costado? Lo que está adentro de un tablero o del panel de la gomería (que se
   desplazan) cuenta contra esa caja; el resto, contra la pantalla */
const REVISAR = () => {
  /* (primero se terminan las animaciones de entrada: la postal sube con translateY(40%) y gira, y a media
     animación sale de la pantalla aunque después quede bien; las que no terminan nunca se dejan) */
  for (const a of document.getAnimations()) { const t = a.effect && a.effect.getComputedTiming(); if (t && Number.isFinite(t.endTime)) a.finish(); }
  const W = innerWidth, H = innerHeight, malos = [], desplaza = [];
  const sel = 'button, h1, h2, h3, p, .fila, .mejora, .parada, .postal, .cuentas, .patente, .stats, .carrera, .pare, .rombo, .plata, .escudo, .desc';
  for (const e of document.querySelectorAll(sel.split(', ').map((s) => '#ui ' + s).join(', '))) {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || getComputedStyle(e).visibility === 'hidden') continue;
    const cont = e.parentElement && e.parentElement.closest('.tablero, .panel');
    const c = cont ? cont.getBoundingClientRect() : { left: 0, right: W, top: 0, bottom: H };
    const fuera = r.left < c.left - 3 || r.right > c.right + 3 || (!cont && (r.top < -3 || r.bottom > H + 3));
    if (fuera) malos.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 18)}" [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
    /* texto que no entra en su propio renglón (se sale de su caja sin ajustar) */
    if (/^(BUTTON|H1|H2|H3)$/.test(e.tagName) && e.scrollWidth > e.clientWidth + 2) malos.push(`${e.tagName.toLowerCase()} "${e.textContent.trim().slice(0, 18)}" no entra`);
  }
  for (const c of document.querySelectorAll('#ui .tablero, #ui .panel')) if (c.scrollHeight > c.clientHeight + 2) desplaza.push(`${c.className.split(' ')[0]} ${c.scrollHeight}/${c.clientHeight}`);
  const ancho = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, document.getElementById('app').scrollWidth);
  return { W, ancho, malos, desplaza };
};

/* ======================================================================= 1. parado, a mano (390×844) */
console.log('— parado 390×844: la partida entera con el dedo');
{
  const { ctx, pag, foto, caja, esperar } = await abrir(390, 844);
  const cdp = await ctx.newCDPSession(pag);
  const dedos = (tipo, puntos) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const centro = async (sel) => { const r = await caja(sel); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const tocar = async (sel) => { await pag.locator(sel).first().waitFor({ state: 'visible', timeout: 20000 }); await pag.locator(sel).first().tap(); };

  const pan = await pag.evaluate(() => ({ vertical: window.__r40.Pantalla.vertical, girado: window.__r40.Pantalla.girado, clase: document.documentElement.className, t: document.getElementById('app').style.transform, tc: getComputedStyle(document.getElementById('app')).transform, W: window.__r40.Pantalla.W, H: window.__r40.Pantalla.H, dibV: window.__r40.dib.vertical, u: getComputedStyle(document.documentElement).getPropertyValue('--u') }));
  cumple(pan.vertical && !pan.girado && !pan.t && pan.tc === 'none' && /vertical/.test(pan.clase) && !/girado/.test(pan.clase), 'parado no se gira: se juega vertical', `transform "${pan.tc}" · clases "${pan.clase}"`);
  const app = await caja('#app');
  cumple(pan.W === 390 && pan.H === 844 && app.width === 390 && app.height === 844 && pan.dibV, '#app ocupa la pantalla parada (390×844) y el dibujo sabe que es vertical', `u = ${pan.u}`);
  await pag.waitForTimeout(900); await foto('v01-idioma');
  await tocar('#idioma .carteles button:nth-child(1)');
  await esperar('#historia'); await pag.waitForTimeout(1200); await foto('v02-historia');
  await tocar('#historia .saltar');
  await esperar('#menu'); await pag.waitForTimeout(2500); await foto('v03-menu');
  {
    const a = await pag.evaluate(AUTO), b = await caja('#menu .botones'), m = await caja('#menu .marca');
    cumple(a.left > 0 && a.right < 390 && !cruza(a, b) && !cruza(a, m), 'en el menú el auto del demo se ve entre la marca y los carteles', `auto ${Math.round(a.top)}–${Math.round(a.bottom)} px · marca hasta ${Math.round(m.bottom)} · carteles desde ${Math.round(b.top)}`);
  }
  await tocar('#menu .botones button:nth-child(1)');
  await esperar('#mapa'); await pag.waitForTimeout(900); await foto('v04-mapa');
  await pag.evaluate(() => { window.__r40.P.monedas = 50000; });
  await tocar('#mapa .postal .acciones button:nth-child(1)');
  await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
  await pag.waitForTimeout(1200); await foto('v05-largada');
  /* el tutorial: cada cartel arriba de su pedal, sin pisarse */
  {
    const t = await pag.evaluate(() => [...document.querySelectorAll('#hud .tutoCartel')].map((e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
    const g = await caja('.pedal-gas'), f = await caja('.pedal-freno');
    cumple(t.length >= 2 && !cruza(t[0], t[1]) && t.every((c) => !cruza(c, g) && !cruza(c, f) && c.left >= 0 && c.right <= 390), 'los carteles del tutorial van arriba de cada pedal, sin taparlos ni pisarse', t.map((c) => `${Math.round(c.left)}–${Math.round(c.right)}`).join(' / '));
  }
  /* los pedales: abajo, uno en cada esquina, grandes, y el toque cae sobre ellos */
  const g = await caja('.pedal-gas'), f = await caja('.pedal-freno');
  cumple(f.left < 40 && f.right < 195 && g.right > 350 && g.left > 195 && f.bottom > 844 * 0.85 && g.bottom > 844 * 0.85 && f.bottom < 844 - 20 && g.bottom < 844 - 20, 'freno abajo a la izquierda y gas abajo a la derecha, por encima de la rayita del iPhone', `freno ${Math.round(f.left)}–${Math.round(f.right)} × ${Math.round(f.top)}–${Math.round(f.bottom)} · gas ${Math.round(g.left)}–${Math.round(g.right)} × ${Math.round(g.top)}–${Math.round(g.bottom)}`);
  cumple(Math.min(f.height, g.height) >= 120 && Math.min(f.width, g.width) >= 90, 'los pedales son grandes para el pulgar', `freno ${Math.round(f.width)}×${Math.round(f.height)} · gas ${Math.round(g.width)}×${Math.round(g.height)} px`);
  const pg = await centro('.pedal-gas'), pf = await centro('.pedal-freno');
  const debajo = await pag.evaluate(([a, b]) => [document.elementFromPoint(...a)?.closest('.pedal')?.className || '', document.elementFromPoint(...b)?.closest('.pedal')?.className || ''], [pg, pf]);
  cumple(debajo[0].includes('gas') && debajo[1].includes('freno'), 'el dedo cae sobre cada pedal', debajo.join(' / '));
  /* HUD: cada pieza (los relojes uno por uno) */
  const hud = await pag.evaluate(() => ['#hud .nafta', '#hud .distancia', '#hud .derecha', '#hud .reloj:nth-child(1)', '#hud .reloj:nth-child(2)'].map((s) => { const r = document.querySelector('#hud ' + s.slice(5)).getBoundingClientRect(); return { s, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
  cumple(hud.every((c) => !cruza(c, g) && !cruza(c, f)), 'el HUD no pisa los pedales');
  cumple(hud.every((c) => c.left >= 0 && c.right <= 390 && c.top >= 0 && c.bottom <= 844 * 0.2), 'el HUD entra arriba, en el 20% de la pantalla', `hasta ${Math.round(Math.max(...hud.map((c) => c.bottom)))} px`);
  cumple(hud.every((c, i) => hud.every((d, j) => i === j || !cruza(c, d))), 'las piezas del HUD no se pisan entre ellas');
  /* a fondo con el dedo en el gas: el auto avanza, sigue en su lugar y no lo tapa nada */
  const x0 = await pag.evaluate(() => window.__r40.viaje.yo.x);
  await dedos('touchStart', [pg]);
  const muestras = [];
  for (let i = 0; i < 10; i++) { await pag.waitForTimeout(500); muestras.push(await pag.evaluate(AUTO)); if (i === 6) await foto('v06-manejando'); }
  const apretado = await pag.evaluate(() => document.querySelector('.pedal-gas').classList.contains('apretado'));
  const x1 = await pag.evaluate(() => window.__r40.viaje.yo.x);
  cumple(x1 - x0 > 2 && apretado, 'con el dedo en el gas el auto avanza', `${r1(x1 - x0)} m`);
  const peor = muestras.filter((a) => a.left < 0 || a.right > 390 || a.top < 0 || a.bottom > 844 || hud.some((c) => cruza(a, c)) || cruza(a, g) || cruza(a, f));
  cumple(!peor.length, 'el auto queda siempre en pantalla, sin HUD ni pedales encima', `x ${r1(Math.min(...muestras.map((a) => a.fx)) * 100)}–${r1(Math.max(...muestras.map((a) => a.fx)) * 100)}% · y ${r1(Math.min(...muestras.map((a) => a.fy)) * 100)}–${r1(Math.max(...muestras.map((a) => a.fy)) * 100)}%`);
  const ult = muestras[muestras.length - 1];
  cumple(ult.fx < 0.42 && ult.fy > 0.5 && ult.fy < 0.72, 'andando, el auto va en el tercio de abajo a la izquierda', `x ${r1(ult.fx * 100)}% · y ${r1(ult.fy * 100)}%`);
  cumple(Math.min(...muestras.map((a) => a.adelante)) >= 8 && ult.largo >= 80, 'se ve ruta adelante y el auto se lee', `adelante ${r1(ult.adelante)} m a ${r1(ult.vx * 3.6)} km/h · auto ${Math.round(ult.largo)} px de largo`);
  /* el segundo dedo en el freno, con el primero todavía en el gas; después solo el freno */
  await dedos('touchStart', [pg, pf]); await pag.waitForTimeout(500);
  const dos = await pag.evaluate(() => ['gas', 'freno'].map((n) => document.querySelector('.pedal-' + n).classList.contains('apretado')));
  await dedos('touchEnd', [pf]); await pag.waitForTimeout(100);
  const vxAntes = await pag.evaluate(() => window.__r40.viaje.yo.vx);
  await pag.waitForTimeout(1800);
  const vxDespues = await pag.evaluate(() => window.__r40.viaje.yo.vx);
  await dedos('touchEnd', []); await pag.waitForTimeout(300);
  const suelto = await pag.evaluate(() => ['gas', 'freno'].map((n) => document.querySelector('.pedal-' + n).classList.contains('apretado')));
  cumple(dos[0] && dos[1] && !suelto[0] && !suelto[1], 'los dos pedales a la vez, y al soltar se sueltan', `a la vez ${dos} · suelto ${suelto}`);
  cumple(vxDespues < vxAntes - 0.5, 'con el dedo en el freno el auto frena', `${r1(vxAntes * 3.6)} → ${r1(vxDespues * 3.6)} km/h`);
  /* la pausa (el PARE del HUD, con el dedo) */
  await tocar('#hud .botonPare');
  await esperar('#pausa'); await pag.waitForTimeout(700); await foto('v07-pausa');
  { const r = await pag.evaluate(REVISAR); cumple(!r.malos.length && r.ancho <= r.W, 'la pausa entra entera', r.malos.join(' | ')); }
  await tocar('#pausa .barraBotones button:nth-child(1)');
  /* el resultado y, desde ahí, la gomería */
  await pag.evaluate(() => window.__r40.terminar('nafta'));
  await esperar('#resultado'); await pag.waitForTimeout(2800); await foto('v08-resultado');
  { const r = await pag.evaluate(REVISAR); cumple(!r.malos.length && r.ancho <= r.W, 'el resultado entra entero', r.malos.join(' | ')); }
  await tocar('#resultado .botonesRes > div button:nth-child(1)');
  await esperar('#gomeria'); await pag.waitForTimeout(1300); await foto('v09-gomeria');
  { const r = await pag.evaluate(REVISAR); cumple(!r.malos.length && r.ancho <= r.W, 'la gomería entra entera', [...r.malos, ...r.desplaza].join(' | ')); }
  const antes = await pag.evaluate(() => window.__r40.P.mejoras.chata.motor);
  await tocar('#gomeria .mejora button'); await pag.waitForTimeout(500); await foto('v10-gomeria-mejora');
  cumple(await pag.evaluate(() => window.__r40.P.mejoras.chata.motor) === antes + 1, 'en la gomería se compra una mejora con el dedo');
  await tocar('#gomeria .flechas button:nth-child(2)'); await pag.waitForTimeout(900); await foto('v11-gomeria-fitito');
  await tocar('#gomeria .izq button');
  /* ajustes: la opción nueva, y el editor de controles con su lugar propio para parado */
  await esperar('#menu'); await tocar('#menu .botones button:nth-child(4)');
  await esperar('#ajustes'); await pag.waitForTimeout(800); await foto('v12-ajustes');
  cumple(await pag.evaluate(() => [...document.querySelectorAll('#ajustes .fila > span')].some((s) => s.textContent === 'Celular parado')), 'en Ajustes está "Celular parado"');
  await tocar('#ajustes .filaControles button');
  await esperar('#controles'); await pag.waitForTimeout(800); await foto('v13-controles');
  {
    const P0 = await pag.evaluate(() => JSON.parse(JSON.stringify(window.__r40.P.controles)));
    const [cx, cy] = await centro('.pedal-gas');
    await dedos('touchStart', [[cx, cy]]);
    for (let k = 1; k <= 6; k++) { await dedos('touchMove', [[cx - 8 * k, cy - 12 * k]]); await pag.waitForTimeout(40); }
    await dedos('touchEnd', []); await pag.waitForTimeout(300);
    const P1 = await pag.evaluate(() => ({ c: window.__r40.P.controles, guardado: JSON.parse(localStorage.getItem('ruta40:partida')).controles }));
    const dx = (P1.c.posV.gas.x - P0.posV.gas.x) * 390, dy = (P1.c.posV.gas.y - P0.posV.gas.y) * 844;
    cumple(Math.abs(dx + 48) < 4 && Math.abs(dy + 72) < 4 && JSON.stringify(P1.c.pos) === JSON.stringify(P0.pos) && P1.guardado.posV.gas.x === P1.c.posV.gas.x, 'arrastrar un pedal parado lo guarda en posV y no toca el lugar de acostado', `movido ${r1(dx)}, ${r1(dy)} px`);
    await foto('v14-controles-movido');
    await tocar('#controles .barraBotones button:nth-child(2)');
    cumple(await pag.evaluate(() => window.__r40.P.controles.posV.gas.x === 0.84), '"Como estaba" devuelve los pedales a su lugar');
    await tocar('#controles .barraBotones button:nth-child(3)');
  }
  /* la opción de seguir jugando girado */
  await esperar('#ajustes');
  await tocar('#ajustes button.opcion:has-text("Girar de costado")');
  await pag.waitForTimeout(600);
  {
    const gi = await pag.evaluate(() => ({ g: window.__r40.Pantalla.girado, v: window.__r40.Pantalla.vertical, t: document.getElementById('app').style.transform, W: window.__r40.Pantalla.W, H: window.__r40.Pantalla.H, dibV: window.__r40.dib.vertical, o: window.__r40.P.opciones.parado }));
    cumple(gi.g && !gi.v && /rotate\(90deg\)/.test(gi.t) && gi.W === 844 && gi.H === 390 && !gi.dibV && gi.o === 'girar', 'con "Girar de costado" se juega acostado como antes', gi.t);
    await foto('v15-girado');
    await tocar('#ajustes button.opcion:has-text("Vertical")');
    await pag.waitForTimeout(600);
    const ve = await pag.evaluate(() => ({ g: window.__r40.Pantalla.girado, v: window.__r40.Pantalla.vertical, t: document.getElementById('app').style.transform, o: JSON.parse(localStorage.getItem('ruta40:partida')).opciones.parado }));
    cumple(!ve.g && ve.v && !ve.t && ve.o === 'vertical', 'y con "Vertical" vuelve a parado (y queda guardado)');
  }
  /* las picadas y el semáforo */
  await tocar('#ajustes .barraBotones button');
  await esperar('#menu'); await tocar('#menu .botones button:nth-child(2)');
  await esperar('#mapa'); await tocar('#mapa .postal .acciones button:nth-child(2)');
  await esperar('#picadas'); await pag.waitForTimeout(800); await foto('v16-picadas');
  { const r = await pag.evaluate(REVISAR); cumple(!r.malos.length && r.ancho <= r.W, 'las picadas entran enteras', [...r.malos, ...r.desplaza].join(' | ')); }
  await tocar('#picadas .carrera button');
  await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
  await pag.waitForTimeout(1500); await foto('v17-semaforo');
  {
    const s = await caja('#hud .semaforo'), p = await caja('#hud .puesto'), a = await pag.evaluate(AUTO), r = await caja('#hud .reloj');
    cumple(s && p && !cruza(s, a) && !cruza(p, r) && s.left >= 0 && s.right <= 390, 'en la picada, el semáforo y el puesto no tapan el auto ni los relojes');
  }
  await ctx.close();
}

/* ======================================================================= 2. todas las pantallas en tres tamaños */
console.log('— nada cortado ni corrido de costado, en tres teléfonos y tres idiomas');
const PANTALLAS = ['idioma', 'menu', 'mapa', 'gomeria', 'ajustes', 'controles', 'picadas', 'historia', 'viaje', 'pausa', 'resultado'];
async function tamanio(w, h, idiomas) {
  const { ctx, pag, foto, esperar } = await abrir(w, h);
  const salida = [];
  await pag.evaluate(() => { const P = window.__r40.P; P.vista.intro = true; P.vista.tuto = true; P.monedas = 12345; for (const t of ['puna', 'quebrada', 'salinas', 'valles', 'cuyo', 'patagonia', 'glaciar']) P.abiertos[t] = true; P.record.puna = 2300; });
  for (const idi of idiomas) {
    await pag.evaluate((i) => window.__r40.idioma(i), idi);
    for (const p of PANTALLAS) {
      if (p === 'idioma') { await pag.waitForTimeout(900); }
      else if (p === 'menu') { await pag.evaluate(() => window.__r40.irMenu()); await pag.waitForTimeout(1200); }
      else if (p === 'mapa') { await pag.evaluate(() => window.__r40.irMapa()); await pag.waitForTimeout(900); }
      else if (p === 'gomeria') { await pag.evaluate(() => window.__r40.irGomeria()); await pag.waitForTimeout(1000); }
      else if (p === 'ajustes') { await pag.evaluate(() => window.__r40.irAjustes()); await pag.waitForTimeout(900); }
      else if (p === 'controles') { await pag.locator('#ajustes .filaControles button').tap(); await esperar('#controles'); await pag.waitForTimeout(800); }
      else if (p === 'picadas') { await pag.locator('#controles .barraBotones button:nth-child(3)').tap(); await pag.evaluate(() => window.__r40.irPicadas('puna')); await pag.waitForTimeout(900); }
      else if (p === 'historia') { await pag.evaluate(() => window.__r40.irMenu()); await pag.locator('#menu .botones button:nth-child(5)').tap(); await esperar('#historia'); await pag.waitForTimeout(1500); }
      else if (p === 'viaje') { await pag.evaluate(() => window.__r40.empezar({ tramo: 'quebrada', modo: 'viaje' })); await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 }); await pag.evaluate(() => window.__r40.viaje.mover(1200)); await pag.waitForTimeout(1200); }
      else if (p === 'pausa') { await pag.evaluate(() => window.__r40.alternarPausa()); await pag.waitForTimeout(800); }
      else if (p === 'resultado') { await pag.evaluate(() => { window.__r40.alternarPausa(); window.__r40.terminar('nafta'); }); await esperar('#resultado'); await pag.waitForTimeout(2600); }
      const r = await pag.evaluate(REVISAR);
      let hud = [];
      if (p === 'viaje') hud = await pag.evaluate(() => [...document.querySelectorAll('#hud .nafta, #hud .distancia, #hud .derecha, #hud .reloj, .pedal')].map((e) => { const q = e.getBoundingClientRect(); return q.left < -1 || q.right > innerWidth + 1 || q.top < -1 || q.bottom > innerHeight + 1 ? e.className : ''; }).filter(Boolean));
      salida.push({ p, idi, ...r, hud });
      if (idi === idiomas[0] && (w !== 390 || ['menu', 'mapa', 'gomeria', 'ajustes', 'viaje', 'resultado'].includes(p))) await foto(`t${w}x${h}-${p}`);
    }
  }
  await ctx.close();
  return { w, h, salida };
}

/* ======================================================================= 3. acostado y monitor: como antes */
/* las cajas de acostado medidas en el HTML de antes de este cambio (mismo Chromium, en inglés) */
const ANTES = {
  '844x390': { '#menu .marca': [29, 116, 255, 159], '#menu .botones': [633, 88, 182, 214], '#mapa .postal': [182, 267, 480, 117], '#mapa .camino': [0, 44, 844, 190], '#gomeria .panel': [540, 0, 304, 390], '#gomeria .plataVeh': [157, 11, 226, 102], '#gomeria .flechas': [0, 259, 540, 53], '#hud .nafta': [10, 9, 150, 31], '#hud .distancia': [328, 5, 189, 42], '#hud .relojes': [364, 328, 116, 54], '.pedal-gas': [709, 234, 101, 140], '.pedal-freno': [4, 242, 161, 140], '#resultado .causa': [252, 126, 107, 137], '#resultado .botonesRes': [384, 218, 208, 95] },
  '1280x720': { '#menu .marca': [53, 208, 470, 303], '#menu .botones': [890, 163, 337, 394], '#mapa .postal': [197, 492, 886, 217], '#mapa .camino': [0, 81, 1280, 351], '#gomeria .panel': [819, 0, 461, 720], '#gomeria .plataVeh': [201, 21, 418, 189], '#gomeria .flechas': [0, 478, 819, 98], '#hud .nafta': [19, 16, 276, 57], '#hud .distancia': [466, 9, 348, 76], '#hud .relojes': [533, 606, 214, 100], '#resultado .causa': [326, 233, 197, 253], '#resultado .botonesRes': [570, 404, 383, 175] },
};
async function acostado(w, h, tel) {
  const { ctx, pag, foto, caja, esperar } = await abrir(w, h, tel);
  const n = `${w}x${h}`, cajas = {};
  const medir = async (sels) => {
    await pag.evaluate(() => { for (const a of document.getAnimations()) { const t = a.effect && a.effect.getComputedTiming(); if (t && Number.isFinite(t.endTime)) a.finish(); } });
    for (const s of sels) { const r = await caja(s); cajas[s] = r ? [r.left, r.top, r.width, r.height].map(Math.round) : null; } };
  const pan = await pag.evaluate(() => ({ v: window.__r40.Pantalla.vertical, g: window.__r40.Pantalla.girado, t: document.getElementById('app').style.transform, u: getComputedStyle(document.documentElement).getPropertyValue('--u'), clase: document.documentElement.className }));
  await pag.evaluate(() => { const P = window.__r40.P; P.vista.intro = true; P.vista.tuto = true; P.monedas = 50000; });
  await pag.evaluate(() => window.__r40.irMenu()); await pag.waitForTimeout(1500); await foto(`a${n}-menu`); await medir(['#menu .marca', '#menu .botones']);
  await pag.evaluate(() => window.__r40.irMapa()); await pag.waitForTimeout(900); await medir(['#mapa .postal', '#mapa .camino']);
  await pag.evaluate(() => window.__r40.irGomeria()); await pag.waitForTimeout(1200); await medir(['#gomeria .panel', '#gomeria .plataVeh', '#gomeria .flechas']);
  await pag.evaluate(() => window.__r40.empezar({ tramo: 'puna', modo: 'viaje' }));
  await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
  await pag.waitForTimeout(500); await pag.evaluate(() => window.__r40.viaje.mover(1500)); await pag.waitForTimeout(1500);
  await foto(`a${n}-viaje`); await medir(['#hud .nafta', '#hud .distancia', '#hud .relojes', '.pedal-gas', '.pedal-freno']);
  const cam = await pag.evaluate(() => { const d = window.__r40.dib, v = window.__r40.viaje; return { formula: Math.abs(d.cam.esc - d.H / v.cam.alto) < 1e-9, parada: !!v.cam.parada, franja: d.franja === d.H, dibV: d.vertical, fx: d.sx(v.yo.x) / d.W, fy: d.sy(v.yo.y) / d.H }; });
  await pag.evaluate(() => window.__r40.terminar('nafta'));
  await esperar('#resultado'); await pag.waitForTimeout(2500); await medir(['#resultado .causa', '#resultado .botonesRes']);
  await ctx.close();
  const distintas = Object.entries(ANTES[n]).filter(([s, v]) => !cajas[s] || cajas[s].some((q, i) => Math.abs(q - v[i]) > 1)).map(([s, v]) => `${s} ${JSON.stringify(cajas[s])} (antes ${JSON.stringify(v)})`);
  return { n, pan, cam, distintas };
}

const tams = await Promise.all([tamanio(390, 844, ['es']), tamanio(360, 740, ['pt', 'es', 'en']), tamanio(412, 915, ['en'])]);
const acos = await Promise.all([acostado(844, 390, true), acostado(1280, 720, false)]);
for (const { w, h, salida } of tams) {
  const malas = salida.filter((s) => s.malos.length || s.ancho > s.W || s.hud.length);
  cumple(!malas.length, `${w}×${h}: ${salida.length} pantallas sin nada cortado ni desborde de costado`, malas.map((s) => `${s.p}/${s.idi}: ${[...s.malos, ...s.hud].join(', ')}${s.ancho > s.W ? ` ancho ${s.ancho}` : ''}`).join(' | '));
  const desp = [...new Set(salida.filter((s) => s.desplaza.length).map((s) => `${s.p}/${s.idi}`))];
  if (desp.length) console.log(`     (se desplazan adentro de su caja: ${desp.join(', ')})`);
}
for (const { n, pan, cam, distintas } of acos) {
  cumple(!pan.v && !pan.g && !pan.t && !/vertical/.test(pan.clase), `${n}: acostado sigue acostado, sin giro ni clase vertical`, `u = ${pan.u}`);
  cumple(cam.formula && !cam.parada && cam.franja && !cam.dibV && cam.fx > 0.4 && cam.fx < 0.6, `${n}: la cámara y los fondos son los de siempre (auto al medio)`, `auto en x ${r1(cam.fx * 100)}% · y ${r1(cam.fy * 100)}%`);
  cumple(!distintas.length, `${n}: menú, mapa, gomería, HUD, pedales y resultado miden lo mismo que antes`, distintas.join(' | '));
}

/* ======================================================================= 4. rendimiento: parado contra acostado */
console.log('— rendimiento (lo que tarda en dibujarse un cuadro, en SwiftShader)');
{
  const ms = {};
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const { ctx, pag } = await abrir(w, h);
    await pag.evaluate(() => { window.__r40.P.vista.tuto = true; window.__r40.empezar({ tramo: 'glaciar', modo: 'viaje' }); });
    await pag.waitForFunction(() => window.__r40.estado === 'viaje', null, { timeout: 30000 });
    await pag.evaluate(() => window.__r40.viaje.mover(1500)); await pag.waitForTimeout(1500);
    ms[`${w}x${h}`] = await pag.evaluate(() => {
      const d = window.__r40.dib, v = window.__r40.viaje, t = [];
      for (let i = 0; i < 10; i++) d.cuadro(v.estado, 1 / 60);
      d.x.getImageData(0, 0, 1, 1);
      for (let k = 0; k < 9; k++) { const t0 = performance.now(); for (let i = 0; i < 20; i++) d.cuadro(v.estado, 1 / 60); d.x.getImageData(0, 0, 1, 1); t.push((performance.now() - t0) / 20); }
      return t.sort((a, b) => a - b)[4];
    });
    await ctx.close();
  }
  cumple(ms['390x844'] <= ms['844x390'] * 1.25, 'parado se dibuja tan rápido como acostado (los mismos píxeles)', `parado ${r1(ms['390x844'])} ms · acostado ${r1(ms['844x390'])} ms por cuadro`);
}

console.log('errores de la consola:', errores.length ? errores : 'ninguno');
cumple(!errores.length, 'sin errores en la consola');
await nav.close();
console.log(fallas.length ? `\nNO SE CUMPLE (${fallas.length}): ${fallas.join(' · ')}` : '\nTodo se cumple. Capturas en ' + OUT);
process.exit(fallas.length ? 1 : 0);
