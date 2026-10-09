#!/usr/bin/env python3
"""Craftsman PTGI (APK de Android, Minecraft PE 0.16 rebautizado, con los shaders de Tito) → los datos
de la versión web. Lee el APK sin descomprimirlo a disco y deja en SALIDA/datos lo que usa el motor
de juego/ (que es nuestro: el juego original es libminecraftpe.so, código ARM que no corre en un
navegador).

    python3 -I empaquetar.py craftsman.apk SALIDA

Qué saca y cómo:
- el atlas del terreno: las texturas de bloques del paquete "vanilla" (el que trae el APK, con las HD
  de 128 px de Tito mezcladas con las de 16 px), cada una de su tamaño, con un borde que repite el
  de la textura (para que los mipmaps no mezclen vecinas); el costado del pasto con su máscara (el
  alfa del .tga) teñida con cada color de "overlay_color", como lo arma el juego;
- los bloques (blocks.json: forma y texturas por cara) con su número de MCPE;
- los shaders (los .vertex/.fragment de Tito) listos para WebGL: los #include resueltos y, como
  pidió el dueño, sin la sombra del personaje (renderchunk.fragment);
- la interfaz (gui.png, touchgui.png, icons.png, la fuente), el panorama del menú, el cielo, los
  textos en castellano e inglés y los sonidos (ver sonidos.py).
"""
import io
import json
import math
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

PAQUETE = "assets/resourcepacks/vanilla/"


class Apk:
    def __init__(self, ruta):
        self.z = zipfile.ZipFile(ruta)
        self.nombres = set(self.z.namelist())

    def bytes(self, nombre):
        return self.z.read(nombre)

    def texto(self, nombre):
        return self.z.read(nombre).decode("utf-8", "replace")

    def json(self, nombre):
        # los .json de MCPE traen comentarios con //
        t = re.sub(r"(?m)^\s*//[^\n]*$", "", self.texto(nombre))
        t = re.sub(r"(?<=[,{\[\s])//[^\n]*", "", t)
        return json.loads(t)

    def imagen(self, nombre):
        im = Image.open(io.BytesIO(self.z.read(nombre)))
        return im.convert("RGBA")


def color_hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------------------------
# Atlas del terreno
# ---------------------------------------------------------------------------------------------
def cargar_textura(apk, recursos, ref):
    """ref: "block.xxx" o {"path": ..., "overlay_color": ...} → (imagen RGBA, clave única)."""
    color = None
    if isinstance(ref, dict):
        color = ref.get("overlay_color")
        ref = ref["path"]
    ruta = recursos.get(ref)
    if not ruta:
        return None, None
    nombre = PAQUETE + ruta
    if nombre not in apk.nombres:
        return None, None
    im = apk.imagen(nombre)
    if im.height > im.width:          # tiras animadas (agua, lava, fuego): el primer cuadro
        im = im.crop((0, 0, im.width, im.width))
    if color:
        # la máscara del costado del pasto: el alfa marca el pasto (gris, 255) sobre la tierra (con
        # color, 0), y ahí va el color del bioma (como el grass_side_overlay de la versión de PC);
        # el resultado es opaco
        r0, g0, b0 = color_hex(color)
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                f = a / 255
                px[x, y] = (round(r * (1 - f) + r * r0 / 255 * f), round(g * (1 - f) + g * g0 / 255 * f),
                            round(b * (1 - f) + b * b0 / 255 * f), 255)
    return im, (ref, color)


def armar_atlas(apk, salida):
    recursos = apk.json(PAQUETE + "resources.json")["resources"]["textures"]
    tt = apk.json(PAQUETE + "images/terrain_texture.json")["texture_data"]
    unicas = {}        # clave única → imagen
    texturas = {}      # nombre de textura de terreno → [clave única por variante]
    for nombre, v in tt.items():
        lst = v["textures"] if isinstance(v["textures"], list) else [v["textures"]]
        claves = []
        for ref in lst:
            im, clave = cargar_textura(apk, recursos, ref)
            if im is None:
                claves.append(None)
                continue
            unicas.setdefault(clave, im)
            claves.append(clave)
        texturas[nombre] = claves
    # colocar: de la más grande a la más chica, en estantes; borde = 1/8 del lado (2 px en las de
    # 16, 16 en las de 128), como el "padding" del juego para 4 niveles de mipmap
    orden = sorted(unicas.items(), key=lambda kv: (-kv[1].height, -kv[1].width))
    ANCHO = 2048
    x = y = alto_estante = 0
    lugares = {}
    for clave, im in orden:
        b = max(2, im.width // 8)
        w, h = im.width + 2 * b, im.height + 2 * b
        if x + w > ANCHO:
            x, y, alto_estante = 0, y + alto_estante, 0
        lugares[clave] = (x + b, y + b, im.width, im.height, b)
        x += w
        alto_estante = max(alto_estante, h)
    alto = 1 << math.ceil(math.log2(y + alto_estante))
    final = Image.new("RGBA", (ANCHO, alto), (0, 0, 0, 0))
    for clave, (px, py, w, h, b) in lugares.items():
        im = unicas[clave]
        # el borde: la textura repetida alrededor (como en mosaico): así el filtro y los mipmaps de
        # un borde ven el borde opuesto, que es lo que queda al lado en el mundo
        mosaico = Image.new("RGBA", (w * 3, h * 3))
        for dy in range(3):
            for dx in range(3):
                mosaico.paste(im, (dx * w, dy * h))
        final.paste(mosaico.crop((w - b, h - b, 2 * w + b, 2 * h + b)), (px - b, py - b))
    # WebP sin pérdida: los mismos píxeles en 1 MB en vez de 3,3 (los bordes repetidos de cada textura
    # le vienen bien a su compresión)
    final.save(salida / "terreno.webp", "WEBP", lossless=True, quality=100, method=6)
    uv = {}
    for nombre, claves in texturas.items():
        lista = []
        for clave in claves:
            if clave is None:
                lista.append(None)
                continue
            px, py, w, h, b = lugares[clave]
            lista.append([px / ANCHO, py / alto, (px + w) / ANCHO, (py + h) / alto])
        uv[nombre] = lista
    print(f"atlas: {len(unicas)} texturas en {ANCHO}x{alto}")
    return uv, (ANCHO, alto)


# ---------------------------------------------------------------------------------------------
# Bloques
# ---------------------------------------------------------------------------------------------
# el número de cada bloque en MCPE 0.16 (blocks.json viene en este orden, con huecos)
IDS = {
    "air": 0, "stone": 1, "grass": 2, "dirt": 3, "cobblestone": 4, "planks": 5, "sapling": 6, "bedrock": 7,
    "flowing_water": 8, "water": 9, "flowing_lava": 10, "lava": 11, "sand": 12, "gravel": 13, "gold_ore": 14,
    "iron_ore": 15, "coal_ore": 16, "log": 17, "leaves": 18, "sponge.dry": 19, "glass": 20, "lapis_ore": 21,
    "lapis_block": 22, "dispenser": 23, "sandstone": 24, "noteblock": 25, "bed": 26, "golden_rail": 27,
    "detector_rail": 28, "sticky_piston": 29, "web": 30, "tallgrass": 31, "deadbush": 32, "piston": 33,
    "pistonArmCollision": 34, "wool": 35, "yellow_flower": 37, "red_flower": 38, "brown_mushroom": 39,
    "red_mushroom": 40, "gold_block": 41, "iron_block": 42, "double_stone_slab": 43, "stone_slab": 44,
    "brick_block": 45, "tnt": 46, "bookshelf": 47, "mossy_cobblestone": 48, "obsidian": 49, "torch": 50,
    "fire": 51, "mob_spawner": 52, "oak_stairs": 53, "chest": 54, "redstone_wire": 55, "diamond_ore": 56,
    "diamond_block": 57, "crafting_table": 58, "wheat": 59, "farmland": 60, "furnace": 61, "lit_furnace": 62,
    "standing_sign": 63, "wooden_door": 64, "ladder": 65, "rail": 66, "stone_stairs": 67, "wall_sign": 68,
    "lever": 69, "stone_pressure_plate": 70, "iron_door": 71, "wooden_pressure_plate": 72, "redstone_ore": 73,
    "lit_redstone_ore": 74, "unlit_redstone_torch": 75, "redstone_torch": 76, "stone_button": 77,
    "snow_layer": 78, "ice": 79, "snow": 80, "cactus": 81, "clay": 82, "reeds": 83, "fence": 85,
    "pumpkin": 86, "netherrack": 87, "soul_sand": 88, "glowstone": 89, "portal": 90, "lit_pumpkin": 91,
    "cake": 92, "unpowered_repeater": 93, "powered_repeater": 94, "invisibleBedrock": 95, "trapdoor": 96,
    "monster_egg": 97, "stonebrick": 98, "brown_mushroom_block": 99, "red_mushroom_block": 100,
    "iron_bars": 101, "glass_pane": 102, "melon_block": 103, "pumpkin_stem": 104, "melon_stem": 105,
    "vine": 106, "fence_gate": 107, "brick_stairs": 108, "stone_brick_stairs": 109, "mycelium": 110,
    "waterlily": 111, "nether_brick": 112, "nether_brick_fence": 113, "nether_brick_stairs": 114,
    "nether_wart": 115, "enchanting_table": 116, "brewing_stand": 117, "cauldron": 118,
    "end_portal_frame": 120, "end_stone": 121, "redstone_lamp": 123, "lit_redstone_lamp": 124,
    "dropper": 125, "activator_rail": 126, "cocoa": 127, "sandstone_stairs": 128, "emerald_ore": 129,
    "tripwire_hook": 131, "tripWire": 132, "emerald_block": 133, "spruce_stairs": 134, "birch_stairs": 135,
    "jungle_stairs": 136, "cobblestone_wall": 139, "flower_pot": 140, "carrots": 141, "potatoes": 142,
    "wooden_button": 143, "skull": 144, "anvil": 145, "trapped_chest": 146,
    "light_weighted_pressure_plate": 147, "heavy_weighted_pressure_plate": 148, "unpowered_comparator": 149,
    "powered_comparator": 150, "daylight_detector": 151, "redstone_block": 152, "quartz_ore": 153,
    "hopper": 154, "quartz_block": 155, "quartz_stairs": 156, "double_wooden_slab": 157, "wooden_slab": 158,
    "stained_hardened_clay": 159, "leaves2": 161, "log2": 162, "acacia_stairs": 163, "dark_oak_stairs": 164,
    "slime": 165, "iron_trapdoor": 167, "hay_block": 170, "carpet": 171, "hardened_clay": 172,
    "coal_block": 173, "packed_ice": 174, "double_plant": 175, "daylight_detector_inverted": 178,
    "red_sandstone": 179, "red_sandstone_stairs": 180, "double_stone_slab2": 181, "stone_slab2": 182,
    "spruce_fence_gate": 183, "birch_fence_gate": 184, "jungle_fence_gate": 185, "dark_oak_fence_gate": 186,
    "acacia_fence_gate": 187, "spruce_door": 193, "birch_door": 194, "jungle_door": 195, "acacia_door": 196,
    "dark_oak_door": 197, "grass_path": 198, "frame": 199, "podzol": 243, "beetroot": 244,
    "stonecutter": 245, "glowingobsidian": 246, "netherreactor": 247, "info_update": 248,
    "info_update2": 249, "movingBlock": 250, "reserved6": 255,
}


def bloques(apk):
    bj = apk.json(PAQUETE + "blocks.json")
    salida = {}
    for nombre, v in bj.items():
        if nombre not in IDS:
            print("bloque sin número:", nombre)
            continue
        b = {"n": nombre, "f": v.get("blockshape", "cubo")}
        if "textures" in v:
            b["t"] = v["textures"]
        if "carried_textures" in v:
            b["c"] = v["carried_textures"]
        if "isotropic" in v:
            b["i"] = v["isotropic"]
        salida[IDS[nombre]] = b
    return salida


# ---------------------------------------------------------------------------------------------
# Shaders
# ---------------------------------------------------------------------------------------------
def quitar_bloque(texto, inicio):
    """Saca de texto cada bloque que empieza con `inicio` (hasta su llave de cierre)."""
    n = 0
    while True:
        i = texto.find(inicio)
        if i < 0:
            return texto, n
        j = i + len(inicio)
        prof = inicio.count("{") - inicio.count("}")
        while prof > 0:
            c = texto[j]
            if c == "{":
                prof += 1
            elif c == "}":
                prof -= 1
            j += 1
        texto = texto[:i] + texto[j:]
        n += 1


def sin_sombra_del_personaje(frag):
    # la "sombra del personaje" de Tito: cinco capas (para el borde suave) de tres rectángulos
    # (cabeza, cuerpo, piernas) que oscurecen el piso alrededor de la cámara, armados con posE y
    # mobshd. El dueño pidió sacarla: se quitan esas capas y nada más
    patron = re.compile(r"if\(uv1\.y\s*>=\s*0\.87\d+\s*&&\s*fog_flag\s*==\s*0\.0\)\{if\(color\.w\s*>=\s*0\.6\d*\)\{")
    n = 0
    while True:
        m = patron.search(frag)
        if not m:
            break
        frag, k = quitar_bloque(frag, m.group(0))
        n += k
    if n != 5:
        sys.exit(f"empaquetar: se esperaban 5 capas de la sombra del personaje y hay {n}")
    if "posE.x <" in frag:
        sys.exit("empaquetar: quedó algo de la sombra del personaje")
    return frag


def shaders(apk):
    base = "assets/shaders/"
    fuentes = {}
    for nombre in sorted(apk.nombres):
        if nombre.startswith(base) and nombre.endswith((".vertex", ".fragment")):
            fuentes[nombre[len(base):]] = apk.texto(nombre)
    util = apk.texto(base + "util.h")
    for k in list(fuentes):
        fuentes[k] = fuentes[k].replace('#include "shaders/util.h"', util)
    fuentes["renderchunk.fragment"] = sin_sombra_del_personaje(fuentes["renderchunk.fragment"])
    # sólo los que usa el motor
    usados = ["renderchunk.vertex", "renderchunk.fragment", "sky.vertex", "color.fragment", "cloud.vertex",
              "entity.vertex", "entity.fragment", "uv.vertex", "texture.fragment", "color.vertex",
              "stars.fragment", "position.vertex", "texture_ccolor.fragment", "color_uv.vertex",
              "uv_selection_overlay.vertex", "texture_blend.fragment", "rain_snow.vertex", "rain_snow.fragment"]
    return {k: fuentes[k] for k in usados if k in fuentes}


def cielo(apk, salida):
    # el sol, la luna (la fase llena: la primera de las 8 de moon_phases.png) y las grietas al romper
    env = PAQUETE + "images/environment/"
    apk.imagen(env + "sun.png").save(salida / "sol.png", optimize=True)
    luna = apk.imagen(env + "moon_phases.png")
    w, h = luna.width // 4, luna.height // 2
    luna.crop((0, 0, w, h)).save(salida / "luna.png", optimize=True)
    for i in range(10):
        apk.imagen(env + f"destroy_stage_{i}.png").save(salida / f"grieta{i}.png", optimize=True)


# ---------------------------------------------------------------------------------------------
# Interfaz
# ---------------------------------------------------------------------------------------------
def interfaz(apk, salida):
    g = "assets/images/gui/"
    for origen, destino in (("gui.png", "gui.png"), ("icons.png", "iconos.png")):
        apk.imagen(g + origen).save(salida / destino, optimize=True)
    apk.imagen("assets/images/font/default8.png").save(salida / "fuente.png", optimize=True)
    b = g + "newgui/buttons/border/"
    for origen, destino in (("base", "boton"), ("hover", "botonEncima"), ("basePress", "botonApretado")):
        apk.imagen(b + origen + ".png").save(salida / (destino + ".png"), optimize=True)
    # el panorama del menú (la cueva): 6 caras de 1000 px; a 512 en JPEG alcanza (se ve de fondo, oscuro)
    for i in range(6):
        im = apk.imagen(g + f"background/panorama_{i}.png").convert("RGB").resize((512, 512), Image.LANCZOS)
        im.save(salida / f"panorama{i}.jpg", quality=80, optimize=True, progressive=True)
    apk.imagen("res/drawable-xhdpi-v4/icon.png").resize((96, 96), Image.LANCZOS).save(salida / "icono.png", optimize=True)


def textos(apk):
    """los textos del juego en castellano (los de bolsillo), sólo los que usa la interfaz y los
    nombres de los bloques"""
    sal = {}
    for linea in apk.texto("assets/loc/es_ES-pocket.lang").splitlines():
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, v = linea.split("=", 1)
        v = v.split("\t#")[0].rstrip()
        if k.startswith(("menu.", "gui.", "selectWorld.", "tile.", "options.", "deathScreen.")):
            sal[k] = v
    return sal


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    apk = Apk(sys.argv[1])
    salida = Path(sys.argv[2]) / "datos"
    salida.mkdir(parents=True, exist_ok=True)
    cielo(apk, salida)
    interfaz(apk, salida)
    uv, tam = armar_atlas(apk, salida)
    import sonidos
    datos = {
        "atlas": {"tam": tam, "uv": uv},
        "bloques": bloques(apk),
        "shaders": shaders(apk),
        "textos": textos(apk),
        "sonidos": sonidos.sacar(apk, salida),
    }
    (salida / "datos.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("datos:", (salida / "datos.json").stat().st_size, "bytes")


if __name__ == "__main__":
    main()
