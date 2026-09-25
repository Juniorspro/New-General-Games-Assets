# Tajo — cortá al ritmo

Bloques dorados y violetas que vienen volando por una pista negra, un dragón de
neón al fondo, láseres, la letra flotando palabra por palabra y dos sables que
dejan estelas anchas. Como el mapa de *Runaway Baby* del video de referencia
(TikTok de @theepictree), pero **en el teléfono y sin casco: el tajo se dibuja
con el dedo**.

- **Dibujás el corte.** Pasás el dedo rápido por encima del bloque, en la
  dirección de la flecha. Si arrancás en la mitad izquierda es el sable dorado;
  en la derecha, el violeta. Dos dedos a la vez también.
- **Tres canciones propias**: *Dragón Violeta* (funk con talkbox, 150 bpm),
  *Fuego Lento* (reggaetón, 96 bpm) y *Estrella Fugaz* (house, 128 bpm). Cinco
  dificultades cada una.
- **Tu canción**: cargás un mp3 del teléfono, el juego encuentra el pulso y te
  arma el mapa. El audio no sale del teléfono.
- **Sin un solo archivo de audio ni de imagen.** La música la toca un
  sintetizador, el escenario se arma con código. El juego entero es
  `tajo-en-un-archivo.html`: **907 KB**, abre con doble clic.

> **Sobre la canción del video.** *Runaway Baby* es de Bruno Mars y tiene
> derechos: no se puede meter en el juego. Por eso las canciones son
> originales, y para jugar esa (o cualquier otra que tengas) está **Tu
> canción**.

## Lo medido

Todo sale de `./pruebas/correr.sh`.

| | |
|---|---|
| mapas validados por máquina | **15/15** (3 canciones × 5 dificultades), 0 errores |
| bloques por mapa | Fácil 64–74 · Normal 119–131 · Difícil 176–214 · Experto 267–276 · Experto+ 348–380 |
| densidad | **0,47 → 2,66** bloques por segundo, subiendo siempre con la dificultad |
| el bot, en tiempo simulado | **15/15 al 100 %**, 115 de promedio por corte, 0 bombas tocadas |
| toques de verdad (CDP) | **5/5**: corte bueno, al revés, lento, sable equivocado, dos dedos a la vez |
| tu canción, tempo | exacto en las **6** pistas de prueba (3 sintéticas, 3 reales) |
| tu canción, pulso | **100 %** (house) y **96 %** (hip-hop) de los pulsos a menos de 30 ms del real; 5–7 ms de mediana |
| tu canción, tiempo de análisis | 1,0–2,6 s por canción (navegador de esta máquina) |
| costo del cuadro en la placa | **28–32** llamadas de dibujo, **5.800–13.600** triángulos (todas las pasadas, coro más cargado) |
| costo del audio | coro completo = **20,5 %** del tiempo real del hilo de audio (medido grabando fuera de línea) |
| mezcla | pico 0,96–0,995, **0 recortes** en las tres canciones |
| archivo único | **907 KB**, 0 binarios, 0 pedidos afuera desde `file://`, el bot lo juega entero adentro |

Lo que **no** se midió: los cuadros por segundo en un teléfono. Acá el
navegador dibuja por procesador (SwiftShader, ~9 cuadros por segundo) y eso
no dice nada de una placa de video real. Para eso está la resolución que se
adapta sola: si el cuadro pasa de 22 ms durante 2 s, baja.

## Cómo se ve igual al video

Se bajó el video, se sacaron cuadros y se comparó lado a lado cada vuelta
(`pruebas/_corte.mjs`, capturas a 412×892):

- **El dragón**: una máscara con corona de púas, ojos y marcas en V violetas,
  y dos **cuernos de carnero hechos de placas** con una franja de luz entre
  placa y placa. Detrás, una golilla de púas.
- **Las alas**: medias lunas **tejidas como una red** (meridianos y paralelos
  de neón), dos por lado.
- **Las rocas** oscuras con **rayas azules horizontales**, sólo en la cara que
  mira a la pista.
- **Los láseres**: haces que bajan del cielo y un **abanico** que sale de
  atrás de la cabeza y gira con los bronces.
- **La pista**: una losa negra de tope espejado con un **panel de LEDs** al
  frente que baila con el espectro de la música.
- **El piso** refleja las luces (copias espejadas: no se dibuja la escena dos
  veces).
- **Los bloques**: almohadones con bisel, dorado y violeta, estrella de
  cuatro puntas al centro y flecha abajo. Al cortarlos se parten por la línea
  exacta del dedo, con tapa, chispas y un tajo de luz.
- **La letra** en neón, una palabra por vez, cada una de un color.
- **Las luces** cambian violeta → azul → blanco con la música: destellos en
  cada bombo, las alas en cada caja, apagón antes de cada coro.

## Por qué está hecho así

**La música es el mapa.** Un juego de ritmo sobre un mp3 tiene que adivinar
dónde están los golpes. Acá el compositor (`compositor.js`) lee una partitura
escrita a mano (`canciones.js`) y saca de un solo renglón el sonido, la luz
que se prende y la "pista" donde puede caer un bloque. No hay desfase posible.

**La voz es un talkbox.** Cantar sin grabación no se puede, pero el castellano
tiene cinco vocales puras y una vocal es una forma del espectro: un diente de
sierra por tres filtros afinados en los formantes de la A suena a "aaa". Las
consonantes son ráfagas de ruido. Suena robótico a propósito (el talkbox del
funk de los ochenta) y la letra se lee en pantalla.

**El corte se decide en la pantalla.** El jugador dibuja sobre el vidrio: lo
justo es preguntar si la línea que dibujó pasa por el bloque tal como se ve.
La hoja del sable es decorado.

**El puntaje premia el gesto entero**, como el original: 70 por el impulso
antes de entrar, 30 por seguir después de salir, 15 por pasar por el centro.
Por eso el número aparece un instante después del corte.

**El reloj es el del audio.** `AudioContext.currentTime` lo lleva el
hardware; rAF sólo dibuja. Y la agenda de sonidos tiene un temporizador
propio además del cuadro: si el dibujo se traba, la música no se corta.

**Todo el escenario son seis llamadas de dibujo.** Cada vértice lleva su
grupo de luz como atributo y todos los materiales leen el mismo arreglo de
colores: una orden ("el fondo a azul") cambia el cielo, las siluetas, la
niebla y el reflejo a la vez.

**Las mitades no son geometría nueva.** Cada mitad es el mismo bloque con un
plano de corte en su espacio local, y el shader descarta el otro lado. La
tapa sale gratis: las caras de atrás se pintan de un color plano.

## Trampas que encontraron las pruebas

- **Grabar la canción entera de una vez tardaba más de diez minutos.**
  Agendar los 3.006 sonidos juntos dejaba 30.000 nodos colgados del grafo
  desde el segundo cero. Agendando de a medio segundo (como en vivo): 57 s.
- **Los toques de verdad no cortaban** en la prueba y sí en el bot. El
  navegador de pruebas, ocupado dibujando, procesaba los toques con 300-600
  ms de atraso y les ponía esa hora: un deslizamiento de 90 ms llegaba como un
  arrastre de dos segundos. En un teléfono la hora es la del hardware; la
  prueba ahora congela el dibujo mientras toca. **Era el instrumento.**
- **librosa daba mal el tempo** en dos de las tres pistas reales (107,7 donde
  eran 82; 117,5 donde eran 114,9). Se comprobó con la energía coherente de
  sus propios ataques: 2,07 contra 0,50 y 1,49 contra 0,78. Sin esa
  comprobación se habría "arreglado" un detector que estaba bien.
- **Los pulsos de tu canción caían 46 ms antes.** La hora de un cuadro de
  análisis es la de su centro, no la de su comienzo.
- **El seguidor de pulsos se enganchaba en el contratiempo** durante minutos
  (con hats y guitarra en todas las semicorcheas, la fase equivocada junta
  casi tanto). Arreglo por tramos con la plantilla del backbeat (la caja en el
  2 y el 4) y un bombo con más golpe en la mezcla propia: de 25 % a 82 % de
  pulsos bien en la canción propia.
- **El bloque dorado salía color crema** y la flecha blanca no se leía:
  reflejaba demasiado. Ahora el reflejo es tenue.

## Lo que queda flojo (dicho, no escondido)

- En el verso funk de *Dragón Violeta*, si la cargás como "tu canción", los
  pulsos caen en el contratiempo durante ~40 s (el bajo sincopado tiene más
  ataque que el bombo). En las pistas de prueba con batería normal no pasa.
- El talkbox no se entiende como una voz grabada: se lee la letra.
- En teléfonos sin WebGL2 con coma flotante el brillo se ve más apagado
  (cae a 8 bits). Anda igual.

## Cómo se corre

```
python3 empaquetar.py                        # arma tajo-en-un-archivo.html
python3 empaquetar.py --artifact /tmp/tajo.html   # además, la versión para publicar en claude.ai
./pruebas/correr.sh                          # todas las pruebas
```

La versión para claude.ai no trae `<html>` ni `<head>` (la plataforma pone
los suyos), se llama sólo "Tajo" y pide Montserrat a Google Fonts; el archivo
único no, porque tiene que abrir sin red.

Para mirar: `python3 -m http.server` en esta carpeta y abrir `index.html`
(los módulos no cargan desde `file://`; el archivo único sí).

## Qué hay en cada archivo

| archivo | qué hace |
|---|---|
| `js/motor.js` | renderer, brillo "dual kawase" en coma flotante, tono ACES, calidad automática |
| `js/escenario.js` | dragón, cuernos, alas, rocas, láseres, pista, LEDs, piso con reflejos |
| `js/luces.js` · `constantes.js` | los grupos de luces y sus órdenes (prender, destello, desvanecer) |
| `js/bloques.js` | bloques y bombas instanciados, mitades con plano de corte |
| `js/sables.js` | sables que siguen al dedo y la estela (superficie barrida por la hoja) |
| `js/particulas.js` | chispas estiradas, tajo de luz, explosión |
| `js/entrada.js` | trazos por dedo con todos los puntos intermedios |
| `js/juego.js` | la partida: poses, ventanas de corte, decisión del corte, puntaje |
| `js/puntaje.js` | 115 por corte, multiplicador x1–x8, energía, rangos SS–E |
| `js/sinte.js` | batería, bajo, 808, guitarra, bronces, colchón, pluck, voz talkbox |
| `js/compositor.js` · `canciones.js` | partitura → sonido + letra + luces + pistas |
| `js/mapa.js` | los mapas por dificultad y su validador |
| `js/auto.js` | tu canción: flujo espectral, tempo, pulsos, secciones, luces |
| `js/letra.js` · `hud.js` · `main.js` | letra en neón, marcador, menús y arranque |
