#!/usr/bin/env python3
"""De un clip cualquiera al edit terminado, en un comando.

    python3 editar.py mi-clip.mp4 "PRIMERA" "SEGUNDA" "TERCERA"

Hace las tres cosas que hay que hacer antes de renderizar, y que son las que
se olvidan:

1. RECORTE a 9:16 sin deformar, desde el centro.
2. INTERPOLACION a 150 fps. Sin esto la camara lenta va a saltos, porque a
   0,4x cada cuadro de una fuente de 30 fps se repite dos veces y media: el
   reproductor no inventa nada, RETIENE. Y va ANTES de agrandar, porque la
   estimacion de movimiento paga por pixel y a 4K no termina.
3. Deja el archivo en reels/public/ con el nombre que espera la composicion,
   e imprime el comando de render con los tiempos ya calculados.

Despues:  cd reels && npx remotion render EditCompleto out/salida.mp4
"""
import json
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(RAIZ, "reels", "public")

FPS_SALIDA = 60
VELOCIDAD = 0.4
FPS_FUENTE = round(FPS_SALIDA / VELOCIDAD)   # 150


def duracion(v):
    r = subprocess.run([FF, "-hide_banner", "-i", v], capture_output=True, text=True)
    import re
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        raise SystemExit(f"no se pudo leer la duracion de {v}")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def preparar(entrada, salida, desde=0.0, dura=None):
    dura = dura or min(duracion(entrada) - desde, 6.0)
    vf = (
        "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',"
        f"minterpolate=fps={FPS_FUENTE}:mi_mode=mci:mc_mode=obmc:me_mode=bidir,"
        "scale=1080:1920:flags=lanczos,"
        "unsharp=5:5:0.8:5:5:0.0,eq=contrast=1.06:saturation=1.12,format=yuv420p"
    )
    r = subprocess.run(
        [FF, "-y", "-ss", str(desde), "-t", str(dura), "-i", entrada, "-vf", vf,
         "-an", "-c:v", "libx264", "-crf", "17", "-preset", "veryfast",
         "-r", str(FPS_FUENTE), salida],
        capture_output=True, text=True,
    )
    if r.returncode:
        raise SystemExit("fallo la preparacion:\n" + r.stderr[-500:])
    return dura


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    entrada = sys.argv[1]
    textos = sys.argv[2:] or ["PRIMERA", "SEGUNDA", "TERCERA"]

    os.makedirs(PUBLIC, exist_ok=True)
    salida = os.path.join(PUBLIC, "clip_150.mp4")
    dura = preparar(entrada, salida)

    # A 0,4x, `dura` segundos de fuente cubren dura/0,4 de pantalla.
    cuadros = int(dura / VELOCIDAD * FPS_SALIDA)
    paso = cuadros // (len(textos) + 1)
    palabras = [
        {"texto": t, "desde": paso * (i + 1) - paso // 2, "dura": int(paso * 0.9)}
        for i, t in enumerate(textos)
    ]
    props = {
        "clip": "clip_150.mp4", "musica": "", "velocidad": VELOCIDAD,
        "drop": paso * 2, "mascota": "mascota.png",
        "golpes": [paso * i for i in range(len(textos) + 1)],
        "palabras": palabras,
    }

    print(f"\nlisto: {dura:.1f}s de fuente -> {cuadros} cuadros de pantalla\n")
    print("cd reels && npx remotion render EditCompleto out/salida.mp4 \\")
    print(f"  --props='{json.dumps(props)}'")
