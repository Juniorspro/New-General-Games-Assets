#!/usr/bin/env python3
"""Arregla el reloj del port de FNaF 2 hecho en otra sesión (fnaf2-1.html).

    python3 porteos/fnaf2/corregir.py fnaf2-1.html fnaf2-corregido.html

El extractor de esa sesión leyó los cuadros por segundo un campo antes de
tiempo: en la cabecera de Clickteam "cantidad de pantallas" va justo antes de
"cuadros por segundo", y FNaF 2 tiene exactamente 27 pantallas. Con fps=27,
el intérprete descuenta 1000/27 ms por paso pero da 60 pasos por segundo:
todo temporizador del juego (el reloj de la noche, los movimientos de los
animatrónicos) va 2,2 veces más rápido. Medido: la hora duraba 33 s en vez de
70 y la noche 3,3 minutos en vez de 7. FNaF 4, misma herramienta y mismo
autor, leído en el lugar correcto, dice 60.

Toca sólo app.fps dentro de datos/juego.json (gzip + base64), así el
arranque del port no cambia.
"""
import base64
import gzip
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
fps = int(sys.argv[3]) if len(sys.argv) > 3 else 60
s = open(src, encoding="utf-8").read()
marca = "<script>window.__EMBEBIDOS="
ini = s.index(marca) + len(marca)
fin = s.index(";</script>", ini)
E = json.loads(s[ini:fin])
J = json.loads(gzip.decompress(base64.b64decode(E["datos/juego.json"]["b"])))
antes = J["app"]["fps"]
J["app"]["fps"] = fps
E["datos/juego.json"]["b"] = base64.b64encode(
    gzip.compress(json.dumps(J, separators=(",", ":"), ensure_ascii=False).encode(), 9, mtime=0)).decode()
open(dst, "w", encoding="utf-8").write(s[:ini] + json.dumps(E, separators=(",", ":")) + s[fin:])
print(f"fps {antes} → {fps} (el juego tiene {len(J['frames'])} pantallas) · {dst}")
