"""Las texturas de un build de PC para el teléfono.

Las GPU de los teléfonos no leen DXT ni BC (S3TC, BPTC): leen ETC2 (y ASTC). Cada nivel de mip se
descomprime (texture2ddecoder) y se vuelve a comprimir en ETC2 (etcpak): mismo tamaño que DXT1 y
DXT5 (4 y 8 bits por píxel) y, medido sobre Bad Parenting, 38 a 43 dB contra el original. Donde
no hay ETC2 (Chrome de escritorio, a veces) el motor lo descomprime al subirla. Las HDR (BC6H) pasan
a RGBA de 8 bits: el motor no sube texturas de punto flotante.
"""
import etcpak
import texture2ddecoder as t2d

# TextureFormat de Unity
RGBA32, DXT1, DXT5, BC4, BC5, BC6H, BC7, DXT1_CRUNCH, DXT5_CRUNCH = 4, 10, 12, 26, 27, 24, 25, 28, 29
ETC2_RGB, ETC2_RGBA8 = 45, 47

# formato de PC → (cómo se descomprime un nivel, bytes por bloque de 4x4, formato nuevo)
_PC = {
    DXT1: (t2d.decode_bc1, 8, ETC2_RGB),
    DXT5: (t2d.decode_bc3, 16, ETC2_RGBA8),
    BC7: (t2d.decode_bc7, 16, ETC2_RGBA8),
    BC4: (t2d.decode_bc4, 8, ETC2_RGB),
    BC5: (t2d.decode_bc5, 16, ETC2_RGB),
    BC6H: (t2d.decode_bc6, 16, RGBA32),
}


def es_de_pc(formato):
    return formato in _PC


def _bloques(w, h, por_bloque):
    return ((w + 3) // 4) * ((h + 3) // 4) * por_bloque


def _rellenar(bgra, w, h):
    """etcpak comprime de a bloques enteros: la imagen se lleva a múltiplos de 4 repitiendo el borde."""
    W, H = (w + 3) // 4 * 4, (h + 3) // 4 * 4
    if (W, H) == (w, h):
        return bgra, W, H
    out = bytearray(W * H * 4)
    for y in range(H):
        fy = min(y, h - 1)
        fila = bgra[fy * w * 4:(fy + 1) * w * 4]
        out[y * W * 4:y * W * 4 + w * 4] = fila
        ultimo = fila[-4:]
        for x in range(w, W):
            out[y * W * 4 + x * 4:y * W * 4 + x * 4 + 4] = ultimo
    return bytes(out), W, H


def _nivel(formato, w, h, datos):
    """Un nivel: (bytes nuevos, formato nuevo)."""
    decodificar, _, nuevo = _PC[formato]
    bgra = decodificar(datos, w, h)
    if nuevo == RGBA32:
        b = bytearray(bgra)
        b[0::4], b[2::4] = bgra[2::4], bgra[0::4]   # BGRA → RGBA
        return bytes(b)
    bgra, W, H = _rellenar(bgra, w, h)
    if nuevo == ETC2_RGB:
        return etcpak.compress_etc2_rgb(bgra, W, H)
    return etcpak.compress_etc2_rgba(bgra, W, H)


def para_telefono(formato, w, h, mips, datos, caras=1):
    """(formato nuevo, datos nuevos) de una textura de PC entera (las caras de un cubemap van una
    detrás de otra, cada una con su cadena de mips, como las guarda Unity); None si no hace falta."""
    if formato not in _PC:
        return None
    _, por_bloque, nuevo = _PC[formato]
    salida = bytearray()
    p = 0
    for _ in range(caras):
        lw, lh = w, h
        for _ in range(max(1, mips)):
            tam = _bloques(lw, lh, por_bloque)
            if p + tam > len(datos):
                break
            salida += _nivel(formato, lw, lh, bytes(datos[p:p + tam]))
            p += tam
            lw, lh = max(1, lw >> 1), max(1, lh >> 1)
    return nuevo, bytes(salida)
