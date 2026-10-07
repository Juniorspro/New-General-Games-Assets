# Clickteam Fusion → web

Corre juegos hechos con Clickteam Fusion (FNaF 1-4, Sister Location, UCN y
miles de fan games) en el navegador, **con su lógica original**: no se rehace el
juego, se ejecutan sus eventos. Probado con FNaF 4 (Android) y con FNaF 2 (el
`juego.json` de otra sesión).

| archivo | qué hace |
|---|---|
| `ccn.py` | lee el `application.ccn` de un APK de Clickteam y escribe `datos/juego.json` + `datos/img/N.webp` + `datos/snd/N.ogg` |
| `motor.js` | el intérprete: eventos con selección de objetos, expresiones, animaciones, movimientos, capas con scroll, contadores, textos, colisiones por máscara, sonido por canales, INI |
| `cobertura.mjs` | cruza lo que usa un juego con lo que el motor implementa, **antes** de jugarlo |
| `plantilla/` | la carcasa web: carga por pantalla, dedo = mouse, teclado, bucle a los fps del juego |
| `armar_web.py` | junta plantilla + motor + datos en una carpeta lista para `pwa.py`, `un-archivo.py` y `armar.py` |

```bash
python3 -I herramientas/clickteam/ccn.py application.ccn extraido/      # ~1,5 min
node herramientas/clickteam/cobertura.mjs extraido/datos/juego.json     # ¿falta algo?
python3 herramientas/clickteam/armar_web.py extraido/ web/ --clave mijuego
```

Ejemplo completo, del APK al APK nuevo: `porteos/fnaf4/portear.sh`.

## Lo que se aprendió del formato (no está documentado en ningún lado)

- Android guarda todo en `res/raw/application.ccn`: cabecera `PAMU` (Unicode) y
  bloques sin comprimir ni encriptar. Los sonidos van aparte, en `res/raw/sNNNN.wav`,
  y el número es el del sonido.
- **Cuadros por segundo: `AppHeader` +104.** Justo antes (+100) está la cantidad
  de pantallas. El port de FNaF 2 de otra sesión leyó un campo antes y quedó con
  "27 cps" (sus 27 pantallas): todo reloj iba 2,2× rápido.
- Objetos con el diseño **viejo** de propiedades (cabecera de 70 bytes) aunque
  el build sea 284, y con **dos campos cambiados de lugar**: el 2.º es la
  extensión y las animaciones van después de los calificadores. Leídos al
  revés, los sprites quedan sin animaciones.
- Capas: paralaje en punto fijo 16.16, no en float.
- Imágenes: zlib con píxeles crudos. Formato 0 = RGBA; formato 3 = RGB con
  filas rellenadas a múltiplo de 4 y sin alfa.
- El parámetro 15 (velocidad) es una expresión, no un número.
- El parámetro de clic (32) lleva en el byte alto la marca de **doble clic**
  (FNaF 4: "Double-Tap here to run to the door!").

## Comportamientos de Clickteam que el motor respeta (y por qué importan)

- **"Fijar coeficiente de transparencia" reemplaza** la transparencia del editor.
  Multiplicadas, el menú de FNaF 4 (que viene al 125/128 y aparece por eventos)
  no pasaba del 2 % de opacidad.
- **El NO vale en todas las condiciones.** "NO mouse apretado" es lo que apaga
  la linterna de FNaF 4 al levantar el dedo.
- "Sólo una vez mientras se repite" y "correr una vez" se deciden **por grupo**.
- Colisiones **por máscara de píxeles** salvo que el objeto pida "por caja".
- Extensiones por **nombre** (`kcini`, `perspective`, `kcclock`): el número de
  tipo cambia de juego en juego.
- Dentro de cada capa, los fondos se dibujan detrás de los demás objetos.
- Al levantar el dedo el "mouse" queda donde estaba, como en el runtime de
  Android: los juegos hechos para Android traen sus eventos de "soltar".
- El audio se crea suspendido al cargar: lo que el juego pide antes del primer
  toque (la música del título) queda en cola en vez de perderse.
- Imágenes: se piden al entrar a cada pantalla y se decodifican al dibujarse.
  Forzar todo serían 365 MB de píxeles en FNaF 4.

## Lo que falta (lo dice `cobertura.mjs` cuando un juego lo usa)

- La extensión **Perspective** (la oficina "curva" de FNaF 2): sin ella se ve plana.
- **Grupos de eventos** activables, valores y cadenas globales, calificadores,
  bucles con nombre: FNaF 2 y 4 no los usan.
- Leer `.exe` de PC: el formato es el mismo con los bloques comprimidos con zlib
  (ya soportado) y, en algunas versiones, encriptados (no soportado).
