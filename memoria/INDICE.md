# Memoria — el índice
Última puesta al día: 22/9/2026.

Esto es lo único que se lee al arrancar. El método está en `MEMORIA.md` (raíz).

## Reglas que no se discuten

- **Ningún secreto entra al repo.** Después de cada commit,
  `git grep -nI "cfat_\|rz_live_\|sk-\|-----BEGIN"` tiene que volver vacío.
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **Los comentarios explican POR QUÉ, no qué.** Son la memoria del proyecto.
- **La pantalla no decide nada.** Toda puerta se pregunta en el servidor.
- **Decir lo que no se sabe.** Lo no comprobado se marca "(sin comprobar)".
- **Todo en castellano rioplatense**, código y comentarios incluidos.

## Quién pide

- Prefiere que se corrija lo que está mal antes que se agregue al lado.
- Quiere el dato con su número, y que se diga cuando algo **no** se pudo probar.
- Cuando algo se traba, quiere saber **cuál de los frenos** fue: el servicio
  ajeno, el permiso de la sesión, o el código propio. No son lo mismo.

## Las notas

| nota | abrila cuando… |
|---|---|
| [rezona](rezona.md) | haya que generar assets, tocar créditos o la API de Rezona |
| [imagenes](imagenes.md) | haya que generar una imagen, o convertir un render en sprite |
| [maquina](maquina.md) | algo falle por red, disco, Docker o permisos de la sesión |
| [neko](neko.md) | haga falta un escritorio gráfico o manejar un navegador |
| [diario](diario.md) | quieras saber qué pasó en la sesión anterior y qué quedó |

## Los tres documentos largos (no se leen enteros)

| documento | qué dice | cuándo abrirlo |
|---|---|---|
| `PAPA-DEL-PATRON.md` | el traspaso al día; manda sobre los otros dos | por sección, con `grep -n` |
| `ARRANQUE.md` | cómo se trabaja: máquina, trampas, despliegue | idem |
| `ESTADO.md` | qué hay construido: páginas, endpoints, tablas | idem |

## Qué hay en cada carpeta

| carpeta | qué es | detalle en |
|---|---|---|
| `frutiger-aero/` | escritorio estilo Vista en el navegador | `ESTADO.md § De un vistazo` |
| `docs/paginas/` | IBLO Eventos, con panel | `ESTADO.md § De un vistazo` |
| `electro-silver/` | sitio de Electro Silver | `README.md § Qué hay` |
| `herramientas/blender/` | escenas 3D por script, con tiempos medidos | `PAPA-DEL-PATRON.md § 4` |
| `herramientas/neko/` | manejar un escritorio Linux por REST | [neko](neko.md) |
| `herramientas/rezona/` | cliente stdio del MCP de Rezona | [rezona](rezona.md) |
| `herramientas/iblo/`, `mint/`, `audio/` | utilidades sueltas | — |
| `telarana/`, `garfio/`, `pozo/`, `pique*/`, `flores/`, `paraguas/` | juegos | — |
| `Prompts/` | colecciones de prompts | — |

**No están en esta rama** aunque el traspaso las nombre: `herramientas/kaggle/`,
`herramientas/colab/`, `herramientas/vnc/`, `peakcode/`.
