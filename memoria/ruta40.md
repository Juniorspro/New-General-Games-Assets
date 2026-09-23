# RUTA 40

Autos tipo Hill Climb por la Ruta 40, con arte pintado de Rezona (no pixel
art). Qué es y cómo se juega: `ruta40/README.md` (abrí solo "Cómo se juega"
o "Pruebas", según haga falta). Acá va lo que cuesta volver a averiguar.

## Armar y probar

- `node ruta40/herramientas/armar.mjs` → `ruta40/ruta40.html` (3,2 MB). El
  arte entra por el módulo virtual `arte:todo` (un plugin de esbuild que lee
  `ruta40/arte/*.webp`). La letra, `arte/overpass.woff2`, entra en el CSS.
- `node ruta40/pruebas/bot.mjs` (~5 min) tiene que dar "Todo se cumple".
  `--rapido` (~1 min) saltea los 35 viajes con mejoras.
- `navegador.mjs` y `paisajes.mjs` abren `ruta40.html?prueba`. Con `?prueba`
  no hay polvareda: en SwiftShader un cuadro tarda tanto que la transición
  tapaba todas las capturas.
- Tampoco se puede esperar que el viaje termine solo (ahí el tiempo de juego
  corre muy lento): se usa `window.__r40.terminar('nafta')`, y
  `__r40.viaje.mover(x)` lleva el auto a otro metro del tramo.
- `juego.js` corre en Node (el bot lo usa). Por eso `vista.js` está aparte de
  `dibujo.js`: el dibujo importa las imágenes y eso en Node no existe.

## Física: lo que explotaba y cómo se arregló

- **El auto salía a 80 m/s contra una rampa.** El casco chocaba, el chasis
  subía de a 8 cm por paso y el tope de la suspensión (un resorte 12 veces más
  duro) devolvía el golpe multiplicado.
  - Arreglo: los topes son restricciones con impulso acumulado (solo frenan lo
    que se pasa).
  - Los sesgos de corrección tienen tope (2,5 m/s en el piso y 2 m/s de
    costado).
  - El casco empuja como mucho 2 cm por paso.
- **Se quedaban colgados de la panza en la cresta de las rampas** (caída de
  3–4 m del otro lado).
  - Las rampas son "lomo de burro": subida corta, rellano y bajada larga al
    40%.
  - La panza entre las ruedas choca a la altura del eje.
  - El casco lleva un punto cada 45 cm, así ninguna cresta pasa entre dos
    puntos.
- **Un puente encima de una rampa** dejaba un pozo donde se trababan todos:
  los puentes no se ponen a menos de 25 m de una rampa.
- **Dos trampas que encontró el bot** en los últimos km de Valles (cresta de
  45° a plano) y Cuyo (una "V" que terminaba en pared). Arreglo: un límite de
  curvatura en `ruta.js`, con crestas de 3 m de radio como mínimo y pozos de
  2 m. Se baja la cresta o se sube el pozo, de a poco.
- La suspensión se monta de modo que, parado, la rueda quede donde está
  dibujada: `vehiculos.js` calcula el peso sobre cada rueda con el centro de
  masa.

## Balance (medido con el piloto, que maneja mejor que una persona)

- **Chata sin mejoras**: llega a entre 2,5 y 4,1 km. Para abrir el tramo
  siguiente hay que llegar a 1,5 km.
- **Con 4 niveles** casi todos terminan los 5 km. Con 6, cada tramo lo terminan
  al menos 3 vehículos.
- **Lo que limita es la nafta**, como en Hill Climb:
  - tanques chicos (chata 26 s a fondo);
  - bidones cada vez más lejos (de 220 a 720 m);
  - la mejora de tanque multiplica por 2,2.
- **El Fitito gana todas las picadas** (es el más rápido). Si se quiere más
  parejo, hay que bajarle `giro` o subírselo a la chata.

## El arte con Rezona (proyecto `biJbNhtEOI`)

- **Carrocerías sin ruedas**: el pedido "wheel wells EMPTY, NO wheels, NO
  tires" anduvo en 4 de 5.
  - El tractor vino mirando a la izquierda y con aros. Al pedirlo de nuevo
    ("wheels REMOVED for repair, NO rims, NO rings, NO hubs") salió bien, con
    un disco chiquito que tapa la rueda.
  - El colectivo vino mirando a la izquierda: se espeja en el script.
- **Las ruedas van ADELANTE del chasis**: el hueco de la rueda viene pintado de
  negro, y si van detrás lo tapa.
  - Centro y radio de cada rueda: se midieron a ojo sobre una grilla y se
    comprobaron pegando las llantas encima (`VEH` en `procesar_arte.py`).
  - Medir los huecos por el color no anduvo: los contornos negros del dibujo
    confunden.
- **Las ventanas y los agujeros de las llantas salen transparentes**: se tiñen
  los huecos que no tocan el borde, las ventanas de vidrio polarizado (así se
  ve el conductor detrás) y las llantas de gris oscuro.
- **El recorte automático del fondo** deja un filo rosado y las columnas de los
  costados medio transparentes, que dejaban una raya en la unión espejada.
  Arreglo: `sin_borde()` y sacar 3 px de cada costado.
- **Fondos**:
  - con `source_urls` de la portada salen del mismo estilo;
  - `lejos-*` sale opaco (1376x768);
  - `medio-*` sale transparente ("the sky area … is fully transparent"). Se
    repiten espejados, así no hay costura;
  - las texturas de suelo se hacen sin costura mezclando con la copia corrida
    media vuelta.
- **Hojas de adornos**: "one horizontal row of 5 separate items, wide gaps"
  anduvo en las 5. Se cortan por las columnas vacías; si dos se tocan, se
  parte por la columna más vacía.

## Lo que falta

- Probarlo en un teléfono de verdad: FPS, sonido y los toques con los dos
  pedales a la vez.
- Si pide más: más vehículos, carreras en línea contra fantasmas grabados, o
  un modo "desafío" diario.
