"""La interfaz JSON de la 1.2 (assets/resource_packs/vanilla/ui/*.json) para el intérprete de
juego/jui.js: así cada pantalla sale como en el juego, con sus tamaños, anclas, capas, plantillas y
variables, en vez de dibujarla a mano parecida.

Deja en SALIDA/datos:
- interfaz.json: las definiciones de todas las pantallas (_ui_defs.json) sin comentarios, por
  espacio de nombres, las variables globales (_global_variables.json), dónde está cada textura que
  nombran (atlas, rectángulo y nineslice de su .json) y los textos completos de los tres idiomas;
- interfaz0.webp...: los atlas de esas texturas (sin pérdida). El logo, que es grande, va aparte
  (logo.webp, de empaquetar.interfaz).
"""
import json
import re

from PIL import Image

# las texturas más grandes que esto no van al atlas (el logo va aparte; el arte de Realms y de
# Education no se usa)
MAXIMO_EN_ATLAS = 512
APARTE = {"textures/ui/title": "logo.webp"}
# texturas que el juego pone desde el código y no están en el paquete de recursos: el blanco liso de
# los bordes (no hay textures/ui/White.png en la 1.2) y los íconos de los paquetes de la lista de
# ajustes (Recursos globales, Packs de recursos y de comportamientos)
SINTETICAS = {"textures/ui/White": ((2, 2), (255, 255, 255, 255))}
DE_OTRO_LADO = {"pack_icon": "assets/resource_packs/vanilla/pack_icon.png",
                "pack_icon_comportamientos": "assets/behavior_packs/vanilla/pack_icon.png"}
ANCHO_ATLAS = 1024
# los textos que ninguna pantalla de este port muestra (los comandos son 40 KB por idioma); los de
# realmsSettingsScreen. se quedan: los ajustes dentro de un mundo titulan su sección con uno
TEXTOS_FUERA = ("commands.", "stream.", "remix_export.", "structure_block.", "npcscreen.", "demo.",
                "realmsCreateScreen.", "realmsInvitationScreen.", "realms.",
                "packdiscoveryerror.", "packupgradewarning.")
# ...menos los de los comandos que el chat de este port entiende (y los mensajes comunes de error)
TEXTOS_QUE_QUEDAN = tuple("commands." + c + "." for c in (
    "time", "weather", "gamemode", "tp", "kill", "generic", "seed", "say", "me", "help", "give", "clear",
    "difficulty", "summon", "defaultgamemode", "setworldspawn", "spawnpoint", "toggledownfall"))


def definiciones(apk, paquete, jsonc):
    """{espacio: {"nombre@base": definición}} y las variables globales"""
    lista = apk.json(paquete + "ui/_ui_defs.json")["ui_defs"]
    espacios = {}
    for ruta in lista:
        nombre = paquete + ruta
        if nombre not in apk.nombres:
            continue
        d = apk.json(nombre)
        ns = d.pop("namespace")
        # dos archivos pueden compartir espacio (ui_common y ui_common_classic): se juntan
        espacios.setdefault(ns, {}).update(d)
    globales = apk.json(paquete + "ui/_global_variables.json")
    return espacios, globales


def nombres_de_texturas(v, acum):
    if isinstance(v, str):
        if re.match(r"^textures/[A-Za-z0-9_/\-\.]+$", v):
            acum.add(re.sub(r"\.(png|tga|jpg)$", "", v))
    elif isinstance(v, list):
        for x in v:
            nombres_de_texturas(x, acum)
    elif isinstance(v, dict):
        for x in v.values():
            nombres_de_texturas(x, acum)


def cargar(apk, paquete, ruta):
    for ext in (".png", ".tga", ".jpg"):
        if paquete + ruta + ext in apk.nombres:
            return apk.imagen(paquete + ruta + ext)
    return None


def nineslice(apk, paquete, ruta):
    """el .json al lado de la textura: {"nineslice_size": n | [l, t, r, d], "base_size": [w, h]}"""
    n = paquete + ruta + ".json"
    if n not in apk.nombres:
        return None, None
    d = apk.json(n)
    ns = d.get("nineslice_size")
    if isinstance(ns, (int, float)):
        ns = [ns, ns, ns, ns]
    return ns, d.get("base_size")


def atlas(apk, paquete, nombres, salida):
    """las texturas en atlas de ANCHO_ATLAS (estantes, de la más alta a la más baja, con 1 px de
    separación). Devuelve {ruta: [archivo, x, y, w, h, nineslice | 0, base | 0]}"""
    imagenes, lugares = {}, {}
    for r in sorted(nombres):
        if r in APARTE:
            continue
        im = cargar(apk, paquete, r)
        if im is None or max(im.size) > MAXIMO_EN_ATLAS:
            continue
        imagenes[r] = im
    for r, (tam, color) in SINTETICAS.items():
        if r not in imagenes:
            imagenes[r] = Image.new("RGBA", tam, color)
    for r, ruta in DE_OTRO_LADO.items():
        if ruta in apk.nombres:
            imagenes[r] = apk.imagen(ruta).convert("RGBA")
    paginas, x, y, alto_estante, pagina = [], 0, 0, 0, 0
    orden = sorted(imagenes, key=lambda r: (-imagenes[r].height, -imagenes[r].width, r))
    usado = [0]
    for r in orden:
        w, h = imagenes[r].size
        if x + w > ANCHO_ATLAS:
            x, y, alto_estante = 0, y + alto_estante + 1, 0
        if y + h > ANCHO_ATLAS:
            pagina += 1
            usado.append(0)
            x = y = alto_estante = 0
        lugares[r] = (pagina, x, y)
        usado[pagina] = max(usado[pagina], y + h)
        x += w + 1
        alto_estante = max(alto_estante, h)
    salidas = []
    for p in range(pagina + 1):
        alto = 1 << max(4, (usado[p] - 1).bit_length())
        salidas.append(Image.new("RGBA", (ANCHO_ATLAS, alto), (0, 0, 0, 0)))
    tabla = {}
    for r, (p, x, y) in lugares.items():
        im = imagenes[r]
        salidas[p].paste(im, (x, y))
        ns, base = nineslice(apk, paquete, r)
        tabla[r] = [f"interfaz{p}.webp", x, y, im.width, im.height, ns or 0, base or 0]
    for p, im in enumerate(salidas):
        im.save(salida / f"interfaz{p}.webp", "WEBP", lossless=True, quality=100, method=6)
    for r, archivo in APARTE.items():
        im = cargar(apk, paquete, r)
        if im is not None:
            tabla[r] = [archivo, 0, 0, im.width, im.height, 0, 0]
    print(f"interfaz: {len(tabla)} texturas en {len(salidas)} atlas de {ANCHO_ATLAS}x" +
          ",".join(str(i.height) for i in salidas))
    return tabla


def textos(apk, paquete, idiomas):
    """los .lang completos (menos lo que ninguna pantalla usa): {"es": {clave: texto}}"""
    res = {}
    for corto, archivo in idiomas.items():
        d = {}
        for linea in apk.texto(paquete + f"texts/{archivo}.lang").splitlines():
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            k, v = linea.split("=", 1)
            k = k.strip()
            if k.startswith(TEXTOS_FUERA) and not k.startswith(TEXTOS_QUE_QUEDAN):
                continue
            # los .lang de la 1.2 llevan comentarios al final ("\t#") en algunas líneas
            v = re.sub(r"\t+#.*$", "", v)
            d[k] = v
        res[corto] = d
    return res


def glifos(apk, paquete, salida):
    """los íconos que los textos meten como ":touch_jump:" (font/emoticons.json): están en las páginas
    E0 y E1 de la fuente (U+E000..U+E1FF). Se copian las dos páginas y se devuelve {nombre: código}"""
    for pag in ("E0", "E1"):
        n = paquete + f"font/glyph_{pag}.png"
        if n in apk.nombres:
            apk.imagen(n).save(salida / f"glifos_{pag}.png", optimize=True)
    n = paquete + "font/emoticons.json"
    if n not in apk.nombres:
        return {}
    return {e["name"]: int(e["code"], 16) for e in apk.json(n) if 0xE000 <= int(e["code"], 16) <= 0xE1FF}


def armar(apk, paquete, salida, jsonc, idiomas):
    espacios, globales = definiciones(apk, paquete, jsonc)
    nombres = set()
    nombres_de_texturas(espacios, nombres)
    nombres_de_texturas(globales, nombres)
    # las que el juego pone desde el código (barra, corazones, comida, burbujas, armadura...)
    nombres |= {"textures/gui/gui", "textures/gui/icons", "textures/ui/Black", "textures/ui/White",
                "textures/ui/screen_background", "textures/ui/dialog_background_opaque",
                "textures/ui/default_world", "textures/ui/World", "textures/ui/CreateNewWorld",
                "textures/ui/addServer", "textures/ui/lan_icon", "textures/ui/FriendsIcon",
                # los íconos de las opciones de anfitrión del chat (hora y clima)
                "textures/ui/time_1sunrise", "textures/ui/time_2day", "textures/ui/time_3noon",
                "textures/ui/time_4sunset", "textures/ui/time_5night", "textures/ui/time_6midnight",
                "textures/ui/weather_clear", "textures/ui/weather_rain", "textures/ui/weather_thunderstorm"}
    # lo que dibujan los "renderers" del HUD (heart_renderer, hunger_renderer, armor_renderer,
    # bubbles_renderer, hotbar_renderer): los corazones (y los envenenados, del wither y de
    # absorción), la comida, la armadura, las burbujas, las casillas de la barra
    for n in ("heart", "heart_half", "heart_background", "heart_blink", "heart_flash", "heart_flash_half",
              "poison_heart", "poison_heart_half", "poison_heart_flash", "poison_heart_flash_half",
              "wither_heart", "wither_heart_half", "wither_heart_flash", "wither_heart_flash_half",
              "absorption_heart", "absorption_heart_half", "hunger_full", "hunger_half", "hunger_background",
              "hunger_blink", "hunger_flash_full", "hunger_flash_half", "hunger_effect_full", "hunger_effect_half",
              "hunger_effect_background", "hunger_effect_flash_full", "hunger_effect_flash_half",
              "armor_full", "armor_half", "armor_empty", "bubble", "bubble_pop", "selected_hotbar_slot",
              "hotbar_0", "hotbar_1", "hotbar_2", "hotbar_3", "hotbar_4", "hotbar_5", "hotbar_6", "hotbar_7", "hotbar_8",
              "hotbar_start_cap", "hotbar_end_cap", "horse_heart", "horse_heart_half", "horse_heart_flash",
              "horse_heart_flash_half", "mob_effect_background", "hud_mob_effect_background"):
        nombres.add("textures/ui/" + n)
    tabla = atlas(apk, paquete, nombres, salida)
    d = {"globales": globales, "espacios": espacios, "texturas": tabla,
         "textos": textos(apk, paquete, idiomas), "emoticonos": glifos(apk, paquete, salida)}
    t = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    (salida / "interfaz.json").write_text(t, encoding="utf-8")
    print(f"interfaz.json: {len(t.encode()) // 1024} KB ({len(espacios)} espacios)")
