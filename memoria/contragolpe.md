# CONTRAGOLPE — el tirador táctico en APK para teléfonos flojos (27/09/2026)

Llegó hecho: un HTML de 18 MB (three r128, Rezona adentro en base64). Lo pidió "en APK y optimizadísimo, que una
batata corra el full gráficos". Carpeta `contragolpe/`; cómo se arma: `contragolpe/README.md § Armar`.

## Lo que es

- **Separado para trabajarlo**: `fuente/pagina.html` + `fuente/js/NN-*.js` + `assets/` (12,5 MB de webp y mp3);
  `herramientas/armar.mjs` lo rearma. El primer rearmado dio el original byte por byte (con `cmp`).
- **La APK es una WebView** (`android/MainActivity.java`), sin librerías nativas: el WebGL de la WebView va a la
  placa igual que un juego nativo; lo caro es lo que se dibuja. Se afina lo de alrededor: la pantalla a 60 Hz (el
  juego da 60 pasos por segundo), el proceso que dibuja con prioridad alta y, si el sistema lo mata, otra WebView;
  el texto al 100 %, sin Navegación segura, y atrás = Escape.
- **La versión de la APK** (`armar.mjs --apk`): 1,3 MB de HTML y los assets como archivos (fetch); las texturas
  de materiales y el cielo en ETC2 (`window.ARCH_ETC2`).

## Medido (SwiftShader a 680×306; el procesador del teléfono flojo = el de acá 6 veces más lento)

- El original: 102 ms por cuadro (escena 60, revelado 22, resplandor 11, arma 11); mandar el dibujo con el
  procesador 6 veces más lento 12,0 ms más 7 de lógica; 191 llamadas; 104 MB de texturas en la placa.
- **Las armas de los bots eran 85 mallas** (pieza por pieza, y otras tantas en la sombra): fundidas por material
  y armadas una vez por tipo (`armaTercera`, `FABRICA3`) → 127 llamadas.
- **Los huesos se subían como textura** (texImage2D, 13 por cuadro: 18 % de mandar el dibujo). Para que vayan en
  uniformes hay que decirlo antes de crear el dibujante: `04-render.js` crea el contexto y le miente a three
  (`MAX_VERTEX_TEXTURE_IMAGE_UNITS` = 0) mientras nace. Cambiar `capabilities.floatVertexTextures` después rompe:
  los programas quedan con textura y los huesos se mandan como uniformes (la mano izquierda desaparecía y las sombras
  salían estiradas).
- **Un material en dos escenas** (el arma del mundo y la de primera persona) hace que three vuelva a elegir su
  programa dos veces por cuadro (otra niebla y otras luces): el arma en primera persona lleva copias (`matVM`).
- **Los muñecos sin índice**: 8.766 vértices cada uno, pasados por la piel dos veces por cuadro; con los vértices
  compartidos (el facetado sale de las derivadas, la normal no se usa) son 1.627. Muñecos y sombra: 23,5 → 15,9 ms.
- **El revelado**: 1/z es lineal en la profundidad del búfer (sin las 18 divisiones); más allá de 140 m la tinta
  vale cero (el cielo se saltea las 12 lecturas) y la trama sólo en lo oscuro: 22 → 19 ms, la misma imagen (55 dB).
- **El cielo después de lo opaco** (z = w, la profundidad lo descarta): en SwiftShader no se nota (6,5 ms igual);
  en las placas de teléfono con descarte temprano sí.
- Con todo: mandar el dibujo 12,0 → 8 ms (6×); el cuadro de SwiftShader 102 → 95 ms. SwiftShader no muestra lo que
  más ayuda a un teléfono (el ancho de banda de las texturas, la memoria).

## ETC2

- etcpak (BSD) compilado a mano: `herramientas/etc2drv.cpp` + `ProcessRGB.cpp`, `Tables.cpp`, `Dither.cpp`
  (el CMake pide 3.29 y bajar Tracy). Espera BGRA; las 56 texturas en 7 s.
- El contenedor `.etc2` es propio (16 bytes y los niveles hasta 1×1); `js/02b-etc2.js` las lee y, si la placa no
  sabe ETC2, las descomprime en JS (el decodificador es el de etcpak portado; comprobado con `pruebas/etc2.mjs`).
- La textura que ya usan los materiales se convierte en comprimida cuando llega (`isCompressedTexture`, `mipmaps`,
  `format`, sin `generateMipmaps`); después de subirla se sueltan los bloques (`onUpdate`).
- Calidad: de 22 dB (grava, pasto) a 40 dB (chapas) por textura; en el cuadro entero, 37-40 dB contra el webp.
- Memoria: 104 → 23 MB en la placa; JS 54 → 25 MB (con `gc()`). Con ETC2 un teléfono de 3 GB no las baja a 512.

## Pérdidas de memoria que tenía el original (8 rondas: 713 geometrías; ahora 181, planas)

- Cada cambio de arma de un bot, el arma en primera persona, la bomba plantada (`FABRICA.c4()`) y el cambio de lado
  (los 10 muñecos nuevos) armaban todo de nuevo y lo viejo quedaba en la placa. Ahora: caché por tipo y los muñecos
  en un pozo por bando y variante (`PERS_LIBRES`; al cambiar de lado se sueltan todos primero).
- `precalentar()` (en la carga) arma todas las armas, compila y sube sus mallas: +0,8 a 1,2 s de carga en
  SwiftShader a cambio de no tener tirones en la partida.

## Mandos a gusto (`js/21b-mandos.js`, en AJUSTES › MANDOS)

- Arrastrar cada botón, − y + del tamaño (0,6 a 1,8), opacidad (100 a 25 %), zurdo (espeja lo que no se movió a mano
  y la zona de la palanca), palanca fija o flotante, vibrar. En `G.mandos`, en fracciones de la pantalla.
- Los botones se ubican con `--tx`, `--ty`, `--s` y `--alfa` (el `.apretado` y la animación `late` los respetan).
- La WebView no tiene `navigator.vibrate`: vibra por `window.ContragolpeNativo.vibrar`.

## Trampas

- **El juego no es del todo determinista** entre corridas (algo asíncrono, como el orden en que decodifican los
  assets): dos corridas del mismo HTML a veces difieren. Para comparar imágenes, `pruebas/comparar.mjs`: menos de
  40 dB es cambio de verdad.
- **`gl.finish()` no espera a SwiftShader**: para medir por pasada se lee un píxel de la pantalla.
- **Por file:// Chromium no deja hacer fetch**: la versión de la APK se prueba servida (`comun.mjs › servirApk`).
- **Las pruebas en Chromium salen en inglés** (el idioma sale de `navigator.language`): se fija `G.idioma`.
- **Falta en un teléfono**: todo se midió con SwiftShader; ETC2 y los 60 Hz no se probaron en una placa real.
