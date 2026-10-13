# Hacer juegos 2D y 3D — la guía definitiva

Todo lo que se aprendió en este repo entre el 22/09 y el 08/10/2026 haciendo juegos para el celular: una
decena en 2D (ZONDA, LUZ MALA, BRILLO, RUTA 40, BARRO, SALAMANCA, FILETE, NEBULOSA, TAJO, DORADO), uno en 2.5D
(KUNTUR), los 3D (el bosque, AEROPLAZA, NEVADA, CONTRAGOLPE, LA ISLA) y siete ports de juegos ajenos. Cada número
está medido y cada trampa costó una tarde. Lo que no se pudo medir (los cuadros por segundo en un teléfono de
verdad: acá no hay ninguno) se dice con esas palabras.

**Cómo se usa.** Para un juego nuevo: las secciones 0 a 2 siempre; después la 3 (2D) o la 4 (3D), y de la 5 a
la 10 cuando llegues a esa parte. La 12 son las trampas y la 13 lo que se comprueba antes de mandar. Para dárselo
a un agente (Claude Code, Codex): copiá este archivo a la carpeta del juego y decile *"Leé GUIA-JUEGOS.md antes
de empezar y seguilo"*. Cada sección dice en qué carpeta del repo está el ejemplo andando.

| | |
|---|---|
| 0 | [Lo que pide quien pide](#0-lo-que-pide-quien-pide) |
| 1 | [El camino de un juego](#1-el-camino-de-un-juego) |
| 2 | [Elegir la técnica](#2-elegir-la-técnica) |
| 3 | [2D](#3-2d) |
| 4 | [3D con three.js](#4-3d-con-threejs) |
| 5 | [Assets: Rezona e Higgsfield](#5-assets-rezona-e-higgsfield) |
| 6 | [El celular](#6-el-celular) |
| 7 | [Sonido y música](#7-sonido-y-música) |
| 8 | [Los 13 idiomas](#8-los-13-idiomas) |
| 9 | [Probar y medir](#9-probar-y-medir) |
| 10 | [Entregar](#10-entregar) |
| 11 | [Ports](#11-ports-juegos-ajenos) |
| 12 | [Trampas ya pagadas](#12-trampas-ya-pagadas) |
| 13 | [Antes de decir "listo"](#13-antes-de-decir-listo) |

---

## 0. Lo que pide quien pide

1. **Lo que pide, exacto.** Un juego en HTML es **un solo archivo que abre con doble clic** y anda sin internet.
   "En zip" es un zip por juego con el juego adentro (no el HTML solo). Un `.md` es el `.md`.
2. **Para el celular parado (9:16) primero.** Acostado y en la compu tiene que andar igual (sección 6).
3. **Nunca un juego a medio hacer** ("ni te hiciste el juego", 07/10): antes de mandarlo, un bot juega cada modo
   y se mira una hoja de capturas. Si una regla no pasa (vidas, bombas, el fin), no está terminado.
4. **Cada juego con estilo propio** (menú, botones, orden, transiciones, efectos) **y claramente mejor que el
   anterior** ("100 % mejor"), sin copiarlo. Antes de empezar, mirá qué tenía el último y subí la vara.
5. **Controles de dedo personalizables, "sí o sí"** (6.3).
6. **13 idiomas, sin cartel al arrancar** (sección 8): el del celu, y se cambia con el botón del globito.
7. **Una portada 9:16 con cada juego** ("siempre dame una portada 9:16", 10.2).
8. **La intro.** Los juegos propios van sin intro: es lo último que pidió (los seis sueltos el 01/10, los cinco de
   los zip el 08/10: "sacarles mi intro"). Si la pide, es la de JXSTUDIOS de `motor2d/intro-jxs.js` vestida al
   estilo del juego. Los ports arrancan como el original, con la intro de JXStudios y los créditos.
9. **Lo simple, rápido** ("te pedí en vertical simple y después en zip nomás, ¿pa' qué tardás tanto?"): un
   arreglo chico se hace y se manda enseguida; lo largo se prueba en segundo plano.
10. **Calidad alta, con números detrás** ("goty", "AAA"). "Anda" sin un número al lado no vale. Decí lo que no se
    pudo hacer y por qué.
11. **Música:** si manda canciones, suenan esas (en AEROPLAZA, solo esas). Lo ajeno no entra al repo, que es
    público (7.4).
12. **Ports, solo de juegos gratis** (fangames, freeware). No se portean juegos que hoy se venden, aunque sea una
    versión vieja o recortada, ni los gratis con anuncios o compras que tienen versión oficial. Tampoco se
    arreglan para publicarlos (11.1).
13. **No se instala nada aparte sin que lo pida.** Para generar, Rezona antes que Higgsfield (sección 5).

---

## 1. El camino de un juego

1. **La idea:** "tipo X" (un juego conocido como referencia de la mecánica: Archero, Block Blast, Suika, Fruit
   Ninja, Mad Skills, Hill Climb, Celeste) y un mundo propio con identidad (la Salamanca del folclore, el filete
   porteño, la tinta sumi-e, el Art Déco, la Ruta 40). Nombre corto en mayúsculas.
2. **La técnica y la pantalla** (sección 2): lo más liviano que alcance.
3. **El núcleo jugable primero:** una mecánica pulida antes que muchas, con la física determinista (3.7) para
   poder probarla con un bot.
4. **Lo que lo hace adictivo:** modos (clásico, contrarreloj, zen, del día), récords, desbloqueos, cartas o
   mejoras, un desafío del día con semilla (`rngSemilla(hoy())`: el mismo para todos ese día).
5. **El "jugo":** partículas, sacudón de cámara, cámara lenta un instante, números que saltan, combos, un cartel
   que entra con rebote, la vibración. Cada cosa en el momento justo, sin tapar el juego.
6. **Interfaz propia + controles a gusto + idiomas** (secciones 3.6, 6 y 8).
7. **Sonido** (sección 7).
8. **Una API de prueba** (`window.__juego`) **y un bot** que juegue cada modo; si hay niveles, un resolvedor que
   los compruebe (sección 9).
9. **Medir** (rendimiento, peso) y **mirar capturas** parado, acostado y en la compu.
10. **Entregar** (sección 10): un archivo, portada 9:16, zip, README del juego y la nota de la memoria.

---

## 2. Elegir la técnica

| técnica | para qué | ejemplos | peso del HTML |
|---|---|---|---|
| **2D en píxeles** (lienzo chico, escala entera) | arcade, roguelite, puzzle, plataformas | SALAMANCA (180 de ancho), FILETE (216), ZONDA, LUZ MALA, BRILLO | 110-310 KB |
| **2D liso** (vectorial, unidades lógicas) | física, neón, tinta, pinball | NEBULOSA, TAJO, DORADO (360 de ancho) | 90-160 KB |
| **2D pintado** (arte generado) | autos, motos, paisajes con paralaje | RUTA 40, BARRO | 3-4 MB |
| **2.5D de papel** (recortes de píxeles en un diorama 3D) | aventura con historia | KUNTUR | 860 KB |
| **3D** (three.js) | exploración, social, tirador, cinemática | el bosque, AEROPLAZA, CONTRAGOLPE, NEVADA | 4-12 MB |
| **Port** | un juego ajeno y gratis | sección 11 | hasta 30 MiB |

- **Arte y sonido con código = 100 a 200 KB** que abren al instante y se mandan por el chat. Es lo primero que
  conviene cuando no hace falta foto.
- El 3D se gana el lugar con la luz, no con los polígonos (4.1). En KUNTUR el dueño rechazó el low-poly ("no me
  convence el modelo 3D"), pidió cubos de pixel art y al final "¿no puede ser como un Paper Mario?": pixel art
  impreso en recortes de papel con borde blanco sobre un diorama de cartón.
- Para un port, la técnica la pone el original (sección 11).

---

## 3. 2D

### 3.1 Cómo se arma (`motor2d/`)

- `node motor2d/armar.mjs <juego>` lee `<juego>/juego.json` (`salida`, `css`, `js` en orden) y
  `<juego>/index.html` (con `<!--CSS-->` y `<!--JS-->`), mete todo en una sola función `'use strict'` y revisa la
  sintaxis con `vm`: si falla, dice el archivo y la línea. Sale `<juego>/<juego>.html`.
- **Todos los archivos comparten el ámbito.** Las funciones se elevan, pero un `const` de arriba existe recién
  cuando corre su archivo (el orden de `js` importa) y **un nombre repetido en dos archivos rompe el armado**.
  Lo compartido se busca con `typeof x === 'function'` si un juego puede no traerlo.
- Lo compartido: `motor2d/fuente.js` (la letra de píxeles), `motor2d/idiomas.js` (los 13 idiomas),
  `motor2d/intro-jxs.js` (la intro). El resto de `motor2d/` es de ZONDA y LUZ MALA: cada juego nuevo trae su
  propia interfaz.
- La forma que anduvo en los cinco de octubre: `base.js` (tamaños, `rngSemilla`, `Guardado`, `DATOS`, `TXT` y
  `tr()`), `idiomas.js` (las traducciones), `arte.js`, la física, `sonido.js` y `juego.js` (escenas, botones,
  entrada, bucle y `window.__juego`). Ejemplos: `tajo/`, `nebulosa/`, `dorado/`, `filete/`, `salamanca/`.
- Los juegos con módulos (BRILLO, RUTA 40, BARRO, KUNTUR) se arman con esbuild en un IIFE, del
  `node_modules` de `bosque/` o de `videos/remotion/` (sin instalar nada). El arte entra por un módulo virtual que
  un plugin cambia por `data:` (`ruta40/herramientas/armar.mjs`).

### 3.2 La pantalla

**En píxeles** (SALAMANCA, FILETE):

- Ancho lógico fijo que divida justo los anchos comunes (180 o 216: en 1080 px reales, escala 6 o 5) y el alto
  que se acomoda al celu (320-420, 384-520). Lo que sobra se reparte con proporciones (`TY = 74 + libre × 0,4`).
- `esc = floor(min(innerWidth·dpr / W, innerHeight·dpr / altoMínimo))`; el lienzo mide `W·esc/dpr` en CSS, con
  `image-rendering: pixelated`, y `imageSmoothingEnabled = false` **otra vez después de cada cambio de tamaño**
  (cambiar el lienzo lo resetea).
- **El lienzo a la resolución real:** `RES = clamp(floor(esc), 1, 4)`, `lienzo.width = W·RES` y
  `g.setTransform(RES, 0, 0, RES, 0, 0)` al empezar cada cuadro. Los píxeles quedan iguales y el texto en letra del
  sistema (árabe, japonés…) sale nítido (sección 8). Lo que se guarda pintado con texto (las cartas de SALAMANCA)
  también va a `W·RES` con `scale(RES)` y se estampa con el tamaño lógico.
- Lo que no ocupa el juego, con algo del mundo y nunca negro (LUZ MALA: 16 baldosas de madera alrededor de cada
  sala, así en el celu parado la sala no flota).

**Lisa** (NEBULOSA, TAJO, DORADO):

- Unidades lógicas de 360 de ancho, el lienzo a `innerWidth·dpr` y `S` = píxeles reales por unidad;
  `g.setTransform(S, 0, 0, S, 0, 0)` al empezar el cuadro.
- Lo caro se pinta una vez en un lienzo a resolución `S` y se estampa con el tamaño lógico. **La clave de esa
  caché lleva `S`**: al girar el celu se rehace.
- Una mesa de tamaño fijo (el pinball de DORADO, 360 × 600) va abajo y lo que sobra arriba es marquesina.

### 3.3 Arte con código

- **Arte en texto** (SALAMANCA `js/arte.js`): una letra por píxel y una paleta; lo simétrico se escribe por la
  mitad (`sim()`). Para retocar, una hoja con todos los sprites en Chromium: una sola captura.
- Formas de píxel con `fillRect` (discos, volutas, cintas) y sin suavizado. **Una forma con cortes** (la cinta en
  V de FILETE) se arma en su propio lienzo: un `clearRect` en el principal haría agujeros.
- Letras y títulos con **degradé por fila** (7 tonos), contorno de 1 px y sombra corrida: se leen sobre cualquier
  fondo.
- **Lo que no cambia, una sola vez:** la piel y el corte de cada fruta (TAJO), lo quieto de la mesa (DORADO), los
  fondos. Las mitades de una fruta son el dibujo del corte recortado por la línea del tajo.
- **Polígonos en vez de círculos** cuando el trazo es de pincel: el contorno varía de grosor y se puede cortar.
- **Hornear los efectos** (grano de lienzo, luz cálida y sombra fría, desenfoque del frente) en cada imagen al
  cargarla. Hechos en cada cuadro costaban la mitad del dibujo: BARRO bajó de 263 a 71 ms por cuadro sin placa.
- Los números de la interfaz, las partículas y los botones, siempre con código: más nítidos y gratis.

### 3.4 Arte pintado (RUTA 40, BARRO)

- **Un estilo escrito igual en cada pedido** (BARRO: *"hand-painted graphic-novel illustration, bold black ink
  linework, cross-hatching, painterly cel shading, premium 2D motocross game"*) y **la primera imagen buena como
  referencia** (`source_urls`) para las demás: así las sedes salen del mismo mundo.
- **Hojas de adornos:** *"one horizontal row of 5 separate items, wide gaps"* anduvo las 5 veces. Se cortan por
  las columnas vacías (alfa > 60); si dos se tocan, se parte por la columna más vacía. Con 10 por hoja la bruma
  los unía.
- **Fondos en capas:** el lejano opaco; el del medio con *"the sky area … is fully transparent"*; se repiten
  espejados (sin costura). Paralaje de 0,8 a 0,92 para la capa cercana, que se mece con el viento.
- **Vehículos:** *"wheel wells EMPTY, NO wheels, NO tires"* anduvo en 4 de 5; el que vino con aros salió bien con
  *"wheels REMOVED for repair, NO rims, NO rings, NO hubs"*. Las ruedas van **delante** del chasis (el hueco viene
  pintado de negro). Centro y radio de cada rueda, medidos a ojo sobre una grilla y comprobados pegando la llanta
  encima: medirlos por el color no anduvo (los contornos negros confunden). Lo que vino mirando al revés se espeja.
- **Los recortes automáticos dejan un filo de color** (rosado, violeta) y columnas medio transparentes a los
  costados: oscurecer el borde semitransparente (queda como trazo de tinta) y sacar 3 px de cada lado.
- **La pista como en Mad Skills:** la textura de tierra se pinta en tiras de 3-4 px corridas según la altura del
  suelo, así las vetas siguen la curva; borde de atrás con pasto y el frente oscuro.

### 3.5 Letras

- `motor2d/fuente.js`: letra de píxeles 5×7, mayúsculas con `ÁÉÍÓÚÑÜÂÃÀÊÔÕÇÖŞĞİ` y signos. `textoPx` (con
  `escala` entera), `anchoTexto`, `envolver` (partir en renglones), `textoLetras` (de a una letra, para tipear).
  Lo que no tiene sale con la letra del sistema, nítida y en el mismo lugar (sección 8).
- **Una letra TTF sin el peso del TTF** (DORADO): `herramientas/glifos.py` saca solo los contornos de los
  caracteres que se usan a un objeto JS (Limelight: de 132 a 28 KB) y se dibujan con `Path2D`, con degradé, borde
  y sombra. Anda con cualquier letra OFL.
- Una letra web entera va como woff2 adentro del CSS (Overpass en RUTA 40, Barlow Condensed en BARRO).
- Nada de letras generadas por IA: salen mal. Títulos de portada y carteles, compuestos aparte.

### 3.6 Escenas, botones y transiciones

- Una variable `escena` y un `switch` en el bucle. `irA(nueva, alMedio)` hace la transición: el telón cierra,
  cambia a la mitad y abre. **Durante una transición `irA` no hace nada** (las pruebas esperan ~1 s).
- **Cada juego su telón:** rombos de colores (FILETE), iris de luz (LUZ MALA), aguayo que se frunce (KUNTUR),
  telón de rombos oscuros (SALAMANCA). Y sus botones: placas de piedra con borde de oro (SALAMANCA), píldoras de
  neón (NEBULOSA), boletos de tren (KUNTUR), palabras que se prenden con dos luciérnagas de cursor (LUZ MALA).
- Botón dibujado en el lienzo: `boton(x, y, w, h, txt, o)` lo dibuja, se hunde 1 px mientras el dedo apreta y
  devuelve `true` en el clic. **El clic cuenta si el dedo bajó y subió adentro** (con 4 px de margen): un arrastre
  no aprieta.
- Entrada por cuadro: `E.punteros` (un `Map` por `pointerId`), `E.toque`, `E.clic`, `E.suelta` y las teclas
  recién apretadas; se vacían al final de cada cuadro.
- **Escape abre y cierra la pausa en el mismo cuadro** si la pausa también lo escucha: atenderlo recién con
  `tEsc > 0` (TAJO) o separar "pausa" de "volver" (KUNTUR).
- **Nada de lógica en el dibujo** (LUZ MALA confirmaba el farol al dibujarlo y las pruebas perdían el toque).
- Al esconder la pestaña (`visibilitychange`): pausa y el audio en pausa.
- El texto largo se parte midiendo (`envolver`/`partirMedido`), nunca por cantidad de letras. Los botones achican
  la letra hasta que el texto entra (`tamQueEntra` de NEBULOSA).

### 3.7 El bucle y el tiempo

- **`requestAnimationFrame` primero y después `try { … }`:** un error en un cuadro no congela el juego.
- `dt = max(0, min(0,05, (ts − último) / 1000))`.
- **Física con paso fijo de 60 por segundo, pura y determinista:** nada de `Math.random` adentro (el azar, con
  semilla), así Node corre el mismo código para el bot y el resolvedor. Cámara lenta multiplicando el paso
  (`J.lenta`).
- **Lo que se anima en el dibujo va con el reloj real**, no con el paso de la física: con el paso, en una pantalla
  de 120 Hz va al doble (LUZ MALA).

### 3.8 La física, por género (lo medido)

- **Plataformas** (ZONDA, LUZ MALA, BRILLO, KUNTUR): un resolvedor A* en Node comprueba cada sala o tramo con la
  misma física. La clave de "ya visto" lleva **todo** lo que cambia el futuro (el estado de una carta, el tiempo
  colgado, el viento); la heurística es la distancia BFS por la grilla (con la altura sola se traba en las salas
  de costado). Nunca dos resolvedores a la vez: escriben el mismo archivo. Encontró errores que una persona tarda
  en ver: el viento la empujaba contra las púas sin matarla.
- **Autos y motos** (RUTA 40, BARRO): cuerpo rígido con ruedas "de rayo" (bajan por su eje hasta el suelo).
  - El amortiguador frena **2,6 veces más al estirarse** que al comprimirse; si no, rebota y despega.
  - El empuje con el par tomado **0,35·r arriba del contacto**: en el contacto, a fondo se daba vuelta (97°).
  - Los topes de la suspensión son restricciones con impulso acumulado (frenan solo lo que se pasa); los sesgos
    de corrección tienen tope (2,5 m/s) y el casco empuja 2 cm por paso como mucho. Sin eso, salía a 80 m/s
    contra una rampa.
  - El casco lleva un punto cada 45 cm (ninguna cresta pasa entre dos) y la pista un **límite de curvatura**
    (crestas de 3 m de radio, pozos de 2 m como mínimo).
  - Se cae si toca la cabeza, si queda a más de 100° o parada de punta 0,45 s sin avanzar. G = 13,5 para que los
    saltos sean secos.
  - Los rivales calculan la velocidad que necesitan en el labio y la traducen a la que hay que traer abajo
    (`vObj² = quiero² + 2·G·Δh − …`); en el aire, apuntan a ponerse paralelos a la bajada donde caen.
- **Fusionar** (NEBULOSA, tipo Suika): 3 subpasos × 3 pasadas de separación pesadas por masa (r²); choque y
  rozamiento solo en la primera pasada (así las pilas no tiemblan); la fusión nace con el radio chico y crece.
- **Pinball** (DORADO): 12 subpasos; paredes = cápsulas; el flipper empuja con la velocidad del punto donde pega
  (s·ω), por eso la punta tira más. **Medir antes de ubicar:** con la simulación sin dibujo se vio dónde cae la
  bola según la fuerza del resorte, y ahí van los blancos (los de arriba no los tocaba nadie).
- **Cortar** (TAJO): las muestras del dedo con `getCoalescedEvents` y su `timeStamp`; corta solo el tramo más
  rápido que la sensibilidad (950/600/340 u/s). Lanzar con `v = √(2gh)` para llegar justo a una altura; la
  dificultad acelera el tiempo de las frutas, no la curva.
- **Roguelite** (SALAMANCA): apuntar centro a centro; el bicho que toca rebota (si no, se quedaba encima y ella
  tiraba al piso); lo que se junta va derecho, sin inercia (con inercia orbitaba sin llegar).
- **Bloques** (FILETE): la tanda de piezas busca que entren las tres (10 posiciones por pieza, 6 órdenes).

### 3.9 Rendimiento en 2D (medido en BRILLO y BARRO)

- **El efecto a la resolución de la pantalla era el lag:** en un celu de 3 píxeles por punto son 2,7 millones de
  píxeles con ~25 lecturas cada uno. Componer a la resolución del juego (622×288) y agrandar con **una sola
  pasada de una lectura por píxel** ("sharp bilinear").
- **Miles de cosas por cuadro, a una vez:** el arcoíris (4.700 `fillRect`, ~30 ms) se pinta una vez; las cortinas
  de aurora van a un búfer de media resolución cada dos cuadros; la estática de TV son 32 variantes pintadas al
  arrancar; las cáusticas, tablas por columna y fila (de 6-23 a 1,5 ms); dos `Path2D` en vez de un `fillRect` por
  columna.
- `putImageData` en un lienzo de la placa tarda (9 ms): ese búfer va en un lienzo con `willReadFrequently`.
- **`backdrop-filter` encima del juego que se mueve se recalcula en cada cuadro:** afuera del HUD y de los botones.
- **Calidad automática:** alta → media → baja si da menos de 48 cuadros por segundo; nunca sube sola y queda
  guardada.
- **Para medir:** frenar el bucle del juego, precalentar 20 cuadros y usar el `Profiler` por CDP. Envolver
  funciones con `performance.now` con el bucle andando mezcla todo.

### 3.10 Guardado

- `localStorage` con prefijo por juego (`tajo.datos`, `tajo.idioma`) y **siempre en `try/catch`** (en modo
  privado tira): sin guardado se juega igual.
- `DATOS = Object.assign({ …valores de fábrica }, leer('datos', {}))`: un campo nuevo no rompe lo guardado. Las
  opciones llevan versión (`v: 2`) para migrar lo viejo.
- La partida en curso se guarda y el menú ofrece "SEGUIR LA PARTIDA".

---

## 4. 3D con three.js

### 4.1 La regla que ordena todo lo demás

**Un juego se ve bien por la luz, no por los polígonos.** Lo que más rinde, de mayor a menor:

1. **Una sola hora del día y un sol que manda.** Un atardecer con el sol rasante da sombras largas y contraste. La
   luz ambiente nunca puede sumar más que el sol sobre el suelo: si lo hace, todo sale plano y lechoso.
2. **Atmósfera:** niebla del color del horizonte del cielo, más densa en lo bajo y dorada hacia el sol.
3. **Tono de película:** dibujar en HDR (coma flotante) y aplicar AgX o ACES al final. Los valores por defecto de
   three.js dan "plástico gris".
4. **Materiales de foto:** texturas repetibles con mapa de normales en vez de colores planos.
5. **Densidad antes que detalle:** tres mil árboles simples con tres niveles de detalle se ven mejor que cincuenta
   perfectos.
6. **Todo se mueve un poco:** viento en las plantas, polvo en el aire, la cámara con mano, fuego y agua.
7. **Un posproceso con identidad** (VHS, grano, PS1): borra lo que delata lo falso.
8. **Sonido con distancia:** lo lejano con reverberación.

Los pasos 1, 2, 3 y 7 no cuestan ni un asset. Hacelos siempre.

### 4.2 El orden de las pasadas

```
escena → target HalfFloat con profundidad (HDR)
      → rayos de sol a 1/4 de resolución (desde la profundidad)
      → revelado: tono AgX + rayos + letreros → target de 8 bits
      → final: VHS (o grano + viñeta) → lienzo
```

- **HDR (`HalfFloatType`)** si la placa puede (`EXT_color_buffer_float` o `_half_float`); si no, 8 bits y el ruido
  del post disimula los escalones.
- **`renderer.toneMapping = NoToneMapping`**: el tono lo pone tu última pasada (three aplica tono y sRGB solo al
  dibujar en pantalla). **Revelar una vez:** el VHS lee cada píxel ~19 veces.
- **Resolución interna baja, estirada por CSS.** Con VHS, 480 líneas del lado corto: la cuarta parte de los píxeles
  de un teléfono.
- **El lienzo se cambia de tamaño al EMPEZAR el cuadro** (cambiarlo lo borra: hecho después de dibujar, se ve un
  cuadro negro).
- Rayos de sol: desde cada píxel hacia el sol en pantalla, 30 muestras de la profundidad; donde vale 1 es cielo y
  se suma su brillo. Se apagan de a poco cuando el sol sale de cuadro.
- **Los `ShaderMaterial` propios** (cielo, mar, burbujas) escriben color lineal: dibujando derecho a la pantalla
  les falta el tono y el sRGB (agregar `tonemapping_fragment` y `colorspace_fragment`; hacia un destino intermedio
  no hacen nada).

### 4.3 La luz, con números

| | valor | por qué |
|---|---|---|
| sol (direccional) | color (1, 0,74, 0,5), intensidad 4,6 | manda sobre todo |
| cielo (hemisférica) | (0,5, 0,58, 0,74) / suelo (0,16, 0,13, 0,08), 0,5 | relleno azul de la sombra |
| reflejo del panorama (`environmentIntensity`) | 0,26 | solo para que lo PBR tenga vida |
| sombra | mapa 2048, caja ±34 m que sigue al personaje, `bias -0.0006`, `normalBias 0.05` | una caja de todo el mapa es un borrón |
| niebla | `FogExp2` 0,003 + bruma baja 0,0075 que cae cada 9 m | 4.4 |

- **La caja de sombra avanza de a un texel:** si sigue al personaje de forma continua, los bordes de sombra
  titilan al caminar.
- **Luz ambiente doble** (AEROPLAZA): el cielo como `environment` más la hemisférica pintaban de celeste la arena.
  Quedó env 0,3-0,7 y hemi 0,18-0,5.
- **Bloom con umbral 1,45**, no 0,9: con 0,9 todo lo blanco al sol se abre en niebla.
- **Vidrio:** opacidad 0,12, env 0,7 y un borde fresnel. Con clearcoat y env, mirado de costado era una pared
  blanca.
- **Una luz de punto que quema** (el farol de KUNTUR, el faro de NEVADA): intensidad 2,4, baja y apuntada. Una
  SpotLight de 6 quemaba.
- **Adentro de un edificio**, la hemisférica y el reflejo del cielo tienen el pasto abajo y el techo sale verde:
  en interiores se cambian por un `RoomEnvironment` y un suelo claro.
- `PCFSoftShadowMap` ya no existe en three r18x. Las sombras se apagan en caliente con `sol.castShadow = false`.

### 4.4 La niebla que hace la mitad del trabajo

Se reemplazan los trozos `fog_*` de three por una niebla con **bruma baja** (integrada a lo largo del rayo) y
**color de sol**:

```glsl
vec3 nieblaDe(vec3 col, vec3 posVista) {
  float dist = length(posVista);
  vec3 dirV = posVista / max(dist, 1e-4);
  float dy = (uVistaMundo * dirV).y;            // dirección del rayo en el mundo
  float k = uNieblaCaida * dy;
  float integ = abs(k) > 1e-4 ? (1.0 - exp(-k * dist)) / k : dist;
  float baja = uNieblaAlta * exp(-uNieblaCaida * (uCamY - uNieblaBase)) * integ;
  float cantidad = 1.0 - exp(-(fogDensity * dist + baja));
  float sol = pow(max(dot(dirV, uSolVista), 0.0), 6.0);
  return mix(col, mix(fogColor, uNieblaSol, sol * 0.9), clamp(cantidad, 0.0, 1.0));
}
```

- `uVistaMundo` = la rotación de `cam.matrixWorld`; `uSolVista` = el sol en espacio de vista, una vez por cuadro.
  **El color de la niebla es el de la bruma medida en el panorama**: si no coincide, el horizonte parece el borde
  del mundo.
- **La niebla dice hasta dónde dibujar:** con exp² de densidad d no se ve nada más allá de ~2,6/d (0,04 → 65 m;
  0,022 → a 125 m tapa el 99,95 %). Lo que queda detrás no se dibuja (4.11). No cortes la cámara a esa distancia:
  se ve el cielo donde iría el terreno.

**Parchear shaders sin que se pisen** (dos trampas que no dan error):

1. `onBeforeCompile` es **uno** por material: el segundo parche borra al primero. Hay que encadenar.
2. Three **reutiliza programas** entre materiales con el mismo texto de `onBeforeCompile`: cada parche necesita su
   clave en `customProgramCacheKey`.

```js
export function parchear(mat, clave, fn) {
  const previo = mat.onBeforeCompile, clavePrevia = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (sh, r) => { previo.call(mat, sh, r); fn(sh, r); };
  mat.customProgramCacheKey = () => clavePrevia + "|" + clave;
  mat.needsUpdate = true;
  return mat;
}
```

Y **una sola vez por material** (marcalo en `mat.userData`): el segundo parche no encuentra lo que el primero
reemplazó. No declares el mismo `uniform` en dos parches del mismo shader (`redefinition`). Un parche que usa
`instanceMatrix` va con `#ifdef USE_INSTANCING`.

### 4.5 El terreno

- **Una sola rejilla para la malla y para la física**, interpolada **por triángulo** como la dibuja la placa
  (`PlaneGeometry` corta cada cuadro por la diagonal de (i, j+1) a (i+1, j)). Con una función de altura aparte, el
  personaje flota en las lomas y se hunde en los pozos.
- El hash del ruido con **`Math.imul`**, nunca con `*`: los bits bajos se redondean y el terreno sale plano.
- Máscaras por vértice (sendero, musgo, pasto, sombra de copa) y roca por pendiente en el shader. **Mezcla por
  altura** entre texturas: gana la que sobresale en cada píxel (un degradé parejo parece pintura aguada).
- **Contra la repetición:** la textura mezclada con ella misma girada y a otra escala según un ruido grande, más
  variación de tono cada decenas de metros.
- **Una textura repetible como grano y no como color** (AEROPLAZA): dividirla por su último mip
  (`texture2D(t, uv, 12.)`) y que el color lo ponga el vértice. Como color dejaba el suelo lavado.

### 4.6 La vegetación (lo que más cuesta que se vea bien)

**No generes árboles enteros en 3D:** un imagen-a-3D devuelve la copa como un bloque de arcilla. Lo que anda: **el
esqueleto por código y las fotos en tarjetas.**

- Tronco que se afina, con el pie ensanchado y raíces, que **empieza 0,6 m bajo el suelo** (en una loma, si no, un
  lado queda en el aire). Pisos de ramas cada ~1 m, 4-6 por piso, cayendo con el largo.
- **Tarjetas del tamaño de una ramita de verdad** (~0,35 + 0,3 × largo, hasta 1,35 m), encimadas a lo largo de la
  rama; una de cada dos, cruzada más vertical.
- **Normales hacia afuera del tronco, no las del plano**; **oscuridad interior por color de vértice**;
  **contraluz** (color × sol × `pow(dot(-vista, sol), 5)`).
- **Viento en el shader de vértices, igual para tronco y copa** (si solo se mueve la copa, las ramas se despegan).
  Árboles que se doblan desde la base (`k = (y/alto)²`) con ráfagas que cruzan el mapa; el viento va para el
  mismo lado del mundo aunque la copia esté girada.
- **Alfa nítido en todos los mips** (si no, de lejos el follaje desaparece):

```glsl
vec2 dx = dFdx(vMapUv * 1024.0), dy = dFdy(vMapUv * 1024.0);
float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
diffuseColor.a *= 1.0 + mip * 0.28;
```

- **La copa arranca arriba de la cámara** (5-6,5 m), ninguna rama baja de 3,2 m, y el follaje a menos de ~2 m se
  descarta con un tramado.
- **Tres niveles de detalle:** cerca el completo (~2.600 triángulos), a media distancia ~500, lejos **dos planos con
  una foto del mismo árbol** sacada al arrancar con una cámara ortográfica, con **fondo verde y alfa cero** (negro
  le deja contorno de carbón).
- **Pasto:** una grilla que se enrolla alrededor del jugador (52 m de lado) y lee la altura de una textura float
  horneada. Fijo, o era ralo o eran millones de matas.
- **Flores planas** (~40 triángulos, no 5 esferas de 500) y **solo las de cerca** (a menos de 60 m): instanciadas en
  toda la isla eran medio millón de triángulos que ni se veían.

### 4.7 Agua sin dibujar la escena dos veces

Reflejo del mismo panorama y **oscurecer abajo del horizonte reflejado** (la orilla de enfrente), fresnel, dos capas
de olas que viajan distinto, **olas aplanadas con la distancia** (si no, el reflejo titila), un brillo angosto y
fuerte hacia el sol y el alfa subiendo con la profundidad para ver el fondo en la orilla.

### 4.8 Personaje, cámara y controles

- **Choque por empuje** (círculos, cápsulas y cajas, tres pasadas para los rincones): contra un tronco se desliza.
  Una **rejilla de sólidos** (casillas de 16 m): con cientos de árboles cada consulta mira solo su casilla.
- **Cámara por encima del hombro** (3,7 m, corrida 0,42 a la derecha) que se acerca **instantánea** ante un choque y
  se aleja **lenta**, y vuelve sola detrás 1,5 s después del último arrastre. `mundo.tapa()` le dice si un punto
  está adentro de algo (no se mete en las casas). Tiembla apenas, como una mano.
- **El campo fijo en horizontal** (78°): con el vertical fijo, en un celu parado se ve una rodaja del mundo. En
  vertical el campo horizontal queda en ~35° con fov 58: la cámara mira al personaje, no "al costado".
- **Joystick donde cae el pulgar** en la mitad izquierda (a fondo corre: un botón de correr es un dedo que no hay);
  la derecha gira la cámara. **Cada dedo por su `pointerId`.** Más en 6.3 y 6.4.
- **Primera persona** (AEROPLAZA): ojos a 1,5 m, el pitch con hamaca al caminar; los brazos pegados a la cámara y
  dibujados encima de todo (`depthTest` apagado), finitos (0,046: cerca de la cámara todo se agranda); el cuerpo
  propio con un material que **solo hace sombra** (`colorWrite` y `depthWrite` apagados): mirando abajo se ven las
  piernas y la sombra entera. El punto de mira es un rayo contra todas las mallas (las paredes tapan).
- **Animar por poses** (AEROPLAZA `js/animador.js`): poses clave por canal sobre un rig de 7 piezas, con estilos
  **suave** (smoothstep), **lineal** y **chop** (tres escalones, tiempo a 12 cuadros, sin suavizado). Inclinarse
  en las curvas, aplastarse al caer, estirarse al saltar, mirar alrededor si queda quieto.
- **Moverse con gusto:** deslizar corriendo (pasa bajo barras), rodar, trepar un borde a la altura del pecho,
  rebotar en la pared (lo tangencial ×0,92 y 6,8 hacia afuera).

### 4.9 El aire y el posproceso

- **Polvo:** ~420 puntos en un cubo que viaja con la cámara, casi invisibles de espaldas al sol y brillantes de
  frente.
- **Fuego:** llamas de ruido con forma de gota y valores **por encima de 1**, chispas, humo **oscuro** (un gris en
  HDR brilla como algodón) y una luz que tiembla sin sombra.
- **Copos grandes (bokeh):** más tenues cuanto más grandes y apartados del centro del cuadro (cerca de la lente
  lavaban la cara del tigre en NEVADA).
- **VHS** (el bosque): YIQ con cada parte en su ancho de banda (luminancia ~330 puntos por línea, color ~45 y
  corrido), el halo del afilado, temblor de líneas, la franja de tracking, el cabezal roto abajo, grano y **la
  fecha estampada adentro de la imagen** (un texto HTML nítido sobre un video borroso se ve pegado). También sirve
  de mecánica: cerca de un ítem la imagen falla más.
- **Estilos retro como opción** (AEROPLAZA): Pixel 270p, PS1 200p con el temblor de vértices (un `#define PS1` en
  `ShaderChunk.project_vertex`), Game Boy 144p (con `pow(l, 1.3)` y la paleta de emulador), 8 bits (paleta Sweetie
  16), VHS. Se dibuja de verdad a pocas líneas con `image-rendering: pixelated`: además son la calidad más liviana.

### 4.10 Modelos: de Rezona o Tripo a la web

- **Imagen propia → 3D** sale mucho mejor que desde texto: tarda ~155-185 s y **llega pesadísimo** (28-46 MB y de
  650 mil a 990 mil triángulos). La cadena con `@gltf-transform`: `weld` → `simplify` → texturas a 1024 en webp →
  `quantize` → `prune`. Un objeto repetido va a ~2.500 triángulos; uno único y cercano, hasta 20 mil; un auto
  protagonista, 70 mil (NEVADA: de 35-46 MB a 1,3-1,8 MB).

```js
await doc.transform(weld(), dedup(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.33, error: 0.012 }));
await doc.transform(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 78 }));
await doc.transform(quantize(), prune());
```

- **`error` es relativo al tamaño del modelo:** con 0,001 casi no toca nada; con 0,012 llega al ratio.
- **La trampa del modelo cuantizado** (`KHR_mesh_quantization`): las posiciones son enteros de 16 bits entre -1 y 1
  y la escala va en el nodo. **Girar, escalar u hornear esa geometría la recorta sin aviso:** una cabaña de 9,5 m
  quedó en un cubo de 2 m; el auto, hecho una caja. Antes, a coma flotante con la matriz horneada:

```js
function aFlotante(g) {
  for (const [nombre, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const n = a.count, k = a.itemSize, d = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) d[i * k + c] = a.getComponent(i, c);
    g.setAttribute(nombre, new THREE.BufferAttribute(d, k));
  }
  return g;
}
```

- **No respetan escala ni orientación:** llegan en un cubo de 1 m y mirando para cualquier lado. Medir la caja,
  llevar al tamaño real, apoyar un poco hundido (una roca justo en su punto más bajo parece calcomanía) y
  **medir el giro con una hoja de seis vistas** (NEVADA `pruebas/ver_modelos.mjs`; el delfín miraba a -z).
- **Atributos compartidos:** una geometría armada con los atributos de otra los comparte y `translate()` mueve las
  dos (las ruedas corrían la carrocería 0,7 m).
- **Ruedas de una malla de una pieza:** el centro es donde las distancias se juntan en anillos (la mayor suma de
  cuadrados del histograma); el radio, la altura del centro. La mediana de lo que toca el piso no sirve.
- **Pintura espejo de Tripo:** en la nieve se ve blanca y el auto desaparece: metalness ×0,55, rugosidad ≥ 0,3 y un
  entorno más oscuro.
- **Lo que se repite mucho, procedural:** AEROPLAZA pasó 16 construcciones de GLB a código copiando las
  referencias (casa, estación, hotel, tren, muebles), cada una fundida por material (2 a 13 llamadas), con las
  medidas que salen del armado (andén, asiento, pantalla). El HTML bajó de 8,2 a 4,2 MB.

**Esqueleto y animaciones:**

- `submit_rig3d_generation` con el `gtask-…` de **tu** modelo 3D; cada animación se cobra aparte. **Comprobá lo que
  llegó** (`gltf-transform inspect`): en `perro/` las tres volvieron como la misma caminata de cuadrúpedo. Si falta
  un clip, un esqueleto propio por regiones de vértices (el tigre de NEVADA: las patas son columnas; lo que está
  bajo la panza pero lejos de la pata va con el cuerpo).
- **Medí antes de programar:** si viene "en el lugar" (el canal de la cadera); el ciclo en segundos (cruces del
  muslo: caminar 1,411 s, correr 0,767 s); `timeScale = velocidad / (zancada / ciclo)` (si no, los pies patinan);
  caminar y correr **en la misma fase** al mezclarlos; la velocidad que anima es la recorrida de verdad.
- **El alto, por los huesos** (no con `Box3.setFromObject`, que da la pose de reposo). `frustumCulled = false` en la
  malla con esqueleto. Revisá que el color no venga enchufado como **emisivo** (brillaba en la sombra).
- Si cada animación llega en un GLB distinto: una malla y los otros clips **reenganchados a los huesos por nombre**
  (`bosque/herramientas/optimizar_modelos.mjs`).
- **Poses sin memoria** para cinemáticas: `pose(t)` en vez de `paso(dt)`, así ir a un instante da siempre la misma
  foto.

### 4.11 Rendimiento y calidad

**Lo que pesa es la geometría, no los materiales** (AEROPLAZA en baja: 1,75 millones de triángulos en 459 llamadas;
pasar a materiales Basic bajaba solo un 30 %).

- **Todo lo repetido, instanciado y recortado** por distancia y pantalla. La esfera de recorte crece con la
  distancia (`radio + d × 0,16`) y la lista se rehace al girar 0,12 rad. A menos de 30 m entra aunque no se vea (su
  sombra sí puede verse). El detalle completo, solo hasta el borde de la caja de sombra.
- **Lo fijo, fundido por material y por celda** (200 m en Bus Stop: ~72 llamadas; los muebles del hotel: 421 → 255).
  `fundir` pierde los grupos de caras: lo que tiene tapas sacadas no se funde.
- **Detalle por distancia** cada 0,5 s (la versión liviana a ~600 triángulos) y **corte detrás de la niebla:**
  `visible` como getter de "lo que quiere el juego Y no está cortado", así no se pisa lo que el juego esconde. Las
  instancias quietas se reordenan y se dibujan las de cerca.
- **Mallas tontas del original:** paredes y pisos de 200 triángulos (un Plane de 10×10) pasan a 2 (Baldi: de 450 mil
  a 27 mil); cajas redondeadas de 588 triángulos con 1 segmento en la calidad baja.
- **Calidades con números:** cada una con su corte (baja 170 m, media 300), pasto, reflejos y segmentos. La
  **mínima** dibuja derecho a la pantalla (sin post ni brillo), a 0,6 de los píxeles, sin pasto, sin barniz ni
  tornasol, niebla y corte a 95 m.
- **El aparato decide cómo arranca** (`aeroplaza/js/aparato.js`): nombre de la placa
  (`WEBGL_debug_renderer_info`), memoria, núcleos, píxeles, táctil. Por software, siempre la más baja. **En el
  celu, nunca en alta de entrada** (con MSAA, doble de píxeles y sombras de 2048 fue una de las causas probables
  de "no me deja jugar"). Después, la
  automática mide 60 cuadros de **tiempo real** (no el dt recortado) y baja un escalón si pasa de 30 ms, o sube si
  sobra. Si se pierde el contexto, a la mínima.
- **La carga:** `renderer.debug.checkShaderErrors = false` (eran 9 de 14 s en SwiftShader: de 13,5 a 2,9 s);
  `await renderer.compileAsync(escena, cam)` con la pantalla de carga puesta y con cada malla instanciada vacía en
  `count = 1`.
- **El ensayo con el telón cerrado** (KUNTUR `js/escena.js › ensayar`), contra el tirón de la primera vez de cada
  cosa: `compileAsync` con el render target del posproceso puesto (el programa cambia según adónde se dibuja), las
  texturas subidas de a pocas por cuadro y una pasada con todo a la vista. **Siempre la misma cantidad de luces de
  punto** (una apagada de relleno): three arma un programa por cantidad de luces. Lo viejo se libera después del
  ensayo de lo nuevo. Resultado: la tarea más larga del prólogo, de 10 s a 0,23 s.
- **Celulares flojos** (CONTRAGOLPE, medido con el procesador 6 veces más lento):
  - las armas de los bots eran 85 mallas (y otras tantas en la sombra): fundidas por material y armadas una vez
    por tipo;
  - **los huesos como uniformes y no como textura** (13 `texImage2D` por cuadro): al crear el contexto se le dice a
    three que no hay texturas en el vértice (`MAX_VERTEX_TEXTURE_IMAGE_UNITS` = 0) mientras nace. Cambiarlo
    después rompe los programas;
  - **un material en dos escenas** hace que three vuelva a elegir su programa dos veces por cuadro: copias;
  - **muñecos sin índice:** 8.766 vértices pasados por la piel dos veces por cuadro; compartidos son 1.627 (el
    facetado sale de las derivadas);
  - el cielo después de lo opaco (`z = w`): en las placas de celu con descarte temprano ahorra (en SwiftShader no
    se nota);
  - **texturas ETC2** (etcpak, decodificador en JS si la placa no sabe): de 104 a 23 MB en la placa;
  - **pérdidas de memoria:** todo lo que se arma de nuevo en la partida (armas, bombas, muñecos al cambiar de lado)
    va a una caché por tipo o a un pozo, y `precalentar()` lo arma en la carga.
- **Medir bien:** `renderer.info.autoReset = false` y reset a mano al empezar el cuadro (si no, `info` cuenta solo
  la última pasada y dice "1 triángulo"). Tablas de lo medido: AEROPLAZA en alta, 930 mil triángulos y 205
  llamadas en la plaza; el bosque, 310-760 mil y 60-74.

### 4.12 Que siempre arranque y nunca se quede trabado

- Un cartel de "cargando" en el HTML mismo, que se ve sin JavaScript; a los 7 s sugiere abrir con Chrome o Safari.
  `<noscript>`, aviso sin WebGL y aviso de contexto perdido.
- Un error en un cuadro muestra un cartel con "calidad baja" y "recargar" (el bucle sigue: 3.7).
- `dt` nunca negativo: la marca de `requestAnimationFrame` puede ser anterior al `performance.now()` del armado (la
  partida arrancaba con la pantalla azul de "sin señal").
- Un botón grande "▶ Jugar" y un tutorial corto. En los Artifacts, `confirm()` devuelve false: preguntar con una
  ventana propia.

### 4.13 Multijugador sin servidor (AEROPLAZA, Slendytubbies)

- **MQTT sobre WebSocket** a un broker público (`wss://broker.emqx.io`), con un prefijo propio (`aeroplaza_v1_`):
  sala por reino con `/state`, `/chat` y `/action`; un vestíbulo con presencia cada 4 s para elegir la sala más
  llena con lugar (14 como mucho); lo que tiene que quedar (la casa), retenido. En un port, la IP se cambia por un
  código de sala de 4 letras.
- El estado va cada 100 ms si cambió, y un latido cada 1,5 s (quieto: 8 mensajes en 12 s). Los demás se
  interpolan con `1 − exp(−12·dt)` y se borran a los 5 s sin noticias.
- **Todo lo que llega se valida** (colores, valores de las listas, daño de 0 a 30, hasta 40 mensajes por segundo
  por id) y el chat va con `textContent`. Sin red, "sin conexión" y se juega solo.
- **Voz por cercanía:** WebRTC con la oferta y la respuesta enteras por la sala MQTT, STUN de Google, sin TURN; se
  conecta a menos de 12 m y se corta a más de 18; un `PannerNode` HRTF. Chrome no pasa el audio de WebRTC a Web
  Audio si el stream no está también en un `<audio>` mudo.
- **Probar sin internet:** un broker MQTT 3.1.1 sobre WebSocket en Node puro (`aeroplaza/pruebas/broker.mjs`): desde
  el contenedor el proxy no pasa WebSocket. Contra el broker público hay que probar desde una compu con internet.

---

## 5. Assets: Rezona e Higgsfield

### 5.1 Preparar Rezona

```bash
npx rezona@latest init              # login + registra el MCP + deja .rezona/
npx rezona@latest status            # quién sos, créditos
npx rezona@latest login --no-browser   # sin navegador: un código que se aprueba en el teléfono
```

- **El MCP se carga al arrancar la sesión.** Si se registró con la sesión abierta, se le habla por stdio
  (`herramientas/rezona/rz.py`: `tools`, `esquema`, `call`, `batch`). Si no está conectado, decilo y seguí con lo
  que haya: no simules assets.
- **Un proyecto por juego** (`create_project`, gratis). **Cada pedido que salió bien, con sus parámetros, a
  `herramientas/rezona/estado.json`**: repetir una tanda cuesta créditos (97 lecciones en `lo_que_funciono`;
  buscalas con `grep -n '"clave"'`, no abras el archivo entero).
- El ciclo: `submit_*` cobra y devuelve un `task_id` al instante; `check_generation_tasks` con el `project_id`; se
  baja con `fetch_generated_asset` (necesita `.rezona/` en la carpeta) o con `curl` del `public_url`.
- **Antes de una tanda, una imagen de prueba.** Hubo días en que cobrar fallaba (`CREDIT_RESERVE_FAILED` con 446
  mil créditos) o el audio no salía (`PROVIDER_UNAVAILABLE`, `NOIZ_FAILED`): no reintentes en bucle, pasá al plan B
  (5.6) y decilo. Tope: 12 generaciones en vuelo.

**Las trampas que cuestan créditos:**

1. **El `output_path` que vale es el de la respuesta** (el servidor agrega `-g1`).
2. **`size` respeta la proporción, no el número** (1536x672 volvió 1376x768); 1920x1080 dio `VALIDATION_ERROR`
   terminal y 1536 anduvo.
3. **Fondo transparente de verdad = `transparent: true`.**
4. **El modelo por defecto saca solo PNG:** con `.jpg` da `GENERATION_OUTPUT_FORMAT_MISMATCH`, terminal.
5. **`FILE_NOT_FOUND` al bajar es terminal:** se reenvía la generación.
6. **`n: 3` devolvió una sola imagen:** las otras se sacan espejando y recortando.
7. **La música sale de 9 a 10,5 s** aunque pidas más (`music_length_ms` se ignora; `duration` da error terminal):
   tres tomas del mismo pedido, cosidas (`aeroplaza/herramientas/musica.py`).

| herramienta | para qué | lo que no dice el nombre |
|---|---|---|
| `submit_image_generation` | cielo, texturas, recortes, fondos, arte de tapa | `source_urls` con una imagen buena mantiene el estilo |
| `submit_model3d_generation` | objetos y personajes | con `source_url` de una imagen propia sale mucho mejor |
| `submit_rig3d_generation` | esqueleto + animaciones | `source_task_id` = el `gtask-…` de TU modelo |
| `submit_retexture_generation` | otra piel a un modelo | `text_prompt` e `image_prompt_url` son excluyentes |
| `submit_audio_generation` | música, efectos, voz | `kind`: `music`, `sound`, `speech` |
| `submit_sprite_generation` | hojas de sprites | una acción por hoja |
| `upload_project` | subir el juego | gratis; `dist/index.html` y los assets en `dist/datos/` (10.5) |
| `publish_to_rezona_app` | publicarlo en la app | **irreversible**: solo si la persona lo pide |

### 5.2 La lista, antes de generar nada

- **Una frase de estilo** (medio + paleta + luz), **idéntica al final de cada pedido**. La deriva de estilo entre
  tandas es la razón número uno de que un juego parezca un collage.
- **Escala real y una sola hora del día:** el personaje mide 1,75 m, un abeto 30, una roca 2.
- Para un 3D de exploración alcanzó con: cielo 360 (1), suelos repetibles (4), cortezas (1-2), recortes de follaje
  (5-8), objetos (5-8), un personaje con esqueleto y 4 clips, y audio (5-10).
- **No se genera:** árboles enteros en 3D (4.6), botones, partículas, letras, el terreno (sale de ruido).

### 5.3 Pedidos que salieron bien al primer intento

La forma: **tipo de toma primero, sujeto concreto, luz, y cerrar negando lo que no querés** ("no text, no
watermark, no shadow"). Negar es lo que más mejora el resultado.

**Cielo 360:**

```
Seamless 360-degree cylindrical panorama of the sky at golden hour over a
northern wilderness, photorealistic HDR photograph, wraps around horizontally
with matching left and right edges. The horizon line sits exactly at the
vertical middle of the image. Upper half: a warm low sun glowing close above
the horizon at the left third, soft scattered cumulus and thin cirrus clouds
lit gold and peach near the sun, the rest of the sky clean pale blue. Along
the horizon line all the way around: a faint distant range of blue hazy
mountains. Lower half below the horizon: uniform soft blue-grey atmospheric
mist, featureless. No trees, no foreground, no people, no birds, no text, no
watermark, no frame, no lens flare.
```

No respeta "el horizonte en la mitad" (le cae en el 54 %) ni cierra los bordes: se arregla después (5.4).

**Textura repetible:**

```
Seamless tileable texture, orthographic top-down photograph of a coniferous
forest floor: fallen brown fir needles, small twigs, a few tiny cones,
scattered dry leaves and small patches of green moss. Perfectly even diffuse
overcast lighting, no cast shadows, no perspective, no vignette, uniform detail
and density across the whole frame, edges wrap seamlessly. Photoreal PBR albedo
texture. No text, no watermark, no border.
```

Corteza: *"flat orthographic front photograph of … bark, the bark fills the entire frame edge to edge"*.

**Recorte de follaje** (`transparent: true`):

```
A single flat branch of a noble fir tree photographed from directly above on a
pure white seamless background: one woody main stem running from the bottom
center up to the top, many side twigs densely covered in dark green needles,
the branch fills most of the frame. Studio product lighting, crisp focus, no
shadow on the background, nothing else in the image. No text, no watermark.
```

*"El tallo sale del centro de abajo"*: así la tarjeta se engancha a la rama por el borde de abajo.

**Objeto para pasar a 3D:**

```
A single large rounded granite boulder partially covered with thick green moss
on top, three-quarter view, isolated on a pure white seamless background, the
whole object visible with margin. Photoreal PBR game asset, soft even studio
lighting, no ground, no cast shadow, nothing else. No text, no watermark.
```

**Personaje para pasar a 3D con esqueleto:**

```
Full-body 3D game character of a young adult hiker standing in a neutral
A-pose (arms straight and angled down about 45 degrees away from the body,
hands open, legs slightly apart), front view facing the camera, symmetrical.
[ropa concreta, con colores]. Realistic proportions, photoreal PBR game-asset
render, even soft studio lighting, pure white background, the entire body
visible from head to boots with margin, no shadow, nothing in the hands.
No text, no watermark.
```

Brazos separados y piernas abiertas (si se tocan, el esqueleto pega el brazo a la cadera); nada en las manos (el
3D lo funde con los dedos).

**2D pintado:** los pedidos de 3.4 (estilo fijo + `source_urls`, hojas de 5 adornos, fondos con el cielo
transparente, vehículos sin ruedas).

### 5.4 Procesar lo que llega (la mitad del "se ve bien")

Lo crudo no entra al repo ni al juego (va a una carpeta `crudo/` ignorada). Scripts de referencia:
`bosque/herramientas/procesar_assets.py`, `optimizar_modelos.mjs`, `barro/herramientas/arte.py`,
`ruta40/herramientas/procesar_arte.py`.

- **Texturas repetibles:** salen casi repetibles y con un degradé de luz que repetido dibuja una cuadrícula.
  1) aplanar la luz grande (dividir por la versión muy borroneada, sigma = 12 % del lado, y multiplicar por la
  media, al 85 %); 2) cerrar la costura fundiendo las últimas columnas sobre las primeras (12 % del ancho, rampa
  suavizada) y lo mismo en vertical; 3) normales desde la luminancia con `np.roll` (lo oscuro ES lo hondo);
  4) color a 1024 en webp ~76, normales a 512. Comprobación: correr la imagen medio lado en cada eje y mirar la
  cruz del centro.

```python
def cerrar_costura_x(img, banda):
    t = np.arange(banda, dtype=np.float32) / banda
    t = (t * t * (3 - 2 * t)).reshape(1, -1, 1)
    w = img.shape[1]
    fuera = img[:, : w - banda].copy()
    fuera[:, :banda] = img[:, :banda] * t + img[:, w - banda:] * (1 - t)
    return fuera
```

- **Recortes con alfa:** dejan halos del fondo en los bordes. 1) **descontaminar** (`c = (C − (1 − a)) / a`);
  2) **sangrar el color** hacia lo transparente (48 pasadas de promedio de vecinos llenos: el mipmap promedia
  vecinos); 3) recortar al contenido **con la base pegada al borde de abajo** (si queda margen, la planta flota).
- **El cielo:** horizonte a la mitad (reacomodar las filas por tramos); subirlo ~5° (el sol a 7,8° quedaba detrás
  de los árboles); cerrar la costura (7 %) y **sin mipmaps en el cielo** (el `atan` salta en la costura y se ve
  una raya); **medir el sol** y guardar su dirección (la luz sale del sol pintado, no al revés); **medir el color
  de la bruma** debajo del horizonte, del lado del sol y del opuesto: son los dos colores de la niebla.
- **El panorama como nubes** (AEROPLAZA): 4 copias espejadas alrededor del horizonte, lo blanco teñido por la hora.
- **Una sola paleta:** 5 colores dominantes del arte principal para la niebla, las luces, el menú y los pedidos
  siguientes.

### 5.5 Higgsfield

Va si lo pide, o si Rezona está caído y lo aprueba (`mcp__Higgsfield__*`).

- **Imágenes:** `nano_banana_2` a 2k, 2 créditos, usable al primer intento en las 23 del bosque. Cielo 360 a 4k y
  21:9. Recortes sobre blanco + `remove_background` (deja halos: 5.4).
- **3D:** `tripo_h3_1_image_to_3d` (texture, pbr, detailed; 9 créditos), en un cubo de 1 m y cuantizado. Personaje:
  `image_to_3d` en pose A + `3d_rigging` una vez por animación **desde la misma malla** (así los huesos se llaman
  igual y los clips se juntan).
- **Voz:** `text2speech_v2` con la variante `elevenlabs` (0,8 créditos por línea, buen castellano neutro).
- **Portadas** (10.2): `generate_image` con `nano_banana_2` y `aspect_ratio` 9:16 → 768×1376.

### 5.6 Plan B: si no se puede generar

- Terreno, árboles, pasto y cielo con código (tarjetas de follaje dibujadas en un canvas, cielo en degradé con el
  sol en HDR); el sonido sintetizado entero.
- **Cada asset se busca por nombre y tiene su reemplazo por código:** cuando el generador vuelva, lo generado pisa
  a lo dibujado sin tocar una línea.
- El look lo siguen dando 4.1-4.4 y el posproceso, que no necesitan ni un asset. Se ve menos fotográfico, pero
  intencional.

---

## 6. El celular

### 6.1 Parado primero

- **El juego arriba y los dedos abajo:** BRILLO con la consola de vidrio (el juego en el 60 % del alto: más, y cada
  punto de alto le saca ancho), KUNTUR con la bandeja de cartón (la vista en el 64 %), RUTA 40 con los pedales
  grandes abajo y el HUD arriba. Los fondos pintados en una franja con forma de pantalla acostada (así no se
  estiran) y el cielo en degradé hasta el borde.
- **La cámara se adapta:** 21 % del ancho adelante del personaje (BRILLO), el fov sube a 44° (con 30° el papel de
  KUNTUR se aplanaba), en 3D el campo horizontal fijo (4.8).
- **Los tamaños, con el lado corto** (en RUTA 40 la nieve eran platos); la interfaz en `%` de la caja (`--u` = 1 %
  del ancho) para que no cambie de tamaño.
- **Los menús, donde llega el pulgar:** título grande arriba y opciones abajo; nada que obligue a desplazar
  (AEROPLAZA mide cuántas cosas caben por página y su prueba falla si algo se pasa del alto).
- **Probar en 360, 390 y 412 de ancho**, acostado y en la compu (comparando con lo medido antes). El menú tiene que
  entrar en 360 px de alto (un celu acostado): en el bosque el botón de empezar quedaba abajo del borde.

### 6.2 Girar como opción

- Con el celu parado, **"vertical" de fábrica** y "girar" como opción (auto, normal, al revés): todo va en `#app`
  con `translateX(innerWidth) rotate(90deg)` y los toques pasan por una función que los lleva al juego
  (`Pantalla.aJuego`). El CSS usa `--vw`/`--vh` y clases propias (`angosta`, `a700`, `b460`) en vez de `@media`,
  porque con todo girado los `@media` miden al revés.
- En "auto", el acelerómetro (`devicemotion`) decide; en iPhone pide permiso y queda el manual.
- Lo girado se mide con `offsetLeft`/`offsetTop`: `getBoundingClientRect` engaña.

### 6.3 Controles de dedo a gusto ("sí o sí")

Lo que tiene que tener el editor (KUNTUR `js/ui.js › editarTactil`, CONTRAGOLPE `fuente/js/21b-mandos.js`):

- **Arrastrar cada botón** a donde quiera; **tamaño** (pellizco o − y +, de 60 a 180 %); **opacidad** (20 a 100 %);
  **palanca flotante, fija o cruz**; **vibrar** sí o no; **zurdo** (espeja lo que no se movió a mano y la zona de
  la palanca); **restablecer** y **listo**.
- Se guarda en fracciones de la pantalla lógica (sirve en otro tamaño), aparte para parado y acostado (`posV`). Sin
  posición guardada va el lugar de siempre, y todo se mete adentro del marco.
- Mientras se acomoda, un escucha en fase de captura se queda con los toques (así no se salta ni se camina).
- **De fábrica:** palanca flotante a la izquierda (escucha media pantalla), botones a la derecha.
- **Arrancar en modo dedos si `pointer: coarse`:** KUNTUR arrancaba en modo teclado y los botones solo aparecían al
  tocarlos, pero escondidos no se podían tocar (lo vio el dueño en su celular). Cualquier toque pasa a dedos.
- En los juegos de un dedo (cortar, arrastrar piezas, apuntar), lo que se ajusta es lo que importa: sensibilidad,
  altura de la pieza sobre el dedo, velocidad del dedo, línea guía, tamaño de botones. Con un área de prueba
  ("PROBÁ ACÁ") en la misma pantalla.
- En una APK, la WebView no tiene `navigator.vibrate`: vibra por el puente nativo.

### 6.4 Toques

- **Cada dedo por su `pointerId`** (si no, girar la cámara suelta el joystick). `setPointerCapture` adentro de un
  `try` y después de anotar el toque.
- `getCoalescedEvents` para los gestos rápidos (cortar).
- Si la pestaña pierde el foco con una tecla apretada, el `keyup` no llega: soltar todo en `blur`. Si una escena
  suelta todo con el dedo apoyado, al mover el dedo vuelve a contar.
- `touch-action: none`, sin selección y sin el resaltado del toque; el menú contextual, anulado.
- **Los botones que abren algo, en `pointerup`:** la pausa abría en `pointerdown` y su clic caía después en lo que
  quedaba abajo.

### 6.5 La interfaz HTML encima del juego (trampas de CSS)

- **Un elemento a pantalla completa con `pointer-events: auto` se come todos los toques** (en AEROPLAZA,
  `#ui > *` le ganaba por especificidad a `.hud`). Se vio recién con dedos de verdad: probar con
  `elementFromPoint`, no solo tocando botones.
- **Nunca repetir el nombre de una clase de componente en la raíz:** `<html class="tactil">` era también la clase
  del panel de controles (`opacity: 0`) y la página entera quedó invisible en el celu.
- `[hidden] { display: none !important }`: si no, una capa escondida tapa todo.
- Un `@keyframes` con `transform: scale()` pisa el `translateX(-50%)` del centrado (el botón quedó fuera de
  pantalla): cada cosa, su animación.
- Un `flex: 1` con `overflow: hidden` crece con el contenido si no tiene `min-height: 0`.
- Los reseteos van con `:where()` (un `#ui button{background:none}` le ganaba a `.tag`).
- `addEventListener(…, true)` se saca con `removeEventListener(…, true)`.
- Textos en un cuadro 9:16 centrado en la compu: `container-type: size` y unidades `cqw` (vh y vw no sirven).

---

## 7. Sonido y música

### 7.1 Lo básico

- **El audio arranca recién con el primer toque** (los navegadores no dejan sonar antes): `Sonido.iniciar()` en el
  primer `pointerdown` o `keydown`. Al esconder la pestaña, pausa.
- Música, efectos y voz en buses separados con su volumen (MÚSICA y SONIDO en las opciones).
- Un sonido por cada acción; **±10 % de tono** en los que se repiten para que no cansen; el corte o la fusión toca
  una nota que **sube con el combo**.
- **Distancia:** una reverberación armada al arrancar (ruido que se apaga en ~2,6 s) para lo lejano, y el paneo.
- Timbres propios para la interfaz (AEROPLAZA: info, bien, zona, error a la manera de Windows 7; uno cada 0,35 s
  como mucho).

### 7.2 Música sintetizada (todo lo 2D de octubre, NEVADA)

- Instrumentos con el carácter del mundo del juego: guitarra Karplus-Strong (un buffer por nota, en caché), bombo y
  quena en 6/8 (chacarera de SALAMANCA, que cambia de tono por piso); koto, shakuhachi y taiko en la escala "in"
  (TAJO); trío de jazz con trompeta en la multibola (DORADO); tango (FILETE); synthwave (NEBULOSA); phonk (NEVADA).
- **Se arma con escala, progresión y patrón**, nunca nota por nota al azar, y **se mide**: renderizar offline
  (`OfflineAudioContext`) y ver el nivel cada medio segundo, los picos y el espectro. BRILLO: temas parejos
  (~0,055 RMS), sin recortes ni silencios. NEVADA: −12,7 LUFS, pico −3 dBTP, la intro 14 dB abajo del drop.
- **El reloj de una cinemática es el del audio** (`musica.tiempo()`): los cortes caen en el golpe aunque se atrase
  un cuadro.
- **Continua (DC) en Web Audio:** un `GainNode` vale 1 hasta su primer evento y una curva de `WaveShaper` de 1024
  puntos da −0,002 con entrada 0; con miles programados se sumaba −0,04. La ganancia arranca en 0, la curva tiene
  1025 puntos y un pasa-altos de 22 Hz al final.

### 7.3 Música y efectos generados

- Música: `kind: "music"`, termina en *"seamless loop, consistent energy, no fade out"*; sale de 9-10,5 s (5.1).
- Efectos: `kind: "sound"`, hasta 2 s, material + acción (*"short metallic coin pickup, bright"*, no *"ding"*).
  Ambiente: un `sound` largo que se pueda repetir.
- **El cargador busca cada sonido por nombre y, si no está, sintetiza uno:** lo generado pisa a lo sintetizado
  sin tocar código.

### 7.4 Las canciones que manda quien pide

- **Se bajan de los videos que manda** (no el audio de TikTok de otros). Los videos de TikTok terminan con el logo,
  que suena: −6 dB en el último segundo y medio, y el bucle no llega ahí.
- **El bucle, alineado a los golpes:** BPM y fase medidos (flujo espectral y un peine), frases enteras (4 compases),
  un fundido de 0,15 s y 0,4 s copiados después del salto, así aguanta que el decodificador corra el MP3 unos ms.
- **Nivel parejo con lo demás** (`vol` por canción: la de Wii Party sonaba 1,9 dB más fuerte).
- **No van al repo** (es público, y son de Nintendo y otros): `juego.html` sale sin canciones y
  `juego-con-canciones.html` (ignorado) es el que se entrega. En una APK van sueltas en los assets.

---

## 8. Los 13 idiomas

### 8.1 Qué idiomas

Pedido (08/10): Brasil, Egipto, Indonesia, Irak, Japón, Myanmar, México, Malasia, Filipinas, Pakistán, Arabia
Saudita, Tailandia y Turquía, más los de antes. Son 13 opciones:

| | | | |
|---|---|---|---|
| Español (Argentina) | Español (México) | English | Português (Brasil) |
| العربية (Egipto, Irak, Arabia Saudita) | Bahasa Indonesia | Bahasa Melayu | Filipino |
| Türkçe | اردو (Pakistán) | ไทย | မြန်မာ |
| 日本語 | | | |

- México con tuteo ("pilón" por "yapa", "chido" por "groso"). Cada nombre, escrito en su idioma.

### 8.2 Cómo está armado (`motor2d/idiomas.js`)

- **Sin cartel al arrancar:** `idiomaInicial(guardado)` usa el elegido o el del equipo (`navigator.languages`:
  es-AR/UY/PY → Argentina, el resto del español → México, `tl` → filipino, `in` → indonesio; si no, inglés).
- **Un botón con un globito** (se reconoce aunque no se lea el idioma puesto) abre la lista de los 13, con el
  puesto resaltado. Se guarda en `<juego>.idioma`.
- **Las traducciones en `<juego>/js/idiomas.js`**, después de `base.js`:
  `TXT['es-MX'] = Object.assign({}, TXT.es, { …tuteo })` y `Object.assign(TXT, { ar, id, … })`. `tr()` cae a
  inglés, después a español y por último a la clave. Las tablas aparte (las cartas de SALAMANCA) van con
  `[nombre, descripción]` por idioma y `null` = el original.
- **Cada escritura con su letra del sistema** (`fuenteEscritura`): Noto Naskh Arabic, Noto Sans Thai, Noto Sans
  Myanmar, Hiragino/Noto Sans JP; urdu con su lista. **Tamaño compensado** (`escalaEscritura`: árabe ×1,18,
  tailandés ×1,12, japonés ×0,92).
- **Árabe y urdu de derecha a izquierda:** `ctx.direction = 'rtl'` al dibujar y de vuelta a `'ltr'`; el destape de
  a letras va de derecha a izquierda; sin `letterSpacing` ni cursiva fuera del latín.
- **Partir renglones midiendo** (`partirMedido`): el japonés, el tailandés y el birmano no separan con espacios, se
  corta por palabras con `Intl.Segmenter`. El paso entre renglones, más alto para la letra del sistema
  (`pasoRenglon`: 12 en vez de 9).
- **En píxeles:** lo que la letra de píxeles no tiene (`esPx`) sale con la letra del sistema a la resolución real
  del lienzo (3.2), con el mismo contorno, sombra y degradé. El turco va en píxeles (se sumaron Ş Ğ İ Ö).
- **Los títulos al doble solo si entran**; si no, al tamaño normal. Lo que flota (puntos, carteles) nunca se sale
  de la pantalla.
- Los números, con cifras occidentales. Los nombres propios del mundo (La Boca, el Mandinga) quedan como están.

### 8.3 Probarlo

`node herramientas/idiomas/probar.mjs <juego> todos "menu,idioma,…"` recorre las escenas de
`herramientas/idiomas/escenas.json` en los 13 idiomas y dice, por idioma, los errores y los textos que se salen de
la pantalla; `hoja.py` arma la hoja de capturas. Con `DPR=3` para los de píxeles. El contenedor no trae letras de
árabe, tailandés, birmano ni urdu: van como `FontFace` desde `$FUENTES` (las Noto de google/fonts). Los carteles que
entran deslizándose dan un "fuera" falso: mirá la captura. Resultado del 08/10: 5 juegos × 13 idiomas, 0 errores.

---

## 9. Probar y medir

### 9.1 El navegador de acá

- Chromium de Playwright: `createRequire('/opt/node22/lib/node_modules/')` y
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`. **Nunca `npx playwright install`.**
- Para 3D, con SwiftShader: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`. **Dibuja por procesador** (~1,5 s por cuadro en 3D): los cuadros por segundo de acá no
  dicen nada de un teléfono y **no se informan como si dijeran**. Lo que sí vale: errores, triángulos, llamadas,
  milisegundos de CPU, capturas, y las proporciones antes/después.
- El celu: `viewport` 360-412 de ancho, `deviceScaleFactor: 3` (sin eso, un juego de píxeles se ve a escala 1),
  `hasTouch` e `isMobile`.
- **Las capturas, con ruta absoluta y afuera del repo:** con una relativa caen en la raíz del repo.
- Chromium no sale a internet (el proxy no le pasa el certificado): las pruebas van contra `file://` o `localhost`
  (en un puerto al azar: el 8765 suele estar ocupado). Por `file://` no hay `fetch`: lo que lo usa se prueba
  servido.

### 9.2 La API de prueba

- Cada juego expone `window.__juego` con getters de su estado y sus acciones (`G`, `escena`, `empezar(modo)`,
  `irA`, `terminar`, `tr`…) y perillas para probar: `turbo` (varios pasos por cuadro), `bot`, `congelado` /
  `paso(dt, dibujar)` (avanzar a mano), teletransportar.
- Parámetros de la URL: `?prueba` (sin lo que tapa: polvareda, transiciones), `?pausa`, `?directo`, `?fijo` (sin
  resolución que se adapta), `?cal=baja`, `?t=5.2` (una cinemática quieta en un instante).
- **Esperar tiempo de juego, no de reloj** ("esperar 1,5 s" en SwiftShader es esperar un cuadro): exponer el reloj
  del juego y esperar a que avance, o congelar y avanzar a mano. En 3D, después de dibujar, un `readPixels` (o leer
  un píxel) espera a SwiftShader; `gl.finish()` no espera.
- Empezar y cargar una repetición en **una sola llamada a `evaluate`**: entre dos llamadas el bucle corre cuadros y
  se desfasa.
- Antes de un rayo con la cámara sin dibujar: `camara.updateMatrixWorld()` (si no, usa la matriz de dos cuadros
  atrás).

### 9.3 Bots y resolvedores ("nunca a medio hacer")

- **Un bot que juega cada modo con las reglas de verdad**, no solo el camino feliz: TAJO barre la fruta más alta,
  falla a propósito (3 sin cortar → fin), hace un combo de 4, toca la bomba, usa el hielo, pausa, dojo y controles;
  DORADO con `bot` y `turbo = 8`, 5 minutos simulados por modo, junta dónde se traba la bola y comprueba rangos,
  jackpots y el fin del reloj; NEBULOSA tira al azar 26 s; SALAMANCA, un bot inmortal que llega a la sala 1-6 en ~70 s.
- **El bot primero se depura:** en LUZ MALA medía la distancia al centro del jefe sin contar el ancho y se metía
  adentro.
- **Resolvedores** para niveles (3.8). Para balancear, un piloto con la misma física que maneja mejor que una
  persona (RUTA 40: la chata sin mejoras llega a 2,5-4,1 km; hace falta 1,5 para abrir el siguiente).
- Lo que se lleva a Node (física, juego) no importa imágenes: el dibujo va aparte (`vista.js` y `dibujo.js`).

### 9.4 Mirar

- **Hojas de contactos** (capturas chicas en grilla con PIL) desde lugares y escenas fijas, y **mirarlas una por
  una**. Casi todos los errores se vieron en una captura y en ningún número.
- Partida de punta a punta: menú, cada modo, pausa, fin, récord, idioma, controles.
- **Un resultado raro suele ser la prueba** (en el bosque, "la cinta 2 dice lo de la cinta 1" era la prueba leyendo
  el cartel anterior).

### 9.5 El celu y los dedos

- **Dos dedos a la vez:** `Input.dispatchTouchEvent` por CDP (girar la cámara sin soltar el joystick, pellizcar).
  Un toque por CDP a veces se pierde: la prueba repite y avisa. En SwiftShader los toques llegan muy atrasados: los
  controles se prueban también con el puntero.
- **Que exista no quiere decir que se pueda tocar:** `document.elementFromPoint(x, y)`.
- Pruebas de vertical con todo medido (KUNTUR 62 comprobaciones, RUTA 40 38): parado en 3 tamaños, acostado,
  girado, el editor de dedos y jugar con toques de verdad. Si algo anima (una postal que entra), terminar las
  animaciones antes de medir.

### 9.6 Medir

- 3D: `renderer.info` sumando todas las pasadas (4.11). CPU: el `Profiler` por CDP con el bucle frenado.
- Comparar imágenes con PSNR: el juego no siempre es determinista entre corridas; menos de 40 dB es un cambio de
  verdad.
- Audio: render offline y nivel, picos y espectro (7.2).
- El tamaño del HTML y de lo que se manda (10.7).

---

## 10. Entregar

### 10.1 Un solo HTML

- **2D de `motor2d`:** `node motor2d/armar.mjs <juego>` (90 a 215 KB, sin nada de afuera).
- **Con assets** (3D, 2D pintado): esbuild en un IIFE y **cada textura, modelo y sonido como `data:` en
  `window.ARCHIVOS`**; el cargador busca ahí primero. El base64 engorda un tercio (el bosque: 8,6 MB de datos dan
  12,1 MB). Lo grande puede ir con gzip y `DecompressionStream` y pasarse a blobs al arrancar.
- **Sin `fetch`:** desde `file://` un `fetch` a `data:` o `blob:` se bloquea en silencio. Los GLB se decodifican a
  mano (`atob` → `Uint8Array` → `loader.parse`) y las texturas de adentro de cada GLB se leen como `<img>`:

```js
gltfLoader.register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: "texturas_como_imagen" };
});
```

- **Escapar `</script` adentro del código** y **reemplazar con una función, nunca con un string**: `replace`
  interpreta los `$&` y `` $` `` del código minificado y el HTML sale roto sin ningún error.
- La letra, como data URL en el CSS.
- **Probarlo como lo va a abrir la persona:** por `file://`, que cargue, que no haga **ningún** pedido afuera
  (`page.on("request")`) y cero errores en la consola.

### 10.2 La portada 9:16

- El arte: Higgsfield `nano_banana_2` en 9:16 (768×1376) con una escena que diga el juego (el tajo de tinta que
  cruza una sandía; el hotel déco). *"No text, no logos"* igual dejó un código de barras falso abajo: lo tapa el
  degradé del título.
- **El título y la marca se componen aparte** con PIL: el título con la letra del juego (la de píxeles, Limelight,
  la serifa cortada en diagonal como el tajo), ≤ 540 px de ancho, y la moneda de JXStudios
  (`jxstudios/img/moneda.webp`) abajo. Las letras de la IA salen mal.
- **Lo importante adentro de una caja 3:4 centrada (1080×1440):** la grilla del perfil de TikTok recorta el medio
  del 9:16. Los ~80 px de abajo, libres (ahí van las vistas). Para ver si se lee, achicarla a 360×480.
- Queda como `<juego>/portada-<juego>.jpg`.

### 10.3 El zip por juego

`python3 herramientas/empaquetar_juegos.py <juego> […]` → `entregas/<juego>.zip` (no se commitea), con `LEEME.md`,
`jugar/<juego>.html`, `portada.jpg`, `fuente/` (el código con la estructura del repo; del `motor2d/` solo lo que
el juego usa) y, si hay, `PORTAR-A-TIKTOK.md`. Un juego nuevo se suma a `JUEGOS` con su `que`, `carpetas`, `html`,
`portada`, `armar` y `como`.

### 10.4 APK (una WebView)

- **Una WebView a pantalla completa con `WebViewAssetLoader`** (los assets por https como un sitio seguro: el
  `localStorage` sigue entre versiones). El WebGL de la WebView va a la placa igual que un juego nativo; lo caro es
  lo que se dibuja. Afinado: 60 Hz, el proceso que dibuja con prioridad alta y otra WebView si el sistema la mata;
  el texto al 100 %; atrás = Escape; un puente `window.<Juego>Nativo` para vibrar, el flash y lo demás.
- **Armar** (`aeroplaza/herramientas/apk.mjs`, `ports/bus-stop/herramientas/apk.mjs`): el SDK va en el scratchpad
  (commandlinetools, `sdkmanager --licenses`, `platforms;android-36`, `build-tools;36.0.0`, `ANDROID_HOME`);
  Gradle 8.14, AGP 8.13, compileSdk 36. **Maven Central corta con 429:** primero el espejo de Google y
  `--max-workers=2`. Solo `arm64-v8a` y las `.so` comprimidas (`useLegacyPackaging`).
- **La firma es la llave de prueba de cada contenedor:** otra sesión firma distinto y Android no instala encima (hay
  que desinstalar y se pierde lo guardado). Por eso: **actualizaciones sin APK** (AEROPLAZA `Actualizador.java`):
  un aviso `actualizacion.json` con el HTML fijado a un commit, su sha256 y sus bytes; la app lo busca al abrir, al volver y cada
  20 min, lo baja en otro hilo, lo verifica y lo usa sin cerrarse; solo de fuentes permitidas, por https. APK nueva
  solo si cambió lo de Java (`versionCode` + 1). `aeroplaza/herramientas/publicar.mjs` publica una versión.
- **Texturas ETC2** para la memoria de los celus flojos (4.11).

### 10.5 Publicar

- **Rezona:** `upload_project { dir, project_id }` (gratis) con `.rezona/` y `dist/index.html`, todo en rutas
  relativas, y **los assets en `dist/datos/`: Rezona saltea `assets/` sin avisar** (el juego subía y se quedaba
  cargando). Comprobar el `play_url` con `curl`. `publish_to_rezona_app`, solo si lo pide.
- **Cloudflare Pages** (la página de JXStudios: `jxstudios/desplegar.sh`, con `CLOUDFLARE_API_TOKEN` del entorno).
- **Artifact:** sin `<html>`, `<head>` ni `<body>` y sin canciones; ahí el CSP bloquea los WebSocket (se juega solo),
  no hay micrófono y `confirm()` da false.
- **TikTok Mini Games:** el runtime nativo no es un navegador (sin DOM ni CSS: todo dibujado en el canvas de
  `tt.createCanvas()`), 4 MB el paquete principal y 30 MB en total; anuncios con premio
  (`TTMinis.createRewardedVideoAd`) y compras (`TTMinis.game.pay` con una orden que crea un servidor propio). La
  guía para portar está en `herramientas/tiktok/comun.md`.

### 10.6 El video para TikTok

- 9:16, uno solo, cinematográfico, con motion graphics del propio juego. Montaje en **Remotion** y **ffmpeg**.
- **Las tomas son el juego de verdad** con reloj propio (`performance.now`, timers y rAF pisados), a 1080×1920 y
  ~2,5 s por cuadro; primero una vista a 270×480 con hojas de contactos para encuadrar.
- Los cortes en los golpes de la música (BPM medido); cada parte a su volumen con `loudnorm` y el total a −14 LUFS,
  pico −1. Estilo propio de cada juego (tarjetas de Wii en AEROPLAZA).
- Los relatados llevan stickers y memes **bajados, no generados** (`videos/`, nota `videos` de la memoria).

### 10.7 Mandar archivos

- **Por el chat entran 30 MiB por archivo.** Lo más grande va en varios zips de menos de 28 MiB, **cada uno completo
  por su cuenta** (no `zip -s`, que en el celu no se une). Un video: x264 en dos pasadas (~3,6 Mbps da 28 MiB por
  minuto); más grande, Gofile (`curl -F file=@… https://upload.gofile.io/uploadfile`) y comparar el md5.
- Un juego que no entra en 30 MiB va por partes (TJOC: una APK por capítulo).

---

## 11. Ports (juegos ajenos)

### 11.1 Qué se puede portear

- **Solo juegos gratis:** fangames y freeware. No se portean los que hoy se venden (Poppy Playtime, GTA SA Lite, FNaF
  2 fue un error), ni los gratis con anuncios o compras que tienen versión oficial, ni se arreglan para
  publicarlos (el PvZ con el `main.pak` de EA). Se ofrece un juego propio inspirado.
- **Nada del juego entra al repo:** ni lo bajado, ni lo exportado, ni los textos. En `ports/<juego>/` va solo el
  código del port y sus herramientas; los créditos del original, en pantalla.
- **Arrancan como el original**, con la intro de JXStudios y los créditos; **los controles de celu, como los de su
  versión de celular** si existe (Baldi trae los suyos en la escena; FNaF 2: el dedo hace de mouse y la linterna es
  la zona de toque), no botones inventados.

### 11.2 Bajar

- **itch.io gratis:** el `csrf_token` de la página y un POST a `/file/<id>?source=view_game&as_props=1…` → `url`.
- **GameJolt:** `POST /site-api/web/discover/games/builds/get-download-url/<build>` → `payload.url`.
- **MediaFire:** con `curl`, la página trae el `href` de descarga. RAR5 con `libarchive-c`.

### 11.3 Unity (Bus Stop, Pizza Delivery, Slendytubbies, Baldi)

- **Exportar con UnityPy** (`python -I` en un venv): nodos, mallas, texturas a webp, materiales, luces, colliders,
  animaciones, audio a Opus, terreno y los campos de los scripts. **Unity es de mano izquierda:** z cambia de signo
  (posiciones, normales, cuaterniones `(-x, -y, z, w)`) y se da vuelta el orden de los triángulos.
- **La lógica, decompilada a C#** con `ilspycmd` (2.600 líneas legibles en vez de IL) y reescrita en JS **un guion
  por clase** (con esbuild `keepNames`). Los valores de verdad están en la escena, no en los `.ctor`.
- **Unity 4 en three:** gamma sin manejo de color, Lambert sin 1/π y la caída de sus luces `1/(1 + 25·(d/r)²)`; los
  faroles horneados en un mapa visto desde arriba. El texto 3D de Unity 4 se dibuja encima de todo.
- Static batching (mallas ya fundidas en coordenadas del mundo y cada renderer con sus submallas), personajes con
  huesos (bindposes con z dado vuelta, `S·B·S`), corrutinas como `await J.esperar(n)`, navmesh de Detour,
  TextMeshPro (atlas solo alfa; las letras que faltan se arman con piezas). En Unity 3.5 cada objeto se prende y
  apaga solo; en Unity 4, el padre apagado apaga a los hijos.
- Física: cápsula contra los triángulos de los colliders en una grilla de 4 m; los que se mueven (puertas), en su
  espacio y con una caja previa (sin la caja, 56 ms por paso; con, 0,05); solo sube escalones si el objeto entero
  es bajo (si no, trepaba los postes).

### 11.4 Unreal 4 (TJOC)

- **No rearmar: ejecutar.** El Blueprint corre tal cual en una VM de Kismet en JS y lo nativo de UE se escribe a mano
  función por función, guiado por lo que el juego llamó y no existe. Exportar con CUE4Parse (.NET 10).
- Las propiedades van por diferencia (instancia → plantilla → valores nativos: lo que falta no es nulo, es el
  defecto). La exposición de UE 4.16 sale del 80-98,3 % más claro del histograma, no del promedio.

### 11.5 Clickteam y Emscripten

- **Clickteam (FNaF 2):** lector propio del .exe (sin código de terceros), descifrado, eventos en JS (`motor.js`).
- **Emscripten (Just Shoot, BananaBread):** el paquete de `file_packager` se rearma cambiando la lista de archivos;
  los `preRun` corren al revés; los controles de dedo pisan `keyCode` y mandan `mousemove` con `movementX`.

### 11.6 Traducir lo que viene en imágenes

- Borrar el texto (relleno por difusión) y reescribirlo con una letra que se le parezca (TJOC: Oswald 500 angostada
  a 0,543; Slendytubbies: Creepster, Amatic SC, Patrick Hand), una imagen por idioma. Las cadenas de un motor en C
  se pisan en la memoria sin pasarse del largo.

---

## 12. Trampas ya pagadas

**Dibujo y three.js**

| lo que se ve | la causa | el arreglo |
|---|---|---|
| la partida arranca con pantalla azul | el primer `dt` negativo | `dt = max(0, …)` |
| cuadros negros de a ratos | el lienzo cambiaba de tamaño después de dibujar | al empezar el cuadro |
| un objeto no aparece nunca / el auto es una caja | geometría cuantizada recortada al hornear o girar | a coma flotante antes |
| las ruedas corren la carrocería | atributos compartidos entre geometrías | copiar antes de `translate` |
| 1,6 millones de triángulos | objetos repetidos dibujados siempre y dos veces | instanciar y recortar |
| todo plano y lechoso | el ambiente le ganaba al sol | sol 4,6, ambiente 0,5, reflejo 0,26 |
| arena y caminos celestes | `environment` + hemisférica a la vez | env 0,3-0,7, hemi 0,18-0,5 |
| todo lo blanco se abre en niebla | bloom con umbral 0,9 | umbral 1,45 |
| el vidrio es una pared blanca de costado | clearcoat y env | opacidad 0,12, env 0,7 y fresnel |
| techo verde adentro | la luz y el reflejo del cielo tienen pasto abajo | `RoomEnvironment` en interiores |
| la cámara vive dentro de los árboles | ramas a la altura de los ojos | copa arriba de 5 m, tramado cerca |
| el follaje desaparece de lejos | el alfa se promedia en los mips | escalar el alfa por mip |
| halos en las hojas | el fondo mezclado en el borde | descontaminar + sangrar |
| raya vertical en el cielo | mipmaps + salto del `atan` en la costura | cielo sin mipmaps |
| las sombras titilan al caminar | la caja de sombra se mueve de a medio píxel | de a un texel |
| el viento o la niebla "no andan" | dos `onBeforeCompile` o programa compartido | `parchear` con clave |
| `redefinition` al compilar | el mismo `uniform` en dos parches | nombres distintos |
| se traba la primera vez que aparece algo | el shader se compila ahí | `compileAsync` y el ensayo |
| cada capítulo recompila todo | otra cantidad de luces de punto | una luz de relleno siempre |
| texturas lavadas o luz de costado | color sin sRGB / normales como sRGB | color `SRGBColorSpace`, normales `NoColorSpace` |
| el personaje brilla en la sombra | color enchufado como emisivo | sacar la emisión |
| el personaje desaparece en algunos cuadros | recorte con la caja de reposo | `frustumCulled = false` |
| los pies patinan | la animación a otra velocidad que el avance | `timeScale` desde zancada y ciclo |
| piernas juntas entre caminar y correr | clips en fases distintas | sincronizar las fases |
| la mano izquierda desaparece | se cambió `floatVertexTextures` con los programas hechos | decirlo al crear el contexto |
| el árbol queda sin copa | `add` saca de `children` mientras se recorre | copiar la lista antes |
| la bóveda queda bajo el piso | `CylinderGeometry` parcial girado al revés | girar con el otro signo |
| el zócalo tapa el piso | caja con `BackSide` | tiras sueltas |
| el muñeco sale por las paredes redondas | 20 cilindros dejan huecos de 1,2 m | 40 |
| la carga tarda 13 s | `checkShaderErrors` | apagarlo (2,9 s) |
| el HTML único sale sin texturas | `fetch` bloqueado a `data:`/`blob:` | GLB a mano + texturas como `<img>` |
| el HTML único sale roto sin error | `replace` con string interpreta `$&` | `replace` con función |
| el juego subido a Rezona no carga | Rezona saltea `assets/` | la carpeta se llama `datos/` |

**2D**

| lo que se ve | la causa | el arreglo |
|---|---|---|
| un juego de píxeles borroso | `imageSmoothingEnabled` se resetea al cambiar el lienzo | ponerlo después de cada cambio |
| letras de otro idioma pixeladas | dibujadas a la resolución del juego | el lienzo a `W·RES` (3.2) |
| la sala parpadea | `arr[k % 3]` con `k` negativo da `undefined` | `((n % 3) + 3) % 3` |
| la pausa abre y cierra sola | Escape escuchado dos veces en el mismo cuadro | `tEsc > 0` o separar pausa y volver |
| la moto rebota y despega | amortiguador simétrico | frenar 2,6× al estirarse |
| la moto se da vuelta a fondo | empuje en el contacto | el par 0,35·r arriba |
| el auto sale disparado contra una rampa | topes como resortes duros | restricciones con impulso acumulado |
| autos colgados de la panza en las crestas | puntos del casco muy separados | uno cada 45 cm + límite de curvatura |
| las pilas tiemblan | choque y rozamiento en cada pasada | solo en la primera |
| lo que se junta orbita sin llegar | velocidad con inercia | atraído va derecho |
| nadie toca los blancos de arriba | ubicados a ojo | medir dónde cae la bola |
| el cuadro tarda 263 ms | efectos hechos en cada cuadro | hornearlos al cargar (71 ms) |
| lag en el celu | el post a la resolución de la pantalla | componer chico y agrandar en una pasada |
| la animación va al doble en 120 Hz | animar con el paso fijo | el reloj real |
| el resolvedor dice "inalcanzable" en falso | la clave de visto sin todo el estado | todo lo que cambia el futuro |

**Interfaz, celu y entrega**

| lo que se ve | la causa | el arreglo |
|---|---|---|
| la página entera invisible en el celu | la clase de la raíz igual a la de un componente | otro nombre (`dedos`) |
| los controles no responden | una capa a pantalla completa se come los toques | `pointer-events` y `elementFromPoint` |
| los botones de dedo no aparecen | arrancaba en modo teclado | `pointer: coarse` → dedos |
| girar la cámara suelta el joystick | los dedos sin `pointerId` | uno por dedo |
| el botón Aceptar fuera de pantalla | una animación pisa el centrado | animaciones separadas |
| el menú no entra acostado | 360 px de alto | menú compacto |
| `confirm()` no pregunta | en los Artifacts da false | una ventana propia |
| no se oye la voz | WebRTC sin `<audio>` | uno mudo por pareja |
| un zumbido de continua | `GainNode` en 1 y `WaveShaper` de 1024 | ganancia en 0, 1025 puntos, pasa-altos |
| la APK no se instala encima | otra llave de firma | actualizaciones sin APK |
| Gradle cortado con 429 | Maven Central | espejo de Google, 2 workers |
| una APK de 40 MB no se manda | el tope de 30 MiB | lo grande afuera, `.so` comprimidas |
| capturas en la raíz del repo | ruta relativa | rutas absolutas afuera |
| la prueba "dice" algo raro | la prueba leía otra cosa | revisar la prueba primero |

---

## 13. Antes de decir "listo"

**El juego**

- [ ] Cada modo jugado por un bot, con las reglas de verdad (vidas, fallas, bombas, fin, récord); hoja de capturas
      mirada una por una. Cero errores en la consola.
- [ ] Estilo propio (menú, botones, transiciones, efectos), claramente mejor que el anterior.
- [ ] Parado (360, 390, 412), acostado y compu; menús sin desplazar; nada fuera de pantalla.
- [ ] Controles de dedo a gusto (mover, tamaño, opacidad, palanca, zurdo, vibrar, restablecer) y guardados.
- [ ] 13 idiomas: arranca en el del celu, cambia con el globito, `herramientas/idiomas/probar.mjs` sin errores ni
      textos fuera.
- [ ] Sonido después del primer toque, con niveles parejos medidos; pausa al esconder la pestaña.
- [ ] Guardado en `try/catch`; la partida se puede seguir.

**El 3D**

- [ ] HDR + AgX, sol que manda, niebla del color del horizonte, sombra que sigue de a un texel.
- [ ] Modelos simplificados, texturas a 1024 webp, sin geometría recortada, tamaños reales en metros.
- [ ] Animaciones medidas (en el lugar, ciclo, zancada) y fases sincronizadas.
- [ ] Triángulos y llamadas medidos con `renderer.info` sumando las pasadas; nada dibujado detrás de la niebla.
- [ ] Shaders compilados en la carga (y el ensayo con el telón cerrado); `dt` nunca negativo; el lienzo se cambia al
      empezar el cuadro; en el celu arranca en media o menos.

**La entrega**

- [ ] Un solo HTML probado por `file://`: sin pedidos afuera, sin errores. Pesa lo que debe (2D: decenas o
      cientos de KB).
- [ ] Portada 9:16 con el título compuesto aparte y lo importante en la caja 3:4.
- [ ] Zip por juego (`empaquetar_juegos.py`), cada archivo de menos de 30 MiB.
- [ ] README del juego (qué archivo tiene qué) y la nota de la memoria (qué se aprendió, qué falta).
- [ ] Lo que no se pudo medir (los FPS y el tacto en un teléfono de verdad) está dicho con esas palabras.

---

**Dónde está cada ejemplo andando:** 2D de un archivo en `tajo/`, `nebulosa/`, `dorado/`, `filete/`, `salamanca/`
(con `motor2d/`); plataformas con resolvedor en `zonda/`, `luz-mala/`, `brillo/`; 2D pintado con bot en `ruta40/` y
`barro/`; 2.5D de papel en `kuntur/`; 3D con el look completo en `bosque/`; 3D social, multijugador, APK y
actualizaciones en `aeroplaza/`; celus flojos y ETC2 en `contragolpe/`; cinemática con modelos generados en
`nevada/`; ports en `ports/`. Cada carpeta tiene su README y su nota en `memoria/`.
