# NEVADA — la cinemática del superdeportivo y el tigre blanco

Recreación en three.js 0.186 de un TikTok de @m4jor3d × @W-SE ("Did we cook⁉️",
16,5 s). Pedido el 24/09: "Logra esto en three.js en html, generá los assets que
necesites". Otras notas: [rezona](rezona.md), [juegos](juegos.md), [maquina](maquina.md).

## Qué es y cómo se arma

- Lo que se entrega: `nevada/nevada-en-un-archivo.html` (10,0 MB), que abre con
  doble clic y trae todo adentro (`window.ARCHIVOS`, data: URI).
- `node herramientas/armar.mjs` (desde `nevada/`) hace `dist/` (index.html,
  juego.js de 712 KB y `datos/` con 7 MB) y el archivo único.
- Orden: idioma → menú → cinemática de 18,5 s en un cuadro 9:16 → cámara libre
  (OrbitControls) con botón de modo arcilla.
- El reloj de la cinemática es el del audio (`musica.tiempo()`): los cortes
  caen en el golpe aunque se atrase algún cuadro.
- La música es un phonk propio sintetizado (`js/musica.js`, 120 BPM, fa menor).
  No es el "MONTAGEM GUERREIRO - Super Slowed" del original ni lo imita.
- En pantalla va el crédito "Inspirado en un video de @m4jor3d × @W-SE".

## Assets (Rezona, proyecto EUDERiogzG, 24/09)

- Cuatro imágenes de referencia llevadas a Tripo: el auto, el tigre parado, el
  tigre echado y la cabeza rugiendo. Aparte, las texturas de nieve y corteza, y
  el panorama del bosque.
- Lo bajado está en `nevada/crudo/` (no se commitea). Los GLB llegan de 35 a
  46 MB y de 650 mil a 970 mil triángulos cada uno.
- `herramientas/optimizar_modelos.mjs` apunta a una cantidad de triángulos por
  modelo: 70 mil el auto y de 30 mil a 36 mil los tigres. Quedan de 1,3 a
  1,8 MB.
- `herramientas/procesar_texturas.py` pasa todo a webp, saca las normales de la
  luminancia y corta el panorama en la fila 384 (cielo y bosque).
- Tripo no respeta la orientación: se mide con `pruebas/ver_modelos.mjs`, que
  arma una hoja de seis vistas. El giro que se midió en cada modelo está en la
  cabecera de `js/modelos.js`.

## Trampas pagadas (24/09)

- **KHR_mesh_quantization:**
  - Las posiciones son enteros de 16 bits y la escala a metros va en la matriz
    del nodo.
  - Girar o escalar esa geometría la recorta contra ±1: el auto quedó hecho una
    caja.
  - Primero se pasa a Float32 con la matriz horneada: `js/modelos.js › aFloat`.
- **Atributos compartidos:**
  - Una BufferGeometry armada con los atributos de otra los comparte, así que
    `translate()` mueve las dos.
  - Las ruedas corrían 0,7 m la carrocería.
- **Ruedas de una malla de una pieza** (`js/modelos.js › centroDeAnillos`):
  - El centro es donde las distancias se juntan en anillos: gana la mayor suma
    de cuadrados del histograma.
  - El radio es la altura del centro (0,355 m).
  - La mediana de lo que toca el piso no sirve de centro: el paragolpes la
    corre (1,14 contra 1,27 m).
- **Rig del tigre propio** (`js/rig.js`):
  - Las patas son columnas. Lo que está bajo la panza pero lejos de la pata va
    con el cuerpo; si no, al caminar cuelga una lona.
  - El de Rezona da caminata de perro.
- **Poses sin memoria:** `pose(t)` en vez de `paso(dt)`, así `irA(t)` saca
  siempre la misma foto.
- **Continua (DC) de −0,04 en WebAudio:**
  - Una GainNode vale 1 hasta su primer evento.
  - Una curva de WaveShaper de 1024 puntos da −0,002 con entrada 0.
  - Con unos 20 808 programados de antemano, se sumaba.
  - Arreglo: la ganancia arranca en 0, la curva tiene 1025 puntos y hay un
    pasa-altos de 22 Hz al final.
- **`String.replace` con texto de reemplazo:**
  - Interpreta los `$&`, `` $` `` y `$'` del JS minificado.
  - El HTML único salía roto sin ningún error al armarlo.
  - Va siempre con función (`herramientas/armar.mjs`).
- **Niebla FogExp2 de 0,022:**
  - A 125 m tapa el 99,95 %.
  - El cilindro del bosque va sin niebla, transparente y fundido arriba: si no,
    su borde raya el cielo.
- **Copos grandes (bokeh):**
  - Cerca de la lente le lavaban la cara al tigre.
  - Ahora son más tenues cuanto más grandes y se apartan del centro del cuadro.
- **Faro:** una SpotLight de 6 quemaba; quedó en 2,4, bajo y apuntado al piso.
- **Pintura espejo de Tripo:**
  - En la nieve se ve blanca y el auto desaparece.
  - Se arregló con metalness ×0,55, rugosidad ≥ 0,3 y un entorno PMREM más
    oscuro, con troncos.
- **Textos en el cuadro 9:16:** centrado en la compu, vh y vw no sirven. Van con
  `container-type: size` y unidades `cqw`.

## Cómo se prueba (todo desde `nevada/`)

- `node pruebas/fotos.mjs [t…]`: una foto por plano, con la hoja en
  `pruebas/salida/hoja.png`.
- `node pruebas/depurar.mjs [--post]`: cada objeto solo, con la cámara a mano.
- `node pruebas/flujo.mjs`: recorre el HTML único como una persona.
  - 24/09: sin errores de consola.
  - Con SwiftShader la cinemática arranca a los 14 s.
- `node pruebas/musica.mjs`: renderiza el audio offline. Saca un WAV, cuánto
  suena cada medio segundo y el espectrograma.
  - 24/09: −12,7 LUFS, pico de −3 dBTP y la intro 14 dB abajo del drop.
- Parámetros de la URL:
  - `?t=5.2` deja la escena quieta en ese instante;
  - `?depurar` expone `window.__N.objetos`;
  - `?sinpost` saca el posproceso.

## Los planos (`js/director.js`)

| s | plano |
|---|---|
| 0–3 | desglose en arcilla (Voronoi pastel sobre oliva), en tres planos |
| 3 | el drop: destello y blur de zoom |
| 3–4,5 | el tigre camina hacia la cámara |
| 4,5–5,25 | empujón a la trompa del auto |
| 5,25–7 | tres cuartos bajo, con el tigre echado junto a la rueda |
| 7–7,5 | barrido |
| 7,5–9 | cola baja, con las luces rojas |
| 9–11 | el rugido (a los 9,5 s) |
| 11–13 | la órbita |
| 13–16,5 | el auto se va |
| 16,5–18,5 | el título |

- Las posiciones van en el sistema del auto: `A(x, y, z)`.

## Falta, si lo pide

- Un MP4 9:16 de la cinemática para subir.
- Subirlo a Rezona.
