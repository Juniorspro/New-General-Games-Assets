# Minecraft PE 1.2 (Android) → navegador

Minecraft PE 1.2 (el APK "Minecraft-v1.2" que mandó el dueño, la beta 1.2.0.2) jugable en el
navegador del teléfono, en un solo `.html` de 5,5 MB, con **los shaders de Tito Crack 6000** (los del
APK de Craftsman PTGI) como opción al empezar, **servidores** para jugar con otros y **bichos**.

**Estado:** creativo completo para construir, con **las pantallas de la 1.2 de verdad** (las de sus
`ui/*.json`, interpretadas; ver más abajo):

- la primera vez se elige el idioma (English, Español o Português: los textos del juego, en_US,
  es_MX y pt_BR) y después con o sin los shaders de Tito, en carteles de la 1.2; las dos cosas se
  cambian en Ajustes;
- el título con el logo, la frase amarilla, el panorama del río y **el jugador con su skin** (el
  "muñeco de papel", que se gira con el dedo); Jugar con las pestañas Mundos, Amigos y Servidores;
  crear un mundo (nombre, modo, dificultad, semilla, tipo, las reglas del mundo), editarlo o
  borrarlo; los ajustes completos de la 1.2 (Controles, Perfil, Recursos globales, Video, Sonido,
  Idioma; dentro de un mundo también Juego y Multijugador); elegir skin (Steve o Alex, con
  "Reciente"); Cómo se juega con todas sus secciones y los íconos táctiles; la carga y el guardado;
  la pausa con la lista de jugadores; el chat con las **opciones de anfitrión** (hora, clima,
  teletransportarse) y comandos (`/time`, `/weather`, `/gamemode`, `/tp`, `/summon`, `/kill`,
  `/seed`); la muerte; desconectado;
- el inventario creativo con las pestañas de la 1.2 (incluye los bloques nuevos: concreto,
  terracota esmaltada, vidrio teñido, prismarina, purpur...) y los huevos de los bichos;
- **tres mundos públicos fijados** arriba de todo en Jugar (y en Servidores): el mismo mundo para
  todos los que entran; además se pueden agregar servidores con nombre y dirección (la misma
  dirección = el mismo mundo);
- **multijugador** en esos mundos: se ven los otros jugadores (con su skin, Steve o Alex, y su
  nombre arriba), lo que construyen, el chat, se pueden pegar (vida, golpes, muerte y reaparecer) y
  los bichos de cada uno se ven en lo de los demás;
- **todos los bichos de la 1.2** (45: de la gallina al wither y el dragón, con sus variantes:
  profesiones de los aldeanos, colores de las ovejas y los shulkers, pelajes de los caballos, las
  llamas, los conejos, los loros y los gatos, crías) con lo que hacen en el juego, sacado de su
  behavior pack: los animales pastan, huyen, siguen a la madre y a quien tiene su comida; los
  monstruos persiguen, pegan, disparan (flechas, bolas de nieve, de fuego y del wither, pociones de
  la bruja, escupitajos de la llama, balas del shulker), el creeper se infla y explota, el
  enderman se teletransporta y se lleva bloques, el evocador llama colmillos y vexes, el slime se
  parte; los gólems defienden a los aldeanos; los muertos vivos se prenden fuego al sol. Aparecen
  solos según el bioma (de día los animales en el pasto, de noche o en las cuevas los monstruos,
  los calamares en el agua, los murciélagos en las cuevas) y con los huevos del inventario. En
  creativo los monstruos no atacan al jugador (como el juego); en los servidores, donde hay vida,
  sí;
- el mundo infinito con biomas, cuevas, minerales y árboles, día y noche, agua y lava que corren,
  los controles táctiles de MCPE, partículas, los sonidos del juego.

Siempre acostado: con el teléfono parado se gira 90° solo (también adentro de Rezona). Falta la
supervivencia de verdad (minar con herramientas, fabricar, hambre).

## Cómo es

El juego original es `libminecraftpe.so`, código nativo: no corre en un navegador. El motor es el
del port de Craftsman ([`../craftsman`](../craftsman), JavaScript y WebGL), crecido para la 1.2, y
del APK se usa todo lo demás, sin tocar ([`empaquetar.py`](empaquetar.py)):

- **Los shaders:** los de fábrica de la 1.2 (`assets/shaders/glsl`, con sus `#include` resueltos) y,
  como opción, los de Tito, sacados del APK de Craftsman PTGI sin la sombra del personaje (las
  cinco capas, como en aquel port). Los dos juegos tienen los mismos archivos (renderchunk, sky,
  cloud, uv, stars...) y reciben lo mismo; lo único distinto son las nubes: las de Tito son una
  grilla plana a la que su shader da forma, y las de la 1.2 son cajas de 12×4×12 armadas desde
  `clouds.png`, dibujadas en dos pasadas (profundidad y después color) como el juego.
- **Las texturas** de `textures/terrain_texture.json`, en un atlas WebP sin pérdida con 4 px de
  borde repetido por textura (de lejos no se mezclan vecinas). Se ven como en la versión de PC: de
  cerca cada píxel tal cual y de lejos el promedio de los mipmaps. Sin filtro anisotrópico: en
  muchas GPU (y en ANGLE) prenderlo suaviza también lo de cerca aunque se pida NEAREST, y con él el
  pasto, la tierra y el bloque en la mano se veían lavados, "comprimidos". El agua y la lava que
  corren vienen de 32 px y se usa la mitad por bloque, como el juego.
- **Los bloques** de `blocks.json` (forma, texturas por cara y el sonido de cada uno) con su número
  de la 1.2; lo que el juego tiene en código (qué es opaco, cuánta luz da) está en
  [`juego/comun.js`](juego/comun.js).
- **Las pantallas** ([`juego/jui.js`](juego/jui.js), [`juego/pantallas.js`](juego/pantallas.js)):
  la 1.2 arma sus menús con `ui/*.json` (108 espacios: herencia `nombre@espacio.base`, variables con
  condiciones, expresiones, tamaños `100% - 4px`/`100%c`/`fill`, anclas, pilas, grillas,
  desplazables, nineslice, animaciones, bindings y fábricas de carteles) y su código en C++ les
  contesta los datos y los botones. `jui.js` es un intérprete de ese formato que dibuja en el
  canvas 2D con la fuente `default8.png` (y los íconos de `glyph_E0/E1`), y `pantallas.js` hace lo
  que hacía el código del juego: los "controladores" de cada pantalla (qué mundos hay, qué dice
  cada interruptor, qué hace cada botón). [`empaquetar_ui.py`](empaquetar_ui.py) junta los JSON,
  los textos de los tres idiomas y las texturas de `textures/ui` en un atlas. El muñeco del jugador
  ([`juego/muneco.js`](juego/muneco.js)) es el modelo `geometry.humanoid.custom` con la skin,
  cara por cara con transformaciones afines en el mismo canvas.
- **El juego** ([`juego/interfaz.js`](juego/interfaz.js)): la barra, la cruceta y el inventario con
  `gui.png` y los dibujos de `textures/ui`; el logo (a su tamaño, 1936 px, sin pérdida) y el
  panorama del río (las 6 caras de 1080 px en WebP); las frases amarillas.
- **Los bichos** ([`empaquetar_bichos.py`](empaquetar_bichos.py)): los modelos de
  `models/mobs.json` (con la herencia "hijo:padre" resuelta) y sus texturas (de los `.tga`, el
  canal alfa que marca lo que brilla, como los ojos de la araña y del enderman, va a una capa
  aparte); el behavior pack (`behavior_packs/vanilla/entities/*.json`: componentes, grupos de
  componentes, eventos con filtros) tal cual, y los sonidos de `sounds.json`.
  [`juego/conducta.js`](juego/conducta.js) interpreta ese formato como el juego: arma los
  componentes de los grupos activos, corre los eventos (`add`/`remove`, `randomize`, `sequence`,
  filtros como `is_family`, `has_component`, `is_daytime`, `is_biome`), los sensores y las metas
  (`behavior.*`) por prioridad. [`juego/bichos.js`](juego/bichos.js) pone la física (caminar,
  trepar, volar, nadar, saltar), el daño (sol, lava, agua, caída, explosiones), los proyectiles y
  dónde aparecen. [`juego/modelos.js`](juego/modelos.js) arma las cajas con el reparto de textura
  de Minecraft y las animaciones que el juego tiene en código (caminar, mirar, los brazos del zombi,
  el arco del esqueleto, las alas, los tentáculos, el slime que se estira, la cola del lobo...) y
  los tamaños que sus renderers cambian (el ghast ×4,5, el murciélago ×0,35...). Lo que el juego
  hace en C++ y no está en el behavior pack (el tamaño al azar del slime, las variantes del
  caballo, la tabla de aparición por bioma) está escrito en esos archivos.
- **Los sonidos**: los `.fsb` sueltos de la 1.2 (`sounds/sound_definitions.json`), decodificados con
  el decodificador del port de Craftsman, a Opus ([`sonidos12.py`](sonidos12.py)): uno de 400 KB
  con los de siempre (bloques, pasos, el jugador) y uno por bicho, que se trae y decodifica recién
  cuando ese bicho aparece (todos juntos eran 640 s, más de 50 MB de memoria decodificados).

### Los servidores ([`juego/red.js`](juego/red.js))

Sin servidor propio: un "broker" MQTT público (`wss://broker.emqx.io:8084/mqtt`, con mqtt.js 5
cargado aparte y sin frenar nada: sin red el mundo se juega igual, solo). Cada mundo es una sala
(`ROOM = NS + sala`, con un prefijo propio de este port):

- `ROOM/state`: cada jugador manda dónde está, hacia dónde mira, su vida y lo que hace (cada
  ~100 ms y sólo si cambió algo; cada 2 s igual). Los demás lo acercan de a poco (interpolación) y
  lo borran si no lo oyen en 5 s.
- `ROOM/action`: poner y romper bloques, `hit_player` (el golpeado se aplica el daño), entrar,
  salir, morir, golpes a bichos ajenos (se le avisan al dueño).
- `ROOM/chat`: el chat.
- `ROOM/bichos`: los bichos de cada uno (cada 250 ms). No hay anfitrión: cada jugador mueve los
  bichos que aparecieron cerca suyo y los demás sólo los dibujan.
- `ROOM/mundo/cx_cz`: lo construido en cada trozo, comprimido, como mensaje **retenido**: el que
  entra después lo recibe al conectarse y ve todo lo hecho.

Todo lo que llega se valida (viene de cualquiera) y lo propio que vuelve se ignora. La semilla y la
hora del día salen de la sala y del reloj: todos ven el mismo mundo a la misma hora.

### Rendimiento

Lo del port de Craftsman (60 cuadros como máximo, el hilo del mundo dormido cuando no hay nada que
hacer, precisión de los shaders como el juego) y además:

- **Resolución automática que sube y baja**: si no llega a la velocidad elegida dibuja el mundo con
  menos píxeles (hasta un tercio) y, si llega, cada tanto prueba con más (hasta los de la pantalla;
  si con más no llega, vuelve y espera el doble para probar de nuevo). La de Craftsman sólo bajaba:
  con el tope de 60 cuadros nunca veía que sobraba, y una bajada al entrar al mundo (cuando la CPU
  arma los trozos, no por los píxeles) lo dejaba borroso para siempre. Lo dibujado con menos píxeles
  se estira en píxeles cuadrados (`image-rendering: pixelated`), no suavizado.

- **Hojas contra hojas**: no se dibujan las caras de hojas pegadas a otras hojas (como las "hojas
  inteligentes"): en la selva eran 440.000 cuadrados de hojas a distancia 6, ahora 150.000.
- **Semillas distintas de verdad**: cada semilla mira su ruido desde otro lugar (el simplex vale 0
  en los puntos de su grilla y alrededor del lugar de aparición todos los mundos salían parecidos).
- Generar un trozo tarda 2,7 ms en Chromium. Con la CPU frenada 6 veces, el JavaScript de un
  cuadro tarda 3 a 4,5 ms con 20 bichos andando.
- El mundo tiene 128 de alto (la 1.2 tiene 256): el doble de alto es el doble de memoria por trozo
  y en un teléfono de 1 GB no entra a distancia 6.

## Cómo se arma

    porteos/minecraft/portear.sh Minecraft-1.2.apk Craftsman_PTGI.apk SALIDA

Deja `SALIDA/Minecraft-1.2.html` (un solo archivo de texto ASCII: anda abierto desde el teléfono y
adentro de Rezona) y `SALIDA/sitio` (lo mismo en carpetas). Hace falta Python 3 con Pillow y numpy,
ffmpeg y opusenc. El repositorio no tiene nada del juego: todo sale de los APK al armar.

Para probar los servidores sin internet: `?broker=ws://127.0.0.1:PUERTO/mqtt&mqttjs=URL-de-mqtt.min.js`
con un broker MQTT local por WebSocket (por ejemplo aedes).
