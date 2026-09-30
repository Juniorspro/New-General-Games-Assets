# Memoria — el índice
Última puesta al día: 30/09/2026 (limpieza del repo: quedó bomba/ y las herramientas).
Es lo único que se lee al arrancar. Cómo se usa y se mantiene: `MEMORIA.md`.

## Reglas que no se discuten
- Ningún secreto entra al repo: después de cada commit se corre el `git grep` de `README.md § Las reglas` (solo pueden salir las dos líneas que citan la regla, en `README.md` y `ARRANQUE.md`).
- Medí antes de afirmar: "anda" sin un número al lado no vale. Lo no comprobado se marca "(sin comprobar)".
- Los comentarios explican por qué, no qué. Todo en castellano rioplatense, código y comentarios incluidos.
- El repo es PÚBLICO (29/09/2026): nada de material ajeno, pesado o sensible sin preguntar.
- Lo aprendido se commitea y se pushea con el trabajo: lo que no, se pierde con el contenedor.

## Quién pide
- Escribe en castellano rioplatense, corto e informal.
- Quiere juegos con buenos gráficos, buenas animaciones y buenas mecánicas (29/09/2026).
- Está haciendo un juego en **Roblox Studio** en su laptop (30/09/2026): lo de Roblox se queda en el repo. Roblox Studio no corre en esta máquina.
- Sus juegos HTML se entregaban en UN archivo que abre sin red, pensados para el celular, en tres idiomas (es, en, pt).
- Pidió limpiar el repo porque "come tokens" (30/09/2026): no volver a llenarlo de builds, binarios ni proyectos que no use.

## Las notas
| nota | abrila cuando… |
|---|---|
| [juegos](juegos.md) | vas a hacer o mejorar un juego: qué estilo, qué no puede faltar |
| [juegos-3d](juegos-3d.md) | 3D con three.js: luz, niebla, post, assets de Rezona, entregar |
| [juegos-2d-pixel](juegos-2d-pixel.md) | 2D pixel art: escala entera, personajes por piezas, combate, niveles |
| [aeroplaza](aeroplaza.md) | look Frutiger Aero / Wii, avatar y animación por código, música en bucle |
| [probar](probar.md) | vas a probar en Chromium, medir, capturar o tocar como un dedo |
| [isla](isla.md) | el menú que se mece (el que quiere para los juegos nuevos) y otras lecciones de La Isla, que está en el historial |
| [diario](diario.md) | querés saber qué se hizo en cada sesión y qué quedó pendiente |

## Los documentos largos (no se leen enteros: la nota dice qué sección)
| documento | qué tiene |
|---|---|
| `guias/GUIA-JUEGOS.md` | 3D que se ve bien con Rezona (837 líneas) → [juegos-3d](juegos-3d.md) |
| `guias/GUIA_JUEGOS_2D_PIXEL.md` | 2D pixel art estilo Dan The Man (488 líneas) → [juegos-2d-pixel](juegos-2d-pixel.md) |
| `guias/GUIA-AEROPLAZA.md` | la receta de aeroplaza, sacada del código → [aeroplaza](aeroplaza.md) |
| `ARRANQUE.md` | cómo se trabaja: § 1 la máquina, § 3 secretos, § 4 Rezona Lab, § 5 cómo se prueba, § 6 trampas del navegador |

## Qué hay en cada carpeta
| carpeta | qué es | detalle en |
|---|---|---|
| `bomba/` | BOMB RUNNER SIMULATOR (el de Roblox, a medio hacer): correr con una bomba, explotar, mascotas y renacer | `bomba/README.md` |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona (`rz.py`, `estado.json`), audio | `ARRANQUE.md § 4` |
| `edificio/` | torre de oficinas armada por script en Blender + visor three.js | — |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables | — |
| `Prompts/` | colecciones de prompts | — |
| `guias/` | las guías largas para hacer juegos | [juegos](juegos.md) |
| `memoria/` | esta memoria | `MEMORIA.md` |

Borrado el 30/09/2026 y recuperable con `git checkout fbffdfb -- <carpeta>`: los juegos HTML (`isla/`, `enjambre/`, `ritmo/`, `espejo/`, `garfio/`, `paraguas/`, `pozo/`, `pique*/`, `perro/`, `dimension-n/`, `telarana/`, `flores/`), `frutiger-aero/`, `docs/` (IBLO Eventos), `iblo-eventos/`, `electro-silver/`, `modelos-cdn/` y `ESTADO.md`. Los sitios siguen publicados en Cloudflare.
