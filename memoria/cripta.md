# Cripta Neón — lo que enseñó (30/09/2026)
El juego está en `cripta/` (README con "Lo medido"). Pedido: "recrear a la perfección" Tomb of the Mask, con menús, animaciones y pixel art completo. Ver también: [juegos-2d-pixel](juegos-2d-pixel.md), [juegos](juegos.md), [probar](probar.md).

## Decisiones
- Original del mismo género: se copiaron reglas (deslizar hasta la pared, lava que sube, poderes), no personaje, nombre, logo ni niveles; así se le dijo a quien pide. Heroína: Lu, una luciérnaga. → `cripta/README.md`
- Todo por código: sprites como grillas de texto, letra 5×7 con tildes, niveles como texto; archivo único de 245 KB. → `cripta/empaquetar.py`
- 5 niveles a mano (los que presentan una pieza rara: estrellas, frágil, portales, flechas) y 25 armados con la torre y congelados como texto en `niveles.js`: se pueden retocar y la prueba los revisa.

## El laberinto que se desliza
- Reglas en un solo módulo (`cripta/js/reglas.js › seguir`, `deslizar`) que usan el juego, el resolvedor y la torre: lo que el resolvedor da por bueno es lo que se juega.
- Resolvedor a lo ancho sobre (celda, máscara de frágiles rotas) + vuelta atrás desde los estados que ganan: da "trampas" (se llega vivo y no se sale). → `cripta/js/resolver.js`
- Generar por construcción: tallar tramos en piedra maciza y RESERVAR la pared donde frena cada uno; nada tallado después la abre. 1220 torres: 0 sin camino. → `cripta/js/infinito.js` (comentario de arriba)
- Trampas que encontró el resolvedor (30/09/2026): un pasillo base de lado a lado (se rebota entre puntas), bolsillos a mitad de tramo (no se llega) y carriles de bichos con una parada al lado (se entra y se frena adentro). Arreglos: base de una celda, bolsillos desde la parada hacia el lado contrario del tramo que sigue, carriles tallados en piedra maciza y cruzados a 2 celdas o más de cada parada.
- Deshacer tramos sin contar fallos por profundidad da vueltas para siempre (deshacer y rehacer igual): los fallos se olvidan recién al llegar más lejos que nunca. → `infinito.js › destrabar`
- Los peligros van cuando la fila queda fija, y en el camino solo lo que se esquiva con tiempo; donde Lu frena nunca hay nada que la mate esperando.
- En un carril no se frena: sus chispas (y la celda de la polilla) no se juntan nunca; se sacaron para que el "todo limpio" sea posible (lo detectó la prueba de niveles).

## Look y jugo
- Paredes "autoarmadas": cada cara que da al piso lleva borde de neón + luz, esquinas de adentro con su píxel, reflejo en el piso. Horneadas en trozos de 32 filas. → `cripta/js/nivel.js`
- Luces de tres bandas de círculos de a píxel sumadas con 'lighter': la trama Bayer se veía como ruido. → `juego.js › luzRedonda`
- Púas que salen de la pared que tienen enfrente un lado abierto (en una muesca, solo del fondo). → `juego.js › ladosPuas`
- Lu pegada a la pared: rotada de a 90° con los pies contra ella; volando, derecha y estirada.
- El menú que se mece, en 2D: el cartel del título es un péndulo con resorte que el dedo empuja, y el fondo de los menús se corre por capas según el dedo. → `cripta/js/ui.js › cartelTitulo, FondoMenu`

## Trampas pagadas
- Botones que se rearman (comprar, cambiar idioma) repetían la entrada y no se podían tocar 0,4 s: la botonera guarda el reloj por id. → `ui.js › Botonera.agregar`
- En la partida, la navegación de botones con flechas se comía las flechas de mover a Lu: botonera sin teclado.
- `getImageData` al morir trabó 15 ms un paso (espera a la placa): los píxeles se leen una vez por sprite. → `juego.js › pixeles`

## Entregarlo
- Además del archivo único, se publicó como página privada de Claude (artifact) para jugarlo desde el teléfono (30/09/2026). Para actualizarla: `Artifact` con `action: list`, leerla y republicar con su `url`.
- La versión de página es el archivo único sin `<!doctype>/<html>/<head>/<body>` (la página pone el esqueleto), con `<title>` primero, colores como variables en `:root` (un solo tema oscuro, `color-scheme: dark`), `html, body { height: 100% }` y 16 px de margen a los costados: la escala entera se sigue calculando sola con el ancho que queda.
- "Reducir movimiento" del teléfono: sacudida a un cuarto y sin destellos. → `cripta/js/efectos.js`

