// Lo que se guarda: el record, el idioma y si el sonido esta prendido. Nada mas.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado — no devuelve vacio. Un juego que no arranca porque no pudo leer un
// record es peor que uno sin record.

const LLAVE = "garfio.v1";
// `idioma: null` quiere decir "nunca eligió", que NO es lo mismo que "eligió
// inglés": es lo único que distingue al que abre el juego por primera vez —y
// hay que preguntarle— del que ya eligió inglés y no quiere que le pregunten
// más.
const vacio = () => ({ mejor: 0, partidas: 0,
                       ajustes: { sonido: true, musica: true, idioma: null } });
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
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
