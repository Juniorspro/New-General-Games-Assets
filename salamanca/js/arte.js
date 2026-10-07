/* ============================================================================
   El arte: todo el pixel art está escrito acá como texto (una letra por píxel)
   y se arma en lienzos al arrancar. Así el juego pesa casi nada y cada bicho
   se puede retocar a mano. Los simétricos se escriben por la mitad.
   ========================================================================== */

const K = '#160d1e';                     // el contorno de todo

function hacerLienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hacerSprite(filas, pal) {
  const h = filas.length, w = Math.max(...filas.map((f) => f.length));
  const c = hacerLienzo(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < filas[y].length; x++) {
    const ch = filas[y][x], col = ch === 'k' ? (pal.k || K) : pal[ch];
    if (ch !== '.' && col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}
const sim = (mitad) => mitad.map((f) => f + [...f].reverse().join(''));
function silueta(c, col) {
  const s = hacerLienzo(c.width, c.height), g = s.getContext('2d');
  g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col || '#fff'; g.fillRect(0, 0, c.width, c.height);
  return s;
}
function espejado(c) {
  const s = hacerLienzo(c.width, c.height), g = s.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return s;
}
/* un cuadro listo para dibujar: normal, blanco (el golpe), dado vuelta y sus blancos */
function cuadro(c) { return { c, b: silueta(c), f: espejado(c), fb: silueta(espejado(c)), w: c.width, h: c.height }; }

const SPR = {};
function def(nombre, cuadros, pal) { SPR[nombre] = cuadros.map((f) => cuadro(hacerSprite(f, pal))); }

/* ----------------------------------------------------------- la chica del farol */
const PAL_JUG = { H: '#5a4a70', h: '#3b2f4f', b: '#d8a23a', s: '#f3c393', S: '#d9966a', e: K, c: '#e88a8a', p: '#c8323c', P: '#87203a', y: '#f2c84b', l: '#e9e0cf', L: '#5a3426' };
const JUG_CUERPO = [
  '....kkkk....',
  '...kHhhhk...',
  '..kHhhhhhk..',
  '..kbbbbbbk..',
  'khhhhhhhhhhk',
  '.kkkkkkkkkk.',
  '.kssessessk.',
  '.kcssssssck.',
  '..kSssssSk..',
  '..kppkkppk..',
  '.kppyyyyppk.',
  'kpPpyppypPpk',
  'kPpPyPPyPpPk',
];
def('jug', [
  JUG_CUERPO.concat(['.kkllkkllkk.', '..kLk..kLk..']),
  JUG_CUERPO.concat(['.kkllkkkllk.', '..kLk...kLk.']),
  JUG_CUERPO.concat(['.kllkkkllkk.', '.kLk...kLk..']),
], PAL_JUG);
def('farol', [['.k.', 'kkk', 'kfk', 'kFk', 'kkk']], { f: '#fff6b0', F: '#ffc040' });

/* ----------------------------------------------------------------- bichos */
def('murcielago', [
  sim(['k.....', 'kk..k.', 'kWk.kk', 'kWwkbb', 'kwwkeb', '.kwwbb', '..kkbt', '....kk', '......']),
  sim(['......', '....k.', '....kk', '..kkbb', '.kWkeb', 'kWwwbb', 'kwwkbt', 'kwk.kk', 'kk....']),
], { w: '#5b3a7a', W: '#9a6cc8', b: '#3a2450', e: '#ff4a5a', t: '#f4f0e8' });

def('sapo', [
  sim(['......', '.kkk..', 'kyyyk.', 'kyekkk', 'kkGGGG', 'kGgggg', 'kgkkkk', 'kgmmmm', 'kdgmmm', '.kdkkk', 'kdk...', 'kk....']),
  sim(['.kkk..', 'kyyyk.', 'kyekkk', 'kkGGGG', 'kGgggg', 'kgkkkk', 'kgmmmm', 'kdgmmm', '.kdkkk', '.kdk..', '..kdk.', '..kk..']),
], { g: '#4f8a3a', G: '#86c25a', d: '#2e5a2a', y: '#f2d24b', e: K, m: '#d6c47a' });

def('anima', [
  sim(['...kkk', '..kwww', '.kwwww', '.kwkkk', '.kwkek', '.kwWkk', '..kWwk', '..kwkw', '...kkk', '...gg.', '....g.', '...g..']),
  sim(['...kkk', '..kwww', '.kwwww', '.kwkkk', '.kwkek', '.kwWkk', '..kWwk', '..kwkw', '...kkk', '....gg', '...g..', '....g.']),
], { w: '#ece4d0', W: '#b0a48c', e: '#7af0ff', g: '#5aa0c8' });

def('hongo', [
  sim(['...kkk', '.kkrrr', 'krrwrr', 'krrrrw', 'krwrrr', 'kRRRRR', 'kkkkkk', '..kecc', '..kccc', '..kcCC', '.kkkkk']),
  sim(['......', '...kkk', '.kkrrr', 'krrwrr', 'krwrrw', 'kRRRRR', 'kkkkkk', '..kecc', '..kcCC', '.kkkkk', '......']),
], { r: '#d8403a', R: '#8a2030', w: '#f4ecd8', c: '#efe0bc', C: '#c8b088', e: K });

def('vibora', [
  ['....kkkk....', '...kgGGgk...', '...kgekgk...', '....kggk.r..', '.....kgkr...', '..kkkkgk....', '.kgggggk....', 'kgGkkkkgk...', 'kgk...kggk..', '.kgkkkkgGgk.', '..kgggggggk.', '...kkkkkkk..'],
  ['...kkkk.....', '..kgGGgk....', '..kgekgk....', '...kggk.r...', '....kgk.r...', '..kkkgk.....', '.kgggggk....', 'kgGkkkkgk...', 'kgk...kggk..', 'kgkkkkkgGgk.', '.kggggggggk.', '..kkkkkkkk..'],
], { g: '#5aa040', G: '#9ad060', r: '#e84050', e: '#ffe040' });

def('lobito', [
  ['..k.k.........', '.kBkBk........', '.kbbbbk.......', 'kbebbbk....k..', 'kbbbbbbkkkkBk.', '.krkbbbBBBbbk.', '..kkbbbbbbbk..', '...kbkkkkbk...', '...kbk..kbk...', '...kk...kk....'],
  ['..k.k.........', '.kBkBk........', '.kbbbbk.....k.', 'kbebbbk....Bk.', 'kbbbbbbkkkkbk.', '.krkbbbBBBbbk.', '..kkbbbbbbbk..', '..kbkkkkkkbk..', '.kbk.....kbk..', '.kk.......kk..'],
], { b: '#2a2234', B: '#4a3c5a', e: '#ff3040', r: '#f0e0d0' });

def('kakuy', [
  sim(['.k....', '.kk.kk', '.kbkbb', 'kbyyyb', 'kbyeyb', 'kbyyyo', 'kwbbbo', 'kwwbFb', 'kwwbbF', '.kwbbb', '..kkok']),
  sim(['.k....', '.kk.kk', '.kbkbb', 'kbyyyb', 'kbyeyb', 'kbyyyo', 'wwbbbo', 'wkkbFb', 'k..bbF', '..kbbb', '..kkok']),
], { b: '#6a4a32', F: '#a07a50', y: '#f4d040', e: K, o: '#f09030', w: '#4a3020' });

def('diablillo', [
  sim(['k.....', 'kH....', '.kHkkk', '.krrrr', 'krrykr', 'krrrrr', 'krkwkw', '.krkkk', '..kRrr', '.kRrrr', '..kRk.', '..kk..']),
  sim(['......', 'k.....', 'kH....', '.kHkkk', '.krrrr', 'krrykr', 'krrrrr', 'krkwkw', '.krkkk', '.kRRrr', '.kRkkR', '..kk..']),
], { H: '#e8d8b0', r: '#d03a3a', R: '#8a1e2a', y: '#ffe040', w: '#f4f0e8' });

def('brasa', [
  sim(['....k.', '...kyk', '..kyok', '.kyoor', 'kyoorr', 'koekrr', 'korrrr', 'korkkk', '.krrrR', '..kkkk']),
  sim(['...k..', '..kyk.', '..kyyk', '.kyoor', 'kyoorr', 'koekrr', 'korrrr', 'korkkk', '.krrrR', '..kkkk']),
], { y: '#fff0a0', o: '#ffb040', r: '#f05a28', R: '#b02a20', e: K });
def('brasita', [
  sim(['..k.', '.kyk', 'kyor', 'koek', 'korr', '.kkk']),
  sim(['.k..', '.kyk', 'kyor', 'koek', 'korr', '.kkk']),
], { y: '#fff0a0', o: '#ffb040', r: '#f05a28', e: K });

/* el Pombero: el del trato */
def('pombero', [
  ['...kkkkkk...', '..kHHHHHHk..', '.kHhHHHHhHk.', 'kHHHHHHHHHHk', 'khhhhhhhhhhk', '.kkkkkkkkkk.', '.kpekppkepk.', '.kppppppppk.', '..kpPPPPpk..', '.kpppppppppk', 'kpPkpPPpkPpk', 'kpk.kppk.kpk', '.k.kpkkpk.k.', '...kk..kk...'],
  ['...kkkkkk...', '..kHHHHHHk..', '.kHhHHHHhHk.', 'kHHHHHHHHHHk', 'khhhhhhhhhhk', '.kkkkkkkkkk.', '.kppkppkppk.', '.kppppppppk.', '..kpPPPPpk..', '.kpppppppppk', 'kpPkpPPpkPpk', 'kpk.kppk.kpk', '.k.kpkkpk.k.', '...kk..kk...'],
], { H: '#e0b858', h: '#a8803a', p: '#6a4628', P: '#8a6038', e: '#ffe040' });

/* ------------------------------------------------------------------ jefes */
def('sapoRey', [
  sim(['........k.k.', '........koko', '...kkk..kooo', '..kYYYk.kodo', '.kYYeYYkkkkk', '.kYeeeYGGGGG', '.kYYeYYGGGGG', '..kYYYkGgggg', '.kGkkkGGgggg', 'kGGGGGGGgggg', 'kGggggggkkkk', 'kggkkkkkkmmm', 'kggkmmmmmmmm', 'kgdkmmmmmmmm', 'kgddkmmmmmmm', 'kgdddkkmmmmm', '.kdddddkkkkk', 'kdkkdddddddk', 'kdk.kkkkkkkk', 'kk..........']),
  sim(['........k.k.', '........koko', '...kkk..kooo', '..kYYYk.kodo', '.kYYeYYkkkkk', '.kYeeeYGGGGG', '.kYYeYYGGGGG', '..kYYYkGgggg', '.kGkkkGGgggg', 'kGGGGGGGgggg', 'kGggggggkkkk', 'kggkkkkkkkkk', 'kggkrrrrrrrr', 'kgdkrrrrrrrr', 'kgddkrrrrrrr', 'kgdddkkrrrrr', '.kdddddkkkkk', 'kdkkdddddddk', 'kdk.kkkkkkkk', 'kk..........']),
], { g: '#4f8a3a', G: '#86c25a', d: '#2e5a2a', Y: '#f2d24b', e: K, m: '#d6c47a', o: '#ffcf4a', d2: '#c83a3a', r: '#8a1e32' });

def('viuda', [
  sim(['......kkkk', '.....kvvvv', '....kvvvvv', '...kvvvvvv', '...kvvkkkk', '..kvvkpppp', '..kvkppkep', '..kvkppppp', '..kvvkpPPp', '.kvvvkkppp', '.kvvkwwwww', '.kvkwwwwww', 'kvvkwWwwww', 'kvkwwWwwww', 'kvkwwwWwww', 'kkwwwwwWww', '.kwwwwwwWw', '.kwWwwwwww', '..kwWwwwww', '..kwwWwwww', '...kwwwWww', '...kgwwwgw', '....kgwgwg', '....g.g.g.', '.....g...g']),
  sim(['......kkkk', '.....kvvvv', '....kvvvvv', '...kvvvvvv', '...kvvkkkk', '..kvvkpppp', '..kvkppkep', '..kvkppppp', '..kvvkpPPp', '.kvvvkkppp', '.kvvkwwwww', '.kvkwwwwww', 'kvvkwWwwww', 'kvkwwWwwww', 'kvkwwwWwww', 'kkwwwwwWww', '.kwwwwwwWw', '.kwWwwwwww', '..kwWwwwww', '..kwwWwwww', '...kwwwWww', '...kwgwwwg', '....gwgwgk', '...g.g.g..', '....g...g.']),
], { v: '#2a2036', p: '#d8e0e8', P: '#7a8494', e: '#80f0ff', w: '#e8eef4', W: '#a8b8c8', g: '#7aa0c0' });

def('lobizon', [
  sim(['...k........', '..kfk.......', '..kffk......', '..kfFfk..kkk', '..kfFffkkfff', '...kffffffff', '...kfFFffFff', '..kffkkfffff', '..kfffkeekff', '..kffffkkFFF', '...kfffFFFFk', '...kkfFkmmmm', '..kffkFktmtm', '.kfffkkmmmmm', 'kfFffffkkkkk', 'kfFfffffFFFF', 'kffkfffFFFFF', 'kfk.kffFFFFF', 'kck.kfffFFFF', '.k..kffffkkk', '...kffffk...', '...kfffk....', '..kcfck.....', '..kkkk......']),
  sim(['...k........', '..kfk.......', '..kffk......', '..kfFfk..kkk', '..kfFffkkfff', '...kffffffff', '...kfFFffFff', '..kffkkfffff', '..kfffkeekff', '..kffffkkFFF', '...kfffFFFFk', '...kkfFkkkkk', '..kffkFkmmmm', '.kfffkkkmtmt', 'kfFffffkkkkk', 'kfFfffffFFFF', 'kffkfffFFFFF', 'kfk.kffFFFFF', 'kck.kfffFFFF', '.k..kffffkkk', '..kffffk....', '..kfffk.....', '.kcfck......', '.kkkk.......']),
], { f: '#5a4a5a', F: '#8a7a8a', e: '#ffd030', t: '#f4f0e8', m: '#7a1a2a', c: '#e8e0d0' });

def('mandinga', [
  sim(['..........kkkk', '.........kHhhh', '........kHhhhh', '..k.....khhhhh', '.kck....kbbbbb', '.kcck..kbbbbbb', '..kcckkhhhhhhh', '...kkhhhhhhhhh', '..khhhhhhhhhhh', '...kkkkkkkkkkk', '.....krrrrrrrr', '.....krRkkrrrr', '.....krkeekrrr', '.....krrrrrrRr', '.....kRrrrrkkk', '......kRrkttkt', '......kkRrrkkk', '....kkNkkRrrrr', '...kNNNnkkRkkk', '..kNNnnnnkkokn', '.kNNnnnnnnnkon', '.kNnnnnnnnnkkn', 'kNNnnnnnnnnnkn', 'kNnnnnnnnnnnon', 'kNnnnnnnnnnnkn', 'kNnnnnnnnnnnnn', 'kNnnnnnnnnnnnn', '.kkNnnnnnnnnnn', '...kkkknnnnnnk', '......kkkkkkkk']),
  sim(['..........kkkk', '.........kHhhh', '........kHhhhh', '..k.....khhhhh', '.kck....kbbbbb', '.kcck..kbbbbbb', '..kcckkhhhhhhh', '...kkhhhhhhhhh', '..khhhhhhhhhhh', '...kkkkkkkkkkk', '.....krrrrrrrr', '.....krRkkrrrr', '.....krkeekrrr', '.....krrrrrrRr', '.....kRrrrrkkk', '......kRrkkkkk', '......kkRtktkt', '....kkNkkRrrrr', '...kNNNnkkRkkk', '..kNNnnnnkkokn', '.kNNnnnnnnnkon', 'kNNnnnnnnnnkkn', 'kNnnnnnnnnnnkn', 'kNnnnnnnnnnnon', 'kNnnnnnnnnnnkn', 'kNnnnnnnnnnnnn', 'kNnnnnnnnnnnnn', '.kkNnnnnnnnnnn', '...kkkknnnnnnk', '......kkkkkkkk']),
], { h: '#1a1424', H: '#3a2e48', b: '#c8323c', c: '#e8d8b0', r: '#c0303a', R: '#801a2a', e: '#ffe040', t: '#f4f0e8', n: '#1e1428', N: '#901c2c', o: '#ffcf4a' });

/* --------------------------------------------------------------- cositas */
def('alma', [
  ['...k...', '..kak..', '..kaak.', '.kabak.', '.kabbak', 'kabwbak', 'kabwwbk', '.kbbbk.', '..kkk..'],
  ['..k....', '..kak..', '.kaak..', '.kabak.', 'kabbak.', 'kabwbak', 'kabwwbk', '.kbbbk.', '..kkk..'],
], { a: '#3a7ae8', b: '#7ad0ff', w: '#f0fcff' });
def('xp', [['..k..', '.kak.', 'kabak', '.kak.', '..k..'], ['..k..', '.kbk.', 'kbabk', '.kbk.', '..k..']], { a: '#c890ff', b: '#7a4ae0' });
def('corazon', [['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']], { r: '#e8404a', w: '#ffc0c0' });

/* los íconos de las cartas (9 × 9): a = color del palo, b = claro, c = blanco */
const ICONOS = {
  frontal: ['..k...k..', '.kak.kak.', 'kaaakaaak', '.kak.kak.', '.kak.kak.', '.kak.kak.', '.kak.kak.', '.kbk.kbk.', '.kkk.kkk.'],
  seguido: ['....k....', '...kak...', '..kaaak..', '...kak...', '...kbk...', '....k....', '...kak...', '...kbk...', '....k....'],
  diagonal: ['k...k...k', 'ak..k..ka', '.a..a..a.', '..a.a.a..', '...aaa...', '....b....', '....b....', '...kbk...', '...kkk...'],
  lateral: ['....b....', '..k.b.k..', '.ak.b.ka.', 'aaaaaaaaa', '.ak.b.ka.', '..k.b.k..', '....b....', '...kbk...', '...kkk...'],
  trasero: ['...kbk...', '...kbk...', '...kbk...', '...kak...', '...kak...', 'kkkkakkkk', '.kaaaaak.', '..kaaak..', '...kak...'],
  rebote: ['bbbbbbbbb', '...a.a...', '..a...a..', '.a.....a.', 'a.......a', '.........', '.........', '.........', '.........'],
  atraviesa: ['....a....', '...aaa...', '..kkakk..', '.k..a..k.', '.k..a..k.', '.k..a..k.', '..kkakk..', '....a....', '....a....'],
  salto: ['.........', '...aaa...', '..a...a..', '.a.....a.', '.a.....a.', 'kkk...kkk', 'kbk...kbk', 'kkk...kkk', '.........'],
  danio: ['........a', '.......ab', '......ab.', '.....ab..', 'k...ab...', '.k.ab....', '..kk.....', '.kbk.....', 'kb.......'],
  cadencia: ['a...a....', '.a...a...', '..a...a..', '...a...a.', '..a...a..', '.a...a...', 'a...a....', '.........', '.........'],
  critico: ['.........', '..kkkkk..', '.k.....k.', 'k..aaa..k', 'k..aka..k', 'k..aaa..k', '.k.....k.', '..kkkkk..', '.........'],
  fuego: ['....a....', '...aa....', '...aba...', '..abba.a.', '.abbbbaa.', '.abbbbba.', '.abbcbba.', '..abccba.', '...aaaa..'],
  hielo: ['....a....', '.a..a..a.', '..a.a.a..', '...aaa...', 'aaaacaaaa', '...aaa...', '..a.a.a..', '.a..a..a.', '....a....'],
  rayo: ['.....aa..', '....aa...', '...aa....', '..aaaaa..', '....aa...', '...aa....', '..aa.....', '.aa......', 'aa.......'],
  veneno: ['....a....', '....a....', '...aaa...', '..aaaaa..', '.aakaaka.', '.aaaaaaa.', '.aakkkaa.', '..aaaaa..', '...aaa...'],
  vida: ['.........', '.aa...aa.', 'abba.aaaa', 'abaaaaaaa', 'aaaaaaaaa', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....'],
  robo: ['aaaaaaaaa', 'abbbbbbba', '.abbbbba.', '..abbba..', '...aaa...', '....a....', '....a....', '...aaa...', '..aaaaa..'],
  curar: ['......k..', '.....k...', '..aaka...', '.aaakaa..', 'aaaaaaaa.', 'abaaaaaa.', 'abaaaaaa.', '.aaaaaa..', '..aaaa...'],
  escudo: ['...a.....', '.......a.', '..kkkkk..', '.k.....k.', 'ak..b..k.', '.k.....ka', '..kkkkk..', '.a.......', '.....a...'],
  compa: ['...aaa...', '..aaaaa..', '.aakakaa.', '.aaaaaaa.', '.aaaaaaa.', '.aaaaaaa.', '.aaaaaaa.', '.a.a.a.a.', '.........'],
  velocidad: ['.........', 'b...aaa..', '...aaaaa.', 'bb.aaaaa.', '...aaaaaa', 'b.aaaaaaa', 'aaaaaaaaa', 'kkkkkkkkk', '.........'],
  iman: ['.ccc.ccc.', '.aaa.aaa.', '.aa...aa.', '.aa...aa.', '.aa...aa.', '.aaa.aaa.', '..aaaaa..', '...aaa...', '.........'],
  explosion: ['a...a...a', '.a..a..a.', '..abbba..', '..bbcbb..', 'aabcccbaa', '..bbcbb..', '..abbba..', '.a..a..a.', 'a...a...a'],
  esquive: ['.....aa..', '.....aa..', '...aaa...', '..a.aa.a.', 'b...aa...', 'bb.a..a..', 'b.a....a.', '..a.....a', '.........'],
  copla: ['.......kk', '......kb.', '.....kb..', '..aa.b...', '..aaab...', '.aakaa...', '.aaaaa...', 'aaaaaa...', '.aaaa....'],
  // los del altar
  fuerza: ['....a....', '...aaa...', '...aba...', '...aba...', '...aba...', '.kkkkkkk.', '...kbk...', '...kbk...', '...kkk...'],
  mano: ['.a.a.a...', '.a.a.a.a.', '.a.a.a.a.', '.aaaaaaa.', 'aaaaaaaa.', 'aaaaaaaa.', '.aaaaaa..', '..aaaa...', '.........'],
  suerte: ['...aaa...', '..a...a..', '.a.a.a.a.', '.a.....a.', '.a.aaa.a.', '..a...a..', '...aaa...', '.........', '.........'],
  yapa: ['.kkkkkkk.', '.kaaaaak.', '.kabbbak.', '.kaaaaak.', '.kabbbak.', '.kaaaaak.', '.kabbbak.', '.kaaaaak.', '.kkkkkkk.'],
  revivir: ['....a....', '...aaa...', '..a.a.a..', '....a....', '..aaaaa..', '.a.....a.', '.a.....a.', '..aaaaa..', '.........'],
};
const PALOS = {
  oros: { col: '#ffcf4a', claro: '#fff2b0', fondo: '#3a2a10', f: ['..kkk..', '.koook.', 'kooaook', 'koaaaok', 'kooaook', '.koook.', '..kkk..'], pal: { o: '#ffcf4a', a: '#c88a20' } },
  copas: { col: '#ff5a64', claro: '#ffc0c4', fondo: '#3a1018', f: ['kkkkkkk', 'krrrrrk', '.krrrk.', '..krk..', '...k...', '..kkk..', '.kkkkk.'], pal: { r: '#e8404a' } },
  espadas: { col: '#7ac8ff', claro: '#d0f0ff', fondo: '#10203a', f: ['...k...', '..kbk..', '..kbk..', '..kbk..', '.kkkkk.', '...k...', '...k...'], pal: { b: '#b8e0ff' } },
  bastos: { col: '#7ad860', claro: '#d0ffc0', fondo: '#14301a', f: ['..kkk..', '.kgggk.', '.kgGgk.', '..kgk..', '..kgk..', '..kgk..', '..kkk..'], pal: { g: '#6a4a2a', G: '#a07a40' } },
};
const ICONO_CANVAS = {};
function icono(id, palo) {
  const clave = id + '|' + palo;
  if (!ICONO_CANVAS[clave]) {
    const p = PALOS[palo] || PALOS.oros;
    ICONO_CANVAS[clave] = hacerSprite(ICONOS[id] || ICONOS.yapa, { a: p.col, b: p.claro, c: '#ffffff' });
  }
  return ICONO_CANVAS[clave];
}
const PALO_CANVAS = {};
for (const k in PALOS) PALO_CANVAS[k] = hacerSprite(PALOS[k].f, PALOS[k].pal);

/* ---------------------------------------------------------- dibujar sprites */
/* x, y = los pies (abajo al medio). o: { voltear, blanco, alfa, escX, escY, frame } */
function dibujarSpr(g, nombre, frame, x, y, o) {
  const fr = SPR[nombre][frame % SPR[nombre].length];
  o = o || {};
  const img = o.voltear ? (o.blanco ? fr.fb : fr.f) : (o.blanco ? fr.b : fr.c);
  const ex = o.escX || 1, ey = o.escY || 1;
  if (o.alfa != null) g.globalAlpha = o.alfa;
  if (ex === 1 && ey === 1) g.drawImage(img, Math.round(x - fr.w / 2), Math.round(y - fr.h));
  else {
    const w = Math.round(fr.w * ex), h = Math.round(fr.h * ey);
    g.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
  }
  if (o.alfa != null) g.globalAlpha = 1;
}
/* la sombra: una elipse de píxeles */
const SOMBRAS = {};
function sombra(g, x, y, ancho) {
  ancho = Math.max(4, Math.round(ancho));
  let c = SOMBRAS[ancho];
  if (!c) {
    const h = Math.max(2, Math.round(ancho / 3));
    c = hacerLienzo(ancho, h);
    const s = c.getContext('2d');
    s.fillStyle = 'rgba(8,4,14,0.55)';
    for (let yy = 0; yy < h; yy++) {
      const t = (yy + 0.5) / h * 2 - 1, m = Math.round(ancho / 2 * Math.sqrt(1 - t * t));
      s.fillRect(Math.round(ancho / 2 - m), yy, m * 2, 1);
    }
    SOMBRAS[ancho] = c;
  }
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
}
/* círculo de píxeles relleno (balas, chispas) */
function circulo(g, x, y, r, col) {
  g.fillStyle = col;
  x = Math.round(x); y = Math.round(y);
  if (r <= 1) { g.fillRect(x, y, 1, 1); return; }
  for (let dy = -r; dy <= r; dy++) {
    const m = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    g.fillRect(x - m, y + dy, m * 2 + 1, 1);
  }
}
/* las luces: anillos escalonados, se ven en píxeles y no en degradé liso */
const LUCES = {};
function sello(r) {
  r = Math.max(4, Math.round(r / 2) * 2);
  if (LUCES[r]) return LUCES[r];
  const c = hacerLienzo(r * 2, r * 2), g = c.getContext('2d');
  const pasos = 5;
  for (let i = 0; i < pasos; i++) {
    const rr = r * (1 - i / pasos);
    g.fillStyle = 'rgba(255,255,255,' + (0.22 + i * 0.16) + ')';
    g.beginPath(); g.arc(r, r, rr, 0, Math.PI * 2); g.fill();
  }
  return (LUCES[r] = c);
}
const BRILLOS = {};
function brillo(r, col) {
  const k = r + col;
  if (BRILLOS[k]) return BRILLOS[k];
  const c = hacerLienzo(r * 2, r * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return (BRILLOS[k] = c);
}

/* dígitos chicos (3 × 5) para los números de daño */
const DIG = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'], '!': ['#', '#', '#', '.', '#'], '+': ['...', '.#.', '###', '.#.', '...'],
};
const CACHE_NUM = new Map();
function numeroChico(g, txt, x, y, col) {
  const k = txt + col;
  let c = CACHE_NUM.get(k);
  if (!c) {
    let w = 0;
    for (const ch of txt) w += (DIG[ch] ? DIG[ch][0].length : 3) + 1;
    c = hacerLienzo(w + 2, 7);
    const s = c.getContext('2d');
    let cx = 1;
    for (const ch of txt) {
      const d = DIG[ch]; if (!d) { cx += 4; continue; }
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < d[0].length; xx++) if (d[yy][xx] === '#') {
        s.fillStyle = K; s.fillRect(cx + xx - 1, yy, 3, 3); s.fillRect(cx + xx, yy + 1 - 1, 1, 3);
      }
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < d[0].length; xx++) if (d[yy][xx] === '#') { s.fillStyle = col; s.fillRect(cx + xx, yy + 1, 1, 1); }
      cx += d[0].length + 1;
    }
    if (CACHE_NUM.size > 300) CACHE_NUM.clear();
    CACHE_NUM.set(k, c);
  }
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - 3));
}

/* -------------------------------------------------------------- los pisos */
const BIOMAS = [
  { suelo: ['#3b2b26', '#35261f', '#41302a'], mota: '#57423a', grieta: '#241914', pared: '#6a5040', paredOsc: '#4a3428', tope: '#22160f', roca: ['#8a7464', '#5f4d40', '#3e3028'], pozo: 'tierra', oscuro: 0.55, bala: '#ff9a5a', balaO: '#7a2a10', antorcha: '#ffb040', deco: ['raiz', 'hueso', 'piedra'] },
  { suelo: ['#1e2a32', '#1a242c', '#23313a'], mota: '#30424f', grieta: '#10181e', pared: '#3e5868', paredOsc: '#2a3e4c', tope: '#0e161c', roca: ['#6a94a4', '#43606e', '#283c48'], pozo: 'agua', oscuro: 0.6, bala: '#7af0ff', balaO: '#105070', antorcha: '#6ae0ff', deco: ['hongo', 'charco', 'piedra'] },
  { suelo: ['#2e1a18', '#281614', '#361e1a'], mota: '#46261e', grieta: '#5a1e10', pared: '#5e2c24', paredOsc: '#42201a', tope: '#1a0c0a', roca: ['#5a4646', '#3a2c2c', '#1e1616'], pozo: 'lava', oscuro: 0.5, bala: '#ffe060', balaO: '#a03010', antorcha: '#ff7030', deco: ['ascua', 'hueso', 'piedra'] },
  { suelo: ['#2a1a3a', '#22142e', '#301e42'], tablero: true, mota: '#3e2a54', grieta: '#160c20', pared: '#4c2c5c', paredOsc: '#361e44', tope: '#140a1c', roca: ['#9a7aaa', '#6a4e7e', '#3e2a50'], pozo: 'vacio', oscuro: 0.56, bala: '#ff6ab8', balaO: '#701040', antorcha: '#ff5ac8', deco: ['vela', 'calavera', 'moneda'] },
];
