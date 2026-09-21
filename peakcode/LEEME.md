# PeakCode — app Android de chat con IA

**Anda al abrirla, sin instalar ni configurar nada.** Trae un motor gratis por
defecto (Pollinations, modelo abierto GPT-OSS 20B, sin key). OmniRoute en un
servidor propio queda como opción avanzada en Ajustes.

Cliente de chat para Android. La red pasa por un **puente nativo (Java)**, no
por `fetch()` del WebView: así no hay CORS y se puede pegar a cualquier endpoint
gratis aunque no mande cabeceras CORS. Verificado el 21/9 contra Pollinations
(`POST https://text.pollinations.ai/openai`, sin key, streaming SSE, contestó de
verdad) y contra OmniRoute local.

## Los dos motores

| motor | setup | qué es |
|---|---|---|
| **Gratis** (por defecto) | **ninguno** | Pollinations, GPT-OSS 20B, sin key. Tiene límites de uso |
| **OmniRoute** (avanzado) | un servidor + contraseña | 352 proveedores, 90+ capas gratis. Ver `servidor/` |

## Acá SÍ se puede compilar un APK (corrección al repo)

`ARRANQUE.md` y `ESTADO.md` dicen que no se puede y lo tienen como *trabado*,
con este motivo: *"no hay SDK de Android y no entra (pesa 2-3 GB, quedan ~2,4
GB)"*. **Medido el 21/9: ya no es cierto.**

| | |
|---|---|
| JDK | **21.0.10**, ya instalado |
| Gradle | **8.14.3**, ya instalado |
| disco libre | **27 GB** (contra 2,4 GB de entonces) |
| SDK de Android | pesó **458 MB**, no 2-3 GB |

```sh
export ANDROID_HOME=/opt/android-sdk
gradle --no-daemon assembleDebug     # sale app/build/outputs/apk/debug/
```

Primer APK compilado y verificado: `ai.peakcode` 0.1, minSdk 24, targetSdk 34,
firmado con la clave de depuración, un solo permiso (`INTERNET`).

### Trampa: cada sesión firma con una clave distinta

El contenedor es efímero, así que `~/.android/debug.keystore` **se genera de
nuevo en cada sesión**. Dos APK compilados en sesiones distintas quedan
firmados con claves distintas, y Android **se niega a instalar uno encima del
otro**: tira *"No se instaló la aplicación"* por firma que no coincide.

Medido el 21/9, huellas SHA-256 del certificado:

| APK | huella |
|---|---|
| `app-debug-7` (sesión anterior) | `d11a41e7…3b94` |
| `app-debug-8` (esta sesión) | `2a482d70…7fe5` |

**Hay que desinstalar PeakCode antes de instalar el APK nuevo.** Se pierde el
historial de chat, que vive en el `localStorage` del WebView.

## Cómo se instala el SDK, por si hay que rehacerlo

```sh
curl -sLo /tmp/ct.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
python3 -c "import zipfile;zipfile.ZipFile('/tmp/ct.zip').extractall('/opt/android-sdk/cmdline-tools/')"
mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest
chmod -R +x /opt/android-sdk/cmdline-tools/latest/bin/     # OJO: ver abajo
yes | sdkmanager --licenses
sdkmanager 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'
```

**El `chmod` no es opcional:** `zipfile` de Python **no preserva el bit de
ejecución**, así que `sdkmanager` sale con *Permission denied* y parece que el
SDK se bajó roto. Costó una vuelta.

## La interfaz es una página web adentro del APK

`MainActivity.java` es un WebView que carga `assets/index.html`. Se eligió así
porque este repo ya sabe hacer interfaces web —`frutiger-aero` es un escritorio
entero en una página— y así se reusa todo eso en vez de aprender Compose.

## OmniRoute: lo que se midió (21/9)

Instalado y corrido en el contenedor de la sesión:

| | |
|---|---|
| versión | 3.8.50, MIT, en npm |
| tamaño | **431,6 MB** desempaquetado, 77 dependencias |
| Node que pide | `>=22.22.2 <23 || >=24 <27` (la sesión tiene 22.22.2 justo) |
| arranque | **5,6 s** |
| panel | `http://localhost:20128/` → redirige a `/dashboard` |
| API | `http://localhost:20128/v1` — `/v1/models`, `/v1/chat/completions` |
| autenticación | **emite sus propias keys** (tabla `api_keys` en `~/.omniroute/storage.sqlite`) |
| configuración | `~/.omniroute/.env` con `STORAGE_ENCRYPTION_KEY` |

**La consecuencia que define la arquitectura:** `/v1/*` pide una key que emite
OmniRoute, así que **la app solo necesita una URL base y una key**. No hace
falta terminal embebida ni instalar nada adentro del APK. Eso saca del proyecto
la parte más costosa (una terminal real en Android es rehacer Termux).

### Dos advertencias que dejó el propio OmniRoute

1. **Arranca escuchando en `0.0.0.0` SIN pedir key.** Lo avisa él mismo:
   *"the inference plane (/v1/*) is reachable by ANY device that can route to
   this host"*. Si se expone en una red que no es la propia, va
   `REQUIRE_API_KEY=true` o `OMNIROUTE_SERVER_HOST=127.0.0.1`.
2. Su README marca **15 proveedores como "avoid" en su catálogo de riesgo de
   términos**. Apilar capas gratis se apoya en parte en condiciones que algunos
   proveedores no permiten. Vale saberlo antes de prometer "gratis para siempre".

## Lo que falta decidir

**Dónde corre OmniRoute.** El APK es un cliente; el router tiene que vivir en
algún lado:

| dónde | qué necesita | contra |
|---|---|---|
| teléfono, con Termux | Termux + Node + `npm i -g omniroute` | 431 MB en ARM; las dependencias nativas **no se probaron** |
| servidor gratis (HF Spaces) | cuenta, sin tarjeta | queda expuesto: key obligatoria |
| PC propia | la máquina prendida | se muere al apagarla |

---

# El asistente de la app: cómo saca la llave sola

Medido contra un OmniRoute corriendo (21/9). La cadena entera es HTTP, así que
**la app la hace sin que el usuario copie nada**:

```
POST /api/auth/login   {"password": "..."}   -> 200 {"success":true} + cookie
POST /api/keys         {"name": "PeakCode"}  -> 201 {"key":"sk-...","id":...}
GET  /v1/models        Bearer sk-...         -> 200, 492 modelos
```

**La ruta de creación es `/api/keys`, no `/api/api-keys`.** Esa segunda
aparece en el listado de tags de la API y responde 401 a GET, pero POST ahí da
404. Se encontró probando variantes; costó un rato.

El catálogo trae **alias de ruteo** (`auto/best-coding`, `auto/best-reasoning`,
`auto/pro-coding`): el asistente elige `auto/best-coding` por defecto, así el
usuario no tiene que decidir entre 492 modelos.

## Los tres pasos, y por qué no hay nada que pegar

1. **Busca el motor solo** en `127.0.0.1:20128` y `localhost:20128`. Un **401
   cuenta como encontrado**: significa que hay motor y solo falta la llave.
2. Si no lo encuentra, **genera él la contraseña** (16 caracteres al azar), la
   mete en el comando de instalación, y **se la acuerda**. Así en el paso 2 ya
   está puesta: el usuario no inventa ni copia ninguna contraseña.
3. Login + creación de la llave por HTTP. Lo único que se teclea es nada.

Para instalar, si Termux está, se le manda el comando por su intent
`com.termux.RUN_COMMAND`. Eso **solo funciona si Termux tiene
`allow-external-apps=true`**, así que cuando falla se cae a copiar el comando al
portapapeles y abrir Termux. Si Termux no está, lleva a su ficha en F-Droid.

`<queries><package android:name="com.termux"/></queries>` es obligatorio:
**Android 11+ esconde las otras apps** y sin eso no se puede ni preguntar si
Termux está instalado.

## Lo que NO está probado

El comando de instalación en Termux (ARM). OmniRoute pesa 431 MB con 77
dependencias, algunas nativas, y pide Node >=22.22.2. En Termux va
`nodejs-lts`. **No se probó en un teléfono de verdad** — puede fallar al
compilar alguna dependencia nativa.

---

# 0.9 — modo agente, workflow y todos los formatos

Hasta la 0.8 PeakCode era un chat que sabía guardar archivos. La 0.9 es un
agente: hace el trabajo solo y te deja los archivos hechos en el teléfono.

## Los tres modos

| modo | qué hace |
|---|---|
| 💬 **Chat** | lo de siempre: charla con streaming y artifacts |
| ⚡ **Agente** | usa herramientas en un bucle hasta terminar la tarea |
| 🧩 **Workflow** | planificador → N obreros en paralelo → integrador → revisor |

## Por qué un protocolo de etiquetas y no *function calling*

El motor gratis (Pollinations) y varios de los 492 de OmniRoute no soportan
*function calling*, o lo soportan mal. Un protocolo de texto anda con cualquier
modelo que sepa escribir:

```
<peak:crear archivo="informe.md">…contenido…</peak:crear>
<peak:leer archivo="datos.csv" desde="0" hasta="6000"></peak:leer>
<peak:agente nombre="investigador" tarea="…">contexto</peak:agente>
<peak:listo>resumen</peak:listo>
```

También hay `anexar`, `listar`, `buscar`, `borrar`, `guardar` y `plan`.

## "Ejecutando": el contenido no se muestra mientras se escribe

El pedido fue que la app cree el archivo sin mostrar el proceso de tipeo. Se
resuelve con un **lector incremental** (`Lector`, en `agente.js`): apenas ve la
apertura `<peak:crear>`, lo que sigue deja de ir a la pantalla y se convierte
en un renglón de actividad que dice `ejecutando` y cuánto lleva escrito. Al
cerrar, el renglón pasa a tilde con la ruta.

El lector está probado alimentándolo **de a un carácter**, porque así llega de
verdad por SSE: un tag puede partirse en `<pea` + `k:crear…`. Hay 16 pruebas
en el repo de trabajo, incluidas las de contenido con `</peak:otracosa>` y `<div>`
adentro del archivo.

## Los dos techos que se corrieron, y lo que NO se puede

**Escritura.** Si el modelo se corta por largo, la app le manda las últimas
1800 letras y le pide que siga exacto, hasta 40 veces (`TOPES.continuaciones`).
El archivo sale entero aunque no entre en una respuesta.

**Contexto.** Dos cosas. Una: los adjuntos ya **no** van al contexto, van al
*taller*, y el agente lee pedazos con `<peak:leer desde= hasta=>`. Antes un
archivo de 200k caracteres entraba entero al historial. Dos: cuando la charla
pasa de 52 mil caracteres se **compacta** (se resume lo viejo, se dejan los
últimos 6 mensajes intactos).

**Lo que no es:** esto no le saca la ventana de contexto al modelo, ni el techo
por respuesta. Son las dos mismas maniobras que hace Claude Code —escribir en
pedazos y compactar— para que el techo no se note. Un modelo con ventana chica
sigue teniendo ventana chica.

## El taller

Un sistema de archivos plano en `localStorage` (botón 🗂). Es lo que le permite
a varios agentes trabajar sobre lo mismo y lo que mantiene el contexto flaco.
Se puede ver, previsualizar, exportar a cualquier formato y bajar entero en ZIP.

## Paralelismo de verdad

`Peak.stream` ya lanzaba un hilo de Java por llamada; lo que faltaba era del
lado del JS, donde había **una sola** conversación en curso (`enCurso`). Ahora
las llamadas se registran por id en un `Map`, y los obreros corren a la vez.
Medido en la prueba automatizada: **pico de 3 llamadas simultáneas**.

Dos bugs que solo aparecen con agentes en paralelo y que costaron encontrarlos:

- El id de acción se armaba con `índice + Date.now()`. Dos agentes en el mismo
  milisegundo sacaban el **mismo id**, se pisaban el renglón en pantalla y uno
  quedaba colgado en "ejecutando" para siempre.
- Los módulos son `<script>` clásicos y **comparten el ámbito global**: el
  `const G` de `nucleo.js` chocaba con el `const {G}` de los otros tres y no
  cargaba ninguno. Cada módulo va adentro de su propia función.

## Los archivos

| archivo | qué tiene |
|---|---|
| `index.html` | marcado y estilos |
| `puente.js` | `Peak` de mentira si no estamos en el APK, para probar en el escritorio |
| `formatos.js` | los 57 formatos, todo offline y sin librerías |
| `nucleo.js` | estado, taller, multiplexor de streams, continuación, compactación |
| `agente.js` | protocolo, lector incremental, herramientas, bucle |
| `flujo.js` | el workflow de cuatro pasos |
| `interfaz.js` | pantalla, renglones de actividad, hojas |

## Los 57 formatos

Documento: txt, md, pdf, docx, odt, rtf, epub, tex ·
Planilla: csv, tsv, xlsx, ods ·
Presentación: pptx ·
Web: html, css, js, ts, jsx, tsx, vue, svg ·
Datos: json, jsonl, xml, yaml, toml, ini, sql, geojson ·
Código: py, java, kt, swift, c, h, cpp, cs, go, rs, rb, php, lua, r, dart, sh,
bat, ps1, diff ·
Varios: srt, vtt, ics, vcf, m3u, gpx, log, env, zip

Los armados (pdf, docx, xlsx, pptx, odt, ods, epub, rtf) se generan **en JS
puro, sin librerías**: el mismo `zip()` store-only sirve para OOXML,
OpenDocument y EPUB, que los tres son un ZIP con XML adentro. Se escribe
Markdown para documentos y CSV para planillas, y la app convierte. En pptx,
cada `# título` es una lámina.

Validados con Python: ZIP íntegro, XML bien formado, partes obligatorias
presentes, y `mimetype` primero y sin comprimir en odt/ods/epub (que es lo que
exigen esos formatos).

### Dos bugs viejos del PDF que aparecieron acá

El generador de PDF de la 0.8 tenía dos fallas que solo se ven con acentos:

1. Los offsets de la tabla `xref` se contaban en **caracteres** pero el archivo
   se escribía en UTF-8. Cualquier acento corría todos los offsets y los
   lectores avisaban *"incorrect startxref pointer"*.
2. El texto iba en UTF-8 declarado como WinAnsi, así que `ñandú` salía `Ã±andÃº`.

Los dos se arreglan con lo mismo: escribir el PDF en **Latin-1**, donde un
carácter es un byte. Verificado con `pypdf`: 0 avisos, acentos correctos, y un
PDF de 300 renglones que pagina en 13 hojas con el primero y el último enteros.

## Riendas

Están en `TOPES` (`nucleo.js`), y son para que un agente no se dispare, no
límites del modelo: 24 pasos por tarea, 40 continuaciones, profundidad 2
(un agente delega, el subagente ya no), 6 obreros como máximo.

El botón ■ frena. Es un **corte blando**: el puente de Java no sabe cancelar
una llamada a mitad de camino, así que se deja de escuchar y el bucle se para
en el próximo control. El hilo termina solo y su respuesta se tira.
