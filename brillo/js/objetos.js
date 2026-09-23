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

/* los emoticones (lo que se gana con cada guiño): caritas y cositas de vidrio de 20x20 */
export function emoticon(n) {
  return hecho('emo' + n, () => {
    const L = new Lienzo(22, 22), A = RAMPA.amarillo, o = '#5a3c00';
    const cara = (R = A) => { L.elipse(11, 11, 9, 9, pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.5, punto: 0.06 }), R); };
    const ojos = (tipo) => {
      if (tipo === 'guino') { L.punto(7, 8, o); L.punto(8, 8, o); L.punto(7, 9, o); L.punto(8, 9, o); L.punto(13, 9, o); L.punto(14, 8, o); L.punto(15, 9, o); }
      else if (tipo === 'risa') { L.punto(7, 9, o); L.punto(8, 8, o); L.punto(9, 9, o); L.punto(13, 9, o); L.punto(14, 8, o); L.punto(15, 9, o); }
      else { for (const x of [7, 14]) { L.punto(x, 8, o); L.punto(x + 1, 8, o); L.punto(x, 9, o); L.punto(x + 1, 9, o); } }
    };
    const sonrisa = (grande) => { for (let x = 7; x <= 15; x++) L.punto(x, 14 + (x > 8 && x < 14 ? 1 : 0), o); if (grande) for (let x = 9; x <= 13; x++) L.punto(x, 15, '#c0282e'); L.punto(6, 13, o); L.punto(16, 13, o); };
    switch (n) {
      case 'sonrisa': cara(); ojos(); sonrisa(); break;
      case 'guino': cara(); ojos('guino'); sonrisa(); break;
      case 'risa': cara(); ojos('risa'); sonrisa(true); break;
      case 'corazon': { const R = RAMPA.rosa; L.elipse(7.5, 8.5, 5.5, 5.5, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.elipse(14.5, 8.5, 5.5, 5.5, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.poligono([[2.3, 10], [19.7, 10], [11, 20]], (u, v) => R[v < 0 ? 4 : 3], R); break; }
      case 'nota': { const R = RAMPA.violeta; L.elipse(7, 16, 4, 3.2, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.caja(10, 3, 12, 16, 0, R[3], R); L.caja(10, 3, 18, 6, 1, R[4], R); break; }
      case 'estrella': { const R = RAMPA.amarillo, p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9.5; p.push([11 + Math.cos(a) * r, 11.5 + Math.sin(a) * r]); } L.poligono(p, (u, v) => R[v < -0.3 ? 6 : v < 0.3 ? 5 : 4], R); break; }
      case 'sol': { const R = RAMPA.naranja; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L.capsula(11, 11, 11 + Math.cos(a) * 9.5, 11 + Math.sin(a) * 9.5, 1.2, R[5], R); } L.elipse(11, 11, 6, 6, pintura.aero(RAMPA.amarillo, { bajo: 3, alto: 7 }), RAMPA.amarillo); break; }
      case 'luna': { const R = RAMPA.amarillo; L.elipse(11, 11, 8.5, 8.5, pintura.aero(R, { bajo: 3, alto: 6 }), R); for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) if ((x - 15) ** 2 + (y - 8) ** 2 < 49) L.borrar(x, y); break; }
      case 'flor': { const R = RAMPA.rosa; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; L.elipse(11 + Math.cos(a) * 5.5, 11 + Math.sin(a) * 5.5, 4, 4, pintura.aero(R, { bajo: 2, alto: 6 }), R); } L.elipse(11, 11, 3.5, 3.5, pintura.esfera(RAMPA.amarillo, { bajo: 3, alto: 6 }), RAMPA.amarillo); break; }
      case 'arcoiris': { const cs = [RAMPA.rosa, RAMPA.naranja, RAMPA.amarillo, RAMPA.verde, RAMPA.azul, RAMPA.violeta]; cs.forEach((R, i) => { const r = 10 - i * 1.4; for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) { const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 16); if (d <= r && d > r - 1.5) L.punto(x, y, R[4], R); } }); break; }
      case 'burbuja': { const R = RAMPA.cian; L.elipse(11, 11, 9, 9, (u, v) => { const q = u * u + v * v; return q > 0.72 ? R[5] : (u + 0.4) ** 2 + (v + 0.45) ** 2 < 0.06 ? '#ffffff' : null; }, R); break; }
      case 'pez': { const R = RAMPA.naranja; L.elipse(10, 11, 7, 5, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.poligono([[16, 11], [21, 6], [21, 16]], R[4], R); L.punto(6, 10, '#1a0a00'); break; }
      case 'nube': { const R = RAMPA.blanco; L.elipse(8, 13, 5.5, 4.5, pintura.esfera(R, { bajo: 3, alto: 7 }), R); L.elipse(13, 10, 6, 5.5, pintura.esfera(R, { bajo: 3, alto: 7 }), R); L.elipse(16, 14, 4.5, 3.5, pintura.esfera(R, { bajo: 3, alto: 7 }), R); break; }
      case 'regalo': { const R = RAMPA.azul; L.caja(3, 9, 19, 20, 2, pintura.vertical(R, 5, 3), R); L.caja(2, 6, 20, 10, 1, R[6], R); L.caja(10, 6, 12, 20, 0, RAMPA.rosa[4], RAMPA.rosa); L.elipse(8, 5, 3, 2, RAMPA.rosa[5], RAMPA.rosa); L.elipse(14, 5, 3, 2, RAMPA.rosa[5], RAMPA.rosa); break; }
      case 'cafe': { const R = RAMPA.blanco; L.caja(4, 8, 16, 19, 3, pintura.vertical(R, 7, 4), R); L.elipse(17, 13, 3, 3.5, R[5], R); L.elipse(10, 9, 5, 1.5, RAMPA.tierra[3], RAMPA.tierra); for (const x of [8, 11, 14]) { L.punto(x, 5, R[3]); L.punto(x + 1, 3, R[3]); } break; }
      case 'gato': { const R = RAMPA.gris; L.elipse(11, 12, 8, 7.5, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.poligono([[4, 8], [6, 1], [10, 6]], R[4], R); L.poligono([[18, 8], [16, 1], [12, 6]], R[4], R); for (const x of [7, 14]) { L.punto(x, 11, '#1a3a1a'); L.punto(x + 1, 11, '#1a3a1a'); } L.punto(11, 14, RAMPA.rosa[3]); break; }
      case 'perro': { const R = RAMPA.tierra; L.elipse(11, 12, 8, 7.5, pintura.aero(R, { bajo: 3, alto: 6 }), R); L.elipse(4, 11, 2.5, 5, R[2], R); L.elipse(18, 11, 2.5, 5, R[2], R); for (const x of [7, 14]) { L.punto(x, 10, '#1a0a00'); L.punto(x + 1, 10, '#1a0a00'); } L.elipse(11, 15, 2, 1.5, '#1a0a00'); break; }
      case 'abrazo': { const V = RAMPA.verde, Az = RAMPA.azul; L.elipse(7, 7, 4.2, 4.2, pintura.aero(Az, { bajo: 2, alto: 6 }), Az); L.elipse(15, 7, 4.2, 4.2, pintura.aero(V, { bajo: 2, alto: 6 }), V); L.elipse(7, 16, 5, 5, pintura.aero(Az, { bajo: 2, alto: 5 }), Az); L.elipse(15, 16, 5, 5, pintura.aero(V, { bajo: 2, alto: 5 }), V); break; }
      default: cara(); ojos(); sonrisa();
    }
    L.contorno({ tono: 0 });
    return L.aCanvas();
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

/* la Aurora: una cinta de luz arriba de la baldosa. Prendida, brilla y cambia
   de color (verde, cian, violeta) como las cortinas del cielo; apagada, queda
   una línea de puntitos, que se aviva cuando está por prenderse. */
const AUR = ['#7dffc0', '#6ff0e8', '#79d4ff', '#a98cff', '#e28cff', '#79d4ff'];
export function aurora(g, x, y, prendida, falta, t, tx) {
  if (prendida) {
    for (let i = 0; i < 16; i++) {
      const u = (tx * 16 + i) * 0.045 + t * 0.6, k = Math.floor(((u % AUR.length) + AUR.length) % AUR.length);
      const o = Math.round(Math.sin((tx * 16 + i) * 0.3 + t * 3) * 0.8);
      g.fillStyle = '#f4fffb'; g.fillRect(x + i, y + o, 1, 1);
      g.fillStyle = AUR[k]; g.fillRect(x + i, y + 1 + o, 1, 3);
      g.globalAlpha = 0.45; g.fillRect(x + i, y + 4 + o, 1, 3);
      g.globalAlpha = 0.18; g.fillRect(x + i, y + 7 + o, 1, 6);
      g.globalAlpha = 1;
    }
  } else {
    const cerca = falta < 36 ? 1 - falta / 36 : 0;
    g.globalAlpha = 0.22 + cerca * 0.5;
    g.fillStyle = cerca > 0 ? '#c8fff0' : '#7fb8d8';
    for (let i = (tx & 1); i < 16; i += 2) g.fillRect(x + i, y + 1, 1, 1);
    g.globalAlpha = 1;
  }
}

/* una columna de viento que sube: una banda de aire apenas celeste, rayitas
   que suben rápido, flechitas (para que se entienda para dónde empuja) y
   hojitas que giran. x, y, w, h en pantalla; ox, oy: dónde empieza la columna
   en el mundo (así el dibujo no "patina" cuando se mueve la cámara). */
export function viento(g, x, y, w, h, t, ox, oy) {
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, 'rgba(120,215,255,0.1)'); gr.addColorStop(0.5, 'rgba(200,245,255,0.36)'); gr.addColorStop(1, 'rgba(120,215,255,0.1)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  /* los bordes: una línea de puntos celeste que también sube */
  g.fillStyle = 'rgba(70,170,235,0.55)';
  for (let yy = y + (((-(t * 60 + oy)) % 6) + 6) % 6; yy < y + h; yy += 6) { g.fillRect(x, Math.round(yy), 1, 3); g.fillRect(x + w - 1, Math.round(yy), 1, 3); }
  const H = Math.max(1, h);
  /* rayitas: cada una sube a su velocidad y vuelve a empezar abajo */
  for (let i = 0, n = Math.ceil(w / 5); i < n * Math.ceil(H / 70); i++) {
    const cx = x + ((i * 37 + 3) % Math.max(1, w - 2)) + 1, v = 110 + (i * 53) % 70, largo = 6 + (i * 7) % 9;
    const cy = y + H - (((t * v + i * 97 + oy) % (H + largo)) + H + largo) % (H + largo);
    g.fillStyle = 'rgba(60,160,230,0.35)'; g.fillRect(Math.round(cx) + 1, Math.round(cy), 1, largo);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(Math.round(cx), Math.round(cy), 1, largo);
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(cx), Math.round(cy), 1, 2);
  }
  /* flechitas que suben despacio */
  for (let k = 0, n = Math.ceil(H / 56); k < n; k++) {
    const cy = y + H - (((t * 55 + k * 56 + oy * 0.5) % H) + H) % H, cx = Math.round(x + w / 2);
    g.globalAlpha = 0.9 * Math.max(0, Math.min(1, (cy - y) / 30, (y + H - cy) / 30));
    const r = Math.min(6, Math.floor(w / 2) - 1);
    for (let d = 0; d < r; d++) {
      g.fillStyle = '#2f8fe0'; g.fillRect(cx - d - 1, Math.round(cy) + d + 1, 2, 1); g.fillRect(cx + d - 1, Math.round(cy) + d + 1, 2, 1);
      g.fillStyle = '#ffffff'; g.fillRect(cx - d - 1, Math.round(cy) + d, 2, 1); g.fillRect(cx + d - 1, Math.round(cy) + d, 2, 1);
    }
    g.globalAlpha = 1;
  }
  /* hojitas verdes que suben girando */
  for (let k = 0, n = Math.ceil(H / 90); k < n; k++) {
    const cy = y + H - (((t * 80 + k * 90 + ox) % H) + H) % H, cx = x + w / 2 + Math.sin(t * 3 + k * 2) * (w / 2 - 2);
    g.fillStyle = k % 2 ? '#8fec5e' : '#c9f7a8'; g.fillRect(Math.round(cx), Math.round(cy), 2, 1);
    g.fillStyle = '#3cae1d'; g.fillRect(Math.round(cx) + (Math.sin(t * 6 + k) > 0 ? 1 : 0), Math.round(cy) + 1, 1, 1);
  }
}

/* el surtidor de las burbujas grandes: una fuentecita de vidrio con la boca oscura */
let SURT = null;
export function surtidor() {
  if (SURT) return SURT;
  const L = new Lienzo(26, 14), R = RAMPA.cian;
  L.caja(1, 5, 25, 14, 4, pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.5, punto: 0.04 }), R);
  L.elipse(13, 5.5, 8, 3, pintura.esfera(R, { bajo: 1, alto: 4 }), R);
  L.elipse(13, 5, 5.5, 1.8, () => R[0], R);
  L.contorno({ tono: 0 });
  return (SURT = L.aCanvas());
}
