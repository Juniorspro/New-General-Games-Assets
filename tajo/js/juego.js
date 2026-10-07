/* ============================================================================
   TAJO: escenas (intro, idioma, menú, partida, pausa, fin, dojo, controles),
   el filo y los cortes, las olas de fruta, los cuatro modos, los poderes y el
   bucle. Todo en unidades de 360 de ancho; S lo pasa a píxeles.
   ========================================================================== */

const lienzoP = document.getElementById('lienzo');
const g = lienzoP.getContext('2d');
let escena = 'intro', tEsc = 0, trans = null, fondo = null, G = null, ahora = 0, dtCuadro = 1 / 60;

const CTRL_BASE = { grosor: 1, sensib: 1, alcance: 1, tamPausa: 1, zurdo: false, vibrar: true };
const CTRL = Object.assign({}, CTRL_BASE, Guardado.leer('controles', {}));
const guardarCtrl = () => Guardado.escribir('controles', CTRL);
// el umbral es la velocidad del dedo (unidades por segundo) a partir de la que el filo corta
const GROSORES = [10, 15, 21], UMBRALES = [950, 600, 340], ALCANCES = [0, 7, 14], TAM_PAUSA = [30, 38, 48];
function vibrar(ms) { if (CTRL.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } }
const GRIS = '#6a5a48';

/* --------------------------------------------------------------- pantalla */
function ajustar() {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = innerWidth, ch = innerHeight;
  let cssW = cw / ch > 0.6 ? ch * 0.5625 : cw;
  H = clamp(Math.round(W * ch / cssW), 600, 800);
  let cssH = cssW * H / W;
  if (cssH > ch) { cssW *= ch / cssH; cssH = ch; }
  lienzoP.width = Math.round(cssW * dpr); lienzoP.height = Math.round(cssH * dpr);
  S = lienzoP.width / W;
  Object.assign(lienzoP.style, { width: cssW + 'px', height: cssH + 'px', left: Math.round((cw - cssW) / 2) + 'px', top: Math.round((ch - cssH) / 2) + 'px' });
  cacheFruta.clear(); cacheTrazos.clear();
  fondo = pintarFondo();
}
addEventListener('resize', ajustar);

/* el fondo: papel de arroz con montes en la niebla, el sol rojo y bambú a la izquierda */
function pintarFondo() {
  const c = papelWashi(W, H, 11, true), f = c.getContext('2d');
  const sx = W * 0.77, sy = H * 0.2, sr = 38;
  const sol = f.createRadialGradient(sx - 6, sy - 6, sr * 0.1, sx, sy, sr * 1.12);
  sol.addColorStop(0, 'rgba(214,70,40,0.8)'); sol.addColorStop(0.85, 'rgba(200,50,30,0.72)'); sol.addColorStop(1, 'rgba(200,50,30,0)');
  f.fillStyle = sol; f.beginPath(); f.arc(sx, sy, sr * 1.12, 0, Math.PI * 2); f.fill();
  const r = rngSemilla(19);
  for (const [bx, inc, ancho] of [[14, 0.035, 8], [38, -0.02, 5.5]]) {
    let y = H + 10;
    while (y > -30) {
      const l = 46 + r() * 32, x0 = bx + (H - y) * inc, x1 = bx + (H - y + l) * inc;
      f.globalAlpha = 0.26; f.strokeStyle = '#26301e'; f.lineWidth = ancho; f.lineCap = 'butt';
      f.beginPath(); f.moveTo(x0, y - 2); f.lineTo(x1, y - l + 2); f.stroke();
      f.strokeStyle = TINTA; f.lineWidth = 1.6; f.beginPath(); f.moveTo(x1 - ancho * 0.7, y - l); f.lineTo(x1 + ancho * 0.7, y - l + 1); f.stroke();
      f.globalAlpha = 1;
      if (r() < 0.3) for (let k = 0; k < 3; k++) { f.globalAlpha = 0.2; hoja(f, x1, y - l, 24 + r() * 16, 0.15 + k * 0.5 + r() * 0.2, '#26301e'); }
      f.globalAlpha = 1;
      y -= l;
    }
  }
  return c;
}

/* ---------------------------------------------------------------- entrada */
const E = { punteros: new Map(), clic: null, toque: null, teclas: new Set(), recien: new Set() };
// el filo sigue al primer dedo que toca; las muestras llegan con su hora para medir la velocidad
const FILO = { ra: nuevoRastro(), id: null, muestras: [], ult: null, activo: 0 };
function aLogico(cx, cy) { const r = lienzoP.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; }
lienzoP.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); Sonido.iniciar();
  try { lienzoP.setPointerCapture(ev.pointerId); } catch (x) { /* */ }
  const p = aLogico(ev.clientX, ev.clientY);
  E.punteros.set(ev.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, mov: 0 });
  E.toque = { x: p.x, y: p.y };
  if (FILO.id == null) { FILO.id = ev.pointerId; FILO.ra.pts = []; FILO.ult = { x: p.x, y: p.y, t: ev.timeStamp / 1000 }; rastroSumar(FILO.ra, p.x, p.y, FILO.ult.t); }
});
lienzoP.addEventListener('pointermove', (ev) => {
  const pt = E.punteros.get(ev.pointerId); if (!pt) return;
  const lista = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
  for (const e of (lista && lista.length ? lista : [ev])) {
    const p = aLogico(e.clientX, e.clientY);
    pt.mov = Math.max(pt.mov, Math.hypot(p.x - pt.x0, p.y - pt.y0)); pt.x = p.x; pt.y = p.y;
    if (ev.pointerId === FILO.id) FILO.muestras.push({ x: p.x, y: p.y, t: e.timeStamp / 1000 });
  }
});
const finPuntero = (ev) => {
  const pt = E.punteros.get(ev.pointerId); if (!pt) return;
  E.punteros.delete(ev.pointerId);
  if (pt.mov < 14) E.clic = { x: pt.x, y: pt.y, x0: pt.x0, y0: pt.y0 };
  if (ev.pointerId === FILO.id) FILO.id = null;
};
lienzoP.addEventListener('pointerup', finPuntero); lienzoP.addEventListener('pointercancel', finPuntero);
lienzoP.addEventListener('contextmenu', (ev) => ev.preventDefault());
addEventListener('keydown', (ev) => { if (['Space', 'Escape'].includes(ev.code)) ev.preventDefault(); if (!E.teclas.has(ev.code)) E.recien.add(ev.code); E.teclas.add(ev.code); Sonido.iniciar(); });
addEventListener('keyup', (ev) => E.teclas.delete(ev.code));
const apretada = (...c) => c.some((k) => E.recien.has(k));
const clicEn = (x, y, w, h) => { const c = E.clic; return !!c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.x0 >= x - 6 && c.x0 < x + w + 6 && c.y0 >= y - 6 && c.y0 < y + h + 6; };
function apretando(x, y, w, h) { for (const p of E.punteros.values()) if (p.mov < 14 && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return true; return false; }

/* el filo: recorre las muestras del dedo; cada tramo rápido corta lo que cruza */
function filoPaso(objs, alCortar) {
  const umbral = UMBRALES[CTRL.sensib], alc = ALCANCES[CTRL.alcance];
  for (const s of FILO.muestras) {
    const u = FILO.ult; if (!u) { FILO.ult = s; continue; }
    const dx = s.x - u.x, dy = s.y - u.y, l = Math.hypot(dx, dy), v = l / Math.max(0.004, s.t - u.t);
    rastroSumar(FILO.ra, s.x, s.y, s.t);
    if (v > umbral && l > 1.5) {
      FILO.activo = ahora;
      if (l > 16 && v > umbral * 1.3) Sonido.sfx('zas', clamp(v / 3000, 0, 1));
      if (objs) for (const o of objs) if (o.vivo && distSeg(o.x, o.y, u.x, u.y, s.x, s.y) < o.r * 0.95 + alc) alCortar(o, Math.atan2(dy, dx));
    }
    FILO.ult = s;
  }
  FILO.muestras.length = 0;
  rastroPodar(FILO.ra, ahora, 0.15);
}
const brillos = [];
function dibujarFilo() {
  const f = filoActual();
  dibujarRastro(g, FILO.ra, f, GROSORES[CTRL.grosor], ahora, 0.15);
  if (f.oro && FILO.ra.pts.length > 1 && ahora - FILO.activo < 0.05 && brillos.length < 120) {
    const p = FILO.ra.pts[FILO.ra.pts.length - 1];
    for (let i = 0; i < 2; i++) brillos.push({ x: p.x + azar(-6, 6), y: p.y + azar(-6, 6), vx: azar(-30, 30), vy: azar(-40, 10), t: 0, vida: azar(0.3, 0.6) });
  }
  for (let i = brillos.length - 1; i >= 0; i--) {
    const b = brillos[i]; b.t += dtCuadro; b.x += b.vx * dtCuadro; b.y += b.vy * dtCuadro; b.vy += 60 * dtCuadro;
    if (b.t > b.vida) { brillos.splice(i, 1); continue; }
    g.fillStyle = 'rgba(255,214,110,' + (1 - b.t / b.vida) + ')'; g.fillRect(b.x - 1, b.y - 1, 2.2, 2.2);
  }
}

/* --------------------------------------------- pinceladas: botones y ensō */
const cacheTrazos = new Map();
/* una pincelada horizontal: cabeza redonda donde apoya el pincel, cola deshilachada y vetas secas */
function pincelada(w, h, col, sem) {
  const clave = ['p', w, h, col, sem, S].join('|');
  let c = cacheTrazos.get(clave); if (c) return c;
  let f; [c, f] = lienzoHD(w + 16, h + 12);
  const r = rngSemilla(sem + 1), x0 = 8, y0 = 6, n = Math.max(6, Math.round(w / 14)), arriba = [], abajo = [];
  for (let i = 0; i <= n; i++) { const x = x0 + (w * i) / n; arriba.push([x, y0 + (r() - 0.5) * 2.2 + Math.sin(i * 0.9) * 0.7]); abajo.push([x, y0 + h + (r() - 0.5) * 2.2]); }
  f.beginPath(); f.moveTo(arriba[0][0] + 4, arriba[0][1]);
  for (const p of arriba) f.lineTo(p[0], p[1]);
  for (let k = 0; k <= 5; k++) f.lineTo(x0 + w + r() * 7 - (k % 2) * 5, y0 + (h * k) / 5);
  for (let i = abajo.length - 1; i >= 0; i--) f.lineTo(abajo[i][0], abajo[i][1]);
  f.quadraticCurveTo(x0 - 6, y0 + h / 2, arriba[0][0] + 4, arriba[0][1]);
  f.closePath(); f.fillStyle = col; f.globalAlpha = 0.95; f.fill(); f.globalAlpha = 1;
  f.strokeStyle = 'rgba(239,229,207,0.3)'; f.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const y = y0 + h * (0.2 + k * 0.2) + (r() - 0.5) * 2; f.lineWidth = 0.6 + r() * 0.9; f.beginPath(); f.moveTo(x0 + w * (0.35 + r() * 0.3), y); f.lineTo(x0 + w + 2, y + (r() - 0.5) * 2); f.stroke(); }
  cacheTrazos.set(clave, c);
  return c;
}
function boton(x, y, w, h, txt, o) {
  o = o || {};
  const apr = !o.apagado && apretando(x, y, w, h), col = o.apagado ? '#8c8072' : apr ? BERMELLON : (o.col || TINTA), dy = apr ? 1.5 : 0;
  g.drawImage(pincelada(Math.round(w), Math.round(h), col, o.sem || (Math.round(x * 7 + y * 3) % 97)), x - 8, y - 6 + dy, w + 16, h + 12);
  texto(g, txt, x + w / 2, y + h / 2 + 1 + dy, { tam: tamQueEntra(g, txt, o.tam || 16, w - 18), col: '#f5ecd8', tinta: false });
  const si = !o.apagado && clicEn(x, y, w, h);
  if (si) { Sonido.sfx('boton'); vibrar(8); }
  return si;
}
function opcion(x, y, w, h, txt, sel) {
  g.drawImage(pincelada(w, h, sel ? TINTA : '#cdbf9f', Math.round(x + y) % 53), x - 8, y - 6, w + 16, h + 12);
  texto(g, txt, x + w / 2, y + h / 2 + 1, { tam: tamQueEntra(g, txt, 12, w - 10), col: sel ? '#f5ecd8' : TINTA, tinta: false });
  const si = !sel && clicEn(x, y, w, h);
  if (si) { Sonido.sfx('boton'); vibrar(8); }
  return si;
}
/* el ensō: el círculo zen de una sola pincelada, que se seca al final y no cierra */
function enso(r, sem) {
  const clave = ['e', r, sem, S].join('|');
  let c = cacheTrazos.get(clave); if (c) return c;
  let f; const R = r + 14; [c, f] = lienzoHD(R * 2, R * 2); f.translate(R, R);
  const rnd = rngSemilla(sem * 13 + 1), a0 = -Math.PI * 0.42 + rnd() * 0.4, span = Math.PI * 1.82, n = 110;
  f.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const s = i / n, a = a0 + s * span, a2 = a0 + ((i + 1) / n) * span + 0.012;
    const w = r * 0.19 * (1 - s * 0.72) * (0.85 + 0.3 * Math.sin(s * 9 + sem)), rr = r + Math.sin(s * 5 + sem) * r * 0.025;
    if (s < 0.76) { f.strokeStyle = 'rgba(22,17,13,' + (0.9 - s * 0.25) + ')'; f.lineWidth = w; f.beginPath(); f.arc(0, 0, rr, a, a2); f.stroke(); }
    else for (let k = -1; k <= 1; k++) { if (rnd() < 0.3) continue; f.strokeStyle = 'rgba(22,17,13,' + Math.max(0.1, 0.7 - (s - 0.76) * 2.2) + ')'; f.lineWidth = w * 0.28; f.beginPath(); f.arc(0, 0, rr + k * w * 0.33, a, a2); f.stroke(); }
  }
  // la gota donde apoyó el pincel
  f.fillStyle = 'rgba(22,17,13,0.85)'; f.beginPath(); f.arc(Math.cos(a0) * r, Math.sin(a0) * r, r * 0.11, 0, Math.PI * 2); f.fill();
  c.R = R; cacheTrazos.set(clave, c);
  return c;
}
function dibujarEnso(x, y, r, sem, alfa) { const e = enso(r, sem); g.globalAlpha = alfa == null ? 1 : alfa; g.drawImage(e, x - e.R, y - e.R, e.R * 2, e.R * 2); g.globalAlpha = 1; }

/* ------------------------------------------------------------ transición */
function irA(nueva, alMedio) {
  if (trans) return;
  trans = { t: 0, dur: 0.3, alMedio: () => { if (alMedio) alMedio(); if (nueva) { escena = nueva; tEsc = 0; if (AL_ENTRAR[nueva]) AL_ENTRAR[nueva](); } }, hecho: false };
}
/* un pincelazo de tinta cruza la pantalla, tapa y sigue de largo destapando */
function dibujarTrans(tz) {
  const d = tz.dur, t = tz.t;
  let L, R;
  if (t < d) { L = -80; R = -80 + salida(t / d) * (W + 170); } else { L = -80 + salida((t - d) / d) * (W + 170); R = W + 90; }
  g.fillStyle = TINTA; g.beginPath();
  for (let y = -10; y <= H + 10; y += 10) g.lineTo(R + Math.sin(y * 0.045) * 16 + Math.sin(y * 0.17) * 5, y);
  for (let y = H + 10; y >= -10; y -= 10) g.lineTo(L + Math.sin(y * 0.05 + 2) * 16 + Math.sin(y * 0.15) * 5, y);
  g.closePath(); g.fill();
  if (t < d) { const r = rngSemilla(9); for (let i = 0; i < 14; i++) { const y = r() * H, x = R + 10 + r() * 30; g.beginPath(); g.arc(x, y, 1 + r() * 3.5, 0, Math.PI * 2); g.fill(); } }
}

/* el título: TAJO cortado en diagonal (la mitad de arriba corrida) con el tajo en bermellón */
function tituloTajo(y, t) {
  const cx = W / 2, a = -0.3, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, L = 300;
  const corre = 3 + Math.sin(t * 1.2) * 0.8;
  for (const lado of [1, -1]) {
    g.save(); g.beginPath();
    g.moveTo(cx - dx * L, y - dy * L); g.lineTo(cx + dx * L, y + dy * L);
    g.lineTo(cx + dx * L + nx * L * lado, y + dy * L + ny * L * lado); g.lineTo(cx - dx * L + nx * L * lado, y - dy * L + ny * L * lado);
    g.closePath(); g.clip();
    const ox = lado < 0 ? -dx * corre - nx * 1.4 : 0, oy = lado < 0 ? -dy * corre - ny * 1.4 : 0;
    texto(g, 'TAJO', cx + ox, y + oy, { tam: 80 });
    g.restore();
  }
  g.fillStyle = BERMELLON; g.beginPath();
  g.moveTo(cx - dx * 130, y - dy * 130); g.quadraticCurveTo(cx - nx * 2.6, y - ny * 2.6, cx + dx * 140, y + dy * 140); g.quadraticCurveTo(cx + nx * 1.2, y + ny * 1.2, cx - dx * 130, y - dy * 130);
  g.fill();
  hanko(g, cx + 112, y + 30, 26, 'JX', 0.06);
  texto(g, tr('subtitulo'), cx, y + 54, { tam: 13, col: GRIS, tinta: false });
}

/* ------------------------------------------------- mundos: mitades y tinta */
function partirFruta(M, f, a) {
  const nx = Math.sin(a), ny = -Math.cos(a), emp = azar(70, 115), esc = f.esc || 1;
  for (const lado of [0, 1]) {
    const sg = lado ? -1 : 1;
    M.mitades.push({ tipo: f.tipo, x: f.x + nx * sg * 2, y: f.y + ny * sg * 2, vx: (f.vx || 0) * 0.45 + nx * sg * emp + Math.cos(a) * 40, vy: (f.vy || 0) * 0.35 + ny * sg * emp - 50,
      ang: a, off: (f.ang || 0) - a, giro: sg * azar(2, 5), lado, t: 0, esc });
  }
  const jugo = FRUTAS[f.tipo].jugo, r = FRUTAS[f.tipo].r * esc;
  M.manchas.push({ x: f.x, y: f.y, col: jugo, ang: a, tam: r * 0.85, t: 0, vida: 5, sem: (Math.random() * 1e6) | 0 });
  if (M.manchas.length > 22) M.manchas.shift();
  for (let i = 0; i < 16; i++) {
    const d = a + (Math.random() < 0.75 ? 0 : Math.PI) + azar(-0.8, 0.8), v = azar(80, 280);
    M.gotas.push({ x: f.x, y: f.y, vx: Math.cos(d) * v, vy: Math.sin(d) * v - 40, t: 0, vida: azar(0.4, 0.9), col: jugo, tam: azar(1.2, 3.4) });
  }
}
function pasoMundo(M, dt, k) {
  k = k || 1;
  for (let i = M.mitades.length - 1; i >= 0; i--) { const m = M.mitades[i]; m.t += dt; m.vy += GRAV * dt * k; m.x += m.vx * dt * k; m.y += m.vy * dt * k; m.ang += m.giro * dt * k; if (m.y > H + 80) M.mitades.splice(i, 1); }
  for (let i = M.gotas.length - 1; i >= 0; i--) { const q = M.gotas[i]; q.t += dt; q.vy += GRAV * 0.6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; if (q.t > q.vida) M.gotas.splice(i, 1); }
  for (let i = M.manchas.length - 1; i >= 0; i--) { const m = M.manchas[i]; m.t += dt; if (m.t > m.vida) M.manchas.splice(i, 1); }
}
function dibujarManchas(M) {
  for (const m of M.manchas) {
    const a = 0.5 * (1 - Math.pow(m.t / m.vida, 2));
    salpicon(g, m.x, m.y, m.tam * 0.55, m.col, rngSemilla(m.sem), m.ang, a);
    g.save(); g.translate(m.x, m.y); g.rotate(m.ang); g.globalAlpha = a * 0.7; g.fillStyle = m.col;
    g.beginPath(); g.ellipse(m.tam * 0.4, 0, m.tam * 1.6, m.tam * 0.15, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.globalAlpha = 1;
}
function dibujarMundo(M) {
  for (const m of M.mitades) dibujarMitad(g, m);
  for (const q of M.gotas) { g.globalAlpha = 1 - (q.t / q.vida) * 0.6; g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.tam, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}
const nuevoMundo = () => ({ mitades: [], manchas: [], gotas: [] });

/* ------------------------------------------------------------------ intro */
let intro = null, musicaIntro = null;
function escenaIntro(dt) {
  filoPaso(null);
  if (E.toque || apretada('Enter', 'Space', 'Escape')) { intro.saltar(); if (intro.listo && musicaIntro) musicaIntro.cortar(); }
  intro.pasar(dt); intro.dibujar(g);
  if (intro.listo && !trans) irA('idioma');
}
function escenaIdioma(t) {
  filoPaso(null);
  g.drawImage(fondo, 0, 0, W, H);
  tituloTajo(H * 0.16, t);
  const y0 = Math.round(H * 0.38);
  ['es', 'en', 'pt'].forEach((l, i) => texto(g, TXT[l].idioma, W / 2, y0 + i * 20, { tam: 13, col: i === 1 ? BERMELLON : TINTA, tinta: false }));
  const nombres = { es: 'ESPAÑOL', en: 'ENGLISH', pt: 'PORTUGUÊS' };
  ['es', 'en', 'pt'].forEach((l, i) => { if (boton(80, y0 + 84 + i * 60, W - 160, 42, nombres[l], { tam: 18, col: l === IDIOMA ? BERMELLON : TINTA })) { IDIOMA = l; Guardado.escribir('idioma', l); irA('menu'); } });
}

/* ------------------------------------------------------------------- menú */
const MODOS = [{ id: 'clasico', fruta: 'sandia' }, { id: 'zen', fruta: 'durazno' }, { id: 'tormenta', fruta: 'platano', poder: 'frenesi' }, { id: 'diario', fruta: 'naranja' }];
let MENU = null;
function prepararMenu() { MENU = Object.assign(nuevoMundo(), { objs: MODOS.map((m, i) => ({ modo: m.id, tipo: m.fruta, poder: m.poder, x: 0, y: 0, r: FRUTAS[m.fruta].r * 1.05, esc: 1.05, vivo: true, ang: 0, i })), elegido: null, tElegido: 0 }); }
function cortarMenu(o, a) {
  if (MENU.elegido) return;
  o.vivo = false; partirFruta(MENU, o, a);
  MENU.elegido = o.modo; MENU.tElegido = ahora;
  Sonido.sfx('corte', 4); vibrar(15);
}
function escenaMenu(t) {
  const M = MENU;
  g.drawImage(fondo, 0, 0, W, H);
  pasoMundo(M, dtCuadro);
  dibujarManchas(M);
  tituloTajo(H * 0.12, t);
  const pos = [[W * 0.28, H * 0.385], [W * 0.72, H * 0.385], [W * 0.28, H * 0.625], [W * 0.72, H * 0.625]];
  M.objs.forEach((o, i) => {
    const [cx, cy] = pos[i];
    o.x = cx; o.y = cy + Math.sin(t * 1.6 + i * 1.7) * 4; o.ang = Math.sin(t * 0.7 + i) * 0.4;
    dibujarEnso(cx, cy, 50, 3 + i, M.elegido && M.elegido !== o.modo ? 0.4 : 1);
    if (o.vivo) dibujarFruta(g, o.tipo, o.x, o.y, o.ang, 1.05, o.poder, t);
    texto(g, tr(o.modo), cx, cy + 69, { tam: 17 });
    const rec = o.modo === 'diario' ? tr('hoyRec', DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0) : tr('record') + ' ' + DATOS.rec[o.modo];
    texto(g, rec, cx, cy + 87, { tam: 11, col: BERMELLON, tinta: false });
    const d = tr(o.modo + 'D');
    texto(g, d, cx, cy + 101, { tam: tamQueEntra(g, d, 9.5, W * 0.44, 'bold'), col: GRIS, tinta: false });
    if (o.vivo && clicEn(cx - 56, cy - 56, 112, 112)) cortarMenu(o, -0.6);
  });
  dibujarMundo(M);
  filoPaso(M.elegido ? null : M.objs, cortarMenu);
  if (M.elegido && ahora - M.tElegido > 0.42 && !trans) { const m = M.elegido; M.elegido = '·'; irA('juego', () => empezar(m)); }
  g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3); texto(g, tr('elegir'), W / 2, H - 92, { tam: 12, col: TINTA, tinta: false }); g.globalAlpha = 1;
  const bw = (W - 48) / 3;
  if (boton(16, H - 58, bw, 34, tr('dojo'), { tam: 14 })) irA('dojo');
  if (boton(24 + bw, H - 58, bw, 34, tr('controles'), { tam: 14 })) irA('controles');
  if (boton(32 + bw * 2, H - 58, bw, 34, tr('idiomaBtn'), { tam: 14 })) irA('idioma');
  dibujarFilo();
}

/* ---------------------------------------------------------------- partida */
const DUR_PODER = { hielo: 6, frenesi: 5, doble: 7 };
function modoRecord(m) { return m === 'diario' ? (DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0) : DATOS.rec[m]; }
function empezar(modo) {
  const diario = modo === 'diario';
  G = Object.assign(nuevoMundo(), {
    modo, rnd: diario ? rngSemilla(hoy()) : Math.random, t: 0, puntos: 0, pop: 0, fallas: 0,
    maxFallas: modo === 'clasico' || diario ? 3 : 0, tiempo: modo === 'zen' ? 90 : modo === 'clasico' ? 0 : 60,
    frutas: [], textos: [], cruces: [], brasas: [], cola: [], prox: 1.1, proxPoder: 7,
    golpe: { n: 0, t: 0, x: 0, y: 0 }, comboMax: 0, cortadas: 0, poder: { hielo: 0, frenesi: 0, doble: 0 }, tFrenesi: 0,
    fin: null, tFin: 0, sacudida: 0, flash: 0, explota: null, ayuda: !DATOS.ayuda, ultTic: 99, record: modoRecord(modo),
  });
  G.tiempoTotal = G.tiempo;
}
function dificultad() { const P = G; return P.modo === 'clasico' ? clamp(P.t / 150, 0, 1) : clamp(0.25 + P.t / 70, 0, 1); }
function lanzar(tipo, x, tope, xFin, poder) {
  const r = FRUTAS[tipo].r, y0 = H + r + 4, v = lanzamiento(x, y0, tope, xFin);
  G.frutas.push(nuevaFruta(tipo, x, y0, v.vx, v.vy, poder));
  if (tipo === 'bomba') Sonido.sfx('mecha');
}
function lanzarCostado() {
  const izq = Math.random() < 0.5, tipo = TIPOS_FRUTA[Math.floor(Math.random() * TIPOS_FRUTA.length)];
  G.frutas.push(nuevaFruta(tipo, izq ? -25 : W + 25, H * azar(0.35, 0.72), (izq ? 1 : -1) * azar(240, 360), -azar(280, 440)));
}
/* una ola: cuántas, en qué dibujo (salva, cadena o abanico), cuántas bombas y si va un poder */
function ola(d) {
  const P = G, r = P.rnd, n = clamp(1 + Math.floor(r() * (1.6 + d * 4)), 1, 6);
  const pr = r(), patron = pr < 0.45 ? 'salva' : pr < 0.75 ? 'cadena' : 'abanico', deIzq = r() < 0.5;
  let pBomba = { clasico: 0.07 + 0.13 * d, zen: 0, tormenta: 0.13, diario: 0.1 + 0.08 * d }[P.modo];
  if (P.t < 6) pBomba = 0;
  let bombas = 0, conPoder = false;
  for (let i = 0; i < n; i++) {
    let tipo = TIPOS_FRUTA[Math.floor(r() * TIPOS_FRUTA.length)], poder = null;
    const puede = bombas < (d > 0.6 ? 2 : 1) && (n > 1 || r() < 0.5);
    if (puede && r() < pBomba) { tipo = 'bomba'; bombas++; }
    else if (P.modo === 'tormenta' && !conPoder && P.t > P.proxPoder) { conPoder = true; P.proxPoder = P.t + 9 + r() * 5; poder = ['hielo', 'frenesi', 'doble'][Math.floor(r() * 3)]; }
    let x, demora = 0;
    if (patron === 'salva') x = 50 + r() * (W - 100);
    else if (patron === 'cadena') { const s = n > 1 ? i / (n - 1) : 0.5; x = lerp(60, W - 60, deIzq ? s : 1 - s); demora = i * 0.17; }
    else { x = W / 2 + (r() - 0.5) * 60; demora = i * 0.05; }
    const tope = Math.max(100, H * (0.1 + r() * 0.3));
    const xFin = clamp(patron === 'abanico' ? lerp(30, W - 30, n > 1 ? i / (n - 1) : 0.5) : x + (r() - 0.5) * 200, 30, W - 30);
    P.cola.push({ t: demora, fn: () => lanzar(tipo, x, tope, xFin, poder) });
  }
  Sonido.sfx('lanzar');
}
function director(dt) {
  const P = G, d = dificultad();
  if (P.poder.frenesi > 0) { P.tFrenesi -= dt; if (P.tFrenesi <= 0) { P.tFrenesi = 0.14; lanzarCostado(); } }
  P.prox -= dt;
  const enAire = P.frutas.length + P.cola.length;
  if (P.prox > 0 || enAire > (P.modo === 'clasico' ? 3 + d * 4 : 8)) return;
  ola(d);
  P.prox = lerp(2.1, 1.0, d) * (P.modo === 'clasico' ? 1 : 0.85) + P.rnd() * 0.5;
}
function cortarEnPartida(f, a) {
  const P = G;
  f.vivo = false;
  if (f.bomba) { estallar(f); return; }
  partirFruta(P, f, a);
  P.puntos += FRUTAS[f.tipo].pts * (P.poder.doble > 0 ? 2 : 1); P.pop = 1; P.cortadas++;
  const gp = P.golpe; gp.n++; gp.t = ahora; gp.x = f.x; gp.y = f.y;
  Sonido.sfx('corte', gp.n - 1); vibrar(12);
  if (f.poder) activarPoder(f.poder, f.x, f.y);
}
/* el combo se cuenta por pasada: termina al soltar o si pasa un cuarto de segundo sin cortar */
function cerrarGolpe() {
  const P = G, gp = P.golpe;
  if (gp.n >= 3) {
    const bono = gp.n * (P.poder.doble > 0 ? 2 : 1);
    P.puntos += bono; P.pop = 1; P.comboMax = Math.max(P.comboMax, gp.n);
    P.textos.push({ txt: tr('combo', gp.n), sub: '+' + bono, x: clamp(gp.x, 90, W - 90), y: clamp(gp.y - 30, 120, H - 130), t: 0, vida: 1.3, col: BERMELLON, tam: 28, sello: true });
    Sonido.sfx('combo', gp.n); vibrar([20, 30, 20]);
  }
  gp.n = 0;
}
function activarPoder(p, x, y) {
  const P = G;
  P.poder[p] = DUR_PODER[p]; if (p === 'frenesi') P.tFrenesi = 0;
  Sonido.sfx(p === 'hielo' ? 'hielo' : 'poder'); vibrar(40);
  P.textos.push({ txt: tr(p), x: clamp(x, 80, W - 80), y: clamp(y - 30, 120, H - 110), t: 0, vida: 1.2, col: PODERES[p], tam: 30 });
}
function estallar(f) {
  const P = G;
  P.manchas.push({ x: f.x, y: f.y, col: TINTA, ang: Math.random() * 6, tam: 34, t: 0, vida: 6, sem: (Math.random() * 1e6) | 0 });
  P.golpe.n = 0;
  if (P.modo === 'clasico') { P.explota = { x: f.x, y: f.y, t: 0 }; P.fin = 'bomba'; Sonido.sfx('boom'); vibrar([80, 40, 260]); P.sacudida = 12; return; }
  Sonido.sfx('menos'); vibrar(150); P.sacudida = 7; P.flash = 1;
  if (P.modo === 'tormenta') { P.puntos = Math.max(0, P.puntos - 10); P.textos.push({ txt: tr('menos10'), x: clamp(f.x, 60, W - 60), y: clamp(f.y - 20, 110, H - 100), t: 0, vida: 1, col: TINTA, tam: 34 }); }
  else fallar(f.x, true);
}
function fallar(x, porBomba) {
  const P = G;
  P.fallas++; P.cruces.push({ x: clamp(x, 26, W - 26), t: 0 });
  if (!porBomba) { Sonido.sfx('falla'); vibrar(50); P.sacudida = Math.max(P.sacudida, 3); }
  if (P.fallas >= P.maxFallas) acabar('fallas');
}
function acabar(motivo) {
  const P = G; if (P.fin) return;
  P.fin = motivo; P.tFin = 0;
  if (motivo === 'tiempo') P.textos.push({ txt: tr('tiempo'), x: W / 2, y: H * 0.42, t: 0, vida: 1.6, col: BERMELLON, tam: 40 });
}
function terminar() {
  const P = G; if (P.terminado) return; P.terminado = true;
  const antes = DATOS.cortadas;
  DATOS.cortadas += P.cortadas; DATOS.comboMax = Math.max(DATOS.comboMax, P.comboMax); DATOS.partidas++;
  P.nuevoFilo = -1; FILOS.forEach((f, i) => { if (antes < f.pide && DATOS.cortadas >= f.pide) P.nuevoFilo = i; });
  if (P.modo === 'diario') {
    if (DATOS.diaFecha !== hoy()) { DATOS.diaFecha = hoy(); DATOS.diaRecord = 0; }
    P.esRecord = P.puntos > DATOS.diaRecord; if (P.esRecord) DATOS.diaRecord = P.puntos;
  } else { P.esRecord = P.puntos > DATOS.rec[P.modo]; if (P.esRecord) DATOS.rec[P.modo] = P.puntos; }
  guardarDatos();
  irA('fin');
}
function irPausa() { escena = 'pausa'; tEsc = 0; }
function posPausa() { const tam = TAM_PAUSA[CTRL.tamPausa]; return { x: CTRL.zurdo ? 12 : W - 12 - tam, y: 12, tam }; }
function brasa(f) {
  const lx = f.r * 0.56, ly = -f.r * 1.3, c = Math.cos(f.ang), s = Math.sin(f.ang);
  if (G.brasas.length < 80) G.brasas.push({ x: f.x + c * lx - s * ly, y: f.y + s * lx + c * ly, vx: azar(-35, 35), vy: azar(-70, -10), t: 0, vida: azar(0.2, 0.45) });
}

function actualizarPartida(dt) {
  const P = G;
  if (P.ayuda) { filoPaso(null); if (E.clic || apretada('Enter', 'Space')) { P.ayuda = false; DATOS.ayuda = true; guardarDatos(); } return; }
  const pp = posPausa();
  if (!P.fin && (apretada('Escape', 'KeyP') || clicEn(pp.x - 6, pp.y - 6, pp.tam + 12, pp.tam + 12))) { irPausa(); return; }
  const k = (P.poder.hielo > 0 ? 0.45 : 1) * (1 + dificultad() * 0.3);
  P.t += dt;
  for (const p in P.poder) P.poder[p] = Math.max(0, P.poder[p] - dt);
  if (P.tiempoTotal && !P.fin) {
    P.tiempo -= dt;
    if (P.tiempo <= 5.5 && P.tiempo > 0 && Math.ceil(P.tiempo) !== P.ultTic) { P.ultTic = Math.ceil(P.tiempo); Sonido.sfx('tic'); }
    if (P.tiempo <= 0) { P.tiempo = 0; acabar('tiempo'); }
  }
  if (!P.fin) director(dt);
  for (let i = P.cola.length - 1; i >= 0; i--) { const c = P.cola[i]; c.t -= dt; if (c.t <= 0) { P.cola.splice(i, 1); if (!P.fin) c.fn(); } }
  for (let i = P.frutas.length - 1; i >= 0; i--) {
    const f = P.frutas[i];
    f.t += dt; f.vy += GRAV * dt * k; f.x += f.vx * dt * k; f.y += f.vy * dt * k; f.ang += f.giro * dt * k;
    if (f.vy < 0) f.subio = true;
    if (f.bomba && Math.random() < dt * 30) brasa(f);
    if ((f.y - f.r * 1.6 > H && f.vy > 0) || f.x < -90 || f.x > W + 90) {
      P.frutas.splice(i, 1);
      if (!f.bomba && P.modo === 'clasico' && !P.fin && f.subio) fallar(f.x);
    }
  }
  filoPaso(P.fin ? null : P.frutas, cortarEnPartida);
  P.frutas = P.frutas.filter((f) => f.vivo);
  if (P.golpe.n && (FILO.id == null || ahora - P.golpe.t > 0.25)) cerrarGolpe();
  pasoMundo(P, dt, k);
  for (let i = P.brasas.length - 1; i >= 0; i--) { const b = P.brasas[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > b.vida) P.brasas.splice(i, 1); }
  for (let i = P.textos.length - 1; i >= 0; i--) { P.textos[i].t += dt; if (P.textos[i].t > P.textos[i].vida) P.textos.splice(i, 1); }
  for (let i = P.cruces.length - 1; i >= 0; i--) { P.cruces[i].t += dt; if (P.cruces[i].t > 1.4) P.cruces.splice(i, 1); }
  P.sacudida *= Math.pow(0.86, dt * 60); P.flash = Math.max(0, P.flash - dt * 2.5); P.pop = Math.max(0, P.pop - dt * 4);
  if (P.explota) { P.explota.t += dt; if (P.explota.t > 1.8) terminar(); }
  else if (P.fin) { P.tFin += dt; if (P.tFin > 1.5) terminar(); }
}

/* ------------------------------------------------------ dibujo de partida */
function cruz(x, y, s, llena, esc) {
  esc = esc || 1;
  const w = llena ? s * 0.42 : s * 0.22;
  trazo(g, [[x - s * esc, y - s * esc], [x + s * esc, y + s * esc]], w, llena ? BERMELLON : TINTA, llena ? 0.95 : 0.22);
  trazo(g, [[x + s * esc, y - s * esc * 0.9], [x - s * esc * 0.9, y + s * esc]], w * 0.9, llena ? BERMELLON : TINTA, llena ? 0.95 : 0.22);
}
function relojEnso(x, y, t, total) {
  const k = clamp(t / total, 0, 1), urge = t < 10;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(22,17,13,0.15)'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = urge ? BERMELLON : TINTA; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
  const pul = urge ? 1 + Math.max(0, Math.sin(ahora * 10)) * 0.1 : 1;
  texto(g, String(Math.ceil(t)), x, y + 1, { tam: 16 * pul, col: urge ? BERMELLON : TINTA });
}
function dibujarHUD(P) {
  const z = CTRL.zurdo, al = z ? 'right' : 'left';
  dibujarMitad(g, { tipo: 'sandia', x: z ? W - 30 : 30, y: 28, ang: 0, off: 0, lado: 1, esc: 0.5 });
  texto(g, String(P.puntos), z ? W - 52 : 52, 33, { tam: 32 * (1 + P.pop * 0.2), alin: al });
  texto(g, tr('record') + ' ' + Math.max(P.record, P.puntos), z ? W - 16 : 16, 60, { tam: 11, alin: al, col: GRIS, tinta: false });
  if (P.poder.doble > 0) texto(g, '×2', z ? W - 16 : 16, 78, { tam: 16, alin: al, col: PODERES.doble });
  let yc = 32;
  if (P.tiempoTotal) { relojEnso(W / 2, yc, P.tiempo, P.tiempoTotal); yc += 42; }
  if (P.maxFallas) for (let i = 0; i < P.maxFallas; i++) cruz(W / 2 + (i - 1) * 30, yc, P.tiempoTotal ? 7 : 10, i < P.fallas);
  let yp = P.tiempoTotal ? yc + 26 : 66;
  for (const p of ['hielo', 'frenesi', 'doble']) {
    if (P.poder[p] <= 0) continue;
    iconoPoder(g, p, W / 2 - 40, yp, 8);
    g.fillStyle = 'rgba(22,17,13,0.12)'; g.fillRect(W / 2 - 28, yp - 3, 70, 6);
    g.fillStyle = PODERES[p]; g.fillRect(W / 2 - 28, yp - 3, 70 * P.poder[p] / DUR_PODER[p], 6);
    yp += 20;
  }
  // el botón de pausa: una gota de tinta con dos rayas de papel
  const pp = posPausa(), cx = pp.x + pp.tam / 2, cy = pp.y + pp.tam / 2, r = pp.tam / 2;
  g.fillStyle = 'rgba(22,17,13,0.86)'; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = r * (1 + 0.06 * Math.sin(i * 2.3)); i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.fillStyle = '#f2e8d2'; g.fillRect(cx - r * 0.34, cy - r * 0.4, r * 0.22, r * 0.8); g.fillRect(cx + r * 0.12, cy - r * 0.4, r * 0.22, r * 0.8);
}
function dibujarTextos(P) {
  for (const x of P.textos) {
    const k = x.t / x.vida, s = x.t < 0.16 ? rebote(x.t / 0.16) : 1, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const w = medir(g, x.txt, x.tam) + 34, cx = clamp(x.x, w / 2 + 6, W - w / 2 - 6);
    g.save(); g.globalAlpha = a; g.translate(cx, x.y - x.t * 18); g.scale(s, s);
    if (x.sello) { g.drawImage(pincelada(Math.round(w), 40, BERMELLON, 7), -w / 2 - 8, -26, w + 16, 52); texto(g, x.txt, 0, -1, { tam: x.tam, col: '#f5ecd8', tinta: false }); }
    else texto(g, x.txt, 0, 0, { tam: x.tam, col: x.col, borde: 'rgba(239,229,207,0.8)', bordeAncho: 5 });
    if (x.sub) texto(g, x.sub, 0, 34, { tam: 20, col: x.col === BERMELLON ? TINTA : x.col });
    g.restore();
  }
}
function auraBomba(f, t) {
  const pul = 0.5 + 0.5 * Math.sin(t * 9 + f.x);
  const a = g.createRadialGradient(f.x, f.y, f.r * 0.6, f.x, f.y, f.r * 1.8); a.addColorStop(0, 'rgba(200,50,30,' + (0.12 + pul * 0.14) + ')'); a.addColorStop(1, 'rgba(200,50,30,0)');
  g.fillStyle = a; g.fillRect(f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
}
function mecha(f) {
  const lx = f.r * 0.56, ly = -f.r * 1.3, c = Math.cos(f.ang), s = Math.sin(f.ang), bx = f.x + c * lx - s * ly, by = f.y + s * lx + c * ly;
  const fl = 0.7 + Math.random() * 0.5, gr = g.createRadialGradient(bx, by, 0, bx, by, 12 * fl);
  gr.addColorStop(0, 'rgba(255,236,160,0.95)'); gr.addColorStop(0.35, 'rgba(255,140,40,0.6)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = gr; g.fillRect(bx - 14, by - 14, 28, 28);
}
function dibujarExplosion(P) {
  const e = P.explota, k = salida(clamp(e.t / 0.55, 0, 1)), R = k * Math.hypot(W, H) * 1.15;
  if (e.t < 0.08) { g.fillStyle = 'rgba(255,248,230,0.92)'; g.fillRect(0, 0, W, H); }
  g.fillStyle = TINTA; g.beginPath();
  for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2, rr = R * (0.78 + 0.22 * Math.sin(i * 2.7) + 0.12 * Math.sin(i * 7.1)); const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill();
  if (e.t > 0.55) {
    const a = clamp((e.t - 0.55) / 0.3, 0, 1), s = 1 + (1 - salida(a)) * 0.6;
    g.save(); g.globalAlpha = a; g.translate(W / 2, H * 0.44); g.scale(s, s); texto(g, tr('bomba'), 0, 0, { tam: 52, col: BERMELLON, tinta: false }); g.restore();
  }
}
function dibujarAyuda(P, t) {
  g.fillStyle = 'rgba(239,229,207,0.92)'; g.fillRect(0, 0, W, H);
  const cy = H * 0.36, k = (t % 1.8) / 1.8, a = Math.atan2(-100, W * 0.64);
  if (k < 0.45) dibujarFruta(g, 'sandia', W / 2, cy, 0.3, 1.4);
  else for (const lado of [0, 1]) { const s = (k - 0.45) * (lado ? -1 : 1) * 70; dibujarMitad(g, { tipo: 'sandia', x: W / 2 + Math.sin(a) * s, y: cy - Math.cos(a) * s + (k - 0.45) * (k - 0.45) * 300, ang: a + (k - 0.45) * (lado ? -2 : 2), off: 0.3 - a, lado, esc: 1.4 }); }
  if (k < 0.6) {
    const s = clamp(k / 0.45, 0, 1), pts = [];
    for (let i = 0; i < 12; i++) { const u = clamp(s - (11 - i) * 0.025, 0, 1); pts.push({ x: lerp(W * 0.16, W * 0.84, u), y: lerp(cy + 50, cy - 50, u), t: 0 }); }
    dibujarRastro(g, { pts }, filoActual(), 18, 0, 1);
  }
  let y = H * 0.56;
  for (const l of partir(tr('ayuda'), 24)) { texto(g, l, W / 2, y, { tam: 16 }); y += 24; }
  if (P.modo === 'clasico') { y += 8; for (const l of partir(tr('ayudaFalla'), 30)) { texto(g, l, W / 2, y, { tam: 13, col: BERMELLON, tinta: false }); y += 19; } }
  g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); texto(g, tr('tocar'), W / 2, H * 0.86, { tam: 13, col: GRIS, tinta: false }); g.globalAlpha = 1;
}
function dibujarPartida(t, quieto) {
  const P = G, sx = P.sacudida > 0.3 ? (Math.random() * 2 - 1) * P.sacudida : 0, sy = P.sacudida > 0.3 ? (Math.random() * 2 - 1) * P.sacudida : 0;
  g.save(); g.translate(sx, sy);
  g.drawImage(fondo, 0, 0, W, H);
  dibujarManchas(P);
  if (P.poder.hielo > 0) {
    const a = Math.min(1, P.poder.hielo) * 0.9;
    g.fillStyle = 'rgba(150,196,228,' + 0.16 * a + ')'; g.fillRect(-10, -10, W + 20, H + 20);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(220,240,255,0)'); v.addColorStop(1, 'rgba(200,228,250,' + 0.55 * a + ')');
    g.fillStyle = v; g.fillRect(-10, -10, W + 20, H + 20);
  }
  if (P.poder.frenesi > 0) { g.fillStyle = 'rgba(200,50,30,' + (0.1 + 0.08 * Math.sin(t * 12)) + ')'; g.fillRect(-10, -10, 22, H + 20); g.fillRect(W - 12, -10, 22, H + 20); }
  for (const f of P.frutas) { if (f.bomba) auraBomba(f, t); dibujarFruta(g, f.tipo, f.x, f.y, f.ang, 1, f.poder, t); if (f.bomba) mecha(f); }
  dibujarMundo(P);
  for (const b of P.brasas) { g.fillStyle = b.t < b.vida * 0.4 ? '#ffe08a' : '#ff8a2a'; g.fillRect(b.x - 1, b.y - 1, 2, 2); }
  g.restore();
  if (!quieto) dibujarFilo();
  dibujarTextos(P);
  for (const c of P.cruces) { const s = c.t < 0.2 ? rebote(c.t / 0.2) : 1; g.globalAlpha = c.t > 1 ? 1 - (c.t - 1) / 0.4 : 1; cruz(c.x, H - 38, 15, true, s); g.globalAlpha = 1; }
  if (P.flash > 0) { g.fillStyle = 'rgba(22,17,13,' + P.flash * 0.35 + ')'; g.fillRect(0, 0, W, H); }
  dibujarHUD(P);
  if (P.explota) dibujarExplosion(P);
  if (P.ayuda) dibujarAyuda(P, t);
}

/* ------------------------------------------------------------ pausa y fin */
function escenaPausa(t) {
  filoPaso(null);
  dibujarPartida(t, true);
  g.fillStyle = 'rgba(239,229,207,0.84)'; g.fillRect(0, 0, W, H);
  dibujarEnso(W / 2, H * 0.2, 46, 21);
  texto(g, tr('pausa'), W / 2, H * 0.2, { tam: 34 });
  const bw = 220, x = (W - bw) / 2; let y = H * 0.34;
  if (boton(x, y, bw, 42, tr('seguir')) || (apretada('Escape') && tEsc > 0)) { escena = 'juego'; tEsc = 0; return; }
  y += 58; if (boton(x, y, bw, 42, tr('reiniciar'))) { const m = G.modo; irA('juego', () => empezar(m)); }
  y += 58; if (boton(x, y, bw, 42, tr('musica') + ': ' + (Sonido.musicaSi ? tr('si') : tr('no')))) Sonido.ponerMusica(!Sonido.musicaSi);
  y += 58; if (boton(x, y, bw, 42, tr('sonido') + ': ' + (Sonido.efectosSi ? tr('si') : tr('no')))) Sonido.ponerEfectos(!Sonido.efectosSi);
  y += 58; if (boton(x, y, bw, 42, tr('menu'), { col: BERMELLON })) irA('menu');
}
/* una muestra del filo: un trazo en S como el que deja el dedo */
function muestraFilo(i, x, y, w, libre) {
  const pts = [];
  for (let k = 0; k < 14; k++) { const s = k / 13; pts.push({ x: x + s * w, y: y + Math.sin(s * Math.PI * 1.2 - 0.3) * 9, t: 0 }); }
  g.globalAlpha = libre ? 1 : 0.28; dibujarRastro(g, { pts }, FILOS[i], 16, 0, 1); g.globalAlpha = 1;
}
function escenaFin(t) {
  const P = G;
  filoPaso(null);
  pasoMundo(P, dtCuadro);
  g.drawImage(fondo, 0, 0, W, H);
  dibujarManchas(P);
  if (!P.sonoFin && tEsc > 0.2) { P.sonoFin = true; Sonido.sfx(P.esRecord ? 'gong' : 'fin'); if (P.esRecord) vibrar([30, 40, 60]); }
  const tit = P.fin === 'bomba' ? tr('bomba') : P.fin === 'tiempo' ? tr('tiempo') : tr('fin');
  texto(g, tit, W / 2, H * 0.12, { tam: tamQueEntra(g, tit, 40, W - 40) });
  texto(g, tr(P.modo).toUpperCase(), W / 2, H * 0.12 + 34, { tam: 13, col: GRIS, tinta: false });
  const cy = H * 0.33, k = clamp(tEsc / 0.9, 0, 1);
  dibujarEnso(W / 2, cy, 72, 9);
  texto(g, String(Math.round(P.puntos * salida(k))), W / 2, cy - 4, { tam: 58 });
  texto(g, tr('puntos'), W / 2, cy + 34, { tam: 12, col: GRIS, tinta: false });
  let y = cy + 110;
  if (P.esRecord && P.puntos > 0) {
    const a = clamp((tEsc - 0.95) / 0.2, 0, 1);
    if (a > 0) {
      if (!P.sonoSello) { P.sonoSello = true; Sonido.sfx('sello'); vibrar(30); }
      const s = 1 + (1 - salida(a)) * 0.7, txt = tr('nuevoRecord'), w = medir(g, txt, 22) + 40;
      g.save(); g.globalAlpha = a; g.translate(W / 2, y - 8); g.rotate(-0.05); g.scale(s, s);
      g.drawImage(pincelada(Math.round(w), 38, BERMELLON, 3), -w / 2 - 8, -25, w + 16, 50); texto(g, txt, 0, -1, { tam: 22, col: '#f5ecd8', tinta: false });
      g.restore();
    }
  } else texto(g, tr('record') + ' ' + modoRecord(P.modo), W / 2, y - 8, { tam: 15, col: BERMELLON });
  y += 40;
  const est = tr('cortadas') + '  ' + P.cortadas + '   ·   ' + tr('mejorCombo') + '  ' + P.comboMax;
  texto(g, est, W / 2, y, { tam: tamQueEntra(g, est, 13, W - 30), col: TINTA, tinta: false });
  if (P.nuevoFilo >= 0 && tEsc > 1.3) {
    const nom = tr('nombresFilo')[P.nuevoFilo];
    texto(g, tr('nuevoFilo', nom), W / 2, y + 34, { tam: 14, col: FILOS[P.nuevoFilo].col });
    muestraFilo(P.nuevoFilo, W / 2 - 70, y + 62, 140, true);
  }
  const bw = 200, x = (W - bw) / 2;
  if (boton(x, H - 132, bw, 44, tr('otra')) || apretada('Enter', 'Space')) { const m = P.modo; irA('juego', () => empezar(m)); }
  if (boton(x, H - 74, bw, 40, tr('menu'), { col: BERMELLON, tam: 15 }) || apretada('Escape')) irA('menu');
}

/* ------------------------------------------------- práctica: dojo y controles */
let PR = null;
function prepararPractica() { PR = Object.assign(nuevoMundo(), { obj: null, espera: 0, n: (Math.random() * 10) | 0 }); nuevaPractica(); }
function nuevaPractica() { const tipo = TIPOS_FRUTA[PR.n++ % TIPOS_FRUTA.length]; PR.obj = { tipo, x: -99, y: -99, r: FRUTAS[tipo].r, vivo: true, ang: 0, vx: 0, vy: 0 }; }
function practica(x, y, w, h, t) {
  g.fillStyle = 'rgba(255,250,238,0.45)'; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(22,17,13,0.35)'; g.lineWidth = 1.2; g.setLineDash([6, 5]); g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.setLineDash([]);
  texto(g, tr('proba'), x + 10, y + 13, { tam: 11, alin: 'left', col: GRIS, tinta: false });
  const o = PR.obj;
  if (o.vivo) { o.x = x + w / 2 + Math.sin(t * 1.3) * w * 0.28; o.y = y + h / 2 + 6 + Math.sin(t * 2.1) * h * 0.14; o.ang = t * 0.8; }
  pasoMundo(PR, dtCuadro);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  dibujarManchas(PR);
  if (o.vivo) dibujarFruta(g, o.tipo, o.x, o.y, o.ang, 1);
  dibujarMundo(PR);
  g.restore();
  filoPaso(o.vivo ? [o] : null, (ob, a) => { ob.vivo = false; partirFruta(PR, ob, a); Sonido.sfx('corte', PR.n % 6); vibrar(12); PR.espera = 0.7; });
  if (!o.vivo) { PR.espera -= dtCuadro; if (PR.espera <= 0) nuevaPractica(); }
}
function escenaDojo(t) {
  g.drawImage(fondo, 0, 0, W, H);
  texto(g, tr('dojo'), W / 2, 46, { tam: 40 });
  texto(g, tr('filos') + ' · ' + tr('cortadas') + ' ' + DATOS.cortadas, W / 2, 78, { tam: 12, col: GRIS, tinta: false });
  const y0 = 98, alto = 58, nombres = tr('nombresFilo');
  FILOS.forEach((f, i) => {
    const y = y0 + i * alto, libre = DATOS.cortadas >= f.pide, sel = (DATOS.filo | 0) === i;
    if (sel) { g.fillStyle = 'rgba(200,50,30,0.09)'; g.fillRect(14, y, W - 28, alto - 8); }
    muestraFilo(i, 26, y + (alto - 8) / 2, 112, libre);
    texto(g, nombres[i], 156, y + 17, { tam: tamQueEntra(g, nombres[i], 16, W - 176), alin: 'left', col: libre ? TINTA : '#8c8072' });
    const est = sel ? tr('enUso') : libre ? tr('usar') : tr('faltan', f.pide - DATOS.cortadas);
    texto(g, est, 156, y + 37, { tam: 11, alin: 'left', col: sel ? BERMELLON : GRIS, tinta: false });
    if (sel) hanko(g, W - 34, y + (alto - 8) / 2, 22, 'JX', 0.08);
    if (libre && !sel && clicEn(14, y, W - 28, alto - 8)) { DATOS.filo = i; guardarDatos(); Sonido.sfx('boton'); vibrar(10); }
  });
  const py = y0 + FILOS.length * alto + 6;
  practica(20, py, W - 40, H - py - 78, t);
  if (boton(W / 2 - 85, H - 62, 170, 40, tr('volver')) || apretada('Escape')) irA('menu');
  dibujarFilo();
}
function escenaControles(t) {
  g.drawImage(fondo, 0, 0, W, H);
  texto(g, tr('controles'), W / 2, 42, { tam: 32 });
  const filas = [
    ['grosor', 'grosor', ['fino', 'medio', 'grueso']], ['sensib', 'sensib', ['baja', 'media', 'alta']],
    ['alcance', 'alcance', ['baja', 'media', 'alta']], ['tamPausa', 'tamPausa', ['chico', 'medio', 'grande']],
    ['zurdo', 'zurdo', ['no', 'si']], ['vibrar', 'vibrar', ['no', 'si']], ['musica', null, ['no', 'si']], ['sonido', null, ['no', 'si']],
  ];
  let y = 72;
  for (const [etq, clave, ops] of filas) {
    const bw = 56, x0 = W - 14 - ops.length * (bw + 6) + 6;
    texto(g, tr(etq), 16, y + 13, { tam: tamQueEntra(g, tr(etq), 12.5, x0 - 26), alin: 'left', tinta: false });
    const val = etq === 'musica' ? +Sonido.musicaSi : etq === 'sonido' ? +Sonido.efectosSi : typeof CTRL[clave] === 'boolean' ? +CTRL[clave] : CTRL[clave];
    ops.forEach((op, k) => {
      if (!opcion(x0 + k * (bw + 6), y, bw, 26, tr(op), val === k)) return;
      if (etq === 'musica') Sonido.ponerMusica(!!k); else if (etq === 'sonido') Sonido.ponerEfectos(!!k);
      else { CTRL[clave] = typeof CTRL_BASE[clave] === 'boolean' ? !!k : k; guardarCtrl(); if (clave === 'vibrar' && k) vibrar(40); }
    });
    y += 37;
  }
  const py = y + 4, ph = H - py - 80;
  practica(16, py, W - 32, ph, t);
  // cómo queda el botón de pausa (tamaño y lado)
  const tam = TAM_PAUSA[CTRL.tamPausa], bx = CTRL.zurdo ? 24 : W - 24 - tam, by = py + 8;
  g.fillStyle = 'rgba(22,17,13,0.6)'; g.beginPath(); g.arc(bx + tam / 2, by + tam / 2, tam / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2e8d2'; g.fillRect(bx + tam * 0.33, by + tam * 0.3, tam * 0.11, tam * 0.4); g.fillRect(bx + tam * 0.56, by + tam * 0.3, tam * 0.11, tam * 0.4);
  if (boton(16, H - 62, (W - 44) / 2, 40, tr('restablecer'), { tam: 14, col: BERMELLON })) { Object.assign(CTRL, CTRL_BASE); guardarCtrl(); }
  if (boton(28 + (W - 44) / 2, H - 62, (W - 44) / 2, 40, tr('listo')) || apretada('Escape')) irA('menu');
  dibujarFilo();
}

const AL_ENTRAR = { menu: prepararMenu, dojo: prepararPractica, controles: prepararPractica };

/* ------------------------------------------------------------------ bucle */
let ultimo = 0;
function temaDe() {
  if (escena === 'juego' || escena === 'pausa') return G.modo === 'zen' ? TEMAS.zen : G.modo === 'tormenta' ? TEMAS.tormenta : TEMAS.juego;
  return TEMAS.menu;
}
function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, ultimo ? (ts - ultimo) / 1000 : 1 / 60); ultimo = ts; dtCuadro = dt;
  const t = ts / 1000; ahora = t;
  tEsc += dt;
  if (trans) { trans.t += dt; if (!trans.hecho && trans.t >= trans.dur) { trans.hecho = true; trans.alMedio(); } if (trans.t >= trans.dur * 2) trans = null; }
  g.setTransform(S, 0, 0, S, 0, 0);
  try {
    if (escena !== 'intro') Sonido.musica(temaDe());
    switch (escena) {
      case 'intro': escenaIntro(dt); break;
      case 'idioma': escenaIdioma(t); break;
      case 'menu': escenaMenu(t); break;
      case 'juego': if (!trans) actualizarPartida(dt); else filoPaso(null); if (escena === 'juego') dibujarPartida(t); else escenaPausa(t); break;
      case 'pausa': escenaPausa(t); break;
      case 'fin': escenaFin(t); break;
      case 'dojo': escenaDojo(t); break;
      case 'controles': escenaControles(t); break;
    }
  } catch (e) { console.error(e); }
  if (trans) dibujarTrans(trans);
  Sonido.pasar();
  E.clic = null; E.toque = null; E.recien.clear(); FILO.muestras.length = 0;
}
function arrancar() {
  ajustar();
  intro = crearIntroJXS({ W, H, presenta: TXT[IDIOMA].presenta, vibrar, estilo: ESTILO_SUMI });
  Sonido.iniciar();
  if (Sonido.ctx && Sonido.ctx.state === 'running') musicaIntro = jingleJXS(Sonido.ctx, Sonido.total, ESTILO_SUMI);
  prepararMenu(); prepararPractica();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (escena === 'juego' && G && !G.fin) irPausa(); Sonido.pausar(true); } else Sonido.pausar(false); });
  requestAnimationFrame(cuadro);
  window.__tajo = {
    get G() { return G; }, get escena() { return escena; }, empezar, irA, terminar, DATOS, CTRL,
    cortarTodo() { for (const f of G.frutas) if (f.vivo && !f.bomba) cortarEnPartida(f, Math.random() * 6); G.frutas = G.frutas.filter((f) => f.vivo); },
  };
}
arrancar();
