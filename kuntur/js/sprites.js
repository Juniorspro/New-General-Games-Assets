/* ============================================================================
   kuntur/js/sprites.js — el pixel art de KUNTUR, cuadro por cuadro.
   Cada cuadro se dibuja en un Lienzo de píxeles (piernas y brazos como líneas
   de 2 o 3 píxeles, el poncho y la cabeza como figuras con sus guardas) y
   después se infla en cubos. Las animaciones son de pixel art de verdad: van
   a 10-12 cuadros por segundo, cambiando de dibujo; el volumen, la luz y la
   sombra las ponen los cubos.
   ========================================================================== */
import { Lienzo, oscurecer } from './vox.js';

/* ---------------- la paleta de Killa ---------------- */
export const PK = {
  piel: '#c3825a', pielO: '#96603f', cachete: '#e3806c', ojo: '#140c10', brillo: '#ffffff', boca: '#7a3232',
  pelo: '#1d1418', peloC: '#3b2a31',
  rojo: '#b8262f', rojoO: '#861b25', amarillo: '#f2b632', verde: '#1f8f6c', azul: '#2b4fa0', crema: '#f2e6c8', fleco: '#e8c04a',
  buzo: '#7a2638', pant: '#3d2c44', pantO: '#2a1f30', ojota: '#2a1a14',
  ag1: '#d6246e', ag2: '#f28c28', ag3: '#6a2f9a', ag4: '#2b8fd0', ag5: '#f2d23c',
};
const W = 30, H = 38, CX = 14;

/* una pose: los puntos de cada parte, en píxeles (y para arriba, pies en 0) */
function dibujarKilla(P) {
  const L = new Lienzo(W, H), K = PK;
  const cy = P.cuerpoY || 0, ix = P.inclina || 0;
  const cad = [CX + 0.5 + ix * 0.3, 9 + cy];
  /* la pierna de atrás (más oscura) */
  const pierna = (pts, lejos) => {
    const [h, r, pie] = pts;
    const c = lejos ? K.pantO : K.pant;
    L.grosor(2);
    L.linea(cad[0] + h[0], cad[1] + h[1], cad[0] + r[0], cad[1] + r[1], c, 3, lejos ? -2 : 1);
    L.linea(cad[0] + r[0], cad[1] + r[1], cad[0] + pie[0], cad[1] + pie[1], c, 3, lejos ? -2 : 1);
    const fx = cad[0] + pie[0], fy = cad[1] + pie[1];
    L.rect(Math.round(fx - 1), Math.round(fy - 1), Math.round(fx + 2), Math.round(fy - 1) + 0, lejos ? oscurecer(K.ojota, 0.8) : K.ojota, lejos ? -2 : 1);
    L.poner(fx + 2, fy - 1, K.piel, lejos ? -2 : 1);
  };
  pierna(P.piernas[1], true);
  /* el brazo de atrás */
  const brazo = (pts, lejos) => {
    const [h, c, m] = pts, bx = CX + ix, by = 18 + cy;
    const col = lejos ? oscurecer(K.buzo, 0.75) : K.buzo, z = lejos ? -4 : 5;
    L.grosor(1.5);
    L.linea(bx + h[0], by + h[1], bx + c[0], by + c[1], col, 2, z);
    L.linea(bx + c[0], by + c[1], bx + m[0], by + m[1], col, 2, z);
    L.rect(Math.round(bx + m[0]) - 1, Math.round(by + m[1]) - 1, Math.round(bx + m[0]), Math.round(by + m[1]), lejos ? K.pielO : K.piel, z);
  };
  if (P.brazoLejos) brazo(P.brazoLejos, true);
  /* el atado de aguayo, en la espalda */
  if (P.bulto !== false) {
    const bx = CX - 5 + ix * 0.5, by = 15 + cy + (P.bultoY || 0);
    const franjas = [K.ag1, K.ag2, K.ag3, K.ag5, K.ag4, K.ag1, K.ag2];
    L.grosor(3);
    L.elipse(bx, by, 3.6, 4.0, (x, y) => franjas[((Math.round(y) - Math.round(by) + 20) >> 1) % franjas.length], -3);
    L.linea(bx + 3, by + 4, CX + 2 + ix, 18.5 + cy, K.ag1, 1, 2);
  }
  /* el poncho: trapecio con guardas; abierto al planear, corto al agacharse */
  const px = CX + ix, py = 19 + cy;
  const ancho = P.poncho === 'abierto' ? 11 : P.poncho === 'agachada' ? 8.5 : 7.5, bajo = P.poncho === 'agachada' ? 6 : 10.5;
  const hombro = 3.5;
  L.grosor(5);
  const pts = [[px - hombro, py], [px + hombro + 0.5, py], [px + ancho + (P.vuela || 0), py - bajo], [px - ancho + 0.5 + (P.vuela || 0), py - bajo]];
  L.poligono(pts, (x, y) => {
    const f = Math.round(py - y);          // filas desde el cuello
    const d = bajo - f;                    // filas desde el ruedo
    if (d <= 0) return (x % 2) ? K.fleco : K.amarillo;
    if (d === 1) return K.rojoO;
    if (d === 2) return K.amarillo;
    if (d === 3) return ((x + f) % 4 < 2) ? K.verde : K.crema;
    if (d === 4) return K.amarillo;
    if (d === 6) return ((x) % 3 === 0) ? K.azul : K.rojo;
    if (f === 1) return ((x) % 2) ? K.verde : K.amarillo;
    /* el lado de la sombra (atrás), más oscuro */
    return x < px - 2 ? K.rojoO : K.rojo;
  }, 0);
  /* el nudo del atado, adelante */
  if (P.bulto !== false) L.poner(px + 3, py - 1, K.ag1, 3);
  /* la pierna de adelante */
  pierna(P.piernas[0], false);
  /* cabeza: redonda, pelo atrás, cara mirando a la derecha (tres cuartos) */
  L.grosor(5);
  const hx = CX + 1 + ix + (P.cabezaX || 0), hy = 24 + cy + (P.cabezaY || 0);
  L.elipse(hx, hy, 5.4, 5.1, (x, y) => (x < hx - 1.6 || (x < hx && y > hy + 1.2) ? K.pelo : (x > hx + 3.6 && y < hy - 2 ? K.pielO : K.piel)), 0);
  /* el pelo cae un poco sobre la frente, del lado de atrás */
  for (let x = Math.round(hx - 1); x <= Math.round(hx + 2); x++) L.poner(x, Math.round(hy + 2), K.pelo, 0);
  L.poner(hx + 3, hy + 2, K.peloC, 0);
  /* la cara */
  const ojos = P.ojos === 'cerrados' ? 'cerrados' : 'abiertos';
  for (const ox of [1.2, 4]) {
    if (ojos === 'abiertos') { L.poner(hx + ox, hy + 0.2, K.ojo, 0); L.poner(hx + ox, hy - 0.8, K.ojo, 0); }
    else L.poner(hx + ox, hy - 0.8, K.ojo, 0);
  }
  if (ojos === 'abiertos') L.poner(hx + 1.2, hy + 0.2, K.brillo, 1);
  L.poner(hx + 0.4, hy - 2, K.cachete, 0); L.poner(hx + 4.6, hy - 2, K.cachete, 0);
  L.poner(hx + 2.8, hy - 3, P.boca === 'abierta' ? K.boca : K.pielO, 0);
  if (P.boca === 'abierta') { L.poner(hx + 2.8, hy - 3.8, K.boca, 0); L.poner(hx + 3.6, hy - 3, K.boca, 0); }
  L.poner(hx + 5.6, hy - 1, K.piel, 0);
  /* el chullo: una cúpula con franjas, apoyada arriba de las cejas */
  const cx = hx - 0.3, base = hy + 2;
  const bandas = [K.amarillo, K.rojo, 'rombo', K.verde, K.rojo, K.azul];
  L.grosor(5.5);
  L.elipse(cx, base + 1.6, 5.9, 3.4, (x, y) => {
    if (y < base) return null;
    const f = Math.round(y - base);
    const b = bandas[Math.max(0, Math.min(bandas.length - 1, f))];
    if (b === 'rombo') return (Math.round(x) % 3 === 0) ? K.rojo : K.crema;
    return b;
  }, 0);
  L.grosor(1);
  L.poner(cx, base + 5.4, K.rojo, 0);
  L.grosor(2);
  L.elipse(cx, base + 6.5, 1.1, 0.9, K.amarillo, 0);
  /* orejera del chullo con su borla */
  L.grosor(1);
  L.poligono([[hx - 4.6, hy + 2.4], [hx - 1.6, hy + 2.4], [hx - 3.1, hy - 2.6]], (x, y) => (Math.round(y) % 2 ? K.rojo : K.amarillo), 5);
  L.poner(hx - 3.1, hy - 3.4, K.amarillo, 5); L.poner(hx - 3.1, hy - 4.2, K.verde, 5);
  /* las trenzas por la espalda, con la cinta en la punta */
  const tx = hx - 3.6 + (P.trenza || 0) * 0.3, ty = hy - 2;
  const tr = P.trenza || 0;
  L.grosor(1);
  for (let i = 0; i < 6; i++) L.poner(tx - i * 0.18 - tr * i * 0.25, ty - i, i % 2 ? K.peloC : K.pelo, -1);
  L.poner(tx - 6 * 0.18 - tr * 1.6, ty - 6, K.ag1, -1); L.poner(tx - 6 * 0.18 - tr * 1.6 + 1, ty - 6, K.ag1, -1);
  /* el brazo de adelante */
  if (P.brazo) brazo(P.brazo, false);
  if (P.extra) P.extra(L, { hx, hy, px, py });
  L.contorno(0.84);
  return L;
}

/* ---------------- las animaciones: poses por cuadro ---------------- */
const S = Math.sin, C = Math.cos;
function correr(f, n) {
  const a = (f / n) * Math.PI * 2;
  const pie = (q) => [S(q) * 4.2, -8.2 + Math.max(0, C(q)) * 2.4];
  const rod = (q) => [S(q) * 2.2 + 1.2 * Math.max(0, -S(q + 1)), -4.3 + Math.max(0, C(q)) * 1.2];
  const bob = Math.round(Math.abs(C(a)) * 1.2);
  return {
    cuerpoY: bob - 1, inclina: 1, trenza: -1.5 - S(a) * 0.8, cabezaY: 0,
    piernas: [[[0.5, 0], rod(a), pie(a)], [[-0.5, 0], rod(a + Math.PI), pie(a + Math.PI)]],
    brazo: [[1, 0], [1 - S(a) * 2.2, -3], [2 - S(a) * 3.2, -5.5]],
    brazoLejos: [[-1, 0], [-1 + S(a) * 2.2, -3], [S(a) * 3.2 - 1, -5.5]],
    vuela: -0.6,
  };
}
const quieta = (f) => ({
  cuerpoY: f === 1 || f === 2 ? 0 : 0, cabezaY: f === 2 ? -0.4 : 0, trenza: 0,
  piernas: [[[0.5, 0], [1, -4.5], [1.4, -9]], [[-0.5, 0], [-1, -4.5], [-1.2, -9]]],
  brazo: [[1, 0], [1.6, -3], [2, -5.8 + (f === 2 ? 0.4 : 0)]],
});
export const POSES_KILLA = {
  quieta: [0, 1, 2, 1].map((f) => quieta(f)),
  parpadea: [Object.assign(quieta(0), { ojos: 'cerrados' })],
  mira: [Object.assign(quieta(0), { cabezaX: 0.6, cabezaY: 0.4 })],
  habla: [Object.assign(quieta(0), { boca: 'abierta', brazo: [[1, 0], [3, -1.5], [5, -0.5]] }), Object.assign(quieta(1), { boca: 'cerrada', brazo: [[1, 0], [3, -1.8], [4.6, -1]] })],
  corre: Array.from({ length: 8 }, (_, f) => correr(f, 8)),
  sube: [{ cuerpoY: 0, trenza: 1.8, piernas: [[[0.5, 0], [3, -3], [2, -7.2]], [[-0.5, 0], [-0.6, -4.4], [-2.2, -8.2]]], brazo: [[1, 0], [2.5, 2.5], [3.2, 5.5]], brazoLejos: [[-1, 0], [-2.6, -2.2], [-3.2, -4.4]], vuela: 0.6 }],
  cae: [0, 1].map((f) => ({ cuerpoY: 0, trenza: 2.4 + f * 0.4, piernas: [[[0.5, 0], [1.8, -4], [1.2 + f * 0.4, -8.8]], [[-0.5, 0], [-1.4, -4.4], [-1.8, -8.8]]], brazo: [[1, 0], [3, 2], [4.6, 4 + f]], brazoLejos: [[-1, 0], [-3, 1.5], [-4.6, 3.6 - f]], vuela: 1.2 })),
  aterriza: [{ cuerpoY: -2, cabezaY: -0.4, trenza: 1, poncho: 'agachada', piernas: [[[0.5, 0], [3, -2.2], [1.6, -7]], [[-0.5, 0], [-1.6, -3], [-2, -7]]], brazo: [[1, 0], [2.4, -2], [3.4, -4]] }],
  agachada: [0, 1].map((f) => ({ cuerpoY: -3.2, cabezaY: -0.6 + f * 0.2, inclina: 1, poncho: 'agachada', trenza: -0.4, piernas: [[[0.5, 0], [3.6, -1.6], [1.8, -5.8]], [[-0.5, 0], [0.6, -2.2], [-1.8, -5.8]]], brazo: [[1, 0], [2.2, -2.2], [3.6, -3.6]] })),
  gatea: Array.from({ length: 4 }, (_, f) => {
    const a = f / 4 * Math.PI * 2;
    return { cuerpoY: -3.4, inclina: 2, poncho: 'agachada', trenza: -1, piernas: [[[0.5, 0], [3.2 + S(a), -1.8], [1 + S(a) * 1.5, -5.8]], [[-0.5, 0], [1 - S(a), -2], [-1.6 - S(a) * 1.5, -5.8]]], brazo: [[1, 0], [3.4, -1.6], [5 + S(a + 1) * 1.5, -3.4]] };
  }),
  colgada: [0, 1].map((f) => ({ cuerpoY: -2, trenza: 0.6 * (f ? 1 : -1), piernas: [[[0.5, 0], [1 + f * 0.6, -4.6], [0.6 + f, -9]], [[-0.5, 0], [-0.6, -4.6], [-0.4 - f * 0.4, -9.2]]], brazo: [[1, 0], [2.6, 4.6], [3.6, 9.2]], brazoLejos: [[-1, 0], [1.4, 4.6], [2.6, 9.2]], bultoY: -1 })),
  trepa: [
    { cuerpoY: 1, inclina: 1, trenza: 0.8, piernas: [[[0.5, 0], [3.6, -1.2], [2.2, -5]], [[-0.5, 0], [-0.4, -4.4], [-0.6, -8.6]]], brazo: [[1, 0], [3.6, 1.8], [5, -0.5]], brazoLejos: [[-1, 0], [2, 2], [4, -0.4]] },
    { cuerpoY: 2, inclina: 2, poncho: 'agachada', trenza: 0.4, piernas: [[[0.5, 0], [4, 0], [3, -4.6]], [[-0.5, 0], [1.6, -2.4], [0, -6.6]]], brazo: [[1, 0], [3.6, -1.6], [4.6, -4]] },
  ],
  escalera: [0, 1].map((f) => ({ cuerpoY: 0, trenza: 0, piernas: [[[0.5, 0], [1.6, -3.2 - f], [0.8, -8 + f * 1.5]], [[-0.5, 0], [0.6, -4 + f], [0.2, -8.6 + (1 - f) * 1.5]]], brazo: [[1, 0], [2.6, 3 + f * 1.4], [2.4, 6.4 + f * 1.4]], brazoLejos: [[-1, 0], [1.4, 3.8 - f], [1.4, 7.6 - f * 1.4]], bulto: true })),
  empuja: Array.from({ length: 4 }, (_, f) => {
    const a = f / 4 * Math.PI * 2;
    return { cuerpoY: -1, inclina: 3, cabezaX: 1, trenza: -1, piernas: [[[0.5, 0], [1 + S(a) * 1.4, -4], [-0.4 + S(a) * 2.6, -8]], [[-0.5, 0], [-1.6 - S(a) * 1.2, -4], [-3.6 - S(a) * 2, -8]]], brazo: [[1, 0], [3.6, -0.6], [6.2, -0.8]], brazoLejos: [[-1, 0], [2.6, -0.4], [5.6, -0.4]] };
  }),
  tira: Array.from({ length: 4 }, (_, f) => {
    const a = f / 4 * Math.PI * 2;
    return { cuerpoY: -1, inclina: -2, cabezaX: -0.6, trenza: 1, piernas: [[[0.5, 0], [2.4 + S(a), -4], [3.4 + S(a) * 2, -8]], [[-0.5, 0], [0.4 - S(a), -4], [1.2 - S(a) * 2, -8]]], brazo: [[1, 0], [3.8, -1], [6.4, -1.4]], brazoLejos: [[-1, 0], [2.8, -1], [5.8, -1.4]] };
  }),
  planea: [0, 1].map((f) => ({ cuerpoY: 0, trenza: 2.8, poncho: 'abierto', vuela: 0.8, piernas: [[[0.5, 0], [1.6, -4.2], [0.6 + f * 0.4, -8.6]], [[-0.5, 0], [-1, -4.4], [-2 + f * 0.4, -8.4]]], brazo: [[1, 0], [3, 3], [3.4, 7 + f * 0.3]], brazoLejos: [[-1, 0], [0.6, 3.4], [1.6, 7.2 + f * 0.3]] })),
  /* los gestos de las escenas */
  saluda: [0, 1].map((f) => Object.assign(quieta(0), { boca: f ? 'cerrada' : 'abierta', cabezaY: 0.3, brazo: [[1, 0], [3, 2.6], [4 + (f ? 1.4 : -0.6), 6.6]] })),
  senala: [0, 1].map((f) => Object.assign(quieta(0), { cabezaX: 0.5, cabezaY: 0.7, boca: f ? 'abierta' : 'cerrada', brazo: [[1, 0], [3.6, 2], [7, 4.6 + f * 0.4]] })),
  levanta: [0, 1].map((f) => Object.assign(quieta(0), { cabezaY: 0.9, cuerpoY: f ? 0 : 0, trenza: 0.6, brazo: [[1, 0], [2.2, 3.6], [2.6 + f * 0.3, 8.2]], brazoLejos: [[-1, 0], [0, 3.6], [0.6 - f * 0.3, 8.2]] })),
  arrodilla: [0, 1].map((f) => ({ cuerpoY: -3.4, cabezaY: -0.6, cabezaX: 0.4, inclina: 1, poncho: 'agachada', trenza: -0.4,
    piernas: [[[0.5, 0], [3.8, -2.2], [2.6, -5.8]], [[-0.5, 0], [-1.6, -5.4], [-3.8, -5.8]]], brazo: [[1, 0], [3, -2.4], [5.6 + f * 0.4, -4.4]], brazoLejos: [[-1, 0], [2, -2.6], [4.4 + f * 0.4, -4.6]] })),
  abraza: [0, 1].map((f) => Object.assign(quieta(f), { cabezaY: -0.6, cabezaX: 0.4, brazo: [[1, 0], [3.2, -1.6], [5, -0.6]], brazoLejos: [[-1, 0], [2.2, -1.8], [4.2, -0.8]] })),
  asiente: [0, 1].map((f) => Object.assign(quieta(0), { cabezaY: f ? -1 : 0, cabezaX: f ? 0.4 : 0 })),
  cae_mal: [{ cuerpoY: -4.5, cabezaY: -1.5, inclina: 3, poncho: 'agachada', ojos: 'cerrados', trenza: 1, piernas: [[[0.5, 0], [3.6, -1.4], [5.4, -4.6]], [[-0.5, 0], [2, -2], [3.6, -5]]], brazo: [[1, 0], [3, -2], [5, -3.5]] }],
};

/* todos los cuadros de Killa, dibujados una sola vez */
export function cuadrosKilla() {
  const r = {};
  for (const [n, poses] of Object.entries(POSES_KILLA)) r[n] = poses.map((P) => dibujarKilla(P));
  return r;
}
export const KILLA_LIENZO = { w: W, h: H, cx: CX };
