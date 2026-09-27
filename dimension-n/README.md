# Dimensión Ñ

Dos juegos con la misma física, verticales, para el teléfono. Un viejo con un
reactor y su nieto atado con una soga.

**El pozo** — 104 metros en siete capítulos. Lo único que hacés es empujar para
un costado; el resto lo resuelve la física. La pregunta es *¿llego?* y se
contesta con los reflejos.

**Portales** — quince niveles de pantalla fija. Disparás portales a las paredes
y te tirás por uno para salir por el otro. No hay reloj: la pregunta es
*¿por dónde?* y hasta que no se te ocurre, no pasa nada.

**Abrilo:** `dimension-n-en-un-archivo.html`, doble clic. 805 KB, sin servidor,
sin internet, sin instalar nada. En castellano, inglés o portugués (lo pregunta
en cada arranque) y con el teléfono parado o acostado.

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

**Los efectos son grabaciones y las voces están pegadas en un solo mp3.** Los
golpes, las púas, el resorte, la chatarra, el reactor y el viento de la caída
son grabaciones CC0 (ver *Sonidos*); los osciladores de antes quedan de
respaldo mientras se decodifican. El zumbido del pozo sigue siendo dos
osciladores desafinados que cambian de nota por capítulo. Las veintitrés líneas de diálogo van habladas en un único archivo con un índice de
posiciones: un pedido, una decodificación, y reproducir una línea es
`start(0, desde, largo)`. Las dos voces salen de una sola, separadas moviéndoles
el tono con ffmpeg.

**La soga.** Tito no es decoración: cuelga de Rilo con una restricción que solo
tira cuando se estira, así que es peso muerto que arrastra en las curvas y que
se lleva puesto lo que vos esquivaste.

## Cómo se juega

**En el pozo:** tocá la pantalla donde sea y el reactor empuja **hacia tu
dedo**, más fuerte cuanto más lejos esté.

**En portales:** un toque corto **dispara** hacia donde tocaste; mantener el
dedo y moverlo es el reactor. Lo que distingue un disparo de un empujón es el
gesto, no en qué mitad de la pantalla lo hiciste — partir la pantalla en dos
era lo obvio y es peor, porque la mitad de las paredes te quedan del lado que
no dispara. Las paredes azules aceptan portal, las negras lo rebotan, y el
techo y el piso siempre aceptan: es la salida cuando un tabique te tapa todo lo
demás. Las placas se aprietan con **peso**, y vos tenés uno colgando. El botón de abajo a la derecha —o un segundo dedo, o la
barra espaciadora— te hace **bolita**: el cuerpo se ovilla y el golpe se reparte
entre once puntos en vez de clavar la cabeza. Descuenta dos tercios del daño.

Al final de cada capítulo hay un portal con su propio piso: es la única salida,
es punto de guardado y te devuelve integridad.

## El teléfono acostado: el juego no se acuesta

El juego es vertical. Con el teléfono parado no se gira nada. Con el teléfono
**acostado** (táctil, ancho mayor que alto y menos de 560 px de alto) el juego
se gira −90° —o +90°, según para qué lado se acostó, leído de
`screen.orientation.angle`— y queda "pegado" al teléfono como una app que sólo
anda vertical: se juega de costado usando la pantalla entera (390×844 lógicos
en vez de una franja de 251×390). Sin pantalla completa y sin
`screen.orientation.lock`. En una tableta acostada (560 px de alto o más) el
juego ya entra derecho y no se gira. Todo está en `js/giro.js`; el dedo se lee
con `offsetX/offsetY`, que ya vienen en coordenadas del lienzo girado, y las
media queries se cambiaron por las clases `bajo`/`medio` que calcula JS.

## Idiomas y menú

`js/idioma.js` tiene `TEXTOS = {es, en, pt}` y `t(clave, vars)`. Lo que dicen
Rilo y Tito en castellano sale de `nivel.js` y `mapas.js` (la misma fuente que
usa `generar_voces.py`); en inglés y portugués se traducen los subtítulos y
las voces siguen en castellano (se pueden apagar en Opciones). La pantalla de
idioma sale en cada arranque, con la elección anterior marcada y con foco.

El menú tiene cinco pestañas: **Jugar** (elige entre el pozo y portales, cada
uno con su progreso: tramos del pozo alcanzados, niveles resueltos, "Seguir"),
**Récords** (mejor caída, chatarra, capítulo más hondo, bajadas, llegadas,
desarmes, portales resueltos, tiros), **Opciones** (sonido, volumen de efectos
y de música, voces, idioma, borrar con dos toques), **Cómo** y **Créditos**.

## Sonidos

Las grabaciones están en `sonidos/dimension-n/` (receta reproducible en
`sonidos/dimension-n/procesar.py`, manifiesto con licencia, autor y nota de
cada una) y entran al juego en `js/sonidos.js`, en base64, generado con
`python3 sonidos/incrustar.py dimension-n dimension-n/js/sonidos.js`. Todas
son **CC0**: Kenney (impact-sounds, sci-fi-sounds, music-jingles, ui-audio),
rubberduck (100 CC0 SFX, el resorte) y SketchMan3 (el viento), de OpenGameArt.

| evento | grabación | nota |
|---|---|---|
| golpe / golpe fuerte | impactPunch_medium / _heavy (Kenney) | golpe contra un cuerpo |
| púas | impactMetal_medium (Kenney) | aproximación: metal que se clava |
| resorte | spring_01 (rubberduck) | resorte real |
| chatarra | impactTin_medium (Kenney) | lata golpeada |
| placa de portales | impactMetal_heavy (Kenney) | aproximación |
| portal / disparo / desarme | forceField, laserSmall, explosionCrunch (Kenney sci-fi) | diseñados, no grabados |
| ganar | jingles_SAX07 (Kenney) | música |
| menú | click2 (Kenney ui-audio) | |
| reactor (loop) | thrusterFire_001 (Kenney sci-fi) | diseñado, sube con el empuje |
| viento de la caída (loop) | wind woosh loop (SketchMan3) | sube con la velocidad |
| zumbido del pozo | — | sigue sintetizado a propósito |

## El código

```
js/verlet.js    el motor: puntos, palos, colisiones
js/cuerpo.js    el esqueleto de un ragdoll y cómo se dibuja
js/medidas.js   las proporciones, medidas del dibujo (lo escribe una herramienta)
js/voces.js     dónde está cada línea dentro del mp3 (ídem)
js/nivel.js     el pozo, los siete capítulos y la historia
js/portales.js  el otro modo: grilla, disparos y el cruce
js/mapas.js     los 15 niveles de portales (lo escribe una herramienta)
js/juego.js     la partida: qué choca con qué y qué cuesta
js/dibujo.js    pintar el mundo
js/audio.js     las grabaciones, los osciladores de respaldo y el atlas de voces
js/sonidos.js   las grabaciones en base64 (lo escribe sonidos/incrustar.py)
js/giro.js      el giro con el teléfono acostado
js/idioma.js    los textos en los tres idiomas
js/main.js      bucle, entrada, menú y pantallas
```

Las herramientas que hacen los assets:

```
generar_cuerpos.py    un cuerpo entero por personaje, en T-pose
cortar_cuerpos.py     lo parte en seis piezas y escribe js/medidas.js
generar_texturas.py   pared, repisa y soga
generar_voces.py      las 23 líneas, el atlas y js/voces.js
armar_mapas.py        los 15 niveles de portales, validados al salir
empaquetar.py         todo en un solo HTML
```

`js/juego.js` y todo lo que está abajo **no tocan el DOM**: la física corre
entera en Node. Por eso las pruebas la miden de verdad en vez de mirar capturas.

## Pruebas

```
sh pruebas/correr.sh
```

189 comprobaciones. Las que importan:

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
- **`portales.mjs`** — que los quince niveles **se puedan pasar**. Un nivel de
  puzzle sin solución se ve perfecto: no hay nada raro en la pantalla y no tira
  ningún error, el jugador se queda ahí para siempre creyendo que es malo. Así
  que se juega cada uno con la física de verdad, reproduciendo la solución que
  encontró `buscar_soluciones.mjs` probando dos disparos en cuarenta y ocho
  direcciones y tres formas de moverse. Y también lo contrario: que **ninguno se
  gane sin disparar un portal**, porque un nivel que se pasa caminando no es un
  nivel fácil, es un nivel que no está. Dos cayeron en esa: se rediseñaron.
- **`voces.mjs`** — que cada línea del juego tenga su voz, que ninguna dure lo
  que no puede durar (el generador devolvía treinta y ocho segundos para un
  "Sí.") y que ningún tramo del atlas se pise con el siguiente.
- **`un-archivo.mjs`** — abre el empaquetado desde `file://` y lo juega hasta el
  final.
- **`idiomas.mjs`** — los tres idiomas con las mismas claves y los mismos
  huecos `{var}`, y cada línea de diálogo y cada nivel traducidos.
- **`giro-idioma.mjs`** — el archivo único con la red cortada, en compu
  (1200×680), teléfono acostado (844×390, girado) y parado (390×844), en los
  tres idiomas: pantalla de idioma, las cinco pestañas, que se decodifiquen
  las 21 grabaciones, que un dedo puesto en un punto del juego llegue a ese
  punto (reactor y disparo de portal, error menor a 1,5 px) y el final.
  `node pruebas/giro-idioma.mjs carpeta` además saca las fotos.

## Los personajes

Rilo y Tito son personajes **generados a partir de una descripción escrita para
este juego**, con sus nombres, sus diálogos y su mundo propios. La idea —un
abuelo científico insoportable, un nieto ansioso, portales y dimensiones— es un
homenaje declarado.

Las voces son **sintetizadas** diciendo las líneas de `js/nivel.js`. No se bajó
ninguna voz de TikTok ni de ninguna otra parte, y no hay una sola grabación de
una persona adentro de este repositorio: las grabaciones de los efectos (ver
*Sonidos*) son golpes, resortes y viento, todas CC0.
