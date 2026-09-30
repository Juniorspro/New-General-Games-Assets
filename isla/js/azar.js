// Azar con semilla y ruido. Todo lo que ocupa lugar en el mundo sale de acá:
// con Math.random la palmera que ayer estaba en la playa hoy estaría en el
// agua, y la partida guardada dejaría de coincidir con la isla regenerada.

export function mulberry(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function semillaDeTexto(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Hash entero → [0,1). Con Math.imul y no con `*`: los números de JavaScript
// redondean los bits bajos y el ruido sale plano sin dar ningún error.
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const suave = (t) => t * t * (3 - 2 * t);

export function ruido2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = suave(x - xi), fy = suave(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm2(x, y, s = 0, octavas = 4) {
  let suma = 0, amp = 0.5, frec = 1, norma = 0;
  for (let i = 0; i < octavas; i++) {
    suma += ruido2(x * frec, y * frec, s + i * 17) * amp;
    norma += amp; amp *= 0.5; frec *= 2.03;
  }
  return suma / norma;
}

export const rango = (r, a, b) => a + (b - a) * r();
export const entero = (r, a, b) => Math.floor(a + (b - a + 1) * r());
export const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];
export const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mezcla = (a, b, t) => a + (b - a) * t;
export const suavizado = (a, b, v) => { const t = lim((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
