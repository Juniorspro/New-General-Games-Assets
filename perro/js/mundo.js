// Los numeros del mundo, todos juntos.
//
// ESTAN ACA Y NO REPARTIDOS porque son los que se tocan para que el juego se
// sienta distinto. Un numero escondido adentro de una funcion es un numero que
// nadie vuelve a tocar.

export const M = {
  // --- el campo ---
  LADO: 260,          // cuanto mide el campo de lado a lado, en unidades
  REJILLA: 150,       // cuadros de la malla del terreno por lado
  ALTO_LOMA: 7.4,     // cuanto sube la loma mas alta sobre el nivel medio
  ESCALA_LOMA: 0.017, // que tan anchas son las lomas (mas chico = mas anchas)

  // --- el perro ---
  ALTO_PERRO: 1.35,   // del piso al lomo, en unidades del mundo
  VEL_CAMINA: 3.4,    // unidades por segundo
  VEL_CORRE: 9.2,
  // CUANTO HAY QUE EMPUJAR EL JOYSTICK PARA PASAR DE CAMINAR A CORRER. No es
  // un boton aparte a proposito: el pulgar ya dice cuanto quiere moverse, y un
  // segundo boton para correr es un dedo mas que no hay en un telefono.
  UMBRAL_CORRE: 0.72,
  GIRO: 9.0,          // radianes por segundo con los que el perro encara
  ACEL: 14.0,         // que rapido alcanza la velocidad que le pide el dedo
  FRENO: 18.0,

  // --- la camara ---
  CAM_DIST: 8.2,      // cuanto se queda atras
  CAM_ALTO: 3.6,      // cuanto se queda arriba
  CAM_MIRA: 1.5,      // a que altura del perro apunta
  CAM_SUAVE: 5.2,     // que rapido persigue (mas alto = mas pegada)

  // --- el pasto ---
  // CUANTAS MATAS. El numero se elige en `pasto.js` segun lo que aguante el
  // aparato: una cifra fija que anda en una compu deja un telefono a 12 cuadros
  // por segundo, y una que anda en el telefono deja la compu pelada.
  PASTO_MAX: 46000,
  PASTO_MIN: 9000,
  // HASTA DONDE SE SIEMBRA. El numero sale de una cuenta, no del gusto: las
  // matas se reparten en un disco de este radio, asi que la densidad es
  // cuantas/(pi*radio^2). Con 62 daban una mata por metro cuadrado y el campo
  // se veia de juncos sueltos; con 30, las mismas matas dan dieciseis por
  // metro cuadrado y se ve pasto. Lo que queda mas lejos lo tapa la niebla.
  PASTO_RADIO: 30,
  VIENTO: 0.42,       // fuerza del vaiven, en unidades del mundo
  VIENTO_VEL: 1.5,    // que rapido pasa la racha

  LADRA_ESPERA: 0.42, // segundos entre ladrido y ladrido, para que no se pise
};

// La semilla del campo. Fija a proposito: el campo es SIEMPRE el mismo, asi
// que una loma que quedo linda sigue estando ahi manana.
export const SEMILLA = 20260919;
