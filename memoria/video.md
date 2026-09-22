# Video: zócalos y quemar gráficos
Fuente: `zocalo/quemar.mjs` (cabecera). Ver también: [maquina](maquina.md).

## Las herramientas (22/9/2026)

- **No hay ffmpeg en la máquina.** El de `/opt/pw-browsers/ffmpeg-1011` es de
  Playwright y **no decodifica H.264** (solo codifica VP8): no sirve para
  videos de verdad. `pip install imageio-ffmpeg` trae uno completo, con
  libx264 y aac; la ruta sale de `imageio_ffmpeg.get_ffmpeg_exe()`.
- Para ver un video sin mirarlo entero: una **hoja de contacto** con
  `fps=12/<duración>,scale=496:-1,tile=4x3`. Una sola imagen, una sola mirada.
- Para ubicar un gráfico encima de otro, **mirar un cuadro a resolución
  completa**. Adivinar sobre miniaturas y detectar colores por código dio
  medidas mezcladas (el detector juntó el borde de la intérprete con el zócalo).

## Quemar un gráfico HTML en un video

- La grabación de Playwright **no tiene alfa**: no sirve para superponer. Se
  hace cuadro por cuadro: se pausan todas las animaciones, se las lleva a mano
  al instante (`getAnimations()` + `currentTime`) y se saca PNG con
  `omitBackground`. Después, `overlay` de ffmpeg y el audio con `-c:a copy`.
- Solo hace falta capturar la entrada y **un ciclo** de lo que se repite; el
  resto son enlaces. Medido: 61 capturas para 1.965 cuadros, 17 s en total.
- **Renderizar el HTML empaquetado, no la página suelta**: la suelta no tiene
  el reset del body y todo sale corrido 8 px.
- Fuentes: el Chromium de acá no llega a Google Fonts, así que se bajan con
  `curl` (subset latin, trae Á y Ñ) y van **adentro** del HTML como data URI.
  Así el render, OBS sin internet y el artifact usan la misma letra.

## Trampas del zócalo (medidas)

- **Nombres de clase que chocan:** la clase del modo (`html.obs`) y la del
  recuadro de ayuda (`.obs`) eran la misma, y el `<html>` se quedaba con el
  borde y el padding del recuadro: todo corrido 15 px hacia abajo.
- **Ajustar texto a una caja:** el alto se mide con `getBoundingClientRect`,
  no con `scrollHeight` (Anton tiene la caja de letra más alta que el renglón:
  dos líneas "medían" 83 px ocupando 75). El ancho se compara con un píxel de
  tolerancia: `scrollWidth` viene redondeado y parecía desbordar siempre.
- OBS define `window.obsstudio` en sus fuentes de navegador: con eso la página
  se pone sola en modo transparente, sin pasarle nada por la URL.
