#!/usr/bin/env python3
"""Arma tajo-en-un-archivo.html: el juego entero en un solo HTML.

    python3 empaquetar.py
    python3 empaquetar.py --artifact ruta/tajo.html   # ademas, la version para claude.ai

Que resuelve. El juego son veintitres modulos de JavaScript mas three.js, y
un modulo cargado desde file:// lo bloquea CORS: con doble clic no abre.
Este juego no tiene NI UN archivo binario (la musica la toca un
sintetizador y el escenario se arma con codigo), asi que el archivo unico es
solo codigo: pesa lo que pesa three.js mas el juego.

Como (el mismo metodo que pique3d/empaquetar.py, que ya pago sus trampas):
cada modulo se envuelve en una funcion que devuelve sus exportaciones y los
`import` se reescriben como lecturas de ese objeto. Pegar los archivos uno
atras del otro NO sirve: hay nombres que se repiten entre modulos.
"""
import pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
# En orden de dependencias: cada modulo se ejecuta al envolverse, asi que
# todo lo que importa tiene que estar definido antes.
ORDEN = ["constantes", "azar", "geo", "motor", "luces", "camara", "escenario", "bloques",
         "particulas", "sables", "letra", "entrada", "sinte", "reproductor", "hud", "puntaje",
         "mapa", "compositor", "canciones", "juego", "guardado", "auto"]
ENTRADA = "main"
VENDOR = [("three", "vendor/three.module.min.js")]
VENDOR_ALIAS = {"../vendor/three.module.min.js": "three", "./three.module.min.js": "three"}

# Multilinea y con comillas simples O dobles (ver pique3d/empaquetar.py).
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s*(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)
# `async function` incluido: sin eso `export async function analizarArchivo`
# no entra en las exportaciones y el juego muere recien al abrirlo.
RE_EXP_DECL = re.compile(r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', re.M)
# SIN anclar a principio de linea: three.js minificado cierra con
# `...}export{nt as ACESFilmicToneMapping,...}` pegado al codigo anterior.
RE_EXP_LISTA = re.compile(r'(?:(?<=^)|(?<=[;}\n]))\s*export\s*\{([^}]*)\}\s*;?', re.M)


def modulo_de(ruta):
    if ruta in VENDOR_ALIAS:
        return VENDOR_ALIAS[ruta]
    m = re.search(r'([\w]+)\.js$', ruta)
    return m.group(1) if m else ruta


def partes_import(crudo):
    out = []
    for p in crudo.split(","):
        p = p.strip()
        if not p:
            continue
        if " as " in p:
            a, b = [x.strip() for x in p.split(" as ")]
            out.append(f"{a}: {b}")
        else:
            out.append(p)
    return out


def reescribir_imports(src):
    src = RE_IMP_NOM.sub(
        lambda m: "const { " + ", ".join(partes_import(m.group(1))) + f" }} = M_{modulo_de(m.group(2))};",
        src)
    src = RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{modulo_de(m.group(2))};", src)
    return src


def pares_exportados(src):
    """[(nombre_publico, nombre_local)] de las dos formas de exportar (ver
    pique3d/empaquetar.py: el alias importa, three exporta `nt as ...`)."""
    pares, vistos = [], set()
    for n in RE_EXP_DECL.findall(src):
        if n not in vistos:
            vistos.add(n); pares.append((n, n))
    for grupo in RE_EXP_LISTA.findall(src):
        for p in grupo.split(","):
            p = p.strip()
            if not p:
                continue
            if " as " in p:
                local, publico = [x.strip() for x in p.split(" as ")]
            else:
                local = publico = p
            if publico not in vistos:
                vistos.add(publico); pares.append((publico, local))
    return pares


def envolver(nombre, src):
    src = reescribir_imports(src)
    pares = pares_exportados(src)
    src = RE_EXP_LISTA.sub("", src)
    src = re.sub(r'^export\s+', "", src, flags=re.M)
    cuerpo = ", ".join(a if a == b else f"{a}: {b}" for a, b in pares)
    return (f"/* ── {nombre} ── */\nconst M_{nombre} = (() => {{\n{src.rstrip()}\n"
            f"return {{ {cuerpo} }};\n}})();\n")


def main():
    partes = []
    for nombre, ruta in VENDOR:
        partes.append(envolver(nombre, (AQUI / ruta).read_text(encoding="utf-8")))
    for nombre in ORDEN:
        partes.append(envolver(nombre, (AQUI / "js" / f"{nombre}.js").read_text(encoding="utf-8")))
    ent = reescribir_imports((AQUI / "js" / f"{ENTRADA}.js").read_text(encoding="utf-8"))
    ent = re.sub(r'^export\s+', "", ent, flags=re.M)
    partes.append(f"/* ── {ENTRADA} ── */\n(() => {{\n{ent}\n}})();\n")
    js = "\n".join(partes)
    suelto = re.findall(r'^\s*(?:import|export)[\s{*]', js, re.M)
    if suelto:
        raise SystemExit(f"quedaron {len(suelto)} import/export sueltos: el archivo no andaria")
    if "</script" in js:
        raise SystemExit("hay un </script adentro del codigo: cortaria el archivo")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "tajo.css").read_text(encoding="utf-8")
    assert '<link rel="stylesheet" href="css/tajo.css">' in html
    assert '<script type="module" src="js/main.js"></script>' in html
    html = html.replace('<link rel="stylesheet" href="css/tajo.css">', "<style>\n" + css + "\n</style>")
    html = html.replace('<script type="module" src="js/main.js"></script>', "<script>\n" + js + "\n</script>")
    destino = AQUI / "tajo-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = destino.stat().st_size / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(ORDEN) + 1} modulos + three.js · 0 binarios")

    # La version para publicar en claude.ai: la plataforma pone su propio
    # esqueleto (doctype, head con charset y viewport), asi que va solo el
    # contenido, con el nombre como titulo. Ahi si se puede pedir la
    # tipografia a Google Fonts: en el archivo unico no, porque tiene que
    # abrir sin red.
    if "--artifact" in sys.argv:
        salida = pathlib.Path(sys.argv[sys.argv.index("--artifact") + 1])
        cuerpo = re.search(r"<body>(.*)</body>", html, re.S).group(1)
        estilo = re.search(r"<style>.*?</style>", html, re.S).group(0)
        fuente = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
                  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800;900&display=swap">')
        salida.write_text(f"<title>Tajo</title>\n{fuente}\n{estilo}\n{cuerpo}", encoding="utf-8")
        print(f"{salida}: {salida.stat().st_size / 1024:.0f} KB (para publicar)")


main()
