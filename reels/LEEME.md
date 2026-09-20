# Reels — video escrito en codigo (Remotion)

Cada video es un componente de React: la linea de tiempo son numeros, no
arrastrar cajitas con el mouse. Por eso yo puedo editar acá y en CapCut no.

```sh
cd reels
npm install
npx remotion studio        # la interfaz, con previsualizacion
npx remotion render CaptionedVideo out/video.mp4 --concurrency=4
```

Plantilla base: `--tiktok` de `create-video`, que es la de subtitulos estilo
TikTok (palabra por palabra, resaltada la que suena). Composicion
`CaptionedVideo`, **1080x1920 a 30 fps**.

## Las dos trampas de hacerlo andar acá

Las dos cuestan un rato si no se saben, y las dos dan errores que no apuntan
a la causa.

1. **Remotion necesita el `chrome-headless-shell`, no un Chrome normal.** Si se
   lo apunta al Chromium de Playwright
   (`--browser-executable=.../chrome-linux/chrome`) muere con *"Old Headless
   mode has been removed from the Chrome binary"*. Se arregla dejando que se
   baje el suyo, que son 92 MB y queda en `node_modules/.remotion/`:

   ```sh
   npx remotion browser ensure
   ```

2. **El Chromium de Playwright no trae H.264.** Apuntandolo al
   `headless_shell` de Playwright si arranca, pero al leer un `.mp4` tira
   `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`, que parece un archivo roto y es la
   compilacion sin codecs propietarios. El navegador que baja Remotion si los
   trae. Si por lo que sea hubiera que usar el de Playwright, el camino es
   pasar el material a VP9/WebM antes.

Medido: 358 cuadros a 1080x1920, renderizados y codificados sin GPU, con
`--concurrency=4`.

## Material

`public/` va **sin los `.mp4`** (estan en el `.gitignore`): el repo es publico y
no tiene sentido cargarlo de video. La tipografia si va, con su licencia.

## Que se puede hacer que en CapCut no

- Repetir un edit con otro material cambiando una variable.
- Armar 20 versiones de un mismo reel para probar cual funciona.
- Que los datos manden el video: un numero del juego, un texto, una lista.
- Que el resultado sea **el mismo** cada vez que se corre.
