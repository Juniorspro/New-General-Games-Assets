#!/usr/bin/env python3
"""Arma el .html único de Tom con lo que el juego usa.

    python3 -I entrega.py SITIO USADOS.txt SALIDA_DIR

SITIO: la carpeta que sirve cuarto.html (los .js de acá y de herramientas/unity, datos/ armados por
armar-datos.py). USADOS.txt: las rutas que pidió el juego al recorrer los cuartos (prueba con
Playwright); se suman todos los sonidos (se piden recién al sonar). Los módulos ES van como datos:
al abrir, un arranque los pasa a blob: con sus import resueltos, y las imágenes de la interfaz
(que van en CSS) también; después herramientas/porteo/un-archivo.py lo junta en tom.html.
El .html lleva los datos del juego: no va al repo (§11), se entrega como archivo.
"""
import json
import os
import shutil
import subprocess
import sys
from urllib.parse import unquote

AQUI = os.path.dirname(os.path.abspath(__file__))
sitio, usados, salida = sys.argv[1:4]
dst = os.path.join(salida, 'tom')
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)


def copiar(rel):
    src = os.path.realpath(os.path.join(sitio, rel))
    if not os.path.isfile(src):
        return False
    d = os.path.join(dst, rel)
    os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copyfile(src, d)
    return True


rutas = [unquote(l.strip().lstrip('/')) for l in open(usados) if l.strip()]
rutas = [r for r in rutas if r and not r.endswith('.html')]
for r in rutas:
    copiar(r)
for raiz, _, archivos in os.walk(os.path.realpath(os.path.join(sitio, 'datos', 'sonido'))):
    for a in archivos:
        rel = os.path.relpath(os.path.join(raiz, a), os.path.realpath(sitio + '/datos'))
        copiar(os.path.join('datos', rel))
# los módulos (los que no aparecen como pedidos porque los carga el navegador igual se copian)
for a in os.listdir(sitio):
    if a.endswith('.js'):
        copiar(a)
for a in os.listdir(os.path.join(sitio, 'vendor')):
    if a.endswith('.js'):
        copiar('vendor/' + a)
imagenes = sorted(os.path.relpath(os.path.join(r, a), dst).replace(os.sep, '/')
                  for r, _, fs in os.walk(os.path.join(dst, 'datos', 'ui')) for a in fs if a.endswith(('.webp', '.png')))

html = open(os.path.join(AQUI, 'entrega.html'), encoding='utf-8').read().replace('/*IMAGENES*/[]', json.dumps(imagenes))
open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8').write(html)
subprocess.run([sys.executable, '-I', os.path.join(AQUI, '..', '..', 'herramientas', 'porteo', 'un-archivo.py'), dst,
                '--inicio', 'index.html', '--salida', os.path.join(salida, 'tom.html')], check=True)
print(os.path.getsize(os.path.join(salida, 'tom.html')) // 1024, 'KB')
