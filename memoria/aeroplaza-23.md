# AEROPLAZA — vigesimosegunda vuelta (27/09/2026): la palma para abajo que se tomaba para arriba

Sigue de [aeroplaza-22](aeroplaza-22.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Sigue medio mal: está con la palma para abajo y la detecta como arriba".

## Qué pasaba

- **Palma para arriba o para abajo no es la profundidad**: el orden de los
  nudillos en la imagen fija para dónde sale `cross(5 - 0, 17 - 0)`; la palma
  es ese lado en la derecha y el otro en la izquierda. Lo decide **qué mano
  es** (`Mano.derecha`), y cómo se doblan los dedos en la forma 3D.
- **Medido con MediaPipe de verdad** (las 5 fotos de `pruebas/manos` y sus
  espejos, guion del scratchpad): hacia dónde se doblan las cinco puntas contra
  esa normal da 130-260 mm (de canto, 86), con el signo de la mano.
  - Con la etiqueta segura (0,93-0,98), forma y etiqueta coinciden siempre.
  - Dudando (de canto 0,64, el pellizco de dorso 0,54), la etiqueta dice una
    mano y la forma la otra.
- **La etiqueta se votaba aunque dudara**: con la palma para abajo (la cámara
  ve el dorso), 4 fotos dudosas daban vuelta la mano, y la forma quedaba la de
  la otra mano de palma (los dedos doblados hacia la cámara).
- En `manos-celu` (prueba nueva, la derecha con la palma para abajo y
  MediaPipe dudando y espejado): antes, dibujada al revés el 100 % del tiempo.

## Lo que quedó (`js/manos.js`)

- **La etiqueta cuenta solo si es segura** (`ETIQUETA` 0,8): para votar y al
  aparecer. Si duda, al aparecer decide el lado de la foto.
- **La forma se dobla como la mano que es** (`quiralidad`, `QUIRAL` 0,1 m,
  `PoseMano.elegirEspejo(…, quiral)`): si lo que da MediaPipe se dobla como la
  otra mano, va su espejo en profundidad. Con la mano plana (menos de 10 cm),
  sigue decidiendo lo que venía.
- **Medido**: la palma para abajo con MediaPipe dudando, al revés 0 %; la palma
  a la cara, reconocida el 100 %. `manos-lento` igual que antes en todo.
- **Navegador**: `manos` 20/20, `manos-directo` 10/10, `manos-celu` 25/25,
  `vr` 19/19, `xr` 10/10, `vr120` 12/12. La tanda entera no se corrió (el
  cambio es solo de las manos por cámara).

## Trampas

- **La mano de `manos-lento` no es de ninguna mano**: el pulgar está del lado
  de la palma de una derecha y el índice (`dobla`) se dobla para el dorso. Con
  `QUIRAL` 0,03-0,06, el ruido la hacía elegir mal al darse vuelta (dedos 6,9°
  → 14,2°). Con 0,1 no se activa ahí: esta vuelta se prueba en `manos-celu`.
- **Las fotos de Rezona no dicen de qué mano son**: una "derecha de palma"
  puede ser una izquierda vista de frente. Se comparó forma contra etiqueta,
  no contra la foto.
