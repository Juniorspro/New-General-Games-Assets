// Lo que se guarda: el record y si el sonido esta prendido. Nada mas.
//
// localStorage TIRA EXCEPCION en modo privado o con el almacenamiento
// bloqueado — no devuelve vacio. Un juego que no arranca porque no pudo leer un
// record es peor que uno sin record.

const LLAVE = "paraguas.v1";
// `idioma: null` quiere decir "nunca eligió", que NO es lo mismo que "eligió
// inglés": es lo único que distingue al que abre el juego por primera vez —y
// hay que preguntarle— del que ya eligió inglés y no quiere que le pregunten
// más.
const vacio = () => ({
  mejor: 0, mejorMonedas: 0, partidas: 0,
  // LA BILLETERA ES UN NUMERO GUARDADO EN EL APARATO Y SE PUEDE EDITAR A MANO.
  // Está bien que así sea: este juego no tiene servidor, no tiene cuentas y no
  // compite contra nadie. El que se quiera regalar monedas, que se las regale —
  // lo único que se arruina es su propia tienda. Lo que NO se puede hacer así
  // son las tres skins pagas, y por eso `compras.js` documenta que la validación
  // de verdad va del lado del servidor.
  monedas: 0,
  skins: { base: true },        // las que ya tenés
  skin: "base",                 // la puesta
  pagas: {},                    // productos comprados con plata, por identificador
  ajustes: { sonido: true, musica: true, idioma: null },
});
let cache = null;

export function cargar() {
  if (cache) return cache;
  try {
    const c = localStorage.getItem(LLAVE);
    cache = c ? { ...vacio(), ...JSON.parse(c) } : vacio();
    cache.ajustes = { ...vacio().ajustes, ...(cache.ajustes || {}) };
    // Los tres bolsones se rellenan aparte: un guardado viejo —de antes de que
    // existiera la tienda— no los tiene, y sin esto el juego se caía al abrirlo
    // por primera vez después de actualizar, que es el peor momento posible.
    cache.skins = { base: true, ...(cache.skins || {}) };
    cache.pagas = cache.pagas || {};
    if (typeof cache.monedas !== "number") cache.monedas = 0;
    if (!cache.skin) cache.skin = "base";
  } catch (e) { cache = vacio(); }
  return cache;
}

/** Sumar lo juntado en una partida. Devuelve el total. */
export function sumarMonedas(n) {
  const d = cargar();
  d.monedas = Math.max(0, Math.round(d.monedas + n));
  guardar();
  return d.monedas;
}

export const tiene = (id) => !!cargar().skins[id];

/**
 * Comprar con monedas. Devuelve si se pudo.
 *
 * COBRA Y ENTREGA EN LA MISMA FUNCION, y eso no es un detalle de estilo:
 * separarlo en "descontar" y "entregar" deja una ventana donde el juego puede
 * cerrarse entre las dos y alguien pierde cuarenta mil monedas sin recibir
 * nada. Acá o pasan las dos cosas o no pasa ninguna.
 */
export function comprarConMonedas(id, precio) {
  const d = cargar();
  if (d.skins[id]) return false;
  if (!(precio > 0) || d.monedas < precio) return false;
  d.monedas -= precio;
  d.skins[id] = true;
  guardar();
  return true;
}

export function ponerse(id) {
  const d = cargar();
  if (!d.skins[id]) return false;
  d.skin = id;
  guardar();
  return true;
}
export function guardar() {
  try { localStorage.setItem(LLAVE, JSON.stringify(cargar())); } catch (e) {}
}
export function borrar() {
  try { localStorage.removeItem(LLAVE); } catch (e) {}
  cache = null;
}
