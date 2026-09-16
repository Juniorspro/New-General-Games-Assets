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
