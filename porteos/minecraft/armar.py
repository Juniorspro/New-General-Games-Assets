#!/usr/bin/env python3
"""Junta el motor (juego/*.js) en un solo juego.js y arma el sitio con la página y los datos.

    python3 -I armar.py SALIDA        (SALIDA/datos ya tiene que estar: ver empaquetar.py)

El trabajador del mundo (generar, luz, mallas) corre en un Web Worker hecho con un Blob de su código:
así anda también en el .html único, sin archivos aparte. Su código va adentro de juego.js como texto.
"""
import json
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
J = AQUI / "juego"

TRABAJADOR = ["comun.js", "generador.js", "trabajador.js"]
PAGINA = ["comun.js", "generador.js", "gl.js", "textos.js", "modelos.js", "render.js", "mundo.js", "jugador.js", "sonido.js",
          "interfaz.js", "objetos.js", "bichos.js", "red.js", "principal.js"]
RAIZ = AQUI.parent.parent


def leer(n):
    return (J / n).read_text(encoding="utf-8")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sitio = Path(sys.argv[1])
    sitio.mkdir(parents=True, exist_ok=True)
    trabajador = "\n".join(leer(n) for n in TRABAJADOR)
    partes = ["var FUENTE_TRABAJADOR = " + json.dumps(trabajador) + ";\n"]
    for n in PAGINA:
        if (J / n).exists():
            partes.append(leer(n))
    (sitio / "juego.js").write_text("\n".join(partes), encoding="utf-8")
    shutil.copyfile(AQUI / "pagina" / "index.html", sitio / "index.html")
    # la intro de JXStudios y lo que en el APK hace Android (girar 90° con el teléfono parado, atrás =
    # pausa, pantalla completa, que no se apague): los mismos de los otros ports
    shutil.copyfile(RAIZ / "herramientas" / "porteo" / "intro.js", sitio / "porteo-intro.js")
    shutil.copyfile(RAIZ / "herramientas" / "porteo" / "web.js", sitio / "porteo-web.js")
    print("armar:", (sitio / "juego.js").stat().st_size, "bytes de juego.js")


if __name__ == "__main__":
    main()
