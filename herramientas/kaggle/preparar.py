# Kernel que se corre UNA vez: deja Blender desempaquetado en /kaggle/working.
#
# Para que: bajar Blender son 34,5 s de los 58 que tardaba un render — el 60%
# del kernel. Kaggle deja que la salida de un kernel sea entrada de otro
# (kernel_sources), asi que este se corre una vez y los renders siguientes lo
# agarran de /kaggle/input/... sin bajar nada.
#
# Se guarda DESEMPAQUETADO a proposito: el .tar.xz tarda casi lo mismo en
# descomprimirse que en bajarse.
import os, shutil, subprocess, time

SALIDA = "/kaggle/working"
t0 = time.time()

def sh(c):
    r = subprocess.run(c, shell=True, capture_output=True, text=True)
    if r.returncode:
        print("  fallo:", c[:70], "\n ", r.stderr[-400:], flush=True)
    return r

print("bajando Blender 4.3.2 (el oficial: trae OpenImageDenoise y numpy)", flush=True)
sh("cd /tmp && wget -q https://download.blender.org/release/Blender4.3/"
   "blender-4.3.2-linux-x64.tar.xz -O b.tar.xz")
print(f"  bajado en {time.time()-t0:.1f} s", flush=True)

sh(f"cd {SALIDA} && tar xf /tmp/b.tar.xz && mv blender-4.3.2-linux-x64 blender")
ruta = os.path.join(SALIDA, "blender", "blender")
print(f"  desempaquetado, total {time.time()-t0:.1f} s", flush=True)

if os.path.exists(ruta):
    v = subprocess.run([ruta, "--version"], capture_output=True, text=True).stdout
    print("OK:", (v.splitlines() or ["sin version"])[0], flush=True)
    tot = sum(os.path.getsize(os.path.join(r, f))
              for r, _, fs in os.walk(os.path.join(SALIDA, "blender")) for f in fs)
    print(f"ocupa {tot/1048576:.0f} MB en /kaggle/working", flush=True)
else:
    raise SystemExit("no quedo el binario, mira arriba")
