# AEROPLAZA — vigesimoprimera vuelta (27/09/2026): la mano que no se duplica, los manotazos y la tanda corta

Sigue de [aeroplaza-21](aeroplaza-21.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Hacé que no dure tanto" (la tanda de pruebas: ~21 min).
- "Arreglá que siga movimientos rápidos y fijos, y que no se duplique".

## La mano doble

- **No es el dibujo**: en el VR el cuerpo de la primera persona se esconde
  (`main.js`), las manos se dibujan en cada cuadro y no tienen estela.
- **El fantasma de MediaPipe** (simulado en `manos-celu`, `fantasma`): buscando
  dos manos, trae también la que ya ve, de una foto atrasada (60-160 ms), con
  otra profundidad y a veces con la etiqueta de la otra. Antes: dos manos en el
  37-39 % de los cuadros; con una red, 14 %.
- **Tres formas de colarse** (medidas con el simulador):
  - dos detecciones de la misma mano en la misma foto, las dos nuevas;
  - el fantasma queda más cerca de donde estaba la mano y se lleva su lugar; la
    foto buena aparece como otra mano;
  - al arrancar de golpe, el fantasma (donde estaba) y la buena (8 cm al lado)
    son idénticos a una mano quieta y otra que entra: con una foto sola no se
    puede saber.
- **Lo que quedó** (`manos.js › recibirCamara`):
  - una nueva que cae de costado (visto desde la cámara) a menos de 5 cm
    (`FANTASMA`) de otra de la misma foto, o del camino que hizo otra en los
    últimos 0,35 s (`Mano.rastro`, por tramos), no es mano nueva;
  - con otra a la vista, la nueva queda **a prueba** (`Manos.prueba`, no se
    dibuja): si en otra foto viene ella y no la que se ve, o lo que viene para
    la que se ve cae sobre el camino que acaba de hacer la de a prueba, era la
    misma y la sigue la que se ve; si viene cada una por su lado en una foto
    más, aparece;
  - mientras hay una a prueba, las redes buscan dos (`manos-camara.js ›
    quiereDos`): si no, con una sola buscada no se confirmaba nunca;
  - con la foto de antes reciente (< 0,12 s), cada mano se queda con la
    detección más cerca de donde tenía que estar, no de donde estaba.
- **Medido**: con fantasmas, 0 % de cuadros con dos manos (antes 37-39 %). La
  segunda mano de verdad aparece a los 353 ms (antes 286; la prueba pide menos
  de 900).

## Los manotazos (rápido y firme)

- **Medido** (`manos-lento`, tramos nuevos al final: 1,2 m/s de costado y 0,9
  para arriba y abajo, 0,25 s, que frenan en seco), Medio, la foto a 124 ms:
  - pasa la mitad 166 ms tarde (con la foto sola, sin filtro, serían 124);
  - **se pasa 84-98 mm** y tarda 0,5-0,9 s en quedar a menos de 1,5 cm;
  - después el ancla la dejaba hasta 1,5 cm corrida.
- **Por qué se pasa**: mientras ninguna foto muestra que frenó (lo que tarda la
  foto), el adelanto sigue. Con 124 ms de atraso no hay adelanto que sepa que
  va a frenar: la única palanca es cuánto se adelanta a toda velocidad.
- **Lo que quedó** (`js/manos.js`):
  - `ADEL_MAX` 10 → 6,5 cm en Medio y Suaves (Rápidas, 10: `SUAVIDAD ›
    adelMax`);
  - `ASIENTA` 0,93 s: quieta, el ancla de profundidad va de a poco hacia la
    mano filtrada (`Mano.estabilizar`).
- **Medido, 10 semillas, Medio** (antes → ahora), la foto a 124 ms / a 194 ms:
  - se pasa: 93 → 66 mm / 99 → 67;
  - tiembla quieta: 0,50 → 0,32 mm / 0,68 → 0,40;
  - se va de su lugar quieta: 3,4 → 2,2 mm / 4,4 → 2,6;
  - de costado, atrás: 20 → 25 ms / 32 → 44 (lo que se paga);
  - suaves tiembla 0,37 → 0,29.
- `manos-celu` 24/24; quieta con la cámara lenta 5,9 mm (pide < 6).

## Lo que se probó y no sirvió

- **Una búsqueda de 18 constantes con los manotazos** (tres, ~1800 pruebas):
  con la velocidad del filtro que se abre con lo que cambia (`C_BETAD` 41-64),
  el resorte que no conserva la velocidad (`RESORTE_V` 0,3) y anclas más
  chicas, se pasaba 30-45 mm y arrancaba 25 ms antes. Pero con semillas nuevas
  y la cámara lenta temblaba el doble, y en `manos-celu` (con los saltos de
  12 cm) 2,4 mm por cuadro contra 1,0. Quedaron las perillas en neutro.
- **Frenar el adelanto con la última foto** (si dice menos velocidad que el
  filtro): sin zona muerta frenaba por ruido en lo lento (de costado 15 → 61
  ms); con zona muerta no frenaba el manotazo (cuando la foto lo muestra, ya
  paró). Se sacó.
- **Un resorte más corto** (`TAU` 12-20 ms): el manotazo igual; tiembla más.
- **`ASIENTA` también de costado**: un paso de 6 mm tardaba 0,7-3,8 s.
- **Lo que queda flojo**: el paso de 6 mm, a veces (1-2 de 10 semillas),
  queda adentro del ancla y no se ve hasta moverla más (Medio y Suaves).

## La tanda

- **En paralelo casi no gana**: tres a la vez, 19,4 min contra ~21. El dibujo
  por software (SwiftShader) ya usa los 4 núcleos: cada prueba iba 2-2,4 veces
  más lenta.
- **Lo que cuesta es dibujar**: un paso del juego sin dibujar, 1 ms; un cuadro
  dibujado, ~0,7 s; el primero de cada página, ~10 s (compila los shaders).
  Con un perfil de Chromium fijo no se guardan: la segunda vez, 10,5 s.
- **Sin dibujar donde no se mira la imagen** (`comun.mjs › avanzar(…, false)`):
  `voz` 180 → 47 s, `multijugador` 143 → 64, `dedos` 87 → 35, `juegos` 46 → 14.
- **`voz` fallaba con carga** ("Beto escucha a Ana": 0,003): el audio llegaba
  cortado mientras dibujaba. Sin dibujar: 0,45.
- **`multijugador` fallaba con carga** (`reading 'x'`): el primer cuadro
  dibujado tarda segundos y en ese rato el otro jugador no mandaba nada; a los
  5 s (`OLVIDO`) se lo borraba. Ahora dibuja uno al abrir.
- **La tanda entera con las de manos** (`todas.mjs --manos`, 28 pruebas):
  28/28 a la primera en 13,4 min (antes, ~21 min sin las de manos, que
  sumaban ~5).
- `PERFIL=1` en cualquier prueba: al terminar dice cuánto se fue en `avanzar`.

## Trampas

- **`manos-celu` con `fantasma`** gasta números al azar solo cuando busca dos:
  lo demás del simulador no cambia.
- **Buscar constantes con tres semillas y una cámara engaña**: lo que ganaba
  ahí temblaba el doble con las semillas 6-10 o la cámara lenta. Comprobar con
  10 semillas, las dos cámaras (`… 90` y `… 160`) y `manos-celu`.
- **`manos-lento` cambió** (los manotazos al final, el tirón medido hasta
  antes de ellos): los números de antes siguen valiendo; los `golpe…` son
  nuevos.
- **Cómo se rehace la búsqueda** (los guiones eran del scratchpad): una copia
  de `js/manos.js` en `js/` con las constantes cambiadas por expresiones
  regulares (`NOMBRE = valor`, y `media: { … rl: valor` para los niveles),
  pasada a `manos-lento` con `CORTO=1`, cuatro a la vez (~1,5 por segundo).
