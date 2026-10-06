# Bus Stop Simulator → APK (06/10)

Pidió un port a APK de *Bus Stop Simulator BETA 1.0.1* (Unity 4.5, de Sixten Kastalje y Magnus Jungersen,
GameJolt; nunca se terminó) desde un zip de MediaFire. Dijo "usá Neko PC (Linux con wine)": no hay acceso a
eso y no hizo falta. **Es un juego de otros: nada suyo entra al repo** (ni el descargado, ni lo exportado, ni la
APK, ni los textos de las teles). En `ports/bus-stop/` va solo el código del port y las herramientas.

## Cómo se hizo (sin el editor de Unity)

- **Sacar todo con UnityPy** (`herramientas/exportar.py`, en un venv con `UnityPy`, correr con `python -I`):
  los nodos con sus transformaciones, mallas a un `.bin`, texturas a webp, materiales, luces, cámaras, colliders,
  animaciones (curvas Hermite), audios (a Opus con ffmpeg), el terreno (alturas, pasto, árboles) y los campos de
  los scripts. Unity es de mano izquierda: **z cambia de signo** (posiciones, normales, cuaterniones `(-x,-y,z,w)`)
  y se da vuelta el orden de los triángulos.
- **La lógica, del Assembly-CSharp.dll** con un desensamblador de IL propio (`herramientas/il.py`, con dnfile).
  Lo que dicen los `.ctor` son valores por defecto: **los de verdad están en la escena** (velocidad 4, no 200).
  Los campos de los MonoBehaviour no tienen typetree en el build: se leen crudos (PPtr = 8 bytes en Unity 4.5).
- Trampas: **el arreglo de alturas del terreno va por x** (`H[x·513 + z]`; al revés la calle quedaba en una
  loma); el grass y los árboles sí van por z. El `Terrain` de Unity 4 es un MonoBehaviour del motor. Las
  pendientes infinitas de las curvas (escalón) rompen el JSON: van como 1e30. El texto 3D de Unity 4 se dibuja
  **encima de todo** (el de las teles queda adentro de la tele).

## El juego en three.js (`ports/bus-stop/web/`)

- Luz de Unity 4 en gamma: sin manejo de color, Lambert sin 1/π (parche a `ShaderChunk`) y la caída de sus luces
  `1/(1+25·(d/r)²)`. Los 70 faroles van horneados en un mapa visto desde arriba que suman todos los materiales
  (`conLuzMapa`); las lamparitas son puntos que brillan. Linterna, colectivo: luces de verdad.
- Lo fijo, juntado por material y celda de 200 m (≈72 llamadas). Árboles: la malla hasta 65 m y un cartel cruzado
  más lejos; pasto en carteles alrededor del jugador. Calidad baja/media/alta.
- Física: cápsula contra triángulos de los colliders en grilla de 4 m + el terreno; las calles (planos) son un
  rectángulo; **solo sube escalones si el objeto entero es bajo** (si no, trepaba los postes de a pedacitos).
- La lógica es la del original (ver el comentario de `juego.js`); cambios: agarrar a 2,6 m (era 2), el texto de
  las teles solo de cerca, y un temblor/brillo violeta en las mallas glitcheadas para encontrarlas de noche.
- Pruebas (servidas en un puerto al azar: el 8765 suele estar ocupado): `pruebas/recorrido.mjs` (caminar, juntar,
  el bicho que mata, el colectivo, el final) congela el bucle del juego (`__bus.congelar`) para que no se cruce;
  `pantallas.mjs` (idiomas, ajustes, editor, atrás); dan "Todo bien".

## Armar

`README.md` de `ports/bus-stop/`: bajar el zip, `exportar.py juego/<...>_Data web/datos`, los audios con ffmpeg,
`node herramientas/armar.mjs`, `ANDROID_HOME=… node herramientas/apk.mjs` (el proyecto Android es el de
CONTRAGOLPE: WebView con WebViewAssetLoader, firma de prueba). La APK pesa 6,5 MB.

## Falta

- Probarla en un teléfono de verdad (los FPS con la calidad media, el sonido y el tacto).
