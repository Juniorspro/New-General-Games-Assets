"""Texturas de los GLB a JPEG (color 1024, el resto 512), reescribiendo el binario.
Mismo método que estancia/herramientas/procesar_rezona.py. Uso: python3 herramientas/procesar.py
Lee procesados/ (salida de herramientas/gltf/optimizar.mjs) y escribe finales/.
"""
import io, json, os, struct
from PIL import Image
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
    os.makedirs("finales", exist_ok=True)
    lados = {"algarrobo": (512, 256), "quebracho": (512, 256), "garita": (512, 256), "moto": (512, 256), "motopol": (1024, 512)}
    for f in sorted(os.listdir("procesados")):
        k = f[:-4]; lc, lr = lados.get(k, (1024, 512))
        a, b = glb_liviano("procesados/" + f, "finales/" + f, lc, lr)
        print(f"{k}: {a // 1024} KB → {b // 1024} KB")
