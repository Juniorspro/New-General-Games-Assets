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
