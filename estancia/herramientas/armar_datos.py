"""Mete archivos en js/datos.js, que es lo que el juego lee antes que la red.

    python3 armar_datos.py carpeta/ [carpeta2/ ...] [--quitar prefijo]

Los GLB se guardan comprimidos con gzip (nombre.glb.gz): la geometría de
Rezona viene sin índices y comprime ~20 %, y con cinco animales el HTML
pasaba los 16 MB que acepta un artifact. modelos.js los descomprime al
cargar (DecompressionStream).

Conserva lo que ya estaba en datos.js y agrega o reemplaza por nombre de
archivo. Las imágenes, los GLB y el audio van como data URI; los .json van
como objeto (sin base64, pesan un tercio menos).
"""
import base64, gzip, json, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(AQUI, "..", "js", "datos.js")
TIPOS = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary",
         ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4"}
CABEZA = """// Generado por estancia/herramientas/armar_datos.py: texturas de Higgsfield,
// modelos, texturas y recortes de Rezona (los pedidos están en
// estancia/LEEME.md). Va embebido para que el juego ande como un solo HTML y
// desde file://: el cargador busca acá primero (GUIA-JUEGOS.md § 10).
window.ARCHIVOS = window.ARCHIVOS || {};
"""

def leer():
    hay = {}
    if os.path.exists(DATOS):
        for m in re.finditer(r'^ARCHIVOS\["([^"]+)"\] = (.*);$', open(DATOS).read(), re.M):
            hay[m.group(1)] = m.group(2)
    return hay

def main(args):
    hay = leer()
    carpetas = []
    while args:
        a = args.pop(0)
        if a == "--quitar":
            pre = args.pop(0)
            for n in [n for n in hay if n.startswith(pre)]: del hay[n]
        else:
            carpetas.append(a)
    for c in carpetas:
        for n in sorted(os.listdir(c)):
            ruta, ext = os.path.join(c, n), os.path.splitext(n)[1].lower()
            if ext == ".json":
                hay[n] = json.dumps(json.load(open(ruta)), separators=(",", ":"))
            elif ext in TIPOS:
                hay[n] = json.dumps("data:%s;base64,%s" % (TIPOS[ext], base64.b64encode(open(ruta, "rb").read()).decode()))
    # Los GLB, comprimidos (también los que ya estaban sin comprimir).
    for n in [n for n in hay if n.endswith(".glb")]:
        crudo = base64.b64decode(json.loads(hay.pop(n)).split(",", 1)[1])
        hay[n + ".gz"] = json.dumps("data:application/gzip;base64,%s" % base64.b64encode(gzip.compress(crudo, 9, mtime=0)).decode())
    with open(DATOS, "w") as f:
        f.write(CABEZA)
        for n, v in hay.items():
            f.write('ARCHIVOS["%s"] = %s;\n' % (n, v))
    print("datos.js: %d archivos, %.2f MB" % (len(hay), os.path.getsize(DATOS) / 1e6))
    for n, v in hay.items():
        print("  %-28s %7.0f KB" % (n, len(v) / 1024))

if __name__ == "__main__":
    main(sys.argv[1:])
