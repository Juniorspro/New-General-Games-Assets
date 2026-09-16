// Lo que se guarda entre partidas.
//
// Va a localStorage y nada mas: no hay cuentas ni servidor. Si el navegador
// esta en modo privado o tiene el almacenamiento bloqueado, LEER TIRA
// EXCEPCION — no devuelve vacio. Por eso cada acceso va envuelto: un juego que
// no arranca porque no pudo leer el puntaje es peor que uno sin puntaje.

const LLAVE = "pique.v1";

const vacio = () => ({
  monedas: 0,
  niveles: {},          // "1-1": {hecho, mejorTiempo, monedas, color:{rosa,violeta,negra}}
  desbloqueado: 1,      // hasta que NIVEL llego, de 1 a 24
  ajustes: { sonido: true, musica: true, sacudida: true },
});

let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(LLAVE);
    cache = crudo ? { ...vacio(), ...JSON.parse(crudo) } : vacio();
  } catch (e) {
    cache = vacio();
  }
  return cache;
}

export function guardar() {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(cargar()));
  } catch (e) {
    // Sin almacenamiento se sigue jugando; lo unico que se pierde es el
    // progreso al cerrar. No se avisa con un cartel: no hay nada que el
    // jugador pueda hacer al respecto.
  }
}

export function datosNivel(id) {
  const d = cargar();
  if (!d.niveles[id]) {
    d.niveles[id] = { hecho: false, mejorTiempo: 0, monedas: 0,
                      color: { rosa: false, violeta: false, negra: false } };
  }
  return d.niveles[id];
}

// Que color de moneda toca en este nivel. Se arranca por la rosa; la violeta
// se habilita recien con las cinco rosas, y la negra con las cinco violetas.
// Igual que en el juego original: la dificultad se elige sola.
export function tierActual(id) {
  const c = datosNivel(id).color;
  if (!c.rosa) return "rosa";
  if (!c.violeta) return "violeta";
  return "negra";
}

// El indice global de un nivel: 1-1 es 1, 1-4 es 4, 2-1 es 5, 6-4 es 24.
// Se guarda uno solo y no un mapa de "cual esta abierto": con un numero, el
// estado no puede quedar inconsistente — no existe un 3-2 abierto con el 3-1
// cerrado.
export const indiceNivel = (m, n) => (m - 1) * 4 + n;

export function abierto(m, n) {
  return indiceNivel(m, n) <= cargar().desbloqueado;
}

/** Terminar un nivel abre el SIGUIENTE, no el mundo entero. */
export function abrirSiguiente(m, n) {
  const d = cargar();
  d.desbloqueado = Math.max(d.desbloqueado, Math.min(24, indiceNivel(m, n) + 1));
  guardar();
  return d.desbloqueado;
}

export function borrarTodo() {
  try { localStorage.removeItem(LLAVE); } catch (e) {}
  cache = null;
}
