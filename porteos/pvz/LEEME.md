# Plantas vs. Zombies (PC, 2009) → móvil

El juego de PopCap corre **con su lógica original y los datos del dueño** en el
navegador y en un APK. No se rehízo nada a mano: el motor es
[PvZ-Portable](https://github.com/wszqkzqk/PvZ-Portable) (reimplementación libre en
C++ con SDL2 + OpenGL ES 2, LGPL-3.0) compilado a WebAssembly, con un parche
nuestro para la versión que llegó.

| archivo | qué es |
|---|---|
| `portear.sh` | del `.rar` (o la carpeta con `main.pak`) a la entrega completa: web, APK, zip y el `.html` único |
| `pvz-portable-1051.patch` | lo que se le cambia al motor (ver abajo). Trae adentro `wasm/libopenmpt-porteo.patch`, el de la biblioteca de música |
| `index.html` | la carcasa web: intro de la marca, partidas en IndexedDB, sonido en segundo plano, atrás, teclado propio, pantalla ancha |
| `prueba.mjs` | la lista de PORTEO.md §9, con dedos de verdad (CDP) y midiendo el estado del juego: intro, teclado propio, pantalla ancha, girado, sin red, el `.html` único |
| `recorrido.mjs` | con la variante de depuración: 31 niveles y minijuegos, cada uno hasta que se juega, sin errores ni recursos faltantes. Con `ANCHO=1020`, con la pantalla ancha |
| `bailarin.mjs` | con la variante de depuración: el bailarín de 2009 en el 2-8, con coristas, brazos y cabezas |

```bash
porteos/pvz/portear.sh "plantas y zombies.rar" entrega-pvz [--un-archivo] [--depuracion]
python3 -m http.server 8831 --directory entrega-pvz/pvz &
node porteos/pvz/prueba.mjs http://127.0.0.1:8831/ file://$PWD/entrega-pvz/pvz.html
# con --depuracion (el motor con los atajos de PopCap; no se entrega):
python3 -m http.server 8832 --directory entrega-pvz/pvz-depuracion &
ANCHO=1020 node porteos/pvz/recorrido.mjs http://127.0.0.1:8832/
node porteos/pvz/bailarin.mjs http://127.0.0.1:8832/
```

## Por qué hizo falta un parche

PvZ-Portable está hecho para la **GOTY** (1.2.0.1073). Lo que llegó es el
**original de 2009** (`PlantsVsZombies.exe` 1.0.0.1051), y con esos datos el motor
se cerraba al arrancar. Las diferencias se midieron cruzando lo que pide el código
(`Resources.cpp`, la tabla de animaciones) con lo que trae el `main.pak`:

1. **Las animaciones vienen sólo compiladas.** El pak de 2009 no tiene los XML de
   `reanim/` ni de `particles/`: trae `compiled/*.compiled`, volcados de memoria de
   32 bits. El motor sólo leía compilados de su propio caché. En WebAssembly
   (32 bits) el formato es el mismo: el hash del esquema que guarda cada archivo
   (`0xb393b4c0` en los reanim) coincide con el que calcula el motor, así que se
   leen directo del pak (`Definition.cpp`).
2. **El bailarín es el de 2009.** PopCap cambió al Dancing Zombie en la GOTY
   ("disco"); el original es `Zombie_Jackson` (y sus coristas, `Zombie_dancer`),
   con otros nombres de pista y de imagen. Se traduce el archivo en la tabla de
   animaciones, las 4 pistas del brazo y las 4 imágenes del brazo caído
   (`Reanimator.cpp`, `Resources.cpp`).
3. **No hay logros, Zombatar ni "más formas de jugar"** (256 recursos que sumó la
   GOTY). No se inventa arte: con los datos de 2009 esas pantallas no existen, como
   en el juego original. El pedestal de logros y el cartel del Zombatar no aparecen
   en el menú, y los logros se anotan en silencio (sin cartel a mitad de partida).
   La pantalla de logros además se dibujaba fuera de cuadro: con la imagen vacía
   eran 15 700 llamadas por cuadro y colgaba el menú.
4. **`porteo_estado()`**: una función que devuelve el estado del juego en JSON
   (pantalla, sol, plantas, zombis, soles en el piso, diálogos, memoria) para que
   las pruebas midan lo que pasa en vez de mirar que no haya errores.
5. **Modo de poca memoria en la web.** El motor ya lo tenía para consolas
   (`LOW_MEMORY`: sonidos bajo demanda, sin la copia en RAM de las texturas ya
   subidas, el pak leído del archivo). Medido: 264 → 206 MB de memoria del módulo y
   "click to start" 0,8 s antes, con los mismos cuadros por segundo; el recorrido
   completo pasa igual. El parche lo prende siempre para la web.

Con datos GOTY, los puntos 1 a 3 no cambian nada: dependen de `gDatosOriginales`,
que se prende sólo si el `resources.xml` no declara el grupo del Zombatar.

## Lo que se le agregó para el teléfono

6. **Pantalla ancha.** El juego es de 800×600: en un teléfono apaisado quedaban dos
   franjas negras enormes. Los fondos del jardín miden 1400 de ancho y el original
   tapa la casa (los 220 píxeles a la izquierda del pasto). Mientras se juega, el
   motor agranda la pantalla hacia la izquierda y la muestra: hasta 1020×600 (17:10).
   La carcasa le dice cuánto entra con `porteo_ancho_extra()`; en una pantalla 4:3
   queda como el original (`LawnApp::AjustarPantalla`).
   - A la derecha no se agranda: los zombis nacen apenas pasando el borde (x 780–880)
     y con más pantalla se los vería aparecer de golpe.
   - Es una cámara: al empezar el nivel el juego mira la casa y se corre a la
     derecha, y la franja de más sigue al tablero sin pasarse del borde del fondo.
   - Los menús, el almanaque, la tienda y los premios siguen en 800×600: están
     dibujados para eso. Las tres cortinas a pantalla completa del tablero (el
     fundido de fin de nivel, el gris del tiempo parado y el negro de las escenas
     de presentación) tapan también la franja (`Board.cpp`).
   - Al elegir plantas, cuando la cámara mira la calle, el selector queda 220
     píxeles corrido. Anda igual y se ve prolijo.
7. **Teclado propio para el nombre.** El del sistema tapaba medio juego, cambiaba
   en cada teléfono y había que re-enfocarlo en cada toque. Ahora, en pantallas
   táctiles, cuando el juego pide texto aparece un teclado con letras y botones de
   piedra, como el cuadro "New User". Tiene letras, 123 (números y signos),
   mayúsculas (la primera sale sola), borrar (se repite manteniendo), espacio, OK
   (Enter) y ✕ (Escape), y vibra al tocar. Escribe directo en las colas del motor
   (`Module.wasmSoftKeyboardState`). El juego se sube lo justo para que el campo
   quede arriba del teclado. Con mouse no aparece: se usa el teclado físico.
8. **La intro de la marca** en lugar de la pantalla verde de carga: la moneda de
   JXStudios de FNaF 2 (`herramientas/porteo/intro.js`), 4,3 s, que se saltea con
   un toque. El motor carga por detrás al mismo tiempo. Si la intro termina antes,
   queda una barra finita sobre negro.

## La carga

El motor original cargaba todo de una vez en el hilo principal: con un teléfono
simulado (CPU ÷4) la pantalla quedaba negra o congelada ~12 s. Medido en Chrome,
mediana de 3 corridas; "antes" es la entrega anterior, título / "click to start":

| | antes | ahora |
|---|---|---|
| web y APK, CPU normal | 1,5 / 5,7 s | 0,8 / 4,3 s |
| web y APK, CPU ÷4 (un teléfono) | 5,9 / 15,1 s | 1,9 / 10,9 s |
| `.html` único, CPU normal | 2,0 / 6,2 s | 0,9 / 4,4 s |
| `.html` único, CPU ÷4 | 10,0 / 19,5 s | 2,6 / 11,6 s |

Con CPU normal el juego queda listo antes de que termine la intro (4,85 s). Lo que
se hizo:

9. **Por partes** (`LawnApp::CargaPorPartes`, una corrutina de C++20). Hace lo
   mismo que el hilo de carga del original, en el mismo orden, de a un recurso por
   vez y 50 ms por cuadro. Mientras tanto se ven el logo de PopCap y el título con
   su barra. La música (dos `mainmusic.mo3` que no se pueden partir) se carga con
   el logo ya quieto, donde la espera no se nota.
10. **Se sacó lo que sobraba**, con el perfilador de Chrome:
    - Cada imagen se buscaba en tres carpetas, con cuatro extensiones y dos nombres
      de alfa. Lo que no está en el pak se buscaba en el disco: ~25 000 consultas
      a MEMFS, 1,2 s con CPU ÷4. Ahora cada carpeta del disco se lee una vez y lo
      que no está ni se pregunta (`PakInterface::PuedeAbrirse`).
    - La música se carga dos veces (melodía y batería) y cada vez se decodificaban
      las mismas 149 muestras Vorbis: 1,5 s con CPU ÷4. `libopenmpt-porteo.patch`
      guarda lo decodificado en la primera carga y la segunda lo copia. Es
      **idéntico byte a byte** (verificado: la segunda carga tarda 34–49 ms en vez
      de 400–540). También compila libopenmpt con `-O3` y no `-Oz`. Ese parche se
      aplica a la versión fijada, 0.8.9.
    - La espera del logo daba vueltas en el lugar 50 ms por cuadro: ahora suelta
      el cuadro.
11. **Las animaciones se siguen precargando todas** (143). Se probó cargarlas
    recién cuando se usan y el 1-5 se cerraba: el juego dibuja 137 imágenes de
    animación (`IMAGE_REANIM_*`) directamente, y una partida guardada puede
    restaurar cualquiera. Se cargan de a una con el título en pantalla.
12. **Asyncify se queda.** Sin él el wasm baja de 8,0 a 5,7 MB y la carga
    ÷4 de 10,8 a 8,7 s. Pero los cuadros de diálogo del juego esperan la respuesta
    con `emscripten_sleep` (`Dialog::WaitForResult`, ~25 lugares) y sin Asyncify
    no andan.

## El `.html` único

`un-archivo.py --al-final main.pak`: **29,4 MB**.

- Va en **UTF-8, de a 7 bits por carácter**. Iba en UTF-16 (24,8 MB: dos bytes del
  archivo por carácter), pero la plataforma donde se suben los juegos lee el archivo
  como UTF-8 y mostraba el código como texto. En base64 serían 33,7 MB.
- El código y el wasm van con gzip.
- `main.pak` va al final, partido en pedazos de 1 MB. Mientras el navegador
  todavía lee la página, el motor ya compila su wasm, y un worker decodifica y
  descomprime el pak en otro hilo. La carcasa lo toma sin copiarlo
  (`__porteoArchivo`, y `FS.writeFile` con `canOwn`).
- Una plataforma puede abrir la página como `blob:`, `data:` o `about:blank`. Los
  archivos se reconocen por el final de la ruta y no con `new URL`, que ahí falla: así
  el juego quedaba en "both async and sync fetching of the wasm failed", escrito en
  13 px gris.
- Si el HTML llega cortado, lo dice en pantalla con cuántas partes llegaron. El "No
  se pudo arrancar" de la carcasa sale en letra grande: es lo que se manda en una
  captura.
- Verificado: el `main.pak` y el wasm que arma la página son idénticos byte a byte a
  los de la carpeta web, abierta del disco, en un iframe `srcdoc` con sandbox, como
  `blob:` y con `document.write`. "click to start" con CPU ÷4: 10,9 s (mediana de
  3; en UTF-16, 10,0 s en la misma máquina: son más caracteres para decodificar).

## Lo que se verificó con el bailarín

Con una compilación de depuración (no se entrega: `-DPVZ_DEBUG=ON` y `-cheat`), en
el 2-8: entra caminando para atrás, señala, llama a sus cuatro coristas con el
reflector, bailan en formación, y con lanzaguisantes pierden brazo y cabeza. Sin
un solo "Can't find track" en el registro y sin asserts.

## Licencias

- El motor es LGPL-3.0: el parche (LGPL también) está acá y el código de base en el
  commit fijado de `portear.sh`. Quien reciba el APK puede rearmarlo con otro motor.
- Los datos (imágenes, sonidos, música, textos) son de PopCap/EA y salen del juego
  del dueño. **No entran al repo** (§11 de PORTEO.md).
