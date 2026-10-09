# Craftsman PTGI (Android) → navegador

«Craftsman PTGI» de Tito Crack 6000 (Craftsman, que es Minecraft PE 0.16 rebautizado, con los
shaders que les hizo Tito) jugable en el navegador del teléfono, en un solo `.html` de 2,3 MB.

**Estado:** modo creativo completo para construir: la primera vez se elige jugar con o sin los
shaders de Tito (sobre el menú difuminado; después se cambia en Opciones > Gráficos), menú con el
panorama de la cueva, mundos guardados (crear con nombre, semilla, tipo infinito o plano y "siempre
de día", abrir, borrar), mundo infinito con biomas, cuevas, minerales y árboles, día y noche, agua y
lava que corren, los controles táctiles de MCPE 1.0 (cruceta con agacharse en el medio, saltar
aparte, el anillo que se llena al romper), inventario creativo de cuatro pestañas, el bloque en la
mano, partículas, sonidos del juego y las opciones del juego (Juego, Controles, Gráficos, Sonido).
Siempre acostado: con el teléfono parado se gira 90° solo (también adentro de Rezona). La
supervivencia (vida, hambre, herramientas, fabricar) y los bichos todavía no.

## Cómo es

El juego original es `libminecraftpe.so`, código ARM nativo: no corre en un navegador. Así que el
motor es nuestro ([`juego/`](juego), JavaScript y WebGL) y del APK se usa todo lo demás, sin tocar:

- **Los shaders de Tito** (`assets/shaders/*.vertex|fragment`, los de MCPE con sus agregados: el agua
  con reflejos, el cielo, las nubes, la niebla, la luz). Se compilan como los compila el juego
  ("#version 300 es" o 100, alta precisión, los `defines` de cada material) y reciben lo mismo que en
  el teléfono: la posición de cada trozo relativa a la cámara (`CHUNK_ORIGIN_AND_SCALE`), la vista
  sin traslación, `VIEW_POS`, `TIME`, la niebla (`FOG_COLOR`, `FOG_CONTROL`, `RENDER_DISTANCE`) y el
  mapa de luz de 16×16 que el juego rehace en cada cuadro según la hora (`TEXTURE_1`).
  Como pidió el dueño, **sin la sombra del personaje**: [`empaquetar.py`](empaquetar.py) saca del
  `renderchunk.fragment` las cinco capas que la dibujaban y nada más (y frena si no las encuentra
  tal cual, para no romper el shader si cambia).
- **Las texturas** del paquete `vanilla` (las HD de 128 px de Tito y las de 16), en un atlas con un
  borde repetido en cada una para que los mipmaps no mezclen vecinas; el costado del pasto con su
  máscara teñida como lo arma el juego. En WebP sin pérdida: 1 MB en vez de 3,3 de PNG.
- **Los bloques** (`blocks.json`: forma y texturas por cara) con su número de MCPE. Lo que el juego
  tiene en código y no en datos (qué es opaco, cuánta luz da o frena, de qué capa es, el material de
  cada uno para los sonidos, cómo queda al ponerlo) está en [`juego/comun.js`](juego/comun.js) y
  [`juego/objetos.js`](juego/objetos.js), como lo hace Minecraft.
- **La interfaz**: `gui.png` (barra rápida, cruceta, volar, pausa), los botones de `newgui`, la
  fuente `default8.png`, el panorama del menú y los textos en castellano del juego.
- **Los sonidos**: los FSB5 de FMOD (FADPCM casi todos) decodificados acá
  ([`sonidos.py`](sonidos.py), el algoritmo de vgmstream) y juntados en un solo `.ogg` Opus de 320 KB.

### El motor

- [`trabajador.js`](juego/trabajador.js), en un Web Worker: genera el mundo
  ([`generador.js`](juego/generador.js): ruido simplex con semilla, 18 biomas, ríos, cuevas,
  minerales, ocho tipos de árbol), calcula la luz del cielo y de los bloques y arma las mallas de cada
  sub-trozo de 16³ con el formato de vértices que esperan los shaders de Tito (20 bytes: posición en
  1/256 de bloque, color con oclusión ambiental y sombra de cara, uv del atlas, luz como luz/16).
  También corre el agua y la lava (como `BlockDynamicLiquid`: niveles, caída, el camino más corto a
  un pozo, fuentes infinitas, obsidiana y piedra).
- [`render.js`](juego/render.js): cielo, estrellas, sol y luna, terreno en cuatro capas (opaco,
  recorte, agua, transparente) con los materiales del juego, nubes, el contorno y las grietas, las
  partículas y el bloque en la mano. Los 8 sub-trozos de cada columna van en un solo búfer: una
  llamada de dibujo por capa y columna (~110 por cuadro a distancia 6), recortadas contra la vista.
- [`jugador.js`](juego/jugador.js): la física de Minecraft (20 pasos por segundo, gravedad, roce,
  escalones de 0,6, nadar, escaleras, volar) con la cámara interpolada entre pasos, y el salto
  automático de MCPE en pantallas táctiles.
- [`interfaz.js`](juego/interfaz.js): todo dibujado en un lienzo 2D encima, con los dibujos del
  juego. Sólo se redibuja cuando algo cambia.
- [`principal.js`](juego/principal.js): carga, menús, mundos en IndexedDB (los trozos tocados,
  comprimidos: 2 a 6 KB cada uno), el bucle y los toques.

### Controles (como MCPE 1.0)

Cruceta abajo a la izquierda (doble toque adelante corre) con agacharse en el medio (el botón
redondo: se prende y se apaga); saltar aparte, grande, abajo a la derecha (doble toque: volar;
volando, subir y bajar van ahí). Arrastrar mira. Tocar un bloque pone el elegido (o abre la
puerta); mantener el dedo quieto rompe: aparece el anillo del juego ("progress indicator"), se llena
y rompe, y se vuelve a llenar para el siguiente (uno cada 0,25 s, como el creativo). La barra rápida
elige; "…" abre el inventario. En Opciones > Controles, como en el juego: sensibilidad, invertir el
eje Y, para zurdos, saltar automáticamente, intercambiar salto y agacharse, controles divididos
(se apunta con la mira del centro), tamaño de botón y vibrar al romper. En la computadora: mouse
(clic para bloquear el puntero), WASD, espacio, shift, ctrl, rueda, 1-9, E y Esc.

Lo que en el APK hace Android lo hace [`herramientas/porteo/web.js`](../../herramientas/porteo/web.js),
como en Balatro y PvZ: con el teléfono parado gira el juego 90° (para el lado al que se gire el
teléfono, por el acelerómetro) y traduce los toques; al primer toque pide pantalla completa y trabar
la pantalla acostada; el botón atrás pausa (en los menús vuelve una pantalla; dos seguidos salen) y
la pantalla no se apaga mientras se juega.

### Rendimiento (para que ande en teléfonos de 1,2 GHz)

- **60 cuadros por segundo como máximo** (o 30, en Opciones), como el juego: en las pantallas de 90
  y 120 Hz se dibujaba en cada refresco, el doble de trabajo.
- **El hilo del mundo duerme** cuando no tiene nada que hacer (antes daba vueltas sin parar y tenía
  un núcleo ocupado: calor y menos CPU para el juego); se despierta al moverse o poner un bloque, y
  cada 50 ms sólo si hay agua corriendo.
- **La precisión de los shaders como la pone el juego** (ShaderProgramOGL): `precision mediump float`
  y POS3/POS4/MAT4 en la más alta que tenga el teléfono. Con todo en highp (lo de antes) cada píxel
  se calculaba en 32 bits; en las GPU de teléfono mediump va al doble.
- **Sin shaders**: los materiales del MCPE de fábrica (textura × color × luz, niebla, cielo de dos
  colores, nubes planas de clouds.png). Si un teléfono no compila los de Tito, entra este modo solo.
- Resolución automática: según la velocidad elegida baja los píxeles (hasta 35 %) y si sobra los
  sube; si bajar no mejora (un teléfono que limita a 30 para ahorrar batería), vuelve atrás. En un
  teléfono flojo (pocos núcleos o poca memoria, o una GPU vieja) arranca con menos píxeles,
  distancia 4 y las hojas opacas del juego.
- Las opciones del juego que alivianan: gráficos sofisticados (el FANCY de Tito), hojas llamativas
  (sin ellas, las hojas son opacas: las texturas .opaque del paquete), iluminación suave, cielos
  hermosos, nubes, partículas.
- En los menús el panorama se dibuja con pocos píxeles y el navegador lo estira suavizado: el fondo
  difuminado del juego casi sin costo.
- El mundo se genera, se ilumina y se malla en otro hilo, lo más cercano primero; el agua se
  actualiza cada 0,25 s y sólo rehace las mallas que toca; el sonido se decodifica a 22 kHz.
- Medido con la CPU frenada 6 veces: el JavaScript de cada cuadro tarda ~2 ms.

## Cómo se arma

    porteos/craftsman/portear.sh Craftsman_PTGI.apk SALIDA

Deja `SALIDA/Craftsman-PTGI.html` (un solo archivo de texto ASCII: anda abierto desde el teléfono y
adentro de Rezona, que recibe el aviso `game:ready`) y `SALIDA/sitio` (lo mismo en carpetas). Hace
falta Python 3 con Pillow y numpy, ffmpeg y opusenc. El repositorio no tiene nada del juego: todo
sale del APK al armar.
