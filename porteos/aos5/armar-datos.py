#!/usr/bin/env python3
"""Saca del APK de Anger of Stick 5 lo que usa el porteo: imágenes en atlas WebP, sonidos en Opus,
los archivos de datos, la fuente y las tablas que necesita el código (imagenes.c, fuentes.c).

    armar-datos.py <AngerOfStick5.apk> <carpeta web> <carpeta gen>

En la carpeta web deja datos/ (atlas, sonidos, datos.bin, fuente) y datos/indice.json; en gen,
imagenes.c y fuentes.c (se compilan con el resto). El mismo APK da siempre los mismos bytes.
"""
import hashlib, io, json, os, struct, subprocess, sys, tempfile, zipfile
from PIL import Image

SHA_PROBADO = '9bb2f4658d51e0b4dc2cf899269266e85903a4673059383dadb10e9f212eae59'  # AngerOfStick5jpark.AOS5v1.1.94.apk
TAM_PAGINA = 2048
MARGEN = 2          # pixeles de borde repetido alrededor de cada imagen (filtro lineal sin manchas)
CALIDAD = 88        # WebP con pérdida para el color; el alfa va sin pérdida


def grupo(ruta):
    p = ruta.split('/')
    if p[0] == 'img' and len(p) > 2:
        return p[1]
    return 'raiz'


class MaxRects:
    """Empaquetado MaxRects (mejor lado corto) en una página de tam×tam."""

    def __init__(self, tam):
        self.tam = tam
        self.libres = [(0, 0, tam, tam)]
        self.usado_w = self.usado_h = 0

    def meter(self, w, h):
        mejor = None
        for x, y, fw, fh in self.libres:
            if w <= fw and h <= fh:
                corto = min(fw - w, fh - h)
                largo = max(fw - w, fh - h)
                if mejor is None or (corto, largo) < mejor[0]:
                    mejor = ((corto, largo), x, y)
        if mejor is None:
            return None
        _, x, y = mejor
        self._partir(x, y, w, h)
        self.usado_w = max(self.usado_w, x + w)
        self.usado_h = max(self.usado_h, y + h)
        return x, y

    def _partir(self, x, y, w, h):
        nuevos = []
        for fx, fy, fw, fh in self.libres:
            if x >= fx + fw or x + w <= fx or y >= fy + fh or y + h <= fy:
                nuevos.append((fx, fy, fw, fh))
                continue
            if x > fx:
                nuevos.append((fx, fy, x - fx, fh))
            if x + w < fx + fw:
                nuevos.append((x + w, fy, fx + fw - x - w, fh))
            if y > fy:
                nuevos.append((fx, fy, fw, y - fy))
            if y + h < fy + fh:
                nuevos.append((fx, y + h, fw, fy + fh - y - h))
        # sacar los contenidos en otros
        self.libres = [r for i, r in enumerate(nuevos)
                       if not any(j != i and r[0] >= o[0] and r[1] >= o[1] and r[0] + r[2] <= o[0] + o[2]
                                  and r[1] + r[3] <= o[1] + o[3] for j, o in enumerate(nuevos))]


def con_borde(im, m):
    """La imagen con m pixeles de borde repetidos de cada lado."""
    w, h = im.size
    out = Image.new('RGBA', (w + 2 * m, h + 2 * m))
    out.paste(im, (m, m))
    for i in range(m):
        out.paste(im.crop((0, 0, w, 1)), (m, i))
        out.paste(im.crop((0, h - 1, w, h)), (m, m + h + i))
    for i in range(m):
        out.paste(out.crop((m, 0, m + 1, h + 2 * m)), (i, 0))
        out.paste(out.crop((m + w - 1, 0, m + w, h + 2 * m)), (m + w + i, 0))
    return out


def tiene_alfa(im, png):
    if im.mode in ('RGBA', 'LA'):
        return True
    if im.mode == 'P' and 'transparency' in im.info:
        return True
    return False


def imagenes(z, web, gen):
    rutas = sorted(n[7:] for n in z.namelist() if n.startswith('assets/') and n.lower().endswith(('.png', '.jpg')))
    info = {}
    grupos = {}
    for r in rutas:
        datos = z.read('assets/' + r)
        im = Image.open(io.BytesIO(datos))
        im.load()
        alfa = tiene_alfa(im, datos)
        info[r] = dict(w=im.size[0], h=im.size[1], alfa=int(alfa), tam=len(datos))
        grupos.setdefault(grupo(r), []).append((r, im.convert('RGBA')))
    paginas = []
    for g in sorted(grupos):
        lst = sorted(grupos[g], key=lambda t: (-max(t[1].size), -t[1].size[0] * t[1].size[1], t[0]))
        abiertas = []
        for r, im in lst:
            w, h = im.size[0] + 2 * MARGEN, im.size[1] + 2 * MARGEN
            lugar = None
            for pag in abiertas:
                xy = pag['mr'].meter(w, h)
                if xy:
                    lugar = (pag, xy)
                    break
            if not lugar:
                pag = dict(mr=MaxRects(max(TAM_PAGINA, w, h)), imgs=[], grupo=g)
                abiertas.append(pag)
                lugar = (pag, pag['mr'].meter(w, h))
            pag, (x, y) = lugar
            pag['imgs'].append((r, im, x, y))
        paginas += abiertas
    os.makedirs(os.path.join(web, 'datos'), exist_ok=True)
    indice = []
    for i, pag in enumerate(paginas):
        pw = (pag['mr'].usado_w + 3) // 4 * 4
        ph = (pag['mr'].usado_h + 3) // 4 * 4
        lienzo = Image.new('RGBA', (pw, ph))
        for r, im, x, y in pag['imgs']:
            lienzo.paste(con_borde(im, MARGEN), (x, y))
            info[r].update(pagina=i, x=x + MARGEN, y=y + MARGEN)
        nombre = f'atlas-{pag["grupo"].lower()}-{i:02d}.webp'
        buf = io.BytesIO()
        lienzo.save(buf, 'WEBP', quality=CALIDAD, method=4, alpha_quality=100, exact=False)
        open(os.path.join(web, 'datos', nombre), 'wb').write(buf.getvalue())
        indice.append(dict(archivo=nombre, w=pw, h=ph, grupo=pag['grupo'], imagenes=len(pag['imgs'])))
        print(f'  {nombre}: {pw}×{ph}, {len(pag["imgs"])} imágenes, {len(buf.getvalue()) // 1024} KB', file=sys.stderr)
    # tabla para el código (ordenada por ruta: búsqueda binaria)
    with open(os.path.join(gen, 'imagenes.c'), 'w') as f:
        f.write('/* generado por armar-datos.py desde el APK */\n#include "aos.h"\n\n')
        f.write('typedef struct { const char *ruta; u16 w, h; u8 alfa; u8 pagina; u16 x, y; u32 tam; } AosImg;\n')
        f.write('const AosImg aos_imgs[] = {\n')
        for r in sorted(info):
            d = info[r]
            ruta = r.replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'  {{"{ruta}", {d["w"]}, {d["h"]}, {d["alfa"]}, {d["pagina"]}, {d["x"]}, {d["y"]}, {d["tam"]}}},\n')
        f.write('};\nconst int aos_nimgs = sizeof aos_imgs / sizeof aos_imgs[0];\n')
        # el resto de assets/ que no va como archivo (sonidos, fuentes...): ruta y tamaño original
        otros = sorted((n[7:], z.getinfo(n).file_size) for n in z.namelist()
                       if n.startswith('assets/') and not n.endswith('/') and n[7:] not in info
                       and not n.startswith('assets/data/'))
        f.write('typedef struct { const char *ruta; u32 tam; } AosOtro;\nconst AosOtro aos_otros[] = {\n')
        for r, t in otros:
            ruta = r.replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'  {{"{ruta}", {t}}},\n')
        f.write('};\nconst int aos_notros = sizeof aos_otros / sizeof aos_otros[0];\n')
        f.write('const u16 aos_paginas[][2] = {' + ', '.join(f'{{{p["w"]}, {p["h"]}}}' for p in indice) + '};\n')
        f.write(f'const int aos_npaginas = {len(indice)};\n')
    return indice


def sonidos(z, web):
    os.makedirs(os.path.join(web, 'datos', 'sonido'), exist_ok=True)
    lista = []
    with tempfile.TemporaryDirectory() as tmp:
        for n in sorted(z.namelist()):
            if not n.startswith('assets/sound/'):
                continue
            base = os.path.basename(n)
            src = os.path.join(tmp, base)
            open(src, 'wb').write(z.read(n))
            musica = base.lower().endswith('.mp3')
            dst = os.path.join(web, 'datos', 'sonido', os.path.splitext(base)[0] + '.ogg')
            br = '96k' if musica else '48k'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map_metadata', '-1', '-fflags', '+bitexact',
                            '-flags:a', '+bitexact', '-c:a', 'libopus', '-b:a', br, '-vbr', 'on',
                            '-application', 'audio', dst], check=True)
            lista.append(dict(ruta='sound/' + base, archivo='sonido/' + os.path.basename(dst), musica=musica))
    return lista


def archivos(z, web):
    """data/*.txt y lo demás que el juego lee con FileUtils, en un solo paquete."""
    nombres = sorted(n[7:] for n in z.namelist() if n.startswith('assets/data/'))
    partes = [struct.pack('<I', len(nombres))]
    cuerpos = []
    for n in nombres:
        d = z.read('assets/' + n)
        nb = n.encode()
        partes.append(struct.pack('<H', len(nb)) + nb + struct.pack('<I', len(d)))
        cuerpos.append(d)
    open(os.path.join(web, 'datos', 'datos.bin'), 'wb').write(b''.join(partes) + b''.join(cuerpos))
    return nombres


def fuente(z, web, gen):
    from fontTools.ttLib import TTFont
    from fontTools import subset
    datos = z.read('assets/arial.ttf')
    tt = TTFont(io.BytesIO(datos))
    upem = tt['head'].unitsPerEm
    hh = tt['hhea']
    cmap = tt.getBestCmap()
    hmtx = tt['hmtx']
    cps = [c for c in range(32, 0x2200) if c in cmap]
    cps = [c for c in cps if c < 0x250 or c in (0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122)]
    glifos = {c: cmap[c] for c in cps}
    avance = {c: hmtx[glifos[c]][0] for c in cps}
    hdmx = {}
    if 'hdmx' in tt:
        for ppem, anchos in tt['hdmx'].hdmx.items():
            hdmx[ppem] = {c: anchos.get(glifos[c], 0) for c in cps}
    kern = {}
    if 'kern' in tt:
        for t in tt['kern'].kernTables:
            if getattr(t, 'format', 0) == 0:
                for (a, b), v in t.kernTable.items():
                    kern[(a, b)] = v
    porglifo = {}
    for c, g in glifos.items():
        porglifo.setdefault(g, []).append(c)
    pares = []
    for (a, b), v in kern.items():
        for ca in porglifo.get(a, []):
            for cb in porglifo.get(b, []):
                pares.append((ca, cb, v))
    pares.sort()
    with open(os.path.join(gen, 'fuentes.c'), 'w') as f:
        f.write('/* generado por armar-datos.py desde arial.ttf del APK */\n#include "aos.h"\n\n')
        f.write(f'const int aos_f_upem = {upem}, aos_f_asc = {hh.ascent}, aos_f_desc = {hh.descent}, '
                f'aos_f_gap = {hh.lineGap};\n')
        f.write(f'const int aos_f_ncp = {len(cps)};\n')
        f.write('const u16 aos_f_cp[] = {' + ','.join(str(c) for c in cps) + '};\n')
        f.write('const u16 aos_f_av[] = {' + ','.join(str(avance[c]) for c in cps) + '};\n')
        ppems = sorted(p for p in hdmx if p <= 96)
        f.write(f'const int aos_f_nhdmx = {len(ppems)};\n')
        f.write('const u8 aos_f_hdmx_ppem[] = {' + ','.join(str(p) for p in ppems) + '};\n')
        f.write('const u8 aos_f_hdmx[] = {' + ','.join(str(hdmx[p][c]) for p in ppems for c in cps) + '};\n')
        f.write(f'const int aos_f_nkern = {len(pares)};\n')
        f.write('const u16 aos_f_kern[][2] = {' + ','.join(f'{{{a},{b}}}' for a, b, v in pares) + '};\n')
        f.write('const s16 aos_f_kernv[] = {' + ','.join(str(v) for a, b, v in pares) + '};\n')
    # la fuente achicada a esas letras, para dibujarlas en el navegador
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'arial.ttf')
        open(src, 'wb').write(datos)
        dst = os.path.join(web, 'datos', 'arial.ttf')
        opts = subset.Options()
        opts.layout_features = ['kern']
        opts.notdef_outline = True
        opts.hinting = False
        opts.name_IDs = []
        sub = subset.Subsetter(opts)
        f2 = TTFont(src)
        sub.populate(unicodes=cps)
        sub.subset(f2)
        f2.save(dst)
    return dict(archivo='arial.ttf', upem=upem, asc=hh.ascent, desc=hh.descent)


def main():
    apk, web, gen = sys.argv[1:4]
    os.makedirs(gen, exist_ok=True)
    sha = hashlib.sha256(open(apk, 'rb').read()).hexdigest()
    if sha != SHA_PROBADO:
        print(f'aviso: este APK ({sha[:16]}…) no es el probado (Anger of Stick 5 1.1.94 de J-PARK)', file=sys.stderr)
    z = zipfile.ZipFile(apk)
    print('imágenes…', file=sys.stderr)
    paginas = imagenes(z, web, gen)
    print('sonidos…', file=sys.stderr)
    snd = sonidos(z, web)
    print('archivos y fuente…', file=sys.stderr)
    arch = archivos(z, web)
    fnt = fuente(z, web, gen)
    json.dump(dict(paginas=paginas, sonidos=snd, archivos=arch, fuente=fnt),
              open(os.path.join(web, 'datos', 'indice.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
