# Memoria — el índice
Última puesta al día: 30/09/2026 (bomba/ empezado).
Es lo único que se lee al arrancar. Cómo se usa y se mantiene: `MEMORIA.md`.

## Reglas que no se discuten
- Ningún secreto entra al repo: después de cada commit se corre el `git grep` de `README.md § Las reglas` (solo pueden salir las dos líneas que citan la regla, en `README.md` y `ARRANQUE.md`).
- Medí antes de afirmar: "anda" sin un número al lado no vale. Lo no comprobado se marca "(sin comprobar)".
- Los comentarios explican por qué, no qué. Todo en castellano rioplatense, código y comentarios incluidos.
- La pantalla no decide nada: toda puerta se pregunta en el servidor. → `README.md § Las reglas`
- El repo es PÚBLICO (29/09/2026): nada de material ajeno, pesado o sensible sin preguntar.
- Lo aprendido se commitea y se pushea con el trabajo: lo que no, se pierde con el contenedor.

## Quién pide
- Escribe en castellano rioplatense, corto e informal.
- Quiere juegos HTML con buenos gráficos, buenas animaciones y buenas mecánicas (29/09/2026).
- Sus juegos se entregan en UN archivo HTML que abre sin red, pensados para el celular, en tres idiomas (es, en, pt) y con tienda en los últimos.
- Pasó material para aprender el 29/09/2026: las guías de `guias/`, `MEMORIA.md` y aeroplaza (ver [aeroplaza](aeroplaza.md)).

## Las notas
| nota | abrila cuando… |
|---|---|
| [juegos](juegos.md) | vas a hacer o mejorar un juego: qué estilo, cómo está armado acá, qué no puede faltar |
| [juegos-3d](juegos-3d.md) | 3D con three.js: luz, niebla, post, assets de Rezona, entregar |
| [juegos-2d-pixel](juegos-2d-pixel.md) | 2D pixel art: escala entera, personajes por piezas, combate, niveles |
| [aeroplaza](aeroplaza.md) | look Frutiger Aero / Wii, avatar y animación por código, música en bucle, VR, manos, multijugador |
| [probar](probar.md) | vas a probar en Chromium, medir, capturar o tocar como un dedo |
| [isla](isla.md) | pixel art en 3D, el menú que se mece, reflejo y nubes, jugar acostado en el teléfono, enemigos y golpes que se sienten, historia en capítulos |
| [diario](diario.md) | querés saber qué se hizo en cada sesión y qué quedó pendiente |

## Los documentos largos (no se leen enteros: la nota dice qué sección)
| documento | qué tiene |
|---|---|
| `guias/GUIA-JUEGOS.md` | 3D que se ve bien con Rezona (837 líneas) → [juegos-3d](juegos-3d.md) |
| `guias/GUIA_JUEGOS_2D_PIXEL.md` | 2D pixel art estilo Dan The Man (488 líneas) → [juegos-2d-pixel](juegos-2d-pixel.md) |
| `guias/GUIA-AEROPLAZA.md` | la receta de aeroplaza, sacada del código → [aeroplaza](aeroplaza.md) |
| `ARRANQUE.md` | cómo se trabaja: § 1 la máquina, § 3 Frutiger Aero, § 4 IBLO, § 5 secretos, § 6 Rezona Lab, § 7 cómo se prueba, § 8 trampas pagadas |
| `ESTADO.md` | qué hay construido en Frutiger Aero e IBLO: pantallas, API, base de datos, lo que falta |

## Qué hay en cada carpeta
| carpeta | qué es | detalle en |
|---|---|---|
| `enjambre/` | supervivencia por oleadas con un pulgar: 4 etapas, 8 especies, 3 jefes | `enjambre/README.md` |
| `ritmo/` | juego de ritmo sin mp3: la música la compone el código | `ritmo/README.md` |
| `espejo/` | 40 puzzles de luz resueltos por una máquina | `espejo/README.md` |
| `garfio/` | péndulo y gancho en una torre sin techo | `garfio/README.md` |
| `paraguas/` | pozo infinito de una mecánica; 34 skins y tienda | `paraguas/README.md` |
| `pozo/` | pistas de 35-38 s, menú animado | `pozo/README.md` |
| `pique/`, `pique2d/`, `pique3d/` | un corredor con niveles que se validan solos, en 2D, pixel art y 3D | `LEEME.md` de cada uno |
| `perro/` | CAMPO: perro 3D en tercera persona sobre pasto | `perro/README.md` |
| `bomba/` | BOMB RUNNER SIMULATOR (a medio hacer): correr con una bomba, explotar, mascotas y renacer | `bomba/README.md` |
| `isla/` | LA ISLA: supervivencia pixel 3D (la de @vfx843) con la historia del faro, enemigos y el menú de @brutu_scripts en la playa | `isla/README.md`, [isla](isla.md) |
| `dimension-n/` | Dimensión Ñ: caída vertical con ragdolls de Verlet | `dimension-n/README.md` |
| `telarana/` | juego de un botón: colgarse de un hilo por una ciudad | `telarana/LEEME.md` |
| `flores/` | diez páginas sueltas para el día de las flores amarillas | — |
| `frutiger-aero/` | escritorio estilo Vista (Cloudflare Pages + D1) | `frutiger-aero/LEEME.md`, `ESTADO.md` |
| `docs/` | IBLO Eventos (`docs/paginas/`) y la galería | `ESTADO.md § IBLO EVENTOS` |
| `electro-silver/`, `edificio/`, `bot-whatsapp/`, `iblo-eventos/`, `modelos-cdn/`, `Prompts/` | sitios, Blender, bot, material de IBLO, prompts | `README.md § Qué hay` |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona (`rz.py`, `estado.json`), IBLO, audio | `ARRANQUE.md § 6` |
| `guias/` | las guías largas para hacer juegos | [juegos](juegos.md) |
| `memoria/` | esta memoria | `MEMORIA.md` |
