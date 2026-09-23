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

/* ============================== 2. El Arrecife de Cristal ============================== */
/* todo es agua; se respira en las cúpulas de aire (vidrio) y en la gran sala hundida */
const ARRECIFE = (() => {
  const W = 200, H = 30, P = 24;
  const filas = construir(W, H, (m) => {
    m.rect(0, 0, W - 1, P - 1, '~');
    m.suelo(0, W - 1, P);
    /* la cúpula de la salida */
    m.rect(0, 15, 13, P - 1, ' ');
    m.put(3, P - 1, 'N');
    m.gotas(6, 11, P - 2);
    /* corales entre las cúpulas, y medusas de estática en el fondo */
    m.rect(18, 19, 19, P - 1); m.rect(26, 15, 27, P - 1); m.rect(33, 18, 34, P - 1);
    m.rect(21, P - 1, 23, P - 1, '^'); m.rect(29, P - 1, 31, P - 1, '^');
    m.arco(15, 25, 17, 4); m.arco(27, 38, 13, 3);
    /* la segunda cúpula: la primera sesión */
    m.rect(40, 15, 51, P - 1, ' ');
    m.put(44, P - 1, 'S');
    m.gotas(46, 50, P - 3);
    /* la sala hundida: techo de roca hasta arriba; el piso del medio es estática (hay que ir con la burbuja) */
    m.rect(58, 0, 103, 5);
    m.rect(60, 6, 99, P - 1, ' ');
    m.rect(67, P, 80, P, '^');
    m.gotas(62, 65, P - 2);
    m.arco(67, 80, P - 5, 3);
    /* el hongo y la repisa del primer guiño */
    m.put(88, P - 1, 'b');
    m.rect(85, 17, 91, 17, '=');
    m.put(88, 16, 'G');
    m.gotas(85, 91, 15);
    m.put(95, P - 1, 'S');
    /* el túnel y el pozo de aire: se sube adentro de una burbuja grande */
    m.rect(100, 6, 103, 20);
    m.rect(100, 21, 103, P - 1, ' ');
    m.rect(104, 0, 108, 3); m.rect(104, 4, 108, P - 1, ' ');
    m.rect(109, 8, 118, P - 1); m.rect(109, 0, 118, 3); m.rect(109, 4, 118, 7, ' ');
    m.gotas(111, 117, 6);
    /* el agua de nuevo: el segundo guiño, detrás de coral gris */
    m.rect(122, 16, 123, P - 1); m.rect(137, 12, 138, P - 1);
    m.rect(129, 20, 133, P - 1, '%'); m.rect(130, 21, 132, P - 1, '~'); m.put(131, P - 2, 'G');
    m.arco(124, 136, 14, 4);
    m.rect(141, P - 1, 143, P - 1, '^');
    /* la tercera cúpula */
    m.rect(146, 16, 156, P - 1, ' ');
    m.put(151, P - 1, 'S');
    /* la fosa del tercer guiño, con estática en las paredes */
    m.rect(164, P, 171, H - 2, '~'); m.put(167, H - 2, 'G');
    m.put(164, 26, '^'); m.put(164, 27, '^'); m.put(171, 25, '^'); m.put(171, 26, '^');
    /* la torre de coral con la cúpula del orbe arriba */
    m.rect(176, 12, W - 1, P - 1);
    m.rect(182, 4, W - 1, 11, ' ');
    m.arco(172, 180, 10, 3);
    m.put(192, 11, 'F');
  });
  return {
    id: 'arrecife', mundo: 'arrecife', estilo: 'arrecife', filas, habil: { zumbido: true }, mar: true,
    burbujeros: [{ x: px(106) + 8, y: px(P) - 14, cada: 90, sube: px(P) - 14 - px(5), vel: 1.5, r: 15 }],
    zonas: [
      { id: 'dorado', x0: px(53), x1: px(58) },
      { id: 'pozo', x0: px(100), x1: px(103) },
      { id: 'cima', x0: px(182), x1: px(W) },
    ],
    da: { dorado: { burbuja: true } },
    npcs: [{ id: 'dorado', x: px(56), y: px(21), mira: -1 }],
    burbujas: 44,
  };
})();

/* ============================== 3. Ciudad Vidrio ============================== */
/* torres de vidrio con terrazas; la calle de abajo no mata, y los ascensores te devuelven arriba */
const CIUDAD = (() => {
  const W = 180, H = 34, P = 28;
  const filas = construir(W, H, (m) => {
    m.suelo(0, W - 1, P);
    m.put(3, P - 1, 'N');
    m.gotas(6, 12, P - 2);
    /* la escalerita de vidrio hasta la primera torre (la de Radio Vidrio, donde está Lila) */
    m.rect(15, 25, 17, 25, '='); m.rect(18, 22, 20, 22, '=');
    m.arco(14, 21, 22, 3);
    m.rect(21, 19, 30, P - 1);
    /* el puente de vidrio y la segunda torre, con un planito */
    m.rect(31, 19, 37, 19, '=');
    m.arco(36, 43, 16, 3);
    m.rect(42, 17, 55, P - 1);
    m.put(50, 16, 'S');
    /* el ascensor (entre 56 y 63) y la torre alta, con un hongo y el primer guiño arriba */
    m.rect(64, 8, 75, P - 1);
    m.put(66, 7, 'b');
    m.rect(64, 2, 68, 2, '='); m.put(66, 1, 'G');
    m.put(71, 7, '^');
    m.gotas(57, 59, 6);
    /* la cuarta torre: el techo tiene dos vidrios grises; abajo, un cuarto con el segundo guiño */
    m.rect(78, 12, 88, P - 1);
    m.rect(80, 13, 86, 14, ' '); m.rect(82, 12, 83, 12, '%'); m.put(85, 14, 'G');
    m.gotas(79, 81, 10);
    /* la quinta torre, con la pared gris que se rompe con el zumbido */
    m.rect(92, 16, 104, P - 1);
    m.rect(98, 12, 98, 15, '%');
    m.put(102, 15, 'S');
    m.gotas(93, 97, 14);
    /* el zigzag de tablones hasta la terraza más alta */
    for (const [x, y] of [[105, 25], [109, 22], [105, 19], [109, 16], [105, 13], [109, 10], [105, 7], [109, 4]]) m.rect(x, y, x + 2, y, '=');
    m.arco(105, 111, 9, 2);
    m.rect(112, 4, 130, P - 1);
    m.put(118, 3, '^');
    m.put(126, 3, 'S');
    /* la séptima torre: una ventana gris al costado, con el tercer guiño adentro (se ve desde el ascensor) */
    m.rect(136, 10, 150, P - 1);
    m.rect(136, 20, 136, 22, '%'); m.rect(137, 20, 140, 22, ' '); m.put(139, 22, 'G');
    m.gotas(131, 135, 7);
    /* la torre de la radio, con el orbe arriba */
    m.rect(152, 8, 154, 8, '=');
    m.rect(158, 6, 168, P - 1);
    m.arco(150, 158, 5, 2);
    m.put(163, 5, 'F');
    m.gotas(170, 176, P - 2);
  });
  return {
    id: 'ciudad', mundo: 'ciudad', estilo: 'ciudad', filas, habil: { zumbido: true, burbuja: true },
    plataformas: [
      { x0: px(57), y0: px(26), x1: px(57), y1: px(8), w: 3, periodo: 360 },
      { x0: px(89), y0: px(26), x1: px(89), y1: px(12), w: 3, periodo: 300, fase: 80 },
      { x0: px(132), y0: px(26), x1: px(132), y1: px(10), w: 3, periodo: 320, fase: 40 },
    ],
    planitos: [
      { x0: px(43) + 8, x1: px(48) + 8, y: px(17), vel: 0.55 },
      { x0: px(93) + 8, x1: px(97), y: px(16), vel: 0.6, fase: 40 },
      { x0: px(120), x1: px(129), y: px(4), vel: 0.65 },
    ],
    zonas: [
      { id: 'lila', x0: px(23), x1: px(27) },
      { id: 'lila2', x0: px(99), x1: px(103) },
      { id: 'cima', x0: px(158), x1: px(169) },
    ],
    npcs: [{ id: 'lila', x: px(28), y: px(19), mira: -1 }],
  };
})();

/* ============================== 4. El Cielo Burbuja ============================== */
/* nubes sobre el vacío (caerse desconecta), columnas de viento que suben y burbujas grandes */
const CIELO = (() => {
  const W = 210, H = 36;
  const filas = construir(W, H, (m) => {
    /* la nube de la salida, con Sol */
    m.rect(0, 22, 16, 25);
    m.put(3, 21, 'N');
    m.gotas(5, 14, 20);
    /* la primera columna de viento (llega hasta abajo: si te caés ahí, te sube) */
    m.rect(20, 8, 21, H - 1, 'w');
    m.gotas(20, 21, 11); m.gotas(20, 21, 15);
    m.rect(25, 14, 34, 16);
    /* el hueco grande: con la burbuja, o con la segunda columna; arriba de ella, el primer guiño */
    m.rect(42, 3, 43, H - 1, 'w');
    m.rect(38, 6, 41, 6, '='); m.put(39, 5, 'G');
    m.arco(35, 46, 12, 3);
    m.rect(47, 16, 58, 19);
    m.put(52, 15, 'S');
    /* abajo, la nube con el burbujero; la burbuja grande sube hasta la nube alta */
    m.rect(62, 27, 70, 29);
    m.gotas(63, 66, 25);
    m.rect(70, 10, 86, 12);
    m.put(79, 9, '^');
    m.put(84, 9, 'S');
    m.arco(66, 73, 8, 2);
    /* la nube que va y viene sobre el hueco; abajo, una nubecita con el segundo guiño y una columna para volver */
    m.rect(99, 22, 102, 23); m.put(100, 21, 'G');
    m.rect(104, 11, 104, H - 1, 'w');
    m.gotas(90, 110, 7);
    m.rect(114, 10, 126, 12);
    m.put(122, 9, 'S');
    /* la subida final: columna, nube, el hueco de la burbuja y la cima del arcoíris */
    m.rect(130, 2, 131, H - 1, 'w');
    m.rect(134, 4, 142, 5);
    m.rect(147, 13, 149, 13); m.put(148, 12, 'G');
    m.rect(152, 5, 152, H - 1, 'w');
    m.rect(156, 6, 168, 8);
    m.arco(143, 155, 1, 2);
    m.rect(172, 3, W - 1, 6);
    m.put(200, 2, 'F');
    m.gotas(174, 196, 1);
  });
  return {
    id: 'cielo', mundo: 'cielo', estilo: 'cielo', filas, habil: { zumbido: true, burbuja: true },
    burbujeros: [{ x: px(67) + 8, y: px(27) - 14, cada: 90, sube: px(27) - 14 - px(9), vel: 1.5, r: 15 }],
    plataformas: [{ x0: px(88), y0: px(10), x1: px(110), y1: px(10), w: 3, periodo: 420 }],
    planitos: [
      { x0: px(48) + 8, x1: px(56), y: px(16), vel: 0.55 },
      { x0: px(115) + 8, x1: px(120), y: px(10), vel: 0.6 },
    ],
    zonas: [
      { id: 'sol', x0: px(8), x1: px(12) },
      { id: 'burbujota', x0: px(62), x1: px(65), y0: px(24), y1: px(28) },
      { id: 'sol2', x0: px(80), x1: px(84) },
      { id: 'cima', x0: px(172), x1: px(W) },
    ],
    npcs: [{ id: 'sol', x: px(11), y: px(22), mira: -1 }],
    burbujas: 50,
  };
})();

/* ============================== 5. La Noche Aurora ============================== */
/* lomas de noche y precipicios; los puentes son de Aurora: se pisan mientras les pasa la luz */
const AURORA = (() => {
  const W = 190, H = 28, P = 22;
  const filas = construir(W, H, (m) => {
    m.suelo(0, 18, P);
    m.put(3, P - 1, 'N');
    m.gotas(5, 10, P - 2);
    /* el primer puente de luz, a ras de las lomas; abajo hay un pasillo (si te caés, se vuelve a subir) */
    m.rect(19, P, 34, P, 'a');
    m.suelo(19, 34, P + 3);
    m.gotas(20, 33, P - 2);
    m.suelo(35, 50, P);
    m.put(42, P - 1, 'S');
    /* la escalera de luz sobre el precipicio, y arriba a la izquierda, la isla del primer guiño */
    m.rect(51, 20, 56, 20, 'a'); m.rect(58, 17, 63, 17, 'a'); m.rect(65, 14, 70, 14, 'a');
    m.rect(75, 10, 78, 10, 'a'); m.rect(79, 6, 82, 7); m.put(80, 5, 'G');
    m.arco(51, 70, 13, 3);
    m.suelo(72, 86, 13);
    m.put(84, 12, 'S');
    /* el puente largo, con una lomita para descansar en el medio; abajo, la isla del segundo guiño */
    m.rect(87, 13, 100, 13, 'a'); m.suelo(101, 104, 13); m.rect(105, 13, 118, 13, 'a');
    m.rect(95, 19, 97, 20); m.put(96, 18, 'G'); m.rect(98, 16, 100, 16, 'a');
    m.gotas(88, 99, 11); m.gotas(106, 117, 11);
    m.suelo(119, 140, 15);
    m.put(130, 14, 'S');
    /* la subida hasta la puerta de la Aurora; bien arriba, la isla del tercer guiño */
    m.rect(141, 13, 145, 13, 'a'); m.rect(147, 10, 151, 10, 'a');
    m.suelo(153, W - 1, 8);
    m.rect(160, 5, 163, 5, 'a'); m.rect(165, 2, 168, 3); m.put(166, 1, 'G');
    m.arco(141, 152, 8, 3);
    m.put(180, 7, 'F');
  });
  return {
    id: 'aurora', mundo: 'aurora', estilo: 'aurora', filas, habil: { zumbido: true, burbuja: true },
    aurora: { periodo: 192, on: 144, paso: 8 },
    planitos: [
      { x0: px(38) + 8, x1: px(48), y: px(P), vel: 0.55 },
      { x0: px(74) + 8, x1: px(83), y: px(13), vel: 0.6 },
      { x0: px(122), x1: px(128), y: px(15), vel: 0.6, fase: 50 },
    ],
    zonas: [
      { id: 'vio', x0: px(9), x1: px(13) },
      { id: 'aurora', x0: px(15), x1: px(18) },
      { id: 'vio2', x0: px(126), x1: px(130) },
      { id: 'cima', x0: px(170), x1: px(W) },
    ],
    npcs: [{ id: 'vio', x: px(12), y: px(P), mira: -1 }],
    burbujas: 20,
  };
})();

/* ============================== 6. El Plano ============================== */
/* gris y chato: paredes que se rompen con el zumbido, el vacío, y al final el PLANO con Mora.
   Cada sesión le devuelve al mundo una capa de color (y de música) */
const PLANO = (() => {
  const W = 200, H = 26, P = 20;
  const filas = construir(W, H, (m) => {
    m.suelo(0, 30, P);
    m.put(3, P - 1, 'N');
    m.gotas(5, 10, P - 2);
    m.rect(12, P - 4, 13, P - 1, '%');
    /* un pozo con un tablón en el medio */
    m.rect(32, P - 3, 34, P - 3, '=');
    m.arco(30, 37, P - 5, 2);
    m.suelo(37, 55, P);
    m.put(42, P - 1, 'S');
    /* un pocito tapado con bloques grises, con el primer guiño abajo */
    m.rect(49, P, 51, P + 1, ' '); m.rect(49, P, 51, P, '%'); m.put(50, P + 1, 'G');
    /* el vacío con una plataforma que va y viene; abajo, el segundo guiño y un hongo para volver */
    m.rect(62, 23, 68, H - 1); m.put(65, 22, 'G'); m.put(67, 22, 'b');
    m.gotas(58, 72, P - 3);
    m.suelo(76, 95, P);
    m.rect(82, 12, 83, P - 1, '%');
    m.put(90, P - 1, 'S');
    /* la torre: zigzag de tablones hasta arriba; arriba, otra caja gris con el tercer guiño */
    for (const [x, y] of [[97, 17], [101, 14], [97, 11], [101, 8]]) m.rect(x, y, x + 2, y, '=');
    m.suelo(104, 125, 8);
    m.put(118, 7, 'S');
    m.rect(110, 2, 114, 5, '%'); m.rect(111, 3, 113, 4, ' '); m.put(112, 4, 'G');
    /* la bajada hasta donde espera el PLANO */
    m.suelo(126, 135, 11); m.suelo(136, 145, 14); m.suelo(146, W - 1, 17);
    m.put(140, 13, '^');
    m.put(150, 16, 'S');
    m.gotas(152, 172, 15);
    m.put(182, 16, 'F');
  });
  return {
    id: 'plano', mundo: 'plano', estilo: 'plano', filas, habil: { zumbido: true, burbuja: true },
    plataformas: [{ x0: px(57), y0: px(P - 1), x1: px(71), y1: px(P - 1), w: 3, periodo: 300 }],
    planitos: [
      { x0: px(16) + 8, x1: px(27), y: px(P), vel: 0.6 },
      { x0: px(38) + 8, x1: px(46), y: px(P), vel: 0.55, fase: 60 },
      { x0: px(85) + 8, x1: px(94), y: px(P), vel: 0.65 },
      { x0: px(106), x1: px(116), y: px(8), vel: 0.6 },
      { x0: px(155), x1: px(170), y: px(17), vel: 0.7 },
    ],
    zonas: [
      { id: 'mora5', x0: px(126), x1: px(130) },
      { id: 'cima', x0: px(176), x1: px(W) },
    ],
    npcs: [{ id: 'moraPlana', x: px(189), y: px(17), mira: -1 }],
    burbujas: 8,
    sinOrbe: true,
  };
})();

export const NIVELES = { colina: COLINA, arrecife: ARRECIFE, ciudad: CIUDAD, cielo: CIELO, aurora: AURORA, plano: PLANO };
export const ORDEN = ['colina', 'arrecife', 'ciudad', 'cielo', 'aurora', 'plano'];
