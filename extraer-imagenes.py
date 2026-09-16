#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Saca las imágenes de adentro del HTML y las deja como archivos.

EL PROBLEMA, MEDIDO: hay 10,3 MB de imágenes pegadas en base64 dentro de las
páginas. Eso hace tres daños a la vez, y el tercero es el peor:

  1. base64 pesa un tercio más que el archivo original;
  2. no se pueden bajar en paralelo ni postergar: el navegador tiene que leer
     todo el HTML antes de pintar nada;
  3. NO SE CACHEAN. Son parte del HTML, así que la misma foto se vuelve a bajar
     en cada página y en cada visita. Las mismas 34 imágenes están repetidas en
     publicaciones, reels y servicios: quien mira las tres las baja tres veces.

Como archivos con el hash en el nombre se bajan una vez y quedan para siempre.

Además le pone `width` y `height` a cada `<img>`, que no es cosmético: sin esas
dos medidas el navegador no sabe cuánto lugar reservar y el texto salta cuando
carga la foto. Google mide ese salto (CLS) y lo usa para rankear.

    python3 extraer-imagenes.py [--probar]
"""
import base64, hashlib, io, os, re, sys, glob

AQUI = os.path.dirname(os.path.abspath(__file__))
PAGS = os.path.join(AQUI, "docs", "paginas")
DEST = os.path.join(PAGS, "img")
PROBAR = "--probar" in sys.argv

EXT = {"webp": "webp", "png": "png", "jpeg": "jpg", "jpg": "jpg",
       "gif": "gif", "svg+xml": "svg", "avif": "avif"}

# `src="data:..."`, `srcset`, y `url(data:...)` dentro de CSS en línea
DATOS = re.compile(
    r'data:image/(?P<tipo>[a-z+]+);base64,(?P<b64>[A-Za-z0-9+/]+={0,2})')


def medidas(crudo):
    try:
        from PIL import Image
        return Image.open(io.BytesIO(crudo)).size
    except Exception:
        return None


def main():
    os.makedirs(DEST, exist_ok=True)
    guardadas, mapa = {}, {}          # hash -> nombre de archivo
    archivos = sorted(glob.glob(os.path.join(PAGS, "iblo*.html")) +
                      glob.glob(os.path.join(PAGS, "m", "iblo*.html")))
    antes = despues = 0
    tam = {}                          # nombre -> (ancho, alto)

    for ruta in archivos:
        s = original = io.open(ruta, encoding="utf-8").read()
        antes += len(original.encode())
        n = 0

        def cambiar(m):
            nonlocal n
            tipo, b64 = m.group("tipo"), m.group("b64")
            try:
                crudo = base64.b64decode(b64, validate=True)
            except Exception:
                return m.group(0)          # no era base64 de verdad, no se toca
            h = hashlib.sha256(crudo).hexdigest()[:10]
            if h not in mapa:
                nombre = "%s.%s" % (h, EXT.get(tipo, "bin"))
                if not PROBAR:
                    with open(os.path.join(DEST, nombre), "wb") as f:
                        f.write(crudo)
                mapa[h] = nombre
                guardadas[h] = len(crudo)
                d = medidas(crudo)
                if d: tam[nombre] = d
            n += 1
            # las páginas de m/ están un nivel más abajo
            prefijo = "../" if os.sep + "m" + os.sep in ruta else ""
            return prefijo + "img/" + mapa[h]

        s = DATOS.sub(cambiar, s)

        # width/height y carga diferida en cada <img> que quedó apuntando a img/
        def medir(m):
            etiqueta = m.group(0)
            ruta_img = m.group(1)
            nombre = ruta_img.split("/")[-1]
            if nombre not in tam:
                return etiqueta
            a, al = tam[nombre]
            if " width=" not in etiqueta:
                etiqueta = etiqueta[:-1] + ' width="%d" height="%d">' % (a, al)
            if " loading=" not in etiqueta:
                etiqueta = etiqueta[:-1] + ' loading="lazy" decoding="async">'
            return etiqueta

        s = re.sub(r'<img\b[^>]*\bsrc="((?:\.\./)?img/[^"]+)"[^>]*>', medir, s)

        despues += len(s.encode())
        if s != original and not PROBAR:
            io.open(ruta, "w", encoding="utf-8").write(s)
        print("%-34s %3d imágenes  %7.0f KB -> %6.0f KB" %
              (os.path.relpath(ruta, PAGS), n,
               len(original.encode())/1024, len(s.encode())/1024))

    print("\nimágenes distintas: %d  (%.2f MB en disco)" %
          (len(mapa), sum(guardadas.values())/1024/1024))
    print("HTML: %.2f MB -> %.2f MB   (%.0f %% menos)" %
          (antes/1024/1024, despues/1024/1024, (1-despues/antes)*100))
    if PROBAR:
        print("\n(era una prueba: no se escribió nada)")


if __name__ == "__main__":
    main()
