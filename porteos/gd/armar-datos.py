#!/usr/bin/env python3
"""Del APK de Geometry Dash a los datos que lee el motor web (porteos/gd/src).

    python3 porteos/gd/armar-datos.py ASSETS OBJECT_JSON SALIDA [--calidad 90] [--kbps 64]

ASSETS: la carpeta assets/ del APK del dueño, desarmado. OBJECT_JSON: assets/data/object.json
de gdclone (MPL-2.0): cómo se dibuja cada objeto (sacado del juego por maxnut). Lo que sale
es del juego: va a la entrega, nunca al repo (PORTEO.md §11).

Qué hace y por qué:
  - Las hojas -hd (el doble de la resolución de diseño, 320 de alto) pasan a WebP. Con PNG
    son 7 MB; el juego es para el teléfono y tiene que cargar rápido. Las del APK no traen
    -uhd, así que -hd es lo mejor que hay.
  - Los íconos del jugador y las fuentes se juntan en una hoja más ("extra"): el motor dibuja
    todo de una pasada y WebGL tiene pocas unidades de textura.
  - La tabla de objetos sale de object.json (cómo se dibuja) más la clasificación de acá (qué
    hace: sólido, peligro, portal, orbe…), que el juego guarda en el binario y no está en
    ningún archivo. Se verifica contra cada objeto que usan los niveles.
  - La música va a Opus: la de 22 niveles en MP3 son 40 MB.
"""
import argparse
import json
import plistlib
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

NIVELES = list(range(1, 22))   # 1 a 21: los que la tabla de la 2.1 dibuja enteros (Dash y la Torre usan objetos de la 2.2)

META = {  # nombre, canción, dificultad (cara del menú), estrellas
    1: ("Stereo Madness", "StereoMadness", 1, 1), 2: ("Back On Track", "BackOnTrack", 1, 2),
    3: ("Polargeist", "Polargeist", 2, 3), 4: ("Dry Out", "DryOut", 2, 4),
    5: ("Base After Base", "BaseAfterBase", 3, 5), 6: ("Can't Let Go", "CantLetGo", 3, 6),
    7: ("Jumper", "Jumper", 4, 7), 8: ("Time Machine", "TimeMachine", 4, 8),
    9: ("Cycles", "Cycles", 4, 9), 10: ("xStep", "xStep", 5, 10),
    11: ("Clutterfunk", "Clutterfunk", 5, 11), 12: ("Theory of Everything", "TheoryOfEverything", 5, 12),
    13: ("Electroman Adventures", "Electroman", 5, 10), 14: ("Clubstep", "Clubstep", 6, 14),
    15: ("Electrodynamix", "Electrodynamix", 5, 12), 16: ("Hexagon Force", "HexagonForce", 5, 12),
    17: ("Blast Processing", "BlastProcessing", 4, 10), 18: ("Theory of Everything 2", "TheoryOfEverything2", 6, 14),
    19: ("Geometrical Dominator", "GeometricalDominator", 4, 10), 20: ("Deadlocked", "Deadlocked", 6, 15),
    21: ("Fingerdash", "Fingerdash", 5, 12), 22: ("Dash", "Dash", 5, 12),
}

HOJAS = ["GJ_GameSheet-hd", "GJ_GameSheet02-hd", "GJ_GameSheet03-hd", "GJ_GameSheet04-hd",
         "GJ_GameSheetGlow-hd", "GJ_LaunchSheet-hd"]
ICONOS = ["player_01", "ship_01", "player_ball_01", "bird_01", "dart_01", "robot_01", "spider_01", "swing_01"]
FUENTES = ["bigFont", "goldFont", "chatFont"]
SONIDOS = ["explode_11", "playSound_01", "quitSound_01", "endStart_02", "highscoreGet02"]

# ── qué hace cada objeto ────────────────────────────────────────────────────
PORTALES = {10: "gravedad_normal", 11: "gravedad_invertida", 12: "cubo", 13: "nave", 47: "bola", 111: "ovni",
            660: "onda", 745: "robot", 1331: "arana", 1933: "swing", 45: "espejo_si", 46: "espejo_no",
            99: "tamano_normal", 101: "tamano_mini", 286: "dual_si", 287: "dual_no"}
VELOCIDADES = {200: 0.7, 201: 0.9, 202: 1.1, 203: 1.3, 1334: 1.6}
PADS = {35: "amarillo", 67: "azul", 140: "rosa", 1332: "rojo"}
ORBES = {36: "amarillo", 84: "azul", 141: "rosa", 1022: "verde", 1330: "negro", 1333: "rojo",
         1704: "dash_verde", 1751: "dash_rosa"}
MONEDAS = {142, 1329}
# triggers de color viejos: a qué canal pintan (1000 fondo, 1001 piso, 1002 línea, 1003 3D, 1004 objetos, 1009 piso 2)
COLOR_VIEJO = {29: 1000, 30: 1001, 104: 1002, 105: 1004, 221: 1, 717: 2, 718: 3, 743: 4, 744: 1003, 900: 1009, 915: 1002}
TRIGGERS = {899: "color", 901: "mover", 1006: "pulso", 1007: "alfa", 1049: "alternar", 1268: "generar",
            1346: "rotar", 1347: "seguir", 1520: "sacudir", 1585: "animar", 1595: "tocar", 1611: "contar",
            1615: "contador", 1616: "parar", 1811: "contar_ya", 1812: "al_morir", 1814: "seguir_y",
            1815: "colision", 1817: "recoger", 1818: "fondo_si", 1819: "fondo_no", 32: "estela_si",
            33: "estela_no", 1612: "ocultar_jugador", 1613: "mostrar_jugador"}
ENTRADA = {"eeNone": "nada", "eeFB": "abajo", "eeFT": "arriba", "eeFL": "izquierda", "eeFR": "derecha",
           "eeSU": "crece", "eeSD": "achica", "eeFAL": "izquierda_todo", "eeFAR": "derecha_todo",
           "eeFRH": "gira", "eeFRHInv": "gira_inv"}
# sin distinguir mayúsculas: "iceSpike" y "colorSpike" también son pinchos
PELIGRO = re.compile(r"spike|^pit_|sawblade|blade|cogwheel|fireball|bladetrap|thorn", re.I)
# Bloques que se rompen (brick_02): se apoya arriba como en uno sólido, y el choque que mataría
# los rompe (collidedWithObjectInternal). object.json no les da caja.
ROMPIBLES = {143}


def clasificar(i, o):
    """(tipo, sub) de un objeto según su número y su dibujo."""
    tex = o.get("texture", "") if o else ""
    if i in COLOR_VIEJO:
        return "trigger", "color"
    if i in TRIGGERS:
        return "trigger", TRIGGERS[i]
    m = re.match(r"edit_(ee[A-Za-z]+)Btn_001\.png$", tex)
    if m and m.group(1) in ENTRADA:
        return "entrada", ENTRADA[m.group(1)]
    if i in PORTALES:
        return "portal", PORTALES[i]
    if i in VELOCIDADES:
        return "velocidad", VELOCIDADES[i]
    if i in PADS:
        return "pad", PADS[i]
    if i in ORBES:
        return "orbe", ORBES[i]
    if i in MONEDAS:
        return "moneda", None
    if i in ROMPIBLES:
        return "solido", "rompible"
    hb = (o or {}).get("hitbox")
    if not hb:
        return ("trigger", "otro") if tex.startswith("edit_") else ("deco", None)
    if hb["type"] == "Circle" or PELIGRO.search(tex):
        return "peligro", None
    if hb["type"] == "Slope":
        return "rampa", None
    return "solido", None


def leer_plist(ruta):
    """Cuadros de una hoja de Cocos2d (formato 3): nombre → [x, y, w, h, rotado, ox, oy, sw, sh]."""
    d = plistlib.loads(Path(ruta).read_bytes())
    num = lambda s: [float(x) for x in re.findall(r"-?[0-9.]+", s)]
    cuadros = {}
    for nombre, f in d["frames"].items():
        if "textureRect" in f:
            x, y, w, h = num(f["textureRect"])
            ox, oy = num(f["spriteOffset"])
            sw, sh = num(f["spriteSourceSize"])
            rot = bool(f.get("textureRotated"))
        else:  # formato 2
            x, y, w, h = num(f["frame"])
            ox, oy = num(f["offset"])
            sw, sh = num(f["sourceSize"])
            rot = bool(f.get("rotated"))
        cuadros[nombre] = [int(x), int(y), int(w), int(h), 1 if rot else 0, ox, oy, int(sw), int(sh)]
    return cuadros


def leer_fnt(ruta):
    fuente = {"chars": {}}
    for linea in Path(ruta).read_text("utf-8").splitlines():
        campos = dict(re.findall(r'(\w+)=("[^"]*"|\S+)', linea))
        if linea.startswith("common"):
            fuente["alto"] = int(campos["lineHeight"]); fuente["base"] = int(campos["base"])
        elif linea.startswith("char "):
            c = {k: int(v) for k, v in campos.items() if k != "letter"}
            fuente["chars"][c["id"]] = [c["x"], c["y"], c["width"], c["height"], c["xoffset"], c["yoffset"], c["xadvance"]]
    return fuente


def webp(img, ruta, calidad):
    img.save(ruta, "WEBP", quality=calidad, method=6, alpha_quality=100)


def empaquetar(imagenes, ancho=1024):
    """Estantes simples: [(nombre, Image)] → (Image, {nombre: (x, y)})."""
    x = y = alto_fila = 0
    pos = {}
    for nombre, im in sorted(imagenes, key=lambda t: -t[1].size[1]):
        w, h = im.size
        if x + w > ancho:
            x, y, alto_fila = 0, y + alto_fila + 2, 0
        pos[nombre] = (x, y)
        x += w + 2
        alto_fila = max(alto_fila, h)
    hoja = Image.new("RGBA", (ancho, y + alto_fila), (0, 0, 0, 0))
    for nombre, im in imagenes:
        hoja.paste(im.convert("RGBA"), pos[nombre])
    return hoja, pos


def texto_nivel(ruta):
    """El nivel tal como viene (base64 con gzip). Algunos traen basura al final o espacios al principio."""
    return re.match(rb"[A-Za-z0-9_=-]*", ruta.read_bytes().strip()).group().decode()


def objetos_usados(textos):
    import base64, zlib
    usados = set()
    for t in textos:
        datos = zlib.decompress(base64.urlsafe_b64decode(t + "=" * (-len(t) % 4)), 47).decode("utf-8", "replace")
        for parte in datos.split(";")[1:]:
            if parte:
                usados.add(int(parte.split(",")[1]))
    return usados


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("assets", type=Path)
    ap.add_argument("object_json", type=Path)
    ap.add_argument("salida", type=Path)
    ap.add_argument("--calidad", type=int, default=90)
    ap.add_argument("--kbps", type=int, default=64)
    a = ap.parse_args()
    A, S = a.assets, a.salida
    for d in ("hojas", "fondos", "niveles", "musica", "sonidos"):
        (S / d).mkdir(parents=True, exist_ok=True)

    # 1. hojas del juego
    cuadros, hojas = {}, []
    for h in HOJAS:
        nombre = h.replace("-hd", "")
        for k, v in leer_plist(A / f"{h}.plist").items():
            cuadros.setdefault(k, [len(hojas)] + v)
        webp(Image.open(A / f"{h}.png"), S / "hojas" / f"{nombre}.webp", a.calidad)
        hojas.append(nombre)

    # 2. la hoja "extra": íconos del jugador y fuentes, enteros, con sus cuadros corridos
    sueltas, cuadros_extra = [], {}
    for ic in ICONOS:
        sueltas.append((ic, Image.open(A / "icons" / f"{ic}-hd.png")))
        cuadros_extra[ic] = leer_plist(A / "icons" / f"{ic}-hd.plist")
    fuentes = {}
    for f in FUENTES:
        sueltas.append((f, Image.open(A / f"{f}-hd.png")))
        fuentes[f] = leer_fnt(A / f"{f}-hd.fnt")
    hoja_extra, pos = empaquetar(sueltas)
    for ic, cs in cuadros_extra.items():
        dx, dy = pos[ic]
        for k, v in cs.items():
            cuadros.setdefault(k, [len(hojas), v[0] + dx, v[1] + dy] + v[2:])
    for f in FUENTES:
        fuentes[f]["hoja"] = len(hojas)
        fuentes[f]["x"], fuentes[f]["y"] = pos[f]
    webp(hoja_extra, S / "hojas" / "extra.webp", a.calidad)
    hojas.append("extra")

    # 3. niveles, y qué objetos usan
    textos = {}
    for n in NIVELES:
        textos[n] = texto_nivel(A / "levels" / f"{n}.txt")
        (S / "niveles" / f"{n}.txt").write_text(textos[n])
    usados = objetos_usados(textos.values())

    # 4. tabla de objetos: cómo se dibuja (object.json) y qué hace (clasificar)
    oj = json.loads(a.object_json.read_text())
    objetos, sin_dibujo, tipos = {}, [], {}
    for i in sorted(usados):
        o = oj.get(str(i))
        tipo, sub = clasificar(i, o)
        tipos[tipo] = tipos.get(tipo, 0) + 1
        if o is None and tipo not in ("trigger", "entrada"):
            sin_dibujo.append(i)
        d = dict(o or {})
        d["tipo"] = tipo
        if sub is not None:
            d["sub"] = sub
        if i in COLOR_VIEJO:
            d["canal"] = COLOR_VIEJO[i]
        if tipo in ("moneda", "solido") and not d.get("hitbox"):
            d["hitbox"] = {"type": "Box", "width": 30.0, "height": 30.0, "x": 0.0, "y": 0.0}
        faltan = [t for t in [d.get("texture")] + [c["texture"] for c in d.get("children", [])]
                  if t and t != "emptyFrame.png" and t not in cuadros and tipo not in ("trigger", "entrada")]
        if faltan:
            d["faltan"] = faltan
        objetos[i] = d
    if sin_dibujo:
        sys.exit(f"objetos sin definición en object.json: {sin_dibujo}")

    # 5. fondos y pisos que piden los niveles (kA6 / kA7; 0 es el 1)
    import base64, zlib
    fondos, pisos = {1}, {1}
    for t in textos.values():
        cab = zlib.decompress(base64.urlsafe_b64decode(t + "=" * (-len(t) % 4)), 47).decode("utf-8", "replace").split(";")[0].split(",")
        kv = dict(zip(cab[0::2], cab[1::2]))
        fondos.add(max(1, int(kv.get("kA6", 0) or 0)))
        pisos.add(max(1, int(kv.get("kA7", 0) or 0)))
    for f in sorted(fondos):
        webp(Image.open(A / f"game_bg_{f:02d}_001-hd.png").convert("RGBA"), S / "fondos" / f"fondo_{f}.webp", a.calidad)
    for p in sorted(pisos):
        webp(Image.open(A / f"groundSquare_{p:02d}_001-hd.png"), S / "fondos" / f"piso_{p}.webp", a.calidad)
        dos = A / f"groundSquare_{p:02d}_2_001-hd.png"
        if dos.exists():
            webp(Image.open(dos), S / "fondos" / f"piso_{p}_2.webp", a.calidad)

    # 6. música (Opus) y sonidos (los .ogg del juego, tal cual)
    for n in NIVELES:
        cancion = META[n][1]
        destino = S / "musica" / f"{cancion}.ogg"
        if not destino.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(A / f"{cancion}.mp3"), "-c:a", "libopus",
                            "-b:a", f"{a.kbps}k", "-vbr", "on", str(destino)], check=True)
    menu = S / "musica" / "menuLoop.ogg"
    if not menu.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(A / "menuLoop.mp3"), "-c:a", "libopus",
                        "-b:a", f"{a.kbps}k", "-vbr", "on", str(menu)], check=True)
    for s in SONIDOS:
        (S / "sonidos" / f"{s}.ogg").write_bytes((A / f"{s}.ogg").read_bytes())

    datos = {
        "hojas": hojas, "cuadros": cuadros, "fuentes": fuentes, "objetos": objetos,
        "fondos": sorted(fondos), "pisos": sorted(pisos),
        "pisos2": sorted(p for p in pisos if (A / f"groundSquare_{p:02d}_2_001-hd.png").exists()),
        "niveles": [{"id": n, "nombre": META[n][0], "cancion": META[n][1], "dificultad": META[n][2],
                     "estrellas": META[n][3]} for n in NIVELES],
    }
    (S / "datos.json").write_text(json.dumps(datos, separators=(",", ":")))
    faltan = {i: d["faltan"] for i, d in objetos.items() if "faltan" in d}
    print(f"{len(cuadros)} cuadros en {len(hojas)} hojas · {len(objetos)} objetos {tipos} · "
          f"{len(fondos)} fondos, {len(pisos)} pisos · {len(NIVELES)} niveles")
    if faltan:
        print("dibujos que no están en las hojas:", faltan)


if __name__ == "__main__":
    main()
