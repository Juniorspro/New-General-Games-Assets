# Memoria — el índice
Última puesta al día: 24/9/2026.

Esto es lo único que se lee al arrancar. El método está en `MEMORIA.md` (raíz).

## Reglas que no se discuten

- **Ningún secreto entra al repo.** Después de cada commit:

  ```sh
  git grep -nIE '\b(cfat_|rz_live_|sk-)[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY'
  ```

  Tiene que volver vacío, y el 22/9 vuelve vacío. **No uses la versión corta**
  (`git grep "cfat_\|sk-\|-----BEGIN"`, la que está en `ARRANQUE.md` y
  `README.md`): esa matchea las líneas que explican la regla, los `gtask-…` de
  los assets y hasta `netmask-2.1.1` de un lockfile — cientos de falsos
  positivos que enseñan a ignorar la alarma, que es peor que no tenerla.
  Los tres pedazos de la buena: el `\b` deja afuera `gtask-`, los 16 caracteres
  piden una llave de verdad y no un prefijo suelto, y `PRIVATE KEY` evita que
  `-----BEGIN` solo dispare con la propia documentación.
  Probada en las dos direcciones el 22/9: vacía sobre el repo, y agarra las tres
  formas cuando se le pone carnada.
- **Medí antes de afirmar.** "Anda" sin un número al lado no vale.
- **Los comentarios explican POR QUÉ, no qué.** Son la memoria del proyecto.
- **La pantalla no decide nada.** Toda puerta se pregunta en el servidor.
- **Decir lo que no se sabe.** Lo no comprobado se marca "(sin comprobar)".
- **Todo en castellano rioplatense**, código y comentarios incluidos.

## Quién pide

- Su canal: **Noticias El Papuchón**. El logo está en
  `tiktok/logo-noticias-el-papuchon.png` (fondo transparente). Nombró como
  referencia la cuenta @1.tomasgomez (Tomás Gómez, 277 seguidores el 23/9).
- **Siempre quiere el HTML para descargar** (lo pidió el 22/9, "siempre"). Toda
  página o app que se haga: además del link, se le **manda el archivo**
  (`SendUserFile`, `display: "attach"`), completo y que ande sin internet.
  Se arma con `herramientas/descargable/empaquetar.py`: el archivo de un
  artifact solo no sirve, porque no trae `<!doctype>` ni `meta charset` (los
  acentos se rompen al abrirlo del disco) y carga las librerías de la CDN.
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
| [video](video.md) | haya que tocar un video, hacer un zócalo o quemar un gráfico |
| [juegos](juegos.md) | haya que animar modelos de Rezona en three.js, probar un juego cuadro a cuadro, hacer un Dead Eye, voces con acento o un shooter 3D con bots |
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
| `herramientas/descargable/` | arma el HTML descargable de un artifact | su docstring |
| `herramientas/iblo/`, `mint/`, `audio/` | utilidades sueltas | — |
| `tiktok/` | versión 9:16: intro con logo, titular, subtítulos; `armar.mjs` arma el video | [video](video.md) |
| `zocalo/` | zócalo de stream: editor, fuente de OBS, y `quemar.mjs` para videos | [video](video.md) |
| `estancia/` | juego "Estancia — La Ley del Monte" (three.js, modelos de Rezona) | `estancia/LEEME.md` |
| `isla-royale/` | battle royale 3D (three.js + React, un solo HTML); `prueba.mjs` lo recorre | [juegos](juegos.md) § Battle royale 3D |
| `termo/` | termo de mate en 3D (three.js): se gira, se ceba, el agua se enfría | [maquina](maquina.md) para capturarlo |
| `telarana/`, `garfio/`, `pozo/`, `pique*/`, `flores/`, `paraguas/` | juegos | — |
| `Prompts/` | colecciones de prompts | — |

**No están en esta rama** aunque el traspaso las nombre: `herramientas/kaggle/`,
`herramientas/colab/`, `herramientas/vnc/`, `peakcode/`.
