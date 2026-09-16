# La PC virtual: escritorio, programas y una IA local

Todo lo de acá está **medido en esta máquina el 2026-09-16**, no estimado.

El contenedor se borra al terminar la sesión, así que nada de esto sobrevive:
hay que volver a correr los dos instaladores en cada sesión nueva.

```bash
herramientas/escritorio/instalar.sh       # ~10 min, ~1,5 GB
source herramientas/escritorio/arrancar.sh
herramientas/ia-local/instalar.sh         # ~6 min, ~2,3 GB
```

## Lo que resultó ser falso del ARRANQUE viejo

El ARRANQUE.md dice que quedan ~2,4 GB y que "acá no se puede compilar un APK".
En esta sesión la máquina mide:

| | medido |
|---|---|
| disco libre | **30 GB** (no 2,4) |
| RAM | 15 GB |
| núcleos | 4 |
| usuario | root, con `apt` funcionando |
| Ubuntu | 24.04.4 |

O sea que el límite de espacio del que habla el ARRANQUE **no aplica acá**. Un
SDK de Android entraría de sobra. No lo probé: lo digo como espacio disponible,
no como que el APK compila.

## El escritorio

No hay pantalla. Xvfb pinta en un framebuffer en memoria, así que **la única
forma de ver algo es sacar una captura**:

```bash
herramientas/escritorio/capturar.sh /tmp/lo-que-sea.png
```

`x11vnc` está instalado, pero **no sirve desde afuera**: el navegador de esta
máquina no llega a hosts externos y nadie de afuera llega acá. Es para conectar
un cliente VNC desde la propia máquina, nada más.

Andando y comprobado abriendo la ventana de cada uno:

| programa | versión | para qué |
|---|---|---|
| Blender | 4.0.2 | modelado 3D, render |
| GIMP | 2.10 | imagen raster |
| Krita | — | pintura digital, sprites |
| Inkscape | 1.2.2 | vectores |
| Audacity | — | audio |
| OpenSCAD | — | 3D por código |
| MeshLab | — | reparar y limpiar mallas |
| Wine | 9.0 (64 y 32 bits) | ejecutables de Windows |

Todos abren **por render de software** (llvmpipe). No hay GPU: Blender
funciona, pero un render pesado va a tardar lo suyo. `arrancar.sh` ya deja
puesto `LIBGL_ALWAYS_SOFTWARE=1`.

## Las trampas que ya se pagaron

### La de libgd3, que es la peor

La imagen trae habilitado el **PPA de `ondrej/php`**, que publica un `libgd3`
más nuevo **sólo para amd64**. `libgd3` es *Multi-Arch: same*: las dos
arquitecturas tienen que estar en la misma versión. Al pedir `wine32:i386`
(que sólo existe en la versión de Ubuntu), apt no puede conciliarlas y contesta:

```
E: Unable to correct problems, you have held broken packages
 libgphoto2-6t64:i386 : Depends: libgd3:i386 but it is not going to be installed
```

Nombra a `libgphoto2`, que no tiene nada que ver. Y lo peor viene si uno
intenta destrabarlo instalando `libgd3:i386` a mano: **apt resuelve el empate
sacando el `libgd3` de amd64, y con él se lleva puestos blender, gimp,
graphviz y el propio wine — con código de salida 0.** El comando "funciona" y
te quedás sin la mitad de los programas. Así se perdieron acá.

El arreglo es un pin, y va **antes** de instalar nada:

```
Package: libgd3
Pin: release o=LP-PPA-ondrej-php
Pin-Priority: 100
```

Está en `instalar.sh` en el orden correcto. Igual, después de cualquier
`apt-get install` grande, conviene comprobar que no se llevó nada puesto:

```bash
grep -cE "^Removing " el.log      # que dé 0
```

### Ollama no entra

Se baja de GitHub Releases y esta sesión tiene GitHub limitado a un solo
repositorio: cualquier otra URL de `github.com` contesta **403** con
*"GitHub access to this repository is not enabled for this session"*. No es el
proxy ni la red — es la política de la sesión, y no se rodea. Por eso la IA
local se compila desde PyPI y el modelo sale de HuggingFace, que sí responden.

### XFCE arranca sin iconos

Con `--no-install-recommends` no entra ningún tema de iconos y el log se llena
de `Failed to look up notification icon`. Los avisos de **AT-SPI** y de
`pm-is-supported` en cambio son normales y no rompen nada: no los persigas.

## La IA local

- Modelo: **Qwen2.5 3B Instruct**, cuantizado Q4_K_M, 2,1 GB.
- Motor: `llama-cpp-python` 0.3.35 compilado acá, en un venv en `/opt/ia`
  (Ubuntu 24.04 tiene PEP 668, un `pip install` a secas se niega).
- **Medido: 6,2 tok/s** con 4 núcleos y sin GPU.

```bash
/opt/ia/bin/python herramientas/ia-local/probar.py "tu pregunta"
```

Sirve para cosas chicas y offline (clasificar, reescribir, generar variantes de
texto de relleno) sin gastar créditos ni salir a internet. Para algo que
requiera calidad, no alcanza: 3B es 3B.
