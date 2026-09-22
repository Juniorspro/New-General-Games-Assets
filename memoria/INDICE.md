# Memoria — el índice
Última puesta al día: 22/09/2026.

## Reglas que no se discuten
- **Nunca Higgsfield**, para nada (pedido explícito, 22/09/2026).
- El repo es público: ningún token, key ni contraseña en archivos. Van por entorno o en `~/`.
- "Anda" sin un número al lado no vale: todo se mide.
- Si Rezona falla, no reintentar en bucle ni simular assets: plan B y decirlo. → `herramientas/juegos/GUIA-JUEGOS.md § 8`
- No retomar proyectos viejos salvo que se pida (sesión en vivo del 22/09 arrancó de cero).
- Nada de `npx playwright install`; Chromium en `/opt/pw-browsers/chromium`.

## Quién pide
- Escribe en rioplatense; se contesta igual. Quiere cosas hechas y medidas, no explicaciones largas.
- Temas que le importan: juegos HTML 2D/3D con look AAA, edición de video estilo TikTok, Rezona, la Neko PC.

## Las notas
| nota | abrila cuando… |
|---|---|
| [maquina](maquina.md) | hay que instalar algo, levantar Docker/Neko o pelear con el proxy |
| [rezona](rezona.md) | se va a generar un asset o subir un juego |
| [juegos](juegos.md) | se arma un juego |
| [video](video.md) | se edita o se estudia un video |
| [diario](diario.md) | para saber qué quedó a medias |

## Qué hay en cada carpeta
| carpeta | qué es | detalle en |
|---|---|---|
| `herramientas/instalar-todo.sh` | reinstala todo en una sesión nueva | [maquina](maquina.md) |
| `herramientas/neko/` | manejar el escritorio Neko por REST/WS | `herramientas/neko/LEEME.md` |
| `herramientas/rezona/rz.py` | cliente stdio del MCP de Rezona | [rezona](rezona.md) |
| `herramientas/juegos/` | plantillas 2D/3D, `probar.mjs`, `GUIA-JUEGOS.md` | [juegos](juegos.md) |
| `herramientas/video/` | `estudiar_tiktok.py` | [video](video.md) |
| `herramientas/blender/` | escenas por script | `herramientas/blender/LEEME.md` |
| raíz (`pique*`, `perro`, `enjambre`…) | juegos y assets de sesiones anteriores | (sin revisar esta sesión) |
