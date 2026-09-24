# BRILLO — el tráiler de TikTok

Parte de [brillo](brillo.md): el video 9:16 que se arma en `brillo/trailer/`.
Otras notas: [videos](videos.md) (los relatados de LUZ MALA y KUNTUR).

## Cómo está hecho

Cómo se corre y qué es cada parte: `brillo/README.md § El tráiler`.
**Quiere un solo video 9:16 para TikTok**, cinematográfico, con motion
graphics en pixel art del juego. Una versión horizontal más vertical de
97 s la frenó a la mitad: "solo quería uno en 9:16".

- **El guion tiene tomas y planos**, como un editor (`guion.js`). Una toma
  se graba una vez y da varios planos: la Actualización da seis. Si el guion
  cambia de lugar, los golpes de la música dejan de caer en los cortes.
- **Las tomas son el juego con un reloj propio**, metido en `<head>` por
  el servidor de `grabar.mjs`: `performance.now`, `requestAnimationFrame`
  **y `setTimeout`**.
  - Sin el `setTimeout` falso, el director (que espera con timers) corría
    en tiempo real, y la misma toma salía distinta según lo rápido que
    anduviera la máquina.
  - Con el reloj completo, la Actualización da siempre igual: plano a los
    2,07 s, Mora a los 6,33, ¡MORAAA! a los 10,4, "Se la llevó" a los 15,07.
  - Todo se graba a ~470 ms por cuadro: 16 tomas en 15 min.
- **Recorte vertical nativo:** 540×960 del lienzo del juego (que va a ×3),
  agrandado ×2 sin suavizar, así queda a 6 px por píxel.
  - Los primeros planos son zoom ×2 exacto con `image-rendering: pixelated`,
    para que queden nítidos.
  - `pos` guarda dónde están Nick y Mora en cada cuadro. A Mora el juego la
    esconde cuando la simplifica (desde 5,97 s): se usa la última posición
    vista.
- **WebCodecs pide un origen seguro** (en `about:blank` no existe
  `VideoEncoder`) y no trae H.264: las tomas van en VP9 y el MP4 lo hace
  Remotion.
- **Remotion en esta máquina:**
  - hay que pasarle `--browser-executable` con el `headless_shell` de
    `/opt/pw-browsers` y `--gl=swangle`;
  - `remotion bundle` copia `public/` en el momento: si después se graba una
    toma, hay que armar el paquete de nuevo;
  - `filter: blur()` de CSS cuesta +0,7 s por cuadro;
  - para el mosaico, pintar chico y agrandar con `will-change` **no pixela**
    (Chromium vuelve a dibujar a tamaño completo). Anda un filtro SVG
    (`feFlood` + `feTile` + `feComposite` + `feMorphology dilate`);
  - un `<En>` con `left` y `translate(-50%)` se achica a la mitad del ancho
    que queda: hace falta `width: max-content`;
  - `--muted` igual busca el WAV: para probar, `sinMusica: true` en las props.
- **La música en `OfflineAudioContext`:**
  - todo se programa antes de renderizar, así que
    **`cancelScheduledValues(ahora)`, nunca `(0)`**. Con 0, el corte de la
    historia le borraba la entrada al tema del gancho, que sonaba 20 dB más
    bajo;
  - para encontrarlo sirvió renderizar solo la música (`--soloMusica`) y medir
    el RMS cada medio segundo con `ffmpeg astats`;
  - el sintetizador empieza un tema 0,4 s después de pedirlo: el guion lo pide
    0,4 s antes del compás, con un preámbulo que después se corta;
  - la página de la música a veces se cuelga después de mandar el WAV;
    `grabar.mjs` espera 5 min y sigue si el WAV está.
- **El ffmpeg que trae Remotion es mínimo** (sin `gblur`, `eq` ni
  `loudnorm`). Se usa el del sistema (`apt-get install ffmpeg`, 6.1.1).
  - La música se lleva a -14 LUFS con pico -1 dBTP, en dos pasadas.
  - Remotion saca el MP4 en rango completo (`yuvj420p`), aunque se le pida
    `yuv420p`. Hay una pasada final con x264 (`-tune animation`, crf 17) a
    BT.709 de rango limitado, con `+faststart`: 90 MB → 66 MB y los colores
    no se mueven (±2 de 255).
- **Zona segura de TikTok:** nada importante arriba de 220 px, abajo de
  1500 ni en los 120 px de la derecha. `ZONA` en `carteles.jsx` centra todo
  en x = 490.

## La canción del menú (24/09)

- Pidió que el tráiler tenga la canción del menú: la grabada de Wii Party
  (ver `brillo.md § Las canciones grabadas`).
- Va a 110 BPM y el montaje estaba a 138: con la canción pegada encima, los
  cortes caían fuera de tiempo. Se pasó `COMPAS` de `guion.js` a 110
  (2,182 s el compás) y se volvió a grabar todo: `grabar.mjs tomas --rehacer`,
  después `audio` y `video`. El tráiler pasó de 56 s a 67 s.
- Las tomas se graban del largo justo que usa el montaje (`largoDeTomas`):
  si cambia el compás, hay que rehacerlas. Sin `--rehacer` saltea las que ya
  están.
- `audio.js` carga y decodifica las grabadas ANTES de programar el guion. Si
  no, en el `OfflineAudioContext` arrancarían cuando ya pasó todo.
- `golpe()` no toca la ganancia de una grabada: ya entra sola con su primer
  golpe a los 0,4 s. Rehacerle la subida le tapaba la entrada.
- La copia liviana (para el chat, tope 30 MiB) iba a 3,8 Mbps fijos. Con 67 s
  dio 34 MB, así que ahora la tasa sale del largo: 3.280 kbps y 28,5 MiB
  (`grabar.mjs › video`).
- 24/09: el render completo (tomas 26 min, audio 0,5 min, video 33 min) dio
  -14 LUFS y pico -0,9 dBTP.
