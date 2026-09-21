# Correr CapCut bajo Wine en Kaggle, con capturas de cada etapa.
#
# CapCut es gratis, asi que bajarlo es legitimo (After Effects no: es pago y
# ademas no corre en Wine). Corre SIN GPU: instalar Wine no necesita placa.
#
# Lo que enseñaron las dos corridas anteriores:
#  1. La pagina de CapCut NO trae el .exe en el HTML — lo arma JavaScript. El
#     link real sale del JSON de capcut.com/activity/download_pc.
#  2. El instalador es PE32: 32 bits. Con wine64 solo no alcanza.
#  3. El wine de Ubuntu es 6.0.3 (2021). WineHQ da 11.0 y tarda ~230 s.
#  4. `wineboot -i` se COLGO 1000 s. Wine abre un cartel preguntando si instalar
#     Wine Mono y espera que alguien apriete Aceptar. Por eso ahora:
#       - WINEDLLOVERRIDES apaga Mono y Gecko, asi no pregunta;
#       - nada corre en primer plano esperando: todo va de fondo y se saca foto
#         mientras tanto, asi un cuelgue se VE en vez de matar el kernel;
#       - xdotool aprieta Enter cada tanto, que es lo que haria una persona.
import os, shutil, subprocess, time, traceback

SALIDA   = "/kaggle/working"
PANTALLA = ":1"
EXE = ("https://sf16-web-tos-buz.capcutcdn-us.com/obj/capcut-web-buz-tx/"
       "installer/capcut_capcutpc_0_1.2.36_installer.exe")
T0 = time.time()
n_cap = 0

def paso(t):
    print(f"\n===== [{time.time()-T0:6.1f} s] {t} =====", flush=True)

def sh(c, seg=2400):
    try:
        r = subprocess.run(c, shell=True, capture_output=True, text=True, timeout=seg)
        if r.stdout.strip(): print(r.stdout[-700:], flush=True)
        if r.returncode and r.stderr.strip(): print("[err]", r.stderr[-500:], flush=True)
        return r.returncode
    except subprocess.TimeoutExpired:
        print(f"[timeout {seg}s] {c[:80]}", flush=True)
        return -1

def cap(etiqueta):
    """Nunca puede tirar: una captura fallida no vale perder el resto."""
    global n_cap
    n_cap += 1
    d = os.path.join(SALIDA, f"{n_cap:02d}-{etiqueta}.png")
    try:
        subprocess.run(["import", "-display", PANTALLA, "-window", "root", d],
                       capture_output=True, timeout=60)
        print(f"  cap {os.path.basename(d)}: {os.path.getsize(d)} bytes", flush=True)
    except Exception as e:
        print(f"  cap {etiqueta}: {type(e).__name__}", flush=True)

def teclear():
    """Enter a la ventana activa: lo que haria una persona ante un cartel."""
    subprocess.run(f"DISPLAY={PANTALLA} xdotool key --clearmodifiers Return",
                   shell=True, capture_output=True)

def vigilar(seg, etiqueta, enter=True):
    """Deja pasar el tiempo sacando fotos, en vez de esperar a ciegas."""
    fin = time.time() + seg
    while time.time() < fin:
        time.sleep(20)
        cap(etiqueta)
        if enter:
            teclear()

try:
    paso("la maquina")
    sh("lsb_release -ds; nproc")
    codigo = subprocess.run("lsb_release -cs", shell=True, capture_output=True,
                            text=True).stdout.strip() or "jammy"

    paso("WineHQ + herramientas")
    sh("dpkg --add-architecture i386")
    sh("mkdir -pm755 /etc/apt/keyrings")
    sh("wget -qO /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key")
    sh(f"wget -qNP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/{codigo}/winehq-{codigo}.sources")
    sh("apt-get update -qq", 1200)
    if sh("DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --install-recommends winehq-stable", 2400):
        sh("DEBIAN_FRONTEND=noninteractive apt-get install -y -qq wine wine32 wine64", 2400)
    sh("DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "
       "xvfb x11-utils imagemagick openbox xdotool", 1200) 
    WINE = shutil.which("wine") or "/usr/bin/wine64"
    sh(f"{WINE} --version")

    paso("escritorio")
    subprocess.Popen(["Xvfb", PANTALLA, "-screen", "0", "1440x900x24", "-ac"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(4)
    subprocess.Popen(["openbox"], env=dict(os.environ, DISPLAY=PANTALLA),
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    sh(f"xdpyinfo -display {PANTALLA} | head -2")

    sh("id wineuser 2>/dev/null || useradd -m -s /bin/bash wineuser")
    sh("chown -R wineuser /home/wineuser")
    # mscoree,mshtml= apaga los carteles de Mono y Gecko: son los que colgaron
    # la corrida anterior esperando un Aceptar que nadie iba a dar
    W = (f"DISPLAY={PANTALLA} WINEPREFIX=/home/wineuser/.wine WINEARCH=win64 "
         f"WINEDEBUG=-all WINEDLLOVERRIDES='mscoree,mshtml=' HOME=/home/wineuser")

    paso("prefijo de wine (de fondo, mirando)")
    subprocess.Popen(f"su wineuser -c \"{W} wineboot -i\"", shell=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    vigilar(80, "prefijo")
    sh("ls /home/wineuser/.wine/drive_c/ 2>/dev/null")

    paso("bajando el instalador")
    d = "/home/wineuser/capcut.exe"
    sh(f'wget -q --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -O {d} "{EXE}"', 900)
    sh(f"chown wineuser {d} 2>/dev/null; ls -l {d}; file {d}")

    if os.path.exists(d) and os.path.getsize(d) > 100000:
        paso("corriendo el instalador de CapCut")
        subprocess.Popen(f"su wineuser -c \"{W} {WINE} {d}\"", shell=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        vigilar(300, "instalador")
        paso("que quedo")
        sh("find /home/wineuser/.wine/drive_c -maxdepth 5 -iname '*apcut*' | head -20")
        sh("ls '/home/wineuser/.wine/drive_c/Program Files/' 2>/dev/null")
        sh(f"DISPLAY={PANTALLA} xdotool search --name '.*' getwindowname %@ 2>/dev/null | head -20")
    else:
        print("el instalador no se bajo", flush=True)

except Exception:
    print("\n!!! se rompio, pero las capturas quedan:\n" + traceback.format_exc(), flush=True)
    cap("error")

paso("salida")
for a in sorted(os.listdir(SALIDA)):
    print(f"  {os.path.getsize(os.path.join(SALIDA, a)):>10}  {a}", flush=True)
print(f"\nTOTAL {time.time()-T0:.0f} s", flush=True)
