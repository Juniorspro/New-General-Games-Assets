#!/usr/bin/env python3
"""Sube un clip a mas cuadros por segundo inventando los intermedios.

    python3 interpolar.py entrada.mp4 salida.mp4 [desde] [dura] [fps]

PARA QUE: la camara lenta se ve a saltos cuando la fuente tiene 30 fps. A 0,4x
cada cuadro se repite dos veces y media, y el reproductor no inventa nada:
RETIENE. Para que 0,4x salga fluido a 60 fps de salida hace falta fuente de
60/0,4 = 150 fps, y esos cuadros hay que fabricarlos.

EL ORDEN IMPORTA Y CUESTA CARO: interpolar DESPUES de escalar a 1080x1920
tarda como tres veces y media mas, porque la estimacion de movimiento paga por
pixel. Interpolando a la resolucion original y escalando despues, el resultado
se ve igual y termina. El primer intento a 1080x1920 ni llego a cerrar el
archivo: quedo un mp4 sin moov atom, o sea ilegible.
"""
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()

entrada, salida = sys.argv[1], sys.argv[2]
desde = sys.argv[3] if len(sys.argv) > 3 else "0"
dura = sys.argv[4] if len(sys.argv) > 4 else "2"
fps = sys.argv[5] if len(sys.argv) > 5 else "150"

vf = (
    # 1. recorte a 9:16 EN LA RESOLUCION DE ORIGEN
    "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',"
    # 2. los cuadros inventados, que es lo caro
    f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=obmc:me_mode=bidir,"
    # 3. recien ahora se agranda
    "scale=1080:1920:flags=lanczos,"
    "unsharp=5:5:0.8:5:5:0.0,eq=contrast=1.06:saturation=1.1,format=yuv420p"
)

r = subprocess.run(
    [FF, "-y", "-ss", desde, "-t", dura, "-i", entrada, "-vf", vf, "-an",
     "-c:v", "libx264", "-crf", "17", "-preset", "veryfast", "-r", fps, salida],
    capture_output=True, text=True,
)
print("ok" if r.returncode == 0 else "FALLO\n" + r.stderr[-500:])
