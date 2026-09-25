/* ============================================================================
   aeroplaza/js/estelario.js — EL ESTELARIO: lo que se ve al mirar por el
   telescopio de la azotea del hotel (26/09: "que de verdad haya como un
   Stellarium al abrir el telescopio"). El cielo de verdad, ahora, desde Buenos
   Aires:
   - las 5044 estrellas que se ven a ojo (hasta magnitud 6), cada una con su
     brillo y su color (B−V), que titilan más cerca del horizonte;
   - las 89 constelaciones con sus líneas y sus nombres, los nombres propios de
     las estrellas, la Vía Láctea y los objetos brillantes de cielo profundo
     (las Nubes de Magallanes, Omega Centauri, la Nebulosa de Orión…);
   - el Sol, la Luna con su fase y los planetas donde están (elementos
     keplerianos de JPL, válidos entre 1800 y 2050; la Luna con los términos
     principales de Meeus), la atmósfera de día, el crepúsculo y de noche;
   - el suelo con la silueta de la isla, los puntos cardinales y dos grillas.
   Se arrastra para mirar, se acerca con la ruedita o pellizcando (de 110° a
   0,5°: por debajo de 12° se ve por el ocular), se toca algo para saber qué es,
   y el tiempo se puede apurar, atrasar o frenar. "Ir a…" lleva a lo famoso.
   Todo se dibuja con el mismo renderer del juego, que queda en pausa.
   Los datos: cielo-datos.js (herramientas/cielo.py, de d3-celestial).
   ========================================================================== */
import * as THREE from 'three';
import { ESTRELLAS, NOMBRES, CONSTEL, LINEAS, DSOS } from './cielo-datos.js';
import { t, sumar, idioma } from './textos.js';
import { Pantalla } from './pantalla.js';

sumar({
  es: {
    es_lugar: 'Buenos Aires', es_constel: 'Constelaciones', es_nombres: 'Nombres', es_via: 'Vía Láctea', es_planetas: 'Planetas', es_grilla: 'Grilla', es_atm: 'Atmósfera', es_suelo: 'Suelo',
    es_ahora: 'Ahora', es_ir: 'Ir a…', es_ocular: 'Ocular', es_cerrar: 'Cerrar', es_estrella: 'Estrella', es_planeta: 'Planeta', es_satelite: 'Satélite natural', es_astro: 'Estrella (la nuestra)',
    es_mag: 'Magnitud', es_color: 'Color', es_const: 'Constelación', es_altaz: 'Altura / acimut', es_radec: 'AR / Dec', es_dist: 'Distancia', es_fase: 'Iluminada', es_tam: 'Tamaño',
    es_bajo: 'Está debajo del horizonte', es_ayuda: 'Arrastrá para mirar · pellizcá o usá la ruedita para acercar · tocá una estrella', es_vel: 'Tiempo ×{n}', es_pausa: 'Tiempo frenado', es_dia: 'Es de día: la atmósfera tapa las estrellas (☁ la saca)',
    es_oc: 'cúmulo abierto', es_gc: 'cúmulo globular', es_en: 'nebulosa', es_sfr: 'nebulosa con estrellas naciendo', es_s: 'galaxia espiral', es_sd: 'galaxia', es_i: 'galaxia irregular', es_pos: 'lugar', es_cp: 'objeto',
    es_azul: 'azul', es_azulblanca: 'blanca azulada', es_blanca: 'blanca', es_amarillenta: 'blanca amarillenta', es_amarilla: 'amarilla', es_naranja: 'naranja', es_roja: 'roja',
    es_sol: 'Sol', es_luna: 'Luna', es_mercurio: 'Mercurio', es_venus: 'Venus', es_marte: 'Marte', es_jupiter: 'Júpiter', es_saturno: 'Saturno', es_urano: 'Urano', es_neptuno: 'Neptuno',
    es_n: 'N', es_s2: 'S', es_e: 'E', es_o: 'O', es_ne: 'NE', es_se: 'SE', es_so: 'SO', es_no: 'NO', es_ua: '{n} UA', es_km: '{n} km',
  },
  en: {
    es_lugar: 'Buenos Aires', es_constel: 'Constellations', es_nombres: 'Names', es_via: 'Milky Way', es_planetas: 'Planets', es_grilla: 'Grid', es_atm: 'Atmosphere', es_suelo: 'Ground',
    es_ahora: 'Now', es_ir: 'Go to…', es_ocular: 'Eyepiece', es_cerrar: 'Close', es_estrella: 'Star', es_planeta: 'Planet', es_satelite: 'Natural satellite', es_astro: 'Star (ours)',
    es_mag: 'Magnitude', es_color: 'Color', es_const: 'Constellation', es_altaz: 'Altitude / azimuth', es_radec: 'RA / Dec', es_dist: 'Distance', es_fase: 'Illuminated', es_tam: 'Size',
    es_bajo: 'It is below the horizon', es_ayuda: 'Drag to look · pinch or scroll to zoom · tap a star', es_vel: 'Time ×{n}', es_pausa: 'Time stopped', es_dia: "It's daytime: the atmosphere hides the stars (☁ removes it)",
    es_oc: 'open cluster', es_gc: 'globular cluster', es_en: 'nebula', es_sfr: 'star-forming nebula', es_s: 'spiral galaxy', es_sd: 'galaxy', es_i: 'irregular galaxy', es_pos: 'place', es_cp: 'object',
    es_azul: 'blue', es_azulblanca: 'bluish white', es_blanca: 'white', es_amarillenta: 'yellowish white', es_amarilla: 'yellow', es_naranja: 'orange', es_roja: 'red',
    es_sol: 'Sun', es_luna: 'Moon', es_mercurio: 'Mercury', es_venus: 'Venus', es_marte: 'Mars', es_jupiter: 'Jupiter', es_saturno: 'Saturn', es_urano: 'Uranus', es_neptuno: 'Neptune',
    es_n: 'N', es_s2: 'S', es_e: 'E', es_o: 'W', es_ne: 'NE', es_se: 'SE', es_so: 'SW', es_no: 'NW', es_ua: '{n} AU', es_km: '{n} km',
  },
  pt: {
    es_lugar: 'Buenos Aires', es_constel: 'Constelações', es_nombres: 'Nomes', es_via: 'Via Láctea', es_planetas: 'Planetas', es_grilla: 'Grade', es_atm: 'Atmosfera', es_suelo: 'Chão',
    es_ahora: 'Agora', es_ir: 'Ir para…', es_ocular: 'Ocular', es_cerrar: 'Fechar', es_estrella: 'Estrela', es_planeta: 'Planeta', es_satelite: 'Satélite natural', es_astro: 'Estrela (a nossa)',
    es_mag: 'Magnitude', es_color: 'Cor', es_const: 'Constelação', es_altaz: 'Altura / azimute', es_radec: 'AR / Dec', es_dist: 'Distância', es_fase: 'Iluminada', es_tam: 'Tamanho',
    es_bajo: 'Está abaixo do horizonte', es_ayuda: 'Arraste para olhar · pince ou use a roda para aproximar · toque numa estrela', es_vel: 'Tempo ×{n}', es_pausa: 'Tempo parado', es_dia: 'É dia: a atmosfera esconde as estrelas (☁ tira ela)',
    es_oc: 'aglomerado aberto', es_gc: 'aglomerado globular', es_en: 'nebulosa', es_sfr: 'nebulosa com estrelas nascendo', es_s: 'galáxia espiral', es_sd: 'galáxia', es_i: 'galáxia irregular', es_pos: 'lugar', es_cp: 'objeto',
    es_azul: 'azul', es_azulblanca: 'branca azulada', es_blanca: 'branca', es_amarillenta: 'branca amarelada', es_amarilla: 'amarela', es_naranja: 'laranja', es_roja: 'vermelha',
    es_sol: 'Sol', es_luna: 'Lua', es_mercurio: 'Mercúrio', es_venus: 'Vênus', es_marte: 'Marte', es_jupiter: 'Júpiter', es_saturno: 'Saturno', es_urano: 'Urano', es_neptuno: 'Netuno',
    es_n: 'N', es_s2: 'S', es_e: 'L', es_o: 'O', es_ne: 'NE', es_se: 'SE', es_so: 'SO', es_no: 'NO', es_ua: '{n} UA', es_km: '{n} km',
  },
});
/* los nombres de constelación en portugués que más se usan (el resto, el latín) */
const CONST_PT = { Cru: 'Cruzeiro do Sul', Ori: 'Órion', Sco: 'Escorpião', UMa: 'Ursa Maior', UMi: 'Ursa Menor', Cen: 'Centauro', CMa: 'Cão Maior', CMi: 'Cão Menor', Sgr: 'Sagitário', Tau: 'Touro', Gem: 'Gêmeos', Leo: 'Leão', Vir: 'Virgem', Lib: 'Libra', Aqr: 'Aquário', Psc: 'Peixes', Ari: 'Áries', Cnc: 'Câncer', Cap: 'Capricórnio', Car: 'Quilha', Vel: 'Vela', Pup: 'Popa', Cyg: 'Cisne', Lyr: 'Lira', Aql: 'Águia', And: 'Andrômeda', Peg: 'Pégaso', Cas: 'Cassiopeia', Per: 'Perseu', Dra: 'Dragão', Eri: 'Erídano', Hya: 'Hidra', Pav: 'Pavão', Tuc: 'Tucano', Gru: 'Grou', Phe: 'Fênix', Oct: 'Oitante', Lup: 'Lobo', Ara: 'Altar' };

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const LUGAR = { lat: -34.6, lon: -58.38 };   // Buenos Aires
const RC = 1000;   // el radio de la esfera celeste (unidades de three)

/* ---------------------------------------------------------------- astronomía */
const diasJ2000 = (ms) => ms / 86400000 + 2440587.5 - 2451545.0;
const norm360 = (a) => ((a % 360) + 360) % 360;
/* hora sidérea local, en grados */
export const tsl = (d, lon = LUGAR.lon) => norm360(280.46061837 + 360.98564736629 * d + lon);
const EPS = 23.43928 * D2R;
/* elementos de JPL (Standish, "Keplerian Elements for Approximate Positions of the Major Planets", 1800–2050):
   a, e, I, L, ϖ, Ω y lo que cambian por siglo */
const ELEM = {
  mercurio: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  tierra: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  marte: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturno: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  urano: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptuno: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};
/* magnitud absoluta aproximada (H) y color de cada planeta */
const PLANETA = { mercurio: [-0.42, '#c8c0b8'], venus: [-4.4, '#fff4d6'], marte: [-1.52, '#ff8a5a'], jupiter: [-9.4, '#f4dcb0'], saturno: [-8.88, '#f2d58a'], urano: [-7.19, '#b8f0ff'], neptuno: [-6.87, '#7fa8ff'] };
function helio(k, T) {
  const E0 = ELEM[k], a = E0[0] + E0[6] * T, e = E0[1] + E0[7] * T, I = (E0[2] + E0[8] * T) * D2R, L = E0[3] + E0[9] * T, w = E0[4] + E0[10] * T, O = (E0[5] + E0[11] * T) * D2R;
  const om = (w - E0[5] - E0[11] * T) * D2R, M = norm360(L - w) * D2R;
  let E = M + e * Math.sin(M); for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x1 = a * (Math.cos(E) - e), y1 = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [(co * cO - so * sO * cI) * x1 + (-so * cO - co * sO * cI) * y1, (co * sO + so * cO * cI) * x1 + (-so * sO + co * cO * cI) * y1, (so * sI) * x1 + (co * sI) * y1];
}
/* de eclíptica (x, y, z) a ascensión recta y declinación (grados) */
function aEcuat([x, y, z]) {
  const ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS), r = Math.hypot(x, ye, ze);
  return { ra: norm360(Math.atan2(ye, x) * R2D), dec: Math.asin(ze / r) * R2D, r };
}
export function sistemaSolar(ms) {
  const d = diasJ2000(ms), T = d / 36525, tierra = helio('tierra', T), out = {};
  const sol = aEcuat(tierra.map((v) => -v)); out.sol = { ...sol, mag: -26.7, dist: sol.r };
  for (const k of Object.keys(PLANETA)) {
    const h = helio(k, T), g = [h[0] - tierra[0], h[1] - tierra[1], h[2] - tierra[2]], q = aEcuat(g), rs = Math.hypot(...h);
    /* la fase (ángulo Sol-planeta-Tierra) oscurece a Mercurio y Venus */
    const cf = (rs * rs + q.r * q.r - sol.r * sol.r) / (2 * rs * q.r), fase = Math.acos(Math.max(-1, Math.min(1, cf))) * R2D;
    out[k] = { ...q, dist: q.r, mag: PLANETA[k][0] + 5 * Math.log10(rs * q.r) + (k === 'mercurio' || k === 'venus' ? fase * 0.02 : fase * 0.005) };
  }
  /* la Luna: los términos grandes de Meeus */
  const r = (g) => norm360(g) * D2R;
  const L0 = 218.316 + 13.176396 * d, Mm = r(134.963 + 13.064993 * d), F = r(93.272 + 13.229350 * d), Dd = r(297.850 + 12.190749 * d), Ms = r(357.529 + 0.98560028 * d);
  const lon = (L0 + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * Dd - Mm) + 0.658 * Math.sin(2 * Dd) + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)) * D2R;
  const lat = (5.128 * Math.sin(F) + 0.280 * Math.sin(Mm + F) + 0.277 * Math.sin(Mm - F) + 0.173 * Math.sin(2 * Dd - F)) * D2R;
  const km = 385001 - 20905 * Math.cos(Mm);
  const luna = aEcuat([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]);
  const vs = aVec(sol.ra, sol.dec), vl = aVec(luna.ra, luna.dec), elong = Math.acos(Math.max(-1, Math.min(1, vs.dot(vl))));
  out.luna = { ra: luna.ra, dec: luna.dec, km, ilum: (1 - Math.cos(elong)) / 2, mag: -12.7 + 3 * (1 - (1 - Math.cos(elong)) / 2) };
  return out;
}
/* el vector unitario de (RA, Dec) en el marco ecuatorial: x al punto vernal, z al polo norte */
function aVec(ra, dec, v = new THREE.Vector3()) { const a = ra * D2R, d = dec * D2R; return v.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)); }
/* la matriz que lleva el marco ecuatorial al del lugar (three: +y el cenit, -z el norte, +x el este) */
export function matrizCielo(lstGrados, latGrados, m = new THREE.Matrix4()) {
  const th = lstGrados * D2R, f = latGrados * D2R, c = Math.cos(th), s = Math.sin(th), cf = Math.cos(f), sf = Math.sin(f);
  /* h = Rz(−θ)·e (x a la meridiana, y al este, z al polo); después Este → x, cenit → y, sur → z */
  const R = [[c, s, 0], [-s, c, 0], [0, 0, 1]], A = [[0, 1, 0], [cf, 0, sf], [sf, 0, -cf]];
  const M = A.map((fila) => [0, 1, 2].map((j) => fila[0] * R[0][j] + fila[1] * R[1][j] + fila[2] * R[2][j]));
  return m.set(M[0][0], M[0][1], M[0][2], 0, M[1][0], M[1][1], M[1][2], 0, M[2][0], M[2][1], M[2][2], 0, 0, 0, 0, 1);
}
/* B−V → color (temperatura de Ballesteros y un cuerpo negro aproximado) */
function colorBV(bv) {
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)), x = T / 100;
  let r, g, b;
  if (x <= 66) { r = 255; g = 99.47 * Math.log(x) - 161.12; b = x <= 19 ? 0 : 138.52 * Math.log(x - 10) - 305.04; }
  else { r = 329.7 * Math.pow(x - 60, -0.1332); g = 288.12 * Math.pow(x - 60, -0.0755); b = 255; }
  const c = new THREE.Color(Math.min(255, Math.max(0, r)) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255);
  return c.lerp(new THREE.Color(1, 1, 1), 0.35);   // (a ojo los colores se ven lavados)
}
const claseColor = (bv) => bv < -0.1 ? 'es_azul' : bv < 0.15 ? 'es_azulblanca' : bv < 0.35 ? 'es_blanca' : bv < 0.55 ? 'es_amarillenta' : bv < 0.85 ? 'es_amarilla' : bv < 1.4 ? 'es_naranja' : 'es_roja';
const hms = (ra) => { const h = ra / 15, H = Math.floor(h), m = Math.floor((h - H) * 60); return `${H}h ${String(m).padStart(2, '0')}m`; };
const gms = (g) => { const s = g < 0 ? '−' : '+', a = Math.abs(g), G = Math.floor(a), m = Math.round((a - G) * 60); return `${s}${G}° ${String(m).padStart(2, '0')}′`; };

/* ---------------------------------------------------------------- texturas */
function texVia() {
  /* la Vía Láctea, armada en coordenadas galácticas (los contornos de d3-celestial dan la vuelta
     entera al cielo y no se pueden rellenar en un mapa plano): el disco con su ancho que cambia, el
     bulbo en Sagitario, las nubes brillantes, la Gran Grieta oscura y el Saco de Carbón junto a la Cruz */
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const img = g.createImageData(W, H), px = img.data;
  const G = [[-0.054875539, -0.873437105, -0.483834992], [0.494109454, -0.444829594, 0.746982249], [-0.867666136, -0.198076390, 0.455983795]];
  const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ruido = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; };
  const fbm = (x, y) => ruido(x, y) * 0.5 + ruido(x * 2.1, y * 2.1) * 0.25 + ruido(x * 4.3, y * 4.3) * 0.15 + ruido(x * 8.7, y * 8.7) * 0.1;
  const oscuro = (l, b, l0, b0, r) => { let dl = l - l0; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI; return Math.exp(-(dl * dl + (b - b0) * (b - b0)) / (r * r)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ra = x / W * 2 * Math.PI, de = (0.5 - y / H) * Math.PI, e = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)];
    const gx = G[0][0] * e[0] + G[0][1] * e[1] + G[0][2] * e[2], gy = G[1][0] * e[0] + G[1][1] * e[1] + G[1][2] * e[2], gz = G[2][0] * e[0] + G[2][1] * e[1] + G[2][2] * e[2];
    let l = Math.atan2(gy, gx); const b = Math.asin(Math.max(-1, Math.min(1, gz)));
    const hacia = Math.cos(l) * 0.5 + 0.5;   // 1 hacia el centro de la galaxia
    const sig = 0.07 + 0.05 * hacia + 0.04 * fbm(l * 3, 7.3);
    let v = Math.exp(-((b / sig) ** 2)) * (0.35 + 0.65 * hacia * hacia);
    v += 0.9 * oscuro(l, b, 0, -0.03, 0.2) * (0.6 + 0.4 * fbm(l * 9, b * 9));   // el bulbo
    v += 0.35 * oscuro(l, b, -0.42, -0.02, 0.1) + 0.3 * oscuro(l, b, 1.4, 0.0, 0.09) + 0.25 * oscuro(l, b, -1.0, -0.01, 0.12);   // nubes de Escudo, Cisne y Carina
    v *= 0.55 + 0.75 * fbm(l * 6 + 3, b * 10);
    /* lo oscuro: la Gran Grieta (de Cisne a Escorpio, apenas arriba del plano) y el Saco de Carbón */
    let dl = l; while (dl > Math.PI) dl -= 2 * Math.PI;
    if (dl > -0.3 && dl < 1.3) v *= 1 - 0.7 * Math.exp(-(((b - 0.025) / 0.022) ** 2)) * (0.5 + 0.5 * fbm(l * 12, b * 20));
    v *= 1 - 0.8 * oscuro(l, b, 301 * Math.PI / 180 - 2 * Math.PI, -0.017, 0.045);
    const q = Math.max(0, Math.min(255, v * 255)), o = (y * W + x) * 4;
    px[o] = q * 0.92; px[o + 1] = q * 0.95; px[o + 2] = q; px[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = 'blur(1.5px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; return tx;
}
function texDisco(tipo) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (tipo === 'sol') { gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.12, 'rgba(255,250,220,1)'); gr.addColorStop(0.2, 'rgba(255,230,160,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); }
  else if (tipo === 's' || tipo === 'sd' || tipo === 'i') { g.translate(64, 64); g.scale(1, 0.42); g.translate(-64, -64); gr.addColorStop(0, 'rgba(255,245,230,0.9)'); gr.addColorStop(0.25, 'rgba(210,220,255,0.35)'); gr.addColorStop(1, 'rgba(160,180,255,0)'); }
  else if (tipo === 'en' || tipo === 'sfr') { gr.addColorStop(0, 'rgba(255,190,220,0.8)'); gr.addColorStop(0.5, 'rgba(255,110,160,0.25)'); gr.addColorStop(1, 'rgba(120,90,255,0)'); }
  else if (tipo === 'gc') { gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.3, 'rgba(255,240,210,0.45)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); }
  else { gr.addColorStop(0, 'rgba(220,235,255,0.35)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  if (tipo === 'oc') { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ffffff'; for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = 8 + (i * 37 % 40); g.globalAlpha = 0.5 + (i % 3) * 0.2; g.beginPath(); g.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 1.6 + (i % 4) * 0.5, 0, 7); g.fill(); } g.globalAlpha = 1; }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
/* la Luna, con sus mares y la fase (k: iluminada de 0 a 1, creciente o menguante) */
function pintarLuna(c, k) {
  const g = c.getContext('2d'), S = c.width, r = S / 2 - 2; g.clearRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); gr.addColorStop(0, '#fbfbf4'); gr.addColorStop(1, '#c9c6bb');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  /* los mares (manchas grises difusas donde están de verdad, vistos desde el sur: la Luna va dada vuelta) y cráteres con su borde */
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, 7); g.clip();
  for (const [x, y, rr, a] of [[0.3, 0.35, 0.26, 0.4], [-0.08, 0.42, 0.18, 0.35], [-0.25, 0.05, 0.2, 0.38], [0.12, -0.02, 0.16, 0.3], [0.45, -0.15, 0.13, 0.3], [-0.05, -0.38, 0.12, 0.28], [-0.5, -0.2, 0.1, 0.25]]) {
    const gm = g.createRadialGradient(x * r, y * r, 0, x * r, y * r, rr * r); gm.addColorStop(0, `rgba(110,112,118,${a})`); gm.addColorStop(1, 'rgba(110,112,118,0)'); g.fillStyle = gm; g.beginPath(); g.arc(x * r, y * r, rr * r, 0, 7); g.fill();
  }
  let sem = 7; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) { const a = az() * 6.28, d = Math.sqrt(az()) * r * 0.95, x = Math.cos(a) * d, y = Math.sin(a) * d, cr = (0.01 + az() * az() * 0.06) * r; g.fillStyle = 'rgba(90,90,96,0.3)'; g.beginPath(); g.arc(x, y, cr, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,250,0.35)'; g.lineWidth = Math.max(0.6, cr * 0.25); g.beginPath(); g.arc(x - cr * 0.15, y - cr * 0.15, cr, 3.4, 5.6); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-0.1 * r, -0.62 * r, 0.05 * r, 0, 7); g.fill();   // (Tycho, con sus rayos)
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; g.beginPath(); g.moveTo(-0.1 * r, -0.62 * r); g.lineTo(-0.1 * r + Math.cos(a) * r * 0.6, -0.62 * r + Math.sin(a) * r * 0.6); g.stroke(); }
  g.restore();
  /* la sombra: la parte oscura del disco, con el terminador como media elipse */
  g.fillStyle = 'rgba(6,10,22,0.93)';
  const e = Math.cos(k * Math.PI) * r;   // (de r, luna nueva, a −r, llena)
  g.beginPath(); g.arc(0, 0, r + 1, Math.PI / 2, Math.PI * 1.5, false); g.ellipse(0, 0, Math.abs(e), r + 1, 0, Math.PI * 1.5, Math.PI / 2, e < 0);
  g.fill();
  g.restore();
}

/* ---------------------------------------------------------------- las piezas */
const VS_ESTRELLAS = `
  attribute float aMag; attribute vec3 aColor; attribute float aFase;
  uniform float uBase, uMagZoom, uVis, uT, uDpr, uAtm;
  varying vec3 vColor; varying float vAlfa, vPunta;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
    float alt = w.y / ${RC.toFixed(1)};
    float m = aMag - uMagZoom;
    float f = pow(10.0, -0.4 * m);
    /* cerca del horizonte la atmósfera apaga y hace titilar */
    float ext = mix(1.0, smoothstep(-0.02, 0.2, alt), uAtm);
    float tit = 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.6, alt)) * (0.5 + 0.5 * sin(uT * 9.0 + aFase)) * uAtm;
    vAlfa = clamp(pow(f, 0.42) * 2.2, 0.16, 1.0) * uVis * ext * tit;
    vPunta = smoothstep(0.8, 5.0, f);
    vColor = aColor;
    gl_PointSize = clamp(uBase * pow(f, 0.26), 2.6, 60.0) * uDpr;
  }`;
const FS_ESTRELLAS = `
  varying vec3 vColor; varying float vAlfa, vPunta;
  void main(){
    vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
    if (r > 1.0) discard;
    float nucleo = exp(-r * r * 9.0), halo = exp(-r * r * 3.0) * 0.45;
    float cruz = (max(0.0, 1.0 - abs(q.x) * 16.0) + max(0.0, 1.0 - abs(q.y) * 16.0)) * (1.0 - r) * vPunta * 0.8;
    float a = (nucleo + halo + cruz) * vAlfa;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), nucleo * 0.6) * a, a);
  }`;

export class Estelario {
  constructor(motor) { this.motor = motor; this.abierto = false; this.listo = false; }
  armar() {
    const esc = this.esc = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 1, 1, RC * 3);
    this.eq = new THREE.Group(); this.eq.matrixAutoUpdate = false; esc.add(this.eq);
    /* el cielo (del lugar): noche, crepúsculo o día, según el Sol y la atmósfera */
    this.uCielo = { uSol: { value: new THREE.Vector3(0, -1, 0) }, uAtm: { value: 1 } };
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(RC * 1.3, 48, 24), new THREE.ShaderMaterial({
      uniforms: this.uCielo, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uSol; uniform float uAtm; varying vec3 vD;
        void main(){
          float h = max(vD.y, 0.0), sa = uSol.y, dia = smoothstep(-0.2, 0.08, sa), crep = smoothstep(-0.32, -0.02, sa) * (1.0 - smoothstep(-0.02, 0.2, sa));
          vec3 noche = mix(vec3(0.035, 0.06, 0.13), vec3(0.008, 0.012, 0.035), pow(h, 0.45));
          noche += vec3(0.09, 0.06, 0.03) * pow(1.0 - h, 10.0);   // (el resplandor de la ciudad, abajo)
          vec3 celeste = mix(vec3(0.62, 0.8, 0.97), vec3(0.16, 0.42, 0.86), pow(h, 0.6));
          float haciaSol = pow(max(dot(normalize(vec3(vD.x, 0.0, vD.z) + 1e-4), normalize(vec3(uSol.x, 0.0, uSol.z) + 1e-4)), 0.0), 3.0);
          vec3 naranja = mix(vec3(0.95, 0.45, 0.25), vec3(0.35, 0.25, 0.55), pow(h, 0.5)) * (0.3 + 0.7 * haciaSol);
          vec3 col = mix(noche, celeste, dia * uAtm);
          col = mix(col, naranja, crep * uAtm * (1.0 - h) * 0.9);
          float halo = pow(max(dot(vD, normalize(uSol)), 0.0), 60.0) * dia * uAtm;
          col += vec3(1.0, 0.95, 0.8) * halo;
          if (uAtm < 0.5) col = mix(vec3(0.004, 0.006, 0.016), vec3(0.02, 0.03, 0.06), pow(1.0 - h, 6.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    cielo.renderOrder = -10; esc.add(cielo);
    /* la Vía Láctea: una esfera en el marco ecuatorial con la textura (RA, Dec) */
    { const N = 96, Mv = 48, pos = [], uv = [], idx = [];
      for (let j = 0; j <= Mv; j++) for (let i = 0; i <= N; i++) { const ra = i / N * 360, de = 90 - j / Mv * 180, v = aVec(ra, de).multiplyScalar(RC * 1.1); pos.push(v.x, v.y, v.z); uv.push(ra / 360, 1 - j / Mv); }
      for (let j = 0; j < Mv; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      this.via = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texVia(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: '#c8d6ff', toneMapped: false }));
      this.via.renderOrder = -9; this.eq.add(this.via); }
    /* las estrellas */
    const s = atob(ESTRELLAS), n = s.length / 6, pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3), fase = new Float32Array(n);
    this.cat = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const o = i * 6, ra = (s.charCodeAt(o) | s.charCodeAt(o + 1) << 8) / 65535 * 360; let de = s.charCodeAt(o + 2) | s.charCodeAt(o + 3) << 8; if (de > 32767) de -= 65536; de = de / 32767 * 90;
      const m = s.charCodeAt(o + 4) / 25 - 2, bv = s.charCodeAt(o + 5) / 80 - 0.5;
      aVec(ra, de, v).multiplyScalar(RC); pos.set([v.x, v.y, v.z], i * 3); mag[i] = m; const c = colorBV(bv); col.set([c.r, c.g, c.b], i * 3); fase[i] = (i * 2.399) % 6.283;
      this.cat.push({ ra, dec: de, mag: m, bv });
    }
    for (const [i, nom, bayer, c, en] of NOMBRES) Object.assign(this.cat[i], { nombre: nom, bayer, con: c, en });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
    this.uEst = { uBase: { value: 6 }, uMagZoom: { value: 0 }, uVis: { value: 1 }, uT: { value: 0 }, uDpr: { value: 1 }, uAtm: { value: 1 } };
    this.puntos = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.uEst, vertexShader: VS_ESTRELLAS, fragmentShader: FS_ESTRELLAS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.puntos.frustumCulled = false; this.puntos.renderOrder = -5; this.eq.add(this.puntos);
    /* las líneas de las constelaciones */
    { const L = [];
      for (const lineas of Object.values(LINEAS)) for (const l of lineas) for (let i = 0; i + 1 < l.length; i++) { const a = aVec(l[i][0], l[i][1]).multiplyScalar(RC * 0.99), b = aVec(l[i + 1][0], l[i + 1][1]).multiplyScalar(RC * 0.99); L.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L, 3));
      this.lineas = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#5aa0ff', transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }));
      this.lineas.renderOrder = -6; this.eq.add(this.lineas); }
    /* las grillas: ecuatorial (en el cielo que gira) y la del lugar (altura y acimut) */
    const grilla = (color, op) => {
      const L = [];
      for (let de = -80; de <= 80; de += 10) for (let ra = 0; ra < 360; ra += 4) { const a = aVec(ra, de).multiplyScalar(RC * 0.98), b = aVec(ra + 4, de).multiplyScalar(RC * 0.98); L.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      for (let ra = 0; ra < 360; ra += 15) for (let de = -88; de < 88; de += 4) { const a = aVec(ra, de).multiplyScalar(RC * 0.98), b = aVec(ra, Math.min(88, de + 4)).multiplyScalar(RC * 0.98); L.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
    };
    this.grillaEq = grilla('#5a7cff', 0.16); this.grillaEq.renderOrder = -7; this.eq.add(this.grillaEq);
    this.grillaAz = grilla('#6fe0a0', 0.14); this.grillaAz.rotation.x = -Math.PI / 2; this.grillaAz.renderOrder = -7; esc.add(this.grillaAz);
    /* el Sol, la Luna, los planetas y el cielo profundo: sprites en el marco ecuatorial */
    this.sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDisco('sol'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); this.sol.renderOrder = -4; this.eq.add(this.sol);
    this.cvLuna = document.createElement('canvas'); this.cvLuna.width = this.cvLuna.height = 128;
    this.txLuna = new THREE.CanvasTexture(this.cvLuna); this.txLuna.colorSpace = THREE.SRGBColorSpace;
    this.luna = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.txLuna, depthWrite: false, transparent: true, toneMapped: false })); this.luna.renderOrder = -3; this.eq.add(this.luna);
    this.planetas = {};
    for (const [k, [, c]] of Object.entries(PLANETA)) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texPunto ||= texDisco('gc'), color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.renderOrder = -4; this.eq.add(sp); this.planetas[k] = sp;
    }
    this.dsos = DSOS.map(([id, es, en, tipo, mag, dim, ra, dec]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDisco(tipo), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: tipo === 'pos' ? 0 : 0.55, toneMapped: false }));
      const ang = Math.max(0.15, dim / 60) * D2R * RC; sp.scale.set(ang * 1.4, ang * 1.4, 1); aVec(ra, dec, sp.position).multiplyScalar(RC * 0.97); sp.renderOrder = -8; this.eq.add(sp);
      return { id, es, en, tipo, mag, dim, ra, dec, sp };
    });
    /* el suelo: todo lo que está debajo de la silueta de la isla (lomas y palmeras), con el horizonte que brilla */
    this.uSuelo = { uLuz: { value: 0 } };
    const suelo = new THREE.Mesh(new THREE.SphereGeometry(RC * 1.2, 96, 32), new THREE.ShaderMaterial({
      uniforms: this.uSuelo, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uLuz; varying vec3 vD;
        float lomas(float a){ return 0.012 + 0.012 * sin(a * 3.0 + 1.0) + 0.008 * sin(a * 7.0 + 2.3) + 0.004 * sin(a * 17.0); }
        float palmera(float a, float c, float h){ float d = abs(a - c); float tronco = step(d, 0.0025) * h; float copa = smoothstep(0.03, 0.0, abs(d - 0.0)) * step(h - 0.012, 1.0); return max(tronco, (1.0 - smoothstep(0.0, 0.028, d)) * (h + 0.004 - d * 0.4)); }
        void main(){
          float a = atan(vD.x, -vD.z), alt = vD.y;
          float hs = lomas(a);
          for (int i = 0; i < 9; i++) { float c = -3.0 + float(i) * 0.71 + sin(float(i) * 4.1) * 0.2; hs = max(hs, palmera(a, c, 0.05 + 0.02 * sin(float(i) * 2.7))); }
          if (alt > hs) discard;
          vec3 cerca = mix(vec3(0.02, 0.05, 0.05), vec3(0.2, 0.42, 0.36), uLuz), lejos = mix(vec3(0.04, 0.07, 0.1), vec3(0.45, 0.62, 0.7), uLuz);
          vec3 col = mix(lejos, cerca, smoothstep(0.0, -0.4, alt));
          col += vec3(0.25, 0.4, 0.55) * (1.0 - smoothstep(0.0, 0.012, hs - alt)) * (0.25 + uLuz * 0.3);   // (el filo iluminado de la silueta)
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    suelo.renderOrder = 20; esc.add(suelo); this.suelo = suelo;
    this.listo = true;
  }

  /* ------------------------------------------------ abrir y cerrar */
  abrir({ alCerrar, raiz } = {}) {
    if (!this.listo) this.armar();
    this.alCerrar = alCerrar;
    this.ms = Date.now(); this.vel = 1; this.ultVel = 1;
    this.op = this.op || { constel: true, nombres: true, via: true, planetas: true, grilla: false, atm: true, suelo: true, ocular: true };
    this.fov = 70; this.az = 180; this.alt = 38; this.sel = null; this.tt = 0; this.ir = null;
    this.calcular();
    /* si es de día, la atmósfera arranca apagada (así se ven las estrellas) y se avisa */
    this.dia = this.cuerpos.sol.alt > -4;
    if (this.dia) this.op.atm = false;
    /* se arranca mirando lo más lindo que haya arriba: un planeta brillante, la Cruz del Sur o el sur */
    const vistos = Object.entries(this.cuerpos).filter(([k, c]) => k !== 'sol' && c.alt > 15 && c.mag < 0).sort((a, b) => a[1].mag - b[1].mag);
    if (vistos.length) { this.az = vistos[0][1].az; this.alt = Math.min(60, vistos[0][1].alt); }
    else { const cru = CONSTEL.find((c) => c[0] === 'Cru'); const h = this.altaz(cru[4], cru[5]); if (h.alt > 10) { this.az = h.az; this.alt = h.alt; } }
    this.armarDom(raiz || document.getElementById('app') || document.body);
    this.abierto = true;
    document.documentElement.classList.add('en-estelario');
  }
  cerrar() {
    if (!this.abierto) return;
    this.abierto = false; document.documentElement.classList.remove('en-estelario');
    this.dom?.remove(); this.dom = null; removeEventListener('keydown', this._tecla, true);
    this.alCerrar?.();
  }

  /* ------------------------------------------------ la cuenta */
  altaz(ra, dec) {
    const v = aVec(ra, dec).applyMatrix4(this.m);
    return { alt: Math.asin(Math.max(-1, Math.min(1, v.y))) * R2D, az: norm360(Math.atan2(v.x, -v.z) * R2D), v };
  }
  calcular() {
    const d = diasJ2000(this.ms);
    this.lst = tsl(d);
    this.m = matrizCielo(this.lst, LUGAR.lat, this.m);
    this.eq.matrix.copy(this.m); this.eq.matrixWorldNeedsUpdate = true;
    const S = sistemaSolar(this.ms);
    this.cuerpos = {};
    for (const [k, c] of Object.entries(S)) { const h = this.altaz(c.ra, c.dec); this.cuerpos[k] = { ...c, alt: h.alt, az: h.az }; }
    const ps = (sp, c, dist) => aVec(c.ra, c.dec, sp.position).multiplyScalar(RC * dist);
    ps(this.sol, S.sol, 0.96); ps(this.luna, S.luna, 0.95);
    for (const [k, sp] of Object.entries(this.planetas)) ps(sp, S[k], 0.96);
    if (Math.abs((this._ilum ?? -1) - S.luna.ilum) > 0.005) { this._ilum = S.luna.ilum; pintarLuna(this.cvLuna, S.luna.ilum); this.txLuna.needsUpdate = true; }
    const solV = aVec(S.sol.ra, S.sol.dec).applyMatrix4(this.m); this.uCielo.uSol.value.copy(solV);
  }
  cuadro(dt, dibujar = true) {
    if (!this.abierto) return;
    this.tt += dt;
    this.ms += dt * 1000 * this.vel;
    this.calcular();
    /* ir a algo: la vista se desliza hasta ahí */
    if (this.ir) {
      const u = Math.min(1, (this.tt - this.ir.t0) / 1.1), k = u * u * (3 - 2 * u), h = this.ir.fn();
      let dAz = h.az - this.ir.az0; while (dAz > 180) dAz -= 360; while (dAz < -180) dAz += 360;
      this.az = norm360(this.ir.az0 + dAz * k); this.alt = this.ir.alt0 + (Math.max(-5, Math.min(85, h.alt)) - this.ir.alt0) * k; this.fov = this.ir.fov0 + (this.ir.fov1 - this.ir.fov0) * k;
      if (u >= 1) this.ir = null;
    }
    const r = this.motor.r, tam = r.getSize(new THREE.Vector2()), dpr = r.getPixelRatio();
    this.cam.aspect = tam.x / tam.y; this.cam.fov = this.fov; this.cam.updateProjectionMatrix();
    const dir = new THREE.Vector3(Math.cos(this.alt * D2R) * Math.sin(this.az * D2R), Math.sin(this.alt * D2R), -Math.cos(this.alt * D2R) * Math.cos(this.az * D2R));
    this.cam.position.set(0, 0, 0); this.cam.up.set(0, 1, 0); this.cam.lookAt(dir);
    /* lo que se ve según el día, la atmósfera y el zoom */
    const solAlt = this.cuerpos.sol.alt, dia = this.op.atm ? Math.max(0, Math.min(1, (solAlt + 12) / 12)) : 0;
    this.uCielo.uAtm.value = this.op.atm ? 1 : 0;
    this.uEst.uVis.value = 1 - dia * 0.97; this.uEst.uT.value = this.tt; this.uEst.uDpr.value = dpr; this.uEst.uAtm.value = this.op.atm ? 1 : 0.25;
    this.uEst.uMagZoom.value = Math.max(0, 2.2 * Math.log10(70 / this.fov)); this.uEst.uBase.value = 6.5 + Math.min(5, 40 / this.fov);
    this.via.visible = this.op.via; this.via.material.opacity = 0.5 * (1 - dia);
    this.lineas.visible = this.op.constel; this.grillaEq.visible = this.grillaAz.visible = this.op.grilla;
    this.suelo.visible = this.op.suelo; this.uSuelo.uLuz.value = Math.max(0, Math.min(1, (solAlt + 6) / 20));
    for (const sp of Object.values(this.planetas)) sp.visible = this.op.planetas;
    this.luna.visible = this.sol.visible = this.op.planetas;
    /* los tamaños en pantalla: el disco de verdad (0,5° la Luna) o un mínimo para que se vea */
    const px = (tam.y / dpr) / (this.fov * D2R), mundoPx = (p) => p / px * RC;   // (radianes por píxel → tamaño en la esfera)
    this.luna.scale.setScalar(Math.max(0.52 * D2R * RC, mundoPx(18)));
    this.sol.scale.setScalar(Math.max(0.53 * D2R * RC * 6, mundoPx(90)));
    for (const [k, sp] of Object.entries(this.planetas)) { const m = this.cuerpos[k].mag; sp.scale.setScalar(mundoPx(Math.max(6, 16 - m * 2.2))); sp.material.opacity = Math.min(1, Math.pow(10, -0.4 * (m - 2)) + 0.25) * (1 - dia * 0.9); }
    for (const D of this.dsos) D.sp.visible = this.fov < 60 || D.dim > 200;
    if (dibujar) { const ac = r.autoClear, tm = r.toneMapping; r.setRenderTarget(null); r.autoClear = true; r.toneMapping = THREE.NoToneMapping; r.render(this.esc, this.cam); r.autoClear = ac; r.toneMapping = tm; }
    this.pintarRotulos(tam.x / dpr, tam.y / dpr);
    this.pintarBarra();
  }
  /* de la esfera a la pantalla (en píxeles CSS); null si está atrás */
  aPantalla(v3, W, H) {
    const p = v3.clone().project(this.cam);
    if (p.z > 1 || Math.abs(p.x) > 1.3 || Math.abs(p.y) > 1.3) return null;
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
  }
  nombreConst(sig) { const c = CONSTEL.find((q) => q[0] === sig); if (!c) return sig; const i = idioma(); return i === 'es' ? c[2] : i === 'en' ? c[3] : CONST_PT[sig] || c[1]; }

  /* ------------------------------------------------ los rótulos (en un lienzo 2D arriba) */
  pintarRotulos(W, H) {
    const cv = this.cvRot; if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const sobre = (v) => v.y > -0.01 || !this.op.suelo;
    /* (los nombres no se enciman: se anota lo ya escrito y se saltea lo que pisa) */
    const cajas = [], libre = (x, y, w, h) => { for (const c of cajas) if (x < c[0] + c[2] && x + w > c[0] && y < c[1] + c[3] && y + h > c[1]) return false; cajas.push([x, y, w, h]); return true; };
    const tmp = new THREE.Vector3();
    this.hits = [];
    /* las constelaciones */
    if (this.op.constel && this.op.nombres) {
      g.font = `600 ${this.fov < 30 ? 14 : 12}px system-ui, sans-serif`; g.fillStyle = 'rgba(140,190,255,0.8)';
      for (const c of CONSTEL) { if (this.fov > 80 && c[6] > 2) continue; const v = aVec(c[4], c[5], tmp).multiplyScalar(RC).applyMatrix4(this.m); if (!sobre(v)) continue; const q = this.aPantalla(v, W, H); if (!q) continue; const tx = this.nombreConst(c[0]).toUpperCase(), w = g.measureText(tx).width; if (libre(q.x - w / 2, q.y - 8, w, 16)) g.fillText(tx, q.x, q.y); }
    }
    /* las estrellas con nombre (más cuanto más cerca) */
    const magMax = 1.6 + Math.max(0, 2.2 * Math.log10(70 / this.fov));
    g.font = '500 12px system-ui, sans-serif';
    for (const e of this.cat) {
      if (e.mag > magMax + 1.5) break;
      const v = aVec(e.ra, e.dec, tmp).multiplyScalar(RC).applyMatrix4(this.m); if (!sobre(v)) continue;
      const q = this.aPantalla(v, W, H); if (!q || q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20) continue;
      this.hits.push({ q, tipo: 'estrella', o: e, prio: e.mag });
      if (this.op.nombres && e.nombre && e.mag < magMax) { const w = g.measureText(e.nombre).width; if (libre(q.x + 6, q.y - 14, w + 2, 14)) { g.fillStyle = 'rgba(235,240,255,0.78)'; g.textAlign = 'left'; g.fillText(e.nombre, q.x + 7, q.y - 7); g.textAlign = 'center'; } }
    }
    /* planetas, Sol y Luna */
    if (this.op.planetas) {
      g.font = '700 13px system-ui, sans-serif';
      for (const [k, c] of Object.entries(this.cuerpos)) {
        const sp = k === 'sol' ? this.sol : k === 'luna' ? this.luna : this.planetas[k];
        const v = tmp.copy(sp.position).applyMatrix4(this.m); if (!sobre(v)) continue;
        const q = this.aPantalla(v, W, H); if (!q) continue;
        this.hits.push({ q, tipo: k === 'sol' ? 'sol' : k === 'luna' ? 'luna' : 'planeta', k, o: c, prio: -10 });
        g.fillStyle = k === 'luna' ? 'rgba(255,255,240,0.9)' : 'rgba(255,214,140,0.95)'; g.textAlign = 'left'; g.fillText(t('es_' + k), q.x + 12, q.y + 12); g.textAlign = 'center';
      }
      /* la Luna mira con su lado iluminado al Sol (en pantalla) */
      const vl = this.aPantalla(tmp.copy(this.luna.position).applyMatrix4(this.m), W, H), vs = this.solPant(W, H);
      if (vl && vs) this.luna.material.rotation = Math.atan2(-(vs.y - vl.y), vs.x - vl.x);
    }
    /* el cielo profundo */
    if (this.fov < 70) {
      g.font = 'italic 500 12px system-ui, sans-serif'; g.fillStyle = 'rgba(255,190,230,0.8)';
      for (const D of this.dsos) { const v = tmp.copy(D.sp.position).applyMatrix4(this.m); if (!sobre(v)) continue; const q = this.aPantalla(v, W, H); if (!q) continue; this.hits.push({ q, tipo: 'dso', o: D, prio: 3 }); if (this.op.nombres && (this.fov < 45 || D.dim > 200)) g.fillText(idioma() === 'es' ? D.es : D.en, q.x, q.y + 16); }
    }
    /* los puntos cardinales en el horizonte */
    if (this.op.suelo) {
      g.font = '800 15px system-ui, sans-serif';
      [['es_n', 0], ['es_ne', 45], ['es_e', 90], ['es_se', 135], ['es_s2', 180], ['es_so', 225], ['es_o', 270], ['es_no', 315]].forEach(([k, az]) => {
        const v = new THREE.Vector3(Math.sin(az * D2R), 0.004, -Math.cos(az * D2R)).multiplyScalar(RC);
        const q = this.aPantalla(v, W, H); if (!q) return; g.fillStyle = az % 90 ? 'rgba(255,190,120,0.7)' : 'rgba(255,150,90,0.95)'; g.fillText(t(k), q.x, Math.min(H - 70, q.y + 14));
      });
    }
    /* lo elegido: los corchetes que giran (como en Stellarium) */
    if (this.sel) {
      const v = this.vecSel(this.sel); const q = v && this.aPantalla(v, W, H);
      if (q) {
        const s = 14 + Math.sin(this.tt * 4) * 2, a = this.tt * 0.8; g.strokeStyle = 'rgba(255,220,120,0.95)'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; g.beginPath(); g.arc(q.x, q.y, s, b, b + 0.6); g.stroke(); }
      }
    }
    /* el ocular: por debajo de 12° se ve por el tubo */
    if (this.op.ocular && this.fov < 12) {
      const k = Math.min(1, (12 - this.fov) / 4), R0 = Math.min(W, H) * 0.47;
      g.save(); g.fillStyle = `rgba(0,0,0,${0.96 * k})`; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, R0, 0, Math.PI * 2, true); g.fill('evenodd');
      const gr = g.createRadialGradient(W / 2, H / 2, R0 * 0.82, W / 2, H / 2, R0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.85 * k})`); g.fillStyle = gr; g.beginPath(); g.arc(W / 2, H / 2, R0, 0, 7); g.fill();
      g.strokeStyle = `rgba(120,200,255,${0.35 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, R0 + 2, 0, 7); g.stroke();
      g.strokeStyle = `rgba(255,120,120,${0.35 * k})`; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2 - 12, H / 2); g.lineTo(W / 2 + 12, H / 2); g.moveTo(W / 2, H / 2 - 12); g.lineTo(W / 2, H / 2 + 12); g.stroke();
      g.restore();
    }
  }
  solPant(W, H) { return this.aPantalla(new THREE.Vector3().copy(this.sol.position).applyMatrix4(this.m), W, H); }
  vecSel(s) {
    if (s.tipo === 'estrella') return aVec(s.o.ra, s.o.dec).multiplyScalar(RC).applyMatrix4(this.m);
    if (s.tipo === 'dso') return s.o.sp.position.clone().applyMatrix4(this.m);
    const sp = s.k === 'sol' ? this.sol : s.k === 'luna' ? this.luna : this.planetas[s.k];
    return sp.position.clone().applyMatrix4(this.m);
  }

  /* ------------------------------------------------ la interfaz */
  armarDom(raiz) {
    this.dom?.remove();
    const d = this.dom = document.createElement('div'); d.className = 'estelario';
    d.innerHTML = `<canvas class="es-rot"></canvas>
      <div class="es-arriba"><b>🔭 ${t('es_lugar')}</b><span class="es-hora"></span><span class="es-vel"></span></div>
      <div class="es-ayuda">${t('es_ayuda')}</div>
      <div class="es-info" hidden></div>
      <div class="es-lista" hidden></div>
      <div class="es-barra">
        <button data-o="constel" title="${t('es_constel')}">✦</button><button data-o="nombres" title="${t('es_nombres')}">Aa</button><button data-o="via" title="${t('es_via')}">🌌</button><button data-o="planetas" title="${t('es_planetas')}">🪐</button>
        <button data-o="grilla" title="${t('es_grilla')}">▦</button><button data-o="atm" title="${t('es_atm')}">☁</button><button data-o="suelo" title="${t('es_suelo')}">⛰</button><button data-o="ocular" title="${t('es_ocular')}">◎</button>
        <i></i><button data-a="atras" title="−">⏪</button><button data-a="pausa" title="⏯">⏯</button><button data-a="adelante" title="+">⏩</button><button data-a="ahora" class="ancho">${t('es_ahora')}</button>
        <i></i><button data-a="ir" class="ancho">🎯 ${t('es_ir')}</button><button data-a="cerrar" class="cerrar" title="${t('es_cerrar')}">✕</button>
      </div>`;
    raiz.appendChild(d);
    this.cvRot = d.querySelector('.es-rot');
    for (const b of d.querySelectorAll('[data-o]')) b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.o; this.op[k] = !this.op[k]; if (k === 'atm') this.dia = false; };
    d.querySelector('[data-a=cerrar]').onclick = (e) => { e.stopPropagation(); this.cerrar(); };
    const VEL = [-86400, -3600, -600, -60, -1, 0, 1, 60, 600, 3600, 86400];
    const mover = (s) => { let i = VEL.indexOf(this.vel); if (i < 0) i = 6; this.vel = VEL[Math.max(0, Math.min(VEL.length - 1, i + s))]; };
    d.querySelector('[data-a=atras]').onclick = (e) => { e.stopPropagation(); mover(-1); };
    d.querySelector('[data-a=adelante]').onclick = (e) => { e.stopPropagation(); mover(1); };
    d.querySelector('[data-a=pausa]').onclick = (e) => { e.stopPropagation(); if (this.vel) { this.ultVel = this.vel; this.vel = 0; } else this.vel = this.ultVel || 1; };
    d.querySelector('[data-a=ahora]').onclick = (e) => { e.stopPropagation(); this.ms = Date.now(); this.vel = 1; };
    d.querySelector('[data-a=ir]').onclick = (e) => { e.stopPropagation(); this.abrirLista(); };
    /* arrastrar, pellizcar, la ruedita y tocar */
    const toques = new Map(); let d0 = 0, mov = 0;
    const aq = (e) => Pantalla.aJuego(e.clientX, e.clientY);
    this.cvRot.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.cvRot.setPointerCapture?.(e.pointerId); toques.set(e.pointerId, aq(e)); mov = 0; d0 = 0; this.ir = null; });
    this.cvRot.addEventListener('pointermove', (e) => {
      if (!toques.has(e.pointerId)) return; e.preventDefault();
      const q = aq(e), a = toques.get(e.pointerId);
      if (toques.size === 1) {
        const k = this.fov / (this.cvRot.clientHeight || 400);
        this.az = norm360(this.az - (q.x - a.x) * k); this.alt = Math.max(-20, Math.min(89.5, this.alt + (q.y - a.y) * k)); mov += Math.abs(q.x - a.x) + Math.abs(q.y - a.y);
      } else if (toques.size === 2) {
        toques.set(e.pointerId, q); const [p1, p2] = [...toques.values()], dd = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (d0) this.fov = Math.max(0.5, Math.min(110, this.fov * d0 / Math.max(10, dd))); d0 = dd; mov += 99; return;
      }
      toques.set(e.pointerId, q);
    });
    const fin = (e) => {
      if (!toques.has(e.pointerId)) return;
      const q = aq(e); toques.delete(e.pointerId); if (toques.size < 2) d0 = 0;
      if (mov < 8 && !toques.size) this.tocar(q);
    };
    this.cvRot.addEventListener('pointerup', fin); this.cvRot.addEventListener('pointercancel', fin);
    this.cvRot.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); this.fov = Math.max(0.5, Math.min(110, this.fov * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    this._tecla = (e) => {
      if (!this.abierto) return;
      const k = e.key, paso = this.fov * 0.05;
      if (k === 'Escape') this.cerrar();
      else if (k === 'ArrowLeft' || k === 'a') this.az = norm360(this.az - paso); else if (k === 'ArrowRight' || k === 'd') this.az = norm360(this.az + paso);
      else if (k === 'ArrowUp' || k === 'w') this.alt = Math.min(89.5, this.alt + paso); else if (k === 'ArrowDown' || k === 's') this.alt = Math.max(-20, this.alt - paso);
      else if (k === '+' || k === '=') this.fov = Math.max(0.5, this.fov / 1.25); else if (k === '-') this.fov = Math.min(110, this.fov * 1.25);
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    addEventListener('keydown', this._tecla, true);
  }
  /* tocar: lo más cercano en pantalla (a menos de 26 px), prefiriendo lo brillante */
  tocar(q) {
    const r = this.cvRot.getBoundingClientRect(), W = this.cvRot.clientWidth, H = this.cvRot.clientHeight;
    let mejor = null, md = 1e9;
    for (const h of this.hits || []) { const d = Math.hypot(h.q.x - q.x, h.q.y - q.y) + h.prio * 2.5; if (Math.hypot(h.q.x - q.x, h.q.y - q.y) < 26 && d < md) { md = d; mejor = h; } }
    this.sel = mejor; this.pintarInfo();
    void r; void W; void H;
  }
  pintarInfo() {
    const box = this.dom?.querySelector('.es-info'); if (!box) return;
    const s = this.sel; if (!s) { box.hidden = true; return; }
    const v = this.vecSel(s).normalize(), alt = Math.asin(Math.max(-1, Math.min(1, v.y))) * R2D, az = norm360(Math.atan2(v.x, -v.z) * R2D);
    const fila = (k, val) => `<div><small>${t(k)}</small><b>${val}</b></div>`;
    let titulo, sub, filas = '';
    if (s.tipo === 'estrella') {
      const e = s.o; titulo = e.nombre || (e.bayer ? `${e.bayer} ${e.con || ''}` : `${t('es_estrella')} ${e.mag.toFixed(1)}`); sub = t('es_estrella');
      filas = fila('es_mag', e.mag.toFixed(2)) + fila('es_color', t(claseColor(e.bv))) + (e.con ? fila('es_const', this.nombreConst(e.con)) : '') + fila('es_radec', `${hms(e.ra)} · ${gms(e.dec)}`);
    } else if (s.tipo === 'dso') {
      const D = s.o; titulo = idioma() === 'es' ? D.es : D.en; sub = t('es_' + D.tipo);
      filas = (D.mag ? fila('es_mag', D.mag) : '') + fila('es_tam', D.dim >= 60 ? `${(D.dim / 60).toFixed(1)}°` : `${D.dim}′`) + fila('es_radec', `${hms(D.ra)} · ${gms(D.dec)}`);
    } else {
      const c = s.o; titulo = t('es_' + s.k); sub = s.tipo === 'sol' ? t('es_astro') : s.tipo === 'luna' ? t('es_satelite') : t('es_planeta');
      filas = fila('es_mag', c.mag.toFixed(1)) + (s.k === 'luna' ? fila('es_fase', Math.round(c.ilum * 100) + ' %') + fila('es_dist', t('es_km', { n: Math.round(c.km).toLocaleString() })) : fila('es_dist', t('es_ua', { n: c.dist.toFixed(2) }))) + fila('es_radec', `${hms(c.ra)} · ${gms(c.dec)}`);
    }
    filas += fila('es_altaz', `${alt.toFixed(1)}° · ${az.toFixed(1)}°`);
    box.innerHTML = `<div class="es-tit"><b>${titulo}</b><small>${sub}</small></div>${filas}${alt < 0 ? `<em>${t('es_bajo')}</em>` : ''}`;
    box.hidden = false;
  }
  /* "ir a…": lo famoso */
  abrirLista() {
    const L = this.dom.querySelector('.es-lista');
    if (!L.hidden) { L.hidden = true; return; }
    const est = (n) => this.cat.find((e) => e.en === n || e.nombre === n);
    const items = [
      ['luna', () => ({ tipo: 'luna', k: 'luna', o: this.cuerpos.luna })], ['sol', () => ({ tipo: 'sol', k: 'sol', o: this.cuerpos.sol })],
      ...['mercurio', 'venus', 'marte', 'jupiter', 'saturno'].map((k) => [k, () => ({ tipo: 'planeta', k, o: this.cuerpos[k] })]),
      ...['Sirius', 'Canopus', 'Rigil Kentaurus', 'Achernar', 'Betelgeuse', 'Rigel', 'Antares', 'Acrux'].map((n) => [n, () => ({ tipo: 'estrella', o: est(n) })]),
      ...['PGC 17223', 'NGC 292', 'NGC 5139', 'NGC 1976', 'M 45', 'NGC 224', 'NGC 3372', 'GC'].map((id) => [id, () => ({ tipo: 'dso', o: this.dsos.find((q) => q.id === id) })]),
    ];
    L.innerHTML = items.map(([k, f], i) => { const s = f(); if (!s.o) return ''; const nom = s.tipo === 'estrella' ? s.o.nombre || k : s.tipo === 'dso' ? (idioma() === 'es' ? s.o.es : s.o.en) : t('es_' + k); return `<button data-i="${i}">${nom}</button>`; }).join('');
    for (const b of L.querySelectorAll('button')) b.onclick = (e) => {
      e.stopPropagation(); const s = items[+b.dataset.i][1](); L.hidden = true; this.sel = s; this.pintarInfo();
      const fov1 = s.tipo === 'estrella' ? 20 : s.tipo === 'dso' ? Math.max(2, Math.min(40, s.o.dim / 60 * 4)) : s.tipo === 'luna' ? 3 : s.tipo === 'planeta' ? 1.2 : 30;
      this.ir = { t0: this.tt, az0: this.az, alt0: this.alt, fov0: this.fov, fov1, fn: () => { const v = this.vecSel(this.sel).normalize(); return { alt: Math.asin(Math.max(-1, Math.min(1, v.y))) * R2D, az: norm360(Math.atan2(v.x, -v.z) * R2D) }; } };
    };
    L.hidden = false;
  }
  pintarBarra() {
    const d = this.dom; if (!d) return;
    for (const b of d.querySelectorAll('[data-o]')) b.classList.toggle('prendido', !!this.op[b.dataset.o]);
    const f = new Date(this.ms);
    let tx;
    try { tx = f.toLocaleString(idioma() === 'en' ? 'en-US' : idioma() === 'pt' ? 'pt-BR' : 'es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { tx = f.toISOString().slice(0, 16).replace('T', ' '); }
    if (d._h !== tx) { d._h = tx; d.querySelector('.es-hora').textContent = tx; }
    const vv = this.vel === 1 ? '' : this.vel === 0 ? t('es_pausa') : t('es_vel', { n: this.vel.toLocaleString() });
    if (d._v !== vv) { d._v = vv; d.querySelector('.es-vel').textContent = vv; }
    const aviso = d.querySelector('.es-ayuda'), tx2 = this.dia ? t('es_dia') : t('es_ayuda');
    if (aviso._t !== tx2) { aviso._t = tx2; aviso.textContent = tx2; }
    aviso.classList.toggle('se-va', this.tt > 6);
    if (this.sel && Math.floor(this.tt * 4) !== this._ti) { this._ti = Math.floor(this.tt * 4); this.pintarInfo(); }
  }
}
