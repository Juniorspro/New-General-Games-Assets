#!/usr/bin/env python3
# Manejar Kaggle desde esta sesion: mandar un kernel, mirarlo y bajar lo que dejo.
#
# Por que Kaggle y no Colab: Colab gratis no tiene API, asi que siempre hace
# falta un navegador de una persona. Kaggle SI tiene API, entonces el trabajo
# se manda desde aca y corre con todo lo del usuario apagado.
#
# Las credenciales van por entorno, NUNCA en un archivo del repo — el repo es
# publico y un git push las publicaria:
#
#   export KAGGLE_USERNAME=...
#   export KAGGLE_KEY=...
#
#   python3 kg.py probar              # el kernel que solo late (la prueba clave)
#   python3 kg.py render arbol MUESTRAS=512 ANCHO=1920 ALTO=1440
#   python3 kg.py estado <slug>
#   python3 kg.py log <slug>
#   python3 kg.py bajar <slug> <carpeta>
import json, os, re, shutil, subprocess, sys, tempfile

BASE = os.path.dirname(os.path.abspath(__file__))
USUARIO = os.environ.get("KAGGLE_USERNAME")
if not USUARIO:
    sys.exit("Falta KAGGLE_USERNAME (y KAGGLE_KEY) en el entorno.")

KAGGLE = shutil.which("kaggle") or os.path.expanduser(
    "~/.local/bin/kaggle")


def kaggle(*args, mostrar=True):
    p = subprocess.run([KAGGLE, *args], capture_output=True, text=True)
    salida = (p.stdout or "") + (p.stderr or "")
    if mostrar:
        print(salida.rstrip())
    return p.returncode, salida


def mandar(slug, guion_py, titulo, gpu=True, internet=True):
    """Arma la carpeta con el script y su metadata, y la empuja."""
    carpeta = tempfile.mkdtemp(prefix="kg-")
    shutil.copy(guion_py, os.path.join(carpeta, "script.py"))
    meta = {
        "id": f"{USUARIO}/{slug}",
        "title": titulo,
        "code_file": "script.py",
        "language": "python",
        "kernel_type": "script",      # script, no notebook: mas simple de armar
        "is_private": True,
        "enable_gpu": gpu,
        "enable_internet": internet,  # sin esto no baja Blender ni clona el repo
        "dataset_sources": [],
        "competition_sources": [],
        "kernel_sources": [],
    }
    with open(os.path.join(carpeta, "kernel-metadata.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"-> empujando {USUARIO}/{slug}  (gpu={gpu}, internet={internet})")
    codigo, _ = kaggle("kernels", "push", "-p", carpeta)
    return codigo


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    orden = sys.argv[1]

    if orden == "probar":
        # el kernel que decide si `logs` habla en vivo
        mandar("claude-probar-logs", os.path.join(BASE, "probar.py"),
               "claude probar logs")
        print("\nAhora, cada tanto:  python3 kg.py log claude-probar-logs")
        print("Si aparecen LATIDOs antes de que diga TERMINE, el log habla en vivo.")

    elif orden == "render":
        if len(sys.argv) < 3:
            sys.exit("uso: kg.py render <arbol|casita|pelota|video> [VAR=valor ...]")
        guion = sys.argv[2]
        entorno = {}
        for par in sys.argv[3:]:
            k, _, v = par.partition("=")
            if not re.match(r"^[A-Z_]{2,20}$", k) or not re.match(r"^[A-Za-z0-9_.-]{1,24}$", v):
                sys.exit(f"parametro raro: {par!r}")
            entorno[k] = v
        entorno.setdefault("DISPOSITIVO", "GPU")

        # los kernels no reciben argumentos: los parametros se escriben adentro
        fuente = open(os.path.join(BASE, "render.py"), encoding="utf-8").read()
        nuevo = "PARAMS = " + json.dumps({"guion": guion, "entorno": entorno}) + "   # kg.py"
        fuente = re.sub(r"^PARAMS = .*# kg\.py$", nuevo, fuente, count=1, flags=re.M)
        tmp = os.path.join(tempfile.mkdtemp(prefix="kg-r-"), "render.py")
        open(tmp, "w", encoding="utf-8").write(fuente)
        print("parametros:", nuevo)
        mandar(f"claude-render-{guion}", tmp, f"claude render {guion}")
        print(f"\nDespues:  python3 kg.py log claude-render-{guion}")
        print(f"          python3 kg.py bajar claude-render-{guion} ./salida")

    elif orden == "estado":
        kaggle("kernels", "status", f"{USUARIO}/{sys.argv[2]}")

    elif orden == "log":
        kaggle("kernels", "logs", f"{USUARIO}/{sys.argv[2]}")

    elif orden == "bajar":
        destino = sys.argv[3] if len(sys.argv) > 3 else "./salida"
        os.makedirs(destino, exist_ok=True)
        kaggle("kernels", "output", f"{USUARIO}/{sys.argv[2]}", "-p", destino)
        for a in sorted(os.listdir(destino)):
            print(f"  {os.path.getsize(os.path.join(destino, a)):>12}  {a}")

    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
