# Memoria — el índice

Lo único que se lee al arrancar. Cada línea dice qué se sabe y dónde está;
después se abre **solo** la nota que la tarea pide. Cómo se usa y cómo se
mantiene: `MEMORIA.md`. Última puesta al día: 27/09/2026 (AEROPLAZA: la mano que no se estira, el giro, movimientos chicos).

## Reglas que no se discuten

- **Ningún secreto entra al repo**, tampoco a estas notas. Después de cada
  commit, `git grep -nI "cfat_\|-----BEGIN"` tiene que volver vacío. El `sk-`
  que agrega ARRANQUE también encuentra los `gtask-…` de Rezona, que no son
  secretos.
- Castellano rioplatense en todo: código, comentarios, commits y notas.
- Los comentarios explican POR QUÉ. Medí antes de afirmar. Decí lo que no se
  pudo hacer, con el motivo.
- Nunca el identificador del modelo en nada que vaya al repo.
- La rama la da cada sesión (el 22/09 fue `claude/fijate-iszyer`). Commit y
  push; PR solo si lo piden.
- El contenedor se borra al terminar: lo que no se commitea se pierde.

## Quién pide

- Escribe corto e informal ("che", "we", "xd"). Contestale igual: corto.
- **Pide exactamente lo que quiere.** Si pide un `.md`, es el `.md` y nada más:
  ni página web ni artefacto. Si pide un juego en HTML, un solo archivo que
  abra con doble clic.
- **No instalar nada aparte sin que lo pida.** El 22/09 se deshizo una red
  neuronal instalada para esta memoria: quería notas, no un programa.
- **Cuida los tokens:** nada de leer `.md` del repo "por las dudas".
- Quiere calidad visual alta ("goty", "AAA"), con números detrás.
- **En todo juego, antes del menú, se elige idioma: español, inglés o
  portugués**, siempre, y con todo traducido (menús, historia, diálogos).
- **Cada juego con estilo propio**: otros botones, otro orden de menú, otras
  transiciones y otros efectos. No reusar el diseño del juego anterior.
- **Controles de dedo personalizables, "sí o sí"** (23/09): que el jugador
  mueva y agrande cada botón, cambie la transparencia y el tipo de palanca,
  lo espeje para zurdos y elija si vibra. Se guarda. Hecho en KUNTUR
  (`kuntur.md § Controles de dedo`).
- **Cada juego nuevo tiene que superar claramente al anterior** en
  animaciones, efectos y todo ("100% mejor", 23/09), sin copiar.
- **Videos:** para TikTok, 9:16 y uno solo, cinematográfico y "muy
  profesional", con motion graphics del propio juego. Para editar dijo que
  se usen Remotion y ffmpeg (23/09): [brillo-trailer](brillo-trailer.md).
  Relatados de 1 min con sus stickers y memes **bajados, no generados**
  (24/09): [videos](videos.md). Audio de TikTok ajeno no se baja; las
  canciones que manda quien pide sí se usan (24/09, BRILLO: una por mundo).
  **En AEROPLAZA suenan solo esas** (25/09): nada de temas de Rezona ni sintetizados.
- Tiene Rezona (446 mil créditos el 22/09; 419 mil el 23/09) y Higgsfield. Prefiere Rezona.
  Para imágenes, dijo que se use Rezona sin preguntar (23/09).

## Las notas

| nota | abrila cuando… |
|---|---|
| [maquina](maquina.md) | el contenedor, la red, instalar algo, probar con navegador |
| [desplegar](desplegar.md) | publicar en Cloudflare o en Rezona; dónde vive cada credencial |
| [rezona](rezona.md) | generar assets con Rezona: ciclo, trampas, lo que anduvo, caídas |
| [higgsfield](higgsfield.md) | generar con Higgsfield: modelos, costos, lo que anduvo |
| [juegos](juegos.md) | tocar un juego del repo o hacer uno nuevo |
| [kuntur](kuntur.md) | KUNTUR: armarlo, probarlo, el resolvedor y sus trampas |
| [brillo](brillo.md) | BRILLO: armarlo, probarlo, el resolvedor de plataformas, las canciones grabadas y sus trampas |
| [brillo-rendimiento](brillo-rendimiento.md) | BRILLO: qué lo hacía lento, la cámara más cerca, las cinemáticas de charla y la calidad automática |
| [brillo-trailer](brillo-trailer.md) | el tráiler de TikTok de BRILLO: tomas con reloj propio, Remotion, la música y sus trampas |
| [videos](videos.md) | videos de TikTok relatados (LUZ MALA, KUNTUR): tomas, voz, subtítulos, memes, montaje en Remotion |
| [ruta40](ruta40.md) | RUTA 40: la física del auto, el bot de los tramos, el arte de Rezona y sus trampas |
| [aeroplaza](aeroplaza.md) | AEROPLAZA: el 3D social Frutiger Aero con multijugador MQTT (salas, broker de prueba en Node, trampas de three); la isla grande, el monorriel, el detalle por distancia, los menús sin desplazar; el día y noche común, el teclado propio, el parkour y los interiores en primera persona; los avisos estilo Windows 7 y el chat de voz por cercanía (WebRTC); los caminos libres, la animación por poses (suave, lineal, chop), los movimientos de parkour y la primera persona con cuerpo |
| [aeroplaza-9](aeroplaza-9.md) | AEROPLAZA, octava vuelta: la Zona de Juegos (puertas, mesas en red, pelota, juegos), el runner Aero.exe (nivel, saltos medidos, glitches al ritmo del breakcore, bot), los efectos (✦ Poder), el movimiento del video, caminar y correr, las nubes |
| [aeroplaza-10](aeroplaza-10.md) | AEROPLAZA, novena vuelta: el Estelario del telescopio (cielo real de Buenos Aires), los modelos GLB pasados a procedural, deslizar sosteniendo, la primera persona que se mueve, el spam de avisos y el runner extremo (sustos, DESPIERTA/WAKE UP, rastreo, figuras) |
| [aeroplaza-11](aeroplaza-11.md) | AEROPLAZA, décima vuelta: la calidad mínima y el corte por distancia (qué pesaba de verdad, medido), la carga más rápida, y el tráiler 9:16 (tomas del juego cuadro por cuadro, guion a tempo, Remotion) con sus trampas de cámara; la portada 3:4 y cómo entregar el video |
| [aeroplaza-12](aeroplaza-12.md) | AEROPLAZA, undécima vuelta: el probador que no tapa y probarse antes de comprar; las joyas (regalo diario, ropa de 100 a 300); anuncios con premio y compras (TikTok Minis con su API y el modo de prueba); la prueba de choques y lo que se atravesaba; el modo VR con giroscopio; la calidad alta más liviana (medido) |
| [aeroplaza-13](aeroplaza-13.md) | AEROPLAZA, duodécima vuelta: el VR a 120 sin bajar gráficos (el mundo una vez y reproyectado a cada ojo, timewarp, dibujo partido, predicción del giroscopio; medido contra dibujar cada ojo); las manos como Meta Quest (MediaPipe en un worker, One Euro, rayo, pellizco, arco, menú de la palma); el visor de verdad con WebXR (Quest, 120 Hz) probado con IWER; las copias instanciadas |
| [aeroplaza-14](aeroplaza-14.md) | AEROPLAZA, decimotercera vuelta: por qué titilaban las manos en el celu (se perdían por lo vieja de la foto, MediaPipe cambiaba de mano, escalones entre fotos) y cómo se arregló (perder por fotos faltantes, identidad por continuidad, resorte crítico, fundido, la cámara); las cápsulas estaban dadas vuelta; el simulador del celu `pruebas/manos-celu.mjs`, lo medido y lo que no sirvió |
| [aeroplaza-15](aeroplaza-15.md) | AEROPLAZA, decimocuarta vuelta: el botón de flash del VR sin visor (la linterna de la cámara, `torch`), dos redes de MediaPipe a la par (28 fotos por segundo) y el filtro que trata aparte la profundidad (`EuroEjes`); lo medido y el piso del atraso de la cámara |
| [aeroplaza-16](aeroplaza-16.md) | AEROPLAZA, decimoquinta vuelta: por qué las manos iban lentas, el filtro liviano con dos anclas (de costado y en profundidad), los tres niveles del menú (rápidas · medio · suaves), el rayo con la cámara desde los ojos (antes no bajaba), la segunda red que se apaga sola, `herramientas/manos-lento.mjs` y lo medido contra las vueltas 14 y 15 |
| [aeroplaza-17](aeroplaza-17.md) | AEROPLAZA, decimosexta vuelta: dónde se iba el atraso de las manos (MediaPipe buscando dos manos busca palmas en cada foto: 74 contra 38 ms), el cupo por red, el worker lector (MediaStreamTrackProcessor) y su reloj, la carrera de la GPU, los niveles con su propio adelanto (búsqueda de 450), la cámara de mentira con manos (`manos-directo`) y lo que no sirvió (el modelo liviano) |
| [aeroplaza-18](aeroplaza-18.md) | AEROPLAZA, decimoséptima vuelta: por qué la mano se estiraba (cada punto filtrado y adelantado por su cuenta) y cómo quedó siempre con la misma forma (`aprenderForma`, `enderezar`), el giro que se atrasaba por las anclas, rápidas sin pasear quieta, y las medidas nuevas de `manos-lento` (estira, giro, movimientos chicos) |
| [nevada](nevada.md) | NEVADA: la cinemática three.js del auto y el tigre (TikTok de @m4jor3d): modelos de Tripo, ruedas, rig, audio y sus trampas |
| [sitios](sitios.md) | Frutiger Aero, IBLO, Electro Silver y las páginas de `docs/` |
| [diario](diario.md) | qué se hizo en las últimas sesiones y qué quedó |

## Qué hay en cada carpeta

| carpeta | qué es | detalle en |
|---|---|---|
| `bosque/` | tercera persona en un bosque al atardecer, con VHS y cinco cintas | [juegos](juegos.md) |
| `motor2d/` | motor 2D en pixel compartido: escala entera, mandos, sonido sintetizado, idiomas | [juegos](juegos.md) |
| `zonda/` | ZONDA: plataformas tipo Celeste, 20 salas comprobadas por un resolvedor | `zonda/README.md` |
| `luz-mala/` | LUZ MALA: metroidvania tipo Silksong, 9 salas y 3 jefes, menús en el lienzo, 3 idiomas | `luz-mala/README.md` |
| `kuntur/` | KUNTUR: 2.5D de papel tipo Paper Mario, 7 capítulos con historia, 3 idiomas | [kuntur](kuntur.md) |
| `brillo/` | BRILLO: plataformas 2D Frutiger Aero, 6 mundos con historia, pixel art de 288 de alto | [brillo](brillo.md) · `brillo/README.md` |
| `ruta40/` | RUTA 40: autos tipo Hill Climb por la Ruta 40, arte pintado de Rezona, 7 tramos, 5 vehículos, picadas | [ruta40](ruta40.md) · `ruta40/README.md` |
| `aeroplaza/` | AEROPLAZA: 3D social Frutiger Aero, multijugador por MQTT sin servidor, 5 reinos, muñecos de gelatina, 3 idiomas | [aeroplaza](aeroplaza.md) · `aeroplaza/README.md` |
| `videos/` | videos de TikTok relatados: grabadores de tomas, voz, stickers, memes y el montaje en Remotion | [videos](videos.md) |
| `nevada/` | NEVADA: cinemática three.js 9:16 de un superdeportivo y un tigre blanco en el bosque nevado, un solo HTML | [nevada](nevada.md) · `nevada/README.md` |
| `entregas/` | los zips de cada juego con la guía para TikTok (no se commitean) | `herramientas/empaquetar_juegos.py` |
| `perro/` | CAMPO: un perro 3D en tercera persona sobre lomas de pasto | `perro/README.md` |
| `pique/` `pique2d/` `pique3d/` | corredor de un botón: 2D, pixel art y 2.5D; niveles comprobados solos | su `LEEME.md` |
| `enjambre/` | supervivencia por oleadas con un pulgar; los assets todavía no existen | `enjambre/README.md` |
| `ritmo/` | ritmo de tres carriles, nueve canciones, ni un archivo de audio | `ritmo/README.md` |
| `espejo/` | cuarenta puzzles de espejos y rayos | `espejo/README.md` |
| `garfio/` | un gancho y una torre sin techo | `garfio/README.md` |
| `paraguas/` | caída por un pozo infinito con un paraguas | `paraguas/README.md` |
| `pozo/` | juego que llegó hecho: se le mejoró el audio y el menú | `pozo/README.md` |
| `dimension-n/` | caída vertical con ragdolls de Verlet, portales | `dimension-n/README.md` |
| `telarana/` | colgarse de un hilo por una ciudad | `telarana/LEEME.md` |
| `edificio/` | torre de oficinas armada por script en Blender + visor three.js | `edificio/LEEME.md` |
| `flores/` | diez páginas-regalo, un HTML cada una | `flores/README.md` |
| `frutiger-aero/` | escritorio estilo Vista en el navegador | [sitios](sitios.md) |
| `docs/paginas/` | IBLO Eventos y las páginas de demostración | [sitios](sitios.md) |
| `electro-silver/` | demostración de tienda para un local de Presidencia Roca | [sitios](sitios.md) |
| `docs/biblioteca/` | biblioteca de estilos con capturas reales | su `README.md` |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables | su `README.md` |
| `iblo-eventos/` `modelos-cdn/` | material y modelos GLB de IBLO | [sitios](sitios.md) |
| `herramientas/` | rezona (`rz.py`, `estado.json`), blender, neko, mint, iblo, audio | [rezona](rezona.md) · su `LEEME.md` |
| `Prompts/` | prompts guardados de redes | — |

Documentos de la raíz (son la fuente; se abren por sección, nunca enteros):
`ARRANQUE.md` (cómo se trabaja), `ESTADO.md` (qué hay en los dos sitios),
`GUIA-JUEGOS.md` (receta visual con Rezona), `MEMORIA.md` (este método).
