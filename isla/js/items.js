// Todo lo que se puede tener en la mano: con su nombre, rareza, precio, ícono
// pixel art (16×16, dibujado acá) y modelo 3D (armado acá). Nada viene de
// archivos.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { matGema } from './gemas.js';
import { geoRoca, geoCristales, mergeSimple } from './rocas.js';
import { t, idioma, locale } from './idioma.js';

// ── la tabla ────────────────────────────────────────────────────────────────
// tipo: material · gema · metal · raro · pez · comida · herramienta · bloque
const T = (nombre, tipo, estrellas, valor, extra = {}) => ({ nombre, tipo, estrellas, valor, pila: 64, ...extra });
export const ITEMS = {
  rama: T('Rama', 'material', 1, 2),
  piedra: T('Piedra', 'material', 1, 5),
  madera: T('Madera', 'material', 1, 8),
  fibra: T('Fibra', 'material', 1, 3),
  coco: T('Coco', 'comida', 1, 12, { comida: 22 }),
  carbon: T('Carbón', 'material', 1, 40),
  hierro: T('Hierro', 'metal', 2, 150, { color: 0xb9c1cc }),
  pirita: T('Pirita', 'metal', 1, 30, { color: 0xd9b44a, desc: 'El oro de los tontos: brilla igual, vale poco.' }),
  oro: T('Oro', 'metal', 4, 8400, { color: 0xffc62e }),
  cuarzo: T('Cuarzo', 'gema', 1, 120, { color: 0xf1f5ff }),
  citrino: T('Citrino', 'gema', 2, 450, { color: 0xffcf33 }),
  amatista: T('Amatista', 'gema', 3, 1900, { color: 0xb46cff }),
  esmeralda: T('Esmeralda', 'gema', 3, 2400, { color: 0x36e07a }),
  rubi: T('Rubí', 'gema', 3, 2800, { color: 0xff3048 }),
  zafiro: T('Zafiro', 'gema', 3, 2600, { color: 0x3a66ff }),
  lapislazuli: T('Lapislázuli', 'gema', 2, 900, { color: 0x2346d6, desc: 'Tenía que estar: está en Minecraft.' }),
  malaquita: T('Malaquita', 'gema', 2, 700, { color: 0x1db36a }),
  aguamarina: T('Fosfofilita', 'gema', 3, 3100, { color: 0x7ff2cf }),
  tanzanita: T('Tanzanita', 'gema', 4, 5500, { color: 0x6b4dff }),
  opalo: T('Ópalo', 'gema', 2, 1300, { color: 0xf4f2ff, mat: 'opalo' }),
  bismuto: T('Bismuto', 'gema', 3, 6200, { color: 0xc8a0ff, mat: 'bismuto' }),
  estrella: T('Estrella caída', 'raro', 4, 5000, { color: 0xffa21f, luz: [1.0, 0.62, 0.25, 9], desc: 'Da luz propia. Caen de noche.' }),
  cielo: T('Fragmento de cielo', 'raro', 4, 9000, { mat: 'cielo', desc: 'Literalmente un pedazo del cielo: siempre muestra el cielo, estés donde estés.' }),
  uranio: T('Uranio', 'raro', 4, 10000, { color: 0xb6ff3a, desc: 'Radiactivo, claro.' }),
  gravinita: T('Gravinita', 'raro', 5, 11600, { color: 0x6a4cff, desc: 'Deja ver el espacio-tiempo alrededor.' }),
  antimateria: T('Antimateria', 'raro', 5, 12000, { mat: 'antimateria', desc: 'Mirar adentro es mirar el universo.' }),
  quarks: T('Cúmulo de quarks', 'raro', 5, 12200, { desc: 'Partículas que aparecen y desaparecen.' }),
  atun: T('Atún', 'pez', 1, 100, { comida: 30, color: 0x7f9bb5, cocina: 'pescadoAsado' }),
  payaso: T('Pez payaso', 'pez', 2, 150, { comida: 15, color: 0xff7a1a, cocina: 'pescadoAsado' }),
  calamar: T('Calamar', 'pez', 2, 220, { comida: 20, color: 0xff9a6a, cocina: 'pescadoAsado' }),
  abisal: T('Pez abisal', 'pez', 3, 900, { comida: 25, color: 0x2a3050, cocina: 'pescadoAsado', desc: 'No debería estar tan cerca de la orilla. Es un juego.' }),
  botella: T('Botella con mensaje', 'raro', 2, 300, { color: 0x9fe8d0 }),
  moneda: T('Moneda antigua', 'raro', 3, 1200, { color: 0xffcf40 }),
  hachaPiedra: T('Hacha de piedra', 'herramienta', 1, 30, { pila: 1, herr: 'hacha', poder: 1, ritmo: 0.5 }),
  picoPiedra: T('Pico de piedra', 'herramienta', 1, 30, { pila: 1, herr: 'pico', poder: 1, ritmo: 0.5 }),
  pala: T('Pala', 'herramienta', 1, 40, { pila: 1, herr: 'pala', poder: 1, ritmo: 0.05 }),
  guadana: T('Guadaña', 'herramienta', 2, 60, { pila: 1, herr: 'guadana', poder: 1, ritmo: 0.4 }),
  cana: T('Caña de pescar', 'herramienta', 1, 50, { pila: 1, herr: 'cana', poder: 1, ritmo: 0.4 }),
  canaBuena: T('Caña dorada', 'herramienta', 3, 900, { pila: 1, herr: 'cana', poder: 2, ritmo: 0.4 }),
  farol: T('Farol', 'herramienta', 2, 120, { pila: 1, herr: 'farol', poder: 1, ritmo: 0.4, luz: [1.0, 0.78, 0.45, 10] }),
  picoHierro: T('Pico de hierro', 'herramienta', 2, 500, { pila: 1, herr: 'pico', poder: 2, ritmo: 0.38 }),
  hachaHierro: T('Hacha de hierro', 'herramienta', 2, 500, { pila: 1, herr: 'hacha', poder: 2, ritmo: 0.38 }),
  picoAmatista: T('Pico de amatista', 'herramienta', 4, 7000, { pila: 1, herr: 'pico', poder: 3, ritmo: 0.28 }),
  mesa: T('Mesa de trabajo', 'bloque', 1, 40, { pila: 8, bloque: 'mesa' }),
  cofre: T('Cofre', 'bloque', 1, 60, { pila: 8, bloque: 'cofre' }),
  bloqueMadera: T('Bloque de madera', 'bloque', 1, 5, { bloque: 'madera' }),
  tablon: T('Tablón', 'bloque', 1, 3, { bloque: 'tablon' }),
  bloquePiedra: T('Bloque de piedra', 'bloque', 1, 6, { bloque: 'piedra' }),
  farolPie: T('Farol de pie', 'bloque', 2, 180, { pila: 8, bloque: 'farolPie', luz: [1.0, 0.78, 0.45, 11] }),
  // ── armas: daño, alcance y ritmo del golpe ──
  espadaMadera: T('Espada de madera', 'herramienta', 1, 20, { pila: 1, herr: 'espada', poder: 1, dano: 4, alcance: 2.5, ritmo: 0.42 }),
  espadaPiedra: T('Espada de piedra', 'herramienta', 1, 45, { pila: 1, herr: 'espada', poder: 1, dano: 6, alcance: 2.6, ritmo: 0.42 }),
  espadaHierro: T('Espada de hierro', 'herramienta', 2, 600, { pila: 1, herr: 'espada', poder: 2, dano: 10, alcance: 2.7, ritmo: 0.38 }),
  espadaAmatista: T('Espada de amatista', 'herramienta', 4, 8000, { pila: 1, herr: 'espada', poder: 3, dano: 16, alcance: 2.9, ritmo: 0.32, desc: 'Corta dejando un rastro violeta.' }),
  lanza: T('Lanza', 'herramienta', 1, 60, { pila: 1, herr: 'lanza', poder: 1, dano: 7, alcance: 3.7, ritmo: 0.55, desc: 'Llega más lejos que una espada.' }),
  arco: T('Arco', 'herramienta', 2, 300, { pila: 1, herr: 'arco', poder: 1, dano: 11, ritmo: 0.3, desc: 'Mantené apretado para tensar. Usa flechas.' }),
  flecha: T('Flecha', 'material', 1, 6),
  // ── defensa: se pone con clic derecho ──
  petoCaparazon: T('Peto de caparazón', 'armadura', 2, 250, { pila: 1, defensa: 0.25, color: 0xe0643a }),
  petoHierro: T('Peto de hierro', 'armadura', 3, 900, { pila: 1, defensa: 0.45, color: 0xc9cfd8 }),
  // ── de los enemigos y de la cocina ──
  carneCangrejo: T('Carne de cangrejo', 'comida', 1, 20, { comida: 10, cocina: 'cangrejoAsado', color: 0xff8f6a }),
  cangrejoAsado: T('Cangrejo asado', 'comida', 2, 60, { comida: 32, cura: 10, color: 0xd9542a }),
  pescadoAsado: T('Pescado asado', 'comida', 2, 140, { comida: 40, cura: 12, color: 0xc98a45 }),
  caparazon: T('Caparazón', 'material', 1, 25, { color: 0xe0643a }),
  hueso: T('Hueso', 'material', 1, 15, { color: 0xf1ead8 }),
  pocion: T('Poción de vida', 'comida', 2, 300, { comida: 0, cura: 60, color: 0xff3a6a, desc: 'Del mercader. Cura casi todo.' }),
  mapaTesoro: T('Mapa del tesoro', 'raro', 3, 1500, { color: 0xe8d3a0, desc: 'Una X en una playa lejana. Hay que cavar con la pala.' }),
  corazonCristal: T('Corazón de cristal', 'raro', 5, 25000, { color: 0x5ff6ff, luz: [0.4, 0.9, 1.0, 8], desc: 'El cristal del faro. Lo tenía el guardián de la mina.' }),
  fogata: T('Fogata', 'bloque', 1, 30, { pila: 8, bloque: 'fogata', desc: 'Cocina y espanta a los esqueletos.' }),
};
// El nombre y la descripción se leen en el idioma elegido: el castellano de
// arriba es el original, las traducciones están en idioma.js ('it.' y 'd.').
for (const [id, it] of Object.entries(ITEMS)) {
  it.id = id;
  const nombre = it.nombre, desc = it.desc;
  Object.defineProperty(it, 'nombre', { get: () => (idioma() === 'es' ? nombre : t('it.' + id, null, nombre)), enumerable: true });
  if (desc) Object.defineProperty(it, 'desc', { get: () => (idioma() === 'es' ? desc : t('d.' + id, null, desc)), enumerable: true });
}

export const RECETAS = [
  { id: 'hachaPiedra', da: 1, pide: { rama: 2, piedra: 1 } },
  { id: 'picoPiedra', da: 1, pide: { rama: 2, piedra: 2 } },
  { id: 'mesa', da: 1, pide: { madera: 4 } },
  { id: 'pala', da: 1, pide: { madera: 2, piedra: 2 }, mesa: true },
  { id: 'guadana', da: 1, pide: { madera: 2, piedra: 2, fibra: 2 }, mesa: true },
  { id: 'cana', da: 1, pide: { madera: 3, fibra: 3 }, mesa: true },
  { id: 'cofre', da: 1, pide: { madera: 6 }, mesa: true },
  { id: 'bloqueMadera', da: 4, pide: { madera: 2 }, mesa: true },
  { id: 'tablon', da: 6, pide: { madera: 2 }, mesa: true },
  { id: 'bloquePiedra', da: 4, pide: { piedra: 4 }, mesa: true },
  { id: 'farol', da: 1, pide: { hierro: 1, carbon: 2, madera: 1 }, mesa: true },
  { id: 'farolPie', da: 1, pide: { farol: 1, madera: 2 }, mesa: true },
  { id: 'picoHierro', da: 1, pide: { madera: 2, hierro: 3 }, mesa: true },
  { id: 'hachaHierro', da: 1, pide: { madera: 2, hierro: 3 }, mesa: true },
  { id: 'canaBuena', da: 1, pide: { madera: 3, fibra: 3, oro: 1 }, mesa: true },
  { id: 'picoAmatista', da: 1, pide: { madera: 2, amatista: 3, hierro: 2 }, mesa: true },
  { id: 'espadaMadera', da: 1, pide: { madera: 2, rama: 1 } },
  { id: 'espadaPiedra', da: 1, pide: { piedra: 2, rama: 1 } },
  { id: 'lanza', da: 1, pide: { rama: 3, piedra: 1, fibra: 1 } },
  { id: 'fogata', da: 1, pide: { madera: 3, piedra: 3 } },
  { id: 'flecha', da: 4, pide: { rama: 1, piedra: 1, fibra: 1 } },
  { id: 'arco', da: 1, pide: { rama: 3, fibra: 3 }, mesa: true },
  { id: 'espadaHierro', da: 1, pide: { hierro: 2, madera: 1 }, mesa: true },
  { id: 'espadaAmatista', da: 1, pide: { amatista: 3, hierro: 1, madera: 1 }, mesa: true },
  { id: 'petoCaparazon', da: 1, pide: { caparazon: 5, fibra: 2 }, mesa: true },
  { id: 'petoHierro', da: 1, pide: { hierro: 5, fibra: 2 }, mesa: true },
];

export const COLOR_ESTRELLAS = ['#8a8f98', '#5fe06a', '#5ab8ff', '#4f6bff', '#c36bff', '#ffb52e'];

// ── íconos 16×16 ───────────────────────────────────────────────────────────
const aRGB = (c) => (typeof c === 'number' ? [(c >> 16) & 255, (c >> 8) & 255, c & 255] : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
const aHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const tono = (c, k) => aHex(aRGB(c).map((v) => (k > 1 ? v + (255 - v) * (k - 1) : v * k)));

class Pix {
  constructor() { this.p = new Array(256).fill(null); }
  px(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < 16 && y < 16) this.p[y * 16 + x] = c; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  linea(x0, y0, x1, y1, c, grosor = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      for (let g = 0; g < grosor; g++) this.px(Math.round(x + (g % 2)), Math.round(y + (g > 1 ? 1 : 0)), c);
    }
  }
  circulo(cx, cy, r, c) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.px(x, y, c); }
  poli(pts, c) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let dentro = false; const X = x + 0.5, Y = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
      if (dentro) this.px(x, y, c);
    }
  }
  lienzo(borde = '#15181f') {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    const out = this.p.slice();
    if (borde) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (this.p[y * 16 + x]) continue;
      const v = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < 16 && Y < 16 && this.p[Y * 16 + X]; });
      if (v) out[y * 16 + x] = borde;
    }
    for (let i = 0; i < 256; i++) if (out[i]) { g.fillStyle = out[i]; g.fillRect(i % 16, (i / 16) | 0, 1, 1); }
    return c;
  }
}

function icGema(p, col, rayas = null) {
  p.poli([[2, 14], [4, 11], [12, 11], [14, 14]], '#6b6f7a');
  p.rect(4, 13, 8, 1, '#50535c');
  const c = col, cl = tono(col, 1.5), co = tono(col, 0.65);
  p.poli([[6, 12], [5, 5], [7.5, 2], [10, 5], [9.5, 12]], c);
  p.poli([[7.5, 2], [10, 5], [9.5, 12], [8, 12]], co);
  p.poli([[3, 12], [2.5, 7], [4.5, 5.5], [6, 8], [6, 12]], c);
  p.poli([[10, 12], [10.5, 7.5], [12.5, 6], [13.5, 9], [12.5, 12]], co);
  p.linea(6, 5, 6, 10, cl); p.px(7, 3, '#ffffff'); p.px(3, 8, cl);
  if (rayas) for (const [x, y] of [[7, 7], [5, 10], [9, 9], [11, 8]]) p.px(x, y, rayas);
}
function icPepita(p, col) {
  p.poli([[3, 11], [4, 6], [8, 4], [12, 5], [13, 10], [10, 13], [5, 13]], col);
  p.poli([[8, 13], [13, 10], [12, 7], [10, 11]], tono(col, 0.7));
  p.rect(5, 6, 2, 1, tono(col, 1.6)); p.px(6, 7, '#ffffff');
}
function icPez(p, cuerpo, aleta, rayas) {
  p.poli([[2, 8], [5, 5], [10, 5], [13, 8], [10, 11], [5, 11]], cuerpo);
  p.poli([[12, 8], [15, 5], [15, 11]], aleta);
  p.rect(4, 9, 7, 2, tono(cuerpo, 0.75));
  if (rayas) { p.rect(6, 5, 1, 6, rayas); p.rect(9, 5, 1, 6, rayas); }
  p.px(4, 7, '#ffffff'); p.px(4, 7, '#101010');
}
function icEspada(p, hoja, filo) {
  p.linea(4, 12, 13, 3, hoja, 2); p.linea(5, 12, 13, 4, filo);
  p.linea(2, 10, 6, 14, '#5b3413', 2); p.linea(1, 15, 3, 13, '#8a5a2b', 2);
}
function icPeto(p, c, luz) {
  p.poli([[3, 3], [6, 2], [8, 4], [10, 2], [13, 3], [13, 13], [3, 13]], c);
  p.rect(5, 5, 2, 6, luz); p.rect(3, 13, 10, 1, '#3a3d45');
}
function icMango(p, x0 = 3, y0 = 14, x1 = 11, y1 = 5) { p.linea(x0, y0, x1, y1, '#8a5a2b', 2); p.linea(x0, y0, x1 - 1, y1 + 1, '#b37a3f'); }
function icCubo(p, arriba, lado, frente) {
  p.poli([[2, 5], [8, 2], [14, 5], [8, 8]], arriba);
  p.poli([[2, 5], [8, 8], [8, 15], [2, 12]], lado);
  p.poli([[8, 8], [14, 5], [14, 12], [8, 15]], frente);
}

const DIBUJOS = {
  rama: (p) => { p.linea(3, 13, 12, 3, '#7a4f25', 2); p.linea(8, 8, 11, 9, '#7a4f25'); p.px(12, 9, '#5fbf3a'); p.px(12, 3, '#5fbf3a'); },
  piedra: (p) => { p.circulo(8, 9, 5.5, '#7d8290'); p.circulo(9.5, 10.5, 3.6, '#646874'); p.rect(5, 6, 3, 2, '#a4aab6'); },
  madera: (p) => { p.rect(2, 6, 10, 6, '#7a4f25'); p.rect(2, 6, 10, 1, '#9b6a36'); p.circulo(12, 9, 3.4, '#c99a5a'); p.circulo(12, 9, 2, '#a87a3f'); p.px(12, 9, '#7a4f25'); },
  fibra: (p) => { for (let k = 0; k < 3; k++) { p.linea(3 + k * 3, 14, 5 + k * 3, 2, k % 2 ? '#79d24a' : '#5fb53a'); } p.rect(3, 9, 10, 1, '#c9a458'); },
  coco: (p) => { p.circulo(8, 8.5, 6, '#6b4423'); p.circulo(6.5, 7, 2.5, '#8a5a32'); for (const [x, y] of [[7, 5], [9, 5], [8, 7]]) p.px(x, y, '#2b1a0c'); },
  carbon: (p) => { p.circulo(6, 10, 4, '#26262c'); p.circulo(11, 9, 3.5, '#303038'); p.px(5, 8, '#6c6c78'); p.px(10, 7, '#6c6c78'); },
  hierro: (p) => icPepita(p, '#b9c1cc'),
  pirita: (p) => { p.rect(3, 7, 5, 5, '#d9b44a'); p.rect(8, 5, 5, 5, '#e8c85a'); p.rect(6, 10, 5, 4, '#c29a32'); p.px(9, 6, '#fff3b0'); p.px(4, 8, '#fff3b0'); },
  oro: (p) => icPepita(p, '#ffc62e'),
  cuarzo: (p) => icGema(p, '#e9eefc'),
  citrino: (p) => icGema(p, '#ffcf33'),
  amatista: (p) => icGema(p, '#a55cff'),
  esmeralda: (p) => icGema(p, '#2fd06e'),
  rubi: (p) => icGema(p, '#ff2e46'),
  zafiro: (p) => icGema(p, '#3a66ff'),
  lapislazuli: (p) => icGema(p, '#2346d6', '#ffffff'),
  malaquita: (p) => icGema(p, '#1db36a', '#0b5e33'),
  aguamarina: (p) => icGema(p, '#7ff2cf'),
  tanzanita: (p) => icGema(p, '#6b4dff'),
  opalo: (p) => icGema(p, '#f4f2ff', '#ff9ad8'),
  bismuto: (p) => { const cs = ['#ff7ad8', '#7ad8ff', '#ffe27a', '#8aff9a']; for (let k = 0; k < 4; k++) { p.rect(3 + k, 3 + k, 10 - 2 * k, 1, cs[k]); p.rect(3 + k, 12 - k, 10 - 2 * k, 1, cs[(k + 1) % 4]); p.rect(3 + k, 3 + k, 1, 10 - 2 * k, cs[(k + 2) % 4]); p.rect(12 - k, 3 + k, 1, 10 - 2 * k, cs[(k + 3) % 4]); } },
  estrella: (p) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3 : 7; pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]); } p.poli(pts, '#ffa21f'); p.circulo(8, 8.5, 2.5, '#ffe27a'); p.px(8, 8, '#ffffff'); },
  cielo: (p) => { p.poli([[2, 13], [8, 2], [14, 12]], '#2f7ff0'); p.rect(6, 8, 3, 1, '#ffffff'); p.rect(5, 9, 5, 1, '#ffffff'); p.px(10, 6, '#ffffff'); },
  uranio: (p) => { p.rect(6, 2, 4, 12, '#9fe82a'); p.rect(6, 2, 1, 12, '#dfff8a'); p.rect(9, 2, 1, 12, '#6aa81a'); p.px(3, 5, '#b6ff3a'); p.px(12, 9, '#b6ff3a'); p.px(2, 11, '#b6ff3a'); },
  gravinita: (p) => { for (let k = 2; k <= 14; k += 4) { p.linea(k, 2, k, 14, '#6a4cff'); p.linea(2, k, 14, k, '#8f78ff'); } p.circulo(8, 8, 2, '#c9bcff'); },
  antimateria: (p) => { p.circulo(8, 8, 6.5, '#7a3cff'); p.circulo(8, 8, 5.5, '#050308'); for (const [x, y] of [[6, 6], [9, 5], [10, 9], [6, 10], [8, 8]]) p.px(x, y, '#ffffff'); },
  quarks: (p) => { const cs = ['#ff4f6e', '#39d6ff', '#ffe14a', '#56e05a', '#b46cff']; [[5, 6], [10, 5], [8, 9], [4, 11], [11, 11]].forEach(([x, y], i) => p.circulo(x, y, 2.2, cs[i])); },
  atun: (p) => icPez(p, '#7f9bb5', '#5c7690'),
  payaso: (p) => icPez(p, '#ff7a1a', '#ff9a4a', '#ffffff'),
  calamar: (p) => { p.poli([[3, 6], [9, 3], [13, 6], [9, 9]], '#ff9a6a'); for (let k = 0; k < 4; k++) p.linea(4 + k * 2, 8, 3 + k * 2, 14, '#e8764a'); p.px(10, 5, '#101010'); },
  abisal: (p) => { icPez(p, '#2a3050', '#1c2038'); p.linea(4, 5, 2, 2, '#9ab'); p.px(2, 2, '#ffe27a'); p.rect(2, 9, 4, 1, '#ffffff'); },
  botella: (p) => { p.rect(6, 2, 4, 3, '#8a5a2b'); p.poli([[5, 5], [11, 5], [12, 14], [4, 14]], '#9fe8d0'); p.rect(6, 7, 4, 5, '#f4e6c1'); p.px(5, 6, '#ffffff'); },
  moneda: (p) => { p.circulo(8, 8, 6, '#ffcf40'); p.circulo(8, 8, 4.4, '#e0a82a'); p.rect(7, 5, 2, 6, '#ffe890'); },
  hachaPiedra: (p) => { icMango(p); p.poli([[8, 3], [13, 2], [14, 7], [10, 8]], '#8a8f9a'); p.px(13, 3, '#c0c5ce'); },
  hachaHierro: (p) => { icMango(p); p.poli([[8, 3], [13, 2], [14, 7], [10, 8]], '#d4d9e2'); p.px(13, 3, '#ffffff'); },
  picoPiedra: (p) => { icMango(p, 3, 14, 10, 6); p.linea(4, 5, 8, 2, '#8a8f9a', 2); p.linea(8, 2, 14, 7, '#8a8f9a', 2); },
  picoHierro: (p) => { icMango(p, 3, 14, 10, 6); p.linea(4, 5, 8, 2, '#d4d9e2', 2); p.linea(8, 2, 14, 7, '#d4d9e2', 2); },
  picoAmatista: (p) => { icMango(p, 3, 14, 10, 6); p.linea(4, 5, 8, 2, '#b46cff', 2); p.linea(8, 2, 14, 7, '#b46cff', 2); p.px(8, 3, '#f0d8ff'); },
  pala: (p) => { icMango(p, 3, 13, 9, 7); p.poli([[9, 5], [13, 2], [15, 4], [12, 9]], '#aab0bb'); },
  guadana: (p) => { p.linea(4, 15, 7, 3, '#8a5a2b', 2); p.poli([[7, 3], [14, 2], [15, 5], [9, 5]], '#d4d9e2'); },
  cana: (p) => { p.linea(2, 15, 13, 2, '#9b6a36', 1); p.linea(13, 2, 14, 10, '#ffffff'); p.px(14, 11, '#ff4040'); p.rect(4, 11, 2, 2, '#50535c'); },
  canaBuena: (p) => { p.linea(2, 15, 13, 2, '#ffc62e', 1); p.linea(13, 2, 14, 10, '#ffffff'); p.px(14, 11, '#ff4040'); p.rect(4, 11, 2, 2, '#b8860b'); },
  farol: (p) => { p.rect(5, 4, 6, 9, '#3a3d45'); p.rect(6, 5, 4, 7, '#ffd36a'); p.rect(7, 6, 2, 4, '#fff6c8'); p.rect(6, 2, 4, 2, '#3a3d45'); },
  mesa: (p) => { p.rect(2, 5, 12, 3, '#a86b33'); p.rect(2, 5, 12, 1, '#c98a45'); p.rect(3, 8, 2, 6, '#7a4f25'); p.rect(11, 8, 2, 6, '#7a4f25'); p.px(5, 4, '#c0c5ce'); p.linea(8, 4, 11, 4, '#8a5a2b'); },
  cofre: (p) => { p.rect(2, 5, 12, 9, '#9b6a36'); p.rect(2, 5, 12, 3, '#b37a3f'); p.rect(2, 8, 12, 1, '#5b3413'); p.rect(7, 7, 2, 3, '#d4d9e2'); },
  bloqueMadera: (p) => icCubo(p, '#c98a45', '#8a5526', '#a86b33'),
  tablon: (p) => { p.poli([[2, 8], [8, 5], [14, 8], [8, 11]], '#c98a45'); p.poli([[2, 8], [8, 11], [8, 13], [2, 10]], '#8a5526'); p.poli([[8, 11], [14, 8], [14, 10], [8, 13]], '#a86b33'); },
  bloquePiedra: (p) => icCubo(p, '#9aa0ab', '#5d616b', '#7d8290'),
  farolPie: (p) => { p.rect(7, 7, 2, 8, '#5b3413'); p.rect(5, 2, 6, 6, '#3a3d45'); p.rect(6, 3, 4, 4, '#ffd36a'); p.rect(4, 14, 8, 1, '#5b3413'); },
  espadaMadera: (p) => icEspada(p, '#b37a3f', '#d9a262'),
  espadaPiedra: (p) => icEspada(p, '#8a8f9a', '#c0c5ce'),
  espadaHierro: (p) => icEspada(p, '#d4d9e2', '#ffffff'),
  espadaAmatista: (p) => icEspada(p, '#b46cff', '#f0d8ff'),
  lanza: (p) => { p.linea(2, 14, 11, 5, '#8a5a2b', 2); p.poli([[10, 6], [14, 1], [12, 7]], '#c0c5ce'); p.px(13, 2, '#ffffff'); p.rect(9, 6, 2, 2, '#6fcf3f'); },
  arco: (p) => { for (let y = 1; y < 15; y++) { const x = 4 + Math.round(Math.sin((y / 14) * Math.PI) * 6); p.px(x, y, '#9b6a36'); p.px(x + 1, y, '#7a4f25'); } p.linea(4, 1, 4, 14, '#f4f6fa'); },
  flecha: (p) => { p.linea(2, 14, 12, 4, '#9b6a36'); p.poli([[11, 3], [14, 2], [13, 5]], '#c0c5ce'); p.rect(2, 12, 3, 1, '#ffffff'); p.rect(3, 13, 1, 2, '#ffffff'); },
  petoCaparazon: (p) => icPeto(p, '#e0643a', '#ff9a6a'),
  petoHierro: (p) => icPeto(p, '#b9c1cc', '#eef1f5'),
  carneCangrejo: (p) => { p.circulo(8, 9, 5, '#ff8f6a'); p.circulo(8, 9, 3, '#ffc2a8'); p.rect(3, 12, 10, 2, '#e0643a'); },
  cangrejoAsado: (p) => { p.poli([[3, 11], [5, 6], [11, 6], [13, 11], [8, 13]], '#d9542a'); p.rect(5, 7, 6, 2, '#ff8a4a'); p.px(6, 7, '#101010'); p.px(10, 7, '#101010'); p.linea(2, 8, 4, 6, '#d9542a'); p.linea(14, 8, 12, 6, '#d9542a'); },
  pescadoAsado: (p) => { icPez(p, '#c98a45', '#a86b33'); p.rect(5, 6, 1, 4, '#7a4f25'); p.rect(8, 6, 1, 4, '#7a4f25'); },
  caparazon: (p) => { p.poli([[2, 12], [4, 5], [8, 3], [12, 5], [14, 12]], '#e0643a'); p.linea(4, 11, 7, 5, '#ff9a6a'); p.linea(9, 5, 12, 11, '#b8472a'); },
  hueso: (p) => { p.linea(4, 12, 12, 4, '#f1ead8', 2); p.circulo(3.5, 12.5, 1.8, '#f1ead8'); p.circulo(5, 13.5, 1.5, '#f1ead8'); p.circulo(12.5, 3.5, 1.8, '#f1ead8'); p.circulo(11, 2.5, 1.5, '#f1ead8'); },
  pocion: (p) => { p.rect(6, 1, 4, 3, '#8a5a2b'); p.circulo(8, 10, 5, '#ff3a6a'); p.rect(7, 4, 2, 2, '#e8eef9'); p.px(6, 8, '#ffffff'); },
  mapaTesoro: (p) => { p.rect(2, 3, 12, 10, '#e8d3a0'); p.rect(2, 3, 12, 1, '#c9a458'); p.linea(4, 10, 8, 6, '#8a5a2b'); p.linea(10, 8, 12, 10, '#d9542a'); p.linea(12, 8, 10, 10, '#d9542a'); },
  corazonCristal: (p) => { p.poli([[8, 14], [2, 7], [4, 3], [8, 5], [12, 3], [14, 7]], '#5ff6ff'); p.poli([[8, 14], [8, 5], [12, 3], [14, 7]], '#2cc3dc'); p.px(5, 5, '#ffffff'); p.px(4, 6, '#ffffff'); },
  fogata: (p) => { p.linea(2, 14, 13, 11, '#7a4f25', 2); p.linea(3, 11, 14, 14, '#8a5a2b', 2); p.poli([[5, 11], [8, 2], [11, 11]], '#ff8a10'); p.poli([[7, 11], [8, 6], [9, 11]], '#ffe27a'); },
};

const cacheIconos = new Map();
export function icono(id) {
  if (cacheIconos.has(id)) return cacheIconos.get(id);
  const p = new Pix();
  (DIBUJOS[id] || DIBUJOS.piedra)(p);
  const c = p.lienzo();
  cacheIconos.set(id, c);
  return c;
}
// Un <canvas> nuevo con el ícono (un mismo nodo no puede estar en dos lugares).
export function nodoIcono(id, tam = 16) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(icono(id), 0, 0, tam, tam);
  return c;
}

// ── modelos 3D ─────────────────────────────────────────────────────────────
const G = new Map();
const geo = (k, fn) => (G.has(k) ? G.get(k) : (G.set(k, fn()), G.get(k)));
const liso = (color, op = {}) => matPixel('liso', { color, texeles: 32, clave: `liso|${color}|${op.emisivo || 0}|${op.brillo || 0}`, ...op });

function caja(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

function modeloHerramienta(id, it) {
  const g = new THREE.Group();
  const cabeza = id.includes('Amatista') ? 0xb46cff : id.includes('Hierro') ? 0xd4d9e2 : id === 'canaBuena' ? 0xffc62e : 0x8a8f9a;
  const mango = new THREE.Mesh(geo('mango', () => caja(0.045, 0.62, 0.045, 0, 0.31, 0)), liso(id === 'canaBuena' ? 0xd9a52a : 0x8a5a2b));
  g.add(mango);
  const mc = id.includes('Amatista') ? matGema(0xb46cff, 'cristal', { emision: 0.2 }) : liso(cabeza, { brillo: 0.8 });
  if (it.herr === 'pico') {
    g.add(new THREE.Mesh(geo('picoCab', () => mergeSimple([caja(0.42, 0.06, 0.06, 0, 0.6, 0), caja(0.08, 0.05, 0.05, 0.24, 0.57, 0), caja(0.08, 0.05, 0.05, -0.24, 0.57, 0)])), mc));
  } else if (it.herr === 'hacha') {
    g.add(new THREE.Mesh(geo('hachaCab', () => mergeSimple([caja(0.2, 0.18, 0.035, 0.1, 0.55, 0), caja(0.05, 0.24, 0.04, 0.2, 0.55, 0)])), mc));
  } else if (it.herr === 'pala') {
    g.add(new THREE.Mesh(geo('palaCab', () => caja(0.17, 0.22, 0.025, 0, 0.72, 0)), liso(0xaab0bb, { brillo: 0.6 })));
  } else if (it.herr === 'guadana') {
    g.add(new THREE.Mesh(geo('guadCab', () => mergeSimple([caja(0.36, 0.035, 0.02, 0.17, 0.6, 0), caja(0.1, 0.03, 0.02, 0.36, 0.57, 0)])), liso(0xd4d9e2, { brillo: 0.8 })));
  } else if (it.herr === 'cana') {
    mango.scale.set(0.7, 2.2, 0.7);
    g.add(new THREE.Mesh(geo('reel', () => caja(0.07, 0.07, 0.07, 0.03, 0.25, 0)), liso(0x50535c)));
  } else if (it.herr === 'espada') {
    // hoja larga, guarda y empuñadura: la hoja de amatista es gema de verdad
    g.clear();
    const colHoja = id === 'espadaMadera' ? 0xb37a3f : id === 'espadaPiedra' ? 0x9aa0ab : 0xd4d9e2;
    const matHoja = id === 'espadaAmatista' ? matGema(0xb46cff, 'cristal', { emision: 0.35 }) : liso(colHoja, { brillo: id === 'espadaMadera' ? 0 : 0.9 });
    g.add(new THREE.Mesh(geo('espHoja', () => mergeSimple([caja(0.07, 0.62, 0.02, 0, 0.5, 0), caja(0.045, 0.08, 0.02, 0, 0.84, 0)])), matHoja));
    g.add(new THREE.Mesh(geo('espGuarda', () => caja(0.22, 0.04, 0.05, 0, 0.18, 0)), liso(0x5b3413)));
    g.add(new THREE.Mesh(geo('espMango', () => caja(0.04, 0.18, 0.04, 0, 0.08, 0)), liso(0x8a5a2b)));
  } else if (it.herr === 'lanza') {
    mango.scale.set(0.85, 1.9, 0.85);
    g.add(new THREE.Mesh(geo('lanzaPunta', () => new THREE.ConeGeometry(0.05, 0.22, 4).translate(0, 1.28, 0)), liso(0xc0c5ce, { brillo: 0.8 })));
    g.add(new THREE.Mesh(geo('lanzaAtado', () => caja(0.07, 0.06, 0.07, 0, 1.15, 0)), liso(0x6fcf3f)));
  } else if (it.herr === 'arco') {
    g.clear();
    // la vara: siete tramos sobre un arco de radio 0,42 m; la cuerda une las puntas
    const partes = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 6 - 0.5) * 2;
      partes.push(caja(0.035, 0.13, 0.035).rotateZ(a).translate(-0.3 + Math.cos(a) * 0.42, 0.45 + Math.sin(a) * 0.42, 0));
    }
    g.add(new THREE.Mesh(geo('arcoMadera', () => mergeSimple(partes)), liso(0x9b6a36)));
    g.add(new THREE.Mesh(geo('arcoCuerda', () => caja(0.01, 0.71, 0.01, -0.073, 0.45, 0)), liso(0xf4f6fa)));
  } else if (it.herr === 'farol') {
    g.clear();
    g.add(new THREE.Mesh(geo('farolMarco', () => mergeSimple([caja(0.2, 0.03, 0.2, 0, 0.02, 0), caja(0.2, 0.03, 0.2, 0, 0.3, 0), caja(0.03, 0.3, 0.03, 0.09, 0.16, 0.09), caja(0.03, 0.3, 0.03, -0.09, 0.16, 0.09), caja(0.03, 0.3, 0.03, 0.09, 0.16, -0.09), caja(0.03, 0.3, 0.03, -0.09, 0.16, -0.09), caja(0.06, 0.08, 0.06, 0, 0.36, 0)])), liso(0x3a3d45)));
    g.add(new THREE.Mesh(geo('farolLuz', () => caja(0.15, 0.24, 0.15, 0, 0.16, 0)), liso(0xffd36a, { emisivo: 0xffb040 })));
  }
  return g;
}

function modeloPez(it, id) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(geo('pezCuerpo', () => { const s = new THREE.SphereGeometry(0.5, 8, 6); s.scale(0.6, 0.26, 0.16); return s; }), liso(it.color));
  g.add(cuerpo);
  g.add(new THREE.Mesh(geo('pezCola', () => new THREE.ConeGeometry(0.1, 0.16, 4).rotateZ(Math.PI / 2).translate(-0.33, 0, 0)), liso(new THREE.Color(it.color).multiplyScalar(0.8).getHex())));
  if (id === 'payaso') for (const x of [-0.08, 0.1]) g.add(new THREE.Mesh(geo('raya', () => caja(0.04, 0.27, 0.17)), liso(0xffffff)).translateX(x));
  if (id === 'abisal') {
    const antena = new THREE.Mesh(geo('antena', () => caja(0.015, 0.16, 0.015, 0.2, 0.18, 0)), liso(0x8899aa));
    const luz = new THREE.Mesh(geo('luzAbisal', () => caja(0.05, 0.05, 0.05, 0.25, 0.26, 0)), liso(0xffe27a, { emisivo: 0xffd040 }));
    g.add(antena, luz);
  }
  if (id === 'calamar') { cuerpo.scale.set(0.8, 1.4, 1.6); }
  return g;
}

function modeloRaro(id, it) {
  const g = new THREE.Group();
  if (id === 'estrella') {
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 0.07 : 0.17; if (i === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r); else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    const e = new THREE.ExtrudeGeometry(forma, { depth: 0.07, bevelEnabled: false }).translate(0, 0.18, -0.035);
    g.add(new THREE.Mesh(e, liso(0xffb040, { emisivo: 0xff8a10 })));
  } else if (id === 'cielo') {
    const forma = new THREE.Shape([new THREE.Vector2(-0.18, 0), new THREE.Vector2(0.2, 0.04), new THREE.Vector2(0.02, 0.3)]);
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: false }).translate(0, 0.02, 0), matGema(0x2f7ff0, 'cielo')));
  } else if (id === 'antimateria') {
    g.add(new THREE.Mesh(geo('esfera', () => new THREE.IcosahedronGeometry(0.15, 2).translate(0, 0.16, 0)), matGema(0x000000, 'antimateria')));
  } else if (id === 'quarks') {
    const cs = [0xff4f6e, 0x39d6ff, 0xffe14a, 0x56e05a, 0xb46cff, 0xff9a3d, 0x9bf0ff];
    cs.forEach((c, i) => {
      const m = new THREE.Mesh(geo('quark', () => new THREE.IcosahedronGeometry(0.05, 1)), matGema(c, 'cristal', { emision: 0.5 }));
      const a = i * 2.4;
      m.position.set(Math.cos(a) * 0.09, 0.12 + (i % 3) * 0.05, Math.sin(a) * 0.09);
      m.userData.quark = i;
      g.add(m);
    });
    g.userData.animar = 'quarks';
  } else if (id === 'uranio') {
    g.add(new THREE.Mesh(geo('barra', () => new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6).translate(0, 0.15, 0)), liso(0x9fe82a, { emisivo: 0x3f7a00 })));
    g.userData.animar = 'uranio';
  } else if (id === 'gravinita') {
    g.add(new THREE.Mesh(geo('octa', () => new THREE.OctahedronGeometry(0.14).translate(0, 0.16, 0)), matGema(0x6a4cff, 'cristal', { emision: 0.3 })));
    g.userData.animar = 'gravinita';
  } else if (id === 'botella') {
    g.add(new THREE.Mesh(geo('botella', () => new THREE.CylinderGeometry(0.06, 0.07, 0.22, 7).rotateZ(Math.PI / 2).translate(0, 0.07, 0)), liso(0x9fe8d0, { brillo: 1 })));
    g.add(new THREE.Mesh(geo('corcho', () => caja(0.06, 0.04, 0.04, 0.13, 0.07, 0)), liso(0x8a5a2b)));
  } else if (id === 'moneda') {
    g.add(new THREE.Mesh(geo('moneda', () => new THREE.CylinderGeometry(0.1, 0.1, 0.025, 10).translate(0, 0.02, 0)), matGema(0xffcf40, 'metal')));
  } else if (id === 'corazonCristal') {
    g.add(new THREE.Mesh(geo('corazon', () => new THREE.OctahedronGeometry(0.16, 0).scale(1, 1.3, 0.7).translate(0, 0.2, 0)), matGema(0x5ff6ff, 'cristal', { emision: 0.6 })));
    g.userData.animar = 'gravinita';
  } else if (id === 'mapaTesoro') {
    g.add(new THREE.Mesh(geo('mapa', () => caja(0.3, 0.02, 0.22, 0, 0.01, 0)), liso(0xe8d3a0)));
    g.add(new THREE.Mesh(geo('mapaX', () => mergeSimple([caja(0.07, 0.022, 0.015, 0.06, 0.012, 0.03).rotateY(0.7), caja(0.07, 0.022, 0.015, 0.06, 0.012, 0.03).rotateY(-0.7)])), liso(0xd9542a)));
  }
  return g;
}

function modeloBloque(it) {
  const g = new THREE.Group();
  const c = it.bloque === 'piedra' ? 0x8a8f9a : 0xa86b33;
  if (it.bloque === 'tablon') g.add(new THREE.Mesh(geo('tabIt', () => caja(0.3, 0.08, 0.3, 0, 0.04, 0)), liso(c)));
  else if (it.bloque === 'mesa') g.add(new THREE.Mesh(geo('mesaIt', () => mergeSimple([caja(0.3, 0.05, 0.22, 0, 0.2, 0), caja(0.04, 0.18, 0.04, 0.12, 0.09, 0.08), caja(0.04, 0.18, 0.04, -0.12, 0.09, 0.08), caja(0.04, 0.18, 0.04, 0.12, 0.09, -0.08), caja(0.04, 0.18, 0.04, -0.12, 0.09, -0.08)])), liso(c)));
  else if (it.bloque === 'cofre') g.add(new THREE.Mesh(geo('cofreIt', () => caja(0.3, 0.22, 0.2, 0, 0.11, 0)), liso(0x9b6a36)));
  else if (it.bloque === 'farolPie') return modeloHerramienta('farol', ITEMS.farol);
  else g.add(new THREE.Mesh(geo('cuboIt', () => caja(0.24, 0.24, 0.24, 0, 0.12, 0)), liso(c)));
  return g;
}

/** Modelo 3D de un ítem, del tamaño de un objeto tirado en el piso (~0.3 m). */
export function modeloItem(id) {
  const it = ITEMS[id] || ITEMS.piedra;
  let g;
  if (it.tipo === 'herramienta') g = modeloHerramienta(id, it);
  else if (it.tipo === 'pez') g = modeloPez(it, id);
  else if (it.tipo === 'bloque') g = modeloBloque(it);
  else if (it.tipo === 'raro' || id === 'botella' || id === 'moneda') g = modeloRaro(id, it);
  else if (it.tipo === 'armadura') {
    g = new THREE.Group();
    g.add(new THREE.Mesh(geo('peto', () => mergeSimple([caja(0.32, 0.3, 0.12, 0, 0.16, 0), caja(0.1, 0.08, 0.12, 0.13, 0.33, 0), caja(0.1, 0.08, 0.12, -0.13, 0.33, 0)])), liso(it.color, { brillo: 0.5 })));
  } else if (id === 'hueso') {
    g = new THREE.Group();
    g.add(new THREE.Mesh(geo('hueso', () => mergeSimple([caja(0.3, 0.05, 0.05, 0, 0.03, 0), caja(0.06, 0.06, 0.1, 0.16, 0.03, 0), caja(0.06, 0.06, 0.1, -0.16, 0.03, 0)])), liso(it.color)));
  } else if (id === 'flecha') {
    g = new THREE.Group();
    g.add(new THREE.Mesh(geo('flechaIt', () => mergeSimple([caja(0.42, 0.02, 0.02, 0, 0.02, 0), caja(0.06, 0.04, 0.04, 0.23, 0.02, 0), caja(0.07, 0.05, 0.01, -0.2, 0.02, 0)])), liso(0x9b6a36)));
  } else if (it.tipo === 'comida' && it.color) {
    g = new THREE.Group();
    if (id === 'pocion') g.add(new THREE.Mesh(geo('pocion', () => new THREE.SphereGeometry(0.1, 7, 5).translate(0, 0.1, 0)), liso(it.color, { emisivo: 0x40081a, brillo: 1 })));
    else g.add(new THREE.Mesh(geo('bocado', () => new THREE.SphereGeometry(0.12, 6, 4).scale(1.3, 0.6, 1).translate(0, 0.07, 0)), liso(it.color)));
  } else if (id === 'caparazon') {
    g = new THREE.Group();
    g.add(new THREE.Mesh(geo('caparazonIt', () => new THREE.SphereGeometry(0.16, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 0.8)), liso(it.color)));
  }
  else if (it.tipo === 'gema') {
    g = new THREE.Group();
    const base = new THREE.Mesh(geo('baseGema', () => geoRoca(31, 0.6).scale(0.13, 0.1, 0.13).translate(0, 0.05, 0)), matPixel('liso', { color: 0x6b6f7a, bari: true, borde: 0.6, texeles: 32, clave: 'baseGema' }));
    const crist = new THREE.Mesh(geo('cristGema', () => geoCristales(7, 4).scale(0.5, 0.5, 0.5).translate(0, 0.06, 0)), matGema(it.color, it.mat || 'cristal', { emision: 0.15 }));
    g.add(base, crist);
  } else if (it.tipo === 'metal') {
    g = new THREE.Group();
    const forma = id === 'pirita' ? geo('pirita', () => mergeSimple([caja(0.12, 0.12, 0.12, 0, 0.06, 0), caja(0.1, 0.1, 0.1, 0.08, 0.1, 0.04).rotateY(0.5), caja(0.09, 0.09, 0.09, -0.06, 0.12, -0.03).rotateX(0.4)])) : geo('pepita', () => geoRoca(51, 0.8).scale(0.13, 0.13, 0.13).translate(0, 0.1, 0));
    g.add(new THREE.Mesh(forma, matGema(it.color, 'metal')));
  } else {
    g = new THREE.Group();
    if (id === 'madera') g.add(new THREE.Mesh(geo('tronco', () => new THREE.CylinderGeometry(0.1, 0.1, 0.42, 7).rotateZ(Math.PI / 2).translate(0, 0.1, 0)), liso(0x8a5a2b)));
    else if (id === 'rama') g.add(new THREE.Mesh(geo('rama', () => new THREE.CylinderGeometry(0.022, 0.028, 0.5, 5).rotateZ(Math.PI / 2 - 0.2).translate(0, 0.03, 0)), liso(0x7a4f25)));
    else if (id === 'fibra') g.add(new THREE.Mesh(geo('fibra', () => mergeSimple([0, 1, 2, 3].map((k) => caja(0.02, 0.02, 0.36, (k - 1.5) * 0.03, 0.02, 0).rotateY(k * 0.2)))), liso(0x6fcf3f)));
    else if (id === 'coco') g.add(new THREE.Mesh(geo('coco', () => new THREE.SphereGeometry(0.12, 7, 5).translate(0, 0.11, 0)), liso(0x6b4423)));
    else if (id === 'carbon') g.add(new THREE.Mesh(geo('carbon', () => geoRoca(61, 0.8).scale(0.13, 0.12, 0.13).translate(0, 0.08, 0)), matPixel('liso', { color: 0x2a2a30, bari: true, borde: 1.4, texeles: 32, clave: 'carbon' })));
    else g.add(new THREE.Mesh(geo('piedraIt', () => geoRoca(71, 0.8).scale(0.14, 0.13, 0.14).translate(0, 0.08, 0)), matPixel('liso', { color: 0x7d8290, bari: true, borde: 0.7, texeles: 32, clave: 'piedraIt' })));
  }
  g.userData.item = id;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function estrellasTexto(n) { return '✦'.repeat(n); }
export function precioTexto(v) { return '$' + Math.round(v).toLocaleString(locale()); }
