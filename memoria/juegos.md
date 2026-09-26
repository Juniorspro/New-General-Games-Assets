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

## Battle royale 3D (Isla Royale)

- Pedido final: "recrealo a la perfección": controles del teléfono, menús,
  carga, idioma, mapa, armas y movilidad. Se armó en módulos
  (`isla-royale/js/`: base, sonido, isla, graficos, juego, motor, ui) que el
  artifact publica con `files` y el empaquetador mete adentro para la descarga.
  Los scripts clásicos comparten el ámbito global: `const` de arriba de un
  archivo se ve en los siguientes.
- Datos del original (guías y wikis; videos no se pueden mirar): HUD táctil por
  defecto con disparo doble, saltar, agacharse, apuntar, muro/piso/escalera/
  pirámide y cambio de material; armas con rareza gris→dorado y multiplicador
  de cabeza (escopeta ×1,8, francotirador ×2,5); correr, deslizarse (agachar
  corriendo), trepar bordes, daño por caída; tormenta que pega más por fase
  (1,1,2,5,8,10). Construir cuesta 10; madera 150, piedra 300, metal 500.
- Trampa: `Object.assign(M, { get modo() {...} })` copia el valor del momento,
  no el getter; una propiedad viva va con `Object.defineProperty`.
- Grilla espacial de 8 m con recorrido DDA para los rayos: sin ella cada tiro
  miraba ~800 cajas. El objeto tocado se guarda dentro del recorrido (no con
  marcas `_t` sueltas en los objetos).
- Casas con interior: paredes armadas con cajas que dejan huecos de puerta y
  ventana; los bots entran y salen por la puerta (`puntoDePaso`).
- Construcción anclada a lo ya construido cerca (si no hay nada, al piso): así
  las escaleras encadenadas no se desfasan por el relieve.
- Escala: celda de 5 m y 4 m de alto; isla de ~470 m; relieve a 2,5 m (257²).
- Relieve, cielo/niebla, instanciado, dithering de copas pegadas a la cámara y
  `__isla.simular(seg)` para probar: igual que la versión anterior (abajo en el
  diario). SwiftShader: 1–3 cuadros por segundo, la CPU queda ociosa.

## Puesto policial (Ruta 11)

- Pedido: "200 % mejor que ESTANCIA", simulador de puesto caminero en la Ruta 11
  (Presidencia Roca). Primero pidió Unity/C# y después **"todo en HTML, lo de
  Unity es para saber trabajar"**: el C# quedó en `control-ruta11/referencia-unity/`.
- Estructura: `js/` base, generador (conductores, faltas, caras 2D), sonido,
  modelos (GLB gzip de `datos.js`, tinte de chapa), mundo, juego (fila, policía,
  inspección, puntaje, patrullero, radio), ui (React). Diseño en `GDD.md`.
- **Mano derecha en three.js**: mirando a +Z, la derecha es **−X**. Un auto en
  x = +1,9 yendo a +Z va por la mano de la izquierda. El puesto quedó en −X y el
  conductor (izquierda del auto) del lado del eje.
- La lógica "en un rato" va con el **reloj del juego** (`luego(seg, fn)`), no con
  `setTimeout`: con el bucle ocupado (o congelado en la prueba) los autos
  resueltos quedaban parados minutos.
- El estado de la interfaz se vuelca **al instante** tras cada acción
  (`avisar(true)` → `volcar()`), no solo en el cuadro siguiente.
- Un `<canvas>` con `object-fit: contain` tiene franjas: el puntero hay que
  pasarlo descontándolas (el baúl agarraba otra cosa).
- Caras de identidad: retrato 2D por código (tiembla, esquiva la mirada, ojos
  rojos, cinturón) — las cabezas 3D de Rezona no sirven para "se parece pero no es".
- Medido: ~540 mil triángulos en alta (antes 1,08 M; los algarrobos con sombra
  eran la mitad). Solo dan sombra los árboles a < 75 m del puesto.
- Prueba: `__ruta.congelar(true)` + `__ruta.simular(seg)`; SwiftShader tarda
  10–15 s por foto con el canvas grande (timeout de 120 s).

## Probar

- Congelar el bucle y sacar las fotos a mano (`__juego.congelar`,
  `__juego.fotoDesde`): si no, el cuadro siguiente pisa la cámara.
- Tiras cuadro a cuadro de cada aire y postura, con modo prueba de velocidad
  (`estancia/herramientas/pruebas/LEEME.md`). Los bugs de rig solo se ven así.
