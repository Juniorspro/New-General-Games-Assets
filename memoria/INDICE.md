# Memoria — el índice

Lo único que se lee al arrancar. Cada línea dice qué se sabe y dónde está;
después se abre **solo** la nota que la tarea pide. Cómo se usa y cómo se
mantiene: `MEMORIA.md`. Última puesta al día: 23/09/2026 (tráiler de BRILLO).

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
  se usen Remotion y ffmpeg (23/09): `brillo.md § El tráiler`.
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
| [brillo](brillo.md) | BRILLO: armarlo, probarlo, el resolvedor de plataformas, el tráiler de TikTok y sus trampas |
| [ruta40](ruta40.md) | RUTA 40: la física del auto, el bot de los tramos, el arte de Rezona y sus trampas |
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
| `brillo/` | BRILLO: plataformas 2D Frutiger Aero, 6 mundos con historia, pixel art de 360 de alto | [brillo](brillo.md) · `brillo/README.md` |
| `ruta40/` | RUTA 40: autos tipo Hill Climb por la Ruta 40, arte pintado de Rezona, 7 tramos, 5 vehículos, picadas | [ruta40](ruta40.md) · `ruta40/README.md` |
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
