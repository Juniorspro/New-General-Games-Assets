/* brillo/js/efectos.js — lo que flota: burbujas, destellos, gotitas.
   Las burbujas son el sello del Frutiger Aero: transparentes, con el borde
   tornasolado (un arco de colores que cambia con el ángulo), un reflejo
   blanco arriba y un puntito abajo. Se pintan hechas en varios tamaños y se
   dibujan con transparencia. Flotan a distintas profundidades (las de atrás,
   chicas y lentas; las de adelante, grandes, rápidas y un poco borrosas). */
import { lienzo2d, azar } from './pixel.js';

const TAU = Math.PI * 2;
/* una burbuja de radio r: borde tornasolado, reflejo, interior casi vacío */
function pintarBurbuja(r) {
  const T = Math.ceil(r * 2 + 2);
  const [c, g] = lienzo2d(T, T);
  const img = g.createImageData(T, T), d = img.data, m = T / 2;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const dx = x + 0.5 - m, dy = y + 0.5 - m, q = Math.hypot(dx, dy) / r;
    if (q > 1) continue;
    const a = Math.atan2(dy, dx);
    let R = 210, G = 240, B = 255, A = 0.06;               // adentro: un velo apenas
    if (q > 0.78) {
      /* el borde: tornasol (rosa → amarillo → verde → celeste según el ángulo) */
      const h = (a / TAU + 0.5 + q * 0.3) % 1;
      R = 190 + 65 * Math.cos(TAU * h); G = 200 + 55 * Math.cos(TAU * (h - 0.33)); B = 220 + 35 * Math.cos(TAU * (h - 0.66));
      A = 0.35 + (q - 0.78) * 2.2;
    }
    /* el reflejo de arriba a la izquierda: una media luna blanca */
    const rx = dx / r + 0.38, ry = dy / r + 0.42;
    if (rx * rx * 2.2 + ry * ry * 4 < 0.09) { R = G = B = 255; A = 0.95; }
    /* el puntito de abajo a la derecha */
    const px = dx / r - 0.42, py = dy / r - 0.5;
    if (px * px + py * py < 0.012) { R = G = B = 255; A = 0.8; }
    const k = (y * T + x) * 4;
    d[k] = R; d[k + 1] = G; d[k + 2] = B; d[k + 3] = Math.min(255, A * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
const HECHAS = new Map();
export function burbuja(r) { r = Math.max(2, Math.round(r)); if (!HECHAS.has(r)) HECHAS.set(r, pintarBurbuja(r)); return HECHAS.get(r); }

/* burbujas de adorno que suben por toda la pantalla */
export class BurbujasAmbiente {
  constructor(n, semilla, o = {}) {
    const al = azar(semilla);
    this.lista = [];
    for (let i = 0; i < n; i++) {
      const prof = al();                                   // 0 = lejos, 1 = adelante
      this.lista.push({ x: al() * 2000, y: al() * 400, prof, r: 2 + prof * prof * 13 + al() * 2, v: 6 + prof * 22 + al() * 6, fase: al() * TAU, f: 0.2 + prof * 1.1 });
    }
    this.subir = o.subir ?? 1;
  }
  /* capa: 'atras' (prof < 0.65) o 'frente' (prof ≥ 0.65) */
  dibujar(g, cam, t, w, h, capa) {
    for (const b of this.lista) {
      const adelante = b.prof >= 0.65;
      if ((capa === 'frente') !== adelante) continue;
      const per = w + 200, perY = h + 120;
      const y = (((b.y - t * b.v * this.subir - cam.y * b.f * 0.5) % perY) + perY) % perY - 60;
      const x = (((b.x - cam.x * b.f + Math.sin(t * 0.8 + b.fase) * 8) % per) + per) % per - 100;
      const img = burbuja(b.r * (1 + Math.sin(t * 2 + b.fase) * 0.04));
      g.globalAlpha = adelante ? 0.75 : 0.55 + b.prof * 0.4;
      g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
    }
    g.globalAlpha = 1;
  }
}

/* lo de adelante, en el borde de abajo, que se mueve más que el juego:
   pasto (colina), algas (arrecife), pasto de noche con puntas que brillan
   (aurora) o bollos de nube (cielo). La ciudad y el Plano no tienen. */
const FRENTE = {
  colina: { cols: ['#17601c', '#1d7322', '#23862a', '#145419'], punta: '#8ee05e', brillo: 'rgba(210,255,170,0.8)' },
  arrecife: { cols: ['#0f6b5a', '#138063', '#0c5a4d', '#0a4d44'], punta: '#ff9ccc', brillo: 'rgba(160,255,220,0.7)', largo: 1.4, ondas: true },
  aurora: { cols: ['#06302f', '#083b38', '#052523', '#041c1c'], punta: '#7dffc0', brillo: 'rgba(120,255,200,0.45)' },
};
export function pastoFrente(ancho, semilla, estilo = 'colina') {
  const al = azar(semilla), alto = 70;
  const [c, g] = lienzo2d(ancho, alto);
  if (estilo === 'cielo') {
    for (let i = 0; i < ancho / 24; i++) {
      const x = al() * ancho, r = 10 + al() * 22, y = alto - r * 0.4;
      for (const dx of [0, ancho, -ancho]) { g.fillStyle = '#e4f1fc'; g.beginPath(); g.arc(x + dx, y + 3, r, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + dx - r * 0.15, y, r * 0.9, 0, TAU); g.fill(); }
    }
    return c;
  }
  const E = FRENTE[estilo];
  if (!E) return null;
  for (let i = 0; i < ancho / 7; i++) {
    const x0 = al() * ancho, largo = (18 + al() * 46) * (E.largo || 1), curva = (al() - 0.5) * 26, gr = 3 + Math.floor(al() * 3);
    const col = E.cols[Math.floor(al() * 4)];
    for (let k = 0; k < largo; k++) {
      const t = k / largo, x = x0 + curva * t * t + (E.ondas ? Math.sin(k * 0.3 + i) * 2 : 0), y = alto - k;
      const w = Math.max(1, Math.round(gr * (1 - t * 0.8)));
      g.fillStyle = k > largo - 3 ? E.punta : col;
      for (const dx of [0, ancho, -ancho]) g.fillRect(Math.round(x + dx), Math.round(y), w, 1);
    }
    /* el brillo de la hoja */
    g.fillStyle = E.brillo;
    for (let k = Math.floor(largo * 0.3); k < largo * 0.7; k++) { const t = k / largo; for (const dx of [0, ancho, -ancho]) g.fillRect(Math.round(x0 + curva * t * t + dx), alto - k, 1, 1); }
  }
  return c;
}

/* destellos: estrellitas de 4 puntas que aparecen y se apagan */
export class Destellos {
  constructor() { this.lista = []; }
  soltar(x, y, n = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (o.v ?? 40) * (0.4 + Math.random() * 0.8);
      this.lista.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.sube ?? 10), vida: 0, dura: 0.5 + Math.random() * 0.5, col: o.col || '#ffffff', tam: o.tam ?? 2 });
    }
  }
  pasar(dt) {
    for (const d of this.lista) { d.vida += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - dt * 3; d.vy *= 1 - dt * 3; }
    this.lista = this.lista.filter((d) => d.vida < d.dura);
  }
  dibujar(g, cam) {
    for (const d of this.lista) {
      const k = 1 - d.vida / d.dura, s = Math.max(1, Math.round(d.tam * (0.5 + k)));
      const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
      g.globalAlpha = Math.min(1, k * 1.6); g.fillStyle = d.col;
      g.fillRect(x, y - s, 1, s * 2 + 1); g.fillRect(x - s, y, s * 2 + 1, 1);
    }
    g.globalAlpha = 1;
  }
}
