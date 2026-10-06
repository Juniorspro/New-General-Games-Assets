"""Ícono de la APK (propio, con Oswald): TJOC en letra clara con brillo rojo sobre noche azul."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(RAIZ, 'traduccion', 'letras', 'Oswald.ttf')
T = 512
im = Image.new('RGB', (T, T))
d = ImageDraw.Draw(im)
for r in range(T // 2 * 3 // 2, 0, -4):  # fondo: azul noche que se oscurece hacia los bordes
  k = r / (T * 0.75); c = (int(8 + 22 * (1 - k)), int(10 + 26 * (1 - k)), int(24 + 60 * (1 - k)))
  d.ellipse((T / 2 - r, T * 0.42 - r, T / 2 + r, T * 0.42 + r), fill=c)
def letra(px, peso):
  f = ImageFont.truetype(FUENTE, px); f.set_variation_by_axes([peso]); return f
capa = Image.new('L', (T, T)); dc = ImageDraw.Draw(capa)
f1, f2 = letra(196, 600), letra(52, 400)
dc.text((T / 2, T * 0.44), 'TJOC', font=f1, fill=255, anchor='mm')
dc.text((T / 2, T * 0.72), 'STORY MODE', font=f2, fill=255, anchor='mm')
brillo = capa.filter(ImageFilter.GaussianBlur(14))
im.paste(Image.new('RGB', (T, T), (200, 20, 20)), (0, 0), brillo.point(lambda v: min(255, v * 2)))
im.paste(Image.new('RGB', (T, T), (232, 226, 210)), (0, 0), capa)
res = os.path.join(RAIZ, 'android', 'app', 'src', 'main', 'res')
for n, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
  os.makedirs(os.path.join(res, 'mipmap-' + n), exist_ok=True)
  im.resize((px, px), Image.LANCZOS).save(os.path.join(res, 'mipmap-' + n, 'icono.png'))
im.resize((128, 128), Image.LANCZOS).save(os.path.join(RAIZ, 'pruebas', 'salida', 'icono.png'))
