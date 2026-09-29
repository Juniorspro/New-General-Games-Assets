// LA CASA Y SU CONSTRUCCIÓN (vuelta 48): casa.js, casa-piezas.js, ui.js › obra, main.js › empezarConstruir.
// - el living de arranque, y construir desde el celu (la cámara de arriba, el panel, los dedos escondidos);
// - todas las piezas de las tres pestañas se ponen, con su nombre en los tres idiomas y sin errores;
// - un toque en la pantalla pone en el piso que se tocó; mover, pintar, quitar, girar y deshacer;
// - arriba de una tarima queda arriba; la puerta se atraviesa por el medio y la escalera sube de a escalones;
// - hasta 200 cosas; "Listo" vuelve a la cámara de siempre y lo guarda (fundido: pocas mallas);
// - lo que llega por la red de la casa de otro se limpia (colores y alturas raras, no);
// - las fotos: construyendo en el celu acostado y en la compu, y la casa terminada.
//     node pruebas/casa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, avanzar, SAL, AQUI } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const nav = await navegador();
const A = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Ana&reino=casa', { ancho: 844, alto: 390, movil: true });
const avisos = []; A.pag.on('console', (m) => { if (/falta el texto/.test(m.text())) avisos.push(m.text()); });
await A.pag.waitForFunction(() => window.__A && window.__A.yo && window.__A.reino?.id === 'casa' && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await avanzar(A.pag, 1);

/* 1) el living de arranque y construir desde el celu */
const r0 = await A.pag.evaluate(() => ({ n: window.__A.G.casa.length, ks: [...new Set(window.__A.G.casa.map((m) => m.k))].join(',') }));
prueba('la casa arranca con un living armado con las piezas nuevas', r0.n >= 20 && /pared/.test(r0.ks) && /ventana/.test(r0.ks) && /cuadro/.test(r0.ks), `${r0.n} cosas`);
await A.pag.evaluate(() => { const { J } = window.__A; J.celu.abrir('inicio'); document.querySelector('.ventana.celu [data-app=construir]').click(); });
await avanzar(A.pag, 3, 1 / 30, false);
const r1 = await A.pag.evaluate(() => { const { cam, construyendo, UI, ent } = window.__A; return { panel: !!document.querySelector('.obra-panel'), plano: !!cam.plano, hud: UI.hud.classList.contains('construyendo'), dedos: ent.capa.classList.contains('en-obra'), modo: ent.modoObra, C: !!construyendo, celu: window.__A.J.celu.abierto }; });
prueba('🔨 Construir en el celu: el panel, la cámara de arriba y los dedos del juego escondidos', r1.panel && r1.plano && r1.hud && r1.dedos && r1.modo && r1.C && !r1.celu, JSON.stringify(r1));

/* 2) todas las piezas */
const r2 = await A.pag.evaluate(() => {
  const { G, cam } = window.__A, res = {};
  const aca = () => document.querySelector('.obra-h[data-a="aca"]').click();
  G.casa.length = 0; window.__A.reino.rehacer(G.casa, true);
  let i = 0;
  for (const cat of ['obra', 'muebles', 'deco']) {
    document.querySelector(`.obra-tabs [data-cat="${cat}"]`).click();
    const items = [...document.querySelectorAll('.obra-item')];
    res[cat] = { n: items.length, sinNombre: items.filter((b) => !b.querySelector('small').textContent || /^pz_/.test(b.querySelector('small').textContent)).length };
    for (const b of items) { b.click(); const x = -6 + (i % 7) * 2, z = -7 + Math.floor(i / 7) * 2; cam.plano.centro.set(x, 1.4, z); aca(); i++; }
  }
  return { res, puestas: G.casa.length, tipos: new Set(G.casa.map((m) => m.k)).size, i };
});
prueba('las tres pestañas: 12 de obra, 18 muebles y 24 de deco, todas con nombre', r2.res.obra.n === 12 && r2.res.muebles.n === 18 && r2.res.deco.n === 24 && !r2.res.obra.sinNombre && !r2.res.muebles.sinNombre && !r2.res.deco.sinNombre, JSON.stringify(r2.res));
prueba('y se pone cada una (54 distintas)', r2.puestas === 54 && r2.tipos === 54, `${r2.puestas} puestas, ${r2.tipos} tipos`);

/* 3) tocar la pantalla y las herramientas */
const r3 = await A.pag.evaluate(() => {
  const { G, cam, ent, Pantalla, reino } = window.__A, out = {};
  G.casa.length = 0; reino.rehacer(G.casa, true);
  document.querySelector('.obra-tabs [data-cat="obra"]').click(); document.querySelector('.obra-item[data-k="pared"]').click();
  cam.plano.centro.set(2, 1.4, -2); cam.plano.dist = 12;
  return new Promise((ok) => setTimeout(() => {
    /* el toque en el medio de la pantalla cae en el centro del plano */
    window.__A.paso(1 / 30, false); window.__A.paso(1 / 30, false); for (let k = 0; k < 40; k++) window.__A.paso(1 / 30, false);
    ent.alTocar(Pantalla.w / 2, Pantalla.h / 2);
    const m = G.casa[0]; out.toque = m && { x: m.x, z: m.z };
    /* girar: la obra de a 90° */
    document.querySelector('.obra-h[data-a="girar"]').click(); cam.plano.centro.set(-2, 1.4, -2); document.querySelector('.obra-h[data-a="aca"]').click();
    out.giro = +(G.casa[1]?.r || 0).toFixed(3);
    /* pintar */
    document.querySelector('.obra-h[data-h="pintar"]').click(); document.querySelector('.obra-color[data-c="#ff6fb0"]').click();
    const T = (x, z) => window.__A.construyendo.tocarEn(x, z);
    T(2, -2); out.color = G.casa[0].c;
    /* mover: agarrar la de (2,-2) y dejarla en (4, 0) */
    document.querySelector('.obra-h[data-h="mover"]').click(); T(2, -2); out.cargada = G.casa.length; T(4, 0); out.movida = { x: G.casa.at(-1).x, z: G.casa.at(-1).z, n: G.casa.length };
    /* quitar y deshacer (tres veces: quitar, mover, pintar) */
    document.querySelector('.obra-h[data-h="quitar"]').click(); T(4, 0); out.quitada = G.casa.length;
    const des = () => document.querySelector('.obra-h[data-a="deshacer"]').click();
    des(); out.vuelve = G.casa.length; des(); out.volvioLugar = { x: G.casa.find((q) => q.k === 'pared' && !q.r)?.x }; des(); out.sinColor = G.casa.find((q) => q.k === 'pared' && !q.r)?.c || null;
    ok(out);
  }, 50));
});
prueba('un toque en el medio de la pantalla pone la pared en el medio del plano', r3.toque && Math.abs(r3.toque.x - 2) <= 0.5 && Math.abs(r3.toque.z + 2) <= 0.5, JSON.stringify(r3.toque));
prueba('girar: la obra de a 90°', Math.abs(r3.giro - Math.PI / 2) < 0.01, String(r3.giro));
prueba('pintar, mover (se agarra y se deja) y quitar', r3.color === '#ff6fb0' && r3.cargada === 1 && r3.movida.x === 4 && r3.movida.z === 0 && r3.movida.n === 2 && r3.quitada === 1, JSON.stringify(r3));
prueba('deshacer vuelve atrás de a uno (quitar, mover y pintar)', r3.vuelve === 2 && r3.volvioLugar.x === 2 && r3.sinColor === null, JSON.stringify({ v: r3.vuelve, l: r3.volvioLugar, c: r3.sinColor }));

/* 4) arriba de la tarima, la puerta y la escalera */
const r4 = await A.pag.evaluate(() => {
  const { G, reino } = window.__A, T = (x, z) => window.__A.construyendo.tocarEn(x, z), W = reino.mundo;
  const elegir = (cat, k) => { document.querySelector(`.obra-tabs [data-cat="${cat}"]`).click(); document.querySelector(`.obra-item[data-k="${k}"]`).click(); document.querySelector('.obra-h[data-h="poner"]')?.click(); document.querySelector(`.obra-item[data-k="${k}"]`).click(); };
  G.casa.length = 0; reino.rehacer(G.casa, true);
  elegir('obra', 'tarima'); T(5, 4); elegir('obra', 'escalera'); T(5, 2); elegir('obra', 'puerta'); T(0, -3);
  elegir('deco', 'flores'); T(5, 4);
  const flores = G.casa.find((m) => m.k === 'flores');
  const choca = (x, y, z) => W.cerca(x, z).some((s) => !s.fantasma && s.mueble && s.y1 > y + 0.45 && s.y0 < y + 1.3 && W.dentro(s, x, z, 0.3));
  return { y: flores?.y, medio: choca(0, 1.4, -3), costado: choca(-0.8, 1.4, -3), esc: [1.25, 1.75, 2.25, 2.75].map((z) => +(W.suelo(5, z, 3).y - 1.4).toFixed(2)), tarima: +(W.suelo(5, 4, 3).y - 1.4).toFixed(2) };
});
prueba('lo que se pone arriba de la tarima queda arriba (1,2 m)', r4.y === 1.2, String(r4.y));
prueba('la puerta se atraviesa por el medio (y el costado es pared)', !r4.medio && r4.costado, JSON.stringify(r4));
prueba('la escalera sube de a 30 cm hasta la tarima', r4.esc.join() === '0.3,0.6,0.9,1.2' && r4.tarima === 1.2, r4.esc.join(' → ') + ' → ' + r4.tarima);

/* 5) el tope de 200 y "Listo" */
const r5 = await A.pag.evaluate(() => {
  const { G, reino } = window.__A, T = (x, z) => window.__A.construyendo.tocarEn(x, z);
  document.querySelector('.obra-tabs [data-cat="deco"]').click(); document.querySelector('.obra-item[data-k="planta"]').click();
  while (G.casa.length < 200) G.casa.push({ k: 'planta', x: -9 + (G.casa.length % 18), z: -6 + Math.floor(G.casa.length / 18), r: 0 });
  reino.rehacer(G.casa, true);
  const antes = G.casa.length; T(0, 0);
  return { antes, despues: G.casa.length, cuenta: document.querySelector('.obra-cuenta').textContent };
});
prueba('hasta 200 cosas (la 201 no entra, y avisa)', r5.antes === 200 && r5.despues === 200 && r5.cuenta === '200/200', JSON.stringify(r5));
const r6 = await A.pag.evaluate(async () => {
  const { G, reino, cam, UI, ent } = window.__A;
  document.querySelector('.obra-listo').click();
  let mallas = 0; reino.grupo.traverse((o) => { if (o.isMesh && o.visible) mallas++; });
  let guardada = null; try { guardada = JSON.parse(localStorage.getItem('aeroplaza_v1')).casa.length; } catch { guardada = null; }
  return { plano: cam.plano, panel: !!document.querySelector('.obra-panel'), hud: UI.hud.classList.contains('construyendo'), modo: ent.modoObra, mallas, guardada, n: G.casa.length };
});
prueba('"Listo": la cámara de siempre, sin panel, y la casa guardada', r6.plano === null && !r6.panel && !r6.hud && !r6.modo && r6.guardada === r6.n, JSON.stringify(r6));
prueba('fundida: 200 plantas en pocas mallas (menos de 400 en toda la escena)', r6.mallas < 400, `${r6.mallas} mallas visibles`);

/* 6) la casa de otro, por la red: se limpia */
const r7 = await A.pag.evaluate(async () => {
  const { viajar, red } = window.__A;
  await viajar('casa', { casaDe: 'abcdefabcdef', nombreCasa: 'Beto' });
  red.alCasa({ id: 'abcdefabcdef', plano: [{ k: 'pared', x: 0, z: 0, r: 0, c: 'url(javascript:alert(1))', y: 99 }, { k: 'orbe', x: 1, z: 1, c: '#ff00ff', y: 1.2 }, { k: 'x'.repeat(40), x: 0, z: 0 }, { k: 'farol', x: 50, z: 0 }] });
  const p = window.__A.reino.plano;
  return { n: p.length, pared: p[0], orbe: p[1] };
});
prueba('la casa de otro por la red: sin colores ni alturas raras, ni cosas afuera', r7.n === 2 && !('c' in r7.pared) && !('y' in r7.pared) && r7.orbe.c === '#ff00ff' && r7.orbe.y === 1.2, JSON.stringify(r7));
prueba('en su casa no se construye', await A.pag.evaluate(() => { window.__A.J.construir(); return !window.__A.construyendo; }));

/* 7) las fotos */
await A.pag.evaluate(async () => { await window.__A.viajar('casa'); });
await avanzar(A.pag, 5, 1 / 30, false);
await A.pag.evaluate(() => { const { G, reino } = window.__A; G.casa.length = 0; G.casa.push(...window.__A.casaInicial()); reino.rehacer(G.casa); window.__A.J.construir(); document.querySelector('.obra-tabs [data-cat="deco"]').click(); document.querySelector('.obra-item[data-k="estrella"]').click(); window.__A.cam.plano.centro.set(0, 1.4, -2); window.__A.cam.plano.dist = 11; window.__A.cam.yaw = 0.4; });
await avanzar(A.pag, 40, 1 / 30, false); await A.pag.waitForTimeout(400); await avanzar(A.pag, 1);
await A.pag.screenshot({ path: path.join(SAL, 'casa-construir-celu.png') });
await A.pag.evaluate(() => document.querySelector('.obra-listo').click());
await A.pag.evaluate(() => { const { yo, cam } = window.__A; yo.p.set(0, 1.45, 3.5); yo.rumbo = Math.PI; cam.detras(yo.rumbo); cam.pitch = 0.25; cam.dist = cam.distObj = 6; });
await avanzar(A.pag, 40, 1 / 30, false); await avanzar(A.pag, 1);
await A.pag.screenshot({ path: path.join(SAL, 'casa-terminada.png') });
const B = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Beto&reino=casa', { ancho: 1280, alto: 720 });
await B.pag.waitForFunction(() => window.__A && window.__A.yo && window.__A.reino?.id === 'casa' && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await B.pag.evaluate(() => { window.__A.J.construir(); document.querySelector('.obra-tabs [data-cat="muebles"]').click(); document.querySelector('.obra-item[data-k="piano"]').click(); window.__A.cam.plano.centro.set(0, 1.4, -2); window.__A.cam.plano.dist = 12; });
await avanzar(B.pag, 40, 1 / 30, false); await B.pag.waitForTimeout(400); await avanzar(B.pag, 1);
await B.pag.screenshot({ path: path.join(SAL, 'casa-construir-compu.png') });
prueba('los nombres de las piezas y del panel están en los tres idiomas', !avisos.length, avisos.slice(0, 3).join(' | '));
const errs = [A, B].flatMap((x) => x.errores).filter((e) => !/ERR_|net::|WebSocket/.test(e));
prueba('sin errores en las páginas', !errs.length, errs.slice(0, 3).join(' | '));
console.log('fotos: pruebas/salida/casa-construir-celu.png casa-terminada.png casa-construir-compu.png');
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
