/* kuntur/js/azar.js — azar con semilla y ruido suave, igual en cada corrida */
export function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const suave = (t) => t * t * (3 - 2 * t);
/* ruido de valor en 2D, entre 0 y 1 */
export function ruido(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = suave(x - x0), fy = suave(y - y0);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s, oct) {
  let v = 0, a = 0.5, f = 1, t = 0;
  for (let i = 0; i < (oct || 4); i++) { v += ruido(x * f, y * f, s + i * 17) * a; t += a; a *= 0.5; f *= 2.03; }
  return v / t;
}
export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mezclar = (a, b, k) => a + (b - a) * k;
export const suavizar = suave;
