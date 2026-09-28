# Diario

Una entrada por sesión, la última arriba. Va lo que otra sesión necesita saber
(qué quedó y qué falta), no el relato. Quedan las ~8 más nuevas; las viejas pasan a
[diario-viejo](diario-viejo.md), que no hace falta leer (lo que quedó está en cada nota).

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
- **27/09/2026, de noche, quinta vez · `claude/fijate-iszyer`:**
  - Pidió: "6DoF súper suave y goty, es muy impreciso" (con un TikTok de metanexusxr que no se pudo ver).
  - Quedó ([aeroplaza-39](aeroplaza-39.md)): la cabeza nativa (el giroscopio del sistema corregido con ARCore),
    que el juego lee al dibujar, y otra vez a último momento para los ojos. `cabeza.mjs` 17/17.
  - Pidió también investigar ARCore for Jetpack XR: en el celu es el mismo ARCore y no tiene manos (anotado ahí).
  - Falta: probarla en su celu.
- **27/09/2026, de noche, cuarta vez · `claude/fijate-iszyer`:**
  - Pidió: "no escanea" (captura: esperando la profundidad, 0 planos, la linterna prendida); y manos más estables
    en el HTML también, con un link para probar el HTML en 3DoF.
  - Quedó ([aeroplaza-37](aeroplaza-37.md)): la config de la sesión en un solo hilo (la linterna la pisaba), la
    vigilancia, la profundidad suavizada y el diagnóstico en la tarjeta. `malla.mjs` 19/19.
  - Después: la foto de ver a través que quedaba a la mitad ("zoomeada"), y las manos más estables
    ([aeroplaza-38](aeroplaza-38.md)); el link del HTML: raw.githack de la rama.
  - Falta: la captura del renglón chico si todavía no escanea, y qué le parecen las manos.
- **27/09/2026, de noche, todavía más tarde · `claude/fijate-iszyer`:**
  - Pidió: "no, pues no escanea el entorno".
  - Quedó ([aeroplaza-36](aeroplaza-36.md)): la cámara con profundidad se elige antes de arrancar ARCore, los
    pedidos se guardan si ARCore no existe, y la tarjeta dice en qué paso se traba. `malla.mjs` 18/18.
  - Falta: la captura de la línea 📡 de la tarjeta, para saber cuál era la causa.
- **Antes (22/09 a 27/09, 51 sesiones):** en [diario-viejo](diario-viejo.md).
