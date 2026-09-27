# AEROPLAZA — vigesimoquinta vuelta (27/09/2026): el dedo que movía la mano, la cámara a 60 y la luz

Sigue de [aeroplaza-25](aeroplaza-25.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Un video nuevo a 60 fps (subido a la sesión, **no está en el repo**): la
  izquierda, de canto, moviendo los dedos, y después poses; con flash, en un
  cuarto oscuro. "Por mover el dedo nomás, la mano se mueve de un lado a otro."
- La cámara ajustada y con filtros para el flash, lo oscuro y la mucha luz.
- Que la cámara lea o entregue siempre 60.

## El dedo que movía la mano

- **MediaPipe mueve la palma al compás de los dedos**: entre 1,5 y 6 s,
  correlación 0,63 entre lo que se mueven la palma y las puntas; también la
  profundidad (0,63, con los 21 puntos o con la palma sola: da igual).
- **El adelanto lo agrandaba**: el vaivén rápido de la palma dibujada (lo que se
  aparta de su promedio de 0,25 s) era 4,0 % de la palma en la imagen contra 2,6
  de MediaPipe; en 3D, 11,7 contra 8,4 mm. Sin adelanto, 2,6. Seguir derecho una
  oscilación de 3 Hz por 0,1 s la agranda casi el doble.
- **Lo que quedó** (`Mano.medirDedos`, `pesoDedos`, `DEDOS_PALMA`
  [0,3, 0,6, 1, 0,15]): si las puntas se mueven en la palma mucho más que la
  palma (descontado el ruido de los dedos quietos, 15 cm/s: en `manos-lento`
  andan en 12 de mediana), la palma y su giro casi no se adelantan.
- **Medido**: vaivén 3,9 → 2,9 % (en 3D 11,8 → 8,1 mm); `manos-lento`, igual
  (de costado 88/42/65/99 ms, como antes).
- **No sirvió**: filtrar más la palma mientras se mueven los dedos (2,7 →
  3,0 %); agrandar la zona del ancla (nada: necesita un rato quieta).

## La cámara a 60

- **Medido con la misma verdad** (el video a 60; `CADA=2` da una foto de cada
  dos, como una cámara a 30; `REDES=n` saltea las fotos con las redes ocupadas):
  60 contra 30 tiembla un 10 % menos y patea 6-18 % menos; lo que se corre, casi
  igual. Manda el atraso de la cámara, no las fotos por segundo. A 60 la cámara
  también tarda menos en dar cada foto (eso no está medido).
- **Dos redes leen ~40 por segundo**; para las 60 hacen falta tres.
- **Lo que quedó** (`manos-camara.js`):
  - se pide `frameRate` con mínimo 30 (con poca luz no baja a 15: la foto sale
    más oscura y la aclara la luz de la red);
  - `ManosCamara.a60`: si da menos de 55 y dice que puede 60, prueba
    640×480, 1280×720 y 960×540 con mínimo 50;
  - `ManosCamara.terceraRed`: con la cámara a 50 o más y 8 núcleos, una tercera
    red; se apaga sola si la primera va un 30 % más lenta (`medirRedes`).

## La luz (`manos-camara.js › LUZ_JS`, la clase `Luz`)

- Mide la luz de la mano (el recuadro de la última foto; sin mano, la foto
  entera) en una copia de 48 de ancho cada 4 fotos; si está oscura, aclara la
  foto de la red (`brightness` de un canvas) hasta 0,42, sin pasar de ×6.
- **Medido con el video oscurecido** (`LUZ=`, error contra el original):
  - oscuro, 3,4 → 1,8 % de la palma;
  - muy oscuro, 5,0 → 2,1 %, y la pierde en 0 fotos en vez de 11;
  - con luz normal casi no toca (0,4 %).
- **Oscurecer no sirve**: con mucha luz y `brightness` 0,7, MediaPipe no
  encontró la mano en 743 de 744 fotos (con el canvas en la placa y en memoria;
  no se sabe por qué: lo quemado igual no vuelve). Por software solo aclara
  (`gmin` 1); lo claro va por la cámara.
- **La exposición** (`ManosCamara.ajustarExposicion`, `exposureCompensation`,
  Chrome en Android): la mano quemada (el flash de cerca, el sol: más del 12 %
  blanco) baja un paso; oscura aunque ya se aclara al máximo, sube; vuelve a 0
  de a poco. Un paso cada 0,6 s.
- **El canvas en memoria** (`willReadFrequently`): en la placa, la red (en la
  CPU) tardaba 40 ms más por foto en leerla.
- Va en el lector (worker), en el hilo del juego sin lector y en
  `manos-video.mjs` (`FILTRO=auto`). En el cartel de ⏱: `☀×g` y `EV`.

## Medido (antes → ahora)

- **Video nuevo** (60 fps, dos redes, 90 ms): el vaivén de los dedos 3,9 →
  2,9 %; tiembla 0,76 → 0,58 mm; patadas 24 → 40 por minuto (pocas igual).
- **Primer video** (90 / 160 ms): tiembla 1,03 → 0,89 / 1,32 → 1,14 mm;
  patadas 77 → 72 / 123 → 77; se corre 58,0 → 57,8 / 66,0 → 65,6.
- Navegador: `manos` 20/20, `manos-celu` 26/26, `vr` 19/19, `xr` 10/10,
  `vr120` 12/12, `manos-directo` 10/10.

## Trampas

- **El video nuevo es de la izquierda**: "al revés" y "para atrás" suponían
  la derecha (daban 97 % y 42 %). Ahora van contra la mano que dice MediaPipe
  segura la mayoría de las veces (`manos-video.mjs › LADO`).
- **Lo de la cámara no se puede probar acá**: `a60`, la exposición y la
  tercera red dependen del celu. Todo va con try/catch; sin eso, como antes.
- **Seguir la pulsera en la imagen** (plantilla, scratchpad) no alcanzó para
  separar el movimiento de verdad del de MediaPipe: la plantilla deriva.
- Herramientas: `manos-video.mjs sacar` con `FPS=`, `LUZ=oscuro|muy|claro` y
  `FILTRO=auto|{…}`; `medir` con `REDES=`, `CADA=`, `QUIETO=t0,t1` (el vaivén).
