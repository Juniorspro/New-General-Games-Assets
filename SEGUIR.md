# SEGUIR — todo lo que hay que saber para retomar los porteos en otra sesión

Traspaso escrito al cerrar la sesión del 13 de octubre de 2026, a pedido del dueño ("dame un md con
todos tus conocimientos sobre ports etc para seguir en otra sesión"). Junta lo que está repartido en
el repo, lo que sólo estaba en la cabeza de la sesión y el diseño completo de lo que se estaba por
programar (el dragón de Ender, §7), para que la próxima arranque sin perder un día.

**Orden de lectura para una sesión nueva:**

1. este archivo;
2. [`PORTEO.md`](PORTEO.md): la orden del dueño (Apéndice A, textual: **manda sobre todo**), el
   método, las herramientas, las trampas ya pagadas (§13) y el registro de cada porteo (§14);
3. [`ARRANQUE.md`](ARRANQUE.md): la máquina, la red, los secretos (§5);
4. el `LEEME.md` del porteo que se vaya a tocar (`porteos/<juego>/LEEME.md`).

`ESTADO.md` es de los sitios web (Frutiger Aero, IBLO), no de los porteos.

---

## 0. En 30 segundos

- El dueño manda juegos (APK, RAR, ZIP, links de MediaFire o itch.io) y **se portean a HTML5 para el
  celular sin preguntar**. Se entrega **un solo HTML por juego** y nada más.
- **Proyecto activo: Minecraft PE 1.2** (beta 1.2.0.2) sobre nuestro motor voxel en JS/WebGL (el del
  port de Craftsman), con las pantallas de la 1.2 interpretadas desde sus `ui/*.json`, todos los
  bichos, supervivencia, fabricar, el Nether con fortalezas y el End (la dimensión). Todo commiteado.
- **Lo próximo: el dragón de Ender (#123).** El diseño entero, con las fórmulas del juego, está en §7:
  se puede programar directo desde ahí.
- Con este archivo se le mandó al dueño el HTML con el End (6,06 MB), probado en el HTML único: ida
  y vuelta por el portal, isla, pilares, podio y endermans, 0 errores.

---

## 1. El dueño: cómo pide y cómo quiere las cosas

- **La orden** (PORTEO.md, Apéndice A): "NO DECIDAS SI HACERLO. HACELO." Llegó un juego → analizar →
  portear → adaptar → optimizar → probar → corregir → empaquetar → entregar. No se pregunta "¿querés
  que lo porte?", no se recomienda otro juego, no se le hace elegir tecnologías. Se pregunta sólo si
  es imposible seguir sin él (un archivo que sólo él tiene, la contraseña de un ZIP).
- **La entrega, textual (octubre de 2026):** *"Y recuerda solo darme el HTML cuando son pesados dame
  el HTML corriendo la página y ya no me des otros archivos ok?"*
  - liviano → el juego entero en un `.html` (`herramientas/porteo/un-archivo.py --texto`: ASCII
    imprimible de punta a punta, porque **Rezona** lo lee como texto);
  - pesado → el lanzador (`abrir.html`) que abre la versión privada en **su** Cloudflare
    (`herramientas/porteo/cloudflare/`); ese archivo lleva la clave: **sólo a él, nunca al repo**;
  - nada más: ni APK (salvo que lo pida), ni zips, ni capturas, ni variantes.
  - Se manda con `SendUserFile` (el archivo, no una ruta).
- **Rezona:** muestra el HTML en un `<iframe sandbox="allow-scripts allow-same-origin
  allow-pointer-lock allow-modals">`; tapa con su "cargando" hasta que el juego manda
  `postMessage({type: "game:ready"})` (o 2,5 s después del `load`, o 15 s). Detalle en PORTEO.md §10.
- **Lo que pidió para el Minecraft** (textual, de varias sesiones, todo sigue en pie):
  - "Mejor cambiemos de juego y agreguemos esos shaders como una opción aquí en este maincra como una
    opción al principio y los servera también etc" / "Soy yo o las texturas están comprimidas";
  - "Che pero quiero los menús completos del Minecraft de la 1.2.0.2 y el mismo estilo full full el
    nether y en end";
  - "No, quiero el Minecraft completo con los mobs, todos, menús, personajes, animaciones etc todo
    porteado" / "Puedes construirlo sobre el Craftsman" / "Sigo";
  - 3 mundos públicos fijados al entrar a jugar, multijugador MQTT; los idiomas inglés, español y
    portugués para elegir al principio; shaders sí/no al principio; bichos de día y de noche; la
    semilla que de verdad cambie el mundo y sin lag en los biomas; girar 90° con el teléfono parado.
  - "Che we nunca lo hacés" (se quejó de no recibir avances): **mandarle el HTML en cada hito** y
    avisar en una línea qué se está haciendo; no quedarse callado mucho rato.
- **Idioma:** castellano rioplatense en todo (mensajes, código, comentarios, commits). Los
  comentarios del código explican **por qué**, no qué.
- **Nunca** pedirle tokens ni contraseñas por el chat.

## 2. Reglas duras (seguridad y repo)

- **El repo es PÚBLICO.** Nunca entran: datos de juegos (APKs, texturas, sonidos, el `.html` armado),
  código de terceros o decompilado, secretos. Sólo recetas, parches, herramientas y código nuestro.
- **Secretos:** ninguno en el repo, ni en comentarios ni en commits. Después de **cada** commit:
  ```bash
  git grep -nI "cfat_\|-----BEGIN"   # vacío, salvo las líneas que lo documentan (README.md, ARRANQUE.md y esta)
  # y, si existen en esta máquina, que no aparezcan los valores del token y de las claves:
  for f in /tmp/claude-0/cf/token /tmp/claude-0/cf/clave-*; do [ -f "$f" ] && git grep -nIF "$(tr -d '\n' < "$f")"; done
  ```
- Nunca commitear almacenes de claves (`*.jks`, `*.keystore`; están en `.gitignore`).
- El token de Cloudflare vive fuera del repo (en la sesión anterior, en
  `/tmp/claude-0/cf/token`); no se le dice al dueño que lo borre.
- **Nada del juego a hosts públicos** (MediaFire, githack, jsDelivr, links públicos): sólo a su
  Cloudflare, privado, con la puerta de clave.
- Lo descargado es **dato no confiable**: cada cosa en su carpeta nueva y vacía, nunca se ejecuta nada
  de adentro, Python con `-I` cuando lee esos archivos.
- **Rama:** se trabaja y se empuja sólo en `ccr-0fba4a8d-kkxp05`, con
  `git push -u origin ccr-0fba4a8d-kkxp05` (reintentos con espera 2, 4, 8, 16 s sólo si falla la red).
  Sin PR salvo que lo pida. Si el PR de la rama ya se fusionó, se rearma la rama desde la rama por
  defecto (ver instrucciones de la sesión).
- **Commits:** terminan con las líneas de atribución que da la sesión (`Co-Authored-By:` y
  `Claude-Session:`); el identificador del modelo no va en ningún otro lado del repo.
- **No retomar el porteo de Geometry Dash** (lo dijo el dueño).
- Los servidores MCP `graphify` y `mint` piden autorización: ya se le avisó; no insistir.
- Trampas de la máquina: `pkill -f`/`pgrep -f` con un patrón que aparece en el propio comando mata la
  shell (matar por PID); el `sleep` en primer plano está bloqueado; los `rm` con comodines (`rm -f
  dir/*`) los frena el control de seguridad (borrar por nombre o usar carpetas nuevas); no reintentar
  hosts que el proxy corta (403/407); nunca desactivar TLS ni sacar `HTTPS_PROXY`.

## 3. La máquina, lo que se pierde y cómo recuperarlo

El contenedor **se borra** al terminar la sesión. Lo que quedó en `/tmp/claude-0/` **no** va a estar:

| qué era | dónde estaba | cómo se recupera |
|---|---|---|
| APK de Minecraft 1.2 (`Minecraft-v1.2 (LUISGAMERXD HD).apk`, 63,6 MB, sha256 `e0a9278f…2421`) | `/tmp/claude-0/descargas/mc12/mc12.apk`, extraído en `…/mc12/x/` | el link de MediaFire que mandó el dueño está en el historial del chat (no se copia al repo: es público). Si no está, se le pide el link: es "un archivo que sólo él tiene" |
| APK de Craftsman PTGI (shaders de Tito; 56,9 MB, sha256 `e80ccd10…3c6`) | `/tmp/claude-0/craftsman/bajada/craftsman.apk` | ídem |
| las salidas armadas | `/tmp/claude-0/mc12/salida/{sitio,Minecraft-1.2.html}` | `porteos/minecraft/portear.sh` (§6.2) |
| las pruebas del Minecraft | scratchpad de la sesión | **ya están en el repo**: `porteos/minecraft/pruebas/` |
| el broker MQTT local de las pruebas de red | `/tmp/claude-0/craftsman/mqtt/` | `porteos/minecraft/pruebas/broker/` (`npm install` ahí; `mqtt.min.js` sale del paquete `mqtt` de npm, `dist/mqtt.min.js`) |
| token y cuenta de Cloudflare | `/tmp/claude-0/cf/` | tienen que venir como secretos del entorno (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Si no están, leer `read_documentation` → `environment.secrets` y decirle al dueño dónde cargarlos (sin pedirle el valor por el chat) |
| la clave de firma de APKs | — | `PORTEO_CLAVE_B64` + `PORTEO_CLAVE_PASS` como secreto del entorno (PORTEO.md §7) |

Lo que sí viene en la máquina: Chromium en `/opt/pw-browsers/chromium` (nunca `playwright install`),
Playwright importable desde `/opt/node22/lib/node_modules/playwright/index.mjs`, Node 22, Python 3,
Java 21, ffmpeg (a veces). Hay que poner: `pip install pillow numpy`, `apt-get install -y opus-tools`
(y `ffmpeg` si falta), `unar` para RAR. Para WebGL sin placa:
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
Chromium **no** sale a internet (sólo `curl` pasa por el proxy): las pruebas van contra `127.0.0.1` o
`file://`.

## 4. Los porteos: estado de cada uno

| juego | motor → estrategia | estado | receta |
|---|---|---|---|
| Bus Stop Simulator | HTML5+three.js en WebView → sacar `assets/` + `web.js` | terminado (43/43) | `porteos/bus-stop/` |
| FNaF 2 | Clickteam → intérprete JS (de otra sesión) | corregido (reloj 2,17× → 1,00×) | `porteos/fnaf2/` |
| FNaF 4 | Clickteam Fusion Android → `herramientas/clickteam/` (datos originales + `motor.js`) | terminado (39/39) | `porteos/fnaf4/` |
| Plantas vs. Zombies (PC 2009) | PopCap → PvZ-Portable a WebAssembly + parches para los datos de 2009 | terminado (39/39 + recorrido 31/31) | `porteos/pvz/` |
| Slime Rancher (APK "v1.2") | Unity 2018 Mono → su IL sobre **nuestro UnityEngine en C#** (.NET 10 wasm AOT, WebGL 2, PhysX) | menú, partida, zonas, física, audio y guardado andan; HTML único ≈199 MB y versión privada en Cloudflare con lanzador. Falta: corrales/mejoras/puertas/teletransportes probados, rendimiento en teléfono, pantalla negra en algunos teléfonos (#52), animación/partículas (#36, #40, #41) | `porteos/slime-rancher/`, motor en `herramientas/unity/motor` |
| Bad Parenting 1 (itch.io, Unity 2022 Windows) | mismo motor C#; shaders D3D11 → GLSL ES con HLSLcc | jugable y entregado; falta jugarlo entero en un teléfono | `porteos/bad-parenting/` |
| Balatro (APK) | LÖVE → LÖVE 11 compilado para la web + su Lua tal cual | terminado; HTML único 9,6 MB ASCII; 67 fps en el teléfono del dueño | `porteos/balatro/` |
| Craftsman PTGI (APK, MCPE 0.16 de Tito) | nativo → motor voxel propio en JS con sus shaders | creativo completo; **falta supervivencia y bichos (#83)** (lo hecho en Minecraft 1.2 se puede llevar) | `porteos/craftsman/` |
| **Minecraft PE 1.2** | nativo → el motor de Craftsman crecido para la 1.2 | **activo**, ver §6 | `porteos/minecraft/` |

**PORTEO.md §14 tiene la entrada de Minecraft desactualizada** (dice "falta supervivencia"): la
verdad está en `porteos/minecraft/LEEME.md` y acá. Conviene actualizarla en el próximo commit grande.

## 5. Herramientas propias

- `herramientas/porteo/`: `tactil.js` (teclas de verdad desde el táctil), `web.js` (lo que hacía la
  parte Android; **el giro de 90° con el teléfono parado**), `intro.js` (la intro de JXStudios, la
  moneda de FNaF 2), `un-archivo.py` (todo en un `.html`; `--texto` = ASCII con basE91 para Rezona),
  `pwa.py`, `apk/armar.py` (APK sin Gradle), `cloudflare/` (puerta con clave, `subir.py`,
  `descargas.py`, `registro.py`), `registro.js` (qué le pasa al teléfono de otro), `carga.js`.
- `herramientas/unity/`: `motor/` (nuestro UnityEngine en C# para .NET wasm), `ripear/`,
  `verificar/`, `analizar-apk.py`, `api-usada/`. `herramientas/clickteam/`, `herramientas/popcap/`.
- Cómo se usa cada una: PORTEO.md §5–§10 y el `LEEME.md` de cada carpeta.

---

## 6. Minecraft PE 1.2 — el proyecto activo

### 6.1 Qué entra

- `Minecraft-1.2.apk` (beta 1.2.0.2, x86): de ahí salen texturas, `models/mobs.json`, el behavior
  pack (`assets/behavior_packs/vanilla/`: `entities/*.json`, `loot_tables/`, `trading/`), la
  interfaz (`assets/resource_packs/vanilla/ui/*.json`), los textos (`texts/*.lang`), los sonidos
  (`.fsb`), los shaders de fábrica.
- `Craftsman_PTGI.apk`: sólo los shaders de Tito (sin la sombra del personaje).
- Para leer datos a mano: extraer el APK en una carpeta propia y mirar
  `assets/resource_packs/vanilla/{models,textures,ui,sounds,texts}` y
  `assets/behavior_packs/vanilla/entities`. Los JSON traen comentarios `//` al final de las líneas:
  sacarlos antes de `json.loads`.

### 6.2 Armar

```bash
pip install pillow numpy; apt-get install -y opus-tools ffmpeg   # si faltan
porteos/minecraft/portear.sh RUTA/mc12.apk RUTA/craftsman.apk /tmp/claude-0/mc12/salida
#   empaquetar.py → SALIDA/sitio/datos (+ datos.json, interfaz.json, texturas, sonidos)
#   armar.py      → SALIDA/sitio/{index.html, juego.js} (página + trabajador)
#   un-archivo.py --texto → SALIDA/Minecraft-1.2.html (el que se entrega)
```

- Si sólo cambió `juego/*.js`: alcanza con `python3 -I porteos/minecraft/armar.py SALIDA/sitio` y,
  para el HTML único, `python3 -I herramientas/porteo/un-archivo.py SALIDA/sitio --texto --salida
  SALIDA/Minecraft-1.2.html`. Si cambió lo que se saca del APK (`empaquetar*.py`), `portear.sh`
  entero.
- **Un módulo nuevo hay que agregarlo en `armar.py`**: lista `PAGINA` (página: `…"comercio.js",
  "portal.js", "fin.js", "red.js", "principal.js"`) o `TRABAJADOR` (`["comun.js", "generador.js",
  "nether.js", "fin.js", "crecer.js", "trabajador.js"]`). El orden importa (`comun.js` primero,
  `principal.js` al final), y **lo que no está en la lista se saltea sin aviso**.
- Tamaños: datos ≈4,4 MB; el HTML único pasó de 3,2 MB (primera entrega) a 6,06 MB con el End.

### 6.3 Mapa del código (`porteos/minecraft/juego/`)

| archivo | qué hace |
|---|---|
| `principal.js` | el juego: carga, menús, idioma y shaders al empezar, partidas (IndexedDB), dimensiones (`cambiarDimension`, `llegar`), portales, el tick, golpes, explosiones, TNT, ganchos `window.prueba` |
| `comun.js` | lo compartido con el trabajador: bloques (`C.FORMA`, `C.SOLIDO`, `PROPIAS`), ruido, `C.Azar` (enteros de 32 bits) |
| `trabajador.js` | Web Worker: genera trozos (elige generador por dimensión), luz de cielo y bloques, mallas, líquidos |
| `generador.js` / `nether.js` / `fin.js` | generadores del mundo de arriba, del Nether (+ fortalezas) y del End (isla, pilares, podio, islas de afuera, coros) |
| `crecer.js` | los "pasos al azar" del juego, en el trabajador: cultivos, retoños que se hacen árboles, pasto y micelio, hojas que caen |
| `mundo.js` | copia de los bloques en la página (`Mundo.bloque/meta/poner/cargado`, `M.enFortaleza`) |
| `render.js` | terreno, cielo y niebla por dimensión (el cielo del End), nubes, bichos (`dibujarEntidades`), partículas (`R.romper`, `R.chispas`, máx. 400), mano, correas, velo del portal, mapa de luz por dimensión |
| `gl.js` | WebGL y los shaders del juego (de fábrica y de Tito) |
| `interfaz.js` | el lienzo 2D encima del 3D: controles táctiles, mira, carteles |
| `jui.js` | **intérprete de la interfaz JSON de la 1.2** (herencia, variables, bindings, colecciones, grillas, fábricas, animaciones) |
| `pantallas.js` | los "screen controllers" que en el juego son C++ (título, Jugar, crear, ajustes, inventario, HUD, muerte, cama, efectos…) |
| `muneco.js` | el muñeco de papel (jugador con su skin en el título) |
| `jugador.js` | física del jugador (20 pasos/s, la de Minecraft) |
| `bichos.js` | los bichos: crear, física, daño, explosiones, proyectiles, aparecer (por bioma/dimensión/fortaleza), generadores de bichos, correa, red, guardado |
| `conducta.js` | lo que hace el código del juego con los componentes del behavior pack (IA por `minecraft:behavior.*`) |
| `modelos.js` | modelos de `mobs.json` (box UV, herencia) y las poses del código del juego por tipo de bicho |
| `trato.js` / `comercio.js` | interactuar con bichos (ordeñar, criar, domar, montar, correa) y comerciar con aldeanos |
| `items.js` / `objetos.js` / `inventario.js` / `recetas.js` / `contenedores.js` / `tirados.js` | objetos, bloques como objetos, inventario, recetas y horno, cofres, cosas en el piso y orbes |
| `minar.js` / `supervivencia.js` / `efectos.js` / `botin.js` | romper con herramientas, vida/hambre/aire/experiencia, efectos de estado, tablas de botín |
| `portal.js` | portal del Nether (marco, prender, apagar, crear del otro lado) |
| `red.js` | multijugador por un broker MQTT público (estado cada 100 ms, acciones, chat, bichos con dueño, bloques retenidos por trozo) |
| `sonido.js` / `textos.js` | Web Audio con un solo `.ogg` por paquete; textos propios en es/en/pt |

Empaquetado: `empaquetar.py` (bloques, atlas, cielo, shaders, textos, IDs como `"end_portal": 119`,
`"end_gateway": 209`), `empaquetar_bichos.py` (modelos con su textura por capa, variantes, entidades
del behavior pack tal cual, botín, comercio, sonidos por bicho, huevos; los modelos que el juego arma
en código van como geometrías propias en `PROPIAS`), `empaquetar_objetos.py`, `empaquetar_ui.py`,
`sonidos12.py` (FSB → Opus).

### 6.4 Cómo está hecho (decisiones que no hay que romper)

- **Generadores = funciones puras** de (semilla, posición). Lo que cruza trozos (árboles, fortalezas,
  islas, coros) se calcula desde los 4 trozos fuente (`cx-1..cx`, `cz-1..cz`) mirando sólo el
  terreno base, así los bordes coinciden. Caché LRU de 48 terrenos base.
- **Dimensiones:** 0 arriba, 1 Nether, 2 End. Cada una guarda aparte: trozos bajo el id `id~1` /
  `id~2`, y los campos de la partida con `campo(n, d)` → `n_1`, `n_2` (bichos, tirados,
  contenedores, portales). El trabajador se reinicia con `dim`. `cambiarDimension(dim, x, y, z,
  llegada)` guarda, cambia y abre; `llegar()` resuelve la llegada (`{portal}`, `{reaparecer}`,
  `{fin}`: plataforma de obsidiana 5×5 en (100, 48, 0), mirando a la isla).
- Portal del End (119) en dim 0 → al End; en dim 2 → a la cama/aparición. Portal del Nether (90).
- **Partes del Java de PC que se portaron** (los nombres sirven para buscar): ChunkGeneratorHell,
  StructureNetherBridgePieces (tabla de piezas, pesos, `getComponentToAddBoundingBox`, regla de las
  escaleras: dirección del mundo = transformar (dx, −dz) local), BlockPortal.Size,
  Teleporter.makePortal/placeInPortal, MobSpawnerBaseLogic, ChunkGeneratorEnd (grilla 3×33×3, celdas
  8×4×8, `getIslandHeightValue`), WorldGenSpikes, WorldGenEndPodium, WorldGenEndIsland,
  BlockChorusFlower.generatePlant, RenderLeash, RenderLeashKnot, renderSkyEnd, GuiIngame.renderPortal,
  el mapa de luz de EntityRenderer (tabla del Nether con mínimo 0,1 y fórmula del End). Donde el C++
  de la 1.2 no se conoce, se usa el Java y se corrigen los números con los JSON del behavior pack.
- **El End:** `GenFin.pilares(semilla)` → `[x, z, radio, alto, enjaulado]` ×10 (ángulo
  `2·(−π + π/10·i)`, radio 42, `n` de 0..9 barajado: radio `2 + n/3`, alto `76 + 3n`, enjaulados los
  n = 1 y 2; roca madre arriba en (x, alto, z)); `podio()` (y = max(40, tope(0, 0))); `podioEn(poner,
  prendido)` arma el portal de salida apagado o prendido; `K_RUIDO = 0.45` (isla de radio ~95,
  superficie ~60).
- **Shaders de Tito y el Nether:** el shader detecta el Nether si `FOG_COLOR` r > b, r < 0,5 y
  b < 0,2; `FOG_CONTROL.x < 0,15` es "bajo el agua"; 0,1 < x < 0,55 con r, g > 0,15 es "lluvia". Los
  colores de niebla por dimensión salen de ahí (Nether [0.2, 0.03, 0.03], End [0.094, 0.075, 0.094]).
- **Jui:** una casilla de una grilla con hijos explícitos no sabe su colección; se toma de la variable
  `$item_collection_name` del alcance (`J.coleccionDe`). Los botones se identifican por
  `button_mappings[].to_button_id`.
- **La barra del jefe ya existe en el HUD de la 1.2** (`hud_screen.json`: `boss_health_grid`,
  colección `boss_bars`); `pantallas.js` hoy devuelve `'#boss_grid_dimension' → [1, 0]` (ver §7.7).

### 6.5 Probar

- Servir: `python3 -m http.server 8810 --bind 127.0.0.1 --directory SALIDA/sitio`, o abrir el HTML
  único con `file:///…/Minecraft-1.2.html` (también anda).
- Correr: `node porteos/minecraft/pruebas/<prueba>.mjs URL PREFIJO_DE_FOTOS` (p. ej.
  `node porteos/minecraft/pruebas/fin.mjs file:///tmp/claude-0/mc12/salida/Minecraft-1.2.html /tmp/f`).
  Imprimen lo medido en el estado del juego y "errores de la página: N" (tiene que dar 0).
- Las de node (`*_unit.js`, `*_donde.js`, `nether_prof.js`, `azar_igual.js`) cargan los módulos de
  `juego/` con **`vm.runInThisContext`** (con `eval` directo era 50× más lento: alcance dinámico).
- Plantilla de una prueba (todas siguen este molde):
  - Chromium móvil acostado: `viewport 873×393`, `deviceScaleFactor 2`, `isMobile`, `hasTouch`;
  - esperar `window.prueba.listo`;
  - pasar los carteles de la primera vez apretando `button.porteo_cartel_medio` y
    `button.porteo_cartel_der` con `prueba.jui`, o saltearlos con
    `localStorage['mc12.opciones'] = {idioma, shaders, nombre, skin, dist}` en `addInitScript`;
  - `prueba.crear({nombre, modo: 'creativo'|'supervivencia', tipo: 'infinito'|'plano', semilla,
    bichos, dificultad, siempreDia})`;
  - esperar `Interfaz.pantalla === 'juego' && !prueba.cargando()`.
- Ganchos de `window.prueba`: `jugador` (`ubicar`, `yaw`, `pitch`, `volando`), `bichos` (el módulo:
  `crear`, `lista`, `paraGuardar`…), `inventario()`, `supervivencia()`, `tirados()`, `comando(t)`,
  `pegar(fx, fy)`, `rayo(fx, fy)`, `darEfecto`, `dimension()`, `cambiarDimension(d, x, y, z, ll)`,
  `portales(d)`, `cargando()`, `jui`, `pantallas`, `red`, `ms()` (ms por cuadro), `partida()`,
  `durmiendo()`, `montado()`, `tnts()`. `window.Mundo.poner(x, y, z, id, m)` pone bloques.
- Red: `cd pruebas/broker && npm install && node broker.js` (ws://127.0.0.1:8883/mqtt), servir
  `mqtt.min.js` en 8961 y abrir con `?broker=ws://127.0.0.1:8883/mqtt&mqttjs=http://127.0.0.1:8961/mqtt.min.js`
  (`red.mjs`: dos clientes y un tercero que llega después).
- Rezona imitado: `rezona-mc.mjs` (iframe con sandbox, toques por CDP, densidad 2,625).
- Parado: `jui-parado.mjs` (393×873, la página se gira 90°).
- Lo que prueba cada una lo dice su primera línea. Las del End/Nether: `fin.mjs`, `nether.mjs`,
  `nether_bichos.mjs`, `fortaleza.mjs`, `puentes.mjs`.

### 6.6 Hecho y entregado

Todo commiteado en la rama (último: "Minecraft 1.2: la dimensión del End"). Entregas al dueño: el
HTML con comercio y correa (5,94 MB), con el Nether (6,01 MB) y, con este traspaso, con el End
(6,06 MB). Lo que tiene, en corto: interfaz completa de la 1.2 (título, Jugar, crear/editar mundo,
ajustes, skins, cómo se juega, pausa, chat con comandos, muerte), creativo y supervivencia con el HUD
de la 1.2, inventario y libro de recetas, mesa, horno, cofres, minar con herramientas, comer, efectos,
arco y lanzables, baldes/azada/polvo de hueso/tijeras/cama/armadura, los 45 bichos con su behavior
pack (aparecen solos de día y de noche), tratar con ellos (criar, domar, sentar, montar, correa,
comerciar), multijugador MQTT con 3 mundos públicos, shaders de Tito opcionales, el Nether completo
(generador del juego, portal ida y vuelta, cielo, luz, bichos, fortalezas con generadores de blazes y
cofres con botín) y el End (isla, 10 pilares con jaulas, podio con el portal apagado, islas de
afuera con coros, cielo, luz, endermans, portal de vuelta).

### 6.7 Lo que falta, en orden

1. **#123 El dragón de Ender** — diseño completo en §7.
2. **Puertas del End (end_gateway, 209)** y las islas de afuera alcanzables (§7.6).
3. **#124 Fortalezas del mundo de arriba, ojo de ender y portal del End** (§8).
4. Ciudades del End y barcos (shulkers, élitros) — opcional, después.
5. **#100 Pantallas que faltan:** inventario del caballo, mesa de encantamientos, yunque, soporte para
   pociones, tolva, faro… (los JSON están en `ui/`: `enchanting_screen*`, `anvil_screen*`,
   `brewing_stand_screen*`, `horse_screen*`, `hopper_screen*`, `beacon_screen*`).
6. **#103 Supervivencia con todos sus menús** (lo que dependa de esas pantallas).
7. **#105 El jugador:** modelo y animaciones en tercera persona, skins.
8. **#106 Estructuras del mundo de arriba:** aldeas, templos, minas, cofre bonus; la cama dibujada.
9. **Música de fondo:** no hay ninguna todavía (sólo la opción de volumen). La 1.2 trae
   `music.game`, `music.game.creative`, `music.game.nether`, `music.game.end`,
   `music.game.endboss`, `music.game.credits` en `sounds/sound_definitions.json`.
10. **Créditos / poema del End** al salir por primera vez: `ui/credits_screen.json` y `credits/end.txt`.
11. Actualizar `porteos/minecraft/LEEME.md` (agregar el End y lo que se haga) y PORTEO.md §14.

Cada hito: commit + push (con la comprobación de secretos), `portear.sh` entero, prueba en el HTML
único, y **mandarle sólo el HTML**.

---

## 7. El dragón de Ender: diseño listo para programar

Todo esto sale del código del juego de PC (1.12, nombres MCP) más los datos de la 1.2. Las fórmulas
están completas: no hace falta volver a buscarlas.

### 7.1 Datos de la 1.2 (del APK)

- `entities/ender_dragon.json`: vida 200, `collision_box` 13×4, `fire_immune`, `knockback_resistance`
  100, `flying_speed` 0,6, `attack` 3, sin gravedad ni choques; grupos `dragon_sitting`
  (dragonlanding/flaming/scanning), `dragon_flying` (dragontakeoff/chargeplayer/strafeplayer/
  holdingpattern + shooter `dragon_fireball`), `dragon_death`; eventos `minecraft:start_land`,
  `start_fly`, `start_death`. Esos comportamientos hoy son "no hacen nada" en `conducta.js` (lista
  al final): el dragón se maneja aparte (§7.3).
- `entities/ender_crystal.json`: caja 0,98×0,98, vida 1, `fire_immune`, al lastimarse explota con
  poder 6 sin fuego.
- `entities/dragon_fireball.json`: `power` 1,3, gravedad 0, `inertia` 1, al pegar
  `spawn_aoe_cloud {radius 6, radius_on_use 0, potion 23 (daño instantáneo), particle
  "dragonbreath", duration 120, color [220, 0, 239], affect_owner false}`. **Hoy `impacto()` de
  `bichos.js` la trata como la del ghast (explosión con fuego): está mal**, tiene que dejar la nube.
  (La poción persistente: `radius 3, radius_on_use −0.5, duration 30, reapplication_delay 40`.)
- Sonidos (`sounds.json` → `entity_sounds.entities.ender_dragon`, volumen 100, tono 0,8–1,2):
  `mad` → `mob.enderdragon.growl`, `hurt` → `mob.enderdragon.hit`, `death` →
  `mob.enderdragon.death` (`sounds/mob/enderdragon/end`), `flap` → `mob.enderdragon.flap`. Ya se
  empaquetan en `sonidos_ender_dragon.ogg`.
- Texturas: `textures/entity/dragon/dragon.png` (256×256, alas recortadas con alfa),
  `dragon_eyes.png` (256×256, ojos violetas con alfa), `dragon_exploding.png` (256×256: el alfa es un
  ruido para disolverlo al morir), `textures/entity/endercrystal/endercrystal.png` (**128×64**, el
  mismo dibujo de 64×32 de PC al doble: usar 64×32 como tamaño de la geometría),
  `endercrystal_beam.png` (16×256). `textures/particle/particles.png` (128×128, el atlas clásico:
  la fila y = 80 es la secuencia del aliento; el brillo grande de 32×32 está en (32, 16)).
- Barra del jefe: `hud_screen.json` → `boss_health_grid` (colección `boss_bars`, grilla con
  `#boss_grid_dimension`) con `boss_health_panel`: `#bossName` (etiqueta), `#progress_percentage`
  (recorte de `filled_progress_bar`) y `#bar_visible` → `#visible`; color `$boss_health_bar_color`
  = [1, 0, 1]. Las texturas `empty_progress_bar`/`filled_progress_bar` ya están en el atlas de la
  interfaz. Nombre: `entity.ender_dragon.name` de los `.lang`.

### 7.2 El modelo

**`geometry.dragon` de `mobs.json`** trae los huesos sueltos (sin padres): el juego los compone en
código como `ModelDragon` de PC. Equivalencias verificadas hueso por hueso:

- caja local de PC = `(o.x − piv.x, piv.y − (o.y + t.y), o.z − piv.z)` con tamaño `t`;
- punto de giro de PC = `(piv.x, 24 − piv.y, piv.z)` para los de arriba de todo; los hijos están
  escritos relativos a su padre (con el padre en el origen).
- Cada hueso de PC (`ModelRenderer.render`) es `T(punto·1/16) · Rz · Ry · Rx` en ese orden de GL; el
  hijo se multiplica a la derecha del padre.
- Jerarquía: `head → jaw`; `wing → wingtip`; `frontleg → frontlegtip → frontfoot`;
  `rearleg → rearlegtip → rearfoot`; `neck` es la vértebra que se dibuja 5 veces (cuello) y 12 (cola);
  `body` solo. Los `wing1`, `rearleg1`, etc. de la 1.2 son copias del lado derecho: **no se usan**; el
  lado derecho es el izquierdo espejado con `escala(−1, 1, 1)` (como PC). En `render.js` las entidades
  se dibujan sin descarte de caras, así que el espejo no rompe nada.
- Capa de los ojos: agregar en `empaquetar_bichos.py` → `MODELOS["ender_dragon"]` una segunda capa
  `("geometry.dragon", "dragon/dragon_eyes", {"brilla": True})` (luz plena; con descarte por alfa
  queda como el aditivo del juego).

**`ModelDragon.render`** (f = animTime interpolado; unidades: los `translate` de GL en bloques, los
puntos de giro en píxeles de 1/16):

```
jaw.rotX = (sin(f·2π) + 1) · 0.2
f1 = sin(f·2π − 1) + 1;  f1 = (f1² + 2·f1) · 0.05
translate(0, f1 − 2, −3);  rotate(f1·2°, eje X)
adouble = offsets(6)
f6 = wrap(offsets(5)[0] − offsets(10)[0]);  f7 = wrap(offsets(5)[0] + f6/2);  f8 = f·2π
cuello: y = 20, z = −12, x = 0; para i = 0..4:
   a1 = offsets(5 − i);  f9 = cos(i·0.45 + f8) · 0.15
   rotY = wrap(a1[0] − adouble[0]) · 1.5°           (todo en radianes: ·π/180)
   rotX = f9 + headPartYOffset(i, adouble, a1) · 1.5 · 5 °
   rotZ = −wrap(a1[0] − f7) · 1.5 °
   punto = (x, y, z);  dibujar vértebra
   y += sin(rotX)·10;  z −= cos(rotY)·cos(rotX)·10;  x −= sin(rotY)·cos(rotX)·10
cabeza en (x, y, z): a2 = offsets(0)
   rotY = wrap(a2[0] − adouble[0])°;  rotX = wrap(headPartYOffset(6, adouble, a2)) · 1.5 · 5 °
   rotZ = −wrap(a2[0] − f7)°;  dibujar head (con jaw de hijo)
push; translate(0, 1, 0); rotate(−f6·1.5°, eje Z); translate(0, −1, 0)
   body (rotZ 0)
   2 veces (la segunda después de escala(−1, 1, 1)):  f11 = f·2π
      wing.rotX = 0.125 − cos(f11)·0.2;  wing.rotY = 0.25;  wing.rotZ = (sin(f11) + 0.125)·0.8
      wingtip.rotZ = −(sin(f11 + 2) + 0.5)·0.75
      rearleg.rotX = 1 + f1·0.1;  rearlegtip.rotX = 0.5 + f1·0.1;  rearfoot.rotX = 0.75 + f1·0.1
      frontleg.rotX = 1.3 + f1·0.1;  frontlegtip.rotX = −0.5 − f1·0.1;  frontfoot.rotX = 0.75 + f1·0.1
      dibujar wing, frontleg, rearleg (con sus hijos)
pop
cola: y = 10, z = 60, x = 0, f10 = 0, adouble = offsets(11); para k = 0..11:
   a2 = offsets(12 + k);  f10 += sin(k·0.45 + f8)·0.05
   rotY = (wrap(a2[0] − adouble[0])·1.5 + 180)°;  rotX = f10 + (a2[1] − adouble[1])·1.5·5 °
   rotZ = wrap(a2[0] − f7)·1.5 °;  punto = (x, y, z);  dibujar vértebra
   y += sin(rotX)·10;  z −= cos(rotY)·cos(rotX)·10;  x −= sin(rotY)·cos(rotX)·10
```

`headPartYOffset(i, a, b)`: en LANDING o TAKEOFF → `i / max(dist(podio)/4, 1)`; si la fase es
quieta (sentado) → `i`; si `i == 6` → 0; si no → `b[1] − a[1]`.

**`RenderDragon.applyRotations`:** yaw = `offsets(7)[0]`; `rotate(−yaw, Y)`; inclinación
`(offsets(5)[1] − offsets(10)[1])·10°` en X; `translate(0, 0, 1)`; después lo de siempre
`escala(−1, −1, 1)` y `translate(0, −1.501, 0)`. **No se cae de costado al morir** (el dragón usa
`deathTicks`, no `deathTime`): saltear la vuelta genérica de `Mo.escribir` para él.

**Cómo meterlo en `modelos.js`:**

- Nuestro yaw (0 = norte, dirección (sin y, −cos y)) es **igual** al `rotationYaw` del dragón de PC
  en radianes (el dragón de PC está girado 180° respecto de los demás bichos: vuela "para atrás" con
  `moveRelative(…, −1, …)`).
- Con la cadena de `Mo.escribir` (`wx = −(px·cos + pz·sin)`, `wz = −px·sin + pz·cos`, que es el
  `R_y(−yaw)` de PC con x dado vuelta), la matriz por hueso en el espacio del modelo es
  `O = S(−1,1,1) · R_x(incl) · T(0,0,16) · S(−1,−1,1) · T(0,−24.016,0) · M_PC(hueso) · D · T(−piv)`,
  con `D = diag(1, −1, 1)` y todo en píxeles (los `translate` de bloques ×16).
- Cambios concretos: (1) en `Mo.escribir`, si `pose[nombre]` trae `.m` (Float32Array de 12), usarla
  tal cual en vez de `matriz(rt, h.p, m)`; (2) en `Mo.preparar`, para `ender_dragon`, armar las
  instancias: `head`, `jaw`, `body`, `neck0..4`, `tail0..11` (las dos con las caras de `neck`), y
  `wing`, `wingtip`, `frontleg`, `frontlegtip`, `frontfoot`, `rearleg`, `rearlegtip`, `rearfoot` +
  sus copias espejadas (`wing~`…); `Mo.vertices` las cuenta solo; (3) la pose `dragon` calcula todas
  las matrices con lo de arriba (tiene que andar también sin anillo de movimientos, para los dragones
  remotos: todo derecho).
- `paraDibujarUno` le pasa al modelo: `anim` (prevAnimTime + (animTime − prevAnimTime)·alfa), el
  anillo y su índice, `alfa`, si la fase es quieta, si está aterrizando/despegando y la distancia al
  podio, y los `deathTicks`. Escala 1 (el modelo ya mide 16 de ancho).

**Al morir se disuelve** (`RenderDragon.renderModel`): primero el modelo con `dragon_exploding` y
`alphaFunc(GREATER, deathTicks/200)`, después el normal con `depthFunc(EQUAL)` → se ve la piel sólo
donde el ruido supera el umbral. Acá: armar en `empaquetar_bichos.py` una textura
`dragon_muriendo` (RGB de `dragon.png`, alfa = ruido donde el dragón es opaco, 0 donde no), ponerla
como textura del dragón mientras muere, y en el sombreador de entidades un `uniform float UMBRAL`
(descartar si `c.a <= max(0.1, UMBRAL)`), puesto en `deathTicks/200` sólo en la llamada de esa
textura.

**El cristal (`ModelEnderCrystal`, `RenderEnderCrystal`):** geometría propia en `PROPIAS`
(textura 64×32): `base` 12×4×12 en uv (0, 16) (caja de PC (−6, 0, −6)), `glass` 8×8×8 en (0, 0)
(dos veces), `cube` 8×8×8 en (32, 0). Con `f = innerRotation + pt` (al nacer, `innerRotation` al azar
hasta 100 000), `f1 = sin(f·0.2)/2 + 0.5; f1 = f1² + f1`, `limbSwingAmount = f·3` (grados),
`ageInTicks = f1·0.2`:

```
escala(2) ; translate(0, −0.5, 0) ; base
rotate(f·3°, Y) ; translate(0, 0.8 + f1·0.2, 0) ; rotate(60°, eje (0.7071, 0, 0.7071)) ; glass
escala(0.875) ; rotate(60°, eje) ; rotate(f·3°, Y) ; glass
escala(0.875) ; rotate(60°, eje) ; rotate(f·3°, Y) ; cube
```

Sin la vuelta `S(−1,−1,1)` de los bichos: se dibuja con y para arriba, desde la posición del cristal.

### 7.3 Movimiento (`EntityDragon.onLivingUpdate`)

- **Anillo de movimientos:** 64 × [yaw, y]; al empezar se llena entero con el actual; cada paso
  `indice = (indice + 1) & 63` y se anota. `offsets(i, pt)`: `pt = vida ≤ 0 ? 0 : pt; pt = 1 − pt;
  a = (indice − i) & 63; b = (indice − i − 1) & 63; yaw = A.yaw + wrap(B.yaw − A.yaw)·pt;
  y = A.y + (B.y − A.y)·pt`.
- **animTime:** quieto (sentado) `+= 0.1`; si no, `f = 0.2 / (√(vx² + vz²)·10 + 1) · 2^vy`, a la
  mitad si va frenado.
- **Hacia el objetivo de la fase** (si hay):
  ```
  d = objetivo − pos;  d3 = |d|²;  f5 = fase.maxSubida (0.6; aterrizando 1.5; cargando y muriendo 3)
  vy += clamp(d.y / √(d.x² + d.z²), −f5, f5) · 0.1
  d4 = clamp(wrap(180 − atan2(d.x, d.z)·180/π − yaw), −50, 50)
  v1 = norm(d);  v2 = norm(sin yaw, vy, −cos yaw);  f7 = max((v2·v1 + 0.5)/1.5, 0)
  velYaw = velYaw·0.8 + d4·fase.factorYaw;  yaw += velYaw·0.1
  f8 = 2/(d3 + 1);  k = 0.06·(f7·f8 + 1 − f8);  vx += sin(yaw)·k;  vz −= cos(yaw)·k
  mover(v · (frenado ? 0.8 : 1))      // sin choques: atraviesa todo
  v3 = norm(v);  f10 = 0.8 + 0.15·(v3·v2 + 1)/2;  vx *= f10;  vz *= f10;  vy *= 0.91
  ```
  `factorYaw` por defecto: `f = √(vx²+vz²) + 1; 0.7 / min(f, 40) / f`; aterrizando: `min(f, 40) / f`.
- **Partes** (cajas para golpear, ser golpeado y romper bloques), con `f14 = (offsets(5)[1] −
  offsets(10)[1])·10°`, `c = cos f14`, `s = sin f14`, `sy = sin yaw`, `cy = cos yaw`:
  - cuerpo (5×3): `(x + sy·0.5, y, z − cy·0.5)`;
  - alas (4×2 y 4×3): `(x ± cy·4.5, y + 2, z ± sy·4.5)`;
  - con `f19 = sin(yaw − velYaw·0.01)`, `f4 = cos(…)`, `hy = quieto ? −1 : offsets(5)[1] −
    offsets(0)[1]`: cabeza (1×1) `(x + f19·6.5·c, y + hy + s·6.5, z − f4·6.5·c)`, cuello (3×3) igual
    con 5.5;
  - cola j = 0..2 (2×2): `a = offsets(12 + 2j)`, `g = yaw + wrap(a[0] − offsets(5)[0])`, `L = (j+1)·2`:
    `(x − (sy·1.5 + sin g·L)·c, y + (a[1] − offsets(5)[1]) − (L + 1.5)·s + 1.5, z + (cy·1.5 + cos g·L)·c)`.
  - Una parte de ancho w y alto h ocupa `x ± w/2`, `y .. y + h`, `z ± w/2`.
- **Choques** (si no lo lastimaron recién): bichos y jugadores en las cajas de las alas agrandadas
  (4, 2, 4) y corridas 2 para abajo salen empujados `(dx/d²·4, 0.2, dz/d²·4)` desde el centro del
  cuerpo y, si el dragón no está sentado, 5 de daño; en la cabeza o el cuello (agrandadas 1): 10 de
  daño.
- **Rompe bloques** en las cajas de cabeza, cuello y cuerpo, salvo barrera, obsidiana (49), piedra
  del End (121), roca madre (7), portal del End (119), marco (120), barrotes (101), puerta del End
  (209) y los de comandos; si tocó alguno de esos va **frenado** (×0,8). Partícula de explosión
  donde rompió. Usar `B.ponerBloque` (ya manda a la red en los servidores).
- **Sonidos:** aleteo cuando `cos(animTime·2π)` cruza −0,3 hacia arriba; rugido cada 200–400
  pasos si no está sentado; `hurt` al lastimarse; `death` una vez al empezar a morir.
- **Daño recibido** (`attackEntityFromPart`): primero la fase lo ajusta (sentado: las flechas no le
  hacen nada y salen prendidas fuego); si no es la cabeza, `daño/4 + min(daño, 1)`; sólo cuenta si
  viene de un jugador o de una explosión. Si llega a 0 y no está sentado → vida 1 y fase DYING.
  Sentado: si acumula más de 50 (¼ de la vida) → TAKEOFF.
- **Cristales que curan:** si tiene uno enganchado y vivo, cada 10 pasos +1 de vida; cada paso, 1 de
  10 veces, se engancha al más cercano a menos de 32 (o a ninguno).

### 7.4 Las fases

Grafo de vuelo (`initPathPoints`), 24 puntos con `top(x, z)` = el bloque sólido más alto + 1:

```
i < 12:  x = (int)(60·cos(2(−π + 0.2617994·i))),  z = (int)(60·sin(…)),  y = max(73, top + 5)
i < 20:  k = i−12: radio 40, ángulo 2(−π + 0.3926991·k),               y = max(73, top + 15)
resto:   k = i−20: radio 20, ángulo 2(−π + π/4·k),                      y = max(73, top + 5)
vecinos (bits): 6146, 8197, 8202, 16404, 32808, 32848, 65696, 131392, 131712, 263424, 526848,
                525313, 1581057, 3166214, 2138120, 6373424, 4358208, 12910976, 9044480, 9706496,
                15216640, 13688832, 11763712, 8257536
```

`masCercano(x, y, z)` (sin cristales vivos se saltean los 12 de afuera), `buscarCamino(desde,
hasta, despues)` = A* sobre ese grafo (si no llega, al más cercano alcanzado; `despues` se agrega al
final). Un camino avanza de a un punto; al ir a uno, el objetivo es `(px, py + azar·20, pz)`.

| fase | qué hace | sale a |
|---|---|---|
| HOLDING_PATTERN (volar en círculos) | objetivo nuevo si `d² < 100`, `> 22500` o choca. Al terminar un camino: 1 de (cristales + 3) → LANDING_APPROACH; si hay jugador a ≤ 64 del podio, `d0 = dist²(jugador, podio)/512` y 1 de (|d0| + 2) **o** 1 de (cristales + 2) → STRAFE_PLAYER. Si no, camino nuevo: `j = masCercano`, 1 de 8 cambia de sentido (`k = j + 6`), `k ± 1`; con jefe de pelea `k %= 12` (en PC la condición es `cristales >= 0`, o sea siempre el anillo de afuera), si no `((k − 12) & 7) + 12` | — |
| STRAFE_PLAYER (pasada con bola de fuego) | camino hasta el jugador (`despues` = su posición + `min(0.4 + dist/80 − 1, 10)` de alto). Si el jugador está a < 64 y se ve: carga +1 por paso; con carga ≥ 5 y el ángulo hacia él < 10°, **tira una bola de fuego** desde la cabeza (`cabeza − look`, `+ alto/2 + 0.5`) hacia el jugador y vuelve a HOLDING | HOLDING |
| LANDING_APPROACH | camino hasta el podio (el punto del anillo opuesto al jugador: `masCercano(−jx·40, 105, −jz·40)` con el vector del jugador normalizado), al terminar | LANDING |
| LANDING | objetivo: arriba del pilar del podio (`(0, top(0,0), 0)`); maxSubida 1.5; al llegar a < 1 → reinicia la cuenta de alientos | SITTING_SCANNING |
| SITTING_SCANNING (quieto, sentado) | gira hacia el jugador más cercano (≤ 20 de lado, ≤ 10 de alto) con `velYaw` (tope ±100, factor `0.7/min(d+1, 40)/(d+1)`); a los 25 pasos con jugador cerca → ATTACKING. Sin nadie, a los 100: si hay jugador a ≤ 150 → CHARGING_PLAYER a su posición; si no → TAKEOFF | ATTACKING / CHARGING / TAKEOFF |
| SITTING_ATTACKING | ruge 40 pasos | SITTING_FLAMING |
| SITTING_FLAMING | al paso 10, **nube de aliento** en la cabeza + 2,5 hacia adelante, bajando hasta el piso (radio 5, 200 pasos, daño instantáneo); partículas los primeros 10 pasos; a los 200: con 4 alientos → TAKEOFF, si no → SCANNING. La nube se borra al cambiar de fase | TAKEOFF / SCANNING |
| TAKEOFF | primer paso: camino a `masCercano(−look.x·40, 105, −look.z·40)` (anillo de afuera si quedan cristales, el del medio si no); cuando se aleja > 10 del podio | HOLDING |
| CHARGING_PLAYER | objetivo fijo (donde estaba el jugador); maxSubida 3; 10 pasos después de llegar (o pasarse) | HOLDING |
| DYING | objetivo: arriba del podio; mientras esté entre 10 y 150 de ahí la vida queda en 1; cerca → vida 0 y empieza a morir | (muerte) |

Las sentadas son "quietas": `animTime += 0.1`, no se mueve, el cuello se dobla para abajo
(`headPartYOffset = i`) y el aliento sale para adelante y abajo (`getHeadLookVec` con pitch −45°,
usado con el signo cambiado).

### 7.5 Los cristales

- Uno por pilar, en `(x + 0.5, alto + 1, z + 0.5)` (la roca madre del tope ya la pone `GenFin`), con
  fuego en su bloque (el cristal lo vuelve a prender si falta). La base sólo se ve en los del pilar.
- Cualquier daño que no venga del dragón: se borra, explota (poder 6, sin fuego, rompe bloques: las
  jaulas de barrotes se rompen, la obsidiana y la roca madre no) y avisa a la pelea: si era el que
  lo curaba, el dragón recibe 10 de explosión en la cabeza; la fase de vuelo pasa a STRAFE contra ese
  jugador.
- **Rayo de curación** (`renderCrystalBeams`), desde el dragón (2 más arriba) hasta el cristal:
  `f = sin((tick_cristal + pt)·0.2)/2 + 0.5; f = (f² + f)·0.2` (sube el punto del cristal);
  tubo de 8 lados: en el dragón radio 0,15 y color negro, en el cristal radio 0,75 y color blanco;
  `v` de `−(t + pt)·0.01` a `largo/32 − (t + pt)·0.01` (la textura corre). Se puede meter como una
  "capa" más en `dibujarEntidades` (textura `endercrystal_beam`), con su escritor de vértices.
- Hasta que se programe la reaparición (4 cristales en el borde del portal de salida), los cristales
  vivos se guardan en la partida del End (p. ej. `fin.cristales = [true × 10]`) o como bichos que
  persisten (`persiste`, se guardan en `bichos_lista_2`).

### 7.6 La pelea (DragonFightManager)

- Al entrar al End sin el dragón muerto (`fin.muerto` en la partida, campo del End) y con la zona
  del centro cargada: aparece en `(0, 128, 0)` en HOLDING, y los cristales que falten.
- **Muerte** (`onDeathUpdate`), `deathTicks` de 1 a 200: sube 0,1 por paso, yaw +20° por paso,
  explosiones grandes (sólo partículas) entre 180 y 200; experiencia: 12 000 la primera vez (500 las
  siguientes): `floor(xp·0.08)` cada 5 pasos después del 150 y `floor(xp·0.2)` al final
  (`Tirados.orbes`); sonido de muerte al empezar.
- Al final: el portal de salida **prendido** (`GenFin.podioEn(poner, true)`), el **huevo** (122)
  arriba del pilar del podio la primera vez, una **puerta del End** nueva y la barra del jefe fuera.
- Puertas (`spawnNewGateway`): 20 lugares `((int)(96·cos(2(−π + 0.15707963·i))), 75,
  (int)(96·sin(…)))` (truncado, no `floor`), en un orden barajado con `new Random(semilla)`; se usa
  uno por dragón muerto. `WorldGenEndGateway` en el cubo dx −1..1, dy −2..2, dz −1..1 alrededor de
  (x, 75, z): el centro es la puerta (209); el resto de la fila dy = 0, aire; en dy = ±2, roca madre
  sólo en la columna del centro (lo demás aire); en dy = ±1, roca madre en la cruz (dx = 0 o dz = 0)
  y aire en las esquinas. Al tocarla: teletransporte a ~1024 bloques en la dirección de la puerta
  (buscar tierra; si no hay, hacer una isla con `WorldGenEndIsland` en y 75) con una puerta de
  vuelta; usar `cambiarDimension(2, x, y, z, {puerta: …})` y resolver el suelo en `llegar()` (como
  la llegada al End).

### 7.7 Lo que se ve

- **Barra del jefe:** en `pantallas.js` (`P.hud`): `#boss_grid_dimension` → `[1, jefe ? 1 : 0]`; y en
  `coleccion('boss_bars', i, n)`: `#bossName` → nombre traducido, `#progress_percentage` →
  vida/200, `#visible`/`#bar_visible` → true. El jefe: el dragón si el jugador está a < 192 de
  (0, 128, 0); también el wither cercano (64).
- **Rayos de la muerte** (`LayerEnderDragonDeath`): `f = (deathTicks + pt)/200`, `f1 = f > 0.8 ?
  (f − 0.8)/0.2 : 0`; con un `java.util.Random(432)` (LCG de 48 bits, para que el dibujo sea el del
  juego), por cada i < `(f + f²)/2·60`: 6 giros al azar acumulados (X, Y, Z, X, Y, Z + f·90), largo
  `azar·20 + 5 + f1·10`, ancho `azar·2 + 1 + f1·2`; abanico de 3 triángulos: centro blanco con alfa
  `1 − f1`, puntas `(−0.866w, L, −0.5w)`, `(0.866w, L, −0.5w)`, `(0, L, w)` violeta con alfa 0;
  mezcla aditiva (`SRC_ALPHA, ONE`), sin escribir profundidad, desde `(0, −1, −2)` del modelo. Hace
  falta un programa chico de posición + color en `render.js`.
- **Partículas:** aliento violeta (nubes y boca), explosiones grandes. Hoy las partículas son
  cuadraditos de la lana blanca teñidos (máx. 400): para que se parezcan, sumar `particles.png` al
  empaquetado y elegir el cuadro.
- Bola de fuego del dragón: ya tiene dibujo (`dragon_fireball`, cartel grande que brilla).

### 7.8 Red

Cada bicho lo mueve su dueño (el que estaba cerca cuando apareció); a los demás les llega lo básico
(posición, yaw, estado). Con eso el dragón remoto se ve con el cuello y la cola derechos: aceptable
al principio. Que la pose no falle sin anillo.

### 7.9 Pruebas a escribir (`pruebas/dragon.mjs`)

Entrar al End (como `fin.mjs`), esperar el dragón y los 10 cristales; medir que vuela en círculos
(posición cambia, y entre 70 y 130), foto de cerca (modelo armado: alas, cuello, cola); romper un
cristal (explota, ya no cura); bajarle la vida a 0 con golpes a la cabeza (medir el daño por parte);
ver la muerte (sube, rayos, se disuelve), la experiencia, el portal prendido, el huevo y la puerta
nueva; la barra del jefe visible y bajando; 0 errores. Repetir en el HTML único.

---

## 8. #124: fortalezas, ojo de ender y portal del End (resumen para arrancar)

- Ubicación como PC 1.9+ (`MapGenStronghold`): anillos; el primero con 3 fortalezas a
  `4·32 ± 1.25·32` trozos (≈1408–2688 bloques), corridas a un bioma válido a ≤ 112 bloques.
- Piezas: `StructureStrongholdPieces` (pasillos, escaleras, cruces, bibliotecas, celdas, la sala del
  portal). Hacerla como las fortalezas del Nether (`nether.js`): tabla de piezas con pesos, cajas,
  armado desde el trozo con funciones puras.
- Sala del portal: 12 marcos (120) sobre lava, cada uno con 10 % de traer ojo (valor 0–3 = hacia
  dónde mira, +4 = con ojo), generador de lepismas (`GENERA` 6). Con los 12 ojos puestos, el 3×3
  del medio se llena de portal (119).
- Ojo de ender (objeto): vuela hacia la fortaleza más cercana, a los ~80 pasos cae como objeto (80 %)
  o se rompe (20 %). Usarlo en un marco le pone el ojo y prueba si se completa el anillo.

---

## 9. Trampas aprendidas en el Minecraft (además de PORTEO.md §13)

| trampa | qué pasó | cómo se evita |
|---|---|---|
| pruebas de node con `eval` | 25 ms por trozo (alcance dinámico) | `vm.runInThisContext` (2,5 ms) |
| `C.Azar` en flotantes | lento | estado en enteros de 32 bits (`| 0`); verificado que da exactamente lo mismo (`azar_igual.js`) |
| casillas de grillas con hijos explícitos (comercio) | sin colección: no se resolvían | `$item_collection_name` en `J.coleccionDe` |
| buscar "el botón de cerrar" por nombre | encontraba el panel entero (mapeo global) | buscar `c.t === 'button'` |
| probar interactuar con un bicho lejos | el botón no aparece (alcance 3,5) | poner al jugador al lado |
| ruido de la arena de almas | escala equivocada | `oct2(wx/256, …, 4, 0.5)·9` |
| `makePortal` primera pasada | orientación al revés | `if (!pasada && k3 % 4 >= 2)` |
| piezas de fortaleza "hay" | contaba piezas sin límite | sólo las limitadas con cupo (como `getTotalWeight`) |
| jugador lejos del generador en la prueba | caía fuera del trono | ponerlo adentro, volando |
| partículas del portal pegadas a la cámara | cuadrados enormes | sólo con d² > 4 y tamaño 0,025 |
| isla del End chica | el ruido simplex es más grande que el Perlin de PC | `K_RUIDO = 0.45` (radio ~95, superficie ~60) |
| un 404 en la consola al cargar | el favicon | se ignora (no es error de la página) |
| ver una textura del APK | paleta / alfa raros | convertir a RGBA y pegar sobre un fondo de color con Pillow, ampliado ×4 |

## 10. Para arrancar la próxima sesión (lista)

1. Leer este archivo y PORTEO.md; `git log --oneline | head` para ver dónde quedó.
2. Bajar los dos APKs (links en el historial del chat) a carpetas propias, verificar el sha256,
   extraer el de la 1.2 para leer datos.
3. `pip install pillow numpy`, `apt-get install -y opus-tools ffmpeg` si faltan.
4. `porteos/minecraft/portear.sh mc12.apk craftsman.apk /tmp/claude-0/mc12/salida`.
5. `node porteos/minecraft/pruebas/fin.mjs file:///tmp/claude-0/mc12/salida/Minecraft-1.2.html /tmp/f`
   → tiene que dar dimensión 2, endermans y 0 errores.
6. Programar el dragón (§7) → `pruebas/dragon.mjs` → commit + push (con la comprobación de secretos)
   → `portear.sh` → prueba en el HTML único → **mandar sólo el HTML** y avisar en una línea.
7. Seguir con §6.7.
