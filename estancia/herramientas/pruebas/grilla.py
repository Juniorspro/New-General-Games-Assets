# python3 grilla.py prefijo [columnas] -> tiras/hoja-prefijo.jpg
import sys, glob
from PIL import Image, ImageDraw
pre = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
fs = sorted(glob.glob(f"tiras/{pre}-[0-9][0-9].png"))
if not fs: sys.exit("nada para " + pre)
w, h = 320, 180
rows = (len(fs) + cols - 1) // cols
hoja = Image.new("RGB", (w * cols, h * rows + 18), (20, 20, 20))
d = ImageDraw.Draw(hoja); d.text((4, 3), pre, fill=(255, 255, 0))
for k, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((w, h))
    hoja.paste(im, ((k % cols) * w, 18 + (k // cols) * h))
    d.text(((k % cols) * w + 3, 18 + (k // cols) * h + 2), str(k), fill=(255, 255, 255))
hoja.save(f"tiras/hoja-{pre}.jpg", quality=82)
print(f"tiras/hoja-{pre}.jpg", len(fs))
