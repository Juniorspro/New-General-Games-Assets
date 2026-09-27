// LAS LENTES DEL VISOR (js/lentes.js): con SBS cada ojo se dibuja a su lienzo y la lente lo lleva a la
// pantalla con el barril (lo que deshace el almohadón de la lupa), corrido al centro de su lente.
// - el menú del VR tiene "Lentes del visor": perfiles (sin lentes, Cardboard 1 y 2, genérico) y los ajustes,
//   con la vista previa; lo elegido queda guardado;
// - con lentes, afuera del borde de la lente queda negro y el centro se ve; la curva es de barril (una recta
//   de la escena, cerca del borde, cae más adentro que sin lentes);
// - sin lentes ("plano") se dibuja como siempre, sin el pase de más, y con el mismo brillo en el centro (vuelta 33:
//   el pase escribía el color lineal y con lentes todo salía oscuro);
// - adentro del VR, el menú de la palma abre el panel: − y + ajustan en el momento, ◀ ▶ cambian de perfil;
// - la curva y su inversa cierran (ida y vuelta, menos de 1e-5).
//     node pruebas/lentes.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);

/* 1) el menú */
const rm = await pag.evaluate(async () => {
  const { UI } = window.__A; UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.vr-lentes-boton').click(); await new Promise((r) => setTimeout(r, 80));
  const perfiles = Array.from(document.querySelectorAll('.le-perfil')).map((b) => b.dataset.p), ajustes = document.querySelectorAll('.le-ajuste input').length;
  document.querySelector('.le-perfil[data-p="cardboard2"]').click();
  const g1 = JSON.parse(localStorage.getItem('aeroplaza.lentes')).tipo;
  const k1 = document.querySelector('.le-ajuste input[data-k="k1"]'); k1.value = '0.5'; k1.dispatchEvent(new Event('input'));
  const g2 = JSON.parse(localStorage.getItem('aeroplaza.lentes'));
  /* (la vista previa: que tenga dibujo en las dos mitades) */
  const cv = document.querySelector('.le-vista'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let izq = 0, der = 0; for (let y = 0; y < cv.height; y += 4) for (let x = 0; x < cv.width; x += 4) { const i = (y * cv.width + x) * 4, s = d[i] + d[i + 1] + d[i + 2]; if (s > 200) { if (x < cv.width / 2) izq++; else der++; } }
  return { perfiles, ajustes, g1, g2: { tipo: g2.tipo, k1: g2.P.k1 }, izq, der };
});
prueba('el menú del VR abre las lentes: cinco perfiles y siete ajustes', rm.perfiles.join() === 'plano,cardboard1,cardboard2,generico,propio' && rm.ajustes === 7, rm.perfiles.join());
prueba('elegir un perfil queda guardado; mover un ajuste pasa a "a mi gusto"', rm.g1 === 'cardboard2' && rm.g2.tipo === 'propio' && Math.abs(rm.g2.k1 - 0.5) < 1e-6, JSON.stringify(rm.g2));
prueba('la vista previa dibuja las dos lentes', rm.izq > 300 && rm.der > 300, `${rm.izq} · ${rm.der}`);
await pag.screenshot({ path: path.join(SAL, 'lentes-menu.png') });

/* 3) al VR con visor: con lentes, afuera del borde negro y el centro se ve */
await pag.evaluate(async () => { window.__A.UI.cerrarVentana(); window.__A.J.lentes.poner('cardboard2'); await window.__A.J.entrarVR(true, false); });
await avanzar(pag, 6, 1 / 30, true);
const px = await pag.evaluate(() => {
  /* (se dibuja y se lee en el mismo paso: después la pantalla ya se borró) */
  const A = window.__A, r = A.motor.r, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, p = new Uint8Array(4); A.paso(1 / 30, true);
  const leer = (x, y) => { gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return p[0] + p[1] + p[2]; };
  return { lentes: !!A.vr.dib.lentes, esquina: leer(3, 3), centroI: leer(W / 4, H / 2), centroD: leer(W * 3 / 4, H / 2), T: +A.vr.lentes.T.toFixed(2), lado: A.vr.lentes.lado };
});
prueba('con visor y lentes, cada ojo pasa por la lente (su lienzo cuadrado y el campo que pide)', px.lentes && px.T > 1 && px.lado >= 64, JSON.stringify(px));
prueba('afuera del borde de la lente queda negro; el centro de cada ojo se ve', px.esquina < 10 && px.centroI > 30 && px.centroD > 30, `esquina ${px.esquina} · centros ${px.centroI}, ${px.centroD}`);
await pag.screenshot({ path: path.join(SAL, 'lentes-vr.png') });
/* el punto del centro va al centro de cada lente y la sigue al cambiar la separación y la altura */
const dp = await pag.evaluate(() => {
  const A = window.__A, L = A.J.lentes, el = A.vr.el, h = el.clientHeight / 2;
  const donde = () => Array.from(el.querySelectorAll('.vr-punto')).map((p) => { const r = p.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  A.paso(1 / 30, true); const a = donde();
  for (let i = 0; i < 10; i++) { L.ajustar('separacion', 1); L.ajustar('alto', 1); }
  A.paso(1 / 30, true); const b = donde();
  for (let i = 0; i < 10; i++) { L.ajustar('separacion', -1); L.ajustar('alto', -1); }
  A.paso(1 / 30, true);
  return { h, dx: b.map((p, i) => +(p[0] - a[i][0]).toFixed(1)), dy: b.map((p, i) => +(p[1] - a[i][1]).toFixed(1)) };
});
prueba('el punto del centro sigue a cada lente (separación y altura +0,1)', Math.abs(dp.dx[0] + 0.1 * dp.h) < 1.5 && Math.abs(dp.dx[1] - 0.1 * dp.h) < 1.5 && dp.dy.every((y) => Math.abs(y + 0.1 * dp.h) < 1.5), `x ${dp.dx.join(', ')} · y ${dp.dy.join(', ')} (tenía que ∓${(0.1 * dp.h).toFixed(1)} y −${(0.1 * dp.h).toFixed(1)})`);
/* la grilla de prueba se ve (amarilla) */
await pag.evaluate(() => { window.__A.J.lentes.grilla = true; });
await avanzar(pag, 2, 1 / 30, true);
const amarillo = await pag.evaluate(() => {
  const gl = window.__A.motor.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, d = new Uint8Array(W * H * 4); window.__A.paso(1 / 30, true); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d);
  let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 180 && d[i + 1] > 150 && d[i + 2] < 120) n++; return n;
});
prueba('la grilla de prueba se dibuja encima', amarillo > 500, `${amarillo} píxeles amarillos`);
await pag.screenshot({ path: path.join(SAL, 'lentes-grilla.png') });
await pag.evaluate(() => { window.__A.J.lentes.grilla = false; });

/* 4) el panel adentro del VR: − y + ajustan, ◀ ▶ cambian de perfil, listo cierra */
const rp = await pag.evaluate(() => {
  const A = window.__A, W = A.ventanasMundo, L = A.J.lentes;
  A.J.abrirLentesVR(); const hay = !!W.pantalla && W.pantalla.L === L;
  const k0 = L.P.k1; W.alAccion('lente:k1:1'); W.alAccion('lente:k1:1'); const k1 = L.P.k1;
  const t0 = L.tipo; W.alAccion('lente:perfil:1'); const t1 = L.tipo;
  W.alAccion('lente:listo');
  return { hay, k0, k1, t0, t1, cerrado: !W.pantalla };
});
prueba('el menú de la palma abre el panel de las lentes', rp.hay);
prueba('en el panel, + sube la curva de a 0,02 (y pasa a "a mi gusto")', Math.abs(rp.k1 - rp.k0 - 0.04) < 1e-6 && rp.t0 === 'propio', `${rp.k0} → ${rp.k1}`);
prueba('◀ ▶ cambian de perfil y "Listo" cierra el panel', rp.t1 !== rp.t0 && rp.cerrado, `${rp.t0} → ${rp.t1}`);

/* 5) sin lentes: el dibujo de siempre (sin el pase), la esquina con el mundo */
await pag.evaluate(() => window.__A.J.lentes.poner('plano'));
await avanzar(pag, 3, 1 / 30, true);
const pp = await pag.evaluate(() => { const A = window.__A, gl = A.motor.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, p = new Uint8Array(4); A.paso(1 / 30, true); const leer = (x, y) => { gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return p[0] + p[1] + p[2]; }; return { lentes: !!A.vr.dib.lentes, esquina: leer(3, 3), centroI: leer(W / 4, H / 2), centroD: leer(W * 3 / 4, H / 2) }; });
prueba('sin lentes se dibuja como siempre (sin el pase de la lente)', !pp.lentes && pp.esquina > 20, JSON.stringify(pp));
/* (el mismo momento, con y sin lentes: dos cuadros de cada uno, seguidos) */
const br = await pag.evaluate(() => {
  const A = window.__A, L = A.J.lentes, gl = A.motor.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, d = new Uint8Array(4);
  const centro = () => { let s = 0; for (const x of [W / 4, W * 3 / 4]) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { gl.readPixels(Math.floor(x) + i * 2, Math.floor(H / 2) + j * 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, d); s += d[0] + d[1] + d[2]; } return Math.round(s / 50); };
  const r = {};
  for (const tipo of ['cardboard2', 'plano', 'cardboard2']) { L.poner(tipo); A.paso(1 / 240, true); A.paso(1 / 240, true); r[tipo] = [...(r[tipo] || []), centro()]; }
  L.poner('plano'); return r;
});
const con = (br.cardboard2[0] + br.cardboard2[1]) / 2;
prueba('con y sin lentes, el centro de cada ojo tiene el mismo brillo (el mismo momento)', Math.abs(br.plano[0] - con) < Math.max(25, con * 0.12), `con ${br.cardboard2.join(', ')} · sin ${br.plano[0]}`);

/* 6) la curva: barril (lo de afuera cae más adentro) y la inversa cierra */
const rv = await pag.evaluate(() => {
  const L = window.__A.J.lentes; L.poner('cardboard2');
  const { curva, inversa } = window.__A.lentesMod;
  let peor = 0; for (let r = 0; r <= 1.5; r += 0.05) peor = Math.max(peor, Math.abs(inversa(L.P, curva(L.P, r)) - r));
  /* (una dirección de tan 1: sin lentes cae a 1/escala; con lentes, más adentro) */
  return { peor, conL: inversa(L.P, 1), sinL: 1 / L.P.escala };
});
prueba('la curva es de barril y la inversa cierra', rv.peor < 1e-5 && rv.conL < rv.sinL * 0.85, `ida y vuelta ${rv.peor.toExponential(1)} · tan 1 cae a ${rv.conL.toFixed(3)} (sin lentes ${rv.sinL.toFixed(3)})`);
await pag.evaluate(() => window.__A.J.salirVR());
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
