#!/usr/bin/env python3
"""Arma la base de 30 s: cortes sobre el beat, ya con el grade de la RECETA.

Se corre desde la raiz del repo. Deja reels/public/base30.mp4 y base30.m4a.

POR QUE LOS CORTES SE HACEN EN FFMPEG Y NO EN REMOTION: con 20 clips
superpuestos, el navegador tiene que decodificar veinte videos a la vez y el
render se arrastra. Concatenando antes, Remotion ve UNA capa de video y solo
pone encima el texto y los destellos. Mismo resultado, una fracción del tiempo.

El corte cae cada 3 pulsos. A 121,2 BPM eso es 1,485 s por plano = 0,67 cortes
por segundo, que es el centro del rango medido para edits (0,6-0,9).
"""
import os
import subprocess
import tempfile

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
R = "docs/paginas/reels"
SALIDA = os.environ.get("SALIDA", "reels/public")

BPM = 121.2
PULSO = 60 / BPM
PLANO = PULSO * 3                 # 1,485 s
N = 20                            # 20 planos = 29,7 s

# De donde sale cada plano: (reel, segundo de inicio). Repartido a mano para
# que no se repita el mismo encuadre dos veces seguidas.
FUENTES = [
    ("western", 2), ("vibras", 8), ("noche", 4), ("euphoria", 14),
    ("halloween", 6), ("western", 12), ("pre5to", 3), ("vibras", 30),
    ("noche", 18), ("euphoria", 40), ("cabina", 5), ("western", 22),
    ("halloween", 20), ("vibras", 52), ("semaforo", 2), ("noche", 32),
    ("euphoria", 60), ("pre5to", 16), ("western", 30), ("vibras", 66),
]

# El grade de la RECETA: techo libre (blanco a ~232), sombra ABIERTA (p5 ~18
# y no 0, que es lo que hacen los edits del nicho), saturacion contenida.
# Va ANTES que cualquier otra cosa: si se satura primero, los canales ya
# tocaron el techo y bajar el blanco despues no recupera el detalle.
GRADE = (
    "curves=all='0/0.07 0.25/0.26 0.5/0.52 0.75/0.77 1/0.91',"
    "eq=saturation=1.02:contrast=1.04,"
    "unsharp=5:5:0.6:5:5:0.0"
)

VF = (f"scale=1080:1920:force_original_aspect_ratio=increase,"
      f"crop=1080:1920,{GRADE},fps=60,format=yuv420p")


def correr(args, nombre):
    r = subprocess.run([FF, "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"{nombre} fallo:\n" + r.stderr[-400:])


if __name__ == "__main__":
    os.makedirs(SALIDA, exist_ok=True)
    tmp = tempfile.mkdtemp()
    trozos = []

    for i, (reel, desde) in enumerate(FUENTES[:N]):
        src = f"{R}/{reel}.mp4"
        if not os.path.exists(src):
            print(f"  falta {src}, salteado")
            continue
        out = os.path.join(tmp, f"p{i:02d}.mp4")
        correr(["-ss", str(desde), "-t", f"{PLANO:.3f}", "-i", src,
                "-vf", VF, "-an", "-c:v", "libx264", "-crf", "16",
                "-preset", "veryfast", out], f"plano {i}")
        trozos.append(out)
        print(f"  plano {i:02d}  {reel} desde {desde}s")

    lista = os.path.join(tmp, "lista.txt")
    with open(lista, "w") as f:
        for t in trozos:
            f.write(f"file '{t}'\n")

    correr(["-f", "concat", "-safe", "0", "-i", lista,
            "-c:v", "libx264", "-crf", "16", "-preset", "medium",
            "-r", "60", os.path.join(SALIDA, "base30.mp4")], "concat")

    # el audio: el tema del que salio la grilla, nivelado para TikTok
    correr(["-t", f"{PLANO * len(trozos):.2f}", "-i", f"{R}/western.mp4",
            "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-c:a", "aac", "-b:a", "192k",
            os.path.join(SALIDA, "base30.m4a")], "audio")

    print(f"\n{len(trozos)} planos · {PLANO * len(trozos):.1f} s · "
          f"{len(trozos) / (PLANO * len(trozos)):.2f} cortes/s")
    print(f"corte cada {PLANO * 60:.0f} cuadros a 60 fps")
