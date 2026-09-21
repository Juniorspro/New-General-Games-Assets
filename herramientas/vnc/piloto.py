# Piloto: mantiene UNA sola conexion VNC abierta y ejecuta las ordenes que le
# van apareciendo en una carpeta.
#
# Por que asi: reconectar a traves de LocalTunnel es poco confiable — la
# primera conexion entra, la segunda falla con "did not receive a valid HTTP
# response". Una sesion por tunel SI funciona. Entonces la conexion se abre una
# vez y se queda; las ordenes entran por archivo.
#
#   orden-NNN.json   una lista de acciones   -> la dejo yo
#   hecho-NNN.txt    que paso                -> la deja el piloto
#   piloto-vivo.txt  latido
#
# acciones: {"mover":[x,y]} {"clic":[x,y]} {"doble":[x,y]} {"escribir":"txt"}
#           {"tecla":"Return"} {"combo":"ctrl-pgdn"} {"esperar":s} {"ver":"a.png"}
import datetime, glob, json, logging, os, sys, time, traceback
logging.getLogger().setLevel(logging.ERROR)
from vncdotool import api

CLAVE = sys.argv[1]
BASE  = os.path.dirname(os.path.abspath(__file__))
COLA  = os.path.join(BASE, "cola")
os.makedirs(COLA, exist_ok=True)


def latir(estado):
    try:
        with open(os.path.join(COLA, "piloto-vivo.txt"), "w") as f:
            f.write(datetime.datetime.now().isoformat(timespec="seconds") + "\n" + estado + "\n")
    except Exception:
        pass


def hacer(cli, pasos):
    hechos = []
    for i, paso in enumerate(pasos):
        (accion, valor), = paso.items()
        if   accion == "mover":    cli.mouseMove(*valor)
        elif accion == "clic":     cli.mouseMove(*valor); cli.mousePress(1)
        elif accion == "doble":    cli.mouseMove(*valor); cli.mousePress(1); cli.mousePress(1)
        elif accion == "escribir": cli.type(valor)
        elif accion == "tecla":    cli.keyPress(valor)
        elif accion == "combo":    cli.keyPress(valor)
        elif accion == "esperar":  cli.pause(valor)
        elif accion == "ver":      cli.captureScreen(os.path.join(BASE, valor))
        else:
            hechos.append(f"{i}: NO ENTIENDO {accion!r}"); continue
        hechos.append(f"{i}: {accion} {valor}")
    return hechos


def main():
    print("conectando...", flush=True)
    cli = api.connect("127.0.0.1::5901", password=CLAVE)
    cli.timeout = 180
    print("CONECTADO. La conexion queda abierta.", flush=True)
    latir("conectado, esperando ordenes")

    while True:
        try:
            for ruta in sorted(glob.glob(os.path.join(COLA, "orden-*.json"))):
                n = os.path.basename(ruta)[len("orden-"):-len(".json")]
                latir("ejecutando orden " + n)
                print(f"--- orden {n}", flush=True)
                try:
                    hechos = hacer(cli, json.load(open(ruta, encoding="utf-8")))
                    cuerpo = "OK\n" + "\n".join(hechos)
                except Exception:
                    cuerpo = "SE ROMPIO\n" + traceback.format_exc()
                with open(os.path.join(COLA, f"hecho-{n}.txt"), "w") as f:
                    f.write(cuerpo)
                os.remove(ruta)
                print(cuerpo, flush=True)
            latir("esperando ordenes")
        except Exception:
            print("vuelta fallida:\n" + traceback.format_exc(), flush=True)
        time.sleep(2)


main()
