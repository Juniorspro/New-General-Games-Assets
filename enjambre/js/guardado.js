// Lo que sobrevive a la partida. localStorage y nada más.
//
// LEER PUEDE TIRAR EXCEPCION, no devolver vacío: en modo privado el `getItem`
// revienta. Un juego que no arranca por no poder leer un récord es peor que uno
// sin récords, así que cada acceso va envuelto.

const LLAVE = "enjambre.v1";
const vacio = () => ({
  mejorTiempo: 0, mejorMatados: 0, mejorNivel: 0, partidas: 0, ganadas: 0,
  ajustes: { sonido: true, idioma: null, mando: "donde-toques" },
});
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
export function guardar() { try { localStorage.setItem(LLAVE, JSON.stringify(cargar())); } catch (e) {} }
export const ajustes = () => cargar().ajustes;

/** Anota el resultado. Devuelve qué récords se rompieron. */
export function anotar(r) {
  const d = cargar();
  const nuevos = { tiempo: r.t > d.mejorTiempo, matados: r.matados > d.mejorMatados, nivel: r.nivel > d.mejorNivel };
  d.mejorTiempo = Math.max(d.mejorTiempo, r.t);
  d.mejorMatados = Math.max(d.mejorMatados, r.matados);
  d.mejorNivel = Math.max(d.mejorNivel, r.nivel);
  d.partidas++;
  if (r.gano) d.ganadas++;
  guardar();
  return nuevos;
}
export function borrarTodo() { cache = vacio(); try { localStorage.removeItem(LLAVE); } catch (e) {} }
