// Las constantes que comparten el juego, el generador y el validador.
//
// Estan todas juntas en un solo archivo a proposito: si el validador usara
// una gravedad distinta a la del juego, diria que un nivel es completable
// cuando no lo es, y el jugador se comeria un nivel imposible sin que nada
// avisara. Un solo numero, un solo lugar.

export const T = 16;              // lado del tile, en pixeles
export const ALTO_TILES = 24;     // alto del nivel
// La camara NO muestra el nivel entero de alto: lo sigue. Sin esto el nivel
// no puede ser mas alto que la pantalla, y sin alto no hay pozos para rebotar
// ni torres para subir.
// La vista NO es fija: el alto manda y el ancho sale de la pantalla.
//
// Con un lienzo de tamano fijo, un telefono deja bandas negras arriba y abajo
// —media pantalla desperdiciada— o hay que estirar y se deforma. Fijando el
// ALTO en nueve tiles y sacando el ancho de la proporcion real de la pantalla,
// el lienzo la llena entera, sin bandas y sin deformar: en un telefono
// acostado se ve mas a los costados, en uno parado se ve menos. Nueve tiles de
// alto es la medida del Mario original y la que hace que el personaje se vea
// grande.
export const VISTA = { ancho: 256, alto: 144 };

export function ajustarVista(anchoPantalla, altoPantalla) {
  const prop = Math.max(1.15, Math.min(2.6, anchoPantalla / Math.max(1, altoPantalla)));
  VISTA.alto = 144;
  // Multiplo de 8 para que la grilla de pixeles caiga entera.
  VISTA.ancho = Math.round((VISTA.alto * prop) / 8) * 8;
  return VISTA;
}

// Alto de dibujo de cada bicho, en pixeles del juego (el tile mide 16).
// No es el alto de la caja de colision: la caja sigue siendo 11x15 porque es
// la que valido los 24 niveles. El sprite se dibuja MAS GRANDE que la caja, que
// es lo que hacen todos los plataformeros — la caja se siente justa y el
// personaje se ve grande.
export const ALTOS = {
  heroe: 30, bolo: 20, caracol: 22, aleta: 22, erizo: 20, fauces: 26,
  osario: 24, vela: 22, perno: 16, brasa: 20, moneda: 14, resorte: 14,
  yunque: 44, coloso: 52,
};

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
export const TEMAS = {
  llano: {
    nombre: "Llanura", cielo: ["#5aa9e6", "#9ad5f5"], tierra: "#b06a3b",
    borde: "#7d4525", detalle: "#3fa34d", niebla: "#cfeaff", oscuro: false,
    enemigos: ["bolo", "caracol", "fauces", "aleta"],
  },
  subte: {
    nombre: "Subterráneo", cielo: ["#0d1b2a", "#1b3a4b"], tierra: "#3f5e78",
    borde: "#22384a", detalle: "#6fa8c7", niebla: "#1b3a4b", oscuro: true,
    enemigos: ["bolo", "caracol", "osario", "coraza"],
  },
  cielo: {
    nombre: "Cielo", cielo: ["#7ec8f0", "#d8f0ff"], tierra: "#e8f4ff",
    borde: "#a8cde0", detalle: "#ffffff", niebla: "#eaf7ff", oscuro: false,
    enemigos: ["aleta", "perno", "vigia", "bolo"],
  },
  castillo: {
    nombre: "Castillo", cielo: ["#1a0e14", "#3a1a20"], tierra: "#6b5560",
    borde: "#3d3038", detalle: "#c8505a", niebla: "#3a1a20", oscuro: true,
    enemigos: ["osario", "brasa", "rueda", "fauces"],
  },
  fantasma: {
    nombre: "Casa fantasma", cielo: ["#141026", "#2a2145"], tierra: "#4a3f6b",
    borde: "#2a2145", detalle: "#9b8fc4", niebla: "#2a2145", oscuro: true,
    enemigos: ["vela", "osario", "bolo"],
  },
  desierto: {
    nombre: "Desierto", cielo: ["#e8b76a", "#f6e2b3"], tierra: "#d9a05b",
    borde: "#a8763c", detalle: "#8cc152", niebla: "#f6e2b3", oscuro: false,
    enemigos: ["torrepua", "erizo", "bolo", "fauces"],
  },
  nave: {
    nombre: "Nave", cielo: ["#2b3a55", "#5a6f8f"], tierra: "#8a6a4a",
    borde: "#5c4630", detalle: "#c9a227", niebla: "#5a6f8f", oscuro: false,
    enemigos: ["perno", "mortero", "caracol", "erizo"],
  },
  torre: {
    nombre: "Torre", cielo: ["#3a2a4a", "#6a5080"], tierra: "#7a6a8a",
    borde: "#4a3a5a", detalle: "#d0a0e0", niebla: "#6a5080", oscuro: true,
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
