// LOS BOTONES GUARDADOS EN EL CELU (vuelta 48): ui.js › aplicarHud, celu.js › ajustes y las apps nuevas.
// - de entrada, en la pantalla quedan 📱, 💬 y ☰ (voz, misiones, estilo y la barra 1-5, en el celu);
// - 📱 › Ajustes prende y apaga cada uno (y se guarda);
// - las apps nuevas abren lo mismo que los botones de antes (gestos, música, mapa, estilo) y la voz se ve prendida;
// - el celu va parado también en el celu acostado (844 × 390) y entra entero.
//     node pruebas/botones.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const nav = await navegador();
const A = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Ana', { ancho: 844, alto: 390, movil: true });
await A.pag.waitForFunction(() => window.__A && window.__A.yo && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await avanzar(A.pag, 1);
const vis = () => A.pag.evaluate(() => { const h = document.querySelector('.hud'), v = (s) => { const e = h.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }; return { celu: v('[data-a=celu]'), chat: v('[data-a=chat]'), pausa: v('[data-a=pausa]'), voz: v('[data-a=voz]'), misiones: v('[data-a=misiones]'), estilo: v('[data-a=estilo]'), barra: v('.hotbar') }; });
const v0 = await vis();
prueba('de entrada en la pantalla: 📱, 💬 y ☰ (lo demás, en el celu)', v0.celu && v0.chat && v0.pausa && !v0.voz && !v0.misiones && !v0.estilo && !v0.barra, JSON.stringify(v0));
await A.pag.evaluate(() => { window.__A.J.celu.abrir('ajustes'); });
await A.pag.evaluate(() => { document.querySelector('[data-hud=barra]').click(); document.querySelector('[data-hud=estilo]').click(); document.querySelector('[data-hud=chat]').click(); });
const v1 = await vis(), g1 = await A.pag.evaluate(() => window.__A.G.opciones.hud);
prueba('📱 › Ajustes: la barra y el estilo a la pantalla, el chat al celu (y se guarda)', v1.barra && v1.estilo && !v1.chat && g1.barra === true && g1.estilo === true && g1.chat === false, JSON.stringify({ v1, g1 }));
await A.pag.evaluate(() => { document.querySelector('[data-hud=barra]').click(); document.querySelector('[data-hud=estilo]').click(); document.querySelector('[data-hud=chat]').click(); });
const v2 = await vis();
prueba('y de vuelta', !v2.barra && !v2.estilo && v2.chat, JSON.stringify(v2));
/* las apps nuevas abren lo mismo que los botones de antes */
const app = (a) => A.pag.evaluate(async (a) => {
  const { J, UI } = window.__A; UI.cerrarVentana(); J.pausar(false, true); J.celu.abrir('inicio');
  document.querySelector(`.ventana.celu [data-app="${a}"]`).click(); await new Promise((r) => setTimeout(r, 150));
  return { titulo: UI.ventanaAbierta?.querySelector('.cabeza h2')?.textContent || '', celu: J.celu.abierto };
}, a);
const [ge, mu, ma, es] = [await app('gestos'), await app('musica'), await app('mapa'), await app('estilo')];
prueba('Gestos, Música, Mapa y Estilo abren sus ventanas', !ge.celu && /Gestos/i.test(ge.titulo) && /Música|Discos|Musica/i.test(mu.titulo) && /Mapa/i.test(ma.titulo) && /Estilo/i.test(es.titulo), JSON.stringify([ge, mu, ma, es].map((q) => q.titulo)));
await A.pag.evaluate(() => { const { J, UI } = window.__A; UI.cerrarVentana(); J.pausar(false, true); });
/* la voz: con el micrófono de mentira del navegador de prueba, se prende desde el celu y se ve (en el HUD y en la app) */
await A.pag.evaluate(async () => { const { J } = window.__A; J.celu.abrir('inicio'); document.querySelector('.ventana.celu [data-app="voz"]').click(); await new Promise((r) => setTimeout(r, 1500)); J.celu.refrescar(); });
const voz = await A.pag.evaluate(() => ({ activa: window.__A.voz.activa, hud: getComputedStyle(document.querySelector('.hud [data-a=voz]')).display !== 'none', punto: !!document.querySelector('.ventana.celu [data-app="voz"] .cel-badge.vivo'), celu: window.__A.J.celu.abierto }));
prueba('🎤 Voz desde el celu: se prende sin cerrarlo, el botón aparece en la pantalla y la app tiene el punto rojo', voz.activa && voz.hud && voz.punto && voz.celu, JSON.stringify(voz));
await A.pag.evaluate(() => window.__A.J.alternarVoz());
await A.pag.waitForTimeout(300);
const voz2 = await A.pag.evaluate(() => getComputedStyle(document.querySelector('.hud [data-a=voz]')).display !== 'none');
prueba('y al apagarla se vuelve a guardar', !voz2);
/* el celu parado, en el celu acostado */
const cabe = await A.pag.evaluate(() => { const r = document.querySelector('.ventana.celu').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), d: Math.round(r.right), a: Math.round(r.bottom) }; });
prueba('el celu va parado (más alto que ancho) y entra entero en 844 × 390', cabe.h > cabe.w * 1.4 && cabe.x >= 0 && cabe.y >= 0 && cabe.d <= 844 && cabe.a <= 390, JSON.stringify(cabe));
await A.pag.waitForTimeout(500); await avanzar(A.pag, 1);
await A.pag.screenshot({ path: path.join(SAL, 'botones-celu.png') });
const errs = A.errores.filter((e) => !/ERR_|net::|WebSocket/.test(e));
prueba('sin errores en la página', !errs.length, errs.slice(0, 3).join(' | '));
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
