// Los bichos. Todos inventados: cumplen roles del género sin parecerse a nadie.
//
// CADA UNO TIENE QUE LEERSE DE UN VISTAZO, incluso con cuarenta en pantalla.
// Por eso se distinguen por SILUETA y no por detalle: una gota, un triángulo,
// un hexágono. El color ayuda, pero el que juega mira la forma.

export const BICHOS = {
  // la masa: lenta, blanda, y viene de a montones
  mota:      { r: 11, vida: 10,  vel: 60,  daño: 9,  xp: 1, color: "#8ad06a", forma: "gota",  peso: 1.0 },
  // la presión: rápida y de vidrio, castiga quedarse quieto
  pua:       { r: 9,  vida: 7,   vel: 122,  daño: 13, xp: 2, color: "#ff7a5c", forma: "punta", peso: 0.8 },
  // el muro: obliga a rodear en vez de atravesar
  caparazon: { r: 17, vida: 58,  vel: 42,  daño: 19, xp: 5, color: "#7d9bd6", forma: "placa", peso: 2.6 },
  // el ruido: no va derecho, así que no se le puede apuntar de memoria
  zumbido:   { r: 10, vida: 14,  vel: 95,  daño: 11, xp: 3, color: "#e8c65a", forma: "rombo", peso: 1.0, errante: true },
  // el jefe: lento, enorme, y va largando motas
  bulto:     { r: 40, vida: 1500, vel: 34, daño: 32, xp: 120, color: "#c264e0", forma: "placa", peso: 12, jefe: true },
};

/* LAS OLEADAS, en segundos desde el arranque.
   Escritas a mano y no generadas: una curva automática sube parejo y aburre.
   Acá hay respiros a propósito —el minuto 3 después del primer jefe— porque lo
   que hace que una partida se sienta larga no es la dificultad sino no poder
   respirar nunca. */
/* LA VELOCIDAD ES LA VARIABLE QUE MANDA, y costó tres rondas de medición
   entenderlo. Subir la vida de los bichos y el daño de contacto casi no movió
   la supervivencia del robot: con el jugador a 140 y la masa a 46, nunca lo
   alcanzaban, así que ni la vida ni el daño llegaban a aplicarse. Lo que hace
   que una oleada sea una amenaza es que TE LLEGUE. La púa ahora corre casi
   tanto como vos: no se la puede dejar atrás, hay que matarla. */
export const OLEADAS = [
  { desde:   0, cada: 1.10, tipos: ["mota"],                            porVez: 2 },
  { desde:  35, cada: 0.95, tipos: ["mota", "mota", "pua"],             porVez: 2 },
  { desde:  75, cada: 0.85, tipos: ["mota", "pua", "zumbido"],          porVez: 3 },
  { desde: 115, cada: 0.80, tipos: ["mota", "pua", "caparazon"],        porVez: 3 },
  { desde: 160, cada: 0.00, tipos: [],                                  porVez: 0, jefe: "bulto" },
  { desde: 175, cada: 1.30, tipos: ["mota"],                            porVez: 2 },   // el respiro
  { desde: 205, cada: 0.70, tipos: ["pua", "zumbido", "caparazon"],     porVez: 4 },
  { desde: 255, cada: 0.60, tipos: ["mota", "pua", "zumbido", "caparazon"], porVez: 5 },
  { desde: 310, cada: 0.00, tipos: [],                                  porVez: 0, jefe: "bulto" },
  { desde: 325, cada: 0.50, tipos: ["pua", "zumbido", "caparazon"],     porVez: 6 },
];

/** Cuánta vida de más tienen los bichos a los `t` segundos.
 *
 *  SUBE POR TRAMOS Y NO SIN FRENO. Multiplicando sin tope, a los seis minutos
 *  una mota aguanta lo que un jefe y el arma que elegiste deja de importar.
 *  Lo que tiene que crecer es CUANTOS vienen, no cuánto aguanta cada uno. */
export const dureza = (t) => 1 + Math.min(2.2, t / 190);

/* EL TECHO DE BICHOS VIVOS, y por qué no es una optimización sino balance.
   Medido con un robot sobre doce partidas: sin techo se llegaba a 560 bichos a
   la vez y NINGUNA de las doce sobrevivía. Lo que pasa es una espiral: si no
   alcanzás a matar al ritmo al que entran, cada segundo entran más, y a partir
   de cierto punto no hay arma que lo dé vuelta — la partida ya está perdida
   dos minutos antes de que te toquen. Con techo, quedarse atrás se paga caro
   pero se puede remontar. Y de paso el cuadro deja de costar 15 ms. */
export const MAX_BICHOS = 200;

export const LARGO = 360;   // seis minutos: una partida entra en un viaje corto
