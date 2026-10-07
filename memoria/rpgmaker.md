# Ports web de juegos de RPG Maker MV — lo que enseñó (07/10/2026)
Port personal de "Geometry Dash: Nexitron" 1.3.4 (fangame gratis de GRIMKITTY, RPG Maker MV 1.6.1), pedido para jugar en el navegador del celu. **El juego no está en el repo**: es de su autor y se entregó solo a él. Ver también: [clickteam](clickteam.md), [probar](probar.md).

## Cuándo sí y cuándo no
- Sí: un fangame gratis que reparte su propio autor, para uso personal (es pasar a otro formato el juego que ya baja gratis). No: el juego comercial ni un fangame hecho con los archivos del original. → ver INDICE, "Quién pide".
- Si trae algún archivo ajeno que no usa (los 16 `PlayerExplosion_*-uhd` de GD, 34 MB, que no nombra ningún dato ni complemento), se saca.

## Lo que es RPG Maker MV por dentro
- El build de Windows es NW.js con una carpeta `www/`: `index.html`, `js/` (pixi, rpg_*.js, `plugins.js` y `plugins/`), `data/*.json`, `img/`, `audio/` (ogg), `movies/` (webm). Ya es web: lo que falta es servirle los archivos.
- En el celu (`Utils.isMobileDevice()`) pide los audios como `.m4a` y los videos como `.mp4`; en la compu, `.ogg` y `.webm`. Al sistema de archivos virtual se le dan los dos nombres para el mismo archivo.
- Complementos con cosas de NW.js: casi todos van protegidos con `Utils.isNwjs()`. `SRD_GameUpgrade` lee `process.versions` sin proteger y se rompe en el navegador; se emparcha esa línea.
- `TDDP_PixelPerfect` no deja que la pantalla baje de 1× y `YEP_CoreEngine` redondea la escala. En un celu la pantalla de 1280×720 quedaba recortada: se agrega un tope para que la escala nunca supere lo que entra en la ventana.
- Las teclas de prueba tienen que quedar apretadas ~150 ms (QInput mira el estado en su ciclo): un `keyboard.press` de Playwright no lo registra.
- Chromium sin pantalla se cuelga si se saca una captura mientras pasa un video: se espera a que termine.

## Achicar y empaquetar (291 MB → 95 MB)
- Imágenes PNG → WebP (con pérdida q85 las pintadas, sin pérdida tilesets, personajes y sistema), música → Opus 48 kbps (los `bgs` con LOOPSTART quedan en Vorbis), videos → VP9 a 854 px y 30 cuadros. Con 4 núcleos tardó 4 min 19 s.
- Un solo HTML quedó de 127 MB, y el chat no entrega archivos de más de 30 MiB. Por eso va en partes:
  - un HTML de 18,5 MB con el código, los datos y las tipografías;
  - 4 paquetes `.nexi` (cabecera `NEXIPACK` + largo + índice JSON + bytes).
- El HTML pide los paquetes con un `<input type=file multiple>` y usa rebanadas del archivo (`File.slice`, sin copiar a memoria). Los guarda en IndexedDB, y en Chromium la segunda vez arranca solo (sin comprobar en un celu de verdad).
- Pasar todos los base64 a Blob al abrir tardaba 10 s en la compu: mejor pasar cada uno cuando el juego lo pide.
- Sistema de archivos virtual: se emparchan `XMLHttpRequest.open` y el `src` de `<img>`, `<video>`/`<audio>` y `<source>`. `PluginManager.loadScript` se cambia por un script con `src` blob, pero su propiedad `src` sigue devolviendo la ruta original, porque hay complementos que usan `document.currentScript.src`. Las rutas no distinguen mayúsculas (en Windows no las distinguen).
- Medido en Chromium: elige los archivos y llega al título en ~28 s (el aviso y los logos del juego duran ~27 s). Probado como compu y como Android: título, partida nueva, video de la intro y primer mapa, sin archivos faltantes ni errores.
