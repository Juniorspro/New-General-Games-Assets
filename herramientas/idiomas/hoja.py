"""Hoja de capturas de probar.mjs: un renglón por idioma, una columna por escena.
   python3 herramientas/idiomas/hoja.py <juego> <idiomas,separados> <escenas,separadas> <salida.png> [carpeta]"""
import sys
from PIL import Image

juego, langs, escenas, salida = sys.argv[1], sys.argv[2].split(','), sys.argv[3].split(','), sys.argv[4]
carpeta = sys.argv[5] if len(sys.argv) > 5 else '/tmp/capturas-idiomas'
w, h = 180, 370
H = Image.new('RGB', (w * len(escenas), h * len(langs)), 'white')
for j, l in enumerate(langs):
    for i, e in enumerate(escenas):
        try:
            H.paste(Image.open(f'{carpeta}/{juego}-{e}-{l}.png').convert('RGB').resize((w, h)), (i * w, j * h))
        except FileNotFoundError:
            pass
H.save(salida)
