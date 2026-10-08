#!/usr/bin/env python3
"""La imagen de la pantalla de carga, su fondo y el ícono de la app, sacados del juego: la portada
del menú principal (el objeto "Cover" de la escena Main, una Image de uGUI con su sprite).

    python3 -I carga.py "Bad Parenting 1_Data" SALIDA/

Deja en SALIDA: poster.png (la portada), poster-256.webp (para la pantalla de carga), icono.png
(512×512, para la app instalable) y menu.png (la portada sobre el verde del menú, 16:9: el
empaquetador la difumina de fondo). Correr con python -I (los datos del juego no ejecutan nada).
"""
import sys
from pathlib import Path

import UnityPy
from PIL import Image
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator

VERDE_MENU = (41, 61, 52)   # el fondo del menú (Background)


def portada(datos: Path) -> Image.Image:
    env = UnityPy.load(str(datos / "level1"), str(datos / "sharedassets1.assets"), str(datos / "resources.assets"))
    gen = TypeTreeGenerator("2022.2.0b16")
    gen.load_local_dll_folder(str(datos / "Managed"))
    env.typetree_generator = gen
    nodos = gen.get_nodes_up("UnityEngine.UI", "UnityEngine.UI.Image")
    cover = None
    for o in env.objects:
        if o.type.name == "GameObject" and o.read().m_Name == "Cover":
            cover = o.read()
            break
    if cover is None:
        raise SystemExit("no está el objeto Cover en la escena del menú (level1)")
    for c in cover.m_Components:
        comp = c.component if hasattr(c, "component") else c
        try:
            obj = comp.deref()
        except Exception:
            continue
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            t = obj.read_typetree(nodes=nodos, check_read=False)
        except Exception:
            continue
        sp = t.get("m_Sprite")
        if not sp or not sp.get("m_PathID"):
            continue
        # el sprite puede estar en otro archivo: m_FileID cuenta desde 1 en la lista de externos
        archivo = obj.assets_file
        if sp["m_FileID"] != 0:
            nombre = Path(archivo.externals[sp["m_FileID"] - 1].path).name
            archivo = next((f for k, f in env.files.items() if Path(k).name == nombre), None)
        sprite = archivo.objects[sp["m_PathID"]].read() if archivo is not None and sp["m_PathID"] in archivo.objects else None
        if sprite is not None:
            return sprite.image.convert("RGB")
    raise SystemExit("la portada no tiene sprite")


def main():
    datos, salida = Path(sys.argv[1]), Path(sys.argv[2])
    salida.mkdir(parents=True, exist_ok=True)
    p = portada(datos)
    p.save(salida / "poster.png")
    p.resize((int(256 * p.width / p.height), 256), Image.LANCZOS).save(salida / "poster-256.webp", quality=90)
    icono = Image.new("RGB", (512, 512), VERDE_MENU)
    q = p.resize((int(512 * p.width / p.height), 512), Image.LANCZOS)
    icono.paste(q, ((512 - q.width) // 2, 0))
    icono.save(salida / "icono.png")
    menu = Image.new("RGB", (1280, 720), VERDE_MENU)
    r = p.resize((int(600 * p.width / p.height), 600), Image.LANCZOS)
    menu.paste(r, (150, 60))
    menu.save(salida / "menu.png")
    print(f"portada {p.size}: {salida}")


if __name__ == "__main__":
    main()
