/* ============================================================================
   motor2d/fuente.js — la fuente de píxeles 5x7 de EL TIPO, con tildes, Ñ, Ü,
   ¡¿ y las letras del portugués, más los signos que piden los diálogos. Las minúsculas se dibujan como
   mayúsculas: en un juego alcanza y se lee mejor a este tamaño.
   ========================================================================== */

const FUENTE_PX = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."], D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"], F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"], H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."], J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"], L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"], N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"], R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."], T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."], X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."], 1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"], 3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."], 5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."], 7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."], 9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  ' ': ["...", "...", "...", "...", "...", "...", "..."], '!': ["#", "#", "#", "#", "#", ".", "#"], '¡': ["#", ".", "#", "#", "#", "#", "#"],
  '?': [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."], '¿': ["..#..", ".....", "..#..", ".#...", "#....", "#...#", ".###."],
  '.': [".", ".", ".", ".", ".", ".", "#"], ',': ["..", "..", "..", "..", "..", ".#", "#."], ':': [".", "#", ".", ".", ".", "#", "."],
  ';': ["..", ".#", "..", "..", "..", ".#", "#."], '-': ["....", "....", "....", "####", "....", "....", "...."],
  "'": ["#", "#", ".", ".", ".", ".", "."], '"': ["#.#", "#.#", "...", "...", "...", "...", "..."],
  '/': ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."], '+': [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  '×': [".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "....."], '·': [".", ".", ".", "#", ".", ".", "."],
  '%': ["##..#", "##.#.", "...#.", "..#..", ".#...", ".#.##", "#..##"], '>': ["#....", ".#...", "..#..", "...#.", "..#..", ".#...", "#...."],
  '<': ["....#", "...#.", "..#..", ".#...", "..#..", "...#.", "....#"], '=': ["....", "....", "####", "....", "####", "....", "...."],
  '(': ["..#", ".#.", "#..", "#..", "#..", ".#.", "..#"], ')': ["#..", ".#.", "..#", "..#", "..#", ".#.", "#.."],
  '…': [".....", ".....", ".....", ".....", ".....", ".....", "#.#.#"], '*': [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  '—': [".....", ".....", ".....", "#####", ".....", ".....", "....."], '_': ["....", "....", "....", "....", "....", "....", "####"],
};
/* las letras con marca: la base más la marca. Con las del portugués (Â Ã À Ç Ê Ô Õ)
   alcanza para los tres idiomas de los juegos */
const ACENTOS_PX = {
  'Á': ['A', 'a'], 'É': ['E', 'a'], 'Í': ['I', 'a'], 'Ó': ['O', 'a'], 'Ú': ['U', 'a'], 'Ñ': ['N', 't'], 'Ü': ['U', 'd'],
  'Â': ['A', 'c'], 'Ã': ['A', 't'], 'À': ['A', 'g'], 'Ê': ['E', 'c'], 'Ô': ['O', 'c'], 'Õ': ['O', 't'], 'Ç': ['C', 'z'],
  'Ö': ['O', 'd'], 'Ş': ['S', 'z'], 'Ğ': ['G', 'b'], 'İ': ['I', 'p'],          // las del turco
};
const MARCAS_PX = {
  a: [[3, -3], [2, -2]], t: [[0, -2], [1, -3], [2, -3], [3, -2], [4, -3]], d: [[1, -2], [3, -2]],
  c: [[1, -2], [2, -3], [3, -2]], g: [[1, -3], [2, -2]], z: [[2, 7], [3, 8], [2, 8]],
  b: [[1, -3], [3, -3], [2, -2]], p: [[2, -2]],
};

function glifoPx(ch) {
  const c = ch.toUpperCase();
  if (FUENTE_PX[c]) return { f: FUENTE_PX[c], m: null };
  const a = ACENTOS_PX[c];
  if (a) return { f: FUENTE_PX[a[0]], m: MARCAS_PX[a[1]] };
  return { f: FUENTE_PX['?'], m: null };
}
/* puntos encendidos de un texto: [x, y, fila], con y = 0 en la línea de las mayúsculas */
function puntosTexto(str) {
  const pts = [];
  let x = 0;
  for (const ch of str) {
    const g = glifoPx(ch), w = g.f[0].length;
    for (let r = 0; r < 7; r++) for (let k = 0; k < w; k++) if (g.f[r][k] === '#') pts.push([x + k, r, r]);
    if (g.m) for (const [mx, my] of g.m) pts.push([x + mx, my, my > 6 ? 6 : 0]);
    x += w + 1;
  }
  return { pts, w: Math.max(1, x - 1) };
}
/* lo que la fuente de píxeles no tiene (árabe, japonés, tailandés, birmano…) se
   escribe con la letra del sistema, a la resolución real (ESCALA_TEXTO = píxeles
   reales por píxel de juego, la pone el juego) y con el mismo contorno, sombra y
   degradé, así se lee nítido sin cambiar el lugar que ocupa */
let ESCALA_TEXTO = 1;
const cubrePx = (ch) => { const c = ch.toUpperCase(); return !!(FUENTE_PX[c] || ACENTOS_PX[c]) || /\s/.test(ch); };
function esPx(str) { for (const ch of String(str)) if (!cubrePx(ch)) return false; return true; }
const medidorTxt = document.createElement('canvas').getContext('2d');
function fuenteSis(str) {
  const esc = typeof escrituraDe === 'function' ? escrituraDe(str) : 'latn';
  const fam = (typeof fuenteEscritura === 'function' && fuenteEscritura(esc, 'sans')) || '"Trebuchet MS",Arial,sans-serif';
  return { esc, tam: 9 * (typeof escalaEscritura === 'function' ? escalaEscritura(esc) : 1), fam };
}
function anchoSis(str) {
  const f = fuenteSis(str);
  medidorTxt.font = '700 ' + f.tam + 'px ' + f.fam; medidorTxt.direction = f.esc === 'arab' ? 'rtl' : 'ltr';
  return Math.ceil(medidorTxt.measureText(str).width);
}
function lienzoSis(str, o, e) {
  const K = Math.max(1, ESCALA_TEXTO * (e || 1)), f = fuenteSis(str), w = anchoSis(str), LW = w + 4, LH = 16, cy = 8;
  const c = document.createElement('canvas');
  c.width = Math.ceil(LW * K); c.height = Math.ceil(LH * K);
  const g = c.getContext('2d');
  g.scale(K, K); g.font = '700 ' + f.tam + 'px ' + f.fam; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.direction = f.esc === 'arab' ? 'rtl' : 'ltr'; g.lineJoin = 'round';
  if (!o.sinSombra) { g.fillStyle = g.strokeStyle = 'rgba(10,6,16,0.75)'; g.lineWidth = 2; g.strokeText(str, 2, cy + 1); g.fillText(str, 2, cy + 1); }
  if (o.borde !== 'no') { g.strokeStyle = o.borde || '#141018'; g.lineWidth = 2; g.strokeText(str, 2, cy); }
  if (o.grad) { const gr = g.createLinearGradient(0, cy - 4.5, 0, cy + 4.5); o.grad.forEach((col, i) => gr.addColorStop(i / 6, col)); g.fillStyle = gr; }
  else g.fillStyle = o.col || '#fff';
  g.fillText(str, 2, cy);
  c.sis = true; c.lw = LW; c.lh = LH; c.cy = cy;
  return c;
}
/* el paso entre renglones: la letra del sistema pide un poco más que la de píxeles */
const pasoRenglon = (str, base) => (esPx(str) ? base : Math.max(base, 12));
function anchoTexto(str) {
  if (!esPx(str)) return anchoSis(str);
  let x = 0;
  for (const ch of str) x += glifoPx(ch).f[0].length + 1;
  return Math.max(0, x - 1);
}

const GRAD = {
  blanco: ['#ffffff', '#ffffff', '#f1f3fa', '#e2e6f2', '#cfd4e6', '#b8bed6', '#a3a9c4'],
  oro: ['#fff6b0', '#ffe066', '#ffd24a', '#ffb43a', '#f5a02a', '#e0862a', '#c46a22'],
  rojo: ['#ffc2b8', '#ff8a7a', '#ff6a5a', '#ff5a50', '#e8404a', '#c42a3c', '#9a1f34'],
  verde: ['#d6ffd8', '#9cffae', '#7ef09a', '#63d98a', '#4cc076', '#3aa062', '#2c8050'],
  azul: ['#d0f0ff', '#9fe0ff', '#7ad2ff', '#5ac8ff', '#3aa8e8', '#2a88c8', '#1e6aa8'],
  gris: ['#e8ebf5', '#cdd3e8', '#b8bed6', '#a3a9c4', '#8d96b5', '#78809e', '#636b88'],
  fuego: ['#fff6b0', '#ffe066', '#ffb43a', '#ff7a2a', '#f04a2a', '#c42a3c', '#7a1f4a'],
  ocre: ['#fff0d0', '#ffd9a0', '#f3b877', '#e39b55', '#cc7c3c', '#a85f2e', '#7d4424'],
  celeste: ['#f0fbff', '#d4f3ff', '#b5e8fb', '#93d6f2', '#76c0e6', '#5aa4d4', '#4486bb'],
  ambar: ['#fff4c2', '#ffe08a', '#ffc85a', '#f6a93a', '#e08a24', '#bf6c1c', '#8f4f18'],
  violeta: ['#f3e6ff', '#dcc2ff', '#c29dff', '#a87cf5', '#8e5fe0', '#7446c4', '#5a33a0'],
};

/* texto a un lienzo de 1 px por píxel de fuente: sombra, contorno y degradé
   por fila. Arriba deja 3 filas de aire para las tildes */
const cacheTxt = new Map();
function lienzoTexto(str, o, e) {
  o = o || {};
  const sis = !esPx(str);
  const clave = str + '|' + (o.grad ? o.grad[0] + o.grad[6] : o.col) + '|' + (o.borde || '') + '|' + (o.sinSombra ? 1 : 0) + (sis ? '|' + ESCALA_TEXTO * (e || 1) : '');
  let c = cacheTxt.get(clave);
  if (c) return c;
  if (sis) { c = lienzoSis(str, o, e); c.txt = str; if (cacheTxt.size > 500) cacheTxt.clear(); cacheTxt.set(clave, c); return c; }
  const { pts, w } = puntosTexto(str);
  const arriba = 3;
  c = document.createElement('canvas');
  c.width = w + 3; c.height = arriba + 7 + 3;
  const g = c.getContext('2d'), ox = 1, oy = arriba + 1, borde = o.borde || '#141018';
  if (!o.sinSombra) {
    g.fillStyle = 'rgba(10,6,16,0.75)';
    for (const [x, y] of pts) g.fillRect(ox + x - 1, oy + y, 3, 3);
  }
  if (o.borde !== 'no') {
    g.fillStyle = borde;
    for (const [x, y] of pts) g.fillRect(ox + x - 1, oy + y - 1, 3, 3);
  }
  for (const [x, y, r] of pts) { g.fillStyle = o.grad ? o.grad[r] : (o.col || '#fff'); g.fillRect(ox + x, oy + y, 1, 1); }
  c.txt = str;                                  // para las pruebas: qué texto es este lienzo
  if (cacheTxt.size > 500) cacheTxt.clear();
  cacheTxt.set(clave, c);
  return c;
}

/* dibuja texto en el lienzo del mundo. y = la línea de arriba de las mayúsculas.
   o.alin: 'izq' | 'centro' | 'der'; o.escala: entero, para títulos */
function textoPx(g, str, x, y, o) {
  o = o || {};
  const e = o.escala || 1, c = lienzoTexto(str, o, e);
  if (c.sis) {
    // el centro del texto va con el centro de las mayúsculas de píxeles (de y a y + 7·e)
    const w = (c.lw - 4) * e;
    const dx = o.alin === 'centro' ? x - w / 2 : o.alin === 'der' ? x - w : x;
    g.drawImage(c, dx - 2 * e, y + 3.5 * e - c.cy * e, c.lw * e, c.lh * e);
    return;
  }
  let dx = x - e;
  if (o.alin === 'centro') dx = x - Math.floor((c.width - 3) * e / 2) - e;
  else if (o.alin === 'der') dx = x - (c.width - 3) * e - e;
  g.drawImage(c, Math.round(dx), Math.round(y - 4 * e), c.width * e, c.height * e);
}
/* letra por letra: para escribir de a poco y para las palabras que tiemblan */
function textoLetras(g, str, x, y, o, cuantas, desplazar) {
  o = o || {};
  if (!esPx(str)) {
    // letra por letra rompería el árabe y el tailandés: se destapa el renglón entero (de derecha a izquierda si es árabe)
    const total = Array.from(str).length, k = cuantas == null ? 1 : Math.min(1, cuantas / Math.max(1, total)), w = anchoTexto(str);
    g.save(); g.beginPath();
    if (fuenteSis(str).esc === 'arab') g.rect(x + w * (1 - k) - 2, y - 12, w * k + 4, 32); else g.rect(x - 2, y - 12, w * k + 2, 32);
    g.clip(); textoPx(g, str, x, y, o); g.restore();
    return;
  }
  let cx = x, i = 0;
  for (const ch of str) {
    if (cuantas != null && i >= cuantas) break;
    const w = glifoPx(ch).f[0].length;
    if (ch !== ' ') {
      const c = lienzoTexto(ch, o), d = desplazar ? desplazar(i) : null;
      g.drawImage(c, Math.round(cx - 1 + (d ? d[0] : 0)), Math.round(y - 4 + (d ? d[1] : 0)));
    }
    cx += w + 1; i++;
  }
}
/* partir un texto en renglones que entren en "ancho" píxeles */
function envolver(str, ancho) {
  if (typeof partirMedido === 'function') return partirMedido(str, ancho, anchoTexto);
  const renglones = [];
  for (const parrafo of str.split('\n')) {
    let linea = '';
    for (const pal of parrafo.split(' ')) {
      const prueba = linea ? linea + ' ' + pal : pal;
      if (anchoTexto(prueba) > ancho && linea) { renglones.push(linea); linea = pal; }
      else linea = prueba;
    }
    renglones.push(linea);
  }
  return renglones;
}

/* pone un texto del DOM en pixel art sin perder el texto original */
function pixelar(el, S, o) {
  if (!el) return;
  const txt = el.textContent.trim() !== '' ? el.textContent.trim() : (el.dataset.px || '');
  if (!txt) return;
  const clave = txt + '|' + S + '|' + (o && o.grad ? o.grad[0] : '');
  if (el.dataset.pxk === clave && el.querySelector('canvas.px')) return;
  el.dataset.px = txt; el.dataset.pxk = clave; el.textContent = '';
  const src = lienzoTexto(txt, o), c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.className = 'px';
  c.style.width = (c.width * S) + 'px'; c.style.height = (c.height * S) + 'px';
  c.setAttribute('aria-label', txt);
  el.appendChild(c);
}

const ICONOS_PX = {
  corazon: [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."],
  carta: ["#######", "##...##", "#.#.#.#", "#..#..#", "#.....#", "#.....#", "#######"],
  calavera: [".#####.", "#######", "#..#..#", "#######", ".##.##.", ".#####.", "..#.#.."],
  reloj: ["..###..", ".#...#.", "#..#..#", "#..##.#", "#.....#", ".#...#.", "..###.."],
  ambar: ["..###..", ".#####.", "#######", "#######", ".#####.", "..###..", "...#..."],
  chispa: ["...#...", "...#...", "..###..", "#######", "..###..", "...#...", "...#..."],
  piedra: ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "......."],
  viento: ["####...", "....#..", "######.", "......#", "#####..", ".....#.", "####..."],
  pausa: [".##.##.", ".##.##.", ".##.##.", ".##.##.", ".##.##.", ".##.##.", ".##.##."],
  mapa: ["#.#.#.#", "#######", "#.#.#.#", "#######", "#.#.#.#", "#######", "#.#.#.#"],
  flecha: ["...#...", "..###..", ".#####.", "#######", "..###..", "..###..", "..###.."],
  candado: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
  estrella: ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "#.....#"],
  mano: [".#.#.#.", ".#.#.#.", ".#####.", "#######", "#######", ".#####.", "..###.."],
  espina: ["......#", ".....#.", "....#..", "...#...", "..#....", ".#.....", "#......"],
  luz: ["...#...", ".#.#.#.", "..###..", "###.###", "..###..", ".#.#.#.", "...#..."],
};
function iconoPx(nombre, col, S) {
  const f = ICONOS_PX[nombre], c = document.createElement('canvas');
  c.width = 10; c.height = 10;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,6,16,0.75)';
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (f[y][x] === '#') g.fillRect(x + 1, y + 2, 3, 3);
  g.fillStyle = '#141018';
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (f[y][x] === '#') g.fillRect(x, y, 3, 3);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (f[y][x] === '#') { g.fillStyle = y < 2 ? '#ffffff' : col; g.fillRect(x + 1, y + 1, 1, 1); }
  if (S) { c.className = 'px'; c.style.width = (10 * S) + 'px'; c.style.height = (10 * S) + 'px'; }
  return c;
}
