// Las armas, las pasivas y las evoluciones. Nada de esto se apunta: se elige.
//
// POR QUE EL ATAQUE ES AUTOMATICO. En un teléfono, mover y apuntar con dos
// pulgares es pelear con el aparato y no con los bichos. El único gesto es
// moverse; lo que decide la partida es QUE subís y en qué orden. Por eso cada
// subida de nivel es la jugada de verdad.

export const ARMAS = {
  /* Dispara sola a lo más cercano. Es el arma de arranque porque enseña la
     regla de la casa: si no mirás para dónde, igual pega. */
  chispa: {
    tipo: "tiro", color: "#ffe066",
    niveles: [
      { cada: 0.62, daño: 12, vel: 380, radio: 5.0, cuantos: 1, atraviesa: 0, alcance: 290 },
      { cada: 0.54, daño: 15, vel: 400, radio: 5.5, cuantos: 2, atraviesa: 0, alcance: 300 },
      { cada: 0.46, daño: 19, vel: 420, radio: 6.0, cuantos: 2, atraviesa: 1, alcance: 310 },
      { cada: 0.40, daño: 24, vel: 440, radio: 6.5, cuantos: 3, atraviesa: 1, alcance: 320 },
      { cada: 0.34, daño: 30, vel: 470, radio: 7.0, cuantos: 3, atraviesa: 2, alcance: 330 },
    ],
    evoluciona: { con: "filo", en: "tormenta" },
  },
  /* Trozos que giran. No hay que hacer nada, y por eso es la respuesta a quedar
     rodeado: pega en todas las direcciones a la vez. */
  orbita: {
    tipo: "orbita", color: "#7cf6ff",
    niveles: [
      { cuantos: 2, daño: 7,  radio: 56, giro: 2.2, r: 9 },
      { cuantos: 3, daño: 9,  radio: 60, giro: 2.4, r: 9 },
      { cuantos: 4, daño: 11, radio: 64, giro: 2.6, r: 10 },
      { cuantos: 5, daño: 14, radio: 70, giro: 2.8, r: 10 },
      { cuantos: 6, daño: 18, radio: 76, giro: 3.0, r: 11 },
    ],
    evoluciona: { con: "pulso", en: "anillo" },
  },
  /* Una onda que se abre desde vos. Poco daño pero empuja, y empujar es lo que
     te saca de un abrazo del que no se sale disparando. */
  onda: {
    tipo: "onda", color: "#b48cff",
    niveles: [
      { cada: 3.2, daño: 12, radio: 96,  empuje: 150 },
      { cada: 2.9, daño: 15, radio: 112, empuje: 165 },
      { cada: 2.6, daño: 19, radio: 130, empuje: 180 },
      { cada: 2.3, daño: 24, radio: 150, empuje: 200 },
      { cada: 2.0, daño: 30, radio: 172, empuje: 225 },
    ],
    evoluciona: { con: "coraza", en: "sismo" },
  },
  /* Un latigazo para donde vas. Es la única que premia mirar para dónde corrés,
     así que le da algo que hacer al que quiere jugar fino. */
  hilo: {
    tipo: "hilo", color: "#ff6ea9",
    niveles: [
      { cada: 1.20, daño: 16, largo: 100, ancho: 36 },
      { cada: 1.05, daño: 20, largo: 112, ancho: 40 },
      { cada: 0.92, daño: 25, largo: 124, ancho: 44 },
      { cada: 0.80, daño: 31, largo: 138, ancho: 50 },
      { cada: 0.68, daño: 39, largo: 154, ancho: 56 },
    ],
    evoluciona: { con: "botas", en: "guadaña" },
  },
  /* Semillas que quedan atrás y estallan. Premia correr en círculos, que es lo
     que uno termina haciendo igual. */
  semilla: {
    tipo: "semilla", color: "#8ad06a",
    niveles: [
      { cada: 1.7, daño: 22, radio: 46, dura: 6 },
      { cada: 1.5, daño: 27, radio: 52, dura: 6 },
      { cada: 1.3, daño: 33, radio: 58, dura: 7 },
      { cada: 1.1, daño: 41, radio: 66, dura: 7 },
      { cada: 0.9, daño: 52, radio: 74, dura: 8 },
    ],
    evoluciona: { con: "iman", en: "raiz" },
  },
};

/* ── LAS EVOLUCIONES ────────────────────────────────────────────────────────
   Un arma al máximo MAS su pasiva al máximo se funden en otra cosa. Existen
   por una razón concreta: sin ellas, después del nivel quince todas las
   ofertas son "+1 a algo que ya tenés" y la pantalla de mejoras —que es donde
   está el juego— se vuelve un trámite. Con ellas, las pasivas dejan de ser el
   premio consuelo y pasan a ser una apuesta: subir `filo` no es sólo más daño,
   es el camino a otra arma.
   Se ofrecen SOLAS y marcadas, porque una evolución que aparece mezclada entre
   dos mejoras comunes se elige sin entender que era la jugada de la partida. */
export const EVOLUCIONES = {
  tormenta: { tipo: "tiro",   color: "#fff3a0", de: "chispa",
              datos: { cada: 0.20, daño: 34, vel: 520, radio: 8, cuantos: 5, atraviesa: 99, alcance: 380 } },
  anillo:   { tipo: "anillo", color: "#b6fbff", de: "orbita",
              datos: { daño: 26, radio: 92, giro: 3.6, grosor: 15 } },
  sismo:    { tipo: "onda",   color: "#d9c2ff", de: "onda",
              datos: { cada: 1.5, daño: 52, radio: 240, empuje: 330, aturde: 1.1 } },
  guadaña:  { tipo: "guadaña",color: "#ffa8cc", de: "hilo",
              datos: { cada: 0.55, daño: 48, radio: 128, arco: Math.PI * 1.35 } },
  raiz:     { tipo: "raiz",   color: "#b6f09a", de: "semilla",
              datos: { cada: 0.8, daño: 40, radio: 74, dura: 9, hilo: 12 } },
};

/** Las pasivas. Suben un número — y son la mitad de cada evolución. */
export const PASIVAS = {
  botas:  { max: 5, aplicar: (p, n) => { p.vel = 140 * (1 + n * 0.09); } },
  /* EL IMAN ARRANCA GRANDE, y eso es balance. Las gemas caen DONDE MUERE EL
     BICHO, y con un arma de alcance eso es lejos de vos. Con un radio chico el
     jugador huía, las gemas quedaban atrás y no subía de nivel nunca: medido,
     25 bichos matados, 21 gemas en el piso y 4 de experiencia. El juego entero
     es subir de nivel, así que juntar no puede depender de volver a pisar. */
  iman:   { max: 5, aplicar: (p, n) => { p.iman = 150 * (1 + n * 0.30); } },
  coraza: { max: 5, aplicar: (p, n) => { p.vidaMax = 100 + n * 26; } },
  filo:   { max: 5, aplicar: (p, n) => { p.daño = 1 + n * 0.12; } },
  pulso:  { max: 5, aplicar: (p, n) => { p.frecuencia = 1 - n * 0.065; } },
};

/** Cuánta experiencia hace falta para el nivel `n`.
 *
 *  CRECE PERO NO SE DISPARA. Con una curva exponencial, pasado el nivel diez no
 *  se sube más y las mejoras que faltan no se ven nunca; con una plana, a los
 *  dos minutos está todo al máximo y el resto de la partida es inercia. */
export const xpParaNivel = (n) => Math.round(4 + n * 2.6 + n * n * 0.45);

/* EL ENVION. Es la única cosa que se aprieta en todo el juego, y existe porque
   sin él la habilidad se reduce a caminar bien: no hay forma de arreglar un
   error. Medio segundo de invulnerabilidad convierte "me encerraron" en "me
   encerraron y salí", que es la diferencia entre una muerte injusta y una
   buena. Con espera larga para que no sea la respuesta a todo. */
export const ENVION = { distancia: 168, espera: 3.4, gracia: 0.42, dura: 0.16 };
