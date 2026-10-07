# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Quedan las ~8 más nuevas; las viejas pasan a
[diario-viejo](diario-viejo.md), que no hace falta leer (lo que quedó está en cada nota).

- **07/10/2026 · `claude/fijate-iszyer`:**
  - Baldi's Basics Classic 1.4.3 (Unity 2018, gratis) portado a un solo HTML de 13,5 MB y mandado ([baldi](baldi.md)):
    un Unity chiquito en JS con los guiones del juego pasados de C#; intro JXStudios, idioma, controles de celu.
    Falta probar a fondo objetos, la cuerda de Playtime, el final y la escena secreta.
  - Portada 9:16 de Baldi: arte con Higgsfield (`nano_banana_2`, job `2861f1a6…`) + título con Comic Neue (OFL),
    Liberation Serif y la moneda (`scratchpad/portadas/`, fuera del repo). Mandada.
  - Rechazados (se venden o tienen anuncios): Poppy Playtime, GTA SA Lite, Hypper Sandbox, Geometry Dash 2.2081,
    Counter-Strike 1.6 (resubido a GameJolt por otro; es de Valve y se vende en Steam).
  - Just Shoot (Error Panic, gratis): la demo web oficial (BananaBread) a un solo HTML de 22,4 MB, con controles de
    dedo personalizables, intro e idioma ([justshoot](justshoot.md)). Mandado. Se puede sumar mapas de la Classic.
  - Pidió portada 9:16 siempre con cada juego (regla en INDICE). Hecha la de Just Shoot (Higgsfield `99d9602c…` +
    Bebas inclinada, `scratchpad/portadas/`, fuera del repo).
  - Portada 9:16 de FNaF 4 (HTML subido por el usuario): Higgsfield `19624051…` (cuarto oscuro, pesadilla en el
    pasillo) + título SpecialElite como la de FNaF2 y la moneda. Mandada.
  - Slendytubbies: intro JXStudios, sin pantalla de carga, idioma sobre el menú difuminado (HTML mandado).
  - Portadas 9:16 de FNaF 2 y Slendytubbies: arte con Higgsfield (`nano_banana_2`, jobs `cf4a8b9f…` y `48f56c26…`)
    + título y moneda compuestos con PIL (`scratchpad/portadas/componer.py`, fuera del repo: es fan art). Mandadas.
  - FNaF 2 (Clickteam 2.5) portado a un solo HTML de 19,8 MB y mandado ([fnaf2](fnaf2.md)): intro JXStudios,
    arranca directo, en inglés, controles como el de celular. Falta: subtítulos de las llamadas (no los pidió).
  - Slendytubbies girado 90° con el celu parado (HTML mandado).
  - FNaF 2 ("by SuperMiGamer003", es el FNaF 2 de Scott con agregados), empezado y frenado por el usuario:
    Clickteam 2.5 b288 cifrado; `scratchpad/fnaf2/herr/ctf.py` + `cifra.py` ya leen todo (sin commit todavía).
  - Slendytubbies: arranca directo en JUGAR y el idioma se pide al tocarlo (HTML mandado). "El juego"
    sin nombre era el último mandado, no TJOC (lo había hecho en TJOC y se volvió atrás).
  - TJOC **en pausa hasta nuevo aviso** (lo pidió). Capítulo 2 (LivingRoom), a medias: falta `CharacterMovement` en `COMP_DE_ACTOR`, `MovementMode` y
    el movimiento caminando (`P.mover` en `jugador.js` no existe). `herr/codigo.py` muestra el código de una clase.
  - Pidió: portear Slendytubbies V2 Beta "al 100 y en HTML". Salió un solo HTML de 11 MB con las 11 escenas,
    la lógica de sus scripts, multijugador por código de sala y es/en/pt ([slendytubbies](slendytubbies.md)).
  - Antes: el APK de TJOC no le llegaba; se reenvió (MediaFire no se puede: pide su cuenta).
  - Falta: probarlo en su celu y con amigos por el broker público.

- **06/10/2026 · `claude/fijate-iszyer`:**
  - Pidió: portear TJOC: Story Mode (gamejolt). Es UE 4.16: se hizo el motor que ejecuta su Blueprint
    ([tjoc](tjoc.md)). Se entregó el capítulo 1 (APK 18 MB, es/en/pt, imágenes con texto traducidas).
  - Falta: los capítulos 2 en adelante (living, oficina, sótano, ático) y probar la APK en el celu.

- **29/09/2026, de tarde, decimoquinta vez · `claude/fijate-iszyer`:**
  - Pidió: el HTML; construir en la casa y mejores decoraciones; arreglar minijuegos y menús; el celu parado; guardar
    botones en el celu.
  - Quedó ([aeroplaza-48](aeroplaza-48.md)): el modo construir (54 piezas), el celu parado, los botones en el celu y
    los arreglos del recorrido (`arreglos.mjs` 19/19). La n 5, la página v48 y el HTML (el envío dio 500 un rato).
  - Después pidió "arreglá la construcción, como Sims Mobile, que sea cómoda". Quedó ([aeroplaza-49](aeroplaza-49.md)):
    `obra.js` (tocar, arrastrar, la barrita, cuartos, miniaturas 3D, paredes cortadas); `casa.mjs` 35/35. La n 6.
  - Después: hacer juegos en Roblox Studio. En la nube no se puede entrar a Studio (el inicio rápido exige la
    misma red); se instaló Claude Code en su PC con el MCP de Studio ([roblox](roblox.md)). `TRASPASO-ROBLOX.md`
    para la sesión de la PC.
  - 30/09: BRILLO, KUNTUR y RUTA 40 en vertical de verdad (sin girar; el giro queda como opción) y el tirón del
    arranque de KUNTUR (shaders compilados con el telón cerrado). Pruebas `vertical.mjs` de los tres, todas bien.
    Pidió no usar ayudantes: gastan muchos tokens. Hacerlo en la sesión.
  - 01/10: mandó seis HTML hechos ("ahora estos"): cinco ya eran de celu parado; LA ISLA se giraba y se porteó
    (Girar queda como ajuste); el parpadeo de las antorchas de CRIPTA y dos textos de GLOBO ([sueltos](sueltos.md)).
  - 02/10: tres videos dúos de ~58 s en neutro latino (GLOBO+VÍBORA, MORFI+CRIPTA, LA ISLA+GRUMO): un bot juega
    cada juego, la música es la de cada juego, voz Andre, motion graphics en Remotion y una portada por video
    ([videos](videos.md), «Los dúos»). Se mandaron los livianos y las portadas.
  - 06/10: el md del modo GOAT ([ahorro](ahorro.md)), aplicado en `CLAUDE.md`. Después mandó un TikTok de Mad Skills
    Motocross: "ese juego, full, 200 % mejor", sin usar RUTA 40. Quedó BARRO ([barro](barro.md)): 20 pistas en 4 sedes,
    Jam del día, contrarreloj con fantasma, garage, 3 idiomas, controles editables; `navegador.mjs` da "Todo bien".
    Después: los árboles pintorescos de BARRO y el HTML. Y un port a APK de *Bus Stop Simulator* (Unity 4.5, de
    otros): rearmado en three.js desde sus archivos ([bus-stop](bus-stop.md)); se mandó la APK (6,5 MB).
    Después, otro: *Pizza Delivery v0.2* (Unity 3.5, 6 escenas) a APK ([pizza-delivery](pizza-delivery.md)); las tres
    pruebas de la historia dan "Todo bien"; se mandó la APK (21 MB). Falta probar las dos en un teléfono.
  - Falta: que diga cómo le quedan en su celu la construcción y los juegos parados, y qué le parecen los videos
    (hay `--sin-musica` para ponerles un sonido de TikTok); el primer juego de Roblox (desde la sesión de su PC).
- **28/09/2026, de noche, decimocuarta vez · `claude/fijate-iszyer`:**
  - Dijo: "no le llegan las actualizaciones".
  - Quedó ([aeroplaza-47](aeroplaza-47.md)): la APK 45 solo buscaba al arrancar de cero. La 46 busca al volver y cada
    20 min, y usa lo bajado sin cerrar la app. Se mandó la APK 46 (misma firma: va encima). Publicada la n 3.
  - Volvió a decir que no le llega: la búsqueda anda desde acá (probada en Java contra GitHub). Se publicó la n 4 con
    "versión N · app M" abajo del menú, para saber qué tiene su celu.
  - Falta: que diga qué versión le figura abajo del menú.
- **28/09/2026, de noche, decimotercera vez · `claude/fijate-iszyer`:**
  - Pidió: un celu en AEROPLAZA para que sea "algo así como Roblox", con amigos y solicitudes de amistad.
  - Quedó ([aeroplaza-46](aeroplaza-46.md)): el celu (apps, amigos, solicitudes, charlas cifradas, juegos, casas,
    perfil, unirse a la sala de un amigo), el muñeco con el celu en la mano, el id = la huella de la llave.
    `celu.mjs` 33/33, la tanda 41/41. Publicado como actualización (sin APK nueva: no cambió lo de Java).
  - Falta: probarlo con dos celulares de verdad contra el broker público.
- **28/09/2026, de tarde, duodécima vez · `claude/fijate-iszyer`:**
  - Pidió: que las actualizaciones lleguen a la app, sin mandarle tantos APK.
  - Quedó ([aeroplaza-45](aeroplaza-45.md)): la APK busca `aeroplaza/actualizacion.json` y baja el juego nuevo sola;
    `publicar.mjs`; publicada la n 1. Se mandó UNA APK (la 45) que ya se actualiza sola.
  - Falta: probar en el celu que baje y use la n 2.
- **28/09/2026, al mediodía, undécima vez · `claude/fijate-iszyer`:**
  - Pidió: limpiar el repo para gastar menos tokens, y el mando VR Box en el VR de AEROPLAZA.
  - Quedó: el índice de 22 a 9 KB (las vueltas de AEROPLAZA en [aeroplaza-vueltas](aeroplaza-vueltas.md)), el diario viejo
    aparte; el mando VR Box ([aeroplaza-44](aeroplaza-44.md)), `vrbox.mjs` 27/27.
  - Falta: probar con un VR Box de verdad (qué botón es el gatillo en cada modo).
- **28/09/2026, de mañana, décima vez · `claude/fijate-iszyer`:**
  - Pidió: una página sobre su estudio (JXStudios, mandó el logo), en Cloudflare, con su app, y una llave para que
    otra sesión la pueda cambiar.
  - Quedó ([jxstudios](jxstudios.md)): `jxstudios/` (la página en 3 idiomas, los 6 juegos, AEROPLAZA web y la APK sin
    canciones) y `desplegar.sh`, que la sube con la llave del entorno.
  - Falta: la llave (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) en el entorno. Después, en una sesión nueva,
    `jxstudios/desplegar.sh`.
- **28/09/2026, de madrugada, novena vez · `claude/fijate-iszyer`:**
  - Pidió: todo el juego en el VR, ARCore en 3DoF (por las manos) con opción, la pelotita con manos que ven los demás,
    entrar a los edificios y jugar los minijuegos.
  - Quedó ([aeroplaza-43](aeroplaza-43.md)): el espejo (ventanas y charlas adentro del VR), viajar sin salir, puertas y
    cosas de adentro con el rayo, el tiro y el parkour sin arco, 3DoF con cuello de entrada, la pelotita por la red.
    `vr-juego.mjs` 21/21.
  - Falta: probar en el celu el espejo en el visor y la pelotita entre dos celulares.
- **27/09/2026, de noche, octava vez · `claude/fijate-iszyer`:**
  - Pidió: tu espacio estilo Quest (la mira que no apriete, las pantallas lejos, la cámara 0,5x); mandó AngleCam.
  - Quedó ([aeroplaza-42](aeroplaza-42.md)): la mira no aprieta y se apaga con manos; pantallas a 1,45-1,9 m; la
    0,5x con ARCore en pausa (la cabeza del giroscopio alineado). `espacio.mjs` 32/32, `ancha.mjs` 17/17.
  - Falta: probar la 0,5x en el celu (qué camino elige, si la foto cae derecha, si ARCore retoma al volver a 1x).
- **Antes (22/09 a 27/09, 56 sesiones):** en [diario-viejo](diario-viejo.md).
