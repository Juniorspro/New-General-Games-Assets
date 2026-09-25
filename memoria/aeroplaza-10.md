# AEROPLAZA — novena vuelta (26/09/2026): Estelario, modelos, deslizar y el runner extremo

Sigue de [aeroplaza-9](aeroplaza-9.md) (Zona de Juegos, runner, movimiento). Rama
`claude/fijate-iszyer`.

## Lo que pidió

- Deslizarse cuando quiera, los brazos de primera persona más bajos, y ver
  caminar, correr y deslizar en primera persona.
- El runner "aún más extremo, como el video": sustos (screamers) y letras
  tipo DESPIERTA o WAKE UP.
- Que los avisos no spameen en la Zona de Juegos.
- Un telescopio con un Stellarium de verdad.
- Arreglar modelos 3D: primero GLB con Rezona y después pasarlos a
  procedural.

## Deslizar y primera persona

- **El bug del celu**: al soltar el botón ⤓ no se borraba `dedo.baja`, así
  que quedaba apretado para siempre y ya no había flanco nuevo. Ahora
  `entrada.js › fin` lo suelta.
- **Mantener para seguir**: con la tecla o el botón sostenidos se sigue
  deslizando:
  - `terminarMov` estira `dur` mientras `_baja` y `M.t < 1,6`;
  - al terminar hay 0,25 s de espera (`tDesliza`);
  - si seguís apretando y vas a más de 2,5 m/s, se vuelve a deslizar.
- **Primera persona** (`primera.js`, `camara.js › actualizarFP`):
  - las poses bajaron (quieto a y −0,58);
  - los brazos se mueven con el paso, y corriendo más;
  - la cabeza baja en cada pisada, se mece y se ladea (0,09 al deslizar);
  - al caer se hunde; rodando da la vuelta.
- Prueba: `movimientos.mjs` da 22 bien (C sostenida más de 1 s, soltar y
  volver a apretar, y el botón del dedo tres veces).

## Avisos que spameaban

- `juegos.js › zonaEn` devolvía un objeto nuevo cada 0,5 s, y `main.js` lo
  comparaba por identidad: un aviso por vuelta.
- Ahora las zonas son fijas (`ZONAS_J`) y se comparan por `id`.
- Lo caza `juegos.mjs` (quedarse 10 s en la zona da un solo aviso).

## Estelario (`js/estelario.js`, datos en `cielo-datos.js`)

- **El cielo es el de Buenos Aires**: lat −34,6 y lon −58,38, con la hora de
  verdad o acelerada. `tsl()` da el tiempo sidéreo; `matrizCielo` pasa de
  ecuatorial a horizonte.
- **Qué se ve**:
  - 5044 estrellas hasta magnitud 6, con su color por B−V;
  - las 88 constelaciones con líneas y nombres, en es, en y pt;
  - el Sol, la Luna (con su fase dibujada y girada hacia el Sol) y los
    planetas, con los elementos de JPL y la Luna de Meeus;
  - la Vía Láctea procedural, en coordenadas galácticas;
  - la atmósfera de día, el suelo, la grilla y los objetos de cielo profundo.
- **Controles**:
  - arrastrar, pellizcar, la rueda y tocar para elegir;
  - la lista "Ir a…";
  - el tiempo (pausa, ahora y velocidades);
  - el ocular, debajo de 12° de campo;
  - Escape cierra.
- `herramientas/cielo.py` arma los datos desde `crudo/cielo/` (d3-celestial,
  BSD; `crudo/` no se commitea).
- El telescopio (`interior.js`) llama a `J.abrirEstelario`. Mientras está
  abierto, `main.js › paso` solo dibuja el cielo.

## Modelos GLB → procedural

- Se pidieron a Rezona (Tripo; ~3,7 min y ~35 MB cada uno), se miraron y se
  copiaron a mano en `construcciones.js`:
  - telescopio, mesa de juego, silla burbuja (celeste y rosa);
  - portal de la Zona de Juegos, arco de fútbol, aro de básquet;
  - hamacas (con `cadenaHamaca` y `asientoHamaca`), trampolín
    (`trampolinDe`) y torre del tobogán.
- Los GLB no entran al juego: solo sirven de referencia.

## Runner extremo (`js/delirio.js` + `reinos/runner.js`)

- **Un lienzo 2D** (`canvas.delirio`) arriba del juego y debajo de los
  botones. `main.js` lo dibuja después de `motor.dibujar`.
- **Sustos**: son tres, en 20,1, 32,1 y 47,5 s (`SUSTOS`).
  - Tienen que caer antes de los 52 s: el que corre bien llega ahí y se
    perdería el último.
  - Muestran un destello blanco y después la cara de `assets/susto.webp`, en
    tiras corridas, con un grito sintetizado (`grito()`).
  - Se apagan en Opciones › Juego › Sustos del runner
    (`G.opciones.sustos`). El aviso de entrada lo avisa.
- **Palabras**:
  - en los golpes fuertes, gigantes, con rojo y celeste corridos, tiras y
    líneas de tele: DESPIERTA, ¿SEGUÍS AHÍ?, NO ES REAL… y en inglés cada
    tercera;
  - en los medianos, una palabra de un cuadro.
- **Los golpes** salen de `ENERGIA`: cuando sube a 8 o más es fuerte (2);
  cuando sube a 7, mediano (1).
  - El fuerte ladea la cámara (`camRoll` → `cam.rollExtra`), abre el campo
    10° y sacude.
  - Desde los 42 s, a veces congela un cuadro: `reino.congela` hace que no se
    dibuje y queda el anterior.
- **Rastreo** (`rastreables()`):
  - hasta 7 cajas de esquinas con x:/y: y líneas punteadas, una por lugar;
  - las figuras van primero y en rojo;
  - en el golpe, alguna caja muestra lo de adentro invertido.
- **Arrastre y eco**: se copia el lienzo WebGL en el mismo cuadro, antes de
  que se borre, para estirar filas de píxeles y hacer un eco en diferencia.
- **Figuras**: 5 siluetas negras de ojos blancos, en pedestales al costado de
  los tramos 10 a 18. Se ven con lo roto por encima de 0,35. A 14 m se
  deshacen, y aparece NO MIRES ATRÁS.
- **La consola** de abajo a la izquierda se escribe sola desde los 13,5 s.
- Prueba: `runner.mjs` da 26 bien. En la misma corrida del bot revisa:
  - los 3 sustos, al menos 10 palabras y alguna subliminal;
  - las cajas y las figuras;
  - el ladeo y los congelados;
  - que el susto se dibuje y que, apagado, no aparezca.

## Trampas de esta vuelta

- **Comparar objetos que se crean de nuevo** da "distinto" siempre (así
  salió el spam de avisos). Hay que comparar por `id`.
- **El `hidden` de HTML pierde contra `display: grid`** de la hoja. Hace
  falta `.estelario [hidden] { display: none !important }`.
- **`-(x) ** 2` es error de sintaxis** en JS: va `-((x) ** 2)`.
- **Sprites a 0,95 del radio del cielo**: dividir por el radio en vez de
  normalizar corría las alturas de la Luna y los planetas.
- **Polígonos de la Vía Láctea que dan toda la vuelta**: se rellenaban al
  revés y el cielo quedaba gris. Salió mejor hacerla procedural.
- **El rayo para apuntar pasaba entre las patas** del trípode del telescopio.
  Se le puso una caja invisible para apuntar.
- **Un lienzo WebGL sin `preserveDrawingBuffer`** se puede copiar
  (`drawImage`) solo en el mismo cuadro en que se dibujó. Si ese cuadro se
  congela, no hay que copiarlo (`fresco`).
- **Los sustos por tiempo tienen que caer antes de lo que tarda el que gana**
  (52 s), no antes del final de la canción.
- **Una caja de rastreo invertida** hace que la figura negra se vea blanca.
  No es un error.
- **El `susto` tapaba la palabra**: la palabra se dibuja al final.
