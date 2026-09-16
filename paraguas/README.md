# Paraguas

Un pozo sin fondo y un paraguas. **Dedo quieto** y el paraguas se cierra: caés
rápido y pasás por cualquier lado. **Arrastrando** se abre: caés lento y
maniobrás con precisión. Un dedo hace las dos cosas, y son dos gestos
distintos — mover la mano nunca te acelera.

Tres idiomas (inglés, español, portugués) y pregunta cuál la primera vez.
Eso es todo el juego.

**Abrilo:** `paraguas-en-un-archivo.html`, doble clic. 159 KB, sin servidor, sin
internet, sin instalar nada.

## La mecánica

El ancho del paraguas **es la caja de choque**. Abierto mide 52 px y cae a 4,3;
cerrado mide 15 y cae a 13,5. Los huecos del pozo deciden cuál necesitás, y cada
uno se paga con el otro: el hueco angosto no te deja pasar abierto, así que hay
que cerrar, y cerrando tenés un tercio del tiempo para acomodarte.

El puntaje son los **metros**, y los metros los ganás cayendo. Así que cerrar no
es sólo para pasar: es la única forma de bajar rápido. El juego te ofrece todo
el tiempo el mismo trato y vos decidís cuánto lo aceptás.

## El control

**Tocar cierra el paraguas. Arrastrar te mueve.** Son dos cosas separadas y
tienen que serlo: cerrar es lo que hacés todo el tiempo, y si tocar te llevara
hasta el dedo, no podrías caer rápido sin correrte de lugar. Al apoyar, la
posición del dedo queda como cero y lo que cuenta es cuánto lo corriste desde
ahí — apoyar y no mover cierra el paraguas y nada más.

Soltando, el paraguas se abre y **planeás con lo que traías**: no se frena de
costado. Si soltar cortara también el envión lateral no habría forma de
corregir cayendo lento.

Y hay una válvula que sale sola del propio retardo del paraguas: **tarda nueve
cuadros en cerrarse**, así que un toquecito corto te deja apuntar sin llegar a
cerrarlo. Apretones largos para bajar, toquecitos para acomodarte.

## Lo que hay abajo

`js/pozo.js` genera para siempre, y **cada hueco se coloca dentro de lo que se
puede alcanzar desde el anterior**. No es un detalle de balance: un generador
infinito falla poniendo dos huecos que no se alcanzan, y eso no se ve como un
error — se ve como que perdiste otra vez, y le echás la culpa a tus dedos.

El alcance se mide **siempre con el paraguas cerrado**, sea la fila que sea, y
eso sale del control: el dedo apunta y cierra a la vez, así que hay dos formas
de correrse de costado y dan casi lo mismo por metro —apretado se maniobra a 5,4
cayendo a 13,5 (0,40·dy), flotando se maniobra mejor pero el dedo sólo está
apoyado un cuarto del tiempo (0,25·dy)—. La primera versión medía con el
paraguas abierto sin descontar los toquecitos y le atribuía al jugador 0,93·dy,
casi cuatro veces lo que puede: un piloto libre bajaba 778 m y el que usa el
control de verdad, 129.

## El código

```
js/mundo.js     las constantes, que son el juego
js/pozo.js      el generador infinito y la regla de alcance
js/juego.js     la caída, los choques y el puntaje
js/heroe.js     el rig del cuerpo colgado del paraguas, y su dibujo
js/dibujo.js    el pozo, las rayas de velocidad, los tramos
js/audio.js     osciladores: el viento sigue a la velocidad de caída
js/main.js      bucle, entrada, pantallas
generar_arte.py el paraguas abierto y cerrado
empaquetar.py   todo en un solo HTML
```

El cuerpo **no es un ragdoll**, a propósito: este juego se gana pasando por
huecos de veintisiete píxeles cayendo a trece por cuadro, y la caja de choque
tiene que ser exacta. Lo que sí hay es una cadena de resortes que cuelga del
paraguas y no toca la física: cuando te corrés de golpe, el cuerpo se queda
atrás y después alcanza; cuando caés rápido, el viento te levanta las piernas.

## Pruebas

```
sh pruebas/correr.sh
```

47 comprobaciones. Las que importan:

- **`pozo.mjs`** — que el pozo **se pueda bajar**. Dos cosas por separado: que
  cada par de huecos esté dentro de lo que se corre en el tiempo que dura la
  caída entre ellos (cien mil metros, ocho pozos distintos, con la misma cuenta
  que usa el generador pero sin su margen), y que un piloto automático baje de
  verdad jugándolo. Hay dos pilotos: uno libre, que prueba la geometría, y otro
  atado al control real de un dedo, que prueba que se pueda jugar. El primero
  baja 811 m de promedio y el segundo 520: esa diferencia es la habilidad que
  el juego pide.
- **`movil.mjs`** — tres tamaños de pantalla, y sobre todo que el dedo **llegue
  al juego** y no se lo quede el navegador. Acá el dedo es el juego entero: un
  toque que no llega no es un detalle de interfaz, es no poder jugar. También
  afirma la separación de las dos acciones: tocar y sostener quieto cierra el
  paraguas y **no** mueve; arrastrar sí mueve.
- **`un-archivo.mjs`** — abre el empaquetado desde `file://`, cae, choca y
  termina.

## El vestido

El menú y la pantalla final no tienen fondo propio: atrás corre **una caída de
verdad**, con el piloto automático —el mismo que valida el pozo— y el lienzo
desenfocado por CSS. No es un video ni una imagen, cuesta lo que cuesta un
cuadro del juego, y nunca se desactualiza: si cambia el color de un tramo o la
forma de una viga, el menú cambia solo. Arranca a una profundidad al azar, así
que el fondo es distinto cada vez que abrís el juego.

El botón de caer es un **portal**: dos remolinos girando en sentidos opuestos,
hechos con un `conic-gradient` y una máscara. Cero imágenes, cero kilobytes.

## Los personajes

Rilo es el mismo personaje del otro juego de este repositorio: generado a partir
de una descripción escrita para estos juegos. La idea es un homenaje declarado;
los diseños, los nombres y el mundo son propios.
