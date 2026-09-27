# AEROPLAZA — vigesimoséptima vuelta (27/09/2026): el retraso que ponía el resorte y la APK buscando dos manos

Pidió: "seguí arreglando mi juego y sacando ese maldito retraso cada vez más en las manos". Antes:
[aeroplaza-26](aeroplaza-26.md) (la cámara a 60) y [aeroplaza-27](aeroplaza-27.md) (la APK).

## Dónde estaba el retraso (medido con sus dos videos, `herramientas/manos-video.mjs`)

- **Lo dibujado estaba más lejos de la mano que lo que sale del filtro**: `centro` 33,1 contra 29,5 % de la palma
  (video de 30 fotos) y 16,2 contra 13,4 (el de 60). La foto sola con su atraso (`CRUDO=1`), 28,0 y 12,3: el
  filtro casi no suma; lo de después, sí.
- **Era el resorte** (`Mano.suavizar`): con `TAU` = 0,001 el dibujado da 29,7 y 13,6 (como el filtro), pero con
  500 patadas por minuto. El resorte crítico reparte cada salto en ~2 TAU (64 ms) y en el video casi todo el
  movimiento es salto: la ganancia medida (0,27) apaga el adelanto entre foto y foto (`GAN_SOLA`).
- **Las anclas no pesan en los videos** (rápidas y medio dan lo mismo); en `manos-lento` sí: son lo lento de los
  movimientos chicos.
- **En `manos-lento` falta adelanto**: con la foto a 0,15 s se adelantaba el 84 % (`AMORT` + `AMORT_MAS`), y la
  ganancia (mínimos cuadrados con la velocidad ruidosa) da menos de 1 en rampas parejas.

## Lo que quedó (`js/manos.js`)

- **`TAU_FOTO` = 0,0333**: el resorte escalado por el intervalo de las fotos (a 60, la mitad; a 30 o menos,
  igual). Solo eso: el video de 60 da `ver` 36,0 → 34,4, `centro` 16,2 → 15,0 y patadas 39,9 → 31,9; el de 30 y
  `manos-lento`, igual.
- **`TAU_RAPIDA` = 0,02 con el centro de 0,05 a 0,3 m/s (`TAU_VEL`)**: moviéndose, lo que salta es movimiento.
- **`LAT_REF` 0,13 → 0,08**: con la foto a 0,15 s, adelanta el 93 %.
- **Suaves con `vs` = 0,05**: sin eso, el paso de 6 mm a 6 cm/s quedaba justo en el borde de soltar el ancla (1
  de 5 semillas, 5 mm atrás durante 8 s).

| medio, semillas 1-5 | antes | ahora |
|---|---|---|
| de costado a 5/10/20/40 cm/s (ms atrás) | 185/102/83/112 | 172/78/56/72 |
| para arriba a 15 / lejos y cerca a 10 | 71 / 191-227 | 43 / 163-192 |
| arranque 1 cm / manotazo, la mitad | 224 / 205 ms | 215 / 182 ms |
| fino 1 cm/s / paso 6 mm (la mitad) | 437 / 408 ms | 315 / 357 ms |
| quieta, tiembla | 0,111 mm | 0,110 mm |
| video 30: ver / centro / patadas / tiembla | 57,8 / 33,1 / 71,5 / 0,89 | 56,5 / 32,3 / 117,5 / 1,08 |
| video 60: ver / centro / patadas / tiembla | 36,0 / 16,2 / 39,9 / 0,64 | 34,0 / 14,6 / 34,6 / 0,66 |

- Semillas 6-10: de costado 198/108/72/106 → 186/83/45/71; tiembla 0,152 → 0,165.
- Suaves: 208/110/86/115 → 183/83/59/72, paso 428 → 453. Rápidas: 162/92/78/108 → 149/67/52/65.
- Con la red salteando fotos (`REDES=2`, el de 60): `centro` 16,8 → 15,6; el de 60 a 30 (`CADA=2`), 17,2 → 16,8.
- **Las patadas de más del video de 30 son de medio segundo** (6,5-7 s: la mano dando vueltas a ~2 anchos de
  imagen por segundo). Lo dibujado va sin cortes: el paso de un cuadro a otro cambia hasta 8 (antes 6) milésimas
  de la imagen. La patada cuenta "3 veces lo que se mueve la verdad" y, con 150 ms de atraso, lo dibujado va
  más rápido justo cuando la verdad da la vuelta. El temblor de más se mide al frenar.

## La APK (`android/.../ManosNativas.java`)

- **Buscaba dos manos en cada foto** (`setNumHands(2)`): MediaPipe busca palmas en cada foto aunque siga una.
  En la web eso daba 74 contra 38 ms ([aeroplaza-17](aeroplaza-17.md)). En el celular no está medido.
- Ahora hay dos redes: `red1` (una mano) mientras se ve una sola; `red` (dos) cuando no se ve ninguna, cuando se
  ven dos (y hasta 500 ms después), 400 ms recién aparecida, una foto cada 1,2 s (`BUSCA_CADA`) y cuando
  `manos.js` tiene una a prueba (`quiereDos` → `AeroplazaNativo.manosDos`).
- Cada foto dice cuántas buscó (`n` en el JSON): con una buscada, la otra no cuenta como perdida
  (`recibirCamara › cupo`).

## Lo que no sirvió (medido)

- **`AMORT` 1**: de costado 162/63/42/91, pero el manotazo se pasa 72 mm (antes 64) y el video no mejora.
- **Más ganancia** (`GAN_MIN` 0,5, `GAN_SOLA` [0, 0,3], `GAN_MEM` 0,8): en `manos-lento` va mucho más pegada,
  pero en el video de 30 el `centro` sube a 34,5-35,8 y las patadas a 215-317. Con su mano, la velocidad
  no alcanza para predecir.
- **`GAN_PREVIO` 6e-4 o 1e-3**: de costado a 5 cm/s 127 o 74 ms, pero con las semillas 6-10 tiembla 0,32
  (el doble) y el paso llega a 1,3 s.
- **El resorte por la velocidad de costado sola**: lo de profundidad queda lento (lejos 163 → 186) y el temblor
  del video no baja.
- **Que el ancla de costado se acomode sola** (como `ASIENTA`): va de a poco y ya no se suelta. El fino pasa a
  578-595 ms y el paso a 875-1107.
- **Bajar el empuje más despacio** (`an.empuje`): no cambia nada.

## Cómo se barre (el guion es del scratchpad)

- `evaluar.mjs '{"TAU":0.02,"media.rl":0.004,"P_DEDOS.adelanto":0.4}' nombre [nivel]`: copia `js/manos.js` a
  `js/_v-nombre.js` con eso cambiado (tiene que estar en `js/` por los import) y corre `manos-lento` (5 semillas)
  y `manos-video` con los dos videos. Son ~2,5 s por variante; dos a la vez, con `xargs -d '\n' -P 2`.
- **Los números de `manos-lento` no son los de las notas viejas** (88/42/65/99 en `aeroplaza-25`): el mismo
  commit da hoy 185/102/83/112. Cambió la prueba, no el juego: se compara siempre con el HEAD corrido hoy.
- `ETAPA=filtro` y `CRUDO=1` en `manos-video` dicen cuánto pone cada parte: se mira eso antes de tocar perillas.
- **Las pruebas del navegador abren `aeroplaza.html` armado**, no `js/`: después de tocar el código, primero
  `herramientas/armar.mjs` (una tanda entera corrió con lo viejo). `manos-lento` y `manos-video` sí leen `js/`.
- **`pkill -f` con un texto que está en el mismo comando** mata la propia terminal (sale con 144).
