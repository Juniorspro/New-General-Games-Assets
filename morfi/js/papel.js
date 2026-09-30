// El kit de papel: lo que hace que todo parezca recortado de cartón y
// papel. Texturas (el grano del papel, el cartón corrugado, la hoja de
// cuaderno, el papel de regalo), recortes con su sombra suave (como si
// estuvieran pegados un poco por encima del fondo), cinta de papel, bordes
// rotos y garabatos de lápiz.
//
// Lo caro (texturas, sombras borrosas) se arma una vez y se guarda: por
// cuadro solo hay `drawImage`. El azar de las texturas va con semilla, así
// el cartón es siempre el mismo.
import { azar, tono } from './util.js';

export const P = {
  kraft: '#c99a5f', kraftOsc: '#9d7243', kraftClaro: '#e3bf88', kraftBorde: '#7a5530',
  tinta: '#3b2a1a', lapiz: '#6b5e52', blanco: '#fbf8f1', crema: '#f3ead6',
  azulHoja: '#8fb9e0', rojoMargen: '#e39292', rojo: '#e04a3a', amarillo: '#f5c542', verde: '#58b368', azul: '#3f7fd1', rosa: '#f08fb0',
  sombra: 'rgba(40,25,10,0.28)',
};

const cache = new Map();
export function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// El grano: puntitos claros y oscuros apenas visibles, en un patrón que se repite.
export function grano() {
  if (cache.has('grano')) return cache.get('grano');
  const c = lienzo(160, 160), g = c.getContext('2d'), r = azar(11), img = g.createImageData(160, 160);
  for (let i = 0; i < 160 * 160; i++) {
    const v = r(), k = i * 4;
    if (v < 0.5) { img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = Math.round(r() * 22); }
    else { img.data[k] = 255; img.data[k + 1] = 250; img.data[k + 2] = 235; img.data[k + 3] = Math.round(r() * 18); }
  }
  g.putImageData(img, 0, 0);
  // algunas fibras largas
  g.strokeStyle = 'rgba(80,50,20,0.06)'; g.lineWidth = 1;
  for (let k = 0; k < 40; k++) { const x = r() * 160, y = r() * 160, a = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke(); }
  cache.set('grano', c);
  return c;
}
let patronGrano = null;
export function pintarGrano(g, W, H, alfa = 1) {
  if (!patronGrano) patronGrano = g.createPattern(grano(), 'repeat');
  g.globalAlpha = alfa; g.fillStyle = patronGrano; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
}

// ── los fondos, uno por caja ────────────────────────────────────────────────
// El adentro de una caja de cartón: kraft con las canaletas del corrugado
// que se ven apenas, las esquinas dobladas, cinta y sellos.
function fondoCarton(w, h, esc) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(3);
  g.fillStyle = P.kraft; g.fillRect(0, 0, w, h);
  // manchas suaves de color (el cartón nunca es parejo)
  for (let k = 0; k < 18; k++) {
    const x = r() * w, y = r() * h, rr = (60 + r() * 160) * esc, gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, r() < 0.5 ? 'rgba(255,230,190,0.14)' : 'rgba(110,70,30,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  // las canaletas: franjas verticales finitas
  for (let x = 0; x < w; x += 7 * esc) { g.fillStyle = 'rgba(90,55,20,0.07)'; g.fillRect(x, 0, 2.2 * esc, h); g.fillStyle = 'rgba(255,235,200,0.06)'; g.fillRect(x + 3.2 * esc, 0, 1.4 * esc, h); }
  // los pliegues de las esquinas de la caja (el fondo y las paredes)
  const m = Math.min(w, h) * 0.07;
  g.fillStyle = 'rgba(80,50,20,0.16)';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(m, m); g.lineTo(m, h - m); g.lineTo(0, h); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(w, 0); g.lineTo(w - m, m); g.lineTo(w - m, h - m); g.lineTo(w, h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,235,200,0.10)';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w - m, m); g.lineTo(m, m); g.closePath(); g.fill();
  g.fillStyle = 'rgba(60,35,10,0.18)';
  g.beginPath(); g.moveTo(0, h); g.lineTo(w, h); g.lineTo(w - m, h - m); g.lineTo(m, h - m); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(60,35,10,0.25)'; g.lineWidth = 1.5 * esc;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(m, m); g.lineTo(w - m, m); g.lineTo(w, 0); g.moveTo(m, m); g.lineTo(m, h - m); g.lineTo(0, h); g.moveTo(w - m, m); g.lineTo(w - m, h - m); g.lineTo(w, h); g.moveTo(m, h - m); g.lineTo(w - m, h - m); g.stroke();
  // sellos de tinta y flechas de "este lado arriba"
  sello(g, w * 0.78, h * 0.18, 'FRÁGIL', 22 * esc, -0.18, 'rgba(190,40,30,0.32)');
  flechas(g, w * 0.16, h * 0.82, 26 * esc, 'rgba(60,35,10,0.28)');
  sello(g, w * 0.3, h * 0.55, '↑ ↑', 20 * esc, 0.08, 'rgba(60,35,10,0.18)');
  // un pedazo de cinta de embalar en una pared
  cinta(g, w * 0.5, m * 0.5, w * 0.35, 18 * esc, 0.02, 'rgba(214,178,120,0.75)');
  return c;
}
// Una hoja de cuaderno sobre la mesa: renglones celestes, margen rojo, los
// agujeros del anillado y garabatos.
function fondoCuaderno(w, h, esc) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(8);
  g.fillStyle = '#8a6a48'; g.fillRect(0, 0, w, h);                     // la mesa de madera, abajo de la hoja
  for (let y = 0; y < h; y += 26 * esc) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; g.fillRect(0, y, w, 13 * esc); }
  const m = Math.min(w, h) * 0.04, hx = m, hy = m * 0.6, hw = w - 2 * m, hh = h - m * 1.2;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 14 * esc; g.shadowOffsetY = 4 * esc;
  g.fillStyle = '#fdfbf4'; g.fillRect(hx, hy, hw, hh); g.restore();
  g.strokeStyle = P.azulHoja; g.lineWidth = 1.2 * esc;
  for (let y = hy + 60 * esc; y < hy + hh; y += 24 * esc) { g.beginPath(); g.moveTo(hx, y); g.lineTo(hx + hw, y); g.stroke(); }
  g.strokeStyle = P.rojoMargen; g.lineWidth = 1.6 * esc; g.beginPath(); g.moveTo(hx + 44 * esc, hy); g.lineTo(hx + 44 * esc, hy + hh); g.stroke();
  g.fillStyle = '#8a6a48';
  for (let y = hy + 40 * esc; y < hy + hh - 20 * esc; y += 70 * esc) { g.beginPath(); g.arc(hx + 18 * esc, y, 7 * esc, 0, Math.PI * 2); g.fill(); }
  // garabatos de lápiz
  g.strokeStyle = 'rgba(80,70,60,0.35)'; g.lineWidth = 1.6 * esc; g.lineCap = 'round';
  garabatoEspiral(g, hx + hw * 0.82, hy + hh * 0.12, 16 * esc);
  garabatoCorazon(g, hx + hw * 0.2, hy + hh * 0.9, 12 * esc);
  garabatoEstrella(g, hx + hw * 0.86, hy + hh * 0.72, 12 * esc);
  // una nota adhesiva amarilla, torcida
  g.save(); g.translate(hx + hw * 0.18, hy + hh * 0.2); g.rotate(-0.12);
  g.shadowColor = 'rgba(0,0,0,0.2)'; g.shadowBlur = 6 * esc; g.shadowOffsetY = 3 * esc;
  g.fillStyle = '#fbe57a'; g.fillRect(-26 * esc, -26 * esc, 52 * esc, 52 * esc); g.restore();
  return c;
}
// Papel de regalo: lunares y corazoncitos, con los dobleces del envoltorio.
// Sin estrellas en el dibujo (se confundían con las del nivel) y sin la
// cinta que lo cruzaba (parecía una pared).
function fondoRegalo(w, h, esc) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(21);
  g.fillStyle = '#d95f7a'; g.fillRect(0, 0, w, h);
  const paso = 34 * esc;
  for (let y = 0, f = 0; y < h + paso; y += paso, f++) for (let x = (f % 2) * paso / 2; x < w + paso; x += paso) {
    if ((f + Math.round(x / paso)) % 3 === 0) { g.fillStyle = 'rgba(255,240,245,0.3)'; corazon(g, x, y, 5 * esc); }
    else { g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x, y, 3.2 * esc, 0, Math.PI * 2); g.fill(); }
  }
  // los dobleces: bandas diagonales más claras y más oscuras
  for (let k = -2; k < 5; k++) {
    const x0 = k * w * 0.32 + r() * 40;
    const gr = g.createLinearGradient(x0, 0, x0 + w * 0.2, h * 0.2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(80,0,30,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  return c;
}
function corazon(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  g.fill();
}
const FONDOS = { carton: fondoCarton, cuaderno: fondoCuaderno, regalo: fondoRegalo };
export function fondo(id, w, h, esc) {
  const k = `fondo:${id}:${w}x${h}`;
  if (cache.has(k)) return cache.get(k);
  for (const kk of [...cache.keys()]) if (kk.startsWith(`fondo:${id}:`)) cache.delete(kk);
  const c = (FONDOS[id] || fondoCarton)(w, h, esc);
  // el grano de papel, horneado encima
  const g = c.getContext('2d'); g.fillStyle = g.createPattern(grano(), 'repeat'); g.fillRect(0, 0, w, h);
  cache.set(k, c);
  return c;
}

// ── recortes: un dibujo con su sombra suave, hecho una vez ──────────────────
// `dibujar(g)` dibuja centrado en (0, 0) dentro de un cuadro de w × h.
// Devuelve { img, sombra, w, h } en píxeles; se pinta con `pegar`.
export function recorte(clave, w, h, dibujar, { sombra = 0.3, borroso = 3 } = {}) {
  if (cache.has(clave)) return cache.get(clave);
  const m = Math.ceil(borroso * 3 + 4), c = lienzo(w + 2 * m, h + 2 * m), g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); dibujar(g);
  // la sombra: la misma figura en marrón oscuro, borrosa. Con shadowBlur y
  // la figura corrida afuera del lienzo (así queda solo la sombra): el
  // `filter` de canvas no está en todos los teléfonos.
  const s = lienzo(c.width, c.height), gs = s.getContext('2d');
  gs.shadowColor = `rgba(45,28,10,${sombra})`; gs.shadowBlur = borroso * 2; gs.shadowOffsetX = 4000;
  gs.drawImage(c, -4000, 0);
  const r = { img: c, sombra: s, w: c.width, h: c.height };
  cache.set(clave, r);
  return r;
}
// Pegar un recorte en (x, y), girado `ang`, con la sombra corrida hacia abajo
// a la derecha (la luz viene de arriba a la izquierda, siempre la misma).
export function pegar(g, r, x, y, { ang = 0, esc = 1, alto = 3, alfa = 1, sx = 1, sy = 1 } = {}) {
  g.globalAlpha = alfa;
  if (alto > 0) {
    g.save(); g.translate(x + alto * 0.6, y + alto); g.rotate(ang); g.scale(esc * sx, esc * sy);
    g.drawImage(r.sombra, -r.w / 2, -r.h / 2); g.restore();
  }
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(esc * sx, esc * sy);
  g.drawImage(r.img, -r.w / 2, -r.h / 2); g.restore();
  g.globalAlpha = 1;
}

// ── detalles ──────────────────────────────────────────────────────────────
// Cinta de papel: medio transparente, con las puntas cortadas en zigzag.
export function cinta(g, x, y, w, h, ang = 0, color = 'rgba(245,230,190,0.72)') {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  const dz = h / 4;
  g.moveTo(-w / 2, -h / 2);
  g.lineTo(w / 2, -h / 2);
  for (let k = 0; k <= 4; k++) g.lineTo(w / 2 + (k % 2 ? -dz * 0.6 : 0), -h / 2 + (k * h) / 4);
  g.lineTo(-w / 2, h / 2);
  for (let k = 4; k >= 0; k--) g.lineTo(-w / 2 + (k % 2 ? dz * 0.6 : 0), -h / 2 + (k * h) / 4);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.25);
  g.restore();
}
// Un rectángulo de papel con el borde roto (etiquetas, carteles).
export function papelRoto(g, x, y, w, h, color, semilla = 1, { dientes = 10, hondo = 3 } = {}) {
  const r = azar(semilla);
  g.beginPath();
  g.moveTo(x, y + r() * hondo);
  for (let k = 1; k <= dientes; k++) g.lineTo(x + (w * k) / dientes, y + r() * hondo);
  for (let k = 1; k <= 4; k++) g.lineTo(x + w - r() * hondo, y + (h * k) / 4);
  for (let k = dientes - 1; k >= 0; k--) g.lineTo(x + (w * k) / dientes, y + h - r() * hondo);
  for (let k = 3; k >= 1; k--) g.lineTo(x + r() * hondo, y + (h * k) / 4);
  g.closePath();
  g.fillStyle = color; g.fill();
}
export function sello(g, x, y, texto, px, ang, color) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.font = `900 ${Math.round(px)}px "Arial Black", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(texto).width + px * 0.8;
  g.strokeStyle = color; g.lineWidth = px * 0.12; g.strokeRect(-w / 2, -px * 0.75, w, px * 1.5);
  g.fillStyle = color; g.fillText(texto, 0, px * 0.05);
  g.restore();
}
function flechas(g, x, y, s, color) {
  g.fillStyle = color;
  for (const dx of [-s * 0.45, s * 0.45]) {
    g.beginPath(); g.moveTo(x + dx, y - s); g.lineTo(x + dx + s * 0.3, y - s * 0.55); g.lineTo(x + dx + s * 0.1, y - s * 0.55);
    g.lineTo(x + dx + s * 0.1, y); g.lineTo(x + dx - s * 0.1, y); g.lineTo(x + dx - s * 0.1, y - s * 0.55); g.lineTo(x + dx - s * 0.3, y - s * 0.55); g.closePath(); g.fill();
  }
  g.fillRect(x - s * 0.8, y + s * 0.15, s * 1.6, s * 0.12);
}
function garabatoEspiral(g, x, y, r) { g.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.2) { const rr = (a / (Math.PI * 6)) * r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.stroke(); }
function garabatoCorazon(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.6); g.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.4, y - s * 1.1, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.4, y - s * 1.1, x + s * 1.4, y - s * 0.2, x, y + s * 0.6); g.stroke(); }
function garabatoEstrella(g, x, y, s) { g.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } g.stroke(); }
export function estrellaDe(g, x, y, r, puntas = 5, adentro = 0.45) {
  g.beginPath();
  for (let i = 0; i < puntas * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / puntas, rr = i % 2 ? r * adentro : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
export function redondo(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
export { tono };
