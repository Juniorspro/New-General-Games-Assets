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

El clip es de la **Legislatura de Entre Ríos** (habla María Elena Romero,
Juntos por Entre Ríos, sobre la reforma jubilatoria), no de la Cámara nacional.

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

## 9:16 para TikTok (`tiktok/armar.mjs`, 23/9)

- Tres capas: el video agrandado, desenfocado y oscurecido de relleno; el video
  entero a 1080 de ancho en y 750; la plantilla HTML transparente arriba.
- La plantilla **no se captura cuadro por cuadro**: la intro sí, después solo
  cuando cambia un subtítulo, y ffconcat le da a cada imagen su duración.
  Medido: 221 capturas, 2 min 7 s para 65 s de video.
- Zonas de la app de TikTok que tapan: arriba hasta ~y 180, la columna de
  botones a la derecha y el texto de la publicación desde ~y 1570. Los
  subtítulos van de 1424 a ~1562 y entre x 90 y 930.
- `setsar=1` al final: el escalado dejaba SAR 4096:4095 y DAR 256:455 en vez de
  9:16. No se ve, pero hay plataformas que por eso reencuadran.
- **Trampa de animación:** un destello con `fill: both` aplica su primer cuadro
  durante toda la espera. Con 90 % de blanco, el arranque salía lavado. Para
  algo que tiene que estar apagado hasta su momento: `forwards`.

## Subtítulos automáticos

- `pip install faster-whisper`, modelo `medium` en int8: 72 s para 65 s de audio
  (21 s de eso es cargar el modelo). Se baja de Hugging Face sin problemas.
- Se usa `medium` y no `small` porque son palabras de una persona real: un error
  de transcripción es una cita falsa. Con palabra por palabra
  (`word_timestamps=True`) se marcan las de confianza baja: en el clip, 5 de 133.
- Bloques de hasta 4 palabras o 24 caracteres, cortando en puntuación, en
  pausas de más de 0,4 s y sin dejar una palabra sola al final.
- **Siempre se entrega el .srt** para que se corrija a mano: Whisper no sabe lo
  que el clip cortó (en este faltaba la primera palabra de una frase).

## Mirar una cuenta de TikTok

- `curl` con user agent de navegador trae el HTML del perfil, y adentro el JSON
  `__UNIVERSAL_DATA_FOR_REHYDRATION__`: nombre, bio, seguidores, likes, cantidad
  de videos. **La grilla de videos no**: pide sesión iniciada, y en el navegador
  sale "Hubo un problema".
- Chromium llega a internet si se le pasa el proxy (`proxy: {server:
  HTTPS_PROXY}`) y se le hace confiar en `/root/.ccr/ca-bundle.crt` con
  `--ignore-certificate-errors-spki-list` (las claves del bundle, sacadas con
  openssl). El almacén NSS que menciona la guía del proxy **estaba vacío**.
