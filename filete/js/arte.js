/* ============================================================================
   El arte del filete porteño, todo pintado por código y en píxeles: volutas
   (espirales con su resalte blanco), hojas de acanto, flores, perlitas,
   cintas con letras, letras doradas con sombra corrida y las fichas pintadas.
   Se arma una vez en lienzos chicos y después solo se estampan.
   ========================================================================== */

const K = '#0d0b10';
const F = {
  laca: '#141018', laca2: '#1d1724', oro: '#ffcf3a', oroOsc: '#c8861a', oroClaro: '#fff2a8',
  rojo: '#d8283a', rojoOsc: '#7a1222', verde: '#2fae4e', verdeOsc: '#14602a', verdeClaro: '#9af07a',
  azul: '#2a62d8', azulOsc: '#163a8a', celeste: '#5ac8f0', crema: '#f4e8cc', blanco: '#fff8ec',
};
/* las ocho pinturas de las fichas: base, claro, oscuro */
const PINTURAS = [
  ['#e8323e', '#ff8a8a', '#8a1424'], ['#2fb04e', '#9af07a', '#14602a'], ['#2f6ae0', '#8ab8ff', '#163a8a'], ['#ffc83a', '#fff2a0', '#b07410'],
  ['#ff7a2a', '#ffc08a', '#a83a10'], ['#38c0e8', '#b0f0ff', '#14708e'], ['#9a4ad8', '#d8a8ff', '#52207e'], ['#ff5aa0', '#ffc0dc', '#a0204e'],
];

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
/* disco de píxeles (sin suavizado: bordes de píxel) */
function disco(g, x, y, r, col) {
  g.fillStyle = col;
  if (r < 0.75) { g.fillRect(Math.round(x), Math.round(y), 1, 1); return; }
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    const m = Math.sqrt(Math.max(0, r * r - dy * dy));
    const a = Math.round(x - m), b = Math.round(x + m);
    if (b >= a && m > 0.3) g.fillRect(a, Math.round(y + dy), b - a + 1, 1);
  }
}
function punto(g, x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }

/* la voluta: espiral que se angosta hacia adentro, con lado claro y resalte blanco.
   x, y = el ojo; r = radio de afuera; giros; sentido ±1; ang0 = dónde empieza afuera */
function voluta(g, x, y, r, giros, sentido, cols, grosor, ang0) {
  const tot = giros * Math.PI * 2, paso = 0.04;
  grosor = grosor || Math.max(1.5, r * 0.22);
  ang0 = ang0 || 0;
  const pts = [];
  for (let th = 0; th <= tot; th += paso / Math.max(0.3, (1 - th / tot))) {
    const k = th / tot, rr = r * (1 - k * 0.92), a = ang0 + sentido * th;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr, grosor * (1 - k * 0.65)]);
  }
  for (const [px, py, w] of pts) disco(g, px + 0.6, py + 0.8, w, cols[2]);           // sombra
  for (const [px, py, w] of pts) disco(g, px, py, w, cols[0]);
  for (const [px, py, w] of pts) disco(g, px - w * 0.3, py - w * 0.3, w * 0.45, cols[1]);
  for (let i = 0; i < pts.length; i += 2) { const [px, py, w] = pts[i]; if (w > 1.4) punto(g, px - w * 0.45, py - w * 0.45, F.blanco); }
  disco(g, x, y, Math.max(1, grosor * 0.5), cols[0]);
}
/* la hoja de acanto: un huso curvo de p0 a p1 (con c de control), mitad clara y mitad oscura */
function hoja(g, x0, y0, cx, cy, x1, y1, ancho, cols) {
  const n = 40;
  for (let pas = 0; pas < 3; pas++) for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * ancho;
    if (pas === 0) disco(g, x + 0.7, y + 0.9, w, cols[2]);
    else if (pas === 1) disco(g, x, y, w, cols[0]);
    else { disco(g, x - w * 0.35, y - w * 0.35, w * 0.45, cols[1]); if (i % 3 === 0 && w > 1.2) punto(g, x, y, F.blanco); }
  }
}
/* la flor de cinco pétalos */
function flor(g, x, y, r, cols) {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5, px = x + Math.cos(a) * r * 0.62, py = y + Math.sin(a) * r * 0.62;
    disco(g, px + 0.6, py + 0.8, r * 0.48, cols[2]);
    disco(g, px, py, r * 0.46, cols[0]);
    disco(g, px - r * 0.12, py - r * 0.12, r * 0.2, cols[1]);
  }
  disco(g, x, y, Math.max(1, r * 0.3), F.oro);
  punto(g, x - 1, y - 1, F.blanco);
}
/* el adorno de una esquina (de 46 × 46), para el marco y el menú */
function adornoEsquina(tam) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), s = tam / 46;
  hoja(g, 4 * s, 40 * s, 10 * s, 14 * s, 38 * s, 6 * s, 3.4 * s, [F.verde, F.verdeClaro, F.verdeOsc]);
  voluta(g, 14 * s, 15 * s, 10 * s, 1.15, 1, [F.oro, F.oroClaro, F.oroOsc], 2.4 * s, Math.PI * 0.9);
  hoja(g, 18 * s, 24 * s, 30 * s, 28 * s, 42 * s, 20 * s, 2.6 * s, [F.verde, F.verdeClaro, F.verdeOsc]);
  hoja(g, 22 * s, 18 * s, 26 * s, 30 * s, 20 * s, 42 * s, 2.6 * s, [F.verde, F.verdeClaro, F.verdeOsc]);
  flor(g, 30 * s, 30 * s, 6 * s, [F.rojo, '#ff9a9a', F.rojoOsc]);
  disco(g, 40 * s, 38 * s, 1.6 * s, F.celeste); disco(g, 8 * s, 6 * s, 1.4 * s, F.rojo);
  return c;
}
function espejar(c, h, v) {
  const s = lienzo(c.width, c.height), g = s.getContext('2d');
  g.translate(h ? c.width : 0, v ? c.height : 0); g.scale(h ? -1 : 1, v ? -1 : 1); g.drawImage(c, 0, 0);
  return s;
}
/* marco dorado de filete con perlitas y adornos en las cuatro esquinas */
function marcoFilete(g, x, y, w, h, esquinas, tam) {
  g.fillStyle = K; g.fillRect(x - 3, y - 3, w + 6, h + 6);
  g.fillStyle = F.oroOsc; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = F.oro; g.fillRect(x - 2, y - 2, w + 4, 1); g.fillRect(x - 2, y - 2, 1, h + 4);
  g.fillStyle = F.rojo; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = F.laca; g.fillRect(x, y, w, h);
  for (let i = x + 6; i < x + w - 4; i += 6) { punto(g, i, y - 4, F.oroClaro); punto(g, i, y + h + 3, F.oroClaro); }
  for (let i = y + 6; i < y + h - 4; i += 6) { punto(g, x - 4, i, F.oroClaro); punto(g, x + w + 3, i, F.oroClaro); }
  if (esquinas) {
    const t = tam || 34, o = Math.round(t * 0.32);
    g.drawImage(esquinas[0], x - o, y - o, t, t); g.drawImage(esquinas[1], x + w + o - t, y - o, t, t);
    g.drawImage(esquinas[2], x - o, y + h + o - t, t, t); g.drawImage(esquinas[3], x + w + o - t, y + h + o - t, t, t);
  }
}

/* ------------------------------------------------------------ las fichas */
const FICHAS = new Map();
function ficha(col, s) {
  const k = col + '|' + s;
  if (FICHAS.has(k)) return FICHAS.get(k);
  const [b, l, d] = PINTURAS[col], c = lienzo(s, s), g = c.getContext('2d');
  g.fillStyle = K; g.fillRect(1, 0, s - 2, s); g.fillRect(0, 1, s, s - 2);
  g.fillStyle = d; g.fillRect(1, 1, s - 2, s - 2);
  g.fillStyle = b; g.fillRect(1, 1, s - 3, s - 3);
  g.fillStyle = l; g.fillRect(2, 1, s - 4, 1); g.fillRect(1, 2, 1, s - 4);
  if (s >= 14) {
    g.fillStyle = l; g.fillRect(2, 2, s - 6, 1); g.fillRect(2, 2, 1, s - 6);
    // la mini voluta blanca del centro
    const cx = s / 2 - 0.5, cy = s / 2 - 0.5, R = s * 0.26;
    for (let th = 0; th < Math.PI * 1.7; th += 0.12) {
      const rr = R * (1 - th / (Math.PI * 2) * 0.75), a = Math.PI + th;
      punto(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 'rgba(255,248,236,0.85)');
      if (s >= 20 && th < 2.6) punto(g, cx + Math.cos(a) * (rr + 1), cy + Math.sin(a) * (rr + 1), 'rgba(255,248,236,0.5)');
    }
    punto(g, cx + R * 0.15, cy, F.blanco);
    punto(g, s - 5, 3, 'rgba(255,255,255,0.7)');
  } else { punto(g, 3, 3, 'rgba(255,255,255,0.8)'); }
  FICHAS.set(k, c);
  return c;
}
/* una flor sobre una ficha (lo que se junta en los barrios) */
const FLORES = new Map();
function florFicha(s) {
  if (FLORES.has(s)) return FLORES.get(s);
  const c = lienzo(s, s), g = c.getContext('2d');
  flor(g, s / 2 - 0.5, s / 2 - 0.5, s * 0.36, [F.blanco, '#ffffff', '#c8b898']);
  disco(g, s / 2 - 0.5, s / 2 - 0.5, s * 0.12, F.rojo);
  FLORES.set(s, c);
  return c;
}
/* la casilla vacía del tablero */
let casillaVacia = null;
function vacia() {
  if (casillaVacia) return casillaVacia;
  const c = lienzo(CEL, CEL), g = c.getContext('2d');
  g.fillStyle = '#10141f'; g.fillRect(0, 0, CEL, CEL);
  g.fillStyle = '#171d2c'; g.fillRect(1, 1, CEL - 2, CEL - 2);
  g.fillStyle = '#1d2436'; g.fillRect(1, 1, CEL - 2, 1);
  punto(g, CEL / 2 - 1, CEL / 2 - 1, '#252d44');
  return (casillaVacia = c);
}

/* ------------------------------------------------- las letras de filete */
const GRAD_ORO = ['#fff6c0', '#ffe27a', '#ffcf3a', '#ffb52a', '#f0961e', '#d87a18', '#b05e14'];
const GRAD_CREMA = ['#ffffff', '#fffaf0', '#f8eedc', '#f0e2c8', '#e6d4b4', '#d8c4a0', '#c8b088'];
const GRAD_CELESTE = ['#eafaff', '#c0f0ff', '#90e0fa', '#5ac8f0', '#3aa8d8', '#2a88c0', '#1e6aa0'];
const GRAD_ROJO = ['#ffd0d0', '#ff9a9a', '#ff6a6a', '#e8323e', '#c82432', '#a01a2a', '#7a1222'];
const GRAD_VERDE = ['#e0ffd0', '#b0f090', '#7ad860', '#4cc04a', '#2fae4e', '#1f8a3a', '#14602a'];
const cacheLetras = new Map();
/* texto con letras de cartel: sombra corrida de color, contorno, degradé por fila y filo blanco */
function letrasFilete(str, esc, grad, sombra) {
  const k = str + esc + grad[0] + (sombra || '');
  if (cacheLetras.has(k)) return cacheLetras.get(k);
  const { pts, w } = puntosTexto(str);
  const on = new Set(pts.map(([x, y]) => x + ',' + y));
  const sd = Math.max(1, Math.round(esc * 0.6));
  const c = lienzo((w + 2) * esc + sd + 2, 13 * esc + sd + 2), g = c.getContext('2d');
  const ox = esc + 1, oy = 4 * esc + 1;
  g.fillStyle = sombra || F.rojoOsc;
  for (const [x, y] of pts) g.fillRect(ox + x * esc + sd, oy + y * esc + sd, esc, esc);
  g.fillStyle = K;
  for (const [x, y] of pts) g.fillRect(ox + x * esc - 1, oy + y * esc - 1, esc + 2, esc + 2);
  for (const [x, y, r] of pts) {
    g.fillStyle = grad[clamp(r, 0, 6)]; g.fillRect(ox + x * esc, oy + y * esc, esc, esc);
    if (esc >= 2) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      if (!on.has(x + ',' + (y - 1))) g.fillRect(ox + x * esc, oy + y * esc, esc, 1);
      if (!on.has((x - 1) + ',' + y)) g.fillRect(ox + x * esc, oy + y * esc, 1, esc);
    }
  }
  if (cacheLetras.size > 300) cacheLetras.clear();
  cacheLetras.set(k, c);
  return c;
}
/* y = la línea de arriba de las mayúsculas */
function escribir(g, str, x, y, o) {
  o = o || {};
  const esc = o.esc || 1;
  if (esc === 1 && !o.filete) { textoPx(g, str, x, y, { alin: o.alin, grad: o.grad, col: o.col, borde: o.borde, sinSombra: o.sinSombra }); return; }
  // árabe, japonés, tailandés, birmano…: sin letras de cartel, con la letra del sistema al tamaño del cartel
  if (!esPx(str)) { textoPx(g, str, x, y, { alin: o.alin, grad: o.grad || GRAD_ORO, borde: K, escala: esc }); return; }
  const c = letrasFilete(str, esc, o.grad || GRAD_ORO, o.sombra);
  let dx = x - esc - 1;
  if (o.alin === 'centro') dx = Math.round(x - c.width / 2 + 1);
  else if (o.alin === 'der') dx = x - c.width + 2;
  g.drawImage(c, Math.round(dx), Math.round(y - 4 * esc - 1));
}

/* la cinta (cartel de filete) con las puntas dobladas y cortadas en V; se arma en su propio
   lienzo (los cortes son transparentes) y se estampa */
const CINTAS = new Map();
function cinta(g, x, y, w, h, col, colOsc) {
  w = Math.round(w); h = Math.round(h);
  const k = w + '|' + h + col;
  let c = CINTAS.get(k);
  const p = Math.round(h * 0.6) + 2;
  if (!c) {
    c = lienzo(w + 2 * p + 2, h + 6);
    const s = c.getContext('2d'), ox = p + 1, oy = 1;
    s.fillStyle = K; s.fillRect(0, oy + 3, p + 4, h + 2); s.fillRect(ox + w - 3, oy + 3, p + 4, h + 2);
    s.fillStyle = colOsc; s.fillRect(1, oy + 4, p + 2, h); s.fillRect(ox + w - 2, oy + 4, p + 2, h);
    const v = Math.ceil(h / 2) + 1;
    for (let i = 0; i <= v; i++) {
      const a = v - i;
      s.clearRect(0, oy + 3 + i, a, 1); s.clearRect(0, oy + 5 + h - i, a, 1);
      s.clearRect(c.width - a, oy + 3 + i, a, 1); s.clearRect(c.width - a, oy + 5 + h - i, a, 1);
    }
    s.fillStyle = K; s.fillRect(ox - 1, oy - 1, w + 2, h + 2);
    s.fillStyle = col; s.fillRect(ox, oy, w, h);
    s.fillStyle = 'rgba(255,255,255,0.35)'; s.fillRect(ox, oy + 1, w, 1);
    s.fillStyle = 'rgba(0,0,0,0.25)'; s.fillRect(ox, oy + h - 2, w, 2);
    s.fillStyle = F.oro; s.fillRect(ox, oy, w, 1); s.fillRect(ox, oy + h - 1, w, 1);
    CINTAS.set(k, c);
  }
  g.drawImage(c, Math.round(x - p - 1), Math.round(y - 1));
}

/* el fondo de laca negra con el brillo de una lámpara arriba */
function fondoLaca(Wf, Hf) {
  const c = lienzo(Wf, Hf), g = c.getContext('2d'), r = rngSemilla(5);
  for (let y = 0; y < Hf; y++) {
    const p = y / Hf;
    g.fillStyle = 'rgb(' + Math.round(22 - p * 8) + ',' + Math.round(17 - p * 6) + ',' + Math.round(26 - p * 8) + ')';
    g.fillRect(0, y, Wf, 1);
  }
  for (let i = 0; i < Wf * Hf / 40; i++) punto(g, r() * Wf, r() * Hf, 'rgba(255,255,255,0.025)');
  return c;
}
