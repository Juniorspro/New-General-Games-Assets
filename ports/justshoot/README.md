# Just Shoot · port a un solo HTML

Port personal de la **demo web de Just Shoot**, de **Error Panic** (Memorix101 y MegaZell), gratis y no comercial
(<https://gamejolt.com/games/just-shoot/37700>). Es un mod de *Cube 2: Sauerbraten* que ellos mismos compilaron para
la web con **BananaBread** (Emscripten): instagib en el mapa zoomout contra 5 bots. Acá se le da otra cáscara:

- todo en **un solo HTML** (el motor y los paquetes de datos adentro, en base64 con gzip, ~22 MB);
- sin los requisitos de PC de la demo (texturas DXT y bloqueo del mouse): las DDS pasan a JPG/PNG
  (`herramientas/paquetes.py` saca los archivos de los `.data` de Emscripten, los convierte y los vuelve a juntar);
- intro de JXStudios, idioma (español, inglés, portugués: la página, los avisos del motor y el menú principal);
- **controles de dedo** (palanca, mirar arrastrando, disparar, saltar, tabla y menú) que se mueven, se agrandan,
  cambian de transparencia, se espejan para zurdos y se guardan.

**Acá no hay nada del juego**: ni el motor compilado (`bb.js`), ni los paquetes, ni el HTML armado (`.gitignore`).

## Armarlo

```
# 1. la demo original en descarga/web (index.html, game.html, bb.js, bb.js.mem, game/*.js, *.data; ver la nota)
python3 -I herramientas/paquetes.py extraer descarga/web extraido
python3 -I herramientas/paquetes.py convertir extraido
python3 -I herramientas/paquetes.py armar descarga/web extraido web/datos
mkdir -p web/motor && cp descarga/web/{bb.js,bb.js.mem} descarga/web/game/{gl-matrix.js,zee-worker.js} web/motor/
# 2. armar y probar
UNICO=1 node armar.mjs             # → salida/justshoot.html
node correr.mjs                    # PASOS con eval/foto/tecla/clic/arrastre; TACTIL=1, ARCHIVO=1
```
