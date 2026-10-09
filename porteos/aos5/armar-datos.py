#!/usr/bin/env python3
"""Saca del APK de Anger of Stick 5 lo que usa el porteo: imágenes en WebP, sonidos en Opus,
los archivos de datos, la fuente y las tablas que necesita el código (imagenes.c, fuentes.c).

    armar-datos.py <AngerOfStick5.apk> <carpeta web> <carpeta gen>

En la carpeta web deja datos/ (imagenes.bin, sonidos, datos.bin, fuente, ícono) y datos/indice.json; en gen,
imagenes.c y fuentes.c (se compilan con el resto). El mismo APK da siempre los mismos bytes.
"""
import hashlib, io, json, os, struct, subprocess, sys, tempfile, zipfile
from PIL import Image

SHA_PROBADO = '9bb2f4658d51e0b4dc2cf899269266e85903a4673059383dadb10e9f212eae59'  # AngerOfStick5jpark.AOS5v1.1.94.apk
MARGEN = 2          # pixeles de borde repetido alrededor de cada imagen (filtro lineal sin manchas)
CALIDAD = 88        # WebP con pérdida para el color; el alfa va sin pérdida


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


def webp(im, sin_perdida):
    buf = io.BytesIO()
    if sin_perdida:
        im.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    else:
        im.save(buf, 'WEBP', quality=CALIDAD, method=6, alpha_quality=100, exact=False)
    return buf.getvalue()


def una_imagen(datos):
    """(w, h, alfa, webp, sin pérdida) de un PNG/JPG del APK."""
    im = Image.open(io.BytesIO(datos))
    im.load()
    alfa = tiene_alfa(im, datos)
    w, h = im.size
    b = con_borde(im.convert('RGBA'), MARGEN)
    if b.getextrema()[3][0] == 255:
        b = b.convert('RGB')        # opaca: sin canal alfa pesa menos
    con, sin = webp(b, False), webp(b, True)
    if len(sin) <= len(con) * 1.15:
        return w, h, alfa, sin, True
    return w, h, alfa, con, False


def imagenes(z, web, gen):
    """Cada imagen, con su borde repetido, como WebP aparte dentro de datos/imagenes.bin. La página las
    decodifica cuando el juego las pide y las acomoda en su atlas (tablas.c), como el original que
    cargaba cada PNG al usarlo. Se elige sin pérdida si pesa casi lo mismo que con pérdida."""
    from concurrent.futures import ProcessPoolExecutor
    rutas = sorted(n[7:] for n in z.namelist() if n.startswith('assets/') and n.lower().endswith(('.png', '.jpg')))
    originales = [z.read('assets/' + r) for r in rutas]
    filas, cuerpo = [], bytearray()
    sin_perdida = 0
    with ProcessPoolExecutor() as ex:   # el resultado no depende de en qué orden terminen
        for r, datos, (w, h, alfa, wp, sp) in zip(rutas, originales, ex.map(una_imagen, originales, chunksize=8)):
            filas.append((r, w, h, int(alfa), len(cuerpo), len(wp), len(datos)))
            cuerpo += wp
            sin_perdida += sp
    os.makedirs(os.path.join(web, 'datos'), exist_ok=True)
    open(os.path.join(web, 'datos', 'imagenes.bin'), 'wb').write(cuerpo)
    print(f'  {len(filas)} imágenes ({sin_perdida} sin pérdida), {len(cuerpo) // 1024} KB', file=sys.stderr)
    # tabla para el código (ordenada por ruta: búsqueda binaria)
    with open(os.path.join(gen, 'imagenes.c'), 'w') as f:
        f.write('/* generado por armar-datos.py desde el APK */\n#include "aos.h"\n\n')
        f.write(f'const int aos_img_margen = {MARGEN};\n')
        f.write('typedef struct { const char *ruta; u16 w, h; u8 alfa; u32 off, len, tam; } AosImg;\n')
        f.write('const AosImg aos_imgs[] = {\n')
        for r, w, h, alfa, off, ln, tam in filas:
            ruta = r.replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'  {{"{ruta}", {w}, {h}, {alfa}, {off}, {ln}, {tam}}},\n')
        f.write('};\nconst int aos_nimgs = sizeof aos_imgs / sizeof aos_imgs[0];\n')
        # el resto de assets/ que no va como archivo (sonidos, fuentes...): ruta y tamaño original
        son_img = set(rutas)
        otros = sorted((n[7:], z.getinfo(n).file_size) for n in z.namelist()
                       if n.startswith('assets/') and not n.endswith('/') and n[7:] not in son_img
                       and not n.startswith('assets/data/'))
        f.write('typedef struct { const char *ruta; u32 tam; } AosOtro;\nconst AosOtro aos_otros[] = {\n')
        for r, t in otros:
            ruta = r.replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'  {{"{ruta}", {t}}},\n')
        f.write('};\nconst int aos_notros = sizeof aos_otros / sizeof aos_otros[0];\n')
    return dict(archivo='imagenes.bin', bytes=len(cuerpo), imagenes=len(filas))


def sonidos(z, web):
    """Los efectos (sound/N.wav) en Opus. Los MP3 del APK (BGM1, BGM2, MENU) no van: el juego no tiene
    música; SoundClip::loadBgm no se llama nunca y SoundClip::play no toca un clip de música."""
    os.makedirs(os.path.join(web, 'datos', 'sonido'), exist_ok=True)
    lista = []
    with tempfile.TemporaryDirectory() as tmp:
        for n in sorted(z.namelist()):
            if not n.startswith('assets/sound/') or not n.lower().endswith('.wav'):
                continue
            base = os.path.basename(n)
            src = os.path.join(tmp, base)
            open(src, 'wb').write(z.read(n))
            dst = os.path.join(web, 'datos', 'sonido', os.path.splitext(base)[0] + '.ogg')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map_metadata', '-1', '-fflags', '+bitexact',
                            '-flags:a', '+bitexact', '-c:a', 'libopus', '-b:a', '48k', '-vbr', 'on',
                            '-application', 'audio', dst], check=True)
            lista.append(dict(ruta='sound/' + base, archivo='sonido/' + os.path.basename(dst)))
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
    imgs = imagenes(z, web, gen)
    print('sonidos…', file=sys.stderr)
    snd = sonidos(z, web)
    print('archivos y fuente…', file=sys.stderr)
    arch = archivos(z, web)
    fnt = fuente(z, web, gen)
    # el ícono del juego, para la app instalada y el APK
    open(os.path.join(web, 'datos', 'icono.png'), 'wb').write(z.read('assets/img/Icon/default_512.png'))
    json.dump(dict(imagenes=imgs, sonidos=snd, archivos=arch, fuente=fnt),
              open(os.path.join(web, 'datos', 'indice.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
