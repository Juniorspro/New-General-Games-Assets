# Lector de juegos de Clickteam Fusion 2.5 (exe con PAMU): trozos, frames, objetos, eventos, imágenes y sonidos.
import struct, zlib, collections
import cifra

class L:
    def __init__(s, d, p=0): s.d = d; s.p = p
    def u8(s): v = s.d[s.p]; s.p += 1; return v
    def i8(s): v = struct.unpack_from('<b', s.d, s.p)[0]; s.p += 1; return v
    def u16(s): v = struct.unpack_from('<H', s.d, s.p)[0]; s.p += 2; return v
    def i16(s): v = struct.unpack_from('<h', s.d, s.p)[0]; s.p += 2; return v
    def u32(s): v = struct.unpack_from('<I', s.d, s.p)[0]; s.p += 4; return v
    def i32(s): v = struct.unpack_from('<i', s.d, s.p)[0]; s.p += 4; return v
    def f32(s): v = struct.unpack_from('<f', s.d, s.p)[0]; s.p += 4; return v
    def f64(s): v = struct.unpack_from('<d', s.d, s.p)[0]; s.p += 8; return v
    def b(s, n): v = s.d[s.p:s.p + n]; s.p += n; return v
    def wstr(s, n=None):
        if n is not None: t = s.b(n * 2).decode('utf-16le', 'replace'); return t.split('\0')[0]
        e = s.p
        while s.d[e:e + 2] != b'\0\0': e += 2
        t = s.d[s.p:e].decode('utf-16le', 'replace'); s.p = e + 2; return t
    def fin(s): return s.p >= len(s.d)

TABLA = None
def trozos(d, p=0, fin=None):
    """Lista de (id, datos) leyendo cabeceras id/flags/tamaño hasta 0x7F7F (descifra si ya hay tabla)."""
    r = []
    fin = len(d) if fin is None else fin
    while p + 8 <= fin:
        cid, fl, sz = struct.unpack_from('<HHi', d, p); p += 8
        dat = d[p:p + sz]; p += sz
        if fl & 2:
            if TABLA is None: r.append((cid, ('cifrado', fl, dat))); continue
            if fl & 1:
                dec = cifra.descifrar(dat[4:], cid, TABLA); comp = struct.unpack_from('<I', dec, 0)[0]
                dat = zlib.decompress(bytes(dec[4:4 + comp]))
            else: dat = bytes(cifra.descifrar(dat, cid, TABLA))
            r.append((cid, dat)); continue
        if fl & 1:
            dec, comp = struct.unpack_from('<II', dat, 0)
            dat = zlib.decompress(dat[8:8 + comp])
        r.append((cid, dat))
        if cid == 0x7F7F: break
    return r, p

def abrir(ruta):
    d = open(ruta, 'rb').read()
    p = d.find(b'wwww\x49\x87\x47\x12')  # datos empaquetados (dll y extensiones), después el juego
    n = struct.unpack_from('<I', d, p + 28)[0]; p += 32
    for _ in range(n):
        k = struct.unpack_from('<H', d, p)[0]; p += 2 + k * 2
        p += 8 + struct.unpack_from('<I', d, p + 4)[0]
    assert d[p:p + 4] == b'PAMU', d[p:p + 4]
    global TABLA
    TABLA = None
    t = trozos(d, p + 16)[0]
    g = {cid: x for cid, x in t if not isinstance(x, tuple)}
    k = bytearray()
    for c in (0x2224, 0x223B, 0x222E): k += cifra.cadena_clave(L(g[c]).wstr() if c in g else '')
    TABLA = cifra.tabla(cifra.clave_combinada(k, 54), 54)
    return trozos(d, p + 16)[0]

TIPOS = {0: 'QuickBackdrop', 1: 'Backdrop', 2: 'Active', 3: 'Text', 4: 'Question', 5: 'Score', 6: 'Lives', 7: 'Counter', 8: 'RTF', 9: 'SubApp'}
def objetos(t):
    """Los ObjectInfo del juego: {handle: {nombre, tipo, flags, tinta, param, props(bytes)}}"""
    d = dict((c, x) for c, x in t)[0x2229]
    n = struct.unpack_from('<i', d, 0)[0]; p = 4; r = {}
    for _ in range(n):
        sub, p = trozos(d, p)
        o = {}
        for c, x in sub:
            if c == 0x4444:
                h, tp, fl, _, tinta, prm = struct.unpack_from('<hhHhII', x, 0)
                o.update(handle=h, tipo=tp, flags=fl, tinta=tinta, param=prm)
            elif c == 0x4445: o['nombre'] = L(x).wstr()
            elif c == 0x4446: o['props'] = x
            elif c == 0x4448: o['efectos'] = x
            elif c != 0x7F7F: o.setdefault('otros', []).append((c, x))
        r[o['handle']] = o
    return r

def leer_cond_acc(x, es_cond):
    l = L(x)
    sz = l.u16(); fin = l.p - 2 + sz
    e = dict(tipo=l.i16(), num=l.i16(), oi=l.u16(), oil=l.i16(), fl=l.u8(), fl2=l.u8())
    n = l.u8(); e['def'] = l.u8()
    if es_cond: e['id'] = l.i16()
    ps = []
    for _ in range(n):
        psz = l.u16(); cod = l.i16(); ps.append((cod, l.b(psz - 4)))
    e['params'] = ps
    return e, fin

def eventos(x):
    """Grupos de eventos de un frame (crudos: condiciones y acciones con parámetros en bytes)."""
    l = L(x); assert l.b(4) == b'ER>>'
    cab = dict(maxobj=l.i16(), maxoi=l.i16(), jug=l.i16(), ncond=[l.i16() for _ in range(17)], nqual=l.i16())
    cab['qual'] = [(l.u16(), l.i16()) for _ in range(cab['nqual'])]
    grupos = []
    while not l.fin():
        cod = l.b(4)
        if cod == b'<<ER': break
        if cod == b'ERes': l.u32(); continue
        if cod == b'ERev':
            tam = l.u32(); fin = l.p + tam
            while l.p < fin:
                ini = l.p; gsz = -l.i16(); nc = l.u8(); na = l.u8(); fl = l.u16(); rest = l.i16(); rcpt = l.i16(); ident = l.i16(); undo = l.i16(); l.i16()
                g = dict(fl=fl, conds=[], accs=[])
                for k in range(nc + na):
                    e, f = leer_cond_acc(x[l.p:], k < nc); l.p += f
                    (g['conds'] if k < nc else g['accs']).append(e)
                assert l.p == ini + gsz, (ini, gsz, l.p)
                grupos.append(g)
            continue
        if cod == b'ERop': cab['op'] = l.u32(); continue
        raise ValueError('código %r en %d' % (cod, l.p))
    return cab, grupos

def imagenes(t):
    """Banco de imágenes: {handle: dict(w, h, hx, hy, ax, ay, modo, flags, trans, crudo)} (crudo = datos de píxeles)."""
    d = dict(t)[0x6666]; l = L(d); n = l.i32(); r = {}
    for _ in range(n):
        h = l.i32() - 1; dec = l.i32(); comp = l.i32(); x = zlib.decompress(l.b(comp))  # (b284+: el banco guarda handle+1)
        k = L(x); k.i32(); k.i32(); tam = k.i32(); w = k.i16(); hh = k.i16(); modo = k.u8(); fl = k.u8(); k.i16()
        hx, hy, ax, ay = k.i16(), k.i16(), k.i16(), k.i16(); tr = k.b(4)
        crudo = x[k.p:]
        if fl & 0x08: crudo = zlib.decompress(crudo[4:])
        r[h] = dict(w=w, h=hh, hx=hx, hy=hy, ax=ax, ay=ay, modo=modo, flags=fl, trans=tr, crudo=crudo)
    return r

def rgba(im):
    """Pasa una imagen del banco a un arreglo RGBA (numpy)."""
    import numpy as np
    w, h, m, fl, c = im['w'], im['h'], im['modo'], im['flags'], im['crudo']
    if fl & 0x07: raise ValueError('RLE no soportado (flags %x)' % fl)
    if m == 4:   # 24 bits BGR; cada fila con un número par de píxeles
        fila = (w + w % 2) * 3
        a = np.frombuffer(c, np.uint8, fila * h).reshape(h, fila)[:, :w * 3].reshape(h, w, 3)[:, :, ::-1]
        usado = fila * h
    elif m in (6, 7):  # 15/16 bits
        fila = w + w % 2
        v = np.frombuffer(c, '<u2', fila * h).reshape(h, fila)[:, :w].astype(np.uint32)
        if m == 6: r_, g_, b_ = (v >> 10) & 31, (v >> 5) & 31, v & 31; g_ = g_ * 255 // 31
        else: r_, g_, b_ = (v >> 11) & 31, (v >> 5) & 63, v & 31; g_ = g_ * 255 // 63
        a = np.stack([r_ * 255 // 31, g_, b_ * 255 // 31], -1).astype(np.uint8); usado = fila * h * 2
    else: raise ValueError('modo %d' % m)
    out = np.empty((h, w, 4), np.uint8); out[:, :, :3] = a
    if fl & 0x10:
        fa = w + (4 - w % 4) % 4
        out[:, :, 3] = np.frombuffer(c, np.uint8, fa * h, usado).reshape(h, fa)[:, :w]
    else:
        t = np.frombuffer(im['trans'][:3], np.uint8)
        out[:, :, 3] = np.where((a == t).all(-1), 0, 255)
    return out

def sonidos(t):
    """Banco de sonidos: {handle: (nombre, bytes del archivo)}"""
    d = dict(t)[0x6668]; l = L(d); n = l.i32(); r = {}
    for _ in range(n):
        h = l.i32() - 1; _chk = l.i32(); _ref = l.i32(); dec = l.i32(); fl = l.i32(); l.i32(); nl = l.i32()
        comp = l.i32(); x = zlib.decompress(l.b(comp))
        nombre = x[:nl * 2].decode('utf-16le', 'replace').split('\0')[0]
        r[h] = (nombre, x[nl * 2:])
    return r
