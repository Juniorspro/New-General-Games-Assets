## KUNTUR: qué se lleva y qué se rehace

Es 2.5D de papel tipo Paper Mario, hecho con three.js (WebGL), 7 capítulos y
3 idiomas. El juego armado pesa unos 850 KB (three.js incluido): entra en los
4 MB del paquete principal.

**Lo más importante:** three.js no es uno de los motores que TikTok lista
(Cocos Creator, LayaAir, Unity). Hay dos caminos:
- adaptarlo, poniéndole a three.js un canvas y un contexto WebGL del runtime y
  lo mínimo de `window`/`document` que pide;
- rehacer la parte 3D en Cocos Creator o LayaAir, llevándose la lógica.

**Se lleva tal cual (sin navegador):**
- `js/fisica.js`: Killa y todo lo que la toca.
- `js/niveles.js` y `js/mapas.js`: los capítulos. `mapas.js` lo genera
  `herramientas/mapas.py`.
- `js/historia.js`: los guiones.
- `js/textos.js`: los tres idiomas.
- `js/sprites.js`, `js/elenco.js`, `js/actores.js`, `js/azar.js`, `js/vox.js`
  y `js/biomas.js`.

**Depende de three.js:**
- `js/escena.js`: el renderer, la cámara, las luces y el post.
- `js/juego.js`, `js/escenario.js`, `js/figuras.js`, `js/papel.js`,
  `js/papelitos.js`, `js/cielo.js` y `js/paisaje.js`.
- Las texturas de papel se pintan en lienzos al arrancar: ahí va
  `tt.createCanvas()`.

**Se rehace en el canvas:**
- `js/ui.js` y `kuntur.css`: el teatrito tejido, los menús, el cuaderno, las
  charlas y la narración. Es HTML.
- `js/entrada.js`: los controles de dedo y su editor son elementos HTML.
- `js/pantalla.js`: el giro de 90°. En TikTok queda la orientación horizontal
  fija.
- `js/sonido.js`: WebAudio (música andina sintetizada).
- El guardado usa `localStorage`.

**Para probar:**
- `node kuntur/pruebas/recorrido.mjs <capítulo> --guardar`: el resolvedor.
- `node kuntur/pruebas/partida.mjs`: la partida entera en Chromium.
