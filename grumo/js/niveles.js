// Las 30 escenas de Grumo, en tres sets de diez. Cada una es un escenario
// de 10 × 15 celdas (el mapa, ver partida.js › leerMapa) y lo que el
// animador le hace a Grumo cuando pasa por algún lado (las trampas): se
// aprenden muriendo, como en el género. Todas se prueban con el resolvedor
// (pruebas/resolver.mjs): cada una se puede ganar, el camino "ingenuo"
// (el que se jugaría sin saber de las trampas) no gana y se mide cuánto
// perdona cada control.
//
// Coordenadas: x de 0 a 10 y y de 0 a 15 (en celdas, y para abajo). Las
// zonas miran el centro de Grumo: [x0, y0, x1, y1].
export const SETS = [
  { id: 'taller', niveles: 10 },
  { id: 'cocina', niveles: 10 },
  { id: 'noche', niveles: 10 },
];

const TALLER = [
  {
    // la mano se lleva la puerta arriba: hay que subir (nadie se muere)
    id: '1-1', nombre: ['Primer día', 'First day', 'Primeiro dia'], ayuda: 'ayudaMover',
    // la solución pensada, jugada como persona en las pruebas
    guion: [['hasta', 6.2], ['salta', 1, 0.5, 0, 0.25], ['hasta', 8.6], ['calma'], ['borde', -1, 0.5], ['borde', 1, 0.5], ['hasta', 8.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '......----',
      '..........',
      '...--.....',
      '..........',
      '.......##.',
      'P......##D',
      '##########',
    ],
    trampas: [
      { si: { cerca: 'puerta', r: 2.2 }, hace: [{ que: 'mano', agarra: 'puerta', hasta: [8.5, 7.3], t: 0.6 }, { que: 'nota', texto: 'nota_confia', en: 0.3, t: 2.5 }] },
    ],
  },
  {
    // el piso se cae justo antes de la puerta: se salta
    id: '1-2', nombre: ['Pisá tranquilo', 'Step lightly', 'Pise tranquilo'],
    // la solución pensada, jugada como persona en las pruebas
    guion: [['hasta', 2.2], ['salta', 1, 0.5], ['hasta', 9.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      'P........D',
      '###aaa####',
    ],
    trampas: [{ si: { zona: [2.6, 11, 6, 14] }, hace: [{ que: 'caer', g: 'a' }] }],
  },
  {
    // los pinches salen cuando te acercás, y los segundos donde cae el salto largo:
    // hay que saltar corto, parar y saltar de nuevo
    id: '1-3', nombre: ['Pinches tímidos', 'Shy spikes', 'Espinhos tímidos'], ayuda: 'ayudaSalto',
    grupos: { a: { tipo: 'pinches', oculto: true }, b: { tipo: 'pinches', oculto: true } },
    // la solución pensada, jugada como persona en las pruebas
    guion: [['hasta', 2.3], ['salta', 1, 0.15, 0, 0.3], ['hasta', 4.9], ['salta', 1, 0.5], ['hasta', 9.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      'P..a..bb.D',
      '##########',
    ],
    trampas: [
      { si: { zona: [1.6, 11, 3.2, 14] }, hace: [{ que: 'mostrar', g: 'a' }] },
      { si: { salta: true, zona: [1.5, 11, 4.6, 14] }, hace: [{ que: 'mostrar', g: 'b' }] },
    ],
  },
  {
    // el techo baja de golpe (y el agujero que deja es el camino para arriba)
    id: '1-4', nombre: ['Techo bajo', 'Low ceiling', 'Teto baixo'],
    // la solución pensada, jugada como persona en las pruebas
    guion: [['hasta', 3.2], ['calma'], ['salta', 1, 0.3, 0, 0.2], ['hasta', 5.0], ['salta', 0, 0.5, 1, 0.3], ['hasta', 8.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '........D.',
      '####aa####',
      '..........',
      'P.........',
      '##########',
    ],
    trampas: [{ si: { zona: [3.0, 11.8, 6.4, 14] }, hace: [{ que: 'mover', g: 'a', a: [0, 2], t: 0.15, curva: 'golpe', aviso: 0.25 }] }],
  },
  {
    // la puerta con patas se escapa; después la mano la sube arriba de todo
    id: '1-5', nombre: ['La puerta tímida', 'The shy door', 'A porta tímida'],
    // la solución pensada, jugada como persona en las pruebas
    guion: [['hasta', 3.4], ['calma'], ['hasta', 2.5], ['salta', -1, 0.5, 0, 0.25], ['salta', 1, 0.5, 0, 0.25], ['borde', 1, 0.5], ['hasta', 8.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '....------',
      '..........',
      '.---......',
      '..........',
      '##........',
      '##P..D....',
      '##########',
    ],
    trampas: [
      // corre hasta la otra punta y, apenas para, la mano se la lleva arriba
      { si: { cerca: 'puerta', r: 2.3 }, hace: [{ que: 'puerta', celda: [9, 13], t: 0.9, patas: true }, { que: 'mano', agarra: 'puerta', hasta: [8.5, 7.3], t: 0.7, en: 0.95 }, { que: 'nota', texto: 'nota_casi', en: 1.4 }] },
    ],
  },
  {
    // el escalón se hunde cuando saltás hacia él y vuelve: un saltito lo engaña
    id: '1-6', nombre: ['Escalón mañoso', 'Tricky step', 'Degrau manhoso'],
    // la solución pensada, jugada como persona en las pruebas
    guion: [['salta', 0, 0.05], ['calma'], ['borde', 1, 0.5, 0, 0.3], ['borde', 1, 0.5, 0, 0.3], ['hasta', 7.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.......D..',
      '......###.',
      '..........',
      '...aa.....',
      'P.........',
      '##........',
      '##........',
      '##^^^^^^^^',
    ],
    trampas: [{ si: { salta: true, zona: [0, 10, 2.6, 12] }, hace: [{ que: 'mover', g: 'a', a: [0, 3], t: 0.2, curva: 'rapida' }, { que: 'mover', g: 'a', a: [0, -3], t: 0.5, en: 1.2 }] }],
  },
  {
    // el piso antes del pozo está pintado: hay que saltar de antes, corriendo
    id: '1-7', nombre: ['Piso pintado', 'Painted floor', 'Chão pintado'],
    guion: [['camina', 1, 0.45], ['salta', 1, 0.5], ['hasta', 9.5]],
    grupos: { a: { falso: true } },
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      'P........D',
      '###aa.####',
    ],
  },
  {
    // abajo del techo la mano te agarra y te devuelve al principio (siempre):
    // hay que ir por arriba del techo y bajar por el hueco de la puerta
    id: '1-8', nombre: ['¡Por ahí no!', 'Not that way!', 'Por aí não!'],
    guion: [['hasta', 1.2], ['salta', 1, 0.5, 0, 0.25], ['salta', 1, 0.3, 1, 9], ['hasta', 8.3], ['camina', 1, 0.3], ['hasta', 9.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.....####.',
      '..##......',
      'P.##.....D',
      '##########',
    ],
    trampas: [{ una: false, si: { zona: [4.2, 12.5, 8.8, 14] }, hace: [{ que: 'mano', agarra: 'grumo', hasta: [0.8, 13.3], t: 0.9 }, { que: 'nota', texto: 'nota_porahi', en: 0.5 }] }],
  },
  {
    // subir con bolas de plastilina que bajan rodando de frente (la segunda, justo atrás de la primera)
    id: '1-9', nombre: ['¡Bolas!', 'Balls!', 'Bolas!'],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.........D',
      '....######',
      '..........',
      '..........',
      '.--.......',
      '..........',
      '..........',
      '....----..',
      'P.........',
      '##########',
    ],
    trampas: [
      { si: { zona: [2, 8, 4.5, 10] }, hace: [{ que: 'bola', en: [9.5, 5.5], vx: -3.2 }, { que: 'bola', en: [9.5, 5.5], vx: -3.2, en2: 0 }] },
    ],
  },
];

export const NIVELES = [...TALLER];
