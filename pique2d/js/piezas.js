// La biblioteca de piezas del generador.
//
// No son plantillas dibujadas a mano: son FUNCIONES. Cada una recibe la
// dificultad y el azar del nivel y se arma distinta cada vez. Veinte piezas
// parametrizadas dan mucha mas variedad que doscientas plantillas fijas, y
// ocupan una decima parte.
//
// Cada pieza recibe `p` con la grilla ya posicionada en su tramo y devuelve
// la altura del piso con la que arranca la pieza siguiente. Devolver una
// altura distinta es como se encadenan las subidas y bajadas sin que ninguna
// pieza necesite saber que hay antes o despues.

import { V, ALTO_TILES } from "./mundo.js";

// Escala una cantidad con la dificultad: en 0 devuelve `facil`, en 1 `dificil`.
const esc = (d, facil, dificil) => facil + (dificil - facil) * d;
const ent = (d, facil, dificil) => Math.round(esc(d, facil, dificil));

// Pozo de rebote: la unica forma de que el salto de pared sirva para AVANZAR.
//
// Un muro solo no alcanza. El rebote manda al jugador en direccion contraria a
// la pared, asi que una pared enfrente lo devuelve para atras. Para subir hace
// falta un pozo con las dos paredes: se cae adentro, se rebota de una a la
// otra en zigzag, y se sale por arriba a un piso mas alto.
//
// La primera version ponia la pared izquierda ARRIBA del piso de aproximacion.
// El jugador, que corre solo, chocaba contra un muro de dos tiles, se daba
// vuelta y quedaba yendo y viniendo para siempre. El validador lo cazo en el
// 5-4 y en el 4-1: "sin salida" y "sin tiempo" eran el mismo bug.
function pozoDeRebote(p, alto) {
  const ancho = p.rnd.entero(3, 4);
  const fondo = ALTO_TILES - 1;            // el pozo llega al fondo del mapa
  const w = 3 + ancho + 3;
  p.ancho = w;
  p.suelo(0, 3);                           // aproximacion, al nivel de entrada
  p.suelo(3, 3 + ancho, fondo);            // piso del pozo: caer NO mata
  // Pared derecha, desde arriba de la salida hasta el fondo del pozo.
  for (let y = p.piso - alto; y < fondo; y++) p.set(3 + ancho, y, V.SOLIDO);
  // La pared izquierda no se dibuja: es la cara del piso de aproximacion, que
  // va de p.piso hasta el fondo. Por eso el pozo tiene que ser hondo.
  p.suelo(3 + ancho + 1, w, p.piso - alto);
  for (let i = 1; i < alto; i += 2)
    p.moneda(3 + (i % 4 < 2 ? 1 : ancho - 1), p.piso - i);
  p.marcarColor(3 + Math.floor(ancho / 2), p.piso - alto - 2, "pared");
  return p.piso - alto;
}

export const PIEZAS = [

// --- respirar -----------------------------------------------------------
{
  nombre: "llano", peso: (d) => 10 - d * 4, temas: null, min: 0,
  armar(p) {
    const w = p.rnd.entero(6, 11);
    p.ancho = w;
    p.suelo(0, w);
    if (p.rnd.chance(0.55)) {
      const y = p.piso - p.rnd.entero(2, 4);
      for (let i = 2; i < w - 2; i += 2) p.moneda(i, y);
    }
    if (p.rnd.chance(0.35 + p.dif * 0.4)) p.enemigo(p.bicho(), p.rnd.entero(3, w - 2), p.piso - 1);
    return p.piso;
  },
},

// Descanso corto. El generador lo mete a la fuerza despues de dos piezas
// duras seguidas: sin aire, un nivel dificil se vuelve un nivel injusto.
{
  nombre: "descanso", peso: () => 0, temas: null, min: 0,
  armar(p) {
    const w = p.rnd.entero(4, 6);
    p.ancho = w; p.suelo(0, w);
    for (let i = 1; i < w - 1; i++) if (p.rnd.chance(0.4)) p.moneda(i, p.piso - 2);
    return p.piso;
  },
},

// --- escalones: la escuela del vault ------------------------------------
{
  nombre: "escalon", peso: (d) => 7 - d * 2, temas: null, min: 0,
  armar(p) {
    const w = p.rnd.entero(5, 9), sube = p.rnd.chance(0.5) ? 1 : -1;
    const corte = p.rnd.entero(2, w - 2);
    p.ancho = w;
    const nuevo = Math.max(6, Math.min(ALTO_TILES - 3, p.piso - sube));
    p.suelo(0, corte, p.piso);
    p.suelo(corte, w, nuevo);
    // Un escalon de UN tile se sube solo. Es la primera cosa que el juego
    // ensena sin decir nada: el jugador ve que paso por arriba sin tocar.
    p.moneda(corte, Math.min(p.piso, nuevo) - 2);
    if (p.rnd.chance(0.4 + p.dif * 0.3)) p.enemigo(p.bicho(), corte + 1, nuevo - 1);
    return nuevo;
  },
},

{
  nombre: "escalera", peso: (d) => 5, temas: null, min: 0.1,
  armar(p) {
    const alto = ent(p.dif, 2, 4), w = alto * 4 + 2;
    p.ancho = w;
    let y = p.piso;
    for (let i = 0; i < alto; i++) { p.suelo(i * 2, i * 2 + 2, y); y--; }
    p.suelo(alto * 2, alto * 2 + 2, y);
    for (let i = 0; i < alto; i++) { y++; p.suelo(alto * 2 + 2 + i * 2, alto * 2 + 4 + i * 2, y); }
    p.moneda(alto * 2, y - alto - 2); p.moneda(alto * 2 + 1, y - alto - 2);
    p.marcarColor(alto * 2, y - alto - 4, "alto");
    return p.piso;
  },
},

// --- huecos -------------------------------------------------------------
{
  nombre: "pozo", peso: (d) => 8, temas: null, min: 0,
  armar(p) {
    // Hasta 2 de ancho se cruza SOLO (vault). De 3 para arriba hay que
    // saltar. El generador usa los dos a proposito: los chicos ensenan el
    // ritmo, los grandes lo cobran.
    const hueco = p.rnd.chance(0.3 - p.dif * 0.2) ? p.rnd.entero(1, 2)
                                                  : p.rnd.entero(3, ent(p.dif, 4, 6));
    const w = hueco + p.rnd.entero(5, 8);
    const arranque = p.rnd.entero(2, 3);
    p.ancho = w;
    p.suelo(0, arranque);
    p.suelo(arranque + hueco, w);
    for (let i = 0; i < hueco; i++) p.moneda(arranque + i, p.piso - 3);
    if (p.tema === "castillo" || p.tema === "nave")
      for (let i = 0; i < hueco; i++) p.set(arranque + i, ALTO_TILES - 2, V.LAVA);
    return p.piso;
  },
},

{
  nombre: "pozoIsla", peso: (d) => 3 + d * 4, temas: null, min: 0.25,
  armar(p) {
    const h1 = p.rnd.entero(3, ent(p.dif, 4, 5)), h2 = p.rnd.entero(3, ent(p.dif, 4, 5));
    const isla = p.rnd.entero(2, 3), w = 3 + h1 + isla + h2 + 3;
    p.ancho = w;
    p.suelo(0, 3);
    p.suelo(3 + h1, 3 + h1 + isla, p.piso - p.rnd.entero(0, 2));
    p.suelo(3 + h1 + isla + h2, w);
    p.moneda(3 + h1, p.piso - 4); p.moneda(3 + h1 + 1, p.piso - 4);
    p.marcarColor(3 + h1, p.piso - 6, "aire");
    return p.piso;
  },
},

// --- plataformas --------------------------------------------------------
{
  nombre: "plataformas", peso: (d) => 4 + d * 4, temas: null, min: 0.15,
  armar(p) {
    const n = ent(p.dif, 2, 4), sep = ent(p.dif, 4, 6);
    const w = 3 + n * sep + 4;
    p.ancho = w; p.suelo(0, 3); p.suelo(w - 4, w);
    let y = p.piso - 3;
    for (let i = 0; i < n; i++) {
      const x = 3 + i * sep;
      y = Math.max(5, Math.min(p.piso - 2, y + p.rnd.entero(-2, 2)));
      for (let k = 0; k < 3; k++) p.set(x + k, y, V.PLATAFORMA);
      p.moneda(x + 1, y - 2);
      if (p.rnd.chance(p.dif * 0.5)) p.enemigo(p.bicho(), x + 1, y - 1);
    }
    p.marcarColor(3 + Math.floor(n / 2) * sep + 1, y - 5, "aire");
    return p.piso;
  },
},

// --- paredes: wall jump -------------------------------------------------
{
  nombre: "pared", peso: (d) => 3 + d * 5, temas: null, min: 0.2,
  armar(p) {
    return pozoDeRebote(p, ent(p.dif, 3, 5));
  },
},

{
  nombre: "chimenea", peso: (d) => 2 + d * 5, temas: ["torre", "subte", "castillo"], min: 0.35,
  armar(p) {
    return pozoDeRebote(p, ent(p.dif, 5, 8));
  },
},

// --- bloques ------------------------------------------------------------
{
  nombre: "bloques", peso: (d) => 6, temas: null, min: 0,
  armar(p) {
    const n = p.rnd.entero(3, 6), w = n + 4;
    p.ancho = w; p.suelo(0, w);
    const y = p.piso - p.rnd.entero(4, 5);
    for (let i = 0; i < n; i++) {
      const v = p.rnd.pesado([[V.LADRILLO, 5], [V.PREGUNTA, 3], [V.NADA, 2]]);
      if (v !== V.NADA) p.set(2 + i, y, v);
      else p.moneda(2 + i, y);
    }
    if (p.rnd.chance(0.4)) for (let i = 1; i < n - 1; i++) p.set(2 + i, y - 4, V.LADRILLO);
    p.marcarColor(2 + Math.floor(n / 2), y - 6, "alto");
    return p.piso;
  },
},

{
  nombre: "tiempo", peso: () => 2, temas: null, min: 0,
  armar(p) {
    const w = 6; p.ancho = w; p.suelo(0, w);
    p.set(3, p.piso - 4, V.TIEMPO);
    p.set(2, p.piso - 4, V.LADRILLO); p.set(4, p.piso - 4, V.LADRILLO);
    return p.piso;
  },
},

// --- tubos --------------------------------------------------------------
{
  nombre: "tubos", peso: (d) => 5, temas: ["llano", "subte", "desierto", "cielo"], min: 0,
  armar(p) {
    const n = p.rnd.entero(1, 3);
    let w = 2, xs = [];
    for (let i = 0; i < n; i++) { xs.push(w); w += 2 + p.rnd.entero(2, 5); }
    w += 2; p.ancho = w; p.suelo(0, w);
    for (const x of xs) {
      const alto = p.rnd.entero(1, ent(p.dif, 2, 4));
      // Planta solo en tubos de 2 para arriba: en uno de 1 tile el jugador
      // lo vaultea sin poder verla, y morir por algo que no se ve es basura.
      if (alto >= 2 && p.rnd.chance(0.3 + p.dif * 0.4)) p.planta(x, alto);
      else for (let y = p.piso - alto; y < p.piso; y++) { p.set(x, y, V.TUBO); p.set(x + 1, y, V.TUBO); }
      p.moneda(x, p.piso - alto - 2);
    }
    return p.piso;
  },
},

// --- plantas ------------------------------------------------------------
// Existe para los temas que tienen planta pero no tienen tubos —el castillo—
// y para que en los que si los tienen la planta no dependa de que salga
// sorteada la pieza "tubos". Sin esto el bicho estaba en la lista del tema y
// casi nunca aparecia, o aparecia flotando.
{
  nombre: "plantas", peso: (d) => 3 + d * 2, temas: ["llano", "castillo", "desierto"], min: 0.1,
  armar(p) {
    const n = p.rnd.entero(1, 3);
    let w = 3, xs = [];
    for (let i = 0; i < n; i++) { xs.push(w); w += 2 + p.rnd.entero(3, 6); }
    w += 3; p.ancho = w; p.suelo(0, w);
    for (const x of xs) {
      // Dos tiles como minimo: uno solo se vaultea sin ver la planta.
      p.planta(x, p.rnd.entero(2, ent(p.dif, 3, 4)));
      // Moneda arriba, a la altura de la cabeza abierta: paga saltar POR
      // ENCIMA en vez de esperar a que se esconda.
      p.moneda(x, p.piso - 6); p.moneda(x + 1, p.piso - 6);
    }
    return p.piso;
  },
},

// --- rampas -------------------------------------------------------------
{
  nombre: "rampas", peso: (d) => 3 + d * 3, temas: null, min: 0.15,
  armar(p) {
    const alto = p.rnd.entero(2, ent(p.dif, 3, 5));
    const w = alto * 2 + p.rnd.entero(4, 7);
    p.ancho = w;
    let y = p.piso;
    for (let i = 0; i < alto; i++) { p.set(1 + i, y - 1, V.RAMPA_SUBE); p.suelo(1 + i, 2 + i, y); y--; }
    p.suelo(0, 1); p.suelo(1 + alto, w - alto - 1, y);
    for (let i = 0; i < alto; i++) { p.set(w - alto - 1 + i, y, V.RAMPA_BAJA); p.suelo(w - alto - 1 + i, w - alto + i, y + 1); y++; }
    p.suelo(w - 1, w, y);
    // Bajar por una rampa mata lo que se cruce: los enemigos van abajo a
    // proposito, para que el tobogan sea premio y no castigo.
    for (let i = 0; i < 2 && p.dif > 0.3; i++)
      p.enemigo(p.bicho(), w - 2 - i * 2, y - 1);
    p.moneda(Math.floor(w / 2), y - alto - 2);
    return y;
  },
},

// --- enemigos en fila ---------------------------------------------------
{
  nombre: "fila", peso: (d) => 2 + d * 6, temas: null, min: 0.2,
  armar(p) {
    const n = ent(p.dif, 2, 5), w = n * 3 + 4;
    p.ancho = w; p.suelo(0, w);
    for (let i = 0; i < n; i++) p.enemigo(p.bicho(), 2 + i * 3, p.piso - 1);
    // Encadenar pisadas paga 1, 2, 4, 8... por eso la fila esta pareja: el
    // jugador que la clava se lleva mucho mas que el que la esquiva.
    p.moneda(2 + n * 3, p.piso - 4);
    return p.piso;
  },
},

// --- resortes -----------------------------------------------------------
{
  nombre: "resortes", peso: (d) => 2 + d * 2, temas: null, min: 0.2,
  armar(p) {
    const w = p.rnd.entero(8, 12); p.ancho = w;
    p.suelo(0, 3); p.suelo(w - 3, w, p.piso - p.rnd.entero(0, 3));
    p.set(3, p.piso - 1, V.RESORTE);
    p.suelo(3, 4);
    for (let i = 0; i < 4; i++) p.moneda(4 + i, p.piso - 7 - i);
    p.marcarColor(5, p.piso - 11, "alto");
    for (let i = 4; i < w - 3; i++) if (p.tema === "castillo") p.set(i, ALTO_TILES - 2, V.LAVA);
    return p.piso;
  },
},

// --- bloque de pausa ----------------------------------------------------
{
  nombre: "pausa", peso: (d) => 1 + d * 4, temas: null, min: 0.3,
  armar(p) {
    // Hasta 6. Con 7 el salto desde el bloque de pausa llegaba al borde
    // exacto: el validador lo resolvia una de cada tres veces, que es otra
    // forma de decir que el jugador no lo resuelve nunca.
    const hueco = p.rnd.entero(4, ent(p.dif, 5, 6));
    const w = 3 + hueco + 3;
    p.ancho = w; p.suelo(0, 3); p.suelo(3 + hueco, w);
    // El bloque de pausa frena al jugador Y AL RELOJ. Es el unico lugar del
    // juego donde se puede pensar: se usa para poner enfrente algo que hay
    // que mirar antes de saltar.
    p.set(3, p.piso - 4, V.PAUSA);
    for (let i = 1; i < hueco; i++)
      if (p.rnd.chance(0.5)) p.set(3 + i, ALTO_TILES - 2, V.PINCHE);
    p.moneda(3 + Math.floor(hueco / 2), p.piso - 6);
    return p.piso;
  },
},

// --- pinches ------------------------------------------------------------
{
  nombre: "pinches", peso: (d) => d * 6, temas: ["desierto", "castillo", "subte", "nave"], min: 0.4,
  armar(p) {
    const n = ent(p.dif, 3, 7), w = n + 6;
    p.ancho = w; p.suelo(0, w);
    for (let i = 0; i < n; i++) p.set(3 + i, p.piso - 1, V.PINCHE);
    // Las plataformas van de a DOS tiles y cada tres. De a uno y cada dos era
    // imposible: a 2,55 px por cuadro el jugador pisa un tile durante seis
    // cuadros, y encadenar cuatro saltos asi no lo resuelve nadie.
    const y = p.piso - 4;
    for (let i = 0; i <= n; i += 3) {
      p.set(3 + i, y, V.PLATAFORMA); p.set(4 + i, y, V.PLATAFORMA);
      p.moneda(3 + i, y - 2);
    }
    return p.piso;
  },
},

// --- lava ---------------------------------------------------------------
{
  nombre: "lava", peso: (d) => d * 7, temas: ["castillo", "nave", "torre"], min: 0.35,
  armar(p) {
    const largo = ent(p.dif, 5, 10), w = 3 + largo + 3;
    p.ancho = w; p.suelo(0, 3); p.suelo(3 + largo, w);
    for (let i = 0; i < largo; i++)
      for (let y = p.piso; y < ALTO_TILES; y++) p.set(3 + i, y, V.LAVA);
    const n = Math.ceil(largo / 3);
    for (let i = 0; i < n; i++) {
      const x = 3 + 1 + i * 3, y = p.piso - p.rnd.entero(2, 4);
      p.set(x, y, V.PLATAFORMA); p.set(x + 1, y, V.PLATAFORMA);
      p.moneda(x, y - 2);
    }
    p.marcarColor(3 + Math.floor(largo / 2), p.piso - 7, "aire");
    return p.piso;
  },
},

// --- balas --------------------------------------------------------------
{
  nombre: "balas", peso: (d) => d * 6, temas: ["cielo", "nave", "llano"], min: 0.3,
  armar(p) {
    const w = p.rnd.entero(10, 16); p.ancho = w; p.suelo(0, w);
    const n = ent(p.dif, 1, 3);
    for (let i = 0; i < n; i++) {
      const y = p.piso - p.rnd.entero(2, 6);
      p.enemigo("canion", w - 2, y);
    }
    for (let i = 3; i < w - 3; i += 3) p.moneda(i, p.piso - 3);
    return p.piso;
  },
},

// --- salto largo / voltereta -------------------------------------------
{
  nombre: "saltoLargo", peso: (d) => 1 + d * 3, temas: null, min: 0.3,
  armar(p) {
    const hueco = ent(p.dif, 6, 8), w = 4 + hueco + 3;
    p.ancho = w; p.suelo(0, 4); p.suelo(4 + hueco, w);
    // El bloque de salto largo cambia el arco: bajo y lejos. Sin el, un hueco
    // de 8 tiles no se cruza ni con el salto mas alto.
    p.set(3, p.piso - 1, V.LARGO); p.suelo(3, 4);
    for (let i = 1; i < hueco; i += 2) p.moneda(4 + i, p.piso - 2);
    return p.piso;
  },
},

// --- cosa de casa fantasma ---------------------------------------------
{
  nombre: "fantasmal", peso: (d) => 4 + d * 3, temas: ["fantasma"], min: 0,
  armar(p) {
    const w = p.rnd.entero(9, 14); p.ancho = w; p.suelo(0, w);
    const n = ent(p.dif, 1, 3);
    for (let i = 0; i < n; i++) p.enemigo("vela", p.rnd.entero(2, w - 2), p.piso - p.rnd.entero(2, 6));
    for (let i = 0; i < 3; i++) {
      const x = p.rnd.entero(1, w - 2), y = p.piso - p.rnd.entero(3, 6);
      p.set(x, y, V.PLATAFORMA); p.set(x + 1, y, V.PLATAFORMA);
      p.moneda(x, y - 2);
    }
    p.marcarColor(Math.floor(w / 2), p.piso - 8, "aire");
    return p.piso;
  },
},
];

// --- voltereta ----------------------------------------------------------
PIEZAS.push({
  nombre: "voltereta", peso: (d) => 1 + d * 2, temas: null, min: 0.25,
  armar(p) {
    const w = p.rnd.entero(7, 10); p.ancho = w; p.suelo(0, w);
    p.set(3, p.piso - 1, V.VOLTERETA); p.suelo(3, 4);
    // El premio va donde solo llega la voltereta: mas alto que el salto
    // sostenido, para que el bloque tenga una razon de existir.
    for (let i = 0; i < 3; i++) p.moneda(4 + i, p.piso - 9 - i);
    p.marcarColor(5, p.piso - 12, "alto");
    if (p.rnd.chance(0.5)) p.enemigo(p.bicho(), w - 2, p.piso - 1);
    return p.piso;
  },
});

export const porNombre = (n) => PIEZAS.find((p) => p.nombre === n);
