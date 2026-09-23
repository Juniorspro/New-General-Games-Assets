/* ============================================================================
   luz-mala/js/arte.js — todo lo que se ve, dibujado a mano en grillas de texto.
   Chispa se arma por partes (cabeza, cuerpo, patas, alas) para que cada pose
   sea una combinación y no un dibujo aparte. Lo oscuro nunca es negro puro:
   los bichos son violetas y marrones muy bajos, y lo que se lee de lejos es
   lo que brilla (los ojos, la capucha naranja, la luz de la cola).
   ========================================================================== */

/* superponer capas de filas: lo que no es '.' de arriba tapa lo de abajo */
function componer(ancho, alto, capas) {
  const g = Array.from({ length: alto }, () => Array(ancho).fill('.'));
  for (const c of capas) {
    if (!c) continue;
    const [filas, dx, dy] = c;
    filas.forEach((f, y) => { for (let x = 0; x < f.length; x++) { const yy = y + (dy || 0), xx = x + (dx || 0); if (f[x] !== '.' && yy >= 0 && yy < alto && xx >= 0 && xx < ancho) g[yy][xx] = f[x]; } });
  }
  return g.map((r) => r.join(''));
}

/* ---------------- Chispa ---------------- */
const PAL_CHISPA = {
  k: '#0d0a14', d: '#3d3156', e: '#62507e', o: '#b8481c', O: '#f08a34', w: '#fff8e0', x: '#ffd0c0',
  g: '#f6ffa8', G: '#b4e858', a: 'rgba(200,232,255,0.55)', A: 'rgba(235,248,255,0.8)',
};
const CAB = {
  normal: ['.o...o.', '..k.k..', '.kkkkk.', 'kOOOOOk', 'kOokoOk', 'kwwkwwk', 'kwwkwwk', '.kkkkk.'],
  parpadea: ['.o...o.', '..k.k..', '.kkkkk.', 'kOOOOOk', 'kOokoOk', 'kkkkkkk', 'kwwkwwk', '.kkkkk.'],
  cierra: ['..o.o..', '..k.k..', '.kkkkk.', 'kOOOOOk', 'kOokoOk', 'kkkkkkk', 'keekeek', '.kkkkk.'],
  duele: ['o.....o', '.k...k.', '.kkkkk.', 'kOOOOOk', 'kOokoOk', 'kxkkkxk', 'kkxkxkk', '.kkkkk.'],
  atras: ['o...o..', '.k.k...', '.kkkkk.', 'kOOOOOk', 'kOokoOk', 'kwwkwwk', 'kwwkwwk', '.kkkkk.'],
  arriba: ['..o.o..', '..k.k..', '.kkkkk.', 'kOOOOOk', 'kwwkwwk', 'kwwkwwk', 'kOokoOk', '.kkkkk.'],
};
const CUE = {
  normal: ['.GGkddddek.', 'gggkdddddk.', 'gGGkkdddkk.'],
  brilla: ['.ggkddddek.', 'gGgkdddddk.', 'ggGkkdddkk.'],
  cura: ['gggkddddek.', 'gggkdddddk.', 'gggkkdddkk.'],
  golpe: ['.GGkdddddkk', 'gggkddddddk', 'gGGkkddddk.'],
  apagada: ['.kkkddddek.', 'kkkkdddddk.', 'kkkkkdddkk.'],
};
const PAT = {
  quieto: ['....kk.kk..', '....k...k..'],
  c0: ['...kk...kk.', '..k......k.'],
  c1: ['....kk.kk..', '...k....k..'],
  c2: ['.....kkk...', '....k.k....'],
  c3: ['....kk.kk..', '....k...k..'],
  sube: ['....kkkk...', '...........'],
  cae: ['....k..k...', '...k....k..'],
  pared: ['kkk.kk.....', 'k..........'],
  sentada: ['...kkkkkk..', '...........'],
};
const ALAS = {
  cae: [['a..', 'aa.', '.a.'], 0, 5],
  dash: [['Aa...', 'aAa..', 'aaa..', '.aa..'], 0, 4],
  sube: [['.a.', 'aa.'], 0, 6],
};
function cuadroChispa(cab, cue, pat, o) {
  o = o || {};
  const dy = o.bob || 0;
  return componer(11, 13, [o.alas ? ALAS[o.alas] : null, [CUE[cue], 0, 8], [PAT[pat], 0, 11], [CAB[cab], 3 + (o.dx || 0), dy]]);
}

/* ---------------- los bichos ---------------- */
const PAL_BICHO = {
  cascarudo: { k: '#08060c', c: '#2c2638', C: '#4a4260', s: '#9088b8', e: '#ffb060', l: '#1c1824' },
  mosquito: { k: '#08060c', b: '#4a3e58', B: '#7a6a90', w: 'rgba(210,225,255,0.55)', r: '#e0b0a0', e: '#ff6048' },
  grillo: { k: '#08060c', g: '#4a6a2e', G: '#7a9a44', h: '#a8c060', l: '#2e4420', e: '#ffe070', a: '#c8b080' },
  chinche: { k: '#08060c', v: '#3e6a3a', V: '#62905a', y: '#c8b048', e: '#ff7a48', l: '#1e2e1a' },
  hormiga: { k: '#08060c', r: '#7a2416', R: '#a83a24', s: '#d06a44', b: '#5e4a2c', B: '#927446', e: '#ffcc60', l: '#2a0e08' },
  polilla: { k: '#08060c', m: '#8e7e62', M: '#c4b08a', o: '#3a2a1c', O: '#f0d8a8', b: '#4e3e30' },
  aranita: { k: '#08060c', a: '#2a2032', A: '#54426a', e: '#ff4848', l: '#1a1420' },
  obrera: { k: '#08060c', r: '#8a3220', R: '#b8502e', e: '#ffcc60', l: '#2a0e08' },
};
const DIB_BICHO = {
  cascarudo: [
    ['.....kkkk....', '...kkCsCCkk..', '..kCCsCCCCck.', '.kCCCCCCCccke', '.kcCCCCCCcckk', 'kccccccccccck', '.kkkkkkkkkkk.', '..l..l..l.l..', '.l..l..l..l..'],
    ['.....kkkk....', '...kkCsCCkk..', '..kCCsCCCCck.', '.kCCCCCCCccke', '.kcCCCCCCcckk', 'kccccccccccck', '.kkkkkkkkkkk.', '.l..l..l..l..', '..l..l..l..l.'],
  ],
  mosquito: [
    ['...ww.....', '..www.....', '...w......', '..kbbBek..', '.bbbbbbkrr', '..k.k.....', '.k...k....', 'k.....k...'],
    ['..........', '..........', '..........', '..kbbBek..', '.bbbbbbkrr', '..wwk.....', '.wwwk.k...', 'k.w...k...'],
  ],
  grillo: [
    ['........a...', '.......a.k..', '....kkkkkGk.', '..kkgGGGGek.', '.kggggggGGk.', 'kggglllggk..', '.kkl..kkl...', '..l...k..l..', '.l.........l'],
    ['............', '........a...', '.......a.k..', '....kkkkkGk.', '..kkgGGGGek.', '.kggggggGGk.', 'kgglllgggk..', 'kllkkkkkll..', '............'],
    ['.......a....', '......a.k...', '...kkkkkGk..', '.kkgGGGGek..', 'kggggggGGk..', 'kgggggggk...', 'llkkkkkk....', 'l..l..l.....', 'l...l..l....'],
  ],
  chinche: [
    ['.....kkk.....', '...kkVVVkk...', '..kvVVVVvvk..', '.kyvvvvvvvvk.', 'kyvvvvvvvvvek', 'kyvvvvvvvvvvk', '.kyyvvvvvvyk.', '..kkyyyyyykk.', '...l..l..l...', '..l..l..l....'],
    ['.....kkk.....', '...kkVVVkk...', '..kvVVVVvvkk.', '.kyvvvvvvvvek', 'kyvvvvvvvvvkk', 'kyvvvvvvvvvvk', '.kyyvvvvvvyk.', '..kkyyyyyykk.', '..l..l..l....', '...l..l..l...'],
  ],
  hormiga: [
    ['........k.....', '.......k.k....', '......kRRk....', '.....kRsRRkBBk', '..kk.kRRRekBbk', '..kRkkkkkkkBbk', '.kRRrkkrrrkBbk', 'kRrrrrkrrrkBbk', '.kkkkkkkkkkBBk', '..l.l..l.l.kk.', '.l.l..l.l.....'],
    ['........k.....', '.......k.k....', '......kRRk....', '.....kRsRRkBBk', '..kk.kRRRekBbk', '..kRkkkkkkkBbk', '.kRRrkkrrrkBbk', 'kRrrrrkrrrkBbk', '.kkkkkkkkkkBBk', '.l.l..l.l..kk.', '..l.l..l.l....'],
  ],
  polilla: [
    ['MM........MM', 'MMm......mMM', '.MmOo..oOmM.', '.mMoo..ooMm.', '..mmmbbmmm..', '....kbbk....', '.....bb.....', '.....k......', '............'],
    ['............', '............', '............', '....kbbk....', '.mmmmbbmmmm.', 'MMmOoobooOmM', 'MMmoo.b.oomM', '.MM...k...M.', '............'],
  ],
  aranita: [
    ['...kkk...', '..kAaAk..', '.kaaaaak.', 'lkeakaekl', 'l.kkkkk.l', '.l.l.l.l.', 'l.......l'],
    ['...kkk...', '..kAaAk..', '.kaaaaak.', 'lkeakaekl', '.lkkkkkl.', 'l.l...l.l', '.l.....l.'],
  ],
  obrera: [
    ['.......k..', '......k...', '.kk..kRk..', 'kRrk.kRek.', 'krrkkkrrk.', '.kkk.kkk..', 'l.l.l.l...'],
    ['.......k..', '......k...', '.kk..kRk..', 'kRrk.kRek.', 'krrkkkrrk.', '.kkk.kkk..', '.l.l.l.l..'],
  ],
};

/* ---------------- los jefes ---------------- */
const PAL_JEFE = {
  torito: { k: '#060408', c: '#2a1a10', C: '#4a2e1a', s: '#7a5234', S: '#b08458', h: '#3a2414', H: '#7a5030', e: '#ff5a2a', E: '#ffe080', l: '#140c08' },
  viuda: { k: '#030205', a: '#16101c', A: '#2e2438', s: '#6a5a7e', r: '#d8202e', R: '#ff6a70', l: '#0e0a12', L: '#2a2034', e: '#ff3a3a' },
  reina: { k: '#050204', r: '#5a160e', R: '#8a2616', s: '#b8482a', S: '#e88a5a', g: '#3a0c08', w: 'rgba(230,210,190,0.28)', W: 'rgba(255,240,220,0.5)', e: '#ffd23a', m: '#2a0804', l: '#1a0604', c: '#e8b040', C: '#fff0a0' },
};
const TORITO_CUERPO = [
  '...........................kk.....',
  '..........................kHHk....',
  '.........................kHHhk....',
  '........................kHHhk.....',
  '..........kkkkkkkk.....kHHhk......',
  '.......kkkCCCCCCCCkk...kHhk.......',
  '.....kkCCCsssCCCCCCCk.kHhhk.......',
  '....kCCCsSSsCCCCCCCCCkkhhk........',
  '...kCCCsSSSsCCCCCCCCCCkhhkk.......',
  '..kCCCCsssCCCCCCCCCCCCkkhhk.......',
  '..kCCCCCCCCCCCCCCCCCCCkehhhk......',
  '.kcCCCCCCCCCCCCCCCCCCCkkhhhhk.....',
  '.kccCCCCCCCCCCCCCCCCCCkkhhhhhk....',
  'kcccCCCCCCCCCCCCCCCCCckkkkkkkk....',
  'kccccCCCCCCCCCCCCCCccck...........',
  'kcccccccccccccccccccccck..........',
  '.kccccccccccccccccccccck..........',
  '..kkkkkkkkkkkkkkkkkkkkk...........',
];
const TORITO_PATAS = {
  a: ['...l...l....l....l...l............', '..l...l....l....l...l.............', '.l...l....l....l...l..............', 'l...l....l....l...l...............'],
  b: ['....l...l....l....l...l...........', '....l...l....l....l...l...........', '...l...l....l....l...l............', '...l...l....l....l...l............'],
  c: ['..ll..ll...ll...ll..ll............', '..................................', '..................................', '..................................'],
};
const VIUDA_DIB = [
  [
    '..........kkkkkk..........',
    '........kkAAAAaakk........',
    '.......kAAsAAaaaaak.......',
    '......kAAsaaaaaaaaak......',
    '......kAaaaarraaaaak......',
    '......kaaaaaRraaaaak......',
    '......kaaaaarraaaaak......',
    '.......kaaaarRaaaak.......',
    '..l.....kaaaaaaaak.....l..',
    '.l.l.....kkaaaakk.....l.l.',
    'l...l.....kAaaak.....l...l',
    'l....ll..kaeaeaak..ll....l',
    '.......llkaaaaaakll.......',
    '....llll.kkaaaakk.llll....',
    '...l....l..kkkk..l....l...',
    '..l......l......l......l..',
    '..l.......l....l.......l..',
    '.l.........l..l.........l.',
  ],
  [
    '..........kkkkkk..........',
    '........kkAAAAaakk........',
    '.......kAAsAAaaaaak.......',
    '......kAAsaaaaaaaaak......',
    '......kAaaaarraaaaak......',
    '......kaaaaaRraaaaak......',
    '......kaaaaarraaaaak......',
    '.......kaaaarRaaaak.......',
    '.l......kaaaaaaaak......l.',
    'l.l......kkaaaakk......l.l',
    '...l......kAaaak......l...',
    '....lll..kaeaeaak..lll....',
    '.......llkaaaaaakll.......',
    '...lllll.kkaaaakk.lllll...',
    '..l.....l..kkkk..l.....l..',
    '.l.......l......l.......l.',
    '.l........l....l........l.',
    'l..........l..l..........l',
  ],
];
const REINA_DIB = [
  '..........................................c.C.c..',
  '.........................................kcCCCck.',
  '...........wWWww..........................kcccck.',
  '........wwWWwwwwww.....................kkkkkkk.k',
  '......wwWwwwwww.wwww...........kk.....kRRRRRRRkk.',
  '.....wWwww..www..wwww.........k..k...kRRsSRRRRRk.',
  '....wwww.....ww...www.....kkkk....k.kRRsRRRRRRRRk',
  '...kkkkkkkkkkkww....ww..kkRRRk.....kRRRRRRRReRRRk',
  '.kkRRRRRRRRRRRkkkkk..wkkRRsRRRk...kRRRRRRRRRRRRRk',
  'kRRssRRRRRRRRRRRRRRkkkkRRRRRRRRk.kgRRRRRRRRRRRkmm',
  'kRsSsRRRRRRRRRRRRRRRRRkkRRRRRRRRkkgRRRRRRRRRRkm..',
  'kRssRRRRRRRRRRRRRRRRRRRkkRRRRRRRkkggRRRRRRRRkmm..',
  'kRRRRRRRRRRRRRRRRRRRRRRRkRRRRRRRk.kggRRRRRRkmm...',
  'krRRRRRRRRRRRRRRRRRRRRRRkkRRRRRkk..kkgggggkkm....',
  'krrRRRRRRRRRRRRRRRRRRRRRkkkkkkkk.....kkkkkk......',
  'krrrRRRRRRRRRRRRRRRRRRRrk..l....l.....l..........',
  '.krrrrRRRRRRRRRRRRRRRrrk..l......l.....l.........',
  '.krrrrrrrRRRRRRRRRRrrrrk.l........l.....l........',
  '..krrrrrrrrrrrrrrrrrrrk.l..........l.....l.......',
  '...kkrrrrrrrrrrrrrrrkk.l............l.....l......',
  '.....kkkkkkkkkkkkkkk..l..............l.....l.....',
];

/* ---------------- los del pueblo ---------------- */
const PAL_NPC = {
  mamboreta: { k: '#06080a', v: '#4a8a3a', V: '#7ab85a', h: '#b8e080', e: '#f4ffc0', p: '#2a5a24' },
  vaquita: { k: '#06040a', r: '#d82a2a', R: '#ff7a64', n: '#141018', w: '#ffffff' },
  canasto: { k: '#080604', b: '#5a4028', B: '#8a6a40', t: '#b09060', h: '#3a2c20', e: '#fff0c0' },
  bolita: { k: '#060608', g: '#5a5e6e', G: '#8a90a4', s: '#c0c8dc', e: '#ffffff', l: '#2a2c34' },
};
const DIB_NPC = {
  mamboreta: [
    ['....k...k...', '.....k.k....', '....kVVVk...', '...keVVVek..', '....kVhVk...', '.....kvk....', '....kvvvk...', '...kkvvvk.k.', '..kVVkvvkVk.', '..kVkkvvkkVk', '...kkvvvk.k.', '....kvvvk...', '....kvvvvk..', '...kvpvpvk..', '...kvvvvvk..', '....kvvvk...', '....k.k.k...', '...k..k..k..', '..k...k...k.', '..k...k...k.'],
    ['...k....k...', '....k..k....', '....kVVVk...', '...keVVVek..', '....kVhVk...', '.....kvk....', '....kvvvk...', '...kkvvvk.k.', '..kVVkvvkVk.', '..kVkkvvkkVk', '...kkvvvk.k.', '....kvvvk...', '....kvvvvk..', '...kvpvpvk..', '...kvvvvvk..', '....kvvvk...', '....k.k.k...', '...k..k..k..', '..k...k...k.', '..k...k...k.'],
  ],
  vaquita: [
    ['...kkkkk...', '..kRRnRRk..', '.kRrrrrnrk.', '.krnrrrrrrk', 'kkrrrnrrnrk', 'knnkkkkkkk.', 'kwnnk......', '.kkk.l.l...'],
    ['...kkkkk...', '..kRRnRRk..', '.kRrrrrnrk.', '.krnrrrrrrk', 'kkrrrnrrnrk', 'knnkkkkkkk.', 'knwnk......', '.kkk.l.l...'],
  ],
  canasto: [
    ['....kkkk....', '...khhhhk...', '...kheehk...', '..kkkkkkkk..', '..kBbtBbBk..', '.kbBtbbBtbk.', '.kBbbtBbbBk.', '.ktbBbbtBbk.', '.kbBbtbbBbk.', '.kBtbbBbtbk.', '.kbbBtbBbbk.', '..kBbbtbBk..', '..kbtBbbtk..', '...kbBtbk...', '....kbbk....', '.....kk.....'],
    ['............', '....kkkk....', '...khhhhk...', '..kkkkkkkk..', '..kBbtBbBk..', '.kbBtbbBtbk.', '.kBbbtBbbBk.', '.ktbBbbtBbk.', '.kbBbtbbBbk.', '.kBtbbBbtbk.', '.kbbBtbBbbk.', '..kBbbtbBk..', '..kbtBbbtk..', '...kbBtbk...', '....kbbk....', '.....kk.....'],
  ],
  bolita: [
    ['...kkkkkk...', '..kGsGsGsk..', '.kgGgGgGgGk.', 'kgGgGgGgGgGk', 'kgggggggggek', '.kkkkkkkkkk.', '..l.l.l.l.l.'],
    ['...kkkkkk...', '..kGsGsGsk..', '.kgGgGgGgGk.', 'kgGgGgGgGgGk', 'kgggggggggek', '.kkkkkkkkkk.', '.l.l.l.l.l..'],
  ],
};

/* ---------------- las cosas ---------------- */
const DIB_COSA = {
  banco: [['....kkkkkkkk....', '..kkCCsCCCCCkk..', '.kCCsCCCCCCCCCk.', 'kcCCCCCCCCCCCCck', 'kcccccccccccccck', '.kkkkkkkkkkkkkk.', '......kTtk......', '......kTtk......', '.....kTttTk.....', '....kkkkkkkk....'],
    { k: '#04080a', c: '#1e7a78', C: '#4ad8c8', s: '#c8fff6', t: '#d8d0c0', T: '#a8a090' }],
  farol: [['...kk...', '...kk...', '..kMMk..', '.kMmmMk.', 'kMvvvvMk', 'kmvvvvmk', 'kmvvvvmk', 'kmvvvvmk', 'kMvvvvMk', '.kMmmMk.', '..kkkk..', '...kk...'],
    { k: '#050406', m: '#3a3228', M: '#6a5a40', v: '#1e1a24' }],
  farolPrendido: [['...kk...', '...kk...', '..kMMk..', '.kMmmMk.', 'kMvwwvMk', 'kmwwwwmk', 'kmwWWwmk', 'kmwWWwmk', 'kMvwwvMk', '.kMmmMk.', '..kkkk..', '...kk...'],
    { k: '#050406', m: '#6a5230', M: '#a88a50', v: '#ffd060', w: '#fff0a0', W: '#ffffff' }],
  terron: [['..kk....', '.kAsk.k.', '.kaAkkAk', 'kaaAkaAk', 'kraakaak', 'krraaakk', '.krrrrk.', '..kkkk..'],
    { k: '#0a0604', a: '#c86a1e', A: '#f0a03a', s: '#ffe08a', r: '#5a3a20' }],
  semilla: [['.kk.', 'kSsk', 'ksSk', '.kk.'], { k: '#0a0806', s: '#7a5a3a', S: '#b08a5a' }],
  hongo: [['.kkk.', 'kCsCk', 'kcccK', '..t..', '..t..'], { k: '#04080a', c: '#1e7a78', C: '#4ad8c8', s: '#c8fff6', K: '#0a2a2a', t: '#a8a090' }],
};

/* ---------------- zonas: colores del fondo, la madera y la luz ---------------- */
const ZONA_ARTE = {
  pueblo: {
    cielo: ['#0c0812', '#140c1c', '#1c1226', '#241830'], lejos: '#1a1022', medio: '#26162a',
    madera: '#5a3428', maderaOsc: '#321a18', maderaClara: '#84503a', borde: '#c07448', vetas: '#442622',
    musgo: '#5a8a4a', musgoClaro: '#8ab86a', luz: '#ffcf80', polvo: ['#ffd9a0', '#ffb070', '#fff0c8'], tablon: '#8a5a3a',
  },
  raices: {
    cielo: ['#05080a', '#0a1012', '#0e1818', '#14201e'], lejos: '#0a1414', medio: '#122020',
    madera: '#46342a', maderaOsc: '#261c16', maderaClara: '#6a5040', borde: '#8e7a54', vetas: '#34261e',
    musgo: '#2a8a7a', musgoClaro: '#5ae0d0', luz: '#5ae0d0', polvo: ['#8affee', '#4ad8c8', '#d8fff8'], tablon: '#2a8a7a',
  },
  tela: {
    cielo: ['#07070c', '#0c0c16', '#12121e', '#181828'], lejos: '#0e0e18', medio: '#161624',
    madera: '#3e3a4a', maderaOsc: '#201e2a', maderaClara: '#605a74', borde: '#aaaac8', vetas: '#2e2a38',
    musgo: '#8a8aa8', musgoClaro: '#d8dcf0', luz: '#b8c8ff', polvo: ['#e0e8ff', '#b8c8f0', '#ffffff'], tablon: '#c8d0e8',
  },
  hormiguero: {
    cielo: ['#0a0504', '#140806', '#1e0c08', '#28120a'], lejos: '#1a0a06', medio: '#2a120a',
    madera: '#6a2e1a', maderaOsc: '#38160c', maderaClara: '#984a30', borde: '#cc7044', vetas: '#4a1c10',
    musgo: '#c8702a', musgoClaro: '#ffb04a', luz: '#ffa040', polvo: ['#ffc080', '#ff9040', '#ffe0b0'], tablon: '#a8583a',
  },
};

/* ---------------- hornear ---------------- */
const SPR = {};
function prepararArte() {
  const s = (f, pal, o) => sprite(f, pal, Object.assign({ contorno: null }, o));
  const ch = (cab, cue, pat, o) => s(cuadroChispa(cab, cue, pat, o), PAL_CHISPA, { ox: 6, oy: 13 });
  SPR.chispa = {
    quieta: [ch('normal', 'normal', 'quieto'), ch('normal', 'brilla', 'quieto', { bob: 1 })],
    parpadea: ch('parpadea', 'normal', 'quieto'),
    corre: [ch('normal', 'normal', 'c0', { dx: 1 }), ch('normal', 'brilla', 'c1', { dx: 1, bob: 1 }), ch('normal', 'normal', 'c2', { dx: 1 }), ch('normal', 'brilla', 'c3', { dx: 1, bob: 1 })],
    sube: ch('atras', 'normal', 'sube', { alas: 'sube' }),
    cae: [ch('normal', 'normal', 'cae', { alas: 'cae' }), ch('normal', 'brilla', 'cae', { alas: 'sube' })],
    dash: ch('atras', 'brilla', 'sube', { alas: 'dash', dx: 1 }),
    pared: ch('normal', 'normal', 'pared'),
    golpe: ch('normal', 'golpe', 'quieto', { dx: 1 }),
    golpeArr: ch('arriba', 'golpe', 'quieto'),
    golpeAba: ch('normal', 'golpe', 'sube', { alas: 'sube' }),
    cura: [ch('cierra', 'cura', 'quieto'), ch('cierra', 'brilla', 'quieto', { bob: 1 })],
    duele: ch('duele', 'normal', 'cae'),
    sentada: ch('cierra', 'brilla', 'sentada', { bob: 1 }),
    apagada: ch('cierra', 'apagada', 'sentada', { bob: 1 }),
  };
  SPR.bichos = {};
  for (const [tipo, cuadros] of Object.entries(DIB_BICHO)) {
    SPR.bichos[tipo] = cuadros.map((f) => s(f, PAL_BICHO[tipo], { oy: f.length }));
  }
  const pt = TORITO_PATAS;
  SPR.torito = {
    a: s(TORITO_CUERPO.concat(pt.a), PAL_JEFE.torito, { oy: 22 }),
    b: s(TORITO_CUERPO.concat(pt.b), PAL_JEFE.torito, { oy: 22 }),
    salta: s(TORITO_CUERPO.concat(pt.c), PAL_JEFE.torito, { oy: 22 }),
    enojado: s(TORITO_CUERPO.map((f) => f.replace('e', 'E')).concat(pt.a), PAL_JEFE.torito, { oy: 22 }),
  };
  SPR.viuda = VIUDA_DIB.map((f) => s(f, PAL_JEFE.viuda, { oy: 0, ox: 13 }));
  SPR.reina = s(REINA_DIB, PAL_JEFE.reina, { oy: REINA_DIB.length });
  SPR.npc = {};
  for (const [q, cuadros] of Object.entries(DIB_NPC)) SPR.npc[q] = cuadros.map((f) => s(f, PAL_NPC[q], { oy: f.length }));
  SPR.cosa = {};
  for (const [q, [f, pal]] of Object.entries(DIB_COSA)) SPR.cosa[q] = s(f, pal, { oy: f.length });
  SPR.tajo = prepararTajos();
  SPR.retrato = prepararRetratos();
}

/* el tajo de la espina: una media luna que se abre en tres cuadros, dibujada
   píxel por píxel con la distancia al centro (así el borde sale limpio) */
function prepararTajos() {
  const hacer = (w, h, cx, cy, r0, r1, a0, a1, prog) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const t = (a - a0) / (a1 - a0);
      if (t < 0 || t > prog) continue;
      /* más grueso en el medio del arco, fino en las puntas */
      const grosor = (r1 - r0) * Math.sin(Math.PI * Math.min(1, t / Math.max(0.01, prog)));
      if (d < r1 - grosor || d > r1) continue;
      const borde = d > r1 - 1.2 || d < r1 - grosor + 1.2;
      g.fillStyle = borde ? 'rgba(255,236,190,0.85)' : '#ffffff';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  };
  const tres = (f) => [f(0.55), f(1), f(1)];
  return {
    lado: tres((p) => hacer(24, 20, 2, 10, 4, 13, -1.25, 1.25, p)),
    arr: tres((p) => hacer(20, 22, 10, 21, 4, 14, -Math.PI + 0.35, -0.35, p)),
    aba: tres((p) => hacer(20, 22, 10, 1, 4, 14, 0.35, Math.PI - 0.35, p)),
  };
}

/* retratos de 24x24 para los diálogos: la cabeza de cada uno, agrandada */
function prepararRetratos() {
  const r = {};
  const marco = (dibujar, fondo) => {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = fondo; g.fillRect(0, 0, 24, 24);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < (y / 24) * 8) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, 1, 1); }
    dibujar(g);
    g.fillStyle = '#0d0a14';
    g.fillRect(0, 0, 24, 1); g.fillRect(0, 23, 24, 1); g.fillRect(0, 0, 1, 24); g.fillRect(23, 0, 1, 24);
    return c;
  };
  const cabeza = hornear(CAB.normal, PAL_CHISPA);
  r.chispa = marco((g) => { g.drawImage(cabeza, 5, 3, 14, 16); g.fillStyle = PAL_CHISPA.g; g.fillRect(3, 19, 18, 2); }, '#241a34');
  const mamb = hornear(DIB_NPC.mamboreta[0].slice(0, 8), PAL_NPC.mamboreta);
  r.mamboreta = marco((g) => g.drawImage(mamb, 0, 2, 24, 16), '#16261a');
  const vaq = hornear(DIB_NPC.vaquita[0], PAL_NPC.vaquita);
  r.vaquita = marco((g) => g.drawImage(vaq, 1, 4, 22, 16), '#2a1418');
  const can = hornear(DIB_NPC.canasto[0].slice(0, 8), PAL_NPC.canasto);
  r.canasto = marco((g) => g.drawImage(can, 0, 2, 24, 16), '#221a12');
  const bol = hornear(DIB_NPC.bolita[0], PAL_NPC.bolita);
  r.bolita = marco((g) => g.drawImage(bol, 0, 5, 24, 14), '#1a1c24');
  return r;
}
