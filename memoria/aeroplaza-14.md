# AEROPLAZA — decimotercera vuelta (27/09/2026): las manos que titilaban

Sigue de [aeroplaza-13](aeroplaza-13.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Va titilando la mano, quiero que lo optimices en un 700 %". Lo probó por el
  link de githack, en el celu, con la cámara.

## Por qué titilaba

Se encontró con un simulador del celu. En el contenedor no se veía: ahí la foto
llega al instante.

- **La mano se perdía por lo vieja que era la foto** (250 ms desde que se sacó).
  - En un celu la cámara tarda 30-150 ms en dar la foto y la red 40-80 ms en
    leerla: la foto llega con 90-210 ms de atraso.
  - Con eso pasaba el límite casi siempre: a los 210 ms de atraso, 79 % de los
    cuadros sin mano y 750 titileos por minuto.
- **MediaPipe cambia de idea de qué mano es** (una de cada 8 fotos, simulado).
  La lectura se iba a la otra mano y quedaban dos: una congelada 250 ms.
- **Entre foto y foto la mano quedaba quieta** (el adelanto tenía tope de
  70 ms) y saltaba con cada foto: escalones a 15 por segundo.

## Lo que se hizo (`js/manos.js`)

- **Cuándo se pierde**: cuando la red no la ve en 4 fotos seguidas, o en 2 y
  hace más de 250 ms que no llega nada, o 0,6 s sin nada. Se cuenta desde que
  LLEGA la foto, no desde que se sacó.
- **Cuál es cuál**: cada mano se queda con la detección más cerca de donde
  estaba o de donde iba. El tope es 20 cm más 80 cm por segundo desde la última
  foto. También cuenta la que se está apagando.
  - Lo que dice MediaPipe solo decide las que aparecen.
  - Si muchas fotos seguidas dicen lo contrario (votos ≤ −4), se dan vuelta
    (`darVuelta`).
- **Entre fotos**:
  - se sigue moviendo con la velocidad del filtro desde que llegó la foto
    (`HMAX` 50 ms) y después frena (`FRENO` 80 ms);
  - se adelanta un poco por el atraso de la cámara (`LMAX` 40 ms × 0,85).
- **Sin saltos**: la diferencia de cada foto nueva se reparte con un resorte
  crítico (`TAU` 25 ms, la cuenta exacta).
  - El resorte se queda con lo que saltó lo de abajo, en posición y en
    velocidad, y sigue con su propio movimiento. Así no hay salto de
    posición ni de velocidad.
  - Más de 40 cm (`SNAP`) no se reparte: la vieja se apaga de una y la nueva se
    prende.
- **Fundido**: se prende en 80 ms y se apaga en 200 ms (`alfa`, en el alfa de
  cada cápsula). La pasada de profundidad no va con alfa < 0,6.
- **La foto rara**: la que salta más de 8 cm solo EN PROFUNDIDAD se espera una
  vez. De costado no: eso es la mano que se movió rápido.
- **De viaje**: arranca con un salto de más de 8 cm y termina por debajo de
  1,5 cm. Mientras dura, la yema no toca nada (ni el menú ni las burbujas).
- **El rayo apunta desde la mano de verdad** (`puntoBase`, sin el resorte) y
  sale de la dibujada.
- **Histéresis**:
  - el botón de la palma aparece con 0,62 y se va con 0,5;
  - lo que ya se apuntaba tiene un 25 % de ventaja.
- **Borde suave**: el alfa cae en el último píxel del contorno (`fwidth`).
- **Las cápsulas, del derecho**: estaban dadas vuelta desde la vuelta 13. Colores
  nuevos de vidrio:
  - base `(0.34, 0.43, 0.55)`;
  - borde `smoothstep(0.22, 0.88)`;
  - opacidad `0,72 + 0,28·fresnel`.
- **El reloj**: el resorte y el fundido van con la hora del dibujo (`tAnt`), no
  con el `dt` del juego.
- **Filtro**: el corte de la velocidad pasó a 2 Hz (`E_CORTED`).

## La cámara (`js/manos-camara.js`)

- **La hora de la foto** (`horaFoto`): `captureTime` si viene y tiene sentido
  (entre 0 y 600 ms atrás); si no, `presentationTime`; si no, ahora.
- **El video en la página**: 2 px, casi transparente. Suelto, en algunos celus
  deja de dar cuadros.
- **MediaPipe**: presencia y seguimiento en 0,4 (eran 0,5; soltaba la mano al
  moverla rápido).
- **Sin manos a la vista hace 1 s**: la red lee una foto sí y una no (buscar
  palmas es lo más caro).
- **A `alLlegar`** se le pasa también cuándo llegó (`llego`).

## El visor (`main.js`)

- Con el visor las manos usan `performance.now()`. `vr.tVer` es la hora del
  giroscopio: queda vieja si antes se usó el VR del celu, y la mano del visor no
  se perdía nunca.
- Al salir: `manos.limpiar()` (sin fundido).

## Medido (`pruebas/manos-celu.mjs`, 3 semillas)

Una mano, antes → ahora:

| la foto llega con | sin mano | titila/min | dobles | tirón p99 | quieta |
|---|---|---|---|---|---|
| 90 ms | 5,7 → 1,9 % | 53 → 6 | 15,6 → 0 % | 104 → 10 mm | 12,6 → 4,0 mm |
| 150 ms | 12,9 → 2,2 % | 105 → 4 | 2,3 → 0 % | 111 → 11 mm | 11,0 → 3,9 mm |
| 210 ms | 78,7 → 3,0 % | 747 → 4 | 0 → 0 % | — → 12 mm | 11,5 → 3,4 mm |

- **Con dos manos**: 90-630 → 8-13 titileos por minuto; tirón p99 100 → 10 mm;
  máximo 184 → 21 mm.
- **El peor tirón, con una mano**: 128-190 → 19-20 mm.
- **El error contra la mano de verdad** es casi todo el atraso de la cámara.
  - Sin fallas de la red y yendo a 0,4 m/s de promedio: 43 mm con la foto a
    88 ms, 90 mm a 208 ms.
  - Antes daba menos error porque escondía la mano justo cuando iba atrasada.
- **Las pruebas del navegador**:
  - `manos`: 18/18, tres veces seguidas; las manos ocupan 7600 píxeles por ojo;
  - `xr`: 10/10, con la de apagarse y volver.
  - Quieta: 0,25 mm contra 0,87.
  - A 1 m/s: 6,7 mm contra 44.

## Lo que se probó y no sirvió

- **Adelantar todo el atraso** (`LMAX` 0,12): se pasa de largo al dar la vuelta
  (28 cm a 1,5 m/s) y la foto siguiente ya no se reconocía: mano doble.
- **La velocidad por una recta sobre las últimas fotos** (en vez de la del
  filtro): 5 mm menos de atraso, pero tirones de 12 cm con los errores de
  profundidad.
- **Leer apenas se libera la red la foto que ya llegó**: 15 % más lecturas pero
  20 ms más viejas; el error sube.
- **Resorte con Euler** (`v += a·h`): con `TAU` chico se vuelve inestable (tirón
  de 26 cm). Va la cuenta exacta.

## Trampas

- **En el contenedor la foto no tiene atraso**: todo lo de la cámara se prueba
  con `manos-celu`, no con el navegador.
- **La prueba del navegador hace un cuadro cada 33 ms reales con `dt` 1/60**:
  cualquier cosa que integre con `dt` se atrasa ahí. Por eso el resorte usa el
  reloj del dibujo.
- **El deslizamiento pasa la yema por el menú**: apretaba "Salir" sola. De ahí
  lo de "mientras viaja".
- **El resorte no puede arrancar con la velocidad de lo que se veía**:
  - la resta de dos cuadros incluye el salto de la foto y lo hacía explotar;
  - la velocidad mostrada incluye al propio resorte: con una foto por cuadro se
    pasaba de largo cuadro por medio. En el celu no se notaba (hay 4 cuadros
    entre foto y foto) y en la prueba del navegador sí;
  - va: `off −= salto de abajo`, `offV −= salto de velocidad de abajo`.
- **Las cápsulas dadas vuelta** (`a, c, b` en vez de `a, b, c`): se veía el lado
  de adentro. Por eso en la vuelta 13 "eran muy blancas": todo borde. La prueba
  pasaba igual con 800 píxeles (el rayo y el aro); ahora pide 3000.
- **"De viaje" con 3 cm** tragaba los pellizcos de una mano que se mueve rápido
  (cada foto corrige unos centímetros). Por eso ahora es 8 cm para empezar y
  solo frena la yema.
- **El rayo desde la mano dibujada**, al terminar de deslizarse, apuntaba unos
  grados corrido (10 cm de palanca en la prueba), y su filtro (0,9 Hz) tardaba
  en enderezarse.
- **Rearmar con la tanda corriendo**: pasó una vez en esta vuelta. Las pruebas
  de después de ese momento usaron el armado nuevo; se repitieron las de las
  manos.
- **Medir el tirón con la diferencia de posición** mezcla el atraso con el
  salto. Se mide con la aceleración (segunda diferencia) contra la de verdad.

## Lo que falta

- **Probarlo en el celu de verdad** (sigue igual que en la 13).
- **Si hace falta más velocidad de lectura**: MediaPipe en la GPU del worker.
  Es más rápido, pero se pelea con el dibujo a 120; habría que medirlo en el
  celu antes.
