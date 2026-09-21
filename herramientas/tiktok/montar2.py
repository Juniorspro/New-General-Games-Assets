#!/usr/bin/env python3
"""Segunda version del montaje, corregida con lo que dijeron 20 edits medidos.

QUE CAMBIO Y POR QUE (todo sale del corpus de estudio/medidas.txt):

1. FORMATO 1:1, no 9:16. 14 de 20 edits del nicho son cuadrados, y los dos que
   mas rinden (1,8 M y 2,6 M de likes) son 720x720 y 1080x1080. Ademas es lo
   que salva la imagen: de una fuente 4:3 el 9:16 se lleva 404 px de 960 y hay
   que estirar 2,67x; el 1:1 se lleva 720 y estira 1,5x.

2. GRADE OSCURO, no levantado. La RECETA vieja (n=5) pedia p5 49 / mediana 113
   / p95 205 / saturacion 0,51. Con n=20 la mediana real del nicho es p5 4,1 /
   mediana 39,7 / p95 161 / saturacion 0,26, y los dos que mas rinden estan en
   p5 0,6-11 y saturacion 0,25-0,27. O sea: negros CERRADOS y DESATURADO. El
   material crudo ya esta ahi (p5 2,2 / mediana 37,7 / sat 0,405): hay que
   tocarlo poco, y para ABAJO en saturacion, no para arriba.

3. GRILLA DE BEATS REAL, de la pista, no sintetica. El phonk CC0 va a 120,19
   BPM con la negra en 499,2 ms y el primer golpe a los 55 ms; el drop esta a
   los 47,93 s (la energia por compas salta de 0,6 a 1,0). El montaje se cuelga
   de ahi: 16 golpes de subida, el drop, 24 de cuerpo, 4 de cola.

4. SACUDIDA en los cortes del drop. Sale del corpus: es lo que separa un edit
   de phonk de una sucesion de planos. Se hace moviendo la POSICION del recorte
   cuadro a cuadro — el tamano no se puede animar, la salida tiene que ser fija.
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SP = os.environ.get("EDIT_DIR", os.getcwd())
FUENTE = os.path.join(SP, "edit", "crudo", "catsconcept.mp4")
PISTA = os.path.join(SP, "musica", "phonk_cc0.mp3")
SALIDA = os.path.join(SP, "edit2", "seg")

NEGRA = 0.49923                      # medido con beats.py sobre la pista
FASE = 0.055
GOLPE_INICIO = 80                    # el edit arranca en este golpe de la pista
GOLPE_DROP = 96
FPS = 30
LADO_FUENTE = 720                    # el cuadrado que entra en un 4:3 de 960x720
ANCHO_FUENTE = 960
LADO = 1080

GRADE_BASE = "eq=gamma={g}:contrast={c}:brightness={b}:saturation={s},unsharp=5:5:1.0:5:5:0.0"

# (plano, desde_dentro, golpes, velocidad, sacudir)
GUION = [
    # subida: blanco y negro, lento, 4 golpes cada uno
    (28, 0.03, 4, 0.50, False),
    (31, 0.08, 4, 0.50, False),
    (29, 0.02, 4, 0.40, False),
    (30, 0.02, 4, 0.33, False),
    # EL DROP: entra el color, tiempo real, 2 golpes cada uno, con sacudida
    (13, 0.30, 2, 1.0, True),
    (18, 0.35, 2, 1.0, True),
    (20, 0.20, 2, 1.0, True),
    (22, 0.25, 2, 1.0, True),
    (15, 0.20, 2, 1.0, True),
    (25, 0.05, 2, 1.0, True),
    (11, 0.25, 2, 1.0, True),
    (2,  0.00, 2, 1.0, True),
    (6,  0.20, 2, 1.0, True),
    (4,  0.40, 2, 1.0, True),
    (13, 1.35, 2, 1.0, True),
    (20, 1.20, 2, 1.0, True),
    # cola: vuelve el blanco y negro
    (31, 0.08, 4, 0.50, False),
]


def cargar(nombre, cols):
    d = {}
    for linea in open(os.path.join(SP, nombre)):
        p = linea.split()
        if len(p) >= cols:
            d[int(p[0])] = [float(x) for x in p[1:cols]]
    return d


def filtros(x, vel, sacudir, grade, cuadros):
    """La cadena de un segmento. El orden importa y esta explicado en RECETA.md."""
    pasos = []
    if sacudir:
        # se recorta 40 px mas chico y se mueve la VENTANA: asi la sacudida no
        # muestra borde negro. El tamano de salida queda fijo, que es obligatorio.
        m = 40
        lado = LADO_FUENTE - 2 * m
        # golpe fuerte los primeros 5 cuadros y se apaga
        amp = f"{m}*exp(-9*t)"
        pasos.append(
            f"crop={lado}:{lado}:"
            f"'{x+m}+{amp}*sin(60*t)':'{m}+{amp}*cos(74*t)'")
    else:
        pasos.append(f"crop={LADO_FUENTE}:{LADO_FUENTE}:{x}:0")
    if vel != 1.0:
        pasos += [f"setpts={1/(vel*0.93):.5f}*PTS",
                  f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=obmc:me_mode=bidir"]
    pasos += [f"scale={LADO}:{LADO}:flags=lanczos", grade,
              # golpe de zoom: 8%, se apaga en ~0,25 s. Sin filtro `fps` detras.
              f"zoompan=z='if(lte(on,1),1.08,max(1.001,zoom-0.008))':d=1"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={LADO}x{LADO}:fps={FPS}",
              "setsar=1", "format=yuv420p"]
    return ",".join(pasos)


def main(grade, destino_dir=None, con_grade=True):
    global SALIDA
    if destino_dir:
        SALIDA = destino_dir
    planos = cargar("planos.txt", 4)
    centros = cargar("centros.txt", 2)
    os.makedirs(SALIDA, exist_ok=True)

    tareas = []
    for k, (plano, dentro, golpes, vel, sacudir) in enumerate(GUION):
        d0, d1, _ = planos[plano]
        cuadros = round(golpes * NEGRA * FPS)
        pantalla = cuadros / FPS
        fuente = pantalla * vel + (0.0 if vel != 1.0 else 0.12)
        t0 = d0 + dentro
        if t0 + fuente > d1 - 0.02:
            t0 = max(d0, d1 - 0.02 - fuente)
        cx = centros.get(plano, [0.5])[0] * ANCHO_FUENTE
        x = int(min(max(cx - LADO_FUENTE / 2, 0), ANCHO_FUENTE - LADO_FUENTE)) // 2 * 2
        vf = filtros(x, vel, sacudir, grade if con_grade else "null", cuadros)
        dst = os.path.join(SALIDA, f"{k:02d}.mp4")
        tareas.append((k, plano, x, cuadros, sacudir, [
            FF, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{t0:.3f}", "-t", f"{fuente:.3f}", "-i", FUENTE,
            "-vf", vf, "-an", "-r", str(FPS), "-frames:v", str(cuadros),
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", dst]))

    def correr(t):
        k, plano, x, cuadros, sac, cmd = t
        r = subprocess.run(cmd, capture_output=True, text=True)
        return (f"{k:02d}  plano {plano:2d}  x={x:3d}  {cuadros:3d} cuadros"
                f"{'  sacude' if sac else '        '}  "
                f"{'ok' if r.returncode == 0 else 'FALLO ' + r.stderr[-200:]}")

    with ThreadPoolExecutor(max_workers=4) as ex:
        for l in ex.map(correr, tareas):
            print(l)

    with open(os.path.join(SALIDA, "lista.txt"), "w") as f:
        for k in range(len(GUION)):
            f.write(f"file '{os.path.join(SALIDA, f'{k:02d}.mp4')}'\n")
    total = sum(round(g * NEGRA * FPS) for _, _, g, _, _ in GUION) / FPS
    print(f"\ntotal {total:.3f}s  |  {len(GUION)-1} cortes = "
          f"{(len(GUION)-1)/total:.2f} cortes/s  |  musica desde "
          f"{FASE + GOLPE_INICIO*NEGRA:.3f}s, drop a los "
          f"{(GOLPE_DROP-GOLPE_INICIO)*NEGRA:.3f}s del edit")
    return total


if __name__ == "__main__":
    g = sys.argv[1] if len(sys.argv) > 1 else GRADE_BASE.format(g=1.0, c=1.0, b=0.0, s=1.0)
    main(g, con_grade="--sin-grade" not in sys.argv)
