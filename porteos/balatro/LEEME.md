# Balatro (Android) → navegador

La versión de Android de Balatro (LocalThunk, Playstack) corriendo en el navegador del teléfono: su
código Lua y sus recursos tal cual, sobre LÖVE compilado para la web acá ([`motor/`](motor)), con
una capa chica que pone lo que la versión de Android tiene en su LÖVE propio y en LuaJIT
([`juego/`](juego)).

**Estado:** arranca, el menú, el tutorial, elegir ciega, repartir y jugar manos andan con toques,
en vertical (girado 90°) y en horizontal, también adentro de otra página (Rezona). Guarda la
partida y el perfil (IndexedDB). El sonido arranca con el primer toque. Empieza con la intro de
JXStudios. Todo entra en 8 MB, música incluida, y también va como un solo .html de 9,6 MB. En el
teléfono del dueño: 67 cuadros/s en el menú; jugando se trababa, y la causa estaba en el motor (ver
"Rendimiento"). Pensado también para teléfonos de 1 GB (ver "Memoria") y para GPU viejas con WebGL 1.

## Cómo es

- **El motor.** LÖVE 11.4 de love.js (Davidobot, ramas emscripten) con un Emscripten de 2026
  ([`motor/parchar.py`](motor/parchar.py), [`motor/compilar.sh`](motor/compilar.sh)):
  - sin hilos: el juego corre adentro de otras páginas, donde no hay SharedArrayBuffer;
  - WebGL 2 (y WebGL 1, ver "Memoria"): Balatro pide mipmaps en texturas que no son potencia de dos;
  - excepciones nativas de WebAssembly: con las emuladas, cada llamada a la API de LÖVE (un
    try/catch) pasaba por JavaScript;
  - texturas sin glTexStorage (como en Android) y las de las fuentes como LUMINANCE_ALPHA: con GLES 3
    LÖVE usa swizzle, que WebGL no tiene;
  - sin MP3;
  - sin lo que Balatro no usa, para que todo entre en un .html de menos de 10 MB: glslang (LÖVE lo
    usa sólo para validar los shaders antes de pasárselos a WebGL, que los valida igual), Box2D
    (love.physics), LuaSocket y ENet. El .wasm pasa de 4,5 MB a 3,3 (comprimido, de 1,67 a 1,33);
  - las imágenes sin la copia de sus píxeles en la memoria del wasm (ver "Memoria"), y 48 MB de
    memoria inicial (eran 128);
  - sin las esperas a la GPU y con los vértices en búferes de la GPU (ver "Rendimiento");
  - `porteo_llamar`: una entrada al juego aparte del bucle de cuadros, para que la página corra la
    lógica entre cuadro y cuadro (ver "Rendimiento").
- **El azar y `bit` de LuaJIT.** El Lua de la web es 5.1: su `math.randomseed` trunca a entero y
  Balatro siembra con fracciones (todas las semillas daban `srand(0)`, las mismas cartas siempre).
  [`motor/azar_luajit.c`](motor/azar_luajit.c) es el generador de LuaJIT 2.1 (Tausworthe 2^223) y
  [`motor/lbitlib.c`](motor/lbitlib.c) el módulo `bit`. Con
  [`motor/verificar_azar.lua`](motor/verificar_azar.lua), LuaJIT 2.1 y este Lua dan las mismas 221
  salidas: una semilla da la misma partida que en el teléfono.
- **La capa del navegador** ([`juego/porteo_web.lua`](juego/porteo_web.lua)):
  - `love.system.getOS()` dice Android: el juego se arma como en el teléfono (interfaz táctil,
    sonido en el hilo principal);
  - `love.platform` (lo de Playstack) guarda en la carpeta de LÖVE lo que iba a la nube;
  - `love.thread` con corrutinas, para el cargador y el guardador de partidas, con un `pcall` que
    deja ceder (en Lua 5.1 no se puede hacer yield a través de un pcall de C);
  - la ventana siempre del tamaño del lienzo: el juego arrancaba en pantalla completa;
  - un shader con un `for` que WebGL no acepta;
  - los efectos de sonido se decodifican una vez y se clonan, y los largos (el ambiente y la intro)
    se leen mientras suenan, como la música;
  - las texturas: ver "Memoria";
  - ya andando, no deja rehacer la ventana (en LÖVE eso destruye el contexto de WebGL y vuelve a
    subir las texturas desde una copia que acá no se guarda).
- **El arranque** ([`juego/porteo_despues.lua`](juego/porteo_despues.lua)):
  - un cartel de error que no cuelga la pestaña;
  - el idioma del navegador la primera vez;
  - fuera de la lista los idiomas sin fuente;
  - el modo liviano (texturas 1x) en teléfonos con poca memoria o sin WebGL 2.
- **El bucle de cuadros** ([`juego/porteo_bucle.lua`](juego/porteo_bucle.lua)): el `love.run` del
  juego con la lógica a 30 y la imagen a 60 interpolada en los teléfonos que no llegan (ver
  "Rendimiento"), y la medición de cada cuadro (y la memoria de texturas), que va al registro.
- **La página** ([`pagina/index.html`](pagina/index.html)): la intro de JXStudios y después la
  pantalla de carga con el Joker, horizontal siempre (en vertical, girado), la caché, el registro y
  las partidas en IndexedDB, que se guardan cada 4 s y al esconderse la página. Como un solo .html
  ([`un-archivo.py`](../../herramientas/porteo/un-archivo.py)) toma los archivos de la página misma.

## Lo que baja

| qué | MB | |
|---|---|---|
| motor (love.js + love.wasm) | 3,5 | Cloudflare lo manda comprimido: 1,3 |
| juego (`balatro.love`) | 6,7 | todo: código, imágenes, fuentes, efectos, ambiente y los cinco temas |
| el .html único | 9,6 | lo mismo en un archivo (el motor con gzip), todo en texto ASCII (ver "En Rezona") |

`balatro.love` por dentro: música 3,7 MB, texturas 1,0, efectos 0,8, ambiente 0,6, código 0,3,
textos 0,2. El APK pesa 66 MB (104 descomprimido). Fuera de la versión web, o más chico:

- las fuentes china, japonesa, coreana, rusa y Go Noto (62 MB), con los textos de esos idiomas;
- el sonido, en Vorbis mono: música y ambiente a calidad -1 (32 kb/s, corta en 13,9 kHz), efectos
  a 0 (48 kb/s). De 17,5 MB a 5,1. En el parlante de un teléfono no se nota;
- las texturas van en 1x sacadas de las 2x (son las 1x con cada píxel repetido en 2×2: no se pierde
  nada, ver "Memoria"), recomprimidas sin pérdida con optipng; las 1x originales no van (en 18
  colaboraciones son un dibujo anterior), ni las 2x de los logos, que el juego no usa; los logos,
  a la mitad;
- `gamecontrollerdb.txt`: un mapeo solo (en el navegador SDL ignora los de cada sistema);
- lo de Android (dexopt, info.txt).

**Primera versión, con dos errores que se vieron en el teléfono del dueño:**

- Toda la música (12,7 MB) bajaba por detrás, de a un archivo, sin vigilar si se frenaba. El
  registro mostró que nunca terminaba, y no sonaba ningún tema. La segunda versión traía el tema del
  menú adentro y bajaba los otros de a tres, vigilados; desde la tercera, todo el sonido entra en el
  juego (el dueño pidió unos 10 MB en total) y no baja nada aparte. La página borra la música que
  quedó en IndexedDB de aquellas versiones.
- Con Emscripten 6, el `--post-js` corre después de que el módulo ya arrancó, así que el juego
  empezaba antes de que llegaran las partidas de IndexedDB. Ahora la página espera
  `Module.porteoPartidas`, y no se escribe nada en IndexedDB hasta que la carga inicial terminó:
  escribir antes borraba allá lo que todavía no estaba acá.

## Memoria (teléfonos de 1 GB)

Medido en Chromium (procesos de verdad, PSS) en el menú y jugando una mano:

| | antes | ahora | modo liviano |
|---|---|---|---|
| memoria del wasm | 128 MB | 48 MB (usa 23–33) | 48 MB |
| texturas en la GPU (LÖVE) | 121 MB | 111 MB | 25–32 MB |
| renderizador + GPU | ~590 MB | ~500 MB | ~400 MB |

- **La copia de los píxeles.** LÖVE guarda los píxeles de cada imagen en la memoria del wasm para
  volver a subirlos si se recrea la ventana: 88 MB de los 128. Acá eso no pasa (el juego cambia el
  modo de ventana al arrancar, antes de cargar imágenes, y `porteo_web.lua` no lo deja después), así
  que `motor/parchar.py` los suelta apenas están en la GPU.
- **Las texturas 2x.** Todas son las 1x con cada píxel repetido en 2×2 (el "suavizado de píxeles"
  de Balatro dibuja las 2x con filtro lineal). Viajan en 1x (menos para bajar) y, cuando el juego
  pide una 2x, `porteo_web.lua` la arma en la GPU: un lienzo del doble con la 1x dibujada sin filtro.
  Comparadas con las 2x del APK (volcadas del juego andando): iguales byte a byte.
- **Modo liviano, en todos** (lo pidió el dueño). El juego usa las 1x tal cual, como con el suavizado
  apagado (los píxeles nítidos): la cuarta parte de memoria de video. El lienzo va con hasta 1,5
  píxeles por punto en vez de 2. `index.html?ligero=0` lo apaga (para comparar); sin WebGL 2 no se
  puede apagar.
- **WebGL 1** (GPU viejas, como las Mali-400 de muchos teléfonos de 1 GB): LÖVE no dejaba dibujar en
  lienzos RGBA8 (WebGL 1 no anuncia `OES_rgb8_rgba8` aunque siempre lo permite) y reservaba mipmaps
  en texturas que no son potencia de dos, cosa que WebGL 1 no hace. Ahora va sin mipmaps y en modo
  liviano. Probado con Chromium sin WebGL 2: menú, partida y una mano jugada.
- **El sonido largo.** El ambiente y los dos sonidos de la intro (de 23 a 38 s) se cargaban enteros;
  ahora se leen mientras suenan.

## Rendimiento

El registro de un teléfono con Adreno 610 jugando: 16 a 20 ms de lógica y 13 a 23 ms de dibujo por
cuadro, unos 25 cuadros/s; el dueño, en un Poco X8 Pro, "se súper lagueaba". Con el perfil de CPU de
Chrome (jugando una mano) y uno del Lua del juego:

- **Las esperas a la GPU.** La mitad de todo el trabajo del hilo de la página era `getError`: Balatro
  crea y cambia textos en cada cuadro (los números que se animan), cada texto nuevo es un búfer de
  vértices, y LÖVE preguntaba dos veces si hubo error. En WebGL eso espera a que la GPU termine todo
  lo pendiente. Sin esas preguntas (`motor/parchar.py`, `rendimiento()`), la lógica por cuadro bajó de
  12–18 ms a unos 5 en la misma mano.
- **Los vértices.** En GLES (Android) LÖVE pasa los vértices desde la memoria del programa; WebGL no
  puede, y Emscripten lo imitaba subiendo cada atributo por separado en cada llamada de dibujo. Ahora
  van a un búfer de la GPU (`vertices()`) y el motor se compila sin esa imitación (`FULL_ES3`): la
  parte de WebGL de cada cuadro, a la mitad.
- **60 por segundo como máximo** (como el juego en el teléfono): en pantallas de 120 Hz el navegador
  pedía un cuadro cada 8 ms, el juego no llegaba y salían desparejos (el Poco daba 67/s en el menú).
- **La lógica a 30, la imagen a 60, interpolada** ([`juego/porteo_bucle.lua`](juego/porteo_bucle.lua)).
  Por cuadro, la lógica del juego (`G:update`: eventos, el mando, mover y actualizar ~470 objetos)
  cuesta más que el dibujo, y en un teléfono las dos juntas no entraban en 16,7 ms. En el modo
  interpolado el cuadro sólo dibuja, y la lógica corre un cuadro sí y uno no, con el doble de tiempo,
  en una tarea que la página lanza apenas termina el cuadro (`porteo_llamar`): si se pasa de los
  16,7 ms se come el tiempo libre del cuadro siguiente, que sólo dibuja, en vez de demorar uno ya
  listo. El cuadro que sigue a la lógica dibuja todo a mitad de camino entre lo de antes y lo de
  ahora (de cada objeto lo visible, `VT`: posición, tamaño, giro y escala; y los relojes de los
  shaders); el otro, lo de ahora. Guardar lo de antes de ~470 objetos cuesta 0,2 ms; la lógica, 5.
  Con el procesador frenado 3 veces, la misma mano: 22 % menos de trabajo para los mismos cuadros.
  El modo se elige solo, midiendo: normal (como el juego) si sobra o si lo que frena es la GPU (con
  la lógica por debajo de ~21 pasos por segundo los resortes que mueven las cartas tiemblan);
  interpolado si frena el procesador; a 30 parejos si ni interpolando pasaría de ~45.
- **Un toque rápido entero en una vuelta.** El juego deja el apoyar en cola hasta su lógica y
  atiende el soltar en el acto: si llegan juntos suelta antes de apoyar y el toque se pierde. Pasaba
  en el bucle original con pocos cuadros, y con la lógica a 30 más seguido; ahora ese soltar va a la
  vuelta siguiente.
- El juego escribía "LONG DT" en la consola en cada cuadro lento; ya no.
- Lo que queda es el Lua del juego (mover cartas, la interfaz, ver qué toca el dedo), sin JIT: el
  Lua 5.1 de la web es 2 a 3 veces más lento que el LuaJIT del teléfono. Compilar Lua en un solo
  archivo (para que la búsqueda en tablas, lo más caro, se meta en el intérprete) no cambió nada.

## En Rezona

Rezona muestra cada juego en `<iframe src=… sandbox="allow-scripts allow-same-origin
allow-pointer-lock allow-modals" allow="autoplay; fullscreen; clipboard-write; gamepad">` (de su
código). Con `allow-same-origin` las partidas se guardan (IndexedDB). Encima pone su pantalla de
"cargando" hasta que el juego avisa `game:ready` por `postMessage`, o 2,5 s después del `load` del
cuadro: con el .html único eso era después de bajar los 9 MB, y la intro se pasaba tapada. La
página avisa apenas arranca, así se ven la intro y la carga con lo que falta.

Rezona lee el .html como texto (lo confirmó el dueño). El primero, en UTF-16 (8,7 MB), así no
arrancaba: no es UTF-8 válido. Ahora va con `un-archivo.py --texto`: ASCII imprimible de punta a
punta, los datos en basE91, sin caracteres de control ni nada que un arreglo de texto toque; si
alguien le mete saltos de línea a los datos, se ignoran. Probado con una página que imita a Rezona:
el cuadro con su `sandbox` y su pantalla de carga, con el .html cargado por dirección, por `srcdoc` y
por `blob:` (estos dos leído como texto y con un script agregado); en las tres llega al juego con
sonido, y las partidas siguen después de recargar.

## Armarlo

```bash
porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk salida --registro __registro
herramientas/porteo/cloudflare/subir.py salida/sitio --proyecto porteo-balatro --clave … --registro-kv porteo_balatro_registro
# portear.sh también deja salida/Balatro.html: el .html único (un-archivo.py --texto, con el motor
# y el juego al final: la intro aparece mientras se lee el resto)
```

| archivo | qué es |
|---|---|
| `portear.sh` | del APK al sitio: compila el motor (si falta) y empaqueta |
| `motor/compilar.sh` | baja love.js en commits fijos, aplica `parchar.py`, compila con Emscripten |
| `motor/parchar.py` | los cambios a LÖVE y a Lua 5.1 (ver arriba) |
| `motor/persistencia.js` | las partidas en IndexedDB (reemplaza la de love.js, que guardaba sólo al cerrar) |
| `empaquetar.py` | APK + motor → sitio (archivos con hash en `b/`, la página, manifest e íconos); recodifica el sonido y las texturas (necesita ffmpeg y optipng) |
| `juego/*.lua` | la capa del navegador; el main.lua y conf.lua del juego pasan a `balatro_*.lua` |

Para medir el costo de cada cuadro: `index.html?medir` (cada 5 s en la consola y el registro).

## Lo que falta

- El orden de `pairs()` es distinto en Lua 5.1 que en LuaJIT. Balatro ordena las tablas antes de
  elegir al azar, así que no debería cambiar las partidas por semilla, pero no está comparado
  jugando.

El juego, sus cartas, imágenes y sonidos son de LocalThunk y Playstack: nada de eso entra al repo
(sólo las recetas, los parches y las herramientas).
