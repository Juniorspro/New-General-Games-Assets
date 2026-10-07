# TAJO

Cortar fruta con el dedo en tinta sumi-e. Un solo archivo: `tajo.html` (se arma con `node motor2d/armar.mjs tajo`).

- `js/base.js` — pantalla lógica de 360 de ancho, guardado, textos en es/en/pt, la letra entintada.
- `js/frutas.js` — las 10 frutas y la bomba a pincel (piel y corte en caché), mitades, poderes.
- `js/fisica.js` — el vuelo (`lanzamiento`), los filos y el rastro del dedo.
- `js/sonido.js` — koto, shakuhachi y taiko sintetizados; música por modo y efectos.
- `js/intro.js` — papel de arroz, sello rojo, salpicón y la intro de JXSTUDIOS a pincel.
- `js/juego.js` — escenas, olas, modos (clásico, zen, tormenta, del día), combos, HUD, dojo, controles y el bucle.
