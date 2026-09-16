# Telaraña — balancearse por una ciudad, en el navegador

Un juego de un solo botón: colgarse de un hilo, tomar envión y llegar a los
veintiocho orbes antes de que se terminen los dos minutos. No hay escaleras.

**No es Spider-Man.** El personaje es original, generado para esto. El
mecanismo de balancearse no es de nadie; el personaje sí, y hacer un juego con
un personaje de Marvel se cae de un mail. Este se puede publicar.

| | |
|---|---|
| Ciudad | 58 edificios de 15 a 117 m, 24.492 caras, generada por script |
| Personaje | Rezona (Tripo3D) + su riggeador: **41 huesos**, 3 clips |
| Peso total | **6,3 MB** (ciudad 2,3 · héroe 1,7 · cielo 0,6 · orbe 0,13) |
| Motor | three.js 0.160 vendorizado · PBR · HDRI · floración · ACES |

```sh
python3 -m http.server -d juego 8093    # y se abre http://localhost:8093
blender --background --python ciudad.py # regenera la ciudad (2,6 s)
```

## Cómo se hizo

**Los assets salieron de Rezona.** `submit_model3d_generation` para el héroe y
el orbe, y `submit_rig3d_generation` sobre el `task_id` del héroe para el
esqueleto. Los modelos vienen enormes —el héroe 16 MB y 514.073 triángulos, el
orbe 30 MB y 987.966— así que pasan por gltf-transform: el orbe queda en
**130 KB** y el héroe, ya con esqueleto, en **1,7 MB y 28.274 triángulos**.

**La ciudad la genera un script de Blender** con las mismas texturas PBR que ya
estaban en el repo (AmbientCG y compañía). Además del `.glb` escribe un
`ciudad.json` con las cajas de colisión: como todo son cajas alineadas a los
ejes, el rayo del hilo y los choques se resuelven con cuentas, sin tocar la
malla ni cargar una librería de física.

**La física del balanceo** es una cuerda inextensible: si te alejás más que el
largo, te vuelve al radio y te saca la componente radial de la velocidad —una
cuerda tira, no empuja—. Encima va un empujón perpendicular mientras caés, que
es el equivalente a estirar y encoger las piernas en una hamaca, y es lo que
hace que balancearse rinda en vez de amortiguarse hasta parar.

## Las cosas que costaron

1. **El riggeador ignora la lista de animaciones que le pidas.** Le mandé
   `["idle","run","jump","fall","climb"]` y contestó
   `ignored_animations: [las cinco]`: devuelve siempre su juego fijo de
   `walk`, `idle` y `jump`. Para colgarse no hay clip, así que la pose de
   balanceo **está armada a mano**: se buscan los huesos por nombre
   (`R_Upperarm`, `L_Thigh`, `Spine02`…) y se les suma una rotación *después*
   de que el mezclador escribió la pose del clip. El hilo sale del hueso de la
   mano, no de un punto inventado.
2. **Blender se vuelve cuadrático con los operadores.** La primera versión de
   la ciudad creaba cada caja con `primitive_cube_add` y le proyectaba las UV
   con el operador: más de un cuarto de hora sin terminar, porque cada
   operador actualiza el grafo de dependencias entero. Armando las mallas
   directo con `from_pydata` y calculando las UV a mano, **2,6 segundos**.
3. **`--simplify-error` no es un ratio.** Con 0,006 sobre el héroe pasé de
   514.073 triángulos a 1.136: un borrón. Hay que usar el comando `simplify`
   con `--ratio` explícito.
4. **La cámara se metía en las paredes.** Acortar el brazo con un rayo no
   alcanza: si el rayo sale por una esquina, el punto final queda dentro del
   edificio de al lado y se ve media pantalla negra. Hay que comprobar además
   que el punto no esté dentro de ninguna caja, y acercarlo hasta que salga.
5. **Arrancar parado en un techo era un encierro**: el edificio vecino tapaba
   media vista. Ahora se arranca cayendo 28 m arriba del techo más alto, que
   además obliga a lanzar el primer hilo enseguida.

## Los tres formatos

| | Qué es | Cómo se abre |
|---|---|---|
| `juego/` | La versión en carpeta: HTML, JS y assets sueltos. Es la que se edita. | `python3 -m http.server -d juego 8093` |
| `telarana.html` | **Un archivo solo, 6,8 MB.** Todo adentro: three.js, el juego, la ciudad, el héroe y el cielo en base64. | Doble clic. Anda desde el disco. |
| Artifact | La misma partida publicada, con un link para compartir. | El link |

`armar-html.py` arma el archivo suelto a partir de `juego/`. Para que ande
desde `file://` hay un detalle que no es obvio: **los navegadores no dejan
correr módulos ES desde el disco** —`<script type="module">` con origen `null`
queda bloqueado, y con él todos los `import`—. Así que el archivo suelto no
usa módulos: three.js, sus complementos y el juego se empaquetan con esbuild
en **un script clásico de 644 KB**, y los assets viajan en base64 en vez de
pedirse con `fetch`, que desde `file://` también está prohibido.

```sh
npx esbuild main.js --bundle --format=iife --minify --outfile=paquete.js
python3 armar-html.py
```
