#!/usr/bin/env python3
"""Mete la pantalla «La página» adentro del panel, sin editarlo a mano.

Igual que `enchufar.py` pero del lado del panel: inserta el CSS, el botón de la
solapa, la sección y el guion, todo entre marcas, así se puede volver a correr
cada vez que cambie alguno de los tres archivos sueltos de esta carpeta y no se
duplica nada. La alternativa —pegar quince mil caracteres a mano adentro de un
HTML de ciento sesenta mil— es cómo se rompen los paneles.

    python3 herramientas/iblo/enchufar-panel.py
    python3 herramientas/iblo/enchufar-panel.py --sacar
"""
import os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PANEL = os.path.normpath(os.path.join(AQUI, "..", "..", "docs", "paginas", "iblo-app.html"))

MARCAS = [
    ("/* IBLO-PAGINA-CSS */", "/* FIN IBLO-PAGINA-CSS */"),
    ("<!-- IBLO-PAGINA-SOLAPA -->", "<!-- FIN IBLO-PAGINA-SOLAPA -->"),
    ("<!-- IBLO-PAGINA-SECCION -->", "<!-- FIN IBLO-PAGINA-SECCION -->"),
    ("<!-- IBLO-PAGINA-JS -->", "<!-- FIN IBLO-PAGINA-JS -->"),
]

SOLAPA = """<button data-p="pPagina">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/></svg>La página</button>"""


def sacar(s):
    for a, b in MARCAS:
        s = re.sub(re.escape(a) + r".*?" + re.escape(b) + r"\n?", "", s, flags=re.S)
    return s


def poner(s):
    s = sacar(s)
    css = open(os.path.join(AQUI, "panel-pagina.css"), encoding="utf8").read()
    html = open(os.path.join(AQUI, "panel-pagina.html"), encoding="utf8").read()
    js = open(os.path.join(AQUI, "panel-pagina.js"), encoding="utf8").read()

    s = s.replace("</style>", MARCAS[0][0] + "\n" + css + MARCAS[0][1] + "\n</style>", 1)

    # la solapa va al final de la barra, antes de la de Ajustes si existe
    m = re.search(r'(\s*)<button data-p="pAjustes">', s)
    if m:
        s = s[:m.start()] + m.group(1) + MARCAS[1][0] + SOLAPA + MARCAS[1][1] + s[m.start():]
    else:
        s = s.replace("</nav>", MARCAS[1][0] + SOLAPA + MARCAS[1][1] + "\n  </nav>", 1)

    # la sección, después de la última que haya
    m = re.search(r'<section class="pant" id="pAjustes"', s)
    if not m:
        raise SystemExit("IBLO: no encontré dónde poner la sección")
    s = s[:m.start()] + MARCAS[2][0] + "\n" + html + MARCAS[2][1] + "\n\n    " + s[m.start():]

    bloque = (MARCAS[3][0] + "\n<script>\n" + js + "\n</script>\n" + MARCAS[3][1] + "\n")
    # el panel no cierra <body>: el guion va al final del archivo, después del
    # <script> principal, que es donde están definidos `irA` y `pedir`
    if "</body>" in s:
        s = s.replace("</body>", bloque + "</body>", 1)
    else:
        s = s.rstrip() + "\n" + bloque
    return s


def main():
    s = open(PANEL, encoding="utf8").read()
    antes = len(s)
    s2 = sacar(s) if "--sacar" in sys.argv else poner(s)
    if s2 != s:
        open(PANEL, "w", encoding="utf8").write(s2)
    ok = all(a in s2 for a, _ in MARCAS) if "--sacar" not in sys.argv else True
    print("IBLO: panel %s · %+d bytes · marcas %s" % (
        "limpio" if "--sacar" in sys.argv else "enchufado", len(s2) - antes, "ok" if ok else "FALTAN"))


if __name__ == "__main__":
    main()
