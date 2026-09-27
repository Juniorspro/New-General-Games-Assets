# AEROPLAZA — trigesimosegunda vuelta (27/09/2026): tu espacio más como un Quest

Pidió: "que no se amontonen tanto las ventanas de ARCore; que desaparezcan los escaneos; que las manos se vean
menos, así como Meta Quest; todavía no puedo agarrar las ventanas; y al cerrar la mano aparece el menú de fps,
salir del VR y demás, cosa que es molesta: debería fijarse el punto". Antes: [aeroplaza-29](aeroplaza-29.md) (tu
espacio y `ventanas.js`) y [aeroplaza-32](aeroplaza-32.md).

## Por qué no se agarraban y salía el menú

- **Antes el menú de la palma se abría con la palma a la cara y un pellizco de esa mano** (`aLaCara` > 0,62).
- **MediaPipe a veces confunde cuál mano es**, y entonces la normal de la palma sale dada vuelta. Al pellizcar la
  barra de una ventana, con el dorso hacia uno, la mano contaba como "palma a la cara":
  - el pellizco abría el menú y quedaba anulado (no agarraba);
  - esa mano no apuntaba a nada (`M === palma`).
- **Cerrando la mano pasaba lo mismo.**

## Lo que quedó

- **El menú de la palma, a propósito** (`manos.js › MENU_PALMA`). Todo junto, 0,25 s seguidos:
  - la palma bien a la cara (0,72; ya mostrando el botón, 0,55);
  - la mano abierta: las puntas de mayor, anular y meñique a más de 1,55 veces el largo de la palma desde la
    muñeca (en un puño, ~1);
  - la mirada en la palma: el punto del centro a menos de 29° (ya mostrando, 37°);
  - que esa mano no esté apuntando a una ventana (`ctx.apuntar`).

  Recién ahí aparece el botoncito, y el pellizco lo aprieta. El menú queda fijo donde se abrió, como antes.
- **Agarrar** (`ventanas.js`):
  - **Una manija debajo de cada ventana**, como en un Quest (15 × 1,8 cm, 3 cm abajo). Se aclara con la mano
    encima y mientras se la lleva.
  - **Pellizcando ahí mismo con la mano** (la pinza: entre las puntas del pulgar y el índice, a menos de 7 cm del
    vidrio), sobre la manija o la barra, la ventana se agarra y sigue a la mano 1 a 1.
  - **Con el rayo**, la barra acepta 30 px de más alrededor, y la manija también se agarra.
  - Al soltar, se pega a la pared como antes.
- **Las ventanas nuevas no se amontonan** (`Ventanas.lugarLibre`): van en un arco a 85 cm, cada 34° de costado, en
  dos filas (−5 y +33 cm).
  - Primero adelante, después a los costados y arriba.
  - Cada lugar tiene que estar libre de todo lo abierto, contando la pantalla: se mide el ángulo entre los
    centros, visto desde la cabeza, contra lo que abarca cada uno.
- **El escaneo se va** (`espacio.js › uVer`, en los planos y los cubitos): se ve buscando y escaneando, y al
  terminar se desvanece en 0,8 s. "Ver el escaneo", en la pantalla, lo vuelve a mostrar (antes estaba prendido
  de entrada).
- **Las manos fantasma** (`FRAG_MANO › uFantasma`): casi solo el borde que brilla.
  - En tu espacio, del todo (1): la mano de verdad se ve en la cámara.
  - En el juego, un poco (0,35).
  - Se cambia con `manos.ponerFantasma`.

## Medido

- **`espacio.mjs`, 28/28** (con cuatro nuevas):
  - cuatro ventanas y la pantalla, sin taparse (el par más junto, 5,5° de sobra); quedan en 0/−16 (la pantalla),
    ±34/+21 y ±69/−3 (rumbo y altura, en grados);
  - la manija pellizcada con la mano: la ventana sigue a la mano con 0 de error;
  - el escaneo: 0 al terminar, 1 con "Ver el escaneo";
  - las manos, fantasma 1 en tu espacio, y menos al jugar.
- **`manos.mjs`, 20/20**: la palma a la cara 50° al costado de la mirada no muestra el botón; mirándola, sí, y
  el pellizco abre el menú.
- **La tanda de VR y manos**: 11 de 11.

## Trampas

- **El botón de la palma tarda 0,25 s**: en las pruebas, 12 cuadros de palma (a 30 ms) antes de mirar el botón.
- **La pinza va en los punteros** (`pinza`, en `espacio.js` y en `main.js › ventanasMundo`). Sin ella, solo el
  rayo agarra.
