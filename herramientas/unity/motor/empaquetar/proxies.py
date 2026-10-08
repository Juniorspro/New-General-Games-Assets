"""Mallas que son otras mallas transformadas: se guardan como "predicción + diferencia".

En Slime Rancher cada región tiene una malla "proxy" (lo que se ve de una zona lejana: el componente
Region, con proxyMesh, proxyMaterials y root). Es la combinación de las mallas de los renderers
de su raíz, llevadas al espacio de la región y juntadas por material: 150 de los 178 MB de vértices
del juego. Acá se busca, para cada tramo del proxy, de qué malla y con qué matriz sale; el HTML
guarda la diferencia (en enteros, casi siempre 0 o ±1) y arranque.js la vuelve a armar igual,
bit a bit: los dos lados hacen las mismas cuentas en doble precisión y en el mismo orden.

Las mallas que Unity comprimió (m_CompressedMesh) no sirven de fuente: el proxy salió de la malla
original, antes de cuantizar. Lo que no se encuentra va tal cual (predicción 0).

Necesita numpy; sin numpy no se predice nada (el HTML sale igual, más grande).
"""
import struct

try:
    import numpy as np
except ImportError:   # pragma: no cover
    np = None

TAM_FORMATO = {0: 4, 1: 2, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2, 9: 2, 10: 4, 11: 4}


def _pptr(v):
    return v if isinstance(v, tuple) and v and v[0] == "PPtr" else None


class _Mundo:
    """Los .paq abiertos y cómo resolver punteros entre ellos."""

    def __init__(self, abrir, nombres):
        self.abrir = abrir      # nombre → Paquete (o None)
        self.nombres = nombres
        self.paqs = {}

    def paq(self, nombre):
        if nombre not in self.paqs:
            self.paqs[nombre] = self.abrir(nombre)
        return self.paqs[nombre]

    def resolver(self, desde, pp):
        _, f, pid = pp
        if f == 0:
            return desde, pid
        q = self.paq(desde.externos[f - 1])
        return q, pid


def _trs(t):
    p, q, s = t["m_LocalPosition"], t["m_LocalRotation"], t["m_LocalScale"]
    x, y, z, w = q["x"], q["y"], q["z"], q["w"]
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * np.array([s["x"], s["y"], s["z"]])
    M[:3, 3] = [p["x"], p["y"], p["z"]]
    return M


def _componentes(mundo, p, go):
    for c in go.get("m_Component") or []:
        q, pid = mundo.resolver(p, c["component"])
        if q is None or pid not in q.objetos:
            continue
        yield q.objetos[pid][0], q, pid


def _matriz_mundo(p, tpid):
    M = np.eye(4)
    while tpid:
        t = p.objeto(tpid)
        M = _trs(t) @ M
        f = t.get("m_Father")
        tpid = f[2] if f else 0
    return M


def disposicion(m, en_linea=None):
    """(n, {canal: (inicio, paso, formato, dim)}, clave de los vértices) de una malla sin comprimir.
    La clave es "r<id>" si los vértices son un recurso; si van dentro del .paq (mallas chicas),
    en_linea(bytes) da su clave ("p<paquete>@<desde>") o None."""
    vd = m.get("m_VertexData") or {}
    n = vd.get("m_VertexCount", 0)
    r = vd.get("m_DataSize")
    if not n:
        return None
    if isinstance(r, tuple) and r and r[0] == "recurso":
        clave = "r%d" % r[1]
    elif isinstance(r, (bytes, bytearray, memoryview)) and en_linea is not None:
        clave = en_linea(bytes(r))
        if clave is None:
            return None
    else:
        return None
    chs = vd.get("m_Channels") or []
    pasos = [0] * 4
    for c in chs:
        d = c["dimension"]
        real = d >> 4 if d >> 4 else d & 15
        if real:
            pasos[c["stream"]] = max(pasos[c["stream"]], c["offset"] + max(real, d & 15) * TAM_FORMATO.get(c["format"], 4))
    inicios, pos = [0] * 4, 0
    for s in range(4):
        inicios[s] = pos
        pos += pasos[s] * n
        pos = (pos + 15) & ~15
    canales = {}
    for k, c in enumerate(chs):
        d = c["dimension"]
        real = d >> 4 if d >> 4 else d & 15
        if real:
            canales[k] = (inicios[c["stream"]] + c["offset"], pasos[c["stream"]], c["format"], real)
    return n, canales, clave


def _leer(datos, n, canal):
    """los valores de un canal como float64 (n, dim); None si el formato no es de punto flotante"""
    ini, paso, fmt, dim = canal
    tam = TAM_FORMATO[fmt]
    a = np.frombuffer(datos, np.uint8, (n - 1) * paso + dim * tam, ini)
    filas = np.lib.stride_tricks.as_strided(a, (n, dim * tam), (paso, 1))
    b = np.ascontiguousarray(filas)
    if fmt == 0:
        return b.view("<f4").reshape(n, dim).astype(np.float64)
    if fmt == 1:
        return b.view("<f2").reshape(n, dim).astype(np.float64)
    return None


# ── la predicción (arranque.js: predecirProxy hace lo mismo, en el mismo orden) ──

def predecir(canal, fuente, M, N):
    """lo que tendría el proxy en ese canal, a partir de los valores de la fuente (float64, n×dim).
    M: 12 floats (3 filas de la matriz afín), N: 9 floats (la de las normales). Devuelve float32
    (o uint8 para el color)."""
    if canal == 0:
        x, y, z = fuente[:, 0], fuente[:, 1], fuente[:, 2]
        out = np.empty((len(fuente), 3), np.float32)
        for f in range(3):
            out[:, f] = (((x * M[f * 4] + y * M[f * 4 + 1]) + z * M[f * 4 + 2]) + M[f * 4 + 3]).astype(np.float32)
        return out
    if canal in (1, 2):
        x, y, z = fuente[:, 0], fuente[:, 1], fuente[:, 2]
        T = N if canal == 1 else [M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]]
        a = (x * T[0] + y * T[1]) + z * T[2]
        b = (x * T[3] + y * T[4]) + z * T[5]
        c = (x * T[6] + y * T[7]) + z * T[8]
        largo = np.sqrt((a * a + b * b) + c * c)
        largo[largo == 0] = 1
        out = np.empty((len(fuente), 4 if canal == 2 else 3), np.float32)
        out[:, 0] = (a / largo).astype(np.float32)
        out[:, 1] = (b / largo).astype(np.float32)
        out[:, 2] = (c / largo).astype(np.float32)
        if canal == 2:
            out[:, 3] = fuente[:, 3].astype(np.float32) if fuente.shape[1] > 3 else 1
        return out
    return fuente.astype(np.float32)   # UV: tal cual


def buscar(abrir, nombres, recurso_bytes, log=print):
    """({id del recurso de vértices del proxy: descriptor}, fuente) para arranque.js. abrir(nombre)
    → Paquete (o None), nombres: los .paq, recurso_bytes(id) → bytes; fuente(clave) → los bytes de
    una fuente (para restar)."""
    if np is None:
        log("   (sin numpy: los proxies van sin predecir)")
        return {}, None
    mundo = _Mundo(abrir, nombres)
    resultados = {}
    datos_cache = {}
    crudos = {}   # paquete → sus bytes (para ubicar los vértices que van adentro)

    def crudo(nombre):
        if nombre not in crudos:
            crudos[nombre] = bytes(mundo.paq(nombre).d)
        return crudos[nombre]

    def datos(clave):
        """los bytes de una fuente: "r<id>" (recurso) o "p<paquete>@<desde>@<largo>" (adentro de un .paq)"""
        if clave not in datos_cache:
            if clave[0] == "r":
                datos_cache[clave] = recurso_bytes(int(clave[1:]))
            else:
                nombre, desde, largo = clave[1:].rsplit("@", 2)
                datos_cache[clave] = crudo(nombre)[int(desde):int(desde) + int(largo)]
        return datos_cache[clave]

    def en_linea(paq, b):
        nombre = next(k for k, v in mundo.paqs.items() if v is paq)
        desde = crudo(nombre).find(b)
        return None if desde < 0 else "p%s@%d@%d" % (nombre, desde, len(b))

    for nombre in sorted(nombres):
        p = mundo.paq(nombre)
        if p is None:
            continue
        for pid, (cl, sc, _, _) in p.objetos.items():
            if cl != 114:
                continue
            o = p.objeto(pid)
            if not isinstance(o, dict) or not _pptr(o.get("proxyMesh")) or not _pptr(o.get("root")) or "proxyMaterials" not in o:
                continue
            if not o["proxyMesh"][2] or not o["root"][2]:
                continue
            try:
                r = _region(mundo, p, o, datos, en_linea)
            except Exception as e:   # una región rara no frena el empaquetado
                log(f"   proxy de {pid} en {nombre}: {e}")
                continue
            if r:
                resultados[r[0]] = r[1]
    return resultados, datos


def _region(mundo, p, reg, datos, en_linea):
    go = p.objeto(reg["m_GameObject"][2])
    tr = next((pid for cl, q, pid in _componentes(mundo, p, go) if cl in (4, 224)), None)
    inv = np.linalg.inv(_matriz_mundo(p, tr))
    qp, ppid = mundo.resolver(p, reg["proxyMesh"])
    pm = qp.objeto(ppid)
    disp = disposicion(pm)
    if not disp:
        return None
    npx, canales_px, clave_px = disp
    proxy = datos(clave_px)
    pos_px = _leer(proxy, npx, canales_px[0])
    mats = []
    for pp in reg["proxyMaterials"]:
        q, pid = mundo.resolver(p, pp)
        mats.append((id(q), pid))
    # los renderers bajo la raíz
    cands = {}

    def recorrer(q, gpid):
        g = q.objeto(gpid)
        comps = list(_componentes(mundo, q, g))
        tpid = next((cid for cl, qq, cid in comps if cl in (4, 224)), None)
        mf = next(((qq, cid) for cl, qq, cid in comps if cl == 33), None)
        mr = next(((qq, cid) for cl, qq, cid in comps if cl == 23), None)
        if mf and mr:
            f = mf[0].objeto(mf[1])
            rr = mr[0].objeto(mr[1])
            if _pptr(f.get("m_Mesh")) and f["m_Mesh"][2]:
                qm, mid = mundo.resolver(mf[0], f["m_Mesh"])
                m = qm.objeto(mid)
                d = disposicion(m, lambda b: en_linea(qm, b))
                if d and 0 in d[1]:
                    T = inv @ _matriz_mundo(q, tpid)
                    subs = m.get("m_SubMeshes") or []
                    for j, pp in enumerate(rr.get("m_Materials") or []):
                        if j >= len(subs) or not _pptr(pp):
                            continue
                        qq, mpid = mundo.resolver(mr[0], pp)
                        clave = (id(qq), mpid)
                        for k, mp in enumerate(mats):
                            if mp == clave:
                                cands.setdefault(k, []).append((d, subs[j]["firstVertex"], subs[j]["vertexCount"], T))
        if tpid:
            for h in q.objeto(tpid).get("m_Children") or []:
                qh, hpid = mundo.resolver(q, h)
                recorrer(qh, qh.objeto(hpid)["m_GameObject"][2])
    raiz_q, raiz_pid = mundo.resolver(p, reg["root"])
    recorrer(raiz_q, raiz_pid)

    segmentos = []
    fuentes = {}
    posiciones = {}
    celdas_px = np.floor(pos_px * 100).astype(np.int64)
    for k, s in enumerate(pm.get("m_SubMeshes") or []):
        lst = cands.get(k)
        if not lst:
            continue
        # el primer vértice de cada candidato, en una grilla de 1 cm: anotado en todas las celdas a
        # menos de 1 mm (así cada vértice del proxy mira una sola)
        grilla = {}
        for ci, (d, fv, vc, T) in enumerate(lst):
            if d[2] not in posiciones:
                posiciones[d[2]] = _leer(datos(d[2]), d[0], d[1][0])
            q = T[:3, :3] @ posiciones[d[2]][fv] + T[:3, 3]
            for c in {tuple(np.floor((q + np.array(e)) * 100).astype(np.int64))
                      for e in [(a, b, c) for a in (-1e-3, 1e-3) for b in (-1e-3, 1e-3) for c in (-1e-3, 1e-3)]}:
                grilla.setdefault(c, []).append(ci)
        usados = set()
        i, fin = s["firstVertex"], s["firstVertex"] + s["vertexCount"]
        while i < fin:
            hallado = None
            for ci in grilla.get(tuple(celdas_px[i]), ()):
                if ci in usados:
                    continue
                d, fv, vc, T = lst[ci]
                if i + vc > fin:
                    continue
                pred = posiciones[d[2]][fv:fv + vc] @ T[:3, :3].T + T[:3, 3]
                if np.abs(pred - pos_px[i:i + vc]).max() < 1e-3:
                    hallado = ci
                    break
            if hallado is None:
                i += 1
                continue
            usados.add(hallado)
            d, fv, vc, T = lst[hallado]
            M = [float(np.float32(x)) for x in T[:3, :4].reshape(-1)]
            Nm = np.linalg.inv(np.array([[M[0], M[1], M[2]], [M[4], M[5], M[6]], [M[8], M[9], M[10]]])).T
            N = [float(np.float32(x)) for x in Nm.reshape(-1)]
            clave = d[2]
            fuentes[clave] = [d[0], {str(c): list(v) for c, v in d[1].items()}]
            segmentos.append([i, vc, clave, fv, M, N])
            i += vc
    if not segmentos:
        return None
    return int(clave_px[1:]), {"n": npx, "canales": {str(c): list(v) for c, v in canales_px.items()},
                    "fuentes": fuentes, "segmentos": segmentos}


# ── ida y vuelta de un recurso proxy ──

def _canal_valores(datos, n, canal, filas=None):
    ini, paso, fmt, dim = canal
    tam = TAM_FORMATO[fmt]
    a = np.frombuffer(datos, np.uint8, (n - 1) * paso + dim * tam, ini)
    return np.lib.stride_tricks.as_strided(a, (n, dim * tam), (paso, 1))


def prediccion_completa(desc, fuente_bytes):
    """el buffer predicho entero (mismo largo y disposición que el proxy; ceros donde no hay fuente)"""
    n = desc["n"]
    canales = {int(c): tuple(v) for c, v in desc["canales"].items()}
    largo = max(ini + (n - 1) * paso + dim * TAM_FORMATO[fmt] for ini, paso, fmt, dim in canales.values())
    pred = np.zeros(largo, np.uint8)
    for i, vc, clave, fv, M, N in desc["segmentos"]:
        nf, cf = desc["fuentes"][clave]
        cf = {int(c): tuple(v) for c, v in cf.items()}
        fb = fuente_bytes(clave)
        for c, (ini, paso, fmt, dim) in canales.items():
            if c not in cf:
                # sin el canal en la fuente: el color, blanco; lo demás, 0
                if c == 3 and fmt == 2:
                    for k in range(vc):
                        o = ini + (i + k) * paso
                        pred[o:o + dim] = 255
                continue
            f_ini, f_paso, f_fmt, f_dim = cf[c]
            if fmt == 2 and f_fmt == 2 and c == 3:
                src = _canal_valores(fb, nf, cf[c])[fv:fv + vc, :dim]
                dst = np.lib.stride_tricks.as_strided(pred[ini + i * paso:], (vc, dim), (paso, 1))
                dst[:, :] = src
                continue
            if fmt != 0 or f_fmt not in (0, 1) or f_dim < min(dim, 3 if c in (0, 1, 2) else dim):
                continue
            v = _leer(fb, nf, cf[c])[fv:fv + vc]
            out = predecir(c, v, M, N)[:, :dim]
            if out.shape[1] < dim:
                continue
            dst = np.lib.stride_tricks.as_strided(pred[ini + i * paso:], (vc, dim * 4), (paso, 1))
            dst[:, :] = np.ascontiguousarray(out.astype("<f4")).view(np.uint8).reshape(vc, dim * 4)
    return pred, canales


def restar(datos, desc, fuente_bytes):
    """el proxy como diferencia con la predicción: en los canales float, enteros de 32 bits
    (real − predicho, con vuelta); en los demás, bytes (con vuelta)"""
    pred, canales = prediccion_completa(desc, fuente_bytes)
    real = np.frombuffer(datos, np.uint8).copy()
    n = desc["n"]
    out = real.copy()
    for c, (ini, paso, fmt, dim) in canales.items():
        tam = TAM_FORMATO[fmt]
        if fmt == 0:
            r = np.lib.stride_tricks.as_strided(real[ini:], (n, dim * 4), (paso, 1))
            pr = np.lib.stride_tricks.as_strided(pred[ini:], (n, dim * 4), (paso, 1))
            d = (np.ascontiguousarray(r).view("<u4").astype(np.int64) - np.ascontiguousarray(pr).view("<u4").astype(np.int64)) & 0xFFFFFFFF
            dst = np.lib.stride_tricks.as_strided(out[ini:], (n, dim * 4), (paso, 1))
            dst[:, :] = d.astype("<u4").view(np.uint8).reshape(n, dim * 4)
        else:
            r = np.lib.stride_tricks.as_strided(real[ini:], (n, dim * tam), (paso, 1))
            pr = np.lib.stride_tricks.as_strided(pred[ini:], (n, dim * tam), (paso, 1))
            dst = np.lib.stride_tricks.as_strided(out[ini:], (n, dim * tam), (paso, 1))
            dst[:, :] = (r.astype(np.int16) - pr.astype(np.int16)) & 0xFF
    return out.tobytes()
