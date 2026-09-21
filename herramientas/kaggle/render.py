# Kernel de render. kg.py le reemplaza la linea de PARAMS antes de mandarlo:
# los kernels de Kaggle no reciben argumentos, asi que los parametros se
# escriben adentro del archivo.
PARAMS = {"guion": "arbol", "entorno": {"DISPOSITIVO": "GPU"}}   # kg.py

import os, subprocess, time

RAMA = "claude/new-session-8309f5"
REPO = "https://github.com/Juniorspro/New-General-Games-Assets"
SALIDA = "/kaggle/working"          # lo que quede aca se puede bajar despues

def sh(c):
    r = subprocess.run(c, shell=True, capture_output=True, text=True)
    if r.returncode:
        print("  fallo:", c[:70], "\n ", r.stderr[-400:], flush=True)
    return r

import shutil, urllib.request
print("== placa ==", flush=True)
if shutil.which("nvidia-smi"):
    print(subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                         capture_output=True, text=True).stdout.strip(), flush=True)
else:
    print("PLACA: NINGUNA (sin nvidia-smi). Falta verificar el telefono en Kaggle.",
          flush=True)
try:
    print("INTERNET: si (HTTP %d)" % urllib.request.urlopen(
        "https://pypi.org/pypi/kaggle/json", timeout=20).status, flush=True)
except Exception as e:
    print(f"INTERNET: NO ({type(e).__name__}) -> no va a poder bajar Blender",
          flush=True)

print("== Blender 4.3.2 ==", flush=True)
sh("apt-get install -y -qq libxi6 libxxf86vm1 libxfixes3 libxrender1 libsm6 libgl1")

# Si el kernel `preparar` viene enganchado como entrada, Blender ya esta ahi y
# nos ahorramos 34,5 s de bajada — el 60% del kernel. Si no esta, se baja.
import glob
listo = glob.glob("/kaggle/input/*/blender/blender")
if listo:
    os.makedirs("/tmp", exist_ok=True)
    sh(f"cp -r {os.path.dirname(os.path.dirname(listo[0]))} /tmp/blender")
    sh("chmod +x /tmp/blender/blender")
    print("  Blender salio de la entrada, no se bajo nada", flush=True)
else:
    print("  no hay Blender en la entrada: bajandolo", flush=True)
    sh("cd /tmp && wget -q https://download.blender.org/release/Blender4.3/"
       "blender-4.3.2-linux-x64.tar.xz -O b.tar.xz")
    sh("cd /tmp && tar xf b.tar.xz && mv blender-4.3.2-linux-x64 blender")
if os.path.exists("/tmp/blender/blender"):
    v = subprocess.run(["/tmp/blender/blender", "--version"],
                       capture_output=True, text=True).stdout.splitlines()
    print(v[0] if v else "Blender no contesto --version", flush=True)
else:
    raise SystemExit("Blender no se bajo: mira las lineas de arriba")

print("== repo ==", flush=True)
sh(f"git clone -q --depth 1 -b {RAMA} {REPO} /tmp/repo")

GUIONES = {
    "arbol":  "/tmp/repo/herramientas/blender/arbol.py",
    "casita": "/tmp/repo/herramientas/blender/casita.py",
    "pelota": "/tmp/repo/herramientas/blender/pelota.py",
    "video":  "/tmp/repo/herramientas/blender/armar_video.py",
}
guion = GUIONES[PARAMS["guion"]]

entorno = dict(os.environ, SALIDA=SALIDA, **{k: str(v) for k, v in
                                             PARAMS.get("entorno", {}).items()})
print(f"== render: {PARAMS['guion']} ==", flush=True)
t0 = time.time()
p = subprocess.run(["/tmp/blender/blender", "--background", "--python", guion],
                   env=entorno, capture_output=True, text=True)
seg = time.time() - t0

for l in p.stdout.splitlines():
    if l.startswith(("PLACA:", "ARBOL:", "CASITA:", "ESCENA LISTA",
                     "VIDEO LISTO", "Saved:")):
        print(l, flush=True)
print(f"TARDO {seg:.1f} s   codigo={p.returncode}", flush=True)
if p.returncode:
    print("--- se rompio ---\n", p.stdout[-3000:], p.stderr[-2000:], flush=True)

print("== quedo en /kaggle/working ==", flush=True)
for a in sorted(os.listdir(SALIDA)):
    print(f"  {os.path.getsize(os.path.join(SALIDA, a)):>12}  {a}", flush=True)
