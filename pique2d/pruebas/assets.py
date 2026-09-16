#!/usr/bin/env python3
"""Comprueba las hojas de sprites antes de que entren al juego.

Dos fallas que no se ven en una miniatura y arruinan el juego en pantalla:

  1. El fondo sin recortar. El servidor genera sobre un color llave y a veces
     no lo saca: de 17 hojas, tres salieron mal —una con 30,5% de magenta y
     otra 93% opaca—. En pantalla es un cuadrado de color alrededor del bicho.
  2. La grilla que no divide. El servidor IGNORA el tamano pedido y entrega
     1024x1024: si la hoja se corta en 3x3 quedan 341,33 px por celda y todos
     los cuadros salen corridos.
  3. La linea de division dibujada. El modelo pinta un marco en el borde de
     cada celda aunque el prompt lo prohiba tres veces; paso en las tres hojas
     nuevas. El recortador mide el rectangulo opaco de la celda, y con el
     marco ese rectangulo es la celda entera: el bicho sale chico, corrido y
     adentro de un recuadro gris. En la miniatura de la hoja no se ve.
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
    # La division dibujada: una linea CONTINUA justo en el borde de la celda.
    # Se mide sobre la hoja entera, en las tres divisiones de cada eje, y se
    # pide continuidad (mas de la mitad del largo) para no confundirla con un
    # pedazo del dibujo que llega al borde.
    px2 = im.load()
    cw, chh = im.width // 4, im.height // 4
    peor = 0
    for cc in (1, 2, 3):
        for d in (-1, 0):
            peor = max(peor,
                       sum(1 for y in range(im.height) if px2[cc * cw + d, y][3] > 24) / im.height,
                       sum(1 for x in range(im.width) if px2[x, cc * chh + d][3] > 24) / im.width)
    if peor > 0.55:
        malas.append(f"{k}: linea de division dibujada — {peor*100:.0f}% del borde de celda opaco")
    elif magenta > 0.002:
        malas.append(f"{k}: {magenta*100:.1f}% de color llave sin recortar")
    elif opaco > 0.90:
        malas.append(f"{k}: {opaco*100:.0f}% opaco — el fondo no se saco")

total = len(glob.glob(os.path.join(os.path.dirname(__file__), "..", "assets", "hojas", "*.webp")))
for m in malas:
    print("  ✗ " + m)
print(f"  {'✓ ' if not malas else ''}{total - len(malas)}/{total} hojas con el fondo limpio y la grilla exacta")
sys.exit(1 if malas else 0)
