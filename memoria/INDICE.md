# Memoria — el índice
Última puesta al día: 30/09/2026. Método: `MEMORIA.md`.

## Reglas que no se discuten
- Ningún secreto al repo: después de cada commit, `git grep -nI "cfat_\|-----BEGIN"` vacío. → `README.md § Las reglas`
- Todo en castellano rioplatense, código y comentarios incluidos; los comentarios dicen POR QUÉ.
- "Anda" sin un número al lado no vale: medir antes de afirmar, y decir lo que no se probó.
- Rama de trabajo: `claude/hola-80z86i`; commit y push al terminar cada tarea (el contenedor se borra).
- Nada de modelo/IA en commits ni en el código; los commits llevan el trailer que pide la sesión.

## Quién pide
- Habla en rioplatense informal ("bro", "we"); quiere cosas que anden en su teléfono Android, no demos.
- Prefiere un solo HTML que abra en el teléfono, o un APK que se actualice solo (nunca pasarle un APK a mano).
- Usa un visor VR Box con el teléfono; tiene ARCore.
- Se queja corto ("va para el culo"): pedirle una captura de un diagnóstico dentro de la app.
- 29/09/2026: el juego nuevo es **Shumio's Depths** (`shumio/`): réplica de Isaac Repentance con arte propio, para celular (TCL 20 SE) y PC. Quiere fidelidad verificada con capturas, no de memoria. → [juegos](juegos.md)
- 30/09/2026: **ABYSSFALL** (`abyssfall/`): homenaje a Downwell en vertical, tres colores. → [juegos](juegos.md)
- 30/09/2026: **Noche Carmesí** (`noche/`): un Vampire Survivors en vertical, de un solo pedido, con los números de la wiki. → [juegos](juegos.md)

## Las notas
| nota | abrila cuando… |
|---|---|
| [juegos](juegos.md) | se hace un juego nuevo: qué guía seguir, qué hay ya hecho |
| [maquina](maquina.md) | probar en Chromium, el proxy, Playwright, Pillow, APK sin Gradle |
| [nexo](nexo.md) | se toca Nexo XR (la app de realidad mixta) o Nexo Web |
| [diario](diario.md) | ver qué quedó a medias en la última sesión |

## Qué hay en cada carpeta
| carpeta | qué es | detalle en |
|---|---|---|
| `guias/` | GUIA_JUEGOS_2D_PIXEL (pixel art tipo Dan The Man), GUIA-JUEGOS-3D-REZONA (three.js + Rezona) | [juegos](juegos.md) |
| `nexo-xr/` | Nexo XR: APK Android + `web/index.html` (Nexo Web) | [nexo](nexo.md) |
| `mundo-ar/` | 6DoF de prueba: web, WebView y APK ARCore; su `construir.sh` es la base de los APK | `README.md § Qué hay` |
| `asalto-mr/`, `tajo/`, `pique*/`, `perro/`, `enjambre/`… | otros juegos | `README.md § Qué hay` |
| `frutiger-aero/`, `docs/paginas/` | sitios en Cloudflare Pages | `ARRANQUE.md § 3`, `§ 4` |
