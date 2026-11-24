"""Texturas de los GLB a JPEG, reescribiendo el binario. Mismo método que
control-ruta11/herramientas/procesar.py; lo propio de Los Montes:
  - Tripo manda tres texturas de 4096² (color, metal/aspereza y relieve): 24 MB por modelo.
  - La de metal/aspereza se saca (y quedan metal 0 y aspereza 0,85): modelos.js igual la
    pisaba (metal ≤ 0,35, aspereza ≥ 0,5) y de noche no se distingue. Un tercio menos.
  - Color y relieve por tamaño de lo que se ve de cerca (LADOS).
Uso: python3 herramientas/procesar.py [clave ...]   (lee crudos/procesados/, escribe crudos/finales/)
"""
import io, json, os, struct, sys
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRA, SALE = os.path.join(AQUI, "../crudos/procesados"), os.path.join(AQUI, "../crudos/finales")

PERSONAJES = ["prota", "medica", "explorador", "mecanico", "sobreviviente1", "sobreviviente2", "mont_cazador", "mont_rapido", "mont_vigia", "mont_bruto", "mont_trampero", "mont_lider"]
# (color, relieve); relieve 0 = sin relieve.
LADOS = {k: (768, 384) for k in PERSONAJES}
LADOS.update({
    "cabana": (1024, 512), "cabana_ruina": (1024, 512), "aserradero": (1024, 512), "camioneta_grua": (1024, 512), "camioneta_vieja": (1024, 512),
    "camion_maderero": (1024, 512), "mina_entrada": (1024, 512), "torre_agua": (768, 384), "grua": (768, 384),
    "tienda": (512, 256), "jaula": (768, 384), "cruces": (512, 256), "vagoneta": (512, 256), "tronco": (512, 256),
    # Pinos y rocas: se instancian por miles y se ven de lejos; relieve no.
    "pino1": (512, 0), "pino2": (512, 0), "roca1": (512, 256), "roca2": (512, 256),
    "farol": (256, 0), "trampa_oso": (256, 0),
    # Lo que se lleva en la mano se ve grande: color a 512.
    "pistola": (512, 0), "escopeta": (512, 0), "rifle": (512, 0), "hacha": (512, 0), "linterna": (512, 0),
    "botiquin": (256, 0), "bateria": (256, 0), "bidon": (256, 0), "municion": (256, 0), "lata": (256, 0), "herramientas": (256, 0), "repuesto": (256, 0),
})

def glb_liviano(src, dst, lado_color, lado_relieve):
    b = open(src, "rb").read()
    L = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + L])
    o = 20 + L; LB = struct.unpack("<I", b[o:o + 4])[0]; binario = b[o + 8:o + 8 + LB]
    vistas = [binario[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in j["bufferViews"]]
    papel = {}  # imagen → "color" | "relieve" | "sobra"
    for m in j.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr: papel[j["textures"][pbr["baseColorTexture"]["index"]]["source"]] = "color"
        if "metallicRoughnessTexture" in pbr:
            papel.setdefault(j["textures"][pbr.pop("metallicRoughnessTexture")["index"]]["source"], "sobra")
        pbr["metallicFactor"] = 0.0; pbr["roughnessFactor"] = 0.85
        if "normalTexture" in m:
            if lado_relieve: papel.setdefault(j["textures"][m["normalTexture"]["index"]]["source"], "relieve")
            else: papel.setdefault(j["textures"][m.pop("normalTexture")["index"]]["source"], "sobra")
        m.pop("emissiveTexture", None); m.pop("occlusionTexture", None)
    for i, im in enumerate(j.get("images", [])):
        rol = papel.get(i, "sobra")
        if rol == "sobra":
            # Se deja una imagen de 8x8: sacarla del todo obliga a renumerar texturas.
            buf = io.BytesIO(); Image.new("RGB", (8, 8), (128, 128, 255)).save(buf, "JPEG", quality=60)
            vistas[im["bufferView"]] = buf.getvalue(); im["mimeType"] = "image/jpeg"; continue
        pil = Image.open(io.BytesIO(vistas[im["bufferView"]])).convert("RGB")
        lado = lado_color if rol == "color" else lado_relieve
        if max(pil.size) > lado: pil = pil.resize((lado, lado), Image.LANCZOS)
        buf = io.BytesIO(); pil.save(buf, "JPEG", quality=80 if rol == "color" else 86, optimize=True)
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
    os.makedirs(SALE, exist_ok=True)
    pedidas = sys.argv[1:]
    for f in sorted(os.listdir(ENTRA)):
        k = f[:-4]
        if not f.endswith(".glb") or (pedidas and k not in pedidas): continue
        lc, lr = LADOS.get(k, (512, 256))
        a, b = glb_liviano(os.path.join(ENTRA, f), os.path.join(SALE, f), lc, lr)
        print(f"{k}: {a // 1024} KB → {b // 1024} KB")
