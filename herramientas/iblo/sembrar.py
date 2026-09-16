#!/usr/bin/env python3
"""Carga en la base el contenido que hoy está escrito adentro del HTML.

NORMALMENTE NO HACE FALTA: el panel trae el mismo contenido adentro y lo carga
con el botón «Traer las que ya están en la web», sin terminal y sin contraseña.
Esto queda para cargarlo desde acá si alguna vez conviene, o para mirar con
`--ver` qué hay en la base.

Por qué hace falta: la página trae su copia como respaldo y la base arranca
vacía, así que mientras nadie publique nada desde el panel se ve lo de siempre.
Sembrar es lo que hace que el panel abra con las nueve estéticas ya cargadas en
vez de con una lista vacía, que es lo que asusta al que la va a usar.

    export IBLO_USUARIO=iblo
    export IBLO_CLAVE=...            # la del panel; no queda en ningún archivo
    python3 herramientas/iblo/sembrar.py
    python3 herramientas/iblo/sembrar.py --ver     # sólo mira qué hay cargado
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request

API = os.environ.get("IBLO_API", "https://iblo-eventos.pages.dev/api")
AQUI = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(AQUI, "contenido-inicial.json")


def llamar(ruta, datos=None, metodo=None, token=None):
    # sin User-Agent, Cloudflare le contesta 403 a urllib y parece que la ruta
    # no existiera; con uno cualquiera pasa
    cab = {"Content-Type": "application/json", "User-Agent": "iblo-sembrar/1.0"}
    if token:
        cab["Authorization"] = "Bearer " + token
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    req = urllib.request.Request(API + ruta, data=cuerpo, headers=cab, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def main():
    st, d = llamar("/sitio")
    if st != 200:
        raise SystemExit("IBLO: /api/sitio contestó %d. ¿Está desplegado?" % st)
    hay = {k: (len(v) if isinstance(v, list) else 1) for k, v in (d.get("areas") or {}).items()}
    print("IBLO: en la base hay %s" % (hay or "nada todavía"))
    if "--ver" in sys.argv:
        return
    if hay.get("esteticas"):
        print("IBLO: ya hay estéticas cargadas. No piso nada; usá el panel.")
        return

    usuario = os.environ.get("IBLO_USUARIO", "iblo")
    clave = os.environ.get("IBLO_CLAVE", "")
    if not clave:
        raise SystemExit("IBLO: falta IBLO_CLAVE (la contraseña del panel).")

    st, s = llamar("/login", {"usuario": usuario, "clave": clave}, "POST")
    token = s.get("sesion") or s.get("token")
    if st != 200 or not token:
        raise SystemExit("IBLO: no pude entrar (%d): %s" % (st, s.get("error", "")))

    doc = json.load(open(DOC, encoding="utf8"))
    for area in ("esteticas", "marca"):
        st, r = llamar("/sitio", {"area": area, "valor": doc[area]}, "PUT", token)
        if st != 200:
            raise SystemExit("IBLO: falló %s (%d): %s" % (area, st, r.get("error", "")))
        n = len(doc[area]) if isinstance(doc[area], list) else 1
        print("IBLO: %s cargada (%d)" % (area, n))
    print("IBLO: listo. Abrí el panel en «La página».")


if __name__ == "__main__":
    main()
