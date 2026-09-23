# LUZ MALA

Metroidvania a lo Hollow Knight / Silksong, en pixel art y para el teléfono parado.

En el monte chaqueño, a la luz que va y viene de noche por el campo le dicen
la luz mala. Esta vez la luz mala es Chispa, una luciérnaga con una espina de
vinal. Baja por las raíces de un quebracho para volver a prender sus tres
faroles.

- **Jugar:** `luz-mala.html`. Es un solo archivo, se abre con doble clic y anda
  sin internet.
- **Contenido:**
  - 9 salas conectadas en cuatro zonas: el pueblo, las raíces, la telaraña y el
    hormiguero.
  - Tres jefes: el Torito, la Viuda y la Reina de la Marabunta. Cada uno tiene
    sus fases y anuncia sus ataques.
  - Dos habilidades que abren camino: el aleteo y la resina.
  - Cuatro vecinos que charlan según cómo va la historia, y la tienda de Don
    Canasto.
  - Hongos para descansar y guardar. Al morir, la luz queda en una sombra que
    se recupera, como en Hollow Knight.
  - Mapa, música y sonido sintetizados.
- **Controles:**
  - Teclado: flechas o WASD. `Z`/`K`/espacio salta, `X`/`J` golpea, `C`/`L`/Shift
    hace el aleteo, `V`/`Q`/`I` (mantener) cura, `M` abre el mapa y Esc pausa.
  - Mando: A salta, X golpea, B hace el aleteo, Y (mantener) cura y Select abre
    el mapa.
  - Táctil: el pulgar izquierdo mueve. A la derecha van salto, golpe, aleteo y
    curar. Arriba sirve para hablar y descansar.
  - El golpe va para arriba con arriba, y para abajo en el aire con abajo. Para
    abajo rebota en bichos y espinas.

## Cómo está hecho

- El motor compartido está en `../motor2d/`; el juego, en `js/`:
  - `fisica`: el movimiento y el combate, puros, con azar de semilla;
  - `bichos` y `jefes`;
  - `salas`: el mundo, en coordenadas de baldosa;
  - `historia`, `arte`, `musica`, `dibujo`, `pantallas` y `juego`.
- Armar: `node motor2d/armar.mjs luz-mala` (desde la raíz).
- Pruebas (todas desde la raíz):
  - `node luz-mala/pruebas/conexiones.mjs`: que cada hueco en el borde de una
    sala dé a un hueco de la vecina.
  - `node luz-mala/pruebas/recorrido.mjs [--guardar]`: con la física de verdad,
    que el quebracho se pueda recorrer en el orden de la historia y que lo
    cerrado esté cerrado. Por ejemplo, sin el aleteo no se cruza el túnel y sin
    la resina no se sube el pique.
  - `node luz-mala/pruebas/jefes.mjs`: que cada jefe use todos sus ataques y
    llegue a todas sus fases sin trabarse, y que un jugador torpe simulado le
    pueda ganar.
  - `node luz-mala/pruebas/partida.mjs`: una partida en Chromium. Cubre la
    intro, charlas, tienda, hongo, pasar de sala, morir y recuperar la sombra,
    el Torito, mapa y pausa. Además repite en el juego los recorridos del
    resolvedor.
  - `node luz-mala/pruebas/manos.mjs`: menús con el dedo, palanca con dos dedos
    (CDP), cada botón, teclado y mando simulado.
  - `node luz-mala/pruebas/ver.mjs <carpeta>`: capturas de cada sala.
