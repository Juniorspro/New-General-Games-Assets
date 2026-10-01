# Arma y manda a Kaggle el notebook que renderiza la JX-1 con las dos T4.
#
#   python3 kaggle_render.py <carpeta de trabajo> <usuario de kaggle>
#
# El notebook lleva adentro pantalla.py y escena.py (así no hace falta subir
# un dataset), baja Blender 4.5 LTS, renderiza los 312 cuadros a 1080x1920,
# una foto de 2160x3840 y deja en /kaggle/working el video maestro (sin
# sonido), la foto y un zip con el .blend y los cuadros de la pantallita.
import json, os, sys

aqui = os.path.dirname(os.path.abspath(__file__))
trabajo, usuario = sys.argv[1], sys.argv[2]
RAPIDO = len(sys.argv) > 3 and sys.argv[3] == 'rapido'   # 720x1280, limpiador en la CPU, sin foto
os.makedirs(trabajo, exist_ok=True)
fuentes = {n: open(os.path.join(aqui, n)).read() for n in ('pantalla.py', 'escena.py')}

NOTEBOOK = r'''
import os, subprocess, sys, time, shutil, glob
T0 = time.time()
def sh(c, t=36000, mostrar=True):
    p = subprocess.Popen(c, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for linea in p.stdout:
        if mostrar and any(k in linea for k in ('Saved:', 'GPU:', 'Error', 'error', 'LISTO', 'Traceback', 'sin ', 'resplandor', 'color:', 'limpieza')):
            print(f"[{time.time()-T0:6.0f} s] {linea.rstrip()}", flush=True)
    return p.wait()
os.makedirs('/tmp/jx1', exist_ok=True); os.makedirs('/kaggle/working', exist_ok=True); os.chdir('/tmp/jx1')
for nombre, codigo in FUENTES.items():
    open(nombre, 'w').write(codigo)
print(sh('python3 pantalla.py lcd'), 'pantalla', flush=True)
sh("apt-get install -y -qq libxi6 libxkbcommon0 libsm6 libxxf86vm1 libgl1 libegl1 libxrender1 libxfixes3 > /dev/null 2>&1")
# download.blender.org no le da archivos al User-Agent de Python
sh("wget -q -U 'Mozilla/5.0' https://download.blender.org/release/Blender4.5/blender-4.5.14-linux-x64.tar.xz -O b.tar.xz && tar xf b.tar.xz")
B = '/tmp/jx1/blender-4.5.14-linux-x64/blender'
print(f'Blender listo a los {time.time()-T0:.0f} s', flush=True)
# primero un cuadro chico: el primer limpiador que no deje la imagen negra
from PIL import Image, ImageStat
elegido = 'no'
for modo in ('gpu', 'cpu', 'no'):
    os.environ['JX_LIMPIEZA'] = modo
    sh(f'{B} -b --factory-startup -P escena.py -- prueba lcd prueba_{modo} 175')
    try:
        brillo = sum(ImageStat.Stat(Image.open(f'prueba_{modo}/prueba.png').convert('L')).mean)
    except Exception as e:
        brillo = 0; print('prueba', modo, e, flush=True)
    print(f'prueba {modo}: brillo {brillo:.1f}', flush=True)
    if brillo > 8:
        elegido = modo; shutil.copy(f'prueba_{modo}/prueba.png', '/kaggle/working/prueba.png') if os.path.isdir('/kaggle/working') else None; break
os.environ['JX_LIMPIEZA'] = elegido
print('limpiador elegido:', elegido, flush=True)
sh(f'{B} -b --factory-startup -P escena.py -- final lcd cuadros 1,312')
print(f'cuadros listos a los {time.time()-T0:.0f} s: {len(glob.glob("cuadros/cuadro_*.png"))}', flush=True)
sh(f'{B} -b --factory-startup -P escena.py -- foto lcd foto 300')
ff = shutil.which('ffmpeg')
if not ff:
    sh('pip install -q imageio-ffmpeg', mostrar=False)
    import imageio_ffmpeg; ff = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs('/kaggle/working', exist_ok=True)
sh(f'{ff} -y -loglevel error -framerate 24 -i cuadros/cuadro_%04d.png -c:v libx264 -preset slow -crf 12 -pix_fmt yuv420p /kaggle/working/jx1_maestro.mp4')
shutil.copy('foto/jx1_foto.png', '/kaggle/working/jx1_foto.png')
# el .blend con su pantallita al lado (la ruta quedó relativa)
os.makedirs('blend/lcd', exist_ok=True)
shutil.copy('foto/jx1.blend', 'blend/jx1.blend')
for f in glob.glob('lcd/*'): shutil.copy(f, 'blend/lcd/')
shutil.make_archive('/kaggle/working/jx1_blend', 'zip', 'blend')
for f in sorted(os.listdir('/kaggle/working')):
    print(f, os.path.getsize('/kaggle/working/' + f), flush=True)
print(f'TOTAL {time.time()-T0:.0f} s', flush=True)
'''
if RAPIDO:
    ini = NOTEBOOK.index('# primero un cuadro chico'); fin = NOTEBOOK.index("print('limpiador elegido:'")
    NOTEBOOK = NOTEBOOK[:ini] + "elegido = 'cpu'\nos.environ['JX_LIMPIEZA'] = elegido\n" + NOTEBOOK[fin:]
    NOTEBOOK = NOTEBOOK.replace('-- final lcd cuadros 1,312', '-- rapido lcd cuadros 1,312')
    NOTEBOOK = NOTEBOOK.replace("sh(f'{B} -b --factory-startup -P escena.py -- foto lcd foto 300')\n", '')
    NOTEBOOK = NOTEBOOK.replace("shutil.copy('foto/jx1_foto.png', '/kaggle/working/jx1_foto.png')\n", '')
    NOTEBOOK = NOTEBOOK.replace("shutil.copy('foto/jx1.blend', 'blend/jx1.blend')", "shutil.copy('cuadros/jx1.blend', 'blend/jx1.blend')")
codigo = 'FUENTES = ' + repr(fuentes) + '\n' + NOTEBOOK
open(os.path.join(trabajo, 'jx1_render.py'), 'w').write(codigo)
json.dump({
    'id': f'{usuario}/jx1-render' + ('-rapido' if RAPIDO else ''), 'title': 'jx1 render' + (' rapido' if RAPIDO else ''), 'code_file': 'jx1_render.py',
    'language': 'python', 'kernel_type': 'script', 'is_private': True,
    'enable_gpu': True, 'enable_tpu': False, 'enable_internet': True,
    'dataset_sources': [], 'kernel_sources': [], 'competition_sources': [], 'model_sources': [],
}, open(os.path.join(trabajo, 'kernel-metadata.json'), 'w'), indent=2)
print('armado en', trabajo)
