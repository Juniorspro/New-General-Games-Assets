// ─────────────────────────────────────────────────────────────────────────────
// WYRMGUARD · la base: cuentas, azar con semilla, colores, lo que se guarda y el idioma.
// Un homenaje a SNKRX (a327ex): una víbora de héroes que atacan solos; vos sólo doblás.
// Las reglas y los números salen del código del original (MIT, github.com/a327ex/SNKRX);
// el código, el arte, los nombres y el sonido de acá son nuestros.
// ─────────────────────────────────────────────────────────────────────────────

const lim = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angulo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
/** La diferencia entre dos ángulos, en (-π, π]. */
function difAng(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

/** mulberry32: la misma semilla, la misma partida (las pruebas dan siempre lo mismo). */
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// el azar del JUEGO (tienda, oleadas, críticos) y el VISUAL (chispas) van separados
let rnd = mulberry(Date.now() & 0xffffff);
const A = {
  f: () => rnd(), r: (a, b) => a + rnd() * (b - a), ent: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
  uno: (arr) => arr[Math.floor(rnd() * arr.length)], si: (pct) => rnd() * 100 < pct,
  mezclar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  /** Elige un índice según pesos (como el `weighted_pick` del original). */
  peso(pesos) { let t = 0; for (const p of pesos) t += p || 0; let x = rnd() * t; for (let i = 0; i < pesos.length; i++) { x -= pesos[i] || 0; if (x < 0) return i; } return pesos.length - 1; },
};
const V = { f: Math.random, r: (a, b) => a + Math.random() * (b - a), uno: (arr) => arr[Math.floor(Math.random() * arr.length)] };

// ── los colores: los mismos del original (shared.lua), con su rampa de a 2,5 % ──
const COL = {
  bg: "#303030", fg: "#dadada", fgAlt: "#b0a89f", yellow: "#facf00", orange: "#f07021", blue: "#019bd6",
  green: "#8bbf40", red: "#e91d39", purple: "#8e559e", blue2: "#4778ba", yellow2: "#f59f10", white: "#ffffff", black: "#000000",
};
const _hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const _rampa = new Map();
/** rampa("bg", 5) = el gris de fondo 12,5 % más claro; negativos, más oscuro (ColorRamp del original). */
function rampa(nom, i = 0) {
  const k = nom + i; let v = _rampa.get(k);
  if (!v) { const [r, g2, b] = _hex(COL[nom] || nom); const f = (c) => lim(Math.round(c + 255 * 0.025 * i), 0, 255); v = `rgb(${f(r)},${f(g2)},${f(b)})`; _rampa.set(k, v); }
  return v;
}
function alfa(nom, a) { const [r, g2, b] = _hex(COL[nom] || nom); return `rgba(${r},${g2},${b},${a})`; }

// ── lo que se guarda: opciones, la partida en curso, el NG+ ganado y récords ──
const CLAVE = "wyrmguard-v1";
const BASE_G = () => ({ op: { musica: 0.8, efectos: 0.9, temblor: 1, idioma: null, rapido: false }, ngMax: 0, ng: 0, partida: null,
  record: { nivel: 0, ganadas: 0, partidas: 0 }, vistoGuia: false });
let G = BASE_G();
try { const s = JSON.parse(localStorage.getItem(CLAVE) || "null"); if (s) G = Object.assign(BASE_G(), s, { op: Object.assign(BASE_G().op, s.op || {}), record: Object.assign(BASE_G().record, s.record || {}) }); } catch (e) { /* sin localStorage: se juega igual */ }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) { /* idem */ } }

// ── idioma: inglés por defecto (lo pidió); el castellano a un toque en Opciones ──
let IDIOMA = G.op.idioma || "en";
/** L({en, es}) o L("texto") → el texto en el idioma de ahora. */
const L = (t) => (t == null ? "" : typeof t === "string" ? t : t[IDIOMA] ?? t.en);
function cambiarIdioma() { IDIOMA = IDIOMA === "es" ? "en" : "es"; G.op.idioma = IDIOMA; guardar(); }
