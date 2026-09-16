#!/usr/bin/env python3
"""Genera UN cuerpo entero por personaje y después lo corta en piezas.

    python3 generar_cuerpos.py pedir
    python3 generar_cuerpos.py bajar

POR QUÉ UN CUERPO ENTERO Y NO DOCE PIEZAS SUELTAS. La primera versión pedía
cada pieza por separado y el modelo insistía en completar lo que faltaba: al
torso le colgaba un mechón de pelo del cuello, al brazo le brotaba un hombro
con pelo encima. Se le puede decir cuatro veces "NO head, NO hair" y lo sigue
haciendo, porque un torso suelto no es una imagen que exista en el mundo y el
modelo empuja hacia lo que sí existe: una persona.

Un cuerpo entero SÍ es una imagen que existe, así que sale limpio. Cortarlo
después es un problema de píxeles, no de negociación con un modelo — y encima
las piezas salen coherentes entre sí por construcción: mismo trazo, mismos
colores, mismas proporciones, porque son el mismo dibujo.

LA T-POSE NO ES DECORATIVA: es lo que hace posible el corte. Con los brazos
pegados al cuerpo no hay línea por donde separarlos; abiertos en cruz y con las
piernas separadas, cada miembro ocupa su propia franja de la imagen y el corte
es geométrico.

EL MODELO IMPORTA. `gemini-3-pro-image` es el mejor que acepta este servidor y
la diferencia con el que usa por defecto no es sutil: respeta la pose pedida,
respeta "fondo transparente" y mantiene el grosor de línea parejo.
"""
import json, pathlib, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"
REG = AQUI / "assets" / "cuerpos.json"
MODELO = "gemini-3-pro-image"

POSE = ("Standing straight and facing the viewer in a perfect symmetrical T-POSE: both arms held "
        "STRAIGHT OUT HORIZONTALLY to the sides at shoulder height, elbows straight, fingers "
        "spread, and a clear visible gap of empty background between each arm and the torso. "
        "Legs straight and APART with a clear visible gap of empty background between them. "
        "Feet flat, pointing to the viewer's right.")

ESTILO = ("Flat 2D TV cartoon animation style, thin clean black outline of even weight, completely "
          "flat solid colours with no gradients and no shading. The whole body must be inside the "
          "image with room to spare — nothing cropped, no part touching the edges. Isolated on a "
          "fully transparent background. No drop shadow, no ground, no text, no frame, no second "
          "character.")

CUERPOS = {
  "rilo": ("Full body character model sheet of an original cartoon character for a 2D game: a TALL, "
           "very LANKY and THIN elderly scientist with narrow shoulders and long skinny limbs. Long "
           "narrow head, pale skin, deep wrinkles, sunken tired eyes with heavy lids, a wide flat "
           "grimacing mouth, a tiny blue drool drop at one corner, and unkempt pale-cyan hair that "
           "flicks out into points at the sides and over the top. He wears an open knee-length "
           "WHITE LAB COAT over a plain light-teal shirt, a small brown belt, plain brown khaki "
           "trousers and flat dark grey shoes. "
           f"{POSE} {ESTILO} "
           "NOT a real person, no glasses, no hat, no moustache, no beard."),
  "tito": ("Full body character model sheet of an original cartoon character for a 2D game: a SHORT "
           "teenage boy with a BIG ROUND HEAD and short stubby limbs. Very large round white eyes "
           "with small dark pupils, thin worried eyebrows, a small open nervous mouth, light tan "
           "skin, and brown bowl-cut hair covering his forehead and ears. He wears a plain bright "
           "YELLOW T-SHIRT with short sleeves, plain dark navy-blue jeans and white sneakers. "
           f"{POSE} {ESTILO} "
           "NOT a real person, no glasses, no hat."),
}


def rz(nombre, args, timeout=1800):
    r = subprocess.run([sys.executable, str(RZ), "call", nombre, json.dumps(args)],
                       cwd=AQUI, capture_output=True, text=True, timeout=timeout)
    s = r.stdout.strip()
    try:
        return json.loads(s[s.index("{"):])
    except Exception:
        return {"error": (s or r.stderr)[-400:]}


def cargar():
    return json.loads(REG.read_text()) if REG.exists() else {}


def anotar(k, v):
    d = cargar(); d[k] = {**d.get(k, {}), **v}
    REG.parent.mkdir(parents=True, exist_ok=True)
    REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def pedir(solo=None):
    d = cargar()
    for k, prompt in CUERPOS.items():
        if solo and k not in solo:
            continue
        if k in d and d[k].get("task_id") and not solo:
            print(f"  · {k} ya pedido"); continue
        if solo and k in d:
            d[k + f".v{len([x for x in d if x.startswith(k + '.v')]) + 1}"] = d.pop(k)
            REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))
        # n=2: dos intentos del mismo pedido cuestan casi lo mismo que uno y
        # evitan una vuelta entera de ida y vuelta cuando el primero sale con
        # una mano rara. Se elige a ojo cuál sirve.
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/cuerpo_{k}.png",
            "prompt": prompt, "model": MODELO, "size": "1024x1024",
            "transparent": True, "n": 2})
        if "task_id" not in r:
            print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"]})
        print(f"  ✓ {k} pedido con {MODELO}")


def bajar():
    d = cargar()
    for vuelta in range(150):
        pend = [k for k, x in d.items() if x.get("estado") not in ("ready", "failed")]
        if not pend:
            break
        r = rz("check_generation_tasks", {"task_ids": [d[k]["task_id"] for k in pend],
                                          "project_id": PROYECTO})
        for it in r.get("items", []):
            for k in pend:
                if d[k]["task_id"] == it["task_id"]:
                    d[k]["estado"] = it["status"]
                    if it.get("asset_path"):
                        d[k]["output_path"] = it["asset_path"]
                    if it.get("error") or it.get("failure"):
                        d[k]["error"] = it.get("error") or it.get("failure")
        for k2, v2 in d.items():
            anotar(k2, v2)
        listos = sum(1 for x in d.values() if x.get("estado") in ("ready", "failed"))
        print(f"  vuelta {vuelta + 1}: {listos}/{len(d)}", flush=True)
        if listos == len(d):
            break
        time.sleep(12)
    for k, x in d.items():
        if x.get("estado") != "ready":
            continue
        # n=2 deja dos archivos: el que dice output_path y su hermano -2.
        base = x["output_path"]
        for ruta in [base, base.replace(".png", "-2.png"),
                     base.replace("-g1.png", "-g2.png")]:
            r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": ruta})
            if "absolute_path" in r:
                print(f"  ↓ {ruta.split('/')[-1]}: {r['bytes'] // 1024} KB")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "pedir":
        pedir(sys.argv[2:] or None)
    elif modo == "bajar":
        bajar()
    else:
        for k, x in cargar().items():
            print(f"  {k}: {x.get('estado', 'pendiente')} {x.get('error', '')}")
