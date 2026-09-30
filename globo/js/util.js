// Lo chico: azar con semilla, límites, curvas y el paso del cuadro.

// mulberry32: el azar de los niveles va con semilla, así el nivel 7 es
// siempre el mismo nivel 7 (y una prueba se puede repetir igual).
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
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const tramo = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const salida = (t) => 1 - (1 - t) ** 3;
export const suave = (t) => t * t * (3 - 2 * t);
export const salidaAtras = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
// un rebote elástico que se pasa y vuelve (para lo que "salta" a la vista)
export const elastico = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
export const acercar = (x, obj, vel, dt) => x + (obj - x) * (1 - Math.exp(-vel * dt));

// El tiempo real de un cuadro partido en pasos de a lo sumo `max`: [cuántos,
// de cuánto]. Con pasos fijos y una pantalla de 90 o 120 Hz, algunos cuadros
// quedan sin moverse y se ve a tirones (pasó en Víbora).
export function trozos(dtReal, max) {
  const n = Math.max(1, Math.ceil(dtReal / max - 1e-9));
  return [n, dtReal / n];
}

// Un color más claro o más oscuro (f entre -1 y 1), para las sombras planas.
export function tono(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const m = c.map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
