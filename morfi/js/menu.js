// El fondo de los menús: la caja de cartón, el cartel MORFI de cartón
// corrugado colgado de dos hilos que se hamaca (un péndulo con resorte que
// el dedo empuja, como en Cripta y Globo) y, abajo del cartel, Morfi con un
// caramelo colgado que se puede cortar ahí mismo: lo come, festeja y baja
// otro. Los botones son HTML, encima.
import { fondo, pegar, pintarGrano, tono, P } from './papel.js';
import { Partida } from './partida.js';
import { dibujarNivel, alfiler, Efectos } from './dibujo.js';
import { Morfi } from './morfi.js';
import { clamp, azar } from './util.js';

const LETRAS = [['M', '#e8423a'], ['O', '#f5c542'], ['R', '#3f7fd1'], ['F', '#58b368'], ['I', '#ff6f9a']];
// la escena del caramelo del menú, en su propio tablero de 200 × 240 (angosto:
// acostado va en una columna y parado entre el cartel y los botones)
export const ESCENA = { w: 200, h: 240 };
const DEF_MENU = { caramelo: [100, 78], morfi: [100, 232], estrellas: [], hilos: [{ pin: [100, 8] }] };

// el cartel se arma una vez por tamaño y por idioma (el subtítulo cambia)
let cartelC = null;
function cartel(ancho, subtitulo) {
  ancho = Math.round(ancho);
  if (cartelC && cartelC.ancho === ancho && cartelC.sub === subtitulo) return cartelC;
  const alto = Math.round(ancho * 0.44), m = Math.round(ancho * 0.07);
  const c = document.createElement('canvas'); c.width = ancho + m * 2; c.height = alto + m * 2 + Math.round(ancho * 0.12);
  const g = c.getContext('2d'), r = azar(8), u = ancho / 400;
  // la tabla de cartón con los bordes rotos (a mano)
  const borde = [];
  const n = 26;
  for (let k = 0; k <= n; k++) borde.push([m + (ancho * k) / n, m + (r() - 0.5) * 5 * u]);
  for (let k = 0; k <= 8; k++) borde.push([m + ancho + (r() - 0.5) * 4 * u, m + (alto * k) / 8]);
  for (let k = n; k >= 0; k--) borde.push([m + (ancho * k) / n, m + alto + (r() - 0.5) * 6 * u]);
  for (let k = 8; k >= 0; k--) borde.push([m + (r() - 0.5) * 4 * u, m + (alto * k) / 8]);
  const forma = () => { g.beginPath(); borde.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  g.save(); g.shadowColor = 'rgba(40,20,5,0.4)'; g.shadowBlur = 14 * u; g.shadowOffsetY = 8 * u; forma(); g.fillStyle = P.kraft || '#c99a5f'; g.fill(); g.restore();
  g.save(); forma(); g.clip();
  const gr = g.createLinearGradient(0, m, 0, m + alto); gr.addColorStop(0, '#d8ab70'); gr.addColorStop(1, '#bb8b50');
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  // las canaletas del corrugado, suaves
  g.strokeStyle = 'rgba(110,70,30,0.12)'; g.lineWidth = 3 * u;
  for (let x = m; x < m + ancho; x += 9 * u) { g.beginPath(); g.moveTo(x, m); g.lineTo(x, m + alto); g.stroke(); }
  // el borde de abajo, roto, muestra la onda del corrugado
  g.strokeStyle = 'rgba(120,80,35,0.55)'; g.lineWidth = 2 * u; g.beginPath();
  for (let x = m; x <= m + ancho; x += 2) g.lineTo(x, m + alto - 6 * u + Math.sin(x / (4 * u)) * 2.5 * u);
  g.stroke();
  g.restore();
  // los agujeros de los hilos, arriba
  for (const k of [0.16, 0.84]) { g.fillStyle = '#3b2410'; g.beginPath(); g.arc(m + ancho * k, m + alto * 0.12, 4 * u, 0, Math.PI * 2); g.fill(); }
  // MORFI: letras recortadas de papel de colores, con su borde blanco y su sombra
  const px = alto * 0.62;
  g.font = `900 ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", sans-serif`;
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  const anchos = LETRAS.map(([l]) => g.measureText(l).width), sep = px * 0.02;
  const total = anchos.reduce((a, b) => a + b, 0) + sep * (LETRAS.length - 1);
  let x = m + ancho / 2 - total / 2;
  LETRAS.forEach(([l, col], i) => {
    const cx = x + anchos[i] / 2, cy = m + alto * 0.5 + (i % 2 ? -1 : 1) * alto * 0.025, ang = (r() - 0.5) * 0.16;
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.lineWidth = px * 0.2; g.strokeStyle = 'rgba(40,20,5,0.35)'; g.strokeText(l, 3 * u, 6 * u);
    g.strokeStyle = '#ffffff'; g.strokeText(l, 0, 0);
    g.fillStyle = tono(col, -0.18); g.fillText(l, 0, 2 * u);
    g.fillStyle = col; g.fillText(l, 0, 0);
    // un doblez de papel: la mitad de arriba un poco más clara
    g.save(); g.beginPath(); g.rect(-anchos[i], -px, anchos[i] * 2, px * 0.9); g.clip(); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillText(l, 0, 0); g.restore();
    g.restore();
    x += anchos[i] + sep;
  });
  // el subtítulo en una tira de papel blanco pegada con cinta, torcida
  if (subtitulo) {
    const fs = Math.round(alto * 0.17);
    g.font = `italic 700 ${fs}px Georgia, "Times New Roman", serif`;
    const tw = g.measureText(subtitulo).width + fs * 1.2, tx = m + ancho * 0.62, ty = m + alto + fs * 0.35;
    g.save(); g.translate(tx, ty); g.rotate(-0.05);
    g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(-tw / 2 + 2 * u, -fs * 0.75 + 3 * u, tw, fs * 1.5);
    g.fillStyle = '#fbf7ee'; g.fillRect(-tw / 2, -fs * 0.75, tw, fs * 1.5);
    g.fillStyle = '#27408b'; g.fillText(subtitulo, 0, fs * 0.05);
    g.fillStyle = 'rgba(250,240,200,0.75)'; g.save(); g.translate(-tw / 2, -fs * 0.6); g.rotate(-0.6); g.fillRect(-fs * 0.6, -fs * 0.25, fs * 1.2, fs * 0.5); g.restore();
    g.restore();
  }
  c.ancho = ancho; c.margen = m; c.alto = alto; c.sub = subtitulo;
  cartelC = c;
  return c;
}

export class FondoMenu {
  constructor({ alEvento = () => {} } = {}) {
    this.t = 0; this.balanceo = 0; this.vel = 0;
    this.alEvento = alEvento;
    this.morfi = new Morfi('kraft', 11);
    this.efectos = new Efectos();
    this.nueva(); this.espera = 0;
    this.cam = null;
  }
  nueva() { this.partida = new Partida(DEF_MENU); this.aparece = 0; }
  // el dedo sobre el fondo empuja el cartel
  mover(dx) { this.vel += dx * 0.004; }
  empujar(fuerza) { this.vel += fuerza; }
  // un tajo sobre el caramelo del menú (en píxeles del lienzo)
  cortar(x1, y1, x2, y2) {
    const c = this.cam;
    if (!c || this.partida.estado !== 'juego') return 0;
    const a = (x, y) => [(x - c.ox) / c.esc, (y - c.oy) / c.esc];
    return this.partida.cortar(...a(x1, y1), ...a(x2, y2));
  }
  pasar(dt) {
    this.t += dt; this.aparece += dt;
    this.vel += (-this.balanceo * 7 - this.vel * 1.4) * dt;
    this.balanceo = clamp(this.balanceo + this.vel * dt, -0.5, 0.5);
    const p = this.partida;
    p.avanzar(dt);
    for (const ev of p.sacarEventos()) {
      if (ev.tipo === 'comido') { this.morfi.comer(); this.efectos.papelitos(ev.x, ev.y, 16, ['#e8423a', '#f5c542', '#3f7fd1', '#58b368']); }
      if (ev.tipo === 'corte') this.efectos.papelitos(ev.x, ev.y, 5, ['#e2c48f', '#fff4dc'], { vel: 80, arriba: 20, tam: 2 });
      this.alEvento(ev);
    }
    // comido o caído: al rato baja otro caramelo
    if (p.estado !== 'juego' && p.tFin > 1.5) this.nueva();
    this.morfi.pasar(dt, { blanco: p.estado === 'juego' ? [p.x - p.morfi.x, p.y - p.morfi.y] : null, ganas: p.apetito() });
    this.efectos.pasar(dt);
  }

  // `zona`: dónde va el cartel {cx, y, ancho}; `escena`: el rectángulo del caramelo {x, y, w, h} (o null)
  dibujar(g, W, H, u, { zona, escena = null, pielMorfi = 'kraft', pielDulce = 'rojo', subtitulo = '' } = {}) {
    g.drawImage(fondo('carton', W, H, u), 0, 0);
    if (escena) {
      // con tope: en una pantalla grande, Morfi gigante tapaba medio menú
      const esc = Math.min(escena.w / ESCENA.w, escena.h / ESCENA.h, 2.4 * u);
      this.cam = { esc, ox: escena.x + (escena.w - ESCENA.w * esc) / 2, oy: escena.y + (escena.h - ESCENA.h * esc) / 2 };
      this.morfi.piel = pielMorfi;
      // el caramelo nuevo baja con un saltito
      const k = clamp(this.aparece / 0.35, 0, 1);
      g.save();
      if (k < 1) { g.globalAlpha = k; }
      dibujarNivel(g, W, H, this.partida, this.cam, { t: this.t, alfa: 1, morfi: this.morfi, pielCaramelo: pielDulce, efectos: this.efectos, dpr: u, sinFondo: true });
      g.restore();
    } else this.cam = null;
    if (zona) this.dibujarCartel(g, zona.cx, zona.y, zona.ancho, u, subtitulo);
    pintarGrano(g, W, H, 0.35);
  }

  dibujarCartel(g, cx, y, ancho, u, subtitulo) {
    const c = cartel(ancho, subtitulo), ang = this.balanceo + Math.sin(this.t * 1.1) * 0.025;
    const cuelga = ancho * 0.26;                 // de los alfileres al cartel
    const px = cx, py = y - cuelga;              // el punto de donde cuelga todo
    const e = ancho / 400;
    // los dos hilos, de los alfileres a los agujeros del cartel (girados con él)
    const puntas = [-0.34, 0.34].map((k) => {
      const lx = k * ancho, ly = cuelga + c.alto * 0.12;
      return { ax: px + Math.cos(ang) * lx - Math.sin(ang) * ly, ay: py + Math.sin(ang) * lx + Math.cos(ang) * ly, gx: px + k * ancho * 0.8, gy: py };
    });
    g.lineCap = 'round';
    for (const p of puntas) {
      g.strokeStyle = 'rgba(40,24,8,0.25)'; g.lineWidth = 3.4 * e; g.beginPath(); g.moveTo(p.gx + 2 * e, p.gy + 3 * e); g.lineTo(p.ax + 2 * e, p.ay + 3 * e); g.stroke();
      g.strokeStyle = '#e2c48f'; g.lineWidth = 3.2 * e; g.beginPath(); g.moveTo(p.gx, p.gy); g.lineTo(p.ax, p.ay); g.stroke();
      g.setLineDash([2.4 * e, 2.6 * e]); g.strokeStyle = '#b68e55'; g.stroke(); g.setLineDash([]);
    }
    g.save();
    g.translate(px, py); g.rotate(ang);
    g.drawImage(c, -c.width / 2, cuelga - c.margen);
    g.restore();
    for (const p of puntas) pegar(g, alfiler(e * 1.6, '#e04a3a'), p.gx, p.gy, { alto: 3 * e });
  }
}
