"""Deja cada material en los tres mapas que entiende glTF:
   col  = color, con el AO multiplicado adentro (glTF no usa aoMap de un set
          de UV distinto y en una textura que se repite queda igual de bien)
   nrm  = normal, convención OpenGL (+Y arriba), que es la que pide glTF
   mr   = un solo JPG con rugosidad en el canal verde y metal en el azul,
          que es exactamente como glTF quiere la metallicRoughnessTexture
"""
import os
from PIL import Image, ImageChops

SALIDA = "/tmp/edificio/web"
os.makedirs(SALIDA, exist_ok=True)
T = "/tmp/edificio/tex"

MATS = {
  "hormigon": dict(col=f"{T}/Concrete044D_1K-JPG/Concrete044D_1K-JPG_Color.jpg",
                   nrm=f"{T}/Concrete044D_1K-JPG/Concrete044D_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/Concrete044D_1K-JPG/Concrete044D_1K-JPG_Roughness.jpg",
                   met=f"{T}/Concrete044D_1K-JPG/Concrete044D_1K-JPG_Metalness.jpg",
                   ao =f"{T}/Concrete044D_1K-JPG/Concrete044D_1K-JPG_AmbientOcclusion.jpg"),
  "panel":    dict(col=f"{T}/Metal053C_1K-JPG/Metal053C_1K-JPG_Color.jpg",
                   nrm=f"{T}/Metal053C_1K-JPG/Metal053C_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/Metal053C_1K-JPG/Metal053C_1K-JPG_Roughness.jpg",
                   met=f"{T}/Metal053C_1K-JPG/Metal053C_1K-JPG_Metalness.jpg"),
  "aluminio": dict(col=f"{T}/Metal062C_1K-JPG/Metal062C_1K-JPG_Color.jpg",
                   nrm=f"{T}/Metal062C_1K-JPG/Metal062C_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/Metal062C_1K-JPG/Metal062C_1K-JPG_Roughness.jpg",
                   met=f"{T}/Metal062C_1K-JPG/Metal062C_1K-JPG_Metalness.jpg"),
  "ladrillo": dict(col=f"{T}/Bricks076A_1K-JPG/Bricks076A_1K-JPG_Color.jpg",
                   nrm=f"{T}/Bricks076A_1K-JPG/Bricks076A_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/Bricks076A_1K-JPG/Bricks076A_1K-JPG_Roughness.jpg",
                   ao =f"{T}/Bricks076A_1K-JPG/Bricks076A_1K-JPG_AmbientOcclusion.jpg"),
  "calle":    dict(col=f"{T}/Road008A_1K-JPG/Road008A_1K-JPG_Color.jpg",
                   nrm=f"{T}/Road008A_1K-JPG/Road008A_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/Road008A_1K-JPG/Road008A_1K-JPG_Roughness.jpg",
                   ao =f"{T}/Road008A_1K-JPG/Road008A_1K-JPG_AmbientOcclusion.jpg"),
  "vereda":   dict(col=f"{T}/StoneBricksSplitface001/StoneBricksSplitface001_COL_1K.jpg",
                   nrm=f"{T}/StoneBricksSplitface001/StoneBricksSplitface001_NRM_1K.jpg",
                   gloss=f"{T}/StoneBricksSplitface001/StoneBricksSplitface001_GLOSS_1K.jpg",
                   ao =f"{T}/StoneBricksSplitface001/StoneBricksSplitface001_AO_1K.jpg"),
  "cielorraso": dict(col=f"{T}/OfficeCeiling002_1K-JPG/OfficeCeiling002_1K-JPG_Color.jpg",
                   nrm=f"{T}/OfficeCeiling002_1K-JPG/OfficeCeiling002_1K-JPG_NormalGL.jpg",
                   rou=f"{T}/OfficeCeiling002_1K-JPG/OfficeCeiling002_1K-JPG_Roughness.jpg",
                   met=f"{T}/OfficeCeiling002_1K-JPG/OfficeCeiling002_1K-JPG_Metalness.jpg",
                   emi=f"{T}/OfficeCeiling002_1K-JPG/OfficeCeiling002_1K-JPG_Emission.jpg"),
}

COL_PX, NRM_PX, MR_PX = 1024, 1024, 512
FUERZA_AO = 0.55        # cuánto del AO se hunde en el color

def gris(ruta, px, relleno=None):
    if ruta and os.path.exists(ruta):
        return Image.open(ruta).convert("L").resize((px, px), Image.LANCZOS)
    return Image.new("L", (px, px), relleno)

total = 0
for nombre, m in MATS.items():
    col = Image.open(m["col"]).convert("RGB").resize((COL_PX, COL_PX), Image.LANCZOS)
    if m.get("ao"):
        ao = gris(m["ao"], COL_PX).point(lambda v: int(255 - (255 - v) * FUERZA_AO))
        col = ImageChops.multiply(col, Image.merge("RGB", (ao, ao, ao)))
    p = f"{SALIDA}/{nombre}_col.jpg"; col.save(p, quality=86, optimize=True); total += os.path.getsize(p)

    nrm = Image.open(m["nrm"]).convert("RGB").resize((NRM_PX, NRM_PX), Image.LANCZOS)
    p = f"{SALIDA}/{nombre}_nrm.jpg"; nrm.save(p, quality=92, optimize=True); total += os.path.getsize(p)

    if m.get("gloss"):        # esta librería da brillo, no rugosidad: se invierte
        rou = gris(m["gloss"], MR_PX).point(lambda v: 255 - v)
    else:
        rou = gris(m.get("rou"), MR_PX, 200)
    met = gris(m.get("met"), MR_PX, 0)
    mr = Image.merge("RGB", (Image.new("L", (MR_PX, MR_PX), 255), rou, met))
    p = f"{SALIDA}/{nombre}_mr.jpg"; mr.save(p, quality=88, optimize=True); total += os.path.getsize(p)

    if m.get("emi"):
        emi = Image.open(m["emi"]).convert("RGB").resize((MR_PX, MR_PX), Image.LANCZOS)
        p = f"{SALIDA}/{nombre}_emi.jpg"; emi.save(p, quality=85, optimize=True); total += os.path.getsize(p)

    print("%-11s ok" % nombre)

print("\n%d texturas, %.2f MB en total" % (len(os.listdir(SALIDA)), total/1024/1024))
