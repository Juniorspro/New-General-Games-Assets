# Geometry Dash (Android, 2.2) → web

Los 21 niveles principales de Geometry Dash corren en el navegador con **un motor
nuestro** (JavaScript + WebGL 2) y **todo lo demás sale del APK del dueño**: los
niveles tal como vienen, las hojas de dibujos, los fondos, la música y los sonidos.

No hay un motor de otro ni un emulador: el juego original es código ARM compilado
(`libcocos2dcpp.so`) y no se puede pasar a WebAssembly sin su código fuente. Lo que
sí se puede, y es lo que se hizo, es reproducir lo que hace con los mismos números.

| archivo | qué es |
|---|---|
| `portear.sh` | del APK a la entrega: carpeta web instalable y sin red, su zip y, con `--un-archivo`, un solo `.html` |
| `armar-datos.py` | del APK a los datos: hojas en WebP, música en Opus, la tabla de qué es cada objeto, animaciones |
| `index.html` | la carcasa: intro de JXStudios mientras carga, giro, atrás, pantalla completa |
| `src/` | el motor (ver abajo) |
| `prueba.mjs` | la lista de PORTEO.md §9 con dedos de verdad, medida en el estado del juego (37 pruebas) |
| `pruebas/bot.js` | un bot que juega cada nivel hasta terminarlo (búsqueda por haces sobre el mismo motor) |
| `pruebas/mapa.py` | dibuja el tramo donde el bot se trabó: formas de choque y recorrido |

```bash
porteos/gd/portear.sh "Geometry Dash.apk" entrega-gd --un-archivo
node porteos/gd/prueba.mjs entrega-gd/gd entrega-gd/gd.html
node porteos/gd/pruebas/bot.js 1 2 3          # ANCHO=700 para los difíciles
```

## El motor (`src/`)

| archivo | qué hace |
|---|---|
| `base.js` | constantes (320 de alto, 240 pasos por segundo), curvas de los triggers, HSV |
| `nivel.js` | lee el nivel (base64 + gzip, `k,v;` por objeto): ajustes, colores, objetos, grupos |
| `jugador.js` | la física de cada modo: `PlayerObject::updateJump` de la 2.2 |
| `juego.js` | la partida: pasos, choques (`collidedWithObjectInternal`), portales, pads, orbes, rampas, cámara |
| `triggers.js` | mover, rotar, seguir, alfa, pulso, color, alternar, generar, contar, sacudir |
| `colores.js` | los canales de color con sus fundidos, copias, HSV y pulsos |
| `render.js`, `escena.js` | el dibujo con WebGL 2: capas, orden z, mezcla aditiva como GD, piezas del robot y la araña |
| `audio.js` | WebAudio: el reloj de la canción manda sobre el del juego |
| `partida.js`, `pantallas.js`, `ui.js`, `app.js` | menú, selector, pausa, práctica, final, lo guardado |

**De dónde salen los números.** La física (salto, gravedad y avance por velocidad,
el 0,9 del tiempo vertical, los topes de la nave, los márgenes para subirse a un
bloque, los bloques que se rompen, la velocidad de salida de las rampas) sale de la
descompilación de la 2.2 de [camila314/gdp](https://github.com/camila314/gdp); los
impulsos de orbes y pads, de [OpenGD](https://github.com/OpenGD/OpenGD). Se leyeron
para entender, no se copió código. Cómo se dibuja cada objeto (cuadro, hijos,
capa, canal de color) sale de `object.json` de
[gdclone](https://github.com/opstic/gdclone) (MPL-2.0), que `portear.sh` baja en un
commit fijo y verifica. Qué **hace** cada objeto (sólido, pincho, portal, orbe...)
es una tabla nuestra (`clasificar` en `armar-datos.py`), comparada contra la de
OpenGD: así aparecieron los pinchos de hielo y de color que contaban como bloques.

## Cómo se prueba que se juega igual

`pruebas/bot.js` juega cada nivel con el mismo motor, probando soltar o mantener
cada 1/60 s. Si la física o un choque no son los del original, algún tramo se vuelve
imposible y el bot dice dónde y contra qué; con `MAPA=` deja el tramo dibujado. Así
se encontraron, entre otros: las sierras que no mataban (el radio estaba en otra
clave), los bloques que se rompen, el piso revisado después de los pads (un pad
azul apoyado mataba) y la salida de las rampas (sin ella, la bola no cruzaba los
huecos de Hexagon Force).

`prueba.mjs` termina Stereo Madness entero en la página con los toques del bot y
revisa lo guardado, las estrellas y la pantalla final.

## Carga rápida

El `.html` único pesa ~24 MB, pero el menú abre con los primeros ~6 MB (código,
dibujos, niveles y sonidos); la música va al final, en el orden de los niveles
(`un-archivo.py --al-final`, que ahora respeta ese orden), y llega mientras se
juega. Las hojas van en WebP (8,4 MB de PNG → ~3,7 MB) y la música en Opus a 64 kb/s
(34 MB de MP3 → 17 MB).

## Lo que no está

- **Dash y la Torre** (5001–5004): usan objetos y triggers de la 2.2 (y la Torre es
  de plataformas) que este motor todavía no tiene.
- **Iniciar sesión y los niveles online**: los servidores de RobTop rechazan los
  pedidos que vienen de una página web (probado: 403 sin permiso CORS); haría falta
  un servidor en el medio que vería la contraseña. Los niveles online se podrían
  traer de GDBrowser, que sí acepta páginas web, pero muchos usan cosas de la 2.2.
- **Íconos, tienda, logros, editor**: el jugador usa el ícono y los colores de fábrica.
- El fuego y las bestias se dibujan con su primer cuadro, sin animar.
