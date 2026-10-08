/* ============================================================================
   NEBULOSA: escenas (menú, idioma, catálogo, partida, pausa, fin,
   controles), el apuntado y la tirada, las fusiones con sus efectos, el
   peligro y el bucle. Todo en unidades de 360 de ancho; S lo pasa a píxeles.
   ========================================================================== */

const lienzoP = document.getElementById('lienzo');
const g = lienzoP.getContext('2d');
let escena = 'menu', tEsc = 0, trans = null, fondo = null, G = null, ahora = 0;

const CTRL_BASE = { apuntar: 'dedo', sensib: 1.2, soltar: 'levantar', guia: true, zurdo: false, vibrar: true, tamBot: 1 };
const CTRL = Object.assign({}, CTRL_BASE, Guardado.leer('controles', {}));
const guardarCtrl = () => Guardado.escribir('controles', CTRL);
function vibrar(ms) { if (CTRL.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } }

/* --------------------------------------------------------------- pantalla */
function ajustar() {
  const dpr = window.devicePixelRatio || 1, cw = innerWidth, ch = innerHeight;
  let cssW = cw / ch > 0.6 ? ch * 0.5625 : cw;
  H = clamp(Math.round(W * ch / cssW), 600, 800);
  let cssH = cssW * H / W;
  if (cssH > ch) { cssW *= ch / cssH; cssH = ch; }
  lienzoP.width = Math.round(cssW * dpr); lienzoP.height = Math.round(cssH * dpr);
  S = lienzoP.width / W;
  Object.assign(lienzoP.style, { width: cssW + 'px', height: cssH + 'px', left: Math.round((cw - cssW) / 2) + 'px', top: Math.round((ch - cssH) / 2) + 'px' });
  const alto = Math.min(450, H - 230);
  JT = Math.round((H - alto) / 2 + 6); JF = JT + alto; LINEA = JT + 46;
  fondo = pintarFondo();
}
addEventListener('resize', ajustar);

/* el fondo synthwave: cielo, estrellas, el sol a rayas y las montañas */
const HORIZ = () => Math.round(H * 0.7);
function pintarFondo() {
  const [c, f] = lienzoHD(W, H), r = rngSemilla(77), hz = HORIZ();
  const cielo = f.createLinearGradient(0, 0, 0, hz);
  cielo.addColorStop(0, '#05020e'); cielo.addColorStop(0.55, '#1a0636'); cielo.addColorStop(0.85, '#4a0a5a'); cielo.addColorStop(1, '#8a1a6a');
  f.fillStyle = cielo; f.fillRect(0, 0, W, hz);
  for (let i = 0; i < 140; i++) { f.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.7) + ')'; const s = r() < 0.1 ? 1.6 : 0.9; f.fillRect(r() * W, r() * hz * 0.85, s, s); }
  // nubes de nebulosa
  for (let i = 0; i < 6; i++) { const x = r() * W, y = r() * hz * 0.6, rr = 60 + r() * 80, gr = f.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, ['rgba(255,60,200,0.12)', 'rgba(60,200,255,0.1)', 'rgba(150,80,255,0.12)'][i % 3]); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  // el sol
  const sr = 92, sy = hz - 10, sol = f.createLinearGradient(0, sy - sr, 0, sy + sr);
  sol.addColorStop(0, '#ffe46a'); sol.addColorStop(0.5, '#ff7a5a'); sol.addColorStop(1, '#ff2a9a');
  f.save(); f.beginPath(); f.arc(W / 2, sy, sr, Math.PI, 0); f.closePath(); f.clip();
  f.fillStyle = sol; f.fillRect(W / 2 - sr, sy - sr, sr * 2, sr);
  f.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 7; k++) { const yy = sy - 6 - k * 9, hh = 1 + k * 0.7; f.fillRect(W / 2 - sr, yy, sr * 2, hh); }
  f.restore();
  f.globalCompositeOperation = 'lighter';
  const halo = f.createRadialGradient(W / 2, sy, sr * 0.6, W / 2, sy, sr * 1.8); halo.addColorStop(0, 'rgba(255,80,160,0.25)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  f.fillStyle = halo; f.fillRect(0, sy - sr * 2, W, sr * 2);
  f.globalCompositeOperation = 'source-over';
  // montañas
  f.fillStyle = '#12052a'; f.beginPath(); f.moveTo(0, hz);
  for (let x = 0; x <= W; x += 12) f.lineTo(x, hz - 8 - Math.abs(Math.sin(x * 0.025) * 34) - Math.abs(Math.sin(x * 0.07) * 10));
  f.lineTo(W, hz); f.fill();
  f.strokeStyle = 'rgba(255,90,220,0.5)'; f.lineWidth = 1; f.stroke();
  // el piso
  const piso = f.createLinearGradient(0, hz, 0, H); piso.addColorStop(0, '#1a0430'); piso.addColorStop(1, '#05010c');
  f.fillStyle = piso; f.fillRect(0, hz, W, H - hz);
  return c;
}
function dibujarFondo(t) {
  g.drawImage(fondo, 0, 0, W, H);
  // la grilla que avanza
  const hz = HORIZ(), vx = W / 2;
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(255,60,200,0.45)'; g.lineWidth = 1;
  g.beginPath();
  for (let i = -10; i <= 10; i++) { g.moveTo(vx + i * 8, hz); g.lineTo(vx + i * 70, H); }
  const off = (t * 0.6) % 1;
  for (let k = 0; k < 10; k++) { const p = Math.pow((k + off) / 10, 2.2), y = hz + p * (H - hz); g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- entrada */
const E = { punteros: new Map(), clic: null, toque: null, suelta: null, teclas: new Set(), recien: new Set() };
function aLogico(ev) { const r = lienzoP.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; }
lienzoP.addEventListener('pointerdown', (ev) => { ev.preventDefault(); Sonido.iniciar(); try { lienzoP.setPointerCapture(ev.pointerId); } catch (x) { /* */ } const p = aLogico(ev); E.punteros.set(ev.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, px: p.x }); E.toque = { x: p.x, y: p.y, id: ev.pointerId }; });
lienzoP.addEventListener('pointermove', (ev) => { const pt = E.punteros.get(ev.pointerId); if (pt) { const p = aLogico(ev); pt.x = p.x; pt.y = p.y; } });
const finPuntero = (ev) => { const pt = E.punteros.get(ev.pointerId); if (!pt) return; E.punteros.delete(ev.pointerId); E.suelta = { x: pt.x, y: pt.y, id: ev.pointerId, rol: pt.rol }; if (!pt.rol) E.clic = { x: pt.x, y: pt.y, x0: pt.x0, y0: pt.y0 }; };
lienzoP.addEventListener('pointerup', finPuntero); lienzoP.addEventListener('pointercancel', finPuntero);
lienzoP.addEventListener('contextmenu', (ev) => ev.preventDefault());
addEventListener('keydown', (ev) => { if (['Space', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault(); if (!E.teclas.has(ev.code)) E.recien.add(ev.code); E.teclas.add(ev.code); Sonido.iniciar(); });
addEventListener('keyup', (ev) => E.teclas.delete(ev.code));
const apretada = (...c) => c.some((k) => E.recien.has(k));
const clicEn = (x, y, w, h) => { const c = E.clic; return !!c && c.x >= x && c.x < x + w && c.y >= y && c.y < y + h && c.x0 >= x - 6 && c.x0 < x + w + 6 && c.y0 >= y - 6 && c.y0 < y + h + 6; };
function apretando(x, y, w, h) { for (const p of E.punteros.values()) if (!p.rol && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return true; return false; }

/* ---------------------------------------------------------------- botones */
function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function boton(x, y, w, h, txt, o) {
  o = o || {};
  const col = o.col || '#ff3ec8', apr = !o.apagado && apretando(x, y, w, h);
  rrect(x, y, w, h, h / 2);
  g.fillStyle = apr ? 'rgba(255,255,255,0.18)' : 'rgba(10,4,24,0.7)'; g.fill();
  g.shadowColor = col; g.shadowBlur = apr ? 18 : 10; g.strokeStyle = o.apagado ? '#5a4a70' : col; g.lineWidth = 2; g.stroke(); g.shadowBlur = 0;
  const gl = o.globo ? 18 : 0;
  if (o.globo) { g.shadowColor = col; g.shadowBlur = 8; dibujarGlobo(g, x + 15, y + h / 2, 6.5, '#ffffff', 1.4); g.shadowBlur = 0; }
  texto(g, txt, x + w / 2 + gl / 2, y + h / 2 + 1, { tam: tamQueEntra(g, txt, o.tam || 15, w - 22 - gl), col: o.apagado ? '#8a7aa0' : '#ffffff', glow: o.apagado ? null : col, blur: 8 });
  const si = !o.apagado && clicEn(x, y, w, h);
  if (si) Sonido.sfx('boton');
  return si;
}
function irA(nueva, alMedio) {
  if (trans) return;
  trans = { t: 0, dur: 0.28, alMedio: () => { if (alMedio) alMedio(); if (nueva) { escena = nueva; tEsc = 0; } }, hecho: false };
}
/* la transición: una barrida de línea de neón que tapa y destapa */
function dibujarTrans(p) {
  if (p <= 0) return;
  const y = p * (H + 20);
  g.fillStyle = '#07040f'; g.fillRect(0, 0, W, y);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,62,200,0.9)'; g.fillRect(0, y - 2, W, 2);
  estampaBrillo(g, '#ff3ec8', W / 2, y, 60, 0.5);
  g.globalCompositeOperation = 'source-over';
}
function tituloNeon(y, t) {
  const parpadeo = (t % 5) > 4.8 && Math.random() < 0.5 ? 0.4 : 1;
  texto(g, 'NEBULOSA', W / 2 + 2, y + 2, { tam: 50, col: 'rgba(62,240,255,0.6)' });
  g.globalAlpha = parpadeo;
  texto(g, 'NEBULOSA', W / 2, y, { tam: 50, col: '#ffe0f8', glow: '#ff3ec8', blur: 22, borde: '#ff3ec8', bordeAncho: 2 });
  g.globalAlpha = 1;
  texto(g, tr('subtitulo'), W / 2, y + 38, { tam: 14, col: '#c8faff', glow: '#3ef0ff', blur: 10 });
}

/* ---------------------------------------------------------------- idioma */
/* la lista de los 13 idiomas, cada uno escrito en su idioma; el elegido, en amarillo */
function escenaIdioma(t) {
  Sonido.musica(TEMAS.menu);
  dibujarFondo(t);
  g.shadowColor = '#3ef0ff'; g.shadowBlur = 12; dibujarGlobo(g, W / 2, 30, 11, '#c8faff', 2); g.shadowBlur = 0;
  texto(g, tr('idioma'), W / 2, 62, { tam: tamQueEntra(g, tr('idioma'), 22, W - 40), col: '#ffe0f8', glow: '#ff3ec8', blur: 16 });
  const cols = ['#ff3ec8', '#3ef0ff', '#b46aff'], top = 88, bajo = H - 70, paso = Math.min(46, (bajo - top) / IDIOMAS.length), h = Math.min(32, paso - 6);
  IDIOMAS.forEach((l, i) => {
    if (boton(56, top + i * paso, W - 112, h, l.nombre, { col: l.id === IDIOMA ? '#ffd84a' : cols[i % 3], tam: 14 })) { IDIOMA = l.id; Guardado.escribir('idioma', l.id); irA('menu'); }
  });
  if (boton(W / 2 - 80, H - 56, 160, 38, tr('volver'), { col: '#8a7aff', tam: 14 }) || apretada('Escape')) irA('menu');
}

/* ------------------------------------------------------------------- menú */
let orbitan = null;
function escenaMenu(t) {
  Sonido.musica(TEMAS.menu);
  dibujarFondo(t);
  if (!orbitan) orbitan = [10, 5, 8, 2, 4, 0].map((k, i) => ({ tipo: k, a: i, rad: 120 + (i % 2) * 30, vel: 0.15 + i * 0.03 }));
  for (const o of orbitan) {
    const k = DATOS.visto >= o.tipo ? o.tipo : Math.min(o.tipo, DATOS.visto);
    const a = o.a + t * o.vel, x = W / 2 + Math.cos(a) * o.rad, y = H * 0.17 + Math.sin(a) * o.rad * 0.35;
    const b = { tipo: k, x, y, r: CUERPOS[k].r * 0.42, ang: t * 0.5 + o.a, vx: 0, vy: 0 };
    if (Math.sin(a) < 0) { g.globalAlpha = 0.5; dibujarCuerpo(g, b, t, false); g.globalAlpha = 1; }
  }
  tituloNeon(H * 0.16, t);
  for (const o of orbitan) {
    const k = DATOS.visto >= o.tipo ? o.tipo : Math.min(o.tipo, DATOS.visto);
    const a = o.a + t * o.vel, x = W / 2 + Math.cos(a) * o.rad, y = H * 0.17 + Math.sin(a) * o.rad * 0.35;
    if (Math.sin(a) >= 0) dibujarCuerpo(g, { tipo: k, x, y, r: CUERPOS[k].r * 0.42, ang: t * 0.5 + o.a, vx: 0, vy: 0 }, t);
  }
  const y0 = Math.round(H * 0.34), x = 60, w = W - 120;
  const guardada = Guardado.leer('partida', null);
  if (boton(x, y0, w, 44, guardada ? tr('seguirPartida') : tr('clasico'), { col: '#ff3ec8', tam: 18 })) empezar('clasico');
  texto(g, tr('record') + ' ' + DATOS.record, W / 2, y0 + 56, { tam: 11, col: '#ffb8f0', cursiva: false, peso: '700' });
  if (boton(x, y0 + 72, w, 38, tr('relampago'), { col: '#ffd84a' })) empezar('relampago');
  texto(g, tr('relampagoD') + ' · ' + tr('record') + ' ' + DATOS.recordRayo, W / 2, y0 + 121, { tam: 11, col: '#fff0b0', cursiva: false, peso: '700' });
  if (boton(x, y0 + 136, w, 38, tr('diario'), { col: '#3ef0ff' })) empezar('diario');
  texto(g, tr('hoyRec', DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0), W / 2, y0 + 185, { tam: 11, col: '#c8faff', cursiva: false, peso: '700' });
  if (boton(x, y0 + 200, w, 34, tr('catalogo') + '  ' + tr('descubiertos', DATOS.visto + 1), { col: '#b46aff', tam: 14 })) irA('catalogo');
  if (boton(x, y0 + 244, w / 2 - 4, 32, tr('controles'), { col: '#8a7aff', tam: 12 })) irA('controles');
  if (boton(x + w / 2 + 4, y0 + 244, w / 2 - 4, 32, tr('idiomaBtn'), { col: '#8a7aff', tam: 12, globo: true })) irA('idioma');
  texto(g, 'JXSTUDIOS', W / 2, H - 16, { tam: 10, col: '#8a7aa0', cursiva: false, peso: '700' });
  if (apretada('Enter', 'Space')) empezar('clasico');
}
function escenaCatalogo(t) {
  dibujarFondo(t);
  texto(g, tr('catalogo'), W / 2, 40, { tam: 30, col: '#ffe0f8', glow: '#b46aff', blur: 16 });
  texto(g, tr('descubiertos', DATOS.visto + 1) + (DATOS.supernovas ? '  ·  ' + tr('supernova').replace(/[!¡！]/g, '') + ' ×' + DATOS.supernovas : ''), W / 2, 66, { tam: 11, col: '#c8faff', cursiva: false, peso: '700' });
  const fila = Math.min(78, (H - 140) / 6);
  for (let k = 0; k <= MAX; k++) {
    const col = k % 2, fi = Math.floor(k / 2), x = col ? W * 0.73 : W * 0.27, y = 100 + fi * fila + (col ? fila / 2 : 0);
    const visto = k <= DATOS.visto, esc = Math.min(1, 26 / CUERPOS[k].r);
    if (visto) dibujarCuerpo(g, { tipo: k, x, y, r: CUERPOS[k].r * esc, ang: t * 0.4, vx: 0, vy: 0 }, t);
    else { g.fillStyle = 'rgba(40,20,70,0.8)'; g.beginPath(); g.arc(x, y, CUERPOS[k].r * esc, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#5a4a80'; g.lineWidth = 1.5; g.stroke(); texto(g, '?', x, y + 1, { tam: 18, col: '#8a7aa0' }); }
    texto(g, visto ? tr('nombres')[k] : '???', x, y + 34, { tam: 10, col: visto ? '#ffffff' : '#8a7aa0', glow: visto ? CUERPOS[k].glow : null, blur: 6, cursiva: false, peso: '800' });
  }
  if (boton(W / 2 - 70, H - 52, 140, 36, tr('volver'), { col: '#b46aff' }) || apretada('Escape')) irA('menu');
}

/* ---------------------------------------------------------------- partida */
const PESOS = [32, 28, 20, 12, 8];
function sortear(rnd) { let x = rnd() * 100; for (let i = 0; i < PESOS.length; i++) { x -= PESOS[i]; if (x <= 0) return i; } return 0; }
function empezar(modo) {
  irA('juego', () => {
    const rnd = modo === 'diario' ? rngSemilla(hoy() * 3 + 1) : Math.random;
    G = { modo, rnd, cuerpos: [], actual: sortear(rnd), siguiente: sortear(rnd), aimX: W / 2, carga: 0, puntos: 0, vis: 0, cadena: 0, ultFusion: -9,
      maxTipo: 0, peligroT: 0, alarmaT: 0, fin: false, finT: 0, tiempo: modo === 'relampago' ? 120 : 0, poderes: { sacudon: 1, rayo: 1 }, proxPoder: 800,
      rayoActivo: false, part: [], textos: [], ondas: [], sacudir: 0, lenta: 0, destello: 0, banner: null, t: 0, tiradas: 0, apunta: null, rotura: [] };
    const guardada = modo === 'clasico' ? Guardado.leer('partida', null) : null;
    if (guardada) {
      G.cuerpos = guardada.cuerpos.map(([tipo, x, y]) => { const b = nuevoCuerpo(tipo, x, y); b.edad = 2; return b; });
      Object.assign(G, { actual: guardada.actual, siguiente: guardada.siguiente, puntos: guardada.puntos, vis: guardada.puntos, poderes: guardada.poderes, proxPoder: guardada.proxPoder, maxTipo: guardada.maxTipo || 0 });
    }
    DATOS.partidas++; guardarDatos();
  });
}
function guardarPartida() {
  if (!G || G.modo !== 'clasico') return;
  if (G.fin) { Guardado.borrar('partida'); return; }
  Guardado.escribir('partida', { cuerpos: G.cuerpos.filter((b) => !b.muerto).map((b) => [b.tipo, Math.round(b.x), Math.round(b.y)]), actual: G.actual, siguiente: G.siguiente, puntos: G.puntos, poderes: G.poderes, proxPoder: G.proxPoder, maxTipo: G.maxTipo });
}
const radioBoton = () => 25 * CTRL.tamBot;
function posPoder(i) { const izq = CTRL.zurdo ? i === 0 : i === 1; return { x: izq ? 40 : W - 40, y: H - 46 }; }
function posTirar() { return { x: W / 2, y: H - 50 }; }
const yLanzador = () => JT - 36;

function actualizarPartida(dt) {
  const P = G;
  P.t += dt;
  // tocar los poderes, la pausa o el botón de tirar
  if (E.toque && !P.fin) {
    const p = E.toque, pt = E.punteros.get(p.id);
    const enPoder = [0, 1].find((i) => { const q = posPoder(i); return Math.hypot(p.x - q.x, p.y - q.y) < radioBoton() + 6; });
    if (Math.hypot(p.x - 30, p.y - 36) < 24) { if (pt) pt.rol = 'boton'; Sonido.sfx('boton'); escena = 'pausa'; tEsc = 0; return; }
    if (enPoder !== undefined) { if (pt) pt.rol = 'boton'; usarPoder(enPoder === 0 ? 'sacudon' : 'rayo'); }
    else if (P.rayoActivo) {
      if (pt) pt.rol = 'boton';
      const b = P.cuerpos.find((c) => !c.muerto && Math.hypot(c.x - p.x, c.y - p.y) < c.r + 6);
      if (b) borrarConRayo(b); else P.rayoActivo = false;
    } else if (CTRL.soltar === 'boton' && Math.hypot(p.x - posTirar().x, p.y - posTirar().y) < radioBoton() + 8) { if (pt) pt.rol = 'boton'; tirar(); }
    else if (p.y > JT - 70 && p.y < H - 80) { if (pt) pt.rol = 'apunta'; P.apunta = { id: p.id, x0: p.x, aim0: P.aimX }; if (CTRL.apuntar === 'dedo') P.aimX = p.x; }
  }
  if (P.apunta) {
    const pt = E.punteros.get(P.apunta.id);
    if (pt) P.aimX = CTRL.apuntar === 'dedo' ? pt.x : P.apunta.aim0 + (pt.x - P.apunta.x0) * CTRL.sensib;
    else { if (CTRL.soltar === 'levantar') tirar(); P.apunta = null; }
  }
  if (E.teclas.has('ArrowLeft') || E.teclas.has('KeyA')) P.aimX -= 220 * dt;
  if (E.teclas.has('ArrowRight') || E.teclas.has('KeyD')) P.aimX += 220 * dt;
  if (apretada('Space', 'ArrowDown', 'KeyS')) tirar();
  if (apretada('KeyQ')) usarPoder('sacudon');
  if (apretada('KeyE')) usarPoder('rayo');
  if (apretada('Escape', 'KeyP')) { escena = 'pausa'; tEsc = 0; return; }
  const ra = CUERPOS[P.actual].r;
  P.aimX = clamp(P.aimX, JL + ra, JR - ra);
  P.carga = Math.max(0, P.carga - dt);
  // la física (en cámara lenta si hace falta)
  const esc = P.lenta > 0 ? 0.3 : 1;
  P.lenta -= dt;
  const fus = pasoFisica(P.cuerpos, Math.min(1 / 30, dt) * esc);
  for (const f of fus) fusionar(f);
  for (const b of P.cuerpos) if (b.golpe) { if (b.golpe > 260) Sonido.sfx('choque', b.tipo); b.golpe = 0; }
  P.cuerpos = P.cuerpos.filter((b) => !b.muerto);
  // el peligro
  if (!P.fin) {
    const arriba = P.cuerpos.some((b) => b.edad > 1.2 && b.y - b.r < LINEA);
    P.peligroT = arriba ? P.peligroT + dt : Math.max(0, P.peligroT - dt * 2);
    Sonido.tension = clamp(Math.max(P.peligroT / 3, (JF - Math.min(JF, ...P.cuerpos.map((b) => b.y - b.r), JF)) / (JF - JT) - 0.3), 0, 1);
    if (P.peligroT > 0.4) { P.alarmaT -= dt; if (P.alarmaT <= 0) { Sonido.sfx('alarma'); P.alarmaT = 0.45; vibrar(10); } }
    if (P.peligroT > 3) terminar(false);
    if (P.modo === 'relampago') { const antes = Math.ceil(P.tiempo); P.tiempo -= dt; if (P.tiempo <= 10 && Math.ceil(P.tiempo) !== antes) Sonido.sfx('tic'); if (P.tiempo <= 0) { P.tiempo = 0; terminar(true); } }
  } else {
    P.finT += dt;
    // al terminar, los cuerpos revientan de arriba para abajo
    if (P.rotura.length && P.finT > 0.5) { const n = Math.min(P.rotura.length, Math.ceil(dt / 0.05)); for (let i = 0; i < n; i++) { const b = P.rotura.shift(); b.muerto = true; chispazo(b.x, b.y, CUERPOS[b.tipo].glow, 14, 160); } }
    if (P.finT > 1.2 + 0.05 * (P.nRotura || 0) && escena === 'juego') { escena = 'fin'; tEsc = 0; }
  }
  // efectos
  for (let i = P.part.length - 1; i >= 0; i--) { const q = P.part[i]; q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.2, dt); q.vy = q.vy * Math.pow(0.2, dt) + 80 * dt; if (q.t <= 0) P.part.splice(i, 1); }
  for (let i = P.textos.length - 1; i >= 0; i--) { const q = P.textos[i]; q.t += dt; q.y -= 30 * dt; if (q.t > 1) P.textos.splice(i, 1); }
  for (let i = P.ondas.length - 1; i >= 0; i--) { const o = P.ondas[i]; o.t += dt; if (o.t > o.dur) P.ondas.splice(i, 1); }
  if (P.banner) { P.banner.t += dt; if (P.banner.t > 2) P.banner = null; }
  P.sacudir = Math.max(0, P.sacudir - dt * 20); P.destello = Math.max(0, P.destello - dt * 2);
  P.vis = P.vis < P.puntos ? Math.min(P.puntos, P.vis + Math.max(1, (P.puntos - P.vis) * dt * 7)) : P.puntos;
}
function tirar() {
  const P = G;
  if (P.carga > 0 || P.fin) return;
  const b = nuevoCuerpo(P.actual, P.aimX, yLanzador() + 10);
  b.vy = 60; P.cuerpos.push(b);
  P.actual = P.siguiente; P.siguiente = sortear(P.rnd); P.carga = 0.5; P.tiradas++;
  Sonido.sfx('tirar'); vibrar(6);
  if (!DATOS.ayuda) { DATOS.ayuda = true; guardarDatos(); }
  guardarPartida();
}
function fusionar(f) {
  const P = G;
  if (P.t - P.ultFusion < 0.9) P.cadena++; else P.cadena = 1;
  P.ultFusion = P.t;
  const mult = 1 + (P.cadena - 1) * 0.25;
  if (f.tipo === MAX) {
    // supernova
    const pts = Math.round(500 * mult); P.puntos += pts;
    P.textos.push({ txt: '+' + pts, x: f.x, y: f.y, t: 0, col: '#ffffff', tam: 30 });
    P.banner = { txt: tr('supernova'), t: 0, col: '#ffd84a' };
    for (const b of P.cuerpos) if (!b.muerto) { const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy) || 1, k = 90000 / (d + 60); b.vx += dx / d * k * 0.02; b.vy += dy / d * k * 0.02 - 300; }
    chispazo(f.x, f.y, '#ffd84a', 80, 420); chispazo(f.x, f.y, '#b46aff', 60, 300);
    P.ondas.push({ x: f.x, y: f.y, t: 0, dur: 0.9, r: 260, col: '#ffd84a' });
    P.sacudir = 14; P.lenta = 1.2; P.destello = 1;
    DATOS.supernovas++; guardarDatos();
    Sonido.sfx('supernova'); vibrar([60, 40, 120]);
  } else {
    const k = f.tipo + 1, nb = nuevoCuerpo(k, f.x, f.y);
    nb.r = CUERPOS[f.tipo].r * 1.05; nb.vx = f.vx; nb.vy = f.vy; nb.edad = 0;
    P.cuerpos.push(nb);
    for (const b of P.cuerpos) if (!b.muerto && b !== nb) { const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy) || 1; if (d < nb.rT + b.r + 18) { b.vx += dx / d * 140; b.vy += dy / d * 140 - 40; } }
    const pts = Math.round(CUERPOS[k].puntos * 2 * mult); P.puntos += pts;
    P.textos.push({ txt: '+' + pts + (P.cadena > 1 ? '  ' + tr('combo') + ' ×' + P.cadena : ''), x: f.x, y: f.y - nb.rT, t: 0, col: CUERPOS[k].glow, tam: 14 + Math.min(10, k) });
    chispazo(f.x, f.y, CUERPOS[k].glow, 10 + k * 3, 120 + k * 20);
    P.ondas.push({ x: f.x, y: f.y, t: 0, dur: 0.4, r: nb.rT * 2, col: CUERPOS[k].glow });
    P.sacudir = Math.max(P.sacudir, k * 0.6); P.destello = Math.max(P.destello, k >= 7 ? 0.35 : 0);
    Sonido.sfx('fusion', k); vibrar(8 + k * 3);
    if (k > P.maxTipo) P.maxTipo = k;
    if (k > DATOS.visto) { DATOS.visto = k; guardarDatos(); P.banner = { txt: tr('descubriste', tr('nombres')[k]), t: 0, col: CUERPOS[k].glow, tipo: k }; P.lenta = 0.6; Sonido.sfx('descubrir'); }
  }
  // poderes que se ganan con puntos
  while (P.puntos >= P.proxPoder) { const cual = (P.proxPoder / 800) % 2 ? 'sacudon' : 'rayo'; P.poderes[cual]++; P.proxPoder += 800; P.textos.push({ txt: '+1 ' + tr(cual), x: posPoder(cual === 'sacudon' ? 0 : 1).x, y: H - 90, t: 0, col: '#ffd84a', tam: 12 }); }
  guardarPartida();
}
function usarPoder(cual) {
  const P = G;
  if (P.fin || P.poderes[cual] <= 0) return;
  if (cual === 'rayo') { P.rayoActivo = !P.rayoActivo; Sonido.sfx('boton'); return; }
  P.poderes.sacudon--;
  for (const b of P.cuerpos) { b.vy -= azar(350, 650); b.vx += azar(-180, 180); }
  P.sacudir = 10; Sonido.sfx('sacudon'); vibrar([30, 30, 60]);
  guardarPartida();
}
function borrarConRayo(b) {
  const P = G;
  P.poderes.rayo--; P.rayoActivo = false;
  b.muerto = true;
  chispazo(b.x, b.y, '#bff8ff', 30, 220);
  P.ondas.push({ x: b.x, y: b.y, t: 0, dur: 0.35, r: b.r * 2, col: '#3ef0ff' });
  P.rayoVisual = { x: b.x, y: b.y, t: 0.25 };
  Sonido.sfx('rayo'); vibrar(30);
  guardarPartida();
}
function terminar(porTiempo) {
  const P = G;
  P.fin = true; P.finT = 0; P.porTiempo = porTiempo;
  P.rotura = P.cuerpos.slice().sort((a, b) => a.y - b.y); P.nRotura = P.rotura.length;
  if (P.modo === 'relampago') { P.nuevo = P.puntos > DATOS.recordRayo; if (P.nuevo) DATOS.recordRayo = P.puntos; }
  else { P.nuevo = P.puntos > DATOS.record && P.modo === 'clasico'; if (P.nuevo) DATOS.record = P.puntos; }
  if (P.modo === 'diario') { if (DATOS.diaFecha !== hoy()) { DATOS.diaFecha = hoy(); DATOS.diaRecord = 0; } DATOS.diaRecord = Math.max(DATOS.diaRecord, P.puntos); }
  guardarDatos(); guardarPartida();
  Sonido.sfx(P.nuevo ? 'record' : 'fin'); vibrar([40, 60, 100]);
}
function chispazo(x, y, col, n, v) { const P = G; for (let i = 0; i < n && P.part.length < 500; i++) { const a = Math.random() * Math.PI * 2, s = azar(0.3, 1) * v; P.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col: Math.random() < 0.3 ? '#ffffff' : col, t: azar(0.3, 0.8), vida: 0.8, tam: azar(1, 2.6) }); } }

/* ------------------------------------------------------------ el dibujo */
function frasco(t) {
  const peligro = G && G.peligroT > 0.3;
  g.fillStyle = 'rgba(120,200,255,0.05)'; g.fillRect(JL, JT, JR - JL, JF - JT);
  g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(JL + 8, JT, 10, JF - JT);
  // la línea de peligro
  g.setLineDash([6, 6]); g.lineWidth = peligro ? 2 : 1;
  g.strokeStyle = peligro ? (Math.floor(t * 8) % 2 ? '#ff2a5a' : '#ffffff') : 'rgba(255,80,140,0.35)';
  g.beginPath(); g.moveTo(JL, LINEA); g.lineTo(JR, LINEA); g.stroke(); g.setLineDash([]);
  // el tubo de neón del frasco
  const tubo = () => { g.beginPath(); g.moveTo(JL - 5, JT - 14); g.lineTo(JL - 5, JF - 10); g.arcTo(JL - 5, JF + 5, JL + 10, JF + 5, 15); g.lineTo(JR - 10, JF + 5); g.arcTo(JR + 5, JF + 5, JR + 5, JF - 10, 15); g.lineTo(JR + 5, JT - 14); };
  const col = peligro ? '#ff2a5a' : '#3ef0ff';
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalCompositeOperation = 'lighter';
  tubo(); g.strokeStyle = col; g.globalAlpha = 0.18; g.lineWidth = 16; g.stroke();
  g.globalAlpha = 0.4; g.lineWidth = 7; g.stroke();
  g.globalAlpha = 1; g.lineWidth = 3; g.stroke();
  g.strokeStyle = '#ffffff'; g.globalAlpha = 0.8; g.lineWidth = 1; g.stroke();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function lanzador(t) {
  const P = G, x = P.aimX, y = yLanzador(), r = CUERPOS[P.actual].r;
  // la guía
  if (CTRL.guia && !P.fin) {
    let hasta = JF;
    for (const b of P.cuerpos) if (Math.abs(b.x - x) < b.r + r * 0.6 && b.y - b.r < hasta) hasta = b.y - b.r;
    g.setLineDash([3, 6]); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y + r + 4); g.lineTo(x, hasta); g.stroke(); g.setLineDash([]);
  }
  // la nave que suelta
  g.globalCompositeOperation = 'lighter'; estampaBrillo(g, '#ff3ec8', x, y - 18, 30, 0.45); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#2a0e4a'; g.beginPath(); g.ellipse(x, y - 18, 26, 7, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ff3ec8'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(160,240,255,0.5)'; g.beginPath(); g.ellipse(x, y - 22, 11, 8, 0, Math.PI, 0); g.fill();
  for (let i = -2; i <= 2; i++) { g.fillStyle = Math.floor(t * 6 + i) % 2 ? '#ffd84a' : '#3ef0ff'; g.beginPath(); g.arc(x + i * 9, y - 16, 1.6, 0, Math.PI * 2); g.fill(); }
  // el rayo tractor y el cuerpo que va a soltar
  if (!P.fin) {
    const k = 1 - P.carga / 0.5;
    g.fillStyle = 'rgba(62,240,255,0.08)'; g.beginPath(); g.moveTo(x - 8, y - 12); g.lineTo(x + 8, y - 12); g.lineTo(x + r + 4, y + 10 + r); g.lineTo(x - r - 4, y + 10 + r); g.fill();
    if (k > 0) dibujarCuerpo(g, { tipo: P.actual, x, y: y + 10, r: r * salida(clamp(k, 0, 1)), ang: t, vx: 0, vy: 0 }, t);
  }
}
function dibujarPartida(t) {
  const P = G;
  dibujarFondo(t);
  g.save();
  if (P.sacudir > 0.3) g.translate(azar(-1, 1) * P.sacudir, azar(-1, 1) * P.sacudir);
  frasco(t);
  for (const b of P.cuerpos) dibujarCuerpo(g, b, t);
  lanzador(t);
  // ondas, chispas, textos
  g.globalCompositeOperation = 'lighter';
  for (const o of P.ondas) { const k = o.t / o.dur; g.strokeStyle = o.col; g.globalAlpha = 1 - k; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.arc(o.x, o.y, o.r * salida(k), 0, Math.PI * 2); g.stroke(); }
  for (const q of P.part) { g.globalAlpha = clamp(q.t / q.vida * 1.6, 0, 1); g.fillStyle = q.col; g.fillRect(q.x - q.tam / 2, q.y - q.tam / 2, q.tam, q.tam); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (P.rayoVisual && P.rayoVisual.t > 0) {
    P.rayoVisual.t -= 1 / 60;
    g.strokeStyle = '#bff8ff'; g.lineWidth = 3; g.shadowColor = '#3ef0ff'; g.shadowBlur = 14;
    g.beginPath(); let x = P.rayoVisual.x + azar(-20, 20), y = 0; g.moveTo(x, y);
    while (y < P.rayoVisual.y) { y += 18; x = lerp(x, P.rayoVisual.x, 0.3) + azar(-10, 10); g.lineTo(x, Math.min(y, P.rayoVisual.y)); }
    g.stroke(); g.shadowBlur = 0;
  }
  for (const q of P.textos) { const tam = q.tam || 14, m = medir(g, q.txt, tam) / 2 + 6; g.globalAlpha = clamp(1.2 - q.t, 0, 1); texto(g, q.txt, clamp(q.x, m, W - m), q.y, { tam, col: '#ffffff', glow: q.col, blur: 10 }); }
  g.globalAlpha = 1;
  g.restore();
  if (P.destello > 0) { g.fillStyle = 'rgba(255,240,255,' + P.destello * 0.6 + ')'; g.fillRect(0, 0, W, H); }
  if (P.peligroT > 0.3 && !P.fin) {
    g.fillStyle = 'rgba(255,30,80,' + (0.08 + Math.sin(t * 12) * 0.05) + ')'; g.fillRect(0, 0, W, H);
    texto(g, tr('peligro'), W / 2, LINEA - 14, { tam: 18, col: '#ffffff', glow: '#ff2a5a', blur: 14 });
  }
  dibujarHUD(t);
  if (P.banner) banner(P.banner, t);
  if (P.rayoActivo) texto(g, tr('rayoAyuda'), W / 2, JT + 70, { tam: 12, col: '#ffffff', glow: '#3ef0ff', blur: 10 });
  if (!DATOS.ayuda) {
    const lin = partirMedido(tr('ayuda'), JR - JL - 24, (s) => medir(g, s, 13));
    lin.forEach((l, i) => texto(g, l, W / 2, JT + 120 + i * 18, { tam: 13, col: '#ffffff', glow: '#ff3ec8', blur: 8 }));
    const k = (t % 2) / 2, hx = lerp(JL + 40, JR - 40, Math.sin(k * Math.PI * 2) * 0.5 + 0.5);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(hx, JT + 210, 10, 0, Math.PI * 2); g.fill();
  }
}
function dibujarHUD(t) {
  const P = G;
  // pausa
  g.strokeStyle = '#ff3ec8'; g.lineWidth = 2; g.shadowColor = '#ff3ec8'; g.shadowBlur = 10;
  g.beginPath(); g.arc(30, 36, 17, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#fff'; g.fillRect(24, 29, 4, 14); g.fillRect(32, 29, 4, 14);
  // puntos
  texto(g, String(Math.floor(P.vis)), W / 2, 34, { tam: 34, col: '#ffe8fa', glow: '#ff3ec8', blur: 16 });
  const rec = P.modo === 'relampago' ? DATOS.recordRayo : P.modo === 'diario' ? (DATOS.diaFecha === hoy() ? DATOS.diaRecord : 0) : DATOS.record;
  texto(g, (P.modo === 'diario' ? tr('diario') + ' · ' : '') + tr('record') + ' ' + Math.max(rec, P.puntos), W / 2, 60, { tam: 10, col: '#c8faff', cursiva: false, peso: '700' });
  if (P.modo === 'relampago') { const s = Math.ceil(P.tiempo); texto(g, Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), W / 2, 78, { tam: 16, col: s <= 10 && Math.floor(t * 4) % 2 ? '#ff2a5a' : '#ffd84a', glow: '#ffd84a', blur: 8 }); }
  // el que sigue
  const nx = W - 34, ny = 40;
  g.strokeStyle = '#3ef0ff'; g.lineWidth = 2; g.shadowColor = '#3ef0ff'; g.shadowBlur = 10; g.beginPath(); g.arc(nx, ny, 21, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  const rs = Math.min(15, CUERPOS[P.siguiente].r);
  dibujarCuerpo(g, { tipo: P.siguiente, x: nx, y: ny, r: rs, ang: t * 0.6, vx: 0, vy: 0 }, t, false);
  texto(g, tr('siguiente'), nx, ny + 31, { tam: 9, col: '#c8faff', cursiva: false, peso: '800' });
  // la cadena de cuerpos (abajo, al medio)
  const y = H - 46, x0 = 84, x1 = W - 84;
  for (let k = 0; k <= MAX; k++) {
    const x = lerp(x0, x1, k / MAX), r = 3 + k * 0.6;
    if (k <= DATOS.visto) dibujarCuerpo(g, { tipo: k, x, y, r, ang: 0, vx: 0, vy: 0 }, t, k === P.maxTipo);
    else { g.strokeStyle = '#4a3a6a'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
  }
  // los poderes
  [['sacudon', '#ffd84a'], ['rayo', '#3ef0ff']].forEach(([cual, col], i) => {
    const p = posPoder(i), r = radioBoton(), n = P.poderes[cual], act = cual === 'rayo' && P.rayoActivo;
    g.globalAlpha = n > 0 ? 1 : 0.4;
    g.fillStyle = act ? 'rgba(62,240,255,0.3)' : 'rgba(10,4,24,0.75)'; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = act ? 20 : 10; g.stroke(); g.shadowBlur = 0;
    if (cual === 'sacudon') { g.strokeStyle = '#fff'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(p.x - 10, p.y + k * 7); for (let s = -10; s <= 10; s += 5) g.lineTo(p.x + s, p.y + k * 7 + (s / 5 % 2 ? -3 : 3)); g.stroke(); } }
    else { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(p.x + 3, p.y - 13); g.lineTo(p.x - 7, p.y + 2); g.lineTo(p.x, p.y + 2); g.lineTo(p.x - 3, p.y + 13); g.lineTo(p.x + 7, p.y - 2); g.lineTo(p.x, p.y - 2); g.closePath(); g.fill(); }
    g.fillStyle = col; g.beginPath(); g.arc(p.x + r * 0.7, p.y - r * 0.7, 8, 0, Math.PI * 2); g.fill();
    texto(g, String(n), p.x + r * 0.7, p.y - r * 0.7 + 1, { tam: 10, col: '#07040f', cursiva: false });
    g.globalAlpha = 1;
  });
  if (CTRL.soltar === 'boton') { const q = posTirar(); boton(q.x - 46, q.y - 18, 92, 36, tr('tirar'), { col: '#ff3ec8' }); }
}
function banner(b, t) {
  const k = b.t < 0.3 ? rebote(b.t / 0.3) : b.t > 1.7 ? 1 - salida((b.t - 1.7) / 0.3) : 1;
  const y = JT + (JF - JT) * 0.36;
  g.globalAlpha = clamp(k, 0, 1);
  g.fillStyle = 'rgba(7,4,15,0.6)'; g.fillRect(0, y - 40, W, 80);
  if (b.tipo != null) dibujarCuerpo(g, { tipo: b.tipo, x: W / 2, y: y - 4, r: Math.min(30, CUERPOS[b.tipo].r) * clamp(k, 0.01, 1.3), ang: t, vx: 0, vy: 0 }, t);
  texto(g, b.txt, W / 2, b.tipo != null ? y + 32 : y, { tam: b.tipo != null ? 16 : 30 * clamp(k, 0.3, 1.2), col: '#ffffff', glow: b.col, blur: 18 });
  g.globalAlpha = 1;
}

/* ------------------------------------------------------- otras escenas */
function panel(y, h, col) {
  g.fillStyle = 'rgba(7,4,15,0.8)'; g.fillRect(0, 0, W, H);
  rrect(30, y, W - 60, h, 18); g.fillStyle = 'rgba(20,8,40,0.92)'; g.fill();
  g.strokeStyle = col || '#ff3ec8'; g.lineWidth = 2; g.shadowColor = col || '#ff3ec8'; g.shadowBlur = 16; g.stroke(); g.shadowBlur = 0;
}
function escenaPausa(t) {
  dibujarPartida(t);
  const y = H / 2 - 150; panel(y, 300);
  texto(g, tr('pausa'), W / 2, y + 40, { tam: 30, col: '#ffe0f8', glow: '#ff3ec8', blur: 16 });
  if (boton(70, y + 76, W - 140, 40, tr('seguir'), { col: '#3ef0ff' }) || apretada('Escape', 'KeyP')) { escena = 'juego'; return; }
  if (boton(70, y + 126, W - 140, 36, tr('reiniciar'), { col: '#ff3ec8' })) { if (G.modo === 'clasico') Guardado.borrar('partida'); empezar(G.modo); return; }
  if (boton(70, y + 172, (W - 150) / 2, 32, tr('musica') + (Sonido.musicaSi ? '' : ' ✕'), { col: '#8a7aff', tam: 11 })) Sonido.ponerMusica(!Sonido.musicaSi);
  if (boton(80 + (W - 150) / 2, y + 172, (W - 150) / 2, 32, tr('sonido') + (Sonido.efectosSi ? '' : ' ✕'), { col: '#8a7aff', tam: 11 })) Sonido.ponerEfectos(!Sonido.efectosSi);
  if (boton(70, y + 216, W - 140, 36, tr('menu'), { col: '#b46aff' })) { guardarPartida(); irA('menu'); }
}
function escenaFin(t) {
  dibujarPartida(t);
  const P = G, y = H / 2 - 170; panel(y, 340, P.porTiempo ? '#ffd84a' : '#ff2a5a');
  texto(g, P.porTiempo ? tr('tiempo') : tr('fin'), W / 2, y + 40, { tam: 22, col: '#ffffff', glow: P.porTiempo ? '#ffd84a' : '#ff2a5a', blur: 14 });
  const k = Math.min(1, tEsc / 0.9);
  texto(g, String(Math.floor(P.puntos * salida(k))), W / 2, y + 96, { tam: 46, col: '#ffe8fa', glow: '#ff3ec8', blur: 20 });
  const rec = P.modo === 'relampago' ? DATOS.recordRayo : P.modo === 'diario' ? DATOS.diaRecord : DATOS.record;
  texto(g, tr('record') + ' ' + rec, W / 2, y + 134, { tam: 12, col: '#c8faff', cursiva: false, peso: '700' });
  if (P.nuevo && Math.floor(t * 3) % 2) texto(g, tr('nuevoRecord'), W / 2, y + 156, { tam: 16, col: '#ffffff', glow: '#ffd84a', blur: 14 });
  dibujarCuerpo(g, { tipo: P.maxTipo, x: W / 2, y: y + 200, r: Math.min(26, CUERPOS[P.maxTipo].r), ang: t * 0.5, vx: 0, vy: 0 }, t);
  texto(g, tr('nombres')[P.maxTipo], W / 2, y + 236, { tam: 11, col: '#ffffff', glow: CUERPOS[P.maxTipo].glow, blur: 8, cursiva: false, peso: '800' });
  if (boton(66, y + 256, W - 132, 40, tr('otra'), { col: '#3ef0ff', tam: 17 }) || apretada('Enter', 'Space')) { empezar(P.modo); return; }
  if (boton(66, y + 302, W - 132, 30, tr('menu'), { col: '#b46aff', tam: 12 })) irA('menu');
}
let prueba = { x: W / 2, apunta: null, tiro: 0 };
function escenaControles(t) {
  dibujarFondo(t);
  texto(g, tr('controles'), W / 2, 40, { tam: 28, col: '#ffe0f8', glow: '#ff3ec8', blur: 14 });
  let y = 76;
  const fila = (txt) => texto(g, txt, 24, y + 14, { tam: 11, col: '#ffffff', alin: 'left', cursiva: false, peso: '800' });
  const dos = (txt, k, a, b, ta, tb) => { fila(txt); if (boton(W - 186, y, 82, 28, ta, { col: CTRL[k] === a ? '#3ef0ff' : '#5a4a70', tam: 10 })) { CTRL[k] = a; guardarCtrl(); } if (boton(W - 98, y, 82, 28, tb, { col: CTRL[k] === b ? '#3ef0ff' : '#5a4a70', tam: 10 })) { CTRL[k] = b; guardarCtrl(); } y += 38; };
  const regla = (txt, k, min, max, paso) => { fila(txt); if (boton(W - 140, y, 32, 28, '-', { col: '#8a7aff' })) { CTRL[k] = Math.round(clamp(CTRL[k] - paso, min, max) * 100) / 100; guardarCtrl(); } texto(g, Math.round(CTRL[k] * 100) + '%', W - 82, y + 14, { tam: 13, col: '#ffd84a', glow: '#ffd84a', blur: 6 }); if (boton(W - 50, y, 32, 28, '+', { col: '#8a7aff' })) { CTRL[k] = Math.round(clamp(CTRL[k] + paso, min, max) * 100) / 100; guardarCtrl(); } y += 38; };
  const llave = (txt, k) => { fila(txt); if (boton(W - 98, y, 82, 28, CTRL[k] ? tr('si') : tr('no'), { col: CTRL[k] ? '#3ef0ff' : '#5a4a70', tam: 11 })) { CTRL[k] = !CTRL[k]; guardarCtrl(); if (k === 'vibrar' && CTRL[k]) vibrar(40); } y += 38; };
  dos(tr('apuntar'), 'apuntar', 'dedo', 'arrastre', tr('dedo'), tr('arrastre'));
  regla(tr('sensib'), 'sensib', 0.6, 2, 0.1);
  dos(tr('soltar'), 'soltar', 'levantar', 'boton', tr('alLevantar'), tr('conBoton'));
  regla(tr('tamBotones'), 'tamBot', 0.8, 1.4, 0.1);
  llave(tr('guia'), 'guia'); llave(tr('zurdo'), 'zurdo'); llave(tr('vibrar'), 'vibrar');
  // la zona de prueba: la nave se mueve como en el juego
  const zy = y + 8, zh = H - zy - 70;
  rrect(16, zy, W - 32, zh, 12); g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1; g.stroke();
  texto(g, tr('proba'), W / 2, zy + 14, { tam: 10, col: '#c8faff', cursiva: false, peso: '700' });
  if (E.toque && E.toque.y > zy && E.toque.y < zy + zh) { const pt = E.punteros.get(E.toque.id); if (pt) pt.rol = 'prueba'; prueba.apunta = { id: E.toque.id, x0: E.toque.x, aim0: prueba.x }; if (CTRL.apuntar === 'dedo') prueba.x = E.toque.x; }
  if (prueba.apunta) { const pt = E.punteros.get(prueba.apunta.id); if (pt) prueba.x = CTRL.apuntar === 'dedo' ? pt.x : prueba.apunta.aim0 + (pt.x - prueba.apunta.x0) * CTRL.sensib; else { prueba.apunta = null; if (CTRL.soltar === 'levantar') prueba.tiro = 1; } }
  prueba.x = clamp(prueba.x, 40, W - 40);
  prueba.tiro = Math.max(0, prueba.tiro - 1 / 40);
  const py = zy + zh / 2;
  g.fillStyle = '#2a0e4a'; g.beginPath(); g.ellipse(prueba.x, py - 6, 22, 6, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ff3ec8'; g.lineWidth = 2; g.stroke();
  dibujarCuerpo(g, { tipo: 2, x: prueba.x, y: py + 14 + (1 - prueba.tiro) * 0 + prueba.tiro * 0, r: 12, ang: t, vx: 0, vy: 0 }, t);
  if (prueba.tiro > 0) { g.globalAlpha = prueba.tiro; texto(g, '↓', prueba.x, py + 40, { tam: 18, col: '#ffffff', glow: '#3ef0ff' }); g.globalAlpha = 1; }
  if (boton(20, H - 54, 150, 36, tr('restablecer'), { col: '#ff3ec8', tam: 12 })) { Object.assign(CTRL, CTRL_BASE); guardarCtrl(); }
  if (boton(W - 170, H - 54, 150, 36, tr('listo'), { col: '#3ef0ff', tam: 13 }) || apretada('Escape')) irA('menu');
}
let escenaAnterior = null;

/* ------------------------------------------------------------------ bucle */
let ultimo = 0;
function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, ultimo ? (ts - ultimo) / 1000 : 1 / 60); ultimo = ts;
  const t = ts / 1000; ahora = t;
  tEsc += dt;
  if (trans) { trans.t += dt; if (!trans.hecho && trans.t >= trans.dur) { trans.hecho = true; trans.alMedio(); } if (trans.t >= trans.dur * 2) trans = null; }
  g.setTransform(S, 0, 0, S, 0, 0);
  try {
    switch (escena) {
      case 'idioma': escenaIdioma(t); break;
      case 'menu': escenaMenu(t); break;
      case 'catalogo': Sonido.musica(TEMAS.menu); escenaCatalogo(t); break;
      case 'juego': Sonido.musica(G.modo === 'relampago' ? TEMAS.rayo : TEMAS.juego); if (!trans) actualizarPartida(dt); dibujarPartida(t); break;
      case 'pausa': escenaPausa(t); break;
      case 'fin': escenaFin(t); break;
      case 'controles': escenaControles(t); break;
    }
  } catch (e) { console.error(e); }
  if (trans) dibujarTrans(trans.t < trans.dur ? trans.t / trans.dur : 2 - trans.t / trans.dur);
  E.clic = null; E.toque = null; E.suelta = null; E.recien.clear();
}
function arrancar() {
  ajustar();
  Sonido.iniciar();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (escena === 'juego' && G && !G.fin) { escena = 'pausa'; tEsc = 0; } Sonido.pausar(true); } else Sonido.pausar(false); });
  requestAnimationFrame(cuadro);
  window.__nebulosa = { get G() { return G; }, get escena() { return escena; }, empezar, tirar, terminar, irA, DATOS, CTRL, nuevoCuerpo };
}
arrancar();
