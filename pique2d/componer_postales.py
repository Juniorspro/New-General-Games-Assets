#!/usr/bin/env python3
"""Arma una postal por tema apilando las capas de fondo que ya existen.

Por que componer y no generar ocho imagenes nuevas: las capas YA estan, son
las mismas que ve el jugador, y una postal generada aparte seria otra imagen
—parecida pero distinta— y la tarjeta del mapa prometeria un nivel que no es.
Ademas cuesta cero creditos.

Se apila cielo + lejos + cerca + una franja de la textura del terreno con su
borde de pasto. Es el corte transversal de lo que dibuja el juego.
"""
import pathlib
from PIL import Image

AQUI = pathlib.Path(__file__).parent
TEMAS = ["llano", "subte", "cielo", "castillo", "fantasma", "desierto", "nave", "torre"]
W, H = 320, 180
SUELO = 46           # alto de la franja de terreno, en pixeles de la postal


def capa(tema, nombre):
    p = AQUI / "assets" / "fondo" / f"{tema}_{nombre}.webp"
    return Image.open(p).convert("RGBA") if p.exists() else None


def postal(tema):
    base = Image.new("RGBA", (W, H), (20, 24, 36, 255))

    cielo = capa(tema, "cielo")
    if cielo:
        esc = W / cielo.width * 1.0
        c = cielo.resize((W, max(1, int(cielo.height * esc))), Image.NEAREST)
        base.paste(c, (0, 0))
        # Si la imagen no llega abajo, se estira su ultima fila. Dejar un hueco
        # se ve como un error; estirar una fila de cielo no se nota.
        if c.height < H:
            ultima = c.crop((0, c.height - 1, W, c.height)).resize((W, H - c.height), Image.NEAREST)
            base.paste(ultima, (0, c.height))

    for nombre, alto, y in (("lejos", 74, H - SUELO - 74), ("cerca", 52, H - SUELO - 52)):
        im = capa(tema, nombre)
        if not im:
            continue
        esc = alto / im.height
        im = im.resize((max(1, int(im.width * esc)), alto), Image.NEAREST)
        # Se repite a lo ancho, igual que en el juego.
        for x in range(0, W, im.width):
            base.alpha_composite(im, (x, y))

    tile = AQUI / "assets" / "tile" / f"{tema}.webp"
    if tile.exists():
        t = Image.open(tile).convert("RGBA").resize((32, 32), Image.NEAREST)
        for x in range(0, W, 32):
            for y in range(H - SUELO, H, 32):
                base.alpha_composite(t, (x, y))
        # El borde de pasto: la misma linea que dibuja el juego arriba del suelo.
        from json import loads
        borde = {"llano": (63, 163, 77), "subte": (111, 168, 199), "cielo": (255, 255, 255),
                 "castillo": (200, 80, 90), "fantasma": (155, 143, 196),
                 "desierto": (140, 193, 82), "nave": (201, 162, 39), "torre": (208, 160, 224)}[tema]
        franja = Image.new("RGBA", (W, 4), borde + (255,))
        base.alpha_composite(franja, (0, H - SUELO))
        base.alpha_composite(Image.new("RGBA", (W, 1), (0, 0, 0, 70)), (0, H - SUELO + 4))

    return base.convert("RGB")


def main():
    dest = AQUI / "assets" / "postal"
    dest.mkdir(exist_ok=True)
    total = 0
    for tema in TEMAS:
        p = dest / f"{tema}.webp"
        postal(tema).save(p, "WEBP", quality=82, method=6)
        total += p.stat().st_size
    print(f"{len(TEMAS)} postales · {total // 1024} KB · cero creditos")


main()
