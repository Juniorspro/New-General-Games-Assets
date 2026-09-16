#!/usr/bin/env python3
"""Arma pique-en-un-archivo.html: el juego entero en un solo HTML.

Por que hace falta: el juego son doce modulos de JavaScript, y un modulo
cargado desde file:// lo bloquea CORS en todos los navegadores, con un error
que habla de origenes y parece un problema de red. Un solo archivo con todo
adentro, y sin `type="module"`, se abre con doble clic y listo.

Como: cada modulo se envuelve en una funcion que devuelve sus exportaciones, y
los `import` se reescriben como lecturas de ese objeto. No se pueden pegar los
archivos uno atras del otro: `crear` existe en entidades.js Y en interfaz.js,
y `moneda`, `paso` y `tiles` tambien chocan. Pegados, el ultimo se come al
primero y el juego rompe en un lugar que no tiene nada que ver.
"""
import re, pathlib, sys

BASE = pathlib.Path(__file__).parent
# Orden de dependencias. A mano y no calculado: son doce archivos y el grafo
# no cambia; un resolvedor seria mas codigo que el que resuelve.
ORDEN = ["mundo", "azar", "guardado", "audio", "fisica", "piezas",
         "entidades", "dibujo", "generador", "juego", "interfaz"]
ENTRADA = "main"

RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*"\./(\w+)\.js";\s*$', re.M)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s*(\w+)\s*from\s*"\./(\w+)\.js";\s*$', re.M)
RE_EXP_DECL = re.compile(r'^export\s+(?:const|let|var|function|class)\s+(\w+)', re.M)
RE_EXP_LISTA = re.compile(r'^export\s*\{([^}]*)\};\s*$', re.M)


def exportaciones(src):
    nombres = list(RE_EXP_DECL.findall(src))
    for grupo in RE_EXP_LISTA.findall(src):
        for parte in grupo.split(","):
            parte = parte.strip()
            if parte:
                nombres.append(parte.split(" as ")[-1].strip())
    # sin repetir, conservando el orden
    vistos, limpio = set(), []
    for n in nombres:
        if n not in vistos:
            vistos.add(n); limpio.append(n)
    return limpio


def convertir(nombre, src):
    exps = exportaciones(src)

    def imp_nom(m):
        crudo, mod = m.group(1), m.group(2)
        partes = []
        for p in crudo.split(","):
            p = p.strip()
            if not p:
                continue
            if " as " in p:
                a, b = [x.strip() for x in p.split(" as ")]
                partes.append(f"{a}: {b}")
            else:
                partes.append(p)
        return "const { " + ", ".join(partes) + f" }} = M_{mod};"

    src = RE_IMP_NOM.sub(imp_nom, src)
    src = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{m.group(2)};", src)
    src = RE_EXP_LISTA.sub("", src)
    src = re.sub(r'^export\s+', "", src, flags=re.M)
    cuerpo = src.rstrip()
    devuelve = "return { " + ", ".join(exps) + " };"
    return f"/* ── {nombre}.js ── */\nconst M_{nombre} = (() => {{\n{cuerpo}\n{devuelve}\n}})();\n"


def main():
    partes = []
    for nombre in ORDEN:
        src = (BASE / "js" / f"{nombre}.js").read_text(encoding="utf-8")
        partes.append(convertir(nombre, src))

    ent = (BASE / "js" / f"{ENTRADA}.js").read_text(encoding="utf-8")
    ent = RE_IMP_NOM.sub(lambda m: convertir("_", m.group(0)).split("\n")[2], ent)
    ent = RE_IMP_NOM.sub("", ent)
    ent = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{m.group(2)};", ent)
    ent = re.sub(r'^export\s+', "", ent, flags=re.M)
    partes.append(f"/* ── {ENTRADA}.js ── */\n(() => {{\n{ent}\n}})();\n")

    partes.append("/* los modulos, expuestos para las pruebas */\n"
                  + "\n".join(f"window.M_{n} = M_{n};" for n in ORDEN) + "\n")
    js = "\n".join(partes)
    css = (BASE / "css" / "pique.css").read_text(encoding="utf-8")
    html = (BASE / "index.html").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/pique.css">',
                        "<style>\n" + css + "\n</style>")
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        "<script>\n" + js + "\n</script>")
    html = html.replace("</title>", " — un solo archivo</title>")

    destino = BASE / "pique-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = destino.stat().st_size / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(ORDEN) + 1} modulos adentro")
    if "import " in js or re.search(r'^export ', js, re.M):
        print("OJO: quedo un import/export suelto", file=sys.stderr); sys.exit(1)


main()
