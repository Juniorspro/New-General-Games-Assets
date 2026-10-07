# NEBULOSA (07/10)

Tercer juego del pedido "ahora otro": fusionar cuerpos celestes con física (tipo Suika) en neón synthwave,
`nebulosa/nebulosa.html`, **104 KB**. Cómo es y qué archivo tiene qué: `nebulosa/README.md`.

## Lo que hay que saber

- **Lienzo liso, no de píxeles**: `canvas` al tamaño real × dpr, unidades lógicas de 360 de ancho y
  `g.setTransform(S, …)` al empezar cada cuadro. Los lienzos en caché (`lienzoHD`) se pintan a `S` y se
  estampan con tamaño lógico; al cambiar `S` se rehacen (la clave lleva `S`).
- **La intro de JXSTUDIOS en un juego liso**: la intro compartida ahora acepta `logo(g, i)` (dibujar el
  monograma a mano con `i.TRAZOS`/`i.camino2d`), `letras`/`presentaTxt` (otra letra), `anchoLogo`, `chispa`, y
  dibuja el fondo con tamaño lógico. Ejemplo: `nebulosa/js/intro.js` (tubos que se prenden y su reflejo).
- Física (`js/fisica.js`): 3 subpasos × 3 pasadas de separación por masa (r²); el choque y el rozamiento solo
  en la primera pasada, así las pilas no tiemblan. La fusión nace con el radio chico y crece (no explota).
- Probar: `__nebulosa.empezar('clasico'|'relampago'|'diario')`, `__nebulosa.tirar()`, `__nebulosa.nuevoCuerpo`,
  `__nebulosa.terminar(porTiempo)`. Bot de 26 s tirando al azar: 47 tiradas, llegó a Júpiter, sin errores.

## Quedó

- Entregado con portada 9:16 (Higgsfield `7deaa0bc…`). Sin probar en un celu de verdad (rendimiento del brillo
  con muchos cuerpos, el arrastre y la vibración).
