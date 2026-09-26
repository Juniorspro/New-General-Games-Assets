# AEROPLAZA

Juego social 3D Frutiger Aero con multijugador por MQTT, sin servidor. Recrea
a @frutiger_space (TikTok) con otro nombre. Fuente: `aeroplaza/README.md` y los
comentarios de cada `js/`. Ver también: [rezona](rezona.md), [brillo](brillo.md)
(de ahí salen el sonido y las canciones), [maquina](maquina.md).

## Armarlo y probarlo

- `node aeroplaza/herramientas/armar.mjs` arma `aeroplaza.html` (4,2 MB, sin
  las canciones de Nintendo: va al repo) y `aeroplaza-con-canciones.html`
  (6,1 MB, gitignorado, es el que se le entrega).
- El sonido es el de BRILLO: `../../brillo/js/sonido.js` y `canciones.js`.
  **Solo suenan las canciones que mandó quien pide** (25/09: "eliminá todas
  las que no sean las que te pasé, te pasaré más"): menú = 'titulo' (Wii
  Party), plaza = 'colina' (Mii Maker), 'arrecife' (Aquatic Ambience),
  'bosque' (Frutiger Aero Ahhh), 'playa' (itsalyzee). Los temas de Rezona
  (`musica/`) se borraron y `Sonido.soloGrabadas` apaga los sintetizados.
  Un tema sin su canción toma otra por `EN_VEZ` (main.js); una nueva se suma
  con `brillo/herramientas/canciones.py --dest=aeroplaza/musica-ajena` y el
  nombre del tema (aurora, cielo, ciudad, casa…) y pisa sola. `aeroplaza.html`
  y el artefacto salen **sin música**.
- Las pruebas abren el HTML por `file://` con `?directo&pausa` y avanzan el
  juego a mano con `__A.paso(dt, dibujar)`:
  - se dibuja solo el último cuadro;
  - después un `readPixels` espera a SwiftShader. Si no, `screenshot` se
    cuelga 30 s esperando los cuadros encolados.
- Tiempos: `reinos.mjs` ~15 s por reino, `multijugador.mjs` ~3 min, `flujo.mjs` ~4 min.

## La red (lo que pidió, punto por punto)

- `js/red.js`:
  - NS `aeroplaza_v1_`;
  - sala `NS+reino-n` con /state, /chat y /action;
  - vestíbulo `NS+vestibulo`, con presencia cada 4 s, para contar las salas y
    elegir la más llena con lugar (máximo 14);
  - la casa, retenida en `NS+casa/<id>`.
- El estado va cada 100 ms si cambió, y un latido cada 1,5 s. Medido: quieto
  son 8 mensajes en 12 s.
- `js/remotos.js` guarda un Map por id. Interpola hacia targetX/Y/Z con
  `1-exp(-12·dt)` y borra a los 5 s sin noticias.
- Todo lo que llega se valida: colores `#rrggbb`, valores de las listas, daño
  de 0 a 30 y hasta 40 mensajes por segundo por id. El chat se pone con
  `textContent`.
- **El contenedor no llega al broker**: el proxy no pasa WebSocket ni el
  puerto 8084. Se prueba con `pruebas/broker.mjs`, un MQTT 3.1.1 sobre
  WebSocket en Node puro (CONNECT, SUB con + y #, retenidos, PING). Chromium
  carga mqtt.js de `pruebas/mqtt.min.js`, que no se commitea: `comun.mjs` lo
  baja con curl.
- Resultado: 16 de 16 pruebas bien.
  - Se ven y la interpolación es suave (-8,7 → -6,4 en 6 cuadros).
  - La apariencia viaja por hash y pedido.
  - Anda el chat, y el hit baja 10 de espuma solo a quien le toca.
  - A los 5 s se va el que no manda, y sin red queda "sin conexión" y se juega.
- **No se probó contra el broker público de verdad** (sin salida desde acá).

## Segunda vuelta: "no me deja jugar" + efectos pixel (24/09)

- No se supo la causa exacta: no hubo captura ni mensaje. Se arreglaron todas las causas probables.
  - **El bucle se pedía después de dibujar:** un error en un cuadro congelaba
    todo. Ahora primero va `requestAnimationFrame(bucle)` y después `try`, más
    un cartel de error con "calidad baja" y "recargar"
    (`pruebas/resiste.mjs`).
  - **En el celu arrancaba en alta**, con MSAA, doble de píxeles y sombras de
    2048. Ahora arranca en media. La automática mide 60 cuadros de tiempo real
    (no el dt recortado) y baja; en compu puede subir.
  - Hay un cartel de "cargando" en el HTML mismo, que se ve sin JavaScript. A
    los 7 s dice que se abra con Chrome o Safari. También hay `<noscript>`,
    aviso sin WebGL y aviso de contexto perdido.
  - Hay un botón grande "▶ Jugar" en el menú y un tutorial de 5 pasos.
- **Estilos retro** (`motor.js › ESTILOS`, botón 👾): Pixel 270p, PS1 200p
  con temblor, Tubo, Game Boy 144p, 8 bits (paleta Sweetie 16) y VHS.
  - Se dibuja de verdad a pocas líneas, con `image-rendering: pixelated`: por
    eso también son la calidad más liviana.
  - El temblor de PS1 es un `#define PS1` en `ShaderChunk.project_vertex`, que
    se agrega a los materiales recorriendo la escena.
  - Las líneas de TV son una capa CSS a la resolución de la pantalla.
- `dist/aeroplaza-web.html` es la versión para publicar como Artifact: sin
  `<html>`/`<head>`/`<body>` y sin canciones. Ahí el CSP bloquea los
  WebSocket, así que se juega solo; la red deja de insistir tras 4 fallos.

## Tercera vuelta: modelos 3D, muñeco, cielo, música y girar (24/09)

- **El muñeco, medido sobre los videos** (`fs/caras.png` del scratchpad):
  - piernas casi tan altas como la cabeza (la base del cuerpo a 0,38);
  - brazos gordos (r 0,084) que cuelgan por fuera hasta la base;
  - ojos de gelatina del color del cuerpo, más hondos y con filo oscuro, no
    negros; alto = 37 % de la cabeza.
  - `pruebas/muneco.mjs` saca 4 apariencias y el perfil en el estudio.
- **Las construcciones, en procedural** (pedido del 24/09, noche: "los quiero
  procedural… replicá los glb"). `js/construcciones.js` arma 16 cosas en
  código copiando `crudo/t3/ref-*.png`: casa, estación, tienda, hotel, tren,
  fuente, banco, farol, árbol (lima y rosa), palmera y 5 muebles.
  - Una sola vez cada una, fundida por material (2 a 13 llamadas). Las copias
    comparten todo (`js/modelos.js`, misma API de antes: `modelo`, `instancias`).
  - Las medidas salen del armado, no de rayos: `anden`, `pared`, `asiento`,
    `borde`, `bocha`, `radio`; la tele guarda `pantalla`.
  - Ayudas: `sq`/`sqPunto` (cuadrado redondo), `prisma` (contorno extruido con
    borde redondo), `cinta` (vidrio que sigue un contorno), `racimo`
    (arbustos), `cortar` (el hueco del sillón), `arcoSolido` (bancos curvos).
  - `pruebas/construcciones.mjs` saca cada una de tres cuartos para ponerla al
    lado de su referencia. Solo el delfín sigue siendo GLB.
  - Pesan 1.300 a 49 mil triángulos (casa 44 mil, hotel 49 mil); el HTML
    bajó de 8,2 a 4,2 MB. Los faroles van con 2 materiales: con 4 la plaza
    pasaba las 379 llamadas.
- **El cielo**: el panorama de Rezona en 4 copias espejadas alrededor del
  horizonte; lo blanco es nube teñida por la hora. Más la vía láctea de
  noche, noches más azules, arcoíris al norte (plaza, de día) y las nubes
  sueltas sin borde gris (se aclaró el color bajo el alfa).
- **Girar 90° sin pantalla completa** (`js/pantalla.js`, receta de KUNTUR):
  - todo va en `#app`; el CSS usa `--vw`/`--vh`, y en vez de `@media` las
    clases `angosta`, `a700`, `a560` y `b460`;
  - los dedos pasan por `Pantalla.aJuego`; Opciones › "Con el celu parado":
    girar solo, ⟳, ⟲ o no girar. `?giro=` para las pruebas.
  - `pruebas/dedos.mjs` prueba sin girar y girado para los dos lados: 30 de 30.
- **De los videos nuevos** (23 bajados de #frutigeraero, solo imagen):
  - medusas de gelatina (lago y Aqua) y flores de agua gigantes para pisar en
    el Jardín, como el Geyser Garden nuevo de @frutiger_space.
  - Buscar: `herramientas/tiktok-buscar.mjs` (hashtag y búsqueda, sin captcha).
  - Bajar: `herramientas/tiktok-bajar.mjs <id>` abre la página del video para tener cookies frescas.

## Cuarta vuelta: la isla grande (25/09)

Pedido: "mundo, no isla", la tienda decorada, árboles que se mueven, el tren
con su establecimiento, un mapa en el spawn, gráficos según el aparato, menús
sin desplazar, más animaciones y las tres canciones que mandó.

- **La isla** (`reinos/plaza.js`): radio ~222 con bahía al noreste. El centro
  de siempre queda igual; alrededor, seis zonas (`ZONAS`, de la más chica a la
  más grande): Terminal, Ciudad de Vidrio, Bahía del Faro, Pradera de los
  Molinos, Bosque de Hongos, Monte de la Cascada.
  - `relieve()` es la altura sin achatar; `alturaPlaza()` le suma los cuencos
    y lo plano. El monte es un `max()` que sale del mar.
  - El terreno usa `apretar`: los vértices se juntan en el centro (0,45).
  - `reino.puntos` tiene los lugares clave para las pruebas.
- **La terminal** (`construcciones.js › terminal`): andenes con mamparas,
  escalinata al este, reloj con la hora del cielo, tablero, máquinas de
  pasajes (= viajar a otro reino). El spawn es al pie de la escalinata.
- **El monorriel** (`js/monorriel.js`): curva cerrada por las zonas, la viga
  es una malla propia (corte de 16 puntos, sin torsión), pilares instanciados,
  seis paradas fundidas en una obra (`paradasMonorriel`). Los dos trenes no se
  simulan: la posición sale de `Date.now()`, así todos los ven igual.
  - Subir: el tren es una montura (`asiento`, `puedeBajar`, `salida`). En una
    parada sin tren, se espera al lado (`J.esperaTren`) y sube solo al llegar.
  - Vuelta de 887 m, período 189 s. `pruebas/mundo.mjs` sube, viaja y baja.
- **Cartel del mapa**: `dibujarIsla()` hace el mapa una vez (relieve, caminos,
  vía, paradas, nombres); el cartel y la tecla 5 usan el mismo dibujo.
- **Zonas**: cartel grande al entrar (`UI.lugar`), música por zona y la misión
  de Brújula (`tipo: 'lugar'`). Con margen de 8 % para no titilar en el borde.
- **Vecinos nuevos**: Brújula (visitar 6 lugares), Brisa (soplar 4 molinos),
  Musgo (rebotar en 5 hongos), Marea (leer 3 botellas). Premios nuevos en
  `meeple.js`: sombreros explorador, hongo y capitán; el molinete que gira.
- **Árboles vivos** (`naturaleza.js › conMeceo`): se doblan desde la base
  (k = (y/alto)²), con ráfagas que cruzan la isla; el viento va para el mismo
  lado del mundo aunque la copia esté girada (`transpose(giro)`). Las palmeras
  además aletean. Cerca y lejos comparten material: el cambio no se nota.
- **Detalle por distancia** (`Arboleda`, un Group): cada 0,5 s reparte los
  árboles entre la versión con detalle (50 m en alta) y la liviana (~600
  triángulos). Las flores se dibujan solo a menos de 60 m. Faroles y bancos
  de toda la isla van instanciados (`edificios.js › faroles, bancos`).
- **Rejilla de sólidos** (`mundo.cerca`, casillas de 16 m): con cientos de
  árboles y pilares cada consulta mira solo su casilla. `mundo.tapa()` le dice
  a la cámara si un punto está adentro de algo (ya no se mete en las casas).
- **El aparato** (`js/aparato.js`): nombre de la placa (WEBGL_debug_renderer_info),
  memoria, núcleos, píxeles y si es táctil → puntos → calidad inicial. Por
  software siempre baja. Después la automática mide y sube o baja un escalón.
- **Menús sin desplazar**: `UI.pestanas()` (Opciones, Controles, Estilo), el
  probador con dos grupos de seis pestañas y páginas ◀ ▶ que miden cuántas
  cosas caben. `pruebas/menus.mjs` abre todo en 844×390 y en compu, y falla
  si algo se pasa del alto.
- **Animaciones**: se inclina en las curvas, se aplasta al caer (más cuanto más
  tiempo en el aire), se estira al saltar, se estira o mira alrededor si queda
  quieto 9 s. Gestos nuevos: aplaudir, saltito, voltereta, pensar.
- **Controles**: la cámara se acomoda sola atrás al caminar si no se la toca
  (Opciones › Juego › "Cámara que sigue"); correr pasó de 6,6 a 7,2 m/s.
- **Canciones** (van solo en la versión con canciones): Aquatic Ambience →
  Aqua, Frutiger Aero Ahhh → bosque y monte, la de itsalyzee → la bahía.

## Quinta vuelta: día y noche, teclado, parkour e interiores (25/09)

Pedido: que no arranque de noche por la hora local (misma hora para todos,
ciclo rápido 5 min de día y 5 de noche), botones y un teclado propio
Frutiger, la Zona de Juegos con el primer minijuego (parkour en 5 mapas) y
edificios que se entran en primera persona, con ascensor.

- **El ciclo** (`cielo.js`, `CICLO = 600`): sale de `Date.now()`, igual en
  todas las compus; el sol está arriba la mitad del tiempo.
- **Teclado** (`teclado.js`): va adentro de `#app` (se acuesta con el juego;
  el del sistema saldría parado). Solo en táctil: pone el input `readOnly` y
  `inputmode=none`. Mantener una vocal 420 ms abre los acentos; ⇧ dos veces
  bloquea. Prueba: `pruebas/teclado.mjs` (acostado y parado).
- **Zona de Juegos** (`plaza.js`, `JUEGOS = [52, -50]`): piso de cristal con
  shader, el farol gigante (`construcciones.js › farolJuegos`) con puertas
  que brillan y el cartel con la miniatura (`miniaturaParkour`). La puerta
  es el interactivo `minijuego`.
- **Parkour** (`reinos/parkour.js`): 5 mapas en `NIVELES` (nubes, acuario,
  jardín, ciudad, órbita), cada uno con estrellas por tiempo. API de armado:
  `plat`, `movil`, `barra`, `rebote`, `fragil`, `cinta`, `geiser`, `control`,
  `meta`. Las plataformas que se mueven cambian `x, z, y0, y1` del sólido y
  llevan al jugador si lo pisa; por eso `mundo.sinRejilla`. Los récords van
  en `G.parkour`. Prueba: `pruebas/parkour.mjs` (21 bien).
- **Interiores** (`reinos/interior.js`, `crearInterior(ctx, tipo, o)`):
  hotel (lobby, suite en y=24, azotea en y=48), café (octógono) y casa del
  vecino (redonda). Se entra por 8 puertas de la isla (`accion: 'entrar'`,
  5 hoteles, el pabellón y las casas 0 y 2); cada puerta guarda dónde se
  aparece al salir (`salida`, `rumbo`).
  - **Primera persona:** `cam.fp` (`camara.js › actualizarFP`): ojos a
    1,5 m, pitch 0,3 = mirar derecho, hamaca al caminar, y en una charla la
    vista va sola a la cara. El muñeco propio se oculta; el `rumbo` sigue a
    la cámara (los demás te ven mirar). FOV +12°, el telescopio lo cierra a 18°.
  - **El punto** (`UI.mira`): un rayo desde el centro contra todas las
    mallas del reino (no solo las usables: las paredes tapan). Lo usable
    guarda `userData.acc = { texto(), alUsar(J), dist }` en cada pieza.
  - **El ascensor:** el piso de la cabina es un sólido que sube y lleva al
    jugador (`A.antes` en `antesDelJugador`). Las trabas de las puertas son
    sólidos `fantasma` según la puerta. Avisa con `ascensor.eventos`.
  - **Afuera:** calle, 30 torres fundidas (de noche prenden las ventanas) y
    el telón; el hotel tiene un casco sin tapas que desde adentro no se ve.
  - **La gente de adentro** (`misiones.js`, `charla: true`): Perla, Moka,
    Rulo y Nube; solo charlan.
  - Prueba: `pruebas/interiores.mjs` (32 bien, ~4 min).

## Sexta vuelta: avisos Windows 7, misiones en su botón y voz por cercanía (25/09)

Pedido: menos carteles grandes y textos que molestan; los avisos (zona nueva
y demás) bien arriba, estilo notificación de Windows 7 con sonidos
parecidos; que el parkour no tenga nada que tape; las misiones solo al
tocar un menú; chat de voz por cercanía con permiso de micrófono (WebRTC).

- **Avisos** (`ui.js › notificar`): globos de vidrio arriba, en el hueco
  entre los dos grupos de botones (`ubicarNotis` mide con `offsetLeft`:
  con el celu parado todo está girado y `getBoundingClientRect` engaña).
  Hasta tres; uno igual a uno que está suma ×2. `avisar()` y `lugar()` pasan
  por ahí (el cartel grande de zona ya no existe). En el parkour no salen.
- **Sonidos** (`timbres.js`): campanitas sintetizadas a la manera de Windows 7
  (info, bien, zona, error), por el bus de efectos, una cada 0,35 s como
  mucho. `J.sfx('aviso')` también va ahí.
- **Misiones:** el botón 📜 con la insignia (verde si hay una lista) abre el
  panel con qué hacer. El tutorial es una pista chica arriba a la izquierda.
- **Parkour:** la clase `hud.modo-parkour` esconde todo menos el reloj chico,
  la pausa y el micrófono; el control es un destello en el reloj.
- **Voz** (`voz.js`): 🎤 pide el micrófono; el estado lleva `voz` (1 con
  micrófono, 2 solo escuchando). Se conecta a menos de 12 m y se corta a más
  de 18; abre el de id más chico; oferta y respuesta enteras (sin goteo) por
  la acción `rtc` de la sala MQTT; STUN de Google, sin TURN. El audio pasa por
  un PannerNode HRTF (entero a 2 m, nada a 14). Prueba: `pruebas/voz.mjs`
  (10 bien), con el micrófono falso de Chromium.
  - **En el visor de artefactos no hay micrófono** (no existe esa capacidad):
    queda en "escuchando" y lo avisa. Con el HTML suelto sí.
- Prueba de la interfaz: `pruebas/avisos.mjs` (26 bien: compu, celu acostado
  y parado).

## Séptima vuelta: caminos libres, animación por poses y primera persona (25/09)

Pedido: que los caminos no tengan obstáculos; animar "como en chop y
linear" y como Roblox; en el parkour correr, saltar, deslizar y rodar;
minijuegos en primera persona viendo brazos, cuerpo y piernas. Mandó cuatro
TikTok de referencia: **no se pudieron bajar** (el permiso lo negó); se hizo
por lo que dijo en el texto.

- **Caminos** (`plaza.js`): `CAMINOS` tiene los extremos y puntos de paso;
  `enCamino(x, z)` da la distancia al camino (con la misma ondulación que
  se dibuja, que se apaga cerca de las puntas). `apartar(x, z, r)` corre lo
  que cae a menos de `r`: peceras 4,4, faroles, vecinos 2,8; los bancos y
  hongos sobre el camino se sacan. El monorriel recibe `libre(x, z)` y corre
  cada pilar a ±3, ±6 o ±9 m. Prueba: `pruebas/caminos.mjs` (4034 puntos, 0
  choques).
- **Animador** (`animador.js`): `CLIPS` con poses clave por canal (el rig
  R6: cadera, cuerpo, cabeza, 2 brazos, 2 piernas; x negativo en un miembro
  = adelante): corre, camina, salta, cae, aterriza, desliza, rueda (con
  `giro` 0→2π que también sube y corre el centro), trepa y pared.
  `curva(f, estilo)`: **suave** (smoothstep), **lineal** y **chop** (tres
  escalones 0/0,5/1, tiempo cuantizado a 12 cuadros y sin suavizado entre
  poses). Se elige en Opciones (`op_anim`) y vale para el muñeco y los brazos
  en primera persona (`Meeple.estiloAnim`).
- **Movimientos** (`jugador.js`, `jugador.mov`): "bajar" (C, Q o ⤓)
  corriendo desliza (más rápido, 0,72 m de alto, pasa bajo barras) y
  caminando rueda; caer de alto corriendo rueda solo; saltando contra un
  borde a la altura del pecho lo trepa (`probarTrepa`); en el aire contra una
  pared, saltar rebota (conserva lo tangencial ×0,92 y suma 6,8 hacia
  afuera). Saltar deslizándose sale con la velocidad del deslizamiento.
  Prueba: `pruebas/movimientos.mjs` (12 bien, en un arenero plano).
- **Mapa 6 del parkour, Azoteas** (atardecer, `hora 0.735`): tubos y muros
  para deslizar y rebotar (`P.tubo`, `P.muro`).
- **Primera persona** (`primera.js › CuerpoFP`): dos brazos con mano,
  pegados a la cámara y dibujados encima de todo (`depthTest` apagado), con
  poses por estado y golpes `usar` y `tirar`. El muñeco sigue ahí: cuerpo,
  cabeza y brazos pasan a un material que solo hace sombra
  (`Meeple.primeraPersona`), así mirando abajo se ven las piernas y la sombra
  entera. El ojo va 0,16 m adelante (hasta 0,32 mirando abajo) y baja al
  deslizar o rodar. El parkour tiene la opción 👁.
- **Tiro de Burbujas** (`reinos/tiro.js`): minijuego en primera persona en
  un balcón a 22 m; 60 s, blancos de 1, 2 y 5 puntos que se mueven en
  Lissajous, racha que multiplica hasta ×4, estrellas en 30/60/95. Carta en
  el menú de juegos. Prueba: `pruebas/primera.mjs` (9 bien).

## Octava vuelta: Zona de Juegos, runner, efectos y movimiento (25/09)

En su propia nota: [aeroplaza-9](aeroplaza-9.md).

## Novena vuelta: Estelario, modelos, deslizar y el runner extremo (26/09)

En su propia nota: [aeroplaza-10](aeroplaza-10.md).

## Décima vuelta: super optimización y el tráiler (26/09)

En su propia nota: [aeroplaza-11](aeroplaza-11.md).

## Undécima vuelta: probador, joyas, anuncios, choques, VR y alta (26/09)

En su propia nota: [aeroplaza-12](aeroplaza-12.md). Y después, el VR a 120, las manos y el visor:
[aeroplaza-13](aeroplaza-13.md). Las manos que titilaban en el celu:
[aeroplaza-14](aeroplaza-14.md). El flash, las dos redes y la profundidad aparte:
[aeroplaza-15](aeroplaza-15.md). Las manos rápidas, medias o suaves y el rayo que baja:
[aeroplaza-16](aeroplaza-16.md). Las manos con menos atraso (cupo, lector, GPU):
[aeroplaza-17](aeroplaza-17.md).

## Trampas que ya se pagaron

- **Pasar las piezas de un grupo a otro recorriendo `children`** saltea una
  de cada dos (`add` las saca de la lista mientras se recorre): los árboles
  quedaban sin copa. Se copia la lista antes (`[...g.children]`).
- **`CylinderGeometry(…, -π/2, π)` con `rotateX(+π/2)` queda boca abajo.** La
  bóveda de vidrio de la terminal estaba bajo el andén; va con `-π/2`.
- **Las flores instanciadas en toda la isla** eran medio millón de triángulos
  que ni se veían: se dibujan solo las de cerca.
- **Un `flex: 1` con `overflow: hidden` crece con su contenido** si no tiene
  `min-height: 0`: el probador medía mal cuántas cosas entraban por página.
- **Dos materiales con `onBeforeCompile` distinto compartían programa.** three
  usa el texto de la función como clave: todos los `conBorde` tenían la misma
  aunque cambiara `pot` o llevaran viento debajo, y uno heredaba el shader del
  otro. `conBorde` y `conViento` ahora ponen `customProgramCacheKey`.
- **`conViento` usa `instanceMatrix`:** en una malla suelta (la palmera de la
  prueba) no compilaba. Tiene su `#ifdef USE_INSTANCING`.

- **`#ui > * { pointer-events: auto }` le ganaba a `.hud { pointer-events: none }`**
  por especificidad (id). El HUD, a pantalla completa, se comía todos los
  toques: no andaban la palanca, ⤒ ni ✋, y en compu no se giraba la cámara
  con el mouse. Se vio recién con dedos de verdad (CDP `Input.dispatchTouchEvent`
  + `elementFromPoint`, `pruebas/dedos.mjs`). Tocar botones de la interfaz no
  alcanza para probar los controles.
- **`addEventListener(…, true)` se saca con `removeEventListener(…, true)`.**
  Si no, la ventana cerrada deja su Escape en captura y se come la pausa.
- **`confirm()` no anda en todos lados:** en los Artifacts devuelve false y no
  se podía comprar. Se pregunta con `UI.confirmar`.
- **Game Boy y 8 bits:** la escena es clara y todo caía en los tonos de
  arriba. Se usa una curva `pow(l, 1.3)` y la paleta de emulador. La de
  consola de fantasía pintaba el pasto de violeta; la Sweetie 16 tiene los
  celestes y verdes del Aero.
- **La animación CSS pisa el centrado.** Un `@keyframes` con
  `transform: scale()` le borró el `translateX(-50%)` al diálogo, y el botón
  Aceptar quedó fuera de pantalla. Los centrados usan `apareceC`.
- **Cajas con `BackSide`.** El zócalo de la tienda era una caja de lado de
  adentro: su cara de abajo tapaba el piso. Van tiras sueltas.
- **Texturas seamless como color.** El pasto y la arena de Rezona dejaban el
  suelo lavado. Se usan solo como grano: se divide por el último mip
  (`texture2D(t, uv, 12.)`) y el color lo pone el vértice.
- **Luz ambiente doble.** El cielo como `environment` más la hemisférica
  pintaban de celeste la arena y los caminos. Env 0,3-0,7, hemi 0,18-0,5 y
  la gelatina con `envMapIntensity` 2,2.
- **El bloom con umbral 0,9** abría en niebla todo lo blanco al sol: se usa
  1,45.
- **El vidrio con clearcoat y env**, mirado de costado, era una pared blanca.
  Va con opacidad 0,12, env 0,7 y borde fresnel.
- **El pasto instanciado fijo** o era ralo o eran millones de matas. Es una
  grilla que se enrolla alrededor del muñeco, 2R = 52 m, y lee la altura de
  una textura float horneada.
- **Las flores con 5 esferas** eran 500 triángulos cada una, la mitad de la
  isla. Planas: ~40.
- **El delfín de Tripo miraba a -z**: giro fijo π, medido con
  `pruebas/delfin.mjs`. Montado, el lomo va a -0,08 del agua; si no, el agua
  lo tapa.
- **Rezona con `n: 3`** devolvió una sola nube (g2 y g3 dan 404). Las otras
  dos se sacan espejando y recortando.
- **`PCFSoftShadowMap` ya no existe** en three 0.186. Las sombras se apagan en caliente con `sol.castShadow = false` (three recompila solo).
- **La hora fija de un reino.** La Aurora es de noche siempre: `?hora=` no la
  pisa.

- **Un rayo con la cámara sin dibujar usa la matriz vieja.** Con `?pausa`
  y `paso(dt, false)` no se renderiza, y `matrixWorld` queda dos cuadros
  atrás (lookAt solo actualiza la del cuadro anterior). Antes de
  `setFromCamera`: `camara.updateMatrixWorld()`.
- **Adentro, el techo salía verde:** la luz de hemisferio y el mapa de
  reflejos del cielo tienen el pasto abajo. En primera persona se cambian por
  un `RoomEnvironment` y un suelo claro (main.js, después de `cielo.actualizar`).
- **Paredes redondas de cilindros:** con 20 alrededor de 6,6 m quedaban
  huecos de 1,2 m y el muñeco (radio 0,32) salía. Van 40.
- **Un piso visual entero tapa lo que hay abajo:** la pileta y el hueco del
  ascensor necesitan el piso en pedazos (`pisoConHueco` hace los sólidos y
  los planos con uv del mundo, para que la textura siga).
- **`fundir` pierde los grupos de caras** (un `BoxGeometry` al que se le
  sacaron tapas vuelve a tenerlas): no fundir esos (se marcan `sinApunte`).

- **Dos micrófonos falsos se cancelan:** los dos dan el mismo tono y el
  cancelador de eco de WebRTC lo borra (llegaba 0,005). Para medir que se
  escucha, el que escucha apaga su pista (`track.enabled = false`).
- **Chrome no pasa a Web Audio el audio de WebRTC** si el stream no está
  también en un `<audio>` (silenciado): `voz.js` le pone uno a cada pareja.
- **`apareceC` trae `translateX(-50%)`:** reusarla en algo que no está
  centrado lo corre medio ancho (le pasó al tutorial). Cada cosa, su animación.

- **La ondulación del camino con el signo al revés** en la prueba: medía
  al lado del camino dibujado. La prueba usa la misma fórmula que
  `enCamino` (`- ondula * n`).
- **Brazos de primera persona demasiado grandes:** cerca de la cámara todo
  se agranda; con 0,08 de grosor parecían caños. Quedaron en 0,046, más
  bajos y abiertos (se ven antebrazo y mano).
- **La cúpula del muñeco tapa las piernas** mirando abajo: esconderlo corta
  la sombra; el material "solo sombra" (`colorWrite` y `depthWrite`
  apagados) la deja.
- **`miniaturaParkour` tiene un color de plataforma por mapa:** agregar un
  mapa sin sumar su color rompe el menú.
- **Siete cartas en el menú de juegos** no entraban: grilla de 7 columnas
  (4 en `angosta`) y cartas más chicas; medido sin desborde en compu, celu
  acostado y parado.

## Rendimiento (medido en 390×844)

| calidad | plaza | llamadas | CPU del juego |
|---|---|---|---|
| alta | 930 mil triángulos (1,59 millones con las construcciones, 24/09) | 205 (345) | 0,34 ms/cuadro (0,35) |
| alta, isla grande (25/09) | 2,49 millones en el spawn (con la pasada de sombras) | 543 | 0,61 ms/cuadro |
| baja | 429 mil (sin sombras, pasto ×0,28) | 124 | 0,32 ms/cuadro |
| media, lobby del hotel (25/09) | 244 mil | 255 (421 sin fundir los muebles) | — |

La calidad automática arranca con la de `aparato.js` (SwiftShader → baja),
mide y baja un nivel si pasan 30 ms, o sube uno si anda sobrado. Lo que más
llamadas suma en la isla grande: los muñecos cerca (hasta 30 piezas cada uno;
de lejos solo el cuerpo, `Meeple.detalle`), la tienda, la terminal y los hoteles.
No se probó en un teléfono de verdad.

## Lo que falta o se podría


- Probarlo contra `broker.emqx.io` desde una computadora con internet.
- Va a mandar más canciones: cada una con el nombre del tema que le toca
  (aurora, cielo, ciudad, casa o uno nuevo, con su `can_…` en los tres
  idiomas y su lugar en `CANCIONES` de ui.js).
