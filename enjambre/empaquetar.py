#!/usr/bin/env python3
"""Enjambre en un solo archivo HTML, para abrir con doble clic.

QUE RESUELVE. Un módulo ES cargado desde file:// lo bloquea CORS: el juego
abierto sin servidor muestra una página en blanco y un error de origen en la
consola. Y diez archivos sueltos no se mandan por mensaje.

COMO. Cada módulo se envuelve en una función que devuelve sus exportaciones, y
los imports se vuelven una desestructuración de esa función. Es el mismo grafo
de dependencias resuelto a mano, y por eso el ORDEN de la lista importa.

LOS BINARIOS SON OPCIONALES. Si hay imágenes en assets/, entran en base64 y el
dibujo las usa; si no hay ninguna, el juego se dibuja entero con formas y pesa
unas decenas de kilobytes. Por eso se pudo entregar antes de que existieran los
assets generados: aparecen, se vuelve a empaquetar, y no hay que tocar código.
"""
import pathlib, re

AQUI = pathlib.Path(__file__).parent
ORDEN = ["azar", "bichos", "armas", "mundo", "assets", "dibujo", "audio", "guardado", "idioma"]
ENTRADA = "main"

# Multilínea y con comillas simples O dobles: un import que se abre con una
# llave y se cierra dos renglones más abajo tiene que entrar entero, o el
# archivo sale roto de una forma que recién se ve al abrirlo.
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
    # UNA DECLARACION PUEDE TRAER VARIOS NOMBRES. `export const A = 0, B = 1;`
    # es una sola línea con dos exportaciones; quedándose con la primera, `B`
    # sale `undefined` en el archivo único y no falla al cargar: falla la
    # primera vez que alguien lo compara, y comparar contra undefined nunca
    # tira error, simplemente nunca es verdad.
    for m in re.finditer(r"^export\s+(?:const|let|var)\s+((?:\w+\s*=\s*[^,;{}()\n]+,\s*)+\w+\s*=\s*[^,;{}()\n]+);\s*$",
                         src, re.M):
        for parte in m.group(1).split(","):
            nombre = parte.split("=")[0].strip()
            if nombre.isidentifier():
                nombres.append(nombre)
    for m in re.finditer(r"^export\s*\{([^}]*)\}", src, re.M):
        for parte in m.group(1).split(","):
            parte = parte.strip()
            if not parte:
                continue
            mm = re.match(r"^(\w+)\s+as\s+(\w+)$", parte)
            nombres.append(mm.group(2) if mm else parte)
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


def binarios():
    """Las imágenes de assets/, en base64. Puede estar vacío y el juego anda."""
    import base64, mimetypes
    fuera = {}
    d = AQUI / "assets"
    if not d.exists():
        return fuera
    for f in sorted(d.glob("*")):
        if f.suffix.lower() not in (".png", ".webp", ".jpg", ".mp3", ".ogg"):
            continue
        tipo = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        fuera[f"assets/{f.name}"] = f"data:{tipo};base64," + base64.b64encode(f.read_bytes()).decode()
    return fuera


def json_min(d):
    import json
    return json.dumps(d, separators=(",", ":"))


def main():
    partes = []
    for nombre in ORDEN:
        partes.append(envolver(nombre, (AQUI / "js" / f"{nombre}.js").read_text(encoding="utf-8")))
    src = (AQUI / "js" / f"{ENTRADA}.js").read_text(encoding="utf-8")
    src = RE_IMP_NOM.sub(
        lambda m: "const { " + ", ".join(partes_import(m.group(1))) + f" }} = M_{modulo_de(m.group(2))};",
        src)
    src = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{modulo_de(m.group(2))};", src)
    partes.append(f"/* ── {ENTRADA}.js ── */\n{src}\n")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "enjambre.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/enjambre.css">', f"<style>\n{css}\n</style>")
    partes.insert(0, "/* ── archivos ── */\nglobalThis.ARCHIVOS = " + json_min(binarios()) + ";\n")
    # Sin `type="module"` no hay ámbito de módulo, así que todo va adentro de
    # una función: si no, cada `const` del juego queda colgado de window.
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        "<script>\n(() => {\n" + "\n".join(partes) + "\n})();\n</script>")
    destino = AQUI / "enjambre-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = len(html.encode()) / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(ORDEN) + 1} módulos · {len(binarios())} binarios")


if __name__ == "__main__":
    main()
