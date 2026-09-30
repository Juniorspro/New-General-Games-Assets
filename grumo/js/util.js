// Lo chico: azar con semilla, límites, curvas y el paso del cuadro.

// mulberry32: el azar va con semilla, así la plastilina de un nivel es
// siempre la misma (y una prueba se puede repetir igual).
export function azar(semilla) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entre = (a, b) => a + (b - a) * r();
  r.entero = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.uno = (lista) => lista[Math.floor(r() * lista.length)];
  return r;
}
// un número al azar fijo para (a, b, c): el "hervor" de la plastilina cambia
// de cuadro en cuadro pero el cuadro 7 es siempre igual
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const tramo = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const salida = (t) => 1 - (1 - t) ** 3;
export const entrada = (t) => t * t;
export const suave = (t) => t * t * (3 - 2 * t);
export const salidaAtras = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
// un rebote elástico que se pasa y vuelve (para lo que "salta" a la vista)
export const elastico = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
export const acercar = (x, obj, vel, dt) => x + (obj - x) * (1 - Math.exp(-vel * dt));
// de x hacia obj, de a lo sumo `paso`
export const hacia = (x, obj, paso) => (x < obj ? Math.min(obj, x + paso) : Math.max(obj, x - paso));

// El tiempo real de un cuadro partido en pasos de a lo sumo `max`: [cuántos,
// de cuánto]. Con pasos fijos y una pantalla de 90 o 120 Hz, algunos cuadros
// quedan sin moverse y se ve a tirones (pasó en Víbora).
export function trozos(dtReal, max) {
  const n = Math.max(1, Math.ceil(dtReal / max - 1e-9));
  return [n, dtReal / n];
}

// Un color más claro o más oscuro (f entre -1 y 1).
export function tono(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const m = c.map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// mezclar dos colores (#rrggbb) en k (0 = a, 1 = b)
export function mezcla(a, b, k) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((na >> s) & 255) * (1 - k) + ((nb >> s) & 255) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
