# Los paquetes de datos de la demo web de Just Shoot (file_packager de Emscripten: un .data con todo junto y un
# preload_X.js con la lista de archivos). Se sacan los archivos, se pasan las texturas DDS (DXT, que los celulares
# no leen) a JPG/PNG achicando lo grande, y se vuelven a juntar con su preload_X.js (mismo código, lista nueva).
#     python3 -I paquetes.py extraer <web_original> <extraido>
#     python3 -I paquetes.py convertir <extraido>
#     python3 -I paquetes.py armar <web_original> <extraido> <salida>
import os, re, sys
from PIL import Image

PAQUETES = ['base', 'character', 'five']
RE_PEDIDO = re.compile(r"new DataRequest\((\d+), (\d+), (\d+), (\d+)\)\.open\('GET', '([^']+)'\);")

def extraer(web, dest):
    for p in PAQUETES:
        js = open(os.path.join(web, 'game', f'preload_{p}.js')).read()
        datos = open(os.path.join(web, f'{p}.data'), 'rb').read()
        for a, b, c, d, ruta in RE_PEDIDO.findall(js):
            f = os.path.join(dest, p) + ruta
            os.makedirs(os.path.dirname(f), exist_ok=True)
            open(f, 'wb').write(datos[int(a):int(b)])
        print(p, len(RE_PEDIDO.findall(js)), 'archivos')

MAX = 512
def jpg_como(im, f, q=80):
    # JPG guardado con el nombre que pide el cfg (.png): el navegador lo reconoce por el contenido
    im.convert('RGB').save(f, format='JPEG', quality=q, optimize=True)

def convertir(dest):
    """Las DDS van al .png que nombra el cfg (con <dds>, sin soporte DXT el motor carga el .png): JPG si no hay
    transparencia de verdad (el alfa de los mapas normales es la altura del parallax: se pierde), PNG si la hay.
    Lo grande se achica a 512; los PNG con alfa grandes, a 256 colores. Los .wav pasan a .ogg (el motor busca
    los dos) y se tira la basura (Thumbs.db, copias ~)."""
    import subprocess
    n_dds = n_png = n_wav = 0
    for raiz, _, archivos in os.walk(dest):
        for n in archivos:
            f = os.path.join(raiz, n)
            base, ext = os.path.splitext(n)
            ext = ext.lower()
            if n.lower() == 'thumbs.db' or n.endswith('~'): os.remove(f); continue
            if ext == '.dds':
                im = Image.open(f); im.load()
                if max(im.size) > MAX: im.thumbnail((MAX, MAX), Image.LANCZOS)
                alfa = im.mode in ('RGBA', 'LA') and not base.endswith('_nm') and im.getchannel('A').getextrema()[0] < 250
                destino = os.path.join(raiz, base + '.png')
                if alfa: im.convert('RGBA').save(destino, optimize=True)
                else: jpg_como(im, destino, 78 if base.endswith('_nm') else 80)
                os.remove(f); n_dds += 1
            elif ext in ('.jpg', '.jpeg'):
                im = Image.open(f)
                if max(im.size) > MAX: im = im.convert('RGB'); im.thumbnail((MAX, MAX), Image.LANCZOS); im.save(f, quality=80, optimize=True)
            elif ext == '.png' and os.path.getsize(f) > 120000:
                im = Image.open(f); im.load()
                if max(im.size) > MAX: im.thumbnail((MAX, MAX), Image.LANCZOS)
                if im.mode in ('RGBA', 'LA', 'P') and 'A' in im.convert('RGBA').getbands():
                    q = im.convert('RGBA').quantize(256, method=Image.FASTOCTREE)
                    q.save(f, optimize=True)
                else: jpg_como(im, f)
                n_png += 1
            elif ext == '.wav':
                destino = os.path.join(raiz, base + '.ogg')
                if not os.path.exists(destino):
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-c:a', 'libvorbis', '-q:a', '3', destino], check=True)
                    os.remove(f); n_wav += 1
    print('dds', n_dds, '· png grandes', n_png, '· wav→ogg', n_wav)

def armar(web, dest, sal):
    os.makedirs(os.path.join(sal, 'game'), exist_ok=True)
    for p in PAQUETES:
        js = open(os.path.join(web, 'game', f'preload_{p}.js')).read()
        raiz = os.path.join(dest, p)
        rutas = sorted('/' + os.path.relpath(os.path.join(r, n), raiz).replace(os.sep, '/') for r, _, ns in os.walk(raiz) for n in ns if not n.endswith('~'))
        blob = bytearray(); pedidos = []
        for r in rutas:
            b = open(raiz + r, 'rb').read()
            audio = 1 if r.endswith(('.ogg', '.wav')) else 0
            pedidos.append(f"    new DataRequest({len(blob)}, {len(blob) + len(b)}, 0, {audio}).open('GET', '{r}');")
            blob += b
        carpetas = sorted({os.path.dirname(r) for r in rutas} | {'/'.join(os.path.dirname(r).split('/')[:i]) for r in rutas for i in range(2, len(os.path.dirname(r).split('/')))})
        crear = []
        hechas = set()
        for c in sorted(carpetas, key=lambda x: x.count('/')):
            partes = c.strip('/').split('/')
            for i in range(1, len(partes) + 1):
                cc = '/' + '/'.join(partes[:i])
                if cc in hechas or cc == '/': continue
                hechas.add(cc)
                padre = '/' + '/'.join(partes[:i - 1]) if i > 1 else '/'
                crear.append(f"Module['FS_createPath']('{padre}', '{partes[i - 1]}', true, true);")
        cargas = [f'          DataRequest.prototype.requests["{r}"].onload();' for r in rutas]
        def poner(s, patron, lineas):
            ms = list(re.finditer(patron, s, re.M))
            assert ms, patron
            ini, fin = ms[0].start(), ms[-1].end()
            return s[:ini] + '\n'.join(lineas).lstrip() + s[fin:]
        js = poner(js, r"^\s*Module\['FS_createPath'\]\([^\n]*\);", crear)
        js = poner(js, r"^\s*new DataRequest\([^\n]*\);", pedidos)
        js = poner(js, r'^\s*DataRequest\.prototype\.requests\["[^"]+"\]\.onload\(\);', cargas)
        js = re.sub(r'var REMOTE_PACKAGE_SIZE = \d+;', f'var REMOTE_PACKAGE_SIZE = {len(blob)};', js)
        open(os.path.join(sal, 'game', f'preload_{p}.js'), 'w').write(js)
        open(os.path.join(sal, f'{p}.data'), 'wb').write(blob)
        print(p, len(rutas), 'archivos', round(len(blob) / 1e6, 2), 'MB')

if __name__ == '__main__':
    accion = sys.argv[1]
    if accion == 'extraer': extraer(sys.argv[2], sys.argv[3])
    elif accion == 'convertir': convertir(sys.argv[2])
    elif accion == 'armar': armar(sys.argv[2], sys.argv[3], sys.argv[4])
