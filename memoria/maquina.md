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
- docker: está el binario; `dockerd` se arranca a mano.

## La red (sale por un proxy)

- `curl` llega a internet. **Chromium no:** sin proxy no sale, y con el proxy no
  confía en su certificado (`ERR_CERT_AUTHORITY_INVALID`). Las pruebas van
  contra `localhost` o `file://`; producción se verifica con `curl`.
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
