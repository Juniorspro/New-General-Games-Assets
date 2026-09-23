/* ============================================================================
   kuntur/js/elenco.js — el resto del elenco y los decorados, en pixel art,
   para imprimir en papel: la abuela, doña Rosa, don Ceferino, Tomás, el
   Coquena, el puma, las llamas, las vicuñas, los flamencos, Apu en todas sus
   edades, los cardones, las casas de adobe, la iglesia, las apachetas...
   Cada uno es una función que dibuja un cuadro en un Lienzo (y para arriba,
   los pies en y = 0).
   ========================================================================== */
import { Lienzo, oscurecer } from './vox.js';

const piel = '#b87650', pielO = '#8e5a3c';
function base(w, h) { return new Lienzo(w, h); }
function fin(L) { L.contorno(0.82); return L; }
const S = Math.sin;

/* ---------------- gente ---------------- */
/* una figura con pollera (abuela, Rosa) */
function mujer(o, f) {
  const L = base(30, 40), cx = 14;
  const b = f % 2 ? 1 : 0;
  /* pollera ancha */
  L.poligono([[cx - 5, 17], [cx + 5, 17], [cx + 9, 1], [cx - 9, 1]], (x, y) => (y < 4 ? o.pollera2 : y > 13 ? oscurecer(o.pollera, 0.9) : o.pollera));
  L.rect(cx - 3, 0, cx - 1, 1, '#2a1a14'); L.rect(cx + 1, 0, cx + 3, 1, '#2a1a14');
  /* la manta sobre los hombros */
  L.poligono([[cx - 6, 25], [cx + 6, 25], [cx + 8, 15], [cx - 8, 15]], (x, y) => ((y + (x >> 1)) % 4 < 1 ? o.manta2 : o.manta));
  L.poner(cx + 1, 20, o.prende || '#f2d23c');
  /* brazos o manos */
  if (o.canasta) { L.elipse(cx + 8, 12, 3.4, 2.4, '#b08a50'); L.rect(cx + 5, 13, cx + 11, 13, '#8a6a3a'); L.linea(cx + 6, 14, cx + 10, 16, '#8a6a3a', 1); }
  L.rect(cx + 6, 15 + b, cx + 7, 16 + b, piel);
  /* cabeza */
  const hy = 29 + (o.mirando ? 0 : 0);
  L.elipse(cx + 1, hy, 4.4, 4.3, (x, y) => (x < cx - 1 ? o.pelo : piel));
  L.poner(cx + 2, hy, '#140c10'); L.poner(cx + 4, hy, '#140c10');
  L.poner(cx + 3, hy - 2.2, o.boca && b ? '#6a2a2a' : pielO);
  L.poner(cx + 1, hy - 1.4, '#d8786a'); L.poner(cx + 5, hy - 1.4, '#d8786a');
  if (o.arrugas) { L.poner(cx + 5.2, hy + 0.8, pielO); L.poner(cx + 1, hy + 1.2, pielO); }
  /* trenzas largas */
  for (let i = 0; i < 10; i++) L.poner(cx - 3 - (i > 5 ? 0.4 : 0), hy - 2 - i, i % 2 ? oscurecer(o.pelo, 1.3) : o.pelo);
  L.poner(cx - 3.4, hy - 12, o.cinta || '#d6246e');
  /* sombrero */
  if (o.sombrero === 'bombin') {
    L.rect(cx - 5, hy + 3, cx + 7, hy + 3, '#1c1618');
    L.elipse(cx + 1, hy + 5.5, 3.2, 2.6, '#2a2226');
    L.rect(cx - 2, hy + 4, cx + 4, hy + 4, '#6a1f2a');
  } else if (o.sombrero === 'paja') {
    L.rect(cx - 7, hy + 3, cx + 9, hy + 3, '#d8b870');
    L.elipse(cx + 1, hy + 5, 3.6, 2.2, '#e0c47c');
    L.rect(cx - 2, hy + 4, cx + 4, hy + 4, '#b8262f');
  }
  return fin(L);
}
function hombre(o, f) {
  const L = base(30, 42), cx = 14, b = f % 2;
  /* piernas */
  L.linea(cx - 1.5, 10, cx - 2, 1, o.pant, 3); L.linea(cx + 2, 10, cx + 2.5, 1, o.pant, 3);
  L.rect(cx - 3.5, 0, cx - 0.5, 0, '#241612'); L.rect(cx + 1, 0, cx + 4, 0, '#241612');
  /* poncho o mameluco */
  if (o.mameluco) {
    L.rect(cx - 4, 9, cx + 5, 24, o.mameluco);
    L.rect(cx - 2, 18, cx + 3, 24, oscurecer(o.mameluco, 0.85));
    L.poner(cx - 1, 22, '#d8d8d8'); L.poner(cx + 2, 22, '#d8d8d8');
    L.linea(cx + 5, 22, cx + 8, 17 + b, o.camisa || '#a0402a', 2);
    L.rect(cx + 8, 16 + b, cx + 9, 17 + b, piel);
    if (o.pañuelo) L.rect(cx - 3, 24, cx + 4, 25, o.pañuelo);
  } else {
    L.poligono([[cx - 4, 26], [cx + 5, 26], [cx + 9, 10], [cx - 8, 10]], (x, y) => (y === 12 || y === 13 ? o.ponchoFranja : y % 5 === 0 ? oscurecer(o.poncho, 0.85) : o.poncho));
    if (o.pico) { L.linea(cx + 7, 14, cx + 11, 26, '#6a4a2a', 1); L.linea(cx + 8, 26, cx + 14, 25, '#8a8a90', 2); }
  }
  /* cabeza */
  const hy = 31;
  L.elipse(cx + 1, hy, 4.4, 4.5, (x, y) => (o.barba && y < hy - 1 && x > cx - 2 ? o.barba : x < cx - 1.5 ? o.pelo : piel));
  L.poner(cx + 2, hy + 0.5, '#140c10'); L.poner(cx + 4.5, hy + 0.5, '#140c10');
  if (o.hollin) { L.poner(cx + 4, hy - 1, '#5a4a4a'); L.poner(cx, hy - 2, '#5a4a4a'); }
  L.poner(cx + 3.2, hy - 2, b ? '#6a2a2a' : pielO);
  if (o.sombrero) {
    L.rect(cx - 6, hy + 3, cx + 8, hy + 3, o.sombrero);
    L.rect(cx - 2, hy + 4, cx + 4, hy + 6, oscurecer(o.sombrero, 1.15));
    L.rect(cx - 2, hy + 4, cx + 4, hy + 4, '#3a2a1a');
  }
  if (o.gorra) { L.elipse(cx + 1, hy + 4, 4.6, 2.2, o.gorra); L.rect(cx + 3, hy + 3, cx + 8, hy + 3, oscurecer(o.gorra, 0.7)); }
  return fin(L);
}
export const ELENCO = {
  abuela: (f) => mujer({ pollera: '#5a2a5a', pollera2: '#e8b83a', manta: '#c0282e', manta2: '#f2b632', pelo: '#8a8490', sombrero: 'bombin', arrugas: true, boca: true, cinta: '#1f8f6c' }, f),
  rosa: (f) => mujer({ pollera: '#1f6f8a', pollera2: '#f2d23c', manta: '#e8702a', manta2: '#6a2f9a', pelo: '#1d1418', sombrero: 'paja', canasta: true, boca: true }, f),
  ceferino: (f) => hombre({ pant: '#4a3a2a', poncho: '#8a5a3a', ponchoFranja: '#e8d8b8', pelo: '#2a2020', barba: '#e8e0d8', sombrero: '#6a5a4a', pico: true }, f),
  tomas: (f) => hombre({ pant: '#2a3a5a', mameluco: '#3a5a8a', pañuelo: '#c0282e', pelo: '#1d1418', gorra: '#2a3a5a', hollin: true }, f),
  coquena: (f) => {
    const L = base(20, 24), cx = 9;
    L.poligono([[cx - 3, 13], [cx + 4, 13], [cx + 6, 1], [cx - 5, 1]], (x, y) => ((y >> 1) % 3 === 0 ? '#e8d4a8' : '#c8a878'));
    L.elipse(cx + 0.5, 16, 3.4, 3.2, (x, y) => (y > 17 ? '#e8d4a8' : '#8a6a4a'));
    L.poner(cx + 1, 16, f % 2 ? '#fff6a0' : '#ffe060'); L.poner(cx + 3, 16, f % 2 ? '#fff6a0' : '#ffe060');
    L.linea(cx + 6, 1, cx + 7, 19, '#6a4a2a', 1); L.poner(cx + 7, 20, '#fff6a0');
    return fin(L);
  },
};

/* ---------------- animales ---------------- */
function cuadrupedo(o, f, n) {
  const L = base(o.w, o.h), a = (f / n) * Math.PI * 2;
  const cuerpoY = o.patas + 1 + (o.corre ? Math.abs(Math.cos(a)) * 1.2 : 0);
  /* patas: cuatro líneas, las de atrás más oscuras */
  const pata = (x, fase, lejos) => {
    const s = o.corre ? S(a + fase) * o.paso : (f % 2 && !lejos ? 0.4 : 0);
    const c = lejos ? oscurecer(o.col, 0.72) : o.col;
    L.linea(x, cuerpoY, x + s, 0, c, o.grosorPata || 2);
  };
  pata(o.x0 + 1, Math.PI, true); pata(o.x1 - 2, 0, true);
  L.elipse((o.x0 + o.x1) / 2, cuerpoY + o.alto / 2, (o.x1 - o.x0) / 2, o.alto / 2, (x, y) => (y < cuerpoY + 1.5 ? o.panza || o.col : o.col));
  pata(o.x0 + 2.5, 0, false); pata(o.x1 - 0.5, Math.PI, false);
  if (o.cabeza) o.cabeza(L, cuerpoY, f, a);
  return fin(L);
}
export const ANIMALES = {
  llama: (f) => cuadrupedo({ w: 26, h: 34, x0: 3, x1: 17, alto: 9, patas: 12, col: '#e8dcc8', panza: '#d8c8b0', cabeza: (L, y, f) => {
    L.linea(16, y + 7, 18, y + 18, '#e8dcc8', 3);
    L.elipse(19.5, y + 19.5, 3, 2, '#e8dcc8'); L.poner(21, y + 19.5, '#140c10');
    L.linea(18, y + 21, 17.5, y + 23.5, '#e8dcc8', 1); L.linea(20, y + 21, 20.5, y + 23.5, '#e8dcc8', 1);
    L.poner(17.5, y + 24, '#d6246e'); L.poner(20.5, y + 24, '#1f8f6c');
    if (f % 2) L.poner(22, y + 18.6, '#8a7a6a');
    L.linea(2, y + 8, 1, y + 6, '#d8c8b0', 2);
  } }, f, 2),
  vicuna: (f) => cuadrupedo({ w: 24, h: 26, x0: 3, x1: 15, alto: 6, patas: 10, col: '#c8904a', panza: '#f2e6d0', paso: 3, corre: f >= 2, cabeza: (L, y, f) => {
    L.linea(14, y + 4, 16, y + 11, '#c8904a', 2);
    L.elipse(17.5, y + 11.5, 2.4, 1.6, '#c8904a'); L.poner(18.5, y + 12, '#140c10');
    L.poner(16.5, y + 13.5, '#a07030'); L.poner(18, y + 13.5, '#a07030');
    L.rect(13, y + 3, 15, y + 5, '#f2e6d0');
  } }, f, 4),
  puma: (f) => cuadrupedo({ w: 40, h: 22, x0: 4, x1: 30, alto: 7, patas: 7, col: '#b88a54', panza: '#e0c8a0', paso: 5, corre: f < 4, grosorPata: 3, cabeza: (L, y, f, a) => {
    L.elipse(32.5, y + 6, 4.4, 3.8, '#b88a54');
    L.poner(34, y + 6.5, '#f2d23c'); L.poner(36, y + 6.5, '#f2d23c'); L.poner(34, y + 6.5, '#2a1a10');
    L.rect(35, y + 3, 37, y + 4, '#e0c8a0'); L.poner(37, y + 4, '#3a2020');
    L.poner(30.5, y + 10, '#8a6a44'); L.poner(33.5, y + 10, '#8a6a44');
    /* la cola larga */
    for (let i = 0; i < 9; i++) L.poner(4 - i * 0.5, y + 5 + Math.sin(a + i * 0.5) * 1.5 + i * 0.3, i > 6 ? '#5a3a24' : '#b88a54');
  } }, f, 4),
  flamenco: (f) => {
    const L = base(16, 30);
    L.linea(7, 12, 7, 0, '#e07a80', 1);
    if (f % 2) L.linea(7, 8, 10, 6, '#e07a80', 1); else L.linea(8, 12, 8, 0, '#e07a80', 1);
    L.elipse(7, 14, 4, 2.6, '#f28c9a');
    L.rect(4, 14, 8, 14, '#e0606a');
    L.linea(9, 15, 10, 22, '#f28c9a', 1);
    L.linea(10, 22, 12, 25, '#f28c9a', 1);
    L.elipse(12, 25.5, 1.6, 1.2, '#f28c9a'); L.poner(13.4, 24.6, '#1a1a1a'); L.poner(12.8, 26, '#140c10');
    return fin(L);
  },
};

/* ---------------- Apu ---------------- */
export const APU = {
  /* pichón asomado del atado, o parado en el suelo */
  pichon: (f) => {
    const L = base(14, 14);
    L.elipse(6.5, 5, 5, 4.6, (x, y) => ((x + y) % 5 === 0 ? '#b0a498' : '#9a8e84'));
    L.elipse(8, 9.5, 3.4, 3.2, (x, y) => (y > 10.4 ? '#8a7e74' : '#6a5e5a'));
    L.poner(9, 10, '#140c10'); if (!(f % 3)) L.poner(9, 10.6, '#ffffff');
    L.rect(11, 8.6, 12, 9.4, '#3a3032'); L.poner(12.6, 8.4, '#d8cfc4');
    if (f === 2) { L.poner(11.8, 9.8, '#3a3032'); L.poner(12.6, 10.2, '#3a3032'); }
    L.poner(4, 10, '#b0a498'); L.poner(5, 11, '#b0a498'); L.poner(7, 12.5, '#b0a498');
    L.linea(5, 1, 5, 0, '#8a7a72', 1); L.linea(8, 1, 8, 0, '#8a7a72', 1);
    return fin(L);
  },
  /* el cuerpo del cóndor volando (las alas van aparte, para batirlas de verdad) */
  cuerpo: (edad) => {
    const L = base(30, 16), cuerpo = edad > 0.5 ? '#1c1a1c' : '#5a4e48';
    L.elipse(13, 7, 9, 4.2, (x, y) => (y < 5 ? oscurecer(cuerpo, 1.25) : cuerpo));
    L.poligono([[3, 8], [5, 5], [-1, 4], [-1, 9]], cuerpo);
    L.elipse(23, 9.4, 3, 2.6, edad > 0.6 ? '#f2eee8' : '#9a8e84');
    L.elipse(26.5, 10.5, 2.6, 2.2, edad > 0.5 ? '#8a4a4c' : '#5a4a4a');
    L.poner(27.5, 11, '#140c10'); L.rect(28.6, 9.6, 29.4, 10.4, '#d8cfc4'); L.poner(29.4, 9.2, '#d8cfc4');
    L.linea(12, 3, 11, 0, '#6a5a52', 1); L.linea(15, 3, 14, 0, '#6a5a52', 1);
    return fin(L);
  },
  /* un ala: plumas largas con los "dedos" abiertos en la punta */
  ala: (edad) => {
    const L = base(34, 12), pl = edad > 0.5 ? '#1c1a1c' : '#5a4e48';
    L.poligono([[0, 9], [20, 11], [26, 8], [24, 3], [0, 5]], (x, y) => (y < 5 && x > 4 ? '#f2eee8' : pl));
    for (let i = 0; i < 5; i++) L.linea(22 + i, 9 - i * 1.4, 32 - i * 0.4, 10 - i * 2.2, pl, 1);
    return fin(L);
  },
};

/* ---------------- decorados ---------------- */
export const DECOR = {
  cardon: (v) => {
    const alto = 34 + (v % 3) * 10, L = base(28, alto + 4), cx = 13;
    const verde = ['#3a7a4a', '#4a8a52', '#2e6a40'], col = (x) => verde[(x + 30) % 3];
    L.rect(cx - 2, 0, cx + 2, alto - 3, (x) => col(x));
    L.elipse(cx, alto - 3, 2.5, 2.5, (x) => col(x));
    const brazo = (lado, y0, largo) => {
      const x1 = cx + lado * 6;
      L.rect(Math.min(cx, x1), y0, Math.max(cx, x1), y0 + 2, (x) => col(x));
      L.rect(x1 - 1, y0, x1 + 1, y0 + largo, (x) => col(x));
      L.elipse(x1, y0 + largo, 1.4, 1.4, (x) => col(x));
    };
    brazo(-1, 12 + (v % 2) * 4, 12 + (v % 3) * 3);
    if (v % 2 === 0) brazo(1, 18, 10);
    /* espinas: puntitos claros */
    for (let y = 2; y < alto - 3; y += 3) { L.poner(cx - 3, y, '#e8e0b0'); L.poner(cx + 3, y + 1, '#e8e0b0'); }
    if (v % 3 === 1) { L.poner(cx, alto, '#f4f0f0'); L.poner(cx - 1, alto - 1, '#f4a0c0'); L.poner(cx + 1, alto - 1, '#f4a0c0'); }
    return fin(L);
  },
  casa: (v) => {
    const L = base(52, 40), c = v % 2 ? '#c8906a' : '#b8805a';
    L.rect(2, 0, 49, 27, (x, y) => ((y % 6 === 0) || (((x + (y / 6 | 0) * 5) % 10) === 0) ? oscurecer(c, 0.85) : c));
    L.poligono([[0, 26], [51, 26], [49, 33], [2, 33]], (x, y) => (y % 2 ? '#c8a860' : '#b89850'));
    for (let x = 2; x < 50; x += 3) L.poner(x, 25, '#8a6a3a');
    L.rect(18, 0, 30, 18, '#5a3a24'); L.rect(19, 1, 29, 17, '#7a4a2a'); L.poner(27, 9, '#e8c04a');
    L.rect(36, 10, 44, 18, '#3a2a28'); L.rect(37, 11, 43, 17, v % 2 ? '#f2d080' : '#6a8aa8'); L.rect(40, 11, 40, 17, '#3a2a28');
    if (v % 2) { L.rect(6, 6, 12, 14, '#3a2a28'); L.rect(7, 7, 11, 13, '#f2d080'); }
    return fin(L);
  },
  iglesia: () => {
    const L = base(64, 76), bl = '#f2ece0', bo = '#d8d0c0';
    L.rect(4, 0, 50, 38, (x, y) => ((y % 8 === 0) ? bo : bl));
    L.poligono([[2, 38], [52, 38], [27, 52]], (x, y) => (y % 2 ? '#c8b890' : '#b8a880'));
    L.rect(48, 0, 62, 60, (x, y) => ((y % 8 === 0) ? bo : bl));
    L.poligono([[46, 60], [64, 60], [55, 70]], '#c8b890');
    L.rect(51, 44, 59, 54, '#3a2a28'); L.elipse(55, 47, 2.5, 3, '#e8c04a');
    L.rect(54, 70, 56, 75, '#6a4a2a'); L.rect(52, 72, 58, 73, '#6a4a2a');
    L.rect(20, 0, 34, 22, '#6a4028'); L.elipse(27, 22, 7, 5, '#6a4028'); L.rect(22, 1, 32, 21, '#8a5a34');
    L.rect(26, 28, 28, 34, '#6a4a2a'); L.rect(24, 30, 30, 32, '#6a4a2a');
    return fin(L);
  },
  poste: () => { const L = base(12, 60); L.rect(5, 0, 6, 56, '#6a4a2a'); L.rect(1, 50, 10, 51, '#6a4a2a'); L.poner(1, 52, '#d8d8e8'); L.poner(10, 52, '#d8d8e8'); return fin(L); },
  estacion: () => {
    const L = base(70, 44), c = '#c86a4a';
    L.rect(2, 0, 67, 26, (x, y) => (y % 5 === 0 ? oscurecer(c, 0.85) : c));
    L.poligono([[0, 26], [69, 26], [60, 36], [9, 36]], '#5a5a6a');
    for (let x = 8; x < 64; x += 12) { L.rect(x, 8, x + 6, 18, '#3a2a28'); L.rect(x + 1, 9, x + 5, 17, '#f2d080'); }
    L.rect(22, 29, 46, 33, '#f2ece0');
    return fin(L);
  },
  sal: (v) => { const L = base(30, 18); L.poligono([[1, 0], [28, 0], [16 + (v % 3), 14 + (v % 2) * 3]], (x, y) => ((x + y) % 7 === 0 ? '#d8dce4' : '#f6f4ee')); return fin(L); },
  apacheta: (encendida) => {
    const L = base(26, 24);
    const piedras = [[5, 2, 5, 3], [13, 2, 6, 3], [20, 2, 4, 3], [9, 6.5, 5, 2.6], [16, 6.5, 4.4, 2.6], [12, 10.5, 4, 2.4], [13, 14, 2.6, 2]];
    piedras.forEach(([x, y, rx, ry], i) => L.elipse(x, y, rx, ry, ['#8a8078', '#a09488', '#76706a', '#98908a'][i % 4]));
    if (encendida) { L.elipse(13, 17.6, 2, 1.6, '#c8b8a0'); L.rect(12, 19, 13, 23, '#d6246e'); L.rect(14, 20, 17, 22, '#f2d23c'); }
    return fin(L);
  },
  fogon: (f) => {
    const L = base(20, 20);
    L.rect(2, 0, 17, 2, '#5a4a42'); L.rect(4, 1, 15, 3, '#3a2a28');
    const h = [9, 11, 8][f % 3];
    L.poligono([[4, 3], [15, 3], [10 + (f % 2), 3 + h]], '#f28c28');
    L.poligono([[6, 3], [13, 3], [9.5 - (f % 2), 3 + h * 0.7]], '#f2d23c');
    L.poligono([[8, 3], [11, 3], [9.5, 3 + h * 0.4]], '#fff6c0');
    return fin(L);
  },
  corral: () => { const L = base(8, 22); L.rect(3, 0, 4, 19, '#7a5a3a'); L.poner(3, 20, '#8a6a4a'); return fin(L); },
  nido: () => { const L = base(30, 10); for (let i = 0; i < 40; i++) L.linea(2 + (i * 7) % 26, (i * 3) % 5, 4 + (i * 11) % 24, 2 + (i * 5) % 6, i % 2 ? '#6a4a2a' : '#8a6a42', 1); return fin(L); },
  farol: (f) => { const L = base(10, 14); L.rect(3, 12, 6, 13, '#2a2a2a'); L.rect(1, 2, 8, 11, '#3a3a3a'); L.rect(2, 3, 7, 10, f % 2 ? '#ffe7a0' : '#ffd070'); L.rect(2, 0, 7, 1, '#3a3a3a'); return fin(L); },
  tranquera: () => { const L = base(22, 62); L.rect(1, 0, 3, 60, '#6a4a2a'); L.rect(18, 0, 20, 60, '#6a4a2a'); for (let y = 6; y < 58; y += 10) L.rect(3, y, 18, y + 2, '#8a6a42'); L.linea(3, 6, 18, 56, '#7a5a3a', 2); return fin(L); },
  traba: () => { const L = base(14, 14); L.elipse(7, 7, 5, 5, '#c8a040'); L.elipse(7, 7, 2.5, 2.5, '#8a6a20'); L.rect(6, 11, 8, 13, '#6a4a2a'); return fin(L); },
  palanca: (tirada) => { const L = base(16, 22); L.rect(2, 0, 13, 3, '#5a5a62'); if (tirada) L.linea(8, 3, 14, 15, '#8a6a42', 2); else L.linea(8, 3, 2, 15, '#8a6a42', 2); L.elipse(tirada ? 14 : 2, 16, 1.6, 1.6, '#c0282e'); return fin(L); },
  piedra: () => {
    const L = base(26, 26);
    L.rect(1, 0, 24, 24, (x, y) => ((x * 7 + y * 13) % 17 === 0 ? '#8a8078' : (x + y) % 9 === 0 ? '#b0a498' : '#9a9088'));
    L.linea(6, 18, 12, 12, '#6a6058', 1); L.linea(12, 12, 10, 6, '#6a6058', 1); L.linea(17, 22, 21, 16, '#6a6058', 1);
    return fin(L);
  },
  copla: (f) => {
    const L = base(12, 20), cols = ['#d6246e', '#f28c28', '#f2d23c', '#1f8f6c', '#2b8fd0', '#6a2f9a'];
    for (let y = 0; y < 18; y++) { const dx = Math.round(Math.sin(y * 0.5 + f * 1.4) * 1.6); L.rect(4 + dx, y, 7 + dx, y, cols[(y >> 1) % cols.length]); }
    return fin(L);
  },
  espinas: (v) => { const L = base(26, 14); L.elipse(13, 5, 11, 5, '#4a6a3a'); for (let i = 0; i < 12; i++) L.linea(4 + i * 1.6, 6, 3 + i * 1.7 + (i % 2 ? 2 : -2), 12 + (i % 3), '#e8e0b0', 1); return fin(L); },
  hieloPincho: () => { const L = base(26, 14); for (let i = 0; i < 5; i++) L.poligono([[1 + i * 5, 0], [5 + i * 5, 0], [3 + i * 5, 8 + (i % 2) * 4]], i % 2 ? '#c8ecf8' : '#a8dcf0'); return fin(L); },
};
