/* ============================================================================
   zonda/js/salas.js — el cerro, sala por sala. Datos puros: los lee el juego
   y el resolvedor. Cada sala es una pantalla de 25 x 40 baldosas; se sale por
   arriba. Se dibujan con rectángulos: ['#', x0, y0, x1, y1] (los de después
   pisan a los de antes). La leyenda de las letras está en fisica.js.
   Las medidas que mandan el diseño (medidas con el resolvedor):
     salto ≈ 3 baldosas de alto y ~6 de largo · dash ≈ 4,5 baldosas
     trepar de un tirón ≈ 13 baldosas · salto + dash para arriba ≈ 8
   ========================================================================== */

const SALA_W = 25, SALA_H = 40;

function armarSala(def) {
  const g = Array.from({ length: SALA_H }, () => Array(SALA_W).fill('.'));
  for (const op of def.dibujo) {
    const [c, x0, y0, x1 = x0, y1 = y0] = op;
    for (let y = Math.max(0, y0); y <= Math.min(SALA_H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(SALA_W - 1, x1); x++) g[y][x] = c;
  }
  const s = Object.assign({}, def, { mapa: g.map((r) => r.join('')) });
  delete s.dibujo;
  return s;
}

/* los bordes de siempre: paredes a los costados y piso abajo */
const MARCO = [['#', 0, 0, 0, 39], ['#', 24, 0, 24, 39]];

const CAPITULOS = [
  {
    id: 1, nombre: 'La Quebrada', tema: 'quebrada', musica: 'quebrada', dashes: 1,
    salas: [
      {
        id: '1-1', nombre: 'Al pie del cerro', dialogo: 'inicio',
        dibujo: [...MARCO,
          ['#', 0, 36, 24, 39],
          ['#', 8, 33, 11, 35], ['#', 13, 30, 16, 35], ['#', 19, 22, 23, 35],
          ['#', 12, 19, 15, 20], ['#', 6, 16, 9, 17], ['#', 1, 6, 3, 15], ['#', 6, 3, 9, 3],
          ['#', 21, 10, 23, 10], ['L', 22, 9],
          ['P', 3, 35],
          ['c', 5, 35], ['r', 17, 35], ['h', 9, 32], ['h', 14, 29], ['c', 21, 21], ['h', 13, 18], ['r', 7, 15], ['h', 2, 5],
        ],
      },
      {
        id: '1-2', nombre: 'La chimenea',
        dibujo: [...MARCO,
          ['#', 0, 36, 24, 39],
          ['#', 1, 10, 9, 31], ['#', 15, 10, 23, 33],     // las paredes: la chimenea es x 10..14
          ['#', 10, 34, 14, 35],                         // el escalón para entrar: 2 de alto, que el techo del pasillo está a 4
          ['^', 16, 35, 23, 35],                         // el pasillo de la derecha no lleva a nada
          ['.', 15, 18, 16, 19], ['L', 16, 19],          // un hueco en la pared con la carta
          ['#', 4, 7, 7, 7], ['#', 10, 4, 13, 4], ['#', 16, 2, 19, 2],
          ['P', 3, 35],
          ['c', 2, 35], ['h', 6, 35], ['r', 18, 1], ['h', 5, 6], ['h', 2, 9],
        ],
      },
      {
        id: '1-3', nombre: 'El primer viento', dialogo: 'viento1',
        dibujo: [...MARCO,
          ['#', 0, 36, 5, 39], ['^', 6, 38, 17, 38], ['#', 6, 39, 17, 39], ['#', 18, 36, 24, 39],
          ['#', 1, 31, 5, 35],
          ['#', 18, 26, 23, 35],                         // del otro lado del pozo, alto
          ['#', 10, 17, 14, 18],                         // plataforma que se alcanza con dash para arriba
          ['#', 1, 11, 5, 12],
          ['#', 14, 6, 19, 7],
          ['#', 22, 17, 23, 17], ['L', 23, 16],
          ['P', 3, 30],
          ['c', 2, 30], ['c', 20, 25], ['h', 11, 16], ['r', 3, 10], ['h', 16, 5],
        ],
      },
      {
        id: '1-4', nombre: 'Piedras de viento',
        dibujo: [...MARCO,
          ['#', 0, 36, 24, 39], ['^', 5, 35, 24, 35],
          ['#', 1, 30, 4, 35],
          ['*', 9, 28], ['*', 15, 23], ['*', 20, 17],
          ['#', 18, 11, 23, 12], ['S', 19, 10],
          ['#', 6, 7, 10, 8],
          ['#', 1, 3, 3, 4], ['*', 4, 12], ['L', 2, 2],
          ['P', 2, 29],
          ['c', 3, 29], ['h', 21, 10], ['r', 8, 6],
        ],
      },
      {
        id: '1-5', nombre: 'La apacheta', dialogo: 'apacheta1',
        dibujo: [...MARCO,
          ['#', 0, 36, 24, 39],
          ['S', 6, 35], ['#', 1, 25, 4, 35],
          ['#', 9, 26, 13, 27], ['^', 9, 25, 13, 25], ['#', 13, 20, 13, 25],
          ['#', 17, 22, 23, 23], ['*', 20, 17],
          ['#', 14, 12, 16, 12], ['C', 8, 12, 10, 12],
          ['#', 1, 8, 5, 9], ['A', 3, 7],
          ['#', 12, 3, 17, 4], ['L', 22, 3], ['#', 21, 4, 23, 4],
          ['P', 2, 24],
          ['c', 21, 21], ['h', 15, 11], ['r', 1, 7],
        ],
      },
    ],
  },
  {
    id: 2, nombre: 'La Mina', tema: 'mina', musica: 'mina', dashes: 1,
    salas: [
      {
        id: '2-1', nombre: 'La boca de la mina', dialogo: 'mina',
        dibujo: [
          ['#', 0, 0, 24, 39], ['.', 5, 0, 19, 35], ['.', 1, 30, 4, 35],
          ['=', 5, 33, 9, 33], ['=', 12, 30, 16, 30], ['=', 15, 27, 19, 27], ['=', 9, 24, 13, 24],
          ['C', 5, 21, 8, 21], ['=', 12, 18, 16, 18], ['C', 16, 15, 19, 15], ['=', 11, 12, 14, 12],
          ['=', 5, 9, 9, 9], ['C', 11, 6, 14, 6], ['=', 16, 3, 19, 3],
          ['.', 1, 13, 4, 15], ['=', 5, 16, 7, 16], ['L', 2, 15],
          ['P', 2, 35],
          ['f', 5, 29], ['f', 19, 21], ['f', 5, 11], ['t', 3, 35], ['t', 18, 35],
        ],
      },
      {
        id: '2-2', nombre: 'Tablas podridas',
        dibujo: [
          ['#', 0, 0, 24, 39],
          ['.', 1, 32, 23, 35], ['B', 9, 32, 9, 35], ['B', 15, 32, 15, 35],
          /* el pozo de la derecha: después del dash para arriba los pies quedan en
             y≈214, así que el piso del segundo nivel va en la fila 28 (y 224).
             En la fila 26 (y 208) quedaba ARRIBA de los pies y no se podía subir */
          /* y encima del techo rompible, un tablón: se atraviesa subiendo y se cae
             parada en él. Sin tablón había que correr 25 px en el aire y daba 23 */
          ['.', 20, 24, 23, 31], ['B', 20, 29, 23, 29], ['=', 20, 28, 23, 28],
          ['.', 2, 24, 19, 27], ['.', 7, 28, 15, 30], ['^', 7, 30, 15, 30],
          ['C', 8, 28, 9, 28], ['C', 12, 28, 13, 28],
          ['.', 2, 10, 5, 23], ['*', 4, 17],
          ['.', 2, 10, 22, 13], ['B', 12, 10, 12, 13], ['.', 18, 0, 22, 9],
          ['.', 16, 19, 18, 22], ['B', 16, 23, 18, 23], ['L', 17, 22],
          ['P', 2, 35],
          ['f', 5, 32], ['f', 18, 32], ['f', 7, 22], ['f', 8, 10], ['t', 21, 35],
        ],
      },
      {
        id: '2-3', nombre: 'Las vagonetas',
        /* la vagoneta de la derecha sube hasta dos filas debajo de la salida: el
           envión de la llegada tira a Ayelén para arriba si salta a tiempo */
        movil: [{ dx: 0, dy: -20 }, { dx: 14, dy: 0 }],
        dibujo: [
          ['#', 0, 0, 24, 39], ['.', 1, 1, 23, 35], ['^', 6, 35, 19, 35],
          ['#', 20, 24, 23, 35], ['M', 20, 22, 22, 23], ['M', 2, 33, 4, 34],
          /* una sola salida, arriba a la derecha, adonde lleva la vagoneta. Con
             otra a la izquierda, la pared de ese lado parecía el camino corto y
             terminaba debajo de un saliente, sin salida */
          ['.', 20, 0, 23, 0],
          ['#', 11, 12, 15, 13], ['*', 13, 17],
          ['L', 11, 24],
          ['P', 1, 35],
          ['f', 1, 28], ['f', 23, 18], ['f', 13, 7], ['t', 5, 4],
        ],
      },
      {
        id: '2-4', nombre: 'El pique',
        /* la segunda vagoneta termina a la izquierda de la primera: si terminara
           debajo, aplastaría a Ayelén contra ella */
        movil: [{ dx: 0, dy: -12 }, { dx: 3, dy: -7 }],
        dibujo: [
          ['#', 0, 0, 24, 39], ['.', 6, 0, 18, 35], ['^', 9, 35, 18, 35],
          ['M', 15, 24, 17, 25], ['M', 9, 33, 11, 34],
          ['>', 6, 8, 6, 22], ['*', 12, 18], ['*', 9, 8],
          ['L', 17, 30], ['#', 17, 31, 18, 31],
          ['P', 6, 35],
          ['f', 18, 12], ['f', 7, 27], ['f', 18, 33],
        ],
      },
      {
        id: '2-5', nombre: 'La salida', dialogo: 'mina2',
        movil: [{ dx: -8, dy: 0 }],
        dibujo: [
          ['#', 0, 0, 24, 39],
          /* sin derrumbe sobre las púas: a 5 filas del piso hacía de techo y el
             salto por encima no tenía arco */
          ['.', 1, 28, 23, 35], ['B', 12, 28, 12, 35], ['^', 5, 35, 8, 35],
          ['.', 18, 14, 23, 27], ['=', 18, 24, 21, 24], ['=', 20, 20, 23, 20], ['C', 18, 17, 20, 17],
          ['.', 3, 8, 17, 13], ['.', 18, 8, 20, 13], ['^', 4, 13, 12, 13], ['M', 13, 11, 15, 12], ['*', 9, 9],
          ['.', 1, 0, 4, 7],
          ['.', 21, 9, 23, 13], ['L', 22, 10],
          ['P', 2, 35],
          ['f', 1, 30], ['f', 23, 30], ['f', 17, 9], ['t', 22, 35],
        ],
      },
    ],
  },
  {
    id: 3, nombre: 'El Glaciar', tema: 'glaciar', musica: 'glaciar', dashes: 1,
    salas: [
      {
        id: '3-1', nombre: 'Nieve vieja', dialogo: 'glaciar',
        dibujo: [
          ['I', 0, 0, 0, 39], ['I', 24, 0, 24, 39], ['#', 0, 36, 24, 39],
          ['#', 1, 26, 17, 28], ['Y', 5, 29], ['Y', 9, 29], ['Y', 13, 29],
          ['#', 20, 30, 23, 35], ['*', 19, 25], ['#', 21, 22, 23, 23],
          ['I', 13, 10, 15, 21], ['#', 17, 14, 20, 15],
          ['#', 8, 11, 11, 12], ['Y', 9, 13],
          ['#', 2, 7, 6, 8], ['#', 8, 3, 12, 4],
          ['L', 2, 25], ['.', 1, 25, 3, 25],
          ['P', 2, 35],
          ['k', 7, 35], ['k', 22, 29], ['h', 18, 13], ['k', 3, 6],
        ],
      },
      {
        id: '3-2', nombre: 'Viento en contra',
        viento: { x: -55 },
        /* el viento empuja a la izquierda a 55 px/s: para la izquierda se salta
           el doble, para la derecha hace falta el dash (el dash no lo siente).
           Todos los escalones de 3 filas: con 4 el salto no llega */
        dibujo: [
          ['I', 0, 0, 0, 39], ['I', 24, 0, 24, 39], ['#', 0, 36, 5, 39], ['^', 6, 38, 18, 38], ['#', 6, 39, 18, 39], ['#', 19, 36, 24, 39],
          ['#', 10, 33, 12, 34], ['#', 19, 30, 23, 35],
          ['#', 13, 27, 17, 28], ['#', 4, 24, 8, 25],
          ['#', 11, 8, 12, 21], ['#', 9, 15, 10, 15],
          ['#', 17, 5, 21, 6], ['#', 13, 2, 15, 2],
          ['L', 22, 20], ['#', 21, 21, 23, 21],
          ['P', 2, 35],
          ['k', 4, 35], ['k', 21, 29], ['h', 6, 23], ['k', 19, 4],
        ],
      },
      {
        id: '3-3', nombre: 'Ráfagas',
        viento: { x: 150, on: 1.6, off: 1.8, rafagas: true },
        dibujo: [
          ['I', 0, 0, 0, 39], ['I', 24, 0, 24, 39], ['#', 0, 36, 24, 39], ['^', 8, 35, 23, 35],
          ['#', 1, 30, 7, 35], ['#', 11, 30, 12, 31], ['#', 17, 27, 19, 28], ['#', 21, 21, 23, 22],
          ['I', 20, 12, 20, 20],
          ['#', 12, 17, 15, 18], ['#', 4, 13, 7, 14], ['^', 4, 12, 7, 12], ['#', 8, 12, 9, 13],
          ['#', 13, 6, 17, 7], ['#', 3, 2, 6, 3],
          ['L', 22, 16],
          ['P', 2, 29],
          ['k', 5, 29], ['k', 22, 20], ['h', 14, 16],
        ],
      },
      {
        id: '3-4', nombre: 'Espejos de hielo',
        dibujo: [
          ['I', 0, 0, 0, 39], ['I', 24, 0, 24, 39], ['#', 0, 36, 24, 39],
          /* la columna del medio se sube encadenando piedras de viento. Van cada
             6 filas: un dash para arriba cubre ~52 px y con 7 no se llega */
          ['I', 7, 9, 8, 27], ['I', 16, 9, 17, 27],
          ['^', 9, 35, 15, 35], ['#', 1, 33, 5, 35], ['#', 19, 33, 23, 35],
          ['*', 12, 29], ['*', 12, 24], ['*', 12, 19], ['*', 12, 14], ['*', 12, 9],
          ['=', 9, 5, 15, 5], ['=', 9, 2, 15, 2],        // arriba, tablones cada 3 filas: se atraviesan subiendo
          ['L', 10, 21],
          ['P', 2, 32],
          ['k', 4, 32], ['k', 20, 32], ['k', 11, 2],
        ],
      },
      {
        id: '3-5', nombre: 'El paso', dialogo: 'glaciar2',
        viento: { x: -120, on: 1.4, off: 2.0, rafagas: true, fase: 1.0 },
        dibujo: [
          ['I', 0, 0, 0, 39], ['I', 24, 0, 24, 39], ['#', 0, 36, 24, 39],
          /* abajo, el pasillo de los carámbanos con las ráfagas en contra; arriba,
             con las ráfagas a favor, hasta la pared de roca de la izquierda, que
             es lo único que se trepa (la piedra de viento a mitad de camino
             recarga el aguante) */
          ['#', 1, 27, 17, 28], ['Y', 5, 29], ['Y', 10, 29], ['Y', 14, 29], ['^', 7, 35, 11, 35],
          ['#', 21, 25, 23, 35],
          ['#', 13, 22, 17, 23], ['L', 15, 18],
          ['#', 5, 19, 9, 20],
          ['#', 3, 1, 4, 18], ['*', 5, 11],
          ['I', 11, 5, 12, 14], ['#', 16, 8, 20, 9], ['*', 18, 4],
          ['P', 2, 35],
          ['k', 3, 35], ['k', 22, 24], ['h', 7, 18], ['k', 18, 7],
        ],
      },
    ],
  },
  {
    id: 4, nombre: 'La Cumbre', tema: 'cumbre', musica: 'cumbre', dashes: 2,
    salas: [
      {
        id: '4-1', nombre: 'La tormenta', dialogo: 'regalo',
        viento: { x: 110, on: 1.5, off: 1.5, rafagas: true },
        dibujo: [
          ...MARCO, ['#', 0, 36, 24, 39], ['^', 5, 35, 24, 35],
          ['#', 1, 30, 4, 35], ['#', 12, 29, 14, 29], ['#', 20, 23, 23, 24],
          ['#', 10, 16, 13, 17], ['^', 10, 15, 11, 15], ['#', 2, 11, 5, 12], ['*', 8, 8],
          ['#', 14, 4, 18, 5],
          ['L', 23, 13], ['#', 22, 14, 23, 14],
          ['P', 2, 29],
          ['r', 3, 29], ['h', 21, 22], ['r', 16, 3],
        ],
      },
      {
        id: '4-2', nombre: 'Dos alientos',
        dibujo: [
          ...MARCO, ['#', 0, 36, 4, 39], ['^', 5, 38, 24, 38], ['#', 5, 39, 24, 39],
          ['#', 1, 33, 4, 35], ['#', 20, 26, 23, 27], ['^', 20, 25, 21, 25],
          ['#', 1, 19, 4, 20], ['#', 11, 13, 13, 14], ['v', 11, 15, 13, 15],
          ['#', 20, 8, 23, 9], ['#', 3, 3, 7, 4],
          ['L', 12, 22],
          ['P', 2, 32],
          ['r', 3, 32], ['h', 22, 7], ['r', 5, 2],
        ],
      },
      {
        id: '4-3', nombre: 'Todo junto',
        movil: [{ dx: 9, dy: 0 }],
        viento: { x: -70 },
        dibujo: [
          ...MARCO, ['#', 0, 36, 24, 39], ['^', 7, 35, 24, 35],
          ['#', 1, 31, 6, 35], ['M', 3, 27, 5, 28], ['B', 14, 20, 14, 27], ['#', 15, 26, 18, 27],
          ['C', 20, 21, 22, 21], ['#', 19, 13, 23, 14], ['*', 13, 12], ['S', 20, 12],
          ['#', 2, 16, 6, 17], ['C', 6, 8, 9, 8], ['#', 12, 3, 16, 4],
          ['L', 2, 12], ['#', 1, 13, 3, 13],
          /* la pared de la izquierda con espinas: el viento empuja para ese
             lado y sin esto se subía toda la sala trepando por ahí */
          ['>', 1, 18, 1, 29], ['>', 1, 1, 1, 10],
          ['P', 2, 30],
          ['r', 4, 30], ['h', 17, 25], ['r', 21, 12], ['h', 13, 2],
        ],
      },
      {
        id: '4-4', nombre: 'El viento te lleva', dialogo: 'lleva',
        viento: { y: -95, x: 0 },
        dibujo: [
          ...MARCO, ['#', 0, 36, 24, 39],
          ['^', 5, 35, 19, 35], ['#', 1, 32, 4, 35], ['#', 20, 32, 23, 35],
          ['<', 23, 10, 23, 30], ['>', 1, 12, 1, 28],
          ['#', 9, 24, 15, 24], ['^', 9, 23, 11, 23], ['#', 5, 15, 8, 15], ['#', 16, 15, 19, 15],
          ['*', 12, 11], ['#', 9, 5, 15, 5], ['v', 9, 6, 15, 6],
          ['L', 12, 18],
          ['P', 2, 31],
          ['r', 3, 31], ['h', 21, 31], ['r', 6, 14], ['h', 18, 14],
        ],
      },
      {
        id: '4-5', nombre: 'La cumbre', dialogo: 'cumbre', final: true,
        dibujo: [
          ...MARCO, ['#', 0, 36, 24, 39], ['#', 0, 30, 24, 35],
          ['#', 3, 27, 21, 29], ['#', 6, 24, 18, 26], ['#', 9, 21, 15, 23],
          ['E', 12, 20],
          ['P', 1, 29],
          ['h', 5, 25], ['h', 19, 25], ['r', 8, 21], ['r', 16, 21],
        ],
      },
    ],
  },
];

const SALAS = [];
for (const cap of CAPITULOS) {
  cap.salas = cap.salas.map((d) => armarSala(Object.assign({ cap: cap.id }, d)));
  for (const s of cap.salas) SALAS.push(s);
}
