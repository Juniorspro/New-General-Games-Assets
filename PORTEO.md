# PORTEO — cómo se portea un juego a móvil, sin preguntar

> **Para cualquier sesión que reciba un juego:** este documento es la orden.
> No se decide si vale la pena. No se pregunta "¿querés que lo porte?".
> Llegó un juego → se analiza → se portea → se adapta → se optimiza →
> se prueba → se corrige → se empaqueta → se entrega. **Y pal pam.**

Acompaña a `ARRANQUE.md` (cómo se trabaja en esta máquina) y `ESTADO.md` (qué
hay construido). Las herramientas están en [`herramientas/porteo/`](herramientas/porteo/).

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
| APK con `lib/*/libunity.so`, `libil2cpp.so`, `assets/bin/Data/` | **Unity Android** |
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
| `*.exe` de DOS, `*.jar` de Java ME, ROMs | juego viejo: va por emulación |

### 4.2 Qué se hace con cada uno

| tenemos | estrategia | fidelidad |
|---|---|---|
| **HTML5 dentro de un APK** | se extrae `assets/`, se reemplaza lo nativo con `web.js` (§6), se prueba | 1:1 |
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
| **Unity Android sin proyecto** (IL2CPP) | no se puede pasar el binario a web. Se extraen los assets (AssetRipper/AssetStudio: modelos, texturas, audio, escenas) y se **rearma la lógica** en three.js. Si hay un build de PC Mono, las DLL se descompilan con ILSpy y la lógica se traduce leyendo el original | lo más cercano posible |
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
| tipear texto | se enfoca un `<input>` real para que salga el teclado del teléfono |
| resolución fija (800×600) | `Porteo.pantalla({ encajar: 'canvas' })`: escala con bandas, sin tocar la resolución interna |
| orientación cualquiera | la que el juego necesita: se traba en el APK y en pantalla completa; si no se puede, cartel de "girá el teléfono" |

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
| `screenOrientation` | `screen.orientation.lock()` al entrar en pantalla completa; si no se puede, cartel de "girá el teléfono" + `alGirarMal` (pausar) |
| `FLAG_KEEP_SCREEN_ON` | Wake Lock API |
| pantalla completa inmersiva | `requestFullscreen()` al primer toque |
| `onPause` pausa todo | el juego suele escuchar `visibilitychange`; si no, se agrega |
| assets locales sin red | `sw.js` (service worker): después de la primera visita anda sin internet |

```html
<script src="web.js"></script>
<script>
  Porteo.web({ orientacion: 'landscape', alGirarMal: () => miJuego.pausar() });
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

Al terminar cada porteo se entrega, **como archivos** (no sólo una ruta):

1. **HTML5** — carpeta lista para subir (con `manifest.webmanifest` + `sw.js`
   para instalar y jugar sin red) y, cuando se pueda, **un solo `.html`** que se
   abre con doble clic;
2. **APK** firmado;
3. **proyecto Android** = el comando de `armar.py` con sus opciones (se regenera
   en segundos);
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

Los créditos del original se conservan siempre: nunca se borra la pantalla de
créditos ni se tapa al autor.

## 12. La máquina

- **SDK mínimo de Android:** `herramientas/porteo/instalar-sdk.sh` (build-tools
  35 + platform 35 en `/opt/android-sdk`). `ARRANQUE.md` decía que no se podía
  compilar un APK porque el SDK entero no entraba. Con el mínimo sí se puede.
- **Java 21, Node 22, Python 3, ffmpeg y Chromium** ya vienen en el entorno.
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

## 14. Registro de porteos

### Bus Stop Simulator — en curso

- **Llegó:** `bus-stop-simulator.apk` (6,99 MB), paquete `ar.jxstudios.busstop`.
  Es un port a Android del juego de Game Jolt de Magnus Jungersen (@Sodakurt),
  rearmado desde sus archivos. Los créditos se conservan.
- **Motor:** HTML5 + three.js dentro de un WebView. Kotlin + androidx
  `WebViewAssetLoader`. Adentro: `index.html`, `juego.js` (603 KB, con three.js
  incluido), `bus.css` y `datos/` (escena, mallas, alturas, pasto, árboles,
  20 texturas WebP, 4 audios Opus y una fuente).
- **Lo nativo** (leído del dex): vibrar (`window.BusStopNativo.vibrar`, el JS ya
  cae a `navigator.vibrate`), atrás → Escape, pantalla completa, pantalla
  prendida y `screenOrientation=sensorLandscape`.
- **Estrategia:** extraer `assets/` tal cual (1:1) + `web.js` para lo nativo +
  PWA para jugar sin red + versión de un solo archivo + APK nuevo con
  `armar.py`.
- **Probado hasta ahora** (Chromium móvil 844×390, táctil por CDP):
  - carga en 4,3 s, sin errores;
  - idioma → menú → JUGAR sólo tocando;
  - el juego ya trae controles táctiles propios (joystick, correr, saltar,
    linterna, usar, pausa);
  - joystick: camina 2,8 m;
  - mirar con un segundo dedo mientras camina: gira;
  - saltar: sube 0,9 m, igual que la barra espaciadora;
  - Escape: abre la pausa.
- **Encontrado:** en vertical, el joystick queda cortado contra el borde. El
  original lo evitaba trabando en horizontal: en web lo resuelve `web.js` con el
  cartel de "girá el teléfono" y la pausa.
- **Falta:** integrar `web.js`, manifest y `sw.js`; la versión de un solo
  archivo; armar el APK; la pasada completa de §9; el informe final.
- **No va al repo** (§11): `bus-stop/` está en `.gitignore`.
