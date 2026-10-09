# Anger of Stick 5 (J-PARK) → web y APK

Anger of Stick 5 (`AngerOfStick5jpark.AOS5` 1.1.94, firmado por J-PARK) corre en el navegador y en un
APK nuevo **con su propio código**: el mismo juego, con sus pantallas, sus reglas, sus enemigos,
sus tiempos y sus guardados, **sin internet y sin publicidad**. El APK pasa de 52 MB a 5,9 MB.

El original es cocos2d-x 3.17 y **todo el juego es código nativo ARM64** (`libMyGame.so`, 12 MB):
no hay JavaScript ni Lua que aprovechar, y reescribirlo a mano no sería "igualito". Así que el código
ARM del juego se **traduce a C instrucción por instrucción** (`recompilar.py`) y se compila a
WebAssembly; lo que hacían cocos2d, Android y la libc lo hace una capa chica escrita acá.

El juego no está en el repo (es público): `portear.sh` lo arma desde el APK.

| archivo | qué es |
|---|---|
| `portear.sh` | del APK a la entrega: web instalable, zip, `.html` único y APK, en un comando (la primera vez ~5 minutos; después, segundos) |
| `recompilar.py` | el traductor: desarma el `.so` (llvm-objdump 18), arma el grafo de cada función alcanzable desde las del juego y escribe una función de C por cada función ARM (`rec_NN.c`), la memoria del `.so` con las relocaciones aplicadas (`imagen.bin`) y las tablas (nombres, despacho de llamadas por puntero, funciones de la capa) |
| `aos.h`, `mem.c` | registros, banderas, acceso a memoria y el heap del juego (las direcciones ARM son las mismas en WebAssembly) |
| `hle_libc.c` | lo que el juego pedía a la libc de Android: memoria, cadenas, `printf`/`sscanf` con los argumentos variables de ARM64, matemática, archivos en memoria |
| `hle_cocos.c` | el cocos2d mínimo que usa el juego: nodos, sprites, letreros, escena, director, archivos, `UserDefault`, sonido, toques |
| `hle_android.c` | lo que iba a Java: anuncios (no hay), ventanas y llamadas JNI |
| `juego.c` | arranque, el reloj de cocos2d (una vuelta cada 0,06 s), toques, atrás, irse al fondo |
| `dibujo.c`, `texto.c`, `tablas.c` | el dibujo (como `Node::visit`), las letras (medidas de FreeType con la arial del APK) y el atlas que se arma a medida que el juego pide imágenes |
| `web.c`, `host.js`, `aos5.js`, `index.html` | la página: WebGL, WebAudio, guardado en el navegador, toques |
| `armar-datos.py` | saca del APK las imágenes (WebP, cada una aparte), los efectos (Opus), los archivos de datos, la letra y el ícono |
| `nativo.c` | la prueba sin navegador: corre el juego traducido en la máquina y vuelca lo que dibuja (para encontrar rápido lo que falta) |
| `prueba.mjs` | la lista de PORTEO.md §9 con dedos de verdad (CDP), midiendo en la memoria del juego |

```bash
porteos/aos5/portear.sh AngerOfStick5jpark.AOS5v1.1.94.apk entrega-aos5
python3 -m http.server 8876 --bind 127.0.0.1 --directory entrega-aos5 &
node porteos/aos5/prueba.mjs http://127.0.0.1:8876/aos5/ entrega-aos5/aos5.apk file://$PWD/entrega-aos5/aos5.html
```

## Qué hay

Todo lo del original que no necesita un servidor, con su propio código: el título, el premio
diario, el menú, los modos (MAIN con sus etapas; ZOMBIE, JUMP y DEFENSE empiezan trabados, como en
el original), el tutorial de controles, la tienda, las armas, las etapas con sus enemigos y
edificios, la pausa, los resultados, las opciones (sonido, ayuda, cupones) y los guardados.

- **Los videos con premio** (botiquín, dron, arma gratis, doble recompensa, gemas "Free") se dan
  por vistos enseguida: el juego recibe "cargado, mostrado, completo, cerrado" y da el premio.
- **Los anuncios de pantalla completa** contestan "no hay anuncio" (`InterstitialFail`), como un
  teléfono sin anuncios para mostrar.
- **No está** lo que necesita Google o un servidor: compras con dinero, iniciar sesión con Google
  (ranking y logros en línea), el aviso de noticias de `iphonegame.cafe24.com` y los anuncios.
- **Los enlaces** del juego ("calificanos", el ícono de Block Art) se abren afuera, como en el
  teléfono: en otra pestaña, o en el navegador del teléfono desde el APK.
- **No tiene música**: el original tampoco (los tres MP3 del APK no se usan: `SoundClip::loadBgm` no
  se llama nunca y `SoundClip::play` no toca un clip de música). Los efectos están todos.

## Cómo está hecho

- **La traducción.** Cada instrucción ARM64 pasa a una línea de C sobre variables locales (`x0..x30`,
  `v0..v31`); las banderas se calculan sólo donde alguien las lee; las tablas de saltos (`switch` de
  C++) se resuelven siguiendo las constantes por el grafo; las llamadas por puntero (funciones
  virtuales, `std::function`) van por un despacho que conoce todas las funciones. Entre funciones
  sólo viajan los registros que la otra lee. La memoria del `.so` queda en las mismas direcciones,
  así los punteros del juego valen tal cual. 538 funciones, 206.780 instrucciones.
- **La capa** reemplaza a cocos2d sin tocar el juego: los objetos de cocos2d viven en la memoria del
  juego con sus tablas virtuales y los campos donde el código del juego los lee; lo que no ve el
  juego (texturas, letras) va en una tabla aparte. El dibujo recorre la escena como `Node::visit`.
- **El ritmo** es el del original: la lógica corre una vez cada 0,06 s (16,7 por segundo, como el
  `schedule` de `kScene`) y lo que se ve cambia a ese ritmo; la página dibuja sólo cuando hubo una
  vuelta, y el resto de los cuadros no gasta nada.
- **Las imágenes** van cada una aparte en `imagenes.bin` (WebP; sin pérdida cuando pesa casi lo
  mismo: 1162 de 2096) y se acomodan en páginas de 1024×1024 la primera vez que el juego las pide,
  como el original que cargaba cada PNG al usarlo. Mientras se decodifican, el juego espera (como
  cuando el original cargaba en el hilo de GL) en vez de mostrar la pantalla a medias.
- **La protección contra APK modificados**: `bzStateGame::imgLoad` mide tres imágenes
  (`MenuUi[136]`, `[163]` y `[181]`) y, si no tienen el tamaño original, borra el progreso de las
  etapas. La web le da archivos en blanco del tamaño original.
- **Irse al fondo** (otra app, pantalla apagada, cerrar la pestaña) llama a
  `applicationDidEnterBackground`, que guarda la partida: lo mismo que hacía Android.
- **Los toques** van como los mandaba cocos2d en Android (el dedo nuevo, todos al mover, el que se
  levanta). Uno cancelado se manda como soltado: el juego no atiende la cancelación y el botón
  quedaba apretado.
- **El atrás** del teléfono es la tecla atrás del juego: en la partida pausa y sigue; en el menú,
  la ventana "Exit Game" del juego.

## Para un Samsung A02 (y menos peso)

| | original | porteo |
|---|---|---|
| descarga | APK de 52 MB | APK de 5,9 MB · web de 10,2 MB (3,7 MB de imágenes, 3,2 MB de WebAssembly que viajan como 0,5 MB con gzip) · `.html` único de 6,7 MB |
| imágenes | 23 MB de PNG | 3,6 MB de WebP |
| efectos | 6,1 MB de WAV (+ 3 MP3 que no suenan) | 0,55 MB de Opus a 48 kbps |
| memoria de video | — | 36-40 MB en una partida (sólo lo que se usó; todas juntas serían 119 MB) |
| una vuelta del juego / un dibujo | — | 0,5 / 0,4 ms en una PC; 4-6 / 4-5 ms con la CPU 8 veces más lenta |

Una vuelta cada 60 ms que cuesta ~10 ms en un teléfono lento deja la página a 60 cuadros por segundo
con margen. El lienzo no pasa de 1600 px de ancho (el juego es de 960×640).

## Problemas conocidos

- No se probó en un teléfono de verdad ni en Safari; los números de arriba son de Chromium sin GPU
  (SwiftShader) con la CPU frenada.
- Se jugó el modo MAIN (menús, tutorial, la etapa 1 entera hasta los resultados, tienda, opciones,
  pausa) y una prueba "mono" de toques al azar recorrió 16 pantallas en ~70.000 vueltas sin una
  trampa; ZOMBIE, JUMP, DEFENSE y las etapas siguientes corren el mismo código traducido pero no se
  recorrieron destrabados.
- La primera vez que aparece cada imagen el juego espera a que se decodifique (uno o dos cuadros; al
  entrar a una pantalla nueva, algo más). El original hacía lo mismo al cargar cada PNG.
- Lo que va por Google o por un servidor (compras, ranking y logros en línea, noticias) no está.
