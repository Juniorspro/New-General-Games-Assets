# Videos relatados para TikTok

Gameplay de ~1 min con un narrador en sticker, voz, subtítulos tipo karaoke,
memes, carteles y la música del propio juego. Hechos el 24/09/2026 para LUZ
MALA y KUNTUR. Todo vive en `videos/`. Ver también:
- [brillo](brillo.md) § El tráiler, que es de donde sale el reloj de las tomas;
- [maquina](maquina.md) para Remotion, ffmpeg, Vosk y el proxy;
- [higgsfield](higgsfield.md) para la voz.

## Qué pidió

- "Gameplay de 1 minuto relatando, con buen motion graphics, transiciones", y
  sus 7 stickers de un nene chibi como narrador (`videos/medios/stickers/`).
- **Memes bajados de internet, no generados** ("DE GOOGLE… no los generes").
  Después pidió "memes chaqueños" para LUZ MALA.
- Humor "no tan funable, tranquilito". A la de KUNTUR le dice "la peruanita":
  en el video es **Killa, de Purmamarca (Jujuy)**, sin chistes de origen.
- LUZ MALA "bien chaqueño, chamamé de fondo".
- **No se bajó audio de TikTok con ssstiktok:** son canciones con dueño. Va la
  música del juego y, si quiere un sonido de TikTok, se pone desde la app.

## Cómo se hace (en orden)

1. **Tomas:**
   - LUZ MALA: `node videos/grabar-luz-mala.mjs [toma,…]`. Lee el lienzo
     (`toDataURL`) cuadro a cuadro y lo agranda ×3 con `neighbor`.
   - KUNTUR: `node videos/grabar-kuntur.mjs [toma,…]`. Hace una captura de la
     página por cuadro (así salen el telón y los globitos HTML), a ~1,2 s por
     cuadro con SwiftShader. También saca un `.fondo.mp4` desenfocado.
   - Las tomas van a `videos/medios/tomas/<juego>/`.
2. **Voz:**
   - `videos/medios/voz/<juego>/guion.json` tiene las líneas; cada `NN.mp3`
     sale de Higgsfield.
   - Los tiempos por palabra: `python3 videos/tiempos.py <modelo-vosk>
     videos/medios/voz/<juego>/guion.json`, que escribe `lineas.json`.
3. **Música:** `node videos/musica.mjs <nombre> <seg> '<marcas>' <scripts>
   [modulo]`. Toca el sintetizador del juego en un OfflineAudioContext y sale
   un WAV.
   - LUZ MALA: `'[[0,"pueblo"]]'` con `motor2d/base.js,motor2d/sonido.js,luz-mala/js/musica.js`;
     es chamamé a 104 bpm en 3/4.
   - KUNTUR: `'[[0,"colores"]]' kuntur/js/sonido.js modulo`; es huayno, y
     después se le pasó `loudnorm` a -18 LUFS.
4. **Montaje:** `videos/remotion/src/montajes.js`.
   - Cada línea tiene su sticker, sus planos (`[toma, desde, peso, enfoque?]`)
     y sus extras: chip, golpe y meme, con `texto` o `paneles` y enganchados a
     una palabra.
   - `LARGO_TOMAS` avisa si un plano pide más de lo grabado.
5. **Render:** `node videos/render.mjs LuzMala luz-mala` (o `Kuntur kuntur`).
   Hace tres cosas:
   - Remotion saca un crudo;
   - lo pasa por `loudnorm` en dos pasadas a -14 LUFS y lo codifica en BT.709
     como `salida/<id>-tiktok.mp4`;
   - saca `-tiktok-liviano.mp4` en dos pasadas a 3,6 Mbps, para mandarlo por
     el chat (<30 MiB).
   - Con `--sin-musica`, sobre el render ya hecho: solo voz y efectos, para
     ponerle un sonido de TikTok desde la app. Remotion no dibuja cuadros para
     un códec de audio: tarda ~2 min.
   - Con `--rehacer=<cuadro>`, sobre el render ya hecho: vuelve a dibujar
     desde ese cuadro y lo empalma sin tocar el sonido. Un arreglo del cierre
     costó ~3 min en vez de ~22.

## Miniaturas

- `remotion/src/Portada.jsx`, con los Stills `PortadaLuzMala` y `PortadaKuntur`
  (24/09). Lo importante va en el centro 3:4, que es lo que muestra la grilla
  del perfil.
- Los cuadros de fondo salen de las tomas: `ffmpeg -ss <s> -i
  medios/tomas/<juego>/<toma>.mp4 -frames:v 1 medios/portadas/<nombre>.png`
  (no se commitean). Los tiempos están en `Portada.jsx`, por nombre.
- Se renderizan con `remotion still src/index.jsx PortadaLuzMala
  ../salida/PortadaLuzMala.png` y los mismos flags de siempre; después se
  pasan a JPG.

- **Con arte de Rezona (24/09, las que le gustaron):**
  - `PortadaArte.jsx`, con los Stills `ArteLuzMala`, `ArteKuntur` y `ArteBrillo`.
  - El arte está en `medios/rezona/` (commiteado, porque costó créditos) y los
    prompts en `medios/rezona/prompts.json`.
  - El personaje sale fiel si se le pasa el sprite agrandado como referencia:
    receta en `estado.json › miniatura_con_referencias`.
  - El emoji 🫧 no está en la fuente de emojis: no se dibuja.

## Formatos

- **Completo:** LUZ MALA ya es vertical (360×640 lógico), así que va a
  pantalla entera.
- **Franja:** KUNTUR es 16:9, así que va en una franja de 1080×780 entre
  guardas de aguayo, sobre su fondo desenfocado y con papel picado.
  - El `enfoque [x, y, zoom]` acerca el plano a Killa, que a 1280×720 mide
    ~20 px.
- Zonas seguras de TikTok: no poner nada en los ~220 px de arriba, los ~300 de
  abajo ni los ~120 de la derecha.

## Trampas ya pagadas

- **Remotion congela `public/` al empaquetar:** si grabás una toma nueva, hay
  que volver a renderizar. `--public-dir=../medios`.
- **Tomas:**
  - En LUZ MALA hay que forzar el español: `ponerIdioma('es')`, o en la toma
    del título apretar izquierda en los faroles. Si no, arranca en inglés.
  - KUNTUR se colgaba esperando un `setTimeout` virtual dentro de
    `capitulo()`: por eso `window.__esperaReal`. Las capturas llevan
    `timeout: 180000`.
- **Música:** si se pisa el `setTimeout` para programarla, hay que devolver el
  real antes de `startRendering`. Si no, el `waitForFunction` de Playwright no
  vuelve a mirar nunca.
- **Sonido:** en el primer render la música quedaba 11 dB abajo de la voz. Se
  bajan a `volVoz` cuando habla y suben a `volSola` en los huecos (LUZ MALA:
  0,42 y 0,9; KUNTUR: 0,3 y 0,75).
- **Pantalla:**
  - Los subtítulos tapaban los textos del juego: van en una píldora oscura
    (LUZ MALA, y=1130).
  - El gancho en una línea se salía del cuadro: se parte en dos.
  - El sticker (que se dibuja después) tapaba "link en la bio": el cierre va
    más arriba (`yCierre`).
- **Vosk:**
  - Oye mal los nombres ("Killa" → "que la", "Purmamarca" → "burma marca").
    Por eso las palabras salen del guion y Vosk solo da los tiempos, que se
    alinean por letras.
  - Sirve para comprobar la pronunciación antes de montar.
- **Memes:**
  - Google Imágenes da captcha y no se saltea.
  - Bing, Pinterest, Reddit y memedroid no dan resultados o bloquean.
  - Las plantillas salieron de la API de imgflip (`medios/memes/fuentes.json`)
    y el texto chaqueño se pone encima (`paneles`).
  - Mirá la plantilla entera antes de usarla: la de Shaq dormido trae escrito
    "real shit", y se cambió por el esqueleto esperando.
  - Pidió de nuevo el chamamé bajado de TikTok. No se hizo: se le dio la
    versión sin música.
  - Chamamé libre en Internet Archive o Wikimedia: lo que hay es NC-ND o con
    "derechos reservados" en la descripción, aunque la ficha diga CC0.

## Lo que quedó

- Los dos videos (`videos/salida/`, no se commitea) y sus copias livianas.
- Si lo pide, falta:
  - versión sin música, para usar un sonido de TikTok;
  - versiones en inglés o portugués (habría que regrabar la voz y las tomas);
  - un tercer video (BRILLO o ZONDA) con el mismo sistema.
