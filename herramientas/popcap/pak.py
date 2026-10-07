#!/usr/bin/env python3
"""main.pak de PopCap (Plantas vs. Zombies, Zuma, Peggle, Bejeweled…): listar,
sacar, y rearmarlo más chico sin perder un solo píxel.

    python3 -I pak.py listar  main.pak
    python3 -I pak.py sacar   main.pak CARPETA
    python3 -I pak.py achicar main.pak nuevo.pak [--nivel 4]

El formato: todo el archivo va con XOR 0xF7. Adentro, la magia C04AC0BA, una
versión de 4 bytes, y una lista de entradas (bandera 0x00, largo del nombre,
nombre, tamaño, fecha de 8 bytes) que termina en la bandera 0x80; después van
los datos de cada archivo, uno tras otro, en el mismo orden.

"achicar" recomprime los PNG con oxipng y los JPG con jpegtran -optimize, los
dos sin pérdida, y se queda con cada archivo nuevo SOLO si al decodificarlo da
exactamente los mismos píxeles (alfa incluido) y pesa menos. Los colores bajo
alfa 0 no se tocan: con filtrado bilineal se ven en los bordes.
Necesita: Pillow, pyoxipng (pip) y jpegtran (libjpeg-turbo-progs).
"""
import io
import struct
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor

MAGIA = b'\xc0\x4a\xc0\xba'


def leer(ruta):
    d = bytes(b ^ 0xF7 for b in open(ruta, 'rb').read())
    if d[:4] != MAGIA:
        raise SystemExit(f'{ruta}: no es un pak de PopCap (magia {d[:4].hex()})')
    version = d[4:8]
    p, entradas = 8, []
    while True:
        fl = d[p]; p += 1
        if fl & 0x80:
            break
        n = d[p]; p += 1
        nombre = d[p:p + n]; p += n
        tam, = struct.unpack_from('<I', d, p); p += 4
        fecha = d[p:p + 8]; p += 8
        entradas.append([nombre, tam, fecha])
    for e in entradas:
        e.append(d[p:p + e[1]]); p += e[1]
    return version, entradas  # [nombre(bytes), tamaño, fecha, datos]


def escribir(ruta, version, entradas):
    out = bytearray(MAGIA + version)
    for nombre, _, fecha, datos in entradas:
        out += bytes([0, len(nombre)]) + nombre + struct.pack('<I', len(datos)) + fecha
    out += b'\x80'
    for e in entradas:
        out += e[3]
    open(ruta, 'wb').write(bytes(b ^ 0xF7 for b in out))


def pixeles(datos):
    from PIL import Image
    im = Image.open(io.BytesIO(datos))
    im.load()
    return im.size, im.convert('RGBA').tobytes()


def achicar_uno(args):
    nombre, datos, nivel = args
    ext = nombre.lower().rsplit(b'.', 1)[-1]
    try:
        if ext == b'png':
            import oxipng
            nuevo = oxipng.optimize_from_memory(datos, level=nivel, strip=oxipng.StripChunks.safe())
        elif ext in (b'jpg', b'jpeg'):
            nuevo = subprocess.run(['jpegtran', '-copy', 'none', '-optimize'], input=datos,
                                   capture_output=True, check=True).stdout
        else:
            return datos
        if len(nuevo) < len(datos) and pixeles(nuevo) == pixeles(datos):
            return nuevo
    except Exception as ex:  # un archivo raro se deja como vino
        print(f'  (sin tocar {nombre.decode("latin-1")}: {ex})', file=sys.stderr)
    return datos


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    orden, ruta = sys.argv[1], sys.argv[2]
    version, entradas = leer(ruta)
    if orden == 'listar':
        for nombre, tam, _, _ in entradas:
            print(tam, nombre.decode('latin-1'))
    elif orden == 'sacar':
        import os
        dest = sys.argv[3]
        for nombre, _, _, datos in entradas:
            r = os.path.join(dest, nombre.decode('latin-1').replace('\\', '/'))
            os.makedirs(os.path.dirname(r) or '.', exist_ok=True)
            open(r, 'wb').write(datos)
    elif orden == 'achicar':
        nivel = int(sys.argv[sys.argv.index('--nivel') + 1]) if '--nivel' in sys.argv else 4
        antes = sum(e[1] for e in entradas)
        with ProcessPoolExecutor() as ex:
            nuevos = list(ex.map(achicar_uno, [(e[0], e[3], nivel) for e in entradas], chunksize=8))
        cambiados = 0
        for e, n in zip(entradas, nuevos):
            cambiados += n is not e[3] and n != e[3]
            e[3] = n
        escribir(sys.argv[3], version, entradas)
        despues = sum(len(e[3]) for e in entradas)
        print(f'{cambiados} de {len(entradas)} archivos más chicos: {antes / 1048576:.2f} → {despues / 1048576:.2f} MB')
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
