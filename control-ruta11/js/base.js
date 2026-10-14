"use strict";
// ════════════════════════════════════════════════════════════════════════
// CONTROL POLICIAL: RUTA 11 — base: utilidades, opciones guardadas y datos fijos.
// Todos los scripts comparten el ámbito global (scripts clásicos, en orden).
// ════════════════════════════════════════════════════════════════════════
if (!window.THREE || !window.React || !window.ReactDOM) throw new Error("no se cargaron las librerías (three.js y React). Revisá la conexión a internet.");

function azar(semilla) { let s = semilla >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pausa = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];
const TOCABLE = matchMedia("(pointer: coarse)").matches;

function leer(clave, base) { try { const v = localStorage.getItem("ruta11:" + clave); return v ? Object.assign({}, base, JSON.parse(v)) : Object.assign({}, base); } catch (e) { return Object.assign({}, base); } }
function guardar(clave, valor) { try { localStorage.setItem("ruta11:" + clave, JSON.stringify(valor)); } catch (e) { /* sin guardado, se juega igual */ } }
const idiomaInicial = (() => { const l = (navigator.language || "es").slice(0, 2); return l === "en" ? "en" : l === "pt" ? "pt" : "es"; })();
const OPCIONES_BASE = { idioma: idiomaInicial, calidad: TOCABLE ? "media" : "alta", sens: 1, volumen: 0.8, vehiculos: 12, minutos: 16, turno: "tarde", ayudas: true, primeroFalso: true };
const STATS_BASE = { turnos: 0, mejor: 0, arrestos: 0, multas: 0, hallazgos: 0, recaudado: 0 };

// Fecha del juego: el turno arranca hoy a la tarde.
const HOY = new Date(2026, 8, 26);
const fecha = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const sumarDias = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");

// ── Teléfono parado: el juego se gira 90° por CSS, sin pedir pantalla completa ──
// El contenedor #raiz queda apaisado (ancho = alto de la pantalla) y rotado. Todo
// cálculo propio con coordenadas de puntero pasa por GIRO: pantalla → juego es
// x = clientY, y = innerWidth − clientX (y los deltas, dx = dy, dy = −dx).
const GIRO = {
  activo: false,
  aLocal(x, y) { return this.activo ? [y, innerWidth - x] : [x, y]; },
  delta(dx, dy) { return this.activo ? [dy, -dx] : [dx, dy]; },
  ancho() { return this.activo ? innerHeight : innerWidth; },
  alto() { return this.activo ? innerWidth : innerHeight; },
};
function aplicarGiro() {
  const g = TOCABLE && innerHeight > innerWidth, html = document.documentElement, r = document.getElementById("raiz");
  GIRO.activo = g; html.classList.toggle("girado", g);
  if (r) { r.style.width = g ? innerHeight + "px" : ""; r.style.height = g ? innerWidth + "px" : ""; r.style.transform = g ? `translateX(${innerWidth}px) rotate(90deg)` : ""; }
  // Clases en vez de media queries: con el giro, la ventana es vertical pero el juego no.
  html.style.setProperty("--vw", GIRO.ancho() / 100 + "px"); html.style.setProperty("--vh", GIRO.alto() / 100 + "px");
  html.classList.toggle("compacto", GIRO.alto() < 520 || GIRO.ancho() < 760);
  html.classList.toggle("vertical", GIRO.alto() > GIRO.ancho());
}
addEventListener("resize", aplicarGiro);
addEventListener("orientationchange", () => setTimeout(() => { aplicarGiro(); dispatchEvent(new Event("resize")); }, 250));
aplicarGiro();
