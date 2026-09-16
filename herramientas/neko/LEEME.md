# Manejar una PC virtual Neko desde acá

[Neko](https://neko.m1k1o.net/) es un escritorio Linux dentro de Docker que se
mira por WebRTC en el navegador. `neko.py` lo maneja **sin WebRTC**: la pantalla
se pide como JPG por REST y los clics y las teclas se mandan por WebSocket.

## Lo que se midió (no lo que dice el manual)

| Cosa | Estado |
|---|---|
| `https://neko.m1k1o.net/` | Es **solo la documentación**, no una instancia. Título `season_change`. |
| Chromium de este contenedor → internet | **Falla**: `page.goto: net::ERR_CONNECTION_RESET` |
| `curl` → internet | **Anda** (`neko.m1k1o.net` HTTP 200, 132 792 bytes) |
| `wss://` a través del proxy del agente | **Anda** (probado contra `ws.postman-echo.com` y `echo.websocket.org`) |
| Neko real corriendo acá en Docker | **Anda**: `ghcr.io/m1k1o/neko/xfce`, `--network host`, healthy |
| Ver la pantalla, mover, clic, doble clic, arrastrar, rueda, tipear, combos | **Verificado contra ese Neko real** |
| Mouse por REST | **No existe**. `/api/room/...` tiene teclado, control, portapapeles y captura; los eventos `control/move`, `control/buttondown/up` y `control/scroll` van **solo** por `/api/ws`. |

## Configuración

Credenciales solo por variables de entorno, nunca en un archivo del repo:

```sh
export NEKO_URL=https://mi-neko.ejemplo.com
export NEKO_USER=admin
export NEKO_PASS='...'          # o NEKO_TOKEN si ya hay uno emitido
```

Si la instancia es local, sacar el proxy del medio:
`export no_proxy=127.0.0.1,localhost`.

## Uso

```sh
python3 neko.py estado                    # quién soy, tamaño de pantalla, quién tiene el control
python3 neko.py ver pantalla.jpg          # captura (REST, /api/room/screen/shot.jpg)
python3 neko.py tomar                     # tomar el control (hace falta para el mouse y el portapapeles)
python3 neko.py hacer '[{"clic":[640,400]},{"escribir":"hola"},{"tecla":"Return"}]'
```

`hacer` abre **una sola** conexión y ejecuta las acciones en orden:

| Acción | Qué hace |
|---|---|
| `{"mover":[x,y]}` | mover el puntero |
| `{"clic":[x,y]}` / `{"doble":[x,y]}` | clic / doble clic (`"boton"`: 1 izq, 2 medio, 3 der) |
| `{"apretar":[x,y]}` … `{"largar":[x,y]}` | arrastrar |
| `{"rueda":[dx,dy]}` | scroll |
| `{"escribir":"texto"}` | tipear (~14 caracteres por segundo) |
| `{"pegar":"texto"}` | por portapapeles: instantáneo y con todo el Unicode |
| `{"tecla":"Return"}` | una tecla con nombre X11 |
| `{"combo":["Control_L","c"]}` | varias juntas |
| `{"esperar":0.5}` / `{"ver":"paso.jpg"}` | pausa / captura en el medio de la secuencia |

## Trampas encontradas

1. **Las mayúsculas necesitan Shift a mano.** Neko resuelve el keysym contra el
   estado vivo de modificadores (`XkbKeysymToKeycode`), así que el keysym `J`
   suelto cae en la tecla minúscula: medido, salió `j`. `neko.py` mantiene
   `Shift_L` apretado en cualquier mayúscula — incluida `Ñ`, que no es A-Z y por
   eso se escapó del primer arreglo (salió `ñandú` en lugar de `ÑANDÚ`).
   Los símbolos (`@#$%`) salen bien con Shift o sin él.
2. **El portapapeles y el mouse piden ser host**: sin `tomar` primero, la
   lectura del portapapeles da `403 session is not host`.
3. **`control/paste` manda Ctrl+V.** Sirve en campos de texto y navegadores; una
   terminal lo ignora. Ahí hay que pasar el atajo real:
   `{"pegar":"...","atajo":["Control_L","Shift_L","v"]}` (verificado en
   xfce4-terminal).
4. **`XkbAddKeyKeysym` y el rebote**: `KeyDown` del mismo keysym dos veces
   seguidas sin `KeyUp` se descarta del lado del servidor. Siempre en pares.
5. **El `Origin` se valida** en el upgrade del WebSocket, así que se manda igual
   a la URL base.

## Levantar un Neko de prueba en este mismo contenedor

`dockerd` arranca acá (sin bridge ni iptables), así que con `--network host`
alcanza:

```sh
rm -f /var/run/docker.pid
setsid nohup dockerd --iptables=false --bridge=none > /tmp/dockerd.log 2>&1 &
docker run -d --name neko-prueba --network host --shm-size=2g --cap-add SYS_ADMIN \
  -e NEKO_DESKTOP_SCREEN=1280x720@30 \
  -e NEKO_MEMBER_PROVIDER=multiuser \
  -e NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD="$CLAVE" \
  -e NEKO_MEMBER_MULTIUSER_USER_PASSWORD="$CLAVE" \
  -e NEKO_WEBRTC_EPR=52000-52010 -e NEKO_WEBRTC_NAT1TO1=127.0.0.1 \
  -e NEKO_SERVER_BIND=127.0.0.1:8080 \
  ghcr.io/m1k1o/neko/xfce:latest
```

La imagen pesa ~1,3 GB y el escritorio queda en `http://127.0.0.1:8080`.

## Instalar cosas adentro (Wine + una app de Windows)

Probado: Wine 10.0 de Debian trixie + WinRAR 7.23 en español, instalado y usado
manejando el escritorio con `neko.py`.

El contenedor comparte la red del host, así que sale por el proxy del agente —
pero **el proxy solo hace CONNECT (HTTPS)**. Por HTTP plano devuelve
`405 Method Not Allowed`, y ahí `apt-get update` falla con *"repository is not
signed"*, que despista porque parece un problema de firmas y es de transporte.
Hay que pasar las fuentes a `https://` y configurar **solo** el proxy https:

```sh
docker cp /root/.ccr/ca-bundle.crt neko-prueba:/usr/local/share/ca-certificates/agente-proxy.crt
docker exec neko-prueba update-ca-certificates
docker exec neko-prueba bash -lc "
  sed -i 's|URIs: http://|URIs: https://|' /etc/apt/sources.list.d/debian.sources
  printf 'Acquire::https::Proxy \"%s\";\n' '$HTTPS_PROXY' > /etc/apt/apt.conf.d/01proxy
  apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends wine"
```

Después, el prefijo de Wine se arma sin que salte el diálogo de Mono/Gecko:

```sh
docker exec -u neko -e DISPLAY=:99.0 -e WINEDLLOVERRIDES="mscoree,mshtml=" \
  neko-prueba wineboot -u
```

Los `err:setupapi` y el `winebth` que falla son ruido, el prefijo queda bien.

El `.exe` se baja en el host (donde `curl` sale) y se copia con `docker cp`; el
contenedor no necesita bajar nada. La imagen de Debian trixie viene solo amd64,
así que una app de 32 bits pediría `dpkg --add-architecture i386` y
`wine32:i386`; WinRAR x64 no lo necesita.

## Números medidos

Contenedor de la sesión: 4 vCPU (Xeon @ 2,80 GHz), 15 GiB de RAM, ~19 GiB de
disco libre, sin GPU (`/dev/dri` no existe: todo el render es por software).
El Neko no tiene límites propios, así que ve los mismos 4 vCPU y 15 GiB.
Idle consume ~190 MiB de RAM y 0,15 % de CPU.

| | |
|---|---|
| Pantalla por defecto | 1280x720 @ 30 |
| Resoluciones ofrecidas | 30, hasta 3840x2160 (probado 1920x1080 y 2560x1440) |
| Captura 1280x720 q90 | 161 ms · 33 KB |
| Captura 1280x720 q50 | 49 ms · 24 KB |
| Captura 1920x1080 q90 | 189 ms · 52 KB |
| Captura 2560x1440 q90 | 280 ms · 78 KB |
| Ciclo completo (login + ws + clic + captura) | ~1,4 s |
| Tipear | ~12 caracteres por segundo |
| Pegar por portapapeles | instantáneo, sin importar el largo |

**El cierre del WebSocket costaba 5 s de cada corrida.** Neko no contesta el
handshake de cierre, así que `websockets` quemaba el `close_timeout` entero al
salir: el ciclo medía 6,1 s y solo 120 ms eran trabajo real. Con
`close_timeout=.3` bajó a 1,4 s.

## Lo que no hay

- **Sin GPU**: nada de aceleración 3D. Wine con juegos o CAD no va.
- **Sin navegador** en la imagen xfce (el globito de la barra es un lanzador
  vacío); hay que `apt-get install firefox-esr`.
- **La imagen es solo amd64**: una app de Windows de 32 bits pide
  `dpkg --add-architecture i386` y `wine32:i386`.
- **Nadie más puede ver este escritorio.** Escucha en `127.0.0.1:8080` adentro
  del contenedor de la sesión, sin puerto publicado hacia afuera.
- **Es efímero.** Si `dockerd` se cae, el contenedor se va con él y hay que
  `docker start neko-prueba` (el disco del contenedor sobrevive: Wine y WinRAR
  siguieron instalados, pero las ventanas abiertas se pierden). Y el contenedor
  de la sesión entero se recicla al rato de quedar inactivo.

## 3D: sí, y hasta dónde

Sin GPU, pero Mesa trae **llvmpipe**, que es un rasterizador por software sobre
los 4 núcleos. No es "3D de mentira": es OpenGL 4.5 core con shaders completos.

```sh
docker exec neko-prueba apt-get install -y --no-install-recommends \
  mesa-utils libgl1-mesa-dri glmark2 firefox-esr
docker exec -u neko -e DISPLAY=:99.0 -e LP_NUM_THREADS=4 neko-prueba \
  glmark2 --off-screen --size 800x600
```

| | |
|---|---|
| Renderer | llvmpipe (LLVM 19.1.7, 256 bits), Mesa 25.0.7 |
| OpenGL | 4.5 core / 4.5 compat / ES 3.2, GLSL 4.50 |
| **glmark2 (800x600, 4 hilos)** | **546** |
| jellyfish (texturas + translúcido) | 172 FPS |
| shadow | 254 FPS |
| refract | 25 FPS |
| terrain (el que llena pantalla) | 10 FPS |

O sea: la geometría y los shaders vuelan, lo que duele es el **relleno de
píxeles**. Escenas que pintan toda la pantalla varias veces se arrastran;
todo lo demás anda bien.

### WebGL en Firefox

Anda, WebGL 2.0, renderer `llvmpipe, or similar`, `MAX_TEXTURE_SIZE 16384`.
Medido sobre la página Frutiger Aero real (modelo riggeado, animaciones,
Liquid Glass):

| | |
|---|---|
| 1280x720 | **58,4 FPS** |
| 1920x1080 | **40,4 FPS** |

### Las tres trampas de Firefox acá

1. **No lee `/etc/firefox/policies/`**: el paquete `firefox-esr` de Debian
   quiere `/etc/firefox-esr/policies/policies.json` o
   `/usr/lib/firefox-esr/distribution/policies.json`. Copiarlo a los tres.
2. **No confía en el CA del proxy** aunque esté en el almacén del sistema:
   usa NSS. Se agrega con
   `certutil -A -n agente-proxy -t 'C,,' -i <crt> -d sql:<perfil>`
   (paquete `libnss3-tools`).
3. **Y aun así no sale a internet.** El proxy recibe el CONNECT y abre el
   túnel, pero se corta a los 6 s: *"663 B sent, 39 B received"*, con
   cualquier host. `curl` por el mismo proxy contesta 200 en 0,33 s. Probé
   apagar ECH, DoH, HTTP/3 y 0-RTT y no cambió. Sin resolver: **para probar
   una página, servirla local** (`python3 -m http.server`, que el contenedor
   ve por `127.0.0.1` gracias a `--network host`) y sacar `127.0.0.1` del
   proxy con `network.proxy.no_proxies_on`.

### Detalles

- Firefox loguea `[GFX1-]: glxtest: libpci missing` — es ruido, no rompe nada.
- `glmark2 --off-screen` no necesita ventana; con ventana los números dan
  igual (terrain 10 FPS, jellyfish 172 a 900x600).
- Para pegar en la consola de Firefox hace falta escribir "allow pasting" la
  primera vez; tipear el snippet con `escribir` lo evita.
