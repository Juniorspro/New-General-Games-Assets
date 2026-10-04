# Cómo se trabajó: de Tajo a WYRMGUARD

Sesión del **25/09/2026 al 30/09/2026**, rama `claude/hola-80z86i`, repo `New-General-Games-Assets`.
Este documento cuenta **qué se pidió, qué se hizo, cómo se hizo, qué salió mal y qué se aprendió**, en el
orden en que pasó. Está armado con tres fuentes: el historial de git (103 commits en el repo, los de esta
sesión van del `1811951` al `946b24f`), las notas de `memoria/` y los pedidos del usuario tal como quedaron
registrados. Las horas son las del contenedor.

Dónde está lo corto: `memoria/INDICE.md` (el índice) y `memoria/juegos.md` (las trampas pagadas, juego por
juego). Este archivo es la versión larga.

---

## 0. Todo en una pantalla

La sesión tuvo **dos etapas** con un quiebre en el medio (el 29/09, cuando el usuario trajo las guías de juegos
y empezó la serie de homenajes 2D).

| # | Fecha | Proyecto | Qué es | Commits |
|---|---|---|---|---|
| 1 | 25/09 | `tajo/` | Ritmo 3D tipo Beat Saber: se corta dibujando el tajo con el dedo | 5 |
| 2 | 25/09 | `mundo-ar/` | Prueba de 6DoF: APK nativo ARCore, página web (WebXR / AlvaAR) y APK WebView | 4 |
| 3 | 25–26/09 | `mundo-ar/xrslam/` | XRSLAM (SLAM de código abierto) compilado a WebAssembly, con calibración propia | 9 |
| 4 | 27/09 | `mando-360/` | Control remoto infrarrojo (RC6) de la Xbox 360 desde el teléfono | 1 |
| 5 | 27/09 | `asalto-mr/` | Shooter de realidad mixta: escaneo del entorno, hand tracking, armas, menús | 11 |
| 6 | 28–29/09 | `nexo-xr/` | Sistema de realidad mixta para Android (ventanas en el espacio, manos, entornos) y Nexo Web | 9 |
| — | 29/09 | `memoria/`, `guias/` | Índice, notas, `CLAUDE.md` y las guías de juegos 2D/3D | 1 |
| 7 | 29–30/09 | `shumio/` | **Shumio's Depths**: réplica de mecánicas de *The Binding of Isaac: Repentance*, arte propio | 14 |
| 8 | 30/09 | `noche/` | **Noche Carmesí**: homenaje a *Vampire Survivors*, vertical | 3 |
| 9 | 30/09 | `abyssfall/` | **ABYSSFALL**: homenaje a *Downwell*, vertical | 3 |
| 10 | 30/09 | `wyrmguard/` | **WYRMGUARD**: homenaje a *SNKRX*, acostado | 1 |

Los cuatro juegos de la serie 2D, hoy:

| Juego | Partes (`src/*.js`) | Líneas | HTML final | Orientación | Del pedido al primer commit |
|---|---|---|---|---|---|
| Shumio's Depths | 29 | 7 404 | ~506 KB | acostado | 15:44 → 16:15 (WIP); cierre el 30/09 02:19 |
| Noche Carmesí | 22 | 3 128 | ~250 KB | vertical | 03:29 → 04:07 |
| ABYSSFALL | 15 | 2 191 | ~159 KB | vertical | 11:27 → 11:54 |
| WYRMGUARD | 17 | 2 711 | ~240 KB | acostado | 12:26 → 13:11 |

Cada uno es **un solo archivo HTML sin red** (JavaScript, canvas 2D, WebAudio), armado por un
`construir.mjs` que concatena los módulos en orden. En el contexto se hicieron al menos diez resúmenes
automáticos porque la conversación se llenó; por eso las notas de `memoria/` importan tanto: lo que no queda
escrito en el repo se pierde en cada corte.

---

## 1. Quién pide y cómo pide

Lo que se sacó de unos 140 mensajes del usuario (muchos son sólo capturas), y que condiciona cómo se trabaja:

- **Habla en rioplatense informal** ("bro", "che", "chamaco") y se queja corto y concreto: "va para el culo",
  "se ve pésimo y feo", "la roca no parece roca". Una queja corta **siempre** señala algo medible; la tarea es
  encontrar qué.
- **Juega en su teléfono**: TCL 20 SE (T671E), Android 11, WebView/Chrome, 1600×720 acostado. Todo se pensó para
  eso y para PC. También usa un visor VR Box.
- **Quiere un archivo que abra**: un HTML, o un APK que se actualice solo. Nunca pasarle un APK a mano. Pidió
  desde el primer día "evita sobrecargar el repositorio".
- **Manda capturas** para mostrar los errores y como referencia del original. Cuando manda una captura del
  juego original es una orden: *replicá esa estética*.
- **Cierra una ronda diciendo "ya estaría completo" y a veces abre otra.** Pasó con cada juego (ver cada
  sección). No es una contradicción: lo que ve en el teléfono le muestra cosas nuevas. Por eso cada entrega
  tiene que ser verificable, no "debería andar".
- **Frases que se volvieron reglas**: *"no hagas nada de memoria"* (29/09), *"no cometas los errores de los
  juegos anteriores"* (30/09), *"no gastes tokens innecesariamente"*, *"que se sienta un juego completo ya desde
  el primer prompt"*.
- **Idioma de los juegos**: español como idioma de trabajo; **inglés por defecto** dentro de los juegos desde
  Noche Carmesí (lo pidió el 30/09; Shumio salió con idioma del navegador y se le agregó el selector).

---

## 2. Las reglas fijas

Están en `CLAUDE.md`, `memoria/INDICE.md` y `README.md § Las reglas`. Las que más pesaron:

1. **Al empezar**: leer `memoria/INDICE.md` y nada más; después sólo la nota que pida la tarea. No leer `.md`
   enteros. **Al terminar** cada tarea: anotar lo aprendido en `memoria/` (método en `MEMORIA.md`).
2. **Ningún secreto al repo.** Después de cada commit se corre `git grep` buscando las marcas de llaves y
   tokens (el patrón exacto está en `README.md § Las reglas`); el resultado tiene que estar vacío salvo el texto
   de la regla misma. Los keystores nunca se versionan (viven en `~/.cache`, fuera del repo).
3. **Rama de trabajo única**: `claude/hola-80z86i`. Commit y push al terminar cada tarea (el contenedor se
   borra). No hacer PR si no se pide.
4. **Nada de modelo/IA en commits ni en código**; los commits llevan sólo el trailer que pide la sesión.
5. **Todo en castellano rioplatense**, código y comentarios; los comentarios explican **por qué**, no qué.
6. **"Anda" sin un número al lado no vale**: medir antes de afirmar y decir qué **no** se probó.
7. **Nada de memoria para la estética del original**: comparar con capturas o con el video, siempre.
8. **No bajar archivos piratas ni copiar assets** de los juegos originales. Se replican mecánicas y se dibuja
   todo de nuevo (las imágenes de las wikis sólo sirven de referencia, en el directorio temporal).
9. **Límites de seguridad**: no se ayudó a saltar la autenticación de mandos de consola (se hizo el control IR
   en su lugar) y un servidor tipo Shizuku para abrir apps dentro de Nexo quedó **estacionado** (el modo
   automático lo marcó como superficie de ejecución remota); no se retoma sin un pedido explícito.

---

## 3. El método (el que quedó después de cuatro juegos)

No fue un plan escrito de antemano: se fue destilando de cada queja. Esta es su forma final.

### 3.1 El ciclo, paso a paso

1. **Memoria primero.** `INDICE.md` → la nota que corresponda. Con eso ya se sabe qué trampas se pagaron.
2. **Investigar fuentes primarias, en este orden de preferencia:**
   1. *Código abierto del juego original* (si existe y su licencia lo permite): da números exactos. Pasó con
      SNKRX (MIT). Se clona en superficial (`--depth 1`, con `GIT_LFS_SKIP_SMUDGE=1`) y se lee con `grep`/`sed`.
   2. *La API de la wiki* (MediaWiki `api.php` / `?action=raw`): datos y archivos de imagen. Fandom devuelve 402
      a las lecturas directas; por la API o el modo `raw` sí se lee.
   3. *La API de la tienda* (`appdetails` de Steam): las capturas oficiales en 1920×1080.
   4. *Las capturas y videos del usuario*: se miden de verdad (ver 3.3). **YouTube no se puede bajar** desde el
      contenedor (pide login); sí la miniatura `i.ytimg.com/vi/<id>/maxresdefault.jpg`. Si hace falta un
      video, se le pide una captura.
   5. *Búsqueda web* sólo para completar (ej.: cómo se controla SNKRX en Android).
3. **Decidir el alcance y la estructura.** Siempre la misma: `src/NN-nombre.js` numerados + `plantilla.html` +
   `construir.mjs` → un `index.html`. El armado **corta** si dos módulos definen el mismo nombre (ver 12).
4. **Armar primero la base**, antes de cualquier contenido:
   pantalla con **escala entera** (`PX`), bucle fijo a **60 Hz** con la entrada consumida al final del paso,
   entrada multitoque real, **audio horneado**, **letra propia** y la herramienta de dibujo (`Pix`/pintor).
5. **Datos declarativos**: las tablas del juego (héroes, armas, objetos, niveles) van en archivos de datos,
   sacadas de la fuente y no escritas "a ojo". La lógica las lee.
6. **Sistemas** (movimiento, combate, tienda, jefes), con las fórmulas del original donde se conocen.
7. **Arte medido**, no inventado: se pone el sprite al lado de la referencia, ampliado con vecino más cercano, y
   se corrige hasta que la lectura coincida (ver 3.3).
8. **Pruebas automáticas** (ver 3.2).
9. **Mirar las capturas con los ojos** antes de entregar: hojas de contacto con varias pantallas en una imagen.
   Cuatro de los errores más feos del proyecto los encontró una hoja de contacto, no un test.
10. **Cierre**: nota en `memoria/`, fila en `README.md`, commit con trailer, chequeo de secretos, push, copiar el
    HTML a `salida/<Nombre>.html` (carpeta ignorada), enviar el archivo + una hoja de capturas, y un resumen
    corto que dice **lo que no se probó**.

### 3.2 Pruebas: qué se mide con qué

Todo corre en Chromium sin GPU (swiftshader), con Playwright, contra un origen https de mentira servido con
`page.route(...)` (da contexto seguro y evita el proxy). Cada juego tiene su carpeta `pruebas/`:

| Prueba | Qué verifica |
|---|---|
| `jugar.mjs` | **Un bot que juega entero**: esquiva, compra, elige objetos, sube de nivel. Anota nivel por nivel, tiempo de paso y errores de consola |
| `pantallas.mjs` | Fotos de cada pantalla con un estado armado a mano (tienda llena, jefe, pausa, derrota, victoria…), en inglés, en castellano y con el teléfono parado |
| `tactil.mjs` | **Toques de verdad** por el protocolo de depuración (CDP): menús, comprar, doblar con cada mitad, pausa. Un dedo no es un clic: acá se encontraron bugs que el mouse no mostraba |
| `audio.mjs` | Cuánto tarda el horneado, pico y nivel de cada tema (que no sature) y un medidor a la salida en vivo |
| `heroes.mjs` / `objetos.mjs` | Que cada héroe/objeto **haga algo** y que todos juntos no tiren excepciones |
| `jefes.mjs`, `hoja.mjs`, `idioma.mjs` | Los jefes, las hojas de sprites y los textos sin traducir |

Dos trampas de método que se pagaron y quedaron escritas:

- **Entre el `evaluate` y el `screenshot`, el bucle real del juego sigue corriendo.** Para fotos quietas hay que
  congelar el estado o capturar el lienzo en la misma llamada.
- **Una captura vieja engaña.** En ABYSSFALL `jugar.mjs 30` no escribía `j-30s.png` (el bucle corta antes) y la
  captura vieja parecía un error de dibujo. Mirar la fecha del archivo.

### 3.3 Cómo se mide la estética (lo que reemplazó al "a ojo")

- Bajar las capturas oficiales y **ampliarlas con vecino más cercano**; contar píxeles. Ejemplos medidos:
  letras de 7 px de alto con palos de 2 (Downwell), rótulos de 10×10–12 px sobre franja negra de 21 px
  (Isaac a 480×270), píxeles de gris del fondo (#292929 afuera, #323232 la arena en SNKRX).
- **Imprimir los píxeles de la referencia como ASCII** para ver la forma real (así se leyó el sprite del
  protagonista de Downwell: alto y fino, con los miembros separados por líneas negras).
- Un script que dibuja los sprites desde texto a ×14 y ×4 **al lado de la referencia** (`heroe.py`). Se itera
  hasta que la silueta, a tamaño de juego, se lea igual.
- Para animaciones y tiempos: contar cuadros del video (el de Isaac a 15 fps: la banda crece en 6 cuadros, el
  texto pasa de largo +11 px, se queda 1,76 s, sale en 3 cuadros).

### 3.4 Cómo se aprendió: queja → causa → regla

Cada queja del usuario se trató como un bug con causa raíz, no como un pedido de "retocar". La tabla grande
está en la sección 12; acá el mecanismo: **(a)** reproducir con una captura, **(b)** medir contra la referencia,
**(c)** arreglar la *clase* de error (no sólo la instancia), **(d)** escribirlo en `memoria/`, **(e)** poner una
guarda en el armado o en las pruebas para que el próximo juego no lo repita.

---

## 4. El entorno (lo que condicionó todo)

- **Contenedor Linux sin GPU y sin emulador Android** (no hay KVM). Por eso los APK **nunca se probaron en un
  teléfono desde acá**: se arman, se verifican la firma y las clases, y se prueba la lógica pura en la PC.
- **Chromium** en `/opt/pw-browsers/chromium` (nunca `playwright install`). Dibuja con swiftshader: los fps de
  acá no dicen nada del teléfono. Los temporizadores de la página se atrasan en escenas pesadas.
- **Proxy de salida**: Chromium llega a internet sólo con `proxy: { server: HTTPS_PROXY }`; si falla el
  certificado, hay que reinstalar el CA del proxy en la base NSS (receta en `memoria/maquina.md`). `localhost`
  también pasa por el proxy y da 405: por eso se sirve con `page.route`.
- **APK sin Gradle**: `aapt2` + `javac -source 8` + `d8` + `zipalign` + `apksigner`, con las herramientas en
  `~/.cache/mundo-ar`. Hubo que sacar los `MethodParameters` de las clases con un script porque javac 21 + d8
  se caían con las clases anónimas.
- **Hosting de HTML**: GitHub raw sirve texto plano; `raw.githack.com` sirve HTML pero **cachea la rama**: para
  mostrar algo recién subido se usa el link con el hash del commit. Cloudflare Pages para los sitios (token fuera
  del repo).
- **GitHub sólo por las herramientas MCP** de la sesión. Los conectores *graphify* y *mint* piden autorización
  en la configuración de conectores de claude.ai y siguen sin usarse.

---

## 5. Etapa A (25–29/09): antes de Shumio

El usuario empezó con una conversación de ritmo 3D y realidad aumentada. Son **proyectos distintos** de los
juegos 2D, pero de acá salió casi toda la disciplina de método (pruebas con bot, toques reales, "medir antes de
afirmar", archivos únicos).

### 5.1 `tajo/` — Beat Saber dibujando el tajo (25/09)

- **Pedido:** un juego 3D tipo Beat Saber donde el corte se dibuja con el dedo en la pantalla, "idéntico" a un
  TikTok (*Runaway Baby* en Beat Saber).
- **Qué se hizo:** three.js r160 incluido en el repo; dragón de neón, escenario y bloques instanciados con
  planos de recorte locales; bloom dual-kawase; corte por barrido en espacio de pantalla; sintetizador y
  compositor propios con **3 canciones originales**; un modo **"tu canción"** que mapea solo un audio que
  cargues; generador de mapas por dificultad con validador.
- **Cómo se probó:** 15/15 mapas validan, un bot los completa al 100 %, 5/5 casos de toques reales, el
  auto-mapeador afinado contra música real, el archivo único abre desde `file://`.
- **Errores que enseñaron:**
  - El render de audio sin conexión tardaba más de 10 minutos porque se agendaban todos los eventos juntos →
    se agenda por ventanas con `ctx.suspend(t)`.
  - Los toques por CDP llevaban marcas de tiempo atrasadas con el bucle ocupado → en las pruebas se congela el
    bucle y se lo avanza a mano.
  - `librosa` daba tempos equivocados; se verificó con energía de peines coherente, se corrigió un desfase de
    +46 ms (centro de ventana) y se afinó el mapeador.
  - La sonda arrancaba a mitad de canción y marcaba notas anteriores como perdidas → parámetro `desde`.
- **Decisión de repo:** "evita sobrecargar el repositorio" → el archivo único de 5 MB se **sacó del repo** y se
  arma local con `python3 tajo/empaquetar.py`.

### 5.2 `mundo-ar/` — 6DoF en APK nativo, web y WebView (25/09)

- **Pedido:** un mundo 3D anclado con cámara, botón de flash, pantalla girada 90°, "en APK" para probar si anda
  el 6DoF nativo con ARCore; después "en un HTML para un WebView o hosteado".
- **Qué se hizo:** APK nativo con ARCore 1.56; página web con tres modos (WebXR con hit-test, SLAM con AlvaAR en
  WebAssembly, 3DoF con giroscopio); APK WebView que carga esa página.
- **Resultado y giro:** el usuario probó el WebView y dijo que **"anda horrible"**. De ahí salió la pregunta
  clave: ¿se puede un SLAM mejor en una página? → ver 5.3.

### 5.3 XRSLAM en WebAssembly (25–26/09)

- **Pedido:** buscar en GitHub alternativas abiertas y mejores que 8th Wall; el usuario eligió XRSLAM
  ("al ser código abierto quizás podamos mejorar lo que esté mal").
- **Qué se hizo:** compilarlo nativo y a WebAssembly, **medirlo contra EuRoC** (un conjunto de datos estándar de
  SLAM), traer los sensores del navegador, estimar solo el desfase cámara-IMU, y detectar piso, mesas y paredes
  como los planos de ARCore.
- **La parte difícil fue el diagnóstico en el teléfono del usuario**, sin poder verlo: sus mensajes "No calibra",
  "No carga", "No hace na", "Pos 0 siempre" fueron cada uno un bug distinto. Se respondió con herramientas, no
  con suposiciones: relojes que no retroceden, calibración robusta, mensaje que **dice por qué no arranca** y un
  botón **"Copiar diagnóstico"** para pegarlo en el chat. Es el origen de la costumbre de poner diagnóstico
  copiable dentro de la app.

### 5.4 `mando-360/` — control IR (27/09)

- **Pedido:** conectar el teléfono a una Xbox 360 como mando.
- **Qué pasó:** no se ayudó a saltar la autenticación de mandos de la consola (se explicó y se ofrecieron
  alternativas). Se hizo lo legítimo: un **control remoto por infrarrojo (protocolo RC6)** usando el emisor IR
  del teléfono para manejar menús y multimedia.

### 5.5 `asalto-mr/` — shooter de realidad mixta (27/09)

- **Pedido:** recrear en ARCore el video de un shooter MR (un TikTok de Quest 3S): escaneo del entorno por
  **polígonos** (no mesas y sillas), cámara ultra angular si se puede, visión SBS configurable. Después:
  completar lo no visto, "IA de zonas", hand tracking con la pistola en la mano y detección del disparo,
  mejores armas y menús, "no pares hasta que detecte todo bien".
- **Qué se hizo:** TSDF por voxeles + malla por *surface nets*; mapa 2.5D con clasificación (piso, pared,
  cobertura), A*, zonas inferidas; Depth API y semántica de ARCore; MediaPipe Hand Landmarker; 4 armas
  (pistola, fusil, escopeta, lanzagranadas con rebote), tipos de soldado, modos oleadas / contrarreloj /
  práctica, menús en el mundo.
- **El quiebre de calidad:** el usuario pasó un APK de otra app (*aeroplaza*) cuyo hand tracking era "súper fijo".
  Se **portó su filtro** (palma rígida, forma aprendida, filtro One Euro, retención de pérdida) y se agregó la
  **mano fantasma estilo Quest** con borde que brilla y oclusión. Después vinieron el sellado automático de
  huecos con su vista, un escaneo más rápido, el control Bluetooth del VR Box y arreglar que el arma no apuntaba
  adelante.
- **Error que dejó una regla de construcción:** "No abre" — el APK salía **sin la clase del HUD** (`javac` había
  fallado en silencio). Desde ahí `construir.sh` es **estricto**: falla si `javac` falla, si algún `.java` no
  produjo su `.class` o si `d8` reporta clases faltantes.
- **Cómo se probó sin teléfono:** pruebas de Java puro en la PC (`correr.sh`), compilación de los shaders en
  Chromium, vistas previas renderizadas con un *stub* de GLES20 que graba las llamadas, y pruebas de MediaPipe
  de punta a punta en Python.

### 5.6 `nexo-xr/` — un "sistema Meta" para Android (28–29/09)

- **Pedido (tras decir que Asalto "anda mal"):** "una app Meta Quest con pantallas y todo, muy bien
  desarrollada, completa". Se aclaró con preguntas: app Android que imite el sistema (cámaras, entornos 3D,
  pantallas, clics con el dedo), APK nativo, sin visor externo. Se usó nombre e íconos propios ("inspirado en").
- **Qué se hizo:** ventanas reales (un `VirtualDisplay` + `Presentation` que se pinta en una textura y recibe
  toques inyectados), escritorio de tres ventanas, puntero por manos con gestos de pellizco, entornos con
  shaders analíticos, *passthrough*, SBS con lentes, linterna, **actualización automática** (`publicar.sh` +
  ventana "Actualizar"), **Nexo Track** (para que el mundo deje de moverse solo), **Nexo Inicio** (marcar la
  mesa y fijar manos y cabeza antes de empezar), apps web con navegador de pestañas, mini-apps nativas, clic con
  **doble pellizco**, 3DoF con manos y **Nexo Web** (el mismo sistema en un HTML).
- **Pruebas:** 168 verificaciones en PC, 8 programas de shader compilados, vistas previas.
- **Estado:** nada de Nexo se probó en un teléfono desde acá. El usuario dijo que el hand tracking web "va para
  el culo"; se mejoró (`af11521`) y se pidió una captura de la app Cámara. Sin respuesta hasta ahora.

---

## 6. El quiebre del 29/09: memoria y guías

El 29/09 el usuario volvió a mandar tres archivos (`GUIA_JUEGOS_2D_PIXEL.md`, `MEMORIA.md`, `GUIA-JUEGOS.md`) y
dijo **"haremos un juego nuevo a partir de ahora"**. Ese mismo día se armó (`d16bb79`):

- `CLAUDE.md` con tres reglas: leer sólo el índice, no leer `.md` enteros, anotar al terminar.
- `memoria/` con `INDICE.md`, `juegos.md`, `maquina.md`, `nexo.md` y `diario.md`.
- `guias/`: la guía de juegos **2D pixel** (escala entera, personajes por piezas, bucle a paso fijo, bot que
  juega los niveles, lista de trampas) y la de 3D con Rezona.

La serie 2D se construyó **sobre esa guía**. Lo importante de ese cambio: dejó de ser una conversación y pasó a
ser un **repositorio con memoria**, donde cada juego hereda las lecciones del anterior.

---

## 7. Etapa B-1 — Shumio's Depths (29/09 → 30/09)

### 7.1 El pedido y la decisión

> "Un juego 2D, pixelart, profesional, ultra detallado, que no parezca generado por IA, réplica exacta de *The
> Binding of Isaac: Repentance*. Optimizado para celulares (TCL 20 SE)… busca toda la información… si llegás a
> encontrar un archivo rar o una versión móvil en GitHub, bajalo… fiel al original pero no un plagio, una visión
> nueva. Se va a llamar **Shumio's Depths**."

**Decisión:** *no* bajar versiones pirateadas ni copiar sprites o sonidos. Se replican **mecánicas y sistemas**
con **arte propio en el mismo lenguaje visual**. El protagonista es **Shumio**, un nene-hongo que llora esporas.

### 7.2 La base técnica

- **Mundo en un lienzo chico, escalado a entero** (`PX = ⌊altura/236⌋`: ×3 en el TCL → mundo de 534×240). La
  sala son 13×7 baldosas de 24 px (368×224).
- **Bucle fijo a 60 Hz**, con la entrada consumida al final del paso; dos azares separados: el del mundo
  (con semilla, `A.*`) y el visual (`V.*`).
- **Pintor de píxeles** (`Pix`: esferas sombreadas, cajas, líneas, sellos de texto, contornos, espejo) con
  paleta limitada y *hornear una vez* en un caché.
- **Ayudantes de precisión** que nacieron de la primera queja: `trazo()` (líneas continuas), `selloC()` (centra
  un sello y **avisa en consola** si cayó a medio píxel), `parDeOjos()` (ojos espejados con el brillo en la
  misma posición relativa).

### 7.3 La investigación (lo que se midió del original)

- Un **informe de investigación** (sacado de la wiki por un subagente) con las fórmulas: daño
  `(base·√(subas·1,2+1)+plano)·mult`, cadencia `30/(retardo+1)` con `retardo = 16−6√(1,3·T+1)`, prioridades de
  ataque (Epic Fetus > cuchillo > Dr. Fetus > Tech X > Ludovico > Brimstone > Technology > lágrimas), unas 25
  sinergias famosas, transformaciones (Guppy, Beelzebub, Fun Guy, Seraphim, Bob, Spun…), cofres, precios de
  tienda, tratos con el diablo. Las páginas crudas quedaron en un directorio temporal; `fetch.sh "Página"` las
  vuelve a traer de la API de la wiki.
- **Generación del piso**: grilla de 9×8 desde la celda 35, expansión por BFS con las reglas del original
  (descartar vecino ocupado, con 2+ llenos, con el cupo cumplido, o 50 % al azar); cantidad de salas
  `azar(2)+5+nivel·2,6`; jefe en el callejón más lejano; sala secreta en un hueco con 3+ vecinos.
- **El video que mandó** (una carrera de Repentance de 1 min 3 s) y varias capturas: de ahí se midieron el
  tamaño de los corazones (13×11), los dígitos (8 px), las stats finas al 60 % de opacidad, la barra del
  jefe (108×7 #D40000 con calavera), la transición de sala (8 cuadros), el mosaico del pozo (96 + 18 + 72
  cuadros) y los **tiempos de los rótulos** (ver 3.3).

### 7.4 Lo que se construyó

- **Sistemas**: pisos y salas, puertas, lágrimas, stats, enemigos y jefes, secretas, tienda, tratos con el
  diablo, cofres de cinco tipos (normal, dorado, de piedra, de pinches…), corazones rojos/azules/**negros**.
- **Objetos**: tabla declarativa con **133 objetos** (`st`/`f`/`tags`), una función `recalcular(j)` que arma las
  cuentas, el arma y el multidisparo con las fórmulas de la wiki; **armas componibles** con prioridad;
  **lágrimas** cuyo aspecto cambia por objeto (colores tomados de las imágenes de la wiki); transformaciones;
  familiares; íconos.
- **Arte** (tras ver el video): estilo **dibujado, no pixel art duro** — sin tramado Bayer, degradados
  continuos, contornos automáticos, piso pintado con baldosas irregulares, paredes de ladrillo con sombra y
  viñeta. Rótulos de zona y de objeto, pergamino de maldiciones y menús con papel rasgado, medidos sobre el
  original.
- **Pantalla**: siempre horizontal (si el teléfono está parado, se gira el lienzo 90° por CSS y se
  convierten los toques), pantalla completa en el primer toque, y una **cámara que muestra la sala entera**
  (`VISTA_H = SALA_H + 4`, medido en el video).
- **Sonido**: ver 7.6, la parte más cara del juego.
- **Idioma**: español/inglés con un diccionario `EN` y una función `tr()` que traduce **al dibujar** (todo se
  escribe en español; texto nuevo → una línea en `EN`; `pruebas/idioma.mjs` avisa lo que falte).

### 7.5 La cronología real: qué dijo el usuario y qué cambió

| Hora (29/09) | Queja o pedido | Qué se encontró / se hizo |
|---|---|---|
| 16:00 | "Trazos corridos; la cabeza de Shumio de costado parece corrida hacia atrás" | Sellos a medio píxel → `selloC`, `parDeOjos`, avisos en consola |
| 18:17 | "Título y letras del HUD, sacados del MD, son genéricos" | Estudiar la estética textual del Repentance real |
| 18:28 | "Acordate que es móvil **y** PC" | Mouse + teclado además del dedo (hover y clic en menús) |
| 18:32–18:39 | "Los nombres de zona y subtítulos siguen sin ser iguales… **no los miraste, no hagas nada de memoria**" | Nace la regla 7. Se reconstruyen contra capturas |
| 18:48 | Manda el video y capturas | Se miden rótulos, bandas, tiempos (3.3) |
| 19:03 | "Las maldiciones muy rectas; los títulos no centrados y pegados al subtítulo" | Pergamino dibujado como el real, centrado en la mancha |
| 19:23 | "Demasiado pixelart; el sonido muy chiptune; traspasa pedestales; no usa cofres; horizontal por defecto y pantalla completa; faltan objetos con sinergias" | Estilo dibujado, sonido tocado, colisiones, cofres, cámara, ~100 objetos con sinergias |
| 20:30 | "Corazones negros; música y sonidos; hay textos `undefined`; las lágrimas no cambian por objeto; las puertas de abajo y la barra del jefe se cortan" | Guarda de nombres duplicados, aspecto de lágrima por objeto, cámara de sala entera |
| 20:49 | "Sigue sin sonido; no hay animación al agarrar objetos; los objetos se mueven aunque no los pueda usar" | Animación de levantar (0,8 s, medida a 15 fps), lo que no se agarra **se empuja** |
| 21:02–21:11 | "No suena nada… la página de prueba sí sonó, es el juego" | Ver 7.6 |
| 23:10 | "Limpiá los menús de las pruebas de sonido" | Diagnósticos fuera de la interfaz (quedan en el código) |
| 02:13 (30/09) | "Opción de idioma español/inglés" | `tr()` + `EN` |

### 7.6 El caso del sonido ("no suena") — cómo se llegó a la causa real

Fue la queja más repetida (tres veces) y la que más se tardó en entender. Ordenado:

1. **Primer intento:** se creó el audio recién al primer gesto real. En Android el `pointerdown` de un dedo
   **no** es un gesto válido para el navegador (sí lo son `pointerup`, `touchend` y `click`): se movió el
   despertar ahí. En Chromium de escritorio no se reproduce.
2. **Segundo intento:** diagnóstico en pantalla y un medidor de nivel a la salida. En Chromium daba señal
   (−16 a −22 dB): el motor *andaba*. Se agregó una salida alternativa por `<audio>` y una página
   `prueba-sonido.html` con tres caminos (directo, reproductor, archivo WAV) para que el usuario probara.
3. **El dato clave:** la página de prueba **sonó en los tres caminos** en su teléfono, pero el juego no. O
   sea, el problema no era permisos ni parlante.
4. **Causa real (medida):** el motor **sintetizaba todo en vivo** y **no entraba en tiempo real** en el TCL. En
   un servidor con CPU de escritorio, el tema del jefe se calculaba sólo ~4× más rápido que el tiempo real
   (una prueba simple de 3 osciladores: 600×). Android corta o entrecorta la salida aunque el medidor marque
   nivel.
5. **Arreglo estructural:** un **banco de muestras horneadas**. Cada primitiva y cada efecto se renderiza **una
   vez** con `OfflineAudioContext` (mono, 24 kHz, reverb incluida, recortado) y en vivo sólo se reproduce un
   buffer. Resultado medido: 71–152× más rápido que el tiempo real en vivo; efectos listos en 3,3 s y música
   del menú en 5,8 s *incluso con la CPU ×6 más lenta*; banco de unos 30 MB.
6. **Regla para siempre:** antes de sumar un instrumento, **medir el costo del audio** (render / duración) y
   apuntar a ≥50×. Ese motor (hornear notas y sumarlas, reverb por peines en JS, normalizar a pico 0,85) se
   reutilizó en los tres juegos siguientes.

### 7.7 Lecciones de Shumio (las que se heredaron)

- Un solo `<script>` + dos funciones con el mismo nombre = una pisa a la otra **sin avisar** (`bloqueSpr` de la
  letra pisó al del bloque de piedra y se dibujaba la palabra "undefined"). Se agregó la guarda al armado.
- La cámara debe mostrar **la sala entera** (HUD y puertas incluidos): medirlo en el original.
- Lo que no se puede agarrar se **empuja** en vez de quedarse trabado.
- Siempre probar **dedo y mouse/teclado**; con mouse no hay joysticks.
- Los diagnósticos se dejan en el código pero **no** en la interfaz del usuario final.

### 7.8 Deuda abierta de Shumio

- **Error de luz en el pintor** (`Pix.bola`, ver 8.3): se arregló en Noche y ABYSSFALL, **no** en
  `shumio/src/04-pintor.js` (cambiaría todo el aspecto del juego ya aprobado; **preguntar antes**).
- No se probó en un teléfono desde acá, aunque el usuario sí lo probó en el suyo y devolvió las quejas de arriba.

---

## 8. Etapa B-2 — Noche Carmesí (30/09, 03:29 → 10:59)

### 8.1 El pedido

> "Otro juego HTML, esta vez **vertical**, inspirado en *Vampire Survivors*; te adjunté imágenes y un video…
> tiene que verse profesional, lo tenés que sacar **de un solo prompt, no gastes tokens innecesariamente**."

Con tres capturas y un video de YouTube (que no se podía bajar; se pidió y se trabajó con las capturas).

### 8.2 Cómo se armó de un tirón

- Mismo esqueleto: `src/*.js` → `construir.mjs` → HTML (22 partes al final; 20 en la primera entrega). Sondas `window.__NC`.
- **Los números salen de la wiki**, leída por `?action=raw` (Fandom da 402 a las lecturas directas): armas y
  tablas de nivel, evoluciones, pasivos, precios de la tienda (`base·(1+comprados)+⌊20·1,1^total⌋`), curva de
  XP (5, +10 hasta 20, +13 hasta 40, +16; +600 en el 20 y +2400 en el 40), oleadas, vida/daño/velocidad de
  enemigos, 240 ms de invulnerabilidad. Todo en `08-datos.js`.
- Contenido: **11 cazadores, 11 armas con sus 11 evoluciones, 16 pasivos**, tienda de mejoras, dos escenarios
  con oleadas minuto a minuto, cofres, braseros y la Parca a los 30:00.
- **Audio** con banco de notas (cada nota distinta se hornea una vez y el tema se suma en JS): renderizar el tema
  entero tardaba 5,2 s (5× el tiempo real) → todo el sonido en 1,2 s.
- Medido (sin GPU, no dice nada del teléfono): con 280 enemigos, el paso cuesta ~0,45 ms y el dibujo ~3,7 ms.

### 8.3 Las tres rondas de correcciones

**Ronda 1 — "inglés por defecto, sprites chuecos, letra del MD, el cronómetro no está centrado".**
- *Idioma por defecto:* inglés.
- *Letra:* se miró la letra real del juego en capturas de la wiki: **máquina de escribir con remates tipo
  Courier, negrita, blanca con contorno negro**. Se usó **Courier Prime Bold** (licencia OFL), recortada con
  `pyftsubset` a 16 KB e **incluida en base64** en el HTML (cero red). GitHub raw está bloqueado: la fuente se
  bajó de Google Fonts → gstatic.
- *Dos pasadas por cuadro:* el mundo en el lienzo chico (pixel art) y la interfaz directo en pantalla con
  `setTransform(PX)`, así el texto se hornea a **resolución real** y queda nítido; la letra de píxeles quedó sólo
  para el logo.
- *Sprites chuecos:* los sellos tipeados a mano salían torcidos → se rehicieron **por piezas** (`humano()` con
  peinados, capas y sombreros; un constructor por enemigo) y se verifican con una hoja (`pruebas/hoja.mjs`).
- *Reloj centrado* en `W/2`.

**Ronda 2 — "título pequeño, letras genéricas, texto desigual; la anatomía está rara".**
- *Logo:* letras góticas de bloque ×2 con palos de 3, relieve hondo, cara que va de hueso a sangre en damero,
  sangre que chorrea, murciélago de escudo, filetes con rombos para emparejar "NOCHE" con "CARMESÍ", un brillo
  que cruza cada 4 s y la luna de sangre detrás.
- *Anatomía:* las cabezas "parecían invertidas". **Causa raíz medida:** en `Pix.bola` el **signo del lambert**
  estaba cambiado y las esferas se iluminaban desde **abajo a la derecha** (con la luz declarada "arriba a la
  izquierda", el píxel más claro era el de abajo-derecha). Cabezas redondas iluminadas de abajo + torsos de caja
  iluminados de arriba = personajes con la cabeza al revés. Se midió con una bola de prueba antes de arreglar.

**Ronda 3 — "los brazos y los pies parecen invertidos".**
- Había una **mezcla de vistas** (cuerpo de frente + cabeza de costado se lee torcido). Se rehizo todo en **una
  sola vista de tres cuartos**: oreja y pelo atrás; ojos y boca adelante; brazo lejano que asoma por la
  espalda; brazo cercano en el borde de adelante del torso; hebilla y punta de las botas hacia adelante; paso de
  **4 cuadros** con brazos al revés de las piernas.
- *Trampa de pruebas:* las pruebas de toques tienen que esperar a que la pantalla nueva **se dibuje**
  (`UI.pantallaFoco === PANT`) antes de tocar un botón.

**Lección que quedó:** medir con un objeto de prueba antes de confiar en un comentario de luz; y mezclar vistas
es un error de diseño, no de pixel.

---

## 9. Etapa B-3 — ABYSSFALL (30/09, 11:27 → 12:19)

### 9.1 El pedido

> "Otro juego HTML en vertical, inspirado en *Downwell*… profesional, coherente, completo, de manera eficiente…
> copiá mecánicas, estética y objetos, pero **no un plagio**, un juego nuestro. Inventale un título épico en
> inglés. **No cometas los mismos errores de Shumio y Noche.** No uses la fuente del MD de ninguna manera:
> buscá cuál es la de Downwell y replicala."

### 9.2 Cómo se armó

- **Reglas de la wiki** (por su API): 4 de vida, 8 de carga (se llena al tocar piso o pisar un enemigo),
  **blanco se pisa / rojo no** (el color *es* la regla), combos 8/15/25 → +100 gemas / +1 carga / +1 vida,
  Gem High con 100 gemas, módulos de arma con costo por disparo, 3 mejoras por nivel, tienda con +200 por zona.
  Las velocidades en píxeles quedaron a ojo (`FIS` en `08-datos.js`).
- **Tres colores lógicos** (fondo, tinta, acento): cambiar de paleta es **rehornear** los sprites
  (`ponerPaleta`). Siete paletas.
- **Letra propia**: mayúsculas de píxel **gordas** (palos de 2 px, 7 de alto) medidas en las capturas del
  usuario, con sombra de acento y borde del color de fondo. Nada de las guías.
- **Controles reales de móvil**: dos zonas de pulgar a la izquierda (◀ ▶ por cuartos de pantalla) y salto/disparo
  a la derecha, **multitoque** real; el disparo sólo si el toque empezó en el aire (si no, saltar con el botón
  apretado gasta la carga).
- Contenido: 7 armas, 16 mejoras, 4 zonas más un jefe ("THE MAW"), salas laterales (tienda, módulo de arma, veta
  de gemas), 7 paletas, 4 estilos, y el motor de audio horneado de las rondas anteriores con recetas nuevas.

### 9.3 Las trampas que salieron (y se arreglaron en el momento)

1. El bot que invierte la dirección contra la pared **tiembla** sin avanzar.
2. Comprar **tocando**: al entrar caminando a la tienda se compraba todo → las cosas **flotan a la altura de
   un salto**; se compra saltando hacia ellas.
3. Avanzar de pantalla con el `pointerdown` hace que el `pointerup` caiga en el botón de abajo (cambiaba el
   idioma) → se avanza **al soltar**.
4. `PAL` chocaba con una constante del pintor → renombrar (el armado lo detectó).
5. La sala lateral debe **llenar la pantalla** con cámara fija.

### 9.4 Dos rondas de estética

**Ronda 1 — "se siente extraño, muy brilloso, el arte terrible, la roca no parece roca" (con una captura del
Play Store).**
- La roca fue reescrita **tres veces**: primero con motas sueltas (parecía estática de tele), después como baldosa
  blanca entera (encandilaba), y por último **como en el original**: la masa es **negra** y sólo la cara que da
  al vacío lleva un **empedrado** de adoquines blancos con juntas negras, lleno en el filo y desgranado hacia
  adentro, con esquinas.
- Bloques como **losas** de piedra con juntas en zigzag (con contorno parecían un cajón; con piedritas, lunares).
- **Botones siempre visibles** abajo (dos flechas en relieve y el salto cuadrado), **arranque a cielo abierto**
  con estrellas y el logo, nombre del nivel chico, barra del jefe arriba (abajo la tapaban los botones).
- Medido: afuera y arena casi negros; "brilloso" venía de baldosas blancas enteras.

**Ronda 2 — "el sprite del jugador se ve pésimo".**
- El original es **alto y fino, con los miembros separados por líneas negras**; el nuestro era un bloque cabezón
  con un ojo (se leía como robot de frente). Se imprimieron los píxeles de la referencia como ASCII y se
  diseñó un **buzo del abismo de perfil** (11×14): casco con visor adelante y brillo, tanque de aire atrás con
  válvula, brazo separado, botas-cañón rojas, y carrera de **4 cuadros**.
- Cuatro iteraciones dibujadas a ×14 **al lado de la referencia** antes de tocar el juego. Una versión con un solo
  ojo se leía como cíclope → se cambió a visor.

---

## 10. Etapa B-4 — WYRMGUARD (30/09, 12:26 → 13:11)

### 10.1 El pedido

> "Otro juego para móvil, inspirado en **SNKRX**… buscá toda la información… un nombre original y bien hecho…
> **inglés por defecto**, replicá sistemas, objetos, mecánicas… no cometas los errores de los juegos anteriores…
> que se sienta completo desde el primer prompt."

Con una captura del Play Store (nada más).

### 10.2 El giro de método: leer el código fuente

Al buscar la información apareció que **SNKRX es de código abierto (MIT)**. En lugar de aproximar desde la
wiki, se clonó en superficial y se leyó. Eso cambió la calidad de los datos:

- `main.lua`: las 16 clases, sus **bonos por cantidad**, los multiplicadores por clase, los **tiers** de los
  héroes, los **niveles de la tienda y sus probabilidades**, los precios, el oro por nivel, **las oleadas**, los
  élites y los jefes.
- `objects.lua`: la fórmula de stats (héroe `100·2^(nv−1)` de vida, `10·2^(nv−1)` de daño, 75 de velocidad, 25 de
  defensa; enemigo `25+16,5·y`, ×0,5 de vida y ×0,3 de velocidad).
- `arena.lua`: oleadas de `8+2·(o−1)` enemigos, interés de 1 cada 5 de oro hasta 5.
- `player.lua`: el **intervalo y el alcance de ataque de cada héroe**, el giro de la víbora (1,66π rad/s) y
  los 10,4 px entre segmentos.
- Capturas oficiales por la API de Steam; paleta exacta del original (`#303030`, `#dadada`, `#facf00`…); medición
  del fondo: afuera `#292929`, arena `#323232` con un damero casi invisible y degradé hacia abajo.
- **Controles de Android** (por búsqueda): tocar la mitad izquierda o derecha de la pantalla.

### 10.3 Licencias (una decisión explícita)

- El **código** es MIT: se tomaron reglas y números, y se **escribió todo el código de nuevo**.
- La **letra del juego** es *PixulBrush* (Mercyssh). Los metadatos dicen: gratis para proyectos personales, para
  comerciales con acreditación → se usa **con crédito** (pantalla de créditos y `fuentes/LEEME.txt`).
- La letra del **título** del original (*FatPixelFont*) **no tiene una licencia usable** → el logo es propio:
  cada píxel de "WYRMGUARD" es un cuadradito de víbora con los colores de las clases.
- Los nombres de los héroes con nombre propio son **nuestros** (Drifter, Runeblade, Mindkeeper…); los genéricos
  (arquero, mago) se quedan. Las mecánicas son las del original.
- *PixulBrush* no traía tildes, eñe, `¿ ¡ ü < > · * [ ]`: un script (`fuentes/acentos.py`) las **dibuja** a la
  medida de la grilla de la fuente (cada píxel = 128 unidades → a 8 px cae justo).

### 10.4 Lo que se construyó

- **52 héroes** (8/17/16/11 por tier, como el original), cada uno con su ataque propio y su efecto de nivel 3; **16
  clases** con bonos por cantidad; **82 objetos** (de los cuales 52 se suben de nivel); tienda con 5 niveles,
  vuelta de cartas por 2 de oro, fijar cartas, vender, reordenar la víbora; **25 niveles** con los **6 élites** (verde,
  azul, blanco, naranja, amarillo, violeta) y **5 jefes** (6, 12, 18, 24 y el último, que usa los poderes de
  todos); NG+ que se destraba al ganar.
- **Controles**: mantener apretada la mitad izquierda o derecha. En PC, A/D, flechas o clic izquierdo/derecho.
  En el teléfono la tienda pide **dos toques** (uno para ver la ficha, otro para comprar) para no comprar sin
  querer.
- **Pantalla**: lienzo chico a **escala entera** (×3 en 1600×720 → 533×240; nunca menos de 240 de alto ni 440 de
  ancho). Con el teléfono parado se dibuja **girado** (y se giran los toques).
- **Letra** horneada a 8 px con el alfa cortado al 50 % (si no, el navegador suaviza los bordes y sale borrosa).
- **Música y sonido**: temas escritos con un mini-compositor (acordes → bajo, arpegio y colchones), 6 temas y 39
  efectos; horneado en 2,1 s; sin saturar; a −9 dB en vivo.

### 10.5 Errores de esta ronda

| Error | Causa | Arreglo y guarda |
|---|---|---|
| La página no arrancaba: "Identifier 'H' has already been declared" | `let W = 533, H = 240` escondía un `H` que chocó con una función auxiliar de los datos. La guarda del armado sólo miraba el **primer** nombre de cada declaración | Renombrar y **extender la guarda** a las listas separadas por coma |
| "víbora" se leía "vibora" | En la fuente la `í` conservaba el punto de la `i` | Se redibujó la `í` sin el punto con la tilde en su lugar |
| Números descentrados en los cuadritos | Los números de la fuente miden 9 px (no 7) | Ayudante `numeroEnCaja` |
| Hileras de texto pegadas en las fichas | 10 px por renglón era poco | 11 px |
| Fila de botones de la tienda se montaba en castellano | "tienda - oro: 123" es más largo que "shop - gold: 3" | Posición calculada con el ancho del texto |
| **Un error mío: dije "81 objetos"** | Eran 82 (se contó mal) | Corregido en README y memoria |

### 10.6 Cómo se probó (con números)

- **Bot de partida entera**: llega al nivel 18–23 según la partida (con un grupo sin sinergias y un bot tonto).
  Con un grupo armado (6 tiradores + sacerdote + 8 objetos) **gana el nivel 25 dos de tres veces**.
- **Los 52 héroes** a nivel 1 y 3: todos hacen daño o su efecto propio; **los 82 objetos a la vez** sin excepciones.
- **Los 5 jefes**, **toques CDP** (10 de 10: comprar con dos toques, las dos mitades doblan hacia el lado
  correcto, pausa), **audio** (2,1 s de horneado, sin saturación tras bajar la explosión de 1,26 a 0,85).
- Paso de la arena ~0,04 ms; 34–41 enemigos como máximo en las partidas del bot.
- **Lo que NO se verificó**: que cada número de cada héroe/objeto sea idéntico al original (se verificó que
  *funciona y hace algo*); el desempeño en el teléfono real.

---

## 11. Comparación de los cuatro juegos

| | Shumio's Depths | Noche Carmesí | ABYSSFALL | WYRMGUARD |
|---|---|---|---|---|
| Original | The Binding of Isaac: Repentance | Vampire Survivors | Downwell | SNKRX |
| Fuente de datos | Wiki (informe de investigación) + video | Wiki (`?action=raw`) | Wiki (API) | **Código fuente MIT** + Steam + Play Store |
| Orientación | Acostado (gira solo) | Vertical | Vertical | Acostado (gira solo) |
| Entrada | Joysticks flotantes + botones; teclado/mouse | Joystick flotante | Zonas de pulgar, multitoque | Mitad izquierda/derecha |
| Estilo | Dibujado 2D, sin tramado | Pixel art por piezas, texto HD | 3 colores, letra propia | Formas planas, letra PixulBrush |
| Texto | A mano (manoSpr) | Courier Prime Bold (OFL) | Letra de píxel propia | PixulBrush + acentos añadidos |
| Idioma por defecto | Navegador | **Inglés** | **Inglés** | **Inglés** |
| Rondas de corrección del usuario | 11 | 3 | 2 | 0 hasta ahora (falta su prueba en el teléfono) |
| Sondas de prueba | `window.__SH` | `window.__NC` | `window.__AB` | `window.__WG` |

Tendencia: **cada juego tardó menos y necesitó menos correcciones** porque las guardas y las reglas de los
anteriores ya estaban escritas (la cuenta del contenido es otra historia: WYRMGUARD tiene mucho más contenido
declarativo, pero el motor estaba resuelto).

---

## 12. Catálogo de errores y su causa raíz

| # | Juego | Síntoma que vio el usuario | Causa raíz | Cómo se evita ahora |
|---|---|---|---|---|
| 1 | Todos | Palabra "undefined" en pantalla / nada se dibuja | Dos módulos definen el mismo nombre en un solo `<script>`: una pisa a la otra sin avisar | `construir.mjs` corta si hay nombres repetidos (y desde WYRMGUARD, también en listas con coma) |
| 2 | Shumio | "Trazos corridos", cabeza de costado desplazada | Sellos descentrados medio píxel | `selloC` / `parDeOjos` con aviso en consola |
| 3 | Shumio | Letras y títulos "genéricos" | Se había escrito de memoria | Regla 7: medir contra captura/video |
| 4 | Shumio | "Demasiado pixelart" | Tramado Bayer en todo | Degradados continuos + contornos automáticos |
| 5 | Shumio | Sonido "muy chiptune" | Osciladores crudos | Cuerda, voces con formantes, piano, batería; capas por intensidad |
| 6 | Shumio | Traspasa pedestales / no usa cofres | Faltaban colisiones e interacciones | Pedestales sólidos; cofres con 5 tipos |
| 7 | Shumio | Puertas de abajo y barra del jefe cortadas | Cámara que recortaba | `VISTA_H = SALA_H + 4` (medido) |
| 8 | Shumio | Lágrima igual con cualquier objeto | No se había implementado el aspecto por objeto | `aspectoLagrima` con colores de la wiki |
| 9 | Shumio | **No suena** (×3) | Síntesis en vivo que no entra en tiempo real en el teléfono | Banco de muestras horneadas; regla de ≥50× |
| 10 | Noche | Cabezas "invertidas" | Signo del lambert invertido en `Pix.bola` (luz desde abajo-derecha) | Medir con una bola de prueba; corregido en Noche y ABYSSFALL |
| 11 | Noche | Brazos y pies "invertidos" | Mezcla de vista frontal y de costado | Vista única de 3/4 |
| 12 | Noche | Sprites chuecos | Sellos tipeados a mano | Construcción **por piezas** |
| 13 | Noche | Texto genérico | Letra de guía | Courier Prime Bold + texto en resolución real |
| 14 | ABYSSFALL | "Muy brilloso", "la roca no parece roca" | Baldosas blancas enteras o motas sueltas | Masa negra + empedrado sólo en la cara abierta |
| 15 | ABYSSFALL | Protagonista "pésimo" | Bloque cabezón de frente | Diseño de perfil, miembros separados |
| 16 | ABYSSFALL | La pantalla cambiaba de idioma al avanzar | `pointerdown` avanzaba y el `pointerup` caía en otro botón | Avanzar al soltar |
| 17 | ABYSSFALL | Se compraba todo al entrar a la tienda | Compra por contacto | Objetos que se compran saltando |
| 18 | WYRMGUARD | La página no arrancaba | `H` repetido (alto de pantalla y función auxiliar) | Guarda ampliada |
| 19 | WYRMGUARD | "vibora" sin tilde | Glifo `í` con el punto de la `i` | Glifo redibujado; **auditoría de caracteres** de todos los textos contra la fuente |
| 20 | Asalto MR | "No abre" | APK sin una clase (la compilación falló en silencio) | `construir.sh` estricto |
| 21 | XRSLAM | "No calibra / no carga / pos 0" | Relojes, montaje y sensores del navegador | Diagnóstico que dice por qué y se copia con un botón |
| 22 | Tajo | Render sin conexión de 10 minutos | Todos los eventos agendados a la vez | Agendar por ventanas |
| 23 | Pruebas | Fotos que no coinciden con el estado | El bucle real sigue corriendo | Capturar en la misma llamada / congelar |

---

## 13. Lo que no se hizo, y por qué

- **No se bajaron versiones pirateadas ni se copiaron sprites o sonidos** (pedido de Shumio). Se hicieron
  mecánicas propias y arte propio.
- **No se ayudó a saltar la autenticación de mandos de consola** (Xbox 360): se hizo un control IR.
- **No se retomó el servidor tipo Shizuku** para abrir apps dentro de Nexo (estacionado, sin pedido explícito).
- **No se usaron logos ni marcas de Meta** en Nexo: nombre e íconos propios.
- **No se usó la letra del título de SNKRX** (sin licencia usable): logo propio.
- **No se commiteó** el APK de aeroplaza del usuario, ni keystores, ni tokens.

---

## 14. Lo que está sin probar o pendiente (hay que decirlo)

1. **Ningún APK ni juego se probó en un teléfono real desde el contenedor.** Las pruebas son de lógica,
   renderizado y toques simulados por CDP. El único juego con retroalimentación del dispositivo es Shumio (el
   usuario lo probó y reportó el sonido), y los juegos posteriores todavía no tienen una respuesta del TCL.
2. **El error de luz de `Pix.bola` sigue en `shumio/`** (se arregló en `noche/` y `abyssfall/`). Arreglarlo
   cambiaría todo el aspecto de Shumio: **preguntar antes**.
3. **WYRMGUARD**: balance medido sólo con un bot tonto; fidelidad numérica no comprobada ítem por ítem; algunas
   interacciones finas están simplificadas respecto del original.
4. **Nexo Web**: el hand tracking quedó mejorado pero sin confirmación del usuario; falta su captura de la app
   Cámara.
5. **Conectores sin autorizar:** *graphify* y *mint* (hay que autorizarlos desde los conectores de claude.ai;
   hasta entonces no se pueden usar).
6. **Rendimiento en el teléfono**: los números de paso/dibujo son de un Xeon con swiftshader y no valen para
   el TCL.

---

## 15. La receta para el próximo juego (checklist)

1. Leer `memoria/INDICE.md` → `memoria/juegos.md`.
2. Buscar el **código abierto** del original; si no existe, la API de la wiki; las capturas oficiales por la API
   de la tienda; las capturas del usuario como autoridad final.
3. Revisar la **licencia** de cada cosa que se vaya a usar (código, letra, imágenes). Crédito donde se pida.
4. Crear `carpeta/{src,pruebas}`, `construir.mjs` (con la guarda de nombres), `plantilla.html`, `.gitignore`
   (`salida/`), `pruebas/comun.mjs`.
5. Escribir **la base** (pantalla de escala entera, bucle de 60 Hz, entrada real, audio horneado, letra) y
   probarla con una captura antes de seguir.
6. Poner los **datos** del original en tablas; la lógica las lee.
7. Escribir los sistemas, con un bot que juegue de punta a punta.
8. Dibujar el arte **al lado de la referencia**; revisar con hojas de contacto, en inglés, en castellano y
   con el teléfono parado.
9. Probar con **toques reales** (CDP), no sólo con el mouse; medir el audio (≥50× el tiempo real).
10. Auditar los **caracteres** de todos los textos contra la fuente.
11. Escribir la nota en `memoria/`, la fila en `README.md`, commit con el trailer, chequeo de secretos, push,
    copiar a `salida/`.
12. Entregar el archivo + una hoja de capturas y un resumen corto que diga **qué no se probó**.

---

## 16. Apéndice: comandos y rutas

```bash
# armar cada juego (un HTML sin red en <carpeta>/index.html)
node shumio/construir.mjs      node noche/construir.mjs
node abyssfall/construir.mjs   node wyrmguard/construir.mjs

# pruebas de WYRMGUARD (las demás carpetas tienen las suyas)
node wyrmguard/pruebas/jugar.mjs 5      # el bot juega la partida entera (semilla 5)
node wyrmguard/pruebas/heroes.mjs       # 52 héroes a nivel 1 y 3 + los 82 objetos juntos
node wyrmguard/pruebas/jefes.mjs        # los 5 jefes
node wyrmguard/pruebas/tactil.mjs       # toques reales por CDP
node wyrmguard/pruebas/audio.mjs        # horneado, niveles y medidor en vivo
node wyrmguard/pruebas/pantallas.mjs [es|parado]   # fotos de todas las pantallas

# leer el código de SNKRX (MIT) en modo lectura
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/a327ex/snkrx /home/user/a327ex/snkrx
```

Dónde está cada cosa:

| Qué | Dónde |
|---|---|
| Reglas del repo y de la sesión | `CLAUDE.md`, `memoria/INDICE.md`, `README.md § Las reglas` |
| Trampas pagadas por juego | `memoria/juegos.md` |
| La máquina, el proxy y las herramientas | `memoria/maquina.md` |
| Nexo XR / Nexo Web | `memoria/nexo.md`, `nexo-xr/README.md` |
| Las guías de juegos | `guias/GUIA_JUEGOS_2D_PIXEL.md`, `guias/GUIA-JUEGOS-3D-REZONA.md` |
| Los cuatro juegos de la serie | `shumio/`, `noche/`, `abyssfall/`, `wyrmguard/` (cada uno con `src/`, `pruebas/`, `index.html`) |
| Capturas y HTML entregables | `<juego>/salida/` (carpeta ignorada por git) |
