#!/usr/bin/env python3
"""Saca de los HTML lo que hasta ahora estaba escrito adentro, y lo deja en un
JSON para cargar en la base.

POR QUÉ EXISTE. Las nueve estéticas y sus nueve temas de color estaban
repetidos en cinco archivos de hasta dos megas cada uno. Agregar una fiesta era
editar los cinco a mano. Esto los lee una vez y arma el documento inicial, así
la base arranca con EXACTAMENTE lo que hoy se ve publicado y no hay que
retipear nada ni se pierde una coma.

El array `ESTETICAS` es JavaScript, no JSON —claves sin comillas, `null`,
comentarios—, así que no se parsea con un `json.loads`: se lo hace evaluar a
node, que es quien sabe leerlo. Intentar esto con expresiones regulares es
cómo se pierden las descripciones con comillas adentro.

    python3 herramientas/iblo/extraer-contenido.py docs/paginas/iblo-esteticas.html \
        > herramientas/iblo/contenido-inicial.json
"""
import json, re, subprocess, sys, tempfile, os

RUTA = sys.argv[1] if len(sys.argv) > 1 else "docs/paginas/iblo-esteticas.html"
TONOS = ["ac", "ac2", "ac3", "tinta", "tinta2", "humo", "linea", "papel"]


def bloque(texto, arranque):
    """El array desde `[` hasta su corchete de cierre, contando anidados y
    salteando lo que esté adentro de una cadena."""
    i = texto.index(arranque)
    i = texto.index("[", i)
    hondo, j, cadena, escape = 0, i, None, False
    while j < len(texto):
        c = texto[j]
        if cadena:
            if escape: escape = False
            elif c == "\\": escape = True
            elif c == cadena: cadena = None
        elif c in "\"'":
            cadena = c
        elif c == "[":
            hondo += 1
        elif c == "]":
            hondo -= 1
            if hondo == 0:
                return texto[i:j + 1]
        j += 1
    raise SystemExit("no encontré el cierre de " + arranque)


def paletas(texto):
    """Los temas de color: un bloque CSS por estética con sus variables."""
    salida = {}
    for m in re.finditer(r'\[data-est=["\']?([a-z0-9-]+)["\']?\]\s*\{([^}]*)\}', texto):
        p = {}
        for v in re.finditer(r'--([a-z0-9]+)\s*:\s*(#[0-9a-fA-F]{6})', m.group(2)):
            if v.group(1) in TONOS:
                p[v.group(1)] = v.group(2).lower()
        if p:
            salida.setdefault(m.group(1), {}).update(p)
    return salida


def raiz(texto):
    m = re.search(r":root\s*\{([^}]*)\}", texto)
    p = {}
    if m:
        for v in re.finditer(r'--([a-z0-9]+)\s*:\s*(#[0-9a-fA-F]{6})', m.group(1)):
            if v.group(1) in TONOS:
                p[v.group(1)] = v.group(2).lower()
        cur = re.search(r"--curva\s*:\s*(\d+)px", m.group(1))
        gra = re.search(r"--grano\s*:\s*([\d.]+)", m.group(1))
    else:
        cur = gra = None
    return p, (int(cur.group(1)) if cur else 18), (float(gra.group(1)) if gra else 0.045)


s = open(RUTA, encoding="utf8").read()
js = bloque(s, "ESTETICAS")

with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf8") as f:
    f.write("const E = " + js + ";\nprocess.stdout.write(JSON.stringify(E));\n")
    tmp = f.name
try:
    crudo = subprocess.run(["node", tmp], capture_output=True, text=True, check=True).stdout
finally:
    os.unlink(tmp)
est = json.loads(crudo)

pal = paletas(s)
base, curva, grano = raiz(s)

for e in est:
    p = dict(base)
    p.update(pal.get(e.get("k"), {}))
    for t in TONOS:
        p.setdefault(t, base.get(t, "#ffffff"))
    e["paleta"] = p
    e["oculta"] = False
    e.setdefault("flyerUrl", "")
    e.setdefault("mov", "flota")

doc = {
    "esteticas": est,
    "marca": {"paleta": {t: base.get(t, "#ffffff") for t in TONOS},
              "curva": curva, "grano": grano,
              "titular": "Anton", "texto": "Barlow"},
    "secciones": [],
}
print(json.dumps(doc, ensure_ascii=False, indent=1))
sys.stderr.write("IBLO: %d estéticas · %d con paleta propia · curva %dpx\n"
                 % (len(est), len(pal), curva))
