#!/usr/bin/env python3
"""Montaje colgado de la grilla ABSOLUTA de una pista real.

    EDIT_DIR=. python3 montar3.py

QUE RESUELVE, y por que no alcanzaba montar2.py:

Un compas a 145,58 BPM son 1,648578 s = 49,457 cuadros a 30 fps. No es entero.
Si cada plano se redondea por separado, el error se SUMA: en montar2.py eran
3 ms por plano y 34 ms al final — tolerable en 22 s, no en un edit largo.
Aca los cortes se calculan como TIEMPOS ABSOLUTOS de la grilla y recien
despues se pasan a cuadros: el error de cada corte queda acotado a medio
cuadro (16,7 ms) y NO se acumula.

LA PISTA (medida con beats.py sobre el audio que mando el usuario):
  145,58 BPM  ·  negra 412,1 ms  ·  compas 1,6486 s
  compases 1-6  groove parejo          -> se loopea
  compas 7      empieza a bajar
  compas 8      break, y un golpe al maximo a los 12,776 s
La pista montada es groove x2 + break + golpe = 23,311 s.

LA ESTRUCTURA sigue a la musica, no al reves:
  golpes  0-23   primera vuelta del groove -> blanco y negro, un plano por compas
  golpe  24      LA VUELTA DEL LOOP: entra el color
  golpes 24-35   color, un plano por compas
  golpes 36-47   color, un plano cada 2 negras, con sacudida
  golpes 48-54   el break -> un plano largo, otra vez en blanco y negro
  golpe  55      EL GOLPE -> corte seco a color
"""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SP = os.environ.get("EDIT_DIR", os.getcwd())
FUENTE = os.path.join(SP, "edit", "crudo", "catsconcept.mp4")
PISTA = os.path.join(SP, "musica", "pista_final.m4a")
SALIDA = os.path.join(SP, "edit3", "seg")

BPM = 145.58
NEGRA = 60.0 / BPM
FPS = 30
FIN = 23.311469
LADO_FUENTE, ANCHO_FUENTE, LADO = 720, 960, 1080

GRADE = ("eq=gamma=1.3:contrast=1.35:brightness=0.02:saturation=0.8,"
         "colorlevels=romax=0.97:gomax=0.97:bomax=0.97,unsharp=5:5:1.0:5:5:0.0")

# (golpe_de_corte, plano, desde_dentro, monocromo, sacudir)
GUION = [
    # primera vuelta del groove: blanco y negro, un plano por compas
    ( 0, 28, 0.03, True,  False),
    ( 4, 31, 0.08, True,  False),
    ( 8, 29, 0.02, True,  False),
    (12, 30, 0.02, True,  False),
    (16, 18, 0.30, True,  False),   # color pasado a B/N: no hay mas material B/N
    (20, 22, 0.20, True,  False),
    # vuelve el loop: ENTRA EL COLOR
    (24, 13, 0.25, False, False),
    (28, 25, 0.03, False, False),
    (32, 11, 0.20, False, False),
    # se acelera: un plano cada 2 negras, con sacudida
    (36, 18, 0.35, False, True),
    (38, 20, 0.20, False, True),
    (40, 15, 0.20, False, True),
    (42, 22, 0.25, False, True),
    (44,  2, 0.00, False, True),
    (46,  6, 0.20, False, True),
    # el break: un plano largo, en blanco y negro
    (48, 31, 0.08, True,  False),
    # EL GOLPE
    (55, 18, 1.90, False, True),
]


def cargar(nombre, cols):
    d = {}
    for linea in open(os.path.join(SP, nombre)):
        p = linea.split()
        if len(p) >= cols:
            d[int(p[0])] = [float(x) for x in p[1:cols]]
    return d


def main():
    planos = cargar("planos.txt", 4)
    centros = cargar("centros.txt", 2)
    os.makedirs(SALIDA, exist_ok=True)

    # los cortes son tiempos absolutos de la grilla; el cuadro sale de ahi
    bordes = [g * NEGRA for g, *_ in GUION] + [FIN]
    cuadros_borde = [round(t * FPS) for t in bordes]

    tareas = []
    for k, (golpe, plano, dentro, mono, sacudir) in enumerate(GUION):
        cuadros = cuadros_borde[k + 1] - cuadros_borde[k]
        pantalla = cuadros / FPS
        d0, d1, largo = planos[plano]
        disponible = largo - dentro - 0.04
        # la velocidad sale de lo que hay: si el plano no alcanza, se ralentiza
        vel = min(1.0, disponible / pantalla)
        vel = round(max(vel, 0.25), 3)
        fuente = pantalla * vel
        t0 = d0 + dentro
        if t0 + fuente > d1 - 0.02:
            t0 = max(d0, d1 - 0.02 - fuente)

        cx = centros.get(plano, [0.5])[0] * ANCHO_FUENTE
        x = int(min(max(cx - LADO_FUENTE / 2, 0), ANCHO_FUENTE - LADO_FUENTE)) // 2 * 2

        pasos = []
        if sacudir:
            m = 36
            lado = LADO_FUENTE - 2 * m
            amp = f"{m}*exp(-9*t)"
            pasos.append(f"crop={lado}:{lado}:'{x+m}+{amp}*sin(60*t)':'{m}+{amp}*cos(74*t)'")
        else:
            pasos.append(f"crop={LADO_FUENTE}:{LADO_FUENTE}:{x}:0")
        if vel < 1.0:
            pasos += [f"setpts={1/(vel*0.93):.5f}*PTS",
                      f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=obmc:me_mode=bidir"]
        pasos.append(f"scale={LADO}:{LADO}:flags=lanczos")
        pasos.append(GRADE + (",hue=s=0" if mono else ""))
        pasos.append(f"zoompan=z='if(lte(on,1),1.08,max(1.001,zoom-0.008))':d=1"
                     f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={LADO}x{LADO}:fps={FPS}")
        pasos += ["setsar=1", "format=yuv420p"]

        dst = os.path.join(SALIDA, f"{k:02d}.mp4")
        tareas.append((k, golpe, plano, vel, cuadros, mono, sacudir, [
            FF, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{t0:.3f}", "-t", f"{fuente + 0.10:.3f}", "-i", FUENTE,
            "-vf", ",".join(pasos), "-an", "-r", str(FPS),
            "-frames:v", str(cuadros),
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", dst]))

    def correr(t):
        k, golpe, plano, vel, cuadros, mono, sac, cmd = t
        r = subprocess.run(cmd, capture_output=True, text=True)
        return (f"{k:02d}  golpe {golpe:2d} ({golpe*NEGRA:6.3f}s)  plano {plano:2d}  "
                f"vel {vel:5.3f}  {cuadros:3d} cuadros  {'B/N ' if mono else '    '}"
                f"{'sacude' if sac else '      '}  "
                f"{'ok' if r.returncode == 0 else 'FALLO ' + r.stderr[-200:]}")

    with ThreadPoolExecutor(max_workers=4) as ex:
        for l in ex.map(correr, tareas):
            print(l)

    with open(os.path.join(SALIDA, "lista.txt"), "w") as f:
        for k in range(len(GUION)):
            f.write(f"file '{os.path.join(SALIDA, f'{k:02d}.mp4')}'\n")

    total = cuadros_borde[-1] / FPS
    peor = max(abs(c / FPS - t) for c, t in zip(cuadros_borde, bordes)) * 1000
    print(f"\ntotal {total:.3f}s  |  {len(GUION)-1} cortes = {(len(GUION)-1)/total:.2f} cortes/s"
          f"  |  peor desvio contra la grilla: {peor:.1f} ms (medio cuadro = 16,7)")


if __name__ == "__main__":
    main()
