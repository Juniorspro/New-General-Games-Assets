#!/usr/bin/env python3
"""Genera las tres texturas del mundo y las deja listas para el juego.

    python3 generar_texturas.py pedir
    python3 generar_texturas.py bajar
    python3 generar_texturas.py preparar

Las piezas de los CUERPOS no salen de acá: salen de generar_cuerpos.py, que
genera un cuerpo entero por personaje, y de cortar_cuerpos.py, que lo parte.
Pedir piezas sueltas a un modelo se probó y se tiró — devolvía torsos con un
mechón de pelo colgando del cuello, porque un torso suelto no es una imagen
que exista y el modelo empuja hacia lo que sí existe.

Las texturas sí se piden sueltas, porque una textura repetible SÍ es una
imagen que existe y el modelo la entiende sin pelear.
"""
import json, pathlib, subprocess, sys, time

AQUI = pathlib.Path(__file__).parent
RZ = AQUI.parent / "herramientas" / "rezona" / "rz.py"
PROYECTO = "xVuxCcKGYO"
REG = AQUI / "assets" / "partes.json"

ESTILO = ("flat 2D TV cartoon animation cel, THIN clean black outline of even weight, completely "
          "flat solid colours with no gradients and no shading, simple animation model-sheet look, "
          "isolated on a fully transparent background, centred, no drop shadow, no text, no frame, "
          "no extra objects")

VERTICAL = ("vertical orientation, the top joint touching the top edge of the image and the bottom "
            "joint touching the bottom edge, filling the height of the image")

# LAS PROPORCIONES SON LA MITAD DEL PERSONAJE. Rilo es alto y flaco: brazos y
# piernas largos y finos, hombros angostos. Tito es bajo y cabezon: miembros
# cortos y gruesos. Pedir "un brazo" a secas devuelve el mismo tubo para los
# dos y despues los dos munecos se ven iguales con distinta ropa.
RILO = ("an original cartoon character: a TALL LANKY elderly scientist, very thin, narrow shoulders, "
        "pale skin, unkempt pale-cyan hair. NOT a real person, no glasses, no hat, no moustache")
TITO = ("an original cartoon character: a SHORT teenage boy, small and slightly chubby, light tan "
        "skin, brown bowl-cut hair. NOT a real person, no glasses, no hat")

FLACO = "long, thin and skinny, narrow"
CORTO = "short, small and a bit stubby"

# Las texturas SÍ llevan fondo: son rellenos, no recortes. Y tienen que ser
# repetibles, porque se usan como patrón: si los bordes no empalman, cada 256
# píxeles aparece una costura y el túnel se ve a cuadros.
TEXTURAS = {
  "pared": ("A seamless tileable texture of dark blue-grey riveted metal wall panels, flat vector "
            "cartoon style, subtle rivets and panel seams, even lighting, no shadows, no text. "
            "The pattern must tile seamlessly: the left edge continues into the right edge and the "
            "top edge into the bottom edge."),
  "repisa": ("A seamless tileable texture of a worn dark steel platform surface with a bright "
             "scuffed metal top edge, flat vector cartoon style, horizontal grooves, no text. "
             "The pattern must tile seamlessly left to right."),
  "soga": ("A seamless tileable texture of thick braided hemp rope, warm tan brown, flat vector "
           "cartoon style with a dark outline, the rope running horizontally straight across the "
           "image and touching both the left and the right edge, so that copies placed side by "
           "side form one continuous rope. Nothing else in the image."),
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


def pedir():
    d = cargar()
    todo = [(k, p, False, "512x512") for k, p in TEXTURAS.items()]
    for k, prompt, trans, size in todo:
        if k in d and d[k].get("task_id"):
            print(f"  · {k} ya pedido"); continue
        r = rz("submit_image_generation", {
            "project_id": PROYECTO, "output_path": f"assets/{k}.png",
            "prompt": prompt, "model": "gemini-3-pro-image",
            "size": size, "transparent": trans})
        if "task_id" not in r:
            print(f"  ✗ {k}: {r}"); continue
        anotar(k, {"task_id": r["task_id"], "output_path": r["output_path"], "trans": trans})
        print(f"  ✓ {k}")


def bajar():
    d = cargar()
    for vuelta in range(120):
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
        if x.get("estado") != "ready" or x.get("local"):
            continue
        r = rz("fetch_generated_asset", {"project_id": PROYECTO, "output_path": x["output_path"]})
        if "absolute_path" in r:
            x["local"] = r["absolute_path"]
            print(f"  ↓ {k}: {r['bytes'] // 1024} KB")
        else:
            print(f"  ✗ {k}: {r}")
        anotar(k, x)


def rehacer(claves):
    """Volver a pedir piezas puntuales.

    Guarda la anterior con el sufijo `.viejo` en vez de pisarla: una pieza
    nueva puede salir peor que la que reemplaza, y sin la copia no hay vuelta
    atras que no sea pedirla otra vez y pagarla otra vez.
    """
    d = cargar()
    for k in claves:
        if k in d:
            d[k + ".viejo"] = d.pop(k)
    REG.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    pedir()


def tira_de_soga(im):
    """Quedarse con la franja de soga: se tiran las filas casi todas blancas."""
    im = im.convert("RGB")
    px = im.load()
    an, al = im.size
    filas = []
    for y in range(al):
        oscuro = sum(1 for x in range(0, an, 4) if sum(px[x, y]) < 660)
        filas.append(oscuro / (an // 4) > 0.25)
    arriba = next((y for y, v in enumerate(filas) if v), 0)
    abajo = al - next((y for y, v in enumerate(reversed(filas)) if v), 0)
    return im.crop((0, arriba, an, abajo))


def preparar():
    """Recortar, escalar y pasar a WebP. La soga es una tira: el generador la
    devuelve con blanco arriba y abajo que no es soga, y esas filas se tiran."""
    from PIL import Image
    destino = AQUI / "assets" / "partes"
    destino.mkdir(parents=True, exist_ok=True)
    total = 0
    for k in TEXTURAS:
        f = AQUI / "assets" / f"{k}-g1.png"
        if not f.exists():
            print(f"  · falta {f.name}"); continue
        im = Image.open(f)
        if k == "soga":
            im = tira_de_soga(im)
            im = im.resize((256, max(8, round(im.height * 256 / im.width))), Image.LANCZOS)
        else:
            im = im.convert("RGB").resize((256, 256 if k == "pared" else 96), Image.LANCZOS)
        salida = destino / f"{k}.webp"
        im.save(salida, "WEBP", quality=88, method=6)
        kb = salida.stat().st_size / 1024
        total += kb
        print(f"  {k:8} {im.size[0]}x{im.size[1]:<4} {kb:5.1f} KB")
    print(f"\n  {total:.0f} KB en texturas")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if modo == "preparar":
        preparar(); sys.exit(0)
    if modo == "rehacer":
        rehacer(sys.argv[2:])
    elif modo == "pedir":
        pedir()
    elif modo == "bajar":
        bajar()
    else:
        for k, x in cargar().items():
            print(f"  {k}: {x.get('estado', 'pendiente')} {x.get('local', '')} {x.get('error', '')}")
