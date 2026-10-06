# El ícono de la APK: el pictograma del colectivo del cartel de la parada (una textura del juego,
# en web/datos), con los colores corridos como un glitch. Va a android/.../mipmap-* (no se guarda en el repo).
#     python3 herramientas/icono.py
import json, os
from PIL import Image, ImageChops
AQUI = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.join(AQUI, '..', 'web', 'datos')
E = json.load(open(os.path.join(DAT, 'escena.json')))
k = next(k for k, v in E['texs'].items() if v['nombre'] == 'Bus stop sign')
im = Image.open(os.path.join(DAT, E['texs'][k]['arch'])).convert('RGB')
x0, y0, x1, y1 = im.convert('L').point(lambda v: 255 if v < 60 else 0).getbbox()
cx, cy, lado = (x0 + x1) // 2, (y0 + y1) // 2, int(max(x1 - x0, y1 - y0) * 1.45)
cuadro = Image.new('RGB', (lado, lado), im.getpixel((cx, max(0, y0 - 5))))
cuadro.paste(im.crop((cx - lado // 2, cy - lado // 2, cx + lado // 2, cy + lado // 2)), (0, 0))
r, g, b = cuadro.resize((192, 192), Image.LANCZOS).split()
ic = Image.merge('RGB', (ImageChops.offset(r, 4, 0), g, ImageChops.offset(b, -4, 0)))
for d, s in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    dest = os.path.join(AQUI, '..', 'android', 'app', 'src', 'main', 'res', f'mipmap-{d}')
    os.makedirs(dest, exist_ok=True)
    ic.resize((s, s), Image.LANCZOS).save(os.path.join(dest, 'icono.png'))
print('ícono listo')
