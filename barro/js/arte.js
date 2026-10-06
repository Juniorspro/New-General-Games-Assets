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
  return [`${m}-lejos`, `${m}-medio`, ...Array.from({ length: V.arboles }, (_, i) => `${m}-arbol${i}`), ...Array.from({ length: V.frente }, (_, i) => `${m}-frente${i}`)];
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

/* lo común y lo de una sede */
export async function cargarComun() {
  await Promise.all(['tierra', 'pasto', ...PIEZAS('bosque')].map(cargarUna));
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
  }
}
