"""Las imágenes de Rezona (crudo/*.png), llevadas a lo que usa la escena (assets/*.webp).

    python3 herramientas/procesar_texturas.py

- nieve y corteza: color en webp y un mapa de normales sacado del brillo. La nieve
  iluminada pareja no tiene relieve propio: la luz de la escena lo necesita para
  que los montículos y las pisadas se lean con el sol bajo.
- el bosque de fondo: el generador lo devolvió como una foto ancha y no como un
  panorama de verdad (el cielo y el bosque son dos franjas, con un corte en el
  medio). Se usa la franja del bosque en un cilindro lejano y el cielo aparte.
"""
from PIL import Image, ImageFilter
import numpy as np
import os

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRUDO = os.path.join(AQUI, 'crudo')
SAL = os.path.join(AQUI, 'assets')
os.makedirs(SAL, exist_ok=True)


def normales(img, fuerza, suave):
    """Normal en espacio tangente desde el brillo (lo claro es alto). Se envuelve en
    los bordes para que el mapa repita igual que el color."""
    h = np.asarray(img.convert('L').filter(ImageFilter.GaussianBlur(suave)), dtype=np.float32) / 255.0
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * fuerza
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * fuerza
    n = np.dstack([-dx, dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB')


def guardar(img, nombre, calidad=82):
    p = os.path.join(SAL, nombre)
    img.save(p, 'WEBP', quality=calidad, method=6)
    print(f'{nombre}: {img.size[0]}×{img.size[1]} {os.path.getsize(p) // 1024} KB')


nieve = Image.open(os.path.join(CRUDO, 'tex-nieve.png')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
guardar(nieve, 'nieve.webp')
guardar(normales(nieve, 5.0, 1.2), 'nieve-n.webp', 88)

corteza = Image.open(os.path.join(CRUDO, 'tex-corteza.png')).convert('RGB').resize((512, 1024), Image.LANCZOS)
guardar(corteza, 'corteza.webp')
guardar(normales(corteza, 7.0, 0.8), 'corteza-n.webp', 88)

# el fondo: medir dónde está el corte entre el cielo y el bosque (la fila donde
# más cambia el brillo medio) y guardar las dos franjas
cielo = Image.open(os.path.join(CRUDO, 'cielo-bosque.png')).convert('RGB')
a = np.asarray(cielo, dtype=np.float32).mean(axis=(1, 2))
corte = int(np.argmax(np.abs(np.diff(a[len(a) // 4: 3 * len(a) // 4]))) + len(a) // 4) + 1
print('corte cielo/bosque en la fila', corte, 'de', cielo.size[1])
w = cielo.size[0]
bosque = cielo.crop((0, corte, w, cielo.size[1]))
guardar(bosque.resize((2048, int(2048 * bosque.size[1] / w)), Image.LANCZOS), 'fondo-bosque.webp', 80)
guardar(cielo.crop((0, 0, w, corte)).resize((1024, max(64, int(1024 * corte / w))), Image.LANCZOS), 'fondo-cielo.webp', 80)
