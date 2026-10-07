# Just Shoot → un solo HTML (07/10)

Pidió <https://gamejolt.com/games/just-shoot/37700> (gratis, de Error Panic: Memorix101 y MegaZell). Hay tres
paquetes: Remix 2020 (mod de Sauerbraten sobre Tesseract, C++), Classic 2018 (Sauerbraten, `js.exe`) y una **demo
web 2016 hecha por ellos con BananaBread** (Cube 2 compilado con Emscripten, asm.js + WebGL 1). Se porteó esa:
`salida/justshoot.html` de 22,4 MB. Código en `ports/justshoot/` (sin el motor ni los datos).

## Lo que hay que saber

- **Bajar de GameJolt**: `POST /site-api/web/discover/games/builds/get-download-url/<build>` → `payload.url`. Las
  de tipo html dan un token: `GET https://gamejolt.net/site-api/gameserver/<token>` → `payload.url` (index.html);
  los demás archivos están al lado (`game.html?five,five`, `bb.js`, `bb.js.mem`, `game/*.js`, `*.data`, `assets/`).
- **La demo exige DXT y pointer lock** (`game-setup.js` falla sin eso): en el celu no hay. Los `.cfg` piden
  `<dds>ruta.png`: sin DXT el motor carga el `.png`, que eran miniaturas de 64 px → la DDS convertida va **con el
  nombre .png** (JPG adentro si no hay transparencia: el navegador lo reconoce igual).
- **file_packager de Emscripten**: `preload_X.js` tiene `new DataRequest(ini, fin, 0, audio).open('GET', ruta)` por
  archivo; se rearma cambiando esa lista, los `FS_createPath`, los `onload` y `REMOTE_PACKAGE_SIZE`.
- **Los `preRun` de Emscripten corren al revés** (`addOnPreRun` hace unshift): el plugin que descomprime el `.ogz`
  se registra al cargar, no en un preRun, o el mapa entra comprimido ("malformatted header").
- Los ganchos del motor son EM_ASM dentro de `bb.js.mem`: `Module['postLoadWorld']()`, `loadDefaultMap`,
  `setPlayerModels`, `desiredWidth/Height` (resolución de dibujo). `SDL` y `Browser` son globales.
- **Controles de dedo**: teclas con `keyCode` pisado (`defineProperty`) en `document`; mirar = `mousemove` con
  `movementX` al canvas con `Browser.pointerLock = true`.
- **Traducir el motor**: las cadenas de C se pisan en `HEAPU8` (sin pasarse del largo, ASCII) y el menú principal
  se rehace con `newgui main [...]`. Queda en inglés: la tabla (frags/name) y el menú de opciones.
