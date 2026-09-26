"""Mete los modelos y la portada en js/datos.js (lo que el juego lee antes que la red).
Los GLB van con gzip (el juego los abre con DecompressionStream), la portada como JPEG.
Uso: python3 herramientas/armar_datos.py   (lee finales/)
"""
import base64, gzip, os
AQUI = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(AQUI, "..", "finales"); SALIDA = os.path.join(AQUI, "..", "js", "datos.js")
lineas = ["// Generado por herramientas/armar_datos.py: modelos 3D y portada hechos con Rezona", "// (pedidos en herramientas/rezona/pedidos.json). Van embebidos para que el juego ande", "// como un solo HTML y desde file://.", "window.ARCHIVOS = window.ARCHIVOS || {};"]
for f in sorted(os.listdir(CARPETA)):
    b = open(os.path.join(CARPETA, f), "rb").read()
    if f.endswith(".glb"): clave, tipo, b = f + ".gz", "application/gzip", gzip.compress(b, 9)
    elif f.endswith(".jpg"): clave, tipo = f, "image/jpeg"
    else: continue
    lineas.append(f'ARCHIVOS["{clave}"] = "data:{tipo};base64,{base64.b64encode(b).decode()}";')
    print(f"{clave}: {len(b) // 1024} KB")
open(SALIDA, "w").write("\n".join(lineas) + "\n")
print("datos.js:", os.path.getsize(SALIDA) // 1024, "KB")
