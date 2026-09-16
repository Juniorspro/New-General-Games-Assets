#!/usr/bin/env python3
"""Saca fotogramas de un video y los arma en una hoja de sprites.

    python3 extraer_cuadros.py assets/escena_hongo-g1.mp4 assets/escena/hongo.webp 4 6

EL PRIMER INTENTO FUE CON EL NAVEGADOR Y NO FUNCIONA. Un <video> con
`currentTime` puesto a mano y un drawImage a un lienzo es un extractor de
fotogramas completo, salvo por un detalle que se midio: el Chromium que trae
Playwright viene SIN codecs propietarios. `canPlayType("video/mp4; codecs=
avc1")` devuelve cadena vacia y el video tira DEMUXER_ERROR_NO_SUPPORTED_
STREAMS. VP9 si puede, pero el servidor entrega H.264.

Asi que ffmpeg. No viene en la maquina, pero `pip install imageio-ffmpeg` baja
un binario estatico y listo — es una herramienta de construccion, no entra al
juego ni al archivo que se reparte.
"""
import io, math, pathlib, subprocess, sys

from PIL import Image

try:
    import imageio_ffmpeg
except ImportError:
    raise SystemExit("falta imageio-ffmpeg: pip install imageio-ffmpeg")

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def duracion(ruta):
    r = subprocess.run([FFMPEG, "-i", str(ruta)], capture_output=True, text=True)
    for linea in r.stderr.splitlines():
        if "Duration:" in linea:
            hms = linea.split("Duration:")[1].split(",")[0].strip()
            h, m, s = hms.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise SystemExit("no se pudo leer la duracion del video")


def cuadro(ruta, t, ancho):
    """Un fotograma en el segundo `t`, como PIL.Image."""
    r = subprocess.run(
        [FFMPEG, "-ss", f"{t:.3f}", "-i", str(ruta), "-frames:v", "1",
         "-vf", f"scale={ancho}:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
        capture_output=True)
    if not r.stdout:
        raise SystemExit(f"ffmpeg no devolvio nada en t={t}: {r.stderr[-300:]!r}")
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")


def main():
    if len(sys.argv) < 3:
        raise SystemExit("uso: extraer_cuadros.py <video> <salida.webp> [cols] [filas]")
    video = pathlib.Path(sys.argv[1])
    salida = pathlib.Path(sys.argv[2])
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    filas = int(sys.argv[4]) if len(sys.argv) > 4 else 6
    n = cols * filas
    dur = duracion(video)

    # El ancho de celda sale de la pantalla: en vertical el lienzo mide 416 px
    # de ancho (208 de juego por 2 de supermuestreo). Mas grande es peso de
    # mas que nadie ve.
    # Se saca al DOBLE de lo que se va a mostrar y despues lo achica
    # pixelar.py. Sacandolo ya en la medida final, el unico remuestreo es el de
    # ffmpeg —que promedia— y los bordes quedan con medios tonos; sacandolo
    # grande, el achique lo hace el pixelador con su prefiltro y su NEAREST, que
    # es lo que produce bordes limpios de un pixel.
    ANCHO = 448
    # Se deja afuera el ultimo 4%: los generadores suelen cerrar con un
    # fundido, y un fotograma negro al final se ve como un parpadeo.
    tiempos = [(dur * 0.96) * (i / (n - 1)) for i in range(n)]
    cuadros = [cuadro(video, t, ANCHO) for t in tiempos]
    cw, ch = cuadros[0].size

    hoja = Image.new("RGB", (cw * cols, ch * filas))
    for i, im in enumerate(cuadros):
        if im.size != (cw, ch):
            im = im.resize((cw, ch), Image.LANCZOS)
        hoja.paste(im, ((i % cols) * cw, (i // cols) * ch))
    salida.parent.mkdir(parents=True, exist_ok=True)
    # Calidad alta: esta hoja es un PASO INTERMEDIO, no lo que se reparte.
    # Comprimirla fuerte aca le mete ruido que despues el pixelador convierte
    # en pixeles de colores equivocados, y esos ya no se sacan.
    hoja.save(salida, "WEBP", quality=95, method=6)
    print(f"video {dur:.2f} s · {n} cuadros de {cw}x{ch} · hoja {hoja.width}x{hoja.height}")
    print(f"→ {salida} ({salida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
