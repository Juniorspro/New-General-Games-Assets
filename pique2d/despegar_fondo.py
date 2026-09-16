#!/usr/bin/env python3
"""Saca el fondo de las hojas donde el recorte del servidor fallo.

El servidor genera sobre un color llave y lo recorta a transparencia. A veces
no lo hace: se midio sobre 17 hojas y tres salieron mal —una con 30,5% de
magenta sin recortar y otra 93% opaca—. En pantalla eso es un cuadrado de color
alrededor del bicho, y se ve en el primer cuadro.

Se arregla en post y no pidiendo de nuevo: es determinista, gratis, y una
regeneracion puede volver a fallar igual.

Como: se muestrean las cuatro esquinas de cada celda. Si coinciden, ese es el
fondo y se borra con tolerancia. Muestrear las esquinas y no un pixel suelto
importa: el sujeto esta centrado con margen, asi que las esquinas son fondo
seguro, y si NO coinciden es que no hay fondo plano y no se toca nada.
"""
import sys, pathlib
from PIL import Image

TOL = 34


def dist(a, b):
    return max(abs(a[0]-b[0]), abs(a[1]-b[1]), abs(a[2]-b[2]))


def despegar(ruta, cols=4, filas=4):
    im = Image.open(ruta).convert("RGBA")
    w, h = im.size
    cw, ch = w // cols, h // filas
    px = im.load()
    esquinas = []
    for f in range(filas):
        for k in range(cols):
            for dx, dy in ((2, 2), (cw-3, 2), (2, ch-3), (cw-3, ch-3)):
                esquinas.append(px[k*cw+dx, f*ch+dy])
    opacas = [c for c in esquinas if c[3] > 24]
    if len(opacas) < len(esquinas) * 0.5:
        return None                      # ya tiene alfa: no se toca
    base = opacas[0]
    if any(dist(c, base) > TOL for c in opacas):
        return None                      # el fondo no es plano: no se adivina
    n = 0
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] > 0 and dist(c, base) <= TOL:
                px[x, y] = (c[0], c[1], c[2], 0); n += 1
    return (im, base, n / (w*h))


def sacar_llave(ruta):
    """Segundo paso: borrar el color llave este donde este.

    La vela salio con las esquinas YA transparentes pero un recuadro magenta
    alrededor del bicho, adentro de cada celda: el recorte del servidor hizo la
    mitad del trabajo. El muestreo de esquinas no lo ve porque las esquinas
    estan bien.

    Borrar magenta es seguro en ESTE juego: la paleta es ambar, teal, crema y
    marron, y no hay una sola cosa magenta dibujada. El tinte rosa de las
    monedas de color se aplica por codigo, no viene en la hoja.
    """
    im = Image.open(ruta).convert("RGBA")
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and r > 150 and b > 150 and g < 120 and (r - g) > 60 and (b - g) > 60:
                px[x, y] = (r, g, b, 0); n += 1
    return (im, n / (w*h)) if n else None


def main():
    hojas = pathlib.Path("assets/hojas")
    for f in sorted(hojas.glob("*.webp")):
        r = despegar(f)
        if r:
            im, base, frac = r
            im.save(f, "WEBP", quality=92, method=6)
            print(f"  {f.name[:-5]:18} fondo plano {base[:3]} borrado · {frac*100:.0f}%")
        r2 = sacar_llave(f)
        if r2:
            im2, frac2 = r2
            im2.save(f, "WEBP", quality=92, method=6)
            print(f"  {f.name[:-5]:18} color llave borrado · {frac2*100:.0f}%")


main()
