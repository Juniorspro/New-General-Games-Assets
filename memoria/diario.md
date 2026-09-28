# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Quedan las ~8 más nuevas; las viejas pasan a
[diario-viejo](diario-viejo.md), que no hace falta leer (lo que quedó está en cada nota).

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
- **27/09/2026, de noche, séptima vez · `claude/fijate-iszyer`:**
  - Pidió: "se me cierra la app al entrar al ARCore" (sin logcat).
  - Quedó ([aeroplaza-41](aeroplaza-41.md)): los sensores de la cabeza a 200 Hz en su hilo y fuera del arranque; el
    arranque fallido suelta la cámara; la WebView caída se rearma; al abrir, un aviso fijo dice por qué se cerró la vez
    pasada. `choque.mjs` 22/22.
  - Falta: que lo abra en el celu; si se cierra de nuevo, la captura del aviso 💥.
- **27/09/2026, de noche, sexta vez · `claude/fijate-iszyer`:**
  - Pidió: "más mejoras" y "detectar un objeto en la mano como un control".
  - Quedó ([aeroplaza-40](aeroplaza-40.md)): el agarre de un objeto lo hace un control (rayo de la punta, gatillo con
    el índice o el pulgar, un control Aero dibujado, "🎮 Control" en el menú). `mando.mjs` 18/18.
  - Falta: probarlo con MediaPipe de verdad (con un objeto, los dedos tapados).
- **Antes (22/09 a 27/09, 54 sesiones):** en [diario-viejo](diario-viejo.md).
