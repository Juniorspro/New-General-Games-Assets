#!/usr/bin/env python3
"""Minecraft PE 1.2 (APK de Android) → los datos de la versión web. Lee el APK sin descomprimirlo a
disco y deja en SALIDA/datos lo que usa el motor de juego/ (que es nuestro: el juego original es
libminecraftpe.so, código nativo que no corre en un navegador).

    python3 -I empaquetar.py Minecraft-1.2.apk Craftsman_PTGI.apk SALIDA

El segundo APK es el Craftsman PTGI de Tito Crack 6000: de ahí salen sus shaders, que el dueño pidió
como opción al empezar (sin la sombra del personaje, como en el port de Craftsman). Sin shaders se
juega con los de fábrica de la 1.2, que se compilan igual.

Qué saca y cómo:
- el atlas del terreno (textures/terrain_texture.json): cada textura de su tamaño, con un borde que
  repite el de la textura (para que los mipmaps no mezclen vecinas); el costado del pasto con su
  máscara (el alfa del .tga) teñida con cada color de "overlay_color", como lo arma el juego;
- los bloques (blocks.json: forma, texturas por cara y el sonido) con su número de la 1.2;
- los shaders: los de Tito y los de fábrica (assets/shaders/glsl), con los #include resueltos;
- la interfaz de la 1.2 (los dibujos de textures/ui en un solo atlas con sus "nineslice", gui.png,
  la fuente, el logo, el panorama del menú, las frases amarillas), los textos en inglés, castellano
  (el de México, como el juego) y portugués (el de Brasil), los sonidos (ver sonidos.py del port de
  Craftsman, el mismo FSB5), los modelos de los bichos (models/mobs.json) y sus texturas.
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
# el decodificador de los FSB de FMOD es el del port de Craftsman (los mismos FADPCM)
sys.path.insert(0, str(AQUI.parent / "craftsman"))

PAQUETE = "assets/resource_packs/vanilla/"


def jsonc(texto):
    """los .json del juego traen comentarios (// y /* */, también al final de una línea) y comas de
    más: se sacan fuera de las cadenas"""
    out, i, n, en = [], 0, len(texto), False
    while i < n:
        c = texto[i]
        if en:
            out.append(c)
            if c == "\\":
                out.append(texto[i + 1])
                i += 2
                continue
            if c == '"':
                en = False
            i += 1
            continue
        if c == '"':
            en = True
        elif texto.startswith("//", i):
            j = texto.find("\n", i)
            i = n if j < 0 else j
            continue
        elif texto.startswith("/*", i):
            j = texto.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        out.append(c)
        i += 1
    return json.loads(re.sub(r",(\s*[}\]])", r"\1", "".join(out)))


class Apk:
    def __init__(self, ruta):
        self.z = zipfile.ZipFile(ruta)
        self.nombres = set(self.z.namelist())

    def bytes(self, nombre):
        return self.z.read(nombre)

    def texto(self, nombre):
        return self.z.read(nombre).decode("utf-8-sig", "replace")

    def json(self, nombre):
        return jsonc(self.texto(nombre))

    def imagen(self, nombre):
        return Image.open(io.BytesIO(self.z.read(nombre))).convert("RGBA")

    def textura(self, ruta):
        """"textures/blocks/x" (sin extensión, como en los .json del juego) → imagen o None"""
        for ext in (".png", ".tga"):
            if PAQUETE + ruta + ext in self.nombres:
                return self.imagen(PAQUETE + ruta + ext)
        return None


def color_hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def guardar_png(im, ruta):
    im.save(ruta, optimize=True)


# ---------------------------------------------------------------------------------------------
# Atlas del terreno
# ---------------------------------------------------------------------------------------------
def cargar_textura(apk, ref):
    """ref: "textures/blocks/x" o {"path": ..., "overlay_color" | "tint_color": ...} → (imagen, clave)"""
    color = tinte = None
    if isinstance(ref, dict):
        color = ref.get("overlay_color")
        tinte = ref.get("tint_color")
        ref = ref["path"]
    im = apk.textura(ref)
    if im is None:
        return None, None
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
    elif tinte:
        # el nenúfar: su color va pintado en la textura
        r0, g0, b0 = color_hex(tinte)
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                px[x, y] = (r * r0 // 255, g * g0 // 255, b * b0 // 255, a)
    return im, (ref, color, tinte)


def armar_atlas(apk, salida):
    tt = apk.json(PAQUETE + "textures/terrain_texture.json")["texture_data"]
    unicas = {}        # clave única → imagen
    texturas = {}      # nombre de textura de terreno → [clave única por variante]
    for nombre, v in tt.items():
        lst = v["textures"] if isinstance(v["textures"], list) else [v["textures"]]
        claves = []
        for ref in lst:
            im, clave = cargar_textura(apk, ref)
            if im is None:
                claves.append(None)
                continue
            unicas.setdefault(clave, im)
            claves.append(clave)
        texturas[nombre] = claves
    # colocar: de la más grande a la más chica, en estantes; borde = 1/4 del lado (4 px en las de
    # 16): con 3 niveles de mipmap el último todavía tiene medio píxel de borde y de lejos no se
    # mezclan las vecinas (con 2 px el agua del mar hacía anillos a lo lejos)
    orden = sorted(unicas.items(), key=lambda kv: (-kv[1].height, -kv[1].width))
    ANCHO = 1024
    x = y = alto_estante = 0
    lugares = {}
    for clave, im in orden:
        b = max(4, im.width // 4)
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
# el número de cada bloque en la 1.2 (blocks.json trae el nombre; el número está en el código)
IDS = {
    "air": 0, "stone": 1, "grass": 2, "dirt": 3, "cobblestone": 4, "planks": 5, "sapling": 6, "bedrock": 7,
    "flowing_water": 8, "water": 9, "flowing_lava": 10, "lava": 11, "sand": 12, "gravel": 13, "gold_ore": 14,
    "iron_ore": 15, "coal_ore": 16, "log": 17, "leaves": 18, "sponge": 19, "glass": 20, "lapis_ore": 21,
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
    "snow_layer": 78, "ice": 79, "snow": 80, "cactus": 81, "clay": 82, "reeds": 83, "jukebox": 84, "fence": 85,
    "pumpkin": 86, "netherrack": 87, "soul_sand": 88, "glowstone": 89, "portal": 90, "lit_pumpkin": 91,
    "cake": 92, "unpowered_repeater": 93, "powered_repeater": 94, "invisibleBedrock": 95, "trapdoor": 96,
    "monster_egg": 97, "stonebrick": 98, "brown_mushroom_block": 99, "red_mushroom_block": 100,
    "iron_bars": 101, "glass_pane": 102, "melon_block": 103, "pumpkin_stem": 104, "melon_stem": 105,
    "vine": 106, "fence_gate": 107, "brick_stairs": 108, "stone_brick_stairs": 109, "mycelium": 110,
    "waterlily": 111, "nether_brick": 112, "nether_brick_fence": 113, "nether_brick_stairs": 114,
    "nether_wart": 115, "enchanting_table": 116, "brewing_stand": 117, "cauldron": 118,
    "end_portal_frame": 120, "end_stone": 121, "dragon_egg": 122, "redstone_lamp": 123, "lit_redstone_lamp": 124,
    "dropper": 125, "activator_rail": 126, "cocoa": 127, "sandstone_stairs": 128, "emerald_ore": 129,
    "ender_chest": 130, "tripwire_hook": 131, "tripWire": 132, "emerald_block": 133, "spruce_stairs": 134,
    "birch_stairs": 135, "jungle_stairs": 136, "command_block": 137, "beacon": 138, "cobblestone_wall": 139,
    "flower_pot": 140, "carrots": 141, "potatoes": 142, "wooden_button": 143, "skull": 144, "anvil": 145,
    "trapped_chest": 146, "light_weighted_pressure_plate": 147, "heavy_weighted_pressure_plate": 148,
    "unpowered_comparator": 149, "powered_comparator": 150, "daylight_detector": 151, "redstone_block": 152,
    "quartz_ore": 153, "hopper": 154, "quartz_block": 155, "quartz_stairs": 156, "double_wooden_slab": 157,
    "wooden_slab": 158, "stained_hardened_clay": 159, "stained_glass_pane": 160, "leaves2": 161, "log2": 162,
    "acacia_stairs": 163, "dark_oak_stairs": 164, "slime": 165, "iron_trapdoor": 167, "prismarine": 168,
    "seaLantern": 169, "hay_block": 170, "carpet": 171, "hardened_clay": 172, "coal_block": 173,
    "packed_ice": 174, "double_plant": 175, "standing_banner": 176, "wall_banner": 177,
    "daylight_detector_inverted": 178, "red_sandstone": 179, "red_sandstone_stairs": 180,
    "double_stone_slab2": 181, "stone_slab2": 182, "spruce_fence_gate": 183, "birch_fence_gate": 184,
    "jungle_fence_gate": 185, "dark_oak_fence_gate": 186, "acacia_fence_gate": 187,
    "repeating_command_block": 188, "chain_command_block": 189, "spruce_door": 193, "birch_door": 194,
    "jungle_door": 195, "acacia_door": 196, "dark_oak_door": 197, "grass_path": 198, "frame": 199,
    "chorus_flower": 200, "purpur_block": 201, "purpur_stairs": 203, "undyed_shulker_box": 205,
    "end_bricks": 206, "frosted_ice": 207, "end_rod": 208, "magma": 213, "nether_wart_block": 214,
    "red_nether_brick": 215, "bone_block": 216, "structure_void": 217, "shulker_box": 218,
    "purple_glazed_terracotta": 219, "white_glazed_terracotta": 220, "orange_glazed_terracotta": 221,
    "magenta_glazed_terracotta": 222, "light_blue_glazed_terracotta": 223, "yellow_glazed_terracotta": 224,
    "lime_glazed_terracotta": 225, "pink_glazed_terracotta": 226, "gray_glazed_terracotta": 227,
    "silver_glazed_terracotta": 228, "cyan_glazed_terracotta": 229, "blue_glazed_terracotta": 231,
    "brown_glazed_terracotta": 232, "green_glazed_terracotta": 233, "red_glazed_terracotta": 234,
    "black_glazed_terracotta": 235, "concrete": 236, "concretePowder": 237, "chorus_plant": 240,
    "stained_glass": 241, "podzol": 243, "beetroot": 244, "stonecutter": 245, "glowingobsidian": 246,
    "netherreactor": 247, "info_update": 248, "info_update2": 249, "movingBlock": 250, "observer": 251,
    "structure_block": 252, "reserved6": 255,
}


def bloques(apk):
    bj = apk.json(PAQUETE + "blocks.json")
    salida = {}
    for nombre, v in bj.items():
        if not isinstance(v, dict):
            continue
        if nombre not in IDS:
            print("bloque sin número:", nombre)
            continue
        b = {"n": nombre, "f": v.get("blockshape", "cubo")}
        if "textures" in v:
            b["t"] = v["textures"]
        if "carried_textures" in v:
            b["c"] = v["carried_textures"]
        if "sound" in v:
            b["s"] = v["sound"]
        salida[IDS[nombre]] = b
    return salida


# ---------------------------------------------------------------------------------------------
# Shaders
# ---------------------------------------------------------------------------------------------
USADOS = ["renderchunk.vertex", "renderchunk.fragment", "sky.vertex", "color.fragment", "cloud.vertex",
          "entity.vertex", "entity.fragment", "uv.vertex", "texture.fragment", "color.vertex",
          "stars.fragment", "position.vertex", "texture_ccolor.fragment", "color_uv.vertex",
          "uv_selection_overlay.vertex", "texture_blend.fragment", "rain_snow.vertex", "rain_snow.fragment"]


def resolver_includes(fuentes, texto, vistos=None):
    """#include "shaders/x.h" → el contenido (recursivo; cada uno una sola vez, como sus guardas)"""
    vistos = set() if vistos is None else vistos

    def poner(m):
        n = m.group(1).split("/")[-1]
        if n in vistos or n not in fuentes:
            return ""
        vistos.add(n)
        return resolver_includes(fuentes, fuentes[n], vistos)
    return re.sub(r'#include\s+"([^"]+)"', poner, texto)


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


def shaders_tito(craftsman):
    base = "assets/shaders/"
    fuentes = {}
    for nombre in sorted(craftsman.nombres):
        if nombre.startswith(base) and nombre.endswith((".vertex", ".fragment", ".h")):
            fuentes[nombre[len(base):].split("/")[-1]] = craftsman.texto(nombre)
    sal = {k: resolver_includes(fuentes, fuentes[k]) for k in USADOS if k in fuentes}
    sal["renderchunk.fragment"] = sin_sombra_del_personaje(sal["renderchunk.fragment"])
    return sal


def shaders_vanilla(apk):
    base = "assets/shaders/glsl/"
    fuentes = {}
    for nombre in sorted(apk.nombres):
        if nombre.startswith(base) and nombre.endswith((".vertex", ".fragment", ".h")):
            fuentes[nombre[len(base):]] = apk.texto(nombre)
    return {k: resolver_includes(fuentes, fuentes[k]) for k in USADOS if k in fuentes}


def cielo(apk, salida):
    # el sol, la luna (la fase llena: la primera de las 8 de moon_phases.png), las nubes de la 1.2
    # (clouds.png: de cada píxel sale una caja) y las grietas al romper
    env = PAQUETE + "textures/environment/"
    guardar_png(apk.imagen(env + "sun.png"), salida / "sol.png")
    luna = apk.imagen(env + "moon_phases.png")
    w, h = luna.width // 4, luna.height // 2
    guardar_png(luna.crop((0, 0, w, h)), salida / "luna.png")
    guardar_png(apk.imagen(env + "clouds.png"), salida / "nubes.png")
    for i in range(10):
        guardar_png(apk.imagen(env + f"destroy_stage_{i}.png"), salida / f"grieta{i}.png")


# ---------------------------------------------------------------------------------------------
# Interfaz
# ---------------------------------------------------------------------------------------------
# los dibujos de textures/ui que usa la interfaz (van todos en un atlas, con su "nineslice")
UI = [
    "button_borderless_light", "button_borderless_lighthover", "button_borderless_lightpressed",
    "button_borderless_dark", "button_borderless_darkhover", "button_borderless_darkpressed", "control",
    "disabledButtonNoBorder", "focus_border_white", "default_indent", "dialog_background_hollow_4",
    "dialog_background_opaque", "header_bar", "TabTopFront", "TabTopBack", "TabTopFrontLeftMost",
    "TabTopBackLeftMost", "TabTopFrontRightMost", "TabTopBackRightMost", "toggle_on", "toggle_off",
    "toggle_on_hover", "toggle_off_hover", "slider_background", "slider_progress", "slider_button_default",
    "slider_button_hover", "dropdown_background", "dropdown_chevron", "edit_box_indent", "edit_box_indent_hover",
    "worldsIcon", "servers", "addServer", "editIcon", "World", "default_world", "Friend1", "lan_icon",
    "Ping_Green", "Ping_Yellow", "Ping_Red", "Ping_Offline_Red", "online", "offline", "trash", "lock",
    "language_glyph", "language_glyph_color", "world_glyph", "world_glyph_color", "sound_glyph",
    "sound_glyph_color", "video_glyph", "video_glyph_color", "touch_glyph", "touch_glyph_color",
    "controller_glyph", "controller_glyph_color", "profile_glyph", "profile_glyph_color", "multiplayer_glyph",
    "multiplayer_glyph_color", "chat_send", "chat_keyboard", "chat_down_arrow", "heart", "heart_half",
    "heart_background", "heart_blink", "heart_flash", "heart_flash_half", "hotbar_0", "hotbar_1", "hotbar_2",
    "hotbar_3", "hotbar_4", "hotbar_5", "hotbar_6", "hotbar_7", "hotbar_8", "hotbar_start_cap", "hotbar_end_cap",
    "selected_hotbar_slot", "item_cell", "highlight_slot", "ScrollHandle", "ScrollRail", "x_default", "x_hover",
    "x_pressed", "back_button_default", "back_button_hover", "back_button_pressed", "arrow_l_default",
    "arrow_r_default", "seeds", "cell_image", "screen_background", "panel_outline", "middle_strip",
    "player_online_icon", "player_offline_icon", "sword", "Black", "Gray",
    "realmsIcon", "refresh_light", "infobulb", "icon_recipe_construction", "icon_recipe_nature",
    "icon_recipe_equipment", "icon_recipe_item", "magnifyingGlass", "Wrenches1",
]


def atlas_ui(apk, salida):
    piezas = {}
    for n in UI:
        im = apk.textura("textures/ui/" + n)
        if im is None:
            print("ui: falta", n)
            continue
        nueve = None
        js = PAQUETE + "textures/ui/" + n + ".json"
        if js in apk.nombres:
            d = apk.json(js)
            nueve = d.get("nineslice_size")
            if isinstance(nueve, int):
                nueve = [nueve] * 4
        piezas[n] = (im, nueve)
    # en estantes, un píxel transparente entre cada una (que el suavizado no mezcle)
    orden = sorted(piezas.items(), key=lambda kv: -kv[1][0].height)
    ANCHO = 512
    x = y = alto = 0
    lugar = {}
    for n, (im, nueve) in orden:
        if x + im.width + 1 > ANCHO:
            x, y, alto = 0, y + alto + 1, 0
        lugar[n] = (x, y)
        x += im.width + 1
        alto = max(alto, im.height)
    final = Image.new("RGBA", (ANCHO, y + alto), (0, 0, 0, 0))
    mapa = {}
    for n, (im, nueve) in piezas.items():
        px, py = lugar[n]
        final.paste(im, (px, py))
        mapa[n] = [px, py, im.width, im.height] + ([nueve] if nueve else [])
    guardar_png(final, salida / "ui.png")
    print(f"interfaz: {len(mapa)} dibujos en {final.width}x{final.height}")
    return mapa


def interfaz(apk, salida):
    g = PAQUETE + "textures/gui/"
    for origen, destino in (("gui.png", "gui.png"), ("icons.png", "iconos.png")):
        guardar_png(apk.imagen(g + origen), salida / destino)
    guardar_png(apk.imagen(PAQUETE + "font/default8.png"), salida / "fuente.png")
    # el logo de la 1.2 (1936 px de ancho): a 1024 alcanza en cualquier teléfono
    logo = apk.imagen(PAQUETE + "textures/ui/title.png")
    logo = logo.resize((1024, round(logo.height * 1024 / logo.width)), Image.LANCZOS)
    logo.save(salida / "logo.webp", "WEBP", quality=90, method=6)
    # el panorama del menú (un mundo con un río): 6 caras de 1080 px; a 768 en JPEG se ve bien de
    # fondo y pesa poco
    for i in range(6):
        im = apk.imagen(PAQUETE + f"textures/ui/panorama_{i}.png").convert("RGB").resize((768, 768), Image.LANCZOS)
        im.save(salida / f"panorama{i}.jpg", quality=80, optimize=True, progressive=True)
    apk.imagen("res/drawable-xxhdpi-v4/icon.png").resize((96, 96), Image.LANCZOS).save(salida / "icono.png", optimize=True)
    # los huevos de los bichos (el inventario creativo los trae para hacerlos aparecer)
    for n in ("spawn_egg", "spawn_egg_overlay"):
        guardar_png(apk.imagen(PAQUETE + f"textures/items/{n}.png"), salida / f"{n}.png")
    return atlas_ui(apk, salida)


IDIOMAS = {"en": "en_US", "es": "es_MX", "pt": "pt_BR"}
PREFIJOS_TEXTO = ("menu.", "gui.", "selectWorld.", "tile.", "options.", "deathScreen.", "createWorldScreen.",
                  "generator.", "itemGroup.", "chat.", "multiplayer.player.", "death.", "pauseScreen.",
                  "playscreen.", "networkWorld.", "addExternalServerScreen.", "entity.", "item.spawn_egg.",
                  "controllerLayoutScreen.", "language.", "hudScreen.", "selectServer.", "disconnectionScreen.",
                  "progressScreen.title", "progressScreen.generating", "progressScreen.saving", "connect.",
                  "settings.", "disconnectionScreen.disconnected", "disconnectionScreen.noReason", "craftingScreen.tab.",
                  "container.")
FUERA_TEXTO = ("options.dev_", "createWorld.customize")


def textos(apk):
    """los textos del juego en los tres idiomas que se eligen al empezar: sólo los que usa la
    interfaz y los nombres de los bloques y los bichos"""
    sal = {}
    for corto, archivo in IDIOMAS.items():
        t = {}
        for linea in apk.texto(PAQUETE + f"texts/{archivo}.lang").splitlines():
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            k, v = linea.split("=", 1)
            v = v.split("\t#")[0].rstrip()
            if k.startswith(PREFIJOS_TEXTO) and not k.startswith(FUERA_TEXTO):
                t[k] = v
        sal[corto] = t
    return sal


def frases(apk):
    # las frases amarillas del título (sólo las que la fuente del juego puede escribir)
    l = apk.json(PAQUETE + "splashes.json")["splashes"]
    return [s for s in l if all(32 <= ord(c) < 127 for c in s)]


# ---------------------------------------------------------------------------------------------
# Bichos: los modelos de models/mobs.json (con la herencia "hijo:padre" resuelta: los huesos con
# "reset" reemplazan al del padre y los demás le cambian sólo lo que traen) y sus texturas
# ---------------------------------------------------------------------------------------------
BICHOS = {
    # nombre: [(geometría, textura), ...] (capas del modelo)
    "pig": [("geometry.pig", "pig/pig")],
    "cow": [("geometry.cow", "cow/cow")],
    "sheep": [("geometry.sheep.sheared", "sheep/sheep"), ("geometry.sheep", "sheep/sheep")],
    "chicken": [("geometry.chicken", "chicken")],
    "zombie": [("geometry.zombie", "zombie/zombie")],
    "skeleton": [("geometry.skeleton", "skeleton/skeleton")],
    "creeper": [("geometry.creeper", "creeper/creeper")],
    "spider": [("geometry.spider", "spider/spider")],
    "steve": [("geometry.humanoid.custom", "steve")],
    "alex": [("geometry.humanoid.customSlim", "alex")],
}


def geometrias(apk):
    crudo = apk.json(PAQUETE + "models/mobs.json")
    por_nombre, padre = {}, {}
    for k, v in crudo.items():
        n, _, p = k.partition(":")
        por_nombre[n] = v
        if p:
            padre[n] = p

    def resolver(n):
        g = por_nombre[n]
        if n not in padre:
            return {"tw": g.get("texturewidth", 64), "th": g.get("textureheight", 64),
                    "huesos": [dict(h) for h in g.get("bones", [])]}
        base = resolver(padre[n])
        huesos = base["huesos"]
        for h in g.get("bones", []):
            i = next((j for j, b in enumerate(huesos) if b["name"] == h["name"]), -1)
            if i < 0:
                huesos.append(dict(h))
            elif h.get("reset"):
                huesos[i] = dict(h)
            else:
                huesos[i] = {**huesos[i], **h}
        return {"tw": g.get("texturewidth", base["tw"]), "th": g.get("textureheight", base["th"]), "huesos": huesos}
    return resolver


def bichos(apk, salida):
    resolver = geometrias(apk)
    sal = {}
    for nombre, capas in BICHOS.items():
        lista = []
        for geo, tex in capas:
            g = resolver(geo)
            huesos = []
            for h in g["huesos"]:
                if h.get("neverRender") or not h.get("cubes"):
                    continue
                cubos = [{"o": c["origin"], "t": c["size"], "uv": c["uv"], "i": c.get("inflate", 0)} for c in h["cubes"]]
                b = {"n": h["name"], "p": h.get("pivot", [0, 0, 0]), "c": cubos}
                if h.get("rotation") and any(h["rotation"]):
                    b["r"] = h["rotation"]
                if h.get("mirror"):
                    b["m"] = True
                huesos.append(b)
            im = apk.textura("textures/entity/" + tex)
            archivo = "bicho_" + tex.replace("/", "_") + ".png"
            if not (salida / archivo).exists():
                guardar_png(im, salida / archivo)
            lista.append({"tex": archivo, "tw": im.width, "th": im.height, "huesos": huesos})
        sal[nombre] = lista
    print("bichos:", ", ".join(sal))
    return sal


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    apk = Apk(sys.argv[1])
    craftsman = Apk(sys.argv[2])
    salida = Path(sys.argv[3]) / "datos"
    salida.mkdir(parents=True, exist_ok=True)
    cielo(apk, salida)
    ui = interfaz(apk, salida)
    uv, tam = armar_atlas(apk, salida)
    import sonidos12
    datos = {
        "atlas": {"tam": tam, "uv": uv},
        "bloques": bloques(apk),
        "shaders": {"tito": shaders_tito(craftsman), "vanilla": shaders_vanilla(apk)},
        "textos": textos(apk),
        "frases": frases(apk),
        "ui": ui,
        "bichos": bichos(apk, salida),
        "sonidos": sonidos12.sacar(apk, salida, PAQUETE),
    }
    (salida / "datos.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("datos:", (salida / "datos.json").stat().st_size, "bytes")


if __name__ == "__main__":
    main()
