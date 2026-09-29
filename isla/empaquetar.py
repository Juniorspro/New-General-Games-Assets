#!/usr/bin/env python3
"""Arma isla-en-un-archivo.html: el juego entero en un solo HTML.

    python3 empaquetar.py

Por qué. La isla son treinta módulos de JavaScript más three.js, y un módulo
cargado desde file:// lo bloquea el navegador: con doble clic no abre. El
archivo único abre con doble clic, se manda por mensaje y anda sin servidor.

Cómo (lo mismo que perro/empaquetar.py, ver sus comentarios): cada módulo se
envuelve en una función que devuelve sus exportaciones y cada `import` se
reescribe como una lectura de ese objeto. Pegar los archivos uno atrás del
otro NO sirve: `caja`, `suave`, `CERO` y `_v` existen en varios módulos.

Lo nuevo acá: el ORDEN no se escribe a mano. Se saca de los mismos `import`
(orden topológico): un módulo va después de todo lo que importa. Una lista a
mano se desactualiza el día que alguien agrega un import, y el error aparece
recién al abrir el archivo ("Cannot access 'M_rocas' before initialization").
Si hubiera un ciclo, el empaquetador lo dice y no arma nada.

No hay binarios: las texturas, los modelos, la música y los sonidos se hacen
con código al arrancar.
"""
import pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
ENTRADA = "main"
VENDOR = [("three", "vendor/three.module.min.js")]
VENDOR_ALIAS = {"../vendor/three.module.min.js": "three", "./three.module.min.js": "three"}

# Multilínea y con comillas simples O dobles (ver perro/empaquetar.py).
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s*(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)
RE_IMP_RUTA = re.compile(r'^import\s[^;]*?from\s*[\'"]\./(\w+)\.js[\'"]', re.M | re.S)
RE_EXP_DECL = re.compile(r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', re.M)
# Sin anclar: three.js minificado cierra con `...}export{nt as X,...}` pegado.
RE_EXP_LISTA = re.compile(r'(?:(?<=^)|(?<=[;}\n]))\s*export\s*\{([^}]*)\}\s*;?', re.M)


def modulo_de(ruta):
    if ruta in VENDOR_ALIAS:
        return VENDOR_ALIAS[ruta]
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


def envolver(nombre, src):
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
    entrada = fuentes.pop(ENTRADA)
    orden = orden_topologico(fuentes)

    partes = [envolver(n, (AQUI / r).read_text(encoding="utf-8")) for n, r in VENDOR]
    partes += [envolver(n, fuentes[n]) for n in orden]
    ent = reescribir_imports(entrada)
    ent = re.sub(r'^export\s+', "", ent, flags=re.M)
    partes.append(f"/* ── {ENTRADA} ── */\n(() => {{\n{ent}\n}})();\n")
    js = "\n".join(partes)

    # La comprobación tampoco va anclada (ver perro/empaquetar.py).
    suelto = re.findall(r'(?:^|[;}\s])(?:import|export)[\s{*]', js, re.M)
    if suelto:
        raise SystemExit(f"quedaron {len(suelto)} import/export sueltos: el archivo no andaría")
    # un </script> adentro del código cerraría la etiqueta antes de tiempo
    if re.search(r'</script', js, re.I):
        raise SystemExit("el código tiene '</script': rompería la etiqueta")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    css = (AQUI / "css" / "i.css").read_text(encoding="utf-8")
    for viejo, nuevo in (('<link rel="stylesheet" href="css/i.css">', "<style>\n" + css + "\n</style>"),
                         ('<script type="module" src="js/main.js"></script>', "<script>\n" + js + "\n</script>")):
        if viejo not in html:
            raise SystemExit(f"index.html ya no tiene {viejo!r}: actualizá el empaquetador")
        html = html.replace(viejo, nuevo)

    destino = AQUI / "isla-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    kb = destino.stat().st_size / 1024
    print(f"{destino.name}: {kb:.0f} KB · {len(orden) + 1} módulos + three.js · orden: {' '.join(orden)} {ENTRADA}")


if __name__ == "__main__":
    main()
