# Baldi's Basics Classic · port a HTML

Port personal y no oficial de *Baldi's Basics Classic* 1.4.3 (gratis, de **Micah McGonigal / Basically Games**,
<https://basically-games.itch.io/baldis-basics>), hecho en Unity 2018.2. Se rearma desde los archivos del juego
sobre un "Unity chiquito" en JS (three.js para el 3D, un canvas 2D para la interfaz): las 7 escenas, la escuela,
los personajes con sus animaciones de sprites, los sonidos y **todos sus guiones pasados de C# a JS tal cual**
(Baldi, el director, Playtime, 1st Prize, Arts and Crafters, Gotta Sweep, It's a Bully, cuadernos, objetos,
puertas, menús). Sale en **un solo HTML** que abre con doble clic, con la intro de JXStudios, 3 idiomas y los
controles de la versión de celular (joystick, pad para girar, botones de usar, objeto, correr y mirar atrás).

**Acá no hay nada del juego original**: ni el descargado, ni lo exportado, ni los C# decompilados, ni los
textos traducidos (`web/js/traduccion.js`), ni el HTML armado. Todo eso es de su autor y sale de su archivo.

## Armarlo

```
# 1. el juego (baldi.zip de itch.io) en descarga/juego; un venv con UnityPy, TypeTreeGeneratorAPI y fmod_toolkit
python -I herramientas/exportar.py descarga/juego/BALDI_Data web/datos   # escenas, mallas, texturas, audio, navmesh (~1 min)
# 2. web/js/traduccion.js (fuera del repo): los textos del juego en español y portugués
node armar.mjs                     # → dist/ (servido por http)
UNICO=1 node armar.mjs             # → salida/baldi.html (un archivo, ~14 MB)
node correr.mjs                    # pasos con el navegador (PASOS, SEG, TACTIL=1, ARCHIVO=1 el HTML único)
```

## Cómo está hecho

- `motor.js`/`mundo.js`: Nodo (GameObject + Transform), componentes con su ciclo de Unity, corrutinas con
  generadores, Instantiate/Destroy, escenas, PlayerPrefs. La lógica corre en el espacio de Unity; al dibujar,
  matriz de three = S·M·S (z dado vuelta).
- `fisica.js`: colliders, CharacterController, rayos de una cara y disparadores. `nav.js`: el navmesh de Detour
  con A* y embudo, NavMeshAgent. `render.js`: lotes estáticos por celda, InstancedMesh para lo repetido, las
  grillas de 10×10 a dos triángulos. `ui.js`: uGUI y TextMeshPro (la letra de mapa de bits glifo por glifo).
- `guiones/escuela.js` y `guiones/menus.js`: los guiones del juego.
