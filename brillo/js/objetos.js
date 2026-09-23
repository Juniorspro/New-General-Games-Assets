/* brillo/js/objetos.js — las cosas del mundo, en pixel art de vidrio:
   gotitas, guiños, sesiones (monitorcitos), el orbe de cada mundo, las
   plataformas de vidrio, los hongos, los planitos y los bloques planos.
   Lo plano (planitos, bloques, estática) va sin brillo y sin volumen a
   propósito: es lo que la Actualización le hace al mundo. */
import { Lienzo, RAMPA, pintura, mezclar, lienzo2d } from './pixel.js';

const cache = new Map();
const hecho = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

/* una gotita de brillo: gota de agua celeste con reflejo */
export function gota(f) {
  return hecho('gota' + (f % 4), () => {
    const L = new Lienzo(11, 14), R = RAMPA.cian;
    const brillo = (f % 4) / 4;
    L.elipse(5.5, 8.5, 4.3, 4.6, pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.55, punto: 0.08 }), R);
    L.poligono([[5.5, 1], [2.2, 6.8], [8.8, 6.8]], (u, v) => R[v < 0 ? 6 : 5], R);
    L.contorno({ tono: 1 });
    /* el destello que recorre la gota */
    const y = Math.round(3 + brillo * 9); for (let x = 3; x < 9; x++) if (L.hay(x, y)) L.punto(x, y, '#ffffff');
    return L.aCanvas();
  });
}

/* un guiño: carita de vidrio amarilla que guiña */
export function guino(f) {
  return hecho('guino' + (f % 2), () => {
    const L = new Lienzo(20, 20), R = RAMPA.amarillo;
    L.elipse(10, 10, 8.4, 8.4, pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.5, punto: 0.06 }), R);
    L.contorno({ tono: 1 });
    const o = '#5a3c00';
    /* un ojo abierto y el otro guiñando */
    L.punto(6, 8, o); L.punto(7, 8, o); L.punto(6, 9, o); L.punto(7, 9, o);
    if (f % 2) { L.punto(12, 9, o); L.punto(13, 8, o); L.punto(14, 9, o); } else { L.punto(12, 8, o); L.punto(13, 8, o); L.punto(12, 9, o); L.punto(13, 9, o); }
    for (let x = 6; x <= 14; x++) L.punto(x, 13 + (x > 7 && x < 13 ? 1 : 0), o);
    L.punto(5, 12, o); L.punto(15, 12, o);
    return L.aCanvas();
  });
}

/* una sesión: un monitorcito en su pie; prendido muestra la tilde verde */
export function sesion(prendida, f) {
  return hecho(`ses${prendida ? 1 : 0}${f % 4}`, () => {
    const L = new Lienzo(24, 28), Bl = RAMPA.blanco;
    L.caja(2, 2, 22, 18, 3, pintura.vertical(Bl, 7, 4), Bl);
    L.caja(4, 4, 20, 15, 1, prendida ? (u, v) => mezclar(RAMPA.azul[4], RAMPA.azul[6], Math.max(0, -v) * 0.8) : () => RAMPA.gris[3], prendida ? RAMPA.azul : RAMPA.gris);
    /* el reflejo en diagonal de la pantalla */
    for (let i = 0; i < 6; i++) L.punto(6 + i, 5 + (5 - i), prendida ? '#e6f5ff' : RAMPA.gris[5]);
    if (prendida) {
      const V = RAMPA.verde;
      [[9, 10], [10, 11], [11, 12], [12, 11], [13, 10], [14, 9], [15, 8]].forEach(([x, y]) => { L.punto(x, y, V[5], V); L.punto(x, y + 1, V[3], V); });
    }
    L.caja(10, 18, 14, 23, 1, pintura.vertical(Bl, 6, 3), Bl);
    L.caja(6, 23, 18, 26, 2, pintura.vertical(Bl, 7, 4), Bl);
    L.contorno({ tono: 0 });
    if (prendida && f % 4 === 0) L.punto(19, 3, '#ffffff');
    return L.aCanvas();
  });
}

/* el orbe de cada mundo: una esfera grande de vidrio con algo adentro */
export const ORBES = {
  colina: { rampa: RAMPA.verde, adentro: 'hoja' },
  arrecife: { rampa: RAMPA.cian, adentro: 'perla' },
  ciudad: { rampa: RAMPA.azul, adentro: 'prisma' },
  cielo: { rampa: RAMPA.rosa, adentro: 'arco' },
  aurora: { rampa: RAMPA.violeta, adentro: 'estrella' },
};
export function orbe(mundo, f) {
  return hecho(`orbe${mundo}${f % 8}`, () => {
    const O = ORBES[mundo] || ORBES.colina, R = O.rampa;
    const L = new Lienzo(36, 36);
    L.elipse(18, 18, 15.5, 15.5, pintura.aero(R, { bajo: 1, alto: 6, gorra: 0.55, punto: 0.05 }), R);
    /* lo de adentro, que gira */
    const a = f / 8 * Math.PI * 2;
    if (O.adentro === 'hoja') {
      const V = RAMPA.verde, s = Math.cos(a);
      L.elipse(18, 19, 6 * Math.max(0.3, Math.abs(s)), 8, pintura.esfera(V, { bajo: 3, alto: 7 }), V);
      L.linea(18, 12, 18, 26, V[1], V);
    } else {
      L.elipse(18, 19, 5, 5, pintura.aero(RAMPA.blanco, { bajo: 3, alto: 7 }), RAMPA.blanco);
    }
    L.contorno({ tono: 0 });
    /* el reflejo que da vuelta */
    const rx = Math.round(18 + Math.cos(a) * 10), ry = Math.round(18 + Math.sin(a) * 3 - 6);
    L.punto(rx, ry, '#ffffff'); L.punto(rx + 1, ry, '#ffffff');
    return L.aCanvas();
  });
}

/* una plataforma de vidrio de w baldosas */
export function plataforma(w) {
  return hecho('plat' + w, () => {
    const L = new Lienzo(w * 16, 8), R = RAMPA.cian;
    L.caja(0, 0, w * 16, 7, 3, (u, v) => (v < -0.5 ? R[7] : v < 0 ? R[6] : v < 0.5 ? R[5] : R[4]), R);
    for (let x = 4; x < w * 16 - 4; x += 9) L.punto(x, 2, '#ffffff');
    L.contorno({ tono: 2 });
    return L.aCanvas();
  });
}

/* un tablón de vidrio (baldosa '='): repisa fina transparente */
export function tablon(izq, der) {
  return hecho(`tab${izq ? 1 : 0}${der ? 1 : 0}`, () => {
    const L = new Lienzo(16, 7), R = RAMPA.cian;
    L.caja(izq ? 1 : 0, 0, der ? 15 : 16, 5, izq || der ? 2 : 0, (u, v) => (v < -0.4 ? R[7] : v < 0.3 ? R[6] : R[5]), R);
    if (izq) L.punto(4, 1, '#ffffff');
    L.contorno({ tono: 3 });
    return L.aCanvas();
  });
}

/* un hongo de vidrio que rebota; f = cuánto se aplasta (0-3) */
export function hongo(f) {
  return hecho('hongo' + f, () => {
    const L = new Lienzo(20, 18), R = RAMPA.rosa, ap = [1, 0.7, 0.85, 1.1][f % 4];
    L.caja(7, 9, 13, 17, 2, pintura.vertical(RAMPA.blanco, 7, 4), RAMPA.blanco);
    L.elipse(10, 17 - 8 * ap, 9, 7 * ap, (u, v) => (v > 0.35 ? null : pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.5 })(u, v)), R);
    for (const [x, y] of [[6, -5], [11, -6], [14, -3]]) L.elipse(x, 17 - 8 * ap + y * ap + 2, 1.5, 1.2, '#ffffff', RAMPA.blanco);
    L.contorno({ tono: 0 });
    return L.aCanvas();
  });
}

/* un planito: un cuadrado gris sin brillo ni sombra, con ojos planos */
export function planito(f, dir) {
  return hecho(`plan${f % 2}${dir > 0 ? 1 : 0}`, () => {
    const [c, g] = lienzo2d(16, 16);
    const bajo = f % 2;
    g.fillStyle = '#8e949c'; g.fillRect(1, 2 + bajo, 14, 14 - bajo);
    g.fillStyle = '#7a8088'; g.fillRect(1, 15, 14, 1);
    g.fillStyle = '#4f545b';
    const ox = dir > 0 ? 2 : 0;
    g.fillRect(4 + ox, 6 + bajo, 2, 3); g.fillRect(9 + ox, 6 + bajo, 2, 3);
    g.fillRect(5 + ox, 11 + bajo, 5, 1);
    return c;
  });
}

/* un bloque plano (baldosa '%'): gris parejo, un borde apenas más oscuro */
export function bloquePlano(f) {
  return hecho('bloq' + (f || 0), () => {
    const [c, g] = lienzo2d(16, 16);
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#868c94'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
    g.fillStyle = '#aab0b7'; g.fillRect(0, 0, 15, 1); g.fillRect(0, 0, 1, 15);
    return c;
  });
}

/* la estática: ruido gris que cambia cada cuadro (se dibuja directo) */
export function estatica(g, x, y, f) {
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j += 2) {
    const n = ((x * 31 + i * 7 + j * 13 + f * 17) * 2654435761 >>> 0) / 4294967296;
    g.fillStyle = n < 0.33 ? '#5c6068' : n < 0.66 ? '#8a8f97' : '#b5bac1';
    g.fillRect(x + i, y + j, 1, 2);
  }
}
