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
/* amp: cuánto sube y baja; ola: qué tan largas las lomas (m); rampas y puentes: cada cuántos metros;
   agarre: por el piso (hielo < 1); viento: empuje de frente (m/s², negativo = en contra) */
export const TRAMOS = [
  { id: 'puna', semilla: 101, largo: 5000, amp: 4.5, ola: 55, pend: 0.62, rampas: 520, puentes: 0, agarre: 1, viento: 0, cielo: 'puna' },
  { id: 'quebrada', semilla: 202, largo: 5000, amp: 6.5, ola: 48, pend: 0.7, rampas: 430, puentes: 650, agarre: 1, viento: 0, cielo: 'quebrada' },
  { id: 'salinas', semilla: 303, largo: 5000, amp: 2.2, ola: 30, pend: 0.5, rampas: 260, puentes: 0, agarre: 1.08, viento: 0, cielo: 'salinas' },
  { id: 'valles', semilla: 404, largo: 5000, amp: 7.5, ola: 44, pend: 0.78, rampas: 380, puentes: 520, agarre: 1, viento: 0, cielo: 'valles' },
  { id: 'cuyo', semilla: 505, largo: 5000, amp: 9, ola: 60, pend: 0.85, rampas: 460, puentes: 700, agarre: 1, viento: 0, cielo: 'cuyo' },
  { id: 'patagonia', semilla: 606, largo: 5000, amp: 5.5, ola: 70, pend: 0.7, rampas: 400, puentes: 0, agarre: 0.95, viento: -2.2, cielo: 'patagonia' },
  { id: 'glaciar', semilla: 707, largo: 5000, amp: 7, ola: 50, pend: 0.66, rampas: 480, puentes: 600, agarre: 0.62, viento: 0, cielo: 'glaciar' },
];
export const TRAMO = Object.fromEntries(TRAMOS.map((t) => [t.id, t]));
export const MOJON = 500;

/* ---------------- generar un tramo ---------------- */
export function generarTramo(id) {
  const T = TRAMO[id], al = azar(T.semilla);
  const largo = T.largo + 160, n = Math.ceil(largo / DX) + 1, x0 = -40;
  const r1 = ruido(al, 400), r2 = ruido(al, 400), r3 = ruido(al, 400), r4 = ruido(al, 400);
  const h = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * DX;
    /* se pone más difícil a medida que se avanza (y los primeros 60 m, planos) */
    const d = Math.max(0, Math.min(1, (x - 40) / 200)) * (0.55 + 0.9 * Math.min(1, x / T.largo));
    const u = x / T.ola;
    h[i] = d * T.amp * (r1(u) * 1 + r2(u * 2.3) * 0.45 + r3(u * 5.1) * 0.16 + r4(u * 0.37) * 1.4);
  }
  /* las rampas: una subida corta y derecha, y después el piso sigue más abajo */
  const rampas = [];
  if (T.rampas) for (let x = 180 + al() * 100; x < T.largo - 60; x += T.rampas * (0.75 + al() * 0.5)) {
    const alto = 2 + al() * 2.2, larg = 7 + al() * 4, i0 = Math.floor((x - x0) / DX), i1 = Math.floor((x + larg - x0) / DX);
    for (let i = i0; i <= i1; i++) h[i] = Math.max(h[i], h[i0] + alto * (i - i0) / (i1 - i0));
    rampas.push({ x, x1: x + larg, alto });
  }
  /* la pendiente con tope: se aflojan los tramos más empinados, varias pasadas */
  const tope = T.pend * DX;
  for (let pas = 0; pas < 40; pas++) {
    let cambio = false;
    for (let i = 1; i < n; i++) {
      const dd = h[i] - h[i - 1];
      if (dd > tope) { const m = (h[i] + h[i - 1]) / 2; h[i] = m + tope / 2; h[i - 1] = m - tope / 2; cambio = true; }
      else if (dd < -tope * 1.25) { const m = (h[i] + h[i - 1]) / 2; h[i] = m - tope * 0.625; h[i - 1] = m + tope * 0.625; cambio = true; }
    }
    if (!cambio) break;
  }
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
    for (let i = ia; i <= ib; i++) h[i] = nivel;
    puentes.push({ x0: x0 + ia * DX, x1: x0 + ib * DX, y: nivel });
  }
  const S = crearSuelo(x0, DX, h);
  S.debajo = debajo; S.agarre = T.agarre; S.viento = T.viento;
  const alto = (x) => { const f = (x - x0) / DX, i = Math.max(0, Math.min(n - 2, Math.floor(f))), t = f - i; return h[i] * (1 - t) + h[i + 1] * t; };
  /* la nafta: cada vez más lejos (en las mejoras está el tanque más grande) */
  const nafta = [];
  for (let x = 170, paso = 190; x < T.largo; paso = Math.min(460, paso * 1.12), x += paso) nafta.push({ x, y: alto(x) + 0.9 });
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
