# Counter-Strike 1.6 (la copia "CS 1.6 dani vizcarra LOQUENDO") → móvil

CS 1.6 corre en el navegador y en un APK **con la lógica de CS y los datos de la
copia del dueño** (con su parche de idioma: textos y voces en castellano). No se
rehízo nada a mano:

- el motor es [Xash3D FWGS](https://github.com/FWGS/xash3d-fwgs) (GPL-3.0), una
  reimplementación abierta de GoldSrc;
- el cliente y el menú son [cs16-client](https://github.com/Velaron/cs16-client), y el
  servidor con los bots (ZBot) es ReGameDLL_CS (MIT), que viene adentro;
- todo compilado a WebAssembly con Emscripten 6.0.11, con los parches de `parches/`.

El juego no está en el repo (es público): `portear.sh` lo arma desde el `.rar` del dueño.

| archivo | qué es |
|---|---|
| `portear.sh` | del `.rar` (o la carpeta con `valve/` y `cstrike/`) a la entrega: web instalable, zip y APK |
| `parches/*.patch` | lo que se les cambia a Xash3D, a cs16-client y a sus submódulos (ver abajo) |
| `armar-datos.py` | parte los datos en paquetes que se bajan cuando hacen falta (menú, partidas, cada mapa) |
| `relevamiento.json` | qué archivos abrió el motor en el menú, en una partida y en cada uno de los 31 mapas (sólo nombres) |
| `index.html` | la carcasa web: intro de la marca, descarga con progreso, mapas al elegirlos, guardado, teclado del teléfono |
| `controles.js` | los controles táctiles, al estilo de Standoff 2 / Blood Strike |
| `mainui_castellano.txt` | las frases del menú de esta versión que el castellano del juego no trae (lo nuestro) |
| `prueba.mjs` | la lista de PORTEO.md §9 con dedos de verdad (CDP), midiendo el estado del juego (60 puntos) |

```bash
porteos/cs16/portear.sh "CS 1.6 dani vizcarra LOQUENDO.rar" entrega-cs16
python3 -m http.server 8851 --bind 127.0.0.1 --directory entrega-cs16 &
node porteos/cs16/prueba.mjs http://127.0.0.1:8851/cs16/ entrega-cs16/cs16.apk file://$PWD/entrega-cs16/cs16.html

# publicarlo (Cloudflare Pages, proyecto porteo-cs16 → https://porteo-cs16.pages.dev)
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-claude) CLOUDFLARE_ACCOUNT_ID=$(cat /root/.cloudflare-cuenta)
npx wrangler@4 pages deploy entrega-cs16/cs16 --project-name porteo-cs16 --branch main
node porteos/cs16/prueba.mjs https://porteo-cs16.pages.dev/
```

Pages no sube archivos de más de 25 MiB: por eso los paquetes van en partes de hasta 20 MiB
(lo común a las partidas son 5). Y no comprime `application/octet-stream`: los módulos del
motor (`.so` de Emscripten, que son WebAssembly) van como `.wasm`, y viajan con brotli.

La primera vez baja Emscripten (~1 GB) y los fuentes en los commits fijados, y compila;
queda en `~/.porteo/cs16` (o `$CS16_TRABAJO`). Con Emscripten ya instalado, todo (clonar,
parchear, compilar, armar los datos, el `.html` único, la PWA, el zip y el APK) tarda ~6 min.

Entrega: `cs16/` (la web instalable), `cs16-web.zip`, `cs16.apk` y `cs16.html` (un solo
archivo con 4 mapas: de_dust2, cs_assault, fy_iceworld y awp_map; el juego entero son 171 MB.
Otros mapas: `UN_ARCHIVO_MAPAS=de_dust2,de_inferno portear.sh …`).

## Cómo carga (171 MB en vez de 503)

El juego instalado pesa 503 MB. Se sube lo que CS usa, en paquetes `.pk3` (zip que el
motor monta solo) que viajan con gzip y el navegador abre con `DecompressionStream`:

| paquete | cuándo se baja | tamaño |
|---|---|---|
| motor (`motor/`) | con la intro | 9,6 MB (3,9 por la red, con brotli) |
| menú (`menu-*.pk3.gz`) y los `.wad` del sistema (`wads/`) | con la intro, mientras compila el motor | 4,1 MB |
| lo común a las partidas (`base-*`, en 6 partes): sonidos, modelos, sprites | mientras se mira el menú | 53 MB |
| cada mapa (`mapas/*`) | al elegirlo (y el siguiente de la rotación, mientras se juega) | 0,4 a 9,6 MB |

- El motor anda a los ~1,5 s (en la máquina de pruebas, con el servidor local); el menú
  se puede tocar apenas termina la intro. de_dust2 se baja y carga en ~6 s.
- **Los `.wad` del sistema van sueltos** (`decals`, `cached`, `gfx`, `fonts`, `spraypaint`):
  el motor sólo monta `.wad` sueltos, al arrancar, y ahí registra las calcomanías (balazos,
  sangre, sprays). Adentro de un `.pk3` no las encontraba.
- Lo que el motor abre al arrancar (según `relevamiento.json`) va con el menú aunque "sea de
  las partidas": `sound/sentences.txt` se lee una sola vez, y sin él la radio y los bots
  quedaban mudos.
- **Mapas al elegirlos:** antes de cargar un mapa el motor le pregunta a la página si
  están sus datos (`Porteo_MapaListo`, en `map` y en `changelevel`). Si no, la página los
  baja con una barra, hace `fs_rescan` y repite el comando. La lista de Crear partida
  muestra los 31 mapas aunque no estén bajados (`porteo_mapas.lst`).
- **Texturas:** cada mapa nombra varios `.wad` (halflife.wad pesa 37 MB) y usa pocas
  texturas de cada uno. `armar-datos.py` arma `porteo_<mapa>.wad` con exactamente las
  que usa, en el orden en que las busca el motor, y `maps/<mapa>.ent` (el parche de
  entidades que lee Xash3D) apunta a ese archivo.
- Instalable (`pwa.py`): el motor y el menú se guardan en la primera visita; el resto,
  la primera vez que se usa. Un mapa ya jugado anda sin internet.
- Lo que el juego escribe (`config.cfg`: nombre, sensibilidad, video; `settings.scr`:
  las opciones de Crear partida) vive en IndexedDB.

## Los controles

Como Standoff 2 / Blood Strike, todo en HTML encima del juego (`controles.js`), que le
habla al motor con funciones del parche (`Porteo_Mover`, `Porteo_Mirar`, `Porteo_Comando`):

- **izquierda:** joystick que aparece donde se apoya el pulgar (camina más lento si se
  inclina poco);
- **derecha:** arrastrar para mirar; el botón de disparo grande también apunta mientras
  se arrastra; otro disparo chico a la izquierda;
- saltar, agacharse (queda agachado hasta tocarlo de nuevo), recargar, mira/secundario,
  usar;
- abajo, las armas 1 a 5 (cambia al tocar) y tirar el arma; arriba, comprar, equipo,
  radio (con las órdenes en castellano), la tabla de puntos, ajustes (sensibilidad,
  opacidad, disparo a la izquierda, agacharse fijo) y pausa;
- sólo se ven jugando: en los menús del juego (equipo, clase, compra) se toca el juego
  directamente; con teclado o mouse se esconden solos;
- atrás de Android: cierra el menú abierto o abre el del juego; dos seguidos salen;
- cuando el juego pide texto (el nombre, la contraseña), sale el teclado del teléfono.

## Por qué hicieron falta parches

**Xash3D FWGS** (`xash3d-fwgs*.patch`):

1. La plataforma `emscripten` (en `build.h`, `buildenums.h` y `library_suffix`, en el
   motor y en sus copias de los submódulos), el `wasm32` en waf, y los `.so` como
   `SIDE_MODULE` que el motor abre con `dlopen` (la página los precompila antes).
2. El bucle por `emscripten_set_main_loop` (sin Asyncify) y sin dormir entre cuadros.
3. WebGL2: el shim de GL2 en modo "VAO obligatorio" y sin `glMapBuffer` (con lo de
   fábrica, disparar tiraba "must use array buffers when using element buffer").
4. Ventana y no pantalla completa de SDL: la pantalla completa la pide la página (con la
   de SDL el lienzo tapaba los controles).
5. Las funciones para la página: mirar, moverse, comandos, texto y teclas del teclado del
   teléfono, y `Porteo_Estado()` (posición, ángulos, arma, animación, jugadores, nombre,
   a dónde van las teclas) para que las pruebas midan en vez de mirar que no haya
   errores. La mirada se divide por `sensitivity`, porque el cliente la vuelve a
   multiplicar.
6. Los mapas al elegirlos (`sv_cmds.c`, `sv_game.c`, `con_utils.c`, ver arriba).

**cs16-client** (`cs16-client*.patch`):

7. Compilar para emscripten: sin `--no-undefined`, `dlfcn.h`, sin yapb (bots de otro
   proyecto, que baja un grafo de internet al compilar: los bots son los de ReGameDLL) y
   la plataforma en ReGameDLL.
8. Un error de cs16-client: `GL_PROJECTION_MATRIX` estaba definido como `0x0BA1`
   (`GL_NORMALIZE`); en WebGL tiraba `INVALID_ENUM` en cada cuadro.
9. `-fvisibility=hidden` (en `portear.sh`): en WebAssembly los módulos comparten los
   nombres globales y el servidor leía el `gpGlobals` del cliente; cada modelo salía con
   el nombre de otro.
10. El menú principal de la web es el del `GameMenu.res` de la copia (Continuar,
    Desconectar, Nueva Partida, Opciones) más Personalizar, sin lo que en un navegador
    no anda: salir (una pestaña no se cierra), buscar servidores (no hay UDP) y cargar
    partida (CS no guarda partidas). "Nueva Partida" abre Crear partida.
11. Escape (y el atrás del teléfono) cierra el menú de compra o de equipos, como en el
    original (`TeamFortressViewport::KeyInput`), en vez de abrir el menú del juego encima.

## Lo que se cambió en los datos (y por qué)

- `btns_main.bmp` y `head_*.tga` del `extras.pk3` del motor (botones dibujados con
  texto en inglés): sin ellos el menú escribe los textos del castellano del juego.
- `mainui_castellano.txt` → `resource/mainui_english.txt`: las ~290 frases del menú de
  esta versión que el castellano del juego no trae (o dejó en inglés).
- `settings.scr` con las opciones de bots en "Opciones avanzadas" de Crear partida
  (cantidad: 9, dificultad, equipo, radio, francotiradores, escudo); el diálogo original
  las tenía en su propia pestaña.
- `porteo.cfg` (en cada arranque): cambiar de arma al tocar el número, menús del juego
  que se tocan, sin micrófono, sin los controles táctiles del motor y sin el mensaje del
  día (el del juego es HTML, que cs16-client mostraba como código encima del menú de
  equipos).
- `liblist.gam` sin `trainmap`: la copia no trae el entrenamiento.

## Problemas conocidos

- El menú del juego es el de cs16-client a escala del alto de la pantalla: en un
  teléfono los botones del menú quedan de ~21 px de alto (se tocan bien con la yema,
  pero son chicos). Los controles de juego sí son grandes.
- Sin juego en red: el navegador no tiene UDP. Se juega contra bots.
- No se probó en un teléfono de verdad (acá no hay emulador de Android): el mismo HTML
  del APK se probó en Chromium móvil, acostado, parado y en pantalla chica.
