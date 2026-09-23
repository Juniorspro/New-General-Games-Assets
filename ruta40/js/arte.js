/* ============================================================================
   ruta40/js/arte.js — las imágenes. Vienen adentro del HTML como data: URI
   (las pone el armador con el módulo virtual "arte:todo"), así el juego
   anda con doble clic y sin internet. Si alguna no carga, el dibujo tiene su
   reemplazo hecho con código (ver dibujo.js): nunca se traba por un archivo.
   ========================================================================== */
import DATOS from 'arte:todo';

export const IMG = {};
export const ok = (n) => { const i = IMG[n]; return !!(i && i.complete && i.naturalWidth > 0); };

export function cargarArte(progreso) {
  const nombres = Object.keys(DATOS).filter((n) => DATOS[n].startsWith('data:image'));
  let listos = 0;
  return Promise.all(nombres.map((n) => new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = im.onerror = () => { listos++; if (progreso) progreso(listos / nombres.length); res(); };
    im.src = DATOS[n];
    IMG[n] = im;
  })));
}
export const url = (n) => DATOS[n] || '';
