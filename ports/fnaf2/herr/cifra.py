# Cifrado de trozos de Fusion 2.5 (modo 2 y 3): tabla tipo RC4 sacada de título + copyright + ruta del proyecto.
def cadena_clave(s):
    r = bytearray()
    for ch in s:
        c = ord(ch)
        if c & 0xFF: r.append(c & 0xFF)
        if (c >> 8) & 0xFF: r.append((c >> 8) & 0xFF)
    return r

def clave_combinada(data, magic):
    n = len(data); d = bytearray(data) + bytearray(max(0, 256 - len(data)))
    ultimo = magic; v = magic
    for i in range(n + 1):
        v = ((v << 7) | (v >> 1)) & 0xFF
        d[i] ^= v
        ultimo = (ultimo + d[i] * ((v & 1) + 2)) & 0xFF
    d[n + 1] = ultimo
    return d

def tabla(clave, magic, reinicio_rot=True):
    rot = lambda x: ((x << 7) | (x >> 1)) & 0xFF
    t = list(range(256)); acc = magic; h = magic; nunca = True; i2 = 0; k = 0
    for i in range(256):
        h = rot(h)
        if nunca:
            acc = (acc + (2 if (h & 1) == 0 else 3)) & 0xFF
            acc = (acc * clave[k]) & 0xFF
        if h == clave[k]:
            h = rot(magic) if reinicio_rot else magic
            k = 0; nunca = False
        i2 = (i2 + ((h ^ clave[k]) + t[i])) & 0xFF
        t[i], t[i2] = t[i2], t[i]
        k += 1
    return t

def transformar(dat, t):
    t = list(t); i = 0; i2 = 0; r = bytearray(dat)
    for j in range(len(r)):
        i = (i + 1) & 0xFF; i2 = (i2 + t[i]) & 0xFF
        t[i], t[i2] = t[i2], t[i]
        r[j] ^= t[(t[i] + t[i2]) & 0xFF]
    return r

def descifrar(dat, cid, t, build=288):
    dat = bytearray(dat)
    if (cid & 1) and build > 284: dat[0] ^= ((cid & 0xFF) ^ (cid >> 8)) & 0xFF
    return transformar(dat, t)
