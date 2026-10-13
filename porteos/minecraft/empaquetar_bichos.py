"""Los bichos de la 1.2 para el motor del port:

- los modelos: las geometrías de models/mobs.json (con la herencia "hijo:padre" resuelta) con sus
  texturas de textures/entity; las .tga traen en el alfa una máscara (los ojos que brillan de la
  araña y el enderman, el collar del lobo): se separan en la textura de siempre y una capa aparte
  que se dibuja con luz plena, como el material "emissive" del juego;
- las entidades: los JSON del behavior pack tal cual (componentes, grupos de componentes y eventos);
  los interpreta juego/conducta.js como el juego (qué vida tienen, cómo se mueven, qué atacan, qué
  pasa al aparecer: bebés, colores, profesiones);
- el botín (loot_tables), lo que suena cada uno (sounds.json → entity_sounds) y los huevos del
  inventario creativo (cada uno con su dibujo de textures/items/egg_*.png).

Los modelos que el juego arma en código (el endermite, la flecha, la bala del shulker) se escriben
acá como geometrías del mismo formato, con las medidas de los modelos de la versión de PC.
"""
from PIL import Image

BP = "assets/behavior_packs/vanilla/"

# las capas de cada modelo: (geometría, textura, opciones). Opciones: "tenido" (toma el color del
# bicho: la lana), "brilla" (siempre con luz plena: el blaze, el cubo de magma), "translucido"
# (la capa de afuera del slime), "cartel" (un dibujo que mira a la cámara: bolas de nieve, pociones)
MODELOS = {
    "pig": [("geometry.pig", "pig/pig")],
    "cow": [("geometry.cow", "cow/cow")],
    "mooshroom": [("geometry.mooshroom", "cow/mooshroom")],
    "sheep": [("geometry.sheep.sheared", "sheep/sheep"), ("geometry.sheep", "sheep/sheep", {"tenido": True, "lana": True})],
    "chicken": [("geometry.chicken", "chicken")],
    "wolf": [("geometry.wolf", "wolf/wolf")],
    "ocelot": [("geometry.ocelot", "cat/ocelot")],
    "rabbit": [("geometry.rabbit", "rabbit/brown")],
    "horse": [("geometry.horse", "horse/horse_white")],
    "donkey": [("geometry.horse", "horse/donkey")],
    "mule": [("geometry.horse", "horse/mule")],
    "skeleton_horse": [("geometry.horse", "horse/horse_skeleton")],
    "zombie_horse": [("geometry.horse", "horse/horse_zombie")],
    "llama": [("geometry.llama", "llama/llama_creamy")],
    "polar_bear": [("geometry.polarbear", "polarbear")],
    "parrot": [("geometry.parrot", "parrot/parrot_red_blue")],
    "bat": [("geometry.bat", "bat")],
    "squid": [("geometry.squid", "squid")],
    "villager": [("geometry.villager", "villager/farmer")],
    "iron_golem": [("geometry.irongolem", "iron_golem")],
    "snow_golem": [("geometry.snowgolem", "snow_golem")],
    "zombie": [("geometry.zombie", "zombie/zombie")],
    "husk": [("geometry.zombie.husk", "zombie/husk")],
    "zombie_villager": [("geometry.zombie.villager", "zombie_villager/zombie_farmer")],
    "zombie_pigman": [("geometry.pigzombie", "pig/pigzombie")],
    "skeleton": [("geometry.skeleton", "skeleton/skeleton")],
    "stray": [("geometry.skeleton.stray", "skeleton/stray"), ("geometry.stray.armor", "skeleton/stray_overlay")],
    "wither_skeleton": [("geometry.skeleton.wither", "skeleton/wither_skeleton")],
    "creeper": [("geometry.creeper", "creeper/creeper")],
    "spider": [("geometry.spider", "spider/spider")],
    "cave_spider": [("geometry.spider", "spider/cave_spider")],
    "enderman": [("geometry.enderman", "enderman/enderman")],
    "silverfish": [("geometry.silverfish", "silverfish")],
    "endermite": [("geometry.porteo.endermite", "endermite")],
    "slime": [("geometry.slime", "slime/slime"), ("geometry.slime.armor", "slime/slime", {"translucido": True})],
    "magma_cube": [("geometry.lavaslime", "slime/magmacube", {"brilla": True})],
    "ghast": [("geometry.ghast", "ghast/ghast")],
    "blaze": [("geometry.blaze", "blaze", {"brilla": True})],
    "witch": [("geometry.villager.witch", "witch")],
    "guardian": [("geometry.guardian", "guardian")],
    "elder_guardian": [("geometry.guardian", "guardian_elder")],
    "shulker": [("geometry.shulker", "shulker/shulker_undyed")],
    "vex": [("geometry.vex", "vex/vex")],
    "vindicator": [("geometry.vindicator", "vindicator")],
    "evocation_illager": [("geometry.evoker", "illager/evoker")],
    "ender_dragon": [("geometry.dragon", "dragon/dragon")],
    "wither": [("geometry.witherBoss", "wither_boss/wither")],
    "evocation_fang": [("geometry.porteo.evocation_fang", "illager/fangs")],
    "steve": [("geometry.humanoid.custom", "steve")],
    "alex": [("geometry.humanoid.customSlim", "alex")],
    # proyectiles
    "arrow": [("geometry.porteo.arrow", "arrows")],
    "shulker_bullet": [("geometry.porteo.shulker_bullet", "shulker/spark", {"brilla": True})],
    "llama_spit": [("geometry.llamaspit", "llama/spit")],
    "snowball": [(None, "../items/snowball", {"cartel": True})],
    "egg": [(None, "../items/egg", {"cartel": True})],
    "fireball": [(None, "../items/fireball", {"cartel": True, "brilla": True, "grande": True})],
    "small_fireball": [(None, "../items/fireball", {"cartel": True, "brilla": True})],
    "dragon_fireball": [(None, "../items/dragon_fireball", {"cartel": True, "brilla": True, "grande": True})],
    "ender_pearl": [(None, "../items/ender_pearl", {"cartel": True})],
    "splash_potion": [(None, "../items/potion_bottle_splash", {"cartel": True})],
    "xp_bottle": [(None, "../items/experience_bottle", {"cartel": True})],
    "wither_skull": [("geometry.porteo.wither_skull", "wither_boss/wither")],
    "wither_skull_dangerous": [("geometry.porteo.wither_skull", "wither_boss/wither_invulnerable")],
}

# las variantes ("minecraft:variant" del bicho → la textura de su primera capa), como el juego
VARIANTES = {
    "villager": ["villager/farmer", "villager/librarian", "villager/priest", "villager/smith", "villager/butcher"],
    "zombie_villager": ["zombie_villager/zombie_farmer", "zombie_villager/zombie_librarian", "zombie_villager/zombie_priest",
                        "zombie_villager/zombie_smith", "zombie_villager/zombie_butcher"],
    "rabbit": ["rabbit/brown", "rabbit/white", "rabbit/blackrabbit", "rabbit/white_splotched", "rabbit/gold", "rabbit/salt", "rabbit/toast"],
    "ocelot": ["cat/ocelot", "cat/blackcat", "cat/red", "cat/siamese"],
    "parrot": ["parrot/parrot_red_blue", "parrot/parrot_blue", "parrot/parrot_green", "parrot/parrot_yellow_blue", "parrot/parrot_grey"],
    "horse": ["horse/horse_white", "horse/horse_creamy", "horse/horse_chestnut", "horse/horse_brown", "horse/horse_black",
              "horse/horse_gray", "horse/horse_darkbrown"],
    "llama": ["llama/llama_creamy", "llama/llama_white", "llama/llama_brown", "llama/llama_gray"],
    # el color del shulker: el número de tinte de la 1.2 (0 negro ... 15 blanco) y 16 sin teñir
    "shulker": ["shulker/shulker_" + c for c in ("black", "red", "green", "brown", "blue", "purple", "cyan", "silver", "gray",
                                                 "pink", "lime", "yellow", "light_blue", "magenta", "orange", "white", "undyed")],
    "wolf": ["wolf/wolf", "wolf/wolf_tame", "wolf/wolf_angry"],
    # el wither recién creado (azul, titilando hasta que explota y empieza a pelear)
    "wither": ["wither_boss/wither", "wither_boss/wither_invulnerable"],
}

# los huevos del inventario creativo, en el orden del juego: (número del bicho en la 1.2, bicho,
# dibujo de textures/items)
HUEVOS = [
    (10, "chicken", "egg_chicken"), (11, "cow", "egg_cow"), (12, "pig", "egg_pig"), (13, "sheep", "egg_sheep"),
    (14, "wolf", "egg_wolf"), (28, "polar_bear", "egg_polarbear"), (22, "ocelot", "egg_ocelot"),
    (16, "mooshroom", "egg_mushroomcow"), (19, "bat", "egg_bat"), (30, "parrot", "egg_parrot"), (18, "rabbit", "egg_rabbit"),
    (29, "llama", "egg_llama"), (23, "horse", "egg_horse"), (24, "donkey", "egg_donkey"), (25, "mule", "egg_mule"),
    (26, "skeleton_horse", "egg_skeletonhorse"), (27, "zombie_horse", "egg_zombiehorse"), (17, "squid", "egg_squid"),
    (15, "villager", "egg_villager"), (32, "zombie", "egg_zombie"), (44, "zombie_villager", "egg_zombievillager"),
    (47, "husk", "egg_husk"), (33, "creeper", "egg_creeper"), (34, "skeleton", "egg_skeleton"), (46, "stray", "egg_stray"),
    (48, "wither_skeleton", "egg_wither"), (35, "spider", "egg_spider"), (40, "cave_spider", "egg_cave_spider"),
    (36, "zombie_pigman", "egg_pigzombie"), (37, "slime", "egg_slime"), (42, "magma_cube", "egg_lava_slime"),
    (38, "enderman", "egg_enderman"), (39, "silverfish", "egg_silverfish"), (55, "endermite", "egg_endermite"),
    (41, "ghast", "egg_ghast"), (43, "blaze", "egg_blaze"), (45, "witch", "egg_witch"), (49, "guardian", "egg_guardian"),
    (50, "elder_guardian", "egg_elderguardian"), (54, "shulker", "egg_shulker"), (57, "vindicator", "egg_vindicator"),
    (104, "evocation_illager", "egg_evoker"), (105, "vex", "egg_vex"),
]
# los que no tienen huevo pero el juego hace aparecer (golems, jefes)
SIN_HUEVO = {20: "iron_golem", 21: "snow_golem", 52: "wither", 53: "ender_dragon"}

# lo que el juego arma en código, como geometrías (pivot y origen en el formato de mobs.json: y para
# arriba, los pies en 0)
def _endermite():
    # ModelEnderMite: cuatro partes en fila, cada una más alta en el medio
    tam = [(4, 3, 2), (6, 4, 5), (3, 3, 1), (1, 2, 1)]
    tex = [(0, 0), (0, 5), (0, 14), (0, 18)]
    huesos, f = [], -3.5
    for i, (w, h, d) in enumerate(tam):
        huesos.append({"name": f"section_{i}", "pivot": [0, h, f],
                       "cubes": [{"origin": [-w / 2, 0, f - d / 2], "size": [w, h, d], "uv": list(tex[i])}]})
        if i < 3:
            f += (d + tam[i + 1][2]) / 2
    return {"texturewidth": 64, "textureheight": 32, "bones": huesos}


def _flecha():
    # RenderArrow: dos planos en cruz a lo largo (16x5 de arrows.png) y la cola en cruz (5x5)
    return {"texturewidth": 32, "textureheight": 32, "bones": [
        {"name": "shaft0", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, -2.5, 0], "size": [16, 5, 0], "uv": [0, 0]}]},
        {"name": "shaft1", "pivot": [0, 0, 0], "rotation": [90, 0, 0],
         "cubes": [{"origin": [-8, -2.5, 0], "size": [16, 5, 0], "uv": [0, 0]}]},
        {"name": "tail", "pivot": [0, 0, 0], "cubes": [{"origin": [-7, -2.5, -2.5], "size": [0, 5, 5], "uv": [0, 0]}]},
    ]}


def _bala_shulker():
    # ModelShulkerBullet: tres cajas cruzadas
    return {"texturewidth": 64, "textureheight": 32, "bones": [{"name": "main", "pivot": [0, 0, 0], "cubes": [
        {"origin": [-4, -4, -1], "size": [8, 8, 2], "uv": [0, 0]},
        {"origin": [-1, -4, -4], "size": [2, 8, 8], "uv": [0, 10]},
        {"origin": [-4, -1, -4], "size": [8, 2, 8], "uv": [20, 0]},
    ]}]}


def _calavera():
    # ModelSkeletonHead de RenderWitherSkull: una cabeza de 8x8x8 con la cara que wither.png tiene en
    # (0, 35)
    return {"texturewidth": 64, "textureheight": 64, "bones": [
        {"name": "head", "pivot": [0, 4, 0], "cubes": [{"origin": [-4, 0, -4], "size": [8, 8, 8], "uv": [0, 35]}]}]}


def _colmillos():
    # ModelEvokerFangs con y para arriba y el piso en la y = 20 del modelo de PC (RenderEvokerFangs lo
    # dibuja al doble de escala y 0,626 más arriba): la base y las dos mandíbulas, enterradas; las
    # suben y las cierran las poses de modelos.js
    return {"texturewidth": 64, "textureheight": 32, "bones": [
        {"name": "base", "pivot": [-5, -4, -5], "cubes": [{"origin": [-5, -16, -5], "size": [10, 12, 10], "uv": [0, 0]}]},
        {"name": "upper_jaw", "pivot": [1.5, -4, -4], "rotation": [0, 0, 180],
         "cubes": [{"origin": [1.5, -18, -4], "size": [4, 14, 8], "uv": [40, 0]}]},
        {"name": "lower_jaw", "pivot": [-1.5, -4, 4], "rotation": [0, 180, 180],
         "cubes": [{"origin": [-1.5, -18, 4], "size": [4, 14, 8], "uv": [40, 0]}]},
    ]}


PROPIAS = {"geometry.porteo.endermite": _endermite(), "geometry.porteo.arrow": _flecha(),
           "geometry.porteo.shulker_bullet": _bala_shulker(), "geometry.porteo.wither_skull": _calavera(),
           "geometry.porteo.evocation_fang": _colmillos()}


def separar_brillo(im):
    """las .tga de entidades: alfa 255 = normal, alfa bajo (3) = brilla (ojos), 0 = vacío. Devuelve
    (la textura con lo que brilla opaco, la capa de lo que brilla o None)"""
    px = im.load()
    base = im.copy()
    pb = base.load()
    brillo = Image.new("RGBA", im.size, (0, 0, 0, 0))
    pr = brillo.load()
    hay = False
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            pb[x, y] = (r, g, b, 255)
            if a < 128:
                pr[x, y] = (r, g, b, 255)
                hay = True
    return base, (brillo if hay else None)


def armar(apk, salida, resolver, guardar_png, paquete):
    """→ (modelos, entidades, extra) para datos.json"""
    texturas = {}

    def textura(ruta, opciones):
        """la textura de una capa (ya guardada) → (archivo, ancho, alto, archivo de brillo o None)"""
        if ruta in texturas:
            return texturas[ruta]
        if ruta.startswith("../"):
            im = apk.textura("textures/" + ruta[3:])
        else:
            im = apk.textura("textures/entity/" + ruta)
        if im is None:
            return None
        brillo = None
        es_tga = (paquete + "textures/entity/" + ruta + ".tga") in apk.nombres
        if es_tga:
            if ruta == "wolf/wolf_tame":
                # el alfa es el collar (rojo, como el de un lobo recién domesticado); la forma es la del lobo
                forma = apk.textura("textures/entity/wolf/wolf")
                px, pf = im.load(), forma.load()
                for y in range(im.height):
                    for x in range(im.width):
                        r, g, b, a = px[x, y]
                        if a > 0:
                            px[x, y] = (int(r * 0.6), int(g * 0.2), int(b * 0.2), 255)
                        else:
                            px[x, y] = (r, g, b, pf[x, y][3] if x < forma.width and y < forma.height else 0)
            elif opciones.get("brilla"):
                # todo con luz plena (blaze, cubo de magma): el alfa sólo marca lo que hay
                px = im.load()
                for y in range(im.height):
                    for x in range(im.width):
                        r, g, b, a = px[x, y]
                        if a > 0:
                            px[x, y] = (r, g, b, 255)
            else:
                im, brillo_im = separar_brillo(im)
                if brillo_im is not None:
                    brillo = "bicho_" + ruta.replace("/", "_").replace("..", "") + "_brillo.png"
                    guardar_png(brillo_im, salida / brillo)
        archivo = "bicho_" + ruta.replace("/", "_").replace("..", "").strip("_") + ".png"
        guardar_png(im, salida / archivo)
        texturas[ruta] = (archivo, im.width, im.height, brillo)
        return texturas[ruta]

    def huesos_de(geo):
        g = PROPIAS.get(geo) or resolver(geo)
        if "bones" in g and "huesos" not in g:
            g = {"tw": g.get("texturewidth", 64), "th": g.get("textureheight", 64), "huesos": [dict(h) for h in g["bones"]]}
        lista = []
        for h in g["huesos"]:
            if h.get("neverRender") or not h.get("cubes"):
                continue
            cubos = [{"o": c["origin"], "t": c["size"], "uv": c["uv"], "i": c.get("inflate", 0)} for c in h["cubes"]]
            b = {"n": h["name"], "p": h.get("pivot", [0, 0, 0]), "c": cubos}
            if h.get("rotation") and any(h["rotation"]):
                b["r"] = h["rotation"]
            if h.get("mirror"):
                b["m"] = True
            lista.append(b)
        return g["tw"], g["th"], lista

    modelos = {}
    for nombre, capas in MODELOS.items():
        lista = []
        for capa in capas:
            geo, tex = capa[0], capa[1]
            op = capa[2] if len(capa) > 2 else {}
            t = textura(tex, op)
            if t is None:
                print("  sin textura:", tex)
                continue
            archivo, tw, th, brillo = t
            c = {"tex": archivo, "tw": tw, "th": th}
            if geo:
                gw, gh, huesos = huesos_de(geo)
                c.update({"tw": gw, "th": gh, "huesos": huesos})
            else:
                c["huesos"] = []
            for k in ("tenido", "brilla", "translucido", "cartel", "grande", "lana"):
                if op.get(k):
                    c[k] = True
            lista.append(c)
            if brillo:
                lista.append(dict(c, tex=brillo, brilla=True, ojos=True))
        if lista:
            modelos[nombre] = lista
    # las texturas de las variantes (el primer archivo de cada lista ya es el del modelo)
    variantes = {}
    for nombre, l in VARIANTES.items():
        vs = []
        for tex in l:
            t = textura(tex, {})
            vs.append(t[0] if t else None)
        variantes[nombre] = vs

    # las entidades del behavior pack, tal cual
    entidades = {}
    for n in sorted(apk.nombres):
        if n.startswith(BP + "entities/") and n.endswith(".json"):
            d = apk.json(n).get("minecraft:entity", {})
            ident = d.get("components", {}).get("minecraft:identifier", {}).get("id", "")
            nombre = ident.replace("minecraft:", "") or n.rsplit("/", 1)[1][:-5]
            entidades[nombre] = {"c": d.get("components", {}), "g": d.get("component_groups", {}), "e": d.get("events", {})}
    # el botín y lo que comercian los aldeanos
    botin = {}
    for n in sorted(apk.nombres):
        if n.startswith(BP + "loot_tables/") and n.endswith(".json"):
            try:
                botin[n[len(BP):]] = apk.json(n)
            except Exception as e:  # algunas tablas de la 1.2 vienen rotas: se saltean
                print("  botín roto:", n, e)
    comercio = {}
    for n in sorted(apk.nombres):
        if n.startswith(BP + "trading/") and n.endswith(".json"):
            comercio[n[len(BP):]] = apk.json(n)
    # lo que suena cada bicho (y los sonidos de siempre de todos)
    sj = apk.json(paquete + "sounds.json").get("entity_sounds", {})
    sonidos = {"defaults": sj.get("defaults", {}), "entities": sj.get("entities", {})}
    # los eventos de cada bicho (un paquete de sonido por bicho; "_base": los de todos)
    def eventos_de(v):
        r = set()
        for ev in (v.get("events") or {}).values():
            s = ev if isinstance(ev, str) else ev.get("sound") if isinstance(ev, dict) else None
            if s:
                r.add(s)
        return r
    eventos = {"_base": eventos_de(sonidos["defaults"])}
    for nombre, v in sonidos["entities"].items():
        n = nombre.replace("minecraft:", "")
        if n in MODELOS or n == "evocation_fang":
            eventos[n] = eventos_de(v)
    # los que el juego hace sonar desde el código (la mecha, el teletransporte, los disparos)
    for n, extra in {"enderman": {"mob.endermen.portal"}, "ghast": {"mob.ghast.fireball", "mob.ghast.charge"},
                     "blaze": {"mob.blaze.shoot"}, "evocation_illager": {"mob.evocation_illager.cast_spell"}}.items():
        eventos.setdefault(n, set()).update(extra)
    # los dibujos de los huevos, en un atlas de 16 x 16 por huevo
    dibujos = [h[2] for h in HUEVOS]
    lado = 16
    atlas = Image.new("RGBA", (lado * 8, lado * ((len(dibujos) + 7) // 8)), (0, 0, 0, 0))
    for i, d in enumerate(dibujos):
        im = apk.textura("textures/items/" + d)
        if im is not None:
            atlas.paste(im.resize((lado, lado), Image.NEAREST), ((i % 8) * lado, (i // 8) * lado))
    guardar_png(atlas, salida / "huevos.png")
    huevos = [[num, bicho, i] for i, (num, bicho, _) in enumerate(HUEVOS)]
    print(f"bichos: {len(modelos)} modelos, {len(entidades)} entidades, {len(botin)} tablas de botín, "
          f"{sum(len(v) for v in eventos.values())} sonidos de bichos, {len(huevos)} huevos")
    return {"modelos": modelos, "variantes": variantes, "entidades": entidades, "botin": botin,
            "comercio": comercio, "sonidos": sonidos, "huevos": huevos, "sinHuevo": SIN_HUEVO}, eventos
