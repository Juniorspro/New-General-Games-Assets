# JX-1: la consola portátil de JXSTUDIOS y su animación de 13 segundos

Una consola de bolsillo propia: retrato, pantalla arriba, cruz, A y B, SELECT y
START, como todas las portátiles clásicas, pero con forma, colores y marca
nuestros (crema, marco carbón, botones coral, rayitas coral y teal, el
cartucho de GRUMO asomando atrás). No lleva nada de Nintendo: ni nombre, ni
logos, ni el sonido de arranque.

| archivo | qué hace |
|---|---|
| `pantalla.py` | los 312 cuadros de 160x144 de la pantallita (4 tonos): JXSTUDIOS se arma de pixeles, un nivel de Grumo y el cartel de PRESS START; deja `eventos.json` con los cuadros de cada cosa |
| `escena.py` | la consola, el estudio (piso curvo, luces de colores, pixeles flotando), la cámara y el render. Modos: `vista` (chiquito, CPU), `final` (1080x1920, GPU), `foto` (2160x3840) |
| `sonido.py` | el sonido, sintetizado y sincronizado con `eventos.json` |
| `kaggle_render.py` | arma el notebook de Kaggle con todo adentro y lo deja listo para `kaggle kernels push` |

```sh
python3 pantalla.py lcd
blender -b --factory-startup -P escena.py -- vista lcd vista 1,100,175,312   # mirar, en la CPU
python3 kaggle_render.py /tmp/jx1 <usuario>
kaggle kernels push -p /tmp/jx1 --accelerator NvidiaTeslaT4
python3 sonido.py lcd/eventos.json sonido.wav
ffmpeg -i jx1_maestro.mp4 -i sonido.wav -vf "vignette=PI/5,noise=alls=3:allf=t" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest jx1.mp4
```

## Lo que hay que saber
- Se modela en centímetros dentro de un vacío escalado a 0,01: la cámara, las
  luces y el foco quedan en metros y la profundidad de campo es la de una foto
  macro de verdad. El foco va pegado a la consola: si gira, sigue a la pieza.
- La pantalla es una secuencia de imágenes con interpolación `Closest` y una
  grilla de pixeles hecha con nodos; arriba lleva una capa brillante (el vidrio).
- El nodo Mix de color tiene varias entradas que se llaman "A": por nombre se
  agarra la que no es. Para multiplicar color por un número, `VectorMath SCALE`.
- `round()` de Python redondea los .5 al par: una figura que cae en medio pixel
  sale rayada. En el dibujo de pixeles, `floor(x + 0.5)` y cámara de a pixel.
- Los agujeros del parlante se cortan después del bisel; con el bisel encima
  se deformaban.
- La vista previa (270x480, 24 muestras, CPU de 4 núcleos) tarda unos 8 s por
  cuadro: alcanza para mirar encuadre, luz y color antes de gastar GPU.
