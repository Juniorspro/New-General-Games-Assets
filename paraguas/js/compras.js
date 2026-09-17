// El cobro de las tres skins pagas.
//
// ═══════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO HOY NO COBRA NADA, Y ESO ES A PROPOSITO.
// ═══════════════════════════════════════════════════════════════════════════
//
// El juego no sabe nada de plata. Pregunta dos cosas —"¿se puede comprar acá?"
// y "¿esta skin ya está paga?"— y llama a `comprar()` cuando alguien toca el
// botón. Todo lo demás vive del otro lado de este archivo.
//
// Sin nada conectado, `disponible()` devuelve false: el botón dice "no
// disponible", no se cobra nada, no se pide ningún dato y no se desbloquea
// nada. Es la única forma honesta de entregar una tienda a medio conectar — un
// botón que simula una compra y desbloquea la skin igual es una mentira que
// además arruina la economía del juego.
//
// COMO SE CONECTA UNA TIENDA DE VERDAD. Quien la conecte tiene que darle a este
// archivo un objeto con tres funciones y llamar a `conectar()` antes de que
// arranque el juego:
//
//     PARAGUAS_COMPRAS = {
//       async catalogo(ids)   → [{ id, precio: "US$ 2,99" }]
//       async comprar(id)     → { ok: true } | { ok: false, motivo }
//       async restaurar()     → [ids ya comprados]
//     }
//
// `id` es el `producto` de la skin (`paraguas.skin.cromo`, etc.), que es el
// mismo identificador que hay que dar de alta en la tienda de Google o de
// Apple. Del lado del juego no hay nada más que hacer.
//
// TRES COSAS QUE NO HACE ESTE ARCHIVO, Y NO LAS TIENE QUE HACER:
//
//  · No guarda ni ve datos de pago. Eso lo maneja la tienda del teléfono, que
//    es la única que puede: un juego en una página no puede cobrar por su
//    cuenta ni tiene por qué ver un número de tarjeta.
//  · No valida el recibo. Lo que este archivo marca como comprado vive en el
//    aparato y se puede editar a mano. Para una tienda de verdad, la validación
//    va del lado del servidor y `restaurar()` tiene que consultarlo — si no, la
//    compra se copia con un editor de texto.
//  · No sabe de precios. Los muestra tal como se los da la tienda, porque el
//    precio depende del país, de la moneda y de los impuestos, y ponerlo a mano
//    en el código es la manera de mostrarle a alguien en Argentina un precio en
//    dólares que no es el que va a pagar.

import { cargar, guardar } from "./guardado.js";

let puente = null;

/** La conecta quien envuelva el juego en una app. Antes de esto, no hay tienda. */
export function conectar(p) {
  puente = p && typeof p.comprar === "function" ? p : null;
  return !!puente;
}

// Se mira también una variable global, que es como la va a inyectar el
// envoltorio nativo: el juego es un HTML suelto y no puede importar un módulo
// que todavía no existe.
if (typeof globalThis !== "undefined" && globalThis.PARAGUAS_COMPRAS)
  conectar(globalThis.PARAGUAS_COMPRAS);

export const disponible = () => !!puente;

/** Los precios de la tienda, si hay tienda. Sin tienda, un mapa vacío. */
export async function precios(ids) {
  if (!puente || !puente.catalogo) return {};
  try {
    const lista = await puente.catalogo(ids);
    const m = {};
    for (const x of lista || []) m[x.id] = x.precio;
    return m;
  } catch (e) { return {}; }
}

/**
 * Comprar. Devuelve `{ ok }` y, si salió bien, deja la skin habilitada.
 *
 * NO HAY CAMINO ALTERNATIVO. Si no hay tienda conectada devuelve `ok: false` y
 * el juego muestra que no está disponible. Es tentador dejar un atajo "por
 * ahora" que desbloquee la skin igual; ese atajo sobrevive a la entrega, y el
 * día que la tienda se conecta resulta que medio mundo ya tiene las tres skins.
 */
export async function comprar(producto) {
  if (!puente) return { ok: false, motivo: "sin-tienda" };
  try {
    const r = await puente.comprar(producto);
    if (r && r.ok) marcar(producto);
    return r || { ok: false, motivo: "sin-respuesta" };
  } catch (e) {
    return { ok: false, motivo: "error" };
  }
}

/**
 * Restaurar compras. Es OBLIGATORIO en las dos tiendas grandes y además es lo
 * correcto: alguien que cambió de teléfono ya pagó.
 */
export async function restaurar() {
  if (!puente || !puente.restaurar) return [];
  try {
    const ids = (await puente.restaurar()) || [];
    for (const id of ids) marcar(id);
    return ids;
  } catch (e) { return []; }
}

function marcar(producto) {
  const d = cargar();
  d.pagas = d.pagas || {};
  d.pagas[producto] = true;
  guardar();
}

export const pagada = (producto) => !!(cargar().pagas || {})[producto];
