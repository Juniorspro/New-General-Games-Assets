#!/usr/bin/env python3
"""Deja el material listo para el edit: la escena corregida y Rick recortado.

Se corre parado en la carpeta donde estan los mp4 bajados de TikTok.
"""
import subprocess

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()


def correr(nombre, args):
    r = subprocess.run([FF, "-y"] + args, capture_output=True, text=True)
    print(nombre, "ok" if r.returncode == 0 else "FALLO\n" + r.stderr[-400:])


# 1) Evil Morty a 1080 cuadrado, con nitidez recuperada.
#
#    La escena YA es amarilla de por si (la remera de Morty, la luz del
#    vagon). Subirle saturacion y contraste como pide la receta del genero la
#    quema: el primer intento salio con todo el cuadro amarillo y sin negros.
#    Por eso acá el contraste es suave, y colorbalance mete azul en las
#    sombras para que el amarillo quede solo donde tiene que estar.
escena = (
    "scale=1080:1080:flags=lanczos,"
    "unsharp=5:5:1.1:5:5:0.0,"
    "colorbalance=rs=-0.06:bs=0.10:rm=-0.02:bm=0.04,"
    "eq=contrast=1.08:saturation=1.05:gamma=0.99,"
    "format=yuv420p"
)
correr("evilmorty", ["-ss", "0", "-t", "9", "-i", "escena.mp4",
                     "-vf", escena, "-an",
                     "-c:v", "libx264", "-crf", "17", "-preset", "slow",
                     "evilmorty.mp4"])

# 2) Rick en verde -> WebM con transparencia de verdad (yuva420p).
#
#    despill con mix alto le come el color a la piel y a la bata: en el primer
#    intento Rick salio gris lavado. Con 0.25 alcanza para sacar el reborde
#    sin desteñirlo, porque el verde de este clip no derrama tanto.
rick = (
    "crop=576:700:0:180,scale=800:-2:flags=lanczos,"
    "colorkey=0x00d000:0.32:0.12,"
    "despill=type=green:mix=0.25:expand=0.10,"
    "eq=saturation=1.15:contrast=1.06,"
    "format=yuva420p"
)
correr("rick_alpha", ["-i", "rick_verde.mp4", "-vf", rick, "-an",
                      "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                      "-crf", "24", "-b:v", "0", "-auto-alt-ref", "0",
                      "rick_alpha.webm"])
