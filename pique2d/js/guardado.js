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
  // grafico: "auto" | 1 | 2. En auto el juego mide como va y baja solo.
  // graficoAuto guarda lo que decidio la ultima vez, para arrancar ya bien
  // en vez de hacer sufrir los primeros segundos en cada partida.
  ajustes: { sonido: true, musica: true, sacudida: true, grafico: "auto", graficoAuto: 0 },
});

let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(LLAVE);
    cache = crudo ? { ...vacio(), ...JSON.parse(crudo) } : vacio();
    // Los ajustes se mezclan campo por campo: guardados con una version vieja
    // les falta lo nuevo, y `undefined` en "grafico" apagaria el automatico.
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
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

/**
 * El nivel que toca jugar: el primero sin terminar, y si estan todos hechos,
 * el ultimo que se desbloqueo.
 *
 * Existe porque "Jugar" ya no abre el mapa. El mapa era un peaje: para seguir
 * la partida habia que volver a elegir a mano el nivel siguiente cada vez, y
 * el juego es de correr, no de administrar. Ahora Jugar entra derecho al que
 * toca y el mapa quedo en su propio boton, para quien quiera repetir uno.
 */
export function proximoNivel() {
  const d = cargar();
  for (let i = 1; i <= Math.min(24, d.desbloqueado); i++) {
    const m = Math.ceil(i / 4), n = i - (m - 1) * 4;
    if (!d.niveles[`${m}-${n}`]?.hecho) return { m, n };
  }
  const i = Math.min(24, d.desbloqueado);
  return { m: Math.ceil(i / 4), n: i - (Math.ceil(i / 4) - 1) * 4 };
}

export function borrarTodo() {
  try { localStorage.removeItem(LLAVE); } catch (e) {}
  cache = null;
}
