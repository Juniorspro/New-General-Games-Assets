// Las constantes del juego. Todas juntas y en un solo lugar, porque son el
// juego: cambiar TERMINAL_CERRADO de 13 a 16 no es un ajuste de tuning, es
// otro juego.

export const VISTA = { ancho: 360, alto: 640 };   // alto se ajusta a la pantalla

// LA MECANICA ENTERA EN CUATRO NUMEROS.
//
// El paraguas abierto cae lento y es ANCHO; cerrado cae rapido y es ANGOSTO.
// De ahi sale todo: un hueco de cuarenta pixeles no te deja pasar abierto, asi
// que tenes que cerrar, y cerrando caes al triple de velocidad y tenes un
// tercio del tiempo para acomodarte. El nivel no te pide "sea habilidoso": te
// pide elegir, y la eleccion se paga sola.
export const F = {
  GRAVEDAD: 0.5,
  TERMINAL_ABIERTO: 4.3,      // px por cuadro cayendo con el paraguas abierto
  TERMINAL_CERRADO: 13.5,     // y cerrado
  ROCE: 0.075,                // que tan rapido se llega a la terminal

  // El ancho del paraguas ES la caja de choque. Abierto no entra por los
  // huecos angostos; cerrado si.
  ANCHO_ABIERTO: 52,
  ANCHO_CERRADO: 15,
  ALTO_PARAGUAS: 12,

  // El cuerpo, que cuelga abajo y choca aparte.
  CUERPO_AN: 17,
  CUERPO_AL: 34,

  // Abrir y cerrar TARDA, y ese retardo es la dificultad. Instantaneo, el
  // juego se vuelve "apreta en el momento justo" y el paraguas deja de
  // importar; con nueve cuadros hay que decidir ANTES de llegar.
  VEL_PARAGUAS: 0.11,

  // Moverse de costado. Abierto responde mejor —el paraguas agarra aire— pero
  // llega menos lejos; cerrado es una flecha: tarda en arrancar y despues no
  // frena.
  VX_ABIERTO: 4.0, VX_CERRADO: 5.4,
  REACCION_ABIERTO: 0.16, REACCION_CERRADO: 0.085,

  VARILLAS: 3,            // los golpes que aguanta el paraguas

  // CUANTOS CUADROS TIENE QUE ESTAR QUIETO EL DEDO PARA QUE EL PARAGUAS CIERRE.
  //
  // Arrastrar y cerrar son dos gestos distintos con el mismo dedo, y antes
  // eran el mismo: apoyar cerraba, así que correrse de costado —que se hace
  // arrastrando, con el dedo apoyado— cerraba el paraguas sin que nadie lo
  // pidiera y se caía al triple justo mientras se estaba maniobrando. Ahora el
  // dedo en movimiento NO cierra: se cierra cuando se queda quieto. Ocho
  // cuadros son 130 ms, abajo del tiempo que tarda una persona en parar el
  // pulgar a propósito y arriba del temblor de la mano.
  QUIETO: 8,
};

export const M = (px) => Math.max(0, Math.floor(px / 100));   // pixeles a metros

/** Interpolar entre a y b con t recortado a [0,1]. */
export const mezcla = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

/**
 * La vista se estira a lo alto y NUNCA a lo ancho.
 *
 * El pozo mide 360 unidades en todos los aparatos: si se escalara para llenar
 * la pantalla en las dos direcciones, en un telefono ancho el hueco de cuarenta
 * pixeles seria proporcionalmente el mismo pero habria que cruzar mas pozo en
 * el mismo tiempo. Con el ancho clavado, esquivar cuesta igual en todos lados.
 * Ver mas o menos pozo a lo alto no cambia nada: se cae siempre igual.
 */
export function ajustarVista(w, h) {
  let esc = Math.min(w / VISTA.ancho, h / 560);
  let alto = h / esc;
  if (alto > 1000) { esc = h / 1000; alto = 1000; }
  VISTA.alto = Math.round(alto);
  return esc;
}
