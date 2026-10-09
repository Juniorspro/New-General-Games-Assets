# Balatro (Android) → navegador

La versión de Android de Balatro (LocalThunk, Playstack) corriendo en el navegador del teléfono: su
código Lua y sus recursos tal cual, sobre LÖVE compilado para la web acá ([`motor/`](motor)), con
una capa chica que pone lo que la versión de Android tiene en su LÖVE propio y en LuaJIT
([`juego/`](juego)).

**Estado:** arranca, el menú, el tutorial, elegir ciega, repartir y jugar manos andan con toques,
en vertical (girado 90°) y en horizontal, también adentro de otra página (Rezona). Guarda la
partida y el perfil (IndexedDB). El sonido arranca con el primer toque. Falta jugarlo largo en un
teléfono de verdad (rendimiento: ver "Lo que falta").

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
  - los efectos de sonido se decodifican una vez y se clonan.
- **El arranque** ([`juego/porteo_despues.lua`](juego/porteo_despues.lua)):
  - un cartel de error que no cuelga la pestaña;
  - el idioma del navegador la primera vez;
  - fuera de la lista los idiomas sin fuente;
  - la medición de cada cuadro, que va al registro.
- **La página** ([`pagina/index.html`](pagina/index.html)): la pantalla de carga con el Joker,
  horizontal siempre (en vertical, girado), la caché, el registro y las partidas en IndexedDB, que
  se guardan cada 4 s y al esconderse la página.

## Lo que baja

| qué | MB | cuándo |
|---|---|---|
| motor (love.js + love.wasm) | 4,8 | al abrir (Cloudflare lo comprime) |
| juego (`balatro.love`: código, imágenes, efectos, fuentes y el tema del menú) | 10,0 | al abrir |
| los otros 4 temas y el ambiente (8 OGG) | 12,7 | después de arrancar, de a tres; quedan en IndexedDB |

El APK pesa 66 MB (104 descomprimido). Fuera de la versión web:

- las fuentes china, japonesa, coreana y Go Noto: 61 MB, para cuatro idiomas que salen de la lista;
- lo de Android (dexopt, info.txt).

Los cinco temas son capas de la misma canción que suenan juntas (el juego sube el volumen de la que
corresponde: menú, tienda, sobres, jefe). El del menú viene adentro. Mientras bajan los otros suenan
silencios con el mismo nombre, y cada uno que llega reemplaza a su silencio en el mismo segundo de la
música que se oye, sin cortarla. Una descarga que no recibe nada en 15 s se corta y se reintenta.

**Primera versión, con dos errores que se vieron en el teléfono del dueño:**

- Toda la música bajaba por detrás, de a un archivo, sin vigilar si se frenaba. El registro mostró
  que nunca terminaba, y no sonaba ningún tema.
- Con Emscripten 6, el `--post-js` corre después de que el módulo ya arrancó, así que el juego
  empezaba antes de que llegaran las partidas de IndexedDB. Ahora la página espera
  `Module.porteoPartidas`, y no se escribe nada en IndexedDB hasta que la carga inicial terminó:
  escribir antes borraba allá lo que todavía no estaba acá.

## Armarlo

```bash
porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk salida --registro __registro
herramientas/porteo/cloudflare/subir.py salida/sitio --proyecto porteo-balatro --clave … --registro-kv porteo_balatro_registro
```

| archivo | qué es |
|---|---|
| `portear.sh` | del APK al sitio: compila el motor (si falta) y empaqueta |
| `motor/compilar.sh` | baja love.js en commits fijos, aplica `parchar.py`, compila con Emscripten |
| `motor/parchar.py` | los cambios a LÖVE y a Lua 5.1 (ver arriba) |
| `motor/persistencia.js` | las partidas en IndexedDB (reemplaza la de love.js, que guardaba sólo al cerrar) |
| `empaquetar.py` | APK + motor → sitio (archivos con hash en `b/`, la página, manifest e íconos) |
| `juego/*.lua` | la capa del navegador; el main.lua y conf.lua del juego pasan a `balatro_*.lua` |

Para medir el costo de cada cuadro: `index.html?medir` (cada 5 s en la consola y el registro).

## Lo que falta

- Rendimiento en el teléfono. En esta máquina (CPU de servidor, WebAssembly) la lógica va de 1 a
  9 ms por cuadro y el dibujo de 1 a 4. Sin el JIT de LuaJIT, en un teléfono puede ser 2–3 veces
  más. El registro lo va a decir con la primera partida del dueño.
- El orden de `pairs()` es distinto en Lua 5.1 que en LuaJIT. Balatro ordena las tablas antes de
  elegir al azar, así que no debería cambiar las partidas por semilla, pero no está comparado
  jugando.

El juego, sus cartas, imágenes y sonidos son de LocalThunk y Playstack: nada de eso entra al repo
(sólo las recetas, los parches y las herramientas).
