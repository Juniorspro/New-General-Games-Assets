"""El formato de datos del motor: cada objeto de Unity como un árbol binario compacto.

Un .paq por cada archivo serializado de Unity:
    "PAQ1"  u32 versión
    claves  (u32 n, cadenas)        nombres de campo, una vez cada uno
    externos(u32 n, cadenas)        archivos a los que apuntan los PPtr (fileID-1)
    scripts (u32 n, 3 cadenas c/u)  ensamblado, espacio de nombres, clase (los MonoBehaviour)
    objetos (u32 n; i64 pathID, i32 clase, i32 script, u32 desde, u32 largo)
    datos   los árboles, uno detrás del otro

Valores (un byte de etiqueta y después el contenido):
    0 null  1 false  2 true  3 entero (varint zigzag)  4 float32  5 float64  6 cadena (varint largo, utf-8)
    7 lista (varint n, valores)  8 mapa (varint n, (varint clave, valor)*)  9 bytes (varint largo, datos)
    10 PPtr (varint fileID, varint zigzag pathID)  11 arreglo de números (u8 tipo, varint n, datos LE)
    12 recurso (varint id: un archivo aparte en recursos/)
Los cadenas de cadenas son varint largo + utf-8. Todo en little endian.
"""
import struct

ENTERO, F32, F64, CADENA, LISTA, MAPA, BYTES, PPTR, ARREGLO, RECURSO = 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
# tipos de los arreglos de números
A_U8, A_I8, A_U16, A_I16, A_U32, A_I32, A_F32, A_F64, A_I64 = range(9)
_FMT = {A_U8: "B", A_I8: "b", A_U16: "H", A_I16: "h", A_U32: "I", A_I32: "i", A_F32: "f", A_F64: "d", A_I64: "q"}

_f32 = struct.Struct("<f")


def es_f32(v):
    try:
        return _f32.unpack(_f32.pack(v))[0] == v or v != v
    except OverflowError:
        return False


class Escritor:
    """Arma un .paq. `recurso(bytes) -> id` guarda lo grande aparte (lo da el exportador)."""

    MIN_ARREGLO = 16          # listas de números desde este largo: arreglo compacto
    MIN_RECURSO = 64 * 1024   # bytes o arreglos desde este tamaño: a recursos/

    def __init__(self, recurso):
        self.recurso = recurso
        self.claves = {}
        self.externos = []
        self.scripts = []
        self.objetos = []
        self.datos = bytearray()

    def clave(self, k):
        i = self.claves.get(k)
        if i is None:
            i = self.claves[k] = len(self.claves)
        return i

    # ── valores ──
    @staticmethod
    def _varint(b, n):
        while True:
            x = n & 0x7F
            n >>= 7
            if n:
                b.append(x | 0x80)
            else:
                b.append(x)
                return

    def _zz(self, b, n):
        self._varint(b, (n << 1) if n >= 0 else ((-n) << 1) - 1)

    def _cadena(self, b, s):
        e = s.encode("utf-8", "surrogatepass")
        self._varint(b, len(e))
        b += e

    def valor(self, b, v):
        if v is None:
            b.append(0)
        elif v is True:
            b.append(2)
        elif v is False:
            b.append(1)
        elif isinstance(v, int):
            b.append(ENTERO); self._zz(b, v)
        elif isinstance(v, float):
            if es_f32(v):
                b.append(F32); b += _f32.pack(v)
            else:
                b.append(F64); b += struct.pack("<d", v)
        elif isinstance(v, str):
            b.append(CADENA); self._cadena(b, v)
        elif isinstance(v, (bytes, bytearray, memoryview)):
            v = bytes(v)
            if len(v) >= self.MIN_RECURSO:
                b.append(RECURSO); self._varint(b, self.recurso(v))
            else:
                b.append(BYTES); self._varint(b, len(v)); b += v
        elif isinstance(v, dict):
            if len(v) == 2 and "m_FileID" in v and "m_PathID" in v:
                b.append(PPTR); self._varint(b, v["m_FileID"]); self._zz(b, v["m_PathID"])
                return
            if "_recurso" in v and len(v) == 1:
                b.append(RECURSO); self._varint(b, v["_recurso"])
                return
            b.append(MAPA); self._varint(b, len(v))
            for k, x in v.items():
                self._varint(b, self.clave(k))
                self.valor(b, x)
        elif isinstance(v, (list, tuple)):
            t = self._tipo_arreglo(v)
            if t is not None:
                datos = struct.pack("<%d%s" % (len(v), _FMT[t]), *v)
                if len(datos) >= self.MIN_RECURSO:
                    b.append(RECURSO); self._varint(b, self.recurso(bytes([t]) + datos))
                else:
                    b.append(ARREGLO); b.append(t); self._varint(b, len(v)); b += datos
                return
            b.append(LISTA); self._varint(b, len(v))
            for x in v:
                self.valor(b, x)
        else:
            raise TypeError(f"valor no soportado: {type(v)}")

    def _tipo_arreglo(self, v):
        if len(v) < self.MIN_ARREGLO:
            return None
        p = v[0]
        if isinstance(p, bool) or not isinstance(p, (int, float)):
            return None
        if all(isinstance(x, int) and not isinstance(x, bool) for x in v):
            lo, hi = min(v), max(v)
            if lo >= 0 and hi < 256: return A_U8
            if lo >= -128 and hi < 128: return A_I8
            if lo >= 0 and hi < 65536: return A_U16
            if lo >= -32768 and hi < 32768: return A_I16
            if lo >= 0 and hi < 2 ** 32: return A_U32
            if lo >= -2 ** 31 and hi < 2 ** 31: return A_I32
            return A_I64
        if all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v):
            return A_F32 if all(es_f32(float(x)) for x in v) else A_F64
        return None

    # ── objetos ──
    def objeto(self, path_id, clase, script, arbol):
        b = bytearray()
        self.valor(b, arbol)
        self.objetos.append((path_id, clase, script, len(self.datos), len(b)))
        self.datos += b

    def bytes(self):
        out = bytearray(b"PAQ1")
        out += struct.pack("<I", 1)
        def lista(cs):
            out.extend(struct.pack("<I", len(cs)))
            for c in cs:
                self._cadena(out, c)
        lista(sorted(self.claves, key=self.claves.get))
        lista(self.externos)
        out += struct.pack("<I", len(self.scripts))
        for ens, ns, cl in self.scripts:
            self._cadena(out, ens); self._cadena(out, ns); self._cadena(out, cl)
        out += struct.pack("<I", len(self.objetos))
        for pid, cl, sc, desde, largo in self.objetos:
            out += struct.pack("<qiiII", pid, cl, sc, desde, largo)
        out += self.datos
        return bytes(out)
