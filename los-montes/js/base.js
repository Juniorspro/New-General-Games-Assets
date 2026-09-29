"use strict";
// ════════════════════════════════════════════════════════════════════════
// LOS MONTES — base: utilidades, opciones guardadas, giro del teléfono y el
// mapa del valle (los lugares con sus coordenadas). Scripts clásicos que
// comparten el ámbito global, en el orden de index.html.
// ════════════════════════════════════════════════════════════════════════
if (!window.THREE || !window.React || !window.ReactDOM) throw new Error("no se cargaron las librerías (three.js y React). Revisá la conexión a internet.");

function azar(semilla) { let s = semilla >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pausa = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const TOCABLE = matchMedia("(pointer: coarse)").matches;

// ── Ruido de valor 2D (determinista): el relieve y la densidad del bosque salen de acá ──
const Ruido = (() => {
  const P = new Uint8Array(512), r = azar(1962);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const h = (x, y) => P[(P[x & 255] + y) & 511] / 255;
  function valor(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
  }
  function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * valor(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  // Crestas: 1 − |ruido|, para las aristas de las montañas.
  function crestas(x, y, oct = 5) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(valor(x * f, y * f))); n += a; a *= 0.5; f *= 2.1; } return s / n; }
  return { valor, fbm, crestas };
})();

function leer(clave, base) { try { const v = localStorage.getItem("montes:" + clave); return v ? Object.assign({}, base, JSON.parse(v)) : Object.assign({}, base); } catch (e) { return Object.assign({}, base); } }
function guardar(clave, valor) { try { localStorage.setItem("montes:" + clave, JSON.stringify(valor)); } catch (e) { /* sin guardado, se juega igual */ } }
const idiomaInicial = (() => { const l = (navigator.language || "es").slice(0, 2); return l === "en" ? "en" : l === "pt" ? "pt" : "es"; })();
const OPCIONES_BASE = {
  idioma: idiomaInicial, calidad: TOCABLE ? "media" : "alta", sens: 1, volumen: 0.85, musica: 0.6, invertirY: false,
  dificultad: "normal", rol: "combatiente", companeros: 1, subtitulos: true, brillo: 1,
};
const STATS_BASE = { partidas: 0, rescatados: 0, mejorRescate: 0, bajas: 0, muertes: 0, finales: 0, minutos: 0 };
// Pistas encontradas (se guardan entre partidas: el Diario del menú las muestra).
const DIARIO_BASE = { pistas: [] };

// ── Teléfono parado: el juego se gira 90° por CSS, sin pantalla completa ──
// #raiz queda apaisado (ancho = alto de la pantalla) y rotado. Todo cálculo con
// coordenadas de puntero pasa por GIRO: pantalla → juego es x = clientY,
// y = innerWidth − clientX; los deltas, dx = dy, dy = −dx.
const GIRO = {
  activo: false,
  aLocal(x, y) { return this.activo ? [y, innerWidth - x] : [x, y]; },
  aPantalla(x, y) { return this.activo ? [innerWidth - y, x] : [x, y]; },
  delta(dx, dy) { return this.activo ? [dy, -dx] : [dx, dy]; },
  ancho() { return this.activo ? innerHeight : innerWidth; },
  alto() { return this.activo ? innerWidth : innerHeight; },
};
function aplicarGiro() {
  const g = TOCABLE && innerHeight > innerWidth, html = document.documentElement, r = document.getElementById("raiz");
  GIRO.activo = g; html.classList.toggle("girado", g);
  if (r) { r.style.width = g ? innerHeight + "px" : ""; r.style.height = g ? innerWidth + "px" : ""; r.style.transform = g ? `translateX(${innerWidth}px) rotate(90deg)` : ""; }
  // Clases en vez de media queries: con el giro la ventana es vertical pero el juego no.
  html.style.setProperty("--vw", GIRO.ancho() / 100 + "px"); html.style.setProperty("--vh", GIRO.alto() / 100 + "px");
  html.classList.toggle("compacto", GIRO.alto() < 520 || GIRO.ancho() < 760);
  html.classList.toggle("tactil", TOCABLE);
}
addEventListener("resize", aplicarGiro);
addEventListener("orientationchange", () => setTimeout(() => { aplicarGiro(); dispatchEvent(new Event("resize")); }, 250));
aplicarGiro();

// ════════════════════════════════════════════════════════════════════════
// EL VALLE. x crece al este, z al sur; y es la altura (m). El valle mide
// 1.700 m por lado y lo rodean montañas de 300 a 700 m. El río nace en el
// lago (al norte), pasa por el claro de las cabañas y sale al sur, por donde
// llega la ruta de tierra.
// ════════════════════════════════════════════════════════════════════════
const MAPA = {
  lado: 1700,
  lago: { x: -10, z: -170, rx: 150, rz: 95 },
  // Río: desde la boca del lago hasta la salida del valle. Ancho en metros.
  rio: [[-5, -80], [8, -20], [30, 40], [48, 95], [44, 150], [70, 230], [110, 320], [120, 420], [150, 560], [140, 900]],
  anchoRio: 11,
  // Cascadas que caen al lago desde los acantilados del norte (x, z, alto, ancho).
  cascadas: [{ x: -95, z: -300, alto: 70, ancho: 9 }, { x: 150, z: -285, alto: 55, ancho: 7 }, { x: -230, z: -250, alto: 38, ancho: 5 }],
  // Ruta de tierra: entra por el sur y llega al claro; ramales al aserradero, la mina y el cementerio.
  ruta: [[30, 850], [20, 700], [-10, 560], [-40, 420], [-50, 300], [-60, 200], [-50, 150]],
  ramales: [
    [[-50, 300], [60, 280], [180, 250], [300, 230], [390, 215]],            // al aserradero (cruza el río en el vado)
    [[-60, 200], [-160, 160], [-260, 110], [-350, 40], [-410, -40]],        // a la mina (lo corta un tronco: la grúa)
    [[-40, 420], [-120, 400], [-200, 360]],                                 // al cementerio
  ],
  puente: { x: 44, z: 150, largo: 20, rumbo: 0 },
  // Lugares: centro, radio aplanado y qué hay.
  lugares: {
    claro:      { x: -40, z: 150, r: 38, nombre: "claro" },     // cabañas de la referencia y las camionetas
    cabanaEste: { x: 120, z: 95, r: 16, nombre: "cabanaEste" },
    lagoCabana: { x: -120, z: -85, r: 14, nombre: "lagoCabana" },
    aserradero: { x: 400, z: 215, r: 45, nombre: "aserradero" },
    mina:       { x: -420, z: -50, r: 30, nombre: "mina" },
    cementerio: { x: -205, z: 360, r: 22, nombre: "cementerio" },
    campamento: { x: -300, z: 470, r: 34, nombre: "campamento" }, // en lo hondo del bosque, sin camino
    cueva:      { x: 205, z: -250, r: 12, nombre: "cueva" },       // detrás de la cascada chica
    torre:      { x: 280, z: 520, r: 14, nombre: "torre" },        // torre de guardaparques caída
    salida:     { x: 30, z: 800, r: 25, nombre: "salida" },        // tranquera de la ruta: por acá se escapa
  },
};
