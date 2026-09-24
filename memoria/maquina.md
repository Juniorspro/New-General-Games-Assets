# La máquina

Un contenedor en la nube: arranca con el repo clonado y se borra al terminar.
Fuente: `ARRANQUE.md § 1` y `§ 7`. Ver también: [desplegar](desplegar.md),
[juegos](juegos.md).

## Lo que muerde

- Lo que no se commitea se pierde: `/tmp`, paquetes instalados, bases locales.
  La memoria propia de Claude en `~/.claude` también se borra: por eso esta
  vive en el repo.
- El disco es una cuota fija y `df` miente: "Avail" en 0 con poco "Used" es
  cuota gastada. Borrar libera al instante. El 22/09 había 29 GB libres.
- No hay SDK de Android: acá no se compila un APK.
- `npx wrangler` se reinstala en cada sesión y tarda 1-2 min la primera vez.
- `pkill -f "pages dev"` sale con 144: correlo solo, nunca con `&&` detrás.
- No hay `gh`: GitHub se usa por el MCP (`mcp__github__*`).

## Lo instalado

- Node 22 y npm 10.
- Python 3. `ARRANQUE` dice que Pillow no viene, pero el 22/09 estaba (12.3,
  con webp). Probá `python3 -c "import PIL"` antes de instalar.
- Chromium de Playwright en `/opt/pw-browsers/chromium`. El módulo está en
  `/opt/node22/lib/node_modules/playwright` y se carga con `createRequire`.
  **Nunca `npx playwright install`.**
- docker: está el binario; `dockerd` se arranca a mano. El 23/09 el modo
  automático **bloqueó el `docker pull` de la imagen de Neko**: hace falta que
  la persona lo habilite en sus permisos.
- ffmpeg no viene. `apt-get update && apt-get install -y --no-install-recommends
  ffmpeg` anda directo (6.1.1, con `gblur`, `loudnorm` y `libx264`). El que
  trae Remotion (`@remotion/compositor-linux-x64-gnu`) está recortado.
- Remotion 4.0.527 se instaló en `brillo/trailer/remotion`, porque lo pidió
  ("usá Remotion o instalá un editor de verdad"). Detalles:
  [brillo-trailer](brillo-trailer.md).
- Los videos relatados (`videos/remotion`) usan ese mismo Remotion:
  `node_modules` es un enlace a `brillo/trailer/remotion/node_modules` (no se
  commitea). Ver [videos](videos.md).
- Vosk (24/09, para los tiempos de los subtítulos): `pip install --no-deps
  vosk`, porque la rueda de `srt` no compila. `srt.py` se copió a mano a
  `/usr/local/lib/python3.11/dist-packages/`. El modelo chico en castellano
  (`vosk-model-small-es-0.42`) va en el scratchpad y no en el repo.
- **Para mandarle un archivo por el chat, el límite es 30 MiB.** El tráiler
  (66 MB) salió en una copia de 27,5 MiB: x264 en dos pasadas a 3,8 Mbps.
- H.264 no se puede ver en el Chromium de Playwright (no trae el códec). Los MP4
  se revisan con `ffprobe` y cuadros sueltos de `ffmpeg`.

## La red (sale por un proxy)

- `curl` llega a internet. **Chromium solo no:** sin proxy no sale, y con el
  proxy no confía en su certificado (`ERR_CERT_AUTHORITY_INVALID`). Las pruebas
  van contra `localhost` o `file://`; producción se verifica con `curl`.
- Si hace falta una página de afuera en Chromium (24/09):
  - `launch({ proxy: { server: process.env.HTTPS_PROXY } })`;
  - `ctx.route('**/*', r => r.fetch().then(x => r.fulfill({ response: x })))`.
  Así pide Node, que sí confía en el CA (`NODE_EXTRA_CA_CERTS`), y TLS se
  sigue verificando.
- Google contesta con captcha: no se saltea. Bing Imágenes no da resultados.
- Para una captura con Google Fonts: se bajan el CSS y los woff2 con `curl` y se
  incrustan en la copia local.
- El `https` de Node no usa el proxy por su cuenta. Un `postinstall` que baja
  binarios falla con `ECONNRESET` (le pasó a onnxruntime-node; se saltea con
  `ONNXRUNTIME_NODE_INSTALL=skip`).
- El registro de npm y PyPI van directo; Hugging Face contesta.
- Nunca desactivar TLS ni sacar `HTTPS_PROXY`. Diagnóstico: `/root/.ccr/README.md`.

## Probar con navegador

- Sin placa de video, con SwiftShader: `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Dibuja ~1,5 s por
  cuadro a 640x360: los FPS de acá no dicen nada de un teléfono.
- En juegos, esperá tiempo de juego y no de reloj. Un `?fijo` apaga la
  resolución que se adapta, y `renderer.info.autoReset = false` mide todas las
  pasadas.
- Dos dedos a la vez: `Input.dispatchTouchEvent` por CDP.
- Que un elemento exista no quiere decir que se pueda tocar: comprobalo con
  `document.elementFromPoint(x, y)`. No calcules coordenadas: usá
  `locator.hover()`.
- Cada prueba arma su propio dato. Un resultado raro suele ser la prueba y no el
  código.
- Ejemplos listos: `bosque/pruebas/ver.mjs` (capturas desde lugares fijos),
  `cintas.mjs` (la partida entera) y `un-archivo.mjs` (el HTML único por
  `file://`). Frutiger Aero: [sitios](sitios.md).
