#!/usr/bin/env python3
"""Baja el clipping de un edit sin apagarlo, siguiendo la RECETA.

    python3 corregir_color.py entrada.mp4 salida.mp4

El objetivo medido: clipping < 1 %, saturacion 0.45-0.55, negros ABIERTOS
(p5 cerca de 49, no en 0). Eso ultimo es lo que sorprende: los edits del nicho
no aplastan la sombra, la levantan.

EL ORDEN IMPORTA. Primero se baja el punto blanco, DESPUES se ajusta la
saturacion. Al reves, la saturacion empuja canales contra el techo y el
recorte de blancos ya no los puede recuperar: el detalle se perdio antes.
"""
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()

entrada, salida = sys.argv[1], sys.argv[2]

vf = (
    # 1. techo libre: el blanco baja de 255 a ~232, y la sombra se abre a 18.
    #    El punto 0.5->0.52 sube apenas el medio para que no se vea apagado.
    "curves=all='0/0.07 0.25/0.26 0.5/0.52 0.75/0.77 1/0.91',"
    # 2. recien ahora el color
    "eq=saturation=0.76:contrast=1.02,"
    # 3. un pelo de nitidez, que el recorte de blancos quita percepcion de filo
    "unsharp=5:5:0.45:5:5:0.0,"
    "format=yuv420p"
)

r = subprocess.run(
    [FF, "-y", "-i", entrada, "-vf", vf, "-c:a", "copy",
     "-c:v", "libx264", "-crf", "17", "-preset", "slow", salida],
    capture_output=True, text=True,
)
print("ok" if r.returncode == 0 else "FALLO\n" + r.stderr[-400:])
