// El dibujo de un nivel: el fondo de la caja, lo que hay en el tablero
// (alfileres, estrellas de origami, globos de papel, abanicos, chinches,
// sobres, gomitas), los hilos de algodón, el caramelo y Morfi.
//
// Todo lo que no se mueve por dentro se arma una vez como recorte con su
// sombra (papel.js › recorte) y se pega girado; los hilos se trazan cada
// cuadro entre la posición de antes y la de ahora (`alfa`), así se ven
// suaves a 60, 90 o 120 Hz aunque la física vaya a pasos fijos.
import { fondo, recorte, pegar, estrellaDe, redondo, pintarGrano, tono, P } from './papel.js';
import { ANCHO, ALTO, R_CARAMELO } from './partida.js';
import { azar, clamp, lerp } from './util.js';

// ── los sprites (en unidades del tablero × la escala de pantalla) ──────────
function spr(clave, esc, w, h, dib, op) { return recorte(`${clave}@${esc.toFixed(2)}`, w * esc, h * esc, (g) => { g.scale(esc, esc); dib(g); }, op); }

export const CARAMELOS = {
  rojo: { a: '#e8423a', b: '#fbf3ea', papel: '#f06a5f' },
  frutilla: { a: '#ff6f9a', b: '#ffe3ec', papel: '#ff93b3' },
  menta: { a: '#2fbf8a', b: '#e9fff5', papel: '#62d8ad' },
  uva: { a: '#8a55d6', b: '#f1e8ff', papel: '#a67ce6' },
  dulce: { a: '#b8742e', b: '#f7e3c4', papel: '#d8a060' },
  limon: { a: '#f0c419', b: '#fffbe0', papel: '#f7d85a' },
  arcoiris: { a: '#e8423a', b: '#3f7fd1', papel: '#f5c542', arco: true },
};

function caramelo(esc, piel) {
  const c = CARAMELOS[piel] || CARAMELOS.rojo;
  return spr('caramelo:' + piel, esc, 64, 36, (g) => {
    const r = R_CARAMELO;
    // el papel del envoltorio, retorcido a los costados (como un moño)
    for (const lado of [-1, 1]) {
      g.save(); g.scale(lado, 1);
      g.fillStyle = c.papel;
      g.beginPath(); g.moveTo(r * 0.7, -3); g.lineTo(r + 13, -10); g.lineTo(r + 15, -3); g.lineTo(r + 13, 2); g.lineTo(r + 15, 8); g.lineTo(r + 12, 10); g.lineTo(r * 0.7, 3); g.closePath(); g.fill();
      g.strokeStyle = tono(c.papel, -0.25); g.lineWidth = 0.8;
      for (const k of [-6, -1, 4]) { g.beginPath(); g.moveTo(r + 2, k * 0.4); g.lineTo(r + 12, k); g.stroke(); }
      g.fillStyle = tono(c.papel, -0.2); g.fillRect(r * 0.62, -3.5, 4, 7);
      g.restore();
    }
    // el caramelo: una espiral de dos colores con brillo
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = c.b; g.fillRect(-r, -r, 2 * r, 2 * r);
    const cols = c.arco ? ['#e8423a', '#f5a623', '#f5c542', '#58b368', '#3f7fd1', '#8a55d6'] : [c.a];
    for (let k = 0; k < 6; k++) {
      g.fillStyle = cols[k % cols.length];
      g.beginPath(); g.moveTo(0, 0);
      for (let t = 0; t <= 1.001; t += 0.1) { const a = (k / 6) * Math.PI * 2 + t * 1.5, rr = t * r * 1.05; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      for (let t = 1; t >= 0; t -= 0.1) { const a = (k / 6) * Math.PI * 2 + 0.55 + t * 1.5, rr = t * r * 1.05; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill();
    }
    g.restore();
    g.strokeStyle = tono(c.a, -0.35); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.42, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2); g.fill();
  }, { sombra: 0.32, borroso: 2.5 });
}

// Una estrella de origami: cada punta en dos mitades, una clara y una
// oscura, como el papel doblado por la mitad.
function estrella(esc) {
  return spr('estrella', esc, 34, 34, (g) => {
    const R = 14, r = 6.2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, a1 = a - Math.PI / 5, a2 = a + Math.PI / 5;
      const p = [Math.cos(a) * R, Math.sin(a) * R], q1 = [Math.cos(a1) * r, Math.sin(a1) * r], q2 = [Math.cos(a2) * r, Math.sin(a2) * r];
      g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(...q1); g.lineTo(...p); g.closePath(); g.fill();
      g.fillStyle = '#f0b21c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(...p); g.lineTo(...q2); g.closePath(); g.fill();
    }
    g.strokeStyle = '#c98a10'; g.lineWidth = 0.9; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.stroke();
  }, { sombra: 0.3, borroso: 2 });
}
// El contorno vacío de la estrella (en el HUD, las que faltan)
export function estrellaVacia(g, x, y, r) {
  g.fillStyle = 'rgba(60,40,20,0.22)'; estrellaDe(g, x + 1, y + 1.5, r);
  g.fillStyle = 'rgba(255,248,230,0.55)'; estrellaDe(g, x, y, r);
}

// Un alfiler de cabeza de plástico, visto de arriba.
function alfiler(esc, color = '#e04a3a') {
  return spr('alfiler:' + color, esc, 22, 22, (g) => {
    g.fillStyle = tono(color, -0.3); g.beginPath(); g.arc(0.6, 0.8, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, 6.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = tono(color, 0.35); g.beginPath(); g.arc(-1.6, -1.8, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-2.2, -2.4, 1.2, 0, Math.PI * 2); g.fill();
  }, { sombra: 0.4, borroso: 1.6 });
}
// El globo de papel (el que se infla soplando por el agujerito): seis caras
// con los pliegues marcados.
function globo(esc) {
  return spr('globo', esc, 60, 60, (g) => {
    const R = 24;
    const cols = ['#9ad0f5', '#7dbbea', '#b8def8', '#6aaee0'];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2 + Math.PI / 8, a1 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      g.fillStyle = cols[k % cols.length];
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); g.closePath(); g.fill();
    }
    g.globalAlpha = 0.85; g.strokeStyle = '#4f8fc2'; g.lineWidth = 0.9;
    g.beginPath(); for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.stroke();
    g.beginPath(); g.moveTo(-R * 0.9, 0); g.lineTo(R * 0.9, 0); g.moveTo(0, -R * 0.9); g.lineTo(0, R * 0.9); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = '#4f8fc2'; g.beginPath(); g.arc(0, 0, 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.45, R * 0.26, R * 0.12, -0.7, 0, Math.PI * 2); g.fill();
  }, { sombra: 0.25, borroso: 3 });
}
// El abanico de papel plegado, mirando a la derecha (se gira al dibujarlo).
function abanico(esc) {
  return spr('abanico', esc, 56, 56, (g) => {
    const R = 22, n = 9;
    g.fillStyle = '#8a5a2b'; redondo(g, -22, -3, 16, 6, 2); g.fill();
    for (let k = 0; k < n; k++) {
      const a0 = -1 + (k / n) * 2, a1 = -1 + ((k + 1) / n) * 2;
      g.fillStyle = k % 2 ? '#f5c542' : '#f7d875';
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10 + Math.cos(a0) * R * 1.4, Math.sin(a0) * R); g.lineTo(-10 + Math.cos(a1) * R * 1.4, Math.sin(a1) * R); g.closePath(); g.fill();
    }
    g.strokeStyle = '#c98a10'; g.lineWidth = 0.8;
    for (let k = 0; k <= n; k++) { const a = -1 + (k / n) * 2; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10 + Math.cos(a) * R * 1.4, Math.sin(a) * R); g.stroke(); }
    g.fillStyle = '#e04a3a'; g.beginPath(); g.arc(-10, 0, 3.2, 0, Math.PI * 2); g.fill();
  }, { sombra: 0.3, borroso: 2 });
}
// Una chinche vista de costado: la cabeza redonda y la punta de metal.
function chinche(esc) {
  return spr('chinche', esc, 18, 24, (g) => {
    g.fillStyle = '#b9bec7'; g.beginPath(); g.moveTo(-1.6, 1); g.lineTo(0, 10); g.lineTo(1.6, 1); g.closePath(); g.fill();
    g.fillStyle = '#e8ecf1'; g.fillRect(-0.5, 1, 0.8, 7);
    g.fillStyle = '#4a4f59'; redondo(g, -7, -4, 14, 5, 2); g.fill();
    g.fillStyle = '#e04a3a'; g.beginPath(); g.ellipse(0, -5, 6, 4.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-2, -6.5, 2.2, 1.2, 0, 0, Math.PI * 2); g.fill();
  }, { sombra: 0.35, borroso: 1.5 });
}
// El sobre (con su estampilla del color de la pareja), con la boca hacia +x.
function sobre(esc, color) {
  return spr('sobre:' + color, esc, 44, 36, (g) => {
    g.fillStyle = '#f7f1e3'; redondo(g, -16, -12, 32, 24, 2.5); g.fill();
    g.strokeStyle = '#cfc3a8'; g.lineWidth = 1; redondo(g, -16, -12, 32, 24, 2.5); g.stroke();
    // la solapa abierta hacia la derecha y el hueco oscuro
    g.fillStyle = '#3b2a1a'; g.beginPath(); g.moveTo(16, -10); g.lineTo(4, 0); g.lineTo(16, 10); g.closePath(); g.fill();
    g.strokeStyle = '#d9ccb0'; g.beginPath(); g.moveTo(-16, -12); g.lineTo(2, 1); g.moveTo(-16, 12); g.lineTo(2, -1); g.stroke();
    g.fillStyle = color; g.fillRect(-13, -9, 9, 8);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.setLineDash([1.5, 1.2]); g.strokeRect(-12.3, -8.3, 7.6, 6.6); g.setLineDash([]);
  }, { sombra: 0.3, borroso: 2 });
}
// El estante de cartón donde se sienta Morfi
function estante(esc) {
  return spr('estante', esc, 96, 22, (g) => {
    g.fillStyle = P.kraftOsc; redondo(g, -44, -2, 88, 12, 3); g.fill();
    g.fillStyle = P.kraftClaro; redondo(g, -44, -6, 88, 8, 3); g.fill();
    g.strokeStyle = P.kraftBorde; g.lineWidth = 1; redondo(g, -44, -6, 88, 16, 3); g.stroke();
    g.fillStyle = 'rgba(90,55,20,0.18)'; for (let x = -40; x < 44; x += 5) g.fillRect(x, 3, 1.5, 6);
  }, { sombra: 0.35, borroso: 3 });
}

// ── la cámara del tablero ───────────────────────────────────────────────────
export function camaraTablero(W, H, { margenArriba = 0 } = {}) {
  const esc = Math.min(W / ANCHO, (H - margenArriba) / ALTO) * 0.98;
  return { esc, ox: (W - ANCHO * esc) / 2, oy: margenArriba + (H - margenArriba - ALTO * esc) / 2 };
}
const aP = (cam, x, y) => [cam.ox + x * cam.esc, cam.oy + y * cam.esc];

// ── los hilos ──────────────────────────────────────────────────────────────
// Algodón retorcido: una sombra, el hilo claro y el retorcido en rayitas.
function hilo(g, m, h, cam, alfa) {
  const n = h.p.length;
  if (n < 2) return;
  const pts = new Float64Array(n * 2);
  for (let k = 0; k < n; k++) {
    const i = h.p[k], x = m.px[i] + (m.x[i] - m.px[i]) * alfa, y = m.py[i] + (m.y[i] - m.py[i]) * alfa;
    pts[k * 2] = cam.ox + x * cam.esc; pts[k * 2 + 1] = cam.oy + y * cam.esc;
  }
  const traza = () => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let k = 1; k < n; k++) g.lineTo(pts[k * 2], pts[k * 2 + 1]); };
  const e = cam.esc;
  g.globalAlpha = h.alfa;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.save(); g.translate(1.6 * e, 2.4 * e); traza(); g.strokeStyle = 'rgba(40,24,8,0.22)'; g.lineWidth = 3.4 * e; g.stroke(); g.restore();
  traza(); g.strokeStyle = '#e2c48f'; g.lineWidth = 3.2 * e; g.stroke();
  g.setLineDash([2.4 * e, 2.6 * e]); g.strokeStyle = '#b68e55'; g.lineWidth = 3.2 * e; g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,245,220,0.7)'; g.lineWidth = 0.9 * e; g.stroke();
  g.globalAlpha = 1;
}

// ── el tablero entero ──────────────────────────────────────────────────────
// `sinFondo`: para el caramelo del menú, que va sobre el fondo del menú
export function dibujarNivel(g, W, H, p, cam, { t, alfa = 1, morfi, pielCaramelo = 'rojo', efectos, mundo = 'carton', dpr = 1, sinFondo = false }) {
  const e = cam.esc, m = p.mundo;
  if (!sinFondo) g.drawImage(fondo(mundo, W, H, dpr), 0, 0);
  // las gomitas (atrás de todo)
  for (const el of p.elasticos) {
    const [ax, ay] = aP(cam, el.ax, el.ay), [bx, by] = aP(cam, el.bx, el.by), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l, v = Math.sin(el.vibra * 40) * el.vibra * 10 * e;
    g.strokeStyle = 'rgba(40,24,8,0.2)'; g.lineWidth = 5 * e; g.beginPath(); g.moveTo(ax + 2 * e, ay + 3 * e); g.quadraticCurveTo(mx + nx * v + 2 * e, my + ny * v + 3 * e, bx + 2 * e, by + 3 * e); g.stroke();
    g.strokeStyle = '#e8836b'; g.lineWidth = 4.5 * e; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx + nx * v, my + ny * v, bx, by); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2 * e; g.stroke();
    for (const [x, y] of [[ax, ay], [bx, by]]) pegar(g, alfiler(e, '#6a7383'), x, y, { alto: 2 * e });
  }
  // las chinches, en fila, con la punta para afuera
  for (const ch of p.chinches) {
    const l = Math.hypot(ch.bx - ch.ax, ch.by - ch.ay), n = Math.max(1, Math.round(l / 13)), ang = Math.atan2(ch.by - ch.ay, ch.bx - ch.ax) + Math.PI / 2;
    const sp = chinche(e);
    for (let k = 0; k <= n; k++) {
      const [x, y] = aP(cam, ch.ax + ((ch.bx - ch.ax) * k) / n, ch.ay + ((ch.by - ch.ay) * k) / n);
      pegar(g, sp, x, y, { ang: ang + (k % 2 ? 0.08 : -0.08) + Math.PI, alto: 2 * e });
    }
  }
  // los sobres
  const colSobres = ['#58b368', '#3f7fd1', '#e0566c', '#8a55d6'];
  p.sobres.forEach((s, i) => {
    for (const q of [s.a, s.b]) { const [x, y] = aP(cam, q.x, q.y); pegar(g, sobre(e, colSobres[i % 4]), x, y, { ang: q.ang, alto: 3 * e, esc: 1 + (s.espera > 0 ? Math.sin(s.espera * 20) * 0.06 : 0) }); }
  });
  // los clips (alfiler con su radio de lápiz) y los alfileres de los hilos
  for (const cl of p.clips) {
    const [x, y] = aP(cam, cl.x, cl.y);
    if (!cl.usado) {
      g.strokeStyle = 'rgba(70,55,40,0.5)'; g.lineWidth = 1.4 * e; g.setLineDash([5 * e, 4 * e]); g.lineDashOffset = -t * 12 * e;
      g.beginPath(); g.arc(x, y, cl.r * e, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    }
    pegar(g, alfiler(e, '#3f7fd1'), x, y, { alto: 2.5 * e });
  }
  // los hilos
  for (const h of m.hilos) if (h.vivo) hilo(g, m, h, cam, alfa);
  for (const pin of p.pines) { const [x, y] = aP(cam, pin.x, pin.y); pegar(g, alfiler(e, pin.mueve ? '#8a55d6' : '#e04a3a'), x, y, { alto: 2.5 * e }); }
  // los rieles de los alfileres que se mueven
  for (const pin of p.pines) if (pin.mueve) {
    const [ax, ay] = aP(cam, ...pin.mueve.a), [bx, by] = aP(cam, ...pin.mueve.b);
    g.strokeStyle = 'rgba(70,55,40,0.35)'; g.lineWidth = 3 * e; g.setLineDash([2 * e, 5 * e]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
  }
  // los globos de papel que esperan, flotando
  for (const gl of p.globos) if (!gl.usado) { const [x, y] = aP(cam, gl.x, gl.y + Math.sin(t * 2 + gl.t) * 2.5); pegar(g, globo(e), x, y, { alto: 5 * e, ang: Math.sin(t * 1.3 + gl.t) * 0.06 }); }
  // los abanicos
  for (const a of p.abanicos) {
    const [x, y] = aP(cam, a.x, a.y), aleteo = a.soplo > 0 ? Math.sin(a.soplo * 50) * 0.18 : 0;
    pegar(g, abanico(e), x, y, { ang: a.ang + aleteo, alto: 3 * e, sy: 1 - (a.soplo > 0 ? Math.abs(Math.sin(a.soplo * 50)) * 0.15 : 0) });
  }
  // las estrellas que faltan: flotan y se hamacan
  for (const s of p.estrellas) if (!s.tomada) {
    const [x, y] = aP(cam, s.x, s.y + Math.sin(t * 2.2 + s.t) * 2.2);
    pegar(g, estrella(e), x, y, { ang: Math.sin(t * 1.4 + s.t) * 0.18, alto: 4 * e, esc: 1 + Math.sin(t * 3 + s.t) * 0.04 });
  }
  // el estante y Morfi
  const [mx, my] = aP(cam, p.morfi.x, p.morfi.y);
  pegar(g, estante(e), mx, my + 6 * e, { alto: 4 * e });
  morfi.dibujar(g, mx, my, e);
  // el caramelo (y su globo, si está en uno)
  if (p.estado === 'juego' || p.estado === 'perdido' || (p.estado === 'comido' && p.tFin < 0.05)) {
    const c = p.c, x = m.px[c] + (m.x[c] - m.px[c]) * alfa, y = m.py[c] + (m.y[c] - m.py[c]) * alfa;
    const [sx, sy] = aP(cam, x, y);
    pegar(g, caramelo(e, pielCaramelo), sx, sy, { ang: p.giro || 0, alto: 4 * e });
    if (p.enGlobo) {
      const b = Math.sin(t * 5) * 0.03;
      g.globalAlpha = 0.72; pegar(g, globo(e), sx, sy - 2 * e, { alto: 0, esc: 1.25 + b, ang: Math.sin(t * 2) * 0.08 }); g.globalAlpha = 1;
    }
  }
  efectos?.dibujar(g, cam, e);
  if (!sinFondo) pintarGrano(g, W, H, 0.6);
}

// ── las partículas de papel ─────────────────────────────────────────────────
export class Efectos {
  constructor() { this.q = []; this.r = azar(99); }
  // pedacitos de papel que saltan (al cortar, al romperse, al comer)
  papelitos(x, y, n, colores, { vel = 160, arriba = 60, vida = 0.9, tam = 3 } = {}) {
    const r = this.r;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, v = vel * (0.4 + r() * 0.8);
      this.q.push({ tipo: 'papel', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - arriba, t: 0, vida: vida * (0.6 + r() * 0.6), a: r() * 6, giro: (r() - 0.5) * 18, tam: tam * (0.6 + r() * 0.8), color: colores[k % colores.length] });
    }
  }
  brillos(x, y, n = 8, color = '#ffd84a') {
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; this.q.push({ tipo: 'brillo', x, y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, t: 0, vida: 0.45, tam: 4, color }); }
  }
  aire(x, y, ang) {
    const r = this.r;
    for (let k = 0; k < 7; k++) {
      const a = ang + (r() - 0.5) * 0.7, v = 260 + r() * 160;
      this.q.push({ tipo: 'aire', x: x + Math.cos(ang) * 14, y: y + Math.sin(ang) * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.4 + r() * 0.2, a: a, tam: 8 + r() * 6 });
    }
  }
  pasar(dt) {
    for (const q of this.q) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.tipo === 'papel') { q.vx *= 1 - dt * 1.5; q.vy += 420 * dt; q.a += q.giro * dt; }
      else { q.vx *= 1 - dt * 4; q.vy *= 1 - dt * 4; }
    }
    this.q = this.q.filter((q) => q.t < q.vida);
  }
  dibujar(g, cam, e) {
    for (const q of this.q) {
      const [x, y] = aP(cam, q.x, q.y), k = 1 - q.t / q.vida;
      if (q.tipo === 'papel') {
        g.globalAlpha = Math.min(1, k * 2.5);
        g.save(); g.translate(x, y); g.rotate(q.a); g.scale(1, Math.abs(Math.cos(q.a * 1.7)) * 0.8 + 0.2);
        g.fillStyle = q.color; g.fillRect(-q.tam * e, -q.tam * 0.6 * e, q.tam * 2 * e, q.tam * 1.2 * e);
        g.restore();
      } else if (q.tipo === 'brillo') {
        g.globalAlpha = k; g.fillStyle = q.color; estrellaDe(g, x, y, q.tam * e * (0.5 + k * 0.6), 4, 0.35);
      } else {
        g.globalAlpha = k * 0.7; g.strokeStyle = '#fdf6e6'; g.lineWidth = 2.2 * e; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(q.a) * q.tam * e, y - Math.sin(q.a) * q.tam * e); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
}

export { aP, caramelo, estrella, alfiler, globo, abanico, sobre, estante };
