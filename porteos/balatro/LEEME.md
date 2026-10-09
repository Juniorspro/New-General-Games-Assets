# Balatro (Android) → navegador

La versión de Android de Balatro (LocalThunk, Playstack) corriendo en el navegador del teléfono: su
código Lua y sus recursos tal cual, sobre LÖVE compilado para la web acá ([`motor/`](motor)), con
una capa chica que pone lo que la versión de Android tiene en su LÖVE propio y en LuaJIT
([`juego/`](juego)).

**Estado:** arranca, el menú, el tutorial, elegir ciega, repartir y jugar manos andan con toques,
en vertical (girado 90°) y en horizontal, también adentro de otra página (Rezona). Guarda la
partida y el perfil (IndexedDB). El sonido arranca con el primer toque. Empieza con la intro de
JXStudios. Todo entra en 9 MB, música incluida, y también va como un solo .html de 9,6 MB. En el
teléfono del dueño: 67 cuadros/s (lógica 4,8 ms y dibujo 3,7 ms por cuadro).

## Cómo es

- **El motor.** LÖVE 11.4 de love.js (Davidobot, ramas emscripten) con un Emscripten de 2026
  ([`motor/parchar.py`](motor/parchar.py), [`motor/compilar.sh`](motor/compilar.sh)):
  - sin hilos: el juego corre adentro de otras páginas, donde no hay SharedArrayBuffer;
  - WebGL 2: Balatro pide mipmaps en texturas que no son potencia de dos;
  - excepciones nativas de WebAssembly: con las emuladas, cada llamada a la API de LÖVE (un
    try/catch) pasaba por JavaScript;
  - texturas sin glTexStorage (como en Android) y las de las fuentes como LUMINANCE_ALPHA: con GLES 3
    LÖVE usa swizzle, que WebGL no tiene;
  - sin MP3.
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
  - los efectos de sonido se decodifican una vez y se clonan;
  - sólo texturas 2x: cuando el juego pide una 1x (con el suavizado de píxeles apagado) recibe la
    2x con el doble de `dpiscale`, que mide lo mismo.
- **El arranque** ([`juego/porteo_despues.lua`](juego/porteo_despues.lua)):
  - un cartel de error que no cuelga la pestaña;
  - el idioma del navegador la primera vez;
  - fuera de la lista los idiomas sin fuente;
  - la medición de cada cuadro, que va al registro.
- **La página** ([`pagina/index.html`](pagina/index.html)): la intro de JXStudios y después la
  pantalla de carga con el Joker, horizontal siempre (en vertical, girado), la caché, el registro y
  las partidas en IndexedDB, que se guardan cada 4 s y al esconderse la página. Como un solo .html
  ([`un-archivo.py`](../../herramientas/porteo/un-archivo.py)) toma los archivos de la página misma.

## Lo que baja

| qué | MB | |
|---|---|---|
| motor (love.js + love.wasm) | 4,8 | Cloudflare lo manda comprimido: 1,7 |
| juego (`balatro.love`) | 7,1 | todo: código, imágenes, fuentes, efectos, ambiente y los cinco temas |
| el .html único | 9,6 | lo mismo en un archivo (el motor con gzip), en UTF-8 (ver "En Rezona") |

`balatro.love` por dentro: música 3,7 MB, texturas 1,4, efectos 0,8, ambiente 0,6, código 0,3,
textos 0,2. El APK pesa 66 MB (104 descomprimido). Fuera de la versión web, o más chico:

- las fuentes china, japonesa, coreana, rusa y Go Noto (62 MB), con los textos de esos idiomas;
- el sonido, en Vorbis mono: música y ambiente a calidad -1 (32 kb/s, corta en 13,9 kHz), efectos
  a 0 (48 kb/s). De 17,5 MB a 5,1. En el parlante de un teléfono no se nota;
- las texturas 1x (1,7 MB: son las 2x a la mitad) y las 2x de los logos, que el juego no usa; el
  resto, recomprimidas sin pérdida con optipng (los mismos píxeles, 25% menos);
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

## En Rezona

Rezona muestra cada juego en `<iframe src=… sandbox="allow-scripts allow-same-origin
allow-pointer-lock allow-modals" allow="autoplay; fullscreen; clipboard-write; gamepad">` (de su
código). Con `allow-same-origin` las partidas se guardan (IndexedDB). Encima pone su pantalla de
"cargando" hasta que el juego avisa `game:ready` por `postMessage`, o 2,5 s después del `load` del
cuadro: con el .html único eso era después de bajar los 9 MB, y la intro se pasaba tapada. La
página avisa apenas arranca, así se ven la intro y la carga con lo que falta.

El .html único va en UTF-8 (`un-archivo.py --utf8`, 7 bits por carácter): si la plataforma lo lee
como texto (para meterle un script, guardarlo o pasarlo a `srcdoc`) sigue andando. El de UTF-16
(8,7 MB) leído así no arrancaba. Probado con una página que imita a Rezona: el cuadro con su
`sandbox`, su pantalla de carga, cargado por dirección, por `srcdoc` y por `blob:` con un script
agregado; en las tres llega al menú con sonido, y las partidas siguen después de recargar.

## Armarlo

```bash
porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk salida --registro __registro
herramientas/porteo/cloudflare/subir.py salida/sitio --proyecto porteo-balatro --clave … --registro-kv porteo_balatro_registro
# portear.sh también deja salida/Balatro.html: el .html único (un-archivo.py --utf8, con el motor
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
