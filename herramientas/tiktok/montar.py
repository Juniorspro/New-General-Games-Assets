#!/usr/bin/env python3
"""Monta el edit: un segmento por golpe de la grilla, y despues se pegan.

DECISIONES, con el motivo:

· GRILLA DE 90 BPM (negra = 0,6667 s). Los planos duran 2 golpes en el cuerpo,
  3 en la apertura y 1 en el remate: 15 cortes en 20,7 s = 0,73 cortes/s, que
  cae dentro del 0,6-0,9 que pide la RECETA. No es un numero elegido a ojo.

· RECORTE POR PLANO, no por el centro. En 960x720 el 9:16 se lleva 405 de 960
  px. `centros.txt` trae, por plano, donde esta la cara (medido en encuadre.py).

· CAMARA LENTA SOLO EN LA APERTURA, y con minterpolate. Sin interpolar, medio
  cuadro repetido se ve como un tiron. Va ANTES de agrandar porque la
  estimacion de movimiento se paga por pixel.

· GRADE MAPEADO, no a ojo. La fuente mide p5=2,2 mediana=37,7 p95=136,3 y el
  objetivo de la RECETA es 49 / 113 / 205. La curva pone esos tres puntos
  donde van. Dejar el p95 en 205 y no en 255 es lo que evita quemar el blanco.

· GOLPE DE ZOOM en cada corte, que decae en ~0,2 s. Es lo que da el golpe sin
  tener que mover nada mas.
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SP = os.environ.get("EDIT_DIR", os.getcwd())   # donde viven planos.txt, centros.txt y edit/
FUENTE = os.path.join(SP, "edit", "crudo", "catsconcept.mp4")
SALIDA = os.path.join(SP, "edit", "seg")

NEGRA = 60.0 / 90                      # 0,6667 s
ANCHO_FUENTE, ALTO_FUENTE = 960, 720
ANCHO_REC = int(ALTO_FUENTE * 9 / 16) // 2 * 2      # 404: el 9:16 que entra

# la curva que lleva los percentiles medidos a los de la RECETA
# EL GRADE, y por que NO es una curva.
#
# Primer intento: `curves` mapeando los percentiles medidos (p5 2,2 /
# mediana 38,7 / p95 106,0) a los de la RECETA (49 / 113 / 205). Sale una
# imagen PSICODELICA: pedirle que lleve 0,0086 a 0,1922 le da al primer tramo
# una pendiente de 22, la spline se dispara arriba de 1 entre los puntos de
# control, el canal desborda y da la vuelta. Y lo peor: los NUMEROS daban
# bien. Un pixel que da la vuelta cae a media escala, asi que no cuenta como
# clipping, y el ruido que genera dispara la varianza del laplaciano — o sea
# que tambien inflaba la nitidez. Tres tandas de calibracion midieron una
# imagen rota. De aca sale la regla: medir Y MIRAR, siempre las dos.
#
# Segundo intento: modelar `eq` y despejar los parametros. Tampoco. Los
# percentiles del medidor son el PROMEDIO de los percentiles de cada cuadro, y
# una transformacion no lineal aplicada cuadro a cuadro y despues promediada
# no da lo mismo que aplicarla al promedio: con planos que van de un interior
# oscuro a un exterior a pleno sol, el modelo predecia p5=46 y se medía 77.
#
# Lo que quedo: buscar en grilla MIDIENDO la salida (buscar_grade.py). `eq` es
# monotona y satura sin dar la vuelta, asi que no puede romper la imagen.
# Medido con estos valores: p5 48,4 / mediana 125,4 / p95 196,5 / sat 0,230 /
# clipping 0,67%. La saturacion queda lejos del 0,45-0,55 de la RECETA y no es
# un error: el medidor la calcula como (max-min)/max, y abrir los negros de 2
# a 49 sube el min de todos los pixeles. En este material las dos cosas no se
# pueden tener juntas; se elige el negro abierto, que es lo que la RECETA
# marca como la diferencia entre un edit y un tutorial.
GRADE = ("eq=gamma=2.3:contrast=1.3:brightness=0.09:saturation=1.6,"
         "unsharp=5:5:1.4:5:5:0.0")
# golpe de zoom: 12% que se va con constante de 0,18 s
PUNCH = ("zoompan=z='if(lte(on,1),1.12,max(1.001,zoom-0.011))':d=1"
         ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30")

# (plano, desde_dentro_del_plano, golpes, velocidad)  velocidad<1 = lenta
GUION = [
    # apertura en blanco y negro, lenta
    (28, 0.03, 3, 0.50),
    (31, 0.10, 3, 0.50),
    (30, 0.02, 2, 0.465),
    (29, 0.02, 2, 0.5625),
    # el golpe: entra el color y el tiempo real
    (13, 0.30, 2, 1.0),
    (18, 0.40, 2, 1.0),
    (20, 0.25, 2, 1.0),
    (22, 0.30, 2, 1.0),
    (15, 0.20, 2, 1.0),
    (25, 0.05, 2, 1.0),
    (11, 0.30, 2, 1.0),
    # remate: un golpe por plano
    (13, 1.70, 1, 1.0),
    (20, 1.45, 1, 1.0),
    (18, 1.90, 1, 1.0),
    (22, 1.60, 1, 1.0),
    # cierre, otra vez lento
    (31, 0.10, 3, 0.50),
]


def cargar(nombre, cols):
    d = {}
    for linea in open(os.path.join(SP, nombre)):
        p = linea.split()
        if len(p) >= cols:
            d[int(p[0])] = [float(x) for x in p[1:cols]]
    return d


def main():
    planos = cargar("planos.txt", 4)      # id -> [desde, hasta, dura]
    centros = cargar("centros.txt", 2)    # id -> [fraccion x]
    os.makedirs(SALIDA, exist_ok=True)

    tareas = []
    for k, (plano, dentro, golpes, vel) in enumerate(GUION):
        desde0, hasta0, _ = planos[plano]
        pantalla = golpes * NEGRA                 # cuanto ocupa en el edit
        # EL NUMERO QUE MANDA ES EL DE CUADROS, no la duracion. Medido: pedir
        # duracion deja los planos de un golpe en 21 cuadros (0,700 s) en vez de
        # 20 (0,667), y minterpolate pierde 3 al final porque no puede
        # interpolar mas alla del ultimo cuadro de entrada. Se acumulaban
        # 0,366 s en 16 planos: los cortes sobre beat caian de ~1,00 a 0,06.
        cuadros = round(pantalla * 30)
        vel_render = vel * 0.93 if vel != 1.0 else 1.0   # material de sobra
        fuente = pantalla * vel + (0.0 if vel != 1.0 else 0.10)
        t0 = desde0 + dentro
        if t0 + fuente > hasta0 - 0.02:           # no pisar el corte de al lado
            t0 = max(desde0, hasta0 - 0.02 - fuente)
        # centro del recorte, sin salirse del cuadro
        cx = centros.get(plano, [0.5])[0] * ANCHO_FUENTE
        x = int(min(max(cx - ANCHO_REC / 2, 0), ANCHO_FUENTE - ANCHO_REC)) // 2 * 2

        pasos = [f"crop={ANCHO_REC}:{ALTO_FUENTE}:{x}:0"]
        if vel != 1.0:
            pasos += [f"setpts={1/vel_render:.5f}*PTS",
                      "minterpolate=fps=30:mi_mode=mci:mc_mode=obmc:me_mode=bidir"]
        # OJO: nada de un filtro `fps` DETRAS de zoompan. Medido: zoompan sella
        # su propio fps y el filtro de atras duplica cuadros sin freno — 1,33 s
        # salieron 11 min 24 s. El encuadre de 30 fps se fija con -r a la salida.
        pasos += ["scale=1080:1920:flags=lanczos", GRADE, PUNCH, "format=yuv420p"]

        dst = os.path.join(SALIDA, f"{k:02d}.mp4")
        tareas.append((k, plano, t0, fuente, cuadros, x, vel, [
            FF, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{t0:.3f}", "-t", f"{fuente:.3f}", "-i", FUENTE,
            "-vf", ",".join(pasos), "-an",
            "-r", "30", "-frames:v", str(cuadros),
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", dst]))

    def correr(t):
        k, plano, t0, fuente, cuadros, x, vel, cmd = t
        r = subprocess.run(cmd, capture_output=True, text=True)
        estado = "ok" if r.returncode == 0 else "FALLO"
        return (f"{k:02d}  plano {plano:2d}  fuente {t0:6.2f}+{fuente:4.2f}s  "
                f"x={x:3d}  vel {vel:4.2f}  ->  {cuadros:3d} cuadros  {estado}"
                + ("\n     " + r.stderr[-300:] if r.returncode else ""))

    with ThreadPoolExecutor(max_workers=4) as ex:
        for linea in ex.map(correr, tareas):
            print(linea)

    lista = os.path.join(SALIDA, "lista.txt")
    with open(lista, "w") as f:
        for k in range(len(GUION)):
            f.write(f"file '{os.path.join(SALIDA, f'{k:02d}.mp4')}'\n")
    print("\ntotal previsto:", round(sum(g * NEGRA for _, _, g, _ in GUION), 3), "s")


if __name__ == "__main__":
    main()
