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

## Las canciones grabadas (24/09)

- Mandó dos videos de TikTok: el menú de Wii Party ("f9", para el menú y el
  tráiler) y Mii Maker de Wii U ("9c", para el mundo 1). Dijo que va a mandar
  más, una por mundo.
- Son de Nintendo y las eligió quien pide. Si se publica, TikTok puede
  silenciar o reclamar el video.
- **El repo es público** (GitHub dice `private: false`, 24/09): los MP3 no se
  commitean (`brillo/.gitignore`). `brillo.html` va sin canciones, y
  `brillo-con-canciones.html` sale solo si están los MP3: ese se entrega. Como
  el contenedor se borra, en otra sesión hay que rehacerlos con los videos
  (los puntos quedan en `musica/canciones.json`). Si hace el repo privado, se
  pueden subir.
- Cómo se hacen: `brillo/README.md § Las canciones grabadas`. El tema es el
  nombre que usa el juego (`titulo`, `colina`, `arrecife`…).
- **Los videos de TikTok terminan con el logo, que suena:** −6 dB en el último
  segundo y medio. El bucle no tiene que llegar ahí.
- **El bucle:**
  - Wii Party: 110 BPM, frases de 4 compases (8,727 s). Son cuatro frases de
    A y dos de B, y después vuelve a A: a = 0,3875 s y b = 52,744 s, alineado
    por los golpes.
  - Mii Maker: se repite entera cada 36,198 s. El cruce va a los 1,5 s, donde
    las dos vueltas más se parecen (0,905).
  - La repetición no es idéntica muestra a muestra (el parecido de onda dio
    0,1-0,7), así que va un fundido de 0,15 s.
  - Después del fundido van 0,4 s copiados, y el juego salta en la mitad. Así
    aguanta que el decodificador corra el MP3 unos milisegundos.
  - Chrome decodifica el MP3 con el largo exacto, sin el relleno del
    codificador, y en el salto no hay aspereza (medido en un
    `OfflineAudioContext`).
- **Nivel:**
  - al lado de los temas sintetizados (~0,06 RMS en el analizador), el Wii
    Party sonaba 1,9 dB más fuerte;
  - por eso lleva `vol: 0.8` en `musica/canciones.json`.
- **16 bits:**
  - el reductor de 28 escalones de los temas sobre una mezcla entera es puro
    ruido, así que las grabadas van por uno de 64;
  - la canción sigue donde iba, y el cambio cae 0,4 s después de pedirlo.
- **El tráiler usa módulos nativos, sin esbuild:**
  - por eso `sonido.js` no importa los MP3: los registra `js/canciones.js`
    desde `canciones-datos`, un módulo que arma `armar.mjs` (loader `binary`);
  - `trailer/audio.js` los trae con `fetch`.
- **Las gotas:** pidió "pup, no tiring". Ahora suenan como un seno que sube de
  300 a 720 Hz en 50 ms (`sonido.js › pup`), en vez de la campanita.

## El tráiler y el rendimiento

- El tráiler está en su propia nota: [brillo-trailer](brillo-trailer.md).
- Qué lo hacía lento, la cámara más cerca (288 de alto) y las cinemáticas
  de charla: [brillo-rendimiento](brillo-rendimiento.md).

## Lo que falta o no se probó

- No se probó en un teléfono de verdad: ni fps ni sonido. La música se midió
  con un analizador en Chromium: sin recortes ni silencios, y los temas
  parejos (~0,055 RMS).
- No hay una prueba de la partida entera que juegue las soluciones en el
  navegador, como la de KUNTUR. Cada tramo lo comprueba el resolvedor, y el
  flujo de cada mundo y el final se probaron teletransportando a Nick.
