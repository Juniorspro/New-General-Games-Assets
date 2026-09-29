// LOS ARREGLOS DE MENÚS Y MINIJUEGOS (vuelta 48), medidos como en el recorrido (pruebas/salida/recorrido/): en el
// celu acostado (844 × 390, con dedos) y en la compu (1280 × 720).
// - el menú principal entra entero (los canales arriba de la barra, "▶ Jugar" sin aplastar) y el Probador en su tarjeta;
// - el 💎 de arriba se toca y abre la tienda; la tienda entra sin desplazar; el consejo no tapa el 💎;
// - Pausa › Controles › "Mover y agrandar": nada tapa los botones de dedo;
// - el modo foto dice qué hacer (se ve), los gestos entran enteros, el título de "Mi casa" se lee;
// - las mesas: tocar donde se ve la columna 0 y la 6 del Cuatro en línea pone en esas; el cartel no es "accion_mesa";
// - los resultados del parkour, el tiro y el runner entran sin desplazar; las miniaturas de los niveles, enteras;
// - en la compu, el 💎 del probador no se sale.
//     node pruebas/arreglos.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const nav = await navegador();
/* (las animaciones de CSS no avanzan sin cuadros: se terminan antes de medir) */
const terminar = (pag) => pag.evaluate(() => document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); } catch { /* nada */ } }));
const caja = (pag, sel) => pag.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, d: r.right, a: r.bottom, w: r.width, h: r.height }; }, sel);

/* ------------------------------------------------ el menú principal (celu acostado) */
const M = await abrir(nav, 'calidad=baja', { ancho: 844, alto: 390, movil: true });
await M.pag.waitForFunction(() => window.__A && window.__A.UI && window.__A.UI.J, null, { timeout: 90000, polling: 200 });
await M.pag.evaluate(() => { const { UI, G } = window.__A; G.idioma ||= 'es'; UI.menu(); });
await M.pag.waitForTimeout(300); await terminar(M.pag);
const menu = await M.pag.evaluate(() => {
  const r = (s) => document.querySelector(s)?.getBoundingClientRect();
  const canales = r('.canales'), barra = r('.barra-abajo .reloj'), jugar = r('[data-a=jugar]'), tarjeta = r('.canal[data-c=probador]'), vista = r('.canal[data-c=probador] .vista');
  const nombres = [...document.querySelectorAll('.canal .nombre')].map((n) => n.getBoundingClientRect().bottom);
  return { fondo: Math.round(canales.bottom), reloj: Math.round(barra.top), jugar: Math.round(jugar.height), vistaW: Math.round(vista.width), tarjW: Math.round(tarjeta.width), nombres: Math.round(Math.max(...nombres)), H: innerHeight };
});
prueba('menú: los canales y sus nombres entran arriba de la hora de abajo', menu.fondo <= menu.reloj && menu.nombres <= menu.H, JSON.stringify(menu));
prueba('menú: "▶ Jugar" sin aplastar (al menos 40 px de alto)', menu.jugar >= 40, `${menu.jugar} px`);
prueba('menú: el dibujo del Probador queda adentro de su tarjeta', menu.vistaW <= menu.tarjW + 1, `${menu.vistaW} ≤ ${menu.tarjW}`);
await M.pag.evaluate(() => document.querySelector('.canal[data-c=casa]').click());
await M.pag.waitForTimeout(600); await terminar(M.pag);
const tit = await M.pag.evaluate(() => { const e = document.querySelector('.titulo-canal'); return e ? getComputedStyle(e).backgroundColor : ''; });
prueba('"Mi casa": el título tiene su fondo (se lee sobre blanco)', /rgba\(10, 60, 110/.test(tit), tit);
await M.pag.screenshot({ path: path.join(SAL, 'arreglos-menu.png') });
await M.ctx.close();

/* ------------------------------------------------ el juego (celu acostado) */
const A = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Ana', { ancho: 844, alto: 390, movil: true });
await A.pag.waitForFunction(() => window.__A && window.__A.yo && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await avanzar(A.pag, 3, 1 / 30, false); await terminar(A.pag);
const cdp = await A.ctx.newCDPSession(A.pag);
const dedo = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await A.pag.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await A.pag.waitForTimeout(150); };
/* el 💎 con un dedo de verdad */
const joya = await caja(A.pag, '.hud [data-a=joyas]');
await dedo(joya.x + joya.w / 2, joya.y + joya.h / 2);
const tienda = await A.pag.evaluate(() => { const v = window.__A.UI.ventanaAbierta; return v ? { titulo: v.querySelector('h2')?.textContent, cuerpo: v.querySelector('.cuerpo') } && { titulo: v.querySelector('h2')?.textContent, sobra: v.querySelector('.cuerpo').scrollHeight - v.querySelector('.cuerpo').clientHeight, fondo: Math.max(...[...v.querySelectorAll('.tj-paquete')].map((b) => b.getBoundingClientRect().bottom)), H: innerHeight } : null; });
prueba('el 💎 de arriba se toca con el dedo y abre la tienda', !!tienda && /joyas|Joyas|💎/i.test(tienda.titulo || ''), JSON.stringify(tienda?.titulo));
prueba('la tienda de joyas entra sin desplazar (los "Comprar" a la vista)', tienda && tienda.sobra <= 2 && tienda.fondo <= tienda.H, JSON.stringify(tienda));
await A.pag.evaluate(() => { const { UI, J } = window.__A; UI.cerrarVentana(); J.pausar(false, true); });
/* el consejo no tapa el 💎 */
await A.pag.evaluate(() => window.__A.UI.tuto('Movete con la palanca de la izquierda'));
const tu = await caja(A.pag, '.hud .tuto'), jo = await caja(A.pag, '.hud [data-a=joyas]');
prueba('el consejo de los primeros pasos no tapa el 💎', tu && jo && (tu.y >= jo.a || tu.a <= jo.y || tu.x >= jo.d || tu.d <= jo.x), JSON.stringify({ tu, jo }));
await A.pag.evaluate(() => window.__A.UI.tuto(null));
/* Pausa › Controles › Mover y agrandar */
await A.pag.evaluate(async () => {
  const { UI, J } = window.__A; J.pausar(true); await new Promise((r) => setTimeout(r, 100));
  document.querySelector('.pausa-menu [data-a=controles]').click(); await new Promise((r) => setTimeout(r, 100));
  const b = [...document.querySelectorAll('.ventana button')].find((q) => /Mover y agrandar/.test(q.textContent)); b?.click();
});
await A.pag.waitForTimeout(200); await terminar(A.pag);
const ed = await A.pag.evaluate(() => {
  const bs = [...document.querySelectorAll('#dedos .dedo-boton')].filter((b) => b.offsetParent);
  const tapados = bs.filter((b) => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !b.contains(e); }).map((b) => b.dataset.b);
  return { editor: !!document.querySelector('.editor-dedos'), velo: !!document.querySelector('.velo'), botones: bs.length, tapados };
});
prueba('Pausa › Controles › "Mover y agrandar": el editor sin la pausa encima, y ningún botón tapado', ed.editor && !ed.velo && ed.botones >= 5 && !ed.tapados.length, JSON.stringify(ed));
await A.pag.evaluate(() => { [...document.querySelectorAll('.editor-dedos button')].find((b) => /Listo/.test(b.textContent))?.click(); });
await A.pag.waitForTimeout(150);
await A.pag.evaluate(() => { const { UI, J } = window.__A; UI.cerrarVentana(); J.pausar(false, true); });
/* el modo foto */
await A.pag.evaluate(() => window.__A.J.hotbar(4));
await A.pag.waitForTimeout(350); await terminar(A.pag);
const foto = await A.pag.evaluate(() => { const e = document.querySelector('.foto-ayuda'); if (!e) return null; let o = 1; for (let q = e; q; q = q.parentElement) o *= +getComputedStyle(q).opacity; return { texto: e.textContent, o, pe: getComputedStyle(e).pointerEvents }; });
prueba('modo foto: el cartel se ve y dice tocar la pantalla (en el celu no habla de la V)', foto && foto.o > 0.9 && /tocá la pantalla/.test(foto.texto) && !/\bV\b/.test(foto.texto), JSON.stringify(foto));
await dedo(420, 200); await A.pag.waitForTimeout(300);
prueba('y al sacarla, el cartel se va', await A.pag.evaluate(() => !document.querySelector('.foto-ayuda')));
/* los gestos */
await A.pag.evaluate(() => window.__A.J.hotbar(2)); await A.pag.waitForTimeout(150); await terminar(A.pag);
const ge = await A.pag.evaluate(() => [...document.querySelectorAll('.gestos .boton')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
prueba('gestos: todos los nombres enteros', !ge.length, ge.join(', '));
await A.pag.evaluate(() => { const { UI, J } = window.__A; UI.cerrarVentana(); J.pausar(false, true); });
/* los resultados en el celu acostado */
const cabe = (quien) => A.pag.evaluate(async (quien) => {
  const { UI } = window.__A, nada = () => {};
  if (quien === 'runner') UI.resultadoRunner({ ok: true, tiempo: 54.3, sobra: 8.7, caidas: 1, golpes: 2, premio: 30, estrellas: 3, record: true, pct: 100 }, nada, nada);
  if (quien === 'parkour') UI.resultadoParkour({ nivel: 0, tiempo: 41.2, caidas: 2, premio: 25, estrellas: 2, record: true, hay: true }, nada, nada, nada);
  if (quien === 'tiro') UI.resultadoTiro({ puntos: 420, aciertos: 14, tiros: 18, premio: 20, estrellas: 3, record: true }, nada, nada);
  await new Promise((r) => setTimeout(r, 60));
  document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); } catch { /* nada */ } });
  const v = UI.ventanaAbierta, c = v.querySelector('.cuerpo'), bs = [...v.querySelectorAll('.pk-resultado button')].map((b) => b.getBoundingClientRect().bottom);
  const r = { sobra: c.scrollHeight - c.clientHeight, fondo: Math.round(Math.max(...bs)), H: innerHeight, botones: bs.length };
  UI.cerrarVentana(true); return r;
}, quien);
for (const q of ['parkour', 'tiro', 'runner']) { const r = await cabe(q); prueba(`el resultado del ${q} entra sin desplazar, con todos sus botones a la vista`, r.sobra <= 2 && r.fondo <= r.H, JSON.stringify(r)); }
/* las mesas: Cuatro en línea, tocando donde se ve cada columna */
await A.pag.evaluate(async () => { await window.__A.viajar('juegos'); });
await avanzar(A.pag, 20, 1 / 30, false);
const i = await A.pag.evaluate(() => { const Ms = window.__A.reino.mesas, M = Ms.lista.find((q) => q.juego === 'cuatro'); window.__A.interactuar({ accion: 'mesa', mesa: M.i, silla: 0 }); return M.i; });
await avanzar(A.pag, 10, 1 / 30, false); await A.pag.waitForTimeout(1200); await avanzar(A.pag, 2, 1 / 30, false); await terminar(A.pag);
const T = await A.pag.evaluate(() => { const c = document.querySelector('.panel-mesa canvas'), r = c.getBoundingClientRect(), l = Math.min(r.width, r.height); return { x: r.left + (r.width - l) / 2, y: r.top + (r.height - l) / 2, l }; });
const S = () => A.pag.evaluate((i) => { const M = window.__A.reino.mesas.lista[i]; return JSON.parse(JSON.stringify({ turno: M.S.turno, b: M.S.b || M.S.c })); }, i);
const cols = [];
for (const k of [0, 6]) {
  for (let n = 0; n < 6 && (await S()).turno !== 0; n++) await avanzar(A.pag, 40, 1 / 30, false);
  const a = await S(), m = 0.06, cw = (1 - 2 * m) / 7;
  await dedo(T.x + (m + (k + 0.5) * cw) * T.l, T.y + T.l * 0.5); await avanzar(A.pag, 2, 1 / 30, false);
  const d = await S(); cols.push(d.b.map((v, j) => (v !== a.b[j] ? j % 7 : -1)).filter((j) => j >= 0)[0]);
  await avanzar(A.pag, 40, 1 / 30, false);
}
prueba('Cuatro en línea: tocar donde se ve la columna 0 y la 6 pone en la 0 y en la 6', cols[0] === 0 && cols[1] === 6, JSON.stringify(cols));
await A.pag.evaluate(() => document.querySelector('.panel-mesa [data-a=levantarse]')?.click());
prueba('el cartel de las mesas dice qué hacer (no "accion_mesa")', await A.pag.evaluate(() => { const t = window.__A.textos.t; return t('accion_mesa') !== 'accion_mesa'; }));
/* las miniaturas de los niveles de parkour, enteras */
const mini = await A.pag.evaluate(async () => {
  const { UI, G } = window.__A; UI.menuParkour(G.parkour || {}, () => {}, () => {}, () => {}); await new Promise((r) => setTimeout(r, 80));
  const im = [...document.querySelectorAll('.pk-carta img')].map((q) => { const r = q.getBoundingClientRect(); return +(r.width / r.height).toFixed(2); });
  UI.cerrarVentana(true); return im;
});
prueba('las miniaturas de los niveles de parkour se ven enteras (16:10, como se dibujan)', mini.length > 3 && mini.every((q) => Math.abs(q - 1.6) < 0.05), JSON.stringify(mini.slice(0, 4)));
await A.ctx.close();

/* ------------------------------------------------ en la compu: el probador */
const C = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Carla', { ancho: 1280, alto: 720 });
await C.pag.waitForFunction(() => window.__A && window.__A.yo && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await C.pag.evaluate(() => window.__A.J.abrirProbador()); await C.pag.waitForTimeout(400); await terminar(C.pag);
const pr = await C.pag.evaluate(() => { const s = [...document.querySelectorAll('.probador:not(.vista) .saldos .pildora, .probador:not(.vista) .saldos button')].map((q) => q.getBoundingClientRect().right); return { derecha: Math.round(Math.max(...s)), W: innerWidth }; });
prueba('en la compu, el 💎 del probador no se sale por la derecha', pr.derecha <= pr.W, JSON.stringify(pr));
const errs = [M, A, C].flatMap((x) => x.errores).filter((e) => !/ERR_|net::|WebSocket/.test(e));
prueba('sin errores en las páginas', !errs.length, errs.slice(0, 3).join(' | '));
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
