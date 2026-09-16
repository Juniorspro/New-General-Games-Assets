# Dimensión Ñ

Un juego de caída, vertical, para el teléfono. Un viejo con un reactor, su
nieto atado con una soga y un pozo de 104 metros repartido en siete capítulos.
Lo único que hacés es empujar para un costado; el resto lo resuelve la física.

**Abrilo:** `dimension-n-en-un-archivo.html`, doble clic. 496 KB, sin servidor,
sin internet, sin instalar nada.

## Lo que tiene adentro

**Dos ragdolls de verdad.** Once puntos cada uno, unidos por huesos que no se
estiran, resueltos con **integración de Verlet**. No hay una sola animación: cada
pose que ves —Rilo cayendo de espaldas, Tito girando colgado de la soga— es la
física resolviéndose. Por eso los cuerpos nunca se ven "fuera de pose": no hay
poses.

**Los cuerpos son doce piezas colgadas de las articulaciones.** Cabeza, torso,
dos tramos de brazo y dos de pierna por personaje. Cada pieza se dibuja ENTRE
dos puntos de la física: se rota al ángulo del hueso y se estira a su largo. No
hay animaciones ni poses — como el hueso lo movió la física, el dibujo la sigue
solo, y **lo que se ve y lo que choca son siempre lo mismo**.

**Las piezas salen de cortar un dibujo, no de generarlas sueltas.** Se genera un
cuerpo entero por personaje en T-pose y se lo parte con `cortar_cuerpos.py`.
Pedirle a un modelo "un torso sin cabeza" devuelve un torso con un mechón de
pelo colgando del cuello, por más veces que se lo pidas: un torso suelto no es
una imagen que exista y el modelo empuja hacia lo que sí existe. Cortando un
cuerpo entero, las seis piezas salen limpias y además coherentes entre sí por
construcción — mismo trazo, mismos colores, mismas proporciones, porque son el
mismo dibujo. Y el esqueleto del juego se calcula MIDIENDO ese dibujo, así que
el muñeco armado tiene las proporciones de la ilustración y no las que alguien
tipeó.

**Si las imágenes no están, el juego se dibuja igual.** Arrancó siendo
vectorial y esa versión sigue entera: un brazo es una línea gruesa entre el codo
y la mano. Si una pieza no cargó, el muñeco sale con líneas y círculos en vez de
desaparecer.

**Los efectos son osciladores y las voces están pegadas en un solo mp3.** Un
golpe es ruido filtrado con una envolvente de sesenta milisegundos; el zumbido
del pozo son dos osciladores desafinados que cambian de nota por capítulo. Las
veintitrés líneas de diálogo van habladas en un único archivo con un índice de
posiciones: un pedido, una decodificación, y reproducir una línea es
`start(0, desde, largo)`. Las dos voces salen de una sola, separadas moviéndoles
el tono con ffmpeg.

**La soga.** Tito no es decoración: cuelga de Rilo con una restricción que solo
tira cuando se estira, así que es peso muerto que arrastra en las curvas y que
se lleva puesto lo que vos esquivaste.

## Cómo se juega

Tocá la pantalla donde sea: el reactor empuja **hacia tu dedo**, más fuerte
cuanto más lejos esté. El botón de abajo a la derecha —o un segundo dedo, o la
barra espaciadora— te hace **bolita**: el cuerpo se ovilla y el golpe se reparte
entre once puntos en vez de clavar la cabeza. Descuenta dos tercios del daño.

Al final de cada capítulo hay un portal con su propio piso: es la única salida,
es punto de guardado y te devuelve integridad.

## El código

```
js/verlet.js    el motor: puntos, palos, colisiones
js/cuerpo.js    el esqueleto de un ragdoll y cómo se dibuja
js/medidas.js   las proporciones, medidas del dibujo (lo escribe una herramienta)
js/voces.js     dónde está cada línea dentro del mp3 (ídem)
js/nivel.js     el pozo, los siete capítulos y la historia
js/juego.js     la partida: qué choca con qué y qué cuesta
js/dibujo.js    pintar el mundo
js/audio.js     los osciladores y el atlas de voces
js/main.js      bucle, entrada, pantallas
```

Las herramientas que hacen los assets:

```
generar_cuerpos.py    un cuerpo entero por personaje, en T-pose
cortar_cuerpos.py     lo parte en seis piezas y escribe js/medidas.js
generar_texturas.py   pared, repisa y soga
generar_voces.py      las 23 líneas, el atlas y js/voces.js
empaquetar.py         todo en un solo HTML
```

`js/juego.js` y todo lo que está abajo **no tocan el DOM**: la física corre
entera en Node. Por eso las pruebas la miden de verdad en vez de mirar capturas.

## Pruebas

```
sh pruebas/correr.sh
```

68 comprobaciones. Las que importan:

- **`fisica.mjs`** — 6000 cuadros de maltrato sin que ningún punto se vaya a
  infinito; ningún hueso se estira más del 15%; la soga no se estira nada; la
  velocidad de caída respeta su tope; hacerse bolita descuenta exactamente dos
  tercios; dos corridas idénticas dan el mismo resultado hasta el sexto decimal.
- **`nivel.mjs`** — barre el pozo cada 10 px y comprueba que **ninguna fila
  quede tapada**, y después **juega el nivel entero con la física de verdad**
  usando un piloto automático, para afirmar que se puede terminar en vez de
  suponerlo.
- **`movil.mjs`** — tres tamaños de pantalla: que entre, que los botones lleguen
  a 44 px y que el arrastre **llegue al juego** y no se lo quede el navegador.
- **`voces.mjs`** — que cada línea del juego tenga su voz, que ninguna dure lo
  que no puede durar (el generador devolvía treinta y ocho segundos para un
  "Sí.") y que ningún tramo del atlas se pise con el siguiente.
- **`un-archivo.mjs`** — abre el empaquetado desde `file://` y lo juega hasta el
  final.

## Los personajes

Rilo y Tito son personajes **generados a partir de una descripción escrita para
este juego**, con sus nombres, sus diálogos y su mundo propios. La idea —un
abuelo científico insoportable, un nieto ansioso, portales y dimensiones— es un
homenaje declarado.

Las voces son **sintetizadas** diciendo las líneas de `js/nivel.js`. No hay
audio sacado de ningún lado: no se bajó nada de TikTok ni de ninguna otra parte,
y no hay una sola grabación de nadie adentro de este repositorio.
