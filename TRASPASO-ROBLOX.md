# Traspaso: hacer juegos de Roblox desde la PC (29/09/2026)

Para la sesión de Claude Code que corre en la PC con Roblox Studio y se maneja desde el celu con Remote
Control. Lo escribió la sesión anterior, que corría en la nube y no podía llegar a Studio. Leelo entero una vez;
después usalo de consulta.

## 1. Quién pide y cómo hablarle

- **Castellano rioplatense, corto e informal.** Escribe corto ("che", "xd", "dale"); contestale igual.
- No sabemos sus pronombres: no le asignes género.
- **Escribe desde el celu** y manda fotos de la pantalla de la PC. Los comandos van **exactos y listos para
  copiar**, de a un bloque, diciendo en qué ventana van. Si algo falla, pedí foto del error.
- **Quiere que se haga todo de una**, sin vueltas ni preguntas de más. Si hay que elegir, recomendá una opción y
  seguí.
- **Pide exactamente lo que quiere.** Si pide un `.md`, es un `.md` y nada más.
- **Calidad alta**: "goty", "AAA". Cada juego nuevo tiene que superar claramente al anterior, sin copiarlo.
- **Sus reglas para todo juego** (vienen de sus juegos web y valen acá):
  - Antes del menú se elige idioma: **español, inglés o portugués**, con todo traducido.
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

## 7. Lo que hay en su repo (por si pregunta)

- `Juniorspro/New-General-Games-Assets` (público): sus juegos web (AEROPLAZA, BRILLO, KUNTUR, RUTA 40 y más) y la
  memoria de las sesiones en `memoria/`. Se arranca por `memoria/INDICE.md`.
- **AEROPLAZA** es el grande: un mundo 3D social en three.js, con APK para Android que se actualiza sola, VR y
  un celu con amigos. En la vuelta 49 se rehízo "construir la casa" al estilo Sims Mobile.
- Tiene Rezona y Higgsfield para generar imágenes, audio y modelos. Prefiere Rezona. En la PC no están
  conectados salvo que los agregue.

## 8. Lo próximo

- Preguntale **qué juego** hacemos (obby, tycoon, simulador, pelea u otro) y arrancá: primero el mapa y el menú de
  idioma, después la jugabilidad y los controles de dedo, al final pulir y probar en el emulador del celu.
- Mostrá avances con capturas si hay cómo; si no, contá en corto qué se ve y qué probar.
