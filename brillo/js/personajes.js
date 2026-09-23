/* brillo/js/personajes.js — los muñequitos.
   Nick y los demás contactos son muñequitos como el de los programas de chat
   de los 2000: cabeza redonda de vidrio y cuerpo redondeado, pero con
   piernitas, zapatillas y ojitos. Cada cuadro se arma con una "pose" (dónde
   van la cabeza, el cuerpo, los brazitos y las piernas) y se pinta con
   pixel.js; los cuadros se guardan hechos. */
import { Lienzo, RAMPA, pintura, mezclar, lienzo2d } from './pixel.js';

export const CUADRO = { w: 30, h: 36 };      // el tamaño de cada cuadro
const CX = 15, PISO = 35;                    // el centro y dónde apoyan los pies

/* la pose base, de cara a la derecha */
function poseBase() {
  return {
    cabeza: { x: CX, y: 10, r: 8 },
    cuerpo: { x: CX, y: 24.4, rx: 6.5, ry: 6.5 },
    /* las piernas: cadera → pie (el pie es la zapatilla) */
    piernas: [{ cx: CX - 2.3, cy: 28.6, px: CX - 2.6, py: PISO - 1.7 }, { cx: CX + 2.3, cy: 28.6, px: CX + 2.6, py: PISO - 1.7 }],
    /* los brazitos: hombro → mano */
    brazos: [{ hx: CX - 5.1, hy: 21.6, mx: CX - 6.7, my: 25.2 }, { hx: CX + 5.1, hy: 21.6, mx: CX + 6.7, my: 25.2 }],
    ojos: 'abiertos', boca: null, mira: 1, dy: 0,
  };
}

/* cómo se mueve cada animación: (pose, cuadro) → pose */
const ANIM = {
  quieto: { n: 6, fn(p, f) { const b = Math.sin(f / 6 * Math.PI * 2); p.dy = b * 0.5; p.cabeza.y += b * 0.35; p.brazos.forEach((a) => { a.my += b * 0.5; }); return p; } },
  parpadea: { n: 1, fn(p) { p.ojos = 'cerrados'; return p; } },
  corre: { n: 8, fn(p, f) {
    const a = f / 8 * Math.PI * 2;
    p.dy = -Math.abs(Math.sin(a)) * 1.3; p.cabeza.x += 1.2; p.cabeza.y += Math.abs(Math.sin(a)) * 0.4; p.cuerpo.x += 0.6;
    p.piernas.forEach((l, i) => { const q = a + i * Math.PI; l.px = l.cx + Math.sin(q) * 3.2; l.py = PISO - 1.7 - Math.max(0, Math.cos(q)) * 2.2; });
    p.brazos.forEach((b, i) => { const q = a + (1 - i) * Math.PI; b.mx = b.hx + Math.sin(q) * 2.6 + (i ? 0.8 : -0.8); b.my = b.hy + 3.6 - Math.abs(Math.cos(q)) * 1; });
    return p;
  } },
  salta: { n: 2, fn(p, f) {
    p.piernas[0].px -= 1.2; p.piernas[0].py -= 2.6; p.piernas[1].px += 1.5; p.piernas[1].py -= 1;
    p.brazos.forEach((b, i) => { b.mx = b.hx + (i ? 3 : -3); b.my = b.hy - 3 - f; });
    return p;
  } },
  cae: { n: 2, fn(p, f) {
    p.piernas.forEach((l, i) => { l.px = l.cx + (i ? 1.8 : -1.8); l.py -= 1.2; });
    p.brazos.forEach((b, i) => { b.mx = b.hx + (i ? 3.5 : -3.5); b.my = b.hy - 4.5 + f; });
    p.ojos = 'grandes';
    return p;
  } },
  aterriza: { n: 1, fn(p) { p.aplaste = 0.82; p.piernas.forEach((l, i) => { l.px = l.cx + (i ? 2.6 : -2.6); }); return p; } },
  /* el zumbido: tiembla entero con los brazitos abiertos */
  zumbido: { n: 4, fn(p, f) {
    const s = [1, -1, 1, -1][f] * 0.9; p.cabeza.x += s; p.cuerpo.x += s * 0.6;
    p.brazos.forEach((b, i) => { b.mx = b.hx + (i ? 4.5 : -4.5); b.my = b.hy - 1 + (f % 2); });
    p.ojos = 'fuertes'; p.boca = 'o';
    return p;
  } },
  /* flotando con la burbuja: piernitas colgando, brazos arriba */
  flota: { n: 4, fn(p, f) {
    const b = Math.sin(f / 4 * Math.PI * 2);
    p.piernas.forEach((l, i) => { l.px = l.cx + (i ? 1 : -1) + b * (i ? 0.8 : -0.8); l.py -= 0.8; });
    p.brazos.forEach((b2, i) => { b2.mx = b2.hx + (i ? 2 : -2); b2.my = b2.hy - 6; });
    p.boca = 'feliz';
    return p;
  } },
  /* nadando: brazada y patada */
  nada: { n: 6, fn(p, f) {
    const a = f / 6 * Math.PI * 2;
    p.cabeza.x += 1.2; p.cuerpo.x += 0.3;
    p.brazos.forEach((b, i) => { const q = a + i * Math.PI; b.mx = b.hx + Math.cos(q) * 4.5; b.my = b.hy + Math.sin(q) * 3.5; });
    p.piernas.forEach((l, i) => { const q = a + i * Math.PI; l.px = l.cx - 2 + Math.sin(q) * 1.6; l.py = PISO - 2.4 + Math.cos(q) * 1.2; });
    return p;
  } },
  habla: { n: 4, fn(p, f) { p.boca = f % 2 ? 'o' : 'chica'; p.brazos[1].mx += (f === 1 ? 1.5 : 0); p.brazos[1].my -= (f === 1 ? 2 : 0); return p; } },
  saluda: { n: 4, fn(p, f) { const b = p.brazos[1]; b.mx = b.hx + 3 + (f % 2) * 2; b.my = b.hy - 7; p.boca = 'feliz'; return p; } },
  feliz: { n: 4, fn(p, f) { p.dy = -[0, 2, 3, 1][f]; p.brazos.forEach((b, i) => { b.mx = b.hx + (i ? 3 : -3); b.my = b.hy - 6; }); p.ojos = 'felices'; p.boca = 'feliz'; return p; } },
  triste: { n: 2, fn(p, f) { p.cabeza.y += 1; p.ojos = 'tristes'; p.brazos.forEach((b) => { b.my += 1; }); p.dy = f * 0.3; return p; } },
  abraza: { n: 2, fn(p, f) { p.brazos.forEach((b, i) => { b.mx = b.hx + (i ? 6 : 2); b.my = b.hy + 0.5 - f; }); p.ojos = 'felices'; p.boca = 'feliz'; return p; } },
};
export const ANIMS = Object.keys(ANIM);
export const cuadrosDe = (anim) => (ANIM[anim] || ANIM.quieto).n;

/* los ojos, según el estado */
function ojos(L, p, R, plano) {
  const hx = p.cabeza.x + p.mira * 1.4, hy = p.cabeza.y + 0.4;
  const oscuro = plano ? R[1] : '#0b1a3c', brillo = '#ffffff';
  for (const dx of [-2.6, 2.6]) {
    const x = Math.round(hx + dx - 0.5), y = Math.round(hy - 1);
    switch (p.ojos) {
      case 'cerrados': L.punto(x, y + 1, oscuro); L.punto(x + 1, y + 1, oscuro); break;
      case 'felices': L.punto(x, y + 1, oscuro); L.punto(x + 1, y, oscuro); L.punto(x + 2, y + 1, oscuro); break;
      case 'tristes': L.punto(x, y, oscuro); L.punto(x + 1, y + 1, oscuro); L.punto(x + 1, y + 2, oscuro); break;
      case 'fuertes': for (let i = 0; i < 2; i++) { L.punto(x, y + i, oscuro); L.punto(x + 1, y + i, oscuro); } L.punto(x + (dx < 0 ? 1 : 0), y - 1, oscuro); break;
      default: {
        const alto = p.ojos === 'grandes' ? 4 : 3;
        for (let i = 0; i < alto; i++) { L.punto(x, y + i - (alto > 3 ? 1 : 0), oscuro); L.punto(x + 1, y + i - (alto > 3 ? 1 : 0), oscuro); }
        if (!plano) L.punto(x + 1, y - (alto > 3 ? 1 : 0), brillo);
      }
    }
  }
  /* los cachetes */
  if (!plano && p.cachetes !== false) for (const dx of [-4.2, 4.2]) L.punto(Math.round(hx + dx - 0.5), Math.round(hy + 2), mezclar(R[5], '#ff6aa0', 0.55));
  /* la boca */
  const bx = Math.round(hx - 0.5), by = Math.round(hy + 3);
  if (p.boca === 'feliz') { L.punto(bx - 1, by, oscuro); L.punto(bx, by + 1, oscuro); L.punto(bx + 1, by + 1, oscuro); L.punto(bx + 2, by, oscuro); }
  else if (p.boca === 'o') { L.punto(bx, by, oscuro); L.punto(bx + 1, by, oscuro); L.punto(bx, by + 1, oscuro); L.punto(bx + 1, by + 1, oscuro); }
  else if (p.boca === 'chica') { L.punto(bx, by, oscuro); L.punto(bx + 1, by, oscuro); }
}

/* un muñequito: rampa = RAMPA.azul, etc. o = { plano, zapas, extra(L, p) } */
export function muneco(rampa, anim, f, o = {}) {
  const A = ANIM[anim] || ANIM.quieto;
  const p = A.fn(poseBase(), f % A.n);
  const L = new Lienzo(CUADRO.w, CUADRO.h);
  const R = rampa, plano = !!o.plano;
  /* aplastar o estirar desde los pies */
  const ap = p.aplaste || 1, k = (y) => PISO - (PISO - y) * ap;
  const dy = p.dy || 0;
  const pinta = plano ? () => R[3] : null;
  const zap = o.zapas || RAMPA.blanco;
  /* piernas (atrás del cuerpo) y zapatillas */
  for (const l of p.piernas) {
    L.capsula(l.cx, k(l.cy) + dy, l.px, k(l.py) - 1.2 + dy, 1.7, pinta || pintura.vertical(R, 3, 1), R);
  }
  for (const l of p.piernas) {
    const zx = l.px + 1, zy = k(l.py) + dy;
    L.elipse(zx, zy, 2.9, 1.9, plano ? () => zap[3] : (u, v) => (v < -0.2 ? zap[6] : v < 0.45 ? zap[5] : zap[3]), zap);
    if (!plano) L.punto(Math.round(zx - 1.6), Math.round(zy - 1), zap[7], zap);
  }
  /* brazo de atrás */
  const [bAtras, bAdel] = p.mira > 0 ? [p.brazos[0], p.brazos[1]] : [p.brazos[1], p.brazos[0]];
  L.capsula(bAtras.hx, k(bAtras.hy) + dy, bAtras.mx, k(bAtras.my) + dy, 1.35, pinta || pintura.vertical(R, 3, 2), R);
  /* el cuerpo: una esfera aplastada con la franja de brillo */
  const c = p.cuerpo;
  L.huevo(c.x, k(c.y) + dy, c.rx * (2 - ap) ** 0.5, c.ry * ap, 0.08, pinta || pintura.aero(R, { bajo: 1, alto: 5, gorra: 0.18, corte: -0.3, punto: 0.02, rebote: false }), R);
  /* la cabeza: vidrio */
  const h = p.cabeza;
  L.elipse(h.x, k(h.y) + dy, h.r * (2 - ap) ** 0.4, h.r * ap ** 0.6, pinta || pintura.aero(R, { bajo: 2, alto: 6, punto: 0.06, gorra: 0.5 }), R);
  if (!plano) L.separar(R);
  /* brazo de adelante */
  L.capsula(bAdel.hx, k(bAdel.hy) + dy, bAdel.mx, k(bAdel.my) + dy, 1.35, pinta || pintura.vertical(R, 5, 3), R);
  if (o.extra) o.extra(L, p, k, dy);
  ojos(L, { ...p, cabeza: { ...h, y: k(h.y) + dy } }, R, plano);
  if (!plano) L.contorno({ tono: 0 });
  return L;
}

/* los cuadros hechos: clave = nombre:anim:cuadro:espejo */
const cache = new Map();
export function cuadro(quien, anim, f, espejo) {
  const Q = QUIENES[quien] || QUIENES.nick;
  const n = cuadrosDe(anim), i = ((f % n) + n) % n;
  const clave = `${quien}:${anim}:${i}:${espejo ? 1 : 0}`;
  let c = cache.get(clave);
  if (!c) { c = (Q.figura ? Q.figura(anim, i) : muneco(Q.rampa, anim, i, Q)).aCanvas(espejo); cache.set(clave, c); }
  return c;
}

/* los detalles de cada uno */
const gorro = (col) => (L, p, k, dy) => {
  const h = p.cabeza, y = k(h.y) + dy;
  L.caja(h.x - 7, y - 7.5, h.x + 7, y - 5.5, 1, col[4], col);
  L.caja(h.x - 4.5, y - 11, h.x + 4.5, y - 6.5, 2, pintura.vertical(col, 6, 3), col);
};
const auris = (L, p, k, dy) => {
  const h = p.cabeza, y = k(h.y) + dy, R = RAMPA.gris;
  L.capsula(h.x - 6.5, y - 1, h.x - 5.5, y - 6.5, 1, R[6], R); L.capsula(h.x + 6.5, y - 1, h.x + 5.5, y - 6.5, 1, R[6], R);
  L.capsula(h.x - 5.5, y - 6.5, h.x + 5.5, y - 6.5, 1, R[6], R);
  L.elipse(h.x - 7, y + 0.5, 1.8, 2.6, pintura.esfera(RAMPA.violeta), RAMPA.violeta); L.elipse(h.x + 7, y + 0.5, 1.8, 2.6, pintura.esfera(RAMPA.violeta), RAMPA.violeta);
};
const monio = (L, p, k, dy) => {
  const h = p.cabeza, y = k(h.y) + dy;
  L.elipse(h.x - 1, y - 8, 3, 2.4, pintura.aero(RAMPA.verde, { bajo: 3, alto: 6 }), RAMPA.verde);
  L.elipse(h.x + 2.5, y - 8.6, 2.2, 2, pintura.esfera(RAMPA.rosa, { bajo: 3, alto: 6 }), RAMPA.rosa);
};
export const QUIENES = {
  nick: { rampa: RAMPA.azul },
  mora: { rampa: RAMPA.verde, extra: monio },
  tito: { rampa: RAMPA.naranja, extra: gorro(RAMPA.arena) },
  lila: { rampa: RAMPA.rosa, extra: auris },
  sol: { rampa: RAMPA.amarillo },
  vio: { rampa: RAMPA.violeta },
  gris: { rampa: RAMPA.gris, plano: true },
  moraPlana: { rampa: RAMPA.gris, plano: true, extra: monio },
  dorado: { figura: (anim, f) => pezDorado(anim, f) },
};

/* Dorado: un pez dorado de vidrio, redondo, con la cola grande y aletitas.
   Flota a media altura del cuadro (no tiene pies) y mueve la cola. */
function pezDorado(anim, f) {
  const L = new Lienzo(CUADRO.w, CUADRO.h);
  const R = RAMPA.naranja, A = RAMPA.amarillo;
  const ola = Math.sin(f / 6 * Math.PI * 2), dy = Math.round(ola * 1);
  const cx = 16, cy = 20 + dy;
  /* la cola, atrás (a la izquierda: mira a la derecha) */
  const c = ola * 1.5;
  L.poligono([[cx - 8, cy], [cx - 14, cy - 6 + c], [cx - 12, cy], [cx - 14, cy + 6 + c]], pintura.vertical(R, 5, 2), R);
  /* la aleta de arriba */
  L.poligono([[cx - 3, cy - 6], [cx + 1, cy - 11], [cx + 4, cy - 6]], pintura.vertical(A, 6, 3), A);
  /* el cuerpo */
  L.elipse(cx, cy, 8.5, 7, pintura.aero(R, { bajo: 2, alto: 6, gorra: 0.5, punto: 0.07 }), R);
  L.separar(R);
  /* la panza clara y la aletita del costado */
  L.elipse(cx + 1, cy + 3.5, 5, 2.4, pintura.esfera(A, { bajo: 4, alto: 7 }), A);
  L.poligono([[cx - 2, cy + 1], [cx - 6, cy + 4 + ola], [cx - 1, cy + 4]], A[4], A);
  /* el ojo grande y la boca */
  L.elipse(cx + 4.5, cy - 2, 2, 2.2, () => '#0b1a3c', R); L.punto(cx + 4, cy - 3, '#ffffff'); L.punto(cx + 5, cy - 3, '#ffffff');
  L.punto(cx + 3, cy + 1, mezclar(R[5], '#ff6aa0', 0.6));
  if (anim === 'habla' && f % 2) { L.punto(cx + 8, cy + 1, '#6a2a06'); L.punto(cx + 8, cy + 2, '#6a2a06'); }
  else L.punto(cx + 8, cy + 1, '#6a2a06');
  L.contorno({ tono: 0 });
  return L;
}

/* PLANO, la Actualización: un cuadrado gris sin brillo, sin sombra y sin
   contorno de color, lo contrario de todo lo demás. f: 0-3 (3 parpadea, 1
   tiene una falla de imagen); tibio: al final le aparecen los cachetes. */
const cachePlano = new Map();
export function plano(f = 0, tibio = false) {
  const k = `${f & 3}:${tibio ? 1 : 0}`;
  let c = cachePlano.get(k);
  if (c) return c;
  let g;
  [c, g] = lienzo2d(36, 36);
  const o = 4, S = 28;
  g.fillStyle = '#5d636b'; g.fillRect(o - 1, o - 1, S + 2, S + 2);
  g.fillStyle = tibio ? '#b3adb2' : '#9aa0a8'; g.fillRect(o, o, S, S);
  g.fillStyle = '#3a3f46';
  if ((f & 3) === 3) { g.fillRect(o + 7, o + 11, 4, 1); g.fillRect(o + 17, o + 11, 4, 1); }
  else { g.fillRect(o + 7, o + 8, 4, 6); g.fillRect(o + 17, o + 8, 4, 6); }
  if (tibio) {
    g.fillRect(o + 10, o + 19, 8, 1); g.fillRect(o + 9, o + 18, 1, 1); g.fillRect(o + 18, o + 18, 1, 1);
    g.fillStyle = '#e59ab8'; g.fillRect(o + 4, o + 15, 3, 2); g.fillRect(o + 21, o + 15, 3, 2);
  } else g.fillRect(o + 8, o + 19, 12, 1);
  /* la falla: una tira que se corre */
  if ((f & 3) === 1) { const d = g.getImageData(0, o + 12, 36, 3); g.clearRect(0, o + 12, 36, 3); g.putImageData(d, 2, o + 12); }
  cachePlano.set(k, c);
  return c;
}
