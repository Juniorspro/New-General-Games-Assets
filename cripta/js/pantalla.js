// La pantalla: un lienzo chico donde se dibuja todo a escala 1 y el lienzo de
// verdad, que lo copia agrandado por un entero sin suavizar. Con un factor no
// entero (×2,6) los píxeles salen de distinto tamaño y todo tiembla.
//
// El factor sale de que entren al menos 136 × 220 píxeles del juego: el
// laberinto más ancho mide 16 celdas (128 px) y le quedan 4 de aire por lado.
import { P } from './paleta.js';

const MIN_W = 136, MIN_H = 220;

export function crearPantalla(lienzo) {
  const chico = document.createElement('canvas');
  const g = chico.getContext('2d', { alpha: false });
  const gg = lienzo.getContext('2d', { alpha: false });
  const p = { chico, g, W: 0, H: 0, s: 1, dpr: 1, ox: 0, oy: 0, cambio: 0 };

  p.medir = () => {
    const dpr = Math.min(4, window.devicePixelRatio || 1);
    const cw = lienzo.clientWidth || window.innerWidth, ch = lienzo.clientHeight || window.innerHeight;
    const dw = Math.max(1, Math.round(cw * dpr)), dh = Math.max(1, Math.round(ch * dpr));
    if (dw === lienzo.width && dh === lienzo.height && p.W) return false;
    lienzo.width = dw; lienzo.height = dh;
    const s = Math.max(2, Math.floor(Math.min(dw / MIN_W, dh / MIN_H)));
    const W = Math.floor(dw / s), H = Math.floor(dh / s);
    Object.assign(p, { s, dpr, W, H, ox: Math.floor((dw - W * s) / 2), oy: Math.floor((dh - H * s) / 2), cw, ch });
    chico.width = W; chico.height = H;
    g.imageSmoothingEnabled = false;
    p.cambio++;
    return true;
  };

  p.presentar = () => {
    gg.imageSmoothingEnabled = false;
    if (p.ox || p.oy) { gg.fillStyle = P.negro; gg.fillRect(0, 0, lienzo.width, lienzo.height); }
    gg.drawImage(chico, 0, 0, p.W, p.H, p.ox, p.oy, p.W * p.s, p.H * p.s);
  };

  // De un punto del navegador (clientX, clientY) a un píxel del juego.
  p.aJuego = (cx, cy) => {
    const r = lienzo.getBoundingClientRect();
    return { x: ((cx - r.left) * p.dpr - p.ox) / p.s, y: ((cy - r.top) * p.dpr - p.oy) / p.s };
  };
  // Cuántos píxeles del navegador mide un píxel del juego (para umbrales de dedo).
  p.cssPorPixel = () => p.s / p.dpr;

  p.medir();
  // medir una vez antes del layout deja el juego aplastado: se vuelve a mirar
  // al cambiar de tamaño y cada tanto por las dudas
  if (window.ResizeObserver) new ResizeObserver(() => p.medir()).observe(lienzo);
  window.addEventListener('resize', () => p.medir());
  return p;
}
