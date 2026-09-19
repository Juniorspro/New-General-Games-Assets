#!/usr/bin/env python3
"""Captura la pantalla X entera (no la pagina: la ventana con su marco).

    DISPLAY=:99 python3 captura.py salida.png

Pillow y numpy del sistema estan rotos en el contenedor, asi que esto corre
desde un venv:  python3 -m venv venv && venv/bin/pip install mss pillow
"""
import os
import sys

import mss

if len(sys.argv) != 2:
    sys.exit("uso: captura.py <salida.png>")

with mss.MSS(display=os.environ.get("DISPLAY", ":99")) as sct:
    sct.shot(mon=1, output=sys.argv[1])
print("guardada", sys.argv[1])
