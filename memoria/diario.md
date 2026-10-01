# Diario — una entrada por sesión

## 29/09/2026 · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "esto es nomás pa que aprendas a crear juegos con buenos gráficos en HTML, buenas animaciones y mecánicas". Material: dos guías, `MEMORIA.md` y aeroplaza (HTML de 10,8 MB).
- Quedó: las guías en `guias/` tal cual llegaron; `MEMORIA.md` en la raíz; `CLAUDE.md`; esta memoria (índice + 5 notas).
- Aeroplaza leída entera: el bundle se formateó (36.675 líneas) y 9 lectores se repartieron el código; la receta quedó en `guias/GUIA-AEROPLAZA.md`.
- Medido en el banco: los 7 reinos cargan sin errores (1,6-9,7 s con SwiftShader); caminar 3,34 y correr 6,89 m/s de promedio en 2 s; eligió sola la calidad "minima".
- Decidido: aeroplaza NO entra al repo (pesada, con 7 canciones, y el repo es público). Se le avisó a quien pide.
- Falta: si quiere el HTML en el repo, subirlo; las notas de `pique2d/`, `dimension-n/` y `espejo/` están sin leer.

## 29/09/2026 (tarde) · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "recreá el juego de la isla, entrá al perfil y mirá todo" y un menú 3D como el de @brutu_scripts "pero como el de playa".
- Quedó `isla/`: 30 módulos, tres idiomas, archivo único de 982 KB, 32 + 6 comprobaciones en verde. → [isla](isla.md)
- Hecho: talar, minar de a pedazos, pala, guadaña, pesca, construir, mina con faroles, estrellas de noche, guardado, colección y objetivos.
- Hecho: el menú que se mece y vuela a los carteles.
- Falta: medir en un teléfono, tienda, revisar otras semillas en pantalla.

## 29/09/2026 (noche) · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "los mismos gráficos del juego original, mejoralo, giralo 90°, un propósito, más mecánicas, mejores vistas, mejores armas".
- Hecho (commit e363836): nubes 3D, reflejo en el agua, palmeras y matas como en los videos, noche más oscura, y el teléfono parado juega acostado.
- Hecho: la historia del faro en seis capítulos con final, cuatro enemigos y el guardián, seis armas y dos petos, fogata, cocina, cocos que se plantan, mercader, tesoro, mapa, tercera persona, gaviotas, luciérnagas y peces. → [isla](isla.md)
- Medido: 60/60 tres veces + 6/6; archivo único de 1138 KB.
- Falta: medir en un teléfono de verdad; mirar otras semillas en pantalla.

## 30/09/2026 · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "hazme uno en HTML completito, buenos modelos y animaciones, busca referencias a full", con el documento de diseño de "Bomb Runner Simulator" (Roblox).
- Referencias: búsquedas web y miniaturas de YouTube (los videos no bajan). Estilo: el noob con la bomba negra, números enormes con borde, ruleta, mascotas dorada ×2,5 y arcoíris ×6, zonas x2-x50 por renacimientos.
- Quedó en `bomba/` la base (motor, cielos, materiales, texturas, avatar con poses, equipo). Se paró a pedido: todavía no se juega. → `bomba/README.md`
- Falta: todo lo de `bomba/README.md § Lo que falta`.

## 30/09/2026 (tarde) · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "hacé una limpieza del repositorio, hay muchas cosas innecesarias que comen tokens; dejá los de Roblox" (está haciendo un juego en Roblox Studio).
- Borrado (elegido por quien pide): los juegos HTML viejos, isla incluida, y los sitios con lo de IBLO (`frutiger-aero/`, `docs/`, `iblo-eventos/`, `electro-silver/`, `modelos-cdn/`, `herramientas/iblo/`, los scripts de despliegue, el workflow de Supabase y `ESTADO.md`). De ~290 MB a 22 MB. Todo sigue en `fbffdfb`.
- Quedaron `bomba/`, `guias/`, `herramientas/`, `edificio/`, `bot-whatsapp/`, `Prompts/` y la memoria. `ARRANQUE.md` y `README.md` se reescribieron cortos.

## 30/09/2026 (noche) · rama `ccr-6f24de5d-v3vxtu`
- Pedido (con una captura de Tomb of the Mask en Google Play): "recrealo a la perfección, investigá, hacé los menús, animaciones, gráficos, motions, pixel art completo".
- Quedó `cripta/`: CRIPTA NEÓN, original del mismo género (se le dijo que no se copia el personaje ni los niveles). 30 niveles en tres mundos, torre infinita con lava, 8 pieles, 4 poderes con mejoras, música y efectos por código, es/en/pt, guardado. → [cripta](cripta.md)
- Medido: 3963 comprobaciones sin navegador, 17/17 en Chromium, archivo único de 245 KB que abre sin red.
- Falta: probarlo en un teléfono de verdad (lo de Chromium no dice nada de los cuadros por segundo del teléfono).


## 30/09/2026 (más tarde) · rama `ccr-6f24de5d-v3vxtu`
- Pedido (con tres capturas de slither.io en Google Play y dos imágenes del logo de JXStudios): "portear todo este juego propio hecho por JXSTUDIOS" y una intro con JXSTUDIOS en cada juego HTML: en 3D para el de la playa, en 2D "súper rápida" para el de Tomb of the Mask, con música y efectos.
- Cripta Neón: intro en pixel art con su música (commit 101f6ae). → [cripta](cripta.md)
- Quedó `vibora/`: VÍBORA.IO, original del género (no se copian nombre, logo ni dibujos; sin red, contra bots), con su intro 2D de JXSTUDIOS. → [vibora](vibora.md)
- Medido: 152 comprobaciones sin navegador, 15/15 en Chromium, archivo único de 113 KB que abre sin red.
- La isla volvió al árbol (desde `fbffdfb`) con su intro 3D de JXSTUDIOS: tubos de cromo que se escriben, reja, golpe, brillo y la playa desde el blanco. 66/66 y 7/7; archivo único de 1182 KB. → [isla](isla.md)
- Falta: probar las tres intros y los juegos en un teléfono de verdad (Chromium sin placa no dice nada de los cuadros por segundo).
- Después pidió: "que inicien la cinemática sin tener que tocarla", "dame los HTML directos pa descargar" y "el de serpiente se laguea".
- Quedó: las tres intros desde el primer cuadro, sin puerta (el sonido suena solo si el navegador deja; si no, va muda). La isla muestra la intro antes de armarse. Víbora avanza cada cuadro su tiempo real (a 90/120 Hz iba a tirones) y pinta un 32 % menos en el teléfono. Los tres HTML se mandaron como archivos. → [vibora](vibora.md), [isla](isla.md)

## 30/09/2026 (cierre) · rama `ccr-6f24de5d-v3vxtu`
- Pedido (con una captura de Rise Up en Google Play): "después del logo, elegir los idiomas", "recreá este juego también" y "una intro adaptada al juego, no siempre negro y blanco; al menos para los siguientes juegos".
- Cripta y Víbora: después del logo, la primera vez, se elige el idioma (commit 823a00c). La isla ya lo tenía.
- Quedó `globo/`: GLOBO LIBRE, original del género (se le dijo), con motor de física propio, 30 niveles en tres cielos, infinito, tienda de 13 globos y 8 escudos, y la intro de JXSTUDIOS plana y de colores. → [globo](globo.md)
- Medido: 31 comprobaciones sin navegador, 17/17 en Chromium, archivo único de 163 KB que abre sin red. Sin tocar no se gana ningún nivel; el piloto automático gana 9 de 30.
- Falta: jugarlo en un teléfono de verdad (la dificultad de los últimos niveles está medida con un piloto, no con una persona), y si quiere, las intros de Víbora y la isla en el estilo de cada juego.

## 30/09/2026 (Morfi) · rama `ccr-6f24de5d-v3vxtu`
- Pedido (con dos capturas de Cut the Rope en Google Play): "haz otro juego sobre este, recrealo al 10, tipo de cartón, paper, GOTY; buenos modelos y animaciones". También pidió de nuevo el HTML de la isla: se le mandó.
- Quedó `morfi/`: MORFI, original del género (se le dijo): Morfi es una caja de cartón que come caramelos; 30 niveles en tres cajas (cartón, cuaderno, papel de regalo) con clips, globos, abanicos, chinches, sobres, gomitas y alfileres que se mueven; tienda de 8 Morfis y 7 caramelos; intro de JXSTUDIOS de papel; el menú con el cartel que se hamaca y un caramelo que se corta ahí mismo. → [morfi](morfi.md)
- Medido: 344 comprobaciones sin navegador, 20/20 en Chromium, archivo único de 192 KB que abre sin red. Cada nivel se gana con su solución guardada, ninguno sin tocar; margen promedio 99 %.
- Falta: jugarlo en un teléfono de verdad (la dificultad está medida con tiempos vecinos, no con una persona). Siguen sin respuesta: rehacer las intros de Víbora y la isla en su estilo, y borrar la página vieja repetida de Cripta.

## 30/09/2026 (portadas) · rama `ccr-6f24de5d-v3vxtu`
- Pedido: "GENERAME con Rezona lab, 6 portadas de los 6 juegos que hicimos recién, que queden bien y tengan mi logo por alguna parte visible siempre en su estilo o sea del juego". Se tomaron los 6 del repo (se le dijo).
- Rezona no estaba conectado en la sesión: se abrió con `login --no-browser` (aprobó el link que imprime) y se le habló por `rz.py`. Proyecto nuevo "Portadas JXSTUDIOS".
- Quedaron las 6 (Morfi, Cripta Neón, Víbora.io, Globo Libre, La Isla, Bomb Runner Simulator), 1024×1536, mandadas como archivos. 7 imágenes, 567 créditos. El armador quedó en `herramientas/portadas/`; las imágenes no se suben al repo.
- Falta: si quiere, subirlas como portada de cada juego en Rezona (no se tocó su perfil).

## 30/09/2026 (Grumo) · rama `ccr-6f24de5d-v3vxtu`
- Pedido (con una captura de Level Devil en Google Play): "hacete un juego 2D entero, completo, normal, vertical, agradable, animaciones stop motion, intro".
- Quedó `grumo/`: GRUMO, original del género (se le dijo): plataformas de plastilina a 12 cuadros por segundo; el animador mueve el set y su mano entra a llevarse la puerta; cada muerte es una toma con claqueta. 20 escenas (taller y cocina), camarín de colores y sombreros, 3 idiomas, intro de plastilina de JXSTUDIOS. → [grumo](grumo.md)
- Se quejó de que tardaba ("te pedí un juego simple"): se cortó en 20 escenas en vez de 30 y se entregó.
- Medido: las 20 se pueden ganar (resolvedor); prueba de humo en Chromium 9/9 sin errores con servidor y con el archivo único de 258 KB sin red. Página: `claude.ai/artifact/JqKib3w9uS1tR6JSxJJYZe`.
- Falta: jugarlo en un teléfono de verdad; el set de noche tiene fondo y música pero no escenas. Siguen sin respuesta: rehacer las intros de Víbora y la isla en su estilo, y borrar la página vieja repetida de Cripta.

## 01/10/2026 (Kaggle) · rama `ccr-6f24de5d-v3vxtu`
- Pidió los 6 HTML (Grumo, Morfi, Globo, Víbora, Cripta, la isla): se mandaron los archivos únicos, todos al día con sus fuentes.
- Quiere darle acceso a Kaggle. No hay conector: va como `KAGGLE_API_TOKEN` en el entorno (→ `ARRANQUE.md § 3`).
- Mandó una captura con el token entero a la vista. Se le avisó que pasó por el chat y que convenía rotarlo; dijo "simplemente usá la key que te pasé": quedó en `~/.kaggle/access_token` (600, fuera del repo) y autentica (`kaggle kernels list --mine` lista su notebook).
- Pidió bajar Roblox Studio y, ante el "no corre acá", dijo "Wine": se logró con Wine 11 + DXVK + escritorio virtual (receta en `ARRANQUE.md § 1`). Llegó a la pantalla de inicio de sesión con código para aprobar desde el celu.
- Inicio de sesión rápido desde acá: los dos primeros códigos quedaron "Cancelled" a los ~45 s, y el tercero duró más de un minuto sin cancelarse, así que se cancelaron del lado del celu. Preguntó si hay GPU: no (no hay `/dev/dri`; Vulkan y OpenGL son llvmpipe, la CPU). Pidió simular una wifi "FLIA-GOMEZ": no sirve, porque Roblox ve la IP de la nube y no el nombre de la red, y no se disfraza de dónde viene un inicio de sesión.
- Pidió que el inicio de sesión salga de "una ubicación real": no se hace (sería falsear de dónde viene para pasar el control de Roblox). Se le ofreció correr Claude Code en su laptop, donde la ubicación es real; Studio trae su propio servidor MCP (`StudioMCP.exe` en la carpeta de la versión). Se cerró el Studio de acá.
