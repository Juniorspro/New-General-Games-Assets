// ─────────────────────────────────────────────────────────────────────────────
// ABYSSFALL · la base: cuentas, azar con semilla, lo que se guarda, el idioma y las paletas.
// Todo el juego se dibuja con TRES colores lógicos (fondo, tinta, acento): cambiar de paleta es
// cambiar esos tres y rehornear los sprites. Así se ve siempre coherente, como el género pide.
// ─────────────────────────────────────────────────────────────────────────────

const lim = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const CUADRO = 1000 / 60;
const sig = (x) => (x < 0 ? -1 : x > 0 ? 1 : 0);

/** mulberry32: la misma semilla, el mismo pozo. */
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// el azar del MUNDO (con semilla) y el VISUAL (chispas): separados, así una prueba da siempre lo mismo
let rnd = mulberry(1);
const A = {
  f: () => rnd(), ent: (a, b) => a + Math.floor(rnd() * (b - a + 1)), uno: (arr) => arr[Math.floor(rnd() * arr.length)], si: (p) => rnd() < p,
  mezclar(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
};
const V = { f: Math.random, ent: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), uno: (arr) => arr[Math.floor(Math.random() * arr.length)] };

// ── lo que se guarda: gemas del banco, paletas, estilos, récords, opciones ──
const CLAVE = "abyssfall-v1";
const BASE_G = () => ({ banco: 0, totalGemas: 0, paleta: "clasica", estilo: "normal", estilos: { normal: 1 }, record: { prof: 0, gemas: 0, combo: 0 }, partidas: 0, ganadas: 0,
  op: { musica: 0.8, efectos: 0.9, temblor: 1, idioma: null } });
let G = BASE_G();
try { const s = JSON.parse(localStorage.getItem(CLAVE) || "null"); if (s) G = Object.assign(BASE_G(), s, { op: Object.assign(BASE_G().op, s.op || {}), record: Object.assign(BASE_G().record, s.record || {}) }); } catch (e) { /* modo privado */ }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) { /* idem */ } }

// ── idioma: inglés por defecto (el título es inglés); el español a un toque ──
let IDIOMA = G.op.idioma || "en";
const L = (t) => (t == null ? "" : typeof t === "string" ? t : t[IDIOMA] ?? t.en);
function cambiarIdioma() { IDIOMA = IDIOMA === "es" ? "en" : "es"; G.op.idioma = IDIOMA; guardar(); }

// ── las paletas: [fondo, tinta, acento]; se desbloquean con las gemas juntadas en total ──
const PALETAS = {
  clasica: { n: "CLASSIC", c: ["#000000", "#ffffff", "#ee1133"], precio: 0 },
  hueso: { n: "BONE", c: ["#140e0c", "#f2e8d4", "#d8a33a"], precio: 800 },
  musgo: { n: "MOSS", c: ["#08140c", "#d6f2c0", "#46c04a"], precio: 1600 },
  abismo: { n: "ABYSS", c: ["#050818", "#cfe4ff", "#3a8cff"], precio: 2600 },
  brasa: { n: "EMBER", c: ["#1a0703", "#ffe2c4", "#ff6a14"], precio: 3800 },
  orquidea: { n: "ORCHID", c: ["#120818", "#f6e4ff", "#d63cc8"], precio: 5200 },
  vacio: { n: "VOID", c: ["#f4f0ea", "#101010", "#ee1133"], precio: 7000 },
};
let PALA = PALETAS[G.paleta] || PALETAS.clasica;
let [C_FONDO, C_TINTA, C_ACENTO] = PALA.c;
function ponerPaleta(k) {
  G.paleta = k; PALA = PALETAS[k]; [C_FONDO, C_TINTA, C_ACENTO] = PALA.c; guardar();
  for (const key of Object.keys(SPR)) delete SPR[key];        // se rehornea todo con los colores nuevos
}
