# CRIPTA NEÓN

Un laberinto que se desliza, en pixel art: Lu, una luciérnaga, vuela en línea
recta hasta chocar con una pared, junta chispas, monedas y estrellas, esquiva
púas, polillas, erizos y fuego, y sube. En la torre, además, sube la lava.

Es un juego **original** del mismo género que *Tomb of the Mask*: se tomaron
las reglas del género (deslizarse hasta la pared, laberinto vertical, lava que
sube, poderes), no el personaje, el nombre, el logo ni los niveles de ese
juego. Todo el dibujo, la letra, los niveles, la música y los sonidos están
hechos con código acá.

Arranca con la intro de **JXSTUDIOS** desde el primer cuadro, sin tocar nada:
dos segundos de pixel art con
música: el monograma JXS se escribe en cromo sobre fibra de carbono, golpea,
brilla y se tipea el nombre. Sobre el sonido: si el navegador deja sonar sin un toque (casi nunca), el audio nace andando
y la música va en fase con el dibujo; si no, la intro va muda y el primer
toque la saltea y prende el sonido. Un
toque la saltea. → `js/intro.js`, `js/logojxs.js`

**Para jugar:** abrir `cripta-en-un-archivo.html` (anda sin red, con doble
clic o mandándolo al teléfono). Deslizar el dedo, o las flechas / WASD.
Enter elige, Escape o P pausa.

## Lo medido (30/09/2026)
| qué | cuánto |
|---|---|
| Pruebas sin navegador (`pruebas/niveles.mjs`) | 4043 comprobaciones, todas bien |
| Pruebas en Chromium (`pruebas/juego.mjs`) | 18 de 18 |
| Archivo único desde `file://` sin red (`pruebas/un-archivo.mjs`) | abre y se gana el 1-1 |
| Peso del archivo único | 275 KB (22 módulos, sin binarios) |
| Niveles | 30: 5 hechos a mano, 25 armados con la torre; todos se ganan, con las 3 estrellas, todas las monedas y todas las chispas alcanzables y sin lugares sin salida |
| Torre | 300 semillas × 260 filas resueltas: 0 sin camino, 0 lugares sin salida |
| Un paso de simulación | 0,011 ms (Chromium por procesador; del teléfono no dice nada) |
| Un cuadro dibujado | 0,32 ms en SwiftShader (ídem) |
| Pantallas probadas | 412×892, 892×412, 360×640 y 1280×720, siempre a escala entera |

## Qué tiene
- **Tres mundos de diez niveles**: Catacumbas (turquesa), Jardín de hongos
  (violeta) y El Horno (brasa), cada uno con su piedra, su adorno y su música.
  Cada nivel tiene tres estrellas escondidas en rincones, monedas y chispas.
- **La torre**: infinita, generada mientras se sube, con la lava que acelera,
  la raya del récord cruzando la torre y revivir una vez por 50 monedas.
- **Peligros**: púas fijas, púas que suben y bajan, polillas que van y
  vienen, cabezas de piedra que escupen fuego, erizos que se inflan, lava.
- **Piezas**: paredes frágiles (un golpe y se caen), portales gemelos,
  flechas que obligan a doblar.
- **Poderes**: escudo (aguanta un golpe), imán, hielo (congela bichos y lava)
  y monedas dobles; en la tienda se compran mejoras que los hacen durar más.
- **Tienda**: ocho pieles para Lu (la reina lleva corona, la menta gorrito).
- **Menús animados**: el cartel del título colgado de cadenas que se hamaca y
  titila como neón viejo, con una partida jugándose sola atrás; botones de
  piedra que caen y se hunden; el mapa que serpentea, con antorchas, hongos
  que brillan, carteles en la entrada de cada mundo y nodos que brotan de a
  uno; estrellas que caen con rebote en el resultado; iris para pasar de
  pantalla.
- **En la partida**: barrita de altura al costado, flecha que marca la salida
  cuando queda arriba, partículas de ambiente por mundo (polvo, esporas,
  brasas), carteles cada 50 m en la torre y marcos con antorchas cuando la
  pantalla es ancha.
- **Jugo**: estirar y aplastar, estela, polvo, sacudida, parada de golpe, el
  "blip" de las chispas subiendo por una escala pentatónica en cada racha.
- **Tres idiomas** (castellano, inglés, portugués), guardado en el teléfono,
  vibración, pantalla parada o acostada.

## Cómo está hecho
| archivo | qué hace |
|---|---|
| `js/reglas.js` | las letras del mapa y el deslizamiento: lo comparten el juego, el resolvedor y la torre |
| `js/resolver.js` | recorre todos los estados posibles: si se gana, en cuánto, qué se alcanza y dónde uno queda encerrado |
| `js/infinito.js` | la torre: un camino tallado en piedra maciza con las paredes de freno reservadas (ver su comentario: tres reglas que salieron de trampas reales) |
| `js/niveles.js` | los 30 niveles como texto |
| `js/juego.js` | la partida: Lu, lo que se junta, lo que mata, la cámara y el dibujo |
| `js/nivel.js` | las paredes de neón que se arman solas, horneadas en trozos de 32 filas |
| `js/sprites.js`, `js/fuente.js`, `js/paleta.js` | el pixel art, la letra 5×7 con tildes y los colores |
| `js/pantallas.js`, `js/ui.js` | las escenas y los botones, paneles e iris |
| `js/sonido.js` | efectos y música con osciladores (secuenciador con reloj del audio) |
| `js/pantalla.js`, `js/entrada.js`, `js/main.js` | la escala entera, el dedo y el bucle a 60 pasos fijos |

Los niveles armados con la torre salieron de un script que prueba cientos de
semillas por nivel y se queda con la que mejor cumple lo que ese nivel
enseña; quedaron fijos como texto en `niveles.js` (se pueden retocar a mano y
la prueba los vuelve a revisar).

## Probar
```
python3 -m http.server 8123 --bind 127.0.0.1 &     # desde la raíz del repo
node cripta/pruebas/niveles.mjs
node cripta/pruebas/juego.mjs [--capturas carpeta]
python3 cripta/empaquetar.py && node cripta/pruebas/un-archivo.mjs
```
Parámetros para entrar directo: `index.html?directo=nivel:4` (o `torre`,
`mapa`, `tienda`, `ajustes`), `?pausa` (no avanza solo; `__C.pasos(n)`),
`?limpio` (sin lo guardado), `?idioma=en`.

## Referencias del género (se leyeron, no se copió nada)
- https://en.wikipedia.org/wiki/Tomb_of_the_Mask
- https://www.gamedeveloper.com/design/tomb-of-the-mask-enemy-analysis
- https://mechanicsofmagic.com/2022/05/30/critical-play-7-tomb-of-the-mask/
