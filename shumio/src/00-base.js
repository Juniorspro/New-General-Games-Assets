'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// SHUMIO'S DEPTHS · la base: cuentas, azar con semilla, constantes de la sala.
// ─────────────────────────────────────────────────────────────────────────────

const lim = (x, a, b) => (x < a ? a : x > b ? b : x);
const sig = (x) => (x < 0 ? -1 : x > 0 ? 1 : 0);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Un rng chico y rápido (mulberry32). */
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashTexto(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// Dos azares: el del MUNDO (con semilla: la misma semilla, la misma partida) y el VISUAL
// (partículas, temblores: Math.random, así no corre la secuencia del mundo). Guía 2D § 9.
let rnd = mulberry(1);
const A = {
  f: () => rnd(),
  ent: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
  uno: (arr) => arr[Math.floor(rnd() * arr.length)],
  si: (p) => rnd() < p,
  pesos(tabla) {   // [[valor, peso], …]
    let s = 0; for (const [, p] of tabla) s += p;
    let r = rnd() * s;
    for (const [v, p] of tabla) { if ((r -= p) < 0) return v; }
    return tabla[tabla.length - 1][0];
  },
  mezclar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
};
const V = { f: Math.random, ent: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), uno: (arr) => arr[Math.floor(Math.random() * arr.length)] };

// ── la sala: 13×7 baldosas de 24 px, con muros (el de arriba más alto: la perspectiva) ──
const T = 24, COLS = 13, FILAS = 7;
const MURO_L = 28, MURO_A = 32, MURO_B = 24;
const SALA_W = MURO_L * 2 + COLS * T;      // 368
const SALA_H = MURO_A + MURO_B + FILAS * T; // 224
const IX0 = MURO_L, IY0 = MURO_A, IX1 = MURO_L + COLS * T, IY1 = MURO_A + FILAS * T;
/** El centro de la baldosa (c, f) en coordenadas de la sala. */
const cx = (c) => IX0 + c * T + T / 2;
const cy = (f) => IY0 + f * T + T / 2;
const celdaX = (x) => Math.floor((x - IX0) / T);
const celdaY = (y) => Math.floor((y - IY0) / T);

// las puertas: arriba, derecha, abajo, izquierda (en el centro de cada muro)
const ARRIBA = 0, DERECHA = 1, ABAJO = 2, IZQUIERDA = 3;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PUERTA = [
  { x: SALA_W / 2, y: MURO_A - 6 },
  { x: SALA_W - MURO_L + 6, y: IY0 + FILAS * T / 2 },
  { x: SALA_W / 2, y: SALA_H - MURO_B + 6 },
  { x: MURO_L - 6, y: IY0 + FILAS * T / 2 },
];
const opuesta = (d) => (d + 2) % 4;

const CUADRO = 1000 / 60;
