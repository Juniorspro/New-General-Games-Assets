"""De a uno: una imagen o un modelo por vez, para mirarlo antes de seguir.

    python3 uno.py imagen <clave> "<prompt>"
    python3 uno.py modelo <clave> <clave-imagen> "<prompt corto>" [caras]
    python3 uno.py rig <clave> <clave-modelo> <walk|idle>

Guarda en estado.json como tanda.py (repetir una clave no vuelve a cobrar) y baja
a crudos/uno/. La primera tanda (26/9) mandó los 35 pedidos juntos sin mirar
ninguno; el usuario pidió hacerlos de a uno, y así se descarta lo malo antes
de gastar en el paso siguiente.
"""
import os, sys, time
import tanda
from tanda import correr
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../crudos/uno")
modo, clave = sys.argv[1], sys.argv[2]
if modo == "imagen":
    p = {"clave": clave, "type": "image", "output_path": f"assets/{clave}.png", "params": {"prompt": sys.argv[3], "size": "1024x1024", "n": 1}}
elif modo == "modelo":
    caras = int(sys.argv[5]) if len(sys.argv) > 5 else 30000
    p = {"clave": clave, "type": "model3d", "output_path": f"assets/{clave}.glb", "params": {"prompt": sys.argv[4], "source_url": "@" + sys.argv[3], "texture": True, "pbr": True, "texture_quality": "detailed", "face_limit": caras}}
elif modo == "rig":
    anim = sys.argv[4]
    p = {"clave": clave, "type": "rig3d", "output_path": f"assets/{clave}.glb", "params": {"source_task_id": "@" + sys.argv[3], "rig_type": "biped", "animations": [f"preset:{anim}"]}}
else:
    sys.exit(__doc__)
# El límite de generaciones de la cuenta a veces dura minutos: se reintenta más largo que en tanda.py.
for intento in range(8):
    correr([p], DEST)
    ent = tanda.E["pedidos"].get(clave, {})
    if ent.get("archivo") or ent.get("error"): break
    if ent.get("task_id"): continue  # quedó en vuelo: la próxima vuelta lo retoma
    print(f"  (reintento largo {intento + 1}: espero 120 s)", flush=True); time.sleep(120)
