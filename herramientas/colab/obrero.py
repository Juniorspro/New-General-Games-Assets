# El obrero: mira el buzón del Drive, atiende el pedido y deja el resultado ahí.
#
# Por qué así y no un túnel: el Colab no recibe conexiones de afuera, y la
# sesión de Claude tampoco. Pero las dos pueden leer y escribir el mismo Drive.
# El buzón es el único lugar donde se encuentran. Sin puertos, sin tokens, sin
# escritorio remoto.
#
#   pedido-NNN.json   qué hacer          (lo deja Claude)
#   salida-NNN.txt    qué pasó           (lo deja el obrero)
#   *.png             lo que se renderizó
#   hechos/           los pedidos ya atendidos
#   obrero-vivo.txt   latido, para saber desde afuera que sigue corriendo
#
# A PROPÓSITO NO EJECUTA CÓDIGO ARBITRARIO. Solo corre los guiones que ya están
# en el repo clonado, elegidos por nombre de una lista fija, y solo les deja
# pasar las variables de la lista CLAVES, validadas una por una. Un buzón que
# corriera cualquier .py sería una puerta abierta a esa máquina; este no lo es.

import datetime, glob, json, os, re, shutil, subprocess, sys, time, traceback

BUZON   = "/content/drive/MyDrive/Colab Notebooks/buzon"
REPO    = "/content/repo"
BLENDER = "/content/blender/blender"
ESPERA  = 10
LIMITE  = 1800

GUIONES = {
    "arbol":  f"{REPO}/herramientas/blender/arbol.py",
    "casita": f"{REPO}/herramientas/blender/casita.py",
    "pelota": f"{REPO}/herramientas/blender/pelota.py",
    "video":  f"{REPO}/herramientas/blender/armar_video.py",
}
CLAVES = {"DISPOSITIVO", "MOTOR", "MUESTRAS", "ANCHO", "ALTO",
          "DESDE", "HASTA", "RENDERIZAR"}
VALOR_OK = re.compile(r"^[A-Za-z0-9_.-]{1,24}$")


def ahora():
    return datetime.datetime.now().strftime("%H:%M:%S")


def latir(estado):
    try:
        with open(os.path.join(BUZON, "obrero-vivo.txt"), "w") as f:
            f.write(datetime.datetime.now().isoformat(timespec="seconds") + "\n")
            f.write(estado + "\n")
    except Exception:
        pass


def entorno_de(pedido):
    env, rechazadas = dict(os.environ), []
    for k, v in (pedido.get("entorno") or {}).items():
        v = str(v)
        if k in CLAVES and VALOR_OK.match(v):
            env[k] = v
        else:
            rechazadas.append(f"{k}={v}")
    return env, rechazadas


def atender(pedido):
    que = pedido.get("que", "")

    if que == "placa":
        p = subprocess.run(["nvidia-smi"], capture_output=True, text=True)
        return p.stdout or p.stderr

    if que == "listar":
        lineas = []
        for d in (REPO + "/herramientas/blender", "/content/salida", BUZON):
            lineas.append(f"--- {d}")
            try:
                for a in sorted(os.listdir(d)):
                    lineas.append(f"   {os.path.getsize(os.path.join(d, a)):>10}  {a}")
            except Exception as e:
                lineas.append(f"   ({e})")
        return "\n".join(lineas)

    if que == "render":
        guion = GUIONES.get(pedido.get("guion", ""))
        if not guion:
            return "guion no permitido. Los que hay: " + ", ".join(sorted(GUIONES))
        if not os.path.exists(guion):
            return f"no existe {guion}. Falta clonar el repo en {REPO}."
        if not os.path.exists(BLENDER):
            return f"no existe {BLENDER}. Falta la celda que baja Blender."

        env, rechazadas = entorno_de(pedido)
        env["SALIDA"] = BUZON
        aviso = f"(ignore: {', '.join(rechazadas)})\n" if rechazadas else ""

        t0 = time.time()
        p = subprocess.run([BLENDER, "--background", "--python", guion],
                           capture_output=True, text=True, timeout=LIMITE,
                           cwd="/content", env=env)
        seg = time.time() - t0

        interesante = [l for l in p.stdout.splitlines()
                       if l.startswith(("PLACA:", "ARBOL:", "CASITA:",
                                        "ESCENA LISTA", "VIDEO LISTO", "Saved:"))]
        texto = (aviso + f"tardo: {seg:.1f} s\ncodigo de salida: {p.returncode}\n"
                 + "\n".join(interesante))
        if p.returncode:
            texto += "\n\n--- se rompio ---\n" + p.stdout[-2500:] + p.stderr[-1500:]
        return texto

    return f"no entiendo 'que': {que!r}. Los que entiendo: placa, listar, render"


def correr(ruta):
    nombre = os.path.basename(ruta)
    n = nombre[len("pedido-"):-len(".json")]
    print(f"[{ahora()}] atendiendo {nombre}")
    latir("atendiendo " + nombre)

    t0 = time.time()
    try:
        cuerpo = atender(json.load(open(ruta, encoding="utf-8")))
    except subprocess.TimeoutExpired:
        cuerpo = f"se paso de {LIMITE} s y lo corte."
    except Exception:
        cuerpo = "se rompio el obrero:\n" + traceback.format_exc()

    encabezado = (f"pedido: {nombre}\n"
                  f"termino: {datetime.datetime.now().isoformat(timespec='seconds')}\n"
                  f"vuelta completa: {time.time() - t0:.1f} s\n" + "-" * 60 + "\n")

    with open(os.path.join(BUZON, f"salida-{n}.txt"), "w") as f:
        f.write(encabezado + cuerpo)
    shutil.move(ruta, os.path.join(BUZON, "hechos", nombre))
    print(f"[{ahora()}] listo {nombre} -> salida-{n}.txt")


def main():
    if not os.path.isdir(BUZON):
        sys.exit(f"No encuentro {BUZON}. Falta montar el Drive.")
    os.makedirs(os.path.join(BUZON, "hechos"), exist_ok=True)

    print("Obrero mirando:", BUZON)
    print("Sabe hacer: placa, listar, render(" + ", ".join(sorted(GUIONES)) + ")")
    print(f"Una vuelta cada {ESPERA} s. Para salir, frena la celda.\n")
    latir("esperando")

    while True:
        try:
            for ruta in sorted(glob.glob(os.path.join(BUZON, "pedido-*.json"))):
                correr(ruta)
            latir("esperando")
        except Exception:
            print(f"[{ahora()}] vuelta fallida:\n{traceback.format_exc()}")
        time.sleep(ESPERA)


if __name__ == "__main__":
    main()
