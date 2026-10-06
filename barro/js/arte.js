/* ============================================================================
   barro/js/arte.js — carga el arte pintado (barro/arte/*.webp, o adentro del
   HTML en el armado). Las sedes que todavía no tienen su arte usan el del
   bosque teñido con un filtro.
   ========================================================================== */
import EMBEBIDO from './arte-urls.js';
import { MUNDOS_VISTA } from './mundos.js';

const imgs = {};
export const img = (n) => imgs[n];

function cargarUna(n) {
  return new Promise((ok) => {
    const src = EMBEBIDO ? EMBEBIDO[n] : `${globalThis.BARRO_ARTE || 'arte/'}${n}.webp`;
    if (!src) return ok(false);
    const i = new Image();
    i.onload = () => { imgs[n] = i; ok(true); };
    i.onerror = () => ok(false);
    i.src = src;
  });
}

const PIEZAS = (m) => {
  const V = MUNDOS_VISTA[m];
  return [`${m}-lejos`, `${m}-medio`, ...Array.from({ length: V.arboles }, (_, i) => `${m}-arbol${i}`), ...Array.from({ length: V.frente }, (_, i) => `${m}-frente${i}`), ...[0, 1, 2].map((i) => `${m}-grande${i}`)];
};
const FILTROS = {
  canon: 'sepia(0.75) saturate(1.9) hue-rotate(-18deg) brightness(1.02)',
  selva: 'saturate(1.35) hue-rotate(18deg) brightness(0.88)',
  noche: 'brightness(0.42) saturate(0.7) hue-rotate(195deg)',
};
function teñir(i, filtro) {
  const c = document.createElement('canvas');
  c.width = i.width; c.height = i.height;
  const x = c.getContext('2d'); x.filter = filtro; x.drawImage(i, 0, 0);
  return c;
}

/* el "horneado" de pintura: textura de lienzo y luces cálidas / sombras frías metidas en la
   imagen una sola vez (hacerlo en cada cuadro costaba la mitad del tiempo de dibujo); el
   frente sale oscuro y desenfocado (profundidad de campo) */
let grano = null;
function patronGrano(x) {
  if (!grano) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const px = (i / 4) % 256, py = Math.floor(i / 4 / 256);
      const v = 128 + (Math.random() - 0.5) * 46 + Math.sin(px * 0.9 + Math.sin(py * 0.2) * 3) * 9 + Math.sin(py * 1.3 + px * 0.05) * 7;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0); grano = c;
  }
  return x.createPattern(grano, 'repeat');
}
function hornear(n) {
  const i = imgs[n];
  if (!i || i.horneado || typeof document === 'undefined') return;
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
  const x = c.getContext('2d');
  const m = n.split('-')[0];
  if (/frente/.test(n)) { x.filter = 'brightness(0.42) saturate(0.8) blur(2px)'; x.drawImage(i, 0, 0); }
  else {
    x.drawImage(i, 0, 0);
    x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.2; x.fillStyle = patronGrano(x); x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'soft-light'; x.globalAlpha = 0.32;
    const gc = x.createLinearGradient(0, 0, 0, c.height);
    const noche = m === 'noche' || /-noche$/.test(n);
    gc.addColorStop(0, noche ? '#7f9cff' : '#ffd9a0'); gc.addColorStop(1, noche ? '#1a1030' : '#2a4a6a');
    x.fillStyle = gc; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(i, 0, 0);
  }
  c.horneado = true;
  imgs[n] = c;
}

/* lo común y lo de una sede */
export async function cargarComun() {
  const n = ['tierra', 'pasto', ...PIEZAS('bosque')];
  await Promise.all(n.map(cargarUna));
  n.forEach(hornear);
}
export async function cargarMundo(m) {
  if (m === 'bosque') return;
  const piezas = PIEZAS(m);
  const res = await Promise.all(piezas.map(cargarUna));
  piezas.forEach((n, k) => {
    if (!res[k]) { const base = imgs[n.replace(m, 'bosque')]; if (base) imgs[n] = teñir(base, FILTROS[m] || 'none'); }
  });
  for (const t of ['tierra', 'pasto']) {
    const n = `${t}-${m}`;
    if (!imgs[n] && !(await cargarUna(n)) && imgs[t]) imgs[n] = teñir(imgs[t], FILTROS[m] || 'none');
    hornear(n);
  }
  piezas.forEach(hornear);
}
