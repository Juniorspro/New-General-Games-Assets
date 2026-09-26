# AEROPLAZA — decimoquinta vuelta (27/09/2026): manos rápidas sin temblar y el rayo que baja

Sigue de [aeroplaza-15](aeroplaza-15.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "Va muy muy lenta la mano". Con la vuelta 14, que temblaba, iba "más rápida y
  precisa, literalmente parece Meta Quest". Quiere un punto medio.
- "El pinchi no funciona porque el coso para elegir no se mueve hacia abajo".

## Por qué iba lenta

- **La vuelta 15 filtraba fuerte la profundidad**: `H_CORTE` 0,5 y sin
  adelanto. Atrasaba 141 ms en profundidad; la 14, 75.
- **El One Euro atrasa en lo lento**: quieta no tiembla, pero despacio se queda
  atrás hasta que la mano va rápido y se abre.
- **Tiene otra trampa**: su velocidad sale inflada, porque la mide contra su
  propia posición atrasada. Eso da un adelanto que nadie pidió, y al frenar la
  mano se pasa (hasta 27 mm).

## Lo que quedó (`js/manos.js`)

- **Un filtro liviano con la cámara** (`EuroEjes`, que casi no atrasa):
  - de costado, `C_CORTE` 2,76, `C_BETA` 33, `C_CORTED` 3;
  - en profundidad, `CH_CORTE` 2, `CH_BETA` 20, `CH_CORTED` 1,19, `CH_CRUCE` 0,3.
- **Más adelanto**: `LMAX` 0,109 y `LMAX_H` 0,1 (antes 0,04 y 0); `AMORT` 0,80;
  `TAU` 0,032.
  - Salieron de una búsqueda al azar: 3 × 40 juegos de constantes contra la
    herramienta de abajo.
- **Lo quieto lo sostienen dos anclas** (`Mano.estabilizar`), una de costado y
  otra a lo largo del rayo de los ojos a la mano:
  - si el centro filtrado no sale de su zona un rato (`A_TQUIETO` 0,15 s de
    costado, 0,1 en profundidad), lo que se ve se queda quieto en ese eje;
  - si sale, la arrastra desde el borde;
  - si la arrastra más de `A_TEMPUJE` (0,02 s), se suelta y va sin freno;
  - con las dos puestas, el adelanto se apaga (`pesoAd` → 0), porque quieta la
    velocidad es ruido y paseaba la mano un centímetro.
  - Es un corrimiento de toda la mano: los dedos siguen con lo suyo.
- **Tres niveles** (`SUAVIDAD`, lo elige el menú; `Manos.suavidad`), según las
  zonas de las anclas:

  | nivel | de costado | en profundidad |
  |---|---|---|
  | `rapida` | sin anclas | sin anclas |
  | `media` (de entrada) | 3 mm | 10 mm |
  | `suave` | 4 mm | 14 mm |

- **La foto que erra la profundidad**: ahora se espera solo si cae lejos (8 cm)
  de lo que predice el filtro **y** de la mediana de las últimas 4 fotos.
  - Antes era solo contra el filtro. Dos malas seguidas lo corrían, después las
    buenas parecían malas, y la mano se iba 13 cm para adelante.

## El rayo que no bajaba

- **La causa**: salía del hombro (el modelo del Quest). Con la cámara del celu,
  la mano casi siempre está a la altura de los ojos, así que el rayo apuntaba
  derecho.
- **Ahora, con la cámara**: sale de los ojos, con el ángulo de la mano
  agrandado (`RAYO_GANA` [2, 2,6], de costado y arriba/abajo).
  - Tope: ±1,4 rad de costado; de −1,35 a 1 arriba/abajo.
  - Con la mano 20° abajo de la vista, apunta al piso (y −0,77) y sale el arco.
- **El visor y las pruebas** siguen con el hombro.

## El menú y lo que se ve (`ui.js`, `vr.js`, `main.js`, `guardar.js`, css)

- **"✋ Las manos: Rápidas · Medio · Suaves"**, abajo de las llaves del menú del
  VR (`.vr-suave`, `.vr-tres`).
  - Se apaga (se ve gris) si las manos están apagadas.
  - Se guarda en `opciones.vrSuave`; `entrarVR` lo pasa a `manos.suavidad`.
  - Textos en es/en/pt (`vr_suave_*`).
- **Con ⏱ prendido**: el cartel de cuadros suma `✋ 27/s · 150 ms · 45 ms/red
  ×2` (`ManosCamara.datos()` por `vr.datosManos`). Es para que mande los números
  de su celu.
- **La segunda red se apaga sola** (`ManosCamara.medirRedes`) cuando:
  - con las dos, la primera tarda 1,35 veces lo que tardaba sola;
  - o la segunda tarda 1,5 veces lo que la primera.
  - Cuenta desde 15 fotos cada una.

## Medido (`herramientas/manos-lento.mjs`, 5 semillas)

Con la foto a 148 ms. Tiembla: lo que se mueve de un cuadro al otro, quieta.
Deriva: lo que se va de su lugar. Atraso: en rampas lentas.

| versión | tiembla | deriva | atraso de costado | en profundidad |
|---|---|---|---|---|
| vuelta 14 ("parece Quest") | 1,24 mm | 7,1 mm | 92 ms | 75 ms |
| vuelta 15 ("muy lenta") | 0,70 | 4,8 | 99 | 141 |
| rápidas | 1,27 | 7,6 | 62 | 57 |
| **medio** | 0,80 | 4,8 | 70 | 101 |
| suaves | 0,34 | 2,1 | 84 | 179 |

- **Con la foto a 208 ms**:
  - medio: 0,77 mm, 159 ms y 182 ms (la 15: 0,72, 186 y 216);
  - rápidas: 1,32 mm, 150 ms y 133 ms.
- **Resumen**: medio tiembla como la 15 y va más rápido en todo. Rápidas es la
  14 pero más rápida.
- **Lo que empeoró**: al frenar de golpe se pasa un poco más (32 mm contra 27
  de la 15), por el adelanto más largo.
- **`manos-celu`**, 18/18:
  - el atraso limpio: 36 mm a 89 ms (antes 38) y 74 mm a 209 ms (antes 82);
  - no titila;
  - el tirón p99, 9-11 mm.
- **Navegador**: `manos` 19/19 (tres veces), `vr` 19/19 (con el selector),
  `xr` 10/10, `vr120` 12/12; la tanda entera da bien (`menus`: todas entran).

## Lo que se probó y no sirvió

- **Un Kalman de posición y velocidad por eje** (el `Seguidor`), con los dedos
  aparte y el ruido aprendido:
  - con `q` 2 temblaba 9 mm;
  - con menos, atrasaba como el One Euro.
- **Corregir solo lo que se sale de n veces el ruido**: atrasa siempre n·σ.
- **La velocidad "sin sesgo"** (la de lo filtrado): la búsqueda se quedó con
  la inflada, porque ese adelanto de más compensa parte del atraso.
- **Detectar "quieta" por la velocidad**: el ruido de la velocidad es de 1-9 cm/s,
  así que nunca se anclaba. Se detecta por desplazamiento del centro filtrado.
- **Una sola ancla**:
  - con zona chica, no se ancla nunca en profundidad;
  - con zona grande, lo lento de costado se pega.

## Trampas

- **`SUAVIDAD.rapida` es `null`**: con `?? SUAVIDAD.media` caía en medio. Se usa
  `k in SUAVIDAD`.
- **La "quieta" de `manos-celu`** (el desvío de la distancia) no ve las anclas:
  sostienen una posición corrida. El temblor se mide cuadro a cuadro
  (`tiembla`).
- **Los tramos lentos necesitan reposos largos**: si no, el arranque del tramo
  siguiente contamina la medida.
- **Las ventanas con `ancho`** usaban `94vw`. Con el celu parado (el juego
  girado), eso es el alto físico: el menú del VR medía 373 px y se cortaba.
  Ahora es `calc(94 * var(--vw))`.
- **En pantallas bajas (`b460`)**, el menú del VR se aprieta (el dibujo al lado
  del texto) para que entre sin desplazar en 740 × 360.
