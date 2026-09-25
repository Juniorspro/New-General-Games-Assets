/* ============================================================================
   aeroplaza/js/reinos/plaza.js — la isla grande, donde empieza todo. En el
   centro, lo de siempre: la plaza con la fuente de burbujas, el lago con el
   globo que derrama la cascada, peceras, la tienda, el probador, el barrio,
   la huerta y la loma del mirador. Alrededor, las regiones:
   · la Terminal Aero (el establecimiento del tren: de ahí salen los trenes a
     los otros reinos y el monorriel que da la vuelta a la isla), con el spawn
     y el cartel del mapa en la puerta;
   · la Ciudad de Vidrio (hoteles, el pabellón octogonal, faroles);
   · la Bahía del Faro (playa, muelle, velero, faro en su islote);
   · la Pradera de los Molinos (lomas, molinos, flores);
   · el Bosque de Hongos (árboles tupidos, hongos que rebotan, casa del árbol);
   · el Monte de la Cascada (la cumbre con glorieta y la cascada al pozo).
   Es la sala donde más gente se cruza.
   ========================================================================== */
import * as THREE from 'three';
import { Mundo, azar, ruido2, suaveEntre } from '../mundo.js';
import { terreno, agua, pasto, flores, arboles, palmeras, piedras, UNI } from '../naturaleza.js';
import { Orbes, Mariposas, Cardumen, Burbujas, Frutas, Medusas, pecera, globoCascada, discoMalla, puntoSuave } from '../objetos.js';
import { tiendaAfuera, probadorCabina, faroles as hacerFaroles, bancos as hacerBancos, letrero, pabellon } from '../edificios.js';
import { modelo } from '../modelos.js';
import { Monorriel } from '../monorriel.js';
import { sumar, t } from '../textos.js';

const R1 = ruido2(3), R2 = ruido2(8), R3 = ruido2(21);
/* el centro de siempre */
const LAGO = [18, -12], TIENDA = [30, 26], PLAZA = [0, 6], LOMA = [-30, -26], HUERTA = [-4, -38], PROBADOR = [9, 18], BARRIO = [2, 46];
const CASAS = [[-13, 43], [2, 51], [17, 43]];
/* lo nuevo: la terminal (la vía la cruza de sur a norte por x = -62), el spawn en su puerta y las regiones */
const TERMINAL = [-62, 14], SPAWN = [-43.5, 14], CARTEL = [-38.5, 8.2];
const CIUDAD = [132, -28], PRADERA = [-122, 118], BOSQUE = [-128, -108], MONTE = [30, -178], POZO = [24, -130];
const BAHIA = 0.79;   // para dónde queda la bahía (ángulo desde el centro)
const LOMAS_PRADERA = [[-140, 96, 9, 22], [-100, 140, 7, 20], [-150, 140, 11, 24], [-110, 100, 5, 16], [-170, 110, 8, 20]];
const MOLINOS = [[-140, 96], [-150, 140], [-100, 140], [-172, 112], [-88, 162]];
const HOTELES = [1.0, 2.1, 3.2, 4.25, 5.3].map((a, i) => [CIUDAD[0] + Math.cos(a) * 31, CIUDAD[1] + Math.sin(a) * 31, 16 + (i % 3) * 1.6]);
const plano = (h, x, z, [cx, cz], r, borde, y) => { const d = Math.hypot(x - cx, z - cz); return h + (y - h) * suaveEntre(r + borde, r, d); };
const expo = (x, z, [cx, cz], rr) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (rr * rr));

/* la costa: una isla redonda con una bahía al noreste */
function costaEn(a) {
  const da = Math.atan2(Math.sin(a - BAHIA), Math.cos(a - BAHIA));
  return 222 + R1(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5) * 18 + Math.sin(a * 3 + 1) * 8 + Math.sin(a * 7) * 3.5 - 50 * Math.exp(-((da / 0.3) ** 2));
}
/* el faro, en su islote a la salida de la bahía */
const FARO = (() => { const r = costaEn(BAHIA) + 74; return [Math.cos(BAHIA) * r, Math.sin(BAHIA) * r]; })();

/* la altura sin lo achatado (las colinas, la costa y el monte) */
function relieve(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x), costa = costaEn(a);
  let h = 1.6 + R1(x * 0.028, z * 0.028) * 1.5 + R2(x * 0.09, z * 0.09) * 0.35;
  /* lejos del centro, colinas más grandes */
  h += suaveEntre(70, 125, r) * (R3(x * 0.011 + 3, z * 0.011 - 7) * 0.5 + 0.5) * 7;
  h = 1.6 + (h - 1.6) * suaveEntre(costa - 6, costa - 34, r);
  h += 7.5 * expo(x, z, LOMA, 16) + 2.2 * expo(x, z, [40, -30], 14);
  for (const [cx, cz, alto, rr] of LOMAS_PRADERA) h += alto * expo(x, z, [cx, cz], rr);
  /* la playa baja hacia el mar */
  const tp = suaveEntre(costa - 14, costa + 4, r);
  h = h + (-2.4 - h) * tp;
  if (r > costa + 4) h = -2.4 - Math.min(10, (r - costa - 4) * 0.16);
  /* el monte sale del mar, al sur */
  const dm = Math.hypot(x - MONTE[0], z - MONTE[1]);
  h = Math.max(h, 38 * Math.exp(-((dm / 46) ** 2)) * (1 + 0.08 * R2(x * 0.06, z * 0.06)) - 2.5);
  /* el islote del faro */
  const df = Math.hypot(x - FARO[0], z - FARO[1]);
  if (df < 16) h = Math.max(h, 2.2 - (df / 9) ** 2 * 3);
  return h;
}
export function alturaPlaza(x, z) {
  let h = relieve(x, z);
  /* el lago del centro y el pozo de la cascada: cuencos */
  const dl = Math.hypot(x - LAGO[0], z - LAGO[1]);
  if (dl < 19) h = h + (-2.8 + (dl / 12) ** 2 * 1.2 - h) * suaveEntre(19, 9, dl);
  const dp = Math.hypot(x - POZO[0], z - POZO[1]);
  if (dp < 17) h = h + (-2.6 + (dp / 10) ** 2 * 1.2 - h) * suaveEntre(17, 8.5, dp);
  /* lo plano donde van las construcciones */
  h = plano(h, x, z, TIENDA, 8, 6, 1.7);
  h = plano(h, x, z, PLAZA, 10, 6, 1.65);
  h = plano(h, x, z, PROBADOR, 3, 3, 1.7);
  h = plano(h, x, z, BARRIO, 15, 7, 1.7);
  { const d = Math.max(Math.abs(x - TERMINAL[0] - 3) - 20, Math.abs(z - TERMINAL[1]) - 27, 0); h = h + (1.7 - h) * suaveEntre(9, 0, d); }
  h = plano(h, x, z, CIUDAD, 46, 12, 2.4);
  h = plano(h, x, z, MONTE, 6, 5, 34.5);
  for (const M of MOLINOS) h = plano(h, x, z, M, 2.5, 3, ALTO_MOLINO.get(M));
  return h;
}
const ALTO_MOLINO = new Map(MOLINOS.map((M) => [M, relieve(...M)]));

/* los caminos de piedra clara: el centro y los que van a cada región */
const CAMINOS = [[SPAWN, PLAZA], [PLAZA, TIENDA], [PLAZA, [10, -2]], [PLAZA, [-10, -30]], [PLAZA, PROBADOR], [PLAZA, BARRIO],
  [[40, 4], [88, -14]], [[88, -14], [CIUDAD[0] - 44, CIUDAD[1]]],
  [[32, 34], [78, 76]], [[78, 76], [110, 108]],
  [[-16, 44], [-64, 78]], [[-64, 78], [-104, 112]],
  [[-24, -38], [-70, -70]], [[-70, -70], [-108, -96]],
  [[2, -48], [14, -96]], [[14, -96], [POZO[0] - 4, POZO[1] + 17]]];
function enCamino(x, z) {
  let m = Infinity;
  for (const [[ax, az], [bx, bz]] of CAMINOS) {
    const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz), t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (L * L)));
    if (Math.abs(x - ax - vx * t) > 12 || Math.abs(z - az - vz * t) > 12) continue;
    const ondula = Math.sin(t * L * 0.28 + ax) * 1.2;
    m = Math.min(m, Math.hypot(x - ax - vx * t - ondula * vz / L, z - az - vz * t + ondula * vx / L));
  }
  return m;
}
/* baldosas: la plaza, la explanada de la terminal y la ciudad */
const enTerminal = (x, z) => Math.abs(x - TERMINAL[0] - 3) < 21 && Math.abs(z - TERMINAL[1]) < 27;
const enCiudad = (x, z) => Math.hypot(x - CIUDAD[0], z - CIUDAD[1]) < 45;
/* el color de verdad del suelo (la textura de Rezona solo le pone el grano) */
const PASTO = [0.3, 0.7, 0.14], PASTO2 = [0.45, 0.8, 0.16], ARENA = [0.97, 0.9, 0.72], CAMINO = [0.86, 0.84, 0.78], ROCA = [0.62, 0.7, 0.66];
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function colorSuelo(x, z, h, pend) {
  const dp = Math.hypot(x - PLAZA[0], z - PLAZA[1]);
  if (dp < 10) { const anillo = Math.floor(dp / 2.5) % 2; return anillo ? [0.84, 0.88, 0.94, 1] : [0.55, 0.76, 0.94, 1]; }
  if (enTerminal(x, z) || enCiudad(x, z)) { const l = (Math.abs(((x + 400) % 3.2) - 1.6) > 1.45 || Math.abs(((z + 400) % 3.2) - 1.6) > 1.45) ? 0.8 : 0.92; return [l * 0.97, l, l * 1.04, 1]; }
  const cam = enCamino(x, z);
  if (cam < 1.7 && h > 0.8) return [...CAMINO, 0.9];
  if (h < 1.05) { const k = suaveEntre(-2.5, 1.0, h); return [...mezcla([0.8, 0.78, 0.62], ARENA, k), 1]; }
  if (pend > 0.3) return [...mezcla(ROCA, [0.72, 0.8, 0.74], suaveEntre(20, 34, h)), 0.4];
  if (h > 24) return [...mezcla([0.42, 0.72, 0.3], [0.6, 0.76, 0.5], suaveEntre(24, 34, h) * (0.6 + 0.4 * R2(x * 0.3, z * 0.3))), 0.2];
  const v = 0.9 + R2(x * 0.2, z * 0.2) * 0.15;
  let c = mezcla(PASTO, PASTO2, suaveEntre(-0.3, 0.5, R1(x * 0.05 + 9, z * 0.05)) * 0.8 + (h - 1.6) * 0.03).map((q) => q * v);
  /* la pradera más amarilla, el bosque más oscuro y azulado */
  c = mezcla(c, [0.55, 0.82, 0.2], expo(x, z, PRADERA, 70) * 0.6);
  c = mezcla(c, [0.16, 0.5, 0.2], expo(x, z, BOSQUE, 62) * 0.7);
  const borde = suaveEntre(1.05, 1.5, h);
  return [...mezcla(ARENA, c, borde), (1 - borde) * 0.8];
}
const hayPasto = (x, z) => {
  const h = alturaPlaza(x, z);
  return h > 1.2 && h < 28 && enCamino(x, z) > 2 && Math.hypot(x - PLAZA[0], z - PLAZA[1]) > 10.5 && !enTerminal(x, z) && !enCiudad(x, z) && Math.hypot(x - TIENDA[0], z - TIENDA[1]) > 8.5 && !CASAS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 6.5);
};

/* ---------------------------------------------------------------- los textos */
sumar({
  es: {
    zona_plaza: 'Plaza Central', zona_terminal: 'Terminal Aero', zona_ciudad: 'Ciudad de Vidrio', zona_bahia: 'Bahía del Faro', zona_pradera: 'Pradera de los Molinos', zona_bosque: 'Bosque de Hongos', zona_monte: 'Monte de la Cascada', zona_isla: 'La isla',
    mapa_titulo: 'AEROPLAZA · Mapa de la isla', mapa_aca: 'Estás acá', mapa_monorriel: 'Monorriel', mapa_ayuda: 'Tomá el monorriel en la terminal o en cualquier parada',
    accion_monorriel: 'Tomar el monorriel', accion_molino: 'Soplar el molino', accion_botella: 'Leer la botella', accion_mapa: 'Ver el mapa',
    tren_llega: 'El monorriel llega en {n} s', tren_arriba: '¡Al monorriel!', tren_proxima: 'Próxima: {n}', tren_parado: '{n} · usar para bajar', tren_espera: 'Esperá a que pare para bajar',
    botella_1: 'Una botella con un papel: «Si leés esto, saludá a alguien en el chat. Hoy es un buen día.»', botella_2: 'Una botella: «La cascada del monte no se congela nunca. Nadie sabe por qué.»', botella_3: 'Una botella: «Desde la glorieta del monte se ven todas las regiones.»',
    molino_sopla: '¡El molino gira!',
  },
  en: {
    zona_plaza: 'Central Plaza', zona_terminal: 'Aero Terminal', zona_ciudad: 'Glass City', zona_bahia: 'Lighthouse Bay', zona_pradera: 'Windmill Meadow', zona_bosque: 'Mushroom Forest', zona_monte: 'Waterfall Mountain', zona_isla: 'The island',
    mapa_titulo: 'AEROPLAZA · Island map', mapa_aca: 'You are here', mapa_monorriel: 'Monorail', mapa_ayuda: 'Take the monorail at the terminal or at any stop',
    accion_monorriel: 'Take the monorail', accion_molino: 'Blow the windmill', accion_botella: 'Read the bottle', accion_mapa: 'See the map',
    tren_llega: 'The monorail arrives in {n} s', tren_arriba: 'All aboard!', tren_proxima: 'Next: {n}', tren_parado: '{n} · use to get off', tren_espera: 'Wait for it to stop to get off',
    botella_1: 'A bottle with a note: “If you read this, say hi to someone in the chat. Today is a good day.”', botella_2: 'A bottle: “The mountain waterfall never freezes. Nobody knows why.”', botella_3: 'A bottle: “From the mountain gazebo you can see every region.”',
    molino_sopla: 'The windmill spins!',
  },
  pt: {
    zona_plaza: 'Praça Central', zona_terminal: 'Terminal Aero', zona_ciudad: 'Cidade de Vidro', zona_bahia: 'Baía do Farol', zona_pradera: 'Pradaria dos Moinhos', zona_bosque: 'Bosque dos Cogumelos', zona_monte: 'Monte da Cachoeira', zona_isla: 'A ilha',
    mapa_titulo: 'AEROPLAZA · Mapa da ilha', mapa_aca: 'Você está aqui', mapa_monorriel: 'Monotrilho', mapa_ayuda: 'Pegue o monotrilho no terminal ou em qualquer parada',
    accion_monorriel: 'Pegar o monotrilho', accion_molino: 'Soprar o moinho', accion_botella: 'Ler a garrafa', accion_mapa: 'Ver o mapa',
    tren_llega: 'O monotrilho chega em {n} s', tren_arriba: 'Todos a bordo!', tren_proxima: 'Próxima: {n}', tren_parado: '{n} · usar para descer', tren_espera: 'Espere parar para descer',
    botella_1: 'Uma garrafa com um bilhete: “Se você está lendo isto, dê oi para alguém no chat. Hoje é um bom dia.”', botella_2: 'Uma garrafa: “A cachoeira do monte nunca congela. Ninguém sabe por quê.”', botella_3: 'Uma garrafa: “Do coreto do monte dá para ver todas as regiões.”',
    molino_sopla: 'O moinho gira!',
  },
});

/* las zonas: para la música, el cartel al entrar y la misión de Brújula (de la más chica a la más grande) */
export const ZONAS = [
  { id: 'terminal', c: TERMINAL, r: 34, musica: 'ciudad', icono: '🚉' },
  { id: 'ciudad', c: CIUDAD, r: 58, musica: 'ciudad', icono: '🏙️' },
  { id: 'bahia', c: [Math.cos(BAHIA) * 162, Math.sin(BAHIA) * 162], r: 74, musica: 'playa', icono: '⛵' },
  { id: 'pradera', c: PRADERA, r: 70, musica: 'cielo', icono: '🌾' },
  { id: 'bosque', c: BOSQUE, r: 66, musica: 'bosque', icono: '🍄' },
  { id: 'monte', c: [MONTE[0], MONTE[1] + 14], r: 70, musica: 'bosque', icono: '⛰️' },
  { id: 'plaza', c: PLAZA, r: 90, musica: 'colina', icono: '⛲' },
];

/* ---------------------------------------------------------------- el mapa */
/* se dibuja una vez: el relieve, los caminos, el monorriel con sus paradas y los
   nombres. Lo usan el cartel del spawn y el mapa del menú (tecla 5) */
function dibujarIsla(A, via, paradas, L = 250) {
  const N = 256, img = new ImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N - 0.5) * 2 * L, z = (j / N - 0.5) * 2 * L, h = A(x, z), k = (j * N + i) * 4;
    let c;
    if (h < 0) { const f = Math.min(1, -h / 9); c = [120 - f * 70, 222 - f * 60, 245 - f * 20]; }
    else if (h < 1.05) c = [250, 238, 200];
    else if (enTerminal(x, z) || enCiudad(x, z)) c = [226, 234, 242];
    else if (h > 24) c = [200 + (h - 24) * 4, 214 + (h - 24) * 3, 205 + (h - 24) * 4];
    else { const e = Math.min(1, (h - 1) / 12), b = expo(x, z, BOSQUE, 62); c = [120 + e * 60 - b * 60, 208 + e * 20 - b * 50, 92 + e * 30 - b * 20]; }
    img.data.set([c[0], c[1], c[2], 255], k);
  }
  const base = document.createElement('canvas'); base.width = base.height = N; base.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(base, 0, 0, 512, 512);
  const P = (x, z) => [(x / (2 * L) + 0.5) * 512, (z / (2 * L) + 0.5) * 512];
  /* los caminos */
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3.2; g.lineCap = 'round';
  for (const [a, b] of CAMINOS) { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); }
  /* el monorriel */
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); via.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, ...P(p.x, p.z))); g.closePath(); g.stroke();
  g.strokeStyle = '#27b9e8'; g.lineWidth = 3; g.stroke();
  for (const q of paradas) { const [a, b] = P(q.p.x, q.p.z); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); g.fillStyle = '#27b9e8'; g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill(); }
  /* los nombres y los dibujitos */
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const Z of ZONAS) {
    const [a, b] = P(...Z.c);
    g.font = '26px sans-serif'; g.fillText(Z.icono, a, b - 12);
    g.font = '800 15px "Nunito","Segoe UI",system-ui,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = '#1b5f8f';
    const n = t('zona_' + Z.id); g.strokeText(n, a, b + 14); g.fillText(n, a, b + 14);
  }
  return { canvas: cv, L };
}
/* el cartel del spawn: título, el mapa, "estás acá" y una leyenda */
function lienzoCartel(mapa, aca) {
  const W = 1024, H = 734, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(1, '#d7eefc'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a78c2'; g.font = '900 44px "Nunito","Segoe UI",system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t('mapa_titulo'), 36, 48);
  const M = 624, x0 = 30, y0 = 92;
  g.save(); g.beginPath(); g.roundRect(x0, y0, M, M - 14, 26); g.clip(); g.drawImage(mapa.canvas, 0, 20, 512, 490, x0, y0, M, M - 14); g.restore();
  g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.beginPath(); g.roundRect(x0, y0, M, M - 14, 26); g.stroke();
  const ax = (aca[0] / (2 * mapa.L) + 0.5) * M + x0, az = ((aca[1] / (2 * mapa.L) + 0.5) * 512 - 20) / 490 * (M - 14) + y0;
  g.fillStyle = '#ff4f6e'; g.beginPath(); g.arc(ax, az, 13, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();
  g.font = '900 24px "Nunito","Segoe UI",system-ui,sans-serif'; g.lineWidth = 6; g.strokeStyle = '#fff'; g.fillStyle = '#e0304f'; g.strokeText(t('mapa_aca'), ax + 22, az - 20); g.fillText(t('mapa_aca'), ax + 22, az - 20);
  /* la leyenda */
  let y = 128;
  for (const Z of ZONAS) { g.font = '34px sans-serif'; g.fillStyle = '#000'; g.fillText(Z.icono, 680, y); g.font = '800 25px "Nunito","Segoe UI",system-ui,sans-serif'; g.fillStyle = '#20466a'; g.fillText(t('zona_' + Z.id), 728, y); y += 58; }
  g.strokeStyle = '#27b9e8'; g.lineWidth = 8; g.beginPath(); g.moveTo(684, y); g.lineTo(716, y); g.stroke(); g.fillStyle = '#20466a'; g.fillText(t('mapa_monorriel'), 728, y); y += 52;
  g.font = '700 21px "Nunito","Segoe UI",system-ui,sans-serif'; g.fillStyle = '#3a6f95';
  let lin = '';
  for (const w of t('mapa_ayuda').split(' ')) { if (g.measureText(lin + w).width > 300) { g.fillText(lin, 684, y); y += 30; lin = ''; } lin += w + ' '; }
  g.fillText(lin, 684, y);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  return tx;
}

/* ---------------------------------------------------------------- la cascada */
/* una cinta que baja por la ladera del monte al pozo, con rayas que corren, la
   espuma abajo y el rocío */
function cascada(A, desde, hasta, ancho = 5) {
  const g = new THREE.Group(), N = 40, pos = [], uv = [], idx = [];
  const d = new THREE.Vector2(hasta[0] - desde[0], hasta[1] - desde[1]), L = d.length(); d.normalize();
  const n = new THREE.Vector2(-d.y, d.x);
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = desde[0] + d.x * L * u, z = desde[1] + d.y * L * u, y = Math.max(0.05, A(x, z) + 0.35), w = ancho * (0.8 + 0.4 * u);
    for (const s of [-1, 1]) { pos.push(x + n.x * w / 2 * s, y, z + n.y * w / 2 * s); uv.push((s + 1) / 2, u); }
    if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: UNI.uT },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uT; varying vec2 vUv;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float col = floor(vUv.x * 26.0);
        float v = fract(vUv.y * (4.0 + h(col) * 3.0) - uT * (1.1 + h(col + 7.0) * 0.9) + h(col + 3.0));
        float raya = smoothstep(0.0, 0.3, v) * smoothstep(1.0, 0.5, v);
        float borde = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        vec3 c = mix(vec3(0.5, 0.92, 1.0), vec3(1.0), raya * 0.85);
        gl_FragColor = vec4(c * 1.2, (0.45 + raya * 0.5) * borde);
      }`,
  });
  const cinta = new THREE.Mesh(geo, mat); cinta.renderOrder = 3; g.add(cinta);
  const esp = new THREE.Mesh(new THREE.CircleGeometry(ancho * 0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
  esp.position.set(hasta[0], 0.06, hasta[1]); g.add(esp);
  const nR = 80, rg = new THREE.BufferGeometry(), rp = new Float32Array(nR * 3), rv = [];
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  for (let i = 0; i < nR; i++) rv.push({ t: Math.random(), a: Math.random() * 6.28, v: 1 + Math.random() * 2 });
  const rocio = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.5, map: puntoSuave(), transparent: true, depthWrite: false, opacity: 0.75 }));
  rocio.frustumCulled = false; g.add(rocio);
  g.userData.actualizar = (tt, dt) => {
    esp.scale.setScalar(1 + Math.sin(tt * 3) * 0.08);
    rv.forEach((q, i) => { q.t += dt * 0.8; if (q.t > 1) { q.t = 0; q.a = Math.random() * 6.28; q.v = 1 + Math.random() * 2; } const r = 1 + q.t * q.v * 2; rp[i * 3] = hasta[0] + Math.cos(q.a) * r; rp[i * 3 + 1] = Math.sin(q.t * Math.PI) * q.v * 1.2; rp[i * 3 + 2] = hasta[1] + Math.sin(q.a) * r; });
    rg.attributes.position.needsUpdate = true;
  };
  return g;
}

/* ---------------------------------------------------------------- la isla */
export function crearPlaza(ctx) {
  const A = alturaPlaza;
  const mundo = new Mundo(A); mundo.agua = 0; mundo.limite = 292;
  const g = new THREE.Group();
  const Q = ctx.calidad;
  g.add(terreno(A, { tam: 580, seg: Q.pasto > 0.5 ? 320 : 220, color: colorSuelo, apretar: 0.45 }));
  const mar = agua(0, A, { rect: [-290, -290, 580] }); g.add(mar);
  g.add(pasto(A, hayPasto, { n: Math.round(16000 * Q.pasto), area: [-245, -245, 490] }));
  g.add(flores(A, (x, z) => hayPasto(x, z) && R2(x * 0.06 + 3, z * 0.06) > 0.1, { n: Math.round(2600 * Math.max(0.4, Q.pasto)), area: [-230, -230, 460] }));
  /* los campos de flores de la pradera, tupidos */
  g.add(flores(A, (x, z) => hayPasto(x, z) && R3(x * 0.05, z * 0.05) > -0.1, { n: Math.round(1800 * Math.max(0.4, Q.pasto)), area: [PRADERA[0] - 60, PRADERA[1] - 55, 120], sem: 33, colores: ['#ffffff', '#fff27a', '#ffd1ec', '#ffb0b0', '#fff6c2'] }));

  /* ------------------------------------------------ los árboles, por región */
  const r = azar(41), arb = [], rosa = [], pal = [], pie = [];
  const libre = (x, z, lista, d) => !lista.some(([ax, az]) => Math.abs(ax - x) < d && Math.abs(az - z) < d && Math.hypot(ax - x, az - z) < d);
  const lejosDeTodo = (x, z) => enCamino(x, z) > 3.5 && !enTerminal(x, z) && !enCiudad(x, z) && Math.hypot(x - LAGO[0], z - LAGO[1]) > 20 && Math.hypot(x - HUERTA[0], z - HUERTA[1]) > 9 && Math.hypot(x - BARRIO[0], z - BARRIO[1]) > 18 && Math.hypot(x - POZO[0], z - POZO[1]) > 18 && Math.hypot(x - CARTEL[0], z - CARTEL[1]) > 8;
  const sembrar = (n, cx, cz, R, dmin, lista, esc = [0.8, 0.6], prueba = () => true) => {
    for (let i = 0, k = 0; i < n * 8 && k < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!hayPasto(x, z) || !lejosDeTodo(x, z) || !prueba(x, z) || !libre(x, z, arb, dmin) || !libre(x, z, rosa, dmin)) continue;
      lista.push([x, z, esc[0] + r() * esc[1]]); k++;
    }
  };
  /* lejos de la vía del monorriel (se calcula antes de tenerla: los puntos de la vuelta) */
  const VIA = [[-62, -40], [-62, -12], [-62, 14], [-62, 40], [-62, 68], [-72, 96], [-96, 114], [-60, 130], [-10, 138], [40, 132], [86, 112], [122, 82], [150, 40], [168, -12], [160, -62], [128, -94], [80, -106], [30, -108], [-20, -104], [-62, -96], [-90, -76], [-80, -54]];
  const lejosDeVia = (x, z) => VIA.every(([ax, az], i) => { const [bx, bz] = VIA[(i + 1) % VIA.length], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - ax - vx * t, z - az - vz * t) > 6; });
  sembrar(46, 0, 0, 66, 5, arb, [0.8, 0.6], (x, z) => Math.hypot(x, z) > 20);
  sembrar(170, BOSQUE[0], BOSQUE[1], 62, 4.2, arb, [0.9, 0.8], lejosDeVia);
  sembrar(40, BOSQUE[0], BOSQUE[1], 62, 4.2, rosa, [0.9, 0.6], lejosDeVia);
  sembrar(22, PRADERA[0], PRADERA[1], 70, 9, arb, [0.8, 0.5], (x, z) => lejosDeVia(x, z) && MOLINOS.every(([mx, mz]) => Math.hypot(x - mx, z - mz) > 16));
  sembrar(44, MONTE[0], MONTE[1] + 20, 70, 5.5, arb, [0.8, 0.5], (x, z) => A(x, z) < 22 && lejosDeVia(x, z));
  sembrar(30, CIUDAD[0] - 60, CIUDAD[1] + 30, 40, 6, rosa, [0.8, 0.4], lejosDeVia);
  sembrar(60, 0, 0, 200, 8, arb, [0.8, 0.6], (x, z) => Math.hypot(x, z) > 80 && lejosDeVia(x, z));
  /* la huerta: árboles de fruta en fila */
  const huerta = [];
  for (let i = 0; i < 6; i++) { const x = HUERTA[0] - 7 + (i % 3) * 7, z = HUERTA[1] - 3 + Math.floor(i / 3) * 7; huerta.push([x, z, 1.0]); }
  /* hasta dónde van con detalle: menos en las calidades bajas */
  const dA = 50 * (0.6 + 0.4 * Q.pasto);
  g.add(arboles(A, [...arb, ...huerta], { dist: dA }));
  g.add(arboles(A, rosa, { variante: 'arbolRosa', tintes: ['#ffffff', '#ffe6f4', '#fff2fa'], dist: dA }));
  for (const [x, z, e] of [...arb, ...huerta, ...rosa]) mundo.cilindro(x, z, 0.35 * e, A(x, z) - 1, A(x, z) + 2.4 * e);
  /* las palmeras en la playa de toda la isla (más en la bahía) y en la ciudad */
  for (let i = 0; i < 700 && pal.length < 90; i++) {
    const a = r() * 6.28, cst = costaEn(a), d = cst - 26 + r() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d, h = A(x, z);
    if (h < 0.25 || h > 1.6 || Math.hypot(x - MONTE[0], z - MONTE[1]) < 70 || !lejosDeVia(x, z)) continue;
    if (!libre(x, z, pal, 7)) continue;
    pal.push([x, z, 0.9 + r() * 0.4, Math.atan2(-z, x) + Math.PI + (r() - 0.5)]);
  }
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + 0.3, x = CIUDAD[0] + Math.cos(a) * 17, z = CIUDAD[1] + Math.sin(a) * 17; pal.push([x, z, 0.85, a * 3]); }
  g.add(palmeras(A, pal, { dist: dA * 1.1 }));
  for (const [x, z] of pal) mundo.cilindro(x, z, 0.3, A(x, z) - 1, A(x, z) + 5);
  for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = 12 + r() * 200, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!lejosDeTodo(x, z) || Math.hypot(x - PLAZA[0], z - PLAZA[1]) < 12 || A(x, z) < 0.6 || !lejosDeVia(x, z)) continue; pie.push([x, z, 0.4 + r() * 1.3]); }
  pie.push([LAGO[0] - 13, LAGO[1] + 6, 1.6], [LAGO[0] + 12, LAGO[1] - 8, 2], [LAGO[0] + 4, LAGO[1] + 14, 1.3], [POZO[0] - 12, POZO[1] + 4, 2.2], [POZO[0] + 11, POZO[1] + 6, 1.8], [FARO[0] + 6, FARO[1] - 5, 1.6], [FARO[0] - 7, FARO[1] + 3, 1.3]);
  g.add(piedras(A, pie));
  for (const [x, z, e] of pie) if (e > 0.7) mundo.cilindro(x, z, e * 0.85, A(x, z) - 2, A(x, z) + e * 0.55);

  /* ------------------------------------------------ el centro de siempre */
  const tienda = tiendaAfuera(mundo, TIENDA[0], TIENDA[1], -Math.PI * 0.8, A(...TIENDA)); g.add(tienda);
  const prob = probadorCabina(mundo, PROBADOR[0], PROBADOR[1], Math.PI * 0.85, A(...PROBADOR)); g.add(prob);
  /* los faroles y los bancos de toda la isla se juntan y se arman al final (una llamada para todos) */
  const lugFaroles = [], lugBancos = [];
  const ponFarol = (x, z) => lugFaroles.push([x, z, A(x, z)]);
  const ponBanco = (x, z, rot) => lugBancos.push([x, z, A(x, z), rot]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; ponFarol(PLAZA[0] + Math.cos(a) * 10.6, PLAZA[1] + Math.sin(a) * 10.6); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6; ponBanco(PLAZA[0] + Math.cos(a) * 8, PLAZA[1] + Math.sin(a) * 8, -a - Math.PI / 2); }
  const fuente = new THREE.Group(); fuente.position.set(PLAZA[0], A(...PLAZA), PLAZA[1]);
  const MF = modelo('fuente', { ancho: 7.4 }); fuente.add(MF);
  g.add(fuente);
  mundo.cilindro(PLAZA[0], PLAZA[1], 3.4, A(...PLAZA) - 1, A(...PLAZA) + MF.userData.borde, { tipo: 'piedra' });
  mundo.cilindro(PLAZA[0], PLAZA[1], 0.7, A(...PLAZA), A(...PLAZA) + MF.userData.tam.y);
  let puertaCasa = null;
  CASAS.forEach(([x, z], i) => {
    const y = A(x, z), rot = Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
    const c = modelo('casa', { ancho: i === 1 ? 10.5 : 9 });
    c.position.set(x, y - 0.05, z); c.rotation.y = rot; g.add(c);
    const T = c.userData.tam;
    mundo.caja(x, z, T.x * 0.44, T.z * 0.44, y - 1, y + T.y * 0.92, rot, { tipo: 'piedra' });
    if (i === 1) {
      puertaCasa = new THREE.Vector3(x + Math.sin(rot) * (T.z / 2 + 0.9), y, z + Math.cos(rot) * (T.z / 2 + 0.9));
      const cartel = letrero('🏠', { ancho: 1.4, alto: 0.9, tinta: '#1a78c2', borde: '#7fd3ff', tam: 150 }); cartel.position.set(x + Math.sin(rot) * (T.z / 2 + 0.3), y + T.y * 0.62, z + Math.cos(rot) * (T.z / 2 + 0.3)); cartel.rotation.y = rot; g.add(cartel);
    }
  });
  const globo = globoCascada(LAGO[0], 17, LAGO[1], 5.2, 0); g.add(globo);
  const peceras = [[8, -1], [-15, 9], [27, 6], [-2, -20]].map(([x, z], i) => { const p = pecera(x, A(x, z), z, 0.9 + (i % 2) * 0.35); g.add(p); mundo.cilindro(x, z, 1.2, A(x, z) - 1, A(x, z) + 0.5 + (0.9 + (i % 2) * 0.35) * 2); return p; });

  /* ------------------------------------------------ la terminal y el spawn */
  const yT = A(...TERMINAL);
  const term = modelo('terminal'); term.position.set(TERMINAL[0], yT, TERMINAL[1]); g.add(term);
  {
    const U = term.userData, HA = U.anden, W = U.ancho, Lg = U.largo, [x, z] = TERMINAL;
    /* los andenes se pisan; las mamparas, las paredes de vidrio (menos la entrada) y la escalinata */
    for (const s of [-1, 1]) {
      mundo.caja(x + s * (W / 4 + 0.85), z, W / 4 - 0.85, Lg / 2, yT - 1, yT + HA, 0, { tipo: 'piedra' });
      mundo.caja(x + s * 1.85, z, 0.12, Lg / 2 - 0.8, yT + HA, yT + HA + 1.45, 0);
    }
    mundo.caja(x - W / 2 + 0.5, z, 0.25, Lg / 2, yT + HA, yT + HA + 3.4, 0);
    for (const s of [-1, 1]) mundo.caja(x + W / 2 - 0.5, z + s * (3.8 + (Lg / 2 - 3.8) / 2), 0.25, (Lg / 2 - 3.8) / 2, yT + HA, yT + HA + 3.4, 0);
    for (const [ex, eh] of U.escalones) mundo.caja(x + ex, z, 0.31, 4, yT - 1, yT + eh, 0, { tipo: 'piedra' });
    mundo.cilindro(x - 8.4, z + 8, 1.45, yT + HA, yT + HA + 1.2);
  }
  const reloj = { h: term.userData.agujaH, m: term.userData.agujaM };
  /* el cartel del mapa (se dibuja cuando está la vía) */
  const cartel = modelo('cartelMapa'); const yC = A(...CARTEL);
  cartel.position.set(CARTEL[0], yC, CARTEL[1]); cartel.rotation.y = Math.atan2(SPAWN[0] + 3 - CARTEL[0], SPAWN[1] - CARTEL[1]); g.add(cartel);
  { const a = cartel.rotation.y; mundo.caja(CARTEL[0] + Math.sin(a) * 0.6, CARTEL[1] + Math.cos(a) * 0.6, 2.6, 0.8, yC - 1, yC + 0.6, a, { tipo: 'piedra' }); for (const s of [-1, 1]) mundo.cilindro(CARTEL[0] + Math.cos(a) * s * 2.35, CARTEL[1] - Math.sin(a) * s * 2.35, 0.15, yC, yC + 4.8); }
  ponFarol(SPAWN[0] + 2, SPAWN[1] + 6); ponFarol(SPAWN[0] + 2, SPAWN[1] - 7);

  /* ------------------------------------------------ el monorriel */
  const bajadaTerminal = new THREE.Vector3(TERMINAL[0] + 3.4, yT + 1.0, TERMINAL[1] + 2);
  const mono = new Monorriel(mundo, A, VIA, [
    { id: 'terminal', en: [TERMINAL[0] + 10, TERMINAL[1]], bajada: bajadaTerminal },
    { id: 'pradera', en: PRADERA }, { id: 'bahia', en: [110, 110] }, { id: 'ciudad', en: CIUDAD }, { id: 'monte', en: [POZO[0] - 30, POZO[1] + 6] }, { id: 'bosque', en: BOSQUE },
  ].map((q) => ({ ...q, nombre: t('zona_' + q.id) })), { x: TERMINAL[0], z0: TERMINAL[1] - 22, z1: TERMINAL[1] + 22, y: yT + 0.2 });
  g.add(mono.g);
  const mapa = dibujarIsla(A, mono.P.filter((_, i) => i % 6 === 0), mono.paradas);
  cartel.userData.pantalla.material = new THREE.MeshBasicMaterial({ map: lienzoCartel(mapa, SPAWN), toneMapped: false });

  /* ------------------------------------------------ la ciudad de vidrio */
  const yCi = A(...CIUDAD);
  const pab = pabellon(mundo, CIUDAD[0], CIUDAD[1], Math.PI, yCi); g.add(pab);
  HOTELES.forEach(([x, z, ancho], i) => {
    const h = modelo('hotel', { ancho });
    h.position.set(x, A(x, z) - 0.1, z); h.rotation.y = Math.atan2(CIUDAD[0] - x, CIUDAD[1] - z) + (i % 2 ? 0.4 : -0.3); g.add(h);
    mundo.cilindro(x, z, ancho * 0.26, A(x, z) - 2, A(x, z) + h.userData.tam.y, { tipo: 'piedra' });
  });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ponFarol(CIUDAD[0] + Math.cos(a) * 22, CIUDAD[1] + Math.sin(a) * 22); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.25; ponBanco(CIUDAD[0] + Math.cos(a) * 12.5, CIUDAD[1] + Math.sin(a) * 12.5, -a - Math.PI / 2); }
  for (const [x, z] of [[CIUDAD[0] - 36, CIUDAD[1] - 8], [CIUDAD[0] - 20, CIUDAD[1] + 30]]) { const f = modelo('fuente', { ancho: 5 }); f.position.set(x, A(x, z), z); g.add(f); mundo.cilindro(x, z, 2.3, A(x, z) - 1, A(x, z) + f.userData.borde, { tipo: 'piedra' }); }

  /* ------------------------------------------------ la bahía del faro */
  const u = [Math.cos(BAHIA), Math.sin(BAHIA)];
  let r0 = 130; while (r0 < 230 && A(u[0] * r0, u[1] * r0) > 1.0) r0 += 0.5;
  const MU = modelo('muelle'), rotMu = Math.atan2(u[0], u[1]), mx0 = u[0] * r0, mz0 = u[1] * r0;
  MU.position.set(mx0, 0, mz0); MU.rotation.y = rotMu; g.add(MU);
  {
    const Lm = MU.userData.largo, Y = MU.userData.cubierta, F = MU.userData.fin;
    mundo.caja(mx0 + u[0] * Lm / 2, mz0 + u[1] * Lm / 2, MU.userData.ancho / 2, Lm / 2, -3, Y, rotMu, { tipo: 'madera' });
    mundo.caja(mx0 + u[0] * (Lm + F / 2), mz0 + u[1] * (Lm + F / 2), F / 2, F / 2, -3, Y, rotMu, { tipo: 'madera' });
  }
  const finMuelle = [mx0 + u[0] * (MU.userData.largo + 3), mz0 + u[1] * (MU.userData.largo + 3)];
  const faro = modelo('faro', { alto: 17 }); const yF = A(...FARO);
  faro.position.set(FARO[0], yF - 0.2, FARO[1]); faro.rotation.y = rotMu + Math.PI; g.add(faro);
  mundo.cilindro(FARO[0], FARO[1], 2.3, yF - 2, yF + 14);
  const velero = modelo('velero'); const vPos = [mx0 + u[0] * 30 - u[1] * 18, mz0 + u[1] * 30 + u[0] * 18];
  velero.position.set(vPos[0], 0, vPos[1]); velero.rotation.y = rotMu + 1.2; g.add(velero);
  mundo.caja(vPos[0], vPos[1], 0.9, 2.5, -2, 1.0, velero.rotation.y);
  for (let i = 0; i < 9; i++) {
    const a = BAHIA + (i - 4) * 0.075, rr = costaEn(a) - 10 - (i % 2) * 3, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.hypot(x - mx0, z - mz0) < 6) continue;
    const som = modelo(i % 3 ? 'sombrilla' : 'sombrillaRosa', { alto: 3 }); som.position.set(x, A(x, z) - 0.1, z); som.rotation.z = (i % 2 - 0.5) * 0.12; g.add(som);
    mundo.cilindro(x, z, 0.1, A(x, z), A(x, z) + 2.6);
    for (const s of [-1, 1]) { const rp = modelo('reposera', { alto: 0.9 }), px = x + s * 1.1 * Math.cos(a + 1.57), pz = z + s * 1.1 * Math.sin(a + 1.57); rp.position.set(px, A(px, pz), pz); rp.rotation.y = rotMu; g.add(rp); }
  }
  { const a = BAHIA + 0.42, rr = costaEn(a) - 14, x = Math.cos(a) * rr, z = Math.sin(a) * rr; const gv = modelo('guardavidas', { alto: 6.3 }); gv.position.set(x, A(x, z), z); gv.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); g.add(gv); mundo.caja(x, z, 1.2, 1.2, A(x, z) - 1, A(x, z) + 3.2, gv.rotation.y); }

  /* ------------------------------------------------ la pradera de los molinos */
  const molinos = MOLINOS.map(([x, z], i) => {
    const m = modelo('molino', { alto: 30 + (i % 3) * 3 }); const y = A(x, z);
    m.position.set(x, y - 0.2, z); m.rotation.y = Math.atan2(-0.82, -0.57); g.add(m);
    mundo.cilindro(x, z, 0.75, y - 1, y + m.userData.tam.y * 0.6);
    return { m, rotor: m.userData.rotor, vel: 0.25 + (i % 2) * 0.1, extra: 0, clave: 'molino' + i, pos: new THREE.Vector3(x + 1.6, y, z + 1.2) };
  });

  /* ------------------------------------------------ el bosque de hongos */
  const hongos = [];
  const rh = azar(17), CA = [BOSQUE[0] + 18, BOSQUE[1] - 10];
  for (let i = 0, k = 0; i < 200 && k < 12; i++) {
    const a = rh() * 6.28, d = 8 + Math.sqrt(rh()) * 48, x = BOSQUE[0] + Math.cos(a) * d, z = BOSQUE[1] + Math.sin(a) * d;
    if (!hayPasto(x, z) || !libre(x, z, arb, 4.5) || !libre(x, z, rosa, 4.5) || !libre(x, z, hongos.map((q) => [q.x, q.z]), 7) || Math.hypot(x - CA[0], z - CA[1]) < 12 || !lejosDeVia(x, z)) continue;
    const esc = 1.1 + (k % 4) * 0.35, m = modelo('hongo', { escala: esc }), y = A(x, z);
    m.position.set(x, y - 0.1, z); m.rotation.y = rh() * 6; g.add(m);
    const tope = y - 0.1 + m.userData.tope, R = m.userData.radio;
    const H = { x, z, m, t: 9, clave: 'hongo' + k };
    mundo.cilindro(x, z, 0.5 * esc, y - 1, tope - 0.6);
    mundo.cilindro(x, z, R * 0.82, tope - 0.5, tope, { rebote: 13 + esc * 2, sinTecho: true, clave: H.clave, alRebotar: () => { H.t = 0; } });
    hongos.push(H); k++;
  }
  const casaArbol = modelo('casaArbol'), yCA = A(...CA);
  casaArbol.position.set(CA[0], yCA - 0.1, CA[1]); casaArbol.rotation.y = 0.6; g.add(casaArbol);
  {
    const U = casaArbol.userData, YP = yCA - 0.1 + U.plataforma, c = Math.cos(0.6), s = Math.sin(0.6), w = (lx, lz) => [CA[0] + lx * c + lz * s, CA[1] - lx * s + lz * c];
    mundo.cilindro(CA[0], CA[1], 1.2, yCA - 1, YP - 0.3);
    mundo.cilindro(CA[0], CA[1], 3.7, YP - 0.3, YP, { tipo: 'madera' });
    const [hx, hz] = w(-1.2, -1.3); mundo.cilindro(hx, hz, 1.75, YP, YP + 3.8);
    for (const [ex, ez, ey, er] of U.escalones) { const [wx, wz] = w(ex, ez); mundo.caja(wx, wz, 0.66, 0.32, ey - 0.3, yCA - 0.1 + ey, er + 0.6, { tipo: 'madera' }); }
  }

  /* ------------------------------------------------ el monte y la cascada */
  const yM = A(...MONTE);
  const glor = modelo('glorieta', { ancho: 8 }); glor.position.set(MONTE[0], yM, MONTE[1]); g.add(glor);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mundo.cilindro(MONTE[0] + Math.sin(a) * 3.3, MONTE[1] + Math.cos(a) * 3.3, 0.2, yM, yM + 3.6); }
  mundo.cilindro(MONTE[0], MONTE[1], 4.1, yM - 1, yM + 0.4, { tipo: 'piedra' });
  const dirC = [MONTE[0] - POZO[0], MONTE[1] - POZO[1]], lc = Math.hypot(...dirC);
  const casc = cascada(A, [POZO[0] + dirC[0] / lc * 19, POZO[1] + dirC[1] / lc * 19], [POZO[0] + dirC[0] / lc * 3, POZO[1] + dirC[1] / lc * 3], 5.5); g.add(casc);

  /* bancos para mirar: en el muelle, la pradera, el pozo y la bahía */
  ponBanco(PRADERA[0] + 8, PRADERA[1] - 14, 2.4); ponBanco(PRADERA[0] + 14, PRADERA[1] - 4, 1.6);
  ponBanco(POZO[0] - 16, POZO[1] + 12, -2.3); ponBanco(POZO[0] + 16, POZO[1] + 12, 2.3);
  ponBanco(SPAWN[0] + 6, SPAWN[1] + 9, Math.PI); ponBanco(SPAWN[0] + 6, SPAWN[1] - 10, 0);
  /* faroles a lo largo de los caminos largos, de un lado y del otro */
  CAMINOS.slice(6).forEach(([[ax, az], [bx, bz]], j) => {
    const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 12; d < L - 6; d += 26) { const t = d / L, s2 = (Math.floor(d / 26) + j) % 2 ? 1 : -1, x = ax + (bx - ax) * t + nx * 3.2 * s2, z = az + (bz - az) * t + nz * 3.2 * s2; if (A(x, z) > 0.8 && enCamino(x, z) > 1.6) ponFarol(x, z); }
  });
  const faroles = hacerFaroles(mundo, lugFaroles); g.add(faroles);
  g.add(hacerBancos(mundo, lugBancos));

  /* ------------------------------------------------ las botellas con mensaje */
  const botellas = [[BAHIA - 0.33, 3], [2.55, 6], [-0.55, 4]].map(([a, ad], i) => {
    const rr = costaEn(a) - ad, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = Math.max(0.1, A(x, z));
    const m = modelo('botella', { alto: 0.34 }); m.position.set(x, y + 0.05, z); m.rotation.y = i * 2; g.add(m);
    return { m, p: new THREE.Vector3(x, y, z), clave: 'botella' + i, texto: 'botella_' + (i + 1) };
  });

  /* ------------------------------------------------ las cosas vivas */
  const orbLug = [];
  const anillo = (cx, cz, rr, n, dy = 0.9) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; orbLug.push([x, Math.max(0.2, A(x, z)) + dy, z]); } };
  const linea = ([ax, az], [bx, bz], n, dy = 0.9) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; orbLug.push([x, Math.max(0.2, A(x, z)) + dy, z]); } };
  anillo(PLAZA[0], PLAZA[1], 14, 14); linea(SPAWN, PLAZA, 8); anillo(LOMA[0], LOMA[1], 4, 10, 1.2);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; orbLug.push([LAGO[0] + Math.cos(a) * 9, 0.9, LAGO[1] + Math.sin(a) * 9]); }
  anillo(CIUDAD[0], CIUDAD[1], 26, 16); anillo(PRADERA[0], PRADERA[1], 22, 12); anillo(BOSQUE[0], BOSQUE[1], 30, 14);
  linea([mx0, mz0], finMuelle, 8, 2.2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 5, rr = 44 - i * 2.4, x = MONTE[0] + Math.cos(a) * rr, z = MONTE[1] + 12 + Math.sin(a) * rr; orbLug.push([x, A(x, z) + 1, z]); }
  const orbes = new Orbes(g, orbLug);
  const mariposas = new Mariposas(g, [[-8, A(-8, 24), 24, 6], [-24, A(-24, -6), -6, 7], [22, A(22, 12), 12, 6], [HUERTA[0], A(...HUERTA), HUERTA[1], 8], [-40, A(-40, 4), 4, 6],
    [PRADERA[0], A(...PRADERA), PRADERA[1], 16], [PRADERA[0] + 30, A(PRADERA[0] + 30, PRADERA[1] - 20), PRADERA[1] - 20, 12], [BOSQUE[0], A(...BOSQUE), BOSQUE[1], 14]], 40);
  const cardumenes = [new Cardumen(g, new THREE.Vector3(LAGO[0], 12, LAGO[1]), { radio: 13, n: 22 }), new Cardumen(g, new THREE.Vector3(-10, 9, -5), { radio: 20, n: 18, colores: ['#3fd0ff', '#ffffff', '#7ff6ff'], vel: -0.18, largo: 0.45 }),
    new Cardumen(g, new THREE.Vector3(finMuelle[0] - 8, -1.6, finMuelle[1] - 4), { radio: 12, n: 26, alto: 1.2 })];
  const burbujas = new Burbujas(g, [[LAGO[0], 0, LAGO[1], 16, 0], [PLAZA[0], A(...PLAZA) + 2.3, PLAZA[1], 1.2], [POZO[0], 0, POZO[1], 9, 0]], { n: 90, alto: 16, tam: [0.15, 0.75] });
  const medusas = new Medusas(g, [[LAGO[0] - 7, 5, LAGO[1] + 3, 2, 2.5], [LAGO[0] + 8, 8, LAGO[1] - 5, 1.7, 2], [LAGO[0] + 2, 3.5, LAGO[1] + 9, 1.5, 2], [LAGO[0] - 3, 10, LAGO[1] - 8, 2.3, 3], [LAGO[0] + 12, 4.5, LAGO[1] + 6, 1.4, 2], [LAGO[0] - 10, 8, LAGO[1] - 4, 1.6, 2],
    [FARO[0] - 14, 3, FARO[1] - 10, 1.8, 2], [FARO[0] + 10, 5, FARO[1] - 16, 1.5, 2]]);
  const frutasLug = [];
  huerta.forEach(([x, z], i) => { const y = A(x, z); const tipos = ['frutilla', 'arandano', 'lima', 'dorada', 'uva', 'frutilla']; for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; frutasLug.push([x + Math.cos(a) * 1.6, y + 2.6 + (k % 2) * 0.8, z + Math.sin(a) * 1.6, tipos[(i + k) % tipos.length]]); } });
  const frutas = new Frutas(g, frutasLug);

  /* discos escondidos (cada reino tiene los suyos) */
  const discos = [
    { id: 'disco-loma', p: new THREE.Vector3(LOMA[0], A(...LOMA) + 1.3, LOMA[1]), cancion: 'colina' },
    { id: 'disco-lago', p: new THREE.Vector3(LAGO[0] + 13, A(LAGO[0] + 12, LAGO[1] - 8) + 2.2, LAGO[1] - 8), cancion: 'arrecife' },
    { id: 'disco-faro', p: new THREE.Vector3(FARO[0] - 3.5, yF + 1.2, FARO[1] - 3.5), cancion: 'playa' },
    { id: 'disco-arbol', p: new THREE.Vector3(CA[0] + 2.2, yCA - 0.1 + casaArbol.userData.plataforma + 1.1, CA[1] + 1.2), cancion: 'bosque' },
    { id: 'disco-cumbre', p: new THREE.Vector3(MONTE[0], yM + 1.4, MONTE[1]), cancion: 'cielo' },
    { id: 'disco-ciudad', p: new THREE.Vector3(CIUDAD[0], yCi + pab.userData.anden + 1.2, CIUDAD[1]), cancion: 'ciudad' },
  ].map((d) => { const m = discoMalla(); m.position.copy(d.p); g.add(m); return { ...d, malla: m }; });

  /* la gente del lugar (NPC): dónde está cada uno. Las misiones están en misiones.js */
  const npcs = [
    { id: 'nimbo', pos: [PLAZA[0] + 4, PLAZA[1] + 5.5], rot: Math.PI * 1.2 },
    { id: 'lima', pos: [HUERTA[0] + 3, HUERTA[1] + 8], rot: Math.PI },
    { id: 'burbu', pos: [LAGO[0] - 9, LAGO[1] - 10], rot: 0.7 },
    { id: 'vendedora', pos: [TIENDA[0] - 5, TIENDA[1] - 7], rot: -0.6 },
    { id: 'brujula', pos: [CARTEL[0] + 2.5, CARTEL[1] + 3.2], rot: -1.9 },
    { id: 'brisa', pos: [PRADERA[0] + 12, PRADERA[1] - 10], rot: 0.8 },
    { id: 'musgo', pos: [CA[0] - 6, CA[1] + 5], rot: 2.2 },
    { id: 'marea', pos: [mx0 - u[0] * 3 + u[1] * 2.5, mz0 - u[1] * 3 - u[0] * 2.5], rot: rotMu },
  ].map((n) => ({ ...n, y: A(n.pos[0], n.pos[1]) }));

  /* lo interactivo */
  for (const p of term.userData.maquinas) mundo.interactivo({ id: 'tren', pos: p.clone().add(new THREE.Vector3(TERMINAL[0], yT, TERMINAL[1])), radio: 2.2, accion: 'viajar', icono: '🚆' });
  for (const s of [-1, 1]) for (const dz of [-6, 6]) mundo.interactivo({ id: 'monorriel', parada: 0, pos: new THREE.Vector3(TERMINAL[0] + s * 2.6, yT + 1.0, TERMINAL[1] + dz), radio: 3.2, accion: 'monorriel', icono: '🚝' });
  mono.paradas.forEach((q, k) => { if (!q.terminal) mundo.interactivo({ id: 'monorriel', parada: k, pos: q.puerta, radio: 3, accion: 'monorriel', icono: '🚝' }); });
  mundo.interactivo({ id: 'tienda', pos: tienda.userData.puerta, radio: 2.4, accion: 'entrar_tienda', icono: '🛍️' });
  if (puertaCasa) mundo.interactivo({ id: 'mi_casa', pos: puertaCasa, radio: 2.8, accion: 'mi_casa', icono: '🏠' });
  mundo.interactivo({ id: 'probador', pos: new THREE.Vector3(PROBADOR[0], A(...PROBADOR), PROBADOR[1]), radio: 2.4, accion: 'probador', icono: '👕' });
  mundo.interactivo({ id: 'fuente', pos: new THREE.Vector3(PLAZA[0], A(...PLAZA) + 0.7, PLAZA[1]), radio: 4.2, accion: 'burbuja', icono: '🫧' });
  const frenteCartel = new THREE.Vector3(CARTEL[0] + Math.sin(cartel.rotation.y) * 2.2, yC, CARTEL[1] + Math.cos(cartel.rotation.y) * 2.2);
  mundo.interactivo({ id: 'mapa', pos: frenteCartel, radio: 2.6, accion: 'mapa', icono: '🗺️' });
  for (const M of molinos) mundo.interactivo({ id: 'molino', clave: M.clave, molino: M, pos: M.pos, radio: 2.6, accion: 'molino', icono: '🌬️' });
  for (const B of botellas) mundo.interactivo({ id: 'botella', clave: B.clave, texto: B.texto, pos: B.p, radio: 1.8, accion: 'botella', icono: '🍾' });

  /* se llega por la terminal: se aparece al pie de la escalinata, mirando a la plaza */
  const inicio = new THREE.Vector3(SPAWN[0], A(...SPAWN) + 0.1, SPAWN[1]), rumboInicio = Math.atan2(PLAZA[0] - SPAWN[0], PLAZA[1] - SPAWN[1]);
  let tt = 0;
  const zonaEn = (x, z) => ZONAS.find((Z) => Math.hypot(x - Z.c[0], z - Z.c[1]) < Z.r) || null;
  return {
    id: 'plaza', mundo, grupo: g, mar, inicio, rumboInicio, musica: 'colina', cielo: { aurora: 0, arcoiris: 1 },
    orbes, mariposas, burbujas, frutas, discos, npcs, cardumenes, monorriel: mono, mapa, zonas: ZONAS, zonaEn,
    /* los lugares importantes (para las pruebas y el mapa) */
    puntos: { spawn: SPAWN, cartel: CARTEL, terminal: TERMINAL, faro: FARO, muelle: [mx0, mz0], finMuelle, casaArbol: CA, monte: MONTE, pozo: POZO, ciudad: CIUDAD, pradera: PRADERA, bosque: BOSQUE },
    tienda, fuenteBurbujas: new THREE.Vector3(PLAZA[0], A(...PLAZA) + 3, PLAZA[1]),
    /* soplar un molino: gira rápido un rato */
    soplar(M) { M.extra = 3.2; },
    actualizar(dt, jp, cielo) {
      tt += dt;
      globo.userData.actualizar(tt, dt);
      casc.userData.actualizar(tt, dt);
      for (const p of peceras) p.userData.actualizar(tt);
      for (const c of cardumenes) c.actualizar(dt);
      medusas.actualizar(dt);
      frutas.actualizar(dt);
      mono.actualizar();
      for (const d of discos) { d.malla.rotation.y = tt * 1.6; d.malla.position.y = d.p.y + Math.sin(tt * 2) * 0.12; }
      /* los molinos giran con el viento (y más rápido si se los sopla) */
      for (const M of molinos) { M.extra = Math.max(0, M.extra - dt * 0.35); if (M.rotor) M.rotor.rotation.z -= (M.vel + M.extra) * dt * UNI.uViento.value; }
      /* los hongos se aplastan y rebotan cuando se los pisa */
      for (const H of hongos) { if (H.t > 1.5) continue; H.t += dt; const k = Math.sin(H.t * 14) * Math.exp(-H.t * 3.5) * 0.18; H.m.scale.set(1 + k, 1 - k, 1 + k); }
      /* el velero se mece, las botellas flotan en la orilla */
      velero.position.y = Math.sin(tt * 0.9) * 0.12; velero.rotation.z = Math.sin(tt * 0.7) * 0.05; velero.rotation.x = Math.sin(tt * 0.55 + 1) * 0.03;
      for (const B of botellas) { B.m.rotation.z = Math.sin(tt * 1.3 + B.p.x) * 0.15; B.m.position.y = B.p.y + 0.05 + Math.max(0, Math.sin(tt * 1.1 + B.p.z)) * 0.04; }
      /* el reloj de la terminal marca la hora del cielo */
      if (reloj.h && cielo.hora != null) { const h = cielo.hora * 24; reloj.h.rotation.z = -h / 12 * Math.PI * 2; reloj.m.rotation.z = -(h % 1) * Math.PI * 2; }
      /* de noche se prenden los faroles y el haz del faro gira */
      const noche = 1 - cielo.dia;
      { const L = faroles.userData.luz; L.material.emissiveIntensity = 0.3 + noche * 3.2; L.material.opacity = Math.min(0.95, L.userData.op0 + noche * 0.55); }
      if (faro.userData.haz) { faro.userData.haz.rotation.y = tt * 0.9; faro.userData.haz.material.opacity = 0.05 + noche * 0.3; }
    },
  };
}
