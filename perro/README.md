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

### Caminar: se usa el rig propio, y eso se decidió mirando

**El riggeo automático funciona, pero la caminata que devuelve está mal.** Se le
abren las patas como tijeras, la rodilla delantera dobla para el lado que no
dobla en un perro, y el cuerpo se despega del piso en media pasada. Se
renderizaron los dos ciclos cuadro por cuadro **con el mismo modelo** y no hay
discusión.

Así que el juego carga el modelo **sin** esqueleto y usa el rig armado en
`perro.js`: reparte los vértices en siete regiones por su posición, crea un
hueso por región, pinta los pesos con suavizado en las uniones y produce una
`SkinnedMesh` de verdad que trota en diagonal, con el lomo rebotando al doble de
frecuencia que las patas. El camino del clip queda escrito y funcionando: el día
que el preset mejore, alcanza con volver a hornear el GLB riggeado.

De paso pesa menos: 874 KB en vez de 1,14 MB.

### Cómo se pensó el correr (el camino del clip, hoy sin usar)

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

## El perro apoyaba mal, y tres sondas mintieron antes de encontrarlo

El perro salía **enterrado hasta la panza**. Lo que costó encontrarlo no fue el
arreglo, fueron las mediciones:

1. La primera sonda comparaba `pivote.position.y` con `altura(x,z)` **justo
   después de que el código le asignara uno al otro**. Una tautología: daba 0
   siempre y decía "el perro apoya sobre el suelo" con el perro bajo tierra.
2. La segunda usaba `Box3.setFromObject`. Sobre una malla con esqueleto eso
   devuelve la caja de la **pose de enlace**, no la del bicho animado: three
   transforma la caja de la geometría y no toca los huesos. Los números subían y
   bajaban sin relación con lo que se veía.
3. Recién una vista de costado, sin pasto, mostró el problema de verdad.

El arreglo tiene tres partes, todas medidas:

- **Se calibra dónde están las patas** recorriendo la malla ya deformada por sus
  huesos, en doce fases de la animación, y buscando el punto más bajo de todos.
  Ese es el piso del modelo.
- **Se muestrea el suelo en ocho puntos** bajo la huella, no en uno: con un solo
  punto, en una loma el centro está más alto que las puntas y las patas de
  adelante quedan enterradas.
- **Se descuenta lo que baja la propia inclinación.** Girar al perro sobre su
  base sube una punta y baja la otra; con el tope de inclinación y medio perro
  de largo, una esquina llega a bajar 0,31 — más que todo lo ganado antes.

Medido sobre los vértices deformados: **0,004 de hundimiento promedio y 0,055 en
el peor caso**, sobre un perro de 1,44 de alto y con el pasto midiendo 0,34. El
peor caso queda tapado por el pasto.

## El joystick estaba en coordenadas del mundo

Arriba en la pantalla es hacia donde mira **la cámara**, no el eje +Z del mundo.
Tomando el eje del mundo, el control anda bien mientras no gires y se da vuelta
en cuanto el perro encara para el otro lado: empujar arriba lo trae hacia vos.

Ahora el rumbo del dedo se suma al de la cámara. Comprobado midiendo lo único
que importa —que empujando arriba el perro se **aleja** de la cámara— también
**después de darse media vuelta**, que es justo donde el control viejo se
invertía.

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

**El generador de efectos de audio de Rezona está caído.** Se pidieron tres
ladridos, jadeo, pasos y tres pistas de música, en varias tandas a lo largo de
dos horas. Todos los pedidos se **aceptan** y después fallan con "servicio
temporalmente no disponible". No es un límite de envíos ni un problema del
pedido: una prueba suelta de un solo ladrido llegó a `generating` y también
falló. Lo que sí responde es `kind: "speech"`, así que lo caído es el backend de
efectos y música, no Rezona entero.

`js/audio.js` tiene los dos caminos y **hoy suena el sintetizado**. El día que
vuelva, alcanza con dejar los `.mp3` en `assets/` y las muestras pisan a la
síntesis sin tocar una línea — el empaquetador ya los busca.

### El ladrido sintetizado, mientras tanto

No es un bip. Un ladrido tiene cuatro cosas y las cuatro están:

1. un golpe de aire al abrir la boca, 8 ms;
2. un cuerpo armónico que **cae** de tono — un tono que no cae suena a bocina;
3. **tres formantes en paralelo**, no uno: un solo pasabanda da una vocal sola y
   suena a juguete, mientras que la garganta y la boca arman varias resonancias
   a la vez, y de ahí sale la "a" del guau;
4. los tres formantes **bajando juntos**, que es literalmente el hocico
   cerrándose y lo que convierte "aaa" en "auu".

Y cada ladrido sale distinto: tono, largo y formantes se mueven un poco al azar,
porque repetido idéntico deja de sonar a perro y suena a botón. Hay además tres
voces (grave, media y aguda) y nunca se repite la anterior.

Corriendo, el perro **jadea**: una sola fuente de ruido con la ganancia latiendo
a 3,1 Hz, que es aire entrando y saliendo. Sube y baja con la velocidad, sin un
umbral que lo prenda de golpe.

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
