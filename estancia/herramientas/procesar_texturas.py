"""Texturas repetibles, como dice GUIA-JUEGOS.md § 5.1.

Pedir "seamless" no alcanza: llegan casi repetibles y con un degradé de luz de
lado a lado, que repetido dibuja una cuadrícula en el piso. En este orden:
aplanar la luz grande, cerrar la costura en los dos ejes, normales desde la
luminancia (con np.roll, para que también repitan) y webp.
"""
import numpy as np
from PIL import Image, ImageFilter

def aplanar(img, fuerza=0.85):
    lado = img.shape[0]
    borro = np.asarray(Image.fromarray((img * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(lado * 0.12))).astype(np.float32) / 255
    media = img.reshape(-1, 3).mean(0)
    plano = img / np.maximum(borro, 1e-3) * media
    return np.clip(img * (1 - fuerza) + plano * fuerza, 0, 1)

def cerrar_x(img, banda):
    t = np.arange(banda, dtype=np.float32) / banda
    t = (t * t * (3 - 2 * t)).reshape(1, -1, 1)
    w = img.shape[1]
    fuera = img[:, : w - banda].copy()
    fuera[:, :banda] = img[:, :banda] * t + img[:, w - banda:] * (1 - t)
    return fuera

def normales(img, fuerza):
    lum = img @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    dx = (np.roll(lum, -1, 1) - np.roll(lum, 1, 1)) * fuerza
    dy = (np.roll(lum, -1, 0) - np.roll(lum, 1, 0)) * fuerza
    n = np.stack([-dx, dy, np.ones_like(lum)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return (n * 0.5 + 0.5)

for nombre, fuerza_n in [("suelo", 6.0), ("pasto", 5.0), ("corteza", 9.0)]:
    img = np.asarray(Image.open(f"{nombre}-crudo.png").convert("RGB")).astype(np.float32) / 255
    img = aplanar(img)
    banda = int(img.shape[1] * 0.12)
    img = cerrar_x(img, banda)
    img = cerrar_x(img.transpose(1, 0, 2), banda).transpose(1, 0, 2)
    col = Image.fromarray((img * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)
    col.save(f"{nombre}.webp", "WEBP", quality=76, method=6)
    c = np.asarray(col).astype(np.float32) / 255
    nrm = normales(c, fuerza_n)
    Image.fromarray((nrm * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(f"{nombre}-n.webp", "WEBP", quality=80, method=6)
    # La prueba del kit: correr medio lado en cada eje y mirar la cruz del centro.
    Image.fromarray(np.roll(np.roll(np.asarray(col), 512, 0), 512, 1)).resize((340, 340)).save(f"{nombre}-cruz.png")
    import os
    print(f"{nombre}: color {os.path.getsize(nombre + '.webp')/1024:.0f} KB, normales {os.path.getsize(nombre + '-n.webp')/1024:.0f} KB")
