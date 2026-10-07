# SALAMANCA (07/10)

Pidió "1 juego pixel art completo, en vertical, god, no tan pesado, bien adictivo". Juego propio: roguelite tipo
Archero en una cueva del folclore (la Salamanca del Mandinga). `salamanca/salamanca.html`, **182 KB**. Cómo es y
qué archivo tiene qué: `salamanca/README.md`.

## Lo que hay que saber

- Armar: `node motor2d/armar.mjs salamanca` (usa `motor2d/fuente.js`; lo demás es propio). Pantalla de 180 de
  ancho y alto de 320 a 420 según el celu, escala entera en píxeles reales (`ajustar()` en `js/juego.js`).
- **Arte en texto** (`js/arte.js`): una letra por píxel, los simétricos por la mitad (`sim()`). Para retocar,
  armar una hoja: cargar fuente+base+arte en Chromium y dibujar `SPR` e `ICONOS` (así se revisó, 1 captura).
- Sonido 100 % sintetizado: guitarra Karplus-Strong (buffers por nota, en caché), bombo, quena; la música es
  una chacarera en 6/8 que cambia de tono por piso (`TEMAS` en `js/sonido.js`).
- Tiempo fijo de 60 pasos con cámara lenta (`J.lenta`); todo en coordenadas de sala, el dibujo suma `SY`.
- Probar: `node salamanca/pruebas/recorrido.mjs /ruta/afuera/` (bot inmortal, ~70 s llega a 1-6). Para un
  jefe: `__salamanca.J.piso = n; J.sala = 7; __salamanca.siguienteSala()`.

## Trampas que costaron

- **Capturas de Playwright con ruta relativa caen en la raíz del repo** (el cwd): usar rutas absolutas afuera.
- Los bichos se quedaban encima de la chica y ella tiraba al piso: apuntar centro a centro, salir de 3 px y
  que el bicho rebote al tocarla.
- Lo que se junta daba vueltas alrededor sin llegar (velocidad con inercia): atraído va derecho, sin inercia.
- El bot que sube derecho a la puerta se traba en las rocas del medio: camino por BFS en la grilla.

## Quedó

- Entregado con portada 9:16 (Higgsfield `0c5a020f…` + título con la fuente de píxeles del juego, en
  `scratchpad/portadas/`, fuera del repo). Sin probar en un celu de verdad: la palanca y la vibración.
- Ideas si pide más: más bichos por piso, cofres, personajes para desbloquear, logros.
