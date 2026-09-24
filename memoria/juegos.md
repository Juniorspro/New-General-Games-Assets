# Juegos en three.js con modelos de Rezona
Fuente: la pasada de bugs de `estancia/` (24/9/2026). Ver también: [rezona](rezona.md).

## Los rigs de Rezona: mirar el esqueleto, no los nombres

- **Los nombres mienten.** En la vaca, `tripo1_Left_Limb_*` es la cola y una pata
  delantera quedó como `bone_9..13`. Antes de usar un hueso: posición en el
  marco del modelo y cuántos vértices pesa (`estancia/herramientas/pruebas`,
  o el script de huesos del diario). Un hueso con 0 vértices mueve solo a sus
  hijos.
- **La caminata de cuadrúpedo (`preset:quadruped:walk`) no sirve** si el rig
  quedó mal etiquetado: en la vaca movía una sola pata delantera. Y no hay
  trote ni galope. Solución: `estancia/js/marcha.js` (paso/trote/galope por
  código con IK de dos tramos).
- **Los clips de bípedo traen avance de raíz** en la `y` de `Root` (viene
  girado): la cadera avanza ~1 m por vuelta y vuelve de golpe. Sacarlo y usar
  lo que avanzaba para la velocidad del clip (`modelos.js`, `quitarAvance`).
- Clips de rigs distintos del mismo modelo calzan (mismos largos de hueso): se
  pueden mezclar.

## Animar por código encima de un clip

- **Volver a la pose de reposo cada cuadro** antes de sumar giros. Los huesos
  que el clip no toca no se reescriben y el giro se acumula: cuellos que dan
  vueltas.
- Girar sobre ejes del modelo (x costado, y arriba, z frente) con
  `E.modelos.girar`, no sobre los ejes locales del hueso (cada rig los trae
  como quiere).
- Un hueso del que cuelgan otras cosas (el lomo del caballo lleva cuello y
  manos): girar y contra-girar a los hijos.
- La velocidad para las patas: del desplazamiento real entre cuadros, con
  signo. Si otro módulo mueve al animal (lazo, manga), igual camina.

## Mallas con esqueleto

- `frustumCulled = false` dibuja todo siempre (también en la pasada de
  sombras). Mejor: esfera medida en reposo ×1,6, una vez por modelo.
- Un rayo contra una malla con esqueleto recalcula todos sus vértices: para
  medir al cargar, copias quietas con los vértices ya deformados
  (`E.modelos.quietas`). La geometría cruda NO coincide si el modelo se escaló
  después de atar el esqueleto.

## Convenciones que muerden

- Rumbo: el caballo avanza hacia (sin, cos) y la cámara hacia (−sin, −cos).
  Mirar adonde va el caballo es rumbo + π (al montar se miraba para atrás).
- En el hemisferio sur el sol va por el norte: las caras al sur quedan a la
  sombra. Sin rebote del suelo la sombra de mediodía es negra.
- Rugosidad baja + sol bajo = espejo: el barro mojado a 0,35 era una mancha
  blanca.

## Ojo de águila (el Dead Eye para enlazar)

- `estancia/js/ojo.js`. Va con el dt **real**; el mundo corre a `dt × escala`
  (0,3 apuntando, 0,35 en la toma). Si se simula con el dt lento, la mira
  tarda el triple en cerrarse.
- Tiro guiado = curva armada a mano (lerp + parábola baja + caída al final) y
  `enganchar` al llegar; nada de física. Con la física pura se erraba igual.
- La toma de costado gira alrededor del punto medio Guacho–vaca. Para salir,
  primero vuelve a girar a espaldas y **recién ahí** se funde: fundir de
  costado a atrás la hacía atravesar al Guacho.
- El foco del gris (uniform `uFoco`) hay que seguirlo a la vaca también en la
  toma; si no, queda pintado donde estaba la mira.
- El tope de la toma tiene que cubrir el vuelo lento: vuelo ≈ 1 s de juego ÷
  0,35 = ~3 s reales. Con tope de 3,5 s cortaba antes de agarrar.

## Voces con acento (Higgsfield)

- Las voces preset son gringas. `qwen_audio_tts` con voz Julian + `instruction`
  (≤128 caracteres: "Gaucho argentino… rioplatense, ll e y como sh, voseo")
  da rioplatense creíble a 0,02 créditos la frase. Barrett no existe en Qwen.
- Escribir "sha" por "ya" en el texto que se manda fuerza el sonido; el
  subtítulo va con la ortografía de verdad (`voces.json`: `t` y `tts`).
- Un silbido de verdad no se genera: se sintetiza (senoidal con glissando,
  vibrato de labio y soplido filtrado). Pedirlo a un TTS dice "fiu".

## Escaneo de cuadros (elegir la calidad)

- Medir con `requestAnimationFrame` (lo que tarda la placa), no con el tiempo
  de `render()` (eso es lo que tarda JavaScript en mandar, y miente).
- Manda el lugar más pesado, no el promedio. Tirar los primeros cuadros de
  cada vista: rearmar sombras y lienzo traba.
- En una compu lentísima un solo cuadro pasa el medio segundo: saltar niveles
  (alta < 22 fps → directo a baja) o el escaneo dura un minuto.
- Las manos de primera persona cuelgan de la cámara: esconderlas en las vistas.
- Cambiar `shadow.mapSize` en caliente: `map.dispose()` y `map = null`.
- Apagar las sombras en caliente (`shadowMap.enabled`) obliga a
  `material.needsUpdate` en toda la escena. Sin sombras hace falta luz de
  relleno (ambiente + más cielo) o el lado sin sol queda negro; de noche,
  poca, o parece atardecer. En la escena del rancho: 908 mil → 597 mil triángulos.

## Más animales sobre los mismos modelos

- **Razas sin modelos nuevos**: la textura de la Hereford separa cuero (lum.
  lineal ~0,05) y blanco (~0,46); en `onBeforeCompile` se reparte cada píxel
  entre "cuerpo" y "blanco" y se pinta con los colores de la raza, guardando la
  sombra relativa. Multiplicar el color no alcanza (Angus con cara blanca).
  Overa: ruido de senos sobre la posición del vértice (`position`, antes del
  esqueleto: las manchas no nadan).
- **Ternero = vaca achicada adentro del pivote** (no en la raíz): así la marcha
  mide las patas ya chicas. Lo que se cachea por especie (la panza) va por
  especie y tamaño. El casco que se levanta (`alza`) también a escala.
- **Perro**: patas cortas → multiplicar la cadencia (×2,1); si no, el tranco
  queda más largo que la pata. A una pata le faltaba el último hueso (Rezona
  pesó el pie en el garrón): la punta se saca espejando la otra (x → −x).
- **Arrear con perros**: que la vaca se aparte del perro igual que de uno (una
  presión más en `sentir`). Abrirse en círculo detrás de la tropa no apretaba a
  nadie; cada perro empujando a una de las más lejanas, sí (62 → 20 m en 3 min).
- **Tamaño**: la geometría de Rezona viene sin índices; gzip a los GLB (y
  `DecompressionStream` al cargar) bajó 1,5 MB y el HTML volvió abajo de 16 MB.
- Un modelo de Rezona "desde texto" puede venir roto (la mesa salió una
  cuña). Mirarlo suelto antes de meterlo.

## El comedero (feedlot)

- Lugares numerados en la batea, uno por vaca, y la separación entre dos que
  comen baja de 1,6 a 0,95 m: si no, no entran hombro con hombro.
- Con el alambre de por medio, la zona de fuga casi no cuenta: uno parado en
  la calle de carga no las dejaba acercarse a comer.
- Un corral con una sola tranquera necesita dos puntos de paso (afuera y
  adentro de la tranquera): yendo derecho al lugar, se quedan contra el cerco.

## Cientos de animales

- 920 con esqueleto no: simular todos (cerca cada cuadro, lejos un cuarto por
  cuadro) y dibujarlos con UNA malla instanciada de ~350 triángulos cuyo shader
  mueve patas, cabeza y cola (la parte de cada vértice va en el color). Los de
  cerca toman prestado un cuerpo de Rezona de un pozo (pelaje cambiable: los
  uniforms leen objetos que se mutan; `material.userData.shader`).
- Separación con grilla de 3 m solo entre los de cerca; 920² pares no.
- La malla instanciada sin sombra: con `frustumCulled = false` se dibujaba
  entera también en la pasada de sombras.
- 3,8–4,8 ms por cuadro de simulación en el contenedor.

## Claridad

- Lo que apagaba la imagen era la viñeta (bordes a la mitad), la niebla y el
  cielo bajo. Brillo en Opciones: multiplica la exposición.

## Radio por internet y HUD

- Las emisoras suenan con un `<audio>` común: por WebAudio saldrían mudas (no
  mandan CORS). El volumen por distancia se hace a mano con `audio.volume`.
- Radio Browser (de1/fi1/at1.api.radio-browser.info) tiene CORS y lista por
  provincia, pero del interior del Chaco casi no tiene nada: las de Sáenz Peña
  y Presidencia Roca salieron de las páginas de cada emisora (el stream está
  en el HTML).
- El Chromium de Playwright no sale a internet solo: `launch({ proxy:
  { server: HTTPS_PROXY } })` e `ignoreHTTPSErrors`. Desde este contenedor los
  puertos raros (:8022, :9068…) no pasan por el proxy: quedan "sin comprobar".
- HUD más liviano: tareas en tarjeta de 3 renglones (lo urgente primero), las
  barras se apagan si están llenas, la plata bajo el reloj.

## Mapa

- El fondo del mapa sale de las mismas funciones del terreno (monte, pasto,
  agua, camino, relieve) a 2,2 m por píxel: se dibuja una vez al cargar y el
  mapa, el minimapa y lo vivo (hacienda, perros, uno) van encima.
- Minimapa que gira con uno: rotar el lienzo `ang − π` (ang = atan2(f.x, f.z) de
  la cámara); la flecha grande del mapa, `π − ang`.
- Antes de poner una tranquera, mirar por dónde pasa el camino: la de entrada
  quedaba con el poste en el medio del camino.

## Audio que "se escucha mal"

- Grabar la salida real (ScriptProcessor sobre la ganancia final) y medir RMS
  por escena: el mundo iba 22 dB abajo de la voz y el silbido 10 dB arriba.
- Recomprimir TTS de 24 kHz a 44 kHz/56 kbps lo aguó: dejar 24 kHz, 64 kbps.
- Reverb con ruido blanco parejo = siseo; oscurecer la cola. Limitador al final.

## Menús

- Paneles con `hidden`: una animación CSS arranca sola cada vez que el panel
  pasa de `display:none` a visible; no hace falta JS para las entradas.
- Un campo dentro de un padre oculto no toma el foco: mostrar el padre antes
  de `focus()` (el chat abría "vacío" con el HUD congelado).
- Escribiendo en un input, el teclado no es del juego (si no, "hola" camina).
- En Playwright, si el juego tomó el puntero (`requestPointerLock`), los clics
  no llegan a los botones: soltarlo antes (`G.soltarPuntero()`).

## Battle royale en Canvas 2D (Isla Royale)

- React por UMD de cdnjs con `h = React.createElement`: sin Babel el archivo
  arranca al toque y el empaquetador mete React adentro (209 KB, anda sin red).
- Isométrico: `sx = (x−y)K + ox`, `sy = (x+y)K/2 − z·zoom + oy` con
  `K = zoom·0,7071`; el suelo entero con `setTransform(K, K/2, −K, K/2, ox, oy)`
  sobre una isla dibujada una vez en un lienzo aparte; lo parado se ordena por
  `x + y`. El mouse vuelve al mundo con la inversa (`vista().aMundo`).
- Bots, números que quedaron jugables (medido): sin tregua te bajaban 200 de
  vida en 4 s. Ahora: 10 s sin pelear al empezar, 0,7 s de reacción antes del
  primer tiro, cadencia de bot ×1,8 y aparición a 520–740 del centro. Con eso,
  un bot a 250 saca ~60 en 3 s.
- Un árbol que tapa al jugador se dibuja al 35 %: si no, en el bosque no te ves.
- Trampa del celular: el botón Disparar ponía `E.disparo = true` y la palanca
  derecha lo pisaba cada cuadro con `false`. Van en banderas separadas.
- Confeti en fracciones de pantalla: la gravedad va en 0,15/s, no en 60.
- Teléfono acostado (alto ≤ 520): botones entre las palancas, armas arriba y
  minimapa chico; si no, se pisan con el minimapa.
- `window.__isla` es la ref de la partida para las pruebas.

## Probar

- Congelar el bucle y sacar las fotos a mano (`__juego.congelar`,
  `__juego.fotoDesde`): si no, el cuadro siguiente pisa la cámara.
- Tiras cuadro a cuadro de cada aire y postura, con modo prueba de velocidad
  (`estancia/herramientas/pruebas/LEEME.md`). Los bugs de rig solo se ven así.
