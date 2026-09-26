# AEROPLAZA — decimoctava vuelta (27/09/2026): la mano que no se dobla ni se deforma

Sigue de [aeroplaza-18](aeroplaza-18.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Se estira demasiado y se dobla y deforma todo :(".
- "Tomate las horas que sean para optimizar al 1000 % todo".

## Por qué se doblaba

- **La vuelta 18 arreglaba el largo de los huesos, no la dirección.** Cada uno de
  los 21 puntos seguía con su filtro y su adelanto.
- **El adelanto (~0,12 s) multiplica el ruido de la velocidad de cada punto.** Un
  hueso de la punta mide 2 cm: un par de milímetros de más para un lado lo tuerce
  varios grados, y cada foto para otro lado.
- **Medido** (`manos-lento`, `dobla`: los ángulos de los nudillos contra los de
  verdad): 15,9° de promedio (el 5 % peor, 22,9°). Con el doble de ruido, 32°.

## Lo que quedó (`js/manos.js`)

- **`PoseMano`: la mano como un cuerpo** (con la cámara; el visor sigue con
  `Euro`). Cada foto se parte en tres:
  - el centro de la palma, con el `EuroEjes` de siempre (de costado y en
    profundidad);
  - el giro de la palma (un cuaternión), con un One Euro sobre el giro: su
    velocidad `w` sale de una foto a la otra (`P_GIRO`);
  - los dedos, en los ejes de la palma (`EuroDedos`, `P_DEDOS`).
  - Se arma de vuelta: cada punto es el centro más el giro por su lugar en la
    palma. La velocidad es la del centro más `w × r`: el adelanto ya no tuerce
    nada.
- **`restringir`** (en los ejes de la palma):
  - la palma, con su molde;
  - cada hueso de los dedos, con su largo aprendido;
  - los dos huesos de la punta de los cuatro dedos se doblan solo hacia la palma,
    como una bisagra (`BISAGRA`). El ruido los torcía para los costados.
- **El giro medido con el molde** (`ajustarGiro`, Kabsch por el método de
  Müller): con la forma aprendida, el giro que mejor lleva los cinco puntos del
  molde de la palma a lo que se ve. Con cuatro puntos (`ejesPalma`) temblaba más.
  El nudillo del pulgar no entra: se mueve con el pulgar.
- **`EuroDedos`**: lo que abre el filtro de un dedo es la velocidad del dedo
  entero (el promedio de sus tres puntos). El ruido de cada punto se cancela; el
  dedo que se dobla los mueve a todos para el mismo lado.
- **Adelantos con compuerta** (entran de a poco entre dos velocidades):
  - el de los dedos en la palma, entre `v0` y `v1` (m/s, la del dedo entero);
  - el del giro, entre `w0` y `w1` (rad/s).
  - Quietos, esas velocidades son ruido.
- **`aprenderForma`** aprende de lo filtrado (en los ejes de la palma), no de la
  foto. Más lento (1 % después de las 60 primeras), y no cuenta una foto con un
  hueso 1,35 veces más largo, o menos de 0,7.

## Medido

- **`manos-lento`**, con las semillas 6-10 (que la búsqueda no vio), nivel medio,
  la cámara a 90 ms:

  | | vuelta 18 | ahora |
  |---|---|---|
  | se doblan de más (promedio / el 5 % peor) | 15,8° / 22,9° | 2,8° / 4,7° |
  | con el doble de ruido | 31,8° / 46,3° | 5,8° / 9,5° |
  | el hueso que más se estira (5 % peor) | 7,9 % | 4,3 % |
  | con el doble de ruido | 22,9 % | 8,8 % |
  | el dedo que se cierra (a la mitad) | 147 ms | 118 ms |
  | tiembla quieta | 0,58 mm | 0,41 mm |
  | el giro atrás (a 2,5 rad/s) | 13,8° | 14,2° |
  | de costado / en profundidad | 27 / 32 ms | 25 / 31 ms |

  - Lo de los dedos es igual con los tres niveles (van con la misma `PoseMano`).
  - Rápidas: tiembla 0,94 (igual que antes); suaves: 0,31 (antes 0,35).
- **MediaPipe de verdad** (`manos-directo`, la cámara de mentira: la mano es una
  foto que se mueve, su forma no cambia): lo que llega varía 2,2 % en los huesos
  y 1,8° en los nudillos; lo dibujado, 0,5 % y 1,1°.
- **Navegador**: `manos` 19/19, `manos-directo` 10/10 (prueba nueva: la forma),
  `manos-celu` 22/22 (prueba nueva: los nudillos a menos de 8°, dan 3,8°),
  `vr` 19/19, `xr` 10/10, `vr120` 12/12.

## La búsqueda

- **Once constantes** (`P_GIRO`, `P_DEDOS`): 900 al azar y 240 alrededor de la
  mejor, con `manos-lento` (semillas 1-5, el ruido de siempre y el doble).
- **Se comprobaron las mejores con las semillas 6-10**, con el doble de ruido y
  con `GLITCH=0.05` (un dedo corrido en el 5 % de las fotos). La elegida no es
  la del dedo más rápido (108 ms): es la que menos se dobla y menos atrasa el
  giro.
- **Cómo se rehace** (los guiones eran del scratchpad y se pierden): una copia de
  `js/manos.js` en `js/` con la línea `P_GIRO … P_DEDOS` cambiada, pasada a
  `manos-lento` con `CORTO=1`, cuatro a la vez (~50 por minuto en el
  contenedor).

## Lo que se probó y no sirvió

- **Sin adelanto en los dedos**, el dedo que se dobla iba 233-260 ms atrás (la
  vuelta 18, 147). No era el filtro: sin filtro de dedos daba 225. Adelantarlo
  siempre lo dejaba en 143 ms, pero doblado 15°: la compuerta da las dos cosas.
- **Solo afinar el filtro de los dedos** (sin compuerta): nada bajaba de 220 ms.
- **Kabsch con seis puntos** (con el nudillo del pulgar): lo mismo que con cinco
  en la simulación; con MediaPipe ese punto se mueve con el pulgar.
- **Solo el largo de los huesos** (`enderezar`, de la vuelta 18): el dedo tiene
  el largo bien y apunta para cualquier lado.

## Trampas

- **El ruido de los ejes de la palma mueve todos los dedos juntos** en sus
  coordenadas. No cambia los ángulos entre huesos, pero sí los del nudillo, y
  parece un dedo que se mueve de verdad.
- **Lo que más se dobla quieto son las puntas** (huesos de 2 cm): 3-5° contra
  1-2° de los nudillos.
- **`manos-lento` con `GLITCH`** gasta más números al azar: todo lo demás cambia
  un poco (la profundidad da otra cosa). Se compara solo contra corridas con el
  mismo `GLITCH`.
- **El pellizco no se atrasa con el filtro**: sale de los puntos sin filtrar
  (`recibirCamara`). Lo que se atrasaba era el dibujo de los dedos.
