# Ports de juegos de Clickteam Fusion — lo que enseñó (07/10/2026)
Trajo un port de FNaF 2 armado en otra sesión (un HTML de 20 MB: los datos del juego pasados a JSON + un motor propio en JS) porque el botón "mute call" "no andaba" y la otra sesión no encontraba el error. **El juego no está en el repo** (lleva el arte y los sonidos del original; es para uso personal). Ver también: [probar](probar.md).

## Cómo se busca un error en un port así
- No leer los 20 MB: sacar los `<script>`, reemplazar los base64 por marcas (queda un esqueleto de ~300 KB) y formatear el motor con `prettier` (está en `/opt/node22/bin`).
- Los datos del juego (`datos/juego.json`, gzip) traen los eventos crudos de Clickteam: `[tipo, número, oi, …, parámetros]`. Buscar el objeto por nombre (`mute call` = oi 177) y listar los grupos de eventos que lo nombran.
- Reproducir en Chromium con los ganchos del motor (`window.__fnaf2.M`): entrar a la noche 1 por el camino normal (tocar "new game"), esperar el botón, tocarlo y leer la ganancia del canal.
- Que la lógica "ande" no alcanza: la otra sesión (y esta, al principio) tocaba el botón por coordenadas y funcionaba. El error era que **no se veía**: hay que sacar una captura en el momento exacto.

## Lo encontrado en el port de FNaF 2
- Efecto de tinta 1 (semitransparente): el parámetro es un coeficiente de 0 a 128. El motor, si la tinta tenía la marca 0x10000000, lo leía como un alfa en el byte de arriba. Los 50 del botón daban alfa 0: el botón nunca se dibujaba. Lo mismo les pasaba a otros 39 objetos (los íconos de la noche personalizada, el apagón de la oficina, las líneas de las cámaras).
- Arreglo (una condición): el alfa del byte de arriba solo se usa si el efecto no es 1. El 0x10000000 con parámetro 0xFFFFFFFF (411 objetos) sigue dando opaco.
- Los temporizadores de Clickteam ("cada X segundos", "el reloj pasa de X") son de tiempo real. El motor da 60 pasos por segundo pero avanza el reloj 1000/27 ms por paso (los 27 fps del juego): todo lo que va por tiempo corre 2,19 veces más rápido. Una hora de la noche (70 s en el original) dura ~32 s, y el botón de la llamada dura ~12 s en vez de 29.
- No se tocó el reloj: con `fps = 60` aparecían a veces franjas blancas en la cámara (sin explicar) y cambia el ritmo de todo el juego. Quedó para preguntarle.
