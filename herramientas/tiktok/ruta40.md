## RUTA 40: qué se lleva y qué se rehace

RUTA 40 son autos tipo Hill Climb en canvas 2D, con arte pintado. El HTML
armado pesa 3,2 MB, pero casi todo es el arte: el código son unos 185 KB
minificado sin imágenes, y las 63 imágenes webp suman unos 2,3 MB. En el
runtime nativo las imágenes van como archivos sueltos, así que el paquete
principal (4 MB) alcanza. Si hace falta más lugar, los fondos `lejos-*` y
`medio-*` pueden ir a un subpaquete.

**Se lleva tal cual (no toca el navegador):**
- `js/fisica.js`: la física del auto, pura y determinista a 240 pasos por
  segundo.
- `js/ruta.js`: los siete tramos, generados con semilla.
- `js/vehiculos.js` y `js/medidas.js`: las fichas y la geometría de los
  autos.
- `js/piloto.js`: el piloto automático (los rivales y el demo del menú).
- `js/juego.js`: el viaje, los trucos, las picadas y la cámara. Solo recibe
  el dibujante para echar partículas.
- `js/vista.js` y `js/textos.js`: cómo se ve cada tramo y los tres idiomas.
  `ponerIdioma` toca `document.documentElement.lang`: esa línea se saca.
- `js/dibujo.js`: todo el dibujo del juego en canvas 2D. Hay que cambiar tres
  cosas:
  - `document.createElement('canvas')`, en `ponerTramo`: solo sirve para
    medir el color del cielo, y se puede reemplazar por un color fijo;
  - `createPattern` y `pattern.setTransform`, para la textura del suelo. Si el
    runtime no tiene `setTransform` en el patrón, se dibuja la baldosa
    repetida con `drawImage` dentro de un `clip()`;
  - `DOMMatrix`, que se usa en esa misma línea.

**Se adapta:**
- `js/arte.js`: en vez de data: URI, `tt.createImage()` con la ruta de cada
  archivo de `arte/`. Si el runtime no lee webp, se convierte cada una a png
  con Pillow: `Image.open(f).save(f[:-5] + '.png')`.
- `js/sonido.js`: el motor, los efectos y la chacarera son WebAudio
  (osciladores, filtros, un convolver y buffers). Si el runtime no tiene
  WebAudio completo:
  - la música se graba desde la página y se lleva como archivo;
  - el motor se hace con 3 o 4 grabaciones en loop cambiando el
    `playbackRate` con las rpm.
- `js/partida.js`: el guardado usa `localStorage`; cambiarlo por
  `tt.setStorageSync` / `tt.getStorageSync`.
- `js/pantalla.js`: el giro de 90° no hace falta (TikTok da la orientación
  por `game.json` con `"deviceOrientation": "landscape"`); se deja solo el
  tamaño.

**Se rehace en el canvas:**
- `js/ui.js`, `ruta40.css` y `js/controles.js` son DOM y CSS, y el runtime
  no los tiene:
  - los carteles;
  - la patente;
  - el mapa con postales;
  - la gomería;
  - el HUD;
  - los pedales.

  Hay que dibujarlos en el mismo canvas. Los toques se leen con
  `tt.onTouchStart/Move/End`: cada pedal es un rectángulo que se prueba con
  el `x, y` del toque. Las posiciones, el tamaño y la transparencia ya están
  guardados en fracciones de pantalla (`P.controles`), así que el editor
  sirve igual.
- La letra Overpass va como archivo con `tt.loadFont`.
