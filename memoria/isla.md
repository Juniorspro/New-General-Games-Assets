# La isla — supervivencia pixel en 3D
Qué quedó en `isla/`, cómo se hizo y lo que se pagó. Ver también: [juegos](juegos.md), [juegos-3d](juegos-3d.md), [probar](probar.md). Detalle: `isla/README.md`.

## El pedido (29/09/2026)
- "Recreá el juego de la isla, entrá al perfil y mirá todo": la isla de Phoenix Baker (@vfx843). Se vieron 30 videos del perfil (las hojas de contacto quedaron fuera del repo).
- "Un menú que me gustaría en los juegos nuevos": el de @brutu_scripts (Roblox), pero "no estilo metálico neón, sino como el de playa". Es para reusar en los juegos que vienen.
- Después: "los mismos gráficos del juego original, mejoralo, giralo 90°, agregale un propósito, más mecánicas, mejores vistas, mejores armas". Se leyó "giralo" como jugar acostado con el teléfono parado. → `isla/README.md § La historia`

## Lo que sirve para otros juegos
- Pixel art en 3D sin post: cada fragmento se corre al centro de su texel en el mundo (derivadas) y ahí se calculan textura, luz y sombra; las sombras salen en cuadraditos. → `isla/js/material.js › hastaCentro`
- Menú con cámara que se mece: tope 18°, vaivén 1,5° con seno y coseno, velocidad 3; el texto DOM se inclina con la misma inclinación. → `isla/js/menu.js` (comentario de arriba)
- Pantallas en el mundo: carteles con `CanvasTexture`; un clic es un rayo a la cara → `uv` → coordenada del lienzo. En la pausa se muestra el MISMO lienzo plano. → `isla/js/menu.js › tocarCartel`
- La toma del menú: una lista elegida mirando capturas y gana la primera con "aire" (sin rocas ni palmeras en el cono); el teléfono parado tiene su lista. → `menu.js › ubicar`
- Vuelo del menú al juego: se apaga el meneo durante el vuelo y la última imagen del menú es la primera del juego. → `menu.js › entrar`
- Física por un intermediario que decide por la ALTURA del que pregunta (y < −30 es la mina), no por dónde está el jugador. → `isla/js/main.js › fisica`
- Guardar solo lo que cambió contra la semilla: 4,2 KB con terreno tocado, palmera talada, cofre, historia y plantadas. Lo que se genera al armar (el faro aplana el suelo) va a la base: `T.base.set(T.alturas)`. → `isla/js/guardado.js`, `historia.js`
- Tres idiomas en una tabla; los nombres de ítems son getters; `t()` deja las marcas no pasadas (`+{n} Madera` la completa la notificación que va sumando). → `isla/js/idioma.js`
- Empaquetador con orden topológico sacado de los `import` (una lista a mano se desactualiza sola). → `isla/empaquetar.py`
- Reflejo plano en el agua: cámara espejo bajo el plano, solo la capa 1, textura a 1/4 y `texture2DProj`; en calidad baja se apaga. → `isla/js/agua.js › Reflejo`
- Nubes 3D toon: bolas pegadas con base chata, tres tonos. Los colores van en hex sRGB: puestos en lineal salen lavadas. → `isla/js/nubes.js`
- Jugar acostado con el teléfono parado: `#app` con `rotate(90deg) translateY(-100%)`, los dedos pasan por `aApp` (x = clientY, y = ancho − clientX), unidades `--vw/--vh` propias y clases `angosta`/`chata` en vez de media queries (esas miden la pantalla, no la app). → `isla/js/pantalla.js`
- Enemigos con una sola máquina: pasear → cazar → cargar (se ve venir) → golpe → pausa; retroceso con frenado; destello blanco cambiando el material. → `isla/js/enemigos.js`
- Que el golpe se sienta: parada de 50 ms (90 en crítico) que congela arma y enemigos pero no al jugador, números DOM proyectados desde el 3D, sacudida. → `combate.js`, `main.js › paso`
- Objetivos en capítulos que no se traban: el actual es el que sigue al más adelantado que ya se cumplió. → `historia.js › revisar`
- Una InstancedMesh no crece: se reservan 24 palmeras para plantar, en cero, y crecen de a décimos para no rearmar cada cuadro. → `vegetacion.js › plantar`
- Capas del HUD (la carta, el mapa) sueltan el puntero como una ventana: con el puntero capturado un clic nunca llega al DOM. → `hud.js › abrirCapa`
- Tercera persona sin romper nada: todo lo que hace el jugador sale de `J.ojos`, no de la cámara. → `main.js › camaraDelJugador`

## Trampas pagadas (29/09/2026)
- `null` como "nada pendiente" en la mano: `poner(null)` (mano vacía) no se armaba nunca. Se usa `undefined`. → `isla/js/mano.js`
- Una rama en el piso ganaba la mira y tapaba la celda de construcción: la celda sale del rayo de bloques y terreno aparte. → `acciones.js › apuntar`
- El color inline de un botón pisa la clase `.sel`: resaltar con borde y sombra.
- Llamar a una función que lee un `const` antes de declararlo revienta (zona muerta), aunque sea con `J && …`.
- Las rocas grandes de la orilla salían en todas las tomas del menú: se sacaron en 18 m alrededor de la choza. → `isla/js/mundo.js`
- Lo que depende del azar y hace falta para avanzar se garantiza: la semilla de siempre no daba ninguna roca con veta arriba (5 cerca del cerro al 45 %); ahora hay al menos 6. → `isla/js/mundo.js`
- Herramientas en primera persona: con el pivote en el ojo, el mango se ve como una tabla gigante. El pivote va en el puño, fuera de cuadro abajo a la derecha. → `isla/js/mano.js › POSE`
- Un parámetro `k` tapado por el `for (let k…)` de adentro: cada hoja salía multiplicada por su número y la isla quedó tapada de hojas gigantes. → `vegetacion.js › armarPalmera` (ahora `tam`)
- `undefined <= 0` da `false`: un campo sin inicializar (`saliendo`) dejaba a cangrejos y gólem sin cazar nunca. Todo campo que se compara, inicializado en `crear`.
- Un enemigo empujado al agua honda quedaba preso: se rechazaba también el paso que lo sacaba. Ahora solo se rechaza bajar más.
- Girar la geometría de un bloque alrededor del centro de la celda corre a los hijos con posición propia: las llamas salían afuera de la fogata.
- Un gólem gris en una mina gris no se ve: piedra más clara, ojos, grietas y corazón que brillan.
- `borde` multiplica el color en las aristas: en piedra clara quedan blancas (0,45 en vez de 2,2).
- `matPixel` guarda por `clave`: dos colores con la misma clave, gana el primero que se pidió.
- En Chromium sin pantalla la captura del puntero llega o se suelta fuera de turno y pausa el juego a mitad de una prueba: las pruebas no capturan (`jugar()` en `pruebas/juego.mjs`).
- Poner enemigos "adelante" del jugador en una prueba los dejaba en el agua: `despejado()` busca 10 m de tierra plana en una grilla fija (repetible).

## Lo medido (29/09/2026, SwiftShader, 960×540)
- 60/60 tres veces seguidas (`isla/pruebas/juego.mjs`) + 6/6 (`un-archivo.mjs`); lógica 0,26-0,32 ms por cuadro; playa 804.528 triángulos y 219 llamadas (el reflejo dibuja dos veces palmeras, choza y nubes); mina 66.606 y 24.
- Archivo único de 1138 KB (39 módulos); carga en 798 ms desde `file://`. Otras 5 semillas arman faro, naufragio, botella, tesoro y sala del jefe sin errores (sin mirarlas en pantalla).

## Pendiente
- Medir en un teléfono de verdad (800 mil triángulos en la playa); revisar otras semillas en pantalla (en la 1 y la 7 el barco roto queda en una loma).
