// El set de cada nivel, como un decorado de stop motion sobre la mesa del
// animador: el fondo pintado (borroso, está lejos de la cámara), la
// plastilina del nivel, los pinches, las tablas de palito de helado, los
// resortes, la puerta de madera y lo que el animador mueve.
//
// Tres sets: el taller (cielo pintado con nubes de algodón colgadas), la
// cocina (azulejos, una ventana y un reloj que hace tic a 12 cuadros) y el
// jardín de noche (fieltro azul, luna cosida, estrellas de papel y
// luciérnagas).
import { COLS, FILAS, rectCelda } from './partida.js';
import { contornos, vueltaOrganica, caminoDe, lienzo, guardado, olvidar, armarPieza, pegar, desenfocar, sombraDe, relieve, redondo } from './plastilina.js';
import { azar, hash, tono, rgba, mezcla, clamp, suave } from './util.js';

export const MUNDOS = {
  taller: { bloque: '#45a574', pinche: '#e4553f', tabla: '#e9c48c', bola: '#e4553f', bola2: '#f5d04a', tinta: '#2c4a3a' },
  cocina: { bloque: '#6f9de2', pinche: '#e4553f', tabla: '#e2ad72', bola: '#9b5a32', bola2: '#c98450', tinta: '#23385e' },
  noche: { bloque: '#c66fb2', pinche: '#ffd24a', tabla: '#c49466', bola: '#8fd0ff', bola2: '#ffffff', tinta: '#2a1d3f' },
};

// ── los fondos pintados ─────────────────────────────────────────────────────
function nube(g, x, y, s, color = '#ffffff') {
  // bolitas de algodón encimadas, con la panza más oscura
  const r = azar(Math.round(x * 13 + y * 7));
  g.fillStyle = color;
  const bolas = [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.25, 0.75], [-0.4, -0.35, 0.72], [0.45, -0.3, 0.68], [1.5, 0.45, 0.45], [-1.45, 0.5, 0.45]];
  for (const [dx, dy, k] of bolas) { g.beginPath(); g.arc(x + dx * s + (r() - 0.5) * s * 0.1, y + dy * s, k * s, 0, Math.PI * 2); g.fill(); }
}
function fondoTaller(w, h, ts) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(5);
  const cielo = g.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#79c0e3'); cielo.addColorStop(0.65, '#bfe3ee'); cielo.addColorStop(1, '#e9f3e6');
  g.fillStyle = cielo; g.fillRect(0, 0, w, h);
  // pinceladas: el cielo está pintado a mano sobre cartón
  for (let k = 0; k < 90; k++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,110,160,0.07)';
    g.lineWidth = ts * (0.15 + r() * 0.3); g.lineCap = 'round';
    const x = r() * w, y = r() * h, l = ts * (0.8 + r() * 2);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + (r() - 0.5) * ts * 0.4, x + l, y + (r() - 0.5) * ts * 0.3); g.stroke();
  }
  // el sol de cartón, arriba a la derecha
  const sx = w * 0.82, sy = h * 0.1, sr = ts * 1.1;
  g.fillStyle = '#ffd35c';
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.save(); g.translate(sx, sy); g.rotate(a); g.beginPath(); g.moveTo(sr * 1.05, -sr * 0.16); g.lineTo(sr * 1.55, 0); g.lineTo(sr * 1.05, sr * 0.16); g.fill(); g.restore(); }
  g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(sx - sr * 0.3, sy - sr * 0.3, sr * 0.45, 0, Math.PI * 2); g.fill();
  // nubes pintadas lejos
  for (let k = 0; k < 6; k++) nube(g, r() * w, h * (0.12 + r() * 0.5), ts * (0.5 + r() * 0.5), 'rgba(255,255,255,0.75)');
  // lomas pintadas abajo
  for (const [y0, col] of [[0.72, '#cfe6bd'], [0.8, '#bddcaa']]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += ts * 0.25) g.lineTo(x, h * y0 + Math.sin(x / (ts * 2.2) + y0 * 9) * ts * 0.5 + Math.sin(x / (ts * 0.9)) * ts * 0.12);
    g.lineTo(w, h); g.fill();
  }
  const borroso = desenfocar(c, Math.max(2, ts / 14));
  // adelante, nítidas: nubes de algodón colgadas de un hilo
  const gb = borroso.getContext('2d');
  for (const [fx, fy, s] of [[0.2, 0.2, 0.55], [0.68, 0.33, 0.45]]) {
    const x = w * fx, y = h * fy;
    gb.strokeStyle = 'rgba(255,255,255,0.7)'; gb.lineWidth = Math.max(1, ts * 0.03); gb.beginPath(); gb.moveTo(x, 0); gb.lineTo(x, y); gb.stroke();
    gb.save(); gb.shadowColor = 'rgba(40,70,100,0.25)'; gb.shadowBlur = ts * 0.3; gb.shadowOffsetX = ts * 0.12; gb.shadowOffsetY = ts * 0.18;
    nube(gb, x, y + s * ts * 0.6, s * ts, '#fbfbf7'); gb.restore();
    gb.save(); gb.globalAlpha = 0.5; nube(gb, x - s * ts * 0.1, y + s * ts * 0.45, s * ts * 0.7, '#ffffff'); gb.restore();
  }
  return borroso;
}
function fondoCocina(w, h, ts) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(9);
  g.fillStyle = '#f4e8d2'; g.fillRect(0, 0, w, h);
  // azulejos con su pastina
  const a = ts * 1.25;
  for (let y = 0; y < h; y += a) for (let x = 0; x < w; x += a) {
    g.fillStyle = (Math.floor(x / a) + Math.floor(y / a)) % 2 ? '#fbf3e3' : '#f6ead4';
    g.fillRect(x + ts * 0.04, y + ts * 0.04, a - ts * 0.08, a - ts * 0.08);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + ts * 0.08, y + ts * 0.08, a * 0.35, ts * 0.06);
  }
  // una guarda de azulejos celestes
  for (let x = 0; x < w; x += a) { g.fillStyle = '#9fc6e6'; g.fillRect(x + ts * 0.04, h * 0.42, a - ts * 0.08, a * 0.5); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + a / 2, h * 0.42 + a * 0.25, a * 0.13, 0, Math.PI * 2); g.fill(); }
  // la ventana con cortinas
  const vx = w * 0.12, vy = h * 0.08, vw = w * 0.42, vh = h * 0.26;
  g.fillStyle = '#8a5a36'; g.fillRect(vx - ts * 0.15, vy - ts * 0.15, vw + ts * 0.3, vh + ts * 0.3);
  const cielo = g.createLinearGradient(0, vy, 0, vy + vh); cielo.addColorStop(0, '#8fd0f0'); cielo.addColorStop(1, '#d8f0f5');
  g.fillStyle = cielo; g.fillRect(vx, vy, vw, vh);
  nube(g, vx + vw * 0.3, vy + vh * 0.35, ts * 0.35, 'rgba(255,255,255,0.9)');
  g.fillStyle = '#8a5a36'; g.fillRect(vx + vw / 2 - ts * 0.06, vy, ts * 0.12, vh); g.fillRect(vx, vy + vh / 2 - ts * 0.06, vw, ts * 0.12);
  for (const lado of [0, 1]) {
    g.fillStyle = '#e46b6b';
    const cx = lado ? vx + vw + ts * 0.1 : vx - ts * 0.1, dir = lado ? -1 : 1;
    g.beginPath(); g.moveTo(cx, vy - ts * 0.3); g.lineTo(cx + dir * vw * 0.28, vy - ts * 0.3);
    g.quadraticCurveTo(cx + dir * vw * 0.12, vy + vh * 0.5, cx + dir * vw * 0.2, vy + vh + ts * 0.2); g.lineTo(cx, vy + vh + ts * 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx + dir * vw * 0.09, vy + (vh * k) / 5, ts * 0.05, 0, Math.PI * 2); g.fill(); }
  }
  // un estante con frascos
  const ey = h * 0.62;
  g.fillStyle = '#9b6a42'; g.fillRect(w * 0.55, ey, w * 0.42, ts * 0.16);
  const frascos = [['#f2c14e', 0.6], ['#e46b6b', 0.72], ['#7cc68d', 0.84]];
  for (const [col, fx] of frascos) {
    const x = w * fx, fw = ts * 0.55, fh = ts * (0.7 + r() * 0.3);
    g.fillStyle = 'rgba(220,240,250,0.8)'; g.fillRect(x - fw / 2, ey - fh, fw, fh);
    g.fillStyle = col; g.fillRect(x - fw / 2 + ts * 0.05, ey - fh * 0.7, fw - ts * 0.1, fh * 0.66);
    g.fillStyle = '#c0392b'; g.fillRect(x - fw * 0.55, ey - fh - ts * 0.12, fw * 1.1, ts * 0.14);
  }
  return desenfocar(c, Math.max(2, ts / 14));
}
function fondoNoche(w, h, ts) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(13);
  const cielo = g.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#111a3e'); cielo.addColorStop(0.7, '#2c2d66'); cielo.addColorStop(1, '#4a3a78');
  g.fillStyle = cielo; g.fillRect(0, 0, w, h);
  // la trama del fieltro
  for (let k = 0; k < (w * h) / (ts * ts) * 3; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(r() * w, r() * h, ts * 0.06, ts * 0.02); }
  // estrellitas pintadas lejos
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,245,200,${0.3 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h * 0.7, ts * (0.02 + r() * 0.04), 0, Math.PI * 2); g.fill(); }
  // lomas con arbolitos de fieltro
  for (const [y0, col] of [[0.74, '#2a2f5a'], [0.82, '#20244a']]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += ts * 0.25) g.lineTo(x, h * y0 + Math.sin(x / (ts * 2) + y0 * 7) * ts * 0.45);
    g.lineTo(w, h); g.fill();
    for (let k = 0; k < 5; k++) {
      const x = r() * w, y = h * y0 + Math.sin(x / (ts * 2) + y0 * 7) * ts * 0.45, s = ts * (0.35 + r() * 0.3);
      g.beginPath(); g.moveTo(x, y - s * 2.2); g.lineTo(x + s * 0.7, y); g.lineTo(x - s * 0.7, y); g.fill();
    }
  }
  const borroso = desenfocar(c, Math.max(2, ts / 14));
  const gb = borroso.getContext('2d');
  // la luna cosida, colgada de un hilo
  const lx = w * 0.74, ly = h * 0.16, lr = ts * 0.95;
  gb.strokeStyle = 'rgba(255,255,255,0.45)'; gb.lineWidth = Math.max(1, ts * 0.03); gb.beginPath(); gb.moveTo(lx, 0); gb.lineTo(lx, ly - lr); gb.stroke();
  gb.save(); gb.shadowColor = 'rgba(255,240,180,0.45)'; gb.shadowBlur = ts * 0.8;
  gb.fillStyle = '#fff3c4'; gb.beginPath(); gb.arc(lx, ly, lr, 0, Math.PI * 2); gb.fill(); gb.restore();
  gb.fillStyle = '#2a2f66'; gb.beginPath(); gb.arc(lx + lr * 0.45, ly - lr * 0.2, lr * 0.85, 0, Math.PI * 2); gb.fill();
  // la costura
  gb.setLineDash([ts * 0.08, ts * 0.07]); gb.strokeStyle = 'rgba(160,120,60,0.7)'; gb.lineWidth = Math.max(1, ts * 0.025);
  gb.beginPath(); gb.arc(lx, ly, lr * 0.86, Math.PI * 0.55, Math.PI * 1.55); gb.stroke(); gb.setLineDash([]);
  return borroso;
}
const FONDOS = { taller: fondoTaller, cocina: fondoCocina, noche: fondoNoche };
export function fondo(mundo, ts) {
  const w = COLS * ts, h = FILAS * ts;
  return guardado(`fondo:${mundo}:${ts}`, () => { olvidar(`fondo:${mundo}:`); return FONDOS[mundo](w, h, ts); });
}

// ── lo que se mueve en el fondo, a 12 cuadros ──────────────────────────────
export function fondoVivo(g, mundo, ox, oy, ts, cuadro) {
  if (mundo === 'cocina') {
    // el reloj de pared: el segundero salta un cuadro por vez
    const x = ox + COLS * ts * 0.8, y = oy + FILAS * ts * 0.1, r = ts * 0.62;
    g.save();
    g.fillStyle = 'rgba(60,30,10,0.18)'; g.beginPath(); g.arc(x + ts * 0.08, y + ts * 0.12, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e46b6b'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, r * 0.8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineCap = 'round';
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.lineWidth = ts * 0.03; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66); g.lineTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74); g.stroke(); }
    const seg = Math.floor(cuadro / 12) % 60, am = (seg / 60) * Math.PI * 2 - Math.PI / 2;
    g.lineWidth = ts * 0.06; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(-2) * r * 0.4, y + Math.sin(-2) * r * 0.4); g.stroke();
    g.lineWidth = ts * 0.045; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(-0.6) * r * 0.58, y + Math.sin(-0.6) * r * 0.58); g.stroke();
    g.strokeStyle = '#d03a2a'; g.lineWidth = ts * 0.022; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(am) * r * 0.66, y + Math.sin(am) * r * 0.66); g.stroke();
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(x, y, ts * 0.05, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (mundo === 'noche') {
    // estrellas de papel colgadas que se hamacan y luciérnagas que van y vienen (de a cuadros)
    g.save();
    for (const [fx, largo, s, fase] of [[0.14, 0.12, 0.28, 0], [0.4, 0.2, 0.22, 1.7], [0.58, 0.08, 0.2, 3.1]]) {
      const x0 = ox + COLS * ts * fx, y1 = oy + FILAS * ts * largo, ang = Math.sin(cuadro * 0.18 + fase) * 0.12;
      const x = x0 + Math.sin(ang) * (y1 - oy), y = oy + Math.cos(ang) * (y1 - oy);
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = Math.max(1, ts * 0.025); g.beginPath(); g.moveTo(x0, oy); g.lineTo(x, y); g.stroke();
      g.fillStyle = '#ffe27a'; g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + ang + (k * Math.PI) / 5, rr = k % 2 ? s * ts * 0.45 : s * ts; g.lineTo(x + Math.cos(a) * rr, y + s * ts + Math.sin(a) * rr); }
      g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const fx = (hash(k, 3) + Math.sin(cuadro * 0.05 + k) * 0.04 + 1) % 1, fy = 0.35 + hash(k, 4) * 0.45 + Math.cos(cuadro * 0.07 + k * 2) * 0.03;
      const on = (Math.sin(cuadro * 0.3 + k * 1.9) + 1) / 2, x = ox + fx * COLS * ts, y = oy + fy * FILAS * ts;
      const gr = g.createRadialGradient(x, y, 0, x, y, ts * 0.35);
      gr.addColorStop(0, `rgba(230,255,140,${0.55 * on})`); gr.addColorStop(1, 'rgba(230,255,140,0)');
      g.fillStyle = gr; g.fillRect(x - ts * 0.35, y - ts * 0.35, ts * 0.7, ts * 0.7);
    }
    g.restore();
  }
}

// ── la plastilina del nivel ─────────────────────────────────────────────────
// lo sólido que queda quieto: los bloques fijos. Los grupos quietos que
// están pegados cuentan como "otra pieza": el borde va recto contra ellos.
function llenoFijo(p) { return (c, f) => p.m.fijo[f * COLS + c] === 1; }
function celdasDeGrupos(p, soloSolidos = true) {
  const s = new Set();
  for (const g of p.grupos) if (g.tipo === 'bloque' && (!soloSolidos || !g.falso || true)) for (const [c, f] of g.celdas) s.add(c + ',' + f);
  return s;
}
// ¿el lado (x0,y0)→(x1,y1) de una celda da contra otra pieza o contra la pared del set?
function pegadoA(otro) {
  return (x0, y0, x1, y1) => {
    // la celda de afuera: con lo lleno a la derecha, afuera es la izquierda del recorrido
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    const mx = Math.min(x0, x1), my = Math.min(y0, y1);
    let c, f;
    if (dx > 0) { c = mx; f = y0 - 1; }         // lado de arriba: afuera es la fila de arriba
    else if (dx < 0) { c = mx; f = y0; }        // lado de abajo
    else if (dy > 0) { c = x0; f = my; }        // lado derecho
    else { c = x0 - 1; f = my; }                // lado izquierdo
    if (c < 0 || c >= COLS || f < 0 || f >= FILAS) return true;
    return otro(c, f);
  };
}

// la capa fija del nivel en dos versiones (el hervor), con su sombra
export function capaFija(p, mundo, ts, v) {
  return guardado(`capa:${p.def.id}:${ts}:${v}`, () => {
    const col = MUNDOS[mundo].bloque, w = COLS * ts, h = FILAS * ts;
    const grupos = celdasDeGrupos(p);
    const vueltas = contornos(llenoFijo(p), COLS, FILAS).map((pts, i) => vueltaOrganica(pts, ts, { semilla: 100 + i * 17 + v * 991, ruido: 0.03, pegado: pegadoA((c, f) => grupos.has(c + ',' + f)) }));
    const pz = armarPieza(w, h, () => caminoDe(vueltas), col, { px: ts, semilla: 7 + v, borroso: ts * 0.12, oscuridad: 0.38, pintar: (g, m) => uniones(g, p, ts, m, col, v) });
    // las tablas y los pinches fijos, arriba de la plastilina (en la misma capa)
    const g = pz.img.getContext('2d');
    tablasFijas(g, p, mundo, ts, pz.m, v);
    for (const q of p.m.pinches) dibujarPinche(g, mundo, q.dir, (q.c) * ts + pz.m, (q.f) * ts + pz.m, ts, v, q.c * 3 + q.f);
    pz.sombra = sombraDe(pz.img, ts * 0.1, 0.5);
    return pz;
  });
}
// uniones entre pedazos de plastilina, cada tanto (las hay en todos lados,
// así la de un bloque que se va a caer no se nota)
function uniones(g, p, ts, m, col, v) {
  const r = azar(31 + v);
  g.save(); g.lineCap = 'round';
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS - 1; c++) {
    const a = p.m.fijo[f * COLS + c] === 1, b = p.m.fijo[f * COLS + c + 1] === 1;
    if (!a || !b || hash(c, f, 5) > 0.22) continue;
    const x = (c + 1) * ts + m + (r() - 0.5) * ts * 0.06;
    g.strokeStyle = rgba(tono(col, -0.45), 0.5); g.lineWidth = Math.max(1, ts * 0.03);
    g.beginPath(); g.moveTo(x, f * ts + m); g.quadraticCurveTo(x + (r() - 0.5) * ts * 0.12, (f + 0.5) * ts + m, x, (f + 1) * ts + m); g.stroke();
    g.strokeStyle = rgba(tono(col, 0.5), 0.35); g.beginPath(); g.moveTo(x + ts * 0.035, f * ts + m); g.lineTo(x + ts * 0.035, (f + 1) * ts + m); g.stroke();
  }
  g.restore();
}

// ── tablas de palito de helado ──────────────────────────────────────────────
function tabla(g, x, y, largo, ts, color, semilla) {
  const r = azar(semilla), alto = ts * 0.22;
  g.save();
  g.shadowColor = 'rgba(40,20,5,0.35)'; g.shadowBlur = ts * 0.1; g.shadowOffsetX = ts * 0.05; g.shadowOffsetY = ts * 0.1;
  g.fillStyle = color;
  redondo(g, x + ts * 0.02, y, largo - ts * 0.04, alto, alto / 2); g.fill();
  g.restore();
  g.save();
  redondo(g, x + ts * 0.02, y, largo - ts * 0.04, alto, alto / 2); g.clip();
  // la veta de la madera
  g.strokeStyle = rgba(tono(color, -0.3), 0.5); g.lineWidth = Math.max(1, ts * 0.018);
  for (let k = 0; k < 3; k++) {
    const yy = y + alto * (0.3 + k * 0.22);
    g.beginPath(); g.moveTo(x, yy);
    for (let xx = x; xx <= x + largo; xx += ts * 0.2) g.lineTo(xx, yy + Math.sin(xx / (ts * 0.4) + r() * 0.3 + k) * alto * 0.06);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y + alto * 0.08, largo, alto * 0.18);
  g.fillStyle = 'rgba(60,30,10,0.25)'; g.fillRect(x, y + alto * 0.78, largo, alto * 0.22);
  g.restore();
}
function tablasFijas(g, p, mundo, ts, m, v) {
  const col = MUNDOS[mundo].tabla;
  for (let f = 0; f < FILAS; f++) {
    let c = 0;
    while (c < COLS) {
      if (p.m.fijo[f * COLS + c] !== 2) { c++; continue; }
      let k = c; while (k < COLS && p.m.fijo[f * COLS + k] === 2) k++;
      tabla(g, c * ts + m, f * ts + m, (k - c) * ts, ts, col, f * 31 + c + v);
      c = k;
    }
  }
}

// ── pinches de plastilina: dos conos por celda ─────────────────────────────
function dibujarPinche(g, mundo, dir, x, y, ts, v, semilla) {
  const pz = pinche(mundo, ts, v, semilla % 3);
  g.save();
  g.translate(x + ts / 2, y + ts / 2);
  g.rotate({ arriba: 0, der: Math.PI / 2, abajo: Math.PI, izq: -Math.PI / 2 }[dir] || 0);
  pegar(g, pz, -ts / 2, -ts / 2, { alto: ts * 0.05 });
  g.restore();
}
function pinche(mundo, ts, v, var3) {
  return guardado(`pinche:${mundo}:${ts}:${v}:${var3}`, () => {
    const col = MUNDOS[mundo].pinche, r = azar(40 + v * 7 + var3 * 13);
    return armarPieza(ts, ts, () => {
      const p = new Path2D();
      for (const cx of [0.27, 0.73]) {
        const x = cx * ts + (r() - 0.5) * ts * 0.03, base = ts * 0.98, alto = ts * (0.47 + r() * 0.05), ancho = ts * 0.24;
        p.moveTo(x - ancho, base);
        p.quadraticCurveTo(x - ancho * 0.55, base - alto * 0.55, x - ts * 0.02, base - alto);
        p.quadraticCurveTo(x, base - alto - ts * 0.03, x + ts * 0.02, base - alto);
        p.quadraticCurveTo(x + ancho * 0.55, base - alto * 0.55, x + ancho, base);
        p.closePath();
      }
      return p;
    }, col, { px: ts * 0.55, semilla: var3 + v * 5, borroso: ts * 0.06, luz: 0.6, brillo: 0.45 });
  });
}

// ── la puerta de madera (y sus patas, cuando se escapa) ────────────────────
export function puertaSprite(ts, abierta = 0) {
  return guardado(`puerta:${ts}:${Math.round(abierta * 4)}`, () => {
    const w = ts * 0.92, h = ts * 1.5, c = lienzo(w + ts * 0.4, h + ts * 0.3), g = c.getContext('2d');
    const ox = ts * 0.2, oy = ts * 0.1;
    const arco = (g, x, y, ww, hh) => { g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x, y + ww / 2); g.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.closePath(); };
    // el marco de plastilina marrón
    g.save(); g.shadowColor = 'rgba(40,20,5,0.4)'; g.shadowBlur = ts * 0.12; g.shadowOffsetX = ts * 0.06; g.shadowOffsetY = ts * 0.08;
    g.fillStyle = '#7a4a2a'; arco(g, ox, oy, w, h); g.fill(); g.restore();
    // adentro, oscuro (se ve cuando abre)
    const ix = ox + ts * 0.1, iy = oy + ts * 0.1, iw = w - ts * 0.2, ih = h - ts * 0.1;
    g.fillStyle = '#1b0f08'; arco(g, ix, iy, iw, ih); g.fill();
    // la hoja de madera: se achica cuando abre (gira sobre la bisagra de la izquierda)
    const k = 1 - abierta * 0.85;
    g.save(); arco(g, ix, iy, iw, ih); g.clip();
    g.translate(ix, 0); g.scale(k, 1); g.translate(-ix, 0);
    const mad = g.createLinearGradient(ix, 0, ix + iw, 0); mad.addColorStop(0, '#c98a4e'); mad.addColorStop(1, '#a86a36');
    g.fillStyle = mad; g.fillRect(ix, iy, iw, ih);
    g.strokeStyle = 'rgba(80,40,15,0.5)'; g.lineWidth = Math.max(1, ts * 0.025);
    for (let x = ix + iw / 3; x < ix + iw - 1; x += iw / 3) { g.beginPath(); g.moveTo(x, iy); g.lineTo(x, iy + ih); g.stroke(); }
    // el picaporte de bronce
    g.fillStyle = '#e8b83a'; g.beginPath(); g.arc(ix + iw * 0.78, iy + ih * 0.6, ts * 0.07, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(ix + iw * 0.76, iy + ih * 0.58, ts * 0.025, 0, Math.PI * 2); g.fill();
    // la ventanita redonda
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(ix + iw / 2, iy + iw * 0.45, iw * 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a4a2a'; g.lineWidth = ts * 0.04; g.stroke();
    g.restore();
    relieve(c, (() => { const p2 = new Path2D(); p2.moveTo(ox, oy + h); p2.lineTo(ox, oy + w / 2); p2.arc(ox + w / 2, oy + w / 2, w / 2, Math.PI, 0); p2.lineTo(ox + w, oy + h); p2.closePath(); return p2; })(), '#9a6a40', ts * 0.9, { textura: 0.35, brillo: 0.2, luz: 0.3, sombra: 0.4, borde: 0.3 });
    c.ox = ox; c.oy = oy; c.pw = w; c.ph = h;
    return c;
  });
}
function puertaPintada(ts) {
  // la puerta falsa: pintada en el fondo, plana (ni relieve ni sombra propia)
  return guardado(`falsa:${ts}`, () => {
    const w = ts * 0.92, h = ts * 1.5, c = lienzo(w + ts * 0.2, h + ts * 0.2), g = c.getContext('2d'), ox = ts * 0.1, oy = ts * 0.1;
    g.fillStyle = '#8a5a34'; g.beginPath(); g.moveTo(ox, oy + h); g.lineTo(ox, oy + w / 2); g.arc(ox + w / 2, oy + w / 2, w / 2, Math.PI, 0); g.lineTo(ox + w, oy + h); g.fill();
    g.fillStyle = '#c28650'; g.fillRect(ox + ts * 0.1, oy + w * 0.5, w - ts * 0.2, h - w * 0.5);
    g.beginPath(); g.arc(ox + w / 2, oy + w / 2, w / 2 - ts * 0.1, Math.PI, 0); g.fill();
    g.fillStyle = '#e8b83a'; g.beginPath(); g.arc(ox + w * 0.78, oy + h * 0.62, ts * 0.06, 0, Math.PI * 2); g.fill();
    // pinceladas: está pintada, y se nota de cerca
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = ts * 0.05;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(ox + ts * 0.2, oy + h * (0.4 + k * 0.14)); g.lineTo(ox + w * 0.7, oy + h * (0.38 + k * 0.14)); g.stroke(); }
    c.ox = ox; c.oy = oy;
    return c;
  });
}
function patas(g, x, y, ts, cuadro) {
  // dos patitas de plastilina que caminan (4 poses, una por cuadro)
  const f = cuadro % 4, paso = [0, 1, 0, -1][f];
  g.save(); g.lineCap = 'round'; g.strokeStyle = '#e2894b'; g.lineWidth = ts * 0.1;
  for (const lado of [-1, 1]) {
    const dx = lado * ts * 0.18, s = lado * paso * ts * 0.12;
    g.beginPath(); g.moveTo(x + dx, y - ts * 0.05); g.lineTo(x + dx + s, y + ts * 0.18); g.stroke();
    g.fillStyle = '#b8612f'; g.beginPath(); g.ellipse(x + dx + s + ts * 0.05, y + ts * 0.22, ts * 0.09, ts * 0.05, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ── resortes ────────────────────────────────────────────────────────────────
function resorte(g, x, y, ts, apretado, mundo) {
  // x, y: la esquina de arriba a la izquierda de la celda
  const base = y + ts, alto = ts * (0.42 - apretado * 0.2), cx = x + ts / 2;
  g.save();
  g.shadowColor = 'rgba(40,20,5,0.35)'; g.shadowBlur = ts * 0.08; g.shadowOffsetX = ts * 0.04; g.shadowOffsetY = ts * 0.06;
  g.fillStyle = '#5b5f6a'; redondo(g, x + ts * 0.14, base - ts * 0.1, ts * 0.72, ts * 0.1, ts * 0.04); g.fill();
  g.shadowColor = 'transparent';
  // la espiral: un chorizo de plastilina en zigzag
  g.strokeStyle = '#c9ced8'; g.lineWidth = ts * 0.07; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  const vueltas = 4;
  for (let k = 0; k <= vueltas * 2; k++) { const yy = base - ts * 0.1 - (alto - ts * 0.12) * (k / (vueltas * 2)); g.lineTo(cx + (k % 2 ? 1 : -1) * ts * 0.24, yy); }
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = ts * 0.025; g.stroke();
  // el almohadón de arriba
  const arriba = base - alto;
  g.fillStyle = mundo === 'noche' ? '#ffd24a' : '#e4553f';
  redondo(g, x + ts * 0.1, arriba - ts * 0.08, ts * 0.8, ts * 0.14, ts * 0.07); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + ts * 0.18, arriba - ts * 0.06, ts * 0.5, ts * 0.03);
  g.restore();
}

// ── los grupos (lo que el animador mueve) ───────────────────────────────────
export function spriteGrupo(p, gr, mundo, ts, v) {
  return guardado(`grupo:${p.def.id}:${gr.id}:${ts}:${v}`, () => {
    const col = MUNDOS[mundo].bloque, cel = new Set(gr.celdas.map(([c, f]) => c + ',' + f));
    const ancho = (gr.c1 - gr.c0) * ts, alto = (gr.f1 - gr.f0) * ts;
    if (gr.tipo === 'pinches') {
      const c = lienzo(ancho + ts, alto + ts), g = c.getContext('2d');
      for (const [cc, ff] of gr.celdas) dibujarPinche(g, mundo, gr.dir, (cc - gr.c0) * ts + ts / 2, (ff - gr.f0) * ts + ts / 2, ts, v, cc * 3 + ff);
      return { img: c, sombra: null, m: ts / 2, w: c.width, h: c.height };
    }
    if (gr.tipo === 'tabla') {
      const c = lienzo(ancho + ts, alto + ts), g = c.getContext('2d');
      const filas = new Map();
      for (const [cc, ff] of gr.celdas) { if (!filas.has(ff)) filas.set(ff, []); filas.get(ff).push(cc); }
      for (const [ff, cs] of filas) { cs.sort((a, b) => a - b); tabla(g, (cs[0] - gr.c0) * ts + ts / 2, (ff - gr.f0) * ts + ts / 2, (cs[cs.length - 1] - cs[0] + 1) * ts, ts, MUNDOS[mundo].tabla, ff * 31 + cs[0] + v); }
      return { img: c, sombra: null, m: ts / 2, w: c.width, h: c.height };
    }
    // un bloque: su contorno, recto donde toca lo fijo (quieto, parece parte del piso)
    const otro = (c, f) => p.m.fijo[f * COLS + c] === 1 || p.grupos.some((o) => o !== gr && o.tipo === 'bloque' && o.celdas.some(([a, b]) => a === c && b === f));
    const vueltas = contornos((c, f) => cel.has(c + ',' + f), COLS, FILAS).map((pts, i) => vueltaOrganica(pts, ts, { semilla: 300 + gr.id.charCodeAt(0) * 13 + i + v * 577, ruido: 0.03, pegado: pegadoA(otro) }));
    return armarPieza(ancho, alto, () => caminoDe(vueltas, -gr.c0 * ts, -gr.f0 * ts), col, { px: ts, semilla: gr.id.charCodeAt(0) + v, borroso: ts * 0.12, oscuridad: 0.38 });
  });
}
function bolaSprite(mundo, ts) {
  return guardado(`bola:${mundo}:${ts}`, () => {
    const M = MUNDOS[mundo], d = ts * 0.8;
    return armarPieza(d, d, () => { const p = new Path2D(); p.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); return p; }, M.bola, {
      px: d, semilla: 5, borroso: ts * 0.08,
      // una espiral de otro color (así se ve que rueda)
      pintar: (g, m) => { g.save(); g.translate(m + d / 2, m + d / 2); g.strokeStyle = M.bola2; g.lineWidth = d * 0.14; g.lineCap = 'round'; g.beginPath(); for (let a = 0; a < Math.PI * 3.2; a += 0.2) g.lineTo(Math.cos(a) * a * d * 0.045, Math.sin(a) * a * d * 0.045); g.stroke(); g.restore(); },
    });
  });
}

// ── dibujar el nivel ─────────────────────────────────────────────────────────
// cam: { x, y, ts } (dónde empieza el escenario y cuánto mide una celda, en
// píxeles del lienzo); cuadro: el número de cuadro de 12 por segundo.
export function dibujarNivel(g, p, cam, { mundo, cuadro, hervor = cuadro, resortes = null }) {
  const { ts } = cam, ox = Math.round(cam.x), oy = Math.round(cam.y), v = hervor % 2;
  g.drawImage(fondo(mundo, ts), ox, oy);
  fondoVivo(g, mundo, ox, oy, ts, cuadro);
  for (const f of p.falsas) { const c = puertaPintada(ts); g.drawImage(c, ox + (f.x - 0.46) * ts - c.ox, oy + (f.y - 1.5) * ts - c.oy); }
  // la capa fija con su sombra
  const capa = capaFija(p, mundo, ts, v);
  pegar(g, capa, ox, oy, { alto: ts * 0.13 });
  // los resortes fijos (se aprietan cuando alguien rebota)
  for (const r of p.m.resortes) resorte(g, ox + r.c * ts, oy + r.f * ts, ts, resortes?.get(`${r.c},${r.f}`) || 0, mundo);
  // los grupos, donde estén
  for (const gr of p.grupos) {
    if (!gr.visible) continue;
    const sp = spriteGrupo(p, gr, mundo, ts, v);
    let dx = gr.ox * ts, dy = gr.oy * ts;
    // el que está por caerse tiembla (un cuadro para cada lado)
    if (gr.tiembla > p.T) dx += (cuadro % 2 ? 1 : -1) * ts * 0.04;
    const x = ox + gr.c0 * ts + dx, y = oy + gr.f0 * ts + dy;
    if (gr.tipo === 'pinches' && gr.k < 1) {
      // saliendo del piso: se asoman de a poco (recortados en su celda)
      g.save();
      g.beginPath(); for (const [c, f] of gr.celdas) g.rect(ox + c * ts + dx - ts * 0.1, oy + f * ts + dy - ts * 0.1, ts * 1.2, ts * 1.2); g.clip();
      const falta = (1 - gr.k) * ts * 0.62, [ux, uy] = { arriba: [0, 1], abajo: [0, -1], izq: [1, 0], der: [-1, 0] }[gr.dir];
      g.drawImage(sp.img, x - sp.m + ux * falta, y - sp.m + uy * falta);
      g.restore();
    } else if (sp.sombra) pegar(g, sp, x, y, { alto: ts * 0.1 });
    else g.drawImage(sp.img, x - sp.m, y - sp.m);
    if (gr.tipo === 'resorte') for (const [c, f] of gr.celdas) resorte(g, ox + (c + gr.ox) * ts, oy + (f + gr.oy) * ts, ts, resortes?.get(`${gr.id}`) || 0, mundo);
  }
  // la puerta (con patas si se escapa caminando)
  const pu = p.puerta;
  if (!pu.oculta) {
    const abierta = p.estado === 'gano' ? clamp(p.tFin / 0.25, 0, 1) * (1 - clamp((p.tFin - 0.75) / 0.2, 0, 1)) : 0;
    const c = puertaSprite(ts, abierta);
    let x = ox + (pu.x - 0.46) * ts - c.ox, y = oy + (pu.y - 1.5) * ts - c.oy;
    if (pu.patas) { y -= ts * 0.22; patas(g, ox + pu.x * ts, oy + pu.y * ts - ts * 0.22, ts, cuadro); }
    // la que apareció de un salto: un cuadro más grande
    if (p.T - pu.salto < 0.17) { g.save(); g.translate(ox + pu.x * ts, oy + pu.y * ts); g.scale(1.15, 0.85); g.translate(-(ox + pu.x * ts), -(oy + pu.y * ts)); g.drawImage(c, x, y); g.restore(); }
    else g.drawImage(c, x, y);
  }
  // las bolas que ruedan
  for (const b of p.bolas) {
    const sp = bolaSprite(mundo, ts), x = ox + b.x * ts, y = oy + b.y * ts;
    g.drawImage(sp.sombra, x - sp.w / 2 + ts * 0.06, y - sp.h / 2 + ts * 0.09);
    g.save(); g.translate(x, y); g.rotate(b.giro); g.drawImage(sp.img, -sp.w / 2, -sp.h / 2); g.restore();
  }
}

// las notas del animador: papelitos con letra de birome, pegados con cinta
export function dibujarNotas(g, p, cam, tr, cuadro) {
  const { ts } = cam;
  for (const n of p.notas) {
    const edad = p.T - n.desde, k = clamp(edad / 0.17, 0, 1), sale = clamp((n.hasta - p.T) / 0.2, 0, 1);
    const x = cam.x + (n.en ? n.en[0] : COLS / 2) * ts, y = cam.y + (n.en ? n.en[1] : 2.2) * ts;
    const texto = tr(n.texto), fs = Math.round(ts * 0.36);
    g.save();
    g.font = `700 ${fs}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive`;
    const w = Math.min(g.measureText(texto).width + ts * 0.6, COLS * ts * 0.9), h = fs * 1.8;
    g.translate(x, y); g.rotate(-0.05 + (hash(n.desde * 100 | 0) - 0.5) * 0.08);
    // entra de a cuadros: grande y enseguida en su tamaño
    const e = k < 1 ? 1.25 : 1; g.scale(e * sale, e * sale);
    g.fillStyle = 'rgba(40,20,5,0.3)'; g.fillRect(-w / 2 + ts * 0.06, -h / 2 + ts * 0.08, w, h);
    g.fillStyle = '#fff8dc'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(250,235,180,0.8)'; g.save(); g.translate(0, -h / 2); g.rotate(0.06); g.fillRect(-ts * 0.45, -ts * 0.1, ts * 0.9, ts * 0.22); g.restore();
    g.fillStyle = '#27408b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto, 0, fs * 0.08, w - ts * 0.3);
    g.restore();
  }
}
export { tono, mezcla };
