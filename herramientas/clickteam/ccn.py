#!/usr/bin/env python3
"""Saca los datos de un juego de Clickteam Fusion y los deja listos para el motor web.

    python3 -I ccn.py application.ccn SALIDA/ [--raw DIR_res_raw] [--calidad 86] [--sin-medios]

Lee el `application.ccn` de un APK de Android hecho con Clickteam (está en
`res/raw/`; los sonidos quedan al lado, como `res/raw/sNNNN.wav`) y escribe:

    SALIDA/datos/juego.json    pantallas, capas, instancias, eventos, objetos y
                               las tablas de imágenes, sonidos y fuentes
    SALIDA/datos/img/N.webp    cada imagen del banco, con su número (handle)
    SALIDA/datos/snd/N.ogg     cada sonido

El formato de juego.json es a propósito el mismo del port de FNaF 2 que hizo
otra sesión: así el mismo motor corre los dos juegos, y eso es una prueba
cruzada de que el motor y el extractor entienden Clickteam y no "a FNaF 4".
Lo que ese formato no tenía y hace falta se agrega con claves nuevas
(`vals`, `strs`, `ext_nombre`, `forma`), sin cambiar el significado de las viejas.

Lo que se aprendió del formato (y no está escrito en ningún lado):
- La cabecera es la de siempre ("PAMU" = Unicode) y los bloques no vienen ni
  comprimidos ni encriptados.
- Los objetos usan el diseño VIEJO de propiedades aunque el build sea 284, con
  dos campos cambiados de lugar (extensión 2.º, animaciones después de los
  calificadores), y la cabecera común mide 70 bytes.
- Las capas guardan el paralaje en punto fijo 16.16, no en float.
- Imágenes: zlib con píxeles crudos. Formato 0 = RGBA 8888; formato 3 = RGB 888
  con cada fila rellenada a múltiplo de 4 bytes y sin transparencia.
- Cuadros por segundo: AppHeader +104. Justo antes (+100) está la cantidad de
  pantallas; leer un campo antes dejó a FNaF 2 con "27 cps" (ver PORTEO.md §13).
"""
import argparse
import json
import os
import struct
import subprocess
import sys
import zlib
from pathlib import Path


# ─────────────────────────────── lectura ───────────────────────────────

class Lector:
    def __init__(self, datos, pos=0):
        self.d = datos
        self.p = pos

    def _u(self, fmt):
        v = struct.unpack_from(fmt, self.d, self.p)[0]
        self.p += struct.calcsize(fmt)
        return v

    def u8(self): return self._u("<B")
    def i8(self): return self._u("<b")
    def u16(self): return self._u("<H")
    def i16(self): return self._u("<h")
    def u32(self): return self._u("<I")
    def i32(self): return self._u("<i")
    def f64(self): return self._u("<d")

    def crudo(self, n):
        v = self.d[self.p:self.p + n]
        self.p += n
        return v

    def cadena(self):
        """UTF-16 terminada en 0 (el formato "PAMU" es Unicode)."""
        fin = self.p
        while self.d[fin:fin + 2] != b"\0\0":
            fin += 2
        v = self.d[self.p:fin].decode("utf-16-le", "replace")
        self.p = fin + 2
        return v

    def color(self):
        return list(self.crudo(4))


def bloques(d, ini, fin):
    """(id, datos) de cada bloque entre ini y fin. Flags 1 = zlib; 2 = encriptado."""
    p = ini
    while p + 8 <= fin:
        cid, fl, tam = struct.unpack_from("<HHI", d, p)
        datos = d[p + 8:p + 8 + tam]
        if fl & 2:
            raise SystemExit(f"el bloque {cid:#x} viene encriptado: no soportado")
        if fl & 1:
            # comprimido: tamaño real (4) + tamaño comprimido (4) + zlib
            datos = zlib.decompress(datos[8:])
        yield cid, datos
        p += 8 + tam
        if cid == 0x7F7F:
            break


def hexa(b):
    return b.hex()


# ─────────────────────────────── eventos ───────────────────────────────

# Códigos de parámetro que son una expresión (comparación + tokens). El 15
# ("velocidad") también: guardado en crudo, "cambiar velocidad" quedaba en 0
# (le pasaba al port de FNaF 2 de otra sesión).
P_EXPRESION = {15, 22, 23, 27, 28, 45, 46, 52, 53, 54, 59, 62, 63}
P_POSICION = {16, 21}  # 21 = posición de "crear" del sistema


def leer_posicion(L):
    return {
        "oiPadre": L.u16(), "fl": L.u16(), "x": L.i16(), "y": L.i16(),
        "pendiente": L.i16(), "angulo": L.i16(), "dir": L.i32(),
        "tipoPadre": L.i16(), "oilPadre": L.i16(), "capa": L.i16(),
    }


def leer_expresion(L, fin):
    """Tokens hasta el FIN (0,0). Cada token: [tipo, num, ...datos]."""
    toks = []
    while L.p + 4 <= fin:
        t, n = L.i16(), L.i16()
        if t == 0 and n == 0:
            break
        ini = L.p - 4
        tam = L.u16()
        tok = [t, n]
        if t == 0:
            pass  # operador: + - * / mod pot y o xor
        elif t == -1:
            if n == 0:
                tok.append(L.i32())
            elif n == 3:
                tok.append(L.cadena())
            elif n == 23:
                tok.append(L.f64())
            elif n in (24, 50):  # valor / cadena global: índice
                tok.append(L.i16())
        elif t >= 0 or t == -7:
            tok += [L.u16(), L.i16()]  # objeto, lista de objetos
            if n in (16, 19) and tam > 10:  # valor / cadena alterable: índice
                tok.append(L.i16())
            elif tam > 10:
                tok.append(hexa(L.crudo(ini + tam - L.p)))
        L.p = ini + tam
        toks.append(tok)
    return toks


def leer_parametro(L):
    ini = L.p
    tam, cod = L.u16(), L.i16()
    fin = ini + tam
    if cod == 1:
        v = {"oil": L.u16(), "oi": L.u16(), "tipo": L.i16()}
    elif cod == 2:
        v = {"ms": L.i32(), "vueltas": L.i32()}
    elif cod in (6, 7):
        v = {"h": L.u16(), "fl": L.u16(), "nombre": L.cadena()}
    elif cod == 9:
        v = leer_posicion(L)
        L.u16()  # instancia (no se usa)
        v["oi"] = L.u16()
    elif cod in P_POSICION:
        v = leer_posicion(L)
    elif cod in P_EXPRESION:
        comp = L.i16()
        v = [comp, leer_expresion(L, fin)]
    elif cod == 24:
        v = L.color()
    elif cod == 40:
        v = L.cadena()
    else:
        datos = L.d[L.p:fin]
        primero = struct.unpack_from("<h", datos)[0] if len(datos) >= 2 else 0
        v = [primero, hexa(datos)]
    L.p = fin
    return [cod, v]


def leer_evento(L, es_cond):
    ini = L.p
    tam = L.u16()
    t, n = L.i16(), L.i16()
    oi, oil = L.u16(), L.i16()
    fl, otros, npar, deftipo = L.u8(), L.u8(), L.u8(), L.u8()
    if es_cond:
        L.i16()  # identificador
    params = [leer_parametro(L) for _ in range(npar)]
    L.p = ini + tam
    return [t, n, oi, oil, fl, otros] + params


def leer_eventos(datos):
    L = Lector(datos)
    eventos, qual = [], []
    while L.p + 4 <= len(datos):
        marca = L.crudo(4)
        if marca == b"ER>>":
            L.u16(); L.u16(); L.u16()          # máx. objetos, máx. infos, jugadores
            [L.u16() for _ in range(17)]       # condiciones por tipo de objeto
            for _ in range(L.u16()):           # calificadores
                qual.append([L.u16(), L.i16()])
        elif marca == b"ERes":
            L.u32(); L.u32()  # tamaño total y cantidad de eventos
        elif marca == b"ERev":
            # Después del tamaño viene la cantidad de grupos: se leen por
            # cantidad, que es lo que hace el runtime de Clickteam.
            L.u32()
            for _ in range(L.u32()):
                ini = L.p
                tam = -L.i16()
                nc, na = L.u8(), L.u8()
                fl = L.u16()
                L.p = ini + 16
                c = [leer_evento(L, True) for _ in range(nc)]
                a = [leer_evento(L, False) for _ in range(na)]
                eventos.append({"fl": fl, "c": c, "a": a})
                L.p = ini + tam
        elif marca == b"<<ER":
            break
        else:
            L.p += L.u32()  # ERop, ERfp, ERft...: opciones que el motor no usa
    return eventos, qual


# ─────────────────────────────── objetos ───────────────────────────────

def leer_forma(L):
    f = {"borde": L.u16(), "colorBorde": L.color(), "tipo": L.u16(), "relleno": L.u16()}
    if f["tipo"] == 1:
        f["linea"] = L.u16()
    elif f["relleno"] == 1:
        f["color"] = L.color()
    elif f["relleno"] == 2:
        f["color"], f["color2"], f["vertical"] = L.color(), L.color(), L.u32()
    elif f["relleno"] == 3:
        f["img"] = L.u16()
    return f


def leer_movimientos(d, base):
    L = Lector(d, base)
    movs = []
    n = L.u32()
    for k in range(n):
        L.p = base + 4 + k * 16
        L.u32(); L.u32()
        nuevo, tam = L.u32(), L.u32()
        M = Lector(d, base + nuevo)
        m = {"ctl": M.i16(), "t": M.i16(), "mueve": M.u8()}
        M.p += 3
        m["opt"] = 0
        m["dir"] = M.u32()
        resto = tam - 12
        if m["t"] == 5:  # trayectoria
            ini = M.p
            np = M.u16()
            m["vmin"], m["vmax"] = M.i16(), M.i16()
            m["bucle"], m["repos"], m["rev"] = M.u8(), M.u8(), M.u8()
            M.p += 1
            pasos = []
            for _ in range(np):
                p0 = M.p
                M.u8()
                ptam = M.u8()
                v, dr = M.u8(), M.u8()
                dx, dy = M.i16(), M.i16()
                M.i16(); M.i16()  # coseno, seno
                largo, pausa = M.i16(), M.i16()
                pasos.append({"v": v, "dir": dr, "dx": dx, "dy": dy, "l": largo, "pausa": pausa})
                M.p = p0 + ptam
            m["pasos"] = pasos
        elif m["t"] != 0 and resto > 0:
            crudo = d[M.p:M.p + resto]
            m["crudo"] = hexa(crudo)
            m["v"] = list(struct.unpack_from("<%dh" % (len(crudo) // 2), crudo))
        movs.append(m)
    return movs


def leer_animaciones(d, base):
    L = Lector(d, base)
    L.u16()
    n = L.u16()
    offs = [L.i16() for _ in range(n)]
    anims = {}
    for i, o in enumerate(offs):
        if o == 0:
            continue
        ia = base + o
        A = Lector(d, ia)
        dirs = [A.i16() for _ in range(32)]
        dd = {}
        for j, od in enumerate(dirs):
            if od == 0:
                continue
            D = Lector(d, ia + od)
            vmin, vmax, rep, vuelve = D.u8(), D.u8(), D.i16(), D.i16()
            cuadros = [D.i16() for _ in range(D.u16())]
            dd[str(j)] = {"vmin": vmin, "vmax": vmax, "rep": rep, "vuelve": vuelve, "cuadros": cuadros}
        if dd:
            anims[str(i)] = dd
    return anims


def leer_comun(d, tipo, o):
    """Propiedades de los objetos con 'OCI' (tipo >= 2). Diseño viejo; ver arriba."""
    L = Lector(d)
    L.u32()
    # En el runtime de Android el 2.º campo es la EXTENSIÓN y las animaciones van
    # después de los calificadores: al revés que en lo publicado sobre el .exe.
    # Leídos al revés, los 144 sprites de FNaF 4 quedaban sin animaciones.
    off_mov, off_ext, _ver, off_cont, off_sis = L.u16(), L.u16(), L.u16(), L.u16(), L.u16()
    L.u16()
    o["cfl"] = L.u32()
    qual = [L.i16() for _ in range(8)]
    o["qual"] = [q for q in qual if q != -1]
    off_anim, off_val, off_str = L.u16(), L.u16(), L.u16()
    o["nfl"] = L.u16()
    o["pref"] = L.u16()
    o["ident"] = L.crudo(4).decode("latin-1")
    o["fondoColor"] = L.color()
    L.u32(); L.u32()  # transiciones de entrada / salida del objeto (FNaF no las usa)
    # "Visible al empezar" es el bit 3 de los new flags; el bit 2 es "colisión
    # por caja" (sin él, Clickteam choca por la máscara de píxeles).
    o["visible"] = bool(o["nfl"] & 8)
    if off_mov:
        o["movs"] = leer_movimientos(d, off_mov)
    if off_anim:
        o["anims"] = leer_animaciones(d, off_anim)
    if off_val:
        V = Lector(d, off_val)
        o["vals"] = [V.i32() for _ in range(V.u16())]
    if off_str:
        S = Lector(d, off_str)
        o["strs"] = [S.cadena() for _ in range(S.u16())]
    if off_cont:
        C = Lector(d, off_cont)
        C.u16()
        o["ini"], o["min"], o["max"] = C.i32(), C.i32(), C.i32()
    if off_ext:
        E = Lector(d, off_ext)
        tam = E.u32()
        E.u32()
        o["extVer"], o["extId"], o["extPriv"] = E.u32(), E.u32(), E.u32()
        o["ext"] = hexa(d[E.p:E.p + max(0, tam - 20)])
    if off_sis:
        Y = Lector(d, off_sis)
        if tipo in (3, 4):  # texto, pregunta
            base = Y.p
            Y.u32()
            o["w"], o["h"] = Y.i32(), Y.i32()
            offs = [Y.u32() for _ in range(Y.u32())]
            parr = []
            for po in offs:
                P = Lector(d, base + po)
                parr.append({"fuente": P.u16(), "fl": P.u16(), "color": P.color(), "texto": P.cadena()})
            o["parrafos"] = parr
        elif tipo in (5, 6, 7):  # puntaje, vidas, contador
            Y.u32()
            o["w"], o["h"] = Y.i32(), Y.i32()
            Y.i16()
            o["mostrar"] = Y.i16()
            o["cfl2"] = Y.i16()
            o["fuente"] = Y.i16()
            if o["mostrar"] in (1, 4):
                o["imgs"] = [Y.i16() for _ in range(Y.i16())]
            elif o["mostrar"] in (2, 3, 5):
                forma = leer_forma(Y)
                o["forma"] = forma
                o["color"] = forma.get("color", forma.get("colorBorde"))
        else:
            o["sis"] = hexa(d[off_sis:off_sis + 64])


def leer_objetos(datos, extensiones):
    L = Lector(datos)
    objs = {}
    n = L.u32()
    p = 4
    for _ in range(n):
        o, props, tipo = {}, None, None
        while True:
            cid, fl, tam = struct.unpack_from("<HHI", datos, p)
            sub = datos[p + 8:p + 8 + tam]
            if fl & 1:
                sub = zlib.decompress(sub[8:])
            p += 8 + tam
            if cid == 0x4444:
                H = Lector(sub)
                h, tipo, ofl, _res = H.u16(), H.i16(), H.u16(), H.u16()
                o.update({"t": tipo, "tinta": H.u32(), "tp": H.u32(), "fl": ofl})
                o["_h"] = h
            elif cid == 0x4445:
                o["n"] = sub.decode("utf-16-le").rstrip("\0")
            elif cid == 0x4446:
                props = sub
            elif cid == 0x7F7F:
                break
        h = o.pop("_h")
        if tipo in (0, 1):
            P = Lector(props)
            P.u32()
            o["obst"], o["col"] = P.u16(), P.u16()
            o["w"], o["h"] = P.i32(), P.i32()
            if tipo == 1:
                o["img"] = P.u16()
            else:
                o["forma"] = leer_forma(P)
        elif props is not None:
            leer_comun(props, tipo, o)
        if tipo >= 32:
            o["ext_nombre"] = extensiones.get(tipo, "")
        # orden de claves como el de FNaF 2, para que los dos JSON se puedan comparar
        objs[str(h)] = {"n": o.pop("n", ""), **o}
    return objs


# ─────────────────────────────── pantallas ───────────────────────────────

def leer_frame(datos):
    f = {"capas": [], "inst": [], "eventos": [], "qual": []}
    for cid, sub in bloques(datos, 0, len(datos)):
        L = Lector(sub)
        if cid == 0x3334:
            f["w"], f["h"] = L.i32(), L.i32()
            f["fondo"] = L.color()
            f["fl"] = L.u32()
        elif cid == 0x3335:
            f["nombre"] = sub.decode("utf-16-le").rstrip("\0")
        elif cid == 0x3341:
            for _ in range(L.u32()):
                fl = L.u32()
                xc, yc = L.i32() / 65536, L.i32() / 65536  # punto fijo 16.16
                L.u32(); L.u32()
                f["capas"].append({"fl": fl, "xc": xc, "yc": yc, "n": L.cadena()})
        elif cid == 0x3338:
            for _ in range(L.u32()):
                h, oi, x, y = L.u16(), L.u16(), L.i32(), L.i32()
                pt, ph, capa = L.i16(), L.i16(), L.i16()
                L.i16()
                f["inst"].append({"h": h, "oi": oi, "x": x, "y": y, "capa": capa, "padre": [pt, ph]})
        elif cid in (0x333B, 0x333C):
            L.crudo(8)  # módulo y nombre ("STDT", "FADE"...)
            ms, fl, color = L.i32(), L.u32(), L.color()
            f["fadeIn" if cid == 0x333B else "fadeOut"] = {"ms": ms, "fl": fl, "color": color}
        elif cid == 0x333D:
            f["eventos"], f["qual"] = leer_eventos(sub)
    return f


# ─────────────────────────────── medios ───────────────────────────────

def imagenes(datos, carpeta, calidad, escribir):
    from PIL import Image
    L = Lector(datos)
    L.u16()
    n = L.u16()
    tabla, crudo_total = {}, 0
    for _ in range(n):
        h, fmt, _fl, w, hh = L.u16(), L.u16(), L.u16(), L.u16(), L.u16()
        xs, ys, xa, ya = L.i16(), L.i16(), L.i16(), L.i16()
        comp = L.crudo(L.u32())
        tabla[str(h)] = [w, hh, xs, ys, xa, ya]
        crudo_total += len(comp)
        if not escribir:
            continue
        px = zlib.decompress(comp)
        if fmt == 0:
            img = Image.frombytes("RGBA", (w, hh), px)
        elif fmt == 3:
            paso = (w * 3 + 3) & ~3
            img = Image.frombytes("RGB", (w, hh), px, "raw", "RGB", paso)
        else:
            raise SystemExit(f"imagen {h}: formato {fmt} desconocido")
        destino = carpeta / f"{h}.webp"
        if img.mode == "RGBA" and img.getextrema()[3][0] == 255:
            img = img.convert("RGB")  # alfa entero opaco: no vale la pena guardarlo
        img.save(destino, "WEBP", quality=calidad, method=6, alpha_quality=100)
    return tabla, crudo_total


def sonidos(datos, raw, carpeta, escribir):
    L = Lector(datos)
    L.u16()
    n = L.u16()
    tabla = {}
    for _ in range(n):
        h, fl, ms, hz = L.u16(), L.u16(), L.u32(), L.u32()
        tabla[str(h)] = f"s{h:04d}"
        if not escribir:
            continue
        origen = Path(raw) / f"s{h:04d}.wav"
        if not origen.exists():
            print(f"  falta {origen}", file=sys.stderr)
            continue
        # Opus: el mismo tamaño que MP3 con la mitad de bits, y lo decodifican
        # Chrome y el WebView de Android. Las voces a 8 kHz no necesitan más.
        kbps = "32k" if hz <= 11025 else "64k"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(origen), "-c:a", "libopus", "-b:a", kbps,
                        "-vbr", "on", "-application", "audio", str(carpeta / f"{h}.ogg")], check=True)
    return tabla


def fuentes(datos):
    L = Lector(datos)
    tabla = {}
    for _ in range(L.u32()):
        h = L.u32()
        L.u32(); L.u32(); L.u32()  # suma de control, referencias, tamaño
        alto, _ancho, _e, _o, peso = L.i32(), L.i32(), L.i32(), L.i32(), L.i32()
        italica = L.u8()
        L.crudo(7)
        cara = L.crudo(64).decode("utf-16-le").split("\0")[0]
        tabla[str(h)] = [alto, peso, italica, cara]
    return tabla


# ─────────────────────────────── todo ───────────────────────────────

def extraer(ccn, salida, raw=None, calidad=86, escribir=True):
    d = Path(ccn).read_bytes()
    if d[:4] not in (b"PAMU", b"PAME"):
        raise SystemExit("no es un .ccn de Clickteam (falta PAMU/PAME)")
    app, extensiones, handles, objs, frames = {}, {}, [], {}, []
    medios = {}
    for cid, sub in bloques(d, 16, len(d)):
        L = Lector(sub)
        if cid == 0x2223:
            L.p = 12
            app["w"], app["h"] = L.i16(), L.i16()
            L.p = 100
            app["pantallas"] = L.i32()
            app["fps"] = L.i32()  # +104: ver la nota del principio
        elif cid == 0x2224:
            app["titulo"] = sub.decode("utf-16-le").rstrip("\0")
        elif cid == 0x2234:
            n = L.u16(); L.u16()
            for _ in range(n):
                ini = L.p
                tam, h = L.i16(), L.i16()
                L.u32(); L.u32(); L.u32()
                extensiones[32 + h] = L.cadena().rsplit(".", 1)[0].lower()
                L.p = ini + tam
        elif cid == 0x222B:
            handles = [L.i16() for _ in range(len(sub) // 2)]
        elif cid == 0x2229:
            objs = leer_objetos(sub, extensiones)
        elif cid == 0x3333:
            frames.append(leer_frame(sub))
        elif cid in (0x6666, 0x6667, 0x6668):
            medios[cid] = sub
    salida = Path(salida)
    (salida / "datos" / "img").mkdir(parents=True, exist_ok=True)
    (salida / "datos" / "snd").mkdir(parents=True, exist_ok=True)
    imgs, crudo = imagenes(medios[0x6666], salida / "datos" / "img", calidad, escribir)
    snd = sonidos(medios.get(0x6668, b"\0\0\0\0"), raw or Path(ccn).parent, salida / "datos" / "snd", escribir)
    J = {
        "app": app, "handles": handles, "frames": frames, "objetos": objs,
        "fuentes": fuentes(medios[0x6667]) if 0x6667 in medios else {},
        "imgs": imgs, "sonidos": snd,
        "extensiones": {str(k): v for k, v in extensiones.items()},
    }
    (salida / "datos" / "juego.json").write_text(json.dumps(J, ensure_ascii=False, separators=(",", ":")), "utf-8")
    return J, crudo


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ccn")
    ap.add_argument("salida")
    ap.add_argument("--raw", help="carpeta con los sNNNN.wav (default: la del .ccn)")
    ap.add_argument("--calidad", type=int, default=86, help="calidad WebP (default 86)")
    ap.add_argument("--sin-medios", action="store_true", help="sólo juego.json, sin convertir imágenes ni sonidos")
    a = ap.parse_args()
    J, crudo = extraer(a.ccn, a.salida, a.raw, a.calidad, not a.sin_medios)
    nev = sum(len(f["eventos"]) for f in J["frames"])
    print(f"{J['app'].get('titulo')}: {len(J['frames'])} pantallas, {nev} eventos, {len(J['objetos'])} objetos, "
          f"{len(J['imgs'])} imágenes ({crudo / 1048576:.1f} MB en el .ccn), {len(J['sonidos'])} sonidos, "
          f"{J['app']['w']}×{J['app']['h']} a {J['app']['fps']} cps, extensiones {J['extensiones']}")


if __name__ == "__main__":
    main()
