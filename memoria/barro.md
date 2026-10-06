# BARRO (06/10)

Motocross de costado "idéntico a Mad Skills Motocross, pero mejor" (mandó un TikTok
del juego). Pidió **no usar RUTA 40**: está hecho de cero. Cómo se juega y los
comandos: `barro/README.md`.

## Armar y probar

- `node barro/herramientas/armar.mjs` → `barro/barro.html` (~4 MB, abre con doble
  clic). esbuild sale de `videos/remotion/node_modules`; el arte entra por el
  módulo `js/arte-urls.js`, que el plugin cambia por los `data:`.
- `node barro/pruebas/bot.mjs [b1,c1]` (Node, ~1 min por pista): seis pilotos;
  muestra tiempos y caídas. `navegador.mjs` (sobre `barro.html`, ~3 min): una
  carrera entera con `?bot` hasta los resultados, los 3 idiomas, acostado y el
  editor de controles; tiene que dar "Todo bien".
- Páginas sueltas para mirar: `pruebas/escena.html?t=9&pista=c1` (un cuadro de
  carrera) y `pruebas/moto.html` (las poses). Se sirven desde la raíz del repo
  (`python3 -m http.server`); el arte se busca en `globalThis.BARRO_ARTE`.

## Física (`js/fisica.js`)

- Cuerpo rígido + dos ruedas "de rayo" (bajan por su eje hasta el suelo).
  G = 13,5 para que los saltos sean secos.
- Rebotaba y despegaba después de cada caída: el amortiguador frena **2,6 veces más
  al estirarse** que al comprimirse.
- Con el empuje en el contacto, a fondo se daba vuelta (97°); con el par tomado
  0,35·r arriba del contacto hace un willy que se controla echándose adelante.
- Se cae si toca la cabeza o la espalda, si queda a más de 100° del suelo, o si
  queda parada de punta (>66°) sin avanzar 0,45 s (se quedaba trabada vertical).
- Caer paralelo a la bajada no pierde nada solo; "perfecto" suma 1,1 m/s.

## Rivales (`js/piloto.js`)

- La velocidad objetivo se calcula en el labio y se traduce a la que hay que
  traer abajo: `vObj² = quiero² + 2·G·Δh − 2·empuje·cara·0,45`. La primera
  versión estimaba con todo el tramo a fondo y frenaba desde parado en la largada.
- En el aire: dónde cae el centro de masa (tiro oblicuo) y se pone paralelo a esa
  bajada, con un error según el nivel.
- `gasMax = 0,8 + 0,2·nivel`: sin eso, los rivales "flojos" igual ganaban.

## Pistas (`js/pistas.js`)

- Tramos: recta, loma, subida, bajada, olas, doble, triple, mesa, escalón, bajón,
  ritmo y barro (la selva). El respiro entre tramos es de 11 m: con 7 no llegaban
  a la velocidad del salto siguiente.
- Cada pista sigue con parte de otra de su sede (20–60 % según el número): así
  duran 45–60 s.
- La cara de la caída va a 46°: a 52° era una pared y el que caía corto quedaba
  encerrado en el pozo.

## Dibujo (`js/dibujo.js`, `js/moto.js`)

- **La pista como en Mad Skills:** la textura de tierra se pinta en tiras de
  3–4 px corridas según la altura del suelo, así las vetas siguen la curva.
  Hay un borde de atrás con pasto (1,7 m sobre la línea), los carriles de
  profundidad van solo en el dibujo (`PROF 1,75`) y el frente es oscuro.
- La moto y el piloto están dibujados en código, en metros: el piloto lleva IK de
  dos huesos. Las rodillas tenían el lado al revés: el lado +1 las dobla hacia adelante.
- En el portón cada carril queda corrido 0,28 m por carril; si no, los seis eran
  una columna.

## El arte con Rezona (proyecto `kInklgniOF`)

- Estilo: "hand-painted graphic-novel illustration, bold black ink linework,
  cross-hatching, painterly cel shading, premium 2D motocross game".
- Para que las sedes salgan del mismo estilo, se pasa la de bosque en `source_urls`.
- **Hojas de 5 adornos:** se cortan con un alfa > 60. Con 10, la bruma unía los
  árboles; si salen menos, se parte la más ancha por su columna más vacía.
- Lo crudo queda en `barro/crudo/` (no se commitea); lo procesa
  `herramientas/arte.py` (`bosque`, `canon`, `selva`, `noche`, `tierra-*`, `pasto-*`).
- La letra es Barlow Condensed 800 en cursiva (OFL), metida en el HTML.

## Lo pintoresco (06/10, "que los árboles tengan los detalles pintorescos")

- Árboles grandes de a uno en alta resolución (`<sede>-grande0..2`, 1024x1536 →
  960 px de alto), con `source_urls` de la hoja de la sede, en una capa cercana
  (paralaje 0,8–0,92) que se mece con el viento. Los de la hoja van atrás, chicos
  y con bruma encima.
- El recorte de Rezona dejaba un **filo violeta**: `limpiar()` en `arte.py` oscurece
  el borde semitransparente, que queda como trazo de tinta.
- **Grano de lienzo y luz cálida/sombra fría horneados** en cada imagen al cargarla
  (`hornear()` en `arte.js`), igual que el desenfoque del frente. Hechos en cada
  cuadro costaban la mitad del dibujo: 263 → 71 ms por cuadro en calidad alta sin GPU.
- Sombra del barranco sobre la pista (trazos que siguen la curva) y rayos de sol
  (solo en calidad alta).
- En Chromium sin GPU la carrera corre más lenta que el reloj (cada cuadro avanza
  0,05 s como mucho): `navegador.mjs` espera hasta 150 s.

## Lo que falta

- Probarlo en un teléfono de verdad: el tacto de los mandos, los FPS y el sonido.
- Si pide más: trucos en el aire (whip), carreras contra fantasmas de otros,
  más motos.
