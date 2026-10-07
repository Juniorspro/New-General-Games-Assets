# FILETE — el rompecabezas porteño

Rompecabezas de bloques vertical (tipo Block Blast) pintado en filete porteño: se arrastran piezas a un
tablero de 8 × 8 y las filas o columnas llenas se borran. Combos, "¡tablero limpio!", récord, partida
guardada sola, un CAMBIO de piezas (otro cada 1500 puntos), 30 niveles en 5 barrios (San Telmo, La Boca,
Abasto, Boedo, Palermo) para juntar flores con 1 a 3 estrellas, y el desafío del día (las mismas piezas
para todos ese día). Música: un tango sintetizado (bandoneón, marcato, contrabajo con arrastre).

- Un solo archivo: `filete.html` (unos 110 KB, abre con doble clic, sin internet).
- Armar: `node motor2d/armar.mjs filete`.
- Intro: la de JXSTUDIOS compartida (`motor2d/intro-jxs.js`) con el estilo filete de `js/intro.js`.
- Controles a gusto: altura de la pieza sobre el dedo, velocidad del arrastre, tamaño de la bandeja, guía de
  jugada, zurdo y vibración (con zona para probar).

| archivo | qué tiene |
|---|---|
| `js/base.js` | tamaños, guardado, textos en es/en/pt |
| `js/arte.js` | volutas, hojas, flores, cintas, letras de filete, fichas |
| `js/tablero.js` | formas, dónde entra cada una, borrar líneas, la tanda justa, puntaje, niveles |
| `js/sonido.js` | el tango y los efectos |
| `js/intro.js` | el estilo filete de la intro de JXSTUDIOS |
| `js/juego.js` | escenas, arrastre, efectos y el bucle |
