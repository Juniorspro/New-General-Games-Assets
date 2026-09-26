# AEROPLAZA — duodécima vuelta (26-27/09/2026): VR a 120, manos como Quest y visor de verdad

Sigue de [aeroplaza-12](aeroplaza-12.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- "El VR a 120 fps sin sacrificar los gráficos".
- *Hand tracking* "súper optimizado, que funcione como Meta Quest todo".
- Trabajar horas para dejarlo "hyper fluido".

## 120 sin bajar gráficos (`js/vr-dibujo.js`)

- **Antes**, con visor se dibujaba el mundo dos veces, sin la cadena de
  efectos: sin brillo, sin saturación, sin viñeta.
- **Ahora el mundo se dibuja una vez**:
  - desde el medio de los ojos, 10 % más abierto (`MARGEN`);
  - con la cadena entera;
  - con la profundidad (1/z) en el alfa del final.
- **Cada ojo lo reproyecta**:
  - con la cabeza de ese instante (*timewarp*);
  - corrido 3,2 cm con la profundidad (paralaje; iterado tres veces en el
    shader);
  - con Catmull-Rom de 5 lecturas para que no se ablande;
  - y escribe `gl_FragDepth`, así lo que va encima (las manos) se tapa bien.
- **Dibujo partido**: si el celu no llega, arriba en un cuadro y abajo más los
  efectos en el siguiente. La cabeza sigue a la velocidad de la pantalla.
- **El ritmo** (`vr.js › medirRitmo`):
  - la pantalla se estima con el 10 % más rápido de los cuadros, redondeado a
    60/72/90/120/144;
  - se parte si la mediana supera en un 30 % la pantalla durante 0,6 s;
  - vuelve a entero con 3 s sobrados, esperando el doble cada vez que falla.
- **La predicción del giroscopio**:
  - el sensor da unas 60 lecturas por segundo;
  - la pose se adelanta con `devicemotion.rotationRate`, que es el giróscopo
    crudo en los ejes del celu (alfa en z, beta en x, gama en y), o, si no
    hay, con la diferencia entre dos lecturas;
  - se adelanta hasta el momento en que se va a ver: un cuadro y medio, como
    máximo 30 ms.
- En alta el medio va 12 % más denso (`DENSO`): medido, sin eso quedaba un 7 %
  menos nítido.
- En VR no se hamaca la cabeza, no hay sacudida y no van los brazos pegados a
  la cámara.

### Medido (SwiftShader, 1266×585, alta)

| | por cuadro | llamadas | CPU |
|---|---|---|---|
| VR de antes | 1529 ms | 774 | 17,3 ms |
| entero | 996 ms | 453 | 10,6 ms |
| partido | 682 ms | 269 | 6,1 ms |

- **Contra dibujar cada ojo derecho con la cadena entera**, a media
  resolución:
  - nuevo: 34,3 dB;
  - el VR de antes: 23,4 dB;
  - nitidez: 0,965 de la referencia;
  - sin visor: 38,9 dB.
- **Timewarp** con 2° de giro: 29,3 dB, contra 18,1 dB de mostrar lo viejo.
- **Partido contra entero**: 40,4 dB.

## Manos (`js/manos.js`, `js/manos-camara.js`)

- **La cámara**:
  - la de atrás, a 640×480, y a la red va una imagen de 320;
  - MediaPipe Hand Landmarker (1.0.1) corre en un worker clásico, con
    `import()` adentro;
  - nunca hay más de un cuadro en vuelo.
- **Las fuentes y el costo**:
  - se baja de jsdelivr y de Google, unos 20 MB;
  - otro lugar: `window.AEROPLAZA_MANOS`;
  - CPU: 47 ms por foto en este contenedor.
- **La posición en metros**:
  - con los 21 puntos de la imagen y los 21 de la forma;
  - la traslación sale por mínimos cuadrados (`trasladar`, 3×3 con Cramer);
  - el campo es el del lado largo, 66°.
- **Al mundo**: con la cabeza del momento en que se sacó la foto
  (`registrarCabeza` / `cabezaEn`, interpolando).
- **Suaves y a tiempo**:
  - One Euro con corte de 1,2 Hz, beta 10 y corte de la velocidad 1 Hz
    (elegido simulando: menos temblor quieta y el mismo seguimiento);
  - se adelantan con su velocidad hasta el cuadro que se dibuja (como mucho
    70 ms).
  - Medido:
    - quieta, 0,27-0,29 mm contra 0,87 del ruido;
    - a 1 m/s, 7,1 mm de error contra 44 sin adelantar.
- **El dibujo**:
  - las 48 cápsulas de las dos manos en una `InstancedBufferGeometry`: el
    shader arma cada cápsula con dos puntos y dos radios;
  - una pasada de profundidad y otra de vidrio: 2 llamadas por ojo;
  - vidrio celeste con borde claro, como las de Quest.
- **Gestos**:
  - pellizco con histéresis (0,30 / 0,46 del largo de la palma);
  - rayo del hombro entre pulgar e índice, quieto 140 ms al pellizcar;
  - lo que se apunta, con su cartel;
  - arco de teletransporte (6,5 m/s) con parpadeo;
  - la palma a la cara y un pellizco abren el menú de la muñeca (caminar,
    girar 45°, FPS, salir), que se toca con la yema o con el rayo;
  - la yema revienta burbujas y junta orbes (`Burbujas/Orbes.tocar`);
  - dos pellizcos saltan.
- **Costo**: actualizar las dos manos, 0,05 ms por cuadro.

## Visor de verdad (`js/vr-xr.js`)

- **La sesión**:
  - immersive-vr con hand-tracking;
  - `updateTargetFrameRate` a lo más alto hasta 120 (en el Quest 3 son 120);
  - foveación 0,3.
- **El muñeco** se mueve corriendo el origen del espacio del visor a sus pies
  (`getOffsetReferenceSpace`): la cámara queda en coordenadas del mundo.
- **Las manos del visor**: las 25 articulaciones van a los 21 puntos de
  MediaPipe, sin filtro.
- **Los controles**: palanca izquierda camina, la derecha gira, el gatillo
  usa, A salta.
- **Sin brillo**: three dibuja derecho al visor y no hay cadena de efectos.

## Menos llamadas (`js/instanciar.js`)

- Las copias quietas y opacas de un mismo modelo pasan a una instancia por
  material.
- Las piezas de verdad quedan escondidas, para los choques y los rayos.
- Si una se mueve o el juego la muestra o la esconde, su grupo vuelve a ser
  piezas sueltas.
- Resultado (en la plaza, alta, tres vistas): 26 tandas y 127 piezas; 759
  llamadas contra 828, un 8 % menos.
- La imagen no cambia: entre dos corridas iguales sin instanciar ya hay 26 a
  34 dB de ruido (burbujas, NPC).
- Para comparar: `?sinInstanciar`.

## Trampas de esta vuelta

- **El brillo con UNA muestra a un cuarto de resolución** toma o no los
  reflejitos chicos según la grilla.
  - Por eso la referencia daba el doble de brillo que la reproyección.
  - Con cuatro muestras (`motor.js`) coinciden, y en el juego normal deja de
    titilar.
- **Un pase de pantalla completa con `autoClear` borra todo el lienzo** si no
  hay tijera: la referencia de un ojo salía negra.
- **`gl_FragDepth` necesita la prueba de profundidad prendida**:
  `depthFunc: AlwaysDepth` y `depthWrite`. Sin la prueba no se escribe.
- **El worker de módulo desde un blob no arranca en `file://`** (origen
  `null`). Va clásico con `import()`; MediaPipe usa ahí `importScripts`.
- **En Playwright, `page.route` le gana a `context.route`**: la ruta que corta
  jsdelivr tiene que hacer `fallback()` para MediaPipe.
- **Qué mano es**: MediaPipe dice que nombra como en espejo, pero en primera
  persona con la cámara de atrás acierta sin darla vuelta (medido con las
  tres fotos).
- **El pellizco** se ve mejor en la imagen que en metros: 0,23 contra 0,85-1.
  Va `max(imagen, metros × 0,62)`.
- **El filtro One Euro sobre una mano que reaparece** mezcla la pose vieja: se
  reinicia si estaba perdida o saltó más de 25 cm.
- **El rayo congelado al pellizcar** tiene que soltarse al soltar o al perder
  la mano.
- **Una mano perdida sigue "vista" 250 ms**: con el pellizco de la palma
  parecía un doble pellizco. El salto exige lecturas de menos de 120 ms.
- **Lo que se apunta**: el ángulo sobre la tolerancia de cada cosa. Si no, la
  parada grande del monorriel le ganaba al cartel apuntado justo.
- **En las pruebas, un cuadro sin dibujar tarda 3 ms**: el filtro veía la mano
  diez veces más rápida. Las manos de mentira van a 30 por segundo de verdad.
- **Los uniformes de color de un `ShaderMaterial`** que escribe directo: con
  `THREE.Color` llegan en lineal (más oscuros); van en `Vector3`.
- **`setAnimationLoop` después de `setSession`** prende también el bucle de la
  ventana: dos relojes, el tiempo entre cuadros negativo y el muñeco se caía
  por el piso. Va antes de la sesión.
- **IWER, el Quest de mentira**:
  - Chromium ya trae `navigator.xr`, así que hace falta
    `installRuntime({ forceInstall: true })`;
  - su `getOffsetReferenceSpace` copia el `XRRigidTransform` como matriz y
    pierde el desplazamiento. En `pruebas/comun.mjs` se le pasa `.matrix`.
- **El `clone()` de three copia el `userData` con JSON**: una referencia
  circular (pieza ↔ instancia) lo colgaba (el delfín). Las referencias van
  sin enumerar (`Object.defineProperty`).
- **`pasa` (lo que se atraviesa) puede estar en un padre**, como un portal: la
  instancia cuelga del grupo y lo tiene que heredar, si no `choques` ve
  paredes nuevas.
- **Instanciar al entrar agarraba lo que se mueve** (el delfín nada): ahora se
  anotan las candidatas y a los 2 s solo van las que no se movieron.
- **El temblor de la mano quieta varía entre corridas** (el ruido es al azar):
  con 60 muestras daba 0,33 o 0,46 mm. Se mide con 140 y el filtro se ajustó
  simulando muchas corridas.
- **Cuadros por segundo**: la pantalla y el navegador ponen el techo. En iOS
  Safari el `requestAnimationFrame` va a 60 salvo que se cambie un ajuste; en
  el webview de TikTok no se sabe.

## Pruebas nuevas

- `vr120` (12): los ojos contra la referencia, el timewarp, el dibujo
  partido, la predicción, el ritmo y la salida.
- `manos` (18): con manos de mentira y MediaPipe de verdad sobre
  `pruebas/manos/*.jpg`, hechas con Rezona en el proyecto `xVuxCcKGTN`.
- `xr` (9): con IWER.
- MediaPipe (`pruebas/mediapipe/`) e IWER (`pruebas/iwer.min.js`) se bajan con
  curl y no se commitean.

## Tanda completa

- Todas bien con el armado final (las 32). Las que fallaron en la primera
  pasada (choques, delfín, manos) eran las tres trampas de arriba.
- `fotos` avisa `ERR_FAILED` en medusas y jardín: ya pasaba en la vuelta 12
  (algo de afuera que las pruebas cortan).

## Lo que falta

- **Probar en un celu de verdad**:
  - si el video de la cámara llega derecho con la pantalla acostada;
  - el campo de la cámara;
  - si da 120 con pantalla de 120.
- **Probar en un Quest de verdad.**
- **En TikTok**: ver si deja la cámara y bajar MediaPipe de jsdelivr y de
  Google.
