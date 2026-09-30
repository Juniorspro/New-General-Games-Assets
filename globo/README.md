# GLOBO LIBRE

Un globo sube solo. Vos manejás un escudo redondo y corrés todo lo que se
le viene encima: cajas, bolas, palos, péndulos, molinetes. Si algo que no es
el escudo toca el globo, se revienta.

Es un juego **original** de JXSTUDIOS del mismo género que *Rise Up*. Del
género se tomaron las reglas:
- el globo sube solo;
- el escudo se arrastra en cualquier lado de la pantalla;
- lo que está quieto espera en el aire hasta que algo lo toca.

De ese juego no hay nada: ni el nombre, ni el logo, ni los niveles, ni los
dibujos. El cartel GLOBO LIBRE, los 30 niveles, los 13 globos, los 8 escudos,
la música y los sonidos están hechos con código acá. El motor de física
también (cajas y bolas que giran), sin librerías: el repo es público y el
juego va en un solo archivo.

Arranca con la intro de **JXSTUDIOS** en el estilo del juego, plana y de
colores, desde el primer cuadro y sin tocar nada (menos de tres segundos):
- Tres barridos de color abren un fondo azul.
- El escudo del juego escribe el monograma JXS en blanco, trazo por trazo.
- Un globo sube y choca el logo desde abajo: el logo salta y larga papel picado.
- JXStudios aparece letra por letra y un círculo del color del cielo da paso
  al menú.

La música va con el mismo reloj. Si el navegador no deja sonar sin un toque
(lo normal), la intro va muda, y el primer toque la saltea y prende el
sonido. → `js/intro.js`, `js/sonido.js › jingleJXS`

Después del logo, la primera vez, se elige el idioma (español, inglés o
portugués); después se cambia en Ajustes.

**Para jugar:** abrir `globo-en-un-archivo.html`. Anda sin red, con doble
clic o mandándolo al teléfono.
- **Con el dedo:** arrastrá en cualquier lado y el escudo se mueve lo mismo
  que el dedo, así el dedo no tapa lo que viene.
- **En la compu:** arrastrá con el mouse apretado, o usá las flechas (o WASD).
  P o Escape pausa.

## Lo medido (30/09/2026)
| qué | cuánto |
|---|---|
| Pruebas sin navegador (`pruebas/logica.mjs`) | 31 comprobaciones, todas bien: la física, los 30 niveles y las partidas enteras jugadas con el piloto automático, sin nadie y con el escudo estacionado |
| Pruebas en Chromium (`pruebas/juego.mjs`) | 17 de 17: dedos de verdad (CDP), mouse y teclado; la intro con y sin permiso de sonar; idioma, meta, ¡pum!, niveles, tienda, ajustes, infinito y cinco pantallas |
| Archivo único desde `file://` sin red (`pruebas/un-archivo.mjs`) | abre, la intro pide el idioma, llega al menú y se juega |
| Peso del archivo único | 163 KB (16 módulos, sin binarios) |
| Sin tocar nada | no se gana ningún nivel de los 30 |
| Con el escudo quieto arriba del globo | se gana 1 de 30 |
| El piloto automático (`pruebas/piloto.mjs`, bastante bobo) | gana 9 de 30 y 7 de los primeros 8; llega en promedio al 54 % de cada nivel; cada formación sola la pasa 5 de 6 veces o más |
| Física, 150 cuerpos amontonados (Node) | 0,8 ms por paso de 1/120; todo dormido a los 6 s y nada atraviesa el piso |
| Un cuadro pintado por procesador, nivel 23 | 1,4 ms a 412×892 y 2,5 ms a 618×1338, la densidad de 1,5 del teléfono; el menú, 3,3 ms (Chromium sin GPU en el servidor: del teléfono no dice nada) |
| Pantallas probadas | 412×892, 360×640, 320×568, 892×412 y 1280×720: nada se sale ni se pisa |

## Qué tiene
- **30 niveles en tres cielos** (día, atardecer y noche), de 34 a 64 segundos,
  y el **infinito**, que se arma a medida que subís. El récord queda guardado.
- **14 formaciones**, que van apareciendo de a poco:
  - caja, fila de ladrillos, racimo de bolas, palos, escalera, pirámide;
  - torre sobre una repisa, lluvia;
  - péndulo que se suelta justo cuando llega el globo;
  - molinete que abre como tranquera;
  - aspas que giran solas, muro con el hueco tapado;
  - techo a dos aguas con bolas sobre las tejas, jaula.

  Muchas pueden venir cayendo en vez de esperar quietas. Lo que cae avisa
  con un triángulo arriba.
- **Nada fijo pasa nunca por el camino del globo** (la prueba lo mira en los
  30 niveles y en el infinito): lo que cruza el camino se puede empujar.
- **Monedas** que junta el escudo (o el globo, si pasa por encima); pasar un
  nivel da premio. Con ellas se compran **13 globos** (rayado, lunares,
  sandía, arcoíris, planeta, oro, JXSTUDIOS…) y **8 escudos** en la tienda.
- **El menú que se mece:** el cartel GLOBO LIBRE cuelga de tres globos y se
  hamaca, y el dedo lo empuja; las nubes se corren por capas.
- **Ajustes:** música, sonido, vibración, sensibilidad del escudo, calidad
  (en *auto* baja la resolución sola si los cuadros tardan), idioma y borrar
  el progreso (con dos toques).
- **Sonido:** una marimba tranquila para el menú y otra con ritmo para jugar,
  el "toc" de madera del escudo, monedas que suben de nota si vienen
  seguidas, el ¡pum!, la fanfarria de la meta; todo con WebAudio, sin archivos.

## Cómo está hecho
| archivo | qué hace |
|---|---|
| `js/fisica.js` | El motor, con el método de Box2D-lite (Erin Catto). Cajas y bolas que giran, con choques de hasta dos puntos, impulsos acumulados con arranque del paso anterior, fricción y rebote. También cuerdas, molinetes clavados con tope, cuerpos que se duermen de a islas y grupos que se despiertan juntos. |
| `js/niveles.js` | Las 14 formaciones, los 30 niveles (con semilla) y el infinito. La regla de que nada fijo pase por la columna del globo. |
| `js/partida.js` | El globo que sube, el escudo (cinemático: sube con la cámara más lo que arrastre el dedo), las monedas y lo que se suelta al llegar. La física va a 120 pasos por segundo. |
| `js/dibujo.js`, `js/temas.js` | El cielo, las nubes, los cuerpos planos con su sombra, el globo, el escudo y la meta. |
| `js/menu.js` | El cartel que se hamaca y el fondo de los menús. |
| `js/hud.js` | La barra del nivel con el globito, la altura del infinito y las monedas. |
| `js/intro.js`, `js/logojxs.js` | La intro de JXSTUDIOS. El monograma son los mismos 4 trazos de Cripta Neón y Víbora.io. |
| `js/sonido.js` | La música por pasos con agenda adelantada y los efectos. |
| `js/entrada.js` | El arrastre relativo (manda el primer dedo), el mouse y las flechas. |
| `js/idioma.js`, `js/guardado.js`, `js/pieles.js` | Los textos en tres idiomas, lo guardado (validado campo por campo) y los globos y escudos. |
| `js/main.js` | Las pantallas, la cámara y el bucle: cada cuadro avanza su tiempo real, en pasos de a lo sumo 1/60 s. |
| `empaquetar.py` | Arma el archivo único. |

## Probar
```
python3 -m http.server 8123 --bind 127.0.0.1 &     # desde la raíz del repo
node globo/pruebas/logica.mjs
node globo/pruebas/juego.mjs [--capturas carpeta]
python3 globo/empaquetar.py && node globo/pruebas/un-archivo.mjs
```
Parámetros para probar:
- `?sinintro`: directo al menú.
- `?directo=nivel:4` o `?directo=infinito`: directo a jugar.
- `?pausa`: no avanza solo (se avanza con `__G.pasos(n)`) y saltea la intro,
  salvo que también vaya `?intro`.
- `?limpio`: sin lo guardado.
- `?idioma=en`: elige el idioma.

## De dónde salió
De la captura de la ficha de Google Play que pasó el pedido: de ahí salió el
género, no los dibujos. El monograma JXS sale de las dos imágenes del logo de
JXSTUDIOS, redibujado con trazos.
