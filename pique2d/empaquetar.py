#!/usr/bin/env python3
"""Arma pique-en-un-archivo.html: el juego entero en un solo HTML.

    python3 empaquetar.py            # sin musica (usa la sintetizada)
    python3 empaquetar.py --musica   # con las pistas grabadas, +1 MB

Que resuelve. El juego son dieciseis modulos de JavaScript, three.js, el
cargador de GLB, trece modelos, dieciseis texturas y el audio. Nada de eso se
puede abrir con doble clic: un modulo cargado desde file:// lo bloquea CORS, y
un .glb pedido con fetch tambien.

Como. Cada modulo se envuelve en una funcion que devuelve sus exportaciones y
los `import` se reescriben como lecturas de ese objeto. Pegar los archivos uno
atras del otro NO sirve: `crear` existe en entidades.js y en interfaz.js, y
`moneda`, `paso` y `tiles` tambien chocan. Los binarios entran como data: URI
a traves de assets.js, asi que el codigo del juego es EL MISMO en las dos
versiones — no hay una version "de carpeta" y otra "de archivo" que se puedan
desincronizar.

three.js minificado trae un solo `export{a as X,...}` al final: se convierte en
un `return {X: a, ...}`. No se toca nada mas de su codigo.
"""
import base64, json, mimetypes, pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
ORDEN = ["assets", "mundo", "azar", "guardado", "audio", "sprites", "fisica",
         "piezas", "entidades", "dibujo", "generador", "juego", "interfaz"]
ENTRADA = "main"
VENDOR = []          # el 2D no usa ninguna biblioteca
VENDOR_ALIAS = {}

# Multilinea y con comillas simples O dobles. GLTFLoader abre el import con
# una llave y cierra setenta lineas mas abajo, y usa comillas simples: una
# expresion de una sola linea con comillas dobles lo deja pasar entero, y el
# archivo empaquetado sale roto de una forma que solo se ve al abrirlo.
RE_IMP_NOM = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M | re.S)
RE_IMP_TODO = re.compile(r'^import\s*\*\s*as\s*(\w+)\s*from\s*[\'"]([^\'"]+)[\'"];?\s*$', re.M)
# `async function` incluido. Sin eso, `export async function precargar` no
# entra en la lista de exportaciones: el modulo se arma bien, no falta ningun
# import, el empaquetador dice "listo" — y el juego muere con "precargar is not
# a function" recien al abrirlo.
RE_EXP_DECL = re.compile(r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', re.M)
# SIN anclar a principio de linea. three.js minificado cierra con
# `...}export{nt as ACESFilmicToneMapping,...}` pegado al codigo anterior, en la
# misma linea: una expresion anclada con ^ no lo ve, lo deja tal cual, y el
# navegador corta con "Unexpected token 'export'" sin decir donde. Se exige que
# venga precedido por fin de linea, `;` o `}` para no cazar la palabra dentro
# de una cadena.
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
    """Devuelve [(nombre_publico, nombre_local), ...].

    Hay que contemplar las DOS formas y a veces las dos en el mismo archivo:

      export function X() {}        -> ("X", "X")
      export { a as B, c }          -> ("B", "a") y ("c", "c")

    El alias importa. three.js minificado exporta `nt as ACESFilmicToneMapping`:
    devolver solo el nombre publico arma un objeto que apunta a una variable
    que no existe, y el juego revienta en la primera linea que usa three — con
    un error que habla de `ACESFilmicToneMapping` y no dice nada del alias.
    BufferGeometryUtils usa las dos formas a la vez; suponer cual es cual es
    como se llega a un archivo que parece bien y no anda.
    """
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


def data_uri(p):
    tipo = mimetypes.guess_type(p.name)[0] or {
        ".glb": "model/gltf-binary", ".webp": "image/webp", ".mp3": "audio/mpeg"}.get(p.suffix, "application/octet-stream")
    return f"data:{tipo};base64," + base64.b64encode(p.read_bytes()).decode()


def main():
    con_musica = "--musica" in sys.argv
    partes = []
    for nombre, ruta in VENDOR:
        partes.append(envolver(nombre, (AQUI / ruta).read_text(encoding="utf-8")))
    for nombre in ORDEN:
        partes.append(envolver(nombre, (AQUI / "js" / f"{nombre}.js").read_text(encoding="utf-8")))

    # --- los binarios ------------------------------------------------------
    mapa, crudo = {}, 0
    for p in sorted((AQUI / "assets" / "hojas").glob("*.webp")):
        mapa[f"assets/hojas/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    for p in sorted((AQUI / "assets" / "tile").glob("*.webp")):
        mapa[f"assets/tile/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    for p in sorted((AQUI / "assets" / "piezas").glob("*.webp")):
        mapa[f"assets/piezas/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    for p in sorted((AQUI / "assets" / "fondo").glob("*.webp")):
        mapa[f"assets/fondo/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    for p in sorted((AQUI / "assets" / "postal").glob("*.webp")):
        mapa[f"assets/postal/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    for nombre in ("portada.webp", "logo.webp", "titulo_fondo.webp"):
        p = AQUI / "assets" / nombre
        if p.exists():
            mapa[f"assets/{nombre}"] = data_uri(p); crudo += p.stat().st_size
    if con_musica:
        for p in sorted((AQUI / "assets" / "snd").glob("*.mp3")):
            mapa[f"assets/snd/{p.name}"] = data_uri(p); crudo += p.stat().st_size
    partes.append("/* ── assets embebidos ── */\nM_assets.registrar(" +
                  json.dumps(mapa) + ");\n")

    # Los modulos, expuestos para poder auditarlos desde afuera (las pruebas
    # generan los 24 niveles adentro del archivo para comprobar que validan).
    partes.append("/* ── modulos visibles para las pruebas ── */\n"
                  + "\n".join(f"window.M_{n} = M_{n};" for n in ORDEN) + "\n")

    ent = reescribir_imports((AQUI / "js" / f"{ENTRADA}.js").read_text(encoding="utf-8"))
    ent = re.sub(r'^export\s+', "", ent, flags=re.M)
    partes.append(f"/* ── {ENTRADA} ── */\n(() => {{\n{ent}\n}})();\n")

    js = "\n".join(partes)
    # La comprobacion tambien sin anclar: si el chequeo usa ^ y el codigo
    # empaquetado no, el empaquetador dice "listo" sobre un archivo roto.
    suelto = re.findall(r'(?:^|[;}\s])(?:import|export)[\s{]', js, re.M)
    if suelto:
        raise SystemExit(f"quedaron {len(suelto)} import/export sueltos: el archivo no andaria")

    html = (AQUI / "index.html").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/pique.css">',
                        "<style>\n" + (AQUI / "css" / "pique.css").read_text(encoding="utf-8") + "\n</style>")
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        "<script>\n" + js + "\n</script>")
    html = html.replace("</title>", " — un solo archivo</title>")

    destino = AQUI / "pique-en-un-archivo.html"
    destino.write_text(html, encoding="utf-8")
    mb = destino.stat().st_size / 1048576
    print(f"{destino.name}: {mb:.1f} MB · {len(ORDEN) + 1} modulos + "
          f"{len(mapa)} binarios ({crudo // 1024} KB crudos)"
          + ("" if con_musica else " · sin musica grabada (usa la sintetizada)"))


main()
