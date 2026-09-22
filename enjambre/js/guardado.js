// Lo que sobrevive a la partida. localStorage y nada más.
//
// LEER PUEDE TIRAR EXCEPCION, no devolver vacío: en modo privado el `getItem`
// revienta. Un juego que no arranca por no poder leer un récord es peor que uno
// sin récords, así que cada acceso va envuelto.

const LLAVE = "enjambre.v1";
const vacio = () => ({
  // por etapa: {mejorTiempo, mejorMatados, mejorNivel, hecha}
  etapas: {},
  partidas: 0, ganadas: 0,
  ajustes: { sonido: true, idioma: null },
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

export function marca(etapa) { return cargar().etapas[etapa] || null; }

/** Anota el resultado de una etapa. Devuelve qué récords se rompieron. */
export function anotar(etapa, r) {
  const d = cargar();
  const v = d.etapas[etapa] || { mejorTiempo: 0, mejorMatados: 0, mejorNivel: 0, hecha: false };
  const nuevos = { tiempo: r.t > v.mejorTiempo, matados: r.matados > v.mejorMatados,
                   nivel: r.nivel > v.mejorNivel, primera: r.gano && !v.hecha };
  v.mejorTiempo = Math.max(v.mejorTiempo, r.t);
  v.mejorMatados = Math.max(v.mejorMatados, r.matados);
  v.mejorNivel = Math.max(v.mejorNivel, r.nivel);
  v.hecha = v.hecha || r.gano;
  d.etapas[etapa] = v;
  d.partidas++;
  if (r.gano) d.ganadas++;
  guardar();
  return nuevos;
}

/** Hasta qué etapa se puede entrar. La siguiente se abre al terminar la anterior. */
export function abiertas() {
  const d = cargar();
  let n = 1;
  while (n < 4 && d.etapas[n]?.hecha) n++;
  return n;
}
export function borrarTodo() { cache = vacio(); try { localStorage.removeItem(LLAVE); } catch (e) {} }
