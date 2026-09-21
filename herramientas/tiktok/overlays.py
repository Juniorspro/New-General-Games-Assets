#!/usr/bin/env python3
"""Genera el paquete de overlays que en TikTok se baja como "plantilla".

    python3 overlays.py salida/            -> los .mp4 del paquete
    python3 overlays.py salida/ base.mp4 final.mp4   -> ademas los aplica

POR QUE GENERARLOS Y NO BAJARLOS: una plantilla de TikTok viene grabada de
pantalla, a 540x960 y recomprimida dos veces. Encima de un edit se le notan
los bloques del codec y el verde sucio del key. Generados salen a 1080x1920
limpios, en el largo exacto que hace falta y con el color que uno quiere.

El paquete:
  fugas.mp4    fugas de luz calidas que cruzan el cuadro
  polvo.mp4    particulas flotando, para dar aire
  grano.mp4    grano de pelicula
  destello.mp4 flash blanco de transicion

Todos en NEGRO sobre negro: se aplican en modo SCREEN, que suma luz y deja el
negro invisible. Por eso no hace falta pantalla verde ni key: el negro puro no
aporta nada al sumar, y el key es justamente lo que ensucia los bordes.
"""
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1080, 1920, 60


def correr(args, nombre):
    r = subprocess.run([FF, "-y", *args], capture_output=True, text=True)
    print(f"  {nombre}: " + ("ok" if r.returncode == 0 else "FALLO\n" + r.stderr[-300:]))
    return r.returncode == 0


def paquete(dest, segundos=30):
    os.makedirs(dest, exist_ok=True)
    d = str(segundos)

    # FUGAS DE LUZ: dos gradientes calidos que cruzan en diagonal a distinta
    # velocidad. El desenfoque fuerte es lo que las hace leer como luz y no
    # como una forma.
    correr(["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:d={d}:r={FPS}",
            "-f", "lavfi", "-i",
            f"gradients=s={W}x{H}:c0=0xff7a1a:c1=0x000000:x0=200:y0=300:"
            f"x1=900:y1=1600:d={d}:r={FPS}:speed=0.06",
            "-filter_complex",
            "[1]boxblur=60:2,eq=brightness=-0.12[g];[0][g]blend=all_mode=screen",
            "-t", d, "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
            os.path.join(dest, "fugas.mp4")], "fugas")

    # POLVO: ruido paso-alto, muy pocas particulas, moviendose despacio.
    correr(["-f", "lavfi", "-i", f"nullsrc=s={W}x{H}:d={d}:r={FPS}",
            "-vf",
            "geq=lum='random(1)*255':cb=128:cr=128,"
            "boxblur=1:1,eq=contrast=9:brightness=-0.47,"
            "boxblur=2:1,eq=brightness=0.02",
            "-t", d, "-c:v", "libx264", "-crf", "22", "-preset", "veryfast",
            os.path.join(dest, "polvo.mp4")], "polvo")

    # GRANO: ruido fino a nivel medio, para modo overlay y no screen.
    correr(["-f", "lavfi", "-i", f"color=c=gray:s={W}x{H}:d={d}:r={FPS}",
            "-vf", "noise=alls=26:allf=t+u,format=yuv420p",
            "-t", d, "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
            os.path.join(dest, "grano.mp4")], "grano")

    # DESTELLO: medio segundo de blanco que cae, para pegar en cada corte.
    correr(["-f", "lavfi", "-i", f"color=c=white:s={W}x{H}:d=0.5:r={FPS}",
            "-vf", "fade=t=out:st=0:d=0.5",
            "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
            os.path.join(dest, "destello.mp4")], "destello")


def aplicar(dest, base, salida):
    """Fugas en screen + polvo en screen + grano en overlay, todo suave."""
    fc = (
        "[1]format=yuv420p[f];"
        "[0][f]blend=all_mode=screen:all_opacity=0.34[a];"
        "[2]format=yuv420p[p];"
        "[a][p]blend=all_mode=screen:all_opacity=0.16[b];"
        "[3]format=yuv420p[g];"
        "[b][g]blend=all_mode=overlay:all_opacity=0.10[c];"
        # el punto blanco NO se toca: el clipping bajo fue lo que mas costo
        "[c]eq=saturation=1.04[v]"
    )
    correr(["-i", base,
            "-i", os.path.join(dest, "fugas.mp4"),
            "-i", os.path.join(dest, "polvo.mp4"),
            "-i", os.path.join(dest, "grano.mp4"),
            "-filter_complex", fc, "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-crf", "20", "-preset", "medium",
            "-c:a", "copy", "-shortest", "-movflags", "+faststart", salida],
           "aplicado")


if __name__ == "__main__":
    dest = sys.argv[1]
    paquete(dest)
    if len(sys.argv) > 3:
        aplicar(dest, sys.argv[2], sys.argv[3])
