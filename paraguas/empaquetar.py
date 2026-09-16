#!/usr/bin/env python3
"""Paraguas en un solo archivo HTML, para abrir con doble clic.

QUE RESUELVE. Un módulo ES cargado desde file:// lo bloquea CORS: el juego
abierto sin servidor muestra una página en blanco y un error de origen en la
consola. Y ocho archivos sueltos no se mandan por mail.

COMO. Cada módulo se envuelve en una función que devuelve sus exportaciones y
los imports se vuelven una desestructuración de esa función. Es el mismo grafo
de dependencias, resuelto a mano: por eso el ORDEN de la lista importa —un
módulo tiene que estar armado antes de que otro lo lea— y por eso no hay
ciclos.

LOS BINARIOS VAN EN BASE64, y son quince: diez del juego y cinco del vestido. Base64 infla un 37%, así que cada
kilobyte que se ahorra preparando vale 1,37 acá — por eso el arte se guarda a
320 px de alto y no a 1024.

Y EL JUEGO SIGUE ANDANDO SIN NINGUNO DE ELLOS: si se borra la carpeta de arte,
el empaquetado sale igual y el juego se dibuja con líneas y círculos. Las
imágenes son una mejora, no un requisito.
"""
import base64, mimetypes, pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
ORDEN = ["assets", "mundo", "pozo", "juego", "piloto", "heroe", "dibujo", "audio",
         "guardado"]
ENTRADA = "main"

# Multilínea y con comillas simples O dobles: juego.js abre el import de
# verlet con una llave y lo cierra dos renglones más abajo. Una expresión de
# una sola línea lo deja pasar entero y el archivo sale roto de una forma que
# recién se ve al abrirlo.
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s+(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)

modulo_de = lambda ruta: pathlib.Path(ruta).stem


def json_min(d):
    """JSON sin espacios: con data: URIs de cien kilobytes, la sangría pesa."""
    import json
    return json.dumps(d, separators=(",", ":"))


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


def binarios():
    """Los binarios, en dos mapas: los que pide el juego y los que pide el vestido.

    VAN SEPARADOS PARA QUE NINGUNO ENTRE DOS VECES. Los del juego se buscan en
    tiempo de ejecución por `ruta()`, así que tienen que estar en ARCHIVOS; los
    del vestido los pide el CSS por su URL y se reemplazan en el texto. Si una
    pieza estuviera en los dos lados, su base64 —que para el portal son 60 KB—
    quedaría escrito dos veces en el mismo archivo.
    """
    juego, vestido, crudo = {}, {}, 0
    for sub in ["arte"]:
        for f in sorted((AQUI / "assets" / sub).glob("*")):
            if f.suffix.lower() not in (".webp", ".png"):
                continue
            destino = vestido if f.name.startswith("ui_") else juego
            destino[f"assets/{sub}/{f.name}"] = data_uri(f); crudo += f.stat().st_size
    return juego, vestido, crudo


def data_uri(f):
    tipo = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
    return f"data:{tipo};base64," + base64.b64encode(f.read_bytes()).decode()


def incrustar_rutas(texto, mapa, prefijos):
    """Cambia las rutas a archivos por su data: URI, en el CSS y en el HTML.

    LOS MODULOS PIDEN SUS IMAGENES POR `ruta()` y las encuentran en ARCHIVOS,
    pero el vestido no pasa por JavaScript: el marco lo pide el CSS con
    `url(../assets/...)` y el logo el HTML con `src="assets/..."`. Sin esto el
    archivo único quedaba sin marco, sin título y sin botón —los tres pedidos
    salían 404— y el juego se veía bien, que es lo que hace que no se note.
    """
    for clave, uri in mapa.items():
        corto = clave.split("/")[-1]
        for pre in prefijos:
            texto = texto.replace(pre + clave, uri).replace(pre + corto, uri)
    return texto


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

    mapa, vestido, crudo = binarios()
    # El mapa va PRIMERO, antes de cualquier módulo: `assets.js` lo lee al
    # resolver una ruta y los módulos se ejecutan en orden al definirse.
    partes.insert(0, "/* ── archivos ── */\nglobalThis.ARCHIVOS = "
                     + json_min(mapa) + ";\n")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "p.css").read_text(encoding="utf-8")
    # El CSS entra con las rutas ya resueltas; el HTML se resuelve después, con
    # el CSS adentro, así que alcanza una sola pasada para los dos.
    css = incrustar_rutas(css, vestido, ["../"])
    html = html.replace('<link rel="stylesheet" href="css/p.css">',
                        f"<style>\n{css}\n</style>")
    html = incrustar_rutas(html, vestido, [""])
    # Sin `type="module"` no hay ámbito de módulo, así que todo va adentro de
    # una función: si no, cada `const` del juego queda colgado de window.
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        "<script>\n(() => {\n" + "\n".join(partes) + "\n})();\n</script>")
    destino = AQUI / "paraguas-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = len(html.encode()) / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(ORDEN) + 1} módulos + "
          f"{len(mapa)} binarios + {len(vestido)} de vestido ({crudo // 1024} KB crudos)")


if __name__ == "__main__":
    main()
