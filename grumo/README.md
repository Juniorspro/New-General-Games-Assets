# GRUMO

Grumo es un bollito de plastilina que tiene que llegar a la puerta. El
problema es el animador: mueve el set entre cuadro y cuadro para que te
caigas. Cada vez que perdés es una **toma nueva** (claqueta y todo), y en la
toma siguiente ya sabés dónde está la trampa.

Es un juego **original** de JXSTUDIOS del mismo género que *Level Devil*
(plataformas donde el nivel cambia para matarte y se aprende muriendo). Del
género se tomaron las reglas: correr, saltar, llegar a la puerta, y que el
piso, los pinches y la puerta hagan trampa. El nombre, el personaje, las
escenas, los dibujos, la música y los sonidos están hechos con código acá.

## Cómo se juega
- En el teléfono (vertical): las flechas de abajo a la izquierda mueven y el
  botón grande salta. Mantenerlo apretado salta más alto.
- En la compu: flechas o A/D para moverse, espacio para saltar, Esc o P
  pausa.
- 20 escenas en dos sets: **el taller** (1-1 a 1-10) y **la cocina** (2-1 a
  2-10, se abre al terminar el taller). Cada escena da bolitas; con menos
  tomas, más.
- En el **camarín** se gastan las bolitas en colores y sombreros para Grumo
  (la corona es el premio de terminar todo).
- Castellano, inglés y portugués: se elige después del logo la primera vez
  y se cambia en los ajustes.

## El look: stop motion de plastilina
- El mundo se mueve a 12 cuadros por segundo, como una película de
  plastilina; Grumo y los controles no, para que responda al toque (la
  física corre a 120 pasos por segundo y lo que choca es lo que se ve).
- Todo está modelado en código: bloques con relieve, huellas digitales y
  bordes que "hierven" entre cuadros; grano de película, parpadeo de luz y
  viñeta encima.
- La mano del animador entra al set a llevarse la puerta o empujarte.
- La intro de JXSTUDIOS es de plastilina y arranca sola.

## Las trampas de la cocina
Bandeja que se para y se cae (2-1), tostadora con resortes (2-2), la puerta
que escupe albóndigas y está cerrada mientras escupe (2-3), galletitas que se
desarman (2-4), masa que se hunde (2-5), un corte que cambia el set en un
cuadro (2-6), la puerta que camina (2-7), un bloque invisible sobre el pozo
(2-8), el techo que se cae de a pedazos (2-9) y todo junto (2-10).

## Archivos
- `index.html`, `css/`, `js/`: el juego en módulos. `js/partida.js` es la
  simulación (sin dibujo), `js/niveles.js` las escenas y sus trampas.
- `grumo-en-un-archivo.html`: todo en un solo archivo que abre sin red
  (`python3 empaquetar.py` lo arma).
- `pruebas/resolver.mjs`: busca cómo ganar cada escena y juega el guion de
  cada una "como persona" (con reacción tarde y errores de duración).
  `node pruebas/resolver.mjs --todos` · `--guiones` · `--guardar`.
- `pruebas/humo.mjs`: la prueba de humo en Chromium (menús, jugar, morir,
  ganar, el final, camarín y ajustes). `node pruebas/humo.mjs [url]`.
- `pruebas/ver.html`: el visor de escenas (`?nivel=2-3`).

## Lo medido (30/09/2026)
- Física: corre a 5,60 celdas/s (llega en 0,083 s), salta 2,55 celdas de
  alto, 0,675 s en el aire, salto largo de 3,83 celdas; saltito de 0,69.
- Las 20 escenas se pueden ganar (el resolvedor gana cada una entre 1,22 s y
  4,41 s).
- Guiones jugados como persona (100 intentos con error): 100 % en 1-1, 1-2,
  1-4, 1-6, 1-7, 1-8, 1-9, 2-2, 2-3, 2-4 y 2-6; 99 % en 1-5; 95 % en 2-1;
  92 % en 1-10; 84 % en 1-3 y 2-10; 52 % en 2-5 (la más difícil). 2-7, 2-8
  y 2-9 no tienen guion escrito.
- En Chromium, con el servidor y con el archivo único abierto sin red: intro
  → idioma → menú → escenas → ganar 1-1 → morir en 2-3 y ganarla en la toma
  2 → ganar 2-10 y ver el final → camarín → ajustes: 9 de 9, sin errores.
- `grumo-en-un-archivo.html`: 258 KB, sin nada de afuera.

## Falta
- Jugarlo en un teléfono de verdad: la dificultad está medida con el
  resolvedor, no con una persona.
- Un tercer set (el jardín de noche) tiene fondo, colores y música hechos,
  pero no escenas.
