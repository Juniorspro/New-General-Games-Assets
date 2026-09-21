#!/usr/bin/env python3
"""Corta tres trozos de los reels propios para la demo de tecnica.

Se corre parado en la raiz del repo. Deja t1/t2/t3 en reels/public/.

Cada trozo sale LARGO a proposito: la composicion los reproduce a 0,4x, asi
que 4 segundos de origen cubren 10 de pantalla. Si salieran cortos, la camara
lenta se quedaria sin material y el ultimo cuadro se congelaria.
"""
import os
import subprocess

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SALIDA = os.environ["SALIDA"]
R = "docs/paginas/reels"

TROZOS = [
    (f"{R}/euphoria.mp4", 12, 12, "t1.mp4"),
    (f"{R}/halloween.mp4", 6, 10, "t2.mp4"),
    (f"{R}/vibras.mp4", 4, 10, "t3.mp4"),
]

vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"

for src, ss, dur, nombre in TROZOS:
    r = subprocess.run(
        [FF, "-y", "-ss", str(ss), "-t", str(dur), "-i", src, "-vf", vf, "-an",
         "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
         os.path.join(SALIDA, nombre)],
        capture_output=True, text=True)
    print(nombre, "ok" if r.returncode == 0 else r.stderr[-300:])
