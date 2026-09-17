// Las constantes del juego, todas juntas, porque SON el juego: cambiar LARGO de
// 120 a 160 no es un ajuste, es otra torre.

export const VISTA = { ancho: 360, alto: 640 };   // el alto se ajusta a la pantalla
export const ANCHO = 360;

// LA MECANICA ENTERA: un peso, una soga y la gravedad.
//
// Apoyás el dedo y sale un gancho hacia la argolla que tengas más cerca del
// dedo. Mientras la soga esté enganchada sos un péndulo: la gravedad te tira y
// la soga te obliga a girar alrededor de la argolla, así que bajás acelerando y
// subís frenando. Soltás y salís disparado por la tangente.
//
// Todo el juego es CUANDO soltar. Soltás abajo del todo y salís rápido pero
// para el costado; soltás arriba y salís lento pero para arriba. No hay un
// momento correcto: hay uno para cada argolla que quieras alcanzar, y eso es lo
// que hace que valga la pena jugarlo dos veces.
export const F = {
  GRAVEDAD: 0.42,
  ROCE_AIRE: 0.9965,          // el aire casi no frena: el envión se hereda
  ROCE_SOGA: 0.9992,           // la soga sí, un poquito, si no el péndulo es eterno

  ALCANCE: 168,               // hasta dónde llega el gancho
  // EL LARGO MINIMO DE LA SOGA ES GRANDE A PROPOSITO. La soga sale del largo
  // que había al enganchar, y enganchando muy cerca de la argolla quedaba un
  // péndulo de treinta píxeles: con un arco así no se junta el envión para
  // llegar a la próxima, y el robot se quedaba hamacándose para siempre sin
  // subir un metro. Con un piso de 76 la soga queda floja en vez de corta —y
  // floja no molesta, porque la soga tira pero no empuja.
  LARGO_MIN: 76,
  // LA SOGA NO SE ACORTA SOLA, y probé que sí. Recogiendo medio píxel por
  // cuadro la soga llegaba al mínimo en tres segundos, y con soga corta el
  // péndulo es chiquito: la velocidad que se junta en un arco de 34 px alcanza
  // para subir 34 px, y las argollas están a 96. O sea que "quedarse colgado
  // para ganar altura" terminaba siendo la forma de no llegar nunca a ninguna
  // parte. El largo queda el que había al enganchar, y la altura se gana
  // hamacándose, que además es una decisión y no una espera.

  // EL EMPUJE: colgado, arrastrar el dedo hamaca. Sin esto el juego no existe —
  // enganchado justo abajo de la argolla y sin velocidad de costado, un péndulo
  // no arranca solo: se queda subiendo y bajando en línea recta para siempre.
  // Es literalmente lo que hace un chico en una hamaca, y es lo que convierte
  // "esperar" en "trabajar para ganar altura".
  EMPUJE: 0.62,

  BICHO: 11,                  // radio del cuerpo
  ARGOLLA: 9,                 // radio de la argolla dibujada

  VEL_MAX: 17,                // tope de velocidad: 344 px de vuelo hacia arriba

  // La torre.
  SEP_MIN: 96, SEP_MAX: 148,  // cuánto sube de una argolla a la otra
  // Y CUANTO SE CORRE DE COSTADO, con un MINIMO que no es capricho: dos
  // argollas en la misma vertical no se pueden encadenar hamacándose —el
  // péndulo que sale de una no apunta a la otra— y el generador las ponía todo
  // el tiempo, porque el corrimiento salía de un rango grande y se recortaba
  // contra la pared, dejando una escalera pegada al borde.
  DX_MIN: 46, DX_MAX: 128,
  BORDE: 26,                  // margen contra las paredes
  OXIDADAS_DESDE: 700,        // a partir de qué altura aparecen las que se rompen
  VIDA_OXIDADA: 48,           // cuadros que aguanta una argolla oxidada

  // EL PISO SUBE, y es el único peligro además de caerse. Probé púas en las
  // paredes y era una pelea contra la geometría del juego: un péndulo BARRE de
  // pared a pared —es lo que hace— así que poner el castigo en las paredes es
  // castigar la mecánica. El piso que sube no pelea con nada: apura. Arranca
  // tarde, para que los primeros metros se puedan mirar.
  SUBE_DESDE: 4000,
  SUBE_TIEMPO: 3600,          // y si no llegaste, al minuto empieza igual
  SUBE_VEL: 0.3,              // px por cuadro cuando arranca
  SUBE_MAX: 1.4,              // y hasta dónde acelera
};

export const M = (px) => Math.max(0, Math.floor(px / 100));      // píxeles a metros

export const mezcla = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
export const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Cuánto se escala el juego para entrar en la pantalla.
 *
 * El ANCHO es fijo en 360 para todos los aparatos: si se estirara, en una
 * pantalla angosta habría menos lugar entre argolla y argolla y el mismo swing
 * pasaría de sobrar a no llegar. El alto se estira hasta donde haya, porque ver
 * más o menos torre no cambia ninguna cuenta.
 */
export function ajustarVista(anPantalla, alPantalla) {
  // Y SE GARANTIZA UN MINIMO DE TORRE A LA VISTA. Escalando sólo por el ancho,
  // el teléfono acostado daba una escala de 2,3 y dejaba ver ciento sesenta y
  // seis píxeles de alto: menos que la distancia entre dos argollas. El juego
  // no era difícil, era imposible — no se veía adónde saltar. Con el mínimo, en
  // horizontal queda una tira angosta en el medio de la pantalla, que es lo que
  // corresponde a un juego vertical.
  const esc = Math.min(anPantalla / VISTA.ancho, alPantalla / MIN_ALTO, 3);
  VISTA.alto = Math.round(Math.min(alPantalla / esc, 1100));
  return esc;
}

const MIN_ALTO = 520;

/** Un azar con semilla: la misma semilla, la misma torre, en cualquier aparato. */
export function azar(semilla) {
  let s = (semilla >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
