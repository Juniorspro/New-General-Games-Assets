// El fondo de los menús: el set sobre la mesa del animador, con GRUMO en
// letras de plastilina colgadas de hilos que se hamacan (cada una es un
// péndulo con resorte; el dedo las empuja, como el cartel de Cripta y
// Globo) y Grumo parado en su tarima. Si se lo toca salta; cada tanto la
// mano del animador lo molesta (le da un empujoncito o lo levanta y lo
// deja de nuevo). Todo a 12 cuadros, como el juego. Los botones son HTML,
// encima.
import { Partida, COLS, FILAS } from './partida.js';
import { dibujarNivel } from './escenario.js';
import { Grumo } from './grumo.js';
import { dibujarManos } from './mano.js';
import { piezaTexto, pegar } from './plastilina.js';
import { clamp, hash } from './util.js';

const LETRAS = [['G', '#f28a2e'], ['R', '#f2c230'], ['U', '#48b06f'], ['M', '#4f95e8'], ['O', '#f394bd']];
export const DEF_MENU = {
  id: 'menu', puertaOculta: true,
  mapa: [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '....P.....',
    '...####...',
    '...####...',
    '..........',
    '#........D',
    '##########',
  ],
};

export class FondoMenu {
  constructor({ alEvento = () => {} } = {}) {
    this.t = 0; this.alEvento = alEvento;
    this.letras = LETRAS.map(() => ({ ang: 0, vel: 0 }));
    this.grumo = new Grumo();
    this.nueva();
    this.proximaMano = 5;
    this.gag = 0;
  }
  nueva() { this.p = new Partida(DEF_MENU); this.p.control.dir = 0; }
  // el dedo sobre el fondo empuja las letras (cada una un poco distinto)
  mover(dx) { this.letras.forEach((l, i) => { l.vel += dx * (0.004 + i * 0.0006); }); }
  tocar() {
    // tocar el set hace saltar a Grumo (un toque corto de salto)
    if (this.p.j.suelo && !this.p.j.agarrado) { this.p.control.salto = true; this.saltoHasta = this.p.T + 0.12; }
  }
  pasar(dt) {
    this.t += dt;
    for (const l of this.letras) { l.vel += (-l.ang * 9 - l.vel * 1.6) * dt; l.ang = clamp(l.ang + l.vel * dt, -0.6, 0.6); }
    const p = this.p;
    if (this.saltoHasta && p.T >= this.saltoHasta) { p.control.salto = false; this.saltoHasta = 0; }
    p.avanzar(dt);
    for (const ev of p.sacarEventos()) { this.grumo.evento(ev); this.alEvento(ev); }
    this.grumo.pasar(dt, p.j);
    // cada tanto la mano del animador lo molesta
    if (p.T > this.proximaMano && !p.manos.length && p.j.suelo) {
      const gag = this.gag++ % 3, T = p.T;
      if (gag === 0) p.ejecutar({ que: 'mano', lado: 'der', empuja: [-3.5, -7] }, T);
      else if (gag === 1) p.ejecutar({ que: 'mano', agarra: 'grumo', a: [0, -2.2], t: 0.9 }, T);
      else p.ejecutar({ que: 'mano', lado: 'izq', empuja: [3.5, -7] }, T);
      this.proximaMano = T + 9 + hash(this.gag) * 4;
    }
    // si por algo se fue del set, vuelve a empezar la escena
    if (p.estado !== 'juego') this.nueva();
  }
  // cam: dónde va el set ({x, y, ts}); `mundo`: qué set se ve
  dibujar(g, cam, { mundo = 'taller', piel = 'naranja', sombrero = 'nada', u = 1 } = {}) {
    const cuadro = Math.floor(this.t * 12), p = this.p, { ts } = cam;
    dibujarNivel(g, p, cam, { mundo, cuadro });
    this.grumo.piel = piel; this.grumo.sombrero = sombrero;
    this.grumo.dibujar(g, cam.x + p.j.x * ts, cam.y + p.j.y * ts, ts, cuadro, { escala: 1.5 });
    dibujarManos(g, p, cam, cuadro);
    this.dibujarTitulo(g, cam, cuadro);
  }
  // GRUMO colgado de hilos: la hamaca se ve de a cuadros (stop motion)
  dibujarTitulo(g, cam, cuadro) {
    const { ts } = cam, px = Math.round(ts * 1.55), sep = ts * 1.72, x0 = cam.x + (COLS * ts) / 2 - sep * 2;
    LETRAS.forEach(([l, col], i) => {
      const pz = piezaTexto(`letra:${l}:${px}`, l, px, col, { op: { px: px * 0.45, semilla: i * 5 } });
      // el ángulo de este cuadro: la hamaca, más un vaivén propio chiquito
      const q = cuadro / 12, ang = this.letras[i].ang + Math.sin(q * 1.3 + i * 1.7) * 0.035;
      const ax = x0 + i * sep, ay = cam.y, largo = ts * (1.2 + (i % 2) * 0.55 + (i === 2 ? 0.2 : 0));
      const cx = ax + Math.sin(ang) * largo, cy = ay + Math.cos(ang) * largo;
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1, ts * 0.035);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx, cy); g.stroke();
      g.save(); g.translate(cx, cy); g.rotate(ang);
      pegar(g, pz, -pz.ancho / 2, -pz.alto * 0.08, { alto: ts * 0.12 });
      g.restore();
    });
  }
}
