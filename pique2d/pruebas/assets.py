#!/usr/bin/env python3
"""Comprueba las hojas de sprites antes de que entren al juego.

Dos fallas que no se ven en una miniatura y arruinan el juego en pantalla:

  1. El fondo sin recortar. El servidor genera sobre un color llave y a veces
     no lo saca: de 17 hojas, tres salieron mal —una con 30,5% de magenta y
     otra 93% opaca—. En pantalla es un cuadrado de color alrededor del bicho.
  2. La grilla que no divide. El servidor IGNORA el tamano pedido y entrega
     1024x1024: si la hoja se corta en 3x3 quedan 341,33 px por celda y todos
     los cuadros salen corridos.
"""
import glob, os, sys
from PIL import Image

malas = []
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "assets", "hojas", "*.webp"))):
    k = os.path.basename(f)[:-5]
    im = Image.open(f).convert("RGBA")
    if im.width % 4 or im.height % 4:
        malas.append(f"{k}: {im.width}x{im.height} no divide en 4x4"); continue
    ch = im.resize((128, 128), Image.NEAREST)
    px = list(ch.getdata())
    n = len(px)
    magenta = sum(1 for r, g, b, a in px if r > 170 and b > 170 and g < 110 and a > 80) / n
    opaco = sum(1 for *_, a in px if a > 24) / n
    if magenta > 0.002:
        malas.append(f"{k}: {magenta*100:.1f}% de color llave sin recortar")
    elif opaco > 0.90:
        malas.append(f"{k}: {opaco*100:.0f}% opaco — el fondo no se saco")

total = len(glob.glob(os.path.join(os.path.dirname(__file__), "..", "assets", "hojas", "*.webp")))
for m in malas:
    print("  ✗ " + m)
print(f"  {'✓ ' if not malas else ''}{total - len(malas)}/{total} hojas con el fondo limpio y la grilla exacta")
sys.exit(1 if malas else 0)
