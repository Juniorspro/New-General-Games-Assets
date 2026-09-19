// De donde sale cada archivo.
//
// EXISTE POR EL EMPAQUETADO. Suelto, `ruta("assets/x.webp")` devuelve la ruta
// tal cual; adentro del HTML de un solo archivo, el empaquetador deja un mapa
// `ARCHIVOS` con el contenido en base64 y esta funcion lo encuentra. Con una
// sola puerta, meter el juego en un archivo no obliga a tocar ningun modulo.
export function ruta(p) {
  const A = globalThis.ARCHIVOS;
  if (A && A[p]) return A[p];
  return p;
}

/** Si estamos corriendo desde el archivo unico. Lo usa el cargador del modelo
 *  para saber si puede pedir por red o tiene que leer del mapa. */
export const empaquetado = () => !!globalThis.ARCHIVOS;
