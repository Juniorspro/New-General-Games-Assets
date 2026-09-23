/* ============================================================================
   luz-mala/js/salas.js — el quebracho por dentro. Cada sala tiene su lugar en
   el mundo (pos, en baldosas): salir por un borde lleva a la que esté pegada
   ahí, y el mapa se dibuja con esas mismas coordenadas. Los huecos de dos
   salas vecinas tienen que coincidir baldosa por baldosa.
   Medidas de Chispa (lo que manda el diseño): salto 5,5 baldosas de alto y
   6,5 de largo · con aleteo +5 de largo · la resina deja subir pozos de 3 de ancho.
   ========================================================================== */

function armarSalaLM(def) {
  const [W, H] = def.tam;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  for (const op of def.dibujo) {
    const [c, x0, y0, x1 = x0, y1 = y0] = op;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) g[y][x] = c;
  }
  const s = Object.assign({}, def, { mapa: g.map((r) => r.join('')) });
  delete s.dibujo;
  return s;
}

const ZONAS = {
  pueblo: { nombre: 'El Pueblo', luz: 0.3 },
  raices: { nombre: 'Las Raíces', luz: 0.6 },
  tela: { nombre: 'La Telaraña', luz: 0.7 },
  hormiguero: { nombre: 'El Hormiguero', luz: 0.58 },
};

const SALAS_LM = [
  {
    id: 'P1', nombre: 'El Pueblo', zona: 'pueblo', pos: [0, 0], tam: [44, 26], musica: 'pueblo',
    npcs: ['mamboreta', 'vaquita', 'canasto', 'bolita'],
    dibujo: [
      /* el pozo baja a las raíces; el escalón de adentro es para volver */
      ['#', 0, 0, 43, 25], ['.', 2, 2, 41, 21], ['.', 34, 22, 39, 25], ['#', 38, 24, 39, 24],
      ['=', 4, 17, 9, 17], ['=', 12, 13, 17, 13], ['=', 20, 9, 25, 9], ['=', 28, 13, 33, 13], ['=', 36, 17, 41, 17],
      ['N', 7, 21], ['N', 14, 21], ['N', 26, 21], ['N', 31, 21], ['H', 20, 21], ['F', 22, 6],
      ['$', 22, 8], ['$', 40, 16],
      ['P', 4, 21],
      ['h', 3, 21], ['h', 11, 21], ['h', 29, 21], ['h', 41, 21], ['r', 6, 2], ['r', 17, 2], ['r', 30, 2], ['r', 38, 2], ['s', 10, 21], ['s', 24, 21],
      /* las casitas talladas en el tronco y los farolitos colgados */
      ['y', 5, 21], ['y', 17, 21], ['y', 23, 21], ['y', 33, 21], ['y', 8, 16], ['y', 30, 12],
      ['f', 9, 2], ['f', 19, 2], ['f', 27, 2], ['f', 35, 2],
    ],
  },
  {
    id: 'R1', nombre: 'Las raíces', zona: 'raices', pos: [30, 26], tam: [30, 40], musica: 'raices',
    dibujo: [
      /* la chimenea al pueblo: escalones de a 4 baldosas, alternados, para
         poder volver a la tienda sin habilidades */
      ['#', 0, 0, 29, 39], ['.', 4, 0, 9, 3], ['.', 2, 4, 11, 9], ['.', 2, 10, 27, 37], ['.', 28, 32, 29, 35],
      ['#', 4, 2, 5, 2], ['#', 9, 6, 11, 6], ['#', 2, 10, 4, 10],
      ['#', 2, 14, 9, 15], ['=', 12, 18, 18, 18], ['#', 20, 22, 27, 23], ['=', 10, 26, 16, 26],
      ['#', 2, 30, 8, 31], ['#', 14, 33, 22, 37], ['^', 9, 37, 13, 37],
      ['c', 5, 13], ['m', 16, 15], ['c', 24, 21], ['m', 12, 29], ['c', 18, 32], ['m', 24, 28],
      ['$', 3, 29], ['$', 26, 21],
      ['r', 13, 10], ['r', 22, 10], ['h', 7, 13], ['h', 21, 21], ['h', 15, 32], ['h', 26, 37], ['s', 5, 29],
    ],
  },
  {
    id: 'R2', nombre: 'El hongal', zona: 'raices', pos: [60, 50], tam: [44, 24], musica: 'raices',
    dibujo: [
      ['#', 0, 0, 43, 23], ['.', 0, 8, 5, 11], ['.', 6, 2, 41, 21], ['.', 42, 14, 43, 17],
      ['=', 8, 17, 12, 17], ['=', 14, 13, 18, 13], ['=', 7, 9, 11, 9], ['=', 7, 6, 10, 6], ['=', 22, 10, 26, 10], ['=', 29, 13, 33, 13],
      /* el escondite de la chispa: detrás de la pared que se rompe */
      ['.', 2, 2, 5, 5], ['B', 6, 2, 6, 5], ['K', 3, 5],
      /* el túnel a Los hilos: bajo, con espinas antes del pozo. Sin el aleteo no
         se cruza (en 3 baldosas de alto el salto no pasa de 2 de largo) */
      ['#', 26, 16, 35, 18], ['^', 27, 21, 29, 21], ['.', 30, 22, 33, 23],
      ['#', 36, 18, 41, 21],
      ['H', 20, 21], ['g', 13, 21], ['g', 24, 21], ['x', 32, 15], ['m', 34, 8],
      ['$', 24, 9], ['$', 39, 17],
      ['h', 9, 16], ['h', 16, 12], ['h', 24, 9], ['h', 31, 12], ['h', 7, 21], ['h', 28, 15], ['h', 40, 17], ['r', 12, 2], ['r', 27, 2],
    ],
  },
  {
    id: 'A1', nombre: 'La cueva del Torito', zona: 'raices', pos: [104, 54], tam: [34, 20], musica: 'jefe', jefe: 'torito',
    compuertas: [{ jefe: 'torito' }],
    dibujo: [
      ['#', 0, 0, 33, 19], ['.', 2, 2, 31, 15], ['.', 0, 10, 1, 13], ['G', 1, 10, 1, 13],
      ['J', 20, 15], ['F', 16, 5],
      ['h', 4, 15], ['h', 29, 15], ['r', 8, 2], ['r', 25, 2],
    ],
  },
  {
    id: 'T1', nombre: 'Los hilos', zona: 'tela', pos: [74, 74], tam: [44, 30], musica: 'tela',
    dibujo: [
      ['#', 0, 0, 43, 29], ['.', 16, 0, 19, 1], ['.', 14, 2, 21, 5], ['.', 2, 6, 41, 27], ['.', 42, 22, 43, 25],
      /* la entrada de arriba: medio tablón para no quedar parada en el medio al
         caer, y escalones de a 3 para volver a subir al túnel */
      ['=', 16, 1, 17, 1], ['=', 20, 4, 21, 4], ['=', 15, 7, 20, 7],
      ['=', 30, 22, 33, 22], ['=', 28, 14, 30, 14],
      ['#', 12, 12, 23, 13], ['#', 32, 12, 41, 13], ['=', 26, 18, 29, 18],
      ['^', 2, 27, 41, 27], ['#', 36, 26, 41, 27], ['#', 2, 20, 7, 21],
      ['=', 8, 16, 10, 16],
      ['H', 38, 11], ['p', 28, 10], ['p', 18, 20], ['a', 27, 7], ['a', 34, 7], ['m', 6, 12],
      ['$', 4, 19], ['K', 3, 19],
      ['t', 25, 6], ['t', 30, 6], ['t', 10, 6], ['t', 38, 6], ['r', 5, 6], ['h', 13, 11], ['h', 40, 11],
    ],
  },
  {
    id: 'A2', nombre: 'La tela de la Viuda', zona: 'tela', pos: [118, 84], tam: [32, 22], musica: 'jefe', jefe: 'viuda',
    compuertas: [{ jefe: 'viuda' }, { abre: 'viuda' }],
    dibujo: [
      ['#', 0, 0, 31, 21], ['.', 2, 2, 29, 17], ['.', 0, 12, 1, 15], ['G', 1, 12, 1, 15],
      ['=', 4, 12, 9, 12], ['=', 22, 12, 27, 12],
      ['.', 24, 18, 27, 21], ['G', 24, 18, 27, 18],
      ['J', 16, 3], ['F', 8, 5],
      ['t', 6, 2], ['t', 14, 2], ['t', 20, 2], ['t', 26, 2],
    ],
  },
  {
    id: 'H1', nombre: 'El pique', zona: 'hormiguero', pos: [136, 106], tam: [22, 40], musica: 'hormiguero',
    dibujo: [
      ['#', 0, 0, 21, 39], ['.', 6, 0, 9, 3], ['.', 3, 4, 11, 35], ['.', 12, 30, 17, 35],
      ['.', 15, 4, 17, 29], ['.', 18, 4, 21, 7],
      ['#', 3, 16, 6, 17], ['#', 8, 24, 11, 25],
      ['o', 7, 35], ['x', 4, 15], ['m', 8, 12],
      ['$', 10, 23],
      ['h', 4, 35], ['h', 16, 35], ['r', 9, 4], ['s', 12, 35],
    ],
  },
  {
    id: 'H2', nombre: 'El río de ámbar', zona: 'hormiguero', pos: [158, 102], tam: [46, 24], musica: 'hormiguero',
    dibujo: [
      ['#', 0, 0, 45, 23], ['.', 0, 8, 3, 11], ['.', 4, 2, 43, 19], ['~', 4, 18, 43, 19],
      ['#', 4, 12, 9, 13], ['#', 14, 14, 17, 15], ['#', 22, 12, 25, 13], ['#', 30, 14, 33, 15], ['#', 38, 12, 43, 13],
      ['.', 44, 8, 45, 11],
      ['H', 40, 11], ['x', 23, 11], ['o', 15, 13], ['o', 31, 13], ['p', 27, 6], ['p', 12, 6],
      ['$', 5, 11], ['$', 42, 11],
      ['h', 6, 11], ['h', 24, 11], ['r', 10, 2], ['r', 20, 2], ['r', 34, 2],
    ],
  },
  {
    id: 'A3', nombre: 'El corazón del quebracho', zona: 'hormiguero', pos: [204, 100], tam: [46, 28], musica: 'reina', jefe: 'reina',
    compuertas: [{ jefe: 'reina' }],
    dibujo: [
      ['#', 0, 0, 45, 27], ['.', 2, 2, 43, 23], ['.', 0, 10, 1, 13], ['G', 1, 10, 1, 13],
      ['=', 6, 18, 11, 18], ['=', 16, 14, 21, 14], ['=', 26, 18, 31, 18],
      ['J', 36, 23], ['F', 38, 6],
      ['r', 10, 2], ['r', 22, 2], ['r', 34, 2], ['h', 3, 23],
    ],
  },
].map(armarSalaLM);

const SALA_POR_ID = Object.fromEntries(SALAS_LM.map((s) => [s.id, s]));

/* la sala que contiene el punto del mundo (en píxeles) */
function salaEn(wx, wy) {
  for (const s of SALAS_LM) {
    const x0 = s.pos[0] * 8, y0 = s.pos[1] * 8, x1 = x0 + s.tam[0] * 8, y1 = y0 + s.tam[1] * 8;
    if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1) return s;
  }
  return null;
}
