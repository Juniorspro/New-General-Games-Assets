# Slendytubbies V2 Beta → HTML (07/10)

Cuarto port pedido por link (MediaFire), el pedido: "al 100 y en HTML sí o sí". Juego de ZeoWorks (Sean Toman),
Unity 4.0, 11 escenas: menú 3D, cooperativo y versus (red de Unity) y un jugador, cada uno de día, atardecer y
noche, y la de victoria. Salió un solo HTML de 11 MB (doble clic, sin servidor). En `ports/slendytubbies/` va
solo el código; la base es el motor de [pizza-delivery](pizza-delivery.md) (que viene de [bus-stop](bus-stop.md)).

## Lo nuevo

- **Girado 90° con el celu parado** (07/10): `pantalla.js` gira `#raiz` por CSS (`body.girado`) y pasa los
  toques a coordenadas del juego (`P.ev(e)`, `P.W/P.H`); `vw/vh` del CSS van por `--vw/--vh`. Al tocar JUGAR
  pide pantalla completa apaisada. Prueba: `pruebas/girado.mjs` (toca el botón 3D girado y cambia la cámara).
- **Arranca directo en JUGAR** (pedido del 07/10, solo este juego): sin pantalla de idioma al abrir; el texto
  sale en el idioma del celu y al tocar JUGAR se elige idioma y entra al menú. Prueba: `pruebas/inicio.mjs`.
- **MediaFire se baja con curl**: la página trae `href="https://download…"`; ese link anda (subir, no).
- **La lógica, decompilada a C#** con `ilspycmd` (dotnet tool, con el .NET 10 del scratchpad:
  `DOTNET_ROOT=… DOTNET_ROLL_FORWARD=Major`). 2600 líneas legibles en vez de IL crudo: vale la pena siempre.
- **Unity 4.0 con UnityPy**: `read_typetree(check_read=False)`; los shaders y mallas de "unity default
  resources" no se leen (el nombre del shader va primero en los bytes crudos; Plane y Cube se arman a mano: el
  Plane de 10×10 con el uv 0,0 en la esquina +x +z, y así los botones del menú se leen derechos). Un PPtr a algo
  del mismo archivo (fileID 0, no nodo) es un recurso, no "nada": antes se perdían los sonidos y las imágenes de
  los prefabs. Unity 4 apaga a los hijos de un padre apagado. El clip dice si el audio es 3D (`m_3D`). Las caras
  del Skybox traen un alfa basura: sin alfa (si no, manchas negras al pasar por canvas).
- **El juego corre sus scripts** (`guiones.js`, uno por clase): Input de Unity con teclas "pulsadas" que no se
  pierden entre cuadros lentos, cámaras que se prenden y apagan (el menú), OnMouseDown con un rayo, disparadores
  a los dos lados (el que es tocado y el jugador), OnGUI como capa de imágenes y ventanas tipo Unity.
- **Niebla exp² 0,04**: no se ve nada a más de 2,6/densidad (65 m). Árboles en celdas de 50 m que se esconden
  detrás de la niebla y terreno lejano con menos detalle: de 2,6 millones de triángulos a ~80 mil. No cortar la
  cámara a 65 m: se ve el cielo donde iría el terreno gris.
- **Trampas**: la capa táctil tapaba las ventanas del OnGUI (z-index); el puntero bloqueado de una partida
  impedía tocar los botones de la siguiente (soltarlo al cambiar de escena; G/H como en el original); el clic del
  menú llegaba dos veces (abría y cerraba los créditos); en el HTML único, `replace` con un string interpreta los
  `$` del código minificado: reemplazar con función.
- **HTML de un archivo**: los datos en base64 (JSON y .bin con gzip, `DecompressionStream`), blobs al arrancar,
  todo pedido pasa por `url()`. La letra va como data URL. Funciona con file://.
- **Multijugador**: la IP pasa a código de sala de 4 letras sobre MQTT (wss://broker.emqx.io, como AEROPLAZA).
  Network.Instantiate viaja como evento; cada jugador trae un Tinky (como el original). Prueba: `red.mjs`, 10/10.
- **Carteles traducidos** (57): `traduccion/carteles.py` detecta renglones y redibuja con Creepster / Amatic SC /
  Patrick Hand; créditos y ayuda rearmados (la ayuda también en inglés: cambia cómo se conecta).

## Errores del original que se dejaron o se arreglaron

- Se deja: la natilla suma el cartel N/10 también al tocar otros disparadores; el ruido de los sustos dura 0,1 s.
- Se arregla: morir mostraba el menú en el mismo cuadro (ahora 2 s de "te atraparon"); el Tinky del versus veía
  con niebla (la apagaba dos veces); los colores del personaje bajaban de tinypic (ya no existe): son tintes.

## Falta

Probar contra el broker público de verdad (desde acá no hay salida) y en un celu real.
