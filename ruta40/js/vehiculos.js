/* ============================================================================
   ruta40/js/vehiculos.js — las fichas de los vehículos.
   La forma (dónde van las ruedas, el contorno que choca, dónde está la
   cabeza) sale de medir los dibujos: la escribe herramientas/procesar_arte.py
   en medidas.js. Acá va cómo se manejan.

   Metros, con y para arriba y x para adelante, desde el centro de masa.
   ruedas[0] es la de atrás. La suspensión se monta de modo que, parado en el
   plano, la rueda quede justo donde está dibujada.
   ========================================================================== */
import { MEDIDAS } from './medidas.js';

const G = 9.8;

/* com: el centro de masa, medido desde el medio de los ejes (m).
   motor.torque y motor.giro (velocidad de la rueda en m/s) · agarre: μ ·
   reaccion: cuánto levanta la trompa el motor · aireGiro: cuánto gira en el aire
   (rad/s²) · tanque: segundos a fondo · precio y base (el precio de la primera mejora) */
const FICHAS = {
  /* la chata: la camioneta de campo de siempre. Pareja en todo. */
  chata: {
    masa: 1, com: [0.02, 0.36], inercia: 1.45,
    motor: { torque: 3.4, giro: 17, freno: 5 }, agarre: 1.15,
    susp: { k: 34, c: 2.7, reposo: 0.34 }, reaccion: 0.55, aireGiro: 4.4,
    tanque: 26, consumo: 1, traccion: 'atras', precio: 0, base: 120,
    placa: 'RT 040 AR', color: '#8cc6e8', polvo: 1,
    ruido: { base: 34, sube: 120, filtro: 900, tipo: 'nafta' },
  },
  /* el escarabajo: livianito, gasta poco y da vueltas en el aire como nada; en las subidas sufre */
  escarabajo: {
    masa: 0.72, com: [-0.1, 0.34], inercia: 0.62,
    motor: { torque: 2.0, giro: 20, freno: 3.6 }, agarre: 1.02,
    susp: { k: 27, c: 2, reposo: 0.28 }, reaccion: 0.62, aireGiro: 6.2,
    tanque: 26, consumo: 0.8, traccion: 'atras', precio: 6000, base: 160,
    placa: 'FT 600 AR', color: '#c8453b', polvo: 0.8,
    ruido: { base: 52, sube: 170, filtro: 1500, tipo: 'aire' },
  },
  /* el colectivo: pesado, largo y con tanque de viaje; no hay loma que lo vuelque, pero cuesta subirlo */
  colectivo: {
    masa: 2.3, com: [0.1, 0.7], inercia: 6.2,
    motor: { torque: 6.8, giro: 15.5, freno: 11 }, agarre: 1.12,
    susp: { k: 74, c: 6.2, reposo: 0.34 }, reaccion: 0.32, aireGiro: 2.1,
    tanque: 42, consumo: 1.25, traccion: 'atras', precio: 18000, base: 230,
    placa: 'LN 060 BA', color: '#f2c233', polvo: 1.4,
    ruido: { base: 26, sube: 82, filtro: 650, tipo: 'gasoil' },
  },
  /* la cuatro por cuatro: tracción en las dos, cubiertas de barro, trepa paredes */
  cuatro: {
    masa: 1.25, com: [0.05, 0.4], inercia: 1.4,
    motor: { torque: 4.6, giro: 17.5, freno: 6.5 }, agarre: 1.34,
    susp: { k: 40, c: 3.1, reposo: 0.4 }, reaccion: 0.48, aireGiro: 4,
    tanque: 30, consumo: 1.15, traccion: 'ambas', precio: 40000, base: 330,
    placa: 'TT 404 MZ', color: '#6f7a45', polvo: 1.2,
    ruido: { base: 30, sube: 105, filtro: 800, tipo: 'v8' },
  },
  /* el tractor: lento y terco; con la rueda grande de atrás sube lo que sea, y se para de manos */
  tractor: {
    masa: 1.6, com: [-0.55, 0.42], inercia: 1.5,
    motor: { torque: 8.4, giro: 11, freno: 9 }, agarre: 1.6,
    susp: { k: 62, c: 5, reposo: 0.22 }, reaccion: 0.6, aireGiro: 2.6,
    tanque: 36, consumo: 0.85, traccion: 'atras', precio: 75000, base: 420,
    placa: 'AG 070 CH', color: '#e7792b', polvo: 1.5,
    ruido: { base: 17, sube: 44, filtro: 520, tipo: 'tractor' },
  },
};
export const ORDEN_VEHICULOS = ['chata', 'escarabajo', 'colectivo', 'cuatro', 'tractor'];

function armar(id) {
  const F = FICHAS[id], M = MEDIDAS.vehiculos[id];
  const [cx, cy] = F.com;
  const [wr, wf] = M.ruedas;
  /* la carga de cada rueda parado en el plano, para montar la suspensión donde va */
  const xr = wr.x - cx, xf = wf.x - cx;
  const parte = [xf / (xf - xr), -xr / (xf - xr)];
  const ruedas = M.ruedas.map((r, i) => {
    const hunde = F.masa * G * parte[i] / F.susp.k;
    const quieto = F.susp.reposo - hunde;
    return { x: r.x - cx, y: r.y - cy + quieto, yDib: r.y - cy, r: r.r, reposo: F.susp.reposo, masa: 0.13 * F.masa * (r.r / 0.42) };
  });
  /* el contorno que choca: la panza entre las ruedas se sube hasta el eje (si no, cualquier
     loma lo deja colgado de la panza) y se ponen puntos cada 45 cm, para que una cresta no
     pase entre dos puntos sin tocarlos */
  const ejeY = -cy, x0 = wr.x - cx + wr.r * 0.6, x1 = wf.x - cx - wf.r * 0.6;
  const borde = M.casco.map(([x, y]) => [x - cx, y - cy]).map(([x, y]) => [x, x > x0 && x < x1 ? Math.max(y, ejeY) : y]);
  const casco = [];
  for (let i = 0; i < borde.length; i++) {
    const [ax, ay] = borde[i], [bx, by] = borde[(i + 1) % borde.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.45));
    for (let k = 0; k < n; k++) casco.push([+(ax + (bx - ax) * k / n).toFixed(3), +(ay + (by - ay) * k / n).toFixed(3)]);
  }
  const cab = { x: M.cabeza.x - cx, y: M.cabeza.y - cy };
  /* el techo que está arriba de la cabeza: si toca el piso, es como si tocara la cabeza */
  const encima = borde.filter(([x]) => Math.abs(x - cab.x) < 0.9).reduce((m, [, y]) => Math.max(m, y), cab.y);
  cab.r = Math.max(0.3, Math.min(0.5, encima - cab.y + 0.06));
  return {
    id, ...F, ruedas, casco, cabeza: cab,
    susp: { k: F.susp.k, c: F.susp.c },
    sprite: { img: M.img, w: M.w, h: M.h, ppm: M.ppm, ox: M.ox + cx * M.ppm, oy: M.oy - cy * M.ppm },
    llanta: M.llanta, largo: M.largo,
  };
}
export const VEHICULOS = Object.fromEntries(ORDEN_VEHICULOS.map((id) => [id, armar(id)]));

/* ---------------- las mejoras ---------------- */
export const MEJORAS = ['motor', 'llantas', 'susp', 'tanque', 'aire'];
export const NIVEL_MAX = 10;
/* lo que cuesta subir del nivel n al n+1 */
export function precioMejora(id, n) {
  if (n >= NIVEL_MAX) return Infinity;
  return Math.round(VEHICULOS[id].base * Math.pow(n + 1, 1.45) / 10) * 10;
}
/* de los niveles guardados (0 a 10) a lo que entiende la física (0 a 1) */
export const aFisica = (niv = {}) => Object.fromEntries(MEJORAS.map((m) => [m, (niv[m] || 0) / NIVEL_MAX]));
