# Juegos
Fuente: `guias/`. Ver también: [maquina](maquina.md).

## Qué guía seguir
- 2D pixel art (beat'em up, plataformas, celular en vertical 412×892, un HTML sin red): `guias/GUIA_JUEGOS_2D_PIXEL.md`.
  Lo más importante: escala entera (§2), personajes por piezas con `pose(e)` (§3), bucle a paso fijo con la entrada consumida al final (§1), bot que juega los niveles (§12), lista de trampas (§13).
- 3D que se vea bien (three.js, assets de Rezona): `guias/GUIA-JUEGOS-3D-REZONA.md`. La luz manda (§0), HDR + AgX, niebla del color del horizonte (§6), plan B si Rezona no genera (§8).
- Las guías citan `juegos-pc/ElTipo.html` y `bosque/` como referencia: NO están en este repo (29/09/2026). Estarán en el repo viejo `Juniorspro/General-Assets-Games` (sin comprobar).

## Lo que ya se sabe de este repo
- Rezona puede no estar conectado en la sesión, o fallar el cobro (`CREDIT_RESERVE_FAILED`, 22/09/2026): probar una imagen antes de una tanda. → `ARRANQUE.md § 6`
- Pruebas de juegos en Chromium: dibuja sin GPU (swiftshader), los fps de acá no dicen nada del teléfono. → [maquina](maquina.md)

## Shumio's Depths (`shumio/`, réplica de mecánicas de The Binding of Isaac: Repentance, arte propio)
- Armado: `node shumio/construir.mjs` junta `src/*.js` (en orden) en `index.html`. Pruebas: `node shumio/pruebas/menus.mjs [tactil]`, `jugar.mjs`, `hoja.mjs <grupo>`; capturas en `shumio/salida/` (ignorada).
- Sondas en `window.__SH`: `nueva()`, `irA(tipo)`, `vs()`, `matarTodo()`, `rotuloPrueba(tit, sub)`.
- **Nada de memoria para la estética del original: comparar con capturas.** La usuaria lo marcó dos veces.
  Referencias que se pueden bajar: capturas oficiales de Steam (`store.steampowered.com/api/appdetails?appids=250900` Rebirth, `1426300` Repentance) y la wiki (`bindingofisaacrebirth.wiki.gg/api.php`, archivos: HUD, RERUN_image, títulos, UnlockPaper). YouTube no deja bajar videos (pide login); sí la miniatura `i.ytimg.com/vi/<id>/maxresdefault.jpg`.
- Medido en el original (480×270): rótulo de objeto/piso = letra ancha de 10×10–12 px, blanca y limpia (sin mordidas), sobre franja NEGRA rasgada en bultos; subtítulo en mayúsculas y minúsculas ("Quad shot"), negrita de 8 px con contorno. El piso no lleva subtítulo. HUD: cifras gordas blancas con contorno. Menús: papel rasgado con chinches y letra de marcador. Acá (240 de alto) va todo ×0,89.
- Objetos (29/09): tabla declarativa en `src/16-objetos.js` (st / f / tags / fam / activo); `recalcular(j)` (12-jugador) rearma cuentas, arma y multidisparo con las fórmulas de la wiki. Armas y sinergias en `12b-armas.js`; lágrimas componibles en `13-efectos.js`; cofres y baratijas en `16b-recoger.js`; familiares en `16c-familiares.js`; íconos en `09b-iconos.js`. Sondas: `__SH.dar(ids…)`, `sala(tipo)`, `tirar(dx,dy,n)`, `paso()`. Prueba: `pruebas/objetos.mjs` (el bot no le acierta con feto+cíclope: las bombas se deslizan ~3 baldosas, es del original).
- Datos del original ya bajados en `/tmp/isaac/pages/*.txt` (se pierden con el contenedor; `fetch.sh "Página"` los vuelve a traer de la API de la wiki).
- Sonido (29/09): el video que mandó viene MUDO (−91 dB), no sirve para medir audio. Referencia usada: descripción oficial del disco en Steam (appid 322660: "tocan todo, guitarras, baterías, voces raspadas; un toro analógico en la cristalería del chiptune") y la wiki `Music` (cada pista de piso tiene una capa más pesada que entra con muchos enemigos). Motor en `03-audio.js`: Karplus-Strong, voces con formantes, piano, batería, dos salas de reverb; `Musica.pesar(0|1)` desde `pasoJuego`. Muestras: `node pruebas/audio.mjs` → `salida/audio/*.wav`.
- Errores que ya pasaron (30/09), para no repetirlos:
  · Todo va en UN `<script>`: dos funciones con el mismo nombre en archivos distintos se pisan sin avisar (`bloqueSpr` de la letra pisaba al del bloque de piedra y se dibujaba "UNDEFINED"). `construir.mjs` ahora corta si hay nombres repetidos.
  · En Android el `pointerdown` de un dedo NO es gesto para el navegador (sí lo son `pointerup`/`touchend`/`click`): el audio y la pantalla completa se piden ahí (`alGesto` en 02-entrada). El menú deja la pantalla completa pendiente para el próximo gesto. Chromium de escritorio no lo reproduce: `pruebas/sonido.mjs` corre sin la bandera de autoplay, pero igual pasa con el código viejo.
  · Cámara: la sala entera tiene que entrar (VISTA_H = SALA_H + 4). Medido en el video: los dos muros se ven enteros, el piso es ~74 % del alto y la barra del jefe va sobre el muro de abajo.
  · Las lágrimas cambian con cada objeto (`aspectoLagrima` en 13-efectos; colores tomados de las imágenes `Collectible_*_tears.png` de la wiki). Hoja para verificar: `__SH.hojaLagrimas(ids)`.
  · Corazones negros: `j.almas` ("e"/"n" por medio corazón; `j.esporas` es el total). Romper uno entero = 40 a todos (80 con la página perdida).
  · Sonido (30/09, segunda queja "no suena"): el audio se crea SÓLO en un gesto (pointerup/touchend/click/keydown; con mouse, pointerdown), se destraba también un `<audio>` con silencio, y hay diagnóstico: `estadoAudio()` en el menú ("SONIDO: ANDANDO/BLOQUEADO/ERROR…", al tocarlo suena una prueba) y un aviso en el HUD si no arrancó. Si vuelve la queja, pedirle una captura de ese renglón.
  · Animación de levantar (medida en el video a 15 fps): de frente, brazos arriba, objeto sobre las manos, 0,8 s (`LEVANTA` = 48); estirón los primeros cuadros. Cápsulas y baratijas también se levantan; la cápsula termina con cara contenta o triste (gestos 4 y 5). Prueba: `pruebas/animaciones.mjs`.
  · Lo que no se puede agarrar se empuja (corazón con vida llena, al tope de 99…; el cofre trabado ya se empujaba): `empujarCosa` en 16b.
  · En las pruebas, el bucle real del juego sigue corriendo entre `evaluate` y `screenshot`: para fotos quietas, congelar el estado.
- Juega con dedo (joysticks flotantes, botones) y con teclado/mouse (hover y clic en los menús; con mouse no hay joysticks). Siempre probar los dos.
