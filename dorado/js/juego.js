/* ============================================================================
   DORADO: escenas (intro, idioma, menú con la mesa jugando sola, partida,
   pausa, fin, controles y el editor de botones), las reglas del pinball
   (misiones y rangos del hotel, multibola con jackpots, tiro maestro, bola
   salvada, bonus por bola), los tres modos y el bucle.
   ========================================================================== */

const lienzoP = document.getElementById('lienzo');
const g = lienzoP.getContext('2d');
let escena = 'intro', tEsc = 0, trans = null, mesaFondo = null, puertaImg = null, G = null, ahora = 0, dtCuadro = 1 / 60;

const CTRL_BASE = { modo: 0, tam: 1, transp: 1, resorte: 0, vibrar: true, bIzq: [0.15, 0.9], bDer: [0.85, 0.9], bRes: [0.9, 0.72] };
const CTRL = Object.assign({}, JSON.parse(JSON.stringify(CTRL_BASE)), Guardado.leer('controles', {}));
const guardarCtrl = () => Guardado.escribir('controles', CTRL);
const TAMS = [30, 38, 48], ALFAS = [0.25, 0.45, 0.75];
function vibrar(ms) { if (CTRL.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } }

/* --------------------------------------------------------------- pantalla */
function ajustar() {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = innerWidth, ch = innerHeight;
  let cssW = cw / ch > 0.6 ? ch * 0.5625 : cw;
  H = clamp(Math.round(W * ch / cssW), 640, 800);
  let cssH = cssW * H / W;
  if (cssH > ch) { cssW *= ch / cssH; cssH = ch; }
  lienzoP.width = Math.round(cssW * dpr); lienzoP.height = Math.round(cssH * dpr);
  S = lienzoP.width / W; Y0 = H - MESA_H;
  Object.assign(lienzoP.style, { width: cssW + 'px', height: cssH + 'px', left: Math.round((cw - cssW) / 2) + 'px', top: Math.round((ch - cssH) / 2) + 'px' });
  mesaFondo = pintarMesa(); puertaImg = pintarPuerta();
}
addEventListener('resize', ajustar);
function pintarPuerta() {
  const w = W / 2 + 2, [c, f] = lienzoHD(w, H);
  const gr = f.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#050607'); gr.addColorStop(1, '#14161a');
  f.fillStyle = gr; f.fillRect(0, 0, w, H);
  abanico(f, w, H / 2, 20, H * 0.6, Math.PI * 0.5, Math.PI * 1.5, 30, 0.16);
  for (const r of [60, 66, 120]) { f.strokeStyle = 'rgba(232,184,80,0.35)'; f.lineWidth = 1; f.beginPath(); f.arc(w, H / 2, r, Math.PI * 0.5, Math.PI * 1.5); f.stroke(); }
  for (const x of [10, 14, w - 10]) { f.strokeStyle = 'rgba(232,184,80,0.5)'; f.lineWidth = 1; f.beginPath(); f.moveTo(x, 0); f.lineTo(x, H); f.stroke(); }
  f.fillStyle = ORO; f.fillRect(w - 4, 0, 3, H);
  return c;
}

/* ---------------------------------------------------------------- entrada */
const E = { punteros: new Map(), clic: null, toque: null, teclas: new Set(), recien: new Set() };
function aLogico(ev) { const r = lienzoP.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; }
const posBoton = (b) => ({ x: CTRL[b][0] * W, y: CTRL[b][1] * H, r: TAMS[CTRL.tam] * (b === 'bRes' ? 0.85 : 1) });
const dentroBoton = (b, x, y, extra) => { const p = posBoton(b); return Math.hypot(x - p.x, y - p.y) < p.r * (extra || 1.25); };
function rolDe(x, y) {
  if (escena === 'editor') { if (y < Y0 + 52) return null; for (const b of ['bRes', 'bIzq', 'bDer']) if (CTRL.modo === 1 && dentroBoton(b, x, y)) return b; return CTRL.modo === 0 ? (x < W / 2 ? 'izq' : 'der') : null; }
  if (escena !== 'juego' || !G || G.ayuda || G.fase !== 'juego') return null;
  if (y < Y0 || (x > W - 50 && y < Y0 + 40)) return null;
  if (bolaEsperando()) {
    if (CTRL.modo === 1 ? dentroBoton('bRes', x, y) : (x > 290 && y - Y0 > 430)) return 'resorte';
  }
  if (CTRL.modo === 1) return dentroBoton('bIzq', x, y) ? 'izq' : dentroBoton('bDer', x, y) ? 'der' : null;
  return x < W / 2 ? 'izq' : 'der';
}
lienzoP.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); Sonido.iniciar();
  try { lienzoP.setPointerCapture(ev.pointerId); } catch (x) { /* */ }
  const p = aLogico(ev), rol = rolDe(p.x, p.y);
  E.punteros.set(ev.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, mov: 0, rol });
  E.toque = { x: p.x, y: p.y };
});
lienzoP.addEventListener('pointermove', (ev) => { const pt = E.punteros.get(ev.pointerId); if (!pt) return; const p = aLogico(ev); pt.x = p.x; pt.y = p.y; pt.mov = Math.max(pt.mov, Math.hypot(p.x - pt.x0, p.y - pt.y0)); });
const finPuntero = (ev) => {
  const pt = E.punteros.get(ev.pointerId); if (!pt) return;
  E.punteros.delete(ev.pointerId);
  if (pt.rol === 'resorte' && G) soltarResorte(pt);
  if (pt.mov < 14 && !pt.rol) E.clic = { x: pt.x, y: pt.y, x0: pt.x0, y0: pt.y0 };
  if (escena === 'editor' && pt.rol && pt.rol[0] === 'b') guardarCtrl();
};
lienzoP.addEventListener('pointerup', finPuntero); lienzoP.addEventListener('pointercancel', finPuntero);
lienzoP.addEventListener('contextmenu', (ev) => ev.preventDefault());
addEventListener('keydown', (ev) => { if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'Escape'].includes(ev.code)) ev.preventDefault(); if (!E.teclas.has(ev.code)) E.recien.add(ev.code); E.teclas.add(ev.code); Sonido.iniciar(); });
addEventListener('keyup', (ev) => { E.teclas.delete(ev.code); if (['Space', 'ArrowDown'].includes(ev.code) && escena === 'juego' && G && bolaEsperando()) soltarResorte(null); });
const apretada = (...c) => c.some((k) => E.recien.has(k));
const teclaIzq = () => ['ArrowLeft', 'KeyZ', 'ShiftLeft'].some((k) => E.teclas.has(k));
const teclaDer = () => ['ArrowRight', 'KeyM', 'Slash', 'ShiftRight'].some((k) => E.teclas.has(k));
const clicEn = (x, y, w, h) => { const c = E.clic; return !!c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.x0 >= x - 6 && c.x0 < x + w + 6 && c.y0 >= y - 6 && c.y0 < y + h + 6; };
function apretando(x, y, w, h) { for (const p of E.punteros.values()) if (!p.rol && p.mov < 14 && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return true; return false; }

/* --------------------------------------------------------- piezas déco */
function marcoDeco(x, y, w, h, c) {
  const k = c / 2;
  g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w - c, y + k); g.lineTo(x + w - k, y + k); g.lineTo(x + w - k, y + c); g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h - c); g.lineTo(x + w - k, y + h - c); g.lineTo(x + w - k, y + h - k); g.lineTo(x + w - c, y + h - k); g.lineTo(x + w - c, y + h);
  g.lineTo(x + c, y + h); g.lineTo(x + c, y + h - k); g.lineTo(x + k, y + h - k); g.lineTo(x + k, y + h - c); g.lineTo(x, y + h - c);
  g.lineTo(x, y + c); g.lineTo(x + k, y + c); g.lineTo(x + k, y + k); g.lineTo(x + c, y + k); g.closePath();
}
function panel(x, y, w, h, alfa) {
  marcoDeco(x, y, w, h, 12);
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(14,18,18,' + (alfa || 0.96) + ')'); gr.addColorStop(1, 'rgba(3,4,4,' + (alfa || 0.96) + ')');
  g.fillStyle = gr; g.fill(); g.strokeStyle = ORO; g.lineWidth = 1.6; g.stroke();
  marcoDeco(x + 5, y + 5, w - 10, h - 10, 9); g.strokeStyle = 'rgba(232,184,80,0.45)'; g.lineWidth = 0.8; g.stroke();
}
function placa(x, y, w, h, txt, o) {
  o = o || {};
  const apr = !o.apagado && apretando(x, y, w, h);
  marcoDeco(x, y, w, h, 8);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  if (apr) { gr.addColorStop(0, '#2a9c78'); gr.addColorStop(1, '#0c4a38'); } else { gr.addColorStop(0, o.col || '#16191b'); gr.addColorStop(1, '#040505'); }
  g.fillStyle = gr; g.fill(); g.strokeStyle = o.apagado ? '#5a4a2a' : ORO; g.lineWidth = 1.5; g.stroke();
  marcoDeco(x + 4, y + 4, w - 8, h - 8, 6); g.strokeStyle = 'rgba(232,184,80,0.35)'; g.lineWidth = 0.7; g.stroke();
  const tam = tamDecoQueEntra(txt, o.tam || 17, w - 26, 0.06);
  textoDeco(g, txt, x + w / 2, y + (o.sub ? h * 0.37 : h / 2), tam, { oro: !apr && !o.apagado, col: o.apagado ? '#7a6a4a' : MARFIL, esp: 0.06 });
  if (o.sub) texto(g, o.sub, x + w / 2, y + h * 0.73, { tam: tamQueEntra(g, o.sub, 8.5, w - 24), col: ESM_CLARO });
  const si = !o.apagado && clicEn(x, y, w, h);
  if (si) { Sonido.sfx('boton'); vibrar(8); }
  return si;
}
function ficha(x, y, w, h, txt, sel) {
  marcoDeco(x, y, w, h, 5);
  g.fillStyle = sel ? ORO : 'rgba(10,12,12,0.9)'; g.fill(); g.strokeStyle = sel ? ORO_CLARO : 'rgba(232,184,80,0.6)'; g.lineWidth = 1; g.stroke();
  texto(g, txt, x + w / 2, y + h / 2 + 0.5, { tam: tamQueEntra(g, txt, 9.5, w - 8, '700'), col: sel ? '#1a1206' : MARFIL, peso: '700' });
  const si = !sel && clicEn(x, y, w, h);
  if (si) { Sonido.sfx('boton'); vibrar(8); }
  return si;
}
function tituloDorado(y, t) {
  g.save(); g.translate(W / 2, y); g.rotate(t * 0.05); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; g.fillStyle = 'rgba(255,214,120,0.045)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.05) * 260, Math.sin(a - 0.05) * 260); g.lineTo(Math.cos(a + 0.05) * 260, Math.sin(a + 0.05) * 260); g.fill(); }
  g.restore();
  textoDeco(g, 'DORADO', W / 2, y, 60, { oro: true, esp: 0.06, sombra: [2, 3], sombraCol: 'rgba(0,0,0,0.8)', borde: '#1a1206', bordeAncho: 3 });
  g.strokeStyle = ORO; g.lineWidth = 1;
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + d * 30, y + 34); g.lineTo(W / 2 + d * 140, y + 34); g.stroke(); g.beginPath(); g.moveTo(W / 2 + d * 50, y + 38); g.lineTo(W / 2 + d * 120, y + 38); g.stroke(); }
  lampara(g, W / 2, y + 36, 'rombo', 'esm', true, 4);
  texto(g, tr('subtitulo'), W / 2, y + 52, { tam: 10, col: MARFIL, esp: 3.5 });
}

/* ------------------------------------------------------------ transición */
function irA(nueva, alMedio) {
  if (trans) return;
  trans = { t: 0, dur: 0.32, alMedio: () => { if (alMedio) alMedio(); if (nueva) { escena = nueva; tEsc = 0; if (AL_ENTRAR[nueva]) AL_ENTRAR[nueva](); } }, hecho: false };
  Sonido.sfx('boton');
}
/* las puertas del ascensor del hotel: se cierran y se abren */
function dibujarTrans(tz) {
  const d = tz.dur, k = tz.t < d ? salida(tz.t / d) : 1 - salida((tz.t - d) / d), m = (W / 2 + 2) * k;
  g.drawImage(puertaImg, m - (W / 2 + 2), 0, W / 2 + 2, H);
  g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(puertaImg, m - (W / 2 + 2), 0, W / 2 + 2, H); g.restore();
}

/* ------------------------------------------------------- efectos sueltos */
function chispazo(L, x, y, n, v, cols) { for (let i = 0; i < n && L.length < 400; i++) { const a = Math.random() * Math.PI * 2, s = azar(0.3, 1) * v; L.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, vida: azar(0.3, 0.7), col: cols[(Math.random() * cols.length) | 0], tam: azar(1, 2.4) }); } }
function pasoChispas(L, dt) { for (let i = L.length - 1; i >= 0; i--) { const c = L[i]; c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt; c.vx *= 0.97; if (c.t > c.vida) L.splice(i, 1); } }
function dibujarChispas(L) { g.globalCompositeOperation = 'lighter'; for (const c of L) { g.globalAlpha = 1 - c.t / c.vida; g.fillStyle = c.col; g.fillRect(c.x - c.tam / 2, c.y - c.tam / 2, c.tam, c.tam); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }

/* ------------------------------------------------------------------ intro */
let intro = null, musicaIntro = null;
function escenaIntro(dt) {
  if (E.toque || apretada('Enter', 'Space', 'Escape')) { intro.saltar(); if (intro.listo && musicaIntro) musicaIntro.cortar(); }
  intro.pasar(dt); intro.dibujar(g);
  if (intro.listo && !trans) irA('idioma');
}
function fondoSala(t) {
  g.save(); g.translate(0, Y0); g.drawImage(mesaFondo, 0, 0, W, MESA_H); g.restore();
  g.fillStyle = 'rgba(2,3,3,0.72)'; g.fillRect(0, 0, W, H);
}
function escenaIdioma(t) {
  fondoSala(t);
  tituloDorado(H * 0.17, t);
  const y0 = Math.round(H * 0.4);
  ['es', 'en', 'pt'].forEach((l, i) => texto(g, TXT[l].idioma, W / 2, y0 + i * 18, { tam: 10, col: i === 1 ? ESM_CLARO : MARFIL }));
  const nombres = { es: 'ESPAÑOL', en: 'ENGLISH', pt: 'PORTUGUÊS' };
  ['es', 'en', 'pt'].forEach((l, i) => { if (placa(70, y0 + 74 + i * 66, W - 140, 50, nombres[l], { tam: 18, col: l === IDIOMA ? '#123a2e' : null })) { IDIOMA = l; Guardado.escribir('idioma', l); irA('menu'); } });
}

/* ----------------------------------- el bot (prueba y la mesa del menú) */
const botT = [0, 0];
function botFlippers(bolas, dt) {
  MESA.flippers.forEach((f, i) => {
    botT[i] -= dt;
    const [tx] = puntaFlipper(f), x0 = Math.min(f.px, tx) - 4, x1 = Math.max(f.px, tx) + 8;
    const pega = bolas.some((b) => b.viva && !b.enLanzador && !b.atrapada && b.y > 482 && b.y < 548 && b.x > x0 && b.x < x1 && b.vy > -80);
    if (pega && botT[i] <= -0.12) botT[i] = 0.18;
    f.apretado = botT[i] > 0;
  });
}

/* ---------------------------------------------------- la mesa del menú */
let ATR = null;
function prepararMenu() { armarMesa(); ATR = { bolas: [], chispas: [], espera: 0.4 }; }
function pasoAtraccion(dt) {
  const A = ATR;
  if (!A.bolas.some((b) => b.viva)) { A.espera -= dt; if (A.espera <= 0) { const b = nuevaBola(LANZADOR.x, LANZADOR.y); b.enLanzador = true; A.bolas = [b]; A.espera = 0.7; } }
  for (const b of A.bolas) if (b.viva && b.enLanzador) { A.espera -= dt; if (A.espera <= 0) { b.enLanzador = false; b.vy = -azar(1250, 1600); A.espera = 1.2; } }
  botFlippers(A.bolas, dt);
  pasoMesa(A.bolas, dt, (tipo, d, b) => {
    if (tipo === 'hongo') chispazo(A.chispas, b.x, b.y, 6, 120, [ORO_CLARO, ESM_CLARO]);
    if (tipo === 'blanco' && blancos().every((s) => s.caido)) setTimeout(() => blancos().forEach((s) => { s.caido = false; }), 1500);
  });
  A.bolas = A.bolas.filter((b) => b.viva);
  pasoChispas(A.chispas, dt);
  bajarGolpes(dt);
}
function bajarGolpes(dt) { for (const s of MESA.segs) if (s.golpe) s.golpe = Math.max(0, s.golpe - dt); for (const c of MESA.circs) if (c.golpe) c.golpe = Math.max(0, c.golpe - dt); }

/* ------------------------------------------------------------------- menú */
function escenaMenu(t) {
  pasoAtraccion(dtCuadro);
  g.save(); g.translate(0, Y0); dibujarMesa(null, ATR.bolas, t); dibujarChispas(ATR.chispas); g.restore();
  const v = g.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(2,3,3,0.92)'); v.addColorStop(0.55, 'rgba(2,3,3,0.7)'); v.addColorStop(1, 'rgba(2,3,3,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  tituloDorado(H * 0.14, t);
  const y0 = Math.round(H * 0.32), bw = W - 64, x = 32;
  if (placa(x, y0, bw, 58, tr('clasico'), { sub: tr('record') + ' ' + miles(DATOS.rec.clasico) + ' · ' + tr('clasicoD'), tam: 22 })) irA('juego', () => empezar('clasico'));
  if (placa(x, y0 + 70, bw, 58, tr('reloj'), { sub: tr('record') + ' ' + miles(DATOS.rec.reloj) + ' · ' + tr('relojD'), tam: 22 })) irA('juego', () => empezar('reloj'));
  const hoyR = DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0;
  if (placa(x, y0 + 140, bw, 58, tr('diario'), { sub: tr('hoyRec', miles(hoyR)) + ' · ' + tr('diarioD'), tam: 22 })) irA('juego', () => empezar('diario'));
  const yb = y0 + 222, mw = (bw - 12) / 2;
  if (placa(x, yb, mw, 40, tr('controles'), { tam: 13 })) irA('controles');
  if (placa(x + mw + 12, yb, mw, 40, tr('idiomaBtn'), { tam: 13 })) irA('idioma');
  if (DATOS.rangoMax > 0) texto(g, tr('rango') + ': ' + tr('rangos')[DATOS.rangoMax], W / 2, yb + 60, { tam: 9.5, col: ESM_CLARO });
}

/* ----------------------------------------------------------- la partida */
const MISIONES = { hongos: 15, blancos: 3, carriles: 1, copa: 2, orbitas: 2, molinete: 30 };
const ORDEN_MISIONES = ['hongos', 'blancos', 'carriles', 'copa', 'orbitas', 'molinete'];
function modoRecord(m) { return m === 'diario' ? (DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0) : DATOS.rec[m]; }
function empezar(modo) {
  armarMesa();
  let orden = ORDEN_MISIONES.slice();
  if (modo === 'diario') { const r = rngSemilla(hoy()); for (let i = orden.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; } }
  G = {
    modo, puntos: 0, pop: 0, bolaN: 1, bolasTotal: modo === 'reloj' ? 0 : 3, extras: 0, extraDada: false, bolas: [], cola: 0, tCola: 0,
    tiempo: modo === 'reloj' ? 150 : 0, fase: 'juego', tFin: 0, finMotivo: null, t: 0,
    mult: 1, carriles: [false, false, false, false], maestro: 0, maestroVivo: false,
    multiLista: false, multiActiva: false, jackpot: 100000, jackpotMax: 0, reponer: 0,
    salvo: 0, orden, misionI: 0, vuelta: 0, cuenta: 0, meta: MISIONES[orden[0]], misionesHechas: 0, rango: 0,
    stats: { hongos: 0, carriles: 0, blancos: 0, orbitas: 0, copas: 0 }, orbIzqT: -9, ultPared: 0,
    textos: [], chispas: [], banners: [], banner: null, sacudida: 0, flash: 0, tirado: 0, molAng: 0, molVel: 0,
    bonus: null, ayuda: !DATOS.ayuda, record: modoRecord(modo), apretados: [false, false],
  };
  bolaNueva();
}
const bolaEsperando = () => G && G.bolas.find((b) => b.viva && b.enLanzador && !b.auto);
function bolaNueva() {
  const b = nuevaBola(LANZADOR.x, LANZADOR.y); b.enLanzador = true;
  G.bolas.push(b); G.tirado = 0;
  G.salvo = G.modo === 'reloj' ? 5 : 8; G.maestro = Math.floor(Math.random() * 4); G.maestroVivo = true;
  anunciar(textoMision(), G.cuenta + '/' + G.meta);
}
function bolaAuto(espera) { const b = nuevaBola(LANZADOR.x, LANZADOR.y); b.enLanzador = true; b.auto = true; b.espera = espera == null ? 0.5 : espera; G.bolas.push(b); return b; }
function lanzar(b, fuerza) {
  b.enLanzador = false; b.vx = 0; b.vy = -(620 + 1050 * fuerza); b.y = LANZADOR.y;
  Sonido.sfx('lanza'); vibrar(20);
}
function soltarResorte(pt) {
  const b = bolaEsperando(); if (!b) return;
  const f = CTRL.resorte === 1 ? azar(0.4, 0.62) : G.tirado;
  if (f < 0.08) { G.tirado = 0; return; }
  lanzar(b, f); G.tirado = 0;
}
function sumar(n, x, y) {
  G.puntos += n; G.pop = 1;
  if (x != null && n >= 1000) G.textos.push({ txt: miles(n), x, y, t: 0, vida: 0.9, tam: n >= 10000 ? 13 : 10 });
}
function anunciar(txt, sub, o) { G.banners.push(Object.assign({ txt, sub, t: 0, vida: 1.5 }, o || {})); }
function avanzarMision(id, n) {
  if (G.orden[G.misionI] !== id || G.fase !== 'juego') return;
  G.cuenta += n || 1;
  if (G.cuenta < G.meta) return;
  G.misionesHechas++;
  sumar(50000 * (G.rango + 1));
  if (G.rango < 5) G.rango++;
  anunciar(tr('cumplida'), tr('ascenso', tr('rangos')[G.rango]), { grande: true });
  Sonido.sfx('mision'); vibrar([30, 40, 30]); G.flash = 0.6;
  if (G.misionesHechas === 3 && !G.extraDada && G.modo !== 'reloj') { G.extraDada = true; G.extras++; anunciar(tr('bolaExtra')); Sonido.sfx('extra'); }
  G.misionI++; if (G.misionI >= G.orden.length) { G.misionI = 0; G.vuelta++; }
  G.cuenta = 0; G.meta = Math.round(MISIONES[G.orden[G.misionI]] * (1 + G.vuelta * 0.5));
  anunciar(textoMision(), '0/' + G.meta);
}
function textoMision() { const id = G.orden[G.misionI]; return tr('m_' + id, G.meta); }
function jackpot(x, y) {
  sumar(G.jackpot); G.jackpotMax = Math.max(G.jackpotMax, G.jackpot);
  anunciar(tr('jackpot'), miles(G.jackpot), { grande: true });
  G.jackpot += 50000; Sonido.sfx('jackpot'); vibrar([40, 30, 80]); G.flash = 1; G.sacudida = 4;
  chispazo(G.chispas, x, y, 60, 320, [ORO_CLARO, ORO, '#ffffff', ESM_CLARO]);
}
function empezarMultibola() {
  G.multiLista = false; G.multiActiva = true; G.jackpot = 100000; G.salvo = Math.max(G.salvo, 10);
  G.cola = 2; G.tCola = 0.6;
  anunciar(tr('multibola'), null, { grande: true }); Sonido.sfx('multibola'); vibrar([50, 40, 50, 40, 80]); G.flash = 1;
  blancos().forEach((s) => { s.caido = false; });
}
function alEvento(tipo, d, b) {
  const P = G;
  switch (tipo) {
    case 'hongo': sumar(1000, d.x, d.y - 24); P.stats.hongos++; avanzarMision('hongos'); Sonido.sfx('hongo', d.i); vibrar(10); chispazo(P.chispas, b.x, b.y, 8, 140, [ORO_CLARO, ESM_CLARO]); break;
    case 'goma': sumar(100); Sonido.sfx('goma'); vibrar(6); chispazo(P.chispas, b.x, b.y, 5, 100, [ORO_CLARO]); break;
    case 'blanco': {
      sumar(3000, d.ax - 16, (d.ay + d.by) / 2); P.stats.blancos++; avanzarMision('blancos'); Sonido.sfx('blanco'); vibrar(12);
      if (blancos().every((s) => s.caido)) {
        sumar(15000); P.reponer = 2.5;
        if (!P.multiActiva && !P.multiLista) { P.multiLista = true; anunciar(tr('multiLista')); }
      }
      break;
    }
    case 'carril': {
      sumar(2000, d.x, d.y + 26); P.stats.carriles++; Sonido.sfx('carril');
      if (P.maestroVivo) { P.maestroVivo = false; if (d.k === P.maestro) { sumar(25000); anunciar(tr('tiroMaestro'), miles(25000)); Sonido.sfx('extra'); } }
      P.carriles[d.k] = true;
      if (P.carriles.every(Boolean)) { P.carriles = [false, false, false, false]; P.mult = Math.min(5, P.mult + 1); sumar(10000); anunciar(tr('mult', P.mult)); Sonido.sfx('mult'); avanzarMision('carriles'); }
      break;
    }
    case 'orbIzq': if (b.vy < 0) P.orbIzqT = P.t; break;
    case 'orbDer':
      if (P.t - P.orbIzqT < 2.5) {
        P.orbIzqT = -9; sumar(10000, 290, 90); P.stats.orbitas++; avanzarMision('orbitas');
        if (P.multiActiva) jackpot(290, 90); else { anunciar(tr('orbita')); Sonido.sfx('mult'); }
      }
      break;
    case 'molinete': sumar(200 * d); P.molVel = Math.min(60, P.molVel + d * 6); avanzarMision('molinete', d); Sonido.sfx('molinete', d); break;
    case 'copa':
      sumar(5000, COPA.x, COPA.y - 24); P.stats.copas++; avanzarMision('copa'); Sonido.sfx('copa'); vibrar(15);
      if (P.multiActiva) jackpot(COPA.x, COPA.y); else if (P.multiLista) empezarMultibola();
      break;
    case 'expulsa': Sonido.sfx('expulsa'); break;
    case 'pared': if (P.t - P.ultPared > 0.06) { P.ultPared = P.t; Sonido.sfx('pared', d); } break;
    case 'vuelve': if (b.auto) b.espera = 0.4; break;
    case 'cae': caeBola(b); break;
  }
}
function caeBola(b) {
  const P = G;
  if (P.fase !== 'juego') return;
  if (P.salvo > 0) { bolaAuto(0.6); anunciar(tr('teSalvo')); Sonido.sfx('salvo'); vibrar(30); return; }
  const vivas = P.bolas.filter((x) => x.viva).length + P.cola;
  if (vivas > 0) { if (P.multiActiva && vivas === 1) P.multiActiva = false; Sonido.sfx('baja'); return; }
  P.multiActiva = false;
  Sonido.sfx('cae'); vibrar(80);
  if (P.modo === 'reloj') { anunciar(tr('perdida')); bolaNueva(); return; }
  const lineas = [['hongos', P.stats.hongos, 100], ['carriles', P.stats.carriles, 500], ['blancos', P.stats.blancos, 800], ['orbitas', P.stats.orbitas, 2000], ['copas', P.stats.copas, 1500]];
  const sub = lineas.reduce((a, l) => a + l[1] * l[2], 0);
  P.bonus = { lineas, sub, total: sub * P.mult, t: 0, sumado: false };
  P.fase = 'bonus';
}
function terminarBonus() {
  const P = G, B = P.bonus;
  if (!B.sumado) { B.sumado = true; P.puntos += B.total; }
  P.stats = { hongos: 0, carriles: 0, blancos: 0, orbitas: 0, copas: 0 }; P.mult = 1; P.bonus = null; P.fase = 'juego';
  P.bolas = [];
  if (P.extras > 0) { P.extras--; anunciar(tr('bolaExtra')); bolaNueva(); return; }
  P.bolaN++;
  if (P.bolaN > P.bolasTotal) { P.fase = 'fin'; P.finMotivo = 'fin'; P.tFin = 0; return; }
  bolaNueva();
}
function terminar() {
  const P = G; if (P.terminado) return; P.terminado = true;
  DATOS.partidas++; DATOS.rangoMax = Math.max(DATOS.rangoMax, P.rango); DATOS.jackpotMax = Math.max(DATOS.jackpotMax, P.jackpotMax);
  if (P.modo === 'diario') { if (DATOS.diaFecha !== hoy()) { DATOS.diaFecha = hoy(); DATOS.diaRecord = 0; } P.esRecord = P.puntos > DATOS.diaRecord; if (P.esRecord) DATOS.diaRecord = P.puntos; }
  else { P.esRecord = P.puntos > DATOS.rec[P.modo]; if (P.esRecord) DATOS.rec[P.modo] = P.puntos; }
  guardarDatos();
  irA('fin');
}
function irPausa() { escena = 'pausa'; tEsc = 0; for (const f of MESA.flippers) f.apretado = false; }

function actualizarPartida(dt) {
  const P = G;
  if (P.ayuda) { if (E.clic || apretada('Enter', 'Space')) { P.ayuda = false; DATOS.ayuda = true; guardarDatos(); } return; }
  if (P.fase === 'juego' && (apretada('Escape', 'KeyP') || clicEn(W - 46, 0, 46, Math.max(36, Math.min(46, Y0))))) { irPausa(); return; }
  P.t += dt;
  // los flippers: dedos, teclas o el bot
  if (window.__dorado.bot) botFlippers(P.bolas, dt);
  else {
    let iz = teclaIzq(), de = teclaDer();
    for (const p of E.punteros.values()) { if (p.rol === 'izq') iz = true; if (p.rol === 'der') de = true; }
    if (P.fase !== 'juego') iz = de = false;
    MESA.flippers[0].apretado = iz; MESA.flippers[1].apretado = de;
  }
  MESA.flippers.forEach((f, i) => {
    if (f.apretado && !P.apretados[i]) { Sonido.sfx('flip'); vibrar(6); if (!P.maestroVivo || !bolaEsperando()) { const c = P.carriles; P.carriles = i ? [c[3], c[0], c[1], c[2]] : [c[1], c[2], c[3], c[0]]; } else P.maestro = (P.maestro + (i ? 1 : 3)) % 4; }
    P.apretados[i] = f.apretado;
  });
  // el resorte
  const esp = bolaEsperando();
  if (esp) {
    if (window.__dorado.bot) { P.tirado = Math.min(1, P.tirado + dt * 1.4); if (P.tirado >= 0.95) { lanzar(esp, azar(0.4, 1)); P.tirado = 0; } }
    else if (CTRL.resorte === 0) {
      let tir = null; for (const p of E.punteros.values()) if (p.rol === 'resorte') tir = clamp((p.y - p.y0) / 70, 0, 1);
      if (E.teclas.has('Space') || E.teclas.has('ArrowDown')) tir = Math.min(1, P.tirado + dt * 1.3);
      if (tir != null) { if (Math.floor(tir * 8) !== Math.floor(P.tirado * 8)) Sonido.sfx('resorte', tir); P.tirado = tir; }
    }
    esp.y = LANZADOR.y + P.tirado * 26;
  }
  for (const b of P.bolas) if (b.viva && b.auto && b.enLanzador) { b.espera -= dt; if (b.espera <= 0) lanzar(b, azar(0.7, 0.9)); }
  if (P.cola > 0) { P.tCola -= dt; if (P.tCola <= 0) { P.cola--; P.tCola = 0.7; bolaAuto(0.15); } }
  if (P.salvo > 0 && P.bolas.some((b) => b.viva && !b.enLanzador)) P.salvo = Math.max(0, P.salvo - dt);
  if (P.reponer > 0) { P.reponer -= dt; if (P.reponer <= 0) blancos().forEach((s) => { s.caido = false; }); }
  if (P.modo === 'reloj' && P.fase === 'juego') {
    const antes = Math.ceil(P.tiempo); P.tiempo = Math.max(0, P.tiempo - dt);
    if (P.tiempo <= 10 && Math.ceil(P.tiempo) !== antes) Sonido.sfx('tic');
    if (P.tiempo <= 0) { P.fase = 'fin'; P.finMotivo = 'tiempo'; P.tFin = 0; anunciar(tr('tiempo'), null, { grande: true }); }
  }
  // la física (en el bonus y al final la mesa sigue, pero sin flippers)
  pasoMesa(P.bolas, dt, alEvento);
  P.bolas = P.bolas.filter((b) => b.viva);
  // búsqueda de bola: si una queda quieta mucho rato (trabada), se la sacude
  for (const b of P.bolas) {
    if (b.enLanzador || b.atrapada) { b.quieta = 0; continue; }
    b.quieta = Math.hypot(b.vx, b.vy) < 12 ? (b.quieta || 0) + dt : 0;
    if (b.quieta > 3) { b.quieta = 0; b.vy = -420; b.vx = azar(-220, 220); if (window.__dorado.trabas) window.__dorado.trabas.push([Math.round(b.x), Math.round(b.y)]); }
  }
  bajarGolpes(dt);
  P.molAng += P.molVel * dt; P.molVel *= Math.pow(0.4, dt);
  pasoChispas(P.chispas, dt);
  for (let i = P.textos.length - 1; i >= 0; i--) { P.textos[i].t += dt; if (P.textos[i].t > P.textos[i].vida) P.textos.splice(i, 1); }
  if (!P.banner && P.banners.length) P.banner = P.banners.shift();
  if (P.banner) { P.banner.t += dt; if (P.banner.t > P.banner.vida) P.banner = null; }
  P.sacudida *= Math.pow(0.85, dt * 60); P.flash = Math.max(0, P.flash - dt * 2); P.pop = Math.max(0, P.pop - dt * 4);
  Sonido.musica(P.multiActiva ? TEMAS.multi : TEMAS.juego);
  if (P.fase === 'bonus') { P.bonus.t += dt; if (E.clic && P.bonus.t > 0.3) P.bonus.t = Math.max(P.bonus.t, 3); if (P.bonus.t > 3.4) terminarBonus(); }
  if (P.fase === 'fin') { P.tFin += dt; if (P.tFin > 1.6) terminar(); }
}

/* ------------------------------------------------------ dibujo de la mesa */
function dibujarMesa(P, bolas, t) {
  g.drawImage(mesaFondo, 0, 0, W, MESA_H);
  const parpa = (v) => Math.floor(t * v) % 2 === 0;
  // carriles J · A · Z
  ['J', 'A', 'Z', 'Z'].forEach((l, k) => {
    const s = MESA.sensores[k], on = P ? (P.carriles[k] || (P.maestroVivo && P.maestro === k && parpa(6))) : parpa(3 + k);
    lampara(g, s.x, 124, 'circulo', 'oro', on, 7); textoDeco(g, l, s.x, 124, 8, { col: on ? '#5a3a0a' : 'rgba(232,184,80,0.6)' });
  });
  // los blancos O · R · O con sus lámparas
  blancos().forEach((s, k) => { lampara(g, 272, (s.ay + s.by) / 2, 'rombo', 'rubi', s.caido, 5); dibujarBlanco(g, s, 'ORO'[k]); });
  // la copa: brilla cuando da multibola o jackpot
  const copaOn = P && (P.multiActiva || (P.multiLista && parpa(4)));
  if (copaOn) { g.globalCompositeOperation = 'lighter'; brillo(g, COPA.x, COPA.y, 34, P.multiActiva ? LUZ.rubi : LUZ.oro, 0.55); g.globalCompositeOperation = 'source-over'; }
  copaDibujo(g, COPA.x, COPA.y - 1, 6, copaOn ? ORO_CLARO : 'rgba(232,184,80,0.7)');
  // la flecha de la órbita
  const orbOn = P ? ((P.multiActiva && parpa(5)) || (P.orden[P.misionI] === 'orbitas' && parpa(2))) : parpa(2);
  lampara(g, 40, 364, 'flecha', P && P.multiActiva ? 'rubi' : 'esm', orbOn, 7);
  // multiplicador, rangos, bola extra y bola salvada
  for (let i = 0; i < 4; i++) lampara(g, 137 + i * 20, 440, 'rombo', 'oro', P ? P.mult >= i + 2 : parpa(2 + i), 5);
  for (let i = 0; i < 6; i++) lampara(g, 117 + i * 20, 470, 'circulo', 'esm', P ? P.rango > i : false, 3.5);
  if (P && P.extras > 0) { lampara(g, 167, 505, 'circulo', 'rubi', true, 5); texto(g, 'EXTRA', 167, 517, { tam: 6, col: MARFIL }); }
  lampara(g, 167, 592, 'rombo', 'esm', P ? P.salvo > 0 && (P.salvo > 2 || parpa(6)) : false, 4.5);
  // las gomas
  for (const s of MESA.segs) if (s.tipo === 'goma') { g.lineCap = 'round'; g.strokeStyle = '#1a1206'; g.lineWidth = 7; g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke(); g.strokeStyle = s.golpe ? '#ffffff' : MARFIL; g.lineWidth = 4.5; g.stroke(); }
  for (const c of MESA.circs) dibujarHongo(g, c, t);
  dibujarMolinete(g, P ? P.molAng : t * 2);
  const esp = P ? bolaEsperando() : bolas.find((b) => b.enLanzador);
  dibujarResorte(g, P ? P.tirado : 0, !!esp);
  for (const f of MESA.flippers) dibujarFlipper(g, f);
  for (const b of bolas) if (b.viva) dibujarBola(g, b);
}
function marquesina(P, t) {
  const h = Y0;
  g.fillStyle = '#020303'; g.fillRect(0, 0, W, h);
  marcoDeco(4, 3, W - 8, h - 6, Math.min(10, h / 4)); g.strokeStyle = ORO; g.lineWidth = 1.4; g.stroke();
  // las bombitas que corren por el borde
  const n = Math.floor((W - 30) / 14);
  for (let i = 0; i < n; i++) {
    const on = (i + Math.floor(t * 9)) % 4 === 0 || (P.flash > 0.3);
    g.fillStyle = on ? '#ffe9a8' : '#4a3a18'; g.beginPath(); g.arc(15 + i * 14, 8, 1.6, 0, Math.PI * 2); g.fill();
    if (h > 60) { g.beginPath(); g.arc(15 + i * 14, h - 8, 1.6, 0, Math.PI * 2); g.fill(); }
  }
  const total = P.modo === 'reloj' ? '∞' : P.bolasTotal, bola = P.modo === 'reloj' ? '' : tr('bola', Math.min(P.bolaN, P.bolasTotal), total);
  const extra = (P.mult > 1 ? '×' + P.mult : '') + (P.extras ? '  +' + P.extras : '');
  const reloj = P.modo === 'reloj' ? Math.floor(P.tiempo / 60) + ':' + String(Math.floor(P.tiempo % 60)).padStart(2, '0') : '';
  // la pausa: dos barras en un rombo
  const pc = Math.min(18, h / 2 - 2), px = W - 26, py = Math.min(h / 2, 22);
  g.save(); g.translate(px, py); g.rotate(Math.PI / 4); g.fillStyle = '#0d1010'; g.fillRect(-pc * 0.6, -pc * 0.6, pc * 1.2, pc * 1.2); g.strokeStyle = ORO; g.lineWidth = 1.2; g.strokeRect(-pc * 0.6, -pc * 0.6, pc * 1.2, pc * 1.2); g.restore();
  g.fillStyle = ORO; g.fillRect(px - 4, py - 5, 2.6, 10); g.fillRect(px + 1.4, py - 5, 2.6, 10);
  const esc = 1 + P.pop * 0.08;
  if (h >= 118) {
    textoDeco(g, miles(P.puntos), W / 2, h * 0.32, Math.min(40, h * 0.24) * esc, { oro: true, esp: 0.04, sombra: [1.5, 2] });
    texto(g, [bola, reloj, extra, tr('rangos')[P.rango]].filter(Boolean).join('   ·   '), W / 2, h * 0.56, { tam: 9.5, col: ESM_CLARO });
    barraMision(P, 30, h * 0.72, W - 60);
  } else if (h >= 64) {
    textoDeco(g, miles(P.puntos), 18, h * 0.36, 24 * esc, { oro: true, alin: 'left', esp: 0.03 });
    texto(g, [bola, reloj, extra].filter(Boolean).join(' · '), W - 50, h * 0.36, { tam: 9, col: ESM_CLARO, alin: 'right' });
    barraMision(P, 18, h * 0.64, W - 36, true);
  } else {
    textoDeco(g, miles(P.puntos), 14, h / 2, 20 * esc, { oro: true, alin: 'left', esp: 0.03 });
    texto(g, [bola, reloj, extra].filter(Boolean).join(' · '), W - 50, h / 2, { tam: 9, col: ESM_CLARO, alin: 'right' });
  }
}
function barraMision(P, x, y, w, chico) {
  const txt = textoMision();
  texto(g, txt, x + w / 2, y, { tam: tamQueEntra(g, txt, chico ? 8.5 : 10, w - 60), col: MARFIL });
  const by = y + (chico ? 9 : 11), k = clamp(P.cuenta / P.meta, 0, 1);
  g.fillStyle = 'rgba(232,184,80,0.15)'; g.fillRect(x + 20, by, w - 40, 3);
  g.fillStyle = ORO; g.fillRect(x + 20, by, (w - 40) * k, 3);
  texto(g, P.cuenta + '/' + P.meta, x + w - 6, by + 1.5, { tam: 7.5, col: ORO, alin: 'right', esp: 0.5 });
}
function dibujarBanner(P) {
  const b = P.banner; if (!b) return;
  const k = b.t / b.vida, a = k < 0.12 ? k / 0.12 : k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1, s = b.t < 0.18 ? rebote(b.t / 0.18) : 1;
  const tam = b.grande ? 28 : 21, w = Math.min(W - 30, anchoDeco(b.txt, tam, 0.05) + 60), h = b.sub ? 74 : 52, y = Y0 + 290;
  g.save(); g.globalAlpha = a; g.translate(W / 2, y); g.scale(s, s);
  panel(-w / 2, -h / 2, w, h, 0.92);
  textoDeco(g, b.txt, 0, b.sub ? -12 : 0, tamDecoQueEntra(b.txt, tam, w - 30, 0.05), { oro: true, esp: 0.05 });
  if (b.sub) texto(g, b.sub, 0, 16, { tam: 11, col: ESM_CLARO });
  g.restore();
}
function dibujarBonus(P) {
  const B = P.bonus, w = W - 60, h = 250, x = 30, y = Y0 + 170;
  panel(x, y, w, h, 0.95);
  textoDeco(g, tr('bonus'), W / 2, y + 30, 26, { oro: true, esp: 0.1 });
  B.lineas.forEach(([id, n, v], i) => {
    if (B.t < 0.3 + i * 0.3) return;
    if (!B['s' + i]) { B['s' + i] = true; Sonido.sfx('tic'); }
    const yy = y + 62 + i * 24;
    texto(g, tr(id), x + 22, yy, { tam: 10, alin: 'left', col: MARFIL });
    texto(g, n + ' × ' + miles(v), x + w - 22, yy, { tam: 10, alin: 'right', col: ESM_CLARO });
  });
  if (B.t > 1.9) { texto(g, '× ' + P.mult, W / 2, y + 190, { tam: 12, col: ORO }); }
  if (B.t > 2.3) { if (!B.sonoT) { B.sonoT = true; Sonido.sfx('carril'); } textoDeco(g, tr('total') + ' ' + miles(B.total), W / 2, y + 222, 20, { oro: true, esp: 0.05 }); }
}
function dibujarBotonesDedo(alfa) {
  if (CTRL.modo !== 1) return;
  const lista = ['bIzq', 'bDer']; if (escena === 'editor' || bolaEsperando()) lista.push('bRes');
  for (const b of lista) {
    const p = posBoton(b), apr = [...E.punteros.values()].some((q) => q.rol === (b === 'bIzq' ? 'izq' : b === 'bDer' ? 'der' : b === 'bRes' ? 'resorte' : '') || q.rol === b);
    g.globalAlpha = alfa == null ? ALFAS[CTRL.transp] : alfa;
    g.fillStyle = apr ? 'rgba(95,224,180,0.5)' : 'rgba(5,8,8,0.7)'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ORO; g.lineWidth = 2; g.stroke(); g.lineWidth = 0.8; g.beginPath(); g.arc(p.x, p.y, p.r - 5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = ORO_CLARO; g.beginPath();
    if (b === 'bRes') { g.moveTo(p.x - 8, p.y - 5); g.lineTo(p.x + 8, p.y - 5); g.lineTo(p.x, p.y + 7); }
    else { const d = b === 'bIzq' ? -1 : 1; g.moveTo(p.x + d * 9, p.y); g.lineTo(p.x - d * 6, p.y - 9); g.lineTo(p.x - d * 6, p.y + 9); }
    g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
}
function dibujarAyuda(t) {
  g.fillStyle = 'rgba(2,3,3,0.8)'; g.fillRect(0, 0, W, H);
  if (CTRL.modo === 0) {
    g.fillStyle = 'rgba(95,224,180,' + (0.08 + 0.05 * Math.sin(t * 4)) + ')'; g.fillRect(0, Y0, W / 2 - 1, MESA_H);
    g.fillStyle = 'rgba(232,184,80,' + (0.08 + 0.05 * Math.sin(t * 4 + 2)) + ')'; g.fillRect(W / 2 + 1, Y0, W / 2, MESA_H);
  } else dibujarBotonesDedo(0.9);
  const w = W - 40, h = 230, x = 20, y = Y0 + 120;
  panel(x, y, w, h, 0.95);
  let yy = y + 30;
  for (const k of [CTRL.modo === 0 ? 'ayuda1' : 'ayuda1b', CTRL.resorte === 0 ? 'ayuda2' : 'ayuda2b', 'ayuda3']) { for (const l of partir(tr(k), 34)) { texto(g, l, W / 2, yy, { tam: 11, col: MARFIL }); yy += 17; } yy += 12; }
  g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); textoDeco(g, tr('tocar'), W / 2, y + h - 24, 13, { oro: true, esp: 0.06 }); g.globalAlpha = 1;
}
function dibujarPartida(t) {
  const P = G, sx = P.sacudida > 0.3 ? (Math.random() * 2 - 1) * P.sacudida : 0, sy = P.sacudida > 0.3 ? (Math.random() * 2 - 1) * P.sacudida : 0;
  g.save(); g.translate(sx, Y0 + sy);
  dibujarMesa(P, P.bolas, t);
  dibujarChispas(P.chispas);
  for (const x of P.textos) { g.globalAlpha = 1 - x.t / x.vida; textoDeco(g, x.txt, x.x, x.y - x.t * 30, x.tam, { oro: true, borde: '#1a1206', bordeAncho: 2.5 }); }
  g.globalAlpha = 1;
  // la ayuda para lanzar
  const esp = bolaEsperando();
  if (esp && P.fase === 'juego' && !P.ayuda && CTRL.modo === 0) {
    g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
    g.fillStyle = ORO_CLARO; g.beginPath(); const ay = 470 + Math.sin(t * 5) * 4; g.moveTo(325, ay); g.lineTo(341, ay); g.lineTo(333, ay + 10); g.closePath(); g.fill();
    g.globalAlpha = 1;
    texto(g, CTRL.resorte === 0 ? tr('tirar') : tr('tocarLanzar'), 300, 452, { tam: 8, col: ORO_CLARO, alin: 'right' });
  }
  g.restore();
  if (P.flash > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,214,120,' + P.flash * 0.25 + ')'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  marquesina(P, t);
  if (Y0 < 64) { g.globalAlpha = 0.75; texto(g, textoMision() + '  ' + P.cuenta + '/' + P.meta, W / 2, Y0 + 40, { tam: 8, col: MARFIL }); g.globalAlpha = 1; }
  dibujarBotonesDedo();
  if (P.fase === 'bonus') dibujarBonus(P);
  dibujarBanner(P);
  if (P.ayuda) dibujarAyuda(t);
}

/* ------------------------------------------------------------ pausa y fin */
function escenaPausa(t) {
  dibujarPartida(t);
  g.fillStyle = 'rgba(2,3,3,0.78)'; g.fillRect(0, 0, W, H);
  textoDeco(g, tr('pausa'), W / 2, H * 0.2, 40, { oro: true, esp: 0.1 });
  const bw = 230, x = (W - bw) / 2; let y = H * 0.3;
  if (placa(x, y, bw, 46, tr('seguir')) || (apretada('Escape') && tEsc > 0)) { escena = 'juego'; tEsc = 0; return; }
  y += 58; if (placa(x, y, bw, 46, tr('reiniciar'))) { const m = G.modo; irA('juego', () => empezar(m)); }
  y += 58; if (placa(x, y, bw, 46, tr('musica') + ': ' + (Sonido.musicaSi ? tr('si') : tr('no')), { tam: 15 })) Sonido.ponerMusica(!Sonido.musicaSi);
  y += 58; if (placa(x, y, bw, 46, tr('sonido') + ': ' + (Sonido.efectosSi ? tr('si') : tr('no')), { tam: 15 })) Sonido.ponerEfectos(!Sonido.efectosSi);
  y += 58; if (placa(x, y, bw, 46, tr('menu'), { col: '#3a1016' })) irA('menu');
}
function escenaFin(t) {
  const P = G;
  fondoSala(t);
  if (!P.sonoFin && tEsc > 0.2) { P.sonoFin = true; Sonido.sfx(P.esRecord ? 'record' : 'carril'); if (P.esRecord) vibrar([30, 40, 60]); }
  const tit = P.finMotivo === 'tiempo' ? tr('tiempo') : tr('fin');
  panel(20, H * 0.08, W - 40, H * 0.62);
  textoDeco(g, tit, W / 2, H * 0.08 + 36, tamDecoQueEntra(tit, 30, W - 80, 0.08), { oro: true, esp: 0.08 });
  texto(g, tr(P.modo === 'diario' ? 'diario' : P.modo).toUpperCase(), W / 2, H * 0.08 + 62, { tam: 10, col: ESM_CLARO });
  const k = clamp(tEsc / 1, 0, 1), cy = H * 0.27;
  textoDeco(g, miles(P.puntos * salida(k)), W / 2, cy, tamDecoQueEntra(miles(P.puntos), 44, W - 80, 0.03), { oro: true, esp: 0.03, sombra: [2, 2] });
  if (P.esRecord && P.puntos > 0 && tEsc > 1.05) {
    const a = clamp((tEsc - 1.05) / 0.2, 0, 1), s = 1 + (1 - salida(a)) * 0.6;
    g.save(); g.globalAlpha = a; g.translate(W / 2, cy + 44); g.rotate(-0.04); g.scale(s, s);
    const w = anchoDeco(tr('nuevoRecord'), 17, 0.06) + 30; marcoDeco(-w / 2, -16, w, 32, 6); g.fillStyle = '#7a1420'; g.fill(); g.strokeStyle = ORO; g.lineWidth = 1.4; g.stroke();
    textoDeco(g, tr('nuevoRecord'), 0, 0, 17, { oro: true, esp: 0.06 }); g.restore();
  } else texto(g, tr('record') + '  ' + miles(modoRecord(P.modo)), W / 2, cy + 44, { tam: 11, col: ORO });
  const filas = [[tr('rango'), tr('rangos')[P.rango]], [tr('misiones'), String(P.misionesHechas)], [tr('mejorJackpot'), P.jackpotMax ? miles(P.jackpotMax) : '—']];
  filas.forEach(([a, b], i) => { const y = cy + 86 + i * 26; texto(g, a, 50, y, { tam: 10, alin: 'left', col: MARFIL }); texto(g, b, W - 50, y, { tam: 10, alin: 'right', col: ESM_CLARO }); g.strokeStyle = 'rgba(232,184,80,0.2)'; g.beginPath(); g.moveTo(50, y + 12); g.lineTo(W - 50, y + 12); g.stroke(); });
  for (let i = 0; i < 6; i++) lampara(g, W / 2 - 50 + i * 20, cy + 172, 'circulo', 'esm', P.rango > i, 4);
  const bw = 220, x = (W - bw) / 2;
  if (placa(x, H - 140, bw, 50, tr('otra'), { tam: 22 }) || apretada('Enter', 'Space')) { const m = P.modo; irA('juego', () => empezar(m)); }
  if (placa(x, H - 78, bw, 44, tr('menu'), { col: '#3a1016' }) || apretada('Escape')) irA('menu');
}

/* ------------------------------------------------- controles y el editor */
function escenaControles(t) {
  fondoSala(t);
  textoDeco(g, tr('controles'), W / 2, 44, 28, { oro: true, esp: 0.08 });
  const filas = [
    ['modo', 'modo', ['mitades', 'botones']], ['tamano', 'tam', ['chico', 'medio', 'grande']], ['transp', 'transp', ['baja', 'media', 'alta']],
    ['resorte', 'resorte', ['tirarOp', 'tocarOp']], ['vibrar', 'vibrar', ['no', 'si']], ['musica', null, ['no', 'si']], ['sonido', null, ['no', 'si']],
  ];
  let y = 84;
  for (const [etq, clave, ops] of filas) {
    const bw = 62, x0 = W - 16 - ops.length * (bw + 5) + 5;
    texto(g, tr(etq), 18, y + 12, { tam: tamQueEntra(g, tr(etq), 10.5, x0 - 26), alin: 'left', col: MARFIL });
    const val = etq === 'musica' ? +Sonido.musicaSi : etq === 'sonido' ? +Sonido.efectosSi : typeof CTRL[clave] === 'boolean' ? +CTRL[clave] : CTRL[clave];
    ops.forEach((op, k) => {
      if (!ficha(x0 + k * (bw + 5), y, bw, 24, tr(op), val === k)) return;
      if (etq === 'musica') Sonido.ponerMusica(!!k); else if (etq === 'sonido') Sonido.ponerEfectos(!!k);
      else { CTRL[clave] = typeof CTRL_BASE[clave] === 'boolean' ? !!k : k; guardarCtrl(); if (clave === 'vibrar' && k) vibrar(40); }
    });
    y += 36;
  }
  const bw = W - 64;
  if (placa(32, y + 10, bw, 48, CTRL.modo === 1 ? tr('acomodar') : tr('proba'), { tam: 16 })) { armarMesa(); irA('editor'); }
  if (placa(32, H - 128, bw, 42, tr('restablecer'), { tam: 14, col: '#3a1016' })) { Object.assign(CTRL, JSON.parse(JSON.stringify(CTRL_BASE))); guardarCtrl(); }
  if (placa(32, H - 74, bw, 46, tr('listo')) || apretada('Escape')) irA('menu');
}
function escenaEditor(t) {
  // los flippers responden al dedo (prueba) y los botones se arrastran
  for (const p of E.punteros.values()) if (p.rol && p.rol[0] === 'b' && p.mov > 6) { CTRL[p.rol] = [clamp(p.x / W, 0.06, 0.94), clamp(p.y / H, Y0 / H + 0.05, 0.97)]; }
  let iz = teclaIzq(), de = teclaDer();
  for (const p of E.punteros.values()) { if (p.rol === 'izq' || p.rol === 'bIzq') iz = true; if (p.rol === 'der' || p.rol === 'bDer') de = true; }
  MESA.flippers[0].apretado = iz; MESA.flippers[1].apretado = de;
  pasoMesa([], dtCuadro, () => {});
  g.save(); g.translate(0, Y0); dibujarMesa(null, [], t); g.restore();
  g.fillStyle = 'rgba(2,3,3,0.35)'; g.fillRect(0, Y0, W, MESA_H);
  if (CTRL.modo === 0) { g.strokeStyle = 'rgba(232,184,80,0.5)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(W / 2, Y0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]); }
  dibujarBotonesDedo(Math.max(0.6, ALFAS[CTRL.transp]));
  g.fillStyle = '#020303'; g.fillRect(0, 0, W, Y0);
  const msg = CTRL.modo === 1 ? tr('arrastra') : tr('ayuda1');
  let yy = Math.max(14, Y0 * 0.25);
  for (const l of partir(msg, 40)) { texto(g, l, W / 2, yy, { tam: 9.5, col: MARFIL }); yy += 13; }
  const by = Y0 > 90 ? Y0 - 44 : Y0 + 8;
  if (placa(W / 2 + 6, by, 120, 36, tr('listo'), { tam: 14 }) || apretada('Escape')) { guardarCtrl(); irA('controles'); }
  if (CTRL.modo === 1 && placa(W / 2 - 126, by, 120, 36, tr('restablecer'), { tam: 11, col: '#3a1016' })) { for (const b of ['bIzq', 'bDer', 'bRes']) CTRL[b] = CTRL_BASE[b].slice(); guardarCtrl(); }
}

const AL_ENTRAR = { menu: prepararMenu };

/* ------------------------------------------------------------------ bucle */
let ultimo = 0;
function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.033, ultimo ? (ts - ultimo) / 1000 : 1 / 60); ultimo = ts; dtCuadro = dt;
  const t = ts / 1000; ahora = t;
  tEsc += dt;
  if (trans) { trans.t += dt; if (!trans.hecho && trans.t >= trans.dur) { trans.hecho = true; trans.alMedio(); } if (trans.t >= trans.dur * 2) trans = null; }
  g.setTransform(S, 0, 0, S, 0, 0);
  try {
    if (escena !== 'intro' && escena !== 'juego' && escena !== 'pausa') Sonido.musica(TEMAS.menu);
    switch (escena) {
      case 'intro': escenaIntro(dt); break;
      case 'idioma': escenaIdioma(t); break;
      case 'menu': escenaMenu(t); break;
      case 'juego': if (!trans) for (let i = 0; i < (window.__dorado.turbo || 1) && escena === 'juego'; i++) actualizarPartida(dt); if (escena === 'juego') dibujarPartida(t); else escenaPausa(t); break;
      case 'pausa': escenaPausa(t); break;
      case 'fin': escenaFin(t); break;
      case 'controles': escenaControles(t); break;
      case 'editor': escenaEditor(t); break;
    }
  } catch (e) { console.error(e); }
  if (trans) dibujarTrans(trans);
  Sonido.pasar();
  E.clic = null; E.toque = null; E.recien.clear();
}
function arrancar() {
  armarMesa();
  ajustar();
  intro = crearIntroJXS({ W, H, presenta: TXT[IDIOMA].presenta, vibrar, estilo: ESTILO_DECO });
  Sonido.iniciar();
  if (Sonido.ctx && Sonido.ctx.state === 'running') musicaIntro = jingleJXS(Sonido.ctx, Sonido.total, ESTILO_DECO);
  prepararMenu();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (escena === 'juego' && G && G.fase === 'juego') irPausa(); Sonido.pausar(true); } else Sonido.pausar(false); });
  window.__pasoMesa = pasoMesa;
  window.__dorado = { bot: false, get G() { return G; }, get escena() { return escena; }, empezar, irA, terminar, DATOS, CTRL, MESA };
  requestAnimationFrame(cuadro);
}
arrancar();
