# Minecraft PE 1.2 (Android) → navegador

Minecraft PE 1.2 (el APK "Minecraft-v1.2" que mandó el dueño, la beta 1.2.0.2) jugable en el
navegador del teléfono, en un solo `.html` de 1,9 MB, con **los shaders de Tito Crack 6000** (los del
APK de Craftsman PTGI) como opción al empezar, **servidores** para jugar con otros y **bichos**.

**Estado:** creativo completo para construir, con la interfaz de la 1.2:

- la primera vez se elige el idioma (English, Español o Português: los textos del juego, en_US,
  es_MX y pt_BR) y después con o sin los shaders de Tito; las dos cosas se cambian en Ajustes;
- el título con el logo, la frase amarilla y el panorama del río; Jugar con las pestañas Mundos,
  Amigos y Servidores; crear un mundo (nombre, tipo infinito o plano, semilla, siempre de día,
  bichos), editarlo o borrarlo; los ajustes de la 1.2 (Juego, Perfil, Táctil, Video, Sonido,
  Idioma) con sus interruptores y deslizadores; la pausa; el inventario creativo con las pestañas
  de la 1.2 (incluye los bloques nuevos: concreto, terracota esmaltada, vidrio teñido, prismarina,
  purpur...) y los huevos de los bichos;
- **tres mundos públicos fijados** arriba de todo en Jugar (y en Servidores): el mismo mundo para
  todos los que entran; además se pueden agregar servidores con nombre y dirección (la misma
  dirección = el mismo mundo);
- **multijugador** en esos mundos: se ven los otros jugadores (con su skin, Steve o Alex, y su
  nombre arriba), lo que construyen, el chat, se pueden pegar (vida, golpes, muerte y reaparecer) y
  los bichos de cada uno se ven en lo de los demás;
- **bichos**: de día cerdos, vacas, ovejas y gallinas en el pasto; de noche (o en las cuevas)
  zombis, esqueletos, creepers y arañas; caminan, miran, suenan, huyen si se les pega, se mueren
  dando vuelta, los zombis y esqueletos se queman al sol. En creativo los monstruos no atacan (como
  el juego); en los servidores, donde hay vida, sí;
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
  borde repetido por textura (de lejos no se mezclan vecinas) y filtrado trilineal de lejos.
- **Los bloques** de `blocks.json` (forma, texturas por cara y el sonido de cada uno) con su número
  de la 1.2; lo que el juego tiene en código (qué es opaco, cuánta luz da) está en
  [`juego/comun.js`](juego/comun.js).
- **La interfaz** ([`juego/interfaz.js`](juego/interfaz.js)): los dibujos de `textures/ui` en un
  atlas con sus "nineslice", armados como los `ui/*.json` del juego (los botones claros con su
  borde, las pestañas, el panel hueco con su relleno al 80 %, el negro al 75 % sobre el panorama);
  `gui.png` para la barra y los controles; la fuente `default8.png`; el logo; las frases amarillas.
- **Los modelos de los bichos y de los jugadores**: `models/mobs.json` (con la herencia
  "hijo:padre" resuelta) y sus texturas; [`juego/modelos.js`](juego/modelos.js) arma las cajas con el
  reparto de textura de Minecraft y las poses que el juego les da en código (el cuerpo acostado de
  los cuadrúpedos, las patas, la cabeza, los brazos del zombi, las patas de la araña).
- **Los sonidos**: los `.fsb` sueltos de la 1.2 (`sounds/sound_definitions.json`), decodificados con
  el decodificador del port de Craftsman, en un solo Opus de 700 KB (con los de los bichos).

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
hacer, precisión de los shaders como el juego, resolución automática) y además:

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
