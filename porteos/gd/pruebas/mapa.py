# Dibuja las formas de choque y el recorrido del bot (JSON de bot.js con MAPA=...).
import json, sys
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1]))
x0, x1 = d['x0'], d['x1']
y0, y1 = -30, max(330, max([f['f']['y1'] for f in d['formas']] + [0]) + 30)
K = 1.0
W, H = int((x1 - x0) * K), int((y1 - y0) * K)
im = Image.new('RGB', (W, H), (250, 250, 250)); g = ImageDraw.Draw(im)
P = lambda x, y: ((x - x0) * K, H - (y - y0) * K)
for gy in range(0, int(y1), 30): g.line([P(x0, gy), P(x1, gy)], fill=(232, 232, 232))
g.line([P(x0, 0), P(x1, 0)], fill=(0, 0, 0))
color = {'solido': (70, 110, 230), 'rampa': (70, 170, 230), 'peligro': (230, 50, 50), 'orbe': (240, 190, 0), 'pad': (240, 140, 0), 'portal': (40, 170, 70), 'velocidad': (150, 60, 200), 'moneda': (200, 200, 0)}
for o in d['formas']:
    f = o['f']; c = color.get(o['t'], (120, 120, 120))
    if f['tipo'] == 'circulo':
        a, b = P(f['cx'] - f['r'], f['cy'] + f['r']), P(f['cx'] + f['r'], f['cy'] - f['r']); g.ellipse([a, b], outline=c, width=2)
    elif 'pts' in f:
        g.polygon([P(*p) for p in f['pts']], outline=c, width=2)
    else:
        a, b = P(f['x0'], f['y1']), P(f['x1'], f['y0']); g.rectangle([a, b], outline=c, width=2)
    if o['t'] in ('portal', 'velocidad', 'orbe', 'pad'):
        g.text(P(f['x0'], f['y1'] + 12), str(o.get('s')), fill=c)
cam = d['camino']
for a, b in zip(cam, cam[1:]):
    g.line([P(a[0], a[1]), P(b[0], b[1])], fill=(0, 0, 0) if not a[3] else (200, 0, 200), width=2)
g.line([P(d['muerte'], y0), P(d['muerte'], y1)], fill=(255, 0, 0))
im.save(sys.argv[2])
print(sys.argv[2], im.size)
