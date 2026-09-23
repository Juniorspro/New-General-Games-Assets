# KUNTUR (23/09/2026)

Juego 2.5D "estilo Paper Mario" en `kuntur/`: Killa lleva un pichón de cóndor
de Purmamarca al Nevado de Chañi. Prólogo, 5 capítulos y epílogo. Un solo
HTML: `kuntur/kuntur.html` (830 KB). Es la vara para el próximo juego. Ver también: [juegos](juegos.md),
[maquina](maquina.md) (el navegador para probar).

## Cómo se llegó al estilo

- El dueño rechazó el low-poly ("no me convence el modelo 3D"), después pidió
  cubos de pixel art y al final "¿no puede ser como un Paper Mario?". Quedó:
  pixel art impreso en recortes de papel con borde blanco sobre un diorama de
  cartón. Si pide otro cambio, el dibujo sale de `js/sprites.js` y `js/elenco.js`.
- Interfaz propia, distinta de ZONDA y LUZ MALA: telón de aguayo que se frunce,
  cartelitos colgados para el idioma, boletos de tren como menú, mapa doblado
  (capítulos), cuaderno (coplas), globitos de papel (charlas).

## Armar y probar

- `node kuntur/herramientas/armar.mjs [--dev]`: three y esbuild de
  `bosque/node_modules`, sin instalar nada.
- `python3 kuntur/herramientas/mapas.py` regenera `js/mapas.js` (no se toca a mano).
- `node kuntur/pruebas/recorrido.mjs [capítulo] [--guardar]`: cada tramo entre
  apachetas, cada copla y lo que tiene que estar cerrado. Tarda ~5 min por
  capítulo; conviene uno por proceso en paralelo (4 núcleos).
- `node kuntur/pruebas/partida.mjs [fotos]`: juega la partida entera en Chromium
  con las soluciones de `pruebas/recorridos/*.json`, charlas y escenas
  incluidas, hasta los créditos. Pasó entera el 23/09.
- URL `?cal=baja|media|alta` fuerza la calidad; `?prueba=sprites` y
  `?prueba=escena&nivel=…` son bancos de prueba.

## Trampas ya pagadas

- Chromium sin GPU (swiftshader) dibuja esta escena a ~5 cuadros/s: el reloj y
  las animaciones CSS van lentos. Para probar, `__K.congelado = true` y
  `__K.simular(seg)` / `__K.logica(1/60)`; nunca juzgar la velocidad ahí.
- Resolvedor (A*), lo que lo trababa, en orden:
  - heurística por baldosa sin gradiente adentro: se interpola con la vecina;
  - agachada avanza 0,2 m por acción y no salía de su casillero: grilla ×2;
  - colgada tiene que esperar 0,12 s antes de trepar: el tiempo va en la clave
    (con `Math.round`, `floor(0.1/0.1)` da 0);
  - el viento y las trabas/pendientes también van en la clave;
  - mantener el salto entre acciones no es apretarlo de nuevo (`entradaDe(a, f, prev)`);
  - tramos con piedra: pistas (`PISTAS` en `recorrido.mjs`).
- Diseño: un pilar de 1 de ancho y 4 de alto atrás de espinas no lo encontraba
  el resolvedor pero sí se puede; dos rocas de 7-8 de alto cortaban la Puna
  (se rehízo); el hueco de sal de 6 se cruzaba sin aleteo (quedó de 7).
- La pared del fondo solo va donde el hueco mide ≤ 5 de alto (casa, vagón,
  cueva); si no, las repisas del Nevado dejaban paredones oscuros.
- El teatrito usa el alto del suelo suavizado, no el tope: si no, sale en
  escalones. Cerros en el mismo z se pisan (rayas): cada uno con su z.
- Un `#ui button{background:none}` le gana a `.tag`: el reseteo va con `:where`.
- `.capa` es `position:fixed`: arma su propio apilado, necesita `z-index` sobre
  el telón. Un `drop-shadow` en un elemento con `mask` queda recortado: la
  sombra va en otro hijo.
- El farol (PointLight) pegado al recorte lo quemaba: 2,4 de intensidad a 1,5 m
  adelante.
- Los disparos de la física se cruzan yendo a la derecha: el epílogo se
  dio vuelta (la casa a la derecha).

## La historia

- `js/historia.js`: funciones async por capítulo que usan al director
  (`charla`, `grito`, `esperar`, `enSuelo`, `evento`, `caminarA`, `encuadre`).
- En el Nevado el final lo maneja la escena (`finPorGuion`); si no, correr hasta
  la F salteaba la despedida de Apu.
- Una charla que arranca mientras se cierra el telón quedaba colgada: el
  director no abre charlas con `terminando` y cierra globos al cambiar.
- 15 coplas, 3 por capítulo, cada una con el tema de su lugar.

## Cinemáticas y sprites vivos (v2)

- Escenas: `director.cine(true/false)` pone `bloqueo` (sin mando y con franjas)
  y `quieta` (el mundo no da pasos de física, ni vigas ni viento). Ayudantes:
  `gesto(quien, anim, seg)`, `caminarVecino`, `mirar`, `lanzar` (un `Volador`
  de papel), `viajar(meta, seg)` y `encuadre {x, y, ancho, libre, alzada}`
  (alzada negativa mira para arriba).
- Gestos por línea de charla en `HISTORIA[cap].gestos[clave][línea]`; si no hay,
  el que escucha a veces asiente.
- Gente: `ELENCO[id]('anim:cuadro')` en `elenco.js` (poses articuladas).
  `Vecino` (figuras.js) elige, en orden: caminar a una meta > acción > hablar >
  charla > saludar si Killa pasa a menos de 3,2 m > su tarea. Animales: `Animal`
  sale de las letras y/u/m del mapa (`LUGAR_ANIMAL`); la vicuña huye.
- Killa: `hacer(anim, seg)`; seg = Infinity lo deja hasta `hacer(null)`.
- Trampas:
  - darse vuelta con "vuelta corta" (wrap del ángulo) la dejaba de canto: el
    papel no es periódico, el yaw va y vuelve por interpolación simple;
  - la escena congela el mundo pero **no** hay que poner vx = 0 en la física
    (rompe la partida grabada): solo el dibujo la ve quieta;
  - `partida.mjs` guarda y repone a Killa y `m.tiempo` alrededor de cada escena
    (`alCine`) y apaga las charlas con vecinos (`sinVecinos`); si no, las
    caminatas de las escenas desfasan las soluciones grabadas.

## Celular parado: se gira 90°

- `js/pantalla.js`: si el alto > ancho en un dispositivo táctil, `#app` va con
  `translateX(innerWidth) rotate(90deg)` y el juego usa el ancho y alto
  lógicos (`Pantalla.w/h`). El CSS no usa vw/vh: usa `calc(N * var(--vw))`
  (también los negativos), que `Pantalla` actualiza.
- El toque se pasa con `Pantalla.aJuego` (x = clientY, y = innerWidth −
  clientX) y `caja(el)` suma los offsets hasta `#app`.
- Clases en `html`: `girado`, `angosta`, `bajita` (alto < 520: menús apretados,
  `--corto`). Al elegir idioma prueba pantalla completa y `orientation.lock`.
- Los botones táctiles se corren `--costado` (lo que queda del telón abierto) y
  `--cenefa`: si no, el telón los tapaba en el teléfono.
- Para probarlo: Playwright con viewport 390×844, `hasTouch` e `isMobile`
  (no quedó script en el repo), y girar la foto 90° para mirarla.
