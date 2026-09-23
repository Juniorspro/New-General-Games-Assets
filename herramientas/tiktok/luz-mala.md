## LUZ MALA: qué se lleva y qué se rehace

Es un metroidvania tipo Silksong: 9 salas, 3 jefes, 3 idiomas. También está
hecho sobre `motor2d/`. El juego armado pesa unos 300 KB.

**Es el más cerca del runtime nativo:** los menús ya se dibujan en el lienzo
(`luz-mala/js/menus.js`). No usa las capas HTML de `motor2d/ui.js`.

**Se lleva tal cual:**
- `luz-mala/js/fisica.js`, `bichos.js`, `jefes.js` y `salas.js`: puros, con
  azar con semilla.
- `luz-mala/js/textos.js`, `letra.js`, `arte.js` y `musica.js`.
- `luz-mala/js/menus.js` y `pantallas.js`: todo en el lienzo.

**Se adapta:**
- `motor2d/pantalla.js`, `sprites.js` y `fx.js`: `document.createElement('canvas')`
  → `tt.createCanvas()`.
- `luz-mala/js/dibujo.js`: la luz y las salas, en lienzos aparte.
- `motor2d/sonido.js`: WebAudio.
- `motor2d/base.js`: el guardado (`localStorage`).

**Se rehace en el canvas:**
- Los mandos de dedo (`luz-mala/luz-mala.css`, `.mandos`) son elementos HTML:
  un joystick y botones redondos. Se dibujan en el lienzo y los toques se
  reparten por zona.

**Para probar:** las pruebas de salas y jefes están en `luz-mala/pruebas/`.
