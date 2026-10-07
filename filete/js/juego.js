/* ============================================================================
   FILETE: las escenas (intro, idioma, menú, barrios, partida, pausa, fin,
   controles), el arrastre de las piezas, los efectos y el bucle.
   ========================================================================== */

const lienzoP = document.getElementById('lienzo');
const g = lienzoP.getContext('2d');
let escena = 'intro', tEsc = 0, trans = null, fondo = null, ESQS = null;
let G = null;                 // la partida en curso

/* -------------------------------------------------------------- controles */
const CTRL_BASE = { altura: 0.5, velocidad: 1.3, bandeja: 1, guia: true, zurdo: false, vibrar: true };
const CTRL = Object.assign({}, CTRL_BASE, Guardado.leer('controles', {}));
const guardarCtrl = () => Guardado.escribir('controles', CTRL);
function vibrar(ms) { if (CTRL.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } }

/* ---------------------------------------------------------------- pantalla */
function ajustar() {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth * dpr, vh = innerHeight * dpr;
  let esc = Math.floor(Math.min(vw / W, vh / 384));
  if (esc < 1) esc = Math.min(vw / W, vh / 384);
  H = clamp(Math.floor(vh / esc), 384, 520);
  lienzoP.width = W; lienzoP.height = H;
  const cw = W * esc / dpr, ch = H * esc / dpr;
  Object.assign(lienzoP.style, { width: cw + 'px', height: ch + 'px', left: Math.round((innerWidth - cw) / 2) + 'px', top: Math.round((innerHeight - ch) / 2) + 'px' });
  const libre = H - 384;
  TY = 74 + Math.floor(libre * 0.4);
  BANDEJA_Y = TY + TAB + 42 + Math.floor(libre * 0.15);
  g.imageSmoothingEnabled = false;
  fondo = fondoLaca(W, H);
  const a = adornoEsquina(46); ESQS = [a, espejar(a, true, false), espejar(a, false, true), espejar(a, true, true)];
}
addEventListener('resize', ajustar);

/* ----------------------------------------------------------------- entrada */
const E = { punteros: new Map(), clic: null, toque: null, suelta: null, teclas: new Set(), recien: new Set() };
function aLogico(ev) { const r = lienzoP.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; }
lienzoP.addEventListener('pointerdown', (ev) => { ev.preventDefault(); Sonido.iniciar(); try { lienzoP.setPointerCapture(ev.pointerId); } catch (x) { /* */ } const p = aLogico(ev); E.punteros.set(ev.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y }); E.toque = { x: p.x, y: p.y, id: ev.pointerId }; });
lienzoP.addEventListener('pointermove', (ev) => { const pt = E.punteros.get(ev.pointerId); if (pt) { const p = aLogico(ev); pt.x = p.x; pt.y = p.y; } });
const finPuntero = (ev) => { const pt = E.punteros.get(ev.pointerId); if (!pt) return; E.punteros.delete(ev.pointerId); E.suelta = { x: pt.x, y: pt.y, id: ev.pointerId }; if (!pt.arrastre) E.clic = { x: pt.x, y: pt.y, x0: pt.x0, y0: pt.y0 }; };
lienzoP.addEventListener('pointerup', finPuntero); lienzoP.addEventListener('pointercancel', finPuntero);
lienzoP.addEventListener('contextmenu', (ev) => ev.preventDefault());
addEventListener('keydown', (ev) => { if (!E.teclas.has(ev.code)) E.recien.add(ev.code); E.teclas.add(ev.code); Sonido.iniciar(); });
addEventListener('keyup', (ev) => E.teclas.delete(ev.code));
const apretada = (...c) => c.some((k) => E.recien.has(k));
const clicEn = (x, y, w, h) => { const c = E.clic; return !!c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.x0 >= x - 4 && c.x0 < x + w + 4 && c.y0 >= y - 4 && c.y0 < y + h + 4; };
function apretando(x, y, w, h) { for (const p of E.punteros.values()) if (!p.arrastre && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return true; return false; }

/* ----------------------------------------------------------------- botones */
function boton(x, y, w, h, txt, o) {
  o = o || {};
  const apr = !o.apagado && apretando(x, y, w, h), dy = apr ? 1 : 0;
  const col = o.apagado ? '#4a4450' : o.col || F.rojo;
  g.fillStyle = K; g.fillRect(x - 1, y + dy - 1, w + 2, h + 2);
  g.fillStyle = col; g.fillRect(x, y + dy, w, h);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 1, y + dy + 2, w - 2, 1);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + dy + h - 3, w, 3);
  g.fillStyle = apr ? F.oroClaro : F.oro; g.fillRect(x, y + dy, w, 1); g.fillRect(x, y + dy + h - 1, w, 1);
  // las dos perlitas de los costados
  disco(g, x + 4, y + dy + h / 2 - 0.5, 1.4, F.oro); disco(g, x + w - 5, y + dy + h / 2 - 0.5, 1.4, F.oro);
  if (o.icono) o.icono(x + 10, y + dy + h / 2);
  if (txt) escribir(g, txt, x + w / 2 + (o.icono ? 5 : 0), y + dy + Math.floor((h - 7) / 2), { alin: 'centro', grad: o.apagado ? GRAD.gris : o.grad || GRAD_CREMA, borde: K });
  const si = !o.apagado && clicEn(x, y, w, h);
  if (si) Sonido.sfx('boton');
  return si;
}
function irA(nueva, alMedio) {
  if (trans) return;
  trans = { t: 0, dur: 0.3, alMedio: () => { if (alMedio) alMedio(); if (nueva) { escena = nueva; tEsc = 0; } }, hecho: false };
}
/* la transición: un telón de rombos de colores (como un filete que se pinta) */
function dibujarTrans(p) {
  if (p <= 0) return;
  const c = 12, cols = [F.rojo, F.verde, F.azul, F.oro];
  for (let y = 0, fy = 0; y < H + c; y += c, fy++) for (let x = 0, fx = 0; x < W + c; x += c, fx++) {
    const s = Math.round(clamp(p * 1.6 - ((x + y) / (W + H)) * 0.6, 0, 1) * c);
    if (s <= 0) continue;
    g.fillStyle = s >= c ? K : cols[(fx + fy) % 4];
    for (let k = -s; k <= s; k++) { const w = s - Math.abs(k); g.fillRect(x - w, y + k, w * 2 + 1, 1); }
  }
}
function fondoMenu(t) {
  g.drawImage(fondo, 0, 0);
  const tam = 46 + Math.round(Math.sin(t * 1.2) * 1);
  g.drawImage(ESQS[0], 0, 0, tam, tam); g.drawImage(ESQS[1], W - tam, 0, tam, tam);
  g.drawImage(ESQS[2], 0, H - tam, tam, tam); g.drawImage(ESQS[3], W - tam, H - tam, tam, tam);
  petalos(t);
}
let PET = [];
function petalos(t) {
  if (PET.length < 14 && Math.random() < 0.05) PET.push({ x: azar(0, W), y: -6, vx: azar(-6, 6), vy: azar(10, 22), r: azar(1.6, 2.6), c: [F.rojo, F.celeste, '#ffc83a', '#ff5aa0', F.verdeClaro][(Math.random() * 5) | 0], f: Math.random() * 6 });
  for (let i = PET.length - 1; i >= 0; i--) {
    const p = PET[i];
    p.x += (p.vx + Math.sin(t * 2 + p.f) * 8) / 60; p.y += p.vy / 60;
    if (p.y > H + 6) { PET.splice(i, 1); continue; }
    disco(g, p.x, p.y, p.r, p.c); punto(g, p.x - 1, p.y - 1, 'rgba(255,255,255,0.6)');
  }
}
function titulo(y, t) {
  const c = letrasFilete('FILETE', 5, GRAD_ORO, F.rojo);
  const bob = Math.round(Math.sin(t * 2) * 1.5);
  g.drawImage(c, Math.round(W / 2 - c.width / 2), y + bob);
  const sub = tr('subtitulo'), w = anchoTexto(sub) + 14;
  cinta(g, W / 2 - w / 2, y + c.height - 4 + bob, w, 13, F.azul, F.azulOsc);
  escribir(g, sub, W / 2, y + c.height - 1 + bob, { alin: 'centro', grad: GRAD_CREMA, borde: K });
}

/* ------------------------------------------------------------------ intro */
let intro = null, musicaIntro = null;
function escenaIntro(dt) {
  if (E.toque || apretada('Enter', 'Space', 'Escape')) { intro.saltar(); if (intro.listo && musicaIntro) musicaIntro.cortar(); }
  intro.pasar(dt); intro.dibujar(g);
  if (intro.listo && !trans) irA('idioma');
}
function escenaIdioma(t) {
  fondoMenu(t);
  titulo(26, t);
  const y0 = Math.round(H * 0.38);
  ['es', 'en', 'pt'].forEach((l, i) => escribir(g, TXT[l].idioma, W / 2, y0 + i * 11, { alin: 'centro', grad: [GRAD_ORO, GRAD_CELESTE, GRAD_VERDE][i], borde: K }));
  const nombres = { es: 'ESPAÑOL', en: 'ENGLISH', pt: 'PORTUGUÊS' };
  ['es', 'en', 'pt'].forEach((l, i) => {
    if (boton(40, y0 + 42 + i * 32, W - 80, 24, nombres[l], { col: [F.rojo, F.azul, F.verde][i] })) { IDIOMA = l; Guardado.escribir('idioma', l); irA('menu'); }
  });
}

/* ------------------------------------------------------------------- menú */
function escenaMenu(t) {
  Sonido.musica(TEMAS.menu);
  fondoMenu(t);
  titulo(22, t);
  const y0 = Math.round(H * 0.34), x = 34, w = W - 68;
  const guardada = Guardado.leer('partida', null);
  if (boton(x, y0, w, 28, guardada ? tr('seguirPartida') : tr('clasico'), { col: F.rojo })) empezar('clasico');
  escribir(g, guardada ? tr('puntos') + ' ' + guardada.puntos : tr('clasicoD'), W / 2, y0 + 31, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  const est = Object.values(DATOS.estrellas).reduce((a, b) => a + b, 0);
  if (boton(x, y0 + 44, w, 24, tr('aventura'), { col: F.verde })) irA('barrios');
  escribir(g, tr('aventuraD') + ' · ' + est + '/' + NIVELES * 3, W / 2, y0 + 71, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  if (boton(x, y0 + 84, w, 24, tr('diario'), { col: F.azul })) empezar('diario');
  const hr = DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0;
  escribir(g, tr('hoyRec', hr), W / 2, y0 + 111, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  if (boton(x, y0 + 124, w / 2 - 3, 18, tr('controles'), { col: '#5a3a6a' })) irA('controles');
  if (boton(x + w / 2 + 3, y0 + 124, w / 2 - 3, 18, tr('idiomaBtn'), { col: '#5a3a6a' })) irA('idioma');
  const yb = H - 30;
  cinta(g, W / 2 - 50, yb, 100, 15, F.rojo, F.rojoOsc);
  escribir(g, tr('record') + ' ' + DATOS.record, W / 2, yb + 4, { alin: 'centro', grad: GRAD_ORO, borde: K });
  escribir(g, 'JXSTUDIOS', W / 2, H - 11, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  if (apretada('Enter', 'Space')) empezar('clasico');
}

/* --------------------------------------------------------------- barrios */
function escenaBarrios(t) {
  fondoMenu(t);
  escribir(g, tr('aventura'), W / 2, 14, { alin: 'centro', esc: tituloEsc(tr('aventura')), grad: GRAD_VERDE, sombra: F.verdeOsc });
  const fila = Math.min(56, Math.floor((H - 80) / 5));
  for (let b = 0; b < 5; b++) {
    const y = 42 + b * fila;
    cinta(g, W / 2 - 40, y, 80, 12, [F.rojo, F.azul, F.verde, '#b07410', '#5a3a6a'][b], K);
    escribir(g, BARRIOS[b], W / 2, y + 3, { alin: 'centro', grad: GRAD_CREMA, borde: K });
    for (let i = 0; i < 6; i++) {
      const n = b * 6 + i + 1, x = 14 + i * 32, yy = y + 16;
      const abierto = n === 1 || (DATOS.estrellas[n - 1] || 0) > 0, est = DATOS.estrellas[n] || 0;
      if (abierto) {
        const apr = apretando(x, yy, 28, 28), dy = apr ? 1 : 0;
        disco(g, x + 14, yy + 13 + dy, 13, K); disco(g, x + 14, yy + 13 + dy, 12, est ? F.oroOsc : F.oro); disco(g, x + 14, yy + 13 + dy, 10, est ? '#2a1a10' : F.laca2);
        escribir(g, String(n), x + 14, yy + 10 + dy, { alin: 'centro', grad: GRAD_ORO, borde: K });
        for (let s = 0; s < 3; s++) estrella(g, x + 7 + s * 7, yy + 25, s < est);
        if (clicEn(x, yy, 28, 30)) { Sonido.sfx('boton'); empezar('barrio', n); }
      } else {
        disco(g, x + 14, yy + 13, 12, '#2a2430'); disco(g, x + 14, yy + 13, 10, '#1a1620');
        g.fillStyle = '#5a5260'; g.fillRect(x + 11, yy + 12, 7, 5); g.fillRect(x + 12, yy + 9, 1, 3); g.fillRect(x + 16, yy + 9, 1, 3); g.fillRect(x + 12, yy + 8, 5, 1);
      }
    }
  }
  if (boton(W / 2 - 40, H - 24, 80, 18, tr('volver'), { col: '#5a3a6a' }) || apretada('Escape')) irA('menu');
}
/* estrella de cinco puntas en píxeles: contorno, oro y brillo (r = radio de afuera) */
function estrella(gg, x, y, llena, r) {
  r = r || 3.6;
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.46 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const dentro = (px, py) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > py) !== (pts[j][1] > py) && px < (pts[j][0] - pts[i][0]) * (py - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) d = !d; return d; };
  const R = Math.ceil(r) + 1;
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    if (dentro(xx + 0.5, yy + 0.5)) {
      gg.fillStyle = llena ? (yy < -r * 0.2 ? F.oroClaro : yy < r * 0.3 ? F.oro : F.oroOsc) : '#3a3240';
      gg.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
    } else if (r > 5 && (dentro(xx + 1.5, yy + 0.5) || dentro(xx - 0.5, yy + 0.5) || dentro(xx + 0.5, yy + 1.5) || dentro(xx + 0.5, yy - 0.5))) { gg.fillStyle = K; gg.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); }
  }
}
/* título grande que se achica si no entra */
function tituloEsc(txt, max) { return anchoTexto(txt) * 3 <= (max || W - 16) ? 3 : 2; }

/* ----------------------------------------------------------------- partida */
function empezar(modo, nivel) {
  irA('juego', () => {
    const rnd = modo === 'diario' ? rngSemilla(hoy()) : Math.random;
    G = { modo, nivel, rnd, puntos: 0, vis: 0, combo: 0, aguante: 0, movs: 0, cambios: modo === 'barrio' ? 1 : 1, fin: false, gano: false,
      part: [], textos: [], borrar: [], pops: [], vuelan: [], banner: null, sacudir: 0, arr: null, finT: 0, entrada: 0, tBrillo: 0, proximoCambio: 1500, record0: DATOS.record };
    const guardada = modo === 'clasico' ? Guardado.leer('partida', null) : null;
    if (guardada) {
      G.t = { col: Int8Array.from(guardada.col), flor: new Uint8Array(N * N) };
      G.piezas = guardada.piezas.map((p) => (p ? { f: FORMAS[p.f], pintura: p.pintura } : null));
      Object.assign(G, { puntos: guardada.puntos, vis: guardada.puntos, combo: guardada.combo, aguante: guardada.aguante, cambios: guardada.cambios, proximoCambio: guardada.proximoCambio || 1500 });
    } else if (modo === 'barrio') {
      const L = armarNivel(nivel);
      G.t = L.t; G.flores = L.flores; G.quedan = L.flores; G.meta3 = L.meta3; G.meta2 = L.meta2;
      G.piezas = nuevaTanda(G.t, rnd, 0);
    } else {
      G.t = tableroNuevo();
      G.piezas = nuevaTanda(G.t, rnd, 0);
    }
    if (modo === 'clasico' && !guardada) Guardado.borrar('partida');
    DATOS.partidas++; guardarDatos();
  });
}
function guardarPartida() {
  if (!G || G.modo !== 'clasico') return;
  if (G.fin) { Guardado.borrar('partida'); return; }
  Guardado.escribir('partida', { col: Array.from(G.t.col), piezas: G.piezas.map((p) => (p ? { f: FORMAS.indexOf(p.f), pintura: p.pintura } : null)), puntos: G.puntos, combo: G.combo, aguante: G.aguante, cambios: G.cambios, proximoCambio: G.proximoCambio });
}
/* los lugares de la bandeja */
const slotX = (i) => Math.round(W * (1 + 2 * i) / 6);
const celBandeja = () => Math.round(CEL * 0.56 * CTRL.bandeja);
function rectSlot(i) { return { x: i * W / 3, y: BANDEJA_Y - 38, w: W / 3, h: 76 }; }

function actualizarPartida(dt) {
  const P = G;
  // tomar una pieza
  if (E.toque && !P.arr && !P.fin) {
    for (let i = 0; i < 3; i++) {
      const r = rectSlot(i), p = P.piezas[i];
      if (p && E.toque.x >= r.x && E.toque.x < r.x + r.w && E.toque.y >= r.y && E.toque.y < r.y + r.h) {
        const pt = E.punteros.get(E.toque.id);
        if (pt) pt.arrastre = true;
        P.arr = { i, id: E.toque.id, x0: E.toque.x, y0: E.toque.y, px: slotX(i), py: BANDEJA_Y, t: 0 };
        Sonido.sfx('tomar'); vibrar(8);
        break;
      }
    }
  }
  if (P.arr) {
    const a = P.arr, pt = E.punteros.get(a.id), p = P.piezas[a.i];
    a.t += dt;
    if (pt) {
      // la pieza va más rápido que el dedo (a gusto) y flota arriba de él
      const v = CTRL.velocidad;
      a.fx = a.x0 + (pt.x - a.x0) * v; a.fy = a.y0 + (pt.y - a.y0) * v;
      const alto = p.f.h * CEL, ancho = p.f.w * CEL;
      const objX = a.fx - ancho / 2 + (CTRL.zurdo ? 10 : -10) * Math.min(1, a.t * 6);
      const objY = a.fy - alto - 8 - CTRL.altura * 56;
      a.px = lerp(a.px, objX, Math.min(1, dt * 30)); a.py = lerp(a.py, objY, Math.min(1, dt * 30));
      a.gx = Math.round((a.px - TX) / CEL); a.gy = Math.round((a.py - TY) / CEL);
      a.ok = cabe(P.t, p.f, a.gx, a.gy);
    }
    if (!pt || (E.suelta && E.suelta.id === a.id)) {
      if (a.ok) colocar(a.i, a.gx, a.gy);
      else { Sonido.sfx('mal'); P.vuelta = { i: a.i, x: a.px, y: a.py, t: 0 }; }
      P.arr = null;
    }
  }
  if (P.vuelta) { P.vuelta.t += dt * 6; if (P.vuelta.t >= 1) P.vuelta = null; }
  // efectos
  for (const b of P.borrar) b.t += dt;
  P.borrar = P.borrar.filter((b) => b.t < b.d + 0.35);
  for (const p of P.pops) p.t += dt;
  P.pops = P.pops.filter((p) => p.t < 0.25);
  for (let i = P.part.length - 1; i >= 0; i--) { const q = P.part[i]; q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= Math.pow(0.3, dt); if (q.t <= 0) P.part.splice(i, 1); }
  for (let i = P.textos.length - 1; i >= 0; i--) { const q = P.textos[i]; q.t += dt; q.y -= 18 * dt; if (q.t > 1.1) P.textos.splice(i, 1); }
  for (let i = P.vuelan.length - 1; i >= 0; i--) { const q = P.vuelan[i]; q.t += dt * 1.6; if (q.t >= 1) { P.vuelan.splice(i, 1); Sonido.sfx('flor'); } }
  if (P.banner) { P.banner.t += dt; if (P.banner.t > 1.5) P.banner = null; }
  P.sacudir = Math.max(0, P.sacudir - dt * 18);
  P.vis = P.vis < P.puntos ? Math.min(P.puntos, P.vis + Math.max(1, (P.puntos - P.vis) * dt * 8)) : P.puntos;
  P.entrada = Math.min(1, P.entrada + dt * 4);
  P.tBrillo += dt;
  // el final
  if (P.fin) P.finT += dt;
  if (P.fin && P.finT > (P.gano ? 0.9 : 1.6) && escena === 'juego') { escena = P.gano ? 'gano' : 'fin'; tEsc = 0; }
  if (apretada('Escape', 'KeyP') && !P.fin) { escena = 'pausa'; tEsc = 0; }
}
function colocar(i, gx, gy) {
  const P = G, p = P.piezas[i];
  const res = poner(P.t, p.f, gx, gy, p.pintura);
  P.piezas[i] = null; P.movs++;
  for (const [a, b] of p.f.c) P.pops.push({ i: (gy + b) * N + gx + a, t: 0 });
  Sonido.sfx('poner'); vibrar(12);
  // polvito de pintura al apoyar
  for (const [a, b] of p.f.c) for (let k = 0; k < 2; k++) chispa(TX + (gx + a + 0.5) * CEL, TY + (gy + b + 1) * CEL - 2, azar(-20, 20), azar(-30, -5), PINTURAS[p.pintura - 1][1], 0.35, 60);
  if (res.lineas) {
    P.combo++; P.aguante = 3;
    // borra desde donde se puso hacia afuera
    const cx = gx + p.f.w / 2, cy = gy + p.f.h / 2;
    for (const c of res.celdas) {
      const x = c.i % N, y = (c.i / N) | 0;
      P.borrar.push({ x, y, col: c.col, flor: c.flor, t: 0, d: Math.hypot(x + 0.5 - cx, y + 0.5 - cy) * 0.025, hecho: false });
      if (c.flor && P.modo === 'barrio') P.vuelan.push({ x: TX + (x + 0.5) * CEL, y: TY + (y + 0.5) * CEL, t: -Math.hypot(x - cx, y - cy) * 0.03 });
    }
    for (const f of res.filas) P.textos.push({ linea: 'f', n: f, t: 0, y: 0 });
    for (const c of res.cols) P.textos.push({ linea: 'c', n: c, t: 0, y: 0 });
    Sonido.sfx('borrar', P.combo); vibrar(res.lineas >= 2 ? [20, 30, 30] : 25);
    P.sacudir = Math.min(6, 1.5 + res.lineas * 1.2 + P.combo * 0.3);
    const el = tr('elogios');
    if (res.vacio) { P.banner = { txt: tr('limpio'), t: 0, col: F.verde }; Sonido.sfx('limpio'); }
    else if (res.lineas >= 2 || P.combo >= 3) { P.banner = { txt: el[Math.min(el.length - 1, Math.max(res.lineas, Math.floor(P.combo / 2) + 1) - 2)], t: 0, col: [F.rojo, F.azul, F.verde, '#b07410', '#9a4ad8'][Math.min(4, res.lineas + P.combo) % 5] }; Sonido.sfx('elogio'); }
    if (P.modo === 'barrio' && res.flores) P.quedan -= res.flores;
  } else { P.aguante--; if (P.aguante <= 0) P.combo = 0; }
  const ganancia = puntaje(p.f.n, res.lineas, P.combo, res.vacio);
  P.puntos += ganancia;
  if (res.lineas) P.textos.push({ txt: '+' + ganancia, x: TX + (gx + p.f.w / 2) * CEL, y: TY + gy * CEL, t: 0, grande: ganancia >= 100 });
  if (P.puntos >= P.proximoCambio) { P.cambios++; P.proximoCambio += 1500; }
  // ¿ganó el nivel?
  if (P.modo === 'barrio' && P.quedan <= 0) { terminar(true); return; }
  if (P.piezas.every((q) => !q)) { P.piezas = nuevaTanda(P.t, P.rnd, P.puntos); P.entrada = 0; }
  if (!P.piezas.some((q) => q && hayLugar(P.t, q.f))) { if (P.cambios > 0) { P.atascado = true; } else terminar(false); }
  else P.atascado = false;
  if (!DATOS.ayuda) { DATOS.ayuda = true; guardarDatos(); }
  guardarPartida();
}
function usarCambio() {
  const P = G;
  if (P.cambios <= 0 || P.fin) return;
  P.cambios--; P.piezas = nuevaTanda(P.t, P.rnd, P.puntos); P.entrada = 0; P.atascado = false;
  Sonido.sfx('cambio'); vibrar(15);
  if (!P.piezas.some((q) => q && hayLugar(P.t, q.f))) { if (P.cambios <= 0) terminar(false); else P.atascado = true; }
  guardarPartida();
}
function terminar(gano) {
  const P = G;
  P.fin = true; P.gano = gano; P.finT = 0;
  if (gano) {
    const est = P.movs <= P.meta3 ? 3 : P.movs <= P.meta2 ? 2 : 1;
    P.estrellas = est;
    DATOS.estrellas[P.nivel] = Math.max(DATOS.estrellas[P.nivel] || 0, est);
    Sonido.sfx('gano');
  } else {
    Sonido.sfx('fin'); vibrar([40, 60, 80]);
    if (P.modo !== 'barrio') {
      P.nuevo = P.puntos > DATOS.record;
      if (P.nuevo) DATOS.record = P.puntos;
      if (P.modo === 'diario') { if (DATOS.diaFecha !== hoy()) { DATOS.diaFecha = hoy(); DATOS.diaRecord = 0; } DATOS.diaRecord = Math.max(DATOS.diaRecord, P.puntos); }
    }
  }
  guardarDatos(); guardarPartida();
}
function chispa(x, y, vx, vy, col, vida, grav) { if (G.part.length < 400) G.part.push({ x, y, vx, vy, col, t: vida, vida, grav: grav || 0, tam: Math.random() < 0.3 ? 2 : 1 }); }

/* ------------------------------------------------------- dibujo de partida */
function dibujarPartida(t) {
  const P = G;
  g.drawImage(fondo, 0, 0);
  const sx = P.sacudir > 0.3 ? Math.round(azar(-1, 1) * P.sacudir) : 0, sy = P.sacudir > 0.3 ? Math.round(azar(-1, 1) * P.sacudir) : 0;
  g.save(); g.translate(sx, sy);
  // el marco y las casillas
  marcoFilete(g, TX, TY, TAB, TAB, ESQS, 30);
  const vac = vacia();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.drawImage(vac, TX + x * CEL, TY + y * CEL);
  // la guía: dónde cae y qué líneas se borrarían
  let marcadas = null;
  if (P.arr && P.arr.ok) {
    const p = P.piezas[P.arr.i];
    if (CTRL.guia) {
      const { filas, cols } = lineasCon(P.t, p.f, P.arr.gx, P.arr.gy);
      marcadas = new Set(); for (const r of filas) for (let c = 0; c < N; c++) marcadas.add(r * N + c); for (const c of cols) for (let r = 0; r < N; r++) marcadas.add(r * N + c);
      g.globalAlpha = 0.35;
      for (const [a, b] of p.f.c) g.drawImage(ficha(p.pintura - 1, CEL - 2), TX + (P.arr.gx + a) * CEL + 1, TY + (P.arr.gy + b) * CEL + 1);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,248,236,' + (0.25 + Math.sin(t * 10) * 0.1) + ')';
      for (const [a, b] of p.f.c) { const x = TX + (P.arr.gx + a) * CEL, y = TY + (P.arr.gy + b) * CEL; g.fillRect(x + 1, y + 1, CEL - 2, 1); g.fillRect(x + 1, y + CEL - 2, CEL - 2, 1); g.fillRect(x + 1, y + 1, 1, CEL - 2); g.fillRect(x + CEL - 2, y + 1, 1, CEL - 2); }
    }
  }
  // las fichas
  const brillo = (P.tBrillo % 5) / 0.9;
  for (let i = 0; i < N * N; i++) {
    const v = P.t.col[i]; if (!v) continue;
    const x = i % N, y = (i / N) | 0;
    let pint = v - 1;
    if (marcadas && marcadas.has(i)) pint = P.piezas[P.arr.i].pintura - 1;
    const pop = P.pops.find((q) => q.i === i);
    const gris = P.fin && !P.gano && P.finT > (x + y) * 0.03;
    if (pop) { const k = 1 + Math.sin(pop.t / 0.25 * Math.PI) * 0.18, s = Math.round((CEL - 2) * k); g.drawImage(ficha(pint, CEL - 2), Math.round(TX + x * CEL + CEL / 2 - s / 2), Math.round(TY + y * CEL + CEL / 2 - s / 2), s, s); }
    else g.drawImage(ficha(gris ? 7 : pint, CEL - 2), TX + x * CEL + 1, TY + y * CEL + 1);
    if (gris) { g.fillStyle = 'rgba(20,16,24,0.6)'; g.fillRect(TX + x * CEL + 1, TY + y * CEL + 1, CEL - 2, CEL - 2); }
    if (P.t.flor[i]) { const f = florFicha(CEL - 2), b = Math.round(Math.sin(t * 3 + i) * 0.6); g.drawImage(f, TX + x * CEL + 1, TY + y * CEL + 1 + b); }
    if (marcadas && marcadas.has(i)) { g.fillStyle = 'rgba(255,255,255,' + (0.18 + Math.sin(t * 12) * 0.1) + ')'; g.fillRect(TX + x * CEL + 1, TY + y * CEL + 1, CEL - 2, CEL - 2); }
    // el brillo que pasa de vez en cuando
    if (brillo < 1) { const d = (x + y) / 14 - brillo; if (d > -0.08 && d < 0.04) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(TX + x * CEL + 2, TY + y * CEL + 2, CEL - 5, CEL - 5); } }
  }
  // lo que se está borrando
  for (const b of P.borrar) {
    const k = b.t - b.d; if (k < 0) { g.drawImage(ficha(b.col - 1, CEL - 2), TX + b.x * CEL + 1, TY + b.y * CEL + 1); if (b.flor) g.drawImage(florFicha(CEL - 2), TX + b.x * CEL + 1, TY + b.y * CEL + 1); continue; }
    if (!b.hecho) {
      b.hecho = true;
      const cx = TX + (b.x + 0.5) * CEL, cy = TY + (b.y + 0.5) * CEL, pin = PINTURAS[b.col - 1];
      for (let n = 0; n < 7; n++) { const a = Math.random() * Math.PI * 2, v = azar(30, 110); chispa(cx, cy, Math.cos(a) * v, Math.sin(a) * v - 40, pin[n % 3], azar(0.4, 0.8), 260); }
    }
    const s = Math.round((CEL - 2) * (1 - k / 0.35));
    if (s > 0) { g.fillStyle = k < 0.08 ? '#ffffff' : PINTURAS[b.col - 1][1]; g.fillRect(Math.round(TX + (b.x + 0.5) * CEL - s / 2), Math.round(TY + (b.y + 0.5) * CEL - s / 2), s, s); }
  }
  g.restore();
  // la bandeja
  dibujarBandeja(t);
  // lo que flota encima
  for (const q of P.part) { g.globalAlpha = Math.min(1, q.t / q.vida * 2); g.fillStyle = q.col; g.fillRect(Math.round(q.x), Math.round(q.y), q.tam, q.tam); }
  g.globalAlpha = 1;
  for (const q of P.textos) {
    if (!q.txt) continue;
    g.globalAlpha = clamp(1.1 - q.t, 0, 1);
    escribir(g, q.txt, q.x, q.y, { alin: 'centro', esc: q.grande ? 2 : 1, grad: GRAD_ORO, borde: K, filete: true, sombra: F.rojoOsc });
    g.globalAlpha = 1;
  }
  for (const q of P.vuelan) {
    if (q.t < 0) continue;
    const k = salida(q.t), tx = W / 2 - 20, ty = 34;
    const x = lerp(q.x, tx, k), y = lerp(q.y, ty, k) - Math.sin(k * Math.PI) * 30;
    flor(g, x, y, 4, [F.blanco, '#ffffff', '#c8b898']);
  }
  dibujarHUD(t);
  if (P.banner) dibujarBanner(P.banner);
  if (!DATOS.ayuda && !P.arr) {
    const txt = P.modo === 'barrio' ? tr('ayudaFlores') : tr('ayuda');
    const lin = envolver(txt, W - 30);
    g.fillStyle = 'rgba(13,11,16,0.8)'; g.fillRect(8, TY + TAB / 2 - 14, W - 16, lin.length * 9 + 10);
    lin.forEach((l, i) => escribir(g, l, W / 2, TY + TAB / 2 - 9 + i * 9, { alin: 'centro', grad: GRAD_CREMA, borde: K }));
    const k = (t % 1.6) / 1.6, hx = lerp(slotX(1), W / 2, k), hy = lerp(BANDEJA_Y, TY + TAB * 0.7, salida(k));
    disco(g, hx, hy, 4, 'rgba(255,248,236,0.8)'); disco(g, hx, hy, 2, F.rojo);
  }
  if (P.atascado && !P.fin) {
    const a = 0.5 + Math.sin(t * 6) * 0.5;
    g.globalAlpha = a; escribir(g, tr('cambioD'), W / 2, BANDEJA_Y + 40, { alin: 'centro', grad: GRAD_ORO, borde: K }); g.globalAlpha = 1;
  }
}
function dibujarFormaEn(p, x, y, s) {
  for (const [a, b] of p.f.c) g.drawImage(ficha(p.pintura - 1, s - 1), Math.round(x + a * s), Math.round(y + b * s));
}
function dibujarBandeja(t) {
  const P = G, cb = celBandeja();
  for (let i = 0; i < 3; i++) {
    const p = P.piezas[i];
    if (!p) continue;
    if (P.arr && P.arr.i === i) continue;
    const ent = salida(clamp(P.entrada * 1.3 - i * 0.15, 0, 1));
    let x = slotX(i) - p.f.w * cb / 2, y = BANDEJA_Y - p.f.h * cb / 2 + (1 - ent) * 60;
    if (P.vuelta && P.vuelta.i === i) { const k = salida(P.vuelta.t); x = lerp(P.vuelta.x, x, k); y = lerp(P.vuelta.y, y, k); }
    const sinLugar = !hayLugar(P.t, p.f);
    if (sinLugar) g.globalAlpha = 0.35;
    dibujarFormaEn(p, x, y, P.vuelta && P.vuelta.i === i ? lerp(CEL, cb, salida(P.vuelta.t)) : cb);
    g.globalAlpha = 1;
  }
  if (P.arr) {
    const p = P.piezas[P.arr.i], a = P.arr;
    g.globalAlpha = 0.35; g.fillStyle = K;
    for (const [x, y] of p.f.c) g.fillRect(Math.round(a.px + x * CEL + 4), Math.round(a.py + y * CEL + 5), CEL - 2, CEL - 2);
    g.globalAlpha = a.ok ? 1 : 0.85;
    dibujarFormaEn(p, a.px, a.py, CEL);
    g.globalAlpha = 1;
  }
}
function dibujarHUD(t) {
  const P = G;
  if (P.modo === 'barrio') {
    escribir(g, tr('nivel', P.nivel) + ' · ' + BARRIOS[Math.floor((P.nivel - 1) / 6)], W / 2, 8, { alin: 'centro', grad: GRAD_CREMA, borde: K });
    flor(g, W / 2 - 22, 34, 6, [F.blanco, '#ffffff', '#c8b898']); disco(g, W / 2 - 22, 34, 2, F.rojo);
    escribir(g, String(Math.max(0, P.quedan)), W / 2 - 10, 24, { esc: 3, grad: GRAD_ORO, sombra: F.rojoOsc });
    escribir(g, P.movs + ' / ' + P.meta3, W / 2, 50, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  } else {
    escribir(g, String(Math.floor(P.vis)), W / 2, 16, { alin: 'centro', esc: 4, grad: GRAD_ORO, sombra: F.rojo });
    // la corona del récord
    const rx = 8, ry = 8;
    g.fillStyle = F.oro; g.fillRect(rx, ry + 3, 9, 4); g.fillRect(rx, ry, 1, 3); g.fillRect(rx + 4, ry - 1, 1, 4); g.fillRect(rx + 8, ry, 1, 3);
    escribir(g, String(Math.max(DATOS.record, P.modo === 'clasico' ? P.puntos : 0)), rx + 13, ry, { grad: GRAD_ORO, borde: K });
    if (P.modo === 'diario') escribir(g, tr('diario'), W / 2, 56, { alin: 'centro', grad: GRAD_CELESTE, borde: K });
  }
  // el combo
  if (P.combo >= 2) {
    const w = 52; cinta(g, 10, 52, w, 11, F.rojo, F.rojoOsc);
    escribir(g, tr('combo') + ' X' + P.combo, 10 + w / 2, 54, { alin: 'centro', grad: GRAD_CREMA, borde: K });
  }
  // pausa
  const bx = W - 22, by = 6, apr = apretando(bx - 4, by - 4, 22, 22);
  disco(g, bx + 7, by + 7 + (apr ? 1 : 0), 8, K); disco(g, bx + 7, by + 7 + (apr ? 1 : 0), 7, F.oroOsc); disco(g, bx + 7, by + 6 + (apr ? 1 : 0), 6, F.oro);
  g.fillStyle = K; g.fillRect(bx + 4, by + 3 + (apr ? 1 : 0), 2, 7); g.fillRect(bx + 8, by + 3 + (apr ? 1 : 0), 2, 7);
  if (clicEn(bx - 4, by - 4, 22, 22) && !P.fin) { Sonido.sfx('boton'); escena = 'pausa'; tEsc = 0; }
  // el cambio de piezas
  const cx = W - 46, cy = 50, hay = P.cambios > 0, aprC = hay && apretando(cx - 2, cy - 2, 40, 18);
  g.globalAlpha = hay ? 1 : 0.45;
  g.fillStyle = K; g.fillRect(cx - 1, cy - 1 + (aprC ? 1 : 0), 38, 15);
  g.fillStyle = P.atascado ? (Math.floor(t * 4) % 2 ? F.verde : F.verdeOsc) : F.verdeOsc; g.fillRect(cx, cy + (aprC ? 1 : 0), 36, 13);
  g.fillStyle = F.oro; g.fillRect(cx, cy + (aprC ? 1 : 0), 36, 1);
  escribir(g, tr('cambio'), cx + 15, cy + 3 + (aprC ? 1 : 0), { alin: 'centro', grad: GRAD_CREMA, borde: K });
  disco(g, cx + 33, cy + 1, 5, F.rojo); escribir(g, String(P.cambios), cx + 33, cy - 2, { alin: 'centro', grad: GRAD_CREMA, borde: 'no', sinSombra: true });
  g.globalAlpha = 1;
  if (hay && clicEn(cx - 2, cy - 2, 40, 18)) usarCambio();
}
function dibujarBanner(b) {
  const k = b.t < 0.25 ? rebote(b.t / 0.25) : b.t > 1.25 ? 1 - salida((b.t - 1.25) / 0.25) : 1;
  const w = Math.max(60, anchoTexto(b.txt) * 2 + 24), x = W / 2 - w / 2 + (1 - k) * -W, y = TY + TAB / 2 - 14;
  cinta(g, x, y, w, 26, b.col, K);
  escribir(g, b.txt, x + w / 2, y + 7, { alin: 'centro', esc: 2, grad: GRAD_CREMA, sombra: K });
}

/* -------------------------------------------------------- otras escenas */
function panel(y, h) {
  g.fillStyle = 'rgba(13,11,16,0.82)'; g.fillRect(0, 0, W, H);
  marcoFilete(g, 18, y, W - 36, h, ESQS, 30);
}
function escenaPausa(t) {
  dibujarPartida(t);
  const y = Math.round(H / 2 - 90);
  panel(y, 180);
  escribir(g, tr('pausa'), W / 2, y + 12, { alin: 'centro', esc: tituloEsc(tr('pausa'), W - 60), grad: GRAD_ORO });
  let yy = y + 44;
  if (boton(40, yy, W - 80, 22, tr('seguir'), { col: F.verde }) || apretada('Escape', 'KeyP')) { escena = 'juego'; return; }
  yy += 28;
  if (boton(40, yy, W - 80, 20, tr('reiniciar'), { col: F.rojo })) { if (G.modo === 'clasico') Guardado.borrar('partida'); empezar(G.modo, G.nivel); return; }
  yy += 26;
  if (boton(40, yy, (W - 86) / 2, 20, tr('musica') + (Sonido.musicaSi ? '' : ' X'), { col: '#5a3a6a' })) Sonido.ponerMusica(!Sonido.musicaSi);
  if (boton(46 + (W - 86) / 2, yy, (W - 86) / 2, 20, tr('sonido') + (Sonido.efectosSi ? '' : ' X'), { col: '#5a3a6a' })) Sonido.ponerEfectos(!Sonido.efectosSi);
  yy += 26;
  if (boton(40, yy, W - 80, 20, tr('menu'), { col: F.azul })) { guardarPartida(); irA(G.modo === 'barrio' ? 'barrios' : 'menu'); }
}
function escenaFin(t) {
  dibujarPartida(t);
  const P = G, y = Math.round(H / 2 - 100);
  panel(y, 200);
  const w = 150; cinta(g, W / 2 - w / 2, y + 10, w, 18, F.rojo, F.rojoOsc);
  escribir(g, P.modo === 'barrio' ? tr('sinLugar') : tr('fin'), W / 2, y + 15, { alin: 'centro', grad: GRAD_CREMA, borde: K });
  if (P.modo === 'barrio') {
    escribir(g, tr('nivel', P.nivel), W / 2, y + 50, { alin: 'centro', esc: 2, grad: GRAD_ORO });
    escribir(g, tr('flores') + ' ' + (P.flores - Math.max(0, P.quedan)) + '/' + P.flores, W / 2, y + 80, { alin: 'centro', grad: GRAD_CREMA, borde: K });
  } else {
    const k = Math.min(1, tEsc / 0.8);
    escribir(g, String(Math.floor(P.puntos * salida(k))), W / 2, y + 44, { alin: 'centro', esc: 4, grad: GRAD_ORO, sombra: F.rojo });
    escribir(g, tr('record') + ' ' + DATOS.record, W / 2, y + 86, { alin: 'centro', grad: GRAD_CREMA, borde: K });
    if (P.nuevo && Math.floor(t * 3) % 2) escribir(g, tr('nuevoRecord'), W / 2, y + 100, { alin: 'centro', grad: GRAD_VERDE, borde: K });
  }
  if (boton(36, y + 122, W - 72, 24, P.modo === 'barrio' ? tr('reintentar') : tr('otra'), { col: F.verde }) || apretada('Enter', 'Space')) { empezar(P.modo, P.nivel); return; }
  if (boton(36, y + 154, W - 72, 20, tr('menu'), { col: F.azul })) irA(P.modo === 'barrio' ? 'barrios' : 'menu');
}
function escenaGano(t) {
  dibujarPartida(t);
  const P = G, y = Math.round(H / 2 - 100);
  panel(y, 200);
  escribir(g, tr('ganaste'), W / 2, y + 12, { alin: 'centro', esc: tituloEsc(tr('ganaste'), W - 60), grad: GRAD_ORO });
  escribir(g, tr('nivelHecho'), W / 2, y + 40, { alin: 'centro', grad: GRAD_CREMA, borde: K });
  for (let s = 0; s < 3; s++) {
    const k = clamp((tEsc - 0.3 - s * 0.3) / 0.3, 0, 1), on = s < P.estrellas && k > 0;
    if (on && !P['e' + s]) { P['e' + s] = true; Sonido.sfx('estrella', 1 + s * 0.12); vibrar(15); }
    const r = 11 * (on ? Math.max(0.05, rebote(k)) : 1);
    estrella(g, W / 2 - 36 + s * 36, y + 80 - (s === 1 ? 6 : 0), on, r);
  }
  if (P.nivel < NIVELES && boton(36, y + 122, W - 72, 24, tr('siguiente'), { col: F.verde })) { empezar('barrio', P.nivel + 1); return; }
  if (boton(36, y + 154, W - 72, 20, tr('menu'), { col: F.azul })) irA('barrios');
}
/* ------------------------------------------------------------- controles */
let prueba = null;
function escenaControles(t) {
  fondoMenu(t);
  escribir(g, tr('controles'), W / 2, 12, { alin: 'centro', esc: tituloEsc(tr('controles')), grad: GRAD_ORO });
  let y = 42;
  const regla = (txt, k, min, max, paso) => {
    escribir(g, txt, 10, y + 5, { grad: GRAD_CREMA, borde: K });
    if (boton(W - 80, y, 18, 17, '-', { col: '#5a3a6a' })) { CTRL[k] = Math.round(clamp(CTRL[k] - paso, min, max) * 100) / 100; guardarCtrl(); }
    escribir(g, Math.round(CTRL[k] * 100) + '%', W - 43, y + 5, { alin: 'centro', grad: GRAD_ORO, borde: K });
    if (boton(W - 26, y, 18, 17, '+', { col: '#5a3a6a' })) { CTRL[k] = Math.round(clamp(CTRL[k] + paso, min, max) * 100) / 100; guardarCtrl(); }
    y += 22;
  };
  const llave = (txt, k) => {
    escribir(g, txt, 10, y + 5, { grad: GRAD_CREMA, borde: K });
    if (boton(W - 62, y, 54, 17, CTRL[k] ? tr('si') : tr('no'), { col: CTRL[k] ? F.verde : '#5a3a6a' })) { CTRL[k] = !CTRL[k]; guardarCtrl(); if (k === 'vibrar' && CTRL[k]) vibrar(40); }
    y += 22;
  };
  regla(tr('altura'), 'altura', 0, 1.5, 0.25);
  regla(tr('velocidad'), 'velocidad', 1, 2, 0.1);
  regla(tr('bandeja'), 'bandeja', 0.8, 1.3, 0.1);
  llave(tr('guia'), 'guia');
  llave(tr('zurdo'), 'zurdo');
  llave(tr('vibrar'), 'vibrar');
  // la zona de prueba: una pieza para arrastrar y ver cómo queda
  const zy = y + 6, zh = H - zy - 34;
  g.fillStyle = 'rgba(255,207,58,0.06)'; g.fillRect(8, zy, W - 16, zh);
  escribir(g, tr('proba'), W / 2, zy + 4, { alin: 'centro', grad: GRAD.gris, borde: 'no', sinSombra: true });
  const pieza = { f: FORMAS.find((f) => f.n === 4 && f.w === 2), pintura: 3 }, cb = celBandeja(), sx = W / 2, sy = zy + zh - 26;
  if (E.toque && Math.abs(E.toque.x - sx) < 30 && Math.abs(E.toque.y - sy) < 30 && !prueba) { const pt = E.punteros.get(E.toque.id); if (pt) pt.arrastre = true; prueba = { id: E.toque.id, x0: E.toque.x, y0: E.toque.y }; Sonido.sfx('tomar'); }
  if (prueba) {
    const pt = E.punteros.get(prueba.id);
    if (!pt) prueba = null;
    else {
      const fx = prueba.x0 + (pt.x - prueba.x0) * CTRL.velocidad, fy = prueba.y0 + (pt.y - prueba.y0) * CTRL.velocidad;
      const px = fx - pieza.f.w * CEL / 2 + (CTRL.zurdo ? 10 : -10), py = fy - pieza.f.h * CEL - 8 - CTRL.altura * 56;
      dibujarFormaEn(pieza, px, py, CEL);
      disco(g, pt.x, pt.y, 5, 'rgba(255,248,236,0.4)'); disco(g, pt.x, pt.y, 2, F.rojo);
    }
  }
  if (!prueba) dibujarFormaEn(pieza, sx - pieza.f.w * cb / 2, sy - pieza.f.h * cb / 2, cb);
  if (boton(10, H - 26, 90, 20, tr('restablecer'), { col: F.rojo })) { Object.assign(CTRL, CTRL_BASE); guardarCtrl(); }
  if (boton(W - 100, H - 26, 90, 20, tr('listo'), { col: F.verde }) || apretada('Escape')) irA('menu');
}

/* ------------------------------------------------------------------ bucle */
let ultimo = 0;
function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, ultimo ? (ts - ultimo) / 1000 : 1 / 60); ultimo = ts;
  const t = ts / 1000;
  tEsc += dt;
  if (trans) { trans.t += dt; if (!trans.hecho && trans.t >= trans.dur) { trans.hecho = true; trans.alMedio(); } if (trans.t >= trans.dur * 2) trans = null; }
  try {
    switch (escena) {
      case 'intro': escenaIntro(dt); break;
      case 'idioma': escenaIdioma(t); break;
      case 'menu': escenaMenu(t); break;
      case 'barrios': Sonido.musica(TEMAS.menu); escenaBarrios(t); break;
      case 'juego': Sonido.musica(G.modo === 'barrio' ? TEMAS.barrio : TEMAS.juego); if (!trans) actualizarPartida(dt); dibujarPartida(t); break;
      case 'pausa': escenaPausa(t); break;
      case 'fin': escenaFin(t); break;
      case 'gano': escenaGano(t); break;
      case 'controles': escenaControles(t); break;
    }
  } catch (e) { console.error(e); }
  if (trans) dibujarTrans(trans.t < trans.dur ? trans.t / trans.dur : 2 - trans.t / trans.dur);
  E.clic = null; E.toque = null; E.suelta = null; E.recien.clear();
}
function arrancar() {
  ajustar();
  intro = crearIntroJXS({ W, H, presenta: TXT[IDIOMA].presenta, vibrar, estilo: ESTILO_FILETE });
  Sonido.iniciar();
  if (Sonido.ctx && Sonido.ctx.state === 'running') musicaIntro = jingleJXS(Sonido.ctx, Sonido.total, ESTILO_FILETE);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (escena === 'juego' && G && !G.fin) { escena = 'pausa'; tEsc = 0; } Sonido.pausar(true); } else Sonido.pausar(false); });
  requestAnimationFrame(cuadro);
  window.__filete = { get G() { return G; }, get escena() { return escena; }, empezar, colocar, terminar, irA, DATOS, CTRL, FORMAS };
}
arrancar();
