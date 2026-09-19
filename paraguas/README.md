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

112 comprobaciones. Las que importan:

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



## Las skins

**34: una de fábrica, 30 con chatarra y 3 con dinero real.**

Las treinta se hacen con código y **pesan cero**. Treinta dibujos nuevos serían
medio megabyte adentro del archivo único —más que el juego entero— y encima
treinta personajes que no se parecen entre sí. Cada skin es una tabla: de qué
color se tiñe cada pieza del muñeco, qué accesorio vectorial lleva en la cabeza,
qué aura deja atrás y de qué color queda el paraguas. Diez accesorios, siete
auras y una paleta alcanzan, y el muñeco sigue siendo el mismo muñeco — que es
lo que hace que una skin se lea como la misma persona disfrazada.

Teñir usa el modo `color`, que reemplaza el matiz pero **deja la luminosidad**:
las sombras, los pliegues y el contorno negro siguen ahí. Pintando liso, cada
pieza queda una mancha plana con forma de brazo. Y se tiñe **una vez y se
guarda**: la receta son tres operaciones de lienzo por pieza, y hecha en cada
cuadro son mil seiscientas por segundo para dibujar siempre lo mismo.

**Los precios salen de una medición.** Un robot con el control de verdad junta
190 monedas en 66 segundos; una persona junta del orden de cien por minuto. Con
eso una común son cinco minutos y una legendaria son entre siete y veinte horas.
Juntarlas todas son **614.850 monedas ≈ 102 horas**. Están caras a propósito:
una tienda donde todo se compra en una tarde deja de ser una tienda a la tarde
siguiente.

### Las tres pagas

Son las únicas con **dibujo propio** —paraguas y cabeza generados, no el muñeco
base teñido— y esa es exactamente la razón por la que se pueden cobrar aparte:
lo que se paga es algo que el juego no puede generar solo. Una skin paga que
fuera "las mismas piezas pero doradas" sería cobrar por un número más alto.

**`js/compras.js` hoy no cobra nada, y eso es a propósito.** El juego no sabe de
plata: pregunta si hay tienda, pregunta si la skin está paga, y llama a
`comprar()`. Sin nada conectado, el botón dice "no disponible", no se cobra, no
se pide ningún dato y **no se desbloquea nada**. Un botón que simula una compra
y entrega la skin igual es una mentira que además arruina la economía.

Para conectarla, hay que darle un objeto con tres funciones antes de que arranque
el juego:

    window.PARAGUAS_COMPRAS = {
      async catalogo(ids)  → [{ id, precio: "US$ 2,99" }]
      async comprar(id)    → { ok: true } | { ok: false, motivo }
      async restaurar()    → [ids ya comprados]
    }

`id` es el `producto` de la skin (`paraguas.skin.cromo`, `…magma`, `…vacio`), que
es el mismo identificador que hay que dar de alta en Google Play o App Store.
Del lado del juego no hay nada más que hacer.

**Tres cosas que este archivo no hace, y no las tiene que hacer:** no ve datos de
pago (eso es de la tienda del teléfono, que es la única que puede), no sabe de
precios (los muestra tal como se los da la tienda, porque dependen del país y de
la moneda), y **no valida el recibo**. Lo que marca como comprado vive en el
aparato y se puede editar a mano: para una tienda de verdad, la validación va del
lado del servidor y `restaurar()` tiene que consultarlo.

## El sonido

**Dos cosas distintas, y a propósito.** En el menú suena un tema grabado; en el
juego la música **se toca sola** con osciladores y no se repite nunca.

El modelo de música da treinta segundos como techo y en la práctica devolvió
nueve, de donde sale un bucle de cinco o seis. Eso en un menú no molesta —nadie
se queda diez minutos mirando un menú— y da una atmósfera que un puñado de
osciladores no da. Abajo de una partida de tres minutos, en cambio, es una
tortura: se escucha la costura treinta y seis veces. Así que la música del juego
es un secuenciador: una progresión de acordes, un bajo, un arpegio y percusión
de ruido, con la densidad, el filtro y el bombo atados a **cómo venís jugando**.
La música no acompaña al juego, lo informa — igual que el viento. Y no pesa
nada: cero archivos.

**La música se apaga aparte de los efectos**, porque son dos molestias
distintas: la música cansa a la décima partida y los efectos no, y un efecto es
información mientras la música es decoración.

---

# La fluidez: por qué iba lag y qué se hizo

## Primero, medirlo bien

El primer intento de medición dio **0,1 ms por cuadro** con el juego yendo a
cuarenta cuadros por segundo — o sea que mentía. Las órdenes de canvas no se
ejecutan cuando se las llama: se encolan, y `performance.now()` alrededor de un
`drawImage` mide cuánto cuesta **pedir** el dibujo, no hacerlo. Leyendo un píxel
con `getImageData` al final se obliga a que todo lo pedido esté hecho, y recién
ahí el número sirve.

## Lo que se encontró

Con el reloj arreglado, el costo del dibujo por cuadro:

| densidad de pantalla | píxeles del lienzo | antes | después |
|---|---|---|---|
| 1x | 412×892 | 4,52 ms | **3,14 ms** |
| 2x | 824×1783 | 15,50 ms | **11,01 ms** |
| 3x | 1030×2229 | 24,53 ms | **16,46 ms** |

El costo se multiplicaba por **cinco** cuando los píxeles se multiplicaban por
seis, pero partiendo de un número ya alto. Tres causas, todas por cuadro:

1. **Un `globalCompositeOperation = "color"` a pantalla completa.** Ese modo no
   es un relleno: para cada píxel convierte el color de abajo a HSL, le cambia
   el matiz y lo vuelve a RGB. En una pantalla de 3x son 2,3 millones de píxeles
   con esa cuenta, sesenta veces por segundo. Ahora el matiz se le aplica **a la
   textura**, una vez por color, y queda guardado.
2. **`createPattern` en cada cuadro** para la pared, y **una vez por viga
   visible** para las repisas — entre cinco y diez por cuadro. El patrón no
   depende de nada que cambie: se hace una vez.
3. **Un degradé nuevo por cuadro** para el cielo, cuando sus dos colores son los
   mismos durante el 88 % de cada tramo.

El aspecto no cambió: comparando el **mismo cuadro congelado** antes y después,
la pared difiere como máximo **9 sobre 255**, o sea menos del 4 %.

## Y lo que de verdad arregla "va lag en MI teléfono"

Bajar de 24 a 16 ms está bien, pero sigue siendo mucho para un teléfono, que
además tiene un procesador más lento que la máquina donde se mide. Y no hay
forma honesta de preguntarle a un aparato cuánto puede.

Lo que sí se puede es **mirar cuánto está tardando y bajar la resolución hasta
que entre**. El juego mide la mediana de sus últimos treinta cuadros —la
mediana y no el promedio, porque un solo cuadro de 300 ms no dice nada de cómo
va el juego— y ajusta la densidad de dibujo en cinco escalones.

**Baja rápido y sube despacio, y no es simétrico a propósito.** Bajar tarde se
siente como un juego roto durante todo el rato que tarda; subir rápido hace que
la imagen cambie de nitidez cada dos por tres, que se ve peor que quedarse un
rato de más en la calidad baja.

Comprobado frenando el procesador con el protocolo de depuración, que es lo más
parecido a un teléfono barato que se puede hacer desde una computadora:

- con la máquina libre se queda en la mejor calidad;
- **con el procesador frenado seis veces baja sola y pasa de 16,9 a 30,8 cuadros
  por segundo**;
- y una vez acomodada **se queda quieta** — se miró ocho veces a lo largo de
  diez segundos y no se movió.

El tope base también bajó de 2,5x a 2x: de 2 para arriba la diferencia no se ve
en un dibujo de trazo grueso, y son un 36 % menos de píxeles que pintar.

## Una prueba que fallaba una de cada seis veces

`un-archivo.mjs` comprobaba que la barra espaciadora cierra el paraguas y
acelera, y a veces daba `vy=-2.2`. El paraguas **sí** se cerraba: lo que pasaba
es que en esos 500 ms el jugador chocaba una viga y rebotaba para arriba. No era
el juego, era que la prueba dejaba la caída librada a donde cayera. Ahora se lo
alinea con el hueco de la próxima viga antes de apretar. Ocho corridas seguidas
en verde.
