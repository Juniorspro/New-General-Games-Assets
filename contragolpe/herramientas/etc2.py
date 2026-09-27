# Comprime las texturas de CONTRAGOLPE a ETC2 para la APK (js/02b-etc2.js las lee):
# - tex/*/albedo (1024) y tex/*/normal (512), dadas vuelta de arriba abajo como las sube el juego (three pone la fila
#   de arriba en v = 1), y el cielo tal cual;
# - con todos sus mips hasta 1×1, promediando de a 2×2 como hace la placa con generateMipmap;
# - con etcpak (BSD, de wolfpld): se baja y se compila la primera vez en .herramientas/ (no se commitea); lo propio es
#   herramientas/etc2drv.cpp, que le pasa los píxeles y devuelve los bloques.
# Sale en .cache/etc2/<id>.etc2 (tampoco se commitea: se rehace con esto). Sólo rehace lo que cambió.
#     python3 herramientas/etc2.py [--prueba]      (--prueba: la PSNR de cada una contra el original)
import os, sys, struct, subprocess, hashlib, json
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERR = os.path.join(RAIZ, '.herramientas'); CACHE = os.path.join(RAIZ, '.cache', 'etc2')
DRV = os.path.join(HERR, 'etc2drv')

def compilar():
    if os.path.exists(DRV): return
    os.makedirs(HERR, exist_ok=True); src = os.path.join(HERR, 'etcpak')
    if not os.path.exists(src): subprocess.run(['git', 'clone', '--depth', '1', 'https://github.com/wolfpld/etcpak.git', src], check=True)
    subprocess.run(['g++', '-O2', '-msse4.1', '-std=c++20', '-I' + src, os.path.join(RAIZ, 'herramientas', 'etc2drv.cpp'),
                    os.path.join(src, 'ProcessRGB.cpp'), os.path.join(src, 'Tables.cpp'), os.path.join(src, 'Dither.cpp'), '-o', DRV], check=True)

def bloques(im):
    """un nivel: relleno hasta múltiplo de 4 (repitiendo el borde) y a ETC2"""
    w, h = im.size; W, H = (w + 3)//4*4, (h + 3)//4*4
    if (W, H) != (w, h):
        g = Image.new('RGB', (W, H)); g.paste(im, (0, 0))
        if W > w: g.paste(im.crop((w - 1, 0, w, h)).resize((W - w, h)), (w, 0))
        if H > h: g.paste(g.crop((0, h - 1, W, h)).resize((W, H - h)), (0, h))
        im = g
    r, gg, b = im.split(); bgra = Image.merge('RGBA', (b, gg, r, Image.new('L', im.size, 255))).tobytes()
    return subprocess.run([DRV, str(W), str(H)], input=bgra, capture_output=True, check=True).stdout

def comprimir(src, dst, voltear):
    im = Image.open(src).convert('RGB')
    if voltear: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    niveles = [im]
    while max(niveles[-1].size) > 1:
        a = niveles[-1]; w, h = max(1, a.size[0]//2), max(1, a.size[1]//2)
        niveles.append(a.reduce((a.size[0]//w, a.size[1]//h)))
    datos = b''.join(bloques(n) for n in niveles)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as f: f.write(b'ETC2' + struct.pack('<HHB', im.size[0], im.size[1], len(niveles)) + b'\0'*7 + datos)
    return im

def lista():
    idx = json.load(open(os.path.join(RAIZ, 'fuente', 'assets.json')))['orden']
    for k, t in idx:
        if k.startswith('tex/') or k.startswith('cielo/'): yield k, os.path.join(RAIZ, 'assets', k + '.webp'), k.startswith('tex/')

def main():
    compilar(); prueba = '--prueba' in sys.argv; hechas = 0; total = 0
    for k, src, voltear in lista():
        dst = os.path.join(CACHE, k + '.etc2'); firma = dst + '.md5'
        h = hashlib.md5(open(src, 'rb').read() + open(os.path.join(RAIZ, 'herramientas', 'etc2.py'), 'rb').read()).hexdigest()
        if not os.path.exists(dst) or not os.path.exists(firma) or open(firma).read() != h:
            comprimir(src, dst, voltear); open(firma, 'w').write(h); hechas += 1
        total += os.path.getsize(dst)
    print(f'{hechas} comprimidas, {total/1e6:.1f} MB en {CACHE}')

if __name__ == '__main__': main()
