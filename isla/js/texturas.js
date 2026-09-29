// Texturas pixel art dibujadas por código, píxel por píxel. Ningún archivo:
// el juego arranca sin red y pesa lo que pesa el código.
import * as THREE from '../vendor/three.module.min.js';
import { hash2, ruido2 } from './azar.js';
import { pixelar } from './material.js';

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  return { c, g, img: g.createImageData(w, h) };
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

function pintar(w, h, fn, repetir = true) {
  const { c, g, img } = lienzo(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = fn(x, y);
    const i = (y * w + x) * 4;
    if (!r) { img.data[i + 3] = 0; continue; }
    const [cr, cg, cb] = typeof r === 'string' ? hex(r) : r;
    img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return pixelar(new THREE.CanvasTexture(c), repetir);
}

// ── suelos (32×32 = 2 m a 16 texels por metro) ─────────────────────────────
function arena() {
  return pintar(32, 32, (x, y) => {
    const h = hash2(x, y, 11), r = ruido2(x * 0.25, y * 0.25, 3);
    if (h > 0.965) return '#fdf5de';
    if (h < 0.05) return '#e2cc9c';
    if (h < 0.09) return '#ead7ad';
    return r > 0.55 ? '#f3e2bb' : '#f0ddb4';
  });
}

function pastoSuelo() {
  return pintar(32, 32, (x, y) => {
    const h = hash2(x, y, 21), trazo = hash2(x, Math.floor(y / 3), 22);
    if (trazo > 0.86) return '#46ad29';
    if (h > 0.93) return '#8be552';
    if (h < 0.06) return '#3f9f25';
    return ruido2(x * 0.2, y * 0.2, 5) > 0.5 ? '#5fcc34' : '#58c330';
  });
}

function tierra() {
  return pintar(32, 32, (x, y) => {
    const h = hash2(x, y, 31);
    if (h > 0.92) return '#a8743f';
    if (h < 0.1) return '#6a4122';
    return ruido2(x * 0.3, y * 0.3, 7) > 0.5 ? '#8a5932' : '#7f512d';
  });
}

function roca() {
  return pintar(32, 32, (x, y) => {
    const h = hash2(x, y, 41), r = ruido2(x * 0.18, y * 0.18, 9);
    const grieta = Math.abs(ruido2(x * 0.12 + 3, y * 0.12, 13) - 0.5) < 0.025;
    if (grieta) return '#34363d';
    if (h > 0.94) return '#7a808b';
    if (h < 0.05) return '#40434b';
    return r > 0.52 ? '#5d616b' : '#555862';
  });
}

// Madera con vetas en remolino, como el muelle de los videos.
function madera() {
  return pintar(32, 32, (x, y) => {
    const tablon = Math.floor(y / 8);
    if (y % 8 === 7) return '#4a2a10';
    const n = ruido2(x * 0.09 + tablon * 7, y * 0.3, 17);
    const v = Math.sin((x * 0.42 + n * 9 + tablon * 3.1) * 1.0 + Math.sin(y * 0.8 + tablon) * 1.2);
    if (v > 0.82) return '#5b3413';
    if (v > 0.55) return '#8a5526';
    const h = hash2(x, y, 51);
    if (h > 0.95) return '#c4843f';
    return '#a86b33';
  });
}

function corteza() {
  return pintar(16, 32, (x, y) => {
    const anillo = (y + Math.floor(hash2(x, 0, 61) * 2)) % 6;
    if (anillo === 0) return '#5b4229';
    if (anillo === 1) return '#6e5233';
    const h = hash2(x, y, 62);
    if (h > 0.9) return '#b08b5f';
    return x % 5 === 0 ? '#86663f' : '#937149';
  });
}

function paja() {
  return pintar(32, 32, (x, y) => {
    const tira = hash2(x, Math.floor(y / 5), 71);
    if ((y + Math.floor(hash2(x, 3, 72) * 5)) % 9 === 0) return '#8a6a2e';
    if (tira > 0.75) return '#e2c276';
    if (tira < 0.25) return '#a9843d';
    return '#c9a458';
  });
}

// Hoja de palmera como las del original: una pluma verde lima con foliolos en
// diagonal hacia la punta y huecos entre medio, más amarilla en la punta y
// más oscura del lado de abajo. Fondo transparente.
function hojaPalmera() {
  const W = 64, H = 24;
  return pintar(W, H, (x, y) => {
    const u = x / (W - 1);
    const dy = y - (H - 1) / 2, ady = Math.abs(dy);
    const ancho = (0.22 + 0.78 * Math.sin(Math.PI * Math.min(1, u * 1.08))) * (H / 2 - 0.5);
    if (ady < 0.9 && u < 0.97) return u > 0.6 ? '#8fb83a' : '#6f9e2a';
    if (ady > ancho) return null;
    const fase = (((x - ady * 1.6) % 4) + 4) % 4;
    if (fase < 0.9 && ady > 1.5) return null;
    if (ady > ancho - 1.2) return '#3f8f1e';
    const h = hash2(x, y, 81);
    if (h > 0.94) return '#d2f779';
    if (fase < 1.9) return u > 0.68 ? '#b8ee52' : '#9ee23f';
    if (dy < 0) return u > 0.6 ? '#8ad83a' : '#74c830';
    return '#5aae27';
  }, false);
}

function hojasArbusto() {
  return pintar(32, 32, (x, y) => {
    const cx = [8, 20, 14, 26, 6, 17], cy = [10, 8, 20, 18, 22, 28], rr = [7, 7, 8, 6, 5, 5];
    let dentro = -1;
    for (let i = 0; i < cx.length; i++) {
      const d = Math.hypot(x - cx[i], (y - cy[i]) * 1.2);
      if (d < rr[i]) { dentro = i; if (d > rr[i] - 1.3) return '#2f8a1f'; }
    }
    if (dentro < 0) return null;
    const h = hash2(x, y, 91);
    if (h > 0.9) return '#9aec62';
    return ((x + y + dentro) % 4 === 0) ? '#45a82b' : '#5ec53a';
  }, false);
}

// Pasto: hojas finas que salen de abajo, oscuras en la base y claras en la punta.
function matasPasto() {
  const W = 32, H = 32;
  const hojas = [];
  for (let i = 0; i < 14; i++) hojas.push({ x: 1 + hash2(i, 1, 101) * 29, alto: 12 + hash2(i, 2, 101) * 19, inc: (hash2(i, 3, 101) - 0.5) * 0.5 });
  return pintar(W, H, (x, y) => {
    const desdeAbajo = H - 1 - y;
    for (const h of hojas) {
      if (desdeAbajo > h.alto) continue;
      const u = desdeAbajo / h.alto;
      const cx = h.x + h.inc * desdeAbajo;
      const ancho = 1.4 * (1 - u) + 0.35;
      if (Math.abs(x - cx) < ancho) {
        if (u > 0.78) return '#b6fb74';
        if (u > 0.45) return '#84ea48';
        if (u > 0.2) return '#60cf37';
        return '#40a827';
      }
    }
    return null;
  }, false);
}

function metal() {
  return pintar(16, 16, (x, y) => {
    const h = hash2(x, y, 121);
    if (y < 3) return '#f2f4f8';
    if (y > 12) return '#8c939e';
    return h > 0.9 ? '#dfe3ea' : '#b9bfc9';
  });
}

let TEX = null;
export function texturas() {
  if (TEX) return TEX;
  TEX = {
    arena: arena(), pastoSuelo: pastoSuelo(), tierra: tierra(), roca: roca(),
    madera: madera(), corteza: corteza(), paja: paja(), metal: metal(),
    hojaPalmera: hojaPalmera(), hojasArbusto: hojasArbusto(), matasPasto: matasPasto(),
  };
  return TEX;
}

export { pintar, hex };
