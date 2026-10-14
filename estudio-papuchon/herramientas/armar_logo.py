"""Arma js/logo.js con el logo de Noticias El Papuchón (tiktok/logo-noticias-el-papuchon.png)
achicado a 720 px de ancho, en WebP con alfa: va embebido para que las plantillas lo dibujen
aun abriendo el HTML sin internet. Uso: python3 herramientas/armar_logo.py"""
import base64, io, os
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
im = Image.open(os.path.join(AQUI, "../../tiktok/logo-noticias-el-papuchon.png")).convert("RGBA")
im = im.crop(im.getbbox())
im = im.resize((720, round(720 * im.height / im.width)), Image.LANCZOS)
b = io.BytesIO(); im.save(b, "WEBP", quality=88, method=6)
open(os.path.join(AQUI, "../js/logo.js"), "w").write(
    "// Generado por herramientas/armar_logo.py: el logo del canal (WebP con alfa, %dx%d).\n"
    'const LOGO_B64 = "data:image/webp;base64,%s";\n' % (im.width, im.height, base64.b64encode(b.getvalue()).decode()))
print(im.size, len(b.getvalue()) // 1024, "KB")
