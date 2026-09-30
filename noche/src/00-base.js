'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// NOCHE CARMESÍ · la base: cuentas, azar con semilla, idioma y lo que se guarda.
// ─────────────────────────────────────────────────────────────────────────────

const lim = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const CUADRO = 1000 / 60;

/** Un rng chico y rápido (mulberry32): la misma semilla, la misma partida (guía 2D § 0.5). */
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Dos azares: el del MUNDO (con semilla) y el VISUAL (chispas, temblores), así las partículas no
// le corren la secuencia a las oleadas y una prueba con semilla da siempre lo mismo.
let rnd = mulberry(1);
const A = {
  f: () => rnd(),
  ent: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
  uno: (arr) => arr[Math.floor(rnd() * arr.length)],
  si: (p) => rnd() < p,
  mezclar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
};
const V = { f: Math.random, ent: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), uno: (arr) => arr[Math.floor(Math.random() * arr.length)] };

// ── lo que se guarda entre partidas: oro, mejoras compradas, personajes, opciones, récords ──
const CLAVE_GUARDADO = "noche-carmesi-v1";
const GUARDADO_BASE = () => ({ oro: 0, mejoras: {}, personajes: { antonia: 1 }, vistos: {}, record: {}, partidas: 0, muertes: 0, kills: 0,
  op: { musica: 0.8, efectos: 0.9, numeros: 1, destellos: 1, idioma: null, duracion: 30 } });
let G = GUARDADO_BASE();
function cargar() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || "null"); if (s) G = Object.assign(GUARDADO_BASE(), s, { op: Object.assign(GUARDADO_BASE().op, s.op || {}) }); } catch (e) { /* modo privado: se juega igual, sin guardar */ }
}
function guardar() { try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(G)); } catch (e) { /* idem */ } }
cargar();

// ── idioma: todo el texto del juego es {es, en}; L() elige al dibujar (así cambiar de idioma no reinicia nada) ──
// el idioma por defecto es el inglés (pedido): el español queda a un toque en el menú y la pausa
let IDIOMA = G.op.idioma || "en";
const L = (t) => (t == null ? "" : typeof t === "string" ? t : t[IDIOMA] ?? t.es);
function cambiarIdioma() { IDIOMA = IDIOMA === "es" ? "en" : "es"; G.op.idioma = IDIOMA; guardar(); }

/** Tiempo como el original: mm:ss con el minuto en dos cifras. */
const reloj = (seg) => { seg = Math.max(0, Math.floor(seg)); return String(Math.floor(seg / 60)).padStart(2, "0") + ":" + String(seg % 60).padStart(2, "0"); };
