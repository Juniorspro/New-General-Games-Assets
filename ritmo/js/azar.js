// Azar con semilla: la misma semilla da siempre la misma canción.
//
// POR QUE CON SEMILLA Y NO Math.random. Un juego de ritmo se aprende de
// memoria: si la canción 3 suena distinta cada vez que entrás, no hay nada que
// aprender y el puntaje guardado no significa nada. Con semilla, la canción 3
// es LA canción 3 para siempre, en cualquier teléfono, y no hay que guardar un
// archivo de audio en ningún lado.

/** Mulberry32. Treinta y dos bits, rápido y sin estado escondido. */
export function azar(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    // Math.imul Y NO `*`. Los productos de 32 bits pasan de 2^53 y el float64
    // redondea los bits de abajo, que son justo los que dan la mezcla: con `*`
    // la secuencia sale correlacionada y las canciones se parecen entre sí.
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un entero en [0, n). */
export const entero = (r, n) => Math.floor(r() * n) % n;

/** Uno de la lista. */
export const uno = (r, lista) => lista[entero(r, lista.length)];

/** Verdadero con probabilidad p. */
export const quizas = (r, p) => r() < p;

/** Baraja en el lugar (Fisher-Yates). */
export function barajar(r, lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = entero(r, i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
