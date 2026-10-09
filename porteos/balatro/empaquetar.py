#!/usr/bin/env python3
"""Del APK de Balatro (Android) a la versión web: un sitio listo para subir.

    python3 -I empaquetar.py balatro.apk MOTOR SALIDA [--registro __registro]

MOTOR es la carpeta con love.js y love.wasm (motor/compilar.sh). Hace falta ffmpeg (los silencios y
la imagen de la carga). En SALIDA:

    index.html            la página (pagina/index.html con la tabla de archivos)
    porteo-*.js           registro, carga y web de herramientas/porteo
    b/<hash>.js|wasm|love el motor y el juego: el nombre cambia si cambia el contenido, así que se
                          guardan en caché para siempre
    b/<hash>.ogg          la música y el ambiente, que bajan después de arrancar
    manifest.webmanifest, icono-192.png, icono-512.png   para instalarla como app

El juego (balatro.love) es un zip que LÖVE monta tal cual: el código y las fuentes comprimidos, los
OGG y PNG guardados sin comprimir (ya lo están: así un sonido en "stream" se lee sin descomprimir).
Respecto del APK:
- main.lua y conf.lua del juego pasan a balatro_main.lua y balatro_conf.lua; los de juego/ (los
  nuestros) los cargan después de la capa del navegador (porteo_web.lua).
- Sin las fuentes chinas, japonesa, coreana ni las Go Noto: 61 MB de los 104 del APK, para cuatro
  idiomas (porteo_despues.lua los saca de la lista).
- La música y el ambiente (15,6 MB) no van adentro: van silencios con el mismo nombre y los de
  verdad bajan por detrás (ver "Sonido" en porteo_web.lua). Así el menú aparece con 7 MB.
- Sin lo que es de Android y no del juego (dexopt/, info.txt).
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PORTEO = AQUI.parent.parent / "herramientas" / "porteo"
FUENTES = {"m6x11plus.ttf", "NotoSans-Bold.ttf"}
RENOMBRAR = {"main.lua": "balatro_main.lua", "conf.lua": "balatro_conf.lua"}
SIN_COMPRIMIR = (".ogg", ".png", ".ogv")
FECHA = (2026, 1, 1, 0, 0, 0)


def tarde(ruta):
    """La música y el ambiente: lo que no se espera para arrancar."""
    if not ruta.startswith("resources/sounds/"):
        return False
    nombre = ruta.rsplit("/", 1)[1]
    return nombre.startswith("music") or nombre.startswith("ambient")


def se_queda(ruta):
    if ruta.startswith("dexopt/") or ruta == "info.txt":
        return False
    if ruta.startswith("resources/fonts/"):
        return ruta.rsplit("/", 1)[1] in FUENTES
    return True


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
        silencio = tmp / "silencio.ogg"
        ffmpeg("-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "20", "-c:a", "libvorbis", "-q:a", "0", str(silencio))
        archivos = {}
        tardios = []
        juego = tmp / "balatro.love"
        with zipfile.ZipFile(apk) as z, zipfile.ZipFile(juego, "w") as love:
            nombres = sorted(n for n in z.namelist() if n.startswith("assets/") and not n.endswith("/"))
            if "assets/main.lua" not in nombres or "assets/game.lua" not in nombres:
                sys.exit(f"{apk}: no parece el APK de Balatro (falta assets/main.lua o game.lua)")
            for n in nombres:
                ruta = n[len("assets/"):]
                if not se_queda(ruta):
                    continue
                datos = z.read(n)
                if tarde(ruta):
                    url = con_hash(datos, "ogg")
                    (salida / url).write_bytes(datos)
                    tardios.append({"ruta": ruta, "url": url, "bytes": len(datos)})
                    datos = silencio.read_bytes()
                ruta = RENOMBRAR.get(ruta, ruta)
                metodo = zipfile.ZIP_STORED if ruta.lower().endswith(SIN_COMPRIMIR) else zipfile.ZIP_DEFLATED
                love.writestr(zipfile.ZipInfo(ruta, FECHA), datos, compress_type=metodo, compresslevel=9)
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
        import base64
        imagen = "data:image/png;base64," + base64.b64encode(joker.read_bytes()).decode()

    tabla = {"motor": archivos["js"], "wasm": archivos["wasm"], "juego": archivos["love"],
             "juegoBytes": (salida / archivos["love"]).stat().st_size, "tarde": tardios}
    if a.registro:
        tabla["registro"] = a.registro
    html = (AQUI / "pagina" / "index.html").read_text(encoding="utf-8")
    html = html.replace("/*TABLA*/null", json.dumps(tabla, ensure_ascii=False)).replace("/*IMAGEN*/''", json.dumps(imagen))
    (salida / "index.html").write_text(html, encoding="utf-8")
    for n in ("registro.js", "carga.js", "web.js"):
        shutil.copyfile(PORTEO / n, salida / f"porteo-{n}")
    manifiesto = {"name": "Balatro", "short_name": "Balatro", "start_url": "./", "scope": "./", "display": "fullscreen",
                  "orientation": "landscape", "background_color": "#1e3b44", "theme_color": "#1e3b44",
                  "icons": [{"src": f"icono-{l}.png", "sizes": f"{l}x{l}", "type": "image/png"} for l in (192, 512)]}
    (salida / "manifest.webmanifest").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")

    pesos = {k: (salida / v).stat().st_size / 1e6 for k, v in archivos.items()}
    print(f"{salida}: motor {pesos['js'] + pesos['wasm']:.1f} MB, juego {pesos['love']:.1f} MB, "
          f"después {sum(t['bytes'] for t in tardios) / 1e6:.1f} MB ({len(tardios)} archivos)")


if __name__ == "__main__":
    main()
