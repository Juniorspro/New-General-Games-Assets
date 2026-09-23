/* kuntur/js/biomas.js — la luz, el cielo y los colores de cada lugar.
   Cada capítulo pasa por una hora del día: la granizada de noche, la mañana en
   los Siete Colores, el mediodía blanco de las Salinas, la tarde arriba de las
   nubes, la noche de la Puna y el amanecer en el Nevado. Un bioma puede tener
   etapas: los valores se mezclan según por dónde va Killa.
   El sol del cielo (lo que se ve) y la luz que ilumina van separados: la luz
   viene de adelante para que se lea todo; el sol se pone donde queda lindo. */

export const BIOMAS = {
  prologo: {
    cielo: { zenit: '#070914', medio: '#141a30', horizonte: '#2c2a44', sol: null, luna: [0.35, 0.42], estrellas: 0.15, via: 0, nubes: 0.9, nubeCol: '#23263c' },
    niebla: { col: '#232842', dens: 0.004 },
    luz: { col: '#9fb0ec', int: 2.0, dir: [-0.35, 0.62, 0.78] },
    hemi: { cielo: '#5a68a0', suelo: '#3a2a30', int: 1.0 },
    roca: ['#9a6248', '#b27452', '#8a5440', '#c0865a', '#a06a4c'], tope: '#8a8a56', tope2: '#6e6e46', frente: 'estratos',
    montes: [{ z: -30, alto: 9, col: '#2a2338', rug: 0.6 }, { z: -70, alto: 22, col: '#1f1c2e', rug: 0.8 }, { z: -150, alto: 40, col: '#161625', rug: 1 }],
    grado: { exp: 1.2, contraste: 1.04, sat: 0.85, tinte: [0.88, 0.94, 1.12], vineta: 0.45, grano: 0.05 },
    bloom: { fuerza: 0.55, umbral: 0.7, radio: 0.5 }, clima: 'granizo',
  },
  colores: {
    cielo: { zenit: '#3f86dc', medio: '#8fbbe8', horizonte: '#ffd9b0', sol: [-0.55, 0.16], luna: null, estrellas: 0, via: 0, nubes: 0.35, nubeCol: '#fff3e6' },
    niebla: { col: '#eecfb2', dens: 0.0022 },
    luz: { col: '#ffd7a8', int: 2.1, dir: [-0.55, 0.5, 0.68] },
    hemi: { cielo: '#a8c8f0', suelo: '#8a4f34', int: 0.7 },
    roca: ['#a9412e', '#c9663a', '#e2a35c', '#ecd29a', '#97a46a', '#7f5a8a', '#dcc9ad', '#b5523a', '#8e3a2e'], tope: '#b8a66c', tope2: '#96905a', frente: 'estratos',
    montes: [{ z: -45, alto: 16, col: '#c46a44', rug: 0.8, rayas: true }, { z: -105, alto: 32, col: '#a45a62', rug: 0.9, rayas: true }, { z: -230, alto: 58, col: '#8f86b0', rug: 1 }],
    grado: { exp: 1.05, contraste: 1.06, sat: 1.12, tinte: [1.04, 1.0, 0.95], vineta: 0.32, grano: 0.025 },
    bloom: { fuerza: 0.22, umbral: 1.1, radio: 0.4 }, clima: 'polvo',
  },
  salinas: {
    cielo: { zenit: '#1f5fd6', medio: '#5d9bec', horizonte: '#dcecff', sol: [0.25, 0.62], luna: null, estrellas: 0, via: 0, nubes: 0.12, nubeCol: '#ffffff' },
    niebla: { col: '#dde9f6', dens: 0.0032 },
    luz: { col: '#fff6e6', int: 3.0, dir: [0.25, 0.85, 0.45] },
    hemi: { cielo: '#bcd8ff', suelo: '#f2eee6', int: 1.2 },
    roca: ['#a39079', '#8f7c66', '#b09c82', '#9a866d'], tope: '#f4f2ec', tope2: '#e6e8ec', frente: 'sal',
    montes: [{ z: -60, alto: 7, col: '#9aa3c2', rug: 0.6 }, { z: -120, alto: 18, col: '#8e97b8', rug: 0.8 }, { z: -220, alto: 36, col: '#a7b2d0', rug: 1 }],
    grado: { exp: 1.12, contraste: 1.04, sat: 1.0, tinte: [0.98, 1.0, 1.04], vineta: 0.25, grano: 0.02 },
    bloom: { fuerza: 0.45, umbral: 0.9, radio: 0.7 }, clima: 'viento', espejo: true,
  },
  tren: {
    cielo: { zenit: '#3d6cc4', medio: '#88a8dc', horizonte: '#ffcf98', sol: [0.6, 0.12], luna: null, estrellas: 0, via: 0, nubes: 0.5, nubeCol: '#ffe6cc' },
    niebla: { col: '#f2d6bd', dens: 0.004 },
    luz: { col: '#ffc98e', int: 2.6, dir: [0.6, 0.45, 0.66] },
    hemi: { cielo: '#9fbef0', suelo: '#7a4a36', int: 0.9 },
    roca: ['#8a4c34', '#a05a3a', '#74402e', '#b06a44'], tope: '#a8905e', tope2: '#8c7a50', frente: 'estratos',
    montes: [{ z: -50, alto: 20, col: '#9a5a44', rug: 0.9 }, { z: -110, alto: 38, col: '#8a6a7e', rug: 1 }, { z: -220, alto: 60, col: '#a08fb0', rug: 1 }],
    grado: { exp: 1.04, contraste: 1.05, sat: 1.08, tinte: [1.05, 0.99, 0.93], vineta: 0.3, grano: 0.025 },
    bloom: { fuerza: 0.4, umbral: 0.85, radio: 0.6 }, clima: null, marNubes: true,
  },
  puna: {
    cielo: { zenit: '#04061a', medio: '#0c1433', horizonte: '#26345e', sol: null, luna: [-0.45, 0.5], estrellas: 1, via: 1, nubes: 0, nubeCol: '#1a2240' },
    niebla: { col: '#1a2244', dens: 0.004 },
    luz: { col: '#a8b8ff', int: 2.0, dir: [-0.3, 0.62, 0.78] },
    hemi: { cielo: '#46589a', suelo: '#2a2020', int: 1.0 },
    roca: ['#7d6a60', '#8e786a', '#6c5c54', '#9a8474'], tope: '#a89c70', tope2: '#8a8060', frente: 'estratos',
    montes: [{ z: -40, alto: 10, col: '#1e2340', rug: 0.7 }, { z: -100, alto: 30, col: '#161c36', rug: 0.9 }, { z: -200, alto: 56, col: '#b8c4e8', rug: 1, nieve: true }],
    grado: { exp: 1.15, contraste: 1.06, sat: 0.9, tinte: [0.9, 0.95, 1.12], vineta: 0.45, grano: 0.045 },
    bloom: { fuerza: 0.7, umbral: 0.62, radio: 0.55 }, clima: 'escarcha',
  },
  nevado: {
    etapas: [
      { x: 0, cielo: { zenit: '#141a2c', medio: '#28324c', horizonte: '#465470', sol: [0.15, -0.3], luna: null, estrellas: 0.05, via: 0, nubes: 1, nubeCol: '#5a6680' },
        niebla: { col: '#8e9ab2', dens: 0.02 }, luz: { col: '#b6c4e0', int: 1.6, dir: [-0.3, 0.8, 0.5] }, hemi: { cielo: '#6a7aa0', suelo: '#3a3a48', int: 0.8 },
        grado: { exp: 1.0, contraste: 1.0, sat: 0.55, tinte: [0.9, 0.96, 1.1], vineta: 0.55, grano: 0.05 }, bloom: { fuerza: 0.35, umbral: 0.85, radio: 0.6 } },
      { x: 1, cielo: { zenit: '#2e4c8e', medio: '#9a8fb4', horizonte: '#ffb27c', sol: [0.15, 0.06], luna: null, estrellas: 0, via: 0, nubes: 0.4, nubeCol: '#ffd0b0' },
        niebla: { col: '#f0c6a8', dens: 0.004 }, luz: { col: '#ffc08a', int: 2.8, dir: [0.35, 0.35, 0.87] }, hemi: { cielo: '#a0b4e8', suelo: '#e8d0c0', int: 1.0 },
        grado: { exp: 1.1, contraste: 1.06, sat: 1.1, tinte: [1.06, 0.98, 0.94], vineta: 0.3, grano: 0.02 }, bloom: { fuerza: 0.7, umbral: 0.75, radio: 0.7 } },
    ],
    roca: ['#5b5864', '#6a6672', '#4d4a56', '#76727e'], tope: '#f2f6fb', tope2: '#dfe8f2', frente: 'nieve',
    montes: [{ z: -40, alto: 18, col: '#e8eef8', rug: 1, nieve: true }, { z: -100, alto: 40, col: '#d8e0f0', rug: 1, nieve: true }, { z: -220, alto: 70, col: '#c8d4ec', rug: 1, nieve: true }],
    clima: 'nieve',
  },
  epilogo: {
    cielo: { zenit: '#4a78c8', medio: '#b4a8c8', horizonte: '#ffc890', sol: [0.5, 0.1], luna: null, estrellas: 0, via: 0, nubes: 0.3, nubeCol: '#ffe0c0' },
    niebla: { col: '#f4c8a0', dens: 0.004 },
    luz: { col: '#ffc88e', int: 2.6, dir: [0.5, 0.42, 0.75] },
    hemi: { cielo: '#a8b8e8', suelo: '#8a4f34', int: 0.95 },
    roca: ['#a9412e', '#c9663a', '#e2a35c', '#ecd29a', '#97a46a', '#7f5a8a', '#dcc9ad', '#b5523a'], tope: '#b8a66c', tope2: '#96905a', frente: 'estratos',
    montes: [{ z: -28, alto: 12, col: '#c46a44', rug: 0.7, rayas: true }, { z: -65, alto: 26, col: '#a45a52', rug: 0.9, rayas: true }, { z: -150, alto: 48, col: '#8f7fa6', rug: 1 }],
    grado: { exp: 1.06, contraste: 1.05, sat: 1.12, tinte: [1.07, 0.99, 0.92], vineta: 0.34, grano: 0.025 },
    bloom: { fuerza: 0.5, umbral: 0.8, radio: 0.65 }, clima: 'polvo',
  },
};
/* la portada: los Siete Colores al amanecer */
BIOMAS.portada = Object.assign({}, BIOMAS.colores, {
  cielo: { zenit: '#27427e', medio: '#9a86b0', horizonte: '#ffb784', sol: [0.1, 0.05], luna: null, estrellas: 0.1, via: 0, nubes: 0.4, nubeCol: '#ffd2b4' },
  niebla: { col: '#e8b8a0', dens: 0.006 },
  luz: { col: '#ffba86', int: 2.2, dir: [0.2, 0.3, 0.93] },
  grado: { exp: 1.0, contraste: 1.1, sat: 1.12, tinte: [1.05, 0.97, 0.96], vineta: 0.45, grano: 0.03 },
  bloom: { fuerza: 0.3, umbral: 0.95, radio: 0.6 },
});

/* mezclar dos etapas (colores como '#rrggbb', números y listas) */
function mezclarValor(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (typeof a === 'string' && a[0] === '#' && typeof b === 'string') {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mezclarValor(v, b[i], k));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const r = {}; for (const q in a) r[q] = q in b ? mezclarValor(a[q], b[q], k) : a[q]; return r; }
  if (a == null || b == null) return k < 0.5 ? a : b;
  return k < 0.5 ? a : b;
}
/* el bioma en un punto del capítulo: k de 0 a 1 */
export function biomaEn(nombre, k) {
  const b = BIOMAS[nombre];
  if (!b.etapas) return b;
  const e = b.etapas;
  let i = 0;
  while (i < e.length - 2 && k > e[i + 1].x) i++;
  const a = e[i], c = e[i + 1], t = Math.max(0, Math.min(1, (k - a.x) / ((c.x - a.x) || 1)));
  const s = t * t * (3 - 2 * t);
  const r = mezclarValor(a, c, s);
  for (const q in b) if (q !== 'etapas') r[q] = b[q];
  return r;
}
