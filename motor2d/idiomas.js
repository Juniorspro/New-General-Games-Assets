/* ============================================================================
   motor2d/idiomas.js — los 13 idiomas de los juegos (pedido del 08/10 para
   Brasil, Egipto, Indonesia, Irak, Japón, Myanmar, México, Malasia,
   Filipinas, Pakistán, Arabia Saudita, Tailandia y Turquía, más los tres que
   ya estaban). Egipto, Irak y Arabia Saudita comparten el árabe estándar.

   Lo común a todos: la lista con el nombre de cada idioma en su idioma, el
   idioma del celular al arrancar (sin cartel: se cambia desde el menú), qué
   letra del sistema usar para cada escritura, el árabe y el urdu de derecha a
   izquierda, y el corte de renglones midiendo (el japonés, el tailandés y el
   birmano no separan las palabras con espacios: se corta con Intl.Segmenter).
   ========================================================================== */

const IDIOMAS = [
  { id: 'es', nombre: 'Español (Argentina)' },
  { id: 'es-MX', nombre: 'Español (México)' },
  { id: 'en', nombre: 'English' },
  { id: 'pt', nombre: 'Português (Brasil)' },
  { id: 'ar', nombre: 'العربية', rtl: true },
  { id: 'id', nombre: 'Bahasa Indonesia' },
  { id: 'ms', nombre: 'Bahasa Melayu' },
  { id: 'fil', nombre: 'Filipino' },
  { id: 'tr', nombre: 'Türkçe' },
  { id: 'ur', nombre: 'اردو', rtl: true },
  { id: 'th', nombre: 'ไทย' },
  { id: 'my', nombre: 'မြန်မာ' },
  { id: 'ja', nombre: '日本語' },
];
const nombreIdioma = (id) => (IDIOMAS.find((i) => i.id === id) || IDIOMAS[2]).nombre;

/* el idioma del equipo: el rioplatense queda para Argentina, Uruguay y Paraguay;
   el resto del español va con el de México (tuteo) */
function idiomaDelEquipo() {
  const lista = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
  for (const l of lista) {
    const [base, region] = l.split(/[-_]/);
    if (base === 'es') return ['ar', 'uy', 'py'].includes(region) ? 'es' : 'es-MX';
    if (base === 'pt') return 'pt';
    if (base === 'tl' || base === 'fil') return 'fil';
    if (base === 'in') return 'id';
    if (IDIOMAS.some((i) => i.id === base)) return base;
  }
  return 'en';
}
function idiomaInicial(guardado) { return guardado && IDIOMAS.some((i) => i.id === guardado) ? guardado : idiomaDelEquipo(); }

/* la escritura de un texto, por su primera letra que no sea latina */
function escrituraDe(str) {
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c < 0x0370) continue;
    if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f) || (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) return 'arab';
    if (c >= 0x0e00 && c <= 0x0e7f) return 'thai';
    if ((c >= 0x1000 && c <= 0x109f) || (c >= 0xa9e0 && c <= 0xa9ff) || (c >= 0xaa60 && c <= 0xaa7f)) return 'mymr';
    if ((c >= 0x3000 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)) return 'jpan';
  }
  return 'latn';
}
const esRTL = (str) => escrituraDe(str) === 'arab';

/* las letras del sistema por escritura (las trae cada celular para su idioma).
   Dos estilos: 'sans' (palo seco) y 'serif' (para los juegos de letra con serifa) */
const FUENTES_ESCRITURA = {
  arab: { sans: '"Noto Naskh Arabic","Noto Sans Arabic","Geeza Pro","Segoe UI","Tahoma",sans-serif', serif: '"Noto Naskh Arabic","Amiri","Geeza Pro","Times New Roman",serif' },
  urdu: { sans: '"Noto Naskh Arabic","Noto Nastaliq Urdu","Geeza Pro","Segoe UI","Tahoma",sans-serif', serif: '"Noto Naskh Arabic","Noto Nastaliq Urdu","Geeza Pro","Times New Roman",serif' },
  thai: { sans: '"Noto Sans Thai","Noto Sans Thai UI","Leelawadee UI","Leelawadee","Thonburi","Tahoma",sans-serif', serif: '"Noto Serif Thai","Noto Sans Thai","Leelawadee UI","Thonburi",serif' },
  mymr: { sans: '"Noto Sans Myanmar","Noto Sans Myanmar UI","Myanmar Text","Myanmar Sangam MN","Padauk",sans-serif', serif: '"Noto Serif Myanmar","Noto Sans Myanmar","Myanmar Text","Myanmar Sangam MN","Padauk",serif' },
  jpan: { sans: '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif', serif: '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP","MS Mincho",serif' },
};
function fuenteEscritura(esc, estilo) {
  if (esc === 'latn') return null;
  const f = FUENTES_ESCRITURA[esc === 'arab' && IDIOMA === 'ur' ? 'urdu' : esc];
  return f[estilo === 'serif' ? 'serif' : 'sans'];
}
/* a igual tamaño en píxeles, las mayúsculas latinas se ven más grandes que el
   árabe o el tailandés y más chicas que el japonés: se compensa */
const escalaEscritura = (esc) => ({ latn: 1, arab: 1.18, thai: 1.12, mymr: 1.02, jpan: 0.92 })[esc] || 1;

/* partir en renglones que entren en `ancho`, con `medir(texto)` → ancho. Corta en
   espacios; si la escritura no los usa entre palabras, corta por palabras (Segmenter) */
function partirMedido(str, ancho, medir) {
  const out = [];
  for (const parrafo of String(str).split('\n')) {
    const esc = escrituraDe(parrafo);
    let piezas;
    if ((esc === 'jpan' || esc === 'thai' || esc === 'mymr') && typeof Intl !== 'undefined' && Intl.Segmenter) {
      piezas = Array.from(new Intl.Segmenter(IDIOMA, { granularity: 'word' }).segment(parrafo), (s) => s.segment);
    } else if (esc === 'jpan') piezas = Array.from(parrafo);
    else piezas = parrafo.split(/(\s+)/);
    let linea = '';
    for (const p of piezas) {
      if (!p) continue;
      const prueba = linea + p;
      if (linea.trim() && medir(prueba.trim()) > ancho) { out.push(linea.trim()); linea = /^\s+$/.test(p) ? '' : p; }
      else linea = prueba;
    }
    out.push(linea.trim());
  }
  return out;
}

/* el globito del botón de idioma: se reconoce aunque no se lea el idioma de ahora */
function dibujarGlobo(g, x, y, r, col, ancho) {
  g.save(); g.strokeStyle = col; g.lineWidth = ancho || Math.max(1, r * 0.16);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(x, y, r * 0.42, r, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y);
  g.moveTo(x - r * 0.86, y - r * 0.5); g.lineTo(x + r * 0.86, y - r * 0.5); g.moveTo(x - r * 0.86, y + r * 0.5); g.lineTo(x + r * 0.86, y + r * 0.5); g.stroke();
  g.restore();
}
/* el mismo globito en píxeles (9 × 9), para los juegos de píxeles */
const GLOBO_PX = ['..###..', '.#.#.#.', '#######', '#..#..#', '#######', '.#.#.#.', '..###..'];
function globoPx(g, x, y, col) {
  g.fillStyle = col;
  GLOBO_PX.forEach((fila, j) => { for (let i = 0; i < fila.length; i++) if (fila[i] === '#') g.fillRect(x + i, y + j, 1, 1); });
}
