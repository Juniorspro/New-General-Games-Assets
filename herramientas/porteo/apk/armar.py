#!/usr/bin/env python3
"""Envuelve un juego HTML5 en un APK de Android, sin Gradle y sin red.

    python3 armar.py CARPETA_DEL_JUEGO --nombre "Mi juego" --paquete ar.juniors.mijuego \
        [--orientacion horizontal|vertical|libre] [--icono icono.png] [--version 1.0] \
        [--inicio index.html] [--red] [--aislado] [--salida juego.apk]

Por qué así y no con Capacitor/Cordova: esos arrastran Gradle + el Android
Gradle Plugin (bajan ~1 GB la primera vez y tardan minutos) y meten 2-3 MB de
bibliotecas. Esto usa sólo aapt2, javac, d8, zipalign y apksigner: arma en
segundos y el APK pesa el juego más ~15 KB.

El SDK mínimo se instala con instalar-sdk.sh (≈130 MB, no los 3 GB de Android Studio).
"""
import argparse
import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SDK = Path(os.environ.get("ANDROID_HOME", "/opt/android-sdk"))
BT = SDK / "build-tools" / "35.0.0"
ANDROID_JAR = SDK / "platforms" / "android-35" / "android.jar"

ORIENTACIONES = {"horizontal": "sensorLandscape", "vertical": "sensorPortrait", "libre": "fullSensor"}

# Lo que nunca tiene que viajar adentro del APK.
BASURA_DIRS = {".git", ".svn", "__MACOSX", "node_modules", ".idea", ".vscode", "pruebas", "__pycache__"}
BASURA_ARCH = {".DS_Store", "Thumbs.db", "desktop.ini"}
BASURA_EXT = {".map", ".psd", ".blend", ".blend1", ".xcf", ".kra", ".aseprite", ".ase", ".py", ".sh", ".md"}

# Ya vienen comprimidos: deflate otra vez gasta CPU al abrir y no achica nada.
SIN_COMPRIMIR = ["png", "jpg", "jpeg", "webp", "gif", "avif", "mp3", "ogg", "opus", "m4a",
                 "aac", "mp4", "webm", "woff2", "ktx2", "zip"]


def correr(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit(f"falló: {' '.join(map(str, cmd))}\n{r.stdout}\n{r.stderr}")
    return r.stdout


def copiar_juego(origen: Path, destino: Path, quitar_basura: bool):
    """Copia el juego; los .gz/.br se guardan ya descomprimidos (ver Juego.tipo)."""
    import gzip
    try:
        import brotli
    except ImportError:
        brotli = None
    n = 0
    # Lo que generó pwa.py sirve en la web y no en el APK (web.js no registra
    # el service worker adentro del WebView). El de un juego propio se respeta.
    sw = origen / "sw.js"
    solo_web = set()
    if sw.exists() and sw.read_text("utf-8", "replace").startswith("// Generado por herramientas/porteo/pwa.py"):
        solo_web = {"sw.js", "manifest.webmanifest", "icono-512.png"}
    for raiz, dirs, archivos in os.walk(origen):
        if quitar_basura:
            dirs[:] = [d for d in dirs if d not in BASURA_DIRS]
        for a in archivos:
            src = Path(raiz) / a
            if quitar_basura and (a in BASURA_ARCH or src.suffix.lower() in BASURA_EXT):
                continue
            rel = src.relative_to(origen)
            if rel.as_posix() in solo_web:
                continue
            dst = destino / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            datos = None
            if a.endswith(".gz"):
                datos = gzip.decompress(src.read_bytes())
            elif a.endswith(".br"):
                if brotli is None:
                    sys.exit("hay archivos .br: pip install brotli")
                datos = brotli.decompress(src.read_bytes())
            if datos is None:
                shutil.copy2(src, dst)
            else:
                dst.write_bytes(datos)
            n += 1
    return n


def iconos(res: Path, icono: Path | None, nombre: str):
    from PIL import Image, ImageDraw, ImageFont
    if icono:
        base = Image.open(icono).convert("RGBA")
        # recortar a cuadrado por el centro
        l = min(base.size)
        x, y = (base.width - l) // 2, (base.height - l) // 2
        base = base.crop((x, y, x + l, y + l))
    else:
        # Sin ícono: la inicial sobre un degradé, mejor que el robot verde.
        base = Image.new("RGBA", (512, 512))
        d = ImageDraw.Draw(base)
        for i in range(512):
            d.line([(0, i), (512, i)], fill=(40 + i // 6, 30, 90 + i // 5, 255))
        try:
            f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 300)
        except OSError:
            f = ImageFont.load_default()
        letra = (nombre.strip()[:1] or "J").upper()
        d.text((256, 256), letra, font=f, fill="white", anchor="mm")
    for carpeta, lado in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
        p = res / f"mipmap-{carpeta}"
        p.mkdir(parents=True, exist_ok=True)
        base.resize((lado, lado), Image.LANCZOS).save(p / "icono.png", optimize=True)


def xml_esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace("'", "\\'").replace('"', '\\"'))


def clave(trabajo: Path):
    """Devuelve (keystore, contraseña, alias).

    El contenedor se borra: si la clave se pierde, el APK nuevo no se puede
    instalar ENCIMA del viejo (Android exige la misma firma) y hay que
    desinstalar, perdiendo las partidas. Por eso se busca primero en el
    entorno (PORTEO_CLAVE_B64), que sobrevive entre sesiones.
    """
    pw = os.environ.get("PORTEO_CLAVE_PASS", "porteo-local")
    b64 = os.environ.get("PORTEO_CLAVE_B64")
    if b64:
        ks = trabajo / "clave.jks"
        ks.write_bytes(base64.b64decode(b64))
        return ks, pw, os.environ.get("PORTEO_CLAVE_ALIAS", "porteo"), "PORTEO_CLAVE_B64"
    ks = Path.home() / ".porteo" / "porteo.jks"
    if not ks.exists():
        ks.parent.mkdir(parents=True, exist_ok=True)
        correr(["keytool", "-genkeypair", "-keystore", ks, "-storepass", pw, "-keypass", pw,
                "-alias", "porteo", "-keyalg", "RSA", "-keysize", "2048", "-validity", "36500",
                "-dname", "CN=Porteo, O=Juniors, C=AR"])
    return ks, pw, "porteo", str(ks)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("juego", type=Path)
    ap.add_argument("--nombre", required=True)
    ap.add_argument("--paquete", required=True, help="ej. ar.juniors.enjambre")
    ap.add_argument("--version", default="1.0")
    ap.add_argument("--version-codigo", type=int, default=None)
    ap.add_argument("--orientacion", choices=ORIENTACIONES, default="libre")
    ap.add_argument("--icono", type=Path)
    ap.add_argument("--inicio", default="index.html")
    ap.add_argument("--red", action="store_true", help="el juego necesita internet")
    ap.add_argument("--aislado", action="store_true", help="COOP/COEP para SharedArrayBuffer")
    ap.add_argument("--hz", type=int, default=60,
                    help="refresco de pantalla pedido (default 60; 0 = el del teléfono)")
    ap.add_argument("--con-basura", action="store_true", help="no filtrar .map, .psd, etc.")
    ap.add_argument("--salida", type=Path)
    a = ap.parse_args()

    if not (BT / "aapt2").exists() or not ANDROID_JAR.exists():
        sys.exit(f"falta el SDK mínimo en {SDK}: correr {AQUI.parent / 'instalar-sdk.sh'}")
    if not re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+", a.paquete):
        sys.exit("--paquete tiene que ser tipo ar.juniors.juego (minúsculas, con puntos)")

    juego = a.juego.resolve()
    if juego.is_file():  # un solo .html
        a.inicio = juego.name
        unico = juego
        juego = juego.parent
    else:
        unico = None
    if not (juego / a.inicio).exists():
        sys.exit(f"no está {juego / a.inicio}")

    salida = (a.salida or Path.cwd() / f"{a.paquete.split('.')[-1]}.apk").resolve()
    vcod = a.version_codigo or int("".join(f"{int(x):02d}" for x in (a.version.split(".") + ["0", "0"])[:3]))

    with tempfile.TemporaryDirectory(prefix="porteo-apk-") as t:
        t = Path(t)
        assets = t / "assets" / "juego"
        assets.mkdir(parents=True)
        if unico:
            shutil.copy2(unico, assets / unico.name)
            n = 1
        else:
            n = copiar_juego(juego, assets, not a.con_basura)

        res = t / "res"
        (res / "values").mkdir(parents=True)
        (res / "values" / "strings.xml").write_text(
            f'<resources><string name="nombre">{xml_esc(a.nombre)}</string></resources>', "utf-8")
        (res / "values" / "styles.xml").write_text(
            '<resources><style name="Pantalla" parent="@android:style/Theme.Material.NoActionBar.Fullscreen">'
            '<item name="android:windowBackground">@android:color/black</item>'
            '<item name="android:windowFullscreen">true</item>'
            '<item name="android:windowContentOverlay">@null</item>'
            '</style></resources>', "utf-8")
        iconos(res, a.icono, a.nombre)

        man = (AQUI / "plantilla" / "AndroidManifest.xml").read_text("utf-8")
        man = (man.replace("__PAQUETE__", a.paquete).replace("__VERSION_CODIGO__", str(vcod))
                  .replace("__VERSION__", a.version).replace("__ORIENTACION__", ORIENTACIONES[a.orientacion])
                  .replace("__PERMISO_RED__", '    <uses-permission android:name="android.permission.INTERNET" />' if a.red else ""))
        (t / "AndroidManifest.xml").write_text(man, "utf-8")

        java = (AQUI / "plantilla" / "src" / "Juego.java").read_text("utf-8")
        java = (java.replace("__PAQUETE__", a.paquete).replace("__INICIO__", a.inicio.replace('"', ""))
                    .replace("__AISLADO__", "true" if a.aislado else "false")
                    .replace("__RED__", "true" if a.red else "false")
                    .replace("__HZ__", str(max(0, a.hz))))
        src = t / "src" / Path(*a.paquete.split("."))
        src.mkdir(parents=True)
        (src / "Juego.java").write_text(java, "utf-8")

        correr([BT / "aapt2", "compile", "--dir", res, "-o", t / "res.zip"])
        cmd = [BT / "aapt2", "link", "-I", ANDROID_JAR, "--manifest", t / "AndroidManifest.xml",
               "-A", t / "assets", "-o", t / "base.apk", "--min-sdk-version", "24", "--target-sdk-version", "35"]
        for e in SIN_COMPRIMIR:
            cmd += ["-0", e]
        correr(cmd + [t / "res.zip"])

        clases = t / "clases"
        clases.mkdir()
        correr(["javac", "-source", "8", "-target", "8", "-nowarn", "-Xlint:-options",
                "-bootclasspath", ANDROID_JAR, "-d", clases, src / "Juego.java"])
        dex = t / "dex"
        dex.mkdir()
        correr([BT / "d8", "--release", "--min-api", "24", "--lib", ANDROID_JAR, "--output", dex,
                *sorted(clases.rglob("*.class"))])
        with zipfile.ZipFile(t / "base.apk", "a") as z:
            z.write(dex / "classes.dex", "classes.dex")

        correr([BT / "zipalign", "-f", "-p", "4", t / "base.apk", t / "alineado.apk"])
        ks, pw, alias, origen_clave = clave(t)
        salida.parent.mkdir(parents=True, exist_ok=True)
        correr([BT / "apksigner", "sign", "--ks", ks, "--ks-pass", f"pass:{pw}", "--key-pass", f"pass:{pw}",
                "--ks-key-alias", alias, "--min-sdk-version", "24", "--out", salida, t / "alineado.apk"])
        correr([BT / "apksigner", "verify", "--min-sdk-version", "24", salida])
        Path(str(salida) + ".idsig").unlink(missing_ok=True)

    tam = salida.stat().st_size
    print(f"APK: {salida}")
    print(f"  {tam:,} bytes ({tam / 1048576:.2f} MB), {n} archivos del juego")
    print(f"  {a.paquete} v{a.version} ({vcod}), orientación {a.orientacion}, red {'sí' if a.red else 'no'}")
    print(f"  firmado con {origen_clave}")


if __name__ == "__main__":
    main()
