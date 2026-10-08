# FILETE (07/10)

Pidió "otro juego diferente con su intro respectiva a su estilo". Rompecabezas de bloques tipo Block Blast con
estética de filete porteño: `filete/filete.html`, **108 KB**. Cómo es y qué archivo tiene qué: `filete/README.md`.

## Lo que hay que saber

- Armar: `node motor2d/armar.mjs filete`. Pantalla de 216 de ancho (1080 = escala 5), alto 384 a 520.
- **08/10: sin intro y en 13 idiomas** ([idiomas](idiomas.md)); la intro de abajo quedó en git: `git show 1f2f036:filete/js/intro.js`.
- **La intro con estilo**: `crearIntroJXS({ ..., estilo })` y `jingleJXS(ctx, destino, estilo)`; el estilo
  cambia el material (colores del metal, filo, bisel, sombra corrida), el fondo y agrega dibujos (`antes`,
  `despues`, `palabraFondo`) y otra música (`jingle`). Ejemplo completo: `filete/js/intro.js`.
- Filete en píxeles (`js/arte.js`): todo con discos de `fillRect` (sin suavizado). Voluta = espiral que se
  angosta con sombra, lado claro y puntitos blancos; la cinta se arma en su propio lienzo (los cortes en V
  con `clearRect` en el lienzo principal harían agujeros).
- La tanda de piezas busca que entren las tres (búsqueda corta: 10 posiciones por pieza, 6 órdenes).
- Para probar: `__filete.empezar('clasico'|'diario'|'barrio', n)`, `__filete.colocar(i, x, y)`,
  `__filete.terminar(gano)`. Con `ayuda: true` en `filete.datos` no sale el cartel de ayuda.

## Quedó

- Entregado con portada 9:16 (Higgsfield `3825fe2a…` + letras de filete con la fuente del juego).
- Sin probar en un celu de verdad (arrastre con el dedo y vibración); los 30 niveles se arman con semilla y
  no se jugaron todos.
