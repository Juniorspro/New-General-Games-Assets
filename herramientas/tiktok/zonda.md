## ZONDA: qué se lleva y qué se rehace

Es plataformas tipo Celeste en pixel art: 20 salas en el cerro, 3 idiomas.
Está hecho sobre `motor2d/`, el motor 2D compartido con LUZ MALA. El juego
armado pesa unos 210 KB.

**Se lleva tal cual:**
- `zonda/js/fisica.js` y `zonda/js/salas.js`: la física y las salas, puras.
- `zonda/js/historia.js` y `zonda/js/idiomas.js`: los textos.
- `zonda/js/arte.js` y `zonda/js/musica.js`: el arte y las partituras.
- `zonda/js/pantallas.js`: la portada, las tarjetas y los diálogos ya se
  dibujan en el lienzo.

**Se adapta:**
- `motor2d/pantalla.js`: la escala entera. Los lienzos se crean con
  `document.createElement('canvas')`; cambiar por `tt.createCanvas()`.
- `motor2d/sprites.js` y `motor2d/fx.js`: pintan en lienzos aparte (igual que
  arriba).
- `motor2d/sonido.js`: WebAudio.
- `motor2d/base.js`: el guardado (`localStorage`).
- `zonda/js/dibujo.js`: casi todo es canvas; tiene 3 llamadas al DOM.

**Se rehace en el canvas:**
- `motor2d/ui.js`, `motor2d/ui.css` y los menús de `zonda/js/juego.js`: los
  menús y las opciones son botones HTML (`createElement('button')`).
- `motor2d/entrada.js`: los botones de dedo son HTML.

**Para probar:** las pruebas del resolvedor están en `zonda/pruebas/`.
