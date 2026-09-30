// Lo chico: azar con semilla, ángulos y límites.

// mulberry32: el azar del mundo (dónde nace la comida, qué hacen los bots)
// va con semilla, así una prueba se puede repetir igual.
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mezclar = (a, b, t) => a + (b - a) * t;
export const acercar = (x, obj, vel, dt) => x + (obj - x) * (1 - Math.exp(-vel * dt));
// La diferencia más corta entre dos ángulos, en (-π, π].
export function difAng(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export const salida = (t) => 1 - (1 - t) * (1 - t);
export const salidaAtras = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
// El tiempo real de un cuadro partido en pasos de a lo sumo `max`: [cuántos,
// de cuánto]. Con pasos fijos de 1/60 y una pantalla de 90 o 120 Hz, uno de
// cada dos o tres cuadros quedaba sin moverse y la víbora iba a tirones.
export function trozos(dtReal, max) {
  const n = Math.max(1, Math.ceil(dtReal / max - 1e-9));
  return [n, dtReal / n];
}
