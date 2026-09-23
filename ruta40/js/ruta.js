/* ============================================================================
   ruta40/js/ruta.js — los tramos de la Ruta 40, de la Puna al Glaciar.
   Cada tramo se genera igual siempre (semilla): el terreno como una
   polilínea cada 25 cm, los bidones de nafta, las monedas, los mojones cada
   500 m, las rampas y los puentes. La física solo ve el piso; el dibujo ve
   además lo que hay debajo de los puentes y los adornos.

   La pendiente nunca pasa de un tope (se suaviza hasta que no quede ninguna
   pared): así ningún tramo depende de un choque imposible, y el bot que los
   comprueba (pruebas/bot.mjs) maneja con la misma física que el jugador.
   ========================================================================== */
import { crearSuelo } from './fisica.js';

export const DX = 0.25;

/* azar con semilla (mulberry32) */
export function azar(s) { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* ruido suave de una dimensión: valores al azar cada 1 unidad, unidos con coseno */
function ruido(al, n) {
  const v = Array.from({ length: n + 2 }, () => al() * 2 - 1);
  const L = v.length, en = (i) => v[((i % L) + L) % L];
  return (x) => { const i = Math.floor(x), t = x - i, k = (1 - Math.cos(t * Math.PI)) / 2; return en(i) * (1 - k) + en(i + 1) * k; };
}

/* ---------------- los tramos ---------------- */
/* Cada número va [al principio, al final]: el tramo se pone difícil de a poco.
   amp: cuánto sube y baja (m) · ola: qué tan largas las lomas (m) · pend: la pendiente más
   empinada que se permite · nafta: cada cuántos metros hay un bidón · rampas y puentes:
   cada cuántos metros · agarre: el del piso (hielo < 1) · viento: empuje (m/s², negativo en contra) */
export const TRAMOS = [
  { id: 'puna', semilla: 101, largo: 5000, amp: [2.5, 10], ola: [60, 48], pend: [0.42, 0.9], nafta: [220, 720], rampas: 520, puentes: 0, agarre: 1, viento: 0 },
  { id: 'quebrada', semilla: 202, largo: 5000, amp: [4, 13], ola: [52, 42], pend: [0.5, 0.98], nafta: [240, 700], rampas: 430, puentes: 650, agarre: 1, viento: 0 },
  { id: 'salinas', semilla: 303, largo: 5000, amp: [1.2, 4.5], ola: [34, 28], pend: [0.4, 0.75], nafta: [320, 900], rampas: 230, puentes: 0, agarre: 1.08, viento: 0 },
  { id: 'valles', semilla: 404, largo: 5000, amp: [5, 15], ola: [46, 38], pend: [0.55, 1.05], nafta: [250, 700], rampas: 380, puentes: 520, agarre: 1, viento: 0 },
  { id: 'cuyo', semilla: 505, largo: 5000, amp: [6, 18], ola: [62, 50], pend: [0.6, 1.12], nafta: [260, 720], rampas: 460, puentes: 700, agarre: 1, viento: 0 },
  { id: 'patagonia', semilla: 606, largo: 5000, amp: [3.5, 10], ola: [75, 60], pend: [0.5, 0.92], nafta: [300, 820], rampas: 400, puentes: 0, agarre: 0.95, viento: -2.4 },
  { id: 'glaciar', semilla: 707, largo: 5000, amp: [4, 13], ola: [52, 44], pend: [0.45, 0.9], nafta: [260, 720], rampas: 480, puentes: 600, agarre: 0.62, viento: 0 },
];
export const TRAMO = Object.fromEntries(TRAMOS.map((t) => [t.id, t]));
export const MOJON = 500;

/* ---------------- generar un tramo ---------------- */
const mezcla = ([a, b], t) => a + (b - a) * Math.max(0, Math.min(1, t));

export function generarTramo(id) {
  const T = TRAMO[id], al = azar(T.semilla);
  const largo = T.largo + 160, n = Math.ceil(largo / DX) + 1, x0 = -40;
  const r1 = ruido(al, 400), r2 = ruido(al, 400), r3 = ruido(al, 400), r4 = ruido(al, 400);
  const h = new Float64Array(n);
  /* la ola cambia de largo: se integra la frecuencia para que no se arrugue el terreno */
  let u = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * DX, f = Math.max(0, x) / T.largo;
    u += DX / mezcla(T.ola, f);
    /* los primeros 60 m, planos; después crece de a poco */
    const d = Math.max(0, Math.min(1, (x - 60) / 160)) * mezcla(T.amp, f);
    h[i] = d * (r1(u) * 1 + r2(u * 2.3) * 0.42 + r3(u * 5.1) * 0.14 + r4(u * 0.37) * 1.3);
  }
  /* las rampas: una subida corta y empinada, un rellano y una bajada larga y suave para caer.
     Así el que llega rápido vuela, y el que llega despacio pasa igual (con una caída del otro
     lado se quedaban todos colgados de la panza en la cresta) */
  const rampas = [];
  if (T.rampas) for (let x = 180 + al() * 100; x < T.largo - 60; x += T.rampas * (0.75 + al() * 0.5)) {
    const alto = 1.8 + al() * 2, larg = 7 + al() * 4, i0 = Math.floor((x - x0) / DX), i1 = Math.floor((x + larg - x0) / DX), i2 = i1 + 6;
    const cima = h[i0] + alto;
    for (let i = i0; i <= i2; i++) h[i] = Math.max(h[i], h[i0] + alto * Math.min(1, (i - i0) / (i1 - i0)));
    let i3 = i2;
    for (let i = i2 + 1; i < n && cima - (i - i2) * DX * 0.4 > h[i]; i++) { h[i] = cima - (i - i2) * DX * 0.4; i3 = i; }
    rampas.push({ x, x1: x + larg, x2: x0 + i2 * DX, x3: x0 + i3 * DX, alto });
  }
  /* la pendiente con tope (que crece con la distancia): se aflojan los tramos más empinados */
  for (let pas = 0; pas < 60; pas++) {
    let cambio = false;
    for (let i = 1; i < n; i++) {
      const tope = mezcla(T.pend, (x0 + i * DX) / T.largo) * DX;
      const dd = h[i] - h[i - 1];
      if (dd > tope) { const m = (h[i] + h[i - 1]) / 2; h[i] = m + tope / 2; h[i - 1] = m - tope / 2; cambio = true; }
      else if (dd < -tope * 1.25) { const m = (h[i] + h[i - 1]) / 2; h[i] = m - tope * 0.625; h[i - 1] = m + tope * 0.625; cambio = true; }
    }
    if (!cambio) break;
  }
  /* redondear las esquinas: una cresta filosa deja colgado de la panza a cualquiera */
  const suavizar = (i0, i1, veces) => {
    for (let v = 0; v < veces; v++) { let prev = h[i0 - 1]; for (let i = Math.max(1, i0); i < Math.min(n - 1, i1); i++) { const c = h[i]; h[i] = prev * 0.25 + c * 0.5 + h[i + 1] * 0.25; prev = c; } }
  };
  suavizar(1, n - 1, 2);
  for (const r of rampas) { const ia = Math.floor((r.x1 - x0) / DX) - 4, ib = Math.floor((r.x2 - x0) / DX) + 10; suavizar(ia, ib, 8); }
  /* los puentes: donde el terreno hace un pozo, un tablero recto de lado a lado */
  const debajo = Float64Array.from(h), puentes = [];
  if (T.puentes) for (let x = 300 + al() * 150; x < T.largo - 80; x += T.puentes * (0.8 + al() * 0.4)) {
    /* buscar cerca un pozo: el punto más bajo en ±40 m */
    const ic = Math.floor((x - x0) / DX);
    let imin = ic;
    for (let i = ic - 160; i < ic + 160; i++) if (i > 0 && i < n && h[i] < h[imin]) imin = i;
    /* los bordes: a los dos lados, donde el terreno vuelve a la altura del tablero */
    let ia = imin, ib = imin;
    while (ia > 1 && h[ia - 1] >= h[ia]) ia--;
    while (ib < n - 2 && h[ib + 1] >= h[ib]) ib++;
    const nivel = Math.min(h[ia], h[ib]) - 0.2;
    if (nivel - h[imin] < 1.5) continue;
    while (ia < imin && h[ia] > nivel) ia++;
    while (ib > imin && h[ib] > nivel) ib--;
    if ((ib - ia) * DX < 8) continue;
    /* un puente encima de una rampa la corta y deja un pozo donde se traba cualquiera */
    const xa = x0 + ia * DX, xb = x0 + ib * DX;
    if (rampas.some((r) => r.x3 > xa - 25 && r.x < xb + 25)) continue;
    for (let i = ia; i <= ib; i++) h[i] = nivel;
    puentes.push({ x0: x0 + ia * DX, x1: x0 + ib * DX, y: nivel });
  }
  const S = crearSuelo(x0, DX, h);
  S.debajo = debajo; S.agarre = T.agarre; S.viento = T.viento;
  const alto = (x) => { const f = (x - x0) / DX, i = Math.max(0, Math.min(n - 2, Math.floor(f))), t = f - i; return h[i] * (1 - t) + h[i + 1] * t; };
  /* la nafta: cada vez más lejos (en las mejoras está el tanque más grande) */
  const nafta = [];
  for (let x = 170; x < T.largo; x += mezcla(T.nafta, x / T.largo)) nafta.push({ x, y: alto(x) + 0.9 });
  /* las monedas: tiras que siguen el terreno; las más valiosas, en el aire después de las rampas */
  const monedas = [];
  for (let x = 60; x < T.largo; x += 45 + al() * 70) {
    const cant = 4 + Math.floor(al() * 6), valor = al() < 0.08 ? 100 : al() < 0.3 ? 25 : 5;
    for (let k = 0; k < cant; k++) { const mx = x + k * 1.3; if (nafta.some((q) => Math.abs(q.x - mx) < 3)) continue; monedas.push({ x: mx, y: alto(mx) + 1.1, v: valor }); }
  }
  for (const r of rampas) for (let k = 0; k < 6; k++) { const mx = r.x1 + 4 + k * 2.2; monedas.push({ x: mx, y: alto(r.x1) + 2.2 + Math.sin(k / 5 * Math.PI) * 2.5, v: 25 }); }
  const mojones = [];
  for (let x = MOJON; x <= T.largo; x += MOJON) mojones.push({ x, y: alto(x) });
  return { id, T, S, rampas, puentes, nafta, monedas, mojones, largo: T.largo, alto };
}
