# AEROPLAZA — vigesimocuarta vuelta (27/09/2026): sin patadas, la mano lejos y la que sale de la cámara

Sigue de [aeroplaza-24](aeroplaza-24.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Que todo baje más, "sin demoras ni lagueos".
- Que no patee ni se laguee con la mano lejos o fuera de la cámara: que siga fluida.

## Qué pasaba (medido con su video, `manos-video`)

- **La mano estaba cortada por el borde en el 40 % de las fotos** (77 con puntos
  afuera y 91 pegadas al borde, de 359). Ahí estaba lo peor: hasta 130 % de la palma.
- **Las patadas eran el adelanto**: sin adelanto, 4 veces menos patadas (398 → 102
  por minuto) y se corría menos (63 → 59). En los tirones, seguir derecho entre
  foto y foto con la velocidad del filtro se pasaba y volvía.
- **La ganancia medida (`medirAdelanto`) estaba sesgada**:
  - mezclaba la profundidad de MediaPipe (ruido que no se predice): con la mano
    pareja a 20 cm/s daba 0,3-0,5 y no 1;
  - medía solo con el adelanto más grande que 1 cm, y así elegía las fotos con
    ruido: a 5 cm/s se quedaba en 0,2.
- **Al salir de la cámara la mano se clavaba**: el tope del adelanto (`ADEL_MAX`,
  6,5 cm) la frenaba a los 50 ms de la última foto; después se apagaba quieta.
- **Lejos**: el video achicado 2,5 veces (`LEJOS=2.5`), la red a 320 da la mano un
  70 % menos precisa que a 480 (4,6 contra 2,7 % de la palma, contra la de cerca).

## Lo que quedó

- **La red a 480 de ancho** (`manos-camara.js › ANCHO_RED`): lo que tarda casi
  no cambia (43,0 contra 43,3 ms); a 640, igual que 480.
- **La ganancia de costado y la de profundidad, cada una por su lado**
  (`ganancia.g` y `.gh`), sin umbral (`GAN_DESDE` 0), con un previo que pesa
  poco (`GAN_PREVIO` 4e-4 m²): a 5-40 cm/s da 0,55-0,85; el video, 0,27.
- **Lo que se mueve sola entre fotos, con la ganancia** (`GAN_SOLA` [0,25, 0,55]):
  hasta 0,25, nada; desde 0,55, todo. Separa los tirones de lo parejo.
- **La mano que sale** (`saliendo`, `Mano.enBorde`, `ESPERA` 3, `SALIDA` 0,25 s):
  si estaba en el borde de la imagen yendo hacia él y la foto que sigue no llega
  en 3 intervalos, sigue con su velocidad sin el tope y frena en 0,25 s.
- **Se apaga moviéndose** (`Manos.mover`): el adelanto, el resorte y las anclas
  siguen mientras se apaga; antes quedaba quieta.
- **El adelanto de los dedos vuelve** (`P_DEDOS.adelanto` 0,5): con el límite de
  las puntas (`DORSO`) ya no las da vuelta.

## Medido (antes → ahora)

- **Su video, a 480, cámara a 90 ms** (a 160 entre paréntesis):
  - patadas: 373 → 77 por minuto (531 → 123);
  - tiembla: 1,94 → 1,03 mm (2,39 → 1,32);
  - se corre: 62,9 → 58,0 % de la palma (74,7 → 66,0);
  - cortada por el borde: 80,8 → 76,8 %;
  - al revés 2,1 → 2,2 %, dedos para atrás 3,5 → 3,7 % (lo que se paga).
- **Lejos (2,5 veces)**, a 90: patadas 267 → 67, tiembla 1,84 → 1,22.
- **`manos-lento`, 5 semillas, 90 ms** (160):
  - de costado atrás, a 5/10/20/40 cm/s: 154/85/87/108 → 88/42/65/99 ms
    (210/131/141/202 → 114/62/111/196);
  - el dedo que se cierra: 285 → 160 ms (358 → 217); el giro: 17,1 → 15,5°;
  - tiembla quieta: 0,172 → 0,187 mm (0,184 → 0,205): lo que se paga;
  - se pasa en el manotazo: igual (67 mm).
- **Saliendo de la cámara** (`manos-celu`, nueva): en 0,15 s después de la última
  foto sigue 41 mm (la de verdad, 60; antes 17 y se clavaba).
- Navegador: `manos` 20/20, `manos-celu` 26/26, `vr` 19/19, `xr` 10/10, `vr120`
  12/12, `manos-directo` 10/10.

## Lo que se probó y no sirvió

- **La ganancia también entre fotos, sin separar** (`GAN_SOLA` todo): el video
  bien, pero de costado atrás 85 → 176 ms en `manos-lento`.
- **Seguir de largo siempre que falte una foto**: en el video, patadas 77 → 266
  (MediaPipe la pierde 1-3 fotos en los tirones del borde). Con "en el borde",
  158; con "yendo hacia el borde" y 3 fotos de espera, 77.
- **El filtro del centro según la distancia** (la velocidad como si estuviera a
  0,4 m, `LEJOS_REF`): casi nada (saltaZ 22,6 → 21,5). Se sacó.
- **Dedos más rápidos** (`P_DEDOS` corte 1,2-2,5): el dedo 285 → 248-268 ms, y al
  darla vuelta se doblan 6,4 → 7,9-10,1°. El adelanto de los dedos rinde más.

## Trampas

- **`saltaZ` lejos no es ruido**: con el video achicado, la profundidad de verdad
  se mueve 2,5 veces más rápido (m/s). Lo limpio lejos es lo de la imagen.
- **`manos-celu` pasa las manos por fuera de la imagen** (x hasta ±0,3 m a 0,29 m
  de la cámara) y MediaPipe igual las ve: por eso la salida pide que se esté
  yendo hacia el borde (si no, tirón de 69 mm con dos manos y 209 ms).
- **El video de referencia cambió**: `pruebas/salida/manos-video.json` ahora es
  a 480; el de 320 quedó como `manos-video-320.json`. Nada de eso se sube.
- Herramientas: `manos-video.mjs sacar` con `ANCHO=` y `LEJOS=`; `medir` con
  `CURVA=t0,t1`, `PATADAS=1`, y `gan`, `borde`, `patadas`, `saltaZ`, `sacudeZ`;
  `manos-celu` con `MANOS=otro.js` (comparar versiones); `manos-lento` con
  `GAN=1` (la ganancia en el tiempo).
