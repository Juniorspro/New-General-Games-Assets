/* ============================================================================
   luz-mala/js/letra.js — la letra de LUZ MALA: fina, angosta y con minúsculas.
   No es la de ZONDA (mayúsculas gruesas con borde negro): acá las letras no
   tienen borde, tienen un halo suave del color de la luz, como escritas con
   una luciérnaga. Nueve filas por glifo: 0-6 las mayúsculas, 2-6 el cuerpo de
   las minúsculas, 7-8 lo que baja (g, p, q, y).
   ========================================================================== */

const FINA = {
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#', '#..#'], B: ['###.', '#..#', '#..#', '###.', '#..#', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '#...', '###.', '#...', '#...', '####'], F: ['####', '#...', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###', '#...', '#...', '#.##', '#..#', '#..#', '.###'], H: ['#..#', '#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..##', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'], L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '#..#', '###.', '#...', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#..#', '#..#', '#.#.', '.#.#'], R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#', '#..#'],
  S: ['.###', '#...', '#...', '.##.', '...#', '...#', '###.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'], V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#..#', '#..#', '.##.', '.##.', '.##.', '#..#', '#..#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['####', '...#', '..#.', '.##.', '.#..', '#...', '####'],
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'], b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  c: ['...', '...', '.##', '#..', '#..', '#..', '.##'], d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'], f: ['..#', '.#.', '.#.', '###', '.#.', '.#.', '.#.'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'], h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  i: ['#', '.', '#', '#', '#', '#', '#'], j: ['.#', '..', '.#', '.#', '.#', '.#', '.#', '.#', '#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'], l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'], n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'], p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'], r: ['...', '...', '#.#', '##.', '#..', '#..', '#..'],
  s: ['...', '...', '.##', '#..', '.#.', '..#', '##.'], t: ['.#.', '.#.', '###', '.#.', '.#.', '.#.', '..#'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'], v: ['.....', '.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'], x: ['...', '...', '#.#', '#.#', '.#.', '#.#', '#.#'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'], z: ['...', '...', '###', '..#', '.#.', '#..', '###'],
  0: ['.##.', '#..#', '#.##', '##.#', '#..#', '#..#', '.##.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'], 3: ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  4: ['#..#', '#..#', '#..#', '####', '...#', '...#', '...#'], 5: ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
  6: ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'], 7: ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
  8: ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'], 9: ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'], '.': ['.', '.', '.', '.', '.', '.', '#'], ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '.', '#'], ';': ['..', '..', '.#', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'], '¡': ['.', '.', '#', '.', '#', '#', '#', '#', '#'],
  '?': ['.##.', '#..#', '...#', '..#.', '.#..', '....', '.#..'], '¿': ['....', '....', '.#..', '....', '.#..', '..#.', '...#', '#..#', '.##.'],
  "'": ['#', '#'], '"': ['#.#', '#.#'], '-': ['...', '...', '...', '...', '###'], '—': ['.....', '.....', '.....', '.....', '#####'],
  '(': ['..#', '.#.', '#..', '#..', '#..', '#..', '.#.', '..#'], ')': ['#..', '.#.', '..#', '..#', '..#', '..#', '.#.', '#..'],
  '/': ['...#', '...#', '..#.', '..#.', '.#..', '.#..', '#...', '#...'], '·': ['.', '.', '.', '.', '#'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'], '+': ['...', '...', '.#.', '.#.', '###', '.#.', '.#.'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '.#..#', '#...#'], '×': ['...', '...', '#.#', '.#.', '#.#'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'], '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
};
/* las marcas: [x, y] sobre el glifo base. Arriba de una mayúscula van en -2/-1;
   arriba de una minúscula, en 0/1 (el lugar de las ascendentes) */
const MARCAS_FINA = {
  agudo: [[2, 1], [3, 0]], grave: [[1, 0], [2, 1]], tilde: [[0, 1], [1, 0], [2, 1], [3, 0]], circ: [[0, 1], [1, 0], [2, 0], [3, 1]],
  dieresis: [[0, 0], [3, 0]], cedilla: [[1, 7], [2, 8]],
};
const LETRAS_CON_MARCA = {
  á: ['a', 'agudo'], é: ['e', 'agudo'], ó: ['o', 'agudo'], ú: ['u', 'agudo'], à: ['a', 'grave'],
  ñ: ['n', 'tilde'], ã: ['a', 'tilde'], õ: ['o', 'tilde'], â: ['a', 'circ'], ê: ['e', 'circ'], ô: ['o', 'circ'],
  ü: ['u', 'dieresis'], ç: ['c', 'cedilla'],
  Á: ['A', 'agudo'], É: ['E', 'agudo'], Í: ['I', 'agudo'], Ó: ['O', 'agudo'], Ú: ['U', 'agudo'], À: ['A', 'grave'],
  Ñ: ['N', 'tilde'], Ã: ['A', 'tilde'], Õ: ['O', 'tilde'], Â: ['A', 'circ'], Ê: ['E', 'circ'], Ô: ['O', 'circ'],
  Ü: ['U', 'dieresis'], Ç: ['C', 'cedilla'],
};
/* la í no tiene punto: la marca va en su lugar */
FINA['í'] = ['.#', '..', '#.', '#.', '#.', '#.', '#.'];

const cacheGlifoFino = new Map();
function glifoFino(ch) {
  let r = cacheGlifoFino.get(ch);
  if (r) return r;
  if (FINA[ch]) r = { f: FINA[ch], m: null };
  else if (LETRAS_CON_MARCA[ch]) {
    const [base, marca] = LETRAS_CON_MARCA[ch], may = base === base.toUpperCase();
    r = { f: FINA[base], m: MARCAS_FINA[marca].map(([x, y]) => [x, y < 7 && may ? y - 2 : y]) };
  } else if (FINA[ch.toUpperCase()]) r = { f: FINA[ch.toUpperCase()], m: null };
  else r = { f: FINA['?'], m: null, falta: true };
  r.w = Math.max(...r.f.map((f) => f.length));
  cacheGlifoFino.set(ch, r);
  return r;
}
function anchoFino(str, esp) {
  esp = esp == null ? 1 : esp;
  let x = 0;
  for (const ch of str) x += glifoFino(ch).w + esp;
  return Math.max(0, x - esp);
}

/* un renglón a un lienzo: halo del color de la luz, sombra abajo y la letra.
   o: { col, halo, sombra, esp (espacio entre letras) } */
const cacheFino = new Map();
function lienzoFino(str, o) {
  const k = str + '|' + (o.col || '') + '|' + (o.halo || '') + '|' + (o.esp == null ? 1 : o.esp) + '|' + (o.sombra === false ? 0 : 1);
  let c = cacheFino.get(k);
  if (c) return c;
  const esp = o.esp == null ? 1 : o.esp, pts = [];
  let x = 0;
  for (const ch of str) {
    const gl = glifoFino(ch);
    gl.f.forEach((fila, y) => { for (let i = 0; i < fila.length; i++) if (fila[i] === '#') pts.push([x + i, y]); });
    if (gl.m) for (const [mx, my] of gl.m) pts.push([x + mx, my]);
    x += gl.w + esp;
  }
  const w = Math.max(1, x - esp), arriba = 3;
  c = document.createElement('canvas');
  c.width = w + 4; c.height = arriba + 9 + 3;
  const g = c.getContext('2d'), ox = 2, oy = arriba;
  if (o.halo) {
    g.fillStyle = o.halo;
    g.globalAlpha = 0.28;
    for (const [px, py] of pts) g.fillRect(ox + px - 1, oy + py - 1, 3, 3);
    g.globalAlpha = 1;
  }
  if (o.sombra !== false) { g.fillStyle = 'rgba(5,3,8,0.85)'; for (const [px, py] of pts) g.fillRect(ox + px, oy + py + 1, 1, 1); }
  g.fillStyle = o.col || '#efe6d2';
  for (const [px, py] of pts) g.fillRect(ox + px, oy + py, 1, 1);
  c.ancho = w;
  if (cacheFino.size > 700) cacheFino.clear();
  cacheFino.set(k, c);
  return c;
}
/* y = la línea de arriba de las mayúsculas. o.alin: 'izq' | 'centro' | 'der';
   o.escala: entero; o.alfa; o.hasta: cuántos píxeles de ancho mostrar (para escribir de a poco) */
function textoFino(g, str, x, y, o) {
  o = o || {};
  const c = lienzoFino(str, o), e = o.escala || 1;
  let dx = x - 2 * e;
  if (o.alin === 'centro') dx = x - Math.floor(c.ancho * e / 2) - 2 * e;
  else if (o.alin === 'der') dx = x - c.ancho * e - 2 * e;
  if (o.alfa != null) g.globalAlpha = o.alfa;
  if (o.hasta != null) {
    const sw = Math.max(0, Math.min(c.width, o.hasta + 3));
    if (sw > 0) g.drawImage(c, 0, 0, sw, c.height, Math.round(dx), Math.round(y - 3 * e), sw * e, c.height * e);
  } else g.drawImage(c, Math.round(dx), Math.round(y - 3 * e), c.width * e, c.height * e);
  if (o.alfa != null) g.globalAlpha = 1;
}
/* partir en renglones que entren en "ancho" */
function envolverFino(str, ancho, esp) {
  const r = [];
  for (const par of String(str).split('\n')) {
    let linea = '';
    for (const pal of par.split(' ')) {
      const prueba = linea ? linea + ' ' + pal : pal;
      if (anchoFino(prueba, esp) > ancho && linea) { r.push(linea); linea = pal; } else linea = prueba;
    }
    r.push(linea);
  }
  return r;
}
/* cuánto mide el comienzo de un texto: para escribirlo letra por letra */
function anchoHasta(str, n, esp) { return anchoFino(Array.from(str).slice(0, n).join(''), esp); }
