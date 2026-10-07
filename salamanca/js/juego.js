/* ============================================================================
   El juego: la pantalla, las escenas (intro, idioma, menú, altar, controles,
   partida, cartas, fogón, pausa, fin) y el bucle. La interfaz se dibuja en el
   mismo lienzo de píxeles, con botones de piedra y borde de oro, y las mejoras
   salen como naipes españoles que se dan vuelta.
   ========================================================================== */

const lienzo = document.getElementById('lienzo');
const g = lienzo.getContext('2d');
let escena = 'intro', tEsc = 0, transicion = null, fondoMenu = null;
let oferta = null, resumen = null, desdePausa = false, arrastre = null, historiaPag = 0;

/* ------------------------------------------------------------ la pantalla */
function ajustar() {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth * dpr, vh = innerHeight * dpr;
  let esc = Math.floor(Math.min(vw / W, vh / 320));
  if (esc < 1) esc = Math.min(vw / W, vh / 320);
  H = clamp(Math.floor(vh / esc), 320, 420);
  lienzo.width = W; lienzo.height = H;
  const cw = W * esc / dpr, ch = H * esc / dpr;
  Object.assign(lienzo.style, { width: cw + 'px', height: ch + 'px', left: Math.round((innerWidth - cw) / 2) + 'px', top: Math.round((innerHeight - ch) / 2) + 'px' });
  const libre = H - HUD_H - SALA_H - 12;
  SY = HUD_H + Math.max(0, Math.floor(libre * 0.3));
  g.imageSmoothingEnabled = false;
  prepararLuz();
  fondoMenu = null;
}
addEventListener('resize', ajustar);

function irA(nueva, alMedio) {
  if (transicion) return;
  transicion = { t: 0, dur: 0.32, alMedio: () => { if (alMedio) alMedio(); if (nueva) { escena = nueva; tEsc = 0; } }, hecho: false };
}
/* el telón de rombos */
function dibujarTelon(g, p) {
  if (p <= 0) return;
  g.fillStyle = '#07040a';
  const c = 10;
  for (let y = 0; y < H + c; y += c) for (let x = 0; x < W + c; x += c) {
    const s = Math.round(clamp(p * 1.7 - (y / H) * 0.7, 0, 1) * c);
    if (s <= 0) continue;
    for (let k = -s; k <= s; k++) { const w = s - Math.abs(k); g.fillRect(x - w, y + k, w * 2 + 1, 1); }
  }
}

/* --------------------------------------------------------- los botones */
function placa(g, x, y, w, h, o) {
  o = o || {};
  const borde = o.borde || '#c8902a', fondo = o.fondo || '#24142e';
  g.fillStyle = K; g.fillRect(x - 1, y, w + 2, h); g.fillRect(x, y - 1, w, h + 2);
  g.fillStyle = borde; g.fillRect(x, y, w, h);
  g.fillStyle = fondo; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1, y + 1, w - 2, 1);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1, y + h - 2, w - 2, 1);
}
function boton(x, y, w, h, txt, o) {
  o = o || {};
  const apr = !o.apagado && Entrada.apretando(x, y, w, h);
  const dy = apr ? 1 : 0;
  placa(g, x, y + dy, w, h, { borde: o.apagado ? '#5a4a60' : o.borde || '#c8902a', fondo: apr ? '#3e2450' : o.fondo || '#24142e' });
  if (o.icono) g.drawImage(o.icono, x + 4, y + dy + Math.floor((h - 9) / 2));
  if (txt) textoPx(g, txt, x + w / 2 + (o.icono ? 5 : 0), y + dy + Math.floor((h - 7) / 2), { alin: 'centro', grad: o.apagado ? GRAD.gris : o.grad || GRAD.oro });
  const si = !o.apagado && Entrada.clicEn(x, y, w, h);
  if (si) Sonido.sfx('boton');
  return si;
}

/* ------------------------------------------------------- fondo del menú */
function pintarFondoMenu() {
  const c = hacerLienzo(W, H), f = c.getContext('2d'), r = rngSemilla(7);
  for (let y = 0; y < H; y++) { const p = y / H; f.fillStyle = 'rgb(' + Math.round(13 + p * 20) + ',' + Math.round(8 + p * 6) + ',' + Math.round(20 + p * 18) + ')'; f.fillRect(0, y, W, 1); }
  // la boca de la cueva
  const cx = W / 2, cy = H * 0.74, rx = 58, ry = 74;
  for (let y = Math.round(cy - ry); y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny * (y < cy ? 1 : 0.3);
    const ruido = (r() - 0.5) * 0.08;
    if (d < 1 + ruido) {
      const p = Math.sqrt(Math.max(0, d));
      f.fillStyle = p > 0.92 ? '#1a0e10' : 'rgb(' + Math.round(120 * (1 - p) + 18) + ',' + Math.round(30 * (1 - p) + 6) + ',' + Math.round(20 * (1 - p) + 12) + ')';
      f.fillRect(x, y, 1, 1);
    }
  }
  // rocas a los costados y estalactitas
  for (let x = 0; x < W; x++) {
    const h1 = 10 + Math.abs(Math.sin(x * 0.21) * 10) + Math.abs(Math.sin(x * 0.07) * 8) + r() * 3;
    f.fillStyle = '#07040a'; f.fillRect(x, 0, 1, Math.round(h1));
    const lado = Math.min(x, W - x), alt = lado < 40 ? (40 - lado) * 3.2 + r() * 4 : 0;
    if (alt > 0) { f.fillStyle = '#0a0610'; f.fillRect(x, Math.round(H - alt * 1.6), 1, Math.round(alt * 1.6)); }
  }
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * W), l = 6 + Math.floor(r() * 14); for (let k = 0; k < l; k++) { f.fillStyle = '#07040a'; f.fillRect(x - Math.floor((l - k) / 5), 18 + k, 1 + Math.floor((l - k) / 5) * 2, 1); } }
  f.fillStyle = '#1e1218'; f.fillRect(0, H - 8, W, 8);
  return c;
}
let almasMenu = [];
function dibujarFondoMenu(g, t, conChica) {
  if (!fondoMenu) fondoMenu = pintarFondoMenu();
  g.drawImage(fondoMenu, 0, 0);
  const cx = W / 2, cy = H * 0.74;
  g.globalCompositeOperation = 'lighter';
  g.drawImage(brillo(60, 'rgba(255,80,40,' + (0.25 + Math.sin(t * 2) * 0.06) + ')'), cx - 60, cy - 50);
  g.globalCompositeOperation = 'source-over';
  if (almasMenu.length < 18 && Math.random() < 0.08) almasMenu.push({ x: cx + azar(-40, 40), y: cy + 10, vx: azar(-6, 6), t: 0, f: Math.random() * 6 });
  for (let i = almasMenu.length - 1; i >= 0; i--) {
    const a = almasMenu[i];
    a.t += 1 / 60; a.y -= 14 / 60; a.x += Math.sin(a.t * 2 + a.f) * 0.3 + a.vx / 60;
    if (a.y < -10) { almasMenu.splice(i, 1); continue; }
    g.drawImage(brillo(5, 'rgba(90,170,255,0.5)'), Math.round(a.x - 5), Math.round(a.y - 7));
    dibujarSpr(g, 'alma', Math.floor(t * 5 + a.f) % 2, a.x, a.y, { alfa: Math.min(1, a.t) });
  }
  if (conChica) {
    const x = cx, y = Math.round(cy + 34);
    g.drawImage(brillo(30, 'rgba(255,190,90,0.25)'), x - 30 + 6, y - 40);
    sombra(g, x, y, 10);
    dibujarSpr(g, 'jug', 0, x, y + Math.round(Math.sin(t * 2) * 0.5), {});
    dibujarSpr(g, 'farol', 0, x + 6, y - 3 + Math.round(Math.sin(t * 3)), {});
  }
}
function titulo(g, y, t) {
  const letras = 'SALAMANCA';
  let x = Math.round(W / 2 - (anchoTexto(letras) * 3) / 2);
  for (let i = 0; i < letras.length; i++) {
    const ch = letras[i], dy = Math.round(Math.sin(t * 2.5 + i * 0.6) * 1.5);
    textoPx(g, ch, x, y + dy, { grad: GRAD.fuego, escala: 3 });
    x += (glifoPx(ch).f[0].length + 1) * 3;
  }
  textoPx(g, tr('subtitulo'), W / 2, y + 26, { alin: 'centro', grad: GRAD.ocre });
}

/* ------------------------------------------------------------ las cartas */
const CARTA_W = 54, CARTA_H = 80;
const cacheCarta = new Map();
function lienzoCarta(id, nivel) {
  const k = id + nivel + IDIOMA;
  if (cacheCarta.has(k)) return cacheCarta.get(k);
  const C = CARTAS[id], P = PALOS[C.palo], c = hacerLienzo(CARTA_W, CARTA_H), s = c.getContext('2d');
  s.fillStyle = K; s.fillRect(1, 0, CARTA_W - 2, CARTA_H); s.fillRect(0, 1, CARTA_W, CARTA_H - 2);
  s.fillStyle = RAREZA[C.rar].col; s.fillRect(1, 1, CARTA_W - 2, CARTA_H - 2);
  s.fillStyle = '#f2e8d0'; s.fillRect(3, 3, CARTA_W - 6, CARTA_H - 6);
  s.fillStyle = '#e2d4b4'; for (let y = 4; y < CARTA_H - 4; y += 3) s.fillRect(4, y, CARTA_W - 8, 1);
  s.drawImage(PALO_CANVAS[C.palo], 5, 5); s.drawImage(PALO_CANVAS[C.palo], CARTA_W - 12, CARTA_H - 12);
  // el medallón con el ícono
  const mx = CARTA_W / 2, my = 28;
  circulo(s, mx, my, 15, K); circulo(s, mx, my, 14, P.col); circulo(s, mx, my, 12, P.fondo);
  s.drawImage(icono(id, C.palo), mx - 9, my - 9, 18, 18);
  const lineas = envolver(nombreCarta(id), CARTA_W - 8);
  lineas.slice(0, 2).forEach((l, i) => textoPx(s, l, CARTA_W / 2, 48 + i * 9 + (lineas.length === 1 ? 4 : 0), { alin: 'centro', col: '#2a1408', borde: 'no', sinSombra: true }));
  if (C.max <= 5) for (let i = 0; i < C.max; i++) { s.fillStyle = K; s.fillRect(CARTA_W / 2 - C.max * 3 + i * 6, 69, 5, 4); s.fillStyle = i < nivel ? P.col : '#c8b898'; s.fillRect(CARTA_W / 2 - C.max * 3 + i * 6 + 1, 70, 3, 2); }
  cacheCarta.set(k, c);
  return c;
}
let dorsoCarta = null;
function lienzoDorso() {
  if (dorsoCarta) return dorsoCarta;
  const c = hacerLienzo(CARTA_W, CARTA_H), s = c.getContext('2d');
  s.fillStyle = K; s.fillRect(1, 0, CARTA_W - 2, CARTA_H); s.fillRect(0, 1, CARTA_W, CARTA_H - 2);
  s.fillStyle = '#c8902a'; s.fillRect(1, 1, CARTA_W - 2, CARTA_H - 2);
  s.fillStyle = '#6a1424'; s.fillRect(3, 3, CARTA_W - 6, CARTA_H - 6);
  s.fillStyle = '#8a2030';
  for (let y = 4; y < CARTA_H - 4; y++) for (let x = 4; x < CARTA_W - 4; x++) if ((x + y) % 8 === 0 || (x - y + 80) % 8 === 0) s.fillRect(x, y, 1, 1);
  circulo(s, CARTA_W / 2, CARTA_H / 2, 10, '#c8902a'); circulo(s, CARTA_W / 2, CARTA_H / 2, 8, '#3a0a14');
  textoPx(s, 'S', CARTA_W / 2, CARTA_H / 2 - 3, { alin: 'centro', grad: GRAD.oro });
  return (dorsoCarta = c);
}
function abrirCartas(origen, solo) {
  const ids = ofrecerCartas(J.jug, J.rnd, solo);
  if (!ids.length) { if (origen === 'nivel' || origen === 'jefe') J.pendientes = Math.max(0, J.pendientes - 1); return; }
  oferta = { ids, origen, sel: -1, t: 0 };
  J.cartelChico = null;
  escena = 'cartas'; tEsc = 0;
  Entrada.soltarPalanca();
  Sonido.sfx('carta');
}
function elegirCarta(i) {
  const id = oferta.ids[i];
  tomarCarta(id);
  Sonido.sfx('elegir'); vibrar(20);
  J.ondas.push({ x: J.jug.x, y: J.jug.y, r: 0, t: 0, col: PALOS[CARTAS[id].palo].col });
  const origen = oferta.origen;
  oferta = null;
  if (origen === 'nivel') J.pendientes = Math.max(0, J.pendientes - 1);
  if (origen === 'trato') { J.fogonListo = true; abrirPuertaFogon(); }
  escena = 'juego'; tEsc = 0;
}
function escenaCartas(t) {
  dibujarJuegoCompleto(t);
  g.fillStyle = 'rgba(8,4,14,0.78)'; g.fillRect(0, 0, W, H);
  const O = oferta;
  O.t += 1 / 60;
  const tit = O.origen === 'trato' ? tr('trato') : O.origen === 'yapa' ? tr('yapa') : tr('nivel');
  textoPx(g, tit, W / 2, SY + 30, { alin: 'centro', grad: GRAD.oro, escala: O.origen === 'nivel' ? 1 : 2 });
  textoPx(g, tr('tocaCarta'), W / 2, SY + 46, { alin: 'centro', grad: GRAD.gris });
  const y0 = SY + 62;
  O.ids.forEach((id, i) => {
    const x = 4 + i * (CARTA_W + 6) + (3 - O.ids.length) * (CARTA_W + 6) / 2;
    const tl = O.t - i * 0.12;
    if (tl < 0) return;
    const entra = clamp(tl / 0.25, 0, 1), giro = clamp((tl - 0.2) / 0.3, 0, 1);
    const sel = O.sel === i;
    const y = Math.round(y0 + (1 - entra) * 120 - (sel ? 6 : 0) + (sel ? Math.sin(t * 4) : 0));
    const esc = Math.abs(Math.cos(giro * Math.PI));
    const img = giro < 0.5 ? lienzoDorso() : lienzoCarta(id, (J.jug.cartas[id] || 0) + 1);
    const w = Math.max(1, Math.round(CARTA_W * esc));
    if (sel) g.drawImage(brillo(40, hexA(PALOS[CARTAS[id].palo].col, 0.45)), x + CARTA_W / 2 - 40, y + CARTA_H / 2 - 40);
    g.drawImage(img, Math.round(x + (CARTA_W - w) / 2), y, w, CARTA_H);
    if (giro >= 1 && Entrada.clicEn(x, y, CARTA_W, CARTA_H)) {
      if (O.sel === i) elegirCarta(i); else { O.sel = i; Sonido.sfx('carta'); }
    }
  });
  if (!oferta) return;
  if (O.sel >= 0) {
    const id = O.ids[O.sel], py = y0 + CARTA_H + 12;
    placa(g, 8, py, W - 16, 44, { borde: RAREZA[CARTAS[id].rar].col });
    textoPx(g, nombreCarta(id), W / 2, py + 5, { alin: 'centro', col: PALOS[CARTAS[id].palo].col });
    envolver(descCarta(id), W - 28).slice(0, 3).forEach((l, i) => textoPx(g, l, W / 2, py + 16 + i * 9, { alin: 'centro', grad: GRAD.blanco }));
    if (boton(W / 2 - 40, py + 52, 80, 18, tr('elegir'))) elegirCarta(O.sel);
  }
  if (Entrada.usoTeclado) {
    if (Entrada.apretada('Digit1', 'Numpad1')) elegirCarta(0);
    else if (Entrada.apretada('Digit2', 'Numpad2') && O.ids.length > 1) elegirCarta(1);
    else if (Entrada.apretada('Digit3', 'Numpad3') && O.ids.length > 2) elegirCarta(2);
  }
}

/* ---------------------------------------------------------------- escenas */
function escenaIdioma(t) {
  dibujarFondoMenu(g, t, false);
  titulo(g, 34, t);
  const nombres = { es: 'ESPAÑOL', en: 'ENGLISH', pt: 'PORTUGUÊS' };
  placa(g, 20, H * 0.36, W - 40, 118);
  textoPx(g, TXT[IDIOMA].idioma, W / 2, H * 0.36 + 8, { alin: 'centro', grad: GRAD.ocre });
  ['es', 'en', 'pt'].forEach((l, i) => {
    if (boton(34, H * 0.36 + 24 + i * 30, W - 68, 22, nombres[l], { borde: l === IDIOMA ? '#ffe080' : null })) {
      IDIOMA = l; Guardado.escribir('idioma', l); cacheCarta.clear();
      irA('menu');
    }
  });
}
function escenaMenu(t) {
  Sonido.musica(TEMAS.menu);
  dibujarFondoMenu(g, t, true);
  titulo(g, 30, t);
  const y0 = Math.round(H * 0.3), bw = 120, x = (W - bw) / 2;
  if (boton(x, y0, bw, 22, tr('jugar'), { grad: GRAD.fuego, borde: '#ffcf4a' })) empezarPartida(false);
  const hoyR = DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0;
  if (boton(x, y0 + 28, bw, 18, tr('diario'))) empezarPartida(true);
  textoPx(g, tr('hoyRec', salaTexto(hoyR)), W / 2, y0 + 49, { alin: 'centro', grad: GRAD.gris });
  if (boton(x, y0 + 62, bw, 18, tr('altar'), { icono: icono('revivir', 'oros') })) irA('altar');
  if (boton(x, y0 + 84, 58, 16, tr('controles'))) { desdePausa = false; irA('controles'); }
  if (boton(x + 62, y0 + 84, 58, 16, tr('idiomaBtn'))) irA('idioma');
  // abajo: almas y récord
  const yb = H - 28;
  placa(g, 4, yb, 64, 22); dibujarSpr(g, 'alma', Math.floor(t * 4) % 2, 13, yb + 17); textoPx(g, String(DATOS.almas), 21, yb + 8, { grad: GRAD.celeste });
  placa(g, W - 68, yb, 64, 22); textoPx(g, tr('record', salaTexto(DATOS.record)), W - 36, yb + 8, { alin: 'centro', grad: GRAD.oro });
  textoPx(g, 'JXSTUDIOS', W / 2, H - 18, { alin: 'centro', grad: GRAD.gris, sinSombra: true });
  if (Entrada.apretada('Enter', 'Space')) empezarPartida(false);
}
function empezarPartida(diaria) {
  irA('juego', () => {
    nuevaPartida(diaria);
    if (!DATOS.historia) { escenaPendiente = 'historia'; historiaPag = 0; }
    else if (DATOS.meta.yapa) escenaPendiente = 'yapa';
  });
}
let escenaPendiente = null;
function escenaHistoria(t) {
  dibujarJuegoCompleto(t);
  g.fillStyle = 'rgba(6,3,10,0.86)'; g.fillRect(0, 0, W, H);
  const lineas = tr('historia').concat([Entrada.usoTeclado ? tr('ayudaPC') : tr('ayuda')]);
  const txt = lineas[historiaPag];
  const r = envolver(txt, W - 30), cuantas = Math.floor(tEsc * 40);
  let n = 0;
  r.forEach((l, i) => { textoLetras(g, l, Math.round(W / 2 - anchoTexto(l) / 2), H * 0.38 + i * 11, { grad: historiaPag === 2 ? GRAD.oro : GRAD.blanco }, Math.max(0, cuantas - n)); n += l.length; });
  if (historiaPag === 0) dibujarSpr(g, 'mandinga', Math.floor(t * 2) % 2, W / 2, H * 0.34, {});
  if (historiaPag === 1) { dibujarSpr(g, 'jug', 0, W / 2, H * 0.34, {}); dibujarSpr(g, 'farol', 0, W / 2 + 6, H * 0.34 - 3); }
  if (Math.floor(t * 2) % 2) textoPx(g, tr('tocar'), W / 2, H * 0.78, { alin: 'centro', grad: GRAD.gris });
  if (Entrada.clic || Entrada.apretada('Enter', 'Space')) {
    if (cuantas < n) tEsc = 99;
    else if (historiaPag < 2) { historiaPag++; tEsc = 0; }
    else { DATOS.historia = true; guardarDatos(); escena = DATOS.meta.yapa ? 'yapa' : 'juego'; tEsc = 0; if (escena === 'yapa') abrirCartas('yapa'); }
  }
}
function escenaAltar(t) {
  dibujarFondoMenu(g, t, false);
  g.fillStyle = 'rgba(8,4,14,0.6)'; g.fillRect(0, 0, W, H);
  textoPx(g, tr('altar'), W / 2, 14, { alin: 'centro', grad: GRAD.fuego, escala: 2 });
  textoPx(g, tr('mejorar'), W / 2, 34, { alin: 'centro', grad: GRAD.ocre });
  placa(g, W / 2 - 34, 46, 68, 16); dibujarSpr(g, 'alma', Math.floor(t * 4) % 2, W / 2 - 24, 59); textoPx(g, String(DATOS.almas), W / 2 - 16, 51, { grad: GRAD.celeste });
  const iconos = { vida: ['vida', 'copas'], danio: ['fuerza', 'espadas'], cadencia: ['mano', 'espadas'], suerte: ['suerte', 'oros'], yapa: ['yapa', 'bastos'], revivir: ['revivir', 'copas'] };
  const alto = Math.min(36, Math.floor((H - 110) / ALTAR.length));
  ALTAR.forEach((a, i) => {
    const y = 68 + i * alto, nv = DATOS.meta[a.id] || 0, max = nv >= a.max, costo = a.costo[nv];
    placa(g, 6, y, W - 12, alto - 4, { fondo: '#1c1026' });
    const [ic, palo] = iconos[a.id];
    g.drawImage(icono(ic, palo), 10, y + 6, 18, 18);
    textoPx(g, a.n[iIdioma()], 33, y + 4, { grad: GRAD.oro });
    textoPx(g, a.d[iIdioma()], 33, y + 14, { grad: GRAD.gris, sinSombra: true });
    for (let k = 0; k < a.max; k++) { g.fillStyle = K; g.fillRect(33 + k * 6, y + 24, 5, 4); g.fillStyle = k < nv ? '#ffcf4a' : '#4a3a50'; g.fillRect(34 + k * 6, y + 25, 3, 2); }
    if (max) textoPx(g, tr('max'), W - 28, y + 11, { alin: 'centro', grad: GRAD.verde });
    else if (boton(W - 48, y + 6, 38, alto - 16, String(costo), { apagado: DATOS.almas < costo, grad: GRAD.celeste })) {
      DATOS.almas -= costo; DATOS.meta[a.id] = nv + 1; guardarDatos(); Sonido.sfx('nivel'); vibrar(20);
    }
  });
  if (boton(W / 2 - 40, H - 26, 80, 18, tr('listo')) || Entrada.apretada('Escape')) irA('menu');
}
function escenaControles(t) {
  if (desdePausa && J) { dibujarJuegoCompleto(t); g.fillStyle = 'rgba(8,4,14,0.7)'; g.fillRect(0, 0, W, H); }
  else { dibujarFondoMenu(g, t, false); g.fillStyle = 'rgba(8,4,14,0.55)'; g.fillRect(0, 0, W, H); }
  textoPx(g, tr('controles'), W / 2, 10, { alin: 'centro', grad: GRAD.fuego, escala: 2 });
  let y = 32;
  const fila = (txt) => { textoPx(g, txt, 8, y + 5, { grad: GRAD.ocre }); };
  fila(tr('palanca'));
  if (boton(W - 120, y, 58, 16, tr('flotante'), { borde: CTRL.tipo === 'flotante' ? '#ffe080' : '#5a4a60' })) { CTRL.tipo = 'flotante'; guardarCtrl(); }
  if (boton(W - 58, y, 52, 16, tr('fija'), { borde: CTRL.tipo === 'fija' ? '#ffe080' : '#5a4a60' })) { CTRL.tipo = 'fija'; guardarCtrl(); }
  y += 22;
  const regla = (txt, k, min, max, paso) => {
    fila(txt);
    if (boton(W - 76, y, 16, 16, '-')) { CTRL[k] = Math.round(clamp(CTRL[k] - paso, min, max) * 100) / 100; guardarCtrl(); }
    textoPx(g, Math.round(CTRL[k] * 100) + '%', W - 41, y + 5, { alin: 'centro', grad: GRAD.blanco });
    if (boton(W - 22, y, 16, 16, '+')) { CTRL[k] = Math.round(clamp(CTRL[k] + paso, min, max) * 100) / 100; guardarCtrl(); }
    y += 20;
  };
  regla(tr('tamPal'), 'tamPal', 0.6, 1.6, 0.1);
  regla(tr('tamBtn'), 'tamBtn', 0.6, 1.6, 0.1);
  regla(tr('opac'), 'opac', 0.2, 1, 0.1);
  const llave = (txt, k) => {
    fila(txt);
    if (boton(W - 54, y, 48, 16, CTRL[k] ? tr('si') : tr('no'), { borde: CTRL[k] ? '#ffe080' : '#5a4a60' })) { CTRL[k] = !CTRL[k]; guardarCtrl(); if (k === 'vibrar' && CTRL[k]) vibrar(40); }
    y += 20;
  };
  llave(tr('zurdo'), 'zurdo');
  llave(tr('vibrar'), 'vibrar');
  textoPx(g, tr('arrastra'), W / 2, y + 4, { alin: 'centro', grad: GRAD.gris });
  // la zona de prueba: se arrastran la palanca y el botón
  const zona = y + 16;
  g.fillStyle = 'rgba(255,207,74,0.06)'; g.fillRect(0, zona, W, H - zona - 28);
  const pp = posPalanca(), pb = posBoton(), rp = radioPal(), rb = radioBtn();
  if (Entrada.toque && !arrastre) {
    if (Math.hypot(Entrada.toque.x - pp.x, Entrada.toque.y - pp.y) < rp + 6) arrastre = 'pal';
    else if (Math.hypot(Entrada.toque.x - pb.x, Entrada.toque.y - pb.y) < rb + 6) arrastre = 'btn';
  }
  if (arrastre) {
    const p = [...Entrada.punteros.values()][0];
    if (!p) { arrastre = null; guardarCtrl(); }
    else {
      const fx = clamp(p.x / W, 0.08, 0.92), fy = clamp(p.y / H, (zona + 20) / H, (H - 34) / H);
      if (arrastre === 'pal') { CTRL.palX = CTRL.zurdo ? 1 - fx : fx; CTRL.palY = fy; } else { CTRL.btnX = CTRL.zurdo ? 1 - fx : fx; CTRL.btnY = fy; }
    }
  }
  g.globalAlpha = CTRL.opac;
  g.strokeStyle = '#e8d8b0'; g.beginPath(); g.arc(Math.round(pp.x) + 0.5, Math.round(pp.y) + 0.5, rp, 0, Math.PI * 2); g.stroke();
  circulo(g, pp.x, pp.y, Math.round(rp * 0.42), '#c8902a'); circulo(g, pp.x, pp.y - 1, Math.round(rp * 0.42) - 2, '#ffcf4a');
  g.globalAlpha = 1;
  dibujarBotonCopla(g, pb, rb, 60, t, CTRL.opac);
  if (boton(8, H - 24, 78, 18, tr('restablecer'))) { Object.assign(CTRL, CTRL_BASE); guardarCtrl(); }
  if (boton(W - 86, H - 24, 78, 18, tr('listo')) || Entrada.apretada('Escape')) { arrastre = null; if (desdePausa) { escena = 'pausa'; tEsc = 0; } else irA('menu'); }
}
function escenaPausa(t) {
  dibujarJuegoCompleto(t);
  g.fillStyle = 'rgba(8,4,14,0.8)'; g.fillRect(0, 0, W, H);
  textoPx(g, tr('pausa'), W / 2, SY + 12, { alin: 'centro', grad: GRAD.oro, escala: 2 });
  const x = 30, w = W - 60;
  let y = SY + 36;
  if (boton(x, y, w, 20, tr('seguir'), { grad: GRAD.fuego }) || Entrada.apretada('Escape', 'KeyP')) { escena = 'juego'; Sonido.pausar(false); return; }
  y += 26;
  if (boton(x, y, w, 18, tr('controles'))) { desdePausa = true; escena = 'controles'; tEsc = 0; }
  y += 24;
  if (boton(x, y, w, 18, tr('musica') + ': ' + (Sonido.musicaSi ? tr('si') : tr('no')))) Sonido.ponerMusica(!Sonido.musicaSi);
  y += 24;
  if (boton(x, y, w, 18, tr('sonido') + ': ' + (Sonido.efectosSi ? tr('si') : tr('no')))) Sonido.ponerEfectos(!Sonido.efectosSi);
  y += 24;
  if (boton(x, y, w, 18, tr('salir'), { borde: '#a83040' })) { Sonido.pausar(false); terminarPartida(); irA('menu'); return; }
  y += 30;
  textoPx(g, tr('tusCartas'), W / 2, y, { alin: 'centro', grad: GRAD.ocre });
  y += 12;
  let cx = 10;
  for (const id in J.jug.cartas) {
    if (cx > W - 30) { cx = 10; y += 22; }
    g.drawImage(icono(id, CARTAS[id].palo), cx, y, 18, 18);
    if (J.jug.cartas[id] > 1) numeroChico(g, String(J.jug.cartas[id]), cx + 17, y + 16, '#ffffff');
    cx += 22;
  }
}
function escenaFogon(t) {
  dibujarJuegoCompleto(t);
  g.fillStyle = 'rgba(8,4,14,0.6)'; g.fillRect(0, 0, W, H);
  const y = SY + 40;
  placa(g, 8, y, W - 16, 156, { fondo: '#1e1018' });
  textoPx(g, tr('fogon'), W / 2, y + 8, { alin: 'centro', grad: GRAD.fuego, escala: 2 });
  dibujarSpr(g, 'pombero', Math.floor(t * 2) % 2, W / 2, y + 60, { escX: 2, escY: 2 });
  envolver(tr('fogonTxt'), W - 30).forEach((l, i) => textoPx(g, l, W / 2, y + 66 + i * 9, { alin: 'centro', grad: GRAD.blanco }));
  if (boton(16, y + 88, W - 32, 26, '', { borde: '#7ad860' }) || Entrada.apretada('Digit1', 'Numpad1')) { curar(J.jug.vidaMax * 0.4); J.fogonListo = true; abrirPuertaFogon(); escena = 'juego'; return; }
  textoPx(g, tr('descansar'), W / 2, y + 92, { alin: 'centro', grad: GRAD.verde });
  textoPx(g, tr('descansarD'), W / 2, y + 102, { alin: 'centro', grad: GRAD.gris, sinSombra: true });
  if (boton(16, y + 120, W - 32, 28, '', { borde: '#ff5a64' }) || Entrada.apretada('Digit2', 'Numpad2')) {
    J.jug.factorVida *= 0.85; recalcular(); J.jug.vida = Math.min(J.jug.vida, J.jug.vidaMax);
    Sonido.sfx('rugido'); abrirCartas('trato', 'epica'); return;
  }
  textoPx(g, tr('trato'), W / 2, y + 124, { alin: 'centro', grad: GRAD.rojo });
  envolver(tr('tratoD'), W - 40).slice(0, 2).forEach((l, i) => textoPx(g, l, W / 2, y + 133 + i * 8, { alin: 'centro', grad: GRAD.gris, sinSombra: true }));
}
function terminarPartida() {
  if (!J || resumen && resumen.J === J) return;
  const valor = (J.piso - 1) * 8 + J.sala;
  const nuevo = valor > DATOS.record;
  if (nuevo) DATOS.record = valor;
  if (J.diaria) { if (DATOS.diaFecha !== hoy()) { DATOS.diaFecha = hoy(); DATOS.diaRecord = 0; } DATOS.diaRecord = Math.max(DATOS.diaRecord, valor); }
  DATOS.almas += J.almas; DATOS.partidas++;
  guardarDatos();
  resumen = { J, valor, nuevo, almas: J.almas, nivel: J.jug.nivel, kills: J.kills, cartas: Object.assign({}, J.jug.cartas), t: 0 };
}
function escenaFin(t, gano) {
  dibujarJuegoCompleto(t);
  g.fillStyle = 'rgba(8,4,14,0.84)'; g.fillRect(0, 0, W, H);
  const R = resumen; R.t += 1 / 60;
  let y = SY + 20;
  envolver(gano ? tr('victoria') : tr('muerte'), W - 16).forEach((l) => { textoPx(g, l, W / 2, y, { alin: 'centro', grad: gano ? GRAD.oro : GRAD.rojo }); y += 10; });
  if (gano) { y += 2; textoPx(g, tr('victoriaTxt'), W / 2, y, { alin: 'centro', grad: GRAD.gris }); y += 10; }
  y += 8;
  textoPx(g, tr('llegaste', salaTexto(R.valor)), W / 2, y, { alin: 'centro', grad: GRAD.ocre, escala: 1 }); y += 14;
  if (R.nuevo && Math.floor(t * 3) % 2) textoPx(g, tr('nuevoRecord'), W / 2, y, { alin: 'centro', grad: GRAD.fuego });
  y += 16;
  placa(g, 20, y, W - 40, 58, { fondo: '#1c1026' });
  textoPx(g, tr('nivelAlcanzado', R.nivel), W / 2, y + 6, { alin: 'centro', grad: GRAD.oro });
  textoPx(g, tr('muertos', R.kills), W / 2, y + 18, { alin: 'centro', grad: GRAD.blanco });
  const cuenta = Math.min(R.almas, Math.floor(R.t * 60));
  dibujarSpr(g, 'alma', Math.floor(t * 4) % 2, W / 2 - 34, y + 45);
  textoPx(g, tr('ganadas', cuenta), W / 2 + 4, y + 33, { alin: 'centro', grad: GRAD.celeste });
  if (cuenta < R.almas && Math.floor(R.t * 60) % 3 === 0) Sonido.sfx('xp', 1 + cuenta / Math.max(1, R.almas));
  y += 66;
  let cx = 10;
  for (const id in R.cartas) { if (cx > W - 14) { cx = 10; y += 12; } g.drawImage(icono(id, CARTAS[id].palo), cx, y); cx += 12; }
  const yb = H - 54;
  if (gano) {
    if (boton(20, yb - 26, W - 40, 20, tr('seguirBajando'), { grad: GRAD.fuego, borde: '#ffcf4a' })) { escena = 'juego'; J.salir = true; resumen = null; return; }
    if (boton(20, yb, W - 40, 18, tr('menu'))) { terminarPartida(); irA('menu'); }
    return;
  }
  if (boton(20, yb, W - 40, 22, tr('otraVez'), { grad: GRAD.fuego, borde: '#ffcf4a' }) || Entrada.apretada('Enter', 'Space')) empezarPartida(J.diaria);
  if (boton(20, yb + 28, W - 40, 18, tr('menu'))) irA('menu');
}

/* ------------------------------------------------------------- la partida */
let acum = 0;
function tocarJuego(p) {
  if (escena !== 'juego') return false;
  const vy = SY - HUD_H;
  if (p.x > W - 20 && p.y < vy + 18) { pausar(); return true; }
  const b = posBoton();
  if (Math.hypot(p.x - b.x, p.y - b.y) < radioBtn() + 4) { usarCopla(); return true; }
  return false;
}
function pausar() { if (escena !== 'juego' || J.muerto) return; escena = 'pausa'; tEsc = 0; Entrada.soltarPalanca(); }
function escenaJuego(t, dt) {
  if (!transicion) {
    if (Entrada.apretada('Escape', 'KeyP')) { pausar(); }
    if (Entrada.apretada('Space', 'KeyE')) usarCopla();
    const escala = J.lenta > 0 ? 0.3 : 1;
    acum += dt * escala;
    let n = 0;
    while (acum >= 1 / 60 && n < 4) { pasoMundo(1 / 60); acum -= 1 / 60; n++; }
    if (n >= 4) acum = 0;
    J.lenta -= dt; J.sacudir = Math.max(0, J.sacudir - dt * 20); J.destello -= dt;
    if (J.cartel) { J.cartel.t -= dt; if (J.cartel.t <= 0) J.cartel = null; }
    if (J.cartelChico) { J.cartelChico.t -= dt; if (J.cartelChico.t <= 0) J.cartelChico = null; }
    if (escenaPendiente) { const e = escenaPendiente; escenaPendiente = null; if (e === 'yapa') abrirCartas('yapa'); else { escena = e; tEsc = 0; } }
    else if (J.muerto && J.lenta <= 0) { terminarPartida(); escena = 'fin'; tEsc = 0; Entrada.soltarPalanca(); }
    else if (J.pendientes > 0 && J.lenta <= 0.1 && !J.muerto) abrirCartas('nivel');
    else if (J.tipo === 'fogon' && !J.fogonListo && J.tSala > 0.9) { escena = 'fogon'; tEsc = 0; Entrada.soltarPalanca(); }
    else if (J.salir) {
      J.salir = false;
      if (J.sala === 8 && J.piso % 4 === 0 && !J.ganoEste) { J.ganoEste = J.piso; terminarPartidaVictoria(); }
      else irA(null, () => { siguienteSala(); Entrada.soltarPalanca(); });
    }
  }
  dibujarJuegoCompleto(t);
}
function terminarPartidaVictoria() {
  const valor = (J.piso - 1) * 8 + J.sala;
  if (valor > DATOS.record) DATOS.record = valor;
  guardarDatos();
  resumen = { J: null, valor, nuevo: false, almas: J.almas, nivel: J.jug.nivel, kills: J.kills, cartas: Object.assign({}, J.jug.cartas), t: 0 };
  escena = 'victoria'; tEsc = 0; Sonido.sfx('victoria');
}
function dibujarJuegoCompleto(t) {
  g.fillStyle = '#07040a'; g.fillRect(0, 0, W, H);
  dibujarPartida(g, t);
  dibujarHUD(g, t);
  if (escena === 'juego') dibujarMandos(g, t);
  // carteles
  if (J.cartel) {
    const c = J.cartel, a = Math.min(1, c.t * 2, (2.6 - c.t) * 3), y = SY + 70;
    g.globalAlpha = clamp(a, 0, 1);
    g.fillStyle = 'rgba(8,4,14,0.7)'; g.fillRect(0, y - 6, W, 40);
    g.fillStyle = c.jefe ? '#c8323c' : '#c8902a'; g.fillRect(0, y - 6, W, 1); g.fillRect(0, y + 33, W, 1);
    textoPx(g, c.txt, W / 2, y, { alin: 'centro', grad: c.jefe ? GRAD.rojo : GRAD.oro, escala: 2 });
    textoPx(g, c.sub, W / 2, y + 20, { alin: 'centro', grad: GRAD.ocre });
    g.globalAlpha = 1;
  }
  if (J.cartelChico) {
    const c = J.cartelChico;
    g.globalAlpha = clamp(c.t * 2, 0, 1);
    textoPx(g, c.txt, W / 2, SY + 40 - Math.round((1.2 - c.t) * 6), { alin: 'centro', grad: c.col || GRAD.oro });
    g.globalAlpha = 1;
  }
  if (J.sala === 1 && J.piso === 1 && J.tSala < 6 && escena === 'juego' && !J.cartel) {
    g.globalAlpha = clamp(6 - J.tSala, 0, 1);
    envolver(Entrada.usoTeclado ? tr('ayudaPC') : tr('ayuda'), W - 20).forEach((l, i) => textoPx(g, l, W / 2, SY + 150 + i * 9, { alin: 'centro', grad: GRAD.blanco }));
    g.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ bucle */
let ultimo = 0;
function cuadroPrincipal(ts) {
  requestAnimationFrame(cuadroPrincipal);
  const dt = Math.min(0.1, ultimo ? (ts - ultimo) / 1000 : 1 / 60);
  ultimo = ts;
  const t = ts / 1000;
  tEsc += dt;
  if (transicion) {
    transicion.t += dt;
    if (!transicion.hecho && transicion.t >= transicion.dur) { transicion.hecho = true; transicion.alMedio(); }
    if (transicion.t >= transicion.dur * 2) transicion = null;
  }
  Entrada.modoJuego = escena === 'juego' && !transicion;
  try {
    switch (escena) {
      case 'intro': g.fillStyle = '#07040a'; g.fillRect(0, 0, W, H); break;
      case 'idioma': escenaIdioma(t); break;
      case 'menu': escenaMenu(t); break;
      case 'altar': escenaAltar(t); break;
      case 'controles': escenaControles(t); break;
      case 'juego': escenaJuego(t, dt); break;
      case 'cartas': escenaCartas(t); break;
      case 'yapa': escenaCartas(t); break;
      case 'historia': escenaHistoria(t); break;
      case 'fogon': escenaFogon(t); break;
      case 'pausa': escenaPausa(t); break;
      case 'fin': escenaFin(t, false); break;
      case 'victoria': escenaFin(t, true); break;
    }
  } catch (e) { console.error(e); }
  if (transicion) dibujarTelon(g, transicion.t < transicion.dur ? transicion.t / transicion.dur : 2 - transicion.t / transicion.dur);
  Entrada.finCuadro();
}

/* ----------------------------------------------------------------- arranque */
function arrancar() {
  ajustar();
  Entrada.iniciar(lienzo);
  Entrada.alTocarJuego = tocarJuego;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (escena === 'juego') pausar(); Sonido.pausar(true); } else Sonido.pausar(false); });
  const intro = document.getElementById('intro');
  document.getElementById('moneda').src = MONEDA;
  intro.querySelector('.presenta').textContent = TXT[IDIOMA].presenta;
  let fuera = false;
  const salir = () => { if (fuera) return; fuera = true; intro.classList.add('fuera'); setTimeout(() => { intro.remove(); }, 600); escena = 'idioma'; tEsc = 0; };
  setTimeout(salir, 2600);
  intro.addEventListener('pointerdown', () => { Sonido.iniciar(); salir(); });
  requestAnimationFrame(cuadroPrincipal);
  window.__salamanca = { get J() { return J; }, get escena() { return escena; }, DATOS, CTRL, empezarPartida, tomarCarta, siguienteSala };
}
arrancar();
