// Azar con semilla. La misma semilla da siempre la misma partida.
//
// POR QUE IMPORTA ACA. Una partida de supervivencia dura minutos y muere de
// una forma injusta cada tanto; si además cada corrida es un mundo distinto,
// no hay manera de reproducir un bug ni de comparar dos versiones del balance.
// Con semilla, "la partida 4218" es la misma para siempre y las pruebas pueden
// jugar mil veces lo mismo.

export function azar(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    // Math.imul y no `*`: los productos de 32 bits pasan de 2^53 y el float64
    // redondea justo los bits de abajo, que son los que dan la mezcla.
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const entero = (r, n) => Math.floor(r() * n) % n;
export const uno = (r, l) => l[entero(r, l.length)];
export const entre = (r, a, b) => a + r() * (b - a);
export function barajar(r, l) {
  for (let i = l.length - 1; i > 0; i--) { const j = entero(r, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}
