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

Cómo se corre y qué es cada parte: `brillo/README.md § El tráiler`. Lo que
costó aprenderlo:

- **Tres pasos con un solo guion** (`guion.js`): tomas (el juego), audio (la
  música) y video (Remotion). Si el guion cambia de lugar, los golpes de la
  música dejan de caer en los cortes.
- **Las tomas son el juego con un reloj propio.** `performance.now` y
  `requestAnimationFrame` falsos, metidos en `<head>` por el servidor de
  `grabar.mjs`.
  - Nick repite los recorridos del resolvedor (K = 6 pasos por acción) y se
    evitan los tramos con muertes.
  - Graban a ~450 ms por cuadro: las 25 tomas en español tardan 26 min. Las
    del juego sirven para los tres idiomas; en inglés y portugués se graba
    solo la Actualización (~5 min).
- **WebCodecs pide un origen seguro:** en `about:blank` no existe
  `VideoEncoder`. Todo va por `http://127.0.0.1`. Hay VP9 y Opus, pero no
  H.264 ni AAC: el MP4 lo hace Remotion.
- **El chat del juego es HTML**, no sale en el lienzo. Se lee del DOM cuadro a
  cuadro (`.chat`, con `.ve` y `.sale`) y Remotion lo dibuja de nuevo. Los
  avatares son data: URI y se guardan una vez cada uno.
- **Remotion en esta máquina:**
  - hay que pasarle `--browser-executable` con el `headless_shell` de
    `/opt/pw-browsers` y `--gl=swangle`;
  - la horizontal sale a ~1 s por cuadro con 3 pestañas: 97 s de video tardan
    ~50 min;
  - un `filter: blur()` de CSS cuesta +0,7 s por cuadro. El fondo borroso del
    vertical lo hace ffmpeg antes (`<id>.fondo.mp4`);
  - `will-change: transform` no desenfoca: pinta pixelado;
  - un `<En>` con `left` y `translate(-50%)` se achica a la mitad del ancho
    que queda: hace falta `width: max-content`;
  - `--muted` igual busca el WAV: para probar, `sinMusica: true` en las props.
- **El ffmpeg que trae Remotion es mínimo:** no tiene `gblur`, `eq` ni
  `loudnorm`. Se instaló el del sistema con `apt-get install ffmpeg` (6.1.1).
  - La música se lleva a -14 LUFS en dos pasadas (salía a -19,8).
  - El MP4 se pasa con `+faststart`.
- **Portadas:** son las composiciones `Portada` (1280×720) y
  `PortadaVertical`. La toma sigue a Nick, así que Nick queda donde caen sus
  pies: `ny` en `Portada.jsx`.

## Lo que falta o no se probó

- No se probó en un teléfono de verdad: ni fps ni sonido. La música se midió
  con un analizador en Chromium: sin recortes ni silencios, y los temas
  parejos (~0,055 RMS).
- No hay una prueba de la partida entera que juegue las soluciones en el
  navegador, como la de KUNTUR. Cada tramo lo comprueba el resolvedor, y el
  flujo de cada mundo y el final se probaron teletransportando a Nick.
