// Encadenar cambios a los shaders de three sin que se pisen.
//
// DOS TRAMPAS que hacen que un cambio "no ande" sin dar ningún error:
//
// 1. `onBeforeCompile` es UNO por material. Si el viento lo pone y después la
//    niebla lo pone de nuevo, el segundo borra al primero: los árboles dejan
//    de moverse y nadie tocó el código del viento.
// 2. Three reutiliza programas entre materiales del mismo tipo con los mismos
//    parámetros, y por defecto distingue los parches por el TEXTO de la
//    función. Dos parches armados por la misma función con distintos valores
//    tienen el mismo texto: el segundo material recibe el shader del primero.
//    Por eso cada parche declara su propia clave.
export function parchear(mat, clave, fn) {
  const previo = mat.onBeforeCompile;
  const clavePrevia = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (sh, r) => {
    previo.call(mat, sh, r);
    fn(sh, r);
  };
  mat.customProgramCacheKey = () => clavePrevia + "|" + clave;
  mat.needsUpdate = true;
  return mat;
}

/** Reemplaza un trozo del shader y AVISA si no lo encontró. Un `replace` que
 *  no encuentra su ancla no hace nada, y el efecto simplemente no aparece: la
 *  versión siguiente de three renombra un include y medio juego se apaga sin
 *  un solo mensaje. */
export function reemplazar(src, ancla, nuevo, quien) {
  if (!src.includes(ancla)) {
    console.warn(`[parche ${quien}] no está "${ancla.slice(0, 40)}"`);
    return src;
  }
  return src.replace(ancla, nuevo);
}
