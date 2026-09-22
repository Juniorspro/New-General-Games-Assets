// De dónde salen las imágenes, si es que hay alguna.
//
// EL JUEGO ANDA COMPLETO SIN UN SOLO ARCHIVO. Todo lo que se ve está dibujado
// con formas; las imágenes son una MEJORA y no un requisito. Por eso `imagen()`
// puede devolver null y el dibujo tiene que saber seguir sin ella.
//
// Esto no es prolijidad de más: los assets generados todavía no existen —el
// servicio que los genera está rechazando el cobro— y el juego tenía que
// poder entregarse igual. Cuando aparezcan, entran por acá y no hay que tocar
// una línea del dibujo.

const cache = new Map();

/** El empaquetador deja las imágenes en `globalThis.ARCHIVOS` como data: URI. */
export function ruta(nombre) {
  const tabla = globalThis.ARCHIVOS || {};
  return tabla[`assets/${nombre}`] || tabla[nombre] || null;
}

/**
 * Devuelve la imagen ya cargada, o null si no existe (todavía).
 * NO ESPERA: devolver una promesa obligaría a que el dibujo la espere y a que
 * el primer cuadro de la partida se trabe justo cuando no puede.
 */
export function imagen(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);
  const u = ruta(nombre);
  if (!u) { cache.set(nombre, null); return null; }
  const i = new Image();
  i.src = u;
  cache.set(nombre, i);
  return i;
}

/** Lista para que las pruebas digan qué falta sin abrir el juego. */
export const ESPERADAS = [
  "bicho-mota.png", "bicho-pua.png", "bicho-caparazon.png", "bicho-zumbido.png", "bicho-bulto.png",
  "jugador.png", "piso.png", "gema.png",
];
