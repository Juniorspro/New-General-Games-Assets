# Saca de un TTF los contornos (cuadráticas) de los caracteres pedidos y los escribe como un objeto JS:
# { e: unidades, a: ascendente, g: { 'A': [avance, 'M x y Q x y x y ... Z'] } } con y hacia abajo.
import struct, sys, json
ttf = open(sys.argv[1], 'rb').read()
chars = sys.argv[2]
n = struct.unpack('>H', ttf[4:6])[0]
T = {}
for i in range(n):
    tag, _, off, ln = struct.unpack('>4sIII', ttf[12 + i * 16:28 + i * 16]); T[tag.decode()] = (off, ln)
def u16(o): return struct.unpack('>H', ttf[o:o+2])[0]
def i16(o): return struct.unpack('>h', ttf[o:o+2])[0]
def u32(o): return struct.unpack('>I', ttf[o:o+4])[0]
head = T['head'][0]; em = u16(head + 18); locfmt = i16(head + 50)
hhea = T['hhea'][0]; asc = i16(hhea + 4); nhm = u16(hhea + 34)
ng = u16(T['maxp'][0] + 4)
hmtx = T['hmtx'][0]
def avance(gid): return u16(hmtx + 4 * min(gid, nhm - 1))
loca = T['loca'][0]
def locaOf(g): return (u16(loca + g * 2) * 2) if locfmt == 0 else u32(loca + g * 4)
glyf = T['glyf'][0]
# cmap formato 4 o 12
cm = T['cmap'][0]; mapa = {}
for i in range(u16(cm + 2)):
    pid, eid, off = u16(cm + 4 + i * 8), u16(cm + 6 + i * 8), u32(cm + 8 + i * 8)
    s = cm + off; fmt = u16(s)
    if fmt == 4:
        segx2 = u16(s + 6); ends = s + 14; starts = ends + segx2 + 2; deltas = starts + segx2; ranges = deltas + segx2
        for k in range(segx2 // 2):
            e, st, d, ro = u16(ends + 2*k), u16(starts + 2*k), i16(deltas + 2*k), u16(ranges + 2*k)
            for c in range(st, e + 1):
                if c == 0xFFFF: continue
                if ro == 0: gid = (c + d) & 0xFFFF
                else:
                    gi = u16(ranges + 2*k + ro + 2 * (c - st)); gid = (gi + d) & 0xFFFF if gi else 0
                mapa.setdefault(c, gid)
    elif fmt == 12:
        for k in range(u32(s + 12)):
            a, b, g0 = u32(s + 16 + 12*k), u32(s + 20 + 12*k), u32(s + 24 + 12*k)
            for c in range(a, b + 1): mapa.setdefault(c, g0 + c - a)
def contornos(gid):
    o = glyf + locaOf(gid)
    if locaOf(gid + 1) == locaOf(gid): return []
    nc = i16(o); p = o + 10
    if nc >= 0:
        ends = [u16(p + 2*i) for i in range(nc)]; p += 2 * nc
        p += 2 + u16(p)
        npts = ends[-1] + 1 if ends else 0
        flags = []
        while len(flags) < npts:
            f = ttf[p]; p += 1; flags.append(f)
            if f & 8:
                r = ttf[p]; p += 1; flags += [f] * r
        xs = []; v = 0
        for f in flags:
            if f & 2: d = ttf[p]; p += 1; v += d if f & 16 else -d
            elif not f & 16: v += i16(p); p += 2
            xs.append(v)
        ys = []; v = 0
        for f in flags:
            if f & 4: d = ttf[p]; p += 1; v += d if f & 32 else -d
            elif not f & 32: v += i16(p); p += 2
            ys.append(v)
        out = []; s = 0
        for e in ends:
            out.append([(xs[i], ys[i], flags[i] & 1) for i in range(s, e + 1)]); s = e + 1
        return out
    out = []
    while True:
        fl, gi = u16(p), u16(p + 2); p += 4
        if fl & 1: dx, dy = i16(p), i16(p + 2); p += 4
        else: dx, dy = struct.unpack('>bb', ttf[p:p+2]); p += 2
        a = b = c = 0.0; d = 1.0; a = 1.0
        if fl & 8: a = d = i16(p) / 16384; p += 2
        elif fl & 0x40: a, d = i16(p) / 16384, i16(p + 2) / 16384; p += 4
        elif fl & 0x80: a, b, c, d = [i16(p + 2*k) / 16384 for k in range(4)]; p += 8
        for ct in contornos(gi):
            out.append([(x * a + y * c + dx, x * b + y * d + dy, on) for x, y, on in ct])
        if not fl & 0x20: break
    return out
def camino(cts, k):
    f = lambda v: str(round(v * k))
    P = lambda x, y: f(x) + ' ' + f(-y)
    s = []
    for ct in cts:
        if not ct: continue
        # arrancar en un punto sobre la curva (o en el medio de dos de control)
        if not ct[0][2]:
            if ct[-1][2]: ct = [ct[-1]] + ct[:-1]
            else: ct = [((ct[0][0] + ct[-1][0]) / 2, (ct[0][1] + ct[-1][1]) / 2, 1)] + ct
        s.append('M' + P(ct[0][0], ct[0][1]))
        pts = ct[1:] + [ct[0]]; ctrl = None
        for x, y, on in pts:
            if on:
                s.append(('Q' + P(*ctrl) + ' ' if ctrl else 'L') + P(x, y)); ctrl = None
            else:
                if ctrl: mx, my = (ctrl[0] + x) / 2, (ctrl[1] + y) / 2; s.append('Q' + P(*ctrl) + ' ' + P(mx, my))
                ctrl = (x, y)
        s.append('Z')
    return ''.join(s)
k = 1000 / em
res = {'e': 1000, 'a': round(asc * k), 'g': {}}
for ch in chars:
    gid = mapa.get(ord(ch), 0)
    if not gid and ch != ' ': print('falta', ch, file=sys.stderr); continue
    res['g'][ch] = [round(avance(gid) * k), camino(contornos(gid), k)]
print(json.dumps(res, ensure_ascii=False, separators=(',', ':')))
