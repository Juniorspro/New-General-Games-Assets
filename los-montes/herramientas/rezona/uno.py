"""De a uno: una imagen, un modelo o un rig por vez, para mirarlo antes de seguir.

    python3 uno.py imagen <clave> "<prompt>" [ref ...]
    python3 uno.py modelo <clave> <clave-imagen> "<prompt corto>" [caras]
    python3 uno.py rig <clave> <clave-modelo> <anim> [anim ...]   (walk, idle, run...)

Copiado de control-ruta11/herramientas/rezona/uno.py. Guarda en estado.json como
tanda.py (repetir una clave no vuelve a cobrar) y baja a crudos/.
La referencia de una imagen puede ser la clave de otra imagen ya hecha (para que
dos assets sean el mismo objeto) o una URL https pública (las fotos del usuario
en los-montes/referencias/, servidas por raw.githubusercontent.com).
"""
import os, sys, time
import tanda
from tanda import correr
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../crudos")
modo, clave = sys.argv[1], sys.argv[2]
if modo == "imagen":
    p = {"clave": clave, "type": "image", "output_path": f"assets/{clave}.png", "params": {"prompt": sys.argv[3], "size": "1024x1024", "n": 1}}
    refs = [r if r.startswith("https://") else tanda.publica(tanda.E["pedidos"][r]["output_path"]) for r in sys.argv[4:]]
    if refs: p["params"]["ref_image_urls"] = refs
elif modo == "modelo":
    caras = int(sys.argv[5]) if len(sys.argv) > 5 else 20000
    p = {"clave": clave, "type": "model3d", "output_path": f"assets/{clave}.glb", "params": {"prompt": sys.argv[4], "source_url": "@" + sys.argv[3], "texture": True, "pbr": True, "texture_quality": "detailed", "face_limit": caras}}
elif modo == "rig":
    # Una animación por pedido: si se piden varias en uno, vuelve solo la última
    # (memoria/rezona.md). Con varias en la línea de comandos salen pedidos
    # <clave>-<anim> que corren juntos.
    anims = sys.argv[4:]
    ps = [{"clave": f"{clave}-{a}" if len(anims) > 1 else clave, "type": "rig3d", "output_path": f"assets/{clave}-{a}.glb" if len(anims) > 1 else f"assets/{clave}.glb", "params": {"source_task_id": "@" + sys.argv[3], "rig_type": "biped", "animations": [f"preset:{a}"]}} for a in anims]
else:
    sys.exit(__doc__)
if modo != "rig": ps = [p]
# El límite de generaciones de la cuenta a veces dura minutos: se reintenta más largo que en tanda.py.
for intento in range(8):
    faltan = [p for p in ps if not (tanda.E["pedidos"].get(p["clave"], {}).get("archivo") or tanda.E["pedidos"].get(p["clave"], {}).get("error"))]
    if not faltan: break
    correr(faltan, DEST)
    if all(tanda.E["pedidos"].get(p["clave"], {}).get("task_id") for p in faltan): continue  # en vuelo: se retoman
    if all(tanda.E["pedidos"].get(p["clave"], {}).get("archivo") or tanda.E["pedidos"].get(p["clave"], {}).get("error") for p in faltan): break
    print(f"  (reintento largo {intento + 1}: espero 120 s)", flush=True); time.sleep(120)
