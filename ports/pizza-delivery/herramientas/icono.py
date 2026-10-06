# El ícono de la APK: la pizza del menú del juego (una textura, en web/datos), recortada al centro y
# oscurecida en los bordes. Va a android/.../mipmap-* (no se guarda en el repo).    python3 icono.py
import json, os
from PIL import Image, ImageDraw, ImageFilter
AQUI = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.join(AQUI, '..', 'web', 'datos')
C = json.load(open(os.path.join(DAT, 'comun.json')))
k = next(k for k, v in C['texs'].items() if 'blood-sausage-pizza' in v.get('nombre', '') and v.get('arch'))
im = Image.open(os.path.join(DAT, C['texs'][k]['arch'])).convert('RGB')
w, h = im.size; l = int(min(w, h) * 0.72)
im = im.crop(((w - l) // 2, (h - l) // 2, (w + l) // 2, (h + l) // 2)).resize((192, 192), Image.LANCZOS)
m = Image.new('L', (192, 192), 0); ImageDraw.Draw(m).ellipse((10, 10, 182, 182), fill=255); m = m.filter(ImageFilter.GaussianBlur(14))
fondo = Image.new('RGB', (192, 192), (12, 8, 8))
ic = Image.composite(im, fondo, m)
for d, s in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    dest = os.path.join(AQUI, '..', 'android', 'app', 'src', 'main', 'res', f'mipmap-{d}')
    os.makedirs(dest, exist_ok=True)
    ic.resize((s, s), Image.LANCZOS).save(os.path.join(dest, 'icono.png'))
print('ícono listo')
