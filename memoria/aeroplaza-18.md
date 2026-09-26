# AEROPLAZA — decimoséptima vuelta (27/09/2026): la mano que no se estira y el giro

Sigue de [aeroplaza-17](aeroplaza-17.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Va bien y no: es lindo que vaya así de fluido, pero no sigue a la mano del
  todo bien".
- "Se estira demasiado: la mano se deforma en vez de tener siempre la misma
  proporción".

## Por qué se estiraba

- **Cada uno de los 21 puntos se filtraba y se adelantaba por su cuenta**
  (`EuroEjes`, `adelantar`, el resorte).
- **Al girar o ir rápido**, la punta de un dedo va más rápido que la muñeca:
  - se abre más el filtro (atrasa menos);
  - y se adelanta más, por la tangente (el dedo se alarga).
- **Medido** (`manos-celu`, el 5 % peor de los cuadros): algún hueso un **58 %**
  fuera de su largo. En `manos-lento`, 44-53 %, y girando hasta 65 %.

## Lo que quedó (`js/manos.js`)

- **`aprenderForma(P)`** (en `recibir`, con la cámara) aprende de las fotos sin
  filtrar el largo de cada hueso de los dedos (`TRAMOS_DEDO`) y la palma en sus
  propios ejes (`PALMA6`, `ejesPalma`).
  - La forma que da MediaPipe no depende de lo lejos que esté la mano.
  - Toma el promedio de las primeras 20 fotos y después va lento (3 %).
  - No cuenta una foto con un hueso 1,6 veces más largo, o menos de 0,6.
- **`enderezar()`**, al final de cada cuadro (con la cámara, después de las
  anclas):
  - la palma va con su molde, en el centro y con los ejes de lo que se ve;
  - cada dedo se arma hueso por hueso: la dirección de lo que se ve y su largo
    de siempre.
- **Con eso, el peor hueso queda en un 5,3 % (antes 58 %)** y el promedio en
  1,1 % (antes 7-10 %). Lo que queda es el ruido del promedio.
- **El adelanto de las anclas** (`pesoAd`) ahora apaga solo el del centro de la
  palma, no el de todos los puntos.
  - Girando en el lugar, o moviendo los dedos, el centro no se mueve: las anclas
    creían que la mano estaba quieta y apagaban todo el adelanto.
  - El giro iba 21-23° atrás en medio y suaves; ahora 13,5°, como rápidas.
  - Cuesta un poco de temblor: medio de 0,47 a 0,55 mm.
- **Rápidas**: el adelanto del centro entra de a poco entre 3 y 10 cm/s (`v0`,
  `v1`).
  - Quieta pasea 6,6 mm (antes 9,1) y tiembla 1,07 (antes 1,45).
  - De costado atrasa 16 ms (antes 7).

## La herramienta (`herramientas/manos-lento.mjs`)

- **`estira`, `forma`, `estiraGira`**: lo que se salen los huesos de su largo
  (%).
- **`giro`**: los grados que la palma dibujada va atrás, con la mano girando a
  2,5 rad/s.
- **`fino`, `paso`**: movimientos chiquitos (1 cm despacio y un paso de 6 mm).
  Miden cuánto del movimiento se ve 0,3 s después (%) y cuándo llega a la
  mitad (ms).
  - Medio: el paso de 6 mm llega a la mitad a los ~360 ms; rápidas, a los 140
    ms.
  - Esa es la parte de "no la sigue del todo bien" que es de las anclas: para no
    temblar, un movimiento chico tarda.

## Lo que se probó y no sirvió

- **Frenar el adelanto cuando las últimas fotos van más despacio** que el filtro
  (para no pasarse al frenar): baja lo que se pasa (35 → 26-29 mm), pero la
  velocidad de las últimas fotos tiene tanto ruido que atrasa todo el resto
  (rápidas, 8 → 40 ms).
- **Que el ancla se corra despacio hasta la mano** (para no quedar corrida):
  tiembla menos, pero atrasa lo lento y los pasos chicos.
- **Otra búsqueda de medio y suaves** con los movimientos chicos y el giro en la
  cuenta (450 cada uno): no le gana a lo que había.

## Trampas

- **Un paso "de 6 mm" con rampas de 80 ms en 0,1 s es de 1,6 mm**: menos que el
  ruido. Con las rampas, lo que se mueve es v × (d − 0,08).
- **Capturas de las manos en el juego** (con la cámara de mentira): el juego a
  todo dibujo por software le deja a MediaPipe ~1 foto/s. Con la ventana chica
  (480 × 270) se llega a 2/s: sirve para ver la forma, no la fluidez.
