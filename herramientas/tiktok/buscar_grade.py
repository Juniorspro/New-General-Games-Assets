"""Busca gamma/contraste/brillo MIDIENDO la salida, no modelandola.

Por que no se modela: los percentiles del medidor son el promedio de los
percentiles de cada cuadro. Una transformacion no lineal aplicada cuadro a
cuadro y despues promediada NO da lo mismo que aplicarla al promedio, y con
planos que van de un interior oscuro a un exterior a pleno sol la diferencia
fue de 30 niveles. Modelar predecia p5=46 y la medicion daba 77.
"""
import os, subprocess, sys, itertools
sys.path.insert(0,"/home/user/New-General-Games-Assets/herramientas/tiktok")
import imageio_ffmpeg
from medir import color_y_nitidez
FF=imageio_ffmpeg.get_ffmpeg_exe(); SP=os.environ.get("EDIT_DIR", os.getcwd())
BASE=os.path.join(SP,"edit","base.mp4")
OBJ=(49.0,113.0,205.0)

def prueba(g,c,b,s=1.0,u=1.2):
    vf=f"eq=gamma={g}:contrast={c}:brightness={b}:saturation={s},unsharp=5:5:{u}:5:5:0.0"
    dst=os.path.join(SP,"edit","busca.mp4")
    subprocess.run([FF,"-y","-v","error","-i",BASE,"-vf",vf,"-an","-r","30",
                    "-c:v","libx264","-crf","20","-preset","ultrafast",dst],check=True)
    m=color_y_nitidez(dst)
    err=max(abs(m['lum_p5']-OBJ[0]),abs(m['lum_mediana']-OBJ[1]),abs(m['lum_p95']-OBJ[2]))
    return err,m

mejor=None
print(f"{'gamma':>6}{'contr':>7}{'brillo':>8} | {'p5':>6}{'med':>7}{'p95':>7} {'error':>7}")
for g,c,b in itertools.product((2.1,2.3,2.5),(1.30,1.45,1.60),(0.09,0.12,0.15)):
    e,m=prueba(g,c,b)
    print(f"{g:>6}{c:>7}{b:>8} | {m['lum_p5']:>6.1f}{m['lum_mediana']:>7.1f}{m['lum_p95']:>7.1f} {e:>7.1f}")
    if mejor is None or e<mejor[0]: mejor=(e,g,c,b,m)
print(f"\nMEJOR: gamma={mejor[1]} contrast={mejor[2]} brightness={mejor[3]}  error {mejor[0]:.1f}")
open(os.path.join(SP,'grade.txt'),'w').write(f"gamma={mejor[1]}:contrast={mejor[2]}:brightness={mejor[3]}")
