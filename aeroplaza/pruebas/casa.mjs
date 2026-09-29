// LA CASA Y SU CONSTRUCCIÓN COMO EN SIMS MOBILE (vuelta 49): obra.js, casa.js, casa-piezas.js.
// Con toques de verdad (CDP) en el celu acostado (844 × 390), y el mouse y las teclas en la compu:
// - el living de arranque; 🔨 en el celu: el catálogo por pestañas (todas las piezas, con nombre en los tres
//   idiomas) con miniaturas 3D, la cámara de arriba y el HUD escondido;
// - tocar elige (huella y barrita), arrastrar mueve (y si se suelta donde no entra, queda donde sí entraba); un dedo
//   en el piso mueve la vista (el piso queda pegado al dedo), dos acercan y giran;
// - poner desde el catálogo (tocando o arrastrando la carta), la barrita (girar, color, copiar, quitar), deshacer y
//   rehacer;
// - la pared de corrido, el cuarto (y uno pegado, sin repetir la pared del medio), la puerta que reemplaza una pared,
//   el cuadro colgado, el piso en rectángulo que repinta y demoler;
// - las paredes cortadas (las de adelante bajan), bajas y enteras;
// - la tarima, la puerta y la escalera (los choques); el tope de 200; "Listo" (fundida y guardada); la red;
// - las fotos: casa-construir-celu.png, casa-cuarto.png, casa-terminada.png y casa-construir-compu.png.
//     node pruebas/casa.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const nav = await navegador();
const A = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Ana&reino=casa', { ancho: 844, alto: 390, movil: true });
const P = A.pag;
const avisos = []; P.on('console', (m) => { if (/falta el texto/.test(m.text())) avisos.push(m.text()); });
await P.waitForFunction(() => window.__A && window.__A.yo && window.__A.reino?.id === 'casa' && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await avanzar(P, 1);
const cdp = await A.ctx.newCDPSession(P);
const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const tocar = async (x, y) => { await tp('touchStart', [[x, y]]); await P.waitForTimeout(40); await tp('touchEnd', []); await P.waitForTimeout(80); };
const arrastrar = async (x0, y0, x1, y1, n = 10) => { await tp('touchStart', [[x0, y0]]); await P.waitForTimeout(30); for (let i = 1; i <= n; i++) { await tp('touchMove', [[x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]]); await P.waitForTimeout(16); } await tp('touchEnd', []); await P.waitForTimeout(80); };
const cuadros = (n = 2) => avanzar(P, n, 1 / 30, false);
const ev = (f, a) => P.evaluate(f, a);
const centroDe = (sel) => ev((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const tocarEl = async (sel) => { const c = await centroDe(sel); await tocar(c.x, c.y); };
/* dónde se ve en la pantalla un punto del patio (y = 1,4 + alto) */
const aPantalla = (x, z, alto = 0) => ev(([x, z, alto]) => window.__A.construyendo.aPantalla(x, 1.4 + alto, z), [x, z, alto]);
/* la vista quieta: el centro, la distancia y el giro (0: la cámara del lado de +z, la derecha es +x) */
const vista = async (x, z, dist = 12, yaw = 0) => { await ev(([x, z, dist, yaw]) => { const { cam, construyendo: O } = window.__A; cam.plano.centro.set(x, 1.4, z); cam.plano.dist = dist; cam.yaw = yaw; O.C.yawObj = yaw; O.C.inclina = 0; }, [x, z, dist, yaw]); await cuadros(3); };
const ESTADO = () => ev(() => { const e = window.__A.construyendo.estado(); return { ...e, sel: e.sel && { ...e.sel } }; });

/* 1) el living de arranque y construir desde el celu */
const r0 = await ev(() => ({ n: window.__A.G.casa.length, ks: [...new Set(window.__A.G.casa.map((m) => m.k))].join(',') }));
prueba('la casa arranca con un living armado', r0.n >= 20 && /pared/.test(r0.ks) && /ventana/.test(r0.ks) && /cuadro/.test(r0.ks), `${r0.n} cosas`);
await ev(() => { const { J } = window.__A; J.celu.abrir('inicio'); document.querySelector('.ventana.celu [data-app=construir]').click(); });
await cuadros(30);
await P.waitForTimeout(450);   // (el catálogo entra desde abajo en 0,3 s)
const r1 = await ev(() => { const { cam, construyendo, UI, ent, J } = window.__A; return { ob: !!document.querySelector('.ob .ob-cajon'), plano: !!cam.plano, hud: getComputedStyle(UI.hud.querySelector('.arriba-der')).display === 'none', dedos: ent.capa.classList.contains('en-obra'), modo: ent.modoObra, C: !!construyendo, celu: J.celu.abierto, tabs: document.querySelectorAll('.ob-tab[data-tab]:not([data-tab="-"])').length }; });
prueba('🔨 Construir en el celu: el catálogo, la cámara de arriba y el HUD y los dedos escondidos', r1.ob && r1.plano && r1.hud && r1.dedos && r1.modo && r1.C && !r1.celu && r1.tabs === 8, JSON.stringify(r1));

/* 2) el catálogo: todas las piezas en alguna pestaña, con nombre en los tres idiomas */
const r2 = await ev(() => {
  const { piezas: { TABS, CATALOGO }, textos: { t, ponerIdioma } } = window.__A;
  const todas = Object.values(CATALOGO).flat(), en = new Set();
  for (const [, , qs] of TABS) for (const q of qs) en.add(q.replace(/^@(linea|area):/, ''));
  const falta = todas.filter((k) => !en.has(k)), sinNombre = [];
  for (const i of ['en', 'pt', 'es']) { ponerIdioma(i); for (const k of todas) if (t('pz_' + k) === 'pz_' + k) sinNombre.push(i + ':' + k); for (const [id] of TABS) if (t('obt_' + id) === 'obt_' + id) sinNombre.push(i + ':' + id); }
  return { n: todas.length, falta, sinNombre };
});
prueba('el catálogo: las 54 piezas en sus pestañas, con nombre en los tres idiomas', r2.n === 54 && !r2.falta.length && !r2.sinNombre.length, JSON.stringify(r2));
/* las miniaturas: se dibujan de a poco (dos por cuadro) y no son un cuadrado vacío */
await tocarEl('.ob-tab[data-tab=living]');
for (let i = 0; i < 24; i++) await avanzar(P, 1);
const r2b = await ev(async () => {
  const cartas = [...document.querySelectorAll('.ob-carta')], con = cartas.filter((b) => /data:image\/png/.test(b.querySelector('.ob-mini').style.backgroundImage));
  const url = document.querySelector('.ob-carta[data-k=sofa] .ob-mini').style.backgroundImage.slice(5, -2);
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let distintos = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0xea) + Math.abs(d[i + 1] - 0xf6) + Math.abs(d[i + 2] - 0xff) > 40) distintos++;
  return { cartas: cartas.length, con: con.length, sofa: +(distintos / (d.length / 4)).toFixed(2) };
});
prueba('las miniaturas 3D del catálogo (el sofá se ve: no es el fondo solo)', r2b.con >= r2b.cartas - 1 && r2b.sofa > 0.12, JSON.stringify(r2b));

/* 3) tocar elige; arrastrar mueve */
await vista(0, -2, 11);
let s = await ev(() => { const m = window.__A.G.casa.find((q) => q.k === 'sofa'); return { x: m.x, z: m.z }; });
let sp = await aPantalla(s.x, s.z, 0.5);
await tocar(sp.x, sp.y); await cuadros(2);
const r3 = await ev(() => { const { construyendo: O, reino } = window.__A, e = O.estado(), b = document.querySelector('.ob-barra'), r = b.getBoundingClientRect(); return { sel: e.sel?.k, barra: b.classList.contains('abierta'), dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 40 && r.bottom < document.querySelector('.ob-cajon').getBoundingClientRect().top, huella: reino.huellaVisible }; });
prueba('tocar el sofá lo elige: su huella y la barrita arriba (adentro de la pantalla)', r3.sel === 'sofa' && r3.barra && r3.dentro && r3.huella, JSON.stringify(r3));
/* (un lugar libre a unos 3 m, adelante del living) */
const libre = await ev(([x, z]) => { const { construyendo: O, G } = window.__A, m = G.casa.find((q) => q.k === 'sofa'); const l = O.libreCerca('sofa', x + 1.5, z + 3, m.r, m); return { x: l.x, z: l.z }; }, [s.x, s.z]);
const lejos = await aPantalla(libre.x, libre.z, 0.5);
await arrastrar(sp.x, sp.y, lejos.x, lejos.y, 12); await cuadros(2);
const r4 = await ev(() => { const { construyendo: O, G } = window.__A, m = G.casa.find((q) => q.k === 'sofa'); return { x: m.x, z: m.z, ok: O.lugar(m.k, m.x, m.z, m.r, m).ok, hist: O.estado().hist, sel: O.estado().sel?.k }; });
prueba('arrastrarlo lo lleva hasta el dedo, en la grilla, y queda elegido', Math.abs(r4.x - libre.x) <= 0.5 && Math.abs(r4.z - libre.z) <= 0.5 && r4.ok && r4.hist === 1 && r4.sel === 'sofa', JSON.stringify({ r4, libre }));
/* soltarlo afuera del patio: queda en el último lugar donde entraba */
s = { x: r4.x, z: r4.z }; sp = await aPantalla(s.x, s.z, 0.5);
const afuera = await aPantalla(s.x + 14, s.z + 2, 0);
await arrastrar(sp.x, sp.y, Math.min(830, afuera.x), Math.min(250, afuera.y), 14); await cuadros(2);
const r5 = await ev(() => { const { construyendo: O, G } = window.__A, m = G.casa.find((q) => q.k === 'sofa'); return { x: m.x, z: m.z, ok: O.lugar(m.k, m.x, m.z, m.r, m).ok, r: Math.hypot(m.x, m.z), pista: document.querySelector('.ob-pista').className }; });
prueba('soltado donde no entra, queda donde sí entraba (y avisa en rojo)', r5.ok && r5.r < 10 && /mal/.test(r5.pista), JSON.stringify(r5));

/* 4) la vista: un dedo en el piso la mueve (el piso queda pegado al dedo); dos acercan y giran */
await vista(0, -2, 11); await tocar(790, 80); await cuadros(2);   // (tocar donde no hay nada suelta lo elegido)
const q0 = await ev(() => window.__A.construyendo.pisoBajo(300, 240));
await arrastrar(300, 240, 420, 200, 10); await cuadros(2);
const q1 = await ev(() => ({ p: window.__A.construyendo.pisoBajo(420, 200), sel: window.__A.construyendo.estado().sel }));
prueba('un dedo en el piso mueve la vista (lo que estaba bajo el dedo sigue bajo el dedo)', !q1.sel && Math.hypot(q1.p.x - q0.x, q1.p.z - q0.z) < 0.5, JSON.stringify({ q0, q1: q1.p }));
const v0 = await ev(() => ({ d: window.__A.cam.plano.dist, yaw: window.__A.cam.yaw }));
await tp('touchStart', [[380, 200], [460, 200]]); await P.waitForTimeout(30);
for (let i = 1; i <= 8; i++) { const a = i / 8 * 0.5, r = 40 + i * 10; await tp('touchMove', [[420 - Math.cos(a) * r, 200 - Math.sin(a) * r], [420 + Math.cos(a) * r, 200 + Math.sin(a) * r]]); await P.waitForTimeout(16); }
await tp('touchEnd', []); await P.waitForTimeout(80); await cuadros(2);
const v1 = await ev(() => ({ d: window.__A.cam.plano.dist, yaw: window.__A.cam.yaw }));
prueba('dos dedos: abrirlos acerca y girarlos gira la vista para el mismo lado', v1.d < v0.d * 0.7 && Math.abs(v1.yaw - v0.yaw - 0.5) < 0.15, JSON.stringify({ v0, v1 }));

/* 5) poner desde el catálogo: tocando la carta, o arrastrándola hasta donde va */
await vista(0, 3, 11);
await tocarEl('.ob-tab[data-tab=plantas]'); await tocarEl('.ob-carta[data-k=planta]'); await cuadros(2);
const r6 = await ev(() => { const { construyendo: O } = window.__A, m = O.estado().sel; return m && { k: m.k, ok: O.lugar(m.k, m.x, m.z, m.r, m).ok, d: Math.hypot(m.x, m.z - 3) }; });
prueba('tocar una carta pone la pieza en el medio de la vista (en un lugar libre) y la deja elegida', r6?.k === 'planta' && r6.ok && r6.d < 3, JSON.stringify(r6));
await tocarEl('.ob-tab[data-tab=living]');
const carta = await centroDe('.ob-carta[data-k=puff]'), destino = { x: carta.x, y: 150 }, dp = await ev((q) => window.__A.construyendo.pisoBajo(q.x, q.y), destino);
const n0 = await ev(() => window.__A.G.casa.length);
await arrastrar(carta.x, carta.y, destino.x, destino.y, 12); await cuadros(2);
const r7 = await ev(() => { const { construyendo: O, G } = window.__A, m = O.estado().sel; return { n: G.casa.length, k: m?.k, x: m?.x, z: m?.z }; });
prueba('arrastrar la carta del puf hasta el patio lo pone ahí', r7.n === n0 + 1 && r7.k === 'puff' && Math.hypot(r7.x - dp.x, r7.z - dp.z) < 1, JSON.stringify({ r7, dp }));

/* 6) la barrita: girar, color, copiar y quitar; deshacer y rehacer */
await cuadros(2);
const rr0 = await ev(() => window.__A.construyendo.estado().sel.r || 0);
const giros = await ev(() => { const { construyendo: O } = window.__A, m = O.estado().sel; return [1, 2].map((i) => { const l = O.lugar(m.k, m.x, m.z, (m.r || 0) + i * Math.PI / 4, m); return [l.ok, l.porque, l.x, l.z, m.x, m.z, O.choca(l, m)?.k]; }); });
await tocarEl('.ob-barra [data-a=girar]');
const rr1 = await ev(() => window.__A.construyendo.estado().sel.r);
await tocarEl('.ob-barra [data-a=color]'); await cuadros(2);
const abierto = await ev(() => document.querySelector('.ob-colores').classList.contains('abierto'));
await tocarEl('.ob-colores [data-c="#ff6fb0"]');
const col = await ev(() => window.__A.construyendo.estado().sel.c);
const nA = await ev(() => window.__A.G.casa.length);
await tocarEl('.ob-barra [data-a=copiar]'); await cuadros(2);
const cop = await ev(() => { const { construyendo: O, G } = window.__A, m = O.estado().sel; return { n: G.casa.length, k: m.k, c: m.c, ok: !O.choca(m, m), d: G.casa.filter((q) => q.k === 'puff').length }; });
await tocarEl('.ob-barra [data-a=quitar]'); await cuadros(2);
const qui = await ev(() => ({ n: window.__A.G.casa.length, sel: window.__A.construyendo.estado().sel }));
prueba('la barrita: girar (45° los muebles), color, copiar (a un lugar libre) y quitar', Math.abs(rr1 - rr0 - Math.PI / 4) < 0.01 && abierto && col === '#ff6fb0' && cop.n === nA + 1 && cop.k === 'puff' && cop.c === '#ff6fb0' && cop.ok && qui.n === nA && !qui.sel, JSON.stringify({ rr0, rr1, giros, abierto, col, cop, qui }));
await tocarEl('[data-a=deshacer]'); const d1 = await ev(() => window.__A.G.casa.length);
await tocarEl('[data-a=deshacer]'); const d2 = await ev(() => window.__A.G.casa.length);
await tocarEl('[data-a=rehacer]'); const d3 = await ev(() => window.__A.G.casa.length);
prueba('deshacer (quitar, copiar) y rehacer', d1 === nA + 1 && d2 === nA && d3 === nA + 1, JSON.stringify({ nA, d1, d2, d3 }));

/* 7) dibujar: la pared de corrido y los cuartos, en el patio vacío */
await ev(() => { const { G, reino } = window.__A; G.casa.length = 0; reino.rehacer(G.casa, true); });
await vista(0, 3, 15);
await tocarEl('.ob-tab[data-tab=paredes]'); await tocarEl('.ob-carta[data-q="@linea:pared"]');
let a = await aPantalla(-4, 2), b = await aPantalla(4, 2);
await tp('touchStart', [[a.x, a.y]]); for (let i = 1; i <= 10; i++) { await tp('touchMove', [[a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10]]); await P.waitForTimeout(16); }
const guias = await ev(() => ({ g: window.__A.reino.guiasVisibles, pista: document.querySelector('.ob-pista').textContent }));
await tp('touchEnd', []); await P.waitForTimeout(80); await cuadros(2);
await vista(0, -2, 15);
const r8 = await ev(() => window.__A.G.casa.map((m) => `${m.k}@${m.x},${m.z},${+m.r.toFixed(2)}`).sort().join(' '));
prueba('la pared de corrido: arrastrando 8 m salen 4 tramos seguidos (y se ven mientras se dibuja)', r8 === 'pared@-1,2,0 pared@-3,2,0 pared@1,2,0 pared@3,2,0' && guias.g === 4 && /4/.test(guias.pista), r8 + ' · ' + JSON.stringify(guias));
await tocarEl('.ob-carta[data-q="@cuarto"]');
a = await aPantalla(-4, -2); b = await aPantalla(2, -6);
await arrastrar(a.x, a.y, b.x, b.y, 12); await cuadros(2);
const r9 = await ev(() => { const L = window.__A.G.casa; return { paredes: L.filter((m) => m.k === 'pared' && m.z < 0).length, pisos: L.filter((m) => m.k === 'piso').length }; });
a = await aPantalla(2, -2); b = await aPantalla(6, -6);
await arrastrar(a.x, a.y, b.x, b.y, 12); await cuadros(2);
const r10 = await ev(() => { const L = window.__A.G.casa, esta = (x, z) => L.filter((m) => m.k === 'pared' && m.x === x && m.z === z).length; return { paredes: L.filter((m) => m.k === 'pared' && m.z < 0).length, pisos: L.filter((m) => m.k === 'piso').length, medio: [esta(2, -3), esta(2, -5)] }; });
prueba('el cuarto de esquina a esquina: 6 × 4 m son 10 paredes y 6 pisos', r9.paredes === 10 && r9.pisos === 6, JSON.stringify(r9));
prueba('uno pegado no repite la pared del medio (6 paredes y 4 pisos más)', r10.paredes === 16 && r10.pisos === 10 && r10.medio.join() === '1,1', JSON.stringify(r10));
await vista(-1, -4, 11); await avanzar(P, 1);
await P.screenshot({ path: path.join(SAL, 'casa-cuarto.png') });
/* las paredes cortadas: con la cámara del lado de +z, la de adelante (z = -2) baja y la de atrás (z = -6) no */
const corte = await ev(() => { const { G, reino } = window.__A, esc = (x, z) => reino.grupoDe(G.casa.find((m) => m.k === 'pared' && m.x === x && m.z === z))?.scale.y; return { adelante: esc(-1, -2), atras: esc(-1, -6), costado: esc(-4, -3) }; });
await tocarEl('[data-a=vista]'); await cuadros(2);
const bajas = await ev(() => { const { G, reino } = window.__A; return G.casa.filter((m) => m.k === 'pared').every((m) => reino.grupoDe(m).scale.y < 0.5); });
await tocarEl('[data-a=vista]'); await cuadros(2);
const enteras = await ev(() => { const { G, reino } = window.__A; return G.casa.filter((m) => m.k === 'pared').every((m) => reino.grupoDe(m).scale.y === 1) && reino.techosVisibles; });
await tocarEl('[data-a=vista]'); await cuadros(2);
prueba('paredes cortadas (baja la de adelante, no la de atrás ni la del costado), bajas y enteras', corte.adelante < 0.5 && corte.atras === 1 && corte.costado === 1 && bajas && enteras, JSON.stringify({ corte, bajas, enteras }));

/* 8) la puerta que reemplaza una pared, el cuadro que se cuelga, el piso que se repinta y demoler */
await vista(-1, -4, 15);
await tocarEl('.ob-carta[data-k=puerta]'); await cuadros(2);
const pu = await ev(() => { const m = window.__A.construyendo.estado().sel; return { x: m.x, z: m.z }; });
a = await aPantalla(pu.x, pu.z, 2.35); b = await aPantalla(-1, -2, 2.35);   // (el dintel: por el medio de la puerta se ve el piso)
await arrastrar(a.x, a.y, b.x, b.y, 12); await cuadros(2);
const r11 = await ev(() => { const L = window.__A.G.casa, aca = L.filter((m) => m.x === -1 && m.z === -2); return aca.map((m) => m.k).join(); });
prueba('una puerta soltada sobre una pared la reemplaza', r11 === 'puerta', r11);
await tocarEl('.ob-tab[data-tab=deco]'); await tocarEl('.ob-carta[data-k=cuadro]'); await cuadros(2);
const r12 = await ev(() => { const { G, construyendo: O } = window.__A, m = O.estado().sel; return { k: m?.k, pared: G.casa.filter((q) => ['pared', 'ventana', 'puerta', 'media'].includes(q.k) && q.x === m.x && q.z === m.z).length }; });
prueba('el cuadro se cuelga solo en la pared más cerca', r12.k === 'cuadro' && r12.pared === 1, JSON.stringify(r12));
const r12b = await ev(() => {
  const { G, construyendo: O } = window.__A, cu = O.estado().sel, aca = () => G.casa.filter((q) => q.x === cu.x && q.z === cu.z);
  const w = aca().find((q) => q.k !== 'cuadro'), r0 = cu.r;
  O.seleccionar(w, true); O.girarSel(); const giro = aca().find((q) => q.k === 'cuadro')?.r;
  O.quitarSel(); const queda = aca().length; O.deshacer(); O.deshacer(); const vuelve = aca().map((q) => q.k).sort().join();
  return { r0, giro, d: +((((giro - r0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(3), queda, vuelve };
});
prueba('lo colgado va con su pared: gira con ella y se va si se la quita (deshacer lo vuelve)', Math.abs(r12b.d - Math.PI / 2) < 0.01 && r12b.queda === 0 && r12b.vuelve === 'cuadro,pared', JSON.stringify(r12b));
await tocarEl('.ob-tab[data-tab=pisos]'); await tocarEl('.ob-carta[data-q="@area:damero"]');
a = await aPantalla(-4, -2); b = await aPantalla(2, -6);
await arrastrar(a.x, a.y, b.x, b.y, 12); await cuadros(2);
const r13 = await ev(() => { const L = window.__A.G.casa.filter((m) => m.x < 2 && m.z < -1 && ['piso', 'damero'].includes(m.k)); return L.map((m) => m.k).join(); });
prueba('el piso en rectángulo repinta lo que había (6 de damero, ninguno repetido)', r13 === 'damero,damero,damero,damero,damero,damero', r13);
await tocarEl('.ob-tab[data-tab=paredes]'); await tocarEl('.ob-carta[data-q="@demoler"]');
a = await aPantalla(2.4, -2); b = await aPantalla(6, -6);
await arrastrar(a.x, a.y, b.x, b.y, 12); await cuadros(2);
const r14 = await ev(() => { const L = window.__A.G.casa; return { derecha: L.filter((m) => m.x > 2.1 && m.z < -1).length, medio: L.filter((m) => m.x === 2 && m.k === 'pared').length, izq: L.filter((m) => m.x < 2 && m.z < -1).length }; });
prueba('demoler saca lo marcado (el cuarto de la derecha) y deja lo demás', r14.derecha === 0 && r14.medio === 2 && r14.izq >= 14, JSON.stringify(r14));
await tocarEl('.ob-pista .ob-x');
prueba('la ✕ de la pista deja la herramienta', await ev(() => !window.__A.construyendo.estado().herr));

/* 9) arriba de la tarima, la puerta y la escalera (los choques de la obra) */
const r15 = await ev(() => {
  const { G, reino, construyendo: O } = window.__A, W = reino.mundo;
  G.casa.length = 0; G.casa.push({ k: 'tarima', x: 5, z: 4, r: 0 }, { k: 'escalera', x: 5, z: 2, r: 0 }, { k: 'puerta', x: 0, z: -3, r: 0 }); reino.rehacer(G.casa, true);
  const fl = O.lugar('flores', 5, 4, 0);
  const choca = (x, y, z) => W.cerca(x, z).some((s) => !s.fantasma && s.mueble && s.y1 > y + 0.45 && s.y0 < y + 1.3 && W.dentro(s, x, z, 0.3));
  return { y: fl.y, ok: fl.ok, medio: choca(0, 1.4, -3), costado: choca(-0.8, 1.4, -3), esc: [1.25, 1.75, 2.25, 2.75].map((z) => +(W.suelo(5, z, 3).y - 1.4).toFixed(2)), tarima: +(W.suelo(5, 4, 3).y - 1.4).toFixed(2), sofaEnTarima: O.lugar('sofa', 5, 4.5, 0).ok };
});
prueba('lo que se pone arriba de la tarima queda arriba (1,2 m)', r15.y === 1.2 && r15.ok, JSON.stringify(r15));
prueba('la puerta se atraviesa por el medio (y el costado es pared)', !r15.medio && r15.costado, JSON.stringify(r15));
prueba('la escalera sube de a 30 cm hasta la tarima', r15.esc.join() === '0.3,0.6,0.9,1.2' && r15.tarima === 1.2, r15.esc.join(' → ') + ' → ' + r15.tarima);

/* 10) el tope de 200 y "Listo" */
const r16 = await ev(() => {
  const { G, reino, construyendo: O } = window.__A;
  G.casa.length = 0; while (G.casa.length < 200) G.casa.push({ k: 'planta', x: -9 + (G.casa.length % 18), z: -6 + Math.floor(G.casa.length / 18), r: 0 });
  reino.rehacer(G.casa, true);
  const puesta = O.poner('flores');
  return { n: G.casa.length, puesta: !!puesta, pista: document.querySelector('.ob-pista').textContent };
});
await cuadros(1);
prueba('hasta 200 cosas (la 201 no entra, y avisa)', r16.n === 200 && !r16.puesta && /200/.test(r16.pista), JSON.stringify(r16));
await tocarEl('.ob-listo'); await cuadros(2);
const r17 = await ev(() => {
  const { G, reino, cam, UI, ent } = window.__A;
  let mallas = 0; reino.grupo.traverse((o) => { if (o.isMesh && o.visible) mallas++; });
  let guardada = null; try { guardada = JSON.parse(localStorage.getItem('aeroplaza_v1')).casa.length; } catch { guardada = null; }
  return { plano: cam.plano, ob: !!document.querySelector('.ob'), hud: UI.hud.classList.contains('construyendo'), modo: ent.modoObra, mallas, guardada, n: G.casa.length };
});
prueba('"Listo": la cámara de siempre, sin el catálogo, y la casa guardada', r17.plano === null && !r17.ob && !r17.hud && !r17.modo && r17.guardada === r17.n, JSON.stringify(r17));
prueba('fundida: 200 plantas en pocas mallas (menos de 400 en toda la escena)', r17.mallas < 400, `${r17.mallas} mallas visibles`);

/* 11) la casa de otro, por la red: se limpia */
const r18 = await ev(async () => {
  const { viajar, red } = window.__A;
  await viajar('casa', { casaDe: 'abcdefabcdef', nombreCasa: 'Beto' });
  red.alCasa({ id: 'abcdefabcdef', plano: [{ k: 'pared', x: 0, z: 0, r: 0, c: 'url(javascript:alert(1))', y: 99 }, { k: 'orbe', x: 1, z: 1, c: '#ff00ff', y: 1.2 }, { k: 'x'.repeat(40), x: 0, z: 0 }, { k: 'farol', x: 50, z: 0 }] });
  const p = window.__A.reino.plano;
  return { n: p.length, pared: p[0], orbe: p[1] };
});
prueba('la casa de otro por la red: sin colores ni alturas raras, ni cosas afuera', r18.n === 2 && !('c' in r18.pared) && !('y' in r18.pared) && r18.orbe.c === '#ff00ff' && r18.orbe.y === 1.2, JSON.stringify(r18));
prueba('en su casa no se construye', await ev(() => { window.__A.J.construir(); return !window.__A.construyendo; }));

/* 12) las fotos en el celu: construyendo (con el sofá elegido y sus colores) y la casa terminada */
await ev(async () => { await window.__A.viajar('casa'); });
await cuadros(5);
await ev(() => { const { G, reino, J } = window.__A; G.casa.length = 0; G.casa.push(...window.__A.casaInicial()); reino.rehacer(G.casa); J.construir(); });
await cuadros(30); await P.waitForTimeout(450); await vista(0, -2, 10);
await ev(() => { const { G, construyendo: O } = window.__A; O.seleccionar(G.casa.find((q) => q.k === 'sofa'), true); O.C.colores = true; document.querySelector('.ob-tab[data-tab=living]').click(); });
for (let i = 0; i < 14; i++) await avanzar(P, 1);
await P.waitForTimeout(300); await avanzar(P, 1);
await P.screenshot({ path: path.join(SAL, 'casa-construir-celu.png') });
await tocarEl('.ob-listo');
await ev(() => { const { yo, cam } = window.__A; yo.p.set(0, 1.45, 3.5); yo.rumbo = Math.PI; cam.detras(yo.rumbo); cam.pitch = 0.25; cam.dist = cam.distObj = 6; });
await cuadros(40); await avanzar(P, 1);
await P.screenshot({ path: path.join(SAL, 'casa-terminada.png') });

/* 13) en la compu: el mouse (clic elige, arrastrar mueve, el derecho gira, la rueda acerca) y las teclas */
const B = await abrir(nav, 'directo&pausa&calidad=baja&nombre=Beto&reino=casa', { ancho: 1280, alto: 720 });
const Q = B.pag;
await Q.waitForFunction(() => window.__A && window.__A.yo && window.__A.reino?.id === 'casa' && document.querySelector('.hud'), null, { timeout: 90000, polling: 200 });
await Q.evaluate(() => window.__A.J.construir()); await avanzar(Q, 30, 1 / 30, false); await Q.waitForTimeout(450);
await Q.evaluate(() => { const { cam, construyendo: O } = window.__A; cam.plano.centro.set(0, 1.4, -2); cam.plano.dist = 10; cam.yaw = O.C.yawObj = 0; }); await avanzar(Q, 3, 1 / 30, false); await avanzar(Q, 1);
const pc = await Q.evaluate(() => { const { G, construyendo: O } = window.__A, m = G.casa.find((q) => q.k === 'sofa'), l = O.libreCerca('sofa', m.x - 1.5, m.z + 3, m.r, m); return { m: { x: m.x, z: m.z }, l: { x: l.x, z: l.z }, p: O.aPantalla(m.x, 1.9, m.z), q: O.aPantalla(l.x, 1.9, l.z) }; });
await Q.mouse.click(pc.p.x, pc.p.y); await avanzar(Q, 2, 1 / 30, false);
const m1 = await Q.evaluate(() => window.__A.construyendo.estado().sel?.k);
await Q.mouse.move(pc.p.x, pc.p.y); await Q.mouse.down(); for (let i = 1; i <= 10; i++) await Q.mouse.move(pc.p.x + (pc.q.x - pc.p.x) * i / 10, pc.p.y + (pc.q.y - pc.p.y) * i / 10); await Q.mouse.up(); await avanzar(Q, 2, 1 / 30, false);
const m2 = await Q.evaluate(() => { const m = window.__A.construyendo.estado().sel; return { x: m.x, z: m.z, r: m.r || 0 }; });
await Q.keyboard.press('KeyR'); const m3 = await Q.evaluate(() => window.__A.construyendo.estado().sel.r);
const yaw0 = await Q.evaluate(() => window.__A.cam.yaw), dist0 = await Q.evaluate(() => window.__A.cam.plano.dist);
await Q.mouse.move(900, 300); await Q.mouse.down({ button: 'right' }); for (let i = 1; i <= 6; i++) await Q.mouse.move(900 + i * 15, 300); await Q.mouse.up({ button: 'right' });
await Q.mouse.move(700, 300); await Q.mouse.wheel(0, -120); await Q.mouse.wheel(0, -120);
const v2 = await Q.evaluate(() => ({ yaw: window.__A.cam.yaw, dist: window.__A.cam.plano.dist }));
prueba('en la compu: clic elige, arrastrar mueve, R gira (45°), el derecho gira la vista y la rueda acerca', m1 === 'sofa' && Math.abs(m2.x - pc.l.x) <= 0.5 && Math.abs(m2.z - pc.l.z) <= 0.5 && Math.abs(m3 - m2.r - Math.PI / 4) < 0.01 && Math.abs(v2.yaw - yaw0) > 0.3 && v2.dist < dist0 * 0.85, JSON.stringify({ m1, m2, l: pc.l, m3, yaw0, v2, dist0 }));
const nS = await Q.evaluate(() => window.__A.G.casa.length);
await Q.keyboard.press('Delete'); const nD = await Q.evaluate(() => window.__A.G.casa.length);
await Q.keyboard.press('Control+KeyZ'); const nZ = await Q.evaluate(() => window.__A.G.casa.length);
prueba('Supr quita y Ctrl+Z lo vuelve', nD === nS - 1 && nZ === nS, JSON.stringify({ nS, nD, nZ }));
await Q.evaluate(() => { const { G, cam, construyendo: O } = window.__A; cam.yaw = O.C.yawObj = 0.6; O.seleccionar(G.casa.find((q) => q.k === 'sofa'), true); document.querySelector('.ob-tab[data-tab=living]').click(); });
for (let i = 0; i < 14; i++) await avanzar(Q, 1);
await Q.waitForTimeout(300); await avanzar(Q, 1);
await Q.screenshot({ path: path.join(SAL, 'casa-construir-compu.png') });

prueba('los textos de la construcción están en los tres idiomas', !avisos.length, avisos.slice(0, 3).join(' | '));
const errs = [A, B].flatMap((x) => x.errores).filter((e) => !/ERR_|net::|WebSocket/.test(e));
prueba('sin errores en las páginas', !errs.length, errs.slice(0, 3).join(' | '));
console.log('fotos: pruebas/salida/casa-construir-celu.png casa-cuarto.png casa-terminada.png casa-construir-compu.png');
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
