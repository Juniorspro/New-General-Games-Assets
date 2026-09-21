#!/usr/bin/env python3
"""Genera el overlay de polvo como bucle corto.

    python3 polvo.py salida/polvo.mp4

DOS COSAS QUE COSTARON:

1. A 30 s pesaba 398 MB. El ruido aleatorio es incompresible: cada cuadro es
   distinto de verdad, asi que el codec no puede predecir nada y guarda todo.
   Con 3 s en bucle pesa kilobytes y a la vista no se nota la repeticion.

2. `geq` evalua una expresion POR PIXEL: sobre 1080x1920 tarda una eternidad.
   `noise` hace lo mismo en el decodificador y sale al instante. El polvo se
   consigue igual: ruido, desenfoque para agrandar los granos, y contraste
   altisimo para quedarse solo con los puntos mas brillantes.
"""
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
salida = sys.argv[1]
os.makedirs(os.path.dirname(salida) or ".", exist_ok=True)

vf = (
    "noise=alls=90:allf=t,"
    "boxblur=3:1,"                       # agranda el grano hasta que sea particula
    "eq=contrast=14:brightness=-0.46,"   # deja solo lo mas brillante
    "boxblur=2:1,"                       # le saca el filo, para que flote
    "eq=brightness=0.015,"
    "format=yuv420p"
)

r = subprocess.run(
    [FF, "-y", "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=3:r=60",
     "-vf", vf, "-t", "3", "-c:v", "libx264", "-crf", "30",
     "-preset", "veryfast", salida],
    capture_output=True, text=True,
)
print("ok" if r.returncode == 0 else "FALLO\n" + r.stderr[-400:])
if r.returncode == 0:
    print(os.path.getsize(salida) // 1024, "KB")
