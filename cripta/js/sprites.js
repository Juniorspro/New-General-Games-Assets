// Todo el pixel art, dibujado acá: grillas de texto con una letra por color
// (las chicas) y pintores de píxel por píxel (lo redondo y lo que gira). Se
// hornea todo una vez en lienzos chicos; el juego después solo copia.
//
// La heroína es Lu, una luciérnaga: cabeza oscura, ojos grandes, antenas
// con punta de luz y la panza que brilla. Es lo más luminoso de la pantalla.
import { P } from './paleta.js';

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// Una grilla de texto → lienzo. '.' es transparente.
export function hacer(filas, mapa) {
  const h = filas.length, w = Math.max(...filas.map((f) => f.length));
  const [c, g] = lienzo(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < filas[y].length; x++) {
    const col = mapa[filas[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

// Girar un lienzo de a 90° (para lo que mira en cuatro direcciones).
export function girar(c, cuartos) {
  cuartos = ((cuartos % 4) + 4) % 4;
  if (!cuartos) return c;
  const [r, g] = lienzo(cuartos % 2 ? c.height : c.width, cuartos % 2 ? c.width : c.height);
  g.translate(r.width / 2, r.height / 2);
  g.rotate((cuartos * Math.PI) / 2);
  g.drawImage(c, -c.width / 2, -c.height / 2);
  return r;
}

// Un círculo lleno de a píxel (sin arc(), que suaviza el borde).
function circulo(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) g.fillRect(x, y, 1, 1);
}
function anillo(g, cx, cy, r, grosor, colorDe) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r && d > r - grosor) { const col = colorDe(Math.atan2(y + 0.5 - cy, x + 0.5 - cx)); if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
  }
}

// ── Lu ─────────────────────────────────────────────────────────────────────
// 8 de ancho × 9 de alto: la fila de arriba son las puntas de las antenas y
// sobresale de la celda. Los ojos se ponen aparte: miran hacia donde va.
const LU_BASE = [
  '.l....l.',
  '..k..k..',
  '..kkkk..',
  '.kckkkk.',
  'kkkkkkkk',
  'kkkkkkkk',
  '.pkkkkp.',
  '.LlLLLL.',
  '..oLLo..',
];
const ALAS = { abajo: [[0, 7], [7, 7]], arriba: [[0, 6], [7, 6], [0, 5], [7, 5]] };

// Las pieles cambian los colores de la cabeza y de la luz; algunas agregan algo.
export const PIELES = {
  lu: { k: P.cabeza, c: P.cabezaLuz, L: P.lu, l: P.luClaro, o: P.luOsc, a: P.ala },
  ambar: { k: '#3b1f14', c: '#6a3a22', L: '#ffb02e', l: '#ffe3a0', o: '#b1600c', a: '#ffe7c7' },
  hielo: { k: '#1d2a48', c: '#34507a', L: '#74f0ff', l: '#dcfdff', o: '#1c8fb0', a: '#e8fbff' },
  rosa: { k: '#3a1732', c: '#6b2c5c', L: '#ff79c9', l: '#ffd2ee', o: '#b0327f', a: '#ffe0f4' },
  noche: { k: '#141026', c: '#2c2450', L: '#b68cff', l: '#efe3ff', o: '#5a3ab0', a: '#d9ccff' },
  oro: { k: '#3a2a08', c: '#6e5214', L: '#ffe14d', l: '#fffbd0', o: '#b48a0c', a: '#fff5c2', corona: true },
  fuego: { k: '#2a0f0a', c: '#5a2212', L: '#ff6a2a', l: '#ffd07a', o: '#a82a0c', a: '#ffc9a0' },
  menta: { k: '#10302a', c: '#1f5a4c', L: '#63ffb6', l: '#d8ffee', o: '#169a64', a: '#d9fff0', gorro: true },
};

export function luFrame(piel = 'lu', { ojos = [0, 0], alas = 'abajo', parpado = false } = {}) {
  const pal = PIELES[piel] || PIELES.lu;
  const mapa = { k: pal.k, c: pal.c, L: pal.L, l: pal.l, o: pal.o, p: P.mejilla };
  const c = hacer(LU_BASE, mapa);
  const g = c.getContext('2d');
  // alas: dos píxeles claros a los costados, que suben y bajan
  g.fillStyle = pal.a;
  for (const [x, y] of ALAS[alas]) g.fillRect(x, y, 1, 1);
  // ojos: dos columnas blancas de 2 px (o una raya si parpadea)
  const [ox, oy] = ojos;
  g.fillStyle = P.blanco;
  for (const x of [2, 5]) {
    if (parpado) g.fillRect(x + ox, 5 + oy, 1, 1);
    else g.fillRect(x + ox, 4 + oy, 1, 2);
  }
  if (pal.corona) { g.fillStyle = '#ffe14d'; g.fillRect(2, 1, 1, 1); g.fillRect(4, 0, 1, 2); g.fillRect(5, 1, 1, 1); g.fillStyle = '#ff5c8a'; g.fillRect(4, 1, 1, 1); }
  if (pal.gorro) { g.fillStyle = '#ff5c5c'; g.fillRect(2, 1, 4, 1); g.fillRect(3, 0, 2, 1); g.fillStyle = '#ffffff'; g.fillRect(5, 0, 1, 1); }
  return c;
}

// Los cuadros de Lu para cada piel, horneados: por dirección de la mirada,
// con alas arriba y abajo, y con el párpado cerrado.
const cacheLu = new Map();
export function lu(piel, dir, alas, parpado) {
  const k = `${piel}|${dir}|${alas}|${parpado}`;
  if (cacheLu.has(k)) return cacheLu.get(k);
  const ojos = { der: [1, 0], izq: [-1, 0], arriba: [0, -1], abajo: [0, 1], quieto: [0, 0] }[dir] || [0, 0];
  const c = luFrame(piel, { ojos, alas, parpado });
  cacheLu.set(k, c);
  return c;
}

// La silueta de Lu en un color (para la estela y el destello al morir).
const cacheSil = new Map();
export function silueta(fuente, color) {
  const k = color + fuente.width + fuente.height + (fuente._id || (fuente._id = Math.random()));
  if (cacheSil.has(k)) return cacheSil.get(k);
  const [c, g] = lienzo(fuente.width, fuente.height);
  g.drawImage(fuente, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  cacheSil.set(k, c);
  return c;
}

// ── lo que se junta ────────────────────────────────────────────────────────
const MON = { o: P.monedaOsc, M: P.moneda, l: P.monedaLuz, w: P.blanco };
export const MONEDA = [
  hacer(['..ooo..', '.oMMMo.', 'oMlMMMo', 'oMlMwMo', 'oMlMMMo', '.oMMMo.', '..ooo..'], MON),
  hacer(['.ooo.', 'oMlMo', 'oMlMo', 'oMlwo', 'oMlMo', 'oMlMo', '.ooo.'], MON),
  hacer(['.o.', 'oMo', 'olo', 'olo', 'olo', 'oMo', '.o.'], MON),
  hacer(['.ooo.', 'oMlMo', 'oMlMo', 'oMlwo', 'oMlMo', 'oMlMo', '.ooo.'], MON),
];
const EST = { E: P.estrella, o: P.estrellaOsc, w: P.blanco };
export const ESTRELLA = [
  hacer(['...E...', '..EEE..', 'EEEEEEE', '.EEwEE.', '..EEE..', '.EEoEE.', '.E...E.'], EST),
  hacer(['...E...', '..EwE..', 'EEEEEEE', '.EEEEE.', '..EEE..', '.EEoEE.', '.E...E.'], EST),
];
export const ESTRELLA_VACIA = hacer(['...o...', '..o.o..', 'ooo.ooo', '.o...o.', '..o.o..', '.o.o.o.', '.o...o.'], { o: P.grisOsc });
export const CHISPA = [
  hacer(['.c.', 'cCc', '.c.'], { c: P.chispa, C: P.chispaLuz }),
  hacer(['...', '.C.', '...'], { C: P.chispa }),
];

// La salida: un aro que gira en cuatro cuadros.
export const PORTAL = [0, 1, 2, 3].map((k) => {
  const [c, g] = lienzo(10, 10);
  anillo(g, 5, 5, 4.6, 1.6, (a) => {
    const s = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8 + k * 2) % 8;
    return s < 2 ? P.blanco : s < 4 ? P.portalA : s < 6 ? '#8a5cff' : P.portalB;
  });
  circulo(g, 5, 5, 2.2, k % 2 ? '#2a1d5a' : '#3a2878');
  g.fillStyle = P.blanco; g.fillRect(4 + (k % 2), 4 + ((k >> 1) % 2), 1, 1);
  return c;
});

// Portales gemelos (A y B): un aro de un solo color, que late.
export function portalGemelo(color) {
  return [0, 1].map((k) => {
    const [c, g] = lienzo(8, 8);
    anillo(g, 4, 4, 3.9 - k * 0.4, 1.2, (a) => (Math.sin(a * 3 + k) > 0 ? color : P.blanco));
    circulo(g, 4, 4, 1.4, '#1a1433');
    return c;
  });
}

// ── lo que mata ────────────────────────────────────────────────────────────
// Púas que salen de una pared: acá de la de abajo (se giran para las otras
// tres). Dos agujas finas con luz a la izquierda; las que suben y bajan
// tienen tres cuadros: guardadas (se ven los agujeros), asomando y afuera.
const PUA = { w: '#fff0f3', l: P.rojoLuz, r: P.rojo, d: P.rojoOsc, D: '#4a0a1c', h: '#1a0610' };
export const PINCHOS = {
  arriba: hacer(['........', '..w..w..', '..l..l..', '.lrdlrd.', '.lrdlrd.', 'lrrdlrrd', 'dddddddd', 'DDDDDDDD'], PUA),
  aviso: hacer(['........', '........', '........', '........', '..w..w..', '.lrdlrd.', 'dddddddd', 'DDDDDDDD'], PUA),
  abajo: hacer(['........', '........', '........', '........', '........', '........', 'DhDDhDDD', 'DDDDDDDD'].map((f) => f.replace(/D/g, 'D')), { ...PUA, h: '#0b0306' }),
};

// La polilla sombra: aletea en dos cuadros; los ojos brillan rosa.
const POL = { P: P.polilla, p: P.polillaOsc, e: P.polillaOjo };
export const POLILLA = [
  hacer(['P......P', 'PP.pp.PP', 'PPPppPPP', '.PpeepP.', '.PPppPP.', 'PP.pp.PP', 'P..pp..P', '........'], POL),
  hacer(['........', '..P..P..', '.PPppPP.', '.PpeepP.', '.PPppPP.', '..PppP..', '...pp...', '........'], POL),
];

// La cabeza de piedra, mirando hacia abajo (se gira para las otras): cejas,
// ojos de brasa y una boca que se abre para escupir.
function cabezaPiedra(abierta) {
  const [c, g] = lienzo(8, 8);
  g.fillStyle = P.piedraOsc; g.fillRect(0, 0, 8, 8);
  g.fillStyle = P.piedra; g.fillRect(1, 0, 6, 7);
  g.fillStyle = P.piedraLuz; g.fillRect(1, 0, 6, 1); g.fillRect(1, 1, 1, 5);
  g.fillStyle = P.piedraOsc; g.fillRect(2, 2, 4, 1);
  g.fillStyle = P.fuego; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
  g.fillStyle = P.fuegoLuz; g.fillRect(2, 3, 1, 1);
  g.fillStyle = P.negro; g.fillRect(3, 5, 2, abierta ? 3 : 1);
  if (abierta) { g.fillStyle = P.fuego; g.fillRect(3, 7, 2, 1); }
  return c;
}
export const CABEZA = { cerrada: cabezaPiedra(false), abierta: cabezaPiedra(true) };

export const BOLA_FUEGO = [
  hacer(['.fff.', 'fFFFf', 'fFwFf', 'fFFFf', '.fff.'], { f: P.fuego, F: P.fuegoLuz, w: P.blanco }),
  hacer(['..f..', '.fFf.', 'fFwFf', '.fFf.', '..f..'], { f: P.fuego, F: P.fuegoLuz, w: P.blanco }),
];

// El erizo: chico y tranquilo, o inflado ocupando las ocho celdas de al lado.
function erizo(radio, largo, tam) {
  const [c, g] = lienzo(tam, tam);
  const m = tam / 2;
  g.fillStyle = P.erizoPua;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (let d = radio - 1; d <= radio + largo; d += 0.5) g.fillRect(Math.floor(m + Math.cos(a) * d), Math.floor(m + Math.sin(a) * d), 1, 1);
  }
  circulo(g, m, m, radio, P.erizoOsc);
  circulo(g, m - 0.4, m - 0.6, radio - 1, P.erizo);
  g.fillStyle = P.negro; g.fillRect(Math.floor(m) - 2, Math.floor(m) - 1, 1, 2); g.fillRect(Math.floor(m) + 1, Math.floor(m) - 1, 1, 2);
  g.fillStyle = P.blanco; g.fillRect(Math.floor(m) - 2, Math.floor(m) - 1, 1, 1); g.fillRect(Math.floor(m) + 1, Math.floor(m) - 1, 1, 1);
  return c;
}
export const ERIZO = { chico: erizo(2.6, 1.2, 8), grande: erizo(6.5, 3.5, 24) };

// ── piezas del laberinto ───────────────────────────────────────────────────
// Flecha que obliga a doblar: mira a la derecha (se gira para las otras).
export const FLECHA = (() => {
  const [c, g] = lienzo(8, 8);
  g.fillStyle = '#1b1636'; g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#2d2658'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 0, 1, 8);
  g.fillStyle = P.chispa;
  g.fillRect(1, 3, 4, 2); g.fillRect(4, 1, 1, 6); g.fillRect(5, 2, 1, 4); g.fillRect(6, 3, 1, 2);
  return c;
})();

// Grietas de la pared frágil (se pintan encima de la pared).
export const GRIETA = [1, 2].map((n) => {
  const [c, g] = lienzo(8, 8);
  g.fillStyle = 'rgba(5,4,11,0.85)';
  const lineas = n === 1 ? [[1, 1], [2, 2], [3, 2], [4, 3], [5, 5]] : [[1, 1], [2, 2], [3, 2], [4, 3], [5, 5], [6, 5], [2, 5], [3, 6], [5, 1], [6, 2], [4, 4], [1, 6]];
  for (const [x, y] of lineas) g.fillRect(x, y, 1, 1);
  return c;
});

// Antorcha colgada de la pared: soporte y llama en tres cuadros.
export const ANTORCHA = [0, 1, 2].map((k) => {
  const llama = [
    ['..f..', '.fFf.', '.FwF.', '..F..'],
    ['.f...', '.fFf.', '.FwF.', '..F..'],
    ['...f.', '.fFf.', '.FwF.', '.fF..'],
  ][k];
  return hacer([...llama, '.sSs.', '..s..', '..s..'], { f: P.fuego, F: P.fuegoLuz, w: P.blanco, s: P.piedraOsc, S: P.piedra });
});

// ── potenciadores: un ícono dentro de una burbuja ──────────────────────────
function burbuja(color, dibujo) {
  const [c, g] = lienzo(10, 10);
  anillo(g, 5, 5, 4.9, 1, () => color);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(2, 2, 2, 1);
  dibujo(g);
  return c;
}
export const PODER = {
  iman: burbuja(P.iman, (g) => {
    g.fillStyle = P.iman; g.fillRect(3, 3, 1, 4); g.fillRect(6, 3, 1, 4); g.fillRect(3, 6, 4, 1);
    g.fillStyle = P.blanco; g.fillRect(3, 3, 1, 1); g.fillRect(6, 3, 1, 1);
  }),
  escudo: burbuja(P.escudo, (g) => {
    g.fillStyle = P.escudo; g.fillRect(3, 3, 4, 3); g.fillRect(4, 6, 2, 1);
    g.fillStyle = P.blanco; g.fillRect(4, 4, 1, 1);
  }),
  hielo: burbuja(P.hielo, (g) => {
    g.fillStyle = P.hielo; g.fillRect(5, 2, 1, 6); g.fillRect(2, 5, 6, 1); g.fillRect(3, 3, 1, 1); g.fillRect(7, 3, 1, 1); g.fillRect(3, 7, 1, 1); g.fillRect(7, 7, 1, 1);
    g.fillStyle = P.blanco; g.fillRect(5, 5, 1, 1);
  }),
  doble: burbuja(P.doble, (g) => {
    g.fillStyle = P.doble; g.fillRect(2, 3, 1, 1); g.fillRect(4, 3, 1, 1); g.fillRect(3, 4, 1, 1); g.fillRect(2, 5, 1, 1); g.fillRect(4, 5, 1, 1);
    g.fillStyle = P.blanco; g.fillRect(5, 3, 2, 1); g.fillRect(6, 4, 1, 1); g.fillRect(5, 5, 2, 1); g.fillRect(5, 6, 1, 1); g.fillRect(5, 7, 2, 1);
  }),
};

// ── íconos de la interfaz ──────────────────────────────────────────────────
export const ICONO = {
  moneda: MONEDA[0],
  estrella: ESTRELLA[0],
  estrellaVacia: ESTRELLA_VACIA,
  pausa: hacer(['##.##', '##.##', '##.##', '##.##', '##.##'], { '#': P.blanco }),
  jugar: hacer(['#....', '###..', '#####', '###..', '#....'], { '#': P.blanco }),
  candado: hacer(['.###.', '#...#', '#...#', '#####', '##.##', '##.##', '#####'], { '#': P.gris }),
  volver: hacer(['..#..', '.##..', '#####', '.##..', '..#..'], { '#': P.blanco }),
  musica: hacer(['..###', '..#.#', '..#.#', '..#.#', '###.#', '###..', '.....'], { '#': P.blanco }),
  parlante: hacer(['...#.', '..##.', '####.', '####.', '####.', '..##.', '...#.'], { '#': P.blanco }),
  vibra: hacer(['#.###.#', '#.#.#.#', '..#.#..', '#.#.#.#', '#.###.#'], { '#': P.blanco }),
  tilde: hacer(['....#', '...#.', '#.#..', '.#...'], { '#': P.blanco }),
  cruz: hacer(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], { '#': P.blanco }),
  reintentar: hacer(['.###.', '#...#', '#.###', '#..#.', '#...#', '.###.'], { '#': P.blanco }),
  casa: hacer(['..#..', '.###.', '#####', '.#.#.', '.###.'], { '#': P.blanco }),
  carrito: hacer(['#......', '.######', '.#####.', '.#####.', '..#..#.'], { '#': P.blanco }),
  engranaje: hacer(['...#...', '.#####.', '.##.##.', '##...##', '.##.##.', '.#####.', '...#...'], { '#': P.blanco }),
  mundo: hacer(['.###.', '#.#.#', '#####', '#.#.#', '.###.'], { '#': P.blanco }),
};
