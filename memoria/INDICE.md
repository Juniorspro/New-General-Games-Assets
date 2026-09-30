# Memoria — el índice
Última puesta al día: 30/09/2026 (Morfi, de cartón y papel, con su intro de papel).
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
- Sus juegos son de **JXSTUDIOS** y arrancan con su intro (30/09/2026): sola, sin tocar nada; **en el estilo de cada juego** (la de pixel art en el juego pixel le gustó; no siempre negro y cromo); y después del logo, **elegir el idioma** (la primera vez). → [cripta](cripta.md), [vibora](vibora.md), [isla](isla.md), [globo](globo.md), [morfi](morfi.md)
- Cuando pasa capturas de un juego ajeno, se hace uno original del mismo género, de JXSTUDIOS, y se le dice (30/09/2026).

## Las notas
| nota | abrila cuando… |
|---|---|
| [juegos](juegos.md) | vas a hacer o mejorar un juego: qué estilo, qué no puede faltar |
| [juegos-3d](juegos-3d.md) | 3D con three.js: luz, niebla, post, assets de Rezona, entregar |
| [juegos-2d-pixel](juegos-2d-pixel.md) | 2D pixel art: escala entera, personajes por piezas, combate, niveles |
| [aeroplaza](aeroplaza.md) | look Frutiger Aero / Wii, avatar y animación por código, música en bucle |
| [probar](probar.md) | vas a probar en Chromium, medir, capturar o tocar como un dedo |
| [isla](isla.md) | el menú que se mece (el que quiere para los juegos nuevos), la intro 3D de JXSTUDIOS (logo en tubos de cromo) y otras lecciones de La Isla |
| [cripta](cripta.md) | laberinto que se desliza: resolvedor, generar por construcción sin trampas, paredes de neón, el menú que se mece en 2D |
| [vibora](vibora.md) | juego .io de víboras: cuerpo en anillo, comida en grilla, bots, teléfono acostado, trampas de pausa y de dedos |
| [globo](globo.md) | física propia 2D (Box2D-lite: pilas, dormir por islas, molinete, péndulo), medir la dificultad con un piloto, la intro de colores |
| [morfi](morfi.md) | hilos con Verlet (la correa, el hilo liviano, el pedazo cortado que no tira), diseñar niveles poniendo al personaje donde más perdona, el look de papel, la intro de papel |
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
| `cripta/` | CRIPTA NEÓN: laberinto que se desliza en pixel art (30 niveles, torre infinita, tienda, 3 idiomas); se juega con `cripta-en-un-archivo.html` | `cripta/README.md`, [cripta](cripta.md) |
| `isla/` | LA ISLA: supervivencia en una isla pixelada en 3D (three.js), con la intro 3D de JXSTUDIOS; se juega con `isla-en-un-archivo.html` | `isla/README.md`, [isla](isla.md) |
| `vibora/` | VÍBORA.IO: víboras que comen y crecen contra bots, sin red (27 pieles, 5 fondos, 3 idiomas); se juega con `vibora-en-un-archivo.html` | `vibora/README.md`, [vibora](vibora.md) |
| `globo/` | GLOBO LIBRE: el globo sube y el escudo aparta todo (30 niveles, infinito, tienda, 3 idiomas, física propia); se juega con `globo-en-un-archivo.html` | `globo/README.md`, [globo](globo.md) |
| `morfi/` | MORFI: cortar el hilo para que el caramelo caiga en la caja con hambre (30 niveles en tres cajas, tienda, 3 idiomas, física de hilos propia); se juega con `morfi-en-un-archivo.html` | `morfi/README.md`, [morfi](morfi.md) |
| `bomba/` | BOMB RUNNER SIMULATOR (el de Roblox, a medio hacer): correr con una bomba, explotar, mascotas y renacer | `bomba/README.md` |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona (`rz.py`, `estado.json`), portadas de los juegos (`portadas/`), audio | `ARRANQUE.md § 4`, [juegos](juegos.md) › Portadas |
| `edificio/` | torre de oficinas armada por script en Blender + visor three.js | — |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables | — |
| `Prompts/` | colecciones de prompts | — |
| `guias/` | las guías largas para hacer juegos | [juegos](juegos.md) |
| `memoria/` | esta memoria | `MEMORIA.md` |

Borrado el 30/09/2026 y recuperable con `git checkout fbffdfb -- <carpeta>`: los juegos HTML (`enjambre/`, `ritmo/`, `espejo/`, `garfio/`, `paraguas/`, `pozo/`, `pique*/`, `perro/`, `dimension-n/`, `telarana/`, `flores/`), `frutiger-aero/`, `docs/` (IBLO Eventos), `iblo-eventos/`, `electro-silver/`, `modelos-cdn/` y `ESTADO.md`. Los sitios siguen publicados en Cloudflare.
