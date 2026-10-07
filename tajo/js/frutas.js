/* ============================================================================
   Las frutas a pincel (sumi-e): aguada despareja con el borde que se corre en
   el papel, contorno de pincel seco que se corta en dos o tres lugares y los
   detalles (hojas, semillas, poros) de a pinceladas. Cada fruta tiene dos
   dibujos en caché: la piel (entera) y el corte (la pulpa, que es lo que se ve
   en las mitades). Las formas son polígonos, así el contorno puede variar el
   grosor como un pincel de verdad.
   ========================================================================== */

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mezclar(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; }
function conAlfa(h, a) { const [r, g2, b] = hexRgb(h); return 'rgba(' + r + ',' + g2 + ',' + b + ',' + a + ')'; }

const N_PTS = 60;
const FORMAS = {
  // r = radio de choque; cada forma devuelve puntos [x, y] alrededor del centro
  circulo: (r, ax = 1, ay = 1) => { const p = []; for (let i = 0; i < N_PTS; i++) { const a = (i / N_PTS) * Math.PI * 2; p.push([Math.cos(a) * r * ax, Math.sin(a) * r * ay]); } return p; },
  manzana: (r, hondo = 0.2) => {
    const p = [];
    for (let i = 0; i < N_PTS; i++) {
      const a = (i / N_PTS) * Math.PI * 2 - Math.PI, d = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
      const rr = r * (1 + 0.05 * Math.cos(2 * a)) - r * hondo * Math.exp(-(d * d) / 0.07) - (Math.sin(a) > 0 ? r * 0.06 * Math.sin(a) : 0);
      p.push([Math.cos(a) * rr * 1.04, Math.sin(a) * rr * 0.96]);
    }
    return p;
  },
  limon: (r) => { const p = []; for (let i = 0; i < N_PTS; i++) { const a = (i / N_PTS) * Math.PI * 2, c = Math.cos(a); p.push([c * r * 1.12 * (1 + 0.16 * Math.pow(Math.abs(c), 14)), Math.sin(a) * r * 0.84]); } return p; },
  gota: (r, abajo) => {   // frutilla (punta abajo) e higo (punta arriba)
    const p = [];
    for (let i = 0; i < N_PTS; i++) {
      const a = (i / N_PTS) * Math.PI * 2, s = Math.sin(a) * (abajo ? 1 : -1);
      const x = Math.cos(a) * r * (1 - 0.3 * Math.max(0, s)), y = Math.sin(a) * r * (s > 0 ? 1.12 : 0.88);
      p.push([x, y + (abajo ? -0.06 : 0.06) * r]);
    }
    return p;
  },
  platano: (r) => {
    const arriba = [], abajo = [], n = N_PTS / 2;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * 2 - 1, cx = s * r * 1.22, cy = -r * 0.25 + s * s * r * 0.6;
      const nx = -2 * s * r * 0.6 / (r * 1.22), l = Math.hypot(nx, 1), w = r * (0.34 * (1 - Math.pow(Math.abs(s), 3.2)) + 0.05);
      arriba.push([cx + (nx / l) * -w, cy - (1 / l) * w]);
      abajo.push([cx + (nx / l) * w, cy + (1 / l) * w]);
    }
    return arriba.concat(abajo.reverse()).map(([x, y]) => [x, y + r * 0.02]);
  },
};

const FRUTAS = {
  sandia:   { r: 31, pts: 1, forma: (r) => FORMAS.circulo(r, 1.14, 0.9), piel: '#3f6b2a', piel2: '#1f3a17', carne: '#d8333b', carne2: '#a81d2c', anillo: '#e7edc4', jugo: '#c62836' },
  naranja:  { r: 22, pts: 1, forma: (r) => FORMAS.circulo(r), piel: '#e8892a', piel2: '#b85a14', carne: '#f6a33a', carne2: '#e07a14', anillo: '#f8e7c6', jugo: '#ee8a1e' },
  manzana:  { r: 22, pts: 1, forma: (r) => FORMAS.manzana(r), piel: '#bd3329', piel2: '#7e1a18', carne: '#f4e7bf', carne2: '#e2cf96', anillo: null, jugo: '#d9c27a' },
  limon:    { r: 19, pts: 1, forma: (r) => FORMAS.limon(r), piel: '#e8c935', piel2: '#b8961a', carne: '#f6ea84', carne2: '#e2cf4a', anillo: '#fbf4cf', jugo: '#e2cc3a' },
  kiwi:     { r: 20, pts: 1, forma: (r) => FORMAS.circulo(r, 1.12, 0.88), piel: '#7d5c34', piel2: '#4e3618', carne: '#86b63a', carne2: '#5f8f22', anillo: null, jugo: '#86b63a' },
  durazno:  { r: 21, pts: 1, forma: (r) => FORMAS.manzana(r, 0.1), piel: '#f0a466', piel2: '#c8553f', carne: '#f7c25e', carne2: '#e99a3a', anillo: null, jugo: '#f0a04a' },
  frutilla: { r: 18, pts: 1, forma: (r) => FORMAS.gota(r, true), piel: '#d22c34', piel2: '#8e1520', carne: '#f0706e', carne2: '#d83a44', anillo: null, jugo: '#d42a3a' },
  cereza:   { r: 15, pts: 1, forma: (r) => FORMAS.manzana(r, 0.12), piel: '#8e1626', piel2: '#4e0a14', carne: '#b8283a', carne2: '#7e1424', anillo: null, jugo: '#8e1626' },
  higo:     { r: 19, pts: 1, forma: (r) => FORMAS.gota(r, false), piel: '#5c2c55', piel2: '#2f1230', carne: '#e5607e', carne2: '#b8304e', anillo: '#f4e4d4', jugo: '#b83a6a' },
  platano:  { r: 21, pts: 1, forma: (r) => FORMAS.platano(r), piel: '#ecca3a', piel2: '#b8901c', carne: '#f6eec6', carne2: '#e6d898', anillo: null, jugo: '#e6d898' },
  bomba:    { r: 20, pts: 0, forma: (r) => FORMAS.circulo(r), piel: '#3a3430', piel2: '#0e0b09', bomba: true, jugo: '#16110d' },
};
// en el celu parado, más grandes se cortan mejor y se lucen más (el dibujo escala con r)
for (const k in FRUTAS) FRUTAS[k].r = Math.round(FRUTAS[k].r * 1.25);
const TIPOS_FRUTA = Object.keys(FRUTAS).filter((k) => !FRUTAS[k].bomba);
const PODERES = { hielo: '#4f97c9', frenesi: BERMELLON, doble: '#c99a22' };

function caminoPts(pts, k = 1, dx = 0, dy = 0) {
  const p = new Path2D(), n = pts.length, m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2 * k + dx, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2 * k + dy];
  const a = m(0); p.moveTo(a[0], a[1]);
  for (let i = 1; i <= n; i++) { const q = m(i); p.quadraticCurveTo(pts[i % n][0] * k + dx, pts[i % n][1] * k + dy, q[0], q[1]); }
  p.closePath();
  return p;
}
/* contorno de pincel seco: el grosor sube y baja con la presión y se corta en dos lugares */
function contorno(g, pts, base, rnd, col, alfa) {
  const n = pts.length, fase = rnd() * 6, corte1 = Math.floor(rnd() * n), corte2 = (corte1 + Math.floor(n * (0.4 + rnd() * 0.2))) % n;
  g.strokeStyle = col || TINTA; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const d1 = (i - corte1 + n) % n, d2 = (i - corte2 + n) % n;
    if (d1 < 2 || d2 < 1) continue;
    const pr = 0.55 + 0.45 * Math.sin(i * 0.31 + fase) * Math.sin(i * 0.13 + fase * 2) + 0.25 * (d1 < 6 ? (d1 - 2) / 4 - 1 : 0);
    g.globalAlpha = (alfa || 0.88) * (0.75 + 0.25 * rnd());
    g.lineWidth = Math.max(0.5, base * (0.45 + pr));
    const a = pts[i], b = pts[(i + 1) % n];
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  g.globalAlpha = 1;
}
/* la aguada: el borde corrido, el lavado con luz arriba a la izquierda y manchas parejas de pigmento */
function lavado(g, pts, r, col, col2, rnd, k) {
  k = k || 1;
  const p = caminoPts(pts, k);
  g.fillStyle = conAlfa(col, 0.16); g.fill(caminoPts(pts, k * 1.07, r * 0.03, r * 0.04));
  const gr = g.createRadialGradient(-r * 0.38 * k, -r * 0.42 * k, r * 0.05, 0, 0, r * 1.2 * k);
  gr.addColorStop(0, mezclar(col, PAPEL, 0.5)); gr.addColorStop(0.5, col); gr.addColorStop(1, col2);
  g.fillStyle = gr; g.fill(p);
  g.save(); g.clip(p);
  for (let i = 0; i < 7; i++) {
    const x = (rnd() - 0.5) * r * 1.6 * k, y = (rnd() - 0.5) * r * 1.6 * k, rr = r * (0.3 + rnd() * 0.5) * k;
    const m = g.createRadialGradient(x, y, 0, x, y, rr);
    m.addColorStop(0, rnd() < 0.5 ? conAlfa(col2, 0.22) : 'rgba(239,229,207,0.16)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // el toque de pincel seco que deja ver el papel
  g.strokeStyle = 'rgba(244,236,218,0.42)'; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { g.lineWidth = r * (0.05 + i * 0.025) * k; g.beginPath(); g.arc(0, 0, r * (0.62 - i * 0.07) * k, Math.PI * 1.08 + i * 0.05, Math.PI * 1.42 + i * 0.03); g.stroke(); }
  g.restore();
}
function hoja(g, x, y, largo, ang, col) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(largo * 0.5, -largo * 0.42, largo, 0); p.quadraticCurveTo(largo * 0.5, largo * 0.3, 0, 0);
  g.fillStyle = col; g.fill(p);
  g.fillStyle = 'rgba(239,229,207,0.25)'; g.beginPath(); g.ellipse(largo * 0.45, -largo * 0.08, largo * 0.3, largo * 0.06, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = TINTA; g.globalAlpha = 0.7; g.lineWidth = 0.8; g.beginPath(); g.moveTo(largo * 0.05, 0); g.lineTo(largo * 0.85, -largo * 0.02); g.stroke(); g.globalAlpha = 1;
  g.restore();
}
function trazo(g, pts, w, col, alfa) { g.strokeStyle = col; g.globalAlpha = alfa == null ? 1 : alfa; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.globalAlpha = 1; }
function puntitos(g, pts, r, n, col, tam, rnd, clipP) {
  g.save(); if (clipP) g.clip(clipP); g.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, tam * (0.6 + rnd() * 0.6), 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/* ------------------------------------------------------------ la piel */
const DETALLES = {
  sandia(g, f, r, pts, rnd) {
    const p = caminoPts(pts); g.save(); g.clip(p);
    for (let k = -3; k <= 3; k++) {
      const x0 = k * r * 0.34, l = [];
      for (let y = -r; y <= r; y += r * 0.18) l.push([x0 + Math.sin(y * 0.3 + k) * r * 0.08 + (rnd() - 0.5) * 3, y]);
      trazo(g, l, r * 0.13, f.piel2, 0.55);
    }
    g.restore();
  },
  naranja(g, f, r, pts, rnd) { puntitos(g, pts, r, 70, conAlfa(f.piel2, 0.35), 0.7, rnd, caminoPts(pts)); g.fillStyle = '#4c5a1c'; g.beginPath(); g.arc(r * 0.05, -r * 0.92, r * 0.09, 0, Math.PI * 2); g.fill(); hoja(g, r * 0.05, -r * 0.92, r * 0.7, -0.5, '#4f7a2a'); },
  manzana(g, f, r) { trazo(g, [[0, -r * 0.72], [r * 0.06, -r * 1.05], [r * 0.16, -r * 1.25]], r * 0.1, '#4a2e16'); hoja(g, r * 0.12, -r * 1.05, r * 0.66, -0.35, '#4f7a2a'); },
  limon(g, f, r, pts, rnd) { puntitos(g, pts, r * 1.1, 50, conAlfa(f.piel2, 0.3), 0.6, rnd, caminoPts(pts)); },
  kiwi(g, f, r, pts, rnd) {
    const p = caminoPts(pts); g.save(); g.clip(p); g.strokeStyle = 'rgba(40,24,8,0.4)'; g.lineWidth = 0.7;
    for (let i = 0; i < 110; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 1.1, x = Math.cos(a) * d, y = Math.sin(a) * d; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + rnd() * 3); g.stroke(); }
    g.restore();
  },
  durazno(g, f, r) {
    const m = g.createRadialGradient(r * 0.35, r * 0.1, 0, r * 0.35, r * 0.1, r * 0.8); m.addColorStop(0, 'rgba(200,60,50,0.45)'); m.addColorStop(1, 'rgba(200,60,50,0)');
    g.fillStyle = m; g.fillRect(-r, -r, r * 2, r * 2);
    trazo(g, [[-r * 0.05, -r * 0.8], [-r * 0.22, -r * 0.2], [-r * 0.12, r * 0.5], [r * 0.08, r * 0.85]], r * 0.07, '#8e3a26', 0.55);
    hoja(g, 0, -r * 0.82, r * 0.72, -0.9, '#557a2c');
  },
  frutilla(g, f, r, pts, rnd) {
    g.fillStyle = '#f2d878';
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.85, x = Math.cos(a) * d * 0.9, y = Math.sin(a) * d + r * 0.05; g.beginPath(); g.ellipse(x, y, 0.9, 1.5, 0, 0, Math.PI * 2); g.fill(); }
    for (const a of [Math.PI * 0.95, Math.PI * 0.72, -Math.PI / 2, Math.PI * 0.28, Math.PI * 0.05]) hoja(g, 0, -r * 0.8, r * 0.58, a, '#3f7a2a');
    trazo(g, [[0, -r * 0.85], [r * 0.05, -r * 1.2]], r * 0.1, '#3f6a22');
  },
  cereza(g, f, r) { trazo(g, [[0, -r * 0.75], [r * 0.15, -r * 1.2], [r * 0.45, -r * 1.42]], r * 0.11, '#4a3216'); hoja(g, r * 0.4, -r * 1.38, r * 0.8, 0.25, '#4f7a2a'); },
  higo(g, f, r, pts) {
    const p = caminoPts(pts); g.save(); g.clip(p);
    for (let k = -2; k <= 2; k++) trazo(g, [[k * r * 0.3, -r * 1.1], [k * r * 0.42, 0], [k * r * 0.3, r]], r * 0.08, f.piel2, 0.35);
    g.restore();
    trazo(g, [[0, -r * 0.95], [0, -r * 1.2]], r * 0.16, '#3a4a1a');
  },
  platano(g, f, r) {
    g.fillStyle = '#4a3216';
    g.beginPath(); g.arc(-r * 1.22, r * 0.36, r * 0.08, 0, Math.PI * 2); g.fill();
    trazo(g, [[r * 1.18, r * 0.32], [r * 1.36, r * 0.18]], r * 0.12, '#4a3216');
    const l = []; for (let i = 0; i <= 10; i++) { const s = (i / 10) * 1.6 - 0.8; l.push([s * r * 1.22, -r * 0.25 + s * s * r * 0.6 + r * 0.02]); }
    trazo(g, l, r * 0.05, f.piel2, 0.45);
  },
  bomba(g, f, r) {
    // la cruz roja que avisa y la mecha
    trazo(g, [[-r * 0.38, -r * 0.38], [r * 0.4, r * 0.4]], r * 0.17, BERMELLON, 0.92);
    trazo(g, [[r * 0.38, -r * 0.4], [-r * 0.4, r * 0.38]], r * 0.15, BERMELLON, 0.92);
    g.fillStyle = '#6a625a'; g.save(); g.translate(r * 0.42, -r * 0.82); g.rotate(0.6); g.fillRect(-r * 0.2, -r * 0.14, r * 0.4, r * 0.28); g.restore();
    trazo(g, [[r * 0.5, -r * 0.9], [r * 0.62, -r * 1.12], [r * 0.56, -r * 1.3]], r * 0.07, '#7a5a32');
  },
};

/* ----------------------------------------------------------- el corte */
const PULPA = {
  sandia(g, f, r, pts, rnd) {
    g.fillStyle = TINTA;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, d = r * (0.42 + rnd() * 0.18); g.save(); g.translate(Math.cos(a) * d * 1.1, Math.sin(a) * d * 0.88); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 2.6, 1.4, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  },
  naranja(g, f, r) {
    g.strokeStyle = 'rgba(255,240,210,0.75)'; g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); g.stroke(); }
    g.fillStyle = '#fff3d8'; g.beginPath(); g.arc(0, 0, r * 0.1, 0, Math.PI * 2); g.fill();
  },
  manzana(g, f, r) {
    g.strokeStyle = 'rgba(160,120,60,0.45)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, r * 0.02, r * 0.32, r * 0.42, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#5a3418'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.ellipse(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16, 1.2, 2.4, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
  },
  limon(g, f, r) { PULPA.naranja(g, f, r * 0.95); },
  kiwi(g, f, r, pts, rnd) {
    const c = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.42); c.addColorStop(0, '#eef2c8'); c.addColorStop(0.7, '#d2e48c'); c.addColorStop(1, 'rgba(210,228,140,0)');
    g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, r * 0.5, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(240,248,210,0.35)'; g.lineWidth = 0.8;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.25); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.68); g.stroke(); }
    g.fillStyle = TINTA; for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2 + rnd() * 0.1, d = r * (0.44 + rnd() * 0.08); g.beginPath(); g.ellipse(Math.cos(a) * d * 1.1, Math.sin(a) * d * 0.88, 1.1, 0.7, a, 0, Math.PI * 2); g.fill(); }
  },
  durazno(g, f, r, pts, rnd) {
    const c = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.5); c.addColorStop(0, 'rgba(200,70,40,0.5)'); c.addColorStop(1, 'rgba(200,70,40,0)'); g.fillStyle = c; g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = '#7e3a22'; g.beginPath(); g.ellipse(0, 0, r * 0.3, r * 0.4, 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,16,8,0.6)'; g.lineWidth = 0.8; for (let i = 0; i < 8; i++) { const y = (rnd() - 0.5) * r * 0.6; g.beginPath(); g.moveTo(-r * 0.2, y); g.lineTo(r * 0.2, y + (rnd() - 0.5) * 3); g.stroke(); }
  },
  frutilla(g, f, r) {
    const c = g.createRadialGradient(0, r * 0.05, 0, 0, r * 0.05, r * 0.55); c.addColorStop(0, '#fde2da'); c.addColorStop(1, 'rgba(253,226,218,0)'); g.fillStyle = c; g.fillRect(-r, -r, r * 2, r * 2);
    g.strokeStyle = 'rgba(253,226,218,0.6)'; g.lineWidth = 0.8; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); g.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.85); g.stroke(); }
  },
  cereza(g, f, r) { g.fillStyle = '#ead2a6'; g.beginPath(); g.ellipse(0, 0, r * 0.26, r * 0.32, 0, 0, Math.PI * 2); g.fill(); },
  higo(g, f, r, pts, rnd) {
    g.fillStyle = '#f2d89a';
    for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, d = r * (0.15 + Math.sqrt(rnd()) * 0.55); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.8, 0, Math.PI * 2); g.fill(); }
  },
  platano(g, f, r) { const l = []; for (let i = 0; i <= 10; i++) { const s = (i / 10) * 1.4 - 0.7; l.push([s * r * 1.22, -r * 0.25 + s * s * r * 0.6 + r * 0.02]); } trazo(g, l, 1.6, 'rgba(120,90,40,0.5)'); },
};

const cacheFruta = new Map();
function spriteFruta(tipo, corte) {
  const clave = tipo + (corte ? '·c' : '') + '|' + S;
  let c = cacheFruta.get(clave);
  if (c) return c;
  const f = FRUTAS[tipo], r = f.r, R = r * 1.55;
  let g;
  [c, g] = lienzoHD(R * 2, R * 2);
  g.translate(R, R);
  const rnd = rngSemilla(tipo.length * 977 + r * 13 + (corte ? 5 : 0)), pts = f.forma(r);
  if (!corte) {
    lavado(g, pts, r, f.piel, f.piel2, rnd);
    DETALLES[tipo](g, f, r, pts, rnd);
    contorno(g, pts, Math.max(1.2, r * 0.085), rnd);
  } else {
    // la cáscara, el blanco (si tiene) y la pulpa, cada capa un poco más adentro
    g.fillStyle = f.piel; g.fill(caminoPts(pts));
    if (f.anillo) { g.fillStyle = f.anillo; g.fill(caminoPts(pts, 0.91)); }
    lavado(g, pts, r, f.carne, f.carne2, rnd, f.anillo ? 0.83 : 0.9);
    g.save(); g.clip(caminoPts(pts, 0.9)); PULPA[tipo](g, f, r, pts, rnd); g.restore();
    contorno(g, pts, Math.max(1, r * 0.06), rnd, mezclar(f.piel2, '#000000', 0.3), 0.8);
  }
  c.R = R;
  cacheFruta.set(clave, c);
  return c;
}

/* la fruta entera, girada (los poderes llevan un aura de su color y su signo) */
function dibujarFruta(g, tipo, x, y, ang, esc, poder, t) {
  const sp = spriteFruta(tipo, false), R = sp.R * (esc || 1);
  if (poder) {
    const col = PODERES[poder], pul = 1 + Math.sin((t || 0) * 8) * 0.08;
    const a = g.createRadialGradient(x, y, R * 0.3, x, y, R * 1.25 * pul); a.addColorStop(0, conAlfa(col, 0.55)); a.addColorStop(1, conAlfa(col, 0));
    g.fillStyle = a; g.fillRect(x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
    g.strokeStyle = col; g.lineWidth = 2.2; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, R * 0.95 * pul, (t || 0) * 2, (t || 0) * 2 + Math.PI * 1.7); g.stroke(); g.globalAlpha = 1;
  }
  g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(sp, -R, -R, R * 2, R * 2); g.restore();
  if (poder) iconoPoder(g, poder, x, y + FRUTAS[tipo].r * 0.1, FRUTAS[tipo].r * 0.55);
}
function iconoPoder(g, poder, x, y, s) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(239,229,207,0.85)'; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill();
  g.strokeStyle = PODERES[poder]; g.fillStyle = PODERES[poder]; g.lineWidth = s * 0.22; g.lineCap = 'round';
  if (poder === 'hielo') { for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7); g.lineTo(-Math.cos(a) * s * 0.7, -Math.sin(a) * s * 0.7); g.stroke(); } }
  else if (poder === 'frenesi') { g.beginPath(); g.moveTo(s * 0.15, -s * 0.75); g.lineTo(-s * 0.35, s * 0.08); g.lineTo(s * 0.12, s * 0.05); g.lineTo(-s * 0.15, s * 0.75); g.stroke(); }
  else { g.font = 'bold ' + Math.round(s * 1.1) + 'px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×2', 0, s * 0.06); }
  g.restore();
}
/* media fruta: el corte (la pulpa) recortado por la línea del tajo */
function dibujarMitad(g, m) {
  const sp = spriteFruta(m.tipo, true), R = sp.R * (m.esc || 1);
  g.save(); g.translate(m.x, m.y); g.rotate(m.ang);
  g.beginPath(); if (m.lado) g.rect(-R, 0.6, R * 2, R); else g.rect(-R, -R, R * 2, R - 0.6); g.clip();
  g.rotate(m.off); g.drawImage(sp, -R, -R, R * 2, R * 2);
  g.restore();
}
function nuevaFruta(tipo, x, y, vx, vy, poder) {
  const f = FRUTAS[tipo];
  return { tipo, x, y, vx, vy, r: f.r, ang: Math.random() * 6.28, giro: azar(-3, 3), bomba: !!f.bomba, poder: poder || null, subio: false, vivo: true, t: 0 };
}
