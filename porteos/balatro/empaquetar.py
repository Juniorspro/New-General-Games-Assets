#!/usr/bin/env python3
"""Del APK de Balatro (Android) a la versión web: un sitio listo para subir.

    python3 -I empaquetar.py balatro.apk MOTOR SALIDA [--registro __registro]

MOTOR es la carpeta con love.js y love.wasm (motor/compilar.sh). En SALIDA:

    index.html            la página (pagina/index.html con la tabla de archivos)
    porteo-*.js           registro, carga, web e intro de herramientas/porteo
    b/<hash>.js|wasm|love el motor y el juego: el nombre cambia si cambia el contenido, así que se
                          guardan en caché para siempre
    manifest.webmanifest, icono-192.png, icono-512.png   para instalarla como app

El juego (balatro.love) es un zip que LÖVE monta tal cual: el código y las fuentes comprimidos, los
OGG y PNG guardados sin comprimir (ya lo están: así un sonido en "stream" se lee sin descomprimir).
Todo va adentro (música incluida) y entra en unos 7,5 MB, así sirve también como un solo .html.
Respecto del APK (104 MB descomprimido):
- main.lua y conf.lua del juego pasan a balatro_main.lua y balatro_conf.lua; los de juego/ (los
  nuestros) los cargan después de la capa del navegador (porteo_web.lua).
- Sin las fuentes chinas, japonesa, coreana, rusa ni las Go Noto (62 MB) ni los textos de esos
  idiomas: porteo_despues.lua los saca de la lista.
- El sonido en Vorbis mono (17,5 MB → 5,1 MB): la música y el ambiente a calidad -1 (32 kb/s), los
  efectos a 0. En el parlante de un teléfono no se nota.
- Las texturas en 2x nada más (porteo_web.lua da la 2x cuando el juego pide una 1x) y recomprimidas
  sin pérdida (optipng): los mismos píxeles en un 25% menos. Los logos de la presentación sí van en
  1x, que es como el juego los pide.
- gamecontrollerdb.txt con un mapeo solo: todas sus líneas son para Windows, Mac, Linux, Android o
  iOS, y SDL las ignora en el navegador (ahí los mandos vienen ya mapeados).
- Sin lo que es de Android y no del juego (dexopt/, info.txt).

Hace falta ffmpeg (el sonido y la imagen de la carga) y optipng. Lo recodificado queda en una caché
(~/.cache/porteo-balatro), así la segunda vez tarda segundos.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PORTEO = AQUI.parent.parent / "herramientas" / "porteo"
CACHE = Path.home() / ".cache" / "porteo-balatro"
FUENTES = {"m6x11plus.ttf"}
# los textos de los idiomas que no tienen fuente en la versión web
SIN_FUENTE = {"ja", "ko", "zh_CN", "zh_TW", "ru"}
# el juego los pide en 1x (con dpiscale 1); las 2x (2834×2834) no las usa
LOGOS = {"playstack-logo.png", "localthunk-logo.png"}
RENOMBRAR = {"main.lua": "balatro_main.lua", "conf.lua": "balatro_conf.lua"}
SIN_COMPRIMIR = (".ogg", ".png", ".ogv")
FECHA = (2026, 1, 1, 0, 0, 0)


def calidad(nombre):
    """La calidad de Vorbis (como -q de oggenc) de cada sonido: música y ambiente, -1; efectos, 0."""
    return -1 if nombre.startswith(("music", "ambient")) else 0


def se_queda(ruta):
    if ruta.startswith("dexopt/") or ruta == "info.txt":
        return False
    nombre = ruta.rsplit("/", 1)[-1]
    if ruta.startswith("resources/fonts/"):
        return nombre in FUENTES
    if ruta.startswith("localization/"):
        return nombre[:-4] not in SIN_FUENTE
    if ruta.startswith("resources/textures/1x/"):
        return nombre in LOGOS
    if ruta.startswith("resources/textures/2x/"):
        return nombre not in LOGOS
    return True


def en_cache(datos, clave, hacer):
    """hacer(entrada, salida) sobre datos, con el resultado guardado por hash de entrada y receta."""
    h = hashlib.sha256(clave.encode() + b"\0" + datos).hexdigest()[:32]
    f = CACHE / h
    if not f.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="balatro-") as tmp:
            ent, sal = Path(tmp) / ("e" + clave[-4:]), Path(tmp) / ("s" + clave[-4:])
            ent.write_bytes(datos)
            hacer(ent, sal)
            sal.replace(f)
    return f.read_bytes()


def sonido(nombre, datos):
    q = calidad(nombre)

    def hacer(ent, sal):
        # q -1 no se puede pedir con -q:a (ffmpeg toma un número negativo como "sin calidad" y usa 3):
        # global_quality en unidades de lambda (118 por punto) sí lo pasa
        ffmpeg("-i", str(ent), "-map_metadata", "-1", "-ac", "1", "-c:a", "libvorbis", "-flags:a", "+qscale",
               "-global_quality:a", str(q * 118), str(sal))
    return en_cache(datos, f"vorbis-mono-q{q}.ogg", hacer)


def textura(datos):
    def hacer(ent, sal):
        r = subprocess.run(["optipng", "-quiet", "-o2", "-strip", "all", "-out", str(sal), str(ent)],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit("empaquetar: optipng falló: " + r.stderr[-800:])
    return en_cache(datos, "optipng-o2.png", hacer)


def mandos(datos):
    """gamecontrollerdb.txt con un mapeo solo, sin sistema: todas sus líneas dicen platform: (Windows,
    Mac, Linux, Android, iOS) y SDL ignora esas en el navegador, donde los mandos vienen ya mapeados;
    pero LÖVE da error si el archivo no trae ninguno que sirva."""
    lineas = [l for l in datos.decode("utf-8", "replace").splitlines() if l.strip() and not l.startswith("#")]
    linea = next((l for l in lineas if "Xbox 360" in l and "platform:Linux" in l), lineas[0])
    linea = re.sub(r"platform:[^,]*,?", "", linea).rstrip(",")
    return ("# porteo: un mapeo solo (ver empaquetar.py)\n" + linea + ",\n").encode()


def transformar(ruta, datos):
    if ruta.startswith("resources/sounds/") and ruta.endswith(".ogg"):
        return sonido(ruta.rsplit("/", 1)[1], datos)
    if ruta.startswith("resources/textures/") and ruta.endswith(".png"):
        return textura(datos)
    if ruta == "resources/gamecontrollerdb.txt":
        return mandos(datos)
    return datos


def ffmpeg(*args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit("empaquetar: ffmpeg falló: " + r.stderr[-800:])


def con_hash(datos, ext):
    return f"b/{hashlib.sha256(datos).hexdigest()[:20]}.{ext}"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("apk")
    ap.add_argument("motor", help="carpeta con love.js y love.wasm")
    ap.add_argument("salida")
    ap.add_argument("--registro", help="dirección relativa a donde la página manda lo que pasa (p. ej. __registro)")
    a = ap.parse_args()
    apk, motor, salida = Path(a.apk), Path(a.motor), Path(a.salida)
    if salida.exists():
        shutil.rmtree(salida)
    (salida / "b").mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix="balatro-") as tmp:
        tmp = Path(tmp)
        archivos = {}
        juego = tmp / "balatro.love"
        with zipfile.ZipFile(apk) as z, zipfile.ZipFile(juego, "w") as love:
            nombres = sorted(n for n in z.namelist() if n.startswith("assets/") and not n.endswith("/"))
            if "assets/main.lua" not in nombres or "assets/game.lua" not in nombres:
                sys.exit(f"{apk}: no parece el APK de Balatro (falta assets/main.lua o game.lua)")
            quedan = [(n, n[len("assets/"):]) for n in nombres if se_queda(n[len("assets/"):])]
            # lo lento (ffmpeg, optipng) en paralelo
            with ThreadPoolExecutor(os.cpu_count() or 4) as ex:
                datos = list(ex.map(lambda nr: transformar(nr[1], z.read(nr[0])), quedan))
            for (n, ruta), d in zip(quedan, datos):
                ruta = RENOMBRAR.get(ruta, ruta)
                metodo = zipfile.ZIP_STORED if ruta.lower().endswith(SIN_COMPRIMIR) else zipfile.ZIP_DEFLATED
                love.writestr(zipfile.ZipInfo(ruta, FECHA), d, compress_type=metodo, compresslevel=9)
            for f in sorted((AQUI / "juego").glob("*.lua")):
                love.writestr(zipfile.ZipInfo(f.name, FECHA), f.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            # la carta del Joker (la primera del atlas, 142×190 en 2x) para la carga y el ícono
            atlas = tmp / "Jokers.png"
            atlas.write_bytes(z.read("assets/resources/textures/2x/Jokers.png"))
        joker = tmp / "joker.png"
        ffmpeg("-i", str(atlas), "-vf", "crop=142:190:0:0,scale=284:380:flags=neighbor", str(joker))
        for lado in (192, 512):
            ffmpeg("-i", str(atlas), "-vf", f"crop=142:190:0:0,scale=-1:{int(lado * 0.86)}:flags=neighbor,"
                   f"pad={lado}:{lado}:(ow-iw)/2:(oh-ih)/2:color=0x1e3b44", str(salida / f"icono-{lado}.png"))

        for nombre, ext in (("love.js", "js"), ("love.wasm", "wasm")):
            datos = (motor / nombre).read_bytes()
            archivos[ext] = con_hash(datos, ext)
            (salida / archivos[ext]).write_bytes(datos)
        datos = juego.read_bytes()
        archivos["love"] = con_hash(datos, "love")
        (salida / archivos["love"]).write_bytes(datos)
        imagen = "data:image/png;base64," + base64.b64encode(joker.read_bytes()).decode()

    tabla = {"motor": archivos["js"], "wasm": archivos["wasm"], "juego": archivos["love"],
             "juegoBytes": (salida / archivos["love"]).stat().st_size}
    if a.registro:
        tabla["registro"] = a.registro
    html = (AQUI / "pagina" / "index.html").read_text(encoding="utf-8")
    html = html.replace("/*TABLA*/null", json.dumps(tabla, ensure_ascii=False)).replace("/*IMAGEN*/''", json.dumps(imagen))
    (salida / "index.html").write_text(html, encoding="utf-8")
    for n in ("registro.js", "carga.js", "web.js", "intro.js"):
        shutil.copyfile(PORTEO / n, salida / f"porteo-{n}")
    manifiesto = {"name": "Balatro", "short_name": "Balatro", "start_url": "./", "scope": "./", "display": "fullscreen",
                  "orientation": "landscape", "background_color": "#1e3b44", "theme_color": "#1e3b44",
                  "icons": [{"src": f"icono-{l}.png", "sizes": f"{l}x{l}", "type": "image/png"} for l in (192, 512)]}
    (salida / "manifest.webmanifest").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")

    pesos = {k: (salida / v).stat().st_size / 1e6 for k, v in archivos.items()}
    print(f"{salida}: motor {pesos['js'] + pesos['wasm']:.1f} MB, juego {pesos['love']:.1f} MB")


if __name__ == "__main__":
    main()
