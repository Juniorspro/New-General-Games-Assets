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
    guion: [['hasta', 1.2], ['salta', 1, 0.5, 0, 0.25], ['borde', 1, 0.5], ['hasta', 8.3], ['camina', 1, 0.3], ['hasta', 9.5]],
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
    // subir por tablas; arriba, dos bolas de plastilina vienen rodando de frente
    // (la segunda justo atrás de la primera): se saltan de a una
    id: '1-9', nombre: ['¡Bolas!', 'Balls!', 'Bolas!'],
    guion: [['hasta', 3.0], ['salta', 1, 0.5, 0, 0.25], ['borde', -1, 0.5, 0, 0.25], ['borde', 1, 0.5, 0, 0.3], ['bola', 1.6, 1, 0.5], ['bola', 1.2, 1, 0.5], ['hasta', 9.5]],
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.........D',
      '....######',
      '..........',
      '.--.......',
      '..........',
      '....---...',
      'P.........',
      '##########',
    ],
    trampas: [
      { si: { zona: [3.5, 6.5, 6.5, 8] }, hace: [{ que: 'bola', pos: [9.0, 7.6], vx: -3.4 }, { que: 'bola', pos: [9.0, 7.6], vx: -3.4, en: 0.7 }] },
    ],
  },
  {
    // el examen: la tabla que se cae sobre los pinches, la plastilina que se
    // desarma, el pinche que sale donde cae el salto corto… y arriba la mano
    // se lleva la puerta al principio: hay que bajar todo de un salto
    id: '1-10', nombre: ['El examen', 'The exam', 'A prova'],
    guion: [['hasta', 1.4], ['salta', 1, 0.5, 0, 0.3], ['borde', 1, 0.5], ['borde', -1, 0.5, 0, 0.3], ['borde', 1, 0.5], ['hasta', 8.3], ['calma'], ['salta', -1, 0.5], ['hasta', 0.5]],
    grupos: { a: { tipo: 'tabla' }, b: { tipo: 'pinches', oculto: true }, c: { fragil: 0.35 }, d: { tipo: 'pinches' } },
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '......b..D',
      '......####',
      '..........',
      '..ccc.....',
      '..........',
      '......--..',
      '..........',
      '...aa.....',
      'P.dddd....',
      '##########',
    ],
    trampas: [
      { si: { pisa: 'a' }, hace: [{ que: 'caer', g: 'a', aviso: 0.4 }] },
      { si: { zona: [5.7, 4.5, 7.3, 6], suelo: true }, hace: [{ que: 'mostrar', g: 'b' }] },
      // la mano se lleva la puerta abajo… y los pinches del piso se esconden (la bajada es de premio)
      { si: { cerca: 'puerta', r: 2.0 }, hace: [{ que: 'mano', agarra: 'puerta', hasta: [0.5, 13.3], t: 1.2 }, { que: 'nota', texto: 'nota_casi', en: 0.6 }, { que: 'ocultar', g: 'd', en: 1.6 }] },
    ],
  },
];

const COCINA = [
  {
    // la bandeja lleva de un lado al otro… pero apenas arranca se para y se cae:
    // hay que saltar a tiempo a la tabla de arriba
    id: '2-1', nombre: ['La bandeja', 'The tray', 'A bandeja'],
    guion: [['hasta', 2.9], ['alerta', 1, 0.5, 0, 0.3], ['borde', 1, 0.5, 0, 0.3], ['hasta', 8.6]],
    grupos: { a: { vaiven: { a: [4, 0], t: 3.2 } } },
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
      '....---...',
      'P.......D.',
      '##aa....##',
      '..........',
      '^^^^^^^^^^',
    ],
    trampas: [{ si: { zona: [3.0, 10, 6, 12], pisa: 'a' }, hace: [{ que: 'parar', g: 'a' }, { que: 'caer', g: 'a', aviso: 0.4 }] }],
  },
  {
    // la tostadora: el resorte de la izquierda te tira contra los cuchillos que
    // salen del techo; el de la derecha no (y hay que saltar el primero para llegar)
    id: '2-2', nombre: ['La tostadora', 'The toaster', 'A torradeira'],
    guion: [['hasta', 1.0], ['salta', 1, 0.2], ['resorte', 7.5, -1], ['hasta', 5.5]],
    grupos: { b: { tipo: 'pinches', dir: 'abajo', oculto: true } },
    mapa: [
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '.###......',
      '.bbb.D....',
      '#...##...#',
      '..........',
      '..........',
      'P.........',
      '##R####R##',
    ],
    trampas: [{ si: { zona: [1.2, 12, 3.8, 16] }, hace: [{ que: 'mostrar', g: 'b' }] }],
  },
  {
    // la puerta escupe albóndigas con ritmo: el que salta para adelante cae
    // justo encima de la siguiente (se saltan en el lugar). Y cuando parece que
    // terminó, escupe una más a quemarropa: la última se salta de antes
    id: '2-3', nombre: ['Albóndigas', 'Meatballs', 'Almôndegas'],
    guion: [['hasta', 2.0], ['bola', 1.7, 0, 0.5], ['bola', 1.7, 0, 0.5], ['bola', 1.7, 0, 0.5], ['hasta', 6.0], ['salta', 1, 0.5], ['hasta', 9.5]],
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
      '##########',
    ],
    trampas: [
      { id: 'ritmo', si: { zona: [1.0, 0, 3, 15] }, hace: [0, 1.15, 2.3].map((en) => ({ que: 'bola', sale: 'puerta', vx: -4.5, en })) },
      { si: { cerca: 'puerta', r: 2.6, tras: 'ritmo', espera: 3.0 }, hace: [{ que: 'bola', sale: 'puerta', vx: -4.5 }] },
    ],
  },
  {
    // galletitas que se desarman al pisarlas; la última es de mentira
    id: '2-4', nombre: ['Galletitas', 'Crackers', 'Bolachas'],
    guion: [['borde', 1, 0.3], ['borde', 1, 0.3], ['borde', 1, 0.5], ['hasta', 8.5]],
    grupos: { a: { fragil: 0.3 }, b: { fragil: 0.3 }, c: { falso: true } },
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
      'P.......D.',
      '##.a.b.c##',
      '..........',
      '^^^^^^^^^^',
    ],
  },
  {
    // la masa se hunde si te quedás parado; la del medio, mucho más rápido
    id: '2-5', nombre: ['Masa blanda', 'Soft dough', 'Massa mole'],
    guion: [['borde', 1, 0.2], ['borde', 1, 0.3], ['borde', 1, 0.4], ['hasta', 9.5]],
    grupos: { a: { blanda: 2.8 }, b: { blanda: 2.8, hunde: 0.18 } },
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
      'P........D',
      '##aa.bb.##',
      '..........',
      '^^^^^^^^^^',
      '##########',
    ],
  },
  {
    // ¡corten!: en un cuadro la puerta aparece arriba de la alacena y el piso
    // de atrás se llena de pinches; hay que subir por las tablas
    id: '2-6', nombre: ['¡Corten!', 'Cut!', 'Corta!'],
    guion: [['hasta', 7.3], ['calma'], ['salta', -1, 0.5], ['borde', 1, 0.5], ['hasta', 7.5]],
    grupos: { a: { tipo: 'pinches', oculto: true } },
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
      '......---.',
      '..........',
      '..---.....',
      'P.aaaa...D',
      '##########',
    ],
    trampas: [
      { si: { cerca: 'puerta', r: 2.4 }, hace: [{ que: 'corte' }, { que: 'puerta', celda: [7, 9], salta: true }, { que: 'mostrar', g: 'a' }, { que: 'nota', texto: 'nota_confia', en: 0.4 }] },
    ],
  },
  {
    // la puerta camina por la mesada; la tabla para subir se cae apenas la pisás
    id: '2-7', nombre: ['Puerta con patas', 'Walking door', 'Porta com pernas'],
    grupos: { a: { tipo: 'tabla' } },
    puertaVaiven: { a: [-5, 0], t: 4.4 },
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
      '.........D',
      '....######',
      '..........',
      '.aa.......',
      'P.........',
      '####^^^^^^',
    ],
    trampas: [{ si: { pisa: 'a' }, hace: [{ que: 'caer', g: 'a', aviso: 0.35 }] }],
  },
  {
    // cabezazo: sobre el pozo hay un bloque invisible; el salto alto se lo come
    // y cae a los pinches. Un saltito largo pasa por abajo
    id: '2-8', nombre: ['Cabezazo', 'Headbutt', 'Cabeçada'],
    grupos: { a: { golpe: true } },
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
      '....aa....',
      '..........',
      'P........D',
      '####^^####',
    ],
  },
  {
    // temblor: cuando pasás por abajo, el techo se viene abajo de a pedazos,
    // de atrás para adelante: hay que correr sin parar
    id: '2-9', nombre: ['Temblor', 'Quake', 'Tremor'],
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
      '##########',
      '..abcdef..',
      '..........',
      'P........D',
      '##########',
    ],
    trampas: [
      { si: { zona: [2.5, 0, 3.5, 15] }, hace: [{ que: 'temblor', t: 0.5 }, ...'abcdef'.split('').map((g, k) => ({ que: 'caer', g, aviso: 0.3, en: 0.1 + k * 0.14 }))] },
    ],
  },
  {
    // hora pico: galletitas que se desarman sobre los pinches y, al llegar, un
    // corte que sube la puerta a la tabla
    id: '2-10', nombre: ['Hora pico', 'Rush hour', 'Hora do rush'],
    guion: [['borde', 1, 0.5], ['salta', 1, 0.15], ['calma'], ['salta', 0, 0.5], ['hasta', 8.5]],
    grupos: { a: { fragil: 0.3 }, b: { fragil: 0.3 } },
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
      '.......---',
      'P........D',
      '##.a.b.###',
      '^^^^^^^^^^',
    ],
    trampas: [
      { si: { cerca: 'puerta', r: 1.6 }, hace: [{ que: 'corte' }, { que: 'puerta', celda: [8, 10], salta: true }, { que: 'nota', texto: 'nota_ultima', en: 0.3 }] },
    ],
  },
];

export const NIVELES = [...TALLER, ...COCINA];
