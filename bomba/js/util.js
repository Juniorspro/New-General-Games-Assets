// Lo chico que usan todos: números a lo simulador (1.2K, 3.4M), azar con
// semilla, suavizados y curvas.

const SUFIJOS = ['', 'K', 'M', 'B', 'T', 'Qd', 'Qn', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// 1234 → "1.23K": tres cifras siempre (como los simuladores), sin ceros de más.
export function corto(n) {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    const s = n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
    return (neg ? '-' : '') + s.replace(/\.0$/, '');
  }
  let k = 0;
  while (n >= 1000 && k < SUFIJOS.length - 1) { n /= 1000; k++; }
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return (neg ? '-' : '') + s.replace(/\.?0+$/, '') + SUFIJOS[k];
}

// Metros con un decimal hasta 100, después enteros con separador.
export function metros(m) {
  return m < 100 ? m.toFixed(1) : Math.round(m).toLocaleString('es-AR');
}

// mulberry32: rápido, 32 bits, repetible. El azar del mundo va con semilla y
// el visual (chispas, humo) con Math.random: así un cambio de efectos no
// mueve dónde cae una casa.
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
export const entre = (r, a, b) => a + (b - a) * r();
export const elegir = (r, lista) => lista[Math.floor(r() * lista.length) % lista.length];

// Elegir por peso: [{peso, ...}] → uno.
export function porPeso(r, lista, campo = 'peso') {
  let total = 0;
  for (const x of lista) total += x[campo];
  let u = r() * total;
  for (const x of lista) { u -= x[campo]; if (u <= 0) return x; }
  return lista[lista.length - 1];
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mezclar = (a, b, t) => a + (b - a) * t;
// Acercarse a un objetivo sin depender de los cuadros por segundo.
export const acercar = (actual, objetivo, velocidad, dt) => actual + (objetivo - actual) * (1 - Math.exp(-velocidad * dt));
export const suave = (t) => t * t * (3 - 2 * t);
export const salidaCubica = (t) => 1 - Math.pow(1 - t, 3);
export const salidaAtras = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const elastico = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);

// Ángulo más corto de a hacia b.
export function girarHacia(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

// Ruido de valor 2D (para suelos, nubes y desplazamientos): hash entero.
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function ruido2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = suave(xf), v = suave(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return mezclar(mezclar(a, b, u), mezclar(c, d, u), v);
}
