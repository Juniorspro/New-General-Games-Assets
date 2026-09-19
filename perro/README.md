# CAMPO — un perro en tercera persona

Un perro 3D en un campo con lomas y pasto al viento. Joystick para andar, más
fuerte para correr, y un botón para ladrar.

    python3 -m http.server 8811     # y abrir http://127.0.0.1:8811
    sh pruebas/correr.sh            # 17 comprobaciones
    python3 empaquetar.py           # arma campo-en-un-archivo.html (2,4 MB)

---

## El perro

Generado con Rezona en cuatro pasos, no en uno:

1. **Una imagen de referencia** de frente y de perfil, con las cuatro patas
   separadas y fondo blanco. La lección está anotada en el repo: imagen→3D es
   mucho más dirigible que texto→3D, y las piezas finas (patas, cola) se pierden
   si el generador tiene que adivinar cuántas son.
2. **El modelo** a partir de esa imagen: 501.992 vértices y **29 MB**.
3. **El esqueleto**, que devolvió `preset:quadruped:walk` con 72 canales — o sea
   que el riggeo automático **sí acepta cuadrúpedos**, cosa que no era obvia: la
   nota del repo decía que había funcionado sobre un humanoide.
4. **La reducción para web**: `simplify --ratio 0.04` → `resize 1024` → `webp 78`
   → `prune` → `quantize`. De **39 MB a 1,14 MB** conservando el esqueleto y la
   animación, con 26.690 vértices.

### Caminar y correr

**El servicio devuelve una sola animación.** Se pidieron `walk`, `run` e `idle`
en tres llamadas separadas y las tres volvieron con el mismo
`preset:quadruped:walk` (comprobado con `gltf-transform inspect` sobre los tres
archivos). No hay clip de correr y no lo va a haber.

Correr no es caminar rápido: acelerando sólo el clip, el perro mueve las patitas
a toda velocidad con la misma zancada corta y parece una película pasada de
rosca. Lo que cambia de verdad al correr es que la **zancada se abre**, el cuerpo
rebota más y el bicho se inclina. Así que el correr se arma *sobre* el clip de
caminar: se acelera, y además se extrapola la rotación de los huesos de las
patas más allá de donde el clip los manda (`slerp` con factor 1,55). Como sale
del mismo movimiento, las patas siguen cayendo en la misma fase.

Qué huesos son patas **se mide**, no se supone: los que en reposo caen en la
mitad de abajo de la caja del bicho. Los nombres del preset no son fiables.

Y hay un **segundo camino completo**: si el GLB llegara sin esqueleto,
`perro.js` le arma uno — reparte los vértices en siete regiones por su posición,
crea un hueso por región, pinta los pesos con suavizado en las uniones y produce
una `SkinnedMesh` de verdad que se anima con senos y cosenos, en trote cruzado.
No se usa hoy, y existe porque un perro deslizándose con las patas tiesas se ve
peor que cualquier otra cosa del juego.

### Dos números que salen de mirar, no de suponer

`pruebas/orientar.mjs` renderiza el modelo a ocho ángulos en una hoja:

- **hacia dónde mira** — a 0 rad ya mira adelante, así que el giro es 0;
- **en qué punta está la cabeza** — en el extremo mayor del eje largo.

El segundo es el que muerde: sin él, el rig le pone la cabeza a la cola y el
perro camina con el culo adelante moviendo las orejas. Como la silueta es casi
simétrica de lejos, en una captura no se ve.

---

## El campo

**Las lomas y la altura del perro salen de la misma rejilla.** La tentación es
tener una función `altura(x,z)` y usarla en dos sitios: para levantar los
vértices y para apoyar al perro. Eso está mal — la malla es plana entre vértice
y vértice, así que en medio de un cuadro la superficie que se ve está por debajo
de lo que dice la función, y el perro flota en las lomas. Acá el ruido se evalúa
una vez por vértice y `altura()` devuelve la interpolación bilineal de esa misma
rejilla. **Medido: el peor despegue sobre 600 puntos al azar es 0.**

### El bug que casi no se ve

La primera versión del hash del ruido multiplicaba con `*` y constantes de 64
bits. En JavaScript los números son coma flotante: cualquier producto de dos
enteros grandes se pasa de los 53 bits exactos y redondea justo los bits de
abajo, que son los que un hash usa. El resultado no fue un error: el ruido
devolvía casi siempre lo mismo, **el campo salía plano** y el perro aparecía a
-7,4 en todos lados. Un campo plano se ve como un campo. Se encontró midiendo la
altura en dos puntos lejanos y viendo que daba el mismo número; se arregló con
`Math.imul`.

### El pasto

Una sola `InstancedMesh` y el vaivén en el shader del vértice: moverlas desde el
bucle obliga a tocar decenas de miles de matrices por cuadro. Cada instancia es
un **matojo de tres hojas**, no una hoja suelta — agregar triángulos dentro de la
instancia es casi gratis (la geometría se sube una vez), mientras que subir la
cuenta de instancias es lo caro.

La densidad sale de una cuenta: matas / (π·radio²). Con radio 62 daba **una mata
por metro cuadrado** y el campo se veía de juncos sueltos; con radio 30, las
mismas matas dan **dieciséis**. Lo que queda más lejos lo tapa la niebla, que
empieza justo donde el pasto termina para que el corte no se vea.

Cuántas matas se decide mirando el aparato (núcleos, memoria, si es táctil):
**28.520 en escritorio, 11.978 en configuración táctil**, medido.

### El cielo y las sombras

El cielo es la imagen equirectangular generada, llevada a 2:1 exacto y con la
costura cerrada por fundido — si los bordes no coinciden se ve una línea
vertical justo cuando girás la cámara. La caja de sombra del sol mide 26
unidades y **sigue al perro**: una caja que cubriera las 260 del campo repartiría
los 2048 píxeles del mapa entre todo y la sombra saldría como un borrón.

---

## El sonido

**El generador de audio de Rezona estuvo caído toda la sesión.** Se pidieron
música de menú, de caminar, de correr y dos ladridos; los cinco fallaron con
"servicio temporalmente no disponible", y se reintentaron en rondas durante ~40
minutos sin éxito. `js/audio.js` tiene los dos caminos y **hoy suena el
sintetizado**: es exactamente el caso para el que esa capa existe.

El ladrido sintetizado no es un bip: es un tono que cae pasado por un pasabanda
que se cierra — un filtro que se abre y se cierra es lo que convierte un tono en
una vocal; sin eso suena a bocina.

El día que el generador vuelva, alcanza con dejar los `.mp3` en `assets/` y las
muestras pisan a la síntesis sin tocar una línea.

### Los niveles, medidos

Con el analizador colgado del maestro:

    fondo en partida   rms 0,0166
    ladrido            rms 0,0379   = 2,28x el fondo
    fondo en el menú   rms 0,0335   (el doble que en partida: no compite con nada)

El ladrido tiene que ganarle al fondo porque es el único acuse de recibo del
único botón del juego; si la música lo tapa, el botón parece roto. En la primera
medición empataban (0,99x) y hubo que bajar el fondo y subir el ladrido.

**Y hubo que arreglar el instrumento, no sólo el sonido.** El analizador se lee
al ritmo del dibujo, y con la tarjeta por software un cuadro tarda entre 250 y
500 ms: un ladrido dura 190 ms y caía entero entre dos lecturas. La medición
decía 1,39x cuando lo que fallaba era que no lo veía. Se agregó una sonda que
frena el dibujo mientras se mide.

---

## Dos pruebas que estaban mal y parecían bugs

- **"Diez toques seguidos dan siete ladridos".** El rebote funcionaba bien: los
  toques no iban cada 30 ms sino cada 245–553 ms, porque `setTimeout(30)` con la
  página dibujando se estira. Los diez ocupaban 3,7 segundos. Se corrigió la
  prueba para que dispare los diez en el mismo turno; ahora da 1.
- **"Pide archivos sueltos".** Eran `blob:` que fabrica el cargador de GLB a
  partir del propio data URI embebido. No son pedidos externos.

## Un bug que no se ve mirando

Una `url()` adentro de una variable CSS **no se resuelve contra el documento**:
se resuelve contra la hoja de estilo donde la variable se usa. Como la hoja vive
en `css/`, `assets/banner.webp` se convertía en `css/assets/banner.webp` y daba
404 — sin romper nada, porque el banner tiene un color de respaldo y la tarjeta
se veía entera igual.

---

## Rendimiento

CPU por cuadro (paso del juego + envío del dibujo): **0,313 ms** con 28.520
matas. **Lo que no está medido es la GPU**: el navegador de las pruebas dibuja
por software, así que el costo de rellenar píxeles no se puede medir acá y no se
va a afirmar. Los ajustes que sí están puestos para eso: píxel ratio tapado en
2, el pasto sin sombras, tres luces y una sola llamada de dibujo para todo el
pasto.

## El menú

El banner es una imagen de verdad, generada **desde la misma referencia** con la
que se hizo el modelo 3D, así que es el mismo perro. La tarjeta va abajo y no al
medio: centrada tapaba justo al perro, que es lo único que el menú tiene para
mostrar — detrás corre la cámara dando una vuelta lenta alrededor de él.

Los destellos son dos capas de gradientes repetidos y **cero nodos**: la versión
con divs pedía treinta elementos animados encima de una escena 3D, que es
justamente donde no sobra cuadro. Con `prefers-reduced-motion` no queda nada
moviéndose solo.

## Los personajes

El perro es un **diseño original**, generado desde cero. No copia a ningún
personaje de otra serie ni de otro juego.
