#!/usr/bin/env python3
"""Arma grumo-en-un-archivo.html: el juego entero en un solo HTML.

    python3 grumo/empaquetar.py

Por qué. El juego son muchos módulos de JavaScript, y un módulo cargado
desde file:// lo bloquea el navegador: con doble clic no abre. El archivo
único abre con doble clic, se manda por mensaje y anda sin servidor ni red.

Es el mismo empaquetador de cripta/empaquetar.py (cada juego lleva el suyo
para poder copiar la carpeta sola): cada módulo se envuelve en una función
que devuelve sus exportaciones y cada `import` se reescribe como una
lectura de ese objeto, en orden topológico según los mismos `import`.

No hay binarios: el logo, la plastilina, Grumo, la música y los sonidos
se hacen con código al arrancar.
"""
import pathlib, re

AQUI = pathlib.Path(__file__).parent
ENTRADA = "main"
SALIDA = "grumo-en-un-archivo.html"

# Multilínea y con comillas simples O dobles.
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s*(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)
RE_IMP_RUTA = re.compile(r'^import\s[^;]*?from\s*[\'"]\./(\w+)\.js[\'"]', re.M | re.S)
RE_EXP_DECL = re.compile(r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', re.M)
RE_EXP_LISTA = re.compile(r'(?:(?<=^)|(?<=[;}\n]))\s*export\s*\{([^}]*)\}\s*;?', re.M)


def modulo_de(ruta):
    m = re.search(r'(\w+)\.js$', ruta)
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
    return RE_IMP_TODO.sub(lambda m: f"const {m.group(1)} = M_{modulo_de(m.group(2))};", src)


def pares_exportados(src):
    """[(nombre_publico, nombre_local), ...] de `export function X` y de `export { a as B }`."""
    pares, vistos = [], set()
    for n in RE_EXP_DECL.findall(src):
        if n not in vistos:
            vistos.add(n); pares.append((n, n))
    for grupo in RE_EXP_LISTA.findall(src):
        for p in grupo.split(","):
            p = p.strip()
            if not p:
                continue
            local, publico = ([x.strip() for x in p.split(" as ")] if " as " in p else (p, p))
            if publico not in vistos:
                vistos.add(publico); pares.append((publico, local))
    return pares


# `export const A = 1, B = 2;` exporta dos nombres, pero RE_EXP_DECL lee uno
# solo: B quedaba afuera del archivo único y valía undefined (pasó en Globo
# Libre con R_MONEDA: la moneda se dibujaba en un lienzo de 0 × 0)
RE_EXP_VARIOS = re.compile(r'^export\s+(?:const|let|var)\s+\w+\s*=[^;\n]*,\s*[A-Za-z_]\w*\s*=', re.M)


def envolver(nombre, src):
    if RE_EXP_VARIOS.search(src):
        raise SystemExit(f"{nombre}.js tiene un `export const A = …, B = …`: separalo en un export por línea")
    src = reescribir_imports(src)
    pares = pares_exportados(src)
    src = RE_EXP_LISTA.sub("", src)
    src = re.sub(r'^export\s+', "", src, flags=re.M)
    cuerpo = ", ".join(a if a == b else f"{a}: {b}" for a, b in pares)
    return (f"/* ── {nombre} ── */\nconst M_{nombre} = (() => {{\n{src.rstrip()}\n"
            f"return {{ {cuerpo} }};\n}})();\n")


def orden_topologico(fuentes):
    """Cada módulo después de lo que importa. Falla si hay un ciclo."""
    deps = {n: set(RE_IMP_RUTA.findall(s)) for n, s in fuentes.items()}
    for n, d in deps.items():
        falta = d - fuentes.keys()
        if falta:
            raise SystemExit(f"{n}.js importa {', '.join(sorted(falta))}, que no está en js/")
    orden, hecho, en_curso = [], set(), []

    def visitar(n):
        if n in hecho:
            return
        if n in en_curso:
            raise SystemExit("ciclo de imports: " + " → ".join(en_curso[en_curso.index(n):] + [n]))
        en_curso.append(n)
        for d in sorted(deps[n]):
            visitar(d)
        en_curso.pop()
        hecho.add(n); orden.append(n)

    for n in sorted(fuentes):
        visitar(n)
    return orden


def main():
    fuentes = {p.stem: p.read_text(encoding="utf-8") for p in sorted((AQUI / "js").glob("*.js"))}
    # el nombre del archivo pasa a ser `M_<nombre>`: con un guion no es un
    # nombre de JavaScript y el archivo único no arranca (pasó con logo-jxs.js)
    malos = [n for n in fuentes if not n.isidentifier()]
    if malos:
        raise SystemExit(f"nombres de módulo que no sirven (solo letras, números y _): {', '.join(malos)}")
    entrada = fuentes.pop(ENTRADA)
    orden = orden_topologico(fuentes)

    partes = [envolver(n, fuentes[n]) for n in orden]
    ent = reescribir_imports(entrada)
    ent = re.sub(r'^export\s+', "", ent, flags=re.M)
    partes.append(f"/* ── {ENTRADA} ── */\n(() => {{\n{ent}\n}})();\n")
    js = "\n".join(partes)

    # La comprobación tampoco va anclada: `export` pegado a una llave también rompe.
    suelto = re.findall(r'(?:^|[;}\s])(?:import|export)[\s{*]', js, re.M)
    if suelto:
        raise SystemExit(f"quedaron {len(suelto)} import/export sueltos: el archivo no andaría")
    # un </script> adentro del código cerraría la etiqueta antes de tiempo
    if re.search(r'</script', js, re.I):
        raise SystemExit("el código tiene '</script': rompería la etiqueta")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "estilo.css").read_text(encoding="utf-8")
    for viejo, nuevo in (('<link rel="stylesheet" href="css/estilo.css">', "<style>\n" + css + "\n</style>"),
                         ('<script type="module" src="js/main.js"></script>', "<script>\n" + js + "\n</script>")):
        if viejo not in html:
            raise SystemExit(f"index.html ya no tiene {viejo!r}: actualizá el empaquetador")
        html = html.replace(viejo, nuevo)

    destino = AQUI / SALIDA
    destino.write_text(html, encoding="utf-8")
    kb = destino.stat().st_size / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(orden) + 1} módulos · orden: {' '.join(orden)} {ENTRADA}")


if __name__ == "__main__":
    main()
