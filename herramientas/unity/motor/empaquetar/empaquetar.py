#!/usr/bin/env python3
"""Arma el HTML único de un juego portado con el motor: el código (.NET y JS) y todos los datos
(paquetes y recursos) adentro de un solo .html, comprimidos con LZMA y sin perder nada.

    python3 -I empaquetar.py WEB DATOS SALIDA.html [--orden orden.json] [--bloque 32] [--procesos 4]

WEB es la publicación de Web/ (la carpeta wwwroot, con _framework), DATOS la salida de exportar.py
(indice.json, paquetes/, recursos/). --orden es la lista de recursos en el orden en que el motor
los usó (globalThis.porteoOrden en una partida por la red): lo primero que se usa va primero en el
archivo, así el juego arranca mientras el resto se sigue leyendo. Un "|" en la lista corta ahí los
bloques: lo de antes (lo que usa el menú, por ejemplo) queda en bloques propios y el menú no espera
bloques de 8 MB que traen también la primera escena. Con un corte, la pantalla de carga sabe cuánto
hay que bajar para el menú (mbMenu: lo de antes del primer corte).

Cómo achica sin perder:
  - LZMA (el de xz, preset 9e) en bloques de --bloque MB, cada bloque de una sola clase de datos y
    con lc/lp/pb a su medida: las texturas ETC son bloques de 8 o 16 bytes y los vértices
    números de 4, y avisarle eso al modelo de LZMA le gana entre 5 y 10%.
  - Índices de mallas en diferencias con el anterior: de 28% pasan a 2%.
  - Vértices por canal (todas las posiciones, después todas las normales, ...): 6% menos.
  - Lo demás tal cual (el audio Ogg casi no comprime: va igual, por prolijidad).
Medido con las alternativas (gzip, zstd -22 --long, brotli 11): LZMA les gana en todo.

El HTML va en UTF-16 (como un-archivo.py): cada carácter lleva dos bytes del archivo tal cual y
sólo se escapan los que el HTML no deja pasar. El arranque (arranque.js) descomprime en
trabajadores con el decodificador de lzma.c compilado a WebAssembly (6 KB). Los datos de terceros
no se ejecutan: se leen y se copian. Correr con python -I.
"""
import argparse
import base64
import hashlib
import json
import lzma
import os
import re
import struct
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / "exportar"))
sys.path.insert(0, str(AQUI))   # con python -I la carpeta del script no está (proxies.py)
from leer import Paquete  # noqa: E402

# lc/lp/pb de LZMA por clase de datos (medido: ver arriba)
PARAMETROS = {
    "codigo": (3, 0, 0),
    "paquetes": (3, 0, 2),
    "bloques16": (0, 4, 4),   # ETC2_RGBA8, EAC_RG, DXT5: bloques de 16 bytes
    "bloques8": (0, 3, 3),    # ETC_RGB4, ETC2_RGB, ETC2_RGBA1, EAC_R, DXT1: bloques de 8 bytes
    "pixeles4": (0, 2, 2),    # RGBA32, ARGB32, BGRA32
    "pixeles": (3, 0, 2),     # RGB24, RGB565, Alpha8...
    "vertices": (1, 2, 2),
    "indices": (0, 1, 1),
    "audio": (4, 0, 0),
    "shaders": (3, 0, 0),
    "otros": (0, 2, 2),
}
FORMATOS = {47: "bloques16", 43: "bloques16", 44: "bloques16", 12: "bloques16",
            34: "bloques8", 45: "bloques8", 46: "bloques8", 41: "bloques8", 42: "bloques8", 10: "bloques8",
            4: "pixeles4", 5: "pixeles4", 14: "pixeles4"}
TAM_CANAL = {0: 4, 1: 2, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2, 9: 2}
OMITIR_WEB = {"index.html"}
ALINEACION = 16   # cada entrada empieza alineada (los índices se leen como Uint16/32Array)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ── qué es cada recurso ─────────────────────────────────────────────────────

def recursos_de(v):
    if isinstance(v, tuple) and v and v[0] == "recurso":
        yield v[1]
    elif isinstance(v, dict):
        for x in v.values():
            yield from recursos_de(x)
    elif isinstance(v, list):
        for x in v:
            yield from recursos_de(x)


def rec(v):
    return v[1] if isinstance(v, tuple) and v and v[0] == "recurso" else None


def analizar(carpeta):
    """id de recurso → (clase de datos, transformación)"""
    info = {}
    for f in sorted(os.listdir(carpeta)):
        p = Paquete((carpeta / f).read_bytes())
        for pid, (cl, sc, _, _) in p.objetos.items():
            if cl in (1, 4, 114):   # GameObject, Transform y MonoBehaviour no tienen recursos grandes propios
                continue
            try:
                o = p.objeto(pid)
            except Exception:
                continue
            if cl == 43:
                malla(o, info)
            for r in recursos_de(o):
                if r in info:
                    continue
                if cl in (28, 89, 117, 187):   # Texture2D, Cubemap, Texture3D, Texture2DArray
                    info[r] = (FORMATOS.get(o.get("m_TextureFormat"), "pixeles"), None)
                elif cl == 83:
                    info[r] = ("audio", None)
                elif cl == 48:
                    info[r] = ("shaders", None)
                else:
                    info[r] = ("otros", None)
    return info


def malla(m, info):
    vd = m.get("m_VertexData") or {}
    n = vd.get("m_VertexCount", 0)
    pasos = [0, 0, 0, 0]
    canales = []
    for c in vd.get("m_Channels") or []:
        d = c["dimension"]
        real = d >> 4 if d >> 4 else d & 15
        if not real:
            continue
        tam = max(real, d & 15) * TAM_CANAL.get(c["format"], 4)
        pasos[c["stream"]] = max(pasos[c["stream"]], c["offset"] + tam)
        canales.append((c["stream"], c["offset"], tam))
    inicios, pos = [0] * 4, 0
    for s in range(4):
        inicios[s] = pos
        pos += pasos[s] * n
        pos = (pos + 15) & ~15
    r = rec(vd.get("m_DataSize"))
    if r is not None and n > 0 and canales:
        info[r] = ("vertices", ("v", n, [(inicios[s], pasos[s], off, tam) for s, off, tam in sorted(canales)]))
    r = rec(m.get("m_IndexBuffer"))
    if r is not None:
        info[r] = ("indices", ("d", 32 if m.get("m_IndexFormat") == 1 else 16))


# ── las transformaciones (arranque.js las deshace) ─────────────────────────

def transformar(datos, trans):
    """(bytes, trans): si no se puede (canales que se pisan o se salen), va tal cual y sin trans"""
    if trans is None:
        return datos, None
    if trans[0] == "d":
        bits = trans[1]
        tam = bits // 8
        n = len(datos) // tam
        a = list(struct.unpack_from(f"<{n}{'H' if bits == 16 else 'I'}", datos))
        m = (1 << bits) - 1
        for i in range(n - 1, 0, -1):
            a[i] = (a[i] - a[i - 1]) & m
        return struct.pack(f"<{n}{'H' if bits == 16 else 'I'}", *a) + datos[n * tam:], trans
    if trans[0] == "v":
        n, canales = trans[1], trans[2]
        largo = len(datos)
        usado = bytearray(largo)
        out = bytearray()
        for ini, paso, off, tam in canales:
            if ini + (n - 1) * paso + off + tam > largo:
                return datos, None
            canal = bytearray(n * tam)
            for k in range(tam):
                canal[k::tam] = datos[ini + off + k: ini + off + k + (n - 1) * paso + 1: paso]
                pisa = usado[ini + off + k: ini + off + k + (n - 1) * paso + 1: paso]
                if any(pisa):
                    return datos, None
                usado[ini + off + k: ini + off + k + (n - 1) * paso + 1: paso] = b"\1" * n
            out += canal
        # los bytes que no son de ningún canal (relleno entre streams), en orden
        i = usado.find(0)
        while i != -1:
            j = usado.find(1, i)
            j = largo if j == -1 else j
            out += datos[i:j]
            i = usado.find(0, j)
        assert len(out) == largo
        return bytes(out), ["v", n, [list(c) for c in canales]]
    raise ValueError(trans)


# ── el audio ────────────────────────────────────────────────────────────────

def optimizar_audio(programa, ids, carpeta, cache):
    """{id: Ogg rearmado} con vorbis-opt (OptiVorbis): los códigos de Huffman óptimos para cada
    archivo y sin comentarios; se decodifica a las mismas muestras (probado en Chromium con los 635
    del juego). Lo que no se pudo o no achicó queda como estaba."""
    import subprocess
    import tempfile
    salida = {}
    pendientes = []
    for rid in ids:
        b = (carpeta / f"{rid}.bin").read_bytes()
        clave = hashlib.sha256(b"vorbis-opt1" + b).hexdigest()
        f = Path(cache) / clave if cache else None
        if f and f.exists():
            o = f.read_bytes()
            if o:
                salida[rid] = o
            continue
        pendientes.append((rid, b, f))
    with tempfile.TemporaryDirectory() as tmp:
        for k in range(0, len(pendientes), 64):
            tanda = pendientes[k:k + 64]
            args = []
            for rid, b, f in tanda:
                args += [str(carpeta / f"{rid}.bin"), f"{tmp}/{rid}.ogg"]
            subprocess.run([programa, *args], capture_output=True)
            for rid, b, f in tanda:
                o = Path(f"{tmp}/{rid}.ogg")
                o = o.read_bytes() if o.exists() else b""
                if not o or len(o) >= len(b):
                    o = b""
                if f:
                    f.write_bytes(o)   # vacío: "no sirvió", para no volver a intentar
                if o:
                    salida[rid] = o
    antes = sum((carpeta / f"{r}.bin").stat().st_size for r in salida)
    log(f"   audio con OptiVorbis: {len(salida)} de {len(ids)}, {antes / 1e6:.1f} → {sum(map(len, salida.values())) / 1e6:.1f} MB")
    return salida


# ── bloques ─────────────────────────────────────────────────────────────────

def comprimir(args):
    i, datos, params, cache = args
    lc, lp, pb = params
    if cache:
        clave = hashlib.sha256(datos + bytes(params)).hexdigest()
        f = Path(cache) / clave
        if f.exists():
            return i, f.read_bytes(), 0.0
    dic = 1 << max(16, (len(datos) - 1).bit_length())
    t = time.time()
    c = lzma.compress(datos, format=lzma.FORMAT_RAW, filters=[{
        "id": lzma.FILTER_LZMA1, "preset": 9 | lzma.PRESET_EXTREME, "lc": lc, "lp": lp, "pb": pb,
        "dict_size": min(dic, 1 << 30)}])
    if cache:
        (Path(cache) / clave).write_bytes(c)
    return i, c, time.time() - t


# ── bytes → texto UTF-16 (igual que herramientas/porteo/un-archivo.py) ──────
# Cada dos bytes son una unidad de 16 bits que va como un carácter. No pasan intactas: 0x0000 (el
# parser la cambia por U+FFFD), 0x000D (se vuelve 0x000A), 0x003C ("<" podría cerrar el <script>)
# y los sustitutos sueltos. Esas van como ESC + código: sustituto s → s − 0xD700; 0x0000 → 0x0900;
# 0x000D → 0x0901; 0x003C → 0x0902; ESC → 0x0903. arranque.js (deco) hace lo inverso.
def _utf16k():
    """El codificador de utf16k.c, compilado una vez por corrida (ctypes)."""
    global _UTF16K
    if _UTF16K is None:
        import ctypes
        import subprocess
        import tempfile
        so = Path(tempfile.mkdtemp(prefix="utf16k-")) / "utf16k.so"
        subprocess.run(["cc", "-O2", "-shared", "-fPIC", "-o", str(so), str(AQUI / "utf16k.c")], check=True)
        lib = ctypes.CDLL(str(so))
        lib.utf16k_codificar.restype = ctypes.c_size_t
        lib.utf16k_codificar.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p]
        _UTF16K = lib
    return _UTF16K


_UTF16K = None


def a_utf16(datos):
    """Los bytes de un bloque como texto: dígitos en base 63485 (los caracteres UTF-16 que el HTML
    deja pasar tal cual) con rANS de símbolos uniformes; ver utf16k.c y deco en arranque.js. Sin
    escapes: 0.29% más que los bytes, en vez del 3.2% de escapar surrogates, NUL, CR y '<'."""
    import ctypes
    if len(datos) % 2:
        datos += b"\0"
    n = len(datos) // 2
    entrada = (ctypes.c_uint16 * n).from_buffer_copy(datos)
    salida = (ctypes.c_uint16 * (n + n // 64 + 8))()
    m = _utf16k().utf16k_codificar(ctypes.addressof(entrada), n, ctypes.addressof(salida))
    return bytes(memoryview(salida).cast("B")[:m * 2]).decode("utf-16-le")


def pantalla_de_carga(a):
    """<script> con la intro de la marca, la pantalla de carga y lo que las une al motor (o nada)."""
    if not a.carga:
        return ""
    porteo = AQUI.parent.parent.parent / "porteo"
    config = json.loads(Path(a.carga).read_text(encoding="utf-8"))
    if a.imagen_carga:
        img = Path(a.imagen_carga)
        tipo = "image/webp" if img.suffix.lower() == ".webp" else "image/png"
        config["imagen"] = f"data:{tipo};base64," + base64.b64encode(img.read_bytes()).decode()
    if a.fondo_carga:
        config["fondo"] = "data:image/webp;base64," + base64.b64encode(fondo_difuminado(a.fondo_carga)).decode()
    if a.registro:
        config["registro"] = a.registro
    if getattr(a, "mb_menu", None):   # medido con el corte de --orden: mejor que el de carga.json
        config["mbMenu"] = a.mb_menu
    pegamento = (AQUI / "pantalla.js").read_text(encoding="utf-8").replace("/*CONFIG*/null", json.dumps(config, ensure_ascii=False))
    # el registro y el escenario primero: los errores de lo que sigue y la pantalla ya horizontal
    partes = [porteo / "registro.js", porteo / "escenario.js", porteo / "intro.js", porteo / "carga.js"]
    js = "\n".join([p.read_text(encoding="utf-8") for p in partes] + [pegamento])
    return f"<script>\n{js}\n</script>\n"


def fondo_difuminado(ruta):
    """La portada para el fondo de la pantalla de carga: 16:9, chica y ya difuminada (en el teléfono
    un filter: blur se recalcula en cada cuadro de la animación). WebP de pocos KB."""
    import io
    from PIL import Image, ImageFilter
    im = Image.open(ruta).convert("RGB")
    w, h = im.size
    if w / h > 16 / 9:
        nw = round(h * 16 / 9); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w * 9 / 16); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((640, 360), Image.LANCZOS).filter(ImageFilter.GaussianBlur(8))
    salida = io.BytesIO()
    im.save(salida, "WEBP", quality=82, method=6)
    log(f"fondo de la pantalla de carga: {len(salida.getvalue()) / 1e3:.1f} KB")
    return salida.getvalue()


def escribir_sitio(carpeta, tabla, comprimidos, web, a):
    """La versión para subir a un sitio: index.html (el arranque con la tabla, sin los datos), cada
    bloque comprimido en b/<hash>.bin (el nombre cambia si cambia el contenido: se puede guardar
    para siempre), sw.js (la página sin red), manifest e íconos (se instala como app) y _headers
    (Netlify y Cloudflare Pages: cuánto guardar cada cosa)."""
    import shutil
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / "b").mkdir(exist_ok=True)
    nombres = set()
    for b, c in zip(tabla["bloques"], comprimidos):
        b["f"] = hashlib.sha256(c).hexdigest()[:20] + ".bin"
        b["c"] = len(c)
        nombres.add(b["f"])
        destino = carpeta / "b" / b["f"]
        if not destino.exists() or destino.stat().st_size != len(c):
            destino.write_bytes(c)
    for f in (carpeta / "b").iterdir():   # los de una versión anterior
        if f.name not in nombres:
            f.unlink()
    tabla["web"] = True
    arranque = (AQUI / "arranque.js").read_text(encoding="utf-8").replace("/*TABLA*/null", json.dumps(tabla, separators=(",", ":")))
    estilo = re.search(r"<style>.*?</style>", (web / "index.html").read_text(encoding="utf-8"), re.S).group(0)
    titulo = a.titulo
    # el manifest con use-credentials: sin eso el navegador lo pide sin cookies aunque sea del mismo
    # sitio, y detrás de una puerta (herramientas/porteo/cloudflare, Cloudflare Access) no llega
    (carpeta / "index.html").write_text(
        "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover\">\n"
        f"<title>{titulo}</title>\n<meta name=\"theme-color\" content=\"#000000\">\n"
        "<link rel=\"manifest\" href=\"manifest.webmanifest\" crossorigin=\"use-credentials\">\n<link rel=\"icon\" href=\"icono-192.png\">\n"
        "<link rel=\"apple-touch-icon\" href=\"icono-192.png\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n"
        "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n"
        f"{estilo}\n</head>\n<body>\n<canvas id=\"lienzo\"></canvas>\n<div id=\"estado\">cargando…</div>\n"
        f"{pantalla_de_carga(a)}<script>\n{arranque}\n</script>\n</body>\n</html>\n", encoding="utf-8")
    shutil.copyfile(AQUI / "sw.js", carpeta / "sw.js")
    manifest = {"name": titulo, "short_name": titulo, "start_url": "./", "scope": "./", "display": "fullscreen",
                "orientation": "landscape", "background_color": "#000000", "theme_color": "#000000",
                "icons": [{"src": "icono-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "icono-512.png", "sizes": "512x512", "type": "image/png"}]}
    (carpeta / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.icono:
        try:
            from PIL import Image
            im = Image.open(a.icono).convert("RGBA")
            for lado in (192, 512):
                im.resize((lado, lado), Image.LANCZOS).save(carpeta / f"icono-{lado}.png")
        except ImportError:
            for lado in (192, 512):
                shutil.copyfile(a.icono, carpeta / f"icono-{lado}.png")
    (carpeta / "_headers").write_text(
        "/b/*\n  Cache-Control: public, max-age=31536000, immutable\n"
        "/index.html\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-cache\n", encoding="utf-8")
    lanzador = (AQUI / "abrir.html").read_text(encoding="utf-8").replace("TITULO", titulo)
    (carpeta / "abrir.html").write_text(lanzador, encoding="utf-8")
    total = sum(len(c) for c in comprimidos)
    log(f"{carpeta}: {len(comprimidos)} bloques, {total / 1e6:.1f} MB; index.html {(carpeta / 'index.html').stat().st_size / 1e3:.0f} KB")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("web")
    ap.add_argument("datos")
    ap.add_argument("salida")
    ap.add_argument("--orden", help="JSON: ids de recursos en el orden en que se usan")
    ap.add_argument("--bloque", type=float, default=32, help="MB por bloque (más grande comprime más)")
    ap.add_argument("--procesos", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--titulo", default="Slime Rancher")
    ap.add_argument("--cache", help="carpeta donde guardar los bloques comprimidos (rearmar es mucho más rápido)")
    ap.add_argument("--sin-proxies", action="store_true", help="no predecir las mallas proxy (proxies.py, necesita numpy)")
    ap.add_argument("--vorbis-opt", help="el ejecutable de vorbis-opt/ (cargo build --release): el audio más chico, mismas muestras")
    ap.add_argument("--sitio", action="store_true", help="en vez del HTML único, la versión para subir a un sitio: SALIDA es una "
                    "carpeta con index.html, los bloques en b/ (bajan a medida que hacen falta y quedan en caché), el service "
                    "worker y el manifest (se instala como app). Conviene con --bloque 8")
    ap.add_argument("--icono", help="PNG cuadrado para la app instalable (--sitio)")
    ap.add_argument("--carga", help="JSON con el título, el aviso de la intro y los consejos: al abrir, la intro de la marca "
                    "y después la pantalla de carga con el personaje girando y \"Saltar\" (ver pantalla.js)")
    ap.add_argument("--imagen-carga", help="la imagen del personaje que gira en la pantalla de carga (webp o png)")
    ap.add_argument("--fondo-carga", help="la portada (una captura del menú, por ejemplo): va difuminada de fondo en la pantalla de carga")
    ap.add_argument("--registro", help="dirección relativa a donde la página manda lo que pasa (errores, teléfono, hitos), "
                    "p. ej. __registro con la puerta de herramientas/porteo/cloudflare")
    a = ap.parse_args()
    web, datos = Path(a.web), Path(a.datos)
    BLOQUE = int(a.bloque * 1048576)
    t0 = time.time()
    if a.cache:   # antes del audio, que también guarda ahí lo que ya optimizó
        Path(a.cache).mkdir(parents=True, exist_ok=True)

    # 1. las entradas: (clave, bytes, clase, trans)
    log("analizando los paquetes…")
    info = analizar(datos / "paquetes")
    entradas = []
    codigo = []
    for f in sorted(web.rglob("*")):
        rel = f.relative_to(web).as_posix()
        if f.is_dir() or rel == "datos" or rel.startswith("datos/") or rel in OMITIR_WEB or f.suffix in (".br", ".gz"):
            continue
        b = f.read_bytes()
        if rel.startswith("_framework/") and f.suffix == ".js":
            # el runtime arma sus URLs relativas a import.meta.url, que acá es un blob: (no sirve
            # de base): se le da la carpeta de la página (los pedidos igual los contesta el arranque)
            b = b.replace(b"import.meta.url", b"(globalThis.porteoBaseDotnet||import.meta.url)")
        codigo.append(("f" + rel, b, "codigo", None))
    codigo.append(("findice.json", (datos / "indice.json").read_bytes(), "codigo", None))
    paquetes = [("p" + f.stem, f.read_bytes(), "paquetes", None) for f in sorted((datos / "paquetes").glob("*.paq"))]

    orden, cortes = [], []
    if a.orden:
        for x in json.loads(Path(a.orden).read_text()):
            if x == "|":
                cortes.append(len(orden))
            else:
                orden.append(int(x))
    posicion = {rid: k for k, rid in enumerate(orden)}
    ids = sorted((int(f.stem) for f in (datos / "recursos").glob("*.bin")), key=lambda r: (posicion.get(r, len(orden)), r))
    # el primer recurso de cada tramo (después de cada "|"): ahí se cierran los bloques abiertos
    cortar, k = set(), 0
    for rid in ids:
        p = posicion.get(rid, len(orden))
        if k < len(cortes) and p >= cortes[k]:
            cortar.add("r%d" % rid)
            while k < len(cortes) and p >= cortes[k]:
                k += 1
    log(f"{len(codigo)} archivos de código, {len(paquetes)} paquetes, {len(ids)} recursos ({len(orden)} con orden de uso)")
    # las mallas proxy, como diferencia con lo que se predice desde otras mallas (proxies.py)
    descs, fuente = {}, None
    if not a.sin_proxies:
        import proxies

        def abrir(n):
            f = datos / "paquetes" / (n + ".paq")
            return Paquete(f.read_bytes()) if f.exists() else None
        log("buscando de qué está hecho cada proxy…")
        descs, fuente = proxies.buscar(abrir, [f.stem for f in (datos / "paquetes").glob("*.paq")],
                                       lambda rid: (datos / "recursos" / f"{rid}.bin").read_bytes(), log)
        if descs:
            cub = sum(sg[1] for d in descs.values() for sg in d["segmentos"])
            log(f"   {len(descs)} proxies: {cub} de {sum(d['n'] for d in descs.values())} vértices se predicen")
    # el audio, con OptiVorbis (vorbis-opt/): mismas muestras, 5% menos
    vorbis = {}
    if a.vorbis_opt:
        vorbis = optimizar_audio(a.vorbis_opt, [r for r in ids if info.get(r, ("",))[0] == "audio"],
                                 datos / "recursos", a.cache)
    sin_trans = 0
    for rid in ids:
        b = vorbis.get(rid) or (datos / "recursos" / f"{rid}.bin").read_bytes()
        clase, trans = info.get(rid, ("otros", None))
        if rid in descs:
            b = proxies.restar(b, descs[rid], fuente)
        b2, trans2 = transformar(b, trans)
        if trans is not None and trans2 is None:
            sin_trans += 1
        if rid in descs:
            trans2 = ["P", str(rid), trans2]
        entradas.append(("r%d" % rid, b2, clase, trans2))
    if sin_trans:
        log(f"   {sin_trans} recursos sin transformar (canales raros)")
    del fuente

    # 2. los bloques: el código primero (para arrancar ya), los paquetes, y los recursos en orden de
    # uso, cada clase en sus bloques (se abre uno nuevo al llenarse)
    bloques = []    # [clase, [entradas], tamaño]
    antes_del_corte = None   # cuántos bloques hay antes del primer corte (lo del menú)

    def agrupar(lista, tope=BLOQUE):
        nonlocal antes_del_corte
        abiertos = {}
        for e in lista:
            if e[0] in cortar:
                abiertos = {}
                if antes_del_corte is None:
                    antes_del_corte = len(bloques)
            clase = e[2]
            b = abiertos.get(clase)
            if b is None or b[2] + len(e[1]) > tope and b[1]:
                b = [clase, [], 0]
                abiertos[clase] = b
                bloques.append(b)
            b[2] = (b[2] + ALINEACION - 1) // ALINEACION * ALINEACION
            b[1].append((e, b[2]))
            b[2] += len(e[1])
    agrupar(codigo, tope=1 << 40)   # el código en un solo bloque: se necesita entero para arrancar
    agrupar(paquetes)
    if descs:   # las recetas de los proxies, en su bloque chico (se leen al armar el primero)
        agrupar([("dproxies", json.dumps({str(k): v for k, v in descs.items()}, separators=(",", ":")).encode(), "codigo", None)])
    agrupar(entradas)
    total = sum(b[2] for b in bloques)
    log(f"{len(bloques)} bloques, {total / 1e6:.1f} MB sin comprimir")

    # 3. comprimir (en paralelo: LZMA 9e va a ~1-2 MB/s por núcleo)
    trabajos = []
    for i, (clase, es, tam) in enumerate(bloques):
        buf = bytearray(tam)
        for e, desde in es:
            buf[desde:desde + len(e[1])] = e[1]
        trabajos.append((i, bytes(buf), PARAMETROS[clase], a.cache))
    comprimidos = [None] * len(bloques)
    hechos = 0
    with ProcessPoolExecutor(a.procesos) as ex:
        for i, c, dt in ex.map(comprimir, sorted(trabajos, key=lambda t: -len(t[1])), chunksize=1):
            comprimidos[i] = c
            hechos += len(trabajos[i][1])
            log(f"   bloque {i} ({bloques[i][0]}): {len(trabajos[i][1]) / 1e6:.1f} → {len(c) / 1e6:.2f} MB en {dt:.0f} s ({hechos * 100 // total}%)")
    del trabajos
    a.mb_menu = None
    if antes_del_corte is not None:
        a.mb_menu = round(sum(len(c) for c in comprimidos[:antes_del_corte]) / 1048576, 1)
        log(f"antes del primer corte (lo del menú): {antes_del_corte} bloques, {a.mb_menu} MB")

    # 4. el HTML
    tabla = {"wasm": base64.b64encode((AQUI / "lzma.wasm").read_bytes()).decode(),
             # k: la clase (en el sitio el audio se baja al final: ver arranque.js)
             "bloques": [{"t": tam, "p": list(PARAMETROS[clase]), "k": clase,
                          "e": [[e[0], desde, len(e[1]), e[3]] for e, desde in es]}
                         for clase, es, tam in bloques]}
    if a.sitio:
        escribir_sitio(Path(a.salida), tabla, comprimidos, web, a)
        return
    arranque = (AQUI / "arranque.js").read_text(encoding="utf-8").replace("/*TABLA*/null", json.dumps(tabla, separators=(",", ":")))
    estilo = re.search(r"<style>.*?</style>", (web / "index.html").read_text(encoding="utf-8"), re.S).group(0)
    partes = ["﻿<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-16\">\n",
              "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover\">\n",
              f"<title>{a.titulo}</title>\n{estilo}\n</head>\n<body>\n<canvas id=\"lienzo\"></canvas>\n<div id=\"estado\">cargando…</div>\n",
              pantalla_de_carga(a) + "<script>\n", arranque, "\n</script>\n"]
    for i, c in enumerate(comprimidos):
        texto = a_utf16(c)
        partes.append(f'<script type="porteo/b" data-i="{i}" data-n="{len(c)}">{texto}</script><script>P.b({i})')
        if i == 0:
            partes.append(";P.arrancar()")
        partes.append("</script>\n")
    partes.append("</body>\n</html>\n")
    # P es el arranque: que los <script> chicos lo encuentren corto
    partes[4] = partes[4] + "\nvar P = globalThis.porteoUnArchivo;"
    html = "".join(partes)
    Path(a.salida).write_bytes(html.encode("utf-16-le", "surrogatepass"))
    tam_html = os.path.getsize(a.salida)
    comp_total = sum(len(c) for c in comprimidos)
    log(f"{a.salida}: {tam_html / 1e6:.1f} MB ({comp_total / 1e6:.1f} MB comprimidos de {total / 1e6:.1f}) en {time.time() - t0:.0f} s")
    por_clase = {}
    for (clase, es, tam), c in zip(bloques, comprimidos):
        x = por_clase.setdefault(clase, [0, 0])
        x[0] += tam
        x[1] += len(c)
    for clase, (t, c) in sorted(por_clase.items(), key=lambda kv: -kv[1][1]):
        log(f"   {clase:10} {t / 1e6:8.1f} → {c / 1e6:7.2f} MB ({c * 100 / t:.1f}%)")


if __name__ == "__main__":
    main()
