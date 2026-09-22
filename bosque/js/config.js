// Los números del mundo, todos juntos.
//
// ESTÁN ACÁ Y NO REPARTIDOS porque son los que se tocan para que el bosque se
// sienta distinto. Un número escondido adentro de una función es un número que
// nadie vuelve a tocar.
//
// Unidades: METROS y SEGUNDOS. El caminante mide 1,75, un abeto grande 30. Si
// algo "se ve chico" o "se ve grande", la respuesta está en estas proporciones
// y no en la cámara.

export const MUNDO = {
  LADO: 480,          // el terreno cubre de -240 a 240 en x y en z
  CELDAS: 240,        // cuadros de la malla por lado: 2 m cada uno
  AGUA: 0,            // la altura del lago
  RADIO_JUGABLE: 196, // más allá sube el cerro y hay una pared que no se ve
  SEMILLA: 19960922,  // fija: el bosque es SIEMPRE el mismo
};

// El lago queda en la dirección del sol vista desde el comienzo del sendero.
// No es casualidad: el primer minuto de juego es caminar hacia el atardecer y
// que el bosque se abra y aparezca el agua con el sol encima.
export const LUGARES = {
  inicio: { x: 6, z: 158 },
  lago: { x: 22, z: -52, radio: 58 },
  cabana: { x: 70, z: 6, giro: -2.35 },
  fogata: { x: 58, z: 21 },
  muelle: { x: 52, z: -14 },
  mirador: { x: -112, z: 52, alto: 24, radio: 46 },
  claro: { x: -66, z: 116, radio: 26 },
  abedules: { x: -34, z: -128, radio: 44 },
};

// Los senderos, como puntos por los que pasa una curva suave. El ancho es el
// del camino pisado; a los costados queda una franja donde no crece nada alto.
export const SENDEROS = [
  // del comienzo al cruce, bajando al lago
  { ancho: 2.2, puntos: [[6, 170], [6, 158], [2, 136], [12, 112], [4, 88], [10, 64], [4, 44]] },
  // del cruce a la cabaña, por la orilla este
  { ancho: 1.9, puntos: [[4, 44], [22, 34], [42, 26], [58, 16], [64, 8]] },
  // del cruce al mirador, subiendo por el oeste
  { ancho: 1.7, puntos: [[4, 44], [-18, 52], [-44, 62], [-70, 64], [-92, 58], [-106, 52]] },
  // del sendero principal al claro de las flores
  { ancho: 1.5, puntos: [[12, 112], [-12, 118], [-40, 120], [-58, 116]] },
  // la vuelta al lago por el norte, hasta los abedules
  { ancho: 1.5, puntos: [[64, 8], [80, -30], [70, -84], [34, -116], [-6, -124], [-30, -122]] },
  { ancho: 1.5, puntos: [[-44, 62], [-52, 30], [-48, -20], [-40, -76], [-32, -118]] },
];

// Las cinco cintas. Cada una está en un lugar que el sendero ya propone
// visitar: se encuentran explorando, no barriendo el mapa en cuadrícula.
export const CINTAS = [
  { x: 14.5, z: 104, lugar: "tronco" },
  { x: 66.8, z: 9.5, lugar: "cabana" },
  { x: 56.2, z: 23.2, lugar: "fogata" },
  { x: -108.5, z: 49.5, lugar: "mirador" },
  { x: -30.5, z: -127, lugar: "abedules" },
];

export const CAMINANTE = {
  ALTO: 1.75,
  VEL_CAMINA: 1.45,   // m/s. La animación camina a 1,05 m/s: se acelera 1,4x
  VEL_CORRE: 4.1,     // la de correr, a ~3,7 m/s
  // la animación de caminar hace un ciclo (dos pasos) en 1,411 s y la de
  // correr en 0,767 s: medido en los canales del muslo, no supuesto. El clip
  // de caminar dura 4,233 s y son tres ciclos justos.
  CICLO_CAMINA: 1.411,
  CICLO_CORRE: 0.767,
  ZANCADA_CAMINA: 1.49, // metros por ciclo que la animación "pisa"
  ZANCADA_CORRE: 2.84,
  UMBRAL_CORRE: 0.78, // cuánto hay que empujar el joystick para correr
  GIRO: 9,            // rad/s con los que encara hacia donde va
  ACEL: 7,
  RADIO: 0.32,        // el cuerpo, para chocar con troncos y rocas
  AGUA_MAX: 0.85,     // más hondo que esto no se puede entrar al lago
};

export const CAMARA = {
  DIST: 3.7,
  DIST_MIN: 1.1,
  ALTO_MIRA: 1.52,    // a qué altura del caminante apunta
  HOMBRO: 0.42,       // corrida a la derecha: el caminante no tapa el centro
  PITCH_MIN: -0.42,
  PITCH_MAX: 1.05,
  FOV_H: 78,          // grados horizontales, iguales en vertical y en apaisado
  SENS: 0.0062,       // radianes por pixel de arrastre
};

// Calidad. Se elige al arrancar mirando el aparato y después se ajusta sola
// midiendo cuánto tarda cada cuadro.
export const CALIDADES = {
  // arbolesCerca no pasa de 34 m: es el borde de la caja de sombra. Un árbol
  // con todo el detalle más allá de ese radio se dibuja dos veces (una para
  // la sombra) y su sombra cae afuera del mapa: se paga y no se ve.
  alta: { escala: 1.0, sombra: 2048, arbolesCerca: 34, arbolesMedio: 125, flora: 52, densidadFlora: 1.0 },
  media: { escala: 0.8, sombra: 1536, arbolesCerca: 28, arbolesMedio: 105, flora: 42, densidadFlora: 0.75 },
  baja: { escala: 0.7, sombra: 1024, arbolesCerca: 22, arbolesMedio: 85, flora: 32, densidadFlora: 0.5 },
};
