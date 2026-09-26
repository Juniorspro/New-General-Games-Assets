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
const OPCIONES_BASE = { calidad: TOCABLE ? "media" : "alta", sens: 1, volumen: 0.8, vehiculos: 12, minutos: 16, turno: "tarde", ayudas: true };
const STATS_BASE = { turnos: 0, mejor: 0, arrestos: 0, multas: 0, hallazgos: 0 };

// Fecha del juego: el turno arranca hoy a la tarde.
const HOY = new Date(2026, 8, 26);
const fecha = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const sumarDias = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
