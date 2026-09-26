# AEROPLAZA — decimonovena vuelta (27/09/2026): la mano que se da vuelta y la imagen que manda

Sigue de [aeroplaza-19](aeroplaza-19.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "La mano, cuando me mira la palma, va bien, bueno, no tanto, y tarda en
  seguirme".
- "Al darla vuelta es el error: se deforma todo y no la sigue".
- Mandó un juego suyo, "Recreo" (un solo HTML): "tiene un handtracking
  optimizado y bien hecho, pero le falta rapidez de seguimiento y animaciones".
- "No cambies el diseño de las manos Aero: arreglá el handtracking".

## Lo del Recreo (lo que se leyó, sin copiar)

- Todo en 2D: los puntos de la IMAGEN de MediaPipe, sin armar la mano en 3D.
- One Euro en dos etapas (en cascada), con zona muerta en la velocidad (lo que
  es ruido no abre el filtro) y beta dividido por el tamaño de la mano.
- La predicción se prende con la velocidad (quieta no predice), tope 20 ms.
- MediaPipe en el hilo principal con GPU. Según sus comentarios, las tareas de
  MediaPipe hacen `document.createElement('canvas')` y por eso no las pone en
  un worker; acá andan en el worker (CPU, y GPU con un `OffscreenCanvas`).

## Qué hace MediaPipe con el dorso y de canto (medido)

- Con las fotos de `pruebas/manos` y cinco más de Rezona (una mano derecha de
  palma, a 45°, de canto por los dos lados y de dorso girada). El guion era del
  scratchpad: `ManosCamara.probar` con cada foto, como en `pruebas/manos.mjs`,
  y la proyección de los puntos contra `img`. Dos de las fotos quedaron en
  `pruebas/manos` (`mano-canto`, `mano-dorso-girada`).
- **La forma 3D (`worldLandmarks` más la traslación) no cae sobre la imagen**:
  4-6 mm en promedio y 8-16 mm en las puntas; de canto, 7 mm y hasta 19,5.
- **De canto duda de qué mano es**: confianza 0,61 (de frente, 0,93-0,98). La
  de dorso con pellizco la da como izquierda (0,54).
- **De canto la ve menos girada de lo que está** (la normal de la palma a 52°
  de la cámara cuando está a 90°).
- **Una sola cámara no sabe para qué lado está girada la mano** (lo que está
  cerca podría estar lejos, y al revés): con la mano de canto, la misma foto
  sale de las dos. En el simulador, una sola foto así hacía girar la mano
  dibujada 90° y tardaba 300 ms en volver: eso es "se deforma todo y no la
  sigue".

## Lo que quedó

- **La imagen manda** (`manos-camara.js › puntosMano`): cada punto va por el
  rayo de su lugar en la imagen, a la profundidad que le da la forma 3D. Antes
  era la forma entera corrida hasta caer, en promedio, sobre la imagen.
- **El espejo** (`PoseMano.elegirEspejo`): con cada foto se arma también el
  espejo en profundidad (cada punto por su rayo desde la cámara, del otro lado
  del centro) y queda el que sigue lo que venía: el giro contra el que se
  esperaba con su velocidad, y los dedos contra los filtrados. Al volver a
  encontrar la mano, solo los dedos.
- **Tope a la velocidad del giro**: 20 rad/s (`W_MAX`). La foto mala daba 90.
- **`recibirCamara`** le pasa a la mano de dónde salen los rayos (la cámara,
  6 cm adelante de los ojos).
- **El pellizco en metros** se mide con la forma de MediaPipe tal cual
  (`m.forma`): con los puntos por la imagen, el de la foto daba 0,31 (umbral
  0,30); ahora 0,23.
- **Nivel Medio, más rápido al arrancar** (`SUAVIDAD.media`, búsqueda de 300
  que cuenta el arranque y los movimientos chicos): zonas un poco más chicas y
  `vs`: con el borde empujado y el centro a más de 5,7 cm/s, el ancla de costado
  se suelta sin esperar `te`.

## Medido

- **`manos-lento` con MediaPipe realista** (`MP=1`: la imagen precisa, la forma
  3D aparte y a veces al revés de canto), semillas 6-10, nivel Medio:

  | | vuelta 19 | ahora |
  |---|---|---|
  | dándose vuelta: lo que se corre visto desde los ojos (promedio / 5 % peor) | 16,7 / 47,5 mm | 12,4 / 34,8 mm |
  | dándose vuelta: los dedos (5 % peor) | 14,7° | 6,4° |
  | el giro atrás (a 2,5 rad/s) | 45° | 14° |
  | se doblan de más (promedio / 5 % peor) | 3,6° / 10° | 2,8° / 5,7° |
  | lo que se corre en todo el recorrido | 8,4 mm | 6,4 mm |
  | tiembla quieta | 0,71 mm | 0,49 mm |

- **Con el ruido de antes** (`MP=0`), Rápidas y Suaves dan igual que en la
  vuelta 19, número por número: el espejo no se elige cuando no hace falta.
- **Nivel Medio, con el ruido de antes**:
  - de costado va 25 → 14 ms atrás;
  - arranca 171 → 151 ms;
  - un paso de 6 mm llega a la mitad a los 113 → 55 ms;
  - tiembla más: 0,41 → 0,67 mm (Rápidas, 0,94).
  - En `manos-celu`: medio 1,07 mm, rápidas 1,08, suaves 0,83.
- **Lo que no cambió**: al empezar a girar, la mano arranca ~150 ms tarde (la
  cámara más MediaPipe), y al frenar un giro rápido se pasa ~45° un momento.
- **Navegador**: `manos` 20/20 (prueba nueva: de canto y de dorso, cada punto
  sobre la imagen), `manos-celu` 23/23 (prueba nueva: la mano que se da
  vuelta), `manos-directo` 10/10, `vr` 19/19, `xr` 10/10, `vr120` 12/12. La
  tanda entera da bien (con `interiores` arreglado, abajo).

## Lo que se probó y no sirvió

- **Buscar de nuevo las constantes del giro y los dedos** (400, con la mano
  que se da vuelta en la cuenta): lo que gana, lo gana atrasando los dedos
  (123 → 190 ms). Con los dedos a menos de 135 ms, lo de antes es lo mejor.
- **Un tope al adelanto del giro y zonas muertas** en los filtros de los dedos
  y del giro (lo del Recreo), dentro de esa búsqueda: tampoco ganaron sin
  atrasar los dedos. Se sacaron.
- **No se hizo**: anclar cada punto dibujado a la imagen, con un peso según
  cuánto se aleja la mano rígida. Con los puntos por la imagen y el espejo no
  hizo falta en el simulador, y el atraso que queda es el de la cámara.

## Trampas

- **`manos-lento` con `MP=1`** mide otra cosa que con `MP=0`: no se comparan
  números de uno con el otro.
- **`rezona fetch_generated_asset` pide una carpeta con `.rezona/`**; la
  `public_url` de `check_generation_tasks` se baja con curl sin eso.
- **La etiqueta de mano de MediaPipe no sirve de canto ni de dorso**: la mano se
  sigue por dónde estaba, no por lo que dice MediaPipe.
- **`interiores` (el telescopio) fallaba a la tarde**, también con la versión
  de antes: al abrir, el Estelario elige para dónde mirar con la hora de
  verdad, y la prueba fijaba la hora del cielo pero no la dirección (16-18
  rótulos, pide más de 20). Ahora fija también `az`, `alt` y `fov`: 36.
