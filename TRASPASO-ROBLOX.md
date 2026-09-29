# Traspaso: hacer juegos de Roblox desde la PC (29/09/2026)

Para la sesión de Claude Code que corre en la PC con Roblox Studio y se maneja desde el celu con Remote
Control. Lo escribió la sesión anterior, que corría en la nube y no podía llegar a Studio. Leelo entero una vez;
después usalo de consulta.

Secciones:
1. Quién pide.
2. Las reglas.
3. La PC.
4. Lo que no sirve.
5. El MCP.
6. Juegos de Roblox.
7. De HTML a Roblox.
8. El repo.
9. Los juegos HTML: estilo, números y lo que rechazó.
10. Lo próximo.

## 1. Quién pide y cómo hablarle

- **Castellano rioplatense, corto e informal.** Escribe corto ("che", "xd", "dale"); contestale igual.
- No sabemos sus pronombres: no le asignes género.
- **Escribe desde el celu** y manda fotos de la pantalla de la PC. Los comandos van **exactos y listos para
  copiar**, de a un bloque, diciendo en qué ventana van. Si algo falla, pedí foto del error.
- **Quiere que se haga todo de una**, sin vueltas ni preguntas de más. Si hay que elegir, recomendá una opción y
  seguí.
- **Pide exactamente lo que quiere.** Si pide un `.md`, es un `.md` y nada más.
- **Calidad alta**: "goty", "AAA", con números detrás. Pide "200 %", "700 %" o "1000 % mejor". Cada juego nuevo
  tiene que superar claramente al anterior, sin copiarlo: antes de empezar, mirá qué tenía el último y subí la vara.
- **Una mecánica pulida vale más que muchas.**
- **El celu primero:**
  - en el celu arranca con los controles de dedo, nunca en modo teclado;
  - los menús entran sin desplazar en un celu acostado (844 × 390);
  - se prueba con el celu acostado y parado.
- **Videos** (si pide un tráiler): uno solo, en 9:16 para TikTok, cinematográfico, con motion graphics del juego.
- **Sus reglas para todo juego** (vienen de sus juegos web y valen acá):
  - Antes del menú se elige idioma: **español, inglés o portugués**, con todo traducido (menús, historia,
    diálogos). La primera vez toma el idioma del aparato y después recuerda el último.
  - **Controles de dedo personalizables**: mover y agrandar cada botón, transparencia, zurdo, vibración, y que se
    guarde.
  - **Cada juego con estilo propio**: otros botones, otro menú, otras transiciones.
- Firma como **JXStudios** (su estudio).

## 2. Reglas que no se discuten

- **Ningún secreto en el chat ni en archivos.** Nunca pidas contraseñas, tokens ni la cookie de Roblox
  (`.ROBLOSECURITY`): con eso cualquiera se queda con la cuenta. Si pega uno, decile que lo regenere.
  - El 29/09 pegó en el chat un token de la API de Kaggle: hay que regenerarlo en kaggle.com/settings.
- **No saltear protecciones de seguridad** (captchas, verificaciones de ubicación, anti-trampas).
- **No instalar nada en la PC sin preguntar.** Es una netbook con Windows 11, que puede tener restricciones.
- **Nada ajeno sin permiso**: ni música ni modelos con derechos de otros.
  - Modelos gratis de la Toolbox, solo revisados: muchos traen scripts escondidos (backdoors con `require(id)`,
    `getfenv` o `loadstring`). Si un modelo trae scripts que no hacen falta, se borran.
- **Decí lo que no se pudo hacer, con el motivo.** Medí antes de afirmar.
- En los commits (si hay git) no va el identificador del modelo.

## 3. Cómo quedó armada la PC

- **Claude Code 2.1.284** en `%USERPROFILE%\.local\bin\claude.exe`. Se agregó al PATH del usuario. Si `claude`
  "no se reconoce", usá la ruta completa o corré `set PATH=%PATH%;%USERPROFILE%\.local\bin`.
- **El MCP de Roblox Studio** está en el alcance del usuario, con el nombre `Roblox_Studio`:
  ```
  claude mcp add --scope user Roblox_Studio -- cmd.exe /c "cd /d %LOCALAPPDATA%\Roblox && .\mcp.bat"
  ```
  - Lo da Studio en *Configuración del asistente → Servidores MCP*. Solo anda con **Studio abierto** y ese
    servidor prendido.
  - `/mcp` muestra si está conectado. Si no conecta: abrir Studio y el place, y reiniciar `claude`.
- **La carpeta de trabajo** es `%USERPROFILE%\juegos-roblox`. Ahí van copias de los scripts (`.lua`) de cada
  juego, así no dependen solo del place.
- **Remote Control:** adentro de `claude` se escribe `/remote-control` (o `/rc`). La sesión aparece en la app de
  Claude del celu, pestaña Code, con un ícono de compu.
  - Pide la cuenta de claude.ai con suscripción, no una API key. Si falla, `claude doctor`.

## 4. Lo que ya se probó y no sirve (no insistir)

- **Studio en la nube** (Wine en el contenedor de la sesión web): arranca, pero el inicio de sesión rápido de
  Roblox da "no pudimos hacer coincidir tu ubicación" y exige la misma red. No se puede entrar, y está bien que
  no se pueda. Studio va en la PC.
- **Conector de claude.ai con el MCP de Studio:** no se puede. Es un programa local (stdio), sin dirección web.
- **Una GPU de Kaggle** no hace falta.

## 5. Cómo trabajar con el MCP de Studio

- **Lo primero es ver las herramientas** con `/mcp`. No asumas nombres: cambian con las versiones de Studio.
  - El servidor oficial suele traer una para **correr Luau en Studio** (arma el juego con `Instance.new` y
    propiedades, y crea scripts poniéndoles `.Source`).
  - Suele traer otra para **insertar modelos** de la Toolbox, y otras para **leer la consola** y **empezar o parar
    el modo Jugar**.
- **El ciclo:**
  1. Armar en partes chicas (el mapa, después la lógica, después la interfaz).
  2. Después de cada parte, probar en modo Jugar y leer la consola.
  3. Arreglar y seguir.
- **Guardar.** El MCP cambia el place abierto, pero guardar es de quien pide: recordale **Ctrl+S** o *Archivo →
  Publicar en Roblox* después de cada avance grande. Sin publicar, DataStore no anda.
- **Para probar DataStore en Studio:** *Configuración del juego → Seguridad → Permitir acceso de Studio a los
  servicios de API*.
- **Todo lo que se crea va con nombre claro** (nada de "Part", "Script"), así se encuentra después.

## 6. Cómo se arma un buen juego de Roblox

- **Dónde va cada cosa:**
  - `ServerScriptService`: la lógica del servidor (puntos, daño, compras, guardado).
  - `ReplicatedStorage`: los módulos compartidos y los `RemoteEvent` / `RemoteFunction`.
  - `StarterPlayer › StarterPlayerScripts`, y `StarterGui` con `LocalScript`: la interfaz y los controles.
  - `Workspace`: el mapa, con las piezas quietas en `Anchored = true`.
- **Nunca confiar en el cliente.** Todo `RemoteEvent` se valida en el servidor: quién, cuánto, cada cuánto y si le
  alcanza. El cliente pide; el servidor decide.
- **Guardar el progreso** (`DataStoreService`):
  - con `pcall` y reintentos, y `UpdateAsync` para lo que suma;
  - al salir (`PlayerRemoving`) y en `game:BindToClose`;
  - una clave por jugador (`"j_" .. player.UserId`).
- **Luau moderno:**
  - `task.wait`, `task.spawn` y `task.delay` en vez de `wait` y `spawn`;
  - `--!strict` y tipos donde ayuden;
  - `TweenService` para animar y `CollectionService` (etiquetas) para piezas repetidas (lava, monedas, puntos de
    guardado);
  - `Debris` para lo que se borra solo.
- **El celu primero:**
  - la interfaz en `Scale`, no en `Offset`, con `UIAspectRatioConstraint` y botones grandes;
  - probar con el *Emulador de dispositivos*;
  - botones propios con `ContextActionService:BindAction(..., true)`, o una interfaz propia. Para que se muevan y
    agranden, guardar posición y tamaño por jugador (DataStore o atributos).
- **Los tres idiomas:** un `ModuleScript` en `ReplicatedStorage` con los textos `es`, `en` y `pt`, más la
  pantalla de idioma antes del menú. Arranca en el idioma de `Players.LocalPlayer.LocaleId`, se puede cambiar y
  se guarda.
- **Rendimiento:**
  - `StreamingEnabled` en mapas grandes;
  - pocas piezas sueltas con física;
  - unir lo repetido en modelos;
  - nada de bucles cada cuadro en el servidor si se puede evitar.
- **Plata** (si la pide): Game Passes y Developer Products con `MarketplaceService`. `ProcessReceipt` va en el
  servidor y devuelve `PurchaseGranted` solo después de dar el premio.
- **Géneros que andan:**
  - **Obby:** puntos de guardado con `SpawnLocation` y equipos, lava, plataformas que se mueven o desaparecen,
    etapas numeradas y un contador.
  - **Tycoon:** droppers, cintas, un colector y botones de compra con precio. La plata va en `leaderstats` y se
    guarda.
  - **Simulador:** tocar para ganar, mejoras, mascotas que siguen y renacer (rebirth).
  - **Pelea:** hitbox en el servidor, tiempo de espera por golpe, combos y barra de vida.
- **Normas de Roblox:** contenido apto para todas las edades, sin links afuera y sin pedir datos personales.

## 7. Llevar a Roblox lo que ya hicimos en HTML

La sección 9 cuenta cada juego web. Acá va cómo se consigue lo mismo en Roblox. Donde no hay equivalente, dice cómo
se imita.

### La luz y el aire (el 80 % del "se ve goty")

- **`Lighting.Technology = Future`**: luces con sombra de verdad y reflejos. **`EnvironmentDiffuseScale` y
  `EnvironmentSpecularScale` en 1**, para que el cielo ilumine y se refleje en lo brilloso.
- **`Atmosphere`:** el aire con color.
  - Frutiger Aero: `Density` 0,25-0,35, `Haze` 1-2, `Color` celeste claro y `Decay` celeste.
  - Bosque VHS: más denso y naranja.
  - Nieve: blanco azulado.
- **`Sky`** con su skybox, o el de la hora. `ClockTime` y `GeographicLatitude` eligen la luz del sol.
- **Efectos de cámara** (en `Lighting`):
  - `BloomEffect`: `Intensity` 0,4-1, `Size` 24-40, `Threshold` 0,85-0,95. Es el brillo Aero.
  - `ColorCorrectionEffect`:
    - saturación +0,1 a +0,2 para Aero;
    - −0,4 con `TintColor` cálido para VHS;
    - contraste +0,05.
  - `SunRaysEffect` (rayos entre las nubes), `DepthOfFieldEffect` (cinemáticas) y `BlurEffect` (menús atrás).
- **Neblina sin `Atmosphere`:** `Lighting.FogStart`, `FogEnd` y `FogColor`.

### Materiales y brillos

- **Lo brilloso Frutiger Aero** (gelatina, vidrio y burbujas):
  - `Material = Glass` o `SmoothPlastic`, `Reflectance` 0,2-0,5 y `Transparency` 0,2-0,6;
  - para lo que brilla solo, `Neon` con un color claro.
- **Las burbujas:** esferas con `ForceField` o `Glass`, transparentes, que suben con `TweenService` y un
  `ParticleEmitter` de burbujitas.
- **PBR de verdad:** `MeshPart` + `SurfaceAppearance`, con los mapas de color, normal, rugosidad y metal. Los
  mapas se pueden generar con Rezona.
- **El borde de color (contorno):** `Highlight` con `OutlineColor`. Sirve para lo elegido, lo que se puede
  agarrar y los enemigos.
- **Lo que titila y lo que deja estela:** `ParticleEmitter` (chispas, polvo, nieve, pétalos), `Trail` (estelas al
  correr o deslizar) y `Beam` (rayos, tirolesas, luces).
- **Pixel art en 3D:** texturas chicas con `ResampleMode = Pixelated`, en `Decal`/`Texture` o en un
  `ImageLabel`.

### La cámara

- **La de siempre, suavizada:** en un `LocalScript` con `RunService:BindToRenderStep`, la cámara va hacia su lugar
  con `lerp` (`1 - math.exp(-dt * 8)`). Como en AEROPLAZA, un poco más lejos al correr y un poco de sacudida al
  aterrizar.
- **2D de costado** (plataformas tipo ZONDA/BRILLO): `CameraType = Scriptable` y `FieldOfView` 15-25 desde lejos,
  así casi no hay perspectiva. El jugador queda fijo en Z con un `AlignPosition` o forzando la Z cada cuadro.
- **2.5D de papel** (KUNTUR): cámara de costado un poco arriba; los personajes y el decorado son planos con
  `Decal`/`SurfaceGui`. El "dar vuelta el papel" es un tween del ancho a 0 y de vuelta.
- **Primera persona** (CONTRAGOLPE): `Players.LocalPlayer.CameraMode = LockFirstPerson`, con un viewmodel (los
  brazos y el arma) pegado a la cámara en un `Model` local.
- **Cinemáticas** (NEVADA): tweens de `Camera.CFrame` por tramos, con `DepthOfField` y `SunRays`. Las tomas se
  arman con `Part` invisibles como puntos de cámara.

### El movimiento que se siente bien

- **Salto con perdón** (ZONDA/BRILLO): `coyote time` de 0,1 s (salta aunque ya se cayó del borde) y `jump buffer`
  de 0,12 s (si apretó justo antes de tocar el piso, salta).
  - Se hace escuchando `Humanoid.StateChanged` y `UserInputService.JumpRequest`, y llamando a
    `Humanoid:ChangeState(Enum.HumanoidStateType.Jumping)`.
  - Salto variable: al soltar, se corta la subida bajando la velocidad Y.
- **Parkour** (AEROPLAZA): correr, saltar, deslizar y rodar.
  - Rayos (`workspace:Raycast`) para las paredes y los bordes; `LinearVelocity`/`VectorForce` para el empuje.
  - Animaciones propias con `Animator:LoadAnimation`. Hay que publicarlas en su cuenta; si no, se animan a mano
    con `Motor6D.Transform`.
- **Personajes blanditos** (los muñecos de gelatina): se estiran al saltar y se aplastan al caer, con tweens de
  escala de un `Model` o de los `Motor6D`.
- **Autos** (RUTA 40):
  - Suspensión por rayos: cuatro rayos para abajo y un `VectorForce` de resorte por rueda.
  - Si no, `VehicleSeat` con `HingeConstraint` (motor) y `SpringConstraint`.
  - Las vueltas en el aire con torque, como en Hill Climb.
- **Disparos** (CONTRAGOLPE): el servidor tira el rayo y decide el daño; el cliente solo muestra (fogonazo,
  casquillo, marca de bala, `Highlight` rojo al pegar).
- **Físicas raras** (DIMENSIÓN Ñ, TELARAÑA, GARFIO): cuerdas con `RopeConstraint`/`SpringConstraint`, ganchos con
  `AlignPosition`, y muñecos de trapo con `BallSocketConstraint` en las articulaciones.

### La interfaz (cada juego con la suya)

- **Formas:** `UICorner` (redondeado de 12-22 px en Aero), `UIStroke` (borde de 2-3 px), `UIGradient` (blanco a
  gris claro, el brillo de arriba) y `UIPadding` / `UIListLayout` / `UIGridLayout`.
- **Letras:** `Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Bold)` o GothamSSm.
  Pixel art: una fuente de píxeles propia con `ImageLabel`, o `Arcade`.
- **Transiciones con rebote:** `TweenService` con `Enum.EasingStyle.Back` (el `cubic-bezier(0.2, 0.9, 0.3, 1.15)`
  de AEROPLAZA), o `Quint`/`Exponential` para lo seco. Entran desde abajo o se agrandan de 0,85 a 1.
- **Avisos tipo Windows 7** (AEROPLAZA): tarjetas arriba al medio, de a una, que se juntan (×2) y se van solas.
- **Menú de idioma primero**, con tres banderas o botones grandes (es, en, pt). Después el menú propio de cada
  juego.
- **Controles de dedo personalizables:**
  - los botones son `ImageButton` propios en un `ScreenGui`;
  - un modo "editar" deja arrastrarlos y agrandarlos, con transparencia, zurdo y vibración
    (`HapticService`, donde exista);
  - se guarda por jugador (DataStore; en el cliente, atributos).
  - Se puede sacar la palanca de Roblox (`GuiService.TouchControlsEnabled = false`, en un `LocalScript`) y poner una
    propia.

### El sonido

- **`SoundService` con `SoundGroup`** (música, efectos, interfaz) y un volumen para cada uno en las opciones.
- **Campanitas suaves en la interfaz** (AEROPLAZA), un golpe al aterrizar y el viento al correr rápido.
- **Música:** solo la que pasa quien pide o de la biblioteca de Roblox con licencia; nada ajeno.
- **Sonido 3D:** `Sound` adentro de una `Part`, con `RollOffMaxDistance`.

### Lo que no hay en Roblox y cómo se imita

- **Shaders propios** (el PS1, el CRT, la aberración de color): no hay. Se imita con:
  - una capa de interfaz encima (`ImageLabel` a pantalla completa con líneas de barrido y ruido, `ImageTransparency`
    0,85-0,95);
  - `ColorCorrection` y un `Blur` leve;
  - para el PS1, texturas chicas pixeladas y poca luz.
- **Pixelar toda la pantalla:** no se puede. Se usa un `ViewportFrame` chico estirado, solo para escenas cortas
  (es caro), o se diseña el arte ya pixelado.
- **Multijugador:** Roblox ya lo trae. Lo que en AEROPLAZA era MQTT, acá son `RemoteEvent`, el servidor y
  `MessagingService` para varias salas.

## 8. Lo que hay en su repo (por si pregunta)

- `Juniorspro/New-General-Games-Assets` (público): sus juegos web (AEROPLAZA, BRILLO, KUNTUR, RUTA 40 y más) y la
  memoria de las sesiones en `memoria/`. Se arranca por `memoria/INDICE.md`.
- **AEROPLAZA** es el grande: un mundo 3D social en three.js, con APK para Android que se actualiza sola, VR y
  un celu con amigos. En la vuelta 49 se rehízo "construir la casa" al estilo Sims Mobile.
- Tiene Rezona y Higgsfield para generar imágenes, audio y modelos. Prefiere Rezona. En la PC no están
  conectados salvo que los agregue.
- `herramientas/neko/` (`neko.py`, con su `LEEME.md`): maneja una PC virtual Neko remota. La pantalla llega por
  REST y los clics y las teclas van por WebSocket. Las credenciales van solo por variables de entorno.

## 9. Los juegos que hicimos en HTML: gráficos, mecánicas y estilos

Sale de `memoria/`, de `GUIA-JUEGOS.md` (§0, §6, §7 y §11), de los README y de las constantes del código. Lo que va
con "(?)" no está confirmado.

**Para pasar los números a Roblox:** 1 stud ≈ 0,28 m (un personaje mide unos 5 studs). Los metros se multiplican por
~3,6. La gravedad de Roblox viene en 196,2 studs/s²; si un juego pide "gravedad 24 m/s²", son ~86 studs/s², en
`workspace.Gravity` o con una fuerza propia. Mejor probar a ojo contra los números de acá.

### El estilo de la casa

**La regla madre (GUIA §0): se ve bien por la luz, no por los polígonos.** En orden de lo que más rinde:
1. Una sola hora del día y un sol que manda. El ambiente nunca le gana al sol sobre el suelo; si le gana, todo
   sale "plano y lechoso".
2. Niebla del color del horizonte, más densa abajo y dorada hacia el sol.
3. Tono de película: HDR con AgX o ACES al final. AEROPLAZA usa Neutral con exposición 1,0.
4. Materiales con textura y relieve.
5. Densidad antes que detalle.
6. Todo se mueve un poco: viento, polvo, la cámara como en mano.
7. Un post-proceso con identidad.
8. Sonido con distancia (reverberación en lo lejano).

**Números del bosque (GUIA §6.2):**
- Sol color (1, 0,74, 0,5) con intensidad 4,6. Hemisférica cielo (0,5, 0,58, 0,74) y suelo (0,16, 0,13, 0,08) a
  0,5. Reflejo del cielo 0,26.
- Sombra: caja de ±34 m que sigue al personaje avanzando de a un texel. Si se mueve de a medio píxel, los bordes
  titilan.
- Niebla exponencial 0,003 más una bruma baja.

**Frutiger Aero 3D (AEROPLAZA):**
- Mundo de vidrio, burbujas, agua, pasto verde y cielo azul con arcoíris (en la plaza, de día). Nubes teñidas por
  la hora, vía láctea de noche, medusas de gelatina y flores de agua gigantes para pisar.
- **Muñeco de gelatina** (material físico con barniz):
  - aspereza 0,14, barniz 1 (aspereza del barniz 0,05), tornasol 0,15, brillo tipo terciopelo 0,3, reflejos ×2,2;
  - brilla de adentro (0,22) y tiene el borde encendido (fresnel a la 2,6, fuerza 0,55);
  - degradé de color1 arriba a color2 abajo en cada pieza, y un motivo que sube con borde en ola y filo blanco
    espumoso;
  - otros materiales para elegir: vidrio (opacidad 0,62), perla, cromo, neón, holográfico, diamante.
- **Proporciones del muñeco:** piernas casi tan altas como la cabeza, brazos gordos que cuelgan por fuera. Los ojos
  son óvalos de gelatina del color del cuerpo (no negros), hondos, con filo oscuro, del 37 % del alto de la cabeza.
- **Luz Aero:** reflejos del cielo 0,3-0,7 y hemisférica 0,18-0,5 (con las dos fuertes, la arena salía celeste).
- **Bloom:** fuerza 0,38, radio 0,55, umbral **1,45**. Con 0,9, todo lo blanco al sol se abría en niebla. Va a
  media resolución.
- **Vidrio:** opacidad 0,12, reflejos 0,7 y borde fresnel. Con barniz, de costado era una pared blanca.
- **Pasto y arena:** la textura solo da grano; el color lo pone el vértice. Si no, el suelo sale lavado.
- **Interfaz: "menú de consola de 2006"** (tipo Wii):
  - colores `#34bef0`, `#1aa0d8`, grises `#b9bec4` y `#d9dde1`, tinta `#5b6168`, fondo `#eceff2`, verde
    `#56d05a`, rojo `#ff5f7a`;
  - letra redonda: Nunito o Varela Round, y "Arial Rounded" de reserva;
  - botones píldora blancos con degradé y borde gris que se prende celeste al pasar; al tocar se achican a 0,96;
  - canales 16:10 con radio de 18 px, fondo rayado fino y entrada con "zoom al canal" (0,45 s, escala 1,03).
- **Avisos:** globos de vidrio chiquitos arriba, estilo Windows 7, con campanitas sintetizadas.

**Frutiger Aero en pixel (BRILLO):**
- Pixel art de 288 de alto, todo pintado con código.
- Rampas de 8 tonos. El brillo de vidrio es la mitad de arriba más clara con corte nítido, más un punto de luz y el
  contorno del color de su rampa.
- Encima, a la resolución del juego: bloom, destello de lente, rayos, gradación por mundo, ondulación bajo el agua
  y **un velo claro en los bordes** (el Aero aclara, no oscurece).
- Colores:
  - tinta `#0b2a55`;
  - aguas `#c6f4ff`, `#5fd0ff`, `#1a9fe6` y `#56d8ff`;
  - verdes `#e8ffd2`, `#86e24f`, `#3cae1d` y `#8fec5e`;
  - cielo en degradé `#1b66d8` → `#86c4fb` → `#f2fbff`.
- Letra Segoe UI, Frutiger o Myriad.
- Interfaz:
  - el idioma se elige reventando una burbuja;
  - "Iniciando sesión…" con los muñequitos girando;
  - menús en píldoras brillantes;
  - las charlas son ventanas de chat ("Tito está escribiendo…");
  - avisos abajo a la derecha, como en el MSN;
  - las transiciones son una ola de burbujas.

**Sonido Frutiger (BRILLO, reusado en AEROPLAZA):**
- Armonía: acordes maj9 y m9, dominantes 7sus4, modo lidio en el cielo y dórico en el agua y la noche.
- Ritmo: bossa en piano eléctrico, bajo de raíz y quinta, escobillas y shaker.
- Timbres: marimba, vibráfono, campanitas, coro, flauta y cajita de música.
- Mezcla: reverb grande y clara, eco de lado a lado, filtro "de parlante viejo", y bajo el agua todo se apaga.
- Efectos:
  - la gota hace "pup": un seno de 300 a 720 Hz en 50 ms, que sube la escala si se juntan seguidas;
  - "sesión iniciada" son dos notas que suben;
  - los timbres de aviso van de a uno, cada 0,35 s como mucho.

**Papel 2.5D (KUNTUR):**
- Pixel art impreso en recortes de papel con borde blanco, sobre un diorama de cartón.
- Colores: papel `#f4ead6`, crema `#efe2c4`, tinta `#3a2a22`, borde `#f7f3ea`. Letra de mano (Segoe Print) y
  otra gorda (Arial Black).
- Interfaz: telón de aguayo que se frunce, cartelitos colgados para el idioma, boletos de tren como menú, mapa
  doblado, cuaderno de coplas y globitos de papel.

**Pixel nocturno (LUZ MALA):**
- Menús dibujados en el lienzo, sin botones: palabras que se prenden y dos luciérnagas de cursor.
- Letra fina propia con halo. El idioma se elige con faroles colgados.
- Transición de iris de luz.
- Oscuridad suave con degradés y brillo sumado. Los ojos de los bichos brillan en lo oscuro.

**Pixel 16 bits (ZONDA):** botones de 16 bits y oscuridad con trama.

**Pintado con cartelería vial (RUTA 40):**
- Arte pintado de Rezona.
- Colores: verde `#0b6b3d`, azul `#1b4e9b`, marrón `#6a3d21`, amarillo `#f5c400`, rojo `#c8102e`. Letra Overpass.
- PARE para la pausa, patente Mercosur, mojones y rombo amarillo para los avisos. La transición es una polvareda.

**VHS realista (BOSQUE):**
- No es un filtro de color: separa luz y color (YIQ). La luz queda con ~330 puntos por línea; el color, con ~45,
  llega tarde y sangra a la derecha.
- Suma el halo del afilado, temblor de líneas, franja de tracking, cabezal roto abajo y la fecha estampada adentro
  de la imagen.
- Además es mecánica: cerca de una cinta, la imagen falla más (hace de radar).

**Estilos retro (AEROPLAZA, botón 👾):** Pixel 270p, PS1 200p con temblor, tele de tubo, Game Boy 144p, 8 bits
(paleta Sweetie 16) y VHS. Dibujan de verdad a baja resolución, así que además son la calidad más liviana.

### Juego por juego

**AEROPLAZA**: 3D social Frutiger Aero, multijugador, 5 reinos o más. Es el juego vivo más grande.
- **Movimiento:**
  - camina a 3,4 m/s y corre a 7,2; salto 8,6, gravedad 24;
  - aceleración 38 en el piso y 9 en el aire;
  - tiempo de gracia (coyote) 0,12 s y salto guardado (buffer) 0,14 s;
  - doble salto de burbuja al ×0,85.
- **Parkour:**
  - deslizar: 0,72 m de alto; sale a ×1,12 de lo que iba, mínimo 7,6 m/s (8,4 corriendo). Sosteniendo, sigue;
  - rodar, y rueda solo si cae de alto corriendo;
  - trepa bordes a la altura del pecho y salta solo vallas de 0,5 a 1,25 m;
  - sube paredes hasta 3,4 m y corre por la pared;
  - rebote en pared: conserva ×0,92 de lo que traía de costado y suma 6,8 hacia afuera.
- **Animación por poses (estilo R6):**
  - tres estilos: suave, lineal y "chop" (a 12 cuadros, sin suavizado entre poses);
  - camina en 0,8 s y corre en 0,6 s; el ciclo sigue la velocidad real (entre ×0,45 y ×1,5);
  - se inclina en las curvas, se estira al saltar y se aplasta al caer (más cuanto más tiempo estuvo en el aire);
  - quieto 9 s, se estira o mira alrededor.
- **Cámara:**
  - a 5,4 m (de 2,4 a 14) e inclinación 0,3; sigue suave (la posición con 1−e^(−14·dt) y la mirada con
    1−e^(−18·dt));
  - si no la tocás, se acomoda sola detrás al caminar;
  - al correr se ladea, tiembla y abre el campo 7°;
  - nunca se mete en las casas.
- **Primera persona:**
  - ojos a 1,5 m, campo +12°; la cabeza baja en cada pisada y se mece;
  - brazos finos (0,046) dibujados encima de todo;
  - el cuerpo pasa a "solo sombra": mirando abajo se ven las piernas y la sombra entera.
- **Runner Aero.exe:**
  - dura lo que la canción: 904 m a 17 m/s, 52,8 s sin errores contra 63,5 s de canción;
  - gravedad 21 y control en el aire 26; un salto dura 0,82 s y cubre 14 m;
  - los obstáculos no son sólidos: chocar frena y quedan fantasmas 1,3 s;
  - los cubos cambian de carril cada 4 golpes y siempre dejan uno libre; entre paredes, 12 m o más;
  - los glitches siguen la energía de la canción: nada hasta los 16 s, 0,3 en el drop, todo a los 58 s. Al llegar
    al portal vuelve lo Frutiger.
- **Mundo y red:**
  - día y noche por reloj, igual para todos: 5 minutos de cada uno;
  - salas de hasta 14; el estado sale cada 100 ms si cambió, y los demás se interpolan con 1−e^(−12·dt);
  - voz por cercanía: se conecta a menos de 12 m y se corta a más de 18. Con sonido 3D, entero a 2 m y nada a 14.
- **Construir (como Sims Mobile), sin modos:**
  - tocar elige; arrastrar muestra verde o rojo; si se suelta en rojo, vuelve al último lugar válido;
  - una barrita para girar, pintar, copiar, quitar y ✓;
  - un dedo mueve la vista y dos acercan y giran; catálogo por pestañas con miniaturas 3D.
- **Trampas:**
  - un error en un cuadro congelaba todo: pedir el cuadro siguiente primero y dibujar dentro de un `try`;
  - en el celu, arrancar en calidad media;
  - la valla automática lo sacaba por la ventana de la casa.

**BRILLO**: plataformas 2D en pixel Frutiger Aero, 6 mundos con historia. Nick es un muñequito azul de vidrio tipo
MSN, con piernitas.
- **Física** a 60 pasos por segundo, en píxeles por paso:
  - corre 2,45, gravedad 0,3, salto −5,95;
  - soltar el salto lo corta a −2,1; manteniendo, la gravedad baja a ×0,55 en la cima;
  - tiempo de gracia 6 cuadros y salto guardado 6 cuadros.
- **Habilidades y mundos:**
  - la burbuja da el segundo salto y, manteniendo, flota; hay columnas de viento y nado;
  - el "zumbido" sacude lo gris;
  - la Aurora solo se pisa mientras pasa la ola de luz;
  - en el Plano todo arranca gris salvo Nick, y cada sesión devuelve una capa de color y de música.
- **Charlas como cinemáticas:** zoom hasta ×1,55 al medio de los dos, franjas de cine, y se miran.
- **Calidad automática:** baja si no llega a 48 cuadros por segundo, y nunca sube sola.
- **Trampa "va muy lag":** los efectos corrían a la resolución de la pantalla. Se compone a 622×288 y se agranda en
  una sola pasada.

**KUNTUR**: 2.5D de papel tipo Paper Mario, 7 capítulos con historia. Killa lleva un pichón de cóndor al Nevado de
Chañi.
- **Física** en metros:
  - corre a 5,2 m/s, gravedad 32 (×0,55 en la cima), caída máxima 18;
  - salto 12,2 y doble salto 10,2; soltar el salto deja ×0,45;
  - tiempo de gracia 0,1 s y salto guardado 0,13 s; trepa en 0,42 s; en hielo, aceleración 9 y freno 2,5.
- Apu, el cóndor, crece: en las Salinas aletea (doble salto) y en la Puna planea.
- Las apachetas guardan la partida. Hay 15 coplas escondidas.
- **Cinemáticas** con franjas y un gesto por línea de charla; si no hay gesto, el que escucha asiente.
- **Vecinos siempre animados:** saludan si Killa pasa a menos de 3,2 m, y la vicuña huye.
- **Trampas:**
  - al darse vuelta, el papel no gira por el lado corto: si no, queda de canto;
  - el farol pegado quemaba el recorte: intensidad 2,4, a 1,5 m adelante.

**ZONDA**: plataformas de precisión tipo Celeste, 20 salas y 19 cartas. Física en px/s, con baldosas de 8 px:
- corre a 90, gravedad 900, salto −105;
- tiempo de gracia 0,1 s y salto guardado 0,08 s;
- dash de 240 durante 0,15 s, salto de pared y aguante de trepada 110;
- supersalto e hipersalto, y "esquina 4" (¿la corrección de esquina? se deduce del nombre);
- ayudas: velocidad, dash infinito, invencible y reloj.

**LUZ MALA**: metroidvania tipo Silksong, 9 salas y 3 jefes.
- **Física "tacto Hollow Knight":**
  - corre a 104; arranca y frena casi al instante (1900 y 2600);
  - salto −318; soltarlo corta la subida (gravedad 2700, contra 1150 subiendo);
  - tiempo de gracia 0,09 s y salto guardado 0,1 s;
  - rebote hacia abajo sobre bichos (−290) y dash de 0,15 s;
  - invulnerable 1,25 s al recibir un golpe, y un congelado corto al pegar.
- La luciérnaga Chispa: carrera de 6 cuadros; respira, sacude las alas, golpea en 3 tiempos y deja estela.
- Los jefes anuncian sus ataques. La sombra se recupera, como en Hollow Knight.

**RUTA 40**: autos tipo Hill Climb, 7 tramos, 5 vehículos con 5 mejoras de 10 niveles.
- **Física:**
  - 240 pasos por segundo, con interpolación al dibujar;
  - suspensión y fricción con tope, así que las ruedas patinan;
  - el torque levanta la trompa; en el aire, acelerar gira para atrás.
- **Lo que limita es la nafta:** tanque de 26 s, bidones de 220 a 720 m, y la mejora de tanque lo multiplica por 2,2.
- Trucos y combos de 3,5 s; "¡casi!" si la cabeza pasa a menos de 25 cm del piso.
- Picadas de 1200 m contra tres fantasmas.
- Cada tramo sube de a poco (pendientes de 23° a 48°); viento de −2,4 m/s² en la Patagonia y hielo con agarre 0,62.
- Detrás del menú maneja un piloto automático de verdad.
- Motor con voz propia por vehículo, y una chacarera sintetizada que suena como radio.
- **Trampas:** crestas de 3 m de radio como mínimo, y puentes a más de 25 m de las rampas.

**CONTRAGOLPE**: tirador táctico por rondas con bots y 3 mapas. Llegó hecho; el pedido fue que "una batata corra el
full gráficos".
- Armas fundidas por material: de 191 a 127 llamadas de dibujo.
- Pozos y caché en vez de crear todo de nuevo: tenía pérdidas de memoria.
- Todo se precalienta en la carga para que no haya tirones.
- Texturas comprimidas: de 104 a 23 MB.
- Mandos a gusto: tamaño de 0,6 a 1,8, opacidad de 100 a 25 %, zurdo, palanca fija o flotante y vibrar.
- Tiene un "revelado" con tinta y trama en lo oscuro (¿un post-proceso de tinta? no está detallado).

**NEVADA**: cinemática 9:16 de 18,5 s, con un superdeportivo y un tigre blanco en el bosque nevado.
- Los cortes siguen el reloj del audio, así caen en el golpe.
- Arranca con un desglose en arcilla (Voronoi pastel sobre oliva); en el drop, destello y zoom borroso; después
  órbita, rugido y título.
- Nieve: niebla densa de 0,022, y copos de primer plano más tenues cuanto más grandes, apartados del centro.
- El faro quemaba con 6: quedó en 2,4.
- Phonk propio a 120 BPM en fa menor, a −12,7 LUFS.

**BOSQUE**: tercera persona en un bosque al atardecer, en VHS, con cinco cintas.
- **Cámara:**
  - sobre el hombro a 3,7 m, corrida 0,42 a la derecha; ante un choque se acerca al instante y se aleja lento;
  - vuelve sola detrás 1,5 s después del último arrastre;
  - campo fijo en horizontal a 78°, para que en el celu parado no se vea una rodaja;
  - tiembla un poco, como en mano.
- **Controles:** la palanca aparece donde cae el pulgar izquierdo, y a fondo corre. La mitad derecha gira la cámara.
  Cada dedo se sigue por su cuenta.
- Árboles: esqueleto por código y fotos en tarjetas, con contraluz, 3 niveles de detalle y la copa arriba de los 5 m.
- ~420 motas de polvo que brillan de frente al sol. Pasos sintetizados distintos según el suelo.

**CAMPO (el perro)**: un perro 3D sobre lomas de pasto.
- Pasto instanciado en matojos de 3 hojas: 16 por m² en 30 m, y la niebla empieza donde termina el pasto.
- La palanca va relativa a la cámara; con el eje del mundo se invertía al darse vuelta.
- Ladrido sintetizado con 4 partes y 3 formantes, en 3 voces que nunca repiten la anterior.
- Menú: la tarjeta abajo para no tapar al perro, la cámara orbitándolo lento y destellos sin nodos.

**Los chicos:**
- **Pique (2D, pixel y 2.5D):** corredor de un botón.
  - Toque corto, 2,5 baldosas; mantenido, 4,7. Salta vallas solo, y el salto de pared da vuelta la carrera.
  - En vez de vidas, burbujas. 5 monedas de color con 3 niveles.
  - Los niveles se generan con semilla y se validan; el tiempo límite es lo que tarda el camino ×3,2 + 12 s.
- **Enjambre:** supervivencia con un pulgar y disparo automático, 8 especies, 3 jefes y armas que evolucionan. El
  balance salió de 64 partidas simuladas.
- **Ritmo:** 3 carriles y 9 canciones sin archivos.
  - El reloj es el del audio; todo se agenda con 200 ms de anticipo.
  - Calibración con la mediana de 12 toques (el Bluetooth suma 100-300 ms).
- **Espejo:** 40 puzzles de espejos que se voltean.
- **Garfio:** gancho y torre; al soltar salís por la tangente.
- **Paraguas:** mantener lo cierra y caés rápido (13,5 contra 4,3); el ancho es la caja de choque. Tarda 9 cuadros
  en cerrarse, así que un toquecito sirve para apuntar.
- **Dimensión Ñ:** ragdolls de verdad (Verlet, 11 puntos), con las piezas cortadas de un solo dibujo.
- **Telaraña:** colgarse por una ciudad, 28 orbes en 2 min.
- **Pozo:** llegó hecho; se mejoraron el audio y el menú.

### Lo que rechazó o corrigió (no repetirlo)

- **KUNTUR:** rechazó el low-poly ("no me convence el modelo 3D") y los vóxeles; preguntó "¿no puede ser como un
  Paper Mario?" y quedó en papel.
- **AEROPLAZA:** rechazó el R6 de Roblox de verdad ("esa r6 no es la que quiero") → poses hechas a mano, copiadas de
  su video, en estilo cartoon.
  - **Ojo en Roblox:** si usás R6 o R15, que no quede "el de siempre": animaciones y proporciones propias.
- **"Va muy lag" (BRILLO)** → menos resolución, cámara más cerca ("más pocket") y calidad automática.
- **"No me deja jugar" (AEROPLAZA)** → arranque blindado, cartel de error, calidad media en el celu, "cargando" a la
  vista, ▶ Jugar grande y tutorial de 5 pasos.
- **Carteles grandes y textos que molestan** → avisos chicos arriba, estilo Windows 7, de a uno (el repetido suma
  ×2) y sin spam. Las misiones van detrás de un botón. En el parkour no queda nada que tape.
- **"Mundo, no isla"**: caminos sin obstáculos y nada que se atraviese. Se revisa en todos los lugares.
- **Modelos GLB** → "los quiero procedural": se arman en código, copiando las referencias.
  - En Roblox: construir con piezas y `Union`/`MeshPart` por script antes que bajar modelos.
- **Deslizar exigía correr** → se desliza siempre, y sosteniendo sigue.
- **Los brazos en primera persona** → más bajos y más finos.
- **El probador tapaba al muñeco** → se centra en el espacio libre del panel.
- **Construir "incómodo"** → como Sims Mobile, sin modos.
- **Las gotas:** "pup, no tiring".
- **Música:** solo sus canciones. En AEROPLAZA, nada de temas de Rezona ni sintetizados. No se hicieron covers de
  temas con derechos (Wii Shop, Vista).
- **Tráiler:** frenó uno horizontal: "solo quería uno en 9:16".
- **Memes:** "DE GOOGLE… no los generes".
- **Nubes** con borde rosa y recortes → nubes de shader. En Roblox: `Clouds` en `Terrain`, más `Atmosphere`.
- **En el celu arrancaba con teclas** → con pantalla táctil se arranca con los dedos.
- **Manos en VR:** "lentoooo", "ese maldito retraso", "optimizalo un 700 %" → quiere respuesta inmediata y estable.

### Trucos que siempre suman (lista para revisar cada juego)

- [ ] Pantalla de idioma (es/en/pt) antes del menú, y ningún texto sin traducir.
- [ ] **Menú vivo:** algo pasa detrás (un piloto automático, la cámara orbitando, parallax). Estilo y transición
  propios: burbujas, iris de luz, polvareda, telón.
- [ ] **Salto:** tiempo de gracia (0,09-0,12 s), salto guardado (0,08-0,14 s), corte al soltar, gravedad más
  liviana en la cima y caída más pesada.
- [ ] **Aplastar y estirar:** estira al saltar, aplasta al caer según el tiempo en el aire, se inclina en las
  curvas. Quieto, hace algo.
- [ ] **Golpes:** congelado corto al pegar, invulnerabilidad visible después del golpe, sacudida de cámara, y
  campo +7-12° al correr o ir rápido.
- [ ] **Cámara:**
  - se acomoda sola detrás;
  - ante una pared se acerca al instante y se aleja lento, sin meterse;
  - campo fijo en horizontal.
- [ ] **Controles de dedo:** la palanca aparece donde cae el pulgar y va relativa a la cámara. Editor de botones
  con todo lo de la sección 1.
- [ ] **Charlas y vecinos:** las charlas son cinemáticas (zoom, franjas, se miran, gestos); los vecinos siempre
  hacen algo y saludan de cerca.
- [ ] **Todo se mueve:** árboles que se doblan desde la base (k = (altura/alto)²) con ráfagas, polvo, agua, nubes.
- [ ] **Luz:** el sol manda, niebla del color del horizonte, bloom con umbral alto, velo claro en lo Aero.
- [ ] **Un post-proceso con identidad**, y hasta estilos retro para elegir.
- [ ] **Sonido:** música por zona o mundo, efectos con tono variado ±10 %, reverb para lo lejano, y pasos según el
  suelo, a tiempo con el pie.
- [ ] **Recompensas que suenan:** la escala sube en cadena, festejo con chispas y un salto al comprar.
- [ ] **Calidad automática:** arranca según el aparato, mide la mediana de los cuadros, baja rápido y sube
  despacio. El nivel mínimo va sin sombras ni post-proceso.
  - En Roblox la calidad la elige el jugador, pero se puede aliviar con menos partículas y efectos si
    `workspace:GetRealPhysicsFPS()` o los cuadros bajan.
- [ ] **Instanciar y fundir lo repetido.** Detalle por distancia; flores y pasto solo de cerca. Precargar en la
  carga (`ContentProvider:PreloadAsync`) para que no haya tirones.
- [ ] **Niveles comprobados** por un bot o resolvedor con la misma física; en un runner, largo medido contra la
  canción.
- [ ] **Interfaz:** un aviso a la vez, pocos botones afuera, menús sin desplazar, probado con el celu acostado y
  parado.
- [ ] **Si un asset falla, hay reemplazo** (dibujado o sintetizado) y el juego no se traba.

## 10. Lo próximo

- Preguntale **qué juego** hacemos (obby, tycoon, simulador, pelea u otro) y arrancá: primero el mapa y el menú de
  idioma, después la jugabilidad y los controles de dedo, al final pulir y probar en el emulador del celu.
- Mostrá avances con capturas si hay cómo; si no, contá en corto qué se ve y qué probar.
