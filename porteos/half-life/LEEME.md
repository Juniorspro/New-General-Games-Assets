# Half-Life (las copias "Half_Life_1_(Justhin)" y "Half-Life") → móvil, en español latino o en inglés

Half-Life corre en el navegador y en un APK **con la lógica del juego y los datos de las copias
del dueño**: la inglesa ("Justhin") y la que trae el doblaje y los textos en español latino. Se
elige el idioma en el menú principal. Es la misma base del porteo de CS 1.6 (`../cs16`): el
mismo motor con sus parches, más los de acá. No se rehízo nada a mano:

- el motor es [Xash3D FWGS](https://github.com/FWGS/xash3d-fwgs) (GPL-3.0), una
  reimplementación abierta de GoldSrc, con su menú (mainui);
- la lógica del juego (cliente y servidor) es [hlsdk-portable](https://github.com/FWGS/hlsdk-portable);
- todo compilado a WebAssembly con Emscripten 6.0.11, con los parches de `../cs16/parches` y de `parches/`.

El juego no está en el repo (es público): `portear.sh` lo arma desde los dos `.rar` del dueño.

| archivo | qué es |
|---|---|
| `portear.sh` | de los dos `.rar` (o carpetas con `valve/`) a la entrega: web instalable, zip, APK y `.html` único |
| `parches/*.patch` | lo que se les cambia a Xash3D, a su menú y a hlsdk-portable, encima de los parches de CS (ver abajo) |
| `armar-datos.py` | parte los datos en paquetes que se bajan cuando hacen falta (menú, cada capítulo, cada nivel, voces, música) |
| `relevamiento.json` | qué archivos abrió el motor en el menú, en una partida y en cada uno de los 103 niveles (sólo nombres) |
| `index.html` | la carcasa web: intro de la marca, idioma, niveles que se bajan cuando hacen falta, partidas guardadas, teclado del teléfono |
| `controles.js` | los controles táctiles, como los de CS (al estilo de Standoff 2 / Blood Strike), en el idioma elegido |
| `mainui_spanish.txt` | las ~280 frases del menú de Xash que el español del juego no trae (lo nuestro) |
| `jugar-half-life.html` | 3 KB que abren el juego publicado (directo, o adentro de una plataforma que lo muestre en un cuadro) |
| `prueba.mjs` | la lista de PORTEO.md §9 con dedos de verdad (CDP), midiendo el estado del juego |

```bash
porteos/half-life/portear.sh Half_Life_1_\(Justhin\).rar Half-Life.rar entrega-half-life
python3 -m http.server 8861 --bind 127.0.0.1 --directory entrega-half-life &
node porteos/half-life/prueba.mjs http://127.0.0.1:8861/half-life/ entrega-half-life/half-life.apk file://$PWD/entrega-half-life/half-life.html

# publicarlo (Cloudflare Pages, proyecto porteo-half-life → https://porteo-half-life.pages.dev),
# sólo si el dueño lo pide: una dirección pública es redistribuir el juego (PORTEO.md §11)
export CLOUDFLARE_API_TOKEN=$(cat /root/.cloudflare-claude) CLOUDFLARE_ACCOUNT_ID=$(cat /root/.cloudflare-cuenta)
npx wrangler@4 pages deploy entrega-half-life/half-life --project-name porteo-half-life --branch main
node porteos/half-life/prueba.mjs https://porteo-half-life.pages.dev/
```

La primera vez baja los fuentes en los commits fijados y compila (Emscripten se comparte con el
porteo de CS); queda en `~/.porteo/half-life` (o `$HL_TRABAJO`), con los sonidos ya pasados a
Opus. Hace falta `unrar` (los `.rar` son RAR5: `unar` no los abre) y `ffmpeg` (con libopus).

Entrega: `half-life/` (la web instalable), `half-life-web.zip`, `half-life.apk`, `half-life.html`
(un solo archivo con los primeros capítulos: la llegada en tren, Materiales Anómalos y el
entrenamiento; otros: `UN_ARCHIVO_CAPITULOS=c0a0,c1a0,c1a1 portear.sh …`) y `jugar-half-life.html`.

## Las dos copias y el idioma

Las dos son Half-Life de Steam con la actualización del 25 aniversario. Comparadas archivo por
archivo, la española tiene 1.100 que cambian: las voces dobladas (científicos, guardias,
soldados, el G-Man, el holograma del entrenamiento, el anuncio del tren, el Nihilanth), 480
frases enteras nuevas en `sound/sentences/` (el doblaje dice frases completas donde el inglés las
arma palabra por palabra), `sentences.txt`, `titles.txt`, los textos del menú y los `.wad` con
letras. `portear.sh` deja la inglesa en `valve/` y lo que cambia en `valve_spanish/`: así monta
Xash un idioma (`-language spanish`). Xash busca esa carpeta sólo en la escribible: la página
escribe los paquetes del español en `/rwdir/valve_spanish`.

- El idioma se elige con el botón del menú principal (Español · English); queda guardado y la
  primera vez sale del idioma del teléfono. Cambiarlo recarga la página (sin repetir la intro).
- En inglés el menú es el de siempre (los botones dibujados de `extras.pk3`); en español, sin
  esos dibujos, el menú escribe sus textos: los del juego y los de `mainui_spanish.txt`.
- Los controles táctiles y los carteles de la página van en el idioma elegido.

## Cómo carga (168 MB para los dos idiomas)

Cada copia instalada pesa ~520 MB (`valve/`). Se sube lo que el juego usa, en paquetes `.pk3`
(zip que el motor monta solo) que viajan con gzip y el navegador abre con `DecompressionStream`:

| paquete | cuándo se baja | tamaño |
|---|---|---|
| motor (`motor/`) | con la intro | 9,5 MB (unos 4 por la red, con brotli) |
| menú (`menu-valve`), los `.wad` del sistema y los textos del idioma | con la intro, mientras compila el motor | 1,4 MB |
| lo del primer nivel: lo de todas las partidas (`base-valve`, `sonidos-valve`), lo del capítulo (`comun/c0a0`), el nivel y sus frases | mientras se mira el menú | 14 MB |
| la charla de los personajes (`voces-en` 3,6 MB, `voces-es` 8,3 MB) | de fondo, en el viaje en tren | |
| lo de cada capítulo (`comun/<capítulo>`): modelos, sonidos y texturas que comparten sus niveles | con su primer nivel | 0,2 a 7 MB |
| cada nivel (`mapas/<nivel>`), con sus frases con guion en el idioma (`voces-<idioma>/<capítulo>`) | el siguiente, de fondo mientras se juega; si no llegó, al pasar | 0,2 a 1,7 MB |
| la música (`musica/NN`) | con el primer nivel que la pide | 0,9 a 3,1 MB |

- **Niveles cuando hacen falta:** antes de cargar un nivel (partida nueva, entrenamiento,
  partida guardada, el paso al siguiente con su landmark, `map` en la consola) el motor le
  pregunta a la página (`Porteo_Necesita`). Si faltan datos, la página los baja con una barra,
  hace `fs_rescan` y repite el mismo comando. Mientras se juega un nivel se bajan de fondo los
  niveles a los que lleva (los `trigger_changelevel` del `.bsp`), así que casi siempre el paso
  es inmediato. Si se llega antes, **el juego queda en pausa** con el cartel: sin la pausa, el
  jugador sigue adentro del cambio de nivel y el juego lo vuelve a tocar en cada cuadro,
  disparando otra vez lo que dispara (`SUB_UseTargets`, un `CFireAndDie` por cuadro).
- **Por capítulo:** lo que usan varios niveles va con el primer capítulo (en el orden de la
  historia) que lo usa. La primera partida baja 14 MB y no los 60 de "todo lo común".
- **Los sonidos en Opus:** las voces y los sonidos de más de medio segundo (3.500 archivos) van
  en Opus (ffmpeg, 24 kbit/s los de 11 kHz y 32 los de 22 kHz): 97 MB → 30 MB. El juego los sigue
  pidiendo como `.wav`; el motor, si no encuentra el `.wav`, busca el `.opus` del mismo nombre, y
  lo decodifica a 22 kHz. Los que tienen lazo (`cue`/`smpl`) o son de 44 kHz quedan en `.wav`. Un
  sonido y su par del otro idioma van los dos en Opus o los dos en `.wav`: el motor busca primero
  el `.wav` en todas las carpetas, y un `.wav` inglés le ganaría al `.opus` español.
- **Voces que llegan después:** la charla de los personajes (lo que dicen al azar, al pelear, al
  seguirte) se baja de fondo durante el viaje en tren, que no la usa. Si una voz falta cuando el
  juego la pide, el motor (parche) se acuerda y la vuelve a buscar después del próximo
  `fs_rescan`, y al entrar al nivel no la da por faltante: no queda muda el resto del nivel.
- **Texturas:** cada nivel nombra `halflife.wad` (36 MB) y otros, y usa pocas texturas de cada
  uno (algunos niveles de esta versión las traen todas adentro). `armar-datos.py` arma
  `porteo_texturas_<capítulo>.wad` con las que comparten varios niveles y `porteo_<nivel>.wad`
  con las propias, y `maps/<nivel>.ent` (el parche de entidades que lee Xash3D) apunta a esos.
  Xash monta los `.wad` que vienen adentro de un `.pk3`.
- **Animaciones aparte:** la versión 25 aniversario guarda animaciones en `.mdl` aparte
  (`scientist01.mdl` … `scientist07.mdl`) que el motor abre recién cuando un personaje usa una
  de esas animaciones; si falta, "Host Error: LoadCacheFile: can't load". `armar-datos.py` lee la
  cabecera de cada modelo y los pone siempre con él.
- **Lo que el relevamiento no ve:** los sonidos que el juego toca sin precargar (el aterrizaje
  de una caída, los casquillos de la escopeta, las frases) van todos, a pedido; y el HUD en alta
  resolución (`sprites/1280`): el teléfono dibuja al doble de píxeles (la página lo limita a 2 por
  píxel y a 2560 de ancho), y con más de 1280×720 el cliente usa esos íconos.
- **El fondo del menú** de esta versión es de 3840×1600 en 105 partes (17 MB): se achica a
  1536×640 (0,6 MB).
- Instalable (`pwa.py --espera`): el motor, el menú y los textos de los dos idiomas se guardan
  en la primera visita; el resto, la primera vez que se usa. Un nivel ya jugado anda sin
  internet. Las versiones nuevas se bajan antes de arrancar (sólo lo que cambió), nunca a mitad
  de una partida (como en CS).
- **El armado es reproducible:** las mismas copias dan los mismos bytes (fecha fija adentro de
  los `.pk3`, Opus sin fecha ni versión, el motor sin rutas ni fecha de compilación).
- Si se llevan muchos niveles en memoria, se sueltan los lejanos (los del capítulo no: los
  comparten los que vienen); si se vuelve a uno, se baja de lo guardado.
- Las partidas guardadas (y `config.cfg`) viven en IndexedDB: guardar rápido, cargar rápido,
  Guardar/Cargar del menú y el guardado automático al pasar de nivel.

## Los controles

Los de CS, adaptados (`controles.js`): joystick a la izquierda, arrastrar para mirar (el disparo
grande también apunta), otro disparo a la izquierda, saltar, agacharse (fijo), recargar, disparo
secundario, usar (puertas, botones, que te siga un científico o un guardia), las armas 1 a 5 y la
anterior abajo, y arriba linterna, guardado rápido, carga rápida, ajustes y pausa.

- **Un toque, un arma:** en Half-Life el cambio rápido (`hud_fastswitch`) sólo funciona si el
  casillero tiene una sola arma; con dos (pistola y Magnum) abre la selección y espera un disparo
  para confirmar. Con el dedo, el cliente (parche) pone en la mano la siguiente arma del
  casillero a cada toque.
- Sólo se ven jugando; con teclado o mouse se esconden solos. Atrás de Android: el menú del
  juego; dos seguidos salen.

## Por qué hicieron falta parches

Encima de los de CS (`../cs16/parches/xash3d-fwgs*.patch`: la plataforma emscripten, el bucle,
WebGL2, las funciones de los controles y del teclado, `Porteo_Estado`):

**Xash3D FWGS** (`xash3d-fwgs-hl.patch`):

1. `Porteo_Necesita` en partida nueva, entrenamiento, cargar partida (lee el nivel de la partida
   con `SV_GetSaveComment`) y el paso de nivel con landmark; una partida guardada en un nivel
   todavía no bajado figura como válida en el menú.
2. La pausa mientras se baja el nivel siguiente (`SV_TogglePause`) y `Porteo_Seguir` para salir
   de ella si la descarga falla.
3. Las voces en Opus: `.opus` por `.wav` (`snd_main.c`) y de 48 a 22 kHz (`s_load.c`).
4. Los sonidos que faltaron se vuelven a buscar después de un `fs_rescan` (`s_load.c`).
5. Al entrar a un nivel, el cliente revisa que estén los sonidos que el nivel precarga y apaga
   para todo el nivel los que no encuentra ("Could not load sound"): buscaba el `.wav`, que de
   los pasados a Opus no existe, y las voces que todavía se están bajando. Ahora vale el `.opus`,
   y jugando en el mismo navegador ningún sonido se da por faltante: el punto 4 lo trae cuando
   llega (`cl_custom.c`).
6. **Guardar por nombre:** la partida guarda las funciones de cada entidad (lo que hace un tren,
   una puerta o un disparador) por nombre, y el motor los saca de `dladdr()`, que en Emscripten
   no sabe nombres: al cargar una partida o volver a un nivel, todo quedaba quieto. En
   WebAssembly un puntero a función es un lugar de la tabla de funciones; el motor busca qué
   exportación del juego está en ese lugar (`lib_posix.c`). Las funciones que se guardan son las
   que el SDK marca `EXPORT`: las 501 que exporta el servidor.

**El menú** (`xash3d-fwgs-mainui-hl.patch`): sin lo que en un navegador no anda (salir,
multijugador, otros juegos, Avances), con el resto corrido para abajo; Escape en el menú principal
no ofrece salir.

**hlsdk-portable** (`hlsdk-portable.patch`): el cambio de arma de un toque (arriba). Y se enlaza
con `-Wl,-Bsymbolic` (`portear.sh`): lo marcado `EXPORT` queda visible para el cargador de
módulos, y sin esa opción cada módulo pedía esas funciones por nombre (`GOT.func`, 229 en el
servidor). El cliente tiene muchas con el mismo nombre, vacías (`cl_dll/hl/hl_baseentity.cpp`),
y el cargador a veces le daba al servidor las del cliente: agarrar un arma o balas fallaba de a
ratos (la entidad se tocaba y no pasaba nada). Con `-Bsymbolic` cada módulo usa las suyas (el
servidor no pide ninguna).

## Lo que se cambió en los datos (y por qué)

- `btns_main.bmp` y `head_*` del `extras.pk3` del motor, sólo en español (texto en inglés
  dibujado).
- `mainui_spanish.txt` → `resource/mainui_spanish.txt` del español: las frases del menú de Xash
  que el juego no trae (usa "mouse" y "control", del español latino). Y "Entrenamiento" en vez de
  "Sala de entrenamiento", que se pisaba con su descripción.
- `porteo.cfg` (en cada arranque): cambio de arma al tocar, sin micrófono, sin los controles
  táctiles del motor, sin callar el sonido si el motor cree que perdió el foco.
- El fondo del menú, achicado; los sonidos, en Opus; las texturas, por capítulo y por nivel.
- Quedan afuera (38 MB): los niveles de multijugador y su contenido, los íconos de 2560, los
  cielos en `.bmp` (se usan los `.tga`), lo de Steam y los diálogos de VGUI2.

## Problemas conocidos

- Sin juego en red: el navegador no tiene UDP. Half-Life es para un jugador.
- Los botones del menú del juego quedan chicos en un teléfono (el menú es de Xash, a escala del
  alto de la pantalla); los controles de juego sí son grandes.
- No se probó en un teléfono de verdad (acá no hay emulador de Android): el mismo HTML del APK se
  probó en Chromium móvil, acostado, parado, en pantalla chica y con la red de un 4G.
