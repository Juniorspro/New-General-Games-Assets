# Slendytubbies V2 Beta · port a HTML

Port no oficial de *Slendytubbies V2 Beta*, de **ZeoWorks** (Sean Toman), hecho en Unity 4.0. Los Teletubbies
son de Ragdoll Productions. Se rearma en three.js desde los archivos del juego: las 11 escenas (el menú 3D,
cooperativo, versus y un jugador de día, al atardecer y de noche, y la de victoria), el terreno con árboles y
pasto, los modelos, los sonidos y la lógica de sus scripts (UnityScript y C#, decompilados). Sale en **un solo
HTML** que abre con doble clic, con controles táctiles, 3 idiomas y el multijugador por un broker MQTT público.

**Acá no hay nada del juego original**: ni el descargado, ni lo exportado, ni los carteles traducidos, ni el
HTML armado. Todo eso es de sus autores y sale de su archivo cada vez (`.gitignore`).

## Armarlo

```
# 1. el juego en juego/ (slendytubbies-v2-beta-bit32-fix.zip); un venv con UnityPy y dnfile; ffmpeg
D="juego/Slendytubbies V2 Beta/Slendytubbies V2 Beta_Data"
python -I herramientas/exportar.py "$D" web/datos     # escenas, mallas, texturas, audio, prefabs (~4 min)
python -I herramientas/gui.py "$D" web/datos          # las imágenes del OnGUI a 1024
python3 -I traduccion/carteles.py                     # (fuera del repo) los carteles en es/pt
# 2. armar y probar
node armar.mjs                     # → dist/ (servido por http)
UNICO=1 node armar.mjs             # → salida/slendytubbies.html (un archivo, ~11 MB)
node correr.mjs                    # pasos con el navegador (PASOS, SEG, RAPIDO=1 sin dibujar, ARCHIVO=1 el HTML único)
node red.mjs                       # cooperativo y versus con dos navegadores y el broker de prueba de aeroplaza/
node pruebas/celu.mjs              # pantalla táctil: menú, E, joystick y linterna
```

La letra de la interfaz (Patrick Hand) y las de los carteles (Creepster, Amatic SC) son libres (OFL) y se bajan
a `traduccion/letras/`.
