// El rayo: por dónde pasa, dado un tablero.
//
// ES UNA FUNCION PURA Y VIVE SOLA. La usan tres cosas que no se conocen entre
// sí: el juego para dibujar, el generador para armar niveles y el solucionador
// para probar que se pueden ganar. Si el generador y el juego trazaran el rayo
// con código distinto, el generador podría jurar que un nivel se resuelve y el
// jugador ver que no — que es el peor error posible en un juego de puzzles,
// porque no se ve como un error: se ve como que sos tonto.

export const DIRS = { der: [1, 0], izq: [-1, 0], arr: [0, -1], aba: [0, 1] };

// Los dos espejos, como tablas. Escritos como `if` encadenados esto se lee
// tres veces y se entiende ninguna.
//                       der    izq    arr    aba
const REBOTE = {
  0: { der: "arr", izq: "aba", arr: "der", aba: "izq" },   // "/"
  1: { der: "aba", izq: "arr", arr: "izq", aba: "der" },   // "\"
};

export const VACIO = 0, MURO = 1, ESPEJO = 2, FIJO = 3, EMISOR = 4, OBJETIVO = 5;

/** Una celda del tablero, por índice. Afuera del tablero devuelve null. */
export const celdaEn = (n, c, f) =>
  (c < 0 || f < 0 || c >= n.ancho || f >= n.alto) ? null : n.celdas[f * n.ancho + c];

/**
 * Traza todos los rayos y devuelve por dónde pasaron y qué objetivos prendieron.
 *
 * `estado` es el vuelco de cada espejo movible, en el orden en que aparecen en
 * `nivel.espejos`. Se pasa aparte del tablero para que el solucionador pueda
 * probar miles de combinaciones sin copiar el tablero cada vez.
 */
export function trazar(nivel, estado) {
  const tramos = [];                     // [c, f, dirEntra, dirSale, color]
  const prendidos = new Set();
  for (const em of nivel.emisores) {
    let [c, f] = [em.c, em.f];
    let dir = em.dir;
    const color = em.color;
    // EL LIMITE NO ES UN NUMERO DE PASOS, ES HABER ESTADO ACA ANTES. Dos
    // espejos enfrentados hacen un lazo cerrado y el rayo da vueltas para
    // siempre; cortando por cantidad de pasos, el rayo se dibuja entrando y
    // saliendo del lazo y parpadea distinto según cuántos pasos se le pusieron.
    // Con el conjunto de (celda, dirección) visitadas, el lazo se cierra
    // siempre en el mismo lugar.
    const vistos = new Set();
    for (;;) {
      const [dc, df] = DIRS[dir];
      c += dc; f += df;
      const cel = celdaEn(nivel, c, f);
      if (cel === null) break;
      const marca = `${c},${f},${dir}`;
      if (vistos.has(marca)) break;
      vistos.add(marca);

      if (cel.t === MURO) break;
      if (cel.t === EMISOR) break;        // un emisor tapa: no se le entra por atrás
      if (cel.t === OBJETIVO) {
        tramos.push([c, f, dir, null, color]);
        // Sólo cuenta si el color es el que pide. Uno del color equivocado se
        // come el rayo igual: si lo dejara pasar, el objetivo no sería un
        // obstáculo y el color no sería una decisión.
        if (cel.color === color) prendidos.add(`${c},${f}`);
        break;
      }
      if (cel.t === ESPEJO || cel.t === FIJO) {
        const vuelco = cel.t === FIJO ? cel.vuelco : estado[cel.i];
        const sale = REBOTE[vuelco][dir];
        tramos.push([c, f, dir, sale, color]);
        dir = sale;
        continue;
      }
      tramos.push([c, f, dir, dir, color]);
    }
  }
  return { tramos, prendidos };
}

/** ¿Están prendidos todos los objetivos? */
export function ganado(nivel, estado) {
  const { prendidos } = trazar(nivel, estado);
  return prendidos.size === nivel.objetivos.length;
}

/** El estado como un número, para usarlo de clave en el solucionador. */
export const clave = (estado) => estado.reduce((a, v, i) => a + (v << i), 0);

export const desdeClave = (n, cuantos) =>
  Array.from({ length: cuantos }, (_, i) => (n >> i) & 1);
