/* ============================================================================
   ruta40/js/partida.js — lo que se guarda: monedas, vehículos, mejoras,
   récords, tramos abiertos, picadas ganadas, ajustes y controles.
   Todo en localStorage; si no se puede (modo privado), anda igual sin guardar.
   ========================================================================== */
import { ORDEN_VEHICULOS, MEJORAS } from './vehiculos.js';
import { TRAMOS } from './ruta.js';

const CLAVE = 'ruta40:partida';
/* para abrir un tramo hay que llegar a tantos metros en el anterior */
export const PARA_ABRIR = 1500;

export const CONTROLES_BASE = () => ({
  modo: 'pedales', tam: 1, alfa: 0.9, lado: 'normal', vibrar: true,
  /* dónde van, en fracción de la pantalla (el centro de cada pedal) */
  pos: { freno: { x: 0.1, y: 0.8 }, gas: { x: 0.9, y: 0.78 } },
});
const NUEVA = () => ({
  v: 1, idioma: null, monedas: 0, vehiculo: 'chata',
  tengo: { chata: true },
  mejoras: Object.fromEntries(ORDEN_VEHICULOS.map((v) => [v, Object.fromEntries(MEJORAS.map((m) => [m, 0]))])),
  abiertos: { puna: true }, record: {}, llego: {}, picadas: {}, tramo: 'puna',
  vista: { intro: false, fin: false, tuto: false },
  opciones: { musica: 0.7, motor: 0.85, efectos: 0.9, radio: true, calidad: 'alta', giro: 'auto', estilo: 'folk' },
  controles: CONTROLES_BASE(),
  cuenta: { viajes: 0, metros: 0, vueltas: 0 },
});

function mezclar(base, g) {
  for (const k of Object.keys(g || {})) {
    if (g[k] && typeof g[k] === 'object' && !Array.isArray(g[k]) && base[k] && typeof base[k] === 'object') mezclar(base[k], g[k]);
    else if (g[k] !== undefined) base[k] = g[k];
  }
  return base;
}

export const P = NUEVA();
export function cargar() {
  try { const g = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (g && g.v === 1) mezclar(P, g); } catch (_) {}
  return P;
}
export function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(P)); } catch (_) {} }
export function borrar() { const idi = P.idioma; for (const k of Object.keys(P)) delete P[k]; Object.assign(P, NUEVA(), { idioma: idi }); guardar(); }

/* después de un viaje: el récord, y si se abre el tramo siguiente */
export function anotarViaje(tramo, metros, llego) {
  P.cuenta.viajes++; P.cuenta.metros += metros;
  const nuevo = metros > (P.record[tramo] || 0);
  if (nuevo) P.record[tramo] = Math.floor(metros);
  if (llego) P.llego[tramo] = true;
  const i = TRAMOS.findIndex((t) => t.id === tramo);
  let abrio = null;
  if (i >= 0 && i + 1 < TRAMOS.length && metros >= PARA_ABRIR && !P.abiertos[TRAMOS[i + 1].id]) { P.abiertos[TRAMOS[i + 1].id] = true; abrio = TRAMOS[i + 1].id; }
  guardar();
  return { nuevo, abrio };
}
