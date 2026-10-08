#!/usr/bin/env python3
"""Lo que contaron las páginas (herramientas/porteo/registro.js) en el KV del registro.

    export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
    python3 registro.py TITULO_DEL_KV [--horas 24] [--sesion ID]

Una línea por evento, agrupadas por visita: cuándo, el teléfono (el navegador), el segundo de la
visita, el tipo (equipo, datos, motor, escena, menu, error, consola, fallo, contexto…) y el dato.
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from subir import Cloudflare, morir  # noqa: E402


def leer(cf, ns, clave):
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{cf.cuenta}/storage/kv/namespaces/{ns}/values/"
                                 + urllib.parse.quote(clave, safe=""), headers={"Authorization": "Bearer " + cf.token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("kv", help="el título del KV (el de subir.py --registro-kv)")
    ap.add_argument("--horas", type=float, default=24, help="de cuántas horas para atrás")
    ap.add_argument("--sesion", help="sólo esa visita")
    a = ap.parse_args()
    cf = Cloudflare(os.environ.get("CLOUDFLARE_API_TOKEN", "").strip(), os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip())
    if not cf.token or not cf.cuenta:
        morir("faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID")
    ns = next((n["id"] for n in cf("GET", f"/accounts/{cf.cuenta}/storage/kv/namespaces?per_page=100").get("result") or []
               if n.get("title") == a.kv), None)
    if not ns:
        morir(f"no hay un KV {a.kv}")
    desde = (time.time() - a.horas * 3600) * 1000
    claves, cursor = [], ""
    while True:
        r = cf("GET", f"/accounts/{cf.cuenta}/storage/kv/namespaces/{ns}/keys?limit=1000" + (f"&cursor={cursor}" if cursor else ""))
        for k in r.get("result") or []:
            # la clave empieza con el momento en base 36 (ver _worker.js)
            if int(k["name"].split("-")[0], 36) >= desde:
                claves.append(k)
        cursor = (r.get("result_info") or {}).get("cursor")
        if not cursor:
            break
    visitas = {}
    for k in sorted(claves, key=lambda k: k["name"]):
        try:
            d = json.loads(leer(cf, ns, k["name"]))
        except Exception as e:
            print("(no se pudo leer", k["name"], e, ")")
            continue
        if a.sesion and d.get("s") != a.sesion:
            continue
        cuando = time.strftime("%d/%m %H:%M:%S", time.localtime(int(k["name"].split("-")[0], 36) / 1000))
        v = visitas.setdefault(d.get("s"), {"ua": (k.get("metadata") or {}).get("ua", ""), "lineas": []})
        for t, tipo, dato in d.get("e") or []:
            v["lineas"].append((cuando, t / 1000, tipo, dato))
    for s, v in visitas.items():
        print(f"── visita {s} · {v['ua']}")
        for cuando, t, tipo, dato in v["lineas"]:
            texto = dato if isinstance(dato, str) else json.dumps(dato, ensure_ascii=False)
            print(f"   {cuando}  {t:7.1f}s  {tipo:9s} {texto[:400]}")


if __name__ == "__main__":
    main()
