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
    return sacar_llave_im(Image.open(ruta).convert("RGBA"))


def sacar_llave_im(im):
    """Lo mismo sobre una imagen ya abierta. Se separo para poder encadenar
    los dos pasos SIN guardar en el medio: guardando entre uno y otro, cada
    pasada vuelve a comprimir con perdida la misma hoja."""
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and r > 150 and b > 150 and g < 120 and (r - g) > 60 and (b - g) > 60:
                px[x, y] = (r, g, b, 0); n += 1
    return (im, n / (w*h)) if n else None


def borrar_bordes(im, cols=4, filas=4, grosor=6):
    """Cuarto paso: borrar las lineas de division dibujadas entre celdas.

    Es la falla que el contrato del prompt pide evitar con mas insistencia y
    la que igual vuelve: el modelo dibuja una linea en el borde de cada celda.
    En las tres hojas nuevas salio una linea violeta oscura, (38,0,40), opaca,
    en las divisiones verticales y horizontales.

    Por que arruina la hoja y no se ve en la miniatura: el recorte automatico
    mide el rectangulo ocupado por los pixeles opacos, y con una linea en el
    borde ese rectangulo es LA CELDA ENTERA. O sea que el bicho se dibuja del
    tamano de la celda —mas chico de lo pedido y corrido— y encima con la
    linea adentro: en pantalla queda un recuadro gris alrededor del sprite. Se
    vio en la planta antes de esto.

    SE MIRA LADO POR LADO Y NO EL ANILLO ENTERO, y esa es la diferencia entre
    que funcione y que no. Con el anillo completo el promedio se diluye: una
    celda con linea en un solo lado no llega al umbral y la linea queda. Y
    sobre todo: lo que define una division es que sea una LINEA CONTINUA a lo
    largo del lado. Mirando lado por lado se puede pedir que ocupe mas de la
    mitad, y asi ningun pedazo suelto del dibujo —una bufanda que llega al
    borde— se confunde con una division.
    """
    px = im.load()
    w, h = im.size
    cw, ch = w // cols, h // filas
    borrados = 0

    def opaco(x, y):
        return px[x, y][3] > 24

    def limpiar(puntos):
        nonlocal borrados
        for x, y in puntos:
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (r, g, b, 0); borrados += 1

    for f in range(filas):
        for k in range(cols):
            x0, y0 = k * cw, f * ch
            # Cada lado con su propia linea de prueba: la fila o columna mas
            # de afuera. Si esta ocupada de punta a punta, es una division.
            lados = [
                (sum(opaco(x0 + i, y0) for i in range(cw)) / cw,
                 [(x0 + i, y0 + g) for i in range(cw) for g in range(grosor)]),
                (sum(opaco(x0 + i, y0 + ch - 1) for i in range(cw)) / cw,
                 [(x0 + i, y0 + ch - 1 - g) for i in range(cw) for g in range(grosor)]),
                (sum(opaco(x0, y0 + j) for j in range(ch)) / ch,
                 [(x0 + g, y0 + j) for j in range(ch) for g in range(grosor)]),
                (sum(opaco(x0 + cw - 1, y0 + j) for j in range(ch)) / ch,
                 [(x0 + cw - 1 - g, y0 + j) for j in range(ch) for g in range(grosor)]),
            ]
            for frac, puntos in lados:
                if frac > 0.55:
                    limpiar(puntos)
    return (im, borrados / (w * h)) if borrados else None


def despegar_halo(im, cols=4, filas=4):
    """Tercer paso: borrar el halo oscuro que rodea al bicho.

    Hay hojas —el jefe yunque— que no salen ni con el muestreo de esquinas ni
    con el color llave: el servidor deja alrededor del dibujo una sombra
    oscura semitransparente que llega hasta el borde de la celda. En el
    control da 90% opaco y en pantalla es una mancha negra siguiendo al bicho.

    Se borra con una inundacion DESDE EL BORDE de cada celda, y eso es lo
    importante: borrando "todo lo oscuro" se comeria el contorno negro del
    propio dibujo, que es lo que le da la forma. Inundando desde afuera, la
    mancha se va y el contorno queda, porque la inundacion se frena justo en
    el —es opaco y no es mancha.
    """
    px = im.load()
    w, h = im.size
    cw, ch = w // cols, h // filas
    borrados = 0

    def fondo(x, y):
        r, g, b, a = px[x, y]
        if a < 200:
            return True
        return (0.3 * r + 0.59 * g + 0.11 * b) < 25

    for f in range(filas):
        for k in range(cols):
            x0, y0 = k * cw, f * ch
            pila = []
            for i in range(cw):
                pila.append((x0 + i, y0)); pila.append((x0 + i, y0 + ch - 1))
            for j in range(ch):
                pila.append((x0, y0 + j)); pila.append((x0 + cw - 1, y0 + j))
            visto = set()
            while pila:
                x, y = pila.pop()
                if (x, y) in visto: continue
                if not (x0 <= x < x0 + cw and y0 <= y < y0 + ch): continue
                visto.add((x, y))
                if not fondo(x, y): continue
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = (r, g, b, 0); borrados += 1
                pila.extend(((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
    return (im, borrados / (w * h)) if borrados else None


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


# Bajo `if __name__` PORQUE preparar_assets.py IMPORTA ESTE ARCHIVO. Suelto,
# el import recorria assets/hojas entero y volvia a comprimir con perdida las
# diecinueve hojas en cada corrida, aunque no hubiera nada que despegar.
if __name__ == "__main__":
    main()
