# Videos relatados para TikTok

Gameplay de ~1 min con un narrador en sticker, voz, subtítulos tipo karaoke,
memes, carteles y la música del propio juego. Hechos el 24/09/2026 para LUZ
MALA y KUNTUR. Todo vive en `videos/`. Ver también:
- [brillo-trailer](brillo-trailer.md), que es de donde sale el reloj de las tomas;
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

## Los dúos (02/10): dos juegos de un archivo por video

Pidió "3 videos bien producidos en español latino, de 1 minuto, con buen motion
graphics" de los seis de un archivo ([sueltos](sueltos.md)). Salieron de a dos:
GLOBO + VÍBORA, MORFI + CRIPTA y LA ISLA + GRUMO, de ~58 s, con voz Andre
(Higgsfield, ElevenLabs) en neutro latino (tú, no vos), sin memes.

- **Tomas:** `node videos/grabar-sueltos.mjs <juego> [toma,…] [--cada=N]`. El
  reloj propio va en `<head>` (`sueltos/reloj.mjs`); cada juego tiene su bot en
  `sueltos/<juego>.mjs`, que juega por los ganchos de prueba (`__G`, `__V`, `__C`,
  `__isla`) y anota por cuadro dónde está todo (`<toma>.datos.json`) para los
  círculos y los dedos del montaje. 432×768 a ×2,5 = 1080×1920 justo.
  `--cada=15` es la prueba rápida: una hoja de contactos en `salida/pruebas/`.
  - GLOBO: el escudo empuja desde abajo y de costado lo que va a tocar el globo;
    los molinetes, por la punta. Inmortal + anota los toques: se usan los
    tramos limpios.
  - VÍBORA: la propia, marcada `bot` con una `ia` prudente: la maneja el
    cerebro de los bots. Inmortal (se anota `salvada`). Turbo: `entrada.turbo`.
  - MORFI: cada nivel trae su solución (`def.sol`); se aplica en el paso exacto
    envolviendo `partida.paso`. Tres estrellas siempre.
  - CRIPTA: el camino del resolvedor (`__C.camino(i)`), deslizando con el SIGNO
    (−1/0/1; con píxeles no se mueve). Gana 12 de 30: los bichos que se mueven
    no los mira. La torre: los tramos que talló la torre (como la demo).
  - GRUMO: cada escena trae su guion "jugado como persona"; el intérprete es
    nuestro (`borde` = caminar al borde mirando adelante con `clonar()` y
    saltar; soltar el botón antes de cada salto). Gana 10 de 20.
  - LA ISLA: un director maneja la palanca, usar/poner y la mirada; aparece lo
    que pide el guion (`J.enemigos.crear`, `J.ponerBajo`, `J.cielo.hora` de 0 a 1,
    `J.historia.leerCarta()`).
- **Música:** `node videos/sueltos/musica.mjs <juego> <tema> 34`: el AudioContext
  del juego pasa a ser un OfflineAudioContext con el reloj propio. Salen a
  -33 LUFS; se pasan a -18 con `loudnorm` antes de montar.
- **Montaje:** `remotion/src/duos.js` (qué va en cada línea; planos enganchados
  a palabras con `en`), `Duo.jsx` y `kit2.jsx` (pantalla partida, título por
  juego, cortina, círculo que sigue, dedo que corta/toca/desliza, marco,
  encuesta "comenta 1 o 2" y JXSTUDIOS). Los subtítulos van donde no tapan:
  GLOBO a 640, MORFI y GRUMO a 330, el resto a 1185.
- **Portadas:** `node videos/portadas-duo.mjs` → `salida/Portada<Comp>.png` (+ .jpg): "2 JUEGOS"
  con la frase del gancho, las dos capturas en tarjetas con número y nombre, "¿1 o 2?" y el
  narrador asomado. Qué cuadro va en cada una: `remotion/src/portadasDuo.js`.
- **Render:** `node videos/render.mjs GloboVibora globo-vibora --publico=../salida/publico`
  (`salida/publico/` son enlaces absolutos solo a lo de los dúos: el bundle
  los deja como enlaces y no copia 150 MB por render).

### Trampas de los dúos

- `pkill -f <nombre>` en una orden que contiene ese nombre se mata a sí mismo
  (otra vez, dos veces): `pgrep -f "grabar-sueltos.mj[s]"` con corchete.
- `partida.clonar()` copia también el `paso` que el bot le enganchó a la
  instancia: la copia se llamaba a sí misma sin fin. `delete q.paso`.
- LA ISLA con `?directo` arranca con 1,5 s de vuelo de cámara: lo que se manda
  durante el vuelo se pierde (la mochila no abría). Esperar `J.estado ===
  'jugando'` y `!J.menu.vuelo`. La caña tira en el impacto del golpe: el botón
  se mantiene medio segundo. En la punta del muelle está el cartel de los
  créditos del menú (la cámara quedaba adentro).
- Los cuadros sueltos del grabador iban dentro de `medios/` (que Remotion
  copia entero): ahora van a `salida/cuadros/`.
- Con cinco grabaciones a la vez la máquina va a 1-1,6 s por cuadro; un
  `timeout` de 25 min cortó una prueba a la mitad.
- Un plano que pide más toma de la que se grabó no avisa en Remotion: los
  menús duraban 5 s y el gancho pedía 6,6. `node videos/revisar-duo.mjs <id>`
  muestra la línea de tiempo y marca "SE PASA". Si una toma no alcanza para la
  pantalla partida, la mitad puede ser una tira: `[[toma, desde, recorte, dur], …]`.
- Antes del render entero: `node videos/fotos.mjs <Comp> <id> 3,7.5,13` (un
  navegador, una foto por segundo pedido, hoja en `salida/pruebas/<id>-fotos.jpg`).
- La música de LA ISLA tiraba el navegador: cada `__reloj.cuadro(10)` dibujaba
  el 3D. Se corta el `requestAnimationFrame` (la música va con `setInterval`)
  y se callan ambiente y efectos (si no, entran olas). Salió a -35 LUFS.
- En el gancho el narrador tapaba el logo del segundo juego: el gancho va sin
  sticker. Los chips de MORFI y GRUMO van a 140 (`yChip`): a 250 pisaban los
  subtítulos de 330. Un plano puede llevar su `yTexto` (el menú de bots de
  VÍBORA, a 330).
- `OffthreadVideo` en un Still salta al cuadro clave más cercano (las tomas
  llevan uno por segundo): en la portada el atún nunca salía del agua. Las
  portadas usan cuadros sacados con ffmpeg a `salida/publico/fotos/`.
- El bot de GRUMO anota la mano solo donde agarra (`m.punto`): el círculo de
  "el animador" va con la puerta, que es lo que la mano se lleva.
