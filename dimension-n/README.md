# Dimensión Ñ

Un juego de caída, vertical, para el teléfono. Un viejo con un reactor, su
nieto atado con una soga y un pozo de 104 metros repartido en siete capítulos.
Lo único que hacés es empujar para un costado; el resto lo resuelve la física.

**Abrilo:** `dimension-n-en-un-archivo.html`, doble clic. 80 KB, sin servidor,
sin internet, sin instalar nada.

## Lo que tiene adentro

**Dos ragdolls de verdad.** Once puntos cada uno, unidos por huesos que no se
estiran, resueltos con **integración de Verlet**. No hay una sola animación: cada
pose que ves —Rilo cayendo de espaldas, Tito girando colgado de la soga— es la
física resolviéndose. Por eso los cuerpos nunca se ven "fuera de pose": no hay
poses.

**Todo dibujado con vectores.** No hay una sola imagen. Un brazo es una línea
gruesa entre el codo y la mano, el torso es un cuadrilátero entre los hombros y
las caderas, la cara mira para donde apunta el cuello. El dibujo sale de las
mismas articulaciones que la física, así que **lo que se ve y lo que choca son
siempre lo mismo**.

**Todo el sonido es sintetizado.** No hay un solo archivo de audio: un golpe es
ruido filtrado con una envolvente de sesenta milisegundos, y el zumbido del pozo
son dos osciladores desafinados que cambian de nota al cambiar de capítulo.

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
js/nivel.js     el pozo, los siete capítulos y la historia
js/juego.js     la partida: qué choca con qué y qué cuesta
js/dibujo.js    pintar el mundo
js/audio.js     los osciladores
js/main.js      bucle, entrada, pantallas
```

`js/juego.js` y todo lo que está abajo **no tocan el DOM**: la física corre
entera en Node. Por eso las pruebas la miden de verdad en vez de mirar capturas.

## Pruebas

```
sh pruebas/correr.sh
```

63 comprobaciones. Las que importan:

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
- **`un-archivo.mjs`** — abre el empaquetado desde `file://` y lo juega hasta el
  final.

## Los personajes

Rilo y Tito son **originales**. La idea —un abuelo científico insoportable, un
nieto ansioso, portales y dimensiones— es un homenaje declarado, pero los
diseños, los nombres, los diálogos y el mundo son propios: nada de esto copia a
nadie, y por eso puede vivir en un repositorio sin que lo bajen.
