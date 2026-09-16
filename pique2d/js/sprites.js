// Las hojas de sprites: cargarlas, cortarlas y dibujarlas.
//
// Cada hoja es UN movimiento en una grilla de 4x4 = 16 cuadros, todos del
// mismo bicho, mismo angulo, misma direccion. Eso no es una convencion
// estetica: `dibujarCuadro` corta con (i % cols) * (ancho / cols), o sea que
// asume divisiones exactas. Mezclar dos movimientos en una hoja la rompe sin
// importar como se la corte despues.
//
// POR QUE 4x4 Y NO 3x3: el servidor que las genera IGNORA el tamano pedido y
// entrega 1024x1024 siempre. 1024 no divide en 3 —341,33 px por celda— asi que
// toda hoja de 3x3 sale con las celdas corridas medio pixel por columna, y el
// control numerico la rechaza. 1024/4 = 256 exacto. Se midio: de 17 hojas
// pedidas en 3x3, 16 fallaron por esto.

import { ruta } from "./assets.js";

const hojas = new Map();

/**
 * Recorta el margen vacio midiendo el alfa.
 *
 * Los generadores dejan una celda de 256 px con el bicho ocupando la mitad y
 * el resto transparente, y cada hoja deja un margen distinto. Dibujando la
 * celda entera, un bicho sale chico y otro grande aunque se pidan del mismo
 * alto, y ninguno se apoya en el piso donde corresponde. Se mide el recuadro
 * ocupado por TODOS los cuadros juntos —no cuadro a cuadro— para que la
 * animacion no tiemble: si cada cuadro se recortara a su propia medida, el
 * bicho se movería un pixel para los costados en cada paso.
 */
function medirRecorte(img, cols, filas) {
  const cw = img.width / cols, ch = img.height / filas;
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0, hubo = false;
  for (let f = 0; f < filas; f++) {
    for (let k = 0; k < cols; k++) {
      const d = cx.getImageData(k * cw, f * ch, cw, ch).data;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          if (d[(y * cw + x) * 4 + 3] > 24) {
            hubo = true;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
    }
  }
  if (!hubo) return { x: 0, y: 0, w: cw, h: ch };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function cargarHoja(clave, url, cols, filas) {
  if (hojas.has(clave)) return hojas.get(clave);
  const p = new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const r = medirRecorte(img, cols, filas);
      ok({ img, cols, filas, cw: img.width / cols, ch: img.height / filas, r, n: cols * filas });
    };
    img.onerror = () => ok(null);
    img.src = ruta(url);
  });
  hojas.set(clave, p);
  return p;
}

export async function cargarTodas(lista) {
  const r = {};
  await Promise.all(lista.map(async ([clave, url, c, f]) => {
    r[clave] = await cargarHoja(clave, url, c, f);
  }));
  return r;
}

/**
 * Dibuja un cuadro. `alto` es el alto DESEADO en pixeles del juego: el ancho
 * sale de la proporcion del recorte, asi que ningun bicho queda aplastado.
 * (x, y) es el punto de apoyo: el centro de los pies.
 */
export function dibujarCuadro(ctx, hoja, i, x, y, alto, espejo = false, alpha = 1) {
  if (!hoja) return;
  const { img, cols, cw, ch, r } = hoja;
  const k = i % hoja.n;
  const sx = (k % cols) * cw + r.x, sy = Math.floor(k / cols) * ch + r.y;
  const esc = alto / r.h;
  const w = r.w * esc;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (espejo) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, r.w, r.h, Math.round(-w / 2), Math.round(-alto), Math.round(w), Math.round(alto));
  ctx.restore();
}

// Indice de cuadro segun el reloj. `fps` bajo se ve a saltos, alto se ve
// nervioso; 12 es lo que usa casi todo el pixel art de plataformas.
export const cuadroDe = (t, hoja, fps = 12, desfase = 0) =>
  hoja ? Math.floor(t * fps + desfase) % hoja.n : 0;

// Un cuadro de una animacion que NO cicla: se queda en el ultimo.
export const cuadroUnaVez = (t0, t, hoja, fps = 12) =>
  hoja ? Math.min(hoja.n - 1, Math.floor((t - t0) * fps)) : 0;
