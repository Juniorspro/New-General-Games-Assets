# Blender adentro de la PC virtual

Blender **4.3.2** (el de Debian trixie) corriendo en el Neko, sin GPU, sobre
llvmpipe. `casita.py` arma la casita lowpoly con datos de malla en vez de a
mano, así el resultado es el mismo cada vez que se corre.

| | |
|---|---|
| Geometría | 43 objetos · **332 caras** · 366 vértices |
| Render | Cycles CPU, 160 muestras, 1100x750 |
| Tiempo | **1 min 39 s** (4 núcleos, 3 m 36 s de CPU) |
| `casita.glb` | 72 KB |

```sh
docker exec neko-prueba apt-get install -y --no-install-recommends blender python3-numpy
docker exec -u neko neko-prueba blender --background --python casita.py     # arma y renderiza
docker exec -d -u neko -e DISPLAY=:99.0 neko-prueba blender casita.blend    # la interfaz
```

## Lo que hay que saber

1. **Este Blender viene sin OpenImageDenoise.** `use_denoising = True` no
   avisa al configurar: revienta recién al renderizar, con
   `RuntimeError: Failed to denoise, build has no OpenImageDenoise support`,
   y se lleva puesto el render entero. Se apaga y se compensa con más
   muestras (48 con denoise ≈ 160 sin él).
2. **`numpy` no viene con el paquete**, y sin él el exportador de glTF tira
   `ModuleNotFoundError` al exportar. `apt-get install python3-numpy`.
3. **La interfaz anda, pero Material Preview tarda.** EEVEE Next tiene que
   compilar sus shaders en llvmpipe: la primera vez que se toca el modo,
   Blender se queda **unos dos minutos** sin repintar —ni el tooltip se
   borra— y parece colgado. No lo está: después aparece todo en color y se
   mueve normal. En modo Solid es instantáneo desde el arranque.
4. Draco avisa que no está (`libextern_draco.so`); el GLB sale igual, sin
   comprimir.

---

# La animación: `pelota.py`

Una pelota que rebota cuatro veces y cruza el cuadro, con squash & stretch.
60 cuadros a 24 fps — dos segundos y medio.

```sh
docker exec -u neko -e MOTOR=CYCLES -e MUESTRAS=64 -e ANCHO=800 -e ALTO=450 \
  -e DESDE=1 -e HASTA=60 -e RENDERIZAR=1 -e SALIDA=/tmp/pelota/f_ \
  neko-prueba blender --background --python /tmp/pelota.py
docker exec -u neko neko-prueba blender --background --python /tmp/armar_video.py
```

El motor, las muestras, el tamaño y el rango salen del entorno **para poder
medir un cuadro suelto antes de largar los sesenta**. En CPU sin GPU, elegir
mal cuesta una hora.

| | |
|---|---|
| Geometría | pelota de 48x24 + 3 conos + piso |
| Render | Cycles CPU, 64 muestras, 800x450, sin denoise |
| Por cuadro | **6,5 s** (24 muestras a 640x360: 1,75 s) |
| Los 60 cuadros | ~6 min 30 s |
| `pelota.mp4` | 126 KB, H.264 |

## Lo que costó encontrar

1. **El origen de la pelota va en el polo sur, no en el centro.** Con el origen
   en el centro, escalar en Z para el squash hunde la pelota medio radio y
   atraviesa el piso justo en el cuadro que más se mira. Se baja con
   `mesh.transform(Matrix.Translation((0,0,R)))` y después `location.z = 0`.
2. **La curva de altura necesita asas `VECTOR` en el toque.** Una parábola que
   rebota tiene una esquina ahí; con asas suaves (`AUTO`) la pelota parece
   flotar sobre el piso en vez de golpearlo. En la cima sí va `AUTO`.
3. **Blender 4.3 mapea con AgX y desatura fuerte.** El naranja
   `(0.95, 0.35, 0.10)` salía durazno pálido. `look = "AgX - Punchy"` le
   devuelve la saturación sin quemar las luces, que es lo que pasa con el
   transform `Standard`. El nombre del look cambió entre versiones: va con
   `try/except`.
4. **El encuadre no se calcula, se mide.** La pelota va en `y=0` y los conos en
   `y=2.4`: al estar más cerca de la cámara, la pelota se abre mucho más hacia
   los bordes. Con un recorrido de ±5 quedaba cortada por el borde derecho en
   los últimos diez cuadros **aunque el cono de x=3.4 se viera entero**. Quedó
   en ±3.6 con lente de 44 mm, comprobado renderizando los cuadros 1 y 60.
5. **No hay ffmpeg**, ni en el contenedor de la sesión ni en el Neko. Pero
   Blender trae su propio codificador: `armar_video.py` lee los PNG con el
   editor de video y los codifica en segundos. Volver a renderizar con salida
   `FFMPEG` costaría los 6 minutos y medio de nuevo.

---

# El árbol: `arbol.py`

Un árbol lowpoly armado con la misma receta que `casita.py`: datos de malla y
semilla fija (`random.Random(7)`), así sale siempre el mismo árbol.

```sh
docker exec -u neko -e MUESTRAS=128 -e ANCHO=1000 -e ALTO=750 -e SALIDA=/tmp \
  neko blender --background --python /tmp/arbol.py
```

| | |
|---|---|
| Geometría | 28 objetos · **628 caras** · 485 vértices |
| Render | Cycles CPU, 128 muestras, 1000x750, sin denoise |
| Tiempo | **27 s** (4 núcleos) |
| `arbol.png` | 919 KB |

El tronco y las ramas salen de la misma función, `tubo()`: una rama es un
tronco que empieza más arriba y sale torcida. Los anillos se cosen de a dos.

## Lo que costó encontrar

1. **Las ramas cortas no existen.** Con ramas de 1,0-1,3 la copa se las comía
   enteras y el árbol quedaba como un brócoli con palito. Recién a 1,6-2,3 la
   silueta se abre y se ven. Es lo que más cambió el resultado.
2. **Un solo verde se ve de cartón.** Van tres, alternados por bola.
3. **`LADOS = 7`, impar a propósito.** Con 8 las facetas quedan simétricas y el
   tronco parece un tubo industrial.
4. **El sombreado plano no es un detalle, es el estilo.** Con `use_smooth` las
   facetas desaparecen y queda un choclo de plástico.
5. **El encuadre se mide, no se calcula** — igual que en `pelota.py`. Tres
   pasadas a 400x300 y 8 muestras (10 s cada una) para llegar al encuadre: con
   lente 52 la copa se salía por la izquierda; a 1000x750 el tronco quedaba sin
   pie y hubo que bajar el punto al que mira la cámara. Probar el encuadre en
   chico cuesta 10 s; equivocarse en grande cuesta 27.
6. Este Blender sigue **sin OpenImageDenoise** (ver arriba): denoise apagado y
   se compensa con muestras. A 128 no queda ruido visible.
