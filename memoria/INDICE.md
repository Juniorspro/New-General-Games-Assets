# Memoria — el índice
Última puesta al día: 07/10/2026 (Nexitron en un solo HTML, en pausa; el APK de FNaF 4 no se porteó).
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
- Está haciendo un juego en **Roblox Studio** en su laptop (30/09/2026): lo de Roblox se queda en el repo. Desde el 01/10/2026 Studio también corre acá con Wine 11 + DXVK (receta en `ARRANQUE.md § 1`).
- Sus juegos HTML se entregaban en UN archivo que abre sin red, pensados para el celular, en tres idiomas (es, en, pt).
- Pidió limpiar el repo porque "come tokens" (30/09/2026): no volver a llenarlo de builds, binarios ni proyectos que no use.
- Sus juegos son de **JXSTUDIOS** y arrancan con su intro (30/09/2026): sola, sin tocar nada; **en el estilo de cada juego** (la de pixel art en el juego pixel le gustó; no siempre negro y cromo); y después del logo, **elegir el idioma** (la primera vez). → [cripta](cripta.md), [vibora](vibora.md), [isla](isla.md), [globo](globo.md), [morfi](morfi.md)
- Cuando pasa capturas de un juego ajeno, se hace uno original del mismo género, de JXSTUDIOS, y se le dice (30/09/2026).
- Si pide portear un juego comercial re-subido por otro (07/10/2026: Geometry Dash 2.2081 con Geode, de un usuario de itch.io que no es RobTop): no se baja ni se portea; se le dice por qué y se ofrece uno propio del género. Lo mismo con un fangame que trae los archivos del original (07/10/2026: GDPSP traía las canciones, los sonidos y el logo de Geometry Dash): se mira qué tiene adentro antes de prometer nada. En cambio, un fangame gratis que reparte su propio autor sí se pasa al navegador para uso personal (07/10/2026: Nexitron; lo pidió insistiendo "la otra sesión hace estos porteos"). → [rpgmaker](rpgmaker.md)
- El chat no entrega archivos de más de 30 MiB (07/10/2026): un juego más grande va en partes.
- Si dice que un APK es "el demo" o "un fangame", se comprueba antes de decidir (07/10/2026: el `fnaf-4_2.0.3.apk` de MediaFire era el FNaF 4 pago completo). Sin bajar nada, la API de MediaFire (`/api/1.5/file/get_info.php?quick_key=…&response_format=json`) da nombre, tamaño, SHA-256 y quién lo subió; el tamaño y la versión se cotejan con una búsqueda. En Game Jolt, `POST /site-api/web/discover/games/builds/get-download-url/<build>` da el enlace, y un pedido de rango a los últimos 128 KB alcanza para listar el zip sin bajarlo (07/10/2026: "PvZWidescreen16x9" era el PvZ pago de PopCap con un parche).
- Los HTML que recibe los sube a **Rezona AI**, donde quedan a la vista de otros, con jugadas y likes (07/10/2026: un port de Plants vs. Zombies hecho por otra sesión, con 23 jugadas). Un port de un juego ajeno ahí ya no es "uso personal": no se arregla ni se achica. Rezona muestra como texto roto un HTML guardado en UTF-16 (BOM `FF FE`, como el de `porteo/un-archivo.py` de otra sesión): para Rezona, siempre UTF-8.
- El 07/10/2026 pidió "dejá el GD de lado": Nexitron en un solo HTML quedó en pausa. No retomarlo si no lo pide.
- Si pide portear un APK ajeno "tal cual": se mira con qué está hecho (zip + nombres de la metadata, sin ejecutar nada), se le dice si se puede, y no se copian el arte ni el código de otro; se ofrece uno propio del género (06/10/2026). Con NoomiClone dijo "hacé uno exacto, es una idea libre": salió Trapito, la misma mecánica con todo propio; lo pidió "pa mí nomás", así que el juego se entrega como archivo y no entra al repo (lo aprendido sí). → [trapito](trapito.md)
- Con sus llaves decide él: si una pasó por el chat se le avisa una vez y, si dice que se use, se usa, siempre fuera del repo (01/10/2026, Kaggle).
- No banca esperas largas: con la animación de la JX-1 cortó a la hora y media de render ("ya fue", 01/10/2026). Primero algo rápido que se pueda ver; después, si quiere, la versión pesada. Antes de un render largo se mide un cuadro.
- Quiere juegos **simples y terminados**, rápido: con Grumo se quejó "te pedí un juego simple" porque se validaba cada nivel durante horas (30/09/2026). Alcanza con que cada nivel se pueda ganar y una prueba de humo; el ajuste fino, si lo pide. → [grumo](grumo.md)

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
| [rpgmaker](rpgmaker.md) | pasar un juego de RPG Maker MV al navegador del celu: sistema de archivos virtual, .m4a/.mp4, escala, y entregarlo en partes porque el chat corta en 30 MiB; o meter binarios en un HTML con base122 (+14 % en vez de +33 %) y achicar imágenes con AVIF 4:4:4 |
| [clickteam](clickteam.md) | arreglar un port de un juego de Clickteam Fusion (FNaF 2): esqueleto sin base64, eventos crudos, tinta semitransparente, temporizadores de tiempo real |
| [trapito](trapito.md) | muñeco de trapo con Verlet (músculos como torques que no inventan energía), medir si un salto se puede con bots, brazos que buscan la barra, three.js metido en el HTML |
| [grumo](grumo.md) | plataformas con trampas (tipo Level Devil): mundo a 12 fps y física a 120, trampas como datos, zonas de disparo, bolas que escupe la puerta, el resolvedor por jugadas |
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
| `grumo/` | GRUMO: plataformas de plastilina en stop motion, el animador hace trampa (20 escenas en dos sets, camarín, 3 idiomas); se juega con `grumo-en-un-archivo.html` | `grumo/README.md`, [grumo](grumo.md) |
| `bomba/` | BOMB RUNNER SIMULATOR (el de Roblox, a medio hacer): correr con una bomba, explotar, mascotas y renacer | `bomba/README.md` |
| `herramientas/` | Blender sin GPU, Neko, Mint, Rezona (`rz.py`, `estado.json`), portadas de los juegos (`portadas/`), audio | `ARRANQUE.md § 4`, [juegos](juegos.md) › Portadas |
| `edificio/` | torre de oficinas armada por script en Blender + visor three.js | — |
| `bot-whatsapp/` | motor de comandos con dos proveedores intercambiables | — |
| `Prompts/` | colecciones de prompts | — |
| `guias/` | las guías largas para hacer juegos | [juegos](juegos.md) |
| `memoria/` | esta memoria | `MEMORIA.md` |

Borrado el 30/09/2026 y recuperable con `git checkout fbffdfb -- <carpeta>`: los juegos HTML (`enjambre/`, `ritmo/`, `espejo/`, `garfio/`, `paraguas/`, `pozo/`, `pique*/`, `perro/`, `dimension-n/`, `telarana/`, `flores/`), `frutiger-aero/`, `docs/` (IBLO Eventos), `iblo-eventos/`, `electro-silver/`, `modelos-cdn/` y `ESTADO.md`. Los sitios siguen publicados en Cloudflare.
