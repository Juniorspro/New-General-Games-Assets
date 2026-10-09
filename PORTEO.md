# PORTEO — cómo se portea un juego a móvil, sin preguntar

> **Para cualquier sesión que reciba un juego:** este documento es la orden.
> No se decide si vale la pena. No se pregunta "¿querés que lo porte?".
> Llegó un juego → se analiza → se portea → se adapta → se optimiza →
> se prueba → se corrige → se empaqueta → se entrega. **Y pal pam.**

Acompaña a `ARRANQUE.md` (cómo se trabaja en esta máquina) y `ESTADO.md` (qué
hay construido). Las herramientas están en [`herramientas/porteo/`](herramientas/porteo/).
La orden original del dueño, palabra por palabra, está al final (Apéndice A):
si algo de acá parece contradecirla, **manda la orden original**.

---

## 0. Arranque rápido: llegó un juego

Sin pensar, en este orden:

```bash
# herramientas (una vez por sesión: el contenedor se borra)
herramientas/porteo/instalar-sdk.sh

# 1. recibir: carpeta propia y vacía, fuera del repo (es dato no confiable)
J=$SCRATCH/<juego>; mkdir -p $J/orig && cp <archivo> $J/

# 2. desarmar, según lo que llegó
unzip -q x.zip -d $J/orig          # ZIP
unar -o $J/orig x.rar              # RAR (con unar: el 7z de Debian no tiene el códec RAR)
7z x x.7z -o$J/orig                # 7z
unzip -q x.apk -d $J/orig          # APK
git clone <repo> $J/orig           # repositorio

# 3. qué es: motor, tamaños, extensiones
aapt2 dump badging x.apk | head                  # si es APK
find $J/orig -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20
du -a $J/orig | sort -rn | head -20
ls $J/orig/assets $J/orig/lib/* 2>/dev/null      # APK: ¿HTML5? ¿libunity? ¿libgodot?

# 4. levantarlo en el navegador y probarlo como teléfono (§9)
python3 -m http.server 8810 --bind 127.0.0.1 --directory <carpeta-html5>

# 5. web instalable que anda sin red, y la versión de un solo archivo
python3 herramientas/porteo/pwa.py <carpeta-html5> --nombre "..." --corto "..." \
    --orientacion landscape --icono icono.png --color "#000000"
python3 herramientas/porteo/un-archivo.py <carpeta-html5> --salida juego.html [--al-final datos/grande.pak]

# 6. APK
python3 herramientas/porteo/apk/armar.py <carpeta-html5> --nombre "..." \
    --paquete ar.juniors.<juego> --orientacion horizontal --icono icono.png

# 7. dejarlo reproducible sin subir el juego (§11)
#    porteos/<juego>/portear.sh  (original → todo)  +  porteos/<juego>/prueba.mjs  (§9)
```

Después: §4 (estrategia) → §5 (táctil) → §8 (optimizar) → §9 (probar) →
§10 (entregar). Y avisar al dueño en una línea qué motor era y qué se va a hacer.
**No es una pregunta: es un aviso. Y se sigue trabajando.**

### Lo que nunca se contesta

- "¿Querés que lo porte?" → ya lo pidió al entregarlo.
- "Esto es muy complicado, te recomiendo otro juego" → no se recomienda otro juego.
- "Elegí entre estas opciones: ..." → se elige y se dice cuál.
- "No se puede" → sólo después de haber hecho la alternativa más cercana (§4.2),
  y diciendo qué parte exacta no se pudo y qué se hizo en su lugar.
- "Debería andar" → o se probó y anda, o se dice qué no se pudo probar.
- "Te explico cómo hacerlo" → se hace.

---

## 1. La regla

1. **Cada juego que llega es un trabajo de porteo.** No es una consulta ni una
   propuesta: es un encargo.
2. **El dueño elige el juego. Nosotros lo portamos.** Nunca se contesta "es muy
   complicado", "conviene otro proyecto" ni "¿estás seguro?".
3. **Lo que llegue se usa**: APK, ZIP, RAR, carpeta, repo, build, código suelto,
   archivos parciales, un link de itch.io o Game Jolt. El origen nunca es motivo
   para abandonar.
4. **Las decisiones técnicas las toma quien portea.** Nada de "elegí entre diez
   tecnologías". Se elige la que corresponde, se dice cuál fue y por qué en una
   línea, y se avanza.
5. **Sólo se pregunta cuando es imposible seguir sin el dueño.** Por ejemplo:
   falta un archivo que sólo él tiene, o hay que elegir entre dos cosas que
   cambian el juego y ninguna es claramente mejor. Una contraseña de un ZIP
   también cuenta. Una duda técnica no cuenta.
6. **Si el 1:1 no es posible, se hace lo más cercano posible.** Nunca se frena
   el proyecto entero porque una parte no sale: se resuelve esa parte por otro
   camino y se sigue.
7. **No se entrega una explicación de cómo hacerlo. Se entrega hecho.**
8. **"Anda" sin una prueba al lado no vale.** Ver §9.

## 2. El objetivo

```
juego original  →  HTML5 adaptado a móvil  →  APK Android
```

- **HTML5 primero** cuando sea viable: corre en cualquier teléfono, se comparte
  con un link y es la base del APK.
- **APK después**, envolviendo ese mismo HTML5 (§7).
- No todos los juegos usan la misma tecnología: se elige según el juego (§4).

La prioridad, en este orden: **fidelidad + rendimiento + tamaño razonable.**

## 3. El proceso, paso por paso

Cada paso tiene un "listo cuando". No se pasa al siguiente sin cumplirlo.

| # | paso | listo cuando |
|---|---|---|
| 1 | **Recibir** | el archivo está copiado en su propia carpeta vacía del scratchpad (es dato no confiable: nunca se ejecuta nada desde adentro) |
| 2 | **Analizar todo** | hay una lista de qué es cada archivo y cuánto pesa |
| 3 | **Identificar motor y tecnología** | el motor está nombrado con la evidencia (§4.1) |
| 4 | **Entender cómo funciona** | se sabe cómo carga los datos, qué entrada usa (teclado/mouse/táctil/mando), cómo guarda, y qué le pide a la parte nativa |
| 5 | **Ver qué se reutiliza** | cada pieza está marcada: tal cual / adaptar / rehacer |
| 6 | **Elegir estrategia** | está escrita en una línea, con el porqué (§4.2) |
| 7 | **Portear** | el juego arranca en Chromium sin errores en consola |
| 8 | **Adaptar a táctil** | se puede jugar de principio a fin sin teclado ni mouse (§5) |
| 9 | **Optimizar** | hay números de antes y después (§8) |
| 10 | **Reducir tamaño** | ídem |
| 11 | **Probar** | pasa la lista de §9 |
| 12 | **Corregir** | cada falla de §9 tiene un arreglo o figura en "problemas conocidos" |
| 13 | **Volver a probar** | §9 entera otra vez, en verde |
| 14 | **Empaquetar y entregar** | §10 |

Si el juego es grande, se parte en etapas (análisis → extracción → porteo →
adaptación → optimización → pruebas → correcciones) y **se entrega lo que ya
anda en cada etapa** en vez de esperar al final.

## 4. Motor y estrategia

### 4.1 Cómo reconocer el motor

| huella en los archivos | motor |
|---|---|
| `assets/index.html` o `assets/www/` dentro de un APK; strings `appassets.androidplatform.net`, `WebViewAssetLoader`, `cordova.js`, `capacitor` | **HTML5 en un WebView** (el caso fácil) |
| `Build/*.loader.js`, `*.framework.js`, `*.data`, `*.wasm` (también `.gz`/`.br`/`.unityweb`) | **Unity WebGL** |
| APK con `lib/*/libunity.so` y `assets/bin/Data/`: si trae `libil2cpp.so` es IL2CPP; si trae `libmonobdwgc-2.0.so` y `Data/Managed/*.dll`, es Mono | **Unity Android**. `herramientas/unity/analizar-apk.py` dice cuál, la versión, escenas, texturas y audio |
| `*.pck` + `*.wasm` + `index.js` | **Godot web** |
| APK con `libgodot_android.so`; `assets/*.pck` | **Godot Android** |
| proyecto con `project.godot` | proyecto Godot (3 o 4, según `config_version`) |
| `c2runtime.js` / `c3runtime.js`, `data.json` de Construct | **Construct 2 / 3** |
| `js/rpg_core.js` (MV) o `js/rmmz_core.js` (MZ), carpeta `www/` | **RPG Maker MV / MZ** (ya es HTML5) |
| `html5game/*.js`, `game.droid`, `libyoyo.so` | **GameMaker** |
| `lib/*/libgdx.so` | **libGDX** (Java) |
| `libcocos2dcpp.so`, `libcocos.so`, `cocos-js` | **Cocos2d-x / Cocos Creator** |
| `libUE4.so`, `libUnreal.so`, `.pak` | **Unreal** |
| `*.love`, `main.lua` + `conf.lua` | **LÖVE** |
| `*.swf` | **Flash** |
| `renpy/`, `*.rpy`, `*.rpa` | **Ren'Py** |
| `*.sb3` | **Scratch** |
| `phaser`, `pixi`, `three`, `babylon` en el JS | HTML5 con esa biblioteca |
| `main.pak` (todo con XOR 0xF7, magia `C04AC0BA`) + `properties/` + `.exe`; strings `SexyAppFramework`, `PopCap` | **PopCap / SexyApp** (PvZ, Zuma, Peggle, Bejeweled…). Se abre con `herramientas/popcap/pak.py` |
| `*.exe` de DOS, `*.jar` de Java ME, ROMs | juego viejo: va por emulación |

### 4.2 Qué se hace con cada uno

| tenemos | estrategia | fidelidad |
|---|---|---|
| **HTML5 dentro de un APK** | se extrae `assets/`, se reemplaza lo nativo con `web.js` (§6), se prueba | 1:1 |
| **Clickteam Fusion en APK** (`res/raw/application.ccn`: FNaF, miles de fan games) | `herramientas/clickteam/`: `ccn.py` saca los datos originales, `cobertura.mjs` dice si el motor cubre todo, `motor.js` corre los eventos originales | 1:1 (la lógica es la del autor) |
| HTML5 suelto (itch.io, carpeta) | se adapta a móvil con `tactil.js` + `web.js` | 1:1 |
| RPG Maker MV/MZ | la carpeta `www/` ya es HTML5; se le agregan controles táctiles si faltan | 1:1 |
| Construct, Cocos Creator web, Phaser, Pixi, three | ídem HTML5 | 1:1 |
| Unity WebGL build | se sirve tal cual; `.gz`/`.br` los descomprime `armar.py`; se le pone `tactil.js` | 1:1 |
| **Godot Android (APK)** | el `.pck` es independiente de la plataforma: se saca del APK y se corre con la **plantilla web de la misma versión exacta** de Godot | 1:1 |
| proyecto Godot | `godot --headless --export-release "Web"` (Godot 3 viene en la PC creativa; para Godot 4 se bajan el editor y las plantillas) | 1:1 |
| Flash `.swf` | **Ruffle** (emulador de Flash en wasm) + `tactil.js` | casi 1:1 |
| LÖVE `.love` | **love.js** | casi 1:1 |
| Ren'Py | **renpyweb** | casi 1:1 |
| Scratch `.sb3` | **TurboWarp Packager** → HTML | 1:1 |
| DOS | **js-dos** + `tactil.js` | 1:1 (emulado) |
| ROM o Java ME del dueño | emulador web (EmulatorJS / freej2me-web) + controles | 1:1 (emulado) |
| **Unity Android Mono** (el C# viene en `Managed/`) | AssetRipper reconstruye el proyecto con los scripts decompilados y se compila para WebGL con **la misma versión de Unity** (necesita una licencia activada: la del dueño). Antes, medir con `analizar-apk.py`: audio decodificado, tamaño de las escenas y formato de las texturas dicen si entra en una pestaña de teléfono | 1:1 si entra en memoria |
| **Unity Android sin proyecto** (IL2CPP) | no se puede pasar el binario a web. Se extraen los assets (AssetRipper/AssetStudio: modelos, texturas, audio, escenas) y se **rearma la lógica** en three.js. Si hay un build de PC Mono, las DLL se descompilan con ILSpy y la lógica se traduce leyendo el original | lo más cercano posible |
| **juego de PC en C++ con una reimplementación abierta** (PvZ → PvZ-Portable, y las hay de muchos clásicos: OpenTTD, devilutionX, OpenRCT2…) | se compila la reimplementación a WebAssembly con Emscripten y corre con los **datos originales del dueño**. Si espera otra versión de los datos, se parchea el motor (no se inventan datos). Receta: `porteos/pvz/` | 1:1 (la lógica es la del juego; los datos, los del dueño) |
| GameMaker / libGDX / Unreal sin fuente | igual: se extraen los assets y se rehace la lógica en HTML5 | lo más cercano posible |
| código fuente de cualquier motor | se exporta a web desde el motor si se puede instalar acá; si no (Unity y Unreal necesitan editor con licencia), se rearma | según el caso |

**Si hay dudas entre dos estrategias**, se elige la que conserva más del
original. Si son parejas, la más liviana.

## 5. Adaptación a móvil

### Qué se conserva (todo)

Gameplay, mecánicas, físicas, mapas, personajes, animaciones, sonidos, música,
UI, efectos, progresión y comportamiento. **Se cambia sólo lo necesario para
que funcione en un teléfono.**

### Qué se adapta

| el original usa | en móvil |
|---|---|
| teclado para moverse | joystick virtual (`tactil.js`, aparece donde se apoya el pulgar) |
| teclado para acciones | botones táctiles en abanico bajo el pulgar derecho |
| Escape / pausa | botón de pausa arriba **y** el botón atrás de Android |
| mouse para apuntar/mirar (FPS) | arrastrar en la mitad derecha de la pantalla |
| clic | toque (el navegador ya lo traduce) |
| clic derecho | mantener apretado, o un botón |
| rueda del mouse | botones +/− o pellizco |
| hover / tooltips | se muestran al tocar |
| pointer lock | no existe en táctil: se usa arrastre relativo |
| tipear texto | un teclado propio con el estilo del juego (PvZ: `porteos/pvz/index.html`); si no, se enfoca un `<input>` real para que salga el del teléfono |
| resolución fija (800×600) | `Porteo.pantalla({ encajar: 'canvas' })`: escala con bandas, sin tocar la resolución interna. Si se compila el motor y el fondo es más ancho, se muestra más mundo en vez de bandas (PvZ: hasta 1020×600 en el jardín) |
| orientación cualquiera | la que el juego necesita: se traba en el APK y en pantalla completa; si no se puede (giro automático bloqueado, iPhone, visor de HTML), **el juego se gira solo 90°** con `web.js`. El cartel de "girá el teléfono" queda sólo con `girar: false` |

### Cómo se tiene que sentir

Como un juego de celular, no como una página web metida en una pantalla:

- pantalla completa, sin barras, sin zoom, sin rebote, sin selección de texto,
  sin menú de "copiar imagen";
- botones de al menos 56 px, a la altura del pulgar, semitransparentes;
- `env(safe-area-inset-*)` respetado: nada debajo del recorte de la cámara;
- vibración corta al tocar un botón;
- la música se corta al salir de la app y vuelve al entrar;
- la pantalla no se apaga mientras se juega;
- si aparece un teclado o mando físico, los controles táctiles se esconden.

### Las herramientas

**`herramientas/porteo/tactil.js`** — fabrica eventos de teclado reales
(`keydown`/`keyup` con `key`, `code`, `keyCode` y `which`). El juego cree que
alguien está tocando el teclado, así que **no hay que reescribir su entrada**.

```html
<script src="tactil.js"></script>
<script>
  Porteo.tactil({
    joystick: { teclas: 'flechas' },          // 'wasd' o {arriba:'KeyW', ...}
    botones: [ { texto: 'A', tecla: 'Space' }, { texto: 'B', tecla: 'KeyX' } ],
    arriba:  [ { texto: '❚❚', tecla: 'Escape' } ],
  });
  Porteo.pantalla({ encajar: 'canvas', pixelado: true });   // si es de resolución fija
</script>
```

- `keyCode` se pisa a mano porque el constructor lo ignora, y la mitad de los
  juegos viejos (Construct 2, RPG Maker MV) sólo leen eso.
- Las teclas cuentan referencias: si el joystick y un botón sostienen la misma,
  soltar uno no la suelta.
- Al perder el foco se sueltan todas. Sin eso el personaje camina solo para
  siempre.
- `Porteo.eje` da el valor analógico del joystick (−1 a 1) para quien lo quiera.
- Si el juego escucha en el canvas y no en `document`: `objetivo: canvas`.

**`herramientas/porteo/intro.js`** — la intro de la marca: la moneda de
JXStudios de FNaF 2, en vez de la pantalla de carga del juego. Va entera en el
archivo (la moneda también), así anda igual en el `.html` único.

```html
<script src="porteo-intro.js"></script>
<script>
  Porteo.intro({ aviso: { es: 'Port no oficial de «…»…', en: '…', pt: '…' } })
    .then(function () { /* si el juego todavía carga, mostrar una barra */ });
</script>
```

- Dura 4,3 s. Un toque la saltea, y ese toque no le llega al juego.
- "presenta" y el aviso salen en el idioma del teléfono (es, en o pt).
- El juego arranca por detrás al mismo tiempo, no al terminar.

**`herramientas/porteo/web.js`** — lo que hacía la parte nativa (§6).

## 6. Sacar un juego de su APK (cuando adentro ya es HTML5)

Un APK de WebView tiene dos mitades: el juego (`assets/`) y una Activity que le
da cosas. **Hay que leer esa Activity** para saber qué se pierde al sacarlo:

```bash
dexdump -d classes*.dex | awk '/Class descriptor.*MainActivity/{p=1} /Class descriptor/ && !/MainActivity/{p=0} p' \
  | grep -E "const-string|addJavascriptInterface|evaluateJavascript|name  *:"
aapt2 dump xmltree juego.apk --file AndroidManifest.xml | grep -i orientation
grep -o 'window\.[A-Za-z_]*' assets/*.js | sort | uniq -c     # puentes JS
```

Lo habitual, y cómo lo devuelve `web.js`:

| en el APK | en el navegador (`Porteo.web`) |
|---|---|
| `addJavascriptInterface(...)` (vibrar, guardar, compartir) | se busca cómo lo llama el JS; casi siempre ya trae un plan B (`navigator.vibrate`). Si no, se escribe un objeto con el mismo nombre y los mismos métodos |
| atrás → Escape, dos atrás → salir | entrada de historial de colchón: el primer atrás manda Escape, el segundo (dentro de 2 s) sale |
| `screenOrientation` | `screen.orientation.lock()` al entrar en pantalla completa; si no se puede, **`P.girar`**: la página se rota 90° y, para el código del juego, todo es horizontal (`innerWidth/innerHeight`, coordenadas de los toques, rectángulos y medidas `vw/vh` traducidos), así anda también con juegos ajenos. El sentido sale del acelerómetro |
| `FLAG_KEEP_SCREEN_ON` | Wake Lock API |
| pantalla completa inmersiva | `requestFullscreen()` al primer toque |
| `onPause` pausa todo | el juego suele escuchar `visibilitychange`; si no, se agrega |
| assets locales sin red | `sw.js` (service worker): después de la primera visita anda sin internet |

```html
<script src="web.js"></script>
<script>
  Porteo.web({ orientacion: 'landscape' });   // parado: se gira solo
</script>
```

## 7. El APK

**`herramientas/porteo/apk/armar.py`** — envuelve cualquier carpeta HTML5 en un
APK firmado. Sin Gradle, sin Android Studio, sin red.

```bash
herramientas/porteo/instalar-sdk.sh          # una vez por sesión, ≈130 MB
python3 herramientas/porteo/apk/armar.py CARPETA \
    --nombre "Bus Stop Simulator" --paquete ar.juniors.busstop \
    --orientacion horizontal --icono icono.png --version 1.0 \
    --salida salida/busstop.apk
```

| opción | para qué |
|---|---|
| `--orientacion horizontal\|vertical\|libre` | `sensorLandscape` / `sensorPortrait` / `fullSensor` |
| `--icono` | PNG cuadrado; sin ícono genera uno con la inicial |
| `--red` | el juego necesita internet (agrega el permiso; sin esto se corta todo pedido afuera) |
| `--aislado` | COOP/COEP, para `SharedArrayBuffer` (Godot 4 con hilos, Unity con hilos) |
| `--version` / `--version-codigo` | **cada APK nuevo tiene que subir el código** o Android no lo instala encima |
| `--hz 60` (default) | pide 60 Hz a la pantalla. En teléfonos de 120 Hz, el juego que avanza un paso por cuadro iría al doble de velocidad, y el que usa delta gastaría el doble de batería. `--hz 0` deja el del teléfono |
| `--con-basura` | no filtrar `.map`, `.psd`, `.blend`, etc. |

**Por qué así y no con Capacitor o Cordova:** esos arrastran Gradle y el Android
Gradle Plugin (≈1 GB la primera vez, minutos por build) y meten 2-3 MB de
bibliotecas. Esto usa sólo `aapt2 + javac + d8 + zipalign + apksigner`: arma en
~6 s y el envoltorio pesa **≈15 KB**. Medido: Enjambre entero en un APK de 108 KB.

**Qué hace `Juego.java`** (una sola Activity, sin androidx):

- sirve el juego desde `https://appassets.androidplatform.net/`. **No usa
  `file://`**, porque ahí `fetch()`, los módulos ES y los `.wasm` se caen por CORS,
  y Unity y Godot dependen de eso;
- tipos MIME correctos (incluido `application/wasm`) y `utf-8` en lo que es
  texto: sin charset, Chromium supone windows-1252 y rompe las tildes;
- pantalla completa inmersiva, que se vuelve a aplicar al recuperar el foco;
  ocupa el recorte de la cámara;
- pantalla a 60 Hz (`--hz`) y prioridad alta para el proceso del juego, así
  Android no lo mata primero cuando falta memoria;
- pantalla siempre prendida; `onPause` pausa el WebView y los timers, así la
  música no sigue con el teléfono bloqueado;
- atrás: le pregunta a `window.porteoAtras`; si no existe, manda Escape; dos
  atrás seguidos cierran;
- `localStorage` e IndexedDB persisten (las partidas guardadas sobreviven);
- si el proceso del WebView muere por memoria, rearma la pantalla en vez de
  "la app se detuvo";
- los enlaces de afuera se abren en el navegador;
- autoplay de audio sin gesto, zoom de texto del sistema anulado, sin
  long-press ni scroll.

**La firma (importante):** Android sólo instala una actualización encima si
está firmada con **la misma clave**. El contenedor se borra, así que una clave
generada acá se pierde y el APK siguiente obliga a desinstalar (y se pierden las
partidas). `armar.py` busca primero `PORTEO_CLAVE_B64` (+ `PORTEO_CLAVE_PASS`)
en el entorno. **Hay que guardar la clave como secreto del entorno**: una sola
vez, y desde ahí todas las sesiones firman igual. Sin eso, usa
`~/.porteo/porteo.jks` y lo avisa. La clave **nunca** va al repo
(`*.jks` y `*.keystore` están en `.gitignore`).

**Lo que acá no se puede:** correr el APK. No hay KVM, así que no hay emulador
utilizable. El APK se verifica de forma estática (`apksigner verify`,
`aapt2 dump badging`, que esté todo adentro) y **el mismo HTML que lleva
adentro se prueba en Chromium móvil** (§9). La prueba en un teléfono real la
hace el dueño, y se le dice.

## 8. Optimización

Se mide antes y después. Sin números no hubo optimización.

| qué | cómo | regla |
|---|---|---|
| imágenes | PNG/JPG → WebP (`cwebp -q 85`, o `-lossless` para pixel art) | pixel art **nunca** con pérdida |
| texturas 3D | WebP, o KTX2/Basis si son muchas y grandes | no bajar resolución si no hace falta |
| audio | → Opus/OGG (`ffmpeg -c:a libopus -b:a 64k` música, `48k` efectos) | si ya es Opus, no se recomprime |
| modelos | `gltf-transform` (draco/meshopt, dedupe) | |
| JS | ya minificado: se deja. Si no, `esbuild --minify` | no se reescribe lo que anda |
| datos `.bin`/`.json` | el APK los comprime con deflate; el sitio los manda con gzip | |
| duplicados | `fdupes`/hash: un archivo, varias referencias | |
| basura | `.map`, `.psd`, `.blend`, carpetas de editor (lo hace `armar.py`) | |
| memoria/CPU | ajuste de calidad automático en táctil, `devicePixelRatio` tope ~1.5, nada de `requestAnimationFrame` con la pestaña oculta | |
| carga | lazy loading de niveles y música que no suena al principio | |

**No se baja calidad visual ni sonora si no es necesario.** Primero se saca lo
que sobra; recién después, si el tamaño sigue siendo un problema, se recomprime.

## 9. Pruebas

Chromium está en `/opt/pw-browsers/chromium`. Para WebGL sin GPU:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'] });
// teléfono acostado: { viewport: {width: 844, height: 390}, hasTouch: true, isMobile: true }
```

Los toques se mandan con **CDP `Input.dispatchTouchEvent`**: es el único que
permite **dos dedos a la vez** (caminar y mirar al mismo tiempo).

La lista. Todas, cada vez:

- [ ] carga sin errores en consola ni pedidos fallidos;
- [ ] se puede llegar del menú a jugar **sólo tocando**;
- [ ] cada control hace lo que dice, **medido en el estado del juego** (la
      posición cambió, la cámara giró, la altura subió), no "no tiró error";
- [ ] multitáctil: moverse y mirar/disparar al mismo tiempo;
- [ ] pausa con el botón de pausa **y** con atrás (Escape);
- [ ] al ocultar la página se pausa y se cortan teclas pegadas;
- [ ] el guardado sobrevive a una recarga;
- [ ] parado, acostado y pantalla chica (360×640): nada cortado ni inalcanzable;
- [ ] anda sin red (sin pedidos afuera);
- [ ] el APK: `apksigner verify` OK, `aapt2 dump badging` con nombre, ícono,
      orientación y SDK correctos, y todos los archivos del juego adentro.

**Cuidado con lo que mide swiftshader:** los cuadros por segundo de acá (render
por CPU) **no** son los de un teléfono. Una espera de 100 ms puede ser menos de
un cuadro: se mide el pico durante un rato, no un instante. (Así pasó con el
salto de Bus Stop: el primer intento dio "falla" y el salto andaba perfecto.)

## 10. La entrega

**Lo que pidió el dueño (octubre de 2026): "sólo el HTML que abra la página, no APK".** Para los
juegos con versión web privada (Cloudflare, `herramientas/porteo/cloudflare`) se le manda **el
lanzador**: `abrir.html` de `empaquetar.py --sitio` con `FIJA` = la dirección y `#clave=…` (pesa
unos KB, se abre con un toque y entra directo). **Sin APK** salvo que lo pida. Ese archivo lleva la
clave: se le manda a él y **nunca va al repo**. Lo de abajo queda para cuando pida otra cosa.

El dueño pone ese HTML en **Rezona**, que lo muestra en un cuadro: ahí el lanzador abre el juego en
un cuadro propio que ocupa todo (como el de Half-Life), y la puerta de Cloudflare entra igual (la
sesión va en la dirección, ver `herramientas/porteo/cloudflare/LEEME.md`). Se prueba así: una página
de otro sitio con el lanzador en un `<iframe>` (también con `sandbox` sin `allow-same-origin`) tiene
que llegar al menú.

**Cómo muestra Rezona un juego** (de su código, octubre de 2026): `<iframe src=play_url
sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-modals" allow="autoplay;
fullscreen; clipboard-write; gamepad">`. Con `allow-same-origin`, IndexedDB anda (las partidas se
guardan); sin `allow-orientation-lock` ni `screen-wake-lock`, el giro va por CSS. Encima pone su
pantalla de "cargando" hasta que el juego le manda `postMessage({type: "game:ready"})`, o 2,5 s después
del `load` del cuadro (en un .html único de 9 MB, después de bajarlo entero), o a los 15 s. El juego
(y el lanzador) avisan `game:ready` apenas arrancan: así se ven la intro y su propia carga. Si el dueño
sube **un solo .html**, va con `un-archivo.py --utf8`: una plataforma que lo lee como texto (para
meterle un script, guardarlo o pasarlo a `srcdoc`) rompe el de UTF-16, que no es UTF-8 válido.

Al terminar cada porteo se entrega, **como archivos** (no sólo una ruta):

1. **HTML5** — carpeta lista para subir, pasada por **`pwa.py`**
   (`manifest.webmanifest` + `sw.js` + íconos: se instala desde Chrome y anda sin
   red), también como `.zip`; y, cuando se pueda, **un solo `.html`** armado con
   **`un-archivo.py`**, que se abre con doble clic sin servidor;
2. **APK** firmado (`armar.py`);
3. **proyecto Android** = `porteos/<juego>/portear.sh`, que rearma todo desde el
   original en un comando (el APK sale en segundos);
4. y un informe con este formato:

```
## <Juego> — porteo
Origen: <qué llegó>  ·  Motor: <motor + evidencia>  ·  Estrategia: <una línea>
Fidelidad: <1:1 | casi 1:1 | adaptación — qué cambió y por qué>
Tamaños: original X MB → HTML5 Y MB → APK Z MB
Controles móviles: <lista>
Optimizaciones: <lista con números>
Pruebas: <n pasaron / n>  ·  <lo que no se pudo probar acá>
Problemas conocidos: <lista honesta, o "ninguno conocido">
```

## 11. Juegos de terceros y el repo

**Este repo es PÚBLICO.** Los archivos de un juego comprado o de otro autor
**no se suben**: sería redistribuirlo. Se entregan como archivo al dueño. Al
repo van sólo las herramientas y el código propio del porteo (adaptadores,
configuración de controles, pruebas), que no contienen el juego. Las carpetas
de juegos ajenos se agregan a `.gitignore` antes del primer commit.

Para que el porteo no se pierda cuando se borra el contenedor, cada juego deja
en **`porteos/<juego>/`** su receta, sin un solo byte del juego:

| archivo | qué es |
|---|---|
| `portear.sh` | original del dueño → web + un archivo + APK + zip, en un comando. Anota el sha256 del original con el que se probó |
| `prueba.mjs` | la lista de §9 para ese juego, midiendo en el estado del juego |
| lo nuestro | los parches que se le aplican (p. ej. `porteo-web.html`) |

Los créditos del original se conservan siempre: nunca se borra la pantalla de
créditos ni se tapa al autor.

## 12. La máquina

- **SDK mínimo de Android:** `herramientas/porteo/instalar-sdk.sh` (build-tools
  35 + platform 35 en `/opt/android-sdk`). `ARRANQUE.md` decía que no se podía
  compilar un APK porque el SDK entero no entraba. Con el mínimo sí se puede.
- **Java 21, Node 22, Python 3, ffmpeg y Chromium** ya vienen en el entorno.
- **Desarmar:** `unzip`, `7z` y `unar` (RAR: el 7z de Debian **no** lo abre,
  deja archivos de 0 bytes; `apt-get install -y unar`). Para APK: `aapt2 dump`,
  `dexdump` (en build-tools) y `unzip`. Pillow y `brotli` de Python
  (`pip install brotli`). Íconos de un `.exe`: `wrestool` + `icotool`
  (`apt-get install -y icoutils`).
- **Emscripten** (C/C++ → WebAssembly): lo instala `porteos/pvz/portear.sh` en
  `~/.porteo/pvz/emsdk` (~1 GB, versión fijada). Detrás del proxy de estas
  máquinas no baja zlib ni SDL2 de GitHub (403): la receta los clona con git.
- **PC creativa** (ver `MONTAR-PC.md` del dueño): Blender, GIMP, Inkscape,
  Krita, Godot 3, Wine, Xvfb + XFCE. Godot y Blender sirven para portear;
  Wine, para abrir `.exe` livianos y sacarles los assets.
- **Sin GPU, sin KVM, sin red entrante.** El disco es una cuota: si `df` dice 0
  con poco usado, es la cuota, y se arregla borrando.
- **Todo se borra al cerrar la sesión.** Lo que hay que conservar va a git (si
  es nuestro) o se le manda al dueño como archivo (si es ajeno).

## 13. Trampas ya pagadas

| trampa | qué pasa | cómo se evita |
|---|---|---|
| servir el juego por `file://` en el WebView | `fetch`, módulos y `.wasm` fallan por CORS | dominio `appassets.androidplatform.net` interceptado |
| respuesta sin charset | tildes rotas | `utf-8` en todo lo que es texto |
| `new KeyboardEvent({keyCode})` | `keyCode` queda en 0 y el juego viejo no se entera | `Object.defineProperty` sobre el evento |
| dedo apoyado al perder el foco | tecla pegada: camina solo | soltar todo en `blur` y en `visibilitychange` |
| el zip de build-tools | trae una carpeta `android-15`, no `35.0.0` | `instalar-sdk.sh` la renombra |
| `javac --release` con `-bootclasspath` | no se pueden usar juntos | `-source 8 -target 8 -bootclasspath android.jar` |
| clave de firma generada en el contenedor | se pierde y la próxima versión no se instala encima | `PORTEO_CLAVE_B64` como secreto del entorno |
| Unity con `.br` sin `Content-Encoding` | el loader no arranca | `armar.py` los guarda descomprimidos y `Juego.java` sirve el tipo de adentro |
| medir un salto a 6 cuadros/s | parece que no salta | medir el pico durante ~1 s |
| sacar un juego de su APK | se pierden atrás, orientación, pantalla prendida y vibración | leer la Activity (§6) y devolver cada cosa con `web.js` |
| teléfono de 120 Hz | el juego que avanza un paso por cuadro corre al doble de velocidad | `--hz 60` (el default de `armar.py`) |
| `history.pushState` al cargar la página | Chrome se saltea con el botón atrás las entradas agregadas sin que el usuario haya tocado: el primer atrás se iba del juego | el colchón se pone en el primer toque (`web.js`) |
| escuchar `pointerup` y `touchend` para la pantalla completa | dos pedidos por toque: el segundo falla y ensucia la consola | sólo `pointerup` y una marca de "pidiendo" |
| botones del juego con `pointer-events: none` (los atiende una capa) | `page.tap()` de Playwright se niega a tocarlos | tocar con CDP en el centro, como un dedo |
| espiar `fetch` en la versión de un archivo | el archivo sirve los datos sin pasar por el `fetch` de verdad: "0 de 0" | medir lo que el juego decodifica (`decodeAudioData`), no los pedidos |
| abrir el `.html` desde el disco | `fetch`/XHR a los archivos de al lado están prohibidos en `file://` y `content://` | `un-archivo.py`: todo adentro y los pedidos interceptados |
| leer los cuadros por segundo de Clickteam un campo antes | en la cabecera, "cantidad de pantallas" va justo antes de "cuadros por segundo": FNaF 2 (27 pantallas) quedó con fps 27 y todo temporizador 2,2× más rápido | leer `frameRate` en su lugar (`AppHeader` +0x68) y **medir el reloj del juego contra el reloj real** |
| intérprete con pasos fijos por segundo ≠ fps del juego | si el bucle da 60 pasos y cada paso cuenta 1000/fps ms, el reloj del juego se desfasa | un solo número manda: pasos por segundo = fps del juego |
| Clickteam de Android: leer las propiedades de objeto con el diseño publicado | el 2.º campo es la extensión y las animaciones van después de los calificadores: leídos al revés, ningún sprite tiene animaciones | `ccn.py` los lee en el orden de Android |
| multiplicar la transparencia del editor por la de "fijar coeficiente" | el menú de FNaF 4 (125/128 de fábrica) nunca pasaba del 2 % de opacidad | la acción **reemplaza** la del editor |
| ignorar el NO en condiciones que no son de objeto | "NO mouse apretado" = "mouse apretado": la linterna se apaga mientras se la sostiene | el NO se aplica en todas |
| ignorar la marca de doble clic | un toque simple te hace correr a la puerta | byte alto del parámetro 32 + detector de doble toque (450 ms, 40 px) |
| crear el audio recién en el primer toque | lo que el juego pide antes (la música del título) se pierde: título mudo | crear el contexto al cargar, suspendido; arranca con el toque |
| cartel de "girá el teléfono" | con el giro automático bloqueado (lo más común) el navegador se queda en vertical y el cartel no se va nunca; en un juego sin pausa, encima, la noche sigue detrás | **girar el juego** (`P.girar`, el default de `web.js`); el cartel, con `alGirarMal`/`alGirarBien`, queda sólo para `girar: false` |
| girar la página con CSS y nada más | el juego mide la pantalla parada y los toques le llegan cruzados | traducir `innerWidth/innerHeight`, `clientX/clientY` (mouse y touch), `getBoundingClientRect` y las medidas `vw/vh` del CSS |
| guardar el estilo original con `if (!antes)` | `''` es falso: se volvía a guardar ya girado y al enderezar se restauraba el giro | `antes === null` |
| `decode()` de todas las imágenes de una pantalla | 270 MB de píxeles sólo en el nivel de FNaF 4: el teléfono cierra la pestaña | pedir los archivos y dejar que el navegador decodifique al dibujar |
| `7z x` con un `.rar` | el 7z de Debian no trae el códec RAR: deja archivos de **0 bytes** y falla al final | `unar` para RAR |
| Emscripten baja zlib y SDL2 como `.tar.gz` de GitHub | detrás de un proxy que sólo deja `git` da 403 y la compilación se corta | clonarlos con `git` y dejarlos en su caché con la marca `.emscripten_url` (`porteos/pvz/portear.sh`) |
| reimplementación hecha para OTRA versión de los datos | PvZ-Portable espera la GOTY: con el PvZ de 2009 faltan 256 recursos y 3 animaciones y el juego se cierra | cruzar lo que pide el código con lo que hay (`Resources.cpp` vs `resources.xml`), y parchear el motor para la versión del dueño; **nunca inventar datos** |
| datos "compilados" de 32 bits (PopCap: `compiled/*.compiled`) | en 64 bits no se pueden leer; el motor quiere el XML, que el pak de 2009 no trae | en WebAssembly (32 bits) el formato coincide: se comprobó con el hash del esquema (`0xb393b4c0`) y se leen directo del pak |
| dejar "fuera de cuadro" una pantalla que no se usa | la de logros se seguía dibujando con imágenes vacías: 15 700 llamadas por cuadro y el menú colgado | que no se dibuje (`mVisible = false`) cuando no existe |
| tocar "click to start" apenas aparece el título | no pasa nada: el título acepta el toque recién cuando la barra de carga llegó al final | esperar ese estado (`cargado` en `porteo_estado`), no un tiempo fijo |
| audio de SDL en una pestaña oculta | sin cuadros el juego se frena, pero el audio sigue sonando desde su hilo | `audioContext.suspend()` en `visibilitychange` (y `resume()` al volver y al primer toque) |
| buscar el bloque de datos con `document.currentScript.previousElementSibling` mientras la página se lee | el juego agrega scripts al `<body>` en medio de la lectura: el "anterior" era el suyo y el pak salía roto ("invalid stored block lengths") | numerar los bloques (`data-i`) y buscarlos por número (`un-archivo.py`) |
| tocar la pantalla en una prueba mientras está la intro de la marca | el toque saltea la intro y no le llega al juego: "click to start" no pasaba | esperar a que no esté `#porteo-intro` |
| cargar las animaciones de PvZ-Portable recién cuando se usan | el juego dibuja 137 `IMAGE_REANIM_*` directamente y una partida guardada puede restaurar cualquiera: el 1-5 se cerraba ("table index is out of bounds") | precargarlas todas como el original, de a una con el título en pantalla |
| sacar Asyncify para achicar el wasm | los cuadros de diálogo de PvZ esperan con `emscripten_sleep` (`Dialog::WaitForResult`): sin Asyncify no andan | dejarlo (cuesta 2,4 MB de wasm y ~2 s con CPU ÷4) |
| preguntarle al disco por cada nombre posible de una imagen | en Emscripten cada archivo que no existe es una excepción de JS: ~25 000 consultas, 1,2 s de la carga con CPU ÷4 | leer cada carpeta una vez y no preguntar por lo que no está (`PakInterface::PuedeAbrirse`) |
| meter un binario en un `.html` con base64 | +33 % de tamaño, y leerlo es más lento | UTF-16 con BOM: dos bytes por carácter y sólo se escapa lo que el HTML no deja pasar (+3 %) |
| el `.html` en UTF-16 en una plataforma que lo procesa como texto | no es UTF-8 válido: leído como texto, queda basura y no arranca nada (probado con `srcdoc`) | `un-archivo.py --utf8`: 7 bits por carácter ASCII (+14 %), UTF-8 de verdad |
| un `<script src>` agregado después en la página UTF-16 | sin charset, el navegador lo lee con la codificación de la página: "Invalid or unexpected token" | los archivos de texto van como `charset=utf-8` |
| compilar el C# decompilado contra las DLL de Unity que trae el APK | vienen recortadas (*managed stripping*): faltan setters de atributos y miembros que el juego no usaba, y salen errores que en Unity no existen (22 en Slime Rancher) | compilar contra las DLL completas del editor de la misma versión (`herramientas/unity/verificar`) |
| el recorte del build en el código del juego | saca la mitad de un par de operadores (`==` sin `!=`) o un constructor: el decompilado no compila | agregar la otra mitad como la negación de la que quedó (`porteos/slime-rancher/arreglar.py`) |
| un port de Android de un juego de PC | quien lo porteó puede **reemplazar** el teclado y el mouse por controles de pantalla: en la web de PC no se puede jugar | buscar si la entrada original sigue en el código (en Slime Rancher, `SRInput` con todas sus teclas) y que el control táctil consulte también a la de PC |
| AssetRipper gratis con los shaders | no los decompila: en "dummy" todo se ve difuso y plano | exportarlos en YAML: conservan sus programas compilados, y los GLES2/GLES3 de Android son los mismos que usa WebGL |
| `pkill -f patrón` o `pgrep -f patrón` en el mismo comando que menciona el patrón | mata la propia shell (sale con 144) | anclar el patrón al proceso: `pgrep -f "^python3 -m http.server"`, o matar por PID |

## 14. Registro de porteos

### Bus Stop Simulator — terminado (falta la prueba en un teléfono de verdad)

```
Origen: bus-stop-simulator.apk (6,67 MB, ar.jxstudios.busstop, sha256 b64a463a…f4a4)
Motor: HTML5 + three.js dentro de un WebView (Kotlin + androidx WebViewAssetLoader)
Estrategia: sacar assets/ tal cual + web.js para lo que hacía la parte Android
Fidelidad: 1:1 — escena, modelos, texturas, sonidos, lógica, UI y créditos intactos
Tamaños: APK original 6,67 MB → web 8,17 MB (zip 5,33 MB) · un archivo 7,08 MB · APK nuevo 5,34 MB (−20 %)
Pruebas: 43/43 (porteos/bus-stop/prueba.mjs) · no se pudo probar en un teléfono real
```

- **El juego:** port a Android del juego de Game Jolt de Magnus Jungersen
  (@Sodakurt), que nunca se terminó, rearmado desde sus archivos. Los créditos
  se conservan tal cual.
- **Lo nativo** (leído del dex) y cómo volvió en la web: vibrar
  (`window.BusStopNativo.vibrar`; el juego ya caía a `navigator.vibrate`), atrás
  → Escape (colchón de historial), pantalla completa (al primer toque),
  pantalla prendida (Wake Lock), `sensorLandscape` (traba en pantalla completa
  y, si no se puede, el juego se gira solo con el teléfono parado) y 60 Hz
  (en el APK nuevo, `--hz 60`).
- **Controles móviles:** los propios del juego, que ya eran buenos y se
  conservan: joystick a la izquierda, mirar arrastrando a la derecha, CORRER,
  SALTAR, LINTERNA, E (agarrar) y pausa, con editor de posición y tamaño adentro
  del juego. Más el atrás de Android: pausa, y dos seguidos salen.
- **Optimización:** el APK baja 20 % por no llevar androidx ni Kotlin (3,1 MB de
  código). Los `.bin` y el `.json` viajan comprimidos (mallas 2,06 → 1,01 MB,
  pasto 1,05 MB → 7,5 KB, escena 324 → 25 KB). Las texturas WebP y el audio
  Opus mono **ya venían optimizados**: recomprimirlos sólo habría bajado la
  calidad, así que no se tocaron. La calidad gráfica automática ("media" en
  táctil) es la del juego original.
- **Probado (43/43):**
  - carga;
  - idioma → menú → JUGAR sólo tocando;
  - camina, corre (más rápido con dos dedos), mira mientras camina, salta
    0,85 m, linterna;
  - pausa con el botón, con atrás y al salir de la app;
  - dos atrás salen;
  - el guardado sobrevive;
  - los controles entran y no se pisan en 844×390, 640×360, 915×412 y 1024×600;
  - parado: el juego se gira solo, se entra a jugar y el joystick camina con el dedo donde se ve;
  - sin red después de la primera visita;
  - el archivo único abre desde el disco, se juega, carga la fuente y los 4
    audios;
  - sin errores en consola.
- **Encontrado y arreglado en el camino:** el atrás de Chrome se habría ido del
  juego (colchón puesto antes del primer toque) y la pantalla completa se pedía
  dos veces por toque. Ver §13.
- **Problemas conocidos:**
  - **No se probó en un teléfono real** (acá no hay emulador): el APK está
    verificado por dentro (firma v2+v3, orientación, SDK, 38 archivos del
    juego) y el mismo HTML pasó §9 en Chromium móvil.
  - El APK nuevo es otra app (`ar.juniors.busstop`): se instala **al lado** del
    original, y el progreso del original no pasa al nuevo.
  - Firmado con una clave de esta sesión: para que una versión futura se
    instale encima, hace falta guardar la clave (§7).
  - En iPhone no hay pantalla completa ni traba de orientación (el juego se
    gira solo), y el audio Opus pide iOS 17 o más nuevo: **no probado en Safari**.
- **Rearmarlo:** `porteos/bus-stop/portear.sh RUTA/bus-stop-simulator.apk`.
  **Probarlo:** `node porteos/bus-stop/prueba.mjs http://127.0.0.1:8811/ file:///…/bus-stop-simulator.html`.
- **No va al repo** (§11): `bus-stop/` y `entrega-*/` están en `.gitignore`.

### FNaF 4 — terminado (falta la prueba en un teléfono de verdad)

```
Origen: FNaF4 para Android (com.scottgames.fnaf4 1.1, 44,6 MB, sha256 b3104e3a…091e), por link de MediaFire
Motor: Clickteam Fusion 2.5, runtime de Android (res/raw/application.ccn + 60 WAV)
Estrategia: extraer los datos originales y correr sus eventos en herramientas/clickteam/motor.js
Fidelidad: 1:1 — 16 pantallas, 772 grupos de eventos, 228 objetos, 534 imágenes, 60 sonidos; la UI táctil es la de Android
Tamaños: APK original 44,6 MB → web 7,2 MB · un archivo 9,35 MB · APK nuevo 7,24 MB (−84 %)
Pruebas: 39/39 (porteos/fnaf4/prueba.mjs) · no se pudo probar en un teléfono real
```

- **Cobertura:** 1.575 condiciones, 1.508 acciones y 2.331 tokens de expresión:
  **el 100 %**, medido con `cobertura.mjs` antes de jugar.
- **Controles:** los de la versión Android, tal cual:
  - mantener a un costado para mirar;
  - **doble toque** para correr a una puerta;
  - mantener LINTERNA y CLOSE DOOR;
  - tocar abajo para darse vuelta o volver.

  Más el atrás de Android (el primero avisa, el segundo sale) y, con el
  teléfono parado, el juego girado 90° y jugable.
- **Optimización:**
  - imágenes: 20 MB de píxeles zlib → 5,6 MB en WebP;
  - sonidos: 24 MB de WAV → 2,9 MB en Opus;
  - el envoltorio del APK no carga los 3 runtimes nativos de Clickteam
    (armeabi, v7a y x86);
  - la lógica tarda 0,44 ms por cuadro;
  - las imágenes se decodifican al dibujarse: forzar todas serían 365 MB.
- **Probado:**
  - advertencia → título (con su música) → New Game → noche 1;
  - mirar, doble toque, linterna, puerta, volver;
  - el reloj a 1,00× (hora = 60 s);
  - perder (game over de 7 s → título) y ganar (6 AM → night win → Plushtrap);
  - las 16 pantallas sin errores;
  - cuatro tamaños de pantalla;
  - parado: se gira solo y se juega igual (mirar, doble toque, linterna);
  - sin red, y el archivo único desde el disco.
- **Problemas conocidos:**
  - no se probó en un teléfono real;
  - el APK nuevo es otra app (`ar.juniors.fnaf4`), al lado de la original;
  - las fuentes de Windows de los textos (Castellar, Book Antiqua) se
    reemplazan por las más parecidas;
  - sin probar en Safari.
- **Rearmarlo:** `porteos/fnaf4/portear.sh RUTA/fnaf4.apk`. **Probarlo:**
  `node porteos/fnaf4/prueba.mjs http://127.0.0.1:8821/ file:///…/fnaf4.html`.

### Plantas vs. Zombies (PC, 2009) — terminado (falta la prueba en un teléfono de verdad)

```
Origen: plantas_y_zombies_by_coudvan.rar (41,8 MB, sha256 f6491706…276e), por link de MediaFire:
        PlantsVsZombies.exe 1.0.0.1051 (el original de 2009, NO la GOTY) + main.pak 25 MB
Motor: PopCap SexyAppFramework, C++ compilado para Windows/DirectX
Estrategia: PvZ-Portable (reimplementación LGPL en C++/SDL2/GLES2) → WebAssembly,
            con los datos del dueño y un parche para que lea los de 2009
Fidelidad: 1:1 — la lógica del juego y los datos originales; sin logros ni Zombatar,
           que no existían en 2009
Tamaños: el juego instalado 26,9 MB (exe 3 + pak 23,9) → web 31,2 MB (pak 23,0 + motor 7,6 + carcasa)
         · APK 25,6 MB · un archivo 24,8 MB (era 33,7) · zip 24,2 MB
Memoria: 172 MB del módulo jugando el 1-1 (modo de poca memoria; el normal, 264)
Carga (Chrome, CPU ÷4 como un teléfono): "click to start" a los 10,9 s (era 15,1);
         el archivo único, 11,6 s (era 19,5)
Pruebas: 39/39 (prueba.mjs: toques reales, intro, teclado propio, pantalla ancha,
         girado, sin red, un archivo) · recorrido 31/31 con la pantalla ancha
         (recorrido.mjs) · bailarín 6/6 (bailarin.mjs) · no se pudo probar en un teléfono real
```

- **Qué hizo falta** (detalle en [`porteos/pvz/LEEME.md`](porteos/pvz/LEEME.md)):
  - el pak de 2009 trae las animaciones sólo compiladas (32 bits): en
    WebAssembly se leen tal cual (el hash del esquema coincide);
  - el bailarín es el de 2009 (`Zombie_Jackson`): alias de archivo, pistas e
    imágenes;
  - 256 recursos de la GOTY no existen: esas pantallas no se ofrecen, como en
    el original.
- **Controles:** los del original con el dedo como mouse: tocar el sobre,
  tocar el pasto, tocar los soles, la pala, los menús. El nombre del jugador se
  escribe con un teclado propio, de piedra y letras doradas como el juego.
  Atrás abre el menú del juego (dos seguidos salen). Parado, el juego se gira
  solo.
- **Pantalla:** en el jardín se ve más ancho, hasta 1020×600: la casa que el
  original tapaba, a la izquierda. A la derecha no, porque ahí nacen los
  zombis. Los menús siguen en 800×600.
- **Arranque:** la intro de JXStudios (la de FNaF 2) en lugar de la pantalla
  de carga verde; el juego carga por detrás.
- **Optimización:**
  - la carga va de a pedazos con el logo y el título animados, en vez de
    congelar la pantalla; se sacaron ~25 000 consultas al disco que no hacían
    falta (1,2 s con CPU ÷4) y la segunda decodificación de la música (1,5 s),
    con un resultado idéntico byte a byte;
  - el archivo único va en UTF-16 y no en base64, con el pak al final y
    descomprimido en otro hilo: 33,7 → 24,8 MB;
  - modo de poca memoria del motor (sonidos bajo demanda, sin copia en RAM de
    las texturas): 264 → 206 MB al medirlo (la versión de ahora: 172) y
    "click to start" 0,8 s antes;
  - PNG y JPG del pak recomprimidos sin pérdida y verificados píxel por píxel
    (−0,84 MB; PopCap ya comprimía bien);
  - el audio se suspende en segundo plano; las partidas se vuelcan a
    IndexedDB cada 5 s y al salir.
- **Probado:**
  - intro (se saltea con un toque) → título → perfil con el teclado propio →
    1-1 con la pantalla ancha → plantar (sol 150 → 50) → juntar sol (+25) →
    atrás → segundo plano → recargar con el perfil guardado;
  - lo mismo con el teléfono parado (girado);
  - sin red y el archivo único;
  - recorrido de 31 niveles y minijuegos (pileta, niebla, techo, jefe final,
    Zen, Árbol de la Sabiduría, Vasebreaker, I-Zombie, Zombiquarium…) con la
    pantalla ancha, sin un error, assert ni recurso faltante, siempre en 206 MB
    (la variante de depuración);
  - el archivo único arma `main.pak` y el wasm idénticos byte a byte;
  - el bailarín de 2009 en el 2-8: moonwalk, llama a los coristas, pierde
    brazo y cabeza.
- **Problemas conocidos:**
  - no se probó en un teléfono real ni en Safari;
  - menús, almanaque y tienda siguen en 4:3 con bandas (están dibujados para
    800×600); al elegir plantas mirando la calle, el selector queda corrido;
  - el juego está en inglés, como el original que llegó;
  - el APK es otra app (`ar.juniors.pvz`).
- **Rearmarlo:** `porteos/pvz/portear.sh RUTA/plantas.rar [SALIDA] [--un-archivo] [--depuracion]`.
  **Probarlo:** `node porteos/pvz/prueba.mjs http://127.0.0.1:8831/ file:///…/pvz.html`;
  con `--depuracion`, también `recorrido.mjs` (31 niveles y minijuegos) y `bailarin.mjs`.

### FNaF 2 — port de otra sesión, analizado y corregido

Un intérprete de Clickteam en JS que corre los datos originales.
- **Cobertura:** el 100 % de las condiciones y de las expresiones, y todas
  las acciones menos una.
- **Defecto grande:** el reloj iba **2,17× más rápido** (noche de 3,3 min en
  vez de 7), porque el extractor leyó "27 pantallas" como "27 cps".
  `porteos/fnaf2/corregir.py` lo arregla; medido después: 1,00×.

Detalle, mediciones y lo que falta en [`porteos/fnaf2/ANALISIS.md`](porteos/fnaf2/ANALISIS.md).

### Slime Rancher (APK no oficial, "v1.2") — proyecto listo para WebGL (falta compilar con licencia)

Un port de Android hecho por alguien en 2023: Slime Rancher 1.2.3 de PC recompilado con Unity
2018.4.36f1 (Mono, sólo 32 bits, controles táctiles agregados). No se encontró nada raro.

```
Origen: Slime Rancher v1.2 - espacioapk.com.apk (382,7 MB, sha256 bc7eab70…57e0), por link de MediaFire
Motor: Unity 2018.4.36f1, Mono (el C# viene entero en Managed/)
Estrategia: AssetRipper → proyecto de Unity → arreglos (arreglar.py) → WebGL con la misma versión
Fidelidad: 1:1 (su C#, su física, su mundo); en PC, con teclado y mouse como el original
Estado: el proyecto compila sin errores (WebGL y editor); falta compilarlo con Unity, que pide licencia
```

- **Qué hizo falta** (detalle en [`porteos/slime-rancher/LEEME.md`](porteos/slime-rancher/LEEME.md)):
  - 9 arreglos al C# decompilado;
  - sin hilos en WebGL (SECTR);
  - partidas en IndexedDB;
  - soltar la música que no suena;
  - créditos fuera del AssetBundle;
  - volver a conectar teclado y mouse, que el port de Android había cambiado por controles
    de pantalla.
- **Para compilarlo:**
  - en una PC: Unity 2018.4.36f1 con WebGL y menú Porteo → Compilar WebGL;
  - o acá, con la licencia del dueño como secreto (`UNITY_LICENSE`).
- **En un teléfono, entero, no entra en una pestaña:** el mundo es una escena de 357 mil
  objetos, la música decodificada son 3,0 GB y las texturas ETC no tienen equivalente en el
  WebGL de Unity 2018. Para el teléfono, con este proyecto sale un APK de 64 bits.
- **Rearmarlo:** `porteos/slime-rancher/portear.sh RUTA/slime.apk [SALIDA]`. Análisis y
  números: [`porteos/slime-rancher/ANALISIS.md`](porteos/slime-rancher/ANALISIS.md).

### Balatro (APK de Android) — versión web jugable

```
Origen: balatro mío xd juniors.apk (65,7 MB, sha256 56487be6…42cd), por link de MediaFire
Motor: LÖVE con Lua; el LÖVE es el de Playstack (love.platform: nube, logros) y LuaJIT
Estrategia: LÖVE 11.4 compilado para la web acá + el Lua del juego tal cual + una capa del navegador
Fidelidad: 1:1 (su Lua, sus shaders, su azar: una semilla da la misma partida que en el teléfono)
Tamaños: APK 66 MB → web 9 MB en total con la música (motor 1,7 MB comprimido + juego 7,1 MB);
        un solo .html de 9,6 MB (UTF-8), con la intro de JXStudios
Estado: menú, partida, guardado y sonido andan en Chromium, también dentro de Rezona (sitio y .html
        único); en el teléfono del dueño, 67 cuadros/s
```

- **Qué hizo falta** (detalle en [`porteos/balatro/LEEME.md`](porteos/balatro/LEEME.md)):
  - el motor, con Emscripten actual: sin hilos, WebGL 2, excepciones nativas de WebAssembly, y
    texturas sin swizzle ni glTexStorage;
  - el azar y `bit` de LuaJIT en el Lua 5.1 de la web: comparados con LuaJIT 2.1, mismas salidas;
  - `love.platform` con guardado local en vez de la nube;
  - hilos con corrutinas;
  - la ventana del tamaño del lienzo;
  - un shader para WebGL.
- **Lo que no se usa del APK** (o va más chico):
  - las fuentes CJK y la rusa (62 MB), con esos idiomas;
  - las texturas 1x (el juego recibe las 2x, recomprimidas sin pérdida);
  - el sonido en Vorbis mono (17,5 MB → 5,1 MB);
  - la parte Android: Java, `liblove.so` y un `libcheckupdate.so` que no es del juego (de quien
    reempaquetó el APK). Del APK sólo se toma `assets/`, y nada de eso se ejecuta.
- **Rearmarlo:** `porteos/balatro/portear.sh balatro.apk RUTA/A/emsdk SALIDA --registro __registro`;
  también arma el .html único (`SALIDA/Balatro.html`, con `un-archivo.py --utf8`).

---

## Apéndice A — La orden original del dueño (textual)

> Copiada tal cual la escribió. Es la fuente: el resto del documento la baja a
> herramientas y pasos concretos, pero si algo no coincide, **manda esto**.

Quiero que actúes como un especialista autónomo en porteo y adaptación de videojuegos a dispositivos móviles.

**REGLA PRINCIPAL**

Cada juego que te entregue debe ser tratado como un trabajo de porteo.

No quiero que decidas si vale la pena hacerlo, si es demasiado complicado o si preferís otro proyecto.

Yo decido qué juego te entrego. Vos trabajás en él.

Cuando te entregue un juego, proyecto, APK, ZIP, código, repositorio, build o archivos relacionados, empezá directamente a analizarlo y trabajar.

**OBJETIVO**

Quiero convertir los juegos que te entregue en versiones jugables en móvil, priorizando:

Juego original → adaptación HTML5 móvil → APK Android

Cuando HTML5 sea viable, quiero una versión HTML5 optimizada para celulares.

Después, cuando corresponda, empaquetala como APK mediante la tecnología más adecuada.

No hace falta que todos los juegos utilicen exactamente la misma tecnología. Elegí automáticamente la mejor estrategia según el juego.

**PODÉS RECIBIR CUALQUIER TIPO DE JUEGO**

Quiero que puedas trabajar con:

- HTML5
- JavaScript
- Unity
- Godot
- Unreal
- otros motores
- juegos indie
- juegos de itch.io
- juegos de Game Jolt
- juegos antiguos
- proyectos completos
- repositorios
- ZIP/RAR
- APK
- builds
- código fuente
- archivos parciales

Por ejemplo, podría entregarte un juego indie descargado de itch.io o un juego antiguo que tengo en APK.

No quiero que el origen del juego haga que abandones automáticamente el trabajo.

Primero analizá qué tenemos disponible y buscá la mejor estrategia para conseguir una versión móvil funcional.

**PROCESO AUTOMÁTICO**

Cada vez que te entregue un juego:

1. Analizá todos los archivos.
2. Identificá el motor y la tecnología.
3. Determiná cómo funciona.
4. Identificá qué partes pueden reutilizarse.
5. Elegí la estrategia de porteo más adecuada.
6. Implementá el port.
7. Adaptá el juego para pantalla táctil.
8. Optimizá rendimiento.
9. Reducí el tamaño cuando sea posible.
10. Probá el resultado.
11. Corregí errores.
12. Volvé a probar.
13. Continuá trabajando hasta obtener la versión móvil más completa posible.

No quiero solamente una explicación de cómo hacerlo. Quiero que lo hagas.

**ADAPTACIÓN A MÓVIL**

Conservá al máximo:

- gameplay
- mecánicas
- físicas
- mapas
- personajes
- animaciones
- sonidos
- música
- UI
- efectos
- progresión
- comportamiento original

Adaptá únicamente lo necesario para que funcione correctamente en móvil.

Si utiliza teclado:

- agregá controles táctiles.

Si utiliza mouse:

- agregá interacción táctil.

Si necesita movimiento:

- joystick virtual cuando corresponda.

Si necesita varios botones:

- botones táctiles bien organizados.

La interfaz debe sentirse como un juego móvil real y no simplemente como una página web metida dentro de una pantalla.

**HTML5**

Cuando sea viable, generá una versión:

- HTML5
- CSS
- JavaScript
- optimizada para móvil
- responsive
- compatible con navegadores Android
- con pantalla completa
- con controles táctiles
- con buen rendimiento

Intentá mantener la estructura lo más autocontenida posible.

Cuando tenga sentido, priorizá una distribución compacta y fácil de ejecutar.

**APK**

Cuando sea posible:

HTML5 → aplicación Android → APK

Elegí automáticamente entre WebView, Capacitor u otra solución adecuada.

El APK debe:

- instalarse correctamente
- abrir directamente el juego
- funcionar sin depender de una PC
- aprovechar pantalla completa
- tener controles táctiles
- mantener el rendimiento lo mejor posible

**COMPRESIÓN Y OPTIMIZACIÓN**

Quiero que el resultado sea lo más liviano posible sin destruir la calidad.

Buscá automáticamente:

- comprimir texturas
- optimizar imágenes
- comprimir audio
- eliminar archivos innecesarios
- reducir duplicados
- optimizar JavaScript
- reducir memoria utilizada
- reducir CPU/GPU innecesaria
- hacer lazy loading cuando corresponda
- optimizar assets
- reducir el tamaño final del APK

No reduzcas calidad visual si no es necesario.

La prioridad es:

fidelidad + rendimiento + tamaño razonable.

**JUEGOS GRANDES O COMPLEJOS**

Si te entrego algo muy complejo, no abandones automáticamente.

Dividilo en partes:

análisis → extracción/organización → porteo → adaptación → optimización → pruebas → correcciones.

Si una parte específica necesita una solución diferente, implementala.

Si el port 1:1 no es técnicamente viable con los archivos disponibles, buscá la adaptación más cercana posible en lugar de detener todo el proyecto.

**AUTONOMÍA**

Quiero que trabajes de forma autónoma.

No me preguntes cosas innecesarias como:

«"¿Querés que lo porte?"»

La respuesta es sí porque yo ya te entregué el juego.

Tampoco quiero que me hagas elegir entre diez tecnologías si podés determinar vos cuál conviene.

Elegí la solución técnicamente más adecuada y avanzá.

Si necesitás tomar una decisión técnica, tomala vos y continuá.

Solo detenete para preguntarme algo cuando sea realmente imposible continuar sin información mía.

**RESULTADO FINAL**

Cuando termines un port, dejame:

- versión HTML5 cuando corresponda
- proyecto Android cuando corresponda
- APK cuando sea posible
- tamaño final
- controles móviles implementados
- optimizaciones realizadas
- problemas conocidos, si queda alguno

Pero no te limites a generar archivos.

Probá, depurá y corregí el proyecto antes de considerarlo terminado.

**REGLA FINAL**

Cada vez que te entregue un juego:

NO DECIDAS SI HACERLO.

HACELO.

Analizá → porteá → adaptá → optimizá → probá → corregí → empaquetá.

Tu objetivo es conseguir la versión móvil más fiel, funcional, optimizada y liviana que sea técnicamente posible con los archivos que te entregue.

*Y después, en sus palabras: "si o si de juegos sin dudas que simplemente lo hagas y vayas y pal pam".*
