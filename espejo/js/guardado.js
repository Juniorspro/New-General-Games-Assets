// Lo que se guarda: hasta qué nivel llegaste, cuántas luces sacaste en cada
// uno, el idioma y si el sonido está prendido. Nada más.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado — no devuelve vacío. Un juego que no arranca porque no pudo leer su
// progreso es peor que uno sin progreso.

const LLAVE = "espejo.v1";
// `idioma: null` quiere decir "nunca eligió", que NO es lo mismo que "eligió
// inglés": es lo único que distingue al que abre el juego por primera vez del
// que ya eligió inglés y no quiere que le pregunten más.
const vacio = () => ({ luces: {}, ajustes: { sonido: true, idioma: null } });
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
    cache.luces = cache.luces || {};
  } catch (e) { cache = vacio(); }
  return cache;
}
export function guardar() {
  try { localStorage.setItem(LLAVE, JSON.stringify(cargar())); } catch (e) {}
}
export function borrar() {
  try { localStorage.removeItem(LLAVE); } catch (e) {}
  cache = null;
}

/** Cuántas luces sacaste en un nivel (0 si no lo ganaste). */
export const lucesDe = (i) => cargar().luces[i] || 0;

/** Guardar un resultado, pero NUNCA para atrás: tres luces no se pierden por
 *  volver a jugar el nivel y hacerlo peor. Un juego que castiga por practicar
 *  enseña a no practicar. */
export function anotar(i, luces) {
  const d = cargar();
  if (luces > (d.luces[i] || 0)) { d.luces[i] = luces; guardar(); return true; }
  return false;
}

/** Hasta dónde se puede jugar: el primero sin ganar, y ni uno más. */
export function abiertos(total) {
  const d = cargar();
  let i = 0;
  while (i < total && d.luces[i]) i++;
  return Math.min(total, i + 1);
}

export const totalLuces = () => Object.values(cargar().luces).reduce((a, b) => a + b, 0);
