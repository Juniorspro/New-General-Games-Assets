# BRILLO

Plataformas 2D en pixel art Frutiger Aero, en `brillo/brillo.html` (un solo
archivo). Lo que se juega y la música están en `brillo/README.md`. Acá va lo
que hace falta para tocarlo sin romperlo.

## Armar y probar

- Armar: `node brillo/herramientas/armar.mjs [--dev]`. Usa el esbuild de
  `bosque/node_modules`.
- El resolvedor:
  - `node --max-old-space-size=6144 brillo/pruebas/recorrido.mjs [mundo] [--guardar]`;
  - los seis mundos juntos tardan unos 15 minutos; corrélo en segundo plano;
  - `--guardar` deja las soluciones en `pruebas/recorridos/`.
- Los bancos de prueba: `?prueba=sprites`, `?prueba=fondo&mundo=X&x=300&t=3`
  y `?prueba=nivel&nivel=X&x=..&y=..`. El último es el nivel pelado, sin
  director, para mirarlo.
- En el juego, `window.__brillo` es el director y `window.__Sonido`, el sonido.
  Para probar un mundo:
  - `d.partida = {...}; d.jugar(id, null)`;
  - para teletransportar: `d.N.m.p.x = ..`.
- Los scripts de las pruebas en Chromium estaban en el scratchpad, que se
  borra. Si se rehacen:
  - pasar las charlas con Enter;
  - para el teléfono, tocar por CDP (`Input.dispatchTouchEvent`), con 390x844
    y `isMobile`.

## Cómo está hecho

- Las piezas:
  - `pantalla.js`: el tamaño del juego;
  - `pixel.js`: el pintor;
  - `personajes.js`: los muñequitos, Dorado y PLANO;
  - `fondos.js`: el parallax de los seis mundos;
  - `tiles.js`: el piso, con un estilo por mundo;
  - `objetos.js`: las cosas y la Aurora;
  - `efectos.js`: burbujas y lo de adelante;
  - `fisica.js`: pura y determinista, a 60 pasos por segundo;
  - `juego.js`: un nivel andando;
  - `post.js`: el WebGL;
  - `ui.js`, `tactil.js` y `entrada.js`: la interfaz y los controles;
  - `director.js`: el flujo y el guionista;
  - `historia.js`: los guiones;
  - `textos.js`: es, en y pt;
  - `sonido.js`: el sintetizador.
- La historia son guiones `async` que reciben `j`. Si el jugador se va de un
  mundo, las esperas de ese mundo no vuelven nunca (`vale()` compara
  `d.vez`). No hace falta cancelar nada.
- Las habilidades:
  - en la física: `m.habil`;
  - la historia las da con `nivel.da[zona]`, y así el resolvedor las ve;
  - cada nivel declara en `habil` las que ya trae de los mundos anteriores.
- En el Plano, el gris es `Nivel.gris`: se pinta con la mezcla `saturation`
  antes de dibujar a Nick, así Nick no pierde el color. El gris de la
  Actualización, en el prólogo, va por el post y lo apaga todo.

## Trampas que ya costaron

- **La página entera invisible en el teléfono.** `Pantalla` le ponía la clase
  `tactil` al `<html>`, que es la misma clase del panel de controles
  (`opacity:0`). Ahora la raíz usa `dedos`. Nunca repetir el nombre de una
  clase de componente en la raíz.
- **Las metas del resolvedor.**
  - La meta de guiño tiene que llevar `x, y`: sin eso, la heurística daba NaN
    y buscaba a ciegas.
  - Las metas intermedias de burbujas grandes llevan `burbuja: true`. Si no,
    "se cumplen" saliendo de la burbuja a mala altura.
- **Las trampas de heurística.** La heurística va por la grilla y no sabe
  cuánto salta Nick. Un guiño justo arriba de una plataforma a la que no se
  llega saltando derecho hace explotar la búsqueda. Poné el guiño donde el
  camino real va "hacia" él: del otro lado de la columna de viento, o arriba
  de la loma por la que se pasa.
- **Los viajes largos en burbuja.** Si la burbuja sube lento, la búsqueda no
  avanza. Burbujas de `vel` 1.5, con metas intermedias abajo y arriba (ver
  `PISTAS`).
- **Las fotos para buscar guiños.** Se sacan cada 3 acciones, también nadando
  y en el aire. Si no, en el agua y en los rebotes no hay de dónde salir.
- **La Aurora.**
  - Con 120 de 192 pasos prendida, el hueco oscuro mide 9 baldosas: imposible
    en el primer puente. Quedó en 144 (un hueco de 6, que se salta).
  - La ola camina a 2 px por paso; Nick, a 2,45. Hay que entrar detrás de la
    luz.
- **El agua de mar.** Las cáusticas píxel por píxel en un mundo todo de agua
  pesan: en el Arrecife (`mar: true`) van cada 4 píxeles y el agua casi no
  tiñe.
- **Los techos que tocan el borde de arriba.** Arriba del mapa cuenta como
  pared si la fila 0 es pared. Si no, les salía pasto o arena encima.

## El tráiler (`brillo/trailer/`)

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

## Lo que falta o no se probó

- No se probó en un teléfono de verdad: ni fps ni sonido. La música se midió
  con un analizador en Chromium: sin recortes ni silencios, y los temas
  parejos (~0,055 RMS).
- No hay una prueba de la partida entera que juegue las soluciones en el
  navegador, como la de KUNTUR. Cada tramo lo comprueba el resolvedor, y el
  flujo de cada mundo y el final se probaron teletransportando a Nick.
