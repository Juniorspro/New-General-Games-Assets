# Aprender a editar mirando TikTok

`estudiar_tiktok.py` baja un TikTok y saca su receta de edición **medida**:
cortes, ritmo de corte, tempo de la música, cuántos cortes caen en el beat,
saturación, luma, y una hoja de contacto (un cuadro por plano) para mirarlo.

```sh
python3 herramientas/video/estudiar_tiktok.py "https://www.tiktok.com/@cuenta/video/123" salida/
python3 herramientas/video/estudiar_tiktok.py video.mp4 salida/
```

## Qué hace falta (lo pone `instalar-todo.sh`)

- `yt-dlp[default,curl-cffi]` y **`--impersonate chrome`**. Sin impersonar, TikTok
  devuelve JSON vacío y yt-dlp falla con `Failed to parse JSON` (medido).
  Con impersonación bajó 3 videos de `@tiktok` a 1080x1920 sin marca de agua.
- ffmpeg (detecta cortes con `scdet`), librosa (beats), OpenCV (color).

## Primera tanda medida (22/9, 3 videos de @tiktok)

| video | dur | cortes/s | plano mediano | BPM | cortes en beat | sat | luma |
|---|---|---|---|---|---|---|---|
| talking head + b-roll | 58,5 s | 0,50 | 1,47 s | 161 | 7/29 | 0,36 | 0,48 |
| DJ / TikTok LIVE | 69 s | 0,84 | 0,10 s* | 123 | 17/58 | 0,47 | 0,30 |
| tutorial | 120,6 s | 0,40 | 1,93 s | 123 | 11/48 | 0,29 | 0,68 |

\* el 0,10 s es una ráfaga de cortes rapidísimos al final (57-59 s): efecto
"stutter" de ~30 cortes en 2 s como remate antes del cierre.

## Lo que se aprende de mirarlos (patrones de edición)

1. **Gancho en el primer segundo**: el primer corte cae antes de 1,5 s y la
   primera frase es pregunta o sorpresa ("Wait,").
2. **Subtítulo siempre**, centrado abajo del medio, 1 línea, blanco con sombra,
   una frase por plano. Es lo que retiene sin audio.
3. **Alternar A-roll / B-roll**: cara a cámara (verde, misma luz) intercalada
   con planos de ilustración (fiesta, otro lugar) cada 2-4 frases.
4. **Contenido hablado no corta al beat** (~25 % de los cortes en beat = azar);
   corta a la frase. El montaje a beat es para edits musicales (fan edits,
   Patrick Jane: 1,22 cortes/s).
5. **Remate con ráfaga** (stutter / flash / zoom) en los últimos segundos
   para cerrar con energía.
6. **Destellos de color (light leaks) como transición** en momentos de marca.

## Pipeline para editar (con ffmpeg)

- Beats → `librosa.beat.beat_track`; cortes en esos tiempos con `-ss/-t` y
  `concat`, o `xfade` para transiciones.
- Zoom punch en el beat: `zoompan` o `scale`+`crop` animado.
- Subtítulos: `drawtext` o `subtitles=archivo.ass` (estilo ASS: blanco, borde 3).
- Formato de salida: 1080x1920, 30 fps, H.264 `-crf 18 -preset slow`, AAC 192k.
- Material propio o crudo, nunca re-subir edits ajenos (Content-ID).

## Neko PC con TikTok

En la Neko (Firefox) TikTok abre y se ve el perfil; la grilla de videos pide
login ("Something went wrong" sin sesión). Para estudiar se usa yt-dlp.
