# AEROPLAZA — decimocuarta vuelta (27/09/2026): el flash, menos temblor y dos redes

Sigue de [aeroplaza-14](aeroplaza-14.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Un botón de flash cuando se elige el modo no SBS".
- "Mejorá el temblor de las manos".
- "Y la fluidez: que vaya súper igual a la mano real".

## El flash (`vr.js`, `manos-camara.js`, `main.js`)

- **Qué es**: la linterna de la cámara de atrás. Alumbra las manos en un lugar
  oscuro, donde la red casi no las ve.
- **Dónde**: solo en el VR sin visor (con visor no se puede tocar la pantalla).
  Es una burbuja de vidrio arriba a la derecha que se enciende amarilla
  (`.vr-flash`, `.prendido`).
- **Cómo se toca**: el toque del botón no llega a la capa (`stopPropagation`); si
  no, además caminaba.
- **Cómo se prende** (`ManosCamara.linterna(prender)`):
  - `applyConstraints({ advanced: [{ torch }] })` si `getCapabilities().torch`;
  - si no, devuelve `'no'` y el VR avisa (`vr_flash_no`); iOS no deja;
  - si no hay manos abiertas, abre la cámara solo para eso (`abrirCamara`) y la
    cierra al apagar.
- **Al salir del VR**: se apaga todo. `apagar({ todo })` cierra también el
  flash; `apagarManos` lo pide cuando `vr.activo` es falso.
- **La conexión**: `vr.alFlash` la pone `main.js`, con `laCamara()` (la única
  `ManosCamara`).

## Dos redes a la par (`manos-camara.js`)

- **Por qué**: una sola red lee 14-20 fotos por segundo, porque tarda más de lo
  que la cámara tarda en dar la siguiente. Con dos, una lee una foto y la otra
  la siguiente: 28 por segundo.
- **Cuándo**: si `navigator.hardwareConcurrency >= 6` (se puede forzar con
  `iniciarRed({ dos: true })`). La segunda arranca después de la primera, con
  los archivos ya en la caché. Sin manos a la vista hace 1 s, trabaja solo la
  primera.
- **La foto que vuelve tarde** (después que la siguiente) se tira, en los dos
  lugares:
  - `ManosCamara.recibir`, con `ultimaT`;
  - `Manos.recibirCamara`, con `tCapUlt`.
- **Simulado**, contra una sola red:
  - el atraso limpio baja un 18 %;
  - quieta tiembla 2,5 contra 2,9 mm;
  - el tirón p99 baja de 10 a 8 mm;
  - no titila nunca.

## La profundidad aparte (`manos.js › EuroEjes`)

- **El problema**: lo que peor adivina una sola cámara es lo lejos que está la
  mano, porque sale del tamaño con que se ve. De costado, la foto es precisa.
- **El filtro**: con la cámara, cada punto se filtra en dos partes:
  - de costado, como antes (`E_CORTE` 1,2, `E_BETA` 10, `E_CORTED` 2);
  - a lo largo del rayo de los ojos a la mano, más fuerte (`H_CORTE` 0,5,
    `H_BETA` 5, `H_CORTED` 1).
- **`H_CRUCE` 1**: la velocidad de costado también abre el filtro de
  profundidad. Con la mano a un costado, moverla de lado cambia la profundidad
  del rayo, y sin esto se atrasaba.
- **El adelanto**: de costado se adelanta por el atraso (`LMAX`); en
  profundidad no (`LMAX_H` 0), porque ahí la velocidad es casi todo ruido.
- **Lo que no cambia**: el visor y las pruebas (`recibirMundo`) siguen con el
  filtro de antes (`euroIso`). Si cambia la fuente, el filtro nuevo arranca
  con el estado del viejo.

## Medido (`pruebas/manos-celu.mjs`, dos redes)

Una mano, contra la vuelta 14 (una red, sin ejes):

| la foto llega con | titila/min | tirón p99 | quieta | error |
|---|---|---|---|---|
| 90 ms | 6 → 0 | 11 → 7,6 mm | 4,0 → 2,1 mm | 66 → 62 mm |
| 150 ms | 4 → 0 | 10,6 → 8,1 mm | 3,9 → 2,3 mm | 82 → 79 mm |
| 210 ms | 6 → 0 | 10,4 → 8,2 mm | 3,4 → 2,7 mm | 95 → 94 mm |

- **Sin errores de la red** (el atraso solo): 44 → 38 mm con la foto a 88 ms;
  91 → 82 mm a 208 ms.
- **Con el doble de ruido en profundidad** (el de un celu peor): quieta
  7,5 → 4,3 mm.
- **Navegador**: `manos` 19/19 (con dos redes de MediaPipe de verdad); `vr`
  18/18; `xr` 10/10; `vr120` 12/12.

## Lo que se probó y no sirvió

- **Adelantar más de costado** (`LMAX` 0,06-0,08 o `AMORT` 1): el atraso limpio
  baja 2-4 mm, pero con ruido el error sube 3-7 mm y tiembla más.
- **`TAU` 0,02**: un poco menos de atraso y más tirón (máximo 28 contra 23 mm).
- **Adelantar algo en profundidad** (`LMAX_H` 0,02): tiembla más (2,8 contra
  2,3 mm).

## Trampas

- **El contenedor tiene 4 núcleos**: sin `dos: true` la prueba no veía las dos
  redes.
- **El flash necesita la pista de la cámara abierta**: sin manos, se abre la
  cámara solo para la linterna. Si después se prenden las manos, `prender()`
  reusa la misma (`abrirCamara` no abre dos).
- **"Igual a la mano real" tiene un piso**: la cámara del celu tarda 100-250 ms
  en dar la foto. Todo lo de acá achica lo que se suma arriba de eso (filtros,
  esperas, temblor), pero ese atraso no se va desde el código. Lo que falta
  para bajarlo es de hardware: MediaPipe en la GPU del worker, a medir en un
  celu.
