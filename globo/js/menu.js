// El fondo de los menús: el cielo con nubes que se corren por capas según el
// dedo, globos que suben lejos, y el cartel GLOBO LIBRE colgado de tres
// globos que se hamaca: un péndulo con resorte que el dedo empuja (como el
// cartel de Cripta Neón). Los botones son HTML, encima.
import { dibujarFondo, dibujarGlobo, dibujarEscudo, cajaRedonda } from './dibujo.js';
import { TEMAS } from './temas.js';
import { azar, clamp, tono } from './util.js';

const LETRAS = ['#ff4d5e', '#ffc93c', '#2ecc71', '#3d8bff', '#9b5cff', '#ff9f43'];

// el cartel se arma una vez por tamaño (letras, borde y sombra)
let cartelC = null;
function cartel(ancho) {
  ancho = Math.round(ancho);
  if (cartelC && cartelC.ancho === ancho) return cartelC;
  const alto = Math.round(ancho * 0.46), m = Math.round(ancho * 0.04);
  const c = document.createElement('canvas'); c.width = ancho + m * 2; c.height = alto + m * 2;
  const g = c.getContext('2d'), borde = Math.max(3, ancho * 0.018), r = ancho * 0.07;
  // la tabla: sombra plana, borde oscuro, cara clara con una franja abajo
  g.fillStyle = 'rgba(20,24,50,0.25)'; cajaRedonda(g, m + ancho * 0.015, m + ancho * 0.03, ancho, alto, r); g.fill();
  g.fillStyle = '#1d2440'; cajaRedonda(g, m, m, ancho, alto, r); g.fill();
  g.fillStyle = '#e9dcc0'; cajaRedonda(g, m + borde, m + borde, ancho - 2 * borde, alto - 2 * borde, r - borde); g.fill();
  g.fillStyle = '#fff6e2'; cajaRedonda(g, m + borde, m + borde, ancho - 2 * borde, alto - 2 * borde - ancho * 0.03, r - borde); g.fill();
  // los clavitos de las esquinas
  g.fillStyle = '#c9b48f';
  for (const [x, y] of [[0.06, 0.13], [0.94, 0.13], [0.06, 0.87], [0.94, 0.87]]) { g.beginPath(); g.arc(m + ancho * x, m + alto * y, ancho * 0.012, 0, Math.PI * 2); g.fill(); }
  // las letras, cada una de un color, con su sombra plana y un borde oscuro
  const linea = (txt, y, px, desde) => {
    g.font = `900 ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    const anchos = [...txt].map((ch) => g.measureText(ch).width), sep = px * 0.04;
    const total = anchos.reduce((a, b) => a + b, 0) + sep * (txt.length - 1);
    let x = m + ancho / 2 - total / 2;
    [...txt].forEach((ch, i) => {
      const col = LETRAS[(i + desde) % LETRAS.length];
      g.lineJoin = 'round'; g.lineWidth = px * 0.16; g.strokeStyle = '#1d2440';
      g.strokeText(ch, x, y + px * 0.09); g.fillStyle = '#1d2440'; g.fillText(ch, x, y + px * 0.09);
      g.strokeText(ch, x, y); g.fillStyle = tono(col, -0.25); g.fillText(ch, x, y);
      g.fillStyle = col; g.fillText(ch, x, y - px * 0.035);
      x += anchos[i] + sep;
    });
  };
  linea('GLOBO', m + alto * 0.33, alto * 0.36, 0);
  linea('LIBRE', m + alto * 0.7, alto * 0.36, 3);
  c.ancho = ancho; c.margen = m; c.alto = alto;
  cartelC = c;
  return c;
}

export class FondoMenu {
  constructor() {
    this.t = 0; this.balanceo = 0; this.vel = 0;
    this.mx = 0; this.my = 0; this.dedoX = null; this.dedoY = null;
    const r = azar(3);
    this.lejanos = Array.from({ length: 7 }, (_, i) => ({ x: r(), y: r(), v: 0.02 + r() * 0.03, r: 5 + r() * 6, color: LETRAS[i % LETRAS.length], fase: r() * 6 }));
    this.arriba = 0;
  }
  // el dedo (o el mouse) sobre el fondo: empuja el cartel e inclina las capas
  mover(x, y, dx) { this.dedoX = x; this.dedoY = y; this.vel += dx * 0.004; }
  empujar(fuerza) { this.vel += fuerza; }
  pasar(dt, W, H) {
    this.t += dt;
    // un péndulo con resorte: vuelve al medio y se va frenando
    this.vel += (-this.balanceo * 7 - this.vel * 1.4) * dt;
    this.balanceo = clamp(this.balanceo + this.vel * dt, -0.5, 0.5);
    let ox = Math.sin(this.t * 0.45) * 0.3, oy = Math.cos(this.t * 0.33) * 0.2;
    if (this.dedoX !== null) { ox += clamp((this.dedoX / W) * 2 - 1, -1, 1) * 0.7; oy += clamp((this.dedoY / H) * 2 - 1, -1, 1) * 0.4; }
    this.mx += (ox - this.mx) * Math.min(1, dt * 3); this.my += (oy - this.my) * Math.min(1, dt * 3);
    this.arriba -= dt * 40;               // el cielo sube despacio (las nubes bajan)
    for (const b of this.lejanos) { b.y -= b.v * dt; if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); } }
  }

  // `zona`: dónde va el cartel {cx, y, ancho}; `jugador`: el globo y el escudo elegidos (o null)
  dibujar(g, W, H, u, { tema = TEMAS[0], zona, jugador = null } = {}) {
    const esc = Math.max(W, H) / 700;
    dibujarFondo(g, W, H, { esc, ox: this.mx * 20 * u, arriba: this.arriba + this.my * 30 }, { tema, avance: 0.3, t: this.t, suelo: false });
    // globos lejos que suben (chiquitos y claros: están lejos)
    g.globalAlpha = 0.5;
    for (const b of this.lejanos) dibujarGlobo(g, b.x * W + this.mx * 12 * u, b.y * H, b.r * u, { color: b.color }, this.t + b.fase, { hilo: b.r * 3 * u });
    g.globalAlpha = 1;
    if (jugador) {
      // el globo del jugador flota y el escudo le da vueltas
      const { x, y, pielGlobo, pielEscudo } = jugador, r = 26 * u;
      const bx = x + Math.sin(this.t * 0.9) * 8 * u + this.mx * 8 * u, by = y + Math.sin(this.t * 1.7) * 5 * u;
      dibujarGlobo(g, bx, by, r, pielGlobo, this.t, { hilo: 60 * u, inclina: Math.cos(this.t * 0.9) * 0.08 });
      const a = this.t * 1.3, ex = bx + Math.cos(a) * 58 * u, ey = by + Math.sin(a) * 22 * u - 6 * u;
      dibujarEscudo(g, ex, ey, 20 * u, pielEscudo, this.t);
    }
    if (zona) this.dibujarCartel(g, zona.cx + this.mx * 6 * u, zona.y, zona.ancho, u);
  }

  dibujarCartel(g, cx, y, ancho, u) {
    const c = cartel(ancho), ang = this.balanceo + Math.sin(this.t * 1.1) * 0.03;
    const cuelga = ancho * 0.42;                 // del cartel a los globos
    const px = cx, py = y - cuelga;              // el punto de donde cuelga todo
    // los tres globos que lo sostienen (se van un poco para el lado contrario al vaivén)
    const puntas = [-0.34, 0, 0.34].map((k, i) => {
      const lx = k * ancho, ly = cuelga;         // donde se ata el hilo, en el cartel (sin girar)
      const ax = px + Math.cos(ang) * lx - Math.sin(ang) * ly, ay = py + Math.sin(ang) * lx + Math.cos(ang) * ly;
      const gx = px + k * ancho * 1.25 - ang * 40 * u + Math.sin(this.t * 1.3 + i * 2) * 5 * u;
      const gy = py - (i === 1 ? 26 : 8) * u + Math.sin(this.t * 1.6 + i) * 4 * u;
      return { ax, ay, gx, gy, color: ['#ff4d5e', '#ffc93c', '#3d8bff'][i] };
    });
    g.strokeStyle = 'rgba(29,36,64,0.7)'; g.lineWidth = Math.max(1.5, 1.6 * u);
    for (const p of puntas) { g.beginPath(); g.moveTo(p.ax, p.ay); g.quadraticCurveTo((p.ax + p.gx) / 2 + 6 * u, (p.ay + p.gy) / 2, p.gx, p.gy + 30 * u); g.stroke(); }
    for (const p of puntas) dibujarGlobo(g, p.gx, p.gy, 24 * u, { color: p.color }, this.t, { hilo: 0, inclina: -ang * 0.6 });
    // el cartel, girado desde el punto de donde cuelga
    g.save();
    g.translate(px, py); g.rotate(ang);
    g.drawImage(c, -c.width / 2, cuelga - c.margen);
    g.restore();
  }
}
