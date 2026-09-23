/* ============================================================================
   luz-mala/js/historia.js — lo que se dice. En el monte chaqueño, a la luz
   que va y viene de noche por el campo le dicen la luz mala: trae desgracia,
   hay que persignarse. Esta vez la luz mala es una luciérnaga que baja a
   prender los faroles de un quebracho que se está apagando por dentro.
   Los diálogos cambian con el avance: 0 al empezar, 1 con el Torito vencido,
   2 con la Viuda vencida.
   ========================================================================== */

const INTRO = [
  'EN EL MONTE CHAQUEÑO HAY UN QUEBRACHO TAN VIEJO QUE ADENTRO TIENE UN PUEBLO.',
  'LOS BICHOS DEL QUEBRACHO VIVÍAN DE TRES FAROLES: UNO EN LAS RAÍCES, UNO EN LA TELARAÑA Y UNO EN EL CORAZÓN.',
  'UNA NOCHE SE APAGARON LOS TRES. Y EN LA OSCURIDAD EMPEZÓ A VERSE UNA LUZ SOLA, QUE IBA Y VENÍA.',
  'LA LLAMARON LA LUZ MALA.',
  'ESA LUZ ERA YO.',
];

const NOMBRES_LM = {
  chispa: 'CHISPA', mamboreta: 'EL MAMBORETÁ', vaquita: 'VAQUITA', canasto: 'DON CANASTO', bolita: 'BOLITA',
};

/* q: quién habla (retrato); cada entrada de la lista es un avance */
const CHARLAS = {
  mamboreta: [
    [
      { q: 'mamboreta', t: 'NO TE ACERQUES TANTO, NENA. DICEN QUE LA LUZ MALA TRAE DESGRACIA.' },
      { q: 'mamboreta', t: '...AUNQUE DE CERCA PARECÉS UNA LUCIÉRNAGA NOMÁS.' },
      { q: 'chispa', t: 'ME LLAMO CHISPA. VENGO A PRENDER LOS FAROLES.' },
      { q: 'mamboreta', t: 'SE APAGARON CUANDO LA REINA DE LA MARABUNTA SE METIÓ EN EL CORAZÓN DEL QUEBRACHO. SIN FAROLES, EL ÁRBOL SE SECA.' },
      { q: 'mamboreta', t: 'EL PRIMERO ESTÁ ABAJO, EN LAS RAÍCES. LO CUIDA EL TORITO. CUANDO BAJA LA CABEZA, EMBISTE: SALTALO.' },
    ],
    [
      { q: 'mamboreta', t: 'SE PRENDIÓ EL FAROL DE LAS RAÍCES. LO VI DESDE ACÁ: EL HONGAL VOLVIÓ A BRILLAR.' },
      { q: 'mamboreta', t: 'TE QUEDÓ EL ALETEO DEL TORITO EN LAS ALAS. CON ESO SE CRUZA EL TÚNEL DE LAS ESPINAS, ABAJO A LA DERECHA DEL HONGAL.' },
      { q: 'mamboreta', t: 'MÁS ABAJO ESTÁ LA TELARAÑA. LA VIUDA NO DEJA PASAR A NADIE.' },
    ],
    [
      { q: 'mamboreta', t: 'DOS FAROLES. EN EL PUEBLO YA NO TE DICEN LUZ MALA: TE DICEN CHISPA.' },
      { q: 'mamboreta', t: 'LA RESINA DE LA VIUDA SE TE PEGÓ EN LAS PATAS. AHORA TE PODÉS AGARRAR DE LAS PAREDES.' },
      { q: 'mamboreta', t: 'QUEDA EL CORAZÓN. LA REINA NO LO VA A SOLTAR FÁCIL. CUANDO APAGUE LA LUZ, LA TUYA ALCANZA.' },
    ],
  ],
  vaquita: [
    [
      { q: 'vaquita', t: '¿VOS SOS LA LUZ MALA? MI ABUELA DICE QUE SI TE VEO TENGO QUE REZAR.' },
      { q: 'vaquita', t: 'PERO SOS CHIQUITA. ¿ME DEJÁS TOCAR TU LUZ?' },
      { q: 'vaquita', t: '...ESTÁ TIBIA.' },
    ],
    [
      { q: 'vaquita', t: '¡TE VI VOLVER! LES DIJE A TODOS QUE LA LUZ MALA ERA BUENA.' },
      { q: 'vaquita', t: 'NADIE ME CREYÓ. PERO EL FAROL SE PRENDIÓ IGUAL.' },
    ],
    [
      { q: 'vaquita', t: 'MI ABUELA AHORA TE DEJA UN PLATITO DE ROCÍO EN LA PUERTA.' },
      { q: 'vaquita', t: 'CUANDO SEA GRANDE QUIERO BRILLAR COMO VOS.' },
    ],
  ],
  canasto: [
    [{ q: 'canasto', t: 'PASE, PASE. EN EL CANASTO TENGO DE TODO... SI TRAE ÁMBAR.' }],
  ],
  bolita: [
    [
      { q: 'bolita', t: 'YO ME HAGO BOLITA CUANDO TENGO MIEDO. ÚLTIMAMENTE VIVO HECHO BOLITA.' },
      { q: 'bolita', t: 'SI TE PERDÉS, EN LA PAUSA ESTÁ EL MAPA. YO LO VOY DIBUJANDO POR DONDE VAS.' },
      { q: 'bolita', t: 'LOS HONGOS QUE BRILLAN SON PARA DESCANSAR: SENTATE Y TU LUZ SE ACUERDA DE AHÍ.' },
    ],
    [
      { q: 'bolita', t: 'EN EL HONGAL HAY UNA PARED QUE SUENA A HUECO, ARRIBA A LA IZQUIERDA. YO LA ESCUCHÉ, PERO ME DIO MIEDO.' },
    ],
    [
      { q: 'bolita', t: 'EN LOS HILOS, A LA IZQUIERDA DE TODO, BRILLA ALGO. SE LLEGA DESDE EL TABLÓN CHIQUITO.' },
    ],
  ],
};

const JEFES_TXT = {
  torito: { nombre: 'EL TORITO', sub: 'GUARDIÁN DE LAS RAÍCES' },
  viuda: { nombre: 'LA VIUDA', sub: 'LA QUE TEJE EN LA OSCURIDAD' },
  reina: { nombre: 'LA REINA DE LA MARABUNTA', sub: 'LA QUE APAGÓ EL CORAZÓN' },
};

/* lo que aparece en el cartel grande al conseguir algo */
const HALLAZGOS = {
  aleteo: { titulo: 'ALETEO', txt: 'CON LAS ALAS SALÍS DISPARADA PARA ADELANTE. EN EL AIRE, UNA VEZ POR SALTO.', icono: 'viento' },
  resina: { titulo: 'RESINA', txt: 'CAYENDO CONTRA UNA PARED TE DESLIZÁS DESPACIO. SALTÁ PARA REBOTAR Y SUBIR.', icono: 'mano' },
  chispaExtra: { titulo: 'UNA CHISPA MÁS', txt: 'UNA LUZ DE MÁS: AGUANTÁS UN GOLPE MÁS.', icono: 'chispa' },
  farol_raices: { titulo: 'SE PRENDIÓ EL FAROL', txt: 'LAS RAÍCES VUELVEN A TENER LUZ.', icono: 'luz' },
  farol_tela: { titulo: 'SE PRENDIÓ EL FAROL', txt: 'LA TELARAÑA VUELVE A TENER LUZ.', icono: 'luz' },
  farol_hormiguero: { titulo: 'SE PRENDIÓ EL FAROL MADRE', txt: 'EL CORAZÓN DEL QUEBRACHO VUELVE A TENER LUZ.', icono: 'luz' },
};

/* la tienda de Don Canasto */
const TIENDA = [
  { id: 'iman', nombre: 'PELUSA DE CARDO', txt: 'EL ÁMBAR SUELTO VIENE SOLO DESDE MÁS LEJOS.', precio: 40 },
  { id: 'cura', nombre: 'ROCÍO DE LA MAÑANA', txt: 'TE CURÁS MÁS RÁPIDO.', precio: 70 },
  { id: 'espina', nombre: 'ESPINA DE QUEBRACHO', txt: 'MÁS DURA QUE LA DE VINAL: PEGA MÁS FUERTE.', precio: 110 },
  { id: 'corazon', nombre: 'CORAZÓN DE ÁMBAR', txt: 'UNA CHISPA MÁS DE VIDA.', precio: 140 },
];

const FINAL_LM = [
  'EL CORAZÓN DEL QUEBRACHO VOLVIÓ A LATIR.',
  'ESA NOCHE, EN EL PUEBLO, NADIE SE ESCONDIÓ DE LA LUZ.',
  'DESDE ENTONCES, EN EL MONTE, CUANDO ALGUIEN VE UNA LUZ QUE VA Y VIENE, NO SE PERSIGNA.',
  'LA SALUDA.',
];

const CREDITOS_LM = [
  'LUZ MALA',
  'UN JUEGO HECHO CON CÓDIGO: CADA PÍXEL ESTÁ DIBUJADO Y CADA NOTA ESTÁ SINTETIZADA. NO HAY UNA SOLA IMAGEN NI UN SOLO ARCHIVO DE AUDIO.',
  'EL QUEBRACHO SE COMPROBÓ CON UN RESOLVEDOR QUE USA LA MISMA FÍSICA DEL JUEGO: SE PUEDE RECORRER ENTERO Y LO CERRADO ESTÁ CERRADO.',
  'PARA LOS BICHOS DEL MONTE CHAQUEÑO.',
];
