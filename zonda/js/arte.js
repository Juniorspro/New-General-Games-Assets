/* ============================================================================
   zonda/js/arte.js — Ayelén, el Zonda y los colores de cada tramo del cerro.
   Ayelén lleva chullo (el gorro con orejeras) y poncho de vicuña, de colores
   quietos: el que cambia es la bufanda, que dice cuántos dash le quedan.
   Los cuadros se arman por partes (cabeza + poncho + piernas) para no dibujar
   diez veces la misma cara.
   ========================================================================== */

const PAL_AYE = {
  h: '#d9a441', r: '#b8452f', w: '#f4e6c4', o: '#3a2418', p: '#e3ad7f', q: '#b97a52', e: '#1b1426',
  c: '#8d5d3d', C: '#6b4430', d: '#e2b24a', D: '#b8452f', n: '#3e4160', N: '#2c2e46', b: '#2a1c14', m: '#e3ad7f',
};
const CONTORNO = '#1b1426';

/* la cabeza mirando a la derecha: orejera con borla atrás, ojo adelante */
const CABEZA = [
  '...hhhh...',
  '..hrhrhr..',
  '.hhhhhhhh.',
  '.hooppppp.',
  '.hoopppep.',
  '.w.ppppq..',
];
const CABEZA_PARPADEA = [
  '...hhhh...',
  '..hrhrhr..',
  '.hhhhhhhh.',
  '.hooppppp.',
  '.hoopppqp.',
  '.w.ppppq..',
];
const PONCHO = {
  quieto: ['..cccccc..', '.ccdDdDdc.', '.cccccccc.', '..CccccC..'],
  respira: ['..cccccc..', '.ccdDdDdc.', '.cccccccc.', '.CCcccccC.'],
  corre: ['..ccccccm.', '.ccdDdDdc.', '.cccccccc.', '..CccccC..'],
  sube: ['.mcccccc..', '.ccdDdDdcm', '.cccccccc.', '..CccccC..'],
  pared: ['..ccccccmm', '.ccdDdDdc.', '.cccccccc.', '..CccccC..'],
  dash: ['.ccccccc..', 'ccdDdDdcc.', '.cccccccc.', '...CcccC..'],
};
const PIERNAS = {
  quieto: ['...n..n...', '...n..n...', '..bb..bb..'],
  c0: ['...n..n...', '..n....n..', '.bb....bb.'],
  c1: ['...n.n....', '...n..n...', '..bb..bb..'],
  c2: ['....nn....', '....nn....', '...bbbb...'],
  c3: ['....n.n...', '...n...n..', '..bb...bb.'],
  c4: ['....nn....', '...n.n....', '..bb.bb...'],
  c5: ['....nn....', '....nn....', '....bbb...'],
  salta: ['...nnn....', '..nn..n...', '..bb..bb..'],
  cae: ['..n....n..', '.n......n.', '.b......b.'],
  pared: ['....nn....', '....n.n...', '...bb.bb..'],
  trepa0: ['...n..n...', '...n...n..', '..bb...bb.'],
  trepa1: ['....n.n...', '...n..n...', '...bb.bb..'],
  agacha: ['..nnnnnn..', '..bb..bb..'],
};

/* armar un cuadro: la cabeza puede ir 1 px más abajo (el rebote al correr) */
function cuadroAye(cabeza, poncho, piernas, bajar) {
  const filas = [];
  for (let i = 0; i < (bajar || 0); i++) filas.push('..........');
  for (const f of cabeza) filas.push(f);
  for (const f of poncho) filas.push(f);
  for (const f of piernas) filas.push(f);
  return sprite(filas, PAL_AYE, { contorno: CONTORNO });
}

let SPR = null;
function prepararArte() {
  if (SPR) return SPR;
  const C = CABEZA, P = PONCHO, L = PIERNAS;
  SPR = {
    quieta: [cuadroAye(C, P.quieto, L.quieto), cuadroAye(C, P.respira, L.quieto)],
    parpadea: cuadroAye(CABEZA_PARPADEA, P.quieto, L.quieto),
    corre: [
      cuadroAye(C, P.corre, L.c0), cuadroAye(C, P.corre, L.c1, 1), cuadroAye(C, P.corre, L.c2, 1),
      cuadroAye(C, P.corre, L.c3), cuadroAye(C, P.corre, L.c4, 1), cuadroAye(C, P.corre, L.c5, 1),
    ],
    salta: cuadroAye(C, P.sube, L.salta),
    cae: cuadroAye(C, P.sube, L.cae),
    pared: cuadroAye(C, P.pared, L.pared),
    trepa: [cuadroAye(C, P.pared, L.trepa0), cuadroAye(C, P.pared, L.trepa1)],
    agacha: cuadroAye(C, [P.quieto[0], P.quieto[3]], L.agacha, 2),
    dash: cuadroAye(C, P.dash, L.cae),
  };
  SPR.retratos = prepararRetratos();
  SPR.apacheta = sprite([
    '....kk....', '...kaak...', '..kkkkkk..', '..kabbak..', '.kkkkkkkk.', '.kbaabaak.', 'kkkkkkkkkk', 'kaabbaabak',
  ], { k: '#5b4a42', a: '#8d7a6c', b: '#a8988a' }, { contorno: CONTORNO });
  SPR.carta = [0, 1, 2, 1].map((i) => sprite([
    'wwwwwwww', 'wrwwwwrw', 'wwrwwrww', 'wwwrrwww', 'wwwwwwww', 'wwwwwwww',
  ].map((f, y) => i === 2 && y === 0 ? 'wwwwwwww' : f), { w: ['#f4ead2', '#fff6dc', '#ffffff'][i], r: '#b8452f' }, { contorno: CONTORNO }));
  SPR.cristal = [0, 1, 2, 3].map((i) => sprite([
    '...a...', '..aba..', '.abbba.', 'abbcbba', '.abbba.', '..aba..', '...a...',
  ], { a: '#3fb6a8', b: i === 1 ? '#bff5e8' : '#7ee8d2', c: i === 2 ? '#ffffff' : '#e8fff9' }, { contorno: CONTORNO }));
  return SPR;
}

/* retratos de 20x20 para los diálogos */
function prepararRetratos() {
  const cara = (ojos, boca) => [
    '......hhhhhhhh......',
    '....hhrrhhrrhhhh....',
    '...hhhhhhhhhhhhhh...',
    '..hrhrhrhrhrhrhrhh..',
    '..hhhhhhhhhhhhhhhh..',
    '..hoooppppppppppoh..',
    '..hooppppppppppppoh.',
    '.hoopppppppppppppoh.',
    '.hopp' + ojos + 'ppoh.',
    '.hoppppppppppppppoh.',
    '.hopppppqqpppppppoh.',
    '.hoppppppppppppppoh.',
    '.hwppppp' + boca + 'pppppoh.',
    '.hw.pppppppppppp.hw.',
    '.ww..pppppppppp..ww.',
    '.....cccccccccc.....',
    '...ccccccccccccccc..',
    '..ccdDdDdDdDdDdDdcc.',
    '.cccccccccccccccccc.',
    'cccccccccccccccccccc',
  ];
  const PAL = Object.assign({}, PAL_AYE);
  /* Rosa: la misma cara con canas, chullo gastado y arrugas en los ojos */
  const PAL_ROSA = Object.assign({}, PAL_AYE, { o: '#a8a4a0', h: '#9a7a48', r: '#7a4a3a', c: '#5a4a5a', d: '#b89a58', D: '#7a4a3a', p: '#d49c74', q: '#9a6a4a' });
  return {
    normal: sprite(cara('eeppppppee', 'pqqp'), PAL, { contorno: CONTORNO }),
    triste: sprite(cara('qqppppppqq', 'pqqp'), PAL, { contorno: CONTORNO }),
    firme: sprite(cara('eeppppppee', 'qqqq'), PAL, { contorno: CONTORNO }),
    rosa: sprite(cara('qeppppppeq', 'qppq'), PAL_ROSA, { contorno: CONTORNO }),
  };
}

/* colores de cada tramo: cielo de arriba a abajo, roca, borde, y lo que la
   cubre (pasto, nieve, escarcha) */
const TEMAS = {
  quebrada: {
    cielo: ['#2a1b3d', '#5b2c4f', '#a3485a', '#e27a52', '#f6b36a'], sol: '#ffd98a',
    lejos: '#4a2a4a', medio: '#7a3a44', cerca: '#a04c3c', franjas: ['#c96a3f', '#e0a24e', '#b0503a', '#d88b5a', '#8e3f45'],
    roca: '#8a4a34', rocaOsc: '#5e2f24', rocaClara: '#b86a44', tapa: '#c9b04a', tapaOsc: '#8f8a38', niebla: 'rgba(246,179,106,0.10)',
    polvo: ['#f6c28a', '#e8a070', '#fff0c8'],
  },
  mina: {
    cielo: ['#0c0a10', '#141018', '#1a1420', '#1f1822', '#231a22'], sol: null,
    lejos: '#1a1418', medio: '#241a1c', cerca: '#2e2020', franjas: ['#3a2a24', '#2c201c'],
    roca: '#4a3a34', rocaOsc: '#2a201c', rocaClara: '#6a5448', tapa: '#7a5a3a', tapaOsc: '#4a3624', niebla: 'rgba(40,24,16,0.25)',
    polvo: ['#a08060', '#6a5040', '#d0a070'], oscura: true,
  },
  glaciar: {
    cielo: ['#0e1e3a', '#1c3a64', '#3a6a9a', '#7aa8cc', '#c8e2f0'], sol: '#fff8e8',
    lejos: '#5a7ea8', medio: '#8aaed0', cerca: '#b8d4ea', franjas: ['#dcecf8', '#a8c8e4'],
    roca: '#5a6a84', rocaOsc: '#3a4660', rocaClara: '#8294ae', tapa: '#f4fbff', tapaOsc: '#c8dcec', niebla: 'rgba(220,236,248,0.10)',
    hielo: '#8fd0f0', hieloOsc: '#4a90c8', hieloClaro: '#dff6ff',
    polvo: ['#ffffff', '#e0f0ff', '#c8e0f8'],
  },
  cumbre: {
    cielo: ['#07060e', '#141230', '#2a2250', '#4a3464', '#6a4270'], sol: null,
    lejos: '#1c1a34', medio: '#2a2646', cerca: '#3a3456', franjas: ['#4a4266', '#5a4e72'],
    roca: '#4a4460', rocaOsc: '#2c283e', rocaClara: '#6a6284', tapa: '#e8ecf8', tapaOsc: '#aab2cc', niebla: 'rgba(160,160,210,0.08)',
    polvo: ['#ffffff', '#d8dcf0', '#b8bee0'],
  },
  amanecer: {
    cielo: ['#2a2a5a', '#6a4a7a', '#d0708a', '#f8a870', '#ffe0a0'], sol: '#fff2c0',
    lejos: '#4a3a6a', medio: '#6a4a78', cerca: '#8a5a80', franjas: ['#b07090', '#d89098'],
    roca: '#5a4a64', rocaOsc: '#3a2e44', rocaClara: '#806a88', tapa: '#fff0e0', tapaOsc: '#e0c0c0', niebla: 'rgba(255,224,160,0.10)',
    polvo: ['#fff6dc', '#ffd8b0', '#ffffff'],
  },
};

/* la bufanda-aguayo: dos colores que se alternan, según los dash que quedan */
const BUFANDA = {
  0: ['#5aa0d8', '#9cd2f4'],
  1: ['#c8322f', '#f0a63a'],
  2: ['#e0508e', '#f6d25a'],
};
