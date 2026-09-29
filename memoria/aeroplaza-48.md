# AEROPLAZA — cuadragésima séptima vuelta (29/09/2026): construir la casa, el celu parado, los botones en el celu, arreglos

Pidió: "dame el HTML y mejorá el juego: mejores decoraciones y un sistema de construcción en tu casa; arreglá varios
minijuegos y menús; el celular en vertical, no en horizontal; hay muchos botones que podés guardar y se usan en el
celu". Antes: [aeroplaza-46](aeroplaza-46.md) (el celu), [aeroplaza-47](aeroplaza-47.md) (las actualizaciones).

## Construir la casa

Archivos: `js/reinos/casa-piezas.js` (nuevo), `casa.js`, `ui.js › obra` y `main.js › empezarConstruir`.
- **Se entra** con 🔨 en el celu (si no estás en tu casa, viaja y después empieza) o con el atril. En la casa de otro o
  en el VR, no.
- **La cámara va desde arriba** (`camara.js › plano`: un centro, la distancia, el yaw y el pitch).
  - Con el mouse: arrastrar gira, la rueda acerca y WASD mueve.
  - Con el dedo (`entrada.js › modoObra`): toda la pantalla es de la cámara. Un dedo gira, dos mueven (`panObra`) y
    acercan, y un toque corto sin moverse es `alTocar(x, y)`.
  - La capa `#dedos` tapa el lienzo en el celu: por eso los toques se toman ahí y no en el canvas.
- **Tocar el piso** (`pisoBajo`: el rayo contra y = 1,4, o contra la altura de la tarima si cae encima) pone lo elegido,
  o mueve, pinta o quita lo que se toca (`cosaEn`, el más cerca del rectángulo girado). "📍 Acá" pone en el medio de
  la pantalla.
- **Herramientas:** girar (la obra de a 90°, lo demás de a 45°), deshacer (80 pasos) y ver los techos o no.
- **El plano:** cada cosa es `{ k, x, z, r, c?, y? }`, hasta 200 (`MAX_COSAS`).
  - La obra va en la grilla de 1 m y lo demás en la de medio metro.
  - Arriba de un piso, una plataforma o una tarima, `y` es su altura (`alturaEn`).
  - El cuadro y el reloj se pegan a la pared más cercana; girar los pasa a la otra cara.
- **Las piezas:** 54 en total. Son 12 de obra, 18 muebles y 24 de deco; las viejas de `FABRICA` siguen.
  - Obra: pared, ventana, puerta, media pared, baranda, columna, piso, damero, plataforma (0,4, se sube caminando),
    tarima (1,2), escalera (4 escalones de 0,3 que suben hacia +z) y techo.
  - Cada una puede traer sus choques (`cajas`): la puerta se atraviesa por el medio y la escalera sube de a escalones.
  - Animadas (`userData.actualizar`): el reloj da la hora de verdad, y además el burbujero, el tótem, el orbe, la
    estrella, la luz burbuja, el globo terráqueo y la bañera.
- **Fundir:** lo quieto se funde por material al tocar "Listo" y al entrar; mientras se construye, `rehacer(…, true)`,
  sin fundir.
  - Con 155 cosas: 56 ms sin fundir y 134 ms fundiendo.
  - Con 200 plantas: 1413 mallas sin fundir, 42 fundidas. Para eso los muebles viejos usan los materiales compartidos
    de `casa-piezas.js › mat`.
- **La red:** `red.alCasa` limpia lo que llega. Deja `c` solo si es `#rrggbb` y `y` entre 0 y 3, `k` de menos de 20
  letras y nada afuera del patio.
- **La casa de arranque** (`guardar.js › CASA_INICIAL`), para los nuevos: un living con piso, paredes, ventana, cuadro,
  reloj y muebles.

## El celu parado y los botones guardados

- **En `html.b460` el celu va parado:** 94 % del alto, hasta 236 px de ancho, todo más chico.
  - Los botones de las filas quedan solo con el ícono (el texto sigue en el `aria-label`, que lee el VR).
  - Las pestañas de Amigos quedan en ícono y número.
  - El inicio se desplaza si no entra; "sin conexión" va en la pastilla.
- **16 apps:** suman Construir, Gestos, Música, Mapa, Voz y Estilo.
  - La voz se prende y se apaga sin cerrar el celu, con un punto rojo mientras está prendida.
  - Ajustes es una pantalla del celu con "Botones en la pantalla" y las opciones del juego.
- **`HUD_INICIAL`:** de entrada, en la pantalla quedan 📱, 💬 y ☰. Voz, misiones, estilo y la barra 1-5 van al celu
  (`G.opciones.hud`).
  - La voz se ve igual mientras está prendida.
  - Las misiones listas suman al globito del 📱.
  - Se esconden con la clase `.guardado`: el atributo `hidden` no gana contra `display: grid`.

## Los arreglos del recorrido (un ayudante recorrió todo con 186 capturas: `pruebas/salida/recorrido/`)

- El 💎 del HUD no se podía tocar: `.arriba-izq` tiene `pointer-events: none` y los hijos lo heredan.
- Pausa › Controles › "Mover y agrandar": el editor cerraba Controles y eso volvía a abrir la pausa, que lo tapaba.
  Ahora `UI.cerrarVentana(true)` la cierra sin su `alCerrar`.
- El menú principal no entraba en 390 de alto. Ahora son 6 columnas en b460, y "▶ Jugar" con `flex-shrink: 0`.
- `.probador` (el panel) también le pegaba a `.vista.probador` (la tarjeta del menú): ahora es `.probador:not(.vista)`.
- "Mi casa": título blanco sobre blanco; ahora tiene una pastilla de fondo.
- El consejo tapaba el 💎 (top +116); el aviso del modo foto no se veía (iba dentro del HUD escondido) y ahora es
  `UI.ayudaFoto`; los gestos se cortaban.
- **Mesas:** el toque caía una columna al costado. El lienzo va con `object-fit: contain` y se dividía por toda la caja;
  ahora `aUV` saca el rectángulo dibujado. Además, `accion_mesa` no existía.
- Los resultados del parkour, el tiro y el runner, y la tienda de joyas, no entraban en 390: compactos en b460.
- Las miniaturas del parkour se cortaban (4:3 con cover; ahora 16:10).
- El probador en la compu: el 💎 se salía. En el celu, una fila sola: la cuenta restaba 24 px de más; ahora usa el
  relleno y el espacio de verdad.
- Quedaron sin arreglar, chicos:
  - la pestaña elegida del probador ("So…");
  - dos nombres del mapa que se pisan;
  - el chat y el texto del runner encima de la palanca;
  - "contra Compu" cortado en la mesa.

## Pruebas

- `pruebas/casa.mjs` (18): arranque, construir desde el celu, las 54 piezas, tocar, herramientas, deshacer, tarima,
  puerta, escalera, tope de 200, Listo, fundido, la red y las fotos (`casa-construir-*.png`, `casa-terminada.png`).
- `pruebas/botones.mjs` (8): el HUD de entrada, Ajustes, las apps nuevas, la voz y el celu parado.
- `pruebas/arreglos.mjs` (19): cada bug del recorrido, medido igual (844 × 390 con dedos, toques de verdad por CDP).
- `pruebas/celu.mjs`: 16 apps.
