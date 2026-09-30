# La isla — lo que dejó (el juego se borró el 30/09/2026)
El código sigue en el historial: `git show fbffdfb:isla/<ruta>` (o `git checkout fbffdfb -- isla` para traerla entera). Ver también: [juegos](juegos.md), [juegos-3d](juegos-3d.md), [probar](probar.md).

## Qué era
- La isla de Phoenix Baker (@vfx843) rehecha en HTML: talar, minar, pescar, construir, mina, faro con historia en seis capítulos, enemigos, mercader; 60/60 pruebas y un solo HTML de 1138 KB (29/09/2026).
- El menú de @brutu_scripts (Roblox) al estilo playa: **el que pidió para los juegos nuevos**. → `isla/js/menu.js`

## Lo que sirve para otros juegos
- Menú con cámara que se mece: tope 18°, vaivén 1,5° con seno y coseno, velocidad 3; el texto DOM se inclina con la misma inclinación; los carteles son `CanvasTexture` y un clic es un rayo a la cara → `uv` → coordenada del lienzo. → `isla/js/menu.js`
- Pixel art en 3D sin post: cada fragmento se corre al centro de su texel en el mundo (derivadas). → `isla/js/material.js › hastaCentro`
- Física por un intermediario que decide por la ALTURA del que pregunta, no por dónde está el jugador. → `isla/js/main.js › fisica`
- Guardar solo lo que cambió contra la semilla (4,2 KB). → `isla/js/guardado.js`
- Jugar acostado con el teléfono parado: `#app` con `rotate(90deg) translateY(-100%)`, dedos por `aApp` (x = clientY, y = ancho − clientX), unidades `--vw/--vh` propias. → `isla/js/pantalla.js`
- Enemigos con una sola máquina (pasear → cazar → cargar → golpe → pausa); parada de golpe de 50 ms que congela arma y enemigos pero no al jugador. → `isla/js/enemigos.js`, `combate.js`
- Objetivos que no se traban: el actual es el que sigue al más adelantado ya cumplido. → `isla/js/historia.js › revisar`
- Empaquetador con orden topológico sacado de los `import`. → `isla/empaquetar.py`

## Trampas pagadas (29/09/2026)
- Un parámetro tapado por el `for (let k…)` de adentro: la isla quedó cubierta de hojas gigantes.
- `undefined <= 0` da `false`: un campo sin inicializar dejaba a los enemigos sin cazar nunca.
- Con el puntero capturado un clic no llega al DOM: las capas (carta, mapa) tienen que soltarlo.
- `matPixel` guardaba por `clave`: dos colores con la misma clave, gana el primero.
- En piedra clara, un `borde` alto multiplica el color y deja las aristas blancas.
