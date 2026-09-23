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

/* ---------------- gente ----------------
   Cada persona es un cuerpo con articulaciones (como Killa): cadera, hombros,
   codos, manos, rodillas y cabeza. Cada cuadro de cada animación es una pose.
   Se pide con una clave "animación:cuadro" (por ejemplo "camina:3"). */
export const ANIM_GENTE = {
  /* nombre: [cuadros, cuadros por segundo] */
  quieto: [4, 2.4], habla: [4, 7], camina: [6, 9], saluda: [4, 7], senala: [2, 3], asiente: [2, 4], abraza: [2, 2.5],
  teje: [4, 5], acomoda: [4, 3], pica: [4, 4.5], seca: [2, 2], palea: [4, 4.5], da: [2, 2], flota: [4, 3], baston: [2, 2.5],
};
/* la tarea de cada uno cuando nadie le habla */
export const TAREA = { abuela: 'teje', rosa: 'acomoda', ceferino: 'pica', tomas: 'palea', coquena: 'flota' };
const R = (x, y) => [x, y];
/* los brazos: [hombro, codo, mano] relativos al centro (cx) y al piso */
const BRAZO = { rest: [R(4, 23), R(6, 19), R(7, 15.5)], lejos: [R(-3, 23), R(-4, 19), R(-4, 15.5)] };
function pose(anim, f, o) {
  const P = { cuerpoY: 0, inclina: 0, cabezaX: 0, cabezaY: 0, boca: false, ojos: true, paso: 0, brazo: BRAZO.rest, brazoL: BRAZO.lejos, prop: o.prop, propF: 0 };
  const a = f / 6 * Math.PI * 2;
  switch (anim) {
    case 'quieto': P.cabezaY = f === 2 ? -0.5 : 0; P.cuerpoY = f === 1 || f === 2 ? 0 : 0; P.ojos = f !== 3; P.brazo = [R(4, 23), R(6, 19 - (f === 2 ? 0.4 : 0)), R(7, 15.5 - (f === 2 ? 0.4 : 0))]; break;
    case 'habla': {
      P.boca = f % 2 === 0;
      const M = [[R(8, 19), R(10.5, 21)], [R(8.5, 19.5), R(11.5, 19)], [R(7.5, 21), R(9.5, 24.5)], [R(6.5, 19), R(8, 17)]][f];
      P.brazo = [R(4, 23), M[0], M[1]]; P.cabezaX = f === 2 ? 0.5 : 0; P.cabezaY = f === 1 ? -0.4 : 0;
      break;
    }
    case 'camina': {
      P.paso = Math.sin(a); P.cuerpoY = Math.round(Math.abs(Math.cos(a)) * 0.7);
      P.brazo = [R(4, 23), R(5 + Math.sin(a) * 1.5, 19), R(6 + Math.sin(a) * 2.4, 15.8)];
      P.brazoL = [R(-3, 23), R(-3 - Math.sin(a) * 1.5, 19), R(-3 - Math.sin(a) * 2.4, 15.8)];
      break;
    }
    case 'saluda': { const w = f % 2 ? 1.6 : -0.8; P.brazo = [R(4, 23), R(8, 26), R(8.5 + w, 31)]; P.boca = f === 1 || f === 2; P.cabezaY = 0.3; break; }
    case 'senala': P.brazo = [R(4, 23), R(8, 25.5), R(12, 28 + f * 0.6)]; P.cabezaX = 0.6; P.cabezaY = 0.6; P.boca = f === 1; break;
    case 'asiente': P.cabezaY = f ? -1 : 0; P.cabezaX = f ? 0.4 : 0; break;
    case 'abraza': P.brazo = [R(4, 23), R(8.5, 21), R(11, 20.5 + f * 0.4)]; P.brazoL = [R(-3, 23), R(6, 21), R(9.5, 21)]; P.inclina = 1; break;
    case 'teje': P.brazo = [R(4, 23), R(7, 18.5), R(8 + (f % 2) * 0.6, 17)]; P.brazoL = [R(-3, 23), R(4, 18), R(6.5 - (f % 2) * 0.6, 17)]; P.propF = f; P.cabezaY = -0.6; P.cabezaX = 0.3; P.prop = 'agujas'; break;
    case 'acomoda': P.brazo = [R(4, 23), R(7, 19), R(8 + (f % 2), 16 + (f === 2 ? 1 : 0))]; P.cabezaX = f === 1 ? 0.5 : 0; P.cabezaY = f === 1 ? -0.4 : 0; break;
    case 'pica': {
      /* levanta el pico, lo baja contra la sal, lo vuelve a subir */
      const M = [[R(6, 28), R(6.5, 32)], [R(8, 25), R(10, 27)], [R(9, 18), R(11, 14)], [R(7.5, 22), R(9, 21)]][f];
      P.brazo = [R(4, 23), M[0], M[1]]; P.brazoL = [R(-3, 23), R(M[0][0] - 2, M[0][1] - 0.5), R(M[1][0] - 1.5, M[1][1] - 0.5)];
      P.inclina = [0, 1, 3, 1][f]; P.cabezaY = f === 2 ? -1 : 0; P.propF = f; P.prop = 'pico';
      break;
    }
    case 'seca': P.brazo = [R(4, 23), R(7, 27), R(5.5 + f, 30.5)]; P.ojos = !!f; P.prop = null; break;
    case 'palea': {
      const M = [[R(8, 18), R(11, 13)], [R(8, 21), R(11, 19)], [R(8, 25), R(12, 26)], [R(7, 21), R(9, 18)]][f];
      P.brazo = [R(4, 23), M[0], M[1]]; P.brazoL = [R(-3, 23), R(M[0][0] - 3, M[0][1]), R(M[1][0] - 3, M[1][1] - 1)];
      P.inclina = [3, 2, 0, 1][f]; P.propF = f; P.prop = 'pala';
      break;
    }
    case 'da': P.brazo = [R(4, 23), R(8.5, 21.5), R(12, 21 + f * 0.4)]; P.prop = 'farol'; P.boca = !!f; break;
  }
  return P;
}
/* dibujar una pose: o = colores y ropa de cada uno */
function persona(o, P) {
  const L = base(32, 42), cx = 14 + (P.inclina || 0) * 0.3, cy = P.cuerpoY || 0;
  const brazo = (pts, lejos, col) => {
    const [h, c, m] = pts, z = lejos ? -3 : 4;
    const cc = lejos ? oscurecer(col, 0.72) : col;
    L.linea(cx + h[0], cy + h[1], cx + c[0], cy + c[1], cc, 2, z);
    L.linea(cx + c[0], cy + c[1], cx + m[0], cy + m[1], cc, 2, z);
    L.rect(Math.round(cx + m[0]) - 1, Math.round(cy + m[1]) - 1, Math.round(cx + m[0]), Math.round(cy + m[1]), lejos ? pielO : piel, z);
  };
  const colBrazo = o.mameluco ? (o.camisa || '#a0402a') : o.manta || o.poncho;
  if (P.brazoL) brazo(P.brazoL, true, colBrazo);
  const s = P.paso || 0;
  if (o.pollera) {
    /* pollera ancha que se hamaca al caminar */
    L.poligono([[cx - 5, 17 + cy], [cx + 5, 17 + cy], [cx + 9 + s, 1], [cx - 9 + s, 1]], (x, y) => (y < 4 ? o.pollera2 : y > 13 ? oscurecer(o.pollera, 0.9) : o.pollera));
    L.rect(Math.round(cx - 3 - s * 2), 0, Math.round(cx - 1 - s * 2), 1, '#2a1a14'); L.rect(Math.round(cx + 1 + s * 2), 0, Math.round(cx + 3 + s * 2), 1, '#2a1a14');
    L.poligono([[cx - 6, 25 + cy], [cx + 6, 25 + cy], [cx + 8, 15 + cy], [cx - 8, 15 + cy]], (x, y) => ((y + (x >> 1)) % 4 < 1 ? o.manta2 : o.manta));
    L.poner(cx + 1, 20 + cy, o.prende || '#f2d23c');
  } else {
    /* piernas con rodilla */
    const pierna = (hx, q, lejos) => {
      const k = Math.sin(q), c = lejos ? oscurecer(o.pant, 0.75) : o.pant;
      const rod = [hx + k * 1.6, 5 + Math.max(0, Math.cos(q)) * 0.8], pie = [hx + k * 3, 0.5];
      L.linea(cx + hx, 10 + cy, cx + rod[0], rod[1], c, 3, lejos ? -2 : 1);
      L.linea(cx + rod[0], rod[1], cx + pie[0], pie[1], c, 3, lejos ? -2 : 1);
      L.rect(Math.round(cx + pie[0] - 1.5), 0, Math.round(cx + pie[0] + 1.5), 0, '#241612', lejos ? -2 : 1);
    };
    const q = Math.asin(Math.max(-1, Math.min(1, s)));
    pierna(-1.5, q + Math.PI, true); pierna(2, q, false);
    if (o.mameluco) {
      L.rect(cx - 4, 9 + cy, cx + 5, 24 + cy, o.mameluco);
      L.rect(cx - 2, 18 + cy, cx + 3, 24 + cy, oscurecer(o.mameluco, 0.85));
      L.poner(cx - 1, 22 + cy, '#d8d8d8'); L.poner(cx + 2, 22 + cy, '#d8d8d8');
      if (o.pañuelo) L.rect(cx - 3, 24 + cy, cx + 4, 25 + cy, o.pañuelo);
    } else {
      L.poligono([[cx - 4, 26 + cy], [cx + 5, 26 + cy], [cx + 9, 10 + cy], [cx - 8, 10 + cy]], (x, y) => (Math.round(y - cy) === 12 || Math.round(y - cy) === 13 ? o.ponchoFranja : Math.round(y) % 5 === 0 ? oscurecer(o.poncho, 0.85) : o.poncho));
    }
  }
  /* lo que tiene en las manos, detrás de la mano de adelante */
  const m = P.brazo[2], mx = cx + m[0], my = cy + m[1];
  if (P.prop === 'pico') {
    const ang = [2.2, 1.2, -0.9, 0.6][P.propF || 0];
    const px = mx + Math.cos(ang) * 8, py = my + Math.sin(ang) * 8;
    L.linea(mx, my, px, py, '#6a4a2a', 1, 3);
    L.linea(px - Math.sin(ang) * 3, py + Math.cos(ang) * 3, px + Math.sin(ang) * 3, py - Math.cos(ang) * 3, '#8a8a90', 2, 3);
    if (P.propF === 2) { L.poner(px + 1, 0, '#f6f4ee'); L.poner(px - 1, 1, '#f6f4ee'); }
  } else if (P.prop === 'pala') {
    const ang = [-1.2, -0.3, 0.7, -0.6][P.propF || 0];
    const px = mx + Math.cos(ang) * 7, py = Math.max(0.5, my + Math.sin(ang) * 7);
    L.linea(mx - Math.cos(ang) * 3, my - Math.sin(ang) * 3, px, py, '#6a4a2a', 1, 3);
    L.rect(Math.round(px) - 1, Math.round(py) - 1, Math.round(px) + 1, Math.round(py) + 1, '#5a5a62', 3);
    if (P.propF === 1 || P.propF === 2) L.poner(px, py + 1.4, '#1a1a1e', 3);
  } else if (P.prop === 'agujas') {
    const d = (P.propF % 2) ? 1 : -1;
    L.linea(mx - 3, my + 2 + d * 0.5, mx + 1, my - 1, '#d8c8a0', 1, 5); L.linea(mx - 1, my - 1, mx + 2, my + 2 - d * 0.5, '#d8c8a0', 1, 5);
    L.elipse(cx + 8, 11 + cy, 1.8, 1.6, o.lana || '#1f8f6c', 5); L.linea(cx + 8, 12.5 + cy, mx, my, o.lana || '#1f8f6c', 1, 5);
    L.rect(Math.round(mx) - 3, Math.round(my) - 3, Math.round(mx), Math.round(my) - 2, o.lana || '#1f8f6c', 5);
  } else if (P.prop === 'apoyado') {
    /* el pico apoyado en el suelo, al lado */
    L.linea(mx, my, mx + 1, 2, '#6a4a2a', 1, 3); L.linea(mx - 2, 1.5, mx + 4, 1, '#8a8a90', 2, 3);
  } else if (P.prop === 'farol') {
    L.rect(Math.round(mx), Math.round(my) - 5, Math.round(mx) + 3, Math.round(my) - 1, '#3a3a3a', 5); L.rect(Math.round(mx) + 1, Math.round(my) - 4, Math.round(mx) + 2, Math.round(my) - 2, '#ffd070', 5);
  } else if (o.canasta) {
    L.elipse(mx + 1, my - 3, 3.4, 2.4, '#b08a50', 5); L.rect(Math.round(mx) - 2, Math.round(my) - 2, Math.round(mx) + 4, Math.round(my) - 2, '#8a6a3a', 5);
  }
  /* cabeza */
  const hx = cx + 1 + (P.cabezaX || 0), hy = (o.pollera ? 29 : 31) + cy + (P.cabezaY || 0);
  L.elipse(hx, hy, 4.4, 4.4, (x, y) => (o.barba && y < hy - 1 && x > hx - 3 ? o.barba : x < hx - 2 ? o.pelo : piel));
  if (P.ojos) { L.poner(hx + 1, hy + 0.3, '#140c10'); L.poner(hx + 3.4, hy + 0.3, '#140c10'); }
  else { L.poner(hx + 1, hy - 0.2, pielO); L.poner(hx + 3.4, hy - 0.2, pielO); }
  L.poner(hx + 2.2, hy - 2.2, P.boca ? '#6a2a2a' : pielO);
  if (P.boca) L.poner(hx + 2.2, hy - 2.9, '#6a2a2a');
  if (!o.barba) { L.poner(hx, hy - 1.4, '#d8786a'); L.poner(hx + 4, hy - 1.4, '#d8786a'); }
  if (o.arrugas) { L.poner(hx + 4.2, hy + 1, pielO); L.poner(hx, hy + 1.3, pielO); }
  if (o.hollin) { L.poner(hx + 3, hy - 1, '#5a4a4a'); L.poner(hx - 1, hy - 2, '#5a4a4a'); }
  if (o.pollera) {
    for (let i = 0; i < 10; i++) L.poner(hx - 4 - (i > 5 ? 0.4 : 0) - s * 0.3 * (i / 10), hy - 2 - i, i % 2 ? oscurecer(o.pelo, 1.3) : o.pelo);
    L.poner(hx - 4.4, hy - 12, o.cinta || '#d6246e');
  }
  if (o.sombrero === 'bombin') {
    L.rect(hx - 6, hy + 3, hx + 6, hy + 3, '#1c1618'); L.elipse(hx, hy + 5.5, 3.2, 2.6, '#2a2226'); L.rect(hx - 3, hy + 4, hx + 3, hy + 4, '#6a1f2a');
  } else if (o.sombrero === 'paja') {
    L.rect(hx - 8, hy + 3, hx + 8, hy + 3, '#d8b870'); L.elipse(hx, hy + 5, 3.6, 2.2, '#e0c47c'); L.rect(hx - 3, hy + 4, hx + 3, hy + 4, '#b8262f');
  } else if (o.sombrero) {
    L.rect(hx - 7, hy + 3, hx + 7, hy + 3, o.sombrero); L.rect(hx - 3, hy + 4, hx + 3, hy + 6, oscurecer(o.sombrero, 1.15)); L.rect(hx - 3, hy + 4, hx + 3, hy + 4, '#3a2a1a');
  }
  if (o.gorra) { L.elipse(hx, hy + 4, 4.6, 2.2, o.gorra); L.rect(hx + 2, hy + 3, hx + 7, hy + 3, oscurecer(o.gorra, 0.7)); }
  /* el brazo de adelante, encima de todo */
  brazo(P.brazo, false, colBrazo);
  return fin(L);
}
/* "habla:2" -> ['habla', 2]; un número viejo (0/1) es quieto o habla */
function clave(k) { if (typeof k === 'number') return k % 2 ? ['habla', 0] : ['quieto', 0]; const [a, f] = String(k).split(':'); return [a, +f || 0]; }
const ROPA = {
  abuela: { pollera: '#5a2a5a', pollera2: '#e8b83a', manta: '#c0282e', manta2: '#f2b632', pelo: '#8a8490', sombrero: 'bombin', arrugas: true, cinta: '#1f8f6c', lana: '#1f8f6c' },
  rosa: { pollera: '#1f6f8a', pollera2: '#f2d23c', manta: '#e8702a', manta2: '#6a2f9a', pelo: '#1d1418', sombrero: 'paja', canasta: true },
  ceferino: { pant: '#4a3a2a', poncho: '#8a5a3a', ponchoFranja: '#e8d8b8', pelo: '#2a2020', barba: '#e8e0d8', sombrero: '#6a5a4a', prop: 'apoyado' },
  tomas: { pant: '#2a3a5a', mameluco: '#3a5a8a', camisa: '#a0402a', pañuelo: '#c0282e', pelo: '#1d1418', gorra: '#2a3a5a', hollin: true },
};
function coquena(k) {
  const [anim, f] = clave(k);
  const L = base(22, 28), cx = 9, bob = anim === 'flota' || anim === 'quieto' ? [0, 1, 1, 0][f % 4] : 0;
  const brillo = f % 2 ? '#fff6a0' : '#ffe060';
  L.poligono([[cx - 3, 13 + bob], [cx + 4, 13 + bob], [cx + 6 + (f % 2) * 0.5, 1], [cx - 5 - (f % 2) * 0.5, 1]], (x, y) => ((y >> 1) % 3 === 0 ? '#e8d4a8' : '#c8a878'));
  L.elipse(cx + 0.5, 16 + bob, 3.4, 3.2, (x, y) => (y > 17 + bob ? '#e8d4a8' : '#8a6a4a'));
  L.poner(cx + 1, 16 + bob, brillo); L.poner(cx + 3, 16 + bob, brillo);
  /* el bastón: parado, levantado o saludando */
  const alto = anim === 'baston' ? 6 + f * 2 : anim === 'saluda' ? 5 : anim === 'habla' ? 1 + (f % 2) : 0;
  const bx = cx + 6 + (anim === 'saluda' ? (f % 2 ? 1.5 : -0.5) : 0);
  L.linea(bx, 1 + alto, bx + 1, 19 + alto, '#6a4a2a', 1); L.poner(bx + 1, 20 + alto, brillo); if (alto > 4) { L.poner(bx + 2, 21 + alto, '#fff6a0'); L.poner(bx, 21 + alto, '#fff6a0'); }
  return fin(L);
}
export const ELENCO = {
  abuela: (k) => { const [a, f] = clave(k); return persona(ROPA.abuela, pose(a, f, ROPA.abuela)); },
  rosa: (k) => { const [a, f] = clave(k); return persona(ROPA.rosa, pose(a, f, ROPA.rosa)); },
  ceferino: (k) => { const [a, f] = clave(k); return persona(ROPA.ceferino, pose(a, f, ROPA.ceferino)); },
  tomas: (k) => { const [a, f] = clave(k); return persona(ROPA.tomas, pose(a, f, ROPA.tomas)); },
  coquena,
};

/* ---------------- animales ----------------
   Cuadros: 0-1 quietos (rumian, pastan), 2-5 caminando (o corriendo). */
function cuadrupedo(o, f, n) {
  const L = base(o.w, o.h), a = (f / n) * Math.PI * 2;
  const cuerpoY = o.patas + 1 + (o.corre ? Math.abs(Math.cos(a)) * (o.brinco || 1.2) : 0);
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
const camina = (f) => f >= 2;
export const ANIMALES = {
  llama: (f) => cuadrupedo({ w: 26, h: 34, x0: 3, x1: 17, alto: 9, patas: 12, col: '#e8dcc8', panza: '#d8c8b0', corre: camina(f), paso: 2.2, brinco: 0.5, cabeza: (L, y, g, a) => {
    const cab = camina(f) ? Math.sin(a) * 0.5 : 0;
    L.linea(16, y + 7, 18, y + 18 + cab, '#e8dcc8', 3);
    L.elipse(19.5, y + 19.5 + cab, 3, 2, '#e8dcc8'); L.poner(21, y + 19.5 + cab, '#140c10');
    L.linea(18, y + 21 + cab, 17.5, y + 23.5 + cab, '#e8dcc8', 1); L.linea(20, y + 21 + cab, 20.5, y + 23.5 + cab, '#e8dcc8', 1);
    L.poner(17.5, y + 24 + cab, '#d6246e'); L.poner(20.5, y + 24 + cab, '#1f8f6c');
    if (f === 1) L.poner(22, y + 18.6, '#8a7a6a');
    L.linea(2, y + 8, 1, y + 6 + (camina(f) ? Math.sin(a) : 0), '#d8c8b0', 2);
  } }, camina(f) ? f - 2 : f, camina(f) ? 4 : 2),
  vicuna: (f) => cuadrupedo({ w: 24, h: 26, x0: 3, x1: 15, alto: 6, patas: 10, col: '#c8904a', panza: '#f2e6d0', paso: 3, corre: camina(f), cabeza: (L, y) => {
    /* quieta, pastando: la cabeza baja en el cuadro 1 */
    const baja = f === 1 ? -7 : 0;
    L.linea(14, y + 4, 16, y + 11 + baja, '#c8904a', 2);
    L.elipse(17.5, y + 11.5 + baja, 2.4, 1.6, '#c8904a'); L.poner(18.5, y + 12 + baja, '#140c10');
    L.poner(16.5, y + 13.5 + baja, '#a07030'); L.poner(18, y + 13.5 + baja, '#a07030');
    L.rect(13, y + 3, 15, y + 5, '#f2e6d0');
  } }, camina(f) ? f - 2 : f, camina(f) ? 4 : 2),
  puma: (f) => cuadrupedo({ w: 40, h: 22, x0: 4, x1: 30, alto: 7, patas: 7, col: '#b88a54', panza: '#e0c8a0', paso: 5, corre: f < 4, grosorPata: 3, cabeza: (L, y, g, a) => {
    L.elipse(32.5, y + 6, 4.4, 3.8, '#b88a54');
    L.poner(34, y + 6.5, '#f2d23c'); L.poner(36, y + 6.5, '#f2d23c'); L.poner(34, y + 6.5, '#2a1a10');
    L.rect(35, y + 3, 37, y + 4, '#e0c8a0'); L.poner(37, y + 4, '#3a2020');
    L.poner(30.5, y + 10, '#8a6a44'); L.poner(33.5, y + 10, '#8a6a44');
    /* la cola larga */
    for (let i = 0; i < 9; i++) L.poner(4 - i * 0.5, y + 5 + Math.sin(a + i * 0.5) * 1.5 + i * 0.3, i > 6 ? '#5a3a24' : '#b88a54');
  } }, f, 4),
  flamenco: (f) => {
    const L = base(16, 30), anda = camina(f), g = f - 2;
    /* patas: una recogida (quieto), o las dos alternando (caminando) */
    if (anda) { L.linea(7, 12, 7 + (g % 2 ? 2 : -1), 0, '#e07a80', 1); L.linea(8, 12, 8 + (g % 2 ? -1 : 2), 0, '#e07a80', 1); }
    else { L.linea(7, 12, 7, 0, '#e07a80', 1); if (f % 2) L.linea(7, 8, 10, 6, '#e07a80', 1); else L.linea(8, 12, 8, 0, '#e07a80', 1); }
    L.elipse(7, 14, 4, 2.6, '#f28c9a');
    L.rect(4, 14, 8, 14, '#e0606a');
    /* el cuello: arriba, o picoteando el agua */
    const pica = !anda && f === 1;
    if (pica) { L.linea(9, 15, 12, 10, '#f28c9a', 1); L.linea(12, 10, 13, 5, '#f28c9a', 1); L.elipse(13.5, 4.5, 1.6, 1.2, '#f28c9a'); L.poner(14.4, 3.4, '#1a1a1a'); }
    else { L.linea(9, 15, 10, 22, '#f28c9a', 1); L.linea(10, 22, 12, 25, '#f28c9a', 1); L.elipse(12, 25.5, 1.6, 1.2, '#f28c9a'); L.poner(13.4, 24.6, '#1a1a1a'); L.poner(12.8, 26, '#140c10'); }
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
