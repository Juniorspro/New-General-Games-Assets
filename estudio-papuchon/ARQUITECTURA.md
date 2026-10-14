# Estudio Papuchón — arquitectura

Editor de video en el navegador para **Noticias El Papuchón**: se cargan videos,
fotos y audios; se les ponen encima las plantillas del canal (mosca con el logo,
zócalos, placa de último momento, ticker, titular, subtítulos, intro, cierre…);
se generan voces de locutor; y se exporta un MP4 para TikTok, Reels, Shorts o
YouTube. Anda en el celular (primero) y en la compu. Todo en castellano
rioplatense, código y comentarios incluidos. Reemplaza la maqueta "Zócalo Pro"
(subida el 14/10: preview falso, exportar falso, sin video real).

Este documento es el **contrato** entre los módulos: nombres globales, formas de
datos y funciones. Quien escribe un módulo respeta lo de acá; si necesita algo
que no está, lo agrega acá y avisa en su respuesta.

## Dónde corre

- **githack** (el link que usa el dueño): todo anda. Sin CSP.
- **Artifact de claude.ai**: CSP estricta. Scripts solo de cdnjs, jsDelivr,
  unpkg; `fetch` solo a archivos publicados junto a la página. No hay cámara ni
  micrófono ni descarga de modelos de Hugging Face. Descargar un archivo: solo con
  la capacidad `downloads` (`(await claude.use("downloads")).save({filename, data})`).
  Puede haber `sample` (IA para redactar). Todo lo que no esté se **esconde**, no
  se rompe: cada función pregunta `Plataforma.puede(x)`.
- **Descargable** (un solo HTML, `herramientas/descargable/empaquetar.py`): se abre
  con file://. IndexedDB anda; Cache API no.

## Archivos (scripts clásicos, mismo alcance global, en este orden)

| archivo | global | qué hace | dueño |
|---|---|---|---|
| `js/base.js` | `EP`, utilidades sueltas | constantes, formatos, marca por defecto, ids, tiempo, `Plataforma` | núcleo |
| `js/almacen.js` | `Almacen` | IndexedDB: medios (blob + datos), proyectos, marca, caché | núcleo |
| `js/proyecto.js` | `Proyecto` | modelo de datos y operaciones puras (crear, agregar, dividir, recortar, mover…) | núcleo |
| `js/tienda.js` | `Tienda` | estado de la app, deshacer/rehacer, autoguardado | núcleo |
| `js/medios.js` | `Medios` | importar archivos, analizar (duración, tamaño, miniaturas, picos), URLs, `<video>` y `AudioBuffer` | núcleo |
| `js/fuentes.js` | `FUENTES_B64` | Anton y Barlow Condensed en base64 (woff2, latin) | plantillas |
| `js/logo.js` | `LOGO_B64` | logo de Noticias El Papuchón (PNG/WebP con alfa) | plantillas |
| `js/plantillas.js` | `Plantillas` | registro de plantillas, dibujo en canvas, animaciones | plantillas |
| `js/compositor.js` | `Compositor` | dibuja un cuadro del proyecto en un instante (video, encuadres, transiciones, superpuestos, gráficos, subtítulos) | render |
| `js/mezcla.js` | `Mezcla` | arma el audio del proyecto en un AudioContext (tiempo real u offline): volúmenes, fundidos, ducking | exportar |
| `js/motor.js` | `Motor` | reproducción en el editor: reloj, `<video>` sincronizados, audio por `Mezcla`, dibuja con `Compositor` | render |
| `js/exportar.js` | `Exportador` | MP4 (WebCodecs + mp4-muxer) o WebM; progreso; cancelar | exportar |
| `js/audios.js` | `AUDIOS`, `AUDIOS_CREDITOS` | frases de locutor, efectos y músicas en base64 | voces |
| `js/voces.js` | `Voces` | voz neural en el navegador (Piper, Daniela es_AR), pack de frases, micrófono, tiempos de palabras | voces |
| `js/subtitulos.js` | `Subtitulos` | cortar palabras en bloques; SRT ida y vuelta; subtítulos automáticos (Whisper en el navegador, si se puede) | voces |
| `js/camara.js` | `Camara` | modo filmable: cámara + micrófono, grabar a un medio | cámara |
| `js/ui/*.js` | componentes | React 18 + htm (sin JSX) | ui |

Librerías (UMD, versión fija, antes de los scripts propios):
`react 18.3.1`, `react-dom 18.3.1` (cdnjs), `htm 3.1.1` (unpkg `dist/htm.umd.js`),
`mp4-muxer 5.1.3` (jsDelivr `build/mp4-muxer.js`, global `Mp4Muxer`),
`webm-muxer` (jsDelivr, global `WebMMuxer`) si hace falta para el respaldo.
Lo pesado (onnxruntime, piper, whisper) se carga **cuando se pide**, con
`import()` dinámico o `<script>` agregado a mano, nunca al abrir.

En la UI: `const html = htm.bind(React.createElement);` y componentes como
funciones `function Panel(props) { return html\`<div>…</div>\`; }`.

## Unidades

- Tiempo: segundos (float). El cuadro de un tiempo: `Math.round(t * fps)`.
- Espacio: píxeles del **formato** (ej. 1080 × 1920). El canvas de la vista
  puede ser más chico: se dibuja con `ctx.setTransform(escala,…)`.

## `base.js`

```js
const EP = {
  VERSION: "1.0.0",
  FORMATOS: {
    "9:16": { id: "9:16", nombre: "Vertical (TikTok, Reels, Shorts)", ancho: 1080, alto: 1920 },
    "16:9": { id: "16:9", nombre: "Horizontal (YouTube)", ancho: 1920, alto: 1080 },
    "1:1":  { id: "1:1",  nombre: "Cuadrado", ancho: 1080, alto: 1080 },
    "4:5":  { id: "4:5",  nombre: "Retrato (Instagram)", ancho: 1080, alto: 1350 },
  },
  FPS: 30,
  // Zonas que tapa la app de TikTok en 9:16 (medidas, memoria/video.md).
  SEGURA_916: { arriba: 180, abajo: 1570, derecha: 940, subsY: [1424, 1562] },
  MARCA: { // por defecto; el usuario la cambia en "Mi marca" (Almacen 'marca')
    nombre: "Noticias El Papuchón", usuario: "@elpapuchon", firma: "",
    rojo: "#E01B24", rojoOscuro: "#9E0E14", amarillo: "#FFC21A", naranja: "#FF7A00",
    blanco: "#FFFFFF", negro: "#0B0B0D", gris: "#1C1C21",
    logos: ["logo-papuchon"],   // ids de medios imagen; "logo-papuchon" = el incluido (LOGO_B64)
    logoActivo: "logo-papuchon",
    fuenteTitular: "Anton", fuenteTexto: "Barlow Condensed",
  },
};
function id(prefijo) { /* "p_" + base36 de tiempo + azar */ }
function clamp(v, a, b) {} function lerp(a, b, t) {} function suave(a, b, t) {} // smoothstep
function facil(t) {} // easeOutCubic 0..1   function rebote(t) {} // easeOutBack
function fmtTiempo(s) {} // "1:05" / "0:07.3" con décimas si < 10 s
function leerLS(clave, defecto) {} function guardarLS(clave, valor) {} // localStorage con try/catch, prefijo "ep:"
const Plataforma = {
  artifact: bool,        // corre dentro de claude.ai
  tactil: bool,
  puede(cosa),           // "camara" | "microfono" | "vozNeural" | "subsAuto" | "compartir" | "descargar" | "ia" | "webcodecs"
  async capacidad(n),    // claude.use(n) memorizado, o null
  async guardarArchivo(blob, nombre), // descarga / downloads.save / navigator.share según dónde
};
```

## Modelo de datos (`proyecto.js`)

```js
Proyecto = {
  v: 1, id: "p_…", nombre: "Sin título", creado: ms, editado: ms,
  formato: { id: "9:16", ancho: 1080, alto: 1920, fps: 30 },
  fondo: "#000000",
  audio: { ducking: true, nivelDucking: 0.3 },   // la música y el sonido del video bajan bajo la voz
  pistas: [Pista],   // el orden es el de dibujo/mezcla: [0] es la de abajo
}
Pista = {
  id, tipo: "video" | "superpuesta" | "grafico" | "subtitulos" | "audio",
  sub: "voz" | "musica" | "efectos" | null,       // solo audio
  nombre, oculta: false, silenciada: false, bloqueada: false, volumen: 1,
  estilo: { plantilla: "subs-karaoke", … },       // solo subtitulos
  clips: [Clip],
}
```

Pistas de un proyecto nuevo (en orden): `video` (principal), `superpuesta`
(ventana/foto encima), `grafico` (×2: "Gráficos" y "Gráficos 2", para que puedan
superponerse sin pelear), `subtitulos`, `audio/voz`, `audio/musica`,
`audio/efectos`. Se pueden agregar más `grafico` y `superpuesta`.

**La pista `video` es magnética** (como CapCut): los clips van uno detrás de
otro sin huecos; `inicio` se recalcula siempre (`Proyecto.normalizar`). Las demás
pistas son libres (cada clip tiene su `inicio`; no se pisan dentro de la misma
pista: si se pisa, `Proyecto` lo corre o lo manda a otra pista del mismo tipo).

```js
ClipMedio = {   // en "video", "superpuesta" y "audio"
  id, medio: "m_…", inicio, desde, hasta,      // desde/hasta: tramo usado del archivo (s)
  velocidad: 1, volumen: 1, fundidoEntrada: 0, fundidoSalida: 0,
  encuadre: { modo: "relleno" | "cubrir" | "contener", zoom: 1, x: 0, y: 0 },  // x,y: corrimiento en px del formato
  transicion: { tipo: "ninguna" | "fundido" | "flash" | "deslizar" | "zoom" | "barrido", dur: 0.4 },   // hacia el clip siguiente (pista video)
  caja: { x, y, ancho, alto, rot: 0, marco: "ninguno" | "blanco" | "marca" | "sombra", radio: 24, etiqueta: "" },  // solo superpuesta
  filtro: { brillo: 1, contraste: 1, saturacion: 1 },   // opcional
}
ClipGrafico = {  // en "grafico"
  id, plantilla: "zocalo-ultimo", inicio, duracion,
  params: { … },                 // los de la plantilla; lo que falta sale del defecto
  caja: { x: 0, y: 0, escala: 1, rot: 0 },   // corrimiento y escala sobre la ubicación por defecto de la plantilla
}
ClipSubtitulo = { id, inicio, duracion, texto, palabras: [{ p: "hola", t0, t1 }] | null }  // tiempos absolutos de la línea
duracionClip(c) = c.duracion ?? (c.hasta - c.desde) / c.velocidad
```

Operaciones (puras: devuelven un proyecto nuevo; el viejo no se toca):

```js
Proyecto.crear(formatoId) → p
Proyecto.normalizar(p) → p                       // pista video magnética, orden por inicio, sin pisadas
Proyecto.duracion(p) → s                         // fin del último clip de cualquier pista (mín. 1 s)
Proyecto.pista(p, tipoOSub) → pista              // la primera de ese tipo ("video", "voz", "musica"…)
Proyecto.buscarClip(p, clipId) → { pista, clip, indice } | null
Proyecto.clipsEn(p, t) → [{ pista, clip }]       // activos en t, en orden de dibujo
Proyecto.agregarMedio(p, medio, { pista: "video"|"superpuesta"|"voz"|"musica"|"efectos", en: t }) → { p, clip }
Proyecto.agregarGrafico(p, plantillaId, en, params?) → { p, clip }
Proyecto.agregarSubtitulos(p, clipsSubs) → p     // reemplaza los que se pisan
Proyecto.cambiarClip(p, clipId, cambios) → p     // merge superficial (y profundo en params/caja/encuadre)
Proyecto.dividir(p, clipId, t) → p
Proyecto.recortar(p, clipId, lado: "inicio"|"fin", t) → p
Proyecto.mover(p, clipId, { inicio?, pistaId?, indice? }) → p   // indice: reordenar en la pista video
Proyecto.duplicar(p, clipId) → p
Proyecto.borrar(p, clipId) → p
Proyecto.cambiarFormato(p, formatoId) → p        // reubica gráficos (caja relativa) y encuadres
Proyecto.medios(p) → [medioId]                   // usados
```

## `tienda.js`

```js
Tienda.estado = {
  pantalla: "inicio" | "editor" | "marca",
  proyecto: Proyecto | null,
  seleccion: clipId | null,
  tiempo: 0, reproduciendo: false,
  zoom: 80,                       // px por segundo en la línea de tiempo
  panel: null | "medios" | "plantillas" | "texto" | "subtitulos" | "voz" | "audio" | "ajustes" | "editar",
  exportando: null | { progreso, mensaje },
  marca: EP.MARCA (+ lo guardado),
  avisos: [{ id, texto, tipo: "info"|"bien"|"error" }],
}
Tienda.get() ; Tienda.suscribir(fn) → desuscribir ; Tienda.set(parcial)   // set: estado de UI, no entra al historial
Tienda.cambiar(fnProyecto, etiqueta)    // fnProyecto(p) → p nuevo; entra al deshacer; autoguarda (debounce 600 ms)
Tienda.deshacer() ; Tienda.rehacer() ; Tienda.puedeDeshacer ; Tienda.puedeRehacer
Tienda.abrir(proyectoId) ; Tienda.nuevo(formatoId) ; Tienda.cerrar()
Tienda.aviso(texto, tipo)
useTienda(selector) // hook de React (useSyncExternalStore)
```

## `almacen.js` (IndexedDB "estudio-papuchon", versión 1)

Stores: `blobs` (medioId → Blob), `medios` (medioId → datos sin blob),
`proyectos` (id → Proyecto), `config` ("marca" → objeto), `cache` (clave → Blob/ArrayBuffer, para modelos de voz).

```js
Almacen.guardarMedio(datos, blob) ; Almacen.medio(id) → datos ; Almacen.blob(id) → Blob
Almacen.medios() → [datos] ; Almacen.borrarMedio(id)
Almacen.guardarProyecto(p) ; Almacen.proyecto(id) ; Almacen.proyectos() → [{id,nombre,editado,formato,duracion,miniatura}] ; Almacen.borrarProyecto(id)
Almacen.config(clave, defecto) ; Almacen.guardarConfig(clave, valor)
Almacen.cache(clave) ; Almacen.guardarCache(clave, valor) ; Almacen.uso() → { usado, cuota }
```

## `medios.js`

```js
Medio = { id, tipo: "video"|"imagen"|"audio", nombre, mime, tamano, duracion, ancho, alto,
          tieneAudio, miniaturas: [dataURL × ~1 por segundo, máx 40, alto 96 px], picos: [0..1 × 400 por minuto], creado }
Medios.importar(File | Blob, nombre?) → Promise<Medio>      // analiza, guarda en Almacen, devuelve datos
Medios.importarB64(id, b64, mime, nombre) → Promise<Medio>    // para el logo y el pack de audios (id fijo: no se duplica)
Medios.datos(id) → Medio (en memoria) ; Medios.url(id) → objectURL (memorizada)
Medios.video(id, clave?) → HTMLVideoElement (uno por medio y clave; muted, playsInline, preload auto)
Medios.imagen(id) → Promise<ImageBitmap|HTMLImageElement>
Medios.audioBuffer(id, ctx?) → Promise<AudioBuffer|null>   // decodeAudioData del archivo entero, memorizado por sampleRate
Medios.listos() → Promise que espera las importaciones en curso
```

## Plantillas (`plantillas.js`)

```js
Plantillas.lista → [Plantilla]   Plantillas.porId(id) → Plantilla
Plantilla = {
  id, nombre, grupo: "marca"|"zocalos"|"placas"|"titulares"|"redes"|"resaltar"|"texto"|"subtitulos",
  descripcion, duracion: 5,          // por defecto (s)
  params: [Param],
  caja(W, H, p) → { x, y, ancho, alto },   // ubicación por defecto en px del formato (para tocarla y moverla)
  dibujar(ctx, e),                   // e = { t, dur, p, W, H, marca, rec, vista }
}
Param = { clave, tipo: "texto"|"textoLargo"|"color"|"logo"|"bool"|"numero"|"opcion"|"medio", etiqueta,
          defecto, mayus?, max?, min?, paso?, opciones?: [{ v, etiqueta }] }
// Colores: "marca.rojo" / "marca.amarillo"… se resuelven contra la marca vigente.
// e.rec = { logo: imagen del logo activo, imagenes: { medioId: imagen }, fuentesListas: bool }
// e.t: segundos desde el inicio del clip; entrada en ~0,5 s, salida en los últimos ~0,4 s.
Plantillas.dibujarClip(ctx, clip, t, W, H, rec)   // aplica clip.caja (traslado y escala desde el centro de la caja)
Plantillas.cajaClip(clip, W, H) → { x, y, ancho, alto }   // final, para tocar/mover
Plantillas.cargarRecursos(marca) → Promise   // fuentes (FontFace desde FUENTES_B64) y logo
Plantillas.dibujarSubtitulos(ctx, pista, t, W, H)   // estilo de pista.estilo, palabra resaltada
```

Plantillas que tiene que haber (todas animadas, todas con la marca):
mosca de logo (con "EN VIVO" titilando y hora opcionales), zócalo "Último momento"
(dos bandas + etiqueta con el sol), zócalo clásico (negro y rojo), zócalo de persona
(nombre y cargo), placa de último momento a pantalla completa, ticker corredizo
con etiqueta, titular grande arriba (palabras resaltadas en amarillo), ubicación,
fecha y hora, fuente/crédito, cita textual, sello (EXCLUSIVO / CONFIRMADO / FALSO /
URGENTE), intro de marca (logo con el sol girando, destello), cierre "seguinos",
barra de progreso, círculo y flecha para resaltar, texto libre, estilos de
subtítulos (karaoke amarillo, caja negra, contorno). Nombres de estilos propios
(nada de nombres ni logos de canales reales).

## Compositor (`compositor.js`)

```js
Compositor.dibujar(ctx, p, t, op)
// op = { escala: anchoCanvas / p.formato.ancho,
//        fuente(clip, tFuente) → CanvasImageSource | null,   // cuadro del medio de ese clip en ese tiempo de archivo
//        rec,                          // recursos de Plantillas
//        vista: true|false,           // true: editor (guías, cajas de selección); false: exportación
//        seleccion: clipId|null }
Compositor.tiempoFuente(clip, t) → s   // desde + (t - inicio) * velocidad
Compositor.cajaEnPantalla(p, clipId, escala) → caja (para la UI)
```

Orden: fondo → pista video (encuadre; "relleno" = el mismo cuadro achicado a
~1/16, estirado y oscurecido detrás, sin `ctx.filter` que en el teléfono cuesta;
transiciones mezclando el clip saliente y el entrante) → superpuestas (con caja y
marco) → gráficos (pistas en orden) → subtítulos. Nada de estado propio: dos
llamadas con el mismo `t` dan el mismo cuadro (así la vista y la exportación son
iguales).

## Mezcla (`mezcla.js`)

```js
Mezcla.programar(ctx, destino, p, desde, buffers, { cuando = ctx.currentTime }) → { detener() }
// buffers: Map medioId → AudioBuffer. Programa todos los clips de audio y el sonido de los
// clips de video (si no están silenciados) desde el tiempo de proyecto `desde`, con volumen de
// pista y de clip, fundidos, velocidad (playbackRate) y ducking (ganancia automatizada cuando
// hay un clip activo en la pista "voz").
Mezcla.renderizar(p, buffers, sampleRate = 48000) → Promise<AudioBuffer>   // OfflineAudioContext, para exportar
Mezcla.cargar(p, ctx) → Promise<Map>          // decodifica lo que haga falta (vía Medios.audioBuffer)
```

## Motor (`motor.js`)

```js
Motor.montar(canvas) ; Motor.proyecto(p)           // cada vez que cambia el proyecto
Motor.reproducir() ; Motor.pausar() ; Motor.buscar(t) ; Motor.tiempo ; Motor.reproduciendo
Motor.alTiempo(fn)       // ~15 veces por segundo, para la UI
Motor.calidadVista(f)    // 0.5 = la mitad de resolución (teléfono), 1 = entera
Motor.redibujar()
```

El reloj es el del `AudioContext` mientras suena (los `<video>` siguen al reloj y
se corrigen si se van más de 0,15 s); en pausa, buscar = mover los videos y
redibujar cuando llega `seeked`. Los `<video>` van muteados: el audio sale de
`Mezcla`.

## Exportador (`exportar.js`)

```js
Exportador.soporte() → Promise<{ webcodecs, h264, aac, vp9, opus, mediaRecorder, mejor: "mp4"|"webm"|"tiempo-real" }>
Exportador.exportar(p, { alto: 1920|1280|720, fps: 30, calidad: "alta"|"normal", alProgreso(fraccion, mensaje), senal: AbortSignal })
  → Promise<{ blob, mime, extension, nombre, duracion, bytes }>
```

Video: por cada cuadro se llevan los `<video>` al tiempo exacto (seek y
`requestVideoFrameCallback`/`seeked`), se dibuja con `Compositor` en un
OffscreenCanvas/canvas del tamaño final y se codifica (`VideoEncoder`, H.264 si
hay; si no, VP9). Audio: `Mezcla.renderizar` → `AudioEncoder` (AAC si hay; si no,
Opus). Contenedor: `Mp4Muxer` (o `WebMMuxer`). Último recurso: grabar en tiempo
real con `MediaRecorder` (canvas.captureStream + destino de audio).

## Voces y subtítulos

```js
Voces.lista() → [{ id: "daniela", nombre: "Daniela (Argentina)", tipo: "neural", tam: "114 MB", lista: bool }, { id: "locutor", tipo: "pack" }, …]
Voces.preparar(id, alProgreso) → Promise     // baja y guarda en Almacen.cache (una sola vez)
Voces.sintetizar(texto, { voz: "daniela", velocidad: 1 }) → Promise<{ blob, duracion, palabras: [{ p, t0, t1 }] }>
Voces.pack → [{ id, texto, grupo, b64, mime, duracion }]   // frases ya grabadas (AUDIOS)
Voces.grabar() → Promise<{ detener() → Promise<{ blob, duracion }> }>
Subtitulos.estimar(texto, duracion) → palabras   // reparte el tiempo por sílabas y pausas
Subtitulos.bloques(palabras, { maxPalabras: 4, maxCaracteres: 24 }) → [ClipSubtitulo sin id]  // corta en puntuación y pausas > 0,4 s, sin palabra sola al final
Subtitulos.aSRT(clips) ; Subtitulos.deSRT(texto) → clips
Subtitulos.automaticos(medioId, alProgreso) → Promise<palabras>   // Whisper en el navegador (si Plataforma.puede("subsAuto"))
```

Las voces generadas se importan como medios de audio (`Medios.importar`) y van a la
pista `voz`; con "subtítulos" tildado, van también a la pista `subtitulos`.

## Cámara (`camara.js`)

```js
Camara.abrir(video, { frente: true }) → Promise ; Camara.cambiar() ; Camara.cerrar()
Camara.grabar() ; Camara.detener() → Promise<Blob>    // video+audio de la cámara, sin gráficos
```

El modo filmable muestra la cámara con los gráficos elegidos encima (para
encuadrar). Lo grabado entra como medio y los gráficos quedan en la línea de
tiempo, editables.

## Interfaz (`js/ui/`)

Pantallas: **Inicio** (proyectos, "Nuevo video" con el formato, "Filmar"),
**Editor** (vista arriba, línea de tiempo abajo, barra de herramientas; en la compu,
panel a la derecha), **Mi marca** (logos, colores, usuario, firma).
Paneles del editor: Medios, Plantillas (galería con vista previa animada), Texto,
Subtítulos, Voz, Audio (música y efectos), Ajustes (formato, fondo, ducking),
Editar (lo seleccionado: parámetros de la plantilla, encuadre, velocidad, volumen,
transición). Exportar: diálogo con calidad, progreso, y al final Descargar /
Compartir.

Diseño: oscuro de sala de edición, con el rojo y el amarillo del sol de la marca
como acentos; Anton para títulos de la app, Barlow para el resto. Botones de
44 px mínimo en el teléfono. Todo se puede tocar: arrastrar gráficos en la vista,
pellizcar para escalar, arrastrar clips y bordes en la línea de tiempo.

## Pruebas

- El Chromium de Playwright **no decodifica H.264 ni AAC** (es Chromium sin códecs
  propietarios): para las pruebas se usan videos WebM (VP9 + Opus) hechos con
  `imageio-ffmpeg`. Los teléfonos de verdad sí leen MP4.
- `prueba.mjs` recorre: abrir, proyecto 9:16, importar, agregar plantillas, voz,
  subtítulos, música, exportar, y revisa el archivo con ffprobe y una hoja de
  contacto de cuadros.
