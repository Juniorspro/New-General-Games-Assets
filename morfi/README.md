# MORFI

Morfi es una caja de cartón con hambre de caramelos. El caramelo cuelga de
hilos de algodón: cortalos con el dedo en el momento justo para que caiga en
la boca de Morfi (las tapas de arriba de la caja), y de paso juntá las tres
estrellas de origami.

Es un juego **original** de JXSTUDIOS del mismo género que *Cut the Rope*.
Del género se tomaron las reglas:
- el caramelo cuelga de hilos que se cortan deslizando el dedo;
- hay que llevarlo a la boca del personaje;
- cada nivel tiene tres estrellas en el camino.

De ese juego no hay nada: ni el nombre, ni el personaje, ni los niveles, ni
los dibujos. Morfi, las tres cajas de 10 niveles, los objetos de papel, las
8 pieles, los 7 caramelos, la música y los sonidos están hechos con código
acá, igual que la física de los hilos, sin librerías: el repo es público y
el juego va en un solo archivo.

Todo es **de cartón y papel**:
- el fondo de cada caja (el cartón corrugado con su sello de FRÁGIL, una
  hoja de cuaderno sobre la mesa, papel de regalo);
- recortes con su sombra suave, como pegados un poco arriba del fondo;
- alfileres, estrellas de origami, globos de papel, abanicos plegados,
  chinches, sobres, gomitas y cinta de papel;
- el grano del papel encima de todo.

Morfi está armado en perspectiva, como un títere de papel:
- las tapas giran sobre sus bisagras y se abren a medida que el caramelo se
  acerca;
- los ojos lo siguen y parpadea;
- saca la lengua con ganas, bosteza si nadie juega, festeja con un saltito
  y un baile, y se pone triste si el caramelo se cae.

Arranca con la intro de **JXSTUDIOS** en el estilo del juego, de papel, desde
el primer cuadro y sin tocar nada (unos tres segundos):
- Sobre un corcho entra una hoja y la sujetan dos cintas.
- Una tijera recorta el monograma JXS en papeles de colores, trazo por trazo.
- El recorte salta y larga papelitos.
- JXStudios se pega letra por letra, como una nota de recortes de revista, y
  "presenta" se escribe con birome.
- La hoja se va volando y el corcho se vuelve el cartón del menú.

La música va con el mismo reloj (tijeretazos, una kalimba que sube, un sello
por letra). Si el navegador no deja sonar sin un toque (lo normal), la intro
va muda, y el primer toque la saltea y prende el sonido. → `js/intro.js`,
`js/sonido.js › jingleJXS`

Después del logo, la primera vez, se elige el idioma (español, inglés o
portugués); después se cambia en Ajustes.

**Para jugar:** abrir `morfi-en-un-archivo.html`. Anda sin red, con doble clic
o mandándolo al teléfono.
- **Con el dedo:** deslizá por el hilo para cortarlo (con dos dedos se cortan
  dos a la vez). Un toque revienta el globo o hace soplar el abanico.
- **En la compu:** arrastrá con el mouse apretado. P o Escape pausa; R
  empieza de nuevo.

## Lo medido (30/09/2026)
| qué | cuánto |
|---|---|
| Pruebas sin navegador (`pruebas/logica.mjs`) | 344 comprobaciones, todas bien: la física (el hilo no se estira, la hamaca, el globo, el abanico, el sobre, la gomita, las chinches, el clip, el alfiler que se mueve), los 30 niveles, lo guardado y los textos |
| Pruebas en Chromium (`pruebas/juego.mjs`) | 20 de 20: dedos de verdad (CDP, uno y dos a la vez), mouse y teclado; la intro con y sin permiso de sonar; idioma, ganar, perder y volver a empezar, cajas, tienda, ajustes, cinco pantallas y las 30 soluciones jugadas adentro del juego |
| Archivo único desde `file://` sin red (`pruebas/un-archivo.mjs`) | abre, la intro pide el idioma, llega al menú y se gana el 1-1 con tres estrellas |
| Peso del archivo único | 192 KB (17 módulos, sin binarios) |
| Cada nivel | su solución guardada da de comer con las tres estrellas; sin hacer nada no se come en ninguno de los 30; cada acción hace falta y cada cosa del tablero se usa |
| Cuánto perdona (una acción ±0,04 y ±0,08 s) | 99 % en promedio: 27 niveles al 100 %, 1-10 y 2-8 al 92 %, 3-9 al 75 % |
| La hamaca | un hilo de 120 desde 45° va y viene en 2,05 s (el péndulo ideal, 2,11 s) |
| Un paso de física (Node) | 25 a 37 µs en el 1-9, el de cuatro hilos: menos de 5 ms por segundo de juego |
| Un cuadro pintado por procesador | menos de 1 ms en el nivel 2-10 (Chromium sin GPU en el servidor: del teléfono no dice nada) |
| Pantallas probadas | 412×892, 360×640, 320×568, 892×412 y 1280×720: nada se sale ni se pisa y el tablero entra entero |

## Qué tiene
- **30 niveles en tres cajas**, que se abren con estrellas:
  - **Cartón** (desde el principio): hilos, hamacas y clips (el alfiler
    azul que ata un hilo nuevo al caramelo que pasa).
  - **Cuaderno** (12 ★): globos de papel que suben el caramelo (un toque los
    revienta), abanicos que soplan y filas de chinches que lo rompen.
  - **Papel de regalo** (30 ★): sobres (entra por uno y sale por el otro),
    gomitas que rebotan y alfileres que van y vienen.
- **Ayudas** la primera vez que aparece algo nuevo: una notita amarilla con
  cinta.
- **Estrellas y monedas:** ganar un nivel la primera vez da 10 monedas y 5
  por estrella; después, 5 por cada estrella nueva y 2 por ganar. Las tres
  estrellas de una caja entera dan 50 más.
- **La tienda:** 8 Morfis (de regalo con moño, caja de zapatos, pizza,
  mudanza con cinta de FRÁGIL, menta, de noche con estrellitas, JXSTUDIOS) y
  7 caramelos (frutilla, menta, uva, limón, dulce de leche, arcoíris).
- **El menú que se mece:** el cartel MORFI de cartón corrugado cuelga de dos
  hilos y se hamaca, y el dedo lo empuja. Abajo está Morfi con un caramelo
  colgado: se puede cortar ahí mismo, lo come y baja otro.
- **Si se cae o se rompe,** un cartelito lo dice y el nivel vuelve a empezar
  solo.
- **Ajustes:** música, sonido, vibración, calidad (en *auto* baja la
  resolución sola si los cuadros tardan), idioma y borrar el progreso (con
  dos toques).
- **Sonido:** una kalimba con pizzicato para el menú y otra más saltarina para
  jugar, el tijeretazo, las estrellas que suben de nota, el mordiscón con su
  "ñam ñam", el pop del globo, el soplido, el ¡boing! de la gomita y el papel
  del sobre; todo con WebAudio, sin archivos.

## Cómo está hecho
| archivo | qué hace |
|---|---|
| `js/cuerdas.js` | La física de los hilos: partículas con Verlet y largos que se corrigen 20 vueltas por paso, a 120 pasos por segundo fijos. Una correa del alfiler a la punta hace que el hilo no se estire, y el pedazo cortado que queda colgando del caramelo no tira de él. |
| `js/partida.js` | Un nivel en juego: el caramelo, las estrellas, los clips, los globos, los abanicos, las chinches, los sobres, las gomitas, los alfileres que se mueven y la boca de Morfi (que come lo que cae, no lo que sube). También `jugarSolucion`, con la que se prueban los niveles. |
| `js/niveles.js` | Los 30 niveles, cada uno con su solución guardada (en segundos). |
| `js/papel.js` | El kit de papel: los tres fondos, el grano, los recortes con sombra y la cinta. |
| `js/dibujo.js` | Los objetos del tablero, los hilos de algodón, el caramelo y los papelitos. |
| `js/morfi.js` | Morfi: la caja en perspectiva, las tapas, la cara, los ánimos y las 8 pieles. |
| `js/menu.js` | El cartel que se hamaca y el caramelo del menú. |
| `js/hud.js` | La etiqueta del nivel, las estrellas, la nota de ayuda, el rastro del dedo y el cartelito de "¡se cayó!". |
| `js/intro.js`, `js/logojxs.js` | La intro de JXSTUDIOS. El monograma son los mismos 4 trazos de los otros juegos. |
| `js/sonido.js` | La música por pasos con agenda adelantada y los efectos. |
| `js/entrada.js` | Los dedos: cada uno deja tramos que cortan lo que cruzan; apoyar es un toque. |
| `js/idioma.js`, `js/guardado.js`, `js/pieles.js` | Los textos en tres idiomas, lo guardado (validado campo por campo) y la tienda. |
| `js/main.js` | Las pantallas, la cámara y el bucle. |
| `empaquetar.py` | Arma el archivo único. |

## Probar
```
python3 -m http.server 8123 --bind 127.0.0.1 &     # desde la raíz del repo
node morfi/pruebas/logica.mjs
node morfi/pruebas/juego.mjs [--capturas carpeta]
python3 morfi/empaquetar.py && node morfi/pruebas/un-archivo.mjs
node morfi/pruebas/tiempos.mjs [1-4 ...]           # si se tocó la física: vuelve a buscar los tiempos
```
`pruebas/ver.html?nivel=2-4` dibuja un nivel con el camino de su solución
(verde) y el de no hacer nada (rojo).

Parámetros para probar:
- `?sinintro`: directo al menú.
- `?directo=nivel:2-4`: directo a jugar.
- `?pausa`: no avanza solo (se avanza con `__G.pasos(n)`) y saltea la intro,
  salvo que también vaya `?intro`.
- `?limpio`: sin lo guardado. `?todo`: todo abierto.
- `?idioma=en`: elige el idioma.

## De dónde salió
De las capturas de la ficha de Google Play que pasó el pedido: de ahí salió
el género, no los dibujos. El monograma JXS sale de las dos imágenes del logo
de JXSTUDIOS, redibujado con trazos.
