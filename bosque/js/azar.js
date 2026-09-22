// Azar con semilla y ruido. Todo el bosque sale de acá.
//
// CON SEMILLA, NUNCA Math.random PARA EL MUNDO. Un árbol sorteado con
// Math.random está en otro lugar cada vez que se abre la página: la cinta que
// ayer estaba al lado de un abeto hoy está adentro de uno. Todo lo que ocupa
// un lugar sale de un generador que arranca siempre igual.

/** mulberry32: chico, rápido y con buena distribución para esto. */
export function generador(semilla) {
  let a = semilla >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.rango = (lo, hi) => lo + (hi - lo) * f();
  f.entero = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.elegir = (lista) => lista[Math.floor(f() * lista.length)];
  return f;
}

// EL HASH VA CON Math.imul Y NO CON `*`. Los números de JavaScript son coma
// flotante de 64 bits: el producto de dos enteros grandes se pasa de los 53
// bits exactos y redondea justo los bits de abajo, que son los que un hash
// usa. El síntoma no es un error sino un ruido que devuelve casi siempre lo
// mismo: un terreno plano, que se ve como un terreno.
function hash2(x, y, s) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const quintica = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Ruido de valor en [0,1], con interpolación quíntica: derivada continua,
 *  así las lomas no tienen aristas donde se juntan los cuadros. */
export function ruido(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = quintica(x - xi), v = quintica(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Suma de octavas. `lac` 2.03 y no 2: con el doble exacto las octavas caen
 *  alineadas en la misma grilla y el relieve sale cuadriculado. */
export function fbm(x, y, octavas = 5, s = 0, lac = 2.03, gan = 0.5) {
  let v = 0, amp = 1, tot = 0;
  for (let i = 0; i < octavas; i++) {
    v += ruido(x, y, s + i * 17) * amp;
    tot += amp; amp *= gan; x *= lac; y *= lac;
  }
  return v / tot;
}

/** Crestas: 1-|2n-1|, para lomas con lomo marcado en vez de burbujas. */
export function crestas(x, y, octavas = 4, s = 0) {
  let v = 0, amp = 1, tot = 0;
  for (let i = 0; i < octavas; i++) {
    const n = 1 - Math.abs(ruido(x, y, s + i * 31) * 2 - 1);
    v += n * n * amp;
    tot += amp; amp *= 0.5; x *= 2.07; y *= 2.07;
  }
  return v / tot;
}

export const suave = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const mezcla = (a, b, t) => a + (b - a) * t;
export const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
