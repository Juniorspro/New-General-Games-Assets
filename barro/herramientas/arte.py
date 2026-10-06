#!/usr/bin/env python3
"""BARRO: pasa el arte crudo de Rezona (barro/crudo/*.png, no se commitea) a barro/arte/*.webp.

- fondos (lejos/medio): se recortan las filas vacías;
- hojas de adornos (árboles, frente): se cortan por las columnas vacías y se recorta cada uno;
- texturas (tierra, pasto): sin costura de izquierda a derecha (se mezcla con la copia corrida media vuelta).

    python3 barro/herramientas/arte.py
"""
import os, sys
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
CRUDO = os.path.join(AQUI, '..', 'crudo')
ARTE = os.path.join(AQUI, '..', 'arte')
os.makedirs(ARTE, exist_ok=True)


def guardar(im, nombre, calidad=84):
    ruta = os.path.join(ARTE, nombre + '.webp')
    im.save(ruta, 'WEBP', quality=calidad, method=6)
    print(f'{nombre}: {im.size[0]}x{im.size[1]}  {os.path.getsize(ruta) // 1024} KB')


def recortar(im, umbral=12):
    """recorta lo transparente alrededor (alfa < umbral)"""
    a = im.split()[-1].point(lambda v: 255 if v >= umbral else 0)
    caja = a.getbbox()
    return im.crop(caja) if caja else im


def sin_borde(im, px=2):
    """saca el filo semitransparente que deja el recorte automático"""
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.MinFilter(3)).point(lambda v: 0 if v < 40 else v)
    im = Image.merge('RGBA', (r, g, b, a))
    return im.crop((px, 0, im.width - px, im.height))


def hoja(im, cuantos, umbral=60):
    """corta una hoja de adornos por las columnas vacías; si salen de más o de menos, por las más vacías"""
    a = im.split()[-1]
    w, h = im.size
    col = [sum(1 for y in range(0, h, 2) if a.getpixel((x, y)) > umbral) for x in range(w)]
    tramos, dentro, ini = [], False, 0
    for x, c in enumerate(col + [0]):
        if c > 0 and not dentro:
            dentro, ini = True, x
        elif c == 0 and dentro:
            dentro = False
            if x - ini > 12:
                tramos.append((ini, x))
    while len(tramos) < cuantos and tramos:  # se parte el más ancho por su columna más vacía
        i = max(range(len(tramos)), key=lambda k: tramos[k][1] - tramos[k][0])
        x0, x1 = tramos[i]
        m0, m1 = x0 + (x1 - x0) // 5, x1 - (x1 - x0) // 5
        xc = min(range(m0, m1), key=lambda x: col[x])
        tramos[i:i + 1] = [(x0, xc), (xc + 1, x1)]
    while len(tramos) > cuantos:  # se juntan los dos más cercanos
        i = min(range(len(tramos) - 1), key=lambda k: tramos[k + 1][0] - tramos[k][1])
        tramos[i:i + 2] = [(tramos[i][0], tramos[i + 1][1])]
    piezas = [recortar(im.crop((x0, 0, x1, h))) for x0, x1 in tramos]
    if len(piezas) != cuantos:
        print(f'  ojo: salieron {len(piezas)} piezas, se esperaban {cuantos}', file=sys.stderr)
    return piezas


def sin_costura_x(im):
    """mezcla la imagen con su copia corrida media vuelta, con una rampa en la unión"""
    w, h = im.size
    corrida = Image.new(im.mode, (w, h))
    corrida.paste(im.crop((w // 2, 0, w, h)), (0, 0))
    corrida.paste(im.crop((0, 0, w // 2, h)), (w - w // 2, 0))
    mascara = Image.new('L', (w, h))
    banda = w // 6
    for x in range(w):
        d = min(abs(x - w // 2), banda) / banda   # 0 en la unión de la corrida, 1 lejos
        v = int(255 * (1 - d))
        for y in range(0, h):
            mascara.putpixel((x, y), v)
    # en el medio de la corrida está la costura original: ahí manda la imagen original
    return Image.composite(im, corrida, mascara)


def abrir(n):
    return Image.open(os.path.join(CRUDO, n + '.png'))


def mundo(m, arboles=5, frente=5):
    lejos = abrir(f'{m}-lejos').convert('RGB')
    guardar(lejos, f'{m}-lejos', 80)
    medio = sin_borde(recortar(abrir(f'{m}-medio').convert('RGBA')))
    guardar(medio, f'{m}-medio', 82)
    for i, p in enumerate(hoja(abrir(f'{m}-arboles').convert('RGBA'), arboles)):
        guardar(p, f'{m}-arbol{i}', 84)
    for i, p in enumerate(hoja(abrir(f'{m}-frente').convert('RGBA'), frente)):
        guardar(p, f'{m}-frente{i}', 84)


if __name__ == '__main__':
    que = sys.argv[1:] or ['bosque', 'tierra', 'pasto']
    for q in que:
        if q.startswith('tierra'):
            t = abrir(q).convert('RGB').resize((512, 512), Image.LANCZOS)
            guardar(sin_costura_x(t), q, 82)
        elif q.startswith('pasto'):
            p = recortar(abrir(q).convert('RGBA'))
            p = p.resize((p.width * 300 // p.height, 300), Image.LANCZOS) if p.height > 300 else p
            guardar(sin_costura_x(p), q, 84)
        elif os.path.exists(os.path.join(CRUDO, q + '-lejos.png')):
            mundo(q)
        else:
            print('no sé qué es', q)
