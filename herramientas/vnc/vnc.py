# Mandar una secuencia de acciones al VNC del Colab, en UNA sola conexion.
#
# Por que una sola: LocalTunnel no acepta una segunda conexion mientras la
# primera vive, asi que abrir una por accion no funciona.
#
#   uso: vnc.py CLAVE '[{"clic":[83,31]},{"esperar":1},{"ver":"a.png"}]'
#
# acciones: {"mover":[x,y]} {"clic":[x,y]} {"doble":[x,y]} {"escribir":"txt"}
#           {"tecla":"Return"} {"esperar":seg} {"ver":"archivo.png"}
import json, logging, sys
logging.getLogger().setLevel(logging.ERROR)
from vncdotool import api

CLAVE, PASOS = sys.argv[1], json.loads(sys.argv[2])
SALIDA = "/tmp/claude-0/-home-user-New-General-Games-Assets/57b5d8d7-231a-50f9-908d-9d8393f4adb3/scratchpad"

cli = api.connect("127.0.0.1::5901", password=CLAVE)
cli.timeout = 120
try:
    for i, paso in enumerate(PASOS):
        (accion, valor), = paso.items()
        if accion == "mover":
            cli.mouseMove(*valor)
        elif accion == "clic":
            cli.mouseMove(*valor); cli.mousePress(1)
        elif accion == "doble":
            cli.mouseMove(*valor); cli.mousePress(1); cli.mousePress(1)
        elif accion == "escribir":
            cli.type(valor)
        elif accion == "tecla":
            cli.keyPress(valor)
        elif accion == "esperar":
            cli.pause(valor)
        elif accion == "ver":
            cli.captureScreen(f"{SALIDA}/{valor}")
        else:
            print(f"  paso {i}: no entiendo {accion!r}"); continue
        print(f"  {i}: {accion} {valor}")
finally:
    api.shutdown()
