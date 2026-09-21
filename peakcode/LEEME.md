# PeakCode — app Android sobre OmniRoute

Cliente de chat para Android que habla con un **endpoint compatible con
OpenAI**. Nació apuntando a [OmniRoute](https://github.com/diegosouzapw/OmniRoute),
pero sirve contra cualquier endpoint de ese tipo.

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
