# BRILLO

Plataformas 2D en pixel art, en el estilo **Frutiger Aero** de los 2000:
vidrio, burbujas, agua, pasto verde y cielo azul. Un solo archivo,
`brillo.html`, que abre con doble clic y anda sin internet.

**La historia.** Nick es un muñequito azul de vidrio, como el de los programas
de chat de antes pero con piernitas. Un día llega *La Actualización*: PLANO,
un cuadrado gris que les saca el brillo a las cosas. Aplana a Mora, la amiga
de Nick, y se la lleva. Para ir a buscarla, Nick junta los cinco Orbes de Aero
y cruza seis mundos, en este orden:

1. la Colina Serena;
2. el Arrecife de Cristal;
3. Ciudad Vidrio;
4. el Cielo Burbuja;
5. la Noche Aurora;
6. el Plano.

En cada mundo hay un contacto que te ayuda: Tito, Dorado, Lila, Sol y Vio.
En cada orbe te espera un mensaje sin conexión de Mora.

## Cómo se juega

| acción | teclado | mando | dedos |
|---|---|---|---|
| caminar | flechas o A/D | cruz o palanca | joystick |
| saltar (mantené para ir más alto) | Espacio o Z | A | burbuja |
| zumbido (sacude lo gris) | X o E | B o X | zumbido |
| pausa | Esc o P | Start | II |

- En el aire, saltar otra vez sopla una **burbuja**: mantené apretado para
  flotar. Se aprende en el mundo 2.
- En el agua, saltar es nadar hacia arriba.
- Las columnas de viento te suben. Las burbujas grandes también: metete
  adentro y saltá para salir.
- La **Aurora** se pisa solo mientras le pasa la ola de luz. Hay que ir
  detrás de la luz.
- Hay 18 **guiños** escondidos, tres por mundo. Cada uno destapa un emoticón.
- Las **sesiones** (la pantallita verde) guardan la partida.

**En el teléfono** arranca con los dedos. Parado, el juego se gira 90°. Los
controles se acomodan en *Opciones → Controles de dedo*: se puede mover y
agrandar cada uno, cambiar la opacidad, elegir el tipo de joystick
(flotante, fijo o cruz), espejarlos para zurdos y elegir si vibra.

## Armar y probar

```sh
node brillo/herramientas/armar.mjs           # arma brillo.html (minificado)
node brillo/herramientas/armar.mjs --dev     # sin minificar, para leer errores
node --max-old-space-size=6144 brillo/pruebas/recorrido.mjs [mundo] [--guardar]
```

El recorrido usa la física de verdad y un resolvedor A\* para comprobar
tres cosas en cada mundo:

- que se llega de la salida a cada sesión y hasta el orbe;
- que cada guiño se alcanza;
- que lo cerrado está cerrado. Sin el zumbido no se pasa la pared gris de la
  Colina, y sin la burbuja no se cruza la sala hundida del Arrecife.

Los bancos de prueba se abren con `brillo.html?prueba=sprites`,
`?prueba=fondo&mundo=aurora` y `?prueba=nivel&nivel=ciudad&x=900&y=300`.

## Cómo se ve

- **Pixel art de 360 de alto** (el doble que KUNTUR) y de 560 a 880 de ancho.
  Siempre se escala en números enteros.
- Todo se pinta con código, sin imágenes:
  - rampas de 8 tonos;
  - el brillo de vidrio (la mitad de arriba más clara, con corte nítido);
  - un punto de luz y el contorno del color de cada rampa.
- **WebGL** pone encima:
  - bloom;
  - el destello del sol en el lente;
  - rayos de luz;
  - la gradación de cada mundo;
  - un velo claro en los bordes (el Aero aclara, no oscurece);
  - la ondulación bajo el agua.
- **Cada mundo tiene sus capas de parallax y su piso:**

| mundo | fondo | detalle |
|---|---|---|
| Colina | lomas con molinos, árboles de vidrio | sol con rayos |
| Arrecife | haces de luz, corales, cardúmenes | cúpulas de aire con filo de vidrio |
| Ciudad | torres de vidrio con terrazas | monorriel |
| Cielo | nubes a varias profundidades, islas flotantes | un arcoíris al que el Plano ya le borró la mitad |
| Aurora | estrellas, luna, cortinas de luz | casitas con la ventana prendida, luciérnagas |
| Plano | una grilla de placas planas de colores Metro | arranca gris y solo Nick tiene color; cada sesión devuelve una capa |

- **La interfaz es de vidrio:**
  - el idioma se elige reventando una burbuja;
  - "Iniciando sesión…" muestra a los dos muñequitos girando;
  - los menús son píldoras brillantes;
  - las charlas son ventanas de chat ("Tito está escribiendo…");
  - los avisos aparecen abajo a la derecha, como cuando alguien se conectaba;
  - las transiciones son una ola de burbujas.

## La música: qué la hace "Frutiger"

La estética no tiene reglas fijas de sonido, pero se repiten algunas cosas:

- sintetizadores y teclados cálidos y "mullidos", batería suave y melodías
  optimistas;
- tempo lento o medio y mucha reverberación;
- una mezcla de jazz viejo con los sintetizadores de principios de los 2000.

Lo mismo se ve en las referencias más citadas:

- **El arranque de Windows Vista.**
  - Dura cuatro segundos y tiene cuatro acordes, uno por cada color de la
    bandera de Windows.
  - La melodía es de Robert Fripp, la armonía de Steve Ball y el ritmo
    "Win-dows Vis-ta" de Tucker Martine.
  - Fripp grabó horas de material y de ahí salió ese pedacito.
  - Lección: acordes abiertos y luminosos, y una melodía corta que sube.
- **El Canal Tienda de Wii**, de Kazumi Totaka.
  - Está en re mayor, a unos 145-148 BPM.
  - Tiene aire de bossa nova, con acordes de séptima y novena.
  - Lección: el acompañamiento sincopado de la bossa sobre acordes "con
    agregados" suena a vidrio y a sala de espera feliz.

### Qué se tomó para BRILLO

- **La armonía:**
  - casi todo con novenas y séptimas mayores (maj9, m9);
  - dominantes con cuarta suspendida (7sus4) en vez de la tensión clásica;
  - modos luminosos: el lidio en el cielo y el dórico en el agua y en la
    noche.
- **El ritmo:**
  - comp de bossa en el piano eléctrico, bajo de raíz y quinta;
  - escobillas y shaker en vez de redoblante.
- **Los timbres:**
  - marimba, vibráfono, piano eléctrico, campanitas y coro;
  - guitarra y arpa punteadas;
  - flauta y cajita de música.
  - Todo sintetizado con WebAudio, sin un solo archivo de audio.
- **La mezcla:**
  - reverb grande y clara;
  - un eco que rebota de lado a lado;
  - un filtro "de parlante viejo";
  - bajo el agua todo se apaga.
- **Los temas:**

| tema | tonalidad | BPM | lo que suena |
|---|---|---|---|
| título | mi mayor | 132 | bossa con vibráfono y piano eléctrico |
| Colina | re mayor | 112 | marimba y guitarra arpegiada |
| Arrecife | mi dórico | 84 | vibráfono, campanitas y colchón, gotas en vez de batería |
| Ciudad | fa# menor | 122 | campanitas sobre un bombo en negras (el colchón "respira" con el bombo) |
| Cielo | sol lidio | 100 | flauta y arpa |
| Aurora | si dórico | 76 | cajita de música y coro |
| Plano | do mayor | 90 | arranca con un pitido solo; cada sesión suma una capa (bajo, piano, vibráfono, batería) |
| final y créditos | mi mayor | 138 | el tema del título con colchón y campanitas |

- **Los efectos:**
  - el "iniciaste sesión" de las sesiones son dos notas que suben, hechas
    para BRILLO (no es el de ningún programa);
  - las gotitas suben la escala si se juntan seguidas.

Fuentes:

- [Frutiger Aero, Wikipedia](https://en.wikipedia.org/wiki/Frutiger_Aero)
- [Frutiger Aero, Aesthetics Wiki](https://aesthetics.fandom.com/wiki/Frutiger_Aero)
- [What makes Frutiger Aero Music Frutiger Aero?, Frutiger Aero Archive](https://forum.frutigeraeroarchive.org/viewtopic.php?t=550)
- [Who Created The Windows Start-Up Sound?, fripp.com](https://fripp.com/who-created-the-windows-startup-sound/)
- [The Windows Vista 4 Chords, 4 Seconds Startup Masterpiece, Softpedia](https://news.softpedia.com/news/The-Windows-Vista-4-Chords-4-Seconds-Startup-Masterpiece-39974.shtml)
- [Robert Fripp, Wikipedia](https://en.wikipedia.org/wiki/Robert_Fripp)
- [Wii Shop Channel Theme, Hooktheory](https://www.hooktheory.com/theorytab/view/kazumi-totaka/wii-shop-channel-theme)
- [Wii Shop Channel, SongBPM](https://songbpm.com/@kazumi-totaka/wii-shop-channel-from-nintendo-wii-channels-for-flute-piano-duet)
- [Kazumi Totaka, Wikipedia](https://en.wikipedia.org/wiki/Kazumi_Totaka)

## El tráiler

`brillo/trailer/` arma el tráiler para TikTok: 56 s en 9:16 (1080×1920,
30 fps), MP4 H.264 + AAC a -14 LUFS, con su portada. Todo lo que se ve es el
juego de verdad; el montaje lo hace [Remotion](https://www.remotion.dev/)
(React → video).

```
node brillo/herramientas/armar.mjs
cd brillo/trailer/remotion && npm install && cd -          # una vez
node brillo/trailer/grabar.mjs todo --idioma=es            # o en, pt
node brillo/trailer/verificar.mjs brillo/trailer/salida/brillo-tiktok-es.mp4 2,10,20,40
```

Son tres pasos (`grabar.mjs tomas`, `audio`, `video`), que también se
corren sueltos. Los tres leen el mismo guion (`trailer/guion.js`), que tiene
dos listas, como un editor: las **tomas** (lo que se graba del juego) y los
**planos** (el montaje: qué pedazo de qué toma, cuánto dura, cómo entra).

- **El montaje:**
  1. Gancho: cuatro golpes de juego a tempo y "Todo brillaba.".
  2. Glitch: la música se corta y empieza la historia. Es la Actualización,
     en seis planos, con franjas de cine y primeros planos de Mora y de Nick.
  3. El logo, en el golpe.
  4. Los seis mundos, un compás cada uno.
  5. Tres rasgos: los orbes, el modo 16 bits (la música cambia a chip) y los
     idiomas.
  6. La pregunta de PLANO y la respuesta de Nick.
  7. La ráfaga y el cierre: "Jugalo gratis · link en la bio".
  Del logo en adelante cada corte cae en un compás del tema final (138 bpm).
- **Las tomas son el juego** (`tomas.js`).
  - `grabar.mjs` levanta un servidor local y le mete a `brillo.html` un reloj
    propio: `requestAnimationFrame`, `performance.now` y `setTimeout`. Así
    cada cuadro sale exacto y la misma toma sale siempre igual, aunque la
    máquina tarde medio segundo en dibujarlo.
  - Nick juega solo, repitiendo los recorridos del resolvedor
    (`pruebas/recorridos/`).
  - El recorte es vertical de verdad: 540×960 del lienzo alrededor de Nick,
    agrandado ×2 sin suavizar. Un píxel del juego son 6×6.
  - La Actualización la actúa el director del juego. Su chat (HTML) se guarda
    cuadro a cuadro, igual que dónde están Nick y Mora. Remotion usa eso para
    los globos de diálogo y para los primeros planos.
- **La música** (`audio.js`) es la del juego, hecha con su sintetizador en un
  `OfflineAudioContext`, más los efectos que el juego pidió en cada pedazo
  de toma usado. ffmpeg la lleva a -14 LUFS.
- **Los motion graphics** (`remotion/src/`) van en pixel art a la escala del
  juego, más el kit Frutiger Aero del juego:
  - chispas de cuadraditos y transición de cuadraditos;
  - mosaico con un filtro SVG, que pixela la imagen de verdad;
  - glitch del Plano con bandas corridas;
  - texto que entra palabra por palabra con sombra dura;
  - pastillas brillantes, logo de vidrio con reflejo, burbujas y destellos.
  Todo va dentro de la zona segura de TikTok. Las letras son Open Sans y
  Nunito (`remotion/public/fuentes/`, OFL).
- **Para probar:**
  - `grabar.mjs tomas --solo=noche,cumbre` graba solo esas tomas;
  - `--muestra=0.5,2` saca PNG en vez de video;
  - `grabar.mjs video --cuadros=550-700` hace solo un pedazo.
- Tomas, música y videos no van al repo (`trailer/.gitignore`): se vuelven a
  hacer con `grabar.mjs`.
