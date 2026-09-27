// Lo poco que se guarda: hasta que capitulo llego, el record y los ajustes.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado: no devuelve vacio. Por eso cada acceso va envuelto — un juego que
// no arranca porque no pudo leer un record es peor que uno sin record.

const LLAVE = "dimension-n.v1";
const vacio = () => ({
  capitulo: 0, mejorProf: 0, mejorChatarra: 0,
  // El modo portales guarda qué niveles están hechos. Se guarda un arreglo de
  // booleanos y no "hasta cuál llegué": los quince se pueden jugar en el orden
  // que uno quiera una vez abiertos, y un número no sabría representar eso.
  portales: { hechos: [], chatarra: [] },
  ajustes: { sonido: true },
});
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
    cache.portales = { ...vacio().portales, ...(cache.portales || {}) };
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
