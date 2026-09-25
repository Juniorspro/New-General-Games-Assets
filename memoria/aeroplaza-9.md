# AEROPLAZA — octava vuelta (25/09/2026): Zona de Juegos, runner, efectos y movimiento

Sigue de [aeroplaza](aeroplaza.md) (armar, probar, red, trampas viejas). Acá va
lo de esta vuelta. Rama `claude/fijate-iszyer`.

## Lo que pidió

- Dos canciones sin el "tirón" del logo de TikTok (una breakcore, solo para el
  runner); la Zona de Juegos como mapa con puertas, mesas de a dos y más de 10
  actividades; un runner que se gane en lo que dura el breakcore y pase de
  Frutiger a glitches.
- Deslizar siempre, manos más bajas, un aviso a la vez, textos más chicos,
  caminar y correr de su video, efectos "1000% mejor" que el TearDrop, el
  movimiento de su otro video y nubes sin recortes.
- Los links de TikTok no se bajan (permiso negado); los mp4 que mandó sí.

## Canciones (`musica-ajena/canciones.json`, los mp3 no se commitean)

- **juegos** (954536c6): bucle [32,05 ; 78,2677], 64 golpes de 0,72215 s.
- **runner** (d1e4de45): 175 BPM, bucle [0,35 ; 66,9], dura 67,1 s. El tirón
  está en 66,9 y queda afuera. Sube de golpe a los 19-20 s y se apaga desde
  los 64,2 s.
- Se hacen con `brillo/herramientas/canciones.py hacer <tema> <video> <a> <b>`.

## Caminar, correr y deslizar

- Las poses salen del video de los R6 (`animador.js › CLIPS`, camina y corre),
  con estilo "cartoon" del mismo lado: se levanta la pierna y va adelante el
  brazo de ese lado. Camina en 0,8 s, corre en 0,6 s.
- El ciclo va a la velocidad real: `vel/vref`, con 3,4 y 7,2 m/s, entre ×0,45
  y ×1,5.
- **El R6 de Roblox de verdad lo rechazó** ("esa r6 no es la que quiero").
  `herramientas/roblox.py` (lee rbxm y xml) queda como herramienta, sin usar.
- Ajustar las siluetas del video en automático dio poses rotas. Sirvió poner
  poses a mano y compararlas con capturas del juego.
- **Deslizar siempre**: el bug del celu era que exigía "correr" prendido.
  `jugador.js › deslizar` ahora sale caminando o parado; v0 es 1,12× lo que
  iba (mínimo 7,6, u 8,4 corriendo).

## Efectos y movimiento

- `efectos.js › Efectos`: chispas en pool (1800 Points), cintas, rayos, orbe,
  anillos, grietas y escombros.
- El gesto **✦ Poder** es `lagrima()`, con 4,5 s de espera.
- La pasada final de `motor.js` lleva `uDestello`, `uOscuro`, `uGlitch` y
  `uVelocidad`. `main.js` pone `reino.glitch` y `reino.velFx`.
- Movimiento del video:
  - al correr, la cámara se inclina y tiembla (`camara.js › kSprint`) y el FOV
    sube 7;
  - valla sola (de 0,5 a 1,25 m);
  - subir paredes hasta 3,4 m;
  - correr por la pared;
  - grietas si cae a más de 14 m/s.
- **Nubes**: `assets/cielo.webp` se hizo repetible (1056 px, 320 de cruce) y
  hay nubes de shader (fbm). Las `nube-*.webp` se borraron porque tenían
  bordes rosas y venían recortadas.

## Zona de Juegos (`reinos/juegos.js`, `mesas.js`)

- **Puertas**: 11 a 10,8 m del centro (`DESTINOS`). Cada lugar tiene su
  vuelta "al centro" corrida 3,8 m al costado; si no, al llegar tapaba la
  cámara.
- **Mesas**: 6 (damas ×2, ta-te-ti, cuatro, memo y ppt).
  - Las reglas son puras, sobre JSON (`REGLAS`).
  - Dónde está sentado cada uno va en el estado (`mesa: "i.s"`); las jugadas
    van como acción `mesa`.
  - Manda la silla 0; si no hay nadie, juega la compu.
- **Pelota**: la manda el último que la tocó, a 10 Hz durante 1,2 s. Los goles
  van con `{type:'gol'}`.
- **El resto**: canchita, básquet, 2 pistas de bolos, 7 trampolines
  (rebote de 12 a 24), 3 hamacas, tobogán (`RAMPA`, desliza solo) y la pista
  de baile.
- Volver de un juego (`J.volverAJuegos`) te deja frente a su puerta. Si la
  zona no estaba armada, la arma (`construirReino('juegos')`).

## Runner · Aero.exe (`reinos/runner.js`)

- **El recorrido**: 20 tramos (`TRAMOS`), 904 m. A 17 m/s son 52,8 s sin
  errores; el límite es 63,5 s.
- **Estrellas**: según lo que sobra; 3 con 8 s o más, 2 con 4 s o más.
- **Física**: gravedad 21 y `mundo.acelAire` 26. Con 9 no se llegaba a doblar
  en el aire.
- **Saltos a 17 m/s**, ya medidos:
  - uno solo dura 0,82 s y cubre 14 m en plano;
  - si el otro lado está 1 m más alto, 11,5 m; con 1,5 m más, 9,6 m;
  - el trampolín (rebote 15,5) da de 25 a 28 m.
- **Obstáculos**: no son sólidos; los revisa el runner.
  - Chocar te frena y te tira para atrás; el obstáculo queda fantasma 1,3 s.
  - Las compuertas se pasan deslizándose (alto 0,72 contra 1,0).
  - Los cubos cambian de carril cada compás (4 golpes) y siempre dejan uno
    libre.
- **La cámara** queda fija atrás (`camYaw`), a 7,2 m. El FOV sube 12, o 24
  con el aro.
- **Lo roto sigue a la canción**:
  - `PULSOS` (cada 50 ms) y `ENERGIA` (cada 100 ms) salen del mp3, de 0 a 9;
  - `corrupcionEn(s)` da 0 hasta los 16 s, 0,3 en el drop y 1 a los 58 s.
- **Cómo se ve lo roto**:
  - `corromper(m)` parchea los materiales: vértices que saltan, la textura
    que falta en rosa y negro, menos colores;
  - arriba se suman el cielo apagado, el eco de alambre, las ventanas de error
    Aero y la lluvia de píxeles;
  - al llegar al portal, todo vuelve a ser Frutiger.
- **La música**: el runner arranca callado (`J.callar`) y con el ¡YA! la
  canción empieza desde el principio (`J.musicaDeNuevo`).

## Trampas de esta vuelta

- **Toda montura necesita `p`**: `main.js` lee `yo.montura.p`, para la cámara
  y la red. Las hamacas no lo tenían y el juego se colgaba al subirse.
- **Un `interactivo` puede tener `pos` como función** (la pelota:
  `() => pelota.p`). Si se usa `.pos.x` directo, da NaN.
- **Largo del runner contra la canción**: la primera versión tenía 1057 m a
  16 m/s, o sea 66 s, más que los 63,5 s de canción. Hay que medir el largo
  antes de ajustar.
- **Cubos cada 2 golpes y desfasados**: el carril libre duraba 0,34 s y era
  imposible pasar. Ahora cambian cada 4 golpes y juntos.
- **Paredes en zigzag a 9 m** no se llegan a esquivar: hacen falta 12 m o más
  entre una y otra, y no poner una recién después de un salto.
- **Una valla cerca del borde** hace que el salto caiga en el hueco. Tiene que
  estar a menos de largo − 12,8 m desde el principio del tramo.
- Los pulsos se generan del archivo de análisis, nunca a mano. La primera
  vez se copió solo el principio.
- **El tablero de las mesas en el celu** quedaba debajo de los botones de la
  derecha. Con `html.en-mesa` se esconden `.dedo-boton`.
- Los gestos remotos llegan como "g#n": hay que cortar en el `#`. La clase se
  llama `RemotePlayer`, no `Remoto`.
- Con `?pausa`, los uniformes no cambian hasta que corre un `paso`. Las
  pruebas tienen que avanzar cuadros antes de leer.
- **La valla automática te sacaba de la casa**: tomaba el marco de la
  ventana como valla. Ahora pide lugar para el cuerpo entero arriba en todo el
  salto, y adentro está apagada (`mundo.sinValla`). La cazó
  `interiores.mjs › de la casa no se sale`.
- `pkill -f nombre` también mata la shell que lo corre (sale con 144).

## Pruebas

- `pruebas/juegos.mjs`: 25 bien. Puertas, cada mesa contra la compu hasta el
  final, reglas al azar, gol, aro, bolos, trampolín, hamaca, tobogán, baile, y
  la puerta del runner de ida y vuelta.
- `pruebas/runner.mjs`: 21 bien. Un bot corre el nivel en 52,3 s, sin caerse
  y con 2 golpes; revisa la compuerta, la caída, lo roto, el fin por tiempo y
  la salida.
- `pruebas/movimientos.mjs`: 19 bien.
