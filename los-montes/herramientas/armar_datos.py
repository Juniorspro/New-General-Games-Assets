"""Mete los modelos y la portada en js/datos.js y js/datos-personajes.js (lo que el juego
lee antes que la red). Copiado de control-ruta11/herramientas/armar_datos.py; en Los Montes
son dos archivos porque juntos pasan los 16 MB que acepta un artifact por archivo.
Los GLB van con gzip (el juego los abre con DecompressionStream), la portada como JPEG.
Los ajustes de cada modelo (giro, tamaño) están en js/modelos.js, no acá: así cambiar
uno no obliga a volver a subir 12 MB de datos.
Uso: python3 herramientas/armar_datos.py   (lee crudos/finales/)
"""
import base64, gzip, io, json, os
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(AQUI, "../crudos/finales")
from procesar import PERSONAJES
CABEZA = ["// Generado por herramientas/armar_datos.py: modelos 3D y portada hechos con Rezona",
          "// (pedidos en herramientas/rezona/). Van embebidos para que el juego ande como un",
          "// solo HTML y desde file://.", "window.ARCHIVOS = window.ARCHIVOS || {};"]
salidas = {"datos.js": list(CABEZA), "datos-personajes.js": list(CABEZA)}
# La portada: la imagen de Rezona a JPEG.
por = os.path.join(AQUI, "../crudos/img-portada2-g1.png")
if os.path.exists(por):
    buf = io.BytesIO(); Image.open(por).convert("RGB").save(buf, "JPEG", quality=82, optimize=True)
    salidas["datos.js"].append(f'ARCHIVOS["portada.jpg"] = "data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}";')
    print(f"portada.jpg: {len(buf.getvalue()) // 1024} KB")
# La grúa de Tripo vino plegada (0,7 m de alcance) y de una pieza: no puede subir la pluma.
# Queda la de código, que sí. El pino 2 no se usa (el monte es del pino 1).
SALTEAR = {"grua.glb", "pino2.glb"}
for f in sorted(os.listdir(CARPETA)):
    if not f.endswith(".glb") or f in SALTEAR: continue
    b = gzip.compress(open(os.path.join(CARPETA, f), "rb").read(), 9)
    destino = "datos-personajes.js" if f[:-4] in PERSONAJES else "datos.js"
    salidas[destino].append(f'ARCHIVOS["{f}.gz"] = "data:application/gzip;base64,{base64.b64encode(b).decode()}";')
    print(f"{f}.gz: {len(b) // 1024} KB → {destino}")
for n, lineas in salidas.items():
    ruta = os.path.join(AQUI, "../js", n)
    open(ruta, "w").write("\n".join(lineas) + "\n")
    print(n + ":", os.path.getsize(ruta) // 1024, "KB")
