# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Cuando pase de ~30 entradas, las viejas
se resumen en una sola.

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
