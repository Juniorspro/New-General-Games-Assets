# La isla — lo que enseñó
Se borró el 30/09/2026 y volvió ese mismo día (`git checkout fbffdfb -- isla`) para ponerle la intro 3D de JXSTUDIOS: está en `isla/`, README con "Lo medido". Ver también: [juegos](juegos.md), [juegos-3d](juegos-3d.md), [probar](probar.md), [vibora](vibora.md) (el mismo logo en 2D).

## Qué era
- La isla de Phoenix Baker (@vfx843) rehecha en HTML: talar, minar, pescar, construir, mina, faro con historia en seis capítulos, enemigos, mercader; 60/60 pruebas y un solo HTML de 1138 KB (29/09/2026).
- El menú de @brutu_scripts (Roblox) al estilo playa: **el que pidió para los juegos nuevos**. → `isla/js/menu.js`

## Lo que sirve para otros juegos
- Menú con cámara que se mece: tope 18°, vaivén 1,5° con seno y coseno, velocidad 3; el texto DOM se inclina con la misma inclinación; los carteles son `CanvasTexture` y un clic es un rayo a la cara → `uv` → coordenada del lienzo. → `isla/js/menu.js`
- Pixel art en 3D sin post: cada fragmento se corre al centro de su texel en el mundo (derivadas). → `isla/js/material.js › hastaCentro`
- Física por un intermediario que decide por la ALTURA del que pregunta, no por dónde está el jugador. → `isla/js/main.js › fisica`
- Guardar solo lo que cambió contra la semilla (4,2 KB). → `isla/js/guardado.js`
- Jugar acostado con el teléfono parado: `#app` con `rotate(90deg) translateY(-100%)`, dedos por `aApp` (x = clientY, y = ancho − clientX), unidades `--vw/--vh` propias. → `isla/js/pantalla.js`
- Enemigos con una sola máquina (pasear → cazar → cargar → golpe → pausa); parada de golpe de 50 ms que congela arma y enemigos pero no al jugador. → `isla/js/enemigos.js`, `combate.js`
- Objetivos que no se traban: el actual es el que sigue al más adelantado ya cumplido. → `isla/js/historia.js › revisar`
- Empaquetador con orden topológico sacado de los `import`. → `isla/empaquetar.py`

## Trampas pagadas (29/09/2026)
- Un parámetro tapado por el `for (let k…)` de adentro: la isla quedó cubierta de hojas gigantes.
- `undefined <= 0` da `false`: un campo sin inicializar dejaba a los enemigos sin cazar nunca.
- Con el puntero capturado un clic no llega al DOM: las capas (carta, mapa) tienen que soltarlo.
- `matPixel` guardaba por `clave`: dos colores con la misma clave, gana el primero.
- En piedra clara, un `borde` alto multiplica el color y deja las aristas blancas.

## La intro 3D de JXSTUDIOS (30/09/2026) → `isla/js/intro.js`
- Mismo renderer que el juego, con escena y cámara propias: resolución completa (1,5–2) mientras dura, ACES solo en sus cuadros, y al final `medir()` vuelve a lo pixelado y `liberar()` suelta todo de la placa.
- El monograma: los 4 trazos de `logojxs.js` muestreados cada 4 unidades, `CatmullRomCurve3` y `TubeGeometry` (18.864 triángulos); se escribe con `setDrawRange` por tramo. La B va 16 cm adelante: el cruce de la X se ve sin cortar nada.
- El cromo: `MeshStandardMaterial` metálico con reflejos de un "estudio" (cajas de luz con color > 1 pasadas por `PMREMGenerator.fromScene` una vez). Con `onBeforeCompile`: lo recién escrito brilla según `uv.x` del tubo y un brillo cruza en diagonal según la posición en el mundo.
- La ventana en rombo de la reja: 4 planos de recorte con `clipIntersection = true` (recorta solo donde recortan los cuatro: adentro).
- Sale antes que nada, sin tocar (lo pidió quien pide, 30/09/2026): `await correrIntro()` arriba de todo en main.js, con su propio bucle; la isla (que traba la página un par de segundos) se arma detrás del blanco final con "Armando la isla…" y aparece desde ahí. El empaquetador envuelve main en `async`. → `isla/js/main.js › correrIntro`
- El sonido se decide al crear el audio: con permiso de sonar nace `running` (medido: sin esperar nada); sin permiso nace `suspended`, la intro va muda y el primer toque la saltea y lo prende. El jingle se agenda solo con el audio corriendo: suspendido, sonaría tarde y fuera de fase. La música del menú arranca recién al terminar.
- La playa aparece desde un blanco que se saca DESPUÉS de dibujarla una vez: el primer cuadro compila los shaders del mundo y traba.

## Trampas pagadas en la intro (30/09/2026)
- `camera.lookAt` no rehace `matrixWorld`: `project()` usaba la pose del cuadro anterior y la raya de luz salía abajo de la pantalla. `updateMatrixWorld()` después del `lookAt`.
- three.js compila un material recién cuando el objeto se ve por primera vez: las ondas del golpe trababan justo en el golpe. `renderer.compile` al armarla, con todo visible y el mismo estado del renderer (tono y recorte son parte de la clave del programa).
- La prueba de plantar un coco elegía el lugar al azar: 1 de cada 25 caía donde la mira daba en otra cosa (medido, 30/09/2026). Ahora recorre una grilla fija y se queda con el primer lugar donde el mismo juego deja plantar (`J.acciones.lugarPlantar`). → `isla/pruebas/juego.mjs`
