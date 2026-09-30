# Grumo — lo que enseñó (30/09/2026)
El juego está en `grumo/` (README con "Lo medido"). Pedido, con una captura de *Level Devil – NOT A Troll Game* en Google Play: "hacete un juego 2D entero, completo, normal, vertical, agradable, animaciones stop motion, intro". Ver también: [juegos](juegos.md), [probar](probar.md), [morfi](morfi.md).

## El pedido y el tiro por la culata
- Original del género (se le dijo): plataformas donde el nivel cambia para matarte y se aprende muriendo. Grumo es un bollito de plastilina; el que hace trampa es el animador (su mano entra al set); cada muerte es una "toma" nueva con claqueta.
- Se le fue la mano a las pruebas: validar cada escena con el resolvedor y 100 intentos "como persona" llevó horas por escena. Se quejó: "te pedí un juego simple" (30/09/2026). Se cortó en 20 escenas (taller y cocina) en vez de 30 y se entregó.
- Lección: para él alcanza con que cada nivel se pueda ganar (el resolvedor, un comando) y una prueba de humo en Chromium. El ajuste fino, solo si lo pide.

## La plastilina en stop motion
- El mundo (grupos, mano, puerta, bolas) se mueve solo en los cuadros de 12 fps (cada 10 pasos de 1/120 s): lo que se ve es lo que choca. Grumo y los controles van a 120 pasos para que responda. → `grumo/js/partida.js`
- Bloques por contorno de regiones de celdas, borde que tiembla, bordes rectos donde se pegan (las trampas parecen parte del piso), relieve con sombra interna de 5 pasadas, huellas digitales, 2-3 variantes que "hierven". → `grumo/js/plastilina.js`
- Encima: grano de película, parpadeo de luz, viñeta. Los fondos pintados se desenfocan.

## Trampas como datos
- Cada trampa: `si` (zona, salta, suelo, pisa, tiempo, tras+espera, cerca+r, toma, mira) y `hace` (mover, caer, mostrar, ocultar, puerta, mano, bola, luz, nota, corte, temblor, vaiven, parar). `en` = segundos de demora, `pos` = dónde (bolas y notas). → `grumo/js/niveles.js`
- Una zona de disparo tiene que ir de arriba abajo (`[x0, 0, x1, 15]`): la 2-3 no mataba a nadie porque el que corría saltando pasaba por arriba de la zona (medido 30/09/2026).
- `bola` con `sale: 'puerta'`: la escupe la puerta, que se entreabre y queda cerrada mientras le queden bolas. Así el que llega corriendo no entra.
- Las bolas se aplastan contra la pared: si rebotan vuelven por la espalda y la escena se vuelve un malabar.

## Física y niveles (medido)
- Corre 5,60 celdas/s (tope en 0,083 s), salto 2,55 de alto y 0,675 s en el aire, largo 3,83, saltito 0,69.
- Saltar en el lugar una bola lenta es difícil: a 3,4 celdas/s la ventana es de ~0,16 s; a 4,5 celdas/s, ~0,34 s (se cae encima de la lenta al bajar).
- Un redondeo hacía que Grumo se golpeara la cabeza con el bloque de al lado al saltar pegado a una pared: se achican las consultas de choque por eje con un `EPS` (la 1-5 pasó de 52 % a 99 %).
- No poner plataformas justo arriba de otras: cabezazos. Dejar al menos una celda de hueco para subir.

## El resolvedor
- Búsqueda por jugadas (caminar, saltar, esperar… hasta aterrizar) con A*; paso a paso explota. `node grumo/pruebas/resolver.mjs --todos [--guiones] [--guardar]`.
- "Como persona": el guion escrito se juega con reacción tarde (0–0,06 s) y error de duración (±0,03 s).
- En la página, la partida corre durante la claqueta sin control (0,62 s): para reproducir un plan guardado hay que arrancar en el golpe. → `grumo/pruebas/humo.mjs`

## Entrega
- Archivo único de 258 KB sin red; página publicada en https://claude.ai/artifact/JqKib3w9uS1tR6JSxJJYZe (`python3 herramientas/pagina.py grumo <carpeta>`, entrada `'grumo'`).
- El set de noche (fondo, colores, música) está hecho sin escenas: `SETS` en `grumo/js/niveles.js` tiene solo dos.
