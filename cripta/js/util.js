// Lo chico: azar con semilla, curvas y cosas de grilla.

// mulberry32: rápido y repetible. El azar del mundo (la torre infinita) va
// con semilla; el visual (chispas, polvo) con Math.random, así un cambio en
// los efectos no mueve dónde cae una pared.
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
export const entero = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mezclar = (a, b, t) => a + (b - a) * t;
export const acercar = (x, obj, vel, dt) => x + (obj - x) * (1 - Math.exp(-vel * dt));
export const salida = (t) => 1 - (1 - t) * (1 - t);
export const rebote = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
export const salidaAtras = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

// Las cuatro direcciones, en el orden de las flechas del teclado.
export const DIRS = { arriba: [0, -1], abajo: [0, 1], izq: [-1, 0], der: [1, 0] };
export const nombreDir = (dx, dy) => (dx > 0 ? 'der' : dx < 0 ? 'izq' : dy > 0 ? 'abajo' : 'arriba');
