# Obrero v2: mira el buzon del Drive, atiende el pedido y deja el resultado ahi.
#
# Por que asi y no un tunel: el Colab no recibe conexiones de afuera, y la
# sesion de Claude tampoco. Pero las dos leen y escriben el mismo Drive. El
# buzon es el unico lugar donde se encuentran.
#
# LA LISTA DE VERBOS ES CERRADA Y CADA UNO VALIDA LO SUYO:
#
#   placa          que GPU hay
#   listar         que hay en una carpeta
#   instalar-rar   instala unrar. Paquete FIJO, sin parametros
#   escritorio     levanta Xvfb + openbox
#   abrir          arranca una app de la lista APPS en ese escritorio
#   captura        saca una foto de la pantalla al buzon
#   descargar      baja un https:// al buzon (bajar no es ejecutar)
#   descomprimir   rar / zip / 7z / tar
#   escribir       deja un archivo de texto en el buzon
#   render         los guiones de Blender del repo
#
# LO QUE NO EXISTE, Y NO ES UN OLVIDO:
#
#   - un "corre este comando"
#   - un "instala este paquete" con el nombre libre: eso es ejecucion
#     arbitraria con otro nombre. Los instaladores son fijos.
#   - escribir archivos .py: podria reescribirse a si mismo y la lista cerrada
#     quedaria de adorno.
#
# El motivo concreto: esa maquina tiene el Drive del usuario montado entero.

import datetime, glob, json, os, re, shutil, subprocess, sys, time, traceback

BUZON    = "/content/drive/MyDrive/Colab Notebooks/buzon"
REPO     = "/content/repo"
BLENDER  = "/content/blender/blender"
PANTALLA = ":1"
ESPERA   = 10
LIMITE   = 1800

GUIONES = {
    "arbol":  f"{REPO}/herramientas/blender/arbol.py",
    "casita": f"{REPO}/herramientas/blender/casita.py",
    "pelota": f"{REPO}/herramientas/blender/pelota.py",
    "video":  f"{REPO}/herramientas/blender/armar_video.py",
}
# Una terminal NO va en esta lista: seria un "corre cualquier cosa".
APPS = {"blender": BLENDER}

# Instaladores fijos: la clave es el verbo, el valor son los paquetes exactos.
INSTALADORES = {
    "instalar-rar":      ["unrar-free", "p7zip-full"],
    "instalar-captura":  ["imagemagick", "x11-utils"],
    "instalar-escritorio": ["xvfb", "openbox", "x11-utils"],
}

CLAVES    = {"DISPOSITIVO", "MOTOR", "MUESTRAS", "ANCHO", "ALTO",
             "DESDE", "HASTA", "RENDERIZAR"}
RE_VALOR  = re.compile(r"^[A-Za-z0-9_.-]{1,24}$")
RE_NOMBRE = re.compile(r"^[A-Za-z0-9._-]{1,60}$")     # sin barras: no sale del buzon
RE_URL    = re.compile(r"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]{5,600}$")
PROHIBIDAS = (".py", ".sh", ".bash", ".pyc")


def ahora():
    return datetime.datetime.now().strftime("%H:%M:%S")


def latir(estado):
    try:
        with open(os.path.join(BUZON, "obrero-vivo.txt"), "w") as f:
            f.write(datetime.datetime.now().isoformat(timespec="seconds") + "\n")
            f.write("v2 - " + estado + "\n")
    except Exception:
        pass


def cmd(args, **kw):
    """Nunca shell=True: sin shell no hay inyeccion en lo que venga del pedido."""
    p = subprocess.run(args, capture_output=True, text=True,
                       timeout=kw.pop("timeout", LIMITE), **kw)
    cola = (p.stdout or "")[-1500:]
    if p.stderr.strip():
        cola += "\n[stderr]\n" + p.stderr[-1000:]
    return p.returncode, cola


def en_buzon(nombre):
    if not RE_NOMBRE.match(nombre or ""):
        raise ValueError(f"nombre invalido: {nombre!r} (sin barras)")
    if nombre.lower().endswith(PROHIBIDAS):
        raise ValueError(f"no escribo {nombre!r}: extension prohibida")
    return os.path.join(BUZON, nombre)


def instalar(verbo):
    paquetes = INSTALADORES[verbo]        # fijo, no viene del pedido
    subprocess.run(["apt-get", "update", "-qq"], capture_output=True, timeout=600)
    codigo, cola = cmd(["apt-get", "install", "-y", "-qq"] + paquetes,
                       env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"),
                       timeout=900)
    return f"{verbo}: apt codigo={codigo}\npaquetes: {paquetes}\n{cola}"


def hay_x():
    return subprocess.run(["xdpyinfo", "-display", PANTALLA],
                          capture_output=True).returncode == 0


def asegurar_escritorio():
    if not all(shutil.which(b) for b in ("Xvfb", "openbox", "xdpyinfo")):
        instalar("instalar-escritorio")
    if hay_x():
        return "el escritorio ya estaba andando"
    subprocess.Popen(["Xvfb", PANTALLA, "-screen", "0", "1600x900x24", "-ac"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(4)
    # LIBGL_ALWAYS_SOFTWARE: hay una NVIDIA pero no hay driver de X para ella.
    # Sin esto las apps buscan el GL de la placa y se caen.
    subprocess.Popen(["openbox"],
                     env=dict(os.environ, DISPLAY=PANTALLA, LIBGL_ALWAYS_SOFTWARE="1"),
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    return "escritorio levantado" if hay_x() else "NO pude levantar el escritorio"


def atender(p):
    que = p.get("que", "")

    if que in INSTALADORES:
        return instalar(que)

    if que == "placa":
        return cmd(["nvidia-smi"], timeout=120)[1]

    if que == "listar":
        lineas = []
        for d in (p.get("carpetas") or [BUZON, "/content"]):
            if not isinstance(d, str) or ".." in d:
                lineas.append(f"--- {d!r} rechazada"); continue
            lineas.append(f"--- {d}")
            try:
                for a in sorted(os.listdir(d))[:80]:
                    r = os.path.join(d, a)
                    lineas.append(f"   {os.path.getsize(r) if os.path.isfile(r) else '<dir>':>12}  {a}")
            except Exception as e:
                lineas.append(f"   ({e})")
        return "\n".join(lineas)

    if que == "escritorio":
        return asegurar_escritorio()

    if que == "abrir":
        ruta = APPS.get(p.get("app", ""))
        if not ruta:
            return "app no permitida. Van: " + ", ".join(sorted(APPS))
        if not os.path.exists(ruta):
            return f"no existe {ruta}"
        aviso = asegurar_escritorio()
        subprocess.Popen([ruta],
                         env=dict(os.environ, DISPLAY=PANTALLA, LIBGL_ALWAYS_SOFTWARE="1"),
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        espera = p.get("esperar", 25)
        time.sleep(espera if isinstance(espera, int) and 0 < espera <= 120 else 25)
        return f"{aviso}\nabri {p.get('app')} y le di tiempo a dibujar"

    if que == "captura":
        if not hay_x():
            return "no hay escritorio. Pedime primero: escritorio"
        if not shutil.which("import"):
            instalar("instalar-captura")
        if not shutil.which("import"):
            return "sin imagemagick no hay captura"
        destino = en_buzon(p.get("nombre") or "pantalla.png")
        codigo, cola = cmd(["import", "-display", PANTALLA, "-window", "root", destino],
                           timeout=180)
        if codigo or not os.path.exists(destino):
            return f"la captura fallo (codigo {codigo})\n{cola}"
        return f"captura: {os.path.basename(destino)}  {os.path.getsize(destino)} bytes"

    if que == "descargar":
        url = p.get("url", "")
        if not RE_URL.match(url):
            return "url invalida: solo https:// y caracteres normales"
        destino = en_buzon(p.get("nombre") or url.rstrip("/").split("/")[-1][:60])
        codigo, cola = cmd(["wget", "-q", "-O", destino, url], timeout=1800)
        if codigo:
            return f"wget fallo (codigo {codigo})\n{cola}"
        return f"bajado: {os.path.basename(destino)}  {os.path.getsize(destino)} bytes"

    if que == "descomprimir":
        origen = en_buzon(p.get("archivo", ""))
        if not os.path.exists(origen):
            return f"no existe {os.path.basename(origen)} en el buzon"
        afuera = os.path.join(BUZON, os.path.splitext(os.path.basename(origen))[0])
        os.makedirs(afuera, exist_ok=True)
        b = origen.lower()
        if b.endswith(".rar"):
            if shutil.which("unrar-free"): args = ["unrar-free", "-x", origen, afuera]
            elif shutil.which("7z"):       args = ["7z", "x", f"-o{afuera}", "-y", origen]
            else: return "falta el descompresor. Pedime: instalar-rar"
        elif b.endswith(".zip"):  args = ["unzip", "-o", origen, "-d", afuera]
        elif b.endswith(".7z"):   args = ["7z", "x", f"-o{afuera}", "-y", origen]
        elif b.endswith((".tar", ".tar.gz", ".tgz", ".tar.xz", ".tar.bz2")):
            args = ["tar", "xf", origen, "-C", afuera]
        else:
            return "no se que es eso. Van rar, zip, 7z, tar"
        codigo, cola = cmd(args, timeout=1800)
        return (f"codigo={codigo}\nquedo en {os.path.basename(afuera)}/: "
                f"{len(os.listdir(afuera))} cosas\n{cola}")

    if que == "escribir":
        destino = en_buzon(p.get("nombre", ""))
        texto = p.get("texto", "")
        if not isinstance(texto, str):
            return "el texto tiene que ser texto"
        open(destino, "w", encoding="utf-8").write(texto)
        return f"escrito {os.path.basename(destino)}  {len(texto)} caracteres"

    if que == "render":
        guion = GUIONES.get(p.get("guion", ""))
        if not guion:
            return "guion no permitido. Los que hay: " + ", ".join(sorted(GUIONES))
        if not os.path.exists(guion):
            return f"no existe {guion}. Falta clonar el repo en {REPO}."
        if not os.path.exists(BLENDER):
            return f"no existe {BLENDER}. Falta bajar Blender."
        entorno, rechazadas = dict(os.environ), []
        for k, v in (p.get("entorno") or {}).items():
            v = str(v)
            if k in CLAVES and RE_VALOR.match(v): entorno[k] = v
            else: rechazadas.append(f"{k}={v}")
        entorno["SALIDA"] = BUZON
        t0 = time.time()
        codigo, cola = cmd([BLENDER, "--background", "--python", guion],
                           cwd="/content", env=entorno)
        seg = time.time() - t0
        util = [l for l in cola.splitlines()
                if l.startswith(("PLACA:", "ARBOL:", "CASITA:", "ESCENA LISTA",
                                 "VIDEO LISTO", "Saved:"))]
        texto = (f"(ignore: {', '.join(rechazadas)})\n" if rechazadas else "")
        texto += f"tardo: {seg:.1f} s\ncodigo de salida: {codigo}\n" + "\n".join(util)
        if codigo:
            texto += "\n\n--- se rompio ---\n" + cola
        return texto

    return ("no entiendo 'que': %r\nEntiendo: " % que
            + ", ".join(["placa", "listar", "escritorio", "abrir", "captura",
                         "descargar", "descomprimir", "escribir", "render"]
                        + sorted(INSTALADORES)))


def correr(ruta):
    nombre = os.path.basename(ruta)
    n = nombre[len("pedido-"):-len(".json")]
    print(f"[{ahora()}] atendiendo {nombre}", flush=True)
    latir("atendiendo " + nombre)
    t0 = time.time()
    try:
        cuerpo = atender(json.load(open(ruta, encoding="utf-8")))
    except subprocess.TimeoutExpired:
        cuerpo = f"se paso de {LIMITE} s y lo corte."
    except Exception:
        cuerpo = "se rompio el obrero:\n" + traceback.format_exc()
    cabeza = (f"pedido: {nombre}\n"
              f"termino: {datetime.datetime.now().isoformat(timespec='seconds')}\n"
              f"vuelta completa: {time.time() - t0:.1f} s\n" + "-" * 60 + "\n")
    # primero el resultado, despues mover el pedido: si se corta entre medio,
    # prefiero un pedido repetido antes que un resultado perdido
    open(os.path.join(BUZON, f"salida-{n}.txt"), "w").write(cabeza + str(cuerpo))
    shutil.move(ruta, os.path.join(BUZON, "hechos", nombre))
    print(f"[{ahora()}] listo {nombre} -> salida-{n}.txt", flush=True)


def main():
    if not os.path.isdir(BUZON):
        sys.exit(f"No encuentro {BUZON}. Falta montar el Drive.")
    os.makedirs(os.path.join(BUZON, "hechos"), exist_ok=True)
    print("Obrero v2 mirando:", BUZON, flush=True)
    print("Verbos:", ", ".join(["placa", "listar", "escritorio", "abrir", "captura",
                                "descargar", "descomprimir", "escribir", "render"]
                               + sorted(INSTALADORES)), flush=True)
    latir("esperando")
    while True:
        try:
            for ruta in sorted(glob.glob(os.path.join(BUZON, "pedido-*.json"))):
                correr(ruta)
            latir("esperando")
        except Exception:
            print(f"[{ahora()}] vuelta fallida:\n{traceback.format_exc()}", flush=True)
        time.sleep(ESPERA)


if __name__ == "__main__":
    main()
