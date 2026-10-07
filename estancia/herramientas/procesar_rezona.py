"""Procesa lo que llegó de Rezona (GUIA-JUEGOS.md § 5).

Recortes: el recorte deja un halo en los bordes semitransparentes (acá salió
rosado), que en la sombra brilla como si tuviera luz propia. Se descontamina
(se le resta el fondo al color de borde), se sangra el color de lo lleno hacia
lo transparente (el mipmap promedia vecinos, y si son rosados el halo vuelve
de lejos), y se recorta con la base pegada al borde de abajo.
Texturas: § 5.1 (aplanar la luz, cerrar la costura, normales).
GLB: las texturas adentro vienen de 3-4 MB; se pasan a 1024 (color) y 512
(normales, rugosidad) en JPEG, reescribiendo el binario.
"""
import io, json, struct, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, "tex")
from procesar import aplanar, cerrar_x, normales

def recorte(src, dst, lado=512):
    im = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32) / 255
    rgb, a = im[..., :3], im[..., 3:4]
    # Descontaminar: el borde traía blanco del fondo de estudio mezclado.
    semi = (a > 0.02) & (a < 0.98)
    rgb = np.where(semi, np.clip((rgb - (1 - a) * 1.0) / np.maximum(a, 0.02), 0, 1), rgb)
    # El halo rosado: lo que tira a magenta en el borde se lleva al verde/paja vecino.
    r, g, b = rgb[..., 0:1], rgb[..., 1:2], rgb[..., 2:3]
    magenta = ((r > g * 1.12) & (b > g * 1.05)) | ((r - g > 0.12) & (b - g > 0.02))
    borde = a < 0.9
    lleno = (a > 0.9) & ~magenta
    # Sangrar: 48 pasadas de promedio de vecinos llenos.
    col = np.where(lleno, rgb, 0); peso = lleno.astype(np.float32)
    for _ in range(48):
        c2 = sum(np.roll(np.roll(col, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        p2 = sum(np.roll(np.roll(peso, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        nuevo = (p2 > 0) & (peso == 0)
        col = np.where(nuevo, c2 / np.maximum(p2, 1e-3), col); peso = np.where(nuevo, 1.0, peso)
    sangrado = np.where(peso > 0, col, rgb)
    rgb = np.where(lleno, rgb, np.where(borde | magenta, sangrado, rgb))
    # Lo magenta que quedó adentro (hojas finas teñidas): desaturar hacia verde oliva.
    rgb = np.where(magenta & (a >= 0.9), rgb * 0.5 + np.array([0.33, 0.36, 0.2]) * 0.5, rgb)
    out = np.concatenate([rgb, a], -1)
    img = Image.fromarray((out * 255).astype(np.uint8), "RGBA")
    # Recortar al contenido con la base pegada al borde de abajo.
    caja = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    img = img.crop((caja[0], caja[1], caja[2], caja[3]))
    w, h = img.size; s = lado / max(w, h)
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(img, ((lado - img.width) // 2, lado - img.height))
    lienzo.save(dst, "WEBP", quality=82, method=6)

def textura(src, nombre, fuerza_n):
    img = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
    img = aplanar(img); banda = int(img.shape[1] * 0.12)
    img = cerrar_x(img, banda); img = cerrar_x(img.transpose(1, 0, 2), banda).transpose(1, 0, 2)
    col = Image.fromarray((img * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)
    col.save(f"proc/{nombre}.webp", "WEBP", quality=76, method=6)
    n = normales(np.asarray(col).astype(np.float32) / 255, fuerza_n)
    Image.fromarray((n * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(f"proc/{nombre}-n.webp", "WEBP", quality=80, method=6)

def glb_liviano(src, dst, lado_color=1024, lado_resto=512, sin_imagenes=False):
    b = open(src, "rb").read()
    L = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + L])
    o = 20 + L; LB = struct.unpack("<I", b[o:o + 4])[0]; binario = b[o + 8:o + 8 + LB]
    color = set()
    for m in j.get("materials", []):
        t = m.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if t: color.add(j["textures"][t["index"]]["source"])
    vistas = [binario[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in j["bufferViews"]]
    for i, im in enumerate(j.get("images", [])):
        pil = Image.open(io.BytesIO(vistas[im["bufferView"]])).convert("RGB")
        lado = lado_color if i in color else lado_resto
        if max(pil.size) > lado: pil = pil.resize((lado, lado), Image.LANCZOS)
        buf = io.BytesIO(); pil.save(buf, "JPEG", quality=82 if i in color else 88)
        vistas[im["bufferView"]] = buf.getvalue(); im["mimeType"] = "image/jpeg"
    nuevo = bytearray()
    for v, datos in zip(j["bufferViews"], vistas):
        while len(nuevo) % 4: nuevo.append(0)
        v["byteOffset"] = len(nuevo); v["byteLength"] = len(datos); nuevo += datos
    while len(nuevo) % 4: nuevo.append(0)
    j["buffers"][0]["byteLength"] = len(nuevo)
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    total = 12 + 8 + len(js) + 8 + len(nuevo)
    out = struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(nuevo), 0x004E4942) + bytes(nuevo)
    open(dst, "wb").write(out)
    return len(b), len(out)

if __name__ == "__main__":
    import os
    A = "rz-assets"
    for n in ["rama-quebracho", "rama-algarrobo", "rama-vinal", "mata-espartillo", "mata-pasto"]:
        recorte(f"{A}/{n}-g1.png", f"proc/{n}.webp"); print(n, os.path.getsize(f"proc/{n}.webp") // 1024, "KB")
    for n, f in [("revoque", 6), ("chapa", 5), ("tablas", 7), ("barro", 6)]:
        textura(f"{A}/{n}-g1.png", n, f); print(n, os.path.getsize(f"proc/{n}.webp") // 1024, "KB")
    for src, dst in [("rig-vaca-g1.glb", "vaca.glb"), ("rig-caballo-g1.glb", "caballo.glb"), ("rig-guacho-walk-g1.glb", "guacho.glb"),
                     ("modelo-chata-g1.glb", "chata.glb"), ("modelo-rollo-g1.glb", "rollo.glb")]:
        a, b = glb_liviano(f"{A}/{src}", f"proc/{dst}")
        print(f"{dst}: {a // 1024} KB → {b // 1024} KB")
