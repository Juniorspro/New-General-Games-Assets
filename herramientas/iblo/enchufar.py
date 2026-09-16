#!/usr/bin/env python3
"""Enchufa el cargador de contenido en las páginas del sitio.

POR QUÉ UN SCRIPT Y NO EDITARLAS A MANO: son cinco archivos de hasta dos megas
con la misma cosa adentro, y editarlos a mano es exactamente el problema que
estamos resolviendo. Esto es idempotente —se puede correr todas las veces que
haga falta— porque lo que inserta va entre marcas y se reemplaza en lugar de
duplicarse.

Hace dos cambios por página:

1. Antes del bloque de datos, un preámbulo que lee la copia local de lo que el
   dueño cambió. Y `var ESTETICAS = [` pasa a `var ESTETICAS = usadas.length ?
   usadas : [`, así el HTML sigue trayendo su lista como respaldo y la de la
   base gana cuando existe. Sin esto, el visitante vería la lista vieja un
   instante antes del cambio.
2. Al final, el cargador, que pide /api/sitio, retiñe con las paletas nuevas y
   guarda la copia para la próxima visita.

    python3 herramientas/iblo/enchufar.py            # todas
    python3 herramientas/iblo/enchufar.py --sacar    # las deja como estaban
"""
import os, re, sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PAGS = ["docs/paginas/iblo.html", "docs/paginas/iblo-esteticas.html",
        "docs/paginas/iblo-servicios.html", "docs/paginas/m/iblo.html",
        "docs/paginas/m/iblo-esteticas.html"]

A1, A2 = "/* IBLO-PREAMBULO */", "/* FIN IBLO-PREAMBULO */"
B1, B2 = "<!-- IBLO-CARGADOR -->", "<!-- FIN IBLO-CARGADOR -->"

PRE = (A1 + """
var __IBC=null; try{__IBC=JSON.parse(localStorage.getItem("iblo.sitio.v1")||"null");}catch(e){}
var __IBE=((__IBC&&__IBC.esteticas)||[]).filter(function(x){return !x.oculta;});
""" + A2 + "\n")

VIEJO = "var ESTETICAS = ["
NUEVO = "var ESTETICAS = __IBE.length ? __IBE : ["


def sacar(s):
    s = re.sub(re.escape(A1) + r".*?" + re.escape(A2) + r"\n?", "", s, flags=re.S)
    s = re.sub(re.escape(B1) + r".*?" + re.escape(B2) + r"\n?", "", s, flags=re.S)
    return s.replace(NUEVO, VIEJO)


def poner(s, cargador):
    s = sacar(s)
    if VIEJO not in s:
        return s, "sin bloque de datos"
    s = s.replace(VIEJO, PRE + NUEVO, 1)
    bloque = B1 + "\n<script>\n" + cargador + "\n</script>\n" + B2 + "\n"
    if "</body>" in s:
        s = s.replace("</body>", bloque + "</body>", 1)
    else:
        s = s + "\n" + bloque
    return s, "ok"


def main():
    quitar = "--sacar" in sys.argv
    cargador = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cargador.js"),
                    encoding="utf8").read()
    for rel in PAGS:
        ruta = os.path.normpath(os.path.join(RAIZ, rel))
        if not os.path.exists(ruta):
            print("IBLO: falta %s" % rel); continue
        s = open(ruta, encoding="utf8").read()
        antes = len(s)
        if quitar:
            s2, est = sacar(s), "sacado"
        else:
            s2, est = poner(s, cargador)
        if s2 != s:
            open(ruta, "w", encoding="utf8").write(s2)
        print("IBLO: %-34s %-18s %+d bytes" % (rel, est, len(s2) - antes))


if __name__ == "__main__":
    main()
