# AEROPLAZA — decimosexta vuelta (27/09/2026): las manos con menos atraso de verdad

Sigue de [aeroplaza-16](aeroplaza-16.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Mejoralo en un 700 %: que sea tan preciso que la mano en el juego replique a
  la perfección los movimientos, sin retraso".
- "Buscá formas, miles, modificaciones".

## Dónde se iba el tiempo (medido en el contenedor: 4 núcleos, CPU, worker)

| lo medido | resultado |
|---|---|
| MediaPipe con `numHands: 2` y una mano a la vista | 74 ms por foto: busca palmas en cada foto (38) más los dedos (36) |
| con `numHands: 1` | 36-38 ms |
| dos manos con `numHands: 2` | 72 ms |
| `setOptions({ numHands })` | 12 ms; la foto siguiente vuelve a buscar palmas (87-95 ms) |
| el tamaño de la imagen (192 a 640 de ancho) | casi nada (36-40 ms): pesa el modelo |
| lo que se le pasa a la red | ImageBitmap, ImageData y canvas lo mismo; `VideoFrame` el doble (70 ms) |
| `createImageBitmap(video)` en el hilo del juego | 7-23 ms, con la página quieta |
| `createImageBitmap(VideoFrame)` en un worker | 0,3 ms |

- El banco de pruebas quedó en el scratchpad (`v17/bench.mjs`): un worker
  corriendo casos con las fotos de `pruebas/manos`.

## Lo que quedó (`js/manos-camara.js`)

- **Cada red busca una mano mientras se ve una sola** (`elegirCupos`, el
  "cupo").
  - La segunda la busca una red cada tanto. Con dos redes: la segunda, cada
    350 ms si la primera alcanza sola a leer todas las fotos (queda buscando
    dos sin cambiar), o cada 700 ms si no (las dos siguen la mano a la par).
    Con una red, cada 1,2 s.
  - Mientras busca, esa red recibe la foto antes (`primero`, en el lector).
  - Recién aparecida una mano, 400 ms más buscando dos.
  - La primera foto después de cambiar el cupo (`primera`) no cuenta para
    medir la red.
- **El lector** (worker aparte): toma las fotos directo de la cámara con
  `MediaStreamTrackProcessor` y se las da a la red libre por un
  `MessageChannel`. Las fotos no pasan por el hilo del juego.
  - En Chromium 141 `MediaStreamTrackProcessor` existe solo en la ventana: se
    transfiere su `readable` al worker.
  - Donde no hay (Safari, Firefox), queda el camino de antes
    (`requestVideoFrameCallback`).
- **El reloj de esas fotos**: `VideoFrame.timestamp` viene en otro reloj, con
  una diferencia fija.
  - Se calibra contra el `captureTime` del video: la misma foto da la misma
    diferencia, al microsegundo.
  - Se buscan pares con ventana de 0,05 ms. Si dos grupos empatan, gana el más
    cerca de la llegada: con ventana ancha se corría una foto (33 ms).
  - Sin `captureTime`, se usa la llegada más rápida.
- **La carrera de la GPU** (`carreraGPU`): con una mano a la vista, una red en
  la GPU sigue la mano al lado de la de CPU.
  - Gana si tarda menos de 3/4, ve la mano igual y el juego no baja más de un
    10 % de cuadros (`fpsJuego`, de `main.js`).
  - Se corta si en 3 fotos va más lenta, o si no da 3 fotos en 5 s. Una placa
    lenta atrasaba la mano a más de un segundo mientras duraba.
  - Lo que sale se guarda una semana en `localStorage` (`aeroplaza.manosGPU`).
  - Acá la placa es por software: pierde siempre.
- **`medirRedes`** compara las redes haciendo el mismo trabajo (cupo : manos).
  Antes comparaba "sin manos" (solo palmas) con "con manos", y apagaba la
  segunda sin razón.
- **`manos.js › recibirCamara(lista, t, llego, cupo)`**:
  - una mano que no vino es falta solo si la red tenía lugar para traerla;
  - la foto que llega tarde sirve para la mano que no tenía nada más nuevo.
- **El cartel de ⏱** suma `📷30` (cuadros de la cámara), `⚡` (el lector), `GPU`
  y `🏁` (carrera).

## La predicción y los niveles (`manos.js › SUAVIDAD`)

- **Cada nivel tiene su adelanto** (`lmax`, `lmaxH`) **y sus anclas** (zona y
  tiempos por eje).
- **Rápidas**: tope 0,2 s de costado y 0,15 s en profundidad (antes 0,109 y
  0,1).
- **Medio y suaves**: de una búsqueda de 450 al azar (semillas 1-5),
  comprobada con las 6-10.
- **El tope del resorte** (`SNAP`) crece 2 m/s por el hueco sin fotos. Con más
  adelanto, tras 190 ms sin ver la mano en una ida y vuelta rápida, el salto era
  de 41 cm y se iba de golpe.

## Medido

- **De punta a punta** (`pruebas/manos-directo.mjs`, MediaPipe de verdad en el
  contenedor), con una mano, de la foto a la mano:
  - antes 98-105 ms, ahora 57-60 ms;
  - 18 → 21 fotos por segundo;
  - la segunda mano aparece a los ~0,6-0,8 s del tramo.
- **En el celu simulado** (`manos-celu`, escala 0,7 del contenedor):
  - una red: 15 → 25 fotos/s, 147 → 127 ms;
  - la segunda mano que entra se ve a los ~0,3 s.
- **Movimientos lentos** (`herramientas/manos-lento.mjs`), con la cámara a 90
  ms (la vuelta 16 con la red de antes, `RED=vieja`, semillas 1-5; ahora con las
  6-10, que la búsqueda no vio):

  | | de costado | en profundidad | tiembla |
  |---|---|---|---|
  | vuelta 16, medio | 71 ms | 104 ms | 0,74 mm |
  | vuelta 16, rápidas | 63 ms | 55 ms | 1,28 mm |
  | **ahora, rápidas** | 8 ms | −7 ms | 1,3 mm |
  | **ahora, medio** | 27 ms | 32 ms | 0,50 mm |
  | **ahora, suaves** | 32 ms | 41 ms | 0,25 mm |

- **Con la cámara a 150 ms**, medio: 107 y 89 ms, tiembla 0,82 (antes 163, 203
  y 0,79).
- **Lo que empeoró**: al frenar de golpe se pasa más, 36-47 mm (antes 32).
- **Navegador**: `manos` 19/19, `manos-directo` 9/9, `vr` 19/19, `xr` 10/10,
  `vr120` 12/12; `manos-celu` 20/20 con los tres niveles. La tanda entera da
  bien.

## Lo que se probó y no sirvió

- **El modelo liviano de los dedos** (`hand_landmark_lite`, con la metadata
  trasplantada del completo: `v17/tfl.py`):
  - tarda 20 ms contra 38;
  - pero el pellizco de la foto da 0,38 (y 0,47 con la palma liviana), cuando el
    umbral es 0,30 y el completo da 0,25;
  - y en esa foto dice la mano al revés.
- **La palma liviana**: 31 contra 39 ms. No vale el riesgo.
- **Pasarle `VideoFrame` a MediaPipe**: el doble de lento.
- **La segunda red siempre buscando dos, sin prioridad**: con la primera rápida
  no le llegaba ninguna foto, y la segunda mano tardaba hasta 3 s. Con la primera
  lenta, se llevaba la mitad de las fotos y la mano principal iba a 15/s.

## Trampas

- **`pkill -f bench.mjs`** mata también el shell que lo corre (la línea de
  comando lo contiene).
- **La cámara de mentira con manos**: `navegador({ video })` y `videoManos()` en
  `comun.mjs`. Es un MJPEG hecho con ffmpeg en `pruebas/salida`: 0-4 s una mano,
  4-8 s dos, 8-11 s el pellizco, 11-13 s ninguna.
- **La latencia del cartel** (promedio) sube con una foto lenta suelta, como la de
  la GPU en la carrera. La mano no se atrasa: toma la foto más nueva.
- **`caso()` de `manos-celu` compara promedios de 3 semillas**: para afinar hace
  falta `manos-lento` con 5 y validar con otras 5.
