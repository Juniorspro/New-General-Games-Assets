# Juegos HTML 2D y 3D con calidad "AAA"

Dos plantillas que **andan en un solo archivo HTML**, probadas en Chromium:

| plantilla | motor | qué trae |
|---|---|---|
| `plantilla-3d.html` | three.js 0.180 (importmap a jsdelivr) | ACES + PBR con entorno, sombras suaves 2048, niebla, bloom solo en emisivos, cámara con retardo, sacudida, partículas, control teclado/táctil |
| `plantilla-2d.html` | canvas puro | pixel art a escala entera, hoja de sprites con animaciones, parallax de 3 capas, física a paso fijo 1/120, coyote time, buffer de salto, salto variable, squash & stretch, hit-stop, polvo |

```sh
node herramientas/juegos/probar.mjs $PWD/herramientas/juegos/plantilla-3d.html captura.png
```
`probar.mjs` juega unos segundos, mide FPS y junta errores. Como Chromium no
sale a internet, sirve jsdelivr desde `/opt/gamekit/node_modules`.
Medido: 2D **62 FPS**, 3D **5-10 FPS** (es WebGL por software — SwiftShader, sin
GPU; en un teléfono real va a 60). Cero errores en los dos.

## La lista de lo que hace que un juego se sienta "AAA"

**Imagen**
- Color correcto: `ACESFilmicToneMapping` + salida sRGB (`OutputPass` al final).
- Luz clave cálida + relleno frío (contraste de temperatura). Entorno PMREM para reflejos PBR.
- Profundidad: niebla, parallax, capas del fondo más desaturadas.
- Bloom con umbral alto: que brille lo emisivo, no toda la escena.
- Una paleta cerrada (5-8 colores) — el pixel art sin paleta se ve amateur.
- Pixel art: resolución interna baja, escala **entera**, `image-rendering: pixelated`, cámara redondeada.

**Sensación (juice)** — lo que más separa lo amateur de lo pro
- Aceleración, no velocidad instantánea; suavizado `1 - exp(-k·dt)` independiente del framerate.
- Coyote time (~90 ms) y buffer de salto (~120 ms). Salto variable.
- Squash & stretch al saltar y al caer. Hit-stop de 50 ms al golpear/agarrar.
- Sacudida de pantalla que decae. Partículas en cada acción.
- Cámara con retardo, nunca pegada al jugador.

**Técnica**
- Física a paso fijo; `dt` acotado (volver de otra pestaña no teletransporta).
- `setPixelRatio(min(dpr, 2))` — en celulares con dpr 3 el relleno mata.
- Táctil + teclado desde el día uno; `touch-action: none`.
- Exponer `window.__estado()` para poder probar el juego desde un script.

**Assets**
- Sprites y modelos: Rezona (`submit_sprite_generation`, `submit_model3d_generation`)
  cuando esté la key. **Nunca Higgsfield.**
- Blender por script (`herramientas/blender/`) para modelos propios con semilla fija.
- Librerías listas en `/opt/gamekit`: three, phaser, pixi.js, howler, cannon-es, rapier3d, postprocessing, gsap.
