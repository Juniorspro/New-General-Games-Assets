// El dibujo de la arena: fondo, borde, comida y víboras. Todo sale de
// sprites que se hornean una vez por color (una bolita con luz y sombra, un
// halo) y después solo se copian: dibujar degradés por cuadro es lo que hace
// lento un juego así en el teléfono.
import { pintarFondo } from './fondos.js';
import { colorDe } from './pieles.js';

const bolas = new Map(), halos = new Map(), sombras = new Map();
const TAM = 64;

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const mezcla = ([r, g, b], f) => `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
const aclarar = ([r, g, b], f) => `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;

// Una bolita del cuerpo: luz arriba a la izquierda, borde oscuro.
export function bola(color) {
  let c = bolas.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = TAM;
  const g = c.getContext('2d'), k = rgb(color), m = TAM / 2;
  const gr = g.createRadialGradient(m * 0.72, m * 0.62, m * 0.08, m, m, m);
  gr.addColorStop(0, aclarar(k, 0.55)); gr.addColorStop(0.35, color); gr.addColorStop(0.85, mezcla(k, 0.62)); gr.addColorStop(1, mezcla(k, 0.35));
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, m - 0.5, 0, Math.PI * 2); g.fill();
  bolas.set(color, c);
  return c;
}
// El halo de la comida y del turbo (se suma con 'lighter').
export function halo(color) {
  let c = halos.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = TAM;
  const g = c.getContext('2d'), [r, gg, b] = rgb(color), m = TAM / 2;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, `rgba(255,255,255,0.95)`); gr.addColorStop(0.12, `rgba(${r},${gg},${b},0.95)`);
  gr.addColorStop(0.35, `rgba(${r},${gg},${b},0.35)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, TAM, TAM);
  halos.set(color, c);
  return c;
}
function sombra() {
  let c = sombras.get('s');
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = TAM;
  const g = c.getContext('2d'), m = TAM / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, TAM, TAM);
  sombras.set('s', c);
  return c;
}

// De mundo a pantalla.
const aPantalla = (cam, W, H, x, y) => [(x - cam.x) * cam.zoom + W / 2, (y - cam.y) * cam.zoom + H / 2];

export function dibujarArena(g, mundo, cam, W, H, { fondoId = 'colmena', calidad = 2, destacada = null, nombres = true, esc = 1 } = {}) {
  pintarFondo(g, fondoId, cam, W, H);
  // afuera de la arena: oscuro, y el borde que brilla rojo. Solo si se ve:
  // desde lejos, el círculo gigante se pinta igual y cuesta en el teléfono.
  const [ox, oy] = aPantalla(cam, W, H, 0, 0), R = mundo.radio * cam.zoom;
  if (Math.hypot(W / 2 - ox, H / 2 - oy) + Math.hypot(W, H) / 2 > R - 10 * cam.zoom) {
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.arc(ox, oy, R, 0, Math.PI * 2, true);
    g.fillStyle = 'rgba(0,0,0,0.62)'; g.fill();
    g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2);
    g.lineWidth = 14 * cam.zoom; g.strokeStyle = 'rgba(255,40,80,0.18)'; g.stroke();
    g.lineWidth = 4 * cam.zoom; g.strokeStyle = 'rgba(255,60,90,0.9)'; g.stroke();
    g.restore();
  }
  dibujarComida(g, mundo, cam, W, H);
  // las víboras: primero las demás, la del jugador arriba de todo
  for (const v of mundo.viboras) if (v.viva && v !== destacada) dibujarVibora(g, v, cam, W, H, mundo.t, calidad);
  if (destacada && destacada.viva) dibujarVibora(g, destacada, cam, W, H, mundo.t, calidad);
  if (nombres && cam.zoom > 0.32) for (const v of mundo.viboras) if (v.viva) nombre(g, v, cam, W, H, esc, v === destacada);
}

function dibujarComida(g, mundo, cam, W, H) {
  const mx = W / 2 / cam.zoom + 20, my = H / 2 / cam.zoom + 20;
  const x0 = cam.x - mx, x1 = cam.x + mx, y0 = cam.y - my, y1 = cam.y + my;
  const cel = 128, nc = mundo.nc;
  const c0 = Math.max(0, Math.floor((x0 + mundo.radio) / cel) + 1), c1 = Math.min(nc - 1, Math.floor((x1 + mundo.radio) / cel) + 1);
  const f0 = Math.max(0, Math.floor((y0 + mundo.radio) / cel) + 1), f1 = Math.min(nc - 1, Math.floor((y1 + mundo.radio) / cel) + 1);
  g.globalCompositeOperation = 'lighter';
  const t = mundo.t, z = cam.zoom, bx = W / 2 - cam.x * z, by = H / 2 - cam.y * z;
  for (let j = f0; j <= f1; j++) for (let i = c0; i <= c1; i++) for (const f of mundo.grilla[j * nc + i]) {
    if (!mundo.fvivo[f]) continue;
    const nace = Math.min(1, (t - mundo.fn[f]) / 0.35);
    const late = 1 + Math.sin(t * 4 + f * 1.7) * 0.18;
    const s = mundo.fr[f] * 4.2 * late * nace * z;
    if (s < 1) continue;
    g.drawImage(halo(mundo.colores[mundo.fc[f]]), mundo.fx[f] * z + bx - s / 2, mundo.fy[f] * z + by - s / 2, s, s);
  }
  g.globalCompositeOperation = 'source-over';
}

// Las bolitas que se ven, de la cola a la cabeza, en un solo arreglo que se
// reusa (x, y, k): uno nuevo por bolita y por cuadro es basura para el teléfono.
let PTS = new Float32Array(3 * 4096);

export function dibujarVibora(g, v, cam, W, H, t, calidad = 2) {
  const r = v.radio(), R = r * cam.zoom, salto = v.salto();
  const margen = R * 2, z = cam.zoom, bx = W / 2 - cam.x * z, by = H / 2 - cam.y * z;
  if (PTS.length < 3 * (v.n / salto + 2)) PTS = new Float32Array(3 * Math.ceil(v.n / salto + 64));
  let n = 0;
  for (let k = Math.floor((v.n - 1) / salto) * salto; k >= 0; k -= salto) {
    const j = v.i(k), sx = v.px[j] * z + bx, sy = v.py[j] * z + by;
    if (sx < -margen || sy < -margen || sx > W + margen || sy > H + margen) continue;
    PTS[n * 3] = sx; PTS[n * 3 + 1] = sy; PTS[n * 3 + 2] = k; n++;
  }
  const hx = v.x * z + bx, hy = v.y * z + by;
  // la sombra (en calidad alta, una cada dos bolitas: igual se ve pareja) y
  // el brillo del turbo, abajo del cuerpo
  if (calidad >= 2) { const sm = sombra(), d = R * 2.2; for (let i = 0; i < n; i += 2) g.drawImage(sm, PTS[i * 3] - R * 0.85, PTS[i * 3 + 1] - R * 0.75, d, d); }
  if (v.turbo) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const k = PTS[i * 3 + 2], f = 0.55 + 0.45 * Math.sin(t * 18 - k * 0.12), s = R * 3.4 * f;
      g.drawImage(halo(colorDe(v.piel, Math.floor(k / salto))), PTS[i * 3] - s / 2, PTS[i * 3 + 1] - s / 2, s, s);
    }
    g.globalCompositeOperation = 'source-over';
  }
  for (let i = 0; i < n; i++) g.drawImage(bola(colorDe(v.piel, Math.floor(PTS[i * 3 + 2] / salto))), PTS[i * 3] - R, PTS[i * 3 + 1] - R, R * 2, R * 2);
  // la cabeza y los ojos (miran hacia donde quiere ir)
  g.drawImage(bola(colorDe(v.piel, 0)), hx - R * 1.05, hy - R * 1.05, R * 2.1, R * 2.1);
  const mira = v.angObj;
  for (const lado of [-1, 1]) {
    const a = v.ang + lado * 0.62, ex = hx + Math.cos(a) * R * 0.5, ey = hy + Math.sin(a) * R * 0.5;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex, ey, R * 0.34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#101018'; g.beginPath(); g.arc(ex + Math.cos(mira) * R * 0.14, ey + Math.sin(mira) * R * 0.14, R * 0.19, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex + Math.cos(mira) * R * 0.14 - R * 0.06, ey + Math.sin(mira) * R * 0.14 - R * 0.07, R * 0.06, 0, Math.PI * 2); g.fill();
  }
}

// Cada nombre se escribe una vez en un lienzo chico y después se copia:
// escribir texto (con su borde) por cuadro es de lo más caro en el teléfono.
const carteles = new Map();
function cartel(txt, esc, esMia) {
  const clave = `${esMia ? 1 : 0}|${esc}|${txt}`;
  let c = carteles.get(clave);
  if (c) return c;
  if (carteles.size > 300) carteles.clear();
  const fuente = `700 ${Math.round(12 * esc)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  c = document.createElement('canvas');
  let g = c.getContext('2d');
  g.font = fuente;
  const b = Math.ceil(3 * esc);
  c.width = Math.ceil(g.measureText(txt).width + b * 2 + 2); c.height = Math.ceil(16 * esc + b * 2);
  g = c.getContext('2d');
  g.font = fuente; g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.lineWidth = 3 * esc; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineJoin = 'round';
  g.strokeText(txt, c.width / 2, c.height - b);
  g.fillStyle = esMia ? '#ffffff' : 'rgba(255,255,255,0.75)'; g.fillText(txt, c.width / 2, c.height - b);
  carteles.set(clave, c);
  return c;
}
function nombre(g, v, cam, W, H, esc, esMia) {
  const [hx, hy] = aPantalla(cam, W, H, v.x, v.y), R = v.radio() * cam.zoom;
  if (hx < -80 || hy < -40 || hx > W + 80 || hy > H + 40) return;
  const c = cartel(v.nombre, esc, esMia);
  g.drawImage(c, Math.round(hx - c.width / 2), Math.round(hy - R - 3 * esc - c.height));
}
