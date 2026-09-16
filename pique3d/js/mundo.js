// Las constantes que comparten el juego, el generador y el validador.
//
// Estan todas juntas en un solo archivo a proposito: si el validador usara
// una gravedad distinta a la del juego, diria que un nivel es completable
// cuando no lo es, y el jugador se comeria un nivel imposible sin que nada
// avisara. Un solo numero, un solo lugar.

export const T = 16;              // lado del tile, en pixeles
export const ALTO_TILES = 24;     // alto del nivel
// En 3D la camara no se mide en pixeles. Lo que importa es CUANTOS TILES
// entran de ancho: de ahi sale la distancia de la camara y, con ella, cuanto
// ve el jugador de lo que viene. Es el mismo numero que antes, dicho en la
// unidad que corresponde.
export const TILES_ANCHO = 25;    // lo que entra de ancho, en tiles
export const TILES_ALTO = 13;

// --- tiles ---------------------------------------------------------------
export const V = {
  NADA: 0,
  SOLIDO: 1,        // piso y paredes
  LADRILLO: 2,      // se rompe de un cabezazo
  PREGUNTA: 3,      // suelta moneda o burbuja
  PAUSA: 4,         // frena al jugador Y al reloj hasta que toque
  TIEMPO: 5,        // suma segundos, tope 99
  PINCHE: 6,        // mata al tocarlo
  LAVA: 7,          // mata al tocarlo
  PLATAFORMA: 8,    // solo se pisa desde arriba
  TUBO: 9,          // solido, y de un tile se puede saltar por arriba
  RAMPA_SUBE: 10,   // "/"
  RAMPA_BAJA: 11,   // "\"
  MONEDA: 12,
  RESORTE: 13,
  MASTIL: 14,       // el palo del final
  LARGO: 15,        // bloque de salto largo
  VOLTERETA: 16,    // bloque de salto hacia atras
  USADO: 17,        // pregunta ya golpeada
  META: 18,         // la base del mastil, para saber donde termina
};

// Los que frenan al jugador por los cuatro lados.
export const SOLIDOS = new Set([V.SOLIDO, V.LADRILLO, V.PREGUNTA, V.PAUSA,
                                V.TIEMPO, V.TUBO, V.USADO, V.LARGO, V.VOLTERETA]);
// Los que solo frenan desde arriba.
export const SEMI = new Set([V.PLATAFORMA]);
export const MATAN = new Set([V.PINCHE, V.LAVA]);
export const RAMPAS = new Set([V.RAMPA_SUBE, V.RAMPA_BAJA]);

// --- fisica --------------------------------------------------------------
// Medidas en pixeles por cuadro, a 60 cuadros por segundo.
export const F = {
  VEL: 2.55,            // el jugador NO decide esto: corre solo
  GRAV: 0.50,
  GRAV_SOSTEN: 0.22,    // mientras sube y el dedo sigue apoyado
  SOSTEN_MAX: 14,       // cuadros de sosten; mas que esto no sube mas
  SALTO: -6.2,          // toque corto: ~2,4 tiles. Con sosten: ~4,7 tiles.
  CAIDA_MAX: 9.0,
  DESLIZ_PARED: 1.7,    // cae mas lento pegado a una pared
  SALTO_PARED_X: 2.9,
  SALTO_PARED_Y: -6.0,
  IMPULSO_PARED: 11,    // cuadros en que el rebote le gana a la carrera
  VAULT: -4.6,          // el saltito automatico sobre un obstaculo de 1 tile
  VAULT_SALTO: -7.4,    // si toca justo al vaultear: mas alto y mata al enemigo
  GIRO_CAIDA: 0.16,     // gravedad durante el giro en el aire
  GIRO_CUADROS: 18,
  PISADA_REBOTE: -5.2,
  RESORTE_V: -10.6,
  LARGO_V: -5.6,        // salto largo: bajo
  LARGO_BOOST: 2.2,     // ...y lejos. 9 tiles de hueco con esto; 6 sin el.
  LARGO_CUADROS: 40,
  VOLT_V: -9.4,         // voltereta: la subida mas alta que hay
  ANCHO: 11,
  ALTO: 15,
  COYOTE: 5,            // cuadros de gracia despues de dejar el piso
  BUFFER: 7,            // cuadros de gracia si toco justo antes de caer
};

// --- temas ---------------------------------------------------------------
// Cada tema cambia la paleta, el fondo, que enemigos aparecen y que piezas
// puede usar el generador. El nombre del tema es la unica llave.
// Cada tema es una PALETA COMPLETA de escena 3D: materiales, luz, niebla y
// cielo. En 2D alcanzaba con tres colores planos; en 3D, el color de la luz y
// el de la niebla mandan mas que el del material. Un castillo con luz blanca
// se ve como un llano gris por mucho que las piedras sean marrones.
export const TEMAS = {
  llano: {
    nombre: "Llanura",
    cielo: ["#5aa9e6", "#bfe6fb"], niebla: "#a8d8f0", nieblaDens: 0.011,
    tierra: "#a86038", costado: "#8a4a28", tapa: "#43ac52",
    luz: "#fff4e0", luzInt: 2.5, ambiente: "#7fb8e0", ambInt: 0.85,
    solAlt: 0.55, rugos: 0.9, metal: 0.0,
    deco: "cerros", decoCol: "#3a8a46", oscuro: false,
    enemigos: ["bolo", "caracol", "fauces", "aleta"],
  },
  subte: {
    nombre: "Subterráneo",
    cielo: ["#07121e", "#122b3d"], niebla: "#0e2333", nieblaDens: 0.018,
    tierra: "#3d5a72", costado: "#24384a", tapa: "#5f93b0",
    luz: "#9ecbe8", luzInt: 2.1, ambiente: "#16394f", ambInt: 1.05,
    solAlt: 0.8, rugos: 0.75, metal: 0.06,
    deco: "columnas", decoCol: "#1a3547", oscuro: true,
    enemigos: ["bolo", "caracol", "osario", "coraza"],
  },
  cielo: {
    nombre: "Cielo",
    cielo: ["#63b8ea", "#e6f6ff"], niebla: "#d4eeff", nieblaDens: 0.016,
    tierra: "#eef7ff", costado: "#c2dcec", tapa: "#ffffff",
    luz: "#ffffff", luzInt: 3.0, ambiente: "#bfe2f6", ambInt: 1.05,
    solAlt: 0.45, rugos: 0.55, metal: 0.0,
    deco: "nubes", decoCol: "#ffffff", oscuro: false,
    enemigos: ["aleta", "perno", "vigia", "bolo"],
  },
  castillo: {
    nombre: "Castillo",
    cielo: ["#140a10", "#3d1a1c"], niebla: "#2a1114", nieblaDens: 0.020,
    tierra: "#6a5560", costado: "#3d3038", tapa: "#7e6874",
    luz: "#ff8a4a", luzInt: 2.6, ambiente: "#5a1e22", ambInt: 0.95,
    solAlt: 0.35, rugos: 0.85, metal: 0.1,
    deco: "columnas", decoCol: "#2a1a1e", oscuro: true,
    enemigos: ["osario", "brasa", "rueda", "fauces"],
  },
  fantasma: {
    nombre: "Casa fantasma",
    cielo: ["#0d0a1a", "#251d40"], niebla: "#1a1430", nieblaDens: 0.022,
    tierra: "#463a66", costado: "#2a2145", tapa: "#6b5c96",
    luz: "#b9a8ff", luzInt: 1.9, ambiente: "#2a1f4a", ambInt: 1.10,
    solAlt: 0.7, rugos: 0.7, metal: 0.05,
    deco: "columnas", decoCol: "#1d1733", oscuro: true,
    enemigos: ["vela", "osario", "bolo"],
  },
  desierto: {
    nombre: "Desierto",
    cielo: ["#e2a552", "#fbecc8"], niebla: "#f0d49a", nieblaDens: 0.014,
    tierra: "#d9a05b", costado: "#a8763c", tapa: "#e8c07a",
    luz: "#fff0c8", luzInt: 3.2, ambiente: "#e0b478", ambInt: 0.95,
    solAlt: 0.72, rugos: 0.95, metal: 0.0,
    deco: "cerros", decoCol: "#c08a44", oscuro: false,
    enemigos: ["torrepua", "erizo", "bolo", "fauces"],
  },
  nave: {
    nombre: "Nave",
    cielo: ["#243247", "#7290b4"], niebla: "#51688a", nieblaDens: 0.013,
    tierra: "#8a6a4a", costado: "#5c4630", tapa: "#a07e56",
    luz: "#ffe8c0", luzInt: 2.8, ambiente: "#4a6280", ambInt: 0.95,
    solAlt: 0.5, rugos: 0.8, metal: 0.15,
    deco: "nubes", decoCol: "#d8e4f2", oscuro: false,
    enemigos: ["perno", "mortero", "caracol", "erizo"],
  },
  torre: {
    nombre: "Torre",
    cielo: ["#2e2040", "#6a5080"], niebla: "#43305c", nieblaDens: 0.017,
    tierra: "#7a6a8a", costado: "#4a3a5a", tapa: "#a888c0",
    luz: "#e0c0ff", luzInt: 2.4, ambiente: "#3a2a52", ambInt: 1.05,
    solAlt: 0.6, rugos: 0.75, metal: 0.08,
    deco: "columnas", decoCol: "#2e2040", oscuro: true,
    enemigos: ["aleta", "erizo", "brasa", "osario"],
  },
};

// --- los 24 niveles ------------------------------------------------------
// 6 mundos de 4. El cuarto de cada mundo es siempre un jefe, como en el
// original: el jugador sabe que se viene sin que nadie se lo diga.
export const NIVELES = [
  // mundo 1 — ensenar
  { m: 1, n: 1, tema: "llano",    dif: 0.10, largo: 150, seg: 80, jefe: null, titulo: "Primeros pasos" },
  { m: 1, n: 2, tema: "subte",    dif: 0.16, largo: 155, seg: 80, jefe: null, titulo: "Abajo de todo" },
  { m: 1, n: 3, tema: "cielo",    dif: 0.22, largo: 160, seg: 85, jefe: null, titulo: "Entre las nubes" },
  { m: 1, n: 4, tema: "castillo", dif: 0.28, largo: 140, seg: 90, jefe: "yunque", titulo: "El primer portón" },
  // mundo 2 — huecos y paredes
  { m: 2, n: 1, tema: "llano",    dif: 0.30, largo: 170, seg: 85, jefe: null, titulo: "Campo abierto" },
  { m: 2, n: 2, tema: "fantasma", dif: 0.36, largo: 160, seg: 90, jefe: null, titulo: "No mires atrás" },
  { m: 2, n: 3, tema: "cielo",    dif: 0.40, largo: 175, seg: 90, jefe: null, titulo: "Saltos de altura" },
  { m: 2, n: 4, tema: "nave",     dif: 0.45, largo: 150, seg: 95, jefe: "yunque", titulo: "A bordo" },
  // mundo 3 — velocidad
  { m: 3, n: 1, tema: "desierto", dif: 0.44, largo: 180, seg: 90, jefe: null, titulo: "Arena caliente" },
  { m: 3, n: 2, tema: "cielo",    dif: 0.50, largo: 185, seg: 90, jefe: null, titulo: "Lluvia de balas" },
  { m: 3, n: 3, tema: "llano",    dif: 0.54, largo: 190, seg: 95, jefe: null, titulo: "Caparazones" },
  { m: 3, n: 4, tema: "castillo", dif: 0.58, largo: 160, seg: 100, jefe: "coloso", titulo: "Barras de fuego" },
  // mundo 4 — vertical
  { m: 4, n: 1, tema: "torre",    dif: 0.58, largo: 150, seg: 95, jefe: null, titulo: "Para arriba" },
  { m: 4, n: 2, tema: "llano",    dif: 0.62, largo: 195, seg: 95, jefe: null, titulo: "Cuesta abajo" },
  { m: 4, n: 3, tema: "subte",    dif: 0.66, largo: 190, seg: 100, jefe: null, titulo: "Alto y bajo" },
  { m: 4, n: 4, tema: "nave",     dif: 0.70, largo: 165, seg: 100, jefe: "yunque", titulo: "Los cañones" },
  // mundo 5 — todo junto
  { m: 5, n: 1, tema: "cielo",    dif: 0.70, largo: 200, seg: 100, jefe: null, titulo: "Sin piso" },
  { m: 5, n: 2, tema: "desierto", dif: 0.74, largo: 200, seg: 100, jefe: null, titulo: "Cactus en fila" },
  { m: 5, n: 3, tema: "fantasma", dif: 0.78, largo: 185, seg: 105, jefe: null, titulo: "Bajo llave" },
  { m: 5, n: 4, tema: "castillo", dif: 0.82, largo: 175, seg: 105, jefe: "coloso", titulo: "Anillos de fuego" },
  // mundo 6 — el final
  { m: 6, n: 1, tema: "desierto", dif: 0.84, largo: 210, seg: 105, jefe: null, titulo: "Tierra de púas" },
  { m: 6, n: 2, tema: "fantasma", dif: 0.88, largo: 195, seg: 110, jefe: null, titulo: "El interruptor" },
  { m: 6, n: 3, tema: "nave",     dif: 0.92, largo: 190, seg: 110, jefe: "yunque", titulo: "Por la borda" },
  { m: 6, n: 4, tema: "castillo", dif: 1.00, largo: 200, seg: 120, jefe: "coloso", titulo: "El último puente" },
];

export const idNivel = (m, n) => `${m}-${n}`;
export const buscarNivel = (m, n) => NIVELES.find((x) => x.m === m && x.n === n);
