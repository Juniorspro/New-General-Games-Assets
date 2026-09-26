# AEROPLAZA — vigésima vuelta (27/09/2026): la mano lenta con la cámara lenta de un celu

Sigue de [aeroplaza-20](aeroplaza-20.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Un video de su celu (grabación de pantalla, 13 s, VR sin visor) y "Lentoooo".

## Lo que se vio en el video

- El juego dibuja a 40-50 cuadros por segundo mientras graba (cuadros distintos
  por segundo, contados en la grabación de 60): no es el juego.
- La mano dibujada se mueve pareja, sin saltos. Lo lento es el atraso contra la
  mano de verdad, que en una grabación de pantalla no se ve.
- No tenía prendido ⏱: no se sabe cuánto tarda la foto en su celu. Se le pidió
  una captura del cartel.

## Por qué iba lenta (simulado)

- **El adelanto tenía tope por nivel**: `lmax` 0,13-0,2 s, afinado con la
  cámara a 90 ms (la foto llega a los ~124 ms).
- **Con una cámara más lenta**, el tope frenaba todo. De costado, atrás:

  | la foto llega a los | medio | rápidas |
  |---|---|---|
  | 124 ms | 19 ms | 8 ms |
  | 194 ms | 97 ms | 49 ms |
  | 264 ms | 221 ms | 174 ms |

- **Y el adelanto usa el 80 % de la velocidad** (`AMORT`): con la foto a
  124 ms alcanza; con más, queda cada vez más atrás.

## Lo que quedó (`js/manos.js › adelantar`)

- **Topes a 0,35 s** en los tres niveles (`SUAVIDAD`, `LAT_TOPE`).
- **`AMORT_MAS` 0,24**: lo que la foto tarda de más de 0,13 s (`LAT_REF`) se
  adelanta un poco más, hasta `AMORT + 0,24` con 0,26 s. Hasta 0,13 s, todo
  igual que antes.
- **`ADEL_MAX` 10 cm**: lo más que se corre el centro por el adelanto. Con la
  foto a 0,19 s, en un manotazo a 1 m/s que va y vuelve, el adelanto la pasaba
  50 cm y después saltaba de golpe (`manos-celu`: tirón de 499 mm; ahora 20).
- **Nivel Medio**: la zona del ancla de costado, 3,8 → 4,8 mm. Con los topes
  nuevos temblaba igual que Rápidas en `manos-celu` (1,08 mm); ahora 0,98
  (rápidas 1,08, suaves 0,86).

## Medido (`manos-lento`, `MP=1`, semillas 1-3)

- **De costado, atrás**, con la foto a 194 ms: medio 97 → 26 ms, rápidas
  49 → 10, suaves 114 → 68. Con 264 ms: medio 221 → 76, rápidas 174 → 57.
- **Con la foto a 124 ms**, igual que antes.
- **Lo que se paga, con la cámara lenta**:
  - al frenar de golpe se pasa más: con 194 ms, 39 → 51 mm;
  - tiembla más: medio 0,32 → 0,56 mm; rápidas 0,94 → 1,19.
- **Lo que no cambia**: al arrancar, la mano igual sale tarde (lo que tarda la
  foto): no hay adelanto que sepa que la mano va a arrancar.
- **Navegador**: `manos` 20/20, `manos-directo` 10/10, `manos-celu` 23/23,
  `vr` 19/19, `xr` 10/10, `vr120` 12/12. La tanda entera da bien, salvo `voz`
  una vez ("Beto escucha a Ana": 0,004); sola, 10/10 (0,067). No toca las manos.

## Lo que se probó y no sirvió

- **`AMORT` 0,9 o 1 para todos**: con la foto a 124 ms se adelanta de más (de
  costado va 12-52 ms adelante) y tiembla más.
- **`ADEL_MAX` 7 cm**: quieta tiembla más de lo que deja `manos-celu` (6,2 mm
  contra 6).
- **La zona del ancla de costado en 4,3 mm** (la de la vuelta 17): en
  `manos-celu` el medio temblaba más que rápidas (1,18). El temblor de ahí con
  tres semillas es ruidoso.

## Trampas

- **Para ver en un video si el juego va lento**: contar los cuadros distintos
  por segundo (diferencia media entre cuadros seguidos > 0,35 en gris). Seguir
  la mano por color no sirve: es celeste grisácea, como el cielo.
- **`manos-lento` acepta la cámara lenta** como segundo argumento (`… "" 160 1
  2`): así se ven los topes que frenan.
- **Si el celu no da `captureTime`**, el lector toma la foto más rápida como si
  no tardara nada: el atraso medido sale más corto que el de verdad y el
  adelanto se queda corto. No se pudo comprobar en su celu.
