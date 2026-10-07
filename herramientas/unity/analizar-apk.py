#!/usr/bin/env python3
"""Qué hay adentro de un APK hecho con Unity, sin ejecutar nada de él.

    python3 -m venv ~/.porteo/unity && ~/.porteo/unity/bin/pip install dnfile UnityPy pyaxmlparser
    ~/.porteo/unity/bin/python -I analizar-apk.py JUEGO.apk [CARPETA_DE_TRABAJO]

Dice:
  - el paquete: nombre, versión, permisos, componentes, quién lo firmó, ABIs;
  - el código: Mono (el C# está en Managed/*.dll y se puede decompilar) o IL2CPP
    (compilado a nativo: del C# quedan sólo los nombres); qué bibliotecas trae y
    qué cadenas con direcciones de red tiene (para ver si le metieron algo);
  - los datos: versión de Unity, escenas, objetos, texturas por formato, mallas
    y audio, con lo que ocuparía el audio decodificado como lo hace WebAudio
    (que es lo que hace Unity WebGL), que suele ser lo que no entra en un teléfono.

Los datos (assets/bin/Data) se sacan a CARPETA_DE_TRABAJO (default: al lado del
APK, en NOMBRE-datos/): pueden ser más de 1 GB. Lo bajado de internet es de
terceros: va en su propia carpeta y no se ejecuta.
"""
import collections
import os
import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

import dnfile
import UnityPy
from pyaxmlparser.axmlprinter import AXMLPrinter
from UnityPy.enums import TextureFormat

RED = re.compile(r"https?://|www\.|\.(com|net|io|ru|cn)\b|admob|unityads|facebook|firebase|appsflyer|onesignal", re.I)


def mb(n):
    return f"{n / 1048576:,.1f} MB"


def titulo(t):
    print(f"\n== {t}")


def paquete(z: zipfile.ZipFile):
    xml = AXMLPrinter(z.read("AndroidManifest.xml")).get_xml().decode("utf-8", "replace")
    m = lambda p: re.findall(p, xml)
    titulo("paquete")
    print("  nombre:", *m(r'package="([^"]+)"'), "| versión:", *m(r'versionName="([^"]+)"'),
          "| SDK mín/obj:", *m(r'minSdkVersion="(\d+)"'), "/", *m(r'targetSdkVersion="(\d+)"'))
    print("  permisos:", ", ".join(p.split(".")[-1] for p in m(r'uses-permission[^>]*name="([^"]+)"')) or "ninguno")
    print("  pide hardware:", ", ".join(f"{n}{'' if r != 'false' else ' (opcional)'}"
                                        for n, r in m(r'uses-feature android:name="([^"]+)"(?: android:required="(\w+)")?')))
    for tipo in ("activity", "service", "receiver", "provider"):
        nombres = m(rf'<{tipo}\b[^>]*android:name="([^"]+)"')
        if nombres:
            print(f"  {tipo}:", ", ".join(nombres))
    libs = collections.Counter(n.split("/")[1] for n in z.namelist() if n.startswith("lib/"))
    print("  ABIs:", ", ".join(f"{a} ({c} libs)" for a, c in libs.items()) or "ninguna",
          "" if "arm64-v8a" in libs else "← sin arm64: no instala en teléfonos sólo de 64 bits")
    print("  bibliotecas:", ", ".join(sorted({Path(n).name for n in z.namelist() if n.startswith("lib/")})))
    cert = next((n for n in z.namelist() if re.match(r"META-INF/.*\.(RSA|DSA|EC)$", n)), None)
    if cert:
        r = subprocess.run(["openssl", "pkcs7", "-inform", "DER", "-print_certs"], input=z.read(cert), capture_output=True)
        f = subprocess.run(["openssl", "x509", "-noout", "-subject", "-startdate"], input=r.stdout, capture_output=True)
        print("  firma:", " | ".join(f.stdout.decode().split("\n")).strip(" |") or "(no se pudo leer)")
    # el dex: paquetes de Java (un SDK de publicidad o de rastreo se ve acá)
    for dex in sorted(n for n in z.namelist() if re.match(r"classes\d*\.dex$", n)):
        d = z.read(dex)
        n_str, off_str = struct.unpack_from("<II", d, 0x38)
        n_typ, off_typ = struct.unpack_from("<II", d, 0x40)

        def cadena(k):
            o = struct.unpack_from("<I", d, off_str + 4 * k)[0]
            while d[o] & 0x80:
                o += 1
            o += 1
            return d[o:d.index(b"\0", o)].decode("utf-8", "replace")
        tipos = [cadena(struct.unpack_from("<I", d, off_typ + 4 * k)[0]) for k in range(n_typ)]
        propios = collections.Counter(".".join(t[1:].split("/")[:3]) for t in tipos
                                      if t.startswith("L") and not re.match(r"L(java|javax|android|dalvik|kotlin|org/(json|xml|w3c))/", t))
        print(f"  {dex}: {len(d):,} bytes; paquetes propios:", ", ".join(f"{p} ({c})" for p, c in propios.most_common(12)))
        sosp = sorted({c for c in map(cadena, range(n_str)) if RED.search(c)})
        if sosp:
            print("    cadenas con red:", " | ".join(s[:80] for s in sosp[:15]))


def ensamblados(managed: Path):
    titulo("código (Mono: se puede decompilar con ILSpy / AssetRipper)")
    for dll in sorted(managed.glob("*.dll"), key=lambda p: -p.stat().st_size):
        if re.match(r"(UnityEngine|System|mscorlib|netstandard|Mono\.|Unity\.)", dll.name):
            continue
        pe = dnfile.dnPE(str(dll))
        t = pe.net.mdtables
        tipos = t.TypeDef.rows if t.TypeDef else []
        ns = collections.Counter(str(x.TypeNamespace) or "(global)" for x in tipos)
        print(f"  {dll.name}: {mb(dll.stat().st_size)}, {len(tipos):,} tipos, {t.MethodDef.num_rows if t.MethodDef else 0:,} métodos")
        print("    espacios de nombres:", ", ".join(f"{n} ({c})" for n, c in ns.most_common(10)))
        datos, off, cads = bytes(pe.net.user_strings.__data__) if pe.net.user_strings else b"", 1, set()
        while off < len(datos):
            b = datos[off]
            n, h = ((b, 1) if b < 0x80 else (((b & 0x3F) << 8) | datos[off + 1], 2) if b & 0xC0 == 0x80
                    else (((b & 0x1F) << 24) | (datos[off + 1] << 16) | (datos[off + 2] << 8) | datos[off + 3], 4))
            s = datos[off + h:off + h + n - 1].decode("utf-16-le", "replace") if n else ""
            if RED.search(s):
                cads.add(s)
            off += h + n
        if cads:
            print("    cadenas con red:", " | ".join(sorted(c[:70] for c in cads)[:12]))


def datos_unity(carpeta: Path):
    env = UnityPy.load(str(carpeta))
    titulo("datos de Unity")
    version = None
    for obj in env.objects:
        if obj.type.name == "BuildSettings":
            d = obj.read()
            version = getattr(d, "m_Version", None)
            print("  Unity", version, "| escenas:", ", ".join(Path(s).stem for s in (getattr(d, "scenes", None) or [])))
            break
    tipos, bytes_tipo = collections.Counter(), collections.Counter()
    por_archivo = collections.defaultdict(collections.Counter)
    tex, malla_v, audio = collections.defaultdict(lambda: [0, 0]), 0, []
    for obj in env.objects:
        t = obj.type.name
        tipos[t] += 1
        bytes_tipo[t] += obj.byte_size
        por_archivo[Path(obj.assets_file.name).name if obj.assets_file else "?"][t] += 1
        try:
            if t == "Texture2D":
                d = obj.read()
                try:
                    f = TextureFormat(int(d.m_TextureFormat)).name
                except ValueError:
                    f = str(d.m_TextureFormat)
                tex[f][0] += 1
                tex[f][1] += getattr(d, "m_CompleteImageSize", 0) or 0
            elif t == "Mesh":
                d = obj.read()
                v = getattr(d, "m_VertexCount", None)
                malla_v += v if v is not None else getattr(getattr(d, "m_VertexData", None), "m_VertexCount", 0)
            elif t == "AudioClip":
                d = obj.read()
                audio.append((d.m_Length, d.m_Channels, d.m_Frequency, getattr(d, "m_LoadType", None)))
        except Exception:
            tipos[f"(no se pudo leer: {t})"] += 1
    print(f"  {sum(tipos.values()):,} objetos en {len(env.files)} archivos")
    for t, c in tipos.most_common(14):
        print(f"    {c:9,}  {mb(bytes_tipo[t]):>10}  {t}")
    print("  escenas y archivos más grandes (objetos | GameObject):")
    for f, c in sorted(por_archivo.items(), key=lambda x: -sum(x[1].values()))[:6]:
        print(f"    {f:34} {sum(c.values()):9,} | {c['GameObject']:,}")
    print("  texturas:", ", ".join(f"{f} {c:,} ({mb(b)})" for f, (c, b) in sorted(tex.items(), key=lambda x: -x[1][1])))
    print(f"  mallas: {tipos['Mesh']:,}, {malla_v:,} vértices")
    if audio:
        pcm = sum(a[0] * a[1] * a[2] * 4 for a in audio)
        largos = [a for a in audio if a[0] >= 60]
        print(f"  audio: {len(audio)} clips, {sum(a[0] for a in audio) / 60:.1f} min "
              f"({len(largos)} de 1 min o más: {sum(a[0] for a in largos) / 60:.1f} min); "
              f"en streaming: {sum(1 for a in audio if a[3] == 2)}")
        print(f"    decodificado a float32 como WebAudio (Unity WebGL lo hace con todo lo que carga): {mb(pcm)}")


def main():
    apk = Path(sys.argv[1]).resolve()
    trabajo = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else apk.with_name(apk.stem + "-datos")
    z = zipfile.ZipFile(apk)
    print(f"{apk.name}: {mb(apk.stat().st_size)} ({mb(sum(i.file_size for i in z.infolist()))} descomprimido, {len(z.infolist()):,} entradas)")
    paquete(z)
    nombres = z.namelist()
    if any(n.endswith("libil2cpp.so") for n in nombres):
        titulo("código: IL2CPP (compilado a nativo; con Il2CppDumper salen los nombres, no el C#)")
    datos = [n for n in nombres if n.startswith("assets/bin/Data/")]
    if not datos:
        print("\n(no tiene assets/bin/Data: no es un APK de Unity, o los datos están en un .obb aparte)")
        return
    if not (trabajo / "assets/bin/Data/globalgamemanagers").exists():
        z.extractall(trabajo, datos)
    carpeta = trabajo / "assets/bin/Data"
    if (carpeta / "Managed").exists():
        ensamblados(carpeta / "Managed")
    datos_unity(carpeta)


if __name__ == "__main__":
    main()
