// Lo que se guarda: hasta qué nivel llegaste, cuántas luces sacaste en cada
// uno, unos totales para los récords, el idioma y los volúmenes. Nada más.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado — no devuelve vacío. Un juego que no arranca porque no pudo leer su
// progreso es peor que uno sin progreso.

const LLAVE = "espejo.v1";
// `idioma: null` quiere decir "nunca eligió", que NO es lo mismo que "eligió
// inglés": la pantalla de idioma sale en cada arranque, y es lo que decide si
// hay un botón marcado o ninguno. Se guarda el código, nunca un texto.
//
// `efectos` y `musica` son volúmenes de 0 a 1; `sonido` y `musica` como
// booleanos eran la versión anterior y se siguen leyendo (ver `cargar`).
const vacio = () => ({
  luces: {},
  // Totales para la pestaña de récords: números sueltos y no una lista de
  // partidas, porque lo que se muestra son totales y una lista crece siempre.
  stats: { empezados: 0, ganados: 0, toques: 0, pistas: 0 },
  ajustes: { efectos: 0.8, volMusica: 0.6, idioma: null },
});
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    const viejos = cache.ajustes || {};
    cache.ajustes = { ...vacio().ajustes, ...viejos };
    // Los que guardaron con la versión de casillas: apagado es volumen cero.
    if (viejos.sonido === false && viejos.efectos === undefined) cache.ajustes.efectos = 0;
    if (viejos.musica === false && viejos.volMusica === undefined) cache.ajustes.volMusica = 0;
    delete cache.ajustes.sonido; delete cache.ajustes.musica;
    cache.luces = cache.luces || {};
    cache.stats = { ...vacio().stats, ...(cache.stats || {}) };
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

/** Cuántos niveles se ganaron, y cuántos con las tres luces. */
export const resueltos = () => Object.values(cargar().luces).filter((l) => l > 0).length;
export const perfectos = () => Object.values(cargar().luces).filter((l) => l >= 3).length;
