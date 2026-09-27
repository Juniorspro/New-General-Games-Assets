# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Cuando pase de ~30 entradas, las viejas
se resumen en una sola.

- **27/09/2026, de noche, todavía más tarde · `claude/fijate-iszyer`:**
  - Pidió: "no, pues no escanea el entorno".
  - Quedó ([aeroplaza-36](aeroplaza-36.md)): la cámara con profundidad se elige antes de arrancar ARCore, los
    pedidos se guardan si ARCore no existe, y la tarjeta dice en qué paso se traba. `malla.mjs` 18/18.
  - Falta: la captura de la línea 📡 de la tarjeta, para saber cuál era la causa.
- **27/09/2026, de noche, más tarde · `claude/fijate-iszyer`:**
  - Pidió: "no escanea" y "en un lente detecta mal: los dos deben ser iguales".
  - Quedó ([aeroplaza-35](aeroplaza-35.md)): la cámara de 30 con profundidad al escanear, la malla de planos sin
    profundidad, el diagnóstico en la tarjeta y los dos ojos desde la cámara. `camara.mjs` 13/13, `malla.mjs` 16/16.
  - Falta: que mande una captura de la tarjeta (la línea 📡 dice si llega la profundidad).
- **27/09/2026, de noche · `claude/fijate-iszyer`:**
  - Pidió: el escaneo de su `asalto-mr.apk` (una malla del cuarto), más preciso, que llene lo que no llega y que
    lo ya escaneado no se reescanee.
  - Quedó ([aeroplaza-34](aeroplaza-34.md)): `Malla.java` (TSDF de 3 cm, surface nets, huecos, planos, bloques
    hechos), servida por `/malla/` y dibujada en trozos. `pruebas/malla.mjs` 14/14 con un cuarto de mentira.
  - Falta: verlo en su celu (el tiempo del hilo de la malla y lo limpia que sale con profundidad de verdad).
- **27/09/2026, a la noche, más tarde · `claude/fijate-iszyer`:**
  - Pidió: que las ventanas de tu espacio no se amontonen, que el escaneo desaparezca, manos menos visibles como
    un Quest, poder agarrar las ventanas y que el menú de la palma no salga solo al cerrar la mano.
  - Quedó ([aeroplaza-33](aeroplaza-33.md)): el menú de la palma pide mirarla, abierta, 0,25 s; manija y agarre con
    la mano; lugares libres en arco; el escaneo se desvanece; manos fantasma. `espacio.mjs` 28/28, `manos.mjs` 20/20.
  - Falta: que diga si en su celu ya agarra (la pinza a menos de 7 cm de la manija o la barra).
- **27/09/2026, a la noche, tarde · `claude/fijate-iszyer`:**
  - Pidió: la linterna sola con poca luz en el VR, que la cámara de tu espacio no se vea "con ojo de pescado", y
    que el punto del centro se mueva al ajustar las lentes.
  - Quedó ([aeroplaza-32](aeroplaza-32.md)): la foto en tamaño real con el borde borroso afuera (el aumento, ahora
    apagado de entrada, era el ojo de pescado); la gamma con lentes (salía oscuro); la linterna sola con lo que
    mide Java. `pruebas/camara.mjs` 12/12.
  - Falta: que lo mire con el visor y diga si todavía se ve curvo (sería el perfil de las lentes).
- **27/09/2026, a la tarde, más tarde · `claude/fijate-iszyer`:**
  - Pidió: que en el VR con ARCore la vista no suba ni baje sola, y que las manos sin ARCore anden como con ARCore.
  - Quedó ([aeroplaza-31](aeroplaza-31.md)): la altura sigue a ARCore solo si el acelerómetro nota que te movés;
    sin ARCore la APK abre la cámara (Camera2) para las manos de Android. `pruebas/nativo.mjs` 18/18.
  - Falta: probar en su celu los cuadros por segundo de esa cámara y que la vista quede quieta con el visor.
- **27/09/2026, de madrugada · `claude/fijate-iszyer`:**
  - Pidió: que la cámara ocupe todo al escanear (para andar por la casa), el 0.5x, y actualizar el HTML.
  - Quedó ([aeroplaza-29](aeroplaza-29.md) § La cámara llena la vista): "Llenar la vista" con visor, la foto
    entera, la cámara más abierta que ARCore acepte y el aviso de si quedó el 0,5x.
  - Falta: saber en qué celus ARCore deja el 0,5x (en casi todos, solo la principal).
- **27/09/2026, a la noche, más tarde · `claude/fijate-iszyer`:**
  - Pidió: un menú para ajustar las lentes del SBS ("son solo un cubo").
  - Quedó ([aeroplaza-30](aeroplaza-30.md)): `js/lentes.js` (barril, colores, borde, centro de cada lente; perfiles),
    el menú con vista previa y el panel adentro del VR (menú de la palma). `pruebas/lentes.mjs` 12/12.
  - Falta: que diga qué visor tiene y cómo se ve (los números de los perfiles no se probaron en un visor).
- **27/09/2026, a la noche · `claude/fijate-iszyer`:**
  - Pidió: al tocar VR, preguntar por ARCore; con ARCore escanear todo el cuarto (piso, paredes, objetos) como un
    Quest, medir las manos sobre la mesa y abrir una pantalla para tocar, jugar o abrir ventanas de prueba del
    6DoF; sin ARCore, las ventanas en el mundo del juego.
  - Quedó ([aeroplaza-29](aeroplaza-29.md)): `js/espacio.js`, `js/ventanas.js`, `Espacio.java`; la pregunta en el
    menú del VR; "🪟 Ventanas" en el menú de la palma. `pruebas/espacio.mjs` 22/22 con un Android de mentira.
  - Falta: probarlo en un celu con ARCore (la profundidad, la foto de la cámara, que los planos cierren bien).
- **27/09/2026, a la tarde · `claude/fijate-iszyer`:**
  - Pidió: "seguí arreglando mi juego y sacando ese maldito retraso cada vez más en las manos" (AEROPLAZA).
  - Quedó ([aeroplaza-28](aeroplaza-28.md)): el resorte más corto moviéndose y a 60 fotos; más adelanto con la
    cámara lenta; suaves que sueltan el ancla. De costado a 10 cm/s, 102 → 78 ms; con sus videos, `centro`
    33,1 → 32,3 y 16,2 → 14,6. La APK busca una mano mientras ve una (antes, palmas en cada foto).
  - Falta: medir en su celular cuánto baja el ms/red de la APK (el cartel de ⏱).
- **27/09/2026, al mediodía · `claude/fijate-iszyer`:**
  - Pidió: preguntó si la APK corre sobre una WebView (sí: el Chrome del teléfono;
    el WebGL va a la placa igual) y CONTRAGOLPE (un HTML que mandó) en APK,
    "optimizadísimo, que una batata corra el full gráficos".
  - Quedó ([contragolpe](contragolpe.md)): `contragolpe/` separado; la APK (22 MB, texturas
    ETC2: 104 → 23 MB en la placa); llamadas 191 → 127; mandar el dibujo 12 → 8 ms con
    el procesador 6 veces más lento; cuatro pérdidas de memoria cerradas; mandos a gusto.
  - Falta: probarla en un teléfono de verdad (ETC2, 60 Hz, cuánto va).
- **27/09/2026, de mañana, más tarde · `claude/fijate-iszyer`:**
  - Pidió: con un TikTok de la app Spatial del Quest ("mirá esa
    estabilidad"), la próxima versión en APK, con ARCore.
  - Quedó ([aeroplaza-27](aeroplaza-27.md)): `aeroplaza/android` (WebView +
    ARCore + MediaPipe de Android), `herramientas/apk.mjs`; en el VR, la cabeza
    en 6 ejes con ARCore y las manos de Android; `pruebas/nativo.mjs` 10/10.
    La APK compila: 17 MB (con canciones 23,9); el MediaPipe de la web va
    afuera salvo con `--wasm` (el tope para mandarla es 30 MiB).
  - Falta: probarla en un celu (ARCore, la foto derecha, lo que tarda la GPU).
- **27/09/2026, de mañana · `claude/fijate-iszyer`:**
  - Pidió: con un video a 60 fps, que mover un dedo no mueva la mano; la
    cámara ajustada, con filtros para flash, oscuro y mucha luz, y a 60.
  - Quedó ([aeroplaza-26](aeroplaza-26.md)): la palma no se adelanta si solo
    se mueven los dedos (vaivén 3,9 → 2,9 %, MediaPipe 2,6); la cámara pide 60
    y un mínimo, una tercera red con 8 núcleos; la luz de la mano se corrige
    antes de la red (muy oscuro, error 5,0 → 2,1 %) y la exposición baja si
    se quema.
  - Falta: probar en el celu la cámara a 60, la exposición y la tercera red.
- **27/09/2026, de madrugada, más tarde · `claude/fijate-iszyer`:**
  - Pidió: que baje todo más, sin demoras, y que no patee ni se laguee lejos
    o fuera de la cámara.
  - Quedó ([aeroplaza-25](aeroplaza-25.md)): en su video, patadas 373 → 77 por
    minuto y tiembla la mitad; al salir de la cámara sigue y frena (antes se
    clavaba); la red a 480 (lejos, 70 % más precisa); de costado va la mitad
    de atrás en lo parejo y el dedo se cierra en 160 ms (285).
  - Falta: probarlo en el celu; quieta tiembla un poco más (0,17 → 0,19 mm).
- **27/09/2026, de madrugada · `claude/fijate-iszyer`:**
  - Pidió: con un video de su mano, que la siga "a la perfección", sin
    estirarse ni deformarse.
  - Quedó ([aeroplaza-24](aeroplaza-24.md)): `manos-video.mjs` mide contra el
    video; tamaño fijo, la forma decide qué mano es, sin adelanto de los
    dedos, puntas sin doblarse para atrás. Se corre 131 → 63 % de la palma,
    al revés 11 → 1 %, dedos para atrás 13 → 3 %.
  - Falta: probarlo en el celu; el dedo tarda más en cerrarse (285 ms).
- **27/09/2026, más tarde a la noche · `claude/fijate-iszyer`:**
  - Pidió: "con la palma para abajo la detecta como arriba".
  - Quedó ([aeroplaza-23](aeroplaza-23.md)): la etiqueta de MediaPipe solo
    cuenta si es segura, y la forma se dobla como la mano que es.
  - Falta: probarlo en el celu.
- **27/09/2026, a la noche · `claude/fijate-iszyer`:**
  - Pidió: que la tanda no dure tanto; que la mano siga movimientos rápidos,
    quede firme y no se duplique.
  - Quedó ([aeroplaza-22](aeroplaza-22.md)): la mano a prueba contra los
    fantasmas de MediaPipe (dobles 37 % → 0 en el simulador); el manotazo que
    se pasa 93 → 66 mm y quieta tiembla un 36 % menos; `pruebas/todas.mjs` y
    cuatro pruebas sin dibujar (voz 180 → 47 s, multijugador 143 → 64).
  - Falta: probarlo en el celu; la captura del cartel de ⏱ sigue pendiente.
- **27/09/2026, a la tarde · `claude/fijate-iszyer`:**
  - Pidió: un video de su celu y "lentoooo".
  - Quedó ([aeroplaza-21](aeroplaza-21.md)): el adelanto sin el tope que lo
    frenaba con una cámara lenta (con la foto a 194 ms, de costado 97 → 26 ms
    atrás), con tope de 10 cm para los manotazos.
  - Falta: la captura del cartel de ⏱ de su celu (fotos/s, ms, ms/red, GPU):
    sin eso no se sabe cuánto tarda la foto ahí.
- **27/09/2026, al mediodía · `claude/fijate-iszyer`:**
  - Pidió: "de palma va bien pero tarda en seguirme; al darla vuelta se deforma
    todo y no la sigue". Mandó su "Recreo" de referencia.
  - Quedó ([aeroplaza-20](aeroplaza-20.md)): los puntos por la imagen, el
    espejo en profundidad que sigue lo que venía (dándose vuelta, los dedos
    15° → 6°, el giro 45° → 14°) y el nivel Medio más rápido al arrancar.
  - Falta: que diga cómo le va y, si sigue lenta, que mande el cartel de ⏱
    (fotos por segundo, ms por red, latencia) de su celu.
- **27/09/2026, a la mañana · `claude/fijate-iszyer`:**
  - Pidió: "se estira demasiado y se dobla y deforma todo; tomate las horas que
    sean para optimizar todo".
  - Quedó ([aeroplaza-19](aeroplaza-19.md)): la mano como un cuerpo (palma con
    centro y giro, dedos en la palma con su largo y bisagra). Se doblaban de
    más 16° → 2,8°; el dedo que se cierra, 147 → 118 ms; tiembla menos.
  - Falta: que diga si ahora se ve bien en su celu.
- **27/09/2026, al amanecer · `claude/fijate-iszyer`:**
  - Pidió: "fluido, pero no sigue a la mano del todo bien; se estira, se
    deforma en vez de tener siempre la misma proporción".
  - Quedó ([aeroplaza-18](aeroplaza-18.md)): la mano con su forma aprendida
    (el peor hueso 58 % → 5 % fuera de su largo); el giro con adelanto
    aunque la mano esté anclada (21° → 13,5° atrás); rápidas pasea menos
    quieta.
  - Falta: que diga si ahora la sigue; si no, probar "Rápidas" (sigue los
    movimientos chicos en 140 ms contra 360 de medio).
- **27/09/2026, a la madrugada · `claude/fijate-iszyer`:**
  - Pidió: "mejoralo un 700 %, que la mano replique los movimientos sin
    retraso".
  - Quedó ([aeroplaza-17](aeroplaza-17.md)): cada red busca una mano cuando
    hay una (74 → 38 ms por foto), las fotos directo de la cámara al worker, la
    carrera de la GPU y los niveles afinados. De la foto a la mano: 100 → 58 ms;
    en lento, medio atrasa 27 ms de costado (antes 71).
  - Falta: los números de ⏱ de su celu (si ganó la GPU, si va ⚡).
- **27/09/2026, más tarde todavía · `claude/fijate-iszyer`:**
  - Pidió: la mano va "muy muy lenta" (la vuelta 14, que temblaba, parecía un
    Quest): un punto medio. Y el rayo para elegir no bajaba.
  - Quedó ([aeroplaza-16](aeroplaza-16.md)): tres niveles en el menú del VR
    (medio de entrada: tiembla como la 15 y atrasa 70 contra 99 ms de costado
    y 101 contra 141 en profundidad); el rayo desde los ojos, que baja al
    piso; los números de las manos en el cartel de ⏱.
  - Falta: que mande los números de ⏱ de su celu y cuál nivel le gusta.
- **27/09/2026, a la noche · `claude/fijate-iszyer`:**
  - Pidió: un botón de flash en el modo sin SBS, menos temblor y que la mano
    vaya "súper igual a la mano real".
  - Quedó ([aeroplaza-15](aeroplaza-15.md)): el flash; dos redes a la par;
    la profundidad filtrada aparte. Quieta 3,9 → 2,3 mm; no titila; el
    atraso que se suma a la cámara, un 10-14 % menos.
  - Falta: probar el flash y las dos redes en un celu de verdad.
- **27/09/2026, más tarde · `claude/fijate-iszyer`:**
  - Pidió: "va titilando la mano, optimizalo un 700 %" (en el celu, por el
    link de githack).
  - Quedó ([aeroplaza-14](aeroplaza-14.md)): las manos por cámara sin titilar
    ni duplicarse, sin tirones (p99 ~100 → ~10 mm), y la prueba
    `manos-celu` que simula el celu.
  - Falta: probarlo en el celu de verdad.
- **27/09/2026 · `claude/fijate-iszyer`:**
  - Pidió: el VR a 120 sin bajar gráficos, manos como Meta Quest "súper
    optimizadas", y trabajar horas para dejarlo fluido.
  - Quedó ([aeroplaza-13](aeroplaza-13.md)):
    - el VR reproyectado (una vuelta al mundo por cuadro, con efectos);
    - manos por la cámara con MediaPipe y por el visor;
    - el modo Visor VR (WebXR, 120 Hz);
    - las copias instanciadas.
  - Falta:
    - probar en un celu con pantalla de 120 y en un Quest de verdad;
    - ver si TikTok deja la cámara y bajar MediaPipe.
- **26/09/2026, noche · `claude/fijate-iszyer`:**
  - Pidió: que no se tape el muñeco en el probador, probarse la ropa antes de
    comprar, joyas (10 por día, ropa de 100 para arriba), IAA e IAP, no
    atravesar edificios, optimizar la calidad alta y un modo VR con
    giroscopio, sin controles, con o sin SBS.
  - Quedó todo ([aeroplaza-12](aeroplaza-12.md)). Antes: la portada 3:4 del
    tráiler y el video subido a Gofile ([aeroplaza-11](aeroplaza-11.md)).
  - Falta:
    - el servidor de las compras de TikTok (la orden y el webhook) y los IDs
      de anuncio: van en `window.AEROPLAZA_CAJA`;
    - probar el VR en un celu de verdad con visor.
  - La tanda entera da bien (el telescopio de `interiores` quedó a hora fija);
    `voz` solo falla dentro de la tanda, por carga.
- **26/09/2026, más tarde · `claude/fijate-iszyer`:**
  - Pidió optimizar para todos los celulares (sin sombras, brillos, etc.) y
    un tráiler como el de BRILLO pero mucho mejor, con las canciones del
    juego y motion graphics.
  - Quedó la calidad mínima con el corte por distancia, la carga más rápida y
    el tráiler de 61 s ([aeroplaza-11](aeroplaza-11.md)).
  - Falta: medir mínima en un celu flojo de verdad.
- **26/09/2026 · `claude/fijate-iszyer`:**
  - Pidió:
    - deslizarse cuando quiera;
    - brazos más bajos y ver caminar, correr y deslizar en primera persona;
    - el runner más extremo, con sustos y DESPIERTA o WAKE UP;
    - que no spameen los avisos;
    - un Stellarium en el telescopio;
    - mejores modelos (GLB y después procedural).
  - Quedó todo ([aeroplaza-10](aeroplaza-10.md)).
  - Los sustos se apagan en Opciones › Sonido.
  - Falta: escuchar el grito sintetizado en un aparato de verdad.
- **25/09/2026, noche (3) · `claude/fijate-iszyer`:**
  - Pidió: dos canciones nuevas (una breakcore), la Zona de Juegos como mapa
    con puertas y más de 10 juegos, un runner que dure lo que la canción y se
    llene de glitches, deslizar siempre, las manos más abajo, un aviso a la
    vez, caminar y correr de su video, efectos especiales y nubes sin recortes.
    Quedó todo ([aeroplaza-9](aeroplaza-9.md)).
  - El R6 de Roblox real lo rechazó: las poses son las de su video.
  - Los links de TikTok no se bajan (permiso negado); los mp4 que manda sí.
  - Pruebas nuevas: `juegos.mjs` y `runner.mjs` (con un bot que lo gana).
  - Falta: probar las mesas y la pelota entre dos personas de verdad.
- **25/09/2026, noche (2) · `claude/fijate-iszyer`:**
  - Después pidió que suenen solo las canciones que mandó (va a mandar más):
    se borraron los temas de Rezona y se apagaron los sintetizados; la versión
    sin canciones (repo y artefacto) queda sin música ([aeroplaza](aeroplaza.md)
    § Armarlo y probarlo).
  - Pidió: caminos sin obstáculos, animar en chop, lineal y estilo Roblox,
    correr, saltar, deslizar y rodar en el parkour, y minijuegos en primera
    persona con brazos, cuerpo y piernas. Quedó todo ([aeroplaza](aeroplaza.md)
    § Séptima vuelta): mapa 6 Azoteas y el Tiro de Burbujas.
  - Los cuatro TikTok de referencia no se pudieron bajar (permiso negado): si
    los describe o los manda de otra forma, se ajustan las animaciones.
  - Pruebas nuevas: `caminos.mjs`, `movimientos.mjs` y `primera.mjs`.
- **25/09/2026, noche · `claude/fijate-iszyer`:**
  - Pidió: avisos arriba estilo Windows 7 con sus sonidos, menos carteles
    grandes, el parkour despejado, las misiones solo desde un botón y chat de
    voz por cercanía. Quedó todo ([aeroplaza](aeroplaza.md) § Sexta vuelta).
  - Pruebas nuevas: `avisos.mjs` y `voz.mjs` (el micrófono falso está en
    `comun.mjs`).
  - Falta: probar la voz entre dos redes de verdad (sin TURN, algunas no
    conectan).
- **25/09/2026, más tarde · `claude/fijate-iszyer`:**
  - Pidió: día y noche igual para todos (5+5 min), botones y teclado propio
    Frutiger, la Zona de Juegos con un parkour de 5 mapas, y edificios que
    se entran en primera persona con ascensor y cosas para usar. Quedó todo
    ([aeroplaza](aeroplaza.md) § Quinta vuelta).
  - Pruebas nuevas: `parkour.mjs`, `interiores.mjs`, `teclado.mjs`.
  - Falta: probarlo en un teléfono de verdad; los interiores no tienen
    minimapa propio.
- **25/09/2026 · `claude/fijate-iszyer`:**
  - Pidió "mundo, no isla" y de todo: árboles que se muevan, la tienda
    decorada, el tren con su establecimiento, un mapa en el spawn, gráficos
    según el aparato, menús sin desplazar, más animaciones y tres canciones.
    Quedó todo ([aeroplaza](aeroplaza.md) § Cuarta vuelta).
  - Las canciones van solo en `aeroplaza-con-canciones.html` (los mp3 en
    `aeroplaza/musica-ajena/`, sin commitear).
  - Falta: probarlo en un teléfono de verdad (todo se midió con SwiftShader).
- **24/09/2026, noche (5) · `claude/fijate-iszyer`:**
  - Pidió las construcciones en procedural, copiando los GLB. Quedaron en
    `js/construcciones.js` ([aeroplaza](aeroplaza.md) § Tercera vuelta); se
    sacaron los 15 GLB (el delfín queda).
  - Falta: nada pedido. Se le ofreció pasar también el delfín a procedural.
- **24/09/2026, noche (4) · `claude/fijate-iszyer`:**
  - Pidió: más videos de Frutiger Aero, arreglar los cielos, música en vez de
    la sintetizada, modelos 3D mucho mejores, el muñeco igual al de los videos
    con ojitos y girar 90° sin pantalla completa.
  - Quedó todo: [aeroplaza](aeroplaza.md) § Tercera vuelta. 15 modelos de
    Tripo, temas de Rezona cosidos, panorama de cielo, `js/pantalla.js`.
  - No mandó archivos de música nuevos con este pedido: se usaron temas de
    Rezona para los reinos, y se le avisó.
  - Falta: probarlo en un teléfono de verdad (el giro y el peso de 8 MB).
- **24/09/2026, noche (3) · `claude/fijate-iszyer`:**
  - Dijo "no me deja jugar" (sin detalle) y pidió mejorar todo y efectos
    pixel. Se blindó el arranque y se agregaron siete estilos retro a baja
    resolución: [aeroplaza](aeroplaza.md) § Segunda vuelta.
  - Falta saber en qué aparato le falló, para confirmar que era eso.
- **24/09/2026, noche (2) · `claude/fijate-iszyer`:**
  - Pidió replicar en HTML el juego de @frutiger_space (TikTok), "mejorado un
    1000%", con multijugador global por salas públicas sin código. Tenía que
    ser por MQTT público, siguiendo su receta al pie de la letra, y con sus
    canciones.
  - Quedó AEROPLAZA (`aeroplaza/aeroplaza.html`). Cinco reinos, tienda, casa,
    misiones y probador. El arte es de Rezona (proyecto ItLImpyNnh).
  - La red se probó con un broker local (16 de 16). Cómo y trampas:
    [aeroplaza](aeroplaza.md).
  - Falta probarlo contra el broker público de verdad (desde acá no hay
    salida) y en un teléfono de verdad.
- **24/09/2026, noche · `claude/fijate-iszyer`:**
  - Dijo que BRILLO "va muy lag" y pidió bajar la resolución, acercar la
    cámara y cinemáticas al hablar con los NPC. Hecho y medido:
    [brillo-rendimiento](brillo-rendimiento.md).
  - No se probó en un teléfono de verdad (solo en Chromium con la placa
    simulada).
- **24/09/2026, tarde · `claude/fijate-iszyer`:**
  - Mandó dos videos de TikTok con música de Nintendo para BRILLO: el menú de
    Wii Party ("f9") va al menú y al tráiler, y Mii Maker ("9c") al mundo 1.
    Va a mandar más, una por mundo. También pidió que las gotas hagan "pup".
  - Quedó en `brillo/musica/` con su herramienta. El tráiler se volvió a
    grabar a 110 BPM para que los cortes caigan en la canción (67 s). Cómo y
    trampas: [brillo](brillo.md), [brillo-trailer](brillo-trailer.md).
  - Falta: las canciones de los mundos 2 a 6, cuando las mande.
- **24/09/2026, mañana · `claude/fijate-iszyer`:**
  - Pasó un TikTok de @m4jor3d × @W-SE (auto malva y tigre blanco en la nieve,
    16,5 s) y pidió "logra esto en three.js en html". Quedó NEVADA:
    `nevada/nevada-en-un-archivo.html` (10 MB), con sus assets de Rezona y un
    phonk propio. Cómo se arma y sus trampas: [nevada](nevada.md).
  - Antes, en esta misma sesión: miniaturas con Rezona para los tres videos, y
    los videos preparados para TikTok. Publicar lo hace quien pide, desde el
    widget de Higgsfield.
  - Falta, si lo pide: un MP4 de la cinemática y subirla a Rezona.
- **24/09/2026, madrugada · `claude/fijate-iszyer`:**
  - Pidió dos videos de gameplay relatados de ~1 min, con sus 7 stickers como
    narrador y memes bajados (no generados).
    - LUZ MALA: "bien chaqueño, chamamé", y después "memes chaqueños".
    - KUNTUR: "la peruanita", que en el video es Killa, de Purmamarca.
  - Quedaron en `videos/salida/` (no se commitea), y se le mandaron las copias
    livianas. Cómo se hacen: [videos](videos.md).
    - LUZ MALA: 65 s, con una versión sin música.
    - KUNTUR: 56 s.
  - No se bajó chamamé de TikTok con ssstiktok (son canciones con dueño): va el
    chamamé del propio juego.
  - Falta, si lo pide: un tercer video, y los videos en inglés y portugués.
- **23/09/2026, noche · `claude/fijate-iszyer`:**
  - Pidió un tráiler de BRILLO "completísimo". Después dijo "usá Remotion o
    instalá un editor de verdad" y que ffmpeg también sirve.
  - A la mitad aclaró que quería **uno solo, 9:16 para TikTok**, con motion
    graphics y cinemáticas en pixel art del juego. Quedó
    `brillo/trailer/salida/brillo-tiktok-es.mp4` (56 s) con su portada.
    Cómo se hace: `brillo/README.md § El tráiler`. Trampas:
    [brillo-trailer](brillo-trailer.md).
  - Quiso usar la PC Neko: el modo automático bloqueó el `docker pull` de la
    imagen. Canva está en la cuenta pero sin conectar: iba a dar acceso.
  - Falta, si lo pide: las versiones en inglés y portugués (`grabar.mjs todo
    --idioma=en`), y pasar la portada por Canva.
- **23/09/2026, tarde · `claude/fijate-iszyer`:**
  - Pidió un zip por juego para portar a TikTok. Quedaron `entregas/*.zip`,
    que se arman con `herramientas/empaquetar_juegos.py`, y las guías en
    `herramientas/tiktok/`.
  - También pidió arreglar BRILLO (el viento que no se veía y varios errores)
    y agregarle música 16 bits.
  - Después pidió "otro juego como Hill Climb, con Rezona y no pixel art, 200%
    (después 1000%) mejor". Quedó RUTA 40 en `ruta40/ruta40.html`:
    - 7 tramos y 5 vehículos con mejoras;
    - picadas contra rivales fantasma;
    - interfaz de cartelería vial y chacarera sintetizada;
    - el bot da "Todo se cumple" (`ruta40.md`).
  - No quiso covers 16 bits de canciones con derechos (Wii Shop, Vista). Se
    hizo música propia.
  - Falta: probar RUTA 40 en un teléfono de verdad.
- **23/09/2026, madrugada · `claude/fijate-iszyer`:**
  - KUNTUR: las piedras que se mueven eran casi invisibles (cada cara, un
    recorte suelto) → `texBloque`. Además se arreglaron unos 30 errores
    (`kuntur.md § Revisión de errores`).
  - Pidió otro juego 2D completo, Frutiger Aero, con más resolución, historia,
    un muñequito tipo MSN azul con piernitas y música "frutiger" analizada.
  - Quedó BRILLO en `brillo/brillo.html`: seis mundos, los tramos y los 18
    guiños pasan el resolvedor, y el final se probó.
  - El análisis de la música, con fuentes, está en `brillo/README.md`.
  - Falta: probarlo en un teléfono de verdad (`brillo.md § Lo que falta`).
- **23/09/2026, noche, después · `claude/fijate-iszyer`:**
  - "Sí o sí controles personalizados móviles": KUNTUR tiene editor de
    controles de dedo (`kuntur.md § Controles de dedo`). Quedó como regla en el
    índice. Falta, si lo pide: llevarlo a ZONDA y LUZ MALA.
  - Después: en su celular pedía teclas (arrancaba en modo PC) → arreglado;
    joystick de verdad por defecto y giro para los dos lados.
- **23/09/2026, noche · `claude/fijate-iszyer`:**
  - KUNTUR v2: en el celular parado se gira 90°, cinemáticas con gestos y
    franjas en cada capítulo, gente y animales animados todo el tiempo
    (`kuntur.md § Cinemáticas`, `§ Celular`).
  - La partida entera pasa. Sin probar en un teléfono de verdad (ni fps ni
    sonido). Sigue sin respuesta lo del dibujo liso.
- **23/09/2026, más tarde · `claude/fijate-iszyer`:**
  - Pidió "otro juego aún mejor, buena historia y 2.5D súper goty". Quedó
    KUNTUR en `kuntur/kuntur.html`, estilo Paper Mario (pedido tras rechazar
    el low-poly y los vóxeles).
  - La partida entera y cada copla pasan las pruebas (`kuntur.md`).
  - Falta: nada pedido. Quedó sin respuesta si prefiere dibujo liso al pixel art.
- **23/09/2026 · `claude/fijate-iszyer`:**
  - Pidió: pantalla de idioma (es, en, pt) antes del menú en todos los juegos,
    cada juego con su estilo, y cada juego nuevo mucho mejor que el anterior.
  - ZONDA quedó traducido con su pantalla de idioma.
  - LUZ MALA se rehízo por fuera: interfaz propia en el lienzo, traducido,
    más animaciones y efectos (lista en `juegos.md § Los 2D en pixel`).
  - Todas las pruebas de los dos pasan. Falta: nada pedido.
- **22/09/2026 · `claude/fijate-iszyer`:**
  - Rezona quedó conectado (`init` + login) pero no generó: `CREDIT_RESERVE_FAILED`.
  - Bosque 3D en VHS con assets de Higgsfield, subido a Rezona (`VvyVJutbOf`)
    y en un HTML único.
  - `GUIA-JUEGOS.md`.
  - Esta memoria: `memoria/`, `MEMORIA.md` y `CLAUDE.md`. Se descartó una red
    neuronal instalada, porque el dueño quería notas.
  - Se borró la página web de la guía: había pedido solo el `.md`.
- **Del 16 al 22/09, según `git log`:**
  - 16/09: Pique (2D, pixel art, 3D), Dimensión Ñ y Paraguas; Graphify en
    `.mcp.json`.
  - 17/09: Espejo, Garfio y 34 skins de Paraguas.
  - 18-19/09: Pozo, CAMPO (el perro) y el rendimiento de Paraguas.
  - 21/09: Flores.
  - 22/09, antes de esta sesión: Ritmo y Enjambre.
- **22/09/2026, más tarde, en la misma rama:**
  - Pidió dos juegos 2D "goty" copiando populares. Se eligieron Celeste y
    Silksong.
  - Quedaron los dos:
    - ZONDA, en `zonda/zonda.html`;
    - LUZ MALA, en `luz-mala/luz-mala.html`.
  - Cada uno tiene su resolvedor y sus pruebas en Chromium.
