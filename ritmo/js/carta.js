// La carta: qué notas se tocan, en qué carril y cuándo.
//
// EL CARRIL SIGUE A LA MELODIA. Grave a la izquierda, agudo a la derecha: el
// dedo dibuja la línea que suena, y por eso una canción se "siente" antes de
// aprendérsela. Sortear el carril se juega igual de bien y se olvida enseguida.

import { CANCIONES, componer } from "./compositor.js";

/* CUATRO CARRILES Y NO TRES. Tres se juegan cómodos con un pulgar y por eso
   estaban; cuatro es lo que la gente reconoce —izquierda, abajo, arriba,
   derecha— y lo que permite tocar con los dos pulgares como se toca de verdad.
   El costo es que las notas quedan más cerca entre sí, y de eso se encarga el
   validador: el piso de 115 ms por carril no se toca. */
export const CARRILES = 4;

/** Lo mínimo que puede haber entre dos notas del MISMO carril, en segundos.
 *
 *  UN DEDO NO ES UNA TECLA. Levantar y volver a apoyar el pulgar sobre el mismo
 *  punto lleva su tiempo; dos notas del mismo carril más juntas que esto no son
 *  difíciles, son imposibles, y el que juega siente que el juego no lo lee.
 *  En carriles distintos se usan dos dedos, así que ahí la exigencia es otra. */
export const MIN_MISMO = 0.115;
/** Lo mínimo entre dos notas cualesquiera, con las dos manos. */
export const MIN_CUALQUIERA = 0.055;
/** Cuántas pueden caer exactamente juntas: dos pulgares, dos notas. */
export const MAX_JUNTAS = 2;

/**
 * Arma la carta de una canción ya compuesta.
 * Devuelve las notas ordenadas por tiempo, cada una {t, carril, largo, nota}.
 */
export function armarCarta(cancion) {
  const tema = componer(cancion);
  const mel = tema.eventos.filter((e) => e.tipo === "melodia");
  if (!mel.length) return { tema, notas: [] };

  const notas = mel.map((e) => e.nota);
  const bajo = Math.min(...notas), alto = Math.max(...notas);
  const rango = Math.max(1, alto - bajo);
  const carrilDe = (n) => Math.min(CARRILES - 1, Math.floor(((n - bajo) / rango) * CARRILES));

  const carta = mel.map((e) => ({ t: e.t, carril: carrilDe(e.nota), largo: e.largo || 0, nota: e.nota }));

  /* EL ARREGLO DE CARRIL, y por qué existe.
     Dos notas seguidas del mismo tono caen en el mismo carril. Si además están
     a una semicorchea, a 140 pulsos por minuto eso son 107 ms — por debajo de
     lo que un pulgar puede repetir. La melodía es la que manda, así que lo que
     se corre es el carril y no la nota: se la pasa al carril vecino, que
     musicalmente no cambia nada porque el sonido ya está escrito. Se prueba
     primero el vecino de abajo y después el de arriba, para no empujar todo
     hacia un lado. */
  let corridas = 0;
  const ultimoDe = new Array(CARRILES).fill(-Infinity);
  for (const n of carta) {
    if (n.t - ultimoDe[n.carril] >= MIN_MISMO) { ultimoDe[n.carril] = n.t + n.largo; continue; }
    const opciones = [n.carril - 1, n.carril + 1, n.carril - 2, n.carril + 2]
      .filter((c) => c >= 0 && c < CARRILES);
    const libre = opciones.find((c) => n.t - ultimoDe[c] >= MIN_MISMO);
    if (libre !== undefined) { n.carril = libre; corridas++; }
    ultimoDe[n.carril] = n.t + n.largo;
  }

  return { tema, notas: carta, corridas };
}

/** Las nueve cartas, listas. Se arma a pedido: componer las nueve cuesta. */
const cache = new Map();
export function carta(id) {
  if (!cache.has(id)) cache.set(id, armarCarta(CANCIONES.find((c) => c.id === id)));
  return cache.get(id);
}
