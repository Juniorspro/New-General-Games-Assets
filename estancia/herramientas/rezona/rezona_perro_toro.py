"""Perro, toro y muebles del puesto: imagen fuente -> modelo 3D -> esqueleto.

Se corre desde una carpeta con estado-estancia.json (los pedidos ya hechos se
saltean) y la llave en ~/.rezona/credentials.json (nunca en el repo):
    python3 rezona_perro_toro.py    # ~2.200 créditos el 24/9/2026
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tanda
from tanda import correr, E, PID
from rz import BASE
ESTILO = "Photoreal PBR game asset, soft even studio lighting, isolated on a pure white seamless background, the whole object visible with margin, no ground, no cast shadow, nothing else. Photoreal, dusty warm palette of red laterite earth, straw yellow and olive green. No text, no watermark."
fuentes = [
 {"clave": "fuente-perro", "type": "image", "output_path": "assets/fuente-perro.png", "params": {"size": "1024x1024", "n": 1, "transparent": False, "prompt":
  "A single Argentine ranch dog, a medium-size short-haired mixed breed herding dog (like a criollo ovejero), standing, strict side view facing left: tan and black coat with a white chest, pointed ears up, long tail hanging low, lean athletic body, all four legs straight and slightly apart and clearly separated, head up looking forward, mouth closed. " + ESTILO}},
 {"clave": "fuente-toro", "type": "image", "output_path": "assets/fuente-toro.png", "params": {"size": "1024x1024", "n": 1, "transparent": False, "prompt":
  "A single Aberdeen Angus breeding bull standing, three-quarter side view: solid black coat, massive muscular neck and shoulders, deep chest, thick short legs, polled head without horns, realistic proportions of a 900 kg bull, all four legs straight and slightly apart and clearly separated, head up looking forward, mouth closed. " + ESTILO}},
]
correr(fuentes, "rz-assets")
url = lambda k: f"{BASE}/pv/{PID}/{E['pedidos'][k]['output_path']}"
modelos = []
for k, p in [("perro", "Argentine ranch herding dog standing"), ("toro", "Angus breeding bull standing, realistic")]:
    if E["pedidos"].get("fuente-" + k, {}).get("archivo"):
        modelos.append({"clave": "modelo-" + k, "type": "model3d", "output_path": f"assets/modelo-{k}.glb", "params": {"prompt": p, "source_url": url("fuente-" + k), "texture": True, "pbr": True, "texture_quality": "detailed", "face_limit": 16000}})
for k, p, caras in [("heladera", "old white 1960s rounded kitchen refrigerator with a chrome handle, slightly rusty, standing", 4000),
                    ("mesa", "rustic rectangular wooden farmhouse table made of thick planks, four legs", 3000),
                    ("silla", "rustic wooden country chair with a woven rawhide seat", 3000),
                    ("pava", "old dented aluminium kettle for mate", 2000)]:
    modelos.append({"clave": "modelo-" + k, "type": "model3d", "output_path": f"assets/modelo-{k}.glb", "params": {"prompt": p, "source_url": None, "texture": True, "pbr": True, "texture_quality": "standard", "face_limit": caras}})
correr(modelos, "rz-assets", 1500)
rigs = []
for k in ("perro", "toro"):
    m = E["pedidos"].get("modelo-" + k, {})
    if m.get("archivo"):
        rigs.append({"clave": "rig-" + k, "type": "rig3d", "output_path": f"assets/rig-{k}.glb", "params": {"source_task_id": m["task_id"], "rig_type": "quadruped", "animations": ["preset:quadruped:walk"]}})
correr(rigs, "rz-assets", 1500)
print("LISTO", flush=True)
