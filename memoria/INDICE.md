# Memoria — el índice

Lo único que se lee al arrancar. Cada línea dice qué se sabe y dónde está;
después se abre **solo** la nota que la tarea pide. Cómo se usa y cómo se
mantiene: `MEMORIA.md`. Última puesta al día: 28/09/2026 (las vueltas de AEROPLAZA, a su propio índice).

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
- **AEROPLAZA: no mandar una APK por cada cambio** (28/09): se publica la actualización y la app la baja sola
  ([aeroplaza-45](aeroplaza-45.md) › Cómo se publica). APK nueva solo si cambió lo de Java, y de este contenedor si
  se puede: la firma ([aeroplaza-47](aeroplaza-47.md) › La firma).
- **No instalar nada aparte sin que lo pida.** El 22/09 se deshizo una red
  neuronal instalada para esta memoria: quería notas, no un programa.
- **Cuida los tokens** (06/10, [ahorro](ahorro.md)): nada de leer `.md` "por las dudas"; salidas filtradas;
  imágenes chicas y solo de lo que cambió; lo largo en segundo plano con un solo aviso; juntar llamadas.
  La calidad no baja: se ahorra lo repetido.
- **Lo simple, rápido** (01/10): "te pedí en vertical simple y después en zip nomás, ¿pa' qué tardás tanto?". Arreglar lo que hace falta, mandar enseguida y probar en segundo plano; nada de rondas largas de pruebas antes de entregar.
- **Sin ayudantes (subagentes):** "hacelo vos, gastás muchos tokens" (30/09). Todo en la misma sesión, de a una cosa.
- Quiere calidad visual alta ("goty", "AAA"), con números detrás.
- **En todo juego, antes del menú, se elige idioma: español, inglés o
  portugués**, siempre, y con todo traducido (menús, historia, diálogos).
  (Excepciones: Slendytubbies pide el idioma sobre el menú difuminado, después de la intro; FNaF 2 queda en inglés.)
  **Ports: arrancan directo como el original, con una intro de JXStudios (la moneda de `jxstudios/img/`) y los
  créditos; los controles de celu, como la versión de celular del juego si existe** (07/10).
  **No se portean juegos que hoy se venden**, aunque sean versiones viejas o recortadas (Poppy Playtime y GTA SA Lite,
  07/10), ni los «gratis» con anuncios o compras (Hypper Sandbox de VobbyGames: tiene versión oficial web en
  CrazyGames, solo PC). Sí fangames y freeware. FNaF 2 fue un error (se vende en Steam y celular): no es precedente.
  Se ofrece un juego propio inspirado. Un pedido sin nombre de juego
  habla del último que se le mandó; si hay duda entre dos, preguntar antes.
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
| [ahorro](ahorro.md) | el modo GOAT: bajo consumo y máxima calidad (solo lo que importa, caché, en lote) |
| [maquina](maquina.md) | el contenedor, la red, instalar algo, probar con navegador |
| [desplegar](desplegar.md) | publicar en Cloudflare o en Rezona; dónde vive cada credencial |
| [rezona](rezona.md) | generar assets con Rezona: ciclo, trampas, lo que anduvo, caídas |
| [higgsfield](higgsfield.md) | generar con Higgsfield: modelos, costos, lo que anduvo |
| [juegos](juegos.md) | tocar un juego del repo o hacer uno nuevo |
| [roblox](roblox.md) | hacer juegos en Roblox Studio: el MCP en su PC con Remote Control (`TRASPASO-ROBLOX.md`), lo que no anduvo en la nube |
| [kuntur](kuntur.md) | KUNTUR: armarlo, probarlo, el celular parado (vertical con bandeja), el tirón del arranque (el ensayo con el telón cerrado), el resolvedor y sus trampas |
| [brillo](brillo.md) | BRILLO: armarlo, probarlo, el celular parado (vertical con consola), el resolvedor de plataformas, las canciones grabadas y sus trampas |
| [brillo-rendimiento](brillo-rendimiento.md) | BRILLO: qué lo hacía lento, la cámara más cerca, las cinemáticas de charla y la calidad automática |
| [brillo-trailer](brillo-trailer.md) | el tráiler de TikTok de BRILLO: tomas con reloj propio, Remotion, la música y sus trampas |
| [baldi](baldi.md) | Baldi's Basics Classic (Unity 2018) a HTML: el Unity chiquito en JS, clips de sprites, TextMeshPro, navmesh, controles de celu |
| [justshoot](justshoot.md) | Just Shoot: la demo web (BananaBread/Emscripten) a un solo HTML, texturas DXT, paquetes de Emscripten, controles de dedo |
| [videos](videos.md) | videos de TikTok relatados (LUZ MALA, KUNTUR y los dúos de los seis de un archivo): tomas con bots, voz, subtítulos, montaje en Remotion, portadas |
| [barro](barro.md) | BARRO: motocross tipo Mad Skills (de cero): física de la moto, rivales, pistas, la tierra en tiras, el arte de Rezona |
| [bus-stop](bus-stop.md) | port de un juego de Unity 4.5 ajeno (Bus Stop Simulator) a APK sin el editor: UnityPy, el IL de los scripts, la luz de Unity 4 en three, lo que no entra al repo |
| [slendytubbies](slendytubbies.md) | port de Unity 4.0 a un solo HTML (Slendytubbies V2): ilspycmd, Unity 4 con UnityPy, scripts por clase, niebla que recorta, multijugador por código de sala, carteles traducidos |
| [tjoc](tjoc.md) | port de Unreal 4.16 (TJOC: Story Mode) por capítulos: CUE4Parse, el Blueprint corriendo en una VM de Kismet, colisión por tipo, exposición de 4.16, imágenes con texto traducidas |
| [pizza-delivery](pizza-delivery.md) | segundo port (Unity 3.5, 6 escenas, UnityScript): campos de scripts desde las DLL, static batching, objetos que se prenden solos, personajes con huesos, corrutinas, pruebas con await |
| [fnaf2](fnaf2.md) | port de Clickteam Fusion 2.5 a un solo HTML (FNaF 2): lector y descifrado propios del .exe, motor de eventos en JS, controles como el de celular, intro JXStudios |
| [ruta40](ruta40.md) | RUTA 40: la física del auto, el bot de los tramos, el celular parado (vertical), el arte de Rezona y sus trampas |
| [aeroplaza](aeroplaza.md) | AEROPLAZA, lo general: el 3D social Frutiger Aero (multijugador MQTT, la isla y los reinos, parkour, interiores), cómo se arma y se prueba, las trampas de three |
| [aeroplaza-vueltas](aeroplaza-vueltas.md) | AEROPLAZA vuelta por vuelta (de la 8.ª a la 48.ª: VR, manos, APK, ARCore, tu espacio, el mando VR Box, las actualizaciones, el celu con amigos, construir la casa como en Sims Mobile): qué nota abrir para cada cosa |
| [jxstudios](jxstudios.md) | la página de JXStudios (el estudio de quien pide): `jxstudios/`, en 3 idiomas, con los juegos, AEROPLAZA web y la APK; se sube a Cloudflare Pages con `jxstudios/desplegar.sh` y la llave del entorno (`CLOUDFLARE_API_TOKEN`) |
| [contragolpe](contragolpe.md) | CONTRAGOLPE, el tirador táctico que llegó hecho: separado en fuente y assets, la APK (WebView afinada, texturas ETC2 con etcpak), lo que costaba de verdad (armas pieza por pieza, huesos en textura, muñecos sin índice, el revelado), las pérdidas de memoria del original y los mandos a gusto |
| [sueltos](sueltos.md) | los seis de un archivo que llegaron hechos (GLOBO, VÍBORA, GRUMO, MORFI, LA ISLA, CRIPTA): qué tenía cada uno parado, LA ISLA sin girar (Girar como ajuste), el parpadeo de las antorchas de CRIPTA |
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
| `barro/` | BARRO: motocross de costado tipo Mad Skills, 20 pistas en 4 sedes, Jam del día, contrarreloj, un archivo | [barro](barro.md) · `barro/README.md` |
| `ports/bus-stop/` | port de *Bus Stop Simulator* (Unity 4.5, de otros) a three.js y APK: solo el código y las herramientas; lo del juego sale de su zip | [bus-stop](bus-stop.md) · `ports/bus-stop/README.md` |
| `ports/slendytubbies/` | port de *Slendytubbies V2 Beta* (Unity 4.0, de otros) a un solo HTML con multijugador: solo el código y las herramientas | [slendytubbies](slendytubbies.md) · `ports/slendytubbies/README.md` |
| `ports/tjoc-sm/` | port de *The Joy of Creation: Story Mode* (UE 4.16, de otros) a three.js y APK, por capítulos: solo el código y las herramientas | [tjoc](tjoc.md) · `ports/tjoc-sm/README.md` |
| `ports/pizza-delivery/` | port de *Pizza Delivery v0.2* (Unity 3.5, de otros) a three.js y APK: solo el código y las herramientas; lo del juego sale de su archivo | [pizza-delivery](pizza-delivery.md) · `ports/pizza-delivery/README.md` |
| `ports/fnaf2/` | port de *Five Nights at Freddy's 2* (Clickteam 2.5, de Scott Cawthon) a un solo HTML: solo el código y las herramientas | [fnaf2](fnaf2.md) · `ports/fnaf2/README.md` |
| `ruta40/` | RUTA 40: autos tipo Hill Climb por la Ruta 40, arte pintado de Rezona, 7 tramos, 5 vehículos, picadas | [ruta40](ruta40.md) · `ruta40/README.md` |
| `aeroplaza/` | AEROPLAZA: 3D social Frutiger Aero, multijugador por MQTT sin servidor, 5 reinos, muñecos de gelatina, 3 idiomas | [aeroplaza](aeroplaza.md) · `aeroplaza/README.md` |
| `videos/` | videos de TikTok relatados: grabadores de tomas, voz, stickers, memes y el montaje en Remotion | [videos](videos.md) |
| `contragolpe/` | CONTRAGOLPE: tirador táctico por rondas (three r128, bots, 3 mapas), en HTML y en APK con texturas ETC2 | [contragolpe](contragolpe.md) · `contragolpe/README.md` |
| `globo/` `vibora/` `grumo/` `morfi/` `isla/` `cripta/` | seis juegos de un solo HTML que llegaron hechos, todos para el celu parado | [sueltos](sueltos.md) |
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
