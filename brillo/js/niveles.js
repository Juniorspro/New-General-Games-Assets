/* ============================================================================
   brillo/js/niveles.js — los mundos, dibujados con un constructor.
   Cada nivel se arma con órdenes (piso de tal a tal, un bloque acá, agua
   allá) sobre una grilla de letras; la física lee las letras:
     #  piso            =  tablón de vidrio (se pasa desde abajo)
     %  bloque plano    ~  agua            ^  estática (desconecta)
     b  hongo (rebota)  w  corriente de aire (para arriba)
     o  gotita          G  guiño escondido  S  sesión (se guarda ahí)
     N  donde arranca   F  la salida (el orbe)
   Las coordenadas de las órdenes son en baldosas, con y para abajo (la fila
   0 es la de arriba). Lo que se mueve (plataformas, burbujeros, planitos) y
   las zonas de la historia van aparte, también en baldosas.
   ========================================================================== */
import { T } from './fisica.js';

function construir(W, H, dibujar) {
  const g = Array.from({ length: H }, () => Array(W).fill(' '));
  const M = {
    W, H,
    put(x, y, c = '#') { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; },
    rect(x0, y0, x1, y1, c = '#') { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) M.put(x, y, c); },
    /* piso de x0 a x1 con la cara de arriba en la fila y (hasta abajo de todo) */
    suelo(x0, x1, y, c = '#') { M.rect(x0, y, x1, H - 1, c); },
    hueco(x0, x1, y0 = 0) { M.rect(x0, y0, x1, H - 1, ' '); },
    /* una fila de gotitas, o un arco de gotitas (para marcar un salto) */
    gotas(x0, x1, y) { for (let x = x0; x <= x1; x++) M.put(x, y, 'o'); },
    arco(x0, x1, y, alto) { for (let x = x0; x <= x1; x++) { const t = (x - x0) / Math.max(1, x1 - x0); M.put(x, Math.round(y - Math.sin(t * Math.PI) * alto), 'o'); } },
  };
  dibujar(M);
  return g.map((r) => r.join(''));
}
/* de baldosas a píxeles */
const px = (tx) => tx * T;

/* ============================== 1. La Colina Serena ============================== */
const COLINA = (() => {
  const W = 214, H = 26, P = 21;         // P: la fila de arriba del piso "normal"
  const filas = construir(W, H, (m) => {
    /* la casa de Nick y Mora, y el primer tramo */
    m.suelo(0, 29, P);
    m.put(4, P - 1, 'N');
    m.gotas(12, 20, P - 2);
    m.rect(24, P - 1, 25, P - 1);                   // un escaloncito
    m.arco(24, 29, P - 3, 2);
    /* el estanque: se cae al agua y se sale nadando */
    m.rect(30, P + 1, 36, H - 2, '~'); m.rect(30, H - 1, 36, H - 1);
    m.arco(30, 36, P - 2, 3);
    m.suelo(37, 53, P);
    m.put(43, P - 1, 'S');
    /* Tito y el zumbido; atrás, la pared de bloques planos */
    m.rect(56, P - 5, 57, P - 1, '%');
    m.suelo(54, 59, P);
    m.gotas(58, 61, P - 2);
    /* la loma con un planito */
    m.rect(60, P - 1, 61, P - 1);
    m.suelo(62, 70, P - 3);
    m.gotas(63, 69, P - 5);
    m.suelo(71, 80, P);
    /* el hongo y la isla de vidrio con el primer guiño */
    m.put(75, P - 1, 'b');
    m.rect(71, P - 8, 77, P - 8, '=');             // a la altura justa del rebote
    m.put(74, P - 9, 'G');
    m.gotas(72, 76, P - 10);
    /* la escalera de tablones hasta la meseta alta */
    m.rect(81, P - 3, 83, P - 3, '=');
    m.rect(85, P - 6, 87, P - 6, '=');
    m.rect(89, P - 9, 91, P - 9, '=');
    m.arco(81, 91, P - 5, 5);
    m.suelo(81, 92, P);
    m.suelo(93, 104, P - 9);
    /* el segundo guiño: en un hueco al pie de la meseta, tapado con bloques planos */
    m.rect(93, P - 2, 94, P - 1, ' '); m.rect(93, P - 2, 93, P - 1, '%'); m.put(94, P - 1, 'G');
    m.gotas(95, 103, P - 11);
    /* la bajada en escalones */
    m.suelo(105, 107, P - 6); m.suelo(108, 110, P - 3); m.suelo(111, 118, P);
    m.put(114, P - 1, 'S');
    /* el precipicio con plataformas que se mueven (ver abajo) */
    m.hueco(119, 136, 0);
    m.suelo(137, 146, P - 4);
    m.arco(120, 136, P - 6, 3);
    /* el pedazo gris: bloques planos, dos planitos, y el tercer guiño encerrado arriba */
    m.suelo(147, 170, P - 4);
    /* una bóveda gris a ras del piso, con el guiño adentro: se abre con el zumbido */
    m.rect(151, P - 8, 155, P - 8, '%'); m.rect(151, P - 7, 151, P - 5, '%'); m.rect(155, P - 7, 155, P - 5, '%');
    m.put(153, P - 5, 'G');
    m.rect(158, P - 8, 160, P - 8, '=');
    m.rect(162, P - 7, 163, P - 5, '%');            // otra pared gris
    m.gotas(164, 169, P - 6);
    m.put(166, P - 5, 'S');
    /* la subida final hasta la cima */
    m.suelo(171, 176, P - 7); m.suelo(177, 180, P - 10);
    m.rect(182, P - 12, 184, P - 12, '='); m.rect(186, P - 14, 188, P - 14, '=');
    m.suelo(190, W - 1, P - 14);
    m.arco(177, 190, P - 13, 4);
    m.put(200, P - 15, 'F');
  });
  return {
    id: 'colina', mundo: 'colina', filas,
    plataformas: [
      { x0: px(120), y0: px(P - 2), x1: px(126), y1: px(P - 2), w: 3, periodo: 250 },
      { x0: px(129), y0: px(P - 1), x1: px(129), y1: px(P - 7), w: 3, periodo: 210, fase: 60 },
      { x0: px(133), y0: px(P - 6), x1: px(133), y1: px(P - 6), w: 3, periodo: 100 },
    ],
    planitos: [
      { x0: px(63) + 8, x1: px(69) + 8, y: px(P - 3), vel: 0.55 },
      { x0: px(148) + 8, x1: px(160), y: px(P - 4), vel: 0.6 },
      { x0: px(165), x1: px(170) + 8, y: px(P - 4), vel: 0.7, fase: 90 },
    ],
    zonas: [
      { id: 'estanque', x0: px(27), x1: px(29) },
      { id: 'tito', x0: px(47), x1: px(52) },
      { id: 'planito', x0: px(59), x1: px(61) },
      { id: 'hongo', x0: px(72), x1: px(74) },
      { id: 'cima', x0: px(192), x1: px(214) },
    ],
    /* lo que da la historia al pasar por una zona (la física lo sabe, así la máquina también) */
    da: { tito: { zumbido: true } },
    npcs: [{ id: 'mora', x: px(9), y: px(P), mira: -1 }, { id: 'tito', x: px(50), y: px(P), mira: -1 }],
  };
})();

export const NIVELES = { colina: COLINA };
export const ORDEN = ['colina'];
