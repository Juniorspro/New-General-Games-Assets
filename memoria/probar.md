# Probar juegos en este contenedor
Fuente: `guias/GUIA_JUEGOS_2D_PIXEL.md § 12`, `guias/GUIA-JUEGOS.md § 9`, y lo medido el 29/09/2026 con aeroplaza. Ver también: [juegos](juegos.md), [aeroplaza](aeroplaza.md).

## Lo que hay instalado (comprobado el 29/09/2026)
- Node 22 con `playwright` 1.56.1 global: `require('/opt/node22/lib/node_modules/playwright')`; Chromium 1194 en `/opt/pw-browsers`. Nunca `npx playwright install`.
- También global: `prettier`, `eslint`, `http-server`, `serve`. NO hay Pillow ni esbuild.
- npm y pip llegan a la red: `npm install esbuild` y `pip install --target <scratchpad>/py pillow` (después `PYTHONPATH=<scratchpad>/py`).

## Chromium sin placa de video
- Flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Dibuja por procesador: aeroplaza hizo 22-46 cuadros en 8 s a 892×412. Los cuadros por segundo de acá no dicen nada de un teléfono y no se informan como si dijeran. → `GUIA-JUEGOS.md § 9`
- Sí valen: errores de consola, triángulos y llamadas (`renderer.info`, con `autoReset = false` si hay post), capturas.
- Trampa: desde la página, todo pedido HTTPS falla con `ERR_CERT_AUTHORITY_INVALID` (Chromium no confía en el CA del proxy). Para probar "sin red" a propósito: `page.route(/^https?:/, r => r.abort())`.

## Esperar tiempo de juego, no de reloj
- Si el juego se puede pausar y expone su paso, avanzarlo a mano: aeroplaza con `?pausa` y `window.__A.paso(1/60)` N veces. Así se midieron caminar 3,34 m/s y correr 6,89 m/s.
- Si no, contar cuadros reales envolviendo `requestAnimationFrame` con `addInitScript` y esperar a que avancen.
- Un parámetro para entrar directo a la escena ahorra los menús (aeroplaza: `?directo&idioma=es&reino=plaza`).

## Tocar como un dedo
- Toques reales por CDP (`Input.dispatchTouchEvent` con varios `touchPoints`); los eventos sintéticos no traen `changedTouches`. → 2D § 12
- Para "tocá la pantalla para seguir": `page.touchscreen.tap(x, y)` con `hasTouch: true`.
- Teléfono parado 412×892 y acostado 892×412 (`isMobile: true`, `deviceScaleFactor: 1` para que no tarde).
- El bot que aprieta teclas tiene que soltarlas: sin flanco, el salto nunca sale. → 2D § 12

## Mirar
- Muchas capturas se miran juntas en una hoja de contacto (Pillow) y una sola vez.
- En animaciones, capturar el cuadro pico. → 2D § 3.4
- Un resultado raro suele ser la prueba y no el código; una sonda que escribe lo que mide aprueba cualquier cosa. → 3D § 9, 2D § 12
- Rendimiento: 200 cuadros de calentamiento + 300 de medición, contra el commit anterior en el mismo banco (`git show HEAD:archivo`). → 2D § 11
