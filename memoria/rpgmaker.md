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

## Un solo HTML de menos de 30 MiB (07/10/2026, en pausa: pidió dejar GD de lado)
- Meter binarios en "base122" en vez de base64: 7 bits por byte de UTF-8 (+14 %) en vez de 6 (+33 %). Dentro de un `<script>` el HTML solo rompe tres valores: NUL (lo cambia por U+FFFD), CR (lo cambia por LF) y "<" (puede cerrar el bloque). Ese valor de 7 bits va junto con los 7 siguientes en una letra de 2 bytes: U+0100 + (cuál << 7) + siguiente; si es el último, U+0280 + cuál. Ida y vuelta Python → JS: 409 casos sin error; codificar 5 MB tarda 0,8 s en Python.
- El archivo empieza con la marca BOM de UTF-8: le gana a cualquier otra señal de codificación, hasta al encabezado HTTP. UTF-16 dejaría +3 % pero se rompe si un visor lo lee como texto UTF-8; por eso no. Confirmado el 07/10/2026: Rezona AI muestra un HTML en UTF-16 como texto roto.
- Código y datos juntos en un gzip que abre `DecompressionStream`: 9,7 MB → 1,2 MB (por archivo suelto, apenas peor).
- Tilesets de RPG Maker (31, 10,3 MB sin pérdida) → AVIF q55 4:4:4: 2,26 MB, y se ve igual a 3×. El WebP con pérdida promedia el color de a 2×2 y queda peor y más pesado: Outside_B pesa 160 KB a 27,3 dB en WebP q80, contra 102 KB a 33,5 dB en AVIF q55 4:4:4. Pillow 12.3 de acá ya guarda AVIF.
- Window.png va sin pérdida: `Window_Base.textColor` saca el color del texto de sus píxeles.
- Uso fino de las animaciones: de 127 hojas, solo 27 las usa alguna habilidad, objeto, arma, evento (212/337) o complemento. Las otras viajan igual, en AVIF q10, porque si falta una imagen MV corta con "Failed to load". Animaciones usadas: 2,88 MB en WebP q85 → 0,92 MB en AVIF q50.
- Videos VHS: VP9 con CRF 50 a 640 px dio 1,54 MB por 12 s, por el ruido. Con tope de 160 kbps (`-crf 50 -b:v 160k`) quedó en 383 KB y se ve parecido.
- Opus para música a 16, 20 y 24 kbps: el espectro llega a ~20 kHz en los tres (CELT rellena lo agudo). 2 min pesan 221, 272 y 355 KB.
- Ambientes (bgs) a Opus: MV lee LOOPSTART/LOOPLENGTH solo de las cabeceras de Vorbis. Se pasan los valores a muestras de 48 kHz (`-metadata:s:a:0`) y un parche de `WebAudio._readOgg` los lee del OpusTags (sin comprobar en el navegador).
- Presupuesto: todo menos la música quedó en ~18 MB, y a los 68,6 min de música le quedaban ~18 kbps para no pasar 31 MB.
