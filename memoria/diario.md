# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Cuando pase de ~30 entradas, las viejas
se resumen en una sola.

- **24/09/2026, madrugada · `claude/fijate-iszyer`:**
  - Pidió dos videos de gameplay relatados de ~1 min, con sus 7 stickers como
    narrador y memes bajados (no generados).
    - LUZ MALA: "bien chaqueño, chamamé", y después "memes chaqueños".
    - KUNTUR: "la peruanita", que en el video es Killa, de Purmamarca.
  - Salen a `videos/salida/` (no se commitea), con copia liviana y versión sin
    música. Cómo se hacen: [videos](videos.md). (En curso al primer commit.)
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
    `brillo.md § El tráiler`.
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
