// Todo lo que se pinta con un lienzo: las caras del avatar (la cara es lo que
// hace reír cuando explota), los suelos de cada mundo, ventanas, tejas y los
// carteles con letra gorda y borde, como en los simuladores.
import * as THREE from '../vendor/three.module.min.js';
import { azar, entre } from './util.js';

export const LETRA = '"Arial Rounded MT Bold", "Nunito", "Segoe UI Black", "Arial Black", system-ui, sans-serif';

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function textura(c, repetir = false, nearest = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; }
  return t;
}

// ── caras ──────────────────────────────────────────────────────────────────
// 256×256 con fondo transparente: se ponen en un plano delante de la cabeza.
const NEGRO = '#1b1b24';
function ojoOval(g, x, y, rx, ry) {
  g.fillStyle = NEGRO;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(x - rx * 0.3, y - ry * 0.42, rx * 0.36, ry * 0.26, 0, 0, Math.PI * 2); g.fill();
}
function ojoGrande(g, x, y, r, px = 0, py = 0, pupila = 0.38) {
  g.fillStyle = '#ffffff'; g.strokeStyle = NEGRO; g.lineWidth = 6;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = NEGRO;
  g.beginPath(); g.arc(x + px, y + py, r * pupila, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x + px - r * 0.12, y + py - r * 0.14, r * 0.1, 0, Math.PI * 2); g.fill();
}
function trazo(g, pts, ancho = 7) {
  g.strokeStyle = NEGRO; g.lineWidth = ancho; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
  g.stroke();
}
function curva(g, x0, y0, cx, cy, x1, y1, ancho = 7) {
  g.strokeStyle = NEGRO; g.lineWidth = ancho; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
}
function cachetes(g, alfa = 0.35) {
  g.fillStyle = `rgba(255, 110, 130, ${alfa})`;
  for (const x of [72, 184]) { g.beginPath(); g.ellipse(x, 150, 16, 10, 0, 0, Math.PI * 2); g.fill(); }
}
function gota(g, x, y) {
  g.fillStyle = '#7fd4ff'; g.strokeStyle = '#2a7fb8'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x, y - 16); g.quadraticCurveTo(x + 12, y + 2, x, y + 10); g.quadraticCurveTo(x - 12, y + 2, x, y - 16); g.fill(); g.stroke();
}

const PINTORES = {
  normal(g) { ojoOval(g, 98, 110, 11, 20); ojoOval(g, 158, 110, 11, 20); curva(g, 88, 152, 128, 186, 168, 152); },
  normalC(g) { curva(g, 86, 112, 98, 104, 110, 112, 6); curva(g, 146, 112, 158, 104, 170, 112, 6); curva(g, 88, 152, 128, 186, 168, 152); },
  corre(g) {
    trazo(g, [[80, 80], [114, 92]], 8); trazo(g, [[176, 80], [142, 92]], 8);
    ojoOval(g, 98, 114, 10, 15); ojoOval(g, 158, 114, 10, 15);
    // sonrisa apretada con dientes: "llego, llego"
    g.fillStyle = '#ffffff'; g.strokeStyle = NEGRO; g.lineWidth = 6;
    g.beginPath(); g.roundRect(94, 150, 68, 26, 12); g.fill(); g.stroke();
    trazo(g, [[128, 152], [128, 174]], 4);
  },
  correC(g) {
    trazo(g, [[80, 80], [114, 92]], 8); trazo(g, [[176, 80], [142, 92]], 8);
    trazo(g, [[88, 116], [110, 116]], 6); trazo(g, [[146, 116], [168, 116]], 6);
    g.fillStyle = '#ffffff'; g.strokeStyle = NEGRO; g.lineWidth = 6;
    g.beginPath(); g.roundRect(94, 150, 68, 26, 12); g.fill(); g.stroke();
  },
  sorpresa(g) {
    curva(g, 76, 70, 98, 54, 120, 70, 7); curva(g, 136, 70, 158, 54, 180, 70, 7);
    ojoGrande(g, 98, 108, 26, 0, 2, 0.3); ojoGrande(g, 158, 108, 26, 0, 2, 0.3);
    g.fillStyle = '#5a1320'; g.strokeStyle = NEGRO; g.lineWidth = 7;
    g.beginPath(); g.ellipse(128, 174, 17, 23, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ff7b8f'; g.beginPath(); g.ellipse(128, 186, 9, 7, 0, 0, Math.PI * 2); g.fill();
  },
  miedo(g) {
    trazo(g, [[80, 86], [114, 72]], 7); trazo(g, [[176, 86], [142, 72]], 7);
    ojoGrande(g, 98, 112, 24, 0, 8, 0.22); ojoGrande(g, 158, 112, 24, 0, 8, 0.22);
    g.fillStyle = '#ffffff'; g.strokeStyle = NEGRO; g.lineWidth = 6;
    g.beginPath(); g.moveTo(90, 168);
    for (let i = 0; i <= 8; i++) g.lineTo(90 + i * 9.5, 168 + (i % 2 ? -8 : 6));
    g.lineTo(166, 176); g.quadraticCurveTo(128, 190, 90, 176); g.closePath(); g.fill(); g.stroke();
    gota(g, 196, 86);
  },
  mareado(g) {
    // ojos en espiral
    for (const cx of [98, 158]) {
      g.strokeStyle = NEGRO; g.lineWidth = 5; g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = 2 + a * 1.4; g.lineTo(cx + Math.cos(a) * r, 110 + Math.sin(a) * r); }
      g.stroke();
    }
    g.fillStyle = '#5a1320'; g.strokeStyle = NEGRO; g.lineWidth = 6;
    g.beginPath(); g.moveTo(96, 160); g.quadraticCurveTo(112, 150, 128, 162); g.quadraticCurveTo(146, 172, 162, 158);
    g.quadraticCurveTo(150, 190, 124, 186); g.quadraticCurveTo(100, 184, 96, 160); g.fill(); g.stroke();
    g.fillStyle = '#ff7b8f'; g.beginPath(); g.ellipse(138, 184, 12, 9, 0.3, 0, Math.PI * 2); g.fill();
  },
  feliz(g) {
    curva(g, 84, 116, 98, 94, 112, 116, 8); curva(g, 144, 116, 158, 94, 172, 116, 8);
    g.fillStyle = '#5a1320'; g.strokeStyle = NEGRO; g.lineWidth = 7;
    g.beginPath(); g.moveTo(86, 146); g.quadraticCurveTo(128, 150, 170, 146); g.quadraticCurveTo(160, 196, 128, 196); g.quadraticCurveTo(96, 196, 86, 146); g.fill(); g.stroke();
    g.fillStyle = '#ff7b8f'; g.beginPath(); g.ellipse(128, 184, 18, 9, 0, 0, Math.PI * 2); g.fill();
    cachetes(g);
  },
  esfuerzo(g) {
    trazo(g, [[84, 100], [110, 112], [84, 124]], 7); trazo(g, [[172, 100], [146, 112], [172, 124]], 7);
    g.fillStyle = '#ffffff'; g.strokeStyle = NEGRO; g.lineWidth = 6;
    g.beginPath(); g.roundRect(90, 150, 76, 28, 8); g.fill(); g.stroke();
    for (const x of [109, 128, 147]) trazo(g, [[x, 152], [x, 176]], 4);
    trazo(g, [[92, 164], [164, 164]], 4);
    gota(g, 60, 82); cachetes(g, 0.5);
  },
  guino(g) { ojoOval(g, 98, 110, 11, 20); curva(g, 146, 112, 158, 102, 170, 112, 7); curva(g, 88, 150, 128, 190, 168, 146); cachetes(g, 0.3); },
};

const caras = new Map();
export function cara(nombre) {
  if (caras.has(nombre)) return caras.get(nombre);
  const [c, g] = lienzo(256, 256);
  (PINTORES[nombre] || PINTORES.normal)(g);
  const t = textura(c);
  caras.set(nombre, t);
  return t;
}
export const CARAS = Object.keys(PINTORES);

// ── suelos ─────────────────────────────────────────────────────────────────
function ruidoFino(g, w, h, n, colores, r, tam = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colores[Math.floor(r() * colores.length)];
    const s = entre(r, tam[0], tam[1]);
    g.fillRect(r() * w, r() * h, s, s);
  }
}

const suelos = new Map();
export function suelo(nombre) {
  if (suelos.has(nombre)) return suelos.get(nombre);
  const r = azar(nombre.length * 977 + 31);
  let c, g;
  if (nombre === 'cesped') {
    // pasto cortado en franjas, como un patio recién podado
    [c, g] = lienzo(256, 256);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#5cc742' : '#4fb93a'; g.fillRect(i * 64, 0, 64, 256); }
    ruidoFino(g, 256, 256, 2400, ['#6ad24c', '#47aa33', '#58c040', '#7ddc5c'], r, [1, 3]);
    for (let i = 0; i < 260; i++) { g.strokeStyle = r() < 0.5 ? '#3f9a2c' : '#7fe05e'; g.lineWidth = 1.5; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + entre(r, -2, 2), y - entre(r, 3, 7)); g.stroke(); }
  } else if (nombre === 'camino') {
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#e9d9b0'; g.fillRect(0, 0, 256, 256);
    ruidoFino(g, 256, 256, 1800, ['#dcc996', '#f3e6c4', '#cdb887'], r, [1, 3]);
    for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#b9a98a' : '#a8987a'; g.beginPath(); g.ellipse(r() * 256, r() * 256, entre(r, 3, 7), entre(r, 2, 5), r() * 3, 0, Math.PI * 2); g.fill(); }
  } else if (nombre === 'asfalto') {
    // u: el ancho de la calle entero; v: se repite a lo largo
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#4a4e57'; g.fillRect(0, 0, 256, 256);
    ruidoFino(g, 256, 256, 3000, ['#555a64', '#41454d', '#5d626c'], r, [1, 2]);
    g.fillStyle = '#f2f2f2'; g.fillRect(10, 0, 6, 256); g.fillRect(240, 0, 6, 256);
    g.fillStyle = '#ffd23a'; for (let y = 0; y < 256; y += 64) g.fillRect(124, y + 8, 8, 40);
  } else if (nombre === 'vereda') {
    [c, g] = lienzo(128, 128);
    g.fillStyle = '#c9ccd3'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#a9adb6'; g.lineWidth = 3;
    for (let i = 0; i <= 128; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    ruidoFino(g, 128, 128, 500, ['#d3d6dc', '#bec2ca'], r, [1, 2]);
  } else if (nombre === 'campo') {
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#b07a44'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) { g.fillStyle = '#8f5f31'; g.fillRect(x, 0, 12, 256); }
    ruidoFino(g, 256, 256, 1500, ['#c08a52', '#9a6a3a', '#a57240'], r, [1, 3]);
    for (let i = 0; i < 90; i++) { g.fillStyle = '#6fbf3a'; const x = Math.floor(r() * 8) * 32 + 22, y = r() * 256; g.fillRect(x, y, 4, 6); }
  } else if (nombre === 'trigo') {
    [c, g] = lienzo(128, 128);
    g.fillStyle = '#e8c35a'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) { g.strokeStyle = r() < 0.5 ? '#f5d77a' : '#caa13e'; g.lineWidth = 1.5; const x = r() * 128, y = r() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 6); g.stroke(); }
  } else if (nombre === 'neon') {
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#1b1830'; g.fillRect(0, 0, 256, 256);
    ruidoFino(g, 256, 256, 2000, ['#221f3c', '#161428', '#2a2548'], r, [1, 2]);
    g.fillStyle = '#28f0ff'; g.fillRect(8, 0, 5, 256); g.fillRect(243, 0, 5, 256);
    g.fillStyle = '#ff3fd1'; for (let y = 0; y < 256; y += 64) g.fillRect(125, y + 10, 6, 36);
  } else if (nombre === 'lab') {
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#8d97a3'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) {
      g.fillStyle = (x + y) % 128 ? '#96a1ad' : '#86909b'; g.fillRect(x + 2, y + 2, 60, 60);
      g.fillStyle = '#6f7883'; for (const [a, b] of [[8, 8], [54, 8], [8, 54], [54, 54]]) { g.beginPath(); g.arc(x + a, y + b, 3, 0, 7); g.fill(); }
    }
    // franjas de peligro en los bordes
    for (let y = -16; y < 256; y += 24) { g.fillStyle = '#ffcf2e'; g.beginPath(); g.moveTo(0, y); g.lineTo(16, y + 12); g.lineTo(16, y + 24); g.lineTo(0, y + 12); g.fill(); g.beginPath(); g.moveTo(256, y); g.lineTo(240, y + 12); g.lineTo(240, y + 24); g.lineTo(256, y + 12); g.fill(); }
  } else if (nombre === 'espacio') {
    [c, g] = lienzo(256, 256);
    g.fillStyle = '#243060'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) { g.fillStyle = (x / 64 + y / 64) % 2 ? '#2d3a78' : '#28356d'; g.fillRect(x + 3, y + 3, 58, 58); }
    g.strokeStyle = '#8fe8ff'; g.lineWidth = 2; g.globalAlpha = 0.8;
    for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(256, x); g.stroke(); }
    g.globalAlpha = 1;
  } else if (nombre === 'tierra') {
    [c, g] = lienzo(128, 128);
    g.fillStyle = '#9c7048'; g.fillRect(0, 0, 128, 128);
    ruidoFino(g, 128, 128, 900, ['#8a603c', '#ad7f54', '#7d5634'], r, [1, 3]);
  } else {
    [c, g] = lienzo(8, 8); g.fillStyle = '#888'; g.fillRect(0, 0, 8, 8);
  }
  const t = textura(c, true);
  suelos.set(nombre, t);
  return t;
}

// Ventanas de un edificio: grilla con marcos; algunas encendidas (para el
// brillo de noche en la ciudad de neón).
const ventanas = new Map();
export function fachada(tipo = 'dia', semilla = 1) {
  const k = tipo + semilla;
  if (ventanas.has(k)) return ventanas.get(k);
  const r = azar(semilla * 131 + 7);
  const [c, g] = lienzo(128, 256);
  const neon = tipo === 'neon';
  g.fillStyle = neon ? '#2b2745' : tipo === 'ladrillo' ? '#c1583f' : '#dfe6ee';
  g.fillRect(0, 0, 128, 256);
  if (tipo === 'ladrillo') {
    g.fillStyle = '#a84a35';
    for (let y = 0; y < 256; y += 10) for (let x = (y / 10) % 2 ? -10 : 0; x < 128; x += 20) g.fillRect(x + 1, y + 1, 18, 8);
  }
  for (let y = 12; y < 250; y += 32) for (let x = 10; x < 120; x += 28) {
    const luz = r() < (neon ? 0.55 : 0.25);
    g.fillStyle = neon ? (luz ? (r() < 0.5 ? '#46f3ff' : '#ff5fd8') : '#1a1730') : luz ? '#fff3b0' : '#7fb6e6';
    g.fillRect(x, y, 18, 22);
    g.fillStyle = neon ? '#15131f' : '#ffffff';
    g.fillRect(x, y + 10, 18, 2); g.fillRect(x + 8, y, 2, 22);
  }
  const t = textura(c, true);
  ventanas.set(k, t);
  return t;
}

export function tejas(color = '#c4462f') {
  const [c, g] = lienzo(128, 128);
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 128; y += 16) { g.fillRect(0, y + 13, 128, 3); for (let x = (y / 16) % 2 ? 0 : 16; x < 128; x += 32) g.fillRect(x, y, 2, 16); }
  return textura(c, true);
}

// ── carteles ───────────────────────────────────────────────────────────────
// Letra gorda con borde oscuro y un degradé, sobre una placa redondeada.
export function dibujarCartel(g, w, h, texto, { fondo = '#2a78ec', fondo2 = '#1c56b0', color = '#ffffff', borde = '#14203a', sub = '', icono = '' } = {}) {
  g.clearRect(0, 0, w, h);
  const deg = g.createLinearGradient(0, 0, 0, h);
  deg.addColorStop(0, fondo); deg.addColorStop(1, fondo2);
  g.fillStyle = deg; g.strokeStyle = borde; g.lineWidth = Math.max(6, h * 0.06);
  g.beginPath(); g.roundRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2, h * 0.18); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath(); g.roundRect(g.lineWidth * 2, g.lineWidth * 1.6, w - g.lineWidth * 4, h * 0.22, h * 0.1); g.fill();
  const texto2 = icono ? icono + ' ' + texto : texto;
  let tam = Math.floor(h * (sub ? 0.4 : 0.5));
  g.textAlign = 'center'; g.textBaseline = 'middle';
  do { g.font = `900 ${tam}px ${LETRA}`; } while (g.measureText(texto2).width > w * 0.86 && --tam > 10);
  const y = sub ? h * 0.4 : h * 0.52;
  g.lineJoin = 'round'; g.lineWidth = tam * 0.22; g.strokeStyle = borde; g.strokeText(texto2, w / 2, y);
  g.fillStyle = color; g.fillText(texto2, w / 2, y);
  if (sub) {
    let t2 = Math.floor(h * 0.24);
    do { g.font = `900 ${t2}px ${LETRA}`; } while (g.measureText(sub).width > w * 0.86 && --t2 > 8);
    g.lineWidth = t2 * 0.24; g.strokeText(sub, w / 2, h * 0.74);
    g.fillStyle = '#ffe27a'; g.fillText(sub, w / 2, h * 0.74);
  }
}

export class Cartel {
  constructor(w = 512, h = 160) {
    [this.canvas, this.g] = lienzo(w, h);
    this.w = w; this.h = h;
    this.tex = textura(this.canvas);
  }
  pintar(texto, op) { dibujarCartel(this.g, this.w, this.h, texto, op); this.tex.needsUpdate = true; return this; }
}

// Una chispa redonda con halo: para la mecha, las estrellas y los destellos.
let chispaTex = null;
export function chispa() {
  if (chispaTex) return chispaTex;
  const [c, g] = lienzo(64, 64);
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.25, 'rgba(255,240,180,0.9)'); d.addColorStop(0.6, 'rgba(255,170,60,0.35)'); d.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = d; g.fillRect(0, 0, 64, 64);
  chispaTex = textura(c);
  return chispaTex;
}

// Sombra redonda y suave, para lo que vuela (el sol no alcanza a marcarla bien).
let sombraTex = null;
export function sombraRedonda() {
  if (sombraTex) return sombraTex;
  const [c, g] = lienzo(64, 64);
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(0,0,0,0.45)'); d.addColorStop(0.6, 'rgba(0,0,0,0.2)'); d.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = d; g.fillRect(0, 0, 64, 64);
  sombraTex = textura(c);
  return sombraTex;
}

// El logo de la remera: una bomba chiquita con su mecha.
let remeraTex = null;
export function remera() {
  if (remeraTex) return remeraTex;
  const [c, g] = lienzo(128, 128);
  g.fillStyle = '#1b1b24'; g.beginPath(); g.arc(60, 74, 34, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(48, 62, 9, 6, -0.6, 0, 7); g.fill();
  g.fillStyle = '#8c8f99'; g.fillRect(70, 34, 18, 14);
  g.strokeStyle = '#c8a26a'; g.lineWidth = 5; g.beginPath(); g.moveTo(82, 36); g.quadraticCurveTo(96, 18, 108, 26); g.stroke();
  g.fillStyle = '#ffd23a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? 6 : 14; g.lineTo(110 + Math.cos(a) * rr, 22 + Math.sin(a) * rr); } g.fill();
  remeraTex = textura(c);
  return remeraTex;
}
