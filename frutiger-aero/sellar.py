#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le pone a cada archivo cacheable el hash de su contenido en el nombre y
arregla las referencias.

POR QUÉ EXISTE: `immutable` es una promesa —«esta URL nunca cambia de
contenido»— y ya se rompió una vez en este sitio: se reemplazaron las imágenes
con el mismo nombre y el navegador del dueño siguió mostrando las viejas
durante un año, porque se lo habíamos pedido. Con el hash en el nombre eso no
puede volver a pasar: si cambia el archivo, cambia la URL.

Hasta ahora se hacía a mano y el mapa quedaba en `nombres.json`. Esto lo hace
solo, y es idempotente: correrlo dos veces no cambia nada.

    python3 sellar.py
"""
import hashlib, json, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SITIO = os.path.join(AQUI, "sitio")
# base -> dónde se lo nombra
SELLAR = ["css/aero.css", "js/escritorio.js", "js/social.js", "audio/tema.mp3"]
DONDE = ["index.html", "404.html", "solicitudes.html",
         "css/aero.css", "js/escritorio.js", "js/social.js"]


def hash8(ruta):
    with open(ruta, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:8]


def sellar():
    mapa = {}
    for rel in SELLAR:
        carpeta, archivo = os.path.split(rel)
        base, ext = os.path.splitext(archivo)
        dir_abs = os.path.join(SITIO, carpeta)
        # ¿ya está sellado de una corrida anterior?
        viejos = [f for f in os.listdir(dir_abs)
                  if re.fullmatch(re.escape(base) + r"\.[0-9a-f]{8}" + re.escape(ext), f)]
        crudo = os.path.join(dir_abs, archivo)

        if os.path.exists(crudo):
            h = hash8(crudo)
            nuevo = "%s.%s%s" % (base, h, ext)
            for v in viejos:
                if v != nuevo:
                    os.remove(os.path.join(dir_abs, v))
            os.replace(crudo, os.path.join(dir_abs, nuevo))
        elif len(viejos) == 1:
            # OJO: que tenga nombre de sellado no quiere decir que el nombre
            # siga siendo verdad. Si alguien editó el archivo ya sellado, el
            # hash del nombre miente y `immutable` pasa a ser una promesa rota.
            # Se vuelve a calcular siempre.
            h = hash8(os.path.join(dir_abs, viejos[0]))
            nuevo = "%s.%s%s" % (base, h, ext)
            if nuevo != viejos[0]:
                os.replace(os.path.join(dir_abs, viejos[0]), os.path.join(dir_abs, nuevo))
        else:
            sys.exit("no encuentro %s (ni sellado ni crudo)" % rel)

        mapa[rel] = os.path.join(carpeta, nuevo).replace(os.sep, "/")
    return mapa


def arreglar(mapa):
    # cualquier referencia al nombre base o a un sellado viejo pasa al nuevo
    tocados = []
    for rel in DONDE:
        p = os.path.join(SITIO, rel)
        if not os.path.exists(p):
            continue
        s = original = open(p, encoding="utf-8").read()
        for base, nuevo in mapa.items():
            carpeta, archivo = os.path.split(base)
            raiz, ext = os.path.splitext(archivo)
            patron = re.escape(carpeta + "/" + raiz) + r"(?:\.[0-9a-f]{8})?" + re.escape(ext)
            # desde css/ y js/ se referencia con ../
            s = re.sub(r"(\.\./)?" + patron,
                       lambda m: (m.group(1) or "") + nuevo, s)
        if s != original:
            open(p, "w", encoding="utf-8").write(s)
            tocados.append(rel)
    return tocados


if __name__ == "__main__":
    mapa = sellar()
    tocados = arreglar(mapa)
    # la fuente se sella a mano cuando se la baja; se anota igual, para que el
    # mapa sea el inventario completo de lo que promete ser inmutable
    for f in sorted(os.listdir(os.path.join(SITIO, "fuentes"))):
        if f.endswith(".woff2"):
            mapa["fuentes/" + re.sub(r"\.[0-9a-f]{8}\.woff2$", ".woff2", f)] = "fuentes/" + f
    json.dump(mapa, open(os.path.join(AQUI, "nombres.json"), "w"),
              indent=1, ensure_ascii=False, sort_keys=True)
    for k, v in sorted(mapa.items()):
        print("%-22s -> %s" % (k, v))
    print("referencias arregladas en:", ", ".join(tocados) or "nada")
