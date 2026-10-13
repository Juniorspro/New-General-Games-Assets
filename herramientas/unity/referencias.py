#!/usr/bin/env python3
"""Quién usa qué en un libil2cpp.so de ARM64, sin analizar el binario entero.

    python3 -I referencias.py llama libil2cpp.so script.json 'Clase\\$\\$Metodo$' [delta]
        los métodos que llaman (BL directo) a los que coinciden con la expresión
    python3 -I referencias.py usa libil2cpp.so script.json 0xDIRECCION [delta]
        los métodos que cargan esa dirección de datos (ADRP + LDR/ADD): un MethodInfo (Method$…)
        para armar un delegado, una cadena, un TypeInfo

script.json es el de Il2CppDumper (direcciones = RVA). delta = RVA − desplazamiento en el archivo del
segmento de código (el "RVA: … Offset: …" de dump.cs; 0x4000 en My Talking Tom 26.5). Las llamadas
virtuales y por delegado no salen en "llama": para esas, "usa" con el Method$ del método.
"""
import bisect
import json
import re
import sys

import numpy as np


def metodos(script):
    d = json.load(open(script, encoding='utf-8'))
    m = sorted((x['Address'], x['Name']) for x in d['ScriptMethod'])
    return m, [a for a, _ in m]


def nombre(m, dirs, va):
    i = bisect.bisect_right(dirs, int(va)) - 1
    return m[i][1] if i >= 0 else hex(int(va))


def llama(so, script, patron, delta):
    m, dirs = metodos(script)
    w = np.fromfile(so, dtype='<u4')
    pc = np.arange(len(w), dtype=np.int64) * 4 + delta
    bl = (w & 0xFC000000) == 0x94000000
    imm = (w & 0x03FFFFFF).astype(np.int64)
    imm = np.where(imm & 0x02000000, imm - 0x04000000, imm)
    destino = np.where(bl, pc + imm * 4, -1)
    rx = re.compile(patron)
    for a, n in m:
        if rx.search(n):
            quienes = sorted({nombre(m, dirs, q) for q in pc[destino == a]})
            print(n, '←', quienes or 'nadie (¿virtual o delegado?)')


def usa(so, script, objetivo, delta):
    m, dirs = metodos(script)
    w = np.fromfile(so, dtype='<u4')
    pc = np.arange(len(w), dtype=np.int64) * 4 + delta
    adrp = (w & 0x9F000000) == 0x90000000
    imm = ((((w >> 5) & 0x7FFFF).astype(np.int64)) << 2) | ((w >> 29) & 3).astype(np.int64)
    imm = np.where(imm & (1 << 20), imm - (1 << 21), imm)
    pagina = (pc & ~0xFFF) + imm * 4096
    bajo, vistos = objetivo & 0xFFF, set()
    for i in np.nonzero(adrp & (pagina == (objetivo & ~0xFFF)))[0]:
        rd = int(w[i] & 31)
        for j in range(i + 1, min(i + 6, len(w))):
            x = int(w[j])
            if (x >> 5) & 31 != rd:
                continue
            ldr = (x & 0xFFC00000) == 0xF9400000 and ((x >> 10) & 0xFFF) * 8 == bajo
            add = (x & 0xFF800000) == 0x91000000 and ((x >> 10) & 0xFFF) == bajo
            if ldr or add:
                vistos.add(nombre(m, dirs, pc[i]))
                break
    print(hex(objetivo), '←', sorted(vistos) or 'nadie')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 4 or a[0] not in ('llama', 'usa'):
        sys.exit(__doc__)
    delta = int(a[4], 16) if len(a) > 4 else 0
    if a[0] == 'llama':
        llama(a[1], a[2], a[3], delta)
    else:
        usa(a[1], a[2], int(a[3], 16), delta)
