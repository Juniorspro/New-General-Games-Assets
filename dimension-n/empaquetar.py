#!/usr/bin/env python3
"""Dimensión Ñ en un solo archivo HTML, para abrir con doble clic.

QUE RESUELVE. Un módulo ES cargado desde file:// lo bloquea CORS: el juego
abierto sin servidor muestra una página en blanco y un error de origen en la
consola. Y ocho archivos sueltos no se mandan por mail.

COMO. Cada módulo se envuelve en una función que devuelve sus exportaciones y
los imports se vuelven una desestructuración de esa función. Es el mismo grafo
de dependencias, resuelto a mano: por eso el ORDEN de la lista importa —un
módulo tiene que estar armado antes de que otro lo lea— y por eso no hay
ciclos.

LO QUE HACE FÁCIL ESTE JUEGO. No hay un solo binario: el dibujo es vectorial y
el sonido son osciladores. El empaquetado es texto pegado a texto, así que el
archivo entero pesa lo mismo que el código, no lo que pesan los assets en
base64.
"""
import pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
ORDEN = ["verlet", "cuerpo", "nivel", "juego", "dibujo", "audio", "guardado"]
ENTRADA = "main"

# Multilínea y con comillas simples O dobles: juego.js abre el import de
# verlet con una llave y lo cierra dos renglones más abajo. Una expresión de
# una sola línea lo deja pasar entero y el archivo sale roto de una forma que
# recién se ve al abrirlo.
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s+(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)

modulo_de = lambda ruta: pathlib.Path(ruta).stem


def partes_import(texto):
    """"a, b as c" → ["a", "b: c"], que es como se desestructura en JavaScript."""
    fuera = []
    for parte in texto.split(","):
        parte = parte.strip()
        if not parte:
            continue
        m = re.match(r"^(\w+)\s+as\s+(\w+)$", parte)
        fuera.append(f"{m.group(1)}: {m.group(2)}" if m else parte)
    return fuera


def exportaciones(src):
    """Los nombres que el módulo exporta, para armarle el objeto de salida."""
    nombres = []
    for m in re.finditer(r"^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)", src, re.M):
        nombres.append(m.group(1))
    for m in re.finditer(r"^export\s*\{([^}]*)\}", src, re.M):
        for parte in m.group(1).split(","):
            parte = parte.strip()
            if not parte:
                continue
            mm = re.match(r"^(\w+)\s+as\s+(\w+)$", parte)
            nombres.append(mm.group(2) if mm else parte)
    # Sin duplicados y en orden: un nombre repetido rompe el objeto literal.
    vistos, fuera = set(), []
    for n in nombres:
        if n not in vistos:
            vistos.add(n); fuera.append(n)
    return fuera


def envolver(nombre, src):
    src = RE_IMP_NOM.sub(
        lambda m: "const { " + ", ".join(partes_import(m.group(1))) + f" }} = M_{modulo_de(m.group(2))};",
        src)
    src = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{modulo_de(m.group(2))};", src)
    salidas = exportaciones(src)
    src = re.sub(r"^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)", "", src, flags=re.M)
    src = re.sub(r"^export\s*\{[^}]*\};?\s*$", "", src, flags=re.M)
    cuerpo = "\n".join("  " + l if l.strip() else l for l in src.split("\n"))
    return (f"/* ── {nombre}.js ── */\nconst M_{nombre} = (() => {{\n{cuerpo}\n"
            f"  return {{ {', '.join(salidas)} }};\n}})();\n")


def main():
    partes = []
    for nombre in ORDEN:
        partes.append(envolver(nombre, (AQUI / "js" / f"{nombre}.js").read_text(encoding="utf-8")))
    # La entrada no exporta nada: corre y listo.
    src = (AQUI / "js" / f"{ENTRADA}.js").read_text(encoding="utf-8")
    src = RE_IMP_NOM.sub(
        lambda m: "const { " + ", ".join(partes_import(m.group(1))) + f" }} = M_{modulo_de(m.group(2))};",
        src)
    src = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{modulo_de(m.group(2))};", src)
    partes.append(f"/* ── {ENTRADA}.js ── */\n{src}\n")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "dn.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/dn.css">',
                        f"<style>\n{css}\n</style>")
    # Sin `type="module"` no hay ámbito de módulo, así que todo va adentro de
    # una función: si no, cada `const` del juego queda colgado de window.
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        "<script>\n(() => {\n" + "\n".join(partes) + "\n})();\n</script>")
    destino = AQUI / "dimension-n-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = len(html.encode()) / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(ORDEN) + 1} módulos, 0 binarios")


if __name__ == "__main__":
    main()
