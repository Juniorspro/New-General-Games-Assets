// Lo que queda entre partidas. localStorage y nada más: no hay cuentas.
//
// LEER PUEDE TIRAR EXCEPCION, no devolver vacío: en modo privado, o con el
// almacenamiento bloqueado, el simple `getItem` revienta. Un juego que no
// arranca porque no pudo leer un puntaje es peor que uno sin puntajes, así que
// cada acceso va envuelto y el juego sigue con los valores de fábrica.

const LLAVE = "ritmo.v1";

const vacio = () => ({
  // por id de canción: {puntos, precision, estrellas, limpia}
  marcas: {},
  ajustes: {
    musica: true,
    efectos: true,
    // Segundos que la nota tarda en bajar de arriba a la línea. Más chico =
    // más rápido y menos tiempo para leer. Es EL ajuste de un juego de ritmo.
    anticipo: 1.5,
    // Corrección personal de sincronía, en segundos. Los auriculares con cable
    // y los bluetooth no llegan al mismo tiempo, y ningún navegador lo informa
    // bien: por eso se calibra a mano y se guarda.
    desfase: 0,
    // idioma null = todavía no eligió. Con "en" por defecto no habría forma de
    // distinguir "no eligió" de "eligió inglés" y el selector no saldría nunca.
    idioma: null,
  },
});

let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(LLAVE);
    cache = crudo ? { ...vacio(), ...JSON.parse(crudo) } : vacio();
    // Campo por campo: un guardado de una versión anterior no tiene los
    // ajustes nuevos, y un `undefined` en `anticipo` deja las notas quietas.
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
    cache.marcas = cache.marcas || {};
  } catch (e) { cache = vacio(); }
  return cache;
}

export function guardar() {
  try { localStorage.setItem(LLAVE, JSON.stringify(cargar())); } catch (e) { /* lleno o bloqueado */ }
}

export const ajustes = () => cargar().ajustes;

export function marca(id) { return cargar().marcas[id] || null; }

/** Guarda sólo si mejora. Devuelve true si era récord. */
export function anotarMarca(id, r) {
  const d = cargar();
  const v = d.marcas[id];
  const mejor = !v || r.puntos > v.puntos;
  if (mejor) {
    d.marcas[id] = { puntos: r.puntos, precision: r.precision, estrellas: r.estrellas,
                     limpia: r.limpia || (v && v.limpia) || false };
  } else if (r.limpia && v && !v.limpia) {
    // UNA PASADA LIMPIA SE GUARDA AUNQUE EL PUNTAJE SEA MENOR. Se puede tocar
    // sin fallar ni una y sacar menos puntos que una pasada sucia con más
    // racha; perder ese logro por eso sería absurdo.
    v.limpia = true;
  }
  guardar();
  return mejor;
}

/** Cuántas canciones están abiertas: la siguiente se abre con una estrella. */
export function desbloqueadas() {
  const d = cargar();
  let n = 1;
  while (n < 9 && (d.marcas[n]?.estrellas || 0) >= 1) n++;
  return n;
}

export function borrarTodo() {
  cache = vacio();
  try { localStorage.removeItem(LLAVE); } catch (e) {}
}
