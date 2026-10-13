"""Los objetos de la 1.2 que no son bloques (herramientas, armaduras, comida, materiales...): sus
dibujos de textures/items, según textures/item_texture.json, en un atlas (objetos.png), y lo que el
behavior pack dice de ellos (items.json: la comida, cuánto tarda en comerse, las semillas). Los
números, los nombres y lo que el juego tiene en código (pilas, durabilidad, herramientas, armaduras)
están en juego/items.js.
"""
import math

from PIL import Image

LADO = 16
COLUMNAS = 32
# el color del cuero sin teñir (el de la armadura de cuero del juego)
CUERO = (160, 101, 64)


def _cuero(im):
    """las armaduras de cuero: lo gris (alfa 255) se tiñe con el color del cuero; lo que tiene alfa
    bajo (las costuras, los detalles) va tal cual y opaco"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a == 255:
                px[x, y] = (r * CUERO[0] // 255, g * CUERO[1] // 255, b * CUERO[2] // 255, 255)
            else:
                px[x, y] = (r, g, b, 255)


def armar(apk, paquete, salida, guardar_png):
    tex = apk.json(paquete + "textures/item_texture.json")["texture_data"]
    lugar, imagenes, claves = {}, [], {}
    for clave, v in tex.items():
        lista = v["textures"]
        lista = [lista] if isinstance(lista, str) else lista
        indices = []
        for ruta in lista:
            if not isinstance(ruta, str):
                indices.append(-1)
                continue
            if ruta not in lugar:
                im = apk.textura(ruta)
                if im is None:
                    indices.append(-1)
                    continue
                if im.height > im.width:            # la brújula y el reloj animados: el primer cuadro
                    im = im.crop((0, 0, im.width, im.width))
                if im.size != (LADO, LADO):
                    im = im.resize((LADO, LADO), Image.NEAREST)
                if "/leather_" in ruta:
                    _cuero(im)
                lugar[ruta] = len(imagenes)
                imagenes.append(im)
            indices.append(lugar[ruta])
        claves[clave] = indices
    filas = math.ceil(len(imagenes) / COLUMNAS)
    atlas = Image.new("RGBA", (COLUMNAS * LADO, filas * LADO))
    for i, im in enumerate(imagenes):
        atlas.paste(im, ((i % COLUMNAS) * LADO, (i // COLUMNAS) * LADO))
    guardar_png(atlas, salida / "objetos.png")
    comida = apk.json("assets/behavior_packs/vanilla/items.json")["items"]
    print(f"objetos: {len(imagenes)} dibujos en {atlas.width}x{atlas.height}, {len(comida)} de items.json")
    return {"texturas": claves, "columnas": COLUMNAS, "items": comida}
