# AEROPLAZA — vigesimotercera vuelta (27/09/2026): seguir la mano de un video de verdad

Sigue de [aeroplaza-23](aeroplaza-23.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Mandó un video de su mano (subido a la sesión, **no está en el repo**, es
  suyo y no se sube): "que la siga a la perfección, sin estirarse ni
  deformarse, sé estricto".

## Cómo se mide (`herramientas/manos-video.mjs`)

- `sacar <video>`: ffmpeg a 30 fps y 320 de ancho, y MediaPipe de verdad en
  Chromium (buscando una y dos manos, como el juego) → `pruebas/salida/manos-video.json`
  (ignorado por git, como todo lo sacado del video).
- `medir <json> [manos.js] [ms de la cámara]`: pasa las fotos por `js/manos.js`
  a 120 Hz con el atraso de un celu y compara lo dibujado con la imagen.
- Lo de verdad es la imagen de MediaPipe suavizada 1-2-1 (sin atraso). El error,
  en % del largo de la palma **en la imagen** (en mm engañaba: la profundidad de
  MediaPipe salta de 5 a 30 cm con la mano cortada por el borde).
- Mide `ver` (todo), `centro`, `forma`, `verQuieta`, `estira` (huesos contra su
  mediano), `alReves` (la palma del otro lado), `atras` (una punta doblada
  para el dorso más de 25°), `dobles`, `tiembla`.
- `CRUDO=1`: la última foto tal cual (el piso); `ETAPA=filtro`; `SEG=1` por
  medio segundo; `ESTIRA=1` cuándo se estira; `PUNTOS=<ms>` los puntos.

## Qué pasaba (medido en el video, cámara a 90 ms)

- **MediaPipe cambia el tamaño de la mano ±40 % de foto en foto** (la palma en
  el mundo): la mano dibujada se inflaba y se achicaba.
- **La forma dice mejor qué mano es que la etiqueta**: forma equivocada 1,4 %
  de las fotos; etiqueta segura equivocada, 4 %.
- **El adelanto de los dedos en la palma** (`P_DEDOS.adelanto` 1,18) los daba
  vuelta y los doblaba para atrás al frenar.
- **El ruido tira las puntas para el dorso**: MediaPipe crudo, 10 % de los
  cuadros con una punta a más de 25° para atrás; el filtro rápido de los
  dedos lo dejaba pasar (hasta 36 %).

## Lo que quedó (`js/manos.js`)

- **Tamaño fijo** (`Mano.escalar`, `PALMA_TAM`): aprende el tamaño de la palma
  (30 fotos, después despacio y sin saltos de más de ×1,6) y escala cada foto
  desde la cámara (la imagen no cambia). Solo esto: 131,5 → 75,4 %.
- **Huesos sobre su rayo** (`Mano.alRayo`, `ALRAYO` [0,1, 0,5]): si un hueso sale
  más de 10 % distinto del aprendido, corre la punta por su rayo de la imagen
  hasta el largo, sin irse más de medio hueso de la profundidad de MediaPipe.
- **Qué mano es, por la forma primero** (`recibirCamara › voto`): si la forma
  dice claro (`QUIRAL`), vota ella; si no, la etiqueta segura.
- **Adelanto de la pose** (`Mano.adelantar`, con `E.wg`): el centro, el giro
  (`expQ`, saturado con atan, `GIRO_AD`) y lo que se mueven los dedos, en vez de
  cada punto por su lado.
- **Sin adelanto de los dedos en la palma** (`P_DEDOS.adelanto` 0).
- **Cuánto adelantar, medido** (`Mano.medirAdelanto`, `GAN_MEM`, `GAN_MIN`,
  `GAN_DESDE`): compara lo que el adelanto predijo con lo que la foto mostró
  después; con un video a los tirones baja solo (mínimo 0,2).
- **Las puntas no se doblan para el dorso más de 15°** (`DORSO`,
  `PoseMano.restringir`, con `PoseMano.quiral`: la palma es +z en la derecha).

## Medido (antes → ahora, video, cámara a 90 ms; a 160 entre paréntesis)

- se corre la mano: 131,5 → 63,0 % de la palma (a 160: 74,9);
- la forma: 110,8 → 42,0 %; quieta: 229 → 49 %;
- al revés: 10,8 → 1,3 % de los cuadros; dedos para atrás: 12,7 → 2,9 %;
- tiembla quieta: 2,54 → 1,98 mm por cuadro;
- estira (el 5 % peor): 4,5 → 5,6 %; lo peor, solo en el primer medio segundo
  (la forma recién aparecida, 0,1 % de los cuadros);
- dobles 0, sin mano 1,3 %.
- **El piso** (la última foto, sin filtro): 47,1 % a 90 ms (17,8 sin atraso),
  pero se estira hasta 104 % y tiembla 3,37: lo que falta es el atraso.
- `manos-lento`, 5 semillas, Medio, 90 / 160: ver 6,5 / 8,4 mm, tiembla 0,17 /
  0,18, giro 17 / 22°, dedo que se cierra 285 / 358 ms (antes 117: lo que se
  pagó por no deformar).
- Navegador: `manos` 20/20, `manos-celu` 25/25, `vr` 19/19, `xr` 10/10, `vr120`
  12/12, `manos-directo` 10/10.

## Lo que se probó y no sirvió

- **El filtro de los dedos más rápido** (`P_DEDOS` corte 1,5-4): `dedo` 285 →
  242 ms, pero al revés 2 → 6 % y para atrás 20 → 36 %.
- **Adelanto del giro sin tope**: giro 60° al darse vuelta. Con atan, 15-19°.
- **`alRayo` sin tope** (cada hueso a su largo siempre): la vuelta de
  `manos-lento` a 60° y huesos 16 %.
- **Empezar el tamaño fijo antes** (1-5 fotos en vez de 10): igual.
- **Una búsqueda de 26 constantes con el video** (560 pruebas, scratchpad):
  lo mejor, 61,7 %, pero el dedo 414 ms y de costado 76 ms atrás. No se usó.
- La ganancia medida sube el atraso de costado en `manos-lento` (25 → 90-170
  ms) aunque baja el error total (6,7 → 6,5): el video manda.

## Trampas

- **El video no está en el repo** (es de quien pide): sin él, `manos-video`
  no corre. Con uno nuevo, `sacar` primero.
- **Nada que salga del video se sube**: el json va a `pruebas/salida/`.
- **`manos-celu`, la palma para abajo**, cambió: ahora la etiqueta viene
  equivocada (0,55, o 0,9 una de cada tres) y la forma espejada una de cada
  20, como en el video.
- **`estiraMax` es el 99,9 %**: casi siempre es la mano que recién aparece.
