// Las armas y las mejoras. Nada de esto se apunta: se elige.
//
// POR QUE EL ATAQUE ES AUTOMATICO. En un teléfono, mover y apuntar con dos
// pulgares a la vez es pelear con el aparato, no con los bichos. Acá el único
// gesto es moverse; lo que decide la partida es QUE arma subís y en qué orden.
// Eso convierte cada subida de nivel en la jugada de verdad.

export const ARMAS = {
  /* Dispara sola al bicho más cercano. Es el arma de arranque porque enseña la
     regla de la casa: si no mirás para dónde, igual pega. */
  chispa: {
    nombre: "chispa", tipo: "tiro", color: "#ffe066",
    niveles: [
      { cada: 0.62, daño: 12, vel: 380, radio: 5.0, cuantos: 1, atraviesa: 0 },
      { cada: 0.54, daño: 15, vel: 400, radio: 5.5, cuantos: 2, atraviesa: 0 },
      { cada: 0.46, daño: 19, vel: 420, radio: 6.0, cuantos: 2, atraviesa: 1 },
      { cada: 0.40, daño: 24, vel: 440, radio: 6.5, cuantos: 3, atraviesa: 1 },
      { cada: 0.34, daño: 30, vel: 470, radio: 7.0, cuantos: 3, atraviesa: 2 },
    ],
  },
  /* Trozos que giran alrededor. No hay que hacer nada y por eso es la respuesta
     a quedar rodeado: pega en todas las direcciones a la vez. */
  orbita: {
    nombre: "orbita", tipo: "orbita", color: "#7cf6ff",
    niveles: [
      { cuantos: 2, daño: 7,  radio: 52, giro: 2.2, r: 8 },
      { cuantos: 3, daño: 9,  radio: 56, giro: 2.4, r: 8 },
      { cuantos: 4, daño: 11, radio: 60, giro: 2.6, r: 9 },
      { cuantos: 5, daño: 14, radio: 66, giro: 2.8, r: 9 },
      { cuantos: 6, daño: 18, radio: 72, giro: 3.0, r: 10 },
    ],
  },
  /* Una onda que se abre desde vos. Poco daño pero empuja, y empujar es lo que
     te saca de un abrazo del que no se sale disparando. */
  onda: {
    nombre: "onda", tipo: "onda", color: "#b48cff",
    niveles: [
      { cada: 3.2, daño: 12, radio: 96,  empuje: 150 },
      { cada: 2.9, daño: 15, radio: 112, empuje: 165 },
      { cada: 2.6, daño: 19, radio: 130, empuje: 180 },
      { cada: 2.3, daño: 24, radio: 150, empuje: 200 },
      { cada: 2.0, daño: 30, radio: 172, empuje: 225 },
    ],
  },
  /* Un latigazo para donde vas. Es la única que premia mirar para dónde corrés,
     así que le da algo que hacer al que quiere jugar fino. */
  hilo: {
    nombre: "hilo", tipo: "hilo", color: "#ff6ea9",
    niveles: [
      { cada: 1.20, daño: 16, largo: 96,  ancho: 34 },
      { cada: 1.05, daño: 20, largo: 108, ancho: 38 },
      { cada: 0.92, daño: 25, largo: 120, ancho: 42 },
      { cada: 0.80, daño: 31, largo: 134, ancho: 48 },
      { cada: 0.68, daño: 39, largo: 150, ancho: 54 },
    ],
  },
  /* Semillas que quedan atrás y estallan. Premia correr en círculos, que es lo
     que uno termina haciendo igual. */
  semilla: {
    nombre: "semilla", tipo: "semilla", color: "#8ad06a",
    niveles: [
      { cada: 1.7, daño: 22, radio: 44, dura: 6 },
      { cada: 1.5, daño: 27, radio: 50, dura: 6 },
      { cada: 1.3, daño: 33, radio: 56, dura: 7 },
      { cada: 1.1, daño: 41, radio: 64, dura: 7 },
      { cada: 0.9, daño: 52, radio: 72, dura: 8 },
    ],
  },
};

/** Las pasivas. Suben un número y ya; están para que no todas las elecciones
 *  sean un arma nueva que hay que aprender a mitad de partida. */
export const PASIVAS = {
  botas:  { max: 5, aplicar: (p, n) => { p.vel = 140 * (1 + n * 0.09); } },
  /* EL IMAN ARRANCA GRANDE, y eso es balance y no comodidad. Las gemas caen
     DONDE MUERE EL BICHO, y con un arma que llega a 520 píxeles eso es lejos de
     vos. Con un radio de 52 —el primero que puse— el jugador huía, las gemas
     quedaban atrás y no subía de nivel nunca: medido, 25 bichos matados, 21
     gemas tiradas en el piso y 4 de experiencia. El juego entero es subir de
     nivel, así que juntar no puede depender de volver a pisar el lugar. */
  iman:   { max: 5, aplicar: (p, n) => { p.iman = 150 * (1 + n * 0.30); } },
  coraza: { max: 5, aplicar: (p, n) => { p.vidaMax = 100 + n * 26; } },
  filo:   { max: 5, aplicar: (p, n) => { p.daño = 1 + n * 0.12; } },
  pulso:  { max: 5, aplicar: (p, n) => { p.frecuencia = 1 - n * 0.065; } },
};

/** Cuánta experiencia hace falta para el nivel `n`.
 *
 *  CRECE PERO NO SE DISPARA. Con una curva exponencial, después del nivel diez
 *  no se sube más y las mejoras que faltan no se ven nunca; con una plana, a
 *  los dos minutos ya está todo al máximo y el resto de la partida es inercia. */
export const xpParaNivel = (n) => Math.round(4 + n * 2.6 + n * n * 0.45);
