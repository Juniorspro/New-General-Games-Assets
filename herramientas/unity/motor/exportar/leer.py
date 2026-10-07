"""Lee un .paq (para revisar lo exportado): python3 leer.py ARCHIVO.paq [pathID ...]"""
import struct
import sys


class Paquete:
    def __init__(self, datos):
        self.d = memoryview(datos)
        assert bytes(self.d[:4]) == b"PAQ1"
        self.p = 8
        self.claves = self._lista()
        self.externos = self._lista()
        n = self._u32()
        self.scripts = [(self._cad(), self._cad(), self._cad()) for _ in range(n)]
        n = self._u32()
        self.objetos = {}
        for _ in range(n):
            pid, cl, sc, desde, largo = struct.unpack_from("<qiiII", self.d, self.p)
            self.p += 24
            self.objetos[pid] = (cl, sc, desde, largo)
        self.base = self.p

    def _u32(self):
        v = struct.unpack_from("<I", self.d, self.p)[0]; self.p += 4; return v

    def _var(self):
        r = s = 0
        while True:
            b = self.d[self.p]; self.p += 1
            r |= (b & 0x7F) << s; s += 7
            if b < 0x80: return r

    def _zz(self):
        v = self._var(); return (v >> 1) ^ -(v & 1)

    def _cad(self):
        n = self._var(); s = bytes(self.d[self.p:self.p + n]).decode("utf-8", "surrogatepass"); self.p += n; return s

    def _lista(self):
        n = self._u32(); return [self._cad() for _ in range(n)]

    def objeto(self, pid):
        cl, sc, desde, largo = self.objetos[pid]
        self.p = self.base + desde
        return self._valor()

    def _valor(self):
        t = self.d[self.p]; self.p += 1
        if t == 0: return None
        if t == 1: return False
        if t == 2: return True
        if t == 3: return self._zz()
        if t == 4: v = struct.unpack_from("<f", self.d, self.p)[0]; self.p += 4; return v
        if t == 5: v = struct.unpack_from("<d", self.d, self.p)[0]; self.p += 8; return v
        if t == 6: return self._cad()
        if t == 7: return [self._valor() for _ in range(self._var())]
        if t == 8:
            n = self._var(); return {self.claves[self._var()]: self._valor() for _ in range(n)}
        if t == 9: n = self._var(); b = bytes(self.d[self.p:self.p + n]); self.p += n; return b
        if t == 10: return ("PPtr", self._var(), self._zz())
        if t == 11:
            tipo = self.d[self.p]; self.p += 1; n = self._var()
            f = "BbHhIifdq"[tipo]; tam = struct.calcsize(f)
            v = list(struct.unpack_from("<%d%s" % (n, f), self.d, self.p)); self.p += n * tam; return v
        if t == 12: return ("recurso", self._var())
        raise ValueError(f"etiqueta {t} en {self.p - 1}")


if __name__ == "__main__":
    p = Paquete(open(sys.argv[1], "rb").read())
    print("externos:", p.externos)
    print("scripts:", p.scripts)
    ids = [int(x) for x in sys.argv[2:]] or list(p.objetos)
    for pid in ids:
        cl, sc, _, largo = p.objetos[pid]
        v = p.objeto(pid)
        s = repr(v)
        print(f"[{pid}] clase {cl} script {p.scripts[sc][2] if sc >= 0 else '-'} ({largo} B): {s[:400]}")
