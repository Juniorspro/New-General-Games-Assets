# BRILLO — rendimiento, cámara y cinemáticas (24/09)

Parte de [brillo](brillo.md). Pidió: "va muy lag, bajale resolución, hacelo
más pocket (acercá la cámara), cinemáticas al hablar con NPC, optimizá bien".

## Qué era el lag (medido, no supuesto)

- **La pasada de efectos corría a la resolución de la pantalla.** En un
  teléfono con 3 píxeles por punto, el lienzo era de 2532×1080: 2,7 millones
  de píxeles con unas 25 lecturas cada uno por cuadro (rayos de 18, fantasmas,
  bloom).
  - Ahora todo se compone a la resolución del juego (622×288) en un búfer.
  - Una pasada de una sola lectura por píxel ("sharp bilinear") lo agranda a
    la pantalla.
  - En Chromium con SwiftShader: de 4-6 a 12-17 cuadros cada 3 s en alta, y
    hasta 50-59 en baja. La placa de un teléfono lo hace mucho más rápido;
    lo que importa es la proporción.
- **Tres fondos pintaban miles de cosas por cuadro** (perfil de CPU de Chrome
  sobre `armar.mjs --dev`, por llamador):
  - el arcoíris del Cielo: 4.700 `fillRect`, unos 30 ms. Se pinta una vez;
  - las cortinas de la Aurora: 930 `drawImage` en `lighter`, 12-120 ms. Van
    a un búfer de media resolución, cada dos cuadros;
  - la estática de TV: 128 `fillRect` por baldosa. Son 32 variantes pintadas
    una vez;
  - las cáusticas del agua: 33 mil `Math.sin` por cuadro. Van a tablas por
    columna, fila y diagonal. El Arrecife bajó de 6-23 a 1,5 ms;
  - la superficie del agua: dos `Path2D` en vez de dos `fillRect` por columna.
- **`putImageData` en un lienzo de la placa es lento** (9 ms): el búfer de la
  Aurora va en un lienzo con `willReadFrequently`, que queda en memoria.
- **`backdrop-filter` encima del juego que se mueve** se recalcula en cada
  cuadro. Se sacó del HUD y de los botones táctiles, y de todo en calidad
  baja.
- Para medir se usaron dos cosas:
  - envolver funciones con `performance.now` mientras el bucle del juego sigue
    corriendo mezcla todo: los números no cerraban;
  - lo que sirvió fue frenar el bucle (`d.cuadro = () => rAF`), precalentar
    20 cuadros y usar el `Profiler` por CDP.

## La cámara más cerca

- `pantalla.js`: el alto pasó de 360 a 288; el ancho va de 448 a 704.
- Los fondos se anclan abajo (`h - 360`), así que con 288 se achica el cielo
  de arriba y las colinas quedan en su lugar.
- La interfaz se mide en % de la caja (`--u`), así que no cambió de tamaño.
- La física no cambió: los niveles se siguen pudiendo pasar igual (sin
  comprobar con el resolvedor, porque no se tocó `fisica.js`).

## Las cinemáticas de charla

- Están en `director.js › cineCharla` y `vistaCine`. El zoom lo hace la
  pasada final (recorta y agranda), así que no cuesta nada.
- El foco es el medio entre Nick y el que habla. Va al 64 % de alto si la
  ventana del chat está arriba, y al 38 % si está abajo.
- El zoom es de 1,55× como mucho, y menos si están lejos, para que entren los
  dos.

## La calidad

- Por defecto es `auto`: alta → media → baja si da menos de 48 cuadros por
  segundo. Nunca sube sola, y queda guardada en las opciones.
- Las opciones guardadas antes del 24/09 decían `alta` a mano: pasan a
  `auto` (`v: 2`).

## El tráiler

- `tomas.js` pide `?alto=360&sinzoom`: así el juego se graba como antes
  (1920×1080 = 640×360 a ×3) y el guion no cambia.
