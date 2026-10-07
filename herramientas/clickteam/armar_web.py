#!/usr/bin/env python3
"""Arma la carpeta web de un juego de Clickteam ya extraído con ccn.py.

    python3 armar_web.py EXTRAIDO/ DESTINO/ --clave fnaf4 [--titulo "FNaF 4"]

EXTRAIDO/ es la SALIDA de ccn.py (con datos/). DESTINO/ queda con index.html,
motor.js, principal.js y datos/: lista para pwa.py, un-archivo.py y armar.py.
"""
import argparse
import json
import shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("extraido", type=Path)
    ap.add_argument("destino", type=Path)
    ap.add_argument("--clave", required=True, help="nombre corto: es la clave de las partidas guardadas")
    ap.add_argument("--titulo")
    a = ap.parse_args()
    J = json.loads((a.extraido / "datos" / "juego.json").read_text("utf-8"))
    titulo = a.titulo or J["app"].get("titulo") or a.clave
    if a.destino.exists():
        shutil.rmtree(a.destino)
    shutil.copytree(a.extraido / "datos", a.destino / "datos")
    shutil.copy2(AQUI / "motor.js", a.destino / "motor.js")
    shutil.copy2(AQUI / "plantilla" / "principal.js", a.destino / "principal.js")
    cfg = json.dumps({"clave": a.clave, "titulo": titulo}, ensure_ascii=False)
    html = (AQUI / "plantilla" / "index.html").read_text("utf-8")
    html = html.replace("__TITULO__", titulo).replace("__CFG__", cfg)
    (a.destino / "index.html").write_text(html, "utf-8")
    peso = sum(p.stat().st_size for p in a.destino.rglob("*") if p.is_file())
    print(f"{a.destino}: {titulo}, {peso / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
