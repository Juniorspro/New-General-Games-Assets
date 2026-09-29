# Nexo XR y Nexo Web
Fuente: `nexo-xr/README.md`. Ver también: [maquina](maquina.md).

## Estado (29/09/2026)
- App publicada: 1.5 (versionCode 6). El teléfono se actualiza solo desde `nexo-xr/actualizacion/version.json`. → `nexo-xr/README.md § Actualizaciones`
- Publicar: `cd nexo-xr && ./publicar.sh "notas"` (sube la versión solo; se niega con otra llave). La llave: `NEXO_LLAVE` o `~/.cache` (nunca al repo).
- Nexo Web: `nexo-xr/web/index.html`, un solo archivo; link `https://raw.githack.com/Juniorspro/New-General-Games-Assets/claude/hola-80z86i/nexo-xr/web/index.html`.
- El usuario dijo que el hand tracking web "va para el culo" (28/09); se mejoró (29/09, commit af11521) y se le pidió una captura de la app Cámara. Sin respuesta todavía.

## Pruebas
- App: `./pruebas/correr.sh` (168 ✓), `./pruebas/vista.sh`, `node pruebas/shaders.mjs`. Web: `node pruebas/web.mjs`.
- Nada se probó en un teléfono: ni la app ni la web.

## Trampas pagadas
- El pellizco medido sobre puntos suavizados no llega al umbral: medirlo con los crudos. → `web/index.html § class Mano`
- MediaPipe 3D solo da pellizcos falsos (puño 0.27); usar max(3D, 2D×0.8). → `web/index.html § class Gestos`
- La etiqueta izquierda/derecha de MediaPipe se da vuelta con la cámara de atrás: asignar por posición.
- ARCore no hace hand tracking: MediaPipe sobre la imagen de ARCore.
- Auto-mode bloqueó un servidor tipo Shizuku para abrir apps adentro de Nexo ("RCE surface"): no retomarlo sin pedido explícito.
