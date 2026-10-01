# Blender con la GPU de Kaggle: la misma escena con Cycles en OptiX, CUDA y CPU,
# con los tiempos. Las imágenes quedan en /kaggle/working.
#
# Se corre como notebook privado con GPU e internet:
#   kaggle kernels init -p <carpeta>   (code_file: blender_gpu.py, "enable_gpu": true,
#                                       "enable_internet": true, "is_private": true)
#   kaggle kernels push -p <carpeta> --accelerator NvidiaTeslaT4
#   kaggle kernels output <usuario>/<notebook> -p <salida>
# Medido el 01/10/2026 (2 T4, Blender 4.5.14 LTS, 1280×720, 256 muestras):
# CUDA 12,5 s, OptiX 15,8 s, CPU 115 s.
import os, re, subprocess, time, urllib.request
def sh(c, t=1800):
    r = subprocess.run(c, shell=True, capture_output=True, text=True, timeout=t)
    print(f"\n$ {c[:120]}\n{(r.stdout + r.stderr)[-1800:]}", flush=True)
    return r.returncode
T0 = time.time()
sh("apt-get install -y -qq libxi6 libxkbcommon0 libsm6 libxxf86vm1 libgl1 libegl1 libxrender1 libxfixes3 > /dev/null 2>&1; echo apt $?")
# download.blender.org da 403 al User-Agent de Python: se baja como navegador
url = "https://download.blender.org/release/Blender4.5/blender-4.5.14-linux-x64.tar.xz"
print("bajo", url, flush=True)
sh(f"cd /tmp && wget -q -U 'Mozilla/5.0' '{url}' -O b.tar.xz && tar xf b.tar.xz && ls -d /tmp/blender-*/")
B = subprocess.run("ls -d /tmp/blender-*/ | head -1", shell=True, capture_output=True, text=True).stdout.strip() + "blender"
print(f"bajado en {time.time()-T0:.0f} s", flush=True)
open("/tmp/render.py", "w").write('''
import bpy, sys, time
dev = sys.argv[sys.argv.index("--") + 1]
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 256
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
bpy.ops.mesh.primitive_monkey_add(location=(2.6, 0, 0.8)); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -1))
prefs = bpy.context.preferences.addons["cycles"].preferences
if dev == "CPU":
    sc.cycles.device = "CPU"
else:
    prefs.compute_device_type = dev
    prefs.get_devices()
    for d in prefs.devices: d.use = d.type == dev
    sc.cycles.device = "GPU"
sc.render.filepath = f"/kaggle/working/prueba-{dev}.png"
t = time.time(); bpy.ops.render.render(write_still=True)
print("TIEMPO", dev, round(time.time() - t, 2), "s", flush=True)
print("DISPOSITIVOS", [(d.name, d.type) for d in prefs.devices if d.use], flush=True)
''')
sh(f"{B} --version | head -1")
for dev in ("OPTIX", "CUDA", "CPU"):
    sh(f"{B} -b --factory-startup -P /tmp/render.py -- {dev} 2>&1 | grep -E 'TIEMPO|DISPOSITIVOS|Error|error' | head -8")
sh("nvidia-smi --query-gpu=name,memory.used --format=csv; ls -la /kaggle/working")
print(f"TOTAL {time.time()-T0:.0f} s", flush=True)
