#!/usr/bin/env python3
"""Incrusta los sonidos de un juego en un .js que se carga con <script>.

    python3 sonidos/incrustar.py ruta11 control-ruta11/js/sonidos.js

Genera dos constantes globales:
  SONIDOS_B64      {id: "<mp3 en base64>"}      (se decodifica con decodeAudioData)
  SONIDOS_CREDITOS [{id, autor, licencia, fuente}] de los que no son CC0,
                   para mostrarlos en los créditos del juego (CC-BY lo exige).
Además del manifiesto general, lee sonidos/<juego>/manifiesto.json si existe
(misma forma: lista de entradas con id, archivo relativo a sonidos/, licencia,
autor, fuente...), para que cada juego sume sus grabaciones sin pisar las otras.
Los mp3 van adentro del .js para que el descargable de un solo archivo ande
desde file:// (fetch no puede leer archivos locales).
"""
import base64, json, pathlib, sys

AQUI = pathlib.Path(__file__).resolve().parent


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    juego, salida = sys.argv[1], pathlib.Path(sys.argv[2])
    manifiesto = [m for m in json.loads((AQUI / "manifiesto.json").read_text()) if m["juego"] == juego]
    propio = AQUI / juego / "manifiesto.json"
    if propio.exists():
        vistos = {m["id"] for m in manifiesto}
        manifiesto += [m for m in json.loads(propio.read_text()) if m["id"] not in vistos]
    if not manifiesto:
        sys.exit(f"no hay sonidos para {juego}")
    datos = {m["id"]: base64.b64encode((AQUI / m["archivo"]).read_bytes()).decode() for m in manifiesto}
    creditos = [{k: m[k] for k in ("id", "autor", "licencia", "fuente")} for m in manifiesto if m["licencia"] != "CC0"]
    js = (
        '"use strict";\n'
        f"// Generado por sonidos/incrustar.py ({juego}). No editar a mano.\n"
        f"// Licencias y autores: sonidos/CREDITOS.md\n"
        f"const SONIDOS_CREDITOS = {json.dumps(creditos, ensure_ascii=False)};\n"
        "const SONIDOS_B64 = {\n"
        + "".join(f'"{k}":"{v}",\n' for k, v in datos.items())
        + "};\n"
    )
    salida.write_text(js)
    print(f"{salida}: {len(datos)} sonidos, {len(js) // 1024} KB")


if __name__ == "__main__":
    main()
