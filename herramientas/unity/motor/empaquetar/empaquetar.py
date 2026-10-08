#!/usr/bin/env python3
"""Arma el HTML único de un juego portado con el motor: el código (.NET y JS) y todos los datos
(paquetes y recursos) adentro de un solo .html, comprimidos con LZMA y sin perder nada.

    python3 -I empaquetar.py WEB DATOS SALIDA.html [--orden orden.json] [--bloque 32] [--procesos 4]

WEB es la publicación de Web/ (la carpeta wwwroot, con _framework), DATOS la salida de exportar.py
(indice.json, paquetes/, recursos/). --orden es la lista de recursos en el orden en que el motor
los usó (globalThis.porteoOrden en una partida por la red): lo primero que se usa va primero en el
archivo, así el juego arranca mientras el resto se sigue leyendo.

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
CODIGOS = {0x0000: 0x0900, 0x000D: 0x0901, 0x003C: 0x0902}
CANDIDATOS = [chr(c) for c in range(0xF8FF, 0xF8BF, -1)]


def a_utf16(datos):
    if len(datos) % 2:
        datos += b"\0"
    s = datos.decode("utf-16-le", "surrogatepass")
    esc = min(CANDIDATOS, key=s.count)
    tabla = dict(CODIGOS)
    tabla[ord(esc)] = 0x0903

    def cambiar(m):
        c = ord(m.group())
        return esc + chr(tabla[c] if c in tabla else c - 0xD700)
    return re.sub("[\x00\r<" + esc + "\ud800-\udfff]", cambiar, s), ord(esc)


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
    a = ap.parse_args()
    web, datos = Path(a.web), Path(a.datos)
    BLOQUE = int(a.bloque * 1048576)
    t0 = time.time()

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

    orden = []
    if a.orden:
        orden = [int(x) for x in json.loads(Path(a.orden).read_text())]
    posicion = {rid: k for k, rid in enumerate(orden)}
    ids = sorted((int(f.stem) for f in (datos / "recursos").glob("*.bin")), key=lambda r: (posicion.get(r, len(orden)), r))
    log(f"{len(codigo)} archivos de código, {len(paquetes)} paquetes, {len(ids)} recursos ({len(orden)} con orden de uso)")
    sin_trans = 0
    for rid in ids:
        b = (datos / "recursos" / f"{rid}.bin").read_bytes()
        clase, trans = info.get(rid, ("otros", None))
        b2, trans2 = transformar(b, trans)
        if trans is not None and trans2 is None:
            sin_trans += 1
        entradas.append(("r%d" % rid, b2, clase, trans2))
    if sin_trans:
        log(f"   {sin_trans} recursos sin transformar (canales raros)")

    # 2. los bloques: el código primero (para arrancar ya), los paquetes, y los recursos en orden de
    # uso, cada clase en sus bloques (se abre uno nuevo al llenarse)
    bloques = []    # [clase, [entradas], tamaño]

    def agrupar(lista, tope=BLOQUE):
        abiertos = {}
        for e in lista:
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
    if a.cache:
        Path(a.cache).mkdir(parents=True, exist_ok=True)
    comprimidos = [None] * len(bloques)
    hechos = 0
    with ProcessPoolExecutor(a.procesos) as ex:
        for i, c, dt in ex.map(comprimir, sorted(trabajos, key=lambda t: -len(t[1])), chunksize=1):
            comprimidos[i] = c
            hechos += len(trabajos[i][1])
            log(f"   bloque {i} ({bloques[i][0]}): {len(trabajos[i][1]) / 1e6:.1f} → {len(c) / 1e6:.2f} MB en {dt:.0f} s ({hechos * 100 // total}%)")
    del trabajos

    # 4. el HTML
    tabla = {"wasm": base64.b64encode((AQUI / "lzma.wasm").read_bytes()).decode(),
             "bloques": [{"t": tam, "p": list(PARAMETROS[clase]),
                          "e": [[e[0], desde, len(e[1]), e[3]] for e, desde in es]}
                         for clase, es, tam in bloques]}
    arranque = (AQUI / "arranque.js").read_text(encoding="utf-8").replace("/*TABLA*/null", json.dumps(tabla, separators=(",", ":")))
    estilo = re.search(r"<style>.*?</style>", (web / "index.html").read_text(encoding="utf-8"), re.S).group(0)
    partes = ["﻿<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-16\">\n",
              "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover\">\n",
              f"<title>{a.titulo}</title>\n{estilo}\n</head>\n<body>\n<canvas id=\"lienzo\"></canvas>\n<div id=\"estado\">cargando…</div>\n",
              "<script>\n", arranque, "\n</script>\n"]
    for i, c in enumerate(comprimidos):
        texto, esc = a_utf16(c)
        partes.append(f'<script type="porteo/b" data-i="{i}" data-n="{len(c)}" data-e="{esc}">{texto}</script><script>P.b()')
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
