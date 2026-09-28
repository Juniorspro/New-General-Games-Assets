#!/usr/bin/env python3
"""Saca el atributo MethodParameters de los .class (sólo metadatos de depuración).

El javac 21 lo escribe en los constructores de las clases anónimas con parámetros
sin nombre, y el d8 de build-tools 34 se cae con eso (NullPointerException en
String.length). Sin el atributo, el código es el mismo.

    python3 sin-parametros.py <carpeta de clases>
"""
import os
import struct
import sys


def limpiar(datos):
    p = 8
    (n,) = struct.unpack_from(">H", datos, p)
    p += 2
    utf8 = {}
    i = 1
    while i < n:
        tag = datos[p]
        if tag == 1:
            (l,) = struct.unpack_from(">H", datos, p + 1)
            utf8[i] = datos[p + 3:p + 3 + l].decode("utf-8", "replace")
            p += 3 + l
        elif tag in (3, 4):
            p += 5
        elif tag in (5, 6):
            p += 9
            i += 1
        elif tag in (7, 8, 16, 19, 20):
            p += 3
        elif tag in (9, 10, 11, 12, 17, 18):
            p += 5
        elif tag == 15:
            p += 4
        else:
            raise ValueError("tag %d" % tag)
        i += 1
    salida = bytearray(datos[:p])
    salida += datos[p:p + 6]   # acceso, esta, super
    p += 6
    (ni,) = struct.unpack_from(">H", datos, p)
    salida += datos[p:p + 2 + 2 * ni]
    p += 2 + 2 * ni
    sacados = 0
    for _ in range(2):   # campos y métodos
        (nm,) = struct.unpack_from(">H", datos, p)
        salida += datos[p:p + 2]
        p += 2
        for _ in range(nm):
            salida += datos[p:p + 6]
            (na,) = struct.unpack_from(">H", datos, p + 6)
            p += 8
            attrs = []
            for _ in range(na):
                nombre, largo = struct.unpack_from(">HI", datos, p)
                bloque = datos[p:p + 6 + largo]
                p += 6 + largo
                if utf8.get(nombre) == "MethodParameters":
                    sacados += 1
                    continue
                attrs.append(bloque)
            salida += struct.pack(">H", len(attrs))
            for a in attrs:
                salida += a
    salida += datos[p:]
    return bytes(salida), sacados


total = 0
for raiz, _, archivos in os.walk(sys.argv[1]):
    for a in archivos:
        if not a.endswith(".class"):
            continue
        ruta = os.path.join(raiz, a)
        with open(ruta, "rb") as f:
            d = f.read()
        nuevo, s = limpiar(d)
        if s:
            with open(ruta, "wb") as f:
                f.write(nuevo)
            total += s
print("· sin MethodParameters: %d" % total)
