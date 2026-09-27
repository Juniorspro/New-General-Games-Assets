// Lo poco que se guarda: hasta que capitulo llego, el record y los ajustes.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado: no devuelve vacio. Por eso cada acceso va envuelto — un juego que
// no arranca porque no pudo leer un record es peor que uno sin record.

const LLAVE = "dimension-n.v1";
const vacio = () => ({
  capitulo: 0, mejorProf: 0, mejorChatarra: 0,
  // El capítulo más hondo al que se llegó alguna vez. `capitulo` no sirve para
  // los récords: vuelve a cero al terminar el pozo, a propósito, para que
  // "Seguir" no te deje en la heladera.
  mejorCap: 0,
  // Contadores para la pestaña de récords. Números sueltos y no una lista de
  // partidas: lo que se muestra son totales, y una lista crece para siempre.
  stats: { partidas: 0, llegadas: 0, desarmes: 0, tiros: 0 },
  // El modo portales guarda qué niveles están hechos. Se guarda un arreglo de
  // booleanos y no "hasta cuál llegué": los quince se pueden jugar en el orden
  // que uno quiera una vez abiertos, y un número no sabría representar eso.
  portales: { hechos: [], chatarra: [] },
  // `idioma: null` quiere decir "nunca eligió": la pantalla de idioma sale
  // igual en cada arranque, pero sin nada marcado. Se guarda el código, nunca
  // un texto traducido.
  ajustes: { sonido: true, efectos: 0.8, musica: 0.6, voces: true, idioma: null },
});
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
    cache.portales = { ...vacio().portales, ...(cache.portales || {}) };
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
