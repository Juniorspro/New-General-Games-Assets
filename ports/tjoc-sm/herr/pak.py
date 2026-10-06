"""Lector de .pak de UE4 (versión 3-4, índice sin cifrar). Uso: pak.py PAK lista|sacar PATRÓN DEST"""
import sys, struct, zlib, os, fnmatch, json
def fstr(b, o):
    n = struct.unpack_from('<i', b, o)[0]; o += 4
    if n < 0: s = b[o:o - 2 * n].decode('utf-16-le')[:-1]; return s, o - 2 * n
    return b[o:o + n - 1].decode('latin-1'), o + n
def entrada(b, o, ver):
    off, tam, crudo, comp = struct.unpack_from('<qqqi', b, o); o += 28
    if ver == 1: o += 8
    o += 20
    bloques = []
    if ver >= 3:
        if comp:
            nb = struct.unpack_from('<i', b, o)[0]; o += 4
            for i in range(nb): bloques.append(struct.unpack_from('<qq', b, o)); o += 16
        cif = b[o]; o += 1; bt = struct.unpack_from('<I', b, o)[0]; o += 4
    else: cif = 0; bt = 0
    return dict(off=off, tam=tam, crudo=crudo, comp=comp, bloques=bloques, cif=cif), o
def indice(ruta):
    f = open(ruta, 'rb'); f.seek(0, 2); n = f.tell(); f.seek(n - 44)
    magic, ver, io, isz = struct.unpack('<IiQQ', f.read(24))
    f.seek(io); b = f.read(isz)
    mount, o = fstr(b, 0); cnt = struct.unpack_from('<i', b, o)[0]; o += 4
    E = {}
    for i in range(cnt):
        nom, o = fstr(b, o); e, o = entrada(b, o, ver); E[mount + nom] = e
    return f, ver, E
def leer(f, ver, e):
    if not e['comp']:
        f.seek(e['off']); h = f.read(200); _, o = entrada(h, 0, ver); f.seek(e['off'] + o); return f.read(e['tam'])
    out = bytearray()
    for a, z in e['bloques']:
        f.seek(a if ver >= 5 else a); out += zlib.decompress(f.read(z - a))
    return bytes(out)
if __name__ == '__main__':
    f, ver, E = indice(sys.argv[1])
    if sys.argv[2] == 'lista':
        for k, e in E.items(): print(e['crudo'], e['comp'], e['cif'], k)
    else:
        pat, dest = sys.argv[3], sys.argv[4]
        for k, e in E.items():
            if fnmatch.fnmatch(k, pat):
                p = os.path.join(dest, k.replace('../', '').lstrip('/')); os.makedirs(os.path.dirname(p), exist_ok=True)
                open(p, 'wb').write(leer(f, ver, e))
